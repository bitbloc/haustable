import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Plus, Edit2, Trash2, X, Image as ImageIcon, Check, Star, AlertCircle, Camera, ShoppingBag, GripVertical, Lock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { DndContext, closestCorners, rectIntersection, MouseSensor, TouchSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import { arrayMove, SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// --- Sortable Item Component ---
const SortableMenuItem = React.memo(function SortableMenuItem({ item, handleEdit, handleTogglePickup, isOverlay = false }) {
    const isRecommended = item.is_recommended;

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
        disabled: isRecommended, 
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

    // Styles
    const baseCardStyle = "bg-paper border border-gray-200 rounded-xl p-3 flex gap-4 transition-all relative select-none group hover:border-gray-300 hover:shadow-md";
    const recommendCardStyle = "bg-gray-50 border border-gray-200 rounded-xl p-3 flex gap-4 opacity-80 relative select-none grayscale-[0.2]"; 
    const currentStyle = isRecommended ? recommendCardStyle : baseCardStyle;

    // Overlay Render (Dragging Preview)
    if (isOverlay) {
         return (
            <div className={`bg-paper border-brand ring-2 ring-brand rounded-xl p-3 flex gap-4 shadow-xl cursor-grabbing select-none z-50 scale-105`}>
                 <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden shrink-0 relative border border-gray-100">
                    {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon size={20} /></div>}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                         <div className="flex justify-between items-start">
                            <h4 className="font-bold truncate text-base text-ink">{item.name}</h4>
                            <span className="text-brandDark font-mono font-bold">{item.price}</span>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            className={`${currentStyle}`}
            onClick={(e) => {
                if (!isDragging) handleEdit(item); 
            }}
        >
            {/* Drag Handle */}
            <div className="absolute top-2 right-2 z-20">
                {!isRecommended ? (
                    <div 
                        ref={setActivatorNodeRef}
                        {...attributes}
                        {...listeners}
                        className="p-2 text-subInk hover:text-ink cursor-grab active:cursor-grabbing hover:bg-gray-100 rounded-lg transition-colors"
                        onClick={(e) => e.stopPropagation()} 
                    >
                        <GripVertical size={20} />
                    </div>
                ) : (
                    <div className="p-2 text-gray-300">
                        <Lock size={16} />
                    </div>
                )}
            </div>

            <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden shrink-0 relative pointer-events-none border border-gray-100">
                {item.image_url ? (
                    <img src={item.image_url} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon size={20} /></div>
                )}
            </div>
            
            <div className="flex-1 min-w-0 flex flex-col justify-between pointer-events-none">
                <div>
                    <div className="flex justify-between items-start pr-8"> 
                        <h4 className={`font-bold truncate text-base ${isRecommended ? 'text-subInk' : 'text-ink'}`}>{item.name}</h4>
                        <span className={`font-mono font-bold ${isRecommended ? 'text-subInk' : 'text-brandDark'}`}>{item.price}</span>
                    </div>
                    <div className="text-xs text-subInk line-clamp-1 mt-1">{item.description || 'ไม่มีคำอธิบาย'}</div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                    {isRecommended && <span className="text-[10px] bg-gray-200 text-subInk border border-gray-300 px-1.5 py-0.5 rounded flex items-center gap-1 font-bold">FIXED</span>}
                    {!item.is_available && <span className="text-[10px] bg-red-50 text-red-500 border border-red-100 px-1.5 py-0.5 rounded">หมด</span>}
                </div>
            </div>

            {/* Inline Pickup Toggle */}
            <div className="absolute bottom-3 right-3 flex items-center gap-2 z-10" 
                onPointerDown={(e) => e.stopPropagation()} 
                onClick={(e) => e.stopPropagation()}
            >
                <span className={`text-[10px] font-bold ${item.is_pickup_available !== false ? 'text-subInk' : 'text-gray-300'}`}>Pick-up</span>
                <button
                    onClick={(e) => handleTogglePickup(e, item)}
                    className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer ${item.is_pickup_available !== false ? 'bg-brand' : 'bg-gray-200'}`}
                >
                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${item.is_pickup_available !== false ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
            </div>
        </div>
    )
})

export default function MenuItemList() {
    const [menuItems, setMenuItems] = useState([])
    const [categories, setCategories] = useState([])
    const [optionGroups, setOptionGroups] = useState([])

    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState(null)
    const [imageFile, setImageFile] = useState(null)
    const [previewUrl, setPreviewUrl] = useState(null)
    const [imageRemoved, setImageRemoved] = useState(false)

    const [formData, setFormData] = useState({
        name: '',
        price: '',
        category_id: '',
        description: '',
        is_available: true,
        is_recommended: false,
        is_pickup_available: true 
    })

    const [selectedOptionGroups, setSelectedOptionGroups] = useState([])
    const [activeTab, setActiveTab] = useState('normal') 
    const [activeDragItem, setActiveDragItem] = useState(null) 

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        const [menuRes, catRes, optRes] = await Promise.all([
            // Order by sort_order primarily
            supabase.from('menu_items').select(`*, menu_categories (name)`).order('sort_order', { ascending: true }),
            supabase.from('menu_categories').select('*').order('display_order'),
            supabase.from('option_groups').select('*').order('name')
        ])

        if (menuRes.data) setMenuItems(menuRes.data)
        if (catRes.data) setCategories(catRes.data)
        if (optRes.data) setOptionGroups(optRes.data)
        setLoading(false)
    }

    // --- Data Split: Recommend vs Regular ---
    // Rule: Item is EITHER in Recommend OR in Regular (Mutually Exclusive for drag view)
    const sections = {
        recommend: menuItems.filter(i => i.is_recommended),
        regular: menuItems
            .filter(i => !i.is_recommended)
            .reduce((acc, item) => {
                 // Fallback key if category_id matches logic
                 const catId = item.category_id || 'uncategorized';
                 if (!acc[catId]) acc[catId] = [];
                 acc[catId].push(item);
                 return acc;
            }, {})
    };

    // --- Actions ---

    const handleCreate = () => {
        setSelectedOptionGroups([])
        setImageFile(null)
        setPreviewUrl(null)
        setImageRemoved(false)
        setFormData({
            name: '',
            price: '',
            category_id: categories[0]?.id || '',
            description: '',
            is_available: true,
            is_recommended: false,
            is_pickup_available: true
        })
        setIsModalOpen(true)
    }

    const handleEdit = async (item) => {
        setEditingItem(item)
        setFormData({
            name: item.name,
            price: item.price,
            category_id: item.category_id || categories.find(c => c.name === item.category)?.id || '',
            description: item.description || '',
            is_available: item.is_available,
            is_recommended: item.is_recommended,
            is_pickup_available: item.is_pickup_available !== false 
        })

        // Lazy Load Options
        const { data: options } = await supabase.from('menu_item_options')
            .select('option_group_id, display_order')
            .eq('menu_item_id', item.id)
            .order('display_order')

        const linkedGroups = options?.map(o => o.option_group_id) || []
        setSelectedOptionGroups(linkedGroups)

        setImageFile(null)
        setPreviewUrl(item.image_url)
        setImageRemoved(false)
        setIsModalOpen(true)
    }

    const handleTogglePickup = async (e, item) => {
        e.stopPropagation() 
        const newValue = item.is_pickup_available === false ? true : false
        
        // Optimistic Update
        setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, is_pickup_available: newValue } : i))

        try {
            const { error } = await supabase.from('menu_items').update({ is_pickup_available: newValue }).eq('id', item.id)
            if (error) throw error
        } catch (err) {
            console.error("Toggle Error", err)
            setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, is_pickup_available: !newValue } : i))
            alert("Failed to update status")
        }
    }

    // --- Image Utility ---
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

                    canvas.toBlob((blob) => {
                        resolve(new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: "image/jpeg", lastModified: Date.now() }))
                    }, 'image/jpeg', 0.85)
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
                setImageFile(file); setPreviewUrl(URL.createObjectURL(file))
            }
        }
    }
    const handleRemoveImage = (e) => { e.stopPropagation(); setImageFile(null); setPreviewUrl(null); setImageRemoved(true); }

    const handleDelete = async (id) => {
        if (!confirm('ยืนยันเมนู?')) return
        await supabase.from('menu_items').delete().eq('id', id)
        
        // Optimistically remove from state
        setMenuItems(prev => prev.filter(i => i.id !== id));
        setIsModalOpen(false); // Close if open
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            let imageUrl = editingItem?.image_url || ''
            if (imageRemoved) imageUrl = ''
            if (imageFile) {
                const fileName = `menu_${Date.now()}.jpg`
                const { error } = await supabase.storage.from('public-assets').upload(fileName, imageFile)
                if (error) throw error
                const { data } = supabase.storage.from('public-assets').getPublicUrl(fileName)
                imageUrl = data.publicUrl
            }

            const selectedCat = categories.find(c => c.id === formData.category_id)
            const selectedCatName = selectedCat ? selectedCat.name : 'Uncategorized'

            const payload = {
                name: formData.name,
                price: parseFloat(formData.price),
                category_id: formData.category_id || null,
                category: selectedCatName,
                description: formData.description,
                is_available: formData.is_available,
                is_recommended: formData.is_recommended,
                is_pickup_available: formData.is_pickup_available,
                image_url: imageUrl
            }

            let newItemId = editingItem?.id

            if (editingItem) {
                const { error } = await supabase.from('menu_items').update(payload).eq('id', newItemId)
                if (error) throw error
            } else {
                // Get next sort order
                 const maxSort = menuItems.length > 0 ? Math.max(...menuItems.map(i => i.sort_order || 0)) : 0;
                const { data, error } = await supabase.from('menu_items').insert({...payload, sort_order: maxSort + 1}).select().single()
                if (error) throw error
                newItemId = data.id
            }

            // Sync Options
            if (newItemId) {
                await supabase.from('menu_item_options').delete().eq('menu_item_id', newItemId)
                if (selectedOptionGroups.length > 0) {
                    const links = selectedOptionGroups.map((groupId, idx) => ({ menu_item_id: newItemId, option_group_id: groupId, display_order: idx }))
                    await supabase.from('menu_item_options').insert(links)
                }
            }

            // Simple Refresh
            fetchData();
            setIsModalOpen(false)
        } catch (error) {
            alert('Error: ' + error.message)
        }
    }
    const toggleOptionGroup = (groupId) => {
        if (selectedOptionGroups.includes(groupId)) setSelectedOptionGroups(selectedOptionGroups.filter(id => id !== groupId))
        else setSelectedOptionGroups([...selectedOptionGroups, groupId])
    }


    // --- Drag & Drop Logic (Ported from AdminMenu.jsx) ---
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 8 } })
    )

    const handleDragStart = (event) => {
        setActiveDragItem(menuItems.find(i => i.id === event.active.id))
    }

    const handleDragOver = (event) => {
        const { active, over } = event;
        if (!over) return;
    
        const activeId = active.id;
        const overId = over.id;
    
        // Find Item objects
        const activeItemLocal = menuItems.find(i => i.id === activeId);
        const overItemLocal = menuItems.find(i => i.id === overId);
    
        if (!activeItemLocal) return;
    
        // 1. Identify Target Group
        let targetGroup = null;
    
        if (overItemLocal) {
            // Dragging over another Item -> inherit its group
            targetGroup = overItemLocal.is_recommended ? 'recommend' : overItemLocal.category_id;
        } else {
            // Dragging over Empty Container
            if (overId === 'container-recommend') targetGroup = 'recommend';
            else if (overId.startsWith('container-')) targetGroup = overId.replace('container-', '');
        }
    
        // Security Check: No cross-category dragging (except Recommend)
        // If targetGroup is regular category, it MUST match activeItem's category
        const isActiveRecommend = activeItemLocal.is_recommended;
        
        // If currently recommend, can only go to its original category
        if (isActiveRecommend && targetGroup !== 'recommend' && targetGroup !== activeItemLocal.category_id) return;

        // If currently regular, can only go to recommend OR same category
        if (!isActiveRecommend && targetGroup !== 'recommend' && targetGroup !== activeItemLocal.category_id) return;


        // 2. Optimistic Update (Flip is_recommended)
        const isTargetRecommend = (targetGroup === 'recommend');
    
        if (isActiveRecommend !== isTargetRecommend) {
            setMenuItems((items) => {
                const activeIndex = items.findIndex((i) => i.id === activeId);
                const overIndex = items.findIndex((i) => i.id === overId);
    
                if (activeIndex === -1) return items;
    
                const newItems = [...items];
                
                // Toggle status immediately
                newItems[activeIndex] = { 
                    ...newItems[activeIndex], 
                    is_recommended: isTargetRecommend 
                };
    
                // Move in array to prevent flickering if target is specific item
                if (overIndex >= 0) {
                     return arrayMove(newItems, activeIndex, overIndex);
                }
                
                return newItems;
            });
        }
    };

    const handleDragEnd = async (event) => {
        const { active, over } = event;
        setActiveDragItem(null);

        if (!over) return;
        
        if (active.id !== over.id) {
            // Finalize Reorder
            const oldIndex = menuItems.findIndex((i) => i.id === active.id);
            const newIndex = menuItems.findIndex((i) => i.id === over.id);

            let finalItems = menuItems;
            if (oldIndex !== -1 && newIndex !== -1) {
                finalItems = arrayMove(menuItems, oldIndex, newIndex);
            }

            setMenuItems(finalItems);
            
            // Persist (Batch Update -> Sequential Update to avoid Upsert Input Errors)
            try {
                await Promise.all(finalItems.map((item, index) => 
                    supabase.from('menu_items')
                        .update({ 
                            sort_order: index, 
                            is_recommended: item.is_recommended 
                        })
                        .eq('id', item.id)
                ));
            } catch (err) {
                console.error("Reorder fail", err);
                // Optional: Revert state if needed, but for drag-drop usually we just log
            }
        }
    };


    return (
        <div className="pb-20 animate-fade-in text-ink">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-ink">Menu Items</h2>
                    <p className="text-subInk text-sm">จัดการเมนูอาหารและเครื่องดื่ม</p>
                </div>
                <button onClick={handleCreate} className="bg-brand text-ink px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-brandDark transition-colors shadow-sm border border-brandDark/10">
                    <Plus size={18} /> เพิ่มเมนู
                </button>
            </div>

            <DndContext 
                sensors={sensors} 
                collisionDetection={rectIntersection} 
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                
                {/* 1. Recommend Lane */}
                <div 
                    id="container-recommend"
                    className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-gray-50 to-white border border-brand/20 min-h-[160px] shadow-sm"
                >
                    <div className="flex items-center gap-2 mb-4">
                        <Star className="text-brand fill-brand" size={20} />
                        <h3 className="text-lg font-bold text-brandDark tracking-wide">Recommend Menu (Top Fixed)</h3>
                        <span className="text-xs text-subInk ml-auto">ลากเมนูขึ้นมาเพื่อแนะนำ</span>
                    </div>

                    <SortableContext 
                        id="recommend"
                        items={sections.recommend.map(i => i.id)} 
                        strategy={rectSortingStrategy}
                    >
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {sections.recommend.length === 0 && (
                                <div className="col-span-full py-8 text-center border border-dashed border-gray-300 rounded-xl text-subInk bg-white/50">
                                    ยังไม่มีเมนูแนะนำ
                                </div>
                            )}
                            {sections.recommend.map(item => (
                                <SortableMenuItem 
                                    key={item.id} 
                                    item={item} 
                                    handleEdit={handleEdit} 
                                    handleTogglePickup={handleTogglePickup} 
                                />
                            ))}
                        </div>
                    </SortableContext>
                </div>

                {/* 2. Regular Categories */}
                <div className="space-y-8">
                    {categories.map(cat => {
                        const items = sections.regular[cat.id] || [];

                        return (
                            <div key={cat.id} id={`container-${cat.id}`} className="min-h-[100px] rounded-xl transition-colors">
                                <h3 className="text-xl font-bold text-ink mb-4 border-l-4 border-brand pl-3 flex items-center gap-2">
                                    {cat.name} <span className="text-xs text-subInk font-normal">({items.length})</span>
                                </h3>
                                
                                <SortableContext 
                                    id={cat.id} 
                                    items={items.map(i => i.id)} 
                                    strategy={rectSortingStrategy}
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {items.length === 0 && <p className="text-subInk text-sm py-4 italic">No items in this category...</p>}
                                        {items.map(item => (
                                            <SortableMenuItem 
                                                key={item.id} 
                                                item={item} 
                                                handleEdit={handleEdit} 
                                                handleTogglePickup={handleTogglePickup} 
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                            </div>
                        )
                    })}
                    {/* Catch Uncategorized if any */}
                    {sections.regular['uncategorized'] && sections.regular['uncategorized'].length > 0 && (
                         <div id="container-uncategorized">
                            <h3 className="text-xl font-bold text-subInk mb-4">Uncategorized</h3>
                            <SortableContext id="uncategorized" items={sections.regular['uncategorized'].map(i=>i.id)} strategy={rectSortingStrategy}>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {sections.regular['uncategorized'].map(item => (
                                         <SortableMenuItem key={item.id} item={item} handleEdit={handleEdit} handleTogglePickup={handleTogglePickup} />
                                    ))}
                                </div>
                            </SortableContext>
                        </div>
                    )}
                </div>

                <DragOverlay>
                    {activeDragItem ? (
                        <SortableMenuItem 
                            item={activeDragItem} 
                            handleEdit={()=>{}}
                            handleTogglePickup={()=>{}}
                            isOverlay 
                        />
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* Edit/Create Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-0 md:p-4">
                         <motion.div
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 50, opacity: 0 }}
                            className="bg-paper w-full max-w-2xl h-full md:h-auto md:max-h-[85vh] md:rounded-3xl border border-gray-200 shadow-2xl overflow-hidden flex flex-col"
                        >
                            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-paper z-10">
                                <h2 className="text-xl font-bold text-ink">{editingItem ? 'แก้ไขเมนู' : 'เพิ่มเมนู'}</h2>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-subInk hover:text-ink"><X /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto bg-canvas">
                                {/* Image Upload */}
                                <div className="w-full h-48 bg-gray-100 relative group cursor-pointer border-b border-gray-200" onClick={() => document.getElementById('menu-image-upload').click()}>
                                    {previewUrl ? <img src={previewUrl} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" /> : <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 group-hover:bg-gray-200 transition-colors"><ImageIcon size={48} className="mb-2 opacity-50" /><span className="text-sm">เพิ่มรูปภาพเมนู</span></div>}
                                    <div className="absolute top-2 right-2 flex gap-2">
                                        {previewUrl && <button onClick={handleRemoveImage} className="bg-red-500/80 hover:bg-red-500 text-white p-2 rounded-full backdrop-blur-sm shadow-lg transition-transform hover:scale-105"><Trash2 size={16} /></button>}
                                    </div>
                                    <input id="menu-image-upload" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                                </div>
                                
                                <div className="p-6 space-y-6">
                                    <div className="space-y-4">
                                        <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-transparent border-b border-gray-200 p-2 text-xl font-bold text-ink placeholder-gray-400 focus:border-brand outline-none transition-colors" placeholder="ชื่อเมนู (ภาษาไทย)" required />
                                    </div>
                                    <div className="relative">
                                        <select value={formData.category_id} onChange={e => setFormData({ ...formData, category_id: e.target.value })} className="w-full bg-paper border border-gray-200 rounded-xl p-4 text-ink appearance-none outline-none focus:border-brand shadow-sm">
                                            <option value="">เลือกหมวดหมู่</option>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-subInk mb-2 block uppercase">ราคาขาย</label>
                                        <div className="flex items-center gap-4 bg-paper rounded-xl p-4 border border-gray-200 shadow-sm">
                                            <span className="font-bold text-ink">ราคา</span>
                                            <input type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} className="flex-1 bg-transparent text-right font-mono text-xl font-bold outline-none placeholder-gray-400 text-ink" placeholder="0.00" />
                                            <span className="text-subInk">฿</span>
                                        </div>
                                    </div>
                                    
                                    {/* Option Groups Config */}
                                    <div className="bg-paper rounded-xl p-4 border border-gray-200 shadow-sm">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-bold text-base text-ink">กลุ่มตัวเลือก (Options)</h3>
                                            <button type="button" onClick={() => document.getElementById('option-picker').classList.toggle('hidden')} className="text-brandDark text-xs font-bold flex items-center gap-1 hover:underline"><Plus size={14} /> เพิ่มกลุ่มตัวเลือก</button>
                                        </div>
                                        <div className="space-y-2 mb-4">
                                            {selectedOptionGroups.map(gid => {
                                                const group = optionGroups.find(g => g.id === gid); if (!group) return null;
                                                return <div key={gid} className="bg-gray-50 border border-gray-200 p-3 rounded-lg flex justify-between items-center text-ink"><div><div className="font-bold text-sm">{group.name}</div><div className="text-xs text-subInk">{group.selection_type}</div></div><button onClick={() => toggleOptionGroup(gid)} className="text-gray-400 hover:text-red-500"><X size={16} /></button></div>
                                            })}
                                        </div>
                                        <div id="option-picker" className="hidden border-t border-gray-200 pt-4 mt-4 grid grid-cols-2 gap-2">
                                            {optionGroups.filter(g => !selectedOptionGroups.includes(g.id)).map(g => <button key={g.id} onClick={() => toggleOptionGroup(g.id)} className="text-left text-xs p-2 bg-white border border-gray-200 rounded hover:border-brand text-ink shadow-sm transition-colors">{g.name}</button>)}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-2"><div className="flex items-center gap-3"><div className={`p-2 rounded-full ${formData.is_recommended ? 'bg-brand/20 text-brandDark' : 'bg-gray-200 text-gray-400'}`}><Star size={20} /></div><div><div className="font-bold text-sm text-ink">เมนูแนะนำ</div></div></div><input type="checkbox" checked={formData.is_recommended} onChange={e => setFormData({ ...formData, is_recommended: e.target.checked })} className="w-5 h-5 accent-brand" /></div>
                                        <div className="flex items-center justify-between p-2"><div className="flex items-center gap-3"><div className={`p-2 rounded-full ${formData.is_available ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}><Check size={20} /></div><div><div className="font-bold text-sm text-ink">เปิดขาย</div></div></div><input type="checkbox" checked={formData.is_available} onChange={e => setFormData({ ...formData, is_available: e.target.checked })} className="w-5 h-5 accent-brand" /></div>
                                        <div className="flex items-center justify-between p-2"><div className="flex items-center gap-3"><div className={`p-2 rounded-full ${formData.is_pickup_available ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-400'}`}><ShoppingBag size={20} /></div><div><div className="font-bold text-sm text-ink">Pick-up</div></div></div><input type="checkbox" checked={formData.is_pickup_available} onChange={e => setFormData({ ...formData, is_pickup_available: e.target.checked })} className="w-5 h-5 accent-brand" /></div>
                                    </div>
                                    <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-paper border border-gray-200 rounded-xl p-4 text-ink placeholder-gray-400 focus:border-brand outline-none resize-none h-32 shadow-sm" placeholder="คำอธิบายเมนู"></textarea>
                                </div>
                            </div>
                            <div className="p-4 border-t border-gray-200 bg-gray-50 z-10">
                                <button onClick={handleSubmit} className="w-full bg-brand text-ink font-bold py-3 rounded-xl hover:bg-brandDark shadow-lg shadow-brand/20 transition-all transform active:scale-[0.98]">บันทึกเมนู</button>
                                {editingItem && <button onClick={() => handleDelete(editingItem.id)} className="w-full mt-2 text-red-500 text-xs font-bold py-2 hover:bg-red-50 rounded-lg transition-colors">ลบเมนูนี้</button>}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
