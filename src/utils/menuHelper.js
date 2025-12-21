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
        // 1. Group by Category (Already implicit if grouped)
        
        // 2. Strict Display Order (Manual Sort)
        const orderA = a.display_order ?? 999999;
        const orderB = b.display_order ?? 999999;
        if (orderA !== orderB) return orderA - orderB;

        // 3. Fallback (Name)
        return a.name.localeCompare(b.name)
    })

    return { menuItems: sortedMenu, categories: categories || [] }
}
