/**
 * stockCount.js
 * Shared rules for stock counts and the daily reconciliation report.
 * Shop day runs 05:00 to 05:00 Asia/Bangkok (same as SQL stock_shop_day).
 */
import { THAI_UNITS } from './unitUtils';

export const SHOP_DAY_CUTOFF_HOUR = 5;
export const SHOP_TIMEZONE = 'Asia/Bangkok';

export const COUNT_KINDS = Object.freeze({
    opening: { label: 'เปิดร้าน', blindByDefault: false },
    spot: { label: 'ระหว่างวัน', blindByDefault: false },
    closing: { label: 'ปิดร้าน', blindByDefault: true }
});

/** Hour and date (YYYY-MM-DD) in the shop's time zone. */
const shopClock = (date) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: SHOP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'
    }).formatToParts(date);
    const get = (type) => parts.find(p => p.type === type)?.value;
    return { ymd: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
};

const shiftYmd = (ymd, days) => {
    const [y, m, d] = ymd.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d + days));
    return t.toISOString().slice(0, 10);
};

/** Shop day (YYYY-MM-DD) a moment belongs to; before 05:00 counts as the previous day. */
export const shopDayOf = (date = new Date()) => {
    const { ymd, hour } = shopClock(date);
    return hour < SHOP_DAY_CUTOFF_HOUR ? shiftYmd(ymd, -1) : ymd;
};

export const addDays = shiftYmd;

/** Sensible count type for the time of day: morning = opening, late = closing. */
export const defaultCountKind = (date = new Date()) => {
    const { hour } = shopClock(date);
    if (hour >= SHOP_DAY_CUTOFF_HOUR && hour < 15) return 'opening';
    if (hour >= 21 || hour < SHOP_DAY_CUTOFF_HOUR) return 'closing';
    return 'spot';
};

const UNIT_LABELS = Object.fromEntries(THAI_UNITS.map(u => [u.value, u.label.replace(/\s*\(.*\)\s*$/, '')]));

/** Thai label for a stored unit code ('bottle' -> 'ขวด'); free-text units pass through. */
export const displayUnit = (unit) => UNIT_LABELS[unit] || unit || '';

/** Parse a count typed by staff; returns null for empty or invalid input. */
export const parseCount = (raw) => {
    if (raw === null || raw === undefined) return null;
    const text = String(raw).trim().replace(',', '.');
    if (text === '') return null;
    const n = Number(text);
    return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Lines to send: only items with a valid count, one per item. */
export const buildCountLines = (counts = {}) => Object.entries(counts)
    .map(([id, raw]) => ({ stock_item_id: id, counted_qty: parseCount(raw) }))
    .filter(l => l.counted_qty !== null);

export const DEFAULT_THRESHOLDS = Object.freeze({ percent: 5, baht: 100 });

/**
 * A variance is abnormal when it is large both relative to what should be there and
 * in money, so a 1 g pinch of salt or a 3% wobble on a cheap item does not raise alarms.
 * Items without a price fall back to the percentage alone.
 */
export const isAbnormal = (row, thresholds = DEFAULT_THRESHOLDS) => {
    if (!row || row.variance === null || row.variance === undefined) return false;
    const variance = Number(row.variance);
    if (!Number.isFinite(variance) || variance === 0) return false;
    const expected = Math.abs(Number(row.expected_close) || 0);
    const pct = expected > 0 ? (Math.abs(variance) / expected) * 100 : 100;
    const value = Math.abs(Number(row.variance_value) || 0);
    const priced = Number(row.unit_cost) > 0;
    return pct > thresholds.percent && (!priced || value > thresholds.baht);
};

/** Totals for the report header. */
export const summarizeReconciliation = (rows = [], thresholds = DEFAULT_THRESHOLDS) => {
    const counted = rows.filter(r => r.closing_qty !== null && r.closing_qty !== undefined);
    const abnormal = counted.filter(r => isAbnormal(r, thresholds));
    const shortValue = counted.reduce((s, r) => s + Math.min(0, Number(r.variance_value) || 0), 0);
    const overValue = counted.reduce((s, r) => s + Math.max(0, Number(r.variance_value) || 0), 0);
    return {
        items: rows.length,
        counted: counted.length,
        notCounted: rows.length - counted.length,
        abnormal: abnormal.length,
        shortValue,
        overValue
    };
};

/** Abnormal first, then by size of the money variance, then by name. */
export const sortReconciliation = (rows = [], thresholds = DEFAULT_THRESHOLDS) => [...rows].sort((a, b) => {
    const ab = isAbnormal(b, thresholds) - isAbnormal(a, thresholds);
    if (ab !== 0) return ab;
    const vb = Math.abs(Number(b.variance_value) || 0) - Math.abs(Number(a.variance_value) || 0);
    if (vb !== 0) return vb;
    return String(a.name || '').localeCompare(String(b.name || ''), 'th');
});
