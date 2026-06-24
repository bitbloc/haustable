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

        if (text === 'stbuy' || text === 'stbuyback') {
          try {
            const isBuyback = text === 'stbuyback';
            console.log(`Processing ${text} command...`)
            const thNow = new Date(new Date().getTime() + (7 * 60 * 60 * 1000))
            let dateStr = ""
            try {
              dateStr = thNow.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
            } catch (e) {
              dateStr = thNow.toISOString().split('T')[0]
            }

            let query = supabaseAdmin
              .from('stock_items')
              .select('name, unit, current_quantity, min_stock_threshold, reorder_point, updated_at')
              .order('name', { ascending: true })

            if (isBuyback) {
               const dayAgo = new Date(new Date().getTime() - (24 * 60 * 60 * 1000)).toISOString()
               query = query.gte('updated_at', dayAgo)
            }

            const { data: items, error } = await query

            if (error) throw error

            const EPSILON = 0.0001;
            const itemsToBuy = items.filter((item: any) => {
               const qty = Number(item.current_quantity) || 0;
               const min = Number(item.min_stock_threshold) || 0;
               const reorder = Number(item.reorder_point) || 0;
               return (qty <= EPSILON) || (min > 0 && qty <= min + EPSILON) || (reorder > 0 && qty <= reorder + EPSILON);
            });

            console.log(`Found ${itemsToBuy.length} items to buy`)

            const headerTitle = isBuyback ? "RESTOCK LIST (24H)" : "RESTOCK LIST";
            let messages = [];

            if (itemsToBuy.length === 0) {
              messages.push({
                type: "flex",
                altText: headerTitle,
                contents: {
                  type: "bubble",
                  header: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                      { type: "text", text: headerTitle, weight: "bold", color: "#1A1A1A", size: "sm" },
                      { type: "text", text: dateStr.toUpperCase(), color: "#666666", size: "xs", margin: "xs" }
                    ]
                  },
                  body: {
                    type: "box",
                    layout: "vertical",
                    contents: [{ type: "text", text: "ALL INVENTORY QUANTITIES WITHIN LIMITS", color: "#2D804E", size: "xs", align: "center", weight: "bold" }]
                  },
                  styles: {
                    header: {
                      backgroundColor: "#F4F4F3",
                      separator: true,
                      separatorColor: "#E2E2E0"
                    },
                    body: {
                      backgroundColor: "#FFFFFF"
                    }
                  }
                }
              })
            } else {
               const bubbles: any[] = []
               let currentItems: any[] = []
               
               const tableHeader = {
                   type: "box",
                   layout: "horizontal",
                   margin: "sm",
                   contents: [
                       { type: "text", text: "ITEM DETAILS", color: "#888888", size: "xxs", weight: "bold", flex: 1 },
                       { type: "text", text: "CURRENT / LIMIT", color: "#888888", size: "xxs", weight: "bold", align: "end", flex: 1 }
                   ]
               };

               itemsToBuy.forEach((item: any, index: number) => {
                 const itemName = item.name || 'Unknown Item'
                 const current = Number(item.current_quantity) || 0
                 const min = Number(item.min_stock_threshold) || 0
                 const reorder = Number(item.reorder_point) || 0
                 
                 let indicatorBarColor = '#2D804E';
                 let rowBgColor = '#FFFFFF';
                 let statusEmoji = '🟢 OK';
                 if (current <= EPSILON) { 
                     statusEmoji = '⚫ OUT';
                     indicatorBarColor = '#4B4B4B';
                     rowBgColor = '#F5F5F5';
                 } else if (min > 0 && current <= min + EPSILON) { 
                     statusEmoji = '🔴 CRIT';
                     indicatorBarColor = '#E63946';
                     rowBgColor = '#FFEBEB';
                 } else if (reorder > 0 && current <= reorder + EPSILON) { 
                     statusEmoji = '🟠 WARN';
                     indicatorBarColor = '#F4A261';
                     rowBgColor = '#FFF6EB';
                 }

                 currentItems.push({
                     type: "box",
                     layout: "horizontal",
                     backgroundColor: rowBgColor,
                     cornerRadius: "md",
                     paddingAll: "md",
                     margin: "sm",
                     contents: [
                         // Left indicator bar
                         {
                             type: "box",
                             layout: "vertical",
                             width: "4px",
                             backgroundColor: indicatorBarColor,
                             cornerRadius: "sm",
                              contents: []
                         },
                         // Content details
                         {
                             type: "box",
                             layout: "horizontal",
                             margin: "md",
                             flex: 1,
                             contents: [
                                 {
                                     type: "text",
                                     text: itemName,
                                     weight: "bold",
                                     size: "sm",
                                     color: "#1A1A1A",
                                     wrap: true,
                                     flex: 5,
                                     gravity: "center"
                                 },
                                 {
                                     type: "box",
                                     layout: "vertical",
                                     flex: 5,
                                     contents: [
                                         {
                                             type: "text",
                                             text: `${current} / ${min > 0 ? min : reorder} ${item.unit || ''}`,
                                             color: "#1A1A1A",
                                             size: "sm",
                                             weight: "bold",
                                             align: "end"
                                         },
                                         {
                                             type: "text",
                                             text: statusEmoji,
                                             color: indicatorBarColor,
                                             size: "xxs",
                                             weight: "bold",
                                             margin: "xs",
                                             align: "end"
                                         }
                                     ]
                                 }
                             ]
                         }
                     ]
                 })

                 if (currentItems.length >= 17 || index === itemsToBuy.length - 1) {
                     const bodyContents = [
                         tableHeader,
                         { type: "separator", margin: "md", color: "#1A1A1A" },
                         ...currentItems
                     ];

                     bubbles.push({
                         type: "bubble",
                         size: "mega",
                         header: {
                             type: "box",
                             layout: "vertical",
                             paddingAll: "20px",
                             contents: [
                                 { type: "text", text: headerTitle, weight: "bold", color: "#1A1A1A", size: "sm" },
                                 { type: "text", text: `${dateStr.toUpperCase()} (PAGE ${bubbles.length + 1})`, color: "#666666", size: "xs", margin: "xs" }
                             ]
                         },
                         body: {
                             type: "box",
                             layout: "vertical",
                             paddingAll: "20px",
                             contents: bodyContents
                         },
                         styles: {
                             header: {
                                 backgroundColor: "#F4F4F3",
                                 separator: true,
                                 separatorColor: "#E2E2E0"
                             },
                             body: {
                                 backgroundColor: "#FFFFFF"
                             }
                         }
                     })
                     currentItems = []
                 }
               })
               
               if (bubbles.length > 5) {
                  bubbles.length = 5;
                  bubbles[4].body.contents.push({ type: "separator", margin: "md", color: "#E2E2E0" })
                  bubbles[4].body.contents.push({ type: "text", text: "...(แสดงได้สูงสุด 5 หน้า)", color: "#9E2D2D", size: "xs", margin: "md", align: "center" })
               }
               
               if (bubbles.length === 1) {
                  messages.push({ type: "flex", altText: headerTitle, contents: bubbles[0] })
               } else {
                  messages.push({ type: "flex", altText: headerTitle, contents: { type: "carousel", contents: bubbles } })
               }
            }

            const resp = await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
              body: JSON.stringify({ replyToken: event.replyToken, messages: messages })
            })
            if (!resp.ok) {
              const txt = await resp.text()
              console.error('stbuy Reply Failed:', txt)
              const targetId = event.source.groupId || event.source.roomId || event.source.userId
              if (targetId) {
                 await fetch('https://api.line.me/v2/bot/message/push', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
                  body: JSON.stringify({ to: targetId, messages: [{ type: 'text', text: `❌ ระบบไม่สามารถส่งรายการซื้อของแบบ Flex ได้\nError: ${txt.substring(0, 100)}` }] })
                })
              }
            }
          } catch (err: any) {
            console.error('stbuy Command Error:', err)
            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
              body: JSON.stringify({ replyToken: event.replyToken, messages: [{ type: 'text', text: '❌ เกิดข้อผิดพลาดในการดึงรายการซื้อของ: ' + err.message }] })
            })
          }
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
            const engTitle = "STOCK LOGS";

            if (!transactions || transactions.length === 0) {
              messages.push({
                type: "flex",
                altText: headerTitle,
                contents: {
                  type: "bubble",
                  size: "mega",
                  header: {
                    type: "box",
                    layout: "vertical",
                    paddingAll: "20px",
                    contents: [
                      { type: "text", text: engTitle, weight: "bold", color: "#1A1A1A", size: "sm" },
                      { type: "text", text: dateStr.toUpperCase(), color: "#666666", size: "xs", margin: "xs" }
                    ]
                  },
                  body: {
                    type: "box",
                    layout: "vertical",
                    paddingAll: "20px",
                    contents: [{ type: "text", text: "NO TRANSACTIONS RECORDED", color: "#888888", size: "xs", align: "center", weight: "bold" }]
                  },
                  styles: {
                    header: {
                      backgroundColor: "#F4F4F3",
                      separator: true,
                      separatorColor: "#E2E2E0"
                    },
                    body: {
                      backgroundColor: "#FFFFFF"
                    }
                  }
                }
              })
            } else {
               const bubbles = []
               let currentItems = []
               
               const logHeader = {
                   type: "box",
                   layout: "horizontal",
                   margin: "sm",
                   contents: [
                       { type: "text", text: "TIME", color: "#888888", size: "xxs", weight: "bold", flex: 2 },
                       { type: "text", text: "TRANSACTION DETAIL", color: "#888888", size: "xxs", weight: "bold", flex: 5 },
                       { type: "text", text: "BALANCE", color: "#888888", size: "xxs", weight: "bold", align: "end", flex: 3 }
                   ]
               };
               
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
                 
                 const current = Number(item?.current_quantity) || 0
                 const min = Number(item?.min_stock_threshold) || 0
                 const reorder = Number(item?.reorder_point) || 0
                 const EPSILON = 0.0001;

                  let indicatorBarColor = '#2D804E';
                  let rowBgColor = '#FFFFFF';
                  let statusEmoji = '🟢 OK';

                 if (current <= EPSILON) { 
                     statusEmoji = '⚫ OUT';
                     indicatorBarColor = '#4B4B4B';
                     rowBgColor = '#F5F5F5';
                 } else if (min > 0 && current <= min + EPSILON) { 
                     statusEmoji = '🔴 CRIT';
                     indicatorBarColor = '#E63946';
                     rowBgColor = '#FFEBEB';
                 } else if (reorder > 0 && current <= reorder + EPSILON) { 
                     statusEmoji = '🟠 WARN';
                     indicatorBarColor = '#F4A261';
                     rowBgColor = '#FFF6EB';
                 }

                 const changeColor = tx.quantity_change > 0 ? '#1B4D3E' : tx.quantity_change < 0 ? '#8B0000' : '#666666';

                 currentItems.push({
                     type: "box",
                     layout: "horizontal",
                     backgroundColor: rowBgColor,
                     cornerRadius: "md",
                     paddingAll: "md",
                     margin: "sm",
                     contents: [
                         // Left indicator bar
                         {
                             type: "box",
                             layout: "vertical",
                             width: "4px",
                             backgroundColor: indicatorBarColor,
                             cornerRadius: "sm",
                              contents: []
                         },
                         // Details content
                         {
                             type: "box",
                             layout: "horizontal",
                             margin: "md",
                             flex: 1,
                             contents: [
                                 { type: "text", text: time, color: "#444444", size: "xs", weight: "bold", flex: 2, gravity: "center" },
                                 {
                                     type: "box",
                                     layout: "vertical",
                                     flex: 5,
                                     contents: [
                                         { type: "text", text: itemName, weight: "bold", size: "sm", color: "#1A1A1A", wrap: true },
                                         { type: "text", text: `${sign}${tx.quantity_change} ${itemUnit}`, color: changeColor, size: "xs", weight: "bold", margin: "xs" },
                                         ...(tx.note ? [{
                                             type: "text", text: `NOTE: ${tx.note}`, color: "#777777", size: "xxs", margin: "xs", wrap: true
                                         }] : [])
                                     ]
                                 },
                                 {
                                     type: "box",
                                     layout: "vertical",
                                     flex: 3,
                                     contents: [
                                         { type: "text", text: `BAL: ${current}`, color: "#1A1A1A", size: "xs", weight: "bold", align: "end" },
                                         { type: "text", text: statusEmoji, color: indicatorBarColor, size: "xxs", weight: "bold", margin: "xs", align: "end" }
                                     ]
                                 }
                             ]
                         }
                     ]
                 })


                 // Chunk into bubbles every 15 items
                 if (currentItems.length >= 15 || index === transactions.length - 1) {
                     const bodyContents = [
                         logHeader,
                         { type: "separator", margin: "md", color: "#1A1A1A" },
                         ...currentItems
                     ];

                     bubbles.push({
                         type: "bubble",
                         size: "mega",
                         header: {
                             type: "box",
                             layout: "vertical",
                             paddingAll: "20px",
                             contents: [
                                 { type: "text", text: engTitle, weight: "bold", color: "#1A1A1A", size: "sm" },
                                 { type: "text", text: `${dateStr.toUpperCase()} (PAGE ${bubbles.length + 1})`, color: "#666666", size: "xs", margin: "xs" }
                             ]
                         },
                         body: {
                             type: "box",
                             layout: "vertical",
                             paddingAll: "20px",
                             contents: bodyContents
                         },
                         styles: {
                             header: {
                                 backgroundColor: "#F4F4F3",
                                 separator: true,
                                 separatorColor: "#E2E2E0"
                             },
                             body: {
                                 backgroundColor: "#FFFFFF"
                             }
                         }
                     })
                     currentItems = []
                 }
               })
               
               if (bubbles.length > 5) {
                  bubbles.length = 5; // LINE Carousel max safe size to avoid 50KB limit
                  bubbles[4].body.contents.push({ type: "separator", margin: "md", color: "#E2E2E0" })
                  bubbles[4].body.contents.push({ type: "text", text: "...(แสดงได้สูงสุด 5 หน้า)", color: "#9E2D2D", size: "xs", margin: "md", align: "center" })
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
              if (targetId) {
                 const pushResp = await fetch('https://api.line.me/v2/bot/message/push', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
                  },
                  body: JSON.stringify({ to: targetId, messages: [{ type: 'text', text: `❌ ระบบไม่สามารถส่งสรุปสต็อกแบบ Flex ได้ (อาจจะรายการเยอะเกินไป)\nError: ${txt.substring(0, 100)}` }] }),
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
               flexContents.push({ type: "text", text: "NO RECORDED TRANSACTIONS FOR TODAY", color: "#888888", size: "xs", align: "center", weight: "bold" });
            } else {
               if (attendances.length > 0) {
                  flexContents.push({ type: "text", text: "SHIFT RECORDINGS", weight: "bold", color: "#1A1A1A", size: "sm", margin: "md" });
                  
                  const attendanceHeader = {
                      type: "box",
                      layout: "horizontal",
                      margin: "sm",
                      contents: [
                          { type: "text", text: "EMPLOYEE", color: "#888888", size: "xxs", weight: "bold", flex: 4 },
                          { type: "text", text: "CLOCK IN", color: "#888888", size: "xxs", weight: "bold", flex: 3 },
                          { type: "text", text: "CLOCK OUT", color: "#888888", size: "xxs", weight: "bold", flex: 3 }
                      ]
                  };
                  flexContents.push(attendanceHeader);
                  flexContents.push({ type: "separator", margin: "sm", color: "#1A1A1A" });

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

                  Array.from(empMap.values()).forEach((emp: any, i: number, arr: any[]) => {
                     const inTxt = emp.in ? `${emp.in} ${emp.moodIn}` : '-'
                     const outTxt = emp.out ? `${emp.out} ${emp.moodOut}` : '-'
                     
                     flexContents.push({
                         type: "box",
                         layout: "horizontal",
                         margin: "md",
                         contents: [
                             { type: "text", text: emp.name.toUpperCase(), weight: "bold", size: "sm", color: "#1A1A1A", flex: 4, wrap: true },
                             { type: "text", text: inTxt, color: "#1A1A1A", size: "xs", flex: 3 },
                             { type: "text", text: outTxt, color: "#1A1A1A", size: "xs", flex: 3 }
                         ]
                     })
                     if (i < arr.length - 1) flexContents.push({ type: "separator", margin: "md", color: "#E2E2E0" })
                  })
               }

               if (leaves.length > 0) {
                  flexContents.push({ type: "text", text: "ACTIVE LEAVES", weight: "bold", color: "#1A1A1A", size: "sm", margin: "xl" });
                  
                  const leaveHeader = {
                      type: "box",
                      layout: "horizontal",
                      margin: "sm",
                      contents: [
                          { type: "text", text: "EMPLOYEE", color: "#888888", size: "xxs", weight: "bold", flex: 3 },
                          { type: "text", text: "REASON", color: "#888888", size: "xxs", weight: "bold", flex: 4 },
                          { type: "text", text: "STATUS", color: "#888888", size: "xxs", weight: "bold", align: "end", flex: 3 }
                      ]
                  };
                  flexContents.push(leaveHeader);
                  flexContents.push({ type: "separator", margin: "sm", color: "#1A1A1A" });

                  leaves.forEach((leave: any, i: number, arr: any[]) => {
                     const statusColor = leave.status === 'approved' ? '#2D804E' : (leave.status === 'pending' ? '#9E672D' : '#9E2D2D')
                     const statusText = leave.status === 'approved' ? 'APPROVED' : (leave.status === 'pending' ? 'PENDING' : 'REJECTED')
                     
                     flexContents.push({
                         type: "box",
                         layout: "horizontal",
                         margin: "md",
                         contents: [
                             { type: "text", text: leave.employee_name.toUpperCase(), weight: "bold", size: "sm", color: "#1A1A1A", flex: 3, wrap: true },
                             { type: "text", text: leave.reason || '-', color: "#666666", size: "xs", flex: 4, wrap: true },
                             { type: "text", text: statusText, color: statusColor, size: "xs", weight: "bold", align: "end", flex: 3 }
                         ]
                     })
                     if (i < arr.length - 1) flexContents.push({ type: "separator", margin: "md", color: "#E2E2E0" })
                  })
               }
            }

            const messagesPayload = [{
                type: "flex",
                altText: `🧑‍💼 ATTENDANCE REPORT: ${titleDateStr}`,
                contents: {
                    type: "bubble",
                    size: "mega",
                    header: {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "text", text: "ATTENDANCE SUMMARY", weight: "bold", color: "#1A1A1A", size: "sm" },
                            { type: "text", text: titleDateStr.toUpperCase(), color: "#666666", size: "xs", margin: "xs" }
                        ]
                    },
                    body: {
                        type: "box",
                        layout: "vertical",
                        paddingAll: "20px",
                        contents: flexContents
                    },
                    styles: {
                        header: {
                            backgroundColor: "#F4F4F3",
                            separator: true,
                            separatorColor: "#E2E2E0"
                        },
                        body: {
                            backgroundColor: "#FFFFFF"
                        }
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
            
            if (!resp.ok) {
              const txt = await resp.text()
              console.error('Staff Reply Failed:', txt)
              const targetId = event.source.groupId || event.source.roomId || event.source.userId
              if (targetId) {
                 await fetch('https://api.line.me/v2/bot/message/push', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
                  body: JSON.stringify({ to: targetId, messages: [{ type: 'text', text: `❌ ไม่สามารถส่งข้อมูลพนักงานแบบ Flex ได้\nError: ${txt.substring(0, 100)}` }] }),
                })
              }
            }
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

        // --- NEW: Web Price Search Command (Replaces Makro Search) ---
        if (text.startsWith('ราคา ') || text.startsWith('makro ')) {
          console.log('Processing price search command...')
          const isMakroAlias = text.startsWith('makro ')
          const keyword = text.substring(isMakroAlias ? 6 : 5).trim()
          
          if (!keyword) {
             await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: 'text', text: 'กรุณาระบุคำค้นหา เช่น ราคา น้ำมันปาล์ม' }]
              }),
            })
            continue
          }

          try {
            console.log(`Searching Web for Price. Keyword: ${keyword}`)
            // Query DuckDuckGo HTML
            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(keyword + ' ราคา')}`
            const dResponse = await fetch(searchUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              }
            })

            if (!dResponse.ok) {
              throw new Error(`DuckDuckGo request failed with status: ${dResponse.status}`)
            }

            const html = await dResponse.text()
            
            // Split HTML by result block
            const resultBlocks = html.split('class="result ')
            const results = []
            
            const currentYear = new Date().getFullYear()
            const thaiYear = currentYear + 543
            const yearsToIgnore = [currentYear, currentYear - 1, currentYear + 1, thaiYear, thaiYear - 1, thaiYear + 1]

            for (let i = 1; i < resultBlocks.length; i++) {
              const block = resultBlocks[i]
              const titleMatch = block.match(/<a[^>]+class="result__a"[^>]*>([\s\S]*?)<\/a>/)
              const snippetMatch = block.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)
              const urlMatch = block.match(/href="([^"]+uddg=([^"&]+)[^"]*)"/)

              if (titleMatch && snippetMatch) {
                const rawTitle = titleMatch[1].replace(/<[^>]*>/g, '').trim()
                const rawSnippet = snippetMatch[1].replace(/<[^>]*>/g, '').trim()
                
                let targetUrl = ''
                if (urlMatch) {
                  try {
                    targetUrl = decodeURIComponent(urlMatch[2])
                  } catch {
                    targetUrl = urlMatch[1]
                  }
                }

                let domain = ''
                try {
                  const urlObj = new URL(targetUrl)
                  domain = urlObj.hostname.replace('www.', '')
                } catch {
                  domain = ''
                }

                // Extract prices
                const combinedText = `${rawTitle} ${rawSnippet}`
                const prices: number[] = []
                const priceRegexes = [
                  /฿\s*(\d+(?:\.\d+)?)/g,
                  /(\d+(?:\.\d+)?)\s*บาท/g,
                  /ราคา\s*(\d+(?:\.\d+)?)/g,
                  /(\d+(?:\.\d+)?)\s*\.-\s*/g
                ]

                for (const regex of priceRegexes) {
                  let match
                  regex.lastIndex = 0
                  while ((match = regex.exec(combinedText)) !== null) {
                    const price = parseFloat(match[1])
                    if (price > 0 && !prices.includes(price) && price < 100000) {
                      if (yearsToIgnore.includes(price)) continue
                      prices.push(price)
                    }
                  }
                }

                results.push({
                  title: rawTitle,
                  snippet: rawSnippet,
                  url: targetUrl,
                  domain: domain,
                  prices: prices.sort((a, b) => a - b)
                })
              }
            }

            let flexContents = [];
            
            if (results.length === 0) {
               flexContents.push({ type: "text", text: "NO PRICES FOUND FOR KEYWORD", color: "#888888", size: "xs", align: "center", weight: "bold" });
            } else {
               const displayItems = results.slice(0, 5)
               displayItems.forEach((r: any, i: number, arr: any[]) => {
                  
                  const contents = [
                      { 
                        type: "box", 
                        layout: "horizontal", 
                        contents: [
                          { type: "text", text: r.title.toUpperCase(), weight: "bold", size: "sm", color: "#1A1A1A", wrap: true, flex: 7 },
                          { type: "text", text: r.prices && r.prices.length > 0 ? `฿${r.prices[0]}` : "-", weight: "bold", size: "sm", color: "#9E2D2D", align: "end", flex: 3 }
                        ]
                      }
                  ];

                  if (r.prices && r.prices.length > 1) {
                      const otherPrices = r.prices.slice(1).map((p: number) => `฿${p}`).join(', ');
                      contents.push({
                         type: "text", text: `RANGE: ${otherPrices}`, color: "#666666", size: "xs", margin: "xs"
                      });
                  }

                  contents.push({
                      type: "text",
                      text: r.snippet,
                      color: "#666666",
                      size: "xs",
                      wrap: true,
                      margin: "sm"
                  });

                  if (r.domain) {
                      contents.push({
                          type: "text",
                          text: `SOURCE: ${r.domain.toUpperCase()}`,
                          color: "#aaaaaa",
                          size: "xxs",
                          margin: "xs",
                          weight: "bold"
                      });
                  }

                  flexContents.push({
                      type: "box",
                      layout: "vertical",
                      margin: "md",
                      contents: contents
                  });

                  if (i < arr.length - 1) flexContents.push({ type: "separator", margin: "md", color: "#E2E2E0" });
               })
               
               if (results.length > 5) {
                   flexContents.push({ type: "separator", margin: "md", color: "#E2E2E0" });
                   flexContents.push({ type: "text", text: `(SHOWN 5 OF ${results.length} ENTRIES)`, color: "#888888", size: "xs", align: "center", margin: "md" });
               }
            }

            const messagesPayload = [{
                type: "flex",
                altText: `🔍 PRICE INDEX: ${keyword}`,
                contents: {
                    type: "bubble",
                    size: "mega",
                    header: {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "text", text: "PRICE INDEX", weight: "bold", color: "#1A1A1A", size: "sm" },
                            { type: "text", text: `SEARCH: "${keyword.toUpperCase()}"`, color: "#666666", size: "xs", margin: "xs" }
                        ]
                    },
                    body: {
                        type: "box",
                        layout: "vertical",
                        paddingAll: "20px",
                        contents: flexContents
                    },
                    styles: {
                        header: {
                            backgroundColor: "#F4F4F3",
                            separator: true,
                            separatorColor: "#E2E2E0"
                        },
                        body: {
                            backgroundColor: "#FFFFFF"
                        }
                    }
                }
            }];

            console.log('Sending Price Search Reply...')
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
            
            if (!resp.ok) {
              const txt = await resp.text()
              console.error('Price Reply Failed:', txt)
            }

          } catch (err) {
             console.error('Price Command Error:', err)
             await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: 'text', text: '❌ ไม่สามารถดึงข้อมูลราคากลางได้: ' + err.message }]
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
