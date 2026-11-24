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
