// Receives token usage from Yuzu (inthehaus-hr) so the back office can show one
// estimated AI bill for both bots. Yuzu has no Supabase session here, so this
// function is deployed without JWT checks and takes a shared key instead
// (secret AI_USAGE_KEY here, same value as AI_USAGE_KEY in the HR app's env).
// Cost is priced here from model + tokens; the caller never sends a price.
import { logAiUsage } from '../_shared/aiUsage.ts'

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function sameKey(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply({ ok: false, error: 'METHOD' }, 405)
  const expected = Deno.env.get('AI_USAGE_KEY') ?? ''
  if (!sameKey(req.headers.get('x-usage-key') ?? '', expected)) return reply({ ok: false, error: 'UNAUTHORIZED' }, 401)

  const raw = await req.text()
  if (raw.length > 20_000) return reply({ ok: false, error: 'PAYLOAD_TOO_LARGE' }, 413)
  let body: any
  try { body = JSON.parse(raw) } catch { return reply({ ok: false, error: 'BAD_JSON' }, 400) }

  const rows = (Array.isArray(body) ? body : [body]).slice(0, 20)
  const valid = rows.filter((r: any) => /^claude-[a-z0-9.-]{1,60}$/.test(String(r?.model ?? '')))
  // Reply first, write after: Yuzu waits only 1.5 s, and the rate lookup plus the
  // insert took up to ~1.4 s on a cold start, so some reports were cut off and
  // never counted (one Opus call on 2026-11-27, found against the Console bill).
  const work = (async () => {
    for (const r of valid) {
      await logAiUsage({
        source: 'yuzu',
        feature: `yuzu:${String(r?.feature || 'chat').replace(/[^a-z0-9_:-]/gi, '').slice(0, 40)}`,
        model: String(r.model),
        usage: r?.usage || {},
      })
    }
  })()
  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime
  if (runtime?.waitUntil) runtime.waitUntil(work)
  else await work
  const logged = valid.length
  return reply({ ok: true, logged })
})
