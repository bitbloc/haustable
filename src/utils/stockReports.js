/**
 * Back-office stock reports built from data that already exists:
 *   - variance ranking over several shop days (from stock_daily_reconciliation)
 *   - stock card of one item (ledger rows + daily usage computed from sales)
 */
import { isAbnormal, DEFAULT_THRESHOLDS, addDays } from './stockCount';

export const REASON_LABELS = Object.freeze({
    opening: 'ยอดตั้งต้น',
    purchase: 'รับเข้า',
    sale: 'ขาย',
    sale_void: 'คืนจากการยกเลิก',
    waste: 'ของเสีย',
    staff_meal: 'พนักงานกิน',
    production_in: 'ผลิตได้',
    production_out: 'ใช้ผลิต',
    transfer: 'โอน',
    count_adjust: 'ปรับตามนับ',
    adjust: 'ปรับ / เบิกอื่น'
});

export const reasonLabel = (row) =>
    (row?.reason === 'adjust' ? (Number(row.quantity_change) > 0 ? 'ปรับเพิ่ม' : 'เบิกอื่น') : null) ||
    REASON_LABELS[row?.reason] || (row?.transaction_type === 'in' ? 'รับเข้า' : row?.transaction_type === 'out' ? 'เบิกออก' : row?.transaction_type === 'set' ? 'ปรับตามนับ' : 'อื่น ๆ');

/** Shop days ending at `endDay`, oldest first. */
export const shopDayRange = (endDay, days) =>
    Array.from({ length: Math.max(1, days) }, (_, i) => addDays(endDay, i - (Math.max(1, days) - 1)));

/**
 * Rank items by accumulated variance across days.
 * dayResults: [{ day, rows }] where rows come from stock_daily_reconciliation.
 * Only days with a closing count contribute. Worst money loss first, then most abnormal days.
 */
export const rankVariance = (dayResults = [], thresholds = DEFAULT_THRESHOLDS) => {
    const byItem = new Map();
    for (const { day, rows } of dayResults) {
        for (const r of rows || []) {
            if (r.closing_qty === null || r.closing_qty === undefined || r.variance === null || r.variance === undefined) continue;
            const e = byItem.get(r.stock_item_id) || {
                stock_item_id: r.stock_item_id, name: r.name, unit: r.unit, priced: false,
                daysCounted: 0, abnormalDays: 0, variance: 0, value: 0, shortValue: 0, lastDay: null
            };
            const v = Number(r.variance) || 0;
            const val = Number(r.variance_value) || 0;
            e.daysCounted += 1;
            if (isAbnormal(r, thresholds)) e.abnormalDays += 1;
            e.variance += v;
            e.value += val;
            e.shortValue += Math.min(0, val);
            e.priced = e.priced || Number(r.unit_cost) > 0;
            if (!e.lastDay || day > e.lastDay) e.lastDay = day;
            byItem.set(r.stock_item_id, e);
        }
    }
    const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
    return [...byItem.values()]
        .map(e => ({ ...e, variance: round(e.variance, 4), value: round(e.value, 2), shortValue: round(e.shortValue, 2) }))
        .sort((a, b) =>
            a.shortValue - b.shortValue ||
            b.abnormalDays - a.abnormalDays ||
            Math.abs(b.variance) - Math.abs(a.variance) ||
            String(a.name).localeCompare(String(b.name), 'th'));
};

/** Totals for the ranking header. */
export const summarizeRanking = (ranked = []) => ({
    items: ranked.length,
    withAbnormal: ranked.filter(r => r.abnormalDays > 0).length,
    shortValue: Math.round(ranked.reduce((s, r) => s + r.shortValue, 0) * 100) / 100,
    netValue: Math.round(ranked.reduce((s, r) => s + r.value, 0) * 100) / 100
});

/**
 * Stock card: ledger movements newest first, plus one line per day for the usage
 * computed from sales and for dishes thrown away, which do not move stock yet.
 * tx:        stock_transactions rows
 * salesDaily: [{ shop_day, quantity, order_lines }] from sale_stock_shadow_daily
 * wasteRows: sale_stock_shadow rows with source 'waste' ({ sold_at, quantity })
 */
export const buildStockCard = (tx = [], salesDaily = [], wasteRows = [], shopDayOfFn) => {
    const ledger = tx.map(t => ({
        kind: 'ledger',
        at: t.created_at,
        day: shopDayOfFn ? shopDayOfFn(new Date(t.created_at)) : null,
        label: reasonLabel(t),
        reason: t.reason || null,
        change: Number(t.quantity_change) || 0,
        balance: t.balance_after === null || t.balance_after === undefined ? null : Number(t.balance_after),
        by: t.performed_by || '',
        note: t.note || ''
    }));

    const wasteByDay = new Map();
    for (const w of wasteRows) {
        const d = shopDayOfFn ? shopDayOfFn(new Date(w.sold_at)) : String(w.sold_at).slice(0, 10);
        wasteByDay.set(d, (wasteByDay.get(d) || 0) + (Number(w.quantity) || 0));
    }

    const computed = [
        ...salesDaily.filter(s => Number(s.quantity)).map(s => ({
            kind: 'sales', day: s.shop_day, label: 'ใช้ตามยอดขาย (คำนวณจากสูตร)',
            change: -Number(s.quantity), lines: Number(s.order_lines) || 0
        })),
        ...[...wasteByDay.entries()].filter(([, q]) => q).map(([d, q]) => ({
            kind: 'removed_waste', day: d, label: 'ทำแล้วทิ้ง (จากบิล)', change: -q
        }))
    ];

    // Group by shop day, newest first; computed lines sit at the end of their day.
    const days = new Map();
    for (const row of [...ledger, ...computed]) {
        const d = row.day || '';
        if (!days.has(d)) days.set(d, { day: d, ledger: [], computed: [] });
        days.get(d)[row.kind === 'ledger' ? 'ledger' : 'computed'].push(row);
    }
    return [...days.values()]
        .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0))
        .map(g => ({
            day: g.day,
            ledger: g.ledger.sort((a, b) => (a.at < b.at ? 1 : -1)),
            computed: g.computed,
            netLedger: Math.round(g.ledger.reduce((s, r) => s + r.change, 0) * 10000) / 10000
        }));
};
