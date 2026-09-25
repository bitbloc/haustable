import { describe, it, expect } from 'vitest';
import { calculateEffectiveBookingEnd, isBookingOverlap, checkOverlap } from '../availabilityUtils';

describe('Option 1: Smart Dynamic Turn & Live Seated Protection Test Suite', () => {
    const baseDate = new Date('2026-09-25T12:00:00+07:00');

    it('Scenario 1: Standard 2-hour turn blocks overlapping requests within standard window', () => {
        // Customer seated at 12:00
        const booking = {
            id: 'b-walkin-1',
            table_id: 't1',
            status: 'seated',
            booking_time: '2026-09-25T12:00:00+07:00'
        };

        // Current time is 12:30 (30 mins in)
        const now = new Date('2026-09-25T12:30:00+07:00');
        const end = calculateEffectiveBookingEnd(booking, { now, defaultDurationHours: 2, liveBufferMinutes: 30 });
        
        // Standard end is 14:00 (12:00 + 2h). now + 30m is 13:00 <= 14:00
        expect(end.toISOString()).toBe(new Date('2026-09-25T14:00:00+07:00').toISOString());

        // Online customer requests 13:00 - 15:00
        const reqStart = new Date('2026-09-25T13:00:00+07:00');
        const reqEnd = new Date('2026-09-25T15:00:00+07:00');
        expect(isBookingOverlap(reqStart, reqEnd, booking, { now, defaultDurationHours: 2, liveBufferMinutes: 30 })).toBe(true);

        // Online customer requests 14:00 - 16:00 (Exactly after 2h turn)
        const reqAfterStart = new Date('2026-09-25T14:00:00+07:00');
        const reqAfterEnd = new Date('2026-09-25T16:00:00+07:00');
        expect(isBookingOverlap(reqAfterStart, reqAfterEnd, booking, { now, defaultDurationHours: 2, liveBufferMinutes: 30 })).toBe(false);
    });

    it('Scenario 2: Stale Seated Protection - Guest sits for 2h30m without checkout, dynamically extends end time', () => {
        // Customer seated at 12:00
        const booking = {
            id: 'b-walkin-long',
            table_id: 't1',
            status: 'seated',
            booking_time: '2026-09-25T12:00:00+07:00'
        };

        // It is now 14:30 (2.5 hours later) and the customer is STILL seated!
        const now = new Date('2026-09-25T14:30:00+07:00');
        const end = calculateEffectiveBookingEnd(booking, { now, defaultDurationHours: 2, liveBufferMinutes: 30 });

        // Without dynamic protection, end would have expired at 14:00.
        // With Live Seated Protection, end extends to now + 30 mins = 15:00!
        expect(end.toISOString()).toBe(new Date('2026-09-25T15:00:00+07:00').toISOString());

        // Online customer tries to book 14:45 - 16:45 (thinking table is free because 2h passed)
        const reqOverlapStart = new Date('2026-09-25T14:45:00+07:00');
        const reqOverlapEnd = new Date('2026-09-25T16:45:00+07:00');
        // Live Seated Protection detects overlap and BLOCKS double-booking!
        expect(isBookingOverlap(reqOverlapStart, reqOverlapEnd, booking, { now, defaultDurationHours: 2, liveBufferMinutes: 30 })).toBe(true);

        // However, a slot at 15:00 (after the 30 min buffer) is permitted
        const reqSafeStart = new Date('2026-09-25T15:00:00+07:00');
        const reqSafeEnd = new Date('2026-09-25T17:00:00+07:00');
        expect(isBookingOverlap(reqSafeStart, reqSafeEnd, booking, { now, defaultDurationHours: 2, liveBufferMinutes: 30 })).toBe(false);
    });

    it('Scenario 3: Instant Clearance on Checkout - Table is immediately available when status is completed', () => {
        // Guest checks out early at 13:00 (after 1 hour)
        const completedBooking = {
            id: 'b-walkin-done',
            table_id: 't1',
            status: 'completed',
            booking_time: '2026-09-25T12:00:00+07:00',
            end_time: '2026-09-25T13:00:00+07:00'
        };

        const now = new Date('2026-09-25T13:05:00+07:00');
        const reqStart = new Date('2026-09-25T13:15:00+07:00');
        const reqEnd = new Date('2026-09-25T15:15:00+07:00');

        // Since status is completed, table is immediately freed for online bookings
        expect(isBookingOverlap(reqStart, reqEnd, completedBooking, { now, defaultDurationHours: 2, liveBufferMinutes: 30 })).toBe(false);
    });

    it('Scenario 4: Cancelled, void, and no_show bookings never block tables', () => {
        const voidBooking = {
            id: 'b-void',
            table_id: 't1',
            status: 'void',
            booking_time: '2026-09-25T12:00:00+07:00'
        };
        const cancelledBooking = {
            id: 'b-cancel',
            table_id: 't1',
            status: 'cancelled',
            booking_time: '2026-09-25T12:00:00+07:00'
        };

        const reqStart = new Date('2026-09-25T12:30:00+07:00');
        const reqEnd = new Date('2026-09-25T14:30:00+07:00');
        expect(isBookingOverlap(reqStart, reqEnd, voidBooking)).toBe(false);
        expect(isBookingOverlap(reqStart, reqEnd, cancelledBooking)).toBe(false);
    });

    it('Scenario 5: checkOverlap backward compatibility for existing callers', () => {
        const reqStart = new Date('2026-09-25T12:00:00+07:00');
        const reqEnd = new Date('2026-09-25T14:00:00+07:00');
        const bookingStart = '2026-09-25T13:00:00+07:00';

        expect(checkOverlap(reqStart, reqEnd, bookingStart, 2)).toBe(true);
        expect(checkOverlap(reqStart, reqEnd, '2026-09-25T14:00:00+07:00', 2)).toBe(false);
    });
});
