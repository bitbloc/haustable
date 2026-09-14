/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { calculateRecipeCost } from '../../utils/costUtils';
import { 
    ArrowLeft, RefreshCw, Plus, Search, Trash2, Check, X, 
    Pencil, ChevronDown, ChevronRight, Layers, AlertCircle, Link as LinkIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import RecipeBuilder from '../recipes/RecipeBuilder';
import { toast } from 'sonner';

const FOLDER_STORAGE_KEY = 'recipe_lab_custom_folders_v1';

// ── In-App Modal: Create New Formula (Dieter Rams Clean Modal) ──
function CreateFormulaModal({ onClose, onCreate, initialFolder, folders = [] }) {
    const [name, setName] = useState('');
    const [selectedFolder, setSelectedFolder] = useState(
        initialFolder && initialFolder !== 'all' && initialFolder !== 'uncategorized' 
            ? initialFolder 
            : 'uncategorized'
    );
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('กรุณาระบุชื่อสูตร');
            return;
        }
        onCreate(name.trim(), selectedFolder);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 font-sans backdrop-blur-xs">
            <div className="bg-[oklch(98%_0.004_28)] border border-[oklch(85%_0.012_28)] w-full max-w-md p-6 shadow-2xl space-y-4 rounded-xs">
                <div className="flex justify-between items-start border-b border-[oklch(85%_0.012_28)] pb-3">
                    <div>
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] block">
                            FORMULA CREATION
                        </span>
                        <h3 className="text-base font-bold font-mono uppercase text-[oklch(18%_0.012_28)]">
                            สร้างสูตรกลางใหม่ (New Base Formula)
                        </h3>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-1 text-[oklch(55%_0.010_28)] hover:text-black hover:bg-[oklch(90%_0.012_28)] transition-colors cursor-pointer"
                    >
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-[11px] font-mono font-bold text-[oklch(42%_0.010_28)] uppercase block mb-1">
                            ชื่อสูตรกลาง (FORMULA NAME) *
                        </label>
                        <input
                            ref={inputRef}
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="เช่น ซอสคาราเมลโฮมเมด V1, หัวเชื้อชาไทยเข้มข้น"
                            className="w-full p-2.5 border border-[oklch(85%_0.012_28)] bg-white font-sans text-sm font-bold text-[oklch(18%_0.012_28)] outline-none focus:border-black transition-colors"
                        />
                    </div>

                    <div>
                        <label className="text-[11px] font-mono font-bold text-[oklch(42%_0.010_28)] uppercase block mb-1">
                            โฟลเดอร์จัดเก็บ (FOLDER / CATEGORY)
                        </label>
                        <select
                            value={selectedFolder}
                            onChange={e => setSelectedFolder(e.target.value)}
                            className="w-full p-2.5 border border-[oklch(85%_0.012_28)] bg-white font-mono text-xs font-bold text-[oklch(18%_0.012_28)] outline-none focus:border-black cursor-pointer"
                        >
                            <option value="uncategorized">ทั่วไป (Uncategorized)</option>
                            {folders.filter(f => f !== 'all' && f !== 'uncategorized').map(f => (
                                <option key={f} value={f}>[FOLDER: {f}]</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-[oklch(85%_0.012_28)] font-mono text-xs">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] font-bold uppercase hover:bg-[oklch(90%_0.012_28)] transition-colors cursor-pointer"
                        >
                            ยกเลิก (Cancel)
                        </button>
                        <button
                            type="submit"
                            disabled={!name.trim()}
                            className="flex-1 py-2.5 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold uppercase hover:bg-black disabled:opacity-40 transition-colors cursor-pointer"
                        >
                            สร้างและเปิดตัวปรุงสูตร →
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── In-App Modal: Dependency-Aware Delete Confirmation ──
function DeleteFormulaModal({ isOpen, onClose, onConfirm, item }) {
    if (!isOpen || !item) return null;

    const hasUsages = (item.usedInCount || 0) > 0;

    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 font-sans backdrop-blur-xs">
            <div className="bg-[oklch(98%_0.004_28)] border border-[oklch(85%_0.012_28)] w-full max-w-md p-6 shadow-2xl space-y-4 rounded-xs">
                <div className="flex items-start gap-3 border-b border-[oklch(85%_0.012_28)] pb-3">
                    <div className="w-8 h-8 bg-red-100 text-red-700 flex items-center justify-center font-mono font-bold text-xs flex-shrink-0">
                        !
                    </div>
                    <div className="flex-1 min-w-0">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-red-700 block">
                            DELETE CONFIRMATION
                        </span>
                        <h3 className="text-base font-bold font-mono uppercase text-[oklch(18%_0.012_28)] truncate">
                            ยืนยันการลบสูตรกลาง
                        </h3>
                    </div>
                </div>

                <div className="space-y-3 text-xs leading-relaxed text-[oklch(42%_0.010_28)]">
                    <p>
                        คุณกำลังจะลบสูตรกลาง <strong className="text-[oklch(18%_0.012_28)] font-bold font-sans">"{item.name}"</strong> (ต้นทุน ฿{item.cost?.toFixed(2)})
                    </p>

                    {hasUsages ? (
                        <div className="p-3 bg-red-50/80 border border-red-200 text-red-800 space-y-2 font-mono text-[11px]">
                            <div className="flex items-center gap-1.5 font-bold uppercase text-red-900">
                                <AlertCircle size={14} />
                                <span>คำเตือน: สูตรนี้กำลังถูกใช้งานอยู่ ({item.usedInCount} เมนู)</span>
                            </div>
                            <p className="text-[10px] text-red-700">
                                เมนูต่อไปนี้พึ่งพาสูตรกลางนี้เป็นวัตถุดิบ หากลบจะส่งผลกระทบต่อการคิดต้นทุนและสต็อก:
                            </p>
                            <ul className="list-disc list-inside space-y-0.5 text-[10px] pl-1 max-h-24 overflow-y-auto">
                                {(item.usedInNames || []).map((menuName, idx) => (
                                    <li key={idx} className="font-sans font-bold">{menuName}</li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <p className="font-mono text-[11px] text-[oklch(55%_0.010_28)]">
                            สูตรนี้เป็นสูตรเดี่ยว (Standalone) ยังไม่ได้ถูกเชื่อมโยงกับเมนูขายหน้าร้าน สามารถลบได้อย่างปลอดภัย
                        </p>
                    )}

                    <p className="text-[11px] text-[oklch(55%_0.010_28)] italic">
                        การลบสูตรจะไม่สามารถกู้คืนได้ คุณแน่ใจหรือไม่ว่าต้องการดำเนินการต่อ?
                    </p>
                </div>

                <div className="flex gap-2 pt-2 border-t border-[oklch(85%_0.012_28)] font-mono text-xs">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-2.5 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] font-bold uppercase hover:bg-[oklch(90%_0.012_28)] transition-colors cursor-pointer"
                    >
                        ยกเลิก (Cancel)
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            onConfirm(item.id);
                            onClose();
                        }}
                        className="flex-1 py-2.5 bg-red-700 text-white font-bold uppercase hover:bg-red-800 transition-colors cursor-pointer"
                    >
                        ยืนยันลบสูตร (Delete)
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Inline Folder Creator ──
function InlineFolderInput({ onSave, onCancel }) {
    const [name, setName] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (name.trim()) onSave(name.trim());
        } else if (e.key === 'Escape') {
            onCancel();
        }
    };

    return (
        <div className="p-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] space-y-2 rounded-xs animate-in fade-in duration-150">
            <input
                ref={inputRef}
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="ชื่อโฟลเดอร์..."
                className="w-full p-1.5 border border-[oklch(85%_0.012_28)] bg-white text-xs font-mono font-bold outline-none focus:border-black"
            />
            <div className="flex gap-1.5 font-mono text-[10px]">
                <button
                    type="button"
                    onClick={() => { if (name.trim()) onSave(name.trim()); }}
                    disabled={!name.trim()}
                    className="flex-1 py-1 bg-[oklch(18%_0.012_28)] text-white font-bold uppercase hover:bg-black disabled:opacity-40 cursor-pointer text-center"
                >
                    [สร้าง]
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-2 py-1 border border-[oklch(85%_0.012_28)] bg-white text-[oklch(42%_0.010_28)] hover:bg-gray-100 cursor-pointer"
                >
                    [✕]
                </button>
            </div>
        </div>
    );
}

// ── Main RecipeLabPage Component ──
export default function RecipeLabPage({ isEmbedded = false }) {
    const navigate = useNavigate();
    const [labItems, setLabItems] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Recipe Builder State
    const [isRecipeOpen, setIsRecipeOpen] = useState(false);
    const [recipeTarget, setRecipeTarget] = useState(null);

    // Modals State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [deletingItem, setDeletingItem] = useState(null);

    // Search and Folder State
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');
    const [activeDropdownId, setActiveDropdownId] = useState(null);
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);

    // Custom Folders initialized from localStorage
    const [customFolders, setCustomFolders] = useState(() => {
        try {
            const saved = localStorage.getItem(FOLDER_STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    // Rename State
    const [editingItemId, setEditingItemId] = useState(null);
    const [editingName, setEditingName] = useState('');

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Base Recipes (stock_items where is_base_recipe is true)
            const { data: stockItems, error } = await supabase
                .from('stock_items')
                .select('*')
                .eq('is_base_recipe', true)
                .order('name');
            
            if (error) throw error;

            if (!stockItems || stockItems.length === 0) {
                setLabItems([]);
                return;
            }

            const stockIds = stockItems.map(i => i.id);

            // 2. Fetch Ingredients for Cost Calculation
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
                .in('parent_stock_item_id', stockIds);

            // 3. Fetch Usages (Where this base recipe is used by menu items or other recipes)
            const { data: usages } = await supabase
                .from('recipe_ingredients')
                .select('ingredient_id, parent_menu_item_id, parent_stock_item_id')
                .in('ingredient_id', stockIds);

            // Resolve parent names
            const parentMenuIds = [...new Set((usages || []).map(u => u.parent_menu_item_id).filter(Boolean))];
            const parentStockIds = [...new Set((usages || []).map(u => u.parent_stock_item_id).filter(Boolean))];

            let menuMap = {};
            if (parentMenuIds.length > 0) {
                const { data: menus } = await supabase.from('menu_items').select('id, name').in('id', parentMenuIds);
                (menus || []).forEach(m => { menuMap[m.id] = m.name; });
            }

            let stockMap = {};
            if (parentStockIds.length > 0) {
                const { data: stocks } = await supabase.from('stock_items').select('id, name').in('id', parentStockIds);
                (stocks || []).forEach(s => { stockMap[s.id] = s.name; });
            }

            // Map and enrich each recipe item
            const enriched = stockItems.map(item => {
                const ingredients = recipeLinks?.filter(l => l.parent_stock_item_id === item.id) || [];
                
                const { totalCost } = calculateRecipeCost(
                    ingredients, 
                    (id) => ingredients.find(i => i.ingredient_id === id)?.ingredient, 
                    { qFactorPercent: item.q_factor_percent || 0 }
                );

                // Calculate dependent menus
                const itemUsages = (usages || []).filter(u => u.ingredient_id === item.id);
                const usedInNames = itemUsages.map(u => {
                    if (u.parent_menu_item_id) return menuMap[u.parent_menu_item_id];
                    if (u.parent_stock_item_id) return stockMap[u.parent_stock_item_id];
                    return null;
                }).filter(Boolean);
                const uniqueUsedInNames = [...new Set(usedInNames)];

                return {
                    ...item,
                    materialCost: totalCost,
                    cost: totalCost,
                    ingredientCount: ingredients.length,
                    usedInCount: uniqueUsedInNames.length,
                    usedInNames: uniqueUsedInNames
                };
            });

            setLabItems(enriched);
        } catch (err) {
            console.error('Failed to load lab recipes:', err);
            toast.error('โหลดข้อมูลสูตรกลางไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Unique folders from database + custom folders
    const allFolders = useMemo(() => {
        const dbFolders = Array.from(new Set(
            labItems.map(item => {
                const cat = item.category;
                if (cat && cat.startsWith('folder:')) {
                    return cat.substring(7);
                }
                return 'uncategorized';
            })
        ));

        const combined = [
            'all',
            ...dbFolders.filter(c => c !== 'uncategorized'),
            ...customFolders.filter(c => !dbFolders.includes(c)),
            'uncategorized'
        ];

        return Array.from(new Set(combined));
    }, [labItems, customFolders]);

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

    const handleCreateFolder = (folderName) => {
        const trimmed = folderName.trim();
        if (!trimmed) return;
        if (['all', 'uncategorized', 'restock'].includes(trimmed.toLowerCase())) {
            toast.error('ไม่สามารถใช้ชื่อโฟลเดอร์นี้ได้');
            return;
        }
        setCustomFolders(prev => {
            if (prev.includes(trimmed)) return prev;
            const next = [...prev, trimmed];
            try {
                localStorage.setItem(FOLDER_STORAGE_KEY, JSON.stringify(next));
            } catch { /* ignore storage error */ }
            return next;
        });
        setActiveCategory(trimmed);
        setIsCreatingFolder(false);
        toast.success(`สร้างโฟลเดอร์ "[${trimmed}]" แล้ว`);
    };

    const handleCreateFormula = async (name, targetCategory) => {
        try {
            const initialCategory = (targetCategory && targetCategory !== 'all' && targetCategory !== 'uncategorized') 
                ? `folder:${targetCategory}` 
                : 'restock';
            
            const { data, error } = await supabase.from('stock_items').insert({
                name,
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
            
            toast.success(`สร้างสูตร "${name}" สำเร็จ`);
            setIsCreateOpen(false);
            await loadData();
            
            // Auto open recipe builder
            setRecipeTarget(data);
            setIsRecipeOpen(true);
        } catch (err) {
            console.error(err);
            toast.error('สร้างสูตรไม่สำเร็จ: ' + err.message);
        }
    };

    const handleDelete = async (id) => {
        try {
            const { error } = await supabase.from('stock_items').delete().eq('id', id);
            if (error) throw error;
            toast.success('ลบสูตรกลางเรียบร้อย');
            loadData();
        } catch (err) {
            console.error(err);
            toast.error('ลบสูตรไม่สำเร็จ: ' + err.message);
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
            toast.error('เปลี่ยนชื่อสูตรไม่สำเร็จ');
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
            toast.success(`ย้ายสูตรไปที่ "${targetCategory === 'restock' || targetCategory === 'uncategorized' ? 'ทั่วไป' : targetCategory}" แล้ว`);
            setActiveDropdownId(null);
            loadData();
        } catch (err) {
            console.error(err);
            toast.error('ย้ายโฟลเดอร์ไม่สำเร็จ');
        }
    };

    // Filter recipes based on folder & search query
    const filteredRecipes = useMemo(() => {
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
                return (item.name || '').toLowerCase().includes(query);
            }

            return true;
        });
    }, [labItems, activeCategory, searchQuery]);

    return (
        <div className={`font-sans text-[oklch(18%_0.012_28)] ${isEmbedded ? '' : 'min-h-screen bg-[oklch(97%_0.008_28)]'}`}>
            {/* Header Actions Bar (Dieter Rams Cellular Layout) */}
            <div className={`${isEmbedded ? 'mb-4 pb-3 border-b border-[oklch(85%_0.012_28)]' : 'sticky top-0 z-30 bg-[oklch(97%_0.008_28)] border-b border-[oklch(85%_0.012_28)] px-4 py-3 shadow-xs'}`}>
                <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${isEmbedded ? '' : 'max-w-7xl mx-auto'}`}>
                    <div className="flex items-center gap-3 min-w-0">
                        {!isEmbedded && (
                            <button 
                                onClick={() => navigate('/admin')} 
                                className="p-2 border border-[oklch(85%_0.012_28)] bg-white text-[oklch(42%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] transition-colors cursor-pointer"
                                title="กลับสู่แผงควบคุม"
                            >
                                <ArrowLeft size={16} />
                            </button>
                        )}
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)]">
                                    RECIPE LAB · BASE FORMULAS
                                </span>
                            </div>
                            <h1 className="text-xl font-bold font-mono uppercase tracking-tight text-[oklch(18%_0.012_28)] mt-0.5">
                                Recipe Lab (ห้องทดลองสูตรกลาง)
                            </h1>
                            <p className="text-xs text-[oklch(55%_0.010_28)] font-mono">
                                จัดการสูตรเบส (Base Recipe) ทบทวนส่วนผสม และคำนวณต้นทุนต่อหน่วยอย่างแม่นยำ
                            </p>
                        </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto font-mono text-xs">
                        {/* Search Input */}
                        <div className="relative flex-1 sm:flex-none">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[oklch(55%_0.010_28)]" />
                            <input
                                type="text"
                                placeholder="ค้นหาสูตรกลาง..."
                                className="w-full sm:w-48 lg:w-56 bg-white border border-[oklch(85%_0.012_28)] py-1.5 pl-8 pr-3 text-xs font-mono font-bold text-[oklch(18%_0.012_28)] focus:outline-none focus:border-black transition-colors"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[oklch(55%_0.010_28)] hover:text-black"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>

                        <button 
                            onClick={loadData} 
                            className="p-2 border border-[oklch(85%_0.012_28)] bg-white text-[oklch(42%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] transition-colors cursor-pointer"
                            title="รีเฟรชข้อมูล"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>

                        <button 
                            onClick={() => setIsCreateOpen(true)}
                            className="bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-3.5 py-2 font-bold uppercase flex items-center gap-1.5 hover:bg-black transition-colors shadow-xs cursor-pointer"
                        >
                            <Plus size={14} />
                            <span>NEW FORMULA</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Workbench Body */}
            <div className={`${isEmbedded ? '' : 'max-w-7xl mx-auto p-4'} space-y-4 pb-20`}>
                {/* Mobile Folder Strip (Horizontal Monospace Scroll) */}
                <div className="md:hidden flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[oklch(85%_0.012_28)] font-mono text-xs">
                    {allFolders.map(folder => {
                        const count = getFolderCount(folder);
                        const isActive = activeCategory === folder;
                        const label = folder === 'all' ? 'ทั้งหมด (ALL)' : folder === 'uncategorized' ? 'ทั่วไป' : folder;
                        return (
                            <button
                                key={folder}
                                onClick={() => setActiveCategory(folder)}
                                className={`px-3 py-1.5 border font-bold uppercase whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer ${
                                    isActive
                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-black'
                                        : 'bg-white border-[oklch(85%_0.012_28)] text-[oklch(42%_0.010_28)] hover:border-black'
                                }`}
                            >
                                <span>{label}</span>
                                <span className={`text-[10px] px-1 py-0.2 ${isActive ? 'bg-[oklch(35%_0.015_28)]' : 'bg-[oklch(92%_0.010_28)] text-[oklch(18%_0.012_28)]'}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                    <button
                        onClick={() => setIsCreatingFolder(true)}
                        className="px-2.5 py-1.5 border border-dashed border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] font-bold uppercase whitespace-nowrap hover:border-black cursor-pointer"
                    >
                        + FOLDER
                    </button>
                </div>

                <div className="flex flex-col md:flex-row gap-5 items-start">
                    {/* Desktop Folders Sidebar (Cellular Division) */}
                    <aside className="hidden md:block w-60 flex-shrink-0 space-y-3 font-mono text-xs">
                        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(98%_0.004_28)] divide-y divide-[oklch(85%_0.012_28)] rounded-xs">
                            {/* Sidebar Header */}
                            <div className="p-3 bg-[oklch(94%_0.010_28)] flex justify-between items-center">
                                <span className="font-bold text-[11px] uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                                    สูตรแยกตามโฟลเดอร์
                                </span>
                                {!isCreatingFolder && (
                                    <button
                                        onClick={() => setIsCreatingFolder(true)}
                                        className="text-[10px] text-[oklch(52%_0.16_28)] hover:text-black font-bold uppercase cursor-pointer"
                                        title="สร้างโฟลเดอร์ใหม่"
                                    >
                                        [+ ใหม่]
                                    </button>
                                )}
                            </div>

                            {/* Inline Folder Creator */}
                            {isCreatingFolder && (
                                <div className="p-2">
                                    <InlineFolderInput 
                                        onSave={handleCreateFolder} 
                                        onCancel={() => setIsCreatingFolder(false)} 
                                    />
                                </div>
                            )}

                            {/* Folders List */}
                            <div className="divide-y divide-[oklch(90%_0.008_28)]">
                                {allFolders.map(folder => {
                                    const count = getFolderCount(folder);
                                    const isActive = activeCategory === folder;
                                    const label = folder === 'all' 
                                        ? 'สูตรทั้งหมด (ALL)' 
                                        : folder === 'uncategorized' 
                                            ? 'ทั่วไป (Uncategorized)' 
                                            : folder;
                                    return (
                                        <button
                                            key={folder}
                                            onClick={() => setActiveCategory(folder)}
                                            className={`w-full text-left p-2.5 font-bold flex items-center justify-between transition-colors cursor-pointer ${
                                                isActive
                                                    ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]'
                                                    : 'bg-white text-[oklch(42%_0.010_28)] hover:bg-[oklch(94%_0.010_28)] hover:text-black'
                                            }`}
                                        >
                                            <span className="truncate pr-2 uppercase">
                                                {folder !== 'all' && folder !== 'uncategorized' && <span className="text-[oklch(52%_0.16_28)] mr-1.5">#</span>}
                                                {label}
                                            </span>
                                            <span className={`text-[10px] px-1.5 py-0.5 font-mono ${
                                                isActive 
                                                    ? 'bg-[oklch(35%_0.015_28)] text-white' 
                                                    : 'bg-[oklch(92%_0.010_28)] text-[oklch(18%_0.012_28)]'
                                            }`}>
                                                {count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Quick Stats Box */}
                        <div className="p-3 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] space-y-1.5 text-[11px] text-[oklch(42%_0.010_28)]">
                            <div className="flex justify-between">
                                <span>สูตรกลางทั้งหมด:</span>
                                <span className="font-bold text-[oklch(18%_0.012_28)]">{labItems.length} สูตร</span>
                            </div>
                            <div className="flex justify-between">
                                <span>เชื่อมโยงในเมนู:</span>
                                <span className="font-bold text-[oklch(18%_0.012_28)]">
                                    {labItems.filter(i => (i.usedInCount || 0) > 0).length} สูตร
                                </span>
                            </div>
                        </div>
                    </aside>

                    {/* Formulas Workbench Grid */}
                    <main className="flex-1 w-full min-w-0">
                        {loading ? (
                            <div className="text-center py-20 border border-[oklch(85%_0.012_28)] bg-white font-mono text-xs text-[oklch(55%_0.010_28)] space-y-2">
                                <RefreshCw size={20} className="animate-spin mx-auto text-[oklch(42%_0.010_28)]" />
                                <div>กำลังโหลดข้อมูล Recipe Lab...</div>
                            </div>
                        ) : filteredRecipes.length === 0 ? (
                            <div className="text-center py-16 border border-dashed border-[oklch(85%_0.012_28)] bg-white p-6 font-mono text-xs space-y-3">
                                <div className="text-[oklch(55%_0.010_28)] font-bold uppercase tracking-wider">
                                    [NO FORMULAS FOUND]
                                </div>
                                <p className="text-[oklch(42%_0.010_28)]">
                                    ไม่พบสูตรที่ตรงกับเงื่อนไขในหมวดหมู่นี้
                                </p>
                                <button
                                    onClick={() => setIsCreateOpen(true)}
                                    className="px-4 py-2 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold uppercase hover:bg-black cursor-pointer"
                                >
                                    + สร้างสูตรกลางใหม่
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                {filteredRecipes.map(item => {
                                    const folderName = item.category && item.category.startsWith('folder:')
                                        ? item.category.substring(7)
                                        : 'uncategorized';
                                    const hasUsages = (item.usedInCount || 0) > 0;

                                    return (
                                        <div 
                                            key={item.id} 
                                            className={`border border-[oklch(85%_0.012_28)] bg-white flex flex-col justify-between rounded-xs transition-all duration-150 hover:border-black ${
                                                activeDropdownId === item.id ? 'relative z-30 shadow-md' : 'relative z-0'
                                            }`}
                                        >
                                            {/* Cell 1: Metadata Header */}
                                            <div className="p-3.5 border-b border-[oklch(85%_0.012_28)] bg-[oklch(98%_0.004_28)] space-y-2.5 rounded-t-xs">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 bg-[oklch(92%_0.015_28)] text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)]">
                                                        [BASE FORMULA]
                                                    </span>

                                                    {/* Usages Badge */}
                                                    {hasUsages ? (
                                                        <span 
                                                            className="font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1"
                                                            title={`ใช้งานใน: ${item.usedInNames.join(', ')}`}
                                                        >
                                                            <LinkIcon size={10} />
                                                            <span>USED IN: {item.usedInCount}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="font-mono text-[9px] text-[oklch(55%_0.010_28)]">
                                                            [STANDALONE]
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Formula Name & Inline Rename */}
                                                <div>
                                                    {editingItemId === item.id ? (
                                                        <div className="flex gap-1 items-center">
                                                            <input
                                                                value={editingName}
                                                                onChange={e => setEditingName(e.target.value)}
                                                                className="flex-1 border border-black p-1 text-xs font-bold font-sans bg-white outline-none"
                                                                autoFocus
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') handleRename(item.id);
                                                                    if (e.key === 'Escape') setEditingItemId(null);
                                                                }}
                                                            />
                                                            <button 
                                                                onClick={() => handleRename(item.id)}
                                                                className="p-1 bg-[oklch(18%_0.012_28)] text-white text-xs font-mono font-bold"
                                                                title="บันทึก"
                                                            >
                                                                <Check size={13} />
                                                            </button>
                                                            <button 
                                                                onClick={() => setEditingItemId(null)}
                                                                className="p-1 border border-[oklch(85%_0.012_28)] text-xs font-mono"
                                                                title="ยกเลิก"
                                                            >
                                                                <X size={13} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-start justify-between gap-2 group/title">
                                                            <h3 className="font-bold text-sm leading-snug font-sans text-[oklch(18%_0.012_28)] truncate">
                                                                {item.name}
                                                            </h3>
                                                            <button
                                                                onClick={() => {
                                                                    setEditingItemId(item.id);
                                                                    setEditingName(item.name);
                                                                }}
                                                                className="opacity-0 group-hover/title:opacity-100 p-0.5 text-[oklch(55%_0.010_28)] hover:text-black transition-opacity cursor-pointer flex-shrink-0"
                                                                title="แก้ไขชื่อสูตร"
                                                            >
                                                                <Pencil size={12} />
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div className="text-[11px] font-mono text-[oklch(55%_0.010_28)] mt-0.5">
                                                        {item.ingredientCount} วัตถุดิบในสูตร
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Cell 2: Cost Calculation Metric */}
                                            <div className="p-3.5 space-y-2">
                                                <div className="border border-[oklch(90%_0.008_28)] bg-[oklch(98%_0.004_28)] p-2.5 flex justify-between items-center">
                                                    <div>
                                                        <span className="font-mono text-[9px] font-bold uppercase text-[oklch(55%_0.010_28)] block">
                                                            COST PER BATCH / UNIT
                                                        </span>
                                                        <span className="text-[10px] font-mono text-[oklch(42%_0.010_28)]">
                                                            ต้นทุนวัตถุดิบรวม
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="font-mono font-bold text-lg text-[oklch(18%_0.012_28)]">
                                                            ฿{item.cost?.toFixed(2)}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Folder Mover Dropdown Button */}
                                                <div className="relative">
                                                    <button
                                                        onClick={() => setActiveDropdownId(activeDropdownId === item.id ? null : item.id)}
                                                        className="w-full flex items-center justify-between p-1.5 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] text-[10px] font-mono font-bold text-[oklch(42%_0.010_28)] transition-colors cursor-pointer"
                                                    >
                                                        <span className="truncate">
                                                            โฟลเดอร์: [{folderName === 'uncategorized' ? 'ทั่วไป' : folderName}]
                                                        </span>
                                                        <ChevronDown size={11} />
                                                    </button>

                                                    {activeDropdownId === item.id && (
                                                        <>
                                                            <div 
                                                                className="fixed inset-0 z-40" 
                                                                onClick={() => setActiveDropdownId(null)}
                                                            />
                                                            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[oklch(85%_0.012_28)] shadow-2xl z-50 py-1 font-mono text-xs max-h-56 overflow-y-auto animate-in fade-in duration-100 divide-y divide-[oklch(90%_0.008_28)] rounded-xs">
                                                                <div className="px-2.5 py-1 text-[9px] font-bold uppercase text-[oklch(55%_0.010_28)] bg-[oklch(94%_0.010_28)]">
                                                                    ย้ายไปที่โฟลเดอร์
                                                                </div>
                                                                <button
                                                                    onClick={() => {
                                                                        handleMoveFolder(item.id, 'uncategorized');
                                                                        setActiveDropdownId(null);
                                                                    }}
                                                                    className="w-full text-left px-2.5 py-1.5 hover:bg-[oklch(94%_0.010_28)] transition-colors font-bold text-[11px]"
                                                                >
                                                                    [ทั่วไป / Uncategorized]
                                                                </button>
                                                                {allFolders
                                                                    .filter(f => f !== 'all' && f !== 'uncategorized' && folderName !== f)
                                                                    .map(folder => (
                                                                        <button
                                                                            key={folder}
                                                                            onClick={() => {
                                                                                handleMoveFolder(item.id, folder);
                                                                                setActiveDropdownId(null);
                                                                            }}
                                                                            className="w-full text-left px-2.5 py-1.5 hover:bg-[oklch(94%_0.010_28)] transition-colors font-bold text-[11px] truncate"
                                                                        >
                                                                            [{folder}]
                                                                        </button>
                                                                    ))
                                                                }
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Cell 3: Action Buttons */}
                                            <div className="p-3 border-t border-[oklch(85%_0.012_28)] bg-[oklch(98%_0.004_28)] flex gap-1.5 font-mono text-xs rounded-b-xs">
                                                <button 
                                                    onClick={() => { setRecipeTarget(item); setIsRecipeOpen(true); }}
                                                    className="flex-1 py-2 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold uppercase hover:bg-black transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                                >
                                                    <Layers size={13} />
                                                    <span>EDIT RECIPE (ปรุงสูตร)</span>
                                                </button>
                                                <button 
                                                    onClick={() => setDeletingItem(item)}
                                                    className="px-2.5 py-2 border border-[oklch(85%_0.012_28)] bg-white text-[oklch(55%_0.010_28)] hover:text-red-700 hover:border-red-400 transition-colors cursor-pointer"
                                                    title="ลบสูตรกลาง"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </main>
                </div>
            </div>

            {/* In-App Create Formula Modal */}
            {isCreateOpen && (
                <CreateFormulaModal 
                    onClose={() => setIsCreateOpen(false)}
                    onCreate={handleCreateFormula}
                    initialFolder={activeCategory}
                    folders={allFolders}
                />
            )}

            {/* In-App Delete Confirmation Modal with Dependency Warning */}
            <DeleteFormulaModal 
                isOpen={!!deletingItem}
                onClose={() => setDeletingItem(null)}
                onConfirm={handleDelete}
                item={deletingItem}
            />

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
