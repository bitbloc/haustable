import { describe, it, expect } from 'vitest';
import {
    stockHealth, findDuplicateNames, unitSetupWarnings, readMergeResult,
    isPackagingByWeight, hasBrokenFactor, isOneUnitOneGram, unitsNeverSet,
} from '../stockHealth';

const it_ = (over) => ({ id: over.name, unit: over.pack_unit, cost_price: 10, conversion_factor: 1, ...over });

// Shapes taken from the shop's own stock list (2026-11-16)
const cups = it_({ name: 'ถ้วยน้ำจิ้มฝาพับ/แพ็ค', pack_unit: 'kg', usage_unit: 'g', conversion_factor: 1000, cost_price: 0 });
const cucumber = it_({ name: 'แตงกวา/ลูก', pack_unit: 'kg', usage_unit: 'unit', conversion_factor: 1000 });
const sesame = it_({ name: 'น้ำมันงา/ขวด', pack_unit: 'unit', usage_unit: 'bottle', conversion_factor: 1000 });
const garlic = it_({ name: 'กระเทียม/กก', pack_unit: 'unit', usage_unit: 'g', conversion_factor: 1 });
const batteries = it_({ name: 'ถ่าน 3A', pack_unit: 'unit', usage_unit: 'unit', conversion_factor: 1, cost_price: 0 });
const cocoa = it_({ name: 'โกโก้', pack_unit: 'bag', usage_unit: 'g', conversion_factor: 500, cost_price: 178 });
const prawns = it_({ name: 'กุ้งขาวไซส์ใหญ่/กล่อง', pack_unit: 'kg', usage_unit: 'g', conversion_factor: 1000 });
const curryBase = it_({ name: 'เบสแกงไตปลา', pack_unit: 'unit', usage_unit: 'g', conversion_factor: 1, cost_price: 0, is_base_recipe: true });
const straws = it_({ name: 'หลอด แก้วน้ำเปล่า', pack_unit: 'pack', usage_unit: 'pcs', conversion_factor: 100 });

describe('single checks', () => {
    it('finds packaging set up by weight, but not food sold in a box', () => {
        expect(isPackagingByWeight(cups)).toBe(true);
        expect(isPackagingByWeight(prawns)).toBe(false);
        expect(isPackagingByWeight(straws)).toBe(false);
    });
    it('finds converters that cannot be true', () => {
        expect(hasBrokenFactor(cucumber)).toBe(true);
        expect(hasBrokenFactor(sesame)).toBe(true);
        expect(hasBrokenFactor(it_({ name: 'x', pack_unit: 'bottle', usage_unit: 'bottle', conversion_factor: 3 }))).toBe(true);
        expect(hasBrokenFactor(straws)).toBe(false);
        expect(hasBrokenFactor(cocoa)).toBe(false);
    });
    it('finds "1 piece = 1 gram" and items never set up', () => {
        expect(isOneUnitOneGram(garlic)).toBe(true);
        expect(isOneUnitOneGram(cocoa)).toBe(false);
        expect(unitsNeverSet(batteries)).toBe(true);
        expect(unitsNeverSet(garlic)).toBe(false);
    });
});

describe('stockHealth', () => {
    const items = [cups, cucumber, sesame, garlic, batteries, cocoa, prawns, curryBase, straws];
    const health = stockHealth(items, { [cups.id]: 2, [garlic.id]: 1, [batteries.id]: 0 });
    const names = (key) => health.groups.find(g => g.key === key).rows.map(r => r.item.name);

    it('puts what bends menu cost first and counts it once per item', () => {
        expect(health.groups.map(g => g.key).slice(0, 3)).toEqual(['cost_in_recipe', 'gram_per_unit', 'broken_factor']);
        expect(names('cost_in_recipe')).toEqual(['ถ้วยน้ำจิ้มฝาพับ/แพ็ค']);
        expect(names('gram_per_unit')).toEqual(['กระเทียม/กก']);
        expect(names('broken_factor')).toEqual(['แตงกวา/ลูก', 'น้ำมันงา/ขวด']);
        expect(health.urgentCount).toBe(4);
    });
    it('leaves house-made bases out of cost and unit checks: their cost comes from their recipe', () => {
        expect(names('gram_per_unit')).not.toContain('เบสแกงไตปลา');
        expect(names('cost_zero')).not.toContain('เบสแกงไตปลา');
    });
    it('keeps a zero-cost item that is in a recipe out of the "no price yet" list', () => {
        expect(names('cost_zero')).toEqual(['ถ่าน 3A']);
        expect(names('units_unset')).toEqual(['ถ่าน 3A']);
        expect(names('packaging_by_weight')).toEqual(['ถ้วยน้ำจิ้มฝาพับ/แพ็ค']);
    });
    it('says how each item is set up', () => {
        expect(health.groups.find(g => g.key === 'broken_factor').rows[0].detail).toBe('1 กิโลกรัม = 1,000 หน่วย/ชิ้น');
    });
});

describe('findDuplicateNames', () => {
    it('pairs names that differ only by a pack suffix, spacing or case', () => {
        const groups = findDuplicateNames([
            { id: 1, name: 'ถุงซิปใส 13*20' }, { id: 2, name: 'ถุงซิปใส 13*20/แพ็ค' },
            { id: 3, name: 'น้ำกระเทียมดอง savepak' }, { id: 4, name: 'น้ำกระเทียมดองSavepak/ขวด' },
            { id: 5, name: 'น้ำปลา' }, { id: 6, name: 'น้ำปลา' },
            { id: 7, name: 'ซอสพริกโรซ่า/ซอง' }, { id: 8, name: 'โกโก้' }, { id: 9, name: 'โกโก้ฝึกอาร์ต' },
        ]);
        expect(groups.map(g => g.map(i => i.id))).toEqual([[1, 2], [3, 4], [5, 6]]);
    });
});

describe('unitSetupWarnings (item form)', () => {
    it('warns once, about the worst problem, and stays quiet for a sound set-up', () => {
        expect(unitSetupWarnings(cucumber)).toHaveLength(1);
        expect(unitSetupWarnings(cucumber)[0]).toContain('1 กิโลกรัม = 1,000 หน่วย/ชิ้น');
        expect(unitSetupWarnings(cups)[0]).toContain('บรรจุภัณฑ์');
        expect(unitSetupWarnings(garlic)[0]).toContain('1 กรัม');
        expect(unitSetupWarnings(cocoa)).toEqual([]);
        expect(unitSetupWarnings(straws)).toEqual([]);
        expect(unitSetupWarnings(curryBase)).toEqual([]);
    });
});

describe('readMergeResult', () => {
    it('explains each refusal', () => {
        expect(readMergeResult({ data: { success: true, moved: {} }, error: null }).ok).toBe(true);
        expect(readMergeResult({ data: { success: false, code: 'UNITS_DIFFER' }, error: null }).message).toContain('หน่วย');
        expect(readMergeResult({ data: null, error: { code: 'PGRST202', message: 'x' } }).code).toBe('NOT_INSTALLED');
        expect(readMergeResult({ data: { success: false, code: 'NEW' }, error: null }).code).toBe('UNKNOWN');
    });
});
