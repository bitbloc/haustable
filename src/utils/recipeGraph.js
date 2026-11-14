/**
 * recipeGraph.js
 * Shared rules for stock items that are made from other stock items.
 *
 * Item types (stock_items.item_type)
 *   raw     bought and counted
 *   prep    made in-house; one making = 1 portion, yielding portion_yield_qty of usage_unit
 *   recipe  a recipe only (per-glass drink, template); never held as stock
 *
 * Quantity rule: current_quantity is counted in pack_unit, and
 * 1 pack_unit = conversion_factor usage_unit. Recipes are written in usage_unit.
 */

export const ITEM_TYPES = Object.freeze({ RAW: 'raw', PREP: 'prep', RECIPE: 'recipe' });
export const PREP_MODES = Object.freeze({ STOCKED: 'stocked', PASSTHROUGH: 'passthrough' });

export const ITEM_TYPE_LABELS = Object.freeze({
    raw: 'วัตถุดิบ',
    prep: 'ของเตรียม',
    recipe: 'สูตร'
});

const num = (v, fallback = 0) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
};

/** Works before the item_type column exists: old rows only carry is_base_recipe. */
export const getItemType = (item) => {
    if (!item) return ITEM_TYPES.RAW;
    if (item.item_type === 'raw' || item.item_type === 'prep' || item.item_type === 'recipe') return item.item_type;
    return item.is_base_recipe ? ITEM_TYPES.RECIPE : ITEM_TYPES.RAW;
};

export const isMadeItem = (item) => getItemType(item) !== ITEM_TYPES.RAW;

/** True when the item itself sits on a shelf and is counted. */
export const isStockedItem = (item) => {
    const type = getItemType(item);
    if (type === ITEM_TYPES.RAW) return true;
    return type === ITEM_TYPES.PREP && (item.prep_mode || PREP_MODES.STOCKED) === PREP_MODES.STOCKED;
};

/** usage_unit produced by one making of a made item (one portion / one glass). */
export const usagePerPortion = (item) => {
    if (!item) return 1;
    if (getItemType(item) === ITEM_TYPES.PREP && num(item.portion_yield_qty) > 0) return num(item.portion_yield_qty);
    const perPortion = num(item.pack_size, 1) * num(item.conversion_factor, 1);
    return perPortion > 0 ? perPortion : 1;
};

/** A prep is only usable in recipes once someone has measured what one portion yields. */
export const hasPortionYield = (item) =>
    getItemType(item) !== ITEM_TYPES.PREP || num(item?.portion_yield_qty) > 0;

/** Recipe quantity (usage_unit) -> how much comes off the counted stock (pack_unit). */
export const usageToStockQty = (item, usageQty) => {
    const factor = num(item?.conversion_factor, 1) || 1;
    const usable = Math.min(Math.max(num(item?.yield_percent, 100), 1), 100) / 100;
    return num(usageQty) / factor / usable;
};

/**
 * Cost resolver that always derives the cost of made items from their current
 * ingredients instead of the cost_price saved the last time the recipe was edited.
 *
 * items       stock_items rows
 * recipeRows  recipe_ingredients rows whose parent is a stock item
 *             ({ parent_stock_item_id, ingredient_id, quantity })
 *
 * Returns
 *   portionCost(id)  cost of one making of a made item (stored cost_price if it has no recipe)
 *   unitCost(id)     cost per usage_unit of any item
 *   getItem(id)      the item with cost_price replaced by the live value, for calculateRecipeCost
 *   hasLoop(id)      true when the item's recipe refers back to itself
 */
export const buildLiveCostResolver = (items = [], recipeRows = []) => {
    const byId = new Map((items || []).filter(Boolean).map(i => [i.id, i]));
    const rowsByParent = new Map();
    for (const row of recipeRows || []) {
        if (!row?.parent_stock_item_id || !row.ingredient_id) continue;
        if (!rowsByParent.has(row.parent_stock_item_id)) rowsByParent.set(row.parent_stock_item_id, []);
        rowsByParent.get(row.parent_stock_item_id).push(row);
    }

    const portionMemo = new Map();
    const loops = new Set();

    const rawUnitCost = (item) => {
        const price = num(item.cost_price);
        const units = num(item.pack_size, 1) * num(item.conversion_factor, 1) * (num(item.yield_percent, 100) / 100);
        return units > 0 ? price / units : 0;
    };

    const portionCost = (id, trail = new Set()) => {
        if (portionMemo.has(id)) return portionMemo.get(id);
        const item = byId.get(id);
        if (!item) return 0;
        const rows = rowsByParent.get(id);
        if (!isMadeItem(item) || !rows || rows.length === 0) return num(item.cost_price);
        if (trail.has(id)) {
            loops.add(id);
            return 0;
        }
        const nextTrail = new Set(trail).add(id);
        let total = 0;
        for (const row of rows) {
            total += unitCost(row.ingredient_id, nextTrail) * num(row.quantity);
        }
        if (!trail.size) portionMemo.set(id, total);
        return total;
    };

    const unitCost = (id, trail = new Set()) => {
        const item = byId.get(id);
        if (!item) return 0;
        if (!isMadeItem(item)) return rawUnitCost(item);
        const usable = num(item.yield_percent, 100) / 100;
        const perPortion = usagePerPortion(item) * (usable > 0 ? usable : 1);
        return perPortion > 0 ? portionCost(id, trail) / perPortion : 0;
    };

    const getItem = (id) => {
        const item = byId.get(id);
        if (!item || !isMadeItem(item)) return item;
        return {
            ...item,
            cost_price: portionCost(id),
            pack_size: 1,
            conversion_factor: usagePerPortion(item)
        };
    };

    return { portionCost, unitCost, getItem, hasLoop: (id) => { portionCost(id); return loops.has(id); } };
};

/**
 * Things that would make automatic stock deduction or costing wrong for one made item.
 * Returns [{ code, message }]; empty means ready.
 */
export const getRecipeIssues = (item, rows = [], itemsById = new Map()) => {
    const issues = [];
    const type = getItemType(item);
    if (type === ITEM_TYPES.PREP && !hasPortionYield(item)) {
        issues.push({ code: 'no_portion_yield', message: 'ยังไม่ได้ระบุปริมาณที่ได้ต่อ portion' });
    }
    if (type !== ITEM_TYPES.RAW && rows.length === 0) {
        issues.push({ code: 'no_ingredients', message: 'ยังไม่มีส่วนผสม' });
    }
    for (const row of rows) {
        const ing = row.ingredient || itemsById.get?.(row.ingredient_id);
        if (!ing) continue;
        if (getItemType(ing) === ITEM_TYPES.RAW && num(ing.cost_price) <= 0) {
            issues.push({ code: 'no_cost', message: `${ing.name}: ยังไม่มีราคาทุน` });
        }
        if (getItemType(ing) === ITEM_TYPES.PREP && !hasPortionYield(ing)) {
            issues.push({ code: 'ingredient_no_yield', message: `${ing.name}: ยังไม่ได้ระบุปริมาณต่อ portion` });
        }
        if (row.unit && ing.usage_unit && row.unit !== 'unit' && row.unit !== ing.usage_unit) {
            issues.push({ code: 'unit_mismatch', message: `${ing.name}: สูตรใช้ ${row.unit} แต่หน่วยใช้คือ ${ing.usage_unit}` });
        }
    }
    return issues;
};
