
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const LINE_CHANNEL_ACCESS_TOKEN = 'LKoEdJlI0uQUbjxot6TQEhxKGfZNDyPifZAYcuXK4OIxbHF56bqZvCT5NPuUSEsdZY2LOuDkDdMRwf62buy8il5ytzTqFxmjJToe3Hn3KFuAy4Jz2PQ7joM9xABSuyL4vkrU31DllxrMMqBFz1Up3gdB04t89/1O/w1cDnyilFU='
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

  try {
    const { message } = await req.json()

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: LINE_GROUP_ID,
        messages: [
          {
            type: 'text',
            text: message,
          },
        ],
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
