import { describe, it, expect, beforeEach, vi } from 'vitest';
import { posCache, addToOfflineQueue, getOfflineQueue } from '../offlineHelper';
import { 
    isTableSessionActive, 
    formatMergeSourceRemark, 
    formatMergeTargetRemark, 
    formatMoveRemark, 
    parseTableTransferInfo 
} from '../tableTransferHelper';
import { resolveDominantCrmMember } from '../crmHelper';

describe('POS Table Move & Table Merge Resilience Suite (APK & Offline First)', () => {
    beforeEach(() => {
        localStorage.clear();
        posCache.setTables([]);
        posCache.setBookings([]);
    });

    it('accurately identifies active dining sessions using isTableSessionActive across day boundaries', () => {
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).toISOString();
        const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();
        const now = new Date();

        // 1. Seated table arriving yesterday night (e.g. 2 hours ago across midnight)
        const recentNightBooking = {
            id: 'b-night-1',
            table_id: 1,
            status: 'seated',
            booking_time: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
            order_items: [{ id: 'i1', name: 'Craft Beer', quantity: 2 }]
        };
        expect(isTableSessionActive(recentNightBooking, startOfToday, endOfToday, now)).toBe(true);

        // 2. Confirmed in-store dining session
        const confirmedBooking = {
            id: 'b-conf-1',
            table_id: 2,
            status: 'confirmed',
            booking_time: new Date(now.getTime() - 30 * 60000).toISOString(),
            order_items: []
        };
        expect(isTableSessionActive(confirmedBooking, startOfToday, endOfToday, now)).toBe(true);

        // 3. Stale booking older than 16 hours
        const staleBooking = {
            id: 'b-stale-1',
            table_id: 3,
            status: 'seated',
            booking_time: new Date(now.getTime() - 17 * 3600 * 1000).toISOString()
        };
        expect(isTableSessionActive(staleBooking, startOfToday, endOfToday, now)).toBe(false);

        // 4. Closed / Void / Cancelled booking
        const voidBooking = {
            id: 'b-void-1',
            table_id: 4,
            status: 'void',
            booking_time: new Date().toISOString()
        };
        expect(isTableSessionActive(voidBooking, startOfToday, endOfToday, now)).toBe(false);
    });

    it('calculates mergeable tables instantly from posCache without throwing ReferenceError', () => {
        const table1 = { id: 101, table_name: 'H1' };
        const table2 = { id: 102, table_name: 'H2' };
        const table3 = { id: 103, table_name: 'H3' }; // empty table

        const booking1 = {
            id: 'b-101',
            table_id: 101,
            status: 'seated',
            total_amount: 350,
            profiles: { display_name: 'คุณเอก' },
            order_items: [{ id: 1, name: 'ลาบหมู', price_at_time: 150, quantity: 1 }]
        };

        const booking2 = {
            id: 'b-102',
            table_id: 102,
            status: 'seated',
            total_amount: 500,
            profiles: { display_name: 'คุณส้ม' },
            order_items: [{ id: 2, name: 'คั่วกลิ้ง', price_at_time: 180, quantity: 1 }]
        };

        posCache.setTables([table1, table2, table3]);
        posCache.setBookings([booking1, booking2]);

        const selectedTable = table1;
        const now = new Date();
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).toISOString();
        const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

        const computeMergeable = (tList, bList) => {
            const activeBookingMap = {};
            const sortedBookings = [...(bList || [])].sort((a, b) => new Date(b.booking_time || b.created_at || 0) - new Date(a.booking_time || a.created_at || 0));
            sortedBookings.forEach(b => {
                if (!b || !b.table_id) return;
                const tId = String(b.table_id);
                if (tId === String(selectedTable.id)) return;
                if (!activeBookingMap[tId] && isTableSessionActive(b, startOfToday, endOfToday, now)) {
                    activeBookingMap[tId] = b;
                }
            });

            return (tList || [])
                .filter(t => String(t.id) !== String(selectedTable.id) && activeBookingMap[String(t.id)])
                .map(t => ({
                    ...t,
                    booking: activeBookingMap[String(t.id)]
                }));
        };

        const mergeable = computeMergeable(posCache.getTables(), posCache.getBookings());

        // Should include Table H2 (active order) and EXCLUDE Table H1 (self) and Table H3 (free)
        expect(mergeable.length).toBe(1);
        expect(mergeable[0].id).toBe(102);
        expect(mergeable[0].table_name).toBe('H2');
        expect(mergeable[0].booking.id).toBe('b-102');
        expect(mergeable[0].booking.profiles.display_name).toBe('คุณส้ม');
    });

    it('calculates available move tables (free tables) correctly from posCache', () => {
        const table1 = { id: 101, table_name: 'H1' }; // occupied
        const table2 = { id: 102, table_name: 'H2' }; // occupied
        const table3 = { id: 103, table_name: 'H3' }; // free

        const booking1 = { id: 'b-101', table_id: 101, status: 'seated' };
        const booking2 = { id: 'b-102', table_id: 102, status: 'seated' };

        posCache.setTables([table1, table2, table3]);
        posCache.setBookings([booking1, booking2]);

        const selectedTable = table1;
        const now = new Date();
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).toISOString();
        const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

        const computeFreeTables = (tList, bList) => {
            const occupiedTableIds = new Set();
            (bList || []).forEach(b => {
                if (!b || !b.table_id) return;
                if (isTableSessionActive(b, startOfToday, endOfToday, now)) {
                    occupiedTableIds.add(String(b.table_id));
                }
            });

            return (tList || []).filter(t => 
                String(t.id) !== String(selectedTable.id) && !occupiedTableIds.has(String(t.id))
            );
        };

        const freeTables = computeFreeTables(posCache.getTables(), posCache.getBookings());

        expect(freeTables.length).toBe(1);
        expect(freeTables[0].id).toBe(103);
        expect(freeTables[0].table_name).toBe('H3');
    });

    it('correctly executes table merge offline and syncs items, CRM, and remarks in posCache and offline queue', () => {
        const sourceTable = { id: 101, table_name: 'H1' };
        const targetTable = { id: 102, table_name: 'H2' };

        const sourceBooking = {
            id: 'local_src_999',
            table_id: 101,
            tables_layout: sourceTable,
            status: 'seated',
            total_amount: 300,
            profiles: { id: 'usr-1', display_name: 'VIP Member', xhaus_coins: 500 },
            order_items: [
                { id: 'item-1', name: 'ต้มยำกุ้ง', price_at_time: 300, quantity: 1 }
            ]
        };

        const targetBooking = {
            id: 'target-202',
            table_id: 102,
            tables_layout: targetTable,
            status: 'seated',
            total_amount: 450,
            profiles: { id: 'usr-2', display_name: 'Regular Guest', xhaus_coins: 50 },
            order_items: [
                { id: 'item-2', name: 'ผัดไทย', price_at_time: 150, quantity: 3 }
            ]
        };

        posCache.setTables([sourceTable, targetTable]);
        posCache.setBookings([sourceBooking, targetBooking]);

        // Execute merge logic
        const sourceOriginalTotal = parseFloat(sourceBooking.total_amount || 0);
        const sourceRemark = formatMergeSourceRemark(targetTable.table_name, 'T202', sourceOriginalTotal);
        const targetRemark = formatMergeTargetRemark(targetBooking.staff_remark, sourceTable.table_name, 'S999');
        const dominantCrm = resolveDominantCrmMember(sourceBooking, targetBooking, null, null);

        // Dominant CRM must pick VIP Member (500 pts > 50 pts)
        expect(dominantCrm.wasSourceChosen).toBe(true);
        expect(dominantCrm.dominantMember.display_name).toBe('VIP Member');

        const cachedBookings = posCache.getBookings() || [];
        const sourceItems = sourceBooking.order_items || [];
        const targetItems = targetBooking.order_items || [];
        const mergedItems = [...targetItems, ...sourceItems.map(item => ({ ...item, booking_id: targetBooking.id }))];
        const newTotal = (parseFloat(targetBooking.total_amount || 0) + sourceOriginalTotal);

        const updatedTarget = {
            ...targetBooking,
            order_items: mergedItems,
            staff_remark: targetRemark,
            total_amount: newTotal,
            profiles: dominantCrm.dominantMember
        };

        const updatedBookings = cachedBookings.map(b => {
            if (b.id === targetBooking.id) return updatedTarget;
            if (b.id === sourceBooking.id) {
                return { ...b, status: 'void', staff_remark: sourceRemark, total_amount: 0, order_items: [] };
            }
            return b;
        });

        posCache.setBookings(updatedBookings);
        addToOfflineQueue('merge_bills', {
            sourceBookingId: sourceBooking.id,
            targetBookingId: targetBooking.id,
            sourceRemark,
            targetRemark,
            sourceOriginalTotal,
            dominantMember: dominantCrm.dominantMember
        });

        // Verify posCache state
        const freshCache = posCache.getBookings();
        const cacheTarget = freshCache.find(b => b.id === targetBooking.id);
        const cacheSource = freshCache.find(b => b.id === sourceBooking.id);

        expect(cacheTarget.total_amount).toBe(750);
        expect(cacheTarget.order_items.length).toBe(2);
        expect(cacheTarget.profiles.display_name).toBe('VIP Member');
        expect(cacheSource.status).toBe('void');
        expect(cacheSource.total_amount).toBe(0);

        // Verify offline queue
        const queue = getOfflineQueue();
        const mergeAction = queue.find(q => q.type === 'merge_bills');
        expect(mergeAction).toBeDefined();
        expect(mergeAction.payload.sourceBookingId).toBe('local_src_999');
        expect(mergeAction.payload.targetBookingId).toBe('target-202');
    });
});
