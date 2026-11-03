import { describe, it, expect } from 'vitest'
import { getBookingPaymentBreakdown, fetchShiftBookings } from '../shiftHelper'
import { extractCarryOverTags, getBookingSplitRounds, appendSplitRoundToRemark } from '../splitPaymentHelper'

const ROUND = '{"round":1,"amount":513,"method":"qr","mode":"CUSTOM","percent":null,"payer":null,"time":"2026-11-03T09:37:56.180Z","splitBookingId":null}'

// The 3 Nov bill: ฿1,080, round 1 QR ฿513, rest paid in cash at checkout (received 1000, change 433)
const realBill = {
    status: 'completed', booking_type: 'walk_in', source: 'pos', total_amount: 1080, deposit_amount: 0,
    staff_remark: `Paid by CASH [CASH: RECV=1000, CHANGE=433] [SPLIT_ROUNDS: [${ROUND}] [SPLIT: CASH=0, QR=513, CREDIT=0]`
}

describe('split bill remainder', () => {
    it('counts the cash paid at final checkout on top of the QR split round', () => {
        const b = getBookingPaymentBreakdown(realBill)
        expect(b.qr).toBe(513)
        expect(b.cash).toBe(567)
        expect(b.isSplit).toBe(true)
    })

    it('works the same when the SPLIT_ROUNDS tag is complete', () => {
        const b = getBookingPaymentBreakdown({ ...realBill, staff_remark: `Paid by CASH [SPLIT_ROUNDS: [${ROUND}]]` })
        expect([b.cash, b.qr]).toEqual([567, 513])
    })

    it('sends the remainder to the final method when it is not cash', () => {
        const b = getBookingPaymentBreakdown({ ...realBill, staff_remark: `Paid by CREDIT [SPLIT: CASH=0, QR=513, CREDIT=0]` })
        expect([b.cash, b.qr, b.credit]).toEqual([0, 513, 567])
    })

    it('adds nothing when the rounds already cover the bill', () => {
        const b = getBookingPaymentBreakdown({ ...realBill, total_amount: 513 })
        expect([b.cash, b.qr]).toEqual([0, 513])
        expect(b.methodLabel).toBe('QR Transfer')
    })

    it('still reads rounds from a remark whose closing bracket was cut off', () => {
        expect(getBookingSplitRounds(realBill)).toHaveLength(1)
    })
})

describe('checkout carry-over tags', () => {
    it('keeps the SPLIT_ROUNDS tag whole', () => {
        const before = appendSplitRoundToRemark('[MOVED: T2->T3]', { amount: 513, method: 'qr' })
        const carried = extractCarryOverTags(before)
        expect(carried).toMatch(/\[SPLIT_ROUNDS: \[\{.*\}\]\]/)
        expect(carried).toContain('[SPLIT: CASH=0, QR=513, CREDIT=0]')
        expect(carried).toContain('[MOVED: T2->T3]')
        expect(getBookingSplitRounds({ staff_remark: `Paid by CASH ${carried}` })).toHaveLength(1)
    })

    it('repairs a remark that already lost its closing bracket', () => {
        expect(extractCarryOverTags(realBill.staff_remark)).toContain(`[SPLIT_ROUNDS: [${ROUND}]]`)
    })
})

describe('fetchShiftBookings', () => {
    it('only lets recently opened bills in through the updated_at window', async () => {
        const calls = []
        const query = () => {
            const q = { filters: [] }
            const chain = new Proxy(q, {
                get(target, prop) {
                    if (prop === 'then') return (res) => res({ data: [], error: null })
                    return (...args) => { target.filters.push([prop, ...args]); return chain }
                }
            })
            calls.push(q)
            return chain
        }
        const client = { from: () => query() }
        await fetchShiftBookings(client, { opened_at: '2026-11-03T02:51:03.131Z', closed_at: '2026-11-03T10:10:15.064Z' }, '*')
        const byUpdated = calls.find(q => q.filters.some(f => f[0] === 'gte' && f[1] === 'updated_at'))
        expect(byUpdated.filters).toContainEqual(['gte', 'booking_time', '2026-11-02T02:51:03.131Z'])
    })
})
