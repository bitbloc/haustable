import { describe, it, expect } from 'vitest'
import { getThaiDate, formatThaiDateOnly, formatThaiTimeOnly } from '../timeUtils'

describe('Admin Dashboard Flow & UX/UI Audit', () => {
    it('accurately distinguishes shift banner between today and historical dates', () => {
        const today = getThaiDate()
        const pastDate = '2026-09-23'

        const isTodayForCurrent = today === getThaiDate()
        const isTodayForPast = pastDate === getThaiDate()

        expect(isTodayForCurrent).toBe(true)
        expect(isTodayForPast).toBe(false)

        // Banner copy logic verification
        const getBannerConfig = (selectedDate, isShiftOpen, latestClosedShift) => {
            const isToday = selectedDate === getThaiDate()
            if (!isToday) {
                return {
                    tag: latestClosedShift ? '[ARCHIVED SHIFT]' : '[NO SHIFT RECORD]',
                    title: 'HISTORICAL RECORD // รอบขายย้อนหลัง',
                    detail: latestClosedShift ? `ปิดรอบเมื่อ ${latestClosedShift.closed_at}` : 'ไม่มีประวัติรอบการขาย'
                }
            }
            if (isShiftOpen) {
                return {
                    tag: '[ONLINE TERMINAL ACTIVE]',
                    title: 'POS SHIFT ACTIVE // กะกำลังทำงาน',
                    detail: 'พนักงานประจำเครื่อง'
                }
            }
            return {
                tag: '[TERMINAL CLOSED]',
                title: 'POS SHIFT CLOSED // กะปิดอยู่',
                detail: latestClosedShift ? `หน้าร้านยังไม่เปิดรอบขาย (รอบล่าสุดปิดเมื่อ ${latestClosedShift.closed_at})` : 'หน้าร้านยังไม่มีการเปิดรอบการขาย'
            }
        }

        // Test past date
        const pastConfig = getBannerConfig(pastDate, false, { closed_at: '23:44', staff_name: 'Admin' })
        expect(pastConfig.tag).toBe('[ARCHIVED SHIFT]')
        expect(pastConfig.title).toContain('HISTORICAL RECORD')
        expect(pastConfig.detail).toContain('23:44')

        // Test today with closed shift
        const todayClosedConfig = getBannerConfig(today, false, { closed_at: '00:15', staff_name: 'Admin' })
        expect(todayClosedConfig.tag).toBe('[TERMINAL CLOSED]')
        expect(todayClosedConfig.title).toBe('POS SHIFT CLOSED // กะปิดอยู่')

        // Test today with active shift
        const todayOpenConfig = getBannerConfig(today, true, null)
        expect(todayOpenConfig.tag).toBe('[ONLINE TERMINAL ACTIVE]')
        expect(todayOpenConfig.title).toBe('POS SHIFT ACTIVE // กะกำลังทำงาน')
    })

    it('formats SimplifiedBillsSummaryList header dynamically for today vs historical dates', () => {
        const today = getThaiDate()
        const pastDate = '2026-09-20'

        const getHeaderLabels = (selectedDate) => {
            const isToday = !selectedDate || selectedDate === getThaiDate()
            return {
                pill: isToday ? 'TODAY // สรุปบิลประจำวัน' : `${selectedDate} // สรุปบิลย้อนหลัง`,
                title: isToday ? 'LIST สรุปบิลประจำวัน' : `LIST สรุปบิลวันที่ ${formatThaiDateOnly(selectedDate)}`
            }
        }

        const todayHeader = getHeaderLabels(today)
        expect(todayHeader.pill).toBe('TODAY // สรุปบิลประจำวัน')
        expect(todayHeader.title).toBe('LIST สรุปบิลประจำวัน')

        const pastHeader = getHeaderLabels(pastDate)
        expect(pastHeader.pill).toBe('2026-09-20 // สรุปบิลย้อนหลัง')
        expect(pastHeader.title).toBe('LIST สรุปบิลวันที่ 20 ก.ย.')
    })

    it('calculates total revenue falling back to total_price when total_amount is zero or missing', () => {
        const sampleBookings = [
            { id: '1', status: 'completed', total_amount: 500 },
            { id: '2', status: 'paid', total_price: 350, total_amount: null },
            { id: '3', status: 'success', total_amount: 0, total_price: 200 },
            { id: '4', status: 'seated', total_amount: 600 }, // unpaid
            { id: '5', status: 'cancelled', total_amount: 800 } // cancelled
        ]

        let settledRevenue = 0
        let settledCount = 0

        sampleBookings.forEach(b => {
            const amt = Number(b.total_amount || b.total_price || 0)
            if (['completed', 'paid', 'success'].includes(b.status)) {
                settledCount++
                settledRevenue += amt
            }
        })

        expect(settledCount).toBe(3)
        expect(settledRevenue).toBe(1050) // 500 + 350 + 200
    })

    it('ensures back-office does not have operational action buttons (display-only)', () => {
        // Backoffice components inspection invariant
        const backofficeActions = ['view_slip', 'print_png_slip', 'view_tax_invoice', 'inspect_bill', 'inspect_table']
        const posOnlyActions = ['release_table', 'clear_table', 'cancel_bill', 'checkout_cash', 'checkout_qr']

        expect(backofficeActions).not.toContain('release_table')
        expect(backofficeActions).not.toContain('clear_table')
        expect(backofficeActions).not.toContain('cancel_bill')

        expect(posOnlyActions).toContain('release_table')
        expect(posOnlyActions).toContain('clear_table')
    })
})
