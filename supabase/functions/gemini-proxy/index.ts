// Gemini calls from the back office go through here so the API key never
// reaches a browser.
//
// Why (2026-11-26): Google suspended the Cloud project that owned the Gemini
// key ("hijacked resources"). The admin pages used to read the key from
// app_settings, keep it in localStorage and call Gemini with `?key=` in the
// URL, so the key sat on every admin device and in request logs.
//
// Request:  POST { model: "gemini-2.5-flash", request: <generateContent body> }
// Response: 200 { ok, status, data?, error? }  (Gemini's status is passed in
//           `status` so the caller can fall back to the next model on 404.)
// Access:   signed-in admins only (public.is_admin()).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MODEL_RE = /^gemini-[a-z0-9.-]{1,60}$/
const MAX_BODY_BYTES = 20 * 1024 * 1024
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

function reply(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return reply({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  // 1. Caller must be a signed-in admin.
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return reply({ ok: false, error: 'UNAUTHORIZED' }, 401)
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user) return reply({ ok: false, error: 'UNAUTHORIZED' }, 401)
  const { data: isAdmin, error: adminErr } = await userClient.rpc('is_admin')
  if (adminErr || isAdmin !== true) return reply({ ok: false, error: 'FORBIDDEN' }, 403)

  // 2. Validate the request.
  const raw = await req.text()
  if (raw.length > MAX_BODY_BYTES) return reply({ ok: false, error: 'PAYLOAD_TOO_LARGE' }, 413)
  let body: any
  try {
    body = JSON.parse(raw)
  } catch {
    return reply({ ok: false, error: 'BAD_JSON' }, 400)
  }
  const model = String(body?.model ?? '').trim()
  if (!MODEL_RE.test(model)) return reply({ ok: false, error: 'BAD_MODEL' }, 400)
  if (!body?.request || typeof body.request !== 'object') return reply({ ok: false, error: 'BAD_REQUEST' }, 400)

  // 3. Key: function secret first, then the admin-only app_settings row.
  let apiKey = Deno.env.get('GEMINI_API_KEY') ?? ''
  if (!apiKey) {
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    const { data } = await admin.from('app_settings').select('value').eq('key', 'gemini_api_key').maybeSingle()
    apiKey = String(data?.value ?? '').trim()
  }
  if (!apiKey) return reply({ ok: false, status: 0, error: 'MISSING_API_KEY' })

  // 4. Call Gemini. Key goes in a header, never in the URL.
  try {
    const resp = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body.request),
    })
    const text = await resp.text()
    let data: any = null
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
    if (!resp.ok) {
      const message = data?.error?.message || text.slice(0, 300) || resp.statusText
      return reply({ ok: false, status: resp.status, error: message })
    }
    return reply({ ok: true, status: resp.status, data })
  } catch (e) {
    return reply({ ok: false, status: 0, error: `NETWORK: ${(e as Error)?.message ?? e}` })
  }
})
