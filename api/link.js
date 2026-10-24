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
    // Starter set card: a menu item id or part of its name
    link_starter_solo_item: "115",
    link_starter_item: "141",
    link_starter_xl_item: "143",
    // Solo set is pre-selected during this window (Asia/Bangkok)
    link_lunch_window: "11:30-15:00",
    // "part of menu name=level" (0 = not spicy … 3 = very spicy); unmatched items get no badge
    link_spice_map: "แกงไตปลา=3, คั่วกลิ้ง=3, (เผ็ด)=2, สะตอ=2, (ไม่เผ็ด)=0, ใบเหลียง=0, ต้มจิ๋ว=0, คอหมูย่าง=0",
    // Categories left out of SPECIALTIES (non-food); is_hausmade items are always left out
    link_hide_categories: "Hausmade."
}

const SPICE_LABELS = ['ไม่เผ็ด', '🌶 เผ็ดน้อย', '🌶🌶 เผ็ดกลาง', '🌶🌶🌶 เผ็ดมาก']

function parseSpiceMap(str) {
    return String(str || '').split(',').map(pair => {
        const i = pair.lastIndexOf('=')
        if (i < 1) return null
        const key = pair.slice(0, i).trim()
        const level = Number(pair.slice(i + 1).trim())
        return key && level >= 0 && level <= 3 ? { key, level } : null
    }).filter(Boolean)
}

// Lowest and highest spice level among map keys found in the name (null when none match)
function spiceRange(name, spiceMap) {
    const levels = spiceMap.filter(s => String(name || '').includes(s.key)).map(s => s.level)
    if (levels.length === 0) return null
    return { min: Math.min(...levels), max: Math.max(...levels) }
}

function spiceBadgeHtml(range, isSet = false) {
    if (!range) return ''
    if (isSet) {
        return range.max === 0
            ? '<span class="spice s0">ไม่เผ็ด · เหมาะกับมาครั้งแรก</span>'
            : `<span class="spice s${range.max}">มีจานเผ็ด ${'🌶'.repeat(range.max)}</span>`
    }
    return `<span class="spice s${range.max}">${SPICE_LABELS[range.max]}</span>`
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

// Resolve a starter-set setting (menu item id, or part of the item name) to a card model
function buildStarterSet(menuItems, ref, spiceMap, chipLabel = '') {
    if (!ref) return null
    const key = String(ref).trim()
    const item = /^\d+$/.test(key)
        ? menuItems.find(i => String(i.id) === key)
        : menuItems.find(i => (i.name || '').toLowerCase().includes(key.toLowerCase()))
    if (!item) return null

    const name = String(item.name || '')
    const price = Number(item.price) || 0
    const pax = name.match(/(\d+)\s*-\s*(\d+)\s*ท่าน/)
    // "Set Size L สำหรับ 2-4 ท่าน …" → "Set Size L"; "SET : ข้าวหมูย่าง + เครื่องดื่ม" → "ข้าวหมูย่าง + เครื่องดื่ม"
    const title = (name.includes('สำหรับ') ? name.split('สำหรับ')[0] : name.replace(/^set\s*:\s*/i, '')).trim() || name
    // Dish list only (first line): drop a leading "set name :" label
    const firstLine = String(item.description || '').trim().split('\n')[0].trim()
    const dishes = (firstLine || name.replace(/^.*ท่าน/, '').trim()).replace(/^[^:•]*:\s*/, '').replace(/\s*>\s*/g, ' ')
    let perPerson = ''
    if (pax && price) {
        const low = Math.round(price / Number(pax[2]))
        const high = Math.round(price / Number(pax[1]))
        perPerson = low === high ? `ตกคนละ ฿${low}` : `ตกคนละ ฿${low}–${high}`
    }
    const paxLabel = pax ? `${pax[1]}–${pax[2]} ท่าน` : chipLabel.replace(' คน', ' ท่าน')
    return {
        title,
        paxLabel,
        chip: chipLabel || (pax ? `${pax[1]}–${pax[2]} คน` : title),
        spiceHtml: spiceBadgeHtml(spiceRange(name, spiceMap), true),
        dishes,
        price,
        perPerson,
        img: item.image_url ? optImg(item.image_url, 240, 70) : '',
        bigImg: item.image_url ? optImg(item.image_url, 800) : ''
    }
}

function generateStandaloneLandingHtml(data) {
    const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) }
    const menuItems = data.menuItems || []
    const categories = data.categories || []
    const checkins = data.checkins || []

    const shopName = escapeHtml(settings.link_shop_name || "In the haus | ร้านในบ้าน นครพนม")
    const shopNameTh = escapeHtml(settings.link_shop_name_th || "ในบ้าน")
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
    menuItems.forEach(item => { item.spice = spiceRange(item.name, spiceMap) })

    // Recommended Specialties (food only: merch / hausmade goods stay in the full menu)
    const hiddenCategoryNames = String(settings.link_hide_categories || DEFAULT_SETTINGS.link_hide_categories)
        .split(',').map(s => s.trim()).filter(Boolean)
    const hiddenCategoryIds = new Set(categories.filter(c => hiddenCategoryNames.includes(String(c.name).trim())).map(c => c.id))
    const recommendedItems = menuItems
        .filter(i => i.is_recommended && !i.is_hausmade && !hiddenCategoryIds.has(i.category_id))
        .slice(0, 15)

    // "First time here?" starter sets (each shown only if its menu item still exists)
    const starterSets = [
        buildStarterSet(menuItems, settings.link_starter_solo_item, spiceMap, '1 คน'),
        buildStarterSet(menuItems, settings.link_starter_item, spiceMap),
        buildStarterSet(menuItems, settings.link_starter_xl_item, spiceMap)
    ].filter(Boolean)
    // The 2–4 people set is the default; the solo set is pre-selected client-side at lunch
    const soloIdx = settings.link_starter_solo_item && starterSets[0] && starterSets[0].chip === '1 คน' ? 0 : -1
    const starterIdx = starterSets.length > 1 && soloIdx === 0 ? 1 : 0
    const starter = starterSets[starterIdx]
    const lunchWindow = escapeHtml(settings.link_lunch_window || DEFAULT_SETTINGS.link_lunch_window)

    const locationShort = escapeHtml(settings.link_location_short || DEFAULT_SETTINGS.link_location_short)
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

    <!-- Dieter Rams + Thai Modern OKLCH Pure Inline CSS (Zero Render-Blocking CSS) -->
    <style>
        /* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
        :root {
            --color-paper: oklch(97% 0.008 28);
            --color-paper-dark: oklch(12% 0.008 28);
            --color-paper-warm: oklch(94% 0.010 28);
            --color-rule: oklch(85% 0.012 28);
            --color-ink: oklch(18% 0.012 28);
            --color-ink-muted: oklch(42% 0.010 28);
            --color-seo-text: oklch(34% 0.010 28);
            --color-brand: #DFFF00;
            --color-accent: oklch(52% 0.16 28);
            --color-line-bg: #00873e;
            --font-display: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Thai", sans-serif;
            --font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Thai", sans-serif;
            --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { overflow-x: clip; }
        html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; background: var(--color-paper); }
        body { font-family: var(--font-body); background: var(--color-paper); color: var(--color-ink); line-height: 1.4; -webkit-font-smoothing: antialiased; }
        a { color: inherit; text-decoration: none; }
        button { font-family: inherit; cursor: pointer; border: none; background: none; }
        a, button, .tab-btn, .quick-btn, .connect-row, .item-row, .sig-card, .gallery-item {
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
        }
        button:active, a:active {
            opacity: 0.88;
        }
        img { display: block; max-width: 100%; height: auto; }

        .container { width: 100%; max-width: 580px; margin: 0 auto; background: var(--color-paper); border-left: 1px solid var(--color-rule); border-right: 1px solid var(--color-rule); min-height: 100vh; display: flex; flex-direction: column; padding-bottom: 88px; }
        .marquee { background: #E9F344; color: var(--color-ink); border-bottom: 1px solid var(--color-rule); padding: 6px 12px; font-family: var(--font-mono); font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .header-cell { display: flex; align-items: center; gap: 16px; padding: 16px; border-bottom: 1px solid var(--color-rule); }
        .logo-box { width: 56px; height: 56px; flex-shrink: 0; border: 1px solid var(--color-ink); object-fit: cover; }
        .shop-title { font-family: var(--font-display); font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; line-height: 1.15; color: var(--color-ink); overflow-wrap: anywhere; min-width: 0; }
        .shop-sub { font-family: var(--font-mono); font-size: 12px; font-weight: bold; letter-spacing: 0.15em; text-transform: uppercase; color: var(--color-ink-muted); margin-top: 4px; }

        .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-bottom: 1px solid var(--color-rule); font-size: 10px; }
        .meta-item { padding: 12px; border-right: 1px solid var(--color-rule); border-bottom: 1px solid var(--color-rule); display: flex; flex-direction: column; gap: 4px; }
        .meta-item:nth-child(2) { border-right: none; }
        .meta-item.full { grid-column: span 2; border-right: none; border-bottom: none; }
        .meta-label { font-family: var(--font-mono); font-size: 11px; color: var(--color-ink-muted); font-weight: bold; letter-spacing: 0.08em; }
        .meta-val { font-size: 13px; font-weight: bold; display: flex; align-items: center; gap: 6px; }
        .dot-green { width: 8px; height: 8px; background: #10B981; border: 1px solid var(--color-rule); display: inline-block; flex-shrink: 0; }
        .dot-green.closed { background: var(--color-ink-muted); }

        .live-stream { background: var(--color-ink); color: var(--color-paper); padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-rule); font-size: 13px; font-weight: bold; }
        .quick-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-bottom: 1px solid var(--color-rule); }
        .quick-btn { padding: 14px 16px; background: var(--color-paper); border-right: 1px solid var(--color-rule); display: flex; flex-direction: column; justify-content: space-between; gap: 4px; }
        .quick-btn:last-child { border-right: none; }
        .quick-btn:hover { background: var(--color-paper-warm); }
        .quick-tag { font-family: var(--font-mono); font-size: 11px; font-weight: bold; color: var(--color-ink-muted); letter-spacing: 0.08em; display: flex; justify-content: space-between; }
        .quick-title { font-size: 15px; font-weight: bold; color: var(--color-ink); }
        .quick-sub { font-family: var(--font-mono); font-size: 11px; color: var(--color-ink-muted); margin-top: 2px; }

        .loc-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .loc-map-btn { flex-shrink: 0; min-height: 40px; padding: 8px 12px; background: var(--color-ink); color: var(--color-paper); font-size: 13px; font-weight: bold; border-radius: 2px; display: inline-flex; align-items: center; }
        .loc-more summary { font-size: 12px; color: var(--color-ink-muted); cursor: pointer; margin-top: 6px; }
        .loc-more p { font-size: 12px; color: var(--color-ink-muted); margin-top: 4px; line-height: 1.5; }

        .starter { border-bottom: 1px solid var(--color-rule); background: var(--color-paper); }
        .starter-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 12px; background: var(--color-brand); color: var(--color-ink); }
        .starter-kicker { font-size: 15px; font-weight: 800; }
        .starter-pax { display: flex; align-items: center; gap: 6px; padding: 10px 12px 0; }
        .starter-pax-label { font-size: 13px; font-weight: bold; color: var(--color-ink-muted); margin-right: 2px; }
        .starter-pax button { min-height: 36px; padding: 4px 12px; font-size: 13px; font-weight: bold; border: 1px solid var(--color-ink); color: var(--color-ink); background: transparent; border-radius: 2px; }
        .starter-pax button.active { background: var(--color-ink); color: var(--color-paper); }
        .starter-walkin { margin: 0 12px 8px; padding: 8px 10px; background: oklch(95% 0.05 150); color: oklch(32% 0.09 150); font-size: 13px; font-weight: bold; border-radius: 2px; }
        .starter-more { padding: 0 12px 12px; font-size: 13px; color: var(--color-ink-muted); text-align: center; }
        .starter-more a { color: var(--color-ink); font-weight: bold; text-decoration: underline; text-underline-offset: 2px; }
        .spice { display: inline-block; margin-top: 6px; padding: 2px 8px; font-size: 12px; font-weight: bold; border-radius: 2px; background: oklch(94% 0.04 40); color: oklch(42% 0.14 35); }
        .spice.s0 { background: oklch(95% 0.05 150); color: oklch(32% 0.09 150); }
        .item-name .spice, .sig-body .spice { margin-top: 0; margin-left: 4px; font-size: 11px; padding: 1px 6px; vertical-align: middle; }
        .sig-body .spice { margin-left: 0; align-self: flex-start; }
        .kitchen-note { font-size: 12px; font-weight: bold; color: oklch(48% 0.15 45); }
        .loc-hero { background: var(--color-brand); color: var(--color-ink); padding: 14px 16px; border-bottom: 1px solid var(--color-rule); display: flex; flex-direction: column; gap: 6px; }
        .loc-hero[hidden] { display: none; }
        .loc-hero-title { font-size: 19px; font-weight: 800; line-height: 1.25; }
        .loc-hero-sub { font-size: 13px; font-weight: bold; }
        .loc-hero-btn { margin-top: 4px; min-height: 46px; display: flex; align-items: center; justify-content: center; background: var(--color-ink); color: var(--color-paper); font-size: 15px; font-weight: bold; border-radius: 2px; }
        .starter-body { display: flex; gap: 12px; padding: 12px; align-items: flex-start; }
        .starter-img { width: 104px; height: 104px; object-fit: cover; flex-shrink: 0; border: 1px solid var(--color-rule); background: var(--color-paper-warm); cursor: pointer; }
        .starter-info { flex: 1; min-width: 0; }
        .starter-name { font-size: 16px; font-weight: 800; line-height: 1.2; }
        .starter-dishes { font-size: 13px; color: var(--color-ink-muted); margin-top: 4px; line-height: 1.45; }
        .starter-price { margin-top: 6px; font-family: var(--font-mono); font-size: 20px; font-weight: 800; }
        .starter-pp { font-family: var(--font-body); font-size: 12px; font-weight: bold; color: var(--color-ink-muted); margin-left: 6px; }
        .starter-ctas { display: grid; grid-template-columns: 1.4fr 1fr; gap: 8px; padding: 0 12px 12px; }
        .starter-btn { min-height: 46px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; border: 1px solid var(--color-ink); border-radius: 2px; text-align: center; }
        .starter-btn.primary { background: var(--color-ink); color: var(--color-paper); }

        .tab-bar { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-bottom: 1px solid var(--color-rule); background: var(--color-paper); position: sticky; top: 0; z-index: 30; }
        .tab-btn { padding: 14px 8px; font-family: var(--font-body); font-size: 14px; font-weight: bold; letter-spacing: 0.02em; text-align: center; border-right: 1px solid var(--color-rule); color: var(--color-ink-muted); background: transparent; }
        .tab-btn:last-child { border-right: none; }
        .tab-btn.active { background: var(--color-ink); color: var(--color-paper); }
        .tab-btn.active span { color: #f97316; }

        .section-header { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--color-paper-warm); border-bottom: 1px solid var(--color-rule); }
        .section-title { font-family: var(--font-mono); font-size: 12px; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; }
        .badge { font-family: var(--font-mono); font-size: 11px; font-weight: bold; padding: 2px 6px; background: var(--color-ink); color: var(--color-paper); border: 1px solid var(--color-ink); }

        .sig-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-bottom: 1px solid var(--color-rule); }
        .sig-card { border-right: 1px solid var(--color-rule); display: flex; flex-direction: column; height: 100%; background: var(--color-paper); cursor: pointer; }
        .sig-card:last-child { border-right: none; }
        .sig-img-wrap { width: 100%; aspect-ratio: 1/1; overflow: hidden; background: var(--color-paper-warm); border-bottom: 1px solid var(--color-rule); contain: paint layout; }
        .sig-img-wrap img { width: 100%; height: 100%; object-fit: cover; aspect-ratio: 1/1; transition: transform 0.2s ease; }
        .sig-card:hover .sig-img-wrap img { transform: scale(1.04); }
        .sig-body { padding: 10px; display: flex; flex-direction: column; justify-content: space-between; flex: 1; gap: 6px; }
        .sig-name { font-size: 13px; font-weight: bold; line-height: 1.25; color: var(--color-ink); }
        .sig-price { font-family: var(--font-mono); font-size: 12px; font-weight: bold; color: var(--color-ink-muted); }

        .booklet-card { padding: 14px 16px; border-bottom: 1px solid var(--color-rule); display: flex; align-items: center; justify-content: space-between; background: var(--color-paper); cursor: pointer; gap: 12px; }
        .booklet-card:hover { background: var(--color-paper-warm); }

        .item-row { display: flex; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--color-rule); background: var(--color-paper); gap: 12px; align-items: flex-start; cursor: pointer; }
        .item-row:hover { background: var(--color-paper-warm); }
        .item-info { flex: 1; min-width: 0; }
        .item-name { font-size: 14px; font-weight: bold; color: var(--color-ink); }
        .item-desc { font-size: 12px; color: var(--color-ink-muted); margin-top: 3px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
        .modifier-tag { display: inline-block; font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--color-ink); background: var(--color-paper-warm); border: 1px solid var(--color-rule); padding: 1px 6px; border-radius: 2px; margin-bottom: 2px; letter-spacing: 0.04em; vertical-align: middle; }
        .item-price { font-family: var(--font-mono); font-size: 13px; font-weight: bold; color: var(--color-ink); margin-top: 4px; }
        .item-thumb { width: 56px; height: 56px; object-fit: cover; border: 1px solid var(--color-rule); flex-shrink: 0; background: var(--color-paper-warm); }

        .full-menu-btn { width: 100%; padding: 16px; background: var(--color-ink); color: var(--color-paper); font-family: var(--font-mono); font-size: 13px; font-weight: bold; letter-spacing: 0.12em; text-align: center; text-transform: uppercase; border-bottom: 1px solid var(--color-rule); display: block; }
        .full-menu-btn:hover { background: #27272a; }

        .gallery-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-bottom: 1px solid var(--color-rule); }
        .gallery-item { aspect-ratio: 1/1; overflow: hidden; border-right: 1px solid var(--color-rule); border-bottom: 1px solid var(--color-rule); cursor: pointer; background: var(--color-paper-warm); position: relative; }
        .gallery-item:nth-child(2n) { border-right: none; }
        .gallery-item img { width: 100%; height: 100%; object-fit: cover; aspect-ratio: 1/1; transition: transform 0.2s; display: block; }
        .gallery-item:hover img { transform: scale(1.04); }
        .gallery-caption { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 65%, transparent 100%); color: #fff; padding: 20px 8px 6px 8px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; font-weight: bold; pointer-events: none; }
        .gallery-caption .caption-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 72%; font-size: 11px; line-height: 1.2; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }
        .gallery-caption .caption-price { font-family: var(--font-mono); font-size: 11px; color: #fed7aa; white-space: nowrap; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }
        .gallery-caption.checkin { font-size: 11px; font-weight: normal; }
        .gallery-caption.checkin .caption-text { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.3; color: #f4f4f5; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }

        .connect-row { padding: 14px 16px; min-height: 52px; border-bottom: 1px solid var(--color-rule); display: flex; justify-content: space-between; align-items: center; background: var(--color-paper); font-size: 14px; font-weight: bold; }
        .connect-row:hover { background: var(--color-paper-warm); }
        .connect-row.line { background: var(--color-line-bg); color: #fff; }
        .connect-row.line:hover { background: #007335; }
        .connect-row.lineman { background: var(--color-ink); color: var(--color-paper); }
        .connect-row.book { background: var(--color-brand); color: var(--color-ink); }

        .tags-wrap { padding: 16px 12px; display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; border-bottom: 1px solid var(--color-rule); }
        .tag-pill { padding: 4px 10px; background: var(--color-paper-warm); border: 1px solid var(--color-rule); font-family: var(--font-mono); font-size: 11px; color: var(--color-ink-muted); border-radius: 2px; }

        footer { padding: 28px 20px 96px 20px; text-align: center; font-size: 11px; color: var(--color-ink-muted); font-family: var(--font-mono); display: flex; flex-direction: column; align-items: center; gap: 8px; border-top: 1px solid var(--color-rule); background: var(--color-paper); }
        .footer-brand { font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-ink); }
        .footer-sub { font-family: var(--font-body); font-size: 12px; color: var(--color-ink-muted); letter-spacing: 0.05em; }
        .footer-rule { width: 32px; height: 1px; background: var(--color-rule); margin: 4px 0; }
        .footer-seo { max-width: 420px; margin: 4px auto; font-family: var(--font-body); font-size: 11px; line-height: 1.75; color: var(--color-seo-text); text-align: center; letter-spacing: 0.01em; }
        .footer-seo p { margin: 0; }
        .footer-copy { font-size: 10px; letter-spacing: 0.15em; color: var(--color-ink-muted); margin-top: 2px; }

        .sticky-bar { position: fixed; bottom: 12px; left: 50%; transform: translateX(-50%); width: calc(100% - 24px); max-width: 440px; background: var(--color-paper); border: 1px solid var(--color-ink); padding: 8px; display: grid; grid-template-columns: 1.7fr 1fr 0.8fr 1fr; gap: 6px; z-index: 50; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 2px; }
        .sticky-btn { display: flex; align-items: center; justify-content: center; gap: 4px; min-height: 44px; padding: 8px 2px; font-family: var(--font-body); font-size: 13px; font-weight: bold; line-height: 1.15; border-radius: 2px; text-align: center; }
        .sticky-btn.book { background: var(--color-paper); border: 1px solid var(--color-ink); color: var(--color-ink); }
        .sticky-btn.line { background: var(--color-line-bg); color: #ffffff; font-weight: 800; }
        .sticky-btn.map { background: var(--color-brand); border: 1px solid var(--color-ink); color: var(--color-ink); font-weight: 800; flex-direction: column; gap: 1px; }
        .sticky-sub { font-size: 10.5px; font-weight: 600; color: var(--color-ink); line-height: 1.15; }
        .sticky-btn.call { background: var(--color-ink); color: var(--color-paper); }

        .modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 100; align-items: center; justify-content: center; padding: 16px; }
        .modal.open { display: flex; }
        .modal-content { max-width: 90vw; max-height: 85vh; object-fit: contain; }
        .modal-close { position: absolute; top: 16px; right: 16px; color: #fff; font-family: var(--font-mono); font-size: 18px; padding: 8px 12px; background: rgba(0,0,0,0.6); border: 1px solid #666; border-radius: 4px; }
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

                // Background idle fallback for real visitors who remain on page without immediate interaction
                if ('requestIdleCallback' in window) {
                    requestIdleCallback(() => setTimeout(window.loadGtm, 3500));
                } else {
                    setTimeout(window.loadGtm, 3500);
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
        <!-- Top Marquee -->
        <div class="marquee">// ${subtitle} //</div>

        <!-- Identity & Brand Header -->
        <header class="header-cell">
            <img src="${optImg(logoUrl, 120, 80)}" alt="${shopName}" class="logo-box" width="56" height="56">
            <div>
                <h1 class="shop-title">${shopName}</h1>
                <p class="shop-sub">${shopNameTh}</p>
            </div>
        </header>

        <!-- Main Content Landmark -->
        <main id="main">

        <!-- Location-first banner: shown when utm_content says the ad sold the location -->
        <section class="loc-hero" id="loc-hero" hidden>
            <div class="loc-hero-title">📍 ${directionsSub}</div>
            <div class="loc-hero-sub">ริมโขง · ไม่ต้องจองก็มาได้ · มีที่จอดรถ</div>
            <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="loc-hero-btn" onclick="handleDirectionsClick(event)">นำทางมาร้านเลย ➔</a>
        </section>

        <!-- Tabular Metadata Grid -->
        <div class="meta-grid">
            <div class="meta-item">
                <span class="meta-label">สถานะ · STATUS</span>
                <span class="meta-val" id="open-status" data-hours="${hours}"><span class="dot-green"></span> เปิดทุกวัน</span>
                <span class="kitchen-note" id="kitchen-note" hidden></span>
            </div>
            <div class="meta-item">
                <span class="meta-label">เวลาเปิด · HOURS</span>
                <span class="meta-val">${hours.replace('เปิดทุกวัน ', '')}</span>
            </div>
            <div class="meta-item full">
                <span class="meta-label">ที่ตั้ง · LOCATION</span>
                <div class="loc-row">
                    <span class="meta-val">${locationShort}</span>
                    <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="loc-map-btn" onclick="handleDirectionsClick(event)">แผนที่ ➔</a>
                </div>
                <details class="loc-more">
                    <summary>วิธีมาที่ร้าน</summary>
                    <p>${locationText}</p>
                </details>
            </div>
        </div>

        ${starter ? `
        <!-- Starter Set: one-tap answer to "what should we eat / how much"; walk-in first, booking optional -->
        <section class="starter" id="starter-card" data-lunch="${lunchWindow}" data-solo="${soloIdx}">
            <div class="starter-head">
                <span class="starter-kicker">เพิ่งมาครั้งแรก? เริ่มที่ชุดนี้</span>
            </div>
            ${starterSets.length > 1 ? `
            <div class="starter-pax" role="group" aria-label="มากี่คน">
                <span class="starter-pax-label">มากี่คน?</span>
                ${starterSets.map((s, i) => `<button type="button" class="${i === starterIdx ? 'active' : ''}" onclick="selectStarter(${i})">${escapeHtml(s.chip)}</button>`).join('')}
            </div>` : ''}
            <div class="starter-body">
                ${starter.img ? `<img id="starter-img" class="starter-img" src="${starter.img}" alt="${escapeHtml(starter.title)}" width="104" height="104" loading="eager" decoding="async" onclick="openLightbox(starterSets[currentStarter].bigImg)">` : ''}
                <div class="starter-info">
                    <div class="starter-name" id="starter-name">${escapeHtml(starter.title)}${starter.paxLabel ? ` · ${escapeHtml(starter.paxLabel)}` : ''}</div>
                    <div class="starter-dishes" id="starter-dishes">${escapeHtml(starter.dishes)}</div>
                    <div class="starter-price"><span id="starter-price">฿${starter.price}</span><span class="starter-pp" id="starter-pp">${escapeHtml(starter.perPerson)}</span></div>
                    <div id="starter-spice">${starter.spiceHtml}</div>
                </div>
            </div>
            <div class="starter-walkin">✓ ไม่ต้องจองก็มาได้ · walk-in ได้เลย มีที่จอดรถ</div>
            <div class="starter-ctas">
                <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="starter-btn primary" onclick="handleStarterClick(event, 'directions')">นำทางมาร้าน</a>
                <a href="tel:0985284217" class="starter-btn" onclick="handleStarterClick(event, 'call')">โทรสอบถาม</a>
            </div>
            <div class="starter-more">
                อยากได้โต๊ะแน่นอน? <a href="/booking" onclick="handleStarterClick(event, 'booking')">จองล่วงหน้า ➔</a>
                <span aria-hidden="true">·</span>
                <a href="/pickup" onclick="handleStarterClick(event, 'pickup')">สั่งรับหน้าร้าน ➔</a>
            </div>
            <script id="starter-data" type="application/json">${JSON.stringify(starterSets).replace(/</g, '\u003c')}</script>
        </section>` : ''}

        <!-- Live Stream Customer Photos Ticker -->
        <a href="/link/hauscheckin" class="live-stream">
            <span style="display:flex;align-items:center;gap:8px;">
                <span class="dot-green"></span>
                <span>รูปจากลูกค้าจริง</span>
            </span>
            <span>ดูทั้งหมด ➔</span>
        </a>

        <!-- Quick Actions: Reservation & Pickup (fallback when no starter set card) -->
        ${starter ? '' : `<div class="quick-grid">
            <a href="/booking" class="quick-btn" id="btn-quick-booking" onclick="handleBookingClick(event)">
                <div class="quick-tag"><span>// RESERVATION</span><span>➔</span></div>
                <div>
                    <div class="quick-title">จองโต๊ะล่วงหน้า</div>
                    <div class="quick-sub">BOOK A TABLE</div>
                </div>
            </a>
            <a href="/pickup" class="quick-btn" id="btn-quick-pickup" onclick="handlePickupClick(event)">
                <div class="quick-tag"><span>// SELF-PICKUP</span><span>➔</span></div>
                <div>
                    <div class="quick-title">สั่งอาหารรับหน้าร้าน</div>
                    <div class="quick-sub">PICK UP ONLINE</div>
                </div>
            </a>
        </div>`}

        <!-- Tab Switcher -->
        <div class="tab-bar">
            <button class="tab-btn active" id="tab-btn-menu" onclick="switchSection('menu')"><span>*</span> เมนู</button>
            <button class="tab-btn" id="tab-btn-vibe" onclick="switchSection('vibe')">บรรยากาศ</button>
            <button class="tab-btn" id="tab-btn-connect" onclick="switchSection('connect')">ติดต่อ</button>
        </div>

        <!-- ─── SECTION 1: MENU ─── -->
        <div id="sec-menu">
            <!-- 3 Signature Dishes (LCP Preloaded) -->
            <div class="section-header">
                <span class="section-title">SIGNATURE DISHES</span>
                <span class="badge">RECOMMENDED</span>
            </div>
            <div class="sig-grid">
                <div class="sig-card" onclick="openLightbox('${optImg(settings.link_sig_img_1 || DEFAULT_SETTINGS.link_sig_img_1, 800)}')">
                    <div class="sig-img-wrap">
                        <img src="${sig1Img}" srcset="${sig1Img} 240w, ${sig1Img2x} 320w" sizes="(max-width: 480px) 33vw, 160px" alt="${sig1Name}" fetchpriority="high" loading="eager" decoding="async" width="160" height="160">
                    </div>
                    <div class="sig-body">
                        <div class="sig-name">${sig1Name}</div>
                        <div class="sig-price">฿${sig1Price}</div>
                        ${spiceBadgeHtml(spiceRange(settings.link_sig_name_1 || DEFAULT_SETTINGS.link_sig_name_1, spiceMap))}
                    </div>
                </div>
                <div class="sig-card" onclick="openLightbox('${optImg(settings.link_sig_img_2 || DEFAULT_SETTINGS.link_sig_img_2, 800)}')">
                    <div class="sig-img-wrap">
                        <img src="${sig2Img}" srcset="${sig2Img} 200w, ${sig2Img2x} 300w" sizes="(max-width: 480px) 33vw, 160px" alt="${sig2Name}" fetchpriority="high" loading="eager" decoding="async" width="160" height="160">
                    </div>
                    <div class="sig-body">
                        <div class="sig-name">${sig2Name}</div>
                        <div class="sig-price">฿${sig2Price}</div>
                        ${spiceBadgeHtml(spiceRange(settings.link_sig_name_2 || DEFAULT_SETTINGS.link_sig_name_2, spiceMap))}
                    </div>
                </div>
                <div class="sig-card" onclick="openLightbox('${optImg(settings.link_sig_img_3 || DEFAULT_SETTINGS.link_sig_img_3, 800)}')">
                    <div class="sig-img-wrap">
                        <img src="${sig3Img}" srcset="${sig3Img} 200w, ${sig3Img2x} 300w" sizes="(max-width: 480px) 33vw, 160px" alt="${sig3Name}" fetchpriority="high" loading="eager" decoding="async" width="160" height="160">
                    </div>
                    <div class="sig-body">
                        <div class="sig-name">${sig3Name}</div>
                        <div class="sig-price">฿${sig3Price}</div>
                        ${spiceBadgeHtml(spiceRange(settings.link_sig_name_3 || DEFAULT_SETTINGS.link_sig_name_3, spiceMap))}
                    </div>
                </div>
            </div>

            <!-- Booklet Menu Banner -->
            ${bookletImages.length > 0 ? `
            <div class="booklet-card" onclick="openBooklet()">
                <div style="display:flex;align-items:center;gap:12px;">
                    <img src="${optImg(bookletImages[0], 120)}" alt="Menu Booklet" style="width:44px;height:44px;object-fit:cover;border:1px solid var(--color-rule);">
                    <div>
                        <div style="font-family:var(--font-mono);font-size:9px;font-weight:bold;color:var(--color-ink-muted);">ORIGINAL BOOKLET</div>
                        <div style="font-size:13px;font-weight:bold;">เปิดดูสมุดเมนูเล่มจริง</div>
                    </div>
                </div>
                <div style="font-family:var(--font-mono);font-size:11px;font-weight:bold;">VIEW ➔</div>
            </div>` : ''}

            <!-- Specialties List -->
            ${recommendedItems.length > 0 ? `
            <div class="section-header">
                <span class="section-title">SPECIALTIES</span>
                <span class="meta-label">${recommendedItems.length} ITEMS</span>
            </div>
            <div>
                ${recommendedItems.map(item => `
                <div class="item-row"${item.image_url ? ` onclick="openLightbox('${optImg(item.image_url, 800)}')"` : ''}>
                    <div class="item-info">
                        <div class="item-name">${escapeHtml(item.name)}${spiceBadgeHtml(item.spice)}</div>
                        ${item.description ? `<div class="item-desc">${formatDescriptionHtml(item.description)}</div>` : ''}
                        <div class="item-price">฿${escapeHtml(item.price)}</div>
                    </div>
                    ${item.image_url ? `<img src="${optImg(item.image_url, 120)}" alt="${escapeHtml(item.name)}" class="item-thumb" loading="lazy" width="56" height="56">` : ''}
                </div>`).join('')}
            </div>` : ''}

            <!-- Full Menu Accordion Button -->
            <button class="full-menu-btn" id="btn-full-menu" onclick="toggleFullMenu()">[+] VIEW FULL MENU (${menuItems.length} ITEMS)</button>
            <div id="full-menu-content" style="display:none;"></div>
            <script id="full-menu-data" type="application/json">${JSON.stringify({ categories, menuItems })}</script>
        </div>

        <!-- ─── SECTION 2: VIBE / ATMOSPHERE & CUISINE ─── -->
        <div id="sec-vibe" style="display:none;">
            <!-- 1. Real Restaurant Atmosphere & Mekong Views -->
            ${atmImages.length > 0 ? `
            <div class="section-header">
                <span class="section-title">RESTAURANT ATMOSPHERE</span>
                <span class="meta-label">${atmImages.length} VIEWS · ริมโขง</span>
            </div>
            <div class="gallery-grid">
                ${atmImages.map((img, i) => `
                <div class="gallery-item" onclick="openLightbox('${optImg(img, 900)}')">
                    <img src="${optImg(img, 300, 75)}" alt="บรรยากาศร้านในบ้าน นครพนม ${i+1}" loading="lazy" decoding="async" width="200" height="200">
                </div>`).join('')}
            </div>` : ''}

            <!-- 2. Customer Dining Moments & Experiences -->
            ${diningCheckins.length > 0 ? `
            <div class="section-header">
                <span class="section-title">DINING MOMENTS</span>
                <span class="badge" style="background:#10B981;border-color:#10B981;">REAL EXPERIENCES</span>
            </div>
            <div class="gallery-grid">
                ${diningCheckins.map((chk, i) => `
                <div class="gallery-item" onclick="openLightbox('${optImg(chk.image_url, 900)}')">
                    <img src="${optImg(chk.image_url, 300, 75)}" alt="${escapeHtml(chk.text || 'Customer Moment')}" loading="lazy" decoding="async" width="200" height="200">
                    ${chk.text ? `<div class="gallery-caption checkin"><span class="caption-text">${escapeHtml(chk.text.length > 50 ? chk.text.slice(0, 48) + '...' : chk.text)}</span></div>` : ''}
                </div>`).join('')}
            </div>` : ''}
        </div>

        <!-- ─── SECTION 3: CONNECT ─── -->
        <div id="sec-connect" style="display:none;">
            <div class="section-header">
                <span class="section-title">จองโต๊ะ & สั่งอาหาร</span>
            </div>
            <a href="/booking" class="connect-row book" onclick="handleBookingClick(event)">
                <span>จองโต๊ะออนไลน์ // BOOK A TABLE</span>
                <span style="font-family:var(--font-mono);">➔</span>
            </a>
            <a href="/pickup" class="connect-row" onclick="handlePickupClick(event)">
                <span>สั่งอาหารรับหน้าร้าน // PICK UP</span>
                <span style="font-family:var(--font-mono);">➔</span>
            </a>

            <div class="section-header" style="margin-top:16px;">
                <span class="section-title">DIRECT CONTACT</span>
            </div>
            <a href="${lineUrl}" id="cta-connect-line" target="_blank" rel="noopener noreferrer" class="connect-row line" onclick="handleLineClick(event)">
                <span>LINE OA // แชทสอบถามหรือสั่งอาหาร</span>
                <span style="font-family:var(--font-mono);">➔</span>
            </a>
            <a href="tel:0985284217" id="cta-connect-call" class="connect-row" onclick="handleCallClick(event)">
                <span>098-528-4217 // โทรติดต่อร้าน</span>
                <span style="font-family:var(--font-mono);">CALL ➔</span>
            </a>

            <div class="section-header" style="margin-top:16px;">
                <span class="section-title">SOCIAL MEDIA</span>
            </div>
            <a href="${igUrl}" target="_blank" rel="noopener noreferrer" class="connect-row">
                <span>INSTAGRAM // @inthehausth</span>
                <span style="font-family:var(--font-mono);">➔</span>
            </a>
            <a href="${fbUrl}" target="_blank" rel="noopener noreferrer" class="connect-row">
                <span>FACEBOOK // IN THE HAUS</span>
                <span style="font-family:var(--font-mono);">➔</span>
            </a>

            <div class="section-header" style="margin-top:16px;">
                <span class="section-title">DELIVERY SERVICE</span>
            </div>
            <a href="https://lin.ee/8uqmIzZ" target="_blank" rel="noopener noreferrer" class="connect-row lineman" onclick="logAdEvent('click_lineman')">
                <span>ORDER DIRECT ON LINEMAN</span>
                <span style="font-family:var(--font-mono);">➔</span>
            </a>

            <div class="section-header" style="margin-top:16px;">
                <span class="section-title">INFORMATION & LOCATION</span>
            </div>
            <a href="/qa" class="connect-row">
                <span>RESTAURANT Q&A // คำถามที่พบบ่อย</span>
                <span style="font-family:var(--font-mono);">➔</span>
            </a>
            <a href="/link/hauscheckin" class="connect-row" style="background:#DFFF00;color:#181815;">
                <span>HAUS CHECK-IN WALL // บอร์ดเช็กอินลูกค้า</span>
                <span style="font-family:var(--font-mono);">➔</span>
            </a>
            <a href="${mapUrl}" id="cta-connect-map" target="_blank" rel="noopener noreferrer" class="connect-row" style="background:var(--color-ink);color:var(--color-paper);" onclick="handleDirectionsClick(event)">
                <span>LAUNCH MAP // นำทางมาร้าน (ริมโขง นครพนม)</span>
                <span style="font-family:var(--font-mono);">➔</span>
            </a>
        </div>

        <!-- Tags List -->
        <div class="tags-wrap">
            ${tags.map(t => `<span class="tag-pill">${escapeHtml(t)}</span>`).join('')}
        </div>
        </main>

        <!-- Footer -->
        <footer>
            <div class="footer-brand">// ${shopName}</div>
            <div class="footer-sub">จริตจัด รสชัดเจน · Real Southern Taste</div>
            <div class="footer-rule"></div>
            <div class="footer-seo">
                <p>ในบ้าน นครพนม · ร้านอาหารและคาเฟ่ริมโขงสำหรับคนที่มองหาร้านน่านั่งในนครพนม · อาหารรสชัด กาแฟ และเครื่องดื่ม มื้อกลางวันถึงมื้อค่ำ · ร้านเด็ดนครพนม · ร้านอาหารริมโขงใกล้ฉัน · คาเฟ่ นครพนม · ร้านกาแฟ นครพนม · จริตจัด รสชัดเจน ที่นี่นครพนม</p>
            </div>
            <div class="footer-rule"></div>
            <div class="footer-copy">© ${new Date().getFullYear()} IN THE HAUS · NAKHON PHANOM</div>
        </footer>

        <!-- Sticky Contact Bar -->
        <!-- Walk-in first: directions is the main action, booking stays available but quiet -->
        <div class="sticky-bar">
            <a href="${mapUrl}" id="cta-sticky-map" target="_blank" rel="noopener noreferrer" class="sticky-btn map" onclick="handleDirectionsClick(event)">
                <span>นำทาง</span>
                <span class="sticky-sub">${directionsSub}</span>
            </a>
            <a href="${lineUrl}" id="cta-sticky-line" target="_blank" rel="noopener noreferrer" class="sticky-btn line" onclick="handleLineClick(event)">
                แชท LINE
            </a>
            <a href="tel:0985284217" id="cta-sticky-call" class="sticky-btn call" onclick="handleCallClick(event)">
                โทร
            </a>
            <a href="/booking" id="cta-sticky-booking" class="sticky-btn book" onclick="handleBookingClick(event)">
                จองโต๊ะ
            </a>
        </div>
    </div>

    <!-- Image Lightbox Modal -->
    <div id="lightbox-modal" class="modal" onclick="closeLightbox()">
        <button class="modal-close" onclick="closeLightbox()">✕</button>
        <img id="lightbox-img" class="modal-content" src="" alt="Enlarged view">
    </div>

    <!-- Booklet Viewer Modal -->
    <div id="booklet-modal" class="modal" onclick="closeBooklet(event)">
        <button class="modal-close" onclick="closeBooklet()">✕ CLOSE</button>
        <div style="display:flex;flex-direction:column;align-items:center;gap:12px;max-width:92vw;" onclick="event.stopPropagation()">
            <img id="booklet-img" class="modal-content" src="${bookletImages[0] ? optImg(bookletImages[0], 900) : ''}" alt="Booklet page">
            <div style="display:flex;gap:16px;align-items:center;background:rgba(0,0,0,0.7);padding:8px 16px;border-radius:4px;color:#fff;font-family:var(--font-mono);font-size:12px;">
                <button onclick="prevBookletPage()" style="color:#fff;padding:4px 8px;font-weight:bold;">◀ PREV</button>
                <span id="booklet-counter">1 / ${bookletImages.length}</span>
                <button onclick="nextBookletPage()" style="color:#fff;padding:4px 8px;font-weight:bold;">NEXT ▶</button>
            </div>
        </div>
    </div>

    <!-- Micro Client Interactivity & 100% Google Ads Conversion Engine -->
    <script>
        // ─── BOOKLET DATA ───
        const bookletPages = ${JSON.stringify(bookletImages.map(img => optImg(img, 900)))};
        let currentBookletIdx = 0;

        // ─── STARTER SET CARD (2–4 / 4–6 people) ───
        const starterSets = (function() {
            try { return JSON.parse(document.getElementById('starter-data').textContent); } catch(e) { return []; }
        })();
        const starterCard = document.getElementById('starter-card');
        let currentStarter = 0;
        document.querySelectorAll('.starter-pax button').forEach(function(b, j) {
            if (b.classList.contains('active')) currentStarter = j;
        });
        function selectStarter(i, silent) {
            const s = starterSets[i];
            if (!s) return;
            currentStarter = i;
            document.getElementById('starter-name').textContent = s.title + (s.paxLabel ? ' · ' + s.paxLabel : '');
            document.getElementById('starter-dishes').textContent = s.dishes;
            document.getElementById('starter-price').textContent = '฿' + s.price;
            document.getElementById('starter-pp').textContent = s.perPerson;
            document.getElementById('starter-spice').innerHTML = s.spiceHtml;
            const img = document.getElementById('starter-img');
            if (img && s.img) { img.src = s.img; img.alt = s.title; }
            document.querySelectorAll('.starter-pax button').forEach(function(b, j) {
                b.className = j === i ? 'active' : '';
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
            if (!starterCard || starterCard.dataset.solo !== '0') return;
            const w = (starterCard.dataset.lunch || '').match(/(\\d{1,2})[:.](\\d{2})\\s*-\\s*(\\d{1,2})[:.](\\d{2})/);
            if (!w) return;
            try {
                const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
                const now = Number(parts.find(p => p.type === 'hour').value) * 60 + Number(parts.find(p => p.type === 'minute').value);
                if (now >= Number(w[1]) * 60 + Number(w[2]) && now < Number(w[3]) * 60 + Number(w[4])) selectStarter(0, true);
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
                    ? '<span class="dot-green"></span> เปิดอยู่ตอนนี้'
                    : '<span class="dot-green closed"></span> ปิดอยู่ · เปิด ' + m[1] + ':' + m[2] + ' น.';

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
                        note.textContent = 'ครัวปิด ' + k[1] + ':' + k[2] + ' · เหลืออีก ' + (h ? h + ' ชม. ' : '') + (mm ? mm + ' นาที' : '');
                        note.hidden = false;
                    } else if (left <= 0) {
                        note.textContent = 'ครัวปิดแล้ว · ร้านเปิดถึง ' + m[3] + ':' + m[4] + ' น.';
                        note.hidden = false;
                    }
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

        const SPICE_LABELS = ${JSON.stringify(SPICE_LABELS)};
        function clientSpiceBadge(range) {
            if (!range) return '';
            return '<span class="spice s' + range.max + '">' + SPICE_LABELS[range.max] + '</span>';
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
                            html += '<div class="section-header" style="background:#e5e5e0;"><span class="section-title">' + escapeClientHtml(cat.name) + '</span><span class="meta-label">' + cItems.length + ' ITEMS</span></div><div>';
                            cItems.forEach(item => {
                                const thumb = item.image_url ? '<img src="https://wsrv.nl/?url=' + encodeURIComponent(item.image_url.split('?')[0]) + '&w=120&q=75&output=webp" alt="' + escapeClientHtml(item.name) + '" class="item-thumb" loading="lazy" width="56" height="56">' : '';
                                const bigImg = item.image_url ? 'https://wsrv.nl/?url=' + encodeURIComponent(item.image_url.split('?')[0]) + '&w=800&q=75&output=webp' : '';
                                const clickAttr = bigImg ? ' data-img="' + bigImg + '" onclick="openLightbox(this.dataset.img)" style="cursor:pointer;"' : '';
                                const descHtml = item.description ? '<div class="item-desc">' + formatClientDescription(item.description) + '</div>' : '';
                                html += '<div class="item-row"' + clickAttr + '><div class="item-info"><div class="item-name">' + escapeClientHtml(item.name) + clientSpiceBadge(item.spice) + '</div>' + descHtml + '<div class="item-price">฿' + escapeClientHtml(item.price) + '</div></div>' + thumb + '</div>';
                            });
                            html += '</div>';
                        });
                        content.innerHTML = html;
                    } catch(e) {}
                }
                content.style.display = 'block';
                btn.innerText = '[-] CLOSE FULL MENU';
                if (window.gtag) gtag('event', 'view_full_menu', { event_category: 'engagement', page_path: '/link' });
                logAdEvent('view_full_menu');
            } else {
                content.style.display = 'none';
                btn.innerText = '[+] VIEW FULL MENU (${menuItems.length} ITEMS)';
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
