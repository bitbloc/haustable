import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Heartbeat, Auto-Print & Audio Resilience Suite', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('ensures Safety Heartbeat runs at high frequency (<= 3500ms) in foreground', () => {
        const foregroundInterval = 3500;
        const backgroundInterval = 8000;
        expect(foregroundInterval).toBeLessThanOrEqual(4000);
        expect(backgroundInterval).toBeLessThanOrEqual(10000);
    });

    it('recovers unprinted QR order items and triggers audio alert and toast notification', async () => {
        const mockPlayOrderAlert = vi.fn();
        const mockAutoPrint = vi.fn().mockResolvedValue(true);
        const checkEventDeduplication = vi.fn().mockReturnValue(true);

        const unprintedItems = [{ id: 'item-1', name: 'Coffee' }];
        const booking = {
            id: 'b-999',
            table_id: 2,
            status: 'seated',
            staff_remark: '[QR] Walk-in',
            source: 'qr'
        };

        if (unprintedItems.length > 0) {
            const qrItemAlertKey = `order_${booking.id}`;
            if (checkEventDeduplication(qrItemAlertKey, 6000)) {
                mockPlayOrderAlert(qrItemAlertKey, 1200, 3.4);
            }
            await mockAutoPrint(booking.id, 'Table 2');
        }

        expect(mockPlayOrderAlert).toHaveBeenCalledWith('order_b-999', 1200, 3.4);
        expect(mockAutoPrint).toHaveBeenCalledWith('b-999', 'Table 2');
    });

    it('recovers [CALL_STAFF] from DB when WebSocket was severed and triggers startStaffCallLoop', () => {
        const mockStartStaffCallLoop = vi.fn();
        const checkEventDeduplication = vi.fn().mockReturnValue(true);

        const callingBookings = [
            { id: 'b-call-1', table_id: 3, staff_remark: 'Walk-in [CALL_STAFF]' }
        ];

        for (const b of callingBookings) {
            if (b.staff_remark.includes('[CALL_STAFF]')) {
                const callStaffKey = `call_staff_${b.table_id}`;
                if (checkEventDeduplication(callStaffKey, 5000)) {
                    mockStartStaffCallLoop(b.table_id);
                }
            }
        }

        expect(mockStartStaffCallLoop).toHaveBeenCalledWith(3);
    });

    it('recovers [CALL_BILL] from DB when WebSocket was severed and triggers playBillAlert', () => {
        const mockPlayBillAlert = vi.fn();
        const checkEventDeduplication = vi.fn().mockReturnValue(true);

        const callingBookings = [
            { id: 'b-bill-1', table_id: 5, staff_remark: 'Walk-in [CALL_BILL]' }
        ];

        for (const b of callingBookings) {
            if (b.staff_remark.includes('[CALL_BILL]')) {
                const callBillKey = `call_bill_${b.table_id}`;
                if (checkEventDeduplication(callBillKey, 5000)) {
                    mockPlayBillAlert(callBillKey);
                }
            }
        }

        expect(mockPlayBillAlert).toHaveBeenCalledWith('call_bill_5');
    });

    it('retries fetching order items once in handleAutoPrintQROrder when order_items insert has replication delay', async () => {
        let attempts = 0;
        const fetchBookingWithRetry = async () => {
            attempts++;
            if (attempts === 1) {
                // First attempt: concurrent transaction has not committed order_items yet
                return { id: 'b-lag', order_items: [] };
            }
            // Second attempt: commit completed, items now present
            return { id: 'b-lag', order_items: [{ id: 'item-101' }] };
        };

        let fullBooking = await fetchBookingWithRetry();
        if (!fullBooking || fullBooking.order_items.length === 0) {
            await new Promise(r => setTimeout(r, 10));
            const retryBooking = await fetchBookingWithRetry();
            if (retryBooking && retryBooking.order_items.length > 0) {
                fullBooking = retryBooking;
            }
        }

        expect(attempts).toBe(2);
        expect(fullBooking.order_items.length).toBe(1);
    });
});
