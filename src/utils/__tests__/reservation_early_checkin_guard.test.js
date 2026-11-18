import { describe, it, expect, vi, beforeEach } from 'vitest'

// Replays the 2026-11-17 H4 incident: walk-in seated 11:00, 18:00 online reservation checked in at 11:04.
const cache = { bookings: [] }
vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }))
vi.mock('../offlineHelper', () => ({
    isOnline: () => false,
    posCache: { getBookings: () => cache.bookings }
}))

import { buildEarlyCheckInWarning, guardReservationCheckIn, getMinutesUntilBooking } from '../reservationCheckIn'
import { pickActiveTableSession } from '../tableTransferHelper'
import { isFutureDineInAppointment } from '../printerHelper'

const at = (hhmm) => new Date(`2026-11-17T${hhmm}:00+07:00`)

const walkIn = {
    id: 'walkin', table_id: 2, status: 'seated', booking_type: 'walk_in', source: 'pos',
    booking_time: at('11:00').toISOString(), staff_remark: 'Walk-in Guest', order_items: [{ id: 1 }]
}
const reservation = {
    id: 'res', table_id: 2, status: 'confirmed', booking_type: 'dine_in', source: 'qr',
    booking_time: at('18:00').toISOString(), pickup_contact_name: 'สตางค์',
    staff_remark: '[QR] [ONLINE] จองโต๊ะล่วงหน้า [STAFF_CONFIRMED]', order_items: [{ id: 2 }]
}

describe('early reservation check-in guard', () => {
    beforeEach(() => { cache.bookings = [] })

    it('warns when checking in hours before the booked time', () => {
        expect(getMinutesUntilBooking(reservation, at('11:04'))).toBe(416)
        const msg = buildEarlyCheckInWarning(reservation, at('11:04'))
        expect(msg).toContain('18:00')
        expect(msg).toContain('ยังไม่ถึงเวลาจอง')
        expect(msg).toContain('พิมพ์เข้าครัวทันที')
    })

    it('does not warn inside the normal arrival window or when late', () => {
        expect(buildEarlyCheckInWarning(reservation, at('17:15'))).toBeNull()
        expect(buildEarlyCheckInWarning(reservation, at('18:20'))).toBeNull()
    })

    it('blocks seating a reservation on a table a walk-in is sitting at', async () => {
        cache.bookings = [walkIn, reservation]
        const onBlocked = vi.fn()
        const confirm = vi.fn(() => true)
        // The clock is the incident's: a session older than 16 hours no longer counts as seated,
        // so on the real clock this test only passed on 2026-11-17 itself
        vi.useFakeTimers(); vi.setSystemTime(at('11:04'))
        try {
            const ok = await guardReservationCheckIn(reservation, { tableName: 'H4', onBlocked, confirm })
            expect(ok).toBe(false)
            expect(onBlocked).toHaveBeenCalledWith(expect.stringContaining('โต๊ะ H4 มีลูกค้านั่งอยู่'))
            expect(confirm).not.toHaveBeenCalled()
        } finally { vi.useRealTimers() }
    })

    it('respects the cashier answer on the early-check-in question for a free table', async () => {
        cache.bookings = [reservation]
        vi.useFakeTimers(); vi.setSystemTime(at('11:04'))
        try {
            expect(await guardReservationCheckIn(reservation, { confirm: () => false })).toBe(false)
            expect(await guardReservationCheckIn(reservation, { confirm: () => true })).toBe(true)
        } finally { vi.useRealTimers() }
    })
})

describe('pickActiveTableSession', () => {
    it('shows the walk-in in progress, not a reservation seated hours early', () => {
        const earlySeated = { ...reservation, status: 'seated' }
        // Query order is booking_time desc, so the 18:00 row comes first
        expect(pickActiveTableSession([earlySeated, walkIn], at('11:10'), () => true).id).toBe('walkin')
    })

    it('prefers seated over pending when both have started', () => {
        const qrPending = { ...walkIn, id: 'qr', status: 'pending', booking_time: at('11:05').toISOString() }
        expect(pickActiveTableSession([qrPending, walkIn], at('11:10'), () => true).id).toBe('walkin')
    })

    it('returns null for an empty table', () => {
        expect(pickActiveTableSession([], at('11:10'))).toBeNull()
    })
})

describe('kitchen slip appointment line', () => {
    it('flags a dine-in pre-order printed long before the booked time', () => {
        expect(isFutureDineInAppointment(reservation, false, at('11:04').getTime())).toBe(true)
        expect(isFutureDineInAppointment(reservation, false, at('17:45').getTime())).toBe(false)
        expect(isFutureDineInAppointment(reservation, true, at('11:04').getTime())).toBe(false)
    })
})
