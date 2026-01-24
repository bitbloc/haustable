import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { fetchAndSortMenu } from '../../utils/menuHelper';
import { calculateRecipeCost } from '../../utils/costUtils';
import { ChefHat, ArrowLeft, RefreshCw, Calculator, DollarSign, TrendingUp } from 'lucide-react';
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

    const loadData = async () => {
        // ... (Keep loadData logic)
    };

    // ... (useEffect remains same) ...

    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const processData = (items) => {
        let filtered = [...items];

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
                    <div className="flex gap-2">
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
                             <div className="text-[10px] text-gray-400 uppercase font-bold">ต้นทุนรวม (Total Cost)</div>
                             <div className="font-bold text-gray-700">฿{summary.totalCost.toLocaleString()}</div>
                        </div>
                        <div className="w-px h-8 bg-gray-100"></div>
                        <div className="text-right">
                             <div className="text-[10px] text-gray-400 uppercase font-bold">กำไรเฉลี่ย (Avg Margin)</div>
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
                                        เมนู (Menu) {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="p-4 text-right cursor-pointer hover:text-black" onClick={() => handleSort('price')}>
                                        ราคาขาย (Price) {sortConfig.key === 'price' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="p-4 text-right cursor-pointer hover:text-black" onClick={() => handleSort('cost')}>
                                        ต้นทุน (Cost) {sortConfig.key === 'cost' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="p-4 text-right cursor-pointer hover:text-black" onClick={() => handleSort('profit')}>
                                        กำไร (Profit) {sortConfig.key === 'profit' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="p-4 text-right cursor-pointer hover:text-black" onClick={() => handleSort('costPercent')}>
                                        Cost % {sortConfig.key === 'costPercent' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="p-4 text-center">สูตร (Recipe)</th>
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
                                                <span className="text-xs text-gray-400 italic">No Recipe</span>
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
                                                {!item.hasRecipe && "Create"}
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
                    onClose={() => {
                        setIsRecipeOpen(false);
                        loadData(); // Refresh after edit
                    }}
                />
            )}
        </div>
    );
}
