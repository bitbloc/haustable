/**
 * availabilityUtils.js
 * Core availability and overlap calculations for online reservations and POS walk-in seating.
 * Implements Option 1: Smart Dynamic Turn + Live Seated Dining Protection.
 */

export const DEFAULT_HOLD_MINUTES = 30;

/**
 * True when an order is marked for pay-at-store settlement (`[PAY_AT_STORE]`).
 * @param {Object} booking
 * @returns {boolean}
 */
export function isPayAtStoreOrder(booking) {
    if (!booking) return false;
    const remark = String(booking.staff_remark || '');
    return remark.includes('[PAY_AT_STORE]');
}

/**
 * True when a booking requires staff phone confirmation (`[CALL_CONFIRM]`).
 * @param {Object} booking
 * @returns {boolean}
 */
export function isCallConfirmOrder(booking) {
    if (!booking) return false;
    const remark = String(booking.staff_remark || '');
    return remark.includes('[CALL_CONFIRM]');
}

/**
 * True when a booking is an unseated advance table reservation (`pending` or `confirmed`)
 * rather than an actively seated in-store dining session or walk-in/QR order.
 * @param {Object} booking
 * @returns {boolean}
 */
export function isAdvanceUnseatedReservation(booking) {
    if (!booking) return false;
    if (!['pending', 'confirmed'].includes(booking.status)) return false;

    const bType = String(booking.booking_type || '').toLowerCase();
    const oType = String(booking.order_type || '').toLowerCase();
    if (bType === 'pickup' || oType === 'pickup' || bType === 'hausmade' || oType.startsWith('hausmade')) {
        return false;
    }

    const remark = String(booking.staff_remark || '');
    const remarkLower = remark.toLowerCase();
    const isWalkInOrQR =
        bType === 'walk_in' ||
        bType === 'qr' ||
        remarkLower.includes('walk-in') ||
        remarkLower.includes('walk_in') ||
        remarkLower.includes('qr walk-in') ||
        remarkLower.startsWith('qr');

    if (isWalkInOrQR) return false;

    const source = String(booking.source || '').toLowerCase();
    if (
        remark.includes('[ONLINE]') ||
        remark.includes('[CALL_CONFIRM]') ||
        remark.includes('[MANUAL_ADMIN]') ||
        source === 'online' ||
        source === 'phone' ||
        source === 'line' ||
        source === 'facebook' ||
        bType === 'dine_in'
    ) {
        return true;
    }

    return false;
}

/**
 * Calculates the effective end time of a booking.
 * 
 * 1. Base end time: booking.end_time if explicitly present, else booking.booking_time + (defaultDurationHours).
 * 2. Live Seated Protection: If a booking is currently actively seated in-store (status === 'seated'),
 *    the table cannot be double-booked online while guests are still dining.
 *    If current time (now) approaches or exceeds the base end time, effectiveEnd is dynamically
 *    extended to at least (now + liveBufferMinutes), safeguarding against stale 2-hour limits.
 * 
 * @param {Object|string|Date} booking - Booking object or ISO date string
 * @param {Object} [options]
 * @param {number} [options.defaultDurationHours=2]
 * @param {number} [options.liveBufferMinutes=30]
 * @param {Date} [options.now=new Date()]
 * @returns {Date}
 */
export function calculateEffectiveBookingEnd(booking, options = {}) {
    const {
        defaultDurationHours = 2,
        liveBufferMinutes = 30,
        now = new Date()
    } = options;

    const bObj = (typeof booking === 'object' && booking !== null && !(booking instanceof Date))
        ? booking
        : { booking_time: booking };

    const bStart = new Date(bObj.booking_time);
    let bEnd = bObj.end_time
        ? new Date(bObj.end_time)
        : new Date(bStart.getTime() + (defaultDurationHours * 60 * 60 * 1000));

    // Smart Dynamic Extension for Live Seated Dining Sessions
    if (bObj.status === 'seated') {
        const liveProjectedEnd = new Date(now.getTime() + (liveBufferMinutes * 60 * 1000));
        if (liveProjectedEnd.getTime() > bEnd.getTime()) {
            bEnd = liveProjectedEnd;
        }
    }

    return bEnd;
}

/**
 * Reads the table-hold window stamped on free online bookings (`[HOLD:30]` in staff_remark).
 * @param {Object} booking
 * @returns {number|null} minutes, or null when the booking has no hold cap
 */
export function getBookingHoldMinutes(booking) {
    const remark = booking?.staff_remark || '';
    const match = /\[HOLD:(\d+)\]/.exec(remark);
    if (match) return Number(match[1]);
    if (remark.includes('[CALL_CONFIRM]')) return DEFAULT_HOLD_MINUTES;
    return null;
}

/**
 * True when a held booking's guest has not been seated within its hold window,
 * so the table goes back on sale.
 * @param {Object} booking
 * @param {Date} [now=new Date()]
 * @returns {boolean}
 */
export function isHoldExpired(booking, now = new Date()) {
    const hold = getBookingHoldMinutes(booking);
    if (hold === null || !['pending', 'confirmed'].includes(booking?.status)) return false;
    return now.getTime() > new Date(booking.booking_time).getTime() + hold * 60 * 1000;
}

/**
 * Checks if a requested time slot overlaps with an existing booking,
 * honoring Live Seated Protection and terminal status exclusions.
 * 
 * @param {Date} requestStart 
 * @param {Date} requestEnd 
 * @param {Object|string|Date} booking 
 * @param {Object|number} [optionsOrDuration=2]
 * @returns {boolean}
 */
export function isBookingOverlap(requestStart, requestEnd, booking, optionsOrDuration = 2) {
    const options = typeof optionsOrDuration === 'number'
        ? { defaultDurationHours: optionsOrDuration }
        : (optionsOrDuration || {});

    const bObj = (typeof booking === 'object' && booking !== null && !(booking instanceof Date))
        ? booking
        : { booking_time: booking };

    // Terminal statuses never cause overlap
    if (['completed', 'cancelled', 'void', 'no_show'].includes(bObj.status)) {
        return false;
    }

    // Held online booking whose guest never arrived: release the table
    if (isHoldExpired(bObj, options.now || new Date())) {
        return false;
    }

    const bStart = new Date(bObj.booking_time);
    const bEnd = calculateEffectiveBookingEnd(bObj, options);

    // Overlap condition: StartA < EndB && EndA > StartB
    return (requestStart < bEnd) && (requestEnd > bStart);
}

/**
 * Refunds xhaus coins and free drink quota back to member profile when an unpaid
 * online booking or pickup order is cancelled, rejected, or marked no-show.
 * Call it AFTER the status change has been saved. The booking is tagged
 * `[LOYALTY_REFUNDED]` only once the profile write is confirmed to have changed a row,
 * so a blocked or failed write can be retried instead of being marked as done.
 * @param {Object} booking
 * @param {Object} supabaseClient
 * @returns {Promise<boolean>} True if a refund was applied
 */
export async function refundBookingLoyaltyIfNeeded(booking, supabaseClient) {
    if (!booking || !supabaseClient) return false;
    const remark = String(booking.staff_remark || '');
    if (remark.includes('[LOYALTY_REFUNDED]')) return false;

    const userId = booking.user_id;
    if (!userId) return false;

    const note = String(booking.customer_note || '');
    let xhausRedeemed = parseFloat(booking.xhaus_redeemed) || 0;
    if (!xhausRedeemed) {
        const match = note.match(/\[ใช้แต้ม xhaus:\s*(\d+(?:\.\d+)?)\s*เหรียญ/i);
        if (match) xhausRedeemed = parseFloat(match[1]) || 0;
    }

    const isFreeDrinkUsed = Boolean(
        booking.use_free_drink_quota ||
        note.includes('[ใช้สิทธิ์แก้วฟรี 10 แถม 1') ||
        remark.includes('| แก้วฟรี -฿')
    );

    if (xhausRedeemed <= 0 && !isFreeDrinkUsed) return false;

    try {
        const { data: prof } = await supabaseClient
            .from('profiles')
            .select('xhaus_balance, total_redeemed_xhaus, free_drink_quota')
            .eq('id', userId)
            .maybeSingle();

        if (!prof) return false;

        const updates = {};
        if (xhausRedeemed > 0) {
            updates.xhaus_balance = (parseFloat(prof.xhaus_balance) || 0) + xhausRedeemed;
            updates.total_redeemed_xhaus = Math.max(0, (parseFloat(prof.total_redeemed_xhaus) || 0) - xhausRedeemed);
        }
        if (isFreeDrinkUsed) {
            updates.free_drink_quota = (Number(prof.free_drink_quota) || 0) + 1;
        }

        if (Object.keys(updates).length > 0) {
            // RLS denials come back as zero rows with no error, so require the updated row back
            const { data: updatedRows, error: profileErr } = await supabaseClient
                .from('profiles')
                .update(updates)
                .eq('id', userId)
                .select('id');
            if (profileErr || !updatedRows || updatedRows.length === 0) {
                console.warn('[refundBookingLoyaltyIfNeeded] Profile refund not applied:', profileErr?.message || 'no row updated');
                return false;
            }

            const { error: tagErr } = await supabaseClient
                .from('bookings')
                .update({ staff_remark: `${remark} [LOYALTY_REFUNDED]`.trim() })
                .eq('id', booking.id);
            if (tagErr) {
                console.warn('[refundBookingLoyaltyIfNeeded] Refunded but failed to tag booking:', tagErr.message);
            }
            return true;
        }
    } catch (err) {
        console.warn('[refundBookingLoyaltyIfNeeded] Failed to refund loyalty:', err);
    }
    return false;
}

/**
 * Checks if a requested time slot overlaps with an existing booking.
 * Backward-compatible wrapper delegating to isBookingOverlap.
 * 
 * @param {Date} requestStart 
 * @param {Date} requestEnd 
 * @param {string|Date|Object} bookingStart 
 * @param {number} [bookingDurationHours=2] 
 * @returns {boolean}
 */
export const checkOverlap = (requestStart, requestEnd, bookingStart, bookingDurationHours = 2) => {
    return isBookingOverlap(requestStart, requestEnd, bookingStart, { defaultDurationHours: bookingDurationHours });
};
