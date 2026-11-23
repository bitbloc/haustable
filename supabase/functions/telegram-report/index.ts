// telegram-report — ส่งรายงานร้านเข้า Telegram
// Called by Postgres triggers / pg_cron (x-hook-secret) and by the admin UI (user JWT, admin/owner only).
//
// Required secrets:
//   supabase secrets set TELEGRAM_BOT_TOKEN=123456:ABC... TELEGRAM_HOOK_SECRET=<random string>
// The same TELEGRAM_HOOK_SECRET must be stored in Vault as 'telegram_hook_secret' (see migration).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { buildStockClosingCardPayload, buildStockClosingMessage } from './stockClosing.ts'
import { formatAlignedItemsPre } from './textFormat.ts'
import {
  renderDailySummaryCardSvg,
  renderOnlineOrderCardSvg,
  renderShiftCloseCardSvg,
  renderStockClosingCardSvg,
  renderTestCardSvg,
} from './cardSvg.ts'
import { renderSvgToPng } from './cardRenderer.ts'

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || ''
const HOOK_SECRET = Deno.env.get('TELEGRAM_HOOK_SECRET') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_ORIGIN = (Deno.env.get('APP_ORIGIN') || 'https://haustable.vercel.app').replace(/\/+$/, '')

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hook-secret',
}

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000
const VOID_STATUSES = ['void', 'voided', 'cancelled', 'canceled']
const CLOSED_BOOKING_STATUSES = ['completed', 'void', 'cancelled', 'no_show']

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ---------- formatting helpers ----------

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const baht = (n: unknown) =>
  '฿' + Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

const toBkk = (d: Date) => new Date(d.getTime() + BKK_OFFSET_MS)
const pad = (n: number) => String(n).padStart(2, '0')

const fmtTime = (iso?: string | null) => {
  if (!iso) return '-'
  const d = toBkk(new Date(iso))
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return '-'
  const d = toBkk(new Date(iso))
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

const fmtDate = (d: Date) => {
  const b = toBkk(d)
  return `${pad(b.getUTCDate())}/${pad(b.getUTCMonth() + 1)}`
}

const TH_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

// "ศ. 7 พ.ย. 19:00" — readable at a glance for reservations
const fmtThaiDateTime = (iso?: string | null) => {
  if (!iso) return '-'
  const d = toBkk(new Date(iso))
  return `${TH_DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${TH_MONTHS[d.getUTCMonth()]} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

// Layout primitives: one bold headline (shows in the lock-screen preview), dot-joined meta, quoted lists.
const dot = (...parts: unknown[]) => parts.filter((p) => p !== '' && p !== null && p !== undefined && p !== false).join(' · ')
const quote = (body: string, expandable = false) =>
  body ? `<blockquote${expandable ? ' expandable' : ''}>${body}</blockquote>` : ''
const block = (...lines: (string | false | null | undefined)[]) => lines.filter((l) => l !== false && l !== null && l !== undefined).join('\n')

const fmtDuration = (fromIso?: string | null, to = new Date()) => {
  if (!fromIso) return '-'
  const mins = Math.max(0, Math.round((to.getTime() - new Date(fromIso).getTime()) / 60000))
  const h = Math.floor(mins / 60)
  return h > 0 ? `${h} ชม. ${mins % 60} นาที` : `${mins} นาที`
}

const optionLabel = (opts: unknown): string => {
  if (!Array.isArray(opts) || opts.length === 0) return ''
  const names = opts
    .map((o: any) => (typeof o === 'string' ? o : o?.name || o?.label || o?.value || ''))
    .filter((s: string) => s && !/^(kitchen|bar)$/i.test(s))
  return names.join(', ')
}

const resolvePaymentMethod = (b: any): string => {
  if (b.payment_method) return String(b.payment_method).toUpperCase()
  const m = String(b.staff_remark || '').match(/Paid by ([A-Z_]+)/i)
  return m ? m[1].toUpperCase() : 'ไม่ระบุ'
}

const PAYMENT_LABEL: Record<string, string> = {
  CASH: 'เงินสด',
  QR: 'QR / PromptPay',
  PROMPTPAY: 'QR / PromptPay',
  TRANSFER: 'โอน',
  CARD: 'บัตร',
  CREDIT: 'บัตร',
  TRUEWALLET: 'TrueMoney',
  SPLIT: 'แยกจ่าย',
}
const paymentLabel = (m: string) => PAYMENT_LABEL[m] || m

// Amount per payment method for one bill. Split bills carry their partial rounds in
// [SPLIT_ROUNDS: [...]] (or the [SPLIT: CASH=x, QR=y, CREDIT=z] summary); the rest of the
// total was paid at the final checkout, under the "Paid by ..." method.
const paymentSplit = (b: any): Record<string, number> => {
  const remark = String(b.staff_remark || '')
  const total = Number(b.total_amount || 0)
  const out: Record<string, number> = {}
  const add = (m: string, amt: number) => { if (amt > 0) out[m] = (out[m] || 0) + amt }
  const key = (m: unknown) => {
    const s = String(m || 'qr').toLowerCase()
    return s === 'cash' ? 'CASH' : s === 'credit' || s === 'card' ? 'CREDIT' : 'QR'
  }

  const rounds = remark.match(/\[SPLIT_ROUNDS:\s*(\[.*?\])\s*\]?/is)
  let parsed = false
  if (rounds) {
    try {
      for (const r of JSON.parse(rounds[1])) add(key(r.method), Number(r.amount) || 0)
      parsed = true
    } catch (_) { /* fall back to the summary tag */ }
  }
  const summary = !parsed && remark.match(/\[SPLIT:\s*([^\]]+)\]/i)
  if (summary) {
    const num = (re: RegExp) => Number((summary[1].match(re) || [])[1] || 0)
    add('CASH', num(/cash[:=\s]+(\d+(?:\.\d+)?)/i))
    add('QR', num(/qr[:=\s]+(\d+(?:\.\d+)?)/i))
    add('CREDIT', num(/credit[:=\s]+(\d+(?:\.\d+)?)/i))
  }

  const settled = Object.values(out).reduce((a, v) => a + v, 0)
  add(resolvePaymentMethod(b), Math.round((total - settled) * 100) / 100)
  return out
}

const CHANNEL_LABEL: Record<string, string> = {
  walk_in: 'หน้าร้าน (Walk-in)',
  dine_in: 'จองโต๊ะ',
  pickup: 'รับที่ร้าน / กลับบ้าน',
  hausmade: 'HAUSMADE',
  steak: 'Steak',
}

const isOnlineBooking = (b: any) =>
  b.source === 'online' || b.booking_type === 'hausmade' || String(b.order_type || '').startsWith('hausmade')

const isQrBooking = (b: any) => /\[QR/i.test(String(b.staff_remark || ''))

const customerName = (b: any) => b.customer_name || b.pickup_contact_name || ''
const customerPhone = (b: any) => b.customer_phone || b.pickup_contact_phone || ''

// ---------- settings ----------

type Settings = Record<string, string>

async function loadSettings(): Promise<Settings> {
  const { data } = await supabase.from('app_settings').select('key, value').like('key', 'telegram_%')
  const map: Settings = {}
  for (const row of data || []) map[row.key] = row.value
  return map
}

const flag = (s: Settings, key: string, def = true) => (s[key] === undefined ? def : s[key] === 'true')

async function saveSetting(key: string, value: string) {
  await supabase.from('app_settings').upsert({ key, value })
}

// ---------- telegram ----------

type TgButton = { text: string; url: string }
type SendOpts = { silent?: boolean; buttons?: TgButton[][] }

const btn = (text: string, path: string): TgButton => ({ text, url: `${APP_ORIGIN}${path}` })

async function sendTelegram(chatId: string, html: string, opts: boolean | SendOpts = false) {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not set')
  if (!chatId) throw new Error('telegram_chat_id is not set')
  const { silent = false, buttons } = typeof opts === 'boolean' ? { silent: opts } : opts
  // Telegram hard limit is 4096 chars per message
  const chunks: string[] = []
  let rest = html
  while (rest.length > 3900) {
    const cut = rest.lastIndexOf('\n', 3900)
    chunks.push(rest.slice(0, cut > 0 ? cut : 3900))
    rest = rest.slice(cut > 0 ? cut + 1 : 3900)
  }
  chunks.push(rest)
  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text: chunks[i],
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      disable_notification: silent,
    }
    if (isLast && buttons && buttons.length) {
      payload.reply_markup = { inline_keyboard: buttons }
    }
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const out = await res.json()
    if (!out.ok) throw new Error(`Telegram: ${out.description || res.status}`)
  }
}

/**
 * Render a Brand v2 SVG card to PNG and deliver via Telegram sendPhoto (with lock-screen caption + inline buttons).
 * Always falls back gracefully to the full HTML text message if image rendering or upload fails.
 */
async function sendTelegramCard(
  chatId: string,
  svg: string,
  captionHtml: string,
  fallbackHtml: string,
  opts: SendOpts = {},
) {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not set')
  if (!chatId) throw new Error('telegram_chat_id is not set')
  try {
    const png = await renderSvgToPng(svg)
    const form = new FormData()
    form.append('chat_id', chatId)
    form.append('photo', new Blob([png], { type: 'image/png' }), 'card.png')
    if (captionHtml) {
      form.append('caption', captionHtml.slice(0, 980))
      form.append('parse_mode', 'HTML')
    }
    if (opts.silent) form.append('disable_notification', 'true')
    if (opts.buttons && opts.buttons.length) {
      form.append('reply_markup', JSON.stringify({ inline_keyboard: opts.buttons }))
    }
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: form,
    })
    const out = await res.json()
    if (!out.ok) throw new Error(`Telegram photo: ${out.description || res.status}`)
  } catch (err) {
    console.error('[telegram-report] card photo fallback to HTML:', err)
    await sendTelegram(chatId, fallbackHtml, opts)
  }
}

// ---------- data loaders ----------

async function loadBooking(id: string | number) {
  const { data } = await supabase.from('bookings').select('*').eq('id', id).maybeSingle()
  return data
}

async function loadTableName(tableId: unknown) {
  if (!tableId) return ''
  const { data } = await supabase.from('tables_layout').select('table_name').eq('id', tableId).maybeSingle()
  return data?.table_name || ''
}

async function loadItems(bookingId: string | number, itemIds?: unknown[]) {
  let q = supabase
    .from('order_items')
    .select('id, quantity, price_at_time, selected_options, custom_name, status, destination, created_at, menu_items(name)')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })
  if (itemIds && itemIds.length) q = q.in('id', itemIds as any[])
  const { data } = await q
  return data || []
}

const itemName = (it: any) => it.custom_name || it.menu_items?.name || 'รายการ'

const isVoid = (it: any) => VOID_STATUSES.includes(String(it.status || '').toLowerCase())
const lineTotal = (it: any) => Number(it.quantity || 1) * Number(it.price_at_time || 0)

// Aligned monospace receipt block for live floor events (items_added, bill_paid)
function itemLinesAligned(items: any[], withPrice = true) {
  return formatAlignedItemsPre(
    items.map((it) => ({
      qty: Number(it.quantity || 1),
      name: itemName(it),
      options: optionLabel(it.selected_options) || undefined,
      priceText: withPrice ? baht(lineTotal(it)) : undefined,
      voided: isVoid(it),
    })),
    withPrice,
  )
}

// Plain fallback item lines (non-pre) for HTML fallback blocks
function itemLines(items: any[], withPrice = true) {
  return items
    .map((it) => {
      const opts = optionLabel(it.selected_options)
      const head = `${Number(it.quantity || 1)}× ${esc(itemName(it))}`
      if (isVoid(it)) return `<s>${head}</s>  ยกเลิก`
      const price = withPrice ? `  <code>${baht(lineTotal(it))}</code>` : ''
      return `${head}${price}${opts ? `\n<i>   ${esc(opts)}</i>` : ''}`
    })
    .join('\n')
}

// "A3" for tables, a channel name otherwise
function placeShortPlain(b: any, tableName: string) {
  if (tableName) return tableName.replace(/^โต๊ะ\s*/, '')
  if (b.booking_type === 'pickup') return 'กลับบ้าน'
  if (b.booking_type === 'hausmade') return 'HAUSMADE'
  return CHANNEL_LABEL[b.booking_type] || 'ไม่ระบุโต๊ะ'
}
const placeShort = (b: any, tableName: string) => esc(placeShortPlain(b, tableName))
const placeLabel = (b: any, tableName: string) => (tableName ? `โต๊ะ ${placeShort(b, tableName)}` : placeShort(b, tableName))
const placeLabelPlain = (b: any, tableName: string) => (tableName ? `โต๊ะ ${placeShortPlain(b, tableName)}` : placeShortPlain(b, tableName))

const guestLinePlain = (b: any) => {
  const name = customerName(b)
  const real = name && !/^walk-in/i.test(name) && name !== 'MAINTENANCE'
  return dot(real ? name : '', customerPhone(b) || '')
}

const guestLine = (b: any) => {
  const name = customerName(b)
  const real = name && !/^walk-in/i.test(name) && name !== 'MAINTENANCE'
  return dot(real ? esc(name) : '', customerPhone(b) ? esc(customerPhone(b)) : '')
}

// ---------- event handlers ----------
// Hybrid layout:
//   Live floor events (table_opened, items_added, bill_paid) -> crisp HTML + aligned <pre> table + inline button
//   Milestone reports & online orders -> Brand v2 PNG card (sendPhoto) + lock-screen caption + inline button + HTML fallback

// เปิดโต๊ะ A3 · 4 ท่าน
async function onTableOpened(s: Settings, p: any) {
  if (!flag(s, 'telegram_notify_table_open')) return 'skipped'
  const b = await loadBooking(p.booking_id)
  if (!b || b.pickup_contact_name === 'MAINTENANCE') return 'skipped'
  const tableName = await loadTableName(b.table_id)
  const source = isOnlineBooking(b) ? 'ลูกค้าจองมาถึง' : isQrBooking(b) ? 'สแกน QR' : 'Walk-in'
  const text = block(
    `<b>เปิดโต๊ะ ${placeShort(b, tableName)} · ${b.pax || '-'} ท่าน</b>`,
    dot(fmtTime(b.booking_time || b.created_at), source),
    guestLine(b) || null,
    b.customer_note ? quote(`<i>${esc(b.customer_note)}</i>`) : null,
  )
  await sendTelegram(s.telegram_chat_id, text, { silent: true })
  return 'sent'
}

// โต๊ะ A3 สั่งเพิ่ม · ฿305
async function onItemsAdded(s: Settings, p: any) {
  if (!flag(s, 'telegram_notify_items')) return 'skipped'
  const b = await loadBooking(p.booking_id)
  if (!b) return 'skipped'
  // Online orders are reported as a whole by onOnlineOrder; paid-at-once bills by onBillPaid.
  const ageMs = Date.now() - new Date(b.created_at || b.booking_time).getTime()
  if (isOnlineBooking(b) && ageMs < 60_000) return 'skipped'
  if (b.status === 'completed' && ageMs < 60_000) return 'skipped'

  const items = await loadItems(b.id, p.item_ids)
  if (!items.length) return 'skipped'
  const tableName = await loadTableName(b.table_id)
  const sum = items.filter((it: any) => !isVoid(it)).reduce((a: number, it: any) => a + lineTotal(it), 0)

  const text = block(
    `<b>${placeLabel(b, tableName)} สั่งเพิ่ม · ${baht(sum)}</b>`,
    `<pre>${itemLinesAligned(items)}</pre>`,
    dot(fmtTime(items[0].created_at), isQrBooking(b) ? 'ลูกค้าสั่งผ่าน QR' : 'พนักงาน'),
  )
  // Silent: the most frequent event — visible in the chat without buzzing the phone.
  await sendTelegram(s.telegram_chat_id, text, { silent: true })
  return 'sent'
}

// เช็คบิล A3 · ฿1,250
async function onBillPaid(s: Settings, p: any) {
  if (!flag(s, 'telegram_notify_bill')) return 'skipped'
  let b = await loadBooking(p.booking_id)
  if (!b) return 'skipped'
  // Offline-synced bills insert the booking before its items; give the items a moment to land.
  if (Date.now() - new Date(b.created_at || b.booking_time).getTime() < 30_000) {
    await sleep(4000)
    b = (await loadBooking(p.booking_id)) || b
  }
  const [items, tableName] = await Promise.all([loadItems(b.id), loadTableName(b.table_id)])
  const active = items.filter((it: any) => !isVoid(it))
  const subtotal = active.reduce((a: number, it: any) => a + lineTotal(it), 0)
  const count = active.reduce((a: number, it: any) => a + Number(it.quantity || 1), 0)
  const discount = Number(b.discount_amount || 0) + Number(b.xhaus_discount || 0)
  const opened = b.booking_time || b.created_at

  const itemsBody = items.length ? `<pre>${itemLinesAligned(items)}</pre>` : '<i>ไม่มีรายการ</i>'
  const text = block(
    `<b>เช็คบิล ${placeShort(b, tableName)} · ${baht(b.total_amount)}</b>`,
    dot(esc(paymentLabel(resolvePaymentMethod(b))), `${b.pax || '-'} ท่าน`, `${fmtTime(opened)}–${fmtTime(new Date().toISOString())}`, fmtDuration(opened)),
    guestLine(b) || null,
    items.length > 6 ? quote(itemsBody, true) : itemsBody,
    dot(`${count} รายการ ${baht(subtotal)}`, discount > 0 ? `ส่วนลด −${baht(discount)}` : '', Number(b.xhaus_earned || 0) > 0 ? `+${b.xhaus_earned} xhaus` : ''),
  )
  await sendTelegram(s.telegram_chat_id, text, {
    buttons: [[btn('ดูรายงานการเงิน', '/admin/financial')]],
  })
  return 'sent'
}

// จองโต๊ะ ศ. 7 พ.ย. 19:00 · 4 ท่าน (Brand v2 Card PNG)
async function onOnlineOrder(s: Settings, p: any) {
  if (!flag(s, 'telegram_notify_online')) return 'skipped'
  await sleep(4000) // items are inserted right after the booking row
  const b = await loadBooking(p.booking_id)
  if (!b) return 'skipped'
  const [items, tableName] = await Promise.all([loadItems(b.id), loadTableName(b.table_id)])

  const isDineIn = b.booking_type === 'dine_in'
  const isPickup = b.booking_type === 'pickup'
  const isHausmade = b.booking_type === 'hausmade' || String(b.order_type || '').startsWith('hausmade')
  const headline =
    isDineIn ? `จองโต๊ะ ${fmtThaiDateTime(b.booking_time)} · ${b.pax || '-'} ท่าน` :
    isPickup ? `สั่งกลับบ้าน · รับ ${fmtTime(b.booking_time)} · ${baht(b.total_amount)}` :
    isHausmade ? `HAUSMADE · ${baht(b.total_amount)}` :
    `ออเดอร์ออนไลน์ · ${baht(b.total_amount)}`

  const remark = String(b.staff_remark || '')
  const statusHtml =
    /CALL_CONFIRM/.test(remark) ? '<b>ต้องโทรยืนยัน</b>' :
    b.slip_verification_status === 'auto_verified' ? 'ชำระแล้ว · ตรวจสลิปอัตโนมัติ' :
    b.slip_verification_status ? '<b>รอตรวจสลิป</b>' :
    isPickup ? 'ชำระที่ร้าน' : ''

  const deposit = Number(b.deposit_amount || 0)
  const total = Number(b.total_amount || 0)
  const statusBanner =
    /CALL_CONFIRM/.test(remark)
      ? { label: 'ต้องโทรยืนยันกับลูกค้า', detail: customerPhone(b) || undefined, tone: 'plum' as const }
      : b.slip_verification_status === 'auto_verified'
      ? { label: 'ชำระแล้ว · ตรวจสลิปอัตโนมัติ', detail: deposit > 0 ? `มัดจำ ${baht(deposit)}` : undefined, tone: 'calm' as const }
      : b.slip_verification_status
      ? { label: 'รอตรวจสลิปการโอน', detail: deposit > 0 ? `มัดจำ ${baht(deposit)}` : (total > 0 ? baht(total) : undefined), tone: 'plum' as const }
      : isPickup
      ? { label: 'ชำระเงินที่ร้านตอนรับของ', tone: 'calm' as const }
      : undefined

  const tag = isDineIn ? 'TABLE BOOKING' : isPickup ? 'FOOD PICKUP' : isHausmade ? 'HAUSMADE' : 'ONLINE ORDER'
  const cardTitle =
    isDineIn ? `จองโต๊ะ ${fmtThaiDateTime(b.booking_time)}` :
    isPickup ? `สั่งกลับบ้าน · รับ ${fmtTime(b.booking_time)}` :
    isHausmade ? 'ออเดอร์ HAUSMADE' :
    'ออเดอร์ออนไลน์ใหม่'
  const cardSub =
    isDineIn ? dot(`${b.pax || '-'} ท่าน`, tableName ? placeLabelPlain(b, tableName) : '') :
    dot(guestLinePlain(b), !isPickup ? `กำหนด ${fmtThaiDateTime(b.booking_time)}` : '')

  const infoRows: Array<{ label: string; value: string; bold?: boolean }> = []
  const gPlain = guestLinePlain(b)
  if (gPlain) infoRows.push({ label: 'ลูกค้า', value: gPlain, bold: true })
  if (b.booking_time) infoRows.push({ label: isDineIn ? 'เวลาจอง' : 'เวลารับ', value: `${fmtThaiDateTime(b.booking_time)} น.` })
  if (isDineIn) infoRows.push({ label: 'โต๊ะ / จำนวน', value: dot(tableName ? placeLabelPlain(b, tableName) : 'ยังไม่ระบุโต๊ะ', `${b.pax || '-'} ท่าน`) })
  if (b.shipping_address) infoRows.push({ label: 'ที่อยู่จัดส่ง', value: String(b.shipping_address) })

  const MAX_CARD_ITEMS = 12
  const svg = renderOnlineOrderCardSvg({
    tag,
    bookingRef: `#${String(b.id).slice(-6)}`,
    title: cardTitle,
    subtitle: cardSub || undefined,
    statusBanner,
    infoRows,
    note: b.customer_note ? String(b.customer_note) : undefined,
    items: items.slice(0, MAX_CARD_ITEMS).map((it: any) => ({
      qty: Number(it.quantity || 1),
      name: itemName(it),
      options: optionLabel(it.selected_options) || undefined,
      priceText: baht(lineTotal(it)),
      voided: isVoid(it),
    })),
    itemsOverflow: Math.max(0, items.length - MAX_CARD_ITEMS),
    totalLabel: isDineIn && total <= 0 && deposit > 0 ? 'มัดจำจองโต๊ะ' : 'ยอดรวมทั้งหมด',
    totalText: total > 0 ? baht(total) : (deposit > 0 ? baht(deposit) : ''),
    subTotals: total > 0 && deposit > 0 ? [{ label: 'มัดจำ', value: baht(deposit) }] : [],
    timestampText: fmtDateTime(b.created_at || new Date().toISOString()),
  })

  const money = dot(
    isDineIn && total > 0 ? `ยอด ${baht(total)}` : '',
    deposit > 0 ? `มัดจำ ${baht(deposit)}` : '',
  )
  const fallbackHtml = block(
    `<b>${esc(headline)}</b>`,
    dot(guestLine(b), isDineIn && tableName ? placeLabel(b, tableName) : '', !isDineIn && !isPickup ? `กำหนด ${fmtThaiDateTime(b.booking_time)}` : '') || null,
    b.customer_note ? `<i>${esc(b.customer_note)}</i>` : null,
    items.length ? quote(itemLines(items), items.length > 6) : null,
    money || null,
    statusHtml || null,
  )
  const caption = block(
    `<b>${esc(headline)}</b>`,
    dot(guestLine(b), statusHtml) || null,
  )
  const actionBtn = isHausmade ? btn('จัดการ HAUSMADE', '/admin/hausmade') : btn('จัดการบิล / จอง', '/admin/bookings')

  await sendTelegramCard(s.telegram_chat_id, svg, caption, fallbackHtml, { buttons: [[actionBtn]] })
  return 'sent'
}

// ปิดรอบ · ฿12,400 (Brand v2 Card PNG)
// Was the stock closing count done for the current shop day? (shown on the shift close message)
async function stockCountStatus(): Promise<{ text: string; counted: boolean } | null> {
  try {
    const { data, error } = await supabase.rpc('stock_closing_status')
    if (error || !data) return null
    return {
      counted: Boolean(data.counted),
      text: data.counted ? `นับสต๊อกปิดร้านแล้ว ${data.items} รายการ` : 'ยังไม่ได้นับสต๊อกปิดร้าน',
    }
  } catch {
    return null
  }
}

async function onShiftClosed(s: Settings, p: any) {
  if (!flag(s, 'telegram_notify_shift')) return 'skipped'
  const { data: sh } = await supabase.from('pos_shifts').select('*').eq('id', p.shift_id).maybeSingle()
  if (!sh) return 'skipped'
  // The trigger fires the moment closed_at is set, but this runs a moment later. If the shift is
  // open again by now (a stray close that the POS overwrote), it was never really closed: say nothing.
  if (!sh.closed_at || sh.status !== 'closed') return 'skipped'
  const diff = Number(sh.difference || 0)
  const diffText = diff === 0 ? '฿0' : `${diff > 0 ? '+' : '−'}${baht(Math.abs(diff))}`
  const timeRange = `${fmtTime(sh.opened_at)} – ${fmtTime(sh.closed_at)}`
  const sc = await stockCountStatus()

  const svg = renderShiftCloseCardSvg({
    staffName: String(sh.staff_name || 'Staff'),
    timeRange,
    totalSalesText: baht(sh.total_sales),
    cashSalesText: baht(sh.cash_sales),
    qrSalesText: baht(sh.qr_sales),
    openingFloatText: baht(sh.opening_float),
    expectedCashText: baht(sh.expected_cash),
    closedCashText: baht(sh.closed_cash),
    diff,
    diffText,
    stockCountText: sc?.text ?? null,
    stockCounted: sc?.counted ?? false,
  })

  const fallbackHtml = block(
    `<b>ปิดรอบ · ${baht(sh.total_sales)}</b>`,
    dot(esc(sh.staff_name), `${fmtTime(sh.opened_at)}–${fmtTime(sh.closed_at)}`),
    quote(block(
      `เงินสด  <code>${baht(sh.cash_sales)}</code>`,
      `QR  <code>${baht(sh.qr_sales)}</code>`,
      `เงินทอนตั้งต้น  <code>${baht(sh.opening_float)}</code>`,
      `ควรมี  <code>${baht(sh.expected_cash)}</code> · นับได้  <code>${baht(sh.closed_cash)}</code>`,
    )),
    diff === 0 ? 'เงินสดตรง' : `<b>ส่วนต่าง ${diffText}</b>`,
    sc?.text || null,
  )
  const caption = block(
    `<b>ปิดรอบ · ${baht(sh.total_sales)}</b>`,
    dot(esc(sh.staff_name), diff === 0 ? 'เงินสดตรง' : `<b>ส่วนต่าง ${diffText}</b>`),
  )

  await sendTelegramCard(s.telegram_chat_id, svg, caption, fallbackHtml, {
    buttons: [[btn('ดูรายงานการเงิน', '/admin/financial')]],
  })
  return 'sent'
}
// ---------- daily summary ----------

// Latest scheduled summary instant (e.g. 03:00 Bangkok) that is <= now.
function latestScheduledEnd(timeStr: string, now = new Date()) {
  const [h, m] = (timeStr || '03:00').split(':').map(Number)
  const b = toBkk(now)
  let end = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate(), h || 0, m || 0) - BKK_OFFSET_MS
  if (end > now.getTime()) end -= 24 * 60 * 60 * 1000
  return new Date(end)
}

async function buildDailySummary(start: Date, end: Date, title: string) {
  const startIso = start.toISOString()
  const endIso = end.toISOString()

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, status, booking_type, source, order_type, total_amount, discount_amount, xhaus_discount, payment_method, staff_remark, pickup_contact_name, pax, table_id, booking_time, created_at')
    .gte('booking_time', startIso)
    .lt('booking_time', endIso)

  const all = (bookings || []).filter((b: any) => b.pickup_contact_name !== 'MAINTENANCE')
  const paid = all.filter((b: any) => b.status === 'completed')
  const paidIds = paid.map((b: any) => b.id)

  const revenue = paid.reduce((a: number, b: any) => a + Number(b.total_amount || 0), 0)
  const discount = paid.reduce((a: number, b: any) => a + Number(b.discount_amount || 0) + Number(b.xhaus_discount || 0), 0)
  const pax = paid.reduce((a: number, b: any) => a + Number(b.pax || 0), 0)

  const group = (keyOf: (b: any) => string) => {
    const out: Record<string, { n: number; amt: number }> = {}
    for (const b of paid) {
      const k = keyOf(b)
      out[k] = out[k] || { n: 0, amt: 0 }
      out[k].n++
      out[k].amt += Number(b.total_amount || 0)
    }
    return Object.entries(out).sort((a, b) => b[1].amt - a[1].amt)
  }
  // A split bill counts toward every method it used, with only the amount paid that way
  const methodTotals: Record<string, { n: number; amt: number }> = {}
  for (const b of paid) {
    for (const [m, amt] of Object.entries(paymentSplit(b))) {
      const k = paymentLabel(m)
      methodTotals[k] = methodTotals[k] || { n: 0, amt: 0 }
      methodTotals[k].n++
      methodTotals[k].amt += amt
    }
  }
  const byMethod = Object.entries(methodTotals).sort((a, b) => b[1].amt - a[1].amt)
  const byChannel = group((b) => CHANNEL_LABEL[b.booking_type] || b.booking_type || 'อื่นๆ')

  // Item-level stats for paid bills (chunked to keep the IN list small)
  const items: any[] = []
  for (let i = 0; i < paidIds.length; i += 200) {
    const { data } = await supabase
      .from('order_items')
      .select('quantity, price_at_time, cost_at_sale, status, custom_name, menu_items(name)')
      .in('booking_id', paidIds.slice(i, i + 200))
    items.push(...(data || []))
  }
  const sold = items.filter((it) => !isVoid(it))
  const voided = items.filter(isVoid)
  const cost = sold.reduce((a, it) => a + Number(it.quantity || 1) * Number(it.cost_at_sale || 0), 0)
  const itemsGross = sold.reduce((a, it) => a + lineTotal(it), 0)

  const top: Record<string, { q: number; amt: number }> = {}
  for (const it of sold) {
    const n = itemName(it)
    top[n] = top[n] || { q: 0, amt: 0 }
    top[n].q += Number(it.quantity || 1)
    top[n].amt += lineTotal(it)
  }
  const topList = Object.entries(top).sort((a, b) => b[1].q - a[1].q).slice(0, 5)

  const tablesOpened = all.filter((b: any) => b.table_id && ['walk_in', 'dine_in'].includes(b.booking_type) && !['cancelled', 'no_show', 'pending'].includes(b.status)).length
  const online = all.filter(isOnlineBooking)
  const cancelled = all.filter((b: any) => b.status === 'cancelled' || b.status === 'void').length
  const noShow = all.filter((b: any) => b.status === 'no_show').length
  const stillOpen = all.filter((b: any) => b.status === 'seated')

  const { data: shifts } = await supabase
    .from('pos_shifts')
    .select('staff_name, difference, closed_at')
    .gte('closed_at', startIso)
    .lt('closed_at', endIso)

  const row = (label: string, v: { n: number; amt: number }) => `${esc(label)}  <code>${baht(v.amt)}</code>  ${v.n} บิล`

  // Everything a manager should act on is collected into one "ต้องตรวจ" block
  const attentionPlain: string[] = []
  if (stillOpen.length) {
    const names = await Promise.all(stillOpen.slice(0, 10).map((b: any) => loadTableName(b.table_id)))
    attentionPlain.push(`ยังไม่เช็คบิล ${stillOpen.length}: ${names.map((n, i) => n || CHANNEL_LABEL[stillOpen[i].booking_type] || '-').join(', ')}`)
  }
  for (const sh of shifts || []) {
    const d = Number(sh.difference || 0)
    if (d !== 0) attentionPlain.push(`เงินสด ${sh.staff_name || 'Staff'} ส่วนต่าง ${d > 0 ? '+' : '−'}${baht(Math.abs(d))}`)
  }
  if (voided.length) attentionPlain.push(`ยกเลิกรายการ ${voided.length}`)
  if (discount > 0 && revenue > 0 && discount / (revenue + discount) > 0.1) {
    attentionPlain.push(`ส่วนลด ${((discount / (revenue + discount)) * 100).toFixed(0)}% ของยอด`)
  }

  const gp = cost > 0 && itemsGross > 0 ? `GP ${(((itemsGross - cost) / itemsGross) * 100).toFixed(1)}%` : ''
  const avgPerBill = baht(paid.length ? revenue / paid.length : 0)
  const floorMeta = dot(
    `เปิดโต๊ะ ${tablesOpened}`,
    `ออนไลน์ ${online.length}`,
    cancelled ? `ยกเลิกบิล ${cancelled}` : '',
    noShow ? `No-show ${noShow}` : '',
  )
  const periodText = `${fmtDateTime(startIso)} – ${fmtDateTime(endIso)}`
  const section = (label: string, body: string) => (body ? `\n<b>${label}</b>\n${quote(body)}` : null)

  const fallbackHtml = block(
    `<b>${esc(title)} · ${baht(revenue)}</b>`,
    dot(`${paid.length} บิล`, `เฉลี่ย ${avgPerBill}`, `${pax} ท่าน`),
    dot(gp, discount > 0 ? `ส่วนลด ${baht(discount)}` : '') || null,
    section('ต้องตรวจ', attentionPlain.map(esc).join('\n')),
    section('ชำระ', byMethod.map(([k, v]) => row(k, v)).join('\n')),
    section('ช่องทาง', byChannel.map(([k, v]) => row(k, v)).join('\n')),
    section('ขายดี', topList.map(([n, v], i) => `${i + 1}  ${esc(n)} ×${v.q}  <code>${baht(v.amt)}</code>`).join('\n')),
    section('หน้าร้าน', block(
      dot(`เปิดโต๊ะ ${tablesOpened}`, `ออนไลน์ ${online.length}`),
      cancelled || noShow ? dot(`ยกเลิกบิล ${cancelled}`, `No-show ${noShow}`) : null,
    )),
    `\n<i>${periodText}</i>`,
  )

  const svg = renderDailySummaryCardSvg({
    title,
    revenueText: baht(revenue),
    paidCount: paid.length,
    avgPerBillText: avgPerBill,
    pax,
    gpText: gp || undefined,
    discountText: discount > 0 ? `ส่วนลด ${baht(discount)}` : undefined,
    attention: attentionPlain,
    byMethod: byMethod.map(([label, v]) => ({ label, count: v.n, amountText: baht(v.amt) })),
    byChannel: byChannel.map(([label, v]) => ({ label, count: v.n, amountText: baht(v.amt) })),
    topItems: topList.map(([name, v], i) => ({ rank: i + 1, name, qty: v.q, amountText: baht(v.amt) })),
    floorMeta,
    periodText,
  })

  const caption = block(
    `<b>${esc(title)} · ${baht(revenue)}</b>`,
    dot(`${paid.length} บิล`, `${pax} ท่าน`, gp, attentionPlain.length ? `ต้องตรวจ ${attentionPlain.length}` : ''),
  )

  return { svg, caption, fallbackHtml }
}

async function onDailyTick(s: Settings) {
  if (!flag(s, 'telegram_daily_summary')) return 'skipped'
  const end = latestScheduledEnd(s.telegram_daily_summary_time)
  const key = end.toISOString()
  if (s.telegram_last_daily_summary === key) return 'already_sent'
  // Mark first so an overlapping tick cannot double-send.
  await saveSetting('telegram_last_daily_summary', key)
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000)
  const label = fmtDate(new Date(end.getTime() - 12 * 60 * 60 * 1000))
  const summary = await buildDailySummary(start, end, `สรุปยอด ${label}`)
  await sendTelegramCard(s.telegram_chat_id, summary.svg, summary.caption, summary.fallbackHtml, {
    buttons: [[btn('รายงานการเงิน', '/admin/financial'), btn('หน้า Admin', '/admin')]],
  })
  return 'sent'
}

// ---------- stock closing count ----------

// Shop day (05:00 to 05:00 Bangkok) that contains `d`.
const shopDayOf = (d: Date) => {
  const b = new Date(toBkk(d).getTime() - 5 * 60 * 60 * 1000)
  return `${b.getUTCFullYear()}-${pad(b.getUTCMonth() + 1)}-${pad(b.getUTCDate())}`
}

async function sendStockClosing(s: Settings, day: string, sessionId?: string) {
  const { data: sessions } = await supabase.from('stock_count_sessions')
    .select('id, performed_by, created_at, line_count')
    .eq('shop_day', day).eq('kind', 'closing').order('created_at')
  const list = sessions || []
  const idx = sessionId ? list.findIndex((x: any) => x.id === sessionId) : list.length - 1
  const session = idx >= 0 ? list[idx] : null
  if (!session) return 'no_closing_count'

  const { data: rows, error } = await supabase.rpc('stock_daily_reconciliation', { p_day: day })
  if (error) throw error
  const { data: items } = await supabase.from('stock_items')
    .select('id, name, unit, pack_unit, usage_unit, conversion_factor, current_quantity, reorder_point, min_stock_threshold, item_type, prep_mode, track_mode')
  const reorder = (items || []).filter((i: any) =>
    (i.track_mode ?? 'weekly') !== 'none' &&
    (i.item_type === 'raw' || (i.item_type === 'prep' && (i.prep_mode ?? 'stocked') === 'stocked')))

  // Same "abnormal" thresholds as Stock Recon (Admin can change them there)
  const { data: th } = await supabase.from('app_settings').select('key, value')
    .in('key', ['stock_variance_percent', 'stock_variance_baht'])
  const thVal = (k: string, d: number) => {
    const v = Number(((th || []).find((x: any) => x.key === k) || {}).value)
    return Number.isFinite(v) && v >= 0 ? v : d
  }

  const input = {
    thresholds: { percent: thVal('stock_variance_percent', 5), baht: thVal('stock_variance_baht', 100) },
    day,
    session,
    round: idx + 1,
    timeLabel: fmtTime(session.created_at),
    rows: rows || [],
    reorder,
    units: Object.fromEntries((items || []).map((i: any) => [i.id, i])),
  }
  const fallbackHtml = buildStockClosingMessage(input)
  const { card, caption } = buildStockClosingCardPayload(input)
  const svg = renderStockClosingCardSvg(card)

  await sendTelegramCard(s.telegram_chat_id, svg, caption, fallbackHtml, {
    buttons: [[btn('ตรวจสต๊อก (Recon)', '/admin/stock-recon'), btn('คลังสต๊อก', '/staff/stock')]],
  })
  return 'sent'
}

async function onStockClosing(s: Settings, p: any) {
  if (!flag(s, 'telegram_notify_stock')) return 'skipped'
  const day = String(p.shop_day || shopDayOf(new Date()))
  return await sendStockClosing(s, day, p.session_id ? String(p.session_id) : undefined)
}

// Admin "send now": latest closing count of the given (or current) shop day.
async function onStockSummaryNow(s: Settings, p: any) {
  const day = String(p.shop_day || shopDayOf(new Date()))
  const result = await sendStockClosing(s, day)
  if (result === 'no_closing_count') {
    await sendTelegram(s.telegram_chat_id, block(`<b>นับปิดร้าน · ${day}</b>`, 'ยังไม่มีการนับปิดร้านในวันนี้'), {
      buttons: [[btn('ไปหน้านับสต๊อก', '/staff/stock/count')]],
    })
    return 'sent'
  }
  return result
}

async function onDailySummaryNow(s: Settings) {
  const start = latestScheduledEnd(s.telegram_daily_summary_time)
  const summary = await buildDailySummary(start, new Date(), `ยอดถึง ${fmtTime(new Date().toISOString())}`)
  await sendTelegramCard(s.telegram_chat_id, summary.svg, summary.caption, summary.fallbackHtml, {
    buttons: [[btn('รายงานการเงิน', '/admin/financial'), btn('หน้า Admin', '/admin')]],
  })
  return 'sent'
}

async function discoverChats() {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not set')
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?allowed_updates=["message","my_chat_member","channel_post"]`)
  const out = await res.json()
  if (!out.ok) throw new Error(`Telegram: ${out.description}`)
  const chats = new Map<string, { id: string; title: string; type: string }>()
  for (const u of out.result || []) {
    const chat = u.message?.chat || u.my_chat_member?.chat || u.channel_post?.chat
    if (!chat) continue
    chats.set(String(chat.id), {
      id: String(chat.id),
      title: chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || String(chat.id),
      type: chat.type,
    })
  }
  return [...chats.values()]
}

// ---------- auth ----------

async function isAdminCaller(req: Request) {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!jwt) return false
  const { data } = await supabase.auth.getUser(jwt)
  if (!data?.user) return false
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
  return ['admin', 'owner'].includes(String(profile?.role || ''))
}

const HOOK_EVENTS = new Set(['table_opened', 'items_added', 'bill_paid', 'online_order', 'shift_closed', 'daily_tick', 'stock_closing'])
const ADMIN_EVENTS = new Set(['test', 'daily_summary_now', 'stock_summary_now', 'discover_chats', 'preview_card'])

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let payload: any = {}
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }
  const event = String(payload.event || '')

  // Pure static SVG->PNG health check (no DB access, no Telegram call)
  if (event === 'preview_card') {
    try {
      const nowText = fmtDateTime(new Date().toISOString())
      const svg = renderTestCardSvg(nowText)
      const png = await renderSvgToPng(svg)
      return new Response(png, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'image/png' } })
    } catch (error) {
      return json({ error: (error as Error).message }, 500)
    }
  }

  const fromHook = !!HOOK_SECRET && req.headers.get('x-hook-secret') === HOOK_SECRET
  if (HOOK_EVENTS.has(event) && !fromHook) return json({ error: 'unauthorized' }, 401)
  if (ADMIN_EVENTS.has(event) && !fromHook && !(await isAdminCaller(req))) return json({ error: 'unauthorized' }, 401)
  if (!HOOK_EVENTS.has(event) && !ADMIN_EVENTS.has(event)) return json({ error: `unknown event: ${event}` }, 400)

  try {
    if (event === 'discover_chats') return json({ chats: await discoverChats() })

    if (event === 'preview_card') {
      const nowText = fmtDateTime(new Date().toISOString())
      const svg = renderTestCardSvg(nowText)
      const png = await renderSvgToPng(svg)
      return new Response(png, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'image/png' } })
    }

    const s = await loadSettings()
    // Admin UI may send an unsaved chat id for testing
    if (payload.chat_id) s.telegram_chat_id = String(payload.chat_id)
    if (!s.telegram_chat_id) return json({ error: 'ยังไม่ได้ตั้งค่า Chat ID' }, 400)
    if (HOOK_EVENTS.has(event) && s.telegram_enabled !== 'true') return json({ result: 'disabled' })

    let result = 'skipped'
    switch (event) {
      case 'table_opened': result = await onTableOpened(s, payload); break
      case 'items_added': result = await onItemsAdded(s, payload); break
      case 'bill_paid': result = await onBillPaid(s, payload); break
      case 'online_order': result = await onOnlineOrder(s, payload); break
      case 'shift_closed': result = await onShiftClosed(s, payload); break
      case 'daily_tick': result = await onDailyTick(s); break
      case 'daily_summary_now': result = await onDailySummaryNow(s); break
      case 'stock_closing': result = await onStockClosing(s, payload); break
      case 'stock_summary_now': result = await onStockSummaryNow(s, payload); break
      case 'test': {
        const nowText = fmtDateTime(new Date().toISOString())
        const svg = renderTestCardSvg(nowText)
        const fallback = block('<b>เชื่อมต่อแล้ว</b>', dot('In The Haus', nowText))
        await sendTelegramCard(s.telegram_chat_id, svg, fallback, fallback, {
          buttons: [[btn('เปิดหน้า Admin', '/admin')]],
        })
        result = 'sent'
        break
      }
    }
    return json({ result })
  } catch (error) {
    console.error(`[telegram-report] ${event} failed:`, error)
    return json({ error: (error as Error).message }, 500)
  }
})
