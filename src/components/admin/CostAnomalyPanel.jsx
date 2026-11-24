/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Ledger panel · theme: Thai Modern OKLCH */
import React, { useMemo, useState } from 'react';
import { findCostAnomalies, ANOMALY } from '../../utils/costAnomalies';

const RULE = 'border-[var(--color-rule)]';
const MUTED = 'text-[var(--color-muted)]';
const baht = (n) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (n) => String(Math.round(Number(n || 0) * 10000) / 10000);
// The worst few are enough to start on; the rest wait behind one button.
const FIRST = 5;

function Reason({ reason, price }) {
    const l = reason.line;
    switch (reason.kind) {
        case ANOMALY.OVER_PRICE:
            return <>ต้นทุนสูงกว่าราคาขาย</>;
        case ANOMALY.THIN:
            return <>ต้นทุนกินราคาขายเกิน 80%</>;
        case ANOMALY.ZERO_COST:
            return <>มีสูตรแต่ต้นทุนเป็น 0</>;
        case ANOMALY.BIG_LINE:
            return (
                <>
                    {l.name} ใส่ <span className="font-mono tabular-nums">{qty(l.qty)}</span> {l.unit} คิดเป็น{' '}
                    <span className="font-mono tabular-nums">{baht(l.total)}</span> บาท
                    {price > 0 && <> เกินครึ่งของราคาขาย ตรวจจำนวนและหน่วย</>}
                </>
            );
        case ANOMALY.NO_PRICE:
            return <>{l.name} ยังไม่มีราคาซื้อ</>;
        default:
            return null;
    }
}

/**
 * Menus whose recipe cost cannot be right. The same recipe line drives stock deduction,
 * so each row here is also a wrong amount coming off the shelf.
 */
export default function CostAnomalyPanel({ menuItems, onOpenRecipe }) {
    const found = useMemo(() => findCostAnomalies(menuItems), [menuItems]);
    const withRecipe = useMemo(() => (menuItems || []).filter(m => m.hasRecipe).length, [menuItems]);
    const [showAll, setShowAll] = useState(false);
    const shown = showAll ? found : found.slice(0, FIRST);
    const hidden = found.length - shown.length;

    if (withRecipe === 0) return null;
    if (found.length === 0) {
        return (
            <p className={`border ${RULE} bg-[var(--color-paper)] px-3 py-2 font-sans text-[14px] leading-6 ${MUTED}`}>
                ไม่พบเมนูที่ต้นทุนผิดปกติ
            </p>
        );
    }

    return (
        <section className={`border ${RULE} bg-[var(--color-paper)] font-sans text-[var(--color-ink)]`} aria-labelledby="cost-anomaly">
            <div className={`px-3 py-3 border-b ${RULE}`}>
                <h2 id="cost-anomaly" className="font-bold text-[16px] leading-6">
                    ต้นทุนเพี้ยน <span className="font-mono tabular-nums">{found.length}</span> เมนู
                </h2>
                <p className={`text-[14px] leading-6 ${MUTED}`}>
                    สูตรเดียวกันนี้ใช้ตัดสต๊อกด้วย แถวที่จำนวนหรือหน่วยผิดจึงตัดของผิดไปพร้อมกัน
                </p>
            </div>
            <ul className="divide-y divide-[var(--color-paper-3)]">
                {shown.map(m => (
                    <li key={m.id} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 px-3 py-3 items-start">
                        <div className="min-w-0">
                            <p className="text-[16px] leading-6 font-bold break-words">{m.name}</p>
                            <p className={`text-[14px] leading-6 ${MUTED}`}>
                                ขาย <span className="font-mono tabular-nums text-[var(--color-ink)]">{baht(m.price)}</span>
                                <span className="inline-block w-3" aria-hidden="true" />
                                ต้นทุน <span className="font-mono tabular-nums text-[var(--color-ink)]">{baht(m.cost)}</span>
                                {m.price > 0 && (
                                    <>
                                        <span className="inline-block w-3" aria-hidden="true" />
                                        <span className="font-mono tabular-nums text-[var(--color-ink)]">{Math.round(m.share * 100)}%</span> ของราคา
                                    </>
                                )}
                            </p>
                            <ul className="mt-1 space-y-0.5">
                                {m.reasons.map((r, i) => (
                                    <li key={i} className="text-[14px] leading-6 break-words">
                                        <Reason reason={r} price={m.price} />
                                    </li>
                                ))}
                            </ul>
                        </div>
                        {onOpenRecipe && (
                            <button type="button" onClick={() => onOpenRecipe(m)}
                                className={`min-h-12 px-4 border ${RULE} bg-[var(--color-paper)] text-[14px] font-bold text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] active:bg-[var(--color-paper-3)] disabled:opacity-40 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-plum)] whitespace-nowrap sm:justify-self-end`}>
                                เปิดสูตร
                            </button>
                        )}
                    </li>
                ))}
            </ul>
            {(hidden > 0 || showAll) && found.length > FIRST && (
                <div className={`border-t ${RULE}`}>
                    <button type="button" onClick={() => setShowAll(v => !v)} aria-expanded={showAll}
                        className={`w-full min-h-12 px-3 text-left text-[14px] font-bold text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] active:bg-[var(--color-paper-3)] disabled:opacity-40 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-plum)]`}>
                        {showAll ? 'แสดงเฉพาะ 5 เมนูแรก' : <>ดูอีก <span className="font-mono tabular-nums">{hidden}</span> เมนู</>}
                    </button>
                </div>
            )}
        </section>
    );
}
