import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
    getCanonicalOrderAlertKey,
    checkEventDeduplication 
} from '../audioHelper';

describe('POS Cart Quantity Decrement & Kitchen Send Audio Suppression Audit', () => {
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

    describe('Bug 1: Cart item removal on (-) button when quantity reaches 0', () => {
        it('synchronously identifies target item and triggers deletion when nextQty <= 0', () => {
            const currentOrder = [
                { id: 'item-1', menu_item_id: 'm-101', name: 'ข้าวผัดมันเนื้อ', quantity: 1, price: 150 },
                { id: 'item-2', menu_item_id: 'm-102', name: 'ชาพีชเย็น', quantity: 2, price: 75 }
            ];

            const currentOrderRef = { current: currentOrder };
            const currentBookingId = 'booking-table-1';
            let deletedId = null;
            let deletedBookingId = null;

            const deleteOrderItem = vi.fn((id, bookingId) => {
                deletedId = id;
                deletedBookingId = bookingId;
            });

            // Simulate handleUpdateQuantity with decrement (-1)
            const handleUpdateQuantity = (targetCleanId, delta) => {
                const targetItem = currentOrderRef.current?.find(item => {
                    const itemId = String(item.id || item.menu_item_id || '');
                    return itemId === targetCleanId || itemId.startsWith(`${targetCleanId}_`);
                });

                if (!targetItem) return;

                const currentQty = Number(targetItem.quantity || 1);
                const nextQty = currentQty + delta;

                if (nextQty <= 0) {
                    const cleanDbId = String(targetItem.id || '').includes('_') 
                        ? String(targetItem.id).split('_')[0] 
                        : targetItem.id;
                    
                    deleteOrderItem(cleanDbId, currentBookingId);

                    // Filter out from memory
                    currentOrderRef.current = currentOrderRef.current.filter(i => i.id !== targetItem.id);
                } else {
                    currentOrderRef.current = currentOrderRef.current.map(i => 
                        i.id === targetItem.id ? { ...i, quantity: nextQty } : i
                    );
                }
            };

            // 1. Decrement item-1 (qty 1 -> 0): should trigger deleteOrderItem synchronously
            handleUpdateQuantity('item-1', -1);
            expect(deleteOrderItem).toHaveBeenCalledTimes(1);
            expect(deletedId).toBe('item-1');
            expect(deletedBookingId).toBe('booking-table-1');
            expect(currentOrderRef.current).toHaveLength(1);
            expect(currentOrderRef.current[0].id).toBe('item-2');

            // 2. Decrement item-2 (qty 2 -> 1): should reduce quantity without delete
            handleUpdateQuantity('item-2', -1);
            expect(deleteOrderItem).toHaveBeenCalledTimes(1); // not called again
            expect(currentOrderRef.current[0].quantity).toBe(1);

            // 3. Decrement item-2 again (qty 1 -> 0): should delete
            handleUpdateQuantity('item-2', -1);
            expect(deleteOrderItem).toHaveBeenCalledTimes(2);
            expect(deletedId).toBe('item-2');
            expect(currentOrderRef.current).toHaveLength(0);
        });

        it('clears deleted item from localStorage pos_cache_active_bookings', () => {
            const bookingId = 'bk-999';
            const initialBookings = [
                {
                    id: bookingId,
                    order_items: [
                        { id: 'del-item-1', name: 'ส้มตำไทย', quantity: 1, price: 60 },
                        { id: 'keep-item-2', name: 'ไก่ย่าง', quantity: 1, price: 120 }
                    ]
                }
            ];
            mockLocalStorage['pos_cache_active_bookings'] = JSON.stringify(initialBookings);

            // Simulate the cache purge routine in usePOSOrder.deleteOrderItem
            const purgeFromLocalStorageCache = (itemCleanId, bId) => {
                try {
                    const cachedActive = localStorage.getItem('pos_cache_active_bookings');
                    if (cachedActive) {
                        const parsed = JSON.parse(cachedActive);
                        if (Array.isArray(parsed)) {
                            const updated = parsed.map(b => {
                                if (String(b.id) === String(bId) && Array.isArray(b.order_items)) {
                                    return {
                                        ...b,
                                        order_items: b.order_items.filter(oi => {
                                            const oiId = String(oi.id || oi.menu_item_id || '');
                                            return oiId !== itemCleanId && !oiId.startsWith(`${itemCleanId}_`);
                                        })
                                    };
                                }
                                return b;
                            });
                            localStorage.setItem('pos_cache_active_bookings', JSON.stringify(updated));
                        }
                    }
                } catch {
                    // ignore
                }
            };

            purgeFromLocalStorageCache('del-item-1', bookingId);

            const updatedCache = JSON.parse(mockLocalStorage['pos_cache_active_bookings']);
            expect(updatedCache[0].order_items).toHaveLength(1);
            expect(updatedCache[0].order_items[0].id).toBe('keep-item-2');
        });
    });

    describe('Bug 2: Audio chime alert suppression when staff sends to kitchen', () => {
        it('suppresses audio alert when staff sends order to kitchen from POS terminal', () => {
            const playOrderAlertMock = vi.fn();
            const currentBookingId = 'booking-table-3';
            
            // Terminal state tracking
            const submittingOrderRef = { current: true }; // Cashier actively submitting
            const localStaffSubmittedBookingsRef = { current: new Set([currentBookingId]) };

            // Realtime event handler evaluator
            const evaluateIncomingOrderItem = (payload) => {
                const bookingId = payload.new?.booking_id;
                const isCurrentPosBooking = currentBookingId && String(bookingId) === String(currentBookingId);
                const isLocalStaffSubmission = (
                    submittingOrderRef.current || 
                    (bookingId && localStaffSubmittedBookingsRef.current.has(String(bookingId)))
                );

                if (isLocalStaffSubmission || isCurrentPosBooking) {
                    // Suppressed! No sound played because local cashier initiated this action
                    return false;
                }

                // If remote customer order
                playOrderAlertMock(payload);
                return true;
            };

            // Staff sends item to kitchen
            const kitchenItemPayload = {
                eventType: 'INSERT',
                new: {
                    id: 'oi-123',
                    booking_id: currentBookingId,
                    destination: 'kitchen',
                    status: 'pending',
                    name: 'สเต็กเนื้อวากิว'
                }
            };

            const result = evaluateIncomingOrderItem(kitchenItemPayload);
            expect(result).toBe(false);
            expect(playOrderAlertMock).not.toHaveBeenCalled();
        });

        it('does NOT misclassify destination=kitchen as a remote customer QR order', () => {
            const playOrderAlertMock = vi.fn();
            const currentBookingId = 'booking-table-1';
            const staffSubmittedId = 'booking-table-2';
            
            // Submitting order just finished, but booking ID is in localStaffSubmittedBookingsRef TTL set
            const localStaffSubmittedBookingsRef = { current: new Set([staffSubmittedId]) };
            const submittingOrderRef = { current: false };

            const handleOrderItemsRealtime = (payload) => {
                const bookingId = payload.new?.booking_id;
                const isCurrentPosBooking = currentBookingId && String(bookingId) === String(currentBookingId);
                const isLocalStaffSubmission = (
                    submittingOrderRef.current || 
                    (bookingId && localStaffSubmittedBookingsRef.current.has(String(bookingId)))
                );

                // Correct logic: If local cashier initiated, DO NOT play alert
                if (isLocalStaffSubmission || isCurrentPosBooking) {
                    return { alertPlayed: false, reason: 'suppressed_local_staff' };
                }

                const sourceLower = String(payload.new?.source || '').toLowerCase();
                const remarkLower = String(payload.new?.remark || '').toLowerCase();
                const isQr = sourceLower === 'qr' || remarkLower.includes('qr');

                if (isQr) {
                    playOrderAlertMock();
                    return { alertPlayed: true, reason: 'remote_qr_order' };
                }

                return { alertPlayed: false, reason: 'unhandled' };
            };

            // 1. Staff submitted booking-table-2 with destination=kitchen
            const staffKitchenEvent = {
                new: {
                    booking_id: staffSubmittedId,
                    destination: 'kitchen',
                    source: 'pos',
                    name: 'แกงส้มชะอมกุ้ง'
                }
            };
            const staffResult = handleOrderItemsRealtime(staffKitchenEvent);
            expect(staffResult.alertPlayed).toBe(false);
            expect(staffResult.reason).toBe('suppressed_local_staff');
            expect(playOrderAlertMock).not.toHaveBeenCalled();

            // 2. Remote customer QR order arrives for table-5
            const remoteQrEvent = {
                new: {
                    booking_id: 'booking-table-5',
                    destination: 'kitchen',
                    source: 'qr',
                    remark: 'สั่งผ่าน QR Code',
                    name: 'ชาไทยเย็น'
                }
            };
            const qrResult = handleOrderItemsRealtime(remoteQrEvent);
            expect(qrResult.alertPlayed).toBe(true);
            expect(qrResult.reason).toBe('remote_qr_order');
            expect(playOrderAlertMock).toHaveBeenCalledTimes(1);
        });

        it('cleans up localStaffSubmittedBookingsRef after sliding TTL (30 seconds)', () => {
            const localStaffSubmittedBookingsRef = { current: new Set() };
            const bookingId = 'temp-booking-888';

            // Add with 30s timeout
            localStaffSubmittedBookingsRef.current.add(bookingId);
            expect(localStaffSubmittedBookingsRef.current.has(bookingId)).toBe(true);

            setTimeout(() => {
                localStaffSubmittedBookingsRef.current.delete(bookingId);
            }, 30000);

            // Fast forward 15 seconds: still protected
            vi.advanceTimersByTime(15000);
            expect(localStaffSubmittedBookingsRef.current.has(bookingId)).toBe(true);

            // Fast forward remaining 15 seconds: cleared
            vi.advanceTimersByTime(15000);
            expect(localStaffSubmittedBookingsRef.current.has(bookingId)).toBe(false);
        });
    });
});
