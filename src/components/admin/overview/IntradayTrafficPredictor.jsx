/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useMemo, useRef, useEffect } from 'react'
import { RefreshCw, Copy, Check } from 'lucide-react'
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
    const [copiedBriefing, setCopiedBriefing] = useState(false)
    const containerRef = useRef(null)
    const [containerWidth, setContainerWidth] = useState(800)

    const copyBriefingToClipboard = () => {
        if (!aiBriefing) return
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(aiBriefing)
            setCopiedBriefing(true)
            toast.success('คัดลอกบทวิเคราะห์และแผนการตลาดเรียบร้อยแล้ว')
            setTimeout(() => setCopiedBriefing(false), 2000)
        }
    }

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
                    11: 1, 12: 1, 13: 2, 14: 1, 15: 1, 16: 1,
                    17: 3, 18: 4, 19: 4, 20: 3, 21: 2, 22: 1, 23: 0
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
        const hourlyAdBookingClicks = {}
        const hourlyAdPickupClicks = {}
        const hourlyAdMenuClicks = {}
        const hourlyAdVibeClicks = {}

        hours.forEach(h => {
            hourlyActualPax[h] = 0
            hourlyActualBills[h] = 0
            hourlyAdPageviews[h] = 0
            hourlyAdDirections[h] = 0
            hourlyAdLineClicks[h] = 0
            hourlyAdPhoneClicks[h] = 0
            hourlyAdBookingClicks[h] = 0
            hourlyAdPickupClicks[h] = 0
            hourlyAdMenuClicks[h] = 0
            hourlyAdVibeClicks[h] = 0
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
        let totalAdBooking = 0
        let totalAdPickup = 0
        let totalAdMenu = 0
        let totalAdVibe = 0
        const adSourcesMap = {}

        adEvents.forEach(e => {
            const h = getBangkokHour(e.created_at)
            const source = e.utm_source || 'direct_organic'
            const ev = e.event_name || ''

            if (!adSourcesMap[source]) {
                adSourcesMap[source] = { 
                    source, 
                    visits: 0, 
                    directions: 0, 
                    contacts: 0,
                    bookings: 0,
                    pickups: 0,
                    menus: 0,
                    vibes: 0
                }
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
            } else if (ev === 'click_booking_link') {
                totalAdBooking++
                adSourcesMap[source].bookings++
                if (hourlyAdBookingClicks[h] !== undefined) hourlyAdBookingClicks[h]++
            } else if (ev === 'click_pickup_link') {
                totalAdPickup++
                adSourcesMap[source].pickups++
                if (hourlyAdPickupClicks[h] !== undefined) hourlyAdPickupClicks[h]++
            } else if (ev === 'view_full_menu' || ev === 'view_booklet_menu') {
                totalAdMenu++
                adSourcesMap[source].menus++
                if (hourlyAdMenuClicks[h] !== undefined) hourlyAdMenuClicks[h]++
            } else if (ev === 'view_atmosphere') {
                totalAdVibe++
                adSourcesMap[source].vibes++
                if (hourlyAdVibeClicks[h] !== undefined) hourlyAdVibeClicks[h]++
            }
        })

        const totalHighIntentActions = totalAdDirections + totalAdPhone + totalAdLine + totalAdBooking + totalAdPickup + totalAdMenu + totalAdVibe
        const totalDirectOrders = totalAdBooking + totalAdPickup
        const totalDirectContacts = totalAdPhone + totalAdLine
        const totalContentExplores = totalAdMenu + totalAdVibe

        const baseline = historicalAverages || {
            11: 1, 12: 1, 13: 2, 14: 1, 15: 1, 16: 1,
            17: 3, 18: 4, 19: 4, 20: 3, 21: 2, 22: 1, 23: 0
        }

        const cappedHour = isViewingToday 
            ? Math.min(23, Math.max(11, currentBangkokHour))
            : 23

        // Calculate today's pacing multiplier vs historical baseline so far
        let baselineSoFar = 0
        let actualSoFar = 0
        let totalBaseline = 0
        hours.forEach(h => {
            const bVal = baseline[h] || 0
            totalBaseline += bVal
            if (h <= cappedHour) {
                baselineSoFar += bVal
                actualSoFar += (hourlyActualPax[h] || 0)
            }
        })

        const rawPace = baselineSoFar > 0 ? (actualSoFar / baselineSoFar) : 1.0
        const paceMultiplier = Math.max(0.65, Math.min(1.75, rawPace * 0.75 + 0.25))
        const dayPacePct = baselineSoFar > 0 ? Math.round(((actualSoFar - baselineSoFar) / baselineSoFar) * 100) : 0

        // Ad Intent Lead Lift (Multi-Tier Weighted Composite)
        // Maps(3.0), Phone(2.5), Line(2.0), Booking(2.0), Pickup(1.5), FullMenu(0.6), Vibe(0.4)
        const recentHighIntent = hours.reduce((acc, h) => {
            if (h >= cappedHour - 1 && h <= cappedHour) {
                const dirs = (hourlyAdDirections[h] || 0) * 3.0
                const phones = (hourlyAdPhoneClicks[h] || 0) * 2.5
                const lines = (hourlyAdLineClicks[h] || 0) * 2.0
                const bookings = (hourlyAdBookingClicks[h] || 0) * 2.0
                const pickups = (hourlyAdPickupClicks[h] || 0) * 1.5
                const menus = (hourlyAdMenuClicks[h] || 0) * 0.6
                const vibes = (hourlyAdVibeClicks[h] || 0) * 0.4
                return acc + dirs + phones + lines + bookings + pickups + menus + vibes
            }
            return acc
        }, 0)
        const adLiftPct = Math.min(0.35, recentHighIntent * 0.04)

        // Generate hourly points
        let forecastedClosingPax = totalActualPax
        let forecastedClosingPaxHigh = totalActualPax
        let forecastedClosingPaxLow = totalActualPax

        const points = hours.map(h => {
            const actual = hourlyActualPax[h]
            const base = baseline[h] || 0
            const adViews = hourlyAdPageviews[h]
            const adDirs = hourlyAdDirections[h]
            const adLeads = (hourlyAdDirections[h] || 0) + (hourlyAdPhoneClicks[h] || 0) + (hourlyAdLineClicks[h] || 0) + (hourlyAdBookingClicks[h] || 0) + (hourlyAdPickupClicks[h] || 0) + (hourlyAdMenuClicks[h] || 0) + (hourlyAdVibeClicks[h] || 0)
            const adOrderCount = (hourlyAdBookingClicks[h] || 0) + (hourlyAdPickupClicks[h] || 0)
            const adExploreCount = (hourlyAdMenuClicks[h] || 0) + (hourlyAdVibeClicks[h] || 0)
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
                adLeads,
                adOrderCount,
                adExploreCount,
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
            let actualBills = 0
            let forecastCount = 0
            let forecastHighCount = 0
            let forecastLowCount = 0
            let baselineCount = 0
            let baselinePassedCount = 0
            let adDirCount = 0
            let adViewCount = 0
            let adLeadCount = 0
            let adOrderCount = 0
            let adExploreCount = 0

            let allPassed = true
            let allFuture = true

            dp.hours.forEach(h => {
                const pt = points.find(p => p.hour === h)
                if (pt) {
                    if (!pt.isFuture) {
                        actualCount += pt.actual
                        actualBills += (pt.bills || 0)
                        baselinePassedCount += pt.baseline
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
                    adLeadCount += (pt.adLeads || 0)
                    adOrderCount += (pt.adOrderCount || 0)
                    adExploreCount += (pt.adExploreCount || 0)
                }
            })

            let status = 'upcoming'
            if (allPassed) status = 'passed'
            else if (!allFuture) status = 'active'

            const targetPax = (status === 'passed') ? actualCount : forecastCount
            const diffCount = targetPax - baselineCount
            const diffPct = baselineCount > 0 ? Math.round(((targetPax - baselineCount) / baselineCount) * 100) : 0
            const activePacePct = baselinePassedCount > 0 
                ? Math.round(((actualCount - baselinePassedCount) / baselinePassedCount) * 100) 
                : 0

            return {
                ...dp,
                status, // 'passed' | 'active' | 'upcoming'
                actualCount,
                actualBills,
                forecastCount,
                forecastHighCount,
                forecastLowCount,
                baselineCount,
                baselinePassedCount,
                targetPax,
                diffCount,
                diffPct,
                activePacePct,
                adDirCount,
                adViewCount,
                adLeadCount,
                adOrderCount,
                adExploreCount
            }
        })

        return {
            points,
            totalActualPax,
            totalActualBills,
            baselineSoFar,
            totalBaseline,
            dayPacePct,
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
                totalAdBooking,
                totalAdPickup,
                totalAdMenu,
                totalAdVibe,
                totalHighIntentActions,
                totalDirectOrders,
                totalDirectContacts,
                totalContentExplores,
                adSources: Object.values(adSourcesMap).sort((a, b) => b.visits - a.visits),
                adLiftPct: Math.round(adLiftPct * 100)
            }
        }
    }, [bookings, adEvents, historicalAverages, hours, isViewingToday, currentBangkokHour, totalSeats])

    const { 
        points, 
        totalActualPax, 
        totalActualBills, 
        baselineSoFar,
        totalBaseline,
        dayPacePct,
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
                dayPacePercent: dayPacePct,
                peakHour: peakHour ? `${peakHour.hour}.00 น. (~${peakHour.isFuture ? peakHour.forecast : peakHour.actual} ท่าน)` : 'N/A',
                peakCapacityLoad: `${peakCapacityLoad}%`,
                daypartsSummary: dayparts.map(dp => `${dp.title} (${dp.timeLabel}): ${dp.status === 'passed' ? `ลูกค้าจริง ${dp.actualCount} ท่าน (${dp.actualBills} บิล) เทียบสถิติเดิม ${dp.diffPct >= 0 ? `+${dp.diffPct}%` : `${dp.diffPct}%`}` : dp.status === 'active' ? `ลูกค้าจริงขณะนี้ ${dp.actualCount} ท่าน (ปิดช่วง ~${dp.forecastCount} กรอบ ${dp.forecastLowCount}-${dp.forecastHighCount}) เทียบสถิติ ${dp.diffPct >= 0 ? `+${dp.diffPct}%` : `${dp.diffPct}%`}` : `คาดการณ์ ~${dp.forecastCount} (กรอบ ${dp.forecastLowCount}-${dp.forecastHighCount}) เทียบสถิติเดิม ${dp.diffPct >= 0 ? `+${dp.diffPct}%` : `${dp.diffPct}%`}`}, Ads Intent: ${dp.adLeadCount || 0} ครั้ง (Maps: ${dp.adDirCount}, จอง/สั่ง: ${dp.adOrderCount}, เมนู/วิว: ${dp.adExploreCount})`),
                adLandingMetrics: {
                    pageviews: adStats.totalAdPageviews,
                    totalHighIntentLeads: adStats.totalHighIntentActions,
                    breakdown: {
                        directionsClicks: adStats.totalAdDirections,
                        phoneCalls: adStats.totalAdPhone,
                        lineOaContacts: adStats.totalAdLine,
                        tableBookings: adStats.totalAdBooking,
                        pickupOrders: adStats.totalAdPickup,
                        fullMenuExpansions: adStats.totalAdMenu,
                        atmosphereViews: adStats.totalAdVibe
                    },
                    interpretationNote: adStats.totalHighIntentActions > 0
                        ? `มีสัญญาณความสนใจจากช่องทางออนไลน์ (Ad Intent Leads) ทั้งสิ้น ${adStats.totalHighIntentActions} ครั้ง (ขอทาง: ${adStats.totalAdDirections}, โทร: ${adStats.totalAdPhone}, LINE: ${adStats.totalAdLine}, จองออนไลน์: ${adStats.totalAdBooking}, สั่ง Pick-up: ${adStats.totalAdPickup}, สำรวจเมนู/วิว: ${adStats.totalContentExplores}) แสดงว่ามีแรงส่งจากออนไลน์ชัดเจน ห้ามระบุว่าสัญญาณ Ads เป็นศูนย์`
                        : `ยังไม่มีการคลิกปุ่มเชื่อมต่อหรือดูเมนูเชิงลึกจาก Ad Landing`
                }
            }

            if (apiKey) {
                const promptText = `
คุณคือผู้อำนวยการฝ่ายปฏิบัติการและการตลาดร้านอาหารและคาเฟ่ "IN THE HAUS" 
จงวิเคราะห์ข้อมูลทราฟฟิกลูกค้าสด พฤติกรรมความสนใจ Ad Intent Leads และข้อมูลช่วงเวลา Dayparts ต่อไปนี้ เพื่อสรุปสถานการณ์ ปฏิบัติการหน้าร้าน และวางแผนการตลาดสำหรับวันถัดไป:

${JSON.stringify(summaryPayload, null, 2)}

ข้อกำหนด:
1. ตอบเป็นภาษาไทยอย่างกระชับ สุภาพ คมชัด สไตล์ผู้บริหาร
2. สรุปเป็น 4 มิติอย่างชัดเจน (ต้องมีครบทั้ง 4 หัวข้อในเครื่องหมายก้ามปู):
   - [สรุปสถานการณ์และภาพรวมทั้งวัน]: เปรียบเทียบกับสถิติเดิม 4 สัปดาห์ และประเมินสัญญาณความสนใจจาก Ads ให้ครบทั้ง 6 มิติ (Maps, โทร, LINE, จองโต๊ะ, สั่ง Pick-up, และการเปิดดู Full Menu / บรรยากาศ ห้ามสรุปว่าสัญญาณ Ads เป็นศูนย์หากมีตัวเลข High Intent เกิดขึ้น)
   - [ไฮไลต์ช่วงเวลา Dayparts]: ระบุช่วงที่ต้องเฝ้าระวังที่สุด (เช่น Dinner Rush) คาดว่าจะมากี่คน
   - [คำแนะนำการปฏิบัติการหน้าร้าน]: 2-3 ข้อสำหรับทีมครัว บาร์ และโต๊ะ
   - [ข้อเสนอแนะแผนการตลาดวันถัดไป]: 3 ข้อเสนอแนะเชิงกลยุทธ์ที่เป็นรูปธรรม ได้แก่
     1) การปิดช่องว่างเวลาทราฟฟิกชะลอตัว (เช่น ดันแคมเปญ Lunch Set หรือ Happy Hour ช่วงบ่าย)
     2) การจัดสรรงบ ช่วงเวลายิงแอด (Timing & Budget) และชิ้นงานคอนเทนต์ (เช่น เน้นภาพวิวริมโขง หรือเมนูซิกเนเจอร์ที่คนเปิดดูบ่อย)
     3) การดึงดูดและตอบสนองความต้องการซื้อ (Unmet Demand เช่น การกระตุ้นให้จองโต๊ะล่วงหน้าเพื่อลดความแออัด หรือเปิดพรีออเดอร์)
3. ห้ามใช้อีโมจิ ความยาวรวมประมาณ 220-260 คำ
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
                        toast.success('วิเคราะห์ข้อมูลและแผนการตลาดวันถัดไปเรียบร้อยแล้ว')
                        return
                    }
                }
            }

            // Fallback deterministic AI synthesis
            const dinnerDp = dayparts.find(d => d.key === 'dinner')
            const fallbackBriefing = `[สรุปสถานการณ์และภาพรวมทั้งวัน]
วันนี้ (${dayOfWeekThai}) ลูกค้าจริงสะสมแล้ว ${totalActualPax} ท่าน (${totalActualBills} บิล) คาดการณ์ยอดปิดวันรวม ~${forecastedClosingPax} ท่าน (กรอบต่ำ-สูง: ${forecastedClosingPaxLow} - ${forecastedClosingPaxHigh} ท่าน) ภาพรวมความเร็วกว่าสถิติเดิม ${paceMultiplier >= 1.0 ? `+${Math.round((paceMultiplier - 1) * 100)}%` : `-${Math.round((1 - paceMultiplier) * 100)}%`} โดยมีสัญญาณความสนใจจากออนไลน์รวม ${adStats.totalHighIntentActions} Action (ขอทาง ${adStats.totalAdDirections} ครั้ง, ติดต่อ/จอง ${adStats.totalDirectOrders + adStats.totalDirectContacts} ครั้ง, ดูเมนู/บรรยากาศ ${adStats.totalContentExplores} ครั้ง จาก ${adStats.totalAdPageviews} วิว)

[ไฮไลต์ช่วงเวลา Dayparts]
ช่วงเวลาสำคัญที่สุดคือ ${dinnerDp?.title || 'PRIME DINNER'} (${dinnerDp?.timeLabel || '17.00 - 21.00 น.'}) คาดการณ์ลูกค้าจะเข้ามารวม ~${dinnerDp?.forecastCount || 45} ท่าน (กรอบ ${dinnerDp?.forecastLowCount}-${dinnerDp?.forecastHighCount} ท่าน) ซึ่งจะดันให้อัตราครองที่นั่งแตะ ${peakCapacityLoad}% ของความจุร้าน

[คำแนะนำการปฏิบัติการหน้าร้าน]
1. ฝ่ายครัว: เตรียมสำรองวัตถุดิบอาหารจานหลักและเมนูแนะนำที่ลูกค้าเปิดดูบ่อยล่วงหน้า
2. ฝ่ายบริการ: พร้อมจัดโต๊ะทั้งกลุ่ม Walk-in และลูกค้าที่โทร/LINE เข้ามานัดหมาย
3. ฝ่ายบาร์: เสริมกำลังคนช่วง 18.00-20.00 น. เพื่อออกเครื่องดื่มได้ทันท่วงที

[ข้อเสนอแนะแผนการตลาดวันถัดไป]
1. จัดสรรงบโฆษณา: โฟกัสยิงแคมเปญล่วงหน้าช่วง 15.30 - 17.30 น. เน้นคอนเทนต์เมนูซิกเนเจอร์และภาพบรรยากาศริมโขงเพื่อดึงยอด Dinner
2. เติมเต็มช่วงทราฟฟิกชะลอตัว: ทำโพสต์โปรโมทเซตอาหารเที่ยง (Lunch Set) หรือเครื่องดื่มบ่ายช่วง 10.30 - 12.30 น. เพื่อเพิ่มยอดก่อนมื้อเย็น
3. ดักจับเจตนาซื้อล่วงหน้า: บูสต์โพสต์เชิญชวนให้ลูกค้ากดจองโต๊ะล่วงหน้าผ่านระบบออนไลน์เพื่อการันตีที่นั่งวิวริมโขง`

            setAiBriefing(fallbackBriefing)
            toast.success('สังเคราะห์บทวิเคราะห์ปฏิบัติการเรียบร้อย')
        } catch (err) {
            console.error('[AI Briefing Error]:', err)
            toast.error('ไม่สามารถเรียก AI ได้ในขณะนี้')
        } finally {
            setAiLoading(false)
        }
    }

    // Note: AI briefing runs strictly on-demand when user clicks the generate button (zero auto-run)
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
                        <span className="text-[10px] text-[oklch(55%_0.010_28)] block">GUESTS TODAY (เข้าจริง)</span>
                        <span className="font-bold text-base sm:text-lg text-[oklch(18%_0.012_28)] tabular-nums">
                            {totalActualPax} ท่าน
                        </span>
                        <span className="text-[10px] text-[oklch(55%_0.010_28)] ml-1">({totalActualBills} บิล)</span>
                    </div>

                    <div className="border-l border-[oklch(85%_0.012_28)] pl-3 sm:pl-4">
                        <span className="text-[10px] text-[oklch(55%_0.010_28)] block">อัตราเทียบสถิติเดิม (PACE)</span>
                        <div className="flex items-baseline gap-1">
                            <span className={`font-bold text-sm sm:text-base tabular-nums ${dayPacePct >= 0 ? 'text-[oklch(45%_0.08_140)]' : 'text-[oklch(52%_0.16_28)]'}`}>
                                {dayPacePct >= 0 ? `+${dayPacePct}%` : `${dayPacePct}%`} {dayPacePct >= 0 ? '↗' : '↘'}
                            </span>
                            <span className="text-[10px] text-[oklch(55%_0.010_28)] tabular-nums">
                                (ฐาน ~{baselineSoFar})
                            </span>
                        </div>
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
                        <div className="flex items-baseline gap-1.5">
                            <span className="font-bold text-sm text-[oklch(45%_0.08_140)] tabular-nums">
                                {adStats.totalHighIntentActions} Leads
                            </span>
                            <span className="text-[10px] font-mono text-[oklch(55%_0.010_28)] tabular-nums">
                                <span className="hidden xl:inline">({adStats.totalAdDirections} Maps · {adStats.totalDirectOrders} จอง/รับ · {adStats.totalContentExplores} เมนู/วิว) / </span>
                                <span className="xl:hidden">({adStats.totalAdDirections} Maps) / </span>
                                {adStats.totalAdPageviews} Views
                            </span>
                        </div>
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
            <div className="flex border-b border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] text-xs font-mono overflow-x-auto whitespace-nowrap scrollbar-none">
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
                    <span>[3] บทวิเคราะห์ AI ปฏิบัติการ & แผนการตลาด</span>
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
                                            {pt.adLeads > 0 && (
                                                <g>
                                                    <rect
                                                        x={cx - 10}
                                                        y={padYTop - 7}
                                                        width="20"
                                                        height="11"
                                                        rx="1.5"
                                                        fill={pt.adDirections > 0 ? "oklch(45% 0.08 140)" : "oklch(52% 0.16 28)"}
                                                    />
                                                    <text
                                                        x={cx}
                                                        y={padYTop + 1}
                                                        textAnchor="middle"
                                                        className="font-mono text-[7px] font-bold fill-white"
                                                    >
                                                        {pt.adDirections > 0 ? `DIR ${pt.adDirections}` : `AD ${pt.adLeads}`}
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
                                const isUpcoming = dp.status === 'upcoming'

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
                                                    {isPassed ? 'ลูกค้าจริง' : isActive ? 'ลูกค้าจริงสะสม' : 'เป้าคาดการณ์'}
                                                </span>
                                                <span className="font-bold text-sm sm:text-base text-[oklch(18%_0.012_28)] tabular-nums">
                                                    {isPassed ? `${dp.actualCount} ท่าน` : isActive ? `${dp.actualCount} ท่าน` : `~${dp.forecastCount} ท่าน`}
                                                </span>
                                            </div>

                                            {isPassed && (
                                                <div className="flex items-center justify-between text-[10px] text-[oklch(55%_0.010_28)]">
                                                    <span>บิลเช็คสำเร็จ:</span>
                                                    <span className="font-bold tabular-nums text-[oklch(18%_0.012_28)]">
                                                        {dp.actualBills} บิล
                                                    </span>
                                                </div>
                                            )}

                                            {isActive && (
                                                <div className="flex items-center justify-between text-[10px] text-[oklch(55%_0.010_28)]">
                                                    <span>คาดการณ์ปิดช่วง:</span>
                                                    <span className="tabular-nums font-bold text-[oklch(52%_0.20_28)]">
                                                        ~{dp.forecastCount} (กรอบ {dp.forecastLowCount}-{dp.forecastHighCount})
                                                    </span>
                                                </div>
                                            )}

                                            {isUpcoming && (
                                                <div className="flex items-center justify-between text-[10px] text-[oklch(55%_0.010_28)]">
                                                    <span>กรอบความแปรผัน:</span>
                                                    <span className="tabular-nums font-bold">
                                                        ต่ำ {dp.forecastLowCount} - สูง {dp.forecastHighCount} ท่าน
                                                    </span>
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between text-[10px]">
                                                <span className="text-[oklch(55%_0.010_28)]">สถิติเดิม ({dp.baselineCount} ท่าน):</span>
                                                <span className={`font-bold tabular-nums ${dp.diffPct >= 0 ? 'text-[oklch(45%_0.08_140)]' : 'text-[oklch(52%_0.16_28)]'}`}>
                                                    {dp.diffPct >= 0 ? `+${dp.diffPct}%` : `${dp.diffPct}%`} {dp.diffPct >= 0 ? '↗' : '↘'}
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
                    {/* Header with Executive Synthesis Ribbon */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[oklch(85%_0.012_28)] pb-3">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="px-1.5 py-0.5 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold text-[10px] uppercase">
                                    DAYPART PERFORMANCE AUDIT
                                </span>
                                <span className="text-[10px] text-[oklch(55%_0.010_28)]">
                                    อัปเดตลูกค้าเข้าจริง & อัตราเติบโตเทียบสถิติ 4 สัปดาห์
                                </span>
                            </div>
                            <h4 className="font-bold text-sm text-[oklch(18%_0.012_28)] uppercase tracking-tight">
                                Comprehensive Dayparts Performance & Operational Forecast
                            </h4>
                            <p className="text-[11px] text-[oklch(42%_0.010_28)]">
                                แจกแจงยอดลูกค้าจริง เทียบฐานประวัติศาสตร์ (4-Wk Baseline) อัตราความเร็ว และคำแนะนำทีมงาน
                            </p>
                        </div>

                        {/* Quick KPI Badge */}
                        <div className="flex items-center gap-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-2">
                            <div className="text-right">
                                <span className="text-[9px] text-[oklch(55%_0.010_28)] block">ความเร็วรวมทั้งวัน</span>
                                <span className={`font-bold text-sm ${dayPacePct >= 0 ? 'text-[oklch(45%_0.08_140)]' : 'text-[oklch(52%_0.16_28)]'}`}>
                                    {dayPacePct >= 0 ? `+${dayPacePct}% ↗` : `${dayPacePct}% ↘`}
                                </span>
                            </div>
                            <div className="border-l border-[oklch(85%_0.012_28)] pl-2 text-right">
                                <span className="text-[9px] text-[oklch(55%_0.010_28)] block">ลูกค้าจริงรวม</span>
                                <span className="font-bold text-sm text-[oklch(18%_0.012_28)]">
                                    {totalActualPax} ท่าน <span className="text-[10px] font-normal text-[oklch(55%_0.010_28)]">({totalActualBills} บิล)</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 4 Detailed Daypart Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {dayparts.map(dp => {
                            const isPassed = dp.status === 'passed'
                            const isActive = dp.status === 'active'

                            return (
                                <div 
                                    key={dp.key} 
                                    className={`p-4 border transition-all ${
                                        isActive 
                                            ? 'border-[oklch(52%_0.20_28)] bg-[oklch(96%_0.012_28)] shadow-sm' 
                                            : isPassed 
                                            ? 'border-[oklch(85%_0.012_28)] bg-[oklch(95%_0.008_28)]'
                                            : 'border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)]'
                                    } space-y-3`}
                                >
                                    {/* Card Header */}
                                    <div className="flex items-center justify-between border-b border-[oklch(88%_0.012_28)] pb-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h5 className="font-bold text-sm text-[oklch(18%_0.012_28)]">{dp.title}</h5>
                                                {isActive && (
                                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[oklch(52%_0.20_28)]">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-[oklch(52%_0.20_28)] animate-ping" />
                                                        LIVE
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[11px] text-[oklch(55%_0.010_28)]">{dp.timeLabel}</span>
                                        </div>
                                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                            isPassed 
                                                ? 'bg-[oklch(88%_0.012_28)] text-[oklch(35%_0.010_28)]' 
                                                : isActive 
                                                ? 'bg-[oklch(52%_0.20_28)] text-white' 
                                                : 'bg-[oklch(45%_0.08_140)] text-white'
                                        }`}>
                                            {isPassed ? 'PASSED // เสร็จสิ้น' : isActive ? 'NOW ACTIVE // เปิดบริการ' : 'UPCOMING // รอเปิดรอบ'}
                                        </span>
                                    </div>

                                    {/* 3 Metric Columns based on State */}
                                    <div className="grid grid-cols-3 gap-2 p-3 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] text-center">
                                        {/* Column 1: Primary Figure */}
                                        <div className="flex flex-col justify-between">
                                            <span className="text-[10px] text-[oklch(55%_0.010_28)] block leading-tight">
                                                {isPassed ? 'ลูกค้าเข้าจริง' : isActive ? 'ลูกค้าจริงขณะนี้' : 'เป้าคาดการณ์ (BASE)'}
                                            </span>
                                            <div className="my-1">
                                                <span className="font-bold text-base sm:text-lg text-[oklch(18%_0.012_28)] tabular-nums">
                                                    {isPassed ? `${dp.actualCount}` : isActive ? `${dp.actualCount}` : `~${dp.forecastCount}`}
                                                </span>
                                                <span className="text-[11px] text-[oklch(55%_0.010_28)] ml-0.5">ท่าน</span>
                                            </div>
                                            <span className="text-[9.5px] text-[oklch(42%_0.010_28)] block">
                                                {isPassed ? `${dp.actualBills} บิลเช็คบิลแล้ว` : isActive ? `${dp.actualBills} บิลเปิดสะสม` : 'ความน่าจะเป็นสูงสุด'}
                                            </span>
                                        </div>

                                        {/* Column 2: Context / Range / Forecast */}
                                        <div className="flex flex-col justify-between border-x border-[oklch(88%_0.012_28)] px-1">
                                            <span className="text-[10px] text-[oklch(55%_0.010_28)] block leading-tight">
                                                {isPassed ? 'สถิติเดิม (4-WK)' : isActive ? 'คาดการณ์ปิดช่วง' : 'กรอบความแปรผัน'}
                                            </span>
                                            <div className="my-1">
                                                {isPassed ? (
                                                    <span className="font-bold text-base sm:text-lg text-[oklch(42%_0.010_28)] tabular-nums">
                                                        ~{dp.baselineCount}
                                                        <span className="text-[11px] font-normal text-[oklch(55%_0.010_28)] ml-0.5">ท่าน</span>
                                                    </span>
                                                ) : isActive ? (
                                                    <span className="font-bold text-base sm:text-lg text-[oklch(52%_0.20_28)] tabular-nums">
                                                        ~{dp.forecastCount}
                                                        <span className="text-[11px] font-normal text-[oklch(55%_0.010_28)] ml-0.5">ท่าน</span>
                                                    </span>
                                                ) : (
                                                    <span className="font-bold text-xs sm:text-sm text-[oklch(42%_0.010_28)] tabular-nums">
                                                        {dp.forecastLowCount} - {dp.forecastHighCount}
                                                        <span className="text-[10px] font-normal text-[oklch(55%_0.010_28)] ml-0.5">ท่าน</span>
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[9.5px] text-[oklch(42%_0.010_28)] block">
                                                {isPassed ? 'เฉลี่ยย้อนหลัง 4 สัปดาห์' : isActive ? `กรอบต่ำ ${dp.forecastLowCount} - สูง ${dp.forecastHighCount}` : 'ต่ำ (Low) ถึง สูง (High)'}
                                            </span>
                                        </div>

                                        {/* Column 3: Rate of Change vs Baseline */}
                                        <div className="flex flex-col justify-between">
                                            <span className="text-[10px] text-[oklch(55%_0.010_28)] block leading-tight">
                                                {isPassed ? 'อัตราเทียบสถิติเดิม' : isActive ? 'แนวโน้มเทียบสถิติ' : 'อัตราเติบโตคาดการณ์'}
                                            </span>
                                            <div className="my-1">
                                                <span className={`font-bold text-base sm:text-lg tabular-nums ${
                                                    dp.diffPct >= 0 ? 'text-[oklch(45%_0.08_140)]' : 'text-[oklch(52%_0.16_28)]'
                                                }`}>
                                                    {dp.diffPct >= 0 ? `+${dp.diffPct}%` : `${dp.diffPct}%`} {dp.diffPct >= 0 ? '↗' : '↘'}
                                                </span>
                                            </div>
                                            <span className="text-[9.5px] text-[oklch(42%_0.010_28)] block">
                                                {isPassed 
                                                    ? (dp.diffCount >= 0 ? `เพิ่มขึ้น +${dp.diffCount} ท่าน` : `ลดลง ${dp.diffCount} ท่าน`)
                                                    : (dp.diffCount >= 0 ? `คาดเพิ่ม +${dp.diffCount} ท่าน` : `คาดลด ${dp.diffCount} ท่าน`)
                                                }
                                            </span>
                                        </div>
                                    </div>

                                    {/* Visual Comparison Progress Bar vs 4-Wk Baseline */}
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between text-[10px] text-[oklch(55%_0.010_28)]">
                                            <span>
                                                {isPassed ? 'ผลงานจริง vs ค่าเฉลี่ยประวัติศาสตร์' : 'เปรียบเทียบกับค่าเฉลี่ยประวัติศาสตร์'}
                                            </span>
                                            <span className="font-bold">
                                                {dp.baselineCount > 0 
                                                    ? `${Math.round(((isPassed ? dp.actualCount : dp.forecastCount) / dp.baselineCount) * 100)}% ของค่าเฉลี่ย`
                                                    : '100%'}
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full bg-[oklch(88%_0.012_28)] rounded-xs overflow-hidden relative">
                                            <div 
                                                className={`h-full transition-all duration-500 ${
                                                    dp.diffPct >= 0 ? 'bg-[oklch(45%_0.08_140)]' : 'bg-[oklch(52%_0.16_28)]'
                                                }`}
                                                style={{ 
                                                    width: `${Math.min(100, Math.max(5, dp.baselineCount > 0 ? Math.round(((isPassed ? dp.actualCount : dp.forecastCount) / (dp.baselineCount * 1.5)) * 100) : 50))}%` 
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Ad Intent Signals Badge if any */}
                                    {dp.adLeadCount > 0 && (
                                        <div className="flex items-center justify-between text-[11px] p-2 bg-[oklch(92%_0.012_140)] border border-[oklch(82%_0.08_140)] text-[oklch(35%_0.08_140)]">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-mono text-[9px] font-bold px-1.5 py-0.2 bg-[oklch(45%_0.08_140)] text-white">AD RADAR</span>
                                                <span className="font-bold">สัญญาณ Ads:</span>
                                                <span>
                                                    {dp.adLeadCount} Leads ({dp.adDirCount} Maps · {dp.adOrderCount} จอง/รับ · {dp.adExploreCount} ดูเมนู/วิว) จาก {dp.adViewCount} เปิดเว็บ
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-bold bg-[oklch(45%_0.08_140)] text-white px-1.5 py-0.2 shrink-0">
                                                HIGH INTENT
                                            </span>
                                        </div>
                                    )}

                                    {/* Operational Directive / Staff Guidance */}
                                    <p className="text-[11px] text-[oklch(42%_0.010_28)] leading-relaxed bg-[oklch(97%_0.008_28)] p-2.5 border border-[oklch(88%_0.012_28)]">
                                        <strong className="text-[oklch(18%_0.012_28)]">คำแนะนำทีมงาน:</strong> {dp.note}
                                    </p>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Tab 3: Full AI Operational & Next-Day Marketing Briefing */}
            {activeSubTab === 'ai_deepdive' && (
                <div className="p-4 space-y-4 font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)] pb-2 flex-wrap gap-2">
                        <div>
                            <h4 className="font-bold text-sm text-[oklch(18%_0.012_28)] uppercase">
                                AI Operational Briefing & Next-Day Marketing Synthesis
                            </h4>
                            <p className="text-[11px] text-[oklch(42%_0.010_28)]">
                                สรุปสถานการณ์เชิงลึกสำหรับผู้จัดการร้าน ทีมปฏิบัติการ และข้อเสนอแนะแผนการตลาดสำหรับวันถัดไป
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {aiBriefing && (
                                <button
                                    onClick={copyBriefingToClipboard}
                                    className="px-3 py-1.5 font-bold bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] hover:bg-[oklch(90%_0.012_28)] transition-colors cursor-pointer flex items-center gap-1.5 text-xs"
                                    title="คัดลอกข้อความสรุปเพื่อส่งเข้ากลุ่ม LINE ร้าน"
                                >
                                    {copiedBriefing ? <Check size={13} className="text-[oklch(45%_0.08_140)]" /> : <Copy size={13} />}
                                    <span>{copiedBriefing ? 'คัดลอกแล้ว' : 'คัดลอกส่ง LINE'}</span>
                                </button>
                            )}
                            <button
                                onClick={runAiSynthesis}
                                disabled={aiLoading}
                                className="px-3 py-1.5 font-bold bg-[oklch(18%_0.012_28)] text-white hover:bg-[oklch(25%_0.015_28)] transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5 text-xs"
                            >
                                <RefreshCw size={13} className={aiLoading ? 'animate-spin' : ''} />
                                <span>{aiLoading ? 'กำลังสังเคราะห์ข้อมูล...' : 'วิเคราะห์สดใหม่'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Parsed 4-Dimension Executive Cards */}
                    {(() => {
                        if (!aiBriefing) {
                            return (
                                <div className="p-4 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] text-[oklch(55%_0.010_28)]">
                                    กำลังดึงข้อมูลและประมวลผลคำแนะนำ...
                                </div>
                            )
                        }

                        // Parse briefing into sections based on [Header]
                        const rawSections = aiBriefing.split(/(?=\[.*?\])/g).filter(Boolean)
                        
                        if (rawSections.length >= 3) {
                            return (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {rawSections.map((sec, idx) => {
                                        const match = sec.match(/^\[(.*?)\]([\s\S]*)$/)
                                        const title = match ? match[1].trim() : `ส่วนที่ ${idx + 1}`
                                        const content = match ? match[2].trim() : sec.trim()
                                        const isMarketing = title.includes('การตลาด') || title.includes('Marketing')

                                        return (
                                            <div 
                                                key={idx}
                                                className={`p-4 border font-sans ${
                                                    isMarketing 
                                                        ? 'col-span-1 md:col-span-2 border-[oklch(52%_0.16_28)] bg-[oklch(96%_0.012_28)] shadow-xs' 
                                                        : 'border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)]'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between border-b border-[oklch(88%_0.012_28)] pb-2 mb-2.5">
                                                    <span className="font-mono text-xs font-bold text-[oklch(18%_0.012_28)]">
                                                        [{title}]
                                                    </span>
                                                    {isMarketing && (
                                                        <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-[oklch(52%_0.16_28)] text-white uppercase tracking-wider">
                                                            AI MARKETING STRATEGY
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-[oklch(18%_0.012_28)] leading-relaxed whitespace-pre-line font-normal">
                                                    {content}
                                                </p>
                                            </div>
                                        )
                                    })}
                                </div>
                            )
                        }

                        // Fallback pre-line block
                        return (
                            <div className="p-4 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] leading-relaxed whitespace-pre-line text-sm text-[oklch(18%_0.012_28)]">
                                {aiBriefing}
                            </div>
                        )
                    })()}
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
                                    <th className="p-2.5 text-right">ขอทาง Maps</th>
                                    <th className="p-2.5 text-right">โทร / LINE</th>
                                    <th className="p-2.5 text-right">จอง / สั่งรับ</th>
                                    <th className="p-2.5 text-right">ดูเมนู / บรรยากาศ</th>
                                    <th className="p-2.5 text-right">รวม Intent</th>
                                    <th className="p-2.5 text-right">CVR (Intent %)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[oklch(85%_0.012_28)]">
                                {adStats.adSources.length > 0 ? (
                                    adStats.adSources.map((src, idx) => {
                                        const totalIntents = (src.directions || 0) + (src.contacts || 0) + (src.bookings || 0) + (src.pickups || 0) + (src.menus || 0) + (src.vibes || 0)
                                        const cvr = src.visits > 0 
                                            ? ((totalIntents / src.visits) * 100).toFixed(1)
                                            : '0.0'
                                        return (
                                            <tr key={idx} className="hover:bg-[oklch(94%_0.010_28)]">
                                                <td className="p-2.5 font-bold text-[oklch(18%_0.012_28)]">
                                                    {src.source}
                                                </td>
                                                <td className="p-2.5 text-right tabular-nums">{src.visits}</td>
                                                <td className="p-2.5 text-right tabular-nums font-bold text-[oklch(45%_0.08_140)]">
                                                    {src.directions || 0}
                                                </td>
                                                <td className="p-2.5 text-right tabular-nums">{src.contacts || 0}</td>
                                                <td className="p-2.5 text-right tabular-nums">{(src.bookings || 0) + (src.pickups || 0)}</td>
                                                <td className="p-2.5 text-right tabular-nums">{(src.menus || 0) + (src.vibes || 0)}</td>
                                                <td className="p-2.5 text-right tabular-nums font-bold text-[oklch(18%_0.012_28)]">{totalIntents}</td>
                                                <td className="p-2.5 text-right tabular-nums font-bold text-[oklch(52%_0.16_28)]">{cvr}%</td>
                                            </tr>
                                        )
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="8" className="p-4 text-center text-[oklch(55%_0.010_28)]">
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
