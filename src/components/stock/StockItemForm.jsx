import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { X, Save, Trash2, Camera, Upload, Scan } from 'lucide-react'; // Added Scan
import { toast } from 'sonner';
import BarcodeScanner from './BarcodeScanner'; // Import Scanner

export default function StockItemForm({ item, categories, onClose, onUpdate }) {
    const isEdit = !!item;
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        category: 'veg',
        unit: 'unit',
        current_quantity: 0,
        min_stock_threshold: 0,
        reorder_point: 0,
        par_level: 0,
        image_url: '',
        barcode: ''
    });
    
    const [showScanner, setShowScanner] = useState(false); // Added

    useEffect(() => {
        if (item) {
            setFormData({
                name: item.name,
                category: item.category,
                unit: item.unit,
                current_quantity: item.current_quantity,
                min_stock_threshold: item.min_stock_threshold,
                reorder_point: item.reorder_point,
                par_level: item.par_level,
                image_url: item.image_url || '',
                barcode: item.barcode || ''
            });
        } else if (item && item.barcode && !item.id) {
             // Special case: Pre-filled from Main Scanner
             setFormData(prev => ({ ...prev, barcode: item.barcode }));
        }
    }, [item]);

    const items = [
        { label: 'Name', key: 'name', type: 'text' },
        { label: 'Category', key: 'category', type: 'select', options: categories.filter(c => c.id !== 'restock') },
        { label: 'Unit', key: 'unit', type: 'text' },
        { label: 'Current Qty', key: 'current_quantity', type: 'number' },
        { label: 'Min Level (Critical)', key: 'min_stock_threshold', type: 'number' },
        { label: 'Reorder Point (Warning)', key: 'reorder_point', type: 'number' },
        { label: 'Par Level (Full)', key: 'par_level', type: 'number' },
        { label: 'Barcode', key: 'barcode', type: 'text' },
        { label: 'Image URL', key: 'image_url', type: 'text' },
    ];

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this item?')) return;
        setLoading(true);
        try {
            const { error } = await supabase.from('stock_items').delete().eq('id', item.id);
            if (error) throw error;
            toast.success('Item deleted');
            onUpdate();
            onClose();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const payload = { ...formData };
            let error;
            
            if (isEdit) {
                 const { error: err } = await supabase.from('stock_items').update(payload).eq('id', item.id);
                 error = err;
            } else {
                 const { error: err } = await supabase.from('stock_items').insert(payload);
                 error = err;
            }

            if (error) throw error;
            
            toast.success(isEdit ? 'Updated successfully' : 'Created successfully');
            onUpdate();
            onClose();
        } catch (e) {
            console.error(e);
            toast.error('Failed to save');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                    <h2 className="font-bold text-lg">{isEdit ? 'Edit Item' : 'New Stock Item'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {items.map((field) => (
                        <div key={field.key} className="relative">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{field.label}</label>
                            {field.type === 'select' ? (
                                <select 
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#1A1A1A]"
                                    value={formData[field.key]}
                                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                                >
                                    {field.options.map(opt => (
                                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                                    ))}
                                </select>
                            ) : (
                                <input 
                                    type={field.type}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#1A1A1A]"
                                    value={formData[field.key]}
                                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                                />
                            )}
                             {/* Scan Button for Barcode Field */}
                             {field.key === 'barcode' && (
                                <button
                                    onClick={() => setShowScanner(true)}
                                    className="absolute right-2 top-8 p-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                                >
                                    <Scan className="w-4 h-4 text-gray-700" />
                                </button>
                             )}
                        </div>
                    ))}
                    
                    {/* Image Preview Helper (Simple) */}
                    {formData.image_url && (
                        <div className="mt-2 h-32 rounded-xl overflow-hidden border">
                            <img src={formData.image_url} className="w-full h-full object-cover" alt="Preview"/>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 flex gap-2">
                    {isEdit && (
                        <button 
                            onClick={handleDelete}
                            className="bg-red-50 text-red-600 p-4 rounded-xl font-bold hover:bg-red-100 transition-colors"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )}
                    <button 
                        onClick={handleSave}
                        disabled={loading}
                        className="flex-1 bg-[#1A1A1A] text-white p-4 rounded-xl font-bold hover:bg-black transition-colors flex items-center justify-center gap-2"
                    >
                        {loading ? 'Saving...' : <><Save className="w-5 h-5" /> Save Item</>}
                    </button>
                </div>
            </div>
            
            {showScanner && (
                <BarcodeScanner
                    onScan={async (code) => {
                         setShowScanner(false);
                         
                         // Check duplicate
                         const { data } = await supabase.from('stock_items').select('id, name').eq('barcode', code).single();
                         if (data) {
                             if (confirm(`Item '${data.name}' already exists with this barcode. Edit it instead?`)) {
                                 onClose(); // Close this form
                                 // Trigger update? No, we need to switch context.
                                 // This is tricky. simpler to just warn.
                                 toast.warning(`Barcode already used by '${data.name}'`);
                             }
                         } else {
                             setFormData(prev => ({...prev, barcode: code}));
                             toast.success('Barcode scanned');
                         }
                    }}
                    onClose={() => setShowScanner(false)}
                />
            )}
        </div>
    );
}
