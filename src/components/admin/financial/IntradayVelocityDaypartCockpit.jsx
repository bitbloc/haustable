/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useMemo, useRef, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { getGeminiApiKey, getGeminiPreferredModel } from '../../../utils/geminiOcrHelper'
import { toast } from 'sonner'

// Helper: Extract Asia/Bangkok hour (0 - 23) reliably
const getBangkokHour = (timeInput) => {
    if (!timeInput) return -1
    try {
        const d = new Date(timeInput)
        const str = d.toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', hour12: false, hour: '2-digit' })
        return parseInt(str, 10)
    } catch {
        return new Date(timeInput).getHours()
    }
}

// Helper: Extract Asia/Bangkok date string (YYYY-MM-DD)
const getBangkokDateStr = (timeInput) => {
    if (!timeInput) return ''
    try {
        const d = new Date(timeInput)
        return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
    } catch {
        return (timeInput || '').split('T')[0]
    }
}

// 4 Standard Restaurant Dayparts
const DAYPARTS = [
    { id: 'lunch', label: 'Lunch Rush', thaiLabel: 'มื้อกลางวัน', hours: [11, 12, 13], rangeText: '11:00 - 14:00', code: 'DP_01' },
    { id: 'afternoon', label: 'Afternoon Downtime', thaiLabel: 'ช่วงบ่ายคาเฟ่', hours: [14, 15, 16], rangeText: '14:00 - 17:00', code: 'DP_02' },
    { id: 'dinner', label: 'Prime Dinner', thaiLabel: 'มื้อค่ำพีค', hours: [17, 18, 19, 20], rangeText: '17:00 - 21:00', code: 'DP_03' },
    { id: 'late', label: 'Late Night Drinks', thaiLabel: 'บาร์และดึก', hours: [21, 22, 23], rangeText: '21:00 - 23:59', code: 'DP_04' }
]

export default function IntradayVelocityDaypartCockpit({
    bookings = [],
    filterMode = 'day', // 'day' | 'month' | 'year'
    selectedDate,
    selectedMonth,
    selectedYear,
    totalSeats = 45,
    loading = false,
    totalExpenses = 0
}) {
    const [hoveredHour, setHoveredHour] = useState(null)
    const [activeSubTab, setActiveSubTab] = useState('chart') // 'chart' | 'dayparts' | 'ad_briefing'
    const [monthViewMode, setMonthViewMode] = useState('pacing') // 'pacing' | 'weekday_weekend' | 'ranking'
    const [adEvents, setAdEvents] = useState([])
    const [aiBriefing, setAiBriefing] = useState(null)
    const [aiLoading, setAiLoading] = useState(false)
    const [copiedBriefing, setCopiedBriefing] = useState(false)
    const containerRef = useRef(null)
    const [containerWidth, setContainerWidth] = useState(800)

    // Operating hours 11:00 to 23:00 (13 slots)
    const hours = useMemo(() => [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23], [])

    // Track dynamic container width for 100% responsive SVG scaling
    useEffect(() => {
        if (!containerRef.current) return
        const updateWidth = () => {
            if (containerRef.current) {
                const w = containerRef.current.clientWidth || containerRef.current.offsetWidth
                if (w > 0) setContainerWidth(w)
            }
        }
        updateWidth()

        if (typeof ResizeObserver !== 'undefined') {
            const ro = new ResizeObserver((entries) => {
                for (let entry of entries) {
                    const w = entry.contentRect.width
                    if (w > 0) setContainerWidth(Math.round(w))
                }
            })
            ro.observe(containerRef.current)
            return () => ro.disconnect()
        } else {
            window.addEventListener('resize', updateWidth)
            return () => window.removeEventListener('resize', updateWidth)
        }
    }, [])

    // Determine current hour & today status in Bangkok time
    const todayBangkok = useMemo(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }), [])
    const isViewingToday = useMemo(() => {
        if (filterMode !== 'day') return false
        return !selectedDate || selectedDate === todayBangkok
    }, [filterMode, selectedDate, todayBangkok])

    const currentBangkokHour = useMemo(() => {
        try {
            return parseInt(
                new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', hour12: false, hour: 'numeric' }),
                10
            )
        } catch {
            return new Date().getHours()
        }
    }, [])

    // Fetch Ad Landing Events for selected date/month
    useEffect(() => {
        let isMounted = true
        async function fetchAdLandingEvents() {
            try {
                let startIso, endIso
                if (filterMode === 'day') {
                    const queryDay = selectedDate || todayBangkok
                    startIso = `${queryDay}T00:00:00+07:00`
                    endIso = `${queryDay}T23:59:59+07:00`
                } else if (filterMode === 'month') {
                    const m = selectedMonth || todayBangkok.slice(0, 7)
                    const [y, mo] = m.split('-')
                    const lastD = String(new Date(parseInt(y, 10), parseInt(mo, 10), 0).getDate()).padStart(2, '0')
                    startIso = `${m}-01T00:00:00+07:00`
                    endIso = `${m}-${lastD}T23:59:59+07:00`
                } else {
                    const y = selectedYear || String(new Date().getFullYear())
                    startIso = `${y}-01-01T00:00:00+07:00`
                    endIso = `${y}-12-31T23:59:59+07:00`
                }

                const { data, error } = await supabase
                    .from('ad_events')
                    .select('*')
                    .gte('created_at', startIso)
                    .lte('created_at', endIso)
                    .order('created_at', { ascending: true })
                    .limit(2000)

                if (!error && data && isMounted) {
                    setAdEvents(data)
                }
            } catch (err) {
                console.warn('[Cockpit] Ad events query fallback:', err?.message)
            }
        }
        fetchAdLandingEvents()
        return () => { isMounted = false }
    }, [filterMode, selectedDate, selectedMonth, selectedYear, todayBangkok])

    // Filter valid revenue-generating orders
    const validOrders = useMemo(() => {
        const validStatuses = ['completed', 'paid', 'success', 'seated', 'confirmed', 'ready']
        return (bookings || []).filter(b => {
            const st = (b.status || '').toLowerCase()
            return validStatuses.includes(st) && st !== 'cancelled' && st !== 'void'
        })
    }, [bookings])

    // =========================================================================
    // 1. DAY MODE COMPUTATION (Intraday Pacing + Traffic + Dayparts)
    // =========================================================================
    const dayMetrics = useMemo(() => {
        if (filterMode !== 'day') return null

        const hourlySales = {}
        const hourlyPax = {}
        const hourlyBills = {}
        hours.forEach(h => {
            hourlySales[h] = 0
            hourlyPax[h] = 0
            hourlyBills[h] = 0
        })

        let totalGross = 0
        let totalGuests = 0

        validOrders.forEach(b => {
            const timeStr = b.booking_time || b.created_at
            if (!timeStr) return
            const h = getBangkokHour(timeStr)

            let billAmt = Number(b.total_amount ?? b.total_price ?? b.deposit_amount ?? 0)
            if (!billAmt && Array.isArray(b.order_items) && b.order_items.length > 0) {
                billAmt = b.order_items.reduce((sum, it) => {
                    const price = Number(it.price_at_time ?? it.menu_items?.price ?? 0)
                    const qty = Number(it.quantity || 1)
                    return sum + (price * qty)
                }, 0)
            }

            const pax = parseInt(b.pax || 1, 10)

            totalGross += billAmt
            totalGuests += pax

            if (hourlySales[h] !== undefined) {
                hourlySales[h] += billAmt
                hourlyPax[h] += pax
                hourlyBills[h] += 1
            }
        })

        // Cumulative pacing curve
        let runningSales = 0
        let runningPax = 0
        const points = hours.map(h => {
            const s = hourlySales[h]
            const p = hourlyPax[h]
            runningSales += s
            runningPax += p
            const spendPerHead = p > 0 ? Math.round(s / p) : 0
            const seatOccupancyPct = Math.round((p / totalSeats) * 100)

            return {
                hour: h,
                label: `${h}.00`,
                sale: s,
                pax: p,
                bills: hourlyBills[h],
                spendPerHead,
                seatOccupancyPct,
                cumulativeSales: runningSales,
                cumulativePax: runningPax
            }
        })

        // Dayparts breakdown
        const daypartBreakdown = DAYPARTS.map(dp => {
            const dpSales = dp.hours.reduce((sum, h) => sum + (hourlySales[h] || 0), 0)
            const dpPax = dp.hours.reduce((sum, h) => sum + (hourlyPax[h] || 0), 0)
            const dpBills = dp.hours.reduce((sum, h) => sum + (hourlyBills[h] || 0), 0)
            const pct = totalGross > 0 ? Math.round((dpSales / totalGross) * 1000) / 10 : 0
            const sph = dpPax > 0 ? Math.round(dpSales / dpPax) : 0
            const hourlyRevVelocity = Math.round(dpSales / dp.hours.length)

            return {
                ...dp,
                sales: dpSales,
                pax: dpPax,
                bills: dpBills,
                percent: pct,
                spendPerHead: sph,
                hourlyVelocity: hourlyRevVelocity
            }
        })

        // Peak Velocity Hour
        const peakHourPoint = points.reduce((max, pt) => (pt.sale > (max?.sale || 0) ? pt : max), null)

        // Ad Intent Leads
        const adHighIntent = adEvents.filter(e => 
            ['click_directions', 'find_location', 'click_phone', 'contact', 'click_line', 'generate_lead', 'click_booking_link', 'click_pickup_link'].includes(e.event_name)
        ).length

        // Target pacing curve benchmark
        const maxCumulative = Math.max(runningSales * 1.25, 20000)
        const curveWeights = [0.03, 0.12, 0.24, 0.30, 0.35, 0.40, 0.50, 0.68, 0.84, 0.93, 0.97, 0.99, 1.0]
        const benchmarkPoints = hours.map((h, idx) => ({
            hour: h,
            expectedCumulative: Math.round(maxCumulative * (curveWeights[idx] || 1))
        }))

        // Forecast for remainder of today
        const cappedHour = isViewingToday ? Math.min(23, Math.max(11, currentBangkokHour)) : 23
        const activePoints = isViewingToday ? points.filter(p => p.hour <= cappedHour) : points
        const latestCumulative = activePoints.length > 0 ? activePoints[activePoints.length - 1].cumulativeSales : 0
        const latestExpected = benchmarkPoints.find(b => b.hour === cappedHour)?.expectedCumulative || 1
        const paceRatio = latestExpected > 0 ? (latestCumulative / latestExpected) : 1.0
        const projectedClosingSales = Math.round(maxCumulative * paceRatio)

        return {
            totalGross,
            totalGuests,
            points,
            activePoints,
            benchmarkPoints,
            daypartBreakdown,
            peakHourPoint,
            adHighIntent,
            projectedClosingSales,
            paceRatio
        }
    }, [filterMode, validOrders, hours, totalSeats, adEvents, isViewingToday, currentBangkokHour])

    // =========================================================================
    // 2. MONTH MODE COMPUTATION (Master Pacing, Weekday vs Weekend, Rankings)
    // =========================================================================
    const monthMetrics = useMemo(() => {
        if (filterMode !== 'month') return null

        const dateMap = {}

        const mStr = selectedMonth || todayBangkok.slice(0, 7)
        const [y, mo] = mStr.split('-')
        const totalDaysInMonth = new Date(parseInt(y, 10), parseInt(mo, 10), 0).getDate()

        for (let d = 1; d <= totalDaysInMonth; d++) {
            const dateStr = `${mStr}-${String(d).padStart(2, '0')}`
            const dObj = new Date(`${dateStr}T12:00:00+07:00`)
            const dayOfWeek = dObj.getDay()
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

            const hSales = {}
            const hPax = {}
            hours.forEach(h => { hSales[h] = 0; hPax[h] = 0 })

            dateMap[dateStr] = {
                date: dateStr,
                dayNumber: d,
                dayOfWeek,
                isWeekend,
                sales: 0,
                pax: 0,
                bills: 0,
                hourlySales: hSales,
                hourlyPax: hPax
            }
        }

        let monthGross = 0
        let monthPax = 0
        let monthBills = 0

        validOrders.forEach(b => {
            const t = b.booking_time || b.created_at
            if (!t) return
            const dateStr = getBangkokDateStr(t)
            if (!dateMap[dateStr]) return

            let billAmt = Number(b.total_amount ?? b.total_price ?? b.deposit_amount ?? 0)
            if (!billAmt && Array.isArray(b.order_items) && b.order_items.length > 0) {
                billAmt = b.order_items.reduce((sum, it) => {
                    const price = Number(it.price_at_time ?? it.menu_items?.price ?? 0)
                    const qty = Number(it.quantity || 1)
                    return sum + (price * qty)
                }, 0)
            }
            const pax = parseInt(b.pax || 1, 10)
            const h = getBangkokHour(t)

            monthGross += billAmt
            monthPax += pax
            monthBills += 1

            dateMap[dateStr].sales += billAmt
            dateMap[dateStr].pax += pax
            dateMap[dateStr].bills += 1

            if (dateMap[dateStr].hourlySales[h] !== undefined) {
                dateMap[dateStr].hourlySales[h] += billAmt
                dateMap[dateStr].hourlyPax[h] += pax
            }
        })

        const daysList = Object.values(dateMap)
        const daysWithSales = daysList.filter(d => d.sales > 0)
        const activeDaysCount = Math.max(1, daysWithSales.length)

        // Calculate Average Hourly Profile across the entire month
        const monthlyAvgHourly = hours.map(h => {
            const totalHourSales = daysList.reduce((sum, d) => sum + (d.hourlySales[h] || 0), 0)
            const totalHourPax = daysList.reduce((sum, d) => sum + (d.hourlyPax[h] || 0), 0)
            const avgSales = Math.round(totalHourSales / activeDaysCount)
            const avgPax = Math.round((totalHourPax / activeDaysCount) * 10) / 10
            return {
                hour: h,
                label: `${h}.00`,
                totalSales: totalHourSales,
                totalPax: totalHourPax,
                avgSales,
                avgPax,
                spendPerHead: totalHourPax > 0 ? Math.round(totalHourSales / totalHourPax) : 0,
                occupancyPct: Math.round((avgPax / totalSeats) * 100)
            }
        })

        // Monthly Master Cumulative Pacing Curve (Typical Day)
        let cumulAvg = 0
        const monthlyMasterPacing = monthlyAvgHourly.map(pt => {
            cumulAvg += pt.avgSales
            return {
                ...pt,
                cumulativeAvgSales: cumulAvg
            }
        })

        // Weekdays vs Weekends Curves
        const weekdayDays = daysList.filter(d => !d.isWeekend && d.sales > 0)
        const weekendDays = daysList.filter(d => d.isWeekend && d.sales > 0)
        const weekdayCount = Math.max(1, weekdayDays.length)
        const weekendCount = Math.max(1, weekendDays.length)

        let runningWeekdayCumul = 0
        let runningWeekendCumul = 0

        const weekdayWeekendCurve = hours.map(h => {
            const weekdayHourSales = weekdayDays.reduce((sum, d) => sum + (d.hourlySales[h] || 0), 0)
            const weekendHourSales = weekendDays.reduce((sum, d) => sum + (d.hourlySales[h] || 0), 0)

            const weekdayAvg = Math.round(weekdayHourSales / weekdayCount)
            const weekendAvg = Math.round(weekendHourSales / weekendCount)

            runningWeekdayCumul += weekdayAvg
            runningWeekendCumul += weekendAvg

            return {
                hour: h,
                label: `${h}.00`,
                weekdayAvg,
                weekendAvg,
                weekdayCumulative: runningWeekdayCumul,
                weekendCumulative: runningWeekendCumul
            }
        })

        // Monthly 4 Dayparts Summary
        const monthlyDayparts = DAYPARTS.map(dp => {
            let dpSales = 0
            let dpPax = 0
            dp.hours.forEach(h => {
                dpSales += daysList.reduce((sum, d) => sum + (d.hourlySales[h] || 0), 0)
                dpPax += daysList.reduce((sum, d) => sum + (d.hourlyPax[h] || 0), 0)
            })

            const pct = monthGross > 0 ? Math.round((dpSales / monthGross) * 1000) / 10 : 0
            const sph = dpPax > 0 ? Math.round(dpSales / dpPax) : 0
            const totalOpHours = dp.hours.length * activeDaysCount
            const hourlyVelocity = totalOpHours > 0 ? Math.round(dpSales / totalOpHours) : 0

            return {
                ...dp,
                sales: dpSales,
                pax: dpPax,
                percent: pct,
                spendPerHead: sph,
                hourlyVelocity
            }
        })

        // Daily Velocity Ranking (Top Days vs Slow Days)
        const rankedDays = [...daysWithSales].sort((a, b) => b.sales - a.sales)
        const topDays = rankedDays.slice(0, 5)
        const slowDays = [...daysWithSales].sort((a, b) => a.sales - b.sales).slice(0, 3)

        // Estimated Daily Break-Even Hour (from Total Expenses)
        const dailyExpenseTarget = totalExpenses > 0 ? Math.round(totalExpenses / activeDaysCount) : 15000
        const breakEvenPoint = monthlyMasterPacing.find(p => p.cumulativeAvgSales >= dailyExpenseTarget)

        return {
            monthGross,
            monthPax,
            monthBills,
            activeDaysCount,
            totalDaysInMonth,
            monthlyAvgHourly,
            monthlyMasterPacing,
            weekdayWeekendCurve,
            monthlyDayparts,
            daysList,
            topDays,
            slowDays,
            dailyExpenseTarget,
            breakEvenHour: breakEvenPoint ? `${breakEvenPoint.hour}:00` : null
        }
    }, [filterMode, validOrders, selectedMonth, todayBangkok, hours, totalSeats, totalExpenses])

    // =========================================================================
    // 3. AI STRATEGY BRIEFING (Gemini Integration)
    // =========================================================================
    const generateAiBriefing = async () => {
        setAiLoading(true)
        try {
            const apiKey = getGeminiApiKey()
            if (!apiKey) {
                toast.error('ไม่พบ Gemini API Key กรุณาตั้งค่าในระบบก่อน')
                setAiLoading(false)
                return
            }

            const model = getGeminiPreferredModel() || 'gemini-1.5-flash'
            const isMonth = filterMode === 'month'

            const promptText = isMonth
                ? `วิเคราะห์ความเร็วของยอดขายและทราฟฟิก (Monthly Daypart & Velocity Diagnostic) สำหรับร้านอาหาร In The Haus ประจำเดือน ${selectedMonth}:
- ยอดขายรวมทั้งเดือน: ฿${monthMetrics?.monthGross.toLocaleString()} (${monthMetrics?.monthPax} ท่าน)
- สัดส่วน 4 Dayparts: 
  * Lunch (11-14): ฿${monthMetrics?.monthlyDayparts[0]?.sales.toLocaleString()} (${monthMetrics?.monthlyDayparts[0]?.percent}%) ความเร็ว ฿${monthMetrics?.monthlyDayparts[0]?.hourlyVelocity}/ชม.
  * Afternoon (14-17): ฿${monthMetrics?.monthlyDayparts[1]?.sales.toLocaleString()} (${monthMetrics?.monthlyDayparts[1]?.percent}%) ความเร็ว ฿${monthMetrics?.monthlyDayparts[1]?.hourlyVelocity}/ชม.
  * Dinner (17-21): ฿${monthMetrics?.monthlyDayparts[2]?.sales.toLocaleString()} (${monthMetrics?.monthlyDayparts[2]?.percent}%) ความเร็ว ฿${monthMetrics?.monthlyDayparts[2]?.hourlyVelocity}/ชม.
  * Late (21-24): ฿${monthMetrics?.monthlyDayparts[3]?.sales.toLocaleString()} (${monthMetrics?.monthlyDayparts[3]?.percent}%) ความเร็ว ฿${monthMetrics?.monthlyDayparts[3]?.hourlyVelocity}/ชม.
- จุดคุ้มทุนเฉลี่ยรายวัน: ${monthMetrics?.breakEvenHour || 'ช่วงค่ำ'}

กรุณาสรุปข้อสังเกตเชิงยุทธศาสตร์ 3 ข้อสั้นกระชับ: 
1. ช่วงเวลาที่ทำเงินสูงสุดและโอกาสเพิ่มยอด (Daypart Revenue Optimization)
2. การบริหารกะพนักงานและต้นทุนแรงงานตามความเร็วของเงิน (Labor vs Velocity)
3. กลยุทธ์กระตุ้นช่วงบ่ายหรือช่วงชะลอตัว (Actionable Tactic)`
                : `วิเคราะห์ความเร็วยอดขายและทราฟฟิกแบบ Intraday ประจำวันที่ ${selectedDate || todayBangkok}:
- ยอดขายสะสมปัจจุบัน: ฿${dayMetrics?.totalGross.toLocaleString()} จากเป้าหมายปิดวันคาดการณ์ ฿${dayMetrics?.projectedClosingSales.toLocaleString()}
- จำนวนลูกค้าสะสม: ${dayMetrics?.totalGuests} ท่าน (ความเร่งเทียบ Baseline: ${dayMetrics?.paceRatio ? Math.round(dayMetrics.paceRatio * 100) : 100}%)
- สัญญาณคนค้นหาเส้นทาง/ทัก LINE/โทรศัพท์: ${dayMetrics?.adHighIntent} ครั้ง
- ชั่วโมงที่มียอดขายสูงสุด: ${dayMetrics?.peakHourPoint ? `${dayMetrics.peakHourPoint.hour}:00 (฿${dayMetrics.peakHourPoint.sale.toLocaleString()})` : '—'}

กรุณาสรุปคำแนะนำเชิงปฏิบัติการ 3 ข้อสำหรับผู้จัดการร้านในกะวันนี้:
1. การเตรียมสต็อกและโต๊ะสำหรับช่วงเวลาถัดไป
2. การจัดสรรพนักงานหน้าร้าน
3. ยุทธวิธีผลักดันยอดขายปิดบิลให้ถึงเป้า`

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                    generationConfig: { maxOutputTokens: 500, temperature: 0.3 }
                })
            })

            const result = await response.json()
            const textOutput = result.candidates?.[0]?.content?.parts?.[0]?.text
            if (textOutput) {
                setAiBriefing(textOutput)
                toast.success('วิเคราะห์บทวิเคราะห์กลยุทธ์เรียบร้อยแล้ว')
            } else {
                throw new Error('No text generated')
            }
        } catch (err) {
            console.error('AI Briefing error:', err)
            toast.error('ไม่สามารถเรียก AI วิเคราะห์ได้: ' + (err.message || 'เครือข่ายขัดข้อง'))
        } finally {
            setAiLoading(false)
        }
    }

    const copyBriefingToClipboard = () => {
        if (!aiBriefing) return
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(aiBriefing)
            setCopiedBriefing(true)
            toast.success('คัดลอกบทวิเคราะห์กลยุทธ์แล้ว')
            setTimeout(() => setCopiedBriefing(false), 2000)
        }
    }

    // =========================================================================
    // 4. SVG RENDER DIMENSIONS & UTILITIES
    // =========================================================================
    const isMobile = containerWidth < 560
    const svgWidth = Math.max(320, containerWidth)
    const svgHeight = isMobile ? 240 : 280
    const padLeft = isMobile ? 40 : 54
    const padRight = isMobile ? 16 : 24
    const padYTop = isMobile ? 24 : 30
    const padYBottom = isMobile ? 32 : 36
    const plotWidth = Math.max(svgWidth - padLeft - padRight, 200)
    const plotHeight = Math.max(svgHeight - padYTop - padYBottom, 120)

    const getX = (hour) => {
        const idx = hours.indexOf(hour)
        if (idx === -1) return padLeft
        return padLeft + (idx / (hours.length - 1)) * plotWidth
    }

    // Thai Modern Colors
    const colorInk = 'oklch(18% 0.012 28)'
    const colorPaper2 = 'oklch(94% 0.010 28)'
    const colorRule = 'oklch(85% 0.012 28)'
    const colorNeutral = 'oklch(55% 0.010 28)'
    const colorMuted = 'oklch(42% 0.010 28)'
    const colorAccent = 'oklch(52% 0.16 28)' // Terracotta
    const colorAccent2 = 'oklch(45% 0.08 140)' // Banana-Leaf Green

    return (
        <div ref={containerRef} className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] divide-y divide-[oklch(85%_0.012_28)] font-sans text-[oklch(18%_0.012_28)]">
            
            {/* Header Toolbar: Title, Badges & View Switcher */}
            <div className="p-4 md:p-5 bg-[oklch(94%_0.010_28)] flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] uppercase tracking-widest">
                            {filterMode === 'month' ? 'MONTHLY PACING // 05' : 'INTRADAY VELOCITY // 01'}
                        </span>
                        <h3 className="font-bold text-base md:text-lg text-[oklch(18%_0.012_28)]">
                            {filterMode === 'month'
                                ? `ความเร็วยอดขายและทราฟฟิกแยกช่วงเวลา (Monthly Daypart & Velocity)`
                                : `ความเร็วยอดขายและทราฟฟิกลูกค้า (Intraday Traffic & Sales Velocity)`}
                        </h3>
                        {filterMode === 'day' && isViewingToday && (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 font-bold border bg-[oklch(97%_0.008_28)] text-[oklch(45%_0.08_140)] border-[oklch(45%_0.08_140)]/40">
                                <span className="w-1.5 h-1.5 rounded-full bg-[oklch(45%_0.08_140)] animate-pulse" />
                                LIVE PACING
                            </span>
                        )}
                        {filterMode === 'month' && (
                            <span className="text-[10px] font-mono px-2 py-0.5 bg-[oklch(97%_0.008_28)] text-[oklch(42%_0.010_28)] font-bold border border-[oklch(85%_0.012_28)]">
                                {monthMetrics?.activeDaysCount || 0} วันทำการในเดือน
                            </span>
                        )}
                    </div>
                    <p className="text-xs font-mono text-[oklch(42%_0.010_28)] mt-1">
                        {filterMode === 'month'
                            ? `วิเคราะห์แนวโน้มความเร็วเฉลี่ยรายชั่วโมง และสัดส่วน 4 Dayparts ประจำเดือน ${selectedMonth || todayBangkok.slice(0, 7)}`
                            : `ผสานสถิติความเร็วยอดขายสะสมรายชั่วโมง (฿) คู่กับจำนวนแขกและอัตราครองโต๊ะ (Pax)`}
                    </p>
                </div>

                {/* Sub-Tabs Action Ribbon */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    {filterMode === 'month' ? (
                        <div className="inline-flex border border-[oklch(85%_0.012_28)] divide-x divide-[oklch(85%_0.012_28)] font-mono text-xs">
                            {[
                                { id: 'pacing', label: 'เส้นความเร็วเฉลี่ย [PACING]' },
                                { id: 'weekday_weekend', label: 'จันทร์-ศุกร์ VS เสาร์-อาทิตย์' },
                                { id: 'ranking', label: 'จัดอันดับวัน [RANKING]' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setMonthViewMode(tab.id)}
                                    className={`px-3 py-1.5 font-bold transition-colors ${
                                        monthViewMode === tab.id
                                            ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]'
                                            : 'bg-[oklch(97%_0.008_28)] text-[oklch(42%_0.010_28)] hover:bg-[oklch(94%_0.010_28)]'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="inline-flex border border-[oklch(85%_0.012_28)] divide-x divide-[oklch(85%_0.012_28)] font-mono text-xs">
                            {[
                                { id: 'chart', label: 'กราฟรวม [COCKPIT]' },
                                { id: 'dayparts', label: '4 ช่วงเวลา [DAYPARTS]' },
                                { id: 'ad_briefing', label: 'AI กลยุทธ์ [BRIEFING]' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveSubTab(tab.id)}
                                    className={`px-3 py-1.5 font-bold transition-colors ${
                                        activeSubTab === tab.id
                                            ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]'
                                            : 'bg-[oklch(97%_0.008_28)] text-[oklch(42%_0.010_28)] hover:bg-[oklch(94%_0.010_28)]'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={generateAiBriefing}
                        disabled={aiLoading}
                        className="px-3 py-1.5 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(28%_0.012_28)] text-[oklch(97%_0.008_28)] font-mono text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50"
                    >
                        <span>{aiLoading ? 'กำลังประมวลผล…' : 'AI สรุปกลยุทธ์ [AI]'}</span>
                    </button>
                </div>
            </div>

            {/* AI Briefing Alert Box (Expandable) */}
            {aiBriefing && (
                <div className="p-4 bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-mono text-xs font-bold text-[oklch(52%_0.16_28)]">
                            <span className="w-2 h-2 rounded-full bg-[oklch(52%_0.16_28)]" />
                            <span>EXECUTIVE AI STRATEGY BRIEFING // {filterMode === 'month' ? `ประจำเดือน ${selectedMonth}` : 'คำแนะนำสำหรับกะนี้'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={copyBriefingToClipboard}
                                className="font-mono text-xs font-bold text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)] bg-[oklch(97%_0.008_28)] px-2.5 py-1 border border-[oklch(85%_0.012_28)]"
                            >
                                {copiedBriefing ? '[คัดลอกแล้ว]' : 'คัดลอกข้อความ [COPY]'}
                            </button>
                            <button
                                onClick={() => setAiBriefing(null)}
                                className="font-mono text-xs text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)] px-1.5"
                            >
                                ✕ ปิด
                            </button>
                        </div>
                    </div>
                    <div className="text-xs text-[oklch(18%_0.012_28)] whitespace-pre-line leading-relaxed font-sans bg-[oklch(97%_0.008_28)] p-3 border border-[oklch(85%_0.012_28)]">
                        {aiBriefing}
                    </div>
                </div>
            )}

            {/* Core KPI Metrics Grid (Dieter Rams 4-Cell Structural Bar) */}
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)]">
                {filterMode === 'month' ? (
                    <>
                        <div className="p-4 space-y-1">
                            <div className="text-[10px] font-mono font-bold text-[oklch(42%_0.010_28)]">01 // MONTHLY REVENUE</div>
                            <div className="font-mono text-xl md:text-2xl font-bold tracking-tight text-[oklch(18%_0.012_28)]">
                                ฿{monthMetrics?.monthGross.toLocaleString()}
                            </div>
                            <div className="text-[11px] font-mono text-[oklch(42%_0.010_28)]">
                                เฉลี่ย ฿{monthMetrics ? Math.round(monthMetrics.monthGross / monthMetrics.activeDaysCount).toLocaleString() : 0} / วัน
                            </div>
                        </div>

                        <div className="p-4 space-y-1">
                            <div className="text-[10px] font-mono font-bold text-[oklch(42%_0.010_28)]">02 // MONTHLY TRAFFIC</div>
                            <div className="font-mono text-xl md:text-2xl font-bold tracking-tight text-[oklch(52%_0.16_28)]">
                                {monthMetrics?.monthPax.toLocaleString()} ท่าน
                            </div>
                            <div className="text-[11px] font-mono text-[oklch(42%_0.010_28)]">
                                เฉลี่ย {monthMetrics ? Math.round(monthMetrics.monthPax / monthMetrics.activeDaysCount) : 0} ท่าน / วัน
                            </div>
                        </div>

                        <div className="p-4 space-y-1">
                            <div className="text-[10px] font-mono font-bold text-[oklch(42%_0.010_28)]">03 // BREAK-EVEN HOUR</div>
                            <div className="font-mono text-xl md:text-2xl font-bold tracking-tight text-[oklch(45%_0.08_140)]">
                                {monthMetrics?.breakEvenHour || '—'}
                            </div>
                            <div className="text-[11px] font-mono text-[oklch(42%_0.010_28)]">
                                เวลาคุ้มทุนรายวันเฉลี่ย (เป้า ฿{monthMetrics?.dailyExpenseTarget.toLocaleString()})
                            </div>
                        </div>

                        <div className="p-4 space-y-1">
                            <div className="text-[10px] font-mono font-bold text-[oklch(42%_0.010_28)]">04 // TOP DAYPART SHARE</div>
                            <div className="font-mono text-xl md:text-2xl font-bold tracking-tight text-[oklch(18%_0.012_28)]">
                                {monthMetrics?.monthlyDayparts?.reduce((max, dp) => dp.sales > (max?.sales || 0) ? dp : max, null)?.label || '—'}
                            </div>
                            <div className="text-[11px] font-mono text-[oklch(42%_0.010_28)]">
                                สัดส่วน {monthMetrics?.monthlyDayparts?.reduce((max, dp) => dp.sales > (max?.sales || 0) ? dp : max, null)?.percent || 0}% ของยอดทั้งเดือน
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="p-4 space-y-1">
                            <div className="text-[10px] font-mono font-bold text-[oklch(42%_0.010_28)]">01 // CUMULATIVE SALES</div>
                            <div className="font-mono text-xl md:text-2xl font-bold tracking-tight text-[oklch(18%_0.012_28)]">
                                ฿{dayMetrics?.totalGross.toLocaleString()}
                            </div>
                            <div className="text-[11px] font-mono text-[oklch(42%_0.010_28)]">
                                คาดการณ์ปิดวัน: ~฿{dayMetrics?.projectedClosingSales.toLocaleString()}
                            </div>
                        </div>

                        <div className="p-4 space-y-1">
                            <div className="text-[10px] font-mono font-bold text-[oklch(42%_0.010_28)]">02 // GUEST TRAFFIC</div>
                            <div className="font-mono text-xl md:text-2xl font-bold tracking-tight text-[oklch(52%_0.16_28)]">
                                {dayMetrics?.totalGuests} ท่าน
                            </div>
                            <div className="text-[11px] font-mono text-[oklch(42%_0.010_28)]">
                                ใช้ความจุร้าน: ~{Math.round((dayMetrics?.totalGuests / (totalSeats * 2)) * 100)}% (รอบหมุนโต๊ะ)
                            </div>
                        </div>

                        <div className="p-4 space-y-1">
                            <div className="text-[10px] font-mono font-bold text-[oklch(42%_0.010_28)]">03 // VELOCITY SPEED</div>
                            <div className="font-mono text-xl md:text-2xl font-bold tracking-tight text-[oklch(18%_0.012_28)]">
                                ฿{dayMetrics?.peakHourPoint ? dayMetrics.peakHourPoint.sale.toLocaleString() : 0}
                            </div>
                            <div className="text-[11px] font-mono text-[oklch(42%_0.010_28)]">
                                พีคสุด: {dayMetrics?.peakHourPoint ? `${dayMetrics.peakHourPoint.hour}:00` : '—'}
                            </div>
                        </div>

                        <div className="p-4 space-y-1">
                            <div className="text-[10px] font-mono font-bold text-[oklch(42%_0.010_28)]">04 // AD & SEARCH INTENT</div>
                            <div className="font-mono text-xl md:text-2xl font-bold tracking-tight text-[oklch(45%_0.08_140)]">
                                {dayMetrics?.adHighIntent} สัญญาณ
                            </div>
                            <div className="text-[11px] font-mono text-[oklch(42%_0.010_28)]">
                                แผนที่ / โทร / จอง / รับอาหาร
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ========================================================================= */}
            {/* 5. MAIN SVG GRAPH VIEWPORT (Responsive Dual-Layer Engine)                   */}
            {/* ========================================================================= */}
            <div className="p-4 md:p-6 bg-[oklch(97%_0.008_28)] relative">
                
                {/* Visual Legend */}
                <div className="flex items-center justify-between gap-3 text-xs font-mono mb-4 flex-wrap">
                    <div className="flex items-center gap-4 flex-wrap">
                        {filterMode === 'month' && monthViewMode === 'weekday_weekend' ? (
                            <>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3.5 h-1 bg-[oklch(52%_0.16_28)]" />
                                    <span className="text-[oklch(18%_0.012_28)] font-bold">วันจันทร์-ศุกร์ (Weekdays Avg)</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3.5 h-1 bg-[oklch(45%_0.08_140)]" />
                                    <span className="text-[oklch(18%_0.012_28)] font-bold">วันเสาร์-อาทิตย์ (Weekends Avg)</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3 h-3 bg-[oklch(52%_0.16_28)]" />
                                    <span className="text-[oklch(18%_0.012_28)] font-bold">
                                        {filterMode === 'month' ? 'ยอดขายเฉลี่ยรายชม. (฿)' : 'ลูกค้าจริง (Pax)'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3.5 h-1 bg-[oklch(18%_0.012_28)]" />
                                    <span className="text-[oklch(18%_0.012_28)] font-bold">
                                        {filterMode === 'month' ? 'เส้นสะสมเฉลี่ยต่อวัน (฿)' : 'ความเร็วยอดขายสะสม (฿)'}
                                    </span>
                                </div>
                                {filterMode === 'day' && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-3.5 h-0.5 border-t border-dashed border-[oklch(55%_0.010_28)]" />
                                        <span className="text-[oklch(42%_0.010_28)]">เกณฑ์เป้าหมาย (Benchmark)</span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="text-[11px] text-[oklch(42%_0.010_28)]">
                        ช่วงเวลาเปิดบริการ 11:00 - 23:00 // 4 Dayparts
                    </div>
                </div>

                {/* SVG Canvas */}
                <div className="w-full overflow-x-auto no-scrollbar">
                    {(() => {
                        let maxSalesVal = 1000
                        let maxPaxVal = 20

                        if (filterMode === 'month') {
                            if (monthViewMode === 'weekday_weekend') {
                                const maxCumul = Math.max(
                                    ...monthMetrics?.weekdayWeekendCurve.map(p => Math.max(p.weekdayCumulative, p.weekendCumulative)) || [10000]
                                )
                                maxSalesVal = Math.max(maxCumul * 1.1, 5000)
                            } else {
                                const maxCumul = Math.max(...monthMetrics?.monthlyMasterPacing.map(p => p.cumulativeAvgSales) || [10000])
                                maxSalesVal = Math.max(maxCumul * 1.1, 5000)
                                maxPaxVal = Math.max(...monthMetrics?.monthlyAvgHourly.map(p => p.avgPax) || [10], 15)
                            }
                        } else {
                            const maxCumul = Math.max(
                                dayMetrics?.totalGross || 0,
                                dayMetrics?.projectedClosingSales || 0,
                                ...dayMetrics?.benchmarkPoints.map(p => p.expectedCumulative) || [10000]
                            )
                            maxSalesVal = Math.max(maxCumul * 1.1, 10000)
                            maxPaxVal = Math.max(...dayMetrics?.points.map(p => p.pax) || [10], totalSeats * 0.75, 20)
                        }

                        const getYMoney = (val) => {
                            const ratio = Math.min(1, Math.max(0, val / maxSalesVal))
                            return padYTop + (1 - ratio) * plotHeight
                        }

                        const getYBarHeight = (val, maxVal) => {
                            const ratio = Math.min(1, Math.max(0, val / maxVal))
                            return ratio * plotHeight
                        }

                        return (
                            <svg
                                width={svgWidth}
                                height={svgHeight}
                                className="overflow-visible select-none"
                            >
                                {/* 1. Daypart Background Bands */}
                                {DAYPARTS.map((dp, idx) => {
                                    const startX = getX(dp.hours[0]) - (plotWidth / (hours.length - 1)) * 0.45
                                    const endX = getX(dp.hours[dp.hours.length - 1]) + (plotWidth / (hours.length - 1)) * 0.45
                                    const bandWidth = Math.max(10, endX - startX)
                                    const isAlt = idx % 2 === 1

                                    return (
                                        <g key={dp.id}>
                                            <rect
                                                x={startX}
                                                y={padYTop}
                                                width={bandWidth}
                                                height={plotHeight}
                                                fill={isAlt ? 'oklch(94% 0.010 28)' : 'transparent'}
                                                opacity="0.6"
                                            />
                                            <text
                                                x={startX + 6}
                                                y={padYTop - 8}
                                                fontSize="9"
                                                fontFamily="monospace"
                                                fontWeight="bold"
                                                fill={colorMuted}
                                            >
                                                {dp.label.toUpperCase()} ({dp.rangeText.split(' - ')[0]})
                                            </text>
                                            {idx > 0 && (
                                                <line
                                                    x1={startX}
                                                    y1={padYTop}
                                                    x2={startX}
                                                    y2={padYTop + plotHeight}
                                                    stroke={colorRule}
                                                    strokeWidth="1"
                                                    strokeDasharray="2 2"
                                                />
                                            )}
                                        </g>
                                    )
                                })}

                                {/* 2. Horizontal Gridlines (Money Axis) */}
                                {[0, 0.25, 0.5, 0.75, 1.0].map((step, idx) => {
                                    const y = padYTop + (1 - step) * plotHeight
                                    const val = Math.round(maxSalesVal * step)
                                    return (
                                        <g key={idx}>
                                            <line
                                                x1={padLeft}
                                                y1={y}
                                                x2={padLeft + plotWidth}
                                                y2={y}
                                                stroke={colorRule}
                                                strokeWidth="1"
                                            />
                                            <text
                                                x={padLeft - 6}
                                                y={y + 3}
                                                textAnchor="end"
                                                fontSize="9"
                                                fontFamily="monospace"
                                                fill={colorMuted}
                                            >
                                                {val >= 1000 ? `${Math.round(val / 1000)}k` : val}
                                            </text>
                                        </g>
                                    )
                                })}

                                {/* 3. Month Mode: Weekday vs Weekend Dual Curves */}
                                {filterMode === 'month' && monthViewMode === 'weekday_weekend' && (
                                    <>
                                        {/* Weekdays Curve (Orange) */}
                                        {(() => {
                                            const pts = monthMetrics?.weekdayWeekendCurve || []
                                            const pathD = pts.reduce((acc, p, i) => {
                                                const x = getX(p.hour)
                                                const y = getYMoney(p.weekdayCumulative)
                                                return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`
                                            }, '')
                                            return (
                                                <path
                                                    d={pathD}
                                                    fill="none"
                                                    stroke={colorAccent}
                                                    strokeWidth="2.5"
                                                    strokeLinecap="round"
                                                />
                                            )
                                        })()}

                                        {/* Weekends Curve (Green) */}
                                        {(() => {
                                            const pts = monthMetrics?.weekdayWeekendCurve || []
                                            const pathD = pts.reduce((acc, p, i) => {
                                                const x = getX(p.hour)
                                                const y = getYMoney(p.weekendCumulative)
                                                return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`
                                            }, '')
                                            return (
                                                <path
                                                    d={pathD}
                                                    fill="none"
                                                    stroke={colorAccent2}
                                                    strokeWidth="2.5"
                                                    strokeLinecap="round"
                                                />
                                            )
                                        })()}
                                    </>
                                )}

                                {/* 4. Standard Bars Layer (Pax in Day Mode / Hourly Sales in Month Mode) */}
                                {filterMode === 'month' && monthViewMode !== 'weekday_weekend' && (
                                    monthMetrics?.monthlyAvgHourly.map((pt) => {
                                        const x = getX(pt.hour)
                                        const barH = getYBarHeight(pt.avgSales, Math.max(...monthMetrics.monthlyAvgHourly.map(p => p.avgSales) || [1000], 1000))
                                        const isHovered = hoveredHour === pt.hour
                                        return (
                                            <rect
                                                key={pt.hour}
                                                x={x - 8}
                                                y={padYTop + plotHeight - barH}
                                                width={16}
                                                height={barH}
                                                fill={isHovered ? colorAccent : 'oklch(85% 0.012 28)'}
                                                className="transition-colors duration-150 cursor-pointer"
                                                onMouseEnter={() => setHoveredHour(pt.hour)}
                                                onMouseLeave={() => setHoveredHour(null)}
                                            />
                                        )
                                    })
                                )}

                                {filterMode === 'day' && (
                                    dayMetrics?.points.map((pt) => {
                                        const x = getX(pt.hour)
                                        const barH = getYBarHeight(pt.pax, maxPaxVal)
                                        const isHovered = hoveredHour === pt.hour
                                        const isPeak = dayMetrics.peakHourPoint?.hour === pt.hour
                                        return (
                                            <rect
                                                key={pt.hour}
                                                x={x - 7}
                                                y={padYTop + plotHeight - barH}
                                                width={14}
                                                height={barH}
                                                fill={
                                                    isHovered
                                                        ? colorAccent
                                                        : isPeak
                                                        ? colorAccent
                                                        : pt.pax > 0
                                                        ? 'oklch(80% 0.03 28)'
                                                        : 'oklch(90% 0.01 28)'
                                                }
                                                className="transition-colors duration-150 cursor-pointer"
                                                onMouseEnter={() => setHoveredHour(pt.hour)}
                                                onMouseLeave={() => setHoveredHour(null)}
                                            />
                                        )
                                    })
                                )}

                                {/* 5. Cumulative Curve (Line) */}
                                {filterMode === 'day' && (
                                    <>
                                        {/* Benchmark Dotted Curve */}
                                        {(() => {
                                            const bpts = dayMetrics?.benchmarkPoints || []
                                            const pathD = bpts.reduce((acc, p, i) => {
                                                const x = getX(p.hour)
                                                const y = getYMoney(p.expectedCumulative)
                                                return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`
                                            }, '')
                                            return (
                                                <path
                                                    d={pathD}
                                                    fill="none"
                                                    stroke={colorNeutral}
                                                    strokeWidth="1.5"
                                                    strokeDasharray="4 4"
                                                />
                                            )
                                        })()}

                                        {/* Actual Cumulative Curve */}
                                        {(() => {
                                            const acts = dayMetrics?.activePoints || []
                                            if (acts.length === 0) return null
                                            const pathD = acts.reduce((acc, p, i) => {
                                                const x = getX(p.hour)
                                                const y = getYMoney(p.cumulativeSales)
                                                return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`
                                            }, '')
                                            return (
                                                <path
                                                    d={pathD}
                                                    fill="none"
                                                    stroke={colorInk}
                                                    strokeWidth="2.5"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            )
                                        })()}
                                    </>
                                )}

                                {filterMode === 'month' && monthViewMode === 'pacing' && (
                                    <>
                                        {/* Monthly Master Cumulative Curve */}
                                        {(() => {
                                            const pts = monthMetrics?.monthlyMasterPacing || []
                                            const pathD = pts.reduce((acc, p, i) => {
                                                const x = getX(p.hour)
                                                const y = getYMoney(p.cumulativeAvgSales)
                                                return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`
                                            }, '')
                                            return (
                                                <path
                                                    d={pathD}
                                                    fill="none"
                                                    stroke={colorInk}
                                                    strokeWidth="2.5"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            )
                                        })()}
                                    </>
                                )}

                                {/* 6. Hour Markers on X Axis */}
                                {hours.map((h) => {
                                    const x = getX(h)
                                    const isHovered = hoveredHour === h
                                    return (
                                        <g key={h}>
                                            <line
                                                x1={x}
                                                y1={padYTop + plotHeight}
                                                x2={x}
                                                y2={padYTop + plotHeight + 5}
                                                stroke={colorRule}
                                                strokeWidth="1"
                                            />
                                            <text
                                                x={x}
                                                y={padYTop + plotHeight + 18}
                                                textAnchor="middle"
                                                fontSize="10"
                                                fontFamily="monospace"
                                                fontWeight={isHovered ? 'bold' : 'normal'}
                                                fill={isHovered ? colorAccent : colorMuted}
                                            >
                                                {h}:00
                                            </text>
                                        </g>
                                    )
                                })}

                                {/* 7. Hover Inspector Overlay */}
                                {hoveredHour !== null && (
                                    <g>
                                        <line
                                            x1={getX(hoveredHour)}
                                            y1={padYTop}
                                            x2={getX(hoveredHour)}
                                            y2={padYTop + plotHeight}
                                            stroke={colorInk}
                                            strokeWidth="1"
                                            strokeDasharray="2 2"
                                        />
                                        <circle
                                            cx={getX(hoveredHour)}
                                            cy={getYMoney(
                                                filterMode === 'month'
                                                    ? monthMetrics?.monthlyMasterPacing?.find(p => p.hour === hoveredHour)?.cumulativeAvgSales || 0
                                                    : dayMetrics?.points?.find(p => p.hour === hoveredHour)?.cumulativeSales || 0
                                            )}
                                            r="4.5"
                                            fill={colorAccent}
                                            stroke={colorPaper2}
                                            strokeWidth="2"
                                        />
                                    </g>
                                )}
                            </svg>
                        )
                    })()}
                </div>

                {/* Live Synchronized Tooltip Box */}
                {hoveredHour !== null && (
                    <div className="mt-3 p-3 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] font-mono text-xs flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold">
                                {hoveredHour}:00 - {hoveredHour + 1}:00
                            </span>
                            <span className="text-[oklch(42%_0.010_28)]">
                                {DAYPARTS.find(d => d.hours.includes(hoveredHour))?.label || ''}
                            </span>
                        </div>
                        {filterMode === 'month' ? (
                            <div className="flex items-center gap-4 flex-wrap">
                                <div>
                                    <span className="text-[oklch(42%_0.010_28)]">ยอดขายเฉลี่ยชั่วโมงนี้: </span>
                                    <span className="font-bold text-[oklch(18%_0.012_28)]">
                                        ฿{monthMetrics?.monthlyAvgHourly?.find(p => p.hour === hoveredHour)?.avgSales.toLocaleString()}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[oklch(42%_0.010_28)]">ลูกค้าเฉลี่ย: </span>
                                    <span className="font-bold text-[oklch(52%_0.16_28)]">
                                        {monthMetrics?.monthlyAvgHourly?.find(p => p.hour === hoveredHour)?.avgPax} ท่าน
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[oklch(42%_0.010_28)]">ยอดสะสมเฉลี่ยสิ้นชม.: </span>
                                    <span className="font-bold text-[oklch(18%_0.012_28)]">
                                        ฿{monthMetrics?.monthlyMasterPacing?.find(p => p.hour === hoveredHour)?.cumulativeAvgSales.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-4 flex-wrap">
                                <div>
                                    <span className="text-[oklch(42%_0.010_28)]">ยอดขายชั่วโมงนี้: </span>
                                    <span className="font-bold text-[oklch(18%_0.012_28)]">
                                        ฿{dayMetrics?.points?.find(p => p.hour === hoveredHour)?.sale.toLocaleString()}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[oklch(42%_0.010_28)]">ลูกค้า: </span>
                                    <span className="font-bold text-[oklch(52%_0.16_28)]">
                                        {dayMetrics?.points?.find(p => p.hour === hoveredHour)?.pax} ท่าน
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[oklch(42%_0.010_28)]">ยอดสะสม: </span>
                                    <span className="font-bold text-[oklch(18%_0.012_28)]">
                                        ฿{dayMetrics?.points?.find(p => p.hour === hoveredHour)?.cumulativeSales.toLocaleString()}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[oklch(42%_0.010_28)]">เฉลี่ย/หัว: </span>
                                    <span className="font-bold text-[oklch(45%_0.08_140)]">
                                        ฿{dayMetrics?.points?.find(p => p.hour === hoveredHour)?.spendPerHead}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* 6. 4 DAYPARTS BREAKDOWN CARDS (Lunch, Afternoon, Dinner, Late)             */}
            {/* ========================================================================= */}
            <div className="p-4 md:p-6 bg-[oklch(94%_0.010_28)] space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] uppercase">
                            DAYPART MATRIX // 04
                        </span>
                        <h4 className="font-bold text-sm md:text-base text-[oklch(18%_0.012_28)]">
                            {filterMode === 'month' ? 'สัดส่วนรายได้และทราฟฟิกแยก 4 ช่วงเวลาประจำเดือน' : 'สถิติและประสิทธิภาพแยก 4 ช่วงเวลาของวัน'}
                        </h4>
                    </div>
                    <span className="text-xs font-mono text-[oklch(42%_0.010_28)]">
                        อัตราเร่งรายชั่วโมง (฿ / Operational Hour)
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {(filterMode === 'month' ? monthMetrics?.monthlyDayparts : dayMetrics?.daypartBreakdown)?.map((dp) => (
                        <div
                            key={dp.id}
                            className="p-4 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] space-y-2.5"
                        >
                            <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)] pb-1.5">
                                <div>
                                    <div className="font-bold text-xs text-[oklch(18%_0.012_28)]">{dp.label}</div>
                                    <div className="text-[10px] font-mono text-[oklch(42%_0.010_28)]">{dp.thaiLabel} ({dp.rangeText})</div>
                                </div>
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)]">
                                    {dp.percent}%
                                </span>
                            </div>

                            <div className="space-y-1">
                                <div className="font-mono text-xl font-bold text-[oklch(18%_0.012_28)]">
                                    ฿{dp.sales.toLocaleString()}
                                </div>
                                <div className="flex items-center justify-between text-xs font-mono text-[oklch(42%_0.010_28)]">
                                    <span>ทราฟฟิก: {dp.pax} ท่าน</span>
                                    <span>เฉลี่ย: ฿{dp.spendPerHead}/หัว</span>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-[oklch(85%_0.012_28)] flex items-center justify-between text-[11px] font-mono">
                                <span className="text-[oklch(42%_0.010_28)]">อัตราเร่ง:</span>
                                <span className="font-bold text-[oklch(52%_0.16_28)]">
                                    ฿{dp.hourlyVelocity.toLocaleString()} / ชม.
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ========================================================================= */}
            {/* 7. MONTH MODE ONLY: DAILY VELOCITY RANKING & STRIP                         */}
            {/* ========================================================================= */}
            {filterMode === 'month' && monthViewMode === 'ranking' && (
                <div className="p-4 md:p-6 bg-[oklch(97%_0.008_28)] space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] uppercase">
                                RANKING // VELOCITY
                            </span>
                            <h4 className="font-bold text-sm text-[oklch(18%_0.012_28)]">
                                การจัดอันดับวันที่มีอัตราเร่งยอดขายสูงสุดประจำเดือน (High Pacing Days)
                            </h4>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Top Fastest Days */}
                        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] p-4 space-y-2">
                            <div className="text-xs font-mono font-bold text-[oklch(45%_0.08_140)]">
                                ▲ TOP 5 FASTEST ACCELERATION DAYS (วันยอดพุ่งเร็วที่สุด)
                            </div>
                            <div className="space-y-1.5">
                                {monthMetrics?.topDays.map((d, idx) => (
                                    <div
                                        key={d.date}
                                        className="p-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] flex items-center justify-between font-mono text-xs"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-[oklch(18%_0.012_28)]">#{idx + 1}</span>
                                            <span>{d.date}</span>
                                            <span className="text-[10px] text-[oklch(42%_0.010_28)]">
                                                ({d.isWeekend ? 'วันหยุด' : 'วันธรรมดา'})
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-bold text-[oklch(18%_0.012_28)]">฿{d.sales.toLocaleString()}</span>
                                            <span className="text-[10px] text-[oklch(42%_0.010_28)] ml-2">({d.pax} ท่าน)</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Sluggish Days for Optimization */}
                        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] p-4 space-y-2">
                            <div className="text-xs font-mono font-bold text-[oklch(52%_0.16_28)]">
                                ▼ SLOW PACING DAYS (วันที่ควรเพิ่มโปรโมชั่นกระตุ้น)
                            </div>
                            <div className="space-y-1.5">
                                {monthMetrics?.slowDays.map((d, idx) => (
                                    <div
                                        key={d.date}
                                        className="p-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] flex items-center justify-between font-mono text-xs"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-[oklch(18%_0.012_28)]">#{idx + 1}</span>
                                            <span>{d.date}</span>
                                            <span className="text-[10px] text-[oklch(42%_0.010_28)]">
                                                ({d.isWeekend ? 'วันหยุด' : 'วันธรรมดา'})
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-bold text-[oklch(52%_0.16_28)]">฿{d.sales.toLocaleString()}</span>
                                            <span className="text-[10px] text-[oklch(42%_0.010_28)] ml-2">({d.pax} ท่าน)</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
