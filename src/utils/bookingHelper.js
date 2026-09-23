/**
 * bookingHelper.js
 * Utility calculations and formatting for manual bookings, orders, and financial reconciliations.
 */

/**
 * Calculates booking financial breakdown with support for percentage or fixed THB discounts.
 * 
 * @param {Object} params
 * @param {number|string} params.subtotal - Base subtotal amount before discount
 * @param {'percent'|'amount'} [params.discountType='percent'] - Discount calculation mode
 * @param {number|string} [params.discountValue=0] - Discount input value (% or THB)
 * @param {number|string} [params.depositAmount=0] - Deposit amount paid
 * @returns {{
 *   subtotal: number,
 *   discountType: 'percent'|'amount',
 *   discountValue: number,
 *   discountAmount: number,
 *   netTotal: number,
 *   depositAmount: number,
 *   remainingDue: number
 * }}
 */
export function calculateBookingFinancials({
    subtotal = 0,
    discountType = 'percent',
    discountValue = 0,
    depositAmount = 0
}) {
    const rawSubtotal = Math.max(0, parseFloat(subtotal) || 0)
    const rawDiscVal = Math.max(0, parseFloat(discountValue) || 0)

    let discountAmount = 0
    if (rawDiscVal > 0 && rawSubtotal > 0) {
        if (discountType === 'percent') {
            const cappedPercent = Math.min(100, rawDiscVal)
            discountAmount = Math.round((rawSubtotal * (cappedPercent / 100)) * 100) / 100
        } else {
            discountAmount = Math.min(rawSubtotal, Math.round(rawDiscVal * 100) / 100)
        }
    }

    const netTotal = Math.max(0, Math.round((rawSubtotal - discountAmount) * 100) / 100)
    const rawDeposit = Math.max(0, parseFloat(depositAmount) || 0)
    const remainingDue = Math.max(0, Math.round((netTotal - rawDeposit) * 100) / 100)

    return {
        subtotal: rawSubtotal,
        discountType,
        discountValue: rawDiscVal,
        discountAmount,
        netTotal,
        depositAmount: rawDeposit,
        remainingDue
    }
}

/**
 * Formats a clean discount audit tag for staff remarks.
 * 
 * @param {'percent'|'amount'} discountType 
 * @param {number|string} discountValue 
 * @param {number} discountAmount 
 * @returns {string} e.g. "[ส่วนลด 10%: -฿100.00]" or "[ส่วนลด: -฿50.00]"
 */
export function formatDiscountRemarkTag(discountType, discountValue, discountAmount) {
    if (!discountAmount || discountAmount <= 0) return ''
    const formattedAmount = discountAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    if (discountType === 'percent') {
        return `[ส่วนลด ${discountValue}%: -฿${formattedAmount}]`
    }
    return `[ส่วนลด: -฿${formattedAmount}]`
}

/**
 * Pure payment status resolver for booking and POS records (Dieter Rams + Thai Modern)
 * Accurately determines if a booking was already paid in full from back-office (โอนชำระครบแล้ว)
 * versus a partial advance deposit (โอนมัดจำแล้ว).
 * 
 * @param {Object} booking 
 * @param {Object} [options]
 * @param {number} [options.liveTotal] - Optional dynamic/cart net total to override DB total_amount
 * @returns {{
 *   totalAmt: number,
 *   depAmt: number,
 *   discountAmt: number,
 *   remainingDue: number,
 *   isCancelledOrVoid: boolean,
 *   isFullyPaid: boolean,
 *   isPartialPaid: boolean,
 *   isUnpaid: boolean,
 *   statusLabel: string,
 *   paymentMethodLabel: string
 * }}
 */
export function getBookingPaymentStatusInfo(booking, options = {}) {
    if (!booking) {
        return {
            totalAmt: 0,
            depAmt: 0,
            remainingDue: 0,
            isCancelledOrVoid: false,
            isFullyPaid: false,
            isPartialPaid: false,
            isUnpaid: false
        }
    }

    const baseTotal = options.liveTotal !== undefined 
        ? Number(options.liveTotal || 0) 
        : Number(booking.total_amount || 0)
    const totalAmt = baseTotal
    const depAmt = Number(booking.deposit_amount || 0)
    const remainingDue = Math.max(0, Math.round((totalAmt - depAmt) * 100) / 100)

    const isCancelledOrVoid = booking.status === 'cancelled' || booking.status === 'void'
    const isCompleted = booking.status === 'completed' || booking.status === 'paid' || booking.status === 'success'
    const isLineman = (booking.source || '').toLowerCase() === 'lineman' || (booking.staff_remark || '').toLowerCase().includes('lineman')

    const isFullyPaid = !isCancelledOrVoid && (isCompleted || (depAmt >= totalAmt && totalAmt > 0) || isLineman)
    const isPartialPaid = !isCancelledOrVoid && !isFullyPaid && depAmt > 0 && remainingDue > 0
    const isUnpaid = !isCancelledOrVoid && !isFullyPaid && !isPartialPaid && totalAmt > 0

    return {
        totalAmt,
        depAmt,
        remainingDue,
        isCancelledOrVoid,
        isFullyPaid,
        isPartialPaid,
        isUnpaid
    }
}


