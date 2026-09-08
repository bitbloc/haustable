import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('HAUSMADE Cart Session & Legacy Purge', () => {
    let mockLocalStorage = {}
    let mockSessionStorage = {}

    beforeEach(() => {
        mockLocalStorage = {}
        mockSessionStorage = {}

        global.localStorage = {
            getItem: vi.fn((k) => mockLocalStorage[k] || null),
            setItem: vi.fn((k, v) => { mockLocalStorage[k] = String(v) }),
            removeItem: vi.fn((k) => { delete mockLocalStorage[k] }),
            clear: vi.fn(() => { mockLocalStorage = {} })
        }

        global.sessionStorage = {
            getItem: vi.fn((k) => mockSessionStorage[k] || null),
            setItem: vi.fn((k, v) => { mockSessionStorage[k] = String(v) }),
            removeItem: vi.fn((k) => { delete mockSessionStorage[k] }),
            clear: vi.fn(() => { mockSessionStorage = {} })
        }
    })

    it('should purge old persistent localStorage keys immediately', () => {
        mockLocalStorage['hausmade_cart_items_v2'] = JSON.stringify([{ id: 153, name: 'Pre-order เสื้อจริตจัด' }])
        mockLocalStorage['hausmade_cart_items'] = JSON.stringify([{ id: 100 }])

        const LEGACY_STORAGE_KEYS = [
            'hausmade_cart_items_v2',
            'hausmade_cart_items_v1',
            'hausmade_cart_items',
            'hausmade_cart'
        ]

        LEGACY_STORAGE_KEYS.forEach(key => localStorage.removeItem(key))

        expect(localStorage.getItem('hausmade_cart_items_v2')).toBeNull()
        expect(localStorage.getItem('hausmade_cart_items')).toBeNull()
    })

    it('should expire session items if older than 2 hours', () => {
        const CART_MAX_AGE_MS = 2 * 60 * 60 * 1000
        const threeHoursAgo = Date.now() - (3 * 60 * 60 * 1000)
        
        mockSessionStorage['hausmade_cart_session_v3'] = JSON.stringify({
            items: [{ id: 153, name: 'Pre-order เสื้อจริตจัด', quantity: 1, price: 690 }],
            timestamp: threeHoursAgo
        })

        const raw = sessionStorage.getItem('hausmade_cart_session_v3')
        const parsed = JSON.parse(raw)
        
        let cart = []
        if (parsed?.timestamp && (Date.now() - parsed.timestamp > CART_MAX_AGE_MS)) {
            sessionStorage.removeItem('hausmade_cart_session_v3')
            cart = []
        } else {
            cart = parsed.items
        }

        expect(cart).toEqual([])
        expect(sessionStorage.getItem('hausmade_cart_session_v3')).toBeNull()
    })

    it('should retain active items within 2 hours in sessionStorage', () => {
        const CART_MAX_AGE_MS = 2 * 60 * 60 * 1000
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000)
        
        mockSessionStorage['hausmade_cart_session_v3'] = JSON.stringify({
            items: [{ id: 153, name: 'Pre-order เสื้อจริตจัด', quantity: 1, price: 690 }],
            timestamp: tenMinutesAgo
        })

        const raw = sessionStorage.getItem('hausmade_cart_session_v3')
        const parsed = JSON.parse(raw)
        
        let cart = []
        if (parsed?.timestamp && (Date.now() - parsed.timestamp > CART_MAX_AGE_MS)) {
            sessionStorage.removeItem('hausmade_cart_session_v3')
            cart = []
        } else {
            cart = parsed.items
        }

        expect(cart).toHaveLength(1)
        expect(cart[0].id).toBe(153)
    })
})
