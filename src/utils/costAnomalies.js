// Menus whose recipe cost cannot be right, or leaves nothing to sell on.
// A wrong figure here is also a wrong stock deduction: both read the same recipe line.

export const ANOMALY = Object.freeze({
    OVER_PRICE: 'over_price',   // costs more than it sells for
    THIN: 'thin',               // cost takes 80% or more of the price
    BIG_LINE: 'big_line',       // one ingredient among several takes half the price
    NO_PRICE: 'no_price',       // an ingredient has no purchase price
    ZERO_COST: 'zero_cost',     // has a recipe, costs nothing
});

const THIN_SHARE = 0.8;
const BIG_LINE_SHARE = 0.5;
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/**
 * @param {Array<{id, name, price, cost, hasRecipe, costLines?: Array<{id, name, qty, unit, unitCost, total}>}>} menus
 * @returns {Array<{id, name, price, cost, share, reasons: Array<{kind, line?}>}>} worst first
 */
export function findCostAnomalies(menus = []) {
    const found = [];
    for (const menu of menus || []) {
        if (!menu || !menu.hasRecipe) continue;
        const price = num(menu.price);
        const cost = num(menu.cost);
        const lines = (menu.costLines || []).filter(l => num(l.qty) > 0);
        const reasons = [];

        if (cost <= 0) {
            reasons.push({ kind: ANOMALY.ZERO_COST });
        } else if (price > 0 && cost > price) {
            reasons.push({ kind: ANOMALY.OVER_PRICE });
        } else if (price > 0 && cost >= price * THIN_SHARE) {
            reasons.push({ kind: ANOMALY.THIN });
        }

        // A single-ingredient menu (a can of beer) is its one line by nature, and so is one
        // whole bottle in a set: only an amount other than 1 that dominates a real recipe
        // points at a wrong quantity or unit.
        if (price > 0 && lines.length > 1) {
            for (const line of lines) {
                if (num(line.qty) !== 1 && num(line.total) >= price * BIG_LINE_SHARE) reasons.push({ kind: ANOMALY.BIG_LINE, line });
            }
        }

        for (const line of lines) {
            if (num(line.unitCost) <= 0) reasons.push({ kind: ANOMALY.NO_PRICE, line });
        }

        if (reasons.length > 0) {
            found.push({ id: menu.id, name: menu.name, price, cost, share: price > 0 ? cost / price : 0, reasons });
        }
    }
    // Worst first: what costs most against its price, then what is merely unpriced.
    return found.sort((a, b) => b.share - a.share || String(a.name).localeCompare(String(b.name), 'th'));
}
