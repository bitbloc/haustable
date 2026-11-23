// Stock closing summary for Telegram. No imports, so the app's unit tests can load it too.
//
// Input
//   day        'YYYY-MM-DD' shop day (05:00 to 05:00 Bangkok)
//   session    the closing count session that triggered the message
//   round      1 for the first closing count of the day, 2 for a recount, ...
//   rows       stock_daily_reconciliation(day)
//   reorder    stock items at or below their reorder point / minimum

export type ReconRow = {
  stock_item_id: string
  name: string
  unit: string | null
  expected_close: number | null
  closing_qty: number | null
  variance: number | null
  variance_value: number | null
  unit_cost: number | null
}

/** Counting and usage units: a crate of 12 bottles is said as "1 ลัง 5 ขวด", not 1.417. */
export type ItemUnits = { unit?: string | null; pack_unit?: string | null; usage_unit?: string | null; conversion_factor?: number | string | null }

export type ReorderItem = ItemUnits & {
  name: string
  unit: string | null
  current_quantity: number | null
  reorder_point: number | null
  min_stock_threshold: number | null
}

const TH_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const UNIT_LABELS: Record<string, string> = {
  unit: 'ชิ้น', piece: 'ชิ้น', pcs: 'ชิ้น', bottle: 'ขวด', can: 'กระป๋อง', pack: 'แพ็ค', box: 'กล่อง',
  bag: 'ถุง', kg: 'กก.', g: 'ก.', l: 'ล.', ml: 'มล.', gallon: 'แกลลอน', portion: 'สูตร', potion: 'สูตร',
  crate: 'ลัง', carton: 'ลัง', glass: 'แก้ว', dozen: 'โหล',
}
// Same rule as the LINE summary (line-webhook/stockSummary.ts piecesPerUnit)
const PIECE_UNITS = new Set(['bottle', 'can', 'pcs', 'piece', 'unit', 'glass', 'box', 'bag', 'pack',
  'ขวด', 'กระป๋อง', 'ชิ้น', 'ใบ', 'อัน', 'แก้ว', 'กล่อง', 'ถุง', 'ซอง', 'ม้วน'])
const HOLDER_UNITS = new Set(['crate', 'carton', 'pack', 'box', 'bag', 'dozen', 'ลัง', 'แพ็ค', 'แพค', 'กล่อง', 'ถุง', 'ห่อ', 'โหล'])
const low = (v: unknown) => String(v ?? '').trim().toLowerCase()
export function piecesPerUnit(u?: ItemUnits | null): number {
  const f = Number(u?.conversion_factor) || 0
  const usage = low(u?.usage_unit)
  const unit = low(u?.unit || u?.pack_unit)
  if (!(f > 1) || !PIECE_UNITS.has(usage) || usage === unit) return 0
  return HOLDER_UNITS.has(unit) || HOLDER_UNITS.has(low(u?.pack_unit)) ? f : 0
}
/** Plain (non-HTML-escaped) amount string for SVG/card renderers that apply their own escaping. */
export function plainAmountText(n: number, u?: ItemUnits | null): string {
  const per = piecesPerUnit(u)
  if (!per) return `${qty(Math.abs(n))} ${unitLabel((u?.unit || u?.pack_unit) ?? null)}`.trim()
  return `${Math.round(Math.abs(n) * per)} ${unitLabel(u?.usage_unit ?? null)}`
}

/** An amount in its units: things used one by one in pieces ("17 ขวด"), else "1.5 กก.". Always positive. */
export function amountText(n: number, u?: ItemUnits | null): string {
  const per = piecesPerUnit(u)
  if (!per) return `${qty(Math.abs(n))} ${esc(unitLabel((u?.unit || u?.pack_unit) ?? null))}`.trim()
  return `${Math.round(Math.abs(n) * per)} ${esc(unitLabel(u?.usage_unit ?? null))}`
}

export const PERCENT_LIMIT = 5
export const BAHT_LIMIT = 100
const MAX_LINES = 8

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const num = (v: unknown) => Number(v) || 0
const qty = (n: number) => String(Math.round(n * 1000) / 1000)
const baht = (n: number) => `฿${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const unitLabel = (u: string | null) => UNIT_LABELS[String(u || '').toLowerCase()] || u || ''

export const thaiDay = (ymd: string) => {
  const d = new Date(`${ymd}T12:00:00Z`)
  return `${TH_DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${TH_MONTHS[d.getUTCMonth()]}`
}

/** Same rule as the app: off by more than 5% of what should be left AND by more than ฿100 (unpriced: % only). */
export type Thresholds = { percent: number; baht: number }
const DEFAULT_THRESHOLDS: Thresholds = { percent: PERCENT_LIMIT, baht: BAHT_LIMIT }

export const isAbnormal = (r: ReconRow, t: Thresholds = DEFAULT_THRESHOLDS) => {
  if (r.variance === null || r.variance === undefined || r.closing_qty === null || r.closing_qty === undefined) return false
  const v = num(r.variance)
  if (v === 0) return false
  const expected = Math.abs(num(r.expected_close))
  const pct = expected > 0 ? (Math.abs(v) / expected) * 100 : 100
  const priced = num(r.unit_cost) > 0
  return pct > t.percent && (!priced || Math.abs(num(r.variance_value)) > t.baht)
}

export const needsReorder = (i: ReorderItem) => {
  const q = num(i.current_quantity)
  const rp = num(i.reorder_point)
  const min = num(i.min_stock_threshold)
  return (rp > 0 && q <= rp) || (min > 0 && q <= min)
}

export function buildStockClosingMessage(input: {
  day: string
  session: { performed_by?: string | null; created_at?: string | null; line_count?: number | null }
  round: number
  timeLabel: string
  rows: ReconRow[]
  reorder: ReorderItem[]
  thresholds?: Thresholds
  units?: Record<string, ItemUnits>
}): string {
  const t = input.thresholds || DEFAULT_THRESHOLDS
  const counted = input.rows.filter((r) => r.closing_qty !== null && r.closing_qty !== undefined)
  const abnormal = counted
    .filter((r) => isAbnormal(r, t))
    .sort((a, b) => num(a.variance_value) - num(b.variance_value) || num(a.variance) - num(b.variance))
  const short = counted.reduce((s, r) => s + Math.min(0, num(r.variance_value)), 0)
  const reorder = input.reorder.filter(needsReorder).sort((a, b) => a.name.localeCompare(b.name, 'th'))

  const lines: string[] = []
  lines.push(`<b>นับปิดร้าน · ${thaiDay(input.day)}${input.round > 1 ? ` · รอบ ${input.round}` : ''}</b>`)
  lines.push([esc(input.session.performed_by || 'Staff'), input.timeLabel, `นับ ${counted.length} รายการ`].filter(Boolean).join(' · '))

  if (abnormal.length === 0) {
    lines.push(counted.length ? 'ไม่มีรายการผิดปกติ' : 'ยังไม่มีผลต่าง')
  } else {
    lines.push(`<b>ผิดปกติ ${abnormal.length} รายการ${short < 0 ? ` · ขาด ${baht(short)}` : ''}</b>`)
    const body = abnormal.slice(0, MAX_LINES).map((r) => {
      const v = num(r.variance)
      const money = num(r.unit_cost) > 0 ? `  <code>${v < 0 ? '−' : '+'}${baht(num(r.variance_value))}</code>` : ''
      const u = input.units?.[r.stock_item_id] || { unit: r.unit }
      return `${esc(r.name)}  ${v < 0 ? '−' : '+'}${amountText(v, u)}${money}`
    })
    if (abnormal.length > MAX_LINES) body.push(`และอีก ${abnormal.length - MAX_LINES} รายการ`)
    lines.push(`<blockquote expandable>${body.join('\n')}</blockquote>`)
  }

  if (reorder.length) {
    lines.push(`<b>ต้องสั่ง ${reorder.length} รายการ</b>`)
    const body = reorder.slice(0, MAX_LINES * 2).map((i) => {
      const point = num(i.reorder_point) > 0 ? num(i.reorder_point) : num(i.min_stock_threshold)
      return `${esc(i.name)}  เหลือ ${amountText(num(i.current_quantity), i)} / สั่งที่ ${amountText(point, i)}`
    })
    if (reorder.length > MAX_LINES * 2) body.push(`และอีก ${reorder.length - MAX_LINES * 2} รายการ`)
    lines.push(`<blockquote expandable>${body.join('\n')}</blockquote>`)
  }

  lines.push('ดูรายละเอียด: Admin → Menu &amp; Lab → Stock Recon')
  return lines.join('\n')
}

export function buildStockClosingCardPayload(input: {
  day: string
  session: { performed_by?: string | null; created_at?: string | null; line_count?: number | null }
  round: number
  timeLabel: string
  rows: ReconRow[]
  reorder: ReorderItem[]
  thresholds?: Thresholds
  units?: Record<string, ItemUnits>
}) {
  const t = input.thresholds || DEFAULT_THRESHOLDS
  const counted = input.rows.filter((r) => r.closing_qty !== null && r.closing_qty !== undefined)
  const abnormal = counted
    .filter((r) => isAbnormal(r, t))
    .sort((a, b) => num(a.variance_value) - num(b.variance_value) || num(a.variance) - num(b.variance))
  const short = counted.reduce((s, r) => s + Math.min(0, num(r.variance_value)), 0)
  const reorder = input.reorder.filter(needsReorder).sort((a, b) => a.name.localeCompare(b.name, 'th'))

  const maxAbn = MAX_LINES
  const maxReo = 10

  const title = `นับปิดร้าน · ${thaiDay(input.day)}${input.round > 1 ? ` · รอบ ${input.round}` : ''}`
  const subtitle = [input.session.performed_by || 'Staff', input.timeLabel, `นับ ${counted.length} รายการ`].filter(Boolean).join(' · ')
  const shortText = short < 0 ? `ขาด ${baht(short)}` : undefined

  const card = {
    title,
    subtitle,
    countedCount: counted.length,
    abnormalCount: abnormal.length,
    shortText,
    reorderCount: reorder.length,
    abnormalRows: abnormal.slice(0, maxAbn).map((r) => {
      const v = num(r.variance)
      const u = input.units?.[r.stock_item_id] || { unit: r.unit }
      const diffText = `${v < 0 ? '−' : '+'}${plainAmountText(v, u)}`
      const valueText = num(r.unit_cost) > 0 ? `${v < 0 ? '−' : '+'}${baht(num(r.variance_value))}` : undefined
      return { name: r.name, diffText, valueText, isShort: v < 0 }
    }),
    abnormalOverflow: Math.max(0, abnormal.length - maxAbn),
    reorderRows: reorder.slice(0, maxReo).map((i) => {
      const point = num(i.reorder_point) > 0 ? num(i.reorder_point) : num(i.min_stock_threshold)
      return {
        name: i.name,
        leftText: plainAmountText(num(i.current_quantity), i),
        pointText: plainAmountText(point, i),
      }
    }),
    reorderOverflow: Math.max(0, reorder.length - maxReo),
  }

  const captionParts = [
    `<b>${esc(title)}</b>`,
    [
      abnormal.length ? `ผิดปกติ ${abnormal.length}${shortText ? ` (${shortText})` : ''}` : 'ไม่มีรายการผิดปกติ',
      reorder.length ? `ต้องสั่ง ${reorder.length} รายการ` : '',
    ].filter(Boolean).join(' · '),
  ]

  return { card, caption: captionParts.join('\n') }
}
