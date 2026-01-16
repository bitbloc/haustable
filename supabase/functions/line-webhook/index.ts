import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function verifySignature(body: string, signature: string, secret: string) {
  const encoder = new TextEncoder()
  const keyBuffer = encoder.encode(secret)
  const bodyBuffer = encoder.encode(body)

  const key = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, bodyBuffer)
  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))

  return base64Signature === signature
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const signature = req.headers.get('x-line-signature')
  if (!signature) {
    return new Response('Missing signature', { status: 401 })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Get LINE Configuration
    const { data: channelSecretData } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'line_channel_secret').single()
    const { data: channelTokenData } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'line_channel_access_token').single()

    if (!channelSecretData?.value || !channelTokenData?.value) {
      console.error('LINE configuration missing in app_settings')
      return new Response('Config error', { status: 500 })
    }

    const CHANNEL_SECRET = channelSecretData.value
    const CHANNEL_ACCESS_TOKEN = channelTokenData.value

    // 2. Verify Signature
    const body = await req.text()
    const isValid = await verifySignature(body, signature, CHANNEL_SECRET)
    if (!isValid) {
      console.error('Invalid LINE signature')
      return new Response('Invalid signature', { status: 401 })
    }

    const { events } = JSON.parse(body)

    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const text = event.message.text.trim().toLowerCase()

        if (text === 'stback') {
          // --- GENERATE STOCK SUMMARY FOR YESTERDAY ---
          
          // Thailand Time (UTC+7)
          const now = new Date()
          const thNow = new Date(now.getTime() + (7 * 60 * 60 * 1000))
          
          // Yesterday start and end in Thailand Time
          const yesterdayStart = new Date(thNow)
          yesterdayStart.setDate(yesterdayStart.getDate() - 1)
          yesterdayStart.setHours(0, 0, 0, 0)
          
          const yesterdayEnd = new Date(yesterdayStart)
          yesterdayEnd.setHours(23, 59, 59, 999)

          // Convert back to UTC for DB query
          const dbStart = new Date(yesterdayStart.getTime() - (7 * 60 * 60 * 1000)).toISOString()
          const dbEnd = new Date(yesterdayEnd.getTime() - (7 * 60 * 60 * 1000)).toISOString()

          const { data: transactions, error } = await supabaseAdmin
            .from('stock_transactions')
            .select(`
              quantity_change,
              transaction_type,
              created_at,
              note,
              stock_items (
                name,
                unit
              )
            `)
            .gte('created_at', dbStart)
            .lte('created_at', dbEnd)
            .order('created_at', { ascending: true })

          if (error) throw error

          let replyText = ""
          const dateStr = yesterdayStart.toLocaleDateString('th-TH', { 
            day: 'numeric', month: 'long', year: 'numeric' 
          })

          if (!transactions || transactions.length === 0) {
            replyText = `📦 สรุปอัพเดทสต๊อกเมื่อวาน (${dateStr})\n-- ไม่มีรายการอัพเดท --`
          } else {
            replyText = `📦 สรุปอัพเดทสต๊อกเมื่อวาน (${dateStr})\n\n`
            
            transactions.forEach((tx: any) => {
              const sign = tx.quantity_change > 0 ? '+' : ''
              const time = new Date(new Date(tx.created_at).getTime() + (7 * 60 * 60 * 1000))
                .toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
              
              replyText += `• ${time} | ${tx.stock_items.name}: ${sign}${tx.quantity_change} ${tx.stock_items.unit}\n`
              if (tx.note) replyText += `  └ หมายเหตุ: ${tx.note}\n`
            });
          }

          // Reply to LINE
          await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
              replyToken: event.replyToken,
              messages: [{ type: 'text', text: replyText }]
            }),
          })
        }
      }
    }

    return new Response('OK', { headers: corsHeaders })
  } catch (err) {
    console.error('Webhook Error:', err)
    return new Response('Error', { status: 500 })
  }
})
