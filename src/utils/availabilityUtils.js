
/**
 * Checks if a requested time slot overlaps with an existing booking.
 * @param {Date} requestStart 
 * @param {Date} requestEnd 
 * @param {string|Date} bookingStart 
 * @param {number} bookingDurationHours 
 * @returns {boolean}
 */
export const checkOverlap = (requestStart, requestEnd, bookingStart, bookingDurationHours = 2) => {
    const bStart = new Date(bookingStart)
    const bEnd = new Date(bStart.getTime() + (bookingDurationHours * 60 * 60 * 1000))
    
    // Overlap condition: StartA < EndB && EndA > StartB
    return (requestStart < bEnd) && (requestEnd > bStart)
}
