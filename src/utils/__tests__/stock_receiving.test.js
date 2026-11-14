import { describe, it, expect } from 'vitest';
import { countUnitCost, validateReceiveLines, priceChange, expenseProblem } from '../stockReceiving';

const soda = { item_type: 'raw', unit: 'bottle', usage_unit: 'ml', pack_unit: 'ml', pack_size: 325, conversion_factor: 1, cost_price: 10 };
const pork = { item_type: 'raw', unit: 'kg', usage_unit: 'g', pack_unit: 'kg', pack_size: 1, conversion_factor: 1000, cost_price: 150 };
const sauce = { item_type: 'prep', prep_mode: 'stocked', unit: 'portion', cost_price: 42 };

describe('countUnitCost', () => {
    it('matches the SQL rule for bottles, weights and preps', () => {
        expect(countUnitCost(soda)).toBe(10);
        expect(countUnitCost(pork)).toBe(150);
        expect(countUnitCost(sauce)).toBe(42);
        expect(countUnitCost({ ...pork, cost_price: null })).toBe(0);
    });
});

describe('validateReceiveLines', () => {
    it('builds RPC lines, totals priced lines and flags bad rows', () => {
        const res = validateReceiveLines([
            { key: 'a', stockItemId: 's', quantity: '24', lineTotal: '288' },
            { key: 'b', stockItemId: 'p', quantity: '1.5', lineTotal: '', updateCost: false },
            { key: 'c', stockItemId: 'x', quantity: '0', lineTotal: '10' },
            { key: 'd', stockItemId: '', quantity: '1' },
            { key: 'e', stockItemId: 'y', quantity: '1', lineTotal: '-5' }
        ]);
        expect(res.errors).toEqual({ c: 'ใส่จำนวนมากกว่า 0', d: 'เลือกวัตถุดิบ', e: 'ราคาไม่ถูกต้อง' });
        expect(res.lines).toEqual([
            { stock_item_id: 's', quantity: 24, update_cost: true, line_total: 288 },
            { stock_item_id: 'p', quantity: 1.5, update_cost: false }
        ]);
        expect(res).toMatchObject({ total: 288, priced: 1, allPriced: false });
    });
});

describe('priceChange', () => {
    it('compares the bill price per unit with the cost on file', () => {
        const s = priceChange(soda, '24', '288');
        expect(s).toMatchObject({ unitNow: 12, before: 10, big: true });
        expect(s.pct).toBeCloseTo(20, 6);
        expect(priceChange(pork, '2', '310')).toMatchObject({ unitNow: 155, before: 150, big: false });
        expect(priceChange({ ...pork, cost_price: 0 }, '2', '310')).toMatchObject({ pct: null, big: false });
        expect(priceChange(pork, '', '310')).toBeNull();
    });
});

describe('expenseProblem', () => {
    it('needs prices for a new expense and a pick for a linked one', () => {
        expect(expenseProblem('new', { allPriced: false })).toMatch(/ใส่ราคา/);
        expect(expenseProblem('new', { allPriced: true })).toBeNull();
        expect(expenseProblem('link', { allPriced: false }, null)).toMatch(/เลือก/);
        expect(expenseProblem('none', { allPriced: false })).toBeNull();
    });
});
