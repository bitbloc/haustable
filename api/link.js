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
    link_url_4: "https://maps.app.goo.gl/3qjFz8N7cK6R4g969",
    link_tags: "อาหารใต้รสจัด, คาเฟ่ริมโขง, นครพนม, พริกแกงใต้แท้, ที่จอดรถสะดวก, อาหารจานเดียว, จริตจัด รสชัดเต็ม"
}

const DEFAULT_SIGNATURES = [
    { name: "แกงไตปลา (รสชัดเจน)", price: "159", img: "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_sig_img_1_1778318077216.jpg" },
    { name: "ผัดใบเหลียงในบ้าน", price: "139", img: "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_sig_img_2_1783397084997.webp" },
    { name: "สะตอผัดกุ้งจริตจัด", price: "299", img: "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_sig_img_3_1783397146155.webp" }
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

    // Signatures
    const sig1Img = optImg(settings.link_sig_img_1 || DEFAULT_SETTINGS.link_sig_img_1, 400, 75) // LCP 400px
    const sig2Img = optImg(settings.link_sig_img_2 || DEFAULT_SETTINGS.link_sig_img_2, 200, 75) // Properly sized 200px
    const sig3Img = optImg(settings.link_sig_img_3 || DEFAULT_SETTINGS.link_sig_img_3, 200, 75) // Properly sized 200px
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
    const mapUrl = escapeHtml(settings.link_map_url || settings.link_url_4 || DEFAULT_SETTINGS.link_url_4)

    // Booklet Pages
    const bookletImages = []
    for (let i = 1; i <= 10; i++) {
        const k = `link_menu_${i}`
        if (settings[k]) bookletImages.push(settings[k])
    }

    // Atmosphere Photos
    const atmImages = []
    for (let i = 1; i <= 6; i++) {
        const k = `link_atm_img_${i}`
        if (settings[k]) atmImages.push(settings[k])
    }

    // Recommended Specialties
    const recommendedItems = menuItems.filter(i => i.is_recommended).slice(0, 15)

    // Tags
    const tags = (settings.link_tags || DEFAULT_SETTINGS.link_tags).split(',').map(t => t.trim()).filter(Boolean)

    return `<!doctype html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
    <title>${shopName} | อาหารใต้รสชัด ริมโขง นครพนม</title>
    <meta name="description" content="อาหารใต้รสชัด บรรยากาศนั่งสบายริมโขง ครบทั้งเซ็ต กับข้าว และกาแฟ ร้านอาหารและคาเฟ่นครพนม เหมาะกับมื้อเที่ยง คุยงาน รับแขก หรือมื้อเย็น พริกแกงนครศรีฯ แท้ · มีที่จอดรถสะดวก">
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

    <!-- High Performance Preconnect & Image Preloads (Zero Render-Blocking Overhead) -->
    <link rel="preconnect" href="https://wsrv.nl" crossorigin>
    <link rel="preload" as="image" href="${sig1Img}" fetchpriority="high">
    <link rel="preload" as="image" href="${sig2Img}" fetchpriority="high">
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

        .container { width: 100%; max-width: 580px; margin: 0 auto; background: var(--color-paper); border-left: 1px solid var(--color-rule); border-right: 1px solid var(--color-rule); min-height: 100vh; display: flex; flex-direction: column; padding-bottom: 80px; }
        .marquee { background: #E9F344; color: var(--color-ink); border-bottom: 1px solid var(--color-rule); padding: 6px 12px; font-family: var(--font-mono); font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .header-cell { display: flex; align-items: center; gap: 16px; padding: 16px; border-bottom: 1px solid var(--color-rule); }
        .logo-box { width: 56px; height: 56px; flex-shrink: 0; border: 1px solid var(--color-ink); object-fit: cover; }
        .shop-title { font-family: var(--font-display); font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; line-height: 1.15; color: var(--color-ink); overflow-wrap: anywhere; min-width: 0; }
        .shop-sub { font-family: var(--font-mono); font-size: 10px; font-weight: bold; letter-spacing: 0.15em; text-transform: uppercase; color: var(--color-ink-muted); margin-top: 4px; }

        .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-bottom: 1px solid var(--color-rule); font-size: 10px; }
        .meta-item { padding: 12px; border-right: 1px solid var(--color-rule); border-bottom: 1px solid var(--color-rule); display: flex; flex-direction: column; gap: 4px; }
        .meta-item:nth-child(2) { border-right: none; }
        .meta-item.full { grid-column: span 2; border-right: none; border-bottom: none; }
        .meta-label { font-family: var(--font-mono); font-size: 9px; color: var(--color-ink-muted); font-weight: bold; letter-spacing: 0.08em; }
        .meta-val { font-size: 12px; font-weight: bold; display: flex; align-items: center; gap: 6px; }
        .dot-green { width: 8px; height: 8px; background: #10B981; border: 1px solid var(--color-rule); display: inline-block; flex-shrink: 0; }

        .live-stream { background: var(--color-ink); color: var(--color-paper); padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-rule); font-size: 12px; font-weight: bold; }
        .quick-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-bottom: 1px solid var(--color-rule); }
        .quick-btn { padding: 14px 16px; background: var(--color-paper); border-right: 1px solid var(--color-rule); display: flex; flex-direction: column; justify-content: space-between; gap: 4px; }
        .quick-btn:last-child { border-right: none; }
        .quick-btn:hover { background: var(--color-paper-warm); }
        .quick-tag { font-family: var(--font-mono); font-size: 9px; font-weight: bold; color: var(--color-ink-muted); letter-spacing: 0.08em; display: flex; justify-content: space-between; }
        .quick-title { font-size: 13px; font-weight: bold; color: var(--color-ink); }
        .quick-sub { font-family: var(--font-mono); font-size: 9px; color: var(--color-ink-muted); margin-top: 2px; }

        .tab-bar { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-bottom: 1px solid var(--color-rule); background: var(--color-paper); position: sticky; top: 0; z-index: 30; }
        .tab-btn { padding: 14px 8px; font-family: var(--font-mono); font-size: 11px; font-weight: bold; letter-spacing: 0.1em; text-align: center; border-right: 1px solid var(--color-rule); color: var(--color-ink-muted); background: transparent; }
        .tab-btn:last-child { border-right: none; }
        .tab-btn.active { background: var(--color-ink); color: var(--color-paper); }
        .tab-btn.active span { color: #f97316; }

        .section-header { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--color-paper-warm); border-bottom: 1px solid var(--color-rule); }
        .section-title { font-family: var(--font-mono); font-size: 11px; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; }
        .badge { font-family: var(--font-mono); font-size: 9px; font-weight: bold; padding: 2px 6px; background: var(--color-ink); color: var(--color-paper); border: 1px solid var(--color-ink); }

        .sig-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-bottom: 1px solid var(--color-rule); }
        .sig-card { border-right: 1px solid var(--color-rule); display: flex; flex-direction: column; height: 100%; background: var(--color-paper); cursor: pointer; }
        .sig-card:last-child { border-right: none; }
        .sig-img-wrap { width: 100%; aspect-ratio: 1/1; overflow: hidden; background: var(--color-paper-warm); border-bottom: 1px solid var(--color-rule); contain: paint layout; }
        .sig-img-wrap img { width: 100%; height: 100%; object-fit: cover; aspect-ratio: 1/1; transition: transform 0.2s ease; }
        .sig-card:hover .sig-img-wrap img { transform: scale(1.04); }
        .sig-body { padding: 10px; display: flex; flex-direction: column; justify-content: space-between; flex: 1; gap: 6px; }
        .sig-name { font-size: 12px; font-weight: bold; line-height: 1.25; color: var(--color-ink); }
        .sig-price { font-family: var(--font-mono); font-size: 11px; font-weight: bold; color: var(--color-ink-muted); }

        .booklet-card { padding: 14px 16px; border-bottom: 1px solid var(--color-rule); display: flex; align-items: center; justify-content: space-between; background: var(--color-paper); cursor: pointer; gap: 12px; }
        .booklet-card:hover { background: var(--color-paper-warm); }

        .item-row { display: flex; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--color-rule); background: var(--color-paper); gap: 12px; align-items: flex-start; cursor: pointer; }
        .item-row:hover { background: var(--color-paper-warm); }
        .item-info { flex: 1; min-width: 0; }
        .item-name { font-size: 13px; font-weight: bold; color: var(--color-ink); }
        .item-desc { font-size: 11px; color: var(--color-ink-muted); margin-top: 3px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
        .modifier-tag { display: inline-block; font-family: var(--font-mono); font-size: 9.5px; font-weight: 700; color: var(--color-ink); background: var(--color-paper-warm); border: 1px solid var(--color-rule); padding: 1px 6px; border-radius: 2px; margin-bottom: 2px; letter-spacing: 0.04em; vertical-align: middle; }
        .item-price { font-family: var(--font-mono); font-size: 12px; font-weight: bold; color: var(--color-ink); margin-top: 4px; }
        .item-thumb { width: 56px; height: 56px; object-fit: cover; border: 1px solid var(--color-rule); flex-shrink: 0; background: var(--color-paper-warm); }

        .full-menu-btn { width: 100%; padding: 16px; background: var(--color-ink); color: var(--color-paper); font-family: var(--font-mono); font-size: 11px; font-weight: bold; letter-spacing: 0.12em; text-align: center; text-transform: uppercase; border-bottom: 1px solid var(--color-rule); display: block; }
        .full-menu-btn:hover { background: #27272a; }

        .gallery-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-bottom: 1px solid var(--color-rule); }
        .gallery-item { aspect-ratio: 1/1; overflow: hidden; border-right: 1px solid var(--color-rule); border-bottom: 1px solid var(--color-rule); cursor: pointer; background: var(--color-paper-warm); }
        .gallery-item:nth-child(2n) { border-right: none; }
        .gallery-item img { width: 100%; height: 100%; object-fit: cover; aspect-ratio: 1/1; transition: transform 0.2s; }
        .gallery-item:hover img { transform: scale(1.04); }

        .connect-row { padding: 14px 16px; border-bottom: 1px solid var(--color-rule); display: flex; justify-content: space-between; align-items: center; background: var(--color-paper); font-size: 12px; font-weight: bold; }
        .connect-row:hover { background: var(--color-paper-warm); }
        .connect-row.line { background: var(--color-line-bg); color: #fff; }
        .connect-row.line:hover { background: #007335; }
        .connect-row.lineman { background: var(--color-ink); color: var(--color-paper); }

        .tags-wrap { padding: 16px 12px; display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; border-bottom: 1px solid var(--color-rule); }
        .tag-pill { padding: 4px 10px; background: var(--color-paper-warm); border: 1px solid var(--color-rule); font-family: var(--font-mono); font-size: 9px; color: var(--color-ink-muted); border-radius: 2px; }

        footer { padding: 28px 20px 88px 20px; text-align: center; font-size: 9px; color: var(--color-ink-muted); font-family: var(--font-mono); display: flex; flex-direction: column; align-items: center; gap: 8px; border-top: 1px solid var(--color-rule); background: var(--color-paper); }
        .footer-brand { font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-ink); }
        .footer-sub { font-family: var(--font-body); font-size: 10px; color: var(--color-ink-muted); letter-spacing: 0.05em; }
        .footer-rule { width: 32px; height: 1px; background: var(--color-rule); margin: 4px 0; }
        .footer-seo { max-width: 420px; margin: 4px auto; font-family: var(--font-body); font-size: 8.5px; line-height: 1.75; color: var(--color-seo-text); text-align: center; letter-spacing: 0.01em; }
        .footer-seo p { margin: 0; }
        .footer-copy { font-size: 8px; letter-spacing: 0.15em; color: var(--color-ink-muted); margin-top: 2px; }

        .sticky-bar { position: fixed; bottom: 12px; left: 50%; transform: translateX(-50%); width: calc(100% - 24px); max-width: 440px; background: var(--color-paper); border: 1px solid var(--color-ink); padding: 8px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; z-index: 50; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 2px; }
        .sticky-btn { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 10px 4px; font-family: var(--font-mono); font-size: 9px; font-weight: bold; letter-spacing: 0.05em; text-transform: uppercase; border-radius: 2px; text-align: center; }
        .sticky-btn.line { background: var(--color-line-bg); color: #ffffff; font-weight: 800; }
        .sticky-btn.map { background: var(--color-paper-warm); border: 1px solid var(--color-rule); color: var(--color-ink); }
        .sticky-btn.call { background: var(--color-ink); color: var(--color-paper); }

        .modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 100; align-items: center; justify-content: center; padding: 16px; }
        .modal.open { display: flex; }
        .modal-content { max-width: 90vw; max-height: 85vh; object-fit: contain; }
        .modal-close { position: absolute; top: 16px; right: 16px; color: #fff; font-family: var(--font-mono); font-size: 18px; padding: 8px 12px; background: rgba(0,0,0,0.6); border: 1px solid #666; border-radius: 4px; }
    </style>

    <!-- Immediate Google Tag Queue (Zero Event Loss, Non-blocking Deferred Execution) -->
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){window.dataLayer.push(arguments);}
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', 'AW-11227095880');
        gtag('config', 'G-D1M18Z54LM', { send_page_view: true });

        // Non-blocking deferred loading of GTM script to keep main thread free for LCP
        (function() {
            let loaded = false;
            function loadGtm() {
                if (loaded) return;
                loaded = true;
                const s = document.createElement('script');
                s.async = true;
                s.src = 'https://www.googletagmanager.com/gtag/js?id=G-D1M18Z54LM';
                document.head.appendChild(s);
            }
            if (document.readyState === 'complete') {
                setTimeout(loadGtm, 2000);
            } else {
                window.addEventListener('load', () => setTimeout(loadGtm, 2000), { once: true });
            }
            ['click', 'touchstart', 'scroll'].forEach(evt => window.addEventListener(evt, loadGtm, { once: true, passive: true }));
        })();
    </script>
</head>
<body>
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

        <!-- Tabular Metadata Grid -->
        <div class="meta-grid">
            <div class="meta-item">
                <span class="meta-label">STATUS</span>
                <span class="meta-val"><span class="dot-green"></span> OPEN DAILY</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">HOURS</span>
                <span class="meta-val">${hours.replace('เปิดทุกวัน ', '')}</span>
            </div>
            <div class="meta-item full">
                <span class="meta-label">LOCATION</span>
                <span class="meta-val">${locationText}</span>
            </div>
        </div>

        <!-- Live Stream Customer Photos Ticker -->
        <a href="/link/hauscheckin" class="live-stream">
            <span style="display:flex;align-items:center;gap:8px;">
                <span class="dot-green"></span>
                <span style="font-family:var(--font-mono);font-size:10px;letter-spacing:0.1em;">LIVE STREAM</span>
            </span>
            <span>ดูรูปภาพลูกค้า ➔</span>
        </a>

        <!-- Quick Actions: Reservation & Pickup -->
        <div class="quick-grid">
            <a href="/booking" class="quick-btn" id="btn-quick-booking">
                <div class="quick-tag"><span>// RESERVATION</span><span>➔</span></div>
                <div>
                    <div class="quick-title">จองโต๊ะล่วงหน้า</div>
                    <div class="quick-sub">BOOK A TABLE</div>
                </div>
            </a>
            <a href="/pickup" class="quick-btn" id="btn-quick-pickup">
                <div class="quick-tag"><span>// SELF-PICKUP</span><span>➔</span></div>
                <div>
                    <div class="quick-title">สั่งอาหารรับหน้าร้าน</div>
                    <div class="quick-sub">PICK UP ONLINE</div>
                </div>
            </a>
        </div>

        <!-- Tab Switcher -->
        <div class="tab-bar">
            <button class="tab-btn active" id="tab-btn-menu" onclick="switchSection('menu')"><span>*</span> MENU</button>
            <button class="tab-btn" id="tab-btn-vibe" onclick="switchSection('vibe')">VIBE</button>
            <button class="tab-btn" id="tab-btn-connect" onclick="switchSection('connect')">CONNECT</button>
        </div>

        <!-- ─── SECTION 1: MENU ─── -->
        <div id="sec-menu">
            <!-- 3 Signature Dishes (LCP Preloaded) -->
            <div class="section-header">
                <span class="section-title">SIGNATURE DISHES</span>
                <span class="badge">RECOMMENDED</span>
            </div>
            <div class="sig-grid">
                <div class="sig-card" onclick="openLightbox('${sig1Img}')">
                    <div class="sig-img-wrap">
                        <img src="${sig1Img}" alt="${sig1Name}" fetchpriority="high" loading="eager" decoding="async" width="160" height="160">
                    </div>
                    <div class="sig-body">
                        <div class="sig-name">${sig1Name}</div>
                        <div class="sig-price">฿${sig1Price}</div>
                    </div>
                </div>
                <div class="sig-card" onclick="openLightbox('${optImg(settings.link_sig_img_2, 800)}')">
                    <div class="sig-img-wrap">
                        <img src="${sig2Img}" alt="${sig2Name}" fetchpriority="high" loading="eager" decoding="async" width="160" height="160">
                    </div>
                    <div class="sig-body">
                        <div class="sig-name">${sig2Name}</div>
                        <div class="sig-price">฿${sig2Price}</div>
                    </div>
                </div>
                <div class="sig-card" onclick="openLightbox('${optImg(settings.link_sig_img_3, 800)}')">
                    <div class="sig-img-wrap">
                        <img src="${sig3Img}" alt="${sig3Name}" fetchpriority="high" loading="eager" decoding="async" width="160" height="160">
                    </div>
                    <div class="sig-body">
                        <div class="sig-name">${sig3Name}</div>
                        <div class="sig-price">฿${sig3Price}</div>
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
                        <div class="item-name">${escapeHtml(item.name)}</div>
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

        <!-- ─── SECTION 2: VIBE / ATMOSPHERE ─── -->
        <div id="sec-vibe" style="display:none;">
            ${atmImages.length > 0 ? `
            <div class="section-header">
                <span class="section-title">ATMOSPHERE IMAGES</span>
                <span class="meta-label">${atmImages.length} VIEWS</span>
            </div>
            <div class="gallery-grid">
                ${atmImages.map((img, i) => `
                <div class="gallery-item" onclick="openLightbox('${optImg(img, 900)}')">
                    <img src="${optImg(img, 300)}" alt="Atmosphere ${i+1}" loading="lazy" width="200" height="200">
                </div>`).join('')}
            </div>` : ''}

            ${checkins.length > 0 ? `
            <div class="section-header">
                <span class="section-title">CUSTOMER MOMENTS</span>
                <span class="badge" style="background:#10B981;border-color:#10B981;">LIVE</span>
            </div>
            <div class="gallery-grid">
                ${checkins.map((chk, i) => `
                <div class="gallery-item" onclick="openLightbox('${optImg(chk.image_url, 900)}')">
                    <img src="${optImg(chk.image_url, 300)}" alt="Checkin ${i+1}" loading="lazy" width="200" height="200">
                </div>`).join('')}
            </div>` : ''}
        </div>

        <!-- ─── SECTION 3: CONNECT ─── -->
        <div id="sec-connect" style="display:none;">
            <div class="section-header">
                <span class="section-title">DIRECT CONTACT</span>
            </div>
            <a href="${lineUrl}" target="_blank" rel="noopener noreferrer" class="connect-row line" onclick="handleLineClick(event)">
                <span>LINE OA // แชทสอบถามหรือสั่งอาหาร</span>
                <span style="font-family:var(--font-mono);">➔</span>
            </a>
            <a href="tel:0985284217" class="connect-row" onclick="handleCallClick(event)">
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
            <a href="https://lin.ee/8uqmIzZ" target="_blank" rel="noopener noreferrer" class="connect-row lineman">
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
            <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="connect-row" style="background:var(--color-ink);color:var(--color-paper);" onclick="handleDirectionsClick(event)">
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
        <div class="sticky-bar">
            <a href="${lineUrl}" target="_blank" rel="noopener noreferrer" class="sticky-btn line" onclick="handleLineClick(event)">
                LINE CHAT
            </a>
            <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="sticky-btn map" onclick="handleDirectionsClick(event)">
                DIRECTIONS
            </a>
            <a href="tel:0985284217" class="sticky-btn call" onclick="handleCallClick(event)">
                CALL US
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

        // ─── TAB SWITCHING ───
        function switchSection(name) {
            document.getElementById('sec-menu').style.display = name === 'menu' ? 'block' : 'none';
            document.getElementById('sec-vibe').style.display = name === 'vibe' ? 'block' : 'none';
            document.getElementById('sec-connect').style.display = name === 'connect' ? 'block' : 'none';

            document.getElementById('tab-btn-menu').className = 'tab-btn' + (name === 'menu' ? ' active' : '');
            document.getElementById('tab-btn-vibe').className = 'tab-btn' + (name === 'vibe' ? ' active' : '');
            document.getElementById('tab-btn-connect').className = 'tab-btn' + (name === 'connect' ? ' active' : '');
        }

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
            var lines = String(desc).trim().split('\n');
            var html = '';
            lines.forEach(function(l) {
                var t = l.trim();
                if (!t) return;
                if (/^(cocktail|coctail|mocktail)\s*\+\s*\d+/i.test(t) || /^\+\s*\d+/.test(t)) {
                    html += '<span class="modifier-tag">' + escapeClientHtml(t) + '</span><br>';
                } else {
                    html += '<span>' + escapeClientHtml(t) + '</span><br>';
                }
            });
            return html.replace(/(<br>)+$/, '');
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
                                html += '<div class="item-row"' + clickAttr + '><div class="item-info"><div class="item-name">' + escapeClientHtml(item.name) + '</div>' + descHtml + '<div class="item-price">฿' + escapeClientHtml(item.price) + '</div></div>' + thumb + '</div>';
                            });
                            html += '</div>';
                        });
                        content.innerHTML = html;
                    } catch(e) {}
                }
                content.style.display = 'block';
                btn.innerText = '[-] CLOSE FULL MENU';
                if (window.gtag) gtag('event', 'view_full_menu', { event_category: 'engagement', page_path: '/link' });
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
        }
        function closeLightbox() {
            document.getElementById('lightbox-modal').classList.remove('open');
        }

        // ─── BOOKLET MODAL ───
        function openBooklet() {
            if (bookletPages.length === 0) return;
            document.getElementById('booklet-modal').classList.add('open');
            if (window.gtag) gtag('event', 'click_booklet', { event_category: 'engagement', page_path: '/link' });
        }
        function closeBooklet(e) {
            if (e && e.target !== e.currentTarget && !e.target.classList.contains('modal-close')) return;
            document.getElementById('booklet-modal').classList.remove('open');
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

        function getUtmParams() {
            try {
                const p = new URLSearchParams(window.location.search);
                return {
                    utm_source: p.get('utm_source') || localStorage.getItem('onhaus_utm_source') || '',
                    utm_medium: p.get('utm_medium') || localStorage.getItem('onhaus_utm_medium') || '',
                    utm_campaign: p.get('utm_campaign') || localStorage.getItem('onhaus_utm_campaign') || '',
                    utm_content: p.get('utm_content') || localStorage.getItem('onhaus_utm_content') || ''
                };
            } catch(e) { return {}; }
        }

        function logAdEvent(action) {
            try {
                const utms = getUtmParams();
                const payload = {
                    action,
                    page_path: '/link',
                    timestamp: new Date().toISOString(),
                    user_agent: navigator.userAgent,
                    ...utms
                };
                // Fire to Supabase via sendBeacon or keepalive fetch
                const url = '${supabaseUrl}/rest/v1/ad_events';
                const body = JSON.stringify(payload);
                if (navigator.sendBeacon) {
                    const blob = new Blob([body], { type: 'application/json' });
                    navigator.sendBeacon(url + '?apikey=${supabaseKey}', blob);
                } else {
                    fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'apikey': '${supabaseKey}', 'Authorization': 'Bearer ${supabaseKey}' },
                        body,
                        keepalive: true
                    }).catch(() => {});
                }
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
            runAnalytics(() => {
                if (window.gtag) {
                    gtag('event', 'conversion', { send_to: 'AW-11227095880/tBbmCO-Vr-EcEMjGv-kp', transport: 'beacon' });
                    gtag('event', 'click_call', { event_category: 'contact', event_label: '098-528-4217', page_path: '/link' });
                }
                logAdEvent('call');
            });
        }

        function handleDirectionsClick(e) {
            if (isDebounced('directions')) return;
            runAnalytics(() => {
                if (window.gtag) {
                    gtag('event', 'conversion', { send_to: 'AW-11227095880/uWqACPuDvOEcEMjGv-kp', transport: 'beacon' });
                    gtag('event', 'click_directions', { event_category: 'contact', page_path: '/link' });
                }
                logAdEvent('directions');
            });
        }

        function handleLineClick(e) {
            if (isDebounced('line')) return;
            runAnalytics(() => {
                if (window.gtag) {
                    gtag('event', 'conversion', { send_to: 'AW-11227095880/XCMIClO2BwOEcEMjGv-kp', transport: 'beacon' });
                    gtag('event', 'click_line', { event_category: 'contact', page_path: '/link' });
                }
                logAdEvent('line');
            });
        }

        // Preserve UTM Search Parameters on internal navigation
        (function() {
            if (window.location.search) {
                document.querySelectorAll('a').forEach(a => {
                    const h = a.getAttribute('href');
                    if (h && (h.startsWith('/booking') || h.startsWith('/pickup') || h.startsWith('/qa') || h.startsWith('/link/hauscheckin'))) {
                        a.setAttribute('href', h + (h.includes('?') ? '&' : '?') + window.location.search.slice(1));
                    }
                });
            }
            logAdEvent('page_view');
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
                            const match = newHtml.match(/<script id="full-menu-data" type="application\/json">([\s\S]*?)<\/script>/);
                            if (match && match[1]) {
                                const script = document.getElementById('full-menu-data');
                                if (script) {
                                    script.textContent = match[1];
                                    const content = document.getElementById('full-menu-content');
                                    if (content && content.style.display !== 'none') {
                                        content.innerHTML = '';
                                        toggleFullMenu();
                                        toggleFullMenu();
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
        let data = { settings: DEFAULT_SETTINGS, menuItems: [], categories: [], checkins: [] }
        const now = Date.now()

        if (!isPurgeRequest && cachedPageData && now < cacheExpiry) {
            data = cachedPageData
        } else {
            try {
                const fetchPromise = Promise.all([
                    supabase.from('app_settings').select('key, value').like('key', 'link_%'),
                    supabase.from('menu_items').select('id, name, price, description, image_url, is_available, is_recommended, category_id, sort_order').eq('is_available', true).order('sort_order'),
                    supabase.from('menu_categories').select('id, name, display_order').order('display_order'),
                    supabase.from('haus_checkins').select('id, image_url, text, is_visible').eq('is_visible', true).limit(8)
                ])

                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase fetch timeout')), 2500))
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
