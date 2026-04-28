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

        if (text === 'stback' || text === 'stday' || text === 'sthour') {
          try {
            const isToday = text === 'stday'
            const isHour = text === 'sthour'
            console.log(`Processing ${text} command...`)
            
            // Thailand Time (UTC+7)
            const now = new Date()
            const thNow = new Date(now.getTime() + (7 * 60 * 60 * 1000))
            
            let dbStart, dbEnd;
            let dateStr = "";
            let headerTitle = "📦 อัพเดทสต๊อก";

            if (isHour) {
               dbEnd = now.toISOString();
               dbStart = new Date(now.getTime() - (60 * 60 * 1000)).toISOString();
               headerTitle += " (1 ชม. ล่าสุด)";
               try {
                 dateStr = thNow.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
                 dateStr += " " + thNow.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + " น.";
               } catch (e) {
                 dateStr = thNow.toISOString().split('T')[0]
               }
            } else {
               // Determine Query Range
               const queryDateStart = new Date(thNow)
               if (!isToday) {
                  queryDateStart.setDate(queryDateStart.getDate() - 1) // Yesterday
                  headerTitle += "เมื่อวาน"
               } else {
                  headerTitle += "วันนี้"
               }
               queryDateStart.setHours(0, 0, 0, 0)
               
               const queryDateEnd = new Date(queryDateStart)
               queryDateEnd.setHours(23, 59, 59, 999)

               // Convert back to UTC for DB query
               dbStart = new Date(queryDateStart.getTime() - (7 * 60 * 60 * 1000)).toISOString()
               dbEnd = new Date(queryDateEnd.getTime() - (7 * 60 * 60 * 1000)).toISOString()
               
               try {
                 dateStr = queryDateStart.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
               } catch (e) {
                 dateStr = queryDateStart.toISOString().split('T')[0]
               }
            }

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

            if (!transactions || transactions.length === 0) {
              messages.push({
                type: "flex",
                altText: headerTitle,
                contents: {
                  type: "bubble",
                  header: {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: "#1A1A1A",
                    contents: [
                      { type: "text", text: headerTitle, weight: "bold", color: "#FFFFFF", size: "lg" },
                      { type: "text", text: dateStr, color: "#CCCCCC", size: "xs", margin: "xs" }
                    ]
                  },
                  body: {
                    type: "box",
                    layout: "vertical",
                    contents: [{ type: "text", text: "🚫 ไม่มีรายการอัพเดท", color: "#888888", size: "sm", align: "center" }]
                  }
                }
              })
            } else {
               const bubbles = []
               let currentItems = []
               
               transactions.forEach((tx: any, index: number) => {
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
                
                // Status Logic
                const current = Number(item?.current_quantity) || 0
                const min = Number(item?.min_stock_threshold) || 0
                const reorder = Number(item?.reorder_point) || 0
                const EPSILON = 0.0001;
                
                let statusEmoji = '🟢'
                let statusColor = '#06C755'
                if (current <= EPSILON) { statusEmoji = '⚫ หมด'; statusColor = '#111111' }
                else if (min > 0 && current <= min + EPSILON) { statusEmoji = '🔴 วิกฤต'; statusColor = '#EF4444' }
                else if (reorder > 0 && current <= reorder + EPSILON) { statusEmoji = '🟠 ต้องเติม'; statusColor = '#F59E0B' }

                currentItems.push({
                    type: "box",
                    layout: "vertical",
                    margin: "md",
                    contents: [
                        {
                            type: "box",
                            layout: "horizontal",
                            contents: [
                                { type: "text", text: `🕒 ${time}`, color: "#aaaaaa", size: "xs", flex: 0 },
                                { type: "text", text: itemName, weight: "bold", size: "sm", color: "#1A1A1A", wrap: true, margin: "md", flex: 1 }
                            ]
                        },
                        {
                            type: "box",
                            layout: "baseline",
                            margin: "xs",
                            contents: [
                                { type: "text", text: `📝 ${sign}${tx.quantity_change} ${itemUnit}`, color: "#888888", size: "xs", flex: 2 },
                                { type: "text", text: `เหลือ ${current} ${statusEmoji}`, color: statusColor, size: "xs", align: "end", weight: "bold", flex: 3 }
                            ]
                        },
                        ...(tx.note ? [{
                            type: "text", text: `💬 Note: ${tx.note}`, color: "#aaaaaa", size: "xxs", margin: "xs", wrap: true
                        }] : [])
                    ]
                })

                if (index < transactions.length - 1) {
                    currentItems.push({ type: "separator", margin: "md", color: "#F0F0F0" })
                }

                // Chunk into bubbles every 15 items
                if (currentItems.length >= 29 || index === transactions.length - 1) {
                    // removing last separator if exists
                    if (currentItems.length > 0 && currentItems[currentItems.length - 1].type === 'separator') {
                        currentItems.pop()
                    }
                    bubbles.push({
                        type: "bubble",
                        size: "mega",
                        header: {
                            type: "box",
                            layout: "vertical",
                            backgroundColor: "#1A1A1A",
                            paddingAll: "20px",
                            contents: [
                                { type: "text", text: headerTitle, weight: "bold", color: "#FFFFFF", size: "lg" },
                                { type: "text", text: `${dateStr} (หน้า ${bubbles.length + 1})`, color: "#CCCCCC", size: "xs", margin: "xs" }
                            ]
                        },
                        body: {
                            type: "box",
                            layout: "vertical",
                            paddingAll: "20px",
                            contents: currentItems
                        }
                    })
                    currentItems = []
                }
              })
              
              if (bubbles.length > 12) {
                 bubbles.length = 12; // LINE Carousel max is 12 bubbles
                 bubbles[11].body.contents.push({ type: "separator", margin: "md", color: "#F0F0F0" })
                 bubbles[11].body.contents.push({ type: "text", text: "...(แสดงได้สูงสุด 12 หน้า)", color: "#EF4444", size: "xs", margin: "md", align: "center" })
              }
              
              messages.push({
                  type: "flex",
                  altText: headerTitle,
                  contents: {
                      type: "carousel",
                      contents: bubbles
                  }
              })
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

            let flexContents = [];

            if (attendances.length === 0 && leaves.length === 0) {
               flexContents.push({ type: "text", text: "🚫 ยังไม่มีข้อมูลในวันนี้", color: "#888888", size: "sm", align: "center" });
            } else {
               if (attendances.length > 0) {
                  flexContents.push({ type: "text", text: "[บันทึกเข้า-ออกเวลา]", weight: "bold", color: "#1A1A1A", size: "sm", margin: "md" });
                  flexContents.push({ type: "separator", margin: "sm", color: "#F0F0F0" });

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

                  Array.from(empMap.values()).forEach((emp, i, arr) => {
                     const inTxt = emp.in ? `${emp.in} น. ${emp.moodIn}` : '-'
                     const outTxt = emp.out ? `${emp.out} น. ${emp.moodOut}` : '-'
                     
                     flexContents.push({
                         type: "box",
                         layout: "vertical",
                         margin: "md",
                         contents: [
                             { type: "text", text: `👤 ${emp.name}`, weight: "bold", size: "sm", color: "#1A1A1A" },
                             {
                                 type: "box",
                                 layout: "horizontal",
                                 margin: "sm",
                                 contents: [
                                     { type: "text", text: "🟢 เข้า", color: "#aaaaaa", size: "xs", flex: 1 },
                                     { type: "text", text: inTxt, color: "#1A1A1A", size: "xs", flex: 3 },
                                     { type: "text", text: "🔴 ออก", color: "#aaaaaa", size: "xs", flex: 1 },
                                     { type: "text", text: outTxt, color: "#1A1A1A", size: "xs", flex: 3 }
                                 ]
                             }
                         ]
                     })
                     if (i < arr.length - 1) flexContents.push({ type: "separator", margin: "md", color: "#F0F0F0", style: "dashed" })
                  })
               }

               if (leaves.length > 0) {
                  flexContents.push({ type: "text", text: "[พนักงานที่ลาวันนี้]", weight: "bold", color: "#1A1A1A", size: "sm", margin: "xl" });
                  flexContents.push({ type: "separator", margin: "sm", color: "#F0F0F0" });

                  leaves.forEach((leave: any, i: number, arr: any[]) => {
                     const statusColor = leave.status === 'approved' ? '#06C755' : (leave.status === 'pending' ? '#F59E0B' : '#EF4444')
                     const statusText = leave.status === 'approved' ? '✅ อนุมัติแล้ว' : (leave.status === 'pending' ? '⏳ รออนุมัติ' : '❌ ไม่อนุมัติ')
                     
                     flexContents.push({
                         type: "box",
                         layout: "vertical",
                         margin: "md",
                         contents: [
                             { type: "text", text: `⛱️ ${leave.employee_name}`, weight: "bold", size: "sm", color: "#1A1A1A" },
                             {
                                 type: "box",
                                 layout: "baseline",
                                 margin: "xs",
                                 contents: [
                                     { type: "text", text: "เหตุผล", color: "#aaaaaa", size: "xs", flex: 1 },
                                     { type: "text", text: leave.reason || '-', color: "#1A1A1A", size: "xs", flex: 4, wrap: true }
                                 ]
                             },
                             {
                                 type: "box",
                                 layout: "baseline",
                                 margin: "xs",
                                 contents: [
                                     { type: "text", text: "สถานะ", color: "#aaaaaa", size: "xs", flex: 1 },
                                     { type: "text", text: statusText, color: statusColor, size: "xs", flex: 4, weight: "bold" }
                                 ]
                             }
                         ]
                     })
                     if (i < arr.length - 1) flexContents.push({ type: "separator", margin: "md", color: "#F0F0F0", style: "dashed" })
                  })
               }
            }

            const messagesPayload = [{
                type: "flex",
                altText: `🧑‍💼 สรุปการเข้างานวันนี้ (${titleDateStr})`,
                contents: {
                    type: "bubble",
                    size: "mega",
                    header: {
                        type: "box",
                        layout: "vertical",
                        backgroundColor: "#1A1A1A",
                        paddingAll: "20px",
                        contents: [
                            { type: "text", text: "🧑‍💼 สรุปการเข้างาน", weight: "bold", color: "#FFFFFF", size: "lg" },
                            { type: "text", text: titleDateStr, color: "#CCCCCC", size: "xs", margin: "xs" }
                        ]
                    },
                    body: {
                        type: "box",
                        layout: "vertical",
                        paddingAll: "20px",
                        contents: flexContents
                    }
                }
            }];

            console.log('Sending Staff Reply...')
            const resp = await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: messagesPayload
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

        // --- NEW: Makro Search Command ---
        if (text.startsWith('makro ')) {
          console.log('Processing makro command...')
          const keyword = text.substring(6).trim()
          
          if (!keyword) {
             await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: 'text', text: 'กรุณาระบุคำค้นหา เช่น makro น้ำมันปาล์ม' }]
              }),
            })
            continue
          }

          try {
            // Get Notte API Key
            const { data: notteKeyData } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'notte_api_key').single()
            const NOTTE_API_KEY = notteKeyData?.value || Deno.env.get('NOTTE_API_KEY')

            if (!NOTTE_API_KEY) {
               throw new Error('NOTTE_API_KEY ไม่ได้ตั้งค่าไว้')
            }

            console.log(`Searching Makro. Keyword: ${keyword}`)
            // Call Notte Function via HTTP
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
                        page: 1,
                        limit: 10
                    }
                })
            })

            if (!notteResp.ok) {
                const errTxt = await notteResp.text()
                console.error('Notte API failed:', errTxt)
                throw new Error(`Notte API Error: ${notteResp.status}`)
            }

            const notteData = await notteResp.json()
            const products = notteData.result || notteData.data || [] // Depending on Notte response structure

            let flexContents = [];
            
            if (!Array.isArray(products) || products.length === 0) {
               flexContents.push({ type: "text", text: "❌ ไม่พบสินค้า", color: "#888888", size: "sm", align: "center" });
            } else {
               const displayItems = products.slice(0, 5) // Line limits bubble size
               displayItems.forEach((p: any, i: number, arr: any[]) => {
                  
                  const contents = [
                      { type: "text", text: p.title, weight: "bold", size: "sm", color: "#1A1A1A", wrap: true }
                  ];

                  if (p.is_discounted && p.discount_percent) {
                      let promoStr = `🔥 ลด ${p.discount_percent}%`
                      if (p.discount_end_date) {
                         const endDate = new Date(p.discount_end_date).toLocaleDateString('th-TH')
                         promoStr += ` (ถึง ${endDate})`
                      }
                      contents.push({
                         type: "text", text: promoStr, color: "#EF4444", size: "xs", weight: "bold", margin: "xs"
                      });
                  }

                  contents.push({
                      type: "box",
                      layout: "baseline",
                      margin: "sm",
                      contents: [
                          { type: "text", text: "ราคา", color: "#aaaaaa", size: "xs", flex: 1 },
                          { type: "text", text: `฿${p.current_price} / ${p.price_unit}`, color: "#1A1A1A", size: "sm", flex: 3, weight: "bold" }
                      ]
                  });

                  if (p.price_per_unit) {
                      let ppuText = `฿${p.price_per_unit.toFixed(2)}`;
                      if (p.original_price_per_unit) {
                         ppuText += ` (เดิม ฿${p.original_price_per_unit.toFixed(2)})`;
                      }
                      contents.push({
                          type: "box",
                          layout: "baseline",
                          margin: "xs",
                          contents: [
                              { type: "text", text: "ตกหน่วยละ", color: "#aaaaaa", size: "xs", flex: 1 },
                              { type: "text", text: ppuText, color: "#1A1A1A", size: "xs", flex: 3 }
                          ]
                      });
                  }

                  if (p.unit_count && p.price_unit !== p.unit_size_label) {
                      contents.push({
                          type: "box",
                          layout: "baseline",
                          margin: "xs",
                          contents: [
                              { type: "text", text: "ขนาด", color: "#aaaaaa", size: "xs", flex: 1 },
                              { type: "text", text: `${p.unit_count} ${p.unit_size_label || 'หน่วย'}`, color: "#1A1A1A", size: "xs", flex: 3 }
                          ]
                      });
                  }

                  flexContents.push({
                      type: "box",
                      layout: "vertical",
                      margin: "md",
                      contents: contents
                  });

                  if (i < arr.length - 1) flexContents.push({ type: "separator", margin: "md", color: "#F0F0F0" });
               })
               
               if (products.length > 5) {
                   flexContents.push({ type: "separator", margin: "md", color: "#F0F0F0" });
                   flexContents.push({ type: "text", text: `(แสดง 5 จาก ${products.length} รายการ)`, color: "#aaaaaa", size: "xs", align: "center", margin: "md" });
               }
            }

            const messagesPayload = [{
                type: "flex",
                altText: `🛒 ผลลัพธ์ Makro: ${keyword}`,
                contents: {
                    type: "bubble",
                    size: "mega",
                    header: {
                        type: "box",
                        layout: "vertical",
                        backgroundColor: "#D91C28", // Makro Red
                        paddingAll: "20px",
                        contents: [
                            { type: "text", text: "🛒 ผลลัพธ์ Makro", weight: "bold", color: "#FFFFFF", size: "lg" },
                            { type: "text", text: `คำค้นหา: "${keyword}"`, color: "#FFD0D0", size: "xs", margin: "xs" }
                        ]
                    },
                    body: {
                        type: "box",
                        layout: "vertical",
                        paddingAll: "20px",
                        contents: flexContents
                    }
                }
            }];

            console.log('Sending Makro Reply...')
            const resp = await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: messagesPayload
              }),
            })
            
            if (!resp.ok) console.error('Makro Reply Failed:', await resp.text())

          } catch (err) {
             console.error('Makro Command Error:', err)
             await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: 'text', text: '❌ ไม่สามารถดึงข้อมูล Makro ได้: ' + err.message }]
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
