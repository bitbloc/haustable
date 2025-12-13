import { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { Plus, Edit2, Trash2, X, Image as ImageIcon } from 'lucide-react';

export default function AdminMenu() {
    const [menuItems, setMenuItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null); // ถ้า null = เพิ่มใหม่
    const [formData, setFormData] = useState({ name: '', price: '', category: 'Main', is_available: true });
    const [imageFile, setImageFile] = useState(null);

    useEffect(() => { fetchMenu(); }, []);

    const fetchMenu = async () => {
        setLoading(true);
        const { data } = await supabase.from('menu_items').select('*').order('category').order('name');
        setMenuItems(data || []);
        setLoading(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            let imageUrl = editingItem?.image_url || '';

            // Upload รูป (ถ้ามีการเลือกไฟล์ใหม่)
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
                image_url: imageUrl
            };

            if (editingItem) {
                // Update
                await supabase.from('menu_items').update(payload).eq('id', editingItem.id);
            } else {
                // Create
                await supabase.from('menu_items').insert(payload);
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
        setFormData({ name: '', price: '', category: 'Main', is_available: true });
        setEditingItem(null);
        setImageFile(null);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Menu Management</h1>
                    <p className="text-gray-500">จัดการรายการอาหาร ราคา และสถานะ</p>
                </div>
                <button
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    className="bg-[#DFFF00] text-black px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:shadow-[0_0_20px_rgba(223,255,0,0.4)] transition-all"
                >
                    <Plus size={20} /> เพิ่มเมนูใหม่
                </button>
            </div>

            {/* Grid Layout แบบ Apple Card Style */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {menuItems.map(item => (
                    <div key={item.id} className="group bg-[#111] border border-white/5 rounded-2xl p-4 hover:border-white/20 transition-all flex gap-4 items-center relative overflow-hidden">
                        {/* Image */}
                        <div className="w-20 h-20 rounded-xl bg-gray-800 overflow-hidden shrink-0">
                            {item.image_url ? (
                                <img src={item.image_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-600"><ImageIcon /></div>
                            )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                                <span className="text-xs font-bold uppercase tracking-wider text-[#DFFF00] mb-1 block">{item.category}</span>
                                {!item.is_available && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">หมด</span>}
                            </div>
                            <h3 className="font-bold text-white truncate">{item.name}</h3>
                            <p className="text-gray-400">{item.price}.-</p>
                        </div>

                        {/* Actions (Hover to show) */}
                        <div className="absolute right-4 bottom-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0">
                            <button onClick={() => { setEditingItem(item); setFormData(item); setIsModalOpen(true); }} className="p-2 bg-gray-800 hover:bg-white hover:text-black text-white rounded-full transition-colors"><Edit2 size={14} /></button>
                            <button onClick={() => handleDelete(item.id)} className="p-2 bg-gray-800 hover:bg-red-500 text-white rounded-full transition-colors"><Trash2 size={14} /></button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal Form (Backdrop Blur) */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-[#1a1a1a] w-full max-w-md rounded-3xl p-8 border border-white/10 shadow-2xl animate-fade-in-up">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-white">{editingItem ? 'แก้ไขเมนู' : 'สร้างเมนูใหม่'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white"><X /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs text-gray-400 ml-1">ชื่อเมนู</label>
                                <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-black border border-white/10 rounded-xl p-3 text-white focus:border-[#DFFF00] outline-none transition-colors" placeholder="เช่น สปาเก็ตตี้" />
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
                                <input type="checkbox" checked={formData.is_available} onChange={e => setFormData({ ...formData, is_available: e.target.checked })} className="accent-[#DFFF00] w-5 h-5" />
                                <span className="text-white">เปิดขายเมนูนี้</span>
                            </label>

                            <button type="submit" className="w-full bg-[#DFFF00] hover:bg-[#cce600] text-black font-bold py-4 rounded-xl mt-4 transition-colors">
                                บันทึกข้อมูล
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
