import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { DndContext, useSensor, useSensors, PointerSensor, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Trash2, GripVertical, AlertTriangle, Layers, Pencil } from 'lucide-react';
import { calculateRecipeCost, getLayerColor } from '../../utils/costUtils';
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

    // Helper: Determine if units are identifiable
    const areUnitsSame = formData.pack_unit === formData.usage_unit;
    
    // Reverse Logic State (e.g. 1 UsageUnit = X PackUnit)
    // If factor is 0.0555... (1/18), we want to show "18".
    // Let's use a local state for the "Display" of conversion
    // But easier: Just toggles.
    
    // If usage unit != pack unit, we show conversion logic.
    // Default to "1 [Usage] uses [X] [PackUnit]" logic if factor < 1? 
    // Or just always show "How much [PackUnit] in 1 [UsageUnit]?"
    
    const [useRatioMode, setUseRatioMode] = useState(false); // true = "1 Usage = X PackUnit" (Divide), false = "1 Pack = X Usage" (Multiply)

    // Auto-calculate Real Cost for preview
    const realCostPerUsage = (formData.cost_price / (formData.pack_size * formData.conversion_factor)) * (100 / formData.yield_percent);
    const costPerPackUnit = formData.cost_price / formData.pack_size;

    useEffect(() => {
        // Force factor 1 if same units
        if (formData.pack_unit === formData.usage_unit && formData.conversion_factor !== 1) {
             setFormData(prev => ({ ...prev, conversion_factor: 1 }));
        }
    }, [formData.pack_unit, formData.usage_unit]);

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
                                        const suggested = suggestConversionFactor(formData.pack_unit, newUnit);
                                        setFormData({...formData, usage_unit: newUnit, conversion_factor: suggested !== 1 ? suggested : 1});
                                    }} 
                                    className="w-full p-2 rounded border border-orange-200 text-sm font-bold bg-white" 
                                >
                                    {THAI_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Conversion Logic */}
                        {!areUnitsSame && (
                            <div className="bg-white p-2 rounded-lg border border-orange-100 mt-2">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-[10px] font-bold text-gray-500">ตั้งค่าการแปลงหน่วย</label>
                                    <button 
                                        onClick={() => setUseRatioMode(!useRatioMode)}
                                        className="text-[10px] text-blue-600 underline"
                                    >
                                        สลับวิธีคำนวณ
                                    </button>
                                </div>
                                
                                <div className="flex items-center gap-2 text-sm">
                                    {useRatioMode ? (
                                        // Ratio Mode: 1 UsageUnit = X PackUnit (e.g. 1 Glass = 18 g)
                                        // Factor = 1 / X
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
                                        // Direct Mode: 1 PackUnit = X UsageUnit (e.g. 1 kg = 1000 g)
                                        // Factor = X
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

                    {/* Preview */}
                    <div className="p-3 bg-gray-100 rounded-xl flex justify-between items-center">
                        <span className="text-xs text-gray-500">ต้นทุนจริงเฉลี่ย</span>
                        <div className="text-right">
                             <span className="font-bold text-lg text-green-600">฿{realCostPerUsage.toFixed(4)} <span className="text-xs text-black font-normal">/ {formData.usage_unit}</span></span>
                        </div>
                    </div>
                     
                    {/* Calculation Helper for User Confidence */}
                    <div className="text-[10px] text-gray-400 text-center">
                        สูตร: ({formData.cost_price} / {formData.pack_size}) ÷ {formData.conversion_factor.toFixed(4)}
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

// Sortable Layer Component
function SortableLayer({ id, ingredient, quantity, unit, cost, index, onDelete, onUpdate, onEditStock }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    
    return (
        <div 
            ref={setNodeRef} style={style} {...attributes}
            className={`flex items-center gap-3 p-3 rounded-xl border mb-2 bg-white shadow-sm ${index === 0 ? 'border-b-4 border-b-gray-200' : ''}`}
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
                    ฿{ingredient.unitCost?.toFixed(4) || 0} / {ingredient.usage_unit} <Pencil size={10} />
                </button>
            </div>

            <div className="flex items-center gap-2">
                <input 
                    type="number" 
                    className="w-16 md:w-20 bg-gray-50 border rounded-lg p-2 text-right font-bold text-sm"
                    value={quantity}
                    onChange={(e) => onUpdate(id, parseFloat(e.target.value))}
                />
                <span className="text-xs text-gray-500 w-8 truncate">{unit}</span>
            </div>

            <div className="text-right w-20 md:w-24">
                <div className="font-bold text-[#1A1A1A]">฿{cost.toFixed(2)}</div>
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

    const sensors = useSensors(useSensor(PointerSensor));

    const loadData = async () => {
        // ... (Keep existing loadData logic)
        setLoading(true);
        try {
            // 1. Fetch Existing Recipe
            const { data: recipeData } = await supabase
                .from('recipe_ingredients')
                .select(`*, ingredient:stock_items(*)`)
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
            // 1. Delete old links (Simplest strategy for MVP)
            const queryField = parentType === 'menu' ? 'parent_menu_item_id' : 'parent_stock_item_id';
            await supabase.from('recipe_ingredients').delete().eq(queryField, parentId);

            // 2. Insert new
            const payloads = ingredients.map((ing, idx) => ({
                [queryField]: parentId,
                ingredient_id: ing.ingredientId,
                quantity: ing.quantity,
                unit: ing.unit,
                layer_order: idx
            }));

            if (payloads.length > 0) {
                const { error } = await supabase.from('recipe_ingredients').insert(payloads);
                if (error) throw error;
            }

            // 3. Update Parent Cost (Auto-Propagation Hook)
            // If it's a Stock Item (Base Recipe), we update its 'cost_price'.
            if (parentType === 'stock') {
                 const { error: updateError } = await supabase
                    .from('stock_items')
                    .update({ cost_price: totalCost })
                    .eq('id', parentId);
                 if (updateError) console.error("Failed to update parent cost", updateError);
            }

            toast.success('บันทึกสูตรเรียบร้อย');
            onClose();

        } catch (err) {
            console.error(err);
            toast.error('บันทึกไม่สำเร็จ');
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
                    return { ...p, ingredient: { ...p.ingredient, ...newFormData } };
                }
                return p;
            }));

        } catch (err) {
            console.error(err);
            toast.error('อัปเดตไม่สำเร็จ');
        }
    };

    // Filter available items
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

            {/* Left: Recipe Stack (The "Soul" Visual) */}
            <div className="flex-1 flex flex-col bg-gray-50 border-r border-gray-200">
                <div className="p-4 border-b bg-white shadow-sm flex justify-between items-center z-10">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Layers className="text-[#1A1A1A]" /> 
                            {parentItem?.name ? `สูตรของ ${parentItem.name}` : 'ตัวเนรมิตสูตร'}
                        </h2>
                        <p className="text-xs text-gray-500">
                             {parentType === 'stock' && parentItem 
                                ? `สำหรับ 1 แพ็ค (${parentItem.pack_size} ${parentItem.pack_unit})`
                                : 'ลากวางเพื่อเปลี่ยน Layer • คำนวณต้นทุน Real-time'
                             }
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-gray-500">ต้นทุนรวม (Sub Total)</div>
                        <div className="text-2xl font-bold text-blue-600">฿{totalCost.toFixed(2)}</div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {ingredients.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded-2xl">
                            <Layers className="w-16 h-16 mb-4 opacity-20" />
                            <p>ยังไม่มีวัตถุดิบ</p>
                            <p className="text-sm">เลือกวัตถุดิบจากด้านขวาเพื่อเริ่มปรุง</p>
                        </div>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={ingredients.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                {ingredients.map((item, idx) => (
                                    <SortableLayer 
                                        key={item.id} 
                                        index={idx}
                                        {...item}
                                        cost={(item.ingredient?.cost_price / (item.ingredient?.pack_size * item.ingredient?.conversion_factor || 1)) * item.quantity} // Rough calc
                                        onDelete={(id) => setIngredients(prev => prev.filter(x => x.id !== id))}
                                        onUpdate={(id, qty) => setIngredients(prev => prev.map(x => x.id === id ? { ...x, quantity: qty } : x))}
                                        onEditStock={setEditingStockItem}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>
                    )}
                </div>

                {/* Price Simulator Embedded */}
                <div className="p-4 bg-white border-t border-gray-100">
                     <PriceSimulator totalCost={totalCost} initialPrice={initialPrice} />
                </div>

                <div className="p-4 bg-white border-t flex justify-end gap-3 shadow-lg">
                    <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100">
                        ยกเลิก
                    </button>
                    <button onClick={handleSave} className="px-8 py-3 rounded-xl bg-[#1A1A1A] text-white font-bold hover:bg-black shadow-xl">
                        บันทึกสูตร
                    </button>
                </div>
            </div>

            {/* Right: Ingredient Picker */}
            <div className="w-full md:w-[400px] bg-white flex flex-col shadow-2xl z-20">
                <div className="p-4 border-b">
                     <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold">คลังวัตถุดิบ</h3>
                        <button className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">จัดการสต็อก</button>
                     </div>
                    <input 
                        className="w-full bg-gray-100 border-none rounded-xl py-2 px-4"
                        placeholder="ค้นหาวัตถุดิบ..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    {filteredItems.map(item => (
                        <div 
                            key={item.id}
                            className="p-3 mb-2 rounded-xl border hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all flex justify-between items-center group"
                        >
                             <div className="flex-1" onClick={() => handleAddIngredient(item)}>
                                <div className="font-bold text-sm">{item.name}</div>
                                <div className="text-xs text-gray-400">{item.usage_unit}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Quick Edit in Picker too? Maybe later. For now just add button */}
                                <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors" onClick={() => handleAddIngredient(item)}>
                                    <Plus size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
