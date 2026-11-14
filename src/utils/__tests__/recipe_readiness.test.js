import { describe, it, expect } from 'vitest';
import { normalizeRecipeName, suggestRecipesForMenu, unitsSoldByMenu, summarizeReadiness } from '../recipeReadiness';

// Names copied from the live menu and Bar SOP.
const recipes = [
    { id: 'r1', name: 'Coffee - ลาเต้' },
    { id: 'r2', name: 'Hot Coffee - ลาเต้ร้อน' },
    { id: 'r3', name: 'Oat Coffee - ลาเต้นมโอ๊ต' },
    { id: 'r4', name: 'Soft Drink - ชาไทย' },
    { id: 'r5', name: 'Soft Drink - โกโก้' },
    { id: 'r6', name: 'Cocktail-มายา' },
    { id: 'r7', name: 'Mocktail-มายา' },
    { id: 'r8', name: 'Black coffee based' }
];

describe('normalizeRecipeName', () => {
    it('strips SOP prefixes, temperature words and punctuation', () => {
        expect(normalizeRecipeName('Coffee - ลาเต้')).toBe('ลาเต้');
        expect(normalizeRecipeName('ลาเต้ (เย็น,ร้อน)')).toBe('ลาเต้');
        expect(normalizeRecipeName('Hot Coffee - ลาเต้ร้อน')).toBe('ลาเต้');
        expect(normalizeRecipeName('Oat Coffe - มอคค่านมโอ๊ต')).toBe('มอคค่านมโอ๊ต');
        expect(normalizeRecipeName('Cocktail-มายา')).toBe('มายา');
        expect(normalizeRecipeName('ข้าวซอสญี่ปุ่น • หมูซูวี')).toBe('ข้าวซอสญี่ปุ่นหมูซูวี');
        expect(normalizeRecipeName(null)).toBe('');
    });
});

describe('suggestRecipesForMenu', () => {
    it('finds the matching drink recipes for a hot/cold menu', () => {
        const names = suggestRecipesForMenu('ลาเต้ (เย็น,ร้อน)', recipes).map(r => r.name);
        expect(names).toEqual(['Coffee - ลาเต้', 'Hot Coffee - ลาเต้ร้อน']);
    });

    it('matches Thai names exactly', () => {
        expect(suggestRecipesForMenu('ชาไทย (ร้อน,เย็น)', recipes).map(r => r.id)).toEqual(['r4']);
        expect(suggestRecipesForMenu('โกโก้ (ร้อน,เย็น)', recipes).map(r => r.id)).toEqual(['r5']);
    });

    it('hides partial matches when an exact one exists', () => {
        const pool = [...recipes, { id: 'a1', name: 'Coffee - อเมริกาโน่มะพร้าว' }, { id: 'a2', name: 'Hot Coffee - อเมริกาโน่ร้อน' }];
        expect(suggestRecipesForMenu('อเมริกาโน่มะพร้าว', pool).map(r => r.id)).toEqual(['a1']);
        expect(suggestRecipesForMenu('มัทฉะลาเต้ (ร้อน,เย็น)', [
            { id: 'm1', name: 'Soft Drink - มัทฉะลาเต้' }, { id: 'm2', name: 'Oat Soft Drink - มัทฉะลาเต้นมโอ๊ต' }
        ]).map(r => r.id)).toEqual(['m1']);
    });

    it('falls back to partial matches when nothing is exact', () => {
        expect(suggestRecipesForMenu('มัทฉะยูสุเฮาส์', [{ id: 'y', name: 'Soft Drink - มัทฉะยูสุ' }]).map(r => r.id)).toEqual(['y']);
    });

    it('offers both cocktail and mocktail versions', () => {
        expect(suggestRecipesForMenu('มายา', recipes).map(r => r.id).sort()).toEqual(['r6', 'r7']);
    });

    it('stays quiet for dishes with no recipe and for very short names', () => {
        expect(suggestRecipesForMenu('ข้าวสวย', recipes)).toEqual([]);
        expect(suggestRecipesForMenu('ชา', [{ id: 'x', name: 'ชาไทยเย็น' }])).toEqual([]);
        expect(suggestRecipesForMenu('', recipes)).toEqual([]);
    });
});

describe('readiness summary', () => {
    const orderItems = [
        { menu_item_id: 1, quantity: 3 },
        { menu_item_id: 1, quantity: 1 },
        { menu_item_id: 2, quantity: 2 },
        { menu_item_id: 3, quantity: 5 },
        { menu_item_id: 3, quantity: 1, is_custom: true },
        { menu_item_id: null, quantity: 9 },
        { menu_item_id: 4, quantity: 0 }
    ];
    const menus = [
        { id: 1, name: 'อเมริกาโน่', hasRecipe: true },
        { id: 2, name: 'ชาไทย', hasRecipe: false },
        { id: 3, name: 'ข้าวสวย', hasRecipe: false },
        { id: 4, name: 'น้ำแข็ง', hasRecipe: false },
        { id: 5, name: 'ไม่เคยขาย', hasRecipe: false }
    ];

    it('counts units per menu, skipping custom lines and treating 0 as 1', () => {
        const u = unitsSoldByMenu(orderItems);
        expect(u.get('1')).toBe(4);
        expect(u.get('3')).toBe(5);
        expect(u.get('4')).toBe(1);
        expect(u.has('null')).toBe(false);
    });

    it('reports coverage by units and ranks missing menus by sales', () => {
        const s = summarizeReadiness(menus, unitsSoldByMenu(orderItems));
        expect(s.totalUnits).toBe(12);
        expect(s.coveredUnits).toBe(4);
        expect(s.coveragePct).toBeCloseTo(33.33, 1);
        expect(s.missing.map(m => m.id)).toEqual([3, 2, 4]);
        expect(s.missing[0].unitsSold).toBe(5);
    });

    it('handles no sales', () => {
        expect(summarizeReadiness(menus, new Map()).coveragePct).toBe(0);
    });
});
