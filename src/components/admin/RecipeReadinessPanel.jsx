/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Ledger panel · theme: Thai Modern OKLCH */
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabaseClient';
import { logStaffActivity } from '../../utils/auditLogger';
import { suggestRecipesForMenu, summarizeReadiness, unitsSoldByMenu } from '../../utils/recipeReadiness';

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
        <section className="border border-[oklch(85%_0.012_28)] bg-white" aria-labelledby="readiness-title">
            {/* Header cells */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] divide-y sm:divide-y-0 sm:divide-x divide-[oklch(85%_0.012_28)]">
                <div className="p-4 space-y-1">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] block">
                        STOCK READINESS
                    </span>
                    <h2 id="readiness-title" className="font-sans font-bold text-base leading-7 text-[oklch(18%_0.012_28)]">
                        ความพร้อมตัดสต๊อกจากยอดขาย
                    </h2>
                    <p className="font-sans text-[12px] leading-5 text-[oklch(42%_0.010_28)] max-w-prose">
                        ยอดขาย {DAYS} วันล่าสุดที่เมนูมีสูตรแล้ว เมนูที่ยังไม่มีสูตรจะยังตัดสต๊อกไม่ได้ เรียงจากขายดีที่สุด{' '}
                        <a href="/manuals/recipe_entry_guide.html" target="_blank" rel="noopener noreferrer" className="font-bold text-[oklch(18%_0.012_28)] underline underline-offset-2 whitespace-nowrap">
                            คู่มือการลงสูตร
                        </a>
                    </p>
                </div>
                <div className="p-4 sm:min-w-[13rem] flex sm:flex-col justify-between sm:justify-center items-baseline sm:items-end gap-1 bg-[oklch(98%_0.004_28)]">
                    <span className="font-mono font-bold text-3xl tabular-nums leading-none text-[oklch(18%_0.012_28)]">
                        {sales ? `${pct.toFixed(1)}%` : '—'}
                    </span>
                    <span className="font-sans text-[12px] leading-5 text-[oklch(42%_0.010_28)] whitespace-nowrap">
                        {sales
                            ? <><span className="font-mono tabular-nums">{summary.coveredUnits.toLocaleString()}</span> จาก <span className="font-mono tabular-nums">{summary.totalUnits.toLocaleString()}</span> ที่ขายได้</>
                            : (error ? 'โหลดยอดขายไม่สำเร็จ' : 'กำลังโหลด...')}
                    </span>
                </div>
            </div>

            {/* Coverage bar */}
            <div className="h-1 bg-[oklch(94%_0.010_28)]" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="สัดส่วนยอดขายที่มีสูตร">
                <div className="h-full bg-[oklch(18%_0.012_28)] transition-[width] duration-300" style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>

            {/* Missing list */}
            {sales && rows.length === 0 && (
                <p className="p-4 font-sans text-[13px] leading-6 text-[oklch(42%_0.010_28)] border-t border-[oklch(85%_0.012_28)]">
                    ทุกเมนูที่ขายใน {DAYS} วันมีสูตรแล้ว
                </p>
            )}

            {rows.length > 0 && (
                <ol className="border-t border-[oklch(85%_0.012_28)] divide-y divide-[oklch(90%_0.008_28)]">
                    {visible.map((item, idx) => (
                        <li key={item.id} className="grid grid-cols-[2rem_1fr_auto] sm:grid-cols-[2.5rem_1fr_4.5rem_13rem] lg:grid-cols-[2.5rem_1fr_5rem_20rem] gap-x-3 gap-y-2 px-4 py-2.5 items-center">
                            <span className="font-mono text-[11px] tabular-nums text-[oklch(55%_0.010_28)]">
                                {String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className="font-sans font-bold text-[13px] leading-6 text-[oklch(18%_0.012_28)] min-w-0 break-words">
                                {item.name}
                            </span>
                            <span className="font-mono text-[12px] tabular-nums text-right text-[oklch(42%_0.010_28)] whitespace-nowrap">
                                {item.unitsSold.toLocaleString()}<span className="font-sans text-[11px]"> ที่</span>
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
                                            className="px-2 py-1 border border-[oklch(18%_0.012_28)] bg-white font-sans text-[12px] leading-5 font-bold text-[oklch(18%_0.012_28)] hover:bg-[oklch(94%_0.010_28)] disabled:opacity-40 transition-colors cursor-pointer max-w-full text-left"
                                        >
                                            {busy ? 'กำลังผูก...' : <>ผูก <span className="font-normal">{recipe.name}</span></>}
                                        </button>
                                    );
                                })}
                                <button
                                    type="button"
                                    onClick={() => onOpenRecipe?.(item)}
                                    className="px-2 py-1 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] font-sans text-[12px] leading-5 font-bold text-[oklch(42%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] transition-colors cursor-pointer whitespace-nowrap"
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
                    className="w-full py-2.5 border-t border-[oklch(85%_0.012_28)] bg-[oklch(98%_0.004_28)] font-sans text-[12px] leading-5 font-bold text-[oklch(42%_0.010_28)] hover:bg-[oklch(94%_0.010_28)] transition-colors cursor-pointer"
                >
                    {expanded ? 'แสดงน้อยลง' : `แสดงทั้งหมด ${rows.length} เมนู`}
                </button>
            )}
        </section>
    );
}
