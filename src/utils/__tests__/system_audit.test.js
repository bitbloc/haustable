import { describe, it, expect } from 'vitest';
import { thaiBahtText, validateThaiTaxId, calculateDocumentTotals } from '../thaiTaxHelper';
import { getPrinterCellWidth, padEndPrinter, wrapTextByWords, formatThreeCols, compileShiftReportData, getBookingPaymentMethod, encodeReceiptData } from '../printerHelper';
import { decodeTis620 } from '../wmaParser';
import { calculateMemberTier, parseTiersConfig, DEFAULT_CRM_TIERS, calculateMemberCrmScore, resolveDominantCrmMember } from '../crmHelper';
import { checkDuplicateExpense } from '../duplicateDetector';
import { calculateShiftMetrics, getBookingPaymentBreakdown } from '../shiftHelper';
import { parseTableTransferInfo, formatMergeSourceRemark, formatMergeTargetRemark, formatMoveRemark, stripInternalTransferTags } from '../tableTransferHelper';

describe('System Audit - Phase 1 & 4: Thai Tax & Financial Calculation Engine', () => {
    it('should convert numbers to Thai Baht text correctly (thaiBahtText)', () => {
        expect(thaiBahtText(0)).toBe('ศูนย์บาทถ้วน');
        expect(thaiBahtText(1)).toBe('หนึ่งบาทถ้วน');
        expect(thaiBahtText(11)).toBe('สิบเอ็ดบาทถ้วน');
        expect(thaiBahtText(21)).toBe('ยี่สิบเอ็ดบาทถ้วน');
        expect(thaiBahtText(100)).toBe('หนึ่งร้อยบาทถ้วน');
        expect(thaiBahtText(1011)).toBe('หนึ่งพันสิบเอ็ดบาทถ้วน');
        expect(thaiBahtText(1520.50)).toBe('หนึ่งพันห้าร้อยยี่สิบบาทห้าสิบสตางค์');
        expect(thaiBahtText(1000000)).toBe('หนึ่งล้านบาทถ้วน');
        expect(thaiBahtText(1234567.89)).toBe('หนึ่งล้านสองแสนสามหมื่นสี่พันห้าร้อยหกสิบเจ็ดบาทแปดสิบเก้าสตางค์');
    });

    it('should validate Thai Tax IDs with Mod 11 checksum (validateThaiTaxId)', () => {
        // Valid 13-digit Thai Tax ID / ID card (Mod 11 verified: 1100700123455)
        expect(validateThaiTaxId('1100700123455')).toBe(true);
        // Invalid IDs
        expect(validateThaiTaxId('1234567890123')).toBe(false);
        expect(validateThaiTaxId('123')).toBe(false);
        expect(validateThaiTaxId('')).toBe(false);
    });

    it('should calculate VAT 7% inclusive and exclusive correctly (calculateDocumentTotals)', () => {
        // Inclusive VAT (e.g. Total 107 -> Pre-VAT 100, VAT 7)
        const inclusive = calculateDocumentTotals({
            items: [{ price: 107, quantity: 1 }],
            isVatRegistered: true,
            vatModel: 'inclusive'
        });
        expect(inclusive.subtotal).toBe(107);
        expect(inclusive.preVatAmount).toBe(100);
        expect(inclusive.vatAmount).toBe(7);
        expect(inclusive.totalAmount).toBe(107);

        // Exclusive VAT (e.g. Net 100 -> VAT 7 -> Grand Total 107)
        const exclusive = calculateDocumentTotals({
            items: [{ price: 100, quantity: 1 }],
            isVatRegistered: true,
            vatModel: 'exclusive'
        });
        expect(exclusive.subtotal).toBe(100);
        expect(exclusive.preVatAmount).toBe(100);
        expect(exclusive.vatAmount).toBe(7);
        expect(exclusive.totalAmount).toBe(107);

        // Withholding Tax 3%
        const wht = calculateDocumentTotals({
            items: [{ price: 1000, quantity: 1 }],
            isVatRegistered: false,
            whtRate: 3
        });
        expect(wht.whtAmount).toBe(30);
        expect(wht.netPayable).toBe(970);
    });
});

describe('System Audit - Phase 2: ESC/POS Thermal Printer & Thai Graphemes Engine', () => {
    it('should measure byte length for ESC/POS text printing and graphemes when requested', () => {
        // TIS-620 ESC/POS hardware cell width mode (default useByteLength = true per Rule 3)
        expect(getPrinterCellWidth('กิมจิ')).toBe(5);
        expect(getPrinterCellWidth('ชาไทย')).toBe(5);
        
        // Grapheme cluster mode (useByteLength = false)
        expect(getPrinterCellWidth('กิมจิ', false)).toBe(3);
        expect(getPrinterCellWidth('ชาไทย', false)).toBe(5);
    });

    it('should pad string based on printer cell width without right-edge distortion', () => {
        const padded = padEndPrinter('โต๊ะ 1', 10);
        expect(getPrinterCellWidth(padded)).toBe(10);
    });

    it('should wrap Thai sentences by word tokens (wrapTextByWords)', () => {
        const text = 'น้ำผึ้งมะนาวโซดาปั่นท็อปปิ้งเจลลี่';
        const lines = wrapTextByWords(text, 15);
        expect(lines.length).toBeGreaterThan(1);
        lines.forEach(line => {
            expect(getPrinterCellWidth(line)).toBeLessThanOrEqual(15);
        });
    });

    it('should include prominent table footer beacon in kitchen order slips (encodeReceiptData)', () => {
        const dummyBooking = {
            id: 'bk-1234',
            short_id: '1234',
            booking_type: 'dine_in',
            pax: 2,
            order_time: '2026-09-01T12:30:00.000Z',
            tables_layout: { table_name: 'A1' },
            order_items: [
                {
                    name: 'ข้าวกะเพราหมูกรอบ',
                    quantity: 2,
                    price_at_time: 120,
                    destination: 'kitchen'
                }
            ]
        };

        const encoded = encodeReceiptData(dummyBooking, 'kitchen', 'cash');
        expect(encoded).toBeInstanceOf(Uint8Array);
        expect(encoded.length).toBeGreaterThan(0);

        const decodedText = decodeTis620(encoded);
        expect(decodedText).toContain('โต๊ะ A1');
        expect(decodedText).toContain('ครัว');
        expect(decodedText).toContain('2 ชิ้น');
        expect(decodedText).toContain('2 ท่าน');
    });
});

describe('System Audit - Phase 3: CRM Loyalty Tier & Duplicate Detection Engine', () => {
    it('should calculate tier thresholds and multipliers correctly', () => {
        const tiers = parseTiersConfig(DEFAULT_CRM_TIERS);

        // 0 - 3999 -> Common (1.0x)
        const user1 = calculateMemberTier(1500, 1500, tiers);
        expect(user1.current_tier).toBe('Haus Common');
        expect(user1.multiplier).toBe(1.00);

        // 4000 - 11999 -> People (1.25x)
        const user2 = calculateMemberTier(5000, 5000, tiers);
        expect(user2.current_tier).toBe('Haus People');
        expect(user2.multiplier).toBe(1.25);

        // 12000+ -> Inner Haus (1.50x)
        const user3 = calculateMemberTier(15000, 15000, tiers);
        expect(user3.current_tier).toBe('Inner Haus');
        expect(user3.multiplier).toBe(1.50);
    });

    it('should detect duplicate expense receipts within similarity threshold (checkDuplicateExpense)', () => {
        const existingExpenses = [
            {
                id: 'exp_1',
                vendor_name: 'Makro นครพนม',
                amount: 1450.00,
                expense_date: '2026-08-20',
                invoice_no: 'INV-9988'
            },
            {
                id: 'exp_2',
                vendor_name: 'Lotus นครพนม',
                amount: 320.50,
                expense_date: '2026-08-21',
                invoice_no: null
            }
        ];

        // 1. Exact match invoice number -> duplicate
        const matchInvoice = checkDuplicateExpense({
            vendor_name: 'Makro',
            amount: 1450.00,
            expense_date: '2026-08-20',
            invoice_no: 'INV-9988'
        }, existingExpenses);
        expect(matchInvoice).not.toBeNull();
        expect(matchInvoice.isDuplicate).toBe(true);
        expect(matchInvoice.confidence).toBe('HIGH');

        // 2. Same merchant + exact amount + close date -> probable duplicate
        const matchSimilar = checkDuplicateExpense({
            vendor_name: 'โลตัส นครพนม',
            amount: 320.50,
            expense_date: '2026-08-21',
            invoice_no: ''
        }, existingExpenses);
        expect(matchSimilar).not.toBeNull();
        expect(matchSimilar.isDuplicate).toBe(true);

        // 3. Different amount and date -> not duplicate
        const noMatch = checkDuplicateExpense({
            vendor_name: 'ร้านป้าศรี',
            amount: 99.00,
            expense_date: '2026-08-22',
            invoice_no: ''
        }, existingExpenses);
        expect(noMatch).toBeNull();
    });
});

describe('System Audit - Phase 4: Shift Report Sales Reconciliation & ESC/POS Alignment', () => {
    it('should reconcile cash sales, expected cash, and difference with 100% accuracy', () => {
        const mockShift = {
            id: 'shift_1787261694715',
            staffName: 'Add',
            openedAt: '2026-08-21T10:00:00.000Z',
            closedAt: '2026-08-21T17:52:00.000Z',
            openingFloat: 4193,
            closedCash: 3978,
            adjustments: [
                { type: 'out', amount: 100, note: 'แอ็ด-น้ำแข็ง' },
                { type: 'out', amount: 1000, note: 'แอ็ด-ไปตลาด' },
                { type: 'in', amount: 865, note: 'แอ็ด-เงินทอนไปตลาด' },
                { type: 'out', amount: 216, note: 'แอ็ด-พนักงาน' },
                { type: 'out', amount: 40, note: 'แอ็ด-ซื้อผัก' },
                { type: 'out', amount: 198, note: 'แอ็ด-ไอติม' }
            ]
        };

        const mockBookings = [
            { id: 'b1', status: 'completed', total_amount: 75, staff_remark: 'เงินสด', order_items: [{ name: 'กลับบ้าน', quantity: 1, price: 75, status: 'completed' }] },
            { id: 'b2', status: 'completed', total_amount: 399, staff_remark: '', order_items: [{ name: 'กับข้าว', quantity: 2, price: 199.5, status: 'completed' }] },
            { id: 'b3', status: 'completed', total_amount: 1000, staff_remark: 'QR Transfer', order_items: [] },
            { id: 'b4', status: 'completed', total_amount: 500, staff_remark: 'โอน', order_items: [] },
            { id: 'b5', status: 'completed', total_amount: 498, payment_slip_url: 'https://example.com/slip.jpg', order_items: [] },
            { id: 'b6_void', status: 'void', total_amount: 75, staff_remark: 'Voided bill', order_items: [{ name: 'ทำลายบิล', quantity: 1, price: 75, status: 'void' }] }
        ];

        const report = compileShiftReportData(mockShift, mockBookings, []);

        // Total Net Revenue (5 completed bills = 75 + 399 + 1000 + 500 + 498 = 2472)
        expect(report.netSales).toBe(2472);
        expect(report.totalBookings).toBe(5);

        // Cash Sales = 75 + 399 = 474
        expect(report.cashSales).toBe(474);
        expect(report.paymentSales.cash.count).toBe(2);
        expect(report.paymentSales.cash.amount).toBe(474);

        // QR Sales = 1000 + 500 + 498 = 1998
        expect(report.qrSales).toBe(1998);
        expect(report.paymentSales.qrPromptPay.count).toBe(3);
        expect(report.paymentSales.qrPromptPay.amount).toBe(1998);

        // Petty Cash Flow: Total In = 865, Total Out = 1554
        expect(report.totalIn).toBe(865);
        expect(report.totalOut).toBe(1554);

        // Expected Cash in Drawer = 4193 + 474 + 865 - 1554 = 3978
        expect(report.expectedCash).toBe(3978);

        // Actual Counted Cash = 3978 -> Difference = 0
        expect(report.actualCash).toBe(3978);
        expect(report.difference).toBe(0);

        // Void Data = 1 bill, 75 baht
        expect(report.voidData.wholeBill.count).toBe(1);
        expect(report.voidData.wholeBill.amount).toBe(75);
    });

    it('should correctly calculate Lotus payout scenario without stale summary overrides', () => {
        // User actual case scenario:
        // Opening Float: 4,196.00
        // Cash Sales: 159.00
        // Adjustments:
        //  - [out] 100 (แอ๊ด-น้ำแข็ง)
        //  - [out] 1000 (แอ๊ด-ไปซื้อโครงไก่)
        //  - [out] 167 (แอ๊ด-พัสดุพี่แบม)
        //  - [in]  956 (แอ๊ด-เงินทอนโลตัส)
        //  - [out] 127 (Add-โลตัส)
        // Total In = 956.00
        // Total Out = 100 + 1000 + 167 + 127 = 1,394.00
        // Expected Cash = 4,196 + 159 + 956 - 1,394 = 3,917.00
        // Actual Cash = 3,917.00 -> Difference = 0.00
        const shiftData = {
            id: 'shift_1787368383131',
            staffName: 'Add',
            openedAt: '2026-08-22T10:11:00.000Z',
            closedAt: '2026-08-22T18:04:00.000Z',
            openingFloat: 4196,
            closedCash: 3917,
            totalOut: 1267, // Stale totalOut passed in should NOT override actual adjustments!
            totalIn: 956,
            adjustments: [
                { type: 'out', amount: 100, note: 'แอ๊ด-น้ำแข็ง' },
                { type: 'out', amount: 1000, note: 'แอ๊ด-ไปซื้อโครงไก่' },
                { type: 'out', amount: 167, note: 'แอ๊ด-พัสดุพี่แบม' },
                { type: 'in',  amount: 956, note: 'แอ๊ด-เงินทอนโลตัส' },
                { type: 'out', amount: 127, note: 'Add-โลตัส' }
            ]
        };

        const mockBookings = [
            { id: 'b_cash', status: 'completed', total_amount: 159, staff_remark: 'เงินสด', order_items: [] },
            { id: 'b_qr',   status: 'completed', total_amount: 8491, staff_remark: 'QR PromptPay', order_items: [] }
        ];

        const report = compileShiftReportData(shiftData, mockBookings, []);

        expect(report.totalIn).toBe(956);
        expect(report.totalOut).toBe(1394); // Must be 1394 (including Lotus 127)
        expect(report.expectedCash).toBe(3917);
        expect(report.actualCash).toBe(3917);
        expect(report.difference).toBe(0); // Perfect zero discrepancy!
        expect(report.netSales).toBe(8650);
    });

    it('should format multi-line three columns with strict column alignment and no overflow for 3. น้ำเปล่าสิงห์', () => {
        const line = formatThreeCols('3. น้ำเปล่าสิงห์ 600 มล', 4, '80.00', 36);
        const subLines = line.split('\n');
        expect(subLines.length).toBeGreaterThan(1);
        
        // Every sub-line should not exceed maxCols (36)
        subLines.forEach(l => {
            expect(getPrinterCellWidth(l)).toBeLessThanOrEqual(36);
        });

        // The last line must end with price '80.00' and contain quantity '4'
        const lastLine = subLines[subLines.length - 1];
        expect(lastLine).toContain('80.00');
        expect(lastLine).toContain('4');
    });

    it('should accurately calculate shift metrics including bills seated before shift and decimal precision', () => {
        // User's exact scenario from image:
        // Cashier: Kanchanit Boonsuk, Shift opened: 18:07
        // Opening Float: 3,917.00
        // Completed bills:
        // - Bill 1 (Seated 17:45, Completed 18:15): Cash 469.00
        // - Bill 2 (Seated 18:10, Completed 18:30): Cash 935.00
        // - Bill 3 (Seated 18:12, Completed 18:40): QR PromptPay 1,200.30
        // - Bill 4 (Seated 18:15, Completed 18:50): QR PromptPay 1,456.00
        // Cash Sales = 469 + 935 = 1,404.00
        // QR Sales = 1,200.30 + 1,456.00 = 2,656.30
        // Expected Cash = 3,917 + 1,404 = 5,321.00
        const activeShift = {
            id: 'shift_user_case',
            staffName: 'Kanchanit Boonsuk',
            openedAt: '2026-08-22T18:07:00.000Z',
            openingFloat: 3917,
            adjustments: []
        };

        const bookings = [
            {
                id: 'b1_early_seated',
                status: 'completed',
                total_amount: 469,
                staff_remark: 'เงินสด',
                booking_time: '2026-08-22T17:45:00.000Z',
                updated_at: '2026-08-22T18:15:00.000Z'
            },
            {
                id: 'b2_cash',
                status: 'completed',
                total_amount: 935,
                staff_remark: 'เงินสด',
                booking_time: '2026-08-22T18:10:00.000Z',
                updated_at: '2026-08-22T18:30:00.000Z'
            },
            {
                id: 'b3_qr_decimal',
                status: 'completed',
                total_amount: 1200.30,
                staff_remark: 'QR PromptPay',
                booking_time: '2026-08-22T18:12:00.000Z',
                updated_at: '2026-08-22T18:40:00.000Z'
            },
            {
                id: 'b4_qr',
                status: 'completed',
                total_amount: 1456.00,
                payment_slip_url: 'https://example.com/slip.png',
                booking_time: '2026-08-22T18:15:00.000Z',
                updated_at: '2026-08-22T18:50:00.000Z'
            }
        ];

        const metrics = calculateShiftMetrics(activeShift, bookings);

        expect(metrics.cashSales).toBe(1404);
        expect(metrics.qrSales).toBe(2656.30);
        expect(metrics.totalSales).toBe(4060.30);
        expect(metrics.openingFloat).toBe(3917);
        expect(metrics.expectedCash).toBe(5321);
        expect(metrics.completedBookingsCount).toBe(4);
    });

    it('should correctly parse split payment remarks with getBookingPaymentBreakdown', () => {
        const splitBooking = {
            id: 'b_split',
            total_amount: 500,
            staff_remark: '[SPLIT: CASH=200, QR=300, CREDIT=0]'
        };

        const breakdown = getBookingPaymentBreakdown(splitBooking);
        expect(breakdown.isSplit).toBe(true);
        expect(breakdown.cash).toBe(200);
        expect(breakdown.qr).toBe(300);
        expect(breakdown.credit).toBe(0);
    });

    it('should NOT misclassify cash payments as QR even when QR-order tags or reservation slips exist', () => {
        // Case 1: Table ordered via QR menu, but guest paid CASH at counter
        const qrTableCashBooking = {
            id: 'b_qr_cash',
            total_amount: 450,
            staff_remark: '[QR] Walk-in Guest Paid by CASH [CASH: RECV=500, CHANGE=50]'
        };
        const breakdown1 = getBookingPaymentBreakdown(qrTableCashBooking);
        expect(breakdown1.cash).toBe(450);
        expect(breakdown1.qr).toBe(0);
        expect(breakdown1.methodLabel).toBe('Cash');
        expect(getBookingPaymentMethod(qrTableCashBooking)).toBe('CASH');

        // Case 2: Online booking had initial deposit slip, but final checkout was CASH
        const depositSlipCashBooking = {
            id: 'b_slip_cash',
            total_amount: 1200,
            payment_slip_url: 'https://example.com/reservation_slip.jpg',
            staff_remark: 'Paid by CASH'
        };
        const breakdown2 = getBookingPaymentBreakdown(depositSlipCashBooking);
        expect(breakdown2.cash).toBe(1200);
        expect(breakdown2.qr).toBe(0);
        expect(breakdown2.methodLabel).toBe('Cash');
        expect(getBookingPaymentMethod(depositSlipCashBooking)).toBe('CASH');

        // Case 3: Paid by QR Transfer
        const qrBooking = {
            id: 'b_qr',
            total_amount: 600,
            staff_remark: 'Paid by QR'
        };
        const breakdown3 = getBookingPaymentBreakdown(qrBooking);
        expect(breakdown3.cash).toBe(0);
        expect(breakdown3.qr).toBe(600);
        expect(breakdown3.methodLabel).toBe('QR Transfer');
        expect(getBookingPaymentMethod(qrBooking)).toBe('QR');

        // Case 4: Paid by Credit Card
        const creditBooking = {
            id: 'b_credit',
            total_amount: 800,
            staff_remark: 'Paid by CREDIT'
        };
        const breakdown4 = getBookingPaymentBreakdown(creditBooking);
        expect(breakdown4.cash).toBe(0);
        expect(breakdown4.credit).toBe(800);
        expect(breakdown4.methodLabel).toBe('Credit Card');
        expect(getBookingPaymentMethod(creditBooking)).toBe('CREDIT');
    });
});

describe('System Audit - Phase 5: Table Transfer & Merged Bills Architecture', () => {
    it('should format and parse source merged bills with target short bill IDs', () => {
        const remark = formatMergeSourceRemark('H4', '77F8', 851);
        expect(remark).toContain('[MERGED_TO:H4#77F8]');
        expect(remark).toContain('[TARGET_BILL:#77F8]');
        expect(remark).toContain('Merged into Table H4 (#77F8)');
        expect(remark).toContain('[ORIG_AMT:851]');

        const sourceBooking = {
            id: 'b_source_1234',
            status: 'void',
            staff_remark: remark,
            tables_layout: { table_name: 'H3' },
            total_amount: 0
        };

        const info = parseTableTransferInfo(sourceBooking);
        expect(info.isMergedSource).toBe(true);
        expect(info.mergedToTable).toBe('H4');
        expect(info.mergedToBillId).toBe('77F8');
        expect(info.targetTableDisplay).toBe('โต๊ะ H4 (#77F8)');
        expect(info.originalTotal).toBe(851);
    });

    it('should auto-resolve target short bill ID from allBookings if not explicit in remarks', () => {
        const sourceBooking = {
            id: 'b_source_old',
            status: 'void',
            staff_remark: '[MERGED_TO:H4] Merged into Table H4 [ORIG_AMT:851]',
            tables_layout: { table_name: 'H3' },
            booking_time: '2026-08-25T19:19:00.000Z'
        };

        const allBookings = [
            {
                id: 'b_target_h4_77f8',
                short_id: '77F8',
                status: 'seated',
                tables_layout: { table_name: 'H4' },
                booking_time: '2026-08-25T19:20:00.000Z'
            }
        ];

        const info = parseTableTransferInfo(sourceBooking, allBookings);
        expect(info.isMergedSource).toBe(true);
        expect(info.mergedToTable).toBe('H4');
        expect(info.mergedToBillId).toBe('77F8');
        expect(info.targetTableDisplay).toBe('โต๊ะ H4 (#77F8)');
    });

    it('should format and parse target combined bills with source short bill IDs', () => {
        const targetRemark = formatMergeTargetRemark('หมายเหตุเดิมของลูกค้า', 'H3', 'AC4E');
        expect(targetRemark).toContain('[MERGED_FROM:H3#AC4E]');

        const targetBooking = {
            id: 'b_target_h4_77f8',
            status: 'seated',
            staff_remark: targetRemark,
            tables_layout: { table_name: 'H4' }
        };

        const info = parseTableTransferInfo(targetBooking);
        expect(info.isMergedTarget).toBe(true);
        expect(info.mergedFromTables).toEqual(['H3']);
        expect(info.mergedFromBillIds).toEqual(['AC4E']);
        expect(info.mergedFromTableDisplay).toBe('โต๊ะ H3 (#AC4E)');
        expect(info.cleanRemark).toBe('หมายเหตุเดิมของลูกค้า');
    });

    it('should format and parse table move metadata', () => {
        const moveRemark = formatMoveRemark('ขอโต๊ะติดหน้าต่าง', 'H1', 'H3');
        expect(moveRemark).toContain('[MOVED:H1->H3@');

        const movedBooking = {
            id: 'b_moved',
            status: 'seated',
            staff_remark: moveRemark,
            tables_layout: { table_name: 'H3' }
        };

        const info = parseTableTransferInfo(movedBooking);
        expect(info.isMoved).toBe(true);
        expect(info.movedFromTable).toBe('H1');
        expect(info.movedToTable).toBe('H3');
        expect(info.cleanRemark).toBe('ขอโต๊ะติดหน้าต่าง');
    });

    it('should strip all internal transfer tags for customer receipt printing', () => {
        const dirtyRemark = '[MERGED_TO:H4#77F8] [TARGET_BILL:#77F8] [ORIG_AMT:851] หมายเหตุของลูกค้า [CALL_STAFF]';
        const clean = stripInternalTransferTags(dirtyRemark);
        expect(clean).toBe('หมายเหตุของลูกค้า');
    });

    it('should generate proper merged table indicator labels for backend Booking & Order UI', () => {
        const sourceBooking = {
            id: 'b_ac4e',
            short_id: 'AC4E',
            staff_remark: '[MERGED_TO:H4#77F8] [TARGET_BILL:#77F8] [ORIG_AMT:851] Merged into Table H4 (#77F8)',
            tables_layout: { table_name: 'H3' }
        };
        const targetBooking = {
            id: 'b_77f8',
            short_id: '77F8',
            staff_remark: '[MERGED_FROM:H3#AC4E]',
            tables_layout: { table_name: 'H4' }
        };

        const srcInfo = parseTableTransferInfo(sourceBooking);
        expect(srcInfo.isMergedSource).toBe(true);
        expect(srcInfo.targetTableDisplay).toBe('โต๊ะ H4 (#77F8)');
        expect(`โต๊ะรวม ➔ ${srcInfo.targetTableDisplay}`).toBe('โต๊ะรวม ➔ โต๊ะ H4 (#77F8)');

        const tgtInfo = parseTableTransferInfo(targetBooking);
        expect(tgtInfo.isMergedTarget).toBe(true);
        expect(tgtInfo.mergedFromTableDisplay).toBe('โต๊ะ H3 (#AC4E)');
        expect(`โต๊ะรวม (+${tgtInfo.mergedFromTableDisplay})`).toBe('โต๊ะรวม (+โต๊ะ H3 (#AC4E))');
    });
});

describe('System Audit - Phase 6: CRM Loyalty Dominance on Merged Bills', () => {
    it('should calculate member CRM scores prioritizing higher points, tier, and spend', () => {
        const guest = { id: null, customer_name: 'Guest' };
        const memberLow = { id: 'u1', xhaus_coins: 50, current_tier: 'Haus Common', total_spent: 1000 };
        const memberHighPoints = { id: 'u2', xhaus_coins: 500, current_tier: 'Haus Common', total_spent: 1000 };
        const memberHighTier = { id: 'u3', xhaus_coins: 500, current_tier: 'Inner Haus', total_spent: 15000 };

        expect(calculateMemberCrmScore(guest)).toBe(0);
        expect(calculateMemberCrmScore(memberHighPoints)).toBeGreaterThan(calculateMemberCrmScore(memberLow));
        expect(calculateMemberCrmScore(memberHighTier)).toBeGreaterThan(calculateMemberCrmScore(memberHighPoints));
    });

    it('should always select the member with higher points when merging tables (Source > Target)', () => {
        // Table A (Source) has 450 points, Table B (Target) has 120 points
        const sourceBooking = {
            id: 'b_source',
            user_id: 'user_source_vip',
            profiles: {
                id: 'user_source_vip',
                display_name: 'Khun Somchai (VIP)',
                xhaus_coins: 450,
                current_tier: 'Haus People'
            }
        };

        const targetBooking = {
            id: 'b_target',
            user_id: 'user_target_regular',
            profiles: {
                id: 'user_target_regular',
                display_name: 'Khun Somsak',
                xhaus_coins: 120,
                current_tier: 'Haus Common'
            }
        };

        const result = resolveDominantCrmMember(sourceBooking, targetBooking);
        expect(result.wasSourceChosen).toBe(true);
        expect(result.dominantMember.id).toBe('user_source_vip');
        expect(result.dominantMember.display_name).toBe('Khun Somchai (VIP)');
    });

    it('should retain target member if target has higher or equal points (Target >= Source)', () => {
        // Table A (Source) has 80 points, Table B (Target) has 300 points
        const sourceBooking = {
            id: 'b_source',
            user_id: 'user_a',
            profiles: {
                id: 'user_a',
                display_name: 'Member A',
                xhaus_coins: 80,
                current_tier: 'Haus Common'
            }
        };

        const targetBooking = {
            id: 'b_target',
            user_id: 'user_b',
            profiles: {
                id: 'user_b',
                display_name: 'Member B',
                xhaus_coins: 300,
                current_tier: 'Haus People'
            }
        };

        const result = resolveDominantCrmMember(sourceBooking, targetBooking);
        expect(result.wasSourceChosen).toBe(false);
        expect(result.dominantMember.id).toBe('user_b');
        expect(result.dominantMember.display_name).toBe('Member B');
    });

    it('should pick registered member over walk-in guest when merging', () => {
        // Source is registered member (15 points), Target is walk-in guest (0 points)
        const sourceBooking = {
            id: 'b_source_member',
            user_id: 'user_registered',
            profiles: {
                id: 'user_registered',
                display_name: 'Khun Ann',
                xhaus_coins: 15,
                current_tier: 'Haus Common'
            }
        };

        const targetBooking = {
            id: 'b_target_guest',
            user_id: null,
            profiles: null,
            customer_name: 'Walk-in Guest'
        };

        const result = resolveDominantCrmMember(sourceBooking, targetBooking);
        expect(result.wasSourceChosen).toBe(true);
        expect(result.dominantMember.id).toBe('user_registered');
    });
});


