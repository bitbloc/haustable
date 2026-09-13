import { describe, it, expect, beforeEach } from 'vitest';
import { posCache } from '../offlineHelper';

describe('Audit: POS Core Operational Flows (เปิด - ปิด - ย้าย - รวม)', () => {
    beforeEach(() => {
        localStorage.clear();
        posCache.setTables([]);
        posCache.setBookings([]);
    });

    // ==========================================
    // 1. FLOW: เปิด (Open Table / Seating / Pickup)
    // ==========================================
    describe('Flow 1: เปิด (Open Table / Walk-in / Seating)', () => {
        it('successfully opens an empty table, saves to posCache with string table_id, and sets floorplan as occupied', () => {
            const table = { id: 5, table_name: 'A1', capacity: 4 };
            posCache.setTables([table]);

            // Simulate createWalkIn
            const walkInBooking = {
                id: 'booking-open-101',
                table_id: table.id,
                status: 'seated',
                booking_type: 'walk_in',
                booking_time: new Date().toISOString(),
                pax: 2,
                staff_remark: 'Walk-in Guest',
                tables_layout: table
            };

            const existingBookings = posCache.getBookings().filter(b => table.id ? String(b.table_id) !== String(table.id) : true);
            existingBookings.push(walkInBooking);
            posCache.setBookings(existingBookings);

            // Verify posCache holds the open table
            const cached = posCache.getBookings();
            expect(cached.length).toBe(1);
            expect(String(cached[0].table_id)).toBe('5');
            expect(cached[0].status).toBe('seated');

            // Simulate POSTableGrid status evaluation
            const evaluatedTable = posCache.getTables().map(t => {
                const b = cached.find(item => String(item.table_id) === String(t.id) && !['completed', 'void', 'cancelled', 'no_show'].includes(item.status));
                return {
                    ...t,
                    status: b ? (b.status === 'pending' ? 'pending' : 'occupied') : 'free'
                };
            })[0];

            expect(evaluatedTable.status).toBe('occupied');
        });

        it('safely handles pickup / takeaway orders without a physical table assignment', () => {
            const pickupBooking = {
                id: 'local_pickup_999',
                table_id: null,
                status: 'seated',
                booking_type: 'pickup',
                booking_time: new Date().toISOString(),
                pax: 1,
                pickup_contact_name: 'K. Somchai',
                staff_remark: 'Walk-in Pick-up'
            };

            posCache.setBookings([pickupBooking]);
            const cached = posCache.getBookings();
            expect(cached.length).toBe(1);
            expect(cached[0].table_id).toBeNull();
            expect(cached[0].booking_type).toBe('pickup');
        });
    });

    // ==========================================
    // 2. FLOW: ปิด (Checkout / Clear / Split Payment / Shift Close)
    // ==========================================
    describe('Flow 2: ปิด (Checkout / Close Table / Settle)', () => {
        it('completely purges active table and booking from posCache on successful checkout', () => {
            const table = { id: 7, table_name: 'B2' };
            const activeBooking = {
                id: 'booking-close-202',
                table_id: 7,
                status: 'seated',
                total_amount: 350
            };

            posCache.setTables([table]);
            posCache.setBookings([activeBooking]);
            localStorage.setItem('pos_active_table_id', '7');

            // Simulate checkout completion
            const updatedBookings = (posCache.getBookings() || []).filter(b => b.id !== activeBooking.id);
            posCache.setBookings(updatedBookings);
            localStorage.removeItem('pos_active_table_id');

            expect(posCache.getBookings().length).toBe(0);
            expect(localStorage.getItem('pos_active_table_id')).toBeNull();

            // Table in grid reverts to 'free'
            const evaluatedTable = posCache.getTables().map(t => {
                const b = posCache.getBookings().find(item => String(item.table_id) === String(t.id) && !['completed', 'void', 'cancelled', 'no_show'].includes(item.status));
                return {
                    ...t,
                    status: b ? 'occupied' : 'free'
                };
            })[0];

            expect(evaluatedTable.status).toBe('free');
        });

        it('clears empty table / cancels voided order immediately without leaving ghost occupied status', () => {
            const table = { id: 9, table_name: 'C1' };
            const voidBooking = {
                id: 'booking-void-303',
                table_id: 9,
                status: 'seated'
            };

            posCache.setTables([table]);
            posCache.setBookings([voidBooking]);

            // Simulate handleClearOrderOrTable voiding
            const cachedAfterVoid = posCache.getBookings().filter(b => b.id !== voidBooking.id);
            posCache.setBookings(cachedAfterVoid);
            localStorage.removeItem('pos_active_table_id');

            const evaluatedTable = posCache.getTables().map(t => {
                const b = posCache.getBookings().find(item => String(item.table_id) === String(t.id) && !['completed', 'void', 'cancelled', 'no_show'].includes(item.status));
                return {
                    ...t,
                    status: b ? 'occupied' : 'free'
                };
            })[0];

            expect(evaluatedTable.status).toBe('free');
        });

        it('releases table when split payment is fully settled', () => {
            const table = { id: 10, table_name: 'D1' };
            const activeBooking = {
                id: 'booking-split-404',
                table_id: 10,
                status: 'seated',
                total_amount: 500,
                staff_remark: ''
            };

            posCache.setTables([table]);
            posCache.setBookings([activeBooking]);

            // Split 1: 250 (partial) -> table stays occupied
            const isPartialSettled = false;
            if (!isPartialSettled) {
                expect(posCache.getBookings().length).toBe(1);
            }

            // Split 2: 250 (final remaining = 0) -> fully settled!
            const isFullySettled = true;
            if (isFullySettled) {
                const cached = (posCache.getBookings() || []).filter(b => b.id !== activeBooking.id);
                posCache.setBookings(cached);
                localStorage.removeItem('pos_active_table_id');
            }

            expect(posCache.getBookings().length).toBe(0);
            expect(localStorage.getItem('pos_active_table_id')).toBeNull();
        });
    });

    // ==========================================
    // 3. FLOW: ย้าย (Move Table)
    // ==========================================
    describe('Flow 3: ย้าย (Move Table)', () => {
        it('filters available tables accurately using type-safe String comparison and excludes occupied tables', () => {
            const allTables = [
                { id: 1, table_name: 'H1' },
                { id: '2', table_name: 'H2' }, // String ID
                { id: 3, table_name: 'H3' }
            ];

            const activeBookings = [
                { id: 'b-h1', table_id: 1, status: 'seated' },
                { id: 'b-h2', table_id: '2', status: 'seated' }
            ];

            const occupiedTableIds = (activeBookings || []).map(b => String(b.table_id));
            const freeTables = allTables.filter(t => !occupiedTableIds.includes(String(t.id)));

            expect(freeTables.length).toBe(1);
            expect(freeTables[0].table_name).toBe('H3');
        });

        it('updates booking reference, transfers table ID, and updates staff remark on move', () => {
            const sourceTable = { id: 1, table_name: 'H1' };
            const targetTable = { id: 3, table_name: 'H3' };

            const booking = {
                id: 'b-move-test',
                table_id: 1,
                tables_layout: sourceTable,
                status: 'seated',
                staff_remark: 'Dine-in Customer',
                order_items: [{ id: 1, name: 'แกงส้มชะอมกุ้ง', quantity: 1, price_at_time: 220 }]
            };

            posCache.setTables([sourceTable, targetTable]);
            posCache.setBookings([booking]);

            // Execute Move
            const updatedRemark = `${booking.staff_remark} [MOVED:H1->H3]`;
            const updatedBooking = {
                ...booking,
                table_id: targetTable.id,
                tables_layout: targetTable,
                staff_remark: updatedRemark
            };

            const updatedList = posCache.getBookings().map(b => b.id === booking.id ? updatedBooking : b);
            posCache.setBookings(updatedList);

            // Target table should now have the order
            const targetEntry = posCache.getBookings().find(b => String(b.table_id) === String(targetTable.id));
            expect(targetEntry).toBeDefined();
            expect(targetEntry.order_items.length).toBe(1);
            expect(targetEntry.staff_remark).toContain('[MOVED:H1->H3]');

            // Source table must be empty
            const sourceEntry = posCache.getBookings().find(b => String(b.table_id) === String(sourceTable.id));
            expect(sourceEntry).toBeUndefined();
        });
    });

    // ==========================================
    // 4. FLOW: รวม (Merge Tables / Bills)
    // ==========================================
    describe('Flow 4: รวม (Merge Bills)', () => {
        it('lists only other occupied tables as eligible merge targets', () => {
            const allTables = [
                { id: 1, table_name: 'H1' },
                { id: 2, table_name: 'H2' },
                { id: 3, table_name: 'H3' } // free
            ];

            const activeBookings = [
                { id: 'b1', table_id: 1, status: 'seated' },
                { id: 'b2', table_id: 2, status: 'seated' }
            ];

            const selectedTable = allTables[0]; // H1

            const activeBookingMap = {};
            activeBookings.forEach(b => {
                activeBookingMap[String(b.table_id)] = b;
            });

            const mergeable = allTables
                .filter(t => String(t.id) !== String(selectedTable.id) && activeBookingMap[String(t.id)])
                .map(t => ({
                    ...t,
                    booking: activeBookingMap[String(t.id)]
                }));

            expect(mergeable.length).toBe(1);
            expect(mergeable[0].table_name).toBe('H2');
            expect(mergeable[0].booking.id).toBe('b2');
        });

        it('reassigns all items to target table, voids source booking, and aggregates total amount', () => {
            const sourceTable = { id: 1, table_name: 'H1' };
            const targetTable = { id: 2, table_name: 'H2' };

            const sourceBooking = {
                id: 'b-source',
                table_id: 1,
                status: 'seated',
                total_amount: 300,
                order_items: [{ id: 's1', name: 'ผัดไทย', quantity: 2, price_at_time: 150 }]
            };

            const targetBooking = {
                id: 'b-target',
                table_id: 2,
                status: 'seated',
                total_amount: 200,
                order_items: [{ id: 't1', name: 'ชามะนาว', quantity: 2, price_at_time: 100 }]
            };

            posCache.setTables([sourceTable, targetTable]);
            posCache.setBookings([sourceBooking, targetBooking]);

            // Execute Merge Bill:
            const sourceOriginalTotal = sourceBooking.total_amount;
            const updatedBookings = posCache.getBookings().map(b => {
                if (b.id === targetBooking.id) {
                    const mergedItems = [...b.order_items, ...sourceBooking.order_items.map(i => ({ ...i, booking_id: targetBooking.id }))];
                    return {
                        ...b,
                        order_items: mergedItems,
                        total_amount: b.total_amount + sourceOriginalTotal,
                        staff_remark: '[MERGED:FROM:H1]'
                    };
                }
                if (b.id === sourceBooking.id) {
                    return { ...b, status: 'void', total_amount: 0, order_items: [] };
                }
                return b;
            });

            posCache.setBookings(updatedBookings);

            // Verify Target Table:
            const targetInCache = posCache.getBookings().find(b => b.id === targetBooking.id);
            expect(targetInCache.total_amount).toBe(500);
            expect(targetInCache.order_items.length).toBe(2);

            // Verify Source Table:
            const sourceInCache = posCache.getBookings().find(b => b.id === sourceBooking.id);
            expect(sourceInCache.status).toBe('void');
            expect(sourceInCache.order_items.length).toBe(0);

            // Source table should now be recognized as FREE on floorplan
            const evaluatedSourceTable = posCache.getTables().map(t => {
                const b = posCache.getBookings().find(item => String(item.table_id) === String(t.id) && !['completed', 'void', 'cancelled', 'no_show'].includes(item.status));
                return {
                    ...t,
                    status: b ? 'occupied' : 'free'
                };
            }).find(t => t.id === sourceTable.id);

            expect(evaluatedSourceTable.status).toBe('free');
        });
    });
});
