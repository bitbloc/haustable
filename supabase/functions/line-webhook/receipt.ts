// Receipt photo / file -> Gemini OCR -> store_expenses -> LINE reply.
//
// Why this file exists (2026-11-24): the handler used to live inline in index.ts.
// Production logs 17-24 Nov showed two faults:
//   1. slow: gemini-flash-latest took 20-35 s per receipt (default thinking).
//   2. silent misses: when every model answered 503 "high demand" / 429 quota,
//      the catch block read `latestItem` out of scope, threw ReferenceError, and
//      staff got no reply at all (21, 22, 23 and 24 Nov).
// Fixes here: low thinking, a short retry chain within a time budget, every
// failure path replies, PDF / image files are read too, and a repeat photo of a
// bill already recorded is merged instead of inserted twice.

import { BRAND } from './brand.ts'

type SupabaseClient = any

const LINE_REPLY = 'https://api.line.me/v2/bot/message/reply'
const LINE_PUSH = 'https://api.line.me/v2/bot/message/push'

// Gemini accepts these inline. HEIC/HEIF come from iPhones sent as files.
const FILE_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
}
const MAX_FILE_BYTES = 15 * 1024 * 1024
const OCR_BUDGET_MS = 90_000 // whole retry chain; the edge function wall clock is 150 s
const MERGE_WINDOW_MS = 15 * 60 * 1000

const DOC_TYPES = ['tax_invoice', 'cash_bill', 'receipt_voucher', 'slip_only']
const PAY_METHODS = ['TRANSFER', 'CASH', 'CREDIT']
const CATEGORIES = [
  'raw_material', 'marketing', 'fuel_logistics', 'utilities', 'rent',
  'staff_wages', 'equipment_supplies', 'maintenance', 'software_service', 'other',
]

export function isReceiptEvent(ev: any): boolean {
  if (ev?.type !== 'message') return false
  const m = ev.message
  if (m?.type === 'image') return true
  if (m?.type === 'file') return fileExt(m.fileName) in FILE_MIME
  return false
}

function fileExt(name: string = ''): string {
  const m = String(name).toLowerCase().match(/\.([a-z0-9]+)$/)
  return m ? m[1] : ''
}

function bangkokNow(): Date {
  return new Date(Date.now() + 7 * 60 * 60 * 1000)
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < bytes.byteLength; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.byteLength)) as any)
  }
  return btoa(binary)
}

function money(n: number): string {
  return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ---------------------------------------------------------------------------
// Exchange rate (USD invoices for Supabase, Vercel, ...)
// ---------------------------------------------------------------------------
async function fetchExchangeRate(fromCurrency: string = 'USD'): Promise<number> {
  const norm = (fromCurrency || 'USD').toUpperCase().trim()
  if (norm === 'THB') return 1
  for (const url of [
    `https://api.exchangerate-api.com/v4/latest/${norm}`,
    `https://open.er-api.com/v6/latest/${norm}`,
  ]) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(2500) })
      if (resp.ok) {
        const rate = Number((await resp.json())?.rates?.THB)
        if (rate > 0) return rate
      }
    } catch (err) {
      console.warn(`[ExchangeRate] ${url} failed:`, err)
    }
  }
  const fallback: Record<string, number> = { USD: 33.5, EUR: 36.5, SGD: 25.5, JPY: 0.22, GBP: 43.5, CNY: 4.7 }
  return fallback[norm] || 33.5
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------
function buildPrompt(pageCount: number, todayIso: string, shopTaxId: string): string {
  const multi = pageCount > 1
  return `
You are the expense bookkeeper for "IN THE HAUS", a restaurant in Nakhon Phanom, Thailand.
Staff sent ${pageCount} image(s)/document(s) through LINE. ${multi ? `They are ONE expense: pages of the same bill, or a bill plus its transfer slip.` : ''}
Today is ${todayIso} (Gregorian).

THE BUYER IS US: IN THE HAUS${shopTaxId ? `, tax ID ${shopTaxId}` : ''}, 788/1 ถนนสุนทรวิจิตร.
The buyer block (ชื่อลูกค้า / นาย... / ผู้ซื้อ) is never the vendor. ${shopTaxId ? `Never return ${shopTaxId} as vendor_tax_id.` : ''}
The vendor is the issuer printed at the top (บริษัท ... จำกัด, ร้าน ..., สาขา ...) and their tax ID is next to "เลขประจำตัวผู้เสียภาษี" near the issuer.

Photos may be sideways, upside down, crumpled, dot-matrix or handwritten. Read them in any orientation.
Any bill, slip, tax invoice, cash bill, voucher, utility or gas bill is a receipt (is_receipt true).
is_receipt is false only for photos with no bill in them (food, people, the shop, stickers, screenshots of chat).

Return ONLY this JSON:
{
  "is_receipt": true,
  "title": "short Thai summary, e.g. 'ค่าแก๊สหุงต้ม 15 กก.', 'ซื้อวัตถุดิบ Makro นครพนม', 'ค่าน้ำแข็งกระสอบ'",
  "currency": "THB",            // THB unless the document shows $, USD, EUR, SGD, JPY or GBP
  "original_amount": 0.00,      // grand total in the document currency
  "amount": 0.00,               // grand total payable: รวมเงิน, รวมทั้งสิ้น, ยอดสุทธิ, Total, Amount paid
  "vat_amount": 0.00,           // VAT printed on the document (ภาษีมูลค่าเพิ่ม), 0 if none is printed
  "expense_date": "YYYY-MM-DD", // document date in Gregorian; Buddhist year 2569 = 2026. If no date is printed use ${todayIso}
  "category": "raw_material",   // one of: ${CATEGORIES.join(', ')}
  "vendor_name": "issuer name as printed",
  "vendor_tax_id": "issuer 13-digit tax ID digits only, or empty",
  "doc_type": "tax_invoice",    // tax_invoice (ใบกำกับภาษี), cash_bill (บิลเงินสด), receipt_voucher (ใบสำคัญรับเงิน / statement), slip_only (bank transfer slip only)
  "vat_included": true,         // true if VAT is part of the total
  "payment_method": "TRANSFER", // TRANSFER by default; CASH only if the document marks cash (เงินสด ticked); CREDIT only for card
  "notes": "line items in Thai, e.g. 'แก๊สหุงต้ม 15 กก. 1 ถัง 465.00'",
  "confidence": 0.95
}

Categories:
- utilities: cooking gas / LPG (แก๊สหุงต้ม, ถังแก๊ส, ร้านแก๊ส), electricity, water, internet, phone
- fuel_logistics: vehicle fuel (ปั๊มน้ำมัน, ดีเซล, เบนซิน), delivery (Lalamove, Grab, Lineman, Flash, Kerry)
- raw_material: Makro, Lotus's, Big C, CJ, markets, ice, meat, vegetables, milk, eggs, sauces, coffee beans, syrups
- marketing: Facebook, TikTok, Google Ads, LINE Ads, signs
- rent, staff_wages, equipment_supplies (cups, lids, bags, boxes, tissue, detergent, kitchen tools),
  maintenance (repairs, HomePro, ไทวัสดุ, ดูโฮม), software_service (Supabase, Vercel, Canva, Spotify, AI tools)

Foreign currency: if the document shows $ / USD (Supabase, Vercel, GitHub, OpenAI, Google Workspace, AWS, Figma...),
set currency "USD", original_amount and amount to the USD total, category software_service, and put the USD breakdown in notes.

Google Ads / Facebook statements: amount is "การชำระเงินทั้งหมดที่ได้รับ" (payments received) or, if that is 0,
"กิจกรรมใหม่ทั้งหมด" (new activity). Never the beginning or ending balance. vendor "Google Ads", category marketing, doc_type receipt_voucher.

Several pages: combine line items in notes; take the single final payable total once, never add page subtotals to it.
`
}

type GeminiAttempt = { model: string; waitMs: number }

// Models that answered 400 to thinkingConfig in this isolate; we retry them without it.
const noThinkingModels = new Set<string>()

class OcrError extends Error {
  kind: 'busy' | 'quota' | 'key' | 'other'
  constructor(kind: OcrError['kind'], message: string) {
    super(message)
    this.kind = kind
  }
}

async function scanWithGemini(
  parts: { mime: string; base64: string }[],
  apiKey: string,
  preferredModel: string,
  todayIso: string,
  shopTaxId: string,
): Promise<{ result: any; model: string; ms: number }> {
  const started = Date.now()
  const prompt = buildPrompt(parts.length, todayIso, shopTaxId)
  const baseBody = {
    contents: [{
      role: 'user',
      parts: [
        { text: `Read these ${parts.length} document(s) as one expense and return the JSON.` },
        ...parts.map((p) => ({ inline_data: { mime_type: p.mime, data: p.base64 } })),
      ],
    }],
    system_instruction: { parts: [{ text: prompt }] },
  }

  // Flash first (accurate on crumpled Thai bills), lite when flash is overloaded,
  // then one more round after a short pause: 503 "high demand" usually clears in seconds.
  // Pro / experimental models are left out: this key has no quota for them (429 in every log).
  const flash = preferredModel || 'gemini-flash-latest'
  const lite = 'gemini-flash-lite-latest'
  const attempts: GeminiAttempt[] = [
    { model: flash, waitMs: 0 },
    { model: lite, waitMs: 0 },
    { model: flash, waitMs: 2500 },
    { model: lite, waitMs: 4000 },
  ]

  let lastKind: OcrError['kind'] = 'other'
  let lastMessage = ''

  for (const attempt of attempts) {
    if (attempt.waitMs) await new Promise((r) => setTimeout(r, attempt.waitMs))
    const remaining = OCR_BUDGET_MS - (Date.now() - started)
    if (remaining < 5000) break

    const useThinking = !noThinkingModels.has(attempt.model)
    const body = {
      ...baseBody,
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.1,
        // Default thinking made flash take 20-35 s per receipt. Reading a bill needs little reasoning.
        ...(useThinking ? { thinkingConfig: { thinkingLevel: 'low' } } : {}),
      },
    }

    const t0 = Date.now()
    let response: Response
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${attempt.model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(Math.min(35_000, remaining)),
        },
      )
    } catch (err: any) {
      console.warn(`[Gemini ${attempt.model}] network/timeout after ${Date.now() - t0} ms:`, err?.name || err)
      lastKind = 'busy'
      lastMessage = 'timeout'
      continue
    }

    if (!response.ok) {
      const errText = await response.text()
      console.warn(`[Gemini ${attempt.model}] ${response.status} after ${Date.now() - t0} ms:`, errText.slice(0, 300))
      if (response.status === 400 && useThinking && /thinking/i.test(errText)) {
        noThinkingModels.add(attempt.model)
        attempts.splice(attempts.indexOf(attempt) + 1, 0, { model: attempt.model, waitMs: 0 })
        continue
      }
      if (response.status === 401 || response.status === 403) {
        throw new OcrError('key', `Gemini key rejected (${response.status})`)
      }
      if (response.status === 402) throw new OcrError('quota', 'Gemini prepayment credits depleted')
      if (response.status === 429) {
        lastKind = /quota/i.test(errText) && !/per minute|rate/i.test(errText) ? 'quota' : 'busy'
      } else {
        lastKind = response.status >= 500 ? 'busy' : 'other'
      }
      lastMessage = `${response.status}`
      continue
    }

    const json = await response.json()
    const rawText = json?.candidates?.[0]?.content?.parts?.find((p: any) => typeof p.text === 'string' && !p.thought)?.text
    if (!rawText) {
      lastKind = 'other'
      lastMessage = 'empty response'
      continue
    }
    try {
      const result = JSON.parse(rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
      const model = json?.modelVersion || attempt.model
      console.log(`[Gemini] ${model} read ${parts.length} part(s) in ${Date.now() - t0} ms (total ${Date.now() - started} ms)`)
      return { result, model, ms: Date.now() - started }
    } catch {
      lastKind = 'other'
      lastMessage = 'invalid JSON'
    }
  }

  throw new OcrError(lastKind, lastMessage || 'no model answered')
}

// ---------------------------------------------------------------------------
// Flex (brand v2)
// ---------------------------------------------------------------------------
const CATEGORY_LABELS: Record<string, string> = {
  raw_material: 'วัตถุดิบ / ของสด',
  marketing: 'การตลาด / โฆษณา',
  fuel_logistics: 'น้ำมันรถ / ค่าส่ง',
  utilities: 'น้ำ ไฟ แก๊ส เน็ต',
  rent: 'ค่าเช่า',
  staff_wages: 'ค่าแรง / เงินเดือน',
  equipment_supplies: 'ของใช้ / บรรจุภัณฑ์',
  maintenance: 'ซ่อมบำรุง',
  software_service: 'ซอฟต์แวร์ / บริการ',
  other: 'อื่นๆ',
}
const DOC_TYPE_LABELS: Record<string, string> = {
  tax_invoice: 'ใบกำกับภาษี',
  cash_bill: 'บิลเงินสด',
  receipt_voucher: 'ใบสำคัญรับเงิน',
  slip_only: 'สลิปโอนเงิน',
}
const PAY_LABELS: Record<string, string> = {
  TRANSFER: 'โอนเงิน',
  CASH: 'เงินสด',
  CREDIT: 'บัตรเครดิต',
}

function row(label: string, value: string, opts: { first?: boolean } = {}) {
  return {
    type: 'box',
    layout: 'horizontal',
    margin: opts.first ? 'lg' : 'md',
    contents: [
      { type: 'text', text: label, color: BRAND.neutral, size: 'sm', flex: 2 },
      { type: 'text', text: value, color: BRAND.charcoal, size: 'sm', align: 'end', flex: 3, wrap: true },
    ],
  }
}

export function createReceiptFlexMessage(
  expense: any,
  dateFormatted: string,
  pageCount: number = 1,
  conversionInfo: any = null,
  merged = false,
) {
  const rows: any[] = [
    row('หมวด', CATEGORY_LABELS[expense.category] || expense.category || '-', { first: true }),
    row('วันที่บิล', dateFormatted),
    row('เอกสาร', DOC_TYPE_LABELS[expense.doc_type] || expense.doc_type || '-'),
  ]
  if (expense.payment_method) rows.push(row('ชำระโดย', PAY_LABELS[expense.payment_method] || expense.payment_method))
  if (Number(expense.vat_amount) > 0) rows.push(row('VAT ในบิล', `฿${money(expense.vat_amount)}`))
  if (expense.vendor_tax_id) rows.push(row('เลขผู้เสียภาษี', String(expense.vendor_tax_id)))
  if (pageCount > 1) rows.push(row('จำนวนรูป', `${pageCount} รูป รวมเป็น 1 บิล`))
  if (conversionInfo?.currency && conversionInfo.currency !== 'THB') {
    rows.push(row('ยอดเดิม', `${conversionInfo.symbol || ''}${Number(conversionInfo.originalAmount || 0).toFixed(2)} ${conversionInfo.currency}`))
    rows.push(row('อัตราแลก', `${Number(conversionInfo.rate || 0).toFixed(2)} บาท / ${conversionInfo.currency}`))
  }

  const body: any[] = [
    { type: 'text', text: expense.vendor_name || 'ไม่ระบุร้านค้า', color: BRAND.charcoal, size: 'lg', weight: 'bold', wrap: true },
    { type: 'text', text: expense.title || 'ค่าใช้จ่ายร้าน', color: BRAND.muted, size: 'sm', wrap: true, margin: 'sm' },
    { type: 'separator', margin: 'lg', color: BRAND.rule },
    {
      type: 'box',
      layout: 'horizontal',
      margin: 'lg',
      contents: [
        { type: 'text', text: 'ยอดสุทธิ', color: BRAND.neutral, size: 'sm', gravity: 'center', flex: 2 },
        { type: 'text', text: `฿${money(expense.amount)}`, color: BRAND.charcoal, size: '24px', weight: 'bold', align: 'end', gravity: 'center', flex: 3 },
      ],
    },
    { type: 'separator', margin: 'lg', color: BRAND.rule },
    ...rows,
  ]

  if (expense.notes) {
    body.push({
      type: 'box',
      layout: 'vertical',
      margin: 'lg',
      paddingAll: '12px',
      backgroundColor: BRAND.paper2,
      contents: [
        { type: 'text', text: 'รายการในบิล', color: BRAND.neutral, size: 'xs' },
        { type: 'text', text: String(expense.notes), color: BRAND.charcoal, size: 'sm', wrap: true, margin: 'sm' },
      ],
    })
  }

  body.push({
    type: 'text',
    text: 'แก้ไขหรือดูรูปต้นฉบับ: หลังบ้าน > บัญชีและภาษี',
    color: BRAND.neutral,
    size: 'xs',
    wrap: true,
    margin: 'lg',
  })

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: BRAND.plum,
      paddingAll: '20px',
      contents: [
        { type: 'text', text: merged ? 'รวมรูปเข้าบิลเดิมแล้ว' : 'บันทึกค่าใช้จ่ายแล้ว', color: BRAND.cream, size: 'md', weight: 'bold' },
        { type: 'text', text: merged ? 'SAME BILL · NOT RECORDED TWICE' : 'EXPENSE RECORDED · AI', color: BRAND.onPlum2, size: 'xxs', margin: 'sm' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: BRAND.cream,
      paddingAll: '20px',
      contents: body,
    },
    styles: { header: { separator: false }, body: { separator: false } },
  }
}

// ---------------------------------------------------------------------------
// LINE send (reply first, push when the token has expired or was used)
// ---------------------------------------------------------------------------
async function sendToLine(token: string, replyToken: string | undefined, source: any, messages: any[]) {
  if (replyToken) {
    const resp = await fetch(LINE_REPLY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ replyToken, messages }),
    })
    if (resp.ok) return
    console.warn('[Receipt] reply failed, falling back to push:', (await resp.text()).slice(0, 200))
  }
  const to = source?.groupId || source?.roomId || source?.userId
  if (!to) return
  const resp = await fetch(LINE_PUSH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, messages }),
  })
  if (!resp.ok) console.error('[Receipt] push failed:', (await resp.text()).slice(0, 200))
}

function failureText(kind: OcrError['kind'] | 'download' | 'save' | 'unreadable' | 'too_big'): string {
  switch (kind) {
    case 'busy':
      return 'อ่านบิลไม่สำเร็จ ระบบ AI ของ Google คนใช้เยอะอยู่ (ลองแล้ว 4 ครั้ง)\nส่งรูปเดิมอีกครั้งในอีก 2-3 นาที'
    case 'quota':
      return 'อ่านบิลไม่สำเร็จ โควต้า Gemini API หมด\nเจ้าของร้านต้องเช็กเครดิตใน Google AI Studio'
    case 'key':
      return 'อ่านบิลไม่สำเร็จ คีย์ Gemini API ใช้ไม่ได้\nเจ้าของร้านต้องตั้งคีย์ใหม่ในหลังบ้าน'
    case 'download':
      return 'อ่านบิลไม่สำเร็จ ดึงรูปจาก LINE ไม่ได้\nส่งรูปใหม่อีกครั้ง'
    case 'save':
      return 'อ่านบิลได้แต่บันทึกไม่สำเร็จ\nส่งรูปใหม่อีกครั้ง หรือกรอกเองในหลังบ้าน'
    case 'unreadable':
      return 'เห็นว่าเป็นบิล แต่อ่านยอดรวมไม่ออก\nถ่ายใหม่ให้เห็นยอดรวมชัดๆ แล้วส่งอีกครั้ง'
    case 'too_big':
      return 'ไฟล์ใหญ่เกิน 15 MB อ่านไม่ได้\nส่งเป็นรูปถ่ายแทน'
    default:
      return 'อ่านบิลไม่สำเร็จ ระบบ AI ตอบกลับผิดรูปแบบ\nส่งรูปเดิมอีกครั้ง'
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
type Downloaded = {
  messageId: string
  mime: string
  base64: string
  imageUrl: string
}

async function downloadAndStore(ev: any, idx: number, token: string, supabaseAdmin: SupabaseClient): Promise<Downloaded | 'too_big' | null> {
  const messageId = ev.message.id
  const resp = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  })
  if (!resp.ok) {
    console.error(`[Receipt] LINE content ${messageId} failed: ${resp.status}`, (await resp.text()).slice(0, 200))
    return null
  }
  const bytes = new Uint8Array(await resp.arrayBuffer())
  if (bytes.byteLength > MAX_FILE_BYTES) return 'too_big'

  const isFile = ev.message.type === 'file'
  const ext = isFile ? fileExt(ev.message.fileName) : 'jpg'
  const headerMime = (resp.headers.get('content-type') || '').split(';')[0].trim()
  const mime = isFile ? (FILE_MIME[ext] || headerMime) : (headerMime.startsWith('image/') ? headerMime : 'image/jpeg')

  // messageId is part of the path so a redelivered event can be recognised later.
  const path = `${bangkokNow().toISOString().slice(0, 7)}/${Date.now()}_${idx}_${messageId}.${ext === 'jpeg' ? 'jpg' : ext}`
  let imageUrl = ''
  try {
    const { error } = await supabaseAdmin.storage.from('receipts').upload(path, bytes, { contentType: mime, upsert: true })
    if (error) console.error('[Receipt] storage upload error:', error)
    else imageUrl = supabaseAdmin.storage.from('receipts').getPublicUrl(path)?.data?.publicUrl || ''
  } catch (err) {
    console.error('[Receipt] storage upload exception:', err)
  }

  return { messageId, mime, base64: toBase64(bytes), imageUrl }
}

async function alreadyRecorded(supabaseAdmin: SupabaseClient, messageIds: string[]): Promise<boolean> {
  for (const id of messageIds) {
    const { data } = await supabaseAdmin
      .from('store_expenses')
      .select('id')
      .ilike('receipt_image_url', `%_${id}.%`)
      .limit(1)
    if (data?.length) return true
  }
  return false
}

export async function handleReceiptEvents(
  events: any[],
  token: string,
  supabaseAdmin: SupabaseClient,
): Promise<void> {
  const receiptEvents = events.filter(isReceiptEvent)
  if (receiptEvents.length === 0) return

  // One webhook call can carry several photos from the same chat: treat them as one bill.
  const bySource = new Map<string, any[]>()
  for (const ev of receiptEvents) {
    const key = ev.source?.groupId || ev.source?.roomId || ev.source?.userId || 'default'
    if (!bySource.has(key)) bySource.set(key, [])
    bySource.get(key)!.push(ev)
  }

  // Settings once per call.
  const { data: settingRows } = await supabaseAdmin
    .from('app_settings')
    .select('key, value')
    .in('key', ['gemini_api_key', 'gemini_model', 'receipt_shop_vat'])
  const settings: Record<string, string> = Object.fromEntries((settingRows || []).map((r: any) => [r.key, r.value]))
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || settings.gemini_api_key || ''
  const preferredModel = settings.gemini_model || 'gemini-flash-latest'
  const shopTaxId = String(settings.receipt_shop_vat || '').replace(/\D/g, '')

  for (const [sourceKey, evList] of bySource) {
    const last = evList[evList.length - 1]
    const replyToken: string | undefined = last.replyToken
    const source = last.source
    const inImageSet = evList.some((e) => e.message?.imageSet?.total > 1)
    const t0 = Date.now()
    console.log(`[Receipt] ${sourceKey}: ${evList.length} part(s)${last.deliveryContext?.isRedelivery ? ' (redelivery)' : ''}`)

    try {
      if (await alreadyRecorded(supabaseAdmin, evList.map((e) => e.message.id))) {
        console.log('[Receipt] already recorded (LINE redelivery), skipping')
        continue
      }
      if (!geminiApiKey) {
        await sendToLine(token, replyToken, source, [{ type: 'text', text: failureText('key') }])
        continue
      }

      const downloaded = await Promise.all(evList.map((ev, i) => downloadAndStore(ev, i, token, supabaseAdmin)))
      if (downloaded.includes('too_big')) {
        await sendToLine(token, replyToken, source, [{ type: 'text', text: failureText('too_big') }])
        continue
      }
      const parts = downloaded.filter(Boolean) as Downloaded[]
      if (parts.length === 0) {
        await sendToLine(token, replyToken, source, [{ type: 'text', text: failureText('download') }])
        continue
      }
      const pageCount = parts.length
      const receiptImageUrl = parts.map((p) => p.imageUrl).filter(Boolean).join(',') || null

      const todayIso = bangkokNow().toISOString().slice(0, 10)
      let ocr: any
      try {
        const scanned = await scanWithGemini(parts, geminiApiKey, preferredModel, todayIso, shopTaxId)
        ocr = scanned.result
      } catch (err: any) {
        const kind = err instanceof OcrError ? err.kind : 'other'
        console.error(`[Receipt] OCR failed (${kind}) after ${Date.now() - t0} ms:`, err?.message)
        await sendToLine(token, replyToken, source, [{ type: 'text', text: failureText(kind) }])
        continue
      }
      console.log('[Receipt] OCR:', JSON.stringify(ocr).slice(0, 600))

      const rawAmount = Number(ocr?.amount) || 0
      if (!ocr || ocr.is_receipt === false) {
        console.log('[Receipt] not a bill, no reply') // photos of food / the shop in the group are normal
        continue
      }
      if (rawAmount <= 0) {
        // Page 1 of a multi-photo set often has no total; the later page carries it.
        if (!inImageSet) await sendToLine(token, replyToken, source, [{ type: 'text', text: failureText('unreadable') }])
        continue
      }

      // Currency
      let currency = String(ocr.currency || 'THB').toUpperCase().trim()
      const textBlob = `${ocr.title || ''} ${ocr.notes || ''} ${ocr.vendor_name || ''}`
      if (currency === 'THB' && textBlob.includes('$')) currency = 'USD'
      const originalAmount = Number(ocr.original_amount) || rawAmount
      let amount = rawAmount
      let conversionInfo: any = null
      if (currency !== 'THB') {
        const rate = await fetchExchangeRate(currency)
        amount = Number((originalAmount * rate).toFixed(2))
        conversionInfo = { currency, symbol: { USD: '$', EUR: '€', GBP: '£' }[currency] || '', originalAmount, rate }
      }

      const vatIncluded = ocr.vat_included ?? true
      const printedVat = Number(ocr.vat_amount) || 0
      const vatAmount = printedVat > 0 && currency === 'THB'
        ? Number(printedVat.toFixed(2))
        : (vatIncluded ? Number(((amount * 7) / 107).toFixed(2)) : 0)

      const expenseDate = /^\d{4}-\d{2}-\d{2}$/.test(ocr.expense_date || '') ? ocr.expense_date : todayIso
      let title = ocr.title || 'ค่าใช้จ่ายร้าน'
      if (pageCount > 1 && !/ชุด|แผ่น|รูป/.test(title)) title = `${title} (${pageCount} รูป)`
      const category = CATEGORIES.includes(ocr.category) ? ocr.category : (currency !== 'THB' ? 'software_service' : 'other')
      const vendorName = ocr.vendor_name || 'ไม่ระบุ'
      let vendorTaxId: string | null = String(ocr.vendor_tax_id || '').replace(/\D/g, '') || null
      if (vendorTaxId && shopTaxId && vendorTaxId === shopTaxId) vendorTaxId = null // that is us, the buyer
      const docType = DOC_TYPES.includes(ocr.doc_type) ? ocr.doc_type : 'cash_bill'
      const paymentMethod = PAY_METHODS.includes(String(ocr.payment_method).toUpperCase())
        ? String(ocr.payment_method).toUpperCase()
        : 'TRANSFER'
      let notes = ocr.notes || ''
      if (conversionInfo) {
        const note = `แปลงจาก ${conversionInfo.symbol}${originalAmount.toFixed(2)} ${currency} @ ${conversionInfo.rate.toFixed(2)} บาท/${currency}`
        if (!notes.includes(note)) notes = notes ? `${notes} · ${note}` : note
      }

      // Same bill photographed twice (or the 2nd page sent as its own message):
      // same total and date within 15 minutes -> add the photo to that record.
      const since = new Date(Date.now() - MERGE_WINDOW_MS).toISOString()
      const { data: recent } = await supabaseAdmin
        .from('store_expenses')
        .select('*')
        .eq('amount', amount)
        .eq('expense_date', expenseDate)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5)
      // Two different shops can share a total; a different vendor tax ID means a different bill.
      const existing = (recent || []).find((r: any) => !(r.vendor_tax_id && vendorTaxId && r.vendor_tax_id !== vendorTaxId))

      let saved: any
      let merged = false
      if (existing) {
        const urls = [existing.receipt_image_url, receiptImageUrl].filter(Boolean).join(',') || null
        const { data, error } = await supabaseAdmin
          .from('store_expenses')
          .update({ receipt_image_url: urls })
          .eq('id', existing.id)
          .select()
          .single()
        if (error) throw error
        saved = data
        merged = true
        console.log(`[Receipt] merged into existing expense ${existing.id}`)
      } else {
        const { data, error } = await supabaseAdmin
          .from('store_expenses')
          .insert([{
            expense_date: expenseDate,
            title,
            category,
            vendor_name: vendorName,
            vendor_tax_id: vendorTaxId,
            doc_type: docType,
            amount,
            vat_included: vatIncluded,
            vat_amount: vatAmount,
            receipt_image_url: receiptImageUrl,
            payment_method: paymentMethod,
            notes,
          }])
          .select()
          .single()
        if (error) {
          console.error('[Receipt] insert failed:', error)
          await sendToLine(token, replyToken, source, [{ type: 'text', text: failureText('save') }])
          continue
        }
        saved = data
        console.log(`[Receipt] inserted ${saved?.id} in ${Date.now() - t0} ms`)
      }

      let dateFormatted = saved.expense_date
      try {
        dateFormatted = new Date(saved.expense_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
      } catch { /* keep ISO */ }

      const flex = createReceiptFlexMessage(saved, dateFormatted, merged ? 1 : pageCount, merged ? null : conversionInfo, merged)
      await sendToLine(token, replyToken, source, [{
        type: 'flex',
        altText: `${merged ? 'รวมรูปเข้าบิลเดิม' : 'บันทึกค่าใช้จ่าย'}: ${saved.vendor_name} ฿${money(saved.amount)}`,
        contents: flex,
      }])
    } catch (err: any) {
      console.error('[Receipt] unexpected error:', err)
      try {
        await sendToLine(token, replyToken, source, [{ type: 'text', text: failureText('save') }])
      } catch (lineErr) {
        console.error('[Receipt] could not tell LINE about the error:', lineErr)
      }
    }
  }
}
