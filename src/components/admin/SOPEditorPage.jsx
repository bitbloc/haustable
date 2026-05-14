import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Search, Trash2, Edit2, Eye, EyeOff, Save, X, ChevronDown, GripVertical, Download, Settings, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import useBarSOP, { SOP_ACTIONS, getActionByKey } from '../../hooks/useBarSOP';
import SOPRecipeCard from '../sop/SOPRecipeCard';
import SOPCategoryManager from '../sop/SOPCategoryManager';
import { toast } from 'sonner';

// ── Step Editor Row ──
function StepRow({ step, index, onUpdate, onDelete, onMove, isLast }) {
    return (
        <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl group">
            <div className="flex flex-col gap-0.5 pt-2">
                <button onClick={() => onMove(index, -1)} disabled={index === 0} className="text-gray-300 hover:text-gray-600 text-[10px] leading-none disabled:opacity-20">▲</button>
                <button onClick={() => onMove(index, 1)} disabled={isLast} className="text-gray-300 hover:text-gray-600 text-[10px] leading-none disabled:opacity-20">▼</button>
            </div>
            <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">{index + 1}</div>
            <select
                value={step.action || 'pour'}
                onChange={e => onUpdate(index, { ...step, action: e.target.value })}
                className="w-28 p-2 border rounded-lg text-sm bg-white flex-shrink-0"
            >
                {SOP_ACTIONS.map(a => (
                    <option key={a.key} value={a.key}>{a.icon} {a.label}</option>
                ))}
            </select>
            <input
                value={step.instruction || ''}
                onChange={e => onUpdate(index, { ...step, instruction: e.target.value })}
                placeholder="คำอธิบายขั้นตอน..."
                className="flex-1 p-2 border rounded-lg text-sm"
            />
            <input
                type="number"
                value={step.duration_sec || ''}
                onChange={e => onUpdate(index, { ...step, duration_sec: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="วิ"
                className="w-14 p-2 border rounded-lg text-sm text-center"
                title="เวลา (วินาที)"
            />
            <button onClick={() => onDelete(index)} className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                <Trash2 size={14} />
            </button>
        </div>
    );
}

// ── Ingredient Editor Row ──
function IngredientRow({ ing, index, onUpdate, onDelete }) {
    return (
        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg group">
            <input value={ing.name || ''} onChange={e => onUpdate(index, { ...ing, name: e.target.value })} placeholder="ชื่อวัตถุดิบ" className="flex-1 p-2 border rounded-lg text-sm" />
            <input type="number" value={ing.qty || ''} onChange={e => onUpdate(index, { ...ing, qty: e.target.value ? parseFloat(e.target.value) : 0 })} className="w-20 p-2 border rounded-lg text-sm text-center" placeholder="จำนวน" />
            <input value={ing.unit || ''} onChange={e => onUpdate(index, { ...ing, unit: e.target.value })} className="w-16 p-2 border rounded-lg text-sm text-center" placeholder="หน่วย" />
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
    const { recipes, categories, glassSizes, loading, activeCategory, setActiveCategory, fetchRecipes, saveSOPRecipe, deleteSOPRecipe, saveCategory, deleteCategory, scaleIngredients, importFromRecipeLab, refresh } = useBarSOP({ department: 'bar', staffMode: false });

    const [editing, setEditing] = useState(null); // null = list view, object = editing
    const [showImport, setShowImport] = useState(false);
    const [showCategoryManager, setShowCategoryManager] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [saving, setSaving] = useState(false);

    // ── Create new empty recipe ──
    const handleNew = () => {
        setEditing({
            name: '', name_en: '', category_id: categories[0]?.id || '', department: 'bar',
            base_glass_size_oz: 16, ingredients: [], steps: [],
            scaling_rules: { "8": 0.5, "12": 0.75, "16": 1, "22": 1.375 },
            garnish: '', notes: '', is_published: false, sort_order: 0
        });
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

    // ── Import from Recipe Lab ──
    const handleImport = async (sourceId, sourceType) => {
        const ingredients = await importFromRecipeLab(sourceId, sourceType);
        if (ingredients.length > 0) {
            setEditing(prev => ({ ...prev, ingredients: [...(prev.ingredients || []), ...ingredients] }));
        }
        setShowImport(false);
    };

    // ── Ingredient CRUD ──
    const addIngredient = () => setEditing(prev => ({ ...prev, ingredients: [...(prev.ingredients || []), { name: '', qty: 0, unit: 'ml', scalable: true }] }));
    const updateIngredient = (i, val) => setEditing(prev => ({ ...prev, ingredients: prev.ingredients.map((ing, idx) => idx === i ? val : ing) }));
    const deleteIngredient = (i) => setEditing(prev => ({ ...prev, ingredients: prev.ingredients.filter((_, idx) => idx !== i) }));

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
                {/* Preview */}
                {showPreview && (
                    <div className="bg-[#0D0D0D] p-4 rounded-2xl">
                        <p className="text-[10px] text-[#555] uppercase tracking-wider mb-2 px-1">Staff Preview</p>
                        <SOPRecipeCard recipe={{ ...editing, category: categories.find(c => c.id === editing.category_id) }} glassSizes={glassSizes} scaleIngredients={scaleIngredients} darkMode={true} defaultExpanded={true} />
                    </div>
                )}

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
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">ขนาดแก้วมาตรฐาน</label>
                            <select value={editing.base_glass_size_oz} onChange={e => setEditing({ ...editing, base_glass_size_oz: parseInt(e.target.value) })} className="w-full p-3 border rounded-xl bg-white">
                                {glassSizes.map(gs => <option key={gs.id} value={gs.size_oz}>{gs.label}</option>)}
                                <option value="16">16 oz (default)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Ingredients */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                    <div className="flex justify-between items-center">
                        <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider">📦 ส่วนผสม ({(editing.ingredients || []).length})</h2>
                        <button onClick={() => setShowImport(true)} className="text-xs text-purple-600 font-bold flex items-center gap-1 hover:underline"><Download size={14} /> Import</button>
                    </div>
                    <div className="space-y-2">
                        {(editing.ingredients || []).map((ing, i) => (
                            <IngredientRow key={i} ing={ing} index={i} onUpdate={updateIngredient} onDelete={deleteIngredient} />
                        ))}
                    </div>
                    <button onClick={addIngredient} className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-purple-300 hover:text-purple-600 transition-colors font-bold">+ เพิ่มวัตถุดิบ</button>
                </div>

                {/* Steps */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                    <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider">📋 ขั้นตอน ({(editing.steps || []).length})</h2>
                    <div className="space-y-2">
                        {(editing.steps || []).map((step, i) => (
                            <StepRow key={i} step={step} index={i} onUpdate={updateStep} onDelete={deleteStep} onMove={moveStep} isLast={i === editing.steps.length - 1} />
                        ))}
                    </div>
                    <button onClick={addStep} className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-purple-300 hover:text-purple-600 transition-colors font-bold">+ เพิ่มขั้นตอน</button>
                </div>

                {/* Scaling Rules */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                    <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider">📐 Scaling Rules</h2>
                    <p className="text-xs text-gray-400">ตัวคูณสำหรับปรับปริมาณส่วนผสมตามขนาดแก้ว (ขนาดมาตรฐาน = 1.0x)</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {glassSizes.map(gs => (
                            <div key={gs.id} className="flex items-center gap-2">
                                <label className="text-sm font-bold text-gray-600 w-12">{gs.size_oz}oz</label>
                                <input
                                    type="number" step="0.05"
                                    value={editing.scaling_rules?.[String(gs.size_oz)] ?? ''}
                                    onChange={e => setEditing({ ...editing, scaling_rules: { ...editing.scaling_rules, [String(gs.size_oz)]: parseFloat(e.target.value) || 0 }})}
                                    className={`flex-1 p-2 border rounded-lg text-sm text-center font-mono ${gs.size_oz === editing.base_glass_size_oz ? 'bg-purple-50 border-purple-200 font-bold' : ''}`}
                                    placeholder="1.0"
                                />
                                <span className="text-xs text-gray-400">x</span>
                            </div>
                        ))}
                    </div>
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

            {/* Import Modal */}
            {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={handleImport} />}
        </div>
    );
}
