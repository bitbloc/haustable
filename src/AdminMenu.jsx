import { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { Plus, X, Star } from 'lucide-react';
import {
    DndContext,
    closestCenter,
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
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({ name: '', price: '', category: 'Main', is_available: true, is_pickup_available: true, is_recommended: false });
    const [imageFile, setImageFile] = useState(null);
    const [activeId, setActiveId] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        fetchMenu();
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchMenu = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('menu_items')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false }); // Fallback
        setMenuItems(data || []);
        setLoading(false);
    };

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Prevent accidental drags
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event) => {
        setActiveId(event.active.id);
    };

    const onDragOver = (event) => {
        const { active, over } = event;
        if (!over) return;
        if (active.id === over.id) return;
        
        // Strategy: We visualize items in two groups (VIP and Regular)
        // But we treat them as one flat list in state to simplify "moving between groups".
        // The VISUAL grouping is derived from `item.is_recommended`.
        // If we drag a Regular item into the VIP list, we need to anticipate the switch.
        
        // However, dnd-kit's SortableContext requires the items passed to it to match what's in the DOM.
        // So we strictly use two SortableContexts.
        
        // To allow moving between them, we need to update the state during DragOver.
        // We check if the active item is moving into a different group.
        
        const activeItem = menuItems.find(i => i.id === active.id);
        const overItem = menuItems.find(i => i.id === over.id);
        
        if (!activeItem || !overItem) return;
        
        // Using "is_recommended" as the Group Identifier
        if (activeItem.is_recommended !== overItem.is_recommended) {
            setMenuItems((items) => {
                const activeIndex = items.findIndex(i => i.id === active.id);
                const overIndex = items.findIndex(i => i.id === over.id);
                
                if (activeIndex === -1 || overIndex === -1) return items;
                
                // Copy
                const newItems = [...items];
                // Remove active
                const [movedItem] = newItems.splice(activeIndex, 1);
                // Update its group
                movedItem.is_recommended = overItem.is_recommended;
                
                // Insert at new position
                // Note: Index calculation is tricky when groups are mixed in the flat array?
                // Actually, if we use a sort strategy, they might be scattered. 
                // BUT fetchMenu orders them. 
                // We should ensure the list remains sorted by Group? 
                
                // Simplified approach for DragOver: Just Insert.
                // The SortableContexts will re-render with the new group membership.
                newItems.splice(overIndex, 0, movedItem);
                
                return newItems;
            });
        }
    };

    const handleDragEnd = async (event) => {
        const { active, over } = event;
        setActiveId(null);
        if (!over) return;

        // If simple reorder within same group (or cross-group already handled by DragOver)
        if (active.id !== over.id) {
            setMenuItems((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
            
            // We need to persist the *current state*.
            // Wait for state update? No, use local calc.
             const oldIndex = menuItems.findIndex((item) => item.id === active.id);
             const newIndex = menuItems.findIndex((item) => item.id === over.id);
             
             let finalItems = menuItems;
             if (oldIndex !== -1 && newIndex !== -1) {
                 finalItems = arrayMove(menuItems, oldIndex, newIndex);
             }
             
             // Update logic:
             // We need to ensure their recommended status is saved too (if DragOver changed it).
             // And their new sort_order.
             const updates = finalItems.map((item, index) => ({
                id: item.id,
                sort_order: index,
                is_recommended: item.is_recommended
            }));
            
            await supabase.from('menu_items').upsert(updates);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
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
                price: parseFloat(formData.price),
                category: formData.category,
                is_available: formData.is_available,
                is_pickup_available: formData.is_pickup_available,
                is_recommended: formData.is_recommended,
                image_url: imageUrl
            };

            if (editingItem) {
                await supabase.from('menu_items').update(payload).eq('id', editingItem.id);
            } else {
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
        setFormData({ name: '', price: '', category: 'Main', is_available: true, is_pickup_available: true, is_recommended: false });
        setEditingItem(null);
        setImageFile(null);
    };

    const vipItems = menuItems.filter(i => i.is_recommended);
    const regularItems = menuItems.filter(i => !i.is_recommended);
    const vipIds = vipItems.map(i => i.id);
    const regularIds = regularItems.map(i => i.id);

    return (
        <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={onDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="pb-20">
                <div className="flex justify-between items-center mb-8 sticky top-0 bg-[#09090b] z-40 py-4 border-b border-white/5">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Menu Management</h1>
                        <p className="text-gray-500 hidden md:block">Drag & Drop เพื่อจัดเรียง • แยก VIP Lane และรายการทั่วไป</p>
                    </div>
                    <button
                        onClick={() => { resetForm(); setIsModalOpen(true); }}
                        className="bg-[#DFFF00] text-black px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:shadow-[0_0_20px_rgba(223,255,0,0.4)] transition-all"
                    >
                        <Plus size={20} /> <span className="hidden md:inline">เพิ่มเมนูใหม่</span>
                    </button>
                </div>

                {/* VIP Lane */}
                <div className="mb-10 p-4 border border-[#DFFF00]/20 rounded-3xl bg-[#DFFF00]/5">
                     <div className="flex items-center gap-2 mb-4 text-[#DFFF00]">
                        <Star fill="#DFFF00" size={20} />
                        <h2 className="text-xl font-bold uppercase tracking-wider">VIP Lane (Recommended)</h2>
                    </div>
                    <SortableContext 
                        items={vipIds} 
                        strategy={isMobile ? verticalListSortingStrategy : rectSortingStrategy}
                    >
                        <div className={isMobile ? "space-y-3" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"}>
                            {vipItems.length === 0 && <p className="text-gray-500 text-sm">ลากเมนูมาที่นี่เพื่อแนะนำ</p>}
                            {vipItems.map(item => (
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

                {/* Regular Menu */}
                 <div className="mb-4">
                    <h2 className="text-xl font-bold text-white mb-4">All Menu</h2>
                    <SortableContext 
                        items={regularIds} 
                        strategy={isMobile ? verticalListSortingStrategy : rectSortingStrategy}
                    >
                        <div className={isMobile ? "space-y-3" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"}>
                            {regularItems.map(item => (
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

                {/* Drag Overlay */}
                <DragOverlay dropAnimation={dropAnimation}>
                    {activeId ? (
                         (() => {
                            const item = menuItems.find(i => i.id === activeId);
                            return item ? (
                                <SortableMenuItem 
                                    item={item} 
                                    isMobile={isMobile} 
                                    onEdit={()=>{}} 
                                    onDelete={()=>{}} 
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
                                        <input type="number" required value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} className="w-full bg-black border border-white/10 rounded-xl p-3 text-white focus:border-[#DFFF00] outline-none" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <label className="text-xs text-gray-400 ml-1">หมวดหมู่</label>
                                        <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full bg-black border border-white/10 rounded-xl p-3 text-white outline-none">
                                            <option value="Main">Main Course</option>
                                            <option value="Appetizer">Appetizer</option>
                                            <option value="Drink">Drink</option>
                                            <option value="Dessert">Dessert</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs text-gray-400 ml-1">รูปภาพ</label>
                                    <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-gray-400 file:bg-gray-800 file:text-white file:border-0 file:rounded-lg file:mr-4 file:px-4 file:py-1" />
                                </div>
                                
                                <label className="flex items-center gap-3 p-3 bg-black rounded-xl border border-white/5 cursor-pointer hover:border-white/20">
                                    <input type="checkbox" checked={formData.is_recommended} onChange={e => setFormData({ ...formData, is_recommended: e.target.checked })} className="accent-[#DFFF00] w-5 h-5" />
                                    <span className="text-white flex items-center gap-2"><Star size={16} fill={formData.is_recommended ? "#DFFF00" : "transparent"}/> รายการแนะนำ (VIP Lane)</span>
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
