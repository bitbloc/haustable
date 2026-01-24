import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { DndContext, useSensor, useSensors, PointerSensor, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Trash2, GripVertical, AlertTriangle, Layers } from 'lucide-react';
import { calculateRecipeCost, getLayerColor } from '../../utils/costUtils';
import { toast } from 'sonner';
import PriceSimulator from './PriceSimulator';

// Sortable Layer Component
function SortableLayer({ id, ingredient, quantity, unit, cost, index, onDelete, onUpdate }) {
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

            <div className="flex-1">
                <div className="font-bold text-[#1A1A1A]">{ingredient.name}</div>
                <div className="text-xs text-gray-500">
                    ฿{ingredient.unitCost?.toFixed(4) || 0} / {ingredient.usage_unit}
                </div>
            </div>

            <div className="flex items-center gap-2">
                <input 
                    type="number" 
                    className="w-20 bg-gray-50 border rounded-lg p-2 text-right font-bold"
                    value={quantity}
                    onChange={(e) => onUpdate(id, parseFloat(e.target.value))}
                />
                <span className="text-xs text-gray-500 w-8">{unit}</span>
            </div>

            <div className="text-right w-24">
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

    const sensors = useSensors(useSensor(PointerSensor));

    const loadData = async () => {
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
            // Assumption: The Recipe produces '1 Pack' of the Stock Item.
            if (parentType === 'stock') {
                 const { error: updateError } = await supabase
                    .from('stock_items')
                    .update({ cost_price: totalCost })
                    .eq('id', parentId);
                 if (updateError) console.error("Failed to update parent cost", updateError);
            }
            // If it's Menu Item, we could update a 'cost' column if it existed, but we rely on live calc for now
            // or we can add it later.

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
        const { active, over } = event;
        if (active.id !== over.id) {
            setIngredients((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    // Filter available items
    const filteredItems = availableItems.filter(i => 
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !ingredients.some(existing => existing.ingredientId === i.id) // Hide already added
    );

    return (
        <div className="fixed inset-0 z-[70] bg-white flex flex-col md:flex-row animate-in fade-in">
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
                                        cost={(item.ingredient?.cost_price / (item.ingredient?.pack_size * item.ingredient?.conversion_factor || 1)) * item.quantity} // Rough calc for display
                                        onDelete={(id) => setIngredients(prev => prev.filter(x => x.id !== id))}
                                        onUpdate={(id, qty) => setIngredients(prev => prev.map(x => x.id === id ? { ...x, quantity: qty } : x))}
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
                    <h3 className="font-bold mb-2">คลังวัตถุดิบ</h3>
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
                            onClick={() => handleAddIngredient(item)}
                            className="p-3 mb-2 rounded-xl border hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all flex justify-between items-center group"
                        >
                            <div>
                                <div className="font-bold text-sm">{item.name}</div>
                                <div className="text-xs text-gray-400">{item.usage_unit}</div>
                            </div>
                            <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                <Plus size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
