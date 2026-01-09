import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { X, Save, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function CategoryManager({ onClose, onUpdate }) {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // New/Edit State
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ id: '', label: '', icon: '', sort_order: 0 });

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('stock_categories').select('*').order('sort_order');
        if (data) setCategories(data);
        setLoading(false);
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this category? Items in this category might disappear from filters.')) return;
        
        const { error } = await supabase.from('stock_categories').delete().eq('id', id);
        if (error) {
            toast.error('Failed to delete');
        } else {
            toast.success('Deleted');
            fetchCategories();
            onUpdate?.(); // Notify parent to refresh
        }
    };

    const handleSave = async () => {
        if (!formData.id || !formData.label) return;

        const { error } = await supabase.from('stock_categories').upsert(formData);
        
        if (error) {
            console.error(error);
            toast.error('Failed to save');
        } else {
            toast.success('Saved');
            setEditingId(null);
            setFormData({ id: '', label: '', icon: '', sort_order: 0 });
            fetchCategories();
            onUpdate?.();
        }
    };

    const startEdit = (cat) => {
        setEditingId(cat.id);
        setFormData(cat);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="font-bold text-lg">Manage Categories</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 bg-gray-50 border-b border-gray-100 grid gap-2">
                    <div className="grid grid-cols-4 gap-2">
                        <input 
                            placeholder="ID (veg)" 
                            value={formData.id}
                            onChange={e => setFormData({...formData, id: e.target.value})}
                            disabled={!!editingId} // ID immutable when editing existing? usually yes.
                            className="bg-white p-2 rounded-lg border text-sm"
                        />
                        <input 
                            placeholder="Icon (🥬)" 
                            value={formData.icon}
                            onChange={e => setFormData({...formData, icon: e.target.value})}
                            className="bg-white p-2 rounded-lg border text-sm"
                        />
                        <input 
                            placeholder="Label" 
                            value={formData.label}
                            onChange={e => setFormData({...formData, label: e.target.value})}
                            className="col-span-2 bg-white p-2 rounded-lg border text-sm"
                        />
                    </div>
                    <button 
                        onClick={handleSave}
                        className="w-full bg-[#1A1A1A] text-white py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:bg-black"
                    >
                        {editingId ? <><Save className="w-4 h-4"/> Update</> : <><Plus className="w-4 h-4"/> Add Category</>}
                    </button>
                    {editingId && (
                        <button onClick={() => { setEditingId(null); setFormData({ id: '', label: '', icon: '', sort_order: 0 }); }} className="text-xs text-gray-500 underline">
                            Cancel Edit
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {categories.map(cat => (
                        <div key={cat.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl mb-2">
                             <div className="flex items-center gap-3">
                                 <span className="text-2xl">{cat.icon}</span>
                                 <div>
                                     <div className="font-bold text-sm">{cat.label}</div>
                                     <div className="text-xs text-gray-400 font-mono">{cat.id}</div>
                                 </div>
                             </div>
                             <div className="flex gap-1">
                                 <button onClick={() => startEdit(cat)} className="p-2 hover:bg-gray-100 rounded-lg text-blue-600">Edit</button>
                                 {cat.id !== 'restock' && (
                                     <button onClick={() => handleDelete(cat.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-600">
                                         <Trash2 className="w-4 h-4" />
                                     </button>
                                 )}
                             </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
