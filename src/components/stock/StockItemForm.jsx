import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';
import MakroPriceSheet from './MakroPriceSheet';
import { makroPickPatch, unitsLookUnset, describeMakroPick } from '../../utils/makroUnits';
import BarcodeScanner from './BarcodeScanner';
import { THAI_UNITS, suggestConversionFactor, getUnitType, areUnitTypesCompatible } from '../../utils/unitUtils';
import { calculateRealUnitCost } from '../../utils/costUtils';
import { postStockMovement, STOCK_REASONS } from '../../utils/stockLedger';
import { convertRecipesForUnitChange, describeUnitChange } from '../../utils/recipeUnitChange';

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
        is_base_recipe: false,
        is_sweetener: item?.is_sweetener || false // scaled by the sweetness option of a sale
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
                is_base_recipe: item.is_base_recipe || false,
                is_sweetener: item.is_sweetener || false
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
                 // Recipes store quantities in the usage unit: keep them meaning the same amount.
                 if (!err && item.usage_unit && payload.usage_unit && item.usage_unit !== payload.usage_unit) {
                     const res = await convertRecipesForUnitChange(item.id, item.usage_unit, payload.usage_unit);
                     const note = describeUnitChange(res, item.usage_unit, payload.usage_unit);
                     if (note) (res.failed || res.manual ? toast.warning : toast.info)(note, { duration: 8000 });
                 }
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
                     const initNote = 'จำนวนสต็อกเริ่มต้นเมื่อสร้างสินค้าวัตถุดิบ';
                     const ledger = await postStockMovement({
                         itemId: newItem.id,
                         mode: 'set',
                         quantity: initialQty,
                         reason: STOCK_REASONS.OPENING,
                         performedBy: 'System (Initial Stock)',
                         note: initNote
                     });
                     let txError = ledger.ok ? null : ledger.error;
                     if (!ledger.ok && ledger.rpcMissing) {
                         // Database without the ledger RPC: the old trigger ignores 'audit'
                         // rows, so write the quantity itself and keep the row as history.
                         const { error: qtyErr } = await supabase
                             .from('stock_items')
                             .update({ current_quantity: initialQty })
                             .eq('id', newItem.id);
                         const { error: histErr } = await supabase
                             .from('stock_transactions')
                             .insert({
                                 stock_item_id: newItem.id,
                                 transaction_type: 'set',
                                 quantity_change: 0,
                                 performed_by: 'System (Initial Stock)',
                                 note: `${initNote} | 0 → ${initialQty}`
                             });
                         txError = qtyErr || histErr;
                     }
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
    
    // --- Web Reference Price Search Modal State & Handlers ---
    const [showPriceSearch, setShowPriceSearch] = useState(false);
    const [priceSearchTerm, setPriceSearchTerm] = useState('');
    // Picked a makro.pro product: its price is per item as sold (one pack), so it goes to "price per pack"
    // Picking a makro product fills price, photo (if none) and units from its title. Units are
    // only filled when this item has none yet, or when makro uses the same usage unit: changing
    // the usage unit of an item already in recipes would change what those quantities mean.
    const handleSelectPrice = (product) => {
        const pick = makroPickPatch(product, formData, { unitsUnset: !isEdit || unitsLookUnset(formData) });
        setFormData(prev => ({
            ...prev,
            name: prev.name?.trim() ? prev.name : product.title,
            ...pick.patch
        }));
        toast.success(describeMakroPick(product, pick));
        setShowPriceSearch(false);
    };

    /* const handleSelectMakroProduct = (product) => {
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
    }; */

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
                        resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp', lastModified: Date.now() }));
                    }, 'image/webp', 0.8);
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
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.webp`;
            const { error: uploadError } = await supabase.storage.from('stock-images').upload(fileName, resizedFile, {
                cacheControl: '15552000'
            });
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

    // Quiet, token-based form styles shared by every field below
    const ink = 'text-[oklch(18%_0.012_28)]';
    const labelCls = 'block text-xs font-medium text-[oklch(42%_0.010_28)] mb-1.5';
    const inputCls = `w-full h-11 px-3 rounded-md border border-[oklch(85%_0.012_28)] bg-[oklch(99%_0.004_28)] ${ink} text-[15px] outline-none transition-colors focus:border-[oklch(18%_0.012_28)] disabled:bg-[oklch(94%_0.010_28)] disabled:text-[oklch(55%_0.010_28)] disabled:cursor-not-allowed`;
    const unitSuffix = 'text-xs text-[oklch(55%_0.010_28)] whitespace-nowrap';
    const sectionTitle = `text-sm font-semibold ${ink}`;
    const numberChange = (key) => (e) => setFormData({ ...formData, [key]: e.target.value === '' ? 0 : parseFloat(e.target.value) });
    const unitLabel = (u) => (THAI_UNITS.find(x => x.value === u)?.label || u || '').replace(/\s*\(.*\)\s*$/, '');

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-[oklch(18%_0.012_28/0.45)] backdrop-blur-sm p-0 sm:p-4">
            <div className="bg-[oklch(99%_0.004_28)] w-full sm:max-w-lg border border-[oklch(85%_0.012_28)] rounded-t-xl sm:rounded-lg shadow-[0_12px_32px_oklch(18%_0.012_28/0.12)] flex flex-col max-h-[92vh]">

                {/* Header */}
                <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h2 className={`text-lg font-semibold leading-7 ${ink}`}>{isEdit ? 'แก้ไขวัตถุดิบ' : 'เพิ่มวัตถุดิบ'}</h2>
                        {isEdit && <p className="text-sm text-[oklch(55%_0.010_28)] truncate">{item.name}</p>}
                    </div>
                    <button type="button" onClick={onClose} className="h-9 px-3 rounded-md border border-[oklch(85%_0.012_28)] text-sm text-[oklch(42%_0.010_28)] hover:border-[oklch(18%_0.012_28)] hover:text-[oklch(18%_0.012_28)] transition-colors">
                        ปิด
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-5 flex gap-6 border-b border-[oklch(85%_0.012_28)]" role="tablist">
                    {[['basic', 'ข้อมูลทั่วไป'], ['costing', 'ต้นทุนและหน่วย']].map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === id}
                            onClick={() => setActiveTab(id)}
                            className={`-mb-px py-2.5 text-sm border-b-2 transition-colors ${activeTab === id ? `border-[oklch(18%_0.012_28)] ${ink} font-semibold` : 'border-transparent text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

                    {/* Counting unit differs from buying unit */}
                    {formData.unit && formData.pack_unit && formData.unit !== formData.pack_unit && (
                        <div className="border-l-2 border-[oklch(52%_0.16_28)] bg-[oklch(97%_0.008_28)] pl-3 pr-3 py-2.5 space-y-2">
                            <p className={`text-sm ${ink}`}>
                                หน่วยนับ <strong>{unitLabel(formData.unit)}</strong> ไม่ตรงกับหน่วยซื้อ <strong>{unitLabel(formData.pack_unit)}</strong> จุดสั่งซื้ออาจแจ้งเตือนผิด
                            </p>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, unit: formData.pack_unit })}
                                className="text-sm font-semibold text-[oklch(52%_0.16_28)] hover:underline"
                            >
                                ใช้ "{unitLabel(formData.pack_unit)}" เป็นหน่วยนับ
                            </button>
                        </div>
                    )}

                    {/* Basic Info Tab */}
                    {activeTab === 'basic' && (
                        <>
                            <div>
                                <label className={labelCls} htmlFor="stock-name">ชื่อวัตถุดิบ</label>
                                <div className="flex gap-2">
                                    <input
                                        id="stock-name"
                                        className={inputCls}
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="เช่น มะนาวแป้น, น้ำเชื่อมมิตรผล"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPriceSearchTerm(formData.name || '');
                                            setShowPriceSearch(true);
                                        }}
                                        className={`h-11 px-4 rounded-md border border-[oklch(18%_0.012_28)] ${ink} text-sm font-semibold whitespace-nowrap hover:bg-[oklch(94%_0.010_28)] transition-colors`}
                                        title="ค้นราคาและขนาดจาก makro.pro"
                                    >
                                        ราคากลาง
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelCls} htmlFor="stock-category">หมวดหมู่</label>
                                    <select
                                        id="stock-category"
                                        className={inputCls}
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        {categories.filter(c => c.id !== 'restock').map(c => (
                                            <option key={c.id} value={c.id}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls} htmlFor="stock-barcode">บาร์โค้ด</label>
                                    <div className="relative">
                                        <input
                                            id="stock-barcode"
                                            className={`${inputCls} pr-16`}
                                            value={formData.barcode}
                                            onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                                        />
                                        <button type="button" onClick={() => setShowScanner(true)} className="absolute right-1.5 top-1.5 h-8 px-2.5 rounded text-xs font-semibold text-[oklch(42%_0.010_28)] bg-[oklch(94%_0.010_28)] hover:text-[oklch(18%_0.012_28)]">
                                            สแกน
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Stock levels, all in the buying unit */}
                            <section className="space-y-3 pt-5 border-t border-[oklch(90%_0.008_28)]">
                                <h3 className={sectionTitle}>ระดับสต๊อก <span className="font-normal text-[oklch(55%_0.010_28)]">· นับเป็น {unitLabel(formData.pack_unit)}</span></h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { key: 'current_quantity', label: 'คงเหลือตอนนี้', disabled: isEdit },
                                        { key: 'min_stock_threshold', label: 'จุดวิกฤต', marker: true },
                                        { key: 'reorder_point', label: 'จุดสั่งซื้อ' },
                                        { key: 'par_level', label: 'เป้าหมาย (Par)' }
                                    ].map(f => (
                                        <div key={f.key}>
                                            <label className={labelCls} htmlFor={`stock-${f.key}`}>
                                                {f.marker && <span className="inline-block w-1.5 h-1.5 mr-1.5 align-middle bg-[oklch(52%_0.16_28)]" aria-hidden="true" />}
                                                {f.label}
                                            </label>
                                            <input
                                                id={`stock-${f.key}`}
                                                type="number"
                                                inputMode="decimal"
                                                disabled={f.disabled}
                                                className={`${inputCls} tabular-nums`}
                                                value={formData[f.key]}
                                                onChange={numberChange(f.key)}
                                            />
                                        </div>
                                    ))}
                                </div>
                                {isEdit && (
                                    <p className="text-xs text-[oklch(55%_0.010_28)] leading-relaxed">
                                        แก้จำนวนคงเหลือได้จากปุ่มรับเข้า / เบิกออกที่หน้าสต๊อก เพื่อให้ประวัติถูกต้อง
                                    </p>
                                )}
                            </section>

                            {/* Image */}
                            <section className="space-y-3 pt-5 border-t border-[oklch(90%_0.008_28)]">
                                <h3 className={sectionTitle}>รูปวัตถุดิบ</h3>
                                <div className="flex items-center gap-3">
                                    <div className="w-16 h-16 rounded-md overflow-hidden border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] shrink-0">
                                        {formData.image_url ? (
                                            <img src={formData.image_url} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-[11px] text-[oklch(55%_0.010_28)]">ไม่มีรูป</div>
                                        )}
                                    </div>
                                    <label className={`h-11 px-4 inline-flex items-center rounded-md border border-dashed border-[oklch(78%_0.012_28)] text-sm ${ink} cursor-pointer hover:border-[oklch(18%_0.012_28)] transition-colors`}>
                                        {formData.image_url ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
                                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                    </label>
                                </div>
                            </section>
                        </>
                    )}

                    {/* Costing Tab */}
                    {activeTab === 'costing' && (
                        <>
                            {!areUnitTypesCompatible(formData.pack_unit, formData.usage_unit) && (
                                <div className="border-l-2 border-[oklch(52%_0.16_28)] bg-[oklch(97%_0.008_28)] px-3 py-2.5">
                                    <p className={`text-sm ${ink} leading-relaxed`}>
                                        หน่วยซื้อ ({unitLabel(formData.pack_unit)}) กับหน่วยใช้ ({unitLabel(formData.usage_unit)}) เป็นคนละประเภท ใส่ตัวแปลงหน่วยตามของจริง เช่น 1 ขวด = 750 มล.
                                    </p>
                                </div>
                            )}

                            {/* 1. Buying */}
                            <section className="space-y-3">
                                <h3 className={sectionTitle}>1 · การซื้อ</h3>
                                <label className="flex items-start gap-3 p-3 rounded-md border border-[oklch(85%_0.012_28)] cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="mt-0.5 w-4 h-4 accent-[oklch(18%_0.012_28)]"
                                        checked={formData.is_base_recipe}
                                        onChange={e => setFormData({ ...formData, is_base_recipe: e.target.checked })}
                                    />
                                    <span>
                                        <span className={`block text-sm font-medium ${ink}`}>ทำเองในร้าน (สูตรพื้นฐาน)</span>
                                        <span className="block text-xs text-[oklch(55%_0.010_28)]">ผลิตจากวัตถุดิบอื่น เช่น ซอส พริกแกง</span>
                                    </span>
                                </label>
                                <div>
                                    <label className={labelCls} htmlFor="stock-cost">ราคาซื้อต่อแพ็ค (บาท)</label>
                                    <input
                                        id="stock-cost"
                                        type="number"
                                        inputMode="decimal"
                                        className={`${inputCls} tabular-nums text-lg font-semibold`}
                                        value={formData.cost_price}
                                        onChange={numberChange('cost_price')}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelCls} htmlFor="stock-pack-size">จำนวนต่อการซื้อ</label>
                                        <input
                                            id="stock-pack-size"
                                            type="number"
                                            inputMode="decimal"
                                            className={`${inputCls} tabular-nums`}
                                            value={formData.pack_size}
                                            onChange={numberChange('pack_size')}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelCls} htmlFor="stock-pack-unit">หน่วยซื้อ</label>
                                        <select
                                            id="stock-pack-unit"
                                            className={inputCls}
                                            value={formData.pack_unit}
                                            onChange={e => handleUnitChange('pack_unit', e.target.value)}
                                        >
                                            {THAI_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </section>

                            {/* 2. Usage */}
                            <section className="space-y-3 pt-5 border-t border-[oklch(90%_0.008_28)]">
                                <h3 className={sectionTitle}>2 · หน่วยที่ใช้ในสูตร</h3>
                                <div>
                                    <label className={labelCls} htmlFor="stock-usage-unit">หน่วยที่ใช้จริง</label>
                                    <select
                                        id="stock-usage-unit"
                                        className={inputCls}
                                        value={formData.usage_unit}
                                        onChange={e => handleUnitChange('usage_unit', e.target.value)}
                                    >
                                        {THAI_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls} htmlFor="stock-conversion">ตัวแปลงหน่วย</label>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm ${ink} whitespace-nowrap`}>1 {unitLabel(formData.pack_unit)} =</span>
                                        <input
                                            id="stock-conversion"
                                            type="number"
                                            inputMode="decimal"
                                            className={`${inputCls} tabular-nums text-center font-semibold`}
                                            value={formData.conversion_factor}
                                            onChange={numberChange('conversion_factor')}
                                        />
                                        <span className={`text-sm ${ink} whitespace-nowrap`}>{unitLabel(formData.usage_unit)}</span>
                                    </div>
                                </div>
                            </section>

                            {/* 3. Yield */}
                            <section className="space-y-3 pt-5 border-t border-[oklch(90%_0.008_28)]">
                                <h3 className={sectionTitle}>3 · ส่วนที่ใช้ได้จริง (Yield)</h3>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="range"
                                        min="1" max="100"
                                        aria-label="Yield %"
                                        value={formData.yield_percent}
                                        onChange={numberChange('yield_percent')}
                                        className="flex-1"
                                        style={{ accentColor: 'oklch(18% 0.012 28)' }}
                                    />
                                    <div className="flex items-center gap-1.5 w-24">
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            aria-label="Yield %"
                                            className={`${inputCls} tabular-nums text-center`}
                                            value={formData.yield_percent}
                                            onChange={numberChange('yield_percent')}
                                        />
                                        <span className={unitSuffix}>%</span>
                                    </div>
                                </div>
                                <p className="text-xs text-[oklch(55%_0.010_28)] leading-relaxed">
                                    ต่ำกว่า 100% เมื่อมีส่วนที่ทิ้ง เช่น เปลือก กาก ต้นทุนต่อหน่วยจริงจะสูงขึ้น
                                </p>
                                {formData.yield_percent < 80 && (
                                    <p className="text-sm text-[oklch(52%_0.16_28)]">
                                        Yield ต่ำกว่า 80% ตรวจว่าสูญเสียมากขนาดนี้จริงหรือไม่
                                    </p>
                                )}
                            </section>

                            {/* Sweetener: the sweetness option of a drink scales this ingredient */}
                            <section className="pt-5 border-t border-[oklch(90%_0.008_28)]">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="mt-0.5 w-4 h-4 accent-[oklch(18%_0.012_28)]"
                                        checked={formData.is_sweetener === true}
                                        onChange={e => setFormData({ ...formData, is_sweetener: e.target.checked })}
                                    />
                                    <span>
                                        <span className={`block text-sm font-medium ${ink}`}>สารให้ความหวาน</span>
                                        <span className="block text-xs text-[oklch(55%_0.010_28)] leading-relaxed">
                                            เช่น น้ำเชื่อม น้ำตาล นมข้นหวาน น้ำผึ้ง เมื่อลูกค้าเลือก "หวานน้อย" ระบบตัดสต๊อกรายการนี้ตามตัวคูณของตัวเลือก
                                        </span>
                                    </span>
                                </label>
                            </section>

                            {/* Result: real cost per usage unit */}
                            <div className="flex items-baseline justify-between gap-3 p-4 rounded-md bg-[oklch(94%_0.010_28)]">
                                <div>
                                    <div className="text-xs text-[oklch(42%_0.010_28)]">ต้นทุนจริงต่อ 1 {unitLabel(formData.usage_unit)}</div>
                                    <div className="text-xs text-[oklch(55%_0.010_28)]">ราคา ÷ (จำนวน × ตัวแปลง × yield)</div>
                                </div>
                                <div className={`text-2xl font-semibold tabular-nums ${ink}`}>
                                    ฿{realCost.toFixed(4)}
                                </div>
                            </div>
                        </>
                    )}

                </div>

                <div className="px-5 py-4 border-t border-[oklch(85%_0.012_28)] flex items-center gap-3">
                    {isEdit && (
                        <button
                            type="button"
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
                            className="h-12 px-4 text-sm font-semibold text-[oklch(52%_0.16_28)] hover:underline disabled:opacity-50"
                        >
                            ลบ
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={loading}
                        className="flex-1 h-12 rounded-md bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] text-[15px] font-semibold hover:bg-[oklch(25%_0.012_28)] transition-colors disabled:opacity-60"
                    >
                        {loading ? 'กำลังบันทึก…' : 'บันทึก'}
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

            {showPriceSearch && (
                <MakroPriceSheet
                    initialTerm={priceSearchTerm}
                    onPick={handleSelectPrice}
                    onClose={() => setShowPriceSearch(false)}
                />
            )}
        </div>
    );
}
