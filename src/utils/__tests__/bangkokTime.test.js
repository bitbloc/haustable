import { describe, it, expect } from 'vitest'
import { getPickupSlots, getLastOrderTime, getPickupDateStr, isWithinBangkokHours, bangkokNow } from '../bangkokTime'
import { isTableTooSmall } from '../tableCapacity'

// 2026-11-17 is after the 2026-11-08 hours change (open 11:00, close 21:30, last order 20:45)
const at = (bkkIso) => new Date(bkkIso) // ISO strings below carry +07:00

describe('pickup slots end at last order, Bangkok time', () => {
    const base = { openingTime: '11:00', closingTime: '21:30', kitchenCloseTime: '20:45', minAdvanceHours: 1 }

    it('tomorrow: 11:00 to 20:45 every 15 min, never 21:00-21:30', () => {
        const slots = getPickupSlots({ ...base, day: 'tomorrow', now: at('2026-11-17T09:00:00+07:00') })
        expect(slots[0]).toBe('11:00')
        expect(slots[slots.length - 1]).toBe('20:45')
        expect(slots).not.toContain('21:00')
        expect(slots).not.toContain('21:30')
        expect(slots).toHaveLength(40) // 11:00..20:45 inclusive
    })

    it('falls back to storeHours last order (20:45) when the setting is missing', () => {
        const slots = getPickupSlots({ openingTime: '11:00', closingTime: '21:30', day: 'tomorrow', now: at('2026-11-17T09:00:00+07:00') })
        expect(slots[slots.length - 1]).toBe('20:45')
    })

    it('never goes past closing time even if the kitchen setting is later', () => {
        expect(getLastOrderTime({ kitchenCloseTime: '22:00', closingTime: '21:30' })).toBe('21:30')
    })

    it('today uses the Bangkok clock, not the device clock', () => {
        // 18:10 Bangkok = 11:10 UTC. A UTC phone would think it is 11:10 and offer 12:15 onwards.
        const now = new Date('2026-11-17T11:10:00Z')
        expect(bangkokNow(now)).toEqual({ dateStr: '2026-11-17', minutes: 18 * 60 + 10 })
        const slots = getPickupSlots({ ...base, day: 'today', now })
        expect(slots[0]).toBe('19:15') // first slot after 18:10 + 1 h
        expect(slots[slots.length - 1]).toBe('20:45')
    })

    it('today after 19:45 (+1 h advance passes 20:45): no slots left', () => {
        const slots = getPickupSlots({ ...base, day: 'today', now: at('2026-11-17T19:50:00+07:00') })
        expect(slots).toEqual([])
    })

    it('tomorrow rolls over the date at Bangkok midnight', () => {
        // 23:30 Bangkok on the 17th is 16:30 UTC the same day
        expect(getPickupDateStr('today', new Date('2026-11-17T16:30:00Z'))).toBe('2026-11-17')
        expect(getPickupDateStr('tomorrow', new Date('2026-11-17T16:30:00Z'))).toBe('2026-11-18')
        // 00:30 Bangkok on the 18th is still the 17th in UTC
        expect(getPickupDateStr('today', new Date('2026-11-17T17:30:00Z'))).toBe('2026-11-18')
    })
})

describe('service guard window (Bangkok)', () => {
    it('open at 20:44, closed at 20:45 when the cutoff is last order', () => {
        expect(isWithinBangkokHours('11:00', '20:45', at('2026-11-17T20:44:00+07:00'))).toBe(true)
        expect(isWithinBangkokHours('11:00', '20:45', at('2026-11-17T20:45:00+07:00'))).toBe(false)
    })
    it('closed before opening', () => {
        expect(isWithinBangkokHours('11:00', '20:45', at('2026-11-17T10:59:00+07:00'))).toBe(false)
    })
})

describe('table capacity', () => {
    it('blocks a table smaller than the party, allows equal or larger, ignores unset capacity', () => {
        expect(isTableTooSmall({ capacity: 2 }, 4)).toBe(true)
        expect(isTableTooSmall({ capacity: 4 }, 4)).toBe(false)
        expect(isTableTooSmall({ capacity: 6 }, 4)).toBe(false)
        expect(isTableTooSmall({ capacity: 0 }, 4)).toBe(false)
        expect(isTableTooSmall({ capacity: null }, 4)).toBe(false)
    })
})
