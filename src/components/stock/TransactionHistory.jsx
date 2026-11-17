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
        <div className="fixed inset-0 z-[60] bg-[oklch(21.78%_0_0/0.45)] flex justify-end" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-labelledby="tx-history-title" onClick={e => e.stopPropagation()}
                className="w-full sm:max-w-lg h-full flex flex-col bg-[var(--color-paper)] border-l border-[var(--color-rule)] text-[var(--color-ink)] font-sans">
                <header className="shrink-0 grid grid-cols-[1fr_auto] border-b border-[var(--color-rule)] divide-x divide-[var(--color-rule)]">
                    <div className="px-4 py-3 min-w-0">
                        <h2 id="tx-history-title" className="font-bold text-xl leading-7">ประวัติความเคลื่อนไหว</h2>
                        <p className="text-[12px] leading-5 text-[var(--color-muted)]">ดูรายตัวย้อนหลัง 30 วัน กดชื่อในหน้า Stock Recon</p>
                    </div>
                    <button type="button" onClick={onClose} className="px-4 font-bold text-[14px] text-[var(--color-muted)] hover:bg-[var(--color-paper-2)] cursor-pointer">
                        ปิด
                    </button>
                </header>

                <div className="shrink-0 grid grid-cols-4 border-b border-[var(--color-rule)] divide-x divide-[var(--color-rule)]" role="tablist" aria-label="ชนิด">
                    {FILTERS.map(f => (
                        <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
                            className={`py-2.5 px-1 text-[14px] leading-5 font-bold cursor-pointer ${filter === f.key ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' : 'text-[var(--color-muted)] hover:bg-[var(--color-paper-2)]'}`}>
                            {f.label}
                        </button>
                    ))}
                </div>
                <label className="shrink-0 block border-b border-[var(--color-rule)] bg-[var(--color-paper)]">
                    <span className="sr-only">ค้นหาวัตถุดิบ</span>
                    <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาวัตถุดิบ"
                        className="w-full px-4 py-2.5 text-[14px] leading-6 bg-transparent outline-none focus:bg-[var(--color-paper)]" />
                </label>

                <div className="flex-1 min-h-0 overflow-y-auto">
                    {state.loading ? (
                        <p className="p-6 text-[14px] text-[var(--color-neutral)]">กำลังโหลด...</p>
                    ) : state.error ? (
                        <p className="p-6 text-[14px] text-[var(--error-red)]">โหลดไม่สำเร็จ: {state.error.message}</p>
                    ) : days.length === 0 ? (
                        <p className="p-6 text-[14px] leading-6 text-[var(--color-muted)]">ไม่มีรายการ</p>
                    ) : days.map(([day, rows]) => (
                        <section key={day} className="border-b border-[var(--color-rule)]" aria-label={dayLabel(day)}>
                            <div className="sticky top-0 px-4 py-1.5 bg-[var(--color-paper-2)] border-b border-[var(--color-rule)]">
                                <span className="font-bold text-[14px] leading-5">{dayLabel(day)}</span>
                            </div>
                            <ul className="divide-y divide-[var(--color-paper-3)] bg-[var(--color-paper)]">
                                {rows.map(t => {
                                    const change = Number(t.quantity_change) || 0;
                                    const sub = [reasonLabel(t), t.performed_by, t.note].filter(Boolean).join(' · ');
                                    return (
                                        <li key={t.id} className="grid grid-cols-[3rem_1fr_auto] gap-x-3 px-4 py-2 items-baseline">
                                            <span className="tabular-nums text-[12px] text-[var(--color-neutral)]">{timeOf(t.created_at)}</span>
                                            <span className="min-w-0">
                                                <span className="block font-bold text-[14px] leading-6 break-words">{t.stock_items?.name || 'ไม่ทราบชื่อ'}</span>
                                                <span className="block text-[12px] leading-5 text-[var(--color-neutral)] break-words">{sub}</span>
                                            </span>
                                            <span className="text-right tabular-nums">
                                                <span className="block text-[14px] font-bold">
                                                    {signed(change)} <span className="font-sans font-normal text-[12px] text-[var(--color-neutral)]">{displayUnit(t.stock_items?.unit)}</span>
                                                </span>
                                                {t.balance_after !== null && t.balance_after !== undefined && (
                                                    <span className={`block text-[12px] ${Number(t.balance_after) <= 0 ? 'font-bold text-[var(--brand-plum)]' : 'text-[var(--color-neutral)]'}`}>
                                                        {Number(t.balance_after) <= 0 ? 'หมดแล้ว' : `เหลือ ${qty(t.balance_after)}`}
                                                    </span>
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
