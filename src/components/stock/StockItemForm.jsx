import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { compressImageFile } from '../../utils/imageOptimizer';
import { toast } from 'sonner';
import MakroPriceSheet from './MakroPriceSheet';
import { makroPickPatch, unitsLookUnset, describeMakroPick } from '../../utils/makroUnits';
import BarcodeScanner from './BarcodeScanner';
import { THAI_UNITS, suggestConversionFactor, getUnitType, areUnitTypesCompatible } from '../../utils/unitUtils';
import { calculateRealUnitCost } from '../../utils/costUtils';
import { postStockMovement, STOCK_REASONS } from '../../utils/stockLedger';
import { convertRecipesForUnitChange, describeUnitChange } from '../../utils/recipeUnitChange';
import { unitSetupWarnings } from '../../utils/stockHealth';
import { usagePerStockUnit, unitCode, ITEM_TYPES, PREP_MODES } from '../../utils/recipeGraph';
import { displayUnit } from '../../utils/stockCount';
import { logStaffActivity } from '../../utils/auditLogger';
import { rescaleForCountUnitChange } from '../../utils/stockUnitChange';
import { askUnitChange } from './UnitChangeDialog';

export default function StockItemForm({ item, categories, onClose, onUpdate }) {
    const isEdit = Boolean(item?.id);
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    
    // Tab State: 'basic' | 'costing'
    const [activeTab, setActiveTab] = useState('basic');
    // A makro pick whose units were not applied because the item already has units of its own
    // ({ units, recipeCount }): shown as a notice with a one-tap way to take makro's units.
    const [makroUnitsOffer, setMakroUnitsOffer] = useState(null);

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
        unit: item?.unit || item?.pack_unit || 'unit',
        usage_unit: item?.usage_unit || 'unit',    // Unit used in recipe
        conversion_factor: item?.conversion_factor || 1, // 1 pack_unit = X usage_unit
        yield_percent: 100, // Usable %
        is_base_recipe: false,
        item_type: item?.item_type || (item?.is_base_recipe ? ITEM_TYPES.PREP : ITEM_TYPES.RAW),
        prep_mode: item?.prep_mode || null,
        portion_yield_qty: item?.portion_yield_qty ?? null,
        is_sweetener: item?.is_sweetener || false // scaled by the sweetness option of a sale
    });
    
    const [showScanner, setShowScanner] = useState(false);

    useEffect(() => {
        if (item) {
            const resolvedType = item.item_type === ITEM_TYPES.PREP || item.item_type === ITEM_TYPES.RECIPE
                ? ITEM_TYPES.PREP
                : (item.is_base_recipe ? ITEM_TYPES.PREP : ITEM_TYPES.RAW);
            setFormData({
                name: item.name || '',
                category: item.category || 'veg',
                current_quantity: item.current_quantity ?? 0,
                min_stock_threshold: item.min_stock_threshold ?? 0,
                reorder_point: item.reorder_point ?? 0,
                par_level: item.par_level ?? 0,
                image_url: item.image_url || '',
                barcode: item.barcode || '',
                makro_id: item.makro_id || '',
                makro_sku: item.makro_sku || '',
                
                cost_price: item.cost_price ?? 0,
                pack_size: item.pack_size ?? 1,
                pack_unit: resolvedType === ITEM_TYPES.PREP && ['portion', 'potion', 'สูตร'].includes(String(item.unit || '').toLowerCase())
                    ? 'portion'
                    : (item.pack_unit || 'unit'),
                // The counting unit as stored: an old "counted in bottles, bought in ml" item keeps it
                // until someone presses "use the buying unit", so a price edit never re-means the stock
                unit: item.unit || item.pack_unit || 'unit',
                usage_unit: item.usage_unit || item.unit || 'unit', // migration fallback
                conversion_factor: item.conversion_factor ?? 1,
                yield_percent: item.yield_percent ?? 100,
                is_base_recipe: resolvedType === ITEM_TYPES.PREP,
                item_type: resolvedType,
                prep_mode: item.prep_mode || (resolvedType === ITEM_TYPES.PREP ? PREP_MODES.STOCKED : null),
                portion_yield_qty: item.portion_yield_qty ?? null,
                is_sweetener: item.is_sweetener || false
            });
        }
    }, [item]);

    // Auto-Calculate Conversion Factor when Units Change
    const handleUnitChange = (type, value) => {
        const newData = { ...formData, [type]: value };
        // Counted in the buying unit: changing the buying unit changes the counting unit with it
        if (type === 'pack_unit' && !formData.is_base_recipe && (!formData.unit || unitCode(formData.unit) === unitCode(formData.pack_unit))) {
            newData.unit = value;
        }
        
        // Suggest Factor if either unit changed
        if (type === 'pack_unit' || type === 'usage_unit') {
            const factor = suggestConversionFactor(newData.pack_unit, newData.usage_unit);
            newData.conversion_factor = factor !== null ? factor : '';
        }
        
        setFormData(newData);
    };

    const realCost = calculateRealUnitCost(formData);

    const handleSave = async () => {
        const numOr = (v, fallback = 0) => {
            if (v === '' || v === null || v === undefined) return fallback;
            const n = parseFloat(v);
            return Number.isFinite(n) ? n : NaN;
        };
        const costPriceVal = numOr(formData.cost_price, 0);
        const packSizeVal = numOr(formData.pack_size, NaN);
        const conversionFactorVal = numOr(formData.conversion_factor, NaN);
        const yieldPercentVal = numOr(formData.yield_percent, NaN);
        const currentQtyVal = numOr(formData.current_quantity, 0);
        const minThresholdVal = numOr(formData.min_stock_threshold, 0);
        const reorderPointVal = numOr(formData.reorder_point, 0);
        const parLevelVal = numOr(formData.par_level, 0);

        // Enforce validations
        if (!formData.name || !formData.name.trim()) {
            toast.error('กรุณากรอกชื่อสินค้าวัตถุดิบ');
            return;
        }
        if (isNaN(costPriceVal) || costPriceVal < 0) {
            toast.error('ราคาต้นทุนต้องไม่ต่ำกว่า 0 บาท');
            return;
        }
        if (isNaN(packSizeVal) || packSizeVal <= 0) {
            toast.error('ปริมาณขนาดบรรจุภัณฑ์ (Pack Size) ต้องมากกว่า 0');
            return;
        }
        
        // Check unit compatibility
        const isCompatible = areUnitTypesCompatible(formData.pack_unit, formData.usage_unit);
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
        
        if (isNaN(yieldPercentVal) || yieldPercentVal < 1 || yieldPercentVal > 100) {
            toast.error('Yield % ต้องอยู่ระหว่าง 1 ถึง 100%');
            return;
        }
        if (isNaN(minThresholdVal) || isNaN(reorderPointVal) || isNaN(parLevelVal) || minThresholdVal < 0 || reorderPointVal < 0 || parLevelVal < 0) {
            toast.error('จำนวนสต็อกสำหรับระดับแจ้งเตือนต้องไม่ต่ำกว่า 0');
            return;
        }

        // Guard against accidentally demoting a prep back to raw (which hides it from Recipe Lab)
        if (isEdit && item.item_type === ITEM_TYPES.PREP && !formData.is_base_recipe) {
            if (!confirm('ยกเลิกสถานะ "ทำเองในร้าน (สูตร)"? รายการนี้จะถูกย้ายออกจากแท็บเบส/ของเตรียมใน Recipe Lab')) {
                return;
            }
        }

        setLoading(true);
        try {
            const isPrep = Boolean(formData.is_base_recipe);
            // Shelf items made in-house are ALWAYS item_type='prep' (stocked), never 'recipe'
            // (setting 'recipe' wipes unit setup and hides the item from /staff/stock).
            const nextItemType = isPrep ? ITEM_TYPES.PREP : ITEM_TYPES.RAW;
            const nextPrepMode = isPrep ? (formData.prep_mode || PREP_MODES.STOCKED) : null;
            const nextYieldQty = isPrep
                ? (conversionFactorVal > 0 ? conversionFactorVal : (item?.portion_yield_qty ?? null))
                : null;

            const payload = {
                name: formData.name.trim(),
                category: formData.category && formData.category !== 'all' && formData.category !== 'restock'
                    ? formData.category
                    : (item?.category || 'other'),
                current_quantity: currentQtyVal,
                min_stock_threshold: minThresholdVal,
                reorder_point: reorderPointVal,
                par_level: parLevelVal,
                image_url: formData.image_url || '',
                barcode: formData.barcode ? formData.barcode.trim() : null,
                makro_id: formData.makro_id || '',
                makro_sku: formData.makro_sku || '',
                cost_price: costPriceVal,
                pack_size: isPrep ? 1 : packSizeVal,
                pack_unit: formData.pack_unit || 'unit',
                unit: formData.unit || formData.pack_unit || 'unit',
                usage_unit: formData.usage_unit || 'unit',
                conversion_factor: conversionFactorVal,
                yield_percent: yieldPercentVal,
                is_base_recipe: isPrep,
                item_type: nextItemType,
                prep_mode: nextPrepMode,
                portion_yield_qty: nextYieldQty,
                is_sweetener: formData.is_sweetener === true,
                updated_at: new Date().toISOString()
            };
            
            let error;
            if (isEdit) {
                 // Prevent Stale Update: Strip current_quantity from update payload
                 delete payload.current_quantity;
                 // One counted unit now holds a different amount. Either the way of counting changed
                 // (bottles -> crates: convert) or the old setup was wrong (keep what was counted).
                 // Only the person knows, so ask; never convert silently.
                 const rescale = rescaleForCountUnitChange(item, payload, usagePerStockUnit);
                 let convert = false;
                 if (rescale.changed) {
                     const choice = await askUnitChange(rescale);
                     if (!choice) { setLoading(false); return; }
                     convert = choice === 'convert';
                 }
                 if (convert) Object.assign(payload, rescale.levels);
                 const { error: err } = await supabase.from('stock_items').update(payload).eq('id', item.id);
                 error = err;
                 if (!err && convert && rescale.quantity !== null) {
                     const moved = await postStockMovement({
                         itemId: item.id,
                         mode: 'set',
                         quantity: rescale.quantity,
                         reason: STOCK_REASONS.OPENING, // a restatement, not a movement: Stock Recon moves the day's opening
                         performedBy: 'System (unit change)',
                         note: rescale.note
                     });
                     if (moved.ok) toast.info(rescale.note, { duration: 8000 });
                     else toast.error('เปลี่ยนหน่วยแล้ว แต่แปลงยอดคงเหลือไม่สำเร็จ ตรวจนับใหม่อีกครั้ง');
                 }
                 // Recipes store quantities in the usage unit: keep them meaning the same amount.
                 if (!err && item.usage_unit && payload.usage_unit && item.usage_unit !== payload.usage_unit) {
                     const res = await convertRecipesForUnitChange(item.id, item.usage_unit, payload.usage_unit);
                     const note = describeUnitChange(res, item.usage_unit, payload.usage_unit);
                     if (note) (res.failed || res.manual ? toast.warning : toast.info)(note, { duration: 8000 });
                 }
                 if (!err) {
                     const priceChanged = Number(item.cost_price || 0) !== Number(payload.cost_price || 0);
                     const parts = [];
                     if (priceChanged) parts.push(`ราคา ฿${Number(item.cost_price || 0)} → ฿${Number(payload.cost_price || 0)}`);
                     if (item.unit !== payload.unit || item.pack_unit !== payload.pack_unit || item.usage_unit !== payload.usage_unit || Number(item.conversion_factor) !== Number(payload.conversion_factor)) {
                         parts.push(`หน่วย ${displayUnit(payload.pack_unit)} = ${payload.conversion_factor} ${displayUnit(payload.usage_unit)}`);
                     }
                     logStaffActivity('stock', 'stock_item_update', {
                         amount: Number(payload.cost_price) || 0,
                         reason: `แก้ไขวัตถุดิบ: ${payload.name}${parts.length ? ` (${parts.join(' · ')})` : ''}`,
                         metadata: {
                             module: 'stock',
                             item_id: item.id,
                             item_name: payload.name,
                             old_cost_price: item.cost_price,
                             new_cost_price: payload.cost_price,
                             old_unit: item.unit,
                             new_unit: payload.unit,
                             old_item_type: item.item_type,
                             new_item_type: payload.item_type
                         }
                     });
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
                 
                 if (!err && newItem) {
                     logStaffActivity('stock', 'stock_item_create', {
                         amount: Number(payload.cost_price) || 0,
                         reason: `เพิ่มวัตถุดิบใหม่: ${payload.name} (฿${Number(payload.cost_price || 0)})`,
                         metadata: {
                             module: 'stock',
                             item_id: newItem.id,
                             item_name: payload.name,
                             cost_price: payload.cost_price,
                             unit: payload.unit,
                             item_type: payload.item_type
                         }
                     });
                 }

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
        let pick = makroPickPatch(product, formData, { unitsUnset: !isEdit || unitsLookUnset(formData) });
        const previous = {
            pack_size: formData.pack_size,
            pack_unit: formData.pack_unit,
            unit: formData.unit,
            usage_unit: formData.usage_unit,
            conversion_factor: formData.conversion_factor
        };
        // makro counts it in another kind of unit than the item (cups set up in kilograms): makro's
        // units are the right ones, so they are taken, with a way back. Saving converts or flags
        // any recipe quantities, as it does for every usage unit change.
        const otherKind = Boolean(pick.units && !pick.appliedUnits
            && !areUnitTypesCompatible(pick.units.usageUnit, formData.usage_unit));
        if (otherKind) {
            pick = {
                ...pick,
                appliedUnits: true,
                patch: {
                    ...pick.patch,
                    pack_size: 1,
                    pack_unit: pick.units.packUnit,
                    unit: pick.units.packUnit,
                    usage_unit: pick.units.usageUnit,
                    conversion_factor: pick.units.conversionFactor
                }
            };
        } else if (pick.appliedUnits && pick.units && (!formData.unit || unitCode(formData.unit) === unitCode(formData.pack_unit))) {
            pick = {
                ...pick,
                patch: {
                    ...pick.patch,
                    unit: pick.units.packUnit
                }
            };
        }
        setFormData(prev => ({
            ...prev,
            name: prev.name?.trim() ? prev.name : product.title,
            ...pick.patch
        }));
        toast.success(describeMakroPick(product, pick));
        setShowPriceSearch(false);

        // Same kind of unit, other numbers (an item counted in litres, makro in ml): ask, do not change
        const sameKindDiffers = Boolean(pick.units && !pick.appliedUnits && (
            pick.units.usageUnit !== formData.usage_unit
            || pick.units.packUnit !== formData.pack_unit
            || Number(pick.units.conversionFactor) !== Number(formData.conversion_factor)
        ));
        if (!otherKind && !sameKindDiffers) {
            setMakroUnitsOffer(null);
            return;
        }
        setMakroUnitsOffer({ mode: otherKind ? 'applied' : 'offer', units: pick.units, previous, recipeCount: null });
        if (isEdit && item?.id) {
            supabase
                .from('recipe_ingredients')
                .select('id', { count: 'exact', head: true })
                .eq('ingredient_id', item.id)
                .then(({ count }) => setMakroUnitsOffer(o => (o ? { ...o, recipeCount: count ?? null } : o)));
        }
    };

    const applyMakroUnits = () => {
        if (!makroUnitsOffer) return;
        const { units } = makroUnitsOffer;
        setFormData(prev => ({
            ...prev,
            pack_size: 1,
            pack_unit: units.packUnit,
            unit: units.packUnit,
            usage_unit: units.usageUnit,
            conversion_factor: units.conversionFactor
        }));
        setMakroUnitsOffer(null);
        toast.success(`ใช้หน่วยจาก makro: ${units.summary} · กดบันทึกเพื่อเก็บ`);
    };

    const restoreUnits = () => {
        if (!makroUnitsOffer) return;
        setFormData(prev => ({ ...prev, ...makroUnitsOffer.previous }));
        setMakroUnitsOffer(null);
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

    // Shrink the photo before upload (800px, WebP; JPEG where the browser cannot write WebP).
    // iPhone Safari cannot: the old canvas code silently got a PNG back, so every photo taken
    // on an iPhone was stored as a ~1.8 MB PNG named .webp (found 2026-11-20, 104 files).
    const resizeImage = (file) => compressImageFile(file, 800, 800, 0.8);

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setLoading(true);
            const resizedFile = await resizeImage(file);
            const ext = resizedFile.type === 'image/webp' ? 'webp' : resizedFile.type === 'image/png' ? 'png' : 'jpg';
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
            const { error: uploadError } = await supabase.storage.from('stock-images').upload(fileName, resizedFile, {
                cacheControl: '15552000',
                contentType: resizedFile.type || 'image/jpeg'
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
    const ink = 'text-[var(--color-ink)]';
    const labelCls = 'block text-xs font-medium text-[var(--color-muted)] mb-1.5';
    const inputCls = `w-full h-11 px-3 rounded-md border border-[var(--color-rule)] bg-[var(--color-paper)] ${ink} text-[15px] outline-none transition-colors focus:border-[var(--color-ink)] disabled:bg-[var(--color-paper-2)] disabled:text-[var(--color-neutral)] disabled:cursor-not-allowed`;
    const unitSuffix = 'text-xs text-[var(--color-neutral)] whitespace-nowrap';
    const sectionTitle = `text-sm font-semibold ${ink}`;
    const numberChange = (key) => (e) => setFormData(prev => ({ ...prev, [key]: e.target.value }));
    const unitLabel = (u) => displayUnit(u);
    const selectableCategories = categories.filter(c => c.id !== 'restock' && c.id !== 'all');
    const hasCustomCategory = Boolean(formData.category && !selectableCategories.some(c => c.id === formData.category));
    const showUnitMismatchBanner = !formData.is_base_recipe
        && formData.item_type !== ITEM_TYPES.PREP
        && formData.unit
        && formData.pack_unit
        && unitCode(formData.unit) !== unitCode(formData.pack_unit);

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-[oklch(21.78%_0_0/0.45)] backdrop-blur-sm p-0 sm:p-4">
            <div className="bg-[var(--color-paper)] w-full sm:max-w-lg border border-[var(--color-rule)] rounded-t-xl sm:rounded-lg shadow-[0_12px_32px_oklch(21.78%_0_0/0.12)] flex flex-col max-h-[92vh]">

                {/* Header */}
                <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h2 className={`text-lg font-semibold leading-7 ${ink}`}>{isEdit ? 'แก้ไขวัตถุดิบ' : 'เพิ่มวัตถุดิบ'}</h2>
                        {isEdit && <p className="text-sm text-[var(--color-neutral)] truncate">{item.name}</p>}
                    </div>
                    <button type="button" onClick={onClose} className="h-9 px-3 rounded-md border border-[var(--color-rule)] text-sm text-[var(--color-muted)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] transition-colors">
                        ปิด
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-5 flex gap-6 border-b border-[var(--color-rule)]" role="tablist">
                    {[['basic', 'ข้อมูลทั่วไป'], ['costing', 'ต้นทุนและหน่วย']].map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === id}
                            onClick={() => setActiveTab(id)}
                            className={`-mb-px py-2.5 text-sm border-b-2 transition-colors ${activeTab === id ? `border-[var(--color-ink)] ${ink} font-semibold` : 'border-transparent text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

                    {/* makro sells this in other units than the item had */}
                    {makroUnitsOffer && (() => {
                        const { mode, units, previous, recipeCount } = makroUnitsOffer;
                        const before = `1 ${unitLabel(previous.pack_unit)} = ${Number(previous.conversion_factor || 1).toLocaleString('th-TH')} ${unitLabel(previous.usage_unit)}`;
                        return (
                            <div className="border-l-2 border-[var(--color-ink)] bg-[var(--color-paper)] pl-3 pr-3 py-2.5 space-y-2" role="status">
                                <p className={`text-sm leading-6 ${ink}`}>
                                    {mode === 'applied'
                                        ? <>ใช้หน่วยจาก makro แล้ว: <strong>{units.summary}</strong> (เดิม {before})</>
                                        : <>makro ขายเป็น <strong>{units.summary}</strong> แต่รายการนี้ตั้งไว้ <strong>{before}</strong></>}
                                </p>
                                <p className="text-xs leading-5 text-[var(--color-muted)]">
                                    คงเหลือและจุดสั่งซื้อนับเป็น{unitLabel(mode === 'applied' ? units.packUnit : previous.pack_unit)} ตรวจตัวเลขก่อนกดบันทึก
                                    {recipeCount > 0 && <> · รายการนี้อยู่ในสูตร {recipeCount} สูตร ถ้าเปลี่ยนหน่วย ระบบจะแจ้งสูตรที่ต้องแก้จำนวนหลังบันทึก</>}
                                </p>
                                <div className="flex flex-wrap gap-x-4 gap-y-1">
                                    {mode === 'applied' ? (
                                        <button type="button" onClick={restoreUnits} className="text-sm text-[var(--color-muted)] underline underline-offset-4 decoration-[oklch(80%_0.01_348.33)] hover:text-[var(--color-ink)]">
                                            คืนหน่วยเดิม
                                        </button>
                                    ) : (
                                        <>
                                            <button type="button" onClick={applyMakroUnits} className={`text-sm font-semibold ${ink} underline underline-offset-4 decoration-[oklch(70%_0.01_348.33)] hover:decoration-[var(--color-ink)]`}>
                                                ใช้หน่วยจาก makro
                                            </button>
                                            <button type="button" onClick={() => setMakroUnitsOffer(null)} className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]">
                                                คงหน่วยเดิม
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Unit set-ups that are almost certainly a mistake; saving is still allowed */}
                    {unitSetupWarnings(formData).map(text => (
                        <div key={text} className={`border-l-2 border-[var(--brand-plum)] bg-[var(--color-paper)] pl-3 pr-3 py-2.5 text-sm leading-6 ${ink}`} role="status">{text}</div>
                    ))}

                    {/* Counting unit differs from buying unit (raw items only; preps count per สูตร) */}
                    {showUnitMismatchBanner && (
                        <div className="border-l-2 border-[var(--brand-plum)] bg-[var(--color-paper)] pl-3 pr-3 py-2.5 space-y-2">
                            <p className={`text-sm ${ink}`}>
                                หน่วยนับ <strong>{unitLabel(formData.unit)}</strong> ไม่ตรงกับหน่วยซื้อ <strong>{unitLabel(formData.pack_unit)}</strong> จุดสั่งซื้ออาจแจ้งเตือนผิด
                            </p>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, unit: formData.pack_unit })}
                                className="text-sm font-semibold text-[var(--brand-plum)] hover:underline"
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
                                        className={`h-11 px-4 rounded-md border border-[var(--color-ink)] ${ink} text-sm font-semibold whitespace-nowrap hover:bg-[var(--color-paper-2)] transition-colors`}
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
                                        {hasCustomCategory && (
                                            <option value={formData.category}>{formData.category}</option>
                                        )}
                                        {selectableCategories.map(c => (
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
                                        <button type="button" onClick={() => setShowScanner(true)} className="absolute right-1.5 top-1.5 h-8 px-2.5 rounded text-xs font-semibold text-[var(--color-muted)] bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]">
                                            สแกน
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Stock levels, in the item's counting unit */}
                            <section className="space-y-3 pt-5 border-t border-[var(--color-paper-3)]">
                                <h3 className={sectionTitle}>ระดับสต๊อก <span className="font-normal text-[var(--color-neutral)]">· นับเป็น {unitLabel(formData.unit || formData.pack_unit)}</span></h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { key: 'current_quantity', label: 'คงเหลือตอนนี้', disabled: isEdit },
                                        { key: 'min_stock_threshold', label: 'จุดวิกฤต', marker: true },
                                        { key: 'reorder_point', label: 'จุดสั่งซื้อ' },
                                        { key: 'par_level', label: 'เป้าหมาย (Par)' }
                                    ].map(f => (
                                        <div key={f.key}>
                                            <label className={labelCls} htmlFor={`stock-${f.key}`}>
                                                {f.marker && <span className="inline-block w-1.5 h-1.5 mr-1.5 align-middle bg-[var(--brand-plum)]" aria-hidden="true" />}
                                                {f.label}
                                            </label>
                                            <input
                                                id={`stock-${f.key}`}
                                                type="number"
                                                step="any"
                                                inputMode="decimal"
                                                disabled={f.disabled}
                                                className={`${inputCls} tabular-nums`}
                                                value={formData[f.key]}
                                                onChange={numberChange(f.key)}
                                            />
                                        </div>
                                    ))}
                                </div>
                                {Number(formData.min_stock_threshold) > 0 && Number(formData.reorder_point) > 0 && Number(formData.min_stock_threshold) > Number(formData.reorder_point) && (
                                    <div className="border-l-2 border-[var(--brand-plum)] bg-[var(--color-paper)] pl-3 pr-2 py-2 flex items-center justify-between gap-2">
                                        <p className="text-xs text-[var(--color-ink)] leading-relaxed">
                                            จุดวิกฤต ({formData.min_stock_threshold}) มากกว่าจุดสั่งซื้อ ({formData.reorder_point}) — โดยปกติจุดวิกฤตจะน้อยกว่าจุดสั่งซื้อ
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({
                                                ...prev,
                                                min_stock_threshold: prev.reorder_point,
                                                reorder_point: prev.min_stock_threshold
                                            }))}
                                            className="shrink-0 text-xs font-semibold text-[var(--brand-plum)] hover:underline cursor-pointer"
                                        >
                                            สลับค่า
                                        </button>
                                    </div>
                                )}
                                {isEdit && (
                                    <p className="text-xs text-[var(--color-neutral)] leading-relaxed">
                                        แก้จำนวนคงเหลือได้จากปุ่มรับเข้า / เบิกออกที่หน้าสต๊อก เพื่อให้ประวัติถูกต้อง
                                    </p>
                                )}
                            </section>

                            {/* Image */}
                            <section className="space-y-3 pt-5 border-t border-[var(--color-paper-3)]">
                                <h3 className={sectionTitle}>รูปวัตถุดิบ</h3>
                                <div className="flex items-center gap-3">
                                    <div className="w-16 h-16 rounded-md overflow-hidden border border-[var(--color-rule)] bg-[var(--color-paper-2)] shrink-0">
                                        {formData.image_url ? (
                                            <img src={formData.image_url} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-[11px] text-[var(--color-neutral)]">ไม่มีรูป</div>
                                        )}
                                    </div>
                                    <label className={`h-11 px-4 inline-flex items-center rounded-md border border-dashed border-[oklch(78%_0.012_348.33)] text-sm ${ink} cursor-pointer hover:border-[var(--color-ink)] transition-colors`}>
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
                            {/* A bottle used by the millilitre needs its size. Once the converter says it, there is nothing to warn about. */}
                            {/* A แกลลอน is a jug of any size: the converter is left empty for the person to read off the label. */}
                            {formData.pack_unit === 'gallon' && formData.usage_unit !== 'gallon' && !(Number(formData.conversion_factor) > 1) ? (
                                <div className="border-l-2 border-[var(--brand-plum)] bg-[var(--color-paper)] px-3 py-2.5">
                                    <p className={`text-sm ${ink} leading-relaxed`}>
                                        แกลลอนมีหลายขนาด ใส่ตัวแปลงหน่วยตามฉลากของจริง เช่น 1 แกลลอน = 5,000 มล.
                                    </p>
                                </div>
                            ) : !areUnitTypesCompatible(formData.pack_unit, formData.usage_unit) && !(Number(formData.conversion_factor) > 1) && (
                                <div className="border-l-2 border-[var(--brand-plum)] bg-[var(--color-paper)] px-3 py-2.5">
                                    <p className={`text-sm ${ink} leading-relaxed`}>
                                        หน่วยซื้อ ({unitLabel(formData.pack_unit)}) กับหน่วยใช้ ({unitLabel(formData.usage_unit)}) เป็นคนละประเภท ใส่ตัวแปลงหน่วยตามของจริง เช่น 1 ขวด = 750 มล.
                                    </p>
                                </div>
                            )}

                            {/* 1. Buying or Base Yield */}
                            <section className="space-y-3">
                                <h3 className={sectionTitle}>
                                    {formData.is_base_recipe ? '1 · ต้นทุนและหน่วยต่อสูตร' : '1 · การซื้อ'}
                                </h3>
                                <div>
                                    <label className={labelCls} htmlFor="stock-cost">
                                        {formData.is_base_recipe ? 'ต้นทุนต่อ 1 สูตร (บาท)' : 'ราคาซื้อต่อแพ็ค (บาท)'}
                                    </label>
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
                                        <label className={labelCls} htmlFor="stock-pack-size">
                                            {formData.is_base_recipe ? 'จำนวนต่อรอบ (สูตร)' : 'จำนวนต่อการซื้อ'}
                                        </label>
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
                                        <label className={labelCls} htmlFor="stock-pack-unit">
                                            {formData.is_base_recipe ? 'หน่วยหลัก (ต่อสูตร)' : 'หน่วยซื้อ'}
                                        </label>
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
                            <section className="space-y-3 pt-5 border-t border-[var(--color-paper-3)]">
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
                            <section className="space-y-3 pt-5 border-t border-[var(--color-paper-3)]">
                                <h3 className={sectionTitle}>3 · ส่วนที่ใช้ได้จริง (Yield)</h3>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="range"
                                        min="1" max="100"
                                        aria-label="Yield %"
                                        value={formData.yield_percent}
                                        onChange={numberChange('yield_percent')}
                                        className="flex-1"
                                        style={{ accentColor: 'var(--color-ink)' }}
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
                                <p className="text-xs text-[var(--color-neutral)] leading-relaxed">
                                    ต่ำกว่า 100% เมื่อมีส่วนที่ทิ้ง เช่น เปลือก กาก ต้นทุนต่อหน่วยจริงจะสูงขึ้น
                                </p>
                                {formData.yield_percent !== '' && Number(formData.yield_percent) < 80 && (
                                    <p className="text-sm text-[var(--brand-plum)]">
                                        Yield ต่ำกว่า 80% ตรวจว่าสูญเสียมากขนาดนี้จริงหรือไม่
                                    </p>
                                )}
                            </section>

                            {/* Sweetener & In-house prep flags (kept below price so nobody taps them by accident) */}
                            <section className="space-y-3 pt-5 border-t border-[var(--color-paper-3)]">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="mt-0.5 w-4 h-4 accent-[var(--color-ink)]"
                                        checked={formData.is_sweetener === true}
                                        onChange={e => setFormData({ ...formData, is_sweetener: e.target.checked })}
                                    />
                                    <span>
                                        <span className={`block text-sm font-medium ${ink}`}>สารให้ความหวาน</span>
                                        <span className="block text-xs text-[var(--color-neutral)] leading-relaxed">
                                            เช่น น้ำเชื่อม น้ำตาล นมข้นหวาน น้ำผึ้ง เมื่อลูกค้าเลือก "หวานน้อย" ระบบตัดสต๊อกรายการนี้ตามตัวคูณของตัวเลือก
                                        </span>
                                    </span>
                                </label>
                                <label className="flex items-start gap-3 p-3 rounded-md border border-[var(--color-rule)] cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="mt-0.5 w-4 h-4 accent-[var(--color-ink)]"
                                        checked={formData.is_base_recipe}
                                        onChange={e => {
                                            const checked = e.target.checked;
                                            setFormData(prev => ({
                                                ...prev,
                                                is_base_recipe: checked,
                                                item_type: checked ? ITEM_TYPES.PREP : ITEM_TYPES.RAW,
                                                prep_mode: checked ? (prev.prep_mode || PREP_MODES.STOCKED) : null,
                                                ...(checked ? { unit: 'portion', pack_unit: 'portion', pack_size: 1 } : {})
                                            }));
                                        }}
                                    />
                                    <span>
                                        <span className={`block text-sm font-medium ${ink}`}>ทำเองในร้าน (ของเตรียม / สูตร)</span>
                                        <span className="block text-xs text-[var(--color-neutral)] leading-relaxed">
                                            ผลิตจากวัตถุดิบอื่น เช่น ซอส เบสชา พริกแกง (ยังแสดงในหน้าคลังตามปกติ และผูกสูตรส่วนผสมได้ใน Recipe Lab)
                                        </span>
                                    </span>
                                </label>
                            </section>

                            {/* Result: real cost per usage unit */}
                            <div className="flex items-baseline justify-between gap-3 p-4 rounded-md bg-[var(--color-paper-2)]">
                                <div>
                                    <div className="text-xs text-[var(--color-muted)]">ต้นทุนจริงต่อ 1 {unitLabel(formData.usage_unit)}</div>
                                    <div className="text-xs text-[var(--color-neutral)]">ราคา ÷ (จำนวน × ตัวแปลง × yield)</div>
                                </div>
                                <div className={`text-2xl font-semibold tabular-nums ${ink}`}>
                                    ฿{realCost.toFixed(4)}
                                </div>
                            </div>
                        </>
                    )}

                </div>

                <div className="px-5 py-4 border-t border-[var(--color-rule)] flex items-center gap-3">
                    {isEdit && (
                        <button
                            type="button"
                            onClick={async () => {
                                if (confirm('คุณแน่ใจหรือไม่ที่จะลบสินค้านี้? การลบจะไม่สามารถกู้คืนได้')) {
                                    setLoading(true);
                                    try {
                                        const { error } = await supabase.from('stock_items').delete().eq('id', item.id);
                                        if (error) throw error;
                                        logStaffActivity('stock', 'stock_item_delete', {
                                            amount: Number(item.current_quantity) || 0,
                                            reason: `ลบวัตถุดิบ: ${item.name} (คงเหลือเดิม ${item.current_quantity ?? 0} ${displayUnit(item.unit)})`,
                                            metadata: {
                                                module: 'stock',
                                                item_id: item.id,
                                                item_name: item.name,
                                                current_quantity: item.current_quantity,
                                                cost_price: item.cost_price
                                            }
                                        });
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
                            className="h-12 px-4 text-sm font-semibold text-[var(--brand-plum)] hover:underline disabled:opacity-50"
                        >
                            ลบ
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={loading}
                        className="flex-1 h-12 rounded-md bg-[var(--color-ink)] text-[var(--color-paper)] text-[15px] font-semibold hover:bg-[var(--color-ink)] transition-colors disabled:opacity-60"
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
