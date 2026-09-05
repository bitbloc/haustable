import { describe, it, expect } from 'vitest';
import { parseTableTransferInfo } from '../tableTransferHelper';

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
});
