import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { X, Save, Trash2, Camera, Upload, Scan } from 'lucide-react'; // Added Scan
import { toast } from 'sonner';
import BarcodeScanner from './BarcodeScanner'; // Import Scanner

export default function StockItemForm({ item, categories, onClose, onUpdate }) {
    const isEdit = !!item;
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false); // New state for API lookup
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
                name: item.name || '',
                category: item.category || 'veg',
                unit: item.unit || 'unit',
                current_quantity: item.current_quantity || 0,
                min_stock_threshold: item.min_stock_threshold || 0,
                reorder_point: item.reorder_point || 0,
                par_level: item.par_level || 0,
                image_url: item.image_url || '',
                barcode: item.barcode || ''
            });

        } else if (item && item.barcode && !item.id) {
             // Special case: Pre-filled from Main Scanner
             setFormData(prev => ({ ...prev, barcode: item.barcode }));
             // Trigger auto-lookup for the passed barcode
             fetchProductInfo(item.barcode);
        }
    }, [item]);

    // "AI" Smart Lookup (OpenFoodFacts)
    const fetchProductInfo = async (code) => {
        if (!code) return;
        setSearching(true);
        try {
            const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
            const data = await response.json();
            
            if (data.status === 1 && data.product) {
                const product = data.product;
                const name = product.product_name || product.product_name_en || product.product_name_th || '';
                const image = product.image_front_url || product.image_url || '';
                
                if (name) {
                    toast.success('✨ Standard Product Found!');
                    setFormData(prev => ({
                        ...prev,
                        name: prev.name || name, // Don't overwrite if user already typed? Actually auto-fill is better.
                        image_url: prev.image_url || image
                    }));
                }
            }
        } catch (err) {
            console.warn("Product lookup failed", err);
        } finally {
            setSearching(false);
        }
    };

    const items = [
        { label: 'Name', key: 'name', type: 'text' },
        { label: 'Category', key: 'category', type: 'select', options: categories.filter(c => c.id !== 'restock') },
        { label: 'Unit', key: 'unit', type: 'text' },
        { label: 'Current Qty', key: 'current_quantity', type: 'number' },
        { label: 'Min Level (Critical)', key: 'min_stock_threshold', type: 'number' },
        { label: 'Reorder Point (Warning)', key: 'reorder_point', type: 'number' },
        { label: 'Par Level (Full)', key: 'par_level', type: 'number' },
        { label: 'Barcode', key: 'barcode', type: 'text' },
        // Removed image_url, handled separately
    ];

    // Helper: Resize Image
    const resizeImage = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    const scaleSize = MAX_WIDTH / img.width;
                    const width = (img.width > MAX_WIDTH) ? MAX_WIDTH : img.width;
                    const height = (img.width > MAX_WIDTH) ? (img.height * scaleSize) : img.height;
                    
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    canvas.toBlob((blob) => {
                        resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                    }, 'image/jpeg', 0.8); // 80% quality
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setLoading(true);
            const resizedFile = await resizeImage(file);
            
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('stock-images')
                .upload(filePath, resizedFile);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('stock-images')
                .getPublicUrl(filePath);

            setFormData(prev => ({ ...prev, image_url: publicUrl }));
            toast.success('Image uploaded');
        } catch (error) {
            console.error('Upload error', error);
            toast.error('Failed to upload image');
        } finally {
            setLoading(false);
        }
    };

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
                                    value={formData[field.key] || ''}
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
                             
                             {/* Loading Indicator for Lookup */}
                             {field.key === 'name' && searching && (
                                 <div className="absolute right-2 top-8 p-2">
                                     <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                                 </div>
                             )}
                        </div>
                    ))}
                    
                    {/* Image Upload Section */}
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase">Product Image</label>
                        
                        <div className="flex items-center gap-4">
                            <div className="relative w-24 h-24 bg-gray-100 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
                                {formData.image_url ? (
                                    <img src={formData.image_url} className="w-full h-full object-cover" alt="Preview"/>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        <Camera className="w-8 h-8" />
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex-1">
                                <label className="flex items-center justify-center gap-2 w-full p-3 bg-gray-100 rounded-xl cursor-pointer hover:bg-gray-200 transition-colors border border-dashed border-gray-300">
                                    <Upload className="w-5 h-5 text-gray-600" />
                                    <span className="text-sm font-medium text-gray-600">
                                        {formData.image_url ? 'Change Photo' : 'Upload Photo'}
                                    </span>
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        onChange={handleImageUpload} 
                                        className="hidden" 
                                        capture="environment" /* Prefer rear camera on mobile */
                                    />
                                </label>
                                <p className="text-[10px] text-gray-400 mt-2">
                                    Auto-resized to 800px width.
                                </p>
                            </div>
                        </div>
                    </div>

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
                    onScan={async (scanResult) => {
                         setShowScanner(false);
                         
                         const code = scanResult.barcode || scanResult; // Handle object or string
                         const scannedData = typeof scanResult === 'object' ? scanResult : {};

                         // Check duplicate
                         const { data } = await supabase.from('stock_items').select('id, name').eq('barcode', code).single();
                         if (data) {
                             if (confirm(`Item '${data.name}' already exists with this barcode. Edit it instead?`)) {
                                 onClose(); 
                                 toast.warning(`Barcode already used by '${data.name}'`);
                             }
                         } else {
                             setFormData(prev => ({
                                 ...prev, 
                                 barcode: code,
                                 // Auto-fill from Scanner AI (if available and field is empty)
                                 name: (scannedData.name && !prev.name) ? scannedData.name : prev.name,
                                 image_url: (scannedData.image_url && !prev.image_url) ? scannedData.image_url : prev.image_url
                             }));
                             
                             if (scannedData.found) {
                                 toast.success(`Found: ${scannedData.name}`);
                             } else {
                                 toast.success('Barcode scanned');
                                 // Trigger legacy lookup if scanner didn't find it (fallback)
                                 fetchProductInfo(code);
                             }
                         }
                    }}
                    onClose={() => setShowScanner(false)}
                />
            )}
        </div>
    );
}
