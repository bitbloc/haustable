import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI'

const supabase = createClient(supabaseUrl, supabaseKey)

// In-memory cache to prevent Supabase PostgREST connection pool spikes and 504 Gateway Timeouts
let cachedSettings = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes in-memory

const DEFAULT_OG_DESCRIPTION = "อาหารใต้รสชัด บรรยากาศนั่งสบายริมโขง ครบทั้งเซ็ต กับข้าว และกาแฟ ร้านอาหารและคาเฟ่นครพนม เหมาะกับมื้อเที่ยง คุยงาน รับแขก หรือมื้อเย็น พริกแกงนครศรีฯ แท้ · ร้านเท่สไตล์ Thai Twist · กินอาหารใต้กินได้ทุกที่ · มีที่จอดรถสะดวก...";
const DEFAULT_OG_IMAGE = "https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/link/link_og_image_url_1781846569771.jpg";

export default async function handler(req, res) {
    try {
        // 1. Fetch settings from Supabase (with in-memory cache and 2.5s timeout to prevent 504 Gateway Timeouts)
        let settings = {};
        const now = Date.now();
        if (cachedSettings && now < cacheExpiry) {
            settings = cachedSettings;
        } else {
            try {
                // Fetch strictly the 2 needed OG keys using exact index match instead of unindexed LIKE wildcard
                const fetchPromise = supabase
                    .from('app_settings')
                    .select('key, value')
                    .in('key', ['link_og_description', 'link_og_image_url']);
                
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
        
        // 3. Resolve OG Image URL:
        let imageUrl = settings.link_og_image_url || DEFAULT_OG_IMAGE;

        // 4. Read the production index.html file
        const indexPath = path.join(process.cwd(), 'dist', 'index.html')
        let html = fs.readFileSync(indexPath, 'utf8')

        // 5. Build dynamic Open Graph header tags
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
        `

        // Replace the tags wrapped in the start/end comments in index.html
        const regex = /<!-- DYNAMIC_OG_TAGS_START -->[\s\S]*?<!-- DYNAMIC_OG_TAGS_END -->/
        if (regex.test(html)) {
            html = html.replace(regex, `<!-- DYNAMIC_OG_TAGS_START -->${dynamicMetaTags}\n    <!-- DYNAMIC_OG_TAGS_END -->`)
        } else {
            // Fallback insertion right before </head>
            html = html.replace('</head>', `${dynamicMetaTags}\n</head>`)
        }

        // Send response with Vercel Edge CDN caching:
        // - Edge CDN caches for 5 mins (s-maxage=300), reducing Supabase traffic by >95%
        // - stale-while-revalidate serves instantly while revalidating asynchronously
        res.setHeader('Content-Type', 'text/html')
        res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400')
        return res.status(200).send(html)

    } catch (err) {
        console.error('Dynamic SEO injection failed:', err)
        // Fallback: Send static index.html from dist
        try {
            const indexPath = path.join(process.cwd(), 'dist', 'index.html')
            const html = fs.readFileSync(indexPath, 'utf8')
            res.setHeader('Content-Type', 'text/html')
            res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400')
            return res.status(200).send(html)
        } catch (readErr) {
            return res.status(500).send('Internal Server Error')
        }
    }
}
