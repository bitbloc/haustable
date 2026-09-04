import { describe, it, expect } from 'vitest';

describe('Daily Revenue & Date Filtering Resilience', () => {
    it('should strictly filter daily bookings by booking_time or created_at, ignoring stale updated_at', () => {
        const selectedDate = '2026-09-04';

        const mockBookings = [
            // Real today's order
            {
                id: 'today-1',
                booking_time: '2026-09-04T05:11:22.945+00:00',
                created_at: '2026-09-04T05:11:22.945+00:00',
                updated_at: '2026-09-04T11:15:00.000+00:00',
                status: 'completed',
                total_amount: 1622,
                booking_type: 'walk_in',
                staff_remark: 'Paid by QR'
            },
            // Another real today's order
            {
                id: 'today-2',
                booking_time: '2026-09-04T06:34:06.493+00:00',
                created_at: '2026-09-04T06:34:06.493+00:00',
                updated_at: '2026-09-04T11:15:00.000+00:00',
                status: 'completed',
                total_amount: 85,
                booking_type: 'pickup',
                staff_remark: 'Paid by CASH'
            },
            // Historical order from 2026-08-15 touched today by DB migration (updated_at is today!)
            {
                id: 'historical-1',
                booking_time: '2026-08-15T07:20:00.000+00:00',
                created_at: '2026-08-15T07:20:00.000+00:00',
                updated_at: '2026-09-04T11:15:00.000+00:00', // Today's timestamp!
                status: 'completed',
                total_amount: 500000, // Massive historical amount
                booking_type: 'walk_in',
                staff_remark: 'Paid by CASH'
            },
            // Historical order from 2026-07-01 touched today
            {
                id: 'historical-2',
                booking_time: '2026-07-01T12:00:00.000+00:00',
                created_at: '2026-07-01T12:00:00.000+00:00',
                updated_at: '2026-09-04T11:15:00.000+00:00', // Today's timestamp!
                status: 'completed',
                total_amount: 1200000,
                booking_type: 'dine_in',
                staff_remark: 'Paid by CASH'
            }
        ];

        // Filtering logic matching AdminDashboard.jsx
        const filtered = mockBookings.filter(b => {
            const bDate = new Date(b.booking_time || b.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
            return bDate === selectedDate;
        });

        expect(filtered.length).toBe(2);
        expect(filtered.map(b => b.id)).toEqual(['today-1', 'today-2']);

        const totalRev = filtered.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
        expect(totalRev).toBe(1707); // 1622 + 85, NOT 1,701,707!
    });
});
