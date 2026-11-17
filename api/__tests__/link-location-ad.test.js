import { describe, it, expect } from 'vitest'
import { isLocationAd } from '../link.js'

// utm_content decides whether /link opens with the location-first banner
describe('isLocationAd', () => {
    it('is true for a location ad', () => {
        expect(isLocationAd('naga_location')).toBe(true)
    })
    it('is false for a pickup ad whose token only starts with "loc"', () => {
        expect(isLocationAd('local_pickup')).toBe(false)
    })
    it('is false for a menu ad', () => {
        expect(isLocationAd('menu_special')).toBe(false)
    })
})
