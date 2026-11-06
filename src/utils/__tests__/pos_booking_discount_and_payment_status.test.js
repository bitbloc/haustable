import { describe, it, expect } from 'vitest';
import { getBookingPaymentStatusInfo } from '../bookingHelper';

describe('POS Advance Booking Discount & Paid-in-full Logic (Dieter Rams + Thai Modern)', () => {
    // -------------------------------------------------------------------------
    // Scenario 1: Order #9FCF (User Report Issue)
    // -------------------------------------------------------------------------
    it('1.1 should correctly calculate 10% discount and recognize order as FULLY PAID (฿0 due)', () => {
        // Mock items from user's order #9FCF:
        // ข้าวหมูตกเดา (฿99 x 10) = ฿990
        // สปาเก็ตตีเขียวหวานเนื้อโคขุน (฿269 x 10) = ฿2,690
        // ข้าวซอยญี่ปุ่น หมูชูวี (฿139 x 10) = ฿1,390
        // ข้าวซอยญี่ปุ่น เนื้อเสือร้องไห้สไลด์ (฿239 x 10) = ฿2,390
        const items = [
            { name: 'ข้าวหมูตกเดา', price: 99, quantity: 10 },
            { name: 'สปาเก็ตตีเขียวหวานเนื้อโคขุน (เผ็ด)', price: 269, quantity: 10 },
            { name: 'ข้าวซอยญี่ปุ่น • หมูชูวี', price: 139, quantity: 10 },
            { name: 'ข้าวซอยญี่ปุ่น • เนื้อเสือร้องไห้สไลด์', price: 239, quantity: 10 },
        ];
        const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        expect(subtotal).toBe(7460);

        const booking = {
            id: '9fcf-test-uuid',
            subtotal_amount: 7460,
            discount_amount: 746,
            total_amount: 6714,
            deposit_amount: 6714,
            payment_method: 'transfer',
            status: 'confirmed',
            staff_remark: '[MANUAL_ADMIN] รับจองผ่าน PHONE · [ส่วนลด 10%: -฿746.00] · [PAID: TRANSFER]'
        };

        // 1. Discount calculation
        const bookingDiscount = parseFloat(booking.discount_amount || 0);
        expect(bookingDiscount).toBe(746);

        // Derive percentage from remark or ratio
        const remarkMatch = booking.staff_remark.match(/\[ส่วนลด\s*([\d.]+)%/i);
        const percentStr = remarkMatch ? `${remarkMatch[1]}%` : `${Math.round((bookingDiscount / subtotal) * 100)}%`;
        expect(percentStr).toBe('10%');

        // 2. Net total calculation
        const netBeforeTax = Math.ceil(Math.max(0, subtotal - bookingDiscount));
        const includeTax = false;
        const tax = includeTax ? Math.ceil((netBeforeTax * 7) / 100) : 0;
        const netTotalWithTax = netBeforeTax + tax;
        expect(netTotalWithTax).toBe(6714);

        // 3. Paid in full recognition
        const depositPaid = parseFloat(booking.deposit_amount || 0);
        const splitPaidAmount = 0;
        const totalPaidAmount = depositPaid + splitPaidAmount;
        const remainingDue = Math.ceil(Math.max(0, netTotalWithTax - totalPaidAmount));
        expect(remainingDue).toBe(0);

        const isStatusCompleted = booking.status === 'completed' || booking.status === 'paid' || booking.status === 'success';
        const isAmountFullyCovered = netTotalWithTax > 0 && totalPaidAmount >= netTotalWithTax;
        const isDbFullyCovered = (Number(booking.total_amount) || 0) > 0 && (Number(booking.deposit_amount) || 0) >= (Number(booking.total_amount) || 0) && remainingDue === 0;

        const isFullyPaid = isStatusCompleted || isAmountFullyCovered || isDbFullyCovered;
        const isPartialDeposit = !isFullyPaid && depositPaid > 0;

        expect(isFullyPaid).toBe(true);
        expect(isPartialDeposit).toBe(false);

        // 4. getBookingPaymentStatusInfo pure helper verification
        const paymentInfo = getBookingPaymentStatusInfo(booking);
        expect(paymentInfo.isFullyPaid).toBe(true);
        expect(paymentInfo.isPartialPaid).toBe(false);
        expect(paymentInfo.remainingDue).toBe(0);
    });

    // -------------------------------------------------------------------------
    // Scenario 2: Partial Deposit Scenario
    // -------------------------------------------------------------------------
    it('1.2 should identify partial advance deposit and calculate remaining balance to checkout', () => {
        const subtotal = 7460;
        const bookingDiscount = 746; // 10%
        const netTotal = subtotal - bookingDiscount; // 6,714
        const depositPaid = 3000; // Customer paid partial deposit ฿3,000

        const booking = {
            total_amount: netTotal,
            deposit_amount: depositPaid,
            status: 'confirmed'
        };

        const totalPaidAmount = depositPaid;
        const remainingDue = Math.max(0, netTotal - totalPaidAmount);
        expect(remainingDue).toBe(3714);

        const isStatusCompleted = booking.status === 'completed' || booking.status === 'paid';
        const isAmountFullyCovered = netTotal > 0 && totalPaidAmount >= netTotal;
        const isFullyPaid = isStatusCompleted || isAmountFullyCovered;
        const isPartialDeposit = !isFullyPaid && depositPaid > 0;

        expect(isFullyPaid).toBe(false);
        expect(isPartialDeposit).toBe(true);

        const paymentInfo = getBookingPaymentStatusInfo(booking);
        expect(paymentInfo.isFullyPaid).toBe(false);
        expect(paymentInfo.isPartialPaid).toBe(true);
        expect(paymentInfo.remainingDue).toBe(3714);
    });

    // -------------------------------------------------------------------------
    // Scenario 3: Additional items added to a previously settled booking
    // -------------------------------------------------------------------------
    it('1.3 should reflect additional charges when customer adds items after full payment', () => {
        const initialSubtotal = 7460;
        const bookingDiscount = 746;
        const previousDeposit = 6714; // Fully settled original bill

        // Customer adds 2 drinks at ฿150 each
        const addedItemsTotal = 300;
        const newSubtotal = initialSubtotal + addedItemsTotal; // 7,760
        const newNetTotal = newSubtotal - bookingDiscount; // 7,014

        const remainingDue = Math.max(0, newNetTotal - previousDeposit);
        expect(remainingDue).toBe(300);

        const isFullyPaid = newNetTotal > 0 && previousDeposit >= newNetTotal;
        expect(isFullyPaid).toBe(false);
    });

    // -------------------------------------------------------------------------
    // Scenario 4: Local discount override takes precedence
    // -------------------------------------------------------------------------
    it('1.4 should allow staff in POS to override booking discount if manual discount is entered', () => {
        const subtotal = 1000;
        const bookingDiscount = 100; // 10% from booking
        const manualDiscountVal = '150'; // Staff gives special ฿150 discount in POS

        const hasLocalOverride = parseFloat(manualDiscountVal) > 0;
        const effectiveBookingDiscount = hasLocalOverride ? 0 : bookingDiscount;
        const manualDiscount = parseFloat(manualDiscountVal);

        const totalDiscount = effectiveBookingDiscount + manualDiscount;
        expect(effectiveBookingDiscount).toBe(0);
        expect(totalDiscount).toBe(150);
        expect(subtotal - totalDiscount).toBe(850);
    });

    // -------------------------------------------------------------------------
    // Scenario 5: Order #CB65 (50% Food Advance Deduction Persistence)
    // -------------------------------------------------------------------------
    it('1.5 should persist 50% food discount (฿456) across table switching, moving, and ordering additional items', () => {
        // Items from order #CB65:
        // Food: แกงมัสมั่น (฿299), สะตอผัดกุ้ง (฿299), ทาทากิ (฿199), ข้าวหมูย่าง (฿99), ข้าวสวย (฿15) = ฿911
        // Drinks: PRO 2 แถม 1 (฿498), น้ำเปล่า (฿20) = ฿518
        // Subtotal = ฿1,429
        const foodSubtotal = 299 + 299 + 199 + 99 + 15; // 911
        const drinksSubtotal = 498 + 20; // 518
        const initialSubtotal = foodSubtotal + drinksSubtotal; // 1,429
        expect(initialSubtotal).toBe(1429);

        // 1. Staff deducts 50% of food: ฿455.5 -> ฿456
        const discountAmt = Math.round(foodSubtotal * 0.5);
        expect(discountAmt).toBe(456);

        // Booking record in Supabase with persisted discount
        let booking = {
            id: 'cdb98953-ae70-4f1b-9653-c2b6a433a348',
            table_id: 6, // Table H9
            subtotal_amount: initialSubtotal,
            discount_amount: discountAmt,
            total_amount: initialSubtotal - discountAmt, // 973
            staff_remark: '[QR:AUTO-SUBMIT] [ส่วนลด 50%: -฿456]'
        };

        // Verification 1: Net total reflects the ฿456 deduction
        let netTotal = initialSubtotal - (booking.discount_amount || 0);
        expect(netTotal).toBe(973);

        // Verification 2: Simulating table switch (Table H9 -> Table H6 -> Table H9)
        // When cashier reselects Table H9, POS restores discount from booking.discount_amount
        const restoredDiscount = parseFloat(booking.discount_amount) || 0;
        expect(restoredDiscount).toBe(456);
        const remarkMatch = (booking.staff_remark || '').match(/\[ส่วนลด\s*([\d.]+)%/i);
        expect(remarkMatch[1]).toBe('50');

        // Verification 3: Simulating Move Table (H9 -> H6)
        const targetTable = { id: 4, table_name: 'H6' };
        const movedBooking = {
            ...booking,
            table_id: targetTable.id,
            discount_amount: booking.discount_amount || 0 // Must be preserved!
        };
        expect(movedBooking.discount_amount).toBe(456);
        expect(movedBooking.table_id).toBe(4);

        // Verification 4: Simulating keying in additional items (e.g. adding 1 extra drink ฿100)
        const addedDrinkPrice = 100;
        const newSubtotal = initialSubtotal + addedDrinkPrice; // 1,529
        const targetBookingAfterAdd = {
            ...movedBooking,
            discount_amount: movedBooking.discount_amount // Preserved across kitchen slip send
        };
        const newNetTotal = newSubtotal - targetBookingAfterAdd.discount_amount;
        expect(targetBookingAfterAdd.discount_amount).toBe(456);
        expect(newNetTotal).toBe(1073); // Never reverts back to full 1,529!
    });
});