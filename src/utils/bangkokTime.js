// Shop-time helpers. The shop runs on Asia/Bangkok (UTC+7, no DST) whatever the
// customer's phone is set to, so every "is it open / which slot" check goes through here.
import { getStoreHours } from './storeHours'

const BKK_OFFSET_MIN = 7 * 60

/** 'HH:MM' -> minutes after midnight (NaN-safe: bad input returns null). */
export const toMinutes = (hhmm) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || '').trim())
    if (!m) return null
    return Number(m[1]) * 60 + Number(m[2])
}

const pad = (n) => String(n).padStart(2, '0')
export const fromMinutes = (mins) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`

/** Bangkok wall clock for an instant: { dateStr: 'YYYY-MM-DD', minutes } */
export const bangkokNow = (now = new Date()) => {
    const shifted = new Date(now.getTime() + BKK_OFFSET_MIN * 60 * 1000)
    return {
        dateStr: shifted.toISOString().slice(0, 10),
        minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes()
    }
}

/** 'YYYY-MM-DD' + n days (calendar arithmetic, no time zone involved). */
export const addDays = (dateStr, n) => {
    const d = new Date(`${dateStr}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + n)
    return d.toISOString().slice(0, 10)
}

/**
 * Last time food can be ordered for the day: the kitchen close / last-order setting
 * (qr_kitchen_close_time), never later than closing time. Falls back to storeHours (20:45).
 */
export const getLastOrderTime = ({ kitchenCloseTime, closingTime } = {}, now = new Date()) => {
    const fallback = getStoreHours(now).lastOrder
    const candidates = [kitchenCloseTime, fallback]
        .map(toMinutes)
        .filter((m) => m !== null)
    let last = candidates.length ? candidates[0] : toMinutes('20:45')
    const close = toMinutes(closingTime)
    if (close !== null && close < last) last = close
    return fromMinutes(last)
}

/**
 * Pickup time slots for 'today' or 'tomorrow' (Bangkok), every `stepMinutes`,
 * from opening time up to and including the last-order time.
 * Today also drops slots sooner than now + minAdvanceHours.
 */
export const getPickupSlots = ({
    day = 'today',
    openingTime = '11:00',
    closingTime,
    kitchenCloseTime,
    minAdvanceHours = 1,
    stepMinutes = 15,
    now = new Date()
} = {}) => {
    const open = toMinutes(openingTime) ?? toMinutes('11:00')
    const last = toMinutes(getLastOrderTime({ kitchenCloseTime, closingTime }, now))
    const slots = []
    const earliest = day === 'today'
        ? bangkokNow(now).minutes + Math.round(Number(minAdvanceHours || 0) * 60)
        : -1
    for (let m = open; m <= last; m += stepMinutes) {
        if (m > earliest) slots.push(fromMinutes(m))
    }
    return slots
}

/** Pickup date string (Bangkok) for 'today' | 'tomorrow'. */
export const getPickupDateStr = (day, now = new Date()) => {
    const today = bangkokNow(now).dateStr
    return day === 'tomorrow' ? addDays(today, 1) : today
}

/** True when the Bangkok clock is in [from, until). */
export const isWithinBangkokHours = (from, until, now = new Date()) => {
    const start = toMinutes(from) ?? 0
    const end = toMinutes(until) ?? 24 * 60
    const { minutes } = bangkokNow(now)
    return minutes >= start && minutes < end
}
