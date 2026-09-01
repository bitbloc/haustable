/* Hallmark · component: HausmadeCatalogManager · theme: Atelier (Thai Modern OKLCH)
 * features: Product Management, Photo Previews, Pre-Order Switch, Stock Counts per Size, Hero Pinning
 */
import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabaseClient'
import HausmadeProductEditorModal from './HausmadeProductEditorModal'
import { isPreOrderItem, getPreOrderEta, getProductImages } from '../../hooks/useHausmadeShop'

export default function HausmadeCatalogManager() {
    const [products, setProducts] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL') // 'ALL' | 'IN_STOCK' | 'PRE_ORDER' | 'LOW_STOCK' | 'HERO'

    // Editor Modal state
    const [isEditorOpen, setIsEditorOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState(null)

    // Load HAUSMADE Products & Categories
    const fetchCatalog = async () => {
        try {
            setLoading(true)
            const [catsRes, itemsRes] = await Promise.all([
                supabase.from('menu_categories').select('*').order('display_order', { ascending: true }),
                supabase.from('menu_items')
                    .select('*, menu_categories(*), menu_item_options(*, option_groups(*, option_choices(*)))')
                    .order('created_at', { ascending: false })
            ])

            if (itemsRes.error) throw itemsRes.error

            const allCats = catsRes.data || []
            const allItems = itemsRes.data || []

            // Filter hausmade items
            const hausmadeCatIds = new Set(
                allCats
                    .filter(c => {
                        const name = (c.name || '').toLowerCase()
                        return name.includes('hausmade') || name.includes('retail') || name.includes('ของฝาก') || name.includes('สินค้า')
                    })
                    .map(c => c.id)
            )

            const hausmadeItems = allItems.filter(item => {
                if (item.is_hausmade === true) return true
                if (item.category_id && hausmadeCatIds.has(item.category_id)) return true
                const catName = ((item.menu_categories?.name || item.category || '')).toLowerCase()
                if (catName.includes('hausmade') || catName.includes('retail') || catName.includes('ของฝาก')) return true
                return false
            })

            setCategories(allCats)
            setProducts(hausmadeItems.length > 0 ? hausmadeItems : allItems)
        } catch (err) {
            console.error('[HausmadeCatalogManager] Fetch catalog error:', err)
            toast.error('ไม่สามารถโหลดรายการสินค้าได้: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchCatalog()

        // Realtime Subscription
        const channel = supabase
            .channel('admin-hausmade-catalog-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => fetchCatalog())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'option_choices' }, () => fetchCatalog())
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    // Quick Inline Toggle Available
    const handleToggleAvailable = async (item) => {
        const nextState = !(item.is_available !== false)
        try {
            const { error } = await supabase
                .from('menu_items')
                .update({ is_available: nextState })
                .eq('id', item.id)

            if (error) throw error
            setProducts(prev => prev.map(p => p.id === item.id ? { ...p, is_available: nextState } : p))
            toast.success(nextState ? `เปิดขาย "${item.name}" แล้ว` : `ซ่อน "${item.name}" ชั่วคราว`)
        } catch (err) {
            toast.error('ไม่สามารถเปลี่ยนสถานะได้: ' + err.message)
        }
    }

    // Quick Inline Toggle Pre-Order
    const handleTogglePreOrder = async (item) => {
        const nextState = !isPreOrderItem(item)
        try {
            let payload = {
                is_preorder: nextState,
                sub_category: nextState ? 'PRE-ORDER' : (item.sub_category === 'PRE-ORDER' ? 'APPAREL' : (item.sub_category || 'HAUSMADE')),
                preorder_eta: nextState ? (item.preorder_eta || 'จัดส่งตามรอบการผลิต (ภายใน 7 วันทำการ)') : null
            }
            
            let { error } = await supabase
                .from('menu_items')
                .update(payload)
                .eq('id', item.id)

            // If column is_preorder does not exist in DB schema, fallback gracefully to encoding in name/description
            if (error && error.message && error.message.includes('column')) {
                console.warn('[HausmadeCatalogManager] Column not found, applying fallback update:', error.message)
                let cleanName = item.name.replace(/^\[PRE-ORDER\]\s*/i, '').trim()
                const updatedName = nextState ? `[PRE-ORDER] ${cleanName}` : cleanName
                
                let desc = item.description || ''
                if (nextState) {
                    if (!desc.includes('[PRE-ORDER')) {
                        desc = `[PRE-ORDER รอบส่ง: จัดส่งตามรอบการผลิต (ภายใน 7 วันทำการ)]\n${desc}`.trim()
                    }
                } else {
                    desc = desc.replace(/\[PRE-ORDER[^\]]*\]\s*/gi, '').trim()
                }

                const fallbackPayload = {
                    name: updatedName,
                    description: desc
                }

                const fallbackRes = await supabase
                    .from('menu_items')
                    .update(fallbackPayload)
                    .eq('id', item.id)

                if (fallbackRes.error) throw fallbackRes.error

                payload = {
                    ...payload,
                    name: updatedName,
                    description: desc
                }
            } else if (error) {
                throw error
            }

            setProducts(prev => prev.map(p => p.id === item.id ? { ...p, ...payload, is_preorder: nextState } : p))
            toast.success(nextState ? `ตั้งค่า "${item.name}" เป็นสินค้า Pre-Order ⏳` : `เปลี่ยน "${item.name}" เป็นสินค้าพร้อมส่งปกติ 📦`)
        } catch (err) {
            console.error('[HausmadeCatalogManager] Toggle pre-order error:', err)
            toast.error('ไม่สามารถเปลี่ยนโหมด Pre-Order ได้: ' + err.message)
        }
    }

    // Quick Inline Toggle Hero Feature
    const handleToggleHero = async (item) => {
        const nextState = !(item.is_recommended === true || item.is_hero_featured === true)
        try {
            let { error } = await supabase
                .from('menu_items')
                .update({ is_recommended: nextState, is_hero_featured: nextState })
                .eq('id', item.id)

            if (error && error.message && error.message.includes('column')) {
                // Fallback to updating is_recommended only
                const fallbackRes = await supabase
                    .from('menu_items')
                    .update({ is_recommended: nextState })
                    .eq('id', item.id)
                if (fallbackRes.error) throw fallbackRes.error
            } else if (error) {
                throw error
            }

            setProducts(prev => prev.map(p => p.id === item.id ? { ...p, is_recommended: nextState, is_hero_featured: nextState } : p))
            toast.success(nextState ? `ปักหมุด "${item.name}" บน Hero Banner แล้ว ⭐` : `ยกเลิกการปักหมุด "${item.name}"`)
        } catch (err) {
            toast.error('ไม่สามารถเปลี่ยนสถานะ Hero ได้: ' + err.message)
        }
    }

    // Duplicate Product
    const handleDuplicate = async (item) => {
        try {
            const newName = `${item.name} (สำเนา)`
            const payload = {
                name: newName,
                price: item.price,
                category_id: item.category_id,
                category: item.category,
                sub_category: item.sub_category,
                description: item.description,
                image_url: item.image_url,
                is_available: true,
                is_recommended: false,
                is_hausmade: true,
                is_pickup_available: true,
                is_preorder: item.is_preorder === true,
                preorder_eta: item.preorder_eta,
                stock_quantity: item.stock_quantity,
                remaining_stock: item.remaining_stock,
                tags: item.tags
            }

            let { data: newInserted, error: insertError } = await supabase
                .from('menu_items')
                .insert(payload)
                .select()
                .single()

            if (insertError && insertError.message && insertError.message.includes('column')) {
                // Fallback with standard columns only
                const fallbackPayload = {
                    name: newName,
                    price: item.price,
                    category_id: item.category_id,
                    category: item.category || 'HAUSMADE',
                    description: item.description,
                    image_url: item.image_url,
                    is_available: true,
                    is_recommended: false,
                    is_pickup_available: true
                }
                const fallbackRes = await supabase
                    .from('menu_items')
                    .insert(fallbackPayload)
                    .select()
                    .single()

                if (fallbackRes.error) throw fallbackRes.error
                newInserted = fallbackRes.data
            } else if (insertError) {
                throw insertError
            }

            // Duplicate Option Groups
            if (item.menu_item_options?.length > 0 && newInserted?.id) {
                const links = item.menu_item_options.map(opt => ({
                    menu_item_id: newInserted.id,
                    option_group_id: opt.option_group_id,
                    display_order: opt.display_order
                }))
                await supabase.from('menu_item_options').insert(links)
            }

            toast.success(`คัดลอกสินค้า "${newName}" เรียบร้อย`)
            fetchCatalog()
        } catch (err) {
            toast.error('คัดลอกสินค้าไม่สำเร็จ: ' + err.message)
        }
    }

    // Delete / Archive Product
    const handleDelete = async (item) => {
        if (!confirm(`คุณต้องการลบสินค้า "${item.name}" ใช่หรือไม่?`)) return
        try {
            const { error } = await supabase.from('menu_items').delete().eq('id', item.id)
            if (error) {
                // If has foreign key constraints, archive instead
                if (error.code === '23503') {
                    await supabase.from('menu_items').update({
                        is_available: false,
                        is_hausmade: false,
                        category: 'Archived'
                    }).eq('id', item.id)
                    toast.success('ย้ายสินค้าไปที่ Archived เรียบร้อย (เนื่องจากมีประวัติการสั่งซื้อ)')
                    fetchCatalog()
                    return
                }
                throw error
            }
            toast.success('ลบสินค้าเรียบร้อย')
            fetchCatalog()
        } catch (err) {
            toast.error('ไม่สามารถลบสินค้าได้: ' + err.message)
        }
    }

    // Computed Stats
    const stats = useMemo(() => {
        let total = products.length
        let inStock = 0
        let preOrder = 0
        let hero = 0
        let lowStock = 0

        products.forEach(p => {
            if (isPreOrderItem(p)) preOrder++
            else if (p.is_available !== false) inStock++

            if (p.is_recommended || p.is_hero_featured) hero++

            const stock = p.stock_quantity ?? p.remaining_stock
            if (stock !== null && stock > 0 && stock <= 5) lowStock++
        })

        return { total, inStock, preOrder, hero, lowStock }
    }, [products])

    // Filtered Products
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            // Status Filter
            if (statusFilter === 'IN_STOCK' && (isPreOrderItem(p) || p.is_available === false)) return false
            if (statusFilter === 'PRE_ORDER' && !isPreOrderItem(p)) return false
            if (statusFilter === 'LOW_STOCK') {
                const stock = p.stock_quantity ?? p.remaining_stock
                if (stock === null || stock <= 0 || stock > 5) return false
            }
            if (statusFilter === 'HERO' && !p.is_recommended && !p.is_hero_featured) return false

            // Search Filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim()
                const name = (p.name || '').toLowerCase()
                const desc = (p.description || '').toLowerCase()
                const cat = (p.menu_categories?.name || p.category || '').toLowerCase()
                const sub = (p.sub_category || '').toLowerCase()
                return name.includes(q) || desc.includes(q) || cat.includes(q) || sub.includes(q)
            }

            return true
        })
    }, [products, statusFilter, searchQuery])

    return (
        <div className="flex flex-col gap-6">

            {/* TOP STATS BAR */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div
                    onClick={() => setStatusFilter('ALL')}
                    className={`p-3.5 border font-mono flex flex-col justify-between cursor-pointer transition-all ${
                        statusFilter === 'ALL'
                            ? 'bg-[oklch(18%_0.012_28)] text-white border-[oklch(18%_0.012_28)]'
                            : 'bg-white border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                    }`}
                >
                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-70">
                        [ สินค้าทั้งหมด // ALL ]
                    </span>
                    <span className="text-2xl font-black mt-1">{stats.total}</span>
                </div>

                <div
                    onClick={() => setStatusFilter('IN_STOCK')}
                    className={`p-3.5 border font-mono flex flex-col justify-between cursor-pointer transition-all ${
                        statusFilter === 'IN_STOCK'
                            ? 'bg-[oklch(18%_0.012_28)] text-white border-[oklch(18%_0.012_28)]'
                            : 'bg-white border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                    }`}
                >
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[oklch(45%_0.08_140)]">
                        [ พร้อมส่ง // IN STOCK ]
                    </span>
                    <span className="text-2xl font-black mt-1 text-[oklch(45%_0.08_140)]">{stats.inStock}</span>
                </div>

                <div
                    onClick={() => setStatusFilter('PRE_ORDER')}
                    className={`p-3.5 border font-mono flex flex-col justify-between cursor-pointer transition-all ${
                        statusFilter === 'PRE_ORDER'
                            ? 'bg-[oklch(18%_0.012_28)] text-white border-[oklch(18%_0.012_28)]'
                            : 'bg-white border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                    }`}
                >
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[oklch(52%_0.16_28)]">
                        [ ⏳ เปิดจอง // PRE-ORDER ]
                    </span>
                    <span className="text-2xl font-black mt-1 text-[oklch(52%_0.16_28)]">{stats.preOrder}</span>
                </div>

                <div
                    onClick={() => setStatusFilter('HERO')}
                    className={`p-3.5 border font-mono flex flex-col justify-between cursor-pointer transition-all ${
                        statusFilter === 'HERO'
                            ? 'bg-[oklch(18%_0.012_28)] text-white border-[oklch(18%_0.012_28)]'
                            : 'bg-white border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                    }`}
                >
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600">
                        [ ⭐ ปักหมุด HERO ]
                    </span>
                    <span className="text-2xl font-black mt-1 text-amber-600">{stats.hero}</span>
                </div>

                <div
                    onClick={() => setStatusFilter('LOW_STOCK')}
                    className={`p-3.5 border font-mono flex flex-col justify-between cursor-pointer transition-all ${
                        statusFilter === 'LOW_STOCK'
                            ? 'bg-[oklch(18%_0.012_28)] text-white border-[oklch(18%_0.012_28)]'
                            : 'bg-white border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                    }`}
                >
                    <span className="text-[10px] uppercase font-bold tracking-wider text-red-600">
                        [ ⚠️ ใกล้หมด // LOW ]
                    </span>
                    <span className="text-2xl font-black mt-1 text-red-600">{stats.lowStock}</span>
                </div>
            </div>

            {/* SEARCH & ACTION TOOLBAR */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)]">
                <div className="flex-1 relative">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="ค้นหาชื่อสินค้า, รายละเอียด, เสื้อยืด, กาแฟ..."
                        className="w-full px-3 py-2 bg-white border border-[oklch(85%_0.012_28)] font-mono text-xs focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[oklch(55%_0.010_28)]"
                        >
                            ✕
                        </button>
                    )}
                </div>

                <button
                    onClick={() => {
                        setEditingProduct(null)
                        setIsEditorOpen(true)
                    }}
                    className="px-5 py-2.5 bg-[oklch(52%_0.16_28)] text-white font-bold text-xs uppercase tracking-wider hover:bg-[oklch(45%_0.16_28)] transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                >
                    <span>[ + เพิ่มสินค้าใหม่ // ADD PRODUCT ]</span>
                </button>
            </div>

            {/* PRODUCTS LIST GRID */}
            {loading ? (
                <div className="p-12 text-center font-mono text-xs text-[oklch(55%_0.010_28)] flex flex-col items-center gap-2">
                    <div className="w-5 h-5 border-2 border-[oklch(52%_0.16_28)] border-t-transparent rounded-full animate-spin" />
                    <span>LOADING HAUSMADE CATALOG...</span>
                </div>
            ) : filteredProducts.length === 0 ? (
                <div className="p-12 text-center font-mono text-xs text-[oklch(55%_0.010_28)] border border-dashed border-[oklch(85%_0.012_28)] bg-white">
                    [ ไม่พบสินค้าที่ตรงตามเงื่อนไข ]
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProducts.map((product) => {
                        const isPo = isPreOrderItem(product)
                        const isHidden = product.is_available === false
                        const isPinnedHero = product.is_recommended === true || product.is_hero_featured === true
                        const optionGroups = product.menu_item_options?.map(o => o.option_groups).filter(Boolean) || []
                        const totalVariants = optionGroups.reduce((sum, g) => sum + (g.option_choices?.length || 0), 0)
                        const productImages = getProductImages(product)
                        const hasMultipleImages = productImages.length > 1

                        return (
                            <div
                                key={product.id}
                                className={`bg-white border transition-all flex flex-col justify-between relative group ${
                                    isHidden
                                        ? 'border-gray-300 opacity-60 bg-gray-50'
                                        : 'border-[oklch(85%_0.012_28)] hover:border-[oklch(52%_0.16_28)] shadow-xs'
                                }`}
                            >
                                {/* Top Image & Badges */}
                                <div>
                                    <div className="h-48 bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] relative overflow-hidden flex items-center justify-center">
                                        {productImages.length > 0 ? (
                                            <img
                                                src={productImages[0]}
                                                alt={product.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        ) : (
                                            <span className="font-mono text-[10px] text-[oklch(55%_0.010_28)] uppercase">
                                                [ NO IMAGE // ยังไม่มีรูป ]
                                            </span>
                                        )}

                                        {/* Status Badges */}
                                        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                                            {isPo ? (
                                                <span className="px-2 py-0.5 bg-[oklch(45%_0.08_140)] text-white font-mono text-[9px] font-bold uppercase shadow-sm">
                                                    ⏳ PRE-ORDER
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 bg-[oklch(18%_0.012_28)] text-white font-mono text-[9px] font-bold uppercase shadow-sm">
                                                    📦 IN-STOCK
                                                </span>
                                            )}

                                            {isPinnedHero && (
                                                <span className="px-2 py-0.5 bg-amber-500 text-white font-mono text-[9px] font-bold uppercase shadow-sm">
                                                    ⭐ HERO PINNED
                                                </span>
                                            )}
                                        </div>

                                        <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
                                            <button
                                                onClick={() => handleToggleAvailable(product)}
                                                className={`px-2 py-0.5 font-mono text-[9px] font-bold uppercase shadow-sm cursor-pointer ${
                                                    product.is_available !== false
                                                        ? 'bg-emerald-600 text-white'
                                                        : 'bg-red-600 text-white'
                                                }`}
                                            >
                                                {product.is_available !== false ? 'เปิดขาย' : 'ซ่อนอยู่'}
                                            </button>
                                        </div>

                                        {/* Multi-Photo Count Badge */}
                                        {hasMultipleImages && (
                                            <div className="absolute bottom-2 right-2 bg-[oklch(18%_0.012_28)]/90 text-white px-2 py-0.5 font-mono text-[9px] font-bold uppercase shadow-sm backdrop-blur-xs flex items-center gap-1">
                                                <span>📷</span>
                                                <span>{productImages.length} รูป</span>
                                            </div>
                                        )}
                                    </div>


                                    {/* Product Details */}
                                    <div className="p-4 flex flex-col gap-2">
                                        <div className="flex justify-between items-start gap-2">
                                            <div>
                                                <span className="font-mono text-[9px] text-[oklch(52%_0.16_28)] uppercase font-bold block">
                                                    // {product.sub_category || product.category || 'HAUSMADE'}
                                                </span>
                                                <h3 className="font-bold text-sm text-[oklch(18%_0.012_28)] line-clamp-1">
                                                    {product.name}
                                                </h3>
                                            </div>
                                            <span className="font-mono font-black text-sm text-[oklch(18%_0.012_28)] whitespace-nowrap">
                                                ฿{product.price}.-
                                            </span>
                                        </div>

                                        {product.description && (
                                            <p className="font-sans text-[11px] text-[oklch(42%_0.010_28)] line-clamp-2 leading-relaxed">
                                                {product.description}
                                            </p>
                                        )}

                                        {/* Pre-Order ETA Info */}
                                        {isPo && (
                                            <div className="p-2 bg-[oklch(45%_0.08_140)]/10 border border-[oklch(45%_0.08_140)]/40 font-mono text-[10px] text-[oklch(45%_0.08_140)]">
                                                <strong>รอบส่ง:</strong> {getPreOrderEta(product)}
                                            </div>
                                        )}

                                        {/* Variants Summary */}
                                        {totalVariants > 0 && (
                                            <div className="mt-1 font-mono text-[10px] text-[oklch(55%_0.010_28)] flex items-center justify-between border-t border-[oklch(85%_0.012_28)]/60 pt-2">
                                                <span>มี {totalVariants} ตัวเลือกไซส์/แบบ</span>
                                                <span className="text-[oklch(52%_0.16_28)] font-bold">
                                                    {optionGroups[0]?.option_choices?.map(c => c.name.split(' ')[0]).join(', ')}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Bottom Action Bar */}
                                <div className="p-3 bg-[oklch(94%_0.010_28)] border-t border-[oklch(85%_0.012_28)] flex items-center justify-between font-mono text-[10px] gap-1 flex-wrap">
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => handleTogglePreOrder(product)}
                                            title="สลับโหมด Pre-Order"
                                            className={`px-2 py-1 border transition-colors ${
                                                isPo
                                                    ? 'border-[oklch(45%_0.08_140)] text-[oklch(45%_0.08_140)] bg-white'
                                                    : 'border-[oklch(85%_0.012_28)] text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                                            }`}
                                        >
                                            {isPo ? '⏳ PRE-ORDER' : '📦 IN-STOCK'}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleToggleHero(product)}
                                            title="ปักหมุดบน Hero Carousel หน้าร้าน"
                                            className={`px-2 py-1 border transition-colors ${
                                                isPinnedHero
                                                    ? 'border-amber-500 text-amber-700 bg-amber-50 font-bold'
                                                    : 'border-[oklch(85%_0.012_28)] text-[oklch(55%_0.010_28)] hover:text-amber-600'
                                            }`}
                                        >
                                            {isPinnedHero ? '★ HERO' : '☆ HERO'}
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => handleDuplicate(product)}
                                            title="คัดลอกสินค้านี้"
                                            className="px-2 py-1 border border-[oklch(85%_0.012_28)] text-[oklch(42%_0.010_28)] hover:bg-white transition-colors"
                                        >
                                            [ คัดลอก ]
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingProduct(product)
                                                setIsEditorOpen(true)
                                            }}
                                            className="px-3 py-1 bg-[oklch(18%_0.012_28)] text-white font-bold hover:bg-black transition-colors"
                                        >
                                            [ ✏️ แก้ไข ]
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleDelete(product)}
                                            title="ลบสินค้านี้"
                                            className="p-1 text-red-500 hover:text-red-700"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* PRODUCT EDITOR MODAL */}
            {isEditorOpen && (
                <HausmadeProductEditorModal
                    isOpen={isEditorOpen}
                    product={editingProduct}
                    categories={categories}
                    onClose={() => {
                        setIsEditorOpen(false)
                        setEditingProduct(null)
                    }}
                    onSaved={() => fetchCatalog()}
                />
            )}
        </div>
    )
}
