function getShortBookingId(booking) {
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

console.log("1. Full booking with tracking_token:", getShortBookingId({
    id: '75afd293-eae7-4acb-ad62-5c9a7e91ffd2',
    tracking_token: 'cedb82e3-f04b-43a8-aa71-b2654172a2eb'
})); // Should be A2EB

console.log("2. Tracking token with camelCase trackingToken:", getShortBookingId({
    id: '75afd293-eae7-4acb-ad62-5c9a7e91ffd2',
    trackingToken: 'cedb82e3-f04b-43a8-aa71-b2654172a2eb'
})); // Should be A2EB

console.log("3. Short ID already computed:", getShortBookingId({
    short_id: 'A2EB'
})); // Should be A2EB

console.log("4. String token/id:", getShortBookingId('cedb82e3-f04b-43a8-aa71-b2654172a2eb')); // Should be A2EB
console.log("5. Offline local booking:", getShortBookingId({ id: 'local_1723123456789' })); // Should be 6789
