import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // 1. Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone, message } = await req.json()

    if (!phone) throw new Error('Phone number is required')
    if (!message) throw new Error('Message is required')

    // Create Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch Credentials from Database
    const { data: settingsData, error: settingsError } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .in('key', ['sms_api_key', 'sms_api_secret'])

    if (settingsError || !settingsData || settingsData.length < 2) {
        throw new Error('SMS Credentials not found in settings')
    }

    const credentials = settingsData.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {})
    const API_KEY = credentials.sms_api_key
    const API_SECRET = credentials.sms_api_secret

    // ThaiBulkSMS API Implementation
    // Endpoint: https://api-v2.thaibulksms.com/sms
    
    // Format Phone Number (ensure 66 prefix if needed, or 08x)
    // ThaiBulkSMS usually accepts '08xxxxxxxx' or '668xxxxxxxx'
    
    const body = new URLSearchParams()
    body.append('key', API_KEY)
    body.append('secret', API_SECRET)
    body.append('msisdn', phone)
    body.append('message', message)
    body.append('sender', 'IN THE HAUS') // Or leave blank for default

    const resp = await fetch('https://api-v2.thaibulksms.com/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
    })

    const result = await resp.json()

    if (!resp.ok) {
        // ThaiBulkSMS Error Handling
        throw new Error(`SMS Provider Error: ${JSON.stringify(result)}`)
    }

    return new Response(JSON.stringify({ success: true, provider_result: result }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (err) {
    console.error("SMS Function Error:", err.message)
    return new Response(JSON.stringify({ error: err.message }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
    })
  }
})
