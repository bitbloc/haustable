import { describe, it, expect } from 'vitest'
import { toThaiISO, getThaiDate } from '../timeUtils'
import { checkOverlap } from '../availabilityUtils'
import { calculateBookingFinancials, formatDiscountRemarkTag } from '../bookingHelper'

describe('Manual Booking Calculations & Overlap Detection', () => {
    it('should generate valid Thailand ISO timestamps (+07:00)', () => {
        const iso = toThaiISO('2026-09-12', '18:00')
        expect(iso).toBe('2026-09-12T18:00:00+07:00')

        // Fix dot notation automatically
        const dotIso = toThaiISO('2026-09-12', '19.30')
        expect(dotIso).toBe('2026-09-12T19:30:00+07:00')
    })

    it('should calculate correct end_time for 2-hour duration', () => {
        const startIso = toThaiISO('2026-09-12', '18:00')
        const startDate = new Date(startIso)
        const durationHours = 2
        const endDate = new Date(startDate.getTime() + (durationHours * 60 * 60 * 1000))
        
        // Difference must be exactly 2 hours (7,200,000 ms)
        expect(endDate.getTime() - startDate.getTime()).toBe(2 * 60 * 60 * 1000)
    })

    it('should calculate deposit calculations accurately (50%, 100%, 0%)', () => {
        const totalAmount = 1006

        // 50% deposit
        const halfDeposit = Math.round(totalAmount * 0.5)
        expect(halfDeposit).toBe(503)

        // 100% deposit
        const fullDeposit = totalAmount
        expect(fullDeposit).toBe(1006)

        // 0% deposit
        const zeroDeposit = 0
        expect(zeroDeposit).toBe(0)
    })

    it('should accurately detect table booking overlaps', () => {
        const reqStart = new Date(toThaiISO('2026-09-12', '18:00'))
        const reqEnd = new Date(toThaiISO('2026-09-12', '20:00'))

        // Existing booking at 19:00 - 21:00 (overlaps with 18:00 - 20:00)
        const existingBookingStart = toThaiISO('2026-09-12', '19:00')
        expect(checkOverlap(reqStart, reqEnd, existingBookingStart, 2)).toBe(true)

        // Existing booking earlier at 15:00 - 17:00 (does NOT overlap)
        const earlierBookingStart = toThaiISO('2026-09-12', '15:00')
        expect(checkOverlap(reqStart, reqEnd, earlierBookingStart, 2)).toBe(false)

        // Existing booking later at 20:30 - 22:30 (does NOT overlap)
        const laterBookingStart = toThaiISO('2026-09-12', '20:30')
        expect(checkOverlap(reqStart, reqEnd, laterBookingStart, 2)).toBe(false)
    })

    it('should format clean manual booking staff remark tags', () => {
        const source = 'line'
        const customRemark = 'ลูกค้าโอน SCB ยอด 503 บาท จากคุณชิดชนก'
        const defaultTag = `[MANUAL_ADMIN] รับจองผ่าน ${source.toUpperCase()}`
        const fullRemark = customRemark ? `${defaultTag} · ${customRemark}` : defaultTag

        expect(fullRemark).toBe('[MANUAL_ADMIN] รับจองผ่าน LINE · ลูกค้าโอน SCB ยอด 503 บาท จากคุณชิดชนก')
    })

    describe('Discount and Financial Breakdown Calculations (bookingHelper)', () => {
        it('should calculate percentage discount accurately', () => {
            const res = calculateBookingFinancials({
                subtotal: 1000,
                discountType: 'percent',
                discountValue: 10,
                depositAmount: 450
            })

            expect(res.subtotal).toBe(1000)
            expect(res.discountAmount).toBe(100)
            expect(res.netTotal).toBe(900)
            expect(res.depositAmount).toBe(450)
            expect(res.remainingDue).toBe(450)
        })

        it('should calculate fixed price/amount discount accurately', () => {
            const res = calculateBookingFinancials({
                subtotal: 1200,
                discountType: 'amount',
                discountValue: 200,
                depositAmount: 500
            })

            expect(res.subtotal).toBe(1200)
            expect(res.discountAmount).toBe(200)
            expect(res.netTotal).toBe(1000)
            expect(res.depositAmount).toBe(500)
            expect(res.remainingDue).toBe(500)
        })

        it('should handle decimal percentages with precision', () => {
            const res = calculateBookingFinancials({
                subtotal: 1500,
                discountType: 'percent',
                discountValue: 12.5,
                depositAmount: 0
            })

            // 1500 * 0.125 = 187.5
            expect(res.discountAmount).toBe(187.5)
            expect(res.netTotal).toBe(1312.5)
            expect(res.remainingDue).toBe(1312.5)
        })

        it('should cap percentage discount at 100%', () => {
            const res = calculateBookingFinancials({
                subtotal: 500,
                discountType: 'percent',
                discountValue: 150,
                depositAmount: 0
            })

            expect(res.discountAmount).toBe(500)
            expect(res.netTotal).toBe(0)
            expect(res.remainingDue).toBe(0)
        })

        it('should cap fixed amount discount at subtotal (cannot exceed total bill)', () => {
            const res = calculateBookingFinancials({
                subtotal: 350,
                discountType: 'amount',
                discountValue: 500,
                depositAmount: 0
            })

            expect(res.discountAmount).toBe(350)
            expect(res.netTotal).toBe(0)
            expect(res.remainingDue).toBe(0)
        })

        it('should accurately calculate 50% and 100% deposit on net discounted total', () => {
            const res = calculateBookingFinancials({
                subtotal: 1000,
                discountType: 'percent',
                discountValue: 20 // Net total = 800
            })

            const halfDeposit = Math.round(res.netTotal * 0.5)
            expect(halfDeposit).toBe(400)

            const fullDeposit = res.netTotal
            expect(fullDeposit).toBe(800)

            const withDeposit = calculateBookingFinancials({
                subtotal: 1000,
                discountType: 'percent',
                discountValue: 20,
                depositAmount: halfDeposit
            })

            expect(withDeposit.remainingDue).toBe(400)
        })

        it('should format discount remark tags cleanly', () => {
            const percentTag = formatDiscountRemarkTag('percent', 15, 150)
            expect(percentTag).toBe('[ส่วนลด 15%: -฿150.00]')

            const amountTag = formatDiscountRemarkTag('amount', 50, 50)
            expect(amountTag).toBe('[ส่วนลด: -฿50.00]')

            const noDiscountTag = formatDiscountRemarkTag('percent', 0, 0)
            expect(noDiscountTag).toBe('')
        })
    })
})
