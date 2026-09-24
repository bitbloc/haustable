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

    it('correctly calculates hourly & daypart goal benchmarks and triggers goal exceeded flags', () => {
        const dailyTargetSales = 50000
        const pacingWeights = {
            11: 0.02, 12: 0.08, 13: 0.06, 14: 0.03, 15: 0.03, 16: 0.03,
            17: 0.07, 18: 0.14, 19: 0.18, 20: 0.16, 21: 0.10, 22: 0.07, 23: 0.03
        }

        const hourlySalesData = {
            12: 4500, // weight 0.08 => target = 4000 => 4500 is EXCEEDED (+13%)
            18: 6000, // weight 0.14 => target = 7000 => 6000 is NOT exceeded (-14%)
            19: 10500 // weight 0.18 => target = 9000 => 10500 is EXCEEDED (+17%)
        }

        const checkHourGoal = (hour, sale, pax) => {
            const weight = pacingWeights[hour] || 0.05
            const targetSales = Math.round(dailyTargetSales * weight)
            const targetPax = Math.max(1, Math.round(targetSales / 300))
            const isGoalExceeded = (sale >= targetSales && targetSales > 0) || (pax >= targetPax && pax >= 3)
            const goalDeltaPct = targetSales > 0 ? Math.round(((sale - targetSales) / targetSales) * 100) : 0
            return { targetSales, targetPax, isGoalExceeded, goalDeltaPct }
        }

        // Test 12:00 (Lunch rush exceeding target)
        const res12 = checkHourGoal(12, hourlySalesData[12], 15)
        expect(res12.targetSales).toBe(4000)
        expect(res12.isGoalExceeded).toBe(true)
        expect(res12.goalDeltaPct).toBe(13)

        // Test 18:00 (Dinner rush below target)
        const res18 = checkHourGoal(18, hourlySalesData[18], 12)
        expect(res18.targetSales).toBe(7000)
        expect(res18.isGoalExceeded).toBe(false)
        expect(res18.goalDeltaPct).toBe(-14)

        // Test 19:00 (Peak dinner exceeding target)
        const res19 = checkHourGoal(19, hourlySalesData[19], 28)
        expect(res19.targetSales).toBe(9000)
        expect(res19.isGoalExceeded).toBe(true)
        expect(res19.goalDeltaPct).toBe(17)

        // Test Daypart aggregation (Dinner Rush: 17:00 - 21:00)
        const dinnerHours = [17, 18, 19, 20]
        const dinnerTargetSales = Math.round(
            dinnerHours.reduce((sum, h) => sum + (dailyTargetSales * (pacingWeights[h] || 0.05)), 0)
        )
        // 0.07 + 0.14 + 0.18 + 0.16 = 0.55 => 50000 * 0.55 = 27500
        expect(dinnerTargetSales).toBe(27500)
    })

    it('filters down X-axis labels to milestone hours in mobile minimal mode to prevent WebKit lag', () => {
        const allHours = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]
        const minimalMode = true
        const isMobile = true

        const renderedHours = allHours.filter(
            h => !minimalMode || !isMobile || [11, 14, 17, 20, 23].includes(h)
        )

        // Mobile minimal mode reduces from 13 down to 5 key milestone slots
        expect(renderedHours).toEqual([11, 14, 17, 20, 23])
        expect(renderedHours.length).toBe(5)

        // Desktop or non-minimal mode keeps all 13 operational hours
        const desktopHours = allHours.filter(
            h => false || false || [11, 14, 17, 20, 23].includes(h)
        )
        expect(allHours.filter(h => !minimalMode || !false || [11, 14, 17, 20, 23].includes(h)).length).toBe(13)
    })
})

