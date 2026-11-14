/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Ledger drawer · theme: Thai Modern OKLCH */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabaseClient';
import { shopDayOf, addDays, displayUnit } from '../../utils/stockCount';
import { summarizeWithdrawals } from '../../utils/stockReports';

const PERIODS = [7, 30];
const COLS = [
    { key: 'waste', label: 'ของเสีย' },
    { key: 'staff_meal', label: 'พนักงานกิน' },
    { key: 'production_out', label: 'ใช้ผลิต' },
    { key: 'other', label: 'เบิกอื่น' }
];

const qty = (n) => (Number(n) ? Number(Number(n).toFixed(3)).toLocaleString('th-TH', { maximumFractionDigits: 3 }) : '—');

/**
 * What was taken out of stock by hand over the last 7 / 30 shop days, per item and reason.
 * Usage from sales is not here: it is computed from recipes and shown in Stock Recon.
 */
export default function StockUsageReport({ onClose }) {
    const [period, setPeriod] = useState(7);
    const [state, setState] = useState({ loading: true, rows: [], error: null });

    useEffect(() => {
        let cancelled = false;
        setState(s => ({ ...s, loading: true, error: null }));
        const startDay = addDays(shopDayOf(new Date()), -(period - 1));
        const since = new Date(`${startDay}T05:00:00+07:00`).toISOString();
        supabase
            .from('stock_transactions')
            .select('stock_item_id, quantity_change, reason, transaction_type, stock_items (name, unit)')
            .lt('quantity_change', 0)
            .gte('created_at', since)
            .limit(5000)
            .then(({ data, error }) => {
                if (cancelled) return;
                if (error) setState({ loading: false, rows: [], error });
                else setState({ loading: false, rows: summarizeWithdrawals(data || []), error: null });
            });
        return () => { cancelled = true; };
    }, [period]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const cellHead = 'px-3 py-2 text-right font-sans text-[12px] leading-5 font-bold text-[oklch(42%_0.010_28)] whitespace-nowrap';
    const cell = 'px-3 py-2 text-right font-mono text-[13px] leading-5 tabular-nums whitespace-nowrap';

    return createPortal(
        <div className="fixed inset-0 z-[60] bg-black/50 flex justify-end" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-labelledby="usage-report-title" onClick={e => e.stopPropagation()}
                className="w-full sm:max-w-2xl h-full flex flex-col bg-[oklch(97%_0.008_28)] border-l border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-sans">
                <header className="shrink-0 grid grid-cols-[1fr_auto] border-b border-[oklch(85%_0.012_28)] divide-x divide-[oklch(85%_0.012_28)]">
                    <div className="px-4 py-3 min-w-0">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] block">WITHDRAWALS · {period} DAYS</span>
                        <h2 id="usage-report-title" className="font-bold text-lg leading-7">สรุปการเบิกออก</h2>
                        <p className="text-[12px] leading-5 text-[oklch(42%_0.010_28)]">
                            เฉพาะที่เบิกด้วยมือ ยอดใช้ตามยอดขายดูที่หน้า Stock Recon
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="px-4 font-bold text-[13px] text-[oklch(42%_0.010_28)] hover:bg-[oklch(94%_0.010_28)] cursor-pointer">
                        ปิด
                    </button>
                </header>

                <div className="shrink-0 grid grid-cols-2 border-b border-[oklch(85%_0.012_28)] divide-x divide-[oklch(85%_0.012_28)]" role="tablist" aria-label="ช่วงเวลา">
                    {PERIODS.map(d => (
                        <button key={d} type="button" role="tab" aria-selected={period === d} onClick={() => setPeriod(d)}
                            className={`py-2.5 text-[13px] leading-5 font-bold cursor-pointer ${period === d ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]' : 'text-[oklch(42%_0.010_28)] hover:bg-[oklch(94%_0.010_28)]'}`}>
                            {d} วันล่าสุด
                        </button>
                    ))}
                </div>

                <div className="flex-1 min-h-0 overflow-auto">
                    {state.loading ? (
                        <p className="p-6 text-[14px] text-[oklch(55%_0.010_28)]">กำลังโหลด...</p>
                    ) : state.error ? (
                        <p className="p-6 text-[14px] text-[oklch(52%_0.16_28)]">โหลดไม่สำเร็จ: {state.error.message}</p>
                    ) : state.rows.length === 0 ? (
                        <p className="p-6 text-[14px] leading-6 text-[oklch(42%_0.010_28)]">ไม่มีการเบิกออกใน {period} วันที่ผ่านมา</p>
                    ) : (<>
                        <ul className="sm:hidden divide-y divide-[oklch(90%_0.008_28)] bg-white">
                            {state.rows.map(r => (
                                <li key={r.stock_item_id || r.name} className="grid grid-cols-[1fr_auto] gap-x-3 px-4 py-2 items-baseline">
                                    <span className="min-w-0">
                                        <span className="block font-bold text-[14px] leading-6 break-words">{r.name}</span>
                                        <span className="block text-[12px] leading-5 text-[oklch(55%_0.010_28)] break-words">
                                            {COLS.filter(c => r[c.key]).map(c => `${c.label} ${qty(r[c.key])}`).join(' · ')} · {r.count} ครั้ง
                                        </span>
                                    </span>
                                    <span className="text-right font-mono tabular-nums">
                                        <span className="block text-[14px] font-bold">{qty(r.total)}</span>
                                        <span className="block font-sans text-[11px] text-[oklch(55%_0.010_28)]">{displayUnit(r.unit)}</span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <table className="hidden sm:table w-full border-collapse bg-white">
                            <thead className="sticky top-0 bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)]">
                                <tr>
                                    <th className="px-3 py-2 text-left font-sans text-[12px] leading-5 font-bold text-[oklch(42%_0.010_28)]">รายการ</th>
                                    {COLS.map(c => <th key={c.key} className={cellHead}>{c.label}</th>)}
                                    <th className={cellHead}>รวม</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[oklch(90%_0.008_28)]">
                                {state.rows.map(r => (
                                    <tr key={r.stock_item_id || r.name}>
                                        <td className="px-3 py-2 min-w-0">
                                            <span className="block font-bold text-[14px] leading-6 break-words">{r.name}</span>
                                            <span className="block text-[11px] leading-5 text-[oklch(55%_0.010_28)]">{r.count} ครั้ง · {displayUnit(r.unit)}</span>
                                        </td>
                                        {COLS.map(c => (
                                            <td key={c.key} className={`${cell} ${r[c.key] ? '' : 'text-[oklch(70%_0.008_28)]'}`}>{qty(r[c.key])}</td>
                                        ))}
                                        <td className={`${cell} font-bold`}>{qty(r.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </>)}
                </div>
            </div>
        </div>,
        document.body
    );
}
