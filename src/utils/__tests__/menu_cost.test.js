import { describe, it, expect } from 'vitest';
import { menuMaterialCost } from '../menuCost';

// 1 kg bag for 100 baht, used in grams
const flour = { id: 'flour', name: 'flour', item_type: 'raw', cost_price: 100, pack_size: 1, conversion_factor: 1000, yield_percent: 100, usage_unit: 'g' };
// one box, 5 baht
const box = { id: 'box', name: 'box', item_type: 'raw', cost_price: 5, pack_size: 1, conversion_factor: 1, yield_percent: 100, usage_unit: 'unit' };

describe('menuMaterialCost', () => {
    it('keeps takeaway-only packaging out of the dine-in cost', () => {
        const rows = [
            { ingredient_id: 'flour', quantity: 200, unit: 'g', order_scope: 'all' },
            { ingredient_id: 'box', quantity: 1, unit: 'unit', order_scope: 'takeaway' },
        ];
        const { cost, takeawayExtraCost } = menuMaterialCost(rows, [flour, box], []);
        expect(cost).toBeCloseTo(20, 5);
        expect(takeawayExtraCost).toBeCloseTo(5, 5);
    });

    it('costs a base from its ingredients at today\'s price, not its stored cost', () => {
        // base: 1 batch = 500 g, made of 1,000 g flour (100 baht); stored cost is stale
        const base = { id: 'base', name: 'base', item_type: 'prep', prep_mode: 'stocked', cost_price: 1, pack_size: 1, conversion_factor: 500, portion_yield_qty: 500, yield_percent: 100, usage_unit: 'g' };
        const nested = [{ parent_stock_item_id: 'base', ingredient_id: 'flour', quantity: 1000 }];
        const rows = [{ ingredient_id: 'base', quantity: 50, unit: 'g', order_scope: 'all' }];
        const { cost } = menuMaterialCost(rows, [flour, box, base], nested);
        expect(cost).toBeCloseTo(10, 5);
    });

    it('is zero for a menu with no recipe', () => {
        expect(menuMaterialCost([], [flour], [])).toEqual({ cost: 0, takeawayExtraCost: 0 });
    });
});

describe('menuMaterialCost for a set', () => {
    it('adds the recipes of the menus in the set, by servings', () => {
        // dish 7: 200 g flour (20 baht) and a box when taken away; the set holds 2 of it
        const componentRecipeRows = [
            { parent_menu_item_id: 7, ingredient_id: 'flour', quantity: 200, order_scope: 'all' },
            { parent_menu_item_id: 7, ingredient_id: 'box', quantity: 1, order_scope: 'takeaway' },
        ];
        const components = [{ component_menu_item_id: 7, quantity: 2, choice_ids: [] }];
        const { cost, takeawayExtraCost } = menuMaterialCost([], [flour, box], [], { components, componentRecipeRows });
        expect(cost).toBeCloseTo(40, 5);
        expect(takeawayExtraCost).toBeCloseTo(10, 5);
    });

    it('adds what a fixed choice of a component deducts', () => {
        const componentRecipeRows = [{ parent_menu_item_id: 7, ingredient_id: 'flour', quantity: 100, order_scope: 'all' }];
        const components = [{ component_menu_item_id: 7, quantity: 1, choice_ids: ['c1'] }];
        const ruleRows = [{ choice_id: 'c1', menu_item_id: null, stock_item_id: 'flour', quantity: 50 }];
        const { cost } = menuMaterialCost([], [flour, box], [], { components, componentRecipeRows, ruleRows });
        expect(cost).toBeCloseTo(15, 5);
    });

    it('keeps the set\'s own recipe lines too', () => {
        const rows = [{ ingredient_id: 'box', quantity: 1, unit: 'unit', order_scope: 'all' }];
        const componentRecipeRows = [{ parent_menu_item_id: 7, ingredient_id: 'flour', quantity: 100, order_scope: 'all' }];
        const components = [{ component_menu_item_id: 7, quantity: 1 }];
        const { cost } = menuMaterialCost(rows, [flour, box], [], { components, componentRecipeRows });
        expect(cost).toBeCloseTo(15, 5);
    });
});
