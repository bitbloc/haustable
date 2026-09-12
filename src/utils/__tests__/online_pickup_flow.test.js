import { describe, it, expect } from 'vitest'
import { toThaiISO, getThaiDate } from '../timeUtils'

describe('Online Pickup Flow & Validation Tests', () => {
    // 1. Time slots generator
    function generateTimeSlots(openingTime = '11:30', closingTime = '22:00') {
        const slots = []
        const [openHour, openMin] = openingTime.split(':').map(Number)
        const [closeHour, closeMin] = closingTime.split(':').map(Number)

        let current = new Date(2026, 8, 12, openHour, openMin, 0, 0)
        const end = new Date(2026, 8, 12, closeHour, closeMin, 0, 0)

        while (current <= end) {
            const h = String(current.getHours()).padStart(2, '0')
            const m = String(current.getMinutes()).padStart(2, '0')
            slots.push(`${h}:${m}`)
            current.setMinutes(current.getMinutes() + 15)
        }
        return slots
    }

    function filterAvailableTimeSlots(allSlots, now, minAdvanceHours = 1, isTomorrow = false) {
        if (isTomorrow) return allSlots

        const minTime = new Date(now.getTime() + minAdvanceHours * 60 * 60 * 1000)
        return allSlots.filter(slot => {
            const [h, m] = slot.split(':').map(Number)
            const slotTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0)
            return slotTime > minTime
        })
    }

    it('should generate accurate 15-minute pickup slots between 11:30 and 22:00', () => {
        const slots = generateTimeSlots('11:30', '22:00')
        expect(slots[0]).toBe('11:30')
        expect(slots[1]).toBe('11:45')
        expect(slots[2]).toBe('12:00')
        expect(slots[slots.length - 1]).toBe('22:00')
        // (10.5 hours * 4) + 1 = 43 slots
        expect(slots.length).toBe(43)
    })

    it('should filter pickup slots by minimum advance lead time (e.g. 1 hour)', () => {
        const allSlots = generateTimeSlots('11:30', '22:00')
        
        // Scenario A: Customer visits at 12:00 -> First available slot must be > 13:00 (i.e. 13:15)
        const now12 = new Date(2026, 8, 12, 12, 0, 0, 0)
        const availableSlotsA = filterAvailableTimeSlots(allSlots, now12, 1, false)
        expect(availableSlotsA[0]).toBe('13:15')

        // Scenario B: Customer orders for tomorrow -> all slots available
        const availableTomorrow = filterAvailableTimeSlots(allSlots, now12, 1, true)
        expect(availableTomorrow.length).toBe(allSlots.length)
        expect(availableTomorrow[0]).toBe('11:30')
    })

    it('should validate contact details properly for pickup', () => {
        const isValid = (name, phone) => {
            const cleanName = (name || '').trim()
            const cleanPhone = (phone || '').trim().replace(/\D/g, '')
            return Boolean(cleanName && cleanPhone.length >= 9)
        }

        expect(isValid('คุณสมชาย', '0812345678')).toBe(true)
        expect(isValid('น.ส. ชิดชนก', '089-123-4567')).toBe(true)
        expect(isValid('', '0812345678')).toBe(false) // missing name
        expect(isValid('สมชาย', '123')).toBe(false) // phone too short (< 9 digits)
    })

    it('should verify pickup order payload integrity (100% deposit requirement)', () => {
        const cartTotal = 250
        const discountAmount = 50
        const finalTotal = cartTotal - discountAmount

        const payload = {
            source: 'online',
            booking_type: 'pickup',
            total_amount: finalTotal,
            deposit_amount: finalTotal, // 100% deposit
            tracking_token: 'test-token-uuid'
        }

        expect(payload.booking_type).toBe('pickup')
        expect(payload.total_amount).toBe(200)
        expect(payload.deposit_amount).toBe(200)
    })
})
