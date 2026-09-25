
/**
 * availabilityUtils.js
 * Core availability and overlap calculations for online reservations and POS walk-in seating.
 * Implements Option 1: Smart Dynamic Turn + Live Seated Dining Protection.
 */

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

    const bStart = new Date(bObj.booking_time);
    const bEnd = calculateEffectiveBookingEnd(bObj, options);

    // Overlap condition: StartA < EndB && EndA > StartB
    return (requestStart < bEnd) && (requestEnd > bStart);
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

