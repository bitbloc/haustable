import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Search, Trash2, Edit2, Eye, EyeOff, Save, X, ChevronDown, GripVertical, Download, Settings, RefreshCw, Link } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import useBarSOP, { SOP_ACTIONS, getActionByKey } from '../../hooks/useBarSOP';
import SOPRecipeCard from '../sop/SOPRecipeCard';
import SOPCategoryManager from '../sop/SOPCategoryManager';
import { toast } from 'sonner';

// ── Step Editor Row ──
function StepRow({ step, index, onUpdate, onDelete, onMove, isLast, availableIngredients }) {
    return (
        <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl group border border-transparent hover:border-purple-100 transition-colors">
            <div className="flex flex-col gap-0.5 pt-2">
                <button onClick={() => onMove(index, -1)} disabled={index === 0} className="text-gray-300 hover:text-purple-600 text-[10px] leading-none disabled:opacity-20">▲</button>
                <button onClick={() => onMove(index, 1)} disabled={isLast} className="text-gray-300 hover:text-purple-600 text-[10px] leading-none disabled:opacity-20">▼</button>
            </div>
            <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">{index + 1}</div>
            <select
                value={step.action || 'pour'}
                onChange={e => onUpdate(index, { ...step, action: e.target.value })}
                className="w-24 p-2 border border-gray-200 rounded-lg text-sm bg-white flex-shrink-0 focus:border-purple-400 outline-none"
            >
                {SOP_ACTIONS.map(a => (
                    <option key={a.key} value={a.key}>{a.icon} {a.label}</option>
                ))}
            </select>
            <div className="flex-1 flex flex-col gap-1.5">
                <input value={step.title || ''} onChange={e => onUpdate(index, { ...step, title: e.target.value })} placeholder="ชื่อขั้นตอน (เช่น เตรียมน้ำมะพร้าว)" className="w-full p-2 border border-gray-200 rounded-lg text-sm font-bold focus:border-purple-400 outline-none" />
                <textarea value={step.instruction || ''} onChange={e => onUpdate(index, { ...step, instruction: e.target.value })} placeholder="รายละเอียดขั้นตอน (เช่น ร่อนผงลงในถ้วย)" className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:border-purple-400 outline-none resize-none" rows={2} />
                <input value={step.key_points || ''} onChange={e => onUpdate(index, { ...step, key_points: e.target.value })} placeholder="จุดสำคัญ (เช่น น้ำต้องเย็นจัด)" className="w-full p-2 border border-yellow-200 bg-yellow-50 rounded-lg text-sm focus:border-yellow-400 outline-none" />
                <input value={step.reason || ''} onChange={e => onUpdate(index, { ...step, reason: e.target.value })} placeholder="เหตุผล (เช่น ลดการจับตัวเป็นก้อน)" className="w-full p-2 border border-gray-200 bg-gray-50 rounded-lg text-xs italic focus:border-purple-400 outline-none" />
                <select
                    value={step.ingredient_ref || ''}
                    onChange={e => onUpdate(index, { ...step, ingredient_ref: e.target.value })}
                    className="w-full p-1 border border-gray-200 rounded-md text-[11px] text-gray-500 bg-white focus:border-purple-400 outline-none"
                >
                    <option value="">-- ไม่แทรกปริมาณวัตถุดิบลงในข้อความ --</option>
                    {(availableIngredients || []).map(name => (
                        <option key={name} value={name}>+ แนบปริมาณ: {name}</option>
                    ))}
                </select>
            </div>
            <input
                type="number"
                value={step.duration_sec || ''}
                onChange={e => onUpdate(index, { ...step, duration_sec: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="เวลา(วิ)"
                className="w-16 p-2 border border-gray-200 rounded-lg text-sm text-center flex-shrink-0 focus:border-purple-400 outline-none"
                title="เวลา (วินาที)"
            />
            <button onClick={() => onDelete(index)} className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                <Trash2 size={16} />
            </button>
        </div>
    );
}

// ── Ingredient Editor Row ──
function IngredientRow({ ing, index, onUpdate, onDelete }) {
    return (
        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg group flex-wrap">
            <input value={ing.name || ''} onChange={e => onUpdate(index, { ...ing, name: e.target.value })} placeholder="ชื่อวัตถุดิบ" className="w-1/3 p-2 border rounded-lg text-sm min-w-[120px]" />
            <input type="number" value={ing.qty || ''} onChange={e => onUpdate(index, { ...ing, qty: e.target.value ? parseFloat(e.target.value) : 0 })} className="w-16 p-2 border rounded-lg text-sm text-center" placeholder="จำนวน" />
            <input value={ing.unit || ''} onChange={e => onUpdate(index, { ...ing, unit: e.target.value })} className="w-16 p-2 border rounded-lg text-sm text-center" placeholder="หน่วย" />
            <input value={ing.remark || ''} onChange={e => onUpdate(index, { ...ing, remark: e.target.value })} className="flex-1 p-2 border rounded-lg text-xs min-w-[150px]" placeholder="หมายเหตุ (เช่น ร่อนก่อนใช้)" />
            <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer flex-shrink-0">
                <input type="checkbox" checked={ing.scalable !== false} onChange={e => onUpdate(index, { ...ing, scalable: e.target.checked })} className="rounded" />
                Scale
            </label>
            <button onClick={() => onDelete(index)} className="p-1.5 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
        </div>
    );
}

// ── Import from Recipe Lab Modal ──
function ImportModal({ onClose, onImport }) {
    const [items, setItems] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            const [{ data: menus }, { data: stocks }] = await Promise.all([
                supabase.from('menu_items').select('id, name, price').order('name'),
                supabase.from('stock_items').select('id, name').eq('is_base_recipe', true).order('name')
            ]);
            setItems([
                ...(menus || []).map(m => ({ ...m, type: 'menu' })),
                ...(stocks || []).map(s => ({ ...s, type: 'stock' }))
            ]);
            setLoading(false);
        };
        fetch();
    }, []);

    const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center gap-2"><Download size={20} className="text-purple-600" /> Import จาก Recipe Lab</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={18} /></button>
                </div>
                <div className="p-3 border-b">
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา..." className="w-full p-2 bg-gray-100 rounded-xl text-sm" autoFocus />
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {loading ? <div className="text-center py-10 text-gray-400">Loading...</div> :
                    filtered.length === 0 ? <div className="text-center py-10 text-gray-400">ไม่พบ</div> :
                    filtered.map(item => (
                        <button key={item.type + item.id} onClick={() => onImport(item.id, item.type)} className="w-full p-3 rounded-xl hover:bg-purple-50 text-left flex justify-between items-center">
                            <div>
                                <div className="font-bold text-sm flex items-center gap-2">
                                    {item.type === 'stock' && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] rounded">Base</span>}
                                    {item.name}
                                </div>
                                <div className="text-xs text-gray-400">{item.type === 'menu' ? 'Menu Item' : 'Stock Recipe'}</div>
                            </div>
                            <Download size={14} className="text-gray-300" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Main Editor Page ──
export default function SOPEditorPage() {
    const navigate = useNavigate();
    const { recipes, categories, glassSizes, loading, activeCategory, setActiveCategory, fetchRecipes, saveSOPRecipe, deleteSOPRecipe, saveCategory, deleteCategory, scaleIngredients, fetchRecipeLabSummary, refresh } = useBarSOP({ department: 'bar', staffMode: false });

    const [editing, setEditing] = useState(null); // null = list view, object = editing
    const [showImport, setShowImport] = useState(false);
    const [showCategoryManager, setShowCategoryManager] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('basic');

    // ── Create new empty recipe ──
    const handleNew = () => {
        setEditing({
            name: '', name_en: '', category_id: categories[0]?.id || '', department: 'bar',
            base_glass_size_oz: 16, ingredients: [], steps: [],
            scaling_rules: { "8": 0.5, "12": 0.75, "16": 1, "22": 1.375 },
            garnish: '', notes: '', is_published: false, sort_order: 0,
            advanced_details: { equipment: [], qc_standards: [], troubleshooting: [], shelf_life: [], checklist: [] }
        });
    };

    const isCustomMode = editing?.scaling_rules?._mode === 'custom';

    const toggleCustomMode = (toCustom) => {
        if (toCustom) {
            setEditing({
                ...editing,
                scaling_rules: {
                    _mode: 'custom',
                    presets: [{ name: '1 ถัง', multiplier: 1, isBase: true }]
                }
            });
        } else {
            setEditing({
                ...editing,
                scaling_rules: { "8": 0.5, "12": 0.75, "16": 1, "22": 1.375 },
                base_glass_size_oz: 16
            });
        }
    };

    // ── Save ──
    const handleSave = async () => {
        if (!editing.name.trim()) { toast.error('กรุณาใส่ชื่อ SOP'); return; }
        setSaving(true);
        const result = await saveSOPRecipe(editing);
        setSaving(false);
        if (result) {
            setEditing(null);
            fetchRecipes(activeCategory);
        }
    };

    // ── Link to Recipe Lab ──
    const handleLink = async (sourceId, sourceType) => {
        const linkedIngs = await fetchRecipeLabSummary(sourceId, sourceType);
        
        setEditing(prev => ({ 
            ...prev, 
            source_menu_item_id: sourceType === 'menu' ? sourceId : null,
            source_stock_item_id: sourceType === 'stock' ? sourceId : null,
            linked_preview: linkedIngs,
            // Automatically clear ingredients that were previously imported as static
            ingredients: prev.ingredients?.filter(i => !i.isLinked) || []
        }));
        
        setShowImport(false);
    };

    // Prepare linked preview on edit
    useEffect(() => {
        if (editing && editing.id && !editing.linked_preview) {
            setEditing(prev => ({
                ...prev,
                linked_preview: prev.display_ingredients?.filter(i => i.isLinked) || []
            }));
        }
    }, [editing?.id]);

    // ── Ingredient CRUD & Visibility ──
    const addIngredient = () => setEditing(prev => ({ ...prev, ingredients: [...(prev.ingredients || []), { name: '', qty: 0, unit: 'ml', scalable: true }] }));
    const updateIngredient = (i, val) => setEditing(prev => ({ ...prev, ingredients: prev.ingredients.map((ing, idx) => idx === i ? val : ing) }));
    // Delete only true manual ingredients, not linked overrides
    const deleteIngredient = (i) => setEditing(prev => ({ ...prev, ingredients: prev.ingredients.filter((ing, idx) => idx !== i) }));
    
    const toggleHideLinked = (ingName) => {
        setEditing(prev => {
            const existing = (prev.ingredients || []).find(i => i.name === ingName);
            let newManuals;
            if (existing) {
                newManuals = prev.ingredients.map(i => i.name === ingName ? { ...i, isHidden: !i.isHidden } : i);
            } else {
                newManuals = [...(prev.ingredients || []), { name: ingName, isHidden: true }];
            }
            
            const newPreview = (prev.linked_preview || []).map(i => i.name === ingName ? { ...i, isHidden: !i.isHidden } : i);
            return { ...prev, ingredients: newManuals, linked_preview: newPreview };
        });
    };

    // ── Step CRUD ──
    const addStep = () => setEditing(prev => ({ ...prev, steps: [...(prev.steps || []), { order: (prev.steps?.length || 0) + 1, action: 'pour', instruction: '', duration_sec: null }] }));
    const updateStep = (i, val) => setEditing(prev => ({ ...prev, steps: prev.steps.map((s, idx) => idx === i ? val : s) }));
    const deleteStep = (i) => setEditing(prev => ({ ...prev, steps: prev.steps.filter((_, idx) => idx !== i) }));
    const moveStep = (i, dir) => {
        setEditing(prev => {
            const arr = [...prev.steps];
            const j = i + dir;
            if (j < 0 || j >= arr.length) return prev;
            [arr[i], arr[j]] = [arr[j], arr[i]];
            return { ...prev, steps: arr };
        });
    };

    // ── LIST VIEW ──
    if (!editing) {
        return (
            <div className="min-h-screen bg-gray-50 font-sans">
                <div className="sticky top-0 z-30 bg-white border-b shadow-sm">
                    <div className="p-4 flex justify-between items-center max-w-5xl mx-auto">
                        <div className="flex items-center gap-3">
                            <button onClick={() => navigate('/admin')} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
                            <div>
                                <h1 className="text-xl font-bold">📋 SOP Editor</h1>
                                <p className="text-xs text-gray-500">จัดการสูตรเครื่องดื่มสำหรับพนักงาน</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setShowCategoryManager(true)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500" title="จัดการหมวดหมู่"><Settings size={20} /></button>
                            <button onClick={refresh} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><RefreshCw size={20} className={loading ? 'animate-spin' : ''} /></button>
                            <button onClick={handleNew} className="bg-purple-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-purple-700 shadow-lg text-sm"><Plus size={16} /> New SOP</button>
                        </div>
                    </div>
                    {/* Category Tabs */}
                    <div className="flex overflow-x-auto px-4 pb-0 gap-4 border-t border-gray-100 max-w-5xl mx-auto">
                        <button onClick={() => setActiveCategory(null)} className={`pb-3 pt-3 whitespace-nowrap font-bold text-sm border-b-[3px] ${!activeCategory ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-400'}`}>ทั้งหมด</button>
                        {categories.map(cat => (
                            <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`pb-3 pt-3 whitespace-nowrap font-bold text-sm border-b-[3px] ${activeCategory === cat.id ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                                {cat.icon} {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="max-w-5xl mx-auto p-4 space-y-3 pb-20">
                    {loading ? (
                        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />)}</div>
                    ) : recipes.length === 0 ? (
                        <div className="text-center py-20 text-gray-400">
                            <p className="text-lg font-bold mb-2">ยังไม่มี SOP</p>
                            <button onClick={handleNew} className="text-purple-600 font-bold hover:underline">+ สร้าง SOP แรก</button>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {recipes.map(recipe => (
                                <div key={recipe.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <span className="text-2xl">{recipe.category?.icon || '📋'}</span>
                                        <div className="min-w-0">
                                            <h3 className="font-bold truncate">{recipe.name}</h3>
                                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                                <span>{recipe.category?.label || 'Uncategorized'}</span>
                                                <span>•</span>
                                                <span>{recipe.base_glass_size_oz}oz</span>
                                                <span>•</span>
                                                <span>{(recipe.ingredients || []).length} ingredients</span>
                                                <span>•</span>
                                                <span>{(recipe.steps || []).length} steps</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${recipe.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {recipe.is_published ? 'Published' : 'Draft'}
                                        </span>
                                        <button onClick={() => setEditing({ ...recipe })} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"><Edit2 size={16} /></button>
                                        <button onClick={async () => { if (confirm('ลบ SOP นี้?')) { await deleteSOPRecipe(recipe.id); fetchRecipes(activeCategory); }}} className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {showCategoryManager && (
                    <SOPCategoryManager categories={categories} onSave={saveCategory} onDelete={deleteCategory} onClose={() => setShowCategoryManager(false)} />
                )}
            </div>
        );
    }

    // ── EDIT VIEW ──
    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            <div className="sticky top-0 z-30 bg-white border-b shadow-sm">
                <div className="p-4 flex justify-between items-center max-w-3xl mx-auto">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setEditing(null)} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft className="w-5 h-5" /></button>
                        <h1 className="text-lg font-bold">{editing.id ? 'แก้ไข SOP' : 'สร้าง SOP ใหม่'}</h1>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowPreview(!showPreview)} className={`p-2 rounded-full ${showPreview ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-100 text-gray-500'}`}>
                            {showPreview ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                        <button onClick={handleSave} disabled={saving} className="bg-purple-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-purple-700 disabled:opacity-50 text-sm">
                            <Save size={16} /> {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto p-4 space-y-6 pb-20">
                {/* Tab Navigation */}
                <div className="flex overflow-x-auto gap-2 p-2 bg-gray-100 rounded-xl mb-4 no-scrollbar">
                    {['basic', 'ingredients', 'steps', 'pro'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${activeTab === tab ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            {tab === 'basic' && '1. ข้อมูลพื้นฐาน'}
                            {tab === 'ingredients' && '2. ส่วนผสม & อุปกรณ์'}
                            {tab === 'steps' && '3. ขั้นตอนการทำ'}
                            {tab === 'pro' && '4. Pro Details'}
                        </button>
                    ))}
                </div>

                {/* Preview */}
                {showPreview && (
                    <div className="bg-[#0D0D0D] p-4 rounded-2xl">
                        <p className="text-[10px] text-[#555] uppercase tracking-wider mb-2 px-1">Staff Preview</p>
                        <SOPRecipeCard 
                            recipe={{ 
                                ...editing, 
                                category: categories.find(c => c.id === editing.category_id),
                                display_ingredients: [
                                    ...(editing.linked_preview || []),
                                    ...(editing.ingredients || []).filter(i => !i.isLinked && i.qty !== undefined)
                                ]
                            }} 
                            glassSizes={glassSizes} 
                            scaleIngredients={scaleIngredients} 
                            darkMode={true} 
                            defaultExpanded={true} 
                        />
                    </div>
                )}

                {/* BASIC TAB */}
                {activeTab === 'basic' && (
                    <div className="space-y-6">
                        {/* Basic Info */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                    <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider">ข้อมูลพื้นฐาน</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">ชื่อเมนู (TH)</label>
                            <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className="w-full p-3 border rounded-xl font-bold" placeholder="เช่น ลาเต้เย็น" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">ชื่อ EN (optional)</label>
                            <input value={editing.name_en || ''} onChange={e => setEditing({ ...editing, name_en: e.target.value })} className="w-full p-3 border rounded-xl" placeholder="e.g. Iced Latte" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">หมวดหมู่</label>
                            <select value={editing.category_id || ''} onChange={e => setEditing({ ...editing, category_id: e.target.value })} className="w-full p-3 border rounded-xl bg-white">
                                <option value="">-- เลือกหมวด --</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                            </select>
                        </div>
                        {!isCustomMode && (
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">ขนาดแก้วมาตรฐาน</label>
                                <select value={editing.base_glass_size_oz} onChange={e => setEditing({ ...editing, base_glass_size_oz: parseInt(e.target.value) })} className="w-full p-3 border rounded-xl bg-white">
                                    {glassSizes.map(gs => <option key={gs.id} value={gs.size_oz}>{gs.size_oz} oz ({gs.name})</option>)}
                                    <option value="16">16 oz (default)</option>
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">เวลาทำ (Prep Time)</label>
                            <input value={editing.advanced_details?.prep_time || ''} onChange={e => setEditing({ ...editing, advanced_details: { ...editing.advanced_details, prep_time: e.target.value }})} className="w-full p-3 border rounded-xl" placeholder="เช่น 3-4 นาที" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">ระดับน้ำแข็ง (Ice Level)</label>
                            <input value={editing.advanced_details?.ice_level || ''} onChange={e => setEditing({ ...editing, advanced_details: { ...editing.advanced_details, ice_level: e.target.value }})} className="w-full p-3 border rounded-xl" placeholder="เช่น เต็มแก้ว 90%" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-gray-500 block mb-1">ลักษณะเมนู (Profile)</label>
                            <input value={editing.advanced_details?.profile || ''} onChange={e => setEditing({ ...editing, advanced_details: { ...editing.advanced_details, profile: e.target.value }})} className="w-full p-3 border rounded-xl" placeholder="เช่น มัทฉะแยกชั้นบน น้ำมะพร้าวอยู่ด้านล่าง" />
                        </div>
                    </div>
                </div>

                {/* Scaling Rules / Custom Presets */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider">
                                {isCustomMode ? '🪣 ตัวเลือกขนาด (Presets)' : '🥤 ขนาดแก้วที่ขาย'}
                            </h2>
                            <p className="text-xs text-gray-400 mt-1">
                                {isCustomMode ? 'กำหนดปุ่มสำหรับให้พนักงานกดเลือกทำสูตร (เช่น 1 ลิตร, 1.5 ลิตร)' : 'เลือกว่าเมนูนี้สามารถขายในแก้วขนาดใดได้บ้าง'}
                            </p>
                        </div>
                        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                            <button onClick={() => toggleCustomMode(false)} className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${!isCustomMode ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-gray-700'}`}>แก้ว (oz)</button>
                            <button onClick={() => toggleCustomMode(true)} className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${isCustomMode ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-gray-700'}`}>ทำเบส (Custom)</button>
                        </div>
                    </div>
                    
                    {isCustomMode ? (
                        <div className="space-y-3">
                            {(editing.scaling_rules?.presets || []).map((preset, idx) => (
                                <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <input 
                                        value={preset.name} 
                                        onChange={e => {
                                            const newPresets = [...editing.scaling_rules.presets];
                                            newPresets[idx].name = e.target.value;
                                            setEditing({ ...editing, scaling_rules: { ...editing.scaling_rules, presets: newPresets } });
                                        }}
                                        placeholder="ชื่อปุ่ม (เช่น 1.5 ลิตร)"
                                        className="flex-1 p-2 border rounded-lg text-sm font-bold focus:border-purple-400 outline-none"
                                    />
                                    <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">ตัวคูณ (x)</span>
                                        <input 
                                            type="number" step="0.1"
                                            value={preset.multiplier}
                                            onChange={e => {
                                                const newPresets = [...editing.scaling_rules.presets];
                                                newPresets[idx].multiplier = parseFloat(e.target.value) || 1;
                                                setEditing({ ...editing, scaling_rules: { ...editing.scaling_rules, presets: newPresets } });
                                            }}
                                            className={`w-16 p-1 text-sm text-center font-mono font-bold outline-none ${preset.isBase ? 'text-gray-500 bg-transparent' : 'text-purple-600'}`}
                                            disabled={preset.isBase}
                                            title={preset.isBase ? "สูตรมาตรฐาน ตัวคูณต้องเป็น 1 เสมอ" : "ตัวคูณสำหรับ Preset นี้"}
                                        />
                                    </div>
                                    {!preset.isBase && (
                                        <button onClick={() => {
                                            const newPresets = editing.scaling_rules.presets.filter((_, i) => i !== idx);
                                            setEditing({ ...editing, scaling_rules: { ...editing.scaling_rules, presets: newPresets } });
                                        }} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button onClick={() => {
                                const newPresets = [...(editing.scaling_rules?.presets || []), { name: 'ขนาดใหม่', multiplier: 1.5 }];
                                setEditing({ ...editing, scaling_rules: { ...editing.scaling_rules, presets: newPresets } });
                            }} className="text-sm font-bold text-purple-600 hover:text-purple-800 transition-colors bg-purple-50 px-4 py-2 rounded-lg">+ เพิ่ม Preset</button>
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-3">
                            {glassSizes.map(gs => {
                                const isBase = gs.size_oz === editing.base_glass_size_oz;
                                const isAvailable = isBase || editing.scaling_rules?.[String(gs.size_oz)] !== undefined;
                                
                                return (
                                    <button
                                        key={gs.id}
                                        onClick={() => {
                                            if (isBase) return; // Cannot toggle base size
                                            const newRules = { ...editing.scaling_rules };
                                            if (isAvailable) {
                                                delete newRules[String(gs.size_oz)];
                                            } else {
                                                // Auto calculate multiplier: target / base
                                                newRules[String(gs.size_oz)] = gs.size_oz / editing.base_glass_size_oz;
                                            }
                                            setEditing({ ...editing, scaling_rules: newRules });
                                        }}
                                        className={`relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all w-24 h-24 ${
                                            isAvailable 
                                            ? 'border-purple-500 bg-purple-50' 
                                            : 'border-gray-200 bg-white hover:border-gray-300'
                                        } ${isBase ? 'opacity-80 cursor-default' : 'cursor-pointer'}`}
                                    >
                                        <div className={`w-6 h-6 rounded-md border flex items-center justify-center mb-2 ${
                                            isAvailable ? 'bg-purple-500 border-purple-500 text-white' : 'bg-white border-gray-300'
                                        }`}>
                                            {isAvailable && <span className="text-sm font-bold">✓</span>}
                                        </div>
                                        <span className={`font-bold text-lg ${isAvailable ? 'text-purple-700' : 'text-gray-500'}`}>{gs.size_oz}oz</span>
                                        {isBase && <span className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-white">แก้วมาตรฐาน</span>}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Garnish & Notes */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                    <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider">🎀 ตกแต่ง & หมายเหตุ</h2>
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">Garnish / ของตกแต่ง</label>
                        <input value={editing.garnish || ''} onChange={e => setEditing({ ...editing, garnish: e.target.value })} className="w-full p-3 border rounded-xl" placeholder="เช่น ผงมัทฉะโรยหน้า, ใบสะระแหน่" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">Notes / หมายเหตุพิเศษ</label>
                        <textarea value={editing.notes || ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} className="w-full p-3 border rounded-xl resize-none" rows={2} placeholder="เช่น ลูกค้าแพ้ถั่ว ให้ใช้นม oat แทน" />
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={editing.is_published} onChange={e => setEditing({ ...editing, is_published: e.target.checked })} className="w-5 h-5 rounded" />
                            <span className="font-bold text-sm">{editing.is_published ? '✅ เผยแพร่ (พนักงานเห็น)' : '⬜ Draft (ซ่อนจากพนักงาน)'}</span>
                        </label>
                    </div>
                </div>
                </div>
                )}

                {/* INGREDIENTS TAB */}
                {activeTab === 'ingredients' && (
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider">📦 ส่วนผสม</h2>
                        <button onClick={() => setShowImport(true)} className="text-xs text-purple-600 font-bold flex items-center gap-1 hover:underline"><Download size={14} /> เชื่อมโยงข้อมูล Recipe Lab</button>
                    </div>

                    {/* Linked Ingredients */}
                    {(editing.source_menu_item_id || editing.source_stock_item_id) && (
                        <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-3">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-purple-700 flex items-center gap-1">
                                    <Link size={12} /> ดึงข้อมูลอัตโนมัติจาก Recipe Lab
                                </span>
                                <button onClick={() => setEditing(prev => ({ ...prev, source_menu_item_id: null, source_stock_item_id: null, linked_preview: [] }))} className="text-[10px] text-red-500 hover:underline">ยกเลิกเชื่อมโยง</button>
                            </div>
                            <div className="space-y-1">
                                {(editing.linked_preview || []).map((ing, i) => (
                                    <div key={`linked-${i}`} className={`flex justify-between items-center text-sm py-1 border-b border-purple-100/50 last:border-0 ${ing.isHidden ? 'opacity-40' : ''}`}>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => toggleHideLinked(ing.name)} title={ing.isHidden ? "แสดงใน SOP" : "ซ่อนใน SOP (เช่น แก้ว)"} className="p-1 hover:bg-purple-100 rounded text-purple-400">
                                                {ing.isHidden ? <EyeOff size={14} className="text-red-400" /> : <Eye size={14} />}
                                            </button>
                                            <span className={ing.isHidden ? 'line-through text-gray-500' : 'text-gray-700'}>{ing.name}</span>
                                        </div>
                                        <span className="text-gray-500 font-mono">{ing.qty} {ing.unit}</span>
                                    </div>
                                ))}
                                {(!editing.linked_preview || editing.linked_preview.length === 0) && (
                                    <div className="text-xs text-gray-400 italic">ไม่มีส่วนผสม หรือกำลังโหลด...</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Manual Extra Ingredients */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 mb-2">ส่วนผสมเพิ่มเติม (Manual)</h3>
                        <div className="space-y-2 mb-2">
                            {(editing.ingredients || []).filter(i => !i.isLinked && i.qty !== undefined).map((ing, i) => (
                                <IngredientRow key={i} ing={ing} index={i} onUpdate={updateIngredient} onDelete={deleteIngredient} />
                            ))}
                        </div>
                        <button onClick={addIngredient} className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-purple-300 hover:text-purple-600 transition-colors font-bold">+ เพิ่มวัตถุดิบอื่น (เช่น Garnish พิเศษ)</button>
                    </div>
                    
                    <div className="border-t pt-4 mt-4">
                        <h3 className="text-xs font-bold text-gray-500 mb-2">อุปกรณ์ที่ใช้ (Equipment)</h3>
                        <textarea
                            value={Array.isArray(editing.advanced_details?.equipment) 
                                ? editing.advanced_details.equipment.join(', ') 
                                : (editing.advanced_details?.equipment || '')}
                            onChange={e => {
                                // Save as an array separated by commas or newlines
                                const val = e.target.value;
                                const arr = val.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
                                setEditing({ 
                                    ...editing, 
                                    advanced_details: { 
                                        ...editing.advanced_details, 
                                        equipment: arr 
                                    } 
                                });
                            }}
                            className="w-full p-3 border rounded-xl text-sm resize-none"
                            rows={3}
                            placeholder="พิมพ์ชื่ออุปกรณ์ที่ใช้แล้วคั่นด้วยเครื่องหมายลูกน้ำ หรือ Enter (เช่น ช้อนตวง, ถ้วยตีมัทฉะ)"
                        />
                    </div>
                </div>
                )}

                {/* STEPS TAB */}
                {activeTab === 'steps' && (
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                    <div className="flex justify-between items-center">
                        <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider">📋 ขั้นตอน ({(editing.steps || []).length})</h2>
                        <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-1 rounded">พนักงานดูปริมาณวัตถุดิบได้จากตารางด้านบน</span>
                    </div>
                    <div className="space-y-2">
                        {(editing.steps || []).map((step, i) => (
                            <StepRow 
                                key={i} step={step} index={i} 
                                onUpdate={updateStep} onDelete={deleteStep} onMove={moveStep} 
                                isLast={i === editing.steps.length - 1} 
                                availableIngredients={[
                                    ...(editing.linked_preview || []).map(ing => ing.name),
                                    ...(editing.ingredients || []).filter(ing => !ing.isLinked && ing.qty !== undefined).map(ing => ing.name)
                                ]}
                            />
                        ))}
                    </div>
                    <button onClick={addStep} className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-600 transition-colors font-bold">+ เพิ่มขั้นตอน</button>
                </div>
                )}

                {/* PRO DETAILS TAB */}
                {activeTab === 'pro' && (
                <div className="space-y-6">
                    {/* QC Standards */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                        <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider">🎯 มาตรฐานรสชาติ (QC)</h2>
                        <div className="space-y-2">
                            {(editing.advanced_details?.qc_standards || []).map((qc, i) => (
                                <div key={i} className="flex gap-2">
                                    <input value={qc.topic} onChange={e => {
                                        const newQc = [...editing.advanced_details.qc_standards];
                                        newQc[i].topic = e.target.value;
                                        setEditing({ ...editing, advanced_details: { ...editing.advanced_details, qc_standards: newQc } });
                                    }} className="w-1/3 p-2 border rounded-lg text-sm" placeholder="หัวข้อ (เช่น สีมัทฉะ)" />
                                    <input value={qc.standard} onChange={e => {
                                        const newQc = [...editing.advanced_details.qc_standards];
                                        newQc[i].standard = e.target.value;
                                        setEditing({ ...editing, advanced_details: { ...editing.advanced_details, qc_standards: newQc } });
                                    }} className="flex-1 p-2 border rounded-lg text-sm" placeholder="มาตรฐาน (เช่น เขียวสด ไม่คล้ำ)" />
                                    <button onClick={() => {
                                        const newQc = [...editing.advanced_details.qc_standards];
                                        newQc.splice(i, 1);
                                        setEditing({ ...editing, advanced_details: { ...editing.advanced_details, qc_standards: newQc } });
                                    }} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                                </div>
                            ))}
                            <button onClick={() => {
                                const newQc = [...(editing.advanced_details?.qc_standards || []), { topic: '', standard: '' }];
                                setEditing({ ...editing, advanced_details: { ...editing.advanced_details, qc_standards: newQc } });
                            }} className="text-sm font-bold text-purple-600 hover:text-purple-800">+ เพิ่มมาตรฐาน QC</button>
                        </div>
                    </div>

                    {/* Troubleshooting */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                        <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider">🔧 การแก้ปัญหา (Troubleshooting)</h2>
                        <div className="space-y-3">
                            {(editing.advanced_details?.troubleshooting || []).map((tb, i) => (
                                <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-200 relative">
                                    <button onClick={() => {
                                        const newTb = [...editing.advanced_details.troubleshooting];
                                        newTb.splice(i, 1);
                                        setEditing({ ...editing, advanced_details: { ...editing.advanced_details, troubleshooting: newTb } });
                                    }} className="absolute top-2 right-2 text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                                    <div className="space-y-2 pr-6">
                                        <input value={tb.problem} onChange={e => {
                                            const newTb = [...editing.advanced_details.troubleshooting];
                                            newTb[i].problem = e.target.value;
                                            setEditing({ ...editing, advanced_details: { ...editing.advanced_details, troubleshooting: newTb } });
                                        }} className="w-full p-2 border rounded-lg text-sm font-bold text-red-600" placeholder="ปัญหา (เช่น มัทฉะขม)" />
                                        <input value={tb.cause} onChange={e => {
                                            const newTb = [...editing.advanced_details.troubleshooting];
                                            newTb[i].cause = e.target.value;
                                            setEditing({ ...editing, advanced_details: { ...editing.advanced_details, troubleshooting: newTb } });
                                        }} className="w-full p-2 border rounded-lg text-sm" placeholder="สาเหตุ (เช่น น้ำร้อนเกินไป)" />
                                        <input value={tb.solution} onChange={e => {
                                            const newTb = [...editing.advanced_details.troubleshooting];
                                            newTb[i].solution = e.target.value;
                                            setEditing({ ...editing, advanced_details: { ...editing.advanced_details, troubleshooting: newTb } });
                                        }} className="w-full p-2 border border-green-200 bg-green-50 rounded-lg text-sm" placeholder="วิธีแก้ (เช่น ใช้น้ำ 70 องศา)" />
                                    </div>
                                </div>
                            ))}
                            <button onClick={() => {
                                const newTb = [...(editing.advanced_details?.troubleshooting || []), { problem: '', cause: '', solution: '' }];
                                setEditing({ ...editing, advanced_details: { ...editing.advanced_details, troubleshooting: newTb } });
                            }} className="text-sm font-bold text-purple-600 hover:text-purple-800">+ เพิ่มปัญหาและวิธีแก้</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Shelf Life */}
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                            <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider">⏳ Shelf Life / การเก็บรักษา</h2>
                            <div className="space-y-2">
                                {(editing.advanced_details?.shelf_life || []).map((sl, i) => (
                                    <div key={i} className="flex gap-2">
                                        <input value={sl.item} onChange={e => {
                                            const newSl = [...editing.advanced_details.shelf_life];
                                            newSl[i].item = e.target.value;
                                            setEditing({ ...editing, advanced_details: { ...editing.advanced_details, shelf_life: newSl } });
                                        }} className="flex-1 p-2 border rounded-lg text-sm" placeholder="รายการ (เช่น น้ำมะพร้าว base)" />
                                        <input value={sl.age} onChange={e => {
                                            const newSl = [...editing.advanced_details.shelf_life];
                                            newSl[i].age = e.target.value;
                                            setEditing({ ...editing, advanced_details: { ...editing.advanced_details, shelf_life: newSl } });
                                        }} className="w-24 p-2 border rounded-lg text-sm" placeholder="อายุ (เช่น 1 วัน)" />
                                        <button onClick={() => {
                                            const newSl = [...editing.advanced_details.shelf_life];
                                            newSl.splice(i, 1);
                                            setEditing({ ...editing, advanced_details: { ...editing.advanced_details, shelf_life: newSl } });
                                        }} className="p-2 text-gray-400 hover:text-red-500"><X size={16} /></button>
                                    </div>
                                ))}
                                <button onClick={() => {
                                    const newSl = [...(editing.advanced_details?.shelf_life || []), { item: '', age: '' }];
                                    setEditing({ ...editing, advanced_details: { ...editing.advanced_details, shelf_life: newSl } });
                                }} className="text-sm font-bold text-purple-600 hover:text-purple-800">+ เพิ่ม Shelf Life</button>
                            </div>
                        </div>

                        {/* Checklist */}
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                            <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider">✅ Checklist ก่อนเสิร์ฟ</h2>
                            <div className="space-y-2">
                                {(editing.advanced_details?.checklist || []).map((cl, i) => (
                                    <div key={i} className="flex gap-2 items-center">
                                        <span className="text-gray-300">☑</span>
                                        <input value={cl} onChange={e => {
                                            const newCl = [...editing.advanced_details.checklist];
                                            newCl[i] = e.target.value;
                                            setEditing({ ...editing, advanced_details: { ...editing.advanced_details, checklist: newCl } });
                                        }} className="flex-1 p-2 border rounded-lg text-sm" placeholder="เช่น แก้วสะอาด" />
                                        <button onClick={() => {
                                            const newCl = [...editing.advanced_details.checklist];
                                            newCl.splice(i, 1);
                                            setEditing({ ...editing, advanced_details: { ...editing.advanced_details, checklist: newCl } });
                                        }} className="p-2 text-gray-400 hover:text-red-500"><X size={16} /></button>
                                    </div>
                                ))}
                                <button onClick={() => {
                                    const newCl = [...(editing.advanced_details?.checklist || []), ''];
                                    setEditing({ ...editing, advanced_details: { ...editing.advanced_details, checklist: newCl } });
                                }} className="text-sm font-bold text-purple-600 hover:text-purple-800">+ เพิ่ม Checklist</button>
                            </div>
                        </div>
                    </div>
                </div>
                )}
            </div>

            {/* Import Modal */}
            {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={handleLink} />}
        </div>
    );
}
