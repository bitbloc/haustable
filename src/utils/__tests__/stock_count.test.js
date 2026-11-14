import { describe, it, expect } from 'vitest';
import {
    shopDayOf, addDays, defaultCountKind, displayUnit, parseCount, buildCountLines,
    isAbnormal, summarizeReconciliation, sortReconciliation, carryOverClosing, thresholdsFromSettings
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
