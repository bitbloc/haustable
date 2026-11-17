import { describe, it, expect } from 'vitest';
import { rescaleForCountUnitChange } from '../stockUnitChange';
import { usagePerStockUnit } from '../recipeGraph';

const bottles = { unit: 'bottle', pack_unit: 'bottle', usage_unit: 'bottle', conversion_factor: 1, pack_size: 1, current_quantity: 17, min_stock_threshold: 15, reorder_point: 20, par_level: 0 };

describe('Changing the counting unit keeps the amount', () => {
    it('17 bottles counted in crates of 12 become 1.4167 crates, alerts too', () => {
        const r = rescaleForCountUnitChange(bottles, { ...bottles, unit: 'crate', pack_unit: 'crate', usage_unit: 'bottle', conversion_factor: 12 }, usagePerStockUnit);
        expect(r.quantity).toBe(1.4167);
        expect(r.levels).toEqual({ min_stock_threshold: 1.25, reorder_point: 1.6667 });
    });
    it('leaves a level the person retyped in the same save', () => {
        const r = rescaleForCountUnitChange(bottles, { ...bottles, unit: 'crate', pack_unit: 'crate', conversion_factor: 12, reorder_point: 2 }, usagePerStockUnit);
        expect(r.levels).toEqual({ min_stock_threshold: 1.25 });
    });
    it('does nothing when one counted unit still holds the same', () => {
        const crate = { ...bottles, unit: 'crate', pack_unit: 'crate', conversion_factor: 12, current_quantity: 1.4167 };
        expect(rescaleForCountUnitChange(crate, { ...crate, cost_price: 700 }, usagePerStockUnit).quantity).toBeNull();
    });
    it('a soda counted per 325 ml bottle switched to counting in ml', () => {
        const soda = { unit: 'bottle', pack_unit: 'ml', pack_size: 325, usage_unit: 'ml', conversion_factor: 1, current_quantity: 10 };
        expect(rescaleForCountUnitChange(soda, { ...soda, unit: 'ml' }, usagePerStockUnit).quantity).toBe(3250);
    });
});
