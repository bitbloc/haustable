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

export const invalidateMenuCache = () => {
    cachedMenu = null;
    cachedCategories = null;
    lastFetchTime = 0;
};

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

/**
 * Safely format order item selected_options and item notes into clean, human-readable strings.
 * Handles arrays, objects, JSON strings, nested choices, prices, and notes.
 * Guarantees NO "[object Object]" or raw JSON leaks.
 * 
 * @param {Array|Object|string} options - selected_options from DB or cart
 * @param {string} [itemNote] - item_note or special_instructions
 * @returns {string[]} Array of formatted option strings e.g. ['ระดับความเผ็ด: เผ็ดน้อย', 'ไข่ดาว (+฿10)', 'หมายเหตุ: แยกน้ำ']
 */
export const formatOrderItemOptions = (options, itemNote = null) => {
    if (!options && !itemNote) return []
    let list = []

    let parsed = options
    if (typeof options === 'string') {
        const trimmed = options.trim()
        if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
            try {
                parsed = JSON.parse(trimmed)
            } catch {
                parsed = trimmed
            }
        } else {
            parsed = trimmed
        }
    }

    const formatSingleOpt = (opt) => {
        if (!opt) return ''
        if (typeof opt === 'string' || typeof opt === 'number') {
            const str = String(opt).trim()
            return str === '[object Object]' ? '' : str
        }
        if (typeof opt === 'object') {
            if (Array.isArray(opt)) {
                return opt.map(formatSingleOpt).filter(Boolean).join(', ')
            }
            const group = opt.group_name || opt.group || opt.option_group || opt.category || ''
            const name = opt.name || opt.choice_name || opt.label || opt.option_name || opt.choice || opt.title || opt.value || ''
            const price = Number(opt.price || opt.extra_price || opt.price_adjustment || 0)
            const priceStr = price > 0 ? ` (+฿${price})` : ''

            if (group && name) {
                return `${group}: ${name}${priceStr}`
            }
            if (name) {
                return `${name}${priceStr}`
            }
            // If it's a key-value object
            const entries = Object.entries(opt)
            if (entries.length > 0) {
                const parts = entries
                    .map(([k, v]) => {
                        if (/^\d+$/.test(k)) return formatSingleOpt(v)
                        const valStr = typeof v === 'object' ? formatSingleOpt(v) : String(v)
                        return valStr && valStr !== '[object Object]' ? `${k}: ${valStr}` : k
                    })
                    .filter(Boolean)
                return parts.join(' | ')
            }
        }
        return ''
    }

    if (Array.isArray(parsed)) {
        list = parsed.map(formatSingleOpt).filter(Boolean)
    } else if (typeof parsed === 'object' && parsed !== null) {
        // Check if this object represents a single option entity
        if (parsed.name || parsed.choice_name || parsed.label || parsed.option_name || parsed.choice) {
            const single = formatSingleOpt(parsed)
            if (single) list.push(single)
        } else {
            list = Object.entries(parsed).flatMap(([k, v]) => {
                if (/^\d+$/.test(k)) {
                    const formatted = formatSingleOpt(v)
                    return formatted ? [formatted] : []
                }
                if (Array.isArray(v)) {
                    const inner = v.map(formatSingleOpt).filter(Boolean).join(', ')
                    return inner ? [`${k}: ${inner}`] : []
                }
                if (typeof v === 'object' && v !== null) {
                    const formatted = formatSingleOpt(v)
                    return formatted ? (formatted.includes(':') ? [formatted] : [`${k}: ${formatted}`]) : []
                }
                const vStr = String(v)
                return vStr && vStr !== '[object Object]' ? [`${k}: ${vStr}`] : [`${k}`]
            }).filter(Boolean)
        }
    } else if (typeof parsed === 'string' && parsed.trim()) {
        if (parsed.trim() !== '[object Object]') {
            list = [parsed.trim()]
        }
    }

    // Append item note if exists and not already contained in the options list
    if (itemNote && typeof itemNote === 'string' && itemNote.trim()) {
        const noteTrimmed = itemNote.trim()
        if (noteTrimmed !== '[object Object]' && !list.some(item => item.includes(noteTrimmed))) {
            list.push(`หมายเหตุ: ${noteTrimmed}`)
        }
    }

    return list
}
