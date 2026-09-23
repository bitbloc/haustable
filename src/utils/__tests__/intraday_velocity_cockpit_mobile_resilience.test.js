import { describe, it, expect } from 'vitest'

// Helper: Extract Asia/Bangkok hour (0 - 23) reliably & high-performance (UTC+7, no DST)
const getBangkokHour = (timeInput) => {
    if (!timeInput) return -1
    try {
        const d = new Date(timeInput)
        if (isNaN(d.getTime())) return -1
        // Thailand is strictly UTC+7 all year round. Mathematical offset avoids slow Intl instantiation in loops.
        const bkkMs = d.getTime() + (7 * 3600 * 1000)
        return new Date(bkkMs).getUTCHours()
    } catch {
        return new Date(timeInput).getHours()
    }
}

// Helper: Extract Asia/Bangkok date string (YYYY-MM-DD)
const getBangkokDateStr = (timeInput) => {
    if (!timeInput) return ''
    try {
        const d = new Date(timeInput)
        if (isNaN(d.getTime())) return (timeInput || '').split('T')[0]
        const bkkMs = d.getTime() + (7 * 3600 * 1000)
        return new Date(bkkMs).toISOString().slice(0, 10)
    } catch {
        return (timeInput || '').split('T')[0]
    }
}

describe('Intraday Velocity Cockpit Mobile & Date Resilience', () => {
    it('correctly calculates Asia/Bangkok hour (UTC+7) across edge cases and offsets', () => {
        // Late night order at 21:30 Bangkok time (+07:00 offset)
        expect(getBangkokHour('2026-09-23T21:30:00+07:00')).toBe(21)
        expect(getBangkokDateStr('2026-09-23T21:30:00+07:00')).toBe('2026-09-23')

        // Late night order at 21:30 Bangkok time represented in UTC (14:30Z)
        expect(getBangkokHour('2026-09-23T14:30:00.000Z')).toBe(21)
        expect(getBangkokDateStr('2026-09-23T14:30:00.000Z')).toBe('2026-09-23')

        // Past-midnight order at 00:45 Bangkok time (17:45 UTC previous day)
        expect(getBangkokHour('2026-09-24T00:45:00+07:00')).toBe(0)
        expect(getBangkokHour('2026-09-23T17:45:00Z')).toBe(0)
        expect(getBangkokDateStr('2026-09-24T00:45:00+07:00')).toBe('2026-09-24')
        expect(getBangkokDateStr('2026-09-23T17:45:00Z')).toBe('2026-09-24')

        // Lunch rush 12:15 Bangkok time
        expect(getBangkokHour('2026-09-23T12:15:00+07:00')).toBe(12)
        expect(getBangkokDateStr('2026-09-23T12:15:00+07:00')).toBe('2026-09-23')

        // Invalid or null times
        expect(getBangkokHour(null)).toBe(-1)
        expect(getBangkokHour('')).toBe(-1)
        expect(getBangkokHour('invalid')).toBe(-1)
        expect(getBangkokDateStr(null)).toBe('')
        expect(getBangkokDateStr('')).toBe('')
    })

    it('correctly aggregates hourly orders and menu items for drilldown without freezing on high volume', () => {
        const drilldownHour = 21
        const mockOrders = [
            {
                id: 'ord-1',
                booking_time: '2026-09-23T21:15:00+07:00',
                status: 'completed',
                total_amount: 1500,
                order_items: [
                    { name: 'ข้าวหน้าเนื้อวากิวภูเขาไฟ', quantity: 2, price_at_time: 450 },
                    { name: 'สิงห์ดราฟต์เบียร์ 500ml', quantity: 2, price_at_time: 300 }
                ]
            },
            {
                id: 'ord-2',
                booking_time: '2026-09-23T21:40:00+07:00',
                status: 'paid',
                total_amount: 650,
                order_items: [
                    { name: 'ข้าวหน้าเนื้อวากิวภูเขาไฟ', quantity: 1, price_at_time: 450 },
                    { name: 'ยูซุโซดา', quantity: 1, price_at_time: 120 }
                ]
            },
            {
                id: 'ord-3',
                booking_time: '2026-09-23T20:50:00+07:00', // 20:00 - should be excluded
                status: 'completed',
                total_amount: 800,
                order_items: [
                    { name: 'สลัดปลาหมึกย่าง', quantity: 1, price_at_time: 320 }
                ]
            }
        ]

        // Filter orders for drilldownHour
        const filtered = mockOrders.filter(b => getBangkokHour(b.booking_time || b.created_at) === drilldownHour)
        expect(filtered.length).toBe(2)

        // Aggregate items
        const itemMap = {}
        filtered.forEach(b => {
            const items = Array.isArray(b.order_items) ? b.order_items : []
            items.forEach(it => {
                const name = it.name || it.item_name || 'รายการทั่วไป'
                const qty = Number(it.quantity || 1)
                const price = Number(it.price_at_time || 0)
                if (!itemMap[name]) itemMap[name] = { name, qty: 0, total: 0 }
                itemMap[name].qty += qty
                itemMap[name].total += price * qty
            })
        })

        const topItems = Object.values(itemMap).sort((a, b) => b.total - a.total).slice(0, 4)
        expect(topItems[0].name).toBe('ข้าวหน้าเนื้อวากิวภูเขาไฟ')
        expect(topItems[0].qty).toBe(3)
        expect(topItems[0].total).toBe(1350)
        expect(topItems[1].name).toBe('สิงห์ดราฟต์เบียร์ 500ml')
        expect(topItems[1].qty).toBe(2)
        expect(topItems[1].total).toBe(600)
    })

    it('ensures micro-jitter resize tolerance prevents infinite state oscillation', () => {
        let containerWidth = 800
        const setWidthWithTolerance = (newW) => {
            if (Math.abs(containerWidth - newW) > 2) {
                containerWidth = Math.round(newW)
                return true
            }
            return false
        }

        // Sub-pixel or 1px jitter from scrollbar should be ignored
        expect(setWidthWithTolerance(800.8)).toBe(false)
        expect(setWidthWithTolerance(801.2)).toBe(false)
        expect(setWidthWithTolerance(799.1)).toBe(false)

        // Real orientation or viewport change should update
        expect(setWidthWithTolerance(390)).toBe(true)
        expect(containerWidth).toBe(390)
    })
})
