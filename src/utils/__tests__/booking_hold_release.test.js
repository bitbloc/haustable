import { describe, it, expect } from 'vitest'
import {
    DEFAULT_HOLD_MINUTES,
    getBookingHoldMinutes,
    isHoldExpired,
    isBookingOverlap,
    isAdvanceUnseatedReservation,
    isPayAtStoreOrder,
    isCallConfirmOrder
} from '../availabilityUtils'
import { isTableSessionActive, isDuplicateGhostBooking, stripInternalTransferTags } from '../tableTransferHelper'
import { getCleanStaffRemark } from '../printerHelper'
import { getBookingPaymentBreakdown } from '../shiftHelper'

const start = new Date('2026-11-05T18:00:00+07:00')
const held = {
    booking_time: start.toISOString(),
    status: 'pending',
    booking_type: 'dine_in',
    source: 'online',
    staff_remark: '[ONLINE] [CALL_CONFIRM] [HOLD:30] จองโต๊ะ ไม่มีค่าจอง (โทรยืนยัน, เก็บโต๊ะ 30 นาที)'
}
const minutes = (m) => new Date(start.getTime() + m * 60 * 1000)

describe('free booking 30-minute hold window & POS integration', () => {
    it('reads the 30-minute hold tag and defaults [CALL_CONFIRM] to 30 minutes', () => {
        expect(DEFAULT_HOLD_MINUTES).toBe(30)
        expect(getBookingHoldMinutes(held)).toBe(30)
        expect(getBookingHoldMinutes({ staff_remark: '[ONLINE] [CALL_CONFIRM] จองโต๊ะ' })).toBe(30)
        expect(getBookingHoldMinutes({ staff_remark: '[ONLINE] จองโต๊ะ' })).toBeNull()
    })

    it('keeps the table blocked inside the 30-minute hold window', () => {
        expect(isHoldExpired(held, minutes(25))).toBe(false)
        expect(isBookingOverlap(minutes(25), minutes(145), held, { now: minutes(25) })).toBe(true)
    })

    it('releases the table once the 30-minute hold passes and the guest is not seated', () => {
        expect(isHoldExpired(held, minutes(31))).toBe(true)
        expect(isBookingOverlap(minutes(31), minutes(151), held, { now: minutes(31) })).toBe(false)
        expect(isBookingOverlap(minutes(31), minutes(151), { ...held, status: 'confirmed' }, { now: minutes(31) })).toBe(false)
    })

    it('never releases a seated guest or an untagged deposit booking', () => {
        expect(isBookingOverlap(minutes(45), minutes(165), { ...held, status: 'seated' }, { now: minutes(45) })).toBe(true)
        const untagged = { ...held, staff_remark: '[ONLINE] จองโต๊ะ' }
        expect(isBookingOverlap(minutes(45), minutes(165), untagged, { now: minutes(45) })).toBe(true)
    })

    it('isolates unseated advance reservations from active POS table sessions until seated', () => {
        expect(isAdvanceUnseatedReservation(held)).toBe(true)
        expect(isAdvanceUnseatedReservation({ ...held, status: 'confirmed' })).toBe(true)
        expect(isTableSessionActive(held, null, null, minutes(-60))).toBe(false)
        expect(isTableSessionActive({ ...held, status: 'confirmed' }, null, null, minutes(-30))).toBe(false)

        // Once guest is seated at the table, it becomes an active table session
        const seatedRes = { ...held, status: 'seated' }
        expect(isAdvanceUnseatedReservation(seatedRes)).toBe(false)
        expect(isTableSessionActive(seatedRes, null, null, minutes(5))).toBe(true)
    })

    it('does not treat 0-item free table reservations as duplicate ghost sessions when walk-in is seated', () => {
        const freeReservation = { ...held, id: 'res-1', table_id: 't1', total_amount: 0, order_items: [] }
        const seatedWalkIn = {
            id: 'walk-1',
            table_id: 't1',
            status: 'seated',
            booking_type: 'walk_in',
            total_amount: 350,
            order_items: [{ id: 'i1', quantity: 1 }]
        }
        expect(isDuplicateGhostBooking(freeReservation, [freeReservation, seatedWalkIn])).toBe(false)
    })

    it('strips internal tags ([CALL_CONFIRM], [HOLD:30], [PAY_AT_STORE]) from printed receipts & remarks', () => {
        expect(getCleanStaffRemark(held.staff_remark)).toBe('')
        const pickupRemark = '[ONLINE_PICKUP] [PAY_AT_STORE] สั่งรับกลับ จ่ายที่ร้าน (โทรยืนยันก่อนทำ) [STAFF_CONFIRMED] [STAFF_ACCEPTED]'
        expect(getCleanStaffRemark(pickupRemark)).toBe('')
        expect(stripInternalTransferTags(pickupRemark)).toBe('')
        expect(isPayAtStoreOrder({ staff_remark: pickupRemark })).toBe(true)
        expect(isCallConfirmOrder(held)).toBe(true)
    })

    it('computes accurate cash vs QR breakdown for [PAY_AT_STORE] orders settled in store', () => {
        const payAtStoreCash = {
            source: 'online',
            booking_type: 'pickup',
            total_amount: 250,
            deposit_amount: 0,
            payment_method: 'cash',
            staff_remark: '[ONLINE_PICKUP] [PAY_AT_STORE] [PAID: CASH]'
        }
        const breakdown = getBookingPaymentBreakdown(payAtStoreCash)
        expect(breakdown.cash).toBe(250)
        expect(breakdown.qr).toBe(0)
    })
})
