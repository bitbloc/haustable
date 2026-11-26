/**
 * Stock summary card for the LINE bot (commands stday / stback / sthour).
 *
 * One line per item, grouped by category: what came in, what went out, how often it was
 * counted, and the stock left NOW, written as the web count sheet writes it
 * ("1 กก. 700 ก.", "2 ขวด + เปิดอยู่ 1 เหลือ 40%", "ติดลบ 3 ขวด"); the database keeps exact numbers.
 *
 * Pure module (no Deno APIs) so the unit tests can run it under vitest.
 */

import { BRAND } from "./brand.ts"

export type StockTx = {
  quantity_change: number | string | null
  transaction_type: string | null
  created_at?: string
  stock_items: {
    id?: string
    name?: string | null
    unit?: string | null
    category?: string | null
    current_quantity?: number | string | null
    min_stock_threshold?: number | string | null
    reorder_point?: number | string | null
    pack_unit?: string | null
    usage_unit?: string | null
    conversion_factor?: number | string | null
  } | null
}

/** The units an item is counted and used in; pieces when a crate or pack holds countable things. */
export type StockUnits = { unit?: string | null; pack_unit?: string | null; usage_unit?: string | null; conversion_factor?: number | string | null }

// Brand v2 (brand.ts): plum header, cream body, charcoal ink.
// Out and low stock are plum, reorder is charcoal. Red is kept for errors only.
const C = {
  ink: BRAND.charcoal,
  muted: BRAND.muted,
  neutral: BRAND.neutral,
  rule: BRAND.rule,
  paper: BRAND.cream,
  plum: BRAND.plum,
  onPlum: BRAND.cream,
  onPlum2: BRAND.onPlum2,
  ok: BRAND.neutral,
  warn: BRAND.charcoal,
  crit: BRAND.plum,
  out: BRAND.plum,
}

const EPS = 0.0001
const ITEMS_PER_BUBBLE = 14
const MAX_BUBBLES = 12

// Known categories, in the order the shop walks them. Anything else keeps its own name.
const CATEGORY = [
  ['bar', 'บาร์'],
  ['homemade', 'ทำเองในร้าน'],
  ['sauce', 'ซอสและเครื่องปรุง'],
  ['curry', 'พริกแกง'],
  ['meat', 'เนื้อสัตว์'],
  ['egg', 'ไข่'],
  ['veg', 'ผัก'],
  ['frozen', 'ของแช่แข็ง'],
  ['dry', 'ของแห้ง'],
  ['oil', 'น้ำมัน'],
  ['preserved', 'ของดอง'],
  ['soup', 'ซุป'],
  ['packaging', 'บรรจุภัณฑ์'],
  ['supplies', 'ของใช้ในร้าน'],
] as const

const UNIT_TH: Record<string, string> = {
  bottle: 'ขวด', box: 'กล่อง', can: 'กระป๋อง', gallon: 'แกลลอน', pack: 'แพ็ค', bag: 'ถุง',
  pcs: 'ชิ้น', piece: 'ชิ้น', kg: 'กก.', g: 'กรัม', l: 'ลิตร', litre: 'ลิตร', liter: 'ลิตร',
  ml: 'มล.', roll: 'ม้วน', unit: 'หน่วย', 'กก': 'กก.', 'แกลอน': 'แกลลอน',
  crate: 'ลัง', carton: 'ลัง', glass: 'แก้ว', portion: 'สูตร', potion: 'สูตร', dozen: 'โหล',
}

// Units that are counted one by one, and units that hold several of them
const PIECE_UNITS = new Set(['bottle', 'can', 'pcs', 'piece', 'unit', 'glass', 'box', 'bag', 'pack',
  'ขวด', 'กระป๋อง', 'ชิ้น', 'ใบ', 'อัน', 'แก้ว', 'กล่อง', 'ถุง', 'ซอง', 'ม้วน'])
const HOLDER_UNITS = new Set(['crate', 'carton', 'pack', 'box', 'bag', 'dozen', 'ลัง', 'แพ็ค', 'แพค', 'กล่อง', 'ถุง', 'ห่อ', 'โหล'])

/** Pieces in one counted unit (12 bottles in a crate), or 0 when it is not a pack of pieces. */
export function piecesPerUnit(item?: StockUnits | null): number {
  const low = (v: unknown) => String(v ?? '').trim().toLowerCase()
  const f = Number(item?.conversion_factor) || 0
  const usage = low(item?.usage_unit)
  const unit = low(item?.unit || item?.pack_unit)
  if (!(f > 1) || !PIECE_UNITS.has(usage) || usage === unit) return 0
  return HOLDER_UNITS.has(unit) || HOLDER_UNITS.has(low(item?.pack_unit)) ? f : 0
}

/** 17 bottles of a 12-crate -> { whole: 1, pieces: 5 }; rounding crumbs are dropped. */
function wholeAndPieces(qty: number, per: number) {
  const total = Math.round(Math.abs(qty) * per)
  return { whole: Math.floor(total / per), pieces: total % per }
}

function piecesText(qty: number, item: StockUnits, per: number): string {
  const { whole, pieces } = wholeAndPieces(qty, per)
  const u = unitLabel(item.unit || item.pack_unit)
  const p = unitLabel(item.usage_unit)
  if (!whole && !pieces) return ''
  if (!whole) return `${pieces} ${p}`
  return pieces ? `${whole} ${u} + ${pieces} ${p}` : `${whole} ${u}`
}

export function unitLabel(unit?: string | null): string {
  const u = String(unit || '').trim()
  if (!u) return ''
  return UNIT_TH[u.toLowerCase()] || UNIT_TH[u] || u
}

export function categoryKey(raw?: string | null): { key: string; label: string; order: number } {
  const k = String(raw || '').trim().toLowerCase()
  if (!k) return { key: '_none', label: 'ไม่ระบุหมวด', order: 999 }
  const i = CATEGORY.findIndex(([key]) => key === k)
  if (i >= 0) return { key: k, label: CATEGORY[i][1], order: i }
  return { key: k, label: String(raw).trim(), order: 500 }
}

const QUARTER = ['', '¼', '½', '¾']

/** Whole units plus the nearest quarter: 1.65 -> "1 ¾", 0.1 -> "<¼", 3 -> "3". */
export function quarterText(value: number): string {
  const v = Math.abs(Number(value) || 0)
  let whole = Math.floor(v + EPS)
  const frac = v - whole
  let q = Math.round(frac * 4)
  if (q === 4) { whole += 1; q = 0 }
  if (whole === 0 && q === 0) return frac > 0.02 ? '<¼' : '0'
  if (whole === 0) return QUARTER[q]
  return q ? `${whole} ${QUARTER[q]}` : String(whole)
}

/**
 * Stock left, in words a person checks against the shelf. A crate of bottles is said in
 * crates and bottles ("1 ลัง + 5 ขวด"); other things in whole units and the nearest quarter.
 * The second argument is a unit (older callers) or the item's units.
 */
export function remainingText(qty: number, units?: string | StockUnits | null): string {
  const item: StockUnits = typeof units === 'object' && units ? units : { unit: units as string | null }
  const n = Number(qty) || 0
  // Sold more than was received: say so, never show it as "หมด" (same as the web count sheet)
  if (n < -EPS) return `ติดลบ ${remainingText(-n, item)}`
  const v = Math.max(0, n)
  if (v <= EPS) return 'หมด'
  const per = piecesPerUnit(item)
  if (per) {
    // Used one by one: how many bottles in all first, crates as a short summary
    const total = Math.round(v * per)
    if (!total) return 'หมด'
    const { whole } = wholeAndPieces(v, per)
    const said = piecesText(v, item, per)
    return whole ? `${total} ${unitLabel(item.usage_unit)} (${said})` : `${total} ${unitLabel(item.usage_unit)}`
  }
  return amountText(v, item)
}

export function changeText(delta: number, units?: string | StockUnits | null): string {
  const item: StockUnits = typeof units === 'object' && units ? units : { unit: units as string | null }
  const v = Number(delta) || 0
  if (Math.abs(v) <= EPS) return '0'
  const sign = v > 0 ? '+' : '-'
  const per = piecesPerUnit(item)
  if (per) {
    const said = piecesText(v, item, per)
    return said ? `${sign}${said}` : '0'
  }
  // Packs of grams / ml read as packs and loose rest; a change in counted units is a plain
  // number ("-0.65 กล่อง"), since "opened one, 35% left" describes a shelf, not a movement.
  const low = (x: unknown) => String(x ?? '').trim().toLowerCase()
  if (Number(item.conversion_factor) > 1 && LOOSE_UNIT[low(item.usage_unit)]) {
    const text = amountText(Math.abs(v), item)
    return text === '0' ? '0' : `${sign}${text}`
  }
  const r = Math.round(Math.abs(v) * 100) / 100
  return r ? `${sign}${r.toLocaleString('th-TH', { maximumFractionDigits: 2 })} ${unitLabel(item.unit || item.pack_unit)}`.trim() : '0'
}

// Short units for the loose remainder, as the web writes them ("1 กก. 700 ก.")
const LOOSE_UNIT: Record<string, string> = { g: 'ก.', ml: 'มล.' }
const MEASURED_UNITS = new Set(['kg', 'g', 'l', 'ml', 'litre', 'liter', 'กก', 'กก.', 'กรัม', 'ลิตร', 'มล.', 'มล'])

/**
 * A positive amount the way the web count sheet says it (src/utils/stockCount.js):
 * - packs of grams / millilitres: whole packs and the loose rest, "1 กก. 700 ก.", "5 แกลลอน 967 มล."
 * - weighed or poured with no pack size: the number, "2.35 กก."
 * - counted units: whole units, and an opened one by how much is left, "2 ขวด + เปิดอยู่ 1 เหลือ 40%"
 */
function amountText(v: number, item: StockUnits): string {
  const low = (x: unknown) => String(x ?? '').trim().toLowerCase()
  const unit = item.unit || item.pack_unit
  const u = unitLabel(unit)
  const usage = low(item.usage_unit)
  const f = Number(item.conversion_factor) || 0
  if (f > 1 && LOOSE_UNIT[usage]) {
    const totalUsage = Math.round(v * f)
    let packs = Math.floor((totalUsage + 1e-9) / f)
    let rest = Math.round(totalUsage - packs * f)
    if (rest >= f) { packs += 1; rest = 0 }
    if (!packs && !rest) return `<1 ${LOOSE_UNIT[usage]}`
    const parts: string[] = []
    if (packs > 0) parts.push(`${packs.toLocaleString('th-TH')} ${u}`.trim())
    if (rest > 0) parts.push(`${rest.toLocaleString('th-TH')} ${LOOSE_UNIT[usage]}`)
    return parts.join(' ')
  }
  if (MEASURED_UNITS.has(low(unit))) {
    const r = Math.round(v * 100) / 100
    return r ? `${r.toLocaleString('th-TH', { maximumFractionDigits: 2 })} ${u}`.trim() : '0'
  }
  let whole = Math.floor(v + EPS)
  let pct = Math.round((v - whole) * 100)
  if (pct >= 100) { whole += 1; pct = 0 }
  if (!pct) return whole ? `${whole.toLocaleString('th-TH')} ${u}`.trim() : '0'
  const open = `เปิดอยู่ 1 เหลือ ${pct}%`
  return whole ? `${whole.toLocaleString('th-TH')} ${u} + ${open}` : open
}

type Status = 'out' | 'low' | 'reorder' | 'ok'
const STATUS: Record<Status, { label: string; color: string; rank: number }> = {
  out: { label: 'หมด', color: C.out, rank: 0 },
  low: { label: 'เหลือน้อย', color: C.crit, rank: 1 },
  reorder: { label: 'ควรสั่ง', color: C.warn, rank: 2 },
  ok: { label: '', color: C.ok, rank: 3 },
}

// Same rule as src/utils/stockUtils.js stockStatus()
export function stockStatus(item: StockTx['stock_items']): Status {
  const qty = Number(item?.current_quantity) || 0
  const min = Number(item?.min_stock_threshold) || 0
  const reorder = Number(item?.reorder_point) || 0
  if (qty <= EPS) return 'out'
  if (min > 0 && qty <= min + EPS) return 'low'
  if (reorder > 0 && qty <= reorder + EPS) return 'reorder'
  return 'ok'
}

type ItemSummary = {
  key: string
  name: string
  unit: string
  units: StockUnits
  current: number
  status: Status
  inQty: number
  outQty: number
  countAdjust: number
  counts: number
  moves: number
}

export function summarize(transactions: StockTx[]) {
  const items = new Map<string, ItemSummary & { cat: ReturnType<typeof categoryKey> }>()
  for (const tx of transactions || []) {
    const it = tx.stock_items
    if (!it) continue
    const key = String(it.id || it.name || '')
    if (!key) continue
    let s = items.get(key)
    if (!s) {
      s = {
        key,
        name: String(it.name || 'ไม่ทราบชื่อ'),
        unit: String(it.unit || ''),
        units: { unit: it.unit, pack_unit: it.pack_unit, usage_unit: it.usage_unit, conversion_factor: it.conversion_factor },
        current: Number(it.current_quantity) || 0,
        status: stockStatus(it),
        inQty: 0, outQty: 0, countAdjust: 0, counts: 0, moves: 0,
        cat: categoryKey(it.category),
      }
      items.set(key, s)
    }
    const d = Number(Number(tx.quantity_change || 0).toFixed(4))
    const type = String(tx.transaction_type || '').toLowerCase()
    s.moves += 1
    if (type === 'set' || type === 'audit' || type === 'count_adjust') {
      s.counts += 1
      s.countAdjust += d
    } else if (d > 0) s.inQty += d
    else s.outQty += d
  }

  const groups = new Map<string, { label: string; order: number; items: ItemSummary[] }>()
  for (const s of items.values()) {
    const g = groups.get(s.cat.key) || { label: s.cat.label, order: s.cat.order, items: [] }
    g.items.push(s)
    groups.set(s.cat.key, g)
  }
  const ordered = [...groups.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'th'))
  for (const g of ordered) {
    g.items.sort((a, b) => STATUS[a.status].rank - STATUS[b.status].rank || a.name.localeCompare(b.name, 'th'))
  }
  return ordered
}

function activityText(s: ItemSummary): string {
  const parts: string[] = []
  if (s.inQty > EPS) parts.push(`รับเข้า ${changeText(s.inQty, s.units)}`)
  if (s.outQty < -EPS) parts.push(`ใช้ ${changeText(s.outQty, s.units)}`)
  if (s.counts > 0) {
    const adj = Math.abs(s.countAdjust) > EPS && changeText(s.countAdjust, s.units) !== '0' ? ` (${changeText(s.countAdjust, s.units)})` : ''
    parts.push(s.counts > 1 ? `นับ ${s.counts} ครั้ง${adj}` : `นับแล้ว${adj}`)
  }
  return parts.join(', ') || 'ไม่มีการเปลี่ยนแปลง'
}

function itemRow(s: ItemSummary, detail: string = activityText(s)) {
  const st = STATUS[s.status]
  return {
    type: 'box',
    layout: 'horizontal',
    spacing: 'md',
    margin: 'md',
    contents: [
      { type: 'box', layout: 'vertical', width: '3px', backgroundColor: st.color, cornerRadius: '2px', contents: [] },
      {
        type: 'box', layout: 'vertical', flex: 6, contents: [
          { type: 'text', text: s.name.slice(0, 80) || '-', size: 'sm', weight: 'bold', color: C.ink, wrap: true },
          { type: 'text', text: detail, size: 'xs', color: C.neutral, wrap: true, margin: 'xs' },
        ],
      },
      {
        type: 'box', layout: 'vertical', flex: 4, contents: [
          { type: 'text', text: remainingText(s.current, s.units), size: 'sm', weight: 'bold', color: s.status === 'ok' ? C.ink : st.color, align: 'end', wrap: true },
          ...(st.label && st.label !== remainingText(s.current, s.units) && !remainingText(s.current, s.units).startsWith('ติดลบ') ? [{ type: 'text', text: st.label, size: 'xs', weight: 'bold', color: st.color, align: 'end', margin: 'xs' }] : []),
        ],
      },
    ],
  }
}

function bubble(title: string, subtitle: string, body: any[], _tag = '') {
  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box', layout: 'vertical', paddingAll: '20px', backgroundColor: C.plum,
      contents: [
        { type: 'text', text: title, size: 'lg', weight: 'bold', color: C.onPlum, wrap: true },
        { type: 'text', text: subtitle || '-', size: 'sm', color: C.onPlum2, margin: 'sm', wrap: true },
      ],
    },
    body: { type: 'box', layout: 'vertical', paddingAll: '20px', paddingTop: '8px', backgroundColor: C.paper, contents: body },
    styles: { header: { separator: false }, body: { separator: false } },
  }
}

const columnHead = {
  type: 'box', layout: 'horizontal', margin: 'md', contents: [
    { type: 'text', text: 'รายการ', size: 'xs', color: C.neutral, flex: 6, offsetStart: '15px' },
    { type: 'text', text: 'คงเหลือตอนนี้', size: 'xs', color: C.neutral, flex: 4, align: 'end' },
  ],
}

/**
 * @param transactions rows of stock_transactions with stock_items joined
 * @param periodTitle  e.g. "อัพเดทสต๊อกวันนี้"
 * @param dateStr      e.g. "17 พฤศจิกายน 2569"
 * @returns one LINE message (flex) ready for reply/push
 */
export function buildStockSummaryMessage(transactions: StockTx[], periodTitle: string, dateStr: string) {
  const groups = summarize(transactions)
  const all = groups.flatMap(g => g.items)

  if (all.length === 0) {
    return {
      type: 'flex',
      altText: periodTitle,
      contents: bubble(periodTitle, dateStr, [
        { type: 'text', text: 'ยังไม่มีการเคลื่อนไหวของสต็อกในช่วงนี้', size: 'sm', color: C.neutral, wrap: true, margin: 'md' },
      ]),
    }
  }

  // Overview bubble: what needs attention, then how many items moved per category
  const attention = all.filter(s => s.status !== 'ok')
  const count = (st: Status) => all.filter(s => s.status === st).length
  const overviewBody: any[] = [
    {
      type: 'box', layout: 'horizontal', margin: 'md', contents: [
        stat(String(all.length), 'ทั้งหมด', C.ink),
        stat(String(count('out')), 'หมด', C.out),
        stat(String(count('low')), 'เหลือน้อย', C.crit),
        stat(String(count('reorder')), 'ควรสั่ง', C.warn),
      ],
    },
    { type: 'separator', margin: 'lg', color: C.rule },
    { type: 'text', text: 'แยกตามหมวด', size: 'xs', color: C.neutral, margin: 'lg' },
    ...groups.map(g => ({
      type: 'box', layout: 'horizontal', margin: 'sm', contents: [
        { type: 'text', text: g.label, size: 'sm', color: C.ink, flex: 7 },
        { type: 'text', text: `${g.items.length} รายการ`, size: 'sm', color: C.neutral, align: 'end', flex: 3 },
      ],
    })),
  ]
  if (attention.length) {
    overviewBody.push(
      { type: 'separator', margin: 'lg', color: C.rule },
      { type: 'text', text: 'ต้องดูแล', size: 'xs', weight: 'bold', color: C.plum, margin: 'lg' },
      ...attention.slice(0, 10).map(s => itemRow(s)),
    )
    if (attention.length > 10) overviewBody.push({ type: 'text', text: `และอีก ${attention.length - 10} รายการ`, size: 'xs', color: C.neutral, margin: 'md' })
  }

  const bubbles: any[] = [bubble(periodTitle, dateStr, overviewBody, 'STOCK SUMMARY')]

  for (const g of groups) {
    const pages = Math.ceil(g.items.length / ITEMS_PER_BUBBLE)
    for (let p = 0; p < pages; p++) {
      const slice = g.items.slice(p * ITEMS_PER_BUBBLE, (p + 1) * ITEMS_PER_BUBBLE)
      const title = pages > 1 ? `${g.label} (${p + 1}/${pages})` : g.label
      bubbles.push(bubble(title, `${g.items.length} รายการ, ${dateStr}`, [columnHead, { type: 'separator', margin: 'sm', color: C.rule }, ...slice.map(s => itemRow(s))], 'STOCK'))
    }
  }

  // LINE limits: 12 bubbles per carousel, ~50 KB per message
  let shown = bubbles.slice(0, MAX_BUBBLES)
  const size = (b: any[]) => new TextEncoder().encode(JSON.stringify({ type: 'carousel', contents: b })).length
  while (shown.length > 1 && size(shown) > 49000) shown = shown.slice(0, -1)
  if (shown.length < bubbles.length) {
    shown[shown.length - 1].body.contents.push(
      { type: 'separator', margin: 'lg', color: C.rule },
      { type: 'text', text: `แสดง ${shown.length} จาก ${bubbles.length} หน้า (ข้อจำกัดของ LINE) ดูทั้งหมดได้ในหน้าสต็อกบนเว็บ`, size: 'xs', color: C.neutral, wrap: true, margin: 'md' },
    )
  }

  return {
    type: 'flex',
    altText: `${periodTitle}, ${all.length} รายการ${attention.length ? `, ต้องดูแล ${attention.length}` : ''}`.slice(0, 400),
    contents: { type: 'carousel', contents: shown },
  }
}

function stat(value: string, label: string, color: string) {
  return {
    type: 'box', layout: 'vertical', flex: 1, contents: [
      { type: 'text', text: value, size: 'xl', weight: 'bold', color, align: 'center' },
      { type: 'text', text: label, size: 'xs', color: C.neutral, align: 'center', margin: 'xs' },
    ],
  }
}

export type RestockItem = NonNullable<StockTx['stock_items']>

/**
 * Shopping list for stbuy / stbuyback: items that are out, low or at the reorder point,
 * grouped by category like the stock summary, most urgent first.
 */
export function buildRestockMessage(items: RestockItem[], periodTitle: string, dateStr: string) {
  const need = (items || []).filter(it => stockStatus(it) !== 'ok')
  if (need.length === 0) {
    return {
      type: 'flex',
      altText: `${periodTitle}, ไม่มีของต้องซื้อ`,
      contents: bubble(periodTitle, dateStr, [
        { type: 'text', text: 'ไม่มีของต้องซื้อ ทุกรายการยังอยู่เหนือจุดสั่ง', size: 'sm', color: C.ink, wrap: true, margin: 'md' },
      ], 'RESTOCK'),
    }
  }

  // Reuse summarize() so grouping and ordering match the stock summary exactly
  const groups = summarize(need.map(it => ({ quantity_change: 0, transaction_type: 'restock', stock_items: it })))
  const all = groups.flatMap(g => g.items)
  const byKey = new Map(need.map(it => [String(it.id || it.name || ''), it]))
  const detail = (s: ItemSummary) => {
    const it = byKey.get(s.key)
    const reorder = Number(it?.reorder_point) || 0
    const min = Number(it?.min_stock_threshold) || 0
    if (reorder > 0) return `จุดสั่ง ${remainingText(reorder, s.units)}`
    if (min > 0) return `ขั้นต่ำ ${remainingText(min, s.units)}`
    return 'ยังไม่ได้ตั้งจุดสั่ง'
  }
  const count = (st: Status) => all.filter(s => s.status === st).length

  const bubbles: any[] = []
  for (const g of groups) {
    const pages = Math.ceil(g.items.length / ITEMS_PER_BUBBLE)
    for (let p = 0; p < pages; p++) {
      const slice = g.items.slice(p * ITEMS_PER_BUBBLE, (p + 1) * ITEMS_PER_BUBBLE)
      const title = pages > 1 ? `${g.label} (${p + 1}/${pages})` : g.label
      const body: any[] = []
      if (bubbles.length === 0) {
        body.push(
          {
            type: 'box', layout: 'horizontal', margin: 'md', contents: [
              stat(String(count('out')), 'หมด', C.out),
              stat(String(count('low')), 'เหลือน้อย', C.crit),
              stat(String(count('reorder')), 'ควรสั่ง', C.warn),
            ],
          },
          { type: 'separator', margin: 'lg', color: C.rule },
        )
      }
      body.push(columnHead, { type: 'separator', margin: 'sm', color: C.rule }, ...slice.map(s => itemRow(s, detail(s))))
      bubbles.push(bubble(title, `${periodTitle}, ${dateStr}`, body, 'RESTOCK'))
    }
  }

  let shown = bubbles.slice(0, MAX_BUBBLES)
  const size = (b: any[]) => new TextEncoder().encode(JSON.stringify({ type: 'carousel', contents: b })).length
  while (shown.length > 1 && size(shown) > 49000) shown = shown.slice(0, -1)
  if (shown.length < bubbles.length) {
    shown[shown.length - 1].body.contents.push(
      { type: 'separator', margin: 'lg', color: C.rule },
      { type: 'text', text: `แสดง ${shown.length} จาก ${bubbles.length} หน้า (ข้อจำกัดของ LINE) ดูทั้งหมดได้ในหน้าสต็อกบนเว็บ`, size: 'xs', color: C.neutral, wrap: true, margin: 'md' },
    )
  }

  return {
    type: 'flex',
    altText: `${periodTitle}, ต้องซื้อ ${all.length} รายการ`.slice(0, 400),
    contents: shown.length === 1 ? shown[0] : { type: 'carousel', contents: shown },
  }
}
