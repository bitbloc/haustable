// LINE LIFF SDK, loaded on demand instead of from index.html on every page.
// Login is optional on the customer flows, so /booking and /pickup only load it when
// the visitor is inside LINE, comes back from a LINE login redirect, or already has a
// LIFF session on this device. Everyone else downloads it only when they tap LINE login.

export const LIFF_ID = '2008674756-hTEWodVj'
const SDK_URL = 'https://static.line-scdn.net/liff/edge/2/sdk.js'

let liffPromise = null

const injectSdk = () => new Promise((resolve, reject) => {
    if (window.liff) return resolve(window.liff)
    const script = document.createElement('script')
    script.src = SDK_URL
    script.async = true
    script.onload = () => (window.liff ? resolve(window.liff) : reject(new Error('LIFF SDK missing')))
    script.onerror = () => reject(new Error('LIFF SDK failed to load'))
    document.head.appendChild(script)
})

/** Load + init LIFF once. Resolves to window.liff, or null if blocked / unavailable. */
export const ensureLiff = () => {
    if (typeof window === 'undefined') return Promise.resolve(null)
    if (!liffPromise) {
        liffPromise = injectSdk()
            .then(async (liff) => {
                await liff.init({ liffId: LIFF_ID, withLoginOnExternalBrowser: false })
                return liff
            })
            .catch((e) => {
                console.warn('LIFF unavailable (tracking/storage blocked or offline):', e)
                liffPromise = null // allow a later retry, e.g. when the user taps LINE login
                return null
            })
    }
    return liffPromise
}

/** True when LIFF is worth loading up front on a page where login is optional. */
export const liffNeededEarly = () => {
    if (typeof window === 'undefined') return false
    try {
        if (/Line\//i.test(navigator.userAgent)) return true
        const params = new URLSearchParams(window.location.search)
        if (params.has('liff.state') || params.has('liffClientId') || (params.has('code') && params.has('state'))) return true
        // A LINE login leaves tokens; a plain visit only leaves ":context", which does not count
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i) || ''
            if (key.startsWith('LIFF_STORE') && /:(accessToken|IDToken)$/.test(key)) return true
        }
    } catch { /* storage blocked */ }
    return false
}

/** ID token of a logged-in LIFF user, without loading the SDK when it is not there. */
export const getLiffIdToken = () => {
    try {
        return window.liff?.isLoggedIn?.() ? window.liff.getIDToken() : null
    } catch {
        return null
    }
}
