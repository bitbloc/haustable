import { describe, it, expect } from 'vitest'
import { checkOverlap } from '../../utils/availabilityUtils' // Correct path

describe('availabilityUtils Logic', () => {

    it('should detect direct overlap', () => {
        const reqStart = new Date('2024-01-01T12:00:00')
        const reqEnd = new Date('2024-01-01T14:00:00')
        
        const bookingStart = '2024-01-01T13:00:00' // Overlaps 13-15
        
        expect(checkOverlap(reqStart, reqEnd, bookingStart)).toBe(true)
    })

    it('should NOT detect non-overlap (before)', () => {
        const reqStart = new Date('2024-01-01T12:00:00')
        const reqEnd = new Date('2024-01-01T14:00:00')
        
        const bookingStart = '2024-01-01T14:00:00' // Starts exactly when req ends
        
        expect(checkOverlap(reqStart, reqEnd, bookingStart)).toBe(false)
    })

    it('should NOT detect non-overlap (after)', () => {
        const reqStart = new Date('2024-01-01T14:00:00')
        const reqEnd = new Date('2024-01-01T16:00:00')
        
        const bookingStart = '2024-01-01T12:00:00' // Ends at 14:00
        
        expect(checkOverlap(reqStart, reqEnd, bookingStart)).toBe(false)
    })
})
