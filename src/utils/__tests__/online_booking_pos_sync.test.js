import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Online Booking and POS Seamless Table Sync', () => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).toISOString();
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

    // Helper mirroring POSTableGrid status computation
    function computeTableGridStatus(tables, bookings, now = new Date()) {
        return tables.map(t => {
            const tableBookings = bookings.filter(b => b.table_id === t.id && ['pending', 'seated', 'confirmed', 'ready'].includes(b.status));

            // 1. Actively occupying in-store dining booking
            let hasActiveWalkInOrQR = false;
            const activeBooking = tableBookings.find(b => {
                if (b.status === 'seated') return true;
                const isToday = b.booking_time >= startOfToday && b.booking_time <= endOfToday;
                const isWalkInOrQR = b.booking_type === 'walk_in' || b.booking_type === 'qr' || (b.staff_remark || '').toLowerCase().includes('qr');
                if (isWalkInOrQR && isToday) {
                    hasActiveWalkInOrQR = true;
                    return true;
                }
                if (isToday && ['seated', 'ready'].includes(b.status)) return true;
                if (isToday && b.status === 'confirmed') {
                    const bTime = new Date(b.booking_time);
                    const diffMins = (bTime.getTime() - now.getTime()) / 60000;
                    if (diffMins <= 30 && diffMins >= -120) return true;
                }
                if (isToday && b.status === 'pending' && isWalkInOrQR) return true;
                return false;
            });

            // 2. Upcoming advance reservation
            const upcomingRes = tableBookings.find(b => {
                if (b.id === activeBooking?.id) return false;
                if (['completed', 'void', 'cancelled', 'no_show'].includes(b.status)) return false;
                const bTime = new Date(b.booking_time);
                return bTime.getTime() > now.getTime() - 15 * 60000;
            });

            let status = 'free';
            if (activeBooking) {
                status = activeBooking.status === 'pending' ? 'pending' : 'occupied';
            } else if (upcomingRes && (upcomingRes.booking_time >= startOfToday && upcomingRes.booking_time <= endOfToday)) {
                status = 'reserved';
            }

            return {
                ...t,
                status,
                booking: activeBooking || null,
                upcomingReservation: upcomingRes || null,
                upcomingConflict: (activeBooking && upcomingRes) ? upcomingRes : null
            };
        });
    }

    const mockTables = [
        { id: 't1', table_name: 'H1', capacity: 4 },
        { id: 't2', table_name: 'H2', capacity: 2 },
        { id: 't3', table_name: 'VIP-1', capacity: 6 }
    ];

    it('identifies tables with upcoming reservations today as reserved', () => {
        const resTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 19, 0, 0).toISOString();
        const mockBookings = [
            {
                id: 'b-online-1',
                table_id: 't1',
                status: 'confirmed',
                booking_type: 'dine_in',
                booking_time: resTime,
                pickup_contact_name: 'คุณสมชาย',
                pax: 4,
                total_amount: 500,
                payment_slip_url: 'slip_123.jpg'
            }
        ];

        // Current time is 16:30 (more than 30 min before reservation)
        const now = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 30, 0);
        const merged = computeTableGridStatus(mockTables, mockBookings, now);

        const tableH1 = merged.find(t => t.id === 't1');
        expect(tableH1.status).toBe('reserved');
        expect(tableH1.upcomingReservation).toBeDefined();
        expect(tableH1.upcomingReservation.pickup_contact_name).toBe('คุณสมชาย');
        expect(tableH1.booking).toBeNull(); // Not yet actively seated
    });

    it('keeps unreserved tables as free', () => {
        const merged = computeTableGridStatus(mockTables, [], new Date());
        expect(merged.every(t => t.status === 'free')).toBe(true);
    });

    it('flags upcomingConflict when a table is currently occupied but has a reservation later today', () => {
        const seatedTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 0, 0).toISOString();
        const resTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 30, 0).toISOString();
        
        const mockBookings = [
            {
                id: 'b-walkin',
                table_id: 't2',
                status: 'seated',
                booking_type: 'walk_in',
                booking_time: seatedTime,
                pax: 2
            },
            {
                id: 'b-reservation',
                table_id: 't2',
                status: 'confirmed',
                booking_type: 'dine_in',
                booking_time: resTime,
                pickup_contact_name: 'คุณวิภา',
                pax: 2
            }
        ];

        const now = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 0, 0);
        const merged = computeTableGridStatus(mockTables, mockBookings, now);

        const tableH2 = merged.find(t => t.id === 't2');
        expect(tableH2.status).toBe('occupied');
        expect(tableH2.booking.id).toBe('b-walkin');
        expect(tableH2.upcomingConflict).toBeDefined();
        expect(tableH2.upcomingConflict.pickup_contact_name).toBe('คุณวิภา');
    });

    it('transitions table to occupied and attaches items once online booking is seated', () => {
        const resTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 0, 0).toISOString();
        const seatedBooking = {
            id: 'b-online-seated',
            table_id: 't3',
            status: 'seated', // Checked in!
            booking_type: 'dine_in',
            booking_time: resTime,
            pickup_contact_name: 'คุณธนภัทร',
            pax: 6,
            total_amount: 1500,
            order_items: [
                { id: 'oi-1', menu_item_id: 'm1', quantity: 2, price_at_time: 250 },
                { id: 'oi-2', menu_item_id: 'm2', quantity: 1, price_at_time: 1000 }
            ]
        };

        const now = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 5, 0);
        const merged = computeTableGridStatus(mockTables, [seatedBooking], now);

        const tableVip = merged.find(t => t.id === 't3');
        expect(tableVip.status).toBe('occupied');
        expect(tableVip.booking.id).toBe('b-online-seated');
        expect(tableVip.booking.order_items.length).toBe(2);
    });

    it('supports statusFilter filtering by reserved cleanly', () => {
        const resTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 20, 0, 0).toISOString();
        const mockBookings = [
            { id: 'b1', table_id: 't1', status: 'confirmed', booking_type: 'dine_in', booking_time: resTime },
            { id: 'b2', table_id: 't2', status: 'seated', booking_type: 'walk_in', booking_time: resTime }
        ];

        const now = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 0, 0);
        const merged = computeTableGridStatus(mockTables, mockBookings, now);
        
        const reservedOnly = merged.filter(t => t.status === 'reserved');
        expect(reservedOnly.length).toBe(1);
        expect(reservedOnly[0].table_name).toBe('H1');

        const freeOnly = merged.filter(t => t.status === 'free');
        expect(freeOnly.length).toBe(1);
        expect(freeOnly[0].table_name).toBe('VIP-1');

        const occupiedOnly = merged.filter(t => t.status === 'occupied');
        expect(occupiedOnly.length).toBe(1);
        expect(occupiedOnly[0].table_name).toBe('H2');
    });
});
