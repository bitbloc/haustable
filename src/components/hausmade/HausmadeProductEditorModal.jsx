/* Hallmark · component: HausmadeProductEditorModal · theme: Atelier (Thai Modern OKLCH)
 * features: Photo Upload & Compression, Pre-Order & Dispatch ETA Switch, 1-Click T-Shirt Size Matrix, Variant Stock, Hero Pinning
 */
import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabaseClient'
import { TSHIRT_SIZE_CHART, getSizingInfo } from './HausmadeProductModal'

const CATEGORY_PRESETS = [
    { key: 'APPAREL', label: 'APPAREL & MERCH // เสื้อผ้า & สินค้าที่ระลึก' },
    { key: 'COFFEE', label: 'COFFEE BEANS // เมล็ดกาแฟคราฟต์' },
    { key: 'PANTRY', label: 'PANTRY & SAUCE // ซอส & วัตถุดิบท้องถิ่น' },
    { key: 'LIFESTYLE', label: 'LIFESTYLE & CRAFT // งานคราฟต์ & ของใช้' },
    { key: 'PREORDER', label: 'PRE-ORDER SPECIAL // สินค้าเปิดสั่งจองพิเศษ' }
]

export default function HausmadeProductEditorModal({
    isOpen,
    product = null,
    categories = [],
    onClose,
    onSaved
}) {
    const fileInputRef = useRef(null)
    const [isSaving, setIsSaving] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(false)

    // Basic Product Form
    const [name, setName] = useState('')
    const [price, setPrice] = useState('')
    const [categoryName, setCategoryName] = useState('HAUSMADE RETAIL')
    const [subCategory, setSubCategory] = useState('APPAREL')
    const [description, setDescription] = useState('')
    const [imageUrl, setImageUrl] = useState('')
    const [isAvailable, setIsAvailable] = useState(true)
    const [isHeroFeatured, setIsHeroFeatured] = useState(false)
    const [stockQuantity, setStockQuantity] = useState('')
    const [tagsText, setTagsText] = useState('')

    // Pre-Order Configuration
    const [isPreOrder, setIsPreOrder] = useState(false)
    const [preOrderEta, setPreOrderEta] = useState('')

    // Variants / Size Matrix
    const [variants, setVariants] = useState([])
    const [variantGroupName, setVariantGroupName] = useState('ขนาดไซส์ (Size)')
    const [hasVariants, setHasVariants] = useState(false)

    // Coffee / Craft Specs (Optional)
    const [roastLevel, setRoastLevel] = useState('')
    const [origin, setOrigin] = useState('')
    const [process, setProcess] = useState('')
    const [tastingNotes, setTastingNotes] = useState('')

    // Initialize Form State when modal opens or editing product changes
    useEffect(() => {
        if (!isOpen) return

        if (product) {
            setName(product.name || '')
            setPrice(product.price !== undefined ? String(product.price) : '')
            setCategoryName(product.menu_categories?.name || product.category || 'HAUSMADE RETAIL')
            setSubCategory(product.sub_category || 'APPAREL')
            setDescription(product.description || '')
            setImageUrl(product.image_url || '')
            setIsAvailable(product.is_available !== false)
            setIsHeroFeatured(product.is_recommended === true || product.is_hero_featured === true)
            setStockQuantity(product.stock_quantity ?? product.remaining_stock ?? '')
            
            // Tags
            const tags = Array.isArray(product.tags) ? product.tags.join(', ') : (product.tags || '')
            setTagsText(tags)

            // Pre-Order
            const isPo = product.is_preorder === true || (product.sub_category || '').toLowerCase().includes('preorder')
            setIsPreOrder(isPo)
            setPreOrderEta(product.preorder_eta || product.preorder_release_date || '')

            // Craft Specs
            const specs = product.craft_specs || product.metadata || {}
            setRoastLevel(specs.roast_level || '')
            setOrigin(specs.origin || product.origin || '')
            setProcess(specs.process || '')
            setTastingNotes(specs.tasting_notes || product.tasting_notes || '')

            // Load Existing Variants / Option Groups
            const existingGroups = product.menu_item_options?.map(o => o.option_groups).filter(Boolean) || []
            if (existingGroups.length > 0) {
                const firstGroup = existingGroups[0]
                setHasVariants(true)
                setVariantGroupName(firstGroup.name || 'ขนาดไซส์ (Size)')
                const mappedChoices = (firstGroup.option_choices || []).map(c => ({
                    id: c.id,
                    name: c.name,
                    price_modifier: c.price_modifier || c.price || 0,
                    stock: c.stock_quantity ?? c.remaining_stock ?? '',
                    is_available: c.is_available !== false
                }))
                setVariants(mappedChoices)
            } else {
                setHasVariants(false)
                setVariants([])
            }
        } else {
            // New Product defaults
            setName('')
            setPrice('')
            setCategoryName('HAUSMADE RETAIL')
            setSubCategory('APPAREL')
            setDescription('')
            setImageUrl('')
            setIsAvailable(true)
            setIsHeroFeatured(false)
            setStockQuantity('20')
            setTagsText('HAUSMADE, NAKHON PHANOM')
            setIsPreOrder(false)
            setPreOrderEta('')
            setHasVariants(false)
            setVariants([])
            setRoastLevel('')
            setOrigin('')
            setProcess('')
            setTastingNotes('')
        }
    }, [isOpen, product])

    // Keyboard ESC to close
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    // 1-Click Preset: Generate Standard T-Shirt Sizes (S - 4XL)
    const handleApplyTshirtSizePreset = () => {
        setHasVariants(true)
        setVariantGroupName('ขนาดไซส์ (Size)')
        const generated = TSHIRT_SIZE_CHART.map(sizeItem => ({
            name: `${sizeItem.size} (อก ${sizeItem.chest} · ยาว ${sizeItem.length})`,
            price_modifier: (sizeItem.size === '3XL' || sizeItem.size === '4XL') ? 50 : 0,
            stock: 10,
            is_available: true
        }))
        setVariants(generated)
        toast.success('สร้างตารางไซส์เสื้อมาตรฐาน HAUSMADE (S - 4XL) สำเร็จ')
    }

    // Add Blank Custom Variant Row
    const handleAddVariantRow = () => {
        setHasVariants(true)
        setVariants(prev => [
            ...prev,
            { name: '', price_modifier: 0, stock: 10, is_available: true }
        ])
    }

    // Update Variant Field
    const handleUpdateVariant = (index, field, value) => {
        setVariants(prev => {
            const next = [...prev]
            next[index] = { ...next[index], [field]: value }
            return next
        })
    }

    // Remove Variant Row
    const handleRemoveVariant = (index) => {
        setVariants(prev => prev.filter((_, i) => i !== index))
    }

    // Image Resize & Upload Helper
    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploadProgress(true)
        try {
            // Compress & resize image to max 1200x1200px
            const reader = new FileReader()
            reader.readAsDataURL(file)
            reader.onload = async (event) => {
                const img = new Image()
                img.src = event.target.result
                img.onload = async () => {
                    const canvas = document.createElement('canvas')
                    let width = img.width
                    let height = img.height
                    const MAX_SIZE = 1200

                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height = Math.round((height * MAX_SIZE) / width)
                            width = MAX_SIZE
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width = Math.round((width * MAX_SIZE) / height)
                            height = MAX_SIZE
                        }
                    }

                    canvas.width = width
                    canvas.height = height
                    const ctx = canvas.getContext('2d')
                    ctx.drawImage(img, 0, 0, width, height)

                    canvas.toBlob(async (blob) => {
                        if (!blob) throw new Error('ไม่สามารถแปลงไฟล์รูปภาพได้')
                        
                        const fileExt = file.name.split('.').pop() || 'jpg'
                        const fileName = `hausmade_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${fileExt}`
                        
                        const { error: uploadError } = await supabase.storage
                            .from('public-assets')
                            .upload(fileName, blob, {
                                contentType: file.type || 'image/jpeg',
                                cacheControl: '15552000'
                            })

                        if (uploadError) throw uploadError

                        const { data: { publicUrl } } = supabase.storage
                            .from('public-assets')
                            .getPublicUrl(fileName)

                        setImageUrl(publicUrl)
                        setUploadProgress(false)
                        toast.success('อัปโหลดรูปภาพสินค้าสำเร็จ')
                    }, 'image/jpeg', 0.88)
                }
            }
        } catch (err) {
            console.error('Image upload failed:', err)
            toast.error('อัปโหลดรูปภาพไม่สำเร็จ: ' + err.message)
            setUploadProgress(false)
        }
    }

    // Save Product to Supabase
    const handleSave = async (e) => {
        e.preventDefault()

        if (!name.trim()) {
            toast.error('กรุณาระบุชื่อสินค้า')
            return
        }

        const numericPrice = parseFloat(price)
        if (isNaN(numericPrice) || numericPrice < 0) {
            toast.error('กรุณาระบุราคาที่ถูกต้อง')
            return
        }

        setIsSaving(true)
        try {
            // Find or link category_id
            const matchedCategory = categories.find(c => (c.name || '').toLowerCase() === categoryName.toLowerCase()) || categories[0]
            const categoryId = matchedCategory ? matchedCategory.id : null

            // Clean Tags
            const parsedTags = tagsText
                .split(',')
                .map(t => t.trim())
                .filter(Boolean)

            if (isPreOrder && !parsedTags.includes('PRE-ORDER')) {
                parsedTags.push('PRE-ORDER')
            }

            // Craft Specs object
            const craftSpecsObj = {}
            if (roastLevel) craftSpecsObj.roast_level = roastLevel
            if (origin) craftSpecsObj.origin = origin
            if (process) craftSpecsObj.process = process
            if (tastingNotes) craftSpecsObj.tasting_notes = tastingNotes

            const payload = {
                name: name.trim(),
                price: numericPrice,
                category_id: categoryId,
                category: categoryName,
                sub_category: isPreOrder ? 'PRE-ORDER' : subCategory,
                description: description.trim(),
                image_url: imageUrl.trim(),
                is_available: isAvailable,
                is_recommended: isHeroFeatured,
                is_hausmade: true,
                is_pickup_available: true,
                is_preorder: isPreOrder,
                preorder_eta: isPreOrder ? (preOrderEta.trim() || 'จัดส่งตามรอบการผลิต (ภายใน 5-7 วันทำการ)') : null,
                stock_quantity: stockQuantity !== '' ? parseInt(stockQuantity, 10) : null,
                remaining_stock: stockQuantity !== '' ? parseInt(stockQuantity, 10) : null,
                tags: parsedTags,
                origin: origin.trim() || null,
                tasting_notes: tastingNotes.trim() || null,
                craft_specs: Object.keys(craftSpecsObj).length > 0 ? craftSpecsObj : null
            }

            let savedItemId = product?.id

            if (savedItemId) {
                // Update Existing
                let { error: updateError } = await supabase
                    .from('menu_items')
                    .update(payload)
                    .eq('id', savedItemId)

                if (updateError && updateError.message && updateError.message.includes('column')) {
                    console.warn('[HausmadeProductEditorModal] DB column missing, using resilient fallback:', updateError.message)
                    let enrichedDesc = description.trim()
                    if (isPreOrder && !enrichedDesc.includes('[PRE-ORDER')) {
                        const eta = preOrderEta.trim() || 'จัดส่งตามรอบการผลิต (ภายใน 5-7 วันทำการ)'
                        enrichedDesc = `[PRE-ORDER รอบส่ง: ${eta}]\n${enrichedDesc}`.trim()
                    }
                    const fallbackPayload = {
                        name: isPreOrder && !name.includes('[PRE-ORDER]') ? `[PRE-ORDER] ${name.trim()}` : name.trim(),
                        price: numericPrice,
                        category_id: categoryId,
                        category: categoryName || 'HAUSMADE',
                        description: enrichedDesc,
                        image_url: imageUrl.trim(),
                        is_available: isAvailable,
                        is_recommended: isHeroFeatured,
                        is_pickup_available: true
                    }
                    const fallbackRes = await supabase
                        .from('menu_items')
                        .update(fallbackPayload)
                        .eq('id', savedItemId)

                    if (fallbackRes.error) throw fallbackRes.error
                } else if (updateError) {
                    throw updateError
                }
            } else {
                // Insert New
                let { data: inserted, error: insertError } = await supabase
                    .from('menu_items')
                    .insert(payload)
                    .select()
                    .single()

                if (insertError && insertError.message && insertError.message.includes('column')) {
                    console.warn('[HausmadeProductEditorModal] DB column missing, using resilient fallback insert:', insertError.message)
                    let enrichedDesc = description.trim()
                    if (isPreOrder && !enrichedDesc.includes('[PRE-ORDER')) {
                        const eta = preOrderEta.trim() || 'จัดส่งตามรอบการผลิต (ภายใน 5-7 วันทำการ)'
                        enrichedDesc = `[PRE-ORDER รอบส่ง: ${eta}]\n${enrichedDesc}`.trim()
                    }
                    const fallbackPayload = {
                        name: isPreOrder && !name.includes('[PRE-ORDER]') ? `[PRE-ORDER] ${name.trim()}` : name.trim(),
                        price: numericPrice,
                        category_id: categoryId,
                        category: categoryName || 'HAUSMADE',
                        description: enrichedDesc,
                        image_url: imageUrl.trim(),
                        is_available: isAvailable,
                        is_recommended: isHeroFeatured,
                        is_pickup_available: true
                    }
                    const fallbackRes = await supabase
                        .from('menu_items')
                        .insert(fallbackPayload)
                        .select()
                        .single()

                    if (fallbackRes.error) throw fallbackRes.error
                    savedItemId = fallbackRes.data.id
                } else if (insertError) {
                    throw insertError
                } else {
                    savedItemId = inserted.id
                }
            }

            // Save / Sync Variants (Option Group & Option Choices)
            if (hasVariants && variants.length > 0 && savedItemId) {
                // 1. Check if option group already exists or create new
                let groupId = product?.menu_item_options?.[0]?.option_group_id

                if (!groupId) {
                    const { data: newGroup, error: groupError } = await supabase
                        .from('option_groups')
                        .insert({
                            name: variantGroupName || 'ขนาดไซส์ (Size)',
                            is_required: true,
                            selection_type: 'single',
                            min_selection: 1,
                            max_selection: 1
                        })
                        .select()
                        .single()

                    if (groupError) throw groupError
                    groupId = newGroup.id

                    // Link option group to menu item
                    await supabase
                        .from('menu_item_options')
                        .insert({
                            menu_item_id: savedItemId,
                            option_group_id: groupId,
                            display_order: 0
                        })
                } else {
                    // Update Group Name
                    await supabase
                        .from('option_groups')
                        .update({ name: variantGroupName || 'ขนาดไซส์ (Size)' })
                        .eq('id', groupId)

                    // Clear old choices using group_id
                    await supabase
                        .from('option_choices')
                        .delete()
                        .eq('group_id', groupId)
                }

                // 2. Insert new choices with correct column names (group_id, name, price_modifier, is_available, display_order)
                const choicePayloads = variants
                    .filter(v => v.name.trim())
                    .map((v, index) => ({
                        group_id: groupId,
                        name: v.name.trim(),
                        price_modifier: parseFloat(v.price_modifier) || 0,
                        is_available: v.is_available !== false,
                        display_order: index
                    }))

                if (choicePayloads.length > 0) {
                    const { error: choicesError } = await supabase
                        .from('option_choices')
                        .insert(choicePayloads)

                    if (choicesError) throw choicesError
                }
            } else if (!hasVariants && savedItemId && product?.menu_item_options?.length > 0) {
                // Remove linked option groups if variants disabled
                await supabase
                    .from('menu_item_options')
                    .delete()
                    .eq('menu_item_id', savedItemId)
            }

            toast.success(product ? 'บันทึกการแก้ไขสินค้าสำเร็จ' : 'เพิ่มสินค้าใหม่ลงหน้าร้านสำเร็จ')
            if (onSaved) onSaved()
            onClose()
        } catch (err) {
            console.error('Save product error:', err)
            toast.error('ไม่สามารถบันทึกสินค้าได้: ' + err.message)
        } finally {
            setIsSaving(false)
        }
    }

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-[oklch(18%_0.012_28)]/70 backdrop-blur-sm"
                />

                {/* Modal Window Container */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.97, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, y: 15 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                    className="relative w-full max-w-3xl bg-[oklch(97%_0.008_28)] border-2 border-[oklch(18%_0.012_28)] shadow-2xl z-10 flex flex-col max-h-[92vh] font-sans my-auto text-[oklch(18%_0.012_28)]"
                >
                    {/* Header Bar */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex-shrink-0">
                        <div>
                            <span className="font-mono text-[10px] font-bold tracking-widest text-[oklch(52%_0.16_28)] uppercase block">
                                // HAUSMADE CATALOG & INVENTORY BACKOFFICE
                            </span>
                            <h2 className="font-mono text-sm font-bold uppercase tracking-tight text-[oklch(18%_0.012_28)]">
                                [ {product ? 'EDIT PRODUCT // แก้ไขข้อมูลสินค้า' : 'CREATE PRODUCT // เพิ่มสินค้าใหม่'} ]
                            </h2>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="font-mono text-xs font-bold text-[oklch(18%_0.012_28)] hover:text-[oklch(52%_0.16_28)] transition-colors px-2 py-1 border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] cursor-pointer"
                        >
                            [ ESC / ปิด ]
                        </button>
                    </div>

                    {/* Form Body (Scrollable) */}
                    <form onSubmit={handleSave} className="p-6 overflow-y-auto flex-grow flex flex-col gap-6 font-mono text-xs">

                        {/* SECTION 1: PHOTO UPLOAD & PREVIEW */}
                        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] p-4 flex flex-col sm:flex-row gap-4 items-start">
                            <div className="w-full sm:w-36 h-36 bg-white border border-[oklch(85%_0.012_28)] flex-shrink-0 relative overflow-hidden flex items-center justify-center">
                                {imageUrl ? (
                                    <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-[10px] text-[oklch(55%_0.010_28)] text-center px-2">
                                        [ ยังไม่มีรูปภาพ ]
                                    </span>
                                )}
                                {uploadProgress && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-[10px] font-bold">
                                        กำลังอัปโหลด...
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 flex flex-col justify-between gap-3 w-full">
                                <div>
                                    <span className="text-[11px] font-bold uppercase text-[oklch(18%_0.012_28)] block">
                                        [ รูปภาพสินค้า (PRODUCT PHOTO) ]
                                    </span>
                                    <p className="text-[10px] text-[oklch(55%_0.010_28)] font-sans mt-0.5 leading-relaxed">
                                        รองรับ JPG, PNG, WEBP ระบบจะย่อขนาดและแปลงความละเอียดให้พอดีสำหรับการแสดงผล Retina โดยอัตโนมัติ
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                        accept="image/*"
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="px-3 py-1.5 bg-[oklch(18%_0.012_28)] text-white font-bold text-[11px] uppercase hover:bg-black transition-colors cursor-pointer"
                                    >
                                        [ 📸 เลือกไฟล์รูปภาพ ]
                                    </button>
                                    {imageUrl && (
                                        <button
                                            type="button"
                                            onClick={() => setImageUrl('')}
                                            className="px-3 py-1.5 border border-red-300 text-red-600 bg-white text-[10px] uppercase hover:bg-red-50 transition-colors"
                                        >
                                            [ ลบรูปภาพ ]
                                        </button>
                                    )}
                                </div>

                                <input
                                    type="text"
                                    value={imageUrl}
                                    onChange={(e) => setImageUrl(e.target.value)}
                                    placeholder="หรือวาง URL รูปภาพตรงนี้: https://..."
                                    className="w-full px-2.5 py-1.5 bg-white border border-[oklch(85%_0.012_28)] text-[10px] focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                                />
                            </div>
                        </div>

                        {/* SECTION 2: BASIC PRODUCT INFORMATION */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2 flex flex-col gap-1">
                                <label className="font-bold text-[11px] uppercase text-[oklch(18%_0.012_28)]">
                                    ชื่อสินค้า (Product Name) *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="เช่น HAUSMADE Heavyweight T-Shirt (Terracotta Edition)"
                                    className="px-3 py-2 bg-white border border-[oklch(85%_0.012_28)] font-sans text-sm focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="font-bold text-[11px] uppercase text-[oklch(18%_0.012_28)]">
                                    ราคาจำหน่าย (Price THB ฿) *
                                </label>
                                <input
                                    type="number"
                                    step="1"
                                    min="0"
                                    required
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    placeholder="590"
                                    className="px-3 py-2 bg-white border border-[oklch(85%_0.012_28)] text-sm font-bold text-[oklch(52%_0.16_28)] focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="font-bold text-[11px] uppercase text-[oklch(18%_0.012_28)]">
                                    หมวดหมู่คอลเลกชัน (Collection Tag)
                                </label>
                                <select
                                    value={subCategory}
                                    onChange={(e) => setSubCategory(e.target.value)}
                                    className="px-3 py-2 bg-white border border-[oklch(85%_0.012_28)] text-xs focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                                >
                                    {CATEGORY_PRESETS.map(c => (
                                        <option key={c.key} value={c.key}>{c.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="sm:col-span-2 flex flex-col gap-1">
                                <label className="font-bold text-[11px] uppercase text-[oklch(18%_0.012_28)]">
                                    คำอธิบายสินค้า & สตอรี่ (Rich Description)
                                </label>
                                <textarea
                                    rows={4}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="เขียนอธิบายเนื้อผ้า, สัดส่วน, ฟิลลิ่ง, กลิ่นรสเมล็ดกาแฟ, วิธีการดูแลรักษา..."
                                    className="px-3 py-2 bg-white border border-[oklch(85%_0.012_28)] font-sans text-xs focus:outline-none focus:border-[oklch(52%_0.16_28)] leading-relaxed"
                                />
                            </div>
                        </div>

                        {/* SECTION 3: PRE-ORDER SETTINGS */}
                        <div className={`p-4 border transition-all ${
                            isPreOrder
                                ? 'bg-[oklch(45%_0.08_140)]/10 border-[oklch(45%_0.08_140)]'
                                : 'bg-[oklch(94%_0.010_28)] border-[oklch(85%_0.012_28)]'
                        }`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="font-bold text-xs uppercase block text-[oklch(18%_0.012_28)]">
                                        [ โหมดสินค้าสั่งจองล่วงหน้า (PRE-ORDER) ]
                                    </span>
                                    <span className="text-[10px] text-[oklch(55%_0.010_28)] font-sans">
                                        เปิดรับออเดอร์ก่อนผลิตจริง พร้อมระบุรอบจัดส่งให้ลูกค้าทราบอย่างโปร่งใส
                                    </span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isPreOrder}
                                        onChange={(e) => setIsPreOrder(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[oklch(45%_0.08_140)]"></div>
                                </label>
                            </div>

                            {isPreOrder && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="mt-3 pt-3 border-t border-[oklch(45%_0.08_140)]/40 flex flex-col gap-2"
                                >
                                    <label className="font-bold text-[11px] uppercase text-[oklch(45%_0.08_140)]">
                                        ⏳ กำหนดการรอบจัดส่งพัสดุ (Dispatch ETA) *
                                    </label>
                                    <input
                                        type="text"
                                        value={preOrderEta}
                                        onChange={(e) => setPreOrderEta(e.target.value)}
                                        placeholder="เช่น รอบผลิตวันที่ 15 กันยายน 2569 / จัดส่งภายใน 7 วันทำการ"
                                        className="px-3 py-2 bg-white border border-[oklch(45%_0.08_140)] text-xs focus:outline-none focus:ring-1 focus:ring-[oklch(45%_0.08_140)]"
                                    />
                                    <div className="flex gap-2 flex-wrap text-[10px]">
                                        <button
                                            type="button"
                                            onClick={() => setPreOrderEta('รอบผลิตพร้อมจัดส่ง: 15 กันยายน 2569')}
                                            className="px-2 py-0.5 bg-white border border-[oklch(45%_0.08_140)] hover:bg-[oklch(45%_0.08_140)] hover:text-white transition-colors"
                                        >
                                            + รอบ 15 ก.ย. 69
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPreOrderEta('จัดส่งตามรอบการผลิต (ภายใน 7-10 วันทำการ)')}
                                            className="px-2 py-0.5 bg-white border border-[oklch(45%_0.08_140)] hover:bg-[oklch(45%_0.08_140)] hover:text-white transition-colors"
                                        >
                                            + ภายใน 7-10 วัน
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </div>

                        {/* SECTION 4: T-SHIRT SIZES & VARIANTS MATRIX */}
                        <div className="border border-[oklch(85%_0.012_28)] bg-white p-4 flex flex-col gap-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[oklch(85%_0.012_28)] pb-3">
                                <div>
                                    <span className="font-bold text-xs uppercase text-[oklch(18%_0.012_28)] block">
                                        [ ตัวเลือกสินค้า & สต็อกแยกไซส์ (VARIANTS MATRIX) ]
                                    </span>
                                    <span className="text-[10px] text-[oklch(55%_0.010_28)] font-sans">
                                        จัดการไซส์เสื้อ (S - 4XL), ระดับการบด, หรือตัวเลือกสินค้าพร้อมสต็อกรายชิ้น
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleApplyTshirtSizePreset}
                                        className="px-3 py-1.5 bg-[oklch(52%_0.16_28)] text-white font-bold text-[10px] uppercase hover:opacity-90 transition-opacity cursor-pointer"
                                    >
                                        [ 👕 + ใช้ไซส์เสื้อมาตรฐาน S-4XL ]
                                    </button>
                                </div>
                            </div>

                            {/* Variant Group Name */}
                            {hasVariants && (
                                <div className="flex items-center gap-3">
                                    <label className="text-[11px] font-bold uppercase text-[oklch(55%_0.010_28)]">
                                        ชื่อกลุ่มตัวเลือก:
                                    </label>
                                    <input
                                        type="text"
                                        value={variantGroupName}
                                        onChange={(e) => setVariantGroupName(e.target.value)}
                                        placeholder="เช่น ขนาดไซส์ (Size)"
                                        className="px-2.5 py-1 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] text-xs font-bold text-[oklch(18%_0.012_28)]"
                                    />
                                </div>
                            )}

                            {/* Variants List Table */}
                            {hasVariants && variants.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left font-mono text-[11px] border-collapse">
                                        <thead>
                                            <tr className="border-b border-[oklch(85%_0.012_28)] text-[oklch(55%_0.010_28)] text-[10px]">
                                                <th className="py-2">ตัวเลือก / ไซส์</th>
                                                <th className="py-2 w-28">ราคาบวกเพิ่ม (฿)</th>
                                                <th className="py-2 w-24">สต็อก (ชิ้น)</th>
                                                <th className="py-2 w-20 text-center">สถานะ</th>
                                                <th className="py-2 w-12 text-center">ลบ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {variants.map((v, idx) => (
                                                <tr key={idx} className="border-b border-[oklch(85%_0.012_28)]/40 hover:bg-[oklch(97%_0.008_28)]">
                                                    <td className="py-1.5 pr-2">
                                                        <input
                                                            type="text"
                                                            value={v.name}
                                                            onChange={(e) => handleUpdateVariant(idx, 'name', e.target.value)}
                                                            placeholder="เช่น S (อก 37.0 นิ้ว)"
                                                            className="w-full px-2 py-1 bg-white border border-[oklch(85%_0.012_28)] font-sans text-xs"
                                                        />
                                                    </td>
                                                    <td className="py-1.5 pr-2">
                                                        <input
                                                            type="number"
                                                            value={v.price_modifier}
                                                            onChange={(e) => handleUpdateVariant(idx, 'price_modifier', e.target.value)}
                                                            placeholder="0"
                                                            className="w-full px-2 py-1 bg-white border border-[oklch(85%_0.012_28)] text-xs text-right"
                                                        />
                                                    </td>
                                                    <td className="py-1.5 pr-2">
                                                        <input
                                                            type="number"
                                                            value={v.stock}
                                                            onChange={(e) => handleUpdateVariant(idx, 'stock', e.target.value)}
                                                            placeholder="99"
                                                            className="w-full px-2 py-1 bg-white border border-[oklch(85%_0.012_28)] text-xs text-right font-bold text-[oklch(52%_0.16_28)]"
                                                        />
                                                    </td>
                                                    <td className="py-1.5 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUpdateVariant(idx, 'is_available', !v.is_available)}
                                                            className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-xs ${
                                                                v.is_available
                                                                    ? 'bg-[oklch(45%_0.08_140)]/20 text-[oklch(45%_0.08_140)]'
                                                                    : 'bg-red-100 text-red-600'
                                                            }`}
                                                        >
                                                            {v.is_available ? 'เปิดขาย' : 'ปิด'}
                                                        </button>
                                                    </td>
                                                    <td className="py-1.5 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveVariant(idx)}
                                                            className="text-red-500 hover:text-red-700 p-1"
                                                        >
                                                            ✕
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="py-6 text-center text-[11px] text-[oklch(55%_0.010_28)] border border-dashed border-[oklch(85%_0.012_28)]">
                                    [ ยังไม่มีตัวเลือกย่อย — สินค้านี้มีราคาและสต็อกเดียว ]
                                </div>
                            )}

                            <div className="flex items-center gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={handleAddVariantRow}
                                    className="px-3 py-1 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] text-[10px] font-bold uppercase hover:bg-[oklch(97%_0.008_28)]"
                                >
                                    + เพิ่มตัวเลือกแบบกำหนดเอง
                                </button>
                                {hasVariants && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setHasVariants(false)
                                            setVariants([])
                                        }}
                                        className="text-[10px] text-red-600 underline ml-auto"
                                    >
                                        ยกเลิกตัวเลือกทั้งหมด
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* SECTION 5: MARKETING & HERO CAROUSEL SETTINGS */}
                        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] p-4 flex flex-col gap-3">
                            <span className="font-bold text-xs uppercase text-[oklch(18%_0.012_28)] block">
                                [ การแสดงผล & HERO BANNER ]
                            </span>

                            <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)]/60 pb-3">
                                <div>
                                    <span className="font-bold text-[11px] uppercase block">
                                        ⭐ ปักหมุดบน Hero Banner หน้าร้าน
                                    </span>
                                    <span className="text-[10px] text-[oklch(55%_0.010_28)] font-sans">
                                        แสดงรูปและชื่อสินค้าเป็นสไลด์เด่นหน้าแรกของร้าน HAUSMADE
                                    </span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isHeroFeatured}
                                        onChange={(e) => setIsHeroFeatured(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[oklch(52%_0.16_28)]"></div>
                                </label>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="font-bold text-[11px] uppercase block">
                                        📦 สถานะเปิดจำหน่าย (Available for Sale)
                                    </span>
                                    <span className="text-[10px] text-[oklch(55%_0.010_28)] font-sans">
                                        เปิด/ปิดการมองเห็นและการสั่งซื้อบนหน้าร้าน
                                    </span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isAvailable}
                                        onChange={(e) => setIsAvailable(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[oklch(18%_0.012_28)]"></div>
                                </label>
                            </div>
                        </div>

                    </form>

                    {/* Footer Actions */}
                    <div className="p-4 bg-[oklch(94%_0.010_28)] border-t border-[oklch(85%_0.012_28)] flex items-center justify-between font-mono text-xs flex-shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-[oklch(85%_0.012_28)] text-[oklch(42%_0.010_28)] uppercase hover:bg-white transition-colors"
                        >
                            [ ยกเลิก / CANCEL ]
                        </button>

                        <button
                            type="button"
                            disabled={isSaving}
                            onClick={handleSave}
                            className="px-6 py-2 bg-[oklch(52%_0.16_28)] text-white font-bold uppercase tracking-wider hover:bg-[oklch(45%_0.16_28)] shadow-md transition-all cursor-pointer flex items-center gap-2"
                        >
                            {isSaving ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>กำลังบันทึก...</span>
                                </>
                            ) : (
                                <span>[ 💾 บันทึกข้อมูลสินค้า // SAVE PRODUCT ]</span>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
