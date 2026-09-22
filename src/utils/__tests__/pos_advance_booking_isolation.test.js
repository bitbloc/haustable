import { describe, it, expect } from 'vitest';
import { getReservationDiffMins, formatReservationCountdown } from '../../pos/POSTableGrid';

describe('POS Advance Booking & Walk-in Isolation Test Suite', () => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).toISOString();
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

    // Helper mirroring POSTableGrid status computation logic
    function computeTableGridStatus(tables, bookings, now = new Date()) {
        return tables.map(t => {
            const tableBookings = bookings.filter(b => b.table_id === t.id && ['pending', 'seated', 'confirmed', 'ready'].includes(b.status));

            // 1. Actively occupying in-store dining booking
            const activeBooking = tableBookings.find(b => {
                if (['completed', 'void', 'cancelled', 'no_show'].includes(b.status)) return false;
                if (b.booking_time) {
                    const bTime = new Date(b.booking_time);
                    if (now.getTime() - bTime.getTime() > 16 * 60 * 60 * 1000) return false;
                }
                const isToday = b.booking_time >= startOfToday && b.booking_time <= endOfToday;
                const isWalkInOrQR = b.booking_type === 'walk_in' || b.booking_type === 'qr' || (b.staff_remark || '').toLowerCase().includes('qr');

                if (b.status === 'seated') {
                    return isToday || (b.booking_time && (now.getTime() - new Date(b.booking_time).getTime() < 12 * 60 * 60 * 1000));
                }
                if (isToday && b.status === 'ready' && b.booking_type !== 'pickup') return true;
                if (isToday && b.status === 'pending' && isWalkInOrQR) return true;
                return false;
            });

            // 2. Upcoming advance reservation
            const upcomingRes = tableBookings.find(b => {
                if (b.id === activeBooking?.id) return false;
                if (['completed', 'void', 'cancelled', 'no_show', 'seated'].includes(b.status)) return false;
                const bTime = new Date(b.booking_time);
                const isToday = b.booking_time >= startOfToday && b.booking_time <= endOfToday;
                return isToday && (bTime.getTime() > now.getTime() - 30 * 60000);
            });

            const diffMins = upcomingRes ? getReservationDiffMins(upcomingRes.booking_time, now) : 9999;
            const isUpcomingImminent = upcomingRes && diffMins <= 45;
            const isUpcomingFar = upcomingRes && diffMins > 45;

            let status = 'free';
            if (activeBooking) {
                status = activeBooking.status === 'pending' ? 'pending' : 'occupied';
            } else if (isUpcomingImminent) {
                status = 'reserved';
            } else {
                status = 'free';
            }

            const hasRealConflict = Boolean(activeBooking && upcomingRes && diffMins <= 60);

            return {
                ...t,
                status,
                booking: activeBooking || null,
                upcomingReservation: upcomingRes || null,
                isAdvanceReserved: Boolean(isUpcomingFar),
                reservationDiffMins: diffMins,
                upcomingConflict: hasRealConflict ? upcomingRes : null
            };
        });
    }

    const mockTables = [
        { id: 't1', table_name: 'H1', capacity: 4 },
        { id: 't2', table_name: 'H2', capacity: 2 },
        { id: 't3', table_name: 'VIP-1', capacity: 6 }
    ];

    it('Scenario 1: Advance reservation > 45 mins keeps table status as "free" with isAdvanceReserved: true', () => {
        // Reservation is at 19:30, current time is 17:00 (150 mins away)
        const resTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 19, 30, 0).toISOString();
        const mockBookings = [
            {
                id: 'b-online-1930',
                table_id: 't1',
                status: 'confirmed',
                booking_type: 'dine_in',
                booking_time: resTime,
                pickup_contact_name: 'คุณสมชาย',
                pax: 4
            }
        ];

        const now = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 0, 0);
        const merged = computeTableGridStatus(mockTables, mockBookings, now);

        const tableH1 = merged.find(t => t.id === 't1');
        expect(tableH1.status).toBe('free');
        expect(tableH1.isAdvanceReserved).toBe(true);
        expect(tableH1.reservationDiffMins).toBe(150);
        expect(tableH1.upcomingReservation).toBeDefined();
        expect(tableH1.upcomingReservation.id).toBe('b-online-1930');
        expect(tableH1.booking).toBeNull(); // No active seated dining session
    });

    it('Scenario 2: Advance reservation <= 45 mins turns table status to "reserved" (buffer window)', () => {
        // Reservation is at 18:00, current time is 17:30 (30 mins away)
        const resTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 0, 0).toISOString();
        const mockBookings = [
            {
                id: 'b-online-1800',
                table_id: 't1',
                status: 'confirmed',
                booking_type: 'dine_in',
                booking_time: resTime,
                pickup_contact_name: 'คุณวิภา',
                pax: 2
            }
        ];

        const now = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 30, 0);
        const merged = computeTableGridStatus(mockTables, mockBookings, now);

        const tableH1 = merged.find(t => t.id === 't1');
        expect(tableH1.status).toBe('reserved');
        expect(tableH1.isAdvanceReserved).toBe(false);
        expect(tableH1.reservationDiffMins).toBe(30);
    });

    it('Scenario 3: Filter "ว่าง" includes free tables with advance reservations, allowing cashiers to seat walk-ins', () => {
        const resTimeFar = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 20, 0, 0).toISOString();
        const resTimeNear = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 30, 0).toISOString();
        const mockBookings = [
            { id: 'b-far', table_id: 't1', status: 'confirmed', booking_time: resTimeFar },
            { id: 'b-near', table_id: 't2', status: 'confirmed', booking_time: resTimeNear }
        ];

        const now = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 0, 0);
        const merged = computeTableGridStatus(mockTables, mockBookings, now);

        // Filter logic from POSTableGrid:
        const filterFree = merged.filter(t => t.status === 'free');
        const filterReserved = merged.filter(t => t.status === 'reserved' || t.status === 'booked');

        // H1 (far reservation) and VIP-1 (no reservation) must be in Free
        expect(filterFree.map(t => t.id)).toEqual(['t1', 't3']);

        // H2 (near reservation <= 45m) must be in Reserved
        expect(filterReserved.map(t => t.id)).toEqual(['t2']);
    });

    it('Scenario 4: When a walk-in is seated on a table with a reservation > 60m away, no conflict is flagged', () => {
        // Table H1 has a walk-in seated at 16:30, and a reservation at 19:30 (150 mins away from 17:00)
        const walkInTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 30, 0).toISOString();
        const resTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 19, 30, 0).toISOString();

        const mockBookings = [
            {
                id: 'b-walkin-101',
                table_id: 't1',
                status: 'seated',
                booking_type: 'walk_in',
                booking_time: walkInTime,
                pax: 2
            },
            {
                id: 'b-online-202',
                table_id: 't1',
                status: 'confirmed',
                booking_type: 'dine_in',
                booking_time: resTime,
                pickup_contact_name: 'คุณกิตติ',
                pax: 4
            }
        ];

        const now = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 0, 0);
        const merged = computeTableGridStatus(mockTables, mockBookings, now);

        const tableH1 = merged.find(t => t.id === 't1');
        expect(tableH1.status).toBe('occupied');
        expect(tableH1.booking.id).toBe('b-walkin-101');
        expect(tableH1.upcomingReservation.id).toBe('b-online-202');
        // Because diff is 150 mins (> 60 mins), NO conflict alert
        expect(tableH1.upcomingConflict).toBeNull();
    });

    it('Scenario 5: When walk-in is seated and upcoming reservation is <= 60m away, conflict is flagged', () => {
        const walkInTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 30, 0).toISOString();
        const resTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 45, 0).toISOString();

        const mockBookings = [
            {
                id: 'b-walkin-101',
                table_id: 't1',
                status: 'seated',
                booking_type: 'walk_in',
                booking_time: walkInTime,
                pax: 2
            },
            {
                id: 'b-online-202',
                table_id: 't1',
                status: 'confirmed',
                booking_type: 'dine_in',
                booking_time: resTime,
                pickup_contact_name: 'คุณกิตติ',
                pax: 4
            }
        ];

        const now = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 0, 0); // 45m until 17:45
        const merged = computeTableGridStatus(mockTables, mockBookings, now);

        const tableH1 = merged.find(t => t.id === 't1');
        expect(tableH1.status).toBe('occupied');
        expect(tableH1.upcomingConflict).toBeDefined();
        expect(tableH1.upcomingConflict.id).toBe('b-online-202');
        expect(tableH1.upcomingConflict.pickup_contact_name).toBe('คุณกิตติ');
    });

    it('Scenario 6: formatReservationCountdown produces clean Dieter Rams Thai typography without emojis', () => {
        const now = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 0, 0);
        
        // 25 mins future
        const t25 = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 25, 0).toISOString();
        expect(formatReservationCountdown(t25, now)).toBe('อีก 25 นาที');

        // 2 hours future
        const t120 = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 19, 0, 0).toISOString();
        expect(formatReservationCountdown(t120, now)).toBe('อีก 2 ชม.');

        // 2 hours 15 mins future
        const t135 = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 19, 15, 0).toISOString();
        expect(formatReservationCountdown(t135, now)).toBe('อีก 2ชม.15น.');

        // Overdue by 10 mins
        const tOverdue10 = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 50, 0).toISOString();
        expect(formatReservationCountdown(tOverdue10, now)).toBe('เลย 10น.');

        // Verify zero emojis
        const countdownStr = formatReservationCountdown(t135, now);
        expect(/[\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(countdownStr)).toBe(false);
    });
});
