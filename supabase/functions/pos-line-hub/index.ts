import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PosPayload {
  eventType: 'RECEIPT' | 'SHIFT_CLOSE' | 'VOID_ALERT' | 'KITCHEN_TICKET';
  targetLineId?: string;
  orderData?: any;
  shiftData?: any;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. ดึง Channel Access Token จาก app_settings
    const { data: tokenRow } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'line_channel_access_token')
      .single()

    const LINE_ACCESS_TOKEN = tokenRow?.value
    if (!LINE_ACCESS_TOKEN) throw new Error('LINE Channel Access Token is missing in app_settings')

    const payload: PosPayload = await req.json()
    let flexContent: any = null
    let altText = 'การแจ้งเตือนจากระบบ POS'
    let recipientId = payload.targetLineId

    // 2. แยกประมวลผลตามประเภท Event
    if (payload.eventType === 'RECEIPT') {
      const order = payload.orderData || {}
      altText = `🧾 ใบเสร็จรับเงิน #${order.booking_id || order.id} (฿${Number(order.total_amount || 0).toFixed(2)})`
      flexContent = buildReceiptFlex(order)

      // ดึง LINE User ID ถ้าไม่ได้ส่งมาตรงๆ
      if (!recipientId && order.profile_id) {
        const { data: userProfile } = await supabaseAdmin
          .from('profiles')
          .select('line_user_id')
          .eq('id', order.profile_id)
          .single()
        recipientId = userProfile?.line_user_id
      }
    } else if (payload.eventType === 'SHIFT_CLOSE') {
      const shift = payload.shiftData || {}
      altText = `📊 สรุปยอดขายปิดกะ POS (ยอดสุทธิ ฿${Number(shift.total_sales || 0).toFixed(2)})`
      flexContent = buildShiftCloseFlex(shift)

      // หากเป็น Shift Close ให้ส่งเข้ากลุ่มผู้บริหาร
      if (!recipientId) {
        const { data: grpRow } = await supabaseAdmin
          .from('app_settings')
          .select('value')
          .eq('key', 'line_management_group_id')
          .maybeSingle()
        recipientId = grpRow?.value
      }
    }

    if (!recipientId) {
      console.log('No valid recipient LINE ID found for event:', payload.eventType)
      return new Response(JSON.stringify({ skipped: true, reason: 'No Target LINE ID found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3. ส่ง LINE Push Message
    const pushResp = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: recipientId,
        messages: [
          {
            type: 'flex',
            altText: altText,
            contents: flexContent
          }
        ]
      })
    })

    if (!pushResp.ok) {
      const errText = await pushResp.text()
      console.error('LINE Push Error:', errText)
      throw new Error(`LINE Push API Failed: ${errText}`)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    console.error('POS Hub Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})

function buildReceiptFlex(order: any) {
  const items = Array.isArray(order.items) ? order.items : []
  const itemRows = items.slice(0, 10).map((it: any) => ({
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: `${it.quantity}x ${it.name}`, size: "xs", color: "#1E1B18", flex: 7, wrap: true },
      { type: "text", text: Number(it.price * it.quantity).toFixed(2), size: "xs", weight: "bold", color: "#1E1B18", align: "end", flex: 3 }
    ]
  }))

  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#F4F1EA",
      paddingAll: "20px",
      paddingBottom: "16px",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "IN THE HAUS", weight: "bold", size: "md", color: "#1E1B18", flex: 7 },
            { type: "text", text: "E-RECEIPT", weight: "bold", size: "xxs", color: "#C85A32", align: "end", flex: 3, gravity: "center" }
          ]
        },
        { type: "text", text: "TAX INVOICE (ABB) / ใบกำกับภาษีอย่างย่อ", size: "xxs", color: "#78736A", margin: "xs" }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#FBF9F5",
      paddingAll: "20px",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { "type": "text", "text": "BILL NO", "size": "xxs", "color": "#78736A", "flex": 3 },
            { "type": "text", "text": String(order.booking_id || order.id || '-'), "size": "xxs", "weight": "bold", "color": "#1E1B18", "align": "end", "flex": 7 }
          ]
        },
        {
          type: "box",
          layout: "horizontal",
          margin: "xs",
          contents: [
            { "type": "text", "text": "DATE / TIME", "size": "xxs", "color": "#78736A", "flex": 4 },
            { "type": "text", "text": order.date_time || new Date().toLocaleString('th-TH'), "size": "xxs", "color": "#1E1B18", "align": "end", "flex": 6 }
          ]
        },
        {
          type: "box",
          layout: "horizontal",
          margin: "xs",
          contents: [
            { "type": "text", "text": "TABLE / STAFF", "size": "xxs", "color": "#78736A", "flex": 4 },
            { "type": "text", "text": `${order.table_name || 'โต๊ะอาหาร'} / ${order.staff_name || 'Staff'}`, "size": "xxs", "color": "#1E1B18", "align": "end", "flex": 6 }
          ]
        },
        { type: "separator", margin: "md", color: "#E6E1D6" },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: itemRows.length > 0 ? itemRows : [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "อาหารและเครื่องดื่ม", size: "xs", color: "#1E1B18", flex: 7 },
                { type: "text", text: Number(order.total_amount || 0).toFixed(2), size: "xs", weight: "bold", color: "#1E1B18", align: "end", flex: 3 }
              ]
            }
          ]
        },
        { type: "separator", margin: "md", color: "#E6E1D6" },
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          contents: [
            { type: "text", text: "ยอดรวมสินค้า", size: "xs", color: "#78736A", flex: 6 },
            { type: "text", text: Number(order.subtotal || order.total_amount || 0).toFixed(2), size: "xs", color: "#1E1B18", align: "end", flex: 4 }
          ]
        },
        {
          type: "box",
          layout: "horizontal",
          margin: "sm",
          contents: [
            { type: "text", text: `ยอดชำระสุทธิ (${order.payment_method || 'PROMPTPAY'})`, size: "sm", weight: "bold", color: "#1E1B18", flex: 6 },
            { type: "text", text: `฿${Number(order.total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`, size: "lg", weight: "bold", color: "#C85A32", align: "end", flex: 4 }
          ]
        }
      ]
    },
    footer: {
      type: "box",
      layout: "horizontal",
      backgroundColor: "#FBF9F5",
      paddingAll: "16px",
      spacing: "md",
      contents: [
        {
          type: "button",
          action: {
            type: "postback",
            label: "ขอใบกำกับเต็มรูป",
            data: `action=request_full_tax&booking_id=${order.booking_id || order.id}`
          },
          style: "secondary",
          color: "#F4F1EA",
          height: "sm",
          flex: 5
        },
        {
          type: "button",
          action: {
            type: "uri",
            label: "เปิดบัตรสมาชิก",
            uri: "https://liff.line.me/2000000000-xxxx/member-card"
          },
          style: "primary",
          color: "#1E1B18",
          height: "sm",
          flex: 5
        }
      ]
    }
  }
}

function buildShiftCloseFlex(shift: any) {
  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#1E1B18",
      paddingAll: "20px",
      contents: [
        { type: "text", text: "POS SHIFT REPORT", size: "xs", weight: "bold", color: "#C85A32" },
        { type: "text", text: "สรุปรายงานปิดกะแคชเชียร์", size: "md", weight: "bold", color: "#FBF9F5", margin: "xs" },
        { type: "text", text: `ผู้รับผิดชอบ: ${shift.staff_name || 'Staff'} · กะที่ ${shift.shift_number || 1}`, size: "xxs", color: "#A09B90", margin: "xs" }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#FBF9F5",
      paddingAll: "20px",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          backgroundColor: "#F4F1EA",
          cornerRadius: "md",
          paddingAll: "14px",
          contents: [
            {
              type: "box",
              layout: "vertical",
              flex: 5,
              contents: [
                { type: "text", text: "ยอดขายสุทธิทั้งหมด", size: "xs", color: "#78736A" },
                { type: "text", text: `${shift.total_bills || 0} บิล`, size: "xxs", color: "#4A6B3D", margin: "xs" }
              ]
            },
            {
              type: "text",
              text: `฿${Number(shift.total_sales || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
              size: "xl",
              weight: "bold",
              color: "#1E1B18",
              align: "end",
              flex: 5,
              gravity: "center"
            }
          ]
        },
        { type: "separator", margin: "lg", color: "#E6E1D6" },
        { type: "text", text: "BREAKDOWN ช่องทางชำระเงิน", size: "xxs", weight: "bold", color: "#78736A", margin: "md" },
        {
          type: "box",
          layout: "vertical",
          margin: "sm",
          spacing: "xs",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "📱 PromptPay / โอนเงิน", size: "xs", color: "#1E1B18", flex: 7 },
                { type: "text", text: `฿${Number(shift.promptpay_sales || 0).toFixed(2)}`, size: "xs", weight: "bold", color: "#1E1B18", align: "end", flex: 3 }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "💵 เงินสด Cash", size: "xs", color: "#1E1B18", flex: 7 },
                { type: "text", text: `฿${Number(shift.cash_sales || 0).toFixed(2)}`, size: "xs", weight: "bold", color: "#1E1B18", align: "end", flex: 3 }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "💳 บัตรเครดิต Credit Card", size: "xs", color: "#1E1B18", flex: 7 },
                { type: "text", text: `฿${Number(shift.credit_sales || 0).toFixed(2)}`, size: "xs", weight: "bold", color: "#1E1B18", align: "end", flex: 3 }
              ]
            }
          ]
        }
      ]
    }
  }
}
