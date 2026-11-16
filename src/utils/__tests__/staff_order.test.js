import { describe, it, expect, vi } from 'vitest'

vi.mock('../../lib/supabaseClient', () => ({ supabase: { rpc: vi.fn() } }))
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
    isSentToKitchen,
    billBalance,
    normalizePromptPayId,
    formatPromptPayId,
    readAdjustResult,
    summariseTables,
    formatDwell,
} from '../staffOrder'
import { buildRemovalSlipBooking } from '../staffRemovalSlips'

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
    it('says so when no shift is open at the POS', () => {
        expect(readSubmitResult({ data: { success: false, code: 'NO_OPEN_SHIFT' }, error: null }).message).toContain('เปิดกะ')
        expect(readAdjustResult({ data: { success: false, code: 'NO_OPEN_SHIFT' }, error: null }).message).toContain('เปิดกะ')
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

describe('editing a bill line', () => {
    it('treats a printed or claimed item as sent, a fresh one as not', () => {
        expect(isSentToKitchen({ kitchen_printed_at: hoursAgo(1) })).toBe(true)
        expect(isSentToKitchen({ kitchen_printed_at: null, kitchen_print_claimed_at: hoursAgo(0.01) })).toBe(true)
        expect(isSentToKitchen({ kitchen_printed_at: null, kitchen_print_claimed_at: null })).toBe(false)
    })
    it('explains each refusal of staff_adjust_order_item', () => {
        expect(readAdjustResult({ data: { success: true, needs_slip: true }, error: null })).toMatchObject({ ok: true })
        expect(readAdjustResult({ data: { success: false, code: 'REASON_REQUIRED' }, error: null }).message).toContain('เหตุผล')
        expect(readAdjustResult({ data: { success: false, code: 'BILL_CLOSED' }, error: null }).code).toBe('BILL_CLOSED')
        expect(readAdjustResult({ data: null, error: { code: 'PGRST202', message: 'x' } }).code).toBe('NOT_INSTALLED')
        expect(readAdjustResult({ data: { success: false, code: 'NEW' }, error: null }).code).toBe('UNKNOWN')
    })
})

describe('cancel slip for a phone removal', () => {
    const row = {
        id: 7, booking_id: 'b1', menu_item_id: 12, item_name: 'ผัดกะเพราหมูกรอบ', quantity_removed: 1, quantity_after: 0,
        unit_price: 139, selected_options: [{ name: 'เผ็ดน้อย' }], reason: 'made_wasted', removed_by: 'มายด์',
        note: 'ลูกค้าเปลี่ยนใจ', table_name: 'H9', destination: 'kitchen', removed_at: '2026-11-16T12:00:00Z',
    }
    it('tags a full removal as cancelled and says who, why and from where', () => {
        const slip = buildRemovalSlipBooking(row)
        const item = slip.order_items[0]
        expect(slip.tables_layout.table_name).toBe('H9')
        expect(item.name).toBe('[ยกเลิกรายการ] ผัดกะเพราหมูกรอบ')
        expect(item.quantity).toBe(1)
        expect(item.destination).toBe('kitchen')
        expect(item.item_note).toContain('ยกเลิกรายการทั้งหมด (-1 ชิ้น)')
        expect(item.item_note).toContain('ทำแล้ว ต้องทิ้ง')
        expect(item.item_note).toContain('โดย มายด์ (มือถือ)')
        expect(item.name).not.toContain('*')
    })
    it('tags a partial removal as a reduction and routes drinks to the bar', () => {
        const item = buildRemovalSlipBooking({ ...row, quantity_removed: 2, quantity_after: 1, destination: 'bar' }).order_items[0]
        expect(item.name).toBe('[ลดจำนวน] ผัดกะเพราหมูกรอบ')
        expect(item.item_note).toContain('ลดจำนวน -2 ชิ้น (คงเหลือ 1 ชิ้น)')
        expect(item.category_name).toBe('เครื่องดื่ม')
    })
})

describe('payment QR', () => {
    it('charges what the POS would: items less saved discount, deposit and split rounds, no VAT', () => {
        const bill = {
            discount_amount: 50,
            deposit_amount: 100,
            staff_remark: '[SPLIT_ROUNDS: [{"round":1,"amount":200,"method":"qr"}]]',
            order_items: [{ price_at_time: 139, quantity: 2 }, { price_at_time: 372, quantity: 1 }],
        }
        const balance = billBalance(bill)
        expect(balance.subtotal).toBe(650)
        expect(balance.tax).toBe(0)
        expect(balance.fullOrderTotal).toBe(600)
        expect(balance.alreadyPaid).toBe(300)
        expect(balance.remainingBalance).toBe(300)
    })
    it('accepts only real PromptPay ids and never falls back to a default number', () => {
        expect(normalizePromptPayId('098-528-4217')).toBe('0985284217')
        expect(normalizePromptPayId('66985284217')).toBe('0985284217')
        expect(normalizePromptPayId('0105560000000')).toBe('0105560000000')
        expect(normalizePromptPayId('')).toBeNull()
        expect(normalizePromptPayId(null)).toBeNull()
        expect(normalizePromptPayId('12345')).toBeNull()
        expect(formatPromptPayId('0985284217')).toBe('098-528-4217')
    })
})

describe('staff floor list', () => {
    const tables = [
        { id: 1, table_name: 'H1', capacity: 6 },
        { id: 2, table_name: 'H2', capacity: 2 },
        { id: 10, table_name: 'H10', capacity: 4 },
        { id: 3, table_name: 'O1', capacity: 2 },
    ]
    const bookings = [
        { id: 'a', table_id: 2, status: 'seated', booking_type: 'walk_in', booking_time: hoursAgo(1.5), discount_amount: 0,
          staff_remark: '', order_items: [{ price_at_time: 100, quantity: 2 }, { price_at_time: 65, quantity: 1 }] },
        { id: 'b', table_id: 10, status: 'seated', booking_type: 'walk_in', booking_time: hoursAgo(0.5),
          staff_remark: '[QR] guest [CALL_BILL]', order_items: [{ price_at_time: 199, quantity: 1 }] },
        { id: 'c', table_id: 3, status: 'confirmed', booking_type: 'dine_in', booking_time: hoursAgo(-0.5), order_items: [] },
        { id: 'd', table_id: 1, status: 'completed', booking_type: 'walk_in', booking_time: hoursAgo(3), order_items: [] },
    ]
    const rows = summariseTables(tables, bookings, NOW)

    it('puts a table that called first, then open bills, then free tables', () => {
        expect(rows.map(r => r.name)).toEqual(['H10', 'H2', 'H1', 'O1'])
    })
    it('reports each open bill: items, what is left to pay, time seated', () => {
        const h2 = rows.find(r => r.name === 'H2')
        expect(h2).toMatchObject({ state: 'open', billId: 'a', itemCount: 3, due: 265, minutes: 90, callStaff: false, callBill: false })
        expect(rows.find(r => r.name === 'H10').callBill).toBe(true)
    })
    it('keeps a closed bill free and shows a reservation arriving within the hour', () => {
        expect(rows.find(r => r.name === 'H1')).toMatchObject({ state: 'free', billId: null, due: 0 })
        const o1 = rows.find(r => r.name === 'O1')
        expect(o1.state).toBe('free')
        expect(o1.arriving).toBeInstanceOf(Date)
    })
    it('never prices a maintenance block', () => {
        const blocked = summariseTables([tables[0]], [{ id: 'x', table_id: 1, status: 'seated', booking_type: 'walk_in', booking_time: hoursAgo(1), customer_note: 'Maintenance Block', total_amount: 0, order_items: [] }], NOW)[0]
        expect(blocked).toMatchObject({ state: 'blocked', due: 0 })
    })
    it('formats time seated', () => {
        expect(formatDwell(48)).toBe('48 นาที')
        expect(formatDwell(65)).toBe('1 ชม. 5 นาที')
        expect(formatDwell(120)).toBe('2 ชม.')
    })
})
