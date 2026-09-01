import { describe, it, expect } from 'vitest'

// Contact validation helper logic matching Booking & Pickup validation
export function validateContactInfo(name, phone) {
    const trimmedName = (name || '').trim()
    const trimmedPhone = (phone || '').trim()
    const cleanPhone = trimmedPhone.replace(/\D/g, '')

    if (!trimmedName) {
        return { isValid: false, error: 'Customer Name is required' }
    }
    if (!trimmedPhone || cleanPhone.length < 9) {
        return { isValid: false, error: 'Valid Phone Number (at least 9 digits) is required' }
    }
    return { isValid: true, name: trimmedName, phone: trimmedPhone, cleanPhone }
}

describe('Mandatory Name & Phone Validation for Booking and Pickup', () => {
    it('should reject when name is empty or only whitespace', () => {
        expect(validateContactInfo('', '0812345678').isValid).toBe(false)
        expect(validateContactInfo('   ', '0812345678').isValid).toBe(false)
        expect(validateContactInfo(null, '0812345678').isValid).toBe(false)
        expect(validateContactInfo(undefined, '0812345678').isValid).toBe(false)
    })

    it('should reject when phone is empty or only whitespace', () => {
        expect(validateContactInfo('คุณสมชาย', '').isValid).toBe(false)
        expect(validateContactInfo('คุณสมชาย', '   ').isValid).toBe(false)
        expect(validateContactInfo('คุณสมชาย', null).isValid).toBe(false)
        expect(validateContactInfo('คุณสมชาย', undefined).isValid).toBe(false)
    })

    it('should reject when phone number has fewer than 9 digits', () => {
        expect(validateContactInfo('คุณสมชาย', '081').isValid).toBe(false)
        expect(validateContactInfo('คุณสมชาย', '08-1234').isValid).toBe(false)
        expect(validateContactInfo('คุณสมชาย', '12345678').isValid).toBe(false)
    })

    it('should accept valid 9-digit landline or mobile numbers', () => {
        const res1 = validateContactInfo('คุณสมชาย', '021234567')
        expect(res1.isValid).toBe(true)
        expect(res1.cleanPhone).toBe('021234567')

        const res2 = validateContactInfo(' Somchai ', ' 02-123-4567 ')
        expect(res2.isValid).toBe(true)
        expect(res2.name).toBe('Somchai')
        expect(res2.cleanPhone).toBe('021234567')
    })

    it('should accept valid 10-digit mobile numbers formatted or raw', () => {
        const res1 = validateContactInfo('คุณสมชาย', '0812345678')
        expect(res1.isValid).toBe(true)
        expect(res1.cleanPhone).toBe('0812345678')

        const res2 = validateContactInfo('IN THE HAUS', '098-528-4217')
        expect(res2.isValid).toBe(true)
        expect(res2.cleanPhone).toBe('0985284217')
    })
})
