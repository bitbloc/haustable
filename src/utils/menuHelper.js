import { supabase } from '../lib/supabaseClient'

export const fetchAndSortMenu = async () => {
    const [
        { data: menuRaw, error: menuError },
        { data: categories, error: catError }
    ] = await Promise.all([
        supabase.from('menu_items').select('*, menu_item_options(*, option_groups(*, option_choices(*)))').order('category'),
        supabase.from('menu_categories').select('*').order('display_order')
    ])

    if (menuError) throw menuError
    if (catError) throw catError

    // Sort Logic
    const categoryOrder = (categories || []).reduce((acc, cat, idx) => {
        acc[cat.name] = cat.display_order ?? idx
        return acc
    }, {})

    const sortedMenu = (menuRaw || []).sort((a, b) => {
        // 1. Recommended First (Top Priority)
        // is_recommended might be boolean or null. Treat true as highest priority.
        const recA = a.is_recommended === true;
        const recB = b.is_recommended === true;
        
        if (recA !== recB) {
            return recA ? -1 : 1; 
        }

        // 2. Strict Display Order (Manual Sort)
        // Prefer 'sort_order' (new) over 'display_order' (legacy)
        const orderA = a.sort_order ?? a.display_order ?? 999999;
        const orderB = b.sort_order ?? b.display_order ?? 999999;
        
        if (orderA !== orderB) return orderA - orderB;

        // 3. Fallback (Name)
        return a.name.localeCompare(b.name)
    })

    return { menuItems: sortedMenu, categories: categories || [] }
}

export const formatOptionName = (name) => {
    if (!name) return ''
    // Regex to remove patterns like (+10), ( + 20.-), (10.-)
    // Matches parentheses containing numbers and symbols, possibly with 'plus' or 'minus'
    return name.replace(/\(\s*[+-]?\s*\d+(\.\d+)?\s*(\.-)?\s*\)/g, '').trim()
}
