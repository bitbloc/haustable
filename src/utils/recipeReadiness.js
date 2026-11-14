/**
 * recipeReadiness.js
 * Which menus still need a recipe before sales can deduct stock, ranked by how
 * much they sell, and which existing per-glass / per-dish recipe probably
 * belongs to each menu.
 */

// Prefixes Bar SOP puts in front of recipe names ("Coffee - ลาเต้", "Cocktail-มายา").
const RECIPE_PREFIX = /^(?:oat\s+)?(?:hot\s+)?(?:coffee|coffe|soft\s*drink|cocktail|mocktail)\s*-\s*/i;

/** Comparable core of a menu or recipe name. */
export const normalizeRecipeName = (name) => String(name || '')
    .toLowerCase()
    .replace(RECIPE_PREFIX, '')
    .replace(/\([^)]*\)/g, ' ')          // "(ร้อน,เย็น)", "(ขวด)"
    .replace(/ร้อน|เย็น|\bhot\b|\bcold\b|\biced\b/g, ' ')
    // Drop spaces, dashes, dots, bullets. Keep \p{M}: Thai vowels and tone marks are combining marks.
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '');

/**
 * Recipes whose name matches the menu name. Exact core match first, then one
 * containing the other (only for cores of 3+ characters, to avoid noise).
 * Returns at most `limit` recipes.
 */
export const suggestRecipesForMenu = (menuName, recipes = [], limit = 2) => {
    const core = normalizeRecipeName(menuName);
    if (!core) return [];
    const scored = [];
    for (const recipe of recipes) {
        const rc = normalizeRecipeName(recipe?.name);
        if (!rc) continue;
        let score = 0;
        if (rc === core) score = 3;
        else if (core.length >= 3 && rc.length >= 3 && (rc.includes(core) || core.includes(rc))) {
            score = 2 - Math.abs(rc.length - core.length) / Math.max(rc.length, core.length);
        }
        if (score > 0) scored.push({ recipe, score });
    }
    // A partial match next to an exact one is noise ("อเมริกาโน่มะพร้าว" vs "อเมริกาโน่ร้อน",
    // or the oat-milk variant that belongs to the oat option rather than the menu).
    const pool = scored.some(s => s.score === 3) ? scored.filter(s => s.score === 3) : scored;
    return pool
        .sort((a, b) => b.score - a.score || String(a.recipe.name).localeCompare(String(b.recipe.name), 'th'))
        .slice(0, limit)
        .map(s => s.recipe);
};

/** Units sold per menu id from order_items rows ({ menu_item_id, quantity, is_custom }). */
export const unitsSoldByMenu = (orderItems = []) => {
    const units = new Map();
    for (const row of orderItems) {
        if (!row || row.menu_item_id == null || row.is_custom) continue;
        const qty = Number(row.quantity);
        const key = String(row.menu_item_id);
        units.set(key, (units.get(key) || 0) + (Number.isFinite(qty) && qty > 0 ? qty : 1));
    }
    return units;
};

/**
 * Coverage of sales by menus that have a recipe, and the menus still missing
 * one, best sellers first.
 */
export const summarizeReadiness = (menuItems = [], unitsByMenu = new Map()) => {
    let total = 0;
    let covered = 0;
    const missing = [];
    for (const item of menuItems) {
        const units = unitsByMenu.get(String(item.id)) || 0;
        total += units;
        if (item.hasRecipe) covered += units;
        else if (units > 0) missing.push({ ...item, unitsSold: units });
    }
    missing.sort((a, b) => b.unitsSold - a.unitsSold || String(a.name).localeCompare(String(b.name), 'th'));
    return {
        totalUnits: total,
        coveredUnits: covered,
        coveragePct: total > 0 ? (covered / total) * 100 : 0,
        missing
    };
};
