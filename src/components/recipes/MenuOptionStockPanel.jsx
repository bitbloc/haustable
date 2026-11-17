/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabaseClient';
import { THAI_UNITS } from '../../utils/unitUtils';
import { planChoiceIngredientSave, validateChoiceIngredients } from '../../utils/optionIngredients';

const INK = 'text-[var(--color-ink)]';
const MUTED = 'text-[var(--color-muted)]';
const NEUTRAL = 'text-[var(--color-neutral)]';
const RULE = 'border-[var(--color-rule)]';
const ACCENT = 'text-[var(--brand-plum)]';

const unitLabel = (u) => (THAI_UNITS.find(x => x.value === u)?.label || u || '').replace(/\s*\(.*\)\s*$/, '');
const fmt = (n) => Number(Number(n).toFixed(2)).toLocaleString('th-TH', { maximumFractionDigits: 2 });
let seq = 0;
const key = () => `opt_${++seq}`;

/**
 * Stock rules of this menu's options, on the recipe page itself:
 *   sweetness groups: the multiplier of each level, which recipe ingredients are sweeteners,
 *                     and what each level deducts;
 *   other groups (hot/iced, add shot...): what each choice adds or removes for THIS menu.
 * Menu-specific rows replace the "every menu" rows of a choice (stock_requirements_for_sale).
 */
export default function MenuOptionStockPanel({ menuId, stockItems = [], recipe = [], onSweetenerChanged }) {
    const [loading, setLoading] = useState(true);
    const [groups, setGroups] = useState([]);
    const [existing, setExisting] = useState([]);   // option_choice_ingredients rows for these choices
    const [drafts, setDrafts] = useState({});       // choiceId -> [{ key, id, stock_item_id, sign, amount }]
    const [dirty, setDirty] = useState({});
    const [saving, setSaving] = useState(null);
    const [search, setSearch] = useState({});       // choiceId -> text

    const itemsById = useMemo(() => new Map(stockItems.map(i => [i.id, i])), [stockItems]);

    const load = useCallback(async () => {
        setLoading(true);
        const { data: links } = await supabase.from('menu_item_options').select('option_group_id').eq('menu_item_id', menuId);
        const groupIds = [...new Set((links || []).map(l => l.option_group_id).filter(Boolean))];
        if (!groupIds.length) { setGroups([]); setExisting([]); setDrafts({}); setLoading(false); return; }
        const { data: gs } = await supabase.from('option_groups').select('id, name, option_choices (*)').in('id', groupIds);
        const choiceIds = (gs || []).flatMap(g => (g.option_choices || []).map(c => c.id));
        const { data: rows } = choiceIds.length
            ? await supabase.from('option_choice_ingredients').select('id, choice_id, menu_item_id, stock_item_id, quantity').in('choice_id', choiceIds)
            : { data: [] };
        const sorted = (gs || []).map(g => ({
            ...g,
            option_choices: [...(g.option_choices || [])].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        }));
        setGroups(sorted);
        setExisting(rows || []);
        const d = {};
        for (const c of sorted.flatMap(g => g.option_choices)) {
            d[c.id] = (rows || []).filter(r => r.choice_id === c.id && String(r.menu_item_id) === String(menuId)).map(r => ({
                key: key(), id: r.id, stock_item_id: r.stock_item_id, menu_item_id: menuId,
                sign: Number(r.quantity) < 0 ? 'minus' : 'plus', amount: String(Math.abs(Number(r.quantity)))
            }));
        }
        setDrafts(d);
        setDirty({});
        setLoading(false);
    }, [menuId]);

    useEffect(() => { if (menuId) load(); }, [menuId, load]);

    const isSweetGroup = (g) => g.option_choices.some(c => c.sweetener_factor !== null && c.sweetener_factor !== undefined);
    const sweetGroups = groups.filter(isSweetGroup);
    const otherGroups = groups.filter(g => !isSweetGroup(g));

    // Recipe lines with their stock item, for the sweetener list and previews
    const recipeLines = useMemo(() => recipe
        .map(r => ({ ...r, item: itemsById.get(r.ingredientId) || r.ingredient }))
        .filter(r => r.item), [recipe, itemsById]);

    const toggleSweetener = async (item) => {
        const next = !item.is_sweetener;
        const { error } = await supabase.from('stock_items').update({ is_sweetener: next }).eq('id', item.id);
        if (error) { toast.error('บันทึกไม่สำเร็จ: ' + error.message); return; }
        onSweetenerChanged?.(item.id, next);
        toast.success(next ? `${item.name} เป็นสารให้ความหวานแล้ว (ทุกเมนู)` : `${item.name} ไม่นับเป็นสารให้ความหวานแล้ว (ทุกเมนู)`);
    };

    // Always from the latest rows, so quick edits (sign, then amount) never overwrite each other
    const updateDraft = (choiceId, change) => {
        setDrafts(prev => ({ ...prev, [choiceId]: change(prev[choiceId] || []) }));
        setDirty(prev => ({ ...prev, [choiceId]: true }));
    };

    const saveChoice = async (choice) => {
        const { rows, errors } = validateChoiceIngredients((drafts[choice.id] || []).map(r => ({ ...r, menu_item_id: menuId })));
        if (Object.keys(errors).length) { toast.error(Object.values(errors)[0]); return; }
        const mine = existing.filter(r => r.choice_id === choice.id && String(r.menu_item_id) === String(menuId));
        const plan = planChoiceIngredientSave(choice.id, mine, rows);
        setSaving(choice.id);
        try {
            if (plan.deletes.length) {
                const { error } = await supabase.from('option_choice_ingredients').delete().in('id', plan.deletes);
                if (error) throw error;
            }
            for (const u of plan.updates) {
                const { id, ...payload } = u;
                const { error } = await supabase.from('option_choice_ingredients').update(payload).eq('id', id);
                if (error) throw error;
            }
            if (plan.inserts.length) {
                const { error } = await supabase.from('option_choice_ingredients').insert(plan.inserts);
                if (error) throw error;
            }
            toast.success(`บันทึก "${choice.name}" ของเมนูนี้แล้ว`);
            await load();
        } catch (err) {
            toast.error('บันทึกไม่สำเร็จ: ' + err.message);
        } finally {
            setSaving(null);
        }
    };

    if (loading) return <div className={`text-xs ${NEUTRAL} py-3`}>กำลังโหลดตัวเลือก…</div>;
    if (!groups.length) {
        return (
            <section className={`border ${RULE} p-3 space-y-1`}>
                <h3 className={`text-sm font-semibold ${INK}`}>ตัวเลือกที่มีผลกับสต๊อก</h3>
                <p className={`text-xs ${NEUTRAL}`}>เมนูนี้ยังไม่ได้ผูกกลุ่มตัวเลือก (เช่น ร้อน/เย็น ระดับความหวาน) ผูกได้ที่หน้าแก้ไขเมนู</p>
            </section>
        );
    }

    const sweetenerLines = recipeLines.filter(r => r.item.is_sweetener);

    return (
        <section className={`border ${RULE} bg-[var(--color-paper)]`}>
            <div className={`px-3 py-2.5 border-b ${RULE}`}>
                <h3 className={`text-sm font-semibold ${INK}`}>ตัวเลือกที่มีผลกับสต๊อก</h3>
                <p className={`text-xs ${NEUTRAL}`}>คิดจากสูตรด้านบน แล้วปรับตามตัวเลือกที่ลูกค้าเลือก</p>
            </div>

            {/* Sweetness */}
            {sweetGroups.map(g => (
                <div key={g.id} className={`px-3 py-3 border-b ${RULE} space-y-2.5`}>
                    <div>
                        <div className={`text-sm font-medium ${INK}`}>{g.name}</div>
                        <div className={`text-xs ${NEUTRAL}`}>ตั้งที่นี่ที่เดียว ใช้ทั้งตัดสต๊อกตอนขายและสูตรที่บาร์เห็น (สูตรบาร์ที่ผูกกับเมนูนี้)</div>
                    </div>
                    <div>
                        <div className={`text-xs ${MUTED} mb-1`}>วัตถุดิบในสูตรที่นับเป็นสารให้ความหวาน (มีผลทุกเมนูที่ใช้)</div>
                        {recipeLines.length === 0 ? (
                            <p className={`text-xs ${NEUTRAL}`}>ยังไม่มีวัตถุดิบในสูตร</p>
                        ) : (
                            <div className="flex flex-wrap gap-1.5">
                                {recipeLines.map(r => (
                                    <button
                                        key={r.id}
                                        type="button"
                                        onClick={() => toggleSweetener(r.item)}
                                        aria-pressed={!!r.item.is_sweetener}
                                        className={`h-8 px-2.5 border text-xs transition-colors ${r.item.is_sweetener ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]' : `${RULE} ${MUTED} hover:border-[var(--color-ink)]`}`}
                                    >
                                        {r.item.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <table className="w-full text-xs tabular-nums">
                        <thead>
                            <tr className={NEUTRAL}>
                                <th className="text-left font-normal py-1">ระดับ</th>
                                <th className="text-right font-normal py-1">ตัวคูณ</th>
                                <th className="text-right font-normal py-1">ตัดสต๊อกสารให้ความหวาน</th>
                            </tr>
                        </thead>
                        <tbody>
                            {g.option_choices.map(c => {
                                const f = c.sweetener_factor === null || c.sweetener_factor === undefined ? null : Number(c.sweetener_factor);
                                return (
                                    <tr key={c.id} className={`border-t ${RULE}`}>
                                        <td className={`py-1.5 ${INK}`}>{c.name}</td>
                                        <td className={`py-1.5 text-right ${f === null ? NEUTRAL : INK}`}>{f === null ? 'ไม่ปรับ' : `×${f}`}</td>
                                        <td className={`py-1.5 text-right ${MUTED}`}>
                                            {sweetenerLines.length === 0
                                                ? <span className={NEUTRAL}>เลือกสารให้ความหวานด้านบน</span>
                                                : sweetenerLines.map(r => `${r.item.name} ${fmt(Number(r.quantity) * (f ?? 1))} ${unitLabel(r.item.usage_unit)}`).join(' · ')}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <p className={`text-[11px] ${NEUTRAL}`}>แก้ตัวคูณได้ที่ Modifiers &amp; Options · ปริมาณที่ตัวเลือกอื่นเพิ่ม (เช่น เย็น) ถูกคูณด้วย</p>
                </div>
            ))}

            {/* Other options: per-menu adds / removes */}
            {otherGroups.map(g => (
                <div key={g.id} className={`px-3 py-3 border-b ${RULE} last:border-b-0 space-y-3`}>
                    <div className={`text-sm font-medium ${INK}`}>{g.name}</div>
                    {g.option_choices.map(c => {
                        const rows = drafts[c.id] || [];
                        const generic = existing.filter(r => r.choice_id === c.id && r.menu_item_id === null);
                        const q = (search[c.id] || '').trim().toLowerCase();
                        const matches = q ? stockItems.filter(i => String(i.name || '').toLowerCase().includes(q)).slice(0, 6) : [];
                        return (
                            <div key={c.id} className="space-y-1.5">
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className={`text-sm ${INK}`}>{c.name}</span>
                                    {dirty[c.id] && (
                                        <button type="button" disabled={saving === c.id} onClick={() => saveChoice(c)}
                                            className="admin-btn is-primary h-7 px-3 text-xs">
                                            {saving === c.id ? 'กำลังบันทึก…' : 'บันทึก'}
                                        </button>
                                    )}
                                </div>
                                {rows.length === 0 && (
                                    <p className={`text-xs ${NEUTRAL}`}>
                                        {generic.length
                                            ? `ใช้ค่ากลางทุกเมนู: ${generic.map(r => `${Number(r.quantity) > 0 ? '+' : '−'}${fmt(Math.abs(r.quantity))} ${unitLabel(itemsById.get(r.stock_item_id)?.usage_unit)} ${itemsById.get(r.stock_item_id)?.name || ''}`).join(' · ')}`
                                            : 'ไม่ตัดสต๊อกเพิ่ม'}
                                    </p>
                                )}
                                {rows.map(r => {
                                    const it = itemsById.get(r.stock_item_id);
                                    return (
                                        <div key={r.key} className="flex items-center gap-1.5">
                                            <button type="button"
                                                onClick={() => updateDraft(c.id, cur => cur.map(x => x.key === r.key ? { ...x, sign: x.sign === 'plus' ? 'minus' : 'plus' } : x))}
                                                className={`h-8 w-8 border ${RULE} text-sm font-semibold ${r.sign === 'minus' ? ACCENT : INK}`}
                                                title="สลับเพิ่ม / ลด">
                                                {r.sign === 'minus' ? '−' : '+'}
                                            </button>
                                            <input
                                                type="number" inputMode="decimal" min="0"
                                                value={r.amount}
                                                onChange={e => updateDraft(c.id, cur => cur.map(x => x.key === r.key ? { ...x, amount: e.target.value } : x))}
                                                className={`h-8 w-20 px-2 border ${RULE} bg-[var(--color-paper)] text-right text-sm tabular-nums`}
                                                aria-label={`จำนวน ${it?.name || ''}`}
                                            />
                                            <span className={`text-xs ${MUTED} w-14 truncate`}>{unitLabel(it?.usage_unit)}</span>
                                            <span className={`flex-1 min-w-0 truncate text-sm ${INK}`}>{it?.name || 'วัตถุดิบ'}</span>
                                            <button type="button" onClick={() => updateDraft(c.id, cur => cur.filter(x => x.key !== r.key))}
                                                className={`text-xs ${NEUTRAL} hover:${ACCENT} px-1`} aria-label="ลบแถว">ลบ</button>
                                        </div>
                                    );
                                })}
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={search[c.id] || ''}
                                        onChange={e => setSearch(prev => ({ ...prev, [c.id]: e.target.value }))}
                                        placeholder={rows.length === 0 && generic.length ? '+ ตั้งค่าเฉพาะเมนูนี้ (แทนค่ากลาง)' : '+ เพิ่มวัตถุดิบ'}
                                        className={`h-8 w-full px-2 border border-dashed ${RULE} bg-transparent text-xs`}
                                    />
                                    {matches.length > 0 && (
                                        <ul className={`absolute z-20 left-0 right-0 mt-1 border ${RULE} bg-[var(--color-paper)] shadow-[0_8px_24px_oklch(21.78%_0_0/0.10)]`}>
                                            {matches.map(i => (
                                                <li key={i.id}>
                                                    <button type="button"
                                                        onClick={() => {
                                                            updateDraft(c.id, cur => [...cur, { key: key(), id: null, stock_item_id: i.id, menu_item_id: menuId, sign: 'plus', amount: '' }]);
                                                            setSearch(prev => ({ ...prev, [c.id]: '' }));
                                                        }}
                                                        className={`w-full text-left px-2 py-1.5 text-sm ${INK} hover:bg-[var(--color-paper-2)]`}>
                                                        {i.name} <span className={`text-xs ${NEUTRAL}`}>{unitLabel(i.usage_unit)}</span>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}
        </section>
    );
}
