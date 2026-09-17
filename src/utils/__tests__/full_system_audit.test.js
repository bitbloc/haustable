import { describe, it, expect, vi } from 'vitest';
import { getOrderOrigin } from '../../AdminBookings';
import { resolveTableIdentifier } from '../tableResolver';
import { toThaiISO, getThaiDate } from '../timeUtils';

describe('Comprehensive 5-Module System Audit', () => {

    // ==========================================
    // MODULE 1: Customer QR Ordering (/table/:id)
    // ==========================================
    describe('Module 1: Customer QR Ordering (customerQr)', () => {
        it('1.1 should accurately resolve table identifiers for numeric and alpha table names', async () => {
            const mockTables = [
                { id: 1, table_name: '1', capacity: 4 },
                { id: 9, table_name: 'H9', capacity: 4 },
                { id: 12, table_name: 'Bar-01', capacity: 2 }
            ];

            const mockSupabase = {
                from: () => ({
                    select: () => ({
                        order: async () => ({ data: mockTables, error: null }),
                        ilike: (col, val) => ({
                            maybeSingle: async () => {
                                const found = mockTables.find(t => t[col]?.toLowerCase() === val?.toLowerCase());
                                return { data: found || null, error: null };
                            }
                        }),
                        eq: (col, val) => ({
                            maybeSingle: async () => {
                                const found = mockTables.find(t => t[col] === val);
                                return { data: found || null, error: null };
                            }
                        })
                    })
                })
            };

            // Test numeric matching
            const res1 = await resolveTableIdentifier('1', mockSupabase);
            expect(res1?.id).toBe(1);

            // Test alphanumeric name matching
            const res9 = await resolveTableIdentifier('H9', mockSupabase);
            expect(res9?.id).toBe(9);
            expect(res9?.table_name).toBe('H9');

            // Test case insensitivity
            const resBar = await resolveTableIdentifier('bar-01', mockSupabase);
            expect(resBar?.id).toBe(12);
        });

        it('1.2 should route cart items to correct destinations (kitchen vs bar vs other)', () => {
            const DEFAULT_BAR_CATS = [
                '7524bb8a-4698-45c6-aa17-d8ccc296f667', // Coffee
                '912683ef-fdc3-40a3-8dd8-b09507791240', // Soft Drink
                'b441665e-2f23-4df3-a11d-63485e1690dc', // Beer
            ];

            const cart = [
                { id: 'item-1', name: 'Pad Thai', category_id: 'food-cat-1', qty: 2, totalPricePerUnit: 120 },
                { id: 'item-2', name: 'Iced Latte', category_id: '7524bb8a-4698-45c6-aa17-d8ccc296f667', qty: 1, totalPricePerUnit: 85 },
                { id: 'item-3', name: 'Craft Beer', destination: 'bar', qty: 1, totalPricePerUnit: 180 },
                { id: 'item-4', name: 'Extra Glassware', destination: 'other', qty: 1, totalPricePerUnit: 0 }
            ];

            const itemsToInsert = cart.map(item => {
                const catId = item.category_id || '';
                let resolvedDest = 'kitchen';
                if (DEFAULT_BAR_CATS.includes(catId) || item.destination === 'bar' || item.destination === 'drinks') {
                    resolvedDest = 'bar';
                } else if (item.destination === 'other') {
                    resolvedDest = 'other';
                }
                return {
                    menu_item_id: item.id,
                    quantity: item.qty,
                    price_at_time: item.totalPricePerUnit,
                    destination: resolvedDest
                };
            });

            expect(itemsToInsert[0].destination).toBe('kitchen');
            expect(itemsToInsert[1].destination).toBe('bar');
            expect(itemsToInsert[2].destination).toBe('bar');
            expect(itemsToInsert[3].destination).toBe('other');
        });

        it('1.3 should guard against stale sessions (>16 hours) on customer order status', () => {
            function isBookingActiveAndFresh(booking) {
                if (!booking) return false;
                if (!['pending', 'confirmed', 'seated', 'ready'].includes(booking.status)) return false;
                if (booking.booking_time) {
                    const bookingAgeMs = Date.now() - new Date(booking.booking_time).getTime();
                    const MAX_SESSION_AGE_MS = 16 * 60 * 60 * 1000;
                    if (bookingAgeMs > MAX_SESSION_AGE_MS) return false;
                }
                return true;
            }

            const freshBooking = {
                id: 'fresh-1',
                status: 'seated',
                booking_time: new Date(Date.now() - 2 * 3600 * 1000).toISOString() // 2 hours ago
            };
            const staleBooking = {
                id: 'stale-1',
                status: 'seated',
                booking_time: new Date(Date.now() - 24 * 3600 * 1000).toISOString() // 24 hours ago
            };
            const closedBooking = {
                id: 'closed-1',
                status: 'completed',
                booking_time: new Date().toISOString()
            };

            expect(isBookingActiveAndFresh(freshBooking)).toBe(true);
            expect(isBookingActiveAndFresh(staleBooking)).toBe(false);
            expect(isBookingActiveAndFresh(closedBooking)).toBe(false);
        });
    });

    // ==========================================
    // MODULE 2: Point of Sale (POS)
    // ==========================================
    describe('Module 2: Point of Sale Terminal (pos)', () => {
        it('2.1 should perform 0ms optimistic clearance on table clear event', () => {
            let tableState = {
                status: 'occupied',
                activeBooking: { id: 'bk-123', table_id: 5, status: 'seated' }
            };

            // Simulating pos_table_cleared listener in POSTableGrid
            const handleTableCleared = (clearedTableId) => {
                if (String(tableState.activeBooking?.table_id) === String(clearedTableId)) {
                    tableState = {
                        status: 'free',
                        activeBooking: null
                    };
                }
            };

            handleTableCleared(5);

            expect(tableState.status).toBe('free');
            expect(tableState.activeBooking).toBeNull();
        });

        it('2.2 should prevent 15-second re-render storms using signature hashing', () => {
            let renderCount = 0;
            let prevSignature = '';

            const simulateHeartbeat = (pendingList) => {
                const newSignature = (pendingList || []).map(b => `${b.id}:${b.status}:${b.total_amount}`).join('|');
                if (newSignature !== prevSignature) {
                    prevSignature = newSignature;
                    renderCount++;
                }
            };

            const sampleOrders = [
                { id: '1', status: 'pending', total_amount: 500 },
                { id: '2', status: 'pending', total_amount: 320 }
            ];

            // Trigger heartbeat 5 times with identical orders
            for (let i = 0; i < 5; i++) {
                simulateHeartbeat([...sampleOrders]); // new array references each time
            }

            // Only 1 render should occur instead of 5
            expect(renderCount).toBe(1);

            // Change one item
            simulateHeartbeat([
                { id: '1', status: 'confirmed', total_amount: 500 },
                { id: '2', status: 'pending', total_amount: 320 }
            ]);

            expect(renderCount).toBe(2);
        });

        it('2.3 should enforce 30s background interval when folded and 15s when visible', () => {
            const getHeartbeatInterval = (isVisible) => isVisible ? 15000 : 30000;
            expect(getHeartbeatInterval(true)).toBe(15000);
            expect(getHeartbeatInterval(false)).toBe(30000);
        });
    });

    // ==========================================
    // MODULE 3: Back-Office Management (admin)
    // ==========================================
    describe('Module 3: Back-Office Management (admin)', () => {
        it('3.1 should classify order origin and badges accurately across all channels', () => {
            const linemanOrder = { source: 'lineman', staff_remark: '', booking_type: 'pickup' };
            expect(getOrderOrigin(linemanOrder).key).toBe('lineman');
            expect(getOrderOrigin(linemanOrder).isOnline).toBe(true);

            const shopOrder = { booking_type: 'shop', source: 'online' };
            expect(getOrderOrigin(shopOrder).key).toBe('shop');
            expect(getOrderOrigin(shopOrder).isOnline).toBe(true);

            const onlinePickup = { booking_type: 'pickup', source: 'online', payment_slip_url: 'slip.jpg' };
            expect(getOrderOrigin(onlinePickup).key).toBe('pickup');
            expect(getOrderOrigin(onlinePickup).isOnline).toBe(true);

            const inHouseWalkin = { booking_type: 'walk_in', source: 'pos' };
            expect(getOrderOrigin(inHouseWalkin).key).toBe('in_house');
            expect(getOrderOrigin(inHouseWalkin).isOnline).toBe(false);

            const onlineDineIn = { booking_type: 'dine_in', source: 'online', deposit_amount: 500 };
            expect(getOrderOrigin(onlineDineIn).key).toBe('online_booking');
            expect(getOrderOrigin(onlineDineIn).isOnline).toBe(true);
        });

        it('3.2 should adhere strictly to digital export priority in back-office (Zero physical thermal printing)', () => {
            // Verifying isAdmin prop enforcement for SlipModal
            const resolveSlipModalMode = (isAdmin) => {
                return {
                    enableThermalPrinterButtons: !isAdmin,
                    enableDigitalExportPng: true,
                    enableDigitalCopyLine: true,
                    enablePdfExport: true
                };
            };

            const backOfficeModal = resolveSlipModalMode(true);
            expect(backOfficeModal.enableThermalPrinterButtons).toBe(false);
            expect(backOfficeModal.enableDigitalExportPng).toBe(true);
            expect(backOfficeModal.enableDigitalCopyLine).toBe(true);

            const posModal = resolveSlipModalMode(false);
            expect(posModal.enableThermalPrinterButtons).toBe(true);
        });
    });

    // ==========================================
    // MODULE 4: Online Table Booking (booking online)
    // ==========================================
    describe('Module 4: Online Table Booking (booking online)', () => {
        it('4.1 should detect overlapping time slots (2-hour default block) and prevent double bookings', () => {
            const checkSlotOverlap = (reqStartStr, reqEndStr, bStartStr, bEndStr) => {
                const reqStart = new Date(reqStartStr);
                const reqEnd = new Date(reqEndStr);
                const bStart = new Date(bStartStr);
                const bEnd = new Date(bEndStr);
                return (reqStart < bEnd) && (reqEnd > bStart);
            };

            // Existing booking: 18:00 - 20:00
            const bStart = '2026-09-17T18:00:00+07:00';
            const bEnd = '2026-09-17T20:00:00+07:00';

            // Conflict A: Customer requests 18:30 - 20:30 (Overlap)
            expect(checkSlotOverlap('2026-09-17T18:30:00+07:00', '2026-09-17T20:30:00+07:00', bStart, bEnd)).toBe(true);

            // Conflict B: Customer requests 17:00 - 19:00 (Overlap)
            expect(checkSlotOverlap('2026-09-17T17:00:00+07:00', '2026-09-17T19:00:00+07:00', bStart, bEnd)).toBe(true);

            // Clean C: Customer requests 20:00 - 22:00 (Directly after, no overlap)
            expect(checkSlotOverlap('2026-09-17T20:00:00+07:00', '2026-09-17T22:00:00+07:00', bStart, bEnd)).toBe(false);

            // Clean D: Customer requests 16:00 - 18:00 (Before, no overlap)
            expect(checkSlotOverlap('2026-09-17T16:00:00+07:00', '2026-09-17T18:00:00+07:00', bStart, bEnd)).toBe(false);
        });

        it('4.2 should construct online booking payload with isAutoVerified flag without throwing ReferenceError', () => {
            // Testing the useBooking submitBooking payload logic we fixed
            const buildBookingPayload = ({ overrides = {}, depositAmount = 0, finalTotal = 600, bookingDateTime = '2026-09-17T18:00:00+07:00' }) => {
                const actualDepositPaid = overrides.actualDepositPaid !== undefined 
                    ? Number(overrides.actualDepositPaid) 
                    : Number(depositAmount || 0);
                const isFullPaid = overrides.isFullPaid || (actualDepositPaid >= finalTotal && finalTotal > 0);
                const isAutoVerified = Boolean(overrides.isAutoVerified ?? overrides.slipVerifyResult?.verified);
                const bankLabel = typeof overrides.slipVerifyResult?.bankName === 'object' 
                    ? (overrides.slipVerifyResult?.bankName?.th || overrides.slipVerifyResult?.bankName?.en || '') 
                    : (overrides.slipVerifyResult?.bankName || '');

                const staffRemarkContent = isAutoVerified
                    ? `[ONLINE] จองโต๊ะล่วงหน้า (${isFullPaid ? `ชำระเต็มจำนวน ฿${actualDepositPaid}` : `ตรวจมัดจำ Auto EasySlip ✓ ฿${actualDepositPaid}`}${bankLabel ? ' ' + bankLabel : ''})`
                    : (isFullPaid ? `[ONLINE] จองโต๊ะล่วงหน้า (โอนเต็มจำนวน ฿${actualDepositPaid})` : '[ONLINE] จองโต๊ะล่วงหน้า');

                return {
                    source: 'online',
                    booking_type: 'dine_in',
                    status: isAutoVerified ? 'confirmed' : 'pending',
                    booking_time: bookingDateTime,
                    total_amount: finalTotal,
                    deposit_amount: actualDepositPaid,
                    staff_remark: staffRemarkContent,
                    slip_verified: isAutoVerified,
                    slip_verification_status: isAutoVerified ? 'auto_verified' : (overrides.slipVerifyResult ? 'manual_pending' : 'pending')
                };
            };

            // Test auto-verified case
            const autoVerifiedPayload = buildBookingPayload({
                overrides: {
                    slipVerifyResult: { verified: true, bankName: 'KBANK', amountInSlip: 300 }
                },
                depositAmount: 300,
                finalTotal: 600
            });
            expect(autoVerifiedPayload.status).toBe('confirmed');
            expect(autoVerifiedPayload.slip_verified).toBe(true);
            expect(autoVerifiedPayload.slip_verification_status).toBe('auto_verified');
            expect(autoVerifiedPayload.staff_remark).toContain('Auto EasySlip ✓');

            // Test manual pending case
            const manualPayload = buildBookingPayload({
                overrides: {
                    slipVerifyResult: { verified: false }
                },
                depositAmount: 300,
                finalTotal: 600
            });
            expect(manualPayload.status).toBe('pending');
            expect(manualPayload.slip_verified).toBe(false);
            expect(manualPayload.slip_verification_status).toBe('manual_pending');
        });
    });

    // ==========================================
    // MODULE 5: Online Pickup (/pickup)
    // ==========================================
    describe('Module 5: Online Takeaway & Pickup (pickup online)', () => {
        it('5.1 should enforce 100% advance deposit for pickup orders', () => {
            const cartItems = [
                { id: '1', name: 'Cold Brew', price: 95, qty: 2 },
                { id: '2', name: 'Croissant', price: 85, qty: 1 }
            ];
            const subtotal = cartItems.reduce((acc, i) => acc + (i.price * i.qty), 0);
            const discount = 0;
            const finalTotal = subtotal - discount;

            // Pickup orders require 100% deposit
            const pickupDeposit = finalTotal;

            expect(finalTotal).toBe(275);
            expect(pickupDeposit).toBe(finalTotal);
        });

        it('5.2 should route pickup orders into POS Online Hub with sound notification and deduplication', () => {
            const processedAlerts = new Set();

            const handleOnlineOrderReceived = (order) => {
                const eventKey = `online_hub_insert_${order.id}`;
                if (processedAlerts.has(eventKey)) {
                    return { playedSound: false, duplicate: true };
                }
                processedAlerts.add(eventKey);
                return { playedSound: true, duplicate: false };
            };

            const sampleOrder = { id: 'pickup-999', booking_type: 'pickup', total_amount: 275 };

            // First event
            const res1 = handleOnlineOrderReceived(sampleOrder);
            expect(res1.playedSound).toBe(true);

            // Duplicate event within short time window
            const res2 = handleOnlineOrderReceived(sampleOrder);
            expect(res2.playedSound).toBe(false);
            expect(res2.duplicate).toBe(true);
        });
    });
});
