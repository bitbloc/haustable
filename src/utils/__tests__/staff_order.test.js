import { describe, it, expect } from 'vitest'
import {
    BAR_CATEGORY_IDS,
    resolveDestination,
    toCartLine,
    addCartLine,
    changeCartQty,
    cartCount,
    cartTotal,
    buildOrderItemsPayload,
    pickOpenBill,
    billSummary,
    isAwaitingPrint,
    isPrintOverdue,
    readSubmitResult,
    formatBaht,
} from '../staffOrder'

const NOW = new Date('2026-11-16T20:00:00+07:00')
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600 * 1000).toISOString()

const confirmed = (over = {}) => ({
    id: 12,
    name: 'ผัดกะเพราหมูกรอบ',
    category_id: 'food-cat',
    qty: 1,
    price: 139,
    totalPricePerUnit: 139,
    selected_options: [{ group_id: 'g1', group_name: 'ระดับความเผ็ด', choice_id: 'c2', name: 'เผ็ดน้อย', price: 0 }],
    ...over,
})

describe('resolveDestination', () => {
    it('sends bar categories to the bar and everything else to the kitchen', () => {
        expect(resolveDestination({ category_id: BAR_CATEGORY_IDS[0] })).toBe('bar')
        expect(resolveDestination({ category_id: 'food-cat' })).toBe('kitchen')
    })
    it('honours an explicit destination and a bar-marked option', () => {
        expect(resolveDestination({ destination: 'drinks' })).toBe('bar')
        expect(resolveDestination({ destination: 'other' })).toBe('other')
        expect(resolveDestination({ selected_options: [{ name: 'โซดา (บาร์)' }] })).toBe('bar')
    })
})

describe('cart', () => {
    it('merges identical lines and keeps different choices or notes apart', () => {
        let cart = addCartLine([], toCartLine(confirmed()))
        cart = addCartLine(cart, toCartLine(confirmed({ qty: 2 })))
        expect(cart).toHaveLength(1)
        expect(cart[0].qty).toBe(3)

        const withNote = confirmed({
            selected_options: [...confirmed().selected_options, { group_name: 'หมายเหตุ', name: 'ไม่ใส่ถั่ว', price: 0 }],
        })
        cart = addCartLine(cart, toCartLine(withNote))
        expect(cart).toHaveLength(2)
    })

    it('counts, totals and drops a line that reaches zero', () => {
        let cart = addCartLine([], toCartLine(confirmed({ qty: 2 })))
        cart = addCartLine(cart, toCartLine(confirmed({ id: 30, name: 'ชาไทย', totalPricePerUnit: 65, selected_options: [] })))
        expect(cartCount(cart)).toBe(3)
        expect(cartTotal(cart)).toBe(139 * 2 + 65)

        cart = changeCartQty(cart, cart[1].key, -1)
        expect(cart).toHaveLength(1)
        cart = changeCartQty(cart, cart[0].key, 1)
        expect(cart[0].qty).toBe(3)
    })

    it('builds the RPC payload with a destination per item and no bill-level fields', () => {
        const cart = [
            toCartLine(confirmed({ qty: 2 })),
            toCartLine(confirmed({ id: 30, name: 'ชาไทย', category_id: BAR_CATEGORY_IDS[1], totalPricePerUnit: 65, selected_options: [] })),
        ]
        expect(buildOrderItemsPayload(cart)).toEqual([
            { menu_item_id: 12, quantity: 2, price_at_time: 139, destination: 'kitchen', selected_options: confirmed().selected_options },
            { menu_item_id: 30, quantity: 1, price_at_time: 65, destination: 'bar', selected_options: [] },
        ])
    })
})

describe('pickOpenBill', () => {
    it('returns null for an empty table or closed bills', () => {
        expect(pickOpenBill([], NOW)).toBeNull()
        expect(pickOpenBill([{ id: 'a', status: 'completed', booking_time: hoursAgo(1) }], NOW)).toBeNull()
    })
    it('skips an unseated advance reservation and a session older than 16 hours', () => {
        const bills = [
            { id: 'res', status: 'confirmed', booking_type: 'dine_in', booking_time: hoursAgo(-2) },
            { id: 'old', status: 'seated', booking_type: 'walk_in', booking_time: hoursAgo(17) },
        ]
        expect(pickOpenBill(bills, NOW)).toBeNull()
    })
    it('prefers the seated bill, then the newest', () => {
        const bills = [
            { id: 'pending-new', status: 'pending', booking_type: 'walk_in', booking_time: hoursAgo(0.2) },
            { id: 'seated-old', status: 'seated', booking_type: 'walk_in', booking_time: hoursAgo(2) },
            { id: 'seated-new', status: 'seated', booking_type: 'dine_in', booking_time: hoursAgo(1) },
        ]
        expect(pickOpenBill(bills, NOW).id).toBe('seated-new')
        expect(pickOpenBill(bills.slice(0, 1), NOW).id).toBe('pending-new')
    })
})

describe('billSummary', () => {
    it('sums the lines, subtracts only the saved discount and never adds VAT', () => {
        const bill = {
            discount_amount: 50,
            order_items: [
                { price_at_time: 139, quantity: 2 },
                { price_at_time: 65, quantity: 1 },
            ],
        }
        expect(billSummary(bill)).toEqual({ itemCount: 3, subtotal: 343, discount: 50, net: 293 })
    })
    it('never lets a discount push the bill below zero', () => {
        expect(billSummary({ discount_amount: 999, order_items: [{ price_at_time: 100, quantity: 1 }] }).net).toBe(0)
        expect(billSummary(null)).toEqual({ itemCount: 0, subtotal: 0, discount: 0, net: 0 })
    })
})

describe('print state', () => {
    it('flags an unprinted item as overdue only after a minute', () => {
        const fresh = { kitchen_printed_at: null, created_at: new Date(NOW.getTime() - 20 * 1000).toISOString() }
        const stuck = { kitchen_printed_at: null, created_at: new Date(NOW.getTime() - 90 * 1000).toISOString() }
        const printed = { kitchen_printed_at: hoursAgo(1), created_at: hoursAgo(1) }
        expect(isAwaitingPrint(fresh)).toBe(true)
        expect(isPrintOverdue(fresh, NOW)).toBe(false)
        expect(isPrintOverdue(stuck, NOW)).toBe(true)
        expect(isAwaitingPrint(printed)).toBe(false)
        expect(isPrintOverdue(printed, NOW)).toBe(false)
    })
})

describe('readSubmitResult', () => {
    it('passes a success through, including a repeated request', () => {
        const res = readSubmitResult({ data: { success: true, booking_id: 'b1', duplicate: true }, error: null })
        expect(res.ok).toBe(true)
        expect(res.data.duplicate).toBe(true)
    })
    it('explains a bill closed at the POS while the waiter was ordering', () => {
        const res = readSubmitResult({ data: { success: false, code: 'BILL_CLOSED' }, error: null })
        expect(res).toMatchObject({ ok: false, code: 'BILL_CLOSED' })
        expect(res.message).toContain('ปิดไปแล้ว')
    })
    it('names the sold-out item', () => {
        const res = readSubmitResult({ data: { success: false, code: 'ITEM_UNAVAILABLE', detail: 'ชาไทย' }, error: null })
        expect(res.message).toContain('ชาไทย')
    })
    it('tells a missing database function apart from a dropped connection', () => {
        expect(readSubmitResult({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }).code).toBe('NOT_INSTALLED')
        expect(readSubmitResult({ data: null, error: { message: 'TypeError: Failed to fetch' } }).code).toBe('OFFLINE')
        expect(readSubmitResult({ data: null, error: { code: '42501', message: 'permission denied' } }).code).toBe('UNKNOWN')
        expect(readSubmitResult({ data: { success: false, code: 'SOMETHING_NEW' }, error: null }).code).toBe('UNKNOWN')
    })
})

describe('formatBaht', () => {
    it('groups thousands', () => {
        expect(formatBaht(1250)).toBe('฿1,250')
        expect(formatBaht(null)).toBe('฿0')
    })
})
