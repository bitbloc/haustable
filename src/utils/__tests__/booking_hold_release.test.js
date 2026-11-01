import { describe, it, expect } from 'vitest'
import { getBookingHoldMinutes, isHoldExpired, isBookingOverlap } from '../availabilityUtils'

const start = new Date('2026-11-05T18:00:00+07:00')
const held = { booking_time: start.toISOString(), status: 'pending', booking_type: 'dine_in', staff_remark: '[ONLINE] [CALL_CONFIRM] [HOLD:15] จองโต๊ะ' }
const minutes = (m) => new Date(start.getTime() + m * 60 * 1000)

describe('free booking hold window', () => {
    it('reads the hold tag', () => {
        expect(getBookingHoldMinutes(held)).toBe(15)
        expect(getBookingHoldMinutes({ staff_remark: '[ONLINE] จองโต๊ะ' })).toBeNull()
    })

    it('keeps the table blocked inside the hold window', () => {
        expect(isHoldExpired(held, minutes(10))).toBe(false)
        expect(isBookingOverlap(minutes(10), minutes(130), held, { now: minutes(10) })).toBe(true)
    })

    it('releases the table once the hold passes and the guest is not seated', () => {
        expect(isHoldExpired(held, minutes(16))).toBe(true)
        expect(isBookingOverlap(minutes(16), minutes(136), held, { now: minutes(16) })).toBe(false)
        expect(isBookingOverlap(minutes(16), minutes(136), { ...held, status: 'confirmed' }, { now: minutes(16) })).toBe(false)
    })

    it('never releases a seated guest or an untagged booking', () => {
        expect(isBookingOverlap(minutes(30), minutes(150), { ...held, status: 'seated' }, { now: minutes(30) })).toBe(true)
        const untagged = { ...held, staff_remark: '[ONLINE] จองโต๊ะ' }
        expect(isBookingOverlap(minutes(30), minutes(150), untagged, { now: minutes(30) })).toBe(true)
    })
})
