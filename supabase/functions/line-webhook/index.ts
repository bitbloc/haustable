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
    console.log('Request Body:', body)
    console.log('Signature Header:', signature)
    console.log('Channel Secret (first 5):', CHANNEL_SECRET.substring(0, 5))

    const isValid = await verifySignature(body, signature, CHANNEL_SECRET)
    console.log('Signature Valid:', isValid)

    if (!isValid) {
      console.error('Invalid LINE signature')
      return new Response('Invalid signature', { status: 401 })
    }

    const { events } = JSON.parse(body)
    console.log('Events:', JSON.stringify(events))

    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const text = event.message.text.trim().toLowerCase()
        console.log('Received text:', text)

        if (text === 'ping') {
          await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
              replyToken: event.replyToken,
              messages: [{ type: 'text', text: 'Pong! 🏓\n(Webhook is working)' }]
            }),
          })
          continue
        }

        if (text === 'stback' || text === 'stday') {
          try {
            const isToday = text === 'stday'
            console.log(`Processing ${text} command...`)
            
            // Thailand Time (UTC+7)
            const now = new Date()
            const thNow = new Date(now.getTime() + (7 * 60 * 60 * 1000))
            
            // Determine Query Range
            const queryDateStart = new Date(thNow)
            if (!isToday) {
               queryDateStart.setDate(queryDateStart.getDate() - 1) // Yesterday
            }
            queryDateStart.setHours(0, 0, 0, 0)
            
            const queryDateEnd = new Date(queryDateStart)
            queryDateEnd.setHours(23, 59, 59, 999)

            // Convert back to UTC for DB query
            const dbStart = new Date(queryDateStart.getTime() - (7 * 60 * 60 * 1000)).toISOString()
            const dbEnd = new Date(queryDateEnd.getTime() - (7 * 60 * 60 * 1000)).toISOString()

            console.log(`Querying stocks from ${dbStart} to ${dbEnd}`)

            const { data: transactions, error } = await supabaseAdmin
              .from('stock_transactions')
              .select(`
                quantity_change,
                transaction_type,
                created_at,
                note,
                stock_items (
                  name,
                  unit,
                  current_quantity,
                  min_stock_threshold,
                  reorder_point
                )
              `)
              .gte('created_at', dbStart)
              .lte('created_at', dbEnd)
              .order('created_at', { ascending: true })

            if (error) {
              console.error('Supabase Query Error:', error)
              throw error
            }

            console.log(`Found ${transactions?.length ?? 0} transactions`)

            // Construct Reply
            let messages = []
            let currentChunk = ""
            const MAX_LENGTH = 4000 

            let dateStr = ""
            try {
              dateStr = queryDateStart.toLocaleDateString('th-TH', { 
                day: 'numeric', month: 'long', year: 'numeric' 
              })
            } catch (e) {
              dateStr = queryDateStart.toISOString().split('T')[0]
            }

            const titleDay = isToday ? 'วันนี้' : 'เมื่อวาน'
            const header = `📦 สรุปอัพเดทสต๊อก${titleDay}\n📅 ${dateStr}\n`
            currentChunk = header

            if (!transactions || transactions.length === 0) {
              currentChunk += "\n-----------------------------\n🚫 ไม่มีรายการอัพเดท"
              messages.push({ type: 'text', text: currentChunk })
            } else {
               transactions.forEach((tx: any) => {
                const sign = tx.quantity_change > 0 ? '+' : ''
                
                let time = ""
                try {
                  time = new Date(new Date(tx.created_at).getTime() + (7 * 60 * 60 * 1000))
                    .toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
                } catch (e) {
                  time = tx.created_at.substring(11, 16)
                }
                
                const item = tx.stock_items
                const itemName = item?.name || 'Unknown Item'
                const itemUnit = item?.unit || ''
                
                // Status Logic (Standardized)
                const current = Number(item?.current_quantity) || 0
                const min = Number(item?.min_stock_threshold) || 0
                const reorder = Number(item?.reorder_point) || 0
                const EPSILON = 0.0001;
                
                let statusText = '(🟢 ปกติ)'
                if (current <= EPSILON) statusText = '(⚫ หมด!)'
                else if (min > 0 && current <= min + EPSILON) statusText = '(🔴 วิกฤต/ต้องซื้อด่วน!)'
                else if (reorder > 0 && current <= reorder + EPSILON) statusText = '(🟠 ใกล้หมด)'

                const line = `\n-----------------------------\n` +
                             `🕒 ${time} | ${itemName}\n` +
                             `📝 ${sign}${tx.quantity_change} ${itemUnit}\n` +
                             `📊 เหลือ: ${current} ${itemUnit} ${statusText}\n` +
                             (tx.note ? `💬 Note: ${tx.note}\n` : '')

                if (currentChunk.length + line.length > MAX_LENGTH) {
                  messages.push({ type: 'text', text: currentChunk })
                  currentChunk = `(ต่อ) ${dateStr}\n${line}`
                } else {
                  currentChunk += line
                }
              })
              if (currentChunk) messages.push({ type: 'text', text: currentChunk })
            }
            
            // Limit to 5 bubbles
            if (messages.length > 5) {
               console.warn('Message too long, truncating to 5 bubbles')
               messages = messages.slice(0, 5)
               messages[4].text += '\n...\n(รายการเยอะเกินกว่าจะแสดงหมด)'
            }

            console.log(`Sending Stock Reply (${messages.length} bubbles)`)

            const resp = await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: messages
              }),
            })
            
            if (!resp.ok) {
              const txt = await resp.text()
              console.error('LINE Reply Failed:', txt)
              const targetId = event.source.groupId || event.source.roomId || event.source.userId
              if (targetId && (txt.includes('Invalid reply token') || resp.status === 400)) {
                 const pushResp = await fetch('https://api.line.me/v2/bot/message/push', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
                  },
                  body: JSON.stringify({ to: targetId, messages: messages }),
                })
                if (!pushResp.ok) console.error('LINE Push Failed:', await pushResp.text())
              }
            }
          } catch (err) {
            console.error('Stock Command Error:', err)
            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: 'text', text: '❌ เกิดข้อความผิดพลาดในการดึงข้อมูลสต็อก: ' + err.message }]
              }),
            })
          }
        }

        // --- NEW: Staff Attendance Command ---
        if (text === 'staff') {
          console.log('Processing staff command...')
          
          const now = new Date()
          const thNow = new Date(now.getTime() + (7 * 60 * 60 * 1000))
          const dateStrApi = thNow.toISOString().split('T')[0] // YYYY-MM-DD
          
          let titleDateStr = ""
          try {
            titleDateStr = thNow.toLocaleDateString('th-TH', { 
              day: 'numeric', month: 'long', year: 'numeric' 
            })
          } catch (e) {
            titleDateStr = dateStrApi
          }

          try {
            // Fetch Data from HR API with Timeout
            const hrApiUrl = `https://inthehaus-hr.vercel.app/api/export/staff-data?startDate=${dateStrApi}&endDate=${dateStrApi}`
            console.log(`Fetching HR Data from: ${hrApiUrl}`)
            
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout
            
            let hrResp;
            try {
              hrResp = await fetch(hrApiUrl, { signal: controller.signal })
              clearTimeout(timeoutId)
            } catch (fetchErr) {
              if (fetchErr.name === 'AbortError') throw new Error('HR API request timed out (15s)')
              throw fetchErr
            }

            if (!hrResp.ok) throw new Error(`HR API returned status: ${hrResp.status}`)
            
            const hrData = await hrResp.json()
            const attendances = hrData.attendance || []
            const leaves = hrData.leaves || []

            let replyText = `🧑‍💼 สรุปการเข้างานวันนี้\n📅 ${titleDateStr}\n`

            if (attendances.length === 0 && leaves.length === 0) {
               replyText += "\n-----------------------------\n🚫 ยังไม่มีข้อมูลในวันนี้"
            } else {
               if (attendances.length > 0) {
                  replyText += `\n[บันทึกเข้า-ออกเวลา]\n-----------------------------`
                  const empMap = new Map()
                  attendances.forEach((record: any) => {
                     if (!empMap.has(record.employee_id)) {
                        empMap.set(record.employee_id, { name: record.employee_name, in: null, out: null, moodIn: null, moodOut: null })
                     }
                     const emp = empMap.get(record.employee_id)
                     
                     let timeStr = ""
                     try {
                       timeStr = new Date(new Date(record.timestamp).getTime() + (7 * 60 * 60 * 1000))
                         .toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
                     } catch (e) {
                       timeStr = record.timestamp.substring(11, 16)
                     }
                     
                     if (record.action_type === 'check_in' || record.action_type === 'clock_in') {
                        emp.in = timeStr
                        emp.moodIn = record.mood_status || ''
                     } else if (record.action_type === 'check_out' || record.action_type === 'clock_out') {
                        emp.out = timeStr
                        emp.moodOut = record.mood_status || ''
                     }
                  })

                  Array.from(empMap.values()).forEach(emp => {
                     const inTxt = emp.in ? `${emp.in} น. ${emp.moodIn}` : '-'
                     const outTxt = emp.out ? `${emp.out} น. ${emp.moodOut}` : '-'
                     replyText += `\n👤 ${emp.name}\n🟢 เข้า: ${inTxt}\n🔴 ออก: ${outTxt}\n`
                  })
               }

               if (leaves.length > 0) {
                  replyText += `\n[พนักงานที่ลาวันนี้]\n-----------------------------`
                  leaves.forEach((leave: any) => {
                     const statusBadge = leave.status === 'approved' ? '✅ อนุมัติแล้ว' : (leave.status === 'pending' ? '⏳ รออนุมัติ' : '❌ ไม่อนุมัติ')
                     replyText += `\n⛱️ ${leave.employee_name}\nเหตุผล: ${leave.reason || '-'}\nสถานะ: ${statusBadge}\n`
                  })
               }
            }

            if (replyText.length > 5000) replyText = replyText.substring(0, 4995) + '...'

            console.log('Sending Staff Reply...')
            const resp = await fetch('https://api.line.me/v2/bot/message/reply', {
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
            
            if (!resp.ok) console.error('Staff Reply Failed:', await resp.text())
          } catch (apiErr) {
             console.error('Staff Command Error:', apiErr)
             await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: 'text', text: '❌ ไม่สามารถดึงข้อมูลพนักงานได้: ' + apiErr.message }]
              }),
            })
          }
        }
      }
    }

    return new Response('OK', { headers: corsHeaders })
  } catch (err) {
    console.error('Global Webhook Error:', err)
    return new Response('Error', { status: 500 })
  }
})
