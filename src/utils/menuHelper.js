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
        // 1. Recommended (Top Priority)
        if (a.is_recommended !== b.is_recommended) return (b.is_recommended ? 1 : 0) - (a.is_recommended ? 1 : 0)
        
        // 2. Availability (True first)
        if (a.is_available !== b.is_available) return (b.is_available ? 1 : 0) - (a.is_available ? 1 : 0)
        
        // 3. Category Order
        const orderA = categoryOrder[a.category] ?? 999
        const orderB = categoryOrder[b.category] ?? 999
        if (orderA !== orderB) return orderA - orderB
        
        // 4. Name
        return a.name.localeCompare(b.name)
    })

    return { menuItems: sortedMenu, categories: categories || [] }
}
