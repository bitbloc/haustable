import { describe, it, expect } from 'vitest';
import { findCostAnomalies, ANOMALY } from '../costAnomalies';

const line = (name, qty, unitCost) => ({ id: name, name, qty, unit: 'g', unitCost, total: qty * unitCost });
const menu = (name, price, lines, extra = {}) => ({
    id: name, name, price, hasRecipe: lines.length > 0,
    cost: lines.reduce((s, l) => s + l.total, 0), costLines: lines, ...extra,
});
const kinds = (found, name) => (found.find(f => f.name === name)?.reasons || []).map(r => r.kind);

describe('findCostAnomalies', () => {
    it('flags a menu that costs more than its price and names the line that does it', () => {
        // 30 cans typed where 30 ml was meant
        const found = findCostAnomalies([menu('Woodsmoke', 169, [line('tonic', 30, 14.33), line('ice', 100, 0.003)])]);
        expect(kinds(found, 'Woodsmoke')).toEqual([ANOMALY.OVER_PRICE, ANOMALY.BIG_LINE]);
        expect(found[0].reasons[1].line.name).toBe('tonic');
    });

    it('does not call a one-ingredient menu a dominant line', () => {
        const found = findCostAnomalies([menu('beer', 120, [line('can', 1, 73.33)])]);
        expect(found).toEqual([]);
    });

    it('does not blame one whole bottle in a set for being most of the price', () => {
        const found = findCostAnomalies([menu('promo', 500, [line('bottle', 1, 380), line('mixer', 3, 8.24)])]);
        expect(kinds(found, 'promo')).toEqual([ANOMALY.THIN]);
    });

    it('flags cost at 80% of the price or more as thin', () => {
        const found = findCostAnomalies([menu('ice cream', 75, [line('scoop', 1, 64.17)])]);
        expect(kinds(found, 'ice cream')).toEqual([ANOMALY.THIN]);
    });

    it('flags an ingredient with no price, and a recipe that costs nothing', () => {
        const found = findCostAnomalies([
            menu('brownie', 89, [line('brownie', 1, 0)]),
            menu('pasta', 199, [line('sauce', 1, 12.54), line('noodles', 120, 0)]),
        ]);
        expect(kinds(found, 'brownie')).toEqual([ANOMALY.ZERO_COST, ANOMALY.NO_PRICE]);
        expect(kinds(found, 'pasta')).toEqual([ANOMALY.NO_PRICE]);
    });

    it('leaves a healthy menu and a menu with no recipe alone, and puts the worst first', () => {
        const found = findCostAnomalies([
            menu('ok', 100, [line('a', 10, 1), line('b', 10, 1.5)]),
            menu('no recipe', 100, []),
            menu('thin', 100, [line('a', 1, 85)]),
            menu('over', 100, [line('a', 1, 250)]),
        ]);
        expect(found.map(f => f.name)).toEqual(['over', 'thin']);
    });
});
