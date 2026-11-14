import { supabase } from '../lib/supabaseClient';

/**
 * Recipe versions: every save of a menu / base recipe keeps a snapshot
 * (recipe_versions), so you can see what changed, when and by whom, and go back.
 */

const round = (n) => Math.round((Number(n) || 0) * 10000) / 10000;

/** Editor lines -> stored rows (names kept so old versions read well after renames). */
export const snapshotRows = (ingredients = []) => ingredients.map((ing, i) => ({
    ingredient_id: ing.ingredientId || ing.ingredient_id,
    name: ing.ingredient?.name || ing.name || '',
    quantity: round(ing.quantity),
    unit: ing.unit || ing.ingredient?.usage_unit || '',
    layer_order: i
}));

/**
 * What changed from `before` to `after` (rows as stored).
 * Returns { added, removed, changed: [{ name, from, to, unit }] }.
 */
export const diffRecipeRows = (before = [], after = []) => {
    const key = (r) => r.ingredient_id || r.name;
    const prev = new Map(before.map(r => [key(r), r]));
    const next = new Map(after.map(r => [key(r), r]));
    const added = after.filter(r => !prev.has(key(r)));
    const removed = before.filter(r => !next.has(key(r)));
    const changed = after
        .filter(r => prev.has(key(r)))
        .map(r => ({ r, p: prev.get(key(r)) }))
        .filter(({ r, p }) => round(r.quantity) !== round(p.quantity) || (r.unit || '') !== (p.unit || ''))
        .map(({ r, p }) => ({ name: r.name || p.name, from: round(p.quantity), to: round(r.quantity), unit: r.unit || p.unit || '', fromUnit: p.unit || '' }));
    return { added, removed, changed };
};

export const isSameRecipe = (a = [], b = []) => {
    const d = diffRecipeRows(a, b);
    return !d.added.length && !d.removed.length && !d.changed.length;
};

/** Store a version after a save. Skips an identical repeat. Never throws. */
export const saveRecipeVersion = async ({ parentType, parentId, ingredients, totalCost = null, note = null }) => {
    try {
        const rows = snapshotRows(ingredients);
        const field = parentType === 'menu' ? 'parent_menu_item_id' : 'parent_stock_item_id';
        const { data: last, error: lastErr } = await supabase
            .from('recipe_versions')
            .select('rows')
            .eq(field, parentId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (lastErr) return { ok: false, skipped: false, missing: /recipe_versions|42P01|PGRST205/i.test(`${lastErr.code} ${lastErr.message}`) };
        if (last && isSameRecipe(last.rows || [], rows)) return { ok: true, skipped: true };

        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        const { error } = await supabase.from('recipe_versions').insert({
            [field]: parentId,
            rows,
            total_cost: totalCost === null ? null : Math.round(Number(totalCost) * 100) / 100,
            saved_by: user?.user_metadata?.full_name || user?.email || 'Staff',
            note
        });
        return { ok: !error, skipped: false, missing: false };
    } catch (err) {
        console.warn('[recipeVersions] not saved', err);
        return { ok: false, skipped: false, missing: false };
    }
};
