import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

/**
 * POS READ-ONLY PREVIEW (local development only).
 * Started with `npm run dev:pos-preview` (vite --mode posreadonly). It exists so the POS can be
 * opened and inspected against the live database without a PIN or an open shift, while making it
 * impossible to change shop data: every write is refused before it leaves the browser.
 * `import.meta.env.DEV` is false in `vite build`, so this whole block is dropped from the APK and
 * the website.
 */
export const IS_POS_READONLY_PREVIEW =
  import.meta.env.DEV && import.meta.env.MODE === 'posreadonly'

// Read-only RPCs the POS needs to render. Anything else sent as POST is blocked.
const PREVIEW_ALLOWED_RPCS = new Set([
  'get_staff_list_safe',
  'search_member_crm_pos',
  'get_member_tier_details',
  'stock_closing_status'
])

function readOnlyPreviewFetch(input, init = {}) {
  const url = typeof input === 'string' ? input : (input?.url || String(input))
  const method = String(init?.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase()

  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return fetch(input, init)
  }
  const rpcMatch = url.match(/\/rest\/v1\/rpc\/([a-z0-9_]+)/i)
  if (method === 'POST' && rpcMatch && PREVIEW_ALLOWED_RPCS.has(rpcMatch[1])) {
    return fetch(input, init)
  }

  console.warn(`[POS READ-ONLY PREVIEW] Blocked ${method} ${url.replace(supabaseUrl, '')}`)
  window.__posPreviewBlockedWrites = (window.__posPreviewBlockedWrites || 0) + 1
  return Promise.resolve(new Response(
    JSON.stringify({ code: 'PREVIEW_READ_ONLY', message: 'Blocked: POS read-only preview does not write to the database' }),
    { status: 403, headers: { 'Content-Type': 'application/json' } }
  ))
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  ...(IS_POS_READONLY_PREVIEW ? { global: { fetch: readOnlyPreviewFetch } } : {})
})

if (IS_POS_READONLY_PREVIEW) {
  // Realtime broadcasts over the open websocket do not pass through fetch. Mute them so the
  // preview can never ring the real POS, the kitchen or the customer display.
  const probe = supabase.channel('__pos_preview_probe__')
  const channelProto = Object.getPrototypeOf(probe)
  channelProto.send = async function previewMutedSend(payload) {
    console.warn('[POS READ-ONLY PREVIEW] Muted realtime send', payload?.event || payload?.type)
    window.__posPreviewBlockedWrites = (window.__posPreviewBlockedWrites || 0) + 1
    return 'ok'
  }
  supabase.removeChannel(probe)
  console.warn('[POS READ-ONLY PREVIEW] Active: all database writes and realtime broadcasts are blocked.')
}
