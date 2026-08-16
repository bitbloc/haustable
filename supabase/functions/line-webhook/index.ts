import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function formatStockQty(qty: number, unit: string): string {
  const roundedQty = Math.max(0, Number(qty.toFixed(4)));
  const fullUnits = Math.floor(roundedQty);
  const remainder = Number((roundedQty - fullUnits).toFixed(4));
  const percent = Math.round(remainder * 100);
  const hasOpen = percent > 0;
  const openedUnits = hasOpen ? 1 : 0;
  const totalPhysical = fullUnits + openedUnits;
  const unitLabel = unit || '';

  if (hasOpen) {
    if (fullUnits > 0) {
      return `${totalPhysical} ${unitLabel} (ยังไม่เปิด ${fullUnits}, เหลืออยู่ ${percent}%)`;
    } else {
      return `1 ${unitLabel} (เหลืออยู่ ${percent}%)`;
    }
  } else {
    return `${fullUnits} ${unitLabel}`;
  }
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

async function scanReceiptImageWithGemini(
  base64Image: string,
  apiKey: string,
  preferredModel: string = 'gemini-3.7-flash'
): Promise<any> {
  const systemInstruction = `
You are an expert Thai Restaurant & Accounting AI Auditor for "IN THE HAUS" restaurant.
Analyze the provided image.
Determine if the image is a receipt, tax invoice, cash bill, payment voucher, fuel receipt, cooking gas bill, utility bill, Makro bill, supermarket bill, or bank transfer slip for an expense.

If the image is NOT a receipt/bill/slip/invoice (e.g. food photo, selfie, random picture, sticker, meme, greeting):
Return ONLY:
{
  "is_receipt": false
}

If it IS a receipt, bill, tax invoice, delivery slip, or expense slip:
Extract and return ONLY a valid JSON object matching this schema:
{
  "is_receipt": true,
  "title": "Clear concise summary in Thai (e.g. 'ซื้อเนื้อสัตว์ ผักสด Makro ศรีนครินทร์', 'ค่าแก๊สหุงต้มครัว (เวิลด์แก๊ส)', 'ค่าน้ำมันรถ ปตท.', 'ค่าไฟฟ้าประจำเดือน', 'ค่าน้ำแข็งหลอด', 'ค่าแก้วและบรรจุภัณฑ์')",
  "amount": 0.00, // Total payable amount (number, no commas)
  "expense_date": "YYYY-MM-DD", // Date of purchase/payment. If missing, use today's date
  "category": "raw_material", // EXACTLY ONE OF: 'raw_material', 'marketing', 'fuel_logistics', 'utilities', 'rent', 'staff_wages', 'equipment_supplies', 'maintenance', 'software_service', 'other'
  "vendor_name": "Name of store/vendor (e.g. 'Siam Makro', 'ร้านแก๊ส / เวิลด์แก๊ส / สยามแก๊ส', 'ปั๊ม ปตท. (PTT)', 'โรงน้ำแข็ง', 'การไฟฟ้านครหลวง', 'Lotus', 'Big C')",
  "vendor_tax_id": "13-digit Thai Tax ID if visible, else empty string",
  "doc_type": "tax_invoice", // EXACTLY ONE OF: 'tax_invoice' (Full tax invoice / ใบกำกับภาษีเต็มรูป), 'cash_bill' (Cash receipt / บิลเงินสด), 'receipt_voucher' (Payment voucher / ใบสำคัญรับเงิน), 'slip_only' (Bank transfer slip / สลิปโอน)
  "vat_included": true, // Boolean: true if VAT 7% is included in the bill (like Makro, gas stations, power bills), false otherwise
  "payment_method": "TRANSFER", // DEFAULT IS ALWAYS 'TRANSFER'. Use 'CASH' only if explicitly marked as cash payment, or 'CREDIT' if marked as credit card.
  "notes": "Brief summary of purchased line items in Thai (e.g. 'แก๊สถัง 15kg 2 ถัง', 'หมูสามชั้น 3kg, นม 4 แกลลอน', 'น้ำแข็งหลอด 5 กระสอบ')",
  "confidence": 0.95 // Confidence score from 0.0 to 1.0
}

Category Rules:
- Cooking Gas / LPG / Gas Tanks (แก๊สหุงต้ม, แก๊สครัว, ถังแก๊ส, เวิลด์แก๊ส, สยามแก๊ส, ปตท.แก๊ส, ร้านส่งแก๊ส, ค่าเติมแก๊ส) -> 'utilities'
- Electricity / Water / Internet (MEA/PEA การไฟฟ้า, MWA/PWA การประปา, True, AIS, 3BB, NT) -> 'utilities'
- Vehicle Fuel & Logistics (ค่าน้ำมันรถ, ดีเซล, เบนซิน, แก๊สรถยนต์, ปั๊ม ปตท., บางจาก, Shell, Caltex, Lalamove, Grab, Lineman, Flash, Kerry) -> 'fuel_logistics'
- Fresh Food / Market / Ingredients / Ice (Makro, Lotus, Big C, CJ More, ตลาดสด, ตลาดไท, โรงน้ำแข็ง, น้ำแข็งหลอด, เนื้อสัตว์, ผักผลไม้, นม, ไข่ไก่, ซอส, เมล็ดกาแฟ, ไซรัป) -> 'raw_material'
- Marketing & Ads (Facebook, TikTok, Instagram, Google Ads, LINE Ads, ป้ายโฆษณา) -> 'marketing'
- Rent & Premises (ค่าเช่าร้าน, ค่าเช่าพื้นที่, ค่าเช่าที่ดิน, เงินมัดจำ) -> 'rent'
- Staff Wages (ค่าแรง, เงินเดือน, ค่าจ้างพาร์ทไทม์, โอที) -> 'staff_wages'
- Equipment & Packaging (แก้วกาแฟ, ฝา, หลอด, ถุงหิ้ว, ถุงขยะ, กล่องอาหาร, ทิชชู่, น้ำยาล้างจาน, อุปกรณ์ครัว) -> 'equipment_supplies'
- Maintenance & Repairs (ช่างไฟ, ช่างประปา, ล้างแอร์, ซ่อมตู้เย็น, HomePro, ไทวัสดุ, ดูโฮม) -> 'maintenance'
- Software & Subscriptions (Spotify, Canva, POS, ระบบรายเดือน) -> 'software_service'

Payment Method Rules:
- DEFAULT: 'TRANSFER' (Mobile banking, PromptPay QR, KPlus, SCB Easy, Krungthai NEXT, KKP, ttb, Bank Transfer slip, etc.)
- Use 'CASH' ONLY if the bill explicitly states cash payment / จ่ายเงินสด.
- Use 'CREDIT' ONLY if the bill explicitly states credit/debit card payment / รูดบัตร.
`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: 'Please analyze this receipt and extract structured expense and tax information in Thai.' },
          {
            inline_data: {
              mime_type: 'image/jpeg',
              data: base64Image
            }
          }
        ]
      }
    ],
    system_instruction: {
      parts: [{ text: systemInstruction }]
    },
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0.1
    }
  };

  const candidateModels = Array.from(new Set([
    preferredModel,
    'gemini-3.7-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-3.7-pro',
    'gemini-2.5-pro',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-2.0-flash-exp',
    'gemini-1.5-pro'
  ]));

  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[Gemini ${model}] failed with status ${response.status}:`, errText);
        if (response.status === 404 || errText.toLowerCase().includes('not found')) {
          continue;
        }
        lastError = new Error(`Gemini API Error: ${errText}`);
        continue;
      }

      const resJson = await response.json();
      const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return parsed;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Failed to scan receipt with Gemini AI');
}

function createReceiptFlexMessage(expense: any, dateFormatted: string) {
  const categoryLabels: Record<string, string> = {
    'raw_material': '🛒 วัตถุดิบ & ของสด (MAKRO/ตลาด)',
    'marketing': '📣 ค่ายิงแอด & การตลาด',
    'fuel_logistics': '⛽ ค่าน้ำมัน & ค่าส่งของ',
    'utilities': '⚡ ค่าน้ำ / ไฟ / แก๊ส / เน็ต',
    'rent': '🏠 ค่าเช่าสถานที่',
    'staff_wages': '👥 ค่าจ้าง / เงินเดือน',
    'equipment_supplies': '📦 ของใช้ & บรรจุภัณฑ์',
    'maintenance': '🔧 ซ่อมบำรุง & ตกแต่ง',
    'software_service': '💻 ค่าบริการ & ซอฟต์แวร์',
    'other': '📌 อื่นๆ / เบ็ดเตล็ด'
  };

  const docTypeLabels: Record<string, string> = {
    'tax_invoice': 'ใบกำกับภาษีเต็มรูป (TAX INVOICE)',
    'cash_bill': 'บิลเงินสด (CASH BILL)',
    'receipt_voucher': 'ใบสำคัญรับเงิน (VOUCHER)',
    'slip_only': 'สลิปโอนเงิน (TRANSFER SLIP)'
  };

  const categoryText = categoryLabels[expense.category] || expense.category;
  const docTypeText = docTypeLabels[expense.doc_type] || expense.doc_type;
  const vendorDisplay = (expense.vendor_name || 'ไม่ระบุร้านค้า').toUpperCase();
  const amountStr = `฿${Number(expense.amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const detailRows: any[] = [
    {
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "หมวดหมู่", color: "#666666", size: "xs", flex: 3 },
        { type: "text", text: categoryText, color: "#1A1A1A", size: "xs", weight: "bold", align: "end", flex: 5, wrap: true }
      ]
    },
    {
      type: "box",
      layout: "horizontal",
      margin: "sm",
      contents: [
        { type: "text", text: "วันที่เอกสาร", color: "#666666", size: "xs", flex: 3 },
        { type: "text", text: dateFormatted, color: "#1A1A1A", size: "xs", weight: "bold", align: "end", flex: 5 }
      ]
    },
    {
      type: "box",
      layout: "horizontal",
      margin: "sm",
      contents: [
        { type: "text", text: "ประเภทเอกสาร", color: "#666666", size: "xs", flex: 3 },
        { type: "text", text: docTypeText, color: "#1A1A1A", size: "xs", weight: "bold", align: "end", flex: 5, wrap: true }
      ]
    }
  ];

  if (expense.vat_included && expense.vat_amount > 0) {
    detailRows.push({
      type: "box",
      layout: "horizontal",
      margin: "sm",
      contents: [
        { type: "text", text: "ภาษีมูลค่าเพิ่ม (VAT 7%)", color: "#666666", size: "xs", flex: 4 },
        { type: "text", text: `฿${Number(expense.vat_amount).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: "#2D804E", size: "xs", weight: "bold", align: "end", flex: 4 }
      ]
    });
  }

  if (expense.vendor_tax_id) {
    detailRows.push({
      type: "box",
      layout: "horizontal",
      margin: "sm",
      contents: [
        { type: "text", text: "เลขผู้เสียภาษี", color: "#666666", size: "xs", flex: 3 },
        { type: "text", text: expense.vendor_tax_id, color: "#1A1A1A", size: "xs", weight: "bold", align: "end", flex: 5 }
      ]
    });
  }

  if (expense.payment_method) {
    const payMap: Record<string, string> = {
      'TRANSFER': 'โอนเงิน (TRANSFER)',
      'CASH': 'เงินสด (CASH)',
      'CREDIT': 'บัตรเครดิต (CREDIT)'
    };
    detailRows.push({
      type: "box",
      layout: "horizontal",
      margin: "sm",
      contents: [
        { type: "text", text: "วิธีชำระเงิน", color: "#666666", size: "xs", flex: 3 },
        { type: "text", text: payMap[expense.payment_method] || expense.payment_method, color: "#1A1A1A", size: "xs", weight: "bold", align: "end", flex: 5 }
      ]
    });
  }

  if (expense.notes) {
    detailRows.push({
      type: "box",
      layout: "vertical",
      margin: "md",
      backgroundColor: "#F9F9F8",
      cornerRadius: "sm",
      paddingAll: "sm",
      contents: [
        { type: "text", text: "รายการสินค้า / หมายเหตุ:", color: "#888888", size: "xxs", weight: "bold" },
        { type: "text", text: expense.notes, color: "#1A1A1A", size: "xs", wrap: true, margin: "xs" }
      ]
    });
  }

  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      paddingAll: "20px",
      contents: [
        { type: "text", text: "RECEIPT RECORDED (AI)", weight: "bold", color: "#1A1A1A", size: "sm" },
        { type: "text", text: "ระบบลงบัญชีค่าใช้จ่ายอัตโนมัติ", color: "#666666", size: "xs", margin: "xs" }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "20px",
      contents: [
        // Status indicator
        {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "box",
              layout: "vertical",
              width: "4px",
              backgroundColor: "#2D804E",
              cornerRadius: "sm",
              contents: []
            },
            {
              type: "box",
              layout: "vertical",
              margin: "md",
              contents: [
                { type: "text", text: "บันทึกข้อมูลเข้าหลังบ้านเรียบร้อยแล้ว", color: "#2D804E", weight: "bold", size: "xs" },
                { type: "text", text: vendorDisplay, weight: "bold", color: "#1A1A1A", size: "sm", margin: "xs", wrap: true },
                { type: "text", text: expense.title || 'ค่าใช้จ่ายร้าน', color: "#666666", size: "xs", margin: "xs", wrap: true }
              ]
            }
          ]
        },
        { type: "separator", margin: "md", color: "#E2E2E0" },
        // Total Amount stark box
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          backgroundColor: "#F9F9F8",
          cornerRadius: "md",
          paddingAll: "md",
          contents: [
            { type: "text", text: "ยอดสุทธิ", weight: "bold", size: "sm", color: "#1A1A1A", gravity: "center", flex: 4 },
            { type: "text", text: amountStr, weight: "bold", size: "lg", color: "#9E2D2D", align: "end", gravity: "center", flex: 6 }
          ]
        },
        { type: "separator", margin: "md", color: "#E2E2E0" },
        ...detailRows,
        { type: "separator", margin: "md", color: "#E2E2E0" },
        {
          type: "text",
          text: "ตรวจสอบและดูภาพสลิปต้นฉบับได้ที่เมนู บัญชีและภาษี (Admin Tax Hub)",
          color: "#888888",
          size: "xxs",
          align: "center",
          margin: "md",
          wrap: true
        }
      ]
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
  };
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
            } else {
               const threeDaysAgo = new Date(new Date().getTime() - (3 * 24 * 60 * 60 * 1000)).toISOString()
               query = query.gte('updated_at', threeDaysAgo)
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

            const headerTitle = isBuyback ? "RESTOCK LIST (24H)" : "RESTOCK LIST (3 DAYS)";
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
                       { type: "text", text: "REMAINING", color: "#888888", size: "xxs", weight: "bold", align: "end", flex: 1 }
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
                         // Item Name
                         {
                             type: "text",
                             text: itemName,
                             weight: "bold",
                             size: "sm",
                             color: "#1A1A1A",
                             wrap: true,
                             flex: 5,
                             gravity: "center",
                             margin: "md"
                         },
                         // Right quantity & status details
                         {
                             type: "box",
                             layout: "vertical",
                             flex: 5,
                             margin: "md",
                             contents: [
                                 {
                                     type: "text",
                                     text: formatStockQty(current, item.unit || ''),
                                     color: "#1A1A1A",
                                     size: "sm",
                                     weight: "bold",
                                     align: "end",
                                     wrap: true
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
                 })

                 if (currentItems.length >= 8 || index === itemsToBuy.length - 1) {
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
               
               // LINE Carousel max 12 bubbles, but also need to respect 50KB Flex content limit
               if (bubbles.length > 12) bubbles.length = 12;
               const totalBubblesBuy = bubbles.length;
               let flexContentBuy = bubbles.length === 1 ? bubbles[0] : { type: "carousel", contents: bubbles };
               let flexSizeBuy = new TextEncoder().encode(JSON.stringify(flexContentBuy)).length;
               while (flexSizeBuy > 49000 && bubbles.length > 1) {
                   bubbles.pop();
                   flexContentBuy = bubbles.length === 1 ? bubbles[0] : { type: "carousel", contents: bubbles };
                   flexSizeBuy = new TextEncoder().encode(JSON.stringify(flexContentBuy)).length;
               }
               if (bubbles.length < totalBubblesBuy) {
                   const lastB = bubbles[bubbles.length - 1];
                   lastB.body.contents.push({ type: "separator", margin: "md", color: "#E2E2E0" });
                   lastB.body.contents.push({ type: "text", text: `...(แสดงได้ ${bubbles.length} จาก ${totalBubblesBuy} หน้า)`, color: "#9E2D2D", size: "xs", margin: "md", align: "center", wrap: true });
                   // recalculate after adding truncation text
                   flexContentBuy = bubbles.length === 1 ? bubbles[0] : { type: "carousel", contents: bubbles };
               }
               console.log(`Flex stbuy: ${bubbles.length}/${totalBubblesBuy} bubbles, ${flexSizeBuy} bytes`);
               messages.push({ type: "flex", altText: headerTitle, contents: flexContentBuy });
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
                       { type: "text", text: "REMAINING", color: "#888888", size: "xxs", weight: "bold", align: "end", flex: 3 }
                   ]
               };
               
               transactions.forEach((tx: any, index: number) => {
                 const qtyChange = Number(Number(tx.quantity_change).toFixed(4));
                 const sign = qtyChange > 0 ? '+' : '';
                 
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

                 const changeColor = qtyChange > 0 ? '#1B4D3E' : qtyChange < 0 ? '#8B0000' : '#666666';

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
                          // Time
                          { 
                              type: "text", 
                              text: time, 
                              color: "#444444", 
                              size: "xs", 
                              weight: "bold", 
                              flex: 2, 
                              gravity: "center",
                              margin: "md"
                          },
                          // Item Name & transaction details
                          {
                              type: "box",
                              layout: "vertical",
                              flex: 5,
                              margin: "md",
                              contents: [
                                  { type: "text", text: itemName, weight: "bold", size: "sm", color: "#1A1A1A", wrap: true },
                                  { type: "text", text: `${sign}${qtyChange} ${itemUnit}`, color: changeColor, size: "xs", weight: "bold", margin: "xs" },
                                  ...(tx.note ? [{
                                      type: "text", text: `NOTE: ${tx.note}`, color: "#777777", size: "xxs", margin: "xs", wrap: true
                                  }] : [])
                              ]
                          },
                          // Balance & status
                          {
                              type: "box",
                              layout: "vertical",
                              flex: 3,
                              margin: "md",
                              contents: [
                                  { 
                                      type: "text", 
                                      text: formatStockQty(current, itemUnit), 
                                      color: "#1A1A1A", 
                                      size: "xs", 
                                      weight: "bold", 
                                      align: "end",
                                      wrap: true
                                  },
                                  { type: "text", text: statusEmoji, color: indicatorBarColor, size: "xxs", weight: "bold", margin: "xs", align: "end" }
                              ]
                          }
                      ]
                  })


                 // Chunk into bubbles every 15 items
                 if (currentItems.length >= 8 || index === transactions.length - 1) {
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
               
               if (bubbles.length > 12) bubbles.length = 12;
               const totalBubblesStock = bubbles.length;
               let flexContentStock: any = { type: "carousel", contents: bubbles };
               let flexSizeStock = new TextEncoder().encode(JSON.stringify(flexContentStock)).length;
               while (flexSizeStock > 49000 && bubbles.length > 1) {
                   bubbles.pop();
                   flexContentStock = { type: "carousel", contents: bubbles };
                   flexSizeStock = new TextEncoder().encode(JSON.stringify(flexContentStock)).length;
               }
               if (bubbles.length < totalBubblesStock) {
                   const lastB = bubbles[bubbles.length - 1];
                   lastB.body.contents.push({ type: "separator", margin: "md", color: "#E2E2E0" });
                   lastB.body.contents.push({ type: "text", text: `...(แสดงได้ ${bubbles.length} จาก ${totalBubblesStock} หน้า เนื่องจากขนาดข้อความเกินขีดจำกัด)`, color: "#9E2D2D", size: "xs", margin: "md", align: "center", wrap: true });
               }
               console.log(`Flex stock: ${bubbles.length}/${totalBubblesStock} bubbles, ${flexSizeStock} bytes`);
                messages.push({
                    type: "flex",
                    altText: headerTitle,
                    contents: flexContentStock
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

        // --- NEW: Active Orders Command (storder) ---
        if (text === 'storder') {
          console.log('Processing storder command...')
          try {
            const eighteenHoursAgo = new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString()
            const { data: bookings, error } = await supabaseAdmin
              .from('bookings')
              .select('*, tables_layout(table_name), order_items(*, menu_items(name))')
              .in('status', ['pending', 'confirmed', 'seated', 'ready'])
              .gte('booking_time', eighteenHoursAgo)
              .order('booking_time', { ascending: true })

            if (error) throw error

            const translateType = (type: string) => {
              if (type === 'pickup') return 'สั่งกลับบ้าน (TAKEAWAY)'
              if (type === 'dine_in') return 'ทานที่ร้าน (DINE-IN)'
              if (type === 'walk_in') return 'ลูกค้าวอล์กอิน (WALK-IN)'
              if (type === 'steak') return 'โต๊ะสเต็ก (STEAK)'
              return 'ทั่วไป (DINE-IN)'
            }

            const translateStatus = (status: string) => {
              if (status === 'pending') return 'รอรับออเดอร์ (PENDING)'
              if (status === 'confirmed') return 'กำลังปรุง (CONFIRMED)'
              if (status === 'seated') return 'นั่งที่โต๊ะ (SEATED)'
              if (status === 'ready') return 'พร้อมเสิร์ฟ (READY)'
              return status.toUpperCase()
            }

            const getStatusColor = (status: string) => {
              if (status === 'pending') return '#E63946' // Red
              if (status === 'ready') return '#2D804E' // Green
              return '#F4A261' // Orange for seated/confirmed
            }

            const formatOptions = (options: any) => {
              if (!options) return ''
              let opts: string[] = []
              if (Array.isArray(options)) {
                opts = options.map(o => typeof o === 'object' ? `${o.name}` : o)
              } else if (typeof options === 'object') {
                opts = Object.entries(options).map(([key, value]) => `${key}: ${value}`)
              }
              return opts.length > 0 ? ` (${opts.join(', ')})` : ''
            }

            let messages = []

            if (!bookings || bookings.length === 0) {
              messages.push({
                type: "flex",
                altText: "📦 ออเดอร์ปัจจุบัน: ไม่มีออเดอร์ค้างอยู่",
                contents: {
                  type: "bubble",
                  size: "mega",
                  header: {
                    type: "box",
                    layout: "vertical",
                    paddingAll: "20px",
                    contents: [
                      { type: "text", text: "ACTIVE ORDERS", weight: "bold", color: "#1A1A1A", size: "sm" },
                      { type: "text", text: "ออเดอร์โต๊ะและสั่งกลับบ้าน", color: "#666666", size: "xs", margin: "xs" }
                    ]
                  },
                  body: {
                    type: "box",
                    layout: "vertical",
                    paddingAll: "20px",
                    contents: [
                      { type: "text", text: "ไม่มีออเดอร์ค้างอยู่ในขณะนี้ 🟢", color: "#2D804E", size: "sm", align: "center", weight: "bold" }
                    ]
                  },
                  styles: {
                    header: { backgroundColor: "#F4F4F3", separator: true, separatorColor: "#E2E2E0" },
                    body: { backgroundColor: "#FFFFFF" }
                  }
                }
              })
            } else {
              const bubbles: any[] = []

              for (const booking of bookings) {
                const isPickup = booking.booking_type === 'pickup'
                const displayName = isPickup 
                  ? `🛍️ TAKEAWAY - ${booking.pickup_contact_name || booking.customer_note || 'ลูกค้า'}`
                  : `🪑 ${booking.tables_layout?.table_name || 'TABLE'}`
                
                const typeText = translateType(booking.booking_type)
                const statusText = translateStatus(booking.status)
                const indicatorColor = getStatusColor(booking.status)

                let orderTimeStr = ''
                try {
                  const bTime = new Date(booking.booking_time)
                  const thTime = new Date(bTime.getTime() + (7 * 60 * 60 * 1000))
                  orderTimeStr = thTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
                } catch (e) {
                  orderTimeStr = booking.booking_time ? booking.booking_time.substring(11, 16) : ''
                }

                const itemContents: any[] = []
                let subtotal = 0

                if (booking.order_items && booking.order_items.length > 0) {
                  booking.order_items.forEach((item: any) => {
                    const name = item.menu_items?.name || 'Unknown Item'
                    const qty = item.quantity || 0
                    const price = item.price_at_time || 0
                    const itemTotal = qty * price
                    subtotal += itemTotal

                    const optionsStr = formatOptions(item.selected_options)

                    itemContents.push({
                      type: "box",
                      layout: "horizontal",
                      margin: "sm",
                      contents: [
                        { type: "text", text: `${qty} x`, weight: "bold", size: "sm", color: "#1A1A1A", flex: 2 },
                        { type: "text", text: `${name}${optionsStr}`, size: "sm", color: "#1A1A1A", wrap: true, flex: 6 },
                        { type: "text", text: `฿${itemTotal}`, size: "sm", color: "#1A1A1A", align: "end", flex: 2 }
                      ]
                    })
                  })
                } else {
                  itemContents.push({
                    type: "text",
                    text: "ไม่มีรายการอาหาร",
                    color: "#888888",
                    size: "xs",
                    align: "center",
                    margin: "md"
                  })
                }

                const bodyContents = [
                  {
                    type: "box",
                    layout: "horizontal",
                    contents: [
                      {
                        type: "box",
                        layout: "vertical",
                        width: "4px",
                        backgroundColor: indicatorColor,
                        cornerRadius: "sm",
                        contents: []
                      },
                      {
                        type: "box",
                        layout: "vertical",
                        margin: "md",
                        contents: [
                          { type: "text", text: statusText, color: indicatorColor, weight: "bold", size: "xs" },
                          { type: "text", text: `ประเภท: ${typeText}`, color: "#666666", size: "xs", margin: "xs" },
                          { type: "text", text: `เวลาสั่ง: ${orderTimeStr}`, color: "#666666", size: "xs", margin: "xs" }
                        ]
                      }
                    ]
                  },
                  { type: "separator", margin: "md", color: "#E2E2E0" },
                  { type: "text", text: "รายการสั่งซื้อ", weight: "bold", size: "xs", color: "#888888", margin: "md" },
                  ...itemContents,
                  { type: "separator", margin: "md", color: "#E2E2E0" },
                  {
                    type: "box",
                    layout: "horizontal",
                    margin: "md",
                    contents: [
                      { type: "text", text: "ยอดรวมทั้งหมด", weight: "bold", size: "sm", color: "#1A1A1A", flex: 5 },
                      { type: "text", text: `฿${subtotal.toLocaleString('th-TH')}`, weight: "bold", size: "sm", color: "#9E2D2D", align: "end", flex: 5 }
                    ]
                  }
                ]

                bubbles.push({
                  type: "bubble",
                  size: "mega",
                  header: {
                    type: "box",
                    layout: "horizontal",
                    paddingAll: "20px",
                    contents: [
                      { type: "text", text: displayName.toUpperCase(), weight: "bold", color: "#1A1A1A", size: "sm", flex: 8, wrap: true },
                      { type: "text", text: booking.pax ? `👥 ${booking.pax} PAX` : (isPickup ? "🛍️ TAKEAWAY" : ""), color: "#666666", size: "xs", align: "end", flex: 4, gravity: "center" }
                    ]
                  },
                  body: {
                    type: "box",
                    layout: "vertical",
                    paddingAll: "20px",
                    contents: bodyContents
                  },
                  styles: {
                    header: { backgroundColor: "#F4F4F3", separator: true, separatorColor: "#E2E2E0" },
                    body: { backgroundColor: "#FFFFFF" }
                  }
                })
              }

              if (bubbles.length > 12) bubbles.length = 12;
              let flexContent = bubbles.length === 1 ? bubbles[0] : { type: "carousel", contents: bubbles };
              messages.push({
                type: "flex",
                altText: `📦 ออเดอร์ค้างในระบบ (${bookings.length} รายการ)`,
                contents: flexContent
              })
            }

            console.log('Sending storder reply...')
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
              console.error('storder reply failed:', await resp.text())
            }
          } catch (err: any) {
            console.error('storder Command Error:', err)
            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: 'text', text: '❌ เกิดข้อผิดพลาดในการดึงรายการออเดอร์: ' + err.message }]
              })
            })
          }
          continue
        }

        // --- NEW: Top 5 Hero Items Command (sthero) ---
        if (text === 'sthero') {
          console.log('Processing sthero command...')
          try {
            const now = new Date()
            const thNow = new Date(now.getTime() + (7 * 60 * 60 * 1000))
            
            const queryDateStart = new Date(thNow)
            queryDateStart.setHours(0, 0, 0, 0)
            const queryDateEnd = new Date(queryDateStart)
            queryDateEnd.setHours(23, 59, 59, 999)

            const dbStart = new Date(queryDateStart.getTime() - (7 * 60 * 60 * 1000)).toISOString()
            const dbEnd = new Date(queryDateEnd.getTime() - (7 * 60 * 60 * 1000)).toISOString()

            let titleDateStr = ""
            try {
              titleDateStr = queryDateStart.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
            } catch (e) {
              titleDateStr = queryDateStart.toISOString().split('T')[0]
            }

            console.log(`Querying hero items from ${dbStart} to ${dbEnd}`)

            const { data: bookingsData, error } = await supabaseAdmin
              .from('bookings')
              .select('id, order_items(quantity, menu_item_id, menu_items(name))')
              .gte('booking_time', dbStart)
              .lte('booking_time', dbEnd)
              .not('status', 'eq', 'void')
              .not('status', 'eq', 'cancelled')

            if (error) throw error

            const itemTotals: { [key: string]: { name: string; quantity: number } } = {}
            bookingsData?.forEach((b: any) => {
              b.order_items?.forEach((item: any) => {
                const itemId = item.menu_item_id
                if (!itemId) return
                const itemName = item.menu_items?.name || 'Unknown Item'
                const qty = Number(item.quantity) || 0
                if (!itemTotals[itemId]) {
                  itemTotals[itemId] = { name: itemName, quantity: 0 }
                }
                itemTotals[itemId].quantity += qty
              })
            })

            const sortedItems = Object.entries(itemTotals)
              .map(([id, val]) => ({ id, name: val.name, quantity: val.quantity }))
              .sort((a, b) => b.quantity - a.quantity)
              .slice(0, 5)

            let messages = []

            if (sortedItems.length === 0) {
              messages.push({
                type: "flex",
                altText: `🏆 5 อันดับเมนูฮิตวันนี้: ${titleDateStr}`,
                contents: {
                  type: "bubble",
                  size: "mega",
                  header: {
                    type: "box",
                    layout: "vertical",
                    paddingAll: "20px",
                    contents: [
                      { type: "text", text: "HERO MENU (TODAY)", weight: "bold", color: "#1A1A1A", size: "sm" },
                      { type: "text", text: titleDateStr.toUpperCase(), color: "#666666", size: "xs", margin: "xs" }
                    ]
                  },
                  body: {
                    type: "box",
                    layout: "vertical",
                    paddingAll: "20px",
                    contents: [
                      { type: "text", text: "ยังไม่มีรายการสั่งอาหารในวันนี้ 📭", color: "#888888", size: "sm", align: "center", weight: "bold" }
                    ]
                  },
                  styles: {
                    header: { backgroundColor: "#F4F4F3", separator: true, separatorColor: "#E2E2E0" },
                    body: { backgroundColor: "#FFFFFF" }
                  }
                }
              })
            } else {
              const maxQty = sortedItems[0].quantity
              const flexContents: any[] = []

              sortedItems.forEach((item, index) => {
                const percent = maxQty > 0 ? Math.round((item.quantity / maxQty) * 100) : 0
                const rankColors = ["#E63946", "#F4A261", "#2D804E", "#888888", "#aaaaaa"]
                const rankColor = rankColors[index] || "#888888"

                flexContents.push({
                  type: "box",
                  layout: "vertical",
                  margin: "md",
                  contents: [
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        {
                          type: "box",
                          layout: "vertical",
                          width: "20px",
                          height: "20px",
                          backgroundColor: rankColor,
                          cornerRadius: "4px",
                          contents: [
                            { type: "text", text: String(index + 1), color: "#FFFFFF", size: "xs", weight: "bold", align: "center", gravity: "center" }
                          ]
                        },
                        {
                          type: "text",
                          text: item.name.toUpperCase(),
                          weight: "bold",
                          size: "sm",
                          color: "#1A1A1A",
                          margin: "md",
                          gravity: "center",
                          flex: 7
                        },
                        {
                          type: "text",
                          text: `${item.quantity} ที่`,
                          weight: "bold",
                          size: "sm",
                          color: "#1A1A1A",
                          align: "end",
                          gravity: "center",
                          flex: 3
                        }
                      ]
                    },
                    {
                      type: "box",
                      layout: "horizontal",
                      margin: "sm",
                      height: "8px",
                      backgroundColor: "#F0F0EE",
                      cornerRadius: "sm",
                      contents: [
                        {
                          type: "box",
                          layout: "vertical",
                          width: `${percent}%`,
                          backgroundColor: "#1A1A1A",
                          cornerRadius: "sm",
                          contents: []
                        }
                      ]
                    }
                  ]
                })

                if (index < sortedItems.length - 1) {
                  flexContents.push({ type: "separator", margin: "md", color: "#E2E2E0" })
                }
              })

              messages.push({
                type: "flex",
                altText: `🏆 5 อันดับเมนูฮิตวันนี้: ${titleDateStr}`,
                contents: {
                  type: "bubble",
                  size: "mega",
                  header: {
                    type: "box",
                    layout: "vertical",
                    paddingAll: "20px",
                    contents: [
                      { type: "text", text: "5 อันดับเมนูฮิตวันนี้ 🏆", weight: "bold", color: "#1A1A1A", size: "sm" },
                      { type: "text", text: `ยอดขายสะสม ณ วันที่ ${titleDateStr}`, color: "#666666", size: "xs", margin: "xs" }
                    ]
                  },
                  body: {
                    type: "box",
                    layout: "vertical",
                    paddingAll: "20px",
                    contents: flexContents
                  },
                  styles: {
                    header: { backgroundColor: "#F4F4F3", separator: true, separatorColor: "#E2E2E0" },
                    body: { backgroundColor: "#FFFFFF" }
                  }
                }
              })
            }

            console.log('Sending sthero reply...')
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
              console.error('sthero reply failed:', await resp.text())
            }
          } catch (err: any) {
            console.error('sthero Command Error:', err)
            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: 'text', text: '❌ เกิดข้อผิดพลาดในการคำนวณเมนูฮิต: ' + err.message }]
              })
            })
          }
          continue
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
          continue
        }

        // --- NEW: Daily Expenses Summary Command (stexp / stexpense) ---
        if (text === 'stexp' || text === 'stexpense' || text === 'stexpenses') {
          console.log('Processing stexp command...')
          try {
            const now = new Date()
            const thNow = new Date(now.getTime() + (7 * 60 * 60 * 1000))
            const todayStr = thNow.toISOString().split('T')[0]

            let titleDateStr = ''
            try {
              titleDateStr = thNow.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
            } catch {
              titleDateStr = todayStr
            }

            const { data: expenses, error } = await supabaseAdmin
              .from('store_expenses')
              .select('*')
              .eq('expense_date', todayStr)
              .order('created_at', { ascending: false })

            if (error) throw error

            let totalAmount = 0
            let totalVat = 0
            ;(expenses || []).forEach((exp: any) => {
              totalAmount += Number(exp.amount) || 0
              totalVat += Number(exp.vat_amount) || 0
            })

            let messages = []

            if (!expenses || expenses.length === 0) {
              messages.push({
                type: "flex",
                altText: `🧾 สรุปค่าใช้จ่ายวันนี้ (${titleDateStr}): ยังไม่มีรายการ`,
                contents: {
                  type: "bubble",
                  size: "mega",
                  header: {
                    type: "box",
                    layout: "vertical",
                    paddingAll: "20px",
                    contents: [
                      { type: "text", text: "DAILY EXPENSES", weight: "bold", color: "#1A1A1A", size: "sm" },
                      { type: "text", text: titleDateStr.toUpperCase(), color: "#666666", size: "xs", margin: "xs" }
                    ]
                  },
                  body: {
                    type: "box",
                    layout: "vertical",
                    paddingAll: "20px",
                    contents: [
                      { type: "text", text: "ยังไม่มีการบันทึกค่าใช้จ่ายในวันนี้ 📭", color: "#888888", size: "sm", align: "center", weight: "bold" },
                      { type: "text", text: "ส่งภาพสลิป/ใบเสร็จเข้ามาในกลุ่มเพื่อบันทึกอัตโนมัติได้ทันที", color: "#aaaaaa", size: "xs", align: "center", margin: "sm", wrap: true }
                    ]
                  },
                  styles: {
                    header: { backgroundColor: "#F4F4F3", separator: true, separatorColor: "#E2E2E0" },
                    body: { backgroundColor: "#FFFFFF" }
                  }
                }
              })
            } else {
              const flexContents: any[] = []

              expenses.slice(0, 8).forEach((exp: any, index: number) => {
                const vendor = exp.vendor_name || 'ไม่ระบุ'
                const title = exp.title || 'ค่าใช้จ่าย'
                const amt = Number(exp.amount) || 0

                flexContents.push({
                  type: "box",
                  layout: "horizontal",
                  margin: "md",
                  contents: [
                    {
                      type: "box",
                      layout: "vertical",
                      flex: 7,
                      contents: [
                        { type: "text", text: vendor.toUpperCase(), weight: "bold", size: "xs", color: "#1A1A1A", wrap: true },
                        { type: "text", text: title, size: "xxs", color: "#666666", wrap: true, margin: "xs" }
                      ]
                    },
                    {
                      type: "text",
                      text: `฿${amt.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                      weight: "bold",
                      size: "sm",
                      color: "#9E2D2D",
                      align: "end",
                      gravity: "center",
                      flex: 3
                    }
                  ]
                })

                if (index < Math.min(expenses.length, 8) - 1) {
                  flexContents.push({ type: "separator", margin: "md", color: "#E2E2E0" })
                }
              })

              if (expenses.length > 8) {
                flexContents.push({ type: "separator", margin: "md", color: "#E2E2E0" })
                flexContents.push({
                  type: "text",
                  text: `...แสดง 8 จากทั้งหมด ${expenses.length} รายการ`,
                  color: "#888888",
                  size: "xxs",
                  align: "center",
                  margin: "sm"
                })
              }

              messages.push({
                type: "flex",
                altText: `🧾 สรุปค่าใช้จ่ายวันนี้ (${titleDateStr}): ฿${totalAmount.toLocaleString('th-TH')}`,
                contents: {
                  type: "bubble",
                  size: "mega",
                  header: {
                    type: "box",
                    layout: "vertical",
                    paddingAll: "20px",
                    contents: [
                      { type: "text", text: "DAILY EXPENSES", weight: "bold", color: "#1A1A1A", size: "sm" },
                      { type: "text", text: titleDateStr.toUpperCase(), color: "#666666", size: "xs", margin: "xs" }
                    ]
                  },
                  body: {
                    type: "box",
                    layout: "vertical",
                    paddingAll: "20px",
                    contents: [
                      {
                        type: "box",
                        layout: "horizontal",
                        backgroundColor: "#F9F9F8",
                        cornerRadius: "md",
                        paddingAll: "md",
                        contents: [
                          {
                            type: "box",
                            layout: "vertical",
                            flex: 5,
                            contents: [
                              { type: "text", text: "ยอดรวมค่าใช้จ่ายวันนี้", weight: "bold", size: "xs", color: "#1A1A1A" },
                              { type: "text", text: `(${expenses.length} รายการ)`, color: "#666666", size: "xxs", margin: "xs" }
                            ]
                          },
                          {
                            type: "text",
                            text: `฿${totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                            weight: "bold",
                            size: "lg",
                            color: "#9E2D2D",
                            align: "end",
                            gravity: "center",
                            flex: 5
                          }
                        ]
                      },
                      { type: "separator", margin: "md", color: "#E2E2E0" },
                      { type: "text", text: "รายการที่บันทึกวันนี้", weight: "bold", size: "xs", color: "#888888", margin: "md" },
                      ...flexContents
                    ]
                  },
                  styles: {
                    header: { backgroundColor: "#F4F4F3", separator: true, separatorColor: "#E2E2E0" },
                    body: { backgroundColor: "#FFFFFF" }
                  }
                }
              })
            }

            await fetch('https://api.line.me/v2/bot/message/reply', {
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
          } catch (err: any) {
            console.error('stexp Command Error:', err)
            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: 'text', text: '❌ เกิดข้อผิดพลาดในการดึงรายการค่าใช้จ่าย: ' + err.message }]
              })
            })
          }
          continue
        }
      }

      // --- NEW: Image Message Handler for Receipt OCR & Auto Expense Recording ---
      if (event.type === 'message' && event.message.type === 'image') {
        const messageId = event.message.id
        const replyToken = event.replyToken
        console.log(`Processing receipt image event. Message ID: ${messageId}`)

        try {
          // 1. Download image binary from LINE Content API
          const lineImgUrl = `https://api-data.line.me/v2/bot/message/${messageId}/content`
          const imgResp = await fetch(lineImgUrl, {
            headers: { 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` }
          })

          if (!imgResp.ok) {
            const errTxt = await imgResp.text()
            console.error('Failed to download image from LINE API:', errTxt)
            continue
          }

          const imageBuffer = await imgResp.arrayBuffer()
          const imageBytes = new Uint8Array(imageBuffer)

          // 2. Convert to Base64 (Chunked to prevent stack overflow)
          let binary = ''
          const len = imageBytes.byteLength
          const chunkSize = 8192
          for (let i = 0; i < len; i += chunkSize) {
            const chunk = imageBytes.subarray(i, Math.min(i + chunkSize, len))
            binary += String.fromCharCode.apply(null, chunk as any)
          }
          const base64Image = btoa(binary)

          // 3. Upload image to Supabase Storage (receipts bucket)
          const now = new Date()
          const thNow = new Date(now.getTime() + (7 * 60 * 60 * 1000))
          const folder = thNow.toISOString().slice(0, 7)
          const fileName = `${folder}/${Date.now()}_${messageId}.jpg`
          let receiptImageUrl = ''

          try {
            const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
              .from('receipts')
              .upload(fileName, imageBytes, {
                contentType: 'image/jpeg',
                upsert: true
              })

            if (!uploadErr && uploadData) {
              const { data: urlData } = supabaseAdmin.storage.from('receipts').getPublicUrl(fileName)
              receiptImageUrl = urlData?.publicUrl || ''
            } else if (uploadErr) {
              console.error('Receipt upload error to Supabase Storage:', uploadErr)
            }
          } catch (stErr) {
            console.error('Storage upload exception:', stErr)
          }

          // 4. Retrieve Gemini API Key & Preferred Model
          let geminiApiKey = Deno.env.get('GEMINI_API_KEY') || ''
          if (!geminiApiKey) {
            const { data: keyRow } = await supabaseAdmin
              .from('app_settings')
              .select('value')
              .eq('key', 'gemini_api_key')
              .maybeSingle()
            geminiApiKey = keyRow?.value || ''
          }

          let preferredModel = 'gemini-3.7-flash'
          const { data: modelRow } = await supabaseAdmin
            .from('app_settings')
            .select('value')
            .eq('key', 'gemini_model')
            .maybeSingle()
          if (modelRow?.value) preferredModel = modelRow.value

          if (!geminiApiKey) {
            console.warn('Gemini API key is not configured in app_settings or environment.')
            continue
          }

          // 5. Call Gemini AI Vision OCR
          const ocrResult = await scanReceiptImageWithGemini(base64Image, geminiApiKey, preferredModel)
          console.log('Gemini OCR Result:', JSON.stringify(ocrResult))

          if (!ocrResult || ocrResult.is_receipt === false) {
            console.log('Image is not recognized as a receipt/expense slip. Skipping silent.')
            continue
          }

          const amount = Number(ocrResult.amount) || 0
          if (amount <= 0) {
            console.log('Parsed amount is 0 or invalid. Skipping.')
            continue
          }

          let vatAmount = 0
          if (ocrResult.vat_included) {
            vatAmount = parseFloat(((amount * 7) / 107).toFixed(2))
          }

          const rawDate = ocrResult.expense_date || thNow.toISOString().slice(0, 10)
          const title = ocrResult.title || 'ค่าใช้จ่ายร้าน'
          const category = ocrResult.category || 'raw_material'
          const vendorName = ocrResult.vendor_name || 'ไม่ระบุ'
          const vendorTaxId = (ocrResult.vendor_tax_id || '').replace(/\D/g, '') || null
          const docType = ocrResult.doc_type || 'tax_invoice'
          const paymentMethod = ocrResult.payment_method || 'TRANSFER'
          const notes = ocrResult.notes || ''

          // 6. Insert into store_expenses table
          const { data: inserted, error: insertErr } = await supabaseAdmin
            .from('store_expenses')
            .insert([{
              expense_date: rawDate,
              title: title,
              category: category,
              vendor_name: vendorName,
              vendor_tax_id: vendorTaxId,
              doc_type: docType,
              amount: amount,
              vat_included: ocrResult.vat_included ?? true,
              vat_amount: vatAmount,
              receipt_image_url: receiptImageUrl || null,
              payment_method: paymentMethod,
              notes: notes,
              created_at: new Date().toISOString()
            }])
            .select()
            .single()

          if (insertErr) {
            console.error('Error inserting into store_expenses:', insertErr)
            throw insertErr
          }

          console.log('Successfully inserted store_expense:', inserted?.id)

          // 7. Format Date for Display
          let dateFormatted = rawDate
          try {
            const d = new Date(rawDate)
            dateFormatted = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
          } catch {
            dateFormatted = rawDate
          }

          // 8. Build Flex Message Response
          const flexBubble = createReceiptFlexMessage(inserted || {
            expense_date: rawDate,
            title,
            category,
            vendor_name: vendorName,
            vendor_tax_id: vendorTaxId,
            doc_type: docType,
            amount,
            vat_included: ocrResult.vat_included ?? true,
            vat_amount: vatAmount,
            payment_method: paymentMethod,
            notes
          }, dateFormatted)

          // 9. Reply to LINE Group / User
          const replyResp = await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
              replyToken: replyToken,
              messages: [{
                type: 'flex',
                altText: `🧾 บันทึกค่าใช้จ่าย: ${vendorName} (฿${amount.toLocaleString('th-TH')})`,
                contents: flexBubble
              }]
            }),
          })

          if (!replyResp.ok) {
            const errTxt = await replyResp.text()
            console.error('Failed to send LINE reply for receipt:', errTxt)
            const targetId = event.source.groupId || event.source.roomId || event.source.userId
            if (targetId) {
              await fetch('https://api.line.me/v2/bot/message/push', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
                },
                body: JSON.stringify({
                  to: targetId,
                  messages: [{
                    type: 'flex',
                    altText: `🧾 บันทึกค่าใช้จ่าย: ${vendorName} (฿${amount.toLocaleString('th-TH')})`,
                    contents: flexBubble
                  }]
                })
              })
            }
          }
        } catch (imgErr: any) {
          console.error('Error in image receipt handler:', imgErr)
        }
      }
    }

    return new Response('OK', { headers: corsHeaders })
  } catch (err) {
    console.error('Global Webhook Error:', err)
    return new Response('Error', { status: 500 })
  }
})
