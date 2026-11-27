/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabaseClient';
import { useMenuChoiceGroups } from '../../hooks/useMenuChoiceGroups';
import { setComponentsCost, setSaveError, stepServings, validateSetComponents } from '../../utils/setComponents';
import FixedChoiceEditor from './FixedChoiceEditor';

const INK = 'text-[var(--color-ink)]';
const MUTED = 'text-[var(--color-muted)]';
const NEUTRAL = 'text-[var(--color-neutral)]';
const RULE = 'border-[var(--color-rule)]';
// The edge of a field: 3:1 or more against the paper it sits on (the hairline is 1.4:1)
const FIELD = 'border-[var(--color-neutral)]';
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)]';

const MENU_RESULTS = 6;

const baht = (n) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let seq = 0;
const key = () => `set_${++seq}`;

const toDraft = (row) => ({
    key: key(),
    menuId: Number(row.component_menu_item_id),
    amount: String(Number(row.quantity)),
    choiceIds: row.choice_ids || []
});

/**
 * A set menu, on its recipe page: the menus it is made of and how many servings of each.
 * Selling the set deducts those menus' own recipes (stock_requirements_for_sale), so a dish
 * is still corrected in one place. A set cannot hold another set.
 *
 * The parent's save button saves this too (ref: validate / saveAll). `onChange` tells the
 * parent what the components cost, so the price simulator counts them.
 */
const MenuSetComponentsPanel = forwardRef(function MenuSetComponentsPanel({ menuId, unitCostOf = null, onChange, disabled = false }, ref) {
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [allRows, setAllRows] = useState([]);     // every menu_set_components row (a small table)
    const [allMenus, setAllMenus] = useState([]);
    const [draft, setDraft] = useState([]);
    const [dirty, setDirty] = useState(false);
    const [search, setSearch] = useState('');
    const [rowErrors, setRowErrors] = useState({});

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(false);
        try {
            const [rowRes, menuRes] = await Promise.all([
                supabase.from('menu_set_components').select('*').order('sort_order'),
                supabase.from('menu_items').select('id, name, category').order('name')
            ]);
            if (rowRes.error) throw rowRes.error;
            if (menuRes.error) throw menuRes.error;
            const rows = rowRes.data || [];
            setAllRows(rows);
            setAllMenus(menuRes.data || []);
            setDraft(rows.filter(r => String(r.set_menu_item_id) === String(menuId)).map(toDraft));
            setDirty(false);
            setRowErrors({});
        } catch (err) {
            console.error(err);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [menuId]);

    useEffect(() => { if (menuId) load(); }, [menuId, load]);

    const menusById = useMemo(() => new Map(allMenus.map(m => [Number(m.id), m])), [allMenus]);
    const setIds = useMemo(() => new Set(allRows.map(r => Number(r.set_menu_item_id))), [allRows]);
    // Sets this menu is a part of: it cannot become a set itself
    const memberOf = useMemo(() => [...new Set(allRows
        .filter(r => String(r.component_menu_item_id) === String(menuId))
        .map(r => Number(r.set_menu_item_id)))], [allRows, menuId]);

    const componentIds = useMemo(() => draft.map(d => d.menuId), [draft]);
    const detail = useMenuChoiceGroups(componentIds, { withRecipes: true });

    const cost = useMemo(() => setComponentsCost(
        draft.map(d => ({ component_menu_item_id: d.menuId, quantity: Number(String(d.amount).replace(',', '.')) || 0, choice_ids: d.choiceIds })),
        { recipeRowsByMenu: detail.recipeRowsByMenu, ruleRows: detail.ruleRows, unitCostOf: unitCostOf || (() => 0) }
    ), [draft, detail.recipeRowsByMenu, detail.ruleRows, unitCostOf]);

    useEffect(() => {
        onChange?.({ count: draft.length, cost: cost.cost, takeawayExtraCost: cost.takeawayExtraCost });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draft.length, cost.cost, cost.takeawayExtraCost]);

    const change = (next, clearKey = null) => {
        setDraft(next);
        setDirty(true);
        if (clearKey) {
            setRowErrors(prev => {
                if (!prev[clearKey]) return prev;
                const rest = { ...prev };
                delete rest[clearKey];
                return rest;
            });
        }
    };
    const patchRow = (rowKey, patch) => change(prev => prev.map(r => (r.key === rowKey ? { ...r, ...patch } : r)), rowKey);

    const check = () => {
        const { rows, errors } = validateSetComponents(draft, menuId);
        setRowErrors(errors);
        return { rows, errors };
    };

    useImperativeHandle(ref, () => ({
        hasUnsaved: () => dirty,
        // Call before the recipe is written: nothing is saved while a row is incomplete
        validate: () => {
            if (!dirty) return true;
            const { errors } = check();
            if (Object.keys(errors).length) {
                toast.error(`เมนูในเซต: ${Object.values(errors)[0]}`);
                return false;
            }
            return true;
        },
        // Resolves false when the components could not be saved
        saveAll: async () => {
            if (!dirty) return true;
            const { rows, errors } = check();
            if (Object.keys(errors).length) {
                toast.error(`เมนูในเซต: ${Object.values(errors)[0]}`);
                return false;
            }
            try {
                const { data, error } = await supabase.rpc('save_menu_set_components', { p_menu_id: menuId, p_components: rows });
                if (error) throw error;
                if (data && data.success === false) throw new Error(data.error || 'save_menu_set_components failed');
                await load();
                return true;
            } catch (err) {
                toast.error(`บันทึกเมนูในเซตไม่สำเร็จ: ${setSaveError(err.message)}`);
                return false;
            }
        }
    }));

    const header = (note) => (
        <header className="pb-3 border-b border-[var(--color-ink)]">
            <h3 id="set-components-title" className={`text-base font-semibold leading-6 ${INK}`}>เมนูในเซต</h3>
            {note && <p className={`text-[13px] leading-5 ${NEUTRAL}`}>{note}</p>}
        </header>
    );

    if (loading) return <div className={`text-[13px] leading-5 ${NEUTRAL} py-3`}>กำลังโหลดเมนูในเซต…</div>;
    if (loadError) {
        return (
            <section aria-labelledby="set-components-title">
                {header(null)}
                <div className="py-3 flex flex-wrap items-center gap-3">
                    <p className={`text-sm leading-6 ${INK}`}>โหลดเมนูในเซตไม่สำเร็จ</p>
                    <button type="button" onClick={load} className="admin-btn h-9">ลองใหม่</button>
                </div>
            </section>
        );
    }

    // A menu inside a set stays a single dish
    if (memberOf.length > 0 && draft.length === 0) {
        return (
            <section aria-labelledby="set-components-title">
                {header('เมนูนี้อยู่ในเซตด้านล่าง แก้สูตรของเมนูนี้แล้ว เซตตัดสต๊อกและคิดต้นทุนตามทันที')}
                <ul className={`mt-3 border ${RULE} bg-[var(--color-paper)] divide-y divide-[var(--color-rule)]`}>
                    {memberOf.map(id => (
                        <li key={id} className={`px-3 py-2.5 text-sm leading-6 break-words ${INK}`}>
                            {menusById.get(id)?.name || `เมนู #${id}`}
                        </li>
                    ))}
                </ul>
            </section>
        );
    }

    const q = search.trim().toLowerCase();
    const used = new Set(draft.map(d => d.menuId));
    const matchesAll = q
        ? allMenus.filter(m => String(m.id) !== String(menuId)
            && !used.has(Number(m.id))
            && !setIds.has(Number(m.id))
            && String(m.name || '').toLowerCase().includes(q))
        : [];
    const matches = matchesAll.slice(0, MENU_RESULTS);
    const setMatches = q ? allMenus.filter(m => setIds.has(Number(m.id)) && String(m.id) !== String(menuId) && String(m.name || '').toLowerCase().includes(q)).length : 0;
    const linesByMenu = new Map(cost.lines.map(l => [Number(l.menuId), l]));

    return (
        <section aria-labelledby="set-components-title" className="@container/parts">
            {header(draft.length
                ? 'ขายเซตนี้ 1 ที่ ตัดสต๊อกและคิดต้นทุนตามสูตรของเมนูในรายการ แก้สูตรที่เมนูนั้นที่เดียว'
                : 'เมนูนี้ไม่ใช่เซต ถ้าเป็นเซต เพิ่มเมนูที่อยู่ในเซตได้ที่นี่ ระบบจะตัดสต๊อกตามสูตรของเมนูเหล่านั้น')}

            {draft.length > 0 && (
                <div className={`mt-3 border ${RULE} bg-[var(--color-paper)] divide-y divide-[var(--color-rule)]`}>
                    {draft.map(row => {
                        const menu = menusById.get(row.menuId);
                        const name = menu?.name || `เมนู #${row.menuId}`;
                        const line = linesByMenu.get(row.menuId);
                        const err = rowErrors[row.key];
                        const noRecipe = !detail.loading && !detail.error && line && !line.hasRecipe;
                        return (
                            <div key={row.key} className="px-3 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                                <div className="order-1 flex-1 min-w-0">
                                    <div className={`text-sm font-medium leading-6 break-words ${INK}`}>{name}</div>
                                    {noRecipe && (
                                        <p className="text-[13px] leading-5 font-medium text-[var(--brand-plum)]">เมนูนี้ยังไม่มีสูตร จึงยังไม่ตัดสต๊อก</p>
                                    )}
                                </div>

                                <div className="order-3 basis-full @2xl/parts:order-2 @2xl/parts:basis-auto flex flex-wrap items-center gap-2">
                                    <div className={`flex flex-1 min-w-[140px] max-w-40 border ${err ? 'border-[var(--error-red)]' : FIELD} divide-x divide-[var(--color-neutral)] bg-[var(--color-paper)] focus-within:border-[var(--brand-plum)]`}>
                                        <button
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => patchRow(row.key, { amount: stepServings(row.amount, -1) })}
                                            className={`w-11 h-11 shrink-0 flex items-center justify-center text-lg font-semibold leading-none ${INK} hover:bg-[var(--color-paper-2)] active:bg-[var(--color-paper-3)] cursor-pointer touch-manipulation ${FOCUS} disabled:opacity-50 disabled:cursor-not-allowed`}
                                            aria-label={`ลดจำนวน ${name} 1 ที่`}
                                        >
                                            −
                                        </button>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            autoComplete="off"
                                            value={row.amount}
                                            placeholder="0"
                                            disabled={disabled}
                                            onChange={e => patchRow(row.key, { amount: e.target.value.replace(/[^0-9.,]/g, '') })}
                                            className={`flex-1 min-w-[52px] w-full h-11 px-2 bg-transparent text-center font-mono text-base font-medium tabular-nums ${INK} outline-none disabled:opacity-50 disabled:cursor-not-allowed`}
                                            aria-label={`จำนวน ${name} (ที่)`}
                                        />
                                        <button
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => patchRow(row.key, { amount: stepServings(row.amount, 1) })}
                                            className={`w-11 h-11 shrink-0 flex items-center justify-center text-lg font-semibold leading-none ${INK} hover:bg-[var(--color-paper-2)] active:bg-[var(--color-paper-3)] cursor-pointer touch-manipulation ${FOCUS} disabled:opacity-50 disabled:cursor-not-allowed`}
                                            aria-label={`เพิ่มจำนวน ${name} 1 ที่`}
                                        >
                                            +
                                        </button>
                                    </div>
                                    <span className={`w-6 shrink-0 text-[13px] leading-5 ${NEUTRAL}`}>ที่</span>
                                    <span className={`w-20 shrink-0 ml-auto text-right font-mono text-[13px] leading-5 font-medium tabular-nums ${INK}`} title="ต้นทุนของเมนูนี้ในเซต">
                                        {line ? `฿${baht(line.total)}` : ''}
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => change(prev => prev.filter(r => r.key !== row.key), row.key)}
                                    className={`order-2 @2xl/parts:order-3 shrink-0 w-8 min-h-11 -mr-2 text-center text-[13px] ${NEUTRAL} hover:text-[var(--error-red)] cursor-pointer touch-manipulation ${FOCUS} disabled:opacity-50 disabled:cursor-not-allowed`}
                                    aria-label={`เอา ${name} ออกจากเซต`}
                                >
                                    ลบ
                                </button>

                                <div className="order-4 basis-full empty:hidden">
                                    <FixedChoiceEditor
                                        menuName={name}
                                        groups={detail.groupsByMenu[String(row.menuId)] || []}
                                        value={row.choiceIds}
                                        loading={detail.loading}
                                        disabled={disabled}
                                        onChange={(next) => patchRow(row.key, { choiceIds: next })}
                                    />
                                </div>

                                {err && (
                                    <p className="order-5 basis-full text-[13px] text-[var(--error-red)] leading-5" role="alert">{err}</p>
                                )}
                            </div>
                        );
                    })}

                    <div className="px-3 @2xl/parts:pr-12 py-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 bg-[var(--color-paper-2)]">
                        <span className={`text-[13px] leading-5 ${MUTED}`}>
                            ต้นทุนเมนูในเซตรวม
                            {dirty && <span className="ml-2 font-medium text-[var(--brand-plum)]" role="status">ยังไม่ได้บันทึก</span>}
                        </span>
                        <span className={`font-mono text-sm leading-6 font-medium tabular-nums ${INK}`}>฿{baht(cost.cost)}</span>
                    </div>
                </div>
            )}

            <div className="relative max-w-md mt-3">
                <label htmlFor="set-component-add" className="sr-only">เพิ่มเมนูเข้าเซต</label>
                <input
                    id="set-component-add"
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    disabled={disabled}
                    placeholder="+ เพิ่มเมนูเข้าเซต"
                    className={`h-11 w-full px-3 border ${FIELD} bg-[var(--color-paper)] text-base @3xl/parts:text-sm ${INK} placeholder:text-[var(--color-neutral)] outline-none focus:border-[var(--brand-plum)] disabled:opacity-50 disabled:cursor-not-allowed`}
                />
                {matches.length > 0 && (
                    <ul className="absolute z-20 left-0 right-0 mt-1 border border-[var(--color-ink)] bg-[var(--color-paper)] divide-y divide-[var(--color-rule)]">
                        {matches.map(m => (
                            <li key={m.id}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        change(prev => [...prev, { key: key(), menuId: Number(m.id), amount: '1', choiceIds: [] }]);
                                        setSearch('');
                                    }}
                                    className={`w-full min-h-11 text-left px-3 py-2.5 flex items-baseline justify-between gap-2 text-sm ${INK} hover:bg-[var(--color-paper-2)] cursor-pointer ${FOCUS}`}
                                >
                                    <span className="break-words">{m.name}</span>
                                    <span className={`text-[13px] shrink-0 ${NEUTRAL}`}>{m.category || ''}</span>
                                </button>
                            </li>
                        ))}
                        {matchesAll.length > matches.length && (
                            <li className={`px-3 py-2 text-[13px] leading-5 ${NEUTRAL}`}>อีก {matchesAll.length - matches.length} เมนู พิมพ์ชื่อเพิ่มเพื่อค้นให้แคบลง</li>
                        )}
                    </ul>
                )}
                {q && matches.length === 0 && (
                    <p className={`mt-1 text-[13px] leading-5 ${NEUTRAL}`}>
                        {setMatches > 0 ? `“${search.trim()}” เป็นเซตอยู่แล้ว เซตซ้อนเซตไม่ได้` : `ไม่พบ “${search.trim()}” ในเมนูขาย`}
                    </p>
                )}
            </div>
        </section>
    );
});

export default MenuSetComponentsPanel;
