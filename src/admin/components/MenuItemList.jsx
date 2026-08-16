/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabaseClient'
import { Plus, Edit2, Trash2, X, Image as ImageIcon, Check, AlertCircle, Camera, ShoppingBag, GripVertical, Search, Copy, CheckCircle2, XCircle, ChevronDown, Layers, Percent } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { DndContext, closestCorners, MouseSensor, TouchSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import { arrayMove, SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'

// --- Sortable Item Card Component ---
const SortableMenuItem = React.memo(function SortableMenuItem({ 
    item, 
    handleEdit, 
    handleDelete, 
    handleDuplicate,
    handleToggleStock,
    handleTogglePickup, 
    isOverlay = false 
}) {
    const isRecommended = item.is_recommended
    const isOutOfStock = item.is_available === false

    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef, 
        transform,
        transition,
        isDragging
    } = useSortable({ 
        id: item.id,
        disabled: false, 
        data: { 
            category_id: item.category_id, 
            category: item.category,
            is_recommended: isRecommended
        }
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition, 
        zIndex: isDragging ? 50 : "auto",
        opacity: isDragging ? 0.3 : 1
    }

    // Overlay Render (Dragging Preview)
    if (isOverlay) {
        return (
            <div className="bg-white border-2 border-[oklch(52%_0.16_28)] rounded-sm p-3 flex gap-3 shadow-2xl cursor-grabbing select-none z-50 scale-105 w-[320px] md:w-[340px]">
                <div className="w-16 h-16 bg-[oklch(94%_0.010_28)] rounded-sm overflow-hidden shrink-0 border border-[oklch(85%_0.012_28)]">
                    {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-[oklch(55%_0.010_28)]"><ImageIcon size={18} /></div>
                    )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h4 className="font-bold truncate text-sm text-[oklch(18%_0.012_28)]">{item.name}</h4>
                    <div className="text-[oklch(52%_0.16_28)] font-mono font-bold text-sm mt-0.5">฿{item.price}</div>
                </div>
            </div>
        )
    }

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            className={`bg-white border rounded-sm p-3 flex justify-between gap-3 items-stretch relative select-none group transition-all shadow-xs ${
                isOutOfStock 
                    ? 'border-gray-200 bg-gray-50/70 opacity-75' 
                    : isRecommended 
                        ? 'border-[oklch(85%_0.012_28)] hover:border-[oklch(52%_0.16_28)]' 
                        : 'border-[oklch(85%_0.012_28)] hover:border-[oklch(52%_0.16_28)]'
            }`}
            onClick={(e) => {
                if (!isDragging) handleEdit(item)
            }}
        >
            {/* Left Image & Details */}
            <div className="flex-1 min-w-0 flex gap-3 pointer-events-none">
                {/* Image */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[oklch(94%_0.010_28)] rounded-sm overflow-hidden shrink-0 relative border border-[oklch(85%_0.012_28)]">
                    {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-[oklch(55%_0.010_28)]">
                            <ImageIcon size={20} />
                        </div>
                    )}
                    {isOutOfStock && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider bg-red-600 px-1 py-0.5 rounded-xs">
                                หมด
                            </span>
                        </div>
                    )}
                </div>
                
                {/* Text details */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-bold truncate text-sm sm:text-base text-[oklch(18%_0.012_28)]" title={item.name}>
                                {item.name}
                            </h4>
                            {isRecommended && (
                                <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-amber-50 text-amber-900 border border-amber-300 px-1 py-0.2 rounded-xs">
                                    ★ REC
                                </span>
                            )}
                        </div>
                        <div className="font-mono font-bold text-[oklch(52%_0.16_28)] text-sm mt-0.5">
                            ฿{item.price}
                        </div>
                        <div className="text-xs text-[oklch(55%_0.010_28)] line-clamp-1 mt-0.5 font-sans" title={item.description}>
                            {item.description || 'ไม่มีคำอธิบาย'}
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[9px] font-mono text-[oklch(42%_0.010_28)] bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] px-1.5 py-0.5 rounded-xs">
                            {item.menu_categories?.name || item.category || 'ทั่วไป'}
                        </span>
                        {item.is_drink_stamp_eligible && (
                            <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-amber-50 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded-xs">
                                10 FREE 1
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Action Column */}
            <div className="flex flex-col justify-between items-end shrink-0 pl-2.5 border-l border-[oklch(85%_0.012_28)]">
                {/* Top Action Icons */}
                <div 
                    className="flex items-center gap-1"
                    onPointerDown={(e) => e.stopPropagation()} 
                    onClick={(e) => e.stopPropagation()}
                >
                    <button 
                        onClick={(e) => {
                            e.stopPropagation()
                            handleDuplicate(item)
                        }} 
                        className="p-1.5 text-[oklch(55%_0.010_28)] hover:text-black hover:bg-[oklch(94%_0.010_28)] rounded-sm transition-colors cursor-pointer"
                        title="คัดลอกเมนูนี้"
                    >
                        <Copy size={14} />
                    </button>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation()
                            handleEdit(item)
                        }} 
                        className="p-1.5 text-[oklch(55%_0.010_28)] hover:text-black hover:bg-[oklch(94%_0.010_28)] rounded-sm transition-colors cursor-pointer"
                        title="แก้ไขเมนู"
                    >
                        <Edit2 size={14} />
                    </button>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(item.id)
                        }} 
                        className="p-1.5 text-[oklch(55%_0.010_28)] hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors cursor-pointer"
                        title="ลบเมนู"
                    >
                        <Trash2 size={14} />
                    </button>

                    {/* Drag Handle */}
                    <div 
                        ref={setActivatorNodeRef}
                        {...attributes}
                        {...listeners}
                        className="p-1 text-[oklch(55%_0.010_28)] hover:text-black cursor-grab active:cursor-grabbing hover:bg-[oklch(94%_0.010_28)] rounded-sm transition-colors flex items-center justify-center touch-none"
                        style={{ width: '24px', height: '24px', touchAction: 'none' }}
                        title="ลากเพื่อเรียงลำดับ"
                    >
                        <GripVertical size={15} />
                    </div>
                </div>

                {/* Bottom Quick Toggles */}
                <div 
                    className="flex items-center gap-2"
                    onPointerDown={(e) => e.stopPropagation()} 
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Quick Stock Toggle */}
                    <button
                        onClick={(e) => handleToggleStock(e, item)}
                        className={`px-1.5 py-0.5 rounded-xs text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                            item.is_available !== false 
                                ? 'bg-green-50 text-green-800 border-green-300 hover:bg-green-100' 
                                : 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
                        }`}
                        title={item.is_available !== false ? 'คลิกเพื่อเปลี่ยนเป็นของหมด' : 'คลิกเพื่อเปิดขาย'}
                    >
                        {item.is_available !== false ? '● มีของ' : '○ หมด'}
                    </button>

                    {/* Quick Pickup Toggle */}
                    <button
                        onClick={(e) => handleTogglePickup(e, item)}
                        className={`px-1.5 py-0.5 rounded-xs text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                            item.is_pickup_available !== false 
                                ? 'bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] border-[oklch(85%_0.012_28)]' 
                                : 'bg-gray-100 text-gray-400 border-gray-200'
                        }`}
                        title="สิทธิ์สั่ง Pick-up ล่วงหน้า"
                    >
                        {item.is_pickup_available !== false ? 'Pick-up' : 'No-Pick'}
                    </button>
                </div>
            </div>
        </div>
    )
})

// --- Main MenuItemList Component ---
export default function MenuItemList() {
    const [menuItems, setMenuItems] = useState([])
    const [categories, setCategories] = useState([])
    const [optionGroups, setOptionGroups] = useState([])

    const [loading, setLoading] = useState(true)
    const [isSavingOrder, setIsSavingOrder] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState(null)
    const [imageFile, setImageFile] = useState(null)
    const [previewUrl, setPreviewUrl] = useState(null)
    const [imageRemoved, setImageRemoved] = useState(false)

    // Form Data
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        category_id: '',
        description: '',
        is_available: true,
        is_recommended: false,
        is_pickup_available: true,
        is_drink_stamp_eligible: false,
        material_cost: 0 
    })

    const [selectedOptionGroups, setSelectedOptionGroups] = useState([])
    const [isOptionPickerOpen, setIsOptionPickerOpen] = useState(false)
    const [optionPickerSearch, setOptionPickerSearch] = useState('')

    // Filters and Search State
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategoryTab, setSelectedCategoryTab] = useState('all') // 'all', 'recommended', or category_id
    const [statusFilter, setStatusFilter] = useState('all') // 'all', 'in_stock', 'out_of_stock', 'pickup', 'stamp'

    const [activeDragItem, setActiveDragItem] = useState(null) 

    // Sensors for Dnd-Kit
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
    )

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            const [menuRes, catRes, optRes] = await Promise.all([
                supabase
                    .from('menu_items')
                    .select(`*, menu_categories (id, name, display_order, is_drink_stamp_eligible)`)
                    .order('sort_order', { ascending: true }),
                supabase.from('menu_categories').select('*').order('display_order', { ascending: true }),
                supabase.from('option_groups').select('*, option_choices(*)').order('name')
            ])

            if (menuRes.error) throw menuRes.error
            if (catRes.error) throw catRes.error
            if (optRes.error) throw optRes.error

            setMenuItems(menuRes.data || [])
            setCategories(catRes.data || [])
            setOptionGroups(optRes.data || [])
        } catch (err) {
            console.error('Fetch data error:', err)
            toast.error('ไม่สามารถโหลดข้อมูลเมนูได้')
        } finally {
            setLoading(false)
        }
    }

    // Filtered Menu Items
    const filteredMenuItems = useMemo(() => {
        return menuItems.filter(item => {
            // Category Tab Filter
            if (selectedCategoryTab === 'recommended') {
                if (!item.is_recommended) return false
            } else if (selectedCategoryTab !== 'all') {
                if (item.category_id !== selectedCategoryTab && item.category !== selectedCategoryTab) return false
            }

            // Status Filter
            if (statusFilter === 'in_stock' && item.is_available === false) return false
            if (statusFilter === 'out_of_stock' && item.is_available !== false) return false
            if (statusFilter === 'pickup' && item.is_pickup_available === false) return false
            if (statusFilter === 'stamp' && !item.is_drink_stamp_eligible) return false

            // Search Query Filter
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase().trim()
                const nameMatch = (item.name || '').toLowerCase().includes(query)
                const descMatch = (item.description || '').toLowerCase().includes(query)
                const catMatch = (item.menu_categories?.name || item.category || '').toLowerCase().includes(query)
                if (!nameMatch && !descMatch && !catMatch) return false
            }

            return true
        })
    }, [menuItems, selectedCategoryTab, statusFilter, searchQuery])

    // --- Create / Edit Handlers ---
    const handleCreate = () => {
        setEditingItem(null)
        setSelectedOptionGroups([])
        setImageFile(null)
        setPreviewUrl(null)
        setImageRemoved(false)
        setIsOptionPickerOpen(false)
        
        const defaultCat = categories[0]
        setFormData({
            name: '',
            price: '',
            category_id: defaultCat?.id || '',
            description: '',
            is_available: true,
            is_recommended: false,
            is_pickup_available: true,
            is_drink_stamp_eligible: defaultCat?.is_drink_stamp_eligible === true,
            material_cost: 0
        })
        setIsModalOpen(true)
    }

    const handleEdit = async (item) => {
        setEditingItem(item)
        setImageFile(null)
        setPreviewUrl(item.image_url || null)
        setImageRemoved(false)
        setIsOptionPickerOpen(false)

        setFormData({
            name: item.name || '',
            price: item.price !== undefined ? item.price : '',
            category_id: item.category_id || categories.find(c => c.name === item.category)?.id || '',
            description: item.description || '',
            is_available: item.is_available !== false,
            is_recommended: item.is_recommended === true,
            is_pickup_available: item.is_pickup_available !== false,
            is_drink_stamp_eligible: item.is_drink_stamp_eligible === true,
            material_cost: 0
        })

        // Fetch Material Cost from Recipe with correct foreign key link
        try {
            const { data: recipeIng } = await supabase
                .from('recipe_ingredients')
                .select(`
                    quantity,
                    unit,
                    ingredient:stock_items!recipe_ingredients_ingredient_id_fkey (
                        cost_price, pack_size, pack_unit, usage_unit, conversion_factor, yield_percent
                    )
                `)
                .eq('parent_menu_item_id', item.id)

            let calculatedMatCost = 0
            if (recipeIng && recipeIng.length > 0) {
                calculatedMatCost = recipeIng.reduce((sum, ri) => {
                    if (!ri.ingredient) return sum
                    const price = ri.ingredient.cost_price || 0
                    const packSize = ri.ingredient.pack_size || 1
                    const totalUnits = packSize * (ri.ingredient.conversion_factor || 1) * ((ri.ingredient.yield_percent || 100) / 100)
                    const unitCost = totalUnits > 0 ? price / totalUnits : 0
                    return sum + (unitCost * (ri.quantity || 0))
                }, 0)
            }
            setFormData(prev => ({ ...prev, material_cost: calculatedMatCost }))
        } catch (err) {
            console.warn('Cost fetch error:', err)
        }

        // Fetch Linked Option Groups
        try {
            const { data: options } = await supabase
                .from('menu_item_options')
                .select('option_group_id, display_order')
                .eq('menu_item_id', item.id)
                .order('display_order')

            const linkedGroups = options?.map(o => o.option_group_id) || []
            setSelectedOptionGroups(linkedGroups)
        } catch (err) {
            console.error('Fetch linked options error:', err)
        }

        setIsModalOpen(true)
    }

    const handleCategoryChangeInForm = (catId) => {
        const cat = categories.find(c => c.id === catId)
        setFormData(prev => ({
            ...prev,
            category_id: catId,
            // If category has automatic drink stamp eligibility, inherit it if creating or editing
            is_drink_stamp_eligible: cat ? cat.is_drink_stamp_eligible === true : prev.is_drink_stamp_eligible
        }))
    }

    // --- Fast Inline Toggles ---
    const handleToggleStock = async (e, item) => {
        if (e && e.stopPropagation) e.stopPropagation()
        const newValue = item.is_available === false ? true : false

        // Optimistic update
        setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, is_available: newValue } : i))

        try {
            const { error } = await supabase.from('menu_items').update({ is_available: newValue }).eq('id', item.id)
            if (error) throw error
            toast.success(`${item.name}: ${newValue ? 'เปิดขายแล้ว (มีสต็อก)' : 'ตั้งสถานะของหมดแล้ว'}`, { duration: 1500 })
        } catch (err) {
            console.error('Toggle stock error:', err)
            // Rollback
            setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, is_available: !newValue } : i))
            toast.error('อัปเดตสถานะไม่สำเร็จ')
        }
    }

    const handleTogglePickup = async (e, item) => {
        if (e && e.stopPropagation) e.stopPropagation()
        const newValue = item.is_pickup_available === false ? true : false

        // Optimistic update
        setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, is_pickup_available: newValue } : i))

        try {
            const { error } = await supabase.from('menu_items').update({ is_pickup_available: newValue }).eq('id', item.id)
            if (error) throw error
            toast.success(`${item.name}: ${newValue ? 'เปิดรับ Pick-up' : 'ปิดรับ Pick-up'}`, { duration: 1500 })
        } catch (err) {
            console.error('Toggle pickup error:', err)
            // Rollback
            setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, is_pickup_available: !newValue } : i))
            toast.error('อัปเดต Pick-up ไม่สำเร็จ')
        }
    }

    const handleDuplicate = async (item) => {
        if (!confirm(`คุณต้องการคัดลอกเมนู "${item.name}" ใช่หรือไม่?`)) return
        
        try {
            const newName = `${item.name} (คัดลอก)`
            const maxSort = menuItems.length > 0 ? Math.max(...menuItems.map(i => i.sort_order || 0)) : 0

            const selectedCat = categories.find(c => c.id === item.category_id)
            const selectedCatName = selectedCat ? selectedCat.name : (item.category || 'Uncategorized')

            const payload = {
                name: newName,
                price: item.price,
                category_id: item.category_id || null,
                category: selectedCatName,
                description: item.description || '',
                is_available: item.is_available !== false,
                is_recommended: item.is_recommended === true,
                is_pickup_available: item.is_pickup_available !== false,
                is_drink_stamp_eligible: item.is_drink_stamp_eligible === true,
                image_url: item.image_url || '',
                sort_order: maxSort + 1
            }

            const { data: newInserted, error: insertError } = await supabase
                .from('menu_items')
                .insert(payload)
                .select(`*, menu_categories (id, name, display_order, is_drink_stamp_eligible)`)
                .single()

            if (insertError) throw insertError

            // Duplicate linked option groups
            if (newInserted && newInserted.id) {
                const { data: options } = await supabase
                    .from('menu_item_options')
                    .select('option_group_id, display_order')
                    .eq('menu_item_id', item.id)

                if (options && options.length > 0) {
                    const links = options.map(opt => ({
                        menu_item_id: newInserted.id,
                        option_group_id: opt.option_group_id,
                        display_order: opt.display_order
                    }))
                    await supabase.from('menu_item_options').insert(links)
                }
            }

            setMenuItems(prev => [...prev, newInserted])
            toast.success(`คัดลอกเมนู "${newName}" เรียบร้อย`)
        } catch (err) {
            console.error('Duplicate error:', err)
            toast.error('คัดลอกเมนูไม่สำเร็จ: ' + err.message)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('คุณต้องการลบเมนูนี้ใช่หรือไม่? (การลบจะไม่สามารถกู้คืนได้)')) return
        try {
            const { error } = await supabase.from('menu_items').delete().eq('id', id)
            if (error) {
                if (error.code === '23503') {
                    if (!confirm('เมนูนี้มีประวัติการสั่งซื้ออยู่ ไม่สามารถลบออกจากฐานข้อมูลได้โดยตรง\nระบบจะทำการย้ายไปหมวดหมู่ "Archived" และซ่อนเมนูนี้แทน ต้องการดำเนินการต่อหรือไม่?')) return
                    
                    const { error: archiveError } = await supabase.from('menu_items').update({
                        category: 'Archived',
                        category_id: null,
                        is_available: false,
                        is_pickup_available: false,
                        is_recommended: false
                    }).eq('id', id)

                    if (archiveError) throw archiveError
                    setMenuItems(prev => prev.filter(i => i.id !== id))
                    setIsModalOpen(false)
                    toast.success('ย้ายเมนูไปที่ Archived เรียบร้อย')
                    return
                }
                throw error
            }
            
            setMenuItems(prev => prev.filter(i => i.id !== id))
            setIsModalOpen(false)
            toast.success('ลบเมนูเรียบร้อย')
        } catch (err) {
            console.error('Delete error:', err)
            toast.error('ไม่สามารถลบเมนูได้: ' + err.message)
        }
    }

    // --- Image Resize Helper ---
    const resizeImage = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader()
            reader.readAsDataURL(file)
            reader.onload = (event) => {
                const img = new Image()
                img.src = event.target.result
                img.onload = () => {
                    const canvas = document.createElement('canvas')
                    const MAX_WIDTH = 800
                    const MAX_HEIGHT = 800
                    let width = img.width
                    let height = img.height

                    if (width > height) {
                        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                    } else {
                        if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                    }

                    canvas.width = width
                    canvas.height = height
                    const ctx = canvas.getContext('2d')
                    ctx.drawImage(img, 0, 0, width, height)

                    let type = 'image/webp'
                    let ext = '.webp'
                    try {
                        const testData = canvas.toDataURL('image/webp')
                        if (!testData.startsWith('data:image/webp')) {
                            type = 'image/jpeg'
                            ext = '.jpg'
                        }
                    } catch (err) {
                        type = 'image/jpeg'
                        ext = '.jpg'
                    }

                    canvas.toBlob((blob) => {
                        resolve(new File([blob], file.name.replace(/\.[^/.]+$/, ext), { type, lastModified: Date.now() }))
                    }, type, 0.8)
                }
            }
        })
    }

    const handleImageChange = async (e) => {
        const file = e.target.files[0]
        if (file) {
            try {
                const resizedFile = await resizeImage(file)
                setImageFile(resizedFile)
                setPreviewUrl(URL.createObjectURL(resizedFile))
                setImageRemoved(false)
            } catch (err) {
                setImageFile(file)
                setPreviewUrl(URL.createObjectURL(file))
            }
        }
    }

    const handleRemoveImage = (e) => {
        e.stopPropagation()
        setImageFile(null)
        setPreviewUrl(null)
        setImageRemoved(true)
    }

    // --- Save Menu Item Handler ---
    const handleSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault()
        const trimmedName = (formData.name || '').trim()
        if (!trimmedName) {
            toast.error('กรุณาระบุชื่อเมนู')
            return
        }

        const priceNum = parseFloat(formData.price)
        if (isNaN(priceNum) || priceNum < 0) {
            toast.error('กรุณาระบุราคาที่ถูกต้อง')
            return
        }

        try {
            let imageUrl = previewUrl

            // 1. Upload new image if present
            if (imageFile) {
                const fileExt = imageFile.name.split('.').pop()
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`
                const filePath = `menu-items/${fileName}`

                const { error: uploadError } = await supabase.storage
                    .from('public-assets')
                    .upload(filePath, imageFile, { upsert: true, cacheControl: '15552000' })

                if (uploadError) throw uploadError

                const { data: publicUrlData } = supabase.storage
                    .from('public-assets')
                    .getPublicUrl(filePath)

                imageUrl = publicUrlData.publicUrl
            } else if (imageRemoved) {
                imageUrl = ''
            }

            const selectedCat = categories.find(c => c.id === formData.category_id)
            const selectedCatName = selectedCat ? selectedCat.name : 'Uncategorized'

            const payload = {
                name: trimmedName,
                price: priceNum,
                category_id: formData.category_id || null,
                category: selectedCatName,
                description: formData.description || '',
                is_available: formData.is_available,
                is_recommended: formData.is_recommended,
                is_pickup_available: formData.is_pickup_available,
                is_drink_stamp_eligible: formData.is_drink_stamp_eligible,
                image_url: imageUrl || ''
            }

            let savedItemId = editingItem?.id

            if (editingItem) {
                const { error } = await supabase.from('menu_items').update(payload).eq('id', savedItemId)
                if (error) throw error
            } else {
                const maxSort = menuItems.length > 0 ? Math.max(...menuItems.map(i => i.sort_order || 0)) : 0
                payload.sort_order = maxSort + 1

                const { data: inserted, error } = await supabase.from('menu_items').insert(payload).select().single()
                if (error) throw error
                savedItemId = inserted.id
            }

            // 2. Sync Option Groups
            if (savedItemId) {
                await supabase.from('menu_item_options').delete().eq('menu_item_id', savedItemId)

                if (selectedOptionGroups.length > 0) {
                    const links = selectedOptionGroups.map((groupId, idx) => ({
                        menu_item_id: savedItemId,
                        option_group_id: groupId,
                        display_order: idx
                    }))
                    const { error: linkError } = await supabase.from('menu_item_options').insert(links)
                    if (linkError) throw linkError
                }
            }

            toast.success(editingItem ? 'อัปเดตเมนูสำเร็จ' : 'สร้างเมนูใหม่สำเร็จ')
            setIsModalOpen(false)
            fetchData()
        } catch (err) {
            console.error('Save menu item error:', err)
            toast.error('บันทึกไม่สำเร็จ: ' + err.message)
        }
    }

    // --- Drag & Drop Reordering ---
    const handleDragStart = (event) => {
        const { active } = event
        const item = menuItems.find(i => i.id === active.id)
        setActiveDragItem(item || null)
    }

    const handleDragEnd = async (event) => {
        const { active, over } = event
        setActiveDragItem(null)

        if (!over || active.id === over.id) return

        const oldIndex = menuItems.findIndex(i => i.id === active.id)
        const newIndex = menuItems.findIndex(i => i.id === over.id)

        if (oldIndex === -1 || newIndex === -1) return

        const reordered = arrayMove(menuItems, oldIndex, newIndex)
        setMenuItems(reordered)

        // Batch update sort_order to DB
        setIsSavingOrder(true)
        try {
            const updates = reordered.map((item, idx) => ({
                id: item.id,
                name: item.name,
                price: item.price,
                sort_order: idx + 1
            }))

            const { error } = await supabase.from('menu_items').upsert(updates, { onConflict: 'id' })
            if (error) throw error
            toast.success('บันทึกลำดับเมนูแล้ว', { duration: 1200 })
        } catch (err) {
            console.error('Reorder error:', err)
            toast.error('บันทึกลำดับไม่สำเร็จ')
        } finally {
            setIsSavingOrder(false)
        }
    }

    // Option Picker Filter
    const filteredOptionGroups = useMemo(() => {
        if (!optionPickerSearch.trim()) return optionGroups
        const q = optionPickerSearch.toLowerCase().trim()
        return optionGroups.filter(og => og.name.toLowerCase().includes(q))
    }, [optionGroups, optionPickerSearch])

    // Price Margin Calculation for Modal
    const modalPrice = parseFloat(formData.price) || 0
    const modalCost = formData.material_cost || 0
    const modalProfit = modalPrice - modalCost
    const modalMargin = modalPrice > 0 ? ((modalProfit / modalPrice) * 100).toFixed(1) : 0

    return (
        <div className="text-[oklch(18%_0.012_28)] pb-12 animate-fade-in font-sans">
            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 pb-3 border-b border-[oklch(85%_0.012_28)]">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold font-mono uppercase tracking-tight text-[oklch(18%_0.012_28)]">
                            Catalog Menu Items
                        </h2>
                        <span className="font-mono text-xs text-[oklch(55%_0.010_28)] bg-[oklch(94%_0.010_28)] px-2 py-0.5 rounded-sm border border-[oklch(85%_0.012_28)]">
                            {filteredMenuItems.length} / {menuItems.length} รายการ
                        </span>
                        {isSavingOrder && (
                            <span className="text-xs font-mono text-[oklch(52%_0.16_28)] animate-pulse font-bold">
                                กำลังบันทึกลำดับ...
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-[oklch(55%_0.010_28)] font-mono mt-0.5">
                        จัดการรายการอาหาร เครื่องดื่ม รูปภาพ ต้นทุนวัตถุดิบ และตัวเลือกเสริม
                    </p>
                </div>

                <button 
                    onClick={handleCreate} 
                    className="bg-[oklch(18%_0.012_28)] text-white px-4 py-2 rounded-sm font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-black transition-colors shadow-sm cursor-pointer"
                >
                    <Plus size={15} /> สร้างเมนูใหม่ (New Menu Item)
                </button>
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-3 mb-5 space-y-3 shadow-xs">
                <div className="flex flex-col sm:flex-row gap-2.5">
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[oklch(55%_0.010_28)]" />
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อเมนู, คำอธิบาย หรือหมวดหมู่..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-8 py-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-sm text-xs font-mono focus:bg-white focus:border-[oklch(52%_0.16_28)] outline-none transition-all"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black">
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Status Filter Chips */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
                        {[
                            { id: 'all', label: 'ทั้งหมด' },
                            { id: 'in_stock', label: 'มีของ' },
                            { id: 'out_of_stock', label: 'ของหมด' },
                            { id: 'pickup', label: 'Pick-up' },
                            { id: 'stamp', label: '10 ฟรี 1' }
                        ].map(chip => (
                            <button
                                key={chip.id}
                                onClick={() => setStatusFilter(chip.id)}
                                className={`px-2.5 py-1.5 rounded-sm text-xs font-mono font-bold whitespace-nowrap transition-colors border cursor-pointer ${
                                    statusFilter === chip.id
                                        ? 'bg-[oklch(18%_0.012_28)] text-white border-[oklch(18%_0.012_28)] shadow-xs'
                                        : 'bg-white text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                                }`}
                            >
                                {chip.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Category Pills Navigation */}
                <div 
                    className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-[oklch(85%_0.012_28)] no-scrollbar"
                    onWheel={e => {
                        if (e.deltaY !== 0) {
                            e.preventDefault()
                            e.currentTarget.scrollLeft += e.deltaY * 0.8
                        }
                    }}
                >
                    <button
                        onClick={() => setSelectedCategoryTab('all')}
                        className={`px-3 py-1 rounded-sm text-xs font-mono font-bold whitespace-nowrap transition-colors border cursor-pointer ${
                            selectedCategoryTab === 'all'
                                ? 'bg-[oklch(52%_0.16_28)] text-white border-[oklch(52%_0.16_28)]'
                                : 'bg-transparent text-[oklch(55%_0.010_28)] border-transparent hover:text-black'
                        }`}
                    >
                        [ทุกหมวดหมู่ • {menuItems.length}]
                    </button>

                    <button
                        onClick={() => setSelectedCategoryTab('recommended')}
                        className={`px-3 py-1 rounded-sm text-xs font-mono font-bold whitespace-nowrap transition-colors border cursor-pointer ${
                            selectedCategoryTab === 'recommended'
                                ? 'bg-[oklch(52%_0.16_28)] text-white border-[oklch(52%_0.16_28)]'
                                : 'bg-transparent text-[oklch(55%_0.010_28)] border-transparent hover:text-black'
                        }`}
                    >
                        ★ เมนูแนะนำ ({menuItems.filter(i => i.is_recommended).length})
                    </button>

                    {categories.map(cat => {
                        const count = menuItems.filter(i => i.category_id === cat.id || i.category === cat.name).length
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategoryTab(cat.id)}
                                className={`px-3 py-1 rounded-sm text-xs font-mono font-bold whitespace-nowrap transition-colors border cursor-pointer ${
                                    selectedCategoryTab === cat.id
                                        ? 'bg-[oklch(52%_0.16_28)] text-white border-[oklch(52%_0.16_28)]'
                                        : 'bg-transparent text-[oklch(55%_0.010_28)] border-transparent hover:text-black'
                                }`}
                            >
                                {cat.name} ({count})
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Menu Items Grid with Dnd-Kit */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-28 bg-[oklch(94%_0.010_28)] animate-pulse rounded-sm border border-[oklch(85%_0.012_28)]" />
                    ))}
                </div>
            ) : filteredMenuItems.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-[oklch(85%_0.012_28)] rounded-sm bg-white text-[oklch(55%_0.010_28)] font-mono text-xs">
                    ไม่พบเมนูที่ตรงกับเงื่อนไขการค้นหา
                </div>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext items={filteredMenuItems.map(i => i.id)} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {filteredMenuItems.map(item => (
                                <SortableMenuItem
                                    key={item.id}
                                    item={item}
                                    handleEdit={handleEdit}
                                    handleDelete={handleDelete}
                                    handleDuplicate={handleDuplicate}
                                    handleToggleStock={handleToggleStock}
                                    handleTogglePickup={handleTogglePickup}
                                />
                            ))}
                        </div>
                    </SortableContext>

                    <DragOverlay dropAnimation={null}>
                        {activeDragItem && <SortableMenuItem item={activeDragItem} isOverlay={true} />}
                    </DragOverlay>
                </DndContext>
            )}

            {/* Create / Edit Modal */}
            {isModalOpen && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-[oklch(97%_0.008_28)] w-full max-w-xl rounded-sm border border-[oklch(85%_0.012_28)] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] font-sans">
                        {/* Modal Header */}
                        <div className="p-4 border-b border-[oklch(85%_0.012_28)] flex items-center justify-between bg-white z-10">
                            <div>
                                <h3 className="font-mono text-base font-bold uppercase tracking-tight text-[oklch(18%_0.012_28)]">
                                    {editingItem ? 'แก้ไขเมนู' : 'สร้างเมนูใหม่'}
                                </h3>
                                <p className="text-xs text-[oklch(55%_0.010_28)] font-mono mt-0.5">
                                    {editingItem ? `รหัสเมนู #${editingItem.id}` : 'กรอกรายละเอียดและบันทึกเข้าแค็ตตาล็อก'}
                                </p>
                            </div>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="p-1.5 text-[oklch(55%_0.010_28)] hover:text-black hover:bg-[oklch(90%_0.012_28)] rounded-sm cursor-pointer transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 overflow-y-auto flex-1 space-y-4 bg-[oklch(98%_0.006_28)]">
                            {/* Image Upload Area */}
                            <div>
                                <label className="block text-xs font-mono font-bold text-[oklch(42%_0.010_28)] uppercase mb-1.5">
                                    รูปภาพเมนู (Menu Image)
                                </label>
                                <div className="flex items-center gap-4">
                                    <div className="w-24 h-24 bg-white border border-[oklch(85%_0.012_28)] rounded-sm overflow-hidden relative group shrink-0">
                                        {previewUrl ? (
                                            <>
                                                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={handleRemoveImage}
                                                    className="absolute top-1 right-1 bg-black/70 text-white p-1 rounded-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="ลบรูปภาพ"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </>
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-[oklch(55%_0.010_28)] gap-1">
                                                <ImageIcon size={24} />
                                                <span className="text-[9px] font-mono">ไม่มีรูป</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="inline-block bg-white border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] px-3 py-1.5 rounded-sm font-mono font-bold text-xs cursor-pointer hover:bg-[oklch(94%_0.010_28)] transition-colors shadow-xs">
                                            <span>📷 เลือกรูปภาพ</span>
                                            <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                                        </label>
                                        <p className="text-[11px] text-[oklch(55%_0.010_28)] font-mono leading-tight">
                                            รองรับ JPG, PNG, WEBP (ระบบจะปรับขนาดและบีบอัดอัตโนมัติ)
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Name & Category Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-mono font-bold text-[oklch(42%_0.010_28)] uppercase mb-1">
                                        ชื่อเมนู *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="เช่น Iced Americano, Matcha Latte"
                                        className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2.5 text-xs font-bold text-[oklch(18%_0.012_28)] focus:border-[oklch(52%_0.16_28)] outline-none"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-mono font-bold text-[oklch(42%_0.010_28)] uppercase mb-1">
                                        หมวดหมู่ *
                                    </label>
                                    <select
                                        value={formData.category_id}
                                        onChange={e => handleCategoryChangeInForm(e.target.value)}
                                        className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2.5 text-xs font-bold text-[oklch(18%_0.012_28)] focus:border-[oklch(52%_0.16_28)] outline-none cursor-pointer"
                                        required
                                    >
                                        {categories.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Price & Costing Breakdown */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 border border-[oklch(85%_0.012_28)] rounded-sm">
                                <div>
                                    <label className="block text-xs font-mono font-bold text-[oklch(42%_0.010_28)] uppercase mb-1">
                                        ราคาขาย (บาท) *
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={formData.price}
                                        onChange={e => setFormData({ ...formData, price: e.target.value })}
                                        placeholder="0.00"
                                        className="w-full bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-sm p-2 text-xs font-mono font-bold text-[oklch(18%_0.012_28)] text-right focus:bg-white focus:border-[oklch(52%_0.16_28)] outline-none"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-mono font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                        ต้นทุนวัตถุดิบ (Recipe Cost)
                                    </label>
                                    <div className="p-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-sm text-xs font-mono font-bold text-right text-[oklch(42%_0.010_28)]">
                                        ฿{modalCost.toFixed(2)}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-mono font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                        Gross Margin (GP%)
                                    </label>
                                    <div className={`p-2 border rounded-sm text-xs font-mono font-bold text-right ${
                                        modalMargin >= 65 ? 'bg-green-50 text-green-800 border-green-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                                    }`}>
                                        {modalMargin}% (กำไร ฿{modalProfit.toFixed(2)})
                                    </div>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-mono font-bold text-[oklch(42%_0.010_28)] uppercase mb-1">
                                    คำอธิบายเมนู (Description)
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    rows={2}
                                    placeholder="เช่น เมล็ด House Blend คั่วกลาง โน้ตช็อกโกแลตและคาราเมล"
                                    className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2.5 text-xs text-[oklch(18%_0.012_28)] focus:border-[oklch(52%_0.16_28)] outline-none"
                                />
                            </div>

                            {/* Operational Status Toggles */}
                            <div className="grid grid-cols-2 gap-2.5">
                                <label className="flex items-center gap-2.5 bg-white p-3 rounded-sm border border-[oklch(85%_0.012_28)] cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        checked={formData.is_available}
                                        onChange={e => setFormData({ ...formData, is_available: e.target.checked })}
                                        className="w-4 h-4 accent-[oklch(52%_0.16_28)]"
                                    />
                                    <div>
                                        <div className="text-xs font-mono font-bold text-[oklch(18%_0.012_28)]">มีสินค้า (In Stock)</div>
                                        <div className="text-[10px] text-[oklch(55%_0.010_28)] font-mono">เปิดให้สั่งซื้อได้</div>
                                    </div>
                                </label>

                                <label className="flex items-center gap-2.5 bg-white p-3 rounded-sm border border-[oklch(85%_0.012_28)] cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        checked={formData.is_recommended}
                                        onChange={e => setFormData({ ...formData, is_recommended: e.target.checked })}
                                        className="w-4 h-4 accent-[oklch(52%_0.16_28)]"
                                    />
                                    <div>
                                        <div className="text-xs font-mono font-bold text-[oklch(18%_0.012_28)]">เมนูแนะนำ (Recommended)</div>
                                        <div className="text-[10px] text-[oklch(55%_0.010_28)] font-mono">แสดงแถบดาวและไฮไลต์</div>
                                    </div>
                                </label>

                                <label className="flex items-center gap-2.5 bg-white p-3 rounded-sm border border-[oklch(85%_0.012_28)] cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        checked={formData.is_pickup_available}
                                        onChange={e => setFormData({ ...formData, is_pickup_available: e.target.checked })}
                                        className="w-4 h-4 accent-[oklch(52%_0.16_28)]"
                                    />
                                    <div>
                                        <div className="text-xs font-mono font-bold text-[oklch(18%_0.012_28)]">รับ Pick-up หน้าร้าน</div>
                                        <div className="text-[10px] text-[oklch(55%_0.010_28)] font-mono">สั่งล่วงหน้าผ่านเว็บ</div>
                                    </div>
                                </label>

                                <label className="flex items-center gap-2.5 bg-white p-3 rounded-sm border border-[oklch(85%_0.012_28)] cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        checked={formData.is_drink_stamp_eligible}
                                        onChange={e => setFormData({ ...formData, is_drink_stamp_eligible: e.target.checked })}
                                        className="w-4 h-4 accent-[oklch(52%_0.16_28)]"
                                    />
                                    <div>
                                        <div className="text-xs font-mono font-bold text-[oklch(18%_0.012_28)]">สะสมแก้ว 10 ฟรี 1</div>
                                        <div className="text-[10px] text-[oklch(55%_0.010_28)] font-mono">สิทธิ์ Drink Stamp</div>
                                    </div>
                                </label>
                            </div>

                            {/* Option Groups Linking (React State Controlled) */}
                            <div className="space-y-2 pt-2 border-t border-[oklch(85%_0.012_28)]">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <label className="text-xs font-mono font-bold text-[oklch(42%_0.010_28)] uppercase block">
                                            กลุ่มตัวเลือกเสริม (Option Groups)
                                        </label>
                                        <span className="text-[10px] text-[oklch(55%_0.010_28)] font-mono">
                                            เลือกกลุ่มตัวเลือกที่เมนูนี้รองรับ เช่น ความหวาน, นม, ท็อปปิ้ง
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsOptionPickerOpen(!isOptionPickerOpen)}
                                        className="text-xs font-mono font-bold text-[oklch(52%_0.16_28)] border border-[oklch(52%_0.16_28)] px-2.5 py-1 rounded-sm hover:bg-[oklch(52%_0.16_28)] hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                                    >
                                        <Plus size={13} /> {isOptionPickerOpen ? 'ปิดหน้าต่างเลือก' : 'เลือกกลุ่มตัวเลือก'}
                                    </button>
                                </div>

                                {/* Option Picker Popover */}
                                {isOptionPickerOpen && (
                                    <div className="bg-white border border-[oklch(85%_0.012_28)] p-3 rounded-sm space-y-2 shadow-sm animate-fade-in">
                                        <input
                                            type="text"
                                            placeholder="ค้นหากลุ่มตัวเลือก..."
                                            value={optionPickerSearch}
                                            onChange={e => setOptionPickerSearch(e.target.value)}
                                            className="w-full bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-sm px-2.5 py-1.5 text-xs font-mono outline-none"
                                        />

                                        <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                                            {filteredOptionGroups.map(og => {
                                                const isChecked = selectedOptionGroups.includes(og.id)
                                                return (
                                                    <label 
                                                        key={og.id} 
                                                        className={`flex items-center justify-between p-2 rounded-sm border text-xs cursor-pointer transition-colors ${
                                                            isChecked ? 'bg-[oklch(94%_0.010_28)] border-[oklch(52%_0.16_28)] font-bold' : 'bg-white border-[oklch(85%_0.012_28)] hover:bg-[oklch(97%_0.008_28)]'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => {
                                                                    setSelectedOptionGroups(prev => 
                                                                        isChecked ? prev.filter(id => id !== og.id) : [...prev, og.id]
                                                                    )
                                                                }}
                                                                className="w-3.5 h-3.5 accent-[oklch(52%_0.16_28)]"
                                                            />
                                                            <span>{og.name}</span>
                                                        </div>
                                                        <span className="text-[10px] font-mono text-[oklch(55%_0.010_28)]">
                                                            {(og.option_choices || []).length} choices
                                                        </span>
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Selected Groups Chips */}
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {selectedOptionGroups.map(groupId => {
                                        const group = optionGroups.find(g => g.id === groupId)
                                        if (!group) return null
                                        return (
                                            <span 
                                                key={groupId}
                                                className="bg-white border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] px-2.5 py-1 rounded-sm text-xs font-mono font-bold flex items-center gap-1.5 shadow-2xs"
                                            >
                                                <span>{group.name}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedOptionGroups(prev => prev.filter(id => id !== groupId))}
                                                    className="text-gray-400 hover:text-red-600"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </span>
                                        )
                                    })}
                                    {selectedOptionGroups.length === 0 && (
                                        <span className="text-xs font-mono text-[oklch(55%_0.010_28)] italic">
                                            ยังไม่ได้เชื่อมโยงกลุ่มตัวเลือกเสริม
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-[oklch(85%_0.012_28)] bg-white flex gap-2">
                            <button 
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-mono font-bold text-xs uppercase py-2.5 rounded-sm hover:bg-[oklch(90%_0.012_28)] transition-colors cursor-pointer"
                            >
                                ยกเลิก
                            </button>
                            <button 
                                type="button"
                                onClick={handleSubmit} 
                                className="flex-1 bg-[oklch(18%_0.012_28)] text-white font-mono font-bold text-xs uppercase py-2.5 rounded-sm hover:bg-black transition-colors shadow-sm cursor-pointer"
                            >
                                บันทึกเมนู
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}
