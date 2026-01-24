import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { fetchAndSortMenu } from '../../utils/menuHelper';
import { calculateRecipeCost } from '../../utils/costUtils';
import { ChefHat, ArrowLeft, RefreshCw, Calculator, DollarSign, TrendingUp, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import RecipeBuilder from '../recipes/RecipeBuilder';

export default function MenuCostPage() {
    const navigate = useNavigate();
    const [menuItems, setMenuItems] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Recipe Builder State
    const [isRecipeOpen, setIsRecipeOpen] = useState(false);
    const [recipeTarget, setRecipeTarget] = useState(null);

    const [summary, setSummary] = useState({ totalRevenue: 0, totalCost: 0, avgMargin: 0 });

    // Sorting & Filtering State
    const [sortConfig, setSortConfig] = useState({ key: 'category', direction: 'asc' }); // Default: Category A-Z
    const [filterMode, setFilterMode] = useState('all'); // 'all', 'missing_recipe', 'low_margin'
    const [searchTerm, setSearchTerm] = useState('');
    const [debugLog, setDebugLog] = useState({});

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Menu Items
            const { menuItems: data } = await fetchAndSortMenu();
            
            // 2. Fetch All Recipe Links (for bulk calculation)
            const { data: recipeLinks } = await supabase
                .from('recipe_ingredients')
                .select(`
                    parent_menu_item_id,
                    ingredient_id,
                    quantity,
                    unit,
                    ingredient:stock_items (
                        id, name, cost_price, pack_size, pack_unit, usage_unit, conversion_factor, yield_percent
                    )
                `);
            
            // Debug: Check if we actually got links
            // console.log("Recipe Links Found:", recipeLinks?.length);

            // 3. Map Recipe to Menu ID
            const recipesByMenu = {};
            if (recipeLinks) {
                recipeLinks.forEach(link => {
                    const mid = link.parent_menu_item_id;
                    if (mid) {
                        const midStr = String(mid); // Ensure string key
                        if (!recipesByMenu[midStr]) {
                            recipesByMenu[midStr] = [];
                        }
                        recipesByMenu[midStr].push({
                            ingredient_id: link.ingredient_id, // Use Raw ID
                            ingredient: link.ingredient,       // Joined Data (might be null)
                            quantity: link.quantity,
                            unit: link.unit
                        });
                    }
                });
            }

            // DEBUG CAZY
            setDebugLog({
                ts: new Date().toISOString(),
                totalMenu: data?.length,
                totalLinks: recipeLinks?.length,
                sampleMenuId: data?.[0] ? `${data[0].id} (${typeof data[0].id})` : 'N/A',
                sampleMenuName: data?.[0]?.name,
                sampleLinkParentId: recipeLinks?.[0] ? `${recipeLinks[0].parent_menu_item_id} (${typeof recipeLinks[0].parent_menu_item_id})` : 'N/A',
                keysInMap: Object.keys(recipesByMenu).slice(0, 5),
                isMatchFoundForFirst: data?.[0] ? !!recipesByMenu[String(data[0].id)] : false
            });

            // 4. Calculate Costs
            let revObserved = 0;
            let costObserved = 0;
            let count = 0;

            const enrichedItems = data.map(item => {
                const ingredients = recipesByMenu[String(item.id)] || []; // Lookup by string ID
                // Helper to mimic 'getIngredientById' for costUtils, but we already have full object in 'ingredient'
                const breakdown = calculateRecipeCost(ingredients, (id) => ingredients.find(i => i.ingredient_id === id)?.ingredient, { qFactorPercent: item.q_factor_percent || 0 });
                
                const cost = breakdown.totalCost;
                const price = item.price || 0;
                const profit = price - cost;
                const margin = price > 0 ? (profit / price) * 100 : 0;
                const costPercent = price > 0 ? (cost / price) * 100 : 0;

                if (cost > 0) {
                    revObserved += price;
                    costObserved += cost;
                    count++;
                }

                return {
                    ...item,
                    cost,
                    profit,
                    margin,
                    costPercent,
                    hasRecipe: ingredients.length > 0
                };
            });

            setMenuItems(enrichedItems);
            setSummary({
                totalRevenue: revObserved,
                totalCost: costObserved,
                avgMargin: revObserved > 0 ? ((revObserved - costObserved) / revObserved) * 100 : 0
            });

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const processData = (items) => {
        let filtered = [...items];

        // 0. Search
        if (searchTerm) {
            const lowerIds = searchTerm.toLowerCase();
            filtered = filtered.filter(i => 
                i.name.toLowerCase().includes(lowerIds) || 
                (i.category && i.category.toLowerCase().includes(lowerIds))
            );
        }

        // 1. Filter
        if (filterMode === 'missing_recipe') {
            filtered = filtered.filter(i => !i.hasRecipe);
        } else if (filterMode === 'low_margin') {
            filtered = filtered.filter(i => i.hasRecipe && i.margin < 50);
        }

        // 2. Sort
        filtered.sort((a, b) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];

            // Case insensitive string sort
            if (typeof aVal === 'string') aVal = aVal.toLowerCase();
            if (typeof bVal === 'string') bVal = bVal.toLowerCase();

            // Handle null/undefined (push to bottom)
            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;
            
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            
            // Secondary Sort: Always Alphabetical (Name)
            return a.name.localeCompare(b.name, 'th');
        });

        return filtered;
    };

    const sortedItems = processData(menuItems);

    const handleOpenRecipe = (item) => {
        setRecipeTarget(item);
        setIsRecipeOpen(true);
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
                                <Calculator className="w-6 h-6 text-blue-600" />
                                วิเคราะห์ต้นทุน (Costing Dashboard)
                            </h1>
                            <p className="text-xs text-gray-500">สรุปต้นทุนกำไรของทุกเมนู</p>
                        </div>
                    </div>
                    <button onClick={loadData} className="p-2 hover:bg-gray-100 rounded-full">
                        <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-4 space-y-6 pb-20">
                
                {/* Controls */}
                <div className="flex flex-col md:flex-row gap-4 justify-between items-end">
                    <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
                        <div className="relative group w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-blue-500 transition-colors" size={18} />
                            <input 
                                type="text" 
                                placeholder="ค้นหาเมนู..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                            />
                        </div>
                        <div className="h-8 w-px bg-gray-300 mx-2 hidden md:block"></div>
                        <button 
                            onClick={() => setFilterMode('all')}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${filterMode === 'all' ? 'bg-black text-white' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
                        >
                            ทั้งหมด ({menuItems.length})
                        </button>
                        <button 
                            onClick={() => setFilterMode('missing_recipe')}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${filterMode === 'missing_recipe' ? 'bg-red-100 text-red-700' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
                        >
                            ยังไม่มีสูตร ({menuItems.filter(i => !i.hasRecipe).length})
                        </button>
                        <button 
                            onClick={() => setFilterMode('low_margin')}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${filterMode === 'low_margin' ? 'bg-orange-100 text-orange-700' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
                        >
                            กำไรน้อย &lt; 50%
                        </button>
                    </div>

                    <div className="bg-white px-4 py-2 rounded-xl border shadow-sm flex items-center gap-4">
                        <div className="text-right">
                             <div className="text-[10px] text-gray-400 uppercase font-bold">ต้นทุนรวม</div>
                             <div className="font-bold text-gray-700">฿{summary.totalCost.toLocaleString()}</div>
                        </div>
                        <div className="w-px h-8 bg-gray-100"></div>
                        <div className="text-right">
                             <div className="text-[10px] text-gray-400 uppercase font-bold">กำไรเฉลี่ย</div>
                             <div className={`text-xl font-bold ${summary.avgMargin >= 65 ? 'text-green-600' : 'text-orange-500'}`}>
                                 {summary.avgMargin.toFixed(1)}%
                             </div>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500 font-bold">
                                <tr>
                                    <th className="p-4 cursor-pointer hover:text-black" onClick={() => handleSort('name')}>
                                        เมนู {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="p-4 text-right cursor-pointer hover:text-black" onClick={() => handleSort('price')}>
                                        ราคาขาย {sortConfig.key === 'price' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="p-4 text-right cursor-pointer hover:text-black" onClick={() => handleSort('cost')}>
                                        ต้นทุน {sortConfig.key === 'cost' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="p-4 text-right cursor-pointer hover:text-black" onClick={() => handleSort('profit')}>
                                        กำไร {sortConfig.key === 'profit' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="p-4 text-right cursor-pointer hover:text-black" onClick={() => handleSort('costPercent')}>
                                        ต้นทุน % {sortConfig.key === 'costPercent' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="p-4 text-center">จัดการสูตร</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {sortedItems.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                                                    {item.image_url && <img src={item.image_url} className="w-full h-full object-cover"/>}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-sm">{item.name}</div>
                                                    <div className="text-xs text-gray-400">{item.category}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-medium">
                                            {item.price.toLocaleString()}
                                        </td>
                                        <td className="p-4 text-right">
                                            {item.hasRecipe ? (
                                                <span className="font-mono font-bold text-gray-700">฿{item.cost.toFixed(2)}</span>
                                            ) : (
                                                <span className="text-xs text-gray-400 italic">ยังไม่ผูกสูตร</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className={`font-bold ${item.profit > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                {item.profit.toFixed(0)}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            {item.hasRecipe && (
                                                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                                    item.costPercent > 35 ? 'bg-red-100 text-red-700' : 
                                                    item.costPercent > 30 ? 'bg-orange-100 text-orange-700' :
                                                    'bg-green-100 text-green-700'
                                                }`}>
                                                    {item.costPercent.toFixed(1)}%
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            <button 
                                                onClick={() => handleOpenRecipe(item)}
                                                className={`p-2 rounded-lg transition-colors flex items-center justify-center mx-auto gap-2 text-xs font-bold ${
                                                    item.hasRecipe 
                                                    ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' 
                                                    : 'bg-black text-white hover:bg-gray-800 shadow-lg'
                                                }`}
                                            >
                                                <ChefHat size={16} />
                                                {!item.hasRecipe && "สร้างสูตร"}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Recipe Modal */}
            {isRecipeOpen && recipeTarget && (
                <RecipeBuilder 
                    parentId={recipeTarget.id}
                    parentType="menu"
                    initialPrice={recipeTarget.price}
                    onClose={async () => {
                        setIsRecipeOpen(false);
                        // Add small delay to ensure DB write propagation
                        setTimeout(() => loadData(), 500); 
                    }}
                />
            )}

            {/* DEBUG PANEL */}
            <div className="max-w-7xl mx-auto p-4">
                <div className="bg-black text-green-400 p-4 font-mono text-xs overflow-auto max-h-60 rounded-xl shadow-lg">
                    <h3 className="text-white font-bold border-b border-gray-700 mb-2">DEBUG INFO (Refining Cost Logic)</h3>
                    <pre>{JSON.stringify(debugLog, null, 2)}</pre>
                </div>
            </div>
        </div>
    );
}
