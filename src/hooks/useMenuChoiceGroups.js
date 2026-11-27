import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const EMPTY = Object.freeze({ groupsByMenu: {}, ruleRows: [], recipeRowsByMenu: {}, loading: false, error: false });

const byOrder = (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0);

/**
 * Option groups (with their choices) of a list of menus, the stock rules of those choices,
 * and, on request, the recipe rows of the menus. Used where one menu deducts another
 * menu's recipe: a set's components, an option that points at a menu.
 *
 * @returns {{ groupsByMenu: Object, ruleRows: Array, recipeRowsByMenu: Object, loading: boolean, error: boolean }}
 */
export function useMenuChoiceGroups(menuIds = [], { withRecipes = false } = {}) {
    const key = useMemo(
        () => [...new Set((menuIds || []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b).join(','),
        [menuIds]
    );
    const [state, setState] = useState(EMPTY);

    useEffect(() => {
        if (!key) { setState(EMPTY); return undefined; }
        let cancelled = false;
        const ids = key.split(',').map(Number);

        const load = async () => {
            setState(prev => ({ ...prev, loading: true, error: false }));
            try {
                const [linkRes, recipeRes] = await Promise.all([
                    supabase.from('menu_item_options').select('menu_item_id, option_group_id, display_order').in('menu_item_id', ids),
                    withRecipes
                        ? supabase.from('recipe_ingredients').select('parent_menu_item_id, ingredient_id, quantity, order_scope').in('parent_menu_item_id', ids)
                        : Promise.resolve({ data: [], error: null })
                ]);
                if (linkRes.error) throw linkRes.error;
                if (recipeRes.error) throw recipeRes.error;

                const links = linkRes.data || [];
                const groupIds = [...new Set(links.map(l => l.option_group_id).filter(Boolean))];
                const groupRes = groupIds.length
                    ? await supabase.from('option_groups')
                        .select('id, name, selection_type, max_selection, option_choices (id, name, display_order, sweetener_factor)')
                        .in('id', groupIds)
                    : { data: [], error: null };
                if (groupRes.error) throw groupRes.error;

                const groups = new Map((groupRes.data || []).map(g => [g.id, {
                    ...g,
                    option_choices: [...(g.option_choices || [])].sort(byOrder)
                }]));
                const choiceIds = [...groups.values()].flatMap(g => g.option_choices.map(c => c.id));
                const ruleRes = choiceIds.length
                    ? await supabase.from('option_choice_ingredients').select('*').in('choice_id', choiceIds)
                    : { data: [], error: null };
                if (ruleRes.error) throw ruleRes.error;

                const groupsByMenu = {};
                for (const link of [...links].sort(byOrder)) {
                    const group = groups.get(link.option_group_id);
                    if (!group) continue;
                    (groupsByMenu[String(link.menu_item_id)] = groupsByMenu[String(link.menu_item_id)] || []).push(group);
                }
                const recipeRowsByMenu = {};
                for (const row of recipeRes.data || []) {
                    (recipeRowsByMenu[String(row.parent_menu_item_id)] = recipeRowsByMenu[String(row.parent_menu_item_id)] || []).push(row);
                }
                if (!cancelled) {
                    setState({ groupsByMenu, ruleRows: ruleRes.data || [], recipeRowsByMenu, loading: false, error: false });
                }
            } catch (err) {
                console.error('useMenuChoiceGroups load error:', err);
                if (!cancelled) setState(prev => ({ ...prev, loading: false, error: true }));
            }
        };
        load();
        return () => { cancelled = true; };
    }, [key, withRecipes]);

    return state;
}
