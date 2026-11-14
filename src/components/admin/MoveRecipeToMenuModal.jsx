/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Dialog · theme: Thai Modern OKLCH */
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabaseClient';
import { logStaffActivity } from '../../utils/auditLogger';
import { planMoveRecipeToMenu } from '../../utils/recipeMove';

const RULE = 'border-[oklch(85%_0.012_28)]';
const MUTED = 'text-[oklch(42%_0.010_28)]';
const NEUTRAL = 'text-[oklch(55%_0.010_28)]';
const key = (s) => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[\s\-_().,/:•]+/g, '');

/**
 * Turn a per-glass recipe item into the recipe of its menu, so each menu has one
 * recipe. Menus that used the item as one ingredient get its rows instead, the SOP
 * that pointed at it moves to the menu, then the item is deleted.
 */
export default function MoveRecipeToMenuModal({ item, onClose, onMoved }) {
    const [menus, setMenus] = useState([]);
    const [search, setSearch] = useState('');
    const [target, setTarget] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        supabase.from('menu_items').select('id, name').order('name').then(({ data }) => {
            const list = data || [];
            setMenus(list);
            const exact = list.filter(m => key(m.name) === key(item.name));
            if (exact.length === 1) setTarget(exact[0]);
        });
    }, [item.name]);

    const matches = useMemo(() => {
        const q = search.trim().toLowerCase();
        const k = key(item.name);
        const list = q ? menus.filter(m => m.name.toLowerCase().includes(q)) : menus.filter(m => key(m.name).includes(k) || k.includes(key(m.name)));
        return list.slice(0, 30);
    }, [menus, search, item.name]);

    const move = async () => {
        if (!target || busy) return;
        setBusy(true);
        try {
            const [recipe, refs, targetRows] = await Promise.all([
                supabase.from('recipe_ingredients').select('ingredient_id, quantity, unit, layer_order').eq('parent_stock_item_id', item.id).order('layer_order'),
                supabase.from('recipe_ingredients').select('id, parent_menu_item_id, ingredient_id, quantity, unit, layer_order').eq('ingredient_id', item.id).not('parent_menu_item_id', 'is', null),
                supabase.from('recipe_ingredients').select('id, parent_menu_item_id, ingredient_id, quantity, unit, layer_order').eq('parent_menu_item_id', target.id)
            ]);
            if (recipe.error || refs.error || targetRows.error) throw recipe.error || refs.error || targetRows.error;
            const stockRefs = await supabase.from('recipe_ingredients').select('id').eq('ingredient_id', item.id).not('parent_stock_item_id', 'is', null);
            if (stockRefs.data?.length) throw new Error('สูตรนี้ถูกใช้เป็นส่วนผสมของเบสอื่น ย้ายไม่ได้');

            const menuRows = [...(refs.data || []), ...(targetRows.data || []).filter(r => !(refs.data || []).some(x => x.id === r.id))];
            let plan = planMoveRecipeToMenu({ recipeId: item.id, recipeRows: recipe.data || [], menuRows, targetMenuId: target.id });
            if (plan.conflict) {
                const ok = window.confirm(`เมนู "${target.name}" มีสูตรอยู่แล้ว ${targetRows.data.length} แถว\nแทนที่ด้วยสูตรของ "${item.name}" (${recipe.data.length} แถว) ไหม?`);
                if (!ok) { setBusy(false); return; }
                plan = planMoveRecipeToMenu({ recipeId: item.id, recipeRows: recipe.data || [], menuRows, targetMenuId: target.id, replaceTarget: true });
            }

            // New rows first: if this fails nothing has been removed yet.
            if (plan.inserts.length) {
                const { error } = await supabase.from('recipe_ingredients').insert(plan.inserts);
                if (error) throw error;
            }
            if (plan.deletes.length) {
                const { error } = await supabase.from('recipe_ingredients').delete().in('id', plan.deletes);
                if (error) throw error;
            }
            // SOP that described this recipe now describes the menu
            await supabase.from('sop_recipes').update({ source_menu_item_id: target.id, source_stock_item_id: null }).eq('source_stock_item_id', item.id);
            await supabase.from('recipe_ingredients').delete().eq('parent_stock_item_id', item.id);
            const { error: delErr } = await supabase.from('stock_items').delete().eq('id', item.id);
            if (delErr) throw delErr;

            logStaffActivity('sop', 'recipe_move_to_menu', {
                reason: `ย้ายสูตร ${item.name} ไปเป็นสูตรเมนู ${target.name}`,
                metadata: { formula_id: item.id, menu_item_id: target.id, menus: plan.menus }
            });
            toast.success(`ย้าย "${item.name}" ไปเป็นสูตรของ ${target.name} แล้ว`);
            onMoved?.();
            onClose();
        } catch (err) {
            console.error(err);
            toast.error('ย้ายไม่สำเร็จ: ' + (err?.message || ''));
        } finally {
            setBusy(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[80] bg-black/60 flex items-end sm:items-center justify-center sm:p-4" onClick={() => !busy && onClose()}>
            <div role="dialog" aria-modal="true" aria-labelledby="move-recipe-title"
                className={`w-full sm:max-w-md max-h-[88dvh] flex flex-col bg-[oklch(97%_0.008_28)] border ${RULE} text-[oklch(18%_0.012_28)] font-sans`}
                onClick={e => e.stopPropagation()}>
                <div className={`shrink-0 px-4 pt-4 pb-3 border-b ${RULE}`}>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] block">MOVE TO MENU</span>
                    <h2 id="move-recipe-title" className="font-bold text-base leading-7 break-words">ย้าย "{item.name}" ไปเป็นสูตรของเมนู</h2>
                    <p className={`text-[12px] leading-5 ${MUTED}`}>
                        ส่วนผสมจะไปอยู่ที่สูตรของเมนูที่เลือก ใช้ทั้งคิดต้นทุนและตัดสต๊อก แล้วลบสูตรต่อแก้วนี้ออก
                    </p>
                </div>
                <div className={`shrink-0 p-3 border-b ${RULE}`}>
                    <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาเมนู..." aria-label="ค้นหาเมนู"
                        className={`w-full p-2 border ${RULE} bg-white text-[14px] outline-none focus:border-black`} />
                </div>
                <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-[oklch(90%_0.008_28)] bg-white" role="listbox" aria-label="เมนู">
                    {matches.map(m => (
                        <li key={m.id}>
                            <button type="button" role="option" aria-selected={target?.id === m.id} onClick={() => setTarget(m)}
                                className={`w-full text-left px-4 py-2.5 text-[14px] leading-6 font-bold break-words cursor-pointer ${target?.id === m.id ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]' : 'hover:bg-[oklch(94%_0.010_28)]'}`}>
                                {m.name}
                            </button>
                        </li>
                    ))}
                    {matches.length === 0 && <li className={`px-4 py-4 text-[14px] ${NEUTRAL}`}>พิมพ์ชื่อเมนูเพื่อค้นหา</li>}
                </ul>
                <div className={`shrink-0 grid grid-cols-2 border-t ${RULE} divide-x divide-[oklch(85%_0.012_28)]`}>
                    <button type="button" onClick={onClose} disabled={busy} className="py-3 font-bold text-[14px] bg-white hover:bg-[oklch(94%_0.010_28)] cursor-pointer disabled:opacity-40">ยกเลิก</button>
                    <button type="button" onClick={move} disabled={!target || busy}
                        className="py-3 font-bold text-[14px] bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] hover:bg-black cursor-pointer disabled:opacity-40">
                        {busy ? 'กำลังย้าย...' : target ? `ย้ายไป ${target.name.length > 18 ? target.name.slice(0, 18) + '…' : target.name}` : 'เลือกเมนู'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
