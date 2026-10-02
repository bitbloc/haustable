/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · test: Overview Editorial Card */
import { describe, it, expect } from 'vitest'
import { groupOrderItemsIntoRounds } from '../orderRoundHelper'

describe('Overview Editorial Card Logic (Dieter Rams + Thai Modern)', () => {
    describe('Urgency State Determination', () => {
        const getUrgency = (latestOrderTimeMs, isOccupied, currentTimeMs) => {
            if (!isOccupied || !latestOrderTimeMs) return 'calm'
            const diffMins = (currentTimeMs - latestOrderTimeMs) / 60000
            if (diffMins <= 10) return 'urgent'
            if (diffMins <= 15) return 'cooling'
            return 'calm'
        }

        const now = new Date('2026-10-02T21:46:00+07:00').getTime()

        it('returns "urgent" when order is placed within 10 minutes', () => {
            // Ordered 7 mins ago (21:39)
            const order7MinsAgo = new Date('2026-10-02T21:39:00+07:00').getTime()
            expect(getUrgency(order7MinsAgo, true, now)).toBe('urgent')

            // Ordered exactly 10 mins ago (21:36)
            const order10MinsAgo = new Date('2026-10-02T21:36:00+07:00').getTime()
            expect(getUrgency(order10MinsAgo, true, now)).toBe('urgent')
        })

        it('returns "cooling" when order is placed between 10 and 15 minutes ago', () => {
            // Ordered 12 mins ago (21:34)
            const order12MinsAgo = new Date('2026-10-02T21:34:00+07:00').getTime()
            expect(getUrgency(order12MinsAgo, true, now)).toBe('cooling')

            // Ordered 15 mins ago (21:31)
            const order15MinsAgo = new Date('2026-10-02T21:31:00+07:00').getTime()
            expect(getUrgency(order15MinsAgo, true, now)).toBe('cooling')
        })

        it('returns "calm" when order is older than 15 minutes or table is unoccupied', () => {
            const order7MinsAgo = new Date('2026-10-02T21:39:00+07:00').getTime()
            // Ordered 20 mins ago (21:26)
            const order20MinsAgo = new Date('2026-10-02T21:26:00+07:00').getTime()
            expect(getUrgency(order20MinsAgo, true, now)).toBe('calm')

            // Ordered 1 hour ago
            const order1HrAgo = new Date('2026-10-02T20:46:00+07:00').getTime()
            expect(getUrgency(order1HrAgo, true, now)).toBe('calm')

            // Unoccupied table
            expect(getUrgency(order7MinsAgo, false, now)).toBe('calm')
            expect(getUrgency(0, true, now)).toBe('calm')
        })
    })

    describe('Micro-Timeline Descending Order Stream', () => {
        it('orders rounds so newest is first and older rounds (> 2) are identified for collapsing', () => {
            const tableStart = '2026-10-02T20:15:00+07:00'
            const orderItems = [
                // Round 1 (20:15)
                { id: '1', quantity: 1, created_at: '2026-10-02T20:15:10+07:00', menu_items: { name: 'แกงส้ม' }, price_at_time: 150 },
                { id: '2', quantity: 1, created_at: '2026-10-02T20:15:15+07:00', menu_items: { name: 'หมูสามชั้นทอด' }, price_at_time: 120 },
                { id: '3', quantity: 1, created_at: '2026-10-02T20:15:20+07:00', menu_items: { name: 'ต้มแซ่บ' }, price_at_time: 140 },
                // Round 2 (21:28)
                { id: '4', quantity: 1, created_at: '2026-10-02T21:28:00+07:00', menu_items: { name: 'ทาทากิ (ยำเนื้อญี่ปุ่น)' }, price_at_time: 199 },
                // Round 3 (21:46)
                { id: '5', quantity: 1, created_at: '2026-10-02T21:46:00+07:00', menu_items: { name: 'ข้าวสวย' }, price_at_time: 15 }
            ]

            const roundsInfo = groupOrderItemsIntoRounds(orderItems, tableStart)
            expect(roundsInfo.totalRounds).toBe(3)

            // Micro-timeline reverses rounds: [Round 3, Round 2, Round 1]
            const reversedRounds = [...roundsInfo.rounds].reverse()
            expect(reversedRounds[0].roundNumber).toBe(3)
            expect(reversedRounds[0].items[0].menu_items.name).toBe('ข้าวสวย')

            expect(reversedRounds[1].roundNumber).toBe(2)
            expect(reversedRounds[1].items[0].menu_items.name).toBe('ทาทากิ (ยำเนื้อญี่ปุ่น)')

            expect(reversedRounds[2].roundNumber).toBe(1)
            expect(reversedRounds[2].items).toHaveLength(3)

            // Index 0 and 1 are primary rounds; Index 2 and above are older collapsible rounds
            const olderRounds = reversedRounds.slice(2)
            expect(olderRounds).toHaveLength(1)
            const totalOlderItems = olderRounds.reduce((sum, r) => sum + r.items.length, 0)
            expect(totalOlderItems).toBe(3)
        })
    })
})
