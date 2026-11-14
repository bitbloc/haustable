/**
 * An SOP holds how to make something (steps, glass, garnish). What goes in it comes
 * from the recipe it is linked to:
 *   source_menu_item_id   a menu item's recipe (Food & Drink -> เมนู)
 *   source_stock_item_id  a base / prep's recipe (Food & Drink -> เบส)
 * The SOP keeps only per-ingredient display flags (sweetener, scalable, hidden, remark)
 * and any extra lines that are not stock (e.g. "ice to the rim").
 */

export const sopLinkOf = (sop) => {
    if (sop?.source_menu_item_id) return { type: 'menu', id: sop.source_menu_item_id };
    if (sop?.source_stock_item_id) return { type: 'stock', id: sop.source_stock_item_id };
    return null;
};

const key = (v) => String(v ?? '').trim().toLowerCase();

/**
 * Recipe rows (recipe_ingredients joined with the ingredient) -> SOP ingredient lines,
 * keeping the flags the SOP already had for the same ingredient, then the manual lines.
 * rows: [{ quantity, unit, ingredient: { id, name, usage_unit } }]
 */
export const mergeLinkedIngredients = (sopIngredients = [], rows = []) => {
    const previous = sopIngredients || [];
    const linked = rows.map((r) => {
        const ing = r.ingredient || {};
        const was = previous.find((i) => (i.id && i.id === ing.id) || (!i.id && key(i.name) === key(ing.name)))
            || previous.find((i) => key(i.name) === key(ing.name));
        return {
            id: ing.id,
            name: ing.name || 'ไม่พบวัตถุดิบ',
            qty: Number(r.quantity) || 0,
            unit: r.unit && r.unit !== 'unit' ? r.unit : (ing.usage_unit || 'unit'),
            scalable: was ? was.scalable !== false : true,
            is_sweetener: was?.is_sweetener === true,
            isHidden: was?.isHidden === true,
            remark: was?.remark || '',
            isLinked: true
        };
    });
    const manual = previous.filter((i) => !i.isLinked);
    return [...linked, ...manual];
};

/** What the SOP row stores: flags of linked lines (no quantities) + manual lines in full. */
export const ingredientsToStore = (ingredients = []) => (ingredients || []).map((i) => (
    i.isLinked
        ? { id: i.id, name: i.name, isLinked: true, scalable: i.scalable !== false, is_sweetener: i.is_sweetener === true, isHidden: i.isHidden === true, remark: i.remark || '' }
        : { ...i, isLinked: false }
));

/** Group recipe rows by their parent so many SOPs can be filled from one query. */
export const groupRecipeRows = (rows = []) => {
    const byMenu = new Map();
    const byStock = new Map();
    for (const r of rows) {
        if (r.parent_menu_item_id) {
            if (!byMenu.has(r.parent_menu_item_id)) byMenu.set(r.parent_menu_item_id, []);
            byMenu.get(r.parent_menu_item_id).push(r);
        } else if (r.parent_stock_item_id) {
            if (!byStock.has(r.parent_stock_item_id)) byStock.set(r.parent_stock_item_id, []);
            byStock.get(r.parent_stock_item_id).push(r);
        }
    }
    return { byMenu, byStock };
};

export const rowsForSop = (sop, grouped) => {
    const link = sopLinkOf(sop);
    if (!link) return null;
    return (link.type === 'menu' ? grouped.byMenu.get(link.id) : grouped.byStock.get(link.id)) || [];
};
