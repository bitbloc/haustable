export default async function handler(req, res) {
    const { url } = req.query
    if (!url) {
        return res.status(400).json({ status: 'fail', message: 'Missing url parameter' })
    }

    try {
        console.log(`[Scraper] Scraping metadata for URL: ${url}`)
        
        // 1. Try fetching via microlink
        try {
            const microlinkUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}&prerender=true`
            const mRes = await fetch(microlinkUrl, { signal: AbortSignal.timeout(6000) })
            if (mRes.ok) {
                const json = await mRes.json()
                if (json.status === 'success' && json.data) {
                    console.log('[Scraper] Successfully fetched metadata via Microlink')
                    return res.status(200).json(json)
                }
            }
            console.warn(`[Scraper] Microlink returned non-200 or status not success: ${mRes.status}`)
        } catch (mErr) {
            console.warn('[Scraper] Microlink query failed:', mErr.message)
        }

        // 2. Direct HTML fetch fallback
        console.log('[Scraper] Falling back to direct HTML scrap...')
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            signal: AbortSignal.timeout(6000)
        })

        if (!response.ok) {
            throw new Error(`Direct fetch returned status code ${response.status}`)
        }

        const html = await response.text()
        
        // Extract meta tags
        const getMetaContent = (property) => {
            const regex = new RegExp(`<meta[^>]*property=["'](?:og:${property})["'][^>]*content=["']([^"']*)["']`, 'i')
            const regexAlt = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["'](?:og:${property})["']`, 'i')
            const match = html.match(regex) || html.match(regexAlt)
            return match ? match[1] : null
        }

        const getMetaByNameContent = (name) => {
            const regex = new RegExp(`<meta[^>]*name=["'](?:${name})["'][^>]*content=["']([^"']*)["']`, 'i')
            const regexAlt = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["'](?:${name})["']`, 'i')
            const match = html.match(regex) || html.match(regexAlt)
            return match ? match[1] : null
        }

        const getTitle = () => {
            const match = html.match(/<title>([\s\S]*?)<\/title>/i)
            return match ? match[1].trim() : ''
        }

        const ogTitle = getMetaContent('title') || getTitle()
        const ogDescription = getMetaContent('description') || getMetaByNameContent('description') || ''
        const ogImage = getMetaContent('image') || ''

        // Format to match Microlink response structure
        const result = {
            status: 'success',
            data: {
                title: ogTitle,
                description: ogDescription,
                image: ogImage ? { url: ogImage } : null,
                author: ogTitle.includes('Google Maps') ? 'Google Reviewer' : null
            }
        }

        console.log('[Scraper] Direct scrap completed successfully')
        return res.status(200).json(result)

    } catch (err) {
        console.error('[Scraper] Metadata resolving failed completely:', err)
        return res.status(500).json({ 
            status: 'fail', 
            message: `ไม่สามารถดึงข้อมูลได้: ${err.message}` 
        })
    }
}
