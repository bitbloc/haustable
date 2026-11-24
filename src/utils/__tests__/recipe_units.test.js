import { describe, it, expect } from 'vitest';
import { unitFix, rowUnit, findRecipeUnitIssues, planUsageUnitChange } from '../recipeUnits';

describe('unitFix', () => {
    it('converts within weight or volume', () => {
        expect(unitFix(0.05, 'kg', 'g')).toEqual({ kind: 'convert', factor: 1000, quantity: 50 });
        expect(unitFix(250, 'ml', 'l')).toEqual({ kind: 'convert', factor: 0.001, quantity: 0.25 });
        expect(unitFix(2, 'tbsp', 'ml')).toMatchObject({ kind: 'convert', quantity: 30 });
    });
    it('offers 1 ml = 1 g only between liquids and weights', () => {
        expect(unitFix(90, 'ml', 'g')).toEqual({ kind: 'liquid', factor: 1, quantity: 90 });
        expect(unitFix(0.2, 'l', 'g')).toMatchObject({ kind: 'liquid', quantity: 200 });
        expect(unitFix(150, 'g', 'kg')).toMatchObject({ kind: 'convert', quantity: 0.15 });
        expect(unitFix(50, 'g', 'unit')).toEqual({ kind: 'manual' });
        expect(unitFix(1, 'g', 'g')).toEqual({ kind: 'same' });
    });
});

describe('findRecipeUnitIssues', () => {
    const items = new Map([
        ['base', { id: 'base', name: 'เบส-ชาดำ', usage_unit: 'g' }],
        ['tea', { id: 'tea', name: 'ใบชา', usage_unit: 'g' }],
        ['soda', { id: 'soda', name: 'Soft Drink - ชาไทย', usage_unit: 'unit' }]
    ]);
    const menus = new Map([[7, { id: 7, name: 'Mocktail-มายา' }]]);
    const rows = [
        { id: 1, parent_menu_item_id: 7, ingredient_id: 'base', quantity: 90, unit: 'ml' },
        { id: 2, parent_stock_item_id: 'base', ingredient_id: 'soda', quantity: 50, unit: 'g' },
        { id: 3, parent_stock_item_id: 'base', ingredient_id: 'tea', quantity: 12, unit: 'unit' },
        { id: 4, parent_stock_item_id: 'base', ingredient_id: 'tea', quantity: 12, unit: 'g' }
    ];

    it('treats "unit" as the usage unit and lists the rest with a fix', () => {
        expect(rowUnit(rows[2], items.get('tea'))).toBe('g');
        const issues = findRecipeUnitIssues(rows, items, menus);
        expect(issues.map(i => [i.rowId, i.parentName, i.from, i.to, i.fix.kind])).toEqual([
            [2, 'เบส-ชาดำ', 'g', 'unit', 'manual'],
            [1, 'Mocktail-มายา', 'ml', 'g', 'liquid']
        ]);
    });
});

describe('planUsageUnitChange', () => {
    it('converts rows that can be converted and labels the rest for review', () => {
        const rows = [
            { id: 1, quantity: 0.05, unit: 'kg' },
            { id: 2, quantity: 0.2, unit: null },
            { id: 3, quantity: 3, unit: 'unit' },
            { id: 4, quantity: 30, unit: 'ml' }
        ];
        expect(planUsageUnitChange(rows, 'kg', 'g')).toEqual({
            updates: [
                { id: 1, quantity: 50, unit: 'g' },
                { id: 2, quantity: 200, unit: 'g' },
                { id: 3, quantity: 3000, unit: 'g' }
            ],
            manual: 0
        });
        expect(planUsageUnitChange(rows, 'kg', 'unit')).toEqual({
            updates: [
                { id: 1, quantity: 0.05, unit: 'kg' },
                { id: 2, quantity: 0.2, unit: 'kg' },
                { id: 3, quantity: 3, unit: 'kg' }
            ],
            manual: 3
        });
        expect(planUsageUnitChange(rows, 'g', 'g')).toEqual({ updates: [], manual: 0 });
    });

    it('labels rows counted in pieces "pcs" when the ingredient moves to grams, so the check lists them', () => {
        const rows = [
            { id: 1, quantity: 1, unit: 'unit' },
            { id: 2, quantity: 4, unit: null },
            { id: 3, quantity: 30, unit: 'ml' }
        ];
        const plan = planUsageUnitChange(rows, 'unit', 'g');
        expect(plan).toEqual({
            updates: [
                { id: 1, quantity: 1, unit: 'pcs' },
                { id: 2, quantity: 4, unit: 'pcs' }
            ],
            manual: 2
        });
        // 'unit' would have read as grams; 'pcs' is listed for a person to fix
        const lime = { id: 'lime', name: 'มะนาว', usage_unit: 'g' };
        const issues = findRecipeUnitIssues(
            [{ id: 1, parent_menu_item_id: 7, ingredient_id: 'lime', quantity: 1, unit: 'pcs' }],
            new Map([['lime', lime]]),
            new Map([[7, { id: 7, name: 'ชามะนาว' }]])
        );
        expect(issues.map(i => [i.from, i.to, i.fix.kind])).toEqual([['pcs', 'g', 'manual']]);
    });
});

describe('แกลลอน is a jug of any size', () => {
    it('suggests no ratio between a gallon and ml, l or g', async () => {
        const { suggestConversionFactor } = await import('../unitUtils');
        expect(suggestConversionFactor('gallon', 'ml')).toBeNull();
        expect(suggestConversionFactor('gallon', 'l')).toBeNull();
        expect(suggestConversionFactor('ml', 'gallon')).toBeNull();
        expect(suggestConversionFactor('gallon', 'gallon')).toBe(1);
        expect(suggestConversionFactor('l', 'ml')).toBe(1000);
    });
    it('leaves a recipe row written in gallons for a person to fix', () => {
        expect(unitFix(2, 'gallon', 'ml')).toEqual({ kind: 'manual' });
        expect(unitFix(2, 'gallon', 'g')).toEqual({ kind: 'manual' });
        expect(unitFix(500, 'ml', 'gallon')).toEqual({ kind: 'manual' });
    });
});
