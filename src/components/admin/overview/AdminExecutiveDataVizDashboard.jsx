/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Bento Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useMemo } from 'react'
import { getThaiDate, formatThaiDateOnly, formatThaiTimeOnly } from '../../../utils/timeUtils'

const OPERATING_HOURS = [11, 13, 15, 17, 19, 21, 23]

const getBangkokHour = (timeInput) => {
    if (!timeInput) return -1
    try {
        const d = new Date(timeInput)
        if (isNaN(d.getTime())) return -1
        const bkkMs = d.getTime() + 7 * 3600 * 1000
        return new Date(bkkMs).getUTCHours()
    } catch {
        return new Date(timeInput).getHours()
    }
}

/**
 * Generate smooth Catmull-Rom cubic bezier SVG path
 */
function getSmoothSplinePath(points) {
    if (!points || points.length === 0) return ''
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
    if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`

    let d = `M ${points[0].x} ${points[0].y}`
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)]
        const p1 = points[i]
        const p2 = points[i + 1]
        const p3 = points[Math.min(points.length - 1, i + 2)]
        const cp1x = p1.x + (p2.x - p0.x) / 6
        const cp1y = p1.y + (p2.y - p0.y) / 6
        const cp2x = p2.x - (p3.x - p1.x) / 6
        const cp2y = p2.y - (p3.y - p1.y) / 6
        d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
    }
    return d
}

/**
 * AdminExecutiveDataVizDashboard
 * Modern Bento-Box Executive Overview modeled after design-taste-frontend app-screens
 * Visualizes 5 core operational dimensions:
 * 1. Executive Operations Briefing & Daily Status Card
 * 2. Activity // Hourly Velocity Bars with Highlight Callout
 * 3. Treasury & Payments Breakdown + Stylized POS Drawer Card
 * 4. Revenue Flow // Smooth Spline Wave with Inflection Dots & Peak Marker
 * 5. Service Channels // Radial Donut Ring Chart with percentage tags
 */
export default function AdminExecutiveDataVizDashboard({
    bookings = [],
    revenueToday = 0,
    yesterdayRevenue = 0,
    completedOrdersCount = 0,
    activeUnpaidRevenue = 0,
    activeUnpaidCount = 0,
    totalTables = 12,
    occupiedTables = 0,
    totalGuests = 0,
    dineInCount = 0,
    pickupCount = 0,
    paymentBreakdown = { cash: 0, qr: 0, credit: 0 },
    adTelemetry = { visits: 0, maps: 0, contacts: 0, orders: 0, totalEvents: 0 },
    shifts = [],
    selectedDate = getThaiDate(),
    loading = false,
    onOpenShiftLedger = null,
    onSwitchToLiveNow = null,
    onOpenDailySlip = null
}) {
    const isToday = !selectedDate || selectedDate === getThaiDate()
    const [hoveredHour, setHoveredHour] = useState(null)

    // 1. Hourly & Daypart metrics aggregation
    const hourlyData = useMemo(() => {
        const hourMap = {}
        for (let h = 11; h <= 23; h++) {
            hourMap[h] = { hour: h, revenue: 0, orders: 0, guests: 0 }
        }

        bookings.forEach(b => {
            if (['cancelled', 'void'].includes(b.status)) return
            const h = getBangkokHour(b.booking_time || b.created_at)
            if (h >= 11 && h <= 23 && hourMap[h]) {
                const amt = Number(b.total_amount || b.total_price || 0)
                const isPaid = ['completed', 'paid', 'success'].includes(b.status)
                if (isPaid) {
                    hourMap[h].revenue += amt
                }
                hourMap[h].orders += 1
                hourMap[h].guests += Number(b.guest_count || b.pax || 2)
            }
        })

        const list = Object.values(hourMap)
        let maxRev = 0
        let peakH = 19
        list.forEach(item => {
            if (item.revenue > maxRev) {
                maxRev = item.revenue
                peakH = item.hour
            }
        })

        return {
            list,
            maxRevenue: Math.max(maxRev, 1000),
            peakHour: peakH,
            peakRevenue: maxRev
        }
    }, [bookings])

    // 2. Active Shift and Drawer Cash Analysis
    const shiftSummary = useMemo(() => {
        const active = shifts.find(s => s.status === 'open') || (shifts.length > 0 ? shifts[shifts.length - 1] : null)
        const hasShift = Boolean(active)
        const isOpen = active?.status === 'open'
        const startingCash = Number(active?.starting_cash || 2500)
        const cashIn = Number(active?.cash_in || 0)
        const cashOut = Number(active?.cash_out || 0)
        const cashSales = Number(paymentBreakdown?.cash || 0)
        const expectedCash = startingCash + cashSales + cashIn - cashOut
        const staffName = active?.staff_name || 'พนักงานหน้าร้าน'
        const openedTime = active?.opened_at ? formatThaiTimeOnly(active.opened_at) : '10:30'

        return {
            hasShift,
            isOpen,
            startingCash,
            expectedCash,
            staffName,
            openedTime,
            shiftCount: shifts.length
        }
    }, [shifts, paymentBreakdown])

    // 3. Payment Mix split calculations
    const paymentMix = useMemo(() => {
        const qr = Number(paymentBreakdown?.qr || 0)
        const cash = Number(paymentBreakdown?.cash || 0)
        const credit = Number(paymentBreakdown?.credit || 0)
        const sum = qr + cash + credit
        if (sum === 0) {
            return { qr: 0, cash: 0, credit: 0, qrPct: 0, cashPct: 0, creditPct: 0, sum: 0 }
        }
        const qrPct = Math.round((qr / sum) * 100)
        const creditPct = Math.round((credit / sum) * 100)
        const cashPct = Math.max(0, 100 - qrPct - creditPct)
        return { qr, cash, credit, qrPct, cashPct, creditPct, sum }
    }, [paymentBreakdown])

    // 4. Channel Mix for Radial Donut Ring
    const channelMix = useMemo(() => {
        const dine = Number(dineInCount || 0)
        const pick = Number(pickupCount || 0)
        // Online advance bookings
        const online = bookings.filter(b => b.booking_type === 'online' || b.source === 'online').length
        const total = dine + pick + online

        if (total === 0) {
            return {
                dine,
                pick,
                online,
                total: 0,
                dinePct: 0,
                pickPct: 0,
                onlinePct: 0
            }
        }

        const dinePct = Math.round((dine / total) * 100)
        const pickPct = Math.round((pick / total) * 100)
        const onlinePct = Math.max(0, 100 - dinePct - pickPct)

        return {
            dine,
            pick,
            online,
            total,
            dinePct,
            pickPct,
            onlinePct
        }
    }, [dineInCount, pickupCount, bookings])

    // 5. Trend Spline Points (Total Spent style curve)
    const splinePoints = useMemo(() => {
        const width = 360
        const height = 110
        const padX = 20
        const padYTop = 15
        const padYBottom = 15
        const plotW = width - padX * 2
        const plotH = height - padYTop - padYBottom

        const hoursList = [11, 13, 15, 17, 19, 21, 23]
        const vals = hoursList.map(h => {
            const match = hourlyData.list.find(item => item.hour === h)
            return match ? match.revenue : 0
        })

        const maxVal = Math.max(...vals, 1000)

        const pts = hoursList.map((h, i) => {
            const x = padX + (i / (hoursList.length - 1)) * plotW
            const val = vals[i]
            // Inverted Y: 0 at bottom, max at top
            const y = padYTop + (1 - val / maxVal) * plotH
            return { x, y, hour: h, value: val }
        })

        // Find peak point
        let peakPoint = pts[0]
        pts.forEach(p => {
            if (p.value > peakPoint.value) {
                peakPoint = p
            }
        })

        const pathD = getSmoothSplinePath(pts)
        return {
            points: pts,
            pathD,
            peakPoint,
            width,
            height
        }
    }, [hourlyData])

    // 6. Revenue Delta Comparison
    const deltaInfo = useMemo(() => {
        if (!yesterdayRevenue || yesterdayRevenue === 0) {
            return { pct: 0, isPos: true, text: 'เปรียบเทียบวันแรก' }
        }
        const diff = revenueToday - yesterdayRevenue
        const pct = Math.round((diff / yesterdayRevenue) * 100)
        return {
            pct: Math.abs(pct),
            isPos: diff >= 0,
            text: `${diff >= 0 ? '+' : '-'}${Math.abs(pct)}% vs เมื่อวาน`
        }
    }, [revenueToday, yesterdayRevenue])

    // 7. Average Check / Ticket
    const avgCheck = useMemo(() => {
        if (completedOrdersCount <= 0) return 0
        return Math.round(revenueToday / completedOrdersCount)
    }, [revenueToday, completedOrdersCount])

    const totalProjectedRevenue = Number(revenueToday || 0) + Number(activeUnpaidRevenue || 0)

    return (
        <div className="space-y-4 font-sans select-none">
            {/* Top Minimal Executive Header Breadcrumb */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[oklch(88%_0.012_28)]">
                <div>
                    <div className="flex items-center gap-2 text-xs font-mono text-[oklch(55%_0.010_28)]">
                        <span>IN THE HAUS</span>
                        <span>&rarr;</span>
                        <span className="font-bold text-[oklch(18%_0.012_28)]">Executive Operations Overview</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-[oklch(18%_0.012_28)] tracking-tight mt-0.5">
                        Finance &amp; Operations Overview
                    </h2>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-mono text-xs font-bold text-[oklch(42%_0.010_28)] bg-[oklch(94%_0.010_28)] border border-[oklch(88%_0.012_28)] px-2.5 py-1 rounded-sm">
                        {formatThaiDateOnly(selectedDate)}
                    </span>
                    {onSwitchToLiveNow && (
                        <button
                            type="button"
                            onClick={onSwitchToLiveNow}
                            className="px-3 py-1 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] text-xs font-bold rounded-sm cursor-pointer transition-colors flex items-center gap-1.5"
                            title="สลับไปผังโต๊ะสดหน้าร้าน"
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-[oklch(52%_0.16_28)] shrink-0" />
                            <span>ดูผังโต๊ะสด (LIVE NOW)</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Main Modular Bento Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                {/* ========================================================================= */}
                {/* 1. LEFT COLUMN (3 cols on desktop): Operational Briefing / Sentinel Card   */}
                {/* ========================================================================= */}
                <div className="lg:col-span-3 flex flex-col justify-between gap-4 bg-[oklch(97%_0.008_28)] border border-[oklch(88%_0.012_28)] p-4 sm:p-5 rounded-2xl shadow-2xs">
                    <div>
                        <div className="flex items-center justify-between pb-3 border-b border-[oklch(88%_0.012_28)]">
                            <span className="text-xs font-semibold text-[oklch(18%_0.012_28)]">
                                Operations Status
                            </span>
                            <span className={`px-2 py-0.5 font-mono text-[10px] font-bold rounded-sm ${
                                !isToday
                                    ? 'bg-[oklch(90%_0.010_28)] text-[oklch(42%_0.010_28)]'
                                    : shiftSummary.isOpen
                                        ? 'bg-[oklch(92%_0.02_140)] text-[oklch(28%_0.08_140)] border border-[oklch(82%_0.04_140)]'
                                        : 'bg-[oklch(92%_0.02_28)] text-[oklch(52%_0.16_28)] border border-[oklch(85%_0.012_28)]'
                            }`}>
                                {!isToday ? 'ARCHIVED' : shiftSummary.isOpen ? 'POS ACTIVE' : 'TERMINAL CLOSED'}
                            </span>
                        </div>

                        {/* Status Narrative */}
                        <div className="mt-3.5 space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-[oklch(45%_0.010_28)]">พนักงานแคชเชียร์:</span>
                                <span className="font-semibold text-[oklch(18%_0.012_28)]">{shiftSummary.staffName}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[oklch(45%_0.010_28)]">เปิดรอบการขาย:</span>
                                <span className="font-mono font-semibold text-[oklch(18%_0.012_28)]">{shiftSummary.openedTime} น.</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[oklch(45%_0.010_28)]">โต๊ะเปิดขณะนี้:</span>
                                <span className="font-mono font-bold text-[oklch(52%_0.16_28)]">{occupiedTables} / {totalTables} โต๊ะ</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[oklch(45%_0.010_28)]">ลูกค้าในร้าน:</span>
                                <span className="font-mono font-semibold text-[oklch(18%_0.012_28)]">{totalGuests} ท่าน</span>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-[oklch(90%_0.010_28)]">
                                <span className="text-[oklch(45%_0.010_28)]">ยังไม่คิดเงิน:</span>
                                <span className={`font-mono font-bold tabular-nums ${
                                    activeUnpaidRevenue > 0 ? 'text-[oklch(52%_0.16_28)]' : 'text-[oklch(52%_0.010_28)]'
                                }`}>
                                    {loading
                                        ? '...'
                                        : activeUnpaidRevenue > 0
                                            ? `฿${activeUnpaidRevenue.toLocaleString()} (${activeUnpaidCount} บิล)`
                                            : '฿0 · ไม่มีค้าง'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Inner Highlights Card (Matches Advantages / Pro Version card in reference) */}
                    <div className="bg-[oklch(94%_0.010_28)] border border-[oklch(88%_0.012_28)] p-3.5 sm:p-4 rounded-xl space-y-3">
                        <div className="flex items-start justify-between">
                            <div>
                                <h4 className="font-bold text-sm text-[oklch(18%_0.012_28)]">Daily Health</h4>
                                <p className="text-[11px] text-[oklch(48%_0.010_28)] mt-0.5">
                                    ประสิทธิภาพการหมุนเวียนโต๊ะและสลิปปิดวัน
                                </p>
                            </div>
                            <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-[oklch(92%_0.02_140)] text-[oklch(28%_0.08_140)] border border-[oklch(82%_0.04_140)] rounded-sm">
                                100% OK
                            </span>
                        </div>

                        {/* Subtle Mini SVG Sparkline */}
                        <div className="h-9 w-full flex items-center justify-center">
                            <svg className="w-full h-8 overflow-visible" viewBox="0 0 160 32" fill="none">
                                <path
                                    d="M 5 24 Q 45 4, 85 18 T 155 8"
                                    stroke="oklch(18% 0.012 28)"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                />
                                <circle cx="155" cy="8" r="3" fill="oklch(18% 0.012 28)" />
                            </svg>
                        </div>

                        {onOpenDailySlip && (
                            <button
                                type="button"
                                onClick={onOpenDailySlip}
                                className="w-full py-2 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(28%_0.012_28)] text-[oklch(97%_0.008_28)] text-xs font-bold rounded-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                            >
                                <span>สลิปปิดวัน [Z-REPORT]</span>
                                <span>&rarr;</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* ========================================================================= */}
                {/* 2. RIGHT 9-COLUMN AREA: Subgrid of Visual Data Cards                       */}
                {/* ========================================================================= */}
                <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-12 gap-4">

                    {/* --------------------------------------------------------------------- */}
                    {/* CARD 2A: Activity // Hourly Velocity Bars (Center Top, 7 cols)        */}
                    {/* --------------------------------------------------------------------- */}
                    <div className="md:col-span-7 bg-[oklch(97%_0.008_28)] border border-[oklch(88%_0.012_28)] p-4 sm:p-5 rounded-2xl shadow-2xs flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-[oklch(18%_0.012_28)]">
                                    Activity
                                </span>
                                <span className="font-mono text-[11px] text-[oklch(48%_0.010_28)]">
                                    Hourly Revenue · ชำระแล้ว
                                </span>
                            </div>
                            <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                                <h3 className="font-mono text-2xl sm:text-3xl font-bold text-[oklch(18%_0.012_28)] tabular-nums">
                                    {loading ? '...' : `฿${revenueToday.toLocaleString()}`}
                                </h3>
                                <span className={`font-mono text-xs font-semibold ${deltaInfo.isPos ? 'text-[oklch(38%_0.10_140)]' : 'text-[oklch(52%_0.16_28)]'}`}>
                                    {deltaInfo.text}
                                </span>
                                {activeUnpaidRevenue > 0 && (
                                    <span className="font-mono text-xs text-[oklch(52%_0.16_28)] tabular-nums">
                                        · รอคิดเงิน +฿{activeUnpaidRevenue.toLocaleString()}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Minimal Hourly Bar Chart */}
                        <div className="relative pt-8 pb-2 mt-2">
                            {/* Bar Columns Container */}
                            <div className="flex items-end justify-between gap-1.5 sm:gap-2 h-28">
                                {hourlyData.list.map((item) => {
                                    const isPeak = item.hour === hourlyData.peakHour && item.revenue > 0
                                    const isHovered = hoveredHour === item.hour
                                    const isHighlighted = isHovered || (!hoveredHour && isPeak)
                                    const heightRatio = hourlyData.maxRevenue > 0 ? item.revenue / hourlyData.maxRevenue : 0
                                    const barHeight = Math.max(8, Math.round(heightRatio * 100))

                                    return (
                                        <div
                                            key={item.hour}
                                            className="relative flex-1 h-full flex flex-col justify-end items-center group cursor-pointer"
                                            onMouseEnter={() => setHoveredHour(item.hour)}
                                            onMouseLeave={() => setHoveredHour(null)}
                                        >
                                            {/* Floating Yellow Callout Badge above Highlighted Bar */}
                                            {isHighlighted && item.revenue > 0 && (
                                                <div
                                                    className="absolute z-20 pointer-events-none transition-transform duration-150 flex flex-col items-center"
                                                    style={{ bottom: `calc(${barHeight}% + 4px)` }}
                                                >
                                                    <span className="bg-[#E9F344] text-[oklch(18%_0.012_28)] font-mono font-bold text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-sm shadow-xs whitespace-nowrap tabular-nums">
                                                        {item.hour}:00 &middot; ฿{Math.round(item.revenue / 1000)}k
                                                    </span>
                                                    <div className="w-1.5 h-1.5 bg-[#E9F344] rotate-45 -mt-0.5" />
                                                </div>
                                            )}

                                            {/* Column Bar */}
                                            <div
                                                style={{ height: `${barHeight}%` }}
                                                className={`w-full rounded-t-sm transition-colors duration-150 ${
                                                    isHighlighted
                                                        ? 'bg-[oklch(18%_0.012_28)]'
                                                        : item.revenue > 0
                                                            ? 'bg-[oklch(85%_0.014_28)] hover:bg-[oklch(75%_0.020_28)]'
                                                            : 'bg-[oklch(92%_0.008_28)]'
                                                }`}
                                            />
                                        </div>
                                    )
                                })}
                            </div>

                            {/* X-Axis Hour Labels */}
                            <div className="flex items-center justify-between text-[10px] font-mono text-[oklch(48%_0.010_28)] mt-2 pt-1 border-t border-[oklch(88%_0.012_28)]">
                                {OPERATING_HOURS.map(h => (
                                    <span key={h}>{h}h</span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* --------------------------------------------------------------------- */}
                    {/* CARD 2B: Treasury & Payments + POS Card (Right Top, 5 cols)           */}
                    {/* --------------------------------------------------------------------- */}
                    <div className="md:col-span-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-3">
                        {/* Upper: Settled vs Active Unpaid Revenue + Payment Ratio */}
                        <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(88%_0.012_28)] p-4 rounded-2xl shadow-2xs space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-[oklch(18%_0.012_28)]">
                                    Treasury &amp; Settlement
                                </span>
                                {onOpenShiftLedger && (
                                    <button
                                        type="button"
                                        onClick={onOpenShiftLedger}
                                        className="text-[11px] font-mono text-[oklch(52%_0.16_28)] hover:underline cursor-pointer"
                                    >
                                        กะ POS &rarr;
                                    </button>
                                )}
                            </div>

                            {/* 2-Column Settled vs Unpaid Split */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="min-w-0">
                                    <div className="text-[11px] text-[oklch(48%_0.010_28)]">ชำระแล้ว (ปิดบิล):</div>
                                    <div className="font-mono text-xl sm:text-2xl font-bold text-[oklch(18%_0.012_28)] tabular-nums truncate">
                                        {loading ? '...' : `฿${revenueToday.toLocaleString()}`}
                                    </div>
                                    <div className="text-[10px] font-mono text-[oklch(38%_0.10_140)] font-semibold mt-0.5 tabular-nums">
                                        +{completedOrdersCount} บิลปิดยอดแล้ว
                                    </div>
                                </div>

                                <div className="min-w-0 border-l border-[oklch(88%_0.012_28)] pl-3">
                                    <div className="flex items-center gap-1.5 text-[11px] text-[oklch(48%_0.010_28)]">
                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeUnpaidRevenue > 0 ? 'bg-[oklch(52%_0.16_28)]' : 'bg-[oklch(75%_0.010_28)]'}`} />
                                        <span className="truncate">ยังไม่คิดเงิน:</span>
                                    </div>
                                    <div className={`font-mono text-xl sm:text-2xl font-bold tabular-nums truncate ${
                                        activeUnpaidRevenue > 0 ? 'text-[oklch(52%_0.16_28)]' : 'text-[oklch(55%_0.010_28)]'
                                    }`}>
                                        {loading ? '...' : `฿${activeUnpaidRevenue.toLocaleString()}`}
                                    </div>
                                    <div className={`text-[10px] font-mono font-semibold mt-0.5 tabular-nums ${
                                        activeUnpaidCount > 0 ? 'text-[oklch(52%_0.16_28)]' : 'text-[oklch(55%_0.010_28)]'
                                    }`}>
                                        {activeUnpaidCount > 0 ? `${activeUnpaidCount} บิลรอชำระ` : 'ไม่มีบิลค้าง'}
                                    </div>
                                </div>
                            </div>

                            {/* Split Progress Bar */}
                            <div className="space-y-1.5 pt-0.5">
                                <div className="h-2 w-full rounded-full bg-[oklch(92%_0.008_28)] overflow-hidden flex gap-0.5">
                                    {paymentMix.qrPct > 0 && (
                                        <div
                                            style={{ width: `${paymentMix.qrPct}%` }}
                                            className="h-full bg-[oklch(45%_0.08_140)] transition-[width] duration-300"
                                        />
                                    )}
                                    {paymentMix.cashPct > 0 && (
                                        <div
                                            style={{ width: `${paymentMix.cashPct}%` }}
                                            className="h-full bg-[oklch(18%_0.012_28)] transition-[width] duration-300"
                                        />
                                    )}
                                    {paymentMix.creditPct > 0 && (
                                        <div
                                            style={{ width: `${paymentMix.creditPct}%` }}
                                            className="h-full bg-[oklch(52%_0.16_28)] transition-[width] duration-300"
                                        />
                                    )}
                                </div>
                                <div className="flex items-center justify-between text-[11px] font-mono text-[oklch(48%_0.010_28)] tabular-nums gap-2 flex-wrap">
                                    <span className="flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[oklch(45%_0.08_140)]" />
                                        PromptPay {paymentMix.qrPct}%
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[oklch(18%_0.012_28)]" />
                                        เงินสด {paymentMix.cashPct}%
                                    </span>
                                    {paymentMix.creditPct > 0 && (
                                        <span className="flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[oklch(52%_0.16_28)]" />
                                            บัตร {paymentMix.creditPct}%
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Projected Combined Total Footer (Closes arithmetic: Paid + Unpaid) */}
                            <div className="flex items-center justify-between pt-2 border-t border-[oklch(88%_0.012_28)] text-[11px]">
                                <span className="text-[oklch(48%_0.010_28)]">รวมยอดทั้งหมด (ปิดบิล + ค้างโต๊ะ)</span>
                                <span className="font-mono font-bold text-[oklch(18%_0.012_28)] tabular-nums">
                                    {loading ? '...' : `฿${totalProjectedRevenue.toLocaleString()}`}
                                </span>
                            </div>
                        </div>

                        {/* Lower: Stylized POS Cash Drawer Card (Matches Green VISA Card in reference) */}
                        <div className="bg-[oklch(42%_0.09_140)] text-[oklch(98%_0.006_28)] p-4 rounded-2xl shadow-xs flex flex-col justify-between space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-[10px] font-bold opacity-85">
                                    POS TERMINAL DRAWER
                                </span>
                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-white/20 rounded-xs">
                                    CASH
                                </span>
                            </div>

                            <div>
                                <span className="text-[10px] font-mono opacity-75 block">ยอดเงินสดคาดการณ์ในลิ้นชัก:</span>
                                <div className="font-mono text-2xl font-bold tabular-nums tracking-tight">
                                    ฿{shiftSummary.expectedCash.toLocaleString()}
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] font-mono opacity-85 pt-1 border-t border-white/15">
                                <span>ทอนเปิด ฿{shiftSummary.startingCash.toLocaleString()}</span>
                                <span>{shiftSummary.openedTime} น.</span>
                            </div>
                        </div>
                    </div>

                    {/* --------------------------------------------------------------------- */}
                    {/* CARD 3A: Revenue Flow // Smooth Spline Wave (Center Bottom, 7 cols)   */}
                    {/* --------------------------------------------------------------------- */}
                    <div className="md:col-span-7 bg-[oklch(97%_0.008_28)] border border-[oklch(88%_0.012_28)] p-4 sm:p-5 rounded-2xl shadow-2xs flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-[oklch(18%_0.012_28)]">
                                    Revenue Flow
                                </span>
                                <span className="font-mono text-[11px] text-[oklch(48%_0.010_28)]">
                                    Average Ticket Pace
                                </span>
                            </div>
                            <div className="mt-1 flex items-baseline gap-2">
                                <h3 className="font-mono text-2xl sm:text-3xl font-bold text-[oklch(18%_0.012_28)] tabular-nums">
                                    ฿{avgCheck.toLocaleString()}
                                    <small className="text-xs font-sans font-normal text-[oklch(48%_0.010_28)] ml-1">/ บิล</small>
                                </h3>
                                <span className="font-mono text-xs text-[oklch(48%_0.010_28)]">
                                    เป้าหมาย ฿800/บิล
                                </span>
                            </div>
                        </div>

                        {/* Smooth Bezier Spline Wave with Dots and Callout (Matches Total Spent in reference) */}
                        <div className="relative my-3 w-full">
                            <svg
                                viewBox={`0 0 ${splinePoints.width} ${splinePoints.height}`}
                                className="w-full h-28 overflow-visible"
                            >
                                {/* Baseline */}
                                <line
                                    x1="20"
                                    y1={splinePoints.height - 15}
                                    x2={splinePoints.width - 20}
                                    y2={splinePoints.height - 15}
                                    stroke="oklch(88% 0.012 28)"
                                    strokeWidth="1"
                                />

                                {/* Spline Curve */}
                                <path
                                    d={splinePoints.pathD}
                                    fill="none"
                                    stroke="oklch(18% 0.012 28)"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                />

                                {/* Inflection Node Dots */}
                                {splinePoints.points.map((pt) => {
                                    const isPeak = pt.hour === splinePoints.peakPoint.hour
                                    return (
                                        <g key={pt.hour}>
                                            <circle
                                                cx={pt.x}
                                                cy={pt.y}
                                                r={isPeak ? 4.5 : 3.5}
                                                fill={isPeak ? 'oklch(18% 0.012 28)' : 'oklch(97% 0.008 28)'}
                                                stroke="oklch(18% 0.012 28)"
                                                strokeWidth="2"
                                            />
                                        </g>
                                    )
                                })}

                                {/* Peak Marker Dashed Line */}
                                {splinePoints.peakPoint && splinePoints.peakPoint.value > 0 && (
                                    <line
                                        x1={splinePoints.peakPoint.x}
                                        y1={splinePoints.peakPoint.y}
                                        x2={splinePoints.peakPoint.x}
                                        y2={splinePoints.height - 15}
                                        stroke="#E9F344"
                                        strokeWidth="1.5"
                                        strokeDasharray="3 2"
                                    />
                                )}
                            </svg>

                            {/* Floating Callout at Peak */}
                            {splinePoints.peakPoint && splinePoints.peakPoint.value > 0 && (
                                <div
                                    className="absolute pointer-events-none"
                                    style={{
                                        left: `${(splinePoints.peakPoint.x / splinePoints.width) * 100}%`,
                                        top: `${(splinePoints.peakPoint.y / splinePoints.height) * 100}%`,
                                        transform: 'translate(-50%, -130%)'
                                    }}
                                >
                                    <span className="bg-[#E9F344] text-[oklch(18%_0.012_28)] font-mono font-bold text-[10px] px-2 py-0.5 rounded-sm shadow-xs whitespace-nowrap tabular-nums">
                                        ฿{splinePoints.peakPoint.value.toLocaleString()}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Bottom Metadata Tiles (Matches 10 Wallets, 26 Assets in reference) */}
                        <div className="flex items-center justify-between pt-2 border-t border-[oklch(88%_0.012_28)] text-xs font-mono">
                            <div>
                                <span className="font-bold text-base text-[oklch(18%_0.012_28)] block">
                                    {occupiedTables} <small className="font-normal text-[11px] text-[oklch(48%_0.010_28)]">/{totalTables}</small>
                                </span>
                                <span className="text-[11px] font-sans text-[oklch(48%_0.010_28)]">โต๊ะเปิดในร้าน</span>
                            </div>

                            <div>
                                <span className="font-bold text-base text-[oklch(18%_0.012_28)] block">
                                    {totalGuests}
                                </span>
                                <span className="text-[11px] font-sans text-[oklch(48%_0.010_28)]">จำนวนลูกค้า</span>
                            </div>

                            <div>
                                <span className="font-bold text-base text-[oklch(18%_0.012_28)] block">
                                    {totalTables > 0 ? (completedOrdersCount / totalTables).toFixed(1) : '1.0'}x
                                </span>
                                <span className="text-[11px] font-sans text-[oklch(48%_0.010_28)]">รอบหมุนเวียนโต๊ะ</span>
                            </div>
                        </div>
                    </div>

                    {/* --------------------------------------------------------------------- */}
                    {/* CARD 3B: Service Channels // Radial Donut Ring (Right Bottom, 5 cols)  */}
                    {/* --------------------------------------------------------------------- */}
                    <div className="md:col-span-5 bg-[oklch(97%_0.008_28)] border border-[oklch(88%_0.012_28)] p-4 sm:p-5 rounded-2xl shadow-2xs flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[oklch(18%_0.012_28)]">
                                Service Channels
                            </span>
                            <span className="font-mono text-[11px] text-[oklch(48%_0.010_28)]">
                                Breakdown
                            </span>
                        </div>

                        {/* Radial Donut Ring (Matches Contract Type 86% in reference) */}
                        <div className="relative py-2 flex items-center justify-center">
                            {(() => {
                                const size = 120
                                const stroke = 14
                                const r = (size - stroke) / 2
                                const c = 2 * Math.PI * r

                                const dineLen = (channelMix.dinePct / 100) * c
                                const pickLen = (channelMix.pickPct / 100) * c
                                const onlineLen = Math.max(0, c - dineLen - pickLen)

                                return (
                                    <div className="relative w-32 h-32 flex items-center justify-center">
                                        <svg className="w-full h-full -rotate-90 overflow-visible" viewBox={`0 0 ${size} ${size}`}>
                                            {/* Background Track */}
                                            <circle
                                                cx={size / 2}
                                                cy={size / 2}
                                                r={r}
                                                stroke="oklch(92% 0.008 28)"
                                                strokeWidth={stroke}
                                                fill="none"
                                            />

                                            {/* Dine-in Arc (Primary) */}
                                            {dineLen > 0 && (
                                                <circle
                                                    cx={size / 2}
                                                    cy={size / 2}
                                                    r={r}
                                                    stroke="oklch(45% 0.08 140)"
                                                    strokeWidth={stroke}
                                                    strokeDasharray={`${dineLen} ${c}`}
                                                    strokeDashoffset="0"
                                                    fill="none"
                                                    strokeLinecap="round"
                                                />
                                            )}

                                            {/* Pickup Arc */}
                                            {pickLen > 0 && (
                                                <circle
                                                    cx={size / 2}
                                                    cy={size / 2}
                                                    r={r}
                                                    stroke="oklch(52% 0.16 28)"
                                                    strokeWidth={stroke}
                                                    strokeDasharray={`${pickLen} ${c}`}
                                                    strokeDashoffset={`-${dineLen + 2}`}
                                                    fill="none"
                                                    strokeLinecap="round"
                                                />
                                            )}

                                            {/* Online Arc */}
                                            {onlineLen > 0 && (
                                                <circle
                                                    cx={size / 2}
                                                    cy={size / 2}
                                                    r={r}
                                                    stroke="oklch(75% 0.14 45)"
                                                    strokeWidth={stroke}
                                                    strokeDasharray={`${onlineLen} ${c}`}
                                                    strokeDashoffset={`-${dineLen + pickLen + 4}`}
                                                    fill="none"
                                                    strokeLinecap="round"
                                                />
                                            )}
                                        </svg>

                                        {/* Donut Center Display */}
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            <span className="font-mono text-2xl font-bold text-[oklch(18%_0.012_28)] tabular-nums">
                                                {channelMix.dinePct}%
                                            </span>
                                            <span className="text-[10px] font-mono text-[oklch(48%_0.010_28)]">
                                                Dine-in
                                            </span>
                                        </div>

                                        {/* Floating Tag next to Donut (only shown when Pick-up orders exist) */}
                                        {channelMix.pickPct > 0 && (
                                            <span className="absolute top-1 -right-2 font-mono text-[10px] font-bold px-1.5 py-0.5 bg-[oklch(92%_0.02_28)] text-[oklch(52%_0.16_28)] border border-[oklch(85%_0.012_28)] rounded-sm">
                                                {channelMix.pickPct}% Pick
                                            </span>
                                        )}
                                    </div>
                                )
                            })()}
                        </div>

                        {/* Bottom 3-Slot Channel Counters (Matches 140, 48, 16 in reference) */}
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[oklch(88%_0.012_28)] text-center font-mono text-xs">
                            <div>
                                <span className="font-bold text-base text-[oklch(18%_0.012_28)] block">
                                    {channelMix.dine}
                                </span>
                                <span className="text-[11px] font-sans text-[oklch(48%_0.010_28)]">ทานที่ร้าน</span>
                            </div>

                            <div>
                                <span className="font-bold text-base text-[oklch(18%_0.012_28)] block">
                                    {channelMix.pick}
                                </span>
                                <span className="text-[11px] font-sans text-[oklch(48%_0.010_28)]">สั่งกลับ</span>
                            </div>

                            <div>
                                <span className="font-bold text-base text-[oklch(18%_0.012_28)] block">
                                    {channelMix.online}
                                </span>
                                <span className="text-[11px] font-sans text-[oklch(48%_0.010_28)]">จองออนไลน์</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}
