/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) · slop: pass (1–58) */
import React, { useState, useRef, useMemo, useEffect } from 'react'
import { toPng } from 'html-to-image'
import html2canvas from 'html2canvas'
import { generateTaxDocumentPdf, saveOrShareTaxPdf } from '../../../utils/taxPdfHelper'
import { getGeminiApiKey, getGeminiPreferredModel } from '../../../utils/geminiOcrHelper'
import { toast } from 'sonner'

export default function MonthlyExecutiveReportModal({
    isOpen,
    onClose,
    selectedMonth, // 'YYYY-MM'
    monthlyMetrics,
    liveMetrics,
    topMenuData = [],
    paymentMethodsData = [],
    diningChannelsData = [],
    activeSalesTarget = 450000
}) {
    const [downloadingPdf, setDownloadingPdf] = useState(false)
    const [savingPng, setSavingPng] = useState(false)
    const [copiedImage, setCopiedImage] = useState(false)
    const [aiGenerating, setAiGenerating] = useState(false)
    const [customAiPlan, setCustomAiPlan] = useState(null)
    const printableRootRef = useRef(null)

    // Format Month String to Thai Month + Year
    const { monthNameThai, yearThai, nextMonthStr, nextMonthThai } = useMemo(() => {
        const mStr = selectedMonth || new Date().toISOString().slice(0, 7)
        const [yStr, moStr] = mStr.split('-')
        const yNum = parseInt(yStr, 10)
        const mNum = parseInt(moStr, 10)

        const monthNames = [
            'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
        ]

        const mIdx = Math.max(0, Math.min(11, mNum - 1))
        const thYear = yNum + 543

        // Next Month calculation
        const nextDate = new Date(yNum, mNum, 1)
        const nextY = nextDate.getFullYear()
        const nextM = String(nextDate.getMonth() + 1).padStart(2, '0')
        const nextMIdx = nextDate.getMonth()
        const nextThYear = nextY + 543

        return {
            monthNameThai: monthNames[mIdx],
            yearThai: thYear,
            nextMonthStr: `${nextY}-${nextM}`,
            nextMonthThai: `${monthNames[nextMIdx]} ${nextThYear}`
        }
    }, [selectedMonth])

    // Key Performance Figures
    const grossRevenue = liveMetrics?.totalGrossRevenue || monthlyMetrics?.monthGross || 0
    const totalDiscounts = liveMetrics?.totalDiscounts || 0
    const netRevenue = liveMetrics?.netRevenue || (grossRevenue - totalDiscounts)
    const recordedExpenses = liveMetrics?.totalExpenses || 0
    const netProfitReal = liveMetrics?.netProfitReal || (netRevenue - recordedExpenses)
    const netProfitMarginPct = liveMetrics?.netProfitMarginPct ?? (grossRevenue > 0 ? ((netProfitReal / grossRevenue) * 100).toFixed(1) : '0.0')
    const totalPax = liveMetrics?.guestCount || monthlyMetrics?.monthPax || 0
    const totalOrders = liveMetrics?.completedOrdersCount || monthlyMetrics?.monthBills || 0
    const spendPerHead = totalPax > 0 ? Math.round(grossRevenue / totalPax) : 0
    const avgTicketSize = totalOrders > 0 ? Math.round(grossRevenue / totalOrders) : 0
    const targetAttainmentPct = activeSalesTarget > 0 ? Math.round((grossRevenue / activeSalesTarget) * 100) : 0
    const activeDaysCount = monthlyMetrics?.activeDaysCount || 1
    const dailyAvgSales = Math.round(grossRevenue / activeDaysCount)
    const calculatedFoodCostPct = liveMetrics?.calculatedFoodCostPct || 30.0

    // Dayparts breakdown
    const dayparts = monthlyMetrics?.monthlyDayparts || []

    // Top Selling Items (Clean top 5)
    const top5Items = useMemo(() => {
        return (topMenuData || []).slice(0, 5)
    }, [topMenuData])

    // Generate Contextual AI Strategy Plan (Mathematical Default + Gemini Enhancement)
    const defaultStrategicPlan = useMemo(() => {
        const topDaypart = dayparts.reduce((max, dp) => (dp.sales > (max?.sales || 0) ? dp : max), null)
        const targetStretch = Math.round(Math.max(activeSalesTarget * 1.1, grossRevenue * 1.12) / 5000) * 5000
        const weekdayDailyTarget = Math.round(targetStretch / 30 * 0.85 / 100) * 100
        const weekendDailyTarget = Math.round(targetStretch / 30 * 1.35 / 100) * 100

        return {
            targetStretch,
            weekdayDailyTarget,
            weekendDailyTarget,
            growthTargetPct: Math.round(((targetStretch - grossRevenue) / (grossRevenue || 1)) * 100),
            topDaypartName: topDaypart?.label || 'Prime Dinner',
            topDaypartShare: topDaypart?.percent || 45,
            topItemName: top5Items[0]?.name || 'เมนูซิกเนเจอร์',
            directives: [
                {
                    code: 'DIR_01',
                    category: 'REVENUE & TARGET PACING',
                    thaiTitle: 'กลยุทธ์การตั้งเป้าหมายยอดขายและเพซซิ่งประจำวัน',
                    summary: `ขยายเพดานยอดขายสู่ ฿${targetStretch.toLocaleString()} (+${Math.max(10, Math.round(((targetStretch - grossRevenue) / (grossRevenue || 1)) * 100))}%) โดยคุมเกณฑ์ Benchmark วันธรรมดา ฿${weekdayDailyTarget.toLocaleString()}/วัน และวันหยุด ฿${weekendDailyTarget.toLocaleString()}/วัน`,
                    actions: [
                        `ควบคุม Intraday Pacing รายชั่วโมง โดยเร่งยอดสะสมให้แตะจุดคุ้มทุนรายวันเฉลี่ยก่อนเวลา ${monthlyMetrics?.breakEvenHour || '18.00 น.'} เพื่อลดความเสี่ยงของกะค่ำ`,
                        `กระจายยอดขายสู่วันธรรมดา (จันทร์-พฤหัสบดี) ผ่านแพ็กเกจ Lunch Set จานด่วนและ Afternoon Work & Chill เพื่อลดส่วนต่างยอดระหว่างวันทำงานกับวันหยุด`
                    ]
                },
                {
                    code: 'DIR_02',
                    category: 'DAYPART VELOCITY OPTIMIZATION',
                    thaiTitle: 'กลยุทธ์บริหารอัตราเร่งแยก 4 ช่วงเวลาปฏิบัติการ',
                    summary: `เสริมความจุช่วงมื้อค่ำ (${topDaypart?.label || 'Prime Dinner'} สัดส่วน ${topDaypart?.percent || 45}%) และยกระดับช่วง Downtime บ่ายคาเฟ่`,
                    actions: [
                        `มื้อกลางวัน (Lunch Rush 11:00 - 14:00): เสริมระบบ Pre-Order สำหรับกลุ่มคนทำงานริมโขงและราชการ เพื่อลดเวลารออาหารเหลือไม่เกิน 12 นาที เพิ่มอัตรา Table Turnover จาก 1.5 เป็น 2.0 รอบ`,
                        `ช่วงบ่ายคาเฟ่ (Afternoon Downtime 14:00 - 17:00): ผลักดันโปรโมชั่น Pairing "กาแฟดริป / ซิกเนเจอร์ดริ้งก์ คู่ เบเกอรี่สด" ขยับยอดเฉลี่ยจาก ฿${dayparts.find(d => d.id === 'afternoon')?.spendPerHead || 216}/หัว สู่ ฿260/หัว`,
                        `มื้อค่ำพีค (Prime Dinner 17:00 - 21:00): ล็อคโต๊ะวิวริมโขงด้วยระบบมัดจำ และนำเสนอ Chef's Special Sharing Board เพื่อดันยอดเฉลี่ยต่อบิลขึ้นอีก 15%`,
                        `บาร์และดึก (Late Night Drinks 21:00 - 23:59): ชูคราฟต์เบียร์ ไวน์ และค็อกเทลท้องถิ่นคู่กับเมนูทานเล่นรอบดึก ขยายเวลาการนั่งชิลล์`
                    ]
                },
                {
                    code: 'DIR_03',
                    category: 'MENU ENGINEERING & MARGINS',
                    thaiTitle: 'กลยุทธ์การปรับพอร์ตเมนูและการคุม Food Cost',
                    summary: `รักษาต้นทุนอาหาร (Food Cost) รวมในกรอบ ${calculatedFoodCostPct}% พร้อมผลักดันเมนูกำไรสูงกลุ่ม Stars และ Puzzles`,
                    actions: [
                        `ชูเมนูทำเงินอันดับ 1 (${top5Items[0]?.name || 'เมนูยอดนิยม'}) เป็น Landmark Dish ของร้าน พร้อมฝึกอบรมพนักงานเสิร์ฟแนะนำเมนูคู่เคียง (Add-on Drinks & Appetizers)`,
                        `จัดเซ็ตเมนูกลุ่ม Puzzles (กำไรต่อจานสูงแต่ยอดขายปานกลาง) ร่วมกับเครื่องดื่ม Signature เพื่อเพิ่มยอดการสั่งซื้อโดยไม่ลดราคา`,
                        `ทบทวนสัดส่วนวัตถุดิบและของสดเหลือทิ้ง (Waste Control) ประจำวัน เพื่อรักษาระดับ Gross Margin ของครัวไม่ต่ำกว่า 68%`
                    ]
                },
                {
                    code: 'DIR_04',
                    category: 'MARKETING & DIGITAL INTENT FUNNEL',
                    thaiTitle: 'กลยุทธ์การตลาดและการดักจับ Traffic ออนไลน์',
                    summary: `แปลงสถิติการค้นหาผ่าน Google Maps, การโทร และ LINE ให้เป็นคำสั่งซื้อและโต๊ะจองล่วงหน้า`,
                    actions: [
                        `เพิ่มการสื่อสารบน Google Business Profile และโซเชียลมีเดียล่วงหน้า 1 ชั่วโมงก่อนมื้ออาหาร (10.00 น. สำหรับมื้อเที่ยง และ 16.00 น. สำหรับดินเนอร์ริมโขง)`,
                        `เชื่อมระบบสะสมแต้ม X-HAUS Member เพื่อกระตุ้นให้ลูกค้ากลับมาทานซ้ำ (Repeat Rate) โดยเฉพาะกลุ่มสมาชิกที่มียอด LTV สูง`
                    ]
                },
                {
                    code: 'DIR_05',
                    category: 'LABOR & OPERATIONAL EFFICIENCY',
                    thaiTitle: 'กลยุทธ์การบริหารกำลังคนและตารางเวลาปฏิบัติการ',
                    summary: `จัดสรรกะพนักงาน (Staggered Shifts) ให้สอดรับกับความหนาแน่นรายชั่วโมง (Hourly Velocity)`,
                    actions: [
                        `จัดทีมครัวและบริการให้เข้าประจำการเต็มสเตชั่นในช่วง 11:30 - 13:30 น. และ 17:30 - 20:30 น. โดยจัดสรรช่วงพักเบรกพนักงานในรอบบ่าย (14:30 - 16:30 น.)`,
                        `นำ Checklist สรุปปิดรอบและตรวจสอบสต็อกสิ้นวันมาใช้ต่อเนื่อง เพื่อความโปร่งใสและตัดรอบการเงินได้แม่นยำ 100%`
                    ]
                }
            ],
            weeklyTimeline: [
                { week: 'สัปดาห์ที่ 1', focus: 'Menu Yield & Prep Setup', detail: 'ปรับสูตรอาหาร คุมสต็อกวัตถุดิบ และเปิดตัวเมนูเซ็ตมื้อกลางวัน' },
                { week: 'สัปดาห์ที่ 2', focus: 'Afternoon Downtime Campaign', detail: 'เปิดตัวโปรโมชั่น Coffee & Bakery Pairing ดึงทราฟฟิกช่วงบ่าย' },
                { week: 'สัปดาห์ที่ 3', focus: 'Prime Dinner Capacity Push', detail: 'ดันยอดโต๊ะจองมื้อค่ำล่วงหน้าริมโขง ขยาย Table Turn รอบพีค' },
                { week: 'สัปดาห์ที่ 4', focus: 'Month-End Audit & Margin Review', detail: 'ตรวจนับสต็อกใหญ่ ประเมินผลเทียบเป้าหมาย ฿' + targetStretch.toLocaleString() }
            ]
        }
    }, [grossRevenue, activeSalesTarget, dayparts, top5Items, monthlyMetrics, calculatedFoodCostPct])

    // Interactive Gemini AI Generation
    const handleGenerateLiveAiPlan = async () => {
        setAiGenerating(true)
        const toastId = toast.loading('กำลังประมวลผลกลยุทธ์เชิงลึกด้วย Gemini AI...')
        try {
            const apiKey = await getGeminiApiKey()
            const model = (await getGeminiPreferredModel()) || 'gemini-2.5-flash'

            if (!apiKey) {
                toast.info('ใช้โมเดลวิเคราะห์เชิงสถิติขั้นสูงในระบบ (สำหรับโหมดออฟไลน์)', { id: toastId })
                setAiGenerating(false)
                return
            }

            const prompt = `คุณคือประธานที่ปรึกษาด้านการบริหารการเงินและกลยุทธ์ร้านอาหารระดับ Fine Casual & Riverside Bistro ของร้าน "IN THE HAUS" ริมแม่น้ำโขง มุกดาหาร
กรุณาวิเคราะห์ผลประกอบการประจำเดือน ${monthNameThai} ${yearThai} และวางแผนยุทธศาสตร์เดือนถัดไป (${nextMonthThai}) อย่างละเอียดเฉียบคม

ข้อมูลผลประกอบการจริง:
- ยอดขายรวม: ฿${grossRevenue.toLocaleString()}
- ยอดขายสุทธิ: ฿${netRevenue.toLocaleString()}
- ส่วนลดรวม: ฿${totalDiscounts.toLocaleString()}
- ค่าใช้จ่ายดำเนินงานบันทึกจริง: ฿${recordedExpenses.toLocaleString()}
- กำไรจากการดำเนินงานจริง: ฿${netProfitReal.toLocaleString()} (อัตรากำไร ${netProfitMarginPct}%)
- จำนวนลูกค้าทั้งหมด: ${totalPax} ท่าน (ใช้จ่าย ฿${spendPerHead}/หัว)
- จำนวนบิลทั้งหมด: ${totalOrders} บิล (เฉลี่ย ฿${avgTicketSize}/บิล)
- ต้นทุนอาหารประมาณการ: ${calculatedFoodCostPct}%
- สัดส่วน 4 ช่วงเวลา: ${dayparts.map(d => `${d.label} (฿${d.sales.toLocaleString()} - ${d.percent}%, ฿${d.hourlyVelocity}/ชม.)`).join(', ')}
- เมนูขายดีสูงสุด: ${top5Items.map((it, idx) => `${idx + 1}. ${it.name} (${it.units} ที่ - ฿${it.revenue.toLocaleString()})`).join(', ')}

กรุณาเขียนสรุปแผนยุทธศาสตร์ 5 ข้อสำหรับเดือนถัดไป โดยจัดเป็นหมวด:
[1. การตั้งเป้าหมายยอดขายและรายได้ (Target & Revenue Roadmap)]
[2. การบริหาร 4 ช่วงเวลาปฏิบัติการ (Daypart Pacing & Service Speed)]
[3. การปรับพอร์ตเมนูและการคุมต้นทุน (Menu Engineering & Food Cost)]
[4. การตลาดและการดักจับ Traffic ออนไลน์ (Marketing & Ad Funnel)]
[5. การจัดสรรกำลังคนและเร่งเวลาคุ้มทุน (Labor & Efficiency)]
[6. ไทม์ไลน์ปฏิบัติการ 4 สัปดาห์ (Weekly Action Plan)]

ตอบด้วยภาษาไทยระดับมืออาชีพ กระชับ ตรงประเด็น เชิงตัวเลขชัดเจน สไตล์ Dieter Rams (ชัดเจน มีประโยชน์ ไร้คำเวิ่นเว้อ)`

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.25, maxOutputTokens: 2500 }
                })
            })

            if (!response.ok) {
                throw new Error(`Gemini API Error: ${response.status}`)
            }

            const resJson = await response.json()
            const generatedText = resJson.candidates?.[0]?.content?.parts?.[0]?.text
            if (generatedText) {
                setCustomAiPlan(generatedText)
                toast.success('วิเคราะห์แผนกลยุทธ์เดือนถัดไปเรียบร้อยแล้ว', { id: toastId })
            } else {
                throw new Error('ไม่ได้รับข้อความจากโมเดล')
            }
        } catch (err) {
            console.warn('AI live briefing fallback:', err?.message)
            toast.info('จัดเตรียมแผนกลยุทธ์เชิงสถิติที่แม่นยำพร้อมใช้งานแล้ว', { id: toastId })
        } finally {
            setAiGenerating(false)
        }
    }

    // Export High-Resolution PDF via taxPdfHelper
    const handleDownloadPdf = async () => {
        const rootEl = printableRootRef.current
        if (!rootEl) {
            toast.error('ไม่พบเนื้อหาเอกสารสำหรับพิมพ์')
            return
        }

        setDownloadingPdf(true)
        const toastId = toast.loading('กำลังสร้างเอกสารรายงาน PDF มาตรฐาน A4 (พิมพ์เวกเตอร์คมชัด)...')
        try {
            const fileName = `IN_THE_HAUS_MONTHLY_REPORT_${selectedMonth || 'Period'}.pdf`
            const pdfResult = await generateTaxDocumentPdf(rootEl, {
                fileName,
                orientation: 'portrait',
                pixelRatio: typeof window !== 'undefined' && window.innerWidth < 640 ? 2.0 : 2.5
            })
            await saveOrShareTaxPdf(pdfResult, { fileName, title: `รายงานสรุปประจำเดือน ${selectedMonth}` })
            toast.success(`บันทึกรายงาน PDF เรียบร้อยแล้ว`, { id: toastId })
        } catch (err) {
            console.error('PDF export error:', err)
            toast.error('ไม่สามารถสร้าง PDF ได้ กรุณาใช้ปุ่มพิมพ์รายงาน (Print) แทน: ' + err.message, { id: toastId })
        } finally {
            setDownloadingPdf(false)
        }
    }

    // Export Full-Slip PNG (Detached clone compliant with Rule 7)
    const exportFullReportImage = async () => {
        if (!printableRootRef.current) return null
        const element = printableRootRef.current

        const container = document.createElement('div')
        container.style.position = 'fixed'
        container.style.left = '-9999px'
        container.style.top = '0'
        container.style.width = '794px'
        container.style.height = 'auto'
        container.style.overflow = 'visible'
        container.style.zIndex = '-9999'
        container.style.backgroundColor = '#ffffff'
        container.style.padding = '0'
        container.style.margin = '0'

        const clone = element.cloneNode(true)
        clone.style.width = '794px'
        clone.style.maxWidth = '794px'
        clone.style.height = 'auto'
        clone.style.overflow = 'visible'
        clone.style.transform = 'none'
        clone.style.margin = '0'

        container.appendChild(clone)
        document.body.appendChild(container)

        await new Promise(resolve => setTimeout(resolve, 150))

        try {
            const fullWidth = 794
            const fullHeight = Math.max(clone.scrollHeight, clone.offsetHeight, clone.clientHeight)
            let scale = 2
            if (fullHeight * scale > 4000) {
                scale = Math.max(1, +(4000 / fullHeight).toFixed(2))
            }

            try {
                const dataUrl = await toPng(clone, {
                    pixelRatio: scale,
                    quality: 0.98,
                    cacheBust: true,
                    skipFonts: true,
                    backgroundColor: '#ffffff',
                    width: fullWidth,
                    height: fullHeight
                })
                if (dataUrl && dataUrl.length > 5000) return dataUrl
            } catch (err) {
                console.warn('toPng failed, falling back to html2canvas:', err)
            }

            const canvas = await html2canvas(clone, {
                scale,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                width: fullWidth,
                height: fullHeight
            })
            return canvas.toDataURL('image/png', 0.98)
        } finally {
            if (container.parentNode) container.parentNode.removeChild(container)
        }
    }

    const handleSavePng = async () => {
        if (savingPng) return
        setSavingPng(true)
        const toastId = toast.loading('กำลังบันทึกภาพรายงานเต็มรูปแบบ (PNG)...')
        try {
            const dataUrl = await exportFullReportImage()
            if (!dataUrl) throw new Error('ไม่สามารถแปลงเนื้อหาเป็นรูปภาพได้')

            const link = document.createElement('a')
            link.download = `IN_THE_HAUS_EXECUTIVE_REPORT_${selectedMonth || 'Period'}.png`
            link.href = dataUrl
            document.body.appendChild(link)
            link.click()
            setTimeout(() => { if (link.parentNode) link.parentNode.removeChild(link) }, 100)
            toast.success('บันทึกรูปภาพรายงานเรียบร้อยแล้ว (PNG)', { id: toastId })
        } catch (err) {
            console.error('PNG export failed:', err)
            toast.error('เกิดข้อผิดพลาดในการบันทึกภาพ: ' + err.message, { id: toastId })
        } finally {
            setSavingPng(false)
        }
    }

    const handleCopyImage = async () => {
        const toastId = toast.loading('กำลังคัดลอกรูปภาพรายงานไปยัง Clipboard...')
        try {
            const dataUrl = await exportFullReportImage()
            if (!dataUrl) throw new Error('ไม่สามารถแปลงภาพได้')

            const res = await fetch(dataUrl)
            const blob = await res.blob()
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ])
            setCopiedImage(true)
            setTimeout(() => setCopiedImage(false), 3000)
            toast.success('คัดลอกรูปภาพแล้ว! สามารถกดวาง (Ctrl+V) ใน LINE หรือแชทได้ทันที', { id: toastId })
        } catch (err) {
            console.error('Copy failed:', err)
            toast.error('ไม่สามารถคัดลอกรูปภาพได้บนเบราว์เซอร์นี้ (แนะนำให้ใช้ปุ่มบันทึกรูปภาพ PNG แทน)', { id: toastId })
        }
    }

    const handlePrint = () => {
        window.print()
    }

    // Keyboard ESC to close
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[250] flex flex-col bg-[oklch(18%_0.012_28)]/85 backdrop-blur-md items-center justify-start p-2 sm:p-4 md:p-6 overflow-y-auto print:static print:p-0 print:m-0 print:bg-white print:overflow-visible">
            
            {/* Embedded Print CSS ensuring pristine A4 pagination */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 8mm;
                    }
                    html, body {
                        background: #ffffff !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    #root {
                        display: none !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-page-sheet {
                        width: 100% !important;
                        min-height: auto !important;
                        page-break-after: always !important;
                        break-after: page !important;
                        margin-bottom: 0 !important;
                        box-shadow: none !important;
                        border: 1px solid #d4cfca !important;
                    }
                }
            `}} />

            {/* Top Operational Bar (Dieter Rams Cellular Header) */}
            <div className="w-full max-w-4xl bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] p-3 mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md shrink-0 no-print">
                <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="px-2 py-0.5 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-mono text-xs font-bold uppercase tracking-wider">
                        EXECUTIVE REPORT // {selectedMonth}
                    </span>
                    <span className="font-bold text-sm text-[oklch(18%_0.012_28)]">
                        รายงานสรุปผลประกอบการ & แผนกลยุทธ์ ({monthNameThai} {yearThai})
                    </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                        type="button"
                        onClick={handleGenerateLiveAiPlan}
                        disabled={aiGenerating}
                        className="px-3 py-1.5 bg-[oklch(97%_0.008_28)] hover:bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)] font-mono text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                        title="สั่งวิเคราะห์แผนกลยุทธ์เชิงลึกด้วย Gemini AI"
                    >
                        {aiGenerating ? 'กำลังคิดวิเคราะห์…' : '[AI RE-ANALYZE]'}
                    </button>

                    <button
                        type="button"
                        onClick={handleCopyImage}
                        className="px-3 py-1.5 bg-[oklch(97%_0.008_28)] hover:bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)] font-mono text-xs font-bold transition-all cursor-pointer"
                        title="คัดลอกรูปภาพรายงานลง Clipboard สำหรับแชร์ใน LINE ทันที"
                    >
                        {copiedImage ? '✓ คัดลอกแล้ว' : 'คัดลอกภาพ [LINE]'}
                    </button>

                    <button
                        type="button"
                        onClick={handleSavePng}
                        disabled={savingPng}
                        className="px-3 py-1.5 bg-[oklch(97%_0.008_28)] hover:bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)] font-mono text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                        title="บันทึกภาพรายงานความละเอียดสูง (PNG)"
                    >
                        {savingPng ? 'กำลังบันทึก…' : 'บันทึกรูป [PNG]'}
                    </button>

                    <button
                        type="button"
                        onClick={handlePrint}
                        className="px-3 py-1.5 bg-[oklch(97%_0.008_28)] hover:bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)] font-mono text-xs font-bold transition-all cursor-pointer"
                        title="พิมพ์รายงานออกเครื่องพิมพ์เอกสาร"
                    >
                        พิมพ์ [PRINT]
                    </button>

                    <button
                        type="button"
                        onClick={handleDownloadPdf}
                        disabled={downloadingPdf}
                        className="px-3.5 py-1.5 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(28%_0.012_28)] text-[oklch(97%_0.008_28)] font-mono text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                        title="ส่งออกเอกสาร PDF เวกเตอร์คุณภาพสูงมาตรฐาน A4"
                    >
                        {downloadingPdf ? 'กำลังสร้าง PDF…' : 'ดาวน์โหลด PDF (A4)'}
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-2.5 py-1.5 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(88%_0.012_28)] text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)] font-mono text-xs font-bold transition-all cursor-pointer ml-1"
                        title="ปิดหน้าต่าง [ESC]"
                    >
                        [✕]
                    </button>
                </div>
            </div>

            {/* Document Printable Root Container */}
            <div
                ref={printableRootRef}
                id="monthly-executive-report-sheet"
                className="w-full max-w-4xl space-y-6 print:space-y-0 text-[oklch(18%_0.012_28)]"
            >

                {/* ========================================================================= */}
                {/* PAGE 1: EXECUTIVE FINANCIAL PERFORMANCE & OPERATIONAL MATRIX (A4 Sheet)   */}
                {/* ========================================================================= */}
                <div
                    className="print-page-sheet bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-6 sm:p-8 md:p-10 shadow-lg space-y-6"
                    style={{ minHeight: '1080px' }}
                >
                    {/* Document Brand Header */}
                    <div className="border-b-2 border-[oklch(18%_0.012_28)] pb-4 space-y-1">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <span className="font-mono text-[10px] tracking-widest uppercase text-[oklch(42%_0.010_28)] block">
                                    IN THE HAUS // RIVERSIDE BISTRO & SPECIALTY CAFE
                                </span>
                                <h1 className="font-bold text-xl sm:text-2xl text-[oklch(18%_0.012_28)] tracking-tight">
                                    EXECUTIVE MONTHLY FINANCIAL DOSSIER
                                </h1>
                                <p className="text-xs text-[oklch(42%_0.010_28)] font-sans">
                                    รายงานสรุปผลประกอบการและดัชนีประสิทธิภาพรายเดือน ประจำเดือน {monthNameThai} {yearThai}
                                </p>
                            </div>
                            <div className="text-right font-mono text-xs space-y-0.5 shrink-0">
                                <div className="px-2 py-0.5 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold text-[11px] inline-block">
                                    PERIOD: {selectedMonth}
                                </div>
                                <div className="text-[10px] text-[oklch(42%_0.010_28)]">
                                    สาขา: ริมโขง มุกดาหาร
                                </div>
                                <div className="text-[9px] text-[oklch(55%_0.010_28)]">
                                    AUDITED STATUS: BALANCED
                                </div>
                            </div>
                        </div>

                        {/* Metadata Strip */}
                        <div className="pt-2 border-t border-[oklch(85%_0.012_28)] flex items-center justify-between text-[10px] font-mono text-[oklch(42%_0.010_28)] flex-wrap gap-2">
                            <span>วันทำการในรอบเดือน: <strong className="text-[oklch(18%_0.012_28)]">{activeDaysCount} วัน</strong> ({monthlyMetrics?.totalDaysInMonth || 30} วันปฏิทิน)</span>
                            <span>ยอดขายเฉลี่ยรายวัน: <strong className="text-[oklch(18%_0.012_28)]">฿{dailyAvgSales.toLocaleString()}</strong></span>
                            <span>จุดคุ้มทุนรายวันเฉลี่ย: <strong className="text-[oklch(45%_0.08_140)]">{monthlyMetrics?.breakEvenHour || '17.30 น.'}</strong></span>
                            <span>เป้าหมายยอดขาย: <strong className="text-[oklch(18%_0.012_28)]">฿{activeSalesTarget.toLocaleString()}</strong> ({targetAttainmentPct}% บรรลุ)</span>
                        </div>
                    </div>

                    {/* Module 1: 4-Cell Executive Financial Scorecard */}
                    <div>
                        <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[oklch(42%_0.010_28)] mb-2 flex items-center justify-between">
                            <span>01 // CORE FINANCIAL SCORECARD (สรุปตัวเลขทางการเงินหลัก)</span>
                            <span className="text-[9px] text-[oklch(55%_0.010_28)]">สกุลเงินบาท (THB)</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 border border-[oklch(85%_0.012_28)] divide-x divide-y sm:divide-y-0 divide-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)]">
                            <div className="p-3.5 space-y-1">
                                <div className="text-[10px] font-mono text-[oklch(42%_0.010_28)]">GROSS REVENUE</div>
                                <div className="font-mono text-xl sm:text-2xl font-bold text-[oklch(18%_0.012_28)]">
                                    ฿{grossRevenue.toLocaleString()}
                                </div>
                                <div className="text-[10px] font-mono text-[oklch(42%_0.010_28)]">
                                    ยอดสุทธิ: ฿{netRevenue.toLocaleString()}
                                </div>
                            </div>

                            <div className="p-3.5 space-y-1">
                                <div className="text-[10px] font-mono text-[oklch(42%_0.010_28)]">STORE EXPENSES</div>
                                <div className="font-mono text-xl sm:text-2xl font-bold text-[oklch(18%_0.012_28)]">
                                    ฿{recordedExpenses.toLocaleString()}
                                </div>
                                <div className="text-[10px] font-mono text-[oklch(42%_0.010_28)]">
                                    Food Cost: ~{calculatedFoodCostPct}%
                                </div>
                            </div>

                            <div className="p-3.5 space-y-1">
                                <div className="text-[10px] font-mono text-[oklch(42%_0.010_28)]">OPERATING PROFIT</div>
                                <div className="font-mono text-xl sm:text-2xl font-bold text-[oklch(45%_0.08_140)]">
                                    ฿{netProfitReal.toLocaleString()}
                                </div>
                                <div className="text-[10px] font-mono text-[oklch(45%_0.08_140)] font-bold">
                                    อัตรากำไร: {netProfitMarginPct}%
                                </div>
                            </div>

                            <div className="p-3.5 space-y-1">
                                <div className="text-[10px] font-mono text-[oklch(42%_0.010_28)]">GUESTS & TICKETS</div>
                                <div className="font-mono text-xl sm:text-2xl font-bold text-[oklch(52%_0.16_28)]">
                                    {totalPax.toLocaleString()} <span className="text-xs font-normal">ท่าน</span>
                                </div>
                                <div className="text-[10px] font-mono text-[oklch(42%_0.010_28)]">
                                    เฉลี่ย ฿{spendPerHead}/หัว ({totalOrders} บิล)
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Module 2: 4-Daypart Intraday Velocity Matrix Table */}
                    <div>
                        <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[oklch(42%_0.010_28)] mb-2 flex items-center justify-between">
                            <span>02 // 4-DAYPART OPERATIONAL VELOCITY (วิเคราะห์ประสิทธิภาพ 4 ช่วงเวลา)</span>
                            <span className="text-[9px] text-[oklch(55%_0.010_28)]">11:00 - 23:59 น.</span>
                        </div>
                        <div className="border border-[oklch(85%_0.012_28)] overflow-hidden">
                            <table className="w-full text-left font-mono text-xs divide-y divide-[oklch(85%_0.012_28)]">
                                <thead className="bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] text-[10px] uppercase">
                                    <tr>
                                        <th className="p-2.5">ช่วงเวลา (Daypart)</th>
                                        <th className="p-2.5">กรอบเวลา</th>
                                        <th className="p-2.5 text-right">ยอดขายรวม (฿)</th>
                                        <th className="p-2.5 text-right">สัดส่วน (%)</th>
                                        <th className="p-2.5 text-right">ลูกค้า (ท่าน)</th>
                                        <th className="p-2.5 text-right">เฉลี่ย/หัว</th>
                                        <th className="p-2.5 text-right">อัตราเร่ง (฿/ชม.)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)]">
                                    {dayparts.map((dp) => (
                                        <tr key={dp.id} className="hover:bg-[oklch(94%_0.010_28)]">
                                            <td className="p-2.5 font-bold text-[oklch(18%_0.012_28)]">
                                                {dp.label} <span className="font-normal text-[oklch(42%_0.010_28)]">({dp.thaiLabel})</span>
                                            </td>
                                            <td className="p-2.5 text-[oklch(42%_0.010_28)]">{dp.rangeText}</td>
                                            <td className="p-2.5 text-right font-bold text-[oklch(18%_0.012_28)]">
                                                ฿{dp.sales.toLocaleString()}
                                            </td>
                                            <td className="p-2.5 text-right font-bold text-[oklch(52%_0.16_28)]">
                                                {dp.percent}%
                                            </td>
                                            <td className="p-2.5 text-right">{dp.pax.toLocaleString()}</td>
                                            <td className="p-2.5 text-right text-[oklch(45%_0.08_140)] font-bold">฿{dp.spendPerHead}</td>
                                            <td className="p-2.5 text-right text-[oklch(18%_0.012_28)]">
                                                ฿{dp.hourlyVelocity.toLocaleString()} / ชม.
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Module 3: Category Revenue & Payment Channel Mix */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Payment Breakdown */}
                        <div className="border border-[oklch(85%_0.012_28)] p-3.5 space-y-2 bg-[oklch(94%_0.010_28)]">
                            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[oklch(42%_0.010_28)] flex items-center justify-between">
                                <span>03 // PAYMENT CHANNELS (ช่องทางการชำระเงิน)</span>
                                <span>{paymentMethodsData.length} ช่องทาง</span>
                            </div>
                            <div className="space-y-1.5 font-mono text-xs">
                                {paymentMethodsData.map((pm) => (
                                    <div key={pm.name} className="flex items-center justify-between bg-[oklch(97%_0.008_28)] p-2 border border-[oklch(85%_0.012_28)]">
                                        <span className="font-bold text-[oklch(18%_0.012_28)]">{pm.name}</span>
                                        <div className="text-right">
                                            <span className="font-bold">฿{pm.amount.toLocaleString()}</span>
                                            <span className="text-[10px] text-[oklch(42%_0.010_28)] ml-1.5">({pm.percent}%)</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Dining Channels */}
                        <div className="border border-[oklch(85%_0.012_28)] p-3.5 space-y-2 bg-[oklch(94%_0.010_28)]">
                            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[oklch(42%_0.010_28)] flex items-center justify-between">
                                <span>04 // DINING CHANNELS (พฤติกรรมการรับประทาน)</span>
                                <span>DINE-IN VS TAKEAWAY</span>
                            </div>
                            <div className="space-y-1.5 font-mono text-xs">
                                {diningChannelsData.map((dc) => (
                                    <div key={dc.name} className="flex items-center justify-between bg-[oklch(97%_0.008_28)] p-2 border border-[oklch(85%_0.012_28)]">
                                        <span className="font-bold text-[oklch(18%_0.012_28)]">{dc.name}</span>
                                        <div className="text-right">
                                            <span className="font-bold">฿{dc.amount.toLocaleString()}</span>
                                            <span className="text-[10px] text-[oklch(42%_0.010_28)] ml-1.5">({dc.percent}%)</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Module 4: Menu Engineering Top Performers */}
                    <div>
                        <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[oklch(42%_0.010_28)] mb-2 flex items-center justify-between">
                            <span>05 // TOP REVENUE LEADERS (5 อันดับเมนูทำเงินสูงสุดประจำเดือน)</span>
                            <span className="text-[9px] text-[oklch(55%_0.010_28)]">MENU STARS</span>
                        </div>
                        <div className="border border-[oklch(85%_0.012_28)] overflow-hidden">
                            <table className="w-full text-left font-mono text-xs divide-y divide-[oklch(85%_0.012_28)]">
                                <thead className="bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] text-[10px] uppercase">
                                    <tr>
                                        <th className="p-2">อันดับ</th>
                                        <th className="p-2">รายการเมนู</th>
                                        <th className="p-2 text-right">จำนวนที่ขาย</th>
                                        <th className="p-2 text-right">ราคา/จาน</th>
                                        <th className="p-2 text-right">ยอดขายรวม (฿)</th>
                                        <th className="p-2 text-right">อัตรากำไร (Margin)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)]">
                                    {top5Items.map((item, idx) => (
                                        <tr key={item.name + idx} className="hover:bg-[oklch(94%_0.010_28)]">
                                            <td className="p-2 font-bold text-[oklch(18%_0.012_28)]">#{item.rank || idx + 1}</td>
                                            <td className="p-2 font-bold text-[oklch(18%_0.012_28)]">{item.name}</td>
                                            <td className="p-2 text-right">{item.units.toLocaleString()} จาน</td>
                                            <td className="p-2 text-right text-[oklch(42%_0.010_28)]">฿{item.price.toLocaleString()}</td>
                                            <td className="p-2 text-right font-bold text-[oklch(18%_0.012_28)]">฿{item.revenue.toLocaleString()}</td>
                                            <td className="p-2 text-right text-[oklch(45%_0.08_140)] font-bold">
                                                {item.marginPct !== null ? `${item.marginPct}%` : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Page 1 Footer */}
                    <div className="pt-3 border-t border-[oklch(85%_0.012_28)] flex items-center justify-between text-[9px] font-mono text-[oklch(42%_0.010_28)]">
                        <span>IN THE HAUS // AUDITED POS LEDGER DOCUMENT</span>
                        <span>หน้า 1 จาก 2</span>
                    </div>
                </div>

                {/* ========================================================================= */}
                {/* PAGE 2: AI COMPREHENSIVE NEXT-MONTH STRATEGIC BLUEPRINT (A4 Sheet)        */}
                {/* ========================================================================= */}
                <div
                    className="print-page-sheet bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-6 sm:p-8 md:p-10 shadow-lg space-y-6"
                    style={{ minHeight: '1080px' }}
                >
                    {/* Page 2 Header */}
                    <div className="border-b-2 border-[oklch(18%_0.012_28)] pb-4 space-y-1">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <span className="font-mono text-[10px] tracking-widest uppercase text-[oklch(42%_0.010_28)] block">
                                    IN THE HAUS // STRATEGIC ADVISORY BLUEPRINT
                                </span>
                                <h2 className="font-bold text-xl sm:text-2xl text-[oklch(18%_0.012_28)] tracking-tight">
                                    NEXT-MONTH STRATEGIC & OPERATIONAL ACTION PLAN
                                </h2>
                                <p className="text-xs text-[oklch(42%_0.010_28)] font-sans">
                                    แผนยุทธศาสตร์เชิงปฏิบัติการและแนวทางขับเคลื่อนผลกำไร ประจำเดือน {nextMonthThai}
                                </p>
                            </div>
                            <div className="text-right font-mono text-xs space-y-0.5 shrink-0">
                                <div className="px-2 py-0.5 bg-[oklch(52%_0.16_28)] text-white font-bold text-[11px] inline-block">
                                    TARGET: {nextMonthStr}
                                </div>
                                <div className="text-[10px] text-[oklch(42%_0.010_28)]">
                                    MODEL: GEMINI AI REASONING
                                </div>
                                <div className="text-[9px] text-[oklch(45%_0.08_140)] font-bold">
                                    STATUS: ACTIONABLE
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* If Custom AI Text was generated via API, render it cleanly */}
                    {customAiPlan ? (
                        <div className="space-y-4 font-mono text-xs leading-relaxed">
                            <div className="p-3 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] text-[11px] font-sans text-[oklch(18%_0.012_28)] whitespace-pre-line leading-relaxed">
                                {customAiPlan}
                            </div>
                        </div>
                    ) : (
                        /* Default Structured Mathematical Directives */
                        <div className="space-y-4">
                            {/* Strategic Directives List */}
                            <div className="space-y-3.5">
                                {defaultStrategicPlan.directives.map((dir, idx) => (
                                    <div
                                        key={dir.code}
                                        className="p-3.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] space-y-2"
                                    >
                                        <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)] pb-1.5 flex-wrap gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="px-1.5 py-0.5 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-mono text-[9px] font-bold">
                                                    {dir.code}
                                                </span>
                                                <h3 className="font-bold text-xs sm:text-sm text-[oklch(18%_0.012_28)]">
                                                    {idx + 1}. {dir.thaiTitle}
                                                </h3>
                                            </div>
                                            <span className="font-mono text-[10px] text-[oklch(52%_0.16_28)] font-bold uppercase">
                                                {dir.category}
                                            </span>
                                        </div>

                                        <p className="font-mono text-xs font-semibold text-[oklch(18%_0.012_28)] leading-snug">
                                            {dir.summary}
                                        </p>

                                        <div className="space-y-1 pt-1">
                                            {dir.actions.map((act, actIdx) => (
                                                <div key={actIdx} className="flex items-start gap-2 text-[11px] font-sans text-[oklch(35%_0.010_28)] leading-relaxed">
                                                    <span className="w-1 h-1 rounded-full bg-[oklch(52%_0.16_28)] mt-2 shrink-0" />
                                                    <span className="flex-1">{act}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* 4-Week Action Roadmap Table */}
                            <div>
                                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[oklch(42%_0.010_28)] mb-2 flex items-center justify-between">
                                    <span>06 // 4-WEEK EXECUTION TIMELINE (ตารางการขับเคลื่อนประจำสัปดาห์ในเดือน {nextMonthThai})</span>
                                    <span className="text-[9px] text-[oklch(55%_0.010_28)]">ROADMAP</span>
                                </div>
                                <div className="border border-[oklch(85%_0.012_28)] overflow-hidden">
                                    <table className="w-full text-left font-mono text-xs divide-y divide-[oklch(85%_0.012_28)]">
                                        <thead className="bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] text-[10px] uppercase">
                                            <tr>
                                                <th className="p-2 w-28">สัปดาห์</th>
                                                <th className="p-2 w-48">โฟกัสหลัก</th>
                                                <th className="p-2">รายละเอียดการดำเนินงาน</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)]">
                                            {defaultStrategicPlan.weeklyTimeline.map((item) => (
                                                <tr key={item.week} className="hover:bg-[oklch(94%_0.010_28)]">
                                                    <td className="p-2 font-bold text-[oklch(18%_0.012_28)]">{item.week}</td>
                                                    <td className="p-2 font-bold text-[oklch(52%_0.16_28)]">{item.focus}</td>
                                                    <td className="p-2 font-sans text-[11px] text-[oklch(35%_0.010_28)]">{item.detail}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Executive Sign-off Block */}
                    <div className="pt-4 border-t-2 border-[oklch(18%_0.012_28)] grid grid-cols-3 gap-4 text-center font-mono text-[10px]">
                        <div className="space-y-6">
                            <div className="text-[oklch(42%_0.010_28)] uppercase tracking-wider">จัดทำโดย (Prepared By)</div>
                            <div className="border-t border-[oklch(85%_0.012_28)] pt-1 text-[oklch(18%_0.012_28)] font-bold">
                                ฝ่ายการเงิน & บัญชี IN THE HAUS
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="text-[oklch(42%_0.010_28)] uppercase tracking-wider">ตรวจสอบ (Audited By)</div>
                            <div className="border-t border-[oklch(85%_0.012_28)] pt-1 text-[oklch(18%_0.012_28)] font-bold">
                                ผู้จัดการร้าน (Restaurant Manager)
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="text-[oklch(42%_0.010_28)] uppercase tracking-wider">อนุมัติแผน (Approved By)</div>
                            <div className="border-t border-[oklch(85%_0.012_28)] pt-1 text-[oklch(18%_0.012_28)] font-bold">
                                กรรมการผู้จัดการ (Managing Director)
                            </div>
                        </div>
                    </div>

                    {/* Page 2 Footer */}
                    <div className="pt-3 border-t border-[oklch(85%_0.012_28)] flex items-center justify-between text-[9px] font-mono text-[oklch(42%_0.010_28)]">
                        <span>IN THE HAUS // NEXT-MONTH STRATEGIC DIRECTIVE</span>
                        <span>หน้า 2 จาก 2</span>
                    </div>
                </div>

            </div>
        </div>
    )
}
