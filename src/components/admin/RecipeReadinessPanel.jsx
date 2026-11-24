/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Ledger panel · theme: Thai Modern OKLCH */
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabaseClient';
import { logStaffActivity } from '../../utils/auditLogger';
import { suggestRecipesForMenu, summarizeReadiness, unitsSoldByMenu } from '../../utils/recipeReadiness';
import { recomputeAllShadow } from '../../utils/stockShadowRecompute';

const DAYS = 30;
const PAGE = 1000;
const MAX_PAGES = 20;
const COLLAPSED_ROWS = 8;

const loadRecentSales = async () => {
    const since = new Date(Date.now() - DAYS * 864e5).toISOString();
    const rows = [];
    for (let page = 0; page < MAX_PAGES; page++) {
        const { data, error } = await supabase
            .from('order_items')
            .select('menu_item_id, quantity, is_custom')
            .gte('created_at', since)
            .order('id', { ascending: true })
            .range(page * PAGE, page * PAGE + PAGE - 1);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < PAGE) break;
    }
    return rows;
};

const loadRecipeItems = async () => {
    const { data, error } = await supabase
        .from('stock_items')
        .select('id, name')
        .eq('item_type', 'recipe')
        .order('name');
    if (!error) return data || [];
    // Database without item_type yet
    const { data: legacy } = await supabase
        .from('stock_items')
        .select('id, name, category')
        .eq('is_base_recipe', true)
        .order('name');
    return (legacy || []).filter(r => !/^folder:based?$/i.test(r.category || ''));
};

/**
 * Shows how much of the last 30 days' sales already has a recipe (so it can deduct
 * stock), and lists the best-selling menus still missing one, with a one-tap link
 * to the drink recipe that probably belongs to it.
 */
export default function RecipeReadinessPanel({ menuItems = [], onOpenRecipe, onLinked }) {
    const [sales, setSales] = useState(null);
    const [recipeItems, setRecipeItems] = useState([]);
    const [error, setError] = useState(null);
    const [expanded, setExpanded] = useState(false);
    const [linkingId, setLinkingId] = useState(null);
    // Recompute of past sales: null = idle, otherwise { done, total } days
    const [recompute, setRecompute] = useState(null);

    // Sold lines keep the usage of the day they were sold; this rewrites the last 30 days
    // of every menu with the recipes and option rules as they are now.
    const handleRecomputeAll = async () => {
        if (recompute) return;
        const question = `คำนวณยอดใช้สต๊อกของบิล ${DAYS} วันที่ผ่านมาใหม่ ด้วยสูตรและตัวเลือกปัจจุบันของทุกเมนู?\n\nใช้เมื่อลงสูตรหรือแก้สูตรที่ผิดเสร็จแล้ว ถ้ามีเมนูที่เปลี่ยนสูตรจริงระหว่างเดือน บิลเก่าของเมนูนั้นจะถูกคิดด้วยสูตรใหม่ด้วย`;
        if (!window.confirm(question)) return;
        setRecompute({ done: 0, total: DAYS });
        const res = await recomputeAllShadow(DAYS, (done, total) => setRecompute({ done, total }));
        setRecompute(null);
        if (!res.ok) {
            toast.error(`คำนวณย้อนหลังหยุดที่วันที่ ${res.daysDone + 1} จาก ${res.days}: ${res.message}`, { duration: 8000 });
            return;
        }
        logStaffActivity('stock', 'shadow_recompute', {
            reason: `คำนวณยอดใช้ย้อนหลัง ${DAYS} วันใหม่ทุกเมนู`,
            metadata: { module: 'stock', days: DAYS, lines: res.lines, errors: res.errors }
        });
        if (res.errors > 0) {
            toast.warning(`คำนวณใหม่ ${res.lines.toLocaleString()} รายการขาย มี ${res.errors.toLocaleString()} รายการที่คำนวณไม่ได้`, { duration: 8000 });
        } else {
            toast.success(`คำนวณยอดใช้ใหม่ ${res.lines.toLocaleString()} รายการขายใน ${DAYS} วัน`);
        }
    };

    useEffect(() => {
        let cancelled = false;
        Promise.all([loadRecentSales(), loadRecipeItems()])
            .then(([rows, recipes]) => {
                if (cancelled) return;
                setSales(rows);
                setRecipeItems(recipes);
            })
            .catch(err => {
                console.error('RecipeReadinessPanel load error:', err);
                if (!cancelled) setError(err);
            });
        return () => { cancelled = true; };
    }, []);

    const summary = useMemo(
        () => summarizeReadiness(menuItems, unitsSoldByMenu(sales || [])),
        [menuItems, sales]
    );

    const rows = useMemo(() => summary.missing.map(item => ({
        ...item,
        suggestions: suggestRecipesForMenu(item.name, recipeItems)
    })), [summary.missing, recipeItems]);

    const visible = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);

    const handleLink = async (menu, recipe) => {
        if (linkingId) return;
        setLinkingId(`${menu.id}:${recipe.id}`);
        try {
            const { error: insErr } = await supabase.from('recipe_ingredients').insert({
                parent_menu_item_id: menu.id,
                ingredient_id: recipe.id,
                quantity: 1,
                unit: 'unit',
                layer_order: 0
            });
            if (insErr) throw insErr;
            logStaffActivity('sop', 'recipe_link_menu', {
                reason: `ผูกเมนู ${menu.name} กับสูตร ${recipe.name}`,
                metadata: { menu_item_id: menu.id, menu_name: menu.name, recipe_id: recipe.id, recipe_name: recipe.name }
            });
            toast.success(`ผูก ${menu.name} กับ ${recipe.name} แล้ว`);
            onLinked?.();
        } catch (err) {
            console.error(err);
            toast.error('ผูกสูตรไม่สำเร็จ: ' + (err?.message || 'ไม่ทราบสาเหตุ'));
        } finally {
            setLinkingId(null);
        }
    };

    const pct = summary.coveragePct;

    return (
        <section className="border border-[var(--color-rule)] bg-[var(--color-paper)]" aria-labelledby="readiness-title">
            {/* Header cells */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-rule)]">
                <div className="p-4 space-y-1">
                    <h2 id="readiness-title" className="font-sans font-bold text-base leading-7 text-[var(--color-ink)]">
                        ความพร้อมตัดสต๊อกจากยอดขาย
                    </h2>
                    <p className="font-sans text-[12px] leading-5 text-[var(--color-muted)] max-w-prose">
                        ยอดขาย {DAYS} วันล่าสุดที่เมนูมีสูตรแล้ว เมนูที่ยังไม่มีสูตรจะยังตัดสต๊อกไม่ได้ เรียงจากขายดีที่สุด{' '}
                        <a href="/manuals/recipe_entry_guide.html" target="_blank" rel="noopener noreferrer" className="font-bold text-[var(--color-ink)] underline underline-offset-2 whitespace-nowrap">
                            คู่มือการลงสูตร
                        </a>
                        {' · '}
                        <a href="/manuals/recipe_stock_recon_manual.pdf" download="IN_THE_HAUS_Recipe_Stock_Manual.pdf" className="font-bold text-[var(--brand-plum)] underline underline-offset-2 whitespace-nowrap">
                            ดาวน์โหลด PDF
                        </a>
                    </p>
                </div>
                <div className="p-4 sm:min-w-[13rem] flex sm:flex-col justify-between sm:justify-center items-baseline sm:items-end gap-1 bg-[var(--color-paper)]">
                    <span className=" font-bold text-3xl tabular-nums leading-none text-[var(--color-ink)]">
                        {sales ? `${pct.toFixed(1)}%` : '—'}
                    </span>
                    <span className="font-sans text-[12px] leading-5 text-[var(--color-muted)] whitespace-nowrap">
                        {sales
                            ? <><span className=" tabular-nums">{summary.coveredUnits.toLocaleString()}</span> จาก <span className=" tabular-nums">{summary.totalUnits.toLocaleString()}</span> ที่ขายได้</>
                            : (error ? 'โหลดยอดขายไม่สำเร็จ' : 'กำลังโหลด...')}
                    </span>
                </div>
            </div>

            {/* Coverage bar */}
            <div className="h-1 bg-[var(--color-paper-2)]" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="สัดส่วนยอดขายที่มีสูตร">
                <div className="h-full bg-[var(--color-ink)]" style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>

            {/* Past sales: recompute with today's recipes */}
            <div className="border-t border-[var(--color-rule)] px-4 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <p className="flex-1 min-w-[16rem] font-sans text-[13px] leading-5 text-[var(--color-muted)] text-pretty">
                    บิลที่ขายไปแล้วคิดยอดใช้ตามสูตรของวันที่ขาย ลงหรือแก้สูตรเสร็จแล้วกดคำนวณใหม่
                </p>
                <button
                    type="button"
                    onClick={handleRecomputeAll}
                    disabled={!!recompute}
                    className="admin-btn h-9"
                    aria-live="polite"
                >
                    {recompute ? `กำลังคำนวณ ${recompute.done}/${recompute.total} วัน` : `คำนวณ ${DAYS} วันย้อนหลังใหม่`}
                </button>
            </div>

            {/* Missing list */}
            {sales && rows.length === 0 && (
                <p className="p-4 font-sans text-[13px] leading-6 text-[var(--color-muted)] border-t border-[var(--color-rule)]">
                    ทุกเมนูที่ขายใน {DAYS} วันมีสูตรแล้ว
                </p>
            )}

            {rows.length > 0 && (
                <ol className="border-t border-[var(--color-rule)] divide-y divide-[var(--color-paper-3)]">
                    {visible.map((item, idx) => (
                        <li key={item.id} className="grid grid-cols-[2rem_1fr_auto] sm:grid-cols-[2.5rem_1fr_4.5rem_13rem] lg:grid-cols-[2.5rem_1fr_5rem_20rem] gap-x-3 gap-y-2 px-4 py-2.5 items-center">
                            <span className=" text-xs tabular-nums text-[var(--color-neutral)]">
                                {idx + 1}
                            </span>
                            <span className="font-sans font-bold text-[13px] leading-6 text-[var(--color-ink)] min-w-0 break-words">
                                {item.name}
                            </span>
                            <span className=" text-[12px] tabular-nums text-right text-[var(--color-muted)] whitespace-nowrap">
                                {item.unitsSold.toLocaleString()}<span className="font-sans text-xs"> ที่</span>
                            </span>
                            <div className="col-start-2 col-span-2 sm:col-start-auto sm:col-span-1 flex flex-wrap justify-start sm:justify-end gap-1.5">
                                {item.suggestions.map(recipe => {
                                    const busy = linkingId === `${item.id}:${recipe.id}`;
                                    return (
                                        <button
                                            key={recipe.id}
                                            type="button"
                                            disabled={!!linkingId}
                                            onClick={() => handleLink(item, recipe)}
                                            title={`ใช้สูตร ${recipe.name} 1 ที่ต่อการขาย 1 ที่`}
                                            className="px-2 py-1 border border-[var(--color-ink)] bg-[var(--color-paper)] font-sans text-[12px] leading-5 font-bold text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] disabled:opacity-40 transition-colors cursor-pointer max-w-full text-left focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)]"
                                        >
                                            {busy ? 'กำลังผูก...' : <>ผูก <span className="font-normal">{recipe.name}</span></>}
                                        </button>
                                    );
                                })}
                                <button
                                    type="button"
                                    onClick={() => onOpenRecipe?.(item)}
                                    className="px-2 py-1 border border-[var(--color-rule)] bg-[var(--color-paper-2)] font-sans text-[12px] leading-5 font-bold text-[var(--color-muted)] hover:bg-[var(--color-paper-3)] transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)]"
                                >
                                    สร้างสูตร
                                </button>
                            </div>
                        </li>
                    ))}
                </ol>
            )}

            {rows.length > COLLAPSED_ROWS && (
                <button
                    type="button"
                    onClick={() => setExpanded(v => !v)}
                    className="admin-btn h-9 w-full"
                >
                    {expanded ? 'แสดงน้อยลง' : `แสดงทั้งหมด ${rows.length} เมนู`}
                </button>
            )}
        </section>
    );
}
