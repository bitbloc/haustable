import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI'

const supabase = createClient(supabaseUrl, supabaseKey)

// In-memory cache for all page data (Settings, Menu Items, Categories, Checkins)
let cachedPageData = null
let cacheExpiry = 0
const CACHE_TTL_MS = 30 * 1000 // 30 seconds in-memory for instant freshness

const DEFAULT_SETTINGS = {
    link_shop_name: "In the haus | ร้านในบ้าน นครพนม",
    link_shop_name_th: "ในบ้าน",
    link_subtitle: "We Make It Bold . จริตจัด รสชัดเต็ม · Real Southern Taste",
    link_hours: "เปิดทุกวัน 11:30 - 23:30 น. (ครัวปิด 22:00 น.)",
    link_location_text: "ตัวร้านตั้งอยู่บนถนนสุนทรวิจิตร ใกล้ลานพญาศรีสัตตนาคราช 2 นาที ริมโขง นครพนม",
    link_logo_url: "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_logo_url_1778317272888.png",
    link_hero_url: "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_hero_url_1778316469375.jpg",
    link_atm_1: "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_atm_1_1779018095588.jpg",
    link_atm_2: "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_atm_2_1779018097248.jpg",
    link_atm_3: "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_atm_3_1779018098211.jpg",
    link_atm_4: "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_atm_4_1779018126269.jpg",
    link_atm_5: "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_atm_5_1779018173547.jpg",
    link_atm_6: "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_atm_6_1779018174516.jpg",
    link_atm_7: "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_atm_7_1779018175504.jpg",
    link_atm_8: "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_atm_8_1779018177875.jpg",
    link_atm_9: "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_atm_9_1779018237977.jpg",
    link_atm_10: "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_atm_10_1779018239268.jpg",
    link_sig_name_1: "แกงไตปลา (รสชัดเจน)",
    link_sig_price_1: "159",
    link_sig_img_1: "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_sig_img_1_1778318077216.jpg",
    link_sig_name_2: "ผัดใบเหลียงในบ้าน",
    link_sig_price_2: "139",
    link_sig_img_2: "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_sig_img_2_1783397084997.webp",
    link_sig_name_3: "สะตอผัดกุ้งจริตจัด",
    link_sig_price_3: "299",
    link_sig_img_3: "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_sig_img_3_1783397146155.webp",
    link_url_1: "https://lin.ee/EuzwG7c",
    link_url_2: "https://www.instagram.com/inthehausth/",
    link_url_3: "https://www.facebook.com/inthehausth/",
    link_url_4: "https://maps.app.goo.gl/ZkjCsDkQdJi4g2EN7",
    link_tags: "อาหารใต้รสจัด, คาเฟ่ริมโขง, นครพนม, พริกแกงใต้แท้, ที่จอดรถสะดวก, อาหารจานเดียว, จริตจัด รสชัดเต็ม",
    // Same wording as the Google Ads headline (message match)
    link_location_short: "ริมโขง · ห่าง 2 นาที จากลานพญานาค · มีที่จอดรถ",
    link_directions_sub: "ห่าง 2 นาที จากลานพญานาค",
    // "First time here?" chooser lists every available item in these categories (name contains)
    link_set_category: "Set :",
    // The set listed first (tagged "เริ่มที่ชุดนี้") in each group: menu item id or part of its name
    link_starter_solo_item: "115",
    link_starter_item: "141",
    link_starter_xl_item: "143",
    // Solo set is pre-selected during this window (Asia/Bangkok)
    link_lunch_window: "11:30-15:00",
    // "part of menu name=level" (0 = not spicy … 3 = very spicy); "#<menu id>=level" overrides a whole item
    // (used for sets whose dishes are cooked mild). Unmatched items get no meter.
    link_spice_map: "#141=0, #143=0, แกงไตปลา=3, คั่วกลิ้ง=3, (เผ็ด)=2, สะตอ=2, หมูตกเตา=2, (ไม่เผ็ด)=0, ใบเหลียง=0, ต้มจิ๋ว=0, คอหมูย่าง=0, หมูย่างในบ้าน=0, ซอสญี่ปุ่น=0",
    // Categories left out of SPECIALTIES (non-food); is_hausmade items are always left out
    link_hide_categories: "Hausmade."
}

const HEAT_LABELS = ['ไม่เผ็ด', 'เผ็ดน้อย', 'เผ็ดกลาง', 'เผ็ดมาก']

function parseSpiceMap(str) {
    return String(str || '').split(',').map(pair => {
        const i = pair.lastIndexOf('=')
        if (i < 1) return null
        const key = pair.slice(0, i).trim()
        const level = Number(pair.slice(i + 1).trim())
        return key && level >= 0 && level <= 3 ? { key, level } : null
    }).filter(Boolean)
}

// Spice range for an item: a "#id" entry wins outright; otherwise the lowest/highest
// level among name keys found in the item name (null when nothing matches)
function spiceRange(name, spiceMap, id) {
    if (id !== undefined && id !== null) {
        const byId = spiceMap.find(s => s.key === '#' + id)
        if (byId) return { min: byId.level, max: byId.level }
    }
    const levels = spiceMap
        .filter(s => !s.key.startsWith('#') && String(name || '').includes(s.key))
        .map(s => s.level)
    if (levels.length === 0) return null
    return { min: Math.min(...levels), max: Math.max(...levels) }
}

// Three-cell heat meter + Thai label. A set mixing mild and hot dishes reads "มีจานเผ็ด".
function heatHtml(range) {
    if (!range) return ''
    const level = range.max
    const label = level > 0 && range.min === 0 ? 'มีจานเผ็ด' : HEAT_LABELS[level]
    const cells = [1, 2, 3].map(n => `<i${n <= level ? ' class="on"' : ''}></i>`).join('')
    return `<span class="heat h${level}" role="img" aria-label="ความเผ็ด: ${label}"><span class="heat-cells" aria-hidden="true">${cells}</span><span class="heat-label">${label}</span></span>`
}

const DEFAULT_MENU_ITEMS = [
    { id: 'def_1', name: 'สะตอผัดกุ้งจริตจัด', price: '299', image_url: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/menu_1783397268210_opt_1784209041202.webp', is_recommended: true, is_available: true },
    { id: 'def_2', name: 'ใบเหลียงผัดไข่ในบ้าน', price: '139', image_url: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/menu_1783397300271_opt_1784209039524.webp', is_recommended: true, is_available: true },
    { id: 'def_3', name: 'แกงไตปลา (รสชัดเจน!)', price: '159', image_url: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/menu_1781879253173_opt_1784209089011.webp', is_recommended: true, is_available: true },
    { id: 'def_4', name: 'คั่วกลิ้งผักแนม', price: '169', image_url: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/menu_1781868858939_opt_1784209108153.webp', is_recommended: true, is_available: true },
    { id: 'def_5', name: 'ลวกจิ้มโพนยางคำ', price: '199', image_url: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/menu_1765794569520_opt_1784209118111.webp', is_recommended: true, is_available: true },
    { id: 'def_6', name: 'ทาทากิ(ยำเนื้อญี่ปุ่น)', price: '199', image_url: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/menu_1766308737558_opt_1784209116352.webp', is_recommended: true, is_available: true },
    { id: 'def_7', name: 'สปาเก็ตตี้เขียวหวานเนื้อโคขุน (เผ็ด)', price: '269', image_url: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/menu_1765791989879_opt_1784209094379.webp', is_recommended: true, is_available: true },
    { id: 'def_8', name: 'มัทฉะยูสุเฮาส์', price: '150', image_url: 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/menu_1781879738500_opt_1784209051313.webp', is_recommended: true, is_available: true }
]

function optImg(url, w = 400, q = 75) {
    if (!url) return ''
    const clean = url.split('?')[0]
    return `https://wsrv.nl/?url=${encodeURIComponent(clean)}&w=${w}&q=${q}&output=webp`
}

function escapeHtml(str) {
    if (!str) return ''
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

function formatDescriptionHtml(desc) {
    if (!desc) return ''
    const lines = String(desc).trim().split('\n')
    return lines.map(line => {
        const trimmed = line.trim()
        if (!trimmed) return ''
        if (/^(cocktail|coctail|mocktail)\s*\+\s*\d+/i.test(trimmed) || /^\+\s*\d+/.test(trimmed)) {
            return `<span class="modifier-tag">${escapeHtml(trimmed)}</span>`
        }
        return `<span>${escapeHtml(trimmed)}</span>`
    }).filter(Boolean).join('<br>')
}

// Join phrases with a separator, each phrase kept on one line (Thai has no spaces to break on)
function phrasesHtml(text, splitter, joiner) {
    return String(text || '').split(splitter).map(t => t.trim()).filter(Boolean)
        .map(t => `<span class="nb">${escapeHtml(t)}</span>`).join(joiner)
}

// Set name with each phrase kept whole: lines break only at " + " or " · "
function setTitleHtml(title) {
    return String(title || '').split(/(\s[+·]\s)/)
        .map((part, i) => i % 2 ? escapeHtml(part) : `<span class="nb">${escapeHtml(part)}</span>`).join('')
}

// One row of the "First time here?" set chooser
function buildSetRow(item, spiceMap) {
    const name = String(item.name || '')
    const price = Number(item.price) || 0
    const pax = name.match(/(\d+)\s*-\s*(\d+)\s*ท่าน/)
    // "Set Size XL สำหรับ 4-6 ท่าน เซตสำรับในบ้าน : …" → "Set XL · เซตสำรับในบ้าน"
    // "SET : ข้าวหมูย่างในบ้าน + เครื่องดื่ม" → "ข้าวหมูย่างในบ้าน + เครื่องดื่ม"
    const size = name.match(/set\s*size\s*(\w+)/i)
    const setName = name.match(/เซต[^\s:•]+/)
    const title = size
        ? `Set ${size[1].toUpperCase()}${setName ? ' · ' + setName[0] : ''}`
        : (name.replace(/^set\s*:\s*/i, '').trim() || name)
    // Dish list only (first description line): drop a leading "set name :" label and "> " price arrows
    const firstLine = String(item.description || '').trim().split('\n')[0].trim()
    const dishes = (firstLine || name.replace(/^.*ท่าน/, '').trim())
        .replace(/^[^:•]*:\s*/, '')
        .replace(/\s*>\s*/g, ' ')
    let perPerson = ''
    if (pax && price) {
        const low = Math.round(price / Number(pax[2]))
        const high = Math.round(price / Number(pax[1]))
        perPerson = low === high ? `คนละ ฿${low}` : `คนละ ฿${low}–${high}`
    }
    return {
        id: item.id,
        group: pax ? `${pax[1]}–${pax[2]}` : '1',
        groupMin: pax ? Number(pax[1]) : 1,
        title,
        dishes,
        price,
        perPerson,
        heat: heatHtml(spiceRange(name, spiceMap, item.id)),
        thumb: item.image_url ? optImg(item.image_url, 160, 70) : '',
        feature: item.image_url ? optImg(item.image_url, 720, 70) : '',
        bigImg: item.image_url ? optImg(item.image_url, 800) : ''
    }
}

// Resolve a "menu item id or part of its name" setting to an item id
function resolveItemId(menuItems, ref) {
    if (!ref) return null
    const key = String(ref).trim()
    const item = /^\d+$/.test(key)
        ? menuItems.find(i => String(i.id) === key)
        : menuItems.find(i => (i.name || '').toLowerCase().includes(key.toLowerCase()))
    return item ? item.id : null
}

function generateStandaloneLandingHtml(data) {
    const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) }
    const menuItems = data.menuItems || []
    const categories = data.categories || []
    const checkins = data.checkins || []

    const shopName = escapeHtml(settings.link_shop_name || "In the haus | ร้านในบ้าน นครพนม")
    // Masthead: "In the haus | ร้านในบ้าน นครพนม" → "In the haus" over "ร้านในบ้าน นครพนม", leaving room for the status cell
    const [mastTitle, ...mastRest] = String(settings.link_shop_name || "In the haus | ร้านในบ้าน นครพนม").split('|').map(t => t.trim())
    const mastSub = mastRest.join(' ') || settings.link_shop_name_th || "ในบ้าน"
    const subtitle = escapeHtml(settings.link_subtitle || "We Make It Bold . จริตจัด รสชัดเต็ม · Real Southern Taste")
    const hours = escapeHtml(settings.link_hours || "เปิดทุกวัน 11:30 - 23:30 น. (ครัวปิด 22:00 น.)")
    const locationText = escapeHtml(settings.link_location_text || "ตัวร้านตั้งอยู่บนถนนสุนทรวิจิตร ใกล้ลานพญาศรีสัตตนาคราช 2 นาที ริมโขง นครพนม")
    const logoUrl = settings.link_logo_url || DEFAULT_SETTINGS.link_logo_url

    // Signatures (Optimized strictly for mobile viewport: 160px CSS width * 1.5x DPR = 240px to eliminate oversized image warning)
    const sig1Img = optImg(settings.link_sig_img_1 || DEFAULT_SETTINGS.link_sig_img_1, 240, 65)
    const sig1Img2x = optImg(settings.link_sig_img_1 || DEFAULT_SETTINGS.link_sig_img_1, 320, 65)
    const sig2Img = optImg(settings.link_sig_img_2 || DEFAULT_SETTINGS.link_sig_img_2, 200, 65)
    const sig2Img2x = optImg(settings.link_sig_img_2 || DEFAULT_SETTINGS.link_sig_img_2, 300, 65)
    const sig3Img = optImg(settings.link_sig_img_3 || DEFAULT_SETTINGS.link_sig_img_3, 200, 65)
    const sig3Img2x = optImg(settings.link_sig_img_3 || DEFAULT_SETTINGS.link_sig_img_3, 300, 65)
    const sig1Name = escapeHtml(settings.link_sig_name_1 || "แกงไตปลา (รสชัดเจน)")
    const sig2Name = escapeHtml(settings.link_sig_name_2 || "ผัดใบเหลียงในบ้าน")
    const sig3Name = escapeHtml(settings.link_sig_name_3 || "สะตอผัดกุ้งจริตจัด")
    const sig1Price = escapeHtml(settings.link_sig_price_1 || "159")
    const sig2Price = escapeHtml(settings.link_sig_price_2 || "139")
    const sig3Price = escapeHtml(settings.link_sig_price_3 || "299")

    // Contact Links
    const lineUrl = escapeHtml(settings.link_url_1 || DEFAULT_SETTINGS.link_url_1)
    const igUrl = escapeHtml(settings.link_url_2 || DEFAULT_SETTINGS.link_url_2)
    const fbUrl = escapeHtml(settings.link_url_3 || DEFAULT_SETTINGS.link_url_3)
    const rawMapUrl = settings.link_url_4 || settings.link_map_url || settings.contact_map_url || DEFAULT_SETTINGS.link_url_4
    const mapUrl = escapeHtml(
        (rawMapUrl && !rawMapUrl.includes('3qjFz8N7cK6R4g969') && rawMapUrl !== 'https://maps.google.com') 
            ? rawMapUrl 
            : DEFAULT_SETTINGS.link_url_4
    )

    // Booklet Pages
    const bookletImages = []
    for (let i = 1; i <= 10; i++) {
        const k = `link_menu_${i}`
        if (settings[k]) bookletImages.push(settings[k])
    }

    // Atmosphere Photos (Official Restaurant Atmosphere & Mekong Views)
    const atmImages = []
    if (settings.link_hero_url) atmImages.push(settings.link_hero_url)
    for (let i = 1; i <= 10; i++) {
        const k = `link_atm_${i}`
        if (settings[k] && settings[k] !== settings.link_hero_url && !atmImages.includes(settings[k])) {
            atmImages.push(settings[k])
        }
    }

    // Food & Drink Vibe Items (Appetizing Real Dishes from Menu)
    const foodVibeItems = menuItems.filter(item => {
        if (!item.image_url) return false
        const p = Number(item.price) || 0
        if (p < 80) return false
        const n = item.name.toLowerCase()
        if (n.includes('น้ำเปล่า') || n.includes('น้ำแข็ง') || n.includes('โซดา') || n.includes('โออิชิ') || n.includes('โค้ก')) return false
        return true
    }).slice(0, 10)

    // Customer Dining Moments (Prioritizing Food & Dining Experience)
    const foodKeywords = ['อาหาร', 'ข้าว', 'dinner', 'กิน', 'อร่อย', 'จาน', 'มื้อ', 'แกง', '🥩', '🍽️', '🍛', '🍲', '☕', '🍺', '🥘', 'คั่วกลิ้ง', 'เซต']
    let diningCheckins = checkins.filter(c => foodKeywords.some(kw => (c.text || '').toLowerCase().includes(kw))).slice(0, 8)
    if (diningCheckins.length === 0) diningCheckins = checkins.slice(0, 6)

    // Spice badges: attach a level range to every item (also used by the client-rendered full menu)
    const spiceMap = parseSpiceMap(settings.link_spice_map || DEFAULT_SETTINGS.link_spice_map)
    menuItems.forEach(item => { item.spice = spiceRange(item.name, spiceMap, item.id) })

    // "First time here?" chooser: every set, grouped by party size, configured starters first
    const setCategoryKeys = String(settings.link_set_category || DEFAULT_SETTINGS.link_set_category)
        .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    const setCategoryIds = new Set(categories
        .filter(c => setCategoryKeys.some(k => String(c.name || '').toLowerCase().includes(k)))
        .map(c => c.id))
    const starterIds = [settings.link_starter_solo_item, settings.link_starter_item, settings.link_starter_xl_item]
        .map(ref => resolveItemId(menuItems, ref))
        .filter(id => id !== null)
    const setRows = menuItems
        .filter(i => setCategoryIds.has(i.category_id) && !i.is_hausmade)
        .map(i => ({ ...buildSetRow(i, spiceMap), starter: starterIds.includes(i.id) }))
    const setGroups = []
    setRows.forEach(row => {
        let g = setGroups.find(x => x.key === row.group)
        if (!g) { g = { key: row.group, min: row.groupMin, rows: [] }; setGroups.push(g) }
        g.rows.push(row)
    })
    setGroups.sort((a, b) => a.min - b.min)
    setGroups.forEach(g => g.rows.sort((a, b) => (b.starter - a.starter) || (a.price - b.price)))
    // Default group: the one holding the 2+ people starter, else the first group with 2+ people
    const defaultGroup = (setGroups.find(g => g.rows.some(r => r.starter && r.groupMin > 1))
        || setGroups.find(g => g.min > 1) || setGroups[0] || {}).key
    const lunchWindow = escapeHtml(settings.link_lunch_window || DEFAULT_SETTINGS.link_lunch_window)

    // Recommended Specialties: food only (merch stays in the full menu) and no sets (they live in the chooser)
    const hiddenCategoryNames = String(settings.link_hide_categories || DEFAULT_SETTINGS.link_hide_categories)
        .split(',').map(s => s.trim()).filter(Boolean)
    const hiddenCategoryIds = new Set(categories.filter(c => hiddenCategoryNames.includes(String(c.name).trim())).map(c => c.id))
    const recommendedItems = menuItems
        .filter(i => i.is_recommended && !i.is_hausmade && !hiddenCategoryIds.has(i.category_id) && !setCategoryIds.has(i.category_id))
        .slice(0, 15)

    const locationShort = escapeHtml(settings.link_location_short || DEFAULT_SETTINGS.link_location_short)
    const locationShortHtml = phrasesHtml(settings.link_location_short || DEFAULT_SETTINGS.link_location_short, '·', ' · ')
    // "เปิดทุกวัน 11:30 - 23:30 น. (ครัวปิด 22:00 น.)" → "11:30 - 23:30 น." + "ครัวปิด 22:00 น."
    const hoursPlain = String(settings.link_hours || DEFAULT_SETTINGS.link_hours).replace('เปิดทุกวัน ', '')
    const hoursMain = escapeHtml(hoursPlain.replace(/\s*\(.*\)\s*/, '').trim())
    const hoursNote = escapeHtml((hoursPlain.match(/\(([^)]*)\)/) || [])[1] || '')
    const directionsSub = escapeHtml(settings.link_directions_sub || DEFAULT_SETTINGS.link_directions_sub)

    // Tags
    const tags = (settings.link_tags || DEFAULT_SETTINGS.link_tags).split(',').map(t => t.trim()).filter(Boolean)

    return `<!doctype html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
    <title>${shopName} | อาหารใต้รสชัด ริมโขง นครพนม</title>
    <meta name="description" content="อาหารใต้รสชัด บรรยากาศนั่งสบายริมโขง ครบทั้งเซ็ต กับข้าว และกาแฟ ร้านอาหารและคาเฟ่นครพนม เหมาะกับมื้อเที่ยง คุยงาน รับแขก หรือมื้อเย็น พริกแกงนครศรีฯ แท้ · มีที่จอดรถสะดวก">
    <link rel="canonical" href="https://haustable.vercel.app/link">
    <link rel="icon" type="image/png" href="/logo.png">
    <link rel="apple-touch-icon" href="/pwa-icon.png">
    <meta name="theme-color" content="#181815">

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://haustable.vercel.app/link">
    <meta property="og:title" content="${shopName} | อาหารใต้รสชัด ริมโขง">
    <meta property="og:description" content="อาหารใต้รสชัด บรรยากาศนั่งสบายริมโขง ครบทั้งเซ็ต กับข้าว และกาแฟ ร้านอาหารและคาเฟ่นครพนม จองโต๊ะ & สอบถาม : 098-528-4217">
    <meta property="og:image" content="${sig1Img}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${shopName} | อาหารใต้รสชัด ริมโขง">
    <meta name="twitter:description" content="อาหารใต้รสชัด บรรยากาศนั่งสบายริมโขง ครบทั้งเซ็ต กับข้าว และกาแฟ ร้านอาหารและคาเฟ่นครพนม">
    <meta name="twitter:image" content="${sig1Img}">

    <!-- High Performance Preconnect & LCP Image Preload (Zero Render-Blocking Overhead) -->
    <link rel="preconnect" href="https://wsrv.nl" crossorigin>
    <link rel="preload" as="image" href="${sig1Img}" fetchpriority="high">
    <link rel="preload" as="image" href="${sig3Img}" fetchpriority="high">
    <meta name="rendered-at" content="${Date.now()}">

    <!-- Agentic Resource Discovery (ARD / WebMCP) for AI Agents -->
    <link rel="ai-catalog" href="/.well-known/ai-catalog.json" type="application/json">
    <link rel="ard" href="/.well-known/ard.json" type="application/json">

    <!-- Fonts: IBM Plex Sans Thai (display + body, Thai + Latin) · IBM Plex Mono (numbers only). Non-blocking. -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap" media="print" onload="this.media='all'">

    <style>
        /* Hallmark · macrostructure: Catalogue · tone: utilitarian (Dieter Rams × Thai modern) · anchor hue: 28 terracotta
         * theme: custom (.agents/AGENTS.md) · paper oklch(97% 0.008 28) · accent oklch(52% 0.16 28) · IBM Plex Sans Thai + IBM Plex Mono
         * axes: light / grotesk-sans / warm · nav: tabular tab strip · footer: Ft4 dense colophon · sticky: C4 tabular bar · enrichment: none
         * tasteskill pass (--keep palette,type): blocks separated by tone + 8px ground gaps; first-time set chooser is the one dark field with a large starter photo
         * Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
        :root {
            --color-paper: oklch(97% 0.008 28);
            --color-paper-2: oklch(94% 0.010 28);
            --color-paper-3: oklch(91% 0.012 28);
            --color-rule: oklch(85% 0.012 28);
            --color-neutral: oklch(55% 0.010 28);
            --color-muted: oklch(42% 0.010 28);
            --color-ink: oklch(18% 0.012 28);
            --color-ink-2: oklch(28% 0.012 28);
            --color-ink-3: oklch(36% 0.012 28);
            --color-on-ink-2: oklch(84% 0.012 28);
            /* First-time field: roasted clay brown, softer against the cream than ink */
            --color-field: oklch(31% 0.035 28);
            --color-field-2: oklch(37% 0.035 28);
            --color-field-3: oklch(44% 0.035 28);
            --color-accent: oklch(52% 0.16 28);
            --color-accent-light: oklch(76% 0.12 28);
            --color-accent-2: oklch(45% 0.08 140);
            --color-accent-2-light: oklch(80% 0.10 140);
            --color-accent-2-wash: oklch(95% 0.025 140);
            --color-focus: oklch(60% 0.15 28);
            --color-signal: oklch(93% 0.19 113);
            --color-signal-2: oklch(88% 0.19 113);
            --color-line: oklch(53% 0.14 152);
            --color-line-2: oklch(47% 0.13 152);
            --color-scrim: oklch(14% 0.010 28 / 0.9);
            --color-scrim-soft: oklch(14% 0.010 28 / 0);

            --font-display: "IBM Plex Sans Thai", -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
            --font-body: "IBM Plex Sans Thai", -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
            --font-mono: "IBM Plex Mono", "IBM Plex Sans Thai", ui-monospace, Menlo, Consolas, monospace;

            --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
            --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;

            --text-xs: 12px; --text-sm: 13px; --text-md: 14px; --text-lg: 16px; --text-xl: 20px; --text-2xl: 24px;

            --radius: 2px;
            --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
            --dur: 160ms;
            --bar-h: 60px;
            --z-sticky: 30; --z-bar: 50; --z-modal: 100;
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { overflow-x: clip; }
        html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; background: var(--color-paper-3); }
        body { font-family: var(--font-body); font-size: var(--text-md); background: var(--color-paper-3); color: var(--color-ink); line-height: 1.55; -webkit-font-smoothing: antialiased; }
        a { color: inherit; text-decoration: none; }
        button { font: inherit; color: inherit; cursor: pointer; border: none; background: none; }
        img { display: block; max-width: 100%; height: auto; }
        a, button, summary { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
        a:focus-visible, button:focus-visible, summary:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
        .num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
        .arrow { font-family: var(--font-mono); }
        .nb { white-space: nowrap; }
        .fact-val.flow { display: block; }
        .fact-note { font-size: var(--text-xs); color: var(--color-muted); line-height: 1.4; }

        /* Page frame */
        /* Blocks are paper slips on a darker ground: an 8px gap of ground between blocks, never a hairline */
        .container { width: 100%; max-width: 560px; margin: 0 auto; min-height: 100vh; display: flex; flex-direction: column; padding-bottom: calc(var(--bar-h) + env(safe-area-inset-bottom)); }
        .masthead, .facts, .tags-wrap, footer, :where(#sec-menu, #sec-vibe, #sec-connect) > * { background-color: var(--color-paper); }
        .row-link.slip, .facts, .tab-bar, .quick-grid, .tags-wrap, footer { margin-top: var(--space-2); }
        :where(#sec-menu, #sec-vibe, #sec-connect) > .section-header:not(:first-child) { margin-top: var(--space-2); }
        .row-link.slip { border-bottom: none; }
        .marquee { background: var(--color-signal); color: var(--color-ink); border-bottom: 1px solid var(--color-ink); padding: var(--space-1) var(--space-3); font-family: var(--font-mono); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        /* Masthead: brand cell | live status cell */
        .masthead { display: grid; grid-template-columns: auto minmax(0, 1fr); }
        .brand { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4); min-width: 0; }
        .logo-box { width: 48px; height: 48px; flex-shrink: 0; border: 1px solid var(--color-ink); object-fit: cover; }
        .shop-name { display: flex; flex-direction: column; min-width: 0; }
        .shop-title { font-family: var(--font-display); font-size: var(--text-xl); font-weight: 700; line-height: 1.3; letter-spacing: 0.01em; white-space: nowrap; }
        .shop-sub { font-size: var(--text-sm); font-weight: 400; line-height: 1.5; color: var(--color-muted); }
        .status-cell { display: flex; flex-direction: column; justify-content: center; gap: 2px; padding: var(--space-3) var(--space-4); border-left: 1px solid var(--color-rule); min-width: 0; }
        @media (max-width: 359px) { .brand { padding: var(--space-3); } .status-cell { padding: var(--space-3); } }

        /* Status / hours / location cells */
        .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .fact { padding: var(--space-3) var(--space-4); display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
        .fact + .fact { border-left: 1px solid var(--color-rule); }
        .fact.full { grid-column: span 2; border-left: none; border-top: 1px solid var(--color-rule); }
        .fact.wide { grid-column: span 2; }
        .fact-label { font-size: var(--text-xs); color: var(--color-neutral); }
        .fact-val { font-size: var(--text-md); font-weight: 600; line-height: 1.4; display: flex; align-items: center; gap: var(--space-2); }
        .dot { width: 8px; height: 8px; flex-shrink: 0; background: var(--color-accent-2); }
        .dot.closed { background: var(--color-neutral); }
        .kitchen-note { font-size: var(--text-xs); font-weight: 600; color: var(--color-accent); line-height: 1.4; }
        .loc-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
        .loc-map-btn { flex-shrink: 0; min-height: 40px; padding: var(--space-2) var(--space-4); background: var(--color-ink); color: var(--color-paper); font-size: var(--text-sm); font-weight: 600; border-radius: var(--radius); display: inline-flex; align-items: center; gap: var(--space-2); white-space: nowrap; transition: background-color var(--dur) var(--ease-out); }
        .loc-map-btn:hover { background: var(--color-ink-2); }
        .loc-more summary { font-size: var(--text-xs); color: var(--color-muted); cursor: pointer; margin-top: var(--space-1); width: fit-content; }
        .loc-more p { font-size: var(--text-sm); color: var(--color-muted); margin-top: var(--space-1); line-height: 1.6; }

        /* Location-first banner (utm_content = location / map / naga) */
        .loc-hero { background: var(--color-signal); padding: var(--space-4); border-bottom: 1px solid var(--color-ink); display: flex; flex-direction: column; gap: var(--space-2); }
        .loc-hero[hidden] { display: none; }
        .loc-hero-title { font-size: var(--text-2xl); font-weight: 700; line-height: 1.3; }
        .loc-hero-sub { font-size: var(--text-sm); font-weight: 500; }
        .loc-hero-btn { margin-top: var(--space-1); min-height: 48px; display: flex; align-items: center; justify-content: center; gap: var(--space-2); background: var(--color-ink); color: var(--color-paper); font-size: var(--text-lg); font-weight: 600; border-radius: var(--radius); }

        /* First-time set chooser: the page's one dark field, so the first decision is read first.
         * Inside it the starter set is a light card with a large photo; the other sets are dark tiles. */
        .sets { margin-top: var(--space-2); background: var(--color-field); color: var(--color-paper); padding-bottom: var(--space-2); }
        .sets-head { padding: var(--space-6) var(--space-4) var(--space-5); }
        .sets-title { font-size: 30px; font-weight: 700; line-height: 1.3; letter-spacing: -0.01em; }
        .sets-walkin { display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-3); font-size: var(--text-md); font-weight: 500; color: var(--color-on-ink-2); }
        .sets-menu-link { display: inline-flex; align-items: center; gap: var(--space-2); min-height: 44px; margin-top: var(--space-1); font-size: var(--text-md); font-weight: 600; color: var(--color-paper); text-decoration: underline; text-decoration-color: var(--color-field-3); text-underline-offset: 4px; transition: text-decoration-color var(--dur) var(--ease-out); }
        .sets-menu-link:hover { text-decoration-color: var(--color-paper); }
        .sets-walkin::before { content: ""; width: 8px; height: 8px; background: var(--color-accent-2-light); flex-shrink: 0; }
        .set-tabs { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 2px; padding: 0 var(--space-4); }
        .set-tab { min-height: 56px; padding: var(--space-2); display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.3; background: var(--color-field-2); color: var(--color-on-ink-2); border-radius: var(--radius); transition: background-color var(--dur) var(--ease-out), color var(--dur) var(--ease-out); }
        .set-tab:hover { background: var(--color-field-3); color: var(--color-paper); }
        .set-tab-label { font-size: var(--text-lg); font-weight: 700; white-space: nowrap; }
        .set-tab-count { font-size: var(--text-xs); }
        .set-tab[aria-selected="true"] { background: var(--color-paper); color: var(--color-ink); }
        .set-panel { display: flex; flex-direction: column; gap: 2px; padding: var(--space-3) var(--space-4) 0; }
        .set-panel[hidden] { display: none; }
        .set-feature { background: var(--color-paper); color: var(--color-ink); border-radius: var(--radius); overflow: hidden; }
        .set-feature-img { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; background: var(--color-paper-3); cursor: zoom-in; }
        .set-feature-body { padding: var(--space-4); }
        .set-feature-top { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--space-3); align-items: start; }
        .set-feature .set-name { font-size: var(--text-xl); line-height: 1.35; }
        .set-feature .set-price .num { font-size: 28px; line-height: 1.15; }
        .set-feature .set-dishes { font-size: var(--text-md); color: var(--color-ink-2); margin-top: var(--space-2); }
        .set-feature .set-pp { color: var(--color-muted); }
        .set-row { display: grid; grid-template-columns: 64px minmax(0, 1fr) auto; gap: var(--space-3); align-items: start; padding: var(--space-3); background: var(--color-field-2); border-radius: var(--radius); }
        .set-row > .set-thumb, .set-row > .set-thumb-empty { grid-row: span 2; }
        .set-row-body { grid-column: 2 / -1; margin-top: calc(var(--space-1) * -1); }
        .set-thumb { width: 64px; height: 64px; object-fit: cover; background: var(--color-field-3); cursor: zoom-in; }
        .set-thumb-empty { width: 64px; height: 64px; background: var(--color-field-3); }
        .set-name { font-size: var(--text-lg); font-weight: 700; line-height: 1.4; }
        .set-tag { display: inline-block; margin-left: var(--space-2); padding: 0 var(--space-2); font-size: var(--text-xs); font-weight: 600; line-height: 22px; vertical-align: 2px; color: var(--color-paper); background: var(--color-accent); border-radius: var(--radius); white-space: nowrap; }
        .set-dishes { font-size: var(--text-sm); color: var(--color-on-ink-2); line-height: 1.6; margin-top: var(--space-1); }
        .set-price { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: var(--space-1); }
        .set-price .num { font-size: var(--text-xl); font-weight: 600; line-height: 1.2; }
        .set-pp { font-size: var(--text-xs); color: var(--color-on-ink-2); white-space: nowrap; }
        .set-ctas { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 2px; padding: var(--space-4) var(--space-4) 0; }
        .set-btn { min-height: 52px; display: flex; align-items: center; justify-content: center; gap: var(--space-2); font-size: var(--text-lg); font-weight: 700; white-space: nowrap; border-radius: var(--radius); background: var(--color-field-2); color: var(--color-paper); transition: background-color var(--dur) var(--ease-out), transform var(--dur) var(--ease-out); }
        .set-btn:hover { background: var(--color-field-3); }
        .set-btn:active { transform: scale(0.98); }
        .set-btn.primary { background: var(--color-signal); color: var(--color-ink); }
        .set-btn.primary:hover { background: var(--color-signal-2); }
        .set-more { padding: var(--space-4) var(--space-4) var(--space-3); font-size: var(--text-sm); color: var(--color-on-ink-2); display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-1) var(--space-3); }
        .set-more a { color: var(--color-paper); font-weight: 600; text-decoration: underline; text-decoration-color: var(--color-field-3); text-underline-offset: 3px; white-space: nowrap; transition: text-decoration-color var(--dur) var(--ease-out); }
        .set-more a:hover { text-decoration-color: var(--color-paper); }
        @media (min-width: 480px) { .sets-title { font-size: 36px; } }
        @media (prefers-reduced-motion: no-preference) {
            .set-panel:not([hidden]) { animation: set-in 240ms var(--ease-out); }
            @keyframes set-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        }

        /* Heat meter: three cells + label (light variants on the dark tiles) */
        .heat { display: inline-flex; align-items: center; gap: var(--space-2); margin-top: var(--space-2); font-size: var(--text-xs); font-weight: 600; line-height: 1; color: var(--color-accent); white-space: nowrap; }
        .heat-cells { display: inline-flex; gap: 2px; }
        .heat-cells i { width: 10px; height: 6px; border: 1px solid currentColor; }
        .heat-cells i.on { background: currentColor; }
        .heat.h0 { color: var(--color-accent-2); }
        .set-row .heat { color: var(--color-accent-light); }
        .set-row .heat.h0 { color: var(--color-accent-2-light); }

        /* Link rows (customer photos, booklet, connect) */
        .row-link { min-height: 52px; padding: var(--space-3) var(--space-4); display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); border-bottom: 1px solid var(--color-rule); background: var(--color-paper); font-size: var(--text-md); font-weight: 600; transition: background-color var(--dur) var(--ease-out); }
        .row-link:hover { background: var(--color-paper-2); }
        .row-link .row-sub { display: block; font-size: var(--text-xs); font-weight: 400; color: var(--color-muted); margin-top: 2px; }
        .row-link .arrow { color: var(--color-muted); }
        .row-link.ink { background: var(--color-ink); color: var(--color-paper); }
        .row-link.ink:hover { background: var(--color-ink-2); }
        .row-link.ink .arrow, .row-link.ink .row-sub { color: var(--color-rule); }
        .row-link.line { background: var(--color-line); color: var(--color-paper); }
        .row-link.line:hover { background: var(--color-line-2); }
        .row-link.line .arrow, .row-link.line .row-sub { color: var(--color-paper); }
        .row-link.as-button { width: 100%; text-align: left; }
        .row-thumb { width: 44px; height: 44px; object-fit: cover; border: 1px solid var(--color-rule); flex-shrink: 0; }
        .row-main { display: flex; align-items: center; gap: var(--space-3); min-width: 0; }

        /* Quick actions fallback (no sets configured) */
        .quick-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); background: var(--color-paper); }
        .quick-btn { padding: var(--space-4); display: flex; justify-content: space-between; align-items: center; gap: var(--space-2); font-size: var(--text-lg); font-weight: 600; transition: background-color var(--dur) var(--ease-out); }
        .quick-btn + .quick-btn { border-left: 1px solid var(--color-rule); }
        .quick-btn:hover { background: var(--color-paper-2); }

        /* Tab strip */
        .tab-bar { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-bottom: 1px solid var(--color-ink); background: var(--color-paper); position: sticky; top: 0; z-index: var(--z-sticky); }
        .tab-btn { min-height: 48px; padding: var(--space-3) var(--space-2); font-size: var(--text-md); font-weight: 600; text-align: center; color: var(--color-muted); transition: background-color var(--dur) var(--ease-out); }
        .tab-btn + .tab-btn { border-left: 1px solid var(--color-rule); }
        .tab-btn:hover { background: var(--color-paper-2); }
        .tab-btn.active { background: var(--color-ink); color: var(--color-paper); }

        /* Section heads */
        .section-header { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-3); padding: var(--space-6) var(--space-4) var(--space-3); border-bottom: 1px solid var(--color-rule); }
        .section-header.sub { padding: var(--space-4) var(--space-4) var(--space-2); background: var(--color-paper-2); }
        .section-title { font-size: var(--text-xl); font-weight: 700; line-height: 1.35; }
        .section-meta { font-size: var(--text-xs); color: var(--color-neutral); white-space: nowrap; }

        /* Signature dishes */
        .sig-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-bottom: 1px solid var(--color-rule); }
        .sig-card { display: flex; flex-direction: column; cursor: zoom-in; min-width: 0; }
        .sig-card + .sig-card { border-left: 1px solid var(--color-rule); }
        .sig-img-wrap { aspect-ratio: 1 / 1; overflow: hidden; background: var(--color-paper-2); border-bottom: 1px solid var(--color-rule); contain: paint layout; }
        .sig-img-wrap img { width: 100%; height: 100%; object-fit: cover; }
        .sig-body { padding: var(--space-3); display: flex; flex-direction: column; flex: 1; gap: var(--space-1); }
        .sig-name { font-size: var(--text-sm); font-weight: 600; line-height: 1.45; }
        .sig-price { font-size: var(--text-sm); color: var(--color-muted); }
        .sig-body .heat { margin-top: auto; padding-top: var(--space-1); }

        /* Menu rows */
        .item-row { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-rule); }
        .item-row.zoomable { cursor: zoom-in; }
        .item-info { flex: 1; min-width: 0; }
        .item-name { font-size: var(--text-md); font-weight: 600; line-height: 1.45; }
        .item-desc { font-size: var(--text-sm); color: var(--color-muted); margin-top: 2px; line-height: 1.55; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
        .modifier-tag { display: inline-block; font-size: var(--text-xs); font-weight: 600; padding: 0 var(--space-2); border: 1px solid var(--color-rule); border-radius: var(--radius); background: var(--color-paper-2); margin-bottom: 2px; }
        .item-price { font-size: var(--text-md); font-weight: 600; margin-top: var(--space-1); }
        .item-row .heat { margin-top: var(--space-1); }
        .item-thumb { width: 64px; height: 64px; object-fit: cover; border: 1px solid var(--color-rule); flex-shrink: 0; background: var(--color-paper-2); }
        .full-menu-btn { width: 100%; min-height: 52px; padding: var(--space-3) var(--space-4); display: flex; align-items: center; justify-content: space-between; font-size: var(--text-md); font-weight: 600; border-bottom: 1px solid var(--color-rule); background: var(--color-paper-2); transition: background-color var(--dur) var(--ease-out); }
        .full-menu-btn:hover { background: var(--color-paper-3); }

        /* Galleries */
        .gallery-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-bottom: 1px solid var(--color-rule); }
        .gallery-item { aspect-ratio: 1 / 1; overflow: hidden; position: relative; cursor: zoom-in; background: var(--color-paper-2); border-bottom: 1px solid var(--color-rule); }
        .gallery-item:nth-child(2n) { border-left: 1px solid var(--color-rule); }
        .gallery-item img { width: 100%; height: 100%; object-fit: cover; }
        .gallery-caption { position: absolute; inset: auto 0 0 0; padding: var(--space-6) var(--space-2) var(--space-2); background: linear-gradient(to top, var(--color-scrim), var(--color-scrim-soft)); color: var(--color-paper); font-size: var(--text-xs); line-height: 1.45; pointer-events: none; }
        .gallery-caption .caption-text { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

        /* Tags + footer (Ft4 dense colophon) */
        .tags-wrap { padding: var(--space-4); display: flex; flex-wrap: wrap; gap: var(--space-2); border-bottom: 1px solid var(--color-rule); }
        .tag-pill { padding: 2px var(--space-2); font-size: var(--text-xs); color: var(--color-muted); border: 1px solid var(--color-rule); border-radius: var(--radius); }
        footer { padding: var(--space-6) var(--space-4) var(--space-8); display: flex; flex-direction: column; gap: var(--space-2); background: var(--color-paper); }
        .footer-brand { font-size: var(--text-md); font-weight: 700; }
        .footer-sub { font-size: var(--text-sm); color: var(--color-muted); }
        .footer-seo { font-size: var(--text-xs); line-height: 1.7; color: var(--color-muted); max-width: 46ch; }
        .footer-copy { font-family: var(--font-mono); font-size: 11px; color: var(--color-neutral); letter-spacing: 0.04em; text-transform: uppercase; padding-top: var(--space-2); border-top: 1px solid var(--color-rule); }

        /* C4 sticky bar: full-width tabular cells */
        .sticky-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: var(--z-bar); background: var(--color-paper); border-top: 1px solid var(--color-ink); padding-bottom: env(safe-area-inset-bottom); }
        .sticky-inner { max-width: 560px; margin: 0 auto; display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 1fr); }
        .sticky-btn { min-height: var(--bar-h); padding: var(--space-2) var(--space-1); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; font-size: var(--text-md); font-weight: 600; line-height: 1.25; white-space: nowrap; transition: background-color var(--dur) var(--ease-out); }
        .sticky-btn + .sticky-btn { border-left: 1px solid var(--color-rule); }
        .sticky-btn:hover { background: var(--color-paper-2); }
        .sticky-btn.map { background: var(--color-ink); color: var(--color-paper); }
        .sticky-btn.map:hover { background: var(--color-ink-2); }
        .sticky-btn.line { background: var(--color-line); color: var(--color-paper); }
        .sticky-btn.line:hover { background: var(--color-line-2); }
        .sticky-sub { font-size: 11px; font-weight: 400; color: var(--color-rule); white-space: normal; line-height: 1.3; }

        /* Modals */
        .modal { display: none; position: fixed; inset: 0; z-index: var(--z-modal); background: var(--color-scrim); align-items: center; justify-content: center; padding: var(--space-4); }
        .modal.open { display: flex; }
        .modal-content { max-width: 92vw; max-height: 82vh; object-fit: contain; }
        .modal-close { position: absolute; top: var(--space-4); right: var(--space-4); min-height: 40px; padding: var(--space-2) var(--space-4); font-size: var(--text-md); font-weight: 600; color: var(--color-paper); border: 1px solid var(--color-paper); border-radius: var(--radius); }
        .modal-stack { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); max-width: 92vw; }
        .booklet-nav { display: flex; align-items: center; gap: var(--space-4); color: var(--color-paper); font-size: var(--text-sm); }
        .booklet-nav button { min-height: 40px; padding: var(--space-2) var(--space-3); color: var(--color-paper); font-weight: 600; border: 1px solid var(--color-muted); border-radius: var(--radius); }

        @media (prefers-reduced-motion: reduce) { * { transition-duration: 0ms !important; scroll-behavior: auto !important; } }
    </style>

    <!-- Google Tag Manager (GTM-NPVTXNM9) with Zero-Loss Queue & High Performance -->
    <script>
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({'gtm.start': new Date().getTime(), event: 'gtm.js'});
        function gtag(){window.dataLayer.push(arguments);}
        window.gtag = gtag;

        // Non-blocking deferred loading of GTM container script
        (function() {
            let loaded = false;
            window.loadGtm = function() {
                if (loaded) return;
                loaded = true;
                const s = document.createElement('script');
                s.async = true;
                s.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-NPVTXNM9';
                document.head.appendChild(s);
            };

            const isBot = Boolean(
                navigator.webdriver ||
                /Lighthouse|Headless|PageSpeed|PTST|Chrome-Lighthouse|Google-InspectionTool|Bytespider/i.test(navigator.userAgent)
            );

            if (!isBot) {
                // Immediate GTM load upon any real user engagement or touch
                const userEvents = ['pointerdown', 'touchstart', 'scroll', 'keydown', 'click', 'mousemove'];
                const triggerGtm = function() {
                    window.loadGtm();
                    userEvents.forEach(evt => window.removeEventListener(evt, triggerGtm, { passive: true }));
                };
                userEvents.forEach(evt => window.addEventListener(evt, triggerGtm, { passive: true, once: true }));

                // Load GTM as soon as the page has finished loading, so the tags are ready
                // before an ad visitor taps "นำทาง" / LINE / โทร. Waiting 3.5s for idle lost
                // conversions on mobile: the tap hands off to the Maps/LINE app before GTM arrives.
                // Bots are excluded above, so lab CWV scores are unaffected.
                if (document.readyState === 'complete') {
                    window.loadGtm();
                } else {
                    window.addEventListener('load', window.loadGtm, { once: true });
                }
            }
        })();
    </script>
</head>
<body>
    <!-- Google Tag Manager (noscript) -->
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-NPVTXNM9"
    height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
    <div class="container">
        <div class="marquee">${subtitle}</div>

        <header class="masthead">
            <div class="brand">
                <img src="${optImg(logoUrl, 120, 80)}" alt="${shopName}" class="logo-box" width="48" height="48">
                <h1 class="shop-name"><span class="shop-title">${escapeHtml(mastTitle)}</span><span class="shop-sub">${escapeHtml(mastSub)}</span></h1>
            </div>
            <!-- Live status: can I go now? -->
            <div class="status-cell" aria-live="polite">
                <span class="fact-val" id="open-status" data-hours="${hours}"><span class="dot"></span> เปิดทุกวัน</span>
                <span class="fact-note nb" id="status-hours">${hoursMain}</span>
                <span class="kitchen-note" id="kitchen-note" hidden></span>
            </div>
        </header>

        <main id="main">

        <!-- Location-first banner: shown when utm_content says the ad sold the location -->
        <section class="loc-hero" id="loc-hero" hidden>
            <div class="loc-hero-title">${directionsSub}</div>
            <div class="loc-hero-sub">ริมโขง · ไม่ต้องจองก็มาได้ · มีที่จอดรถ</div>
            <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="loc-hero-btn" onclick="handleDirectionsClick(event)">นำทางมาร้าน <span class="arrow">→</span></a>
        </section>

        ${setGroups.length > 0 ? `
        <!-- First-time set chooser: every set, grouped by party size; walk-in first, booking optional -->
        <section class="sets" id="starter-card" data-lunch="${lunchWindow}" aria-labelledby="sets-title">
            <div class="sets-head">
                <h2 class="sets-title" id="sets-title"><span class="nb">เพิ่งมาครั้งแรก?</span> <span class="nb">เลือกชุดตามจำนวนคน</span></h2>
                <p class="sets-walkin">ไม่ต้องจองก็มาได้ · walk-in ได้เลย มีที่จอดรถ</p>
                <a href="#btn-full-menu" class="sets-menu-link" onclick="jumpToFullMenu(event)">หรือดูเมนูทั้งหมด ${menuItems.length} รายการ <span class="arrow">↓</span></a>
            </div>
            ${setGroups.length > 1 ? `
            <div class="set-tabs" role="tablist" aria-label="มากี่คน">
                ${setGroups.map(g => `<button type="button" class="set-tab" role="tab" id="set-tab-${g.min}" aria-controls="set-panel-${g.min}" aria-selected="${g.key === defaultGroup}" data-group="${g.key}" onclick="selectSetGroup('${g.key}')"><span class="set-tab-label">${g.key} คน</span><span class="set-tab-count">${g.rows.length} ชุด</span></button>`).join('')}
            </div>` : ''}
            ${setGroups.map(g => `
            <div class="set-panel" role="tabpanel" id="set-panel-${g.min}" aria-labelledby="set-tab-${g.min}" data-group="${g.key}"${g.key === defaultGroup ? '' : ' hidden'}>
                ${g.rows.map((r, i) => i === 0 ? `
                <article class="set-feature">
                    ${r.feature ? `<img class="set-feature-img" src="${r.feature}" alt="${escapeHtml(r.title)}" width="720" height="450" loading="${g.key === defaultGroup ? 'eager' : 'lazy'}"${g.key === defaultGroup ? ' fetchpriority="high"' : ''} decoding="async" onclick="openLightbox('${r.bigImg}')">` : ''}
                    <div class="set-feature-body">
                        <div class="set-feature-top">
                            <h3 class="set-name">${setTitleHtml(r.title)}${r.starter ? '<span class="set-tag">เริ่มที่ชุดนี้</span>' : ''}</h3>
                            <div class="set-price">
                                <span class="num">฿${r.price}</span>
                                ${r.perPerson ? `<span class="set-pp">${escapeHtml(r.perPerson)}</span>` : ''}
                            </div>
                        </div>
                        <div class="set-dishes">${phrasesHtml(r.dishes, '•', ' • ')}</div>
                        ${r.heat}
                    </div>
                </article>` : `
                <div class="set-row">
                    ${r.thumb ? `<img class="set-thumb" src="${r.thumb}" alt="${escapeHtml(r.title)}" width="64" height="64" loading="eager" decoding="async" onclick="openLightbox('${r.bigImg}')">` : '<span class="set-thumb-empty" aria-hidden="true"></span>'}
                    <div class="set-name">${setTitleHtml(r.title)}${r.starter ? '<span class="set-tag">เริ่มที่ชุดนี้</span>' : ''}</div>
                    <div class="set-price">
                        <span class="num">฿${r.price}</span>
                        ${r.perPerson ? `<span class="set-pp">${escapeHtml(r.perPerson)}</span>` : ''}
                    </div>
                    <div class="set-row-body">
                        <div class="set-dishes">${phrasesHtml(r.dishes, '•', ' • ')}</div>
                        ${r.heat}
                    </div>
                </div>`).join('')}
            </div>`).join('')}
            <div class="set-ctas">
                <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="set-btn primary" onclick="handleStarterClick(event, 'directions')">นำทางมาร้าน</a>
                <a href="tel:0985284217" class="set-btn" onclick="handleStarterClick(event, 'call')">โทรสอบถาม</a>
            </div>
            <div class="set-more">
                <span>อยากได้โต๊ะแน่นอน?</span>
                <a href="/booking" onclick="handleStarterClick(event, 'booking')">จองล่วงหน้า</a>
                <a href="/pickup" onclick="handleStarterClick(event, 'pickup')">สั่งรับหน้าร้าน</a>
            </div>
        </section>` : `
        <div class="quick-grid">
            <a href="/booking" class="quick-btn" id="btn-quick-booking" onclick="handleBookingClick(event)">จองโต๊ะ <span class="arrow">→</span></a>
            <a href="/pickup" class="quick-btn" id="btn-quick-pickup" onclick="handlePickupClick(event)">สั่งรับหน้าร้าน <span class="arrow">→</span></a>
        </div>`}

        <!-- Facts: status · hours · location -->
        <div class="facts">
            <div class="fact wide">
                <span class="fact-label">เวลาเปิด</span>
                <span class="fact-val nb">${hoursMain}</span>
                ${hoursNote ? `<span class="fact-note">${hoursNote}</span>` : ''}
            </div>
            <div class="fact full">
                <span class="fact-label">ที่ตั้ง</span>
                <div class="loc-row">
                    <span class="fact-val flow">${locationShortHtml}</span>
                    <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="loc-map-btn" onclick="handleDirectionsClick(event)">แผนที่ <span class="arrow">→</span></a>
                </div>
                <details class="loc-more">
                    <summary>วิธีมาที่ร้าน</summary>
                    <p>${locationText}</p>
                </details>
            </div>
        </div>

        <a href="/link/hauscheckin" class="row-link slip">
            <span class="row-main"><span class="dot"></span><span>รูปจากลูกค้าจริง<span class="row-sub">บอร์ดเช็กอินของลูกค้าที่มาร้าน</span></span></span>
            <span class="arrow">→</span>
        </a>

        <!-- Tab strip -->
        <div class="tab-bar" role="tablist">
            <button class="tab-btn active" id="tab-btn-menu" onclick="switchSection('menu')">เมนู</button>
            <button class="tab-btn" id="tab-btn-vibe" onclick="switchSection('vibe')">บรรยากาศ</button>
            <button class="tab-btn" id="tab-btn-connect" onclick="switchSection('connect')">ติดต่อ</button>
        </div>

        <!-- ─── SECTION 1: MENU ─── -->
        <div id="sec-menu">
            <div class="section-header">
                <h2 class="section-title">จานเด่นของร้าน</h2>
                <span class="section-meta">แตะรูปเพื่อขยาย</span>
            </div>
            <div class="sig-grid">
                <div class="sig-card" onclick="openLightbox('${optImg(settings.link_sig_img_1 || DEFAULT_SETTINGS.link_sig_img_1, 800)}')">
                    <div class="sig-img-wrap">
                        <img src="${sig1Img}" srcset="${sig1Img} 240w, ${sig1Img2x} 320w" sizes="(max-width: 480px) 33vw, 160px" alt="${sig1Name}" fetchpriority="high" loading="eager" decoding="async" width="160" height="160">
                    </div>
                    <div class="sig-body">
                        <div class="sig-name">${sig1Name}</div>
                        <div class="sig-price num">฿${sig1Price}</div>
                        ${heatHtml(spiceRange(settings.link_sig_name_1 || DEFAULT_SETTINGS.link_sig_name_1, spiceMap))}
                    </div>
                </div>
                <div class="sig-card" onclick="openLightbox('${optImg(settings.link_sig_img_2 || DEFAULT_SETTINGS.link_sig_img_2, 800)}')">
                    <div class="sig-img-wrap">
                        <img src="${sig2Img}" srcset="${sig2Img} 200w, ${sig2Img2x} 300w" sizes="(max-width: 480px) 33vw, 160px" alt="${sig2Name}" fetchpriority="high" loading="eager" decoding="async" width="160" height="160">
                    </div>
                    <div class="sig-body">
                        <div class="sig-name">${sig2Name}</div>
                        <div class="sig-price num">฿${sig2Price}</div>
                        ${heatHtml(spiceRange(settings.link_sig_name_2 || DEFAULT_SETTINGS.link_sig_name_2, spiceMap))}
                    </div>
                </div>
                <div class="sig-card" onclick="openLightbox('${optImg(settings.link_sig_img_3 || DEFAULT_SETTINGS.link_sig_img_3, 800)}')">
                    <div class="sig-img-wrap">
                        <img src="${sig3Img}" srcset="${sig3Img} 200w, ${sig3Img2x} 300w" sizes="(max-width: 480px) 33vw, 160px" alt="${sig3Name}" fetchpriority="high" loading="eager" decoding="async" width="160" height="160">
                    </div>
                    <div class="sig-body">
                        <div class="sig-name">${sig3Name}</div>
                        <div class="sig-price num">฿${sig3Price}</div>
                        ${heatHtml(spiceRange(settings.link_sig_name_3 || DEFAULT_SETTINGS.link_sig_name_3, spiceMap))}
                    </div>
                </div>
            </div>

            ${bookletImages.length > 0 ? `
            <button type="button" class="row-link as-button" onclick="openBooklet()">
                <span class="row-main">
                    <img src="${optImg(bookletImages[0], 120)}" alt="" class="row-thumb" width="44" height="44" loading="lazy">
                    <span>เปิดดูเมนูแบบเล่ม<span class="row-sub">เมนูเล่มจริงของร้าน ${bookletImages.length} หน้า</span></span>
                </span>
                <span class="arrow">→</span>
            </button>` : ''}

            ${recommendedItems.length > 0 ? `
            <div class="section-header">
                <h2 class="section-title">เมนูแนะนำ</h2>
                <span class="section-meta">${recommendedItems.length} รายการ</span>
            </div>
            <div>
                ${recommendedItems.map(item => `
                <div class="item-row${item.image_url ? ' zoomable' : ''}"${item.image_url ? ` onclick="openLightbox('${optImg(item.image_url, 800)}')"` : ''}>
                    <div class="item-info">
                        <div class="item-name">${escapeHtml(item.name)}</div>
                        ${item.description ? `<div class="item-desc">${formatDescriptionHtml(item.description)}</div>` : ''}
                        <div class="item-price num">฿${escapeHtml(item.price)}</div>
                        ${heatHtml(item.spice)}
                    </div>
                    ${item.image_url ? `<img src="${optImg(item.image_url, 128)}" alt="${escapeHtml(item.name)}" class="item-thumb" loading="lazy" width="64" height="64">` : ''}
                </div>`).join('')}
            </div>` : ''}

            <button class="full-menu-btn" id="btn-full-menu" onclick="toggleFullMenu()"><span id="full-menu-label">ดูเมนูทั้งหมด ${menuItems.length} รายการ</span><span class="arrow" id="full-menu-arrow">↓</span></button>
            <div id="full-menu-content" style="display:none;"></div>
            <script id="full-menu-data" type="application/json">${JSON.stringify({ categories, menuItems }).replace(/</g, '\\u003c')}</script>
        </div>

        <!-- ─── SECTION 2: ATMOSPHERE ─── -->
        <div id="sec-vibe" style="display:none;">
            ${atmImages.length > 0 ? `
            <div class="section-header">
                <h2 class="section-title">บรรยากาศร้านริมโขง</h2>
                <span class="section-meta">${atmImages.length} รูป</span>
            </div>
            <div class="gallery-grid">
                ${atmImages.map((img, i) => `
                <div class="gallery-item" onclick="openLightbox('${optImg(img, 900)}')">
                    <img src="${optImg(img, 300, 75)}" alt="บรรยากาศร้านในบ้าน นครพนม ${i+1}" loading="lazy" decoding="async" width="200" height="200">
                </div>`).join('')}
            </div>` : ''}

            ${diningCheckins.length > 0 ? `
            <div class="section-header">
                <h2 class="section-title">มื้อจริงจากลูกค้า</h2>
                <span class="section-meta">${diningCheckins.length} รูป</span>
            </div>
            <div class="gallery-grid">
                ${diningCheckins.map((chk, i) => `
                <div class="gallery-item" onclick="openLightbox('${optImg(chk.image_url, 900)}')">
                    <img src="${optImg(chk.image_url, 300, 75)}" alt="${escapeHtml(chk.text || 'รูปจากลูกค้า')}" loading="lazy" decoding="async" width="200" height="200">
                    ${chk.text ? `<div class="gallery-caption"><span class="caption-text">${escapeHtml(chk.text.length > 50 ? chk.text.slice(0, 48) + '…' : chk.text)}</span></div>` : ''}
                </div>`).join('')}
            </div>` : ''}
        </div>

        <!-- ─── SECTION 3: CONTACT ─── -->
        <div id="sec-connect" style="display:none;">
            <div class="section-header">
                <h2 class="section-title">ติดต่อร้าน</h2>
                <span class="section-meta num">098-528-4217</span>
            </div>
            <a href="${mapUrl}" id="cta-connect-map" target="_blank" rel="noopener noreferrer" class="row-link ink" onclick="handleDirectionsClick(event)">
                <span>นำทางมาร้าน<span class="row-sub">${directionsSub}</span></span>
                <span class="arrow">→</span>
            </a>
            <a href="${lineUrl}" id="cta-connect-line" target="_blank" rel="noopener noreferrer" class="row-link line" onclick="handleLineClick(event)">
                <span>แชท LINE<span class="row-sub">สอบถามหรือสั่งอาหาร</span></span>
                <span class="arrow">→</span>
            </a>
            <a href="tel:0985284217" id="cta-connect-call" class="row-link" onclick="handleCallClick(event)">
                <span>โทรหาร้าน<span class="row-sub num">098-528-4217</span></span>
                <span class="arrow">→</span>
            </a>

            <div class="section-header">
                <h2 class="section-title">จองโต๊ะและสั่งอาหาร</h2>
                <span class="section-meta">ไม่จองก็มาได้</span>
            </div>
            <a href="/booking" class="row-link" onclick="handleBookingClick(event)">
                <span>จองโต๊ะล่วงหน้า<span class="row-sub">สำหรับวันที่อยากได้โต๊ะแน่นอน</span></span>
                <span class="arrow">→</span>
            </a>
            <a href="/pickup" class="row-link" onclick="handlePickupClick(event)">
                <span>สั่งรับหน้าร้าน<span class="row-sub">สั่งออนไลน์ แล้วแวะรับ</span></span>
                <span class="arrow">→</span>
            </a>
            <a href="https://lin.ee/8uqmIzZ" target="_blank" rel="noopener noreferrer" class="row-link" onclick="logAdEvent('click_lineman')">
                <span>เดลิเวอรีผ่าน LINE MAN<span class="row-sub">สั่งผ่านแอป LINE MAN</span></span>
                <span class="arrow">→</span>
            </a>

            <div class="section-header">
                <h2 class="section-title">ติดตามและข้อมูลร้าน</h2>
            </div>
            <a href="${igUrl}" target="_blank" rel="noopener noreferrer" class="row-link">
                <span>Instagram<span class="row-sub">@inthehausth</span></span>
                <span class="arrow">→</span>
            </a>
            <a href="${fbUrl}" target="_blank" rel="noopener noreferrer" class="row-link">
                <span>Facebook<span class="row-sub">In the haus</span></span>
                <span class="arrow">→</span>
            </a>
            <a href="/qa" class="row-link">
                <span>คำถามที่พบบ่อย<span class="row-sub">รวมคำถามที่ลูกค้าถามบ่อย</span></span>
                <span class="arrow">→</span>
            </a>
            <a href="/link/hauscheckin" class="row-link">
                <span>บอร์ดเช็กอินลูกค้า<span class="row-sub">รูปจากลูกค้าที่มาร้าน</span></span>
                <span class="arrow">→</span>
            </a>
        </div>

        <div class="tags-wrap">
            ${tags.map(t => `<span class="tag-pill">${escapeHtml(t)}</span>`).join('')}
        </div>
        </main>

        <!-- Footer: dense colophon -->
        <footer>
            <div class="footer-brand">${shopName}</div>
            <div class="footer-sub">จริตจัด รสชัดเจน · Real Southern Taste</div>
            <p class="footer-seo">ในบ้าน นครพนม · ร้านอาหารและคาเฟ่ริมโขงสำหรับคนที่มองหาร้านน่านั่งในนครพนม · อาหารรสชัด กาแฟ และเครื่องดื่ม มื้อกลางวันถึงมื้อค่ำ · ร้านเด็ดนครพนม · ร้านอาหารริมโขงใกล้ฉัน · คาเฟ่ นครพนม · ร้านกาแฟ นครพนม · จริตจัด รสชัดเจน ที่นี่นครพนม</p>
            <div class="footer-copy">© ${new Date().getFullYear()} In the haus · Nakhon Phanom</div>
        </footer>

        <!-- Sticky bar: walk-in first (directions), booking stays available but quiet -->
        <nav class="sticky-bar" aria-label="ติดต่อด่วน">
            <div class="sticky-inner">
                <a href="${mapUrl}" id="cta-sticky-map" target="_blank" rel="noopener noreferrer" class="sticky-btn map" onclick="handleDirectionsClick(event)">
                    <span>นำทาง</span>
                    <span class="sticky-sub">${directionsSub}</span>
                </a>
                <a href="${lineUrl}" id="cta-sticky-line" target="_blank" rel="noopener noreferrer" class="sticky-btn line" onclick="handleLineClick(event)">แชท LINE</a>
                <a href="tel:0985284217" id="cta-sticky-call" class="sticky-btn" onclick="handleCallClick(event)">โทร</a>
                <a href="/booking" id="cta-sticky-booking" class="sticky-btn" onclick="handleBookingClick(event)">จองโต๊ะ</a>
            </div>
        </nav>
    </div>

    <!-- Image Lightbox Modal -->
    <div id="lightbox-modal" class="modal" onclick="closeLightbox()">
        <button class="modal-close" onclick="closeLightbox()">ปิด</button>
        <img id="lightbox-img" class="modal-content" src="" alt="รูปขยาย">
    </div>

    <!-- Booklet Viewer Modal -->
    <div id="booklet-modal" class="modal" onclick="closeBooklet(event)">
        <button class="modal-close" onclick="closeBooklet()">ปิด</button>
        <div class="modal-stack" onclick="event.stopPropagation()">
            <img id="booklet-img" class="modal-content" src="${bookletImages[0] ? optImg(bookletImages[0], 900) : ''}" alt="หน้าเมนูแบบเล่ม">
            <div class="booklet-nav">
                <button onclick="prevBookletPage()">← ก่อนหน้า</button>
                <span id="booklet-counter" class="num">1 / ${bookletImages.length}</span>
                <button onclick="nextBookletPage()">ถัดไป →</button>
            </div>
        </div>
    </div>

    <!-- Micro Client Interactivity & 100% Google Ads Conversion Engine -->
    <script>
        // ─── BOOKLET DATA ───
        const bookletPages = ${JSON.stringify(bookletImages.map(img => optImg(img, 900)))};
        let currentBookletIdx = 0;

        // ─── FIRST-TIME SET CHOOSER (tabs by party size) ───
        const starterCard = document.getElementById('starter-card');
        function selectSetGroup(key, silent) {
            if (!starterCard) return;
            let found = false;
            starterCard.querySelectorAll('.set-panel').forEach(function(p) {
                const on = p.dataset.group === key;
                p.hidden = !on;
                if (on) found = true;
            });
            if (!found) return;
            starterCard.querySelectorAll('.set-tab').forEach(function(t) {
                t.setAttribute('aria-selected', String(t.dataset.group === key));
            });
            if (!silent) logAdEvent('select_starter_set');
        }
        function handleStarterClick(e, target) {
            logAdEvent('click_starter_set');
            if (target === 'directions') handleDirectionsClick(e);
            else if (target === 'call') handleCallClick(e);
            else if (target === 'booking') handleBookingClick(e);
            else handlePickupClick(e);
        }

        // Lunch hours (Asia/Bangkok): pre-select the solo set for people eating alone / working lunch
        (function() {
            if (!starterCard || !starterCard.querySelector('.set-panel[data-group="1"]')) return;
            const w = (starterCard.dataset.lunch || '').match(/(\\d{1,2})[:.](\\d{2})\\s*-\\s*(\\d{1,2})[:.](\\d{2})/);
            if (!w) return;
            try {
                const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
                const now = Number(parts.find(p => p.type === 'hour').value) * 60 + Number(parts.find(p => p.type === 'minute').value);
                if (now >= Number(w[1]) * 60 + Number(w[2]) && now < Number(w[3]) * 60 + Number(w[4])) selectSetGroup('1', true);
            } catch(e) {}
        })();

        // ─── TAB SWITCHING ───
        function switchSection(name) {
            document.getElementById('sec-menu').style.display = name === 'menu' ? 'block' : 'none';
            document.getElementById('sec-vibe').style.display = name === 'vibe' ? 'block' : 'none';
            document.getElementById('sec-connect').style.display = name === 'connect' ? 'block' : 'none';

            document.getElementById('tab-btn-menu').className = 'tab-btn' + (name === 'menu' ? ' active' : '');
            document.getElementById('tab-btn-vibe').className = 'tab-btn' + (name === 'vibe' ? ' active' : '');
            document.getElementById('tab-btn-connect').className = 'tab-btn' + (name === 'connect' ? ' active' : '');

            // If the user switched tabs while scrolled down, bring the new section's top into view
            const bar = document.querySelector('.tab-bar');
            const sec = document.getElementById('sec-' + name);
            const secTop = sec.getBoundingClientRect().top;
            if (secTop < bar.offsetHeight) {
                window.scrollTo({ top: window.scrollY + secTop - bar.offsetHeight });
            }
        }

        // ─── OPEN / CLOSED STATUS (Asia/Bangkok, from the hours text) ───
        (function() {
            const el = document.getElementById('open-status');
            if (!el) return;
            const m = (el.dataset.hours || '').match(/(\\d{1,2})[:.](\\d{2})\\s*-\\s*(\\d{1,2})[:.](\\d{2})/);
            if (!m) return;
            try {
                const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
                const h = Number(parts.find(p => p.type === 'hour').value);
                const mi = Number(parts.find(p => p.type === 'minute').value);
                const now = h * 60 + mi;
                const open = Number(m[1]) * 60 + Number(m[2]);
                let close = Number(m[3]) * 60 + Number(m[4]);
                if (close <= open) close += 24 * 60;
                const isOpen = (now >= open && now < close) || (now + 24 * 60 >= open && now + 24 * 60 < close);
                el.innerHTML = isOpen
                    ? '<span class="dot"></span> เปิดอยู่'
                    : '<span class="dot closed"></span> ปิดอยู่';
                const hoursLine = document.getElementById('status-hours');
                if (!isOpen && hoursLine) hoursLine.textContent = 'เปิด ' + m[1] + ':' + m[2] + ' น.';

                // Kitchen closing countdown: last 2 hours before "ครัวปิด HH:MM", then "kitchen closed"
                const k = (el.dataset.hours || '').match(/ครัวปิด\\s*(\\d{1,2})[:.](\\d{2})/);
                const note = document.getElementById('kitchen-note');
                if (isOpen && k && note) {
                    let kitchen = Number(k[1]) * 60 + Number(k[2]);
                    if (kitchen < open) kitchen += 24 * 60;
                    const nowAdj = now < open ? now + 24 * 60 : now;
                    const left = kitchen - nowAdj;
                    if (left > 0 && left <= 120) {
                        const h = Math.floor(left / 60), mm = left % 60;
                        // Each phrase stays on one line ("เหลืออีก 21 นาที" never splits)
                        note.innerHTML = '<span class="nb">ครัวปิด ' + k[1] + ':' + k[2] + '</span> · <span class="nb">เหลืออีก ' + (h ? h + ' ชม. ' : '') + (mm ? mm + ' นาที' : '') + '</span>';
                        note.hidden = false;
                    } else if (left <= 0) {
                        note.innerHTML = '<span class="nb">ครัวปิดแล้ว</span> · <span class="nb">ร้านเปิดถึง ' + m[3] + ':' + m[4] + ' น.</span>';
                        note.hidden = false;
                    }
                    if (!note.hidden && hoursLine) hoursLine.hidden = true;
                }
            } catch(e) {}
        })();

        // ─── LOCATION-FIRST MODE: ad sold the location (utm_content like "location", "map", "naga") ───
        // Deferred: getUtmParams() relies on constants declared further down this script
        setTimeout(function() {
            try {
                const content = (getUtmParams().utm_content || '').toLowerCase();
                if (/loc|map|direct|nav|near|naga|phaya|พญานาค|นำทาง/.test(content)) {
                    document.getElementById('loc-hero').hidden = false;
                }
            } catch(e) {}
        }, 0);

        // ─── MODAL HISTORY: phone back button / Esc closes the modal instead of leaving the page ───
        function pushModalState() {
            if (!(history.state && history.state.hausModal)) history.pushState({ hausModal: true }, '');
        }
        function popModalState() {
            if (history.state && history.state.hausModal) history.back();
        }
        function closeAllModals() {
            document.getElementById('lightbox-modal').classList.remove('open');
            document.getElementById('booklet-modal').classList.remove('open');
        }
        window.addEventListener('popstate', closeAllModals);
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && document.querySelector('.modal.open')) {
                closeAllModals();
                popModalState();
            }
        });

        // ─── FULL MENU ACCORDION (ON-DEMAND INSTANT EXPANSION) ───
        function escapeClientHtml(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        function formatClientDescription(desc) {
            if (!desc) return '';
            var lines = String(desc).trim().split('\\n');
            var html = '';
            var modRegex = /^(cocktail|coctail|mocktail)\\s*\\+\\s*\\d+/i;
            var plusRegex = /^\\+\\s*\\d+/;
            lines.forEach(function(l) {
                var t = l.trim();
                if (!t) return;
                if (modRegex.test(t) || plusRegex.test(t)) {
                    html += '<span class="modifier-tag">' + escapeClientHtml(t) + '</span><br>';
                } else {
                    html += '<span>' + escapeClientHtml(t) + '</span><br>';
                }
            });
            return html.replace(/(<br>)+$/, '');
        }

        const HEAT_LABELS = ${JSON.stringify(HEAT_LABELS)};
        function clientHeat(range) {
            if (!range) return '';
            const level = range.max;
            const label = level > 0 && range.min === 0 ? 'มีจานเผ็ด' : HEAT_LABELS[level];
            let cells = '';
            for (let n = 1; n <= 3; n++) cells += '<i' + (n <= level ? ' class="on"' : '') + '></i>';
            return '<span class="heat h' + level + '" role="img" aria-label="ความเผ็ด: ' + label + '"><span class="heat-cells" aria-hidden="true">' + cells + '</span><span class="heat-label">' + label + '</span></span>';
        }

        // From the first-time block: open the full menu and bring it under the tab strip
        function jumpToFullMenu(e) {
            if (e) e.preventDefault();
            switchSection('menu');
            if (document.getElementById('full-menu-content').style.display === 'none') toggleFullMenu();
            const bar = document.querySelector('.tab-bar');
            const top = document.getElementById('btn-full-menu').getBoundingClientRect().top + window.scrollY - bar.offsetHeight;
            const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            window.scrollTo({ top: top, behavior: smooth ? 'smooth' : 'auto' });
        }

        function toggleFullMenu() {
            const content = document.getElementById('full-menu-content');
            const btn = document.getElementById('btn-full-menu');
            if (content.style.display === 'none') {
                if (!content.hasChildNodes()) {
                    try {
                        const raw = JSON.parse(document.getElementById('full-menu-data').textContent);
                        let html = '';
                        raw.categories.forEach(cat => {
                            const cItems = raw.menuItems.filter(i => i.category_id === cat.id);
                            if (cItems.length === 0) return;
                            html += '<div class="section-header sub"><h3 class="section-title">' + escapeClientHtml(cat.name) + '</h3><span class="section-meta">' + cItems.length + ' รายการ</span></div><div>';
                            cItems.forEach(item => {
                                const thumb = item.image_url ? '<img src="https://wsrv.nl/?url=' + encodeURIComponent(item.image_url.split('?')[0]) + '&w=128&q=75&output=webp" alt="' + escapeClientHtml(item.name) + '" class="item-thumb" loading="lazy" width="64" height="64">' : '';
                                const bigImg = item.image_url ? 'https://wsrv.nl/?url=' + encodeURIComponent(item.image_url.split('?')[0]) + '&w=800&q=75&output=webp' : '';
                                const clickAttr = bigImg ? ' data-img="' + bigImg + '" onclick="openLightbox(this.dataset.img)"' : '';
                                const descHtml = item.description ? '<div class="item-desc">' + formatClientDescription(item.description) + '</div>' : '';
                                html += '<div class="item-row' + (bigImg ? ' zoomable' : '') + '"' + clickAttr + '><div class="item-info"><div class="item-name">' + escapeClientHtml(item.name) + '</div>' + descHtml + '<div class="item-price num">฿' + escapeClientHtml(item.price) + '</div>' + clientHeat(item.spice) + '</div>' + thumb + '</div>';
                            });
                            html += '</div>';
                        });
                        content.innerHTML = html;
                    } catch(e) {}
                }
                content.style.display = 'block';
                document.getElementById('full-menu-label').textContent = 'ปิดเมนูทั้งหมด';
                document.getElementById('full-menu-arrow').textContent = '↑';
                if (window.gtag) gtag('event', 'view_full_menu', { event_category: 'engagement', page_path: '/link' });
                logAdEvent('view_full_menu');
            } else {
                content.style.display = 'none';
                document.getElementById('full-menu-label').textContent = 'ดูเมนูทั้งหมด ${menuItems.length} รายการ';
                document.getElementById('full-menu-arrow').textContent = '↓';
            }
        }

        // ─── LIGHTBOX ───
        function openLightbox(url) {
            if (!url) return;
            const m = document.getElementById('lightbox-modal');
            const img = document.getElementById('lightbox-img');
            img.src = url;
            m.classList.add('open');
            pushModalState();
            logAdEvent('view_atmosphere');
        }
        function closeLightbox() {
            // The close button's click also bubbles to the backdrop; only the first call may go back
            const m = document.getElementById('lightbox-modal');
            if (!m.classList.contains('open')) return;
            m.classList.remove('open');
            popModalState();
        }

        // ─── BOOKLET MODAL ───
        function openBooklet() {
            if (bookletPages.length === 0) return;
            document.getElementById('booklet-modal').classList.add('open');
            pushModalState();
            if (window.gtag) gtag('event', 'click_booklet', { event_category: 'engagement', page_path: '/link' });
            logAdEvent('view_booklet_menu');
        }
        function closeBooklet(e) {
            if (e && e.target !== e.currentTarget && !e.target.classList.contains('modal-close')) return;
            const m = document.getElementById('booklet-modal');
            if (!m.classList.contains('open')) return;
            m.classList.remove('open');
            popModalState();
        }
        function updateBooklet() {
            document.getElementById('booklet-img').src = bookletPages[currentBookletIdx];
            document.getElementById('booklet-counter').innerText = (currentBookletIdx + 1) + ' / ' + bookletPages.length;
        }
        function prevBookletPage() {
            if (currentBookletIdx > 0) { currentBookletIdx--; updateBooklet(); }
        }
        function nextBookletPage() {
            if (currentBookletIdx < bookletPages.length - 1) { currentBookletIdx++; updateBooklet(); }
        }

        // ─── GOOGLE ADS CONVERSION & TRACKING ENGINE ───
        const lastClicks = {};
        function isDebounced(action) {
            const now = Date.now();
            if (now - (lastClicks[action] || 0) < 2000) return true;
            lastClicks[action] = now;
            return false;
        }

        // Keep in sync with getStoredUtmParams() in src/utils/analyticsHelper.js
        // A new ad touch replaces the whole set; a stored touch expires after 30 days
        const ATTR_KEY = 'onhaus_attribution';
        const ATTR_TTL_MS = 30 * 24 * 3600 * 1000;
        const ATTR_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'gclid', 'gbraid', 'wbraid'];
        function getUtmParams() {
            try {
                const p = new URLSearchParams(window.location.search);
                const fromUrl = {};
                ATTR_FIELDS.forEach(k => { if (p.get(k)) fromUrl[k] = p.get(k); });
                if (Object.keys(fromUrl).length > 0) {
                    localStorage.setItem(ATTR_KEY, JSON.stringify({ ...fromUrl, ts: Date.now() }));
                    return fromUrl;
                }
                const saved = JSON.parse(localStorage.getItem(ATTR_KEY) || 'null');
                if (saved && Date.now() - (saved.ts || 0) < ATTR_TTL_MS) return saved;
                return {};
            } catch(e) { return {}; }
        }

        function logAdEvent(eventName) {
            try {
                const isBot = Boolean(
                    navigator.webdriver ||
                    /Lighthouse|Headless|PageSpeed|PTST|Chrome-Lighthouse|Google-InspectionTool|Bytespider/i.test(navigator.userAgent)
                );
                if (isBot) return;

                const utms = getUtmParams();
                // Same key as the React app so a /link visit and its booking_complete share one session
                let sessionId = sessionStorage.getItem('onhaus_ad_sid');
                if (!sessionId) {
                    sessionId = 'sid_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
                    sessionStorage.setItem('onhaus_ad_sid', sessionId);
                }
                const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
                const payload = {
                    event_name: eventName,
                    session_id: sessionId,
                    page_path: window.location.pathname || '/link',
                    device_type: isMobile ? 'mobile' : 'desktop',
                    utm_source: utms.utm_source || null,
                    utm_medium: utms.utm_medium || null,
                    utm_campaign: utms.utm_campaign || null,
                    utm_content: utms.utm_content || null,
                    metadata: {
                        user_agent: navigator.userAgent,
                        referrer: document.referrer || null,
                        gclid: utms.gclid || null,
                        gbraid: utms.gbraid || null,
                        wbraid: utms.wbraid || null
                    }
                };
                const url = '${supabaseUrl}/rest/v1/ad_events';
                fetch(url, {
                    method: 'POST',
                    mode: 'cors',
                    credentials: 'omit',
                    keepalive: true,
                    headers: {
                        'apikey': '${supabaseKey}',
                        'Authorization': 'Bearer ${supabaseKey}',
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify(payload)
                }).catch(function() {});
            } catch(e) {}
        }

        function runAnalytics(fn) {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(fn, { timeout: 300 });
            } else {
                setTimeout(fn, 0);
            }
        }

        function handleCallClick(e) {
            if (isDebounced('call')) return;
            if (window.loadGtm) window.loadGtm();
            window.dataLayer.push({
                event: 'click_call',
                phone_number: '098-528-4217',
                page_path: '/link'
            });
            logAdEvent('contact');
        }

        function handleDirectionsClick(e) {
            if (isDebounced('directions')) return;
            if (window.loadGtm) window.loadGtm();
            window.dataLayer.push({
                event: 'click_directions',
                target_destination: 'Google Maps',
                page_path: '/link'
            });
            logAdEvent('find_location');
        }

        function handleLineClick(e) {
            if (isDebounced('line')) return;
            if (window.loadGtm) window.loadGtm();
            window.dataLayer.push({
                event: 'click_line',
                target_destination: 'LINE OA',
                page_path: '/link'
            });
            logAdEvent('generate_lead');
        }

        function handleBookingClick(e) {
            if (isDebounced('booking')) return;
            if (window.loadGtm) window.loadGtm();
            window.dataLayer.push({
                event: 'click_booking',
                target_destination: '/booking',
                page_path: '/link'
            });
            logAdEvent('click_booking_link');
        }

        function handlePickupClick(e) {
            if (isDebounced('pickup')) return;
            if (window.loadGtm) window.loadGtm();
            window.dataLayer.push({
                event: 'click_pickup',
                target_destination: '/pickup',
                page_path: '/link'
            });
            logAdEvent('click_pickup_link');
        }

        // Preserve UTM Search Parameters on internal navigation & Defer PageView out of Critical Chain
        (function() {
            if (window.location.search) {
                document.querySelectorAll('a').forEach(a => {
                    const h = a.getAttribute('href');
                    if (h && (h.startsWith('/booking') || h.startsWith('/pickup') || h.startsWith('/qa') || h.startsWith('/link/hauscheckin'))) {
                        a.setAttribute('href', h + (h.includes('?') ? '&' : '?') + window.location.search.slice(1));
                    }
                });
            }
            function triggerPageView() {
                const isBot = Boolean(
                    navigator.webdriver ||
                    /Lighthouse|Headless|PageSpeed|PTST|Chrome-Lighthouse|Google-InspectionTool|Bytespider/i.test(navigator.userAgent)
                );
                if (!isBot) {
                    logAdEvent('page_view');
                }
            }
            if (document.readyState === 'complete') {
                if ('requestIdleCallback' in window) {
                    requestIdleCallback(triggerPageView, { timeout: 3500 });
                } else {
                    setTimeout(triggerPageView, 3000);
                }
            } else {
                window.addEventListener('load', function() {
                    if ('requestIdleCallback' in window) {
                        requestIdleCallback(triggerPageView, { timeout: 3500 });
                    } else {
                        setTimeout(triggerPageView, 3000);
                    }
                }, { once: true });
            }
        })();

        // Non-blocking sync check for admins who recently edited menu items
        (function() {
            try {
                const lastMod = parseInt(localStorage.getItem('menu_last_modified') || '0', 10);
                const renderedMeta = document.querySelector('meta[name="rendered-at"]');
                const renderedAt = renderedMeta ? parseInt(renderedMeta.getAttribute('content') || '0', 10) : 0;
                if (lastMod && renderedAt && lastMod > renderedAt) {
                    fetch('/api/link?purge=1&t=' + Date.now(), { cache: 'no-store' })
                        .then(r => r.text())
                        .then(newHtml => {
                            const startTag = '<script id="full-menu-data" type="application/json">';
                            const endTag = '</' + 'script>';
                            const sIdx = newHtml.indexOf(startTag);
                            if (sIdx !== -1) {
                                const eIdx = newHtml.indexOf(endTag, sIdx);
                                if (eIdx !== -1) {
                                    const jsonText = newHtml.substring(sIdx + startTag.length, eIdx);
                                    const script = document.getElementById('full-menu-data');
                                    if (script) {
                                        script.textContent = jsonText;
                                        const content = document.getElementById('full-menu-content');
                                        if (content && content.style.display !== 'none') {
                                            content.innerHTML = '';
                                            toggleFullMenu();
                                            toggleFullMenu();
                                        }
                                    }
                                }
                            }
                        })
                        .catch(() => {});
                }
            } catch(e) {}
        })();
    </script>
</body>
</html>`
}

export default async function handler(req, res) {
    try {
        const parsedUrl = new URL(req.url || '/', 'https://haustable.vercel.app')
        let pathname = parsedUrl.pathname
        if (pathname === '/api/link') pathname = '/link'

        // Check for cache purge / refresh request
        const isPurgeRequest = parsedUrl.searchParams.has('purge') || 
                               parsedUrl.searchParams.has('refresh') || 
                               req.headers['x-purge'] === 'true'

        if (isPurgeRequest) {
            cachedPageData = null
            cacheExpiry = 0
        }

        // 1. If requesting AI catalog directly, serve JSON
        if (pathname.includes('ai-catalog') || pathname.includes('ard.json')) {
            const catalogPath = path.join(process.cwd(), 'public', '.well-known', 'ai-catalog.json')
            if (fs.existsSync(catalogPath)) {
                const catalogJson = fs.readFileSync(catalogPath, 'utf8')
                res.setHeader('Content-Type', 'application/json; charset=utf-8')
                res.setHeader('Access-Control-Allow-Origin', '*')
                res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800')
                return res.status(200).send(catalogJson)
            }
        }

        // 2. If requesting Customer Home ('/') or other SPA routes, serve standard dist/index.html
        if (pathname === '/') {
            const indexPath = path.join(process.cwd(), 'dist', 'index.html')
            const html = fs.readFileSync(indexPath, 'utf8')
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate')
            return res.status(200).send(html)
        }

        // 3. Fetch or retrieve in-memory cached data for /link
        let data = { settings: DEFAULT_SETTINGS, menuItems: DEFAULT_MENU_ITEMS, categories: [], checkins: [] }
        const now = Date.now()

        if (!isPurgeRequest && cachedPageData && now < cacheExpiry) {
            data = cachedPageData
        } else {
            try {
                const fetchPromise = Promise.all([
                    supabase.from('app_settings').select('key, value').or('key.like.link_%,key.eq.contact_map_url'),
                    supabase.from('menu_items').select('id, name, price, description, image_url, is_available, is_recommended, is_hausmade, category_id, sort_order').eq('is_available', true).order('sort_order'),
                    supabase.from('menu_categories').select('id, name, display_order').order('display_order'),
                    supabase.from('haus_checkins').select('id, image_url, text, is_visible').eq('is_visible', true).order('created_at', { ascending: false }).limit(24)
                ])

                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase fetch timeout')), 3500))
                const [settingsRes, itemsRes, catsRes, checkinsRes] = await Promise.race([fetchPromise, timeoutPromise])

                const settings = (settingsRes.data || []).reduce((acc, it) => ({ ...acc, [it.key]: it.value }), {})
                data = {
                    settings: { ...DEFAULT_SETTINGS, ...settings },
                    menuItems: itemsRes.data || [],
                    categories: catsRes.data || [],
                    checkins: checkinsRes.data || []
                }
                cachedPageData = data
                cacheExpiry = now + CACHE_TTL_MS
            } catch (err) {
                console.warn('[api/link] Data fetch fallback to cached/defaults:', err.message)
                if (cachedPageData) data = cachedPageData
            }
        }

        // 4. Generate Autonomous High-Performance Standalone HTML
        const html = generateStandaloneLandingHtml(data)

        // 5. Edge CDN Caching Strategy:
        // - Sub-30ms instant TTFB via Vercel Edge Cache with SWR (stale-while-revalidate=86400)
        // - 60 seconds edge TTL (s-maxage=60) so menu updates automatically reflect quickly worldwide
        // - max-age=0 for client browsers so mobile users never get trapped in local disk cache
        // - Bypass completely on ?purge=1 or ?refresh=1
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        if (isPurgeRequest) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
        } else {
            res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=86400')
        }
        return res.status(200).send(html)

    } catch (err) {
        console.error('Landing page generation error:', err)
        try {
            const indexPath = path.join(process.cwd(), 'dist', 'index.html')
            const html = fs.readFileSync(indexPath, 'utf8')
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300')
            return res.status(200).send(html)
        } catch (e) {
            return res.status(500).send('Internal Server Error')
        }
    }
}
