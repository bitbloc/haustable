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
    const [activeItem, setActiveItem] = useState(null); // Track the actual item object for validation
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
            .order('created_at', { ascending: false });
        setMenuItems(data || []);
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

    // Group items logic
    const sections = {
        recommend: menuItems.filter(i => i.is_recommended),
        regular: menuItems
            .filter(i => !i.is_recommended)
            .reduce((acc, item) => {
                 if (!acc[item.category]) acc[item.category] = [];
                 acc[item.category].push(item);
                 return acc;
            }, {})
    };

    const categories = Object.keys(sections.regular).sort(); 

    const handleDragStart = (event) => {
        const { active } = event;
        setActiveId(active.id);
        const item = menuItems.find(i => i.id === active.id);
        setActiveItem(item);
    };

    const handleDragOver = (event) => {
        const { active, over } = event;
        if (!over) return;
        if (active.id === over.id) return;

        const activeItemLocal = menuItems.find(i => i.id === active.id);
        const overItemLocal = menuItems.find(i => i.id === over.id);
        
        if (!activeItemLocal) return;

        let targetGroup = null;
        if (overItemLocal) {
            targetGroup = overItemLocal.is_recommended ? 'recommend' : overItemLocal.category;
        } else {
             if (over.id === 'container-recommend') targetGroup = 'recommend';
             else if (over.id.startsWith('container-')) targetGroup = over.id.replace('container-', '');
        }
        
        if (!targetGroup) return;

        const currentGroup = activeItemLocal.is_recommended ? 'recommend' : activeItemLocal.category;
        const sourceCategory = activeItemLocal.category;

        if (targetGroup !== 'recommend' && targetGroup !== sourceCategory) {
            return;
        }

        const isTargetRecommend = targetGroup === 'recommend';
        
        if (activeItemLocal.is_recommended !== isTargetRecommend) {
             setMenuItems(prev => {
                 const newItems = [...prev];
                 const index = newItems.findIndex(i => i.id === active.id);
                 if (index !== -1) {
                     newItems[index] = { ...newItems[index], is_recommended: isTargetRecommend };
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
        
        const item = menuItems.find(i => i.id === active.id);
        if (!item) return;

        let targetGroup = null;
        const overItemLocal = menuItems.find(i => i.id === over.id);
        if (overItemLocal) {
            targetGroup = overItemLocal.is_recommended ? 'recommend' : overItemLocal.category;
        } else if (over.id.startsWith('container-')) {
            targetGroup = over.id === 'container-recommend' ? 'recommend' : over.id.replace('container-', '');
        }

        if (!targetGroup) return;

        if (targetGroup !== 'recommend' && targetGroup !== item.category) {
            return;
        }

        if (active.id !== over.id) {
             setMenuItems((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
            
             const oldIndex = menuItems.findIndex((i) => i.id === active.id);
             const newIndex = menuItems.findIndex((i) => i.id === over.id);
             let finalItems = menuItems;
             if (oldIndex !== -1 && newIndex !== -1) {
                 finalItems = arrayMove(menuItems, oldIndex, newIndex);
             }
             
            const updates = finalItems.map((i, index) => ({
                id: i.id,
                sort_order: index,
                is_recommended: i.is_recommended
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

    return (
        <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="pb-20">
                <div className="flex justify-between items-center mb-8 sticky top-0 bg-[#09090b] z-40 py-4 border-b border-white/5">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Menu Management</h1>
                        <p className="text-gray-500 hidden md:block">Drag & Drop เพื่อจัดเรียง • แยก Recommend และรายการตามหมวดหมู่</p>
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
                    id="container-recommend"
                    className={`mb-10 p-4 border rounded-3xl transition-colors duration-300 min-h-[150px] ${
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
                        id="recommend"
                        items={sections.recommend.map(i => i.id)}
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
                        const items = sections.regular[cat] || [];
                        const isHomeCategory = activeItem && activeItem.category === cat;
                        const isHighlight = activeItem && activeItem.is_recommended && isHomeCategory;

                        return (
                            <div 
                                key={cat} 
                                id={`container-${cat}`}
                                className={`transition-all duration-300 rounded-3xl p-4 min-h-[150px] ${
                                    isHighlight 
                                    ? 'bg-white/5 border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]' 
                                    : activeItem && !isHomeCategory ? 'opacity-30 blur-[1px]' : '' 
                                }`}
                            >
                                <h2 className="text-xl font-bold text-white mb-4 pl-2 border-l-4 border-[#DFFF00]">{cat} {activeItem && isHomeCategory && <span className="text-xs text-[#DFFF00] font-normal ml-2">(Original Home)</span>}</h2>
                                <SortableContext 
                                    id={cat}
                                    items={items.map(i => i.id)}
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
