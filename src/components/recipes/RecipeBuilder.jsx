/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useMemo } from 'react';
import { AdminFilterChips } from '../admin/AdminKit';
import { supabase } from '../../lib/supabaseClient';
import { DndContext, useSensor, useSensors, PointerSensor, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
    Plus, Trash2, GripVertical, AlertTriangle, Layers, Pencil, X, 
    Search, Copy, Download, Rocket, Check 
} from 'lucide-react';
import { calculateRecipeCost, getLayerColor, calculateRealUnitCost } from '../../utils/costUtils';
import { THAI_UNITS, suggestConversionFactor, areUnitTypesCompatible } from '../../utils/unitUtils';
import { toast } from 'sonner';
import PriceSimulator from './PriceSimulator';
import { logStaffActivity } from '../../utils/auditLogger';
import { getItemType, hasPortionYield, buildLiveCostResolver, ITEM_TYPES, PREP_MODES } from '../../utils/recipeGraph';
import { convertRecipesForUnitChange, describeUnitChange } from '../../utils/recipeUnitChange';
import { unitFix } from '../../utils/recipeUnits';
import { saveRecipeVersion } from '../../utils/recipeVersions';
import RecipeHistoryModal from './RecipeHistoryModal';
import MakroPriceSheet from '../stock/MakroPriceSheet';
import MenuOptionStockPanel from './MenuOptionStockPanel';
import { makroPickPatch, describeMakroPick } from '../../utils/makroUnits';

// Price, size and photo from makro.pro, shared by the edit and quick-add windows below
function MakroPickButton({ term, current, unitsUnset, onApply }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="h-8 px-3 border border-[var(--color-ink)] text-[var(--color-ink)] text-xs font-semibold hover:bg-[var(--color-paper-2)] transition-colors whitespace-nowrap"
                title="ดึงราคา ขนาด และรูปจาก makro.pro"
            >
                ราคากลาง
            </button>
            {open && (
                <MakroPriceSheet
                    initialTerm={term || ''}
                    onClose={() => setOpen(false)}
                    onPick={(product) => {
                        const pick = makroPickPatch(product, current, unitsUnset === undefined ? {} : { unitsUnset });
                        onApply(pick.patch, describeMakroPick(product, pick), product);
                        setOpen(false);
                    }}
                />
            )}
        </>
    );
}

// ── 1. Mini Modal for Quick Stock Item Edit ──
function EditStockModal({ item, onClose, onSave }) {
    const [formData, setFormData] = useState({
        cost_price: item.cost_price || 0,
        pack_size: item.pack_size || 1,
        pack_unit: item.pack_unit || 'g',
        usage_unit: item.usage_unit || 'g',
        conversion_factor: item.conversion_factor || 1,
        yield_percent: item.yield_percent || 100,
        image_url: item.image_url || ''
    });
    const [makroNote, setMakroNote] = useState('');

    const isCompatible = areUnitTypesCompatible(formData.pack_unit, formData.usage_unit);
    const suggestedFactor = suggestConversionFactor(formData.pack_unit, formData.usage_unit);
    const isStandard = suggestedFactor !== null;
    const [useRatioMode, setUseRatioMode] = useState(false); 

    const realCostPerUsage = (formData.cost_price / (formData.pack_size * (parseFloat(formData.conversion_factor) || 1))) * (100 / formData.yield_percent);
    const costPerPackUnit = formData.cost_price / formData.pack_size;

    const handleUnitChange = (type, value) => {
        const newData = { ...formData, [type]: value };
        const factor = suggestConversionFactor(newData.pack_unit, newData.usage_unit);
        newData.conversion_factor = factor !== null ? factor : '';
        setFormData(newData);
    };

    const handleSave = () => {
        const costPrice = parseFloat(formData.cost_price);
        const packSize = parseFloat(formData.pack_size);
        const conversionFactorVal = parseFloat(formData.conversion_factor);
        const yieldPercent = parseFloat(formData.yield_percent);

        if (isNaN(costPrice) || costPrice < 0) {
            toast.error('ราคาต้นทุนต้องไม่ต่ำกว่า 0 บาท');
            return;
        }
        if (isNaN(packSize) || packSize <= 0) {
            toast.error('ปริมาณขนาดบรรจุภัณฑ์ (Pack Size) ต้องมากกว่า 0');
            return;
        }

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

        if (isNaN(yieldPercent) || yieldPercent < 1 || yieldPercent > 100) {
            toast.error('Yield % ต้องอยู่ระหว่าง 1 ถึง 100%');
            return;
        }

        onSave(item.id, formData);
    };

    return (
        <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4 font-sans backdrop-blur-xs">
            <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] w-full max-w-md p-6 shadow-2xl space-y-4 rounded-xs">
                <div className="flex justify-between items-start border-b border-[var(--color-rule)] pb-3">
                    <div>
                        <h3 className="text-base font-bold tabular-nums text-[var(--color-ink)]">
                            แก้ไขข้อมูลวัตถุดิบ: {item.name}
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-1 text-[var(--color-neutral)] hover:text-[var(--color-ink)]">
                        <X size={16} />
                    </button>
                </div>
                
                <div className="space-y-4 tabular-nums text-xs">
                    {!isCompatible && (
                        <div className="bg-[oklch(96%_0.03_80)] border border-[oklch(88%_0.06_80)] p-2.5 flex gap-2 items-start text-[oklch(35%_0.08_60)] rounded-xs">
                            <AlertTriangle className="w-4 h-4 text-[oklch(45%_0.10_60)] flex-shrink-0 mt-0.5" />
                            <div>
                                <div className="font-bold text-xs">การแปลงหน่วยข้ามประเภท</div>
                                <p className="text-[13px] text-[oklch(38%_0.08_60)] leading-normal font-sans">
                                    หน่วยซื้อ ({formData.pack_unit}) และหน่วยใช้จริง ({formData.usage_unit}) เป็นคนละประเภทกัน จำเป็นต้องป้อนตัวแปลงหน่วยด้วยตนเอง
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Buying Info */}
                    <div className="p-3 bg-[var(--color-paper)] border border-[var(--color-rule)] space-y-2 rounded-xs">
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs text-[var(--color-ink)]">
                                1. ข้อมูลการซื้อ
                            </span>
                            <MakroPickButton
                                term={item.name}
                                current={formData}
                                onApply={(patch, note) => {
                                    setFormData(prev => ({ ...prev, ...patch }));
                                    setMakroNote(note);
                                }}
                            />
                        </div>
                        {makroNote && (
                            <div className="flex items-center gap-2 text-xs text-[var(--color-muted)] font-sans">
                                {formData.image_url && <img src={formData.image_url} alt="" className="w-8 h-8 object-cover border border-[var(--color-rule)]" />}
                                <span className="leading-snug">{makroNote} · กดบันทึกเพื่อใช้</span>
                            </div>
                        )}
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <span className="text-xs text-[var(--color-neutral)] block mb-0.5">ราคาซื้อ (บาท)</span>
                                <input 
                                    type="number" 
                                    value={formData.cost_price} 
                                    onChange={e => setFormData({...formData, cost_price: e.target.value === '' ? 0 : parseFloat(e.target.value)})} 
                                    className="w-full p-1.5 border border-[var(--color-rule)] bg-[var(--color-paper)] text-sm" 
                                />
                            </div>
                            <div>
                                <span className="text-xs text-[var(--color-neutral)] block mb-0.5">ปริมาณต่อแพ็ค</span>
                                <input 
                                    type="number" 
                                    value={formData.pack_size} 
                                    onChange={e => setFormData({...formData, pack_size: e.target.value === '' ? 0 : parseFloat(e.target.value)})} 
                                    className="w-full p-1.5 border border-[var(--color-rule)] bg-[var(--color-paper)] text-sm" 
                                />
                            </div>
                            <div>
                                <span className="text-xs text-[var(--color-neutral)] block mb-0.5">หน่วยแพ็ค</span>
                                <select 
                                    value={formData.pack_unit} 
                                    onChange={e => handleUnitChange('pack_unit', e.target.value)} 
                                    className="w-full p-1.5 border border-[var(--color-rule)] bg-[var(--color-paper)] text-sm"
                                >
                                    {THAI_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="text-xs text-[var(--color-neutral)] text-right">
                            เฉลี่ย ฿{costPerPackUnit.toFixed(4)} / {formData.pack_unit}
                        </div>
                    </div>

                    {/* Usage Info */}
                    <div className="p-3 bg-[var(--color-paper)] border border-[var(--color-rule)] space-y-2 rounded-xs">
                        <span className="font-bold text-xs text-[var(--color-ink)] block">
                            2. หน่วยที่ใช้ในสูตร
                        </span>
                        <div className="flex gap-2 items-center">
                            <div className="flex-1">
                                <span className="text-xs text-[var(--color-neutral)] block mb-0.5">หน่วยที่ตวงในสูตร</span>
                                <select
                                    value={formData.usage_unit} 
                                    onChange={e => handleUnitChange('usage_unit', e.target.value)} 
                                    className="w-full p-1.5 border border-[var(--color-rule)] bg-[var(--color-paper)] text-sm" 
                                >
                                    {THAI_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                                </select>
                            </div>
                            <div className="w-24">
                                <span className="text-xs text-[var(--color-neutral)] block mb-0.5">YIELD %</span>
                                <input 
                                    type="number"
                                    value={formData.yield_percent}
                                    onChange={e => setFormData({...formData, yield_percent: e.target.value === '' ? 100 : parseFloat(e.target.value)})}
                                    className="w-full p-1.5 border border-[var(--color-rule)] bg-[var(--color-paper)] text-sm text-center"
                                />
                            </div>
                        </div>

                        {/* Conversion factor display */}
                        <div className="p-2 bg-[var(--color-paper-2)] border border-[var(--color-paper-3)] text-xs">
                            {isStandard ? (
                                <div className="flex items-center justify-between text-[var(--color-muted)]">
                                    <span className="font-bold">มาตรฐานสากล</span>
                                    <span>1 {formData.pack_unit} = <strong>{suggestedFactor}</strong> {formData.usage_unit}</span>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex justify-between items-center mb-1 text-xs">
                                        <span className="font-bold">กำหนดสัดส่วนตัวแปลง:</span>
                                        <button 
                                            type="button"
                                            onClick={() => setUseRatioMode(!useRatioMode)}
                                            className="text-[var(--brand-plum)] hover:underline"
                                        >
                                            {useRatioMode ? "สลับเป็น × (คูณ)" : "สลับเป็น ÷ (หาร)"}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span>1 {formData.pack_unit} =</span>
                                        <input 
                                            type="number" 
                                            className="w-20 p-1 border border-[var(--color-rule)] bg-[var(--color-paper)] text-center"
                                            value={formData.conversion_factor}
                                            onChange={e => setFormData({...formData, conversion_factor: e.target.value === '' ? '' : parseFloat(e.target.value)})}
                                        />
                                        <span>{formData.usage_unit}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cost Preview */}
                    <div className="p-3 border border-[var(--color-rule)] bg-[var(--color-paper-2)] flex justify-between items-center rounded-xs">
                        <span className="text-xs font-bold text-[var(--color-muted)]">ต้นทุนจริงสุทธิต่อหน่วย:</span>
                        <div className="font-bold text-sm text-[var(--color-ink)]">
                            ฿{realCostPerUsage.toFixed(4)} <span className="text-xs text-[var(--color-neutral)]">/ {formData.usage_unit}</span>
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-[var(--color-rule)]">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="admin-btn h-9 flex-1"
                        >
                            ยกเลิก
                        </button>
                        <button 
                            type="button" 
                            onClick={handleSave} 
                            className="admin-btn is-primary h-9 flex-1"
                        >
                            บันทึก
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── 2. Quick Add Stock Modal ──
function QuickAddStockModal({ onClose, onSave }) {
    const [categories, setCategories] = useState([]);
    const [formData, setFormData] = useState({
        name: '',
        category: 'veg',
        cost_price: 0,
        pack_size: 1,
        pack_unit: 'kg',
        usage_unit: 'g',
        conversion_factor: 1000,
        yield_percent: 100,
        image_url: ''
    });
    const [makroNote, setMakroNote] = useState('');

    useEffect(() => {
        const fetchCats = async () => {
            const { data } = await supabase.from('stock_categories').select('*').order('sort_order');
            if (data && data.length > 0) setCategories(data);
        };
        fetchCats();
    }, []);

    const isCompatible = areUnitTypesCompatible(formData.pack_unit, formData.usage_unit);

    const handleUnitChange = (type, value) => {
        const newData = { ...formData, [type]: value };
        const factor = suggestConversionFactor(newData.pack_unit, newData.usage_unit);
        newData.conversion_factor = factor !== null ? factor : (type === 'usage_unit' && value === 'unit' ? 1 : 1);
        setFormData(newData);
    };

    const handleSave = () => {
        if (!formData.name.trim()) return toast.error('กรุณาระบุชื่อวัตถุดิบ');
        if (formData.cost_price < 0) return toast.error('ราคาซื้อต้องไม่ต่ำกว่า 0');
        if (formData.pack_size <= 0) return toast.error('ปริมาณต้องมากกว่า 0');
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4 font-sans backdrop-blur-xs">
            <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] w-full max-w-md p-6 shadow-2xl space-y-4 rounded-xs">
                <div className="flex justify-between items-start border-b border-[var(--color-rule)] pb-3">
                    <div>
                        <h3 className="text-base font-bold tabular-nums text-[var(--color-ink)]">
                            สร้างวัตถุดิบใหม่เข้าคลังสต็อก
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-1 text-[var(--color-neutral)] hover:text-[var(--color-ink)]">
                        <X size={16} />
                    </button>
                </div>

                <div className="space-y-3 tabular-nums text-xs">
                    <div>
                        <label className="text-xs text-[var(--color-neutral)] block mb-1">ชื่อวัตถุดิบ *</label>
                        <div className="flex items-center gap-2">
                            <input 
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                placeholder="เช่น ไซรัปมะพร้าวน้ำหอม, ผงโกโก้พรีเมียม"
                                className="w-full p-2 border border-[var(--color-rule)] bg-[var(--color-paper)] font-sans text-sm"
                                autoFocus
                            />
                            <MakroPickButton
                                term={formData.name}
                                current={formData}
                                unitsUnset={true}
                                onApply={(patch, note, product) => {
                                    setFormData(prev => ({ ...prev, name: prev.name.trim() ? prev.name : product.title, ...patch }));
                                    setMakroNote(note);
                                }}
                            />
                        </div>
                        {makroNote && (
                            <div className="mt-2 flex items-center gap-2 text-xs text-[var(--color-muted)] font-sans">
                                {formData.image_url && <img src={formData.image_url} alt="" className="w-8 h-8 object-cover border border-[var(--color-rule)]" />}
                                <span className="leading-snug">{makroNote}</span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs text-[var(--color-neutral)] block mb-1">หมวดหมู่</label>
                            <select 
                                value={formData.category}
                                onChange={e => setFormData({...formData, category: e.target.value})}
                                className="w-full p-2 border border-[var(--color-rule)] bg-[var(--color-paper)] text-sm"
                            >
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-[var(--color-neutral)] block mb-1">ราคาซื้อ (บาท)</label>
                            <input 
                                type="number" 
                                value={formData.cost_price} 
                                onChange={e => setFormData({...formData, cost_price: parseFloat(e.target.value) || 0})}
                                className="w-full p-2 border border-[var(--color-rule)] bg-[var(--color-paper)] text-sm" 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="text-xs text-[var(--color-neutral)] block mb-1">ขนาดบรรจุ</label>
                            <input 
                                type="number" 
                                value={formData.pack_size} 
                                onChange={e => setFormData({...formData, pack_size: parseFloat(e.target.value) || 1})}
                                className="w-full p-2 border border-[var(--color-rule)] bg-[var(--color-paper)] text-sm" 
                            />
                        </div>
                        <div>
                            <label className="text-xs text-[var(--color-neutral)] block mb-1">หน่วยซื้อ</label>
                            <select 
                                value={formData.pack_unit} 
                                onChange={e => handleUnitChange('pack_unit', e.target.value)} 
                                className="w-full p-2 border border-[var(--color-rule)] bg-[var(--color-paper)] text-sm"
                            >
                                {THAI_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-[var(--color-neutral)] block mb-1">หน่วยใช้</label>
                            <select 
                                value={formData.usage_unit} 
                                onChange={e => handleUnitChange('usage_unit', e.target.value)} 
                                className="w-full p-2 border border-[var(--color-rule)] bg-[var(--color-paper)] text-sm"
                            >
                                {THAI_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {(!isCompatible || Number(formData.conversion_factor) !== 1) && (
                        <div className="p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[var(--color-ink)] text-xs">
                            1 {formData.pack_unit} = <input 
                                type="number" 
                                className="w-16 p-0.5 border border-[oklch(85%_0.06_80)] bg-[var(--color-paper)] text-center" 
                                value={formData.conversion_factor} 
                                onChange={e => setFormData({...formData, conversion_factor: parseFloat(e.target.value) || 1})} 
                            /> {formData.usage_unit}
                        </div>
                    )}

                    <div className="flex gap-2 pt-2 border-t border-[var(--color-rule)]">
                        <button type="button" onClick={onClose} className="admin-btn h-9 flex-1">
                            ยกเลิก
                        </button>
                        <button type="button" onClick={handleSave} className="admin-btn is-primary h-9 flex-1">
                            สร้างและเพิ่มเข้าสูตร
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── 3. Recipe Import Modal ──
function RecipeImportModal({ onClose, onImport }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [templates, setTemplates] = useState([]);

    useEffect(() => {
        const fetchTemplates = async () => {
            setLoading(true);
            try {
                const { data: menus } = await supabase.from('menu_items').select('id, name, price').order('name');
                const { data: stocks } = await supabase.from('stock_items').select('id, name').eq('is_base_recipe', true).order('name');

                const list = [
                    ...(menus || []).map(m => ({ ...m, type: 'menu' })),
                    ...(stocks || []).map(s => ({ ...s, type: 'stock' }))
                ];
                setTemplates(list);
            } catch (err) {
                console.error(err);
                toast.error('โหลดข้อมูลต้นแบบไม่สำเร็จ');
            } finally {
                setLoading(false);
            }
        };
        fetchTemplates();
    }, []);

    const handleSelect = async (template) => {
        try {
            const queryField = template.type === 'menu' ? 'parent_menu_item_id' : 'parent_stock_item_id';
            const { data, error } = await supabase
                .from('recipe_ingredients')
                .select(`*, ingredient:stock_items!recipe_ingredients_ingredient_id_fkey(*)`)
                .eq(queryField, template.id)
                .order('layer_order');

            if (error) throw error;
            if (!data || data.length === 0) {
                toast.info('รายการนี้ยังไม่มีสูตร');
                return;
            }

            const ingredients = data.map(r => ({
                ingredientId: r.ingredient_id,
                ingredient: r.ingredient,
                quantity: r.quantity,
                unit: r.unit
            }));

            onImport(ingredients);
            onClose();
        } catch (err) {
            console.error(err);
            toast.error('นำเข้าสูตรไม่สำเร็จ');
        }
    };

    const filtered = templates.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 font-sans backdrop-blur-xs">
            <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] w-full max-w-md shadow-2xl rounded-xs overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-3.5 border-b border-[var(--color-rule)] bg-[var(--color-paper-2)] flex justify-between items-center tabular-nums">
                    <span className="font-bold text-xs text-[var(--color-ink)]">
                        นำเข้าสูตรจากต้นแบบ
                    </span>
                    <button onClick={onClose} className="p-1 text-[var(--color-neutral)] hover:text-[var(--color-ink)]">
                        <X size={16}/>
                    </button>
                </div>
                
                <div className="p-3 border-b border-[var(--color-rule)] bg-[var(--color-paper)]">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-neutral)]" size={14} />
                        <input 
                            className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] py-1.5 pl-8 pr-3 text-sm outline-none focus:border-[var(--color-ink)]"
                            placeholder="ค้นหาชื่อเมนู หรือ Base Recipe..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1 tabular-nums text-xs divide-y divide-[var(--color-paper-3)]">
                    {loading ? (
                        <div className="text-center py-10 text-[var(--color-neutral)]">กำลังโหลดต้นแบบ...</div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-10 text-[var(--color-neutral)]">ไม่พบรายการที่ค้นหา</div>
                    ) : (
                        filtered.map(item => (
                            <button
                                key={`${item.type}-${item.id}`}
                                onClick={() => handleSelect(item)}
                                className="w-full text-left p-2.5 hover:bg-[var(--color-paper-2)] flex justify-between items-center transition-colors cursor-pointer"
                            >
                                <div>
                                    <div className="font-bold text-sm text-[var(--color-ink)]">{item.name}</div>
                                    <span className="text-xs text-[var(--color-neutral)] ">
                                        {item.type === 'menu' ? 'MENU ITEM' : 'BASE RECIPE'}
                                    </span>
                                </div>
                                <span className="text-xs font-bold text-[var(--brand-plum)]">
                                    เลือกนำเข้า →
                                </span>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

// ── 4. Export Template Modal ──
function ExportTemplateModal({ onClose, onSave }) {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) return toast.error('กรุณาตั้งชื่อ Template');
        setLoading(true);
        try {
            await onSave(name);
        } catch (err) {
            console.error(err);
            toast.error('บันทึกไม่สำเร็จ');
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 font-sans backdrop-blur-xs">
            <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] w-full max-w-sm p-5 shadow-2xl rounded-xs space-y-4 tabular-nums text-xs">
                <div className="border-b border-[var(--color-rule)] pb-2">
                    <h3 className="font-bold text-sm text-[var(--color-ink)] ">บันทึกสูตรเป็น Template กลาง</h3>
                </div>
                
                <div className="space-y-2">
                    <label className="text-xs text-[var(--color-neutral)] block">ชื่อ Template (Base Recipe) *</label>
                    <input 
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full p-2 border border-[var(--color-rule)] bg-[var(--color-paper)]"
                        placeholder="เช่น สูตรชาเขียวเข้มข้นมาตรฐาน..."
                        autoFocus
                    />
                    <p className="text-[13px] text-[var(--color-neutral)] leading-relaxed">
                        ระบบจะสร้างเป็นวัตถุดิบประเภท "Base Recipe" ให้โดยอัตโนมัติใน Recipe Lab
                    </p>
                </div>

                <div className="flex gap-2 pt-2 border-t border-[var(--color-rule)]">
                    <button type="button" onClick={onClose} className="admin-btn h-9 flex-1">
                        ยกเลิก
                    </button>
                    <button 
                        type="button"
                        onClick={handleSave}
                        disabled={loading || !name}
                        className="admin-btn is-primary h-9 flex-1 disabled:opacity-50"
                    >
                        {loading ? 'กำลังบันทึก...' : 'บันทึก Template'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── 5. Promote Modal (Base Recipe -> Menu Item) ──
function PromoteModal({ initialName, onClose, onPromote }) {
    const [name, setName] = useState(initialName || '');
    const [price, setPrice] = useState('');
    const [loading, setLoading] = useState(false);

    const handlePromote = () => {
        if (!name.trim()) return toast.error('กรุณาระบุชื่อเมนู');
        if (!price || parseFloat(price) < 0) return toast.error('ราคาขายไม่ถูกต้อง');
        
        setLoading(true);
        onPromote(name, parseFloat(price)).finally(() => setLoading(false));
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 font-sans backdrop-blur-xs">
            <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] w-full max-w-sm p-5 shadow-2xl rounded-xs space-y-4 tabular-nums text-xs">
                <div className="border-b border-[var(--color-rule)] pb-2">
                    <h3 className="font-bold text-sm text-[var(--color-ink)] ">แปลงเป็นเมนูขายหน้าร้าน</h3>
                </div>
                
                <div className="space-y-3">
                    <div>
                        <label className="text-xs text-[var(--color-neutral)] block mb-1">ชื่อเมนู (Menu Name) *</label>
                        <input 
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full p-2 border border-[var(--color-rule)] bg-[var(--color-paper)]"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="text-xs text-[var(--color-neutral)] block mb-1">ราคาขายหน้าร้าน (Selling Price) *</label>
                        <input 
                            type="number"
                            value={price}
                            onChange={e => setPrice(e.target.value)}
                            className="w-full p-2 border border-[var(--color-rule)] bg-[var(--color-paper)] text-base"
                            placeholder="0.00"
                        />
                    </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-[var(--color-rule)]">
                    <button type="button" onClick={onClose} className="admin-btn h-9 flex-1">
                        ยกเลิก
                    </button>
                    <button 
                        type="button"
                        onClick={handlePromote}
                        disabled={loading}
                        className="admin-btn is-primary h-9 flex-1 disabled:opacity-50"
                    >
                        {loading ? 'กำลังประมวลผล...' : 'แปลงเป็นเมนู'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── 6. Sortable Layer Component (Dieter Rams Minimalist Row) ──
function SortableLayer({ id, ingredient, quantity, unit, cost, unitCost, index, onDelete, onUpdate, onEditStock }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    const itemType = getItemType(ingredient);
    const isBaseRecipe = itemType !== ITEM_TYPES.RAW;
    const missingYield = !hasPortionYield(ingredient);

    return (
        <div 
            ref={setNodeRef} style={style} {...attributes}
            className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 p-2.5 border border-[var(--color-rule)] bg-[var(--color-paper)] hover:border-[var(--color-ink)] transition-colors rounded-xs tabular-nums text-xs"
        >
            <div {...listeners} className="cursor-grab text-[var(--color-neutral)] hover:text-[var(--color-ink)] flex-shrink-0" title="ลากเพื่อเรียงลำดับ">
                <GripVertical size={16} />
            </div>
            
            {/* Visual Layer Marker */}
            <div className={`w-1.5 h-9 flex-shrink-0 ${getLayerColor(index)}`}></div>

            <div className="flex-1 min-w-[11rem] pr-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-sm text-[var(--color-ink)] font-sans truncate">
                        {ingredient.name}
                    </span>
                    {isBaseRecipe && (
                        <span className="text-[11px] font-sans font-bold px-1 leading-5 bg-[var(--color-paper-2)] text-[var(--brand-plum)] border border-[var(--color-rule)] whitespace-nowrap">
                            {itemType === ITEM_TYPES.PREP ? 'ของเตรียม' : 'สูตร'}
                        </span>
                    )}
                </div>
                {missingYield && (
                    <div className="text-xs font-sans leading-5 text-[var(--brand-plum)]">
                        ยังไม่ได้ระบุปริมาณต่อ portion ต้นทุนบรรทัดนี้ยังไม่ถูก
                    </div>
                )}
                <button 
                    type="button"
                    onClick={() => onEditStock(ingredient)}
                    className="text-xs text-[var(--color-neutral)] hover:text-[var(--color-ink)] hover:underline flex items-center gap-1 transition-colors mt-0.5 cursor-pointer"
                >
                    <span>฿{unitCost?.toFixed(4) || 0} / {ingredient.usage_unit}</span>
                    <span className="text-xs font-medium whitespace-nowrap">แก้ข้อมูลสต็อก</span>
                </button>
            </div>

            {/* Quantity, cost and delete stay together; on narrow screens they drop below the name */}
            <div className="ml-auto flex items-center gap-2.5 flex-shrink-0">
            {/* Quantity Input */}
            <div className="flex items-center gap-1 flex-shrink-0">
                <input 
                    type="number" 
                    className="w-16 bg-[var(--color-paper)] border border-[var(--color-rule)] p-1 text-right text-sm outline-none focus:border-[var(--color-ink)]"
                    value={quantity ?? ''}
                    placeholder="0"
                    onChange={(e) => {
                        const val = e.target.value;
                        onUpdate(id, val === '' ? 0 : parseFloat(val));
                    }}
                />
                <span className="text-xs text-[var(--color-neutral)] min-w-7 max-w-16 whitespace-nowrap" title={unit}>{unit}</span>
            </div>

            {/* Layer Cost Readout */}
            <div className="text-right w-16 md:w-20 flex-shrink-0 tabular-nums">
                <div className="font-bold text-[var(--color-ink)] text-xs">
                    ฿{isNaN(cost) ? '0.00' : cost.toFixed(2)}
                </div>
            </div>

            {/* Delete button */}
            <button 
                type="button" 
                onClick={() => onDelete(id)} 
                className="p-1 text-[var(--color-neutral)] hover:text-red-700 cursor-pointer flex-shrink-0"
                title="ลบส่วนผสมนี้"
            >
                <Trash2 size={14} />
            </button>
            </div>
        </div>
    );
}

// ── 7. Main RecipeBuilder Component ──
export default function RecipeBuilder({ parentId, parentType = 'menu', initialPrice = 0, onClose }) {
    const [ingredients, setIngredients] = useState([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [availableItems, setAvailableItems] = useState([]);
    const [parentItem, setParentItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [itemFilterType, setItemFilterType] = useState('all'); // 'all' | 'raw' | 'base'
    
    // Cost State
    const [totalCost, setTotalCost] = useState(0);
    const [currentPrice, setCurrentPrice] = useState(initialPrice || 0);

    // Sub-modals State
    const [editingStockItem, setEditingStockItem] = useState(null);
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [isPromoteOpen, setIsPromoteOpen] = useState(false);
    const [isMobilePickerOpen, setIsMobilePickerOpen] = useState(false);

    // Inline Renaming
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState('');

    const [targetFoodCostPct, setTargetFoodCostPct] = useState(30);

    // Recipes of every made item, so nested costs follow today's ingredient prices
    const [stockRecipeRows, setStockRecipeRows] = useState([]);

    // What one making of this recipe is (only when the parent is a stock item)
    const [portionForm, setPortionForm] = useState({
        itemType: ITEM_TYPES.PREP,
        prepMode: PREP_MODES.STOCKED,
        yieldQty: '',
        yieldUnit: 'g'
    });

    const sensors = useSensors(useSensor(PointerSensor));

    const handleStartEditName = () => {
        if (parentItem) {
            setTempName(parentItem.name);
            setIsEditingName(true);
        }
    };

    const handleSaveName = async () => {
        if (!tempName.trim()) return;
        try {
            const table = parentType === 'menu' ? 'menu_items' : 'stock_items';
            const { error } = await supabase
                .from(table)
                .update({ name: tempName.trim() })
                .eq('id', parentId);
            
            if (error) throw error;
            
            setParentItem(prev => prev ? { ...prev, name: tempName.trim() } : null);
            setIsEditingName(false);
            toast.success('เปลี่ยนชื่อสำเร็จ');
        } catch (err) {
            console.error(err);
            toast.error('เปลี่ยนชื่อล้มเหลว');
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Existing Recipe Ingredients
            const queryField = parentType === 'menu' ? 'parent_menu_item_id' : 'parent_stock_item_id';
            const { data: recipeData } = await supabase
                .from('recipe_ingredients')
                .select(`*, ingredient:stock_items!recipe_ingredients_ingredient_id_fkey(*)`)
                .eq(queryField, parentId)
                .order('layer_order');

            if (recipeData) {
                const mapped = recipeData.map(r => {
                    let effectiveUnit = r.unit;
                    if (r.unit === 'unit' && r.ingredient?.usage_unit && r.ingredient.usage_unit !== 'unit') {
                        effectiveUnit = r.ingredient.usage_unit;
                    }
                    return {
                        id: r.id,
                        ingredientId: r.ingredient_id,
                        ingredient: r.ingredient,
                        quantity: r.quantity,
                        unit: effectiveUnit
                    };
                });
                setIngredients(mapped);
            }

            // 2. Fetch Parent Info
            const { data: parentData } = await supabase
                .from(parentType === 'menu' ? 'menu_items' : 'stock_items')
                .select('*')
                .eq('id', parentId)
                .single();
            setParentItem(parentData);
            if (parentType === 'menu' && parentData?.price) {
                setCurrentPrice(parentData.price);
            }
            if (parentType === 'stock' && parentData) {
                const type = getItemType(parentData);
                setPortionForm({
                    itemType: type === ITEM_TYPES.RAW ? ITEM_TYPES.PREP : type,
                    prepMode: parentData.prep_mode || PREP_MODES.STOCKED,
                    yieldQty: parentData.portion_yield_qty ?? '',
                    yieldUnit: parentData.usage_unit && parentData.usage_unit !== 'unit' ? parentData.usage_unit : 'g'
                });
            }

            // 3. Fetch All Stock Items for Picker
            const { data: stocks } = await supabase
                .from('stock_items')
                .select('*')
                .order('name');
            setAvailableItems(stocks || []);

            const { data: nestedRows } = await supabase
                .from('recipe_ingredients')
                .select('parent_stock_item_id, ingredient_id, quantity')
                .not('parent_stock_item_id', 'is', null);
            setStockRecipeRows(nestedRows || []);

            // 4. Fetch Target Food Cost % Setting
            const { data: settings } = await supabase.from('store_settings').select('target_food_cost_pct').single();
            if (settings?.target_food_cost_pct) setTargetFoodCostPct(settings.target_food_cost_pct);

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (parentId) loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [parentId]);

    // Made items are costed from their own ingredients at today's prices.
    const liveCost = useMemo(
        () => buildLiveCostResolver(availableItems, stockRecipeRows),
        [availableItems, stockRecipeRows]
    );
    const resolveItem = (id, fallback) => liveCost.getItem(id) || fallback;

    // Recalculate Total Cost
    useEffect(() => {
        const breakdown = calculateRecipeCost(ingredients.map(i => ({
            ingredient_id: i.ingredientId,
            quantity: i.quantity,
            unit: i.unit
        })), (id) => {
            return liveCost.getItem(id) || ingredients.find(x => x.ingredientId === id)?.ingredient;
        });

        setTotalCost(breakdown.totalCost);
    }, [ingredients, liveCost]);

    const isPrep = parentType === 'stock' && portionForm.itemType === ITEM_TYPES.PREP;
    const yieldQtyNum = parseFloat(portionForm.yieldQty);
    const hasYield = Number.isFinite(yieldQtyNum) && yieldQtyNum > 0;
    const costPerUsageUnit = isPrep && hasYield ? totalCost / yieldQtyNum : null;

    const handleAddIngredient = (item) => {
        if (item.id === parentId) {
            toast.error('ไม่สามารถใส่ตัวเองเป็นส่วนผสมได้ (Circular Loop)');
            return;
        }

        const newLink = {
            id: 'temp-' + Date.now(),
            ingredientId: item.id,
            ingredient: item,
            quantity: 1,
            unit: item.usage_unit || 'unit'
        };

        setIngredients(prev => [...prev, newLink]);
        toast.success(`เพิ่ม "${item.name}" แล้ว`);
    };

    const handleSave = async () => {
        if (isPrep && !hasYield) {
            toast.error('กรุณาระบุปริมาณที่ได้ต่อ 1 portion ก่อนบันทึก');
            return;
        }
        setLoading(true);
        try {
            const payloadItems = ingredients.map((ing, idx) => ({
                ingredient_id: ing.ingredientId,
                quantity: ing.quantity,
                unit: ing.unit,
                layer_order: idx
            }));

            if (parentType === 'menu') {
                let rpcSucceeded = false;
                try {
                    const { data: rpcData, error: rpcError } = await supabase.rpc('save_menu_recipe', {
                        p_menu_id: parentId,
                        p_ingredients: payloadItems
                    });
                    if (!rpcError && rpcData && rpcData.success !== false) {
                        rpcSucceeded = true;
                    }
                } catch { /* ignore fallback */ }

                if (!rpcSucceeded) {
                    const queryField = 'parent_menu_item_id';
                    await supabase.from('recipe_ingredients').delete().eq(queryField, parentId);
                    if (payloadItems.length > 0) {
                        const payloads = payloadItems.map(p => ({ [queryField]: parentId, ...p }));
                        await supabase.from('recipe_ingredients').insert(payloads);
                    }
                }

                if (currentPrice !== undefined && currentPrice !== null && !isNaN(parseFloat(currentPrice))) {
                    await supabase.from('menu_items').update({ price: parseFloat(currentPrice) }).eq('id', parentId);
                }
            } else {
                const queryField = 'parent_stock_item_id';
                await supabase.from('recipe_ingredients').delete().eq(queryField, parentId);
                if (payloadItems.length > 0) {
                    const payloads = payloadItems.map(p => ({ [queryField]: parentId, ...p }));
                    await supabase.from('recipe_ingredients').insert(payloads);
                }
                // What one making of this recipe is, and what it costs
                const legacyFields = isPrep
                    ? { cost_price: totalCost, pack_size: 1, pack_unit: 'unit', unit: 'portion', usage_unit: portionForm.yieldUnit, conversion_factor: yieldQtyNum }
                    : { cost_price: totalCost };
                const typedFields = isPrep
                    ? { ...legacyFields, item_type: ITEM_TYPES.PREP, prep_mode: portionForm.prepMode, portion_yield_qty: yieldQtyNum }
                    : { ...legacyFields, item_type: ITEM_TYPES.RECIPE };
                const { error: typedErr } = await supabase.from('stock_items').update(typedFields).eq('id', parentId);
                if (typedErr) {
                    // Database without the item_type columns yet: keep cost and yield at least.
                    const { error: legacyErr } = await supabase.from('stock_items').update(legacyFields).eq('id', parentId);
                    if (legacyErr) throw legacyErr;
                }
                // Menus that use this base wrote their amount in its old unit (ml -> g etc.)
                if (isPrep && parentItem?.usage_unit && parentItem.usage_unit !== portionForm.yieldUnit) {
                    const res = await convertRecipesForUnitChange(parentId, parentItem.usage_unit, portionForm.yieldUnit);
                    const note = describeUnitChange(res, parentItem.usage_unit, portionForm.yieldUnit);
                    if (note) (res.failed || res.manual ? toast.warning : toast.info)(note, { duration: 8000 });
                    // Saving again must not convert a second time
                    if (!res.failed) setParentItem(prev => (prev ? { ...prev, usage_unit: portionForm.yieldUnit } : prev));
                }
            }

            logStaffActivity('sop', 'recipe_save', {
                reason: `บันทึกส่วนผสมสูตร ${parentType === 'menu' ? 'เมนู' : 'สูตรกลาง'}: ${parentItem?.name || parentId}`,
                metadata: {
                    parent_id: parentId,
                    parent_type: parentType,
                    name: parentItem?.name,
                    ingredients_count: payloadItems.length,
                    total_cost: totalCost,
                    price: currentPrice
                }
            });

            // History: one snapshot per save that changed something (never blocks the save)
            await saveRecipeVersion({ parentType, parentId, ingredients, totalCost });

            toast.success('บันทึกสูตรเรียบร้อย');
            onClose();
        } catch (err) {
            console.error(err);
            toast.error('บันทึกไม่สำเร็จ: ' + (err.message || 'Unknown Error'));
        } finally {
            setLoading(false);
        }
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (active && over && active.id !== over.id) {
            setIngredients((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleUpdateStock = async (id, newFormData) => {
        try {
            // Same model as the stock item form: the item is counted in its purchase unit.
            newFormData = { ...newFormData, unit: newFormData.pack_unit };
            const before = availableItems.find(i => i.id === id);
            const { error } = await supabase.from('stock_items').update(newFormData).eq('id', id);
            if (error) throw error;
            const oldUsage = before?.usage_unit;
            const newUsage = newFormData.usage_unit;
            const unitChanged = oldUsage && newUsage && oldUsage !== newUsage;
            if (unitChanged) {
                const res = await convertRecipesForUnitChange(id, oldUsage, newUsage);
                const note = describeUnitChange(res, oldUsage, newUsage);
                if (note) (res.failed || res.manual ? toast.warning : toast.info)(note, { duration: 8000 });
            }
                        
            toast.success('อัปเดตข้อมูลวัตถุดิบแล้ว');
            setEditingStockItem(null);

            setAvailableItems(prev => prev.map(item => item.id === id ? { ...item, ...newFormData } : item));
            setIngredients(prev => prev.map(p => {
                if (p.ingredientId === id) {
                    // This open recipe too: same amount in the new unit, so saving it keeps it right.
                    const fix = unitChanged ? unitFix(p.quantity, oldUsage, newUsage) : null;
                    return {
                        ...p,
                        ...(fix?.kind === 'convert' ? { quantity: fix.quantity } : {}),
                        ingredient: { ...p.ingredient, ...newFormData },
                        unit: newFormData.usage_unit  
                    };
                }
                return p;
            }));
        } catch (err) {
            console.error(err);
            toast.error('อัปเดตไม่สำเร็จ');
        }
    };

    const handleCreateStock = async (formData) => {
        try {
            const payload = {
                ...formData,
                unit: formData.pack_unit,
                current_quantity: 0,
                min_stock_threshold: 0
            };

            const { data, error } = await supabase.from('stock_items').insert(payload).select().single();
            if (error) throw error;

            toast.success('สร้างวัตถุดิบใหม่แล้ว');
            setAvailableItems(prev => [...prev, data].sort((a,b) => a.name.localeCompare(b.name)));
            setIsQuickAddOpen(false);
            handleAddIngredient(data);
        } catch (err) {
            console.error(err);
            toast.error('สร้างวัตถุดิบไม่สำเร็จ');
        }
    };

    const handleExport = async (templateName) => {
        try {
            const { data: newItem, error: createError } = await supabase
                .from('stock_items')
                .insert({
                    name: templateName,
                    category: 'restock',
                    is_base_recipe: true,
                    cost_price: totalCost,
                    pack_size: 1,
                    pack_unit: 'unit',
                    usage_unit: 'unit',
                    unit: 'unit',
                    current_quantity: 0
                })
                .select()
                .single();

            if (createError) throw createError;

            const payloadItems = ingredients.map((ing, idx) => ({
                parent_stock_item_id: newItem.id,
                ingredient_id: ing.ingredientId,
                quantity: ing.quantity,
                unit: ing.unit,
                layer_order: idx
            }));

            if (payloadItems.length > 0) {
                await supabase.from('recipe_ingredients').insert(payloadItems);
            }

            toast.success(`บันทึก Template "${templateName}" เรียบร้อย`);
            setIsExportOpen(false);
            setAvailableItems(prev => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)));
        } catch (err) {
            console.error(err);
            toast.error('บันทึก Template ล้มเหลว');
        }
    };

    const handlePromote = async (menuName, sellingPrice) => {
        try {
            const { data: newMenu, error: menuError } = await supabase
                .from('menu_items')
                .insert({
                    name: menuName,
                    price: sellingPrice,
                    category: 'Beverage',
                    is_available: true
                })
                .select()
                .single();

            if (menuError) throw menuError;

            const payloadItems = ingredients.map((ing, idx) => ({
                parent_menu_item_id: newMenu.id,
                ingredient_id: ing.ingredientId,
                quantity: ing.quantity,
                unit: ing.unit,
                layer_order: idx
            }));

            if (payloadItems.length > 0) {
                await supabase.from('recipe_ingredients').insert(payloadItems);
            }

            toast.success('แปลงเป็นเมนูขายหน้าร้านสำเร็จ');
            setIsPromoteOpen(false);
        } catch (err) {
            console.error(err);
            toast.error('แปลงเมนูล้มเหลว: ' + err.message);
        }
    };

    // A prep or a per-glass recipe is made from raw ingredients and preps. Only a sold
    // menu item may point at a per-glass recipe (as "1 glass of this").
    const pickableItems = useMemo(() => availableItems.filter(i =>
        i.id !== parentId && (parentType === 'menu' || getItemType(i) !== ITEM_TYPES.RECIPE)
    ), [availableItems, parentId, parentType]);

    // Filter available items by search and type
    const filteredItems = useMemo(() => {
        return pickableItems.filter(i => {
            const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase());
            const notAlreadyAdded = !ingredients.some(existing => existing.ingredientId === i.id);
            const matchesType = itemFilterType === 'all'
                ? true
                : itemFilterType === 'base'
                    ? getItemType(i) !== ITEM_TYPES.RAW
                    : getItemType(i) === ITEM_TYPES.RAW;
            return matchesSearch && notAlreadyAdded && matchesType;
        });
    }, [pickableItems, searchTerm, ingredients, itemFilterType]);

    return (
        <div className="fixed inset-0 z-[70] bg-[var(--color-paper)] flex flex-col md:flex-row font-sans text-[var(--color-ink)] animate-in fade-in">
            {/* Sub-Modals */}
            {editingStockItem && (
                <EditStockModal 
                    item={editingStockItem} 
                    onClose={() => setEditingStockItem(null)} 
                    onSave={handleUpdateStock} 
                />
            )}

            {isQuickAddOpen && (
                <QuickAddStockModal 
                    onClose={() => setIsQuickAddOpen(false)}
                    onSave={handleCreateStock}
                />
            )}

            {isImportOpen && (
                <RecipeImportModal 
                    onClose={() => setIsImportOpen(false)}
                    onImport={(importedIngredients) => {
                        const newItems = importedIngredients.map(item => ({
                            id: 'temp-' + Date.now() + Math.random(),
                            ingredientId: item.ingredientId,
                            ingredient: item.ingredient,
                            quantity: item.quantity,
                            unit: item.unit
                        }));
                        setIngredients(prev => [...prev, ...newItems]);
                        toast.success(`นำเข้า ${newItems.length} รายการแล้ว`);
                    }}
                />
            )}

            {isExportOpen && (
                <ExportTemplateModal
                    onClose={() => setIsExportOpen(false)}
                    onSave={handleExport}
                />
            )}

            {isPromoteOpen && (
                <PromoteModal
                    initialName={parentItem?.name}
                    onClose={() => setIsPromoteOpen(false)}
                    onPromote={handlePromote}
                />
            )}

            {/* Left Column: Recipe Stack & Layers Workbench */}
            <div className="flex-1 flex flex-col bg-[var(--color-paper)] border-r border-[var(--color-rule)] h-full overflow-hidden relative">
                {/* Workbench Top Bar */}
                <div className="p-3.5 border-b border-[var(--color-rule)] bg-[var(--color-paper-2)] flex flex-wrap justify-between items-center gap-2 z-10 sticky top-0">
                    <div className="min-w-[12rem] flex-1 pr-2">
                        {isEditingName ? (
                            <div className="flex items-center gap-1.5 tabular-nums">
                                <input
                                    value={tempName}
                                    onChange={e => setTempName(e.target.value)}
                                    className="border border-[var(--color-ink)] px-2 py-1 text-sm bg-[var(--color-paper)] outline-none"
                                    autoFocus
                                    onKeyDown={async e => {
                                        if (e.key === 'Enter') await handleSaveName();
                                        if (e.key === 'Escape') setIsEditingName(false);
                                    }}
                                />
                                <button onClick={handleSaveName} className="p-1 bg-[var(--color-ink)] text-[var(--color-paper)] text-xs font-bold">
                                    <Check size={13} />
                                </button>
                                <button onClick={() => setIsEditingName(false)} className="p-1 border border-[var(--color-rule)] text-xs">
                                    <X size={13} />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 group/builder-title flex-wrap">
                                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-[var(--color-paper-2)] text-[var(--color-muted)]">
                                    {parentType === 'menu' ? 'สูตรเมนู' : (isPrep ? 'ของเตรียม' : 'สูตร')}
                                </span>
                                <h2 className="text-base font-bold font-sans text-[var(--color-ink)] truncate">
                                    {parentItem?.name || 'ตัวปรุงสูตร (Recipe Builder)'}
                                </h2>
                                <button
                                    onClick={handleStartEditName}
                                    className="opacity-0 group-hover/builder-title:opacity-100 p-0.5 text-[var(--color-neutral)] hover:text-[var(--color-ink)] transition-opacity cursor-pointer"
                                    title="แก้ไขชื่อ"
                                >
                                    <Pencil size={12} />
                                </button>
                            </div>
                        )}
                        <p className="text-[13px] tabular-nums text-[var(--color-neutral)] mt-0.5">
                            {parentType === 'stock'
                                ? 'ส่วนผสมด้านล่างคือของที่ใช้ทำ 1 portion'
                                : 'ลากวางเพื่อจัดลำดับชั้นวัตถุดิบ (Layers)'
                            }
                        </p>
                    </div>

                    {/* Quick Tools & Total Cost readout */}
                    <div className="flex items-center gap-2 tabular-nums text-xs flex-shrink-0">
                        <button
                            onClick={() => setIsHistoryOpen(true)}
                            className="admin-btn h-9"
                            title="ประวัติการแก้สูตร"
                        >
                            <span className="font-sans">ประวัติ</span>
                        </button>

                        <button
                            onClick={() => setIsImportOpen(true)}
                            className="admin-btn h-9 hidden sm:flex"
                            title="นำเข้าส่วนผสมจากสูตรอื่น"
                        >
                            <Download size={13} />
                            <span>นำเข้าสูตร</span>
                        </button>

                        <button 
                            onClick={() => setIsExportOpen(true)}
                            className="admin-btn h-9 hidden sm:flex"
                            title="บันทึกเป็นสูตรกลาง"
                        >
                            <Copy size={13} />
                            <span>บันทึกเป็นแม่แบบ</span>
                        </button>
                        
                        {parentType === 'stock' && (
                            <button 
                                onClick={() => setIsPromoteOpen(true)}
                                className="hidden sm:flex items-center gap-1 border border-[var(--color-rule)] bg-[var(--color-paper-3)] px-2.5 py-1.5 font-bold hover:bg-[var(--color-ink)] hover:text-[var(--color-paper)] transition-colors cursor-pointer"
                                title="แปลงสูตรนี้เป็นเมนูขายหน้าร้าน"
                            >
                                <Rocket size={13} />
                                <span>ทำเป็นเมนูขาย</span>
                            </button>
                        )}

                        {/* Total Cost Display */}
                        <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-1 text-right">
                            <span className="text-xs text-[var(--color-neutral)] block font-bold">ต้นทุนรวม</span>
                            <span className="text-base font-bold text-[var(--color-ink)] tabular-nums">฿{totalCost.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Portion definition (stock-item recipes only) */}
                {parentType === 'stock' && (
                    <div className="border-b border-[var(--color-rule)] bg-[var(--color-paper)] grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] divide-y lg:divide-y-0 lg:divide-x divide-[var(--color-rule)] text-xs">
                        <div className="p-3 space-y-1.5">
                            <span className="font-sans text-xs font-bold leading-5 text-[var(--color-neutral)] block">ชนิด</span>
                            <div className="flex border border-[var(--color-rule)] w-fit">
                                {[[ITEM_TYPES.PREP, 'ของเตรียม'], [ITEM_TYPES.RECIPE, 'สูตรต่อแก้ว/จาน']].map(([value, label]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setPortionForm(f => ({ ...f, itemType: value }))}
                                        aria-pressed={portionForm.itemType === value}
                                        className={`px-3 py-1.5 font-sans font-bold leading-5 whitespace-nowrap cursor-pointer transition-colors ${
                                            portionForm.itemType === value ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' : 'bg-[var(--color-paper)] text-[var(--color-muted)] hover:bg-[var(--color-paper-2)]'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {isPrep ? (
                            <>
                                <div className="p-3 flex flex-wrap gap-x-6 gap-y-3">
                                    <div className="space-y-1.5">
                                        <label htmlFor="portion-yield" className="font-sans text-xs font-bold leading-5 text-[var(--color-neutral)] block">
                                            1 portion ได้
                                        </label>
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                id="portion-yield"
                                                type="number"
                                                min="0"
                                                inputMode="decimal"
                                                value={portionForm.yieldQty}
                                                onChange={e => setPortionForm(f => ({ ...f, yieldQty: e.target.value }))}
                                                placeholder="เช่น 2000"
                                                className={`w-28 p-1.5 border bg-[var(--color-paper)] tabular-nums font-bold text-sm text-right outline-none focus:border-[var(--color-ink)] ${
                                                    hasYield ? 'border-[var(--color-rule)]' : 'border-[var(--brand-plum)]'
                                                }`}
                                            />
                                            <select
                                                aria-label="หน่วยของปริมาณต่อ portion"
                                                value={portionForm.yieldUnit}
                                                onChange={e => setPortionForm(f => ({ ...f, yieldUnit: e.target.value }))}
                                                className="p-1.5 border border-[var(--color-rule)] bg-[var(--color-paper)] text-sm cursor-pointer"
                                            >
                                                {THAI_UNITS.filter(u => u.type !== 'count').map(u => (
                                                    <option key={u.value} value={u.value}>{u.value}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {!hasYield && (
                                            <p className="font-sans text-[13px] leading-5 text-[var(--brand-plum)]">
                                                ชั่งหรือตวงของที่ทำได้จริง 1 รอบ แล้วกรอกที่นี่
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        <span className="font-sans text-xs font-bold leading-5 text-[var(--color-neutral)] block">การตัดสต๊อก</span>
                                        <div className="flex border border-[var(--color-rule)] w-fit">
                                            {[[PREP_MODES.STOCKED, 'ผลิตเก็บไว้'], [PREP_MODES.PASSTHROUGH, 'ตัดทะลุ']].map(([value, label]) => (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    onClick={() => setPortionForm(f => ({ ...f, prepMode: value }))}
                                                    aria-pressed={portionForm.prepMode === value}
                                                    className={`px-3 py-1.5 font-sans font-bold leading-5 whitespace-nowrap cursor-pointer transition-colors ${
                                                        portionForm.prepMode === value ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' : 'bg-[var(--color-paper)] text-[var(--color-muted)] hover:bg-[var(--color-paper-2)]'
                                                    }`}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="font-sans text-[13px] leading-5 text-[var(--color-muted)] max-w-xs">
                                            {portionForm.prepMode === PREP_MODES.STOCKED
                                                ? 'กดผลิตเมื่อทำเสร็จ ระบบตัดวัตถุดิบและเพิ่มสต๊อกของเตรียม'
                                                : 'ไม่เก็บสต๊อก ขายแล้วตัดถึงวัตถุดิบทันที'}
                                        </p>
                                    </div>
                                </div>

                                <div className="p-3 lg:text-right space-y-1.5 bg-[var(--color-paper)]">
                                    <span className="font-sans text-xs font-bold leading-5 text-[var(--color-neutral)] block">ต้นทุนต่อหน่วย</span>
                                    <div className=" font-bold text-sm tabular-nums text-[var(--color-ink)]">
                                        {costPerUsageUnit !== null ? `฿${costPerUsageUnit.toFixed(4)}` : '—'}
                                        <span className="text-xs font-normal text-[var(--color-neutral)]"> / {portionForm.yieldUnit}</span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="p-3 lg:col-span-2 flex items-center">
                                <p className="font-sans text-[12px] leading-5 text-[var(--color-muted)]">
                                    สูตรของ 1 แก้วหรือ 1 จาน ไม่เก็บเป็นสต๊อก ขายแล้วตัดถึงส่วนผสมแต่ละตัว
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Layer Stack Items */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2 pb-28 md:pb-4">
                    {ingredients.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-[var(--color-neutral)] border border-dashed border-[var(--color-rule)] p-8 tabular-nums text-xs text-center space-y-2">
                            <Layers className="w-12 h-12 opacity-30 text-[var(--color-neutral)]" />
                            <p className="text-sm font-medium text-[var(--color-ink)]">ยังไม่มีส่วนผสม</p>
                            <p className="text-[13px] text-[var(--color-neutral)] hidden md:block">
                                คลิกเลือกวัตถุดิบจากแผงด้านขวาเพื่อเพิ่มเข้าสู่สูตร
                            </p>
                            <button 
                                onClick={() => setIsMobilePickerOpen(true)}
                                className="admin-btn is-primary h-9 md:hidden mt-2"
                            >
                                + เลือกวัตถุดิบ
                            </button>
                        </div>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={ingredients.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                {ingredients.map((item, idx) => {
                                    const liveIngredient = resolveItem(item.ingredientId, item.ingredient);
                                    const unitCost = calculateRealUnitCost(liveIngredient);
                                    return (
                                        <SortableLayer 
                                            key={item.id} 
                                            index={idx}
                                            {...item}
                                            unitCost={unitCost}
                                            cost={unitCost * item.quantity}
                                            onDelete={(id) => setIngredients(prev => prev.filter(x => x.id !== id))}
                                            onUpdate={(id, qty) => setIngredients(prev => prev.map(x => x.id === id ? { ...x, quantity: qty } : x))}
                                            onEditStock={setEditingStockItem}
                                        />
                                    );
                                })}
                            </SortableContext>
                        </DndContext>
                    )}

                    {/* Hot/iced, sweetness and other options: what they change in stock, for this menu */}
                    {parentType === 'menu' && parentId && (
                        <div className="pt-3">
                            <MenuOptionStockPanel
                                menuId={parentId}
                                stockItems={availableItems}
                                recipe={ingredients}
                                onSweetenerChanged={(id, value) => setAvailableItems(prev => prev.map(i => i.id === id ? { ...i, is_sweetener: value } : i))}
                            />
                        </div>
                    )}
                </div>

                {/* Mobile Floating Drawer Trigger */}
                <div className="md:hidden fixed bottom-16 right-4 z-30">
                    <button 
                        type="button"
                        onClick={() => setIsMobilePickerOpen(true)}
                        className="admin-btn is-primary h-9"
                    >
                        <Plus size={16} />
                        <span>เพิ่มวัตถุดิบ</span>
                    </button>
                </div>

                {/* Unified Price Simulator (Bottom of Stack) */}
                <PriceSimulator 
                    totalCost={totalCost} 
                    price={currentPrice}
                    onPriceChange={setCurrentPrice}
                    targetPct={targetFoodCostPct}
                    compact={true}
                />

                {/* Bottom Action Bar */}
                <div className="p-3 border-t border-[var(--color-rule)] bg-[var(--color-paper)] flex justify-end gap-2 z-20 tabular-nums text-xs">
                    <button 
                        type="button"
                        onClick={onClose} 
                        className="admin-btn h-9"
                    >
                        ยกเลิก
                    </button>
                    <button 
                        type="button"
                        onClick={handleSave} 
                        disabled={loading}
                        className="admin-btn is-primary h-9 disabled:opacity-40"
                    >
                        {loading ? 'กำลังบันทึก...' : 'บันทึกสูตร'}
                    </button>
                </div>
            </div>

            {/* Right Column: Ingredients Palette (Responsive Drawer on Mobile) */}
            <aside className={`
                fixed inset-0 z-40 bg-[var(--color-paper)] flex flex-col md:static md:w-[380px] lg:w-[420px] md:shadow-none transition-transform duration-200 border-l border-[var(--color-rule)]
                ${isMobilePickerOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}
            `}>
                {/* Palette Header */}
                <div className="px-3.5 h-14 border-b border-[var(--color-paper-3)] flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsMobilePickerOpen(false)} className="md:hidden p-1 hover:bg-[var(--color-paper-3)]">
                            <X size={18} />
                        </button>
                        <span className="font-semibold text-sm text-[var(--color-ink)]">
                            คลังวัตถุดิบ
                        </span>
                    </div>
                    <button 
                        type="button"
                        onClick={() => setIsQuickAddOpen(true)}
                        className="admin-btn h-8 px-3"
                    >
                        + สร้างวัตถุดิบ
                    </button>
                </div>

                {/* Search & Filter Chips */}
                <div className="p-3 border-b border-[var(--color-rule)] bg-[var(--color-paper)] space-y-2 tabular-nums text-xs">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-neutral)]" size={14} />
                        <input 
                            className="w-full h-10 rounded-lg bg-[var(--color-paper)] border border-[var(--color-rule)] pl-8 pr-3 text-sm outline-none focus:border-[var(--color-ink)]"
                            placeholder="ค้นหาวัตถุดิบหรือสูตรเบส..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus={isMobilePickerOpen}
                        />
                    </div>

                    <AdminFilterChips
                        label="ประเภทวัตถุดิบ"
                        layoutId="recipe-palette-type"
                        options={[
                            { key: 'all', label: 'ทั้งหมด', count: pickableItems.length },
                            { key: 'raw', label: 'วัตถุดิบ', count: pickableItems.filter(i => getItemType(i) === ITEM_TYPES.RAW).length },
                            { key: 'base', label: parentType === 'menu' ? 'ของเตรียม/สูตร' : 'ของเตรียม', count: pickableItems.filter(i => getItemType(i) !== ITEM_TYPES.RAW).length }
                        ]}
                        value={itemFilterType}
                        onChange={setItemFilterType}
                    />
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 pb-24 md:pb-4 tabular-nums text-xs">
                    {filteredItems.map(item => {
                        const unitCost = calculateRealUnitCost(resolveItem(item.id, item));
                        const paletteType = getItemType(item);
                        return (
                            <div
                                key={item.id}
                                className="p-2.5 border border-[var(--color-rule)] bg-[var(--color-paper)] hover:border-[var(--color-ink)] transition-colors cursor-pointer flex justify-between items-center group rounded-xs select-none"
                                onClick={() => {
                                    handleAddIngredient(item);
                                    if (window.innerWidth < 768) setIsMobilePickerOpen(false);
                                }}
                            >
                                <div className="flex-1 min-w-0 pr-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-medium text-[13px] text-[var(--color-ink)] truncate">
                                            {item.name}
                                        </span>
                                        {paletteType !== ITEM_TYPES.RAW && (
                                            <span className="text-[11px] font-sans font-bold px-1 leading-5 bg-[var(--color-paper-2)] text-[var(--brand-plum)] border border-[var(--color-rule)] whitespace-nowrap">
                                                {paletteType === ITEM_TYPES.PREP ? 'ของเตรียม' : 'สูตร'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-[var(--color-neutral)] mt-0.5">
                                        {hasPortionYield(item)
                                            ? <>฿{unitCost?.toFixed(4) || 0} / {item.usage_unit}</>
                                            : <span className="font-sans text-xs leading-5 text-[var(--brand-plum)]">ยังไม่ได้ระบุปริมาณต่อ portion</span>}
                                    </div>
                                </div>
                                <span className="text-xs font-medium text-[var(--color-neutral)] group-hover:text-[var(--color-ink)] transition-colors">
                                    + เพิ่ม
                                </span>
                            </div>
                        );
                    })}
                    {filteredItems.length === 0 && (
                        <div className="text-center py-10 text-[var(--color-neutral)] text-xs border border-dashed border-[var(--color-rule)] p-4">
                            ไม่พบวัตถุดิบ "{searchTerm}" <br/>
                            <button 
                                type="button"
                                onClick={() => setIsQuickAddOpen(true)} 
                                className="text-[var(--brand-plum)] font-bold underline mt-2 block mx-auto cursor-pointer"
                            >
                                + สร้างวัตถุดิบใหม่เข้าสต็อก
                            </button>
                        </div>
                    )}
                </div>
            </aside>
        {isHistoryOpen && (
                <RecipeHistoryModal
                    parentType={parentType}
                    parentId={parentId}
                    onClose={() => setIsHistoryOpen(false)}
                    onRestore={(version) => {
                        const byId = new Map(availableItems.map(i => [i.id, i]));
                        const restored = [];
                        let lost = 0;
                        (version.rows || []).forEach((r, i) => {
                            const item = byId.get(r.ingredient_id);
                            if (!item) { lost += 1; return; }
                            restored.push({ id: `restore-${version.id}-${i}`, ingredientId: item.id, ingredient: item, quantity: r.quantity, unit: r.unit || item.usage_unit || 'unit' });
                        });
                        setIngredients(restored);
                        setIsHistoryOpen(false);
                        toast.info(lost
                            ? `โหลดเวอร์ชันเก่าแล้ว (${lost} รายการไม่มีในคลังแล้ว ถูกข้าม) กดบันทึกเพื่อใช้`
                            : 'โหลดเวอร์ชันเก่าแล้ว กดบันทึกเพื่อใช้');
                    }}
                />
            )}
        </div>
    );
}
