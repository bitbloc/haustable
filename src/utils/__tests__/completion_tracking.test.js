import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ad_events logging goes to Supabase: capture it instead of sending anything
const insert = vi.fn(() => Promise.resolve({ error: null }))
vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: () => ({ insert }) } }))

import { trackBookingComplete, trackPickupComplete } from '../analyticsHelper'
import { trackFunnel } from '../funnelTracking'

const ATTR = JSON.stringify({ utm_source: 'google', utm_campaign: 'nkp_dinner', gclid: 'G-123', ts: Date.now() })

describe('booking_complete / pickup_complete reach GTM before the redirect', () => {
    beforeEach(() => {
        window.dataLayer = []
        localStorage.setItem('onhaus_attribution', ATTR)
        vi.useFakeTimers()
    })
    afterEach(() => {
        vi.useRealTimers()
        localStorage.clear()
    })

    it('resolves only after GTM calls eventCallback (not before)', async () => {
        let done = false
        const p = trackBookingComplete({ transactionId: 'tok-1', value: 0, pax: 4 }).then(() => { done = true })
        const pushed = window.dataLayer.at(-1)
        expect(pushed.event).toBe('booking_complete')
        expect(pushed.transaction_id).toBe('tok-1')
        expect(pushed.pax).toBe(4)
        expect(pushed.currency).toBe('THB')
        // ad attribution travels with the conversion
        expect(pushed).toMatchObject({ utm_source: 'google', utm_campaign: 'nkp_dinner', gclid: 'G-123' })
        expect(pushed.eventTimeout).toBe(1500)

        await vi.advanceTimersByTimeAsync(500)
        expect(done).toBe(false) // a redirect awaiting this would still be waiting

        pushed.eventCallback() // what GTM does once its tags have fired
        await p
        expect(done).toBe(true)
    })

    it('never blocks the redirect when GTM is blocked or not loaded', async () => {
        let done = false
        trackPickupComplete({ transactionId: 'tok-2', value: 530 }).then(() => { done = true })
        expect(window.dataLayer.at(-1)).toMatchObject({ event: 'pickup_complete', value: 530, transaction_id: 'tok-2' })
        await vi.advanceTimersByTimeAsync(1699)
        expect(done).toBe(false)
        await vi.advanceTimersByTimeAsync(1)
        expect(done).toBe(true) // eventTimeout 1500 + 200 ms safety net: the customer is never stuck
    })

    it('a second eventCallback call is harmless', async () => {
        const p = trackBookingComplete({ transactionId: 'tok-3', value: 0 })
        const pushed = window.dataLayer.at(-1)
        pushed.eventCallback()
        pushed.eventCallback()
        await expect(p).resolves.toBeUndefined()
    })
})

describe('funnel step events', () => {
    beforeEach(() => {
        window.dataLayer = []
        localStorage.setItem('onhaus_attribution', ATTR)
    })

    it('carry attribution and drop an immediate duplicate', () => {
        trackFunnel('booking_step_table')
        trackFunnel('booking_step_table')
        trackFunnel('booking_step_mode', { booking_mode: 'free' })
        expect(window.dataLayer.map(e => e.event)).toEqual(['booking_step_table', 'booking_step_mode'])
        expect(window.dataLayer[1]).toMatchObject({ booking_mode: 'free', utm_source: 'google', gclid: 'G-123' })
    })

    it('write nothing to the database (dataLayer only)', () => {
        insert.mockClear()
        trackFunnel('pickup_step_menu')
        expect(insert).not.toHaveBeenCalled()
    })
})
