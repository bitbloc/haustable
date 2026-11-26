// Estimated AI spend: one row in public.ai_usage_log per Claude call.
//
// Anthropic bills per token; the API key cannot read the remaining balance, so the
// back office shows an estimate built from these rows. Prices are list prices per
// million tokens (Anthropic model docs, checked 2026-11-26). Change them here only.
//
// Rows from Yuzu (inthehaus-hr) arrive through the ai-usage-ingest function and are
// priced with the same table, so both bots are counted the same way.

type Price = { input: number; output: number; cacheRead: number; cacheWrite: number }

// Haiku 5.5 costs more when the prompt is over 100K tokens.
const HAIKU_LONG_PROMPT = 100_000

const PRICES: Array<{ prefix: string; price: Price; longPrompt?: Price }> = [
  { prefix: 'claude-opus-5-5', price: { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 } },
  { prefix: 'claude-sonnet-5-5', price: { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 } },
  {
    prefix: 'claude-haiku-5-5',
    price: { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
    longPrompt: { input: 0.5, output: 2.5, cacheRead: 0.05, cacheWrite: 0.625 },
  },
]
// Unknown model (e.g. a server-side fallback we have not priced): count it at Opus
// prices so the estimate errs high rather than low.
const UNKNOWN: Price = PRICES[0].price

export type TokenUsage = {
  input_tokens?: number | null
  output_tokens?: number | null
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
}

const n = (v: unknown) => Math.max(0, Math.round(Number(v) || 0))

export function estimateCostUsd(model: string, usage: TokenUsage): number {
  const input = n(usage.input_tokens)
  const output = n(usage.output_tokens)
  const cacheRead = n(usage.cache_read_input_tokens)
  const cacheWrite = n(usage.cache_creation_input_tokens)
  const row = PRICES.find((p) => String(model || '').startsWith(p.prefix))
  const promptTokens = input + cacheRead + cacheWrite
  const price = row ? (row.longPrompt && promptTokens > HAIKU_LONG_PROMPT ? row.longPrompt : row.price) : UNKNOWN
  const usd = (input * price.input + output * price.output + cacheRead * price.cacheRead + cacheWrite * price.cacheWrite) / 1_000_000
  return Number(usd.toFixed(6))
}

// THB per USD, fetched at most twice a day per instance. The fallback matches
// receipt.ts so both places agree when the rate services are down.
let fx: { rate: number; at: number } | null = null
export async function usdToThbRate(): Promise<number> {
  if (fx && Date.now() - fx.at < 12 * 3600_000) return fx.rate
  for (const url of ['https://api.exchangerate-api.com/v4/latest/USD', 'https://open.er-api.com/v6/latest/USD']) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(2000) })
      if (resp.ok) {
        const rate = Number((await resp.json())?.rates?.THB)
        if (rate > 0) {
          fx = { rate, at: Date.now() }
          return rate
        }
      }
    } catch { /* try the next one */ }
  }
  return 33.5
}

export type UsageRow = {
  source: 'haustable' | 'yuzu'
  feature: string
  model: string
  usage: TokenUsage
}

/** Insert one usage row with the service role. Never throws: logging must not break a reply. */
export async function logAiUsage(row: UsageRow): Promise<void> {
  try {
    const url = Deno.env.get('SUPABASE_URL')
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !key) return
    const costUsd = estimateCostUsd(row.model, row.usage)
    const rate = await usdToThbRate()
    const resp = await fetch(`${url}/rest/v1/ai_usage_log`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        source: row.source,
        feature: String(row.feature || 'other').slice(0, 60),
        model: String(row.model || 'unknown').slice(0, 80),
        input_tokens: n(row.usage.input_tokens),
        output_tokens: n(row.usage.output_tokens),
        cache_read_tokens: n(row.usage.cache_read_input_tokens),
        cache_write_tokens: n(row.usage.cache_creation_input_tokens),
        cost_usd: costUsd,
        usd_thb_rate: rate,
        cost_thb: Number((costUsd * rate).toFixed(4)),
      }),
      signal: AbortSignal.timeout(3000),
    })
    if (!resp.ok) console.warn('[ai usage] insert failed', resp.status, (await resp.text()).slice(0, 200))
  } catch (err) {
    console.warn('[ai usage] insert failed', (err as Error)?.message)
  }
}
