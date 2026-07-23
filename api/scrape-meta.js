function decodeHTMLEntities(text) {
    if (!text) return '';
    return text
        .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
        .replace(/&#x([0-9a-fA-F]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

export default async function handler(req, res) {
    const { url } = req.query
    if (!url) {
        return res.status(400).json({ status: 'fail', message: 'Missing url parameter' })
    }

    try {
        const cleanUrl = url.trim()
        console.log(`[Scraper] Scraping metadata for URL: ${cleanUrl}`)
        
        const isFacebook = cleanUrl.includes('facebook.com') || cleanUrl.includes('fb.watch')

        // 1. For Facebook URLs, fetch directly with Twitterbot UA (bypasses FB login wall & returns raw OG meta + direct CDN image)
        if (isFacebook) {
            try {
                const fbRes = await fetch(cleanUrl, {
                    headers: {
                        'User-Agent': 'Twitterbot/1.0',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'th,en-US;q=0.9,en;q=0.8'
                    },
                    redirect: 'follow',
                    signal: AbortSignal.timeout(7000)
                })

                if (fbRes.ok) {
                    const html = await fbRes.text()
                    
                    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i) || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["']/i);
                    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i) || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i);
                    const ogImgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i) || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:image["']/i);
                    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);

                    const title = decodeHTMLEntities(ogTitleMatch ? ogTitleMatch[1] : (titleMatch ? titleMatch[1] : ''))
                    const description = decodeHTMLEntities(ogDescMatch ? ogDescMatch[1] : '')
                    const imageUrl = ogImgMatch ? decodeHTMLEntities(ogImgMatch[1]) : ''

                    if (title || description || imageUrl) {
                        console.log('[Scraper] FB scraping with Twitterbot UA successful')
                        const isGenericTitle = !title || title === 'Facebook' || title.includes('log in') || title.includes('Log In') || title.includes('Security Check')
                        const author = isGenericTitle ? 'Facebook User' : title

                        return res.status(200).json({
                            status: 'success',
                            data: {
                                title: isGenericTitle ? 'Facebook Post' : title,
                                description,
                                image: imageUrl ? { url: imageUrl } : null,
                                author
                            }
                        })
                    }
                }
            } catch (fbErr) {
                console.warn('[Scraper] FB Twitterbot fetch failed:', fbErr.message)
            }
        }

        // 2. Try fetching via microlink
        try {
            const microlinkUrl = `https://api.microlink.io?url=${encodeURIComponent(cleanUrl)}&prerender=true`
            const mRes = await fetch(microlinkUrl, { signal: AbortSignal.timeout(6000) })
            if (mRes.ok) {
                const json = await mRes.json()
                if (json.status === 'success' && json.data) {
                    console.log('[Scraper] Successfully fetched metadata via Microlink')
                    if (json.data.title) json.data.title = decodeHTMLEntities(json.data.title)
                    if (json.data.description) json.data.description = decodeHTMLEntities(json.data.description)
                    return res.status(200).json(json)
                }
            }
            console.warn(`[Scraper] Microlink returned non-200 or status not success: ${mRes.status}`)
        } catch (mErr) {
            console.warn('[Scraper] Microlink query failed:', mErr.message)
        }

        // 3. Direct HTML fetch fallback
        console.log('[Scraper] Falling back to direct HTML scrap...')
        const response = await fetch(cleanUrl, {
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

        const ogTitle = decodeHTMLEntities(getMetaContent('title') || getTitle())
        const ogDescription = decodeHTMLEntities(getMetaContent('description') || getMetaByNameContent('description') || '')
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

