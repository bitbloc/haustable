import { getSplitTotalPaid } from './splitPaymentHelper'
import { isAdvanceUnseatedReservation } from './availabilityUtils'

const COMPLETED_STATUSES = new Set(['completed', 'paid', 'success'])
const ACTIVE_UNPAID_STATUSES = new Set(['seated', 'confirmed', 'ready', 'preparing'])

/**
 * Sums all non-void, non-reward line items attached to a booking.
 * @param {Object} booking
 * @returns {number}
 */
export function sumBookingOrderItems(booking) {
    const items = Array.isArray(booking?.order_items) ? booking.order_items : []
    return items.reduce((sum, it) => {
        if (!it || it.status === 'void' || it.status === 'cancelled' || it.is_reward) {
            return sum
        }
        const unitPrice = Number(it.price_at_time ?? it.menu_items?.price ?? it.price ?? 0) || 0
        const qty = Number(it.quantity ?? 1) || 0
        return sum + Math.max(0, unitPrice * qty)
    }, 0)
}

/**
 * Resolves the gross bill amount for a booking, preferring live order_items on active bills.
 * @param {Object} booking
 * @returns {number}
 */
export function resolveBookingBillTotal(booking) {
    if (!booking) return 0
    const status = String(booking.status || '').toLowerCase()
    const rawAmount = Number(booking.total_amount || booking.total_price || 0) || 0
    const items = Array.isArray(booking.order_items) ? booking.order_items : []
    const itemsSum = items.length > 0 ? sumBookingOrderItems(booking) : 0

    if (COMPLETED_STATUSES.has(status)) {
        return rawAmount > 0 ? rawAmount : itemsSum
    }

    if (items.length > 0) {
        const discount = Math.max(
            0,
            (Number(booking.discount_amount || 0) || 0) + (Number(booking.xhaus_discount || 0) || 0)
        )
        return Math.max(0, itemsSum - discount)
    }

    return Math.max(0, rawAmount)
}

/**
 * Computes the remaining unpaid balance on an active open table or unsettled order.
 * Deducts prepaid deposits and partial split rounds, and excludes platform-prepaid Line Man orders.
 * @param {Object} booking
 * @returns {number}
 */
export function computeBookingUnpaidAmount(booking) {
    if (!booking) return 0
    const status = String(booking.status || '').toLowerCase()
    if (!ACTIVE_UNPAID_STATUSES.has(status)) return 0

    const sourceLower = String(booking.source || '').toLowerCase()
    const remarkLower = String(booking.staff_remark || '').toLowerCase()
    const customerLower = String(booking.customer_name || '').toLowerCase()
    const isLineman =
        sourceLower === 'lineman' ||
        remarkLower.includes('lineman') ||
        customerLower.includes('line man')
    if (isLineman) return 0

    const billTotal = resolveBookingBillTotal(booking)
    const depositPaid = Math.max(0, Number(booking.deposit_amount || 0) || 0)
    const splitPaid = Math.max(0, Number(getSplitTotalPaid(booking) || 0) || 0)
    const remaining = Math.max(0, Math.round((billTotal - depositPaid - splitPaid) * 100) / 100)

    // Unseated online advance reservations that are already prepaid or 0-baht holds owe nothing yet
    if (isAdvanceUnseatedReservation(booking) && remaining <= 0) {
        return 0
    }

    return remaining
}

/**
 * Aggregates settled daily revenue, active unpaid balance, channel mix, and payment breakdown.
 * @param {Array} dailyBookings
 * @param {Function|null} getPaymentBreakdown
 * @returns {Object}
 */
export function computeDailyOverviewMetrics(dailyBookings = [], getPaymentBreakdown = null) {
    let revenueToday = 0
    let completedOrdersCount = 0
    let activeUnpaidRevenue = 0
    let activeUnpaidCount = 0
    let dineInCount = 0
    let pickupCount = 0
    let cash = 0
    let qr = 0
    let credit = 0

    ;(dailyBookings || []).forEach(b => {
        if (!b) return
        const status = String(b.status || '').toLowerCase()

        if (COMPLETED_STATUSES.has(status)) {
            const settledAmount = resolveBookingBillTotal(b)
            revenueToday += settledAmount
            completedOrdersCount++

            if (typeof getPaymentBreakdown === 'function') {
                const breakdown = getPaymentBreakdown(b)
                cash += breakdown.cash || 0
                qr += breakdown.qr || 0
                credit += breakdown.credit || 0
            }
        } else if (ACTIVE_UNPAID_STATUSES.has(status)) {
            const unpaid = computeBookingUnpaidAmount(b)
            if (unpaid > 0) {
                activeUnpaidRevenue += unpaid
                activeUnpaidCount++
            }
        }

        if (status !== 'cancelled' && status !== 'void') {
            if (b.booking_type === 'dine_in' || b.booking_type === 'walk_in') {
                dineInCount++
            } else if (b.booking_type === 'pickup') {
                pickupCount++
            }
        }
    })

    return {
        revenueToday,
        completedOrdersCount,
        activeUnpaidRevenue,
        activeUnpaidCount,
        dineInCount,
        pickupCount,
        paymentBreakdown: { cash, qr, credit }
    }
}
