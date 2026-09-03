import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
    checkEventDeduplication, 
    getAudioVolume, 
    setAudioVolume, 
    isAudioMuted, 
    setAudioMuted, 
    getEffectiveGainFactor,
    testPlayAlertSound,
    playOrderAlert
} from '../audioHelper';

describe('Audio Engine & Notification Resilience', () => {
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

    describe('Event Deduplication', () => {
        it('should allow first event through and block duplicate events within cooldown window', () => {
            const eventKey = 'order_booking_101';
            
            // First trigger: should be allowed
            const isFirstAllowed = checkEventDeduplication(eventKey, 4500);
            expect(isFirstAllowed).toBe(true);

            // Immediate repeat (100ms later): should be blocked
            vi.advanceTimersByTime(100);
            const isSecondAllowed = checkEventDeduplication(eventKey, 4500);
            expect(isSecondAllowed).toBe(false);

            // Different event key (at same timestamp): should be allowed
            const differentKey = 'order_booking_102';
            const isDifferentAllowed = checkEventDeduplication(differentKey, 4500);
            expect(isDifferentAllowed).toBe(true);

            // Same event key after cooldown (5000ms later): should be allowed again
            vi.advanceTimersByTime(5000);
            const isAfterCooldownAllowed = checkEventDeduplication(eventKey, 4500);
            expect(isAfterCooldownAllowed).toBe(true);
        });

        it('should handle null or empty event keys gracefully', () => {
            expect(checkEventDeduplication(null)).toBe(true);
            expect(checkEventDeduplication('')).toBe(true);
        });
    });

    describe('Anti-Double-Click & Audio Throttling', () => {
        it('should throttle testPlayAlertSound against rapid double clicks', () => {
            setAudioMuted(false);
            setAudioVolume(80);

            // First click: should succeed
            const firstResult = testPlayAlertSound(80, 1200);
            expect(firstResult).toBe(true);

            // Rapid 2nd click (50ms later): should be throttled (returns false)
            vi.advanceTimersByTime(50);
            const rapidSecondClick = testPlayAlertSound(80, 1200);
            expect(rapidSecondClick).toBe(false);

            // Rapid 3rd click (500ms later): should still be throttled
            vi.advanceTimersByTime(500);
            const rapidThirdClick = testPlayAlertSound(80, 1200);
            expect(rapidThirdClick).toBe(false);

            // After cooldown expires (1300ms later): should succeed
            vi.advanceTimersByTime(1300);
            const afterCooldownClick = testPlayAlertSound(80, 1200);
            expect(afterCooldownClick).toBe(true);
        });

        it('should throttle playOrderAlert against burst triggers', () => {
            setAudioMuted(false);
            setAudioVolume(80);

            // First alert
            const firstAlert = playOrderAlert('burst_1', 1200, 3.4);
            expect(firstAlert).toBe(true);

            // 2nd alert within 200ms (burst of multiple items/orders)
            vi.advanceTimersByTime(200);
            const secondAlert = playOrderAlert('burst_2', 1200, 3.4);
            expect(secondAlert).toBe(false);

            // After 1300ms
            vi.advanceTimersByTime(1300);
            const thirdAlert = playOrderAlert('burst_3', 1200, 3.4);
            expect(thirdAlert).toBe(true);
        });

        it('should return 0 effective gain and cleanly skip sound when muted', () => {
            setAudioMuted(true);
            expect(isAudioMuted()).toBe(true);
            expect(getEffectiveGainFactor()).toBe(0);

            const played = playOrderAlert('test_muted', 1200, 3.4);
            expect(played).toBe(false);
        });
    });

    describe('Walk-in vs Online Order Categorization', () => {
        const categorizeOrder = (b) => {
            const sourceLower = (b.source || '').toLowerCase();
            const remarkLower = (b.staff_remark || '').toLowerCase();
            const nameLower = (b.customer_name || '').toLowerCase();
            const isLineman = sourceLower === 'lineman' || remarkLower.includes('lineman') || nameLower.includes('line man') || nameLower.startsWith('lm-');
            const hasOnlineMarker = sourceLower === 'online' || sourceLower === 'line' || remarkLower.includes('[online_pickup]') || remarkLower.includes('easyslip') || !!b.payment_slip_url || (b.order_type || '').startsWith('hausmade');
            const isExplicitInHouse = !isLineman && !hasOnlineMarker && (sourceLower === 'pos' || sourceLower === 'walk_in' || remarkLower.includes('walk-in') || remarkLower.includes('walk in') || b.booking_type === 'walk_in');
            const isOnline = !isExplicitInHouse && (isLineman || hasOnlineMarker || sourceLower === 'online' || sourceLower === 'line' || sourceLower === 'qr' || remarkLower.includes('online') || remarkLower.includes('qr') || !!b.payment_slip_url);
            
            const isPickup = b.booking_type === 'pickup' || (!b.table_id && (sourceLower === 'online' || remarkLower.includes('pickup')));
            const isWalkIn = isExplicitInHouse || (b.booking_type === 'walk_in' && !isOnline);

            return { isOnline, isPickup, isWalkIn, isLineman, isExplicitInHouse };
        };

        it('should correctly distinguish Online Pickup from POS Walk-in order', () => {
            const onlinePickup = {
                source: 'online',
                booking_type: 'pickup',
                table_id: null,
                staff_remark: '[ONLINE_PICKUP] สั่งรับกลับ',
                customer_name: 'Khun Somchai'
            };

            const resultPickup = categorizeOrder(onlinePickup);
            expect(resultPickup.isOnline).toBe(true);
            expect(resultPickup.isPickup).toBe(true);
            expect(resultPickup.isWalkIn).toBe(false);

            const posWalkIn = {
                source: 'pos',
                booking_type: 'walk_in',
                table_id: 'table-1',
                staff_remark: 'Table 1 Walk-in',
                customer_name: 'Walk-in Guest'
            };

            const resultWalkIn = categorizeOrder(posWalkIn);
            expect(resultWalkIn.isOnline).toBe(false);
            expect(resultWalkIn.isPickup).toBe(false);
            expect(resultWalkIn.isWalkIn).toBe(true);
        });

        it('should correctly classify in-store POS walk-in pickup as in-house and NOT online', () => {
            const posWalkInPickup = {
                source: 'pos',
                booking_type: 'pickup',
                table_id: null,
                staff_remark: 'Walk-in Pick-up',
                customer_name: 'Walk-in Customer'
            };

            const result = categorizeOrder(posWalkInPickup);
            expect(result.isOnline).toBe(false);
            expect(result.isExplicitInHouse).toBe(true);
            expect(result.isWalkIn).toBe(true);
        });

        it('should correctly handle Auto-verified EasySlip Table Booking', () => {
            const autoVerifiedBooking = {
                source: 'online',
                booking_type: 'dine_in',
                status: 'confirmed',
                table_id: 'table-5',
                payment_slip_url: 'slip_123.jpg',
                staff_remark: '[ONLINE] จองโต๊ะล่วงหน้า (ตรวจมัดจำ Auto EasySlip ✓ SCB)',
                customer_name: 'Khun Apirak'
            };

            const result = categorizeOrder(autoVerifiedBooking);
            expect(result.isOnline).toBe(true);
            expect(result.isWalkIn).toBe(false);
        });

        it('should ensure pending queue only holds unconfirmed pending orders', () => {
            const rawBookings = [
                { id: 'b1', status: 'pending', booking_type: 'pickup', source: 'online' },
                { id: 'b2', status: 'confirmed', booking_type: 'pickup', source: 'online' }, // Already accepted
                { id: 'b3', status: 'ready', booking_type: 'pickup', source: 'online' }, // Ready for pickup
                { id: 'b4', status: 'pending', booking_type: 'dine_in', source: 'online' },
                { id: 'b5', status: 'seated', booking_type: 'pickup', source: 'pos', staff_remark: 'Walk-in Pick-up' } // In-store walkin pickup
            ];

            const pendingOnly = rawBookings.filter(b => {
                const sourceLower = (b.source || '').toLowerCase();
                const remarkLower = (b.staff_remark || '').toLowerCase();
                const hasOnlineMarker = sourceLower === 'online' || sourceLower === 'line' || remarkLower.includes('[online_pickup]') || remarkLower.includes('easyslip') || !!b.payment_slip_url;
                const isExplicitInHouse = !hasOnlineMarker && (sourceLower === 'pos' || sourceLower === 'walk_in' || remarkLower.includes('walk-in') || b.booking_type === 'walk_in');
                return b.status === 'pending' && !isExplicitInHouse;
            });

            expect(pendingOnly).toHaveLength(2);
            expect(pendingOnly.map(b => b.id)).toEqual(['b1', 'b4']);
        });
    });
});
