/**
 * Per-glass / per-dish recipe items (stock_items.item_type = 'recipe') are a second
 * place to write what a menu uses. Moving one into its menu:
 *   - menus that used the recipe item as one ingredient (qty q) get its rows x q instead,
 *   - the chosen menu, if it did not use it, gets its rows (replacing what it had, if asked),
 *   - the recipe item and its rows can then be deleted.
 *
 * recipeRows: rows of the recipe item ({ ingredient_id, quantity, unit, layer_order })
 * menuRows:   rows of menus, each { id, parent_menu_item_id, ingredient_id, quantity, unit, layer_order }
 */
export const planMoveRecipeToMenu = ({ recipeId, recipeRows = [], menuRows = [], targetMenuId, replaceTarget = false }) => {
    const deletes = [];
    const inserts = [];
    const touched = new Set();
    const copyRows = (menuId, factor, startOrder) => recipeRows.map((r, i) => ({
        parent_menu_item_id: menuId,
        ingredient_id: r.ingredient_id,
        quantity: Math.round((Number(r.quantity) || 0) * factor * 10000) / 10000,
        unit: r.unit,
        layer_order: startOrder + i
    }));

    // Menus that point at the recipe item
    const refs = menuRows.filter(r => r.ingredient_id === recipeId);
    for (const ref of refs) {
        deletes.push(ref.id);
        const order = Number(ref.layer_order) || 0;
        inserts.push(...copyRows(ref.parent_menu_item_id, Number(ref.quantity) || 1, order));
        touched.add(String(ref.parent_menu_item_id));
    }

    let conflict = false;
    if (targetMenuId != null && !touched.has(String(targetMenuId))) {
        const existing = menuRows.filter(r => String(r.parent_menu_item_id) === String(targetMenuId));
        if (existing.length && !replaceTarget) {
            conflict = true;
        } else {
            deletes.push(...existing.map(r => r.id));
            inserts.push(...copyRows(targetMenuId, 1, 0));
            touched.add(String(targetMenuId));
        }
    }

    return { deletes, inserts, menus: [...touched], conflict };
};
