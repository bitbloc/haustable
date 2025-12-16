import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId, message, type } = await req.json()

    // Create Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch Token
    const { data: settingsData, error: settingsError } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'line_channel_access_token')
      .single()

    if (settingsError || !settingsData?.value) {
        throw new Error('LINE Token not found in settings')
    }

    const CHANNEL_ACCESS_TOKEN = settingsData.value

    // Fetch Target LINE ID
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('line_user_id') 
      .eq('id', userId)
      .single()
      
    const targetLineId = profile?.line_user_id || userId 
    
    if (!targetLineId) {
        throw new Error('No target LINE user ID found')
    }

    // Send to LINE
    const resp = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: targetLineId,
        messages: [{ type: 'text', text: message }]
      }),
    })

    if (!resp.ok) {
      const errorText = await resp.text()
      console.error("LINE API Error:", errorText)
      return new Response(JSON.stringify({ error: 'Failed to send to LINE', details: errorText }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: resp.status 
      })
    }

    return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (err) {
    console.error("Function Error:", err.message)
    return new Response(JSON.stringify({ error: err.message }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
    })
  }
})
