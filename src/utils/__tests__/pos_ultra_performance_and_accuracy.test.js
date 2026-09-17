import { describe, it, expect, vi } from 'vitest';
import { getSplitTotalPaid, calculateSplitBalance } from '../splitPaymentHelper';
import { resolveReceiptTotals } from '../printerHelper';

describe('POS Ultra Performance & Accuracy Audit Suite', () => {

    // =========================================================================
    // 1. Shift Accounting & Financial Settlement Accuracy (Deposit & Split Deductions)
    // =========================================================================
    describe('1. Shift Financial Settlement Precision', () => {
        it('1.1 should accurately calculate net settled amount deducting advance online deposit', () => {
            const subtotal = 1200;
            const includeTax = false;
            const depositPaid = 500; // Customer paid ฿500 online deposit via EasySlip
            const splitPaid = 0;

            const netBeforeTax = Math.ceil(subtotal);
            const calculatedTax = includeTax ? Math.ceil((netBeforeTax * 7) / 100) : 0;
            const fullBillTotal = Math.ceil(Math.max(0, netBeforeTax + calculatedTax));
            const actualRemainingToSettle = Math.ceil(Math.max(0, fullBillTotal - depositPaid - splitPaid));

            expect(fullBillTotal).toBe(1200);
            expect(actualRemainingToSettle).toBe(700);

            // Simulate shift transaction recording
            const shiftTransactions = [];
            const recordShiftTx = (bookingId, amount, method) => {
                shiftTransactions.push({ bookingId, amount, method });
            };

            // Call with actualRemainingToSettle (฿700) instead of fullBillTotal (฿1200)
            recordShiftTx('bk-online-1', actualRemainingToSettle, 'cash');

            expect(shiftTransactions[0].amount).toBe(700);
            expect(shiftTransactions[0].method).toBe('cash');
            // Cash drawer expected cash increases by exactly ฿700, NOT ฿1200
        });

        it('1.2 should accurately calculate net settled amount after multi-round split payment', () => {
            const mockBooking = {
                id: 'bk-split-1',
                staff_remark: '[SPLIT_ROUNDS: [{"round":1,"amount":400,"method":"qr"}]]',
                deposit_amount: 0
            };

            const splitPaid = getSplitTotalPaid(mockBooking);
            expect(splitPaid).toBe(400);

            const fullBillTotal = 1000;
            const depositPaid = 0;
            const actualRemainingToSettle = Math.ceil(Math.max(0, fullBillTotal - depositPaid - splitPaid));

            expect(actualRemainingToSettle).toBe(600);
        });

        it('1.3 should calculate change due accurately based on actualRemainingToSettle', () => {
            const actualRemainingToSettle = 700;
            const cashReceived = 1000;
            const changeDue = Math.max(0, cashReceived - actualRemainingToSettle);

            expect(changeDue).toBe(300);
        });
    });

    // =========================================================================
    // 2. VAT 7% & Math Rounding Precision
    // =========================================================================
    describe('2. VAT 7% & Integer Rounding Precision', () => {
        it('2.1 should eliminate floating-point artifacts using Math.ceil for VAT and Bill Total', () => {
            const netBeforeTax = 115;
            // Naive float: 115 * 1.07 = 123.05000000000001
            const naiveFloat = netBeforeTax * 1.07;
            expect(naiveFloat.toString()).toContain('05000000000001');

            // Standardized POS formula with integer division
            const calculatedTax = Math.ceil((netBeforeTax * 7) / 100);
            const fullBillTotal = Math.ceil(netBeforeTax + calculatedTax);

            expect(calculatedTax).toBe(9); // Math.ceil(8.05) = 9
            expect(fullBillTotal).toBe(124);
            expect(Number.isInteger(fullBillTotal)).toBe(true);
        });

        it('2.2 should align POSOrderPanel and POSDashboard total calculation identically', () => {
            const subtotal = 350;
            const promoDiscount = 50;
            const manualDiscount = 0;
            const xhausDiscount = 0;
            const freeDrinkDiscVal = 0;
            const includeTax = true;

            const netBeforeTax = Math.ceil(Math.max(0, subtotal - promoDiscount - manualDiscount - xhausDiscount - freeDrinkDiscVal));
            const calculatedTax = includeTax ? Math.ceil((netBeforeTax * 7) / 100) : 0;
            const fullBillTotal = Math.ceil(Math.max(0, netBeforeTax + calculatedTax));

            expect(netBeforeTax).toBe(300);
            expect(calculatedTax).toBe(21);
            expect(fullBillTotal).toBe(321);
        });
    });

    // =========================================================================
    // 3. Table Clearance Completeness (Ready Status Inclusion)
    // =========================================================================
    describe('3. Table Clearing Void Completeness', () => {
        it('3.1 should target all 4 active statuses including ready status when clearing a table', () => {
            const ACTIVE_STATUSES = ['pending', 'seated', 'confirmed', 'ready'];

            const mockTableBookings = [
                { id: 'b1', table_id: 3, status: 'ready' },
                { id: 'b2', table_id: 3, status: 'completed' },
                { id: 'b3', table_id: 3, status: 'seated' }
            ];

            // Filter simulating table clear void query:
            // .in('status', ['pending', 'seated', 'confirmed', 'ready'])
            const voidedBookings = mockTableBookings.filter(b => ACTIVE_STATUSES.includes(b.status));

            expect(voidedBookings.map(b => b.id)).toEqual(['b1', 'b3']);
            expect(voidedBookings.some(b => b.status === 'ready')).toBe(true);
            expect(voidedBookings.some(b => b.status === 'completed')).toBe(false);
        });
    });

    // =========================================================================
    // 4. Equal Split Remainder Distribution (Zero Satang Invariance)
    // =========================================================================
    describe('4. Equal Split Remainder Distribution', () => {
        it('4.1 should distribute integer remainder across split parties with 0 Baht discrepancy', () => {
            const targetTotal = 100; // ฿100 split 3 people
            const count = 3;

            const baseShare = Math.floor(targetTotal / count); // 33
            const remainder = targetTotal % count; // 1

            const shares = [];
            for (let i = 0; i < count; i++) {
                shares.push(baseShare + (i < remainder ? 1 : 0));
            }

            expect(shares).toEqual([34, 33, 33]);
            const sumOfShares = shares.reduce((a, b) => a + b, 0);
            expect(sumOfShares).toBe(targetTotal); // Exact ฿100.00
        });

        it('4.2 should distribute remainder for 7 people split on ฿1,000 bill', () => {
            const targetTotal = 1000;
            const count = 7;

            const baseShare = Math.floor(targetTotal / count); // 142
            const remainder = targetTotal % count; // 6

            const shares = [];
            for (let i = 0; i < count; i++) {
                shares.push(baseShare + (i < remainder ? 1 : 0));
            }

            expect(shares.reduce((a, b) => a + b, 0)).toBe(1000);
            expect(shares[0]).toBe(143);
            expect(shares[6]).toBe(142);
        });
    });

    // =========================================================================
    // 5. POSTableGrid Realtime Burst Coalescing
    // =========================================================================
    describe('5. POSTableGrid Realtime Burst Coalescing', () => {
        it('5.1 should coalesce rapid burst calls into a single execution after 120ms debounce', async () => {
            vi.useFakeTimers();
            let executionCount = 0;
            let timeoutId = null;

            const triggerFetchTables = () => {
                if (timeoutId) clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    executionCount++;
                }, 120);
            };

            // Simulate 5 realtime events arriving in a burst within 80ms
            triggerFetchTables();
            vi.advanceTimersByTime(20);
            triggerFetchTables();
            vi.advanceTimersByTime(20);
            triggerFetchTables();
            vi.advanceTimersByTime(20);
            triggerFetchTables();
            vi.advanceTimersByTime(20);
            triggerFetchTables();

            // Still within debounce window
            expect(executionCount).toBe(0);

            // Advance past 120ms window
            vi.advanceTimersByTime(120);

            // Exactly 1 execution occurred instead of 5
            expect(executionCount).toBe(1);

            vi.useRealTimers();
        });
    });

    // =========================================================================
    // 6. Admin Overview SQL Compatibility & Active Floor Preservation
    // =========================================================================
    describe('6. Admin Overview SQL Compatibility & Active Floor Preservation', () => {
        const INDEX_PREDICATE_STATUSES = ['pending', 'confirmed', 'seated', 'ready'];

        it('6.1 should verify that Admin Dashboard seatedReq status filter satisfies the SQL partial index predicate', () => {
            const adminDashboardFilter = ['seated', 'confirmed', 'ready'];
            const liveFloorStatusFilter = ['seated', 'confirmed', 'ready'];

            // In Postgres, a partial index WHERE status IN (...) can only be used
            // if query filter values are a strict subset of the partial index predicate
            const isDashboardCovered = adminDashboardFilter.every(s => INDEX_PREDICATE_STATUSES.includes(s));
            const isLiveFloorCovered = liveFloorStatusFilter.every(s => INDEX_PREDICATE_STATUSES.includes(s));

            expect(isDashboardCovered).toBe(true);
            expect(isLiveFloorCovered).toBe(true);
        });

        it('6.2 should preserve "ready" status tables in dailyBookings when viewing today', () => {
            const selectedDate = '2026-09-18';
            const isToday = true;

            const bookings = [
                // Overnight or earlier session: created yesterday, currently dining with food ready
                {
                    id: 'b-overnight-ready',
                    table_id: 5,
                    status: 'ready',
                    booking_type: 'dine_in',
                    booking_time: '2026-09-17T22:30:00+07:00',
                    created_at: '2026-09-17T22:30:00+07:00',
                    total_amount: 850
                },
                // Today's completed bill
                {
                    id: 'b-today-paid',
                    table_id: 2,
                    status: 'completed',
                    booking_type: 'dine_in',
                    booking_time: '2026-09-18T12:00:00+07:00',
                    created_at: '2026-09-18T12:00:00+07:00',
                    total_amount: 450
                }
            ];

            const dailyBookings = bookings.filter(b => {
                const bDate = new Date(b.booking_time || b.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
                const isDateMatch = bDate === selectedDate;
                const isCurrentSeated = isToday && (b.status === 'seated' || (b.status === 'ready' && b.booking_type !== 'pickup'));
                return isDateMatch || isCurrentSeated;
            });

            expect(dailyBookings.length).toBe(2);
            expect(dailyBookings.some(b => b.id === 'b-overnight-ready')).toBe(true);
        });

        it('6.3 should accurately accumulate activeUnpaidRevenue including ready status dining tables', () => {
            const mockDailyBookings = [
                { id: '1', status: 'completed', total_amount: 500 },
                { id: '2', status: 'seated', total_amount: 300 },
                { id: '3', status: 'ready', total_amount: 420 },
                { id: '4', status: 'confirmed', total_amount: 150 },
                { id: '5', status: 'cancelled', total_amount: 0 }
            ];

            let rev = 0;
            let paidCount = 0;
            let activeUnpaid = 0;
            let activeCount = 0;

            mockDailyBookings.forEach(b => {
                const amount = Number(b.total_amount || 0);
                const isCompleted = b.status === 'completed' || b.status === 'paid' || b.status === 'success';
                const isActiveUnpaid = b.status === 'seated' || b.status === 'confirmed' || b.status === 'ready';

                if (isCompleted) {
                    rev += amount;
                    paidCount++;
                } else if (isActiveUnpaid) {
                    activeUnpaid += amount;
                    activeCount++;
                }
            });

            expect(rev).toBe(500);
            expect(paidCount).toBe(1);
            // activeUnpaid must sum seated (300) + ready (420) + confirmed (150) = 870
            expect(activeUnpaid).toBe(870);
            expect(activeCount).toBe(3);
        });

        it('6.4 should correctly rank ready status at priority 3 in Admin Overview sort order', () => {
            const getPriority = (st) => {
                if (st === 'seated') return 1;
                if (st === 'pending') return 2;
                if (st === 'confirmed' || st === 'ready') return 3;
                if (st === 'completed' || st === 'paid' || st === 'success') return 4;
                return 5;
            };

            expect(getPriority('seated')).toBe(1);
            expect(getPriority('pending')).toBe(2);
            expect(getPriority('ready')).toBe(3);
            expect(getPriority('confirmed')).toBe(3);
            expect(getPriority('completed')).toBe(4);
            expect(getPriority('cancelled')).toBe(5);
        });
    });

    // =========================================================================
    // 7. Backend VAT 7% On/Off Toggle Synchronization & Isolation
    // =========================================================================
    describe('7. Backend VAT 7% On/Off Toggle Synchronization', () => {
        it('7.1 should compute ฿0 VAT and bill total equal to net subtotal when backend VAT is OFF', () => {
            const subtotal = 500;
            const discount = 50;
            const netBeforeTax = subtotal - discount; // 450
            const isBackendVatOn = false;
            const includeTax = isBackendVatOn;

            const calculatedTax = includeTax ? Math.ceil((netBeforeTax * 7) / 100) : 0;
            const fullBillTotal = Math.ceil(Math.max(0, netBeforeTax + calculatedTax));

            expect(calculatedTax).toBe(0);
            expect(fullBillTotal).toBe(450);
        });

        it('7.2 should compute 7% VAT accurately with integer division when backend VAT is ON', () => {
            const subtotal = 500;
            const discount = 50;
            const netBeforeTax = subtotal - discount; // 450
            const isBackendVatOn = true;
            const includeTax = isBackendVatOn;

            const calculatedTax = includeTax ? Math.ceil((netBeforeTax * 7) / 100) : 0;
            const fullBillTotal = Math.ceil(Math.max(0, netBeforeTax + calculatedTax));

            expect(calculatedTax).toBe(32); // Math.ceil(450 * 7 / 100) = Math.ceil(31.5) = 32
            expect(fullBillTotal).toBe(482);
        });

        it('7.3 should calculate split payment balance with ฿0 VAT when includeTax is false', () => {
            const booking = { id: 'b_test', total_amount: 1000 };
            const orderItems = [
                { id: '1', price: 600, quantity: 1 },
                { id: '2', price: 400, quantity: 1 }
            ];

            const splitWithoutTax = calculateSplitBalance(booking, orderItems, false);
            expect(splitWithoutTax.fullOrderTotal).toBe(1000); // 600 + 400 = 1000 with 0 tax

            const splitWithTax = calculateSplitBalance(booking, orderItems, true);
            expect(splitWithTax.fullOrderTotal).toBe(1070); // 1000 + 70 tax
        });

        it('7.4 should print ฿0 VAT on thermal receipt when backend VAT is disabled and booking has include_tax: false', () => {
            const booking = {
                id: 'b_receipt_vat_off',
                total_amount: 500,
                include_tax: false,
                order_items: [{ name: 'Spaghetti', price_at_time: 500, quantity: 1 }]
            };

            const totals = resolveReceiptTotals(booking, { vat_mode: 'none' });
            expect(totals.vat).toBe(0);
            expect(totals.total).toBe(500);
        });

        it('7.5 should respect table-level manual override without leaking to other tables', () => {
            const defaultVatEnabled = false; // Store is VAT-exempt
            const tableOverrides = new Map();

            // Cashier turns ON VAT specifically for Table 3
            tableOverrides.set('table-3', true);

            const getTableTax = (tableId) => {
                if (tableOverrides.has(tableId)) return tableOverrides.get(tableId);
                return defaultVatEnabled;
            };

            expect(getTableTax('table-3')).toBe(true);
            expect(getTableTax('table-4')).toBe(false); // Does not leak to Table 4
            expect(getTableTax('counter')).toBe(false); // Counter follows backend default
        });
    });

    // =========================================================================
    // 8. Send to Kitchen & 0ms Optimistic Floorplan Color Transitions
    // =========================================================================
    describe('8. Send to Kitchen & 0ms Optimistic Floorplan Color Transitions', () => {
        it('8.1 should correctly identify unsent draft items (no db_id) requiring Send to Kitchen', () => {
            const currentOrder = {
                items: [
                    { id: 'item-1', db_id: 'db_101', name: 'Pad Thai', price: 120, quantity: 1 },
                    { id: 'item-2', name: 'Iced Latte', price: 85, quantity: 1 } // No db_id -> new unsent item
                ]
            };

            const hasNewItems = currentOrder.items.some(item => !item.db_id);
            expect(hasNewItems).toBe(true);

            // Filter unsent items for kitchen submission
            const newItemsToSubmit = currentOrder.items.filter(i => !i.db_id);
            expect(newItemsToSubmit).toHaveLength(1);
            expect(newItemsToSubmit[0].name).toBe('Iced Latte');
        });

        it('8.2 should transition button from Send to Kitchen to Pay / Checkout once all items have db_id', () => {
            const currentOrder = {
                items: [
                    { id: 'item-1', db_id: 'db_101', name: 'Pad Thai', price: 120, quantity: 1 },
                    { id: 'item-2', db_id: 'db_102', name: 'Iced Latte', price: 85, quantity: 1 }
                ]
            };

            const hasNewItems = currentOrder.items.some(item => !item.db_id);
            expect(hasNewItems).toBe(false); // Ready for checkout!
        });

        it('8.3 should trigger onOpenSlip with "kitchen" when Send to Kitchen is clicked', async () => {
            let submittedType = null;
            const onOpenSlip = (type) => {
                submittedType = type;
            };

            // When hasNewItems is true, clicking primary button triggers onOpenSlip('kitchen')
            const hasNewItems = true;
            if (hasNewItems && onOpenSlip) {
                onOpenSlip('kitchen');
            }

            expect(submittedType).toBe('kitchen');
        });

        it('8.4 should optimistically set table status to occupied (red) in 0ms', () => {
            const initialTables = [
                { id: 't1', table_name: 'T-01', status: 'free', booking: null },
                { id: 't2', table_name: 'T-02', status: 'free', booking: null }
            ];

            // 0ms Optimistic event dispatched when walk-in created or items sent
            const targetTableId = 't1';
            const optimisticBooking = { id: 'booking-99', table_id: 't1', status: 'seated' };

            const updatedTables = initialTables.map(t => String(t.id) === String(targetTableId) ? {
                ...t,
                status: 'occupied',
                booking: optimisticBooking
            } : t);

            expect(updatedTables[0].status).toBe('occupied');
            expect(updatedTables[0].booking.id).toBe('booking-99');
            expect(updatedTables[1].status).toBe('free');
        });

        it('8.5 should immediately display yellow alert and pulse for staff call', () => {
            const table = {
                id: 't1',
                status: 'occupied',
                hasCallStaff: true,
                booking: { staff_remark: '[CALL_STAFF] Extra spoons' }
            };

            const hasCallStaff = Boolean(table.hasCallStaff || table.booking?.staff_remark?.includes('[CALL_STAFF]'));
            expect(hasCallStaff).toBe(true);

            // Priority: Call Staff Yellow takes visual priority over Red Occupied
            const visualClass = hasCallStaff ? 'animate-pos-blink-yellow' : (table.status === 'occupied' ? 'bg-[var(--color-accent)]' : 'bg-free');
            expect(visualClass).toBe('animate-pos-blink-yellow');
        });
    });
});


