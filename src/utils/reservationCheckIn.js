/**
 * Guards for checking in (seating) an advance table reservation on the POS.
 *
 * Incident 2026-11-17: an 18:00 online reservation on H4 was checked in at 11:04 while a
 * walk-in was already seated there. The pre-order printed to the kitchen 7 hours early and
 * H4 ended up with two seated bills, so the POS showed the reservation's bill on the walk-in table.
 *
 * Rules:
 *  1. Checking in more than EARLY_CHECKIN_WARN_MINUTES before the booked time needs an explicit confirm.
 *  2. A reservation can never be seated on a table that already has an active dining session.
 */
import { supabase } from '../lib/supabaseClient';
import { isOnline, posCache } from './offlineHelper';
import { isTableSessionActive } from './tableTransferHelper';

export const EARLY_CHECKIN_WARN_MINUTES = 60;

/** Minutes from `now` until the booked time (negative once the time has passed). */
export function getMinutesUntilBooking(booking, now = new Date()) {
    if (!booking?.booking_time) return 0;
    const t = new Date(booking.booking_time).getTime();
    if (!Number.isFinite(t)) return 0;
    return Math.round((t - now.getTime()) / 60000);
}

function formatWait(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} นาที`;
    return m === 0 ? `${h} ชม.` : `${h} ชม. ${m} นาที`;
}

/**
 * Confirm text when the check-in is early, or null when it is within the normal window.
 */
export function buildEarlyCheckInWarning(booking, now = new Date()) {
    const mins = getMinutesUntilBooking(booking, now);
    if (mins <= EARLY_CHECKIN_WARN_MINUTES) return null;
    const time = new Date(booking.booking_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const name = booking.pickup_contact_name || booking.customer_name || booking.profiles?.display_name || 'ลูกค้า';
    const hasPreorder = Array.isArray(booking.order_items) && booking.order_items.length > 0;
    const lines = [`คิวจองคุณ${name} นัดเวลา ${time} น. (อีก ${formatWait(mins)})`, 'ยังไม่ถึงเวลาจอง'];
    if (hasPreorder) lines.push('ถ้าเช็คอินตอนนี้ อาหารที่สั่งล่วงหน้าจะพิมพ์เข้าครัวทันที');
    lines.push('', 'ลูกค้าคนนี้มาถึงร้านแล้วจริงหรือไม่?', '(ถ้าเป็นลูกค้า Walk-in ให้กดยกเลิก แล้วเปิดโต๊ะ Walk-in แทน)');
    return lines.join('\n');
}

/**
 * Returns another active dining session already on the reservation's table, if any.
 * Checks the live database when online, the POS cache otherwise.
 */
export async function findOccupyingSession(reservation, tableId = reservation?.table_id, now = new Date()) {
    if (!tableId) return null;
    const isOther = (b) => b && b.id !== reservation?.id && String(b.table_id) === String(tableId) && isTableSessionActive(b, null, null, now);

    if (isOnline()) {
        try {
            const { data, error } = await supabase
                .from('bookings')
                .select('id, table_id, status, booking_time, booking_type, source, staff_remark, created_at, order_items(id)')
                .eq('table_id', tableId)
                .in('status', ['pending', 'confirmed', 'seated', 'ready']);
            if (!error && Array.isArray(data)) {
                return data.find(isOther) || null;
            }
        } catch (e) {
            console.warn('[reservationCheckIn] live occupancy check failed, using cache', e);
        }
    }
    return (posCache.getBookings() || []).find(isOther) || null;
}

/**
 * Runs both guards. Returns true when the check-in may proceed.
 * @param {Object} reservation
 * @param {Object} [opts]
 * @param {string} [opts.tableName]
 * @param {(msg: string) => void} [opts.onBlocked] - shows the blocking reason (toast)
 * @param {(msg: string) => boolean} [opts.confirm] - asks the early-check-in question
 */
export async function guardReservationCheckIn(reservation, { tableName = '', tableId, onBlocked, confirm } = {}) {
    if (!reservation) return false;
    const ask = confirm || ((msg) => (typeof window !== 'undefined' ? window.confirm(msg) : false));

    const occupying = await findOccupyingSession(reservation, tableId ?? reservation.table_id);
    if (occupying) {
        onBlocked?.(`${tableName ? `โต๊ะ ${tableName}` : 'โต๊ะนี้'} มีลูกค้านั่งอยู่ ย้ายคิวจองไปโต๊ะที่ว่างก่อน แล้วจึงเช็คอิน`);
        return false;
    }

    const warning = buildEarlyCheckInWarning(reservation);
    if (warning && !ask(warning)) return false;
    return true;
}
