// Store hours for customer-facing copy that is not driven by app_settings.
// The app_settings values flip at the same moment via the pg_cron job in
// supabase/migrations/20261106120000_store_hours_nov9.sql.
// api/link.js keeps its own copy of this date because it is deployed as a standalone function.
export const HOURS_EFFECTIVE_DATE = '2026-11-08'

const PREVIOUS_HOURS = { open: '11:30', close: '23:30', lastOrder: '22:00' }
const CURRENT_HOURS = { open: '11:00', close: '21:30', lastOrder: '20:45' }

export const BOOKING_SLOTS_FROM_EFFECTIVE_DATE = [
    '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
]

const bangkokDate = (now) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now)

export const getStoreHours = (now = new Date()) => {
    const hours = bangkokDate(now) >= HOURS_EFFECTIVE_DATE ? CURRENT_HOURS : PREVIOUS_HOURS
    return { ...hours, label: `เปิดทุกวัน ${hours.open} - ${hours.close} น. (ปิดรับออเดอร์ ${hours.lastOrder} น.)` }
}

// Bookings made before the change for a date on/after it must already see the new slots.
export const getBookingSlotsForDate = (configuredSlots, dateStr, now = new Date()) => {
    const isBeforeChange = bangkokDate(now) < HOURS_EFFECTIVE_DATE
    return isBeforeChange && dateStr >= HOURS_EFFECTIVE_DATE ? BOOKING_SLOTS_FROM_EFFECTIVE_DATE : configuredSlots
}
