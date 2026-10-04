import { describe, it, expect, vi, beforeEach } from 'vitest';
import { subscribePOSBroadcast, sendPOSBroadcast } from '../realtimeNotifier';

describe('Realtime & Broadcast Hub Resilience', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should register listeners and receive broadcasts via subscribePOSBroadcast', async () => {
        const received = [];
        const unsubscribe = subscribePOSBroadcast(({ event, payload }) => {
            received.push({ event, payload });
        });

        expect(typeof unsubscribe).toBe('function');

        await sendPOSBroadcast('qr_order_created', { table_id: 5, booking_id: 'b-123' });

        expect(received.length).toBe(1);
        expect(received[0].event).toBe('qr_order_created');
        expect(received[0].payload.table_id).toBe(5);
        expect(received[0].payload.booking_id).toBe('b-123');
        expect(received[0].payload.timestamp).toBeDefined();

        unsubscribe();
    });

    it('should fan-out broadcasts to multiple concurrent subscribers without conflict', async () => {
        const subscriber1 = [];
        const subscriber2 = [];
        const subscriber3 = [];

        const unsub1 = subscribePOSBroadcast(msg => subscriber1.push(msg));
        const unsub2 = subscribePOSBroadcast(msg => subscriber2.push(msg));
        const unsub3 = subscribePOSBroadcast(msg => subscriber3.push(msg));

        await sendPOSBroadcast('call_staff', { table_id: 'T1' });

        expect(subscriber1.length).toBe(1);
        expect(subscriber2.length).toBe(1);
        expect(subscriber3.length).toBe(1);
        expect(subscriber1[0].event).toBe('call_staff');
        expect(subscriber2[0].event).toBe('call_staff');
        expect(subscriber3[0].event).toBe('call_staff');

        // Unsubscribe subscriber2 only
        unsub2();

        await sendPOSBroadcast('call_bill', { table_id: 'T1' });

        expect(subscriber1.length).toBe(2);
        expect(subscriber2.length).toBe(1); // unchanged!
        expect(subscriber3.length).toBe(2);

        unsub1();
        unsub3();
    });

    it('should gracefully handle non-function callbacks without throwing', () => {
        expect(() => subscribePOSBroadcast(null)).not.toThrow();
        expect(() => subscribePOSBroadcast(undefined)).not.toThrow();
        expect(() => subscribePOSBroadcast({})).not.toThrow();
    });

    it('should deliver table_moved and bills_merged cross-terminal broadcasts', async () => {
        const events = [];
        const unsub = subscribePOSBroadcast(e => events.push(e));

        await sendPOSBroadcast('table_moved', { fromTableId: 3, toTableId: 7, bookingId: 'b-999' });
        await sendPOSBroadcast('bills_merged', { fromTableId: 2, toTableId: 8, sourceBookingId: 'b-1', targetBookingId: 'b-2' });

        expect(events.length).toBe(2);
        expect(events[0].event).toBe('table_moved');
        expect(events[0].payload.fromTableId).toBe(3);
        expect(events[0].payload.toTableId).toBe(7);

        expect(events[1].event).toBe('bills_merged');
        expect(events[1].payload.fromTableId).toBe(2);
        expect(events[1].payload.toTableId).toBe(8);

        unsub();
    });
});
