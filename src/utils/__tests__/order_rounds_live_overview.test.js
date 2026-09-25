import { describe, it, expect } from 'vitest'
import { groupOrderItemsIntoRounds } from '../orderRoundHelper'

describe('SimplifiedLiveOverview Order Rounds Logic', () => {
    it('accurately groups multi-round orders like Table H4 screenshot', () => {
        const tableStart = '2026-09-25T11:49:00+07:00'
        
        // Exact 5 items from user screenshot, simulating 2 separate ordering times:
        // Round 1: 11:49 (Main dishes)
        // Round 2: 12:15 (Rice and water added later)
        const orderItems = [
            { id: 'item-1', custom_name: 'แกงส้มปลาสำลี', quantity: 1, price_at_time: 179, created_at: '2026-09-25T11:49:10+07:00' },
            { id: 'item-2', custom_name: 'คั่วกลิ้งผักแนม', quantity: 1, price_at_time: 169, created_at: '2026-09-25T11:49:12+07:00' },
            { id: 'item-3', custom_name: 'ใบเหลียงผัดไข่ในบ้าน', quantity: 1, price_at_time: 139, created_at: '2026-09-25T11:49:15+07:00' },
            { id: 'item-4', custom_name: 'ข้าวสวย', quantity: 2, price_at_time: 15, created_at: '2026-09-25T12:15:30+07:00' },
            { id: 'item-5', custom_name: 'น้ำเปล่าสิงห์ 600 มล', quantity: 1, price_at_time: 20, created_at: '2026-09-25T12:15:35+07:00' }
        ]

        const roundsInfo = groupOrderItemsIntoRounds(orderItems, tableStart)

        expect(roundsInfo.totalRounds).toBe(2)
        expect(roundsInfo.hasAdditionalOrders).toBe(true)
        expect(roundsInfo.additionalRoundsCount).toBe(1)
        expect(roundsInfo.totalBillAmount).toBe(537)
        expect(roundsInfo.totalItemsCount).toBe(5)

        // Round 1 (Initial Order at 11:49)
        const round1 = roundsInfo.rounds[0]
        expect(round1.roundNumber).toBe(1)
        expect(round1.isInitial).toBe(true)
        expect(round1.isAdditional).toBe(false)
        expect(round1.items.length).toBe(3)
        expect(round1.totalAmount).toBe(487)
        expect(round1.totalQuantity).toBe(3)

        // Round 2 (Additional Order at 12:15)
        const round2 = roundsInfo.rounds[1]
        expect(round2.roundNumber).toBe(2)
        expect(round2.isInitial).toBe(false)
        expect(round2.isAdditional).toBe(true)
        expect(round2.items.length).toBe(2)
        expect(round2.totalAmount).toBe(50)
        expect(round2.totalQuantity).toBe(3)
        expect(round2.elapsedFromStartMinutes).toBe(26)
        expect(roundsInfo.latestOrderTimeStr).toBe('12:15')
    })
})
