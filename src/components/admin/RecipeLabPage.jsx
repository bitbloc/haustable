import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { calculateRecipeCost } from '../../utils/costUtils';
import { ChefHat, ArrowLeft, RefreshCw, FlaskConical, Plus, Search, Trash2, Folder, FolderPlus, Check, X, Pencil, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import RecipeBuilder from '../recipes/RecipeBuilder';
import { toast } from 'sonner';

export default function RecipeLabPage({ isEmbedded = false }) {
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

    // Search and Folder State
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');
    const [customFolders, setCustomFolders] = useState([]);
    const [activeDropdownId, setActiveDropdownId] = useState(null);

    // Rename State
    const [editingItemId, setEditingItemId] = useState(null);
    const [editingName, setEditingName] = useState('');

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
             const { data: recipeLinks } = await supabase
                .from('recipe_ingredients')
                .select(`
                    parent_stock_item_id,
                    ingredient_id,
                    quantity,
                    unit,
                    ingredient:stock_items!recipe_ingredients_ingredient_id_fkey (
                        id, name, cost_price, pack_size, pack_unit, usage_unit, conversion_factor, yield_percent
                    )
                `)
                .in('parent_stock_item_id', stockItems.map(i => i.id));

            // Map Cost
            const enriched = stockItems.map(item => {
                const ingredients = recipeLinks?.filter(l => l.parent_stock_item_id === item.id) || [];
                
                const { totalCost } = calculateRecipeCost(ingredients, (id) => ingredients.find(i => i.ingredient_id === id)?.ingredient, { qFactorPercent: item.q_factor_percent || 0 });
                
                const grandTotal = totalCost;

                return {
                    ...item,
                    materialCost: totalCost,
                    cost: grandTotal,
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

    // Generate unique folder names (only recognize those starting with "folder:")
    const uniqueCats = Array.from(new Set(
        labItems
            .map(item => {
                const cat = item.category;
                if (cat && cat.startsWith('folder:')) {
                    return cat.substring(7); // Strip "folder:" prefix
                }
                return 'uncategorized';
            })
    ));
    const allFolders = ['all', ...uniqueCats.filter(c => c !== 'uncategorized'), ...customFolders.filter(c => !uniqueCats.includes(c)), 'uncategorized'];

    // Get count of recipes in a folder
    const getFolderCount = (folder) => {
        return labItems.filter(item => {
            const itemCat = item.category;
            const isFolder = itemCat && itemCat.startsWith('folder:');
            const folderName = isFolder ? itemCat.substring(7) : 'uncategorized';
            
            if (folder === 'all') return true;
            if (folder === 'uncategorized') return folderName === 'uncategorized';
            return folderName === folder;
        }).length;
    };

    const handleCreateFolder = () => {
        const folderName = prompt('ป้อนชื่อหมวดหมู่ / โฟลเดอร์ใหม่:');
        if (folderName && folderName.trim()) {
            const trimmed = folderName.trim();
            if (trimmed.toLowerCase() === 'all' || trimmed.toLowerCase() === 'uncategorized' || trimmed.toLowerCase() === 'restock') {
                toast.error('ไม่สามารถใช้ชื่อโฟลเดอร์นี้ได้');
                return;
            }
            if (!customFolders.includes(trimmed)) {
                setCustomFolders(prev => [...prev, trimmed]);
            }
            setActiveCategory(trimmed);
            toast.success(`สร้างโฟลเดอร์ "${trimmed}" แล้ว`);
        }
    };

    const handleCreate = async () => {
        if (!newItemName.trim()) return;
        try {
            // Auto assign active folder (unless it is all/uncategorized)
            const initialCategory = (activeCategory !== 'all' && activeCategory !== 'uncategorized') 
                ? `folder:${activeCategory}` 
                : 'restock';
            
            const { data, error } = await supabase.from('stock_items').insert({
                name: newItemName,
                is_base_recipe: true,
                category: initialCategory,
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

    const handleRename = async (itemId) => {
        if (!editingName.trim()) return;
        try {
            const { error } = await supabase
                .from('stock_items')
                .update({ name: editingName.trim() })
                .eq('id', itemId);
            if (error) throw error;
            toast.success('เปลี่ยนชื่อสูตรสำเร็จ');
            setEditingItemId(null);
            loadData();
        } catch (err) {
            console.error(err);
            toast.error('เปลี่ยนชื่อสูตรล้มเหลว');
        }
    };

    const handleMoveFolder = async (itemId, targetCategory) => {
        try {
            const dbCategory = (targetCategory === 'restock' || targetCategory === 'uncategorized')
                ? 'restock'
                : `folder:${targetCategory}`;

            const { error } = await supabase
                .from('stock_items')
                .update({ category: dbCategory })
                .eq('id', itemId);
            if (error) throw error;
            toast.success(`ย้ายสูตรไปที่ "${targetCategory === 'restock' ? 'ทั่วไป' : targetCategory}" แล้ว`);
            setActiveDropdownId(null);
            loadData();
        } catch (err) {
            console.error(err);
            toast.error('ย้ายโฟลเดอร์ล้มเหลว');
        }
    };

    // Filter recipes based on folder & search query
    const getFilteredRecipes = () => {
        return labItems.filter(item => {
            // Folder Filter
            const itemCat = item.category;
            const isFolder = itemCat && itemCat.startsWith('folder:');
            const folderName = isFolder ? itemCat.substring(7) : 'uncategorized';
            
            if (activeCategory === 'uncategorized') {
                if (folderName !== 'uncategorized') return false;
            } else if (activeCategory !== 'all') {
                if (folderName !== activeCategory) return false;
            }

            // Search query Filter
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase().trim();
                return item.name.toLowerCase().includes(query);
            }

            return true;
        });
    };

    const filteredRecipes = getFilteredRecipes();

    return (
        <div className={`${isEmbedded ? '' : 'min-h-screen bg-gray-50'} text-[#1A1A1A] font-sans`}>
            {/* Header */}
            <div className={`${isEmbedded ? 'bg-transparent mb-4' : 'sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm'}`}>
                <div className={`p-3 flex justify-between items-center ${isEmbedded ? '' : 'max-w-7xl mx-auto'}`}>
                    <div className="flex items-center gap-3">
                        {!isEmbedded && (
                            <button onClick={() => navigate('/admin')} className="p-2 hover:bg-gray-100 rounded-full">
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                        )}
                        <div>
                            <h1 className="text-lg font-bold font-mono uppercase tracking-wider flex items-center gap-2 text-[oklch(18%_0.012_28)]">
                                <FlaskConical className="w-5 h-5 text-[oklch(52%_0.16_28)]" />
                                Recipe Lab (ห้องทดลองสูตร)
                            </h1>
                            <p className="text-xs text-[oklch(55%_0.010_28)] font-mono">จัดการสูตรกลาง (Base Recipe) และคิดต้นทุนก่อนขายจริง</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Search Input (Desktop) */}
                        <div className="relative hidden sm:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="ค้นหาสูตร..."
                                className="bg-white border border-gray-200 rounded-sm py-1.5 pl-9 pr-4 text-xs font-mono focus:outline-none focus:border-[oklch(52%_0.16_28)] w-48 lg:w-60 transition-all"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={() => setIsCreateOpen(true)}
                            className="bg-[oklch(18%_0.012_28)] text-white px-3.5 py-1.5 rounded-sm font-mono font-bold flex items-center gap-1.5 hover:bg-black text-xs uppercase tracking-wider shadow-sm whitespace-nowrap"
                        >
                            <Plus size={14} /> New Formula
                        </button>
                    </div>
                </div>
            </div>

            <div className={`${isEmbedded ? '' : 'max-w-7xl mx-auto p-4'} space-y-6 pb-20`}>
                {/* Search Input (Mobile) */}
                <div className="sm:hidden relative w-full mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="ค้นหาสูตร..."
                        className="w-full bg-white border border-gray-200 rounded-xl py-2.5 pl-9 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-200"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Mobile Folders Carousel */}
                <div className="md:hidden flex items-center gap-2 overflow-x-auto pb-2 border-b hide-scrollbar">
                    {allFolders.map(folder => {
                        const count = getFolderCount(folder);
                        const isActive = activeCategory === folder;
                        return (
                            <button
                                key={folder}
                                onClick={() => setActiveCategory(folder)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                                    isActive
                                        ? 'bg-purple-600 text-white shadow-md'
                                        : 'bg-white text-gray-600 border border-gray-100'
                                }`}
                            >
                                <span>
                                    {folder === 'all' ? 'ทั้งหมด' : folder === 'uncategorized' ? 'ทั่วไป' : folder}
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                    isActive ? 'bg-purple-700 text-white' : 'bg-gray-100 text-gray-500'
                                }`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                    <button
                        onClick={handleCreateFolder}
                        className="px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap bg-purple-50 text-purple-600 border border-purple-100 flex items-center gap-1"
                    >
                        <Plus size={12} /> โฟลเดอร์ใหม่
                    </button>
                </div>

                <div className="flex flex-col md:flex-row gap-6">
                    {/* Folders Navigation (Desktop Sidebar) */}
                    <div className="hidden md:block w-64 flex-shrink-0">
                        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-4">
                            <div className="flex justify-between items-center pb-2 border-b">
                                <span className="font-bold text-gray-800 flex items-center gap-2">
                                    <Folder size={18} className="text-purple-600" />
                                    โฟลเดอร์สูตร
                                </span>
                                <button
                                    onClick={handleCreateFolder}
                                    className="text-xs text-purple-600 hover:text-purple-700 font-bold flex items-center gap-1"
                                    title="สร้างโฟลเดอร์ใหม่"
                                >
                                    <FolderPlus size={16} />
                                    สร้าง
                                </button>
                            </div>
                            <div className="flex flex-col gap-1">
                                {allFolders.map(folder => {
                                    const count = getFolderCount(folder);
                                    const isActive = activeCategory === folder;
                                    return (
                                        <button
                                            key={folder}
                                            onClick={() => setActiveCategory(folder)}
                                            className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between transition-colors ${
                                                isActive
                                                    ? 'bg-purple-50 text-purple-750'
                                                    : 'text-gray-600 hover:bg-gray-50'
                                            }`}
                                        >
                                            <span className="flex items-center gap-2 truncate">
                                                {folder === 'all' ? (
                                                    <span>📦 ทั้งหมด</span>
                                                ) : folder === 'uncategorized' ? (
                                                    <span>📁 ยังไม่แยกหมวดหมู่</span>
                                                ) : (
                                                    <>
                                                        <span className="text-amber-500">📁</span>
                                                        <span className="truncate">{folder}</span>
                                                    </>
                                                )}
                                            </span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                isActive ? 'bg-purple-200 text-purple-800' : 'bg-gray-100 text-gray-550'
                                            }`}>
                                                {count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Recipes Grid */}
                    <div className="flex-1">
                        {loading ? (
                             <div className="text-center py-20 text-gray-400">Loading Lab...</div>
                        ) : filteredRecipes.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400 flex flex-col items-center justify-center p-6">
                                <FlaskConical className="w-12 h-12 mb-3 text-gray-300" />
                                <p className="font-medium text-gray-500">ไม่พบสูตรที่ตรงกับเงื่อนไข</p>
                                <p className="text-xs text-gray-400 mt-1">สามารถสร้างสูตรใหม่ หรือล้างตัวกรองเพื่อค้นหาอีกครั้ง</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-300">
                                {filteredRecipes.map(item => (
                                    <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative group flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                                                    <FlaskConical size={24} />
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] text-gray-400 uppercase font-bold">Estimated Cost/Unit</div>
                                                    <div className="text-2xl font-mono font-bold text-gray-800">฿{item.cost.toFixed(2)}</div>
                                                    
                                                    {/* Cost Breakdown */}
                                                    <div className="flex flex-col gap-1 mt-1 text-[10px]">
                                                        <div className="flex justify-between items-center text-gray-400 gap-2">
                                                            <span>Material:</span>
                                                            <span className="font-mono text-gray-600">฿{item.materialCost.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Recipe Name / Rename Inline Form */}
                                            {editingItemId === item.id ? (
                                                <div className="flex gap-1.5 w-full items-center mb-1">
                                                    <input
                                                        value={editingName}
                                                        onChange={e => setEditingName(e.target.value)}
                                                        className="flex-1 border border-purple-300 rounded-lg px-2.5 py-1 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-purple-200"
                                                        autoFocus
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleRename(item.id);
                                                            if (e.key === 'Escape') setEditingItemId(null);
                                                        }}
                                                    />
                                                    <button 
                                                        onClick={() => handleRename(item.id)}
                                                        className="p-1.5 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg"
                                                    >
                                                        <Check size={14} />
                                                    </button>
                                                    <button 
                                                        onClick={() => setEditingItemId(null)}
                                                        className="p-1.5 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 mb-1 group/title flex-wrap">
                                                    <h3 className="font-bold text-lg leading-tight text-gray-800">{item.name}</h3>
                                                    <button
                                                        onClick={() => {
                                                            setEditingItemId(item.id);
                                                            setEditingName(item.name);
                                                        }}
                                                        className="opacity-0 group-hover/title:opacity-100 p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-all"
                                                        title="แก้ไขชื่อสูตร"
                                                    >
                                                        <Pencil size={13} />
                                                    </button>
                                                </div>
                                            )}
                                            <p className="text-xs text-gray-400 mb-3">{item.ingredientCount} ingredients</p>
                                        </div>

                                        <div>
                                            {/* Folder Selection / Dropdown */}
                                            <div className="relative mt-1 mb-4">
                                                <button
                                                    onClick={() => setActiveDropdownId(activeDropdownId === item.id ? null : item.id)}
                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-150 text-xs text-gray-600 font-bold transition-all"
                                                >
                                                    <Folder size={12} className="text-purple-500" />
                                                    <span className="truncate max-w-[130px]">
                                                        {item.category && item.category.startsWith('folder:')
                                                            ? item.category.substring(7)
                                                            : 'ยังไม่แยกหมวดหมู่'
                                                        }
                                                    </span>
                                                    <ChevronDown size={12} className="text-gray-400" />
                                                </button>

                                                {activeDropdownId === item.id && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={() => setActiveDropdownId(null)}></div>
                                                        <div className="absolute left-0 mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1.5 text-xs animate-in fade-in slide-in-from-top-1">
                                                            <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                                                ย้ายไปที่โฟลเดอร์
                                                            </div>
                                                            <button
                                                                onClick={() => handleMoveFolder(item.id, 'restock')}
                                                                className="w-full text-left px-3 py-2 hover:bg-purple-50 hover:text-purple-750 transition-colors flex items-center gap-2 font-bold"
                                                            >
                                                                📁 ทั่วไป (Uncategorized)
                                                            </button>
                                                            {allFolders
                                                                .filter(f => f !== 'all' && f !== 'uncategorized' && (item.category && item.category.startsWith('folder:') ? item.category.substring(7) !== f : true))
                                                                .map(folder => (
                                                                    <button
                                                                        key={folder}
                                                                        onClick={() => handleMoveFolder(item.id, folder)}
                                                                        className="w-full text-left px-3 py-2 hover:bg-purple-50 hover:text-purple-750 transition-colors truncate flex items-center gap-2 font-bold"
                                                                    >
                                                                        📁 {folder}
                                                                    </button>
                                                                ))
                                                            }
                                                            <div className="border-t my-1.5"></div>
                                                            <button
                                                                onClick={async () => {
                                                                    const newFolder = prompt('ป้อนชื่อหมวดหมู่ / โฟลเดอร์ใหม่:');
                                                                    if (newFolder && newFolder.trim()) {
                                                                        const trimmed = newFolder.trim();
                                                                        if (!customFolders.includes(trimmed)) {
                                                                            setCustomFolders(prev => [...prev, trimmed]);
                                                                        }
                                                                        await handleMoveFolder(item.id, trimmed);
                                                                    }
                                                                }}
                                                                className="w-full text-left px-3 py-2 hover:bg-purple-50 text-purple-600 font-bold transition-colors flex items-center gap-2"
                                                            >
                                                                <Plus size={14} /> โฟลเดอร์ใหม่...
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

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
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
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

