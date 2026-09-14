/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useMemo } from 'react';
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

// ── 1. Mini Modal for Quick Stock Item Edit ──
function EditStockModal({ item, onClose, onSave }) {
    const [formData, setFormData] = useState({
        cost_price: item.cost_price || 0,
        pack_size: item.pack_size || 1,
        pack_unit: item.pack_unit || 'g',
        usage_unit: item.usage_unit || 'g',
        conversion_factor: item.conversion_factor || 1,
        yield_percent: item.yield_percent || 100
    });

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
            <div className="bg-[oklch(98%_0.004_28)] border border-[oklch(85%_0.012_28)] w-full max-w-md p-6 shadow-2xl space-y-4 rounded-xs">
                <div className="flex justify-between items-start border-b border-[oklch(85%_0.012_28)] pb-3">
                    <div>
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] block">
                            STOCK CONFIGURATION
                        </span>
                        <h3 className="text-base font-bold font-mono uppercase text-[oklch(18%_0.012_28)]">
                            แก้ไขข้อมูลวัตถุดิบ: {item.name}
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-1 text-[oklch(55%_0.010_28)] hover:text-black">
                        <X size={16} />
                    </button>
                </div>
                
                <div className="space-y-4 font-mono text-xs">
                    {!isCompatible && (
                        <div className="bg-amber-50 border border-amber-200 p-2.5 flex gap-2 items-start text-amber-900 rounded-xs">
                            <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                            <div>
                                <div className="font-bold text-[11px]">การแปลงหน่วยข้ามประเภท</div>
                                <p className="text-[10px] text-amber-800 leading-normal font-sans">
                                    หน่วยซื้อ ({formData.pack_unit}) และหน่วยใช้จริง ({formData.usage_unit}) เป็นคนละประเภทกัน จำเป็นต้องป้อนตัวแปลงหน่วยด้วยตนเอง
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Buying Info */}
                    <div className="p-3 bg-white border border-[oklch(85%_0.012_28)] space-y-2 rounded-xs">
                        <span className="font-bold uppercase tracking-wider text-[11px] text-[oklch(18%_0.012_28)] block">
                            1. ข้อมูลการซื้อ (BUYING)
                        </span>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <span className="text-[10px] text-[oklch(55%_0.010_28)] block mb-0.5">ราคาซื้อ (บาท)</span>
                                <input 
                                    type="number" 
                                    value={formData.cost_price} 
                                    onChange={e => setFormData({...formData, cost_price: e.target.value === '' ? 0 : parseFloat(e.target.value)})} 
                                    className="w-full p-1.5 border border-[oklch(85%_0.012_28)] bg-white text-xs font-bold" 
                                />
                            </div>
                            <div>
                                <span className="text-[10px] text-[oklch(55%_0.010_28)] block mb-0.5">ปริมาณต่อแพ็ค</span>
                                <input 
                                    type="number" 
                                    value={formData.pack_size} 
                                    onChange={e => setFormData({...formData, pack_size: e.target.value === '' ? 0 : parseFloat(e.target.value)})} 
                                    className="w-full p-1.5 border border-[oklch(85%_0.012_28)] bg-white text-xs" 
                                />
                            </div>
                            <div>
                                <span className="text-[10px] text-[oklch(55%_0.010_28)] block mb-0.5">หน่วยแพ็ค</span>
                                <select 
                                    value={formData.pack_unit} 
                                    onChange={e => handleUnitChange('pack_unit', e.target.value)} 
                                    className="w-full p-1.5 border border-[oklch(85%_0.012_28)] bg-white text-xs"
                                >
                                    {THAI_UNITS.map(u => <option key={u.value} value={u.value}>{u.value}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="text-[10px] text-[oklch(55%_0.010_28)] text-right">
                            เฉลี่ย ฿{costPerPackUnit.toFixed(4)} / {formData.pack_unit}
                        </div>
                    </div>

                    {/* Usage Info */}
                    <div className="p-3 bg-white border border-[oklch(85%_0.012_28)] space-y-2 rounded-xs">
                        <span className="font-bold uppercase tracking-wider text-[11px] text-[oklch(18%_0.012_28)] block">
                            2. การใช้จริงในสูตร (USAGE)
                        </span>
                        <div className="flex gap-2 items-center">
                            <div className="flex-1">
                                <span className="text-[10px] text-[oklch(55%_0.010_28)] block mb-0.5">หน่วยที่ตวงในสูตร</span>
                                <select
                                    value={formData.usage_unit} 
                                    onChange={e => handleUnitChange('usage_unit', e.target.value)} 
                                    className="w-full p-1.5 border border-[oklch(85%_0.012_28)] bg-white text-xs font-bold" 
                                >
                                    {THAI_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                                </select>
                            </div>
                            <div className="w-24">
                                <span className="text-[10px] text-[oklch(55%_0.010_28)] block mb-0.5">YIELD %</span>
                                <input 
                                    type="number"
                                    value={formData.yield_percent}
                                    onChange={e => setFormData({...formData, yield_percent: e.target.value === '' ? 100 : parseFloat(e.target.value)})}
                                    className="w-full p-1.5 border border-[oklch(85%_0.012_28)] bg-white text-xs font-bold text-center"
                                />
                            </div>
                        </div>

                        {/* Conversion factor display */}
                        <div className="p-2 bg-[oklch(94%_0.010_28)] border border-[oklch(90%_0.008_28)] text-[11px]">
                            {isStandard ? (
                                <div className="flex items-center justify-between text-[oklch(42%_0.010_28)]">
                                    <span className="font-bold">[มาตรฐานสากล]</span>
                                    <span>1 {formData.pack_unit} = <strong>{suggestedFactor}</strong> {formData.usage_unit}</span>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex justify-between items-center mb-1 text-[10px]">
                                        <span className="font-bold">กำหนดสัดส่วนตัวแปลง:</span>
                                        <button 
                                            type="button"
                                            onClick={() => setUseRatioMode(!useRatioMode)}
                                            className="text-[oklch(52%_0.16_28)] hover:underline"
                                        >
                                            {useRatioMode ? "สลับเป็น × (คูณ)" : "สลับเป็น ÷ (หาร)"}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span>1 {formData.pack_unit} =</span>
                                        <input 
                                            type="number" 
                                            className="w-20 p-1 border border-[oklch(85%_0.012_28)] bg-white text-center font-bold"
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
                    <div className="p-3 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex justify-between items-center rounded-xs">
                        <span className="text-[11px] font-bold text-[oklch(42%_0.010_28)]">ต้นทุนจริงสุทธิต่อหน่วย:</span>
                        <div className="font-bold text-sm text-[oklch(18%_0.012_28)]">
                            ฿{realCostPerUsage.toFixed(4)} <span className="text-[10px] text-[oklch(55%_0.010_28)]">/ {formData.usage_unit}</span>
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-[oklch(85%_0.012_28)]">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="flex-1 py-2 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] font-bold uppercase hover:bg-[oklch(90%_0.012_28)]"
                        >
                            ยกเลิก
                        </button>
                        <button 
                            type="button" 
                            onClick={handleSave} 
                            className="flex-1 py-2 bg-[oklch(18%_0.012_28)] text-white font-bold uppercase hover:bg-black"
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
        yield_percent: 100
    });

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
            <div className="bg-[oklch(98%_0.004_28)] border border-[oklch(85%_0.012_28)] w-full max-w-md p-6 shadow-2xl space-y-4 rounded-xs">
                <div className="flex justify-between items-start border-b border-[oklch(85%_0.012_28)] pb-3">
                    <div>
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] block">
                            STOCK CREATION
                        </span>
                        <h3 className="text-base font-bold font-mono uppercase text-[oklch(18%_0.012_28)]">
                            สร้างวัตถุดิบใหม่เข้าคลังสต็อก
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-1 text-[oklch(55%_0.010_28)] hover:text-black">
                        <X size={16} />
                    </button>
                </div>

                <div className="space-y-3 font-mono text-xs">
                    <div>
                        <label className="text-[10px] text-[oklch(55%_0.010_28)] uppercase block mb-1">ชื่อวัตถุดิบ *</label>
                        <input 
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                            placeholder="เช่น ไซรัปมะพร้าวน้ำหอม, ผงโกโก้พรีเมียม"
                            className="w-full p-2 border border-[oklch(85%_0.012_28)] bg-white font-sans text-xs font-bold"
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] text-[oklch(55%_0.010_28)] uppercase block mb-1">หมวดหมู่</label>
                            <select 
                                value={formData.category}
                                onChange={e => setFormData({...formData, category: e.target.value})}
                                className="w-full p-2 border border-[oklch(85%_0.012_28)] bg-white text-xs font-bold"
                            >
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-[oklch(55%_0.010_28)] uppercase block mb-1">ราคาซื้อ (บาท)</label>
                            <input 
                                type="number" 
                                value={formData.cost_price} 
                                onChange={e => setFormData({...formData, cost_price: parseFloat(e.target.value) || 0})}
                                className="w-full p-2 border border-[oklch(85%_0.012_28)] bg-white text-xs font-bold" 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="text-[10px] text-[oklch(55%_0.010_28)] uppercase block mb-1">ขนาดบรรจุ</label>
                            <input 
                                type="number" 
                                value={formData.pack_size} 
                                onChange={e => setFormData({...formData, pack_size: parseFloat(e.target.value) || 1})}
                                className="w-full p-2 border border-[oklch(85%_0.012_28)] bg-white text-xs" 
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-[oklch(55%_0.010_28)] uppercase block mb-1">หน่วยซื้อ</label>
                            <select 
                                value={formData.pack_unit} 
                                onChange={e => handleUnitChange('pack_unit', e.target.value)} 
                                className="w-full p-2 border border-[oklch(85%_0.012_28)] bg-white text-xs"
                            >
                                {THAI_UNITS.map(u => <option key={u.value} value={u.value}>{u.value}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-[oklch(55%_0.010_28)] uppercase block mb-1">หน่วยใช้</label>
                            <select 
                                value={formData.usage_unit} 
                                onChange={e => handleUnitChange('usage_unit', e.target.value)} 
                                className="w-full p-2 border border-[oklch(85%_0.012_28)] bg-white text-xs font-bold"
                            >
                                {THAI_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {!isCompatible && (
                        <div className="p-2 bg-amber-50 border border-amber-200 text-amber-900 text-[10px]">
                            1 {formData.pack_unit} = <input 
                                type="number" 
                                className="w-16 p-0.5 border border-amber-300 bg-white text-center font-bold" 
                                value={formData.conversion_factor} 
                                onChange={e => setFormData({...formData, conversion_factor: parseFloat(e.target.value) || 1})} 
                            /> {formData.usage_unit}
                        </div>
                    )}

                    <div className="flex gap-2 pt-2 border-t border-[oklch(85%_0.012_28)]">
                        <button type="button" onClick={onClose} className="flex-1 py-2 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] font-bold uppercase hover:bg-[oklch(90%_0.012_28)]">
                            ยกเลิก
                        </button>
                        <button type="button" onClick={handleSave} className="flex-1 py-2 bg-[oklch(18%_0.012_28)] text-white font-bold uppercase hover:bg-black">
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
            <div className="bg-[oklch(98%_0.004_28)] border border-[oklch(85%_0.012_28)] w-full max-w-md shadow-2xl rounded-xs overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-3.5 border-b border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex justify-between items-center font-mono">
                    <span className="font-bold text-xs uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                        [IMPORT RECIPE] นำเข้าสูตรจากต้นแบบ
                    </span>
                    <button onClick={onClose} className="p-1 text-[oklch(55%_0.010_28)] hover:text-black">
                        <X size={16}/>
                    </button>
                </div>
                
                <div className="p-3 border-b border-[oklch(85%_0.012_28)] bg-white">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[oklch(55%_0.010_28)]" size={14} />
                        <input 
                            className="w-full bg-white border border-[oklch(85%_0.012_28)] py-1.5 pl-8 pr-3 font-mono text-xs outline-none focus:border-black"
                            placeholder="ค้นหาชื่อเมนู หรือ Base Recipe..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-xs divide-y divide-[oklch(90%_0.008_28)]">
                    {loading ? (
                        <div className="text-center py-10 text-[oklch(55%_0.010_28)]">กำลังโหลดต้นแบบ...</div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-10 text-[oklch(55%_0.010_28)]">ไม่พบรายการที่ค้นหา</div>
                    ) : (
                        filtered.map(item => (
                            <button
                                key={`${item.type}-${item.id}`}
                                onClick={() => handleSelect(item)}
                                className="w-full text-left p-2.5 hover:bg-[oklch(94%_0.010_28)] flex justify-between items-center transition-colors cursor-pointer"
                            >
                                <div>
                                    <div className="font-bold text-sm text-[oklch(18%_0.012_28)]">{item.name}</div>
                                    <span className="text-[10px] text-[oklch(55%_0.010_28)] uppercase">
                                        {item.type === 'menu' ? '[MENU ITEM]' : '[BASE RECIPE]'}
                                    </span>
                                </div>
                                <span className="text-[11px] font-bold text-[oklch(52%_0.16_28)]">
                                    [เลือกนำเข้า →]
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
            <div className="bg-[oklch(98%_0.004_28)] border border-[oklch(85%_0.012_28)] w-full max-w-sm p-5 shadow-2xl rounded-xs space-y-4 font-mono text-xs">
                <div className="border-b border-[oklch(85%_0.012_28)] pb-2">
                    <span className="text-[10px] font-bold uppercase text-[oklch(52%_0.16_28)] block">SAVE AS BASE RECIPE</span>
                    <h3 className="font-bold text-sm text-[oklch(18%_0.012_28)] uppercase">บันทึกสูตรเป็น Template กลาง</h3>
                </div>
                
                <div className="space-y-2">
                    <label className="text-[10px] text-[oklch(55%_0.010_28)] uppercase block">ชื่อ Template (Base Recipe) *</label>
                    <input 
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full p-2 border border-[oklch(85%_0.012_28)] bg-white font-bold"
                        placeholder="เช่น สูตรชาเขียวเข้มข้นมาตรฐาน..."
                        autoFocus
                    />
                    <p className="text-[10px] text-[oklch(55%_0.010_28)] leading-relaxed">
                        ระบบจะสร้างเป็นวัตถุดิบประเภท "Base Recipe" ให้โดยอัตโนมัติใน Recipe Lab
                    </p>
                </div>

                <div className="flex gap-2 pt-2 border-t border-[oklch(85%_0.012_28)]">
                    <button type="button" onClick={onClose} className="flex-1 py-2 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] font-bold uppercase">
                        ยกเลิก
                    </button>
                    <button 
                        type="button"
                        onClick={handleSave}
                        disabled={loading || !name}
                        className="flex-1 py-2 bg-[oklch(18%_0.012_28)] text-white font-bold uppercase disabled:opacity-50 hover:bg-black"
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
            <div className="bg-[oklch(98%_0.004_28)] border border-[oklch(85%_0.012_28)] w-full max-w-sm p-5 shadow-2xl rounded-xs space-y-4 font-mono text-xs">
                <div className="border-b border-[oklch(85%_0.012_28)] pb-2">
                    <span className="text-[10px] font-bold uppercase text-[oklch(52%_0.16_28)] block">PROMOTE ACTION</span>
                    <h3 className="font-bold text-sm text-[oklch(18%_0.012_28)] uppercase">แปลงเป็นเมนูขายหน้าร้าน</h3>
                </div>
                
                <div className="space-y-3">
                    <div>
                        <label className="text-[10px] text-[oklch(55%_0.010_28)] uppercase block mb-1">ชื่อเมนู (Menu Name) *</label>
                        <input 
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full p-2 border border-[oklch(85%_0.012_28)] bg-white font-bold"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-[oklch(55%_0.010_28)] uppercase block mb-1">ราคาขายหน้าร้าน (Selling Price) *</label>
                        <input 
                            type="number"
                            value={price}
                            onChange={e => setPrice(e.target.value)}
                            className="w-full p-2 border border-[oklch(85%_0.012_28)] bg-white font-bold text-base"
                            placeholder="0.00"
                        />
                    </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-[oklch(85%_0.012_28)]">
                    <button type="button" onClick={onClose} className="flex-1 py-2 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] font-bold uppercase">
                        ยกเลิก
                    </button>
                    <button 
                        type="button"
                        onClick={handlePromote}
                        disabled={loading}
                        className="flex-1 py-2 bg-[oklch(18%_0.012_28)] text-white font-bold uppercase disabled:opacity-50 hover:bg-black"
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
    const isBaseRecipe = ingredient?.is_base_recipe === true;
    
    return (
        <div 
            ref={setNodeRef} style={style} {...attributes}
            className="flex items-center gap-2.5 p-2.5 border border-[oklch(85%_0.012_28)] bg-white hover:border-black transition-colors rounded-xs font-mono text-xs"
        >
            <div {...listeners} className="cursor-grab text-[oklch(55%_0.010_28)] hover:text-black flex-shrink-0" title="ลากเพื่อเรียงลำดับ">
                <GripVertical size={16} />
            </div>
            
            {/* Visual Layer Marker */}
            <div className={`w-1.5 h-9 flex-shrink-0 ${getLayerColor(index)}`}></div>

            <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-sm text-[oklch(18%_0.012_28)] font-sans truncate">
                        {ingredient.name}
                    </span>
                    {isBaseRecipe && (
                        <span className="text-[9px] font-mono font-bold uppercase px-1 py-0.2 bg-[oklch(92%_0.015_28)] text-[oklch(52%_0.16_28)] border border-[oklch(85%_0.012_28)]">
                            [BASE]
                        </span>
                    )}
                </div>
                <button 
                    type="button"
                    onClick={() => onEditStock(ingredient)}
                    className="text-[10px] text-[oklch(55%_0.010_28)] hover:text-black hover:underline flex items-center gap-1 transition-colors mt-0.5 cursor-pointer"
                >
                    <span>฿{unitCost?.toFixed(4) || 0} / {ingredient.usage_unit}</span>
                    <span className="text-[9px] font-bold">[EDIT STOCK]</span>
                </button>
            </div>

            {/* Quantity Input */}
            <div className="flex items-center gap-1 flex-shrink-0">
                <input 
                    type="number" 
                    className="w-16 bg-[oklch(98%_0.004_28)] border border-[oklch(85%_0.012_28)] p-1 text-right font-bold text-xs outline-none focus:border-black"
                    value={quantity ?? ''}
                    placeholder="0"
                    onChange={(e) => {
                        const val = e.target.value;
                        onUpdate(id, val === '' ? 0 : parseFloat(val));
                    }}
                />
                <span className="text-[10px] text-[oklch(55%_0.010_28)] w-7 truncate">{unit}</span>
            </div>

            {/* Layer Cost Readout */}
            <div className="text-right w-16 md:w-20 flex-shrink-0 tabular-nums">
                <div className="font-bold text-[oklch(18%_0.012_28)] text-xs">
                    ฿{isNaN(cost) ? '0.00' : cost.toFixed(2)}
                </div>
            </div>

            {/* Delete button */}
            <button 
                type="button" 
                onClick={() => onDelete(id)} 
                className="p-1 text-[oklch(55%_0.010_28)] hover:text-red-700 cursor-pointer flex-shrink-0"
                title="ลบส่วนผสมนี้"
            >
                <Trash2 size={14} />
            </button>
        </div>
    );
}

// ── 7. Main RecipeBuilder Component ──
export default function RecipeBuilder({ parentId, parentType = 'menu', initialPrice = 0, onClose }) {
    const [ingredients, setIngredients] = useState([]);
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

            // 3. Fetch All Stock Items for Picker
            const { data: stocks } = await supabase
                .from('stock_items')
                .select('*')
                .order('name');
            setAvailableItems(stocks || []);

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

    // Recalculate Total Cost
    useEffect(() => {
        const breakdown = calculateRecipeCost(ingredients.map(i => ({
            ingredient_id: i.ingredientId,
            quantity: i.quantity,
            unit: i.unit
        })), (id) => {
            return availableItems.find(x => x.id === id) || ingredients.find(x => x.ingredientId === id)?.ingredient;
        });

        setTotalCost(breakdown.totalCost);
    }, [ingredients, availableItems]);

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
                // Update Base Recipe Material Cost
                await supabase.from('stock_items').update({ cost_price: totalCost }).eq('id', parentId);
            }

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
            const { error } = await supabase.from('stock_items').update(newFormData).eq('id', id);
            if (error) throw error;
            
            toast.success('อัปเดตข้อมูลวัตถุดิบแล้ว');
            setEditingStockItem(null);

            setAvailableItems(prev => prev.map(item => item.id === id ? { ...item, ...newFormData } : item));
            setIngredients(prev => prev.map(p => {
                if (p.ingredientId === id) {
                    return { 
                        ...p, 
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
                unit: formData.usage_unit,
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

    // Filter available items by search and type
    const filteredItems = useMemo(() => {
        return availableItems.filter(i => {
            const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase());
            const notAlreadyAdded = !ingredients.some(existing => existing.ingredientId === i.id);
            const matchesType = itemFilterType === 'all' 
                ? true 
                : itemFilterType === 'base' 
                    ? i.is_base_recipe === true 
                    : !i.is_base_recipe;
            return matchesSearch && notAlreadyAdded && matchesType;
        });
    }, [availableItems, searchTerm, ingredients, itemFilterType]);

    return (
        <div className="fixed inset-0 z-[70] bg-[oklch(97%_0.008_28)] flex flex-col md:flex-row font-sans text-[oklch(18%_0.012_28)] animate-in fade-in">
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
            <div className="flex-1 flex flex-col bg-[oklch(97%_0.008_28)] border-r border-[oklch(85%_0.012_28)] h-full overflow-hidden relative">
                {/* Workbench Top Bar */}
                <div className="p-3.5 border-b border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex justify-between items-center z-10 sticky top-0">
                    <div className="min-w-0 pr-2">
                        {isEditingName ? (
                            <div className="flex items-center gap-1.5 font-mono">
                                <input
                                    value={tempName}
                                    onChange={e => setTempName(e.target.value)}
                                    className="border border-black px-2 py-1 text-sm font-bold bg-white outline-none"
                                    autoFocus
                                    onKeyDown={async e => {
                                        if (e.key === 'Enter') await handleSaveName();
                                        if (e.key === 'Escape') setIsEditingName(false);
                                    }}
                                />
                                <button onClick={handleSaveName} className="p-1 bg-[oklch(18%_0.012_28)] text-white text-xs font-bold">
                                    <Check size={13} />
                                </button>
                                <button onClick={() => setIsEditingName(false)} className="p-1 border border-[oklch(85%_0.012_28)] text-xs">
                                    <X size={13} />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 group/builder-title flex-wrap">
                                <span className="font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 bg-[oklch(92%_0.015_28)] text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)]">
                                    {parentType === 'menu' ? '[MENU RECIPE]' : '[BASE FORMULA]'}
                                </span>
                                <h2 className="text-base font-bold font-sans text-[oklch(18%_0.012_28)] truncate">
                                    {parentItem?.name || 'ตัวปรุงสูตร (Recipe Builder)'}
                                </h2>
                                <button
                                    onClick={handleStartEditName}
                                    className="opacity-0 group-hover/builder-title:opacity-100 p-0.5 text-[oklch(55%_0.010_28)] hover:text-black transition-opacity cursor-pointer"
                                    title="แก้ไขชื่อ"
                                >
                                    <Pencil size={12} />
                                </button>
                            </div>
                        )}
                        <p className="text-[11px] font-mono text-[oklch(55%_0.010_28)] mt-0.5">
                            {parentType === 'stock' && parentItem 
                                ? `เกณฑ์ตวง 1 แพ็ค (${parentItem.pack_size} ${parentItem.pack_unit})`
                                : 'ลากวางเพื่อจัดลำดับชั้นวัตถุดิบ (Layers)'
                            }
                        </p>
                    </div>

                    {/* Quick Tools & Total Cost readout */}
                    <div className="flex items-center gap-2 font-mono text-xs flex-shrink-0">
                        <button 
                            onClick={() => setIsImportOpen(true)}
                            className="hidden sm:flex items-center gap-1 border border-[oklch(85%_0.012_28)] bg-white px-2.5 py-1.5 font-bold uppercase hover:bg-[oklch(90%_0.012_28)] transition-colors cursor-pointer"
                            title="นำเข้าส่วนผสมจากสูตรอื่น"
                        >
                            <Download size={13} />
                            <span>IMPORT</span>
                        </button>

                        <button 
                            onClick={() => setIsExportOpen(true)}
                            className="hidden sm:flex items-center gap-1 border border-[oklch(85%_0.012_28)] bg-white px-2.5 py-1.5 font-bold uppercase hover:bg-[oklch(90%_0.012_28)] transition-colors cursor-pointer"
                            title="บันทึกเป็นสูตรกลาง"
                        >
                            <Copy size={13} />
                            <span>SAVE TMPL</span>
                        </button>
                        
                        {parentType === 'stock' && (
                            <button 
                                onClick={() => setIsPromoteOpen(true)}
                                className="hidden sm:flex items-center gap-1 border border-[oklch(85%_0.012_28)] bg-[oklch(90%_0.015_28)] px-2.5 py-1.5 font-bold uppercase hover:bg-black hover:text-white transition-colors cursor-pointer"
                                title="แปลงสูตรนี้เป็นเมนูขายหน้าร้าน"
                            >
                                <Rocket size={13} />
                                <span>PROMOTE</span>
                            </button>
                        )}

                        {/* Total Cost Display */}
                        <div className="border border-[oklch(85%_0.012_28)] bg-white px-3 py-1 text-right">
                            <span className="text-[9px] text-[oklch(55%_0.010_28)] uppercase block font-bold">ต้นทุนรวม</span>
                            <span className="text-base font-bold text-[oklch(18%_0.012_28)] tabular-nums">฿{totalCost.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Layer Stack Items */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2 pb-28 md:pb-4">
                    {ingredients.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-[oklch(55%_0.010_28)] border border-dashed border-[oklch(85%_0.012_28)] p-8 font-mono text-xs text-center space-y-2">
                            <Layers className="w-12 h-12 opacity-30 text-[oklch(55%_0.010_28)]" />
                            <p className="font-bold text-[oklch(18%_0.012_28)] uppercase">[EMPTY RECIPE LAYERS]</p>
                            <p className="text-[11px] text-[oklch(55%_0.010_28)] hidden md:block">
                                คลิกเลือกวัตถุดิบจากแผงด้านขวาเพื่อเพิ่มเข้าสู่สูตร
                            </p>
                            <button 
                                onClick={() => setIsMobilePickerOpen(true)}
                                className="md:hidden mt-2 px-3 py-1.5 bg-[oklch(18%_0.012_28)] text-white font-bold uppercase"
                            >
                                + เลือกวัตถุดิบ
                            </button>
                        </div>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={ingredients.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                {ingredients.map((item, idx) => {
                                    const unitCost = calculateRealUnitCost(item.ingredient);
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
                </div>

                {/* Mobile Floating Drawer Trigger */}
                <div className="md:hidden fixed bottom-16 right-4 z-30">
                    <button 
                        type="button"
                        onClick={() => setIsMobilePickerOpen(true)}
                        className="px-4 py-2.5 bg-[oklch(18%_0.012_28)] text-white font-mono font-bold uppercase shadow-xl border border-black flex items-center gap-1.5 text-xs"
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
                <div className="p-3 border-t border-[oklch(85%_0.012_28)] bg-white flex justify-end gap-2 z-20 font-mono text-xs">
                    <button 
                        type="button"
                        onClick={onClose} 
                        className="px-5 py-2.5 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] font-bold uppercase text-[oklch(42%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] cursor-pointer"
                    >
                        ยกเลิก (Cancel)
                    </button>
                    <button 
                        type="button"
                        onClick={handleSave} 
                        disabled={loading}
                        className="px-6 py-2.5 bg-[oklch(18%_0.012_28)] text-white font-bold uppercase hover:bg-black disabled:opacity-40 cursor-pointer shadow-xs"
                    >
                        {loading ? 'กำลังบันทึก...' : 'บันทึกสูตร (SAVE RECIPE)'}
                    </button>
                </div>
            </div>

            {/* Right Column: Ingredients Palette (Responsive Drawer on Mobile) */}
            <aside className={`
                fixed inset-0 z-40 bg-[oklch(98%_0.004_28)] flex flex-col md:static md:w-[380px] lg:w-[420px] md:shadow-none transition-transform duration-200 border-l border-[oklch(85%_0.012_28)]
                ${isMobilePickerOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}
            `}>
                {/* Palette Header */}
                <div className="p-3.5 border-b border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex justify-between items-center font-mono text-xs">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsMobilePickerOpen(false)} className="md:hidden p-1 hover:bg-gray-200">
                            <X size={18} />
                        </button>
                        <span className="font-bold text-xs uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                            คลังวัตถุดิบ (STOCK PALETTE)
                        </span>
                    </div>
                    <button 
                        type="button"
                        onClick={() => setIsQuickAddOpen(true)}
                        className="px-2 py-1 bg-[oklch(18%_0.012_28)] text-white text-[10px] font-bold uppercase hover:bg-black transition-colors cursor-pointer"
                    >
                        + สร้างวัตถุดิบ
                    </button>
                </div>

                {/* Search & Filter Chips */}
                <div className="p-3 border-b border-[oklch(85%_0.012_28)] bg-white space-y-2 font-mono text-xs">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[oklch(55%_0.010_28)]" size={14} />
                        <input 
                            className="w-full bg-white border border-[oklch(85%_0.012_28)] py-1.5 pl-8 pr-3 text-xs outline-none focus:border-black font-mono font-bold"
                            placeholder="ค้นหาวัตถุดิบหรือสูตรเบส..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus={isMobilePickerOpen}
                        />
                    </div>

                    <div className="flex gap-1.5 text-[10px] font-mono">
                        <button 
                            type="button"
                            onClick={() => setItemFilterType('all')}
                            className={`px-2 py-0.5 border font-bold uppercase cursor-pointer ${
                                itemFilterType === 'all' 
                                    ? 'bg-[oklch(18%_0.012_28)] text-white border-black' 
                                    : 'bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)]'
                            }`}
                        >
                            ทั้งหมด ({availableItems.length})
                        </button>
                        <button 
                            type="button"
                            onClick={() => setItemFilterType('raw')}
                            className={`px-2 py-0.5 border font-bold uppercase cursor-pointer ${
                                itemFilterType === 'raw' 
                                    ? 'bg-[oklch(18%_0.012_28)] text-white border-black' 
                                    : 'bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)]'
                            }`}
                        >
                            วัตถุดิบดิบ ({availableItems.filter(i => !i.is_base_recipe).length})
                        </button>
                        <button 
                            type="button"
                            onClick={() => setItemFilterType('base')}
                            className={`px-2 py-0.5 border font-bold uppercase cursor-pointer ${
                                itemFilterType === 'base' 
                                    ? 'bg-[oklch(18%_0.012_28)] text-white border-black' 
                                    : 'bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)]'
                            }`}
                        >
                            สูตรกลาง ({availableItems.filter(i => i.is_base_recipe).length})
                        </button>
                    </div>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 pb-24 md:pb-4 font-mono text-xs">
                    {filteredItems.map(item => {
                        const unitCost = calculateRealUnitCost(item);
                        return (
                            <div 
                                key={item.id}
                                className="p-2.5 border border-[oklch(85%_0.012_28)] bg-white hover:border-black transition-colors cursor-pointer flex justify-between items-center group rounded-xs select-none"
                                onClick={() => {
                                    handleAddIngredient(item);
                                    if (window.innerWidth < 768) setIsMobilePickerOpen(false);
                                }}
                            >
                                <div className="flex-1 min-w-0 pr-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-xs text-[oklch(18%_0.012_28)] font-sans truncate">
                                            {item.name}
                                        </span>
                                        {item.is_base_recipe && (
                                            <span className="text-[9px] font-bold uppercase px-1 py-0.2 bg-[oklch(92%_0.015_28)] text-[oklch(52%_0.16_28)] border border-[oklch(85%_0.012_28)]">
                                                [BASE]
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-[oklch(55%_0.010_28)] mt-0.5">
                                        ฿{unitCost?.toFixed(4) || 0} / {item.usage_unit}
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold text-[oklch(52%_0.16_28)] group-hover:text-black">
                                    [+ เพิ่ม]
                                </span>
                            </div>
                        );
                    })}
                    {filteredItems.length === 0 && (
                        <div className="text-center py-10 text-[oklch(55%_0.010_28)] text-xs border border-dashed border-[oklch(85%_0.012_28)] p-4">
                            ไม่พบวัตถุดิบ "{searchTerm}" <br/>
                            <button 
                                type="button"
                                onClick={() => setIsQuickAddOpen(true)} 
                                className="text-[oklch(52%_0.16_28)] font-bold underline mt-2 block mx-auto cursor-pointer"
                            >
                                + สร้างวัตถุดิบใหม่เข้าสต็อก
                            </button>
                        </div>
                    )}
                </div>
            </aside>
        </div>
    );
}
