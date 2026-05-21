import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { X, Save, Trash2, Camera, Upload, Scan, Calculator, DollarSign, Scale, Percent, AlertTriangle, Search, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import BarcodeScanner from './BarcodeScanner';
import { THAI_UNITS, suggestConversionFactor, getUnitType, areUnitTypesCompatible } from '../../utils/unitUtils';
import { calculateRealUnitCost } from '../../utils/costUtils';

export default function StockItemForm({ item, categories, onClose, onUpdate }) {
    const isEdit = !!item;
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    
    // Tab State: 'basic' | 'costing'
    const [activeTab, setActiveTab] = useState('basic');

    const [formData, setFormData] = useState({
        name: '',
        category: 'veg',
        current_quantity: 0,
        min_stock_threshold: 0,
        reorder_point: item?.reorder_point || 0,
        par_level: item?.par_level || 0,
        image_url: '',
        barcode: '',
        makro_id: item?.makro_id || '',
        makro_sku: item?.makro_sku || '',
        
        // Costing Fields
        cost_price: 0,      // Price per Pack
        pack_size: 1,       // Qty per Pack
        pack_unit: item?.pack_unit || 'unit',    // Unit bought/counted
        usage_unit: item?.usage_unit || 'unit',    // Unit used in recipe
        conversion_factor: item?.conversion_factor || 1, // 1 pack_unit = X usage_unit
        yield_percent: 100, // Usable %
        is_base_recipe: false
    });
    
    const [showScanner, setShowScanner] = useState(false);

    useEffect(() => {
        if (item) {
            setFormData({
                name: item.name || '',
                category: item.category || 'veg',
                current_quantity: item.current_quantity || 0,
                min_stock_threshold: item.min_stock_threshold || 0,
                reorder_point: item.reorder_point || 0,
                par_level: item.par_level || 0,
                image_url: item.image_url || '',
                barcode: item.barcode || '',
                makro_id: item.makro_id || '',
                makro_sku: item.makro_sku || '',
                
                cost_price: item.cost_price || 0,
                pack_size: item.pack_size || 1,
                pack_unit: item.pack_unit || 'unit',
                usage_unit: item.usage_unit || item.unit || 'unit', // migration fallback
                conversion_factor: item.conversion_factor || 1,
                yield_percent: item.yield_percent || 100,
                is_base_recipe: item.is_base_recipe || false
            });
        }
    }, [item]);

    // Auto-Calculate Conversion Factor when Units Change
    const handleUnitChange = (type, value) => {
        const newData = { ...formData, [type]: value };
        
        // Suggest Factor if either unit changed
        if (type === 'pack_unit' || type === 'usage_unit') {
            const factor = suggestConversionFactor(newData.pack_unit, newData.usage_unit);
            newData.conversion_factor = factor !== null ? factor : '';
        }
        
        setFormData(newData);
    };

    const realCost = calculateRealUnitCost(formData);

    const handleSave = async () => {
        // Enforce validations
        if (!formData.name || !formData.name.trim()) {
            toast.error('กรุณากรอกชื่อสินค้าวัตถุดิบ');
            return;
        }
        if (parseFloat(formData.cost_price) < 0) {
            toast.error('ราคาต้นทุนต้องไม่ต่ำกว่า 0 บาท');
            return;
        }
        if (!formData.pack_size || parseFloat(formData.pack_size) <= 0) {
            toast.error('ปริมาณขนาดบรรจุภัณฑ์ (Pack Size) ต้องมากกว่า 0');
            return;
        }
        
        // Check unit compatibility
        const isCompatible = areUnitTypesCompatible(formData.pack_unit, formData.usage_unit);
        const conversionFactorVal = parseFloat(formData.conversion_factor);
        if (!isCompatible) {
            if (formData.conversion_factor === '' || formData.conversion_factor === null || isNaN(conversionFactorVal) || conversionFactorVal <= 0) {
                toast.error('กรุณาระบุตัวแปลงหน่วยสำหรับการแปลงหน่วยข้ามประเภท (ต้องมากกว่า 0)');
                return;
            }
        } else {
            if (isNaN(conversionFactorVal) || conversionFactorVal <= 0) {
                toast.error('ตัวแปลงหน่วยต้องมีค่ามากกว่า 0');
                return;
            }
        }
        
        if (parseFloat(formData.yield_percent) < 1 || parseFloat(formData.yield_percent) > 100) {
            toast.error('Yield % ต้องอยู่ระหว่าง 1 ถึง 100%');
            return;
        }
        if (parseFloat(formData.min_stock_threshold) < 0 || parseFloat(formData.reorder_point) < 0 || parseFloat(formData.par_level) < 0) {
            toast.error('จำนวนสต็อกสำหรับระดับแจ้งเตือนต้องไม่ต่ำกว่า 0');
            return;
        }

        setLoading(true);
        try {
            const payload = { 
                ...formData,
                unit: formData.pack_unit, // FIX: Standardize on Purchase (Pack) Unit for counting and reordering
                barcode: formData.barcode ? formData.barcode.trim() : null
            };
            
            let error;
            if (isEdit) {
                 // Prevent Stale Update: Strip current_quantity from update payload
                 delete payload.current_quantity;
                 const { error: err } = await supabase.from('stock_items').update(payload).eq('id', item.id);
                 error = err;
            } else {
                 // Create item with current_quantity: 0 first
                 const initialQty = payload.current_quantity || 0;
                 const { data: newItem, error: err } = await supabase
                     .from('stock_items')
                     .insert({ ...payload, current_quantity: 0 })
                     .select()
                     .single();
                 
                 error = err;
                 
                 // If successful and initialQty > 0, write audit transaction to sync
                 if (!err && newItem && initialQty > 0) {
                     const { error: txError } = await supabase
                         .from('stock_transactions')
                         .insert({
                             stock_item_id: newItem.id,
                             transaction_type: 'audit',
                             quantity_change: initialQty,
                             performed_by: 'System (Initial Stock)',
                             note: 'จำนวนสต็อกเริ่มต้นเมื่อสร้างสินค้าวัตถุดิบ'
                         });
                     if (txError) {
                         console.error("Initial transaction insert failed:", txError);
                         toast.error('สร้างวัตถุดิบสำเร็จ แต่บันทึกสต็อกเริ่มต้นลงประวัติล้มเหลว');
                     }
                 }
            }

            if (error) throw error;
            toast.success(isEdit ? 'บันทึกเรียบร้อย' : 'สร้างรายการเรียบร้อย');
            onUpdate();
            onClose();
        } catch (e) {
            console.error(e);
            toast.error('Failed to save: ' + e.message);
        } finally {
            setLoading(false);
        }
    };
    
    // --- Makro Search Modal State & Handlers ---
    const [showMakroSearch, setShowMakroSearch] = useState(false);
    const [makroSearchTerm, setMakroSearchTerm] = useState('');
    const [makroResults, setMakroResults] = useState([]);
    const [searchingMakro, setSearchingMakro] = useState(false);

    const handleSearchMakro = async (e) => {
        e.preventDefault();
        if (!makroSearchTerm.trim()) return;
        
        setSearchingMakro(true);
        try {
            const { data, error } = await supabase.functions.invoke('makro-api', {
                body: { keyword: makroSearchTerm, page: 1, limit: 10 }
            });
            if (error) throw error;
            if (data.error) throw new Error(data.error);
            setMakroResults(data.products || []);
            if (!data.products || data.products.length === 0) {
                toast.info('ไม่พบสินค้าใน Makro');
            }
        } catch (err) {
            console.error('Makro search error:', err);
            toast.error('ค้นหา Makro ไม่สำเร็จ: ' + err.message);
        } finally {
            setSearchingMakro(false);
        }
    };

    const handleSelectMakroProduct = (product) => {
        setFormData({
            ...formData,
            name: product.brand ? `${product.brand} ${product.title}` : product.title,
            cost_price: parseFloat(product.current_price) || 0,
            pack_size: parseFloat(product.unit_count) || 1,
            makro_id: product.id,
            makro_sku: product.sku
        });
        toast.success(`ดึงข้อมูล ${product.title} เรียบร้อยแล้ว แนะนำให้ตรวจสอบ "หน่วยซื้อ" และ "หน่วยใช้" อีกครั้ง`);
        setShowMakroSearch(false);
    };

    // ... (Image handling same as before)
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
                    }, 'image/jpeg', 0.8);
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
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.jpg`;
            const { error: uploadError } = await supabase.storage.from('stock-images').upload(fileName, resizedFile);
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from('stock-images').getPublicUrl(fileName);
            setFormData(prev => ({ ...prev, image_url: publicUrl }));
            toast.success('อัพโหลดรูปสำเร็จ');
        } catch (error) {
            console.error('Upload error', error);
            toast.error('อัพโหลดรูปไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                    <h2 className="font-bold text-lg">{isEdit ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200">
                    <button 
                        onClick={() => setActiveTab('basic')}
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'basic' ? 'border-[#1A1A1A] text-[#1A1A1A]' : 'border-transparent text-gray-400'}`}
                    >
                        📦 ข้อมูลทั่วไป
                    </button>
                    <button 
                        onClick={() => setActiveTab('costing')}
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'costing' ? 'border-[#DFFF00] text-black bg-[#DFFF00]/10' : 'border-transparent text-gray-400'}`}
                    >
                        💰 ต้นทุน & หน่วย
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    
                    {/* Unit Mismatch Warning */}
                    {formData.unit && formData.pack_unit && formData.unit !== formData.pack_unit && (
                        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-xl flex gap-3 items-start animate-in slide-in-from-top-2">
                             <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                             <div className="flex-1">
                                 <div className="text-sm font-bold text-yellow-800">พบหน่วยไม่ตรงกัน (Unit Mismatch)</div>
                                 <p className="text-xs text-yellow-700 mb-2">
                                     ปัจจุบันหน่วยนับคือ <span className="font-bold underline">{formData.unit}</span> แต่หน่วยซื้อคือ <span className="font-bold underline">{formData.pack_unit}</span> 
                                     ซึ่งอาจทำให้การแจ้งเตือน "จุดสั่งซื้อ" ผิดพลาดได้
                                 </p>
                                 <button 
                                    onClick={() => setFormData({ ...formData, unit: formData.pack_unit })}
                                    className="text-[10px] bg-yellow-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-yellow-700 transition-colors"
                                 >
                                     ปรับหน่วยนับให้เป็น "{formData.pack_unit}" ตามหน่วยซื้อ
                                 </button>
                             </div>
                        </div>
                    )}

                    {/* Basic Info Tab */}
                    {activeTab === 'basic' && (
                        <>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase flex justify-between">
                                    <span>ชื่อสินค้า</span>
                                    {formData.makro_id && (
                                        <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded flex items-center gap-1">
                                            <ShoppingCart className="w-3 h-3" /> เชื่อมกับ Makro แล้ว
                                        </span>
                                    )}
                                </label>
                                <div className="flex gap-2">
                                    <input 
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#1A1A1A]" 
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="เช่น มะนาวแป้น, น้ำเชื่อมมิตรผล"
                                    />
                                    <button 
                                        onClick={() => setShowMakroSearch(true)}
                                        className="bg-[#DFFF00] text-black px-4 rounded-xl font-bold border border-[#DFFF00] hover:bg-yellow-400 transition-colors flex items-center gap-2 whitespace-nowrap"
                                        title="ค้นหาสินค้าจาก Makro เพื่อดึงราคาและขนาด"
                                    >
                                        <Search className="w-4 h-4" /> Makro
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-1 space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">หมวดหมู่</label>
                                    <select 
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none"
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        {categories.filter(c => c.id !== 'restock').map(c => (
                                            <option key={c.id} value={c.id}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex-1 space-y-1 relative">
                                    <label className="text-xs font-bold text-gray-500 uppercase">บาร์โค้ด</label>
                                    <input 
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none" 
                                        value={formData.barcode}
                                        onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                                    />
                                    <button onClick={() => setShowScanner(true)} className="absolute right-2 top-8 p-1.5 bg-gray-200 rounded-lg">
                                        <Scan className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            
                            {/* Inventory Levels Grid */}
                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase">จำนวนคงเหลือปัจจุบัน</label>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number"
                                            disabled={isEdit}
                                            className={`w-full border border-gray-200 rounded-xl p-3 outline-none text-lg font-bold ${isEdit ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50'}`} 
                                            value={formData.current_quantity}
                                            onChange={e => setFormData({ 
                                                ...formData, 
                                                current_quantity: e.target.value === '' ? 0 : parseFloat(e.target.value) 
                                            })}
                                        />
                                        <span className="text-sm text-gray-400">{formData.pack_unit}</span>
                                    </div>
                                    {isEdit && (
                                        <div className="text-[10px] text-gray-500 mt-1">
                                            * แก้ไขจำนวนได้ที่ปุ่มปรับปรุงสต็อก (รับเข้า/เบิกออก) หน้าแรกเท่านั้น เพื่อความถูกต้องของประวัติ
                                        </div>
                                    )}
                                </div>
                                
                                <div>
                                    <label className="text-xs font-bold text-red-500 uppercase flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" /> จุดวิกฤต (Critical)
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number"
                                            className="w-full bg-red-50 border border-red-200 rounded-xl p-3 outline-none font-bold text-red-700" 
                                            value={formData.min_stock_threshold}
                                            onChange={e => setFormData({ 
                                                ...formData, 
                                                min_stock_threshold: e.target.value === '' ? 0 : parseFloat(e.target.value) 
                                            })}
                                        />
                                        <span className="text-sm text-gray-400">{formData.pack_unit}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-orange-500 uppercase">จุดสั่งซื้อ (Reorder)</label>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number"
                                            className="w-full bg-orange-50 border border-orange-200 rounded-xl p-3 outline-none font-bold text-orange-700" 
                                            value={formData.reorder_point}
                                            onChange={e => setFormData({ 
                                                ...formData, 
                                                reorder_point: e.target.value === '' ? 0 : parseFloat(e.target.value) 
                                            })}
                                        />
                                        <span className="text-sm text-gray-400">{formData.pack_unit}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase">เป้าหมาย (Par Level)</label>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number"
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none" 
                                            value={formData.par_level}
                                            onChange={e => setFormData({ 
                                                ...formData, 
                                                par_level: e.target.value === '' ? 0 : parseFloat(e.target.value) 
                                            })}
                                        />
                                        <span className="text-sm text-gray-400">{formData.pack_unit}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Image */}
                            <div className="pt-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">รูปสินค้า</label>
                                <div className="flex items-center gap-4">
                                    <div className="w-20 h-20 bg-gray-100 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
                                        {formData.image_url ? (
                                            <img src={formData.image_url} className="w-full h-full object-cover" alt="Preview"/>
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400"><Camera className="w-6 h-6" /></div>
                                        )}
                                    </div>
                                    <label className="flex-1 cursor-pointer">
                                        <div className="flex items-center justify-center gap-2 p-3 bg-white border border-dashed border-gray-300 rounded-xl hover:bg-gray-50">
                                            <Upload className="w-4 h-4 text-gray-600" />
                                            <span className="text-sm">อัพโหลดรูปใหม่</span>
                                        </div>
                                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                    </label>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Costing Tab */}
                    {activeTab === 'costing' && (
                        <div className="space-y-6">
                            {!areUnitTypesCompatible(formData.pack_unit, formData.usage_unit) && (
                                <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex gap-3 items-start animate-in slide-in-from-top-2">
                                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <div className="text-sm font-bold text-red-800">คำเตือน: การแปลงหน่วยข้ามประเภท</div>
                                        <p className="text-xs text-red-700">
                                            หน่วยซื้อ ({formData.pack_unit}) และหน่วยใช้จริง ({formData.usage_unit}) เป็นคนละประเภทกัน (เช่น น้ำหนักกับปริมาตร) 
                                            จำเป็นต้องระบุตัวแปลงหน่วย (Conversion Factor) ตามน้ำหนักจริงหรือความหนาแน่น ห้ามใช้ค่าเริ่มต้นเป็น 1 หากไม่ใช่สัดส่วน 1:1 จริง
                                        </p>
                                    </div>
                                </div>
                            )}
                            
                            {/* 1. Buying Info */}
                            <div className="bg-blue-50 p-4 rounded-xl space-y-3 border border-blue-100">
                                <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2">
                                    <DollarSign className="w-4 h-4" /> 1. ข้อมูลการซื้อ (Buying) & ประเภท
                                </h3>
                                <div className="mb-3 p-3 bg-white rounded-lg border border-blue-200 flex items-center gap-3">
                                    <input 
                                        type="checkbox" 
                                        id="isBase"
                                        className="w-5 h-5 accent-blue-600"
                                        checked={formData.is_base_recipe}
                                        onChange={e => setFormData({ ...formData, is_base_recipe: e.target.checked })}
                                    />
                                    <label htmlFor="isBase" className="text-sm font-bold text-gray-700">
                                        เป็นสินค้าสูตร (Base Recipe) 
                                        <span className="block text-xs text-gray-400 font-normal">ผลิตเองจากวัตถุดิบอื่น (เช่น ซอส, พริกแกง)</span>
                                    </label>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <label className="text-xs text-gray-500">ราคาซื้อต่อแพ็ค (บาท)</label>
                                        <input 
                                            type="number" 
                                            className="w-full bg-white border border-blue-200 rounded-lg p-2 text-lg font-bold text-blue-700"
                                            value={formData.cost_price}
                                            onChange={e => setFormData({ 
                                                ...formData, 
                                                cost_price: e.target.value === '' ? 0 : parseFloat(e.target.value) 
                                            })}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500">ปริมาณ (Size)</label>
                                        <input 
                                            type="number" 
                                            className="w-full bg-white border border-blue-200 rounded-lg p-2"
                                            value={formData.pack_size}
                                            onChange={e => setFormData({ 
                                                ...formData, 
                                                pack_size: e.target.value === '' ? 0 : parseFloat(e.target.value) 
                                            })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500">หน่วยซื้อ (Unit)</label>
                                        <select 
                                            className="w-full bg-white border border-blue-200 rounded-lg p-2"
                                            value={formData.pack_unit}
                                            onChange={e => handleUnitChange('pack_unit', e.target.value)}
                                        >
                                            {THAI_UNITS.map(u => <option key={u.value} value={u.value}>{u.value}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Usage Info */}
                            <div className="bg-green-50 p-4 rounded-xl space-y-3 border border-green-100">
                                <h3 className="text-sm font-bold text-green-800 flex items-center gap-2">
                                    <Scale className="w-4 h-4" /> 2. หน่วยที่ใช้ในสูตร (Usage)
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <label className="text-xs text-gray-500 block mb-1">หน่วยที่ใช้จริง (เช่น กรัม, มิลลิลิตร)</label>
                                        <select 
                                            className="w-full bg-white border border-green-200 rounded-lg p-2 font-bold"
                                            value={formData.usage_unit}
                                            onChange={e => handleUnitChange('usage_unit', e.target.value)}
                                        >
                                            {THAI_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                                        </select>
                                    </div>
                                    
                                    <div className="col-span-2 bg-white p-3 rounded-lg border border-green-200">
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-xs text-gray-500">ตัวแปลงหน่วย (Conversion)</label>
                                            <span className="text-[10px] text-gray-400">1 {formData.pack_unit} = ? {formData.usage_unit}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-gray-400">×</span>
                                            <input 
                                                type="number" 
                                                className="flex-1 border-b border-green-300 text-center py-1 font-bold text-green-700 outline-none"
                                                value={formData.conversion_factor}
                                                onChange={e => setFormData({ 
                                                    ...formData, 
                                                    conversion_factor: e.target.value === '' ? 0 : parseFloat(e.target.value) 
                                                })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Yield Info */}
                            <div className="bg-orange-50 p-4 rounded-xl space-y-3 border border-orange-100">
                                <h3 className="text-sm font-bold text-orange-800 flex items-center gap-2">
                                    <Percent className="w-4 h-4" /> 3. ประสิทธิภาพ (Yield %)
                                </h3>
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <input 
                                            type="range" 
                                            min="1" max="100" 
                                            value={formData.yield_percent}
                                            onChange={e => setFormData({ 
                                                ...formData, 
                                                yield_percent: e.target.value === '' ? 0 : parseFloat(e.target.value) 
                                            })}
                                            className="w-full accent-orange-500"
                                        />
                                    </div>
                                    <div className="w-16">
                                        <input 
                                            type="number" 
                                            className="w-full bg-white border border-orange-200 rounded-lg p-2 text-center font-bold"
                                            value={formData.yield_percent}
                                            onChange={e => setFormData({ 
                                                ...formData, 
                                                yield_percent: e.target.value === '' ? 0 : parseFloat(e.target.value) 
                                            })}
                                        />
                                    </div>
                                </div>
                                <p className="text-[10px] text-orange-600">
                                    *Yield ต่ำกว่า 100% หมายถึงมีการสูญเสีย (เช่น เปลือก, กาก) ทำให้ต้นทุนจริงสูงขึ้น
                                </p>
                            </div>
                            
                            {/* Yield Alert */}
                            {formData.yield_percent < 80 && (
                                <div className="bg-red-50 p-3 rounded-xl border border-red-200 flex gap-3 items-start animate-pulse">
                                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                                    <div>
                                        <div className="font-bold text-red-700 text-sm">Yield ต่ำกว่าเกณฑ์ (Loss สูง)</div>
                                        <div className="text-xs text-red-600">ต้นทุนจริงจะสูงขึ้นมาก โปรดตรวจสอบว่ามีการสูญเสียมากขนาดนี้จริงหรือไม่</div>
                                    </div>
                                </div>
                            )}

                            {/* Result: Real Cost */}
                            <div className="bg-[#1A1A1A] text-white p-4 rounded-xl flex justify-between items-center shadow-lg">
                                <div>
                                    <div className="text-xs text-gray-400 mb-1">ต้นทุนจริง (Real Cost)</div>
                                    <div className="text-2xl font-bold font-mono tracking-tight text-[#DFFF00]">
                                        ฿{realCost.toFixed(4)}
                                    </div>
                                    <div className="text-[10px] text-gray-400">ต่อ 1 {formData.usage_unit}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] text-gray-500">Price / (Pack × Factor × Yield)</div>
                                </div>
                            </div>

                        </div>
                    )}

                </div>

                <div className="p-4 border-t border-gray-100 flex gap-2">
                    {isEdit && (
                        <button 
                            onClick={async () => {
                                if (confirm('คุณแน่ใจหรือไม่ที่จะลบสินค้านี้? การลบจะไม่สามารถกู้คืนได้')) {
                                    setLoading(true);
                                    try {
                                        const { error } = await supabase.from('stock_items').delete().eq('id', item.id);
                                        if (error) throw error;
                                        toast.success('ลบสินค้าเรียบร้อย');
                                        onUpdate();
                                        onClose();
                                    } catch (err) {
                                        console.error(err);
                                        toast.error('ลบไม่สำเร็จ');
                                    } finally {
                                        setLoading(false);
                                    }
                                }
                            }}
                            disabled={loading}
                            className="bg-red-50 text-red-600 p-4 rounded-xl font-bold hover:bg-red-100 transition-colors flex items-center justify-center"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )}
                    <button 
                        onClick={handleSave}
                        disabled={loading}
                        className="flex-1 bg-[#1A1A1A] text-white p-4 rounded-xl font-bold hover:bg-black transition-colors flex items-center justify-center gap-2"
                    >
                        {loading ? 'กำลังบันทึก...' : <><Save className="w-5 h-5" /> บันทึกข้อมูล</>}
                    </button>
                </div>
            </div>
            
            {showScanner && (
                <BarcodeScanner onScan={(res) => {
                    const code = res.barcode || res;
                    setFormData({...formData, barcode: code});
                    setShowScanner(false);
                    toast.success('Scanned: ' + code);
                }} onClose={() => setShowScanner(false)} />
            )}

            {/* Makro Search Modal */}
            {showMakroSearch && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-red-50 rounded-t-2xl">
                            <h2 className="font-bold text-lg text-red-800 flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5" /> ค้นหาสินค้า Makro
                            </h2>
                            <button onClick={() => setShowMakroSearch(false)} className="p-2 hover:bg-red-100 rounded-full text-red-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="p-4 border-b border-gray-100">
                            <form onSubmit={handleSearchMakro} className="flex gap-2">
                                <input 
                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-red-500" 
                                    value={makroSearchTerm}
                                    onChange={e => setMakroSearchTerm(e.target.value)}
                                    placeholder="พิมพ์ชื่อสินค้า เช่น น้ำมันปาล์ม..."
                                    autoFocus
                                />
                                <button 
                                    type="submit"
                                    disabled={searchingMakro}
                                    className="bg-red-600 text-white px-6 rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                                >
                                    {searchingMakro ? '...' : 'ค้นหา'}
                                </button>
                            </form>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 bg-gray-50">
                            {makroResults.length === 0 && !searchingMakro ? (
                                <div className="text-center text-gray-400 py-10">
                                    <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    พิมพ์ชื่อสินค้าเพื่อค้นหาจากคลัง Makro PRO
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {makroResults.map(p => (
                                        <div 
                                            key={p.id}
                                            onClick={() => handleSelectMakroProduct(p)}
                                            className="bg-white p-4 rounded-xl border border-gray-200 hover:border-red-300 hover:shadow-md cursor-pointer transition-all mx-2"
                                        >
                                            <div className="font-bold text-gray-800 mb-1 leading-tight">{p.title}</div>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                                <span className="text-red-600 font-bold">฿{p.current_price}</span>
                                                <span className="text-gray-500 whitespace-nowrap">ขนาด: {p.unit_count} {p.unit_size_label || p.price_unit}</span>
                                                {p.price_per_unit && (
                                                    <span className="text-gray-400 text-xs mt-0.5">({p.price_per_unit} บาท/{p.price_unit})</span>
                                                )}
                                            </div>
                                            {p.brand && <div className="text-xs text-blue-600 mt-1">แบรนด์: {p.brand}</div>}
                                            <div className="text-[10px] text-gray-400 mt-2">SKU: {p.sku} | ID: {p.id}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
