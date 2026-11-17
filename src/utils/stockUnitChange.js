import { displayUnit } from './stockCount';

const round4 = (n) => Math.round(n * 10000) / 10000;
const LEVELS = ['min_stock_threshold', 'reorder_point', 'par_level'];

/**
 * An item's counting unit changes (17 bottles counted as bottles, now counted in crates of 12).
 * Stock and alert levels are stored in the counting unit, so they are re-said in the new one.
 *
 * before    the stored row; after  the row about to be saved
 * perUnit   usagePerStockUnit (usage units in one counted unit)
 * Returns { quantity: new current_quantity or null when nothing changes, levels: patch, note }.
 * A level the person typed a new number for in the same save is theirs and is left alone.
 */
export function rescaleForCountUnitChange(before, after, perUnit) {
    const oldPer = Number(perUnit(before)) || 0;
    const newPer = Number(perUnit({ ...before, ...after })) || 0;
    const none = { quantity: null, levels: {}, note: null };
    if (!(oldPer > 0) || !(newPer > 0) || Math.abs(oldPer - newPer) < 1e-9) return none;
    const ratio = oldPer / newPer;
    const levels = {};
    for (const k of LEVELS) {
        const old = Number(before?.[k]) || 0;
        if (old > 0 && Number(after?.[k]) === old) levels[k] = round4(old * ratio);
    }
    const qty = Number(before?.current_quantity) || 0;
    const quantity = Math.abs(qty) > 1e-9 ? round4(qty * ratio) : null;
    const oldUnit = displayUnit(before?.unit || before?.pack_unit);
    const newUnit = displayUnit(after?.unit || after?.pack_unit);
    const note = `เปลี่ยนหน่วยนับ ${oldUnit} → ${newUnit}: ยอดคงเหลือ ${round4(qty)} → ${quantity ?? 0} ${newUnit} (ปริมาณเท่าเดิม)`;
    return { quantity, levels, note };
}
