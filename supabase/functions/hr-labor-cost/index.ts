// Monthly labour cost from the HR system for the monthly owner report.
//
// POST { month: "YYYY-MM" } -> HR's /api/payroll/summary totals (no names).
// Signed-in admins only (is_admin). The shared key (secret HR_PAYROLL_KEY) is
// sent server-to-server and never reaches a browser. HR_API_URL overrides the
// HR base URL.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const reply = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return reply({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return reply({ ok: false, error: 'UNAUTHORIZED' }, 401)
  const userClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user) return reply({ ok: false, error: 'UNAUTHORIZED' }, 401)
  const { data: isAdmin, error: adminErr } = await userClient.rpc('is_admin')
  if (adminErr || isAdmin !== true) return reply({ ok: false, error: 'FORBIDDEN' }, 403)

  let month = ''
  try {
    month = String((await req.json())?.month ?? '')
  } catch {
    return reply({ ok: false, error: 'BAD_JSON' }, 400)
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return reply({ ok: false, error: 'BAD_MONTH' }, 400)

  const key = Deno.env.get('HR_PAYROLL_KEY') ?? ''
  if (!key) return reply({ ok: false, error: 'HR_PAYROLL_KEY not set' })
  const base = (Deno.env.get('HR_API_URL') || 'https://inthehaus-hr.vercel.app').replace(/\/$/, '')

  try {
    const resp = await fetch(`${base}/api/payroll/summary?month=${month}`, {
      headers: { 'x-payroll-key': key },
      signal: AbortSignal.timeout(25_000),
    })
    const data = await resp.json().catch(() => null)
    if (!resp.ok) return reply({ ok: false, status: resp.status, error: data?.error || `HR ${resp.status}` })
    return reply({ ok: true, data })
  } catch (e) {
    return reply({ ok: false, error: `HR unreachable: ${(e as Error)?.message ?? e}` })
  }
})
