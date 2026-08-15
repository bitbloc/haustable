import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Search, Trash2, Edit2, Eye, EyeOff, Save, X, Settings, RefreshCw, Link, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import useBarSOP, { SOP_ACTIONS } from '../../hooks/useBarSOP';
import SOPRecipeCard from '../sop/SOPRecipeCard';
import SOPCategoryManager from '../sop/SOPCategoryManager';
import { toast } from 'sonner';
import { THAI_UNITS } from '../../utils/unitUtils';

// ── Step Editor Row (Dieter Rams style, Collapsible Accordion) ──
function StepRow({ step, index, onUpdate, onDelete, onMove, isLast, availableIngredients, isExpanded, onToggleExpand }) {
    return (
        <div className="border border-gray-200 rounded bg-white overflow-hidden transition-all duration-200">
            {/* Header (Collapsed View) */}
            <div 
                onClick={onToggleExpand}
                className="p-3 bg-gray-50 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors select-none"
            >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="w-6 h-6 rounded bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-mono font-bold flex-shrink-0">
                        {index + 1}
                    </span>
                    <span className="text-sm font-bold text-gray-800 truncate">
                        {step.title || <span className="text-gray-400 italic">ขั้นตอนยังไม่มีชื่อ</span>}
                    </span>
                    {step.duration_sec && (
                        <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                            ⏱ {step.duration_sec}s
                        </span>
                    )}
                    {step.action && (
                        <span className="text-xs text-gray-500 font-mono">
                            [{step.action}]
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button 
                        onClick={() => onMove(index, -1)} 
                        disabled={index === 0} 
                        className="p-1 text-gray-400 hover:text-black disabled:opacity-20 cursor-pointer text-xs"
                        title="ย้ายขึ้น"
                    >
                        ▲
                    </button>
                    <button 
                        onClick={() => onMove(index, 1)} 
                        disabled={isLast} 
                        className="p-1 text-gray-400 hover:text-black disabled:opacity-20 cursor-pointer text-xs"
                        title="ย้ายลง"
                    >
                        ▼
                    </button>
                    <button 
                        onClick={() => onDelete(index)} 
                        className="p-1 text-gray-400 hover:text-red-600 cursor-pointer"
                        title="ลบขั้นตอน"
                    >
                        <Trash2 size={15} />
                    </button>
                    <span className="text-xs text-gray-400 ml-1 font-mono">
                        {isExpanded ? 'ย่อ ▲' : 'แก้ไข ▼'}
                    </span>
                </div>
            </div>

            {/* Expanded Fields */}
            {isExpanded && (
                <div className="p-4 border-t border-gray-200 bg-white space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="sm:col-span-1">
                            <label className="text-xs font-mono font-bold text-gray-500 uppercase block mb-1">ประเภทการทำ</label>
                            <select
                                value={step.action || 'pour'}
                                onChange={e => onUpdate(index, { ...step, action: e.target.value })}
                                className="w-full p-2 border border-gray-300 rounded text-sm bg-white focus:border-black focus:ring-0 outline-none"
                            >
                                {SOP_ACTIONS.map(a => (
                                    <option key={a.key} value={a.key}>{a.icon} {a.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="sm:col-span-3">
                            <label className="text-xs font-mono font-bold text-gray-500 uppercase block mb-1">ชื่อขั้นตอน</label>
                            <input 
                                value={step.title || ''} 
                                onChange={e => onUpdate(index, { ...step, title: e.target.value })} 
                                placeholder="ชื่อขั้นตอน (เช่น สกัดช็อตกาแฟ)" 
                                className="w-full p-2 border border-gray-300 rounded text-sm font-semibold focus:border-black focus:ring-0 outline-none" 
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-mono font-bold text-gray-500 uppercase block mb-1">รายละเอียดขั้นตอน</label>
                        <textarea 
                            value={step.instruction || ''} 
                            onChange={e => onUpdate(index, { ...step, instruction: e.target.value })} 
                            placeholder="รายละเอียดขั้นตอนอย่างย่อ" 
                            className="w-full p-2 border border-gray-300 rounded text-sm focus:border-black focus:ring-0 outline-none resize-none" 
                            rows={3} 
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-mono font-bold text-amber-600 uppercase block mb-1">จุดสำคัญ (Key Point)</label>
                            <input 
                                value={step.key_points || ''} 
                                onChange={e => onUpdate(index, { ...step, key_points: e.target.value })} 
                                placeholder="จุดสำคัญ (เช่น น้ำต้องเย็นจัด)" 
                                className="w-full p-2 border border-amber-300 bg-amber-50/20 rounded text-sm focus:border-amber-600 focus:ring-0 outline-none" 
                            />
                        </div>
                        <div>
                            <label className="text-xs font-mono font-bold text-gray-500 uppercase block mb-1">เหตุผล (Reason)</label>
                            <input 
                                value={step.reason || ''} 
                                onChange={e => onUpdate(index, { ...step, reason: e.target.value })} 
                                placeholder="เหตุผล (เช่น ลดการแยกชั้น)" 
                                className="w-full p-2 border border-gray-300 bg-gray-50 rounded text-sm focus:border-black focus:ring-0 outline-none" 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="sm:col-span-1">
                            <label className="text-xs font-mono font-bold text-gray-500 uppercase block mb-1">เวลาดำเนินการ (วินาที)</label>
                            <input
                                type="number"
                                value={step.duration_sec || ''}
                                onChange={e => onUpdate(index, { ...step, duration_sec: e.target.value ? parseInt(e.target.value) : null })}
                                placeholder="เช่น 30"
                                className="w-full p-2 border border-gray-300 rounded text-sm focus:border-black focus:ring-0 outline-none font-mono"
                            />
                        </div>
                        <div className="sm:col-span-3">
                            <label className="text-xs font-mono font-bold text-gray-500 block mb-1">แนบปริมาณวัตถุดิบ (อ้างอิงสูตร)</label>
                            {(() => {
                                const refs = step.ingredient_refs || (step.ingredient_ref ? [step.ingredient_ref] : []);
                                const available = (availableIngredients || []).filter(name => !refs.includes(name));
                                return (
                                    <div className="space-y-2 mt-1">
                                        {refs.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {refs.map((ref, idx) => (
                                                    <span key={idx} className="inline-flex items-center gap-1 bg-gray-100 border border-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs font-medium">
                                                        {ref}
                                                        <button 
                                                            type="button"
                                                            onClick={() => {
                                                                const newRefs = refs.filter((_, i) => i !== idx);
                                                                onUpdate(index, { 
                                                                    ...step, 
                                                                    ingredient_refs: newRefs, 
                                                                    ingredient_ref: newRefs.length > 0 ? newRefs[0] : null 
                                                                });
                                                            }} 
                                                            className="text-gray-400 hover:text-red-600 p-0.5 font-bold"
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {available.length > 0 && (
                                            <select
                                                value=""
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    if (val && !refs.includes(val)) {
                                                        const newRefs = [...refs, val];
                                                        onUpdate(index, { 
                                                            ...step, 
                                                            ingredient_refs: newRefs, 
                                                            ingredient_ref: newRefs[0] 
                                                        });
                                                    }
                                                }}
                                                className="w-full p-2 border border-gray-300 rounded text-xs text-gray-600 bg-white focus:border-black focus:ring-0 outline-none cursor-pointer"
                                            >
                                                <option value="">+ แนบวัตถุดิบ...</option>
                                                {available.map(name => (
                                                    <option key={name} value={name}>{name}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Ingredient Row (Unified row for both linked & manual ingredients) ──
function IngredientRow({ ing, index, onUpdate, onDelete }) {
    const isStandard = THAI_UNITS.some(u => u.value.toLowerCase() === (ing.unit || '').trim().toLowerCase());
    const showWarning = ing.unit && !isStandard;

    return (
        <div className="p-4 bg-white rounded border border-gray-200 space-y-3">
            {/* Top row: Name, Qty, Unit */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 flex gap-2 items-center min-w-0">
                    {ing.isLinked && (
                        <span className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] rounded font-mono font-bold flex-shrink-0" title="ดึงข้อมูลจากคลังสินค้า">
                            LINKED
                        </span>
                    )}
                    <input 
                        value={ing.name || ''} 
                        onChange={e => onUpdate(index, { ...ing, name: e.target.value })} 
                        placeholder="ชื่อวัตถุดิบ" 
                        className="w-full p-2 border border-gray-300 rounded text-sm font-semibold focus:border-black focus:ring-0 outline-none" 
                    />
                </div>
                
                <div className="flex gap-2 flex-shrink-0">
                    <div className="w-20">
                        <input 
                            type="number" 
                            value={ing.qty || ''} 
                            onChange={e => onUpdate(index, { ...ing, qty: e.target.value ? parseFloat(e.target.value) : 0 })} 
                            className="w-full p-2 border border-gray-300 rounded text-sm text-center focus:border-black focus:ring-0 outline-none font-mono" 
                            placeholder="จำนวน" 
                        />
                    </div>
                    
                    <div className="w-20 flex items-center relative">
                        <input 
                            value={ing.unit || ''} 
                            onChange={e => onUpdate(index, { ...ing, unit: e.target.value })} 
                            list="sop-units"
                            className={`w-full p-2 border rounded text-sm text-center focus:border-black focus:ring-0 outline-none ${showWarning ? 'border-amber-400 bg-amber-50 focus:border-amber-600' : 'border-gray-300'}`} 
                            placeholder="หน่วย" 
                        />
                        {showWarning && (
                            <span className="text-amber-600 cursor-help text-xs ml-1 absolute -right-6 z-10" title="หน่วยวัดนี้ไม่ได้เป็นมาตรฐานในการคำนวณต้นทุนคลังสินค้า">⚠️</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom row: Remark, Checkboxes, Delete */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-gray-100 pt-3">
                <div className="flex-1">
                    <input 
                        value={ing.remark || ''} 
                        onChange={e => onUpdate(index, { ...ing, remark: e.target.value })} 
                        className="w-full p-2 border border-gray-200 rounded text-xs focus:border-black focus:ring-0 outline-none" 
                        placeholder="หมายเหตุ (เช่น กรองเอาแต่น้ำ)" 
                    />
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 flex-wrap sm:flex-nowrap">
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                            <input type="checkbox" checked={ing.scalable !== false} onChange={e => onUpdate(index, { ...ing, scalable: e.target.checked })} className="rounded text-black border-gray-300 focus:ring-0 w-4 h-4" />
                            <span>Scale แก้ว</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-amber-700 font-bold cursor-pointer select-none">
                            <input type="checkbox" checked={ing.is_sweetener === true} onChange={e => onUpdate(index, { ...ing, is_sweetener: e.target.checked })} className="rounded text-amber-500 border-gray-300 focus:ring-0 w-4 h-4" />
                            <span>🍬 สารหวาน</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                            <input type="checkbox" checked={ing.isHidden === true} onChange={e => onUpdate(index, { ...ing, isHidden: e.target.checked })} className="rounded text-red-500 border-gray-300 focus:ring-0 w-4 h-4" />
                            <span>👁 ซ่อน</span>
                        </label>
                    </div>

                    <button 
                        type="button"
                        onClick={() => onDelete(index)} 
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded transition-colors"
                        title="ลบวัตถุดิบ"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
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
            <div className="bg-white rounded w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[70vh] border border-gray-300">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-mono font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                        🔗 Import จาก Recipe Lab
                    </h3>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-200 rounded"><X size={16} /></button>
                </div>
                <div className="p-3 border-b">
                    <input 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                        placeholder="ค้นหาเมนูหรือเบส..." 
                        className="w-full p-2 border border-gray-300 rounded text-sm outline-none focus:border-black font-mono" 
                        autoFocus 
                    />
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                    {loading ? <div className="text-center py-8 font-mono text-xs text-gray-400">Loading...</div> :
                    filtered.length === 0 ? <div className="text-center py-8 font-mono text-xs text-gray-400">ไม่พบข้อมูล</div> :
                    filtered.map(item => (
                        <button 
                            key={item.type + item.id} 
                            onClick={() => onImport(item.id, item.type)} 
                            className="w-full p-3 rounded hover:bg-gray-100 text-left flex justify-between items-center border border-transparent hover:border-gray-200"
                        >
                            <div>
                                <div className="font-bold text-sm flex items-center gap-2">
                                    {item.type === 'stock' && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] rounded font-mono">Base</span>}
                                    {item.name}
                                </div>
                                <div className="text-xs text-gray-400 font-mono mt-0.5">{item.type === 'menu' ? 'Menu Item' : 'Stock Recipe'}</div>
                            </div>
                            <Download size={14} className="text-gray-400" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Main Editor Page (Dieter Rams style layout) ──
export default function SOPEditorPage({ isEmbedded = false }) {
    const navigate = useNavigate();
    const { 
        recipes, 
        categories, 
        glassSizes, 
        loading, 
        activeCategory, 
        setActiveCategory, 
        searchQuery, 
        setSearchQuery, 
        fetchRecipes, 
        saveSOPRecipe, 
        deleteSOPRecipe, 
        saveCategory, 
        deleteCategory, 
        scaleIngredients, 
        fetchRecipeLabSummary, 
        syncSOPWithRecipeLab, 
        refresh 
    } = useBarSOP({ department: 'bar', staffMode: false });

    const [editing, setEditing] = useState(null); // null = list view, object = editing
    const [showImport, setShowImport] = useState(false);
    const [showCategoryManager, setShowCategoryManager] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [saving, setSaving] = useState(false);
    
    // Accordion expand index
    const [expandedStepIndex, setExpandedStepIndex] = useState(0);
    // Navigation Anchors state
    const [activeAnchor, setActiveAnchor] = useState('basic');

    // ── Create new empty recipe ──
    const handleNew = () => {
        setEditing({
            name: '', name_en: '', category_id: categories[0]?.id || '', department: 'bar',
            base_glass_size_oz: 16, ingredients: [], steps: [],
            scaling_rules: { "8": 0.5, "12": 0.75, "16": 1, "22": 1.375 },
            garnish: '', notes: '', is_published: false, sort_order: 0,
            advanced_details: { equipment: [], qc_standards: [], troubleshooting: [], shelf_life: [], checklist: [] }
        });
        setExpandedStepIndex(0);
        setActiveAnchor('basic');
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

        const allIngs = editing.ingredients || [];
        const nonStandardUnits = [];
        allIngs.forEach(ing => {
            const unitStr = (ing.unit || '').trim();
            if (unitStr) {
                const isStandard = THAI_UNITS.some(u => u.value.toLowerCase() === unitStr.toLowerCase());
                if (!isStandard && !nonStandardUnits.includes(unitStr)) {
                    nonStandardUnits.push(unitStr);
                }
            }
        });
        
        if (nonStandardUnits.length > 0) {
            const confirmMsg = `พบหน่วยส่วนผสมที่ไม่อยู่ในหน่วยมาตรฐาน (${nonStandardUnits.join(', ')}) ซึ่งจะไม่สามารถนำไปคำนวณต้นทุนได้อัตโนมัติ ยืนยันที่จะบันทึกสูตรใช่หรือไม่?`;
            if (!window.confirm(confirmMsg)) {
                return;
            }
        }

        setSaving(true);
        const result = await saveSOPRecipe(editing);
        setSaving(false);
        if (result) {
            setEditing(null);
            fetchRecipes(activeCategory);
        }
    };

    // ── Link/Import from Recipe Lab ──
    const handleLink = async (sourceId, sourceType) => {
        const linkedIngs = await fetchRecipeLabSummary(sourceId, sourceType);
        
        setEditing(prev => {
            const currentManuals = (prev.ingredients || []).filter(i => !i.isLinked);
            const freshLinked = linkedIngs.map(i => ({
                ...i,
                isLinked: true
            }));
            
            return {
                ...prev,
                source_menu_item_id: sourceType === 'menu' ? sourceId : null,
                source_stock_item_id: sourceType === 'stock' ? sourceId : null,
                ingredients: [...freshLinked, ...currentManuals]
            };
        });
        
        setShowImport(false);
        toast.success('เชื่อมโยงส่วนผสมจาก Recipe Lab เรียบร้อย');
    };

    // ── Sync with Recipe Lab ──
    const handleSync = async () => {
        const sourceId = editing.source_menu_item_id || editing.source_stock_item_id;
        const sourceType = editing.source_menu_item_id ? 'menu' : 'stock';
        if (!sourceId) return;

        setSaving(true);
        const merged = await syncSOPWithRecipeLab(sourceId, sourceType, editing.ingredients || []);
        setEditing(prev => ({
            ...prev,
            ingredients: merged
        }));
        setSaving(false);
    };

    // ── Ingredient CRUD Handlers ──
    const addIngredient = () => setEditing(prev => ({ ...prev, ingredients: [...(prev.ingredients || []), { name: '', qty: 0, unit: 'ml', scalable: true, is_sweetener: false }] }));
    const updateIngredient = (i, val) => setEditing(prev => ({ ...prev, ingredients: prev.ingredients.map((ing, idx) => idx === i ? val : ing) }));
    const deleteIngredient = (i) => setEditing(prev => ({ ...prev, ingredients: prev.ingredients.filter((_, idx) => idx !== i) }));

    // ── Step CRUD Handlers ──
    const addStep = () => {
        setEditing(prev => {
            const newSteps = [...(prev.steps || []), { order: (prev.steps?.length || 0) + 1, action: 'pour', title: '', instruction: '', duration_sec: null }];
            setExpandedStepIndex(newSteps.length - 1);
            return { ...prev, steps: newSteps };
        });
    };
    const updateStep = (i, val) => setEditing(prev => ({ ...prev, steps: prev.steps.map((s, idx) => idx === i ? val : s) }));
    const deleteStep = (i) => setEditing(prev => ({ ...prev, steps: prev.steps.filter((_, idx) => idx !== i) }));
    const moveStep = (i, dir) => {
        setEditing(prev => {
            const arr = [...prev.steps];
            const j = i + dir;
            if (j < 0 || j >= arr.length) return prev;
            [arr[i], arr[j]] = [arr[j], arr[i]];
            // update expanded index
            if (expandedStepIndex === i) setExpandedStepIndex(j);
            else if (expandedStepIndex === j) setExpandedStepIndex(i);
            return { ...prev, steps: arr };
        });
    };

    // Smooth Scroll Helper
    const scrollToSection = (id) => {
        setActiveAnchor(id);
        const el = document.getElementById(`sec-${id}`);
        if (el) {
            const offset = 120; // compensate for headers
            const bodyRect = document.body.getBoundingClientRect().top;
            const elementRect = el.getBoundingClientRect().top;
            const elementPosition = elementRect - bodyRect;
            const offsetPosition = elementPosition - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    };

    // ── LIST VIEW ──
    if (!editing) {
        return (
            <div className={`${isEmbedded ? '' : 'min-h-screen bg-gray-50'} font-sans text-gray-900`}>
                {/* Header / Subheader */}
                <div className={`${isEmbedded ? 'bg-transparent mb-4' : 'sticky top-0 z-30 bg-white border-b border-gray-200'}`}>
                    <div className={`p-3 flex justify-between items-center ${isEmbedded ? '' : 'max-w-4xl mx-auto'}`}>
                        <div className="flex items-center gap-3">
                            {!isEmbedded && (
                                <button onClick={() => navigate('/admin')} className="p-2 hover:bg-gray-100 rounded text-gray-500"><ArrowLeft className="w-5 h-5" /></button>
                            )}
                            <div>
                                <h1 className="text-base font-bold font-mono uppercase tracking-wider text-[oklch(18%_0.012_28)]">SOP Recipes</h1>
                                <p className="text-xs text-[oklch(55%_0.010_28)] font-mono">สูตรมาตรฐานและคู่มือการปฏิบัติงาน (Kitchen & Bar)</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setShowCategoryManager(true)} className="p-2 hover:bg-gray-100 rounded text-gray-500 border border-gray-200 bg-white" title="จัดการหมวดหมู่"><Settings size={16} /></button>
                            <button onClick={refresh} className="p-2 hover:bg-gray-100 rounded text-gray-500 border border-gray-200 bg-white"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
                            <button onClick={handleNew} className="bg-[oklch(18%_0.012_28)] text-white px-3 py-2 rounded text-xs font-mono font-bold flex items-center gap-1.5 hover:bg-black tracking-wider shadow-sm">
                                <Plus size={14} /> NEW SOP
                            </button>
                        </div>
                    </div>

                    {/* Category tabs */}
                    <div 
                        className={`flex overflow-x-auto px-3 pb-0 gap-3 border-t border-[oklch(85%_0.012_28)] ${isEmbedded ? '' : 'max-w-4xl mx-auto'} no-scrollbar`}
                        onWheel={e => {
                            if (e.deltaY !== 0) {
                                e.preventDefault();
                                e.currentTarget.scrollLeft += e.deltaY * 0.8;
                            }
                        }}
                    >
                        <button onClick={() => setActiveCategory(null)} className={`pb-2 pt-2 whitespace-nowrap font-mono font-bold text-xs border-b-2 transition-colors ${!activeCategory ? 'border-[oklch(52%_0.16_28)] text-[oklch(18%_0.012_28)]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>[ทั้งหมด]</button>
                        {categories.map(cat => (
                            <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`pb-2 pt-2 whitespace-nowrap font-mono font-bold text-xs border-b-2 transition-colors ${activeCategory === cat.id ? 'border-[oklch(52%_0.16_28)] text-[oklch(18%_0.012_28)]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                                {cat.icon} {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className={`${isEmbedded ? '' : 'max-w-4xl mx-auto p-4'} space-y-4 pb-20`}>
                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="ค้นหาข้อมูลสูตร หรือวัตถุดิบ..."
                            value={searchQuery || ''}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-300 rounded text-sm focus:outline-none focus:border-black transition-all font-mono"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black">
                                <X size={15} />
                            </button>
                        )}
                    </div>

                    {loading ? (
                        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-white rounded border border-gray-200 animate-pulse" />)}</div>
                    ) : recipes.length === 0 ? (
                        <div className="text-center py-20 text-gray-400 border border-dashed border-gray-300 rounded bg-white">
                            <p className="text-sm font-mono uppercase tracking-wider mb-2">ยังไม่มีสูตร SOP ในหมวดหมู่นี้</p>
                            <button onClick={handleNew} className="text-black font-bold text-sm hover:underline font-mono">+ สร้าง SOP ใหม่</button>
                        </div>
                    ) : (
                        <div className="border border-gray-200 rounded overflow-hidden bg-white divide-y divide-gray-100">
                            {recipes.map(recipe => (
                                <div key={recipe.id} className="p-3 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <span className="text-xl flex-shrink-0">{recipe.category?.icon || '📋'}</span>
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-sm tracking-tight text-gray-800">{recipe.name}</h3>
                                            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono mt-0.5">
                                                <span>{recipe.category?.label || 'ทั่วไป'}</span>
                                                <span>•</span>
                                                <span>{recipe.base_glass_size_oz}oz</span>
                                                <span>•</span>
                                                <span>{(recipe.ingredients || []).length} ings</span>
                                                <span>•</span>
                                                <span>{(recipe.steps || []).length} steps</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${recipe.is_published ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                            {recipe.is_published ? 'PUBLISHED' : 'DRAFT'}
                                        </span>
                                        <button onClick={() => setEditing({ ...recipe })} className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded transition-colors"><Edit2 size={15} /></button>
                                        <button onClick={async () => { if (confirm('ลบสูตร SOP นี้?')) { await deleteSOPRecipe(recipe.id); fetchRecipes(activeCategory); }}} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={15} /></button>
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

    // ── EDIT VIEW (Dieter Rams Single-Scroll Layout) ──
    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-32">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
                <div className="p-4 flex justify-between items-center max-w-3xl mx-auto">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setEditing(null)} className="p-2 hover:bg-gray-100 rounded text-gray-600"><ArrowLeft className="w-5 h-5" /></button>
                        <h1 className="text-sm font-mono font-bold uppercase tracking-wider">{editing.id ? 'Edit Recipe' : 'New Recipe'}</h1>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowPreview(!showPreview)} className={`p-2 rounded border ${showPreview ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-200 hover:text-black hover:border-black'} text-xs font-mono font-bold flex items-center gap-1.5`}>
                            {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                            <span>PREVIEW</span>
                        </button>
                        <button onClick={handleSave} disabled={saving} className="bg-black text-white border border-black px-4 py-2 rounded text-xs font-mono font-bold flex items-center gap-1.5 hover:bg-gray-800 disabled:opacity-50 tracking-wider">
                            <Save size={14} /> {saving ? 'SAVING...' : 'SAVE'}
                        </button>
                    </div>
                </div>

                {/* Dieter Rams Subheader Anchors list (Horizontal Scrollable Menu) */}
                <div 
                    className="border-t border-gray-200 py-2.5 overflow-x-auto no-scrollbar bg-gray-50"
                    onWheel={e => {
                        if (e.deltaY !== 0) {
                            e.preventDefault();
                            e.currentTarget.scrollLeft += e.deltaY * 0.8;
                        }
                    }}
                >
                    <div className="flex gap-2 px-4 max-w-3xl mx-auto">
                        {[
                            { id: 'basic', label: 'ข้อมูลทั่วไป' },
                            { id: 'scaling', label: 'ขนาด & การคำนวณ' },
                            { id: 'ingredients', label: 'ส่วนผสม & อุปกรณ์' },
                            { id: 'steps', label: 'ขั้นตอนการทำ' },
                            { id: 'pro', label: 'QC & มาตรฐาน' }
                        ].map(item => (
                            <button
                                key={item.id}
                                onClick={() => scrollToSection(item.id)}
                                className={`px-3 py-1.5 text-xs font-mono font-bold border transition-colors rounded whitespace-nowrap ${
                                    activeAnchor === item.id 
                                        ? 'bg-black text-white border-black shadow-sm' 
                                        : 'bg-white text-gray-500 border-gray-200 hover:text-black hover:border-black'
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto p-4 space-y-8 mt-4">
                {/* Live Preview (Conditional Box) */}
                {showPreview && (
                    <div className="bg-black p-4 rounded border border-gray-800 shadow-2xl">
                        <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-3 px-1 border-b border-gray-900 pb-1 flex justify-between items-center">
                            <span>SOP Viewer Screen Simulation</span>
                            <span className="text-green-500">ONLINE</span>
                        </div>
                        <SOPRecipeCard 
                            recipe={{ 
                                ...editing, 
                                category: categories.find(c => c.id === editing.category_id),
                                display_ingredients: editing.ingredients || []
                            }} 
                            glassSizes={glassSizes} 
                            scaleIngredients={scaleIngredients} 
                            darkMode={true} 
                            defaultExpanded={true} 
                        />
                    </div>
                )}

                {/* ── SECTION 1: ข้อมูลทั่วไป (General Info) ── */}
                <section id="sec-basic" className="bg-white p-5 rounded border border-gray-200 space-y-4">
                    <div className="border-b border-gray-100 pb-2 flex justify-between items-center">
                        <h2 className="text-xs font-mono font-bold text-gray-500 uppercase tracking-widest">01 / ข้อมูลทั่วไป (General Info)</h2>
                        <span className="text-[10px] text-gray-400 font-mono">1-SCROLL</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-mono font-bold text-gray-500 block mb-1">ชื่อเมนู (ภาษาไทย)</label>
                            <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className="w-full p-2.5 border border-gray-300 rounded font-bold text-sm focus:border-black outline-none" placeholder="เช่น มัทฉะลาเต้เย็น" />
                        </div>
                        <div>
                            <label className="text-xs font-mono font-bold text-gray-500 block mb-1">ชื่อเมนู (EN / optional)</label>
                            <input value={editing.name_en || ''} onChange={e => setEditing({ ...editing, name_en: e.target.value })} className="w-full p-2.5 border border-gray-300 rounded text-sm focus:border-black outline-none font-mono" placeholder="e.g. Iced Matcha Latte" />
                        </div>
                        <div>
                            <label className="text-xs font-mono font-bold text-gray-500 block mb-1">หมวดหมู่สูตร SOP</label>
                            <select value={editing.category_id || ''} onChange={e => setEditing({ ...editing, category_id: e.target.value })} className="w-full p-2.5 border border-gray-300 rounded bg-white text-sm focus:border-black outline-none">
                                <option value="">-- เลือกหมวดหมู่ --</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                            </select>
                        </div>
                        {!isCustomMode && (
                            <div>
                                <label className="text-xs font-mono font-bold text-gray-500 block mb-1">ขนาดแก้วมาตรฐาน (Base Glass Size)</label>
                                <select value={editing.base_glass_size_oz} onChange={e => setEditing({ ...editing, base_glass_size_oz: parseInt(e.target.value) })} className="w-full p-2.5 border border-gray-300 rounded bg-white text-sm focus:border-black outline-none font-mono">
                                    {glassSizes.map(gs => <option key={gs.id} value={gs.size_oz}>{gs.size_oz} oz ({gs.name || gs.label})</option>)}
                                    <option value="16">16 oz (Default)</option>
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="text-xs font-mono font-bold text-gray-500 block mb-1">เวลาสกัด/เตรียม (Prep Time)</label>
                            <input value={editing.advanced_details?.prep_time || ''} onChange={e => setEditing({ ...editing, advanced_details: { ...editing.advanced_details, prep_time: e.target.value }})} className="w-full p-2.5 border border-gray-300 rounded text-sm focus:border-black outline-none" placeholder="เช่น 2-3 นาที" />
                        </div>
                        <div>
                            <label className="text-xs font-mono font-bold text-gray-500 block mb-1">ระดับน้ำแข็งมาตรฐาน (Ice Level)</label>
                            <input value={editing.advanced_details?.ice_level || ''} onChange={e => setEditing({ ...editing, advanced_details: { ...editing.advanced_details, ice_level: e.target.value }})} className="w-full p-2.5 border border-gray-300 rounded text-sm focus:border-black outline-none" placeholder="เช่น เต็มแก้ว 100%" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-mono font-bold text-gray-500 block mb-1">รายละเอียดเครื่องดื่มย่อ (Profile Description)</label>
                            <input value={editing.advanced_details?.profile || ''} onChange={e => setEditing({ ...editing, advanced_details: { ...editing.advanced_details, profile: e.target.value }})} className="w-full p-2.5 border border-gray-300 rounded text-sm focus:border-black outline-none" placeholder="เช่น โทนชาเขียวเข้มข้น หวานละมุนแยกชั้นกับนมสด" />
                        </div>
                    </div>
                </section>

                {/* ── SECTION 2: ขนาด & การคำนวณ (Scaling & Presets) ── */}
                <section id="sec-scaling" className="bg-white p-5 rounded border border-gray-200 space-y-4">
                    <div className="border-b border-gray-100 pb-2 flex justify-between items-start">
                        <div>
                            <h2 className="text-xs font-mono font-bold text-gray-500 uppercase tracking-widest">02 / การคำนวณและปรับขนาด (Scaling Rules)</h2>
                        </div>
                        <div className="flex bg-gray-100 p-0.5 rounded border border-gray-200">
                            <button onClick={() => toggleCustomMode(false)} className={`px-2 py-1 text-[10px] font-mono font-bold rounded ${!isCustomMode ? 'bg-white shadow text-black' : 'text-gray-400'}`}>แก้ว (OZ)</button>
                            <button onClick={() => toggleCustomMode(true)} className={`px-2 py-1 text-[10px] font-mono font-bold rounded ${isCustomMode ? 'bg-white shadow text-black' : 'text-gray-400'}`}>เบส (CUSTOM)</button>
                        </div>
                    </div>

                    {isCustomMode ? (
                        <div className="space-y-3">
                            <p className="text-xs text-gray-400 font-mono">กำหนดสเกลสำหรับทำสูตรล็อตใหญ่ (เช่น 1 ถัง, 1.5 ลิตร) และตัวคูณปริมาณวัตถุดิบ</p>
                            {(editing.scaling_rules?.presets || []).map((preset, idx) => (
                                <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                                    <input 
                                        value={preset.name} 
                                        onChange={e => {
                                            const newPresets = [...editing.scaling_rules.presets];
                                            newPresets[idx].name = e.target.value;
                                            setEditing({ ...editing, scaling_rules: { ...editing.scaling_rules, presets: newPresets } });
                                        }}
                                        placeholder="ชื่อปุ่ม (เช่น 1.5 ลิตร)"
                                        className="flex-1 p-2 border border-gray-300 rounded text-sm font-bold focus:border-black outline-none"
                                    />
                                    <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border border-gray-200">
                                        <span className="text-[10px] font-mono font-bold text-gray-400">MULTIPLIER</span>
                                        <input 
                                            type="number" step="0.01"
                                            value={preset.multiplier}
                                            onChange={e => {
                                                const newPresets = [...editing.scaling_rules.presets];
                                                newPresets[idx].multiplier = parseFloat(e.target.value) || 1;
                                                setEditing({ ...editing, scaling_rules: { ...editing.scaling_rules, presets: newPresets } });
                                            }}
                                            className={`w-14 p-0.5 text-sm text-center font-mono font-bold outline-none ${preset.isBase ? 'text-gray-400 bg-transparent' : 'text-black'}`}
                                            disabled={preset.isBase}
                                        />
                                    </div>
                                    {!preset.isBase && (
                                        <button onClick={() => {
                                            const newPresets = editing.scaling_rules.presets.filter((_, i) => i !== idx);
                                            setEditing({ ...editing, scaling_rules: { ...editing.scaling_rules, presets: newPresets } });
                                        }} className="p-1.5 text-gray-400 hover:text-red-600">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button onClick={() => {
                                const newPresets = [...(editing.scaling_rules?.presets || []), { name: 'สเกลใหม่', multiplier: 2.0 }];
                                setEditing({ ...editing, scaling_rules: { ...editing.scaling_rules, presets: newPresets } });
                            }} className="text-xs font-mono font-bold text-black border border-black hover:bg-gray-50 px-3 py-1.5 rounded">+ เพิ่ม Preset ใหม่</button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-xs text-gray-400 font-mono">เลือกขนาดแก้วที่จำหน่ายสำหรับเมนูนี้ และสเกลปริมาณน้ำ (ระบบคำนวณสเกลให้อัตโนมัติ)</p>
                            <div className="flex flex-wrap gap-2">
                                {glassSizes.map(gs => {
                                    const isBase = gs.size_oz === editing.base_glass_size_oz;
                                    const isAvailable = isBase || editing.scaling_rules?.[String(gs.size_oz)] !== undefined;
                                    
                                    return (
                                        <button
                                            key={gs.id}
                                            type="button"
                                            onClick={() => {
                                                if (isBase) return;
                                                const newRules = { ...editing.scaling_rules };
                                                if (isAvailable) {
                                                    delete newRules[String(gs.size_oz)];
                                                } else {
                                                    newRules[String(gs.size_oz)] = gs.size_oz / editing.base_glass_size_oz;
                                                }
                                                setEditing({ ...editing, scaling_rules: newRules });
                                            }}
                                            className={`relative px-4 py-3.5 rounded border-2 text-left flex flex-col justify-between min-w-[110px] h-[95px] transition-all cursor-pointer ${
                                                isAvailable ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-200 text-gray-400 hover:border-black hover:text-black'
                                            }`}
                                        >
                                            <div className={`text-[9px] font-mono tracking-wider ${isAvailable ? 'text-gray-400' : 'text-gray-400'}`}>{isBase ? 'STANDARD' : isAvailable ? 'ON SALE' : 'UNAVAILABLE'}</div>
                                            <div className="font-bold text-lg font-mono tracking-tight mt-1">{gs.size_oz} <span className="text-xs">OZ</span></div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </section>

                {/* ── SECTION 3: ส่วนผสมและอุปกรณ์ (Ingredients & Equipment) ── */}
                <section id="sec-ingredients" className="bg-white p-5 rounded border border-gray-200 space-y-4">
                    <div className="border-b border-gray-100 pb-2 flex justify-between items-center">
                        <h2 className="text-xs font-mono font-bold text-gray-500 uppercase tracking-widest">03 / ส่วนผสมและอุปกรณ์ (Ingredients)</h2>
                        <button onClick={() => setShowImport(true)} className="text-xs font-mono font-bold text-black border border-black px-2 py-1 rounded hover:bg-gray-50 flex items-center gap-1">
                            <Download size={12} /> Recipe Lab Connection
                        </button>
                    </div>

                    {/* Linked Status & Sync button */}
                    {(editing.source_menu_item_id || editing.source_stock_item_id) && (
                        <div className="flex items-center justify-between p-3 bg-indigo-50/50 border border-indigo-100 rounded">
                            <div className="min-w-0">
                                <div className="text-xs font-bold text-indigo-900 flex items-center gap-1.5 font-mono">
                                    <Link size={12} /> เชื่อมต่อคลังวัตถุดิบอัตโนมัติ
                                </div>
                                <p className="text-[10px] text-indigo-500 font-mono mt-0.5">ส่วนผสมที่เปลี่ยนแปลงใน Recipe Lab สามารถซิงค์ปรับโครงสร้างที่นี่ได้</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={handleSync}
                                    className="px-2.5 py-1 text-xs font-mono font-bold bg-white border border-indigo-200 text-indigo-700 rounded hover:bg-indigo-50 transition-colors shadow-sm"
                                >
                                    SYNC
                                </button>
                                <button 
                                    onClick={() => setEditing(prev => ({ ...prev, source_menu_item_id: null, source_stock_item_id: null }))}
                                    className="text-xs font-mono text-red-600 hover:underline"
                                >
                                    UNLINK
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Integrated list */}
                    <div className="space-y-2">
                        {(editing.ingredients || []).map((ing, i) => (
                            <IngredientRow key={i} ing={ing} index={i} onUpdate={updateIngredient} onDelete={deleteIngredient} />
                        ))}
                        {(editing.ingredients || []).length === 0 && (
                            <div className="text-center py-6 font-mono text-xs text-gray-400 italic">
                                ยังไม่มีส่วนผสม กรุณากดเชื่อมโยงคลังสินค้าหรือแอดวัตถุดิบแบบพอร์ทัล
                            </div>
                        )}
                        <button onClick={addIngredient} className="w-full py-2 border border-dashed border-gray-300 rounded text-xs font-mono font-bold text-gray-500 hover:border-black hover:text-black transition-colors">+ เพิ่มวัตถุดิบ (ADD INGREDIENT)</button>
                    </div>

                    <div className="border-t border-gray-100 pt-4 mt-4 space-y-2">
                        <label className="text-xs font-mono font-bold text-gray-500 block">อุปกรณ์เฉพาะ (Required Equipment)</label>
                        <textarea
                            value={Array.isArray(editing.advanced_details?.equipment) ? editing.advanced_details.equipment.join(', ') : (editing.advanced_details?.equipment || '')}
                            onChange={e => {
                                const val = e.target.value;
                                const arr = val.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
                                setEditing({ ...editing, advanced_details: { ...editing.advanced_details, equipment: arr } });
                            }}
                            className="w-full p-2.5 border border-gray-300 rounded text-sm focus:border-black focus:ring-0 outline-none resize-none font-mono"
                            rows={2}
                            placeholder="ตง ช้อนชา, บิวเรตต์ (คั่นด้วย Enter หรือลูกน้ำ ,)"
                        />
                    </div>
                </section>

                {/* ── SECTION 4: ขั้นตอนการทำ (Steps) ── */}
                <section id="sec-steps" className="bg-white p-5 rounded border border-gray-200 space-y-4">
                    <div className="border-b border-gray-100 pb-2 flex justify-between items-center">
                        <h2 className="text-xs font-mono font-bold text-gray-500 uppercase tracking-widest">04 / ขั้นตอนการเตรียมและดำเนินการ (Steps)</h2>
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-500">{(editing.steps || []).length} ขั้นตอน</span>
                    </div>

                    <div className="space-y-2">
                        {(editing.steps || []).map((step, i) => (
                            <StepRow 
                                key={i} 
                                step={step} 
                                index={i} 
                                onUpdate={updateStep} 
                                onDelete={deleteStep} 
                                onMove={moveStep} 
                                isLast={i === editing.steps.length - 1} 
                                isExpanded={expandedStepIndex === i}
                                onToggleExpand={() => setExpandedStepIndex(expandedStepIndex === i ? null : i)}
                                availableIngredients={(editing.ingredients || []).map(ing => ing.name)}
                            />
                        ))}
                        {(editing.steps || []).length === 0 && (
                            <div className="text-center py-6 font-mono text-xs text-gray-400 italic">
                                ยังไม่มีขั้นตอนดำเนินการบันทึก
                            </div>
                        )}
                        <button onClick={addStep} className="w-full py-2 border border-dashed border-gray-300 rounded text-xs font-mono font-bold text-gray-500 hover:border-black hover:text-black transition-colors">+ เพิ่มขั้นตอนดำเนินการ (ADD STEP)</button>
                    </div>
                </section>

                {/* ── SECTION 5: QC & มาตรฐานคุณภาพ (Pro Details) ── */}
                <section id="sec-pro" className="bg-white p-5 rounded border border-gray-200 space-y-6">
                    <div className="border-b border-gray-100 pb-2 flex justify-between items-center">
                        <h2 className="text-xs font-mono font-bold text-gray-500 uppercase tracking-widest">05 / มาตรฐานการบริการ & ประกันคุณภาพ (QC)</h2>
                        
                        {/* Copy details selector */}
                        <select
                            className="p-1 border border-gray-300 rounded text-[11px] font-mono outline-none bg-white focus:border-black"
                            onChange={(e) => {
                                const val = e.target.value;
                                if (!val) return;
                                const source = recipes.find(r => r.id === val);
                                if (source && source.advanced_details) {
                                    if (confirm(`คัดลอกข้อมูลความปลอดภัย/QC จาก "${source.name}" หรือไม่? ข้อมูลเดิมจะถูกทับทั้งหมด`)) {
                                        setEditing({
                                            ...editing,
                                            advanced_details: {
                                                ...editing.advanced_details,
                                                qc_standards: source.advanced_details.qc_standards || [],
                                                troubleshooting: source.advanced_details.troubleshooting || [],
                                                shelf_life: source.advanced_details.shelf_life || [],
                                                checklist: source.advanced_details.checklist || []
                                            }
                                        });
                                    }
                                }
                                e.target.value = "";
                            }}
                        >
                            <option value="">[คัดลอกข้อมูล Pro จากสูตรอื่น]</option>
                            {recipes.filter(r => r.id !== editing.id).map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* QC list */}
                    <div className="space-y-2">
                        <label className="text-xs font-mono font-bold text-gray-500 block">มาตรฐานของรสชาติและหน้าตา (QC Standards)</label>
                        {(editing.advanced_details?.qc_standards || []).map((qc, i) => (
                            <div key={i} className="flex gap-3 items-center py-1">
                                <input 
                                    value={qc.topic || ''} 
                                    onChange={e => {
                                        const newQc = (editing.advanced_details?.qc_standards || []).map((item, idx) => 
                                            idx === i ? { ...item, topic: e.target.value } : item
                                        );
                                        setEditing(prev => ({ 
                                            ...prev, 
                                            advanced_details: { ...prev.advanced_details, qc_standards: newQc } 
                                        }));
                                    }} 
                                    className="w-1/3 p-2 border border-gray-300 rounded text-sm focus:border-black font-semibold outline-none" 
                                    placeholder="หัวข้อ (เช่น สี/หน้าตา)" 
                                />
                                <input 
                                    value={qc.standard || ''} 
                                    onChange={e => {
                                        const newQc = (editing.advanced_details?.qc_standards || []).map((item, idx) => 
                                            idx === i ? { ...item, standard: e.target.value } : item
                                        );
                                        setEditing(prev => ({ 
                                            ...prev, 
                                            advanced_details: { ...prev.advanced_details, qc_standards: newQc } 
                                        }));
                                    }} 
                                    className="flex-1 p-2 border border-gray-300 rounded text-sm focus:border-black outline-none" 
                                    placeholder="มาตรฐานรสชาติที่ยอมรับได้" 
                                />
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        const newQc = (editing.advanced_details?.qc_standards || []).filter((_, idx) => idx !== i);
                                        setEditing(prev => ({ 
                                            ...prev, 
                                            advanced_details: { ...prev.advanced_details, qc_standards: newQc } 
                                        }));
                                    }} 
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-50 rounded transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        <button 
                            type="button"
                            onClick={() => {
                                const newQc = [...(editing.advanced_details?.qc_standards || []), { topic: '', standard: '' }];
                                setEditing(prev => ({ 
                                    ...prev, 
                                    advanced_details: { ...prev.advanced_details, qc_standards: newQc } 
                                }));
                            }} 
                            className="text-xs font-mono font-bold text-black border border-black px-3 py-1.5 rounded hover:bg-gray-50"
                        >
                            + เพิ่มมาตรฐาน QC
                        </button>
                    </div>

                    {/* Troubleshooting list */}
                    <div className="space-y-4 border-t border-gray-100 pt-4">
                        <label className="text-xs font-mono font-bold text-gray-500 block">การแก้ปัญหาเบื้องต้น (Troubleshooting)</label>
                        {(editing.advanced_details?.troubleshooting || []).map((tb, i) => (
                            <div key={i} className="p-4 bg-gray-50 rounded border border-gray-200 relative space-y-3">
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        const newTb = (editing.advanced_details?.troubleshooting || []).filter((_, idx) => idx !== i);
                                        setEditing(prev => ({ 
                                            ...prev, 
                                            advanced_details: { ...prev.advanced_details, troubleshooting: newTb } 
                                        }));
                                    }} 
                                    className="absolute top-3 right-3 text-gray-400 hover:text-red-500"
                                >
                                    <Trash2 size={16} />
                                </button>
                                <div className="space-y-2.5 pr-6">
                                    <div>
                                        <label className="text-[10px] font-mono font-bold text-red-500 uppercase block mb-1">ปัญหาที่อาจเกิดขึ้น / Problem</label>
                                        <input 
                                            value={tb.problem || ''} 
                                            onChange={e => {
                                                const newTb = (editing.advanced_details?.troubleshooting || []).map((item, idx) => 
                                                    idx === i ? { ...item, problem: e.target.value } : item
                                                );
                                                setEditing(prev => ({ 
                                                    ...prev, 
                                                    advanced_details: { ...prev.advanced_details, troubleshooting: newTb } 
                                                }));
                                            }} 
                                            className="w-full p-2 border border-gray-300 rounded text-sm font-bold text-red-600 focus:border-red-500 outline-none" 
                                            placeholder="เช่น ชาขมเกินไป" 
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-mono font-bold text-gray-400 uppercase block mb-1">สาเหตุที่เป็นไปได้ / Cause</label>
                                        <input 
                                            value={tb.cause || ''} 
                                            onChange={e => {
                                                const newTb = (editing.advanced_details?.troubleshooting || []).map((item, idx) => 
                                                    idx === i ? { ...item, cause: e.target.value } : item
                                                );
                                                setEditing(prev => ({ 
                                                    ...prev, 
                                                    advanced_details: { ...prev.advanced_details, troubleshooting: newTb } 
                                                }));
                                            }} 
                                            className="w-full p-2 border border-gray-300 rounded text-xs focus:border-black outline-none" 
                                            placeholder="เช่น แช่ชานานเกินเวลา หรือใช้น้ำร้อนเกินมาตรฐาน" 
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-mono font-bold text-green-600 uppercase block mb-1">แนวทางการแก้ไข / Solution</label>
                                        <input 
                                            value={tb.solution || ''} 
                                            onChange={e => {
                                                const newTb = (editing.advanced_details?.troubleshooting || []).map((item, idx) => 
                                                    idx === i ? { ...item, solution: e.target.value } : item
                                                );
                                                setEditing(prev => ({ 
                                                    ...prev, 
                                                    advanced_details: { ...prev.advanced_details, troubleshooting: newTb } 
                                                }));
                                            }} 
                                            className="w-full p-2 border border-green-300 bg-green-50/20 rounded text-xs focus:border-green-600 outline-none" 
                                            placeholder="เช่น จับเวลาสกัดชาไม่เกิน 30 วินาที และควบคุมอุณหภูมิน้ำให้อยู่ที่ 85 องศา" 
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                        <button 
                            type="button"
                            onClick={() => {
                                const newTb = [...(editing.advanced_details?.troubleshooting || []), { problem: '', cause: '', solution: '' }];
                                setEditing(prev => ({ 
                                    ...prev, 
                                    advanced_details: { ...prev.advanced_details, troubleshooting: newTb } 
                                }));
                            }} 
                            className="text-xs font-mono font-bold text-black border border-black px-3 py-1.5 rounded hover:bg-gray-50"
                        >
                            + เพิ่มแนวทางการแก้ปัญหา
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-gray-100 pt-4">
                        {/* Shelf life */}
                        <div className="space-y-3">
                            <label className="text-xs font-mono font-bold text-gray-500 block">อายุและการจัดเก็บรักษา (Shelf Life)</label>
                            <div className="space-y-2">
                                {(editing.advanced_details?.shelf_life || []).map((sl, i) => (
                                    <div key={i} className="flex gap-2 items-center">
                                        <input 
                                            value={sl.item || ''} 
                                            onChange={e => {
                                                const newSl = (editing.advanced_details?.shelf_life || []).map((item, idx) => 
                                                    idx === i ? { ...item, item: e.target.value } : item
                                                );
                                                setEditing(prev => ({ 
                                                    ...prev, 
                                                    advanced_details: { ...prev.advanced_details, shelf_life: newSl } 
                                                }));
                                            }} 
                                            className="flex-1 p-2 border border-gray-300 rounded text-sm focus:border-black outline-none" 
                                            placeholder="รายการ (เช่น เบสชาเย็น)" 
                                        />
                                        <input 
                                            value={sl.age || ''} 
                                            onChange={e => {
                                                const newSl = (editing.advanced_details?.shelf_life || []).map((item, idx) => 
                                                    idx === i ? { ...item, age: e.target.value } : item
                                                );
                                                setEditing(prev => ({ 
                                                    ...prev, 
                                                    advanced_details: { ...prev.advanced_details, shelf_life: newSl } 
                                                }));
                                            }} 
                                            className="w-20 p-2 border border-gray-300 rounded text-sm text-center focus:border-black font-mono outline-none" 
                                            placeholder="1 วัน" 
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                const newSl = (editing.advanced_details?.shelf_life || []).filter((_, idx) => idx !== i);
                                                setEditing(prev => ({ 
                                                    ...prev, 
                                                    advanced_details: { ...prev.advanced_details, shelf_life: newSl } 
                                                }));
                                            }} 
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-50 rounded"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button 
                                type="button"
                                onClick={() => {
                                    const newSl = [...(editing.advanced_details?.shelf_life || []), { item: '', age: '' }];
                                    setEditing(prev => ({ 
                                        ...prev, 
                                        advanced_details: { ...prev.advanced_details, shelf_life: newSl } 
                                    }));
                                }} 
                                className="text-xs font-mono font-bold text-black border border-black px-2 py-1.5 rounded hover:bg-gray-50"
                            >
                                + Add Shelf Life
                            </button>
                        </div>

                        {/* Checklist before serving */}
                        <div className="space-y-3">
                            <label className="text-xs font-mono font-bold text-gray-500 block">รายการเช็คก่อนส่งมอบ (Serving Checklist)</label>
                            <div className="space-y-2">
                                {(editing.advanced_details?.checklist || []).map((cl, i) => (
                                    <div key={i} className="flex gap-2 items-center">
                                        <span className="text-gray-400 font-mono">☑</span>
                                        <input 
                                            value={cl || ''} 
                                            onChange={e => {
                                                const newCl = (editing.advanced_details?.checklist || []).map((item, idx) => 
                                                    idx === i ? e.target.value : item
                                                );
                                                setEditing(prev => ({ 
                                                    ...prev, 
                                                    advanced_details: { ...prev.advanced_details, checklist: newCl } 
                                                }));
                                            }} 
                                            className="flex-1 p-2 border border-gray-300 rounded text-sm focus:border-black outline-none" 
                                            placeholder="เช่น เช็ดขอบแก้วเรียบร้อย" 
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                const newCl = (editing.advanced_details?.checklist || []).filter((_, idx) => idx !== i);
                                                setEditing(prev => ({ 
                                                    ...prev, 
                                                    advanced_details: { ...prev.advanced_details, checklist: newCl } 
                                                }));
                                            }} 
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-50 rounded"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button 
                                type="button"
                                onClick={() => {
                                    const newCl = [...(editing.advanced_details?.checklist || []), ''];
                                    setEditing(prev => ({ 
                                        ...prev, 
                                        advanced_details: { ...prev.advanced_details, checklist: newCl } 
                                    }));
                                }} 
                                className="text-xs font-mono font-bold text-black border border-black px-2 py-1.5 rounded hover:bg-gray-50"
                            >
                                + Add Checklist
                            </button>
                        </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4 flex items-center gap-3">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <input type="checkbox" checked={editing.is_published} onChange={e => setEditing({ ...editing, is_published: e.target.checked })} className="w-5 h-5 rounded text-black border-gray-300 focus:ring-0" />
                            <span className="font-bold text-sm font-mono tracking-tight">{editing.is_published ? '✅ PUBLISHED (พนักงานสามารถเห็นได้)' : '⬜ DRAFT (ซ่อนจากผู้ใช้งานทั่วไป)'}</span>
                        </label>
                    </div>
                </section>
            </div>

            {/* Import Modal overlay */}
            {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={handleLink} />}

            {/* Standard units list */}
            <datalist id="sop-units">
                {THAI_UNITS.map(u => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                ))}
            </datalist>

            {/* Sticky Bottom Actions for Mobile */}
            <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 p-3 flex justify-between gap-3 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                <button 
                    onClick={() => setEditing(null)} 
                    className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-mono font-bold rounded text-xs transition-colors cursor-pointer"
                >
                    BACK
                </button>
                <button 
                    onClick={() => setShowPreview(!showPreview)} 
                    className={`py-3 px-4 font-mono font-bold rounded text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                        showPreview ? 'bg-black text-white border-black border' : 'bg-gray-100 text-gray-600'
                    }`}
                >
                    {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                    <span>{showPreview ? 'CLOSE PREVIEW' : 'PREVIEW'}</span>
                </button>
                <button 
                    onClick={handleSave} 
                    disabled={saving} 
                    className="flex-[1.5] py-3 px-4 bg-black hover:bg-gray-800 text-white font-mono font-bold rounded text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-md cursor-pointer"
                >
                    <Save size={14} />
                    <span>{saving ? 'SAVING...' : 'SAVE SOP'}</span>
                </button>
            </div>
        </div>
    );
}
