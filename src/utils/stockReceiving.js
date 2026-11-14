/**
 * Receiving stock (receive_stock RPC). Quantities are in the item's counted unit,
 * prices are baht for the whole line as written on the bill.
 */
import { usagePerStockUnit, getItemType, ITEM_TYPES } from './recipeGraph';

const toNum = (v) => {
    if (v === '' || v === null || v === undefined) return NaN;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : NaN;
};

/** Baht per counted unit from cost_price (same rule as SQL stock_count_unit_cost). */
export const countUnitCost = (item) => {
    const cost = Number(item?.cost_price) || 0;
    if (cost <= 0) return 0;
    if (getItemType(item) === ITEM_TYPES.PREP) return cost;
    const perPack = (Number(item?.pack_size) || 1) * (Number(item?.conversion_factor) || 1);
    return perPack > 0 ? (cost / perPack) * usagePerStockUnit(item) : 0;
};

/**
 * Check the draft lines. Returns { lines, errors, total, priced, allPriced }.
 * lines are ready for the RPC; errors is keyed by line key.
 */
export const validateReceiveLines = (draft = []) => {
    const errors = {};
    const lines = [];
    let total = 0;
    let priced = 0;
    for (const d of draft) {
        const qty = toNum(d.quantity);
        const hasPrice = String(d.lineTotal ?? '').trim() !== '';
        const price = hasPrice ? toNum(d.lineTotal) : null;
        if (!d.stockItemId) errors[d.key] = 'เลือกวัตถุดิบ';
        else if (!Number.isFinite(qty) || qty <= 0) errors[d.key] = 'ใส่จำนวนมากกว่า 0';
        else if (hasPrice && (!Number.isFinite(price) || price < 0)) errors[d.key] = 'ราคาไม่ถูกต้อง';
        if (errors[d.key]) continue;
        const line = { stock_item_id: d.stockItemId, quantity: Math.round(qty * 10000) / 10000, update_cost: d.updateCost !== false };
        if (hasPrice) {
            line.line_total = Math.round(price * 100) / 100;
            total += line.line_total;
            priced += 1;
        }
        lines.push(line);
    }
    return { lines, errors, total: Math.round(total * 100) / 100, priced, allPriced: lines.length > 0 && priced === lines.length };
};

/** Price per counted unit on this bill vs. the cost on file; null when either is unknown. */
export const priceChange = (item, quantity, lineTotal) => {
    const qty = toNum(quantity);
    const price = toNum(lineTotal);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price)) return null;
    const unitNow = price / qty;
    const before = countUnitCost(item);
    const pct = before > 0 ? ((unitNow - before) / before) * 100 : null;
    return { unitNow, before, pct, big: pct !== null && Math.abs(pct) >= 20 };
};

/** Which expense to make: 'new' needs every line priced. */
export const expenseProblem = (mode, check, linkedExpenseId) => {
    if (mode === 'new' && !check.allPriced) return 'ใส่ราคาให้ครบทุกรายการก่อน ถึงจะสร้างค่าใช้จ่ายจากบิลนี้ได้';
    if (mode === 'link' && !linkedExpenseId) return 'เลือกค่าใช้จ่ายที่บันทึกไว้แล้ว';
    return null;
};
