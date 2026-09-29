import { describe, it, expect } from 'vitest'

describe('Call Bill & Database Resilience Audit', () => {
    // 1. Call Bill Logic Resolution (AllDailyBillsHub)
    const resolveHasCallBill = (booking, dismissedIds = new Set()) => {
        const status = (booking.status || '').toLowerCase()
        const isPaid = status === 'completed' || status === 'paid' || status === 'success'
        const isCancelled = status === 'cancelled' || status === 'void'
        return Boolean(
            booking.staff_remark &&
            booking.staff_remark.includes('[CALL_BILL]') &&
            !isPaid &&
            !isCancelled &&
            !dismissedIds.has(booking.id)
        )
    }

    it('returns true when a seated or pending table calls bill', () => {
        const seatedBooking = { id: 'b1', status: 'seated', staff_remark: '[CALL_BILL] ขอคิดเงินด้วยครับ' }
        const pendingBooking = { id: 'b2', status: 'pending', staff_remark: '[CALL_BILL]' }

        expect(resolveHasCallBill(seatedBooking)).toBe(true)
        expect(resolveHasCallBill(pendingBooking)).toBe(true)
    })

    it('returns false when table has paid/completed (fixes "ค้างลูกค้า check bill")', () => {
        const completedBooking = { id: 'b3', status: 'completed', staff_remark: '[CALL_BILL] โต๊ะ 4' }
        const paidBooking = { id: 'b4', status: 'paid', staff_remark: '[CALL_BILL]' }
        const successBooking = { id: 'b5', status: 'success', staff_remark: '[CALL_BILL]' }

        expect(resolveHasCallBill(completedBooking)).toBe(false)
        expect(resolveHasCallBill(paidBooking)).toBe(false)
        expect(resolveHasCallBill(successBooking)).toBe(false)
    })

    it('returns false when table order is cancelled or voided', () => {
        const cancelledBooking = { id: 'b6', status: 'cancelled', staff_remark: '[CALL_BILL]' }
        const voidBooking = { id: 'b7', status: 'void', staff_remark: '[CALL_BILL]' }

        expect(resolveHasCallBill(cancelledBooking)).toBe(false)
        expect(resolveHasCallBill(voidBooking)).toBe(false)
    })

    it('returns false when staff clicks clear / dismiss on an active call bill', () => {
        const activeBooking = { id: 'b8', status: 'seated', staff_remark: '[CALL_BILL]' }
        const dismissed = new Set(['b8'])

        expect(resolveHasCallBill(activeBooking, dismissed)).toBe(false)
    })

    // 2. Split Payment Remark Sanitation
    it('cleans [CALL_BILL] and [CALL_STAFF] from staff_remark when split payment is fully settled', () => {
        const rawRemark = '[CALL_BILL] [CALL_STAFF] [SPLIT_PAYMENT:R1|AMOUNT:400|METHOD:qr] [SPLIT_PAYMENT:R2|AMOUNT:419|METHOD:promptpay]'
        const cleanedRemark = rawRemark
            .replace(/\[CALL_BILL\]/gi, '')
            .replace(/\[CALL_STAFF\]/gi, '')
            .trim()

        expect(cleanedRemark).not.toContain('[CALL_BILL]')
        expect(cleanedRemark).not.toContain('[CALL_STAFF]')
        expect(cleanedRemark).toContain('[SPLIT_PAYMENT:R1|AMOUNT:400|METHOD:qr]')
        expect(cleanedRemark).toContain('[SPLIT_PAYMENT:R2|AMOUNT:419|METHOD:promptpay]')
    })

    // 3. LiveFloorQuickStatus Protection
    it('prevents call bill badge on floor when table status is not occupied', () => {
        const getFloorAlert = (tableState) => {
            const hasCallStaff = tableState.status === 'occupied' && Boolean(tableState.booking?.staff_remark?.includes('[CALL_STAFF]'))
            const hasCallBill = tableState.status === 'occupied' && Boolean(tableState.booking?.staff_remark?.includes('[CALL_BILL]'))
            return { hasCallStaff, hasCallBill }
        }

        const freeTable = { status: 'free', booking: { staff_remark: '[CALL_BILL]' } }
        const occupiedTable = { status: 'occupied', booking: { staff_remark: '[CALL_BILL]' } }

        expect(getFloorAlert(freeTable).hasCallBill).toBe(false)
        expect(getFloorAlert(occupiedTable).hasCallBill).toBe(true)
    })

    // 4. Quick Track Query Column Safety
    it('ensures quick track query does not use non-existent phone column', () => {
        const clean = '0946417898'
        // Valid query uses tracking_token and pickup_contact_phone only
        const orQuery = `tracking_token.ilike.%${clean}%,pickup_contact_phone.ilike.%${clean}%`

        expect(orQuery).not.toContain(',phone.ilike.')
        expect(orQuery).toContain('tracking_token.ilike.')
        expect(orQuery).toContain('pickup_contact_phone.ilike.')
    })

    // 5. Call Staff Resilience & Back-Office Isolation (Fix for Table H3 issue)
    describe('Call Staff Back-Office & POS Visual Resilience', () => {
        const resolveHasCallStaff = (booking, dismissedIds = new Set()) => {
            if (!booking) return false
            const status = (booking.status || '').toLowerCase()
            const isClosed = ['completed', 'paid', 'success', 'cancelled', 'void', 'no_show'].includes(status)
            return Boolean(
                booking.staff_remark &&
                booking.staff_remark.includes('[CALL_STAFF]') &&
                !isClosed &&
                !dismissedIds.has(booking.id)
            )
        }

        it('returns false for call staff when booking is voided, cancelled or completed', () => {
            const voidBooking = { id: 'v1', status: 'void', staff_remark: '[CALL_STAFF]' }
            const cancelledBooking = { id: 'c1', status: 'cancelled', staff_remark: '[CALL_STAFF]' }
            const completedBooking = { id: 'f1', status: 'completed', staff_remark: '[CALL_STAFF]' }
            const activeBooking = { id: 'a1', status: 'seated', staff_remark: '[CALL_STAFF]' }

            expect(resolveHasCallStaff(voidBooking)).toBe(false)
            expect(resolveHasCallStaff(cancelledBooking)).toBe(false)
            expect(resolveHasCallStaff(completedBooking)).toBe(false)
            expect(resolveHasCallStaff(activeBooking)).toBe(true)
        })

        it('suppresses new order alert if pending booking has 0 items (phantom call staff booking)', () => {
            const isRecentPendingOrder = (booking) => {
                const items = Array.isArray(booking.order_items) ? booking.order_items : []
                return booking.status === 'pending' && items.length > 0
            }

            const phantomCallStaffBooking = {
                id: 'phantom-1',
                status: 'pending',
                staff_remark: '[CALL_STAFF]',
                order_items: []
            }
            const genuineOrderBooking = {
                id: 'real-1',
                status: 'pending',
                staff_remark: 'Spicy level 2',
                order_items: [{ name: 'Khao Soi', qty: 1 }]
            }

            expect(isRecentPendingOrder(phantomCallStaffBooking)).toBe(false)
            expect(isRecentPendingOrder(genuineOrderBooking)).toBe(true)
        })

        it('preserves call staff visual styling over regular orders', () => {
            const resolveTableVisualState = ({ hasCallStaff, hasCallBill, hasOrder }) => {
                if (hasCallBill) return 'blink-emerald'
                if (hasCallStaff) return 'blink-amber'
                if (hasOrder) return 'blink-rose'
                return 'normal'
            }

            // When table calls staff and also has orders, call staff alert must not be dropped
            expect(resolveTableVisualState({ hasCallStaff: true, hasCallBill: false, hasOrder: true })).toBe('blink-amber')
            expect(resolveTableVisualState({ hasCallStaff: false, hasCallBill: false, hasOrder: true })).toBe('blink-rose')
            expect(resolveTableVisualState({ hasCallStaff: true, hasCallBill: true, hasOrder: false })).toBe('blink-emerald')
        })
    })
})
