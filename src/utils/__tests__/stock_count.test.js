import { describe, it, expect } from 'vitest';
import {
    shopDayOf, addDays, defaultCountKind, displayUnit, parseCount, buildCountLines, stepCount,
    countsWholeUnits, splitQty, openLeftText, qtyInWords, diffInWords, mergeOpenLeft,
    countsInPieces, splitPieces, mergeLoosePieces,
    isAbnormal, summarizeReconciliation, sortReconciliation, carryOverClosing, thresholdsFromSettings,
    classifyReconRow, defaultReconFilter, formatReconQty, cleanCategoryLabel
} from '../stockCount';

// Bangkok is UTC+7 all year.
const bkk = (iso) => new Date(iso + '+07:00');

describe('shop day', () => {
    it('runs 05:00 to 05:00 Bangkok time', () => {
        expect(shopDayOf(bkk('2026-11-14T10:00:00'))).toBe('2026-11-14');
        expect(shopDayOf(bkk('2026-11-14T23:59:00'))).toBe('2026-11-14');
        expect(shopDayOf(bkk('2026-11-15T02:30:00'))).toBe('2026-11-14');
        expect(shopDayOf(bkk('2026-11-15T05:00:00'))).toBe('2026-11-15');
    });

    it('crosses month and year boundaries', () => {
        expect(shopDayOf(bkk('2027-01-01T01:00:00'))).toBe('2026-12-31');
        expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
        expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    });

    it('suggests the count type for the time of day', () => {
        expect(defaultCountKind(bkk('2026-11-14T10:00:00'))).toBe('opening');
        expect(defaultCountKind(bkk('2026-11-14T18:00:00'))).toBe('spot');
        expect(defaultCountKind(bkk('2026-11-14T22:30:00'))).toBe('closing');
        expect(defaultCountKind(bkk('2026-11-15T01:00:00'))).toBe('closing');
    });
});

describe('count input', () => {
    it('labels unit codes in Thai and passes free text through', () => {
        expect(displayUnit('bottle')).toBe('ขวด');
        expect(displayUnit('kg')).toBe('กิโลกรัม');
        expect(displayUnit('แพ็ค')).toBe('แพ็ค');
        expect(displayUnit(null)).toBe('');
    });

    it('accepts decimals and a comma, rejects blanks and negatives', () => {
        expect(parseCount('12')).toBe(12);
        expect(parseCount('0')).toBe(0);
        expect(parseCount('1,5')).toBe(1.5);
        expect(parseCount(' 2.25 ')).toBe(2.25);
        expect(parseCount('')).toBeNull();
        expect(parseCount('-1')).toBeNull();
        expect(parseCount('abc')).toBeNull();
    });

    it('sends only filled counts, zero included', () => {
        expect(buildCountLines({ a: '3', b: '', c: '0', d: 'x' })).toEqual([
            { stock_item_id: 'a', counted_qty: 3 },
            { stock_item_id: 'c', counted_qty: 0 }
        ]);
    });
});

describe('reconciliation', () => {
    const soda = { name: 'โซดา', expected_close: 18, closing_qty: 17, variance: -1, unit_cost: 13, variance_value: -13 };
    const whisky = { name: 'Jameson', expected_close: 2, closing_qty: 1.4, variance: -0.6, unit_cost: 1049, variance_value: -629.4 };
    const salt = { name: 'เกลือ', expected_close: 2, closing_qty: 1.5, variance: -0.5, unit_cost: 20, variance_value: -10 };
    const unpriced = { name: 'ยูซุ', expected_close: 1, closing_qty: 0.5, variance: -0.5, unit_cost: 0, variance_value: 0 };
    const notCounted = { name: 'ชาไทย', expected_close: 3, closing_qty: null, variance: null, unit_cost: 109, variance_value: null };
    const exact = { name: 'เบียร์', expected_close: 28, closing_qty: 28, variance: 0, unit_cost: 55, variance_value: 0 };

    it('needs both a real percentage and real money', () => {
        expect(isAbnormal(whisky)).toBe(true);      // 30%, ฿629
        expect(isAbnormal(soda)).toBe(false);       // 5.6% but ฿13
        expect(isAbnormal(salt)).toBe(false);       // 25% but ฿10
        expect(isAbnormal(unpriced)).toBe(true);    // no price: percentage alone
        expect(isAbnormal(notCounted)).toBe(false);
        expect(isAbnormal(exact)).toBe(false);
    });

    it('counts a missing item with nothing expected as abnormal', () => {
        expect(isAbnormal({ expected_close: 0, closing_qty: 2, variance: 2, unit_cost: 500, variance_value: 1000 })).toBe(true);
    });

    it('summarizes shortage and overage separately', () => {
        const s = summarizeReconciliation([soda, whisky, salt, unpriced, notCounted, exact,
            { name: 'x', expected_close: 10, closing_qty: 11, variance: 1, unit_cost: 30, variance_value: 30 }]);
        expect(s).toMatchObject({ items: 7, counted: 6, notCounted: 1, abnormal: 2 });
        expect(s.shortValue).toBeCloseTo(-652.4);
        expect(s.overValue).toBeCloseTo(30);
    });

    it('puts abnormal items first, then the biggest money variance', () => {
        expect(sortReconciliation([salt, soda, whisky, unpriced, exact]).map(r => r.name))
            .toEqual(['Jameson', 'ยูซุ', 'โซดา', 'เกลือ', 'เบียร์']);
    });
});

describe('carryOverClosing', () => {
    const lines = [
        { stock_item_id: 'milk', counted_qty: 3, created_at: '2026-11-14T15:00:00Z' },
        { stock_item_id: 'milk', counted_qty: 2.5, created_at: '2026-11-14T16:00:00Z' },
        { stock_item_id: 'soda', counted_qty: 12, created_at: '2026-11-14T15:00:00Z' },
        { stock_item_id: 'gone', counted_qty: 1, created_at: '2026-11-14T15:00:00Z' }
    ];
    it('uses the latest closing count and keeps what is already typed', () => {
        const res = carryOverClosing(lines, new Set(['milk', 'soda']), { soda: '11' });
        expect(res).toEqual({ counts: { milk: '2.5', soda: '11' }, filled: 1 });
    });
});

describe('thresholdsFromSettings', () => {
    it('reads the two settings and falls back to 5% / ฿100', () => {
        expect(thresholdsFromSettings([])).toEqual({ percent: 5, baht: 100 });
        expect(thresholdsFromSettings([{ key: 'stock_variance_percent', value: '8' }, { key: 'stock_variance_baht', value: '50' }])).toEqual({ percent: 8, baht: 50 });
        expect(thresholdsFromSettings([{ key: 'stock_variance_percent', value: 'abc' }])).toEqual({ percent: 5, baht: 100 });
    });
    it('changes what counts as abnormal', () => {
        const row = { closing_qty: 9, variance: -1, expected_close: 10, variance_value: -80, unit_cost: 80 };
        expect(isAbnormal(row)).toBe(false);
        expect(isAbnormal(row, { percent: 5, baht: 50 })).toBe(true);
    });
});

describe('stepCount (plus / minus on the count sheet)', () => {
    it('moves a typed count by one and keeps the decimals of an open bottle', () => {
        expect(stepCount('7', 1)).toBe('8');
        expect(stepCount('7', -1)).toBe('6');
        expect(stepCount('1,2', 1)).toBe('2.2');
        expect(stepCount('0.45', 1)).toBe('1.45');
    });
    it('starts an empty field from the amount in the system, or from zero when it is hidden', () => {
        expect(stepCount('', -1, 7)).toBe('6');
        expect(stepCount(undefined, 1, 7)).toBe('8');
        expect(stepCount('', 1)).toBe('1');
        expect(stepCount('', 1, -3)).toBe('1');
        expect(stepCount('abc', 1, 2)).toBe('3');
    });
    it('never goes below zero', () => {
        expect(stepCount('0.45', -1)).toBe('0');
        expect(stepCount('', -1)).toBe('0');
        expect(stepCount('', -1, 0.5)).toBe('0');
    });
});

describe('amounts in words, no decimals', () => {
    const gin = { unit: 'bottle', pack_unit: 'bottle', usage_unit: 'ml', conversion_factor: 700 };
    const ml700 = { amount: 700, unit: 'ml' };
    const lager = { unit: 'unit', pack_unit: 'unit', usage_unit: 'unit', conversion_factor: 1 };
    const acid = { unit: 'kg', pack_unit: 'kg', usage_unit: 'g', conversion_factor: 1000 };

    it('splits bottles into full ones and the opened one', () => {
        expect(splitQty(2.2)).toEqual({ whole: 2, frac: 0.2 });
        expect(splitQty(7)).toEqual({ whole: 7, frac: 0 });
        expect(splitQty(0.99999)).toEqual({ whole: 1, frac: 0 });
        expect(splitQty(-3)).toEqual({ whole: 0, frac: 0 });
        expect(countsWholeUnits(gin)).toBe(true);
        expect(countsWholeUnits(acid)).toBe(false);
    });
    it('says what is left in the opened one by pack size, or as a percentage', () => {
        expect(openLeftText(0.2, ml700)).toBe('140 มล.');
        expect(openLeftText(0.45)).toBe('45%');
    });
    it('writes the amount the way it is counted on the shelf', () => {
        expect(qtyInWords(gin, 0.45, ml700)).toBe('เปิดอยู่ 1 เหลือ 315 มล.');
        expect(qtyInWords(gin, 1.2, ml700)).toBe('1 ขวด + เปิดอยู่ 1 เหลือ 140 มล.');
        expect(qtyInWords(gin, 3, ml700)).toBe('3 ขวด');
        expect(qtyInWords(lager, 7)).toBe('7 หน่วย/ชิ้น');
        expect(qtyInWords(lager, 0.5)).toBe('เปิดอยู่ 1 เหลือ 50%');
        expect(qtyInWords(acid, 1.7)).toBe('1 กก. 700 ก.');
        expect(qtyInWords(acid, 0)).toBe('0 กิโลกรัม');
        expect(qtyInWords(gin, -2, ml700)).toBe('ติดลบ 2 ขวด');
        expect(qtyInWords(acid, -0.25)).toBe('ติดลบ 250 ก.');
    });
    it('writes a difference with its sign', () => {
        expect(diffInWords(gin, -1.2, ml700)).toBe('-1 ขวด 140 มล.');
        expect(diffInWords(gin, 2, ml700)).toBe('+2 ขวด');
        expect(diffInWords(gin, 0, ml700)).toBe('ตรง');
        expect(diffInWords(acid, -0.25)).toBe('-250 ก.');
    });
    it('adds the opened one to the full ones only when saving', () => {
        expect(mergeOpenLeft({ a: '2', b: '', c: 'x', d: '5' }, { a: 0.2, b: 0.5, c: 0.3 }))
            .toEqual({ a: '2.2', b: '0.5', c: 'x', d: '5' });
        expect(buildCountLines(mergeOpenLeft({}, { b: 0.5 }))).toEqual([{ stock_item_id: 'b', counted_qty: 0.5 }]);
    });
});

describe('packs counted as packs, pieces, or both', () => {
    const cups = { unit: 'pack', usage_unit: 'แก้ว', conversion_factor: 50 };

    it('only packs of countable pieces get the two fields', () => {
        expect(countsInPieces(cups, { amount: 50, unit: 'แก้ว' })).toBe(true);
        expect(countsInPieces({ unit: 'bottle' }, { amount: 700, unit: 'ml' })).toBe(false); // a bottle is poured, not counted out
        expect(countsInPieces({ unit: 'kg' }, { amount: 1000, unit: 'g' })).toBe(false);
        expect(countsInPieces(cups, null)).toBe(false);
    });

    it('full packs and loose pieces add up to one count in packs', () => {
        expect(mergeLoosePieces({ a: '14' }, { a: '20' }, { a: 50 })).toEqual({ a: '14.4' });
    });

    it('everything may be counted in pieces with the packs field left empty', () => {
        expect(mergeLoosePieces({}, { a: '720' }, { a: 50 })).toEqual({ a: '14.4' });
        expect(buildCountLines(mergeLoosePieces({}, { a: '975' }, { a: 25 }))).toEqual([{ stock_item_id: 'a', counted_qty: 39 }]);
    });

    it('an empty or unreadable pieces field changes nothing', () => {
        expect(mergeLoosePieces({ a: '14' }, { a: '' }, { a: 50 })).toEqual({ a: '14' });
        expect(mergeLoosePieces({ a: '14' }, { a: 'x' }, { a: 50 })).toEqual({ a: '14' });
        expect(mergeLoosePieces({ a: '14' }, { b: '5' }, { a: 50 })).toEqual({ a: '14' }); // not a pack item
    });

    it('says a count back as packs and pieces', () => {
        expect(splitPieces(14.4, 50)).toEqual({ packs: 14, rest: 20, pieces: 720 });
        expect(splitPieces(39, 25)).toEqual({ packs: 39, rest: 0, pieces: 975 });
        expect(splitPieces(7 / 110, 110)).toEqual({ packs: 0, rest: 7, pieces: 7 });
    });
});

describe('recon UX helpers: classifyReconRow, defaultReconFilter, formatReconQty', () => {
    it('classifies counted and uncounted rows with shadow-mode hints', () => {
        expect(classifyReconRow({ closing_qty: null, sales_usage: 0.5 }).status).toBe('uncounted_sold');
        expect(classifyReconRow({ closing_qty: null, sales_usage: 0 }).status).toBe('uncounted');
        expect(classifyReconRow({ closing_qty: 10, expected_close: 10, variance: 0, unit_cost: 50, variance_value: 0 }).status).toBe('exact');

        const typo = classifyReconRow({ closing_qty: 1000000, expected_close: 0, variance: 1000000, unit_cost: 0, variance_value: 0, sales_usage: 0 });
        expect(typo.status).toBe('abnormal_over');
        expect(typo.hint).toContain('ตรวจหน่วยหรือตัวเลข');

        const dupRecv = classifyReconRow({ closing_qty: 14, received: 14, expected_close: 19, variance: -5, unit_cost: 120, variance_value: -600, sales_usage: 0 });
        expect(dupRecv.status).toBe('abnormal_short');
        expect(dupRecv.hint).toContain('รับเข้า');

        const recipeShort = classifyReconRow({ closing_qty: 3, expected_close: 5, variance: -2, unit_cost: 200, variance_value: -400, sales_usage: 1.5 });
        expect(recipeShort.status).toBe('abnormal_short');
        expect(recipeShort.pct).toBe(-40);
        expect(recipeShort.hint).toContain('สูตร');
    });

    it('picks the best non-empty default filter for a day', () => {
        expect(defaultReconFilter([{ closing_qty: 1, expected_close: 10, variance: -9, unit_cost: 100, variance_value: -900 }])).toBe('abnormal');
        expect(defaultReconFilter([{ closing_qty: 10, expected_close: 10, variance: 0, unit_cost: 100, variance_value: 0 }])).toBe('counted');
        expect(defaultReconFilter([{ closing_qty: null, sales_usage: 2 }])).toBe('sold');
        expect(defaultReconFilter([])).toBe('all');
    });

    it('formats pack, piece, and plain unit quantities cleanly', () => {
        expect(formatReconQty(1.4167, { unit: 'crate', factor: 12, usageUnit: 'bottle' })).toBe('17 ขวด');
        expect(formatReconQty(-0.02, { unit: 'pack', factor: 1000, usageUnit: 'g' })).toBe('-20 ก.');
        expect(formatReconQty(14, { unit: 'bag', factor: 1, usageUnit: 'bag' })).toBe('14 ถุง');
        expect(formatReconQty(0, { unit: 'kg', factor: 1 })).toBe('0');
        expect(formatReconQty(null, { unit: 'kg', factor: 1 })).toBe('—');
        expect(cleanCategoryLabel('🥬 ผัก (Veg)')).toBe('ผัก (Veg)');
    });
});
