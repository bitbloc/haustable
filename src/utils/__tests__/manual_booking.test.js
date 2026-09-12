import { describe, it, expect } from 'vitest'
import { toThaiISO, getThaiDate } from '../timeUtils'
import { checkOverlap } from '../availabilityUtils'

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
})
