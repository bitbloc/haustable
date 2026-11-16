import { describe, it, expect } from 'vitest'
import { refundBookingLoyaltyIfNeeded } from '../availabilityUtils'

// Minimal Supabase stand-in: records writes, and lets a test decide how many profile rows an update "hits"
function fakeSupabase({ profile, profileRowsUpdated = 1, profileError = null }) {
    const writes = []
    const from = (table) => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }) }),
        update: (values) => {
            writes.push({ table, values })
            const result = table === 'profiles'
                ? { data: profileError ? null : Array.from({ length: profileRowsUpdated }, () => ({ id: 'u1' })), error: profileError }
                : { data: null, error: null }
            return { eq: () => Object.assign(Promise.resolve(result), { select: async () => result }) }
        }
    })
    return { client: { from }, writes }
}

const booking = { id: 'b1', user_id: 'u1', status: 'cancelled', xhaus_redeemed: 50, staff_remark: '[ONLINE_PICKUP] [PAY_AT_STORE]' }
const profile = { xhaus_balance: 100, total_redeemed_xhaus: 50, free_drink_quota: 0 }

describe('refundBookingLoyaltyIfNeeded', () => {
    it('refunds coins and tags the booking when the profile row is updated', async () => {
        const { client, writes } = fakeSupabase({ profile })
        expect(await refundBookingLoyaltyIfNeeded(booking, client)).toBe(true)
        expect(writes[0]).toEqual({ table: 'profiles', values: { xhaus_balance: 150, total_redeemed_xhaus: 0 } })
        expect(writes[1].table).toBe('bookings')
        expect(writes[1].values.staff_remark).toContain('[LOYALTY_REFUNDED]')
    })

    it('does not tag the booking when RLS silently blocks the profile write', async () => {
        const { client, writes } = fakeSupabase({ profile, profileRowsUpdated: 0 })
        expect(await refundBookingLoyaltyIfNeeded(booking, client)).toBe(false)
        expect(writes.some(w => w.table === 'bookings')).toBe(false)
    })

    it('does not tag the booking when the profile write errors', async () => {
        const { client, writes } = fakeSupabase({ profile, profileError: { message: 'denied' } })
        expect(await refundBookingLoyaltyIfNeeded(booking, client)).toBe(false)
        expect(writes.some(w => w.table === 'bookings')).toBe(false)
    })

    it('lets the database do the refund when refund_booking_loyalty is installed', async () => {
        const { client, writes } = fakeSupabase({ profile })
        const calls = []
        client.rpc = async (name, args) => { calls.push({ name, args }); return { data: true, error: null } }
        expect(await refundBookingLoyaltyIfNeeded(booking, client)).toBe(true)
        expect(calls).toEqual([{ name: 'refund_booking_loyalty', args: { p_booking_id: 'b1' } }])
        expect(writes).toHaveLength(0)
    })

    it('reports no refund, and writes nothing, when the database declines it', async () => {
        const { client, writes } = fakeSupabase({ profile })
        client.rpc = async () => ({ data: false, error: null })
        expect(await refundBookingLoyaltyIfNeeded(booking, client)).toBe(false)
        client.rpc = async () => ({ data: null, error: { code: '42501', message: 'denied' } })
        expect(await refundBookingLoyaltyIfNeeded(booking, client)).toBe(false)
        expect(writes).toHaveLength(0)
    })

    it('falls back to the direct writes when the function is not installed yet', async () => {
        const { client, writes } = fakeSupabase({ profile })
        client.rpc = async () => ({ data: null, error: { code: 'PGRST202', message: 'not found' } })
        expect(await refundBookingLoyaltyIfNeeded(booking, client)).toBe(true)
        expect(writes[0].table).toBe('profiles')
        expect(writes[1].values.staff_remark).toContain('[LOYALTY_REFUNDED]')
    })

    it('skips bookings already refunded', async () => {
        const { client, writes } = fakeSupabase({ profile })
        expect(await refundBookingLoyaltyIfNeeded({ ...booking, staff_remark: '[LOYALTY_REFUNDED]' }, client)).toBe(false)
        expect(writes).toHaveLength(0)
    })
})
