/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Dialog · theme: Thai Modern OKLCH */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabaseClient';
import { diffRecipeRows } from '../../utils/recipeVersions';

const RULE = 'border-[oklch(85%_0.012_28)]';
const MUTED = 'text-[oklch(42%_0.010_28)]';
const NEUTRAL = 'text-[oklch(55%_0.010_28)]';
const ACCENT = 'text-[oklch(52%_0.16_28)]';
const q = (n) => String(Math.round((Number(n) || 0) * 10000) / 10000);
const when = (iso) => new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Past saves of one recipe, what changed each time, and "load this version". */
export default function RecipeHistoryModal({ parentType, parentId, onRestore, onClose }) {
    const [loading, setLoading] = useState(true);
    const [versions, setVersions] = useState([]);
    const [missing, setMissing] = useState(false);
    const [open, setOpen] = useState(null);

    useEffect(() => {
        const field = parentType === 'menu' ? 'parent_menu_item_id' : 'parent_stock_item_id';
        supabase.from('recipe_versions').select('id, rows, total_cost, saved_by, note, created_at')
            .eq(field, parentId).order('created_at', { ascending: false }).limit(50)
            .then(({ data, error }) => {
                if (error) setMissing(true);
                else setVersions(data || []);
                setLoading(false);
            });
    }, [parentType, parentId]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return createPortal(
        <div className="fixed inset-0 z-[90] bg-black/60 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-labelledby="recipe-history-title"
                className={`w-full sm:max-w-lg max-h-[88dvh] flex flex-col bg-[oklch(97%_0.008_28)] border ${RULE} text-[oklch(18%_0.012_28)] font-sans`}
                onClick={e => e.stopPropagation()}>
                <div className={`shrink-0 grid grid-cols-[1fr_auto] border-b ${RULE}`}>
                    <div className="px-4 pt-4 pb-3">
                        <span className={`font-mono text-[10px] font-bold uppercase tracking-wider ${ACCENT} block`}>RECIPE HISTORY</span>
                        <h2 id="recipe-history-title" className="font-bold text-base leading-7">ประวัติการแก้สูตร</h2>
                        <p className={`text-[12px] leading-5 ${MUTED}`}>เก็บทุกครั้งที่กดบันทึก "ใช้เวอร์ชันนี้" จะโหลดกลับเข้าตัวแก้ ต้องกดบันทึกอีกครั้งถึงจะมีผล</p>
                    </div>
                    <button type="button" onClick={onClose} className={`px-4 border-l ${RULE} font-bold text-[13px] ${MUTED} hover:bg-[oklch(94%_0.010_28)] cursor-pointer`}>ปิด</button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto bg-white">
                    {loading ? (
                        <p className={`p-6 text-[14px] ${NEUTRAL}`}>กำลังโหลด...</p>
                    ) : missing ? (
                        <p className={`p-6 text-[14px] leading-6 ${MUTED}`}>ฐานข้อมูลยังไม่มีตารางประวัติสูตร ต้องติดตั้ง migration ก่อน</p>
                    ) : versions.length === 0 ? (
                        <p className={`p-6 text-[14px] leading-6 ${MUTED}`}>ยังไม่มีประวัติ จะเริ่มเก็บตั้งแต่การบันทึกครั้งถัดไป</p>
                    ) : (
                        <ol className="divide-y divide-[oklch(90%_0.008_28)]">
                            {versions.map((v, i) => {
                                const prev = versions[i + 1];
                                const d = prev ? diffRecipeRows(prev.rows || [], v.rows || []) : null;
                                const isOpen = open === v.id;
                                return (
                                    <li key={v.id} className="px-4 py-3">
                                        <div className="grid grid-cols-[1fr_auto] gap-x-3 items-baseline">
                                            <span className="font-bold text-[14px] leading-6">{when(v.created_at)}{i === 0 && <span className={`ml-2 font-mono text-[10px] ${ACCENT}`}>ล่าสุด</span>}</span>
                                            <span className="font-mono text-[13px] tabular-nums">{v.total_cost !== null ? `฿${Number(v.total_cost).toFixed(2)}` : ''}</span>
                                            <span className={`text-[12px] leading-5 ${NEUTRAL}`}>{v.saved_by || 'Staff'} · {(v.rows || []).length} รายการ</span>
                                        </div>
                                        {d && (
                                            <p className={`text-[12px] leading-5 mt-1 ${MUTED}`}>
                                                {[
                                                    ...d.changed.map(c => `${c.name} ${q(c.from)}${c.fromUnit !== c.unit ? ' ' + c.fromUnit : ''} → ${q(c.to)} ${c.unit}`),
                                                    ...d.added.map(r => `+ ${r.name} ${q(r.quantity)} ${r.unit}`),
                                                    ...d.removed.map(r => `− ${r.name}`)
                                                ].join(' · ') || 'ไม่เปลี่ยนปริมาณ'}
                                            </p>
                                        )}
                                        {!d && <p className={`text-[12px] leading-5 mt-1 ${NEUTRAL}`}>เวอร์ชันแรกที่เก็บไว้</p>}
                                        <div className="flex gap-3 mt-1.5">
                                            <button type="button" onClick={() => setOpen(isOpen ? null : v.id)} className={`text-[12px] font-bold underline underline-offset-2 ${MUTED} cursor-pointer`}>
                                                {isOpen ? 'ซ่อนรายการ' : 'ดูรายการ'}
                                            </button>
                                            {i > 0 && (
                                                <button type="button" onClick={() => onRestore(v)} className={`text-[12px] font-bold underline underline-offset-2 ${ACCENT} cursor-pointer`}>
                                                    ใช้เวอร์ชันนี้
                                                </button>
                                            )}
                                        </div>
                                        {isOpen && (
                                            <ul className={`mt-2 border ${RULE} divide-y divide-[oklch(92%_0.006_28)]`}>
                                                {(v.rows || []).map((r, j) => (
                                                    <li key={j} className="grid grid-cols-[1fr_auto] gap-3 px-2.5 py-1.5 text-[13px] leading-5">
                                                        <span className="break-words min-w-0">{r.name}</span>
                                                        <span className="font-mono tabular-nums">{q(r.quantity)} {r.unit}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
