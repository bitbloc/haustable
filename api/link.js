import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { LINK_CARDS } from './_link-cards.js'

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI'

const supabase = createClient(supabaseUrl, supabaseKey)

// Food card layers (720 px WebP). LINK_CARDS_BASE overrides it for local QA before upload.
const LINK_CARDS_BASE = process.env.LINK_CARDS_BASE || `${supabaseUrl}/storage/v1/object/public/public-assets/link/cards/`

// In-memory cache for all page data (Settings, Menu Items, Categories, Checkins)
let cachedPageData = null
let cacheExpiry = 0
const CACHE_TTL_MS = 30 * 1000 // 30 seconds in-memory for instant freshness

// New hours start 8 Nov 2026 (Bangkok); see src/utils/storeHours.js
const getStoreHoursLabel = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date()) >= '2026-11-08'
    ? 'เปิดทุกวัน 11:00 - 21:30 น. (ปิดรับออเดอร์ 20:45 น.)'
    : 'เปิดทุกวัน 11:30 - 23:30 น. (ครัวปิด 22:00 น.)'

const DEFAULT_SETTINGS = {
    link_shop_name: "In the haus | ร้านในบ้าน นครพนม",
    link_shop_name_th: "ในบ้าน",
    link_subtitle: "We Make It Bold . จริตจัด รสชัดเต็ม · Real Southern Taste",
    get link_hours() { return getStoreHoursLabel() },
    link_location_text: "ตัวร้านตั้งอยู่บนถนนสุนทรวิจิตร ใกล้ลานพญาศรีสัตตนาคราช 2 นาที ริมโขง นครพนม",
    link_logo_url: "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_logo_url_1778317272888.png",
    link_hero_url: "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_hero_url_1795064259000.webp",
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
    link_sig_img_1: "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_sig_img_1_1795064259000.webp",
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
    // One-line identity band at the very top: what only this shop offers (kept short so it never truncates)
    link_usp: "คาเฟ่ริมโขงที่มีกับข้าวใต้รสนครศรีฯ · จิบชิลตั้งแต่หัววัน ไม่กินเผ็ดก็มาได้",
    link_sig_name_en_1: "Southern Fish Entrails Curry (Gaeng Tai Pla)",
    link_sig_name_en_2: "Stir-fried Liang Leaves (House Style)",
    link_sig_name_en_3: "Stir-fried Stink Beans with Shrimp",
    link_sig_name_zh_1: "泰南发酵鱼内脏咖喱（味道浓烈）",
    link_sig_name_zh_2: "家常炒良叶（泰南野菜）",
    link_sig_name_zh_3: "臭豆炒虾",
    link_sig_name_lo_1: "ແກງໄຕປາ (ລົດຊາດຈັດຈ້ານ)",
    link_sig_name_lo_2: "ໃບຫຼຽງຂົ້ວສູດເຮືອນ",
    link_sig_name_lo_3: "ສະຕໍຂົ້ວກຸ້ງລົດຈັດ",
    link_usp_en: "A Mekong café with real Southern Thai food · Sip from midday, mild dishes for every palate",
    link_usp_zh: "湄公河畔的咖啡馆，地道泰南家常菜 · 中午就能来坐坐，也有不辣的菜",
    link_usp_lo: "ຄາເຟ່ແຄມຂອງທີ່ມີອາຫານປັກໃຕ້ແທ້ໆ · ມານັ່ງຊິວໄດ້ຕັ້ງແຕ່ຕອນທ່ຽງ ຄົນບໍ່ກິນເຜັດກໍມີເມນູ",
    link_location_short_zh: "湄公河畔 · 距那伽广场 2 分钟 · 有停车位",
    link_location_short_lo: "ແຄມຂອງ · ຫ່າງຈາກລານພະຍານາກ 2 ນາທີ · ມີບ່ອນຈອດລົດ",
    link_directions_sub_zh: "距那伽广场 2 分钟",
    link_directions_sub_lo: "ຫ່າງຈາກລານພະຍານາກ 2 ນາທີ",
    link_location_text_zh: "位于那空拍侬湄公河畔的顺通威集路（Sunthorn Wichit Road），距那伽神像广场（Phaya Si Satta Nakharat）约 2 分钟",
    link_location_text_lo: "ຮ້ານຕັ້ງຢູ່ຖະໜົນສຸນທອນວິຈິດ ແຄມແມ່ນ້ຳຂອງ ນະຄອນພະນົມ ຫ່າງຈາກລານພະຍາສີສັດຕະນາຄະລາດ 2 ນາທີ",
    link_location_short_en: "By the Mekong · 2 min from Naga Square · Parking",
    link_directions_sub_en: "2 min from Naga Square",
    link_location_text_en: "On Sunthorn Wichit Road, 2 minutes from Phaya Si Satta Nakharat (Naga) Square, by the Mekong, Nakhon Phanom",
    link_location_short: "ริมโขง · ห่าง 2 นาที จากลานพญานาค · มีที่จอดรถ",
    link_directions_sub: "ห่าง 2 นาที จากลานพญานาค",
    // "First time here?" chooser lists every available item in these categories: comma list matched
    // against the category's Thai or English name, case-insensitive (see isSetCategory)
    link_set_category: "เซ็ต, Set",
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

// Share card (LINE / Facebook / X): a real 1200x630 file. public/og-link.jpg is a stand-in cropped from the
// hero photo until the designed artwork replaces it (same path, so no code change is needed).
const OG_IMAGE_URL = 'https://haustable.vercel.app/og-link.jpg'

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

// Chinese and Lao for fixed UI text, keyed by the English string passed to tt(). Text that
// carries a number or comes from the database passes zh / lo to tt() directly instead.
const ZH = {
    "Open daily": "每日营业",
    "By the Mekong · Walk-ins welcome · Parking": "湄公河畔 · 无需预订 · 有停车位",
    "Get directions": "导航到店",
    "<span class=\"nb\">First time here?</span> <span class=\"nb\">Pick a set for your group</span>": "<span class=\"nb\">第一次来？</span> <span class=\"nb\">按人数选套餐</span>",
    "No booking needed · walk in anytime · parking": "无需预订 · 随时到店 · 有停车位",
    "Start here": "推荐从这份开始",
    "Call us": "电话咨询",
    "Want a table for sure?": "想确保有位？",
    "Book ahead": "提前订位",
    "Order for pickup": "点餐到店自取",
    "Book a table": "订位",
    "Opening hours · daily": "营业时间 · 每天",
    "Opens": "开门",
    "Closes": "关门",
    "Location": "地址",
    "Map": "地图",
    "How to get here": "怎么到店",
    "Real guest photos": "顾客实拍",
    "Check-in wall from our guests": "到店顾客的打卡墙",
    "Menu": "菜单",
    "Atmosphere": "环境",
    "Contact": "联系",
    "Signature dishes": "招牌菜",
    "Tap to enlarge": "点击图片放大",
    "Browse the printed menu": "翻看纸质菜单",
    "Recommended": "推荐菜品",
    "Every category, with prices and spice levels": "全部分类，含价格和辣度",
    "By the Mekong": "湄公河畔的环境",
    "Real meals from guests": "顾客拍的餐点",
    "Contact us": "联系本店",
    "Chat on LINE": "LINE 聊天",
    "Ask us or order": "咨询或点餐",
    "Call the shop": "致电本店",
    "Book &amp; order": "订位与点餐",
    "Walk-ins welcome": "不订位也可以来",
    "When you want a table for sure": "想确保有位的时候",
    "Order online, pick up at the shop": "线上点餐，到店自取",
    "Delivery via LINE MAN": "LINE MAN 外卖",
    "Order in the LINE MAN app": "在 LINE MAN 应用里下单",
    "Follow &amp; info": "关注我们与店铺信息",
    "FAQ": "常见问题",
    "Questions guests often ask": "顾客常问的问题",
    "Guest check-in wall": "顾客打卡墙",
    "Photos from our guests": "到店顾客的照片",
    "Directions": "导航",
    "LINE chat": "LINE 聊天",
    "Call": "电话",
    "Book": "订位",
    "Close": "关闭",
    "Prev": "上一页",
    "Next": "下一页",
    "Not spicy": "不辣",
    "Mild": "微辣",
    "Medium": "中辣",
    "Very spicy": "很辣",
    "Some spicy dishes": "含辣菜",
    "Open now": "营业中",
    "Closed": "已打烊",
    "Close the full menu": "收起完整菜单",
    "Last order in": "距最后点餐还有",
    "Closes in": "距打烊还有",
    "Opens in": "距开门还有",
}
const LO = {
    "Open daily": "ເປີດທຸກມື້",
    "By the Mekong · Walk-ins welcome · Parking": "ແຄມຂອງ · ບໍ່ຈອງກໍມາໄດ້ · ມີບ່ອນຈອດລົດ",
    "Get directions": "ນຳທາງມາຮ້ານ",
    "<span class=\"nb\">First time here?</span> <span class=\"nb\">Pick a set for your group</span>": "<span class=\"nb\">ມາຄັ້ງທຳອິດບໍ?</span> <span class=\"nb\">ເລືອກຊຸດຕາມຈຳນວນຄົນ</span>",
    "No booking needed · walk in anytime · parking": "ບໍ່ຈອງກໍມາໄດ້ · ເຂົ້າມາໄດ້ເລີຍ · ມີບ່ອນຈອດລົດ",
    "Start here": "ເລີ່ມທີ່ຊຸດນີ້",
    "Call us": "ໂທສອບຖາມ",
    "Want a table for sure?": "ຢາກໄດ້ໂຕະແນ່ນອນບໍ?",
    "Book ahead": "ຈອງລ່ວງໜ້າ",
    "Order for pickup": "ສັ່ງແລ້ວມາຮັບທີ່ຮ້ານ",
    "Book a table": "ຈອງໂຕະ",
    "Opening hours · daily": "ເວລາເປີດ-ປິດ · ທຸກມື້",
    "Opens": "ເປີດ",
    "Closes": "ປິດ",
    "Location": "ທີ່ຕັ້ງ",
    "Map": "ແຜນທີ່",
    "How to get here": "ວິທີມາຮ້ານ",
    "Real guest photos": "ຮູບຈາກລູກຄ້າຈິງ",
    "Check-in wall from our guests": "ກະດານເຊັກອິນຂອງລູກຄ້າທີ່ມາຮ້ານ",
    "Menu": "ເມນູ",
    "Atmosphere": "ບັນຍາກາດ",
    "Contact": "ຕິດຕໍ່",
    "Signature dishes": "ເມນູເດັ່ນຂອງຮ້ານ",
    "Tap to enlarge": "ແຕະຮູບເພື່ອຂະຫຍາຍ",
    "Browse the printed menu": "ເປີດເບິ່ງເມນູແບບເຫຼັ້ມ",
    "Recommended": "ເມນູແນະນຳ",
    "Every category, with prices and spice levels": "ທຸກໝວດ ພ້ອມລາຄາ ແລະ ລະດັບຄວາມເຜັດ",
    "By the Mekong": "ບັນຍາກາດຮ້ານແຄມຂອງ",
    "Real meals from guests": "ຮູບອາຫານຈາກລູກຄ້າ",
    "Contact us": "ຕິດຕໍ່ຮ້ານ",
    "Chat on LINE": "ແຊັດ LINE",
    "Ask us or order": "ສອບຖາມ ຫຼື ສັ່ງອາຫານ",
    "Call the shop": "ໂທຫາຮ້ານ",
    "Book &amp; order": "ຈອງໂຕະ ແລະ ສັ່ງອາຫານ",
    "Walk-ins welcome": "ບໍ່ຈອງກໍມາໄດ້",
    "When you want a table for sure": "ສຳລັບມື້ທີ່ຢາກໄດ້ໂຕະແນ່ນອນ",
    "Order online, pick up at the shop": "ສັ່ງອອນລາຍ ແລ້ວແວ່ມາຮັບ",
    "Delivery via LINE MAN": "ສົ່ງອາຫານຜ່ານ LINE MAN",
    "Order in the LINE MAN app": "ສັ່ງຜ່ານແອັບ LINE MAN",
    "Follow &amp; info": "ຕິດຕາມ ແລະ ຂໍ້ມູນຮ້ານ",
    "FAQ": "ຄຳຖາມທີ່ພົບເລື້ອຍ",
    "Questions guests often ask": "ຄຳຖາມທີ່ລູກຄ້າຖາມເລື້ອຍໆ",
    "Guest check-in wall": "ກະດານເຊັກອິນລູກຄ້າ",
    "Photos from our guests": "ຮູບຈາກລູກຄ້າທີ່ມາຮ້ານ",
    "Directions": "ນຳທາງ",
    "LINE chat": "ແຊັດ LINE",
    "Call": "ໂທ",
    "Book": "ຈອງໂຕະ",
    "Close": "ປິດ",
    "Prev": "ກ່ອນໜ້າ",
    "Next": "ຖັດໄປ",
    "Not spicy": "ບໍ່ເຜັດ",
    "Mild": "ເຜັດໜ້ອຍ",
    "Medium": "ເຜັດກາງ",
    "Very spicy": "ເຜັດຫຼາຍ",
    "Some spicy dishes": "ມີຈານເຜັດ",
    "Open now": "ເປີດຢູ່",
    "Closed": "ປິດຢູ່",
    "Close the full menu": "ປິດເມນູທັງໝົດ",
    "Last order in": "ປິດຮັບອໍເດີໃນອີກ",
    "Closes in": "ຮ້ານປິດໃນອີກ",
    "Opens in": "ເປີດໃນອີກ",
}

// TH/EN/ZH/LO: every language is rendered, CSS shows the one set on <html lang> (no re-render, no flash).
// A string with no Chinese or Lao reuses the English span (it carries l-zh / l-lo as well).
function tt(th, en, zh, lo) {
    const z = zh || ZH[en]
    const l = lo || LO[en]
    return `<span class="l-th">${th}</span><span class="l-en${z ? '' : ' l-zh'}${l ? '' : ' l-lo'}">${en}</span>${z ? `<span class="l-zh">${z}</span>` : ''}${l ? `<span class="l-lo">${l}</span>` : ''}`
}
// Class list for a wrapper that should show only in the languages that have content
function langOnly(th, en, zh, lo) {
    const has = { th: !!th, en: !!en, zh: !!(zh || en), lo: !!(lo || en) }
    return Object.values(has).every(Boolean) ? '' : Object.keys(has).filter(k => has[k]).map(k => ` l-${k}`).join('')
}
const HEAT_LABELS_EN = ['Not spicy', 'Mild', 'Medium', 'Very spicy']

// Three-cell heat meter + Thai label. A set mixing mild and hot dishes reads "มีจานเผ็ด".
function heatHtml(range) {
    if (!range) return ''
    const level = range.max
    const label = level > 0 && range.min === 0 ? 'มีจานเผ็ด' : HEAT_LABELS[level]
    const labelEn = level > 0 && range.min === 0 ? 'Some spicy dishes' : HEAT_LABELS_EN[level]
    const cells = [1, 2, 3].map(n => `<i${n <= level ? ' class="on"' : ''}></i>`).join('')
    return `<span class="heat h${level}" role="img" aria-label="ความเผ็ด: ${label}"><span class="heat-cells" aria-hidden="true">${cells}</span><span class="heat-label">${tt(label, labelEn)}</span></span>`
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

// Menu item name: EN view shows name_en with the Thai name underneath (guests can point it out to staff), like the QR order page
function itemNameHtml(item) {
    const th = escapeHtml(item.name)
    const alt = v => { const t = String(v || '').trim(); return t && t !== item.name ? `${escapeHtml(t)}<span class="item-name-th">${th}</span>` : '' }
    return tt(th, alt(item.name_en) || th, alt(item.name_zh), alt(item.name_lo))
}
// Description: EN view shows only the English description (no Thai fallback), like the QR order page
function itemDescHtml(item) {
    const th = item.description ? formatDescriptionHtml(item.description) : ''
    const en = item.description_en ? formatDescriptionHtml(item.description_en) : ''
    const zh = item.description_zh ? formatDescriptionHtml(item.description_zh) : ''
    const lo = item.description_lo ? formatDescriptionHtml(item.description_lo) : ''
    if (!th && !en && !zh && !lo) return ''
    return `<div class="item-desc${langOnly(th, en, zh, lo)}">${tt(th, en, zh, lo)}</div>`
}

// Guest caption: no emoji, at most ~50 characters
function captionText(text) {
    const t = String(text || '').replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim()
    return t.length > 50 ? t.slice(0, 48) + '…' : t
}

// Join phrases with a separator, each phrase kept on one line (Thai has no spaces to break on)
// "ห่าง 2 นาที จากลานพญานาค" → two no-wrap phrases split at the last space, so a narrow cell wraps between
// phrases ("ห่าง 2 นาที" / "จากลานพญานาค") and never inside a Thai word
function lastPhraseHtml(text) {
    const t = String(text || '').trim()
    const i = t.lastIndexOf(' ')
    if (i < 1) return `<span class="nb">${escapeHtml(t)}</span>`
    return `<span class="nb">${escapeHtml(t.slice(0, i))}</span> <span class="nb">${escapeHtml(t.slice(i + 1))}</span>`
}

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
    let perPersonEn = ''
    let perPersonZh = ''
    let perPersonLo = ''
    if (pax && price) {
        const low = Math.round(price / Number(pax[2]))
        const high = Math.round(price / Number(pax[1]))
        const range = low === high ? `฿${low}` : `฿${low}–${high}`
        perPerson = `คนละ ${range}`
        perPersonEn = `${range} per person`
        perPersonZh = `每人 ${range}`
        perPersonLo = `${range} ຕໍ່ຄົນ`
    }
    // "Set L for 2-4: House Set" → "Set L · House Set"
    const nameEn = String(item.name_en || '').trim()
    const titleEn = nameEn
        ? nameEn.replace(/^(set\s+\w+)\s+for\s+[\d\s-]+:\s*/i, '$1 · ').replace(/^set\s*:\s*/i, '').trim()
        : title
    const dishesEn = String(item.description_en || '').trim().split('\n')[0].trim() || dishes
    // "L 套餐（2-4 人）泰南风味套餐：臭豆炒虾 • …" → "L 套餐 · 泰南风味套餐"; "套餐：招牌烤猪颈肉饭 + 饮品" → "招牌烤猪颈肉饭 + 饮品"
    const shortSetTitle = (full, lone, pax) => {
        const text = String(full || '').trim()
        if (!text) return ''
        const cut = text.search(/[:：]/)
        const head = (cut < 0 ? text : text.slice(0, cut)).trim()
        if (lone.test(head)) return cut < 0 ? '' : text.slice(cut + 1).trim()
        return head.replace(pax, ' · ').replace(/(\s·\s)+$/, '').trim()
    }
    const titleZh = shortSetTitle(item.name_zh, /^套餐$/, /\s*（[^）]*）\s*/)
    const titleLo = shortSetTitle(item.name_lo, /^ຊຸດ$/, /\s*ສຳລັບ\s*[\d\s-]+ຄົນ\s*/)
    const dishesZh = String(item.description_zh || '').trim().split('\n')[0].trim()
    const dishesLo = String(item.description_lo || '').trim().split('\n')[0].trim()
    return {
        id: item.id,
        group: pax ? `${pax[1]}–${pax[2]}` : '1',
        groupMin: pax ? Number(pax[1]) : 1,
        title,
        titleEn,
        titleZh,
        titleLo,
        dishes,
        dishesEn,
        dishesZh,
        dishesLo,
        price,
        perPerson,
        perPersonEn,
        perPersonZh,
        perPersonLo,
        heat: heatHtml(spiceRange(name, spiceMap, item.id)),
        thumb: item.image_url ? optImg(item.image_url, 160, 70) : '',
        feature: item.image_url ? optImg(item.image_url, 720, 70) : '',
        featureSm: item.image_url ? optImg(item.image_url, 480, 70) : '',
        bigImg: item.image_url ? optImg(item.image_url, 800) : ''
    }
}

// link_set_category → normalized keys. "Set :" (the old default) becomes "set"; the defaults are always
// accepted too, so a stale stored value can't hide the chooser again.
function setCategoryKeyList(setting) {
    const norm = s => String(s || '').trim().toLowerCase().replace(/\s*[:：]\s*$/, '')
    const keys = String(setting || '').split(',').concat(DEFAULT_SETTINGS.link_set_category.split(','))
    return [...new Set(keys.map(norm).filter(Boolean))]
}
// A category is a set category when its Thai or English name equals a key or starts with it
// ("Set Menus", "เซ็ต (2-4 คน)"). A Latin key must end on a word edge, so "set" never matches "Settings".
function isSetCategory(category, keys) {
    const names = [category.name, category.name_en].map(n => String(n || '').trim().toLowerCase()).filter(Boolean)
    return names.some(n => keys.some(k => n === k || (n.startsWith(k) && !/[a-z0-9]/.test(n.charAt(k.length)))))
}

// "11:30-15:00" → is the current Asia/Bangkok time inside it?
function inTimeWindow(range, date = new Date()) {
    const w = String(range || '').match(/(\d{1,2})[:.](\d{2})\s*-\s*(\d{1,2})[:.](\d{2})/)
    if (!w) return false
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
    const now = Number(parts.find(p => p.type === 'hour').value) * 60 + Number(parts.find(p => p.type === 'minute').value)
    return now >= Number(w[1]) * 60 + Number(w[2]) && now < Number(w[3]) * 60 + Number(w[4])
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

// Full menu for the client-rendered "ดูเมนูทั้งหมด" list: only the fields that list reads, with spice levels.
// Served from /link?part=menu so the first HTML stays small.
function fullMenuPayload(data) {
    const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) }
    const spiceMap = parseSpiceMap(settings.link_spice_map || DEFAULT_SETTINGS.link_spice_map)
    const pick = (o, keys) => keys.reduce((acc, k) => { if (o[k] !== null && o[k] !== undefined && o[k] !== '') acc[k] = o[k]; return acc }, {})
    return {
        categories: (data.categories || []).map(c => pick(c, ['id', 'name', 'name_en', 'name_zh', 'name_lo'])),
        menuItems: (data.menuItems || []).map(i => ({
            ...pick(i, ['id', 'name', 'name_en', 'name_zh', 'name_lo', 'price', 'description', 'description_en', 'description_zh', 'description_lo', 'image_url', 'category_id']),
            spice: spiceRange(i.name, spiceMap, i.id)
        }))
    }
}

// utm_content that says the ad sold the location → location-first banner.
// Whole tokens only (split on _ / - / space), from this list: a substring match also caught
// "local_pickup" ("loc") and similar. "naga_location" matches through "location" (and "naga").
const LOCATION_AD_TOKENS = new Set([
    'location', 'loc', 'map', 'maps', 'direction', 'directions', 'nav', 'navigate', 'navigation',
    'near', 'nearby', 'naga', 'phaya', 'พญานาค', 'นำทาง'
])
export function isLocationAd(utmContent) {
    return String(utmContent || '').trim().toLowerCase().split(/[_\-\s]+/).some(t => LOCATION_AD_TOKENS.has(t))
}

function generateStandaloneLandingHtml(data, opts = {}) {
    const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) }
    const menuItems = data.menuItems || []
    const categories = data.categories || []
    const checkins = data.checkins || []

    const shopName = escapeHtml(settings.link_shop_name || "In the haus | ร้านในบ้าน นครพนม")
    // Masthead: "In the haus | ร้านในบ้าน นครพนม" → "In the haus" over "ร้านในบ้าน นครพนม", leaving room for the status cell
    const [mastTitle, ...mastRest] = String(settings.link_shop_name || "In the haus | ร้านในบ้าน นครพนม").split('|').map(t => t.trim())
    const mastSub = mastRest.join(' ') || settings.link_shop_name_th || "ในบ้าน"
    const hours = escapeHtml(settings.link_hours || getStoreHoursLabel())
    const locationText = escapeHtml(settings.link_location_text || "ตัวร้านตั้งอยู่บนถนนสุนทรวิจิตร ใกล้ลานพญาศรีสัตตนาคราช 2 นาที ริมโขง นครพนม")
    const logoUrl = settings.link_logo_url || DEFAULT_SETTINGS.link_logo_url

    // Signatures (Optimized strictly for mobile viewport: 160px CSS width * 1.5x DPR = 240px to eliminate oversized image warning)
    // Food cards (owner 2026-11-24): 9 type-in-scene cards replace the 3 signature dishes (link_sig_* stays in settings, unused).
    // Dish name in en/zh/lo from the menu: exact Thai name, else the single dish (never a set) whose Thai name starts the same.
    const dishAlt = (field, name) => {
        const dishes = menuItems.filter(m => m[field] && !/^set\b|เซต/i.test(String(m.name || '')))
        const hit = dishes.find(m => String(m.name).trim() === name) || dishes.find(m => String(m.name).startsWith(name))
        return hit ? escapeHtml(hit[field]) : ''
    }
    const FC_TEMPO = { 'รสจัด': 'sharp', 'จี๊ด': 'sharp', 'กรุบ': 'sharp', 'ซี้ด': 'sharp', 'ละมุน': 'soft', 'หวานนัว': 'soft', 'หอมมัน': 'soft' }
    const fcPct = v => `${v}%`
    const fcLogo = LINK_CARDS.logo
    const renderFoodCards = fcLoading => LINK_CARDS.cards.map((c, k) => {
        const src = name => `${LINK_CARDS_BASE}${c.id}-${name}.webp`
        // First card: eager (it can be the largest image of the first screen); the rest load as they near the strip's edge
        const load = k === 0 ? fcLoading : 'loading="lazy"'
        const th = escapeHtml(c.caption)
        // Thai name wraps only at its phrase break: each phrase stays whole, <wbr> allows the break between them
        const thHtml = c.captionBreak ? c.captionBreak.split('|').map(p => `<span class="fc-nb">${escapeHtml(p)}</span>`).join('<wbr>') : th
        const en = dishAlt('name_en', c.caption) || th
        const letters = c.slices.map((s, i) => {
            // inside the word box (height = the word's base line), so the box clips letters rising through that line
            const top = (s[1] / c.base) * 100, h = (s[3] / c.base) * 100
            const rise = ((c.base - s[1]) / s[3]) * 100 + 4
            return `<img src="${src('w' + i)}" alt="" ${load} decoding="async" width="${Math.round(s[2] * 7.2)}" height="${Math.round(s[3] * 10.8 * 0.6667)}" data-rise="${rise.toFixed(1)}" style="left:${fcPct(s[0])};top:${fcPct(top.toFixed(3))};width:${fcPct(s[2])};height:${fcPct(h.toFixed(3))}">`
        }).join('')
        return `<figure class="fc-card" data-tempo="${FC_TEMPO[c.word] || 'even'}">
                    <div class="fc-scene" style="transform-origin:50% ${c.dishCy}%">
                        <img class="fc-photo" src="${src('photo')}" alt="" ${load} decoding="async" width="720" height="1080" style="top:${fcPct(c.photoTop)}">
                        <div class="fc-word" aria-hidden="true" style="height:${fcPct(c.base)}">${letters}</div>
                        <img class="fc-dish" src="${src('dish')}" alt="" ${load} decoding="async" width="720" height="1080" style="top:${fcPct(c.photoTop)}">
                    </div>
                    <figcaption class="fc-cap" style="left:${fcPct(LINK_CARDS.capX)};bottom:${fcPct(LINK_CARDS.capBottom)}"><span class="fc-vh" lang="th">${escapeHtml(c.word)} · </span>${tt(thHtml, en, dishAlt('name_zh', c.caption), dishAlt('name_lo', c.caption))}</figcaption>
                    <img class="fc-logo" src="${LINK_CARDS_BASE}logo-naibaan-cream.webp" alt="" loading="lazy" decoding="async" width="240" height="130" style="right:${fcPct(fcLogo.right)};top:${fcPct(fcLogo.top)};width:${fcPct(fcLogo.w)};height:auto">
                </figure>`
    }).join('')

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
    const setCategoryKeys = setCategoryKeyList(settings.link_set_category)
    const setCategoryIds = new Set(categories.filter(c => isSetCategory(c, setCategoryKeys)).map(c => c.id))
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
    // Group shown on first paint: the solo sets during the lunch window (Asia/Bangkok), else the default.
    // Chosen here rather than in the browser so the visible feature photo is the one preloaded as LCP.
    const initialGroup = (setGroups.some(g => g.key === '1') && inTimeWindow(settings.link_lunch_window || DEFAULT_SETTINGS.link_lunch_window)) ? '1' : defaultGroup
    const initialSet = (setGroups.find(g => g.key === initialGroup) || { rows: [] }).rows[0]
    // Largest image in the first mobile screen: the visible set photo, else the first food card's photo.
    // The preload carries the same srcset/sizes as the <img> so the browser fetches the file it will show.
    const SET_FEATURE_SIZES = '(max-width: 560px) calc(100vw - 32px), 528px'
    const fcPhoto1 = `${LINK_CARDS_BASE}${LINK_CARDS.cards[0].id}-photo.webp`
    const lcpImage = initialSet && initialSet.feature
        ? { href: initialSet.feature, srcset: `${initialSet.featureSm} 480w, ${initialSet.feature} 720w`, sizes: SET_FEATURE_SIZES }
        : { href: fcPhoto1, srcset: `${fcPhoto1} 720w`, sizes: '(max-width: 480px) 82vw, 380px' }
    // With the set chooser on top, the food cards sit below the first screen and must not compete with it
    const fcLoading = initialSet ? 'loading="lazy"' : 'fetchpriority="high" loading="eager"'

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
    const directionsSubEn = escapeHtml(settings.link_directions_sub_en || DEFAULT_SETTINGS.link_directions_sub_en)
    const locationShortEnHtml = phrasesHtml(settings.link_location_short_en || DEFAULT_SETTINGS.link_location_short_en, '·', ' · ')
    const locationTextEn = escapeHtml(settings.link_location_text_en || DEFAULT_SETTINGS.link_location_text_en)
    const hoursMainEn = hoursMain.replace(/\s*น\.?\s*$/, '').replace(' - ', ' – ')
    const hoursNoteEn = hoursNote.replace(/ปิดรับออเดอร์|ครัวปิด/, 'Last order').replace(/\s*น\.?\s*$/, '')
    const peopleEn = key => key === '1' ? '1 person' : `${key} people`
    const hoursNoteZh = hoursNote.replace(/ปิดรับออเดอร์|ครัวปิด/, '最后点餐').replace(/\s*น\.?\s*$/, '')
    const hoursNoteLo = hoursNote.replace(/ปิดรับออเดอร์|ครัวปิด/, 'ຮັບອໍເດີຮອດ').replace(/\s*น\.?\s*$/, '')
    const directionsSubZh = escapeHtml(settings.link_directions_sub_zh || DEFAULT_SETTINGS.link_directions_sub_zh)
    const directionsSubLo = escapeHtml(settings.link_directions_sub_lo || DEFAULT_SETTINGS.link_directions_sub_lo)
    const locationShortZhHtml = phrasesHtml(settings.link_location_short_zh || DEFAULT_SETTINGS.link_location_short_zh, '·', ' · ')
    const locationShortLoHtml = phrasesHtml(settings.link_location_short_lo || DEFAULT_SETTINGS.link_location_short_lo, '·', ' · ')
    const locationTextZh = escapeHtml(settings.link_location_text_zh || DEFAULT_SETTINGS.link_location_text_zh)
    const locationTextLo = escapeHtml(settings.link_location_text_lo || DEFAULT_SETTINGS.link_location_text_lo)
    // "11:00 - 21:30 น." → open and close times for the two-column hours grid
    const hoursSplit = hoursMain.match(/(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})/)

    // Location-first banner is decided here from the ad URL, so it is in the first paint and never pushes the page down.
    // The CDN caches per full URL, so each utm_content gets its own copy.
    const locationFirst = isLocationAd(opts.utmContent)

    // Tags
    const tags = (settings.link_tags || DEFAULT_SETTINGS.link_tags).split(',').map(t => t.trim()).filter(Boolean)

    // Restaurant structured data (JSON-LD) for Google Search; hours follow the store-hours setting
    const restaurantLd = {
        '@context': 'https://schema.org',
        '@type': 'Restaurant',
        name: 'In the haus (ร้านในบ้าน)',
        alternateName: ['ร้านในบ้าน', 'ในบ้าน นครพนม', 'In the haus'],
        url: 'https://haustable.vercel.app/link',
        image: OG_IMAGE_URL,
        telephone: '+66985284217',
        priceRange: '฿150–350',
        servesCuisine: ['Southern Thai', 'Thai', 'Coffee'],
        acceptsReservations: 'https://haustable.vercel.app/booking',
        address: { '@type': 'PostalAddress', streetAddress: '788/1 ถนนสุนทรวิจิตร ตำบลในเมือง', addressLocality: 'อำเภอเมืองนครพนม', addressRegion: 'นครพนม', postalCode: '48000', addressCountry: 'TH' },
        geo: { '@type': 'GeoCoordinates', latitude: 17.390079, longitude: 104.792933 }
    }
    if (hoursSplit) {
        restaurantLd.openingHoursSpecification = [{
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            opens: hoursSplit[1].replace('.', ':'),
            closes: hoursSplit[2].replace('.', ':')
        }]
    }
    const restaurantLdJson = JSON.stringify(restaurantLd).replace(/</g, '\\u003c')

    return `<!doctype html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
    <title>ร้านอาหารนครพนม ริมโขง | ในบ้าน (In the haus) อาหารใต้และคาเฟ่</title>
    <meta name="description" content="ร้านอาหารและคาเฟ่ริมโขงในเมืองนครพนม ห่างลานพญานาค 2 นาที อาหารใต้รสชัด มีเมนูไม่เผ็ด กาแฟและเครื่องดื่ม เปิดทุกวัน ${hoursMain} มีที่จอดรถ ไม่จองก็มาได้">
    <link rel="canonical" href="https://haustable.vercel.app/link">
    <script type="application/ld+json">${restaurantLdJson}</script>
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
    <link rel="apple-touch-icon" href="/apple-touch-icon-inbaan.png">
    <meta name="theme-color" content="#41032A">

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://haustable.vercel.app/link">
    <meta property="og:title" content="${shopName} | อาหารใต้รสชัด ริมโขง">
    <meta property="og:description" content="อาหารใต้รสชัด บรรยากาศนั่งสบายริมโขง ครบทั้งเซ็ต กับข้าว และกาแฟ ร้านอาหารและคาเฟ่นครพนม จองโต๊ะ & สอบถาม : 098-528-4217">
    <meta property="og:image" content="${OG_IMAGE_URL}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="อาหารใต้ของร้านในบ้าน นครพนม">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${shopName} | อาหารใต้รสชัด ริมโขง">
    <meta name="twitter:description" content="อาหารใต้รสชัด บรรยากาศนั่งสบายริมโขง ครบทั้งเซ็ต กับข้าว และกาแฟ ร้านอาหารและคาเฟ่นครพนม">
    <meta name="twitter:image" content="${OG_IMAGE_URL}">

    <!-- Preconnect + LCP image preload (same srcset/sizes as the visible <img>, so it is never fetched twice) -->
    <link rel="preconnect" href="https://wsrv.nl" crossorigin>
    <link rel="preload" as="image" href="${lcpImage.href}" imagesrcset="${lcpImage.srcset}" imagesizes="${lcpImage.sizes}" fetchpriority="high">
    <meta name="rendered-at" content="${Date.now()}">

    <!-- Agentic Resource Discovery (ARD / WebMCP) for AI Agents -->
    <link rel="ai-catalog" href="/.well-known/ai-catalog.json" type="application/json">
    <link rel="ard" href="/.well-known/ard.json" type="application/json">

    <!-- Fonts: self-hosted woff2 (public/fonts/link-fonts.css), font-display: swap. The stylesheet is non-blocking,
         so the first paint uses fallback fonts and the font files never compete with the LCP photo. -->
    <link rel="stylesheet" href="/fonts/link-fonts.css" media="print" onload="this.media='all'">
    <noscript><link rel="stylesheet" href="/fonts/link-fonts.css"></noscript>

    <script>
        // Language: ?lang=th|en|zh|lo, else the visitor's saved choice, else a phone whose first
        // language is Chinese or Lao, else Thai. Set before paint so nothing flashes.
        var HAUS_LANGS = { th: 'th', en: 'en', zh: 'zh-Hans', lo: 'lo' };
        function loadLaoFont() {
            if (document.getElementById('font-lao')) return;
            var f = document.createElement('link');
            f.id = 'font-lao'; f.rel = 'stylesheet';
            f.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@400;500;600;700&display=swap';
            document.head.appendChild(f);
        }
        (function() {
            try {
                var q = new URLSearchParams(location.search).get('lang');
                var l = HAUS_LANGS[q] ? q : localStorage.getItem('haus_lang');
                if (HAUS_LANGS[q]) localStorage.setItem('haus_lang', q);
                if (!HAUS_LANGS[l]) {
                    var first = String((navigator.languages && navigator.languages[0]) || navigator.language || '').toLowerCase();
                    l = first.indexOf('zh') === 0 ? 'zh' : first.indexOf('lo') === 0 ? 'lo' : 'th';
                }
                document.documentElement.lang = HAUS_LANGS[l];
                if (l === 'lo') loadLaoFont();
            } catch (e) {}
        })();
    </script>
    <style>
        /* Hallmark · macrostructure: Catalogue · tone: Thai twist modern · anchor hue: 348 plum
         * theme: brand v2 (.agents/AGENTS.md) · cream #F6F2EA · plum #41032A · lime #D0E020 (one primary action) · SOV_monomon / IBM Plex Sans Thai / DM Mono
         * axes: light / grotesk-sans / warm · nav: tabular tab strip · footer: Ft4 dense colophon · sticky: C4 tabular bar · enrichment: none
         * tasteskill pass (--keep palette,type): blocks separated by tone + 8px ground gaps; first-time set chooser is the one dark field with a large starter photo
         * Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
        :root {
            /* Brand v2 "Thai twist modern" (.agents/AGENTS.md): OKLCH converted from the brand hex */
            --brand-plum: oklch(25.18% 0.1001 348.33);      /* #41032A */
            --brand-plum-2: oklch(33.03% 0.0965 348.04);    /* #571C3E */
            --brand-plum-3: oklch(41.92% 0.0851 347.97);    /* #6E3855 */
            --on-plum-2: oklch(79.98% 0.0348 349.28);       /* #D0B5C1 */
            /* Primary action: charcoal with cream text (lime retired 2026-11-17: too loud) */
            --action-primary: oklch(21.78% 0 0);            /* #1A1A1A */
            --action-primary-hover: oklch(26.96% 0.0069 345.80); /* #292527 */
            --on-action: oklch(96.20% 0.0115 84.58);        /* #F6F2EA, 15.59:1 */
            --charcoal: oklch(21.78% 0 0);                  /* #1A1A1A */
            --cream: oklch(96.20% 0.0115 84.58);            /* #F6F2EA */
            --error-red: oklch(50.03% 0.1821 29.51);        /* #B42318, errors only */

            /* Existing names mapped onto the brand (class names unchanged) */
            --color-paper: var(--cream);
            --color-paper-2: oklch(92.60% 0.0095 352.37);   /* #ECE4E7 */
            --color-paper-3: oklch(89.47% 0.0128 345.51);   /* #E3D9DE */
            --color-rule: oklch(85.05% 0.0113 348.48);      /* #D4CBCF */
            --color-neutral: oklch(48.01% 0.0120 345.78);   /* #635B5F, 5.27:1 on paper-2 */
            --color-label: var(--color-neutral);
            --color-muted: oklch(41.84% 0.0124 345.90);     /* #524A4E */
            --color-ink: var(--charcoal);
            --color-ink-2: oklch(26.96% 0.0069 345.80);     /* #292527 */
            --color-ink-3: oklch(33.10% 0.0078 351.28);     /* #393436 */
            --color-on-ink-2: var(--on-plum-2);
            /* First-time set block: plum field */
            --color-field: var(--brand-plum);
            --color-field-2: var(--brand-plum-2);
            --color-field-3: var(--brand-plum-3);
            /* Terracotta was never an error here (set tag, spice): it becomes plum. Red is for errors only. */
            --color-accent: var(--brand-plum);
            --color-accent-light: var(--on-plum-2);
            /* Status green (open dot, "not spicy") stays a status colour */
            --color-accent-2: oklch(45% 0.08 140);
            --color-accent-2-light: oklch(80% 0.10 140);
            --color-accent-2-wash: oklch(95% 0.025 140);
            --color-focus: var(--brand-plum);
            /* Primary action */
            --color-signal: var(--action-primary);
            --color-signal-2: var(--action-primary-hover);
            /* LINE buttons are secondary actions: plum like the others (owner, 2026-11-17), cream text 14.79:1 */
            --color-line: var(--brand-plum);
            --color-line-2: var(--brand-plum-2);
            --color-scrim: oklch(16% 0.02 348 / 0.9);
            --color-scrim-soft: oklch(16% 0.02 348 / 0);

            --font-display: "SOV_monomon", "IBM Plex Sans Thai", -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
            --font-body: "IBM Plex Sans Thai", -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
            --font-mono: "DM Mono", "IBM Plex Sans Thai", ui-monospace, Menlo, Consolas, monospace;

            --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
            --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;

            /* Type scale (AGENTS.md §4): body (md) is 16px; sm is for secondary lines, xs only for labels */
            --text-xs: 12px; --text-sm: 14px; --text-md: 16px; --text-lg: 18px; --text-xl: 20px; --text-2xl: 24px;

            --radius: 2px;
            --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
            --dur: 160ms;
            --bar-h: 60px;
            --z-sticky: 30; --z-bar: 50; --z-modal: 100;
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { overflow-x: clip; }
        html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; background: var(--color-paper-2); }
        body { font-family: var(--font-body); font-size: var(--text-md); background: var(--color-paper-2); color: var(--color-ink); line-height: 1.55; -webkit-font-smoothing: antialiased; }
        a { color: inherit; text-decoration: none; }
        button { font: inherit; color: inherit; cursor: pointer; border: none; background: none; }
        img { display: block; max-width: 100%; height: auto; }
        a, button, summary { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
        a:focus-visible, button:focus-visible, summary:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
        /* On plum surfaces a plum ring would vanish: cream there (14.79:1 on plum) */
        :is(.marquee, .loc-hero, .sets, .row-link.ink, .full-menu-btn, .loc-map-btn) :focus-visible, :is(.row-link.ink, .full-menu-btn, .loc-map-btn):focus-visible { outline-color: var(--color-paper); }
        .num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
        .arrow { font-family: var(--font-mono); }
        .nb { white-space: nowrap; }
        @media (max-width: 380px) { :root { --bar-h: 68px; } }
        .fact-val.flow { display: block; }
        .fact-note { font-size: var(--text-xs); color: var(--color-muted); line-height: 1.4; }

        /* Page frame */
        /* Blocks are paper slips on a darker ground: an 8px gap of ground between blocks, never a hairline */
        .container { width: 100%; max-width: 560px; margin: 0 auto; min-height: 100vh; display: flex; flex-direction: column; padding-bottom: calc(var(--bar-h) + env(safe-area-inset-bottom)); }
        /* One continuous sheet: blocks are divided by hairlines only, no ground gaps between them */
        html { scroll-behavior: smooth; }
        .container { background: var(--color-paper); }
        @media (min-width: 561px) { .container { border-left: 1px solid var(--color-rule); border-right: 1px solid var(--color-rule); } }
        .masthead, .facts, .tags-wrap, footer, :where(#sec-menu, #sec-vibe, #sec-connect) > * { background-color: var(--color-paper); }
        .facts, .quick-grid, .tags-wrap, footer { border-top: 1px solid var(--color-rule); }
        .row-link.slip { border-top: 1px solid var(--color-rule); }
        :where(#sec-menu, #sec-vibe, #sec-connect) { scroll-margin-top: 48px; }
        :where(#sec-vibe, #sec-connect) > .section-header:first-child { border-top: 1px solid var(--color-ink); }
        /* Identity band: the full line stays readable (wraps between phrases instead of being cut off with an ellipsis) */
        html[lang="th"] :is(.l-en, .l-zh, .l-lo):not(.l-th),
        html[lang="en"] :is(.l-th, .l-zh, .l-lo):not(.l-en),
        html[lang="zh-Hans"] :is(.l-th, .l-en, .l-lo):not(.l-zh),
        html[lang="lo"] :is(.l-th, .l-en, .l-zh):not(.l-lo) { display: none !important; }
        /* Lao has no glyphs in IBM Plex Sans Thai; Noto Sans Lao loads only when Lao is chosen */
        html[lang="lo"] { --font-display: "IBM Plex Sans Thai", "Noto Sans Lao", -apple-system, "Segoe UI", sans-serif; --font-body: "IBM Plex Sans Thai", "Noto Sans Lao", -apple-system, "Segoe UI", sans-serif; }
        html[lang="zh-Hans"] { --font-display: "IBM Plex Sans Thai", -apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", "Segoe UI", sans-serif; --font-body: "IBM Plex Sans Thai", -apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", "Segoe UI", sans-serif; }
        /* Each USP phrase is its own line, so no separator is ever left dangling on a line of its own */
        .marquee .nb { display: block; white-space: normal; }
        .marquee { display: flex; align-items: center; gap: var(--space-3); background: var(--brand-plum); color: var(--color-paper); border-bottom: 1px solid var(--color-ink); padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4); font-size: var(--text-sm); font-weight: 600; line-height: 1.5; }
        .marquee-text { flex: 1; min-width: 0; text-align: center; text-wrap: balance; }
        /* Language cells: each language named in its own script, so a visitor who can't read Thai still finds theirs */
        .lang-row { display: grid; grid-template-columns: repeat(4, 1fr); border-bottom: 1px solid var(--color-ink); background: var(--color-paper); }
        .lang-cell { min-height: 48px; padding: var(--space-1) var(--space-2); font-size: var(--text-sm); font-weight: 600; line-height: 1.5; text-align: center; color: var(--color-muted); transition: background-color var(--dur) var(--ease-out), color var(--dur) var(--ease-out); }
        .lang-cell + .lang-cell { border-left: 1px solid var(--color-rule); }
        .lang-cell:hover { color: var(--color-ink); }
        /* Active language: a tab mark (plum text + 3px plum underline) on the cream row. A plum-filled cell joined the
           plum banner above and read as a bite out of the row. */
        html[lang="th"] .lang-cell[data-lang="th"], html[lang="en"] .lang-cell[data-lang="en"], html[lang="zh-Hans"] .lang-cell[data-lang="zh"], html[lang="lo"] .lang-cell[data-lang="lo"] { background: var(--color-paper); color: var(--brand-plum); box-shadow: inset 0 -3px 0 var(--brand-plum); }
        /* Masthead: brand cell | live status cell */
        .masthead { display: grid; grid-template-columns: auto minmax(0, 1fr); }
        .brand { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4); min-width: 0; }
        .logo-box { width: 48px; height: 48px; flex-shrink: 0; border: 1px solid var(--color-ink); object-fit: contain; background: var(--brand-plum); }
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
        .fact-label { font-size: var(--text-xs); color: var(--color-label); }
        .fact-val { font-size: var(--text-md); font-weight: 600; line-height: 1.4; display: flex; align-items: center; gap: var(--space-2); }
        .dot { width: 8px; height: 8px; flex-shrink: 0; background: var(--color-accent-2); }
        .dot.closed { background: var(--color-neutral); }
        .kitchen-note { font-size: var(--text-xs); font-weight: 600; color: var(--color-ink); line-height: 1.4; }
        .loc-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
        .loc-map-btn { flex-shrink: 0; min-height: 48px; padding: var(--space-2) var(--space-4); background: var(--brand-plum); color: var(--color-paper); font-size: var(--text-sm); font-weight: 600; border-radius: var(--radius); display: inline-flex; align-items: center; gap: var(--space-2); white-space: nowrap; transition: background-color var(--dur) var(--ease-out); }
        .loc-map-btn:hover { background: var(--brand-plum-2); }
        .loc-more summary { font-size: var(--text-xs); color: var(--color-muted); cursor: pointer; margin-top: var(--space-1); width: fit-content; }
        .loc-more p { font-size: var(--text-sm); color: var(--color-muted); margin-top: var(--space-1); line-height: 1.6; }

        /* Location-first banner (utm_content = location / map / naga) */
        .loc-hero { background: var(--brand-plum); color: var(--color-paper); padding: var(--space-4); border-bottom: 1px solid var(--color-ink); display: flex; flex-direction: column; gap: var(--space-2); }
        .loc-hero[hidden] { display: none; }
        .loc-hero-title { font-family: var(--font-display); font-size: var(--text-2xl); font-weight: 700; line-height: 1.3; }
        .loc-hero-sub { font-size: var(--text-sm); font-weight: 500; }
        .loc-hero-btn { margin-top: var(--space-1); min-height: 48px; display: flex; align-items: center; justify-content: center; gap: var(--space-2); background: var(--action-primary); color: var(--on-action); font-size: var(--text-lg); font-weight: 600; border-radius: var(--radius); }

        /* First-time set chooser: the page's one dark field, so the first decision is read first.
         * Inside it the starter set is a light card with a large photo; the other sets are dark tiles. */
        .sets { background: var(--color-field); color: var(--color-paper); padding-bottom: var(--space-2); }
        .sets-head { padding: var(--space-6) var(--space-4) var(--space-5); }
        /* Wide screens: a typographic mark fills the empty right column of the set block head, on the same grid
           (24px gutter, top aligned with the headline). Phones keep the headline full width, no mark. */
        .sets-mark { display: none; }
        @media (min-width: 540px) {
            .sets-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: var(--space-6); align-items: start; }
            .sets-head > :not(.sets-mark) { grid-column: 1; justify-self: start; }
            /* Two rows on the headline's own line grid (SOV_monomon 36px, line-height 1.3), so THAI sits on the
               baseline of "เพิ่งมาครั้งแรก?" and รสใต้ on the baseline of "เลือกชุดตามจำนวนคน". */
            .sets-mark { display: block; grid-column: 2; grid-row: 1; text-align: right; font-family: var(--font-display); font-size: 36px; line-height: 1.3; }
            .sets-mark-row { display: block; }
            .sets-mark-en { display: inline-block; font-family: var(--font-mono); font-size: var(--text-sm); font-weight: 500; line-height: 1; letter-spacing: 0.2em; color: var(--on-plum-2); padding: var(--space-1) calc(var(--space-3) - 0.2em) var(--space-1) var(--space-3); border: 1.5px solid currentColor; border-radius: 999px; }
            .sets-mark-th { color: var(--color-paper); }
        }
        .sets-title { font-family: var(--font-display); font-size: 30px; font-weight: 700; line-height: 1.3; letter-spacing: -0.01em; }
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
        .set-row .set-tag { background: var(--color-paper); color: var(--brand-plum); }
        .set-tag { display: inline-block; margin-left: var(--space-2); padding: 0 var(--space-2); font-size: var(--text-xs); font-weight: 600; line-height: 22px; vertical-align: 2px; color: var(--color-paper); background: var(--color-accent); border-radius: var(--radius); white-space: nowrap; }
        .set-dishes { font-size: var(--text-sm); color: var(--color-on-ink-2); line-height: 1.6; margin-top: var(--space-1); }
        .set-price { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: var(--space-1); }
        .set-price .num { font-size: var(--text-xl); font-weight: 600; line-height: 1.2; }
        .set-pp { font-size: var(--text-xs); color: var(--color-on-ink-2); white-space: nowrap; }
        .set-ctas { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 2px; padding: var(--space-4) var(--space-4) 0; }
        .set-btn { min-height: 52px; display: flex; align-items: center; justify-content: center; gap: var(--space-2); font-size: var(--text-lg); font-weight: 700; white-space: nowrap; border-radius: var(--radius); background: var(--color-field-2); color: var(--color-paper); transition: background-color var(--dur) var(--ease-out), transform var(--dur) var(--ease-out); }
        .set-btn:hover { background: var(--color-field-3); }
        .set-btn:active { transform: scale(0.98); }
        .set-btn.primary { background: var(--color-signal); color: var(--on-action); }
        .set-btn.primary:hover { background: var(--color-signal-2); }
        .set-more { padding: var(--space-4) var(--space-4) var(--space-3); font-size: var(--text-sm); color: var(--color-on-ink-2); display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-1) var(--space-3); }
        .set-more a { color: var(--color-paper); font-weight: 600; text-decoration: underline; text-decoration-color: var(--color-field-3); text-underline-offset: 3px; white-space: nowrap; transition: text-decoration-color var(--dur) var(--ease-out); }
        .set-more a:hover { text-decoration-color: var(--color-paper); }
        @media (min-width: 480px) { .sets-title { font-size: 36px; } }
        @media (prefers-reduced-motion: no-preference) {
            /* Only when the guest switches tabs: the first paint (and the LCP photo inside it) is never faded in */
            .set-panel.entering:not([hidden]) { animation: set-in 180ms var(--ease-out); }
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
        .row-link.ink { background: var(--brand-plum); color: var(--color-paper); }
        .row-link.ink:hover { background: var(--brand-plum-2); }
        .row-link.ink .arrow, .row-link.ink .row-sub { color: var(--on-plum-2); }
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
        /* Section index: sticky, follows the scroll (one page, no hidden panels) */
        .tab-bar { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid var(--color-rule); border-bottom: 1px solid var(--color-rule); background: var(--color-paper); position: sticky; top: 0; z-index: var(--z-sticky); }
        .tab-btn { min-height: 48px; padding: var(--space-3) var(--space-2); font-size: var(--text-md); font-weight: 600; text-align: center; color: var(--color-muted); box-shadow: inset 0 0 0 var(--color-ink); transition: background-color var(--dur) var(--ease-out), color var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out); }
        .tab-btn + .tab-btn { border-left: 1px solid var(--color-rule); }
        .tab-btn:hover { background: var(--color-paper-2); }
        .tab-btn.active { color: var(--color-ink); }
        /* One marker slides between the three equal cells (--tab-i is set by markSection) */
        .tab-bar::after { content: ''; position: absolute; left: 0; bottom: 0; width: calc(100% / 3); height: 3px; background: var(--color-ink); transform: translateX(calc(var(--tab-i, 0) * 100%)); transition: transform 180ms var(--ease-out); pointer-events: none; }

        /* Section heads */
        .section-header { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-3); padding: var(--space-6) var(--space-4) var(--space-3); border-bottom: 1px solid var(--color-rule); }
        .section-header.sub { padding: var(--space-4) var(--space-4) var(--space-2); background: var(--color-paper-2); }
        .section-title { font-family: var(--font-display); font-size: var(--text-2xl); font-weight: 700; line-height: 1.3; letter-spacing: -0.01em; }
        /* Category index for the full menu: sticks under the section strip, scrolls sideways */
        .cat-index { position: sticky; top: 49px; z-index: calc(var(--z-sticky) - 1); display: flex; gap: var(--space-2); overflow-x: auto; scrollbar-width: none; padding: var(--space-2) var(--space-4); background: var(--color-paper); border-bottom: 1px solid var(--color-rule); }
        .cat-index::-webkit-scrollbar { display: none; }
        .cat-chip { flex-shrink: 0; min-height: 36px; padding: 0 var(--space-3); border: 1px solid var(--color-rule); border-radius: var(--radius); font-size: var(--text-sm); font-weight: 600; white-space: nowrap; transition: background-color var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out), transform var(--dur) var(--ease-out); }
        .cat-chip:hover { border-color: var(--color-ink); }
        .cat-chip[aria-current="true"] { background: var(--color-ink); border-color: var(--color-ink); color: var(--color-paper); }
        .cat-chip:active { transform: scale(0.96); }
        #full-menu-content .section-header.sub { scroll-margin-top: 104px; }
        .section-header.sub .section-title { font-size: var(--text-xl); }
        .section-meta { font-size: var(--text-xs); color: var(--color-label); white-space: nowrap; }

        /* Food cards (owner 2026-11-24): photo, the taste word behind the dish, the dish cut-out in front.
           Native scroll-snap strip; the next card peeks so people know to swipe. Positions are % of the 1080x1446 card. */
        .fc { border-bottom: 1px solid var(--color-rule); padding: var(--space-4) 0; }
        .fc-strip { display: flex; gap: var(--space-2); overflow-x: auto; scroll-snap-type: x mandatory; padding: 0 var(--space-4); scroll-padding: 0 var(--space-4); scrollbar-width: none; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; }
        .fc-strip::-webkit-scrollbar { display: none; }
        .fc-card { position: relative; flex: 0 0 82%; max-width: 380px; aspect-ratio: 1080 / 1446; margin: 0; overflow: hidden; scroll-snap-align: start; background: var(--charcoal-2); contain: layout paint; }
        .fc-scene { position: absolute; inset: 0; }
        .fc-scene img, .fc-word, .fc-word img, .fc-logo { position: absolute; display: block; max-width: none; }
        .fc-photo, .fc-dish { left: 0; width: 100%; height: auto; }
        .fc-word { left: 0; top: 0; width: 100%; overflow: hidden; }
        .fc-cap { position: absolute; margin: 0; max-width: 62%; color: var(--cream); font-size: var(--text-md); font-weight: 500; line-height: 1.35; text-shadow: 0 1px 8px oklch(21.78% 0 0 / 0.45); }
        .fc-nb { white-space: nowrap; }
        .fc-vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

        /* Menu rows */
        .item-row { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-rule); }
        .item-row.zoomable { cursor: zoom-in; }
        .item-info { flex: 1; min-width: 0; }
        .item-name { font-size: var(--text-md); font-weight: 600; line-height: 1.45; }
        .item-name-th { display: block; font-size: var(--text-xs); font-weight: 400; color: var(--color-label); }
        .item-desc { font-size: var(--text-sm); color: var(--color-muted); margin-top: 2px; line-height: 1.55; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
        .modifier-tag { display: inline-block; font-size: var(--text-xs); font-weight: 600; padding: 0 var(--space-2); border: 1px solid var(--color-rule); border-radius: var(--radius); background: var(--color-paper-2); margin-bottom: 2px; }
        .item-price { font-size: var(--text-md); font-weight: 600; margin-top: var(--space-1); }
        .item-row .heat { margin-top: var(--space-1); }
        .item-thumb { width: 64px; height: 64px; object-fit: cover; border: 1px solid var(--color-rule); flex-shrink: 0; background: var(--color-paper-2); }
        /* Full menu: the main way into all dishes, so a full-width ink block rather than a quiet row */
        .full-menu-btn { width: 100%; min-height: 64px; padding: var(--space-4); display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); text-align: left; font-size: var(--text-lg); font-weight: 700; line-height: 1.35; background: var(--brand-plum); color: var(--color-paper); transition: background-color var(--dur) var(--ease-out), transform var(--dur) var(--ease-out); }
        .full-menu-btn:hover { background: var(--brand-plum-2); }
        .full-menu-btn:active { transform: scale(0.99); }
        .full-menu-sub { display: block; font-size: var(--text-xs); font-weight: 400; color: var(--color-on-ink-2); margin-top: 2px; }
        .full-menu-btn .arrow { font-size: var(--text-xl); color: var(--color-paper); }
        .full-menu-btn.open { background: var(--color-paper-2); color: var(--color-ink); border-bottom: 1px solid var(--color-rule); }
        .full-menu-btn.open .arrow { color: var(--color-ink); }
        .full-menu-btn.open .full-menu-sub { display: none; }
        .full-menu-status { padding: var(--space-4); font-size: var(--text-sm); color: var(--color-muted); }
        .full-menu-retry { min-height: 44px; margin-left: var(--space-2); padding: 0 var(--space-3); font-weight: 600; color: var(--color-ink); border: 1px solid var(--color-ink); border-radius: var(--radius); }

        /* Opening hours: large figures + live state, readable at a glance */
        .hours-fact { gap: var(--space-1); padding-top: var(--space-4); padding-bottom: var(--space-4); }
        .hours-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
        .hours-main { font-size: 28px; font-weight: 700; line-height: 1.3; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
        .hours-note { font-size: var(--text-md); font-weight: 600; color: var(--color-ink); line-height: 1.4; }
        .hours-state { display: inline-flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); font-weight: 600; white-space: nowrap; }
        .hours-state::before { content: ""; width: 8px; height: 8px; background: var(--color-accent-2); }
        .hours-state.closed { color: var(--color-muted); }
        .hours-state.closed::before { background: var(--color-neutral); }
        /* Live countdown: each digit is a 0-9 strip that slides, no library, no layout shift */
        /* Open time · timeline · close time. The line between them is the day: ink up to now, accent tick at last order */
        .hours-grid { display: grid; grid-template-columns: auto minmax(40px, 1fr) auto; column-gap: var(--space-3); row-gap: var(--space-1); align-items: center; margin-top: var(--space-2); }
        .hg-label { font-size: var(--text-sm); font-weight: 600; color: var(--color-muted); line-height: 1.4; }
        .hg-label.hg-end { grid-column: 3; }
        .hg-end { text-align: right; }
        .hg-time { font-size: clamp(36px, 10.5vw, 52px); font-weight: 700; line-height: 1; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; color: var(--color-ink); }
        .hours-line { position: relative; height: 14px; }
        .hours-line::before { content: ""; position: absolute; left: 0; right: 0; top: 6px; height: 2px; background: var(--color-rule); }
        .hl-fill { position: absolute; left: 0; right: 0; top: 6px; height: 2px; background: var(--color-ink); transform-origin: left center; transform: scaleX(var(--p, 0)); transition: transform 180ms var(--ease-out); }
        .hl-last { position: absolute; top: 3px; left: calc(var(--l, 0) * 100%); width: 2px; height: 8px; margin-left: -1px; background: var(--color-muted); }
        .hl-now { position: absolute; inset: 0; transform: translateX(calc(var(--p, 0) * 100%)); transition: transform 180ms var(--ease-out); opacity: 0; }
        .hl-now > span { position: absolute; left: -1px; top: 0; width: 2px; height: 14px; background: var(--color-ink); }
        .hours-line.live .hl-now { opacity: 1; }
        .hours-line.closed .hl-fill, .hours-line.closed .hl-now { opacity: 0; }
        .hours-count { display: flex; align-items: baseline; flex-wrap: wrap; gap: 2px var(--space-2); margin-top: var(--space-2); font-size: var(--text-md); color: var(--color-muted); line-height: 1.4; }
        .hc-time { display: inline-flex; align-items: flex-end; font-size: 22px; font-weight: 700; color: var(--color-ink); font-variant-numeric: tabular-nums; line-height: 1; letter-spacing: -0.01em; }
        .hc-d { display: inline-block; height: 1em; overflow: hidden; }
        .hc-strip { display: flex; flex-direction: column; transition: transform 180ms var(--ease-out); }
        .hc-strip > span { display: block; height: 1em; line-height: 1; text-align: center; }
        .hc-sep { padding: 0 1px; transform: translateY(-0.04em); }
        .hours-count[hidden] { display: none; }
        .hc-unit { font-size: var(--text-md); font-weight: 600; color: var(--color-ink); }
        .hc-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

        /* Galleries */
        .gallery-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-bottom: 1px solid var(--color-rule); }
        .gallery-item { aspect-ratio: 1 / 1; overflow: hidden; position: relative; cursor: zoom-in; background: var(--color-paper-2); border-bottom: 1px solid var(--color-rule); }
        .gallery-item:nth-child(2n) { border-left: 1px solid var(--color-rule); }
        .gallery-item img { width: 100%; height: 100%; object-fit: cover; }
        .gallery-caption { position: absolute; inset: auto 0 0 0; padding: var(--space-2) var(--space-3); background: oklch(14% 0.010 28 / 0.78); color: var(--color-paper); font-size: var(--text-xs); line-height: 1.45; pointer-events: none; }
        .gallery-caption .caption-text { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

        /* Tags + footer (Ft4 dense colophon) */
        .tags-wrap { padding: var(--space-4); display: flex; flex-wrap: wrap; gap: var(--space-2); border-bottom: 1px solid var(--color-rule); }
        .tag-pill { padding: 2px var(--space-2); font-size: var(--text-xs); color: var(--color-muted); border: 1px solid var(--color-rule); border-radius: var(--radius); }
        footer { padding: var(--space-6) var(--space-4) var(--space-8); display: flex; flex-direction: column; gap: var(--space-2); background: var(--color-paper); }
        .footer-brand { font-size: var(--text-md); font-weight: 700; }
        .footer-sub { font-size: var(--text-sm); color: var(--color-muted); }
        .footer-seo { font-size: var(--text-xs); line-height: 1.7; color: var(--color-muted); max-width: 46ch; }
        .footer-copy { font-family: var(--font-mono); font-size: 12px; color: var(--color-label); letter-spacing: 0.04em; text-transform: uppercase; padding-top: var(--space-2); border-top: 1px solid var(--color-rule); }

        /* C4 sticky bar: full-width tabular cells */
        .sticky-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: var(--z-bar); background: var(--color-paper); border-top: 1px solid var(--color-ink); padding-bottom: env(safe-area-inset-bottom); }
        .sticky-inner { max-width: 560px; margin: 0 auto; display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 0.7fr) minmax(0, 0.9fr); }
        .sticky-btn { min-height: var(--bar-h); padding: var(--space-2) var(--space-3); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; font-size: var(--text-md); font-weight: 600; line-height: 1.25; white-space: nowrap; transition: background-color var(--dur) var(--ease-out); }
        .sticky-btn + .sticky-btn { border-left: 1px solid var(--color-rule); }
        .sticky-btn:hover { background: var(--color-paper-2); }
        .sticky-btn.map { background: var(--action-primary); color: var(--on-action); }
        .sticky-btn.map:hover { background: var(--action-primary-hover); }
        .sticky-btn.line { background: var(--color-line); color: var(--color-paper); }
        .sticky-btn.line:hover { background: var(--color-line-2); }
        .sticky-sub { font-size: 12px; font-weight: 400; color: oklch(77.97% 0.0133 345.58); /* dark-muted, 8.63:1 on charcoal */ white-space: normal; line-height: 1.3; }

        /* Modals */
        .modal { display: none; position: fixed; inset: 0; z-index: var(--z-modal); background: var(--color-scrim); align-items: center; justify-content: center; padding: var(--space-4); }
        .modal.open { display: flex; }
        .modal-content { max-width: 92vw; max-height: 82vh; object-fit: contain; }
        .modal-close { position: absolute; top: var(--space-4); right: var(--space-4); min-height: 40px; padding: var(--space-2) var(--space-4); font-size: var(--text-md); font-weight: 600; color: var(--color-paper); border: 1px solid var(--color-paper); border-radius: var(--radius); }
        .modal-stack { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); max-width: 92vw; }
        .booklet-nav { display: flex; align-items: center; gap: var(--space-4); color: var(--color-paper); font-size: var(--text-sm); }
        .booklet-nav button { min-height: 40px; padding: var(--space-2) var(--space-3); color: var(--color-paper); font-weight: 600; border: 1px solid var(--color-muted); border-radius: var(--radius); }

        /* Press feedback: everything tappable answers the thumb */
        .row-link, .sticky-btn, .item-row.zoomable, .gallery-item, .tab-btn, .loc-map-btn, .set-tab, .lang-cell { transition-property: background-color, color, box-shadow, transform; transition-duration: var(--dur); transition-timing-function: var(--ease-out); }
        /* Press lands fast (90ms) and lets go at the normal speed, so the thumb feels it */
        .row-link:active, .sticky-btn:active, .item-row.zoomable:active, .tab-btn:active, .loc-map-btn:active, .set-tab:active, .lang-cell:active { transform: scale(0.97); transition-duration: 90ms; }
        /* Full-width buttons keep their gentler scale (0.97 of 560px is too big a jump), but land as fast */
        .set-btn:active, .full-menu-btn:active { transition-duration: 90ms; }
        .gallery-item img { transition: transform 600ms var(--ease-out), opacity 180ms var(--ease-out); }
        /* Hover zoom only where there is a real hover; on phones it fired after a tap */
        @media (hover: hover) { .gallery-item:hover img { transform: scale(1.04); } }
        /* Photos still loading fade in on arrival over the paper-2 placeholder (class is added by script only) */
        .gallery-item img.img-wait { opacity: 0; }
        .row-link:hover .arrow { transform: translateX(3px); }
        .row-link .arrow { transition: transform var(--dur) var(--ease-out); }

        /* Modals fade in, the picture settles */
        /* The picture is handed up to you (rise, not zoom) */
        .modal.open { animation: modal-in 180ms var(--ease-out); }
        .modal.open .modal-content { animation: modal-pic 180ms var(--ease-out); }
        @keyframes modal-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modal-pic { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        /* Closing is quicker and quieter than opening; hideModal() drops the class after 120ms */
        .modal.closing { display: flex; pointer-events: none; animation: modal-out 120ms cubic-bezier(0.4, 0, 1, 1) forwards; }
        .modal.closing .modal-content { animation: modal-pic-out 120ms cubic-bezier(0.4, 0, 1, 1) forwards; }
        @keyframes modal-out { to { opacity: 0; } }
        @keyframes modal-pic-out { to { opacity: 0; transform: translateY(8px); } }

        /* Reveal on scroll: added by script only to things below the first screen, so nothing is hidden without JS and the first paint is untouched */
        .reveal { opacity: 0; transform: translateY(8px); }
        .reveal.in { opacity: 1; transform: none; transition: opacity 180ms var(--ease-out), transform 180ms var(--ease-out); transition-delay: var(--d, 0ms); }
        #full-menu-content.opening { animation: menu-open 360ms var(--ease-out); }
        @keyframes menu-open { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
        /* Closing folds the menu up so what follows slides into place instead of jumping (height is set by toggleFullMenu) */
        #full-menu-content.closing { overflow: clip; opacity: 0; transition: height 250ms var(--ease-out), opacity 250ms var(--ease-out); }

        @media (prefers-reduced-motion: reduce) { * { transition-duration: 0ms !important; animation-duration: 0ms !important; scroll-behavior: auto !important; } .reveal { opacity: 1; transform: none; } }
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
            // Staff devices (marked by the React app on /admin, /staff, /pos) never load GTM,
            // so their visits to /link are not counted in GA4 / Google Ads. ?internal=off clears it.
            let isInternal = false;
            try {
                if (new URLSearchParams(window.location.search).get('internal') === 'off') {
                    localStorage.removeItem('haus_internal');
                } else {
                    isInternal = localStorage.getItem('haus_internal') === '1';
                }
            } catch (e) {}
            window.loadGtm = function() {
                if (loaded || isInternal) return;
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

                // Otherwise load GTM in the first idle moment after the page has loaded (at most 1.5s
                // later), so it never competes with the first view. Kept short on purpose: an earlier
                // 3.5s idle wait lost conversions on mobile, because a quick tap on "นำทาง" / LINE / โทร
                // hands off to the Maps/LINE app before GTM arrives. Any touch or scroll loads it at once.
                // Bots are excluded above, so lab (Lighthouse) scores never include GTM either way.
                const scheduleGtm = function() {
                    if ('requestIdleCallback' in window) requestIdleCallback(window.loadGtm, { timeout: 1500 });
                    else setTimeout(window.loadGtm, 1000);
                };
                if (document.readyState === 'complete') {
                    scheduleGtm();
                } else {
                    window.addEventListener('load', scheduleGtm, { once: true });
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
        <div class="marquee"><p class="marquee-text">${tt(phrasesHtml(settings.link_usp || DEFAULT_SETTINGS.link_usp, '·', ' '), phrasesHtml(settings.link_usp_en || DEFAULT_SETTINGS.link_usp_en, '·', ' '), phrasesHtml(settings.link_usp_zh || DEFAULT_SETTINGS.link_usp_zh, '·', ' '), phrasesHtml(settings.link_usp_lo || DEFAULT_SETTINGS.link_usp_lo, '·', ' '))}</p></div>
        <div class="lang-row" role="group" aria-label="Language / ภาษา / 语言 / ພາສາ"><button type="button" class="lang-cell" data-lang="th" lang="th" onclick="setLang('th')">ไทย</button><button type="button" class="lang-cell" data-lang="en" lang="en" onclick="setLang('en')">English</button><button type="button" class="lang-cell" data-lang="zh" lang="zh-Hans" onclick="setLang('zh')">中文</button><button type="button" class="lang-cell" data-lang="lo" lang="lo" onclick="setLang('lo')">ລາວ</button></div>

        <header class="masthead">
            <div class="brand">
                <img src="${optImg(logoUrl, 120, 80)}" alt="${shopName}" class="logo-box" width="48" height="48">
                <h1 class="shop-name"><span class="shop-title">${escapeHtml(mastTitle)}</span><span class="shop-sub">${escapeHtml(mastSub)}</span></h1>
            </div>
            <!-- Live status: can I go now? -->
            <div class="status-cell" aria-live="polite">
                <span class="fact-val" id="open-status" data-hours="${hours}"><span class="dot"></span> ${tt('เปิดทุกวัน', 'Open daily')}</span>
                <span class="fact-note nb" id="status-hours">${tt(hoursMain, hoursMainEn, hoursMainEn, hoursMainEn)}</span>
                <span class="kitchen-note" id="kitchen-note" hidden></span>
            </div>
        </header>

        <main id="main">

        <!-- Location-first banner: rendered only when utm_content says the ad sold the location -->
        ${locationFirst ? `<section class="loc-hero" id="loc-hero">
            <div class="loc-hero-title">${tt(directionsSub, directionsSubEn, directionsSubZh, directionsSubLo)}</div>
            <div class="loc-hero-sub">${tt('ริมโขง · ไม่ต้องจองก็มาได้ · มีที่จอดรถ', 'By the Mekong · Walk-ins welcome · Parking')}</div>
            <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="loc-hero-btn" onclick="handleDirectionsClick(event)">${tt('นำทางมาร้าน', 'Get directions')} <span class="arrow">→</span></a>
        </section>` : ''}

        ${setGroups.length > 0 ? `
        <!-- First-time set chooser: every set, grouped by party size; walk-in first, booking optional -->
        <section class="sets" id="starter-card" data-lunch="${lunchWindow}" data-default="${escapeHtml(defaultGroup)}" aria-labelledby="sets-title">
            <div class="sets-head">
                <h2 class="sets-title" id="sets-title">${tt('<span class="nb">เพิ่งมาครั้งแรก?</span> <span class="nb">เลือกชุดตามจำนวนคน</span>', '<span class="nb">First time here?</span> <span class="nb">Pick a set for your group</span>')}</h2>
                <p class="sets-walkin">${tt('ไม่ต้องจองก็มาได้ · walk-in ได้เลย มีที่จอดรถ', 'No booking needed · walk in anytime · parking')}</p>
                <a href="#btn-full-menu" class="sets-menu-link" onclick="jumpToFullMenu(event)">${tt(`หรือดูเมนูทั้งหมด ${menuItems.length} รายการ`, `Or see the full menu · ${menuItems.length} items`, `或查看完整菜单 · ${menuItems.length} 项`, `ຫຼື ເບິ່ງເມນູທັງໝົດ ${menuItems.length} ລາຍການ`)} <span class="arrow">↓</span></a>
                <div class="sets-mark" aria-hidden="true"><span class="sets-mark-row"><span class="sets-mark-en">THAI</span></span><span class="sets-mark-row"><span class="sets-mark-th">รสใต้</span></span></div>
            </div>
            ${setGroups.length > 1 ? `
            <div class="set-tabs" role="tablist" aria-label="มากี่คน">
                ${setGroups.map(g => `<button type="button" class="set-tab" role="tab" id="set-tab-${g.min}" aria-controls="set-panel-${g.min}" aria-selected="${g.key === initialGroup}" data-group="${g.key}" onclick="selectSetGroup('${g.key}')"><span class="set-tab-label">${tt(`${g.key} คน`, peopleEn(g.key), `${g.key} 人`, `${g.key} ຄົນ`)}</span><span class="set-tab-count">${tt(`${g.rows.length} ชุด`, `${g.rows.length} sets`, `${g.rows.length} 款套餐`, `${g.rows.length} ຊຸດ`)}</span></button>`).join('')}
            </div>` : ''}
            ${setGroups.map(g => `
            <div class="set-panel" role="tabpanel" id="set-panel-${g.min}" aria-labelledby="set-tab-${g.min}" data-group="${g.key}"${g.key === initialGroup ? '' : ' hidden'}>
                ${g.rows.map((r, i) => i === 0 ? `
                <article class="set-feature">
                    ${r.feature ? `<img class="set-feature-img" src="${r.feature}" srcset="${r.featureSm} 480w, ${r.feature} 720w" sizes="${SET_FEATURE_SIZES}" alt="${escapeHtml(r.title)}" width="720" height="450" loading="${g.key === initialGroup ? 'eager' : 'lazy'}"${g.key === initialGroup ? ' fetchpriority="high"' : ''} decoding="async" onclick="openLightbox('${r.bigImg}')">` : ''}
                    <div class="set-feature-body">
                        <div class="set-feature-top">
                            <h3 class="set-name">${tt(setTitleHtml(r.title), setTitleHtml(r.titleEn), r.titleZh && setTitleHtml(r.titleZh), r.titleLo && setTitleHtml(r.titleLo))}${r.starter ? `<span class="set-tag">${tt('เริ่มที่ชุดนี้', 'Start here')}</span>` : ''}</h3>
                            <div class="set-price">
                                <span class="num">฿${r.price}</span>
                                ${r.perPerson ? `<span class="set-pp">${tt(escapeHtml(r.perPerson), escapeHtml(r.perPersonEn), escapeHtml(r.perPersonZh), escapeHtml(r.perPersonLo))}</span>` : ''}
                            </div>
                        </div>
                        <div class="set-dishes">${tt(phrasesHtml(r.dishes, '•', ' • '), phrasesHtml(r.dishesEn, '•', ' • '), r.dishesZh && phrasesHtml(r.dishesZh, '•', ' • '), r.dishesLo && phrasesHtml(r.dishesLo, '•', ' • '))}</div>
                        ${r.heat}
                    </div>
                </article>` : `
                <div class="set-row">
                    ${r.thumb ? `<img class="set-thumb" src="${r.thumb}" alt="${escapeHtml(r.title)}" width="64" height="64" loading="${g.key === initialGroup ? 'eager' : 'lazy'}" decoding="async" onclick="openLightbox('${r.bigImg}')">` : '<span class="set-thumb-empty" aria-hidden="true"></span>'}
                    <div class="set-name">${tt(setTitleHtml(r.title), setTitleHtml(r.titleEn), r.titleZh && setTitleHtml(r.titleZh), r.titleLo && setTitleHtml(r.titleLo))}${r.starter ? `<span class="set-tag">${tt('เริ่มที่ชุดนี้', 'Start here')}</span>` : ''}</div>
                    <div class="set-price">
                        <span class="num">฿${r.price}</span>
                        ${r.perPerson ? `<span class="set-pp">${tt(escapeHtml(r.perPerson), escapeHtml(r.perPersonEn), escapeHtml(r.perPersonZh), escapeHtml(r.perPersonLo))}</span>` : ''}
                    </div>
                    <div class="set-row-body">
                        <div class="set-dishes">${tt(phrasesHtml(r.dishes, '•', ' • '), phrasesHtml(r.dishesEn, '•', ' • '), r.dishesZh && phrasesHtml(r.dishesZh, '•', ' • '), r.dishesLo && phrasesHtml(r.dishesLo, '•', ' • '))}</div>
                        ${r.heat}
                    </div>
                </div>`).join('')}
            </div>`).join('')}
            <div class="set-ctas">
                <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="set-btn primary" onclick="handleStarterClick(event, 'directions')">${tt('นำทางมาร้าน', 'Get directions')}</a>
                <a href="tel:+66985284217" class="set-btn" onclick="handleStarterClick(event, 'call')">${tt('โทรสอบถาม', 'Call us')}</a>
            </div>
            <div class="set-more">
                <span>${tt('อยากได้โต๊ะแน่นอน?', 'Want a table for sure?')}</span>
                <a href="/booking" onclick="handleStarterClick(event, 'booking')">${tt('จองล่วงหน้า', 'Book ahead')}</a>
                <a href="/pickup" onclick="handleStarterClick(event, 'pickup')">${tt('สั่งรับหน้าร้าน', 'Order for pickup')}</a>
            </div>
        </section>` : `
        <div class="quick-grid">
            <a href="/booking" class="quick-btn" id="btn-quick-booking" onclick="handleBookingClick(event)">${tt('จองโต๊ะ', 'Book a table')} <span class="arrow">→</span></a>
            <a href="/pickup" class="quick-btn" id="btn-quick-pickup" onclick="handlePickupClick(event)">${tt('สั่งรับหน้าร้าน', 'Order for pickup')} <span class="arrow">→</span></a>
        </div>`}

        <!-- Facts: status · hours · location -->
        <div class="facts">
            <div class="fact wide hours-fact">
                <div class="hours-head">
                    <span class="fact-label">${tt('เวลาเปิด-ปิด · ทุกวัน', 'Opening hours · daily')}</span>
                    <span class="hours-state" id="hours-state" hidden></span>
                </div>
                ${hoursSplit ? `<div class="hours-grid">
                    <span class="hg-label">${tt('เปิด', 'Opens')}</span>
                    <span class="hg-label hg-end">${tt('ปิด', 'Closes')}</span>
                    <span class="hg-time">${hoursSplit[1]}</span>
                    <span class="hours-line" id="hours-line" aria-hidden="true"><span class="hl-fill"></span><span class="hl-last"></span><span class="hl-now"><span></span></span></span>
                    <span class="hg-time hg-end">${hoursSplit[2]}</span>
                </div>` : `<span class="hours-main nb">${tt(hoursMain, hoursMainEn, hoursMainEn, hoursMainEn)}</span>`}
                ${hoursNote ? `<span class="hours-note nb">${tt(hoursNote, hoursNoteEn, hoursNoteZh, hoursNoteLo)}</span>` : ''}
                <span class="hours-count" id="hours-count" hidden>
                    <span class="hc-label"></span>
                    <span class="hc-time" aria-hidden="true"></span>
                    <span class="hc-unit" aria-hidden="true" hidden></span>
                    <span class="hc-sr" role="status"></span>
                </span>
            </div>
            <div class="fact full">
                <span class="fact-label">${tt('ที่ตั้ง', 'Location')}</span>
                <div class="loc-row">
                    <span class="fact-val flow">${tt(locationShortHtml, locationShortEnHtml, locationShortZhHtml, locationShortLoHtml)}</span>
                    <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="loc-map-btn" onclick="handleDirectionsClick(event)">${tt('แผนที่', 'Map')} <span class="arrow">→</span></a>
                </div>
                <details class="loc-more">
                    <summary>${tt('วิธีมาที่ร้าน', 'How to get here')}</summary>
                    <p>${tt(locationText, locationTextEn, locationTextZh, locationTextLo)}</p>
                </details>
            </div>
        </div>

        <a href="/link/hauscheckin" class="row-link slip" onclick="trackClick('click_checkin_board', '/link/hauscheckin')">
            <span class="row-main"><span class="dot"></span><span>${tt('รูปจากลูกค้าจริง', 'Real guest photos')}<span class="row-sub">${tt('บอร์ดเช็กอินของลูกค้าที่มาร้าน', 'Check-in wall from our guests')}</span></span></span>
            <span class="arrow">→</span>
        </a>

        <!-- Tab strip -->
        <div class="tab-bar" role="tablist">
            <button type="button" class="tab-btn active" id="tab-btn-menu" role="tab" aria-selected="true" aria-controls="sec-menu" onclick="switchSection('menu')">${tt('เมนู', 'Menu')}</button>
            <button type="button" class="tab-btn" id="tab-btn-vibe" role="tab" aria-selected="false" aria-controls="sec-vibe" onclick="switchSection('vibe')">${tt('บรรยากาศ', 'Atmosphere')}</button>
            <button type="button" class="tab-btn" id="tab-btn-connect" role="tab" aria-selected="false" aria-controls="sec-connect" onclick="switchSection('connect')">${tt('ติดต่อ', 'Contact')}</button>
        </div>

        <!-- ─── SECTION 1: MENU ─── -->
        <div id="sec-menu">
            <div class="section-header">
                <h2 class="section-title">${tt('จานเด่นของร้าน', 'Signature dishes')}</h2>
                <span class="section-meta">${tt('ปัดดูได้ 9 จาน', 'Swipe through 9 dishes', '滑动查看 9 道菜', 'ປັດເບິ່ງໄດ້ 9 ຈານ')}</span>
            </div>
            <section class="fc" aria-label="${escapeHtml('จานเด่นของร้าน')}">
                <div class="fc-strip">${renderFoodCards(fcLoading)}</div>
            </section>

            ${bookletImages.length > 0 ? `
            <button type="button" class="row-link as-button" onclick="openBooklet()">
                <span class="row-main">
                    <img src="${optImg(bookletImages[0], 120)}" alt="" class="row-thumb" width="44" height="44" loading="lazy">
                    <span>${tt('เปิดดูเมนูแบบเล่ม', 'Browse the printed menu')}<span class="row-sub">${tt(`เมนูเล่มจริงของร้าน ${bookletImages.length} หน้า`, `Our menu book · ${bookletImages.length} pages`, `本店的纸质菜单 · ${bookletImages.length} 页`, `ເມນູເຫຼັ້ມແທ້ຂອງຮ້ານ ${bookletImages.length} ໜ້າ`)}</span></span>
                </span>
                <span class="arrow">→</span>
            </button>` : ''}

            ${recommendedItems.length > 0 ? `
            <div class="section-header">
                <h2 class="section-title">${tt('เมนูแนะนำ', 'Recommended')}</h2>
                <span class="section-meta">${tt(`${recommendedItems.length} รายการ`, `${recommendedItems.length} items`, `${recommendedItems.length} 项`, `${recommendedItems.length} ລາຍການ`)}</span>
            </div>
            <div>
                ${recommendedItems.map(item => `
                <div class="item-row${item.image_url ? ' zoomable' : ''}"${item.image_url ? ` onclick="openLightbox('${optImg(item.image_url, 800)}')"` : ''}>
                    <div class="item-info">
                        <div class="item-name">${itemNameHtml(item)}</div>
                        ${itemDescHtml(item)}
                        <div class="item-price num">฿${escapeHtml(item.price)}</div>
                        ${heatHtml(item.spice)}
                    </div>
                    ${item.image_url ? `<img src="${optImg(item.image_url, 128)}" alt="${escapeHtml(item.name)}" class="item-thumb" loading="lazy" width="64" height="64">` : ''}
                </div>`).join('')}
            </div>` : ''}

            <button class="full-menu-btn" id="btn-full-menu" onclick="toggleFullMenu(true)"><span><span id="full-menu-label">${tt(`ดูเมนูทั้งหมด ${menuItems.length} รายการ`, `See the full menu · ${menuItems.length} items`, `查看完整菜单 · ${menuItems.length} 项`, `ເບິ່ງເມນູທັງໝົດ ${menuItems.length} ລາຍການ`)}</span><span class="full-menu-sub">${tt('ทุกหมวด พร้อมราคาและระดับความเผ็ด', 'Every category, with prices and spice levels')}</span></span><span class="arrow" id="full-menu-arrow">↓</span></button>
            <div id="full-menu-content" style="display:none;"></div>
        </div>

        <!-- ─── SECTION 2: ATMOSPHERE ─── -->
        <div id="sec-vibe">
            ${atmImages.length > 0 ? `
            <div class="section-header">
                <h2 class="section-title">${tt('บรรยากาศร้านริมโขง', 'By the Mekong')}</h2>
                <span class="section-meta">${tt(`${atmImages.length} รูป`, `${atmImages.length} photos`, `${atmImages.length} 张`, `${atmImages.length} ຮູບ`)}</span>
            </div>
            <div class="gallery-grid">
                ${atmImages.map((img, i) => `
                <div class="gallery-item" onclick="openLightbox('${optImg(img, 900)}')">
                    <img src="${optImg(img, 300, 75)}" alt="บรรยากาศร้านในบ้าน นครพนม ${i+1}" loading="lazy" decoding="async" width="200" height="200">
                </div>`).join('')}
            </div>` : ''}

            ${diningCheckins.length > 0 ? `
            <div class="section-header">
                <h2 class="section-title">${tt('มื้อจริงจากลูกค้า', 'Real meals from guests')}</h2>
                <span class="section-meta">${tt(`${diningCheckins.length} รูป`, `${diningCheckins.length} photos`, `${diningCheckins.length} 张`, `${diningCheckins.length} ຮູບ`)}</span>
            </div>
            <div class="gallery-grid">
                ${diningCheckins.map((chk, i) => `
                <div class="gallery-item" onclick="openLightbox('${optImg(chk.image_url, 900)}')">
                    <img src="${optImg(chk.image_url, 300, 75)}" alt="${escapeHtml(chk.text || 'รูปจากลูกค้า')}" loading="lazy" decoding="async" width="200" height="200">
                    ${captionText(chk.text) ? `<div class="gallery-caption"><span class="caption-text">${escapeHtml(captionText(chk.text))}</span></div>` : ''}
                </div>`).join('')}
            </div>` : ''}
        </div>

        <!-- ─── SECTION 3: CONTACT ─── -->
        <div id="sec-connect">
            <div class="section-header">
                <h2 class="section-title">${tt('ติดต่อร้าน', 'Contact us')}</h2>
                <span class="section-meta num">098-528-4217</span>
            </div>
            <a href="${mapUrl}" id="cta-connect-map" target="_blank" rel="noopener noreferrer" class="row-link ink" onclick="handleDirectionsClick(event)">
                <span>${tt('นำทางมาร้าน', 'Get directions')}<span class="row-sub">${tt(directionsSub, directionsSubEn, directionsSubZh, directionsSubLo)}</span></span>
                <span class="arrow">→</span>
            </a>
            <a href="${lineUrl}" id="cta-connect-line" target="_blank" rel="noopener noreferrer" class="row-link line" onclick="handleLineClick(event)">
                <span>${tt('แชท LINE', 'Chat on LINE')}<span class="row-sub">${tt('สอบถามหรือสั่งอาหาร', 'Ask us or order')}</span></span>
                <span class="arrow">→</span>
            </a>
            <a href="tel:+66985284217" id="cta-connect-call" class="row-link" onclick="handleCallClick(event)">
                <span>${tt('โทรหาร้าน', 'Call the shop')}<span class="row-sub num">098-528-4217</span></span>
                <span class="arrow">→</span>
            </a>

            <div class="section-header">
                <h2 class="section-title">${tt('จองโต๊ะและสั่งอาหาร', 'Book &amp; order')}</h2>
                <span class="section-meta">${tt('ไม่จองก็มาได้', 'Walk-ins welcome')}</span>
            </div>
            <a href="/booking" class="row-link" onclick="handleBookingClick(event)">
                <span>${tt('จองโต๊ะล่วงหน้า', 'Book a table')}<span class="row-sub">${tt('สำหรับวันที่อยากได้โต๊ะแน่นอน', 'When you want a table for sure')}</span></span>
                <span class="arrow">→</span>
            </a>
            <a href="/pickup" class="row-link" onclick="handlePickupClick(event)">
                <span>${tt('สั่งรับหน้าร้าน', 'Order for pickup')}<span class="row-sub">${tt('สั่งออนไลน์ แล้วแวะรับ', 'Order online, pick up at the shop')}</span></span>
                <span class="arrow">→</span>
            </a>
            <a href="https://lin.ee/8uqmIzZ" target="_blank" rel="noopener noreferrer" class="row-link" onclick="trackClick('click_lineman', 'LINE MAN'); logAdEvent('click_lineman')">
                <span>${tt('เดลิเวอรีผ่าน LINE MAN', 'Delivery via LINE MAN')}<span class="row-sub">${tt('สั่งผ่านแอป LINE MAN', 'Order in the LINE MAN app')}</span></span>
                <span class="arrow">→</span>
            </a>

            <div class="section-header">
                <h2 class="section-title">${tt('ติดตามและข้อมูลร้าน', 'Follow &amp; info')}</h2>
            </div>
            <a href="${igUrl}" target="_blank" rel="noopener noreferrer" class="row-link" onclick="trackClick('click_instagram', 'Instagram')">
                <span>Instagram<span class="row-sub">@inthehausth</span></span>
                <span class="arrow">→</span>
            </a>
            <a href="${fbUrl}" target="_blank" rel="noopener noreferrer" class="row-link" onclick="trackClick('click_facebook', 'Facebook')">
                <span>Facebook<span class="row-sub">In the haus</span></span>
                <span class="arrow">→</span>
            </a>
            <a href="/qa" class="row-link" onclick="trackClick('click_faq', '/qa')">
                <span>${tt('คำถามที่พบบ่อย', 'FAQ')}<span class="row-sub">${tt('รวมคำถามที่ลูกค้าถามบ่อย', 'Questions guests often ask')}</span></span>
                <span class="arrow">→</span>
            </a>
            <a href="/link/hauscheckin" class="row-link" onclick="trackClick('click_checkin_board', '/link/hauscheckin')">
                <span>${tt('บอร์ดเช็กอินลูกค้า', 'Guest check-in wall')}<span class="row-sub">${tt('รูปจากลูกค้าที่มาร้าน', 'Photos from our guests')}</span></span>
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
                    <span>${tt('นำทาง', 'Directions')}</span>
                    <span class="sticky-sub">${tt(lastPhraseHtml(settings.link_directions_sub || DEFAULT_SETTINGS.link_directions_sub), lastPhraseHtml(settings.link_directions_sub_en || DEFAULT_SETTINGS.link_directions_sub_en), lastPhraseHtml(settings.link_directions_sub_zh || DEFAULT_SETTINGS.link_directions_sub_zh), lastPhraseHtml(settings.link_directions_sub_lo || DEFAULT_SETTINGS.link_directions_sub_lo))}</span>
                </a>
                <a href="${lineUrl}" id="cta-sticky-line" target="_blank" rel="noopener noreferrer" class="sticky-btn line" onclick="handleLineClick(event)">${tt('แชท LINE', 'LINE chat')}</a>
                <a href="tel:+66985284217" id="cta-sticky-call" class="sticky-btn" onclick="handleCallClick(event)">${tt('โทร', 'Call')}</a>
                <a href="/booking" id="cta-sticky-booking" class="sticky-btn" onclick="handleBookingClick(event)">${tt('จองโต๊ะ', 'Book')}</a>
            </div>
        </nav>
    </div>

    <!-- Image Lightbox Modal -->
    <div id="lightbox-modal" class="modal" onclick="closeLightbox()">
        <button class="modal-close" onclick="closeLightbox()">${tt('ปิด', 'Close')}</button>
        <img id="lightbox-img" class="modal-content" src="" alt="รูปขยาย">
    </div>

    <!-- Booklet Viewer Modal -->
    <div id="booklet-modal" class="modal" onclick="closeBooklet(event)">
        <button class="modal-close" onclick="closeBooklet()">${tt('ปิด', 'Close')}</button>
        <div class="modal-stack" onclick="event.stopPropagation()">
            <img id="booklet-img" class="modal-content" alt="หน้าเมนูแบบเล่ม" decoding="async">
            <div class="booklet-nav">
                <button onclick="prevBookletPage()">← ${tt('ก่อนหน้า', 'Prev')}</button>
                <span id="booklet-counter" class="num">1 / ${bookletImages.length}</span>
                <button onclick="nextBookletPage()">${tt('ถัดไป', 'Next')} →</button>
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
                const wasHidden = p.hidden;
                p.hidden = !on;
                p.classList.remove('entering');
                if (on && wasHidden && !silent) { void p.offsetWidth; p.classList.add('entering'); }
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
                // The server already picked the group; this only corrects a page served from the CDN cache across the window edge
                const inLunch = now >= Number(w[1]) * 60 + Number(w[2]) && now < Number(w[3]) * 60 + Number(w[4]);
                const shown = (starterCard.querySelector('.set-panel:not([hidden])') || {}).dataset;
                const target = inLunch ? '1' : starterCard.dataset.default;
                if (target && shown && shown.group !== target) selectSetGroup(target, true);
            } catch(e) {}
        })();

        // ─── TAB SWITCHING ───
        // All three sections stay on the page; the strip is a sticky index that scrolls to them
        // and highlights whichever one is under the reader (no hide/show jumps).
        const SECTIONS = ['menu', 'vibe', 'connect'];
        function markSection(name) {
            SECTIONS.forEach(function(s) {
                const b = document.getElementById('tab-btn-' + s);
                if (!b) return;
                b.className = 'tab-btn' + (s === name ? ' active' : '');
                b.setAttribute('aria-selected', String(s === name));
            });
            const bar = document.querySelector('.tab-bar');
            if (bar && SECTIONS.indexOf(name) !== -1) bar.style.setProperty('--tab-i', SECTIONS.indexOf(name));
        }
        function switchSection(name) {
            markSection(name);
            const sec = document.getElementById('sec-' + name);
            if (sec) sec.scrollIntoView({ block: 'start' });
        }
        (function() {
            if (!('IntersectionObserver' in window)) return;
            const io = new IntersectionObserver(function(entries) {
                entries.forEach(function(en) {
                    if (en.isIntersecting) markSection(en.target.id.replace('sec-', ''));
                });
            }, { rootMargin: '-45% 0px -50% 0px' });
            SECTIONS.forEach(function(s) { const el = document.getElementById('sec-' + s); if (el) io.observe(el); });
        })();

        // ─── REVEAL ON SCROLL ───
        (function() {
            if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
            const io = new IntersectionObserver(function(entries) {
                entries.forEach(function(en) {
                    if (!en.isIntersecting) return;
                    en.target.classList.add('in');
                    io.unobserve(en.target);
                });
            }, { rootMargin: '0px 0px -8% 0px' });
            const fold = window.innerHeight;
            // One style, few targets: headings and photos only. Rows, facts and the footer just scroll in.
            document.querySelectorAll('.section-header, .gallery-item').forEach(function(el) {
                if (el.getBoundingClientRect().top < fold) return;
                const sibs = Array.prototype.indexOf.call(el.parentNode.children, el);
                el.style.setProperty('--d', (sibs % 3) * 40 + 'ms');
                el.classList.add('reveal');
                io.observe(el);
            });
        })();

        // ─── LAZY PHOTOS FADE IN ───
        // Only photos still loading are touched, so nothing is hidden without JS or when already cached
        (function() {
            document.querySelectorAll('.gallery-item img[loading="lazy"]').forEach(function(img) {
                if (img.complete) return;
                img.classList.add('img-wait');
                const done = function() { img.classList.remove('img-wait'); };
                img.addEventListener('load', done, { once: true });
                img.addEventListener('error', done, { once: true });
            });
        })();

        // ─── LANGUAGE ───
        const ZH =${JSON.stringify(ZH)};
        const LO = ${JSON.stringify(LO)};
        function TT(th, en, zh, lo) {
            const z = zh || ZH[en], l = lo || LO[en];
            return '<span class="l-th">' + th + '</span><span class="l-en' + (z ? '' : ' l-zh') + (l ? '' : ' l-lo') + '">' + en + '</span>'
                + (z ? '<span class="l-zh">' + z + '</span>' : '') + (l ? '<span class="l-lo">' + l + '</span>' : '');
        }
        function langOnly(th, en, zh, lo) {
            const has = { th: !!th, en: !!en, zh: !!(zh || en), lo: !!(lo || en) };
            const keys = Object.keys(has).filter(function(k) { return has[k]; });
            return keys.length === 4 ? '' : keys.map(function(k) { return ' l-' + k; }).join('');
        }
        function setLang(code) {
            if (!HAUS_LANGS[code]) return;
            document.documentElement.lang = HAUS_LANGS[code];
            if (code === 'lo') loadLaoFont();
            try { localStorage.setItem('haus_lang', code); } catch (e) {}
            document.querySelectorAll('.lang-cell').forEach(function(b) { b.setAttribute('aria-pressed', String(b.dataset.lang === code)); });
            logAdEvent('switch_lang_' + code);
        }
        setLang.sync = function() {
            const cur = Object.keys(HAUS_LANGS).find(function(k) { return HAUS_LANGS[k] === document.documentElement.lang; }) || 'th';
            document.querySelectorAll('.lang-cell').forEach(function(b) { b.setAttribute('aria-pressed', String(b.dataset.lang === cur)); });
        };
        setLang.sync();

        // ─── FOOD CARDS: THE WORD RISES FROM BEHIND THE DISH ───
        // Cards are settled in the HTML, so no JS, reduced motion and a failed import all show the finished card.
        // Motion (motion.dev, the mini WAAPI build, ~23 KB over the wire) loads only when the strip is about a screen away;
        // cards already on screen then stay as they are (the first paint is never animated).
        // The word rises each time a card comes into view and folds back when it leaves (owner 2026-11-24).
        (function() {
            const strip = document.querySelector('.fc-strip');
            if (!strip || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
            const EASE = [0.16, 1, 0.3, 1];
            // The push-in is slow drift, not an entrance: a softer ease-out so the scale does not jump in the first second
            const DRIFT = [0.33, 1, 0.68, 1];
            // The breath moves on screen and back, so it eases in and out
            const BREATHE = [0.45, 0, 0.55, 1];
            // Tempo follows the word: sharp words snap up, soft words rise slowly and breathe once
            const TEMPO = { sharp: { dur: 0.4, stagger: 0.07, breathe: 0 }, even: { dur: 0.6, stagger: 0.1, breathe: 0 }, soft: { dur: 0.87, stagger: 0.17, breathe: 4 } };
            const near = new IntersectionObserver(function(entries) {
                if (!entries.some(function(en) { return en.isIntersecting; })) return;
                near.disconnect();
                import('https://cdn.jsdelivr.net/npm/motion@12.23.26/mini/+esm').then(function(m) { start(m.animate); }).catch(function() {});
            }, { rootMargin: '100% 0px' });
            near.observe(strip);

            function start(animate) {
                const vh = window.innerHeight, vw = window.innerWidth;
                const state = new Map();
                strip.querySelectorAll('.fc-card').forEach(function(card) {
                    const r = card.getBoundingClientRect();
                    const onScreen = r.top < vh && r.bottom > 0 && r.left < vw && r.right > 0;
                    state.set(card, { shown: onScreen, runs: [], gen: 0 });
                    if (!onScreen) letters(card).forEach(function(l) { l.style.transform = sunk(l); });
                });
                // Enter at three quarters in view (a swipe has mostly settled); leave below a quarter (the card is nearly gone),
                // so the word never sinks while someone is still looking at it
                const seen = new IntersectionObserver(function(entries) {
                    entries.forEach(function(en) {
                        const s = state.get(en.target);
                        if (en.intersectionRatio >= 0.75 && !s.shown) { s.shown = true; play(animate, en.target, s); }
                        else if (en.intersectionRatio < 0.25 && s.shown) { s.shown = false; leave(animate, en.target, s); }
                    });
                }, { threshold: [0, 0.25, 0.75] });
                state.forEach(function(s, card) { seen.observe(card); });
            }

            function letters(card) { return Array.prototype.slice.call(card.querySelectorAll('.fc-word img')); }
            function sunk(l) { return 'translateY(' + l.dataset.rise + '%)'; }
            // Stop what is running and hold each element where it is, so a quick swipe back turns around without a jump
            function halt(s) {
                s.gen++;
                s.runs.forEach(function(r) {
                    const at = getComputedStyle(r.el).transform;
                    r.anim.stop();
                    r.el.style.transform = at === 'none' ? '' : at;
                });
                s.runs = [];
            }
            function run(animate, s, el, to, opts) {
                const from = getComputedStyle(el).transform;
                const anim = animate(el, { transform: [from === 'none' ? 'translateY(0)' : from, to] }, opts);
                s.runs.push({ el: el, anim: anim });
                return anim;
            }

            function play(animate, card, s) {
                halt(s);
                const t = TEMPO[card.dataset.tempo] || TEMPO.even;
                const gen = s.gen;
                run(animate, s, card.querySelector('.fc-scene'), 'scale(1.035)', { duration: 6, ease: DRIFT });
                letters(card).forEach(function(l, i) {
                    const rise = run(animate, s, l, 'translateY(0)', { duration: t.dur, delay: 0.08 + i * t.stagger, ease: EASE });
                    if (!t.breathe) return;
                    // one slow breath after landing, then still: nothing on /link loops
                    rise.finished.then(function() {
                        if (s.gen !== gen) return;
                        run(animate, s, l, 'translateY(-' + t.breathe + 'px)', { duration: 1.2, ease: BREATHE }).finished.then(function() {
                            if (s.gen === gen) run(animate, s, l, 'translateY(0)', { duration: 1.2, ease: BREATHE });
                        });
                    });
                });
            }

            // Exit is quicker than the entrance and all at once: the word folds back behind the dish, ready to rise again
            function leave(animate, card, s) {
                halt(s);
                run(animate, s, card.querySelector('.fc-scene'), 'scale(1)', { duration: 0.2, ease: EASE });
                letters(card).forEach(function(l) { run(animate, s, l, sunk(l), { duration: 0.2, ease: EASE }); });
            }
        })();

        // ─── OPEN / CLOSED STATUS (Asia/Bangkok, from the hours text) ───
        // Named so the live countdown can refresh it the moment the shop opens or closes.
        function updateOpenStatus() {
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
                    ? '<span class="dot"></span> ' + TT('เปิดอยู่', 'Open now')
                    : '<span class="dot closed"></span> ' + TT('ปิดอยู่', 'Closed');
                const hoursState = document.getElementById('hours-state');
                if (hoursState) {
                    hoursState.innerHTML = isOpen ? TT('เปิดอยู่ตอนนี้', 'Open now', '营业中', 'ເປີດຢູ່ຕອນນີ້') : TT('ปิดอยู่ · เปิด ' + m[1] + ':' + m[2] + ' น.', 'Closed · opens ' + m[1] + ':' + m[2], '已打烊 · ' + m[1] + ':' + m[2] + ' 开门', 'ປິດຢູ່ · ເປີດ ' + m[1] + ':' + m[2]);
                    hoursState.className = 'hours-state' + (isOpen ? '' : ' closed');
                    hoursState.hidden = false;
                }
                const hoursLine = document.getElementById('status-hours');
                if (!isOpen && hoursLine) hoursLine.innerHTML = TT('เปิด ' + m[1] + ':' + m[2] + ' น.', 'Opens ' + m[1] + ':' + m[2], m[1] + ':' + m[2] + ' 开门', 'ເປີດ ' + m[1] + ':' + m[2]);

                // Last-order note: last hour before "ปิดรับออเดอร์ HH:MM" (older "ครัวปิด" text still parsed), then "kitchen closed"
                const k = (el.dataset.hours || '').match(/(?:ปิดรับออเดอร์|ครัวปิด)\\s*(\\d{1,2})[:.](\\d{2})/);
                const note = document.getElementById('kitchen-note');
                if (isOpen && k && note) {
                    let kitchen = Number(k[1]) * 60 + Number(k[2]);
                    if (kitchen < open) kitchen += 24 * 60;
                    const nowAdj = now < open ? now + 24 * 60 : now;
                    const left = kitchen - nowAdj;
                    if (left > 0 && left <= 60) {
                        const h = Math.floor(left / 60), mm = left % 60;
                        // Each phrase stays on one line ("เหลืออีก 21 นาที" never splits)
                        note.innerHTML = TT('<span class="nb">ปิดรับออเดอร์ ' + k[1] + ':' + k[2] + '</span> · <span class="nb">เหลืออีก ' + (h ? h + ' ชม. ' : '') + (mm ? mm + ' นาที' : '') + '</span>',
                            '<span class="nb">Last order ' + k[1] + ':' + k[2] + '</span> · <span class="nb">' + (h ? h + ' h ' : '') + (mm ? mm + ' min' : '') + ' left</span>',
                            '<span class="nb">最后点餐 ' + k[1] + ':' + k[2] + '</span> · <span class="nb">还剩 ' + (h ? h + ' 小时 ' : '') + (mm ? mm + ' 分钟' : '') + '</span>',
                            '<span class="nb">ຮັບອໍເດີຮອດ ' + k[1] + ':' + k[2] + '</span> · <span class="nb">ເຫຼືອອີກ ' + (h ? h + ' ຊມ. ' : '') + (mm ? mm + ' ນາທີ' : '') + '</span>');
                        note.hidden = false;
                    } else if (left <= 0) {
                        note.innerHTML = TT('<span class="nb">ปิดรับออเดอร์แล้ว</span> · <span class="nb">ร้านเปิดถึง ' + m[3] + ':' + m[4] + ' น.</span>',
                            '<span class="nb">Kitchen closed</span> · <span class="nb">open until ' + m[3] + ':' + m[4] + '</span>',
                            '<span class="nb">已停止点餐</span> · <span class="nb">营业至 ' + m[3] + ':' + m[4] + '</span>',
                            '<span class="nb">ປິດຮັບອໍເດີແລ້ວ</span> · <span class="nb">ຮ້ານເປີດຮອດ ' + m[3] + ':' + m[4] + '</span>');
                        note.hidden = false;
                    }
                    if (!note.hidden && hoursLine) hoursLine.hidden = true;
                }
            } catch(e) {}
        }
        updateOpenStatus();

        // ─── LIVE COUNTDOWN in the hours card: last order / closing / opening ───
        // Shown only when the next change is an hour away or less: minutes only ("38 นาที"), seconds
        // join in the last 10 minutes. A ticker hours out reads as urgency that isn't there.
        // Plain DOM + CSS transforms (no library), ticks on the second boundary, sleeps while the tab is hidden.
        // Each digit is a 0-9 strip that slides into place.
        (function() {
            const box = document.getElementById('hours-count');
            const src = document.getElementById('open-status');
            if (!box || !src) return;
            const text = src.dataset.hours || '';
            const hm = text.match(/(\\d{1,2})[:.](\\d{2})\\s*-\\s*(\\d{1,2})[:.](\\d{2})/);
            if (!hm) return;
            const km = text.match(/(?:ปิดรับออเดอร์|ครัวปิด)\\s*(\\d{1,2})[:.](\\d{2})/);
            const labelEl = box.querySelector('.hc-label');
            const timeEl = box.querySelector('.hc-time');
            const srEl = box.querySelector('.hc-sr');
            const unitEl = box.querySelector('.hc-unit');
            if (unitEl) unitEl.innerHTML = TT('นาที', 'min', '分钟', 'ນາທີ');
            const SHOW_WITHIN = 3600;
            const SECONDS_WITHIN = 600;
            const DAY = 86400;
            const open = (Number(hm[1]) * 60 + Number(hm[2])) * 60;
            let close = (Number(hm[3]) * 60 + Number(hm[4])) * 60;
            if (close <= open) close += DAY;
            let last = km ? (Number(km[1]) * 60 + Number(km[2])) * 60 : null;
            if (last !== null && last < open) last += DAY;
            const LABELS = {
                last: ['ปิดรับออเดอร์ในอีก', 'Last order in'],
                close: ['ร้านปิดในอีก', 'Closes in'],
                open: ['เปิดในอีก', 'Opens in']
            };
            let fmt;
            try { fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }); } catch (e) { return; }

            function nowSec() {
                const p = fmt.formatToParts(new Date());
                const g = function(t) { return Number(p.find(function(x) { return x.type === t; }).value); };
                return g('hour') * 3600 + g('minute') * 60 + g('second');
            }
            function state() {
                let n = nowSec();
                if (n < open && n + DAY < close) n += DAY; // after midnight inside an overnight window
                if (n >= open && n < close) {
                    const p = (n - open) / (close - open);
                    if (last !== null && n < last) return { kind: 'last', left: last - n, p: p };
                    return { kind: 'close', left: close - n, p: p };
                }
                let to = open - n;
                if (to <= 0) to += DAY;
                return { kind: 'open', left: to };
            }
            function pad(n) { return n < 10 ? '0' + n : String(n); }

            let cells = [];
            let shape = '';
            let kind = '';
            function build(str) {
                timeEl.textContent = '';
                cells = [];
                for (const ch of str) {
                    if (ch === ':') {
                        const sep = document.createElement('span');
                        sep.className = 'hc-sep';
                        sep.textContent = ':';
                        timeEl.appendChild(sep);
                        continue;
                    }
                    const d = document.createElement('span');
                    d.className = 'hc-d';
                    const strip = document.createElement('span');
                    strip.className = 'hc-strip';
                    for (let i = 0; i <= 10; i++) {
                        const c = document.createElement('span');
                        c.textContent = String(i % 10);
                        strip.appendChild(c);
                    }
                    d.appendChild(strip);
                    timeEl.appendChild(d);
                    strip.style.transition = 'none';
                    strip.style.transform = 'translateY(' + (-Number(ch)) + 'em)';
                    cells.push({ strip: strip, v: Number(ch) });
                }
                void timeEl.offsetHeight;
                cells.forEach(function(c) { c.strip.style.transition = ''; });
                shape = str.replace(/\\d/g, '0');
            }
            function setDigit(cell, v) {
                if (cell.v === v) return;
                const from = cell.v;
                cell.v = v;
                if (v > from && from === 0) {
                    // Counting down past 0 (0 -> 9, or 0 -> 5 on the seconds' tens): start from the
                    // second "0" at the strip's end so the new digit drops in from above, like the rest.
                    cell.strip.style.transition = 'none';
                    cell.strip.style.transform = 'translateY(-10em)';
                    void cell.strip.offsetHeight;
                    cell.strip.style.transition = '';
                }
                cell.strip.style.transform = 'translateY(' + (-v) + 'em)';
            }
            function spoken(left) {
                const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60);
                return LABELS[kind][0] + ' ' + (h ? h + ' ชั่วโมง ' : '') + m + ' นาที';
            }

            let timer = null;
            function tick() {
                const s = state();
                if (s.kind !== kind) {
                    const changed = kind !== '';
                    kind = s.kind;
                    labelEl.innerHTML = TT(LABELS[kind][0], LABELS[kind][1]);
                    if (changed) updateOpenStatus();
                }
                drawLine(s);
                if (s.left > SHOW_WITHIN) { box.hidden = true; return s; }
                const m = Math.floor(s.left / 60);
                const sec = s.left % 60;
                // Whole minutes, floored, so it reads 11 นาที → 10 นาที → 10:00 (at 600s) without a jump
                const minutesOnly = s.left > SECONDS_WITHIN;
                const str = minutesOnly ? String(m) : m + ':' + pad(sec);
                if (unitEl) unitEl.hidden = !minutesOnly;
                if (str.replace(/\\d/g, '0') !== shape) build(str);
                else {
                    let i = 0;
                    for (const ch of str) { if (ch !== ':') setDigit(cells[i++], Number(ch)); }
                }
                // Screen readers hear the minute, not every second
                if (minutesOnly || sec === 0 || !srEl.textContent) srEl.textContent = spoken(s.left);
                box.hidden = false;
                return s;
            }

            // Timeline on the card's bottom divider
            const line = document.getElementById('hours-line');
            let lineShown = false;
            if (line && last !== null && last > open && last < close) line.style.setProperty('--l', String((last - open) / (close - open)));
            else if (line) line.querySelector('.hl-last').hidden = true;
            function drawLine(s) {
                if (!line) return;
                line.classList.toggle('closed', s.kind === 'open');
                const p = s.kind === 'open' ? 0 : s.p;
                if (!lineShown) {
                    // First paint stays still: place the marker without a transition
                    lineShown = true;
                    line.querySelectorAll('.hl-fill, .hl-now').forEach(function(el) { el.style.transition = 'none'; });
                    line.style.setProperty('--p', String(p));
                    line.classList.add('live');
                    void line.offsetWidth;
                    line.querySelectorAll('.hl-fill, .hl-now').forEach(function(el) { el.style.transition = ''; });
                    return;
                }
                line.style.setProperty('--p', String(p));
            }
            // How many second boundaries until the display next needs to change:
            // - more than 10 minutes left: once a minute, when the floored minute drops (left % 60 + 1),
            //   also stopping exactly at the 1-hour mark (box appears) and at 600s (switch to 10:00).
            //   Past the hour the box is hidden and only the timeline moves, once a minute.
            // - last 10 minutes: every second.
            function secondsUntilNextChange(left) {
                if (left <= SECONDS_WITHIN) return 1;
                let k = (left % 60) + 1;
                if (left > SHOW_WITHIN) k = Math.min(k, left - SHOW_WITHIN);
                k = Math.min(k, left - SECONDS_WITHIN);
                return Math.max(1, k);
            }
            function schedule() {
                clearTimeout(timer);
                if (document.hidden) return; // visibilitychange re-runs this when the tab is shown again
                const s = tick();
                const k = secondsUntilNextChange(s.left);
                timer = setTimeout(schedule, k * 1000 - (Date.now() % 1000) + 15);
            }
            document.addEventListener('visibilitychange', schedule);
            schedule();
        })();

        // ─── MODAL HISTORY: phone back button / Esc closes the modal instead of leaving the page ───
        function pushModalState() {
            if (!(history.state && history.state.hausModal)) history.pushState({ hausModal: true }, '');
        }
        function popModalState() {
            if (history.state && history.state.hausModal) history.back();
        }
        // Close with a short fade; the modal stays laid out for 150ms while .closing plays
        function hideModal(m) {
            if (!m.classList.contains('open')) return;
            m.classList.remove('open');
            m.classList.add('closing');
            clearTimeout(m._closeTimer);
            m._closeTimer = setTimeout(function() { m.classList.remove('closing'); }, 120);
        }
        function showModal(m) {
            clearTimeout(m._closeTimer);
            m.classList.remove('closing');
            m.classList.add('open');
        }
        function closeAllModals() {
            hideModal(document.getElementById('lightbox-modal'));
            hideModal(document.getElementById('booklet-modal'));
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

        function clientItemName(item) {
            const th = escapeClientHtml(item.name);
            const alt = function(v) { const t = String(v || '').trim(); return t && t !== item.name ? escapeClientHtml(t) + '<span class="item-name-th">' + th + '</span>' : ''; };
            return TT(th, alt(item.name_en) || th, alt(item.name_zh), alt(item.name_lo));
        }
        function clientItemDesc(item) {
            const th = item.description ? formatClientDescription(item.description) : '';
            const en = item.description_en ? formatClientDescription(item.description_en) : '';
            const zh = item.description_zh ? formatClientDescription(item.description_zh) : '';
            const lo = item.description_lo ? formatClientDescription(item.description_lo) : '';
            if (!th && !en && !zh && !lo) return '';
            return '<div class="item-desc' + langOnly(th, en, zh, lo) + '">' + TT(th, en, zh, lo) + '</div>';
        }
        const HEAT_LABELS = ${JSON.stringify(HEAT_LABELS)};
        const HEAT_LABELS_EN = ${JSON.stringify(HEAT_LABELS_EN)};
        function clientHeat(range) {
            if (!range) return '';
            const level = range.max;
            const label = level > 0 && range.min === 0 ? 'มีจานเผ็ด' : HEAT_LABELS[level];
            const labelEn = level > 0 && range.min === 0 ? 'Some spicy dishes' : HEAT_LABELS_EN[level];
            let cells = '';
            for (let n = 1; n <= 3; n++) cells += '<i' + (n <= level ? ' class="on"' : '') + '></i>';
            return '<span class="heat h' + level + '" role="img" aria-label="ความเผ็ด: ' + label + '"><span class="heat-cells" aria-hidden="true">' + cells + '</span><span class="heat-label">' + TT(label, labelEn) + '</span></span>';
        }

        // From the first-time block: open the full menu and bring it under the tab strip
        function jumpToFullMenu(e) {
            if (e) e.preventDefault();
            markSection('menu');
            if (document.getElementById('full-menu-content').style.display === 'none') toggleFullMenu();
            const bar = document.querySelector('.tab-bar');
            const top = document.getElementById('btn-full-menu').getBoundingClientRect().top + window.scrollY - bar.offsetHeight;
            const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            window.scrollTo({ top: top, behavior: smooth ? 'smooth' : 'auto' });
        }

        function jumpToCategory(btn) {
            const target = document.getElementById(btn.dataset.cat);
            if (!target) return;
            const offset = document.querySelector('.tab-bar').offsetHeight + document.querySelector('.cat-index').offsetHeight;
            window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset + 1, behavior: 'smooth' });
        }

        // ─── FULL MENU (fetched on demand from /link?part=menu, not inlined in the page) ───
        let fullMenuData = null;
        let fullMenuReq = null;
        function loadFullMenuData(fresh) {
            if (fullMenuData && !fresh) return Promise.resolve(fullMenuData);
            if (fullMenuReq && !fresh) return fullMenuReq;
            fullMenuReq = fetch('/link?part=menu' + (fresh ? '&purge=1&t=' + Date.now() : ''), { cache: fresh ? 'no-store' : 'default' })
                .then(function(r) { if (!r.ok) throw new Error('menu ' + r.status); return r.json(); })
                .then(function(d) { fullMenuData = d; return d; })
                .catch(function(err) { fullMenuReq = null; throw err; });
            return fullMenuReq;
        }
        // Start the download once the reader scrolls near the button, so the tap itself feels instant
        (function() {
            const btn = document.getElementById('btn-full-menu');
            if (!btn || !('IntersectionObserver' in window)) return;
            const io = new IntersectionObserver(function(entries) {
                if (!entries.some(function(en) { return en.isIntersecting; })) return;
                io.disconnect();
                loadFullMenuData().catch(function() {});
            }, { rootMargin: '600px 0px' });
            io.observe(btn);
        })();
        function retryFullMenu() {
            const content = document.getElementById('full-menu-content');
            content.innerHTML = '';
            content.style.display = 'none';
            toggleFullMenu();
        }
        function renderFullMenu(content, raw) {
            let html = '';
            let index = '';
            raw.categories.forEach((cat, ci) => {
                const cItems = raw.menuItems.filter(i => i.category_id === cat.id);
                if (cItems.length === 0) return;
                const shortTh = String(cat.name || '').replace(/\s*\(.*\)\s*/, '').trim() || cat.name;
                index += '<button type="button" class="cat-chip" data-cat="cat-' + ci + '" onclick="jumpToCategory(this)">' + TT(escapeClientHtml(shortTh), escapeClientHtml(cat.name_en || shortTh), cat.name_zh && escapeClientHtml(cat.name_zh), cat.name_lo && escapeClientHtml(cat.name_lo)) + '</button>';
                html += '<div class="section-header sub" id="cat-' + ci + '"><h3 class="section-title">' + TT(escapeClientHtml(cat.name), escapeClientHtml(cat.name_en || cat.name), cat.name_zh && escapeClientHtml(cat.name_zh), cat.name_lo && escapeClientHtml(cat.name_lo)) + '</h3><span class="section-meta">' + TT(cItems.length + ' รายการ', cItems.length + ' items', cItems.length + ' 项', cItems.length + ' ລາຍການ') + '</span></div><div>';
                cItems.forEach(item => {
                    const thumb = item.image_url ? '<img src="https://wsrv.nl/?url=' + encodeURIComponent(item.image_url.split('?')[0]) + '&w=128&q=75&output=webp" alt="' + escapeClientHtml(item.name) + '" class="item-thumb" loading="lazy" width="64" height="64">' : '';
                    const bigImg = item.image_url ? 'https://wsrv.nl/?url=' + encodeURIComponent(item.image_url.split('?')[0]) + '&w=800&q=75&output=webp' : '';
                    const clickAttr = bigImg ? ' data-img="' + bigImg + '" onclick="openLightbox(this.dataset.img)"' : '';
                    const descHtml = clientItemDesc(item);
                    html += '<div class="item-row' + (bigImg ? ' zoomable' : '') + '"' + clickAttr + '><div class="item-info"><div class="item-name">' + clientItemName(item) + '</div>' + descHtml + '<div class="item-price num">฿' + escapeClientHtml(item.price) + '</div>' + clientHeat(item.spice) + '</div>' + thumb + '</div>';
                });
                html += '</div>';
            });
            content.innerHTML = (index ? '<nav class="cat-index" aria-label="หมวดเมนู">' + index + '</nav>' : '') + html;
            // Highlight the category being read and keep its chip in view
            if ('IntersectionObserver' in window) {
                const nav = content.querySelector('.cat-index');
                const catIo = new IntersectionObserver(function(entries) {
                    entries.forEach(function(en) {
                        if (!en.isIntersecting || !nav) return;
                        nav.querySelectorAll('.cat-chip').forEach(function(c) {
                            const on = c.dataset.cat === en.target.id;
                            c.setAttribute('aria-current', on ? 'true' : 'false');
                            if (on) nav.scrollTo({ left: c.offsetLeft - 16, behavior: 'smooth' });
                        });
                    });
                }, { rootMargin: '-110px 0px -70% 0px' });
                content.querySelectorAll('.section-header.sub[id]').forEach(function(h) { catIo.observe(h); });
            }
        }

        function finishFullMenuClose(content) {
            clearTimeout(content._closeTimer);
            content._closing = false;
            content.classList.remove('closing');
            content.style.height = '';
            content.style.display = 'none';
        }
        // animate: only the button passes true. Other callers toggle twice in a row and need the state to flip at once.
        function toggleFullMenu(animate) {
            const content = document.getElementById('full-menu-content');
            const btn = document.getElementById('btn-full-menu');
            if (content._closing) finishFullMenuClose(content);
            if (content.style.display === 'none') {
                if (!content.hasChildNodes()) {
                    if (fullMenuData) {
                        renderFullMenu(content, fullMenuData);
                    } else {
                        content.innerHTML = '<p class="full-menu-status" role="status">' + TT('กำลังโหลดเมนู…', 'Loading the menu…', '正在加载菜单…', 'ກຳລັງໂຫຼດເມນູ…') + '</p>';
                        loadFullMenuData().then(function(d) {
                            renderFullMenu(content, d);
                        }).catch(function() {
                            content.innerHTML = '<p class="full-menu-status" role="status">' + TT('โหลดเมนูไม่สำเร็จ', 'Could not load the menu', '菜单加载失败', 'ໂຫຼດເມນູບໍ່ສຳເລັດ') + ' <button type="button" class="full-menu-retry" onclick="retryFullMenu()">' + TT('ลองอีกครั้ง', 'Try again', '重试', 'ລອງໃໝ່') + '</button></p>';
                        });
                    }
                }
                content.style.display = 'block';
                content.classList.remove('opening'); void content.offsetWidth; content.classList.add('opening');
                document.getElementById('full-menu-label').innerHTML = TT('ปิดเมนูทั้งหมด', 'Close the full menu');
                document.getElementById('full-menu-arrow').textContent = '↑';
                document.getElementById('btn-full-menu').classList.add('open');
                if (window.gtag) gtag('event', 'view_full_menu', { event_category: 'engagement', page_path: '/link' });
                logAdEvent('view_full_menu');
            } else {
                if (animate === true && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                    content._closing = true;
                    content.style.height = content.offsetHeight + 'px';
                    void content.offsetHeight;
                    content.classList.add('closing');
                    content.style.height = '0px';
                    content._closeTimer = setTimeout(function() { finishFullMenuClose(content); }, 260);
                } else {
                    content.style.display = 'none';
                }
                document.getElementById('full-menu-label').innerHTML = TT('ดูเมนูทั้งหมด ${menuItems.length} รายการ', 'See the full menu · ${menuItems.length} items', '查看完整菜单 · ${menuItems.length} 项', 'ເບິ່ງເມນູທັງໝົດ ${menuItems.length} ລາຍການ');
                document.getElementById('full-menu-arrow').textContent = '↓';
                document.getElementById('btn-full-menu').classList.remove('open');
            }
        }

        // ─── LIGHTBOX ───
        function openLightbox(url) {
            if (!url) return;
            const m = document.getElementById('lightbox-modal');
            const img = document.getElementById('lightbox-img');
            img.src = url;
            showModal(m);
            pushModalState();
            logAdEvent('view_atmosphere');
        }
        function closeLightbox() {
            // The close button's click also bubbles to the backdrop; only the first call may go back
            const m = document.getElementById('lightbox-modal');
            if (!m.classList.contains('open')) return;
            hideModal(m);
            popModalState();
        }

        // ─── BOOKLET MODAL ───
        function openBooklet() {
            if (bookletPages.length === 0) return;
            // Pages are fetched only from here: the hidden modal has no src on first load
            updateBooklet();
            showModal(document.getElementById('booklet-modal'));
            pushModalState();
            if (window.gtag) gtag('event', 'click_booklet', { event_category: 'engagement', page_path: '/link' });
            logAdEvent('view_booklet_menu');
        }
        function closeBooklet(e) {
            if (e && e.target !== e.currentTarget && !e.target.classList.contains('modal-close')) return;
            const m = document.getElementById('booklet-modal');
            if (!m.classList.contains('open')) return;
            hideModal(m);
            popModalState();
        }
        function updateBooklet() {
            const img = document.getElementById('booklet-img');
            if (img.getAttribute('src') !== bookletPages[currentBookletIdx]) img.src = bookletPages[currentBookletIdx];
            document.getElementById('booklet-counter').innerText = (currentBookletIdx + 1) + ' / ' + bookletPages.length;
            // Warm the next page so "next" turns instantly
            if (bookletPages[currentBookletIdx + 1]) (new Image()).src = bookletPages[currentBookletIdx + 1];
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

        // Outbound links without an ad conversion of their own (Instagram, Facebook, FAQ, check-in board,
        // LINE MAN): same dataLayer shape as click_line / click_call, so GTM can pick them up by event name
        function trackClick(eventName, destination) {
            if (isDebounced(eventName)) return;
            if (window.loadGtm) window.loadGtm();
            window.dataLayer.push({
                event: eventName,
                target_destination: destination,
                page_path: '/link'
            });
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
                    loadFullMenuData(true).then(function() {
                        const content = document.getElementById('full-menu-content');
                        if (content && content.style.display !== 'none') {
                            content.innerHTML = '';
                            toggleFullMenu();
                            toggleFullMenu();
                        }
                    }).catch(function() {});
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
                    supabase.from('menu_items').select('id, name, name_en, name_zh, name_lo, price, description, description_en, description_zh, description_lo, image_url, is_available, is_recommended, is_hausmade, category_id, sort_order').eq('is_available', true).order('sort_order'),
                    supabase.from('menu_categories').select('id, name, name_en, name_zh, name_lo, display_order').order('display_order'),
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

        // 4a. Full menu JSON, fetched by the page when the guest opens "ดูเมนูทั้งหมด"
        if (parsedUrl.searchParams.get('part') === 'menu') {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.setHeader('Cache-Control', isPurgeRequest ? 'no-cache, no-store, must-revalidate' : 'public, max-age=0, s-maxage=60, stale-while-revalidate=86400')
            return res.status(200).send(JSON.stringify(fullMenuPayload(data)))
        }

        // 4b. Generate Autonomous High-Performance Standalone HTML
        const html = generateStandaloneLandingHtml(data, { utmContent: parsedUrl.searchParams.get('utm_content') || '' })

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
