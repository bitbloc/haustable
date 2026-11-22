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

describe('A setup fix is offered as "keep", never applied silently', () => {
    // ไชเท้าดอง/โหล, 21 Nov 2026: counted 2.3 jars while the setup said 1 box = 1 g; then fixed to 1 jar = 2,000 g
    const jarBefore = { unit: 'box', pack_unit: 'box', usage_unit: 'g', conversion_factor: 1, pack_size: 1, current_quantity: 2.3, min_stock_threshold: 1, reorder_point: 0, par_level: 3 };
    const jarAfter = { ...jarBefore, unit: 'bottle', pack_unit: 'bottle', conversion_factor: 2000 };

    it('marks the change and returns both answers with what they mean in grams', () => {
        const r = rescaleForCountUnitChange(jarBefore, jarAfter, usagePerStockUnit);
        expect(r.changed).toBe(true);
        expect(r.keep).toEqual({ quantity: 2.3, usage: 4600 });
        expect(r.convert).toEqual({ quantity: 0.0012, usage: 2.3 });
        expect(r.oldUnit).not.toBe(r.newUnit);
    });

    it('asks about alert levels even when nothing is in stock', () => {
        const r = rescaleForCountUnitChange({ ...jarBefore, current_quantity: 0 }, jarAfter, usagePerStockUnit);
        expect(r.changed).toBe(true);
        expect(r.quantity).toBeNull();
        expect(r.levels).toEqual({ min_stock_threshold: 0.0005, par_level: 0.0015 });
    });

    it('has nothing to ask when stock and levels are all zero', () => {
        const empty = { ...jarBefore, current_quantity: 0, min_stock_threshold: 0, par_level: 0 };
        expect(rescaleForCountUnitChange(empty, { ...jarAfter, min_stock_threshold: 0, par_level: 0 }, usagePerStockUnit).changed).toBe(false);
    });
});
