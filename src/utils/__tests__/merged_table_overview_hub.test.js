import { describe, it, expect } from 'vitest';
import { parseTableTransferInfo, isGhostPickupBooking } from '../tableTransferHelper';

describe('AllDailyBillsHub & Merged Table ("โต๊ะรวม") Display Architecture', () => {
    const mockBookings = [
        {
            id: 'cdaa4d4e-5fd9-4aa5-932c-8fe318acaf1c',
            booking_short_id: '1C9F',
            status: 'void',
            staff_remark: '[MERGED_TO:H4#3467] [TARGET_BILL:#3467] Merged into Table H4 (#3467) [ORIG_AMT:259]',
            customer_note: null,
            total_amount: 0,
            tables_layout: { table_name: 'H9' },
            order_items: []
        },
        {
            id: '27273095-4f0d-410b-bf72-25e1c4546a0b',
            booking_short_id: '3467',
            status: 'completed',
            staff_remark: 'Paid by QR [MERGED_FROM:H9#1C9F]',
            customer_note: null,
            total_amount: 3281,
            tables_layout: { table_name: 'H4' },
            order_items: [{ id: 'item-1', price_at_time: 259, quantity: 1 }]
        },
        {
            id: 'aadccff3-287f-473a-a5d1-94e13de0ead7',
            booking_short_id: '9D74',
            status: 'cancelled',
            staff_remark: null,
            customer_note: 'Internal Block',
            total_amount: 0,
            tables_layout: { table_name: 'H9' },
            order_items: []
        }
    ];

    it('should correctly parse source merged bill (1C9F)', () => {
        const source = mockBookings.find(b => b.booking_short_id === '1C9F');
        const transfer = parseTableTransferInfo(source, mockBookings);

        expect(transfer.isMergedSource).toBe(true);
        expect(transfer.mergedToTable).toBe('H4');
        expect(transfer.mergedToBillId).toBe('3467');
        expect(transfer.targetTableDisplay).toBe('โต๊ะ H4 (#3467)');
        expect(transfer.originalTotal).toBe(259);
    });

    it('should correctly parse target combined bill (3467)', () => {
        const target = mockBookings.find(b => b.booking_short_id === '3467');
        const transfer = parseTableTransferInfo(target, mockBookings);

        expect(transfer.isMergedTarget).toBe(true);
        expect(transfer.mergedFromTables).toContain('H9');
        expect(transfer.mergedFromBillIds).toContain('1C9F');
        expect(transfer.mergedFromTableDisplay).toBe('โต๊ะ H9 (#1C9F)');
    });

    it('should filter out released/empty Internal Block from active bills', () => {
        const isInternalBlock = (b) => 
            (b.customer_note === 'Internal Block' || b.customer_note === 'Maintenance Block') &&
            (!b.order_items || b.order_items.length === 0) &&
            parseFloat(b.total_amount || b.total_price || 0) === 0;

        const filtered = mockBookings.filter(b => !isInternalBlock(b));
        expect(filtered.map(b => b.booking_short_id)).not.toContain('9D74');
        expect(filtered.map(b => b.booking_short_id)).toContain('1C9F');
        expect(filtered.map(b => b.booking_short_id)).toContain('3467');
    });

    it('should determine correct release status: cancelled for block-only, completed for real orders', () => {
        const releaseStatus = (booking) => {
            const isBlockOnly = booking?.customer_note === 'Internal Block' || 
                                booking?.customer_note === 'Maintenance Block' ||
                                ((!booking?.order_items || booking?.order_items?.length === 0) && parseFloat(booking?.total_amount || 0) === 0);
            return isBlockOnly ? 'cancelled' : 'completed';
        };

        const blockBooking = mockBookings.find(b => b.booking_short_id === '9D74');
        const realOrder = mockBookings.find(b => b.booking_short_id === '3467');

        expect(releaseStatus(blockBooking)).toBe('cancelled');
        expect(releaseStatus(realOrder)).toBe('completed');
    });

    it('should NOT show payment badge for newly opened or seated (dining) orders, only for completed/paid', () => {
        const shouldShowPaymentBadge = (booking) => {
            const s = (booking?.status || '').toLowerCase();
            return s === 'completed' || s === 'paid' || s === 'success';
        };

        const newlyOpenedTable = {
            id: 'b_new',
            status: 'seated',
            total_amount: 0,
            order_items: []
        };
        const diningTableWithItems = {
            id: 'b_dining',
            status: 'seated',
            total_amount: 520,
            order_items: [{ name: 'Khao Soi', quantity: 2, price: 260 }]
        };
        const completedBill = {
            id: 'b_paid',
            status: 'completed',
            total_amount: 520,
            order_items: [{ name: 'Khao Soi', quantity: 2, price: 260 }]
        };

        expect(shouldShowPaymentBadge(newlyOpenedTable)).toBe(false);
        expect(shouldShowPaymentBadge(diningTableWithItems)).toBe(false);
        expect(shouldShowPaymentBadge(completedBill)).toBe(true);
    });

    it('should correctly identify and filter ghost pickup bookings (empty 0 items and ฿0)', () => {
        const ghostPickup1 = {
            id: 'bd3c797c-b48d-4df6-b427-4876327f05a4',
            booking_short_id: 'B35E',
            status: 'seated',
            booking_type: 'pickup',
            table_id: null,
            customer_note: 'ออเดอร์กลับบ้าน',
            total_amount: 0,
            order_items: []
        };
        const ghostPickup2 = {
            id: 'b1001747-70f8-4200-a22f-4763735f9ec3',
            booking_short_id: '5A14',
            status: 'seated',
            booking_type: 'pickup',
            table_id: null,
            customer_note: 'ออเดอร์กลับบ้าน',
            total_amount: 0,
            order_items: []
        };
        const validTakeaway = {
            id: 'valid-pickup-1',
            booking_short_id: 'C999',
            status: 'seated',
            booking_type: 'pickup',
            table_id: null,
            customer_note: 'ออเดอร์กลับบ้าน',
            total_amount: 150,
            order_items: [{ name: 'Americano', quantity: 1, price: 150 }]
        };
        const activeDineInTable = {
            id: 'table-seated-1',
            booking_short_id: 'T111',
            status: 'seated',
            booking_type: 'dine_in',
            table_id: 'table-uuid-1',
            customer_note: null,
            total_amount: 0,
            order_items: []
        };

        expect(isGhostPickupBooking(ghostPickup1)).toBe(true);
        expect(isGhostPickupBooking(ghostPickup2)).toBe(true);
        expect(isGhostPickupBooking(validTakeaway)).toBe(false);
        // An in-store table that is seated before placing order is not a ghost pickup
        expect(isGhostPickupBooking(activeDineInTable)).toBe(false);

        // Filter list test
        const testList = [ghostPickup1, ghostPickup2, validTakeaway, activeDineInTable];
        const cleaned = testList.filter(b => !isGhostPickupBooking(b));
        expect(cleaned.length).toBe(2);
        expect(cleaned.map(b => b.booking_short_id)).toEqual(['C999', 'T111']);
    });
});
