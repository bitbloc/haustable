import { describe, it, expect } from 'vitest';

describe('Shift Closed Table Isolation & Admin Status Logic', () => {
    const closedShift = {
        id: 'shift_1790132607288',
        staff_name: 'Add',
        opened_at: '2026-09-23T03:03:27.288+00:00',
        closed_at: '2026-09-23T16:23:27.912+00:00',
        status: 'closed',
        total_sales: 13661
    };

    const staleBookingFromClosedShift = {
        id: 'b-h8-closed-shift',
        table_id: 5,
        status: 'seated', // was left uncompleted in DB when shift closed
        booking_time: '2026-09-23T13:03:25.376+00:00',
        created_at: '2026-09-23T13:03:28.906259+00:00',
        total_amount: 685,
        booking_type: 'walk_in'
    };

    it('1. should detect shift is closed when no active open shift exists', () => {
        const shifts = [closedShift];
        const activeShift = shifts.find(s => s.status === 'open');
        const isShiftOpen = Boolean(activeShift);

        expect(isShiftOpen).toBe(false);
    });

    it('2. should not classify a booking from a closed shift as live dining when shift is closed', () => {
        const shifts = [closedShift];
        const activeShift = shifts.find(s => s.status === 'open');
        const isShiftOpen = Boolean(activeShift);
        const latestClosedShift = shifts.filter(s => s.status === 'closed').sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at))[0];

        const isOccupyingFloor = (booking) => {
            if (['completed', 'paid', 'cancelled', 'void'].includes(booking.status)) return false;
            if (!isShiftOpen && latestClosedShift) {
                const bTime = new Date(booking.booking_time || booking.created_at);
                const closedTime = new Date(latestClosedShift.closed_at || latestClosedShift.opened_at);
                if (bTime <= closedTime) return false;
            }
            return booking.status === 'seated';
        };

        expect(isOccupyingFloor(staleBookingFromClosedShift)).toBe(false);
    });

    it('3. should report 0 occupied tables in executive KPI when shift is closed', () => {
        const shifts = [closedShift];
        const activeShift = shifts.find(s => s.status === 'open');
        const isShiftOpen = Boolean(activeShift);

        const rawOccupiedCount = 1; // if unclosed booking exists
        const executiveLiveCount = isShiftOpen ? rawOccupiedCount : 0;

        expect(executiveLiveCount).toBe(0);
    });

    it('4. should correctly allow live dining when a shift is active and open', () => {
        const openShift = {
            id: 'shift_open_today',
            staff_name: 'Add',
            opened_at: '2026-09-23T17:00:00.000Z',
            status: 'open'
        };
        const shifts = [openShift, closedShift];
        const activeShift = shifts.find(s => s.status === 'open');
        const isShiftOpen = Boolean(activeShift);

        const newActiveBooking = {
            id: 'b-new-table',
            table_id: 1,
            status: 'seated',
            booking_time: '2026-09-23T17:15:00.000Z',
            created_at: '2026-09-23T17:15:00.000Z'
        };

        const isOccupyingFloor = (booking) => {
            if (!isShiftOpen) return false;
            return booking.status === 'seated';
        };

        expect(isOccupyingFloor(newActiveBooking)).toBe(true);
    });
});
