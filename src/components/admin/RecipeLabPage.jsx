import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { calculateRecipeCost } from '../../utils/costUtils';
import { ChefHat, ArrowLeft, RefreshCw, FlaskConical, Plus, Search, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import RecipeBuilder from '../recipes/RecipeBuilder';
import { toast } from 'sonner';

export default function RecipeLabPage() {
    const navigate = useNavigate();
    const [labItems, setLabItems] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Recipe Builder State
    const [isRecipeOpen, setIsRecipeOpen] = useState(false);
    const [recipeTarget, setRecipeTarget] = useState(null);

    // New Item Form State
    const [activeId, setActiveId] = useState(null); // Just for potential drag/drop later if needed
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newItemName, setNewItemName] = useState('');

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch Base Recipes
             const { data: stockItems, error } = await supabase
                .from('stock_items')
                .select('*')
                .eq('is_base_recipe', true)
                .order('name');
            
            if (error) throw error;

            // Fetch Recipe Details for quick cost preview
            // Could optimize by doing a join or separate fetch if list is long.
            // For now, let's fetch recipe_ingredients for these items to calc cost.
             const { data: recipeLinks } = await supabase
                .from('recipe_ingredients')
                .select(`
                    parent_stock_item_id,
                    ingredient_id,
                    quantity,
                    unit,
                    ingredient:stock_items!recipe_ingredients_ingredient_id_fkey (
                        id, name, cost_price, pack_size, pack_unit, usage_unit, conversion_factor
                    )
                `)
                .in('parent_stock_item_id', stockItems.map(i => i.id));

            // Map Cost
            const enriched = stockItems.map(item => {
                const ingredients = recipeLinks?.filter(l => l.parent_stock_item_id === item.id) || [];
                
                // transform for calculator
                const calcIngredients = ingredients.map(l => ({
                    ingredient: l.ingredient,
                    quantity: l.quantity,
                    unit: l.unit
                }));
                
                const { totalCost } = calculateRecipeCost(calcIngredients, (id) => calcIngredients.find(i => i.ingredient?.id === id)?.ingredient);
                
                return {
                    ...item,
                    cost: totalCost,
                    ingredientCount: ingredients.length
                };
            });

            setLabItems(enriched);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load lab recipes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleCreate = async () => {
        if (!newItemName.trim()) return;
        try {
            const { data, error } = await supabase.from('stock_items').insert({
                name: newItemName,
                is_base_recipe: true,
                category: 'restock', // Hidden/Internal
                cost_price: 0,
                pack_size: 1,
                pack_unit: 'unit',
                usage_unit: 'unit',
                unit: 'unit',
                current_quantity: 0
            }).select().single();

            if (error) throw error;
            
            toast.success('Created new formula');
            setNewItemName('');
            setIsCreateOpen(false);
            loadData();
            
            // Auto open builder
            setRecipeTarget(data);
            setIsRecipeOpen(true);

        } catch (err) {
            console.error(err);
            toast.error('Failed: ' + err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this formula?')) return;
        try {
            await supabase.from('stock_items').delete().eq('id', id);
            toast.success('Deleted');
            loadData();
        } catch (err) {
            toast.error('Delete failed');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 text-[#1A1A1A] font-sans">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
                <div className="p-4 flex justify-between items-center max-w-7xl mx-auto">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/admin')} className="p-2 hover:bg-gray-100 rounded-full">
                            <ArrowLeft className="w-6 h-6 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                <FlaskConical className="w-6 h-6 text-purple-600" />
                                Recipe Lab (ห้องทดลองสูตร)
                            </h1>
                            <p className="text-xs text-gray-500">จัดการสูตรกลาง (Base Recipe) และคิดต้นทุนก่อนขายจริง</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                         <button 
                            onClick={() => setIsCreateOpen(true)}
                            className="bg-purple-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-purple-700 shadow-lg"
                        >
                            <Plus size={18} /> New Formula
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-4 space-y-6 pb-20">
                {/* Grid */}
                {loading ? (
                     <div className="text-center py-20 text-gray-400">Loading Lab...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {labItems.map(item => (
                            <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                                        <FlaskConical size={24} />
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] text-gray-400 uppercase font-bold">Estimated Cost</div>
                                        <div className="text-xl font-mono font-bold text-gray-800">฿{item.cost.toFixed(2)}</div>
                                    </div>
                                </div>
                                
                                <h3 className="font-bold text-lg mb-1">{item.name}</h3>
                                <p className="text-sm text-gray-400 mb-6">{item.ingredientCount} ingredients</p>

                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => { setRecipeTarget(item); setIsRecipeOpen(true); }}
                                        className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold py-2 rounded-xl text-sm transition-colors border border-gray-200"
                                    >
                                        Edit Recipe
                                    </button>
                                     <button 
                                        onClick={() => handleDelete(item.id)}
                                        className="w-10 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

             {/* Create Modal */}
             {isCreateOpen && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                        <h3 className="text-lg font-bold mb-4">New Formula Name</h3>
                        <input 
                            value={newItemName}
                            onChange={e => setNewItemName(e.target.value)}
                            className="w-full border rounded-xl p-3 mb-4 font-bold"
                            placeholder="e.g. Secret Sauce V1"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <button onClick={() => setIsCreateOpen(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-500">Cancel</button>
                            <button onClick={handleCreate} className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold">Create</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Recipe Builder Modal */}
            {isRecipeOpen && recipeTarget && (
                <RecipeBuilder 
                    parentId={recipeTarget.id}
                    parentType="stock" // Important: tells builder it's a base recipe
                    onClose={async () => {
                        setIsRecipeOpen(false);
                        loadData(); 
                    }}
                />
            )}
        </div>
    );
}
