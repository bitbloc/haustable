import { describe, it, expect, vi } from 'vitest'
vi.mock('../../lib/supabaseClient', () => ({ supabase: {} }))
import { isNetworkError } from '../../hooks/usePOSOrder'

describe('isNetworkError (checkout offline fallback)', () => {
    it('treats a lost connection as offline', () => {
        expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
        expect(isNetworkError({ message: 'NetworkError when attempting to fetch resource.' })).toBe(true)
        expect(isNetworkError({ message: 'Request timed out' })).toBe(true)
    })
    it('never queues a database refusal as offline', () => {
        expect(isNetworkError({ code: '42501', message: 'permission denied for table bookings' })).toBe(false)
        expect(isNetworkError({ code: 'PGRST204', message: "Could not find the 'completed_at' column" })).toBe(false)
        expect(isNetworkError({ code: '23514', message: 'violates check constraint' })).toBe(false)
    })
})
