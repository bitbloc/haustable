// Estimated AI (Claude) spend for the back office. Rows come from public.ai_usage_log
// (one per call, priced on the server in supabase/functions/_shared/aiUsage.ts).
// The API key cannot read Anthropic's balance, so this is an estimate from tokens.
import { supabase } from '../lib/supabaseClient'

// Owner's own monthly Gemini figure, kept in app_settings so no figure lives in code.
export const GEMINI_BASELINE_KEY = 'ai_cost_gemini_baseline_thb'
// A projection from one or two days swings too much to be useful.
export const MIN_DAYS_FOR_PROJECTION = 3

const pad = (n) => String(n).padStart(2, '0')
export function monthBounds(ym) {
    const [y, m] = ym.split('-').map(Number)
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
    return { from: `${ym}-01`, to: `${ym}-${pad(last)}`, daysInMonth: last }
}

export async function fetchAiUsage(ym) {
    const { from, to } = monthBounds(ym)
    const { data, error } = await supabase.rpc('ai_usage_summary', { p_from: from, p_to: to })
    if (error) throw error
    return data || []
}

export async function fetchGeminiBaseline() {
    const { data } = await supabase.from('app_settings').select('value').eq('key', GEMINI_BASELINE_KEY).maybeSingle()
    const v = Number(data?.value)
    return v > 0 ? v : null
}

export async function saveGeminiBaseline(thb) {
    const value = Number(thb)
    if (!(value > 0)) throw new Error('ใส่ตัวเลขมากกว่า 0')
    const { error } = await supabase.from('app_settings').upsert({ key: GEMINI_BASELINE_KEY, value: String(Math.round(value)) })
    if (error) throw error
    return Math.round(value)
}

const MODEL_LABEL = [
    ['claude-opus', 'Opus (อ่านบิล งานละเอียด)'],
    ['claude-sonnet', 'Sonnet'],
    ['claude-haiku', 'Haiku (งานเร็ว ราคาถูก)'],
]
export const modelLabel = (m) => (MODEL_LABEL.find(([p]) => String(m).startsWith(p)) || [null, m])[1]
export const sourceLabel = (s) => (s === 'yuzu' ? 'Yuzu (HR)' : 'Haustable')

// Rows whose feature starts with this were added by hand from the Console bill for
// calls made before logging began (setup tests on 2026-11-26). They count toward
// the month's total but are one-off: not calls, and not part of the daily rate.
export const isBackfill = (feature) => String(feature || '').startsWith('backfill:')

/**
 * rows: ai_usage_summary output for one month.
 * todayIso: the Bangkok date used as "today" (projection runs to the month's end).
 */
export function summarizeAiUsage(rows, ym, todayIso) {
    const { daysInMonth } = monthBounds(ym)
    const num = (v) => Number(v) || 0
    let thb = 0, usd = 0, calls = 0, oneOffThb = 0
    const byDay = new Map(), bySource = new Map(), byModel = new Map()
    for (const r of rows) {
        const t = num(r.cost_thb)
        const oneOff = isBackfill(r.feature)
        thb += t; usd += num(r.cost_usd)
        if (oneOff) oneOffThb += t
        else calls += num(r.calls)
        byDay.set(r.day, (byDay.get(r.day) || 0) + t)
        const s = bySource.get(r.source) || { thb: 0, calls: 0 }
        bySource.set(r.source, { thb: s.thb + t, calls: s.calls + (oneOff ? 0 : num(r.calls)) })
        const label = modelLabel(r.model)
        const m = byModel.get(label) || { thb: 0, calls: 0 }
        byModel.set(label, { thb: m.thb + t, calls: m.calls + (oneOff ? 0 : num(r.calls)) })
    }
    if (calls === 0 && oneOffThb === 0) return { calls: 0 }

    // Average per day over the days since logging started this month, quiet days included.
    // One-off backfill is left out of the rate and added back once to the projection.
    const firstDay = [...byDay.keys()].sort()[0]
    const end = todayIso && todayIso.slice(0, 7) === ym ? todayIso : `${ym}-${pad(daysInMonth)}`
    const daysTracked = Math.max(1, Math.round((Date.parse(end) - Date.parse(firstDay)) / 86400000) + 1)
    const perDay = (thb - oneOffThb) / daysTracked
    const isCurrentMonth = todayIso && todayIso.slice(0, 7) === ym
    const projection = daysTracked >= MIN_DAYS_FOR_PROJECTION
        ? (isCurrentMonth ? perDay * daysInMonth : (thb - oneOffThb) * (daysInMonth / daysTracked)) + oneOffThb
        : null

    const sortDesc = (map) => [...map.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.thb - a.thb)
    return {
        calls, thb, usd, perDay, daysTracked, daysInMonth, projection,
        daysUntilProjection: Math.max(0, MIN_DAYS_FOR_PROJECTION - daysTracked),
        bySource: sortDesc(bySource).map((r) => ({ ...r, label: sourceLabel(r.key) })),
        byModel: sortDesc(byModel).map((r) => ({ ...r, label: r.key })),
    }
}

/** Claude projection vs the owner's monthly Gemini figure: share of it, as a percentage. */
export function compareToGemini(projection, baseline) {
    if (projection === null || projection === undefined || !(Number(projection) >= 0) || !(baseline > 0)) return null
    return Math.round((projection / baseline) * 100)
}
