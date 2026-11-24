import { buildLiveCostResolver } from './recipeGraph';
import { calculateRecipeCost } from './costUtils';

/**
 * Material cost of one menu, the way the Menu Cost page and the recipe builder work it out:
 * made items (bases, prep) are costed from their own ingredients at today's prices, and
 * takeaway-only lines (packaging) are kept apart from the dine-in cost.
 *
 * @returns {Promise<{ cost: number, takeawayExtraCost: number }>}
 */
export async function fetchMenuMaterialCost(supabase, menuId) {
    const [recipeRes, stockRes, nestedRes] = await Promise.all([
        supabase.from('recipe_ingredients')
            .select('ingredient_id, quantity, unit, order_scope')
            .eq('parent_menu_item_id', menuId),
        supabase.from('stock_items').select('*'),
        supabase.from('recipe_ingredients')
            .select('parent_stock_item_id, ingredient_id, quantity')
            .not('parent_stock_item_id', 'is', null),
    ]);
    const failed = recipeRes.error || stockRes.error || nestedRes.error;
    if (failed) throw failed;

    return menuMaterialCost(recipeRes.data || [], stockRes.data || [], nestedRes.data || []);
}

/** Pure part of fetchMenuMaterialCost: the menu's recipe rows, every stock item, every base recipe row. */
export function menuMaterialCost(menuRows, stockItems, nestedRows) {
    const liveCost = buildLiveCostResolver(stockItems, nestedRows);
    const lookup = (id) => liveCost.getItem(id);
    const isTakeawayOnly = (row) => (row.order_scope || 'all') === 'takeaway';

    const cost = calculateRecipeCost(menuRows.filter(r => !isTakeawayOnly(r)), lookup).totalCost;
    const takeawayExtraCost = calculateRecipeCost(menuRows.filter(isTakeawayOnly), lookup).totalCost;
    return { cost: cost || 0, takeawayExtraCost: takeawayExtraCost || 0 };
}
