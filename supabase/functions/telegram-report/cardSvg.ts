// Brand v2 ("Thai Twist Modern") SVG card templates for Telegram push notifications.
// Pure module (imports only textFormat + embedded cream wordmark) so both Deno and Vitest load it directly.
//
// Palette mirrors .agents/AGENTS.md:
//   Plum #41032A · Plum-2 #571C3E · Plum-3 #6E3855 · On-Plum-2 #D0B5C1
//   Charcoal #1A1A1A · Cream #F6F2EA · Paper-2 #ECE4E7 · Rule #D4CBCF
//   Muted #524A4E · Neutral #635B5F · Error Red #B42318

import { escXml, truncateVisual, wrapVisual } from './textFormat.ts'
import { WORDMARK_CREAM_URI } from './wordmarkData.ts'

export const BRAND = Object.freeze({
  plum: '#41032A',
  plum2: '#571C3E',
  plum3: '#6E3855',
  onPlum2: '#D0B5C1',
  charcoal: '#1A1A1A',
  cream: '#F6F2EA',
  paper2: '#ECE4E7',
  paper3: '#E3D9DE',
  rule: '#D4CBCF',
  muted: '#524A4E',
  neutral: '#635B5F',
  errorRed: '#B42318',
})

const FONT_THAI = 'IBM Plex Sans Thai'
const FONT_MONO = 'DM Mono, IBM Plex Sans Thai'
const HAS_THAI_RE = /[\u0E00-\u0E7F]/

// resvg/usvg decomposes Thai SARA AM (U+0E33) during GSUB without expanding advance width;
// pre-decomposing into canonical NIKHAHIT (U+0E4D) + optional tone mark + SARA AA (U+0E32)
// gives pixel-accurate Thai shaping and kerning in IBM Plex Sans Thai.
export const normalizeThaiForSvg = (s: string) =>
  s.replace(/([\u0E48-\u0E4B]?)\u0E33/g, '\u0E4D$1\u0E32')

const W = 720
const PAD_X = 36
const CONTENT_W = W - PAD_X * 2 // 648

export type KpiCell = {
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'plum' | 'error'
}

export type TableRow = {
  left: string
  subLeft?: string
  mid?: string
  right: string
  rightTone?: 'default' | 'plum' | 'error' | 'muted'
  bold?: boolean
  strikethrough?: boolean
}

class CardBuilder {
  parts: string[] = []
  y = 0

  rect(x: number, y: number, w: number, h: number, fill: string) {
    this.parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`)
  }

  line(x1: number, y1: number, x2: number, y2: number, stroke = BRAND.rule, width = 1) {
    this.parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}"/>`)
  }

  text(
    x: number,
    y: number,
    content: string,
    opts: {
      size?: number
      weight?: 400 | 600 | 700
      fill?: string
      anchor?: 'start' | 'middle' | 'end'
      mono?: boolean
      tracking?: number
      strikethrough?: boolean
    } = {},
  ) {
    const useMono = Boolean(opts.mono) && !HAS_THAI_RE.test(content)
    const family = useMono ? FONT_MONO : FONT_THAI
    const size = opts.size ?? 16
    const weight = opts.weight ?? 400
    const fill = opts.fill ?? BRAND.charcoal
    const anchor = opts.anchor ?? 'start'
    const tracking = opts.tracking ? ` letter-spacing="${opts.tracking}"` : ''
    const deco = opts.strikethrough ? ' text-decoration="line-through"' : ''
    this.parts.push(
      `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${tracking}${deco}>${escXml(normalizeThaiForSvg(content))}</text>`,
    )
  }

  /** Signature Plum header with cream ในบ้าน wordmark, category tag, upright Thai title, and optional right hero figure. */
  header(opts: {
    tag: string
    title: string
    subtitle?: string
    heroValue?: string
    heroLabel?: string
    rightTag?: string
  }) {
    const hasHero = Boolean(opts.heroValue)
    const hasSub = Boolean(opts.subtitle)
    const titleMaxCols = hasHero ? 20 : 32
    const titleText = truncateVisual(opts.title, titleMaxCols)

    const topBarH = 66
    const bodyH = hasSub ? 92 : 68
    const totalH = topBarH + bodyH

    this.rect(0, this.y, W, totalH, BRAND.plum)

    // Top brand row: cream ในบ้าน wordmark (175x96 -> 58x32) + uppercase mono tag
    const wmY = this.y + 17
    this.parts.push(`<image x="${PAD_X}" y="${wmY}" width="58" height="32" href="${WORDMARK_CREAM_URI}"/>`)

    const rightMeta = opts.rightTag ? `${opts.tag}  ·  ${opts.rightTag}` : opts.tag
    this.text(W - PAD_X, this.y + 39, rightMeta, {
      size: 13,
      weight: 400,
      fill: BRAND.onPlum2,
      anchor: 'end',
      mono: true,
      tracking: 1.4,
    })

    // Hairline divider inside plum header
    this.line(PAD_X, this.y + topBarH, W - PAD_X, this.y + topBarH, BRAND.plum3, 1)

    // Title & optional subtitle
    const titleY = this.y + topBarH + 40
    this.text(PAD_X, titleY, titleText, {
      size: 25,
      weight: 700,
      fill: BRAND.cream,
    })
    if (opts.subtitle) {
      this.text(PAD_X, titleY + 29, truncateVisual(opts.subtitle, hasHero ? 30 : 48), {
        size: 15,
        weight: 400,
        fill: BRAND.onPlum2,
      })
    }

    // Optional right-aligned hero metric
    if (opts.heroValue) {
      const heroSize = opts.heroValue.length > 10 ? 28 : 34
      const heroY = opts.heroLabel ? this.y + topBarH + 44 : this.y + topBarH + (hasSub ? 56 : 45)
      this.text(W - PAD_X, heroY, opts.heroValue, {
        size: heroSize,
        weight: 700,
        fill: BRAND.cream,
        anchor: 'end',
        mono: true,
      })
      if (opts.heroLabel) {
        this.text(W - PAD_X, heroY + 24, opts.heroLabel, {
          size: 13,
          weight: 400,
          fill: BRAND.onPlum2,
          anchor: 'end',
        })
      }
    }

    this.y += totalH
  }

  /** Full-bleed status banner directly under the plum header (used for action-needed states like รอตรวจสลิป). */
  statusBanner(label: string, detail?: string, tone: 'plum' | 'error' | 'calm' = 'plum') {
    const bg = tone === 'plum' ? BRAND.plum2 : BRAND.paper2
    const fg = tone === 'plum' ? BRAND.cream : (tone === 'error' ? BRAND.errorRed : BRAND.charcoal)
    const subFg = tone === 'plum' ? BRAND.onPlum2 : BRAND.muted
    const h = 48

    this.rect(0, this.y, W, h, bg)
    if (tone !== 'plum') {
      this.rect(0, this.y, 5, h, tone === 'error' ? BRAND.errorRed : BRAND.charcoal)
      this.line(0, this.y + h, W, this.y + h, BRAND.rule, 1)
    }
    this.text(PAD_X, this.y + 30, label, { size: 16, weight: 700, fill: fg })
    if (detail) {
      this.text(W - PAD_X, this.y + 30, truncateVisual(detail, 32), {
        size: 15,
        weight: tone === 'error' ? 700 : 400,
        fill: tone === 'error' ? BRAND.errorRed : subFg,
        anchor: 'end',
        mono: /[฿0-9]/.test(detail),
      })
    }
    this.y += h
  }

  /** Neo-brutalist cellular KPI strip (2 or 3 equal columns with 1px solid dividers). */
  kpiStrip(cells: KpiCell[]) {
    if (!cells.length) return
    const hasSub = cells.some((c) => Boolean(c.sub))
    const h = hasSub ? 96 : 78
    const colW = W / cells.length

    this.rect(0, this.y, W, h, BRAND.paper2)
    this.line(0, this.y + h, W, this.y + h, BRAND.rule, 1)

    cells.forEach((cell, idx) => {
      const x0 = Math.round(idx * colW)
      if (idx > 0) this.line(x0, this.y, x0, this.y + h, BRAND.rule, 1)
      const tx = x0 + (idx === 0 ? PAD_X : 24)
      const valColor =
        cell.tone === 'error' ? BRAND.errorRed :
        cell.tone === 'plum' ? BRAND.plum : BRAND.charcoal

      this.text(tx, this.y + 27, truncateVisual(cell.label, 20), {
        size: 13,
        weight: 400,
        fill: BRAND.neutral,
      })
      this.text(tx, this.y + 58, truncateVisual(cell.value, 16), {
        size: 22,
        weight: 700,
        fill: valColor,
        mono: /^[฿+\-−0-9.,%\s]+$/.test(cell.value),
      })
      if (cell.sub) {
        this.text(tx, this.y + 81, truncateVisual(cell.sub, 22), {
          size: 13,
          weight: 400,
          fill: cell.tone === 'error' ? BRAND.errorRed : BRAND.muted,
        })
      }
    })

    this.y += h
  }

  /** Left-accented callout block (used for ต้องตรวจ / customer notes / empty state). */
  callout(title: string, lines: string[], tone: 'error' | 'plum' | 'calm' = 'calm') {
    if (!lines.length) return
    this.y += 20
    const wrapped: string[] = []
    for (const l of lines) wrapped.push(...wrapVisual(l, 52, 2))

    const barColor =
      tone === 'error' ? BRAND.errorRed :
      tone === 'plum' ? BRAND.plum : BRAND.charcoal
    const titleColor =
      tone === 'error' ? BRAND.errorRed :
      tone === 'plum' ? BRAND.plum : BRAND.charcoal

    const headerOffset = title ? 32 : 8
    const lineH = 26
    const h = headerOffset + wrapped.length * lineH + 14

    this.rect(PAD_X, this.y, CONTENT_W, h, BRAND.paper2)
    this.rect(PAD_X, this.y, 4, h, barColor)

    let cy = this.y + 26
    if (title) {
      this.text(PAD_X + 18, cy, title, { size: 15, weight: 700, fill: titleColor })
      cy += 26
    } else {
      cy = this.y + 28
    }
    for (const line of wrapped) {
      this.text(PAD_X + 18, cy, line, { size: 15, weight: 400, fill: BRAND.charcoal })
      cy += lineH
    }
    this.y += h
  }

  /** Section heading with crisp 1.5px charcoal rule and tabular rows separated by 1px rules. */
  tableSection(title: string, rows: TableRow[], opts: { rightMeta?: string; footerNote?: string } = {}) {
    if (!rows.length) return
    this.y += 26

    // Section header
    this.text(PAD_X, this.y + 15, title, { size: 14, weight: 700, fill: BRAND.plum })
    if (opts.rightMeta) {
      this.text(W - PAD_X, this.y + 15, opts.rightMeta, {
        size: 13,
        weight: 400,
        fill: BRAND.neutral,
        anchor: 'end',
      })
    }
    this.y += 26
    this.line(PAD_X, this.y, W - PAD_X, this.y, BRAND.charcoal, 1.5)

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const hasSub = Boolean(r.subLeft)
      const rowH = hasSub ? 60 : 44
      const textY = this.y + (hasSub ? 27 : 28)

      if (r.bold) {
        this.rect(PAD_X, this.y + 1, CONTENT_W, rowH - 1, BRAND.paper2)
      }

      const rightColor =
        r.rightTone === 'error' ? BRAND.errorRed :
        r.rightTone === 'plum' ? BRAND.plum :
        r.rightTone === 'muted' ? BRAND.muted : BRAND.charcoal

      const hasMid = Boolean(r.mid)
      const leftMaxCols = hasMid ? 24 : 34
      this.text(PAD_X + (r.bold ? 10 : 0), textY, truncateVisual(r.left, leftMaxCols), {
        size: 16,
        weight: r.bold ? 700 : 400,
        fill: r.strikethrough ? BRAND.neutral : BRAND.charcoal,
        strikethrough: r.strikethrough,
      })

      if (r.subLeft) {
        this.text(PAD_X + (r.bold ? 10 : 0), textY + 21, truncateVisual(r.subLeft, 42), {
          size: 13,
          weight: 400,
          fill: BRAND.neutral,
        })
      }

      if (r.mid) {
        this.text(W - PAD_X - 154, textY, truncateVisual(r.mid, 18), {
          size: 14,
          weight: 400,
          fill: BRAND.muted,
          anchor: 'end',
        })
      }

      if (r.right) {
        this.text(W - PAD_X - (r.bold ? 10 : 0), textY, truncateVisual(r.right, 18), {
          size: 16,
          weight: r.bold ? 700 : 600,
          fill: rightColor,
          anchor: 'end',
          mono: true,
        })
      }

      this.y += rowH
      if (i < rows.length - 1) {
        this.line(PAD_X, this.y, W - PAD_X, this.y, BRAND.rule, 1)
      }
    }

    if (opts.footerNote) {
      this.line(PAD_X, this.y, W - PAD_X, this.y, BRAND.rule, 1)
      this.text(PAD_X, this.y + 24, opts.footerNote, { size: 13, weight: 400, fill: BRAND.neutral })
      this.y += 34
    }
  }

  /** Key-value metadata block (2-column label/value grid like _orderFlex.js). */
  kvSection(title: string, rows: Array<{ label: string; value: string; bold?: boolean; tone?: 'default' | 'plum' | 'error' }>) {
    const clean = rows.filter((r) => r.value && r.value.trim() !== '')
    if (!clean.length) return
    this.y += 24

    if (title) {
      this.text(PAD_X, this.y + 15, title, { size: 14, weight: 700, fill: BRAND.plum })
      this.y += 26
      this.line(PAD_X, this.y, W - PAD_X, this.y, BRAND.charcoal, 1.5)
    } else {
      this.line(PAD_X, this.y, W - PAD_X, this.y, BRAND.rule, 1)
    }

    const labelW = 148
    for (let i = 0; i < clean.length; i++) {
      const r = clean[i]
      const wrapped = wrapVisual(r.value, 36, 3)
      const rowH = Math.max(42, wrapped.length * 24 + 18)
      const valColor =
        r.tone === 'error' ? BRAND.errorRed :
        r.tone === 'plum' ? BRAND.plum : BRAND.charcoal

      this.text(PAD_X, this.y + 27, truncateVisual(r.label, 14), {
        size: 14,
        weight: 400,
        fill: BRAND.neutral,
      })

      wrapped.forEach((line, li) => {
        this.text(PAD_X + labelW, this.y + 27 + li * 24, line, {
          size: 16,
          weight: r.bold ? 700 : 400,
          fill: valColor,
        })
      })

      this.y += rowH
      if (i < clean.length - 1) {
        this.line(PAD_X, this.y, W - PAD_X, this.y, BRAND.rule, 1)
      }
    }
  }

  /** Bold total bar at the bottom of order / shift cards. */
  totalBar(label: string, value: string, subLines: Array<{ label: string; value: string }> = []) {
    this.y += 22
    const subH = subLines.length * 28
    const mainH = 62
    const totalH = subH + mainH + (subLines.length ? 12 : 0)

    this.rect(0, this.y, W, totalH, BRAND.paper2)
    this.line(0, this.y, W, this.y, BRAND.charcoal, 1.5)

    let cy = this.y
    if (subLines.length) {
      cy += 26
      for (const s of subLines) {
        this.text(PAD_X, cy, s.label, { size: 14, weight: 400, fill: BRAND.muted })
        this.text(W - PAD_X, cy, s.value, { size: 15, weight: 400, fill: BRAND.charcoal, anchor: 'end', mono: true })
        cy += 28
      }
      this.line(PAD_X, cy - 10, W - PAD_X, cy - 10, BRAND.rule, 1)
      cy += 26
    } else {
      cy += 39
    }

    this.text(PAD_X, cy, label, { size: 18, weight: 700, fill: BRAND.charcoal })
    this.text(W - PAD_X, cy + 2, value, { size: 28, weight: 700, fill: BRAND.plum, anchor: 'end', mono: true })

    this.y += totalH
  }

  /** Architectural footer line. */
  footer(leftText: string, rightText?: string) {
    this.y += 24
    const h = 48
    this.line(0, this.y, W, this.y, BRAND.rule, 1)
    this.text(PAD_X, this.y + 29, truncateVisual(leftText, 40), {
      size: 13,
      weight: 400,
      fill: BRAND.neutral,
    })
    if (rightText) {
      this.text(W - PAD_X, this.y + 29, truncateVisual(rightText, 30), {
        size: 12,
        weight: 400,
        fill: BRAND.neutral,
        anchor: 'end',
        mono: true,
      })
    }
    this.y += h
  }

  build(): string {
    const H = Math.max(160, Math.ceil(this.y))
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
      `<rect x="0" y="0" width="${W}" height="${H}" fill="${BRAND.cream}"/>`,
      ...this.parts,
      `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="none" stroke="${BRAND.rule}" stroke-width="1"/>`,
      `</svg>`,
    ].join('')
  }
}

// ── 1. Daily Summary Card ────────────────────────────────────────────────────

export type DailySummaryCardData = {
  title: string
  revenueText: string
  paidCount: number
  avgPerBillText: string
  pax: number
  gpText?: string
  discountText?: string
  attention: string[]
  byMethod: Array<{ label: string; count: number; amountText: string }>
  byChannel: Array<{ label: string; count: number; amountText: string }>
  topItems: Array<{ rank: number; name: string; qty: number; amountText: string }>
  floorMeta: string
  periodText: string
}

export function renderDailySummaryCardSvg(d: DailySummaryCardData): string {
  const c = new CardBuilder()
  c.header({
    tag: 'DAILY SUMMARY',
    title: d.title,
    subtitle: [d.gpText, d.discountText].filter(Boolean).join('  ·  ') || 'สรุปยอดขายประจำวัน',
    heroValue: d.revenueText,
    heroLabel: 'ยอดขายสุทธิ',
  })

  c.kpiStrip([
    { label: 'บิลชำระแล้ว', value: `${d.paidCount} บิล` },
    { label: 'เฉลี่ยต่อบิล', value: d.avgPerBillText },
    { label: 'จำนวนลูกค้า', value: `${d.pax} ท่าน` },
  ])

  if (d.attention.length) {
    c.callout('ต้องตรวจสอบ', d.attention, 'error')
  }

  if (d.byMethod.length) {
    c.tableSection(
      'ช่องทางชำระเงิน',
      d.byMethod.map((m) => ({
        left: m.label,
        mid: `${m.count} บิล`,
        right: m.amountText,
      })),
    )
  }

  if (d.byChannel.length) {
    c.tableSection(
      'ช่องทางการขาย',
      d.byChannel.map((ch) => ({
        left: ch.label,
        mid: `${ch.count} บิล`,
        right: ch.amountText,
      })),
    )
  }

  if (d.topItems.length) {
    c.tableSection(
      'เมนูขายดี 5 อันดับ',
      d.topItems.map((it) => ({
        left: `${String(it.rank).padStart(2, '0')}  ${it.name}`,
        mid: `×${it.qty}`,
        right: it.amountText,
      })),
    )
  }

  c.footer(d.floorMeta, d.periodText)
  return c.build()
}

// ── 2. Shift Close Card ──────────────────────────────────────────────────────

export type ShiftCloseCardData = {
  staffName: string
  timeRange: string
  totalSalesText: string
  cashSalesText: string
  qrSalesText: string
  openingFloatText: string
  expectedCashText: string
  closedCashText: string
  diff: number
  diffText: string
  stockCountText?: string | null
  stockCounted?: boolean
}

export function renderShiftCloseCardSvg(d: ShiftCloseCardData): string {
  const c = new CardBuilder()
  c.header({
    tag: 'SHIFT CLOSE',
    title: `ปิดรอบ · ${d.staffName}`,
    subtitle: d.timeRange,
    heroValue: d.totalSalesText,
    heroLabel: 'ยอดขายรวมรอบนี้',
  })

  if (d.diff === 0) {
    c.statusBanner('เงินสดตรงตามยอดระบบ', 'ส่วนต่าง ฿0', 'calm')
  } else {
    c.statusBanner('พบส่วนต่างเงินสดในลิ้นชัก', d.diffText, 'error')
  }

  c.tableSection('สรุปยอดและเงินสดในลิ้นชัก', [
    { left: 'ยอดขายเงินสด', right: d.cashSalesText },
    { left: 'ยอดขาย QR / โอน', right: d.qrSalesText },
    { left: 'เงินทอนตั้งต้น', right: d.openingFloatText },
    { left: 'เงินสดที่ควรมีในลิ้นชัก', right: d.expectedCashText },
    { left: 'เงินสดที่นับได้จริง', right: d.closedCashText, bold: true, rightTone: d.diff === 0 ? 'default' : 'error' },
  ])

  if (d.stockCountText) {
    c.callout(
      'สถานะนับสต๊อกปิดร้าน',
      [d.stockCountText],
      d.stockCounted ? 'calm' : 'plum',
    )
  }

  c.footer('IN THE HAUS · SHIFT LEDGER', d.timeRange)
  return c.build()
}

// ── 3. Stock Closing Card ────────────────────────────────────────────────────

export type StockClosingCardData = {
  title: string
  subtitle: string
  countedCount: number
  abnormalCount: number
  shortText?: string
  reorderCount: number
  abnormalRows: Array<{ name: string; diffText: string; valueText?: string; isShort: boolean }>
  abnormalOverflow: number
  reorderRows: Array<{ name: string; leftText: string; pointText: string }>
  reorderOverflow: number
}

export function renderStockClosingCardSvg(d: StockClosingCardData): string {
  const c = new CardBuilder()
  c.header({
    tag: 'STOCK CLOSING',
    title: d.title,
    subtitle: d.subtitle,
  })

  c.kpiStrip([
    { label: 'นับสต๊อกแล้ว', value: `${d.countedCount} รายการ` },
    {
      label: 'ยอดผิดปกติ',
      value: `${d.abnormalCount} รายการ`,
      sub: d.shortText || undefined,
      tone: d.abnormalCount > 0 ? 'error' : 'default',
    },
    {
      label: 'ถึงจุดสั่งซื้อ',
      value: `${d.reorderCount} รายการ`,
      tone: d.reorderCount > 0 ? 'plum' : 'default',
    },
  ])

  if (d.abnormalRows.length) {
    c.tableSection(
      'รายการผลต่างผิดปกติ',
      d.abnormalRows.map((r) => ({
        left: r.name,
        mid: r.valueText ? r.diffText : undefined,
        right: r.valueText || r.diffText,
        rightTone: r.isShort ? 'error' : 'plum',
      })),
      {
        rightMeta: d.shortText || `${d.abnormalCount} รายการ`,
        footerNote: d.abnormalOverflow > 0 ? `และอีก ${d.abnormalOverflow} รายการ — ดูทั้งหมดใน Stock Recon` : undefined,
      },
    )
  }

  if (d.reorderRows.length) {
    c.tableSection(
      'รายการที่ต้องสั่งซื้อ',
      d.reorderRows.map((r) => ({
        left: r.name,
        mid: `เหลือ ${r.leftText}`,
        right: `สั่งที่ ${r.pointText}`,
        rightTone: 'plum',
      })),
      {
        rightMeta: `${d.reorderCount} รายการ`,
        footerNote: d.reorderOverflow > 0 ? `และอีก ${d.reorderOverflow} รายการ — ดูทั้งหมดในคลังสต๊อก` : undefined,
      },
    )
  }

  if (!d.abnormalRows.length && !d.reorderRows.length) {
    c.callout(
      'สถานะคลังสินค้า',
      [d.countedCount > 0 ? 'ไม่มีรายการผิดปกติ และสต๊อกทุกรายการอยู่ในเกณฑ์ปกติ' : 'ยังไม่มีรายการผลต่างในรอบนี้'],
      'calm',
    )
  }

  c.footer('ดูรายละเอียด: Admin · Stock Recon', 'STOCK AUDIT')
  return c.build()
}

// ── 4. Online Order / Booking Card ───────────────────────────────────────────

export type OnlineOrderCardData = {
  tag: string
  bookingRef: string
  title: string
  subtitle?: string
  statusBanner?: { label: string; detail?: string; tone: 'plum' | 'error' | 'calm' }
  infoRows: Array<{ label: string; value: string; bold?: boolean }>
  note?: string
  items: Array<{ qty: number; name: string; options?: string; priceText: string; voided?: boolean }>
  itemsOverflow?: number
  totalLabel: string
  totalText: string
  subTotals?: Array<{ label: string; value: string }>
  timestampText: string
}

export function renderOnlineOrderCardSvg(d: OnlineOrderCardData): string {
  const c = new CardBuilder()
  c.header({
    tag: d.tag,
    rightTag: d.bookingRef,
    title: d.title,
    subtitle: d.subtitle,
  })

  if (d.statusBanner) {
    c.statusBanner(d.statusBanner.label, d.statusBanner.detail, d.statusBanner.tone)
  }

  c.kvSection('รายละเอียดลูกค้า', d.infoRows)

  if (d.note) {
    c.callout('หมายเหตุจากลูกค้า', [d.note], 'plum')
  }

  if (d.items.length) {
    c.tableSection(
      'รายการที่สั่ง',
      d.items.map((it) => ({
        left: `${it.qty}×  ${it.name}`,
        subLeft: it.options || undefined,
        right: it.voided ? 'ยกเลิก' : it.priceText,
        rightTone: it.voided ? 'muted' : 'default',
        strikethrough: it.voided,
      })),
      {
        rightMeta: `${d.items.reduce((s, i) => s + (i.voided ? 0 : i.qty), 0)} รายการ`,
        footerNote: d.itemsOverflow && d.itemsOverflow > 0 ? `และอีก ${d.itemsOverflow} รายการ` : undefined,
      },
    )
  }

  if (d.totalText) {
    c.totalBar(d.totalLabel, d.totalText, d.subTotals || [])
  }

  c.footer('IN THE HAUS · ONLINE CHANNEL', d.timestampText)
  return c.build()
}

// ── 5. Connection Test Card ──────────────────────────────────────────────────

export function renderTestCardSvg(timestampText: string): string {
  const c = new CardBuilder()
  c.header({
    tag: 'TELEGRAM REPORTS',
    title: 'เชื่อมต่อระบบรายงานแล้ว',
    subtitle: 'พร้อมส่งการ์ดสรุปยอด ปิดรอบ ปิดสต๊อก และออเดอร์ออนไลน์',
  })
  c.kpiStrip([
    { label: 'รูปแบบหลัก', value: 'Brand v2 Card' },
    { label: 'เหตุการณ์หน้าร้าน', value: 'HTML ตารางตรง' },
    { label: 'เวลาทดสอบ', value: timestampText.slice(-5) || '-' },
  ])
  c.footer('IN THE HAUS · NAKHON PHANOM', timestampText)
  return c.build()
}
