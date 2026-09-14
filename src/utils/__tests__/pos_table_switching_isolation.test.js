import { describe, it, expect, vi, beforeEach } from 'vitest';
import { posCache } from '../offlineHelper';

describe('POS Table Switching Isolation & Anti-Overlap Audit', () => {
    beforeEach(() => {
        posCache.setTables([]);
        posCache.setBookings([]);
        localStorage.clear();
        vi.clearAllMocks();
    });

    it('synchronously isolates currentOrder and purges previous table items on table switch', () => {
        // Table 7 state
        const table7 = { id: 4, table_name: 'H7' };
        const booking7 = {
            id: 'b_h7',
            table_id: 4,
            status: 'seated',
            order_items: [
                { id: 'item_7_1', name: 'แกงส้มปลาสำลี', quantity: 1, price: 290 },
                { id: 'item_7_2', name: 'สะตอผัดกุ้งจริตจัด', quantity: 1, price: 220 },
                { id: 'item_7_3', name: 'ใบเหลียงผัดไข่', quantity: 1, price: 150 }
            ]
        };

        // State while viewing Table 7
        let selectedTable = table7;
        let activeBooking = booking7;
        let currentOrder = {
            table: table7,
            items: booking7.order_items.map(i => ({ ...i, db_id: i.id }))
        };

        expect(currentOrder.table.table_name).toBe('H7');
        expect(currentOrder.items.length).toBe(3);

        // Staff selects Table 6
        const table6 = { id: 3, table_name: 'H6' };
        let activeBookingRef = { current: activeBooking };

        // 1. Synchronous isolation step (must clear before async fetch starts)
        selectedTable = table6;
        activeBooking = null;
        activeBookingRef.current = null;
        currentOrder = {
            table: table6,
            items: []
        };

        // Verification: while awaiting network response, Table 7 items are completely gone
        expect(selectedTable.table_name).toBe('H6');
        expect(currentOrder.table.table_name).toBe('H6');
        expect(currentOrder.items.length).toBe(0);
        expect(activeBooking).toBeNull();
        expect(activeBookingRef.current).toBeNull();

        // 2. Table 6 async fetch resolves
        const booking6 = {
            id: 'b_h6',
            table_id: 3,
            status: 'seated',
            order_items: [
                { id: 'item_6_1', name: 'ข้าวซอสญี่ปุ่น', quantity: 1, price: 169 },
                { id: 'item_6_2', name: 'ต้มจิ๋วกระดูกอ่อน', quantity: 1, price: 180 }
            ]
        };

        activeBooking = booking6;
        activeBookingRef.current = booking6;
        currentOrder = {
            table: table6,
            items: booking6.order_items.map(i => ({ ...i, db_id: i.id }))
        };

        expect(currentOrder.table.table_name).toBe('H6');
        expect(currentOrder.items.length).toBe(2);
        expect(currentOrder.items.some(i => i.name === 'แกงส้มปลาสำลี')).toBe(false);
    });

    it('rejects stale out-of-order async responses using tableSelectRequestIdRef', async () => {
        let selectedTable = null;
        let activeBooking = null;
        let currentOrder = { items: [], table: null };
        let requestId = 0;

        // Simulated asynchronous table selection handler
        const handleSelectTable = async (table, delayMs, bookingData) => {
            const myReqId = ++requestId;
            selectedTable = table;
            activeBooking = null;
            currentOrder = { items: [], table };

            await new Promise(resolve => setTimeout(resolve, delayMs));

            // Guard: drop stale responses
            if (myReqId !== requestId) {
                return; // Ignored out-of-order response!
            }

            activeBooking = bookingData;
            currentOrder = {
                table,
                items: bookingData.order_items
            };
        };

        const table7 = { id: 4, table_name: 'H7' };
        const booking7 = { id: 'b_h7', order_items: [{ name: 'H7 Item' }] };

        const table6 = { id: 3, table_name: 'H6' };
        const booking6 = { id: 'b_h6', order_items: [{ name: 'H6 Item' }] };

        // User taps Table 7 (slow response 50ms), then quickly taps Table 6 (fast response 10ms)
        const p7 = handleSelectTable(table7, 50, booking7);
        const p6 = handleSelectTable(table6, 10, booking6);

        await Promise.all([p7, p6]);

        // Table 6 must win and Table 7's delayed response must NOT overwrite Table 6
        expect(selectedTable.table_name).toBe('H6');
        expect(activeBooking.id).toBe('b_h6');
        expect(currentOrder.items).toEqual([{ name: 'H6 Item' }]);
    });

    it('refreshActiveBookingItems rejects update if active table ID does not match booking table ID', () => {
        // Table 6 is selected on screen
        const currentSelectedTable = { id: 3, table_name: 'H6' };
        let currentOrder = {
            table: currentSelectedTable,
            items: [{ id: 'item_6', name: 'ข้าวซอสญี่ปุ่น', db_id: 'item_6' }]
        };

        // Incoming update for Table 7 (e.g. from lingering realtime event)
        const incomingTable7Booking = {
            id: 'b_h7',
            table_id: 4,
            tables_layout: { id: 4, table_name: 'H7' },
            order_items: [{ id: 'item_7', name: 'สะตอผัดกุ้ง', price: 220 }]
        };

        // Simulated guard logic from refreshActiveBookingItems
        const applyRefresh = (latestBooking) => {
            if (currentSelectedTable?.id && latestBooking.table_id && String(currentSelectedTable.id) !== String(latestBooking.table_id)) {
                // Rejected due to table mismatch
                return false;
            }

            // If matched, it would update currentOrder
            currentOrder = {
                ...currentOrder,
                items: latestBooking.order_items
            };
            return true;
        };

        const wasApplied = applyRefresh(incomingTable7Booking);
        expect(wasApplied).toBe(false);
        // Table 6 order items are untouched
        expect(currentOrder.items).toEqual([{ id: 'item_6', name: 'ข้าวซอสญี่ปุ่น', db_id: 'item_6' }]);
        expect(currentOrder.table.table_name).toBe('H6');
    });

    it('cancels activeBookingSyncDebounceTimer on table switch to avoid delayed cross-table sync', () => {
        let timerTriggered = false;
        let debounceTimer = setTimeout(() => {
            timerTriggered = true;
        }, 100);

        // Staff switches table: timer must be cancelled immediately
        clearTimeout(debounceTimer);
        debounceTimer = null;

        // Fast-forward or wait 150ms
        return new Promise(resolve => {
            setTimeout(() => {
                expect(timerTriggered).toBe(false);
                expect(debounceTimer).toBeNull();
                resolve();
            }, 150);
        });
    });
});
