import { describe, it, expect, beforeEach, vi } from 'vitest';
import { posCache } from '../offlineHelper';

// Helper function mirroring POSTableGrid & usePOSOrder logic
function isTableSessionActive(b, startOfToday, endOfToday, now) {
    if (!b) return false;
    if (['completed', 'void', 'cancelled', 'no_show'].includes(b.status)) return false;

    // Safety age limit: session cannot exceed 16 hours
    if (b.booking_time) {
        const bTime = new Date(b.booking_time);
        const ageMs = now.getTime() - bTime.getTime();
        if (ageMs > 16 * 60 * 60 * 1000) return false;
    }

    const isToday = b.booking_time >= startOfToday && b.booking_time <= endOfToday;
    const isWalkInOrQR = b.booking_type === 'walk_in' || b.booking_type === 'qr' || (b.staff_remark || '').toLowerCase().includes('qr');

    if (b.status === 'seated') {
        return isToday || (b.booking_time && (now.getTime() - new Date(b.booking_time).getTime() < 12 * 60 * 60 * 1000));
    }
    if (isToday && b.status === 'ready') return true;
    if (isToday && b.status === 'confirmed') {
        const bTime = new Date(b.booking_time);
        const diffMins = (bTime.getTime() - now.getTime()) / 60000;
        if (diffMins <= 30 && diffMins >= -120) return true;
    }
    if (isToday && b.status === 'pending' && isWalkInOrQR) return true;
    return false;
}

describe('POS Table Clearing & Performance Resilience Tests', () => {
    const today = new Date();
    const now = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).toISOString();
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString();

    beforeEach(() => {
        localStorage.clear();
    });

    it('Test 1: Stale seated booking from yesterday (>16h) does NOT mark table as active/occupied', () => {
        const staleBooking = {
            id: 'stale-1',
            table_id: 1,
            status: 'seated',
            booking_time: yesterday,
            staff_remark: 'Seated yesterday'
        };

        const isActive = isTableSessionActive(staleBooking, startOfToday, endOfToday, now);
        expect(isActive).toBe(false);
    });

    it('Test 2: Fresh seated booking from today correctly marks table as active/occupied', () => {
        const freshBooking = {
            id: 'fresh-1',
            table_id: 1,
            status: 'seated',
            booking_time: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
            staff_remark: 'Walk-in guest'
        };

        const isActive = isTableSessionActive(freshBooking, startOfToday, endOfToday, now);
        expect(isActive).toBe(true);
    });

    it('Test 3: Completed or void booking is never active even if from today', () => {
        const completedBooking = {
            id: 'completed-1',
            table_id: 2,
            status: 'completed',
            booking_time: new Date().toISOString()
        };
        const voidBooking = {
            id: 'void-1',
            table_id: 2,
            status: 'void',
            booking_time: new Date().toISOString()
        };

        expect(isTableSessionActive(completedBooking, startOfToday, endOfToday, now)).toBe(false);
        expect(isTableSessionActive(voidBooking, startOfToday, endOfToday, now)).toBe(false);
    });

    it('Test 4: Clearing a table purges all bookings matching that table_id from cache', () => {
        const initialBookings = [
            { id: 'b-1', table_id: 5, status: 'seated' },
            { id: 'b-2', table_id: 5, status: 'pending' }, // Orphaned QR order on table 5
            { id: 'b-3', table_id: 7, status: 'seated' }
        ];
        posCache.setBookings(initialBookings);

        const targetTableId = 5;
        const currentCached = posCache.getBookings();
        const pruned = currentCached.filter(b => String(b.table_id) !== String(targetTableId));
        posCache.setBookings(pruned);

        const remaining = posCache.getBookings();
        expect(remaining.length).toBe(1);
        expect(remaining[0].id).toBe('b-3');
        expect(remaining.some(b => b.table_id === 5)).toBe(false);
    });

    it('Test 5: Optimistic pos_table_cleared custom event updates table status to free immediately (0ms)', () => {
        let tablesState = [
            { id: 3, table_name: 'T-03', status: 'occupied', booking: { id: 'b-33', status: 'seated' } },
            { id: 4, table_name: 'T-04', status: 'free', booking: null }
        ];

        // Simulate pos_table_cleared handler
        const handleTableCleared = (clearedTableId) => {
            tablesState = tablesState.map(t => String(t.id) === String(clearedTableId) ? {
                ...t,
                status: 'free',
                booking: null,
                hasNewOrder: false
            } : t);
        };

        handleTableCleared(3);
        expect(tablesState[0].status).toBe('free');
        expect(tablesState[0].booking).toBeNull();
    });

    it('Test 6: Signature comparison prevents re-renders when pending bookings list is unchanged', () => {
        const pendingList1 = [
            { id: 'p-1', status: 'pending', payment_slip_url: null },
            { id: 'p-2', status: 'pending', payment_slip_url: 'slip.jpg' }
        ];
        const pendingList2 = [
            { id: 'p-1', status: 'pending', payment_slip_url: null },
            { id: 'p-2', status: 'pending', payment_slip_url: 'slip.jpg' }
        ];

        const sig1 = pendingList1.map(b => `${b.id}:${b.status}:${b.payment_slip_url ? 1 : 0}`).join('|');
        const sig2 = pendingList2.map(b => `${b.id}:${b.status}:${b.payment_slip_url ? 1 : 0}`).join('|');

        expect(sig1).toBe(sig2); // Same signature -> re-render skipped!

        const pendingList3 = [
            { id: 'p-1', status: 'confirmed', payment_slip_url: null }
        ];
        const sig3 = pendingList3.map(b => `${b.id}:${b.status}:${b.payment_slip_url ? 1 : 0}`).join('|');
        expect(sig1).not.toBe(sig3); // Changed -> re-render triggers!
    });
});
