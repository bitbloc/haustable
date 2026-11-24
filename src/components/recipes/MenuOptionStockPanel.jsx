/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabaseClient';
import { displayUnit } from '../../utils/stockCount';
import {
    parseOptionAmountInput,
    planChoiceIngredientSave,
    signedQuantity,
    stepOptionAmount,
    validateChoiceIngredients
} from '../../utils/optionIngredients';

const INK = 'text-[var(--color-ink)]';
const MUTED = 'text-[var(--color-muted)]';
const NEUTRAL = 'text-[var(--color-neutral)]';
const RULE = 'border-[var(--color-rule)]';
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)]';

// How many search results a choice shows before asking for a narrower term
const STOCK_RESULTS = 6;
const MENU_RESULTS = 3;

const unitLabel = (u) => displayUnit(u);
const fmt = (n) => Number(Number(n).toFixed(2)).toLocaleString('th-TH', { maximumFractionDigits: 2 });
const baht = (n) => Math.abs(Number(n)).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let seq = 0;
const key = () => `opt_${++seq}`;

/**
 * Stock rules of this menu's options, on the recipe page itself:
 *   sweetness groups: the multiplier of each level, which recipe ingredients are sweeteners,
 *                     and what each level deducts;
 *   other groups (hot/iced, add shot...): what each choice adds or removes for THIS menu.
 * Menu-specific rows replace the "every menu" rows of a choice (stock_requirements_for_sale).
 *
 * Reading order on screen, each level with its own surface so they never run together:
 *   section head (ink rule) > group (tinted band) > choice (left cell) > its stock rules (right cell).
 *
 * The parent's save button also saves what is still unsaved here (ref: validate / saveAll).
 */
const MenuOptionStockPanel = forwardRef(function MenuOptionStockPanel({ menuId, stockItems = [], recipe = [], unitCostOf = null, onSweetenerChanged }, ref) {
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [groups, setGroups] = useState([]);
    const [existing, setExisting] = useState([]);   // option_choice_ingredients rows for these choices
    const [allMenus, setAllMenus] = useState([]);
    const [drafts, setDrafts] = useState({});       // choiceId -> [{ key, id, stock_item_id, linked_menu_item_id, sign, amount }]
    const [dirty, setDirty] = useState({});
    const [saving, setSaving] = useState(null);
    const [search, setSearch] = useState({});       // choiceId -> text
    const [rowErrors, setRowErrors] = useState({}); // row.key -> message

    const itemsById = useMemo(() => new Map(stockItems.map(i => [i.id, i])), [stockItems]);
    const menusById = useMemo(() => new Map(allMenus.map(m => [Number(m.id), m])), [allMenus]);

    const draftFromRows = useCallback((rows, choiceId) => (rows || [])
        .filter(r => r.choice_id === choiceId && String(r.menu_item_id) === String(menuId))
        .map(r => ({
            key: key(), id: r.id, stock_item_id: r.stock_item_id || '', linked_menu_item_id: r.linked_menu_item_id ?? null, menu_item_id: menuId,
            sign: Number(r.quantity) < 0 ? 'minus' : 'plus', amount: String(Math.abs(Number(r.quantity)))
        })), [menuId]);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(false);
        try {
            const { data: links, error: linkErr } = await supabase.from('menu_item_options').select('option_group_id').eq('menu_item_id', menuId);
            if (linkErr) throw linkErr;
            const groupIds = [...new Set((links || []).map(l => l.option_group_id).filter(Boolean))];
            if (!groupIds.length) { setGroups([]); setExisting([]); setDrafts({}); setDirty({}); setRowErrors({}); return; }
            const [{ data: gs, error: groupErr }, { data: menuList, error: menuErr }] = await Promise.all([
                supabase.from('option_groups').select('id, name, option_choices (*)').in('id', groupIds),
                supabase.from('menu_items').select('id, name, category').order('name')
            ]);
            if (groupErr) throw groupErr;
            if (menuErr) throw menuErr;
            setAllMenus(menuList || []);
            const choiceIds = (gs || []).flatMap(g => (g.option_choices || []).map(c => c.id));
            const { data: rows, error: rowErr } = choiceIds.length
                ? await supabase.from('option_choice_ingredients').select('*').in('choice_id', choiceIds)
                : { data: [], error: null };
            if (rowErr) throw rowErr;
            const sorted = (gs || []).map(g => ({
                ...g,
                option_choices: [...(g.option_choices || [])].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
            }));
            setGroups(sorted);
            setExisting(rows || []);
            const d = {};
            for (const c of sorted.flatMap(g => g.option_choices)) d[c.id] = draftFromRows(rows, c.id);
            setDrafts(d);
            setDirty({});
            setRowErrors({});
        } catch (err) {
            console.error(err);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [menuId, draftFromRows]);

    useEffect(() => { if (menuId) load(); }, [menuId, load]);

    const isSweetGroup = (g) => g.option_choices.some(c => c.sweetener_factor !== null && c.sweetener_factor !== undefined);
    const sweetGroups = groups.filter(isSweetGroup);
    const otherGroups = groups.filter(g => !isSweetGroup(g));
    const allChoices = useMemo(() => groups.flatMap(g => g.option_choices), [groups]);

    // Recipe lines with their stock item, for the sweetener list and previews
    const recipeLines = useMemo(() => recipe
        .map(r => ({ ...r, item: itemsById.get(r.ingredientId) || r.ingredient }))
        .filter(r => r.item), [recipe, itemsById]);

    const toggleSweetener = async (item) => {
        const next = !item.is_sweetener;
        // Saved at once and for every menu that uses the item: ask before it changes
        const question = next
            ? `นับ "${item.name}" เป็นสารให้ความหวาน?\n\nมีผลทันทีกับทุกเมนูที่ใช้วัตถุดิบนี้ ปริมาณที่ตัดสต๊อกจะคูณตามระดับความหวานที่ลูกค้าเลือก (ไม่หวาน = ไม่ตัดเลย)`
            : `เลิกนับ "${item.name}" เป็นสารให้ความหวาน?\n\nมีผลทันทีกับทุกเมนูที่ใช้วัตถุดิบนี้ ปริมาณที่ตัดสต๊อกจะเท่าสูตรเสมอ`;
        if (!window.confirm(question)) return;
        const { error } = await supabase.from('stock_items').update({ is_sweetener: next }).eq('id', item.id);
        if (error) { toast.error('บันทึกไม่สำเร็จ: ' + error.message); return; }
        onSweetenerChanged?.(item.id, next);
        toast.success(next ? `${item.name} เป็นสารให้ความหวานแล้ว (ทุกเมนู)` : `${item.name} ไม่นับเป็นสารให้ความหวานแล้ว (ทุกเมนู)`);
    };

    // Always from the latest rows, so quick edits (sign, then amount) never overwrite each other
    const updateDraft = (choiceId, change, clearKey = null) => {
        setDrafts(prev => ({ ...prev, [choiceId]: change(prev[choiceId] || []) }));
        setDirty(prev => ({ ...prev, [choiceId]: true }));
        if (clearKey) {
            setRowErrors(prev => {
                if (!prev[clearKey]) return prev;
                const next = { ...prev };
                delete next[clearKey];
                return next;
            });
        }
    };

    // Checks one choice's rows and shows what is wrong on the rows themselves
    const checkChoice = (choice) => {
        const draftRows = (drafts[choice.id] || []).map(r => ({ ...r, menu_item_id: menuId }));
        const { rows, errors } = validateChoiceIngredients(draftRows);
        setRowErrors(prev => {
            const next = { ...prev };
            for (const r of draftRows) delete next[r.key];
            return { ...next, ...errors };
        });
        return { rows, errors };
    };

    const writeChoice = async (choice, rows) => {
        const mine = existing.filter(r => r.choice_id === choice.id && String(r.menu_item_id) === String(menuId));
        const plan = planChoiceIngredientSave(choice.id, mine, rows);
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
    };

    // After a save: fresh rows from the database for the saved choices only, so edits still
    // open on the other choices stay as typed.
    const refreshSaved = async (savedIds) => {
        const choiceIds = allChoices.map(c => c.id);
        if (!choiceIds.length || !savedIds.length) return;
        const { data: rows, error } = await supabase.from('option_choice_ingredients').select('*').in('choice_id', choiceIds);
        if (error) return;
        setExisting(rows || []);
        setDrafts(prev => {
            const next = { ...prev };
            for (const id of savedIds) next[id] = draftFromRows(rows, id);
            return next;
        });
        setDirty(prev => {
            const next = { ...prev };
            for (const id of savedIds) delete next[id];
            return next;
        });
    };

    const saveChoice = async (choice) => {
        const { rows, errors } = checkChoice(choice);
        if (Object.keys(errors).length) { toast.error(Object.values(errors)[0]); return; }
        setSaving(choice.id);
        try {
            await writeChoice(choice, rows);
            toast.success(`บันทึก "${choice.name}" ของเมนูนี้แล้ว`);
            await refreshSaved([choice.id]);
        } catch (err) {
            toast.error('บันทึกไม่สำเร็จ: ' + err.message);
        } finally {
            setSaving(null);
        }
    };

    useImperativeHandle(ref, () => ({
        hasUnsaved: () => allChoices.some(c => dirty[c.id]),
        // Call before the recipe is written: nothing is saved while a row is incomplete
        validate: () => {
            for (const c of allChoices.filter(x => dirty[x.id])) {
                const { errors } = checkChoice(c);
                if (Object.keys(errors).length) {
                    toast.error(`ตัวเลือก "${c.name}": ${Object.values(errors)[0]}`);
                    return false;
                }
            }
            return true;
        },
        // Writes every choice still unsaved. Resolves false when one of them could not be saved.
        saveAll: async () => {
            const pending = allChoices.filter(c => dirty[c.id]);
            if (!pending.length) return true;
            const saved = [];
            let ok = true;
            for (const c of pending) {
                const { rows, errors } = checkChoice(c);
                if (Object.keys(errors).length) { ok = false; toast.error(`ตัวเลือก "${c.name}": ${Object.values(errors)[0]}`); continue; }
                try {
                    await writeChoice(c, rows);
                    saved.push(c.id);
                } catch (err) {
                    ok = false;
                    toast.error(`บันทึกตัวเลือก "${c.name}" ไม่สำเร็จ: ${err.message}`);
                }
            }
            await refreshSaved(saved);
            return ok;
        }
    }));

    const head = (
        <header className="pb-3 border-b border-[var(--color-ink)]">
            <h3 id="option-stock-title" className={`text-base font-semibold leading-6 ${INK}`}>ตัวเลือกที่มีผลกับสต๊อก</h3>
            <p className={`text-[13px] leading-5 ${NEUTRAL}`}>คิดจากสูตรด้านบน แล้วปรับตามตัวเลือกที่ลูกค้าเลือก</p>
        </header>
    );

    if (loading) return <div className={`text-[13px] leading-5 ${NEUTRAL} py-3`}>กำลังโหลดตัวเลือก…</div>;
    if (loadError) {
        return (
            <section aria-labelledby="option-stock-title">
                {head}
                <div className="py-3 flex flex-wrap items-center gap-3">
                    <p className={`text-sm leading-6 ${INK}`}>โหลดตัวเลือกของเมนูนี้ไม่สำเร็จ</p>
                    <button type="button" onClick={load} className="admin-btn h-9">ลองใหม่</button>
                </div>
            </section>
        );
    }
    if (!groups.length) {
        return (
            <section aria-labelledby="option-stock-title">
                {head}
                <p className={`py-3 text-[13px] leading-5 ${NEUTRAL}`}>เมนูนี้ยังไม่ได้ผูกกลุ่มตัวเลือก (เช่น ร้อน/เย็น ระดับความหวาน) ผูกได้ที่หน้าแก้ไขเมนู</p>
            </section>
        );
    }

    const sweetenerLines = recipeLines.filter(r => r.item.is_sweetener);
    const band = `px-3 py-2.5 bg-[var(--color-paper-2)] border-b ${RULE}`;

    return (
        <section aria-labelledby="option-stock-title" className="@container/panel">
            {head}

            {otherGroups.length > 0 && (
                <dl className={`py-2.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[13px] leading-5 ${NEUTRAL}`}>
                    <dt className={`font-semibold ${INK}`}>ใช้เพิ่ม</dt>
                    <dd>ตัดสต๊อกเพิ่มจากสูตร</dd>
                    <dt className={`font-semibold ${INK}`}>ใช้น้อยลง</dt>
                    <dd>หักออกจากสูตรหลัก (กรอกทศนิยมได้ เช่น 0.5)</dd>
                </dl>
            )}

            <div className={`border ${RULE} bg-[var(--color-paper)] ${otherGroups.length > 0 ? '' : 'mt-3'}`}>
                {/* Sweetness */}
                {sweetGroups.map(g => (
                    <div key={g.id} className={`border-b ${RULE} last:border-b-0`}>
                        <div className={band}>
                            <div className={`text-sm font-semibold leading-6 ${INK}`}>{g.name}</div>
                            <p className={`text-[13px] leading-5 ${NEUTRAL}`}>ตั้งที่นี่ที่เดียว ใช้ทั้งตัดสต๊อกตอนขายและสูตรที่บาร์เห็น (สูตรบาร์ที่ผูกกับเมนูนี้)</p>
                        </div>
                        <div className="px-3 py-3 space-y-3">
                            <div>
                                <div className={`text-[13px] leading-5 ${MUTED} mb-1.5`}>วัตถุดิบในสูตรที่นับเป็นสารให้ความหวาน (มีผลทุกเมนูที่ใช้)</div>
                                {recipeLines.length === 0 ? (
                                    <p className={`text-[13px] leading-5 ${NEUTRAL}`}>ยังไม่มีวัตถุดิบในสูตร</p>
                                ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                        {recipeLines.map(r => (
                                            <button
                                                key={r.id}
                                                type="button"
                                                onClick={() => toggleSweetener(r.item)}
                                                aria-pressed={!!r.item.is_sweetener}
                                                className={`min-h-9 px-3 border text-[13px] leading-5 cursor-pointer transition-colors ${FOCUS} ${r.item.is_sweetener ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]' : `${RULE} ${MUTED} hover:border-[var(--color-ink)]`}`}
                                            >
                                                {r.item.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <table className="w-full text-[13px] leading-5 tabular-nums">
                                <thead>
                                    <tr className={NEUTRAL}>
                                        <th className="text-left font-normal py-1.5">ระดับ</th>
                                        <th className="text-right font-normal py-1.5">ตัวคูณ</th>
                                        <th className="text-right font-normal py-1.5">ตัดสต๊อกสารให้ความหวาน</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {g.option_choices.map(c => {
                                        const f = c.sweetener_factor === null || c.sweetener_factor === undefined ? null : Number(c.sweetener_factor);
                                        return (
                                            <tr key={c.id} className={`border-t ${RULE} align-top`}>
                                                <td className={`py-2 font-medium ${INK}`}>{c.name}</td>
                                                <td className={`py-2 text-right ${f === null ? NEUTRAL : INK}`}>{f === null ? 'ไม่ปรับ' : `×${f}`}</td>
                                                <td className={`py-2 text-right ${MUTED}`}>
                                                    {sweetenerLines.length === 0
                                                        ? <span className={NEUTRAL}>เลือกสารให้ความหวานด้านบน</span>
                                                        : sweetenerLines.map(r => (
                                                            <span key={r.id} className="block">
                                                                {r.item.name} {fmt(Number(r.quantity) * (f ?? 1))} {unitLabel(r.item.usage_unit)}
                                                            </span>
                                                        ))}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <div className={`text-[13px] leading-5 ${NEUTRAL}`}>
                                <p>แก้ตัวคูณได้ที่ Modifiers &amp; Options</p>
                                <p>ปริมาณที่ตัวเลือกอื่นเพิ่ม (เช่น เย็น) ถูกคูณด้วย</p>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Other options: per-menu adds / removes */}
                {otherGroups.map(g => (
                    <div key={g.id} className={`border-b ${RULE} last:border-b-0`}>
                        <div className={band}>
                            <div className={`text-sm font-semibold leading-6 ${INK}`}>{g.name}</div>
                        </div>
                        <div className="divide-y divide-[var(--color-rule)]">
                            {g.option_choices.map(c => {
                                const rows = drafts[c.id] || [];
                                const generic = existing.filter(r => r.choice_id === c.id && r.menu_item_id === null);
                                const q = (search[c.id] || '').trim().toLowerCase();
                                const usedStock = new Set(rows.map(r => r.stock_item_id).filter(Boolean));
                                const usedMenus = new Set(rows.map(r => r.linked_menu_item_id).filter(v => v !== null && v !== undefined && v !== '').map(Number));
                                const stockAll = q ? stockItems.filter(i => !usedStock.has(i.id) && String(i.name || '').toLowerCase().includes(q)) : [];
                                const menuAll = q ? allMenus.filter(m => !usedMenus.has(Number(m.id)) && String(m.name || '').toLowerCase().includes(q) && String(m.id) !== String(menuId)) : [];
                                const stockMatches = stockAll.slice(0, STOCK_RESULTS);
                                const menuMatches = menuAll.slice(0, MENU_RESULTS);
                                const hiddenMatches = (stockAll.length - stockMatches.length) + (menuAll.length - menuMatches.length);
                                const searchId = `option-add-${c.id}`;
                                return (
                                    <div key={c.id} className="@3xl/panel:grid @3xl/panel:grid-cols-[15rem_minmax(0,1fr)] @3xl/panel:divide-x @3xl/panel:divide-[var(--color-rule)]">
                                        {/* The choice */}
                                        <div className="px-3 pt-3 @3xl/panel:py-3 flex @3xl/panel:flex-col items-start justify-between @3xl/panel:justify-start gap-2">
                                            <div className="min-w-0">
                                                <div className={`text-sm font-medium leading-6 break-words ${INK}`}>{c.name}</div>
                                                {dirty[c.id] && (
                                                    <p className="text-[13px] leading-5 font-medium text-[var(--brand-plum)]" role="status">ยังไม่ได้บันทึก</p>
                                                )}
                                            </div>
                                            {dirty[c.id] && (
                                                <button type="button" disabled={saving === c.id} onClick={() => saveChoice(c)}
                                                    className="admin-btn h-9 shrink-0">
                                                    {saving === c.id ? 'กำลังบันทึก…' : 'บันทึก'}
                                                </button>
                                            )}
                                        </div>

                                        {/* What the choice does to stock */}
                                        <div className="@container/rules px-3 pb-3 pt-1 @3xl/panel:pt-3">
                                            <div className={`pl-3 border-l ${RULE} @3xl/panel:pl-0 @3xl/panel:border-l-0 space-y-2`}>
                                                {rows.length === 0 && (
                                                    generic.length ? (
                                                        <div className={`text-[13px] leading-5 ${MUTED}`}>
                                                            <div className={`font-medium ${INK}`}>ใช้ค่ากลางทุกเมนู</div>
                                                            {generic.map(r => {
                                                                const sign = Number(r.quantity) > 0 ? '+' : '−';
                                                                if (r.linked_menu_item_id != null) {
                                                                    const m = menusById.get(Number(r.linked_menu_item_id));
                                                                    return <div key={r.id} className="tabular-nums">{sign}{fmt(Math.abs(r.quantity))} ที่ สูตรเมนู: {m?.name || `#${r.linked_menu_item_id}`}</div>;
                                                                }
                                                                const it = itemsById.get(r.stock_item_id);
                                                                return <div key={r.id} className="tabular-nums">{sign}{fmt(Math.abs(r.quantity))} {unitLabel(it?.usage_unit)} {it?.name || ''}</div>;
                                                            })}
                                                        </div>
                                                    ) : Number(c.price_modifier) > 0 ? (
                                                        <p className="text-[13px] leading-6 font-medium text-[var(--brand-plum)]">
                                                            คิดเงินเพิ่ม <span className="tabular-nums">฿{fmt(c.price_modifier)}</span> แต่ยังไม่ตัดสต๊อก
                                                        </p>
                                                    ) : (
                                                        <p className={`text-[13px] leading-6 ${NEUTRAL}`}>ไม่ตัดสต๊อกเพิ่ม</p>
                                                    )
                                                )}

                                                {rows.length > 0 && (
                                                    <div className="divide-y divide-[var(--color-rule)]">
                                                        {rows.map(r => {
                                                            const isLinkedMenu = r.linked_menu_item_id !== null && r.linked_menu_item_id !== undefined && r.linked_menu_item_id !== '';
                                                            const linkedMenu = isLinkedMenu ? menusById.get(Number(r.linked_menu_item_id)) : null;
                                                            const it = !isLinkedMenu ? itemsById.get(r.stock_item_id) : null;
                                                            const unit = isLinkedMenu ? 'ที่' : unitLabel(it?.usage_unit || it?.unit);
                                                            const rowName = isLinkedMenu ? `สูตรเมนู: ${linkedMenu?.name || `#${r.linked_menu_item_id}`}` : (it?.name || 'วัตถุดิบ');
                                                            const err = rowErrors[r.key];
                                                            // What this row adds to (or takes off) the cost of one serving
                                                            const signed = signedQuantity(r.sign, r.amount);
                                                            const rowCost = !isLinkedMenu && unitCostOf && Number.isFinite(signed) ? unitCostOf(r.stock_item_id) * signed : null;
                                                            return (
                                                                <div key={r.key} className="py-2 first:pt-0 last:pb-0 flex flex-wrap items-center gap-x-3 gap-y-2">
                                                                    <div className={`order-1 flex-1 min-w-0 text-sm leading-6 break-words ${INK}`}>{rowName}</div>

                                                                    <div className="order-3 basis-full @2xl/rules:order-2 @2xl/rules:basis-auto flex flex-wrap items-center gap-2">
                                                                        <div
                                                                            className={`inline-flex border ${RULE} divide-x divide-[var(--color-rule)] shrink-0`}
                                                                            role="group"
                                                                            aria-label={`ทิศทางสต๊อก ${rowName}`}
                                                                        >
                                                                            {[
                                                                                ['plus', 'ใช้เพิ่ม', 'bg-[var(--color-ink)] text-[var(--color-paper)]'],
                                                                                ['minus', 'ใช้น้อยลง', 'bg-[var(--brand-plum)] text-[var(--color-paper)]']
                                                                            ].map(([value, label, activeCls]) => (
                                                                                <button
                                                                                    key={value}
                                                                                    type="button"
                                                                                    aria-pressed={r.sign === value}
                                                                                    onClick={() => updateDraft(c.id, cur => cur.map(x => x.key === r.key ? { ...x, sign: value } : x), r.key)}
                                                                                    className={`h-11 px-3 text-[13px] font-semibold whitespace-nowrap cursor-pointer touch-manipulation transition-colors ${FOCUS} ${
                                                                                        r.sign === value
                                                                                            ? activeCls
                                                                                            : `bg-[var(--color-paper)] ${MUTED} hover:bg-[var(--color-paper-2)]`
                                                                                    }`}
                                                                                >
                                                                                    {label}
                                                                                </button>
                                                                            ))}
                                                                        </div>

                                                                        <div className="flex flex-1 items-center gap-2 min-w-[11rem] @2xl/rules:flex-none">
                                                                            <div className={`flex flex-1 @2xl/rules:flex-none @2xl/rules:w-44 border ${err ? 'border-[var(--error-red)]' : RULE} divide-x divide-[var(--color-rule)] bg-[var(--color-paper)] focus-within:border-[var(--brand-plum)]`}>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => updateDraft(c.id, cur => cur.map(x => x.key === r.key ? { ...x, amount: stepOptionAmount(x.amount, -1) } : x), r.key)}
                                                                                    className={`w-11 h-11 shrink-0 flex items-center justify-center text-lg font-semibold leading-none ${INK} bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)] active:bg-[var(--color-paper-3)] cursor-pointer touch-manipulation ${FOCUS}`}
                                                                                    aria-label={`ลดจำนวน ${rowName} 1`}
                                                                                >
                                                                                    −
                                                                                </button>
                                                                                <input
                                                                                    type="text"
                                                                                    inputMode="decimal"
                                                                                    autoComplete="off"
                                                                                    value={r.amount}
                                                                                    placeholder="0"
                                                                                    onChange={e => {
                                                                                        const parsed = parseOptionAmountInput(e.target.value, r.sign);
                                                                                        updateDraft(c.id, cur => cur.map(x => x.key === r.key ? { ...x, sign: parsed.sign, amount: parsed.amount } : x), r.key);
                                                                                    }}
                                                                                    className={`flex-1 min-w-[52px] w-full h-11 px-2 bg-transparent text-center text-base font-medium tabular-nums ${INK} outline-none`}
                                                                                    aria-label={`จำนวน ${rowName} (${unit})`}
                                                                                />
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => updateDraft(c.id, cur => cur.map(x => x.key === r.key ? { ...x, amount: stepOptionAmount(x.amount, 1) } : x), r.key)}
                                                                                    className={`w-11 h-11 shrink-0 flex items-center justify-center text-lg font-semibold leading-none ${INK} bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)] active:bg-[var(--color-paper-3)] cursor-pointer touch-manipulation ${FOCUS}`}
                                                                                    aria-label={`เพิ่มจำนวน ${rowName} 1`}
                                                                                >
                                                                                    +
                                                                                </button>
                                                                            </div>
                                                                            <span className={`w-12 shrink-0 text-[13px] leading-5 ${NEUTRAL}`}>{unit}</span>
                                                                            {rowCost !== null && rowCost !== 0 && (
                                                                                <span className={`w-16 shrink-0 text-right text-[13px] leading-5 font-semibold tabular-nums ${INK}`} title="ต้นทุนที่ตัวเลือกนี้เพิ่มหรือลดต่อ 1 ที่">
                                                                                    {rowCost < 0 ? '−' : '+'}฿{baht(rowCost)}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => updateDraft(c.id, cur => cur.filter(x => x.key !== r.key), r.key)}
                                                                        className={`order-2 @2xl/rules:order-3 shrink-0 min-h-11 px-2 -mr-2 text-[13px] ${NEUTRAL} hover:text-[var(--error-red)] cursor-pointer touch-manipulation ${FOCUS}`}
                                                                        aria-label={`ลบ ${rowName}`}
                                                                    >
                                                                        ลบ
                                                                    </button>

                                                                    {err && (
                                                                        <p className="order-4 basis-full text-[13px] text-[var(--error-red)] leading-5" role="alert">{err}</p>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                <div className="relative max-w-md">
                                                    <label htmlFor={searchId} className="sr-only">เพิ่มวัตถุดิบหรือเมนูขายให้ตัวเลือก {c.name}</label>
                                                    <input
                                                        id={searchId}
                                                        type="text"
                                                        value={search[c.id] || ''}
                                                        onChange={e => setSearch(prev => ({ ...prev, [c.id]: e.target.value }))}
                                                        placeholder={rows.length === 0 && generic.length ? '+ ตั้งค่าเฉพาะเมนูนี้ (แทนค่ากลาง)' : '+ เพิ่มวัตถุดิบ หรือ พิมพ์ชื่อเมนูขาย'}
                                                        className={`h-11 w-full px-3 border ${RULE} bg-[var(--color-paper)] text-base @3xl/panel:text-sm ${INK} placeholder:text-[var(--color-neutral)] outline-none focus:border-[var(--brand-plum)]`}
                                                    />
                                                    {(stockMatches.length > 0 || menuMatches.length > 0) && (
                                                        <ul className="absolute z-20 left-0 right-0 mt-1 border border-[var(--color-ink)] bg-[var(--color-paper)] divide-y divide-[var(--color-rule)]">
                                                            {stockMatches.map(i => (
                                                                <li key={i.id}>
                                                                    <button type="button"
                                                                        onClick={() => {
                                                                            updateDraft(c.id, cur => [...cur, { key: key(), id: null, stock_item_id: i.id, linked_menu_item_id: null, menu_item_id: menuId, sign: 'plus', amount: '' }]);
                                                                            setSearch(prev => ({ ...prev, [c.id]: '' }));
                                                                        }}
                                                                        className={`w-full min-h-11 text-left px-3 py-2.5 flex items-baseline justify-between gap-2 text-sm ${INK} hover:bg-[var(--color-paper-2)] cursor-pointer ${FOCUS}`}>
                                                                        <span className="break-words">{i.name}</span>
                                                                        <span className={`text-[13px] shrink-0 ${NEUTRAL}`}>{unitLabel(i.usage_unit || i.unit)}</span>
                                                                    </button>
                                                                </li>
                                                            ))}
                                                            {menuMatches.map(m => (
                                                                <li key={`menu_${m.id}`}>
                                                                    <button type="button"
                                                                        onClick={() => {
                                                                            updateDraft(c.id, cur => [...cur, { key: key(), id: null, stock_item_id: '', linked_menu_item_id: Number(m.id), menu_item_id: menuId, sign: 'plus', amount: '1' }]);
                                                                            setSearch(prev => ({ ...prev, [c.id]: '' }));
                                                                        }}
                                                                        className={`w-full min-h-11 text-left px-3 py-2.5 flex items-baseline justify-between gap-2 text-sm ${INK} hover:bg-[var(--color-paper-2)] cursor-pointer ${FOCUS}`}>
                                                                        <span className="break-words font-semibold">สูตรเมนู: {m.name}</span>
                                                                        <span className="text-[13px] shrink-0 text-[var(--brand-plum)] font-semibold">เมนูขาย (ที่)</span>
                                                                    </button>
                                                                </li>
                                                            ))}
                                                            {hiddenMatches > 0 && (
                                                                <li className={`px-3 py-2 text-[13px] leading-5 ${NEUTRAL}`}>อีก {hiddenMatches} รายการ พิมพ์ชื่อเพิ่มเพื่อค้นให้แคบลง</li>
                                                            )}
                                                        </ul>
                                                    )}
                                                    {q && stockMatches.length === 0 && menuMatches.length === 0 && (
                                                        <p className={`mt-1 text-[13px] leading-5 ${NEUTRAL}`}>ไม่พบ “{search[c.id].trim()}” ในคลังวัตถุดิบหรือเมนูขาย</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
});

export default MenuOptionStockPanel;
