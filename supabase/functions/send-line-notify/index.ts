
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')
const LINE_GROUP_ID = 'Cc2c65da5408563ef57ae61dee6ce3c1d'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    console.error('[send-line-notify] LINE_CHANNEL_ACCESS_TOKEN is not configured')
    return new Response(JSON.stringify({ error: 'LINE_CHANNEL_ACCESS_TOKEN is not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const { message, flexPayload } = await req.json()

    if (!message && !flexPayload) {
      return new Response(JSON.stringify({ error: 'Message or flexPayload is required' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const messagesArray = flexPayload ? [flexPayload] : [
      {
        type: 'text',
        text: message,
      },
    ]

    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: LINE_GROUP_ID,
        messages: messagesArray,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
        console.error('LINE API Error:', result)
        return new Response(JSON.stringify({ error: 'Failed to send to LINE', details: result }), { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
