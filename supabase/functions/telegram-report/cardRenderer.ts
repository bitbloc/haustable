// Server-side SVG -> PNG renderer for Telegram Brand v2 cards in Deno (Supabase Edge Runtime).
// Uses @resvg/resvg-wasm (rustybuzz = full HarfBuzz Thai shaping) with Brand v2 TTF fonts
// (IBM Plex Sans Thai Regular/Bold + DM Mono Medium), cached in isolate memory after cold start.

// @ts-ignore: Deno ESM import
import { initWasm, Resvg } from 'https://esm.sh/@resvg/resvg-wasm@2.6.2'

const WASM_URLS = [
  'https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm',
  'https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm',
]

const FONT_SOURCES: string[][] = [
  [
    'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/ibmplexsansthai/IBMPlexSansThai-Regular.ttf',
    'https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexsansthai/IBMPlexSansThai-Regular.ttf',
  ],
  [
    'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/ibmplexsansthai/IBMPlexSansThai-SemiBold.ttf',
    'https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexsansthai/IBMPlexSansThai-SemiBold.ttf',
  ],
  [
    'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/ibmplexsansthai/IBMPlexSansThai-Bold.ttf',
    'https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexsansthai/IBMPlexSansThai-Bold.ttf',
  ],
  [
    'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/dmmono/DMMono-Medium.ttf',
    'https://raw.githubusercontent.com/google/fonts/main/ofl/dmmono/DMMono-Medium.ttf',
  ],
]

let initPromise: Promise<Uint8Array[]> | null = null

async function fetchWithFallback(urls: string[], timeoutMs = 8000): Promise<Uint8Array> {
  let lastErr: unknown = null
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
      return new Uint8Array(await res.arrayBuffer())
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

async function ensureReady(): Promise<Uint8Array[]> {
  if (!initPromise) {
    initPromise = (async () => {
      const [wasmBytes, ...fontBuffers] = await Promise.all([
        fetchWithFallback(WASM_URLS),
        ...FONT_SOURCES.map((urls) => fetchWithFallback(urls)),
      ])
      await initWasm(wasmBytes)
      return fontBuffers
    })().catch((err) => {
      initPromise = null
      throw err
    })
  }
  return initPromise
}

/** Render a Brand v2 SVG card string to a crisp 2x retina PNG byte buffer. */
export async function renderSvgToPng(svg: string, widthPx = 1120): Promise<Uint8Array> {
  const fontBuffers = await ensureReady()
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: widthPx },
    font: {
      fontBuffers,
      loadSystemFonts: false,
      defaultFontFamily: 'IBM Plex Sans Thai',
    },
  })
  const rendered = resvg.render()
  return rendered.asPng()
}
