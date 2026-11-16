/**
 * An SOP holds how to make something (steps, glass, garnish). What goes in it comes
 * from the recipe it is linked to:
 *   source_menu_item_id   a menu item's recipe (Food & Drink -> เมนู)
 *   source_stock_item_id  a base / prep's recipe (Food & Drink -> เบส)
 * The SOP keeps only per-ingredient display flags (sweetener, scalable, hidden, remark)
 * and any extra lines that are not stock (e.g. "ice to the rim").
 *
 * Sweetness of an SOP linked to a menu has one home: the menu's stock setup.
 *   which ingredients are sweeteners  stock_items.is_sweetener
 *   the levels and how much each uses  the menu's sweetness option group
 *                                      (option_choices.sweetener_factor: 0, 0.5, 1, 1.2 ...)
 * The bar sheet shows exactly what a sale deducts. The SOP's own sweetness table is used only
 * by SOPs that are not linked to a menu (bases, or unlinked notes).
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
export const mergeLinkedIngredients = (sopIngredients = [], rows = [], options = {}) => {
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
            // A menu link takes the flag of the stock item (the one place it is set); a base link
            // keeps the flag the SOP had.
            is_sweetener: options.stockSweetener && typeof ing.is_sweetener === 'boolean'
                ? ing.is_sweetener
                : was?.is_sweetener === true,
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

/** A sweetness option group: one whose choices carry a sweetener factor. */
export const isSweetGroup = (group) => (group?.option_choices || [])
    .some((c) => c.sweetener_factor !== null && c.sweetener_factor !== undefined);

/**
 * menu id -> its sweetness levels, from the option groups linked to each menu:
 * [{ id, label, factor }] in the order the choices are shown at the till. A choice of a
 * sweetness group with no factor counts as normal (1), as the stock deduction does.
 * links: [{ menu_item_id, option_group_id }]
 * groups: [{ id, name, option_choices: [{ id, name, sweetener_factor, display_order }] }]
 */
export const sweetnessLevelsByMenu = (links = [], groups = []) => {
    const groupById = new Map((groups || []).map((g) => [String(g.id), g]));
    const out = new Map();
    for (const link of links || []) {
        const menuId = String(link.menu_item_id);
        if (out.has(menuId)) continue;
        const group = groupById.get(String(link.option_group_id));
        if (!isSweetGroup(group)) continue;
        out.set(menuId, [...group.option_choices]
            .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
            .map((c) => ({
                id: String(c.id),
                label: c.name || '',
                factor: c.sweetener_factor === null || c.sweetener_factor === undefined ? 1 : Number(c.sweetener_factor)
            })));
    }
    return out;
};

/** The level a drink is made at unless asked otherwise: the normal one (factor 1), else the nearest. */
export const defaultSweetLevel = (levels = []) => {
    if (!levels?.length) return null;
    return [...levels].sort((a, b) => Math.abs(a.factor - 1) - Math.abs(b.factor - 1))[0];
};

/** "100%", "50%", "120%" for a factor. */
export const factorPercent = (factor) => `${Math.round((Number(factor) || 0) * 100)}%`;
