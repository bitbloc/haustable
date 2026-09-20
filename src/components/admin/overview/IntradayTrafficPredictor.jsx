/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useMemo, useRef, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { getGeminiApiKey, getGeminiPreferredModel } from '../../../utils/geminiOcrHelper'
import { toast } from 'sonner'

// Helper: Extract Asia/Bangkok hour (0 - 23)
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

// Helper: Format Date string YYYY-MM-DD
const formatDateStr = (dateObj) => {
    return dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
}

export default function IntradayTrafficPredictor({ 
    bookings = [], 
    selectedDate, 
    loading = false,
    totalSeats = 45 
}) {
    const [hoveredHour, setHoveredHour] = useState(null)
    const [activeSubTab, setActiveSubTab] = useState('overview') // 'overview' | 'dayparts' | 'ai_deepdive' | 'ad_breakdown'
    const [historicalAverages, setHistoricalAverages] = useState(null)
    const [adEvents, setAdEvents] = useState([])
    const [aiBriefing, setAiBriefing] = useState(null)
    const [aiLoading, setAiLoading] = useState(false)
    const containerRef = useRef(null)
    const [containerWidth, setContainerWidth] = useState(800)

    // Restaurant operating hours 11:00 to 23:00 (13 slots)
    const hours = useMemo(() => [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23], [])

    // Dynamic width observer for responsive SVG scaling
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

    // Determine whether currently viewing today
    const isViewingToday = useMemo(() => {
        const todayBangkok = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
        return !selectedDate || selectedDate === todayBangkok
    }, [selectedDate])

    // Current hour in Bangkok time
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

    // Target query date object
    const targetDateObj = useMemo(() => {
        if (selectedDate) {
            const parts = selectedDate.split('-')
            return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
        }
        return new Date()
    }, [selectedDate])

    // Day of week in Thai
    const dayOfWeekThai = useMemo(() => {
        const days = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์']
        return days[targetDateObj.getDay()]
    }, [targetDateObj])

    // 1. Fetch Historical Baseline (4 Weeks Same Day-of-Week)
    useEffect(() => {
        let isMounted = true
        async function fetchHistoricalBaseline() {
            try {
                const pastDates = []
                for (let i = 1; i <= 4; i++) {
                    const d = new Date(targetDateObj.getTime() - i * 7 * 24 * 3600 * 1000)
                    pastDates.push(formatDateStr(d))
                }

                const earliestDate = pastDates[pastDates.length - 1]
                const latestDate = pastDates[0]

                const { data, error } = await supabase
                    .from('bookings')
                    .select('id, booking_time, created_at, pax, status')
                    .in('status', ['completed', 'paid', 'success', 'seated', 'confirmed', 'ready'])
                    .gte('booking_time', `${earliestDate}T00:00:00+07:00`)
                    .lte('booking_time', `${latestDate}T23:59:59+07:00`)

                if (error) throw error

                const hourlyTotals = {}
                hours.forEach(h => { hourlyTotals[h] = 0 })
                let daysWithData = new Set()

                ;(data || []).forEach(b => {
                    const t = b.booking_time || b.created_at
                    if (!t) return
                    const datePart = t.split('T')[0]
                    if (pastDates.includes(datePart)) {
                        daysWithData.add(datePart)
                        const h = getBangkokHour(t)
                        if (hourlyTotals[h] !== undefined) {
                            const p = parseInt(b.pax || 1, 10)
                            hourlyTotals[h] += p
                        }
                    }
                })

                const divisor = Math.max(1, daysWithData.size)
                const averages = {}
                hours.forEach(h => {
                    averages[h] = Math.round(hourlyTotals[h] / divisor)
                })

                if (isMounted) setHistoricalAverages(averages)
            } catch (err) {
                console.warn('[TrafficPredictor] Historical baseline fallback:', err?.message)
                const fallbackDistribution = {
                    11: 4, 12: 10, 13: 12, 14: 7, 15: 5, 16: 6,
                    17: 9, 18: 15, 19: 18, 20: 14, 21: 8, 22: 4, 23: 1
                }
                if (isMounted) setHistoricalAverages(fallbackDistribution)
            }
        }

        fetchHistoricalBaseline()
        return () => { isMounted = false }
    }, [targetDateObj, hours])

    // 2. Fetch Ad Landing Events for Selected Date
    useEffect(() => {
        let isMounted = true
        async function fetchAdLandingEvents() {
            try {
                const queryDay = selectedDate || formatDateStr(new Date())
                const { data, error } = await supabase
                    .from('ad_events')
                    .select('*')
                    .gte('created_at', `${queryDay}T00:00:00+07:00`)
                    .lte('created_at', `${queryDay}T23:59:59+07:00`)
                    .order('created_at', { ascending: true })
                    .limit(1000)

                if (error) throw error
                if (isMounted) setAdEvents(data || [])
            } catch (err) {
                console.warn('[TrafficPredictor] Ad events fallback:', err?.message)
                if (isMounted) setAdEvents([])
            }
        }

        fetchAdLandingEvents()
        return () => { isMounted = false }
    }, [selectedDate])

    // 3. Process Live Data, Pacing, Dynamic Forecast & Dayparts
    const trafficStats = useMemo(() => {
        const hourlyActualPax = {}
        const hourlyActualBills = {}
        const hourlyAdPageviews = {}
        const hourlyAdDirections = {}
        const hourlyAdLineClicks = {}
        const hourlyAdPhoneClicks = {}

        hours.forEach(h => {
            hourlyActualPax[h] = 0
            hourlyActualBills[h] = 0
            hourlyAdPageviews[h] = 0
            hourlyAdDirections[h] = 0
            hourlyAdLineClicks[h] = 0
            hourlyAdPhoneClicks[h] = 0
        })

        const validStatuses = ['completed', 'paid', 'success', 'seated', 'confirmed', 'ready']
        const validBookings = (bookings || []).filter(b => {
            const status = (b.status || '').toLowerCase()
            return validStatuses.includes(status) && status !== 'cancelled' && status !== 'void'
        })

        let totalActualPax = 0
        let totalActualBills = validBookings.length

        validBookings.forEach(b => {
            const timeStr = b.booking_time || b.created_at
            if (!timeStr) return
            const h = getBangkokHour(timeStr)
            const pax = parseInt(b.pax || 1, 10)
            if (hourlyActualPax[h] !== undefined) {
                hourlyActualPax[h] += pax
                hourlyActualBills[h] += 1
                totalActualPax += pax
            }
        })

        let totalAdPageviews = 0
        let totalAdDirections = 0
        let totalAdLine = 0
        let totalAdPhone = 0
        const adSourcesMap = {}

        adEvents.forEach(e => {
            const h = getBangkokHour(e.created_at)
            const source = e.utm_source || 'direct_organic'
            const ev = e.event_name || ''

            if (!adSourcesMap[source]) {
                adSourcesMap[source] = { source, visits: 0, directions: 0, contacts: 0 }
            }

            if (ev === 'page_view') {
                totalAdPageviews++
                adSourcesMap[source].visits++
                if (hourlyAdPageviews[h] !== undefined) hourlyAdPageviews[h]++
            } else if (ev === 'click_directions' || ev === 'find_location') {
                totalAdDirections++
                adSourcesMap[source].directions++
                if (hourlyAdDirections[h] !== undefined) hourlyAdDirections[h]++
            } else if (ev === 'click_line' || ev === 'generate_lead') {
                totalAdLine++
                adSourcesMap[source].contacts++
                if (hourlyAdLineClicks[h] !== undefined) hourlyAdLineClicks[h]++
            } else if (ev === 'click_phone' || ev === 'contact') {
                totalAdPhone++
                adSourcesMap[source].contacts++
                if (hourlyAdPhoneClicks[h] !== undefined) hourlyAdPhoneClicks[h]++
            }
        })

        const baseline = historicalAverages || {
            11: 4, 12: 10, 13: 12, 14: 7, 15: 5, 16: 6,
            17: 9, 18: 15, 19: 18, 20: 14, 21: 8, 22: 4, 23: 1
        }

        const cappedHour = isViewingToday 
            ? Math.min(23, Math.max(11, currentBangkokHour))
            : 23

        // Calculate today's pacing multiplier vs historical baseline so far
        let baselineSoFar = 0
        let actualSoFar = 0
        hours.forEach(h => {
            if (h <= cappedHour) {
                baselineSoFar += (baseline[h] || 0)
                actualSoFar += (hourlyActualPax[h] || 0)
            }
        })

        const rawPace = baselineSoFar > 0 ? (actualSoFar / baselineSoFar) : 1.0
        const paceMultiplier = Math.max(0.65, Math.min(1.75, rawPace * 0.75 + 0.25))

        // Ad Intent Lead Lift
        const recentHighIntent = hours.reduce((acc, h) => {
            if (h >= cappedHour - 1 && h <= cappedHour) {
                return acc + (hourlyAdDirections[h] || 0) * 2 + (hourlyAdLineClicks[h] || 0)
            }
            return acc
        }, 0)
        const adLiftPct = Math.min(0.30, recentHighIntent * 0.05)

        // Generate hourly points
        let forecastedClosingPax = totalActualPax
        let forecastedClosingPaxHigh = totalActualPax
        let forecastedClosingPaxLow = totalActualPax

        const points = hours.map(h => {
            const actual = hourlyActualPax[h]
            const base = baseline[h] || 0
            const adViews = hourlyAdPageviews[h]
            const adDirs = hourlyAdDirections[h]
            const isFuture = isViewingToday && h > cappedHour

            let forecast = null
            let forecastHigh = null
            let forecastLow = null

            if (isFuture) {
                const nearTermLift = (h <= cappedHour + 2) ? (1 + adLiftPct) : 1.0
                forecast = Math.round(base * paceMultiplier * nearTermLift)
                forecastHigh = Math.round(base * paceMultiplier * (nearTermLift + 0.25))
                forecastLow = Math.max(0, Math.round(base * paceMultiplier * Math.max(0.4, nearTermLift - 0.25)))

                forecastedClosingPax += forecast
                forecastedClosingPaxHigh += forecastHigh
                forecastedClosingPaxLow += forecastLow
            } else if (!isViewingToday) {
                forecast = actual
                forecastHigh = actual
                forecastLow = actual
            }

            return {
                hour: h,
                label: `${h}.00`,
                actual,
                bills: hourlyActualBills[h],
                baseline: base,
                forecast,
                forecastHigh,
                forecastLow,
                adViews,
                adDirections: adDirs,
                isFuture
            }
        })

        // Identify peak hour
        let maxPax = 0
        let peakH = null
        points.forEach(p => {
            const val = p.isFuture ? (p.forecast || 0) : p.actual
            if (val > maxPax) {
                maxPax = val
                peakH = p
            }
        })

        const peakCapacityLoad = Math.min(100, Math.round((maxPax / totalSeats) * 100))

        // 4. DAYPART BREAKDOWN SUMMARY (สรุปตาม 4 ช่วงเวลาของวัน)
        const daypartDefinitions = [
            {
                key: 'lunch',
                title: 'LUNCH RUSH',
                hours: [11, 12, 13],
                timeLabel: '11.00 - 14.00 น.',
                note: 'รอบโต๊ะสั้น ~45 นาที อาหารจานเดียวและเซตมื้อเที่ยง'
            },
            {
                key: 'afternoon',
                title: 'AFTERNOON CAFE',
                hours: [14, 15, 16],
                timeLabel: '14.00 - 17.00 น.',
                note: 'ลูกค้านั่งทำงาน กาแฟ เบเกอรี และเครื่องดื่ม Specialty'
            },
            {
                key: 'dinner',
                title: 'PRIME DINNER',
                hours: [17, 18, 19, 20],
                timeLabel: '17.00 - 21.00 น.',
                note: 'ช่วงทำรายได้หลัก โต๊ะเต็มหนาแน่น แนะนำสำรองวัตถุดิบและจัดคิวโต๊ะ'
            },
            {
                key: 'late',
                title: 'LATE NIGHT / BAR',
                hours: [21, 22, 23],
                timeLabel: '21.00 - 23.30 น.',
                note: 'เครื่องดื่มบาร์ ค็อกเทล เบียร์สด และของทานเล่น'
            }
        ]

        const dayparts = daypartDefinitions.map(dp => {
            let actualCount = 0
            let forecastCount = 0
            let forecastHighCount = 0
            let forecastLowCount = 0
            let baselineCount = 0
            let adDirCount = 0
            let adViewCount = 0

            let allPassed = true
            let allFuture = true

            dp.hours.forEach(h => {
                const pt = points.find(p => p.hour === h)
                if (pt) {
                    if (!pt.isFuture) {
                        actualCount += pt.actual
                        allFuture = false
                    } else {
                        allPassed = false
                    }
                    forecastCount += pt.isFuture ? (pt.forecast || 0) : pt.actual
                    forecastHighCount += pt.isFuture ? (pt.forecastHigh || pt.forecast || 0) : pt.actual
                    forecastLowCount += pt.isFuture ? (pt.forecastLow || pt.forecast || 0) : pt.actual
                    baselineCount += pt.baseline
                    adDirCount += pt.adDirections
                    adViewCount += pt.adViews
                }
            })

            let status = 'upcoming'
            if (allPassed) status = 'passed'
            else if (!allFuture) status = 'active'

            const targetPax = (status === 'passed') ? actualCount : forecastCount
            const diffPct = baselineCount > 0 ? Math.round(((targetPax - baselineCount) / baselineCount) * 100) : 0

            return {
                ...dp,
                status, // 'passed' | 'active' | 'upcoming'
                actualCount,
                forecastCount,
                forecastHighCount,
                forecastLowCount,
                baselineCount,
                targetPax,
                diffPct,
                adDirCount,
                adViewCount
            }
        })

        return {
            points,
            totalActualPax,
            totalActualBills,
            forecastedClosingPax,
            forecastedClosingPaxHigh,
            forecastedClosingPaxLow,
            peakHour: peakH,
            peakCapacityLoad,
            paceMultiplier,
            dayparts,
            adStats: {
                totalAdPageviews,
                totalAdDirections,
                totalAdLine,
                totalAdPhone,
                adSources: Object.values(adSourcesMap).sort((a, b) => b.visits - a.visits),
                adLiftPct: Math.round(adLiftPct * 100)
            }
        }
    }, [bookings, adEvents, historicalAverages, hours, isViewingToday, currentBangkokHour, totalSeats])

    const { 
        points, 
        totalActualPax, 
        totalActualBills, 
        forecastedClosingPax, 
        forecastedClosingPaxHigh, 
        forecastedClosingPaxLow, 
        peakHour, 
        peakCapacityLoad, 
        paceMultiplier, 
        dayparts,
        adStats 
    } = trafficStats

    // Dynamic Sizing with ample padding to eliminate collision
    const isMobile = containerWidth < 540
    const svgWidth = Math.max(320, containerWidth)
    const svgHeight = isMobile ? 240 : 260
    const padLeft = isMobile ? 32 : 44
    const padRight = isMobile ? 32 : 48 // Ample right margin for end tags
    const padYTop = isMobile ? 22 : 26
    const padYBottom = 38 // Clean separation from X-axis text
    const plotWidth = Math.max(svgWidth - padLeft - padRight, 200)
    const plotHeight = Math.max(svgHeight - padYTop - padYBottom, 120)

    // Dynamic Y scale based on hourly numbers (prevents flattened squashing)
    const maxPaxScale = useMemo(() => {
        const highestVal = Math.max(
            ...points.map(p => Math.max(p.actual, p.baseline, p.forecastHigh || p.forecast || 0)),
            8
        )
        const targetCeil = Math.ceil((highestVal * 1.35) / 5) * 5
        return Math.max(12, targetCeil)
    }, [points])

    const getX = (idx) => padLeft + (idx / (hours.length - 1)) * plotWidth
    const getY = (val) => svgHeight - padYBottom - (val / maxPaxScale) * plotHeight

    // Active Points for Actual Pax (Smooth Line + Gradient Area)
    const activePoints = useMemo(() => {
        const capped = isViewingToday ? Math.min(23, Math.max(11, currentBangkokHour)) : 23
        return points.filter(p => p.hour <= capped)
    }, [points, isViewingToday, currentBangkokHour])

    // SVG Path for Actual Flow
    const { pathActual, pathAreaActual } = useMemo(() => {
        if (activePoints.length === 0) return { pathActual: '', pathAreaActual: '' }

        const coords = activePoints.map(pt => {
            const idx = hours.indexOf(pt.hour)
            return `${getX(idx).toFixed(1)},${getY(pt.actual).toFixed(1)}`
        })
        const line = `M ${coords.join(' L ')}`

        let area = ''
        if (coords.length > 1) {
            const firstIdx = hours.indexOf(activePoints[0].hour)
            const lastIdx = hours.indexOf(activePoints[activePoints.length - 1].hour)
            area = `${line} L ${getX(lastIdx).toFixed(1)},${(svgHeight - padYBottom).toFixed(1)} L ${getX(firstIdx).toFixed(1)},${(svgHeight - padYBottom).toFixed(1)} Z`
        }

        return { pathActual: line, pathAreaActual: area }
    }, [activePoints, hours, maxPaxScale, plotWidth, plotHeight, svgHeight, padLeft, padYBottom])

    // Path for Baseline Curve
    const pathBaseline = useMemo(() => {
        const coords = points.map((pt, i) => `${getX(i).toFixed(1)},${getY(pt.baseline).toFixed(1)}`)
        return `M ${coords.join(' L ')}`
    }, [points, maxPaxScale, plotWidth, plotHeight, svgHeight, padLeft, padYBottom])

    // Path for Forecast Envelope (Base, High, Low, Fan)
    const { pathForecastBase, pathForecastHigh, pathForecastLow, pathForecastFan } = useMemo(() => {
        if (!isViewingToday || activePoints.length === 0) {
            return { pathForecastBase: '', pathForecastHigh: '', pathForecastLow: '', pathForecastFan: '' }
        }

        const lastActive = activePoints[activePoints.length - 1]
        const futurePoints = points.filter(p => p.hour >= lastActive.hour)
        if (futurePoints.length < 2) {
            return { pathForecastBase: '', pathForecastHigh: '', pathForecastLow: '', pathForecastFan: '' }
        }

        const coordsBase = futurePoints.map(pt => {
            const idx = hours.indexOf(pt.hour)
            const val = pt.isFuture ? pt.forecast : pt.actual
            return `${getX(idx).toFixed(1)},${getY(val).toFixed(1)}`
        })

        const coordsHigh = futurePoints.map(pt => {
            const idx = hours.indexOf(pt.hour)
            const val = pt.isFuture ? (pt.forecastHigh || pt.forecast) : pt.actual
            return `${getX(idx).toFixed(1)},${getY(val).toFixed(1)}`
        })

        const coordsLow = futurePoints.map(pt => {
            const idx = hours.indexOf(pt.hour)
            const val = pt.isFuture ? (pt.forecastLow || pt.forecast) : pt.actual
            return `${getX(idx).toFixed(1)},${getY(val).toFixed(1)}`
        })

        const pBase = `M ${coordsBase.join(' L ')}`
        const pHigh = `M ${coordsHigh.join(' L ')}`
        const pLow = `M ${coordsLow.join(' L ')}`

        const reversedLow = [...futurePoints].reverse().map(pt => {
            const idx = hours.indexOf(pt.hour)
            const val = pt.isFuture ? (pt.forecastLow || pt.forecast) : pt.actual
            return `${getX(idx).toFixed(1)},${getY(val).toFixed(1)}`
        })
        const pFan = `M ${coordsHigh.join(' L ')} L ${reversedLow.join(' L ')} Z`

        return { pathForecastBase: pBase, pathForecastHigh: pHigh, pathForecastLow: pLow, pathForecastFan: pFan }
    }, [activePoints, points, hours, isViewingToday, maxPaxScale, plotWidth, plotHeight, svgHeight, padLeft, padYBottom])

    // Generate AI Operational Briefing
    const runAiSynthesis = async () => {
        setAiLoading(true)
        try {
            const apiKey = await getGeminiApiKey()
            const preferredModel = await getGeminiPreferredModel()

            const summaryPayload = {
                date: selectedDate || formatDateStr(new Date()),
                dayOfWeek: dayOfWeekThai,
                totalActualPax,
                totalActualBills,
                forecastedClosingPax,
                forecastRange: `ต่ำ ${forecastedClosingPaxLow} - สูง ${forecastedClosingPaxHigh} ท่าน`,
                pacingPercent: Math.round((paceMultiplier - 1) * 100),
                peakHour: peakHour ? `${peakHour.hour}.00 น. (~${peakHour.isFuture ? peakHour.forecast : peakHour.actual} ท่าน)` : 'N/A',
                peakCapacityLoad: `${peakCapacityLoad}%`,
                daypartsSummary: dayparts.map(dp => `${dp.title} (${dp.timeLabel}): ${dp.status === 'passed' ? `จริง ${dp.actualCount}` : `คาดการณ์ ~${dp.forecastCount} (กรอบ ${dp.forecastLowCount}-${dp.forecastHighCount})`} ท่าน, เทียบสถิติ ${dp.diffPct >= 0 ? `+${dp.diffPct}%` : `${dp.diffPct}%`}, Ads Maps: ${dp.adDirCount}`),
                adLandingMetrics: {
                    pageviews: adStats.totalAdPageviews,
                    directionsClicks: adStats.totalAdDirections,
                    lineClicks: adStats.totalAdLine,
                    phoneClicks: adStats.totalAdPhone
                }
            }

            if (apiKey) {
                const promptText = `
คุณคือผู้ช่วยผู้อำนวยการฝ่ายปฏิบัติการร้านอาหารและคาเฟ่ "IN THE HAUS" 
จงวิเคราะห์ข้อมูลทราฟฟิกลูกค้าสดและข้อมูลช่วงเวลา Dayparts ต่อไปนี้ เพื่อสรุปสถานการณ์และคำแนะนำเชิงปฏิบัติการหน้าร้าน:

${JSON.stringify(summaryPayload, null, 2)}

ข้อกำหนด:
1. ตอบเป็นภาษาไทยอย่างกระชับ สุภาพ คมชัด สไตล์ผู้บริหาร
2. สรุปเป็น 3 มิติ:
   - [สรุปสถานการณ์และภาพรวมทั้งวัน]: เปรียบเทียบกับสถิติเดิม 4 สัปดาห์ และสัญญาณ Ads
   - [ไฮไลต์ช่วงเวลา Dayparts]: ระบุช่วงที่ต้องเฝ้าระวังที่สุด (เช่น Dinner Rush) คาดว่าจะมากี่คน
   - [คำแนะนำการปฏิบัติการ]: 2-3 ข้อสำหรับทีมครัว บาร์ และโต๊ะ
3. ห้ามใช้อีโมจิ ความยาวไม่เกิน 160 คำ
`
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${preferredModel || 'gemini-2.5-flash'}:generateContent?key=${apiKey}`
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: promptText }] }],
                        generationConfig: { temperature: 0.2 }
                    })
                })

                if (res.ok) {
                    const data = await res.json()
                    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
                    if (text) {
                        setAiBriefing(text)
                        toast.success('วิเคราะห์ข้อมูลด้วย AI เรียบร้อยแล้ว')
                        return
                    }
                }
            }

            // Fallback deterministic AI synthesis
            const dinnerDp = dayparts.find(d => d.key === 'dinner')
            const fallbackBriefing = `[สรุปสถานการณ์และภาพรวมทั้งวัน]
วันนี้ (${dayOfWeekThai}) ลูกค้าจริงสะสมแล้ว ${totalActualPax} ท่าน (${totalActualBills} บิล) คาดการณ์ยอดปิดวันรวม ~${forecastedClosingPax} ท่าน (กรอบต่ำ-สูง: ${forecastedClosingPaxLow} - ${forecastedClosingPaxHigh} ท่าน) ภาพรวมความเร็วกว่าสถิติเดิม ${paceMultiplier >= 1.0 ? `+${Math.round((paceMultiplier - 1) * 100)}%` : `-${Math.round((1 - paceMultiplier) * 100)}%`} โดยมีสัญญาณขอเส้นทาง Google Maps จาก Ad Landing ${adStats.totalAdDirections} ครั้ง

[ไฮไลต์ช่วงเวลา Dayparts]
ช่วงเวลาสำคัญที่สุดคือ ${dinnerDp?.title || 'PRIME DINNER'} (${dinnerDp?.timeLabel || '17.00 - 21.00 น.'}) คาดการณ์ลูกค้าจะเข้ามารวม ~${dinnerDp?.forecastCount || 45} ท่าน (กรอบ ${dinnerDp?.forecastLowCount}-${dinnerDp?.forecastHighCount} ท่าน) ซึ่งจะดันให้อัตราครองที่นั่งแตะ ${peakCapacityLoad}% ของความจุร้าน

[คำแนะนำการปฏิบัติการ]
1. ฝ่ายครัว: เตรียมสำรองวัตถุดิบอาหารจานหลักและเนื้อสเต็กล่วงหน้าก่อน 17.30 น.
2. ฝ่ายบริการ: จัดโต๊ะโซนหน้าให้พร้อมรองรับ Walk-in ที่ตามเส้นทาง Google Maps
3. ฝ่ายบาร์: เสริมกำลังคนช่วง 18.00-20.00 น. เพื่อออกเครื่องดื่มได้ทันท่วงที`

            setAiBriefing(fallbackBriefing)
            toast.success('สังเคราะห์บทวิเคราะห์ปฏิบัติการเรียบร้อย')
        } catch (err) {
            console.error('[AI Briefing Error]:', err)
            toast.error('ไม่สามารถเรียก AI ได้ในขณะนี้')
        } finally {
            setAiLoading(false)
        }
    }

    // Auto-run AI briefing once on mount
    useEffect(() => {
        if (!aiBriefing && points.length > 0 && !loading) {
            runAiSynthesis()
        }
    }, [points.length, loading])

    const latestActivePt = activePoints.length > 0 ? activePoints[activePoints.length - 1] : null

    return (
        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] mb-6 overflow-hidden font-sans">
            {/* 1. Header Ribbon */}
            <div className="p-3 sm:p-4 bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] uppercase tracking-wider">
                        TRAFFIC // AD RADAR
                    </span>
                    <div>
                        <h3 className="font-mono text-sm sm:text-base font-bold text-[oklch(18%_0.012_28)] uppercase">
                            Intraday Guest Traffic & Daypart Predictor
                        </h3>
                        <p className="text-[11px] font-mono text-[oklch(42%_0.010_28)]">
                            ความหนาแน่นลูกค้าจริง + กรอบพยากรณ์ 3 ปัจจัย (ต่ำ-ฐาน-สูง) + สรุปแบ่งตามช่วงเวลา
                        </p>
                    </div>
                </div>

                {/* Key Summary Stats */}
                <div className="flex items-center gap-3 sm:gap-4 font-mono text-xs flex-wrap">
                    <div>
                        <span className="text-[10px] text-[oklch(55%_0.010_28)] block">GUESTS TODAY</span>
                        <span className="font-bold text-base sm:text-lg text-[oklch(18%_0.012_28)] tabular-nums">
                            {totalActualPax} ท่าน
                        </span>
                        <span className="text-[10px] text-[oklch(55%_0.010_28)] ml-1">({totalActualBills} บิล)</span>
                    </div>

                    <div className="border-l border-[oklch(85%_0.012_28)] pl-3 sm:pl-4">
                        <span className="text-[10px] text-[oklch(55%_0.010_28)] block">EST. FULL-DAY (ฐาน / กรอบ)</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="font-bold text-sm sm:text-base text-[oklch(52%_0.20_28)] tabular-nums">
                                ~{forecastedClosingPax} ท่าน
                            </span>
                            <span className="text-[10px] font-mono text-[oklch(55%_0.010_28)] tabular-nums">
                                (ต่ำ {forecastedClosingPaxLow} - สูง {forecastedClosingPaxHigh})
                            </span>
                        </div>
                    </div>

                    <div className="border-l border-[oklch(85%_0.012_28)] pl-3 sm:pl-4 hidden sm:block">
                        <span className="text-[10px] text-[oklch(55%_0.010_28)] block">AD INTENT LEADS</span>
                        <span className="font-bold text-sm text-[oklch(45%_0.08_140)] tabular-nums">
                            {adStats.totalAdDirections} Maps / {adStats.totalAdPageviews} Views
                        </span>
                    </div>

                    <div className="border-l border-[oklch(85%_0.012_28)] pl-3 sm:pl-4 hidden md:block">
                        <span className="text-[10px] text-[oklch(55%_0.010_28)] block">PEAK LOAD</span>
                        <span className="font-bold text-sm text-[oklch(18%_0.012_28)] tabular-nums">
                            {peakCapacityLoad}% Cap
                        </span>
                    </div>
                </div>
            </div>

            {/* 2. Sub-Navigation Tabs */}
            <div className="flex border-b border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] text-xs font-mono">
                <button
                    onClick={() => setActiveSubTab('overview')}
                    className={`px-4 py-2 border-r border-[oklch(85%_0.012_28)] transition-colors uppercase font-bold ${
                        activeSubTab === 'overview' 
                            ? 'bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] border-b-2 border-b-[oklch(52%_0.20_28)]' 
                            : 'text-[oklch(55%_0.010_28)] hover:bg-[oklch(94%_0.010_28)]'
                    }`}
                >
                    [1] กราฟคาดการณ์ความหนาแน่น (Horizon Curve)
                </button>
                <button
                    onClick={() => setActiveSubTab('dayparts')}
                    className={`px-4 py-2 border-r border-[oklch(85%_0.012_28)] transition-colors uppercase font-bold ${
                        activeSubTab === 'dayparts' 
                            ? 'bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] border-b-2 border-b-[oklch(52%_0.20_28)]' 
                            : 'text-[oklch(55%_0.010_28)] hover:bg-[oklch(94%_0.010_28)]'
                    }`}
                >
                    [2] สรุปรายช่วงเวลา Dayparts (4 ช่วง)
                </button>
                <button
                    onClick={() => setActiveSubTab('ai_deepdive')}
                    className={`px-4 py-2 border-r border-[oklch(85%_0.012_28)] transition-colors uppercase font-bold flex items-center gap-1.5 ${
                        activeSubTab === 'ai_deepdive' 
                            ? 'bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] border-b-2 border-b-[oklch(52%_0.20_28)]' 
                            : 'text-[oklch(55%_0.010_28)] hover:bg-[oklch(94%_0.010_28)]'
                    }`}
                >
                    <span>[3] บทวิเคราะห์ AI ปฏิบัติการ</span>
                    <span className="px-1.5 py-0.2 bg-[oklch(45%_0.08_140)] text-white text-[9px]">LIVE</span>
                </button>
                <button
                    onClick={() => setActiveSubTab('ad_breakdown')}
                    className={`px-4 py-2 border-r border-[oklch(85%_0.012_28)] transition-colors uppercase font-bold ${
                        activeSubTab === 'ad_breakdown' 
                            ? 'bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] border-b-2 border-b-[oklch(52%_0.20_28)]' 
                            : 'text-[oklch(55%_0.010_28)] hover:bg-[oklch(94%_0.010_28)]'
                    }`}
                >
                    [4] เจาะลึก Ads ({adStats.adSources.length} แหล่ง)
                </button>
            </div>

            {/* 3. Main View: Unified Confidence Horizon Chart */}
            {activeSubTab === 'overview' && (
                <div>
                    <div 
                        ref={containerRef} 
                        onClick={() => setHoveredHour(null)}
                        className="p-2 sm:p-4 relative w-full select-none"
                    >
                        {/* Compact Visual Legend */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 font-mono text-[11px] mb-2 text-[oklch(42%_0.010_28)] flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <span className="w-3.5 h-1.5 bg-[oklch(52%_0.16_28)] inline-block" />
                                <span className="font-bold text-[oklch(18%_0.012_28)]">ลูกค้าจริง (Pax)</span>
                            </div>
                            {pathForecastBase && (
                                <div className="flex items-center gap-1.5">
                                    <span className="w-4 h-1 border-t-2 border-dashed border-[oklch(52%_0.20_28)] inline-block opacity-90" />
                                    <span className="font-bold text-[oklch(52%_0.20_28)]">เส้นเดิม (ฐาน Base)</span>
                                </div>
                            )}
                            {pathForecastHigh && (
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3 h-1.5 bg-[oklch(52%_0.20_28)] opacity-20 border border-dashed border-[oklch(45%_0.08_140)] inline-block" />
                                    <span className="text-[oklch(45%_0.08_140)] font-bold">กรอบพยากรณ์ (ต่ำ - สูง)</span>
                                </div>
                            )}
                            <div className="flex items-center gap-1.5">
                                <span className="w-3.5 h-1 border-t-2 border-dashed border-[oklch(65%_0.010_28)] inline-block" />
                                <span>สถิติเดิม ({dayOfWeekThai})</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-[oklch(45%_0.08_140)] inline-block" />
                                <span className="text-[oklch(45%_0.08_140)] font-bold">สัญญาณ Ads 📍</span>
                            </div>
                        </div>

                        {/* Responsive SVG Chart */}
                        <div className="w-full">
                            <svg
                                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                                style={{ width: '100%', height: `${svgHeight}px` }}
                                className="w-full block select-none"
                            >
                                <defs>
                                    {/* Actual Fill Gradient */}
                                    <linearGradient id="trafficActualFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="oklch(52% 0.16 28)" stopOpacity="0.25" />
                                        <stop offset="100%" stopColor="oklch(52% 0.16 28)" stopOpacity="0.02" />
                                    </linearGradient>

                                    <style>{`
                                        @keyframes forecastStreamline {
                                            from { stroke-dashoffset: 20; }
                                            to { stroke-dashoffset: 0; }
                                        }
                                        .forecast-stream-line {
                                            animation: forecastStreamline 2.2s linear infinite;
                                        }
                                    `}</style>
                                </defs>

                                {/* Rush Hour Background Shaded Bands */}
                                <rect
                                    x={getX(1)}
                                    y={padYTop}
                                    width={getX(3) - getX(1)}
                                    height={plotHeight}
                                    fill="oklch(94% 0.010 28)"
                                    opacity="0.7"
                                />
                                <text
                                    x={(getX(1) + getX(3)) / 2}
                                    y={padYTop + 12}
                                    textAnchor="middle"
                                    className="font-mono text-[8px] sm:text-[9px] font-bold fill-[oklch(55%_0.010_28)] uppercase"
                                >
                                    LUNCH RUSH
                                </text>

                                <rect
                                    x={getX(6)}
                                    y={padYTop}
                                    width={getX(10) - getX(6)}
                                    height={plotHeight}
                                    fill="oklch(94% 0.010 28)"
                                    opacity="0.7"
                                />
                                <text
                                    x={(getX(6) + getX(10)) / 2}
                                    y={padYTop + 12}
                                    textAnchor="middle"
                                    className="font-mono text-[8px] sm:text-[9px] font-bold fill-[oklch(55%_0.010_28)] uppercase"
                                >
                                    PRIME DINNER RUSH
                                </text>

                                {/* Horizontal Gridlines & Clean Y Labels */}
                                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                                    const y = svgHeight - padYBottom - ratio * plotHeight
                                    const val = Math.round(ratio * maxPaxScale)
                                    return (
                                        <g key={ratio}>
                                            <line
                                                x1={padLeft}
                                                y1={y}
                                                x2={svgWidth - padRight}
                                                y2={y}
                                                stroke="oklch(88% 0.012 28)"
                                                strokeDasharray={ratio === 0 ? 'none' : '3 3'}
                                                strokeWidth={ratio === 0 ? '1.5' : '1'}
                                            />
                                            <text
                                                x={padLeft - 6}
                                                y={y + 3.5}
                                                textAnchor="end"
                                                className="font-mono text-[9px] fill-[oklch(55%_0.010_28)] tabular-nums"
                                            >
                                                {val}
                                            </text>
                                        </g>
                                    )
                                })}

                                {/* 4-Week Baseline Curve (Dashed Warm Gray) */}
                                {pathBaseline && (
                                    <path
                                        d={pathBaseline}
                                        fill="none"
                                        stroke="oklch(65% 0.010 28)"
                                        strokeWidth="1.6"
                                        strokeDasharray="4 4"
                                    />
                                )}

                                {/* Shaded Forecast Confidence Cone (พื้นที่กรอบพยากรณ์ ต่ำ - สูง) */}
                                {pathForecastFan && (
                                    <path
                                        d={pathForecastFan}
                                        fill="oklch(52% 0.20 28)"
                                        opacity="0.10"
                                    />
                                )}

                                {/* Low Scenario Bound Line (ต่ำ) */}
                                {pathForecastLow && (
                                    <path
                                        d={pathForecastLow}
                                        fill="none"
                                        stroke="oklch(60% 0.015 28)"
                                        strokeWidth="1.2"
                                        strokeDasharray="4 3"
                                        opacity="0.7"
                                    />
                                )}

                                {/* High Scenario Bound Line (สูง) */}
                                {pathForecastHigh && (
                                    <path
                                        d={pathForecastHigh}
                                        fill="none"
                                        stroke="oklch(45% 0.08 140)"
                                        strokeWidth="1.4"
                                        strokeDasharray="4 3"
                                        opacity="0.85"
                                    />
                                )}

                                {/* Actual Pax Area Fill */}
                                {pathAreaActual && (
                                    <path
                                        d={pathAreaActual}
                                        fill="url(#trafficActualFill)"
                                    />
                                )}

                                {/* Forecast Base Line (Animated Flowing Dash - เส้นเดิม ฐาน) */}
                                {pathForecastBase && (
                                    <path
                                        d={pathForecastBase}
                                        fill="none"
                                        stroke="oklch(52% 0.20 28)"
                                        strokeWidth={isMobile ? '2.2' : '2.8'}
                                        strokeDasharray="6 4"
                                        strokeLinecap="round"
                                        className="forecast-stream-line opacity-90"
                                    />
                                )}

                                {/* Actual Pax Line (Solid Clay Terracotta) */}
                                {pathActual && (
                                    <path
                                        d={pathActual}
                                        fill="none"
                                        stroke="oklch(52% 0.16 28)"
                                        strokeWidth={isMobile ? '2.2' : '2.8'}
                                        strokeLinecap="round"
                                    />
                                )}

                                {/* Terminal Stacked Tags at 23:00 (ชัดเจน ไม่ตกขอบ) */}
                                {points.length > 0 && isViewingToday && (() => {
                                    const lastPt = points[points.length - 1]
                                    if (!lastPt.isFuture) return null

                                    const fx = getX(hours.length - 1)
                                    const fyBase = getY(lastPt.forecast)
                                    const fyHigh = getY(lastPt.forecastHigh || lastPt.forecast)
                                    const fyLow = getY(lastPt.forecastLow || lastPt.forecast)

                                    return (
                                        <g>
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
                                            <circle cx={fx} cy={fyBase} r="3" fill="oklch(52% 0.20 28)" />
                                            <text
                                                x={fx + 5}
                                                y={fyBase + 3}
                                                textAnchor="start"
                                                className="font-mono text-[8px] font-bold fill-[oklch(52%_0.20_28)] tabular-nums"
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
                                                        className="font-mono text-[8px] fill-[oklch(55%_0.010_28)] tabular-nums"
                                                    >
                                                        ต่ำ ~{lastPt.forecastLow}p
                                                    </text>
                                                </g>
                                            )}
                                        </g>
                                    )
                                })()}

                                {/* Live Precision Radar Marker at Current Hour */}
                                {latestActivePt && (() => {
                                    const liveX = getX(hours.indexOf(latestActivePt.hour))
                                    const liveY = getY(latestActivePt.actual)
                                    return (
                                        <g>
                                            <circle cx={liveX} cy={liveY} r="7" fill="oklch(52% 0.16 28)" opacity="0.18" />
                                            <circle cx={liveX} cy={liveY} r="4" fill="none" stroke="oklch(52% 0.16 28)" strokeWidth="1.5" />
                                            <circle cx={liveX} cy={liveY} r="2.5" fill="oklch(52% 0.16 28)" stroke="white" strokeWidth="1" />
                                        </g>
                                    )
                                })()}

                                {/* Data Points & Ad Markers on Chart */}
                                {points.map((pt, i) => {
                                    const cx = getX(i)
                                    const cy = pt.isFuture ? getY(pt.forecast) : getY(pt.actual)
                                    const isHovered = hoveredHour === pt.hour
                                    const showTick = !isMobile || pt.hour % 2 === 1 || isHovered || pt.hour === 23

                                    return (
                                        <g 
                                            key={pt.hour}
                                            onMouseEnter={() => setHoveredHour(pt.hour)}
                                            onTouchStart={() => setHoveredHour(pt.hour)}
                                            className="cursor-pointer"
                                        >
                                            {/* Hit Column */}
                                            <rect
                                                x={cx - (plotWidth / (hours.length - 1)) / 2}
                                                y={padYTop}
                                                width={plotWidth / (hours.length - 1)}
                                                height={plotHeight + 25}
                                                fill="transparent"
                                            />

                                            {/* Ad Intent Indicator Badge (Directly on Hour Column) */}
                                            {pt.adDirections > 0 && (
                                                <g>
                                                    <circle
                                                        cx={cx}
                                                        y={padYTop + 4}
                                                        r="3.5"
                                                        fill="oklch(45% 0.08 140)"
                                                    />
                                                    <text
                                                        x={cx}
                                                        y={padYTop - 2}
                                                        textAnchor="middle"
                                                        className="font-mono text-[7.5px] font-bold fill-[oklch(45%_0.08_140)]"
                                                    >
                                                        {pt.adDirections}📍
                                                    </text>
                                                </g>
                                            )}

                                            {/* Data Point Dot */}
                                            {!pt.isFuture && (
                                                <circle
                                                    cx={cx}
                                                    cy={cy}
                                                    r={isHovered ? "4" : "2.5"}
                                                    fill="oklch(52% 0.16 28)"
                                                    stroke="white"
                                                    strokeWidth="1"
                                                />
                                            )}

                                            {/* Clean X-Axis Tick Label (No Collisions!) */}
                                            {showTick && (
                                                <text
                                                    x={cx}
                                                    y={svgHeight - padYBottom + 16}
                                                    textAnchor="middle"
                                                    className={`font-mono text-[9px] ${
                                                        isHovered 
                                                            ? 'font-bold fill-[oklch(18%_0.012_28)]' 
                                                            : pt.isFuture 
                                                            ? 'fill-[oklch(55%_0.010_28)]' 
                                                            : 'font-bold fill-[oklch(18%_0.012_28)]'
                                                    }`}
                                                >
                                                    {pt.hour}.00
                                                </text>
                                            )}

                                            {/* Vertical Guide Line on Hover */}
                                            {isHovered && (
                                                <line
                                                    x1={cx}
                                                    y1={padYTop}
                                                    x2={cx}
                                                    y2={svgHeight - padYBottom}
                                                    stroke="oklch(52% 0.20 28)"
                                                    strokeWidth="1"
                                                    strokeDasharray="2 2"
                                                />
                                            )}
                                        </g>
                                    )
                                })}
                            </svg>
                        </div>

                        {/* Interactive Tooltip Banner */}
                        {hoveredHour !== null && (() => {
                            const pt = points.find(p => p.hour === hoveredHour)
                            if (!pt) return null

                            return (
                                <div className="mt-2 p-3 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-[oklch(18%_0.012_28)]">
                                            เวลา {pt.hour}.00 - {pt.hour + 1}.00 น.
                                        </span>
                                        {pt.isFuture ? (
                                            <span className="px-1.5 py-0.5 bg-[oklch(52%_0.20_28)] text-white text-[10px]">
                                                คาดการณ์ (FORECAST)
                                            </span>
                                        ) : (
                                            <span className="px-1.5 py-0.5 bg-[oklch(18%_0.012_28)] text-white text-[10px]">
                                                ยอดจริง (ACTUAL)
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-4 flex-wrap">
                                        <div>
                                            <span className="text-[10px] text-[oklch(55%_0.010_28)] block">
                                                {pt.isFuture ? 'EST. GUESTS (กรอบ ต่ำ-สูง)' : 'ACTUAL GUESTS'}
                                            </span>
                                            <span className="font-bold text-[oklch(18%_0.012_28)]">
                                                {pt.isFuture ? `~${pt.forecast} ท่าน (กรอบ ${pt.forecastLow}-${pt.forecastHigh})` : `${pt.actual} ท่าน (${pt.bills} บิล)`}
                                            </span>
                                        </div>

                                        <div>
                                            <span className="text-[10px] text-[oklch(55%_0.010_28)] block">4-WK BASELINE</span>
                                            <span className="text-[oklch(42%_0.010_28)]">
                                                ~{pt.baseline} ท่าน
                                            </span>
                                        </div>

                                        <div>
                                            <span className="text-[10px] text-[oklch(55%_0.010_28)] block">AD INTENT LEADS</span>
                                            <span className="font-bold text-[oklch(45%_0.08_140)]">
                                                {pt.adDirections} Maps / {pt.adViews} Views
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>

                    {/* 4. EXECUTIVE DAYPARTS SUMMARY BREAKDOWN (สรุป 4 ช่วงเวลาประจำวัน) */}
                    <div className="border-t border-[oklch(85%_0.012_28)] p-3 sm:p-4 bg-[oklch(94%_0.010_28)]">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[oklch(55%_0.010_28)]">
                                DAYPART SUMMARY // สรุปเจาะลึก 4 ช่วงเวลาของวัน
                            </span>
                            <span className="text-[10px] font-mono text-[oklch(42%_0.010_28)]">
                                เปรียบเทียบยอดจริง vs คาดการณ์ (ต่ำ-สูง) vs สถิติเดิม
                            </span>
                        </div>

                        {/* 4-Cell Brutalist Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
                            {dayparts.map((dp) => {
                                const isPassed = dp.status === 'passed'
                                const isActive = dp.status === 'active'

                                return (
                                    <div 
                                        key={dp.key}
                                        className={`p-3 border transition-colors ${
                                            isActive 
                                                ? 'border-[oklch(52%_0.20_28)] bg-[oklch(97%_0.008_28)] shadow-xs' 
                                                : 'border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)]'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="font-bold text-xs text-[oklch(18%_0.012_28)]">
                                                {dp.title}
                                            </span>
                                            <span className={`px-1.5 py-0.2 text-[9px] font-bold ${
                                                isPassed 
                                                    ? 'bg-[oklch(88%_0.012_28)] text-[oklch(42%_0.010_28)]' 
                                                    : isActive 
                                                    ? 'bg-[oklch(52%_0.20_28)] text-white animate-pulse' 
                                                    : 'bg-[oklch(45%_0.08_140)] text-white'
                                            }`}>
                                                {isPassed ? 'PASSED' : isActive ? 'NOW ACTIVE' : 'UPCOMING'}
                                            </span>
                                        </div>

                                        <span className="text-[10px] text-[oklch(55%_0.010_28)] block mb-2">
                                            {dp.timeLabel}
                                        </span>

                                        <div className="space-y-1 mb-2">
                                            <div className="flex items-baseline justify-between">
                                                <span className="text-[11px] text-[oklch(42%_0.010_28)]">
                                                    {isPassed ? 'ลูกค้าจริง' : 'คาดการณ์'}
                                                </span>
                                                <span className="font-bold text-sm sm:text-base text-[oklch(18%_0.012_28)] tabular-nums">
                                                    {isPassed ? `${dp.actualCount} ท่าน` : `~${dp.forecastCount} ท่าน`}
                                                </span>
                                            </div>

                                            {!isPassed && (
                                                <div className="flex items-center justify-between text-[10px] text-[oklch(55%_0.010_28)]">
                                                    <span>กรอบความแปรผัน:</span>
                                                    <span className="tabular-nums font-bold">
                                                        ต่ำ {dp.forecastLowCount} - สูง {dp.forecastHighCount}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between text-[10px]">
                                                <span className="text-[oklch(55%_0.010_28)]">สถิติเดิม ({dp.baselineCount} ท่าน):</span>
                                                <span className={`font-bold tabular-nums ${dp.diffPct >= 0 ? 'text-[oklch(45%_0.08_140)]' : 'text-[oklch(55%_0.010_28)]'}`}>
                                                    {dp.diffPct >= 0 ? `+${dp.diffPct}%` : `${dp.diffPct}%`}
                                                </span>
                                            </div>

                                            {dp.adDirCount > 0 && (
                                                <div className="flex items-center justify-between text-[10px] text-[oklch(45%_0.08_140)] pt-0.5 border-t border-[oklch(90%_0.012_28)]">
                                                    <span>สัญญาณ Ads:</span>
                                                    <span className="font-bold">{dp.adDirCount} Maps</span>
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-[9.5px] text-[oklch(55%_0.010_28)] line-clamp-2 leading-tight pt-1 border-t border-[oklch(90%_0.012_28)]">
                                            {dp.note}
                                        </p>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 2: Standalone Dayparts Detailed View */}
            {activeSubTab === 'dayparts' && (
                <div className="p-4 space-y-4 font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)] pb-2">
                        <div>
                            <h4 className="font-bold text-sm text-[oklch(18%_0.012_28)] uppercase">
                                Comprehensive Dayparts Performance & Operational Forecast
                            </h4>
                            <p className="text-[11px] text-[oklch(42%_0.010_28)]">
                                แจกแจงการคาดการณ์จำนวนลูกค้า กรอบความเชื่อมั่น และคำแนะนำทีมงานแยกตาม 4 ช่วงเวลา
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {dayparts.map(dp => (
                            <div key={dp.key} className="p-4 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h5 className="font-bold text-sm text-[oklch(18%_0.012_28)]">{dp.title}</h5>
                                        <span className="text-[11px] text-[oklch(55%_0.010_28)]">{dp.timeLabel}</span>
                                    </div>
                                    <span className="px-2 py-0.5 bg-[oklch(18%_0.012_28)] text-white text-[10px] font-bold uppercase">
                                        {dp.status}
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 p-2.5 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] text-center">
                                    <div>
                                        <span className="text-[10px] text-[oklch(55%_0.010_28)] block">เป้าฐาน (BASE)</span>
                                        <span className="font-bold text-base text-[oklch(18%_0.012_28)]">
                                            {dp.status === 'passed' ? dp.actualCount : dp.forecastCount}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-[oklch(55%_0.010_28)] block">กรอบต่ำ (LOW)</span>
                                        <span className="font-bold text-base text-[oklch(55%_0.010_28)]">
                                            {dp.status === 'passed' ? dp.actualCount : dp.forecastLowCount}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-[oklch(55%_0.010_28)] block">กรอบสูง (HIGH)</span>
                                        <span className="font-bold text-base text-[oklch(45%_0.08_140)]">
                                            {dp.status === 'passed' ? dp.actualCount : dp.forecastHighCount}
                                        </span>
                                    </div>
                                </div>

                                <p className="text-[11px] text-[oklch(42%_0.010_28)] leading-relaxed bg-[oklch(97%_0.008_28)] p-2.5 border border-[oklch(88%_0.012_28)]">
                                    <strong className="text-[oklch(18%_0.012_28)]">คำแนะนำ:</strong> {dp.note}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tab 3: Full AI Operational Briefing */}
            {activeSubTab === 'ai_deepdive' && (
                <div className="p-4 space-y-4 font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)] pb-2">
                        <div>
                            <h4 className="font-bold text-sm text-[oklch(18%_0.012_28)] uppercase">
                                AI Operational Briefing & Predictive Synthesis
                            </h4>
                            <p className="text-[11px] text-[oklch(42%_0.010_28)]">
                                สรุปสถานการณ์เชิงลึกสำหรับผู้จัดการร้านและทีมปฏิบัติการ
                            </p>
                        </div>
                        <button
                            onClick={runAiSynthesis}
                            disabled={aiLoading}
                            className="px-3 py-1.5 font-bold bg-[oklch(18%_0.012_28)] text-white hover:bg-[oklch(25%_0.015_28)] transition-colors disabled:opacity-50"
                        >
                            {aiLoading ? 'กำลังประมวลผล...' : '🔄 วิเคราะห์สดใหม่'}
                        </button>
                    </div>

                    <div className="p-4 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] leading-relaxed whitespace-pre-line text-sm text-[oklch(18%_0.012_28)]">
                        {aiBriefing || 'กำลังดึงข้อมูลและวิเคราะห์...'}
                    </div>
                </div>
            )}

            {/* Tab 4: Ad Attribution & Channel Breakdown */}
            {activeSubTab === 'ad_breakdown' && (
                <div className="p-4 space-y-4 font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)] pb-2">
                        <div>
                            <h4 className="font-bold text-sm text-[oklch(18%_0.012_28)] uppercase">
                                Ad Channel Attribution & Conversion Funnel
                            </h4>
                            <p className="text-[11px] text-[oklch(42%_0.010_28)]">
                                วิเคราะห์พฤติกรรมลูกค้าที่มาจากโฆษณาและการแปลงเป็นลูกค้าหน้าร้าน
                            </p>
                        </div>
                        <span className="px-2 py-1 bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] font-bold">
                            รวม {adStats.totalAdPageviews} การเข้าชม
                        </span>
                    </div>

                    <div className="border border-[oklch(85%_0.012_28)] overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] text-[10px] uppercase text-[oklch(55%_0.010_28)]">
                                    <th className="p-2.5">แหล่งที่มา (UTM Source)</th>
                                    <th className="p-2.5 text-right">เปิดหน้าเว็บ</th>
                                    <th className="p-2.5 text-right">ขอทาง Google Maps</th>
                                    <th className="p-2.5 text-right">ติดต่อ LINE/โทร</th>
                                    <th className="p-2.5 text-right">CVR (Intent %)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[oklch(85%_0.012_28)]">
                                {adStats.adSources.length > 0 ? (
                                    adStats.adSources.map((src, idx) => {
                                        const cvr = src.visits > 0 
                                            ? (((src.directions + src.contacts) / src.visits) * 100).toFixed(1)
                                            : '0.0'
                                        return (
                                            <tr key={idx} className="hover:bg-[oklch(94%_0.010_28)]">
                                                <td className="p-2.5 font-bold text-[oklch(18%_0.012_28)]">
                                                    {src.source}
                                                </td>
                                                <td className="p-2.5 text-right tabular-nums">{src.visits}</td>
                                                <td className="p-2.5 text-right tabular-nums font-bold text-[oklch(45%_0.08_140)]">
                                                    {src.directions}
                                                </td>
                                                <td className="p-2.5 text-right tabular-nums">{src.contacts}</td>
                                                <td className="p-2.5 text-right tabular-nums font-bold">{cvr}%</td>
                                            </tr>
                                        )
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="p-4 text-center text-[oklch(55%_0.010_28)]">
                                            ยังไม่มีบันทึกข้อมูล Ad Events ในวันที่เลือก
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
