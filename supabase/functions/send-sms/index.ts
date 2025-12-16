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
    const API_KEY = (credentials.sms_api_key || '').trim()
    const API_SECRET = (credentials.sms_api_secret || '').trim()

    console.log(`Sending SMS to ${phone} using Key: ${API_KEY.substring(0,4)}...`)

    // ThaiBulkSMS API Implementation
    // Endpoint: https://api-v2.thaibulksms.com/sms
    
    const payload = new URLSearchParams()
    payload.append('apiKey', API_KEY)
    payload.append('apiSecret', API_SECRET)
    payload.append('msisdn', phone)
    payload.append('message', message)
    payload.append('sender', 'IN THE HAUS')

    const resp = await fetch('https://api-v2.thaibulksms.com/sms', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        },
        body: payload
    })

    const result = await resp.json()

    if (!resp.ok) {
        // ThaiBulkSMS Error Handling
        throw new Error(`SMS Provider Error: ${JSON.stringify(result)} (Used Key: ${API_KEY.substring(0,4)}...${API_KEY.slice(-3)})`)
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
