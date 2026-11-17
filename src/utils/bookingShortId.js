// 4-character booking reference shown to customers and printed on slips.
// Kept apart from printerHelper so customer pages do not download the printer / shift code.
export function getShortBookingId(booking) {
    if (!booking) return '0000';
    if (typeof booking === 'string') {
        const raw = booking.trim();
        if (raw.startsWith('local')) {
            const digits = raw.replace(/[^0-9]/g, '');
            return digits.length >= 4 ? digits.slice(-4) : (digits || '0000');
        }
        const clean = raw.replace(/[^a-zA-Z0-9]/g, '');
        return clean.length >= 4 ? clean.slice(-4).toUpperCase() : (clean.toUpperCase() || '0000');
    }
    if (booking.short_id) {
        return String(booking.short_id).toUpperCase();
    }
    const token = booking.tracking_token || booking.trackingToken;
    if (token) {
        return String(token).slice(-4).toUpperCase();
    }
    const rawId = String(booking.id || booking.booking_id || booking.order_id || '');
    if (rawId.startsWith('local')) {
        const digits = rawId.replace(/[^0-9]/g, '');
        return digits.length >= 4 ? digits.slice(-4) : (digits || '0000');
    }
    const cleanUuid = rawId.replace(/[^a-zA-Z0-9]/g, '');
    return cleanUuid ? cleanUuid.slice(-4).toUpperCase() : '0000';
}
