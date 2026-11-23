import { describe, it, expect } from 'vitest';
import { stockQtyParts, stockStatus, packCapacity } from '../stockUtils';
import { qtyInWords } from '../stockCount';

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
        expect(stockQtyParts(item({ unit: 'kg', pack_unit: 'kg', usage_unit: 'g', conversion_factor: 1000, current_quantity: 0.002 })).main).toBe('0.002');
    });
    it('adds the pieces for packs, boxes and crates used one by one', () => {
        expect(stockQtyParts(item({ unit: 'pack', pack_unit: 'pack', usage_unit: 'pcs', conversion_factor: 110, current_quantity: 1.3 }))).toMatchObject({ main: '143', unit: 'ชิ้น', total: '1 แพ็ค + 33 ชิ้น' });
        expect(stockQtyParts(item({ unit: 'crate', pack_unit: 'crate', usage_unit: 'bottle', conversion_factor: 24, current_quantity: 2 }))).toMatchObject({ main: '48', unit: 'ขวด', total: '2 ลัง' });
        expect(stockQtyParts(item({ unit: 'แพ็ค', pack_unit: 'แพ็ค', usage_unit: 'glass', conversion_factor: 50, current_quantity: 15 }))).toMatchObject({ main: '750', unit: 'แก้ว', total: '15 แพ็ค' });
    });
    it('adds the amount inside for packs and bottles of things measured by weight or volume', () => {
        expect(stockQtyParts(item({ current_quantity: 2 })).total).toBe('1,400 มิลลิลิตร');
        expect(stockQtyParts(item({ unit: 'unit', pack_unit: 'unit', usage_unit: 'g', conversion_factor: 1000, current_quantity: 5 })).total).toBe('5,000 กรัม');
        expect(stockQtyParts(item({ unit: 'unit', pack_unit: 'unit', usage_unit: 'g', conversion_factor: 440, current_quantity: 1.3 })).total).toBe('572 กรัม');
    });
    it('a แกลลอน is a jug: the card says the jugs and the millilitres inside', () => {
        const jug = { unit: 'gallon', pack_unit: 'gallon', usage_unit: 'ml', conversion_factor: 5000 };
        expect(stockQtyParts(item({ ...jug, current_quantity: 1 }))).toMatchObject({ main: '1', unit: 'แกลลอน', open: null, totalValue: '5,000', totalUnit: 'มิลลิลิตร' });
        expect(stockQtyParts(item({ ...jug, current_quantity: 1.5 }))).toMatchObject({ main: '2', totalValue: '7,500', open: 'เต็ม 1 · เปิดอยู่ 1 เหลือ 2,500 มิลลิลิตร' });
    });
    it('prints no total for 1:1 items or for broken unit set-ups', () => {
        expect(stockQtyParts(item({ unit: 'unit', pack_unit: 'unit', usage_unit: 'unit', conversion_factor: 1, current_quantity: 6 })).total).toBeNull();
        expect(stockQtyParts(item({ unit: 'unit', pack_unit: 'unit', usage_unit: 'g', conversion_factor: 1, current_quantity: 6 })).total).toBeNull();
        expect(stockQtyParts(item({ unit: 'unit', pack_unit: 'unit', usage_unit: 'bottle', conversion_factor: 1000, current_quantity: 1 })).total).toBeNull();
        expect(stockQtyParts(item({ unit: 'kg', pack_unit: 'kg', usage_unit: 'unit', conversion_factor: 1000, current_quantity: 2 })).total).toBeNull();
    });
    it('things used one by one lead with the pieces; the crates are a small summary', () => {
        const singha = item({ unit: 'crate', pack_unit: 'crate', usage_unit: 'bottle', conversion_factor: 12, current_quantity: 1.4167 });
        expect(stockQtyParts(singha)).toMatchObject({ main: '17', unit: 'ขวด', open: '1 ลัง + 5 ขวด', single: true });
        expect(stockQtyParts({ ...singha, current_quantity: 0.4167 })).toMatchObject({ main: '5', open: null });
        expect(stockQtyParts({ ...singha, current_quantity: 2 })).toMatchObject({ main: '24', open: '2 ลัง' });
        const water = item({ unit: 'pack', pack_unit: 'pack', usage_unit: 'bottle', conversion_factor: 6, current_quantity: 5 });
        expect(stockQtyParts(water)).toMatchObject({ main: '30', unit: 'ขวด', open: '5 แพ็ค' });
    });
    it('a rounding crumb is no opened crate, and ml stay whole', () => {
        const crate = item({ unit: 'crate', pack_unit: 'crate', usage_unit: 'bottle', conversion_factor: 12, current_quantity: 5.002 });
        expect(stockQtyParts(crate)).toMatchObject({ main: '60', open: '5 ลัง' });
        expect(stockQtyParts(item({ current_quantity: 0.4757 })).open).toBe('เปิดอยู่ 1 เหลือ 333 มิลลิลิตร');
    });
    it('keeps the status on the stored quantity: an open bottle is not "out"', () => {
        expect(stockStatus(item({ current_quantity: 0.5 }))).toBe('ok');
        expect(stockStatus(item({ current_quantity: 0 }))).toBe('out');
    });
});

describe('packCapacity (what is left in the opened one)', () => {
    const bags = { unit: 'pack', pack_unit: 'pack', usage_unit: 'pcs', conversion_factor: 110 };
    it('gives millilitres for a bottle and pieces for a pack', () => {
        expect(packCapacity({ unit: 'bottle', pack_unit: 'bottle', usage_unit: 'ml', conversion_factor: 700 })).toEqual({ amount: 700, unit: 'ml' });
        expect(packCapacity(bags)).toEqual({ amount: 110, unit: 'pcs' });
        expect(qtyInWords(bags, 1.3, packCapacity(bags))).toBe('1 แพ็ค + เปิดอยู่ 1 เหลือ 33 ชิ้น');
        const crate = { unit: 'crate', pack_unit: 'crate', usage_unit: 'bottle', conversion_factor: 12 };
        expect(qtyInWords(crate, 5.002, packCapacity(crate))).toBe('5 ลัง');
        expect(qtyInWords(crate, 1.4167, packCapacity(crate))).toBe('1 ลัง + เปิดอยู่ 1 เหลือ 5 ขวด');
    });
    it('gives nothing for 1:1 items and for converters that cannot be true', () => {
        expect(packCapacity({ unit: 'unit', pack_unit: 'unit', usage_unit: 'unit', conversion_factor: 1 })).toBeNull();
        expect(packCapacity({ unit: 'unit', pack_unit: 'unit', usage_unit: 'bottle', conversion_factor: 1000 })).toBeNull();
    });

    it('always leads with สูตร for house-made bases (portion) while showing yield beside it', () => {
        const thaiTeaBase = { unit: 'portion', pack_unit: 'portion', usage_unit: 'ml', conversion_factor: 1300, current_quantity: 1.5 };
        expect(stockQtyParts(thaiTeaBase)).toMatchObject({ main: '2', unit: 'สูตร', totalValue: '1,950', totalUnit: 'มิลลิลิตร', open: 'เต็ม 1 · เปิดอยู่ 1 เหลือ 650 มิลลิลิตร' });

        const bolognese = { unit: 'portion', pack_unit: 'portion', usage_unit: 'bag', conversion_factor: 24, current_quantity: 1.0417 };
        expect(stockQtyParts(bolognese)).toMatchObject({ main: '1', unit: 'สูตร', totalValue: '25', totalUnit: 'ถุง' });
        expect(packCapacity(bolognese)).toEqual({ amount: 24, unit: 'bag' });
    });
});
