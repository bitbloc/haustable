import { describe, it, expect } from 'vitest'
import { calculateSplitBalance, appendSplitRoundToRemark, getBookingSplitRounds } from '../splitPaymentHelper'

// Mirrors the equal-share rule in POSSplitPaymentModal: the remaining balance is shared only
// among people who have not paid yet.
function equalShares(remaining, numPeople, paidCount) {
    const peopleLeft = Math.max(1, numPeople - paidCount)
    const base = Math.floor(remaining / peopleLeft)
    const rem = remaining - base * peopleLeft
    return Array.from({ length: peopleLeft }, (_, i) => base + (i < rem ? 1 : 0))
}

const items = [{ price: 300, quantity: 3 }]

describe('equal split settles in exactly N rounds', () => {
    it('900 between 3 people is 300/300/300 with nothing left', () => {
        let remark = ''
        for (let person = 0; person < 3; person++) {
            const booking = { staff_remark: remark }
            const { remainingBalance } = calculateSplitBalance(booking, items)
            const paid = getBookingSplitRounds(booking).filter(r => r.mode === 'EQUAL').length
            const share = equalShares(remainingBalance, 3, paid)[0]
            expect(share).toBe(300)
            remark = appendSplitRoundToRemark(remark, { amount: share, method: 'cash', mode: 'EQUAL', people: 3 })
        }
        expect(calculateSplitBalance({ staff_remark: remark }, items).remainingBalance).toBe(0)
    })

    it('odd totals put the extra baht on early payers and still close', () => {
        let remark = ''
        const odd = [{ price: 303, quantity: 1 }]
        const paidAmounts = []
        for (let person = 0; person < 2; person++) {
            const booking = { staff_remark: remark }
            const { remainingBalance } = calculateSplitBalance(booking, odd)
            const paid = getBookingSplitRounds(booking).filter(r => r.mode === 'EQUAL').length
            const share = equalShares(remainingBalance, 2, paid)[0]
            paidAmounts.push(share)
            remark = appendSplitRoundToRemark(remark, { amount: share, method: 'qr', mode: 'EQUAL', people: 2 })
        }
        expect(paidAmounts).toEqual([152, 151])
        expect(calculateSplitBalance({ staff_remark: remark }, odd).remainingBalance).toBe(0)
    })

    it('keeps the head count on equal rounds so a reopened modal can resume', () => {
        const remark = appendSplitRoundToRemark('', { amount: 300, method: 'cash', mode: 'EQUAL', people: 3 })
        expect(getBookingSplitRounds({ staff_remark: remark })[0].people).toBe(3)
    })
})

describe('split balance uses the order panel net total', () => {
    it('charges the discounted total, not the raw item sum', () => {
        const res = calculateSplitBalance({ staff_remark: '' }, [{ price: 1000, quantity: 1 }], false, 900)
        expect(res.fullOrderTotal).toBe(900)
        expect(res.remainingBalance).toBe(900)
    })

    it('falls back to items when no panel total is given', () => {
        expect(calculateSplitBalance({ staff_remark: '' }, [{ price: 1000, quantity: 1 }]).fullOrderTotal).toBe(1000)
    })

    it('an overpaid bill shows nothing due instead of the full total again', () => {
        const remark = appendSplitRoundToRemark('', { amount: 1000, method: 'cash', mode: 'CUSTOM' })
        const res = calculateSplitBalance({ staff_remark: remark }, [{ price: 800, quantity: 1 }])
        expect(res.remainingBalance).toBe(0)
    })
})
