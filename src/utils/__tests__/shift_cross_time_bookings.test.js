import { describe, it, expect } from 'vitest';
import { fetchShiftBookings, calculateShiftMetrics } from '../shiftHelper';

describe('Shift Cross-Time Bookings & Closure Resilience', () => {
    it('should include tables that seated before shift opened but paid during the shift', async () => {
        // Mock shift (18:00 - 23:00)
        const shift = {
            id: 'shift-evening',
            openedAt: '2026-09-12T11:00:00.000Z', // 18:00 Bangkok
            closedAt: '2026-09-12T16:00:00.000Z', // 23:00 Bangkok
            transactions: [
                { bookingId: 'table-cross-1', amount: 1356, paymentMethod: 'qr', timestamp: '2026-09-12T12:30:00.000Z' },
                { bookingId: 'table-regular-1', amount: 298, paymentMethod: 'cash', timestamp: '2026-09-12T12:12:00.000Z' }
            ]
        };

        const mockDb = [
            // Table seated before shift (16:41 BKK) but completed at 19:32 BKK (during shift)
            {
                id: 'table-cross-1',
                booking_time: '2026-09-12T09:41:00.000Z',
                created_at: '2026-09-12T09:41:00.000Z',
                updated_at: '2026-09-12T12:32:00.000Z',
                status: 'completed',
                total_amount: 1356,
                staff_remark: 'Paid by QR'
            },
            // Table seated and completed during shift
            {
                id: 'table-regular-1',
                booking_time: '2026-09-12T11:10:00.000Z',
                created_at: '2026-09-12T11:10:00.000Z',
                updated_at: '2026-09-12T12:12:00.000Z',
                status: 'completed',
                total_amount: 298,
                staff_remark: 'Paid by CASH'
            }
        ];

        // Chainable Mock Supabase client
        const createQueryChain = (data) => {
            const chain = {
                in: () => chain,
                gte: () => chain,
                lte: () => chain,
                then: (resolve) => resolve({ data, error: null })
            };
            return chain;
        };

        const mockSupabase = {
            from: (table) => ({
                select: () => createQueryChain(mockDb)
            })
        };

        const bookings = await fetchShiftBookings(mockSupabase, shift);
        expect(bookings.length).toBe(2);
        
        const metrics = calculateShiftMetrics(shift, bookings);
        expect(metrics.cashSales).toBe(298);
        expect(metrics.qrSales).toBe(1356);
        expect(metrics.totalSales).toBe(1654);
    });
});
