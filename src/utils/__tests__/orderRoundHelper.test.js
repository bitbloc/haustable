import { describe, it, expect } from 'vitest'
import { groupOrderItemsIntoRounds } from '../orderRoundHelper'

describe('orderRoundHelper · groupOrderItemsIntoRounds', () => {
    it('should return empty summary when orderItems is empty or null', () => {
        const res = groupOrderItemsIntoRounds([])
        expect(res.totalRounds).toBe(0)
        expect(res.hasAdditionalOrders).toBe(false)
        expect(res.rounds).toEqual([])
        expect(res.totalBillAmount).toBe(0)

        const resNull = groupOrderItemsIntoRounds(null)
        expect(resNull.totalRounds).toBe(0)
        expect(resNull.hasAdditionalOrders).toBe(false)
    })

    it('should cluster items into a single round when all created at the same time', () => {
        const tableStart = '2026-09-25T11:49:00+07:00'
        const items = [
            { id: '1', custom_name: 'แกงส้มปลาสำลี', quantity: 1, price_at_time: 179, created_at: '2026-09-25T11:49:10+07:00' },
            { id: '2', custom_name: 'คั่วกลิ้งผักแนม', quantity: 1, price_at_time: 169, created_at: '2026-09-25T11:49:12+07:00' },
            { id: '3', custom_name: 'ใบเหลียงผัดไข่ในบ้าน', quantity: 1, price_at_time: 139, created_at: '2026-09-25T11:49:15+07:00' }
        ]

        const res = groupOrderItemsIntoRounds(items, tableStart)
        expect(res.totalRounds).toBe(1)
        expect(res.hasAdditionalOrders).toBe(false)
        expect(res.additionalRoundsCount).toBe(0)
        expect(res.rounds[0].roundNumber).toBe(1)
        expect(res.rounds[0].isInitial).toBe(true)
        expect(res.rounds[0].isAdditional).toBe(false)
        expect(res.rounds[0].items.length).toBe(3)
        expect(res.rounds[0].totalAmount).toBe(487)
        expect(res.totalBillAmount).toBe(487)
    })

    it('should detect additional order round when items are ordered 26 minutes later', () => {
        const tableStart = '2026-09-25T11:49:00+07:00'
        const items = [
            // Round 1 (11:49)
            { id: '1', custom_name: 'แกงส้มปลาสำลี', quantity: 1, price_at_time: 179, created_at: '2026-09-25T11:49:10+07:00' },
            { id: '2', custom_name: 'คั่วกลิ้งผักแนม', quantity: 1, price_at_time: 169, created_at: '2026-09-25T11:49:12+07:00' },
            { id: '3', custom_name: 'ใบเหลียงผัดไข่ในบ้าน', quantity: 1, price_at_time: 139, created_at: '2026-09-25T11:49:15+07:00' },
            // Round 2 - สั่งเพิ่ม (12:15)
            { id: '4', custom_name: 'ข้าวสวย', quantity: 2, price_at_time: 15, created_at: '2026-09-25T12:15:30+07:00' },
            { id: '5', custom_name: 'น้ำเปล่าสิงห์ 600 มล', quantity: 1, price_at_time: 20, created_at: '2026-09-25T12:15:35+07:00' }
        ]

        const res = groupOrderItemsIntoRounds(items, tableStart)
        expect(res.totalRounds).toBe(2)
        expect(res.hasAdditionalOrders).toBe(true)
        expect(res.additionalRoundsCount).toBe(1)
        
        // Round 1 assertions
        const r1 = res.rounds[0]
        expect(r1.roundNumber).toBe(1)
        expect(r1.isInitial).toBe(true)
        expect(r1.isAdditional).toBe(false)
        expect(r1.items.length).toBe(3)
        expect(r1.totalAmount).toBe(487)

        // Round 2 (สั่งเพิ่ม) assertions
        const r2 = res.rounds[1]
        expect(r2.roundNumber).toBe(2)
        expect(r2.isInitial).toBe(false)
        expect(r2.isAdditional).toBe(true)
        expect(r2.items.length).toBe(2)
        expect(r2.totalAmount).toBe(50) // (2 * 15) + (1 * 20)
        expect(r2.totalQuantity).toBe(3)
        expect(r2.elapsedFromStartMinutes).toBe(26) // 12:15 vs 11:49 is 26 minutes

        expect(res.totalBillAmount).toBe(537)
        expect(res.latestRound).toBe(r2)
    })

    it('should handle unordered items and sort them properly into rounds', () => {
        const tableStart = '2026-09-25T11:49:00+07:00'
        const items = [
            // Ordered later, but appears earlier in array
            { id: '4', custom_name: 'ข้าวสวย', quantity: 1, price_at_time: 15, created_at: '2026-09-25T12:15:00+07:00' },
            // Initial items
            { id: '1', custom_name: 'แกงส้มปลาสำลี', quantity: 1, price_at_time: 179, created_at: '2026-09-25T11:49:00+07:00' }
        ]

        const res = groupOrderItemsIntoRounds(items, tableStart)
        expect(res.totalRounds).toBe(2)
        expect(res.rounds[0].items[0].custom_name).toBe('แกงส้มปลาสำลี')
        expect(res.rounds[1].items[0].custom_name).toBe('ข้าวสวย')
        expect(res.rounds[1].isAdditional).toBe(true)
    })
})
