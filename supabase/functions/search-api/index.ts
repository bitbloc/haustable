import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) {
        return new Response('Unauthorized user', { status: 401, headers: corsHeaders })
    }

    let requestBody;
    try {
        requestBody = await req.json()
    } catch (e) {
        requestBody = {}
    }

    const keyword = requestBody.keyword || ''
    if (!keyword.trim()) {
      return new Response(JSON.stringify({ results: [] }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    console.log(`Web search price query for: ${keyword}`)

    // Query DuckDuckGo HTML
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(keyword + ' ราคา')}`
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    if (!response.ok) {
      throw new Error(`DuckDuckGo request failed with status: ${response.status}`)
    }

    const html = await response.text()
    
    // Split HTML by result block
    const resultBlocks = html.split('class="result ')
    const results = []

    // Current year to ignore matching as prices
    const currentYear = new Date().getFullYear()
    const thaiYear = currentYear + 543
    const yearsToIgnore = [currentYear, currentYear - 1, currentYear + 1, thaiYear, thaiYear - 1, thaiYear + 1]

    for (let i = 1; i < resultBlocks.length; i++) {
      const block = resultBlocks[i]

      // Extract title, snippet, and link
      const titleMatch = block.match(/<a[^>]+class="result__a"[^>]*>([\s\S]*?)<\/a>/)
      const snippetMatch = block.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)
      const urlMatch = block.match(/href="([^"]+uddg=([^"&]+)[^"]*)"/)

      if (titleMatch && snippetMatch) {
        const rawTitle = titleMatch[1].replace(/<[^>]*>/g, '').trim()
        const rawSnippet = snippetMatch[1].replace(/<[^>]*>/g, '').trim()
        
        let targetUrl = ''
        if (urlMatch) {
          try {
            targetUrl = decodeURIComponent(urlMatch[2])
          } catch {
            targetUrl = urlMatch[1]
          }
        }

        // Clean domain name for display
        let domain = ''
        try {
          const urlObj = new URL(targetUrl)
          domain = urlObj.hostname.replace('www.', '')
        } catch {
          domain = ''
        }

        // Extract numbers that might represent price
        // Patterns: ฿XX, XX บาท, XXบาท, XX.-
        const combinedText = `${rawTitle} ${rawSnippet}`
        const prices: number[] = []

        const priceRegexes = [
          /฿\s*(\d+(?:\.\d+)?)/g,
          /(\d+(?:\.\d+)?)\s*บาท/g,
          /ราคา\s*(\d+(?:\.\d+)?)/g,
          /(\d+(?:\.\d+)?)\s*\.-\s*/g
        ]

        for (const regex of priceRegexes) {
          let match
          // Reset lastIndex for safety
          regex.lastIndex = 0
          while ((match = regex.exec(combinedText)) !== null) {
            const price = parseFloat(match[1])
            if (price > 0 && !prices.includes(price) && price < 100000) {
              // Ignore matches that are likely years
              if (yearsToIgnore.includes(price)) {
                continue
              }
              prices.push(price)
            }
          }
        }

        results.push({
          title: rawTitle,
          snippet: rawSnippet,
          url: targetUrl,
          domain: domain,
          prices: prices.sort((a, b) => a - b)
        })
      }
    }

    return new Response(JSON.stringify({ results }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (err) {
    console.error('Search API Error:', err)
    return new Response(JSON.stringify({ error: err.message, results: [] }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
