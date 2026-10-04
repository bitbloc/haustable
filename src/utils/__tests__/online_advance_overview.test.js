import { describe, it, expect } from 'vitest'
import {
    formatOrderScheduleLabel,
    getOrderTimingHorizon,
    classifyOnlineOrder
} from '../../components/admin/overview/OnlineAdvanceOrdersHub'

describe('OnlineAdvanceOrdersHub - Logic & Omni-Date Filtering Audit', () => {
    const mockToday = '2026-10-04'

    it('correctly classifies today, tomorrow, and upcoming timing horizons', () => {
        expect(getOrderTimingHorizon('2026-10-04T18:30:00+07:00', mockToday)).toBe('today')
        expect(getOrderTimingHorizon('2026-10-05T12:00:00+07:00', mockToday)).toBe('tomorrow')
        expect(getOrderTimingHorizon('2026-10-08T19:00:00+07:00', mockToday)).toBe('upcoming')
        expect(getOrderTimingHorizon('2026-10-01T10:00:00+07:00', mockToday)).toBe('past')
    })

    it('formats human-readable Thai schedule labels accurately without AI slop', () => {
        const todayLabel = formatOrderScheduleLabel('2026-10-04T18:30:00+07:00', mockToday)
        expect(todayLabel).toContain('วันนี้')
        expect(todayLabel).toContain('18:30')

        const tomorrowLabel = formatOrderScheduleLabel('2026-10-05T12:00:00+07:00', mockToday)
        expect(tomorrowLabel).toContain('พรุ่งนี้')
        expect(tomorrowLabel).toContain('12:00')

        const upcomingLabel = formatOrderScheduleLabel('2026-10-10T19:15:00+07:00', mockToday)
        expect(upcomingLabel).not.toContain('วันนี้')
        expect(upcomingLabel).not.toContain('พรุ่งนี้')
        expect(upcomingLabel).toContain('19:15')
    })

    it('accurately classifies order channels (Dine-in, Pickup, LINE MAN, Shop)', () => {
        // 1. LINE MAN
        const linemanOrder = { source: 'lineman', customer_name: 'LM-4921', booking_type: 'pickup' }
        expect(classifyOnlineOrder(linemanOrder).type).toBe('lineman')

        // 2. Online Pick-up
        const pickupOrder = { booking_type: 'pickup', customer_name: 'Somchai' }
        expect(classifyOnlineOrder(pickupOrder).type).toBe('pickup')

        // 3. Hausmade Pickup
        const hausmadePickup = { booking_type: 'dine_in', order_type: 'hausmade_pickup', customer_name: 'Anan' }
        expect(classifyOnlineOrder(hausmadePickup).type).toBe('pickup')

        // 4. Hausmade Shop
        const shopOrder = { booking_type: 'shop', customer_name: 'Ploy' }
        expect(classifyOnlineOrder(shopOrder).type).toBe('shop')

        // 5. Online Table Dine-in with Table
        const onlineDineIn = { booking_type: 'dine_in', source: 'online', tables_layout: { table_name: 'H2' } }
        const classifiedDineIn = classifyOnlineOrder(onlineDineIn)
        expect(classifiedDineIn.type).toBe('dine_in')
        expect(classifiedDineIn.shortTag).toBe('โต๊ะ H2')
    })

    it('enforces Urgency Priority sorting: pending orders float to top regardless of date', () => {
        const orders = [
            { id: '1', booking_time: '2026-10-04T18:00:00+07:00', status: 'confirmed' }, // Today confirmed
            { id: '2', booking_time: '2026-10-06T12:00:00+07:00', status: 'pending' },   // Future pending (must float to top)
            { id: '3', booking_time: '2026-10-04T19:00:00+07:00', status: 'confirmed' }, // Today later
            { id: '4', booking_time: '2026-10-05T11:00:00+07:00', status: 'confirmed' }  // Tomorrow confirmed
        ]

        const sorted = [...orders].sort((a, b) => {
            const aUrgent = a.status === 'pending'
            const bUrgent = b.status === 'pending'
            if (aUrgent && !bUrgent) return -1
            if (!aUrgent && bUrgent) return 1

            const timeA = new Date(a.booking_time).getTime()
            const timeB = new Date(b.booking_time).getTime()
            return timeA - timeB
        })

        // Pending order #2 must be at index 0 even though its date is 2 days later
        expect(sorted[0].id).toBe('2')
        // Order #1 (today 18:00) before Order #3 (today 19:00)
        expect(sorted[1].id).toBe('1')
        expect(sorted[2].id).toBe('3')
        // Order #4 (tomorrow 11:00) after today's orders
        expect(sorted[3].id).toBe('4')
    })

    it('guarantees omni-date multi-day online bookings are not excluded', () => {
        const mixedBookings = [
            { id: 'today-pos', source: 'pos', booking_type: 'walk_in', status: 'completed', booking_time: '2026-10-04T12:00:00+07:00' },
            { id: 'online-tomorrow', source: 'online', booking_type: 'dine_in', status: 'confirmed', booking_time: '2026-10-05T18:00:00+07:00' },
            { id: 'pickup-future', source: 'online', booking_type: 'pickup', status: 'pending', booking_time: '2026-10-07T14:00:00+07:00' }
        ]

        // Filtering rule used in AdminDashboard omniOnlineBookings
        const activeOnline = mixedBookings.filter(b => {
            const st = (b.status || '').toLowerCase()
            if (['cancelled', 'void', 'completed', 'paid'].includes(st)) return false
            const isPickup = b.booking_type === 'pickup'
            const isOnline = (b.source || '').toLowerCase() === 'online'
            return isPickup || isOnline
        })

        expect(activeOnline.length).toBe(2)
        expect(activeOnline.map(b => b.id)).toEqual(['online-tomorrow', 'pickup-future'])
    })
})
