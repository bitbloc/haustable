import { displayUnit } from './stockCount';

const round4 = (n) => Math.round(n * 10000) / 10000;
const LEVELS = ['min_stock_threshold', 'reorder_point', 'par_level'];

/**
 * An item's setup changes so that one counted unit holds a different amount
 * (counted in bottles, now in crates of 12; or "1 jar = 1 g" corrected to "1 jar = 2,000 g").
 *
 * Two different situations look the same in the numbers:
 *   - the counting unit really changed (bottles -> crates): the stock left should be re-said
 *     in the new unit, 17 bottles become 1.4167 crates ("convert")
 *   - the old setup was wrong and is being fixed: what was counted is still right,
 *     2.3 jars stay 2.3 jars ("keep")
 * Only a person knows which, so this never decides: it returns both answers and the caller asks.
 * (From 17 to 22 Nov 2026 the form converted silently and about 110 setup fixes turned
 * counted stock into nonsense such as 0.0012 jars.)
 *
 * before    the stored row; after  the row about to be saved
 * perUnit   usagePerStockUnit (usage units in one counted unit)
 * Returns
 *   changed     true when the person must choose
 *   quantity    converted current_quantity, or null when the stock is 0
 *   levels      converted alert levels (a level retyped in the same save is left alone)
 *   note        ledger note for "convert"
 *   keep / convert   { quantity, usage } for the dialog: the count and what it means in usage units
 */
export function rescaleForCountUnitChange(before, after, perUnit) {
    const oldPer = Number(perUnit(before)) || 0;
    const newPer = Number(perUnit({ ...before, ...after })) || 0;
    const none = { changed: false, quantity: null, levels: {}, note: null };
    if (!(oldPer > 0) || !(newPer > 0) || Math.abs(oldPer - newPer) < 1e-9) return none;
    const ratio = oldPer / newPer;
    const levels = {};
    for (const k of LEVELS) {
        const old = Number(before?.[k]) || 0;
        if (old > 0 && Number(after?.[k]) === old) levels[k] = round4(old * ratio);
    }
    const qty = Number(before?.current_quantity) || 0;
    const quantity = Math.abs(qty) > 1e-9 ? round4(qty * ratio) : null;
    if (quantity === null && !Object.keys(levels).length) return none;
    const oldUnit = displayUnit(before?.unit || before?.pack_unit);
    const newUnit = displayUnit(after?.unit || after?.pack_unit || before?.unit || before?.pack_unit);
    const usageUnit = displayUnit(after?.usage_unit || before?.usage_unit);
    const note = `เปลี่ยนหน่วยนับ ${oldUnit} → ${newUnit}: ยอดคงเหลือ ${round4(qty)} → ${quantity ?? 0} ${newUnit} (ปริมาณเท่าเดิม)`;
    return {
        changed: true,
        quantity,
        levels,
        note,
        qty: round4(qty),
        oldUnit,
        newUnit,
        usageUnit,
        keep: { quantity: round4(qty), usage: round4(qty * newPer) },
        convert: { quantity: quantity ?? 0, usage: round4(qty * oldPer) }
    };
}
