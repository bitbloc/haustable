// Brand v2 colours for LINE Flex messages.
// Flex only takes hex, so these mirror the hex column of .agents/AGENTS.md §2
// (the OKLCH values in src/index.css are the same colours). Change AGENTS.md first.
//
// Rules carried over from AGENTS.md:
// - plum is the signature (headers, highlights); charcoal is ink and the one primary action
// - red only for errors and destructive states (void, cancelled, failed)
// - no green, orange or neon accents; no pure white or black
export const BRAND = {
  plum: '#41032A',
  plum2: '#571C3E',
  plum3: '#6E3855',
  onPlum2: '#D0B5C1', // secondary text on plum
  charcoal: '#1A1A1A', // ink on light surfaces, primary action fill
  charcoal2: '#292527',
  cream: '#F6F2EA', // light surface, text on plum / charcoal
  paper2: '#ECE4E7', // raised light surface
  paper3: '#E3D9DE',
  rule: '#D4CBCF', // 1px dividers on light surfaces
  neutral: '#635B5F', // labels, helper text (5.89:1 on cream)
  muted: '#524A4E', // secondary text (7.68:1 on cream)
  darkMuted: '#BEB4B9',
  errorRed: '#B42318', // errors and destructive only
} as const

// Shop logo (hangout_inthehaus wordmark), small in the top corner of every Flex header.
// Cream on plum / charcoal headers, plum on light headers. Hosted in the public-assets
// bucket because LINE needs an https PNG (it cannot show SVG).
const LOGO_BASE = 'https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/public-assets/brand'
export const LOGO_URL = { cream: `${LOGO_BASE}/line-logo-cream.png`, plum: `${LOGO_BASE}/line-logo-plum.png` } as const
const LOGO_RATIO = '360:82'

function isDarkHex(hex: unknown): boolean {
  const m = /^#?([0-9a-f]{6})/i.exec(String(hex || ''))
  if (!m) return false
  const n = parseInt(m[1], 16)
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
  return lum < 0.5
}

// deno-lint-ignore no-explicit-any
function logoBubble(bubble: any): any {
  const header = bubble?.header
  if (!header || header.type !== 'box' || !Array.isArray(header.contents)) return bubble
  if (JSON.stringify(header).includes(LOGO_BASE)) return bubble
  const url = isDarkHex(header.backgroundColor) ? LOGO_URL.cream : LOGO_URL.plum
  const logo = { type: 'image', url, size: '56px', aspectRatio: LOGO_RATIO, aspectMode: 'fit', flex: 0, gravity: 'center' }
  // The logo sits on the title's row, right-aligned, so both share one line of the grid.
  if (header.layout !== 'vertical') {
    return { ...bubble, header: { ...header, contents: [...header.contents, logo] } }
  }
  const [first, ...rest] = header.contents
  let titleRow
  if (first?.type === 'box' && first.layout === 'horizontal') {
    titleRow = { ...first, contents: [...first.contents, logo] }
  } else if (first) {
    const { margin, ...firstNoMargin } = first
    titleRow = { type: 'box', layout: 'horizontal', spacing: 'md', ...(margin ? { margin } : {}),
      contents: [{ ...firstNoMargin, flex: 1, gravity: 'center' }, logo] }
  } else {
    titleRow = { type: 'box', layout: 'horizontal', contents: [{ type: 'filler' }, logo] }
  }
  return { ...bubble, header: { ...header, contents: [titleRow, ...rest] } }
}

// Adds the logo to every Flex bubble (and carousel bubble) in a LINE reply/push body.
// deno-lint-ignore no-explicit-any
export function withShopLogo(body: any): any {
  if (!body || !Array.isArray(body.messages)) return body
  return {
    ...body,
    // deno-lint-ignore no-explicit-any
    messages: body.messages.map((m: any) => {
      if (m?.type !== 'flex' || !m.contents) return m
      const c = m.contents
      if (c.type === 'bubble') return { ...m, contents: logoBubble(c) }
      if (c.type === 'carousel' && Array.isArray(c.contents)) return { ...m, contents: { ...c, contents: c.contents.map(logoBubble) } }
      return m
    }),
  }
}

// Wraps fetch so every message sent to the LINE Messaging API carries the logo.
// If LINE rejects the decorated body (400), the original body is sent unchanged,
// so the logo can never stop a reply from arriving.
export function installShopLogoOnLineMessages() {
  // deno-lint-ignore no-explicit-any
  const g = globalThis as any
  if (g.__shopLogoInstalled) return
  g.__shopLogoInstalled = true
  const baseFetch = g.fetch.bind(globalThis)
  g.fetch = async (input: Request | URL | string, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!/^https:\/\/api\.line\.me\/v2\/bot\/message\/(reply|push|multicast|broadcast)/.test(url) || typeof init?.body !== 'string') {
      return baseFetch(input, init)
    }
    let decorated: string | null = null
    try {
      const next = JSON.stringify(withShopLogo(JSON.parse(init.body)))
      if (next !== init.body) decorated = next
    } catch { /* not JSON: send as is */ }
    if (!decorated) return baseFetch(input, init)
    const resp = await baseFetch(input, { ...init, body: decorated })
    if (resp.status !== 400) return resp
    console.warn('[shop logo] LINE rejected decorated message, resending without logo')
    return baseFetch(input, init)
  }
}
