import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI'

const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req, res) {
    try {
        // 1. Fetch settings from Supabase
        const { data: dbSettings } = await supabase.from('app_settings').select('key, value').like('key', 'link_%')
        const settings = dbSettings ? dbSettings.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {}) : {}

        // 2. Content derived from Google Ad (with dynamic description override support)
        const title = "ร้านในบ้าน นครพนม | อาหารใต้รสชัด ริมโขง | จริตจัด รสชัดเจน"
        const description = settings.link_og_description || "อาหารใต้รสชัด บรรยากาศนั่งสบายริมโขง ครบทั้งเซ็ต กับข้าว และกาแฟ ร้านอาหารและคาเฟ่นครพนม เหมาะกับมื้อเที่ยง คุยงาน รับแขก หรือมื้อเย็น พริกแกงนครศรีฯ แท้ · ร้านเท่สไตล์ Thai Twist · กินอาหารใต้กินได้ทุกที่ · มีที่จอดรถสะดวก..."
        
        // 3. Resolve OG Image URL:
        // Prioritize settings.link_og_image_url (guaranteed compressed by back-office uploader).
        // Fallback directly to the optimized local og-food-preview.png (~875KB).
        // Avoid falling back to uncompressed database settings (like link_hero_url which is 22.6MB)
        // because Facebook crawlers will time out on large image sizes, showing a blank preview.
        let imageUrl = settings.link_og_image_url
        
        if (!imageUrl) {
            imageUrl = "https://haustable.vercel.app/og-food-preview.png"
        }

        // 4. Read the production index.html file
        const indexPath = path.join(process.cwd(), 'dist', 'index.html')
        let html = fs.readFileSync(indexPath, 'utf8')

        // 5. Build dynamic Open Graph header tags
        const dynamicMetaTags = `
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://haustable.vercel.app/link" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <!-- Twitter / X -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="https://haustable.vercel.app/link" />
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

        // Send response
        res.setHeader('Content-Type', 'text/html')
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
        return res.status(200).send(html)

    } catch (err) {
        console.error('Dynamic SEO injection failed:', err)
        // Fallback: Send static index.html from dist
        try {
            const indexPath = path.join(process.cwd(), 'dist', 'index.html')
            const html = fs.readFileSync(indexPath, 'utf8')
            res.setHeader('Content-Type', 'text/html')
            return res.status(200).send(html)
        } catch (readErr) {
            return res.status(500).send('Internal Server Error')
        }
    }
}
