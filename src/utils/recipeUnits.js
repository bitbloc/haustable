/**
 * Recipe quantities must be in the ingredient's usage_unit: stock deduction and
 * costing read recipe_ingredients.quantity as usage units and ignore the unit label.
 * These helpers find rows written in another unit and say how to fix each one.
 */
import { suggestConversionFactor, getUnitType } from './unitUtils';

const norm = (u) => String(u ?? '').trim().toLowerCase();

/** The unit a row is really in: 'unit' / empty means "the ingredient's usage unit". */
export const rowUnit = (row, ingredient) => {
    const u = norm(row?.unit);
    return !u || u === 'unit' ? norm(ingredient?.usage_unit) : u;
};

/**
 * How to bring `qty` in `from` to `to`.
 *   { kind: 'same' }                                     nothing to do
 *   { kind: 'convert', factor, quantity }                g -> kg, l -> ml ...
 *   { kind: 'liquid', factor: 1, quantity }              ml <-> g, only if the person agrees 1 ml = 1 g
 *   { kind: 'manual' }                                    pieces vs grams etc.
 */
export const unitFix = (qty, from, to) => {
    const a = norm(from);
    const b = norm(to);
    if (!a || !b || a === b) return { kind: 'same' };
    const q = Number(qty) || 0;
    const factor = suggestConversionFactor(a, b);
    if (factor) return { kind: 'convert', factor, quantity: Math.round(q * factor * 10000) / 10000 };
    const ta = getUnitType(a);
    const tb = getUnitType(b);
    const liquidPair = (ta === 'volume' && tb === 'mass') || (ta === 'mass' && tb === 'volume');
    if (liquidPair) {
        // Bring to ml/g first, then treat 1 ml as 1 g.
        const base = ta === 'volume' ? 'ml' : 'g';
        const target = tb === 'volume' ? 'ml' : 'g';
        const toBase = suggestConversionFactor(a, base) || 1;
        const fromTarget = suggestConversionFactor(target, b) || 1;
        return { kind: 'liquid', factor: toBase * fromTarget, quantity: Math.round(q * toBase * fromTarget * 10000) / 10000 };
    }
    return { kind: 'manual' };
};

/**
 * Rows whose unit differs from their ingredient's usage unit.
 * rows: recipe_ingredients ({ id, parent_menu_item_id, parent_stock_item_id, ingredient_id, quantity, unit })
 * itemsById: stock items; menuById: menu items (for the parent name)
 */
export const findRecipeUnitIssues = (rows = [], itemsById = new Map(), menuById = new Map()) => {
    const out = [];
    for (const row of rows) {
        const ing = itemsById.get(row.ingredient_id);
        if (!ing || !ing.usage_unit) continue;
        const from = rowUnit(row, ing);
        const to = norm(ing.usage_unit);
        if (from === to) continue;
        const parent = row.parent_menu_item_id
            ? menuById.get(row.parent_menu_item_id)
            : itemsById.get(row.parent_stock_item_id);
        out.push({
            rowId: row.id,
            parentName: parent?.name || 'ไม่พบสูตร',
            parentKind: row.parent_menu_item_id ? 'menu' : 'stock',
            parentId: row.parent_menu_item_id ?? row.parent_stock_item_id,
            ingredientId: ing.id,
            ingredientName: ing.name,
            quantity: Number(row.quantity) || 0,
            from,
            to,
            fix: unitFix(row.quantity, from, to)
        });
    }
    return out.sort((a, b) => a.parentName.localeCompare(b.parentName, 'th') || a.ingredientName.localeCompare(b.ingredientName, 'th'));
};

/**
 * An ingredient's usage unit is changing from `oldUnit` to `newUnit`: what each recipe row
 * of it should become. Convertible rows get the new quantity; the others keep their number
 * but are labelled with the old unit, so the unit check lists them for a person to fix.
 */
export const planUsageUnitChange = (rows = [], oldUnit, newUnit) => {
    const from = norm(oldUnit);
    const to = norm(newUnit);
    if (!from || !to || from === to) return { updates: [], manual: 0 };
    const updates = [];
    let manual = 0;
    for (const row of rows) {
        const rowFrom = norm(row.unit) && norm(row.unit) !== 'unit' ? norm(row.unit) : from;
        if (rowFrom !== from) continue; // already labelled with some other unit; the check handles it
        const fix = unitFix(row.quantity, from, to);
        if (fix.kind === 'convert') {
            updates.push({ id: row.id, quantity: fix.quantity, unit: to });
        } else {
            manual += 1;
            updates.push({ id: row.id, quantity: Number(row.quantity) || 0, unit: from });
        }
    }
    return { updates, manual };
};
