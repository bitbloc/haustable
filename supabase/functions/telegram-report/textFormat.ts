// Visual Thai grapheme width + aligned monospace formatting for Telegram HTML (<pre>) and SVG text truncation.
// Pure module with zero imports so both Deno Edge Functions and Vitest can import it directly.

// Combining Thai vowels & tone marks consume zero horizontal character cells.
const THAI_COMBINING_RE = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0300-\u036F\u200B-\u200D\uFEFF]/

export function splitVisualGraphemes(input: unknown): string[] {
  const str = String(input ?? '')
  const out: string[] = []
  for (const ch of str) {
    if (THAI_COMBINING_RE.test(ch) && out.length > 0) {
      out[out.length - 1] += ch
    } else if (!THAI_COMBINING_RE.test(ch)) {
      out.push(ch)
    }
  }
  return out
}

export function visualWidth(input: unknown): number {
  return splitVisualGraphemes(input).length
}

/** Truncate cleanly on Thai grapheme boundaries so combining marks are never orphaned. */
export function truncateVisual(input: unknown, maxCols: number): string {
  const s = String(input ?? '').replace(/\s+/g, ' ').trim()
  if (maxCols <= 0) return ''
  const clusters = splitVisualGraphemes(s)
  if (clusters.length <= maxCols) return s
  if (maxCols === 1) return '…'
  return clusters.slice(0, maxCols - 1).join('') + '…'
}

export function padEndVisual(input: unknown, targetCols: number): string {
  const s = String(input ?? '')
  const w = visualWidth(s)
  return w >= targetCols ? s : s + ' '.repeat(targetCols - w)
}

export function padStartVisual(input: unknown, targetCols: number): string {
  const s = String(input ?? '')
  const w = visualWidth(s)
  return w >= targetCols ? s : ' '.repeat(targetCols - w) + s
}

/** Wrap a line into visual-width chunks without splitting Thai combining marks. */
export function wrapVisual(input: unknown, maxCols: number, maxLines = 3): string[] {
  const text = String(input ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return []
  const clusters = splitVisualGraphemes(text)
  if (clusters.length <= maxCols) return [text]
  const lines: string[] = []
  let idx = 0
  while (idx < clusters.length && lines.length < maxLines) {
    const remaining = clusters.length - idx
    if (lines.length === maxLines - 1 && remaining > maxCols) {
      lines.push(clusters.slice(idx, idx + maxCols - 1).join('').trimEnd() + '…')
      break
    }
    if (remaining <= maxCols) {
      lines.push(clusters.slice(idx).join('').trim())
      break
    }
    // Try to break at a space within the second half of the line for clean Thai/English wrapping
    let splitAt = idx + maxCols
    for (let j = idx + maxCols; j > idx + Math.floor(maxCols * 0.55); j--) {
      if (clusters[j] === ' ') {
        splitAt = j
        break
      }
    }
    lines.push(clusters.slice(idx, splitAt).join('').trim())
    idx = splitAt
    while (idx < clusters.length && clusters[idx] === ' ') idx++
  }
  return lines
}

export const escHtml = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const escXml = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

export type AlignedItemRow = {
  qty: number
  name: string
  options?: string
  priceText?: string
  voided?: boolean
}

/**
 * Crisp tabular receipt block for Telegram <pre> messages (32 visual cols fits cleanly on 375px iPhone).
 * Example:
 *   2× ผัดไทยกุ้ง               ฿240
 *      ไม่ใส่ถั่ว
 */
export function formatAlignedItemsPre(items: AlignedItemRow[], withPrice = true, totalCols = 32): string {
  const lines: string[] = []
  for (const it of items) {
    const qtyPrefix = `${Number(it.qty || 1)}× `
    const right = it.voided ? 'ยกเลิก' : (withPrice ? String(it.priceText || '') : '')
    const rightW = visualWidth(right)
    const leftMax = right ? Math.max(8, totalCols - rightW - 2) : totalCols
    const leftRaw = truncateVisual(`${qtyPrefix}${it.name}`, leftMax)
    const row = right
      ? `${padEndVisual(leftRaw, totalCols - rightW)}${right}`
      : leftRaw
    lines.push(it.voided ? `<s>${escHtml(row)}</s>` : escHtml(row))
    if (it.options) {
      const optWrapped = wrapVisual(it.options, Math.max(10, totalCols - 3), 2)
      for (const ol of optWrapped) {
        lines.push(`   ${escHtml(ol)}`)
      }
    }
  }
  return lines.join('\n')
}

export function formatAlignedKeyValuesPre(rows: Array<[string, string]>, totalCols = 32): string {
  return rows
    .map(([label, value]) => {
      const valW = visualWidth(value)
      const leftMax = Math.max(8, totalCols - valW - 2)
      const left = truncateVisual(label, leftMax)
      return escHtml(`${padEndVisual(left, totalCols - valW)}${value}`)
    })
    .join('\n')
}
