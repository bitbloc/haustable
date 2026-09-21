import { describe, it, expect } from 'vitest'
import { getBookingPaymentStatusInfo } from '../../AdminBookings'

describe('getBookingPaymentStatusInfo - Dieter Rams & Thai Modern Business Logic', () => {
    it('handles null or empty booking object safely', () => {
        const info = getBookingPaymentStatusInfo(null)
        expect(info).toEqual({
            totalAmt: 0,
            depAmt: 0,
            remainingDue: 0,
            isCancelledOrVoid: false,
            isFullyPaid: false,
            isPartialPaid: false,
            isUnpaid: false
        })
    })

    it('identifies unpaid orders when total > 0 and deposit = 0', () => {
        const booking = {
            total_amount: 350,
            deposit_amount: 0,
            status: 'pending'
        }
        const info = getBookingPaymentStatusInfo(booking)
        expect(info.isUnpaid).toBe(true)
        expect(info.isFullyPaid).toBe(false)
        expect(info.isPartialPaid).toBe(false)
        expect(info.remainingDue).toBe(350)
    })

    it('identifies partially paid orders when deposit is between 0 and total', () => {
        const booking = {
            total_amount: 500,
            deposit_amount: 200,
            status: 'confirmed'
        }
        const info = getBookingPaymentStatusInfo(booking)
        expect(info.isUnpaid).toBe(false)
        expect(info.isPartialPaid).toBe(true)
        expect(info.isFullyPaid).toBe(false)
        expect(info.remainingDue).toBe(300)
    })

    it('identifies fully paid orders when deposit covers total amount', () => {
        const booking = {
            total_amount: 500,
            deposit_amount: 500,
            status: 'confirmed'
        }
        const info = getBookingPaymentStatusInfo(booking)
        expect(info.isFullyPaid).toBe(true)
        expect(info.isUnpaid).toBe(false)
        expect(info.isPartialPaid).toBe(false)
        expect(info.remainingDue).toBe(0)
    })

    it('identifies completed status or lineman orders as fully paid', () => {
        const completedBooking = {
            total_amount: 500,
            deposit_amount: 0,
            status: 'completed'
        }
        expect(getBookingPaymentStatusInfo(completedBooking).isFullyPaid).toBe(true)

        const linemanBooking = {
            total_amount: 400,
            deposit_amount: 0,
            status: 'pending',
            source: 'lineman'
        }
        expect(getBookingPaymentStatusInfo(linemanBooking).isFullyPaid).toBe(true)
    })

    it('does not flag cancelled or void orders as unpaid', () => {
        const cancelledBooking = {
            total_amount: 500,
            deposit_amount: 0,
            status: 'cancelled'
        }
        const info = getBookingPaymentStatusInfo(cancelledBooking)
        expect(info.isCancelledOrVoid).toBe(true)
        expect(info.isUnpaid).toBe(false)
    })
})
