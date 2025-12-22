import { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient'; // Keep supabase for mutations
import { fetchAndSortMenu } from './utils/menuHelper';
import { Plus, X, Star, HelpCircle, AlertTriangle } from 'lucide-react';
import {
    DndContext,
    rectIntersection,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableMenuItem } from './components/SortableMenuItem';

const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
        styles: {
            active: {
                opacity: '0.5',
            },
        },
    }),
};

export default function AdminMenu() {
    const [menuItems, setMenuItems] = useState([]);
    const [categories, setCategories] = useState([]); // Dynamic Categories
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({ name: '', price: '', category: '', is_available: true, is_pickup_available: true, is_recommended: false });
    const [imageFile, setImageFile] = useState(null);
    const [activeId, setActiveId] = useState(null);
    const [activeItem, setActiveItem] = useState(null); 
    // Safe initialization for SSR
    const [isMobile, setIsMobile] = useState(false); 

    useEffect(() => {
        // Run checks only on client side
        setIsMobile(window.innerWidth < 768);
        fetchMenu();
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchMenu = async () => {
        setLoading(true);
        try {
            const { menuItems: data, categories: cats } = await fetchAndSortMenu();
            setMenuItems(data || []);
            setCategories(cats || []);
            // Set default category for form
            if (cats && cats.length > 0 && formData.category === '') {
                setFormData(prev => ({ ...prev, category: cats[0].name }));
            }
        } catch (error) {
            console.error("Fetch Menu Error:", error);
        }
        setLoading(false);
    };

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Group items: Recommend vs Regular (Mutually Exclusive)
    // Group items: Recommend vs Regular (Mutually Exclusive)
    const sections = {
        recommend: menuItems.filter(i => i.is_recommended),
        // Group by valid categories first
        regular: categories.reduce((acc, cat) => {
             acc[cat.name] = menuItems.filter(i => !i.is_recommended && i.category === cat.name);
             return acc;
        }, {}),
        // Catch-all for items with unknown categories
        uncategorized: menuItems.filter(i => 
            !i.is_recommended && 
            !categories.some(c => c.name === i.category)
        )
    }; 

    const handleDragStart = (event) => {
        const { active } = event;
        setActiveId(String(active.id)); // Enforce String
        const item = menuItems.find(i => String(i.id) === String(active.id));
        setActiveItem(item);
    };

    const handleDragOver = (event) => {
        const { active, over } = event;
        if (!over) return;
    
        const activeIdStr = String(active.id); // Enforce String
        const overIdStr = String(over.id);     // Enforce String
    
        // Find Item objects
        const activeItemLocal = menuItems.find(i => String(i.id) === activeIdStr);
        const overItemLocal = menuItems.find(i => String(i.id) === overIdStr);
    
        if (!activeItemLocal) return;
    
        // 1. Identify Target Group
        let targetGroup = null;
    
        if (overItemLocal) {
            // Dragging over another Item -> inherit its group
            targetGroup = overItemLocal.is_recommended ? 'recommend' : overItemLocal.category;
        } else {
            // Dragging over Empty Container (SortableContext IDs are prefixed now)
            if (overIdStr === 'ctx-recommend') targetGroup = 'recommend';
            else if (overIdStr.startsWith('ctx-cat-')) targetGroup = overIdStr.replace('ctx-cat-', '');
            else if (overIdStr === 'ctx-uncategorized') targetGroup = 'uncategorized';
        }

        // Handle Uncategorized drop -> Allow dropping into uncategorized buckets
        if (targetGroup === 'uncategorized') {
             // Allow move
        }
    
        // Security Check: No cross-category dragging (except Recommend)
        // Allow moving TO recommend OR staying in same category
        const sourceCategory = activeItemLocal.category;
        
        // Strict Mode: Can only move between Recommend <-> Original Category
        // Or if we implementing "Move Category by Drag", then we allow it.
        // Assuming user wants to Reorder ONLY, not change category via drag (except Recommend toggle)
        
        // However, if we want to allow fixing "Uncategorized" by dragging to a Category, we should allow it.
        // Let's allow dragging ANYWHERE, and update the item's category if it changes zones!
        // That is more intuitive for "Admin".

        // Update 2024: Enable full cross-category drag
        
        // 2. Optimistic Update
        const isActiveRecommend = activeItemLocal.is_recommended;
        const isOverRecommend = targetGroup === 'recommend';
        const isCategoryChange = targetGroup !== 'recommend' && targetGroup !== 'uncategorized' && targetGroup !== activeItemLocal.category;
    
        if (isActiveRecommend !== isOverRecommend || isCategoryChange) {
            setMenuItems((items) => {
                const activeIndex = items.findIndex((i) => String(i.id) === activeIdStr);
                const overIndex = items.findIndex((i) => String(i.id) === overIdStr);
    
                if (activeIndex === -1) return items;
    
                const newItems = [...items];
                const updatedItem = { ...newItems[activeIndex] };

                // Apply updates
                updatedItem.is_recommended = isOverRecommend;
                
                // If dropped into a specific category context (not recommend), update category
                if (!isOverRecommend && targetGroup && targetGroup !== 'uncategorized') {
                     updatedItem.category = targetGroup;
                }

                newItems[activeIndex] = updatedItem;
    
                // Move in array
                if (overIndex >= 0) {
                     return arrayMove(newItems, activeIndex, overIndex);
                }
                
                return newItems;
            });
        }
    };

    const handleDragEnd = async (event) => {
        const { active, over } = event;
        setActiveId(null);
        setActiveItem(null);

        if (!over) return;
        
        // String conversion for safety
        const activeIdStr = String(active.id);
        const overIdStr = String(over.id);

        // NOTE: We do NOT return early here if IDs are equal, because we might have changed properties 
        // (is_recommended, category) in handleDragOver, which constitutes a change that needs saving.
        // if (activeIdStr === overIdStr) return;

        // Finalize Reorder
        const oldIndex = menuItems.findIndex((i) => String(i.id) === activeIdStr);
        const newIndex = menuItems.findIndex((i) => String(i.id) === overIdStr);

        let finalItems = menuItems;
        if (oldIndex !== -1 && newIndex !== -1) {
            finalItems = arrayMove(menuItems, oldIndex, newIndex);
        }

        setMenuItems(finalItems);

        // Persist to DB
        // We need to persist ALL fields that might have changed (sort_order, is_recommended, category)
        const updates = finalItems.map((i, index) => ({
            id: i.id,
            sort_order: index,
            is_recommended: i.is_recommended,
            category: i.category // Important if moved between categories
        }));

        await supabase.from('menu_items').upsert(updates);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const price = parseFloat(formData.price);
            if (price < 0) {
                alert('ราคาไม่สามารถติดลบได้ (Price cannot be negative)');
                return;
            }

            // Duplicate Name Check
            const duplicate = menuItems.find(i => 
                i.name.trim().toLowerCase() === formData.name.trim().toLowerCase() &&
                (!editingItem || i.id !== editingItem.id)
            );

            if (duplicate) {
                if (!confirm(`มีเมนูชื่อ "${formData.name}" อยู่แล้ว คุณต้องการสร้างซ้ำหรือไม่?\n(Duplicate Name Detected. Continue?)`)) {
                    return;
                }
            }

            let imageUrl = editingItem?.image_url || '';
            if (imageFile) {
                const fileName = `menu_${Date.now()}.${imageFile.name.split('.').pop()}`;
                const { error: uploadError } = await supabase.storage.from('public-assets').upload(fileName, imageFile);
                if (uploadError) throw uploadError;
                const { data: { publicUrl } } = supabase.storage.from('public-assets').getPublicUrl(fileName);
                imageUrl = publicUrl;
            }

            const payload = {
                name: formData.name,
                price: price,
                category: formData.category,
                is_available: formData.is_available,
                is_pickup_available: formData.is_pickup_available,
                is_recommended: formData.is_recommended,
                image_url: imageUrl
            };

            if (editingItem && editingItem.id) {
                // UPDATE ITEM
                await supabase.from('menu_items').update(payload).eq('id', editingItem.id);
            } else {
                // CREATE NEW ITEM
                const maxSort = menuItems.length > 0 ? Math.max(...menuItems.map(i => i.sort_order || 0)) : 0;
                await supabase.from('menu_items').insert({ ...payload, sort_order: maxSort + 1 });
            }

            setIsModalOpen(false);
            fetchMenu();
            resetForm();
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('ยืนยันลบเมนูนี้?')) return;
        await supabase.from('menu_items').delete().eq('id', id);
        fetchMenu();
    };

    const resetForm = () => {
        setFormData({ 
            name: '', 
            price: '', 
            category: categories.length > 0 ? categories[0].name : 'Main', // Fallback to 'Main' if empty
            is_available: true, 
            is_pickup_available: true, 
            is_recommended: false 
        });
        setEditingItem(null);
        setImageFile(null);
    };

    return (
        <DndContext 
            sensors={sensors}
            collisionDetection={rectIntersection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="pb-20">
                <div className="flex justify-between items-center mb-8 sticky top-0 bg-[#09090b] z-40 py-4 border-b border-white/5">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Menu Management</h1>
                        <p className="text-gray-500 hidden md:block">Drag & Drop เพื่อจัดเรียง • แนะนำให้ลากเมนูขึ้น "Recommend" เพื่อโปรโมท</p>
                    </div>
                    <button
                        onClick={() => { resetForm(); setIsModalOpen(true); }}
                        className="bg-[#DFFF00] text-black px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:shadow-[0_0_20px_rgba(223,255,0,0.4)] transition-all"
                    >
                        <Plus size={20} /> <span className="hidden md:inline">เพิ่มเมนูใหม่</span>
                    </button>
                </div>

                {/* Recommend Menu */}
                <div 
                    id="ctx-recommend" /* PREFIXED ID */
                    className={`mb-10 p-4 border rounded-3xl transition-colors duration-300 min-h-[200px] ${
                        activeItem && activeItem.is_recommended === false 
                        ? 'border-[#DFFF00] bg-[#DFFF00]/10' 
                        : 'border-[#DFFF00]/20 bg-[#DFFF00]/5' 
                    }`}
                >
                     <div className="flex items-center gap-2 mb-4 text-[#DFFF00]">
                        <Star fill="#DFFF00" size={20} />
                        <h2 className="text-xl font-bold uppercase tracking-wider">Recommend Menu (รวมดาว)</h2>
                    </div>
                    <SortableContext 
                        id="ctx-recommend" /* PREFIXED ID */
                        items={sections.recommend.map(i => String(i.id))} /* String IDs */
                        strategy={isMobile ? verticalListSortingStrategy : rectSortingStrategy}
                    >
                        <div className={isMobile ? "space-y-3" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"}>
                            {sections.recommend.length === 0 && <p className="text-gray-500 text-sm p-4 text-center border border-dashed border-gray-700 rounded-xl">ลากเมนูมาที่นี่เพื่อแนะนำ</p>}
                            {sections.recommend.map(item => (
                                <SortableMenuItem 
                                    key={item.id} 
                                    item={item} 
                                    isMobile={isMobile} 
                                    onEdit={(i) => { setEditingItem(i); setFormData(i); setIsModalOpen(true); }}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </div>

                {/* Regular Menu by Category */}
                <div className="space-y-8">
                    {categories.map(cat => {
                        const items = sections.regular[cat.name] || [];
                        const isHomeCategory = activeItem && activeItem.category === cat.name;
                        const isHighlight = activeItem && activeItem.is_recommended && isHomeCategory;

                        return (
                            <div 
                                key={cat.name} 
                                id={`ctx-cat-${cat.name}`} /* PREFIXED ID */
                                className={`transition-all duration-300 rounded-3xl p-4 min-h-[150px] ${
                                    isHighlight 
                                    ? 'bg-white/5 border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]' 
                                    : activeItem && !isHomeCategory ? 'opacity-30 blur-[1px]' : '' 
                                }`}
                            >
                                <h2 className="text-xl font-bold text-white mb-4 pl-2 border-l-4 border-[#DFFF00]">{cat.name} {activeItem && isHomeCategory && <span className="text-xs text-[#DFFF00] font-normal ml-2">(Original Home)</span>}</h2>
                                <SortableContext 
                                    id={`ctx-cat-${cat.name}`} /* PREFIXED ID */
                                    items={items.map(i => String(i.id))} /* String IDs */
                                    strategy={isMobile ? verticalListSortingStrategy : rectSortingStrategy}
                                >
                                    <div className={isMobile ? "space-y-3" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"}>
                                        {items.length === 0 && <p className="text-gray-600 text-sm">ยังไม่มีรายการในหมวดนี้</p>}
                                        {items.map(item => (
                                            <SortableMenuItem 
                                                key={item.id} 
                                                item={item} 
                                                isMobile={isMobile} 
                                                onEdit={(i) => { setEditingItem(i); setFormData(i); setIsModalOpen(true); }}
                                                onDelete={handleDelete}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                            </div>
                        );
                    })}

                    {/* Uncategorized Section */}
                    {sections.uncategorized.length > 0 && (
                        <div 
                            id="ctx-uncategorized"
                            className="bg-red-500/5 border border-red-500/20 rounded-3xl p-4 min-h-[150px]"
                        >
                            <h2 className="text-xl font-bold text-red-400 mb-4 pl-2 border-l-4 border-red-500 flex items-center gap-2">
                                <HelpCircle size={20} /> Uncategorized / Mismatch
                            </h2>
                            <SortableContext 
                                id="ctx-uncategorized"
                                items={sections.uncategorized.map(i => String(i.id))}
                                strategy={isMobile ? verticalListSortingStrategy : rectSortingStrategy}
                            >
                                <div className={isMobile ? "space-y-3" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"}>
                                    {sections.uncategorized.map(item => (
                                        <SortableMenuItem 
                                            key={item.id} 
                                            item={item} 
                                            isMobile={isMobile} 
                                            onEdit={(i) => { setEditingItem(i); setFormData(i); setIsModalOpen(true); }}
                                            onDelete={handleDelete}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </div>
                    )}
                </div>

                {/* Drag Overlay */}
                <DragOverlay dropAnimation={dropAnimation}>
                    {activeId ? (
                         (() => {
                            const item = menuItems.find(i => String(i.id) === activeId);
                            return item ? (
                                <SortableMenuItem 
                                    item={item} 
                                    isMobile={isMobile} 
                                    onEdit={()=>{}} 
                                    onDelete={()=>{}} 
                                    isOverlay 
                                />
                            ) : null;
                        })()
                    ) : null}
                </DragOverlay>

                {/* Modal Form */}
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                        <div className="bg-[#1a1a1a] w-full max-w-md rounded-3xl p-8 border border-white/10 shadow-2xl relative">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-white">{editingItem ? 'แก้ไขเมนู' : 'สร้างเมนูใหม่'}</h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white"><X /></button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-400 ml-1">ชื่อเมนู</label>
                                    <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-black border border-white/10 rounded-xl p-3 text-white focus:border-[#DFFF00] outline-none transition-colors" />
                                </div>

                                <div className="flex gap-4">
                                    <div className="flex-1 space-y-1">
                                        <label className="text-xs text-gray-400 ml-1">ราคา</label>
                                        <input type="number" min="0" required value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} className="w-full bg-black border border-white/10 rounded-xl p-3 text-white focus:border-[#DFFF00] outline-none" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <label className="text-xs text-gray-400 ml-1">หมวดหมู่</label>
                                        <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full bg-black border border-white/10 rounded-xl p-3 text-white outline-none">
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                                            ))}
                                            <option value="Uncategorized">Other / Uncategorized</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs text-gray-400 ml-1">รูปภาพ</label>
                                    <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-gray-400 file:bg-gray-800 file:text-white file:border-0 file:rounded-lg file:mr-4 file:px-4 file:py-1" />
                                </div>
                                
                                <label className="flex items-center gap-3 p-3 bg-black rounded-xl border border-white/5 cursor-pointer hover:border-white/20">
                                    <input type="checkbox" checked={formData.is_recommended} onChange={e => setFormData({ ...formData, is_recommended: e.target.checked })} className="accent-[#DFFF00] w-5 h-5" />
                                    <span className="text-white flex items-center gap-2"><Star size={16} fill={formData.is_recommended ? "#DFFF00" : "transparent"}/> รายการแนะนำ (Recommend)</span>
                                </label>

                                <label className="flex items-center gap-3 p-3 bg-black rounded-xl border border-white/5 cursor-pointer hover:border-white/20">
                                    <input type="checkbox" checked={formData.is_available} onChange={e => setFormData({ ...formData, is_available: e.target.checked })} className="accent-[#DFFF00] w-5 h-5" />
                                    <span className="text-white">เปิดขายหน้าร้าน (Dine-in)</span>
                                </label>

                                <label className="flex items-center gap-3 p-3 bg-black rounded-xl border border-white/5 cursor-pointer hover:border-white/20">
                                    <input type="checkbox" checked={formData.is_pickup_available} onChange={e => setFormData({ ...formData, is_pickup_available: e.target.checked })} className="accent-[#DFFF00] w-5 h-5" />
                                    <span className="text-white">เปิดขายกลับบ้าน (Pickup)</span>
                                </label>

                                <button type="submit" className="w-full bg-[#DFFF00] hover:bg-[#cce600] text-black font-bold py-4 rounded-xl mt-4 transition-colors">
                                    บันทึกข้อมูล
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </DndContext>
    );
}
