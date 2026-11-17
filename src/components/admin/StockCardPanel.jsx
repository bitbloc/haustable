/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Ledger drawer · theme: Thai Modern OKLCH */
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabaseClient';
import { shopDayOf, addDays, displayUnit } from '../../utils/stockCount';
import { buildStockCard } from '../../utils/stockReports';

const DAYS = 30;

const qty = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    return Number(v.toFixed(3)).toLocaleString('th-TH', { maximumFractionDigits: 3 });
};
const signed = (n) => `${Number(n) > 0 ? '+' : ''}${qty(n)}`;
const timeOf = (iso) => new Date(iso).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
const dayLabel = (ymd) => ymd
    ? new Date(`${ymd}T12:00:00+07:00`).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', weekday: 'short', day: 'numeric', month: 'short' })
    : 'ไม่ทราบวัน';

/**
 * Every movement of one stock item over the last 30 shop days, with the balance
 * after each one, plus the usage computed from sales (shadow mode, not deducted yet).
 */
export default function StockCardPanel({ itemId, itemName, unit, onClose }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState({ tx: [], sales: [], waste: [], item: null });

    useEffect(() => {
        let cancelled = false;
        const since = addDays(shopDayOf(new Date()), -(DAYS - 1));
        const sinceIso = new Date(`${since}T05:00:00+07:00`).toISOString();
        (async () => {
            setLoading(true);
            setError(null);
            const [tx, sales, waste, item] = await Promise.all([
                supabase.from('stock_transactions')
                    .select('created_at, reason, transaction_type, quantity_change, balance_after, performed_by, note')
                    .eq('stock_item_id', itemId).gte('created_at', sinceIso)
                    .order('created_at', { ascending: false }).limit(500),
                supabase.from('sale_stock_shadow_daily')
                    .select('shop_day, quantity, order_lines')
                    .eq('stock_item_id', itemId).gte('shop_day', since),
                supabase.from('sale_stock_shadow')
                    .select('sold_at, quantity')
                    .eq('stock_item_id', itemId).eq('source', 'waste').is('voided_at', null).gte('sold_at', sinceIso),
                supabase.from('stock_items').select('current_quantity, unit').eq('id', itemId).maybeSingle()
            ]);
            if (cancelled) return;
            if (tx.error) {
                setError(tx.error);
            } else {
                setData({ tx: tx.data || [], sales: sales.data || [], waste: waste.error ? [] : (waste.data || []), item: item.data || null });
            }
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [itemId]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const days = useMemo(() => buildStockCard(data.tx, data.sales, data.waste, shopDayOf), [data]);
    const u = displayUnit(unit || data.item?.unit);
    const totalSales = data.sales.reduce((s, r) => s + (Number(r.quantity) || 0), 0);

    return createPortal(
        <div className="fixed inset-0 z-[60] bg-black/50 flex justify-end" onClick={onClose}>
            <aside role="dialog" aria-modal="true" aria-labelledby="stock-card-title"
                className="w-full sm:max-w-lg h-full flex flex-col bg-[var(--color-paper)] border-l border-[var(--color-rule)] text-[var(--color-ink)] font-sans"
                onClick={e => e.stopPropagation()}>
                <header className="shrink-0 grid grid-cols-[1fr_auto] border-b border-[var(--color-rule)] divide-x divide-[var(--color-rule)]">
                    <div className="px-4 py-3 min-w-0">
                        <span className="tabular-nums text-xs font-bold text-[var(--brand-plum)] block">STOCK CARD · {DAYS} DAYS</span>
                        <h2 id="stock-card-title" className="font-bold text-lg leading-7 break-words">{itemName}</h2>
                        <p className="text-[12px] leading-5 text-[var(--color-muted)]">
                            คงเหลือในระบบ <span className="tabular-nums font-bold text-[var(--color-ink)]">{data.item ? qty(data.item.current_quantity) : '—'}</span> {u}
                            {totalSales > 0 && <> · ใช้ตามยอดขาย {DAYS} วัน <span className="tabular-nums">{qty(totalSales)}</span> {u}</>}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="px-4 font-bold text-[13px] text-[var(--color-muted)] hover:bg-[var(--color-paper-2)] cursor-pointer">
                        ปิด
                    </button>
                </header>

                <div className="flex-1 min-h-0 overflow-y-auto">
                    {loading ? (
                        <p className="p-6 text-[14px] text-[var(--color-neutral)]">กำลังโหลด...</p>
                    ) : error ? (
                        <p className="p-6 text-[14px] text-[var(--error-red)]">โหลดไม่สำเร็จ: {error.message}</p>
                    ) : days.length === 0 ? (
                        <p className="p-6 text-[14px] leading-6 text-[var(--color-muted)]">ไม่มีความเคลื่อนไหวใน {DAYS} วันที่ผ่านมา</p>
                    ) : days.map(d => (
                        <section key={d.day} className="border-b border-[var(--color-rule)]" aria-label={dayLabel(d.day)}>
                            <div className="sticky top-0 grid grid-cols-[1fr_auto] px-4 py-1.5 bg-[var(--color-paper-2)] border-b border-[var(--color-rule)]">
                                <span className="font-bold text-[13px] leading-5">{dayLabel(d.day)}</span>
                                {d.ledger.length > 0 && (
                                    <span className=" text-[12px] leading-5 text-[var(--color-muted)] tabular-nums">สุทธิ {signed(d.netLedger)}</span>
                                )}
                            </div>
                            <ul className="divide-y divide-[var(--color-paper-3)] bg-[var(--color-paper)]">
                                {d.ledger.map((r, i) => (
                                    <li key={`${r.at}-${i}`} className="grid grid-cols-[3rem_1fr_auto] gap-x-3 px-4 py-2 items-baseline">
                                        <span className="tabular-nums text-[12px] text-[var(--color-neutral)]">{timeOf(r.at)}</span>
                                        <span className="min-w-0">
                                            <span className="font-bold text-[14px] leading-6">{r.label}</span>
                                            {(r.by || r.note) && (
                                                <span className="block text-[12px] leading-5 text-[var(--color-neutral)] break-words">
                                                    {[r.by, r.note].filter(Boolean).join(' · ')}
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-right tabular-nums">
                                            <span className={`block text-[14px] font-bold ${r.change < 0 ? 'text-[var(--brand-plum)]' : ''}`}>{signed(r.change)}</span>
                                            {r.balance !== null && <span className="block text-xs text-[var(--color-neutral)]">เหลือ {qty(r.balance)}</span>}
                                        </span>
                                    </li>
                                ))}
                                {d.computed.map(r => (
                                    <li key={r.kind} className="grid grid-cols-[3rem_1fr_auto] gap-x-3 px-4 py-2 items-baseline bg-[var(--color-paper)]">
                                        <span className="tabular-nums text-xs text-[var(--color-neutral)]">ทั้งวัน</span>
                                        <span className="min-w-0">
                                            <span className="text-[14px] leading-6">{r.label}</span>
                                            {r.lines > 0 && <span className="block text-[12px] leading-5 text-[var(--color-neutral)]">จาก {r.lines} รายการในบิล · ยังไม่ได้ตัดสต๊อกจริง</span>}
                                        </span>
                                        <span className="text-right text-[14px] tabular-nums text-[var(--color-muted)]">{signed(r.change)}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            </aside>
        </div>,
        document.body
    );
}
