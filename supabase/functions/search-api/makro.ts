// Parse makro.pro search results.
// The search page is rendered by Next.js and carries the results as JSON in
// <script id="__NEXT_DATA__"> (props.pageProps.initialSearchResult.hits[].document).
// Kept free of Deno APIs so it can be unit tested with vitest.

export type MakroProduct = {
  id: string
  title: string
  titleEn: string
  brand: string
  price: number
  originalPrice: number | null
  unitSize: string
  inStock: boolean
  image: string | null
  url: string
}

export const makroSearchUrl = (keyword: string) =>
  `https://www.makro.pro/c/search?q=${encodeURIComponent(keyword.trim())}`

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Pull the __NEXT_DATA__ JSON out of the page HTML. Returns null if missing or broken. */
export const extractNextData = (html: string): any | null => {
  const m = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!m) return null
  try {
    return JSON.parse(m[1])
  } catch {
    return null
  }
}

/** Products from a makro.pro search page, priced items only, in makro's order. */
export const parseMakroSearch = (html: string, limit = 20): MakroProduct[] => {
  const data = extractNextData(html)
  const hits = data?.props?.pageProps?.initialSearchResult?.hits
  if (!Array.isArray(hits)) return []
  const out: MakroProduct[] = []
  for (const hit of hits) {
    const d = hit?.document
    if (!d) continue
    const price = num(d.displayPrice)
    if (!price || !d.title) continue
    const original = num(d.originalPrice)
    const title = String(d.title).trim()
    out.push({
      id: String(d.id ?? d.productId ?? ''),
      title,
      titleEn: String(d.titleEn ?? '').trim(),
      brand: String(d.brand ?? '').trim(),
      price,
      originalPrice: original && original > price ? original : null,
      unitSize: String(d.unitSize ?? '').replace(/unit\(s\)/g, 'ชิ้น').trim(),
      inStock: Number(d.inStock) > 0,
      image: Array.isArray(d.images) && d.images[0] ? String(d.images[0]) : null,
      url: makroSearchUrl(title),
    })
    if (out.length >= limit) break
  }
  return out
}
