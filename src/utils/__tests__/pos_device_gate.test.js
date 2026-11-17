import { describe, it, expect, vi, beforeEach } from 'vitest'

const native = { value: false }
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.value } }))
vi.mock('../../lib/supabaseClient', () => ({ IS_POS_READONLY_PREVIEW: false, supabase: {} }))

import { getPosDeviceStatus, isAllowedPosDevice, registerThisDevice, unregisterThisDevice, POS_DEVICE_KEY } from '../posDevice'

describe('POS device gate (web /pos)', () => {
    beforeEach(() => {
        localStorage.clear()
        native.value = false
    })

    it('a customer browser is not allowed', () => {
        expect(isAllowedPosDevice()).toBe(false)
        expect(getPosDeviceStatus().reason).toBe('not_registered')
    })

    it('the POS app (APK) is always allowed, no registration needed', () => {
        native.value = true
        expect(getPosDeviceStatus()).toMatchObject({ allowed: true, reason: 'app' })
    })

    it('a browser registered by an admin is allowed, and loses it when removed', () => {
        const rec = registerThisDevice({ name: 'โน้ตบุ๊กแคชเชียร์', by: 'Bam' })
        expect(rec.id).toMatch(/^[0-9a-f]{32}$/)
        expect(getPosDeviceStatus()).toMatchObject({ allowed: true, reason: 'registered' })
        unregisterThisDevice()
        expect(isAllowedPosDevice()).toBe(false)
    })

    it('a hand-typed or broken value does not count', () => {
        localStorage.setItem(POS_DEVICE_KEY, '1')
        expect(isAllowedPosDevice()).toBe(false)
        localStorage.setItem(POS_DEVICE_KEY, JSON.stringify({ id: 'short' }))
        expect(isAllowedPosDevice()).toBe(false)
        localStorage.setItem(POS_DEVICE_KEY, '{not json')
        expect(isAllowedPosDevice()).toBe(false)
    })
})
