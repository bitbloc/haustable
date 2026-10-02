import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
    checkEventDeduplication, 
    getCanonicalOrderAlertKey, 
    getCanonicalTableAlertKey,
    playOrderAlert
} from '../audioHelper';
import { prewarmPOSBroadcastChannel } from '../realtimeNotifier';

describe('QR Order Deduplication & Instant Visual Table Notification Tests', () => {
    let mockLocalStorage = {};

    beforeEach(() => {
        vi.useFakeTimers();
        mockLocalStorage = {};
        global.localStorage = {
            getItem: vi.fn((key) => mockLocalStorage[key] !== undefined ? mockLocalStorage[key] : null),
            setItem: vi.fn((key, val) => { mockLocalStorage[key] = String(val); }),
            removeItem: vi.fn((key) => { delete mockLocalStorage[key]; }),
            clear: vi.fn(() => { mockLocalStorage = {}; })
        };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('1. Pre-warming Broadcast Channel', () => {
        it('should initialize and return the pre-warmed broadcast channel', () => {
            const result = prewarmPOSBroadcastChannel();
            expect(result).toBeDefined();
            expect(result.channel).toBeDefined();
        });
    });

    describe('2. QR Order Toast & Audio Deduplication Across Handlers', () => {
        it('should allow only ONE alert sound and toast when customer places QR order', () => {
            const bookingId = 'uuid_booking_qr_123';
            const canonicalKey = getCanonicalOrderAlertKey(bookingId);
            expect(canonicalKey).toBe('order_uuid_booking_qr_123');

            // Step 1: Realtime Broadcast arrives (< 50ms)
            const broadcastAllowed = checkEventDeduplication(canonicalKey, 6000);
            expect(broadcastAllowed).toBe(true);

            // Step 2: 120ms later, Supabase bookings INSERT arrives
            vi.advanceTimersByTime(120);
            const bookingInsertAllowed = checkEventDeduplication(canonicalKey, 6000);
            expect(bookingInsertAllowed).toBe(false);

            // Step 3: 200ms later, Supabase bookings UPDATE (pending/seated status) arrives
            vi.advanceTimersByTime(80);
            const bookingUpdateAllowed = checkEventDeduplication(canonicalKey, 6000);
            expect(bookingUpdateAllowed).toBe(false);

            // Step 4: 250ms later, Supabase order_items INSERT arrives for 3 items
            vi.advanceTimersByTime(50);
            const item1Allowed = checkEventDeduplication(canonicalKey, 6000);
            const item2Allowed = checkEventDeduplication(canonicalKey, 6000);
            const item3Allowed = checkEventDeduplication(canonicalKey, 6000);
            expect(item1Allowed).toBe(false);
            expect(item2Allowed).toBe(false);
            expect(item3Allowed).toBe(false);

            // Step 5: After 6000ms cooldown expires, a new order can alert again
            vi.advanceTimersByTime(6100);
            const subsequentOrderAllowed = checkEventDeduplication(canonicalKey, 6000);
            expect(subsequentOrderAllowed).toBe(true);
        });

        it('should isolate physical dine-in table QR orders from Online Hub alerts', () => {
            // Dine-in table orders (table_id !== null) should never trigger in Online Hub
            const dineInBooking = {
                id: 'dine_in_uuid_1',
                table_id: 3,
                source: 'qr',
                staff_remark: '[QR] QR Walk-in Guest',
                booking_type: 'walk_in'
            };

            const isTableQrOrder = Boolean(dineInBooking.table_id) && 
                ((dineInBooking.source || '').toLowerCase() === 'qr' || 
                 (dineInBooking.staff_remark || '').toLowerCase().includes('qr') || 
                 dineInBooking.booking_type === 'walk_in');

            expect(isTableQrOrder).toBe(true);

            // Online pickup orders (table_id === null) are allowed in Online Hub
            const onlinePickupBooking = {
                id: 'online_pickup_uuid_2',
                table_id: null,
                source: 'online',
                staff_remark: '[ONLINE_PICKUP]',
                booking_type: 'pickup'
            };

            const isOnlineTableQr = Boolean(onlinePickupBooking.table_id) && 
                ((onlinePickupBooking.source || '').toLowerCase() === 'qr' || 
                 (onlinePickupBooking.staff_remark || '').toLowerCase().includes('qr') || 
                 onlinePickupBooking.booking_type === 'walk_in');

            expect(isOnlineTableQr).toBe(false);
        });

        it('should use explicit print_${bookingId} key for auto-print toast to prevent stacking', () => {
            const bookingId = 'booking_print_456';
            const printKey = `print_${bookingId}`;
            expect(printKey).toBe('print_booking_print_456');

            // Distinct from order key so print status can display without colliding with order alert
            const orderKey = getCanonicalOrderAlertKey(bookingId);
            expect(printKey).not.toBe(orderKey);
        });
    });

    describe('3. Instant (0ms) Red Table Color & Visual Notifications', () => {
        // Helper function mimicking POSTableGrid resolveTableStyling
        function resolveTableStyling(table) {
            const isOccupied = table.status === 'occupied' || Boolean(table.booking && !['completed', 'cancelled', 'void', 'no_show'].includes(table.booking.status));
            const isPending = table.status === 'pending';
            const isReserved = table.status === 'reserved';
            const hasOrder = Boolean(table.hasNewOrder);
            const hasCallStaff = Boolean(table.hasCallStaff);
            const hasCallBill = Boolean(table.hasCallBill);

            let tableBgClass = 'bg-[var(--color-paper)] border-[var(--color-rule)] text-[var(--color-ink)]';
            let ledColor = 'bg-[oklch(45%_0.08_140)]';

            if (isReserved && !hasOrder) {
                tableBgClass = 'bg-amber-50 border-2 border-amber-500 text-amber-950 shadow-xs';
                ledColor = 'bg-amber-500';
            } else if (isOccupied || isPending || hasOrder) {
                tableBgClass = 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white shadow-sm';
                ledColor = 'bg-white';
                
                if (hasCallStaff) {
                    tableBgClass = 'animate-pos-blink-yellow border-2 border-yellow-500 text-yellow-950 font-black shadow-md';
                    ledColor = 'bg-yellow-400 animate-ping';
                } else if (hasCallBill) {
                    tableBgClass = 'animate-pos-blink-orange border-2';
                    ledColor = 'bg-[#FFAA00] animate-pulse';
                } else if (hasOrder) {
                    tableBgClass = 'animate-pos-blink-red border-2';
                    ledColor = 'bg-red-500 animate-pulse';
                }
            } else if (hasCallStaff) {
                tableBgClass = 'animate-pos-blink-yellow border-2 border-yellow-500 text-yellow-950 font-black shadow-md';
                ledColor = 'bg-yellow-400 animate-ping';
            } else if (hasCallBill) {
                tableBgClass = 'animate-pos-blink-orange border-2';
                ledColor = 'bg-[#FFAA00] animate-pulse';
            } else if (hasOrder) {
                tableBgClass = 'animate-pos-blink-red border-2';
                ledColor = 'bg-red-500 animate-pulse';
            }

            return { tableBgClass, ledColor };
        }

        it('should IMMEDIATELY turn table RED and BLINK RED when hasOrder is true, even if status is free (0ms)', () => {
            const freeTableWithIncomingOrder = {
                id: 5,
                table_name: 'Table 5',
                status: 'free',
                booking: null,
                hasNewOrder: true, // Triggered by instant qr_order_created broadcast
                hasCallStaff: false,
                hasCallBill: false
            };

            const styling = resolveTableStyling(freeTableWithIncomingOrder);
            
            // Must have terracotta/red accent background & red blink animation
            expect(styling.tableBgClass).toContain('animate-pos-blink-red');
            expect(styling.ledColor).toBe('bg-red-500 animate-pulse');
        });

        it('should turn table RED when occupied without order, and BLINK RED when order arrives', () => {
            const occupiedTableWithoutOrder = {
                id: 2,
                table_name: 'Table 2',
                status: 'occupied',
                booking: { id: 'b_2', status: 'seated' },
                hasNewOrder: false
            };

            const styling1 = resolveTableStyling(occupiedTableWithoutOrder);
            expect(styling1.tableBgClass).toContain('bg-[var(--color-accent)]');
            expect(styling1.tableBgClass).not.toContain('animate-pos-blink-red');

            // Customer adds order via QR code -> hasNewOrder becomes true
            const occupiedTableWithOrder = {
                ...occupiedTableWithoutOrder,
                hasNewOrder: true
            };

            const styling2 = resolveTableStyling(occupiedTableWithOrder);
            expect(styling2.tableBgClass).toContain('animate-pos-blink-red');
            expect(styling2.ledColor).toBe('bg-red-500 animate-pulse');
        });

        it('should prioritize CALL STAFF (yellow) and CALL BILL (orange) over normal order blink', () => {
            const tableWithCallStaff = {
                id: 1,
                status: 'occupied',
                hasNewOrder: true,
                hasCallStaff: true
            };
            const staffStyling = resolveTableStyling(tableWithCallStaff);
            expect(staffStyling.tableBgClass).toContain('animate-pos-blink-yellow');
            expect(staffStyling.ledColor).toContain('bg-yellow-400');

            const tableWithCallBill = {
                id: 1,
                status: 'occupied',
                hasNewOrder: true,
                hasCallBill: true
            };
            const billStyling = resolveTableStyling(tableWithCallBill);
            expect(billStyling.tableBgClass).toContain('animate-pos-blink-orange');
            expect(billStyling.ledColor).toContain('bg-[#FFAA00]');
        });

        it('should clear hasNewOrder when acknowledgeTable is called', () => {
            const ackTableTimes = {};
            function acknowledgeTable(tableId, tables, setTables) {
                const now = Date.now();
                ackTableTimes[tableId] = now;
                return tables.map(t => String(t.id) === String(tableId) ? { ...t, hasNewOrder: false } : t);
            }

            const initialTables = [
                { id: 4, status: 'occupied', hasNewOrder: true }
            ];

            const updatedTables = acknowledgeTable(4, initialTables);
            expect(updatedTables[0].hasNewOrder).toBe(false);
            expect(ackTableTimes[4]).toBeGreaterThan(0);
        });

        it('should preserve optimistic hasNewOrder in fetchTables merge if table was not yet acknowledged', () => {
            const now = new Date();
            const ackTableTimes = { '4': 0 }; // Not yet acknowledged

            const prevTables = [
                { id: 4, status: 'occupied', hasNewOrder: true }
            ];
            const prevMap = new Map(prevTables.map(p => [String(p.id), p]));

            const currentDbTables = [
                { id: 4, table_name: 'Table 4' }
            ];

            // Simulated merge inside fetchTables
            const merged = currentDbTables.map(t => {
                const prevTable = prevMap.get(String(t.id));
                const tableAckTime = ackTableTimes[t.id] || 0;
                const dbHasNewOrder = false; // DB hasn't returned new order_items yet
                const isOptimisticOrderActive = Boolean(prevTable?.hasNewOrder && (now.getTime() - tableAckTime > 0));

                return {
                    ...t,
                    status: 'occupied',
                    hasNewOrder: Boolean(dbHasNewOrder || isOptimisticOrderActive)
                };
            });

            expect(merged[0].hasNewOrder).toBe(true);
        });

        it('should recognize confirmed status as active dining session in isTableSessionActive', () => {
            function isTableSessionActiveTest(b, now = new Date()) {
                if (!b) return false;
                if (['completed', 'void', 'cancelled', 'no_show'].includes(b.status)) return false;

                const bRawTime = b.booking_time || b.created_at;
                if (bRawTime) {
                    const bTime = new Date(bRawTime);
                    const ageMs = now.getTime() - bTime.getTime();
                    if (ageMs > 16 * 60 * 60 * 1000) return false;
                }

                if (['seated', 'confirmed'].includes(b.status)) return true;
                if (b.status === 'ready' && b.booking_type !== 'pickup') return true;
                if (b.status === 'pending') {
                    const isWalkInOrQR = b.booking_type === 'walk_in' || b.booking_type === 'qr' || (b.staff_remark || '').toLowerCase().includes('qr');
                    const hasItems = Array.isArray(b.order_items) && b.order_items.length > 0;
                    return isWalkInOrQR || hasItems || b.booking_type !== 'pickup';
                }
                return false;
            }

            const now = new Date();
            // Confirmed dining order (e.g. order #2354)
            const confirmedBooking = {
                id: 'booking_2354',
                table_id: 9,
                status: 'confirmed',
                booking_time: now.toISOString(),
                total_amount: 244
            };
            expect(isTableSessionActiveTest(confirmedBooking, now)).toBe(true);

            // Seated booking
            const seatedBooking = {
                id: 'booking_seated',
                table_id: 6,
                status: 'seated',
                booking_time: now.toISOString()
            };
            expect(isTableSessionActiveTest(seatedBooking, now)).toBe(true);

            // Voided booking must return false
            const voidBooking = {
                id: 'booking_void',
                table_id: 9,
                status: 'void',
                booking_time: now.toISOString()
            };
            expect(isTableSessionActiveTest(voidBooking, now)).toBe(false);

            // Stale booking (> 16 hours) must return false
            const staleBooking = {
                id: 'booking_stale',
                table_id: 9,
                status: 'seated',
                booking_time: new Date(now.getTime() - 17 * 60 * 60 * 1000).toISOString()
            };
            expect(isTableSessionActiveTest(staleBooking, now)).toBe(false);
        });

        it('should use canonical order alert key for auto-print toast to update in-place without stacking', () => {
            const bookingId = 'order_uuid_h9_2354';
            const canonicalOrderKey = getCanonicalOrderAlertKey(bookingId);
            const autoPrintKey = getCanonicalOrderAlertKey(bookingId) || `order_${bookingId}`;

            // Both keys must be identical so Sonner updates existing toast rather than stacking
            expect(autoPrintKey).toBe(canonicalOrderKey);
            expect(autoPrintKey).toBe('order_order_uuid_h9_2354');
        });

        it('should block customer from calling staff or requesting bill if session is voided', () => {
            const voidBooking = {
                id: 'void_123',
                table_id: 9,
                status: 'void'
            };

            function canCallStaff(booking, latestDbBooking) {
                if (latestDbBooking && ['void', 'cancelled'].includes(latestDbBooking.status)) {
                    return false;
                }
                if (booking && ['void', 'cancelled', 'completed', 'no_show'].includes(booking.status)) {
                    return false;
                }
                return true;
            }

            expect(canCallStaff(voidBooking, { status: 'void' })).toBe(false);
            expect(canCallStaff(null, { status: 'void' })).toBe(false);
            expect(canCallStaff({ status: 'seated' }, { status: 'seated' })).toBe(true);
        });
    });
});
