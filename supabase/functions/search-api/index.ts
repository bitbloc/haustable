// Reference price lookup for the stock item form.
// Searches makro.pro and returns product name, pack size and price.
// (Replaces the DuckDuckGo scraper, which returned no results from the edge.)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { parseMakroSearch, makroSearchUrl } from "./makro.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Signed-in staff only
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized', results: [] }, 401)
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) return json({ error: 'Unauthorized user', results: [] }, 401)

    let body: any = {}
    try { body = await req.json() } catch { body = {} }
    const keyword = String(body.keyword || '').trim().slice(0, 100)
    if (!keyword) return json({ source: 'makro', results: [] })

    const res = await fetch(makroSearchUrl(keyword), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'th-TH,th;q=0.9,en;q=0.8',
      },
    })
    if (!res.ok) throw new Error(`makro.pro ตอบกลับ ${res.status}`)

    const html = await res.text()
    const results = parseMakroSearch(html, 20)
    if (!results.length && !html.includes('__NEXT_DATA__')) {
      // Page came back without search data (blocked or layout changed): say so instead of "no results"
      throw new Error('อ่านหน้าค้นหาของ makro.pro ไม่ได้')
    }
    return json({ source: 'makro', results })
  } catch (err) {
    console.error('search-api error:', err)
    return json({ error: (err as Error).message, results: [] }, 500)
  }
})
