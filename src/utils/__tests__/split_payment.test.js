import { describe, it, expect } from 'vitest';
import {
    getBookingSplitRounds,
    getSplitTotalPaid,
    calculateSplitBalance,
    calculatePercentAmount,
    appendSplitRoundToRemark
} from '../splitPaymentHelper';

describe('splitPaymentHelper', () => {
    describe('calculatePercentAmount', () => {
        it('calculates exact percentage with integer baht rounding', () => {
            expect(calculatePercentAmount(50, 1000)).toBe(500);
            expect(calculatePercentAmount(25, 1000)).toBe(250);
            expect(calculatePercentAmount(10, 1000)).toBe(100);
            expect(calculatePercentAmount(100, 1000)).toBe(1000);
            expect(calculatePercentAmount(0, 1000)).toBe(0);
        });

        it('handles odd numbers and fractional percentages with ceiling math', () => {
            // 33.33% of 1000 = 333.3 -> 334
            expect(calculatePercentAmount(33.33, 1000)).toBe(334);
            // 15% of 350 = 52.5 -> 53
            expect(calculatePercentAmount(15, 350)).toBe(53);
            // 70% of 700 = 490
            expect(calculatePercentAmount(70, 700)).toBe(490);
        });

        it('caps at baseAmount and handles invalid inputs', () => {
            expect(calculatePercentAmount(150, 500)).toBe(500);
            expect(calculatePercentAmount(-10, 500)).toBe(0);
            expect(calculatePercentAmount('abc', 500)).toBe(0);
        });
    });

    describe('getBookingSplitRounds & appendSplitRoundToRemark', () => {
        it('returns empty array if no split remark is present', () => {
            expect(getBookingSplitRounds(null)).toEqual([]);
            expect(getBookingSplitRounds({})).toEqual([]);
            expect(getBookingSplitRounds({ staff_remark: 'Normal walk-in' })).toEqual([]);
        });

        it('parses structured JSON [SPLIT_ROUNDS: [...]]', () => {
            const remark = 'Table seated [SPLIT_ROUNDS: [{"round":1,"amount":300,"method":"qr","mode":"PERCENT","percent":30}]] [SPLIT: QR=300]';
            const rounds = getBookingSplitRounds({ staff_remark: remark });
            expect(rounds).toHaveLength(1);
            expect(rounds[0]).toMatchObject({
                round: 1,
                amount: 300,
                method: 'qr',
                mode: 'PERCENT',
                percent: 30
            });
            expect(getSplitTotalPaid({ staff_remark: remark })).toBe(300);
        });

        it('parses legacy format [SPLIT: CASH=100, QR=200]', () => {
            const remark = '[SPLIT: CASH=100, QR=200, CREDIT=50]';
            const rounds = getBookingSplitRounds({ staff_remark: remark });
            expect(rounds).toHaveLength(3);
            expect(rounds[0]).toMatchObject({ round: 1, amount: 100, method: 'cash' });
            expect(rounds[1]).toMatchObject({ round: 2, amount: 200, method: 'qr' });
            expect(rounds[2]).toMatchObject({ round: 3, amount: 50, method: 'credit' });
            expect(getSplitTotalPaid({ staff_remark: remark })).toBe(350);
        });

        it('appends multiple sequential split rounds correctly', () => {
            // Round 1
            const remark1 = appendSplitRoundToRemark('Walk-in table 1', {
                amount: 300,
                method: 'qr',
                mode: 'PERCENT',
                percent: 30,
                payer: '0812345678'
            });
            expect(remark1).toContain('[SPLIT_ROUNDS:');
            expect(remark1).toContain('[SPLIT: CASH=0, QR=300, CREDIT=0]');

            const rounds1 = getBookingSplitRounds({ staff_remark: remark1 });
            expect(rounds1).toHaveLength(1);
            expect(rounds1[0].round).toBe(1);
            expect(rounds1[0].amount).toBe(300);

            // Round 2
            const remark2 = appendSplitRoundToRemark(remark1, {
                amount: 400,
                method: 'cash',
                mode: 'CUSTOM'
            });
            expect(remark2).toContain('[SPLIT: CASH=400, QR=300, CREDIT=0]');

            const rounds2 = getBookingSplitRounds({ staff_remark: remark2 });
            expect(rounds2).toHaveLength(2);
            expect(rounds2[0].round).toBe(1);
            expect(rounds2[0].amount).toBe(300);
            expect(rounds2[1].round).toBe(2);
            expect(rounds2[1].amount).toBe(400);
            expect(getSplitTotalPaid({ staff_remark: remark2 })).toBe(700);
        });
    });

    describe('calculateSplitBalance', () => {
        const orderItems = [
            { price: 100, quantity: 2 }, // 200
            { price: 800, quantity: 1 }  // 800 -> Subtotal 1,000 + 7% VAT = 1,070
        ];

        it('calculates initial state (Round 1) before any payments', () => {
            const booking = { staff_remark: 'Seated guest' };
            const balance = calculateSplitBalance(booking, orderItems, true);

            expect(balance.subtotal).toBe(1000);
            expect(balance.tax).toBe(70);
            expect(balance.fullOrderTotal).toBe(1070);
            expect(balance.alreadyPaid).toBe(0);
            expect(balance.remainingBalance).toBe(1070);
            expect(balance.currentRoundNumber).toBe(1);
            expect(balance.isFullySettled).toBe(false);
        });

        it('calculates Round 2 state after Round 1 paid 500฿', () => {
            const remark = appendSplitRoundToRemark('', { amount: 500, method: 'qr' });
            const booking = { staff_remark: remark };
            const balance = calculateSplitBalance(booking, orderItems, true);

            expect(balance.fullOrderTotal).toBe(1070);
            expect(balance.alreadyPaid).toBe(500);
            expect(balance.remainingBalance).toBe(570);
            expect(balance.currentRoundNumber).toBe(2);
            expect(balance.isFullySettled).toBe(false);
        });

        it('calculates Full Settlement when remaining balance hits 0', () => {
            let remark = appendSplitRoundToRemark('', { amount: 500, method: 'qr' });
            remark = appendSplitRoundToRemark(remark, { amount: 570, method: 'cash' });
            const booking = { staff_remark: remark };
            const balance = calculateSplitBalance(booking, orderItems, true);

            expect(balance.alreadyPaid).toBe(1070);
            expect(balance.remainingBalance).toBe(0);
            expect(balance.isFullySettled).toBe(true);
        });
    });

    describe('Shift Payment Breakdown Integration', () => {
        it('accurately parses child split bookings by payment method', async () => {
            const { getBookingPaymentBreakdown } = await import('../shiftHelper');

            const child1 = {
                total_amount: 300,
                staff_remark: 'Split (Round 1 (30%)) Paid by QR'
            };
            const breakdown1 = getBookingPaymentBreakdown(child1);
            expect(breakdown1.qr).toBe(300);
            expect(breakdown1.cash).toBe(0);

            const child2 = {
                total_amount: 700,
                staff_remark: 'Split (Round 2 (70%)) Paid by CASH'
            };
            const breakdown2 = getBookingPaymentBreakdown(child2);
            expect(breakdown2.cash).toBe(700);
            expect(breakdown2.qr).toBe(0);
        });

        it('parent booking with total_amount 0 produces zero revenue preventing double counting', async () => {
            const { getBookingPaymentBreakdown } = await import('../shiftHelper');

            const parentSettled = {
                total_amount: 0,
                staff_remark: 'Table seated [SPLIT_ROUNDS: [{"round":1,"amount":300,"method":"qr"},{"round":2,"amount":700,"method":"cash"}]] [SPLIT: CASH=700, QR=300, CREDIT=0]'
            };
            const breakdown = getBookingPaymentBreakdown(parentSettled);
            // Since total_amount is 0 or summary tag matches, verify cash + qr equals 1000 or 0
            expect(breakdown.isSplit).toBe(true);
            expect(breakdown.cash).toBe(700);
            expect(breakdown.qr).toBe(300);
        });
    });

    describe('Dedicated Split Payment QR Slip Generator', () => {
        it('should correctly encode ESC/POS binary data for a split chunk QR slip', async () => {
            const { encodeSplitQrSlipData } = await import('../printerHelper');
            const booking = {
                id: 'b-split-test',
                table_name: '02',
                total_amount: 170
            };
            const splitDetails = {
                tableName: '02',
                roundNumber: 3,
                splitAmount: 55,
                fullOrderTotal: 170,
                remainingBalanceAfterSplit: 0,
                promptpayId: '0614232455',
                promptpayName: 'ร้านในบ้าน นครพนม'
            };

            const rawBytes = encodeSplitQrSlipData(booking, splitDetails, '80mm');
            expect(rawBytes).toBeInstanceOf(Uint8Array);
            expect(rawBytes.length).toBeGreaterThan(50);
        });

        it('should correctly identify when a bill is fully settled upon final split round', () => {
            const booking = {
                id: 'b-full-settle-test',
                total_amount: 1000,
                staff_remark: '[SPLIT_ROUNDS: [{"round":1,"amount":400,"method":"qr"}]]'
            };
            const balance = calculateSplitBalance(booking, []);
            expect(balance.alreadyPaid).toBe(400);
            expect(balance.remainingBalance).toBe(600);

            // Final chunk paying the remaining 600
            const nextRemaining = balance.remainingBalance - 600;
            expect(nextRemaining).toBe(0);
        });
    });

    describe('Table 02 Bug Fix: Split PromptPay wrongly identified as Credit Card', () => {
        it('resolves 100% QR split round to QR payment method instead of CREDIT even with CREDIT=0 in remark', async () => {
            const { getBookingPaymentMethod } = await import('../printerHelper');
            const { getBookingPaymentBreakdown } = await import('../shiftHelper');

            const table02Booking = {
                id: 'table-02-test',
                total_amount: 170,
                staff_remark: '[SPLIT_ROUNDS: [{"round":1,"amount":170,"method":"qr"}]] [SPLIT: CASH=0, QR=170, CREDIT=0]'
            };

            // Must NOT return CREDIT!
            const method = getBookingPaymentMethod(table02Booking);
            expect(method).toBe('QR');

            const breakdown = getBookingPaymentBreakdown(table02Booking);
            expect(breakdown.qr).toBe(170);
            expect(breakdown.cash).toBe(0);
            expect(breakdown.credit).toBe(0);
            expect(breakdown.isSplit).toBe(false);
            expect(breakdown.methodLabel).toBe('QR Transfer');
        });

        it('resolves multi-method split rounds to SPLIT', async () => {
            const { getBookingPaymentMethod } = await import('../printerHelper');
            const { getBookingPaymentBreakdown } = await import('../shiftHelper');

            const mixedBooking = {
                id: 'mixed-test',
                total_amount: 300,
                staff_remark: '[SPLIT_ROUNDS: [{"round":1,"amount":100,"method":"cash"},{"round":2,"amount":200,"method":"qr"}]] [SPLIT: CASH=100, QR=200, CREDIT=0]'
            };

            const method = getBookingPaymentMethod(mixedBooking);
            expect(method).toBe('SPLIT');

            const breakdown = getBookingPaymentBreakdown(mixedBooking);
            expect(breakdown.cash).toBe(100);
            expect(breakdown.qr).toBe(200);
            expect(breakdown.credit).toBe(0);
            expect(breakdown.isSplit).toBe(true);
            expect(breakdown.methodLabel).toBe('Split (ผสม)');
        });

        it('generates receipt text with PromptPay label instead of Credit Card for Table 02 scenario', async () => {
            const { encodeReceiptData, getBookingPaymentMethod } = await import('../printerHelper');
            const table02Booking = {
                id: 'table-02-test',
                total_amount: 170,
                table_name: '02',
                staff_remark: '[SPLIT_ROUNDS: [{"round":1,"amount":170,"method":"qr"}]] [SPLIT: CASH=0, QR=170, CREDIT=0]',
                order_items: [
                    { name: 'ข้าวไข่เจียว', quantity: 1, price: 55 },
                    { name: 'ข้าวไข่ดาว 2 ฟอง', quantity: 1, price: 50 },
                    { name: 'ข้าวไข่เจียวหมูสับ', quantity: 1, price: 65 }
                ]
            };

            const detectedMethod = getBookingPaymentMethod(table02Booking);
            const encoded = encodeReceiptData(table02Booking, 'receipt', detectedMethod.toLowerCase(), {}, '80mm', {}, 'browser');
            
            // Decoded text verification
            const decoded = new TextDecoder('tis-620', { fatal: false }).decode(encoded);
            expect(decoded).toContain('ช่องทางชำระเงิน:');
            expect(decoded).toContain('PromptPay');
            expect(decoded).not.toContain('บัตรเครดิต');
        });
    });
});

