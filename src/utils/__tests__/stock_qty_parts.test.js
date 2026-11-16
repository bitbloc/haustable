import { describe, it, expect } from 'vitest';
import { stockQtyParts, stockStatus } from '../stockUtils';

const item = (over) => ({ unit: 'bottle', pack_unit: 'bottle', usage_unit: 'ml', conversion_factor: 700, current_quantity: 0, ...over });

describe('What a stock card shows', () => {
    it('counts the opened bottle in the big figure and says what is left in it', () => {
        expect(stockQtyParts(item({ current_quantity: 0.5 }))).toMatchObject({ main: '1', open: 'เปิดอยู่ 1 เหลือ 350 มิลลิลิตร', openPercent: 50 });
        expect(stockQtyParts(item({ current_quantity: 2.25 }))).toMatchObject({ main: '3', open: 'เต็ม 2 · เปิดอยู่ 1 เหลือ 175 มิลลิลิตร', openPercent: 25 });
    });
    it('shows whole bottles as they are, with no open line', () => {
        expect(stockQtyParts(item({ current_quantity: 3 }))).toMatchObject({ main: '3', open: null, openPercent: 0 });
        expect(stockQtyParts(item({ current_quantity: 0 }))).toMatchObject({ main: '0', open: null });
    });
    it('falls back to a percentage when the pack size is unknown', () => {
        const r = stockQtyParts(item({ unit: 'unit', pack_unit: 'unit', usage_unit: 'unit', conversion_factor: 1, current_quantity: 0.95 }));
        expect(r.main).toBe('1');
        expect(r.open).toBe('เปิดอยู่ 1 เหลือ 95%');
        expect(r.unit).toBe('ชิ้น');
    });
    it('never rounds a weight or a volume up to a whole pack', () => {
        const soy = stockQtyParts(item({ unit: 'kg', pack_unit: 'kg', usage_unit: 'g', conversion_factor: 1000, current_quantity: 0.35 }));
        expect(soy).toMatchObject({ main: '0.35', open: null, openPercent: 0, total: null });
        expect(stockQtyParts(item({ unit: 'l', pack_unit: 'l', usage_unit: 'ml', conversion_factor: 1000, current_quantity: 2.5 })).main).toBe('2.5');
        expect(stockQtyParts(item({ unit: 'kg', pack_unit: 'kg', usage_unit: 'g', conversion_factor: 1000, current_quantity: 2 })).main).toBe('2');
    });
    it('adds the pieces for packs, boxes and crates used one by one', () => {
        expect(stockQtyParts(item({ unit: 'pack', pack_unit: 'pack', usage_unit: 'pcs', conversion_factor: 110, current_quantity: 1.3 })).total).toBe('143 ชิ้น');
        expect(stockQtyParts(item({ unit: 'crate', pack_unit: 'crate', usage_unit: 'bottle', conversion_factor: 24, current_quantity: 2 })).total).toBe('48 ขวด');
        expect(stockQtyParts(item({ unit: 'แพ็ค', pack_unit: 'แพ็ค', usage_unit: 'glass', conversion_factor: 50, current_quantity: 15 })).total).toBe('750 แก้ว');
    });
    it('adds the amount inside for packs and bottles of things measured by weight or volume', () => {
        expect(stockQtyParts(item({ current_quantity: 2 })).total).toBe('1,400 มิลลิลิตร');
        expect(stockQtyParts(item({ unit: 'unit', pack_unit: 'unit', usage_unit: 'g', conversion_factor: 1000, current_quantity: 5 })).total).toBe('5,000 กรัม');
        expect(stockQtyParts(item({ unit: 'unit', pack_unit: 'unit', usage_unit: 'g', conversion_factor: 440, current_quantity: 1.3 })).total).toBe('572 กรัม');
    });
    it('prints no total for 1:1 items or for broken unit set-ups', () => {
        expect(stockQtyParts(item({ unit: 'unit', pack_unit: 'unit', usage_unit: 'unit', conversion_factor: 1, current_quantity: 6 })).total).toBeNull();
        expect(stockQtyParts(item({ unit: 'unit', pack_unit: 'unit', usage_unit: 'g', conversion_factor: 1, current_quantity: 6 })).total).toBeNull();
        expect(stockQtyParts(item({ unit: 'unit', pack_unit: 'unit', usage_unit: 'bottle', conversion_factor: 1000, current_quantity: 1 })).total).toBeNull();
        expect(stockQtyParts(item({ unit: 'kg', pack_unit: 'kg', usage_unit: 'unit', conversion_factor: 1000, current_quantity: 2 })).total).toBeNull();
    });
    it('keeps the status on the stored quantity: an open bottle is not "out"', () => {
        expect(stockStatus(item({ current_quantity: 0.5 }))).toBe('ok');
        expect(stockStatus(item({ current_quantity: 0 }))).toBe('out');
    });
});
