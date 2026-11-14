import { describe, it, expect } from 'vitest';
import {
    getItemType, isStockedItem, usagePerPortion, hasPortionYield, usageToStockQty, usagePerStockUnit,
    buildLiveCostResolver, getRecipeIssues
} from '../recipeGraph';
import { calculateRecipeCost } from '../costUtils';

// Shapes copied from the live bar data.
const tea = { id: 'tea', name: 'ชามะลิ', item_type: 'raw', cost_price: 120, pack_size: 1, conversion_factor: 500, yield_percent: 100, usage_unit: 'g' };
const water = { id: 'water', name: 'น้ำแกลอน', item_type: 'raw', cost_price: 25, pack_size: 1, conversion_factor: 5000, yield_percent: 100, usage_unit: 'ml' };
const cup = { id: 'cup', name: 'แก้ว 16 ออนซ์', item_type: 'raw', cost_price: 100, pack_size: 50, conversion_factor: 1, yield_percent: 100, usage_unit: 'glass' };
const jasmineBase = { id: 'base', name: 'เบส-ชามะลิ', item_type: 'prep', prep_mode: 'stocked', portion_yield_qty: 920, cost_price: 4.4467, pack_size: 1, conversion_factor: 920, yield_percent: 100, usage_unit: 'ml' };
const jasmineDrink = { id: 'drink', name: 'Soft Drink - ชามะลิ', item_type: 'recipe', cost_price: 894.5, pack_size: 1, conversion_factor: 1, yield_percent: 100, usage_unit: 'unit' };

const rows = [
    { parent_stock_item_id: 'base', ingredient_id: 'tea', quantity: 20 },
    { parent_stock_item_id: 'base', ingredient_id: 'water', quantity: 920 },
    { parent_stock_item_id: 'drink', ingredient_id: 'base', quantity: 200 },
    { parent_stock_item_id: 'drink', ingredient_id: 'cup', quantity: 1 }
];

describe('item type helpers', () => {
    it('falls back to is_base_recipe when item_type is absent', () => {
        expect(getItemType({ is_base_recipe: true })).toBe('recipe');
        expect(getItemType({ is_base_recipe: false })).toBe('raw');
        expect(getItemType({ item_type: 'prep', is_base_recipe: true })).toBe('prep');
        expect(getItemType(null)).toBe('raw');
    });

    it('knows what sits on a shelf', () => {
        expect(isStockedItem(tea)).toBe(true);
        expect(isStockedItem(jasmineBase)).toBe(true);
        expect(isStockedItem({ ...jasmineBase, prep_mode: 'passthrough' })).toBe(false);
        expect(isStockedItem(jasmineDrink)).toBe(false);
    });

    it('reads the yield of one portion', () => {
        expect(usagePerPortion(jasmineBase)).toBe(920);
        expect(usagePerPortion(jasmineDrink)).toBe(1);
        // a drink recipe saved with an old conversion factor is still one serving
        expect(usagePerPortion({ item_type: 'recipe', pack_size: 1, conversion_factor: 440 })).toBe(1);
        expect(hasPortionYield({ item_type: 'prep', portion_yield_qty: null })).toBe(false);
        expect(hasPortionYield(tea)).toBe(true);
    });

    it('knows how much one counted unit holds (live item shapes)', () => {
        const soda = { item_type: 'raw', unit: 'ขวด', pack_size: 325, pack_unit: 'ml', usage_unit: 'ml', conversion_factor: 1 };
        const coke = { item_type: 'raw', unit: 'ขวด', pack_size: 12, pack_unit: 'bottle', usage_unit: 'bottle', conversion_factor: 1 };
        const aro = { item_type: 'raw', unit: 'แกลอน', pack_size: 6, pack_unit: 'l', usage_unit: 'ml', conversion_factor: 1000 };
        const pork = { item_type: 'raw', unit: 'kg', pack_size: 1, pack_unit: 'kg', usage_unit: 'g', conversion_factor: 1000 };
        expect(usagePerStockUnit(soda)).toBe(325);
        expect(usagePerStockUnit(coke)).toBe(1);
        expect(usagePerStockUnit(aro)).toBe(6000);
        expect(usagePerStockUnit(pork)).toBe(1000);
        expect(usageToStockQty(soda, 150)).toBeCloseTo(150 / 325);
        expect(usagePerStockUnit(jasmineBase)).toBe(920);
    });

    it('converts recipe quantities to counted stock', () => {
        expect(usageToStockQty(tea, 100)).toBeCloseTo(0.2);          // 100 g of a 500 g bag
        expect(usageToStockQty(jasmineBase, 230)).toBeCloseTo(0.25); // quarter of a portion
        expect(usageToStockQty({ conversion_factor: 1000, yield_percent: 80 }, 400)).toBeCloseTo(0.5);
    });
});

describe('buildLiveCostResolver', () => {
    const items = [tea, water, cup, jasmineBase, jasmineDrink];

    it('costs a prep from its ingredients, ignoring the stale saved cost', () => {
        const live = buildLiveCostResolver(items, rows);
        // 20 g tea (0.24/g) + 920 ml water (0.005/ml) = 4.8 + 4.6
        expect(live.portionCost('base')).toBeCloseTo(9.4);
        expect(live.unitCost('base')).toBeCloseTo(9.4 / 920);
    });

    it('fixes the drink that used to cost hundreds of baht', () => {
        const live = buildLiveCostResolver(items, rows);
        // 200 ml of base + one 2-baht cup
        expect(live.portionCost('drink')).toBeCloseTo(200 * (9.4 / 920) + 2);
        expect(live.portionCost('drink')).toBeLessThan(5);
    });

    it('follows a price change on a raw ingredient without re-saving anything', () => {
        const pricier = items.map(i => i.id === 'tea' ? { ...i, cost_price: 240 } : i);
        const live = buildLiveCostResolver(pricier, rows);
        expect(live.portionCost('base')).toBeCloseTo(9.6 + 4.6);
    });

    it('plugs into calculateRecipeCost through getItem', () => {
        const live = buildLiveCostResolver(items, rows);
        const menuRecipe = [{ ingredient_id: 'base', quantity: 200 }, { ingredient_id: 'cup', quantity: 1 }];
        const { totalCost } = calculateRecipeCost(menuRecipe, live.getItem);
        expect(totalCost).toBeCloseTo(200 * (9.4 / 920) + 2);
    });

    it('keeps the saved cost for a made item that has no recipe rows', () => {
        const live = buildLiveCostResolver([{ ...jasmineBase, id: 'lonely' }], []);
        expect(live.portionCost('lonely')).toBeCloseTo(4.4467);
    });

    it('survives a recipe that refers back to itself', () => {
        const a = { id: 'a', item_type: 'recipe', pack_size: 1, conversion_factor: 1, cost_price: 0 };
        const b = { id: 'b', item_type: 'recipe', pack_size: 1, conversion_factor: 1, cost_price: 0 };
        const live = buildLiveCostResolver([a, b, tea], [
            { parent_stock_item_id: 'a', ingredient_id: 'b', quantity: 1 },
            { parent_stock_item_id: 'b', ingredient_id: 'a', quantity: 1 },
            { parent_stock_item_id: 'b', ingredient_id: 'tea', quantity: 10 }
        ]);
        expect(Number.isFinite(live.portionCost('a'))).toBe(true);
        expect(live.hasLoop('a')).toBe(true);
        expect(live.hasLoop('base')).toBe(false);
    });

    it('returns 0 for unknown ids', () => {
        const live = buildLiveCostResolver(items, rows);
        expect(live.unitCost('nope')).toBe(0);
        expect(live.getItem('nope')).toBeUndefined();
    });
});

describe('getRecipeIssues', () => {
    it('flags a prep with no portion yield and no ingredients', () => {
        const codes = getRecipeIssues({ item_type: 'prep', portion_yield_qty: null }, []).map(i => i.code);
        expect(codes).toEqual(['no_portion_yield', 'no_ingredients']);
    });

    it('flags missing cost, unmeasured prep and unit mismatch on ingredients', () => {
        const issues = getRecipeIssues(jasmineDrink, [
            { ingredient_id: 'x', unit: 'g', ingredient: { name: 'กะปิ', item_type: 'raw', cost_price: 0, usage_unit: 'g' } },
            { ingredient_id: 'y', unit: 'ml', ingredient: { name: 'เบส-ชาดำ', item_type: 'prep', portion_yield_qty: null, usage_unit: 'g' } }
        ]);
        expect(issues.map(i => i.code)).toEqual(['no_cost', 'ingredient_no_yield', 'unit_mismatch']);
    });

    it('flags a per-glass recipe used inside a prep', () => {
        const codes = getRecipeIssues({ item_type: 'prep', portion_yield_qty: 400 }, [
            { ingredient_id: 'd', unit: 'g', ingredient: { name: 'Soft Drink - ชาไทย', item_type: 'recipe', usage_unit: 'unit' } }
        ]).map(i => i.code);
        expect(codes).toContain('recipe_inside');
    });

    it('is quiet for a healthy recipe and treats the generic "unit" row label as fine', () => {
        expect(getRecipeIssues(jasmineBase, [
            { ingredient_id: 'tea', unit: 'g', ingredient: tea },
            { ingredient_id: 'water', unit: 'unit', ingredient: water }
        ])).toEqual([]);
    });
});
