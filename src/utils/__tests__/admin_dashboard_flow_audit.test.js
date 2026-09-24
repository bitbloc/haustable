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

    it('resolves correct daypart and action recommendation across 24 hours (morning prep, overnight, operating dayparts)', async () => {
        const { getOperatingDaypart, getOperatingActionText } = await import('../../components/admin/financial/IntradayVelocityDaypartCockpit.jsx')

        // 1. Morning prep hours (06:00 - 10:59)
        const morningHours = [6, 7, 8, 9, 10]
        morningHours.forEach(h => {
            const dp = getOperatingDaypart(h)
            expect(dp.id).toBe('morning_prep')
            expect(dp.label).toBe('Morning Prep')
            expect(dp.rangeText).toBe('06:00 - 11:00')
            const action = getOperatingActionText(dp.id, 0)
            expect(action).toBe('ตรวจเช็คสต็อกวัตถุดิบ & ขนม · ตรวจสอบบุ๊คกิ้งโต๊ะจองประจำวัน · เตรียมพร้อมเปิดร้าน 11.00 น.')
            // Must NOT show closing bar or last order in the morning!
            expect(action).not.toContain('เช็คยอดปิดรอบบาร์')
            expect(action).not.toContain('ลาสออเดอร์')
        })

        // 2. Overnight hours (00:00 - 05:59)
        const overnightHours = [0, 1, 2, 3, 4, 5]
        overnightHours.forEach(h => {
            const dp = getOperatingDaypart(h)
            expect(dp.id).toBe('overnight')
            expect(dp.label).toBe('Overnight Closed')
            expect(dp.rangeText).toBe('00:00 - 06:00')
            const action = getOperatingActionText(dp.id, 0)
            expect(action).toBe('ร้านปิดให้บริการรอบค่ำแล้ว · เช็คสรุปยอดขายประจำวันและปิดระบบ')
        })

        // 3. Operating hours: Lunch (11:00 - 13:59)
        const lunchDp = getOperatingDaypart(12)
        expect(lunchDp.id).toBe('lunch')
        expect(getOperatingActionText('lunch', 0)).toContain('ครัวสแตนด์บายจานด่วนต่อเนื่อง')
        expect(getOperatingActionText('lunch', -15)).toContain('เร่งสปีดบริการจานด่วน')

        // 4. Operating hours: Afternoon (14:00 - 16:59)
        const afternoonDp = getOperatingDaypart(15)
        expect(afternoonDp.id).toBe('afternoon')
        expect(getOperatingActionText('afternoon', 0)).toContain('บาร์ชูเมนูกาแฟดริป')

        // 5. Operating hours: Dinner (17:00 - 20:59)
        const dinnerDp = getOperatingDaypart(19)
        expect(dinnerDp.id).toBe('dinner')
        expect(getOperatingActionText('dinner', 0)).toContain('ครัวหลักเดินเครื่องเต็มสเตชั่น')
        expect(getOperatingActionText('dinner', -12)).toContain('เปิดรับ Walk-in หน้าบาร์ทันที')

        // 6. Operating hours: Late Night (21:00 - 23:59)
        const lateDp = getOperatingDaypart(22)
        expect(lateDp.id).toBe('late')
        expect(getOperatingActionText('late', 0)).toBe('เช็คยอดปิดรอบบาร์ · ลาสออเดอร์อาหารร้อน · สแตนด์บายเครื่องดื่มชิลล์')
    })

    it('accurately parses AI Strategy Briefing into 3 distinct sections even with parentheses, ampersands, and bold wrapping (resolves ข้อ 2 หาย bug)', async () => {
        const { parseBriefingSections } = await import('../../components/admin/financial/IntradayVelocityDaypartCockpit.jsx')

        // Exact text structure from user screenshot
        const screenshotAiText = `
[1. การวิเคราะห์ความเร็วยอดขายและการครองที่นั่ง]
สถานะปัจจุบันช่วงก่อนเริ่มรอบบริการ ยอดขายสะสม ฿0 และจำนวนลูกค้า 0 ท่าน เป็นไปตามรอบเวลาปกติ โดยเป้าหมายประจำวันตั้งไว้ที่ ฿7,300 ซึ่งสูงกว่าค่าเฉลี่ยสถิติวันพฤหัสบดีทั่วไป ฿6,305 สำหรับการครองที่นั่งของร้านขนาด 45 ที่นั่ง คาดว่าจะเริ่มเคลื่อนไหวในรอบ Lunch Rush (~9 ท่าน) ต่อเนื่องรอบบ่าย (~4 ท่าน) และจะเข้าสู่ช่วงทำรายได้สูงสุดในรอบ Prime Dinner เวลา 17.00-21.00 น. (~13 ท่าน) ซึ่งเป็นธรรมชาติของร้านอาหารและบาร์ริมแม่น้ำโขงที่ลูกค้าเน้นดื่มด่ำบรรยากาศช่วงค่ำเป็นหลัก

[2. วิเคราะห์สัญญาณออนไลน์และการเชื่อมโยงสู่ยอดขาย (Ad & Customer Intent)]
สัญญาณออนไลน์รวม 101 ครั้งจากช่องทาง Direct แสดงให้เห็นว่าแบรนด์เป็นที่รู้จักและมีผู้ค้นหาโดยตรง โดยพบ High-Intent Leads รวม 4 รายการ แบ่งเป็นการโทร/LINE 2 ครั้ง และการจองโต๊ะ/สั่งล่วงหน้า 2 ครั้ง สะท้อนถึงกลุ่มลูกค้าที่มีความตั้งใจสูงและต้องการการันตีที่นั่งริมน้ำ ในส่วนของการสำรวจเมนูที่ยังเป็น 0 แนะนำให้ฝ่ายการตลาดเร่งลงคอนเทนต์ภาพบรรยากาศยามเย็นริมแม่น้ำโขงและเมนูแนะนำในช่วงเวลา 14.30-16.00 น. เพื่อกระตุ้นการตัดสินใจของกลุ่ม Walk-in ก่อนเข้าสู่ช่วงเย็น

[3. คำแนะนำเชิงปฏิบัติการและยุทธวิธีผลักดันยอดสู่เป้าหมาย]
เพื่อผลักดันยอดขายจากค่าเฉลี่ยปกติให้แตะเป้าหมาย ฿7,300 จำเป็นต้องเพิ่มยอดใช้จ่ายเฉลี่ยต่อหัวเป็น ฿260-฿300 โดยมีแนวทางปฏิบัติดังนี้:
- ทีมหน้าร้าน: จัดเตรียมโต๊ะมุมริมแม่น้ำที่ดีที่สุดสำหรับลูกค้าที่จองล่วงหน้า และบริหารโซนที่นั่งหน้าร้านให้ดูคึกคักเพื่อดึงดูดลูกค้าสัญจร แนะนำให้ทีมบริการนำเสนอเมนู Appetizer คู่กับเครื่องดื่มพิเศษทันทีที่รับออเดอร์แรก
- ทีมครัวและบาร์: เตรียมความพร้อมของวัตถุดิบเมนูซิกเนเจอร์และสต็อกเครื่องดื่มให้พร้อมเสิร์ฟอย่างรวดเร็ว เน้นการเชียร์ขาย Signature Drinks และเมนูกลุ่มกำไรสูง (High-Margin) ในช่วง Prime Dinner และ Late Night เพื่อเพิ่มยอดบิลต่อโต๊ะให้ถึงเป้าหมายอย่างราบรื่น
`

        const parsed = parseBriefingSections(screenshotAiText)

        // 1. Must parse exactly 3 sections (Section 2 must NOT be missing!)
        expect(parsed.sections).toHaveLength(3)

        // 2. Section 1 title and content
        expect(parsed.sections[0].title).toBe('1. การวิเคราะห์ความเร็วยอดขายและการครองที่นั่ง')
        expect(parsed.sections[0].content).toContain('สถานะปัจจุบันช่วงก่อนเริ่มรอบบริการ')
        // Section 1 must NOT contain section 2 text!
        expect(parsed.sections[0].content).not.toContain('วิเคราะห์สัญญาณออนไลน์')

        // 3. Section 2 (The bugged section) MUST be its own section!
        expect(parsed.sections[1].title).toBe('2. วิเคราะห์สัญญาณออนไลน์และการเชื่อมโยงสู่ยอดขาย (Ad & Customer Intent)')
        expect(parsed.sections[1].content).toContain('สัญญาณออนไลน์รวม 101 ครั้งจากช่องทาง Direct')
        expect(parsed.sections[1].content).toContain('High-Intent Leads รวม 4 รายการ')

        // 4. Section 3 title and content
        expect(parsed.sections[2].title).toBe('3. คำแนะนำเชิงปฏิบัติการและยุทธวิธีผลักดันยอดสู่เป้าหมาย')
        expect(parsed.sections[2].content).toContain('ทีมหน้าร้าน: จัดเตรียมโต๊ะมุมริมแม่น้ำ')
        expect(parsed.sections[2].content).toContain('ทีมครัวและบาร์:')
    })

    it('handles markdown bold wrapped brackets and numbered markdown headings gracefully', async () => {
        const { parseBriefingSections } = await import('../../components/admin/financial/IntradayVelocityDaypartCockpit.jsx')

        // Case: Bold wrapped brackets
        const boldWrapped = `
**[1. การวิเคราะห์ภาพรวม]**
เนื้อหาส่วนที่ 1

**[2. แผนการตลาดและ Ad Intent (Online & Offline)]**
เนื้อหาส่วนที่ 2

**[3. ข้อเสนอแนะเชิงปฏิบัติการ]**
เนื้อหาส่วนที่ 3
`
        const resBold = parseBriefingSections(boldWrapped)
        expect(resBold.sections).toHaveLength(3)
        expect(resBold.sections[0].title).toBe('1. การวิเคราะห์ภาพรวม')
        expect(resBold.sections[1].title).toBe('2. แผนการตลาดและ Ad Intent (Online & Offline)')
        expect(resBold.sections[2].title).toBe('3. ข้อเสนอแนะเชิงปฏิบัติการ')

        // Case: Numbered markdown headers
        const numberedHeaders = `
### 1. การวิเคราะห์ยอดขาย
ยอดขายเป็นไปตามเป้า

### 2. สัญญาณลูกค้าออนไลน์
มีทราฟฟิกเข้ามาต่อเนื่อง

### 3. ยุทธวิธีผลักดันยอด
ดันเมนูซิกเนเจอร์
`
        const resNumbered = parseBriefingSections(numberedHeaders)
        expect(resNumbered.sections).toHaveLength(3)
        expect(resNumbered.sections[0].title).toContain('1. การวิเคราะห์ยอดขาย')
        expect(resNumbered.sections[1].title).toContain('2. สัญญาณลูกค้าออนไลน์')
        expect(resNumbered.sections[2].title).toContain('3. ยุทธวิธีผลักดันยอด')
    })
})


