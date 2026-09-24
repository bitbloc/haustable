import { describe, it, expect } from 'vitest'

describe('Financial Cockpit Revamp Logic & Operational Modules Audit', () => {

    it('calculates Target Progress %, Remaining Amount, and Required Hourly Run-Rate accurately', () => {
        const salesToday = 7093
        const dailyTarget = 10000
        const currentHour = 19
        const closingHour = 23
        const currentVelocity = 726

        // Target progress calculation
        const progressPct = dailyTarget > 0 ? Math.min(100, Math.round((salesToday / dailyTarget) * 100)) : 0
        const remaining = Math.max(0, dailyTarget - salesToday)
        const hoursLeft = Math.max(1, closingHour - currentHour) // 23 - 19 = 4 hours
        const requiredPace = Math.round(remaining / hoursLeft) // 2907 / 4 = 727
        const isHit = salesToday >= dailyTarget
        const isOnPace = currentVelocity >= requiredPace || isHit

        expect(progressPct).toBe(71)
        expect(remaining).toBe(2907)
        expect(hoursLeft).toBe(4)
        expect(requiredPace).toBe(727)
        expect(isOnPace).toBe(false) // 726 vs 727 is slightly behind pace, requires tiny push

        // If sales velocity reaches 850 / hr
        const higherVelocity = 850
        const isHigherOnPace = higherVelocity >= requiredPace || isHit
        expect(isHigherOnPace).toBe(true)
    })

    it('classifies items into 4 Menu Engineering Quadrants (Stars, Volume, Niche, Problems)', () => {
        const items = [
            { name: 'ข้าวหน้าเนื้อ', units: 20, price: 180 }, // High units, High price -> STAR
            { name: 'เบียร์สิงห์', units: 35, price: 90 },    // High units, Low price -> VOLUME
            { name: 'เนื้อพิคานย่า', units: 5, price: 320 },  // Low units, High price -> NICHE
            { name: 'ซุปกระดูกหมู', units: 3, price: 60 },   // Low units, Low price -> PROBLEM
        ]

        const avgUnits = items.reduce((s, i) => s + i.units, 0) / items.length // (20+35+5+3)/4 = 15.75
        const avgPrice = items.reduce((s, i) => s + i.price, 0) / items.length // (180+90+320+60)/4 = 162.5

        const classifyItem = (item) => {
            if (item.units >= avgUnits && item.price >= avgPrice) return 'STARS'
            if (item.units >= avgUnits && item.price < avgPrice) return 'VOLUME'
            if (item.units < avgUnits && item.price >= avgPrice) return 'NICHE'
            return 'PROBLEMS'
        }

        expect(classifyItem(items[0])).toBe('STARS')
        expect(classifyItem(items[1])).toBe('VOLUME')
        expect(classifyItem(items[2])).toBe('NICHE')
        expect(classifyItem(items[3])).toBe('PROBLEMS')
    })

    it('accurately computes 2-Tier Operational Contribution and Net Accounting Profit', () => {
        const grossSales = 7093
        const discounts = 150
        const netSales = grossSales - discounts // 6,943
        
        // Percentages
        const foodCostPct = 30.0
        const packagingPct = 2.5
        const platformFeePct = 4.5
        const fixedStoreExpenses = 1580

        const foodCostAmt = Math.round(netSales * (foodCostPct / 100)) // 2,083
        const packagingAmt = Math.round(netSales * (packagingPct / 100)) // 174
        const platformFeeAmt = Math.round(netSales * (platformFeePct / 100)) // 312

        // Tier 1: Operational Contribution
        const operationalContribution = netSales - (foodCostAmt + packagingAmt + platformFeeAmt) // 6943 - (2083 + 174 + 312) = 4,374
        const contributionPct = parseFloat(((operationalContribution / grossSales) * 100).toFixed(1))

        // Tier 2: Accounting Bottom Line
        const netOperatingProfit = operationalContribution - fixedStoreExpenses // 4374 - 1580 = 2,794
        const netProfitMarginPct = parseFloat(((netOperatingProfit / grossSales) * 100).toFixed(1))

        expect(operationalContribution).toBe(4374)
        expect(contributionPct).toBe(61.7)
        expect(netOperatingProfit).toBe(2794)
        expect(netProfitMarginPct).toBe(39.4)
    })

    it('evaluates Smart Anomaly Alerts engine against operational thresholds', () => {
        const detectAnomalies = ({ foodCostPct, targetFoodCost, avgTicketDiffPct, deliveryGPPercent }) => {
            const list = []
            if (foodCostPct > targetFoodCost + 2.0) {
                list.push('FOOD_COST_SPIKE')
            }
            if (avgTicketDiffPct < -8.0) {
                list.push('TICKET_DROP')
            }
            if (deliveryGPPercent > 7.0) {
                list.push('DELIVERY_GP_LEAK')
            }
            return list
        }

        // Test normal operation
        const normalList = detectAnomalies({
            foodCostPct: 30.5,
            targetFoodCost: 30.0,
            avgTicketDiffPct: 2.1,
            deliveryGPPercent: 4.2
        })
        expect(normalList).toHaveLength(0)

        // Test abnormal operation
        const flaggedList = detectAnomalies({
            foodCostPct: 34.2, // +4.2% spike
            targetFoodCost: 30.0,
            avgTicketDiffPct: -11.4, // -11.4% drop
            deliveryGPPercent: 8.5 // 8.5% of total sales in delivery GP
        })
        expect(flaggedList).toContain('FOOD_COST_SPIKE')
        expect(flaggedList).toContain('TICKET_DROP')
        expect(flaggedList).toContain('DELIVERY_GP_LEAK')
    })

    it('resolves correct context comparison date (Same Day Last Week vs Yesterday)', () => {
        const getComparisonDate = (selectedDateStr, mode) => {
            const curD = new Date(selectedDateStr)
            if (mode === 'same_day_last_week') {
                curD.setDate(curD.getDate() - 7)
            } else {
                curD.setDate(curD.getDate() - 1)
            }
            return curD.toISOString().split('T')[0]
        }

        // 2026-09-24 is Thursday
        const baseDate = '2026-09-24'
        const sameDayLastWeek = getComparisonDate(baseDate, 'same_day_last_week')
        const yesterday = getComparisonDate(baseDate, 'yesterday')

        expect(sameDayLastWeek).toBe('2026-09-17') // Exactly previous Thursday
        expect(yesterday).toBe('2026-09-23')       // Wednesday
    })
})
