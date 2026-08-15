import https from 'https'

function isSafeUrl(rawUrl) {
    try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            return false;
        }
        const hostname = parsed.hostname.toLowerCase();
        if (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '0.0.0.0' ||
            hostname === '::1' ||
            hostname.startsWith('10.') ||
            hostname.startsWith('192.168.') ||
            hostname.startsWith('169.254.') ||
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
            hostname.endsWith('.internal') ||
            hostname.endsWith('.local')
        ) {
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

export default async function handler(req, res) {
    const { url } = req.query

    if (!url || !isSafeUrl(url.trim())) {
        return res.status(400).json({ error: 'Valid external HTTP/HTTPS URL is required' })
    }

    try {
        // Resolve redirect using server-side GET request (only reading headers)
        const reqOpts = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        }

        https.get(url, reqOpts, (redirectRes) => {
            const redirectUrl = redirectRes.headers.location

            if ((redirectRes.statusCode === 302 || redirectRes.statusCode === 301) && redirectUrl) {
                return res.status(200).json({ resolvedUrl: redirectUrl })
            } else {
                return res.status(200).json({ resolvedUrl: url }) // Fallback to original
            }
        }).on('error', (e) => {
            console.error('Redirect resolution error:', e)
            return res.status(200).json({ resolvedUrl: url }) // Fallback to original
        })
    } catch (err) {
        console.error('Resolve-image function failed:', err)
        return res.status(200).json({ resolvedUrl: url }) // Fallback to original
    }
}
