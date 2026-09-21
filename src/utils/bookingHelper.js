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
