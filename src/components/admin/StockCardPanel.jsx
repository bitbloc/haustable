/* Hallmark · shape: app screen · theme: Thai Twist Modern (Brand v2) · v2.0.0 */
/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabaseClient';
import { shopDayOf, addDays, formatReconQty } from '../../utils/stockCount';
import { buildStockCard } from '../../utils/stockReports';

const DAYS = 30;

const timeOf = (iso) => new Date(iso).toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit'
});
const dayLabel = (ymd) => ymd
    ? new Date(`${ymd}T12:00:00+07:00`).toLocaleDateString('th-TH', {
        timeZone: 'Asia/Bangkok', weekday: 'short', day: 'numeric', month: 'short'
    })
    : 'ไม่ทราบวัน';

/**
 * Every movement of one stock item over the last 30 shop days, with human-readable
 * pack/piece units and a per-menu breakdown of shadow sales usage.
 */
export default function StockCardPanel({ itemId, itemName, unit, focusDay = null, onClose }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState({ tx: [], sales: [], waste: [], shadowDetails: [], item: null });
    const [expandedDays, setExpandedDays] = useState({});

    useEffect(() => {
        let cancelled = false;
        const since = addDays(shopDayOf(new Date()), -(DAYS - 1));
        const sinceIso = new Date(`${since}T05:00:00+07:00`).toISOString();
        (async () => {
            setLoading(true);
            setError(null);
            const [tx, sales, shadow, item] = await Promise.all([
                supabase.from('stock_transactions')
                    .select('created_at, reason, transaction_type, quantity_change, balance_after, performed_by, note')
                    .eq('stock_item_id', itemId).gte('created_at', sinceIso)
                    .order('created_at', { ascending: false }).limit(500),
                supabase.from('sale_stock_shadow_daily')
                    .select('shop_day, quantity, order_lines')
                    .eq('stock_item_id', itemId).gte('shop_day', since),
                supabase.from('sale_stock_shadow')
                    .select('sold_at, menu_item_id, source, quantity, order_quantity')
                    .eq('stock_item_id', itemId).is('voided_at', null).gte('sold_at', sinceIso)
                    .order('sold_at', { ascending: false }).limit(500),
                supabase.from('stock_items')
                    .select('current_quantity, unit, conversion_factor, usage_unit')
                    .eq('id', itemId).maybeSingle()
            ]);
            if (cancelled) return;
            if (tx.error) {
                setError(tx.error);
                setLoading(false);
                return;
            }

            const rawShadow = shadow.error ? [] : (shadow.data || []);
            const wasteRows = rawShadow.filter(r => r.source === 'waste');
            const usageRows = rawShadow.filter(r => r.source === 'recipe' || r.source === 'option');
            const menuIds = [...new Set(usageRows.map(r => r.menu_item_id).filter(Boolean))];
            let menuNames = {};
            if (menuIds.length > 0) {
                const { data: menus } = await supabase.from('menu_items').select('id, name').in('id', menuIds);
                if (!cancelled && menus) {
                    menuNames = Object.fromEntries(menus.map(m => [m.id, m.name]));
                }
            }
            if (cancelled) return;

            const shadowDetails = usageRows.map(r => ({
                ...r,
                menu_name: menuNames[r.menu_item_id] || 'เมนูไม่ระบุชื่อ'
            }));

            setData({
                tx: tx.data || [],
                sales: sales.error ? [] : (sales.data || []),
                waste: wasteRows,
                shadowDetails,
                item: item.data || null
            });
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [itemId]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const days = useMemo(
        () => buildStockCard(data.tx, data.sales, data.waste, shopDayOf, data.shadowDetails),
        [data]
    );

    const unitCfg = useMemo(() => ({
        unit: unit || data.item?.unit || '',
        factor: Number(data.item?.conversion_factor) || 1,
        usageUnit: data.item?.usage_unit || ''
    }), [unit, data.item]);

    const fmt = (n, digits = 3) => formatReconQty(n, unitCfg, digits);
    const fmtSigned = (n) => {
        const num = Number(n);
        if (!Number.isFinite(num) || Math.abs(num) < 0.00005) return '0';
        const text = fmt(Math.abs(num));
        return `${num > 0 ? '+' : '-'}${text}`;
    };

    const totalSales = data.sales.reduce((s, r) => s + (Number(r.quantity) || 0), 0);

    return createPortal(
        <div
            className="fixed inset-0 z-[60] bg-[var(--color-ink)]/50 flex justify-end"
            onClick={onClose}
        >
            <aside
                role="dialog"
                aria-modal="true"
                aria-labelledby="stock-card-title"
                className="w-full sm:max-w-lg h-full flex flex-col bg-[var(--color-paper)] border-l border-[var(--color-rule)] text-[var(--color-ink)] font-sans"
                onClick={e => e.stopPropagation()}
            >
                <header className="shrink-0 grid grid-cols-[minmax(0,1fr)_auto] border-b border-[var(--color-rule)] divide-x divide-[var(--color-rule)] bg-[var(--color-paper)]">
                    <div className="px-4 py-3.5 min-w-0">
                        <span className="text-[12px] leading-5 font-medium text-[var(--brand-plum)] block">
                            ประวัติความเคลื่อนไหว {DAYS} วันล่าสุด
                        </span>
                        <h2 id="stock-card-title" className="font-bold text-lg leading-7 break-words text-[var(--color-ink)]">
                            {itemName}
                        </h2>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[13px] leading-5 text-[var(--color-muted)]">
                            <span>
                                คงเหลือในระบบ{' '}
                                <span className="tabular-nums font-bold text-[var(--color-ink)]">
                                    {data.item ? fmt(data.item.current_quantity) : '—'}
                                </span>
                            </span>
                            {totalSales > 0 && (
                                <span>
                                    ใช้จากสูตร {DAYS} วัน{' '}
                                    <span className="tabular-nums font-medium text-[var(--color-ink)]">{fmt(totalSales)}</span>
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 min-h-[48px] font-bold text-[14px] text-[var(--color-muted)] hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)] active:translate-y-px motion-reduce:active:translate-y-0 focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)] focus-visible:-outline-offset-2 cursor-pointer whitespace-nowrap transition-colors"
                    >
                        ปิด
                    </button>
                </header>

                <div className="flex-1 min-h-0 overflow-y-auto">
                    {loading ? (
                        <div className="p-4 space-y-3" aria-busy="true" aria-label="กำลังโหลดประวัติ">
                            {Array.from({ length: 5 }, (_, i) => (
                                <div key={i} className="border border-[var(--color-paper-3)] p-3 space-y-2">
                                    <div className="h-4 w-28 bg-[var(--color-paper-2)]" />
                                    <div className="h-4 w-full bg-[var(--color-paper-2)]" />
                                    <div className="h-3 w-2/3 bg-[var(--color-paper-2)]" />
                                </div>
                            ))}
                        </div>
                    ) : error ? (
                        <div className="p-6 space-y-2">
                            <p className="text-[15px] font-bold text-[var(--error-red)]">โหลดประวัติไม่สำเร็จ</p>
                            <p className="text-[13px] leading-5 text-[var(--color-muted)]">{error.message}</p>
                        </div>
                    ) : days.length === 0 ? (
                        <div className="p-6">
                            <p className="text-[15px] leading-6 text-[var(--color-muted)]">
                                ไม่มีความเคลื่อนไหวในช่วง {DAYS} วันที่ผ่านมา
                            </p>
                        </div>
                    ) : days.map(d => {
                        const isFocus = focusDay && d.day === focusDay;
                        return (
                            <section key={d.day} className="border-b border-[var(--color-rule)]" aria-label={dayLabel(d.day)}>
                                <div className={`sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-2 border-b border-[var(--color-rule)] ${isFocus ? 'bg-[var(--brand-plum)] text-[var(--color-paper)]' : 'bg-[var(--color-paper-2)] text-[var(--color-ink)]'}`}>
                                    <span className="font-bold text-[13px] leading-5">
                                        {dayLabel(d.day)}
                                        {isFocus && <span className="ml-2 font-normal text-[12px] text-[var(--on-plum-2)]">วันที่กำลังดู</span>}
                                    </span>
                                    {d.ledger.length > 0 && (
                                        <span className={`text-[12px] leading-5 tabular-nums ${isFocus ? 'text-[var(--on-plum-2)]' : 'text-[var(--color-muted)]'}`}>
                                            สุทธิในระบบ {fmtSigned(d.netLedger)}
                                        </span>
                                    )}
                                </div>

                                <ul className="divide-y divide-[var(--color-paper-3)] bg-[var(--color-paper)]">
                                    {d.ledger.map((r, i) => (
                                        <li key={`${r.at}-${i}`} className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] gap-x-3 px-4 py-2.5 items-baseline">
                                            <span className="font-mono tabular-nums text-[12px] text-[var(--color-neutral)]">
                                                {timeOf(r.at)}
                                            </span>
                                            <div className="min-w-0">
                                                <span className="font-bold text-[14px] leading-6 text-[var(--color-ink)] block">
                                                    {r.label}
                                                </span>
                                                {(r.by || r.note) && (
                                                    <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[12px] leading-5 text-[var(--color-neutral)] break-words">
                                                        {r.by && <span className="font-medium text-[var(--color-muted)]">{r.by}</span>}
                                                        {r.note && <span>{r.note}</span>}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-right tabular-nums shrink-0">
                                                <span className={`block text-[14px] leading-6 font-bold ${r.change < 0 ? 'text-[var(--brand-plum)]' : 'text-[var(--color-ink)]'}`}>
                                                    {fmtSigned(r.change)}
                                                </span>
                                                {r.balance !== null && (
                                                    <span className="block text-[12px] leading-4 text-[var(--color-neutral)]">
                                                        เหลือ {fmt(r.balance)}
                                                    </span>
                                                )}
                                            </div>
                                        </li>
                                    ))}

                                    {d.computed.map(r => {
                                        const isExpanded = Boolean(expandedDays[d.day]);
                                        const breakdown = r.breakdown || [];
                                        const shownMenus = isExpanded ? breakdown : breakdown.slice(0, 5);
                                        return (
                                            <li key={r.kind} className="px-4 py-2.5 bg-[var(--color-paper-2)]/40">
                                                <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] gap-x-3 items-baseline">
                                                    <span className="text-[12px] text-[var(--color-neutral)]">ทั้งวัน</span>
                                                    <div className="min-w-0">
                                                        <span className="font-medium text-[14px] leading-6 text-[var(--color-ink)] block">
                                                            {r.label}
                                                        </span>
                                                        {r.lines > 0 && (
                                                            <span className="block text-[12px] leading-5 text-[var(--color-neutral)]">
                                                                จาก {r.lines} รายการในบิล (โหมด Shadow ยังไม่ตัดสต๊อกจริง)
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-right text-[14px] leading-6 font-bold tabular-nums text-[var(--brand-plum)] shrink-0">
                                                        {fmtSigned(r.change)}
                                                    </span>
                                                </div>

                                                {shownMenus.length > 0 && (
                                                    <div className="mt-2 ml-[4rem] border-l-2 border-[var(--color-rule)] pl-3 space-y-1">
                                                        {shownMenus.map((m, idx) => (
                                                            <div key={`${m.name}-${m.source}-${idx}`} className="flex items-baseline justify-between gap-2 text-[12px] leading-5">
                                                                <span className="text-[var(--color-muted)] min-w-0 break-words">
                                                                    {m.name}
                                                                    <span className="ml-1.5 tabular-nums text-[var(--color-neutral)]">x{m.orders}</span>
                                                                    {m.source === 'option' && (
                                                                        <span className="ml-1.5 text-[11px] text-[var(--color-neutral)]">(ตัวเลือกเสริม)</span>
                                                                    )}
                                                                </span>
                                                                <span className="tabular-nums font-medium text-[var(--color-ink)] shrink-0">
                                                                    -{fmt(m.qty)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                        {breakdown.length > 5 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setExpandedDays(prev => ({ ...prev, [d.day]: !prev[d.day] }))}
                                                                className="text-[12px] font-bold text-[var(--brand-plum)] underline underline-offset-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)]"
                                                            >
                                                                {isExpanded ? 'ซ่อนบางรายการ' : `ดูทั้งหมด ${breakdown.length} เมนู`}
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </section>
                        );
                    })}
                </div>
            </aside>
        </div>,
        document.body
    );
}
