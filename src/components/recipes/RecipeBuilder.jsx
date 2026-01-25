import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { DndContext, useSensor, useSensors, PointerSensor, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Trash2, GripVertical, AlertTriangle, Layers, Pencil, X, PackagePlus, Search, Copy, Download } from 'lucide-react';
import { calculateRecipeCost, getLayerColor, calculateRealUnitCost } from '../../utils/costUtils';
import { THAI_UNITS, suggestConversionFactor } from '../../utils/unitUtils';
import { THAI_UNITS, suggestConversionFactor } from '../../utils/unitUtils';
import { toast } from 'sonner';
import PriceSimulator from './PriceSimulator';

// Mini Form for Quick Stock Edit
function EditStockModal({ item, onClose, onSave }) {
    const [formData, setFormData] = useState({
        cost_price: item.cost_price || 0,
        pack_size: item.pack_size || 1,
        pack_unit: item.pack_unit || 'g',
        usage_unit: item.usage_unit || 'g',
        conversion_factor: item.conversion_factor || 1,
        yield_percent: item.yield_percent || 100
    });

    // Helper: Is this a standard metric conversion?
    const getStandardFactor = (from, to) => {
        if (from === 'kg' && to === 'g') return 1000;
        if (from === 'g' && to === 'kg') return 0.001;
        if (from === 'l' && to === 'ml') return 1000;
        if (from === 'ml' && to === 'l') return 0.001;
        if (from === to) return 1;
        return null; // Not standard (e.g. Pack -> g)
    };

    const standardFactor = getStandardFactor(formData.pack_unit, formData.usage_unit);
    const isStandard = standardFactor !== null;

    // Helper: Determine if units are IDENTICAL (Display "Same Unit")
    const areUnitsSame = formData.pack_unit === formData.usage_unit;
    
    // Toggle for Custom Calculation (Divide vs Multiply) - Only relevant for Custom Units
    const [useRatioMode, setUseRatioMode] = useState(false); 

    // Auto-calculate Real Cost
    const realCostPerUsage = (formData.cost_price / (formData.pack_size * formData.conversion_factor)) * (100 / formData.yield_percent);
    const costPerPackUnit = formData.cost_price / formData.pack_size;

    useEffect(() => {
        // Enforce standard factor if applicable
        if (standardFactor !== null && formData.conversion_factor !== standardFactor) {
             setFormData(prev => ({ ...prev, conversion_factor: standardFactor }));
        }
    }, [formData.pack_unit, formData.usage_unit, standardFactor]);

    return (
        <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <Pencil size={18} /> แก้ไขวัตถุดิบ: {item.name}
                </h3>
                
                <div className="space-y-4">
                    {/* Buying Info */}
                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 space-y-2">
                        <label className="text-xs font-bold text-blue-800 block">1. ซื้อมา (Buying)</label>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <span className="text-[10px] text-gray-500">ราคาซื้อ (บาท)</span>
                                <input type="number" value={formData.cost_price} onChange={e => setFormData({...formData, cost_price: parseFloat(e.target.value)})} className="w-full p-2 rounded border border-blue-200 text-sm font-bold bg-white" />
                            </div>
                            <div className="flex-1">
                                <span className="text-[10px] text-gray-500">ปริมาณ</span>
                                <input type="number" value={formData.pack_size} onChange={e => setFormData({...formData, pack_size: parseFloat(e.target.value)})} className="w-full p-2 rounded border border-blue-200 text-sm bg-white" />
                            </div>
                            <div className="w-24">
                                <span className="text-[10px] text-gray-500">หน่วย</span>
                                <select 
                                    value={formData.pack_unit} 
                                    onChange={e => setFormData({...formData, pack_unit: e.target.value})} 
                                    className="w-full p-2 rounded border border-blue-200 text-sm bg-white"
                                >
                                    {THAI_UNITS.map(u => <option key={u.value} value={u.value}>{u.value}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="text-[10px] text-blue-600 text-right px-1">
                            ตก {costPerPackUnit.toFixed(4)} บาท / {formData.pack_unit}
                        </div>
                    </div>

                    {/* Usage Info */}
                    <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 space-y-2">
                        <label className="text-xs font-bold text-orange-800 block">2. ใช้จริงเป็น (Using)</label>
                        <div className="flex gap-2 items-center">
                            <div className="flex-1">
                                <span className="text-[10px] text-gray-500">หน่วยหน่วยที่ใช้</span>
                                <select
                                    value={formData.usage_unit} 
                                    onChange={e => {
                                        const newUnit = e.target.value;
                                        // We let useEffect handle the factor update if standard
                                        setFormData({...formData, usage_unit: newUnit}); 
                                    }} 
                                    className="w-full p-2 rounded border border-orange-200 text-sm font-bold bg-white" 
                                >
                                    {THAI_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Conversion Logic Display */}
                        <div className="bg-white p-3 rounded-lg border border-orange-100 mt-2">
                            {isStandard ? (
                                // LOCKED STANDARD
                                <div className="text-sm text-gray-500 flex items-center justify-between">
                                    <span className="font-bold flex items-center gap-2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                        มาตราฐานสากล
                                    </span>
                                    <span>1 {formData.pack_unit} = <strong>{standardFactor}</strong> {formData.usage_unit}</span>
                                </div>
                            ) : (
                                // CUSTOM (Pack -> g, Bottle -> ml)
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-[10px] font-bold text-gray-500">กำหนดปริมาณต่อแพ็ค</label>
                                        <button 
                                            onClick={() => setUseRatioMode(!useRatioMode)}
                                            className="text-[10px] text-blue-600 underline"
                                        >
                                            {useRatioMode ? "สลับเป็น × (คูณ)" : "สลับเป็น ÷ (หาร)"}
                                        </button>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 text-sm">
                                        {useRatioMode ? (
                                            <>
                                                <span className="whitespace-nowrap">1 {formData.usage_unit} ใช้</span>
                                                <input 
                                                    type="number" 
                                                    className="w-20 p-1 border-b border-orange-300 text-center font-bold text-orange-700 outline-none"
                                                    placeholder="?"
                                                    value={formData.conversion_factor === 0 ? 0 : Math.round((1 / formData.conversion_factor) * 10000) / 10000} 
                                                    onChange={e => {
                                                        const val = parseFloat(e.target.value);
                                                        if (val > 0) setFormData({...formData, conversion_factor: 1 / val});
                                                    }}
                                                />
                                                <span>{formData.pack_unit}</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="whitespace-nowrap">1 {formData.pack_unit} =</span>
                                                <input 
                                                    type="number" 
                                                    className="w-20 p-1 border-b border-orange-300 text-center font-bold text-orange-700 outline-none"
                                                    value={formData.conversion_factor}
                                                    onChange={e => setFormData({...formData, conversion_factor: parseFloat(e.target.value)})}
                                                />
                                                <span>{formData.usage_unit}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="p-3 bg-gray-100 rounded-xl flex justify-between items-center">
                        <span className="text-xs text-gray-500">ต้นทุนจริงเฉลี่ย</span>
                        <div className="text-right">
                             <span className="font-bold text-lg text-green-600">฿{realCostPerUsage.toFixed(4)} <span className="text-xs text-black font-normal">/ {formData.usage_unit}</span></span>
                        </div>
                    </div>
                     
                    <div className="text-[10px] text-gray-400 text-center">
                        สูตร: ราคาซื้อ ÷ (ขนาด × ตัวแปลง)
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-200 text-gray-700 font-bold">ยกเลิก</button>
                        <button onClick={() => onSave(item.id, formData)} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold shadow-lg hover:bg-blue-700">บันทึก</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Quick Add Stock Modal (Simplified for Recipe Creation)
function QuickAddStockModal({ onClose, onSave }) {
    const [categories, setCategories] = useState([]);
    const [formData, setFormData] = useState({
        name: '',
        category: 'veg', // Default
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
            if (data && data.length > 0) {
                setCategories(data);
                // Optional: set default to first item if needed, but 'veg' is a safe fallback usually
            }
        };
        fetchCats();
    }, []);

    return (
        <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <PackagePlus size={20} className="text-blue-600" /> เพิ่มวัตถุดิบใหม่
                </h3>
                
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-bold text-gray-500">ชื่อวัตถุดิบ</label>
                        <input 
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                            className="w-full p-2 border rounded-xl bg-gray-50 mb-2"
                            placeholder="เช่น เมล็ดกาแฟ, นมสด..."
                            autoFocus
                        />
                        
                        <label className="text-xs font-bold text-gray-500">หมวดหมู่</label>
                        <select 
                            value={formData.category}
                            onChange={e => setFormData({...formData, category: e.target.value})}
                            className="w-full p-2 border rounded-xl bg-white"
                        >
                            {categories.length > 0 ? (
                                categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)
                            ) : (
                                <option value="veg">ผัก (Default)</option>
                            )}
                        </select>
                    </div>
                    
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-gray-500">ราคาซื้อ</label>
                            <input type="number" value={formData.cost_price} onChange={e => setFormData({...formData, cost_price: parseFloat(e.target.value)})} className="w-full p-2 border rounded-xl" />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-bold text-gray-500">ขนาดแพ็ค</label>
                            <input type="number" value={formData.pack_size} onChange={e => setFormData({...formData, pack_size: parseFloat(e.target.value)})} className="w-full p-2 border rounded-xl" />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-gray-500">หน่วยแพ็ค</label>
                            <select value={formData.pack_unit} onChange={e => setFormData({...formData, pack_unit: e.target.value})} className="w-full p-2 border rounded-xl bg-white">
                                {THAI_UNITS.map(u => <option key={u.value} value={u.value}>{u.value}</option>)}
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-bold text-gray-500">หน่วยใช้จริง</label>
                             <select value={formData.usage_unit} onChange={e => setFormData({...formData, usage_unit: e.target.value})} className="w-full p-2 border rounded-xl bg-white">
                                {THAI_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700">
                       ระบบจะคำนวณตัวแปลงหน่วยให้อัตโนมัติ (เช่น kg -&gt; g = 1000) หากต้องการแก้ไขละเอียดให้ทำในหน้าสต็อกหลัก
                    </div>

                    <div className="flex gap-2 mt-4">
                        <button onClick={onClose} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-600">ยกเลิก</button>
                        <button 
                            onClick={() => onSave(formData)}
                            disabled={!formData.name}
                            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg disabled:opacity-50"
                        >
                            สร้างทันที
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Import Recipe Modal
function RecipeImportModal({ onClose, onImport }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [templates, setTemplates] = useState([]); // { id, name, type: 'menu' | 'stock', price? }

    useEffect(() => {
        const fetchTemplates = async () => {
            setLoading(true);
            try {
                // 1. Fetch Menu Items
                const { data: menus } = await supabase.from('menu_items').select('id, name, selling_price').order('name');
                
                // 2. Fetch Base Recipes (Stock)
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
                toast.info('เมนูนี้ไม่มีสูตร');
                return;
            }

            // Map to generic format
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
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
             <div className="bg-white rounded-2xl w-full max-w-md p-0 shadow-2xl animate-in fade-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Download size={20} className="text-blue-600" /> นำเข้าสูตร (Import)
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full"><X size={20}/></button>
                </div>
                
                <div className="p-4 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            className="w-full bg-gray-100 border-none rounded-xl py-2 pl-10 pr-4 focus:ring-2 focus:ring-blue-100 outline-none"
                            placeholder="ค้นหาต้นแบบ (เมนู / Base Recipe)..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {loading ? (
                        <div className="text-center py-10 text-gray-400">กำลังโหลด...</div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">ไม่พบข้อมูล</div>
                    ) : (
                        filtered.map(t => (
                            <button 
                                key={t.type + t.id}
                                onClick={() => handleSelect(t)}
                                className="w-full p-3 rounded-xl hover:bg-blue-50 hover:text-blue-700 flex justify-between items-center transition-colors group text-left"
                            >
                                <div>
                                    <div className="font-bold flex items-center gap-2">
                                        {t.type === 'stock' && <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 text-[10px]">Base</span>}
                                        {t.name}
                                    </div>
                                    <div className="text-xs text-gray-400 group-hover:text-blue-400">
                                        {t.type === 'menu' ? 'Menu Item' : 'Stock Item'}
                                    </div>
                                </div>
                                <Download size={16} className="text-gray-300 group-hover:text-blue-500" />
                            </button>
                        ))
                    )}
                </div>
             </div>
        </div>
    );
}

// Sortable Layer Component
function SortableLayer({ id, ingredient, quantity, unit, cost, unitCost, index, onDelete, onUpdate, onEditStock }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    
    return (
        <div 
            ref={setNodeRef} style={style} {...attributes}
            className={`flex items-center gap-3 p-3 rounded-xl border border-gray-200 mb-2 bg-white shadow-sm hover:shadow-md transition-all`}
        >
            <div {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600">
                <GripVertical size={20} />
            </div>
            
            {/* Visual Layer Indicator */}
            <div className={`w-3 h-12 rounded-full ${getLayerColor(index)}`}></div>

            <div className="flex-1 min-w-0">
                <div className="font-bold text-[#1A1A1A] truncate">{ingredient.name}</div>
                <button 
                    onClick={() => onEditStock(ingredient)}
                    className="text-xs text-gray-500 hover:text-blue-600 hover:underline flex items-center gap-1 transition-colors"
                >
                    ฿{unitCost?.toFixed(4) || 0} / {ingredient.usage_unit} <Pencil size={10} />
                </button>
            </div>

            <div className="flex items-center gap-2">
                <input 
                    type="number" 
                    className="w-16 md:w-20 bg-gray-50 border rounded-lg p-2 text-right font-bold text-sm"
                    value={quantity ?? ''}
                    placeholder="0"
                    onChange={(e) => {
                        const val = e.target.value;
                        onUpdate(id, val === '' ? '' : parseFloat(val));
                    }}
                />
                <span className="text-xs text-gray-500 w-8 truncate">{unit}</span>
            </div>

            <div className="text-right w-20 md:w-24">
                <div className="font-bold text-[#1A1A1A]">฿{isNaN(cost) ? '0.00' : cost.toFixed(2)}</div>
            </div>

            <button onClick={() => onDelete(id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg">
                <Trash2 size={18} />
            </button>
        </div>
    );
}

export default function RecipeBuilder({ parentId, parentType = 'menu', initialPrice = 0, onClose }) {
    // parentType: 'menu' | 'stock' (Base Recipe)
    const [ingredients, setIngredients] = useState([]); // List of { id, ingredient, quantity, unit }
    const [availableItems, setAvailableItems] = useState([]);
    const [parentItem, setParentItem] = useState(null); // Added
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Cost State
    const [totalCost, setTotalCost] = useState(0);

    // Edit Stock Modal
    const [editingStockItem, setEditingStockItem] = useState(null);
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false); // Added state
    
    // Mobile Responsive State
    const [isMobilePickerOpen, setIsMobilePickerOpen] = useState(false);

    const sensors = useSensors(useSensor(PointerSensor));

    const loadData = async () => {
        // ... (Keep existing loadData logic)
        setLoading(true);
        try {
            // 1. Fetch Existing Recipe
            const { data: recipeData } = await supabase
                .from('recipe_ingredients')
                .select(`*, ingredient:stock_items!recipe_ingredients_ingredient_id_fkey(*)`)
                .eq(parentType === 'menu' ? 'parent_menu_item_id' : 'parent_stock_item_id', parentId)
                .order('layer_order');

            if (recipeData) {
                const mapped = recipeData.map(r => ({
                    id: r.id, // connection id
                    ingredientId: r.ingredient_id,
                    ingredient: r.ingredient, // joined data
                    quantity: r.quantity,
                    unit: r.unit
                }));
                setIngredients(mapped);
            }

            // 1.5 Fetch Parent Info (to know Batch Size / Name)
            const { data: parentData } = await supabase
                .from(parentType === 'menu' ? 'menu_items' : 'stock_items')
                .select('*')
                .eq('id', parentId)
                .single();
            setParentItem(parentData);

            // 2. Fetch All Stock Items for Picker
            const { data: stocks } = await supabase
                .from('stock_items')
                .select('*')
                .order('name');
            setAvailableItems(stocks || []);

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (parentId) loadData();
    }, [parentId]);

    // Recalculate Cost whenever ingredients change
    useEffect(() => {
        const breakdown = calculateRecipeCost(ingredients.map(i => ({
            ingredient_id: i.ingredientId, // adapter for util
            quantity: i.quantity,
            unit: i.unit
        })), (id) => {
            // lookup function for util
            const found = availableItems.find(x => x.id === id) || ingredients.find(x => x.ingredientId === id)?.ingredient;
            if (found) {
                // Ensure cost props exist? (Util calculates them if missing but we need Pack data)
                // We should assume 'availableItems' has full data.
                return found;
            }
            return null;
        });

        // Sum up from breakdown
        setTotalCost(breakdown.subTotal);
    }, [ingredients, availableItems]);

    const handleAddIngredient = async (item) => {
        // ... (Keep existing)
         // Circular Check
        if (item.id === parentId) {
            toast.error('ไม่สามารถใส่ตัวเองเป็นส่วนผสมได้ (Infinity Loop)');
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
        toast.success(`เพิ่ม ${item.name} แล้ว`);
    };

    const handleSave = async () => {
         // ... (Keep existing)
        setLoading(true);
        try {
            // DEBUG: Check Session/Role
            const { data: { session } } = await supabase.auth.getSession();
            // console.log("Current Role:", session?.user?.role || "anon");
            if (!session) {
                console.warn("No active session! RLS might block.");
            }

            // 1. Prepare Payload
            const payloadItems = ingredients.map((ing, idx) => ({
                ingredient_id: ing.ingredientId,
                quantity: ing.quantity,
                unit: ing.unit,
                layer_order: idx
            }));

            if (parentType === 'menu') {
                // USE RPC (Atomic & Bypasses RLS)
                const { data: rpcData, error: rpcError } = await supabase.rpc('save_menu_recipe', {
                    p_menu_id: parentId,
                    p_ingredients: payloadItems
                });

                if (rpcError) throw rpcError;
                if (!rpcData.success) throw new Error(rpcData.error || 'RPC reported failure');
                
                // console.log("RPC Success:", rpcData);

            } else {
                // MANUAL FALLBACK (For Stock Parent - Base Recipe)
                // If the user hasn't run the generic RLS fix, this might still fail.
                const queryField = 'parent_stock_item_id';
                await supabase.from('recipe_ingredients').delete().eq(queryField, parentId);
                
                const payloads = payloadItems.map(p => ({
                    [queryField]: parentId,
                    ...p
                }));

                if (payloads.length > 0) {
                     const { error } = await supabase.from('recipe_ingredients').insert(payloads);
                     if (error) throw error;
                }
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
        // ... (Keep existing)
         const { active, over } = event;
        if (active.id !== over.id) {
            setIngredients((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    // --- Handling Inline Stock Edit ---
    const handleUpdateStock = async (id, newFormData) => {
        try {
            const { error } = await supabase.from('stock_items').update(newFormData).eq('id', id);
            if (error) throw error;
            
            toast.success('อัปเดตข้อมูลวัตถุดิบแล้ว');
            setEditingStockItem(null);

            // Refresh Local Data (both available list and current ingredients)
            const updatedAvailable = availableItems.map(item => item.id === id ? { ...item, ...newFormData } : item);
            setAvailableItems(updatedAvailable);

            // Also update any ingredients in the list that match this, so the UI cost updates immediately
            setIngredients(prev => prev.map(p => {
                if (p.ingredientId === id) {
                    return { 
                        ...p, 
                        ingredient: { ...p.ingredient, ...newFormData },
                        unit: newFormData.usage_unit // Sync unit to new usage_unit
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
            // Auto-calculate conversion factor if standard
            // Simple logic: if kg->g factor=1000, etc.
            // For now rely on defaults or backend triggers, but here we just insert what we have.
            // Actually let's try to be smart matching the 'suggestConversionFactor' logic but simply.
            
            let factor = formData.conversion_factor;
            // Basic override for standard units
            if(formData.pack_unit === 'kg' && formData.usage_unit === 'g') factor = 1000;
            if(formData.pack_unit === 'l' && formData.usage_unit === 'ml') factor = 1000;

            const payload = {
                ...formData,
                conversion_factor: factor,
                stock_quantity: 0, // Default 0
                min_stock: 0
            };

            const { data, error } = await supabase.from('stock_items').insert(payload).select().single();
            if(error) throw error;

            toast.success('สร้างวัตถุดิบใหม่แล้ว');
            setAvailableItems(prev => [...prev, data].sort((a,b) => a.name.localeCompare(b.name)));
            setIsQuickAddOpen(false);
            
            // Auto add to recipe? Optional. Let's just let user pick it.
            // But usually if they create it, they want to add it.
            handleAddIngredient(data);

        } catch (err) {
            console.error(err);
            toast.error('สร้างวัตถุดิบไม่สำเร็จ');
        }
    };

    const filteredItems = availableItems.filter(i => 
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !ingredients.some(existing => existing.ingredientId === i.id) // Hide already added
    );

    return (
        <div className="fixed inset-0 z-[70] bg-white flex flex-col md:flex-row animate-in fade-in">
            {/* Edit Stock Modal */}
            {editingStockItem && (
                <EditStockModal 
                    item={editingStockItem} 
                    onClose={() => setEditingStockItem(null)} 
                    onSave={handleUpdateStock} 
                />
            )}

            {/* Quick Add Stock Modal */}
            {isQuickAddOpen && (
                <QuickAddStockModal 
                    onClose={() => setIsQuickAddOpen(false)}
                    onSave={handleCreateStock}
                />
            )}

            {/* Import Modal */}
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

            {/* Left: Recipe Stack (The "Soul" Visual) - Always Visible / Main View on Mobile */}
            <div className={`flex-1 flex flex-col bg-gray-50 border-r border-gray-200 h-full overflow-hidden relative`}>
                <div className="p-4 border-b bg-white shadow-sm flex justify-between items-center z-10 sticky top-0">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Layers className="text-[#1A1A1A]" /> 
                            {parentItem?.name ? `${parentItem.name}` : 'ตัวเนรมิตสูตร'}
                        </h2>
                        <p className="text-[10px] md:text-xs text-gray-500">
                             {parentType === 'stock' && parentItem 
                                ? `1 แพ็ค (${parentItem.pack_size} ${parentItem.pack_unit})`
                                : 'ลากวางเพื่อเปลี่ยน Layer'
                             }
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                             onClick={() => setIsImportOpen(true)}
                             className="hidden md:flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-blue-600 bg-gray-100 px-3 py-1.5 rounded-lg transition-colors"
                             title="Import Recipe"
                        >
                            <Copy size={14} /> Import
                        </button>
                        <div className="text-right">
                            <div className="text-[10px] md:text-sm text-gray-500">ต้นทุนรวม</div>
                            <div className="text-xl md:text-2xl font-bold text-blue-600">฿{totalCost.toFixed(2)}</div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar pb-32 md:pb-4">
                    {ingredients.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded-2xl">
                            <Layers className="w-16 h-16 mb-4 opacity-20" />
                            <p>ยังไม่มีวัตถุดิบ</p>
                            <p className="text-sm hidden md:block">เลือกวัตถุดิบจากด้านขวาเพื่อเริ่มปรุง</p>
                            <p className="text-sm md:hidden">กดปุ่ม + เพื่อเพิ่มวัตถุดิบ</p>
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

                {/* Mobile Floating Action Button for Adding Ingredient */}
                <button 
                    onClick={() => setIsMobilePickerOpen(true)}
                    className="md:hidden absolute bottom-24 right-4 w-14 h-14 bg-black text-white rounded-full shadow-2xl flex items-center justify-center z-30 hover:scale-105 transition-transform"
                >
                    <Plus size={28} />
                </button>

                {/* Price Simulator Embedded */}
                <div className="p-4 bg-white border-t border-gray-100 hidden md:block">
                     <PriceSimulator totalCost={totalCost} initialPrice={initialPrice} />
                </div>

                <div className="p-4 bg-white border-t flex justify-end gap-3 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-20">
                    <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 flex-1 md:flex-none">
                        ยกเลิก
                    </button>
                    <button onClick={handleSave} className="px-8 py-3 rounded-xl bg-[#1A1A1A] text-white font-bold hover:bg-black shadow-xl flex-1 md:flex-none">
                        บันทึกสูตร
                    </button>
                </div>
            </div>

            {/* Right: Ingredient Picker - Responsive Behavior */}
            <div className={`
                fixed inset-0 z-40 bg-white flex flex-col md:static md:w-[400px] md:shadow-2xl transition-transform duration-300
                ${isMobilePickerOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}
            `}>
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 md:bg-white">
                     <div className="flex items-center gap-2">
                        {/* Mobile Back Button */}
                        <button onClick={() => setIsMobilePickerOpen(false)} className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-200">
                             <X size={24} />
                        </button>
                        <h3 className="font-bold text-lg">คลังวัตถุดิบ</h3>
                     </div>
                     <button 
                        onClick={() => setIsQuickAddOpen(true)}
                        className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg flex items-center gap-1 shadow-md"
                    >
                        <Plus size={14} /> สร้างใหม่
                    </button>
                </div>

                <div className="p-4 pb-2 border-b bg-gray-50 md:bg-white">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            className="w-full bg-white md:bg-gray-100 border border-gray-200 md:border-transparent rounded-xl py-2 pl-10 pr-4 focus:ring-2 focus:ring-blue-100 outline-none"
                            placeholder="ค้นหาวัตถุดิบ..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus={isMobilePickerOpen}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 bg-gray-50 md:bg-white pb-20 md:pb-0">
                    {filteredItems.map(item => (
                        <div 
                            key={item.id}
                            className="p-3 mb-2 rounded-xl bg-white border shadow-sm md:shadow-none md:border-gray-200 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all flex justify-between items-center group"
                            onClick={() => {
                                handleAddIngredient(item);
                                if(window.innerWidth < 768) setIsMobilePickerOpen(false); // Close on mobile after picking
                            }}
                        >
                             <div className="flex-1">
                                <div className="font-bold text-sm text-gray-800">{item.name}</div>
                                <div className="text-xs text-gray-400">{item.usage_unit}</div>
                            </div>
                            <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                <Plus size={16} />
                            </button>
                        </div>
                    ))}
                    {filteredItems.length === 0 && (
                        <div className="text-center py-10 text-gray-400 text-sm">
                            ไม่พบวัตถุดิบ "{searchTerm}" <br/>
                            <button onClick={() => setIsQuickAddOpen(true)} className="text-blue-600 underline mt-2">สร้างใหม่เลย?</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
