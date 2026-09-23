import { describe, it, expect } from 'vitest';
import { getBookingPaymentBreakdown, calculateShiftMetrics, fetchShiftBookings } from '../shiftHelper';

describe('Manual Booking & Remote Orders POS Shift Reconciliation', () => {
    const shift = {
        id: 'shift_1790132607288',
        staffName: 'Add',
        openedAt: '2026-09-23T03:03:27.288Z',
        closedAt: null,
        openingFloat: 6047,
        transactions: [
            { bookingId: 'table-cash-1', amount: 145, paymentMethod: 'cash' },
            { bookingId: 'table-qr-1', amount: 3656, paymentMethod: 'qr' }
        ],
        adjustments: [
            { id: 'adj-1', type: 'out', amount: 461.5, note: 'expenses' }
        ]
    };

    it('should correctly classify manual booking with payment_method: "transfer" as QR Transfer', () => {
        const manualBooking = {
            id: '751e6b3d-3828-4009-964b-30c8fa096b09',
            booking_type: 'pickup',
            status: 'completed',
            table_id: null,
            booking_time: '2026-09-23T04:30:00.000Z',
            total_amount: 6714,
            deposit_amount: 6714,
            discount_amount: 746,
            payment_slip_url: null,
            pickup_contact_name: 'บริษัท ซิลลิค ฟาร์มา จำกัด (คุณโอ๊ต)',
            pickup_contact_phone: '0831945413',
            customer_note: '',
            staff_remark: 'ส่งห้องประชุม ชั้น 5 ตึกอำนวยการ รพ.นครพนม วันที่ 23 ประมาณ 11.30 น.',
            source: 'phone',
            payment_method: 'transfer'
        };

        const breakdown = getBookingPaymentBreakdown(manualBooking);
        expect(breakdown.cash).toBe(0);
        expect(breakdown.qr).toBe(6714);
        expect(breakdown.credit).toBe(0);
        expect(breakdown.methodLabel).toBe('QR Transfer');
    });

    it('should fall back to QR Transfer for remote phone/LINE bookings even if payment_method column was omitted', () => {
        const remoteBookingWithoutPaymentCol = {
            id: '751e6b3d-3828-4009-964b-30c8fa096b09',
            booking_type: 'pickup',
            status: 'completed',
            table_id: null,
            booking_time: '2026-09-23T04:30:00.000Z',
            total_amount: 6714,
            pickup_contact_name: 'บริษัท ซิลลิค ฟาร์มา จำกัด',
            staff_remark: 'ส่งห้องประชุม ชั้น 5 ตึกอำนวยการ รพ.นครพนม',
            source: 'phone'
            // payment_method omitted intentionally to test resilience
        };

        const breakdown = getBookingPaymentBreakdown(remoteBookingWithoutPaymentCol);
        expect(breakdown.cash).toBe(0);
        expect(breakdown.qr).toBe(6714);
        expect(breakdown.credit).toBe(0);
        expect(breakdown.methodLabel).toBe('QR Transfer');
    });

    it('should reconcile active shift cash sales to ฿145 (NOT ฿6,859) when manual booking of ฿6,714 is paid via QR Transfer', () => {
        const bookingsData = [
            {
                id: 'table-cash-1',
                status: 'completed',
                total_amount: 145,
                payment_method: 'cash',
                staff_remark: 'เงินสด',
                table_id: 't-1'
            },
            {
                id: 'table-qr-1',
                status: 'completed',
                total_amount: 3656,
                payment_method: 'qr',
                staff_remark: 'Paid by QR',
                table_id: 't-2'
            },
            {
                id: '751e6b3d-3828-4009-964b-30c8fa096b09',
                booking_type: 'pickup',
                status: 'completed',
                table_id: null,
                total_amount: 6714,
                payment_method: 'transfer',
                source: 'phone',
                staff_remark: 'ส่งห้องประชุม ชั้น 5 ตึกอำนวยการ รพ.นครพนม วันที่ 23 ประมาณ 11.30 น.'
            }
        ];

        const metrics = calculateShiftMetrics(shift, bookingsData);

        // Net Revenue: 145 + 3656 + 6714 = 10515
        expect(metrics.totalSales).toBe(10515);

        // Cash Sales must strictly be ฿145 (physical drawer), NOT ฿6859!
        expect(metrics.cashSales).toBe(145);

        // QR Sales: 3656 + 6714 = 10370
        expect(metrics.qrSales).toBe(10370);

        // Expected Cash in Drawer: Opening Float (6047) + Cash Sales (145) - Adjustments (461.5) = 5730.5
        expect(metrics.expectedCash).toBe(6047 + 145 - 461.5);
    });

    it('should ensure fetchShiftBookings always includes payment_method even if caller passes truncated select clause', async () => {
        let requestedSelect = '';
        const mockSupabase = {
            from: () => ({
                select: (clause) => {
                    requestedSelect = clause;
                    const chain = {
                        in: () => chain,
                        gte: () => chain,
                        lte: () => chain,
                        then: (resolve) => resolve({ data: [], error: null })
                    };
                    return chain;
                }
            })
        };

        await fetchShiftBookings(mockSupabase, shift, 'id, status, total_amount, staff_remark');

        expect(requestedSelect).toContain('payment_method');
        expect(requestedSelect).toContain('source');
        expect(requestedSelect).toContain('booking_type');
    });
});
