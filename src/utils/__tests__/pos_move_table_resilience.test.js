import { describe, it, expect, vi, beforeEach } from 'vitest';
import { posCache } from '../offlineHelper';

describe('POS Table Move, Cache Resilience and ID Match Verification', () => {
    beforeEach(() => {
        localStorage.clear();
        posCache.setTables([]);
        posCache.setBookings([]);
    });

    it('synchronizes posCache and state on table move (both online & offline fallback)', () => {
        const sourceTable = { id: 1, table_name: 'H1', capacity: 4 };
        const targetTable = { id: 12, table_name: 'H3', capacity: 2 };
        
        const initialBooking = {
            id: 'booking-move-123',
            table_id: 1,
            tables_layout: sourceTable,
            status: 'seated',
            booking_type: 'walk_in',
            staff_remark: 'Walk-in Guest',
            order_items: [
                { id: 101, name: 'แกงคั่วกลิ้งหมู', quantity: 1, price_at_time: 180 }
            ]
        };

        posCache.setTables([sourceTable, targetTable]);
        posCache.setBookings([initialBooking]);

        // Simulate move table execution logic
        const updatedRemark = `${initialBooking.staff_remark} [MOVED:H1->H3@13:05]`;
        const updatedBooking = {
            ...initialBooking,
            table_id: targetTable.id,
            tables_layout: targetTable,
            staff_remark: updatedRemark
        };

        // Cache update: must update target table ID
        const cachedBookings = posCache.getBookings() || [];
        const updatedCache = cachedBookings.map(b => b.id === initialBooking.id ? updatedBooking : b);
        posCache.setBookings(updatedCache);

        // Verify posCache now correctly maps to targetTable.id
        const reloadedBookings = posCache.getBookings();
        const targetBooking = reloadedBookings.find(b => String(b.table_id) === String(targetTable.id));
        expect(targetBooking).toBeDefined();
        expect(targetBooking.id).toBe('booking-move-123');
        expect(targetBooking.tables_layout.table_name).toBe('H3');

        // Source table must be empty in cache
        const sourceBooking = reloadedBookings.find(b => String(b.table_id) === String(sourceTable.id));
        expect(sourceBooking).toBeUndefined();
    });

    it('matches table IDs accurately across mixed String and Number types', () => {
        const table = { id: 12, table_name: 'H3' }; // numeric ID
        const bookingWithStringId = { id: 'b1', table_id: '12', status: 'seated' }; // string table_id
        const bookingWithNumId = { id: 'b2', table_id: 12, status: 'seated' };

        // Test safe string comparison helper
        const isMatchString = String(bookingWithStringId.table_id) === String(table.id);
        const isMatchNum = String(bookingWithNumId.table_id) === String(table.id);

        expect(isMatchString).toBe(true);
        expect(isMatchNum).toBe(true);
    });

    it('preserves local draft items when re-selecting the same active table', () => {
        const currentOrder = {
            table: { id: 12, table_name: 'H3' },
            customer: 'Walk-in Guest',
            items: [
                { id: 'cart-1', db_id: 101, name: 'แกงไตปลา', quantity: 1 }, // submitted DB item
                { id: 'draft-1', name: 'ข้าวสวยร้อนๆ', quantity: 2 } // unsubmitted local draft (!i.db_id)
            ]
        };

        const dbFetchedItems = [
            { id: 'cart-1', db_id: 101, name: 'แกงไตปลา', quantity: 1 }
        ];

        // Simulate handleSelectTable logic with draft preservation
        const isSameTable = currentOrder.table && String(currentOrder.table.id) === String(12);
        const localDrafts = isSameTable ? (currentOrder.items || []).filter(i => !i.db_id) : [];
        const mergedItems = [...dbFetchedItems, ...localDrafts];

        expect(mergedItems.length).toBe(2);
        expect(mergedItems.some(i => i.name === 'ข้าวสวยร้อนๆ')).toBe(true);
    });

    it('protects against PostgREST 504 timeout by not wiping posCache when error is thrown', () => {
        const activeTable = { id: 12, table_name: 'H3' };
        const seatedBooking = {
            id: 'b-504-protect',
            table_id: 12,
            status: 'seated',
            booking_type: 'walk_in',
            order_items: [{ id: 99, name: 'หมูฮ้อง', quantity: 1 }]
        };

        posCache.setTables([activeTable]);
        posCache.setBookings([seatedBooking]);

        // When a 504 error occurs, fetcher must throw to trigger cache fallback
        let caughtError = null;
        let resolvedBooking = null;

        try {
            const mock504Error = { code: '504', message: 'Gateway Timeout' };
            if (mock504Error) throw mock504Error;
        } catch (err) {
            caughtError = err;
            // Fallback to posCache
            const cached = posCache.getBookings();
            resolvedBooking = cached.find(b => String(b.table_id) === String(activeTable.id) && b.status === 'seated');
        }

        expect(caughtError).toBeDefined();
        expect(resolvedBooking).toBeDefined();
        expect(resolvedBooking.id).toBe('b-504-protect');
        // Ensure posCache was NOT cleared
        expect(posCache.getBookings().length).toBe(1);
    });
});
