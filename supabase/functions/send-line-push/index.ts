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
    const { userId, targetLineId: providedTargetId, message, type, bookingDetails } = await req.json()

    // 1. Setup Admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Fetch Channel Token
    const { data: settingsData } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'line_channel_access_token').single()
    if (!settingsData?.value) throw new Error('LINE Token missing')
    const CHANNEL_ACCESS_TOKEN = settingsData.value

    // 3. Determine Target LINE ID
    let lineId = providedTargetId
    if (!lineId) {
        // Fallback Lookup
        const { data: profile } = await supabaseAdmin.from('profiles').select('line_user_id').eq('id', userId).single()
        lineId = profile?.line_user_id
    }
    
    // Check legacy direct ID (starts with U)
    if (!lineId && typeof userId === 'string' && userId.startsWith('U')) lineId = userId

    if (!lineId) {
        console.log("No valid LINE ID found for user:", userId)
        return new Response(JSON.stringify({ skipped: true, reason: 'No LINE ID' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 4. Construct Message (Flex vs Text)
    let messagePayload

    if (bookingDetails && (type === 'confirmed' || type === 'cancelled')) {
        // --- FLEX MESSAGE ---
        const isConfirmed = type === 'confirmed'
        const color = isConfirmed ? '#06C755' : '#EF4444' // Green vs Red
        const title = isConfirmed ? 'Booking Confirmed' : 'Booking Cancelled'
        const desc = isConfirmed ? 'Your table is ready. See you soon!' : 'Please contact us for more info.'

        messagePayload = {
            type: "flex",
            altText: `${title} - Haus Table`,
            contents: {
                "type": "bubble",
                "header": {
                    "type": "box",
                    "layout": "vertical",
                    "contents": [
                        { "type": "text", "text": title, "weight": "bold", "color": "#FFFFFF", "size": "lg" }
                    ],
                    "backgroundColor": color,
                    "paddingAll": "20px"
                },
                "body": {
                    "type": "box",
                    "layout": "vertical",
                    "contents": [
                        { "type": "text", "text": `Hello, ${bookingDetails.customerName}`, "weight": "bold", "size": "md", "margin": "md" },
                        { "type": "text", "text": desc, "size": "xs", "color": "#aaaaaa", "margin": "xs" },
                        { "type": "separator", "margin": "xl" },
                        {
                            "type": "box",
                            "layout": "vertical",
                            "margin": "xl",
                            "spacing": "sm",
                            "contents": [
                                {
                                    "type": "box",
                                    "layout": "baseline",
                                    "contents": [
                                        { "type": "text", "text": "Date", "color": "#aaaaaa", "size": "sm", "flex": 2 },
                                        { "type": "text", "text": bookingDetails.date, "weight": "bold", "color": "#666666", "size": "sm", "flex": 4, "wrap": true }
                                    ]
                                },
                                {
                                    "type": "box",
                                    "layout": "baseline",
                                    "contents": [
                                        { "type": "text", "text": "Time", "color": "#aaaaaa", "size": "sm", "flex": 2 },
                                        { "type": "text", "text": bookingDetails.time, "weight": "bold", "color": "#666666", "size": "sm", "flex": 4, "wrap": true }
                                    ]
                                },
                                {
                                    "type": "box",
                                    "layout": "baseline",
                                    "contents": [
                                        { "type": "text", "text": "Table", "color": "#aaaaaa", "size": "sm", "flex": 2 },
                                        { "type": "text", "text": bookingDetails.tableName, "weight": "bold", "color": "#666666", "size": "sm", "flex": 4, "wrap": true }
                                    ]
                                },
                                {
                                    "type": "box",
                                    "layout": "baseline",
                                    "contents": [
                                        { "type": "text", "text": "Guests", "color": "#aaaaaa", "size": "sm", "flex": 2 },
                                        { "type": "text", "text": `${bookingDetails.pax} Pax`, "weight": "bold", "color": "#666666", "size": "sm", "flex": 4, "wrap": true }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            }
        }
    } else {
        // Fallback Text Message
        messagePayload = { type: 'text', text: message || 'Notification from Haus Table' }
    }

    // 5. Send API Request
    const resp = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: lineId,
        messages: [messagePayload]
      }),
    })

    if (!resp.ok) {
        const txt = await resp.text()
        console.error("LINE Send Error:", txt)
        throw new Error("LINE API Failed")
    }

    return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (err) {
    console.error("Manage Booking Error:", err.message)
    return new Response(JSON.stringify({ error: err.message }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
    })
  }
})
