import { buildLiveCostResolver } from './recipeGraph';
import { calculateRealUnitCost, calculateRecipeCost } from './costUtils';
import { setComponentsCost } from './setComponents';

/**
 * Material cost of one menu, the way the Menu Cost page and the recipe builder work it out:
 * made items (bases, prep) are costed from their own ingredients at today's prices, and
 * takeaway-only lines (packaging) are kept apart from the dine-in cost. A set menu also
 * counts the recipes of the menus it is made of.
 *
 * @returns {Promise<{ cost: number, takeawayExtraCost: number }>}
 */
export async function fetchMenuMaterialCost(supabase, menuId) {
    const [recipeRes, stockRes, nestedRes, setRes] = await Promise.all([
        supabase.from('recipe_ingredients')
            .select('ingredient_id, quantity, unit, order_scope')
            .eq('parent_menu_item_id', menuId),
        supabase.from('stock_items').select('*'),
        supabase.from('recipe_ingredients')
            .select('parent_stock_item_id, ingredient_id, quantity')
            .not('parent_stock_item_id', 'is', null),
        supabase.from('menu_set_components')
            .select('component_menu_item_id, quantity, choice_ids')
            .eq('set_menu_item_id', menuId),
    ]);
    const failed = recipeRes.error || stockRes.error || nestedRes.error;
    if (failed) throw failed;

    // Not a set (or the table is not there yet): the menu's own recipe is the whole cost
    const components = setRes.error ? [] : (setRes.data || []);
    let componentRecipeRows = [];
    let ruleRows = [];
    if (components.length) {
        const componentIds = components.map(c => c.component_menu_item_id);
        const choiceIds = [...new Set(components.flatMap(c => c.choice_ids || []))];
        const [rowsRes, rulesRes] = await Promise.all([
            supabase.from('recipe_ingredients')
                .select('parent_menu_item_id, ingredient_id, quantity, order_scope')
                .in('parent_menu_item_id', componentIds),
            choiceIds.length
                ? supabase.from('option_choice_ingredients').select('*').in('choice_id', choiceIds)
                : Promise.resolve({ data: [], error: null }),
        ]);
        if (rowsRes.error) throw rowsRes.error;
        if (rulesRes.error) throw rulesRes.error;
        componentRecipeRows = rowsRes.data || [];
        ruleRows = rulesRes.data || [];
    }

    return menuMaterialCost(recipeRes.data || [], stockRes.data || [], nestedRes.data || [], {
        components, componentRecipeRows, ruleRows
    });
}

/**
 * Pure part of fetchMenuMaterialCost: the menu's recipe rows, every stock item, every base
 * recipe row. For a set: its component rows, the recipe rows of those menus
 * (with parent_menu_item_id) and the stock rules of the choices the set fixes.
 */
export function menuMaterialCost(menuRows, stockItems, nestedRows, { components = [], componentRecipeRows = [], ruleRows = [] } = {}) {
    const liveCost = buildLiveCostResolver(stockItems, nestedRows);
    const lookup = (id) => liveCost.getItem(id);
    const isTakeawayOnly = (row) => (row.order_scope || 'all') === 'takeaway';

    let cost = calculateRecipeCost(menuRows.filter(r => !isTakeawayOnly(r)), lookup).totalCost || 0;
    let takeawayExtraCost = calculateRecipeCost(menuRows.filter(isTakeawayOnly), lookup).totalCost || 0;

    if (components.length) {
        const recipeRowsByMenu = {};
        for (const row of componentRecipeRows) {
            (recipeRowsByMenu[String(row.parent_menu_item_id)] = recipeRowsByMenu[String(row.parent_menu_item_id)] || []).push(row);
        }
        const inSet = setComponentsCost(components, {
            recipeRowsByMenu,
            ruleRows,
            unitCostOf: (id) => calculateRealUnitCost(lookup(id))
        });
        cost += inSet.cost;
        takeawayExtraCost += inSet.takeawayExtraCost;
    }
    return { cost, takeawayExtraCost };
}
