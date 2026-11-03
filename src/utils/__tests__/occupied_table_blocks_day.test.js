import { describe, it, expect } from 'vitest'
import { isBookingOverlap } from '../availabilityUtils'

// 3 Nov 2026, Bangkok. Walk-in sat at H4 at 16:57 with the default 2h end_time (18:57).
const now = new Date('2026-11-03T18:10:00+07:00')
const walkIn = { status: 'seated', booking_type: 'walk_in', booking_time: '2026-11-03T16:57:51+07:00', end_time: '2026-11-03T18:57:51+07:00' }
const slot = (hhmm, day = '03') => {
    const start = new Date(`2026-11-${day}T${hhmm}:00+07:00`)
    return [start, new Date(start.getTime() + 2 * 3600e3)]
}
const opts = { now, defaultDurationHours: 2, liveBufferMinutes: 30, occupiedBlocksRestOfDay: true }

describe('occupied table blocks online booking for the rest of today', () => {
    it('closes slots after the 2h estimate while guests are still seated', () => {
        expect(isBookingOverlap(...slot('20:30'), walkIn, opts)).toBe(true)
        expect(isBookingOverlap(...slot('22:00'), walkIn, opts)).toBe(true)
    })

    it('without the option the old 2h window still applies', () => {
        const { occupiedBlocksRestOfDay, ...plain } = opts
        expect(isBookingOverlap(...slot('20:30'), walkIn, plain)).toBe(false)
    })

    it('leaves tomorrow open', () => {
        expect(isBookingOverlap(...slot('18:00', '04'), walkIn, opts)).toBe(false)
    })

    it('treats a QR walk-in waiting for approval as occupied, but not an advance reservation', () => {
        expect(isBookingOverlap(...slot('21:00'), { ...walkIn, status: 'pending' }, opts)).toBe(true)
        const reservation = { status: 'confirmed', booking_type: 'dine_in', booking_time: '2026-11-03T12:00:00+07:00' }
        expect(isBookingOverlap(...slot('21:00'), reservation, opts)).toBe(false)
    })

    it('frees the table once the bill is closed', () => {
        expect(isBookingOverlap(...slot('20:30'), { ...walkIn, status: 'completed' }, opts)).toBe(false)
    })
})
