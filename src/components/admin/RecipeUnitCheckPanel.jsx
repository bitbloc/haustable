/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Ledger panel · theme: Thai Modern OKLCH */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabaseClient';
import { findRecipeUnitIssues } from '../../utils/recipeUnits';

const RULE = 'border-[oklch(85%_0.012_28)]';
const MUTED = 'text-[oklch(42%_0.010_28)]';
const NEUTRAL = 'text-[oklch(55%_0.010_28)]';
const fmt = (n) => String(Math.round(Number(n || 0) * 10000) / 10000);

/**
 * Recipe rows written in a unit other than the ingredient's usage unit. Costing and stock
 * deduction read the number as usage units, so 0.05 kg would count as 0.05 g.
 * Each row offers the fix that is safe: convert (kg -> g), treat 1 ml as 1 g (asked), or edit by hand.
 */
export default function RecipeUnitCheckPanel({ onOpenRecipe, onFixed }) {
    const [loading, setLoading] = useState(true);
    const [issues, setIssues] = useState([]);
    const [busy, setBusy] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        const [rows, items, menus] = await Promise.all([
            supabase.from('recipe_ingredients').select('id, parent_menu_item_id, parent_stock_item_id, ingredient_id, quantity, unit').not('ingredient_id', 'is', null),
            supabase.from('stock_items').select('id, name, usage_unit, item_type'),
            supabase.from('menu_items').select('id, name')
        ]);
        if (rows.error || items.error) {
            console.error(rows.error || items.error);
            setIssues([]);
        } else {
            setIssues(findRecipeUnitIssues(
                rows.data || [],
                new Map((items.data || []).map(i => [i.id, i])),
                new Map((menus.data || []).map(m => [m.id, m]))
            ));
        }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const applyFix = async (issue) => {
        if (busy) return;
        const label = issue.fix.kind === 'liquid'
            ? `ถือว่า 1 ${issue.from} เท่ากับ 1 ${issue.to} (ของเหลว ความหนาแน่นใกล้น้ำ)\n${issue.ingredientName} ใน ${issue.parentName}: ${fmt(issue.quantity)} ${issue.from} → ${fmt(issue.fix.quantity)} ${issue.to}`
            : `${issue.ingredientName} ใน ${issue.parentName}: ${fmt(issue.quantity)} ${issue.from} → ${fmt(issue.fix.quantity)} ${issue.to}`;
        if (!window.confirm(`แก้หน่วยในสูตร?\n\n${label}`)) return;
        setBusy(issue.rowId);
        const { error } = await supabase.from('recipe_ingredients')
            .update({ quantity: issue.fix.quantity, unit: issue.to })
            .eq('id', issue.rowId);
        setBusy(null);
        if (error) {
            toast.error('แก้ไม่สำเร็จ: ' + error.message);
            return;
        }
        toast.success(`แก้ ${issue.ingredientName} ใน ${issue.parentName} แล้ว`);
        setIssues(prev => prev.filter(i => i.rowId !== issue.rowId));
        onFixed?.();
    };

    const convertible = useMemo(() => issues.filter(i => i.fix.kind === 'convert').length, [issues]);

    if (loading) return null;
    if (issues.length === 0) {
        return (
            <p className={`border ${RULE} bg-white px-3 py-2 font-sans text-[12px] leading-5 ${NEUTRAL}`}>
                หน่วยในสูตรตรงกับหน่วยใช้ของวัตถุดิบทุกแถว
            </p>
        );
    }

    return (
        <section className={`border ${RULE} bg-white font-sans text-[oklch(18%_0.012_28)]`} aria-labelledby="recipe-unit-check">
            <div className={`px-3 py-2.5 border-b ${RULE} bg-[oklch(98%_0.004_28)]`}>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] block">UNIT CHECK</span>
                <h2 id="recipe-unit-check" className="font-bold text-[15px] leading-6">หน่วยในสูตรไม่ตรง {issues.length} แถว</h2>
                <p className={`text-[12px] leading-5 ${MUTED}`}>
                    ต้นทุนและการตัดสต๊อกอ่านตัวเลขเป็นหน่วยใช้ของวัตถุดิบ แถวเหล่านี้จึงคิดผิดจนกว่าจะแก้
                    {convertible > 0 && ` · แปลงอัตโนมัติได้ ${convertible} แถว`}
                </p>
            </div>
            <ul className="divide-y divide-[oklch(90%_0.008_28)]">
                {issues.map(i => (
                    <li key={i.rowId} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-x-4 gap-y-2 px-3 py-2.5 items-center">
                        <div className="min-w-0">
                            <p className="text-[14px] leading-6 break-words">
                                <span className="font-bold">{i.parentName}</span>
                                <span className={NEUTRAL}> · </span>
                                {i.ingredientName}
                            </p>
                            <p className={`text-[12px] leading-5 ${MUTED}`}>
                                สูตรเขียน <span className="font-mono">{fmt(i.quantity)} {i.from}</span> แต่หน่วยใช้คือ <span className="font-mono">{i.to}</span>
                                {i.fix.kind === 'convert' && <> · ควรเป็น <span className="font-mono font-bold">{fmt(i.fix.quantity)} {i.to}</span></>}
                                {i.fix.kind === 'liquid' && <> · ถ้าเป็นของเหลว ≈ <span className="font-mono font-bold">{fmt(i.fix.quantity)} {i.to}</span></>}
                                {i.fix.kind === 'manual' && <> · คนละประเภทหน่วย ต้องแก้ในสูตรเอง</>}
                            </p>
                        </div>
                        <div className="flex gap-2 sm:justify-end">
                            {i.fix.kind !== 'manual' && (
                                <button type="button" onClick={() => applyFix(i)} disabled={busy === i.rowId}
                                    className="px-3 py-1.5 border border-[oklch(18%_0.012_28)] bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] text-[13px] font-bold cursor-pointer disabled:opacity-40 whitespace-nowrap">
                                    {busy === i.rowId ? 'กำลังแก้...' : i.fix.kind === 'liquid' ? 'ใช้ 1 ml = 1 g' : 'แปลงหน่วย'}
                                </button>
                            )}
                            {onOpenRecipe && i.parentKind === 'menu' && (
                                <button type="button" onClick={() => onOpenRecipe(i)}
                                    className={`px-3 py-1.5 border ${RULE} bg-white text-[13px] font-bold ${MUTED} hover:bg-[oklch(94%_0.010_28)] cursor-pointer whitespace-nowrap`}>
                                    เปิดสูตร
                                </button>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}
