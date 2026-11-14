/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Ledger drawer · theme: Thai Modern OKLCH */
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabaseClient';
import { shopDayOf, displayUnit } from '../../utils/stockCount';
import { reasonLabel, TX_FILTERS } from '../../utils/stockReports';

const LIMIT = 200;
const FILTERS = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'in', label: 'รับเข้า' },
    { key: 'out', label: 'เบิกออก' },
    { key: 'count', label: 'ปรับตามนับ' }
];

const qty = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    return Number(v.toFixed(3)).toLocaleString('th-TH', { maximumFractionDigits: 3 });
};
const signed = (n) => `${Number(n) > 0 ? '+' : ''}${qty(n)}`;
const timeOf = (iso) => new Date(iso).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
const dayLabel = (ymd) => new Date(`${ymd}T12:00:00+07:00`).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', weekday: 'short', day: 'numeric', month: 'short' });

/** Latest stock movements across all items, grouped by shop day. */
export default function TransactionHistory({ onClose }) {
    const [state, setState] = useState({ loading: true, tx: [], error: null });
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');

    useEffect(() => {
        let cancelled = false;
        supabase
            .from('stock_transactions')
            .select('id, created_at, quantity_change, balance_after, reason, transaction_type, note, performed_by, stock_items (name, unit)')
            .order('created_at', { ascending: false })
            .limit(LIMIT)
            .then(({ data, error }) => {
                if (!cancelled) setState({ loading: false, tx: data || [], error });
            });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const days = useMemo(() => {
        const q = search.trim().toLowerCase();
        const groups = new Map();
        for (const t of state.tx) {
            if (!TX_FILTERS[filter](t)) continue;
            if (q && !String(t.stock_items?.name || '').toLowerCase().includes(q)) continue;
            const d = shopDayOf(new Date(t.created_at));
            if (!groups.has(d)) groups.set(d, []);
            groups.get(d).push(t);
        }
        return [...groups.entries()];
    }, [state.tx, filter, search]);

    return createPortal(
        <div className="fixed inset-0 z-[60] bg-black/50 flex justify-end" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-labelledby="tx-history-title" onClick={e => e.stopPropagation()}
                className="w-full sm:max-w-lg h-full flex flex-col bg-[oklch(97%_0.008_28)] border-l border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-sans">
                <header className="shrink-0 grid grid-cols-[1fr_auto] border-b border-[oklch(85%_0.012_28)] divide-x divide-[oklch(85%_0.012_28)]">
                    <div className="px-4 py-3 min-w-0">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] block">LEDGER · LATEST {LIMIT}</span>
                        <h2 id="tx-history-title" className="font-bold text-lg leading-7">ประวัติความเคลื่อนไหว</h2>
                        <p className="text-[12px] leading-5 text-[oklch(42%_0.010_28)]">ดูรายตัวย้อนหลัง 30 วัน กดชื่อในหน้า Stock Recon</p>
                    </div>
                    <button type="button" onClick={onClose} className="px-4 font-bold text-[13px] text-[oklch(42%_0.010_28)] hover:bg-[oklch(94%_0.010_28)] cursor-pointer">
                        ปิด
                    </button>
                </header>

                <div className="shrink-0 grid grid-cols-4 border-b border-[oklch(85%_0.012_28)] divide-x divide-[oklch(85%_0.012_28)]" role="tablist" aria-label="ชนิด">
                    {FILTERS.map(f => (
                        <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
                            className={`py-2.5 px-1 text-[13px] leading-5 font-bold cursor-pointer ${filter === f.key ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]' : 'text-[oklch(42%_0.010_28)] hover:bg-[oklch(94%_0.010_28)]'}`}>
                            {f.label}
                        </button>
                    ))}
                </div>
                <label className="shrink-0 block border-b border-[oklch(85%_0.012_28)] bg-white">
                    <span className="sr-only">ค้นหาวัตถุดิบ</span>
                    <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาวัตถุดิบ"
                        className="w-full px-4 py-2.5 text-[14px] leading-6 bg-transparent outline-none focus:bg-[oklch(98%_0.004_28)]" />
                </label>

                <div className="flex-1 min-h-0 overflow-y-auto">
                    {state.loading ? (
                        <p className="p-6 text-[14px] text-[oklch(55%_0.010_28)]">กำลังโหลด...</p>
                    ) : state.error ? (
                        <p className="p-6 text-[14px] text-[oklch(52%_0.16_28)]">โหลดไม่สำเร็จ: {state.error.message}</p>
                    ) : days.length === 0 ? (
                        <p className="p-6 text-[14px] leading-6 text-[oklch(42%_0.010_28)]">ไม่มีรายการ</p>
                    ) : days.map(([day, rows]) => (
                        <section key={day} className="border-b border-[oklch(85%_0.012_28)]" aria-label={dayLabel(day)}>
                            <div className="sticky top-0 px-4 py-1.5 bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)]">
                                <span className="font-bold text-[13px] leading-5">{dayLabel(day)}</span>
                            </div>
                            <ul className="divide-y divide-[oklch(90%_0.008_28)] bg-white">
                                {rows.map(t => {
                                    const change = Number(t.quantity_change) || 0;
                                    const sub = [reasonLabel(t), t.performed_by, t.note].filter(Boolean).join(' · ');
                                    return (
                                        <li key={t.id} className="grid grid-cols-[3rem_1fr_auto] gap-x-3 px-4 py-2 items-baseline">
                                            <span className="font-mono text-[12px] text-[oklch(55%_0.010_28)]">{timeOf(t.created_at)}</span>
                                            <span className="min-w-0">
                                                <span className="block font-bold text-[14px] leading-6 break-words">{t.stock_items?.name || 'ไม่ทราบชื่อ'}</span>
                                                <span className="block text-[12px] leading-5 text-[oklch(55%_0.010_28)] break-words">{sub}</span>
                                            </span>
                                            <span className="text-right font-mono tabular-nums">
                                                <span className={`block text-[14px] font-bold ${change < 0 ? 'text-[oklch(52%_0.16_28)]' : ''}`}>
                                                    {signed(change)} <span className="font-sans font-normal text-[11px] text-[oklch(55%_0.010_28)]">{displayUnit(t.stock_items?.unit)}</span>
                                                </span>
                                                {t.balance_after !== null && t.balance_after !== undefined && (
                                                    <span className="block text-[11px] text-[oklch(55%_0.010_28)]">เหลือ {qty(t.balance_after)}</span>
                                                )}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
}
