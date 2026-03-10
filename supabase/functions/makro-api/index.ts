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

    // Verify auth if needed (optional, assuming we want it secured for our frontend)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) {
        return new Response('Unauthorized user', { status: 401, headers: corsHeaders })
    }

    // Get Notte API Key
    const { data: notteKeyData } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'notte_api_key').single()
    const NOTTE_API_KEY = notteKeyData?.value || Deno.env.get('NOTTE_API_KEY')

    if (!NOTTE_API_KEY) {
       console.error('NOTTE_API_KEY is not set')
       return new Response(JSON.stringify({ error: 'System configuration error' }), { 
           status: 500,
           headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       })
    }

    let requestBody;
    try {
        requestBody = await req.json()
    } catch (e) {
        requestBody = {}
    }

    const keyword = requestBody.keyword || '*'
    const page = requestBody.page || 1
    const limit = requestBody.limit || 20

    console.log(`Searching Makro API for keyword: ${keyword}, page: ${page}, limit: ${limit}`)

    const notteResp = await fetch('https://api.notte.cc/v1/functions/run', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${NOTTE_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            function_id: "81f38599-7e45-4ea9-baa5-a88b5eb56dce",
            variables: {
                keyword: keyword,
                page: page,
                limit: limit
            }
        })
    })

    if (!notteResp.ok) {
        const errTxt = await notteResp.text()
        console.error('Notte API failed:', errTxt)
        return new Response(JSON.stringify({ error: 'Failed to fetch from Makro API' }), { 
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    const notteData = await notteResp.json()
    const products = notteData.result || notteData.data || []

    return new Response(JSON.stringify({ products }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (err) {
    console.error('Global Webhook Error:', err)
    return new Response(JSON.stringify({ error: err.message }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
