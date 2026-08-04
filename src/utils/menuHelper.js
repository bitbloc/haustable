import { supabase } from '../lib/supabaseClient'

let cachedMenu = null;
let cachedCategories = null;
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const optimizeImageUrl = (url, width = 400) => {
    if (!url) return null;
    // ปิดการใช้ Supabase Image Transformation เพื่อประหยัดโควต้า
    // เปลี่ยนมาใช้บริการ Public CDN ฟรี (wsrv.nl) สำหรับ Resize & Convert เป็น webp แทน
    if (url.startsWith('http')) {
        return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width}&output=webp&q=80`;
    }
    return url;
}

export const fetchAndSortMenu = async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && cachedMenu && cachedCategories && (now - lastFetchTime < CACHE_TTL)) {
        return { menuItems: cachedMenu, categories: cachedCategories };
    }

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

    const sortedMenu = (menuRaw || []).map(item => ({
        ...item,
        image_url: optimizeImageUrl(item.image_url) // Optimize images for performance
    })).sort((a, b) => {
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

    // Update Cache
    cachedMenu = sortedMenu;
    cachedCategories = categories || [];
    lastFetchTime = Date.now();

    return { menuItems: cachedMenu, categories: cachedCategories }
}

export const formatOptionName = (name) => {
    if (!name) return ''
    // Regex to remove patterns like (+10), ( + 20.-), (10.-)
    // Matches parentheses containing numbers and symbols, possibly with 'plus' or 'minus'
    return name.replace(/\(\s*[+-]?\s*\d+(\.\d+)?\s*(\.-)?\s*\)/g, '').trim()
}
