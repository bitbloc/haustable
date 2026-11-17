// Funnel steps for /booking and /pickup, pushed to dataLayer for GTM Custom Event triggers.
// Every event carries the stored ad attribution (onhaus_attribution: UTM + gclid / gbraid / wbraid)
// so a drop-off can be read per campaign. dataLayer only: no database writes per step.
import { getStoredUtmParams } from './analyticsHelper'

const FROM_LINK_KEY = 'onhaus_from_link'
const ATTR_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'gclid', 'gbraid', 'wbraid']

const attribution = () => {
    const stored = getStoredUtmParams()
    const out = {}
    ATTR_FIELDS.forEach((k) => { if (stored[k]) out[k] = stored[k] })
    return out
}

const lastSent = new Map()

/** Push one funnel event. The same event + params within 1 s (re-render, double tap) is dropped. */
export const trackFunnel = (event, params = {}) => {
    try {
        if (typeof window === 'undefined') return
        const key = event + JSON.stringify(params)
        const now = Date.now()
        if (now - (lastSent.get(key) || 0) < 1000) return
        lastSent.set(key, now)
        window.dataLayer = window.dataLayer || []
        window.dataLayer.push({
            event,
            page_path: window.location.pathname,
            ...attribution(),
            ...params
        })
    } catch (err) {
        console.warn('[Funnel] push failed:', err)
    }
}

export const trackFunnelPageView = (funnel) => trackFunnel('page_view', {
    page_title: document.title,
    page_location: window.location.href,
    funnel
})

/**
 * Remember, for this tab, that the visit came from the ads page (/link) or an ad click.
 * Call once when /booking or /pickup opens.
 */
export const rememberEntry = () => {
    try {
        const params = new URLSearchParams(window.location.search)
        const hasAdParams = ATTR_FIELDS.some((k) => params.get(k))
        let fromLink = false
        if (document.referrer) {
            const ref = new URL(document.referrer)
            fromLink = ref.origin === window.location.origin && ref.pathname.startsWith('/link')
        }
        if (hasAdParams || fromLink) sessionStorage.setItem(FROM_LINK_KEY, '1')
    } catch { /* storage blocked: falls back to / */ }
}

/** Where "back" from the first step (and the closed-shop redirect) should go. */
export const getEntryBackPath = () => {
    try {
        if (sessionStorage.getItem(FROM_LINK_KEY) === '1') return '/link'
        const params = new URLSearchParams(window.location.search)
        if (ATTR_FIELDS.some((k) => params.get(k))) return '/link'
    } catch { /* ignore */ }
    return '/'
}
