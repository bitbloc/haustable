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
 * Only days with a physical count contribute. Worst money loss first, then most abnormal days.
 */
export const rankVariance = (dayResults = [], thresholds = DEFAULT_THRESHOLDS) => {
    const byItem = new Map();
    for (const { day, rows } of dayResults) {
        for (const r of rows || []) {
            if (r.closing_qty === null || r.closing_qty === undefined || r.variance === null || r.variance === undefined) continue;
            const e = byItem.get(r.stock_item_id) || {
                stock_item_id: r.stock_item_id, name: r.name, category: r.category || '', unit: r.unit, priced: false,
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
            if (!e.category && r.category) e.category = r.category;
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
 * tx:            stock_transactions rows
 * salesDaily:    [{ shop_day, quantity, order_lines }] from sale_stock_shadow_daily
 * wasteRows:     sale_stock_shadow rows with source 'waste' ({ sold_at, quantity })
 * shadowDetails: optional per-order-line shadow rows ({ sold_at, menu_name, source, quantity, order_quantity })
 */
export const buildStockCard = (tx = [], salesDaily = [], wasteRows = [], shopDayOfFn, shadowDetails = []) => {
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

    const breakdownByDay = new Map();
    for (const row of shadowDetails || []) {
        if (!row || (row.source && row.source !== 'recipe' && row.source !== 'option')) continue;
        const q = Number(row.quantity) || 0;
        if (!q) continue;
        const d = row.shop_day || (shopDayOfFn && row.sold_at ? shopDayOfFn(new Date(row.sold_at)) : String(row.sold_at || '').slice(0, 10));
        if (!d) continue;
        const name = row.menu_name || 'เมนูไม่ระบุชื่อ';
        const key = `${name}::${row.source || 'recipe'}`;
        if (!breakdownByDay.has(d)) breakdownByDay.set(d, new Map());
        const map = breakdownByDay.get(d);
        const cur = map.get(key) || { name, source: row.source || 'recipe', qty: 0, orders: 0 };
        cur.qty += q;
        cur.orders += Number(row.order_quantity) || 1;
        map.set(key, cur);
    }

    const round4 = (n) => Math.round(n * 10000) / 10000;
    const computed = [
        ...salesDaily.filter(s => Number(s.quantity)).map(s => {
            const itemsMap = breakdownByDay.get(s.shop_day);
            const breakdown = itemsMap
                ? [...itemsMap.values()]
                    .map(b => ({ ...b, qty: round4(b.qty) }))
                    .sort((a, b) => b.qty - a.qty || String(a.name).localeCompare(String(b.name), 'th'))
                : null;
            return {
                kind: 'sales', day: s.shop_day, label: 'ใช้ตามยอดขาย (คำนวณจากสูตร)',
                change: -Number(s.quantity), lines: Number(s.order_lines) || 0,
                ...(breakdown && breakdown.length > 0 ? { breakdown } : {})
            };
        }),
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

/**
 * Aggregate raw stock_count_sessions (which can have 100+ single-item spot sessions per day)
 * into concise summary groups per (kind, performed_by) with total entries and time window.
 */
export const groupCountSessions = (sessions = []) => {
    const order = { closing: 0, opening: 1, spot: 2 };
    const map = new Map();
    for (const s of sessions || []) {
        const kind = s.kind || 'spot';
        const by = (s.performed_by || '').trim() || 'ไม่ระบุ';
        const key = `${kind}:${by}`;
        const cur = map.get(key) || {
            key, kind, performedBy: by, sessionsCount: 0, lineCount: 0,
            firstAt: s.created_at || null, lastAt: s.created_at || null, blind: false
        };
        cur.sessionsCount += 1;
        cur.lineCount += Number(s.line_count) || 0;
        if (s.blind) cur.blind = true;
        if (s.created_at && (!cur.firstAt || s.created_at < cur.firstAt)) cur.firstAt = s.created_at;
        if (s.created_at && (!cur.lastAt || s.created_at > cur.lastAt)) cur.lastAt = s.created_at;
        map.set(key, cur);
    }
    return [...map.values()].sort((a, b) =>
        (order[a.kind] ?? 9) - (order[b.kind] ?? 9)
        || b.lineCount - a.lineCount
        || String(a.performedBy).localeCompare(String(b.performedBy), 'th'));
};

/**
 * What to count in a mid-day spot check (3-5 items, not everything):
 *   1. items that came up short or abnormal at recent closing counts, biggest loss first
 *   2. then the most valuable stock on hand that nobody counted recently
 * ranked:      rankVariance(...) rows
 * items:       stock items on the count list
 * lastCounted: Map item id -> ISO time of its last count
 * unitCostOf:  item -> baht per counted unit
 * Returns [{ item, why }].
 */
export const suggestSpotCount = ({ ranked = [], items = [], lastCounted = new Map(), unitCostOf = () => 0, now = new Date(), limit = 5, freshHours = 72 }) => {
    const byId = new Map(items.map(i => [i.id, i]));
    const picked = [];
    const seen = new Set();
    const recent = (id) => {
        const t = lastCounted.get(id);
        return t && (now.getTime() - new Date(t).getTime()) < freshHours * 3600 * 1000;
    };

    for (const r of ranked) {
        if (picked.length >= limit) break;
        const item = byId.get(r.stock_item_id);
        if (!item || seen.has(item.id)) continue;
        if (!(r.abnormalDays > 0 || r.shortValue < 0)) continue;
        seen.add(item.id);
        picked.push({ item, why: r.shortValue < 0 ? `ขาดสะสม ฿${Math.round(Math.abs(r.shortValue)).toLocaleString('en-US')}` : `ผิดปกติ ${r.abnormalDays} วัน` });
    }

    const byValue = items
        .filter(i => !seen.has(i.id) && !recent(i.id))
        .map(i => ({ i, value: (Number(i.current_quantity) || 0) * (Number(unitCostOf(i)) || 0) }))
        .filter(x => x.value > 0)
        .sort((a, b) => b.value - a.value);
    for (const { i, value } of byValue) {
        if (picked.length >= limit) break;
        seen.add(i.id);
        picked.push({ item: i, why: `มูลค่าในระบบ ฿${Math.round(value).toLocaleString('en-US')} ยังไม่ได้นับ ${freshHours / 24} วัน` });
    }
    return picked;
};

/**
 * Variance per person who did the count, over several days.
 * dayResults:       [{ day, rows }] (stock_daily_reconciliation)
 * closingBy:        Map day -> [names] of the count sessions that day
 * counterByDayItem: optional Map `${day}:${stock_item_id}` -> performed_by (exact per-item attribution)
 * Returns rows sorted by money short: { name, days, items, abnormal, shortValue }.
 */
export const rankByCounter = (dayResults = [], closingBy = new Map(), thresholds = DEFAULT_THRESHOLDS, counterByDayItem = null) => {
    const acc = new Map();
    if (counterByDayItem && counterByDayItem.size > 0) {
        for (const { day, rows } of dayResults) {
            const counted = (rows || []).filter(r => r.closing_qty !== null && r.closing_qty !== undefined && r.variance !== null && r.variance !== undefined);
            for (const r of counted) {
                const rawName = counterByDayItem.get(`${day}:${r.stock_item_id}`);
                const fallbackNames = [...new Set((closingBy.get(day) || []).filter(Boolean))];
                const name = rawName || (fallbackNames.length ? fallbackNames.join(', ') : 'ไม่ระบุ');
                const e = acc.get(name) || { name, daySet: new Set(), items: 0, abnormal: 0, shortValue: 0 };
                e.daySet.add(day);
                e.items += 1;
                if (isAbnormal(r, thresholds)) e.abnormal += 1;
                e.shortValue += Math.min(0, Number(r.variance_value) || 0);
                acc.set(name, e);
            }
        }
        return [...acc.values()]
            .map(e => ({ name: e.name, days: e.daySet.size, items: e.items, abnormal: e.abnormal, shortValue: Math.round(e.shortValue * 100) / 100 }))
            .sort((a, b) => a.shortValue - b.shortValue || b.abnormal - a.abnormal || String(a.name).localeCompare(String(b.name), 'th'));
    }

    for (const { day, rows } of dayResults) {
        const counted = (rows || []).filter(r => r.closing_qty !== null && r.closing_qty !== undefined && r.variance !== null && r.variance !== undefined);
        if (!counted.length) continue;
        const names = [...new Set((closingBy.get(day) || []).filter(Boolean))];
        const name = names.length ? names.join(', ') : 'ไม่ระบุ';
        const e = acc.get(name) || { name, days: 0, items: 0, abnormal: 0, shortValue: 0 };
        e.days += 1;
        e.items += counted.length;
        e.abnormal += counted.filter(r => isAbnormal(r, thresholds)).length;
        e.shortValue += counted.reduce((s, r) => s + Math.min(0, Number(r.variance_value) || 0), 0);
        acc.set(name, e);
    }
    return [...acc.values()]
        .map(e => ({ ...e, shortValue: Math.round(e.shortValue * 100) / 100 }))
        .sort((a, b) => a.shortValue - b.shortValue || b.abnormal - a.abnormal);
};

/** Columns of the withdrawal summary, in display order. */
export const WITHDRAW_BUCKETS = Object.freeze(['waste', 'staff_meal', 'production_out', 'other']);

/**
 * Stock taken out over a period, per item, split by reason.
 * Count corrections (count_adjust / set) are not usage: they are variance and live in Stock Recon.
 * tx: stock_transactions rows with stock_items(name, unit) joined.
 * Returns [{ stock_item_id, name, unit, waste, staff_meal, production_out, other, total, count }], biggest total first.
 */
export const summarizeWithdrawals = (tx = []) => {
    const byItem = new Map();
    for (const t of tx) {
        const change = Number(t.quantity_change) || 0;
        if (change >= 0) continue;
        if (t.reason === 'count_adjust' || t.transaction_type === 'set') continue;
        const id = t.stock_item_id || t.stock_items?.name;
        if (!id) continue;
        const e = byItem.get(id) || {
            stock_item_id: t.stock_item_id || null, name: t.stock_items?.name || 'ไม่ทราบชื่อ', unit: t.stock_items?.unit || '',
            waste: 0, staff_meal: 0, production_out: 0, other: 0, total: 0, count: 0
        };
        const bucket = WITHDRAW_BUCKETS.includes(t.reason) ? t.reason : 'other';
        e[bucket] += -change;
        e.total += -change;
        e.count += 1;
        byItem.set(id, e);
    }
    const r = (n) => Math.round(n * 10000) / 10000;
    return [...byItem.values()]
        .map(e => ({ ...e, waste: r(e.waste), staff_meal: r(e.staff_meal), production_out: r(e.production_out), other: r(e.other), total: r(e.total) }))
        .sort((a, b) => b.total - a.total || String(a.name).localeCompare(String(b.name), 'th'));
};

/** Ledger filter used by the movement history list. */
export const TX_FILTERS = Object.freeze({
    all: () => true,
    in: (t) => Number(t.quantity_change) > 0 && t.reason !== 'count_adjust' && t.transaction_type !== 'set',
    out: (t) => Number(t.quantity_change) < 0 && t.reason !== 'count_adjust' && t.transaction_type !== 'set',
    count: (t) => t.reason === 'count_adjust' || t.transaction_type === 'set'
});
