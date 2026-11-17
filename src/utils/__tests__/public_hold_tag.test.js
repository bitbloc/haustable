import { describe, it, expect } from 'vitest'
import { withPublicHoldTag, isBookingOverlap } from '../availabilityUtils'

const free = { table_id: 1, booking_time: '2026-11-17T18:00:00+07:00', status: 'pending', booking_type: 'dine_in', source: 'online', deposit_amount: 0 }
const prepaid = { ...free, deposit_amount: 300 }
const walkIn = { ...free, source: 'pos', booking_type: 'walk_in' }

describe('public hold tag (no staff_remark on public pages)', () => {
    it('tags free online table bookings only', () => {
        expect(withPublicHoldTag(free, 30).staff_remark).toBe('[HOLD:30]')
        expect(withPublicHoldTag(prepaid, 30).staff_remark).toBeUndefined()
        expect(withPublicHoldTag(walkIn, 30).staff_remark).toBeUndefined()
    })

    it('keeps a real staff_remark when one was selected', () => {
        expect(withPublicHoldTag({ ...free, staff_remark: 'x' }, 30).staff_remark).toBe('x')
    })

    it('a no-show free booking stops blocking the table after its hold (same as staff view)', () => {
        const now = new Date('2026-11-17T18:31:00+07:00') // 18:00 booking + 30 min hold has passed
        const reqStart = new Date('2026-11-17T19:00:00+07:00')
        const reqEnd = new Date(reqStart.getTime() + 2 * 3600 * 1000)
        const opts = { now, defaultDurationHours: 2, liveBufferMinutes: 30, occupiedBlocksRestOfDay: true }
        expect(isBookingOverlap(reqStart, reqEnd, free, opts)).toBe(true) // without the tag: still blocked
        expect(isBookingOverlap(reqStart, reqEnd, withPublicHoldTag(free, 30), opts)).toBe(false)
        expect(isBookingOverlap(reqStart, reqEnd, withPublicHoldTag(prepaid, 30), opts)).toBe(true)
    })
})
