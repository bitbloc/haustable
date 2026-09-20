/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useMemo, useRef, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'

// Helper: Extract Asia/Bangkok hour (0 - 23) reliably across all browser environments
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

export default function IntradayVelocityChart({ bookings = [], selectedDate, loading = false, totalSeats = 45 }) {
    const [hoveredHour, setHoveredHour] = useState(null)
    const containerRef = useRef(null)
    const [containerWidth, setContainerWidth] = useState(800)
    const [adEvents, setAdEvents] = useState([])

    // Fetch Ad Landing Events for Selected Date to factor in Google Maps Directions and Leads
    useEffect(() => {
        let isMounted = true
        async function fetchAdLandingEvents() {
            try {
                const queryDay = selectedDate || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
                const { data, error } = await supabase
                    .from('ad_events')
                    .select('*')
                    .gte('created_at', `${queryDay}T00:00:00+07:00`)
                    .lte('created_at', `${queryDay}T23:59:59+07:00`)
                    .order('created_at', { ascending: true })
                    .limit(1000)

                if (!error && data && isMounted) {
                    setAdEvents(data)
                }
            } catch (err) {
                console.warn('[VelocityChart] Ad events fallback:', err?.message)
            }
        }
        fetchAdLandingEvents()
        return () => { isMounted = false }
    }, [selectedDate])

    // Restaurant operating hours 11:00 to 23:00 (13 slots)
    const hours = useMemo(() => [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23], [])

    // Track dynamic container width for 100% full-width responsive scaling (especially on iPhone)
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

    // Process bookings into hourly buckets
    const chartData = useMemo(() => {
        const hourlySales = {}
        const hourlyCounts = {}
        hours.forEach(h => {
            hourlySales[h] = 0
            hourlyCounts[h] = 0
        })

        // Valid sales statuses (including completed, paid, success, seated, confirmed, ready)
        const validStatuses = ['completed', 'paid', 'success', 'seated', 'confirmed', 'ready']
        const validBookings = (bookings || []).filter(b => {
            const status = (b.status || '').toLowerCase()
            return validStatuses.includes(status) && status !== 'cancelled' && status !== 'void'
        })

        validBookings.forEach(b => {
            const timeStr = b.booking_time || b.created_at
            if (!timeStr) return
            const h = getBangkokHour(timeStr)

            // Calculate bill amount from total_amount (primary in DB), fallback to total_price, deposit, or order_items sum
            let billAmt = Number(b.total_amount ?? b.total_price ?? b.deposit_amount ?? 0)
            if (!billAmt && Array.isArray(b.order_items) && b.order_items.length > 0) {
                billAmt = b.order_items.reduce((sum, it) => {
                    const price = Number(it.price_at_time ?? it.menu_items?.price ?? 0)
                    const qty = Number(it.quantity || 1)
                    return sum + (price * qty)
                }, 0)
            }

            if (billAmt > 0 && hourlySales[h] !== undefined) {
                hourlySales[h] += billAmt
                hourlyCounts[h] += 1
            }
        })

        // Build cumulative curves
        let runningTotal = 0
        const points = hours.map(h => {
            const sale = hourlySales[h]
            runningTotal += sale
            return {
                hour: h,
                label: `${h}.00`,
                sale,
                count: hourlyCounts[h],
                cumulative: runningTotal
            }
        })

        // Benchmark curve: Typical casual dining pacing progression (11:00 to 23:00)
        // If today has sales, estimate target full-day or use realistic baseline
        const maxCumulative = Math.max(runningTotal * 1.25, 12000)
        const curveWeights = [0.03, 0.12, 0.24, 0.30, 0.35, 0.40, 0.50, 0.68, 0.84, 0.93, 0.97, 0.99, 1.0]

        const benchmarkPoints = hours.map((h, idx) => ({
            hour: h,
            expectedCumulative: Math.round(maxCumulative * (curveWeights[idx] || 1))
        }))

        return { points, benchmarkPoints, totalRevenue: runningTotal }
    }, [bookings, hours])

    const { points, benchmarkPoints, totalRevenue } = chartData

    // Dynamic Responsive Dimensions (eliminates iPhone letterboxing and squished ribbons)
    const isMobile = containerWidth < 540
    const svgWidth = Math.max(320, containerWidth)
    const svgHeight = isMobile ? 240 : 270
    const padLeft = isMobile ? 38 : 48
    const padRight = isMobile ? 12 : 18
    const padYTop = isMobile ? 22 : 28
    const padYBottom = isMobile ? 32 : 36
    const plotWidth = Math.max(svgWidth - padLeft - padRight, 200)
    const plotHeight = Math.max(svgHeight - padYTop - padYBottom, 120)

    // Active points for today: only draw actual sales line up to the current hour (do not extrapolate 0 into future hours)
    const activePoints = useMemo(() => {
        if (!isViewingToday) return points
        // When viewing today, line extends up to current hour (or at least index 0 if before 11:00)
        const cappedHour = Math.min(23, Math.max(11, currentBangkokHour))
        return points.filter(p => p.hour <= cappedHour)
    }, [points, isViewingToday, currentBangkokHour])

    // 0. Upcoming confirmed bookings for the rest of today (Hard Guaranteed Floor)
    const upcomingBookingsData = useMemo(() => {
        const cappedHour = Math.min(23, Math.max(11, currentBangkokHour))
        const futureConfirmed = (bookings || []).filter(b => {
            const status = (b.status || '').toLowerCase()
            const isConfirmed = status === 'confirmed' || status === 'seated' || status === 'ready'
            if (!isConfirmed) return false
            const timeStr = b.booking_time || b.created_at
            if (!timeStr) return false
            const h = getBangkokHour(timeStr)
            return isViewingToday ? h > cappedHour : true
        })

        let guaranteedPax = 0
        let guaranteedRevenue = 0
        futureConfirmed.forEach(b => {
            const pax = parseInt(b.pax || 2, 10)
            guaranteedPax += pax
            let billAmt = Number(b.total_amount ?? b.total_price ?? b.deposit_amount ?? 0)
            if (!billAmt) {
                billAmt = pax * 380 // Estimated dinner spend per head
            }
            guaranteedRevenue += billAmt
        })

        return {
            count: futureConfirmed.length,
            pax: guaranteedPax,
            revenue: guaranteedRevenue
        }
    }, [bookings, currentBangkokHour, isViewingToday])

    // 0.1 Ad Leads Signals & Lift
    const adSignals = useMemo(() => {
        let totalDirections = 0
        let totalPageviews = 0
        let totalLine = 0
        const hourlyDirections = {}
        hours.forEach(h => { hourlyDirections[h] = 0 })

        adEvents.forEach(e => {
            const h = getBangkokHour(e.created_at)
            const ev = e.event_name || ''
            if (ev === 'page_view') totalPageviews++
            else if (ev === 'click_directions' || ev === 'find_location') {
                totalDirections++
                if (hourlyDirections[h] !== undefined) hourlyDirections[h]++
            } else if (ev === 'click_line' || ev === 'generate_lead') {
                totalLine++
            }
        })

        const cappedHour = Math.min(23, Math.max(11, currentBangkokHour))
        const recentDirections = (hourlyDirections[cappedHour] || 0) + (hourlyDirections[cappedHour - 1] || 0)
        // Ad Lift percentage for upcoming revenue (up to +30%)
        const adLiftPct = Math.min(0.30, recentDirections * 0.05 + totalLine * 0.03)

        return {
            totalDirections,
            totalPageviews,
            totalLine,
            recentDirections,
            adLiftPct
        }
    }, [adEvents, hours, currentBangkokHour])

    // 0.2 Seasonality & Day-of-Week
    const dayOfWeek = useMemo(() => {
        try {
            const d = selectedDate ? new Date(`${selectedDate}T12:00:00+07:00`) : new Date()
            return d.getDay() // 0 = Sun, 5 = Fri, 6 = Sat
        } catch {
            return 1
        }
    }, [selectedDate])
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6
    const weekendMultiplier = isWeekend ? 1.25 : 1.0

    // 0.3 Hourly Physical Table Capacity Ceiling & Spend-Per-Head by Daypart
    const getHourSpendPerHead = (h) => {
        if (h >= 11 && h <= 13) return 200 // Lunch Rush
        if (h >= 14 && h <= 16) return 150 // Afternoon Cafe
        if (h >= 17 && h <= 20) return Math.round(420 * weekendMultiplier) // Prime Dinner
        return 300 // Late Night Bar
    }

    const getHourCapacityCeiling = (h) => {
        const turnRate = (h >= 12 && h <= 13) || (h >= 18 && h <= 20) ? 1.15 : 0.85
        const maxPax = Math.round(totalSeats * turnRate)
        const maxRev = maxPax * getHourSpendPerHead(h)
        return { maxPax, maxRev }
    }

    // Cumulative venue capacity ceiling across all hours
    const capacityCeilingTotal = useMemo(() => {
        let total = 0
        hours.forEach(h => {
            total += getHourCapacityCeiling(h).maxRev
        })
        return total
    }, [hours, totalSeats, weekendMultiplier])

    // 1. Calculate Predictive Forecast Trajectory (Base, High, Low)
    const { projectedTotal, forecastPoints, projectedHigh, forecastHighPoints, projectedLow, forecastLowPoints } = useMemo(() => {
        if (!isViewingToday || activePoints.length === 0) {
            return { 
                projectedTotal: 0, 
                forecastPoints: [], 
                projectedHigh: 0, 
                forecastHighPoints: [], 
                projectedLow: 0, 
                forecastLowPoints: [] 
            }
        }

        const lastActive = activePoints[activePoints.length - 1]
        const lastIdx = hours.indexOf(lastActive.hour)
        if (lastIdx === -1 || lastIdx >= hours.length - 1) {
            return { 
                projectedTotal: totalRevenue, 
                forecastPoints: [],
                projectedHigh: totalRevenue,
                forecastHighPoints: [],
                projectedLow: totalRevenue,
                forecastLowPoints: []
            }
        }

        const currentActual = lastActive.cumulative
        const curveWeights = [0.03, 0.12, 0.24, 0.30, 0.35, 0.40, 0.50, 0.68, 0.84, 0.93, 0.97, 0.99, 1.0]
        const currentWeight = curveWeights[lastIdx] || 0.5
        const remainingWeight = Math.max(0.01, 1.0 - currentWeight)

        // Baseline reference
        const baseTarget = Math.max(12000, currentActual)
        const rawPace = (currentWeight > 0 && baseTarget > 0) ? (currentActual / (baseTarget * currentWeight)) : 1.0
        const paceFactor = Math.max(0.70, Math.min(1.80, rawPace))

        // Calculate expected remaining revenue with Ad Lift & Daypart Dynamics
        let expectedRemainingBase = 0
        let cumulativeMaxCeiling = currentActual

        for (let i = lastIdx + 1; i < hours.length; i++) {
            const h = hours[i]
            const stepWeight = ((curveWeights[i] || 1.0) - (curveWeights[i - 1] || 0))
            const rawHourRev = stepWeight * baseTarget * paceFactor
            // Near-term hours (next 1-2 hours) get boosted by Ad Intent
            const isNearTerm = i <= lastIdx + 2
            const adBoost = isNearTerm ? (1 + adSignals.adLiftPct) : 1.0
            const hourExpected = Math.round(rawHourRev * adBoost)

            // Clamp by physical table capacity ceiling
            const { maxRev } = getHourCapacityCeiling(h)
            cumulativeMaxCeiling += maxRev
            expectedRemainingBase += Math.min(hourExpected, maxRev)
        }

        // Hard Floor: At least current actual + guaranteed upcoming bookings
        const guaranteedFloor = currentActual + upcomingBookingsData.revenue

        // Base forecast (Blended with capacity ceiling and guaranteed floor)
        let finalEst = Math.max(guaranteedFloor, Math.min(cumulativeMaxCeiling, currentActual + expectedRemainingBase))

        // High forecast (Bull case: strong ad conversion + full walk-in saturation, clamped by venue ceiling)
        let finalHigh = Math.min(cumulativeMaxCeiling, Math.round(currentActual + (finalEst - currentActual) * 1.25))

        // Low forecast (Bear case: walk-in slow down, but anchored by guaranteed floor)
        let finalLow = Math.max(guaranteedFloor, Math.round(currentActual + (finalEst - currentActual) * 0.75))

        const remainingDelta = Math.max(0, finalEst - currentActual)
        const highDelta = Math.max(0, finalHigh - currentActual)
        const lowDelta = Math.max(0, finalLow - currentActual)

        const fPoints = []
        const fHighPoints = []
        const fLowPoints = []

        for (let i = lastIdx; i < hours.length; i++) {
            const h = hours[i]
            const w = curveWeights[i] || 1.0
            const progress = (w - currentWeight) / remainingWeight
            const clampedProgress = Math.max(0, Math.min(1, progress))

            // Base trajectory
            const cum = Math.round(currentActual + remainingDelta * clampedProgress)
            fPoints.push({ hour: h, cumulative: cum, idx: i })

            // High trajectory (Bull factor)
            const cumHigh = Math.round(currentActual + highDelta * clampedProgress)
            fHighPoints.push({ hour: h, cumulative: cumHigh, idx: i })

            // Low trajectory (Bear factor)
            const cumLow = Math.round(currentActual + lowDelta * clampedProgress)
            fLowPoints.push({ hour: h, cumulative: cumLow, idx: i })
        }

        return { 
            projectedTotal: finalEst, 
            forecastPoints: fPoints,
            projectedHigh: finalHigh,
            forecastHighPoints: fHighPoints,
            projectedLow: finalLow,
            forecastLowPoints: fLowPoints
        }
    }, [isViewingToday, activePoints, hours, totalRevenue, adSignals, upcomingBookingsData, totalSeats, weekendMultiplier])

    const maxVal = useMemo(() => {
        const maxCum = points.length > 0 ? points[points.length - 1].cumulative : 0
        const maxBench = benchmarkPoints.length > 0 ? benchmarkPoints[benchmarkPoints.length - 1].expectedCumulative : 0
        const ceiling = Math.max(maxCum, maxBench, projectedHigh || projectedTotal || 0, 12000)
        return Math.ceil(ceiling / 5000) * 5000
    }, [points, benchmarkPoints, projectedHigh, projectedTotal])

    const getX = (idx) => padLeft + (idx / (hours.length - 1)) * plotWidth
    const getY = (val) => svgHeight - padYBottom - (val / maxVal) * plotHeight

    // Generate SVG path strings
    const { pathActual, pathArea, pathBenchmark } = useMemo(() => {
        if (points.length === 0) return { pathActual: '', pathArea: '', pathBenchmark: '' }

        // Actual Line (drawn up to activePoints)
        const coords = activePoints.map((pt) => {
            const idx = hours.indexOf(pt.hour)
            return `${getX(idx).toFixed(1)},${getY(pt.cumulative).toFixed(1)}`
        })

        const pathAct = coords.length > 0 ? `M ${coords.join(' L ')}` : ''

        // Actual Area
        let pathAr = ''
        if (coords.length > 1) {
            const lastIdx = hours.indexOf(activePoints[activePoints.length - 1].hour)
            const firstIdx = hours.indexOf(activePoints[0].hour)
            pathAr = `${pathAct} L ${getX(lastIdx).toFixed(1)},${(svgHeight - padYBottom).toFixed(1)} L ${getX(firstIdx).toFixed(1)},${(svgHeight - padYBottom).toFixed(1)} Z`
        }

        // Benchmark Path
        const benchCoords = benchmarkPoints.map((pt, i) => `${getX(i).toFixed(1)},${getY(pt.expectedCumulative).toFixed(1)}`)
        const pathBench = `M ${benchCoords.join(' L ')}`

        return { pathActual: pathAct, pathArea: pathAr, pathBenchmark: pathBench }
    }, [points, activePoints, benchmarkPoints, hours, maxVal, plotWidth, plotHeight, svgHeight, padLeft, padRight])

    // Generate Forecast Path (Base)
    const pathForecast = useMemo(() => {
        if (!forecastPoints || forecastPoints.length < 2) return ''
        const coords = forecastPoints.map(pt => `${getX(pt.idx).toFixed(1)},${getY(pt.cumulative).toFixed(1)}`)
        return `M ${coords.join(' L ')}`
    }, [forecastPoints, maxVal, plotWidth, plotHeight, padLeft, padRight, svgHeight])

    // Generate Forecast Paths for High, Low, and Shaded Confidence Fan
    const { pathForecastHigh, pathForecastLow, pathForecastFan } = useMemo(() => {
        if (!forecastHighPoints || forecastHighPoints.length < 2 || !forecastLowPoints || forecastLowPoints.length < 2) {
            return { pathForecastHigh: '', pathForecastLow: '', pathForecastFan: '' }
        }

        const highCoords = forecastHighPoints.map(pt => `${getX(pt.idx).toFixed(1)},${getY(pt.cumulative).toFixed(1)}`)
        const lowCoords = forecastLowPoints.map(pt => `${getX(pt.idx).toFixed(1)},${getY(pt.cumulative).toFixed(1)}`)

        const pHigh = `M ${highCoords.join(' L ')}`
        const pLow = `M ${lowCoords.join(' L ')}`

        // Connect High forward, then Low in reverse to form a closed polygon
        const reversedLow = [...forecastLowPoints].reverse().map(pt => `${getX(pt.idx).toFixed(1)},${getY(pt.cumulative).toFixed(1)}`)
        const pFan = `M ${highCoords.join(' L ')} L ${reversedLow.join(' L ')} Z`

        return { pathForecastHigh: pHigh, pathForecastLow: pLow, pathForecastFan: pFan }
    }, [forecastHighPoints, forecastLowPoints, maxVal, plotWidth, plotHeight, padLeft, padRight, svgHeight])

    // Peak rush hour
    const peakHour = useMemo(() => {
        let maxS = 0
        let bestH = null
        points.forEach(p => {
            if (p.sale > maxS) {
                maxS = p.sale
                bestH = p
            }
        })
        return bestH
    }, [points])

    // Latest active cumulative value
    const latestActive = activePoints.length > 0 ? activePoints[activePoints.length - 1] : null

    return (
        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] mb-6 overflow-hidden">
            {/* Header Ribbon */}
            <div className="p-3 sm:p-4 bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] uppercase tracking-wider">
                        VELOCITY // PULSE
                    </span>
                    <div>
                        <h3 className="font-mono text-sm sm:text-base font-bold text-[oklch(18%_0.012_28)] uppercase">
                            Intraday Sales Velocity (ความเร็วยอดขายสะสมรายชั่วโมง)
                        </h3>
                        <p className="text-[11px] font-mono text-[oklch(42%_0.010_28)]">
                            เปรียบเทียบจังหวะยอดขายจริงกับ Benchmark ค่าเฉลี่ยร้าน (11.00 - 23.00 น.)
                        </p>
                    </div>
                </div>

                {/* Key Summary Stats */}
                <div className="flex items-center gap-3 sm:gap-4 font-mono text-xs flex-wrap">
                    <div>
                        <span className="text-[10px] text-[oklch(55%_0.010_28)] block">CUMULATIVE TODAY</span>
                        <span className="font-bold text-base sm:text-lg text-[oklch(18%_0.012_28)] tabular-nums">
                            ฿{totalRevenue.toLocaleString()}
                        </span>
                    </div>
                    {projectedTotal > totalRevenue && (
                        <div className="border-l border-[oklch(85%_0.012_28)] pl-3 sm:pl-4">
                            <span className="text-[10px] text-[oklch(55%_0.010_28)] block">EST. CLOSING (คาดการณ์ปิดวัน: ฐาน / กรอบ)</span>
                            <div className="flex items-baseline gap-1.5">
                                <span className="font-bold text-sm sm:text-base text-[oklch(52%_0.20_28)] tabular-nums">
                                    ~฿{projectedTotal.toLocaleString()}
                                </span>
                                <span className="text-[10px] font-mono text-[oklch(55%_0.010_28)] tabular-nums">
                                    (ต่ำ ฿{projectedLow >= 1000 ? `${Math.round(projectedLow / 1000)}k` : projectedLow} - สูง ฿{projectedHigh >= 1000 ? `${Math.round(projectedHigh / 1000)}k` : projectedHigh})
                                </span>
                            </div>
                        </div>
                    )}
                    {peakHour && peakHour.sale > 0 && (
                        <div className="border-l border-[oklch(85%_0.012_28)] pl-3 sm:pl-4 hidden sm:block">
                            <span className="text-[10px] text-[oklch(55%_0.010_28)] block">PEAK RUSH</span>
                            <span className="font-bold text-sm text-[oklch(18%_0.012_28)] tabular-nums">
                                {peakHour.hour}.00 น. (฿{peakHour.sale.toLocaleString()})
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Chart Graphic Area */}
            <div 
                ref={containerRef} 
                onClick={() => setHoveredHour(null)}
                className="p-2 sm:p-4 relative w-full"
            >
                {/* Executive Predictive Drivers Indicator Strip */}
                {isViewingToday && projectedTotal > totalRevenue && (
                    <div className="flex items-center gap-2 sm:gap-3 px-3 py-1.5 mb-2.5 bg-[oklch(94%_0.010_28)] border border-[oklch(88%_0.012_28)] text-[10.5px] font-mono flex-wrap">
                        <span className="font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider text-[9.5px] bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-1.5 py-0.2">
                            DRIVERS
                        </span>
                        <div className="flex items-center gap-1 text-[oklch(42%_0.010_28)]">
                            <span className="font-bold text-[oklch(18%_0.012_28)]">ความจุโต๊ะ:</span>
                            <span>{totalSeats} ที่นั่ง (เพดาน ~฿{Math.round(capacityCeilingTotal / 1000)}k)</span>
                        </div>
                        <div className="flex items-center gap-1 text-[oklch(42%_0.010_28)] border-l border-[oklch(88%_0.012_28)] pl-2">
                            <span className="font-bold text-[oklch(45%_0.08_140)]">แรงหนุน Ads:</span>
                            <span>{adSignals.adLiftPct > 0 ? `+${Math.round(adSignals.adLiftPct * 100)}% (${adSignals.recentDirections} ขอทาง Maps)` : 'ปกติ (ไม่มี Ads เร่งด่วน)'}</span>
                        </div>
                        {upcomingBookingsData.count > 0 && (
                            <div className="flex items-center gap-1 text-[oklch(42%_0.010_28)] border-l border-[oklch(88%_0.012_28)] pl-2">
                                <span className="font-bold text-[oklch(52%_0.20_28)]">ยอดจองเย็น:</span>
                                <span>{upcomingBookingsData.count} โต๊ะ ({upcomingBookingsData.pax} คน ~฿{upcomingBookingsData.revenue.toLocaleString()})</span>
                            </div>
                        )}
                        <div className="flex items-center gap-1 text-[oklch(42%_0.010_28)] border-l border-[oklch(88%_0.012_28)] pl-2 hidden md:flex">
                            <span className="font-bold text-[oklch(18%_0.012_28)]">ตัวคูณวัน:</span>
                            <span>{isWeekend ? 'สุดสัปดาห์ (+25% ดินเนอร์)' : 'วันธรรมดา (สปีดปกติ)'}</span>
                        </div>
                    </div>
                )}

                {/* Visual Legend */}
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 font-mono text-[11px] mb-2 text-[oklch(42%_0.010_28)] flex-wrap">
                    <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-1.5 bg-[oklch(52%_0.20_28)] rounded-xs inline-block" />
                        <span className="font-bold text-[oklch(18%_0.012_28)]">ยอดขายจริง</span>
                    </div>
                    {pathForecast && (
                        <div className="flex items-center gap-1.5">
                            <span className="w-4 h-1 border-t-2 border-dashed border-[oklch(52%_0.20_28)] inline-block opacity-90" />
                            <span className="font-bold text-[oklch(52%_0.20_28)]">เส้นเดิม (ฐาน Base)</span>
                        </div>
                    )}
                    {pathForecastHigh && (
                        <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-1 border-t-2 border-dashed border-[oklch(45%_0.08_140)] inline-block" />
                            <span className="text-[oklch(45%_0.08_140)] font-bold">สูง (High)</span>
                        </div>
                    )}
                    {pathForecastLow && (
                        <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-1 border-t-2 border-dashed border-[oklch(60%_0.015_28)] inline-block" />
                            <span className="text-[oklch(55%_0.010_28)]">ต่ำ (Low)</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-1 border-t-2 border-dashed border-[oklch(65%_0.010_28)] inline-block" />
                        <span>Benchmark ค่าเฉลี่ย</span>
                    </div>
                </div>

                {/* Responsive Full-Width SVG Chart */}
                <div className="w-full select-none">
                    <svg
                        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                        style={{ width: '100%', height: `${svgHeight}px` }}
                        className="w-full block select-none"
                    >
                        <defs>
                            {/* Gradient Area Fill for Red Actual Line */}
                            <linearGradient id="velocityFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="oklch(52% 0.20 28)" stopOpacity="0.30" />
                                <stop offset="100%" stopColor="oklch(52% 0.20 28)" stopOpacity="0.02" />
                            </linearGradient>
                            <style>{`
                                @keyframes forecastStream {
                                    from {
                                        stroke-dashoffset: 20;
                                    }
                                    to {
                                        stroke-dashoffset: 0;
                                    }
                                }
                                .forecast-flow-line {
                                    animation: forecastStream 2.2s linear infinite;
                                }
                            `}</style>
                        </defs>

                        {/* Rush Hour Highlight Banners */}
                        {/* Lunch: 12:00 - 14:00 (index 1 to 3) */}
                        <rect
                            x={getX(1)}
                            y={padYTop}
                            width={getX(3) - getX(1)}
                            height={plotHeight}
                            fill="oklch(94% 0.010 28)"
                            opacity="0.85"
                        />
                        <text
                            x={(getX(1) + getX(3)) / 2}
                            y={padYTop + 13}
                            textAnchor="middle"
                            className={`font-mono ${isMobile ? 'text-[8px]' : 'text-[9px]'} font-bold fill-[oklch(55%_0.010_28)] uppercase`}
                        >
                            {isMobile ? 'LUNCH' : 'LUNCH RUSH'}
                        </text>

                        {/* Dinner: 18:00 - 21:00 (index 7 to 10) */}
                        <rect
                            x={getX(7)}
                            y={padYTop}
                            width={getX(10) - getX(7)}
                            height={plotHeight}
                            fill="oklch(94% 0.010 28)"
                            opacity="0.85"
                        />
                        <text
                            x={(getX(7) + getX(10)) / 2}
                            y={padYTop + 13}
                            textAnchor="middle"
                            className={`font-mono ${isMobile ? 'text-[8px]' : 'text-[9px]'} font-bold fill-[oklch(55%_0.010_28)] uppercase`}
                        >
                            {isMobile ? 'DINNER' : 'PRIME DINNER'}
                        </text>

                        {/* Horizontal Gridlines & Y-Axis Labels */}
                        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                            const y = svgHeight - padYBottom - ratio * plotHeight
                            const labelVal = Math.round(ratio * maxVal)
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
                                        ฿{labelVal >= 1000 ? `${Math.round(labelVal / 1000)}k` : labelVal}
                                    </text>
                                </g>
                            )
                        })}

                        {/* Hovered Guide Line Indicator */}
                        {hoveredHour !== null && (() => {
                            const hIdx = hours.indexOf(hoveredHour)
                            if (hIdx === -1) return null
                            const hx = getX(hIdx)
                            return (
                                <line
                                    x1={hx}
                                    y1={padYTop}
                                    x2={hx}
                                    y2={svgHeight - padYBottom}
                                    stroke="oklch(52% 0.20 28)"
                                    strokeWidth="1"
                                    strokeDasharray="2 2"
                                    opacity="0.6"
                                />
                            )
                        })()}

                        {/* Benchmark Expected Curve */}
                        {pathBenchmark && (
                            <path
                                d={pathBenchmark}
                                fill="none"
                                stroke="oklch(60% 0.015 28)"
                                strokeWidth="2"
                                strokeDasharray="4 4"
                            />
                        )}

                        {/* Actual Cumulative Gradient Area (Red) */}
                        {pathArea && (
                            <path
                                d={pathArea}
                                fill="url(#velocityFill)"
                            />
                        )}

                        {/* Shaded Forecast Fan / Scenario Cone (พื้นที่กรอบคาดการณ์ ต่ำ - สูง) */}
                        {pathForecastFan && (
                            <path
                                d={pathForecastFan}
                                fill="oklch(52% 0.20 28)"
                                opacity="0.07"
                            />
                        )}

                        {/* Low Forecast Scenario Line (ต่ำ) */}
                        {pathForecastLow && (
                            <path
                                d={pathForecastLow}
                                fill="none"
                                stroke="oklch(60% 0.015 28)"
                                strokeWidth="1.5"
                                strokeDasharray="4 3"
                                opacity="0.75"
                            />
                        )}

                        {/* High Forecast Scenario Line (สูง) */}
                        {pathForecastHigh && (
                            <path
                                d={pathForecastHigh}
                                fill="none"
                                stroke="oklch(45% 0.08 140)"
                                strokeWidth="1.8"
                                strokeDasharray="4 3"
                                opacity="0.85"
                            />
                        )}

                        {/* Animated Smooth Predictive Forecast Line (โมชันเส้นประคาดการณ์แบบลื่นไหล - เส้นเดิม ฐาน) */}
                        {pathForecast && (
                            <path
                                d={pathForecast}
                                fill="none"
                                stroke="oklch(52% 0.20 28)"
                                strokeWidth={isMobile ? '2.5' : '3'}
                                strokeDasharray="6 4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="forecast-flow-line opacity-90"
                            />
                        )}

                        {/* Forecast Projected End Pips & Tags at 23:00 (ต่ำ / เส้นเดิม ฐาน / สูง) */}
                        {forecastPoints && forecastPoints.length > 1 && (() => {
                            const lastBase = forecastPoints[forecastPoints.length - 1]
                            const lastHigh = forecastHighPoints?.[forecastHighPoints.length - 1]
                            const lastLow = forecastLowPoints?.[forecastLowPoints.length - 1]

                            const fx = getX(lastBase.idx)
                            const fyBase = getY(lastBase.cumulative)
                            const fyHigh = lastHigh ? getY(lastHigh.cumulative) : fyBase
                            const fyLow = lastLow ? getY(lastLow.cumulative) : fyBase

                            return (
                                <g>
                                    {/* High Scenario Tag */}
                                    {projectedHigh > projectedTotal && (
                                        <g>
                                            <circle
                                                cx={fx}
                                                cy={fyHigh}
                                                r={isMobile ? '2.5' : '3'}
                                                fill="oklch(97% 0.008 28)"
                                                stroke="oklch(45% 0.08 140)"
                                                strokeWidth="1.5"
                                            />
                                            <text
                                                x={fx - 4}
                                                y={fyHigh - 5}
                                                textAnchor="end"
                                                className="font-mono text-[8px] font-bold fill-[oklch(45%_0.08_140)] tabular-nums"
                                            >
                                                สูง ~฿{projectedHigh >= 1000 ? `${Math.round(projectedHigh / 1000)}k` : projectedHigh}
                                            </text>
                                        </g>
                                    )}

                                    {/* Base Scenario Tag (เส้นเดิม) */}
                                    <circle
                                        cx={fx}
                                        cy={fyBase}
                                        r={isMobile ? '3' : '3.5'}
                                        fill="oklch(97% 0.008 28)"
                                        stroke="oklch(52% 0.20 28)"
                                        strokeWidth="1.5"
                                        strokeDasharray="2 1"
                                    />
                                    <text
                                        x={fx - 4}
                                        y={projectedHigh > projectedTotal ? fyBase + 10 : fyBase - 8}
                                        textAnchor="end"
                                        className="font-mono text-[9px] font-bold fill-[oklch(52%_0.20_28)] tabular-nums"
                                    >
                                        ฐาน ~฿{projectedTotal >= 1000 ? `${Math.round(projectedTotal / 1000)}k` : projectedTotal}
                                    </text>

                                    {/* Low Scenario Tag */}
                                    {projectedLow < projectedTotal && (
                                        <g>
                                            <circle
                                                cx={fx}
                                                cy={fyLow}
                                                r={isMobile ? '2.5' : '3'}
                                                fill="oklch(97% 0.008 28)"
                                                stroke="oklch(60% 0.015 28)"
                                                strokeWidth="1.5"
                                            />
                                            <text
                                                x={fx - 4}
                                                y={fyLow + 10}
                                                textAnchor="end"
                                                className="font-mono text-[8px] fill-[oklch(55%_0.010_28)] tabular-nums"
                                            >
                                                ต่ำ ~฿{projectedLow >= 1000 ? `${Math.round(projectedLow / 1000)}k` : projectedLow}
                                            </text>
                                        </g>
                                    )}
                                </g>
                            )
                        })()}

                        {/* Actual Cumulative Main Line (Vibrant Clay Terracotta / Red) */}
                        {pathActual && (
                            <path
                                d={pathActual}
                                fill="none"
                                stroke="oklch(52% 0.20 28)"
                                strokeWidth={isMobile ? '2.5' : '3'}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        )}

                        {/* Live Now Precision Radar Marker (สุขุม นิ่ง สวยงาม ไม่กระพริบเร็วหรือกดลง) */}
                        {latestActive && (() => {
                            const liveX = getX(hours.indexOf(latestActive.hour))
                            const liveY = getY(latestActive.cumulative)
                            return (
                                <g>
                                    <circle
                                        cx={liveX}
                                        cy={liveY}
                                        r={isMobile ? '7' : '9'}
                                        fill="oklch(52% 0.20 28)"
                                        opacity="0.18"
                                    />
                                    <circle
                                        cx={liveX}
                                        cy={liveY}
                                        r={isMobile ? '4.5' : '5.5'}
                                        fill="none"
                                        stroke="oklch(52% 0.20 28)"
                                        strokeWidth="1.5"
                                        opacity="0.75"
                                    />
                                    <circle
                                        cx={liveX}
                                        cy={liveY}
                                        r={isMobile ? '3' : '3.5'}
                                        fill="oklch(52% 0.20 28)"
                                        stroke="white"
                                        strokeWidth="1.5"
                                    />
                                </g>
                            )
                        })()}

                        {/* Interactive Data Points and Invisible Hit Columns for mobile tap */}
                        {points.map((pt, i) => {
                            const cx = getX(i)
                            const cy = getY(pt.cumulative)
                            const isHovered = hoveredHour === pt.hour
                            const isPointActive = !isViewingToday || pt.hour <= (currentBangkokHour || 23)
                            
                            // On narrow screens (iPhone), alternate hour labels to prevent collision, but always show hovered
                            const showLabel = !isMobile || pt.hour % 2 === 1 || isHovered || pt.hour === 23

                            return (
                                <g
                                    key={pt.hour}
                                    className="cursor-pointer"
                                    onMouseEnter={() => setHoveredHour(pt.hour)}
                                    onMouseLeave={() => setHoveredHour(null)}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setHoveredHour(prev => prev === pt.hour ? null : pt.hour)
                                    }}
                                    onTouchStart={(e) => {
                                        e.stopPropagation()
                                        setHoveredHour(pt.hour)
                                    }}
                                >
                                    {/* Invisible broad vertical hit target for easy tapping on iPhone/touchscreens */}
                                    <rect
                                        x={cx - (plotWidth / (hours.length - 1)) / 2}
                                        y={padYTop}
                                        width={plotWidth / (hours.length - 1)}
                                        height={plotHeight + padYBottom}
                                        fill="transparent"
                                    />

                                    {/* Small tick on the baseline for all hours */}
                                    <line
                                        x1={cx}
                                        y1={svgHeight - padYBottom}
                                        x2={cx}
                                        y2={svgHeight - padYBottom + 4}
                                        stroke={isHovered ? 'oklch(18% 0.012 28)' : 'oklch(80% 0.012 28)'}
                                        strokeWidth={isHovered ? '1.5' : '1'}
                                    />

                                    {/* Circle point along cumulative curve */}
                                    {isPointActive && (
                                        <circle
                                            cx={cx}
                                            cy={cy}
                                            r={isHovered ? (isMobile ? 5.5 : 6.5) : (isMobile ? 3.5 : 4)}
                                            fill={isHovered ? 'oklch(18% 0.012 28)' : 'oklch(52% 0.20 28)'}
                                            stroke="white"
                                            strokeWidth={isMobile ? '1.5' : '2'}
                                            className="transition-all duration-150"
                                        />
                                    )}

                                    {/* X-axis Hour Label */}
                                    {showLabel && (
                                        <text
                                            x={cx}
                                            y={svgHeight - padYBottom + 16}
                                            textAnchor="middle"
                                            className={`font-mono ${isMobile ? 'text-[8.5px]' : 'text-[9.5px]'} tabular-nums ${
                                                isHovered
                                                    ? 'fill-[oklch(18%_0.012_28)] font-bold'
                                                    : isPointActive
                                                    ? 'fill-[oklch(18%_0.012_28)] font-semibold'
                                                    : 'fill-[oklch(65%_0.010_28)]'
                                            }`}
                                        >
                                            {pt.hour}.00
                                        </text>
                                    )}
                                </g>
                            )
                        })}
                    </svg>
                </div>

                {/* Hover/Tap Popover Card */}
                {hoveredHour !== null && (() => {
                    const pt = points.find(p => p.hour === hoveredHour)
                    if (!pt) return null
                    return (
                        <div 
                            onClick={(e) => e.stopPropagation()}
                            className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] p-2.5 sm:p-3 rounded-sm font-mono text-xs shadow-xl border border-[oklch(35%_0.012_28)] z-20 max-w-[220px] sm:max-w-xs pointer-events-auto"
                        >
                            <div className="text-[10px] text-[oklch(75%_0.010_28)] font-bold mb-1 border-b border-[oklch(35%_0.012_28)] pb-1 flex justify-between items-center">
                                <span>TIME // {pt.hour}.00 - {pt.hour + 1}.00 น.</span>
                                <button 
                                    type="button" 
                                    onClick={() => setHoveredHour(null)} 
                                    className="sm:hidden text-white/60 hover:text-white ml-2 text-xs cursor-pointer"
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="flex justify-between gap-3 sm:gap-6 py-0.5">
                                <span className="text-[oklch(75%_0.010_28)]">ยอดชั่วโมงนี้:</span>
                                <span className="font-bold text-[oklch(52%_0.20_28)] tabular-nums">฿{pt.sale.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between gap-3 sm:gap-6 py-0.5">
                                <span className="text-[oklch(75%_0.010_28)]">ยอดสะสม:</span>
                                <span className="font-bold text-white tabular-nums">฿{pt.cumulative.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between gap-3 sm:gap-6 text-[10px] text-[oklch(65%_0.010_28)] pt-1 border-t border-[oklch(30%_0.012_28)] mt-1">
                                <span>จำนวนบิล:</span>
                                <span className="tabular-nums">{pt.count} บิล</span>
                            </div>
                        </div>
                    )
                })()}
            </div>
        </div>
    )
}
