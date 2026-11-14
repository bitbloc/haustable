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

export type ReorderItem = {
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
  bag: 'ถุง', kg: 'กก.', g: 'ก.', l: 'ล.', ml: 'มล.', gallon: 'แกลลอน', portion: 'ส่วน',
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
export const isAbnormal = (r: ReconRow) => {
  if (r.variance === null || r.variance === undefined || r.closing_qty === null || r.closing_qty === undefined) return false
  const v = num(r.variance)
  if (v === 0) return false
  const expected = Math.abs(num(r.expected_close))
  const pct = expected > 0 ? (Math.abs(v) / expected) * 100 : 100
  const priced = num(r.unit_cost) > 0
  return pct > PERCENT_LIMIT && (!priced || Math.abs(num(r.variance_value)) > BAHT_LIMIT)
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
}): string {
  const counted = input.rows.filter((r) => r.closing_qty !== null && r.closing_qty !== undefined)
  const abnormal = counted
    .filter(isAbnormal)
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
      return `${esc(r.name)}  ${v < 0 ? '−' : '+'}${qty(Math.abs(v))} ${esc(unitLabel(r.unit))}${money}`
    })
    if (abnormal.length > MAX_LINES) body.push(`และอีก ${abnormal.length - MAX_LINES} รายการ`)
    lines.push(`<blockquote expandable>${body.join('\n')}</blockquote>`)
  }

  if (reorder.length) {
    lines.push(`<b>ต้องสั่ง ${reorder.length} รายการ</b>`)
    const body = reorder.slice(0, MAX_LINES * 2).map((i) => {
      const point = num(i.reorder_point) > 0 ? num(i.reorder_point) : num(i.min_stock_threshold)
      return `${esc(i.name)}  เหลือ ${qty(num(i.current_quantity))} / สั่งที่ ${qty(point)} ${esc(unitLabel(i.unit))}`
    })
    if (reorder.length > MAX_LINES * 2) body.push(`และอีก ${reorder.length - MAX_LINES * 2} รายการ`)
    lines.push(`<blockquote expandable>${body.join('\n')}</blockquote>`)
  }

  lines.push('ดูรายละเอียด: Admin → Menu &amp; Lab → Stock Recon')
  return lines.join('\n')
}
