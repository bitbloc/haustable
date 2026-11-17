/**
 * stockCount.js
 * Shared rules for stock counts and the daily reconciliation report.
 * Shop day runs 05:00 to 05:00 Asia/Bangkok (same as SQL stock_shop_day).
 */
import { THAI_UNITS, getUnitType } from './unitUtils';

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

/**
 * Count type for the time of day: morning = opening, late = closing. The count screen has one
 * mode only; this label is filed with each count so the daily report, the Telegram closing
 * summary and the POS close-shift reminder keep finding the day's first and last count.
 */
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

/**
 * One tap on plus or minus. An empty (or unreadable) field starts from `base`: the amount the
 * system holds when the counter can see it, otherwise zero. Never goes below zero.
 */
export const stepCount = (raw, delta, base = 0) => {
    const current = parseCount(raw);
    const start = current ?? Math.max(0, Number(base) || 0);
    const next = Math.max(0, start + (Number(delta) || 0));
    return String(Math.round(next * 10000) / 10000);
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

/**
 * Yesterday's closing count -> today's opening count.
 * lines: stock_count_lines of closing sessions ({ stock_item_id, counted_qty, created_at })
 *        (several closing rounds possible: the latest per item wins)
 * Fills only empty fields of `counts`, only for items in `itemIds`.
 * Returns { counts, filled }.
 */
export const carryOverClosing = (lines = [], itemIds = new Set(), counts = {}) => {
    const latest = new Map();
    for (const l of lines) {
        const prev = latest.get(l.stock_item_id);
        if (!prev || String(l.created_at || '') >= String(prev.created_at || '')) latest.set(l.stock_item_id, l);
    }
    const next = { ...counts };
    let filled = 0;
    for (const [id, l] of latest) {
        if (!itemIds.has(id)) continue;
        if (String(next[id] ?? '').trim() !== '') continue;
        const n = Number(l.counted_qty);
        if (!Number.isFinite(n)) continue;
        next[id] = String(Math.round(n * 10000) / 10000);
        filled += 1;
    }
    return { counts: next, filled };
};

export const THRESHOLD_KEYS = Object.freeze({ percent: 'stock_variance_percent', baht: 'stock_variance_baht' });

/** app_settings rows -> thresholds; anything missing or invalid falls back to the default. */
export const thresholdsFromSettings = (rows = []) => {
    const get = (k) => {
        const v = Number((rows.find(r => r.key === k) || {}).value);
        return Number.isFinite(v) && v >= 0 ? v : null;
    };
    return {
        percent: get(THRESHOLD_KEYS.percent) ?? DEFAULT_THRESHOLDS.percent,
        baht: get(THRESHOLD_KEYS.baht) ?? DEFAULT_THRESHOLDS.baht
    };
};

/** Short labels for amounts written inside a table cell. */
const SHORT_UNITS = { g: 'ก.', kg: 'กก.', ml: 'มล.', l: 'ล.', unit: 'ชิ้น' };
const shortUnit = (u) => SHORT_UNITS[u] || displayUnit(u);

/**
 * A stock quantity in counting units (packs) written the way staff count it: whole packs plus
 * the loose remainder in the usage unit, e.g. 14.98 packs of 50 cups -> "14 แพ็ค 49 แก้ว",
 * 5.97 gallons of 1000 ml -> "5 แกลอน 967 มล.", -0.02 packs of 1000 g -> "-20 ก.".
 * Grams and millilitres are whole numbers (nobody weighs 0.3 ml). Returns null when the item
 * has no pack-to-usage conversion (factor <= 1), so the caller keeps its plain number.
 */
export function formatPackQty(qty, { factor, packUnit, usageUnit } = {}) {
    if (qty === null || qty === undefined) return null;
    const n = Number(qty);
    const f = Number(factor);
    if (!Number.isFinite(n) || !(f > 1)) return null;
    if (n === 0) return '0';
    const sign = n < 0 ? '-' : '';
    const step = (usageUnit === 'g' || usageUnit === 'ml') ? 1 : 0.01;
    const totalUsage = Math.round(Math.abs(n) * f / step) * step;
    let packs = Math.floor((totalUsage + 1e-9) / f);
    let rest = Math.round((totalUsage - packs * f) / step) * step;
    if (rest >= f - 1e-9) { packs += 1; rest = 0; }
    if (packs === 0 && rest === 0) return `${sign}<1 ${shortUnit(usageUnit)}`;
    const parts = [];
    if (packs > 0) parts.push(`${packs.toLocaleString('th-TH')} ${shortUnit(packUnit)}`.trim());
    if (rest > 0) parts.push(`${Number(rest.toFixed(2)).toLocaleString('th-TH', { maximumFractionDigits: 2 })} ${shortUnit(usageUnit)}`.trim());
    return sign + parts.join(' ');
}

/* ── Counting without decimals ──────────────────────────────────────────────────────────────
 * Staff count "2 full bottles and one open with about 140 ml left", never "2.2". The count sheet
 * keeps the unopened units in the field and the opened one as a fraction beside it; the two are
 * added only when the count is saved. Things weighed or poured loose (kg, litres) stay one amount.
 */
const round4 = (n) => Math.round(n * 10000) / 10000;

/** True for bottles, packs, pieces: counted whole, with at most one opened. */
export const countsWholeUnits = (item) => !['mass', 'volume'].includes(getUnitType(item?.unit || item?.pack_unit));

/** 2.2 -> { whole: 2, frac: 0.2 }. Negative or unreadable amounts count as nothing. */
export const splitQty = (qty) => {
    const n = Math.max(0, Number(qty) || 0);
    const whole = Math.floor(n + 1e-9);
    const frac = round4(n - whole);
    return frac >= 0.9999 ? { whole: whole + 1, frac: 0 } : { whole, frac: Math.max(0, frac) };
};

/**
 * Whole units and the opened part as staff would say it: a part that rounds to nothing in the
 * usage unit (5.0002 crates = 60 bottles and a rounding crumb) is no opened unit, and one that
 * rounds to a full unit is one more whole unit.
 */
const splitSaid = (n, capacity) => {
    const { whole, frac } = splitQty(n);
    if (!capacity || !frac) return { whole, frac };
    const left = Math.round(frac * capacity.amount);
    if (left <= 0) return { whole, frac: 0 };
    if (left >= capacity.amount) return { whole: whole + 1, frac: 0 };
    return { whole, frac };
};

/** What is left in the opened unit: "140 มล." when the pack size is known, else "20%". */
export const openLeftText = (frac, capacity = null) => (capacity
    ? `${Math.round(frac * capacity.amount).toLocaleString('th-TH')} ${shortUnit(capacity.unit)}`
    : `${Math.round(frac * 100)}%`);

/**
 * An amount in words: "2 ขวด + เปิดอยู่ 1 เหลือ 140 มล.", "7 ขวด", "1 กก. 700 ก.".
 * capacity: fullUnitCapacity(item) or null.
 */
export const qtyInWords = (item, qty, capacity = null) => {
    const unit = displayUnit(item?.unit || item?.pack_unit);
    // A balance below zero (sold more than was received) is said as it is, never shown as 0
    if (Number(qty) < -0.00005) return `ติดลบ ${qtyInWords(item, -Number(qty), capacity)}`;
    const n = Math.max(0, Number(qty) || 0);
    if (!countsWholeUnits(item)) {
        const packed = ['g', 'ml'].includes(String(item?.usage_unit || '').toLowerCase())
            ? formatPackQty(n, { factor: item?.conversion_factor, packUnit: item?.unit || item?.pack_unit, usageUnit: item?.usage_unit })
            : null;
        return packed && packed !== '0' ? packed : `${round4(n).toLocaleString('th-TH', { maximumFractionDigits: 2 })} ${unit}`.trim();
    }
    const { whole, frac } = splitSaid(n, capacity);
    if (!frac) return `${whole.toLocaleString('th-TH')} ${unit}`.trim();
    const open = `เปิดอยู่ 1 เหลือ ${openLeftText(frac, capacity)}`;
    return whole > 0 ? `${whole.toLocaleString('th-TH')} ${unit} + ${open}` : open;
};

/** A difference in words with its sign: "-1 ขวด 140 มล.", "+2 แพ็ค", "ตรง". */
export const diffInWords = (item, diff, capacity = null) => {
    const n = Number(diff) || 0;
    if (Math.abs(n) < 0.00005) return 'ตรง';
    const sign = n < 0 ? '-' : '+';
    if (!countsWholeUnits(item)) return sign + qtyInWords(item, Math.abs(n), capacity);
    const unit = displayUnit(item?.unit || item?.pack_unit);
    const { whole, frac } = splitSaid(Math.abs(n), capacity);
    if (!whole && !frac) return 'ตรง';
    const parts = [];
    if (whole > 0) parts.push(`${whole.toLocaleString('th-TH')} ${unit}`.trim());
    if (frac > 0) parts.push(openLeftText(frac, capacity));
    return sign + parts.join(' ');
};

/**
 * True for a pack of countable pieces (a pack of 50 cups, a sleeve of 100 lids). Staff count these
 * as full packs, as loose pieces, or both, so the sheet gives them one field for each.
 * capacity: packCapacity(item).
 */
export const countsInPieces = (item, capacity) => !!capacity && Number(capacity.amount) > 1
    && countsWholeUnits(item) && !['mass', 'volume'].includes(getUnitType(capacity.unit));

/** A count in packs said as packs and pieces: 14.4 packs of 50 -> { packs: 14, rest: 20, pieces: 720 }. */
export const splitPieces = (qty, capAmount) => {
    const cap = Number(capAmount) || 0;
    const pieces = Math.max(0, Math.round((Number(qty) || 0) * cap));
    const packs = cap > 0 ? Math.floor(pieces / cap) : 0;
    return { packs, rest: pieces - packs * cap, pieces };
};

/**
 * Full packs + loose pieces -> the counts to save, in packs. `loose` holds what was typed in the
 * pieces field (any number: all 720 cups may be typed there with the packs field left empty);
 * `capacities` maps item id -> pieces per pack. A pieces field that cannot be read is skipped
 * (the screen flags it), and so is an unreadable packs field.
 */
export const mergeLoosePieces = (counts = {}, loose = {}, capacities = {}) => {
    const out = { ...counts };
    for (const [id, raw] of Object.entries(loose)) {
        if (String(raw ?? '').trim() === '') continue;
        const cap = Number(capacities[id]);
        const pieces = parseCount(raw);
        if (!(cap > 1) || pieces === null) continue;
        const blank = String(counts[id] ?? '').trim() === '';
        const packs = blank ? 0 : parseCount(counts[id]);
        if (packs === null) continue;
        out[id] = String(round4(packs + pieces / cap));
    }
    return out;
};

/**
 * Field values + opened fractions -> the counts to save. An item with only an opened unit counts
 * as zero full ones. A field that cannot be read is passed through so it is still flagged.
 */
export const mergeOpenLeft = (counts = {}, openLeft = {}) => {
    const out = { ...counts };
    for (const [id, f] of Object.entries(openLeft)) {
        const frac = Number(f);
        if (!(frac > 0)) continue;
        const blank = String(counts[id] ?? '').trim() === '';
        const n = blank ? 0 : parseCount(counts[id]);
        if (n === null) continue;
        out[id] = String(round4(n + frac));
    }
    return out;
};
