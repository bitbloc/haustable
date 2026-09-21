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

// 4 Standard Restaurant Dayparts with operational profiles
const DAYPARTS = [
    {
        id: 'lunch',
        label: 'Lunch Rush',
        thaiLabel: 'มื้อกลางวัน',
        hours: [11, 12, 13],
        rangeText: '11:00 - 14:00',
        code: 'DP_01',
        desc: 'อาหารจานเดียว ข้าวหน้าเนื้อ เครื่องดื่ม สปีดบริการเร่งด่วน',
        kitchenPrep: 'เตรียมวัตถุดิบจานด่วน และจัดเตรียมเครื่องดื่ม Takeaway ให้พร้อมบริการก่อน 12.00 น.'
    },
    {
        id: 'afternoon',
        label: 'Afternoon Downtime',
        thaiLabel: 'ช่วงบ่ายคาเฟ่',
        hours: [14, 15, 16],
        rangeText: '14:00 - 17:00',
        code: 'DP_02',
        desc: 'ช่วงคาเฟ่ เบเกอรี่ กาแฟดริป และมุมนั่งพักผ่อนริมโขง',
        kitchenPrep: 'บาร์กาแฟและเครื่องดื่มเป็นแกนหลัก เตรียมเซ็ตโต๊ะ และพักกะพนักงานรอบกลางวัน'
    },
    {
        id: 'dinner',
        label: 'Prime Dinner',
        thaiLabel: 'มื้อค่ำพีค',
        hours: [17, 18, 19, 20],
        rangeText: '17:00 - 21:00',
        code: 'DP_03',
        desc: 'ช่วงรายได้หลักประจำวัน ดินเนอร์ริมโขง ยอดเฉลี่ยต่อบิลสูงสุด',
        kitchenPrep: 'เปิดเต็มทุกสเตชั่นครัวหลัก (เตาย่าง/จานร้อน) สแตนด์บายพนักงานเสิร์ฟและจัดการโต๊ะจอง'
    },
    {
        id: 'late',
        label: 'Late Night Drinks',
        thaiLabel: 'บาร์และดึก',
        hours: [21, 22, 23],
        rangeText: '21:00 - 23:59',
        code: 'DP_04',
        desc: 'บรรยากาศบาร์ ค็อกเทล เบียร์ ไวน์ และของทานเล่นยามค่ำคืน',
        kitchenPrep: 'ลาสออเดอร์อาหารร้อน บาร์ดูแลเครื่องดื่มชิลล์รอบดึกและเช็คสต็อกเตรียมปิดรอบ'
    }
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
    const [monthViewMode, setMonthViewMode] = useState('pacing') // 'pacing' | 'weekday_weekend' | 'dayparts' | 'ranking'
    const [showPredict, setShowPredict] = useState(() => {
        try {
            const saved = localStorage.getItem('intraday_cockpit_show_predict')
            return saved !== null ? JSON.parse(saved) : true
        } catch {
            return true
        }
    })
    const [adEvents, setAdEvents] = useState([])
    const [aiBriefing, setAiBriefing] = useState(null)
    const [aiLoading, setAiLoading] = useState(false)
    const [copiedBriefing, setCopiedBriefing] = useState(false)
    const containerRef = useRef(null)
    const [containerWidth, setContainerWidth] = useState(800)

    const togglePredict = () => {
        setShowPredict(prev => {
            const next = !prev
            try {
                localStorage.setItem('intraday_cockpit_show_predict', JSON.stringify(next))
            } catch {
                // ignore
            }
            return next
        })
    }

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

    // Determine current date & time in Bangkok timezone
    const todayBangkok = useMemo(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }), [])
    const isViewingToday = useMemo(() => {
        if (filterMode !== 'day') return false
        return !selectedDate || selectedDate === todayBangkok
    }, [filterMode, selectedDate, todayBangkok])

    const targetDateObj = useMemo(() => {
        if (selectedDate) {
            const parts = selectedDate.split('-')
            return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
        }
        return new Date()
    }, [selectedDate])

    const isWeekend = useMemo(() => {
        const day = targetDateObj.getDay()
        return day === 0 || day === 6
    }, [targetDateObj])

    const dayOfWeekThai = useMemo(() => {
        const days = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์']
        return days[targetDateObj.getDay()]
    }, [targetDateObj])

    const currentBangkokTime = useMemo(() => {
        try {
            const d = new Date()
            const hStr = d.toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', hour12: false, hour: '2-digit' })
            const mStr = d.toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', minute: '2-digit' })
            return { hour: parseInt(hStr, 10), minute: parseInt(mStr, 10), label: `${hStr}:${mStr}` }
        } catch {
            const d = new Date()
            return {
                hour: d.getHours(),
                minute: d.getMinutes(),
                label: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
            }
        }
    }, [])

    // =========================================================================
    // 1. HISTORICAL BASELINE FETCHING (4 Weeks Same Day-of-Week)
    // =========================================================================
    const [historicalBaseline, setHistoricalBaseline] = useState(() => {
        const fallbackPax = {
            11: 4, 12: 10, 13: 12, 14: 7, 15: 5, 16: 6,
            17: 9, 18: 15, 19: 18, 20: 14, 21: 8, 22: 4, 23: 1
        }
        const totalP = Object.values(fallbackPax).reduce((a, b) => a + b, 0)
        const fallbackSales = {}
        const defaultTarget = 35000
        ;[11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].forEach(h => {
            fallbackSales[h] = Math.round((fallbackPax[h] / totalP) * defaultTarget)
        })
        return {
            pax: fallbackPax,
            sales: fallbackSales,
            totalPax: totalP,
            totalSales: defaultTarget
        }
    })

    useEffect(() => {
        let isMounted = true
        async function fetchHistoricalBaseline() {
            const fallbackPax = isWeekend ? {
                11: 6, 12: 14, 13: 16, 14: 10, 15: 8, 16: 9,
                17: 15, 18: 22, 19: 25, 20: 18, 21: 12, 22: 6, 23: 2
            } : {
                11: 4, 12: 10, 13: 12, 14: 7, 15: 5, 16: 6,
                17: 9, 18: 15, 19: 18, 20: 14, 21: 8, 22: 4, 23: 1
            }
            const defaultDayTarget = isWeekend ? 55000 : 35000
            const totalFallbackPax = Object.values(fallbackPax).reduce((a, b) => a + b, 0)
            const fallbackSales = {}
            hours.forEach(h => {
                fallbackSales[h] = Math.round((fallbackPax[h] / totalFallbackPax) * defaultDayTarget)
            })

            try {
                const pastDates = []
                for (let i = 1; i <= 4; i++) {
                    const d = new Date(targetDateObj.getTime() - i * 7 * 24 * 3600 * 1000)
                    pastDates.push(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }))
                }
                const earliestDate = pastDates[pastDates.length - 1]
                const latestDate = pastDates[0]

                const { data, error } = await supabase
                    .from('bookings')
                    .select('id, booking_time, created_at, pax, total_amount, total_price, deposit_amount, status')
                    .in('status', ['completed', 'paid', 'success', 'seated', 'confirmed', 'ready'])
                    .gte('booking_time', `${earliestDate}T00:00:00+07:00`)
                    .lte('booking_time', `${latestDate}T23:59:59+07:00`)

                if (error) throw error

                const hourlyPax = {}
                const hourlySales = {}
                hours.forEach(h => { hourlyPax[h] = 0; hourlySales[h] = 0 })
                const daysWithData = new Set()

                ;(data || []).forEach(b => {
                    const t = b.booking_time || b.created_at
                    if (!t) return
                    const dStr = getBangkokDateStr(t)
                    if (pastDates.includes(dStr)) {
                        daysWithData.add(dStr)
                        const h = getBangkokHour(t)
                        if (hourlyPax[h] !== undefined) {
                            const p = parseInt(b.pax || 1, 10)
                            let amt = Number(b.total_amount ?? b.total_price ?? b.deposit_amount ?? 0)
                            hourlyPax[h] += p
                            hourlySales[h] += amt
                        }
                    }
                })

                const count = daysWithData.size
                if (count > 0) {
                    const avgPax = {}
                    const avgSales = {}
                    let totP = 0
                    let totS = 0
                    hours.forEach(h => {
                        avgPax[h] = Math.max(1, Math.round(hourlyPax[h] / count))
                        avgSales[h] = Math.round(hourlySales[h] / count)
                        totP += avgPax[h]
                        totS += avgSales[h]
                    })
                    if (isMounted) {
                        setHistoricalBaseline({
                            pax: avgPax,
                            sales: avgSales,
                            totalPax: totP,
                            totalSales: totS || defaultDayTarget
                        })
                    }
                } else {
                    if (isMounted) {
                        setHistoricalBaseline({
                            pax: fallbackPax,
                            sales: fallbackSales,
                            totalPax: totalFallbackPax,
                            totalSales: defaultDayTarget
                        })
                    }
                }
            } catch (err) {
                console.warn('[Cockpit] Baseline fallback:', err?.message)
                if (isMounted) {
                    setHistoricalBaseline({
                        pax: fallbackPax,
                        sales: fallbackSales,
                        totalPax: totalFallbackPax,
                        totalSales: defaultDayTarget
                    })
                }
            }
        }

        fetchHistoricalBaseline()
        return () => { isMounted = false }
    }, [targetDateObj, isWeekend, hours])

    // =========================================================================
    // 2. FETCH AD LANDING EVENTS
    // =========================================================================
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
                console.warn('[Cockpit] Ad events fallback:', err?.message)
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
    // 3. DAY MODE COMPUTATION (Pacing, Traffic, Dynamic Forecast & Dayparts)
    // =========================================================================
    const dayMetrics = useMemo(() => {
        if (filterMode !== 'day') return null

        const hourlySales = {}
        const hourlyPax = {}
        const hourlyBills = {}
        const hourlyAdDirs = {}
        const hourlyAdLeads = {}
        hours.forEach(h => {
            hourlySales[h] = 0
            hourlyPax[h] = 0
            hourlyBills[h] = 0
            hourlyAdDirs[h] = 0
            hourlyAdLeads[h] = 0
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

        adEvents.forEach(e => {
            const h = getBangkokHour(e.created_at)
            if (h >= 11 && h <= 23) {
                if (['click_directions', 'find_location'].includes(e.event_name)) {
                    hourlyAdDirs[h] = (hourlyAdDirs[h] || 0) + 1
                }
                if (['click_directions', 'find_location', 'click_phone', 'contact', 'click_line', 'generate_lead', 'click_booking_link', 'click_pickup_link'].includes(e.event_name)) {
                    hourlyAdLeads[h] = (hourlyAdLeads[h] || 0) + 1
                }
            }
        })

        // Benchmark target setup
        const defaultTarget = isWeekend ? 55000 : 35000
        const maxCumulative = Math.max(totalGross * 1.25, historicalBaseline.totalSales, defaultTarget)
        const curveWeights = [0.03, 0.12, 0.24, 0.30, 0.35, 0.40, 0.50, 0.68, 0.84, 0.93, 0.97, 0.99, 1.0]
        const benchmarkPoints = hours.map((h, idx) => ({
            hour: h,
            expectedCumulative: Math.round(maxCumulative * (curveWeights[idx] || 1))
        }))

        const cappedHour = isViewingToday ? Math.min(23, Math.max(11, currentBangkokTime.hour)) : 23

        // 1. Pacing Multiplier vs Historical Baseline so far
        let baselineSoFar = 0
        let actualSoFar = 0
        hours.forEach(h => {
            const bVal = historicalBaseline.pax[h] || 0
            if (h <= cappedHour) {
                baselineSoFar += bVal
                actualSoFar += (hourlyPax[h] || 0)
            }
        })
        const rawPace = baselineSoFar > 0 ? (actualSoFar / baselineSoFar) : 1.0
        const paceMultiplier = actualSoFar > 0 ? Math.max(0.65, Math.min(1.75, rawPace * 0.75 + 0.25)) : 1.0

        // 2. Near-Term Ad Lift
        const recentHighIntent = hours.reduce((acc, h) => {
            if (h >= cappedHour - 1 && h <= cappedHour) {
                return acc + (hourlyAdLeads[h] || 0)
            }
            return acc
        }, 0)
        const adLiftPct = Math.min(0.35, recentHighIntent * 0.05)

        // Cumulative pacing & dynamic forecast points
        let runningSales = 0
        let runningPax = 0
        let forecastedClosingPax = 0
        let forecastedClosingPaxHigh = 0
        let forecastedClosingPaxLow = 0

        const points = hours.map((h, idx) => {
            const s = hourlySales[h]
            const p = hourlyPax[h]
            runningSales += s
            runningPax += p
            const baseP = historicalBaseline.pax[h] || 0
            const baseS = historicalBaseline.sales[h] || 0
            const spendPerHead = p > 0 ? Math.round(s / p) : 0
            const seatOccupancyPct = Math.round((p / totalSeats) * 100)

            const isFuture = isViewingToday ? h > cappedHour : false
            let forecast = null
            let forecastHigh = null
            let forecastLow = null

            if (isFuture) {
                const nearTermLift = (h <= cappedHour + 2) ? (1 + adLiftPct) : 1.0
                forecast = Math.round(baseP * paceMultiplier * nearTermLift)
                forecastHigh = Math.round(baseP * paceMultiplier * (nearTermLift + 0.25))
                forecastLow = Math.max(0, Math.round(baseP * paceMultiplier * Math.max(0.4, nearTermLift - 0.25)))

                forecastedClosingPax += forecast
                forecastedClosingPaxHigh += forecastHigh
                forecastedClosingPaxLow += forecastLow
            } else {
                forecast = p
                forecastHigh = p
                forecastLow = p
                forecastedClosingPax += p
                forecastedClosingPaxHigh += p
                forecastedClosingPaxLow += p
            }

            return {
                hour: h,
                label: `${h}.00`,
                sale: s,
                pax: p,
                baselinePax: baseP,
                baselineSales: baseS,
                forecast,
                forecastHigh,
                forecastLow,
                isFuture,
                adDirs: hourlyAdDirs[h] || 0,
                adLeads: hourlyAdLeads[h] || 0,
                bills: hourlyBills[h],
                spendPerHead,
                seatOccupancyPct,
                cumulativeSales: runningSales,
                cumulativePax: runningPax,
                benchmarkCumulative: benchmarkPoints[idx]?.expectedCumulative || 0
            }
        })

        // Dayparts breakdown with status and operational guidance
        const daypartBreakdown = DAYPARTS.map(dp => {
            const dpSales = dp.hours.reduce((sum, h) => sum + (hourlySales[h] || 0), 0)
            const dpPax = dp.hours.reduce((sum, h) => sum + (hourlyPax[h] || 0), 0)
            const dpBills = dp.hours.reduce((sum, h) => sum + (hourlyBills[h] || 0), 0)
            const dpBaselinePax = dp.hours.reduce((sum, h) => sum + (historicalBaseline.pax[h] || 0), 0)
            const dpBaselineSales = dp.hours.reduce((sum, h) => sum + (historicalBaseline.sales[h] || 0), 0)
            const pct = totalGross > 0 ? Math.round((dpSales / totalGross) * 1000) / 10 : 0
            const sph = dpPax > 0 ? Math.round(dpSales / dpPax) : 0
            const hourlyRevVelocity = Math.round(dpSales / dp.hours.length)

            let status = 'upcoming'
            if (isViewingToday) {
                const firstHour = dp.hours[0]
                const lastHour = dp.hours[dp.hours.length - 1]
                if (currentBangkokTime.hour > lastHour) {
                    status = 'passed'
                } else if (currentBangkokTime.hour >= firstHour && currentBangkokTime.hour <= lastHour) {
                    status = 'active'
                } else {
                    status = 'upcoming'
                }
            } else {
                status = 'passed'
            }

            return {
                ...dp,
                status,
                sales: dpSales,
                pax: dpPax,
                baselinePax: dpBaselinePax,
                baselineSales: dpBaselineSales,
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

        // Realistic Projected Closing Sales
        const activePoints = isViewingToday ? points.filter(p => p.hour <= cappedHour) : points
        const latestCumulative = activePoints.length > 0 ? activePoints[activePoints.length - 1].cumulativeSales : 0
        const latestExpected = benchmarkPoints.find(b => b.hour === cappedHour)?.expectedCumulative || 1

        let projectedClosingSales = 0
        if (latestCumulative > 0) {
            const paceRatio = latestCumulative / latestExpected
            projectedClosingSales = Math.round(maxCumulative * paceRatio)
        } else {
            projectedClosingSales = defaultTarget
        }

        const projectedClosingPax = totalGuests > 0 ? forecastedClosingPax : historicalBaseline.totalPax

        return {
            totalGross,
            totalGuests,
            points,
            activePoints,
            benchmarkPoints,
            daypartBreakdown,
            peakHourPoint,
            adHighIntent,
            defaultTarget,
            projectedClosingSales,
            projectedClosingPax,
            forecastedClosingPaxHigh,
            forecastedClosingPaxLow,
            cappedHour,
            paceMultiplier
        }
    }, [filterMode, validOrders, hours, totalSeats, adEvents, isViewingToday, currentBangkokTime, isWeekend, historicalBaseline])

    // =========================================================================
    // 4. MONTH MODE COMPUTATION
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
            const isWknd = dayOfWeek === 0 || dayOfWeek === 6

            const hSales = {}
            const hPax = {}
            hours.forEach(h => { hSales[h] = 0; hPax[h] = 0 })

            dateMap[dateStr] = {
                date: dateStr,
                dayNumber: d,
                dayOfWeek,
                isWeekend: isWknd,
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

        // Average Hourly Profile
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

        // Monthly Master Cumulative Pacing Curve
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

        // Daily Velocity Ranking
        const rankedDays = [...daysWithSales].sort((a, b) => b.sales - a.sales)
        const topDays = rankedDays.slice(0, 5)
        const slowDays = [...daysWithSales].sort((a, b) => a.sales - b.sales).slice(0, 3)

        // Break-Even Hour
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
            topDays,
            slowDays,
            dailyExpenseTarget,
            breakEvenHour: breakEvenPoint ? `${breakEvenPoint.hour}.00 น.` : 'เกิน 23.00 น.'
        }
    }, [filterMode, validOrders, hours, totalSeats, totalExpenses, selectedMonth, todayBangkok])

    // =========================================================================
    // 5. ON-DEMAND AI BRIEFING GENERATION
    // =========================================================================
    const generateAiBriefing = async () => {
        setAiLoading(true)
        try {
            const apiKey = await getGeminiApiKey()
            const model = await getGeminiPreferredModel() || 'gemini-2.5-flash'

            if (!apiKey) {
                toast.error('กรุณาตั้งค่า Gemini API Key ในระบบก่อนใช้งาน')
                setAiLoading(false)
                return
            }

            let promptContext = ''
            if (filterMode === 'month') {
                promptContext = `
คุณคือผู้อำนวยการฝ่ายการเงินและยุทธศาสตร์ร้านอาหาร "IN THE HAUS" 
จงวิเคราะห์ภาพรวมผลการดำเนินงานและสถิติความเร็วรายชั่วโมง (Hourly Velocity) ประจำเดือน ${selectedMonth || todayBangkok.slice(0, 7)}:
- ยอดขายรวมทั้งเดือน: ฿${monthMetrics?.monthGross.toLocaleString()}
- จำนวนลูกค้าสะสม: ${monthMetrics?.monthPax.toLocaleString()} ท่าน (เฉลี่ย ฿${monthMetrics?.monthPax > 0 ? Math.round(monthMetrics.monthGross / monthMetrics.monthPax) : 0}/หัว)
- ชั่วโมงคุ้มทุนรายวันเฉลี่ย: ${monthMetrics?.breakEvenHour} (เป้าหมาย ฿${monthMetrics?.dailyExpenseTarget.toLocaleString()})
- สัดส่วน 4 Dayparts:
${monthMetrics?.monthlyDayparts.map(dp => `  * ${dp.label} (${dp.rangeText}): ฿${dp.sales.toLocaleString()} (${dp.percent}%) ลูกค้า ${dp.pax} ท่าน ความเร็ว ฿${dp.hourlyVelocity.toLocaleString()}/ชม.`).join('\n')}
`
            } else {
                promptContext = `
คุณคือผู้จัดการกะและผู้อำนวยการปฏิบัติการร้านอาหาร "IN THE HAUS"
จงวิเคราะห์สถานการณ์ความเร็วยอดขายและทราฟฟิกลูกค้า (Intraday Velocity & Traffic) ประจำวัน ${dayOfWeekThai} (${selectedDate || todayBangkok}):
- ยอดขายสะสมขณะนี้: ฿${dayMetrics?.totalGross.toLocaleString()} (เป้าหมายประจำวัน: ฿${dayMetrics?.defaultTarget.toLocaleString()})
- ลูกค้าเข้าจริง: ${dayMetrics?.totalGuests} ท่าน (คาดการณ์ตามสถิติ: ~${historicalBaseline.totalPax} ท่าน)
- สัญญาณความสนใจจาก Ad Leads: ${dayMetrics?.adHighIntent} ครั้ง (ขอเส้นทาง/โทร/จอง/สั่งอาหาร)
- สถิติแยก 4 Dayparts:
${dayMetrics?.daypartBreakdown.map(dp => `  * ${dp.label} [${dp.status.toUpperCase()}]: ยอด ฿${dp.sales.toLocaleString()} ลูกค้าจริง ${dp.pax} ท่าน (สถิติปกติ ~${dp.baselinePax} ท่าน)`).join('\n')}
`
            }

            const promptText = `${promptContext}
ให้เขียนบทวิเคราะห์เชิงยุทธศาสตร์ที่เฉียบคม สุภาพ และปฏิบัติได้จริง (ภาษาไทย ความยาว 180-240 คำ):
1. ข้อสังเกตสำคัญของความเร็วยอดขายและการครองที่นั่ง
2. คำแนะนำเชิงปฏิบัติการสำหรับทีมครัว บาร์ และหน้าร้าน
3. ยุทธวิธีผลักดันยอดขายปิดบิลให้ถึงเป้าหมายประจำวัน/เดือน`

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                    generationConfig: { maxOutputTokens: 600, temperature: 0.3 }
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
    // 6. SVG RENDER DIMENSIONS & DUAL-LAYER PROJECTION ENGINE
    // =========================================================================
    const isMobile = containerWidth < 560
    const svgWidth = Math.max(320, containerWidth)
    const svgHeight = isMobile ? 250 : 290
    const padLeft = isMobile ? 38 : 50
    const padRight = isMobile ? 42 : 56 // Ample right margin for 23:00 prediction tags
    const padYTop = isMobile ? 26 : 32
    const padYBottom = isMobile ? 34 : 38
    const plotWidth = Math.max(svgWidth - padLeft - padRight, 200)
    const plotHeight = Math.max(svgHeight - padYTop - padYBottom, 120)

    const getX = (hour) => {
        const idx = hours.indexOf(hour)
        if (idx === -1) return padLeft
        return padLeft + (idx / (hours.length - 1)) * plotWidth
    }

    // Dynamic Max Scales
    const maxSalesVal = useMemo(() => {
        if (filterMode === 'month') {
            if (monthViewMode === 'weekday_weekend') {
                const maxCumul = Math.max(
                    ...monthMetrics?.weekdayWeekendCurve.map(p => Math.max(p.weekdayCumulative, p.weekendCumulative)) || [10000]
                )
                return Math.max(maxCumul * 1.1, 5000)
            }
            const maxCumul = Math.max(...monthMetrics?.monthlyMasterPacing.map(p => p.cumulativeAvgSales) || [10000])
            return Math.max(maxCumul * 1.1, 5000)
        }
        const maxCumul = Math.max(
            dayMetrics?.totalGross || 0,
            dayMetrics?.projectedClosingSales || 0,
            ...dayMetrics?.benchmarkPoints.map(p => p.expectedCumulative) || [10000]
        )
        return Math.max(maxCumul * 1.1, 10000)
    }, [filterMode, monthViewMode, monthMetrics, dayMetrics])

    const maxPaxScale = useMemo(() => {
        if (filterMode === 'month') {
            return Math.max(...monthMetrics?.monthlyAvgHourly.map(p => p.avgPax) || [10], 15)
        }
        const highestVal = Math.max(
            ...dayMetrics?.points.map(p => Math.max(p.pax, p.baselinePax, p.forecastHigh || p.forecast || 0)) || [10],
            14
        )
        return Math.ceil((highestVal * 1.3) / 5) * 5
    }, [filterMode, monthMetrics, dayMetrics])

    const getYMoney = (val) => {
        const ratio = Math.min(1, Math.max(0, val / maxSalesVal))
        return padYTop + (1 - ratio) * plotHeight
    }

    const getYPax = (val) => {
        const ratio = Math.min(1, Math.max(0, val / maxPaxScale))
        return padYTop + (1 - ratio) * plotHeight
    }

    const getYBarHeight = (val, maxVal) => {
        const ratio = Math.min(1, Math.max(0, val / maxVal))
        return ratio * plotHeight
    }

    // -------------------------------------------------------------------------
    // DYNAMIC SVG PATHS (Flowing Dashed Forecast Line, High/Low Fan, Baseline)
    // -------------------------------------------------------------------------
    const cappedHour = dayMetrics?.cappedHour || 11

    // 1. Path for 4-Week Baseline Curve
    const pathBaselinePax = useMemo(() => {
        if (!dayMetrics?.points) return ''
        const coords = dayMetrics.points.map(pt => `${getX(pt.hour).toFixed(1)},${getYPax(pt.baselinePax).toFixed(1)}`)
        return `M ${coords.join(' L ')}`
    }, [dayMetrics, plotWidth, plotHeight, maxPaxScale])

    // 2. Paths for Dynamic Forecast Line (Animated Flowing Dash), High/Low Bounds & Fan Cone
    const { pathForecastBase, pathForecastHigh, pathForecastLow, pathForecastFan } = useMemo(() => {
        if (!isViewingToday || !dayMetrics?.points) {
            return { pathForecastBase: '', pathForecastHigh: '', pathForecastLow: '', pathForecastFan: '' }
        }

        const lastActive = dayMetrics.points.find(p => p.hour === cappedHour) || dayMetrics.points[0]
        const futurePoints = dayMetrics.points.filter(p => p.hour >= lastActive.hour)
        if (futurePoints.length < 2) {
            return { pathForecastBase: '', pathForecastHigh: '', pathForecastLow: '', pathForecastFan: '' }
        }

        const coordsBase = futurePoints.map(pt => {
            const val = pt.isFuture ? (pt.forecast ?? pt.baselinePax) : pt.pax
            return `${getX(pt.hour).toFixed(1)},${getYPax(val).toFixed(1)}`
        })

        const coordsHigh = futurePoints.map(pt => {
            const val = pt.isFuture ? (pt.forecastHigh ?? pt.baselinePax) : pt.pax
            return `${getX(pt.hour).toFixed(1)},${getYPax(val).toFixed(1)}`
        })

        const coordsLow = futurePoints.map(pt => {
            const val = pt.isFuture ? (pt.forecastLow ?? pt.baselinePax) : pt.pax
            return `${getX(pt.hour).toFixed(1)},${getYPax(val).toFixed(1)}`
        })

        const pBase = `M ${coordsBase.join(' L ')}`
        const pHigh = `M ${coordsHigh.join(' L ')}`
        const pLow = `M ${coordsLow.join(' L ')}`

        const reversedLow = [...futurePoints].reverse().map(pt => {
            const val = pt.isFuture ? (pt.forecastLow ?? pt.baselinePax) : pt.pax
            return `${getX(pt.hour).toFixed(1)},${getYPax(val).toFixed(1)}`
        })
        const pFan = `M ${coordsHigh.join(' L ')} L ${reversedLow.join(' L ')} Z`

        return { pathForecastBase: pBase, pathForecastHigh: pHigh, pathForecastLow: pLow, pathForecastFan: pFan }
    }, [isViewingToday, dayMetrics, cappedHour, plotWidth, plotHeight, maxPaxScale])

    // 3. Path for Actual Pax Line
    const pathActualPax = useMemo(() => {
        if (!dayMetrics?.points) return ''
        const activePts = isViewingToday
            ? dayMetrics.points.filter(p => p.hour <= cappedHour && p.pax > 0)
            : dayMetrics.points.filter(p => p.pax > 0)
        if (activePts.length < 2) return ''
        const coords = activePts.map(pt => `${getX(pt.hour).toFixed(1)},${getYPax(pt.pax).toFixed(1)}`)
        return `M ${coords.join(' L ')}`
    }, [isViewingToday, dayMetrics, cappedHour, plotWidth, plotHeight, maxPaxScale])

    // 4. Path for Projected Sales Velocity Curve (Connecting Current Sales to Closing Target)
    const pathForecastSales = useMemo(() => {
        if (!isViewingToday || !dayMetrics?.points) return ''
        const futurePts = dayMetrics.points.filter(p => p.hour >= cappedHour)
        if (futurePts.length < 2) return ''

        const curSales = dayMetrics.points.find(p => p.hour === cappedHour)?.cumulativeSales || 0
        const targetEnd = dayMetrics.projectedClosingSales || dayMetrics.defaultTarget
        const totalRemaining = Math.max(1, 23 - cappedHour)

        const coords = futurePts.map(pt => {
            const fraction = (pt.hour - cappedHour) / totalRemaining
            const sVal = Math.round(curSales + (targetEnd - curSales) * fraction)
            return `${getX(pt.hour).toFixed(1)},${getYMoney(sVal).toFixed(1)}`
        })
        return `M ${coords.join(' L ')}`
    }, [isViewingToday, dayMetrics, cappedHour, plotWidth, plotHeight, maxSalesVal])

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

            {/* ========================================================================= */}
            {/* 1. HEADER TOOLBAR: TITLE, BADGES & VIEW SWITCHER                          */}
            {/* ========================================================================= */}
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
                                LIVE PACING ({currentBangkokTime.label} น.)
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
                            : `ผสานสถิติความเร็วยอดขายสะสมรายชั่วโมง (฿) คู่กับเส้นประพยากรณ์ทราฟฟิก (Pax Predict Stream) และกรอบสูง-ต่ำ`}
                    </p>
                </div>

                {/* Sub-Tabs Action Ribbon */}
                <div className="flex items-center gap-2 flex-wrap">
                    {filterMode === 'month' ? (
                        <div className="inline-flex border border-[oklch(85%_0.012_28)] divide-x divide-[oklch(85%_0.012_28)] font-mono text-xs">
                            {[
                                { id: 'pacing', label: 'เส้นความเร็วเฉลี่ย [PACING]' },
                                { id: 'weekday_weekend', label: 'จันทร์-ศุกร์ VS เสาร์-อาทิตย์' },
                                { id: 'dayparts', label: 'สัดส่วน 4 ช่วงเวลา [DAYPARTS]' },
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
                                { id: 'ad_briefing', label: aiBriefing ? 'AI กลยุทธ์ [READY]' : 'AI กลยุทธ์ [BRIEFING]' }
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
                </div>
            </div>

            {/* ========================================================================= */}
            {/* 2. CORE KPI METRICS GRID (Dieter Rams 4-Cell Structural Bar)               */}
            {/* ========================================================================= */}
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
                                {dayMetrics?.totalGross > 0
                                    ? `คาดการณ์ปิดวัน: ~฿${dayMetrics?.projectedClosingSales.toLocaleString()}`
                                    : `เป้าหมายประจำวัน: ฿${dayMetrics?.defaultTarget.toLocaleString()}`}
                            </div>
                        </div>

                        <div className="p-4 space-y-1">
                            <div className="text-[10px] font-mono font-bold text-[oklch(42%_0.010_28)]">02 // GUEST TRAFFIC</div>
                            <div className="font-mono text-xl md:text-2xl font-bold tracking-tight text-[oklch(52%_0.16_28)]">
                                {dayMetrics?.totalGuests} ท่าน
                            </div>
                            <div className="text-[11px] font-mono text-[oklch(42%_0.010_28)]">
                                {dayMetrics?.totalGuests > 0
                                    ? `คาดการณ์ปิดวัน: ~${dayMetrics?.projectedClosingPax} ท่าน (กรอบ ${dayMetrics?.forecastedClosingPaxLow}-${dayMetrics?.forecastedClosingPaxHigh})`
                                    : `สถิติปกติ (${dayOfWeekThai}): ~${historicalBaseline.totalPax} ท่าน`}
                            </div>
                        </div>

                        <div className="p-4 space-y-1">
                            <div className="text-[10px] font-mono font-bold text-[oklch(42%_0.010_28)]">03 // VELOCITY SPEED</div>
                            <div className="font-mono text-xl md:text-2xl font-bold tracking-tight text-[oklch(18%_0.012_28)]">
                                ฿{dayMetrics?.peakHourPoint?.sale ? dayMetrics.peakHourPoint.sale.toLocaleString() : '0'}
                            </div>
                            <div className="text-[11px] font-mono text-[oklch(42%_0.010_28)]">
                                {dayMetrics?.peakHourPoint?.sale > 0
                                    ? `พีคสุด: ${dayMetrics.peakHourPoint.hour}.00 น.`
                                    : `ช่วงพีคตามสถิติ: 18.00 - 20.00 น.`}
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
            {/* 3. VIEW 1: COCKPIT MAIN DUAL-LAYER GRAPH (When activeSubTab === 'chart')   */}
            {/* ========================================================================= */}
            {((filterMode === 'day' && activeSubTab === 'chart') ||
              (filterMode === 'month' && (monthViewMode === 'pacing' || monthViewMode === 'weekday_weekend'))) && (
                <div className="p-4 md:p-6 bg-[oklch(97%_0.008_28)] relative">
                    {/* Visual Legend */}
                    <div className="flex items-center justify-between gap-3 text-xs font-mono mb-4 flex-wrap">
                        <div className="flex items-center gap-3.5 flex-wrap">
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
                                    {filterMode === 'day' && (
                                        <>
                                            {showPredict && (
                                                <>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="w-4 h-1 border-t-2 border-dashed border-[oklch(52%_0.16_28)] animate-pulse" />
                                                        <span className="text-[oklch(52%_0.16_28)] font-bold">
                                                            เส้นประพยากรณ์ลูกค้า (Forecast Stream)
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="w-3.5 h-2 bg-[oklch(52%_0.16_28)]/20 border border-dashed border-[oklch(45%_0.08_140)]" />
                                                        <span className="text-[oklch(45%_0.08_140)]">
                                                            กรอบพยากรณ์ (ต่ำ-สูง)
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-3.5 h-1 border-t border-dashed border-[oklch(65%_0.010_28)]" />
                                                <span className="text-[oklch(42%_0.010_28)]">
                                                    สถิติเดิม ({dayOfWeekThai})
                                                </span>
                                            </div>
                                        </>
                                    )}
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-3.5 h-1 bg-[oklch(18%_0.012_28)]" />
                                        <span className="text-[oklch(18%_0.012_28)] font-bold">
                                            {filterMode === 'month' ? 'เส้นสะสมเฉลี่ยต่อวัน (฿)' : 'ยอดขายสะสมจริง (฿)'}
                                        </span>
                                    </div>
                                    {filterMode === 'day' && (
                                        <>
                                            {showPredict && (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-3.5 h-0.5 border-t border-dashed border-[oklch(18%_0.012_28)]" />
                                                    <span className="text-[oklch(18%_0.012_28)]">คาดการณ์สะสมปิดวัน</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-3.5 h-0.5 border-t border-dashed border-[oklch(55%_0.010_28)]" />
                                                <span className="text-[oklch(42%_0.010_28)]">เกณฑ์เป้าหมาย (Benchmark)</span>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Right Action: Predict Toggle Button & Hours */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {filterMode === 'day' && (
                                <button
                                    onClick={togglePredict}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-bold border transition-colors cursor-pointer ${
                                        showPredict
                                            ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)] shadow-xs'
                                            : 'bg-[oklch(97%_0.008_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                                    }`}
                                    title="คลิกเพื่อเปิด/ปิดเส้นประพยากรณ์และกรอบความแปรผัน (Predict Layer Toggle)"
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full ${showPredict ? 'bg-[oklch(52%_0.16_28)] animate-pulse' : 'bg-[oklch(55%_0.010_28)]'}`} />
                                    <span>{showPredict ? 'เส้น PREDICT [ON]' : 'เส้น PREDICT [OFF]'}</span>
                                </button>
                            )}
                            <div className="text-[11px] text-[oklch(42%_0.010_28)] font-mono hidden sm:block">
                                เปิดบริการ 11:00 - 23:00 // Dual Horizon
                            </div>
                        </div>
                    </div>

                    {/* Responsive Dual-Layer SVG Engine */}
                    <div className="w-full overflow-x-auto no-scrollbar">
                        <svg
                            width={svgWidth}
                            height={svgHeight}
                            className="overflow-visible select-none"
                        >
                            <defs>
                                <style>{`
                                    @keyframes forecastStreamline {
                                        from { stroke-dashoffset: 24; }
                                        to { stroke-dashoffset: 0; }
                                    }
                                    .forecast-stream-line {
                                        animation: forecastStreamline 2.2s linear infinite;
                                    }
                                `}</style>
                            </defs>

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

                            {/* 2. Horizontal Gridlines (Money Axis on Left) */}
                            {[0, 0.25, 0.5, 0.75, 1.0].map((step, idx) => {
                                const y = padYTop + (1 - step) * plotHeight
                                const valMoney = Math.round(maxSalesVal * step)
                                const valPax = Math.round(maxPaxScale * step)

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
                                        {/* Left: Money Axis */}
                                        <text
                                            x={padLeft - 6}
                                            y={y + 3}
                                            textAnchor="end"
                                            fontSize="9"
                                            fontFamily="monospace"
                                            fill={colorMuted}
                                        >
                                            {valMoney >= 1000 ? `${Math.round(valMoney / 1000)}k` : valMoney}
                                        </text>
                                        {/* Right: Pax Axis (in Day mode) */}
                                        {filterMode === 'day' && (
                                            <text
                                                x={padLeft + plotWidth + 6}
                                                y={y + 3}
                                                textAnchor="start"
                                                fontSize="9"
                                                fontFamily="monospace"
                                                fill={colorAccent}
                                                fontWeight="bold"
                                            >
                                                {valPax}p
                                            </text>
                                        )}
                                    </g>
                                )
                            })}

                            {/* 3. Live Current Time Indicator Marker */}
                            {filterMode === 'day' && isViewingToday && currentBangkokTime.hour >= 11 && currentBangkokTime.hour <= 23 && (() => {
                                const curFraction = (currentBangkokTime.hour - 11 + currentBangkokTime.minute / 60) / (hours.length - 1)
                                const curX = padLeft + Math.max(0, Math.min(1, curFraction)) * plotWidth
                                return (
                                    <g key="live-time-indicator">
                                        <line
                                            x1={curX}
                                            y1={padYTop - 12}
                                            x2={curX}
                                            y2={padYTop + plotHeight}
                                            stroke={colorAccent2}
                                            strokeWidth="1.5"
                                            strokeDasharray="3 2"
                                        />
                                        <circle
                                            cx={curX}
                                            cy={padYTop + plotHeight}
                                            r="3"
                                            fill={colorAccent2}
                                        />
                                        <rect
                                            x={curX - 24}
                                            y={padYTop - 22}
                                            width="48"
                                            height="13"
                                            fill={colorAccent2}
                                            rx="2"
                                        />
                                        <text
                                            x={curX}
                                            y={padYTop - 12}
                                            textAnchor="middle"
                                            fontSize="8"
                                            fontFamily="monospace"
                                            fontWeight="bold"
                                            fill="white"
                                        >
                                            NOW {currentBangkokTime.label}
                                        </text>
                                    </g>
                                )
                            })()}

                            {/* 4. Month Mode: Weekday vs Weekend Dual Curves */}
                            {filterMode === 'month' && monthViewMode === 'weekday_weekend' && (
                                <>
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

                            {/* 5. Month Mode: Standard Hourly Sales Bars */}
                            {filterMode === 'month' && monthViewMode !== 'weekday_weekend' && (
                                monthMetrics?.monthlyAvgHourly.map((pt) => {
                                    const x = getX(pt.hour)
                                    const barH = getYBarHeight(pt.avgSales, Math.max(...monthMetrics.monthlyAvgHourly.map(p => p.avgSales) || [1000], 1000))
                                    const isHovered = hoveredHour === pt.hour
                                    return (
                                        <g key={pt.hour}>
                                            <rect
                                                x={x - 8}
                                                y={padYTop + plotHeight - barH}
                                                width={16}
                                                height={barH}
                                                fill={isHovered ? colorAccent : 'oklch(85% 0.012 28)'}
                                                className="transition-colors duration-150 cursor-pointer"
                                                onMouseEnter={() => setHoveredHour(pt.hour)}
                                                onMouseLeave={() => setHoveredHour(null)}
                                            />
                                        </g>
                                    )
                                })
                            )}

                            {/* 6. Day Mode: Ghost Baseline Bars & Solid Actual Pax Bars */}
                            {filterMode === 'day' && (
                                dayMetrics?.points.map((pt) => {
                                    const x = getX(pt.hour)
                                    const ghostBarH = getYBarHeight(pt.baselinePax, maxPaxScale)
                                    const actualBarH = getYBarHeight(pt.pax, maxPaxScale)
                                    const isHovered = hoveredHour === pt.hour
                                    const isPeak = dayMetrics.peakHourPoint?.hour === pt.hour && pt.pax > 0

                                    return (
                                        <g key={pt.hour}>
                                            {/* Expected Baseline Ghost Bar */}
                                            <rect
                                                x={x - 7}
                                                y={padYTop + plotHeight - ghostBarH}
                                                width={14}
                                                height={ghostBarH}
                                                fill="oklch(93% 0.012 28)"
                                                stroke="oklch(85% 0.012 28)"
                                                strokeWidth="1"
                                                strokeDasharray="2 2"
                                                className="pointer-events-none"
                                            />

                                            {/* Actual Pax Solid Bar */}
                                            {pt.pax > 0 && (
                                                <rect
                                                    x={x - 7}
                                                    y={padYTop + plotHeight - actualBarH}
                                                    width={14}
                                                    height={actualBarH}
                                                    fill={isHovered || isPeak ? colorAccent : 'oklch(60% 0.12 28)'}
                                                    className="transition-colors duration-150 pointer-events-none"
                                                />
                                            )}

                                            {/* Invisible Full-Height Touch/Hover Hitbox */}
                                            <rect
                                                x={x - (plotWidth / (hours.length - 1)) * 0.45}
                                                y={padYTop}
                                                width={(plotWidth / (hours.length - 1)) * 0.9}
                                                height={plotHeight}
                                                fill="transparent"
                                                className="cursor-pointer"
                                                onMouseEnter={() => setHoveredHour(pt.hour)}
                                                onMouseLeave={() => setHoveredHour(null)}
                                            />

                                            {/* Ad Intent Beacon Pin if leads happened at this hour */}
                                            {pt.adDirs > 0 && (
                                                <g>
                                                    <rect
                                                        x={x - 11}
                                                        y={padYTop - 7}
                                                        width="22"
                                                        height="11"
                                                        rx="1.5"
                                                        fill="oklch(45% 0.08 140)"
                                                    />
                                                    <text
                                                        x={x}
                                                        y={padYTop + 1}
                                                        textAnchor="middle"
                                                        className="font-mono text-[7px] font-bold fill-white"
                                                    >
                                                        DIR {pt.adDirs}
                                                    </text>
                                                </g>
                                            )}
                                        </g>
                                    )
                                })
                            )}

                            {/* ================================================================= */}
                            {/* 7. DAY MODE: DYNAMIC FORECAST STREAMLINE & CONFIDENCE FAN (PREDICT) */}
                            {/* ================================================================= */}
                            {filterMode === 'day' && (
                                <>
                                    {/* 4-Week Baseline Curve */}
                                    {pathBaselinePax && (
                                        <path
                                            d={pathBaselinePax}
                                            fill="none"
                                            stroke="oklch(65% 0.010 28)"
                                            strokeWidth="1.5"
                                            strokeDasharray="4 4"
                                        />
                                    )}

                                    {/* Shaded Forecast Confidence Fan (พื้นที่กรอบพยากรณ์ ต่ำ - สูง) */}
                                    {showPredict && pathForecastFan && (
                                        <path
                                            d={pathForecastFan}
                                            fill="oklch(52% 0.16 28)"
                                            opacity="0.12"
                                        />
                                    )}

                                    {/* Low Scenario Bound Line (ต่ำ) */}
                                    {showPredict && pathForecastLow && (
                                        <path
                                            d={pathForecastLow}
                                            fill="none"
                                            stroke="oklch(60% 0.015 28)"
                                            strokeWidth="1.2"
                                            strokeDasharray="4 3"
                                            opacity="0.75"
                                        />
                                    )}

                                    {/* High Scenario Bound Line (สูง) */}
                                    {showPredict && pathForecastHigh && (
                                        <path
                                            d={pathForecastHigh}
                                            fill="none"
                                            stroke="oklch(45% 0.08 140)"
                                            strokeWidth="1.4"
                                            strokeDasharray="4 3"
                                            opacity="0.85"
                                        />
                                    )}

                                    {/* Forecast Base Line (ANIMATED FLOWING DASH - เส้นประพยากรณ์ลูกค้า) */}
                                    {showPredict && pathForecastBase && (
                                        <path
                                            d={pathForecastBase}
                                            fill="none"
                                            stroke="oklch(52% 0.16 28)"
                                            strokeWidth={isMobile ? '2.2' : '2.8'}
                                            strokeDasharray="6 4"
                                            strokeLinecap="round"
                                            className="forecast-stream-line opacity-90"
                                        />
                                    )}

                                    {/* Actual Pax Solid Line */}
                                    {pathActualPax && (
                                        <path
                                            d={pathActualPax}
                                            fill="none"
                                            stroke="oklch(52% 0.16 28)"
                                            strokeWidth={isMobile ? '2.2' : '2.8'}
                                            strokeLinecap="round"
                                        />
                                    )}

                                    {/* Terminal Prediction Tags at 23:00 (Shown only when showPredict is ON) */}
                                    {showPredict && dayMetrics?.points && isViewingToday && (() => {
                                        const lastPt = dayMetrics.points[dayMetrics.points.length - 1]
                                        const fx = getX(23)
                                        const fyBase = getYPax(lastPt.forecast)
                                        const fyHigh = getYPax(lastPt.forecastHigh || lastPt.forecast)
                                        const fyLow = getYPax(lastPt.forecastLow || lastPt.forecast)

                                        return (
                                            <g key="terminal-pax-tags">
                                                {/* High Tag */}
                                                {lastPt.forecastHigh > lastPt.forecast && (
                                                    <g>
                                                        <circle cx={fx} cy={fyHigh} r="2.5" fill="oklch(45% 0.08 140)" />
                                                        <text
                                                            x={fx + 5}
                                                            y={fyHigh + 3}
                                                            textAnchor="start"
                                                            className="font-mono text-[8px] font-bold fill-[oklch(45%_0.08_140)] tabular-nums"
                                                        >
                                                            สูง ~{lastPt.forecastHigh}p
                                                        </text>
                                                    </g>
                                                )}

                                                {/* Base Tag (เส้นเดิม) */}
                                                <circle cx={fx} cy={fyBase} r="3" fill="oklch(52% 0.16 28)" />
                                                <text
                                                    x={fx + 5}
                                                    y={fyBase + 3}
                                                    textAnchor="start"
                                                    className="font-mono text-[8px] font-bold fill-[oklch(52%_0.16_28)] tabular-nums"
                                                >
                                                    ฐาน ~{lastPt.forecast}p
                                                </text>

                                                {/* Low Tag */}
                                                {lastPt.forecastLow < lastPt.forecast && (
                                                    <g>
                                                        <circle cx={fx} cy={fyLow} r="2.5" fill="oklch(60% 0.015 28)" />
                                                        <text
                                                            x={fx + 5}
                                                            y={fyLow + 3}
                                                            textAnchor="start"
                                                            className="font-mono text-[8px] fill-[oklch(60%_0.015_28)] tabular-nums"
                                                        >
                                                            ต่ำ ~{lastPt.forecastLow}p
                                                        </text>
                                                    </g>
                                                )}
                                            </g>
                                        )
                                    })()}
                                </>
                            )}

                            {/* ================================================================= */}
                            {/* 8. SALES VELOCITY PACING LINES LAYER                              */}
                            {/* ================================================================= */}
                            {filterMode === 'day' && (
                                <>
                                    {/* Benchmark Target Dotted Curve */}
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
                                                stroke="oklch(65% 0.010 28)"
                                                strokeWidth="1.5"
                                                strokeDasharray="3 3"
                                                opacity="0.85"
                                            />
                                        )
                                    })()}

                                    {/* Dashed Projected Sales Velocity Line (Shown only when showPredict is ON) */}
                                    {showPredict && pathForecastSales && (
                                        <path
                                            d={pathForecastSales}
                                            fill="none"
                                            stroke={colorInk}
                                            strokeWidth="2"
                                            strokeDasharray="4 3"
                                            strokeLinecap="round"
                                            opacity="0.8"
                                        />
                                    )}

                                    {/* Actual Cumulative Sales Solid Curve */}
                                    {(() => {
                                        const pts = dayMetrics?.activePoints || []
                                        if (pts.length === 0) return null
                                        const pathD = pts.reduce((acc, p, i) => {
                                            const x = getX(p.hour)
                                            const y = getYMoney(p.cumulativeSales)
                                            return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`
                                        }, '')
                                        return (
                                            <path
                                                d={pathD}
                                                fill="none"
                                                stroke={colorInk}
                                                strokeWidth="2.8"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        )
                                    })()}
                                </>
                            )}

                            {/* Month Mode: Cumulative Master Curve */}
                            {filterMode === 'month' && monthViewMode === 'pacing' && (() => {
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
                                        strokeWidth="2.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                )
                            })()}

                            {/* 9. X-Axis Hour Labels */}
                            {hours.map((h) => {
                                const x = getX(h)
                                const isHovered = hoveredHour === h
                                return (
                                    <g key={h}>
                                        <line
                                            x1={x}
                                            y1={padYTop + plotHeight}
                                            x2={x}
                                            y2={padYTop + plotHeight + 4}
                                            stroke={colorRule}
                                            strokeWidth="1"
                                        />
                                        <text
                                            x={x}
                                            y={padYTop + plotHeight + 16}
                                            textAnchor="middle"
                                            fontSize="9"
                                            fontFamily="monospace"
                                            fill={isHovered ? colorInk : colorMuted}
                                            fontWeight={isHovered ? 'bold' : 'normal'}
                                        >
                                            {h}:00
                                        </text>
                                    </g>
                                )
                            })}

                            {/* 10. Hover Crosshair Cursor */}
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
                                    {/* Crosshair dot on Money Curve */}
                                    <circle
                                        cx={getX(hoveredHour)}
                                        cy={getYMoney(
                                            filterMode === 'month'
                                                ? monthMetrics?.monthlyMasterPacing?.find(p => p.hour === hoveredHour)?.cumulativeAvgSales || 0
                                                : dayMetrics?.points?.find(p => p.hour === hoveredHour)?.cumulativeSales || 0
                                        )}
                                        r="4.5"
                                        fill={colorInk}
                                        stroke={colorPaper2}
                                        strokeWidth="2"
                                    />
                                    {/* Crosshair dot on Pax Curve */}
                                    {filterMode === 'day' && (
                                        <circle
                                            cx={getX(hoveredHour)}
                                            cy={getYPax(
                                                dayMetrics?.points?.find(p => p.hour === hoveredHour)?.pax ||
                                                dayMetrics?.points?.find(p => p.hour === hoveredHour)?.forecast || 0
                                            )}
                                            r="4"
                                            fill={colorAccent}
                                            stroke={colorPaper2}
                                            strokeWidth="2"
                                        />
                                    )}
                                </g>
                            )}
                        </svg>
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
                            ) : (() => {
                                const pt = dayMetrics?.points?.find(p => p.hour === hoveredHour)
                                return (
                                    <div className="flex items-center gap-4 flex-wrap">
                                        <div>
                                            <span className="text-[oklch(42%_0.010_28)]">
                                                {pt?.isFuture ? 'คาดการณ์ (FORECAST): ' : 'ลูกค้าจริง: '}
                                            </span>
                                            <span className="font-bold text-[oklch(52%_0.16_28)]">
                                                {pt?.isFuture ? `~${pt?.forecast} ท่าน (กรอบ ${pt?.forecastLow}-${pt?.forecastHigh})` : `${pt?.pax || 0} ท่าน`}
                                            </span>
                                            <span className="text-[10px] text-[oklch(42%_0.010_28)] ml-1">
                                                (สถิติปกติ: ~{pt?.baselinePax} ท่าน)
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[oklch(42%_0.010_28)]">ยอดขาย: </span>
                                            <span className="font-bold text-[oklch(18%_0.012_28)]">
                                                ฿{(pt?.sale || 0).toLocaleString()}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[oklch(42%_0.010_28)]">ยอดสะสม: </span>
                                            <span className="font-bold text-[oklch(18%_0.012_28)]">
                                                ฿{(pt?.cumulativeSales || 0).toLocaleString()}
                                            </span>
                                            <span className="text-[10px] text-[oklch(42%_0.010_28)] ml-1">
                                                (เป้า: ฿{(pt?.benchmarkCumulative || 0).toLocaleString()})
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[oklch(42%_0.010_28)]">เฉลี่ย/หัว: </span>
                                            <span className="font-bold text-[oklch(45%_0.08_140)]">
                                                ฿{pt?.spendPerHead || 0}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })()}
                        </div>
                    )}
                </div>
            )}

            {/* ========================================================================= */}
            {/* 4. VIEW 2: DEDICATED 4-DAYPARTS WORKBENCH (When activeSubTab === 'dayparts')*/}
            {/* ========================================================================= */}
            {((filterMode === 'day' && activeSubTab === 'dayparts') ||
              (filterMode === 'month' && monthViewMode === 'dayparts')) && (
                <div className="p-4 md:p-6 bg-[oklch(94%_0.010_28)] space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] uppercase">
                                DAYPART ANALYTICS // 04
                            </span>
                            <h4 className="font-bold text-sm md:text-base text-[oklch(18%_0.012_28)]">
                                {filterMode === 'month'
                                    ? `สัดส่วนรายได้และประสิทธิภาพแยก 4 ช่วงเวลาประจำเดือน ${selectedMonth || todayBangkok.slice(0, 7)}`
                                    : `สถิติและประสิทธิภาพแยก 4 ช่วงเวลาของวัน (${dayOfWeekThai} ${targetDateObj.toLocaleDateString('th-TH', { dateStyle: 'medium' })})`}
                            </h4>
                        </div>
                        <span className="text-xs font-mono text-[oklch(42%_0.010_28)]">
                            อัตราเร่งยอดขายรายชั่วโมง (฿ / Operational Hour)
                        </span>
                    </div>

                    {/* 4 Rich Daypart Dossier Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {(filterMode === 'month' ? monthMetrics?.monthlyDayparts : dayMetrics?.daypartBreakdown)?.map((dp) => {
                            const isPassed = dp.status === 'passed'
                            const isActive = dp.status === 'active'

                            return (
                                <div
                                    key={dp.id}
                                    className={`p-4 bg-[oklch(97%_0.008_28)] border transition-all space-y-3 ${
                                        isActive
                                            ? 'border-[oklch(52%_0.16_28)] shadow-sm ring-1 ring-[oklch(52%_0.16_28)]/20'
                                            : 'border-[oklch(85%_0.012_28)]'
                                    }`}
                                >
                                    {/* Card Header */}
                                    <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)] pb-2">
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-xs text-[oklch(18%_0.012_28)]">{dp.label}</span>
                                                {isActive && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-[oklch(52%_0.16_28)] animate-ping" />
                                                )}
                                            </div>
                                            <div className="text-[10px] font-mono text-[oklch(42%_0.010_28)]">
                                                {dp.thaiLabel} ({dp.rangeText})
                                            </div>
                                        </div>
                                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 ${
                                            isActive
                                                ? 'bg-[oklch(52%_0.16_28)] text-white'
                                                : isPassed
                                                ? 'bg-[oklch(88%_0.012_28)] text-[oklch(35%_0.010_28)]'
                                                : 'bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] text-[oklch(42%_0.010_28)]'
                                        }`}>
                                            {isActive ? 'NOW ACTIVE' : isPassed ? 'PASSED' : 'UPCOMING'}
                                        </span>
                                    </div>

                                    {/* Primary Figures */}
                                    <div className="space-y-1">
                                        <div className="flex items-baseline justify-between">
                                            <span className="font-mono text-xl font-bold text-[oklch(18%_0.012_28)]">
                                                ฿{dp.sales.toLocaleString()}
                                            </span>
                                            <span className="text-xs font-mono font-bold text-[oklch(52%_0.16_28)]">
                                                {dp.percent}%
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs font-mono text-[oklch(42%_0.010_28)]">
                                            <span>
                                                ลูกค้า: <strong className="text-[oklch(18%_0.012_28)]">{dp.pax}</strong> ท่าน
                                                {filterMode === 'day' && (
                                                    <span className="text-[10px] ml-1 text-[oklch(55%_0.010_28)]">(สถิติ ~{dp.baselinePax})</span>
                                                )}
                                            </span>
                                            <span>เฉลี่ย: ฿{dp.spendPerHead}/หัว</span>
                                        </div>
                                    </div>

                                    {/* Operational Velocity & Guidance */}
                                    <div className="pt-2 border-t border-[oklch(85%_0.012_28)] space-y-2">
                                        <div className="flex items-center justify-between text-[11px] font-mono">
                                            <span className="text-[oklch(42%_0.010_28)]">อัตราเร่ง:</span>
                                            <span className="font-bold text-[oklch(45%_0.08_140)]">
                                                ฿{dp.hourlyVelocity.toLocaleString()} / ชม.
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-[oklch(42%_0.010_28)] font-sans leading-tight">
                                            {dp.desc}
                                        </p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Hourly Daypart Performance Matrix Table */}
                    <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] overflow-hidden">
                        <div className="p-3 bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider">
                                HOURLY PERFORMANCE MATRIX // แจกแจงรายชั่วโมง 11:00 - 23:00
                            </span>
                            <span className="font-mono text-[11px] text-[oklch(42%_0.010_28)]">
                                13 กรอบเวลาปฏิบัติการ
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left font-mono text-xs divide-y divide-[oklch(85%_0.012_28)]">
                                <thead className="bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] text-[10px] uppercase">
                                    <tr>
                                        <th className="p-2.5">ชั่วโมง (Hour)</th>
                                        <th className="p-2.5">ช่วงเวลา (Daypart)</th>
                                        <th className="p-2.5 text-right">ลูกค้าจริง / คาดการณ์</th>
                                        <th className="p-2.5 text-right">ยอดขาย (฿)</th>
                                        <th className="p-2.5 text-right">ยอดสะสม (฿)</th>
                                        <th className="p-2.5 text-right">เฉลี่ย/หัว (฿)</th>
                                        <th className="p-2.5 text-right">จำนวนบิล</th>
                                        <th className="p-2.5 text-right">อัตราครองโต๊ะ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)]">
                                    {hours.map((h) => {
                                        const pt = dayMetrics?.points.find(p => p.hour === h)
                                        const dp = DAYPARTS.find(d => d.hours.includes(h))
                                        const isCurrentHour = isViewingToday && currentBangkokTime.hour === h

                                        return (
                                            <tr
                                                key={h}
                                                className={`transition-colors ${
                                                    isCurrentHour
                                                        ? 'bg-[oklch(52%_0.16_28)]/10 font-bold'
                                                        : 'hover:bg-[oklch(94%_0.010_28)]'
                                                }`}
                                            >
                                                <td className="p-2.5 font-bold text-[oklch(18%_0.012_28)] flex items-center gap-1.5">
                                                    <span>{h}:00 - {h + 1}:00</span>
                                                    {isCurrentHour && (
                                                        <span className="px-1 py-0.2 text-[8px] bg-[oklch(45%_0.08_140)] text-white uppercase">
                                                            NOW
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-2.5 text-[oklch(42%_0.010_28)]">
                                                    {dp?.label}
                                                </td>
                                                <td className="p-2.5 text-right">
                                                    <span className="font-bold text-[oklch(18%_0.012_28)]">
                                                        {pt?.isFuture ? `~${pt?.forecast}` : (pt?.pax || 0)}
                                                    </span>
                                                    <span className="text-[oklch(42%_0.010_28)] ml-1">
                                                        / สถิติ ~{pt?.baselinePax || 0}
                                                    </span>
                                                </td>
                                                <td className="p-2.5 text-right font-bold text-[oklch(18%_0.012_28)]">
                                                    ฿{(pt?.sale || 0).toLocaleString()}
                                                </td>
                                                <td className="p-2.5 text-right text-[oklch(18%_0.012_28)]">
                                                    ฿{(pt?.cumulativeSales || 0).toLocaleString()}
                                                </td>
                                                <td className="p-2.5 text-right text-[oklch(45%_0.08_140)]">
                                                    ฿{pt?.spendPerHead || 0}
                                                </td>
                                                <td className="p-2.5 text-right text-[oklch(42%_0.010_28)]">
                                                    {pt?.bills || 0} บิล
                                                </td>
                                                <td className="p-2.5 text-right">
                                                    <span className={`px-1.5 py-0.5 text-[10px] font-bold ${
                                                        (pt?.seatOccupancyPct || 0) > 60
                                                            ? 'bg-[oklch(52%_0.16_28)] text-white'
                                                            : 'bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)]'
                                                    }`}>
                                                        {pt?.seatOccupancyPct || 0}%
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 5. VIEW 3: ON-DEMAND AI STRATEGY & AD INTENT (When activeSubTab === 'ad_briefing') */}
            {/* ========================================================================= */}
            {filterMode === 'day' && activeSubTab === 'ad_briefing' && (
                <div className="p-4 md:p-6 bg-[oklch(94%_0.010_28)] space-y-6">
                    {/* Header Banner with Explicit AI Generation Button */}
                    <div className="p-4 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[oklch(85%_0.012_28)] pb-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-[oklch(52%_0.16_28)]" />
                                    <h4 className="font-bold text-sm md:text-base text-[oklch(18%_0.012_28)]">
                                        EXECUTIVE AI STRATEGY BRIEFING // วิเคราะห์และวางแผนกลยุทธ์กะนี้
                                    </h4>
                                </div>
                                <p className="text-xs font-mono text-[oklch(42%_0.010_28)] mt-0.5">
                                    สังเคราะห์ด้วย Gemini AI (สร้างเฉพาะตอนที่กดเท่านั้น ไม่ทำงานอัตโนมัติ)
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={generateAiBriefing}
                                    disabled={aiLoading}
                                    className="px-4 py-2 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(28%_0.012_28)] text-[oklch(97%_0.008_28)] font-mono text-xs font-bold transition-all disabled:opacity-50"
                                >
                                    {aiLoading ? 'กำลังประมวลผลข้อมูลกะ…' : 'สร้างบทวิเคราะห์ AI [GENERATE]'}
                                </button>
                                {aiBriefing && (
                                    <button
                                        onClick={() => setAiBriefing(null)}
                                        className="px-3 py-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] font-mono text-xs text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)]"
                                    >
                                        ล้าง [CLEAR]
                                    </button>
                                )}
                            </div>
                        </div>

                        {aiBriefing ? (
                            <div className="space-y-3 pt-2">
                                <div className="text-xs text-[oklch(18%_0.012_28)] whitespace-pre-line leading-relaxed font-sans bg-[oklch(94%_0.010_28)] p-4 border border-[oklch(85%_0.012_28)]">
                                    {aiBriefing}
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        onClick={copyBriefingToClipboard}
                                        className="px-3 py-1.5 font-mono text-xs font-bold text-[oklch(18%_0.012_28)] bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]"
                                    >
                                        {copiedBriefing ? '[คัดลอกลง Clipboard แล้ว]' : 'คัดลอกบทวิเคราะห์ [COPY]'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="py-8 text-center space-y-2">
                                <p className="text-xs font-mono text-[oklch(42%_0.010_28)]">
                                    ยังไม่มีบทวิเคราะห์ที่สร้างไว้ — กดปุ่ม &quot;สร้างบทวิเคราะห์ AI [GENERATE]&quot; เพื่อเริ่มการสังเคราะห์ข้อมูลความเร็วยอดขายและสัญญาณ Ad Leads
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Ad & Search Intent Leads Funnel */}
                    <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)] pb-2">
                            <span className="font-mono text-xs font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider">
                                AD & CUSTOMER SEARCH INTENT // สัญญาณความสนใจจากแคมเปญออนไลน์ ({adEvents.length} เหตุการณ์)
                            </span>
                            <span className="font-mono text-xs font-bold text-[oklch(45%_0.08_140)]">
                                {dayMetrics?.adHighIntent} High-Intent Leads
                            </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
                            <div className="p-2.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)]">
                                <span className="text-[10px] text-[oklch(42%_0.010_28)] block">ขอเส้นทาง (MAPS)</span>
                                <span className="text-base font-bold text-[oklch(18%_0.012_28)]">
                                    {adEvents.filter(e => ['click_directions', 'find_location'].includes(e.event_name)).length}
                                </span>
                            </div>
                            <div className="p-2.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)]">
                                <span className="text-[10px] text-[oklch(42%_0.010_28)] block">โทร / LINE</span>
                                <span className="text-base font-bold text-[oklch(18%_0.012_28)]">
                                    {adEvents.filter(e => ['click_phone', 'contact', 'click_line'].includes(e.event_name)).length}
                                </span>
                            </div>
                            <div className="p-2.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)]">
                                <span className="text-[10px] text-[oklch(42%_0.010_28)] block">จองโต๊ะ / สั่งกลับ</span>
                                <span className="text-base font-bold text-[oklch(45%_0.08_140)]">
                                    {adEvents.filter(e => ['click_booking_link', 'click_pickup_link'].includes(e.event_name)).length}
                                </span>
                            </div>
                            <div className="p-2.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)]">
                                <span className="text-[10px] text-[oklch(42%_0.010_28)] block">สำรวจเมนู / บรรยากาศ</span>
                                <span className="text-base font-bold text-[oklch(52%_0.16_28)]">
                                    {adEvents.filter(e => ['view_menu', 'explore_menu', 'view_vibe'].includes(e.event_name)).length}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 6. VIEW 4: MONTH MODE VELOCITY RANKINGS (When monthViewMode === 'ranking') */}
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

            {/* Quick Summary 4 Daypart Mini Cards when on chart view */}
            {filterMode === 'day' && activeSubTab === 'chart' && (
                <div className="p-4 md:p-6 bg-[oklch(94%_0.010_28)] space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] uppercase">
                                DAYPART SUMMARY
                            </span>
                            <span className="font-bold text-xs text-[oklch(18%_0.012_28)]">
                                สรุป 4 ช่วงเวลาประจำวัน (กดแท็บ &quot;4 ช่วงเวลา [DAYPARTS]&quot; ด้านบนเพื่อดูการวิเคราะห์เชิงลึก)
                            </span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 font-mono text-xs">
                        {dayMetrics?.daypartBreakdown.map((dp) => (
                            <div
                                key={dp.id}
                                onClick={() => setActiveSubTab('dayparts')}
                                className="p-3 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] hover:border-[oklch(52%_0.16_28)] cursor-pointer transition-all space-y-1"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-[11px] text-[oklch(18%_0.012_28)]">{dp.label}</span>
                                    <span className="text-[9px] px-1 py-0.2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)]">
                                        {dp.status.toUpperCase()}
                                    </span>
                                </div>
                                <div className="font-bold text-sm text-[oklch(18%_0.012_28)]">
                                    ฿{dp.sales.toLocaleString()}
                                </div>
                                <div className="text-[10px] text-[oklch(42%_0.010_28)] flex justify-between">
                                    <span>จริง: {dp.pax} ท่าน</span>
                                    <span>สถิติ: ~{dp.baselinePax}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
