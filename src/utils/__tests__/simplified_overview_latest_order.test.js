import { describe, it, expect } from 'vitest'
import { formatThaiRelativeTime } from '../timeUtils'
import { groupOrderItemsIntoRounds } from '../orderRoundHelper'

describe('Latest Order Visual Awareness & Utilities', () => {
    describe('formatThaiRelativeTime', () => {
        const baseNow = new Date('2026-09-29T19:30:00+07:00').getTime()

        it('returns empty string for falsy input', () => {
            expect(formatThaiRelativeTime(null)).toBe('')
            expect(formatThaiRelativeTime('')).toBe('')
            expect(formatThaiRelativeTime(undefined)).toBe('')
        })

        it('returns "เมื่อสักครู่" for orders within 1 minute', () => {
            const timeJustNow = new Date('2026-09-29T19:29:45+07:00').toISOString()
            expect(formatThaiRelativeTime(timeJustNow, baseNow)).toBe('เมื่อสักครู่')
        })

        it('returns exact minutes for orders under 1 hour', () => {
            const time5MinsAgo = new Date('2026-09-29T19:25:00+07:00').toISOString()
            expect(formatThaiRelativeTime(time5MinsAgo, baseNow)).toBe('5 นาทีที่แล้ว')

            const time35MinsAgo = new Date('2026-09-29T18:55:00+07:00').toISOString()
            expect(formatThaiRelativeTime(time35MinsAgo, baseNow)).toBe('35 นาทีที่แล้ว')
        })

        it('formats hours and remaining minutes appropriately for orders over 1 hour', () => {
            const time75MinsAgo = new Date('2026-09-29T18:15:00+07:00').toISOString()
            expect(formatThaiRelativeTime(time75MinsAgo, baseNow)).toBe('1 ชม. 15 น. ที่แล้ว')

            const timeExact2HrsAgo = new Date('2026-09-29T17:30:00+07:00').toISOString()
            expect(formatThaiRelativeTime(timeExact2HrsAgo, baseNow)).toBe('2 ชม. ที่แล้ว')
        })
    })

    describe('Floor-Wide Latest Order Detection & Sorting', () => {
        const sampleFloor = [
            {
                table: { id: 't1', table_name: 'Table 1' },
                state: { status: 'occupied' },
                latestOrderTimeMs: new Date('2026-09-29T18:00:00+07:00').getTime(),
                latestOrderIso: '2026-09-29T18:00:00+07:00',
                latestOrderTimeStr: '18:00'
            },
            {
                table: { id: 't2', table_name: 'Table 2' },
                state: { status: 'occupied' },
                latestOrderTimeMs: new Date('2026-09-29T19:15:00+07:00').getTime(), // NEWEST
                latestOrderIso: '2026-09-29T19:15:00+07:00',
                latestOrderTimeStr: '19:15'
            },
            {
                table: { id: 't3', table_name: 'Table 3' },
                state: { status: 'occupied' },
                latestOrderTimeMs: new Date('2026-09-29T18:45:00+07:00').getTime(),
                latestOrderIso: '2026-09-29T18:45:00+07:00',
                latestOrderTimeStr: '18:45'
            },
            {
                table: { id: 't4', table_name: 'Table 4' },
                state: { status: 'free' },
                latestOrderTimeMs: 0,
                latestOrderIso: null,
                latestOrderTimeStr: ''
            }
        ]

        it('correctly identifies the single newest order across the floor', () => {
            let maxMs = 0
            sampleFloor.forEach(item => {
                if (item.state.status === 'occupied' && item.latestOrderTimeMs > 0) {
                    if (item.latestOrderTimeMs > maxMs) {
                        maxMs = item.latestOrderTimeMs
                    }
                }
            })

            expect(maxMs).toBe(new Date('2026-09-29T19:15:00+07:00').getTime())

            const beaconTables = sampleFloor.filter(i => i.latestOrderTimeMs === maxMs && i.state.status === 'occupied')
            expect(beaconTables).toHaveLength(1)
            expect(beaconTables[0].table.table_name).toBe('Table 2')
        })

        it('sorts tables descending by order recency when sortBy === "recent"', () => {
            const sorted = sampleFloor.slice().sort((a, b) => {
                const timeA = (a.state.status === 'occupied' ? a.latestOrderTimeMs : 0) || 0
                const timeB = (b.state.status === 'occupied' ? b.latestOrderTimeMs : 0) || 0
                if (timeA !== timeB) return timeB - timeA
                return (a.table.table_name || '').localeCompare(b.table.table_name || '')
            })

            // Slot #1 must be Table 2 (19:15)
            expect(sorted[0].table.table_name).toBe('Table 2')
            // Slot #2 must be Table 3 (18:45)
            expect(sorted[1].table.table_name).toBe('Table 3')
            // Slot #3 must be Table 1 (18:00)
            expect(sorted[2].table.table_name).toBe('Table 1')
            // Slot #4 must be Table 4 (Free)
            expect(sorted[3].table.table_name).toBe('Table 4')
        })
    })

    describe('Order-Level Round and Item Awareness', () => {
        it('isolates newest round and calculates order items accurately', () => {
            const startTime = '2026-09-29T18:00:00+07:00'
            const orderItems = [
                { id: '1', quantity: 1, created_at: '2026-09-29T18:01:00+07:00', menu_items: { name: 'น้ำส้ม' } },
                { id: '2', quantity: 2, created_at: '2026-09-29T18:02:00+07:00', menu_items: { name: 'ข้าวกะเพรา' } },
                { id: '3', quantity: 1, created_at: '2026-09-29T18:45:00+07:00', menu_items: { name: 'กาแฟเย็น' } } // Round 2 (Latest)
            ]

            const info = groupOrderItemsIntoRounds(orderItems, startTime)
            expect(info.totalRounds).toBe(2)
            expect(info.hasAdditionalOrders).toBe(true)
            expect(info.latestRound).toBeDefined()
            expect(info.latestRound.roundNumber).toBe(2)
            expect(info.latestRound.items).toHaveLength(1)
            expect(info.latestRound.items[0].id).toBe('3')
            expect(info.latestOrderTime).toBe('2026-09-29T18:45:00+07:00')
        })
    })
})
