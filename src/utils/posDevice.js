// Which devices may open the POS (/pos, /pos/cfd).
// - The POS app (Capacitor APK on the Sunmi) always may.
// - A web browser may only after an owner / admin / manager registered it from
//   /admin/pos-device (signed in to the back office on that device).
// Everyone else (customers, anyone typing /pos) is sent to the home page before any
// POS code or shop data loads.
//
// This is a front-door check stored on the device. It keeps outsiders off the screen;
// it is not a database permission (that is Row Level Security, security Phase B).
import { Capacitor } from '@capacitor/core'
import { IS_POS_READONLY_PREVIEW } from '../lib/supabaseClient'

export const POS_DEVICE_KEY = 'haus_pos_device'

const readRecord = () => {
    try {
        const raw = localStorage.getItem(POS_DEVICE_KEY)
        if (!raw) return null
        const rec = JSON.parse(raw)
        return rec && typeof rec.id === 'string' && rec.id.length >= 16 ? rec : null
    } catch {
        return null
    }
}

export const isNativePosApp = () => {
    try {
        return Capacitor.isNativePlatform()
    } catch {
        return false
    }
}

/** { allowed, reason: 'app' | 'preview' | 'registered' | 'not_registered', record } */
export const getPosDeviceStatus = () => {
    if (isNativePosApp()) return { allowed: true, reason: 'app', record: null }
    // Local `npm run dev:pos-preview` only (always false in a production build)
    if (IS_POS_READONLY_PREVIEW) return { allowed: true, reason: 'preview', record: null }
    const record = readRecord()
    return record
        ? { allowed: true, reason: 'registered', record }
        : { allowed: false, reason: 'not_registered', record: null }
}

export const isAllowedPosDevice = () => getPosDeviceStatus().allowed

const randomId = () => {
    try {
        return crypto.randomUUID().replace(/-/g, '')
    } catch {
        return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
    }
}

/** Register this browser as a POS device. `by` is the display name of the admin who did it. */
export const registerThisDevice = ({ name, by }) => {
    const record = {
        id: randomId(),
        name: (name || '').trim() || 'POS',
        by: by || '',
        at: new Date().toISOString()
    }
    localStorage.setItem(POS_DEVICE_KEY, JSON.stringify(record))
    return record
}

export const unregisterThisDevice = () => {
    try {
        localStorage.removeItem(POS_DEVICE_KEY)
    } catch { /* storage blocked */ }
}

/** Roles that may register or remove a POS device. */
export const POS_DEVICE_ADMIN_ROLES = ['owner', 'admin', 'manager']
