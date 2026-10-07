import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI'

const supabase = createClient(supabaseUrl, supabaseKey)

// In-memory cache to prevent Supabase PostgREST connection pool spikes and 504 Gateway Timeouts
let cachedSettings = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes in-memory

const DEFAULT_OG_DESCRIPTION = "อาหารใต้รสชัด บรรยากาศนั่งสบายริมโขง ครบทั้งเซ็ต กับข้าว และกาแฟ ร้านอาหารและคาเฟ่นครพนม เหมาะกับมื้อเที่ยง คุยงาน รับแขก หรือมื้อเย็น พริกแกงนครศรีฯ แท้ · ร้านเท่สไตล์ Thai Twist · กินอาหารใต้กินได้ทุกที่ · มีที่จอดรถสะดวก...";
const DEFAULT_OG_IMAGE = "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_og_image_url_1781846569771.jpg";

function generateLinkShellHtml(settings, lcpImageUrl) {
    const shopName = settings.link_shop_name || "In the haus | ร้านในบ้าน นครพนม";
    const shopNameTh = settings.link_shop_name_th || "ในบ้าน";
    const subtitle = settings.link_subtitle || "We Make It Bold . จริตจัด รสชัดเต็ม · Real Southern Taste";
    const hours = settings.link_hours || "เปิดทุกวัน 11:30 - 23:30 น. (ครัวปิด 22:00 น.)";
    const locationText = settings.link_location_text || "ตัวร้านตั้งอยู่บนถนนสุนทรวิจิตร ใกล้ลานพญาศรีสัตตนาคราช 2 นาที ริมโขง นครพนม";
    const logoUrl = settings.link_logo_url || "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_logo_url_1778317272888.png";
    const sig2 = settings.link_sig_img_2 || "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_sig_img_2_1783397084997.webp";
    const sig3 = settings.link_sig_img_3 || "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_sig_img_3_1783397146155.webp";
    const sigName1 = settings.link_sig_name_1 || "แกงไตปลา (รสชัดเจน)";
    const sigPrice1 = settings.link_sig_price_1 || "159";
    const sigName2 = settings.link_sig_name_2 || "ผัดใบเหลียงในบ้าน";
    const sigPrice2 = settings.link_sig_price_2 || "139";
    const sigName3 = settings.link_sig_name_3 || "สะตอผัดกุ้งจริตจัด";
    const sigPrice3 = settings.link_sig_price_3 || "299";

    const optImg = (url, w) => `https://wsrv.nl/?url=${encodeURIComponent((url || '').split('?')[0])}&w=${w}&q=75&output=webp`;

    return `<div class="ads-landing-page w-full min-h-screen flex flex-col bg-[var(--color-hallmark-paper)] text-[var(--color-hallmark-ink)] overflow-x-hidden font-[var(--font-body)] relative pb-safe">
        <div class="w-full max-w-xl mx-auto relative z-10 flex-grow flex flex-col border-x border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper)]">
            <header class="flex flex-col border-b border-[var(--color-hallmark-rule)] select-none">
                <div class="w-full bg-[#E9F344] text-[var(--color-hallmark-ink)] border-b border-[var(--color-hallmark-rule)] py-1.5 px-3 flex items-center justify-center overflow-hidden">
                    <span class="font-mono text-[9px] font-black uppercase tracking-widest truncate">// ${subtitle} //</span>
                </div>
                <div class="flex items-center gap-4 p-4 border-b border-[var(--color-hallmark-rule)]">
                    <img src="${optImg(logoUrl, 120)}" alt="IN THE HAUS Logo" class="w-14 h-14 object-cover border border-[var(--color-hallmark-ink)] flex-shrink-0" width="56" height="56" />
                    <div class="flex flex-col justify-center">
                        <h1 class="text-2xl font-[var(--font-display)] font-bold text-[var(--color-hallmark-ink)] tracking-widest uppercase leading-none">${shopName}</h1>
                        <p class="text-[var(--color-hallmark-ink-muted)] font-mono font-bold text-[10px] tracking-widest uppercase mt-2">${shopNameTh}</p>
                    </div>
                </div>
                <div class="grid grid-cols-2 divide-x divide-y divide-[var(--color-hallmark-rule)] font-[var(--font-body)] text-[10px] text-[var(--color-hallmark-ink)] uppercase font-semibold tracking-wider">
                    <div class="p-3 flex flex-col gap-1">
                        <span class="text-[var(--color-hallmark-ink-muted)] font-mono text-[9px]">STATUS</span>
                        <span class="flex items-center gap-1.5 text-xs font-bold"><span class="w-2 h-2 bg-emerald-500 border border-[var(--color-hallmark-rule)]"></span>OPEN DAILY</span>
                    </div>
                    <div class="p-3 flex flex-col gap-1">
                        <span class="text-[var(--color-hallmark-ink-muted)] font-mono text-[9px]">HOURS</span>
                        <span class="text-xs font-bold">${hours.replace('เปิดทุกวัน ', '')}</span>
                    </div>
                    <div class="p-3 flex flex-col gap-1 col-span-2 border-t border-[var(--color-hallmark-rule)]">
                        <span class="text-[var(--color-hallmark-ink-muted)] font-mono text-[9px]">LOC</span>
                        <span class="text-xs font-bold">${locationText}</span>
                    </div>
                </div>
                <a href="/link/hauscheckin" class="w-full bg-[var(--color-hallmark-ink)] text-[var(--color-hallmark-paper)] p-4 flex items-center justify-between border-t border-[var(--color-hallmark-rule)] cursor-pointer">
                    <span class="flex items-center gap-2">
                        <span class="relative flex h-2 w-2"><span class="relative inline-flex h-2 w-2 bg-emerald-500"></span></span>
                        <span class="font-mono text-[10px] font-extrabold uppercase tracking-widest text-[var(--color-hallmark-paper)]">LIVE STREAM</span>
                    </span>
                    <span class="font-[var(--font-body)] font-bold text-xs flex items-center gap-1"><span>ดูรูปภาพลูกค้า</span> <span class="font-mono font-bold">➔</span></span>
                </a>
                <div class="grid grid-cols-2 divide-x divide-[var(--color-hallmark-rule)] border-t border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper)] select-none">
                    <a href="/booking" class="p-3.5 sm:p-4 flex flex-col justify-between gap-1 bg-[var(--color-hallmark-paper)] cursor-pointer" id="cta-quick-booking">
                        <div class="flex items-center justify-between"><span class="text-[9px] font-mono font-bold tracking-widest text-[var(--color-hallmark-ink-muted)] uppercase">// RESERVATION</span><span class="font-mono text-xs font-bold text-[var(--color-hallmark-ink)]">➔</span></div>
                        <div><span class="font-[var(--font-body)] font-bold text-xs sm:text-[13px] text-[var(--color-hallmark-ink)] block leading-tight">จองโต๊ะล่วงหน้า</span><span class="font-mono text-[9px] font-bold text-[var(--color-hallmark-ink-muted)] tracking-wider block mt-0.5">BOOK A TABLE</span></div>
                    </a>
                    <a href="/pickup" class="p-3.5 sm:p-4 flex flex-col justify-between gap-1 bg-[var(--color-hallmark-paper)] cursor-pointer" id="cta-quick-pickup">
                        <div class="flex items-center justify-between"><span class="text-[9px] font-mono font-bold tracking-widest text-[var(--color-hallmark-ink-muted)] uppercase">// SELF-PICKUP</span><span class="font-mono text-xs font-bold text-[var(--color-hallmark-ink)]">➔</span></div>
                        <div><span class="font-[var(--font-body)] font-bold text-xs sm:text-[13px] text-[var(--color-hallmark-ink)] block leading-tight">สั่งอาหารรับหน้าร้าน</span><span class="font-mono text-[9px] font-bold text-[var(--color-hallmark-ink-muted)] tracking-wider block mt-0.5">PICK UP ONLINE</span></div>
                    </a>
                </div>
            </header>
            <div class="grid grid-cols-3 border-b border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper)] sticky top-0 z-30 select-none divide-x divide-[var(--color-hallmark-rule)]">
                <button class="py-4 flex items-center justify-center gap-2 font-mono text-xs font-bold tracking-widest bg-[var(--color-hallmark-ink)] text-[var(--color-hallmark-paper)]"><span class="text-[#f97316] font-black">*</span>MENU</button>
                <button class="py-4 flex items-center justify-center gap-2 font-mono text-xs font-bold tracking-widest bg-transparent text-[var(--color-hallmark-ink-muted)]">VIBE</button>
                <button class="py-4 flex items-center justify-center gap-2 font-mono text-xs font-bold tracking-widest bg-transparent text-[var(--color-hallmark-ink-muted)]">CONNECT</button>
            </div>
            <div class="space-y-6 flex-grow">
                <section class="border-b border-[var(--color-hallmark-rule)]">
                    <div class="flex items-center justify-between p-3 border-b border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper-dark)]">
                        <h3 class="font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-hallmark-ink)]">SIGNATURE DISHES</h3>
                        <span class="text-[10px] font-mono bg-[var(--color-hallmark-ink)] text-[var(--color-hallmark-paper)] px-2 py-0.5 font-bold uppercase tracking-wider border border-[var(--color-hallmark-ink)]">RECOMMENDED</span>
                    </div>
                    <div class="grid grid-cols-3 divide-x divide-[var(--color-hallmark-rule)]">
                        <div class="flex flex-col group bg-[var(--color-hallmark-paper)]">
                            <div class="aspect-square relative overflow-hidden bg-neutral-100 border-b border-[var(--color-hallmark-rule)]">
                                <img src="${lcpImageUrl}" alt="${sigName1}" class="w-full h-full object-cover" fetchpriority="high" loading="eager" decoding="async" width="160" height="160" />
                            </div>
                            <div class="p-3 flex-grow flex flex-col justify-between gap-2">
                                <p class="font-[var(--font-body)] font-bold text-xs leading-tight text-[var(--color-hallmark-ink)]">${sigName1}</p>
                                <p class="font-mono text-[11px] font-bold text-[var(--color-hallmark-ink-muted)]">฿${sigPrice1}</p>
                            </div>
                        </div>
                        <div class="flex flex-col group bg-[var(--color-hallmark-paper)]">
                            <div class="aspect-square relative overflow-hidden bg-neutral-100 border-b border-[var(--color-hallmark-rule)]">
                                <img src="${optImg(sig2, 400)}" alt="${sigName2}" class="w-full h-full object-cover" loading="lazy" decoding="async" width="160" height="160" />
                            </div>
                            <div class="p-3 flex-grow flex flex-col justify-between gap-2">
                                <p class="font-[var(--font-body)] font-bold text-xs leading-tight text-[var(--color-hallmark-ink)]">${sigName2}</p>
                                <p class="font-mono text-[11px] font-bold text-[var(--color-hallmark-ink-muted)]">฿${sigPrice2}</p>
                            </div>
                        </div>
                        <div class="flex flex-col group bg-[var(--color-hallmark-paper)]">
                            <div class="aspect-square relative overflow-hidden bg-neutral-100 border-b border-[var(--color-hallmark-rule)]">
                                <img src="${optImg(sig3, 400)}" alt="${sigName3}" class="w-full h-full object-cover" loading="lazy" decoding="async" width="160" height="160" />
                            </div>
                            <div class="p-3 flex-grow flex flex-col justify-between gap-2">
                                <p class="font-[var(--font-body)] font-bold text-xs leading-tight text-[var(--color-hallmark-ink)]">${sigName3}</p>
                                <p class="font-mono text-[11px] font-bold text-[var(--color-hallmark-ink-muted)]">฿${sigPrice3}</p>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    </div>`;
}

export default async function handler(req, res) {
    try {
        // 1. Fetch settings from Supabase (with in-memory cache and 2.5s timeout to prevent 504 Gateway Timeouts)
        let settings = {};
        const now = Date.now();
        if (cachedSettings && now < cacheExpiry) {
            settings = cachedSettings;
        } else {
            try {
                // Fetch all link_* settings with 2.5s timeout for full client pre-hydration
                const fetchPromise = supabase
                    .from('app_settings')
                    .select('key, value')
                    .like('key', 'link_%');
                
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), 2500));
                
                const { data: dbSettings, error: dbErr } = await Promise.race([fetchPromise, timeoutPromise]);
                if (!dbErr && Array.isArray(dbSettings)) {
                    settings = dbSettings.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
                    cachedSettings = settings;
                    cacheExpiry = now + CACHE_TTL_MS;
                } else if (cachedSettings) {
                    settings = cachedSettings;
                }
            } catch (err) {
                // On query timeout or Supabase load spike, gracefully fall back to cache or defaults
                if (cachedSettings) settings = cachedSettings;
            }
        }

        // 2. Content derived from Google Ad (with dynamic description override support)
        const title = "ร้านในบ้าน นครพนม | อาหารใต้รสชัด ริมโขง | จริตจัด รสชัดเจน"
        const description = settings.link_og_description || DEFAULT_OG_DESCRIPTION;
        
        // 3. Resolve OG Image URL & LCP Hero/Signature image:
        let imageUrl = settings.link_og_image_url || DEFAULT_OG_IMAGE;
        const sig1 = settings.link_sig_img_1 || "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_sig_img_1_1778318077216.jpg";
        const lcpImageUrl = `https://wsrv.nl/?url=${encodeURIComponent(sig1.split('?')[0])}&w=400&q=75&output=webp`;

        // 4. Read the production index.html file
        const indexPath = path.join(process.cwd(), 'dist', 'index.html')
        let html = fs.readFileSync(indexPath, 'utf8')

        // 5. Build dynamic Open Graph header tags & High-Performance Preload Links
        const parsedUrl = new URL(req.url || '/', 'https://haustable.vercel.app')
        let pathname = parsedUrl.pathname
        if (pathname === '/api/link') {
            pathname = '/link'
        }
        const ogUrl = `https://haustable.vercel.app${pathname}${parsedUrl.search}`

        const dynamicMetaTags = `
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${ogUrl}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <!-- Twitter / X -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${ogUrl}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />

    <!-- Core Web Vitals LCP Preload & Instant Pre-hydration -->
    <link rel="preconnect" href="https://wsrv.nl" crossorigin>
    <link rel="preload" as="image" href="${lcpImageUrl}" fetchpriority="high">
    <script>window.__PRELOADED_ADS_SETTINGS__ = ${JSON.stringify(settings)};</script>
        `

        // Replace the tags wrapped in the start/end comments in index.html
        const regex = /<!-- DYNAMIC_OG_TAGS_START -->[\s\S]*?<!-- DYNAMIC_OG_TAGS_END -->/
        if (regex.test(html)) {
            html = html.replace(regex, `<!-- DYNAMIC_OG_TAGS_START -->${dynamicMetaTags}\n    <!-- DYNAMIC_OG_TAGS_END -->`)
        } else {
            // Fallback insertion right before </head>
            html = html.replace('</head>', `${dynamicMetaTags}\n</head>`)
        }

        // Replace root shell with high-performance pre-rendered landing page shell
        const shellHtml = generateLinkShellHtml(settings, lcpImageUrl);
        const rootRegex = /<div id="root">[\s\S]*?<\/div>\s*(?=<!-- Dedicated Print Portal Root)/;
        if (rootRegex.test(html)) {
            html = html.replace(rootRegex, `<div id="root">${shellHtml}</div>\n    `);
        }

        // Send response with Vercel Edge CDN caching:
        // - Edge CDN caches for 24 hours (s-maxage=86400), turning TTFB from 1.5s to ~30ms
        // - stale-while-revalidate serves instantly while revalidating asynchronously
        res.setHeader('Content-Type', 'text/html')
        res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800')
        return res.status(200).send(html)

    } catch (err) {
        console.error('Dynamic SEO injection failed:', err)
        // Fallback: Send static index.html from dist
        try {
            const indexPath = path.join(process.cwd(), 'dist', 'index.html')
            const html = fs.readFileSync(indexPath, 'utf8')
            res.setHeader('Content-Type', 'text/html')
            res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800')
            return res.status(200).send(html)
        } catch (readErr) {
            return res.status(500).send('Internal Server Error')
        }
    }
}
