/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useMemo } from 'react'
import { getThaiDate, formatThaiDateOnly } from '../../../utils/timeUtils'

const OPERATING_HOURS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]

const DAYPART_BUCKETS = [
    { id: 'lunch', label: 'มื้อกลางวัน', shortLabel: '11–14 น.', hours: [11, 12, 13] },
    { id: 'afternoon', label: 'คาเฟ่บ่าย', shortLabel: '14–17 น.', hours: [14, 15, 16] },
    { id: 'dinner', label: 'มื้อค่ำพีค', shortLabel: '17–21 น.', hours: [17, 18, 19, 20] },
    { id: 'late', label: 'บาร์ดึก', shortLabel: '21–24 น.', hours: [21, 22, 23] }
]

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

const formatCompactCurrency = (val) => {
    const n = Number(val || 0)
    if (n >= 10000) return `฿${(n / 1000).toFixed(1)}k`
    if (n >= 1000) return `฿${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
    return `฿${n.toLocaleString()}`
}

/**
 * AdminOverviewDigestCard
 * Built to tasteskill v2 (`achromatic-ledger` app screen rules):
 * - KPIs are type in one divided strip (zero icons in tinted circles, zero sparklines)
 * - KPIs act as the chart's series tabs (2px ink underline on the active metric)
 * - Single clean column chart with restrained motion (smooth scaleY entrance, 1px dashed average line,
 *   neutral warm-stone columns, and one Clay Terracotta accent hue on the peak/focused bar with a dark pill callout)
 * - 3-cell visual digest footer consolidating Payment Mix, Service/Dwell Velocity, and Cash Drawer status
 */
export default function AdminOverviewDigestCard({
    bookings = [],
    revenueToday = 0,
    yesterdayRevenue = 0,
    completedOrdersCount = 0,
    activeUnpaidRevenue = 0,
    activeUnpaidCount = 0,
    totalTables = 12,
    occupiedTables = 0,
    totalGuests = 0,
    pendingInboxCount = 0,
    dineInCount = 0,
    pickupCount = 0,
    paymentBreakdown = { cash: 0, qr: 0, credit: 0 },
    adTelemetry = { visits: 0, maps: 0, contacts: 0, orders: 0, totalEvents: 0 },
    shifts = [],
    selectedDate = getThaiDate(),
    loading = false,
    onOpenShiftLedger = null,
    onOpenShiftsTab = null
}) {
    const handleOpenShift = onOpenShiftLedger || onOpenShiftsTab
    const [activeMetric, setActiveMetric] = useState('revenue') // 'revenue' | 'orders' | 'guests'
    const [granularity, setGranularity] = useState('hour') // 'hour' | 'daypart'
    const [focusedIndex, setFocusedIndex] = useState(null)
    const [barsReady, setBarsReady] = useState(false)

    // Trigger simple, restrained entrance motion on mount and when date/granularity changes
    useEffect(() => {
        setBarsReady(false)
        const timer = requestAnimationFrame(() => {
            setBarsReady(true)
        })
        return () => cancelAnimationFrame(timer)
    }, [selectedDate, granularity])

    const isToday = !selectedDate || selectedDate === getThaiDate()

    // Aggregate hourly & daypart series + dwell time metrics from real bookings
    const digest = useMemo(() => {
        const hourlyMap = {}
        OPERATING_HOURS.forEach(h => {
            hourlyMap[h] = { hour: h, label: `${h}:00`, shortLabel: `${h}`, revenue: 0, orders: 0, guests: 0 }
        })

        let validDwellMins = 0
        let validDwellCount = 0
        let quickDwell = 0
        let standardDwell = 0
        let longDwell = 0
        let totalGuestsAllDay = 0

        const validBookings = (bookings || []).filter(b => {
            const st = (b.status || '').toLowerCase()
            return !['cancelled', 'void'].includes(st)
        })

        validBookings.forEach(b => {
            const st = (b.status || '').toLowerCase()
            const isSettled = ['completed', 'paid', 'success'].includes(st)
            const isActive = ['seated', 'confirmed', 'ready', 'preparing'].includes(st)
            if (!isSettled && !isActive) return

            let amt = Number(b.total_amount ?? b.total_price ?? 0)
            if (!amt && Array.isArray(b.order_items) && b.order_items.length > 0) {
                amt = b.order_items.reduce((s, it) => {
                    return s + Number(it.price_at_time ?? it.menu_items?.price ?? 0) * Number(it.quantity || 1)
                }, 0)
            }
            const pax = Math.max(1, parseInt(b.guest_count || b.pax || 1, 10))
            totalGuestsAllDay += pax

            const h = getBangkokHour(b.booking_time || b.created_at)
            const clampedHour = h >= 11 && h <= 23 ? h : (h >= 6 && h < 11 ? 11 : 23)
            if (hourlyMap[clampedHour]) {
                hourlyMap[clampedHour].revenue += amt
                hourlyMap[clampedHour].orders += 1
                hourlyMap[clampedHour].guests += pax
            }

            // Dwell calculation for dine-in
            const isPickup = b.booking_type === 'pickup' || (b.booking_type || '').includes('takeaway')
            if (!isPickup && (st === 'completed' || st === 'seated')) {
                const startMs = new Date(b.booking_time || b.created_at).getTime()
                const endMs = st === 'completed' && b.updated_at ? new Date(b.updated_at).getTime() : Date.now()
                const mins = Math.max(15, Math.round((endMs - startMs) / 60000))
                if (mins > 0 && mins < 300) {
                    validDwellMins += mins
                    validDwellCount += 1
                    if (mins < 45) quickDwell++
                    else if (mins <= 75) standardDwell++
                    else longDwell++
                }
            }
        })

        const hourlySeries = OPERATING_HOURS.map(h => hourlyMap[h])
        const daypartSeries = DAYPART_BUCKETS.map(dp => {
            const rev = dp.hours.reduce((s, h) => s + (hourlyMap[h]?.revenue || 0), 0)
            const ord = dp.hours.reduce((s, h) => s + (hourlyMap[h]?.orders || 0), 0)
            const pax = dp.hours.reduce((s, h) => s + (hourlyMap[h]?.guests || 0), 0)
            return {
                id: dp.id,
                label: `${dp.label} (${dp.shortLabel})`,
                shortLabel: dp.label,
                subLabel: dp.shortLabel,
                revenue: rev,
                orders: ord,
                guests: pax
            }
        })

        const avgDwell = validDwellCount > 0 ? Math.round(validDwellMins / validDwellCount) : 0
        const turnsPerTable = totalTables > 0 ? ((dineInCount || 0) / totalTables).toFixed(1) : '0.0'

        return {
            hourlySeries,
            daypartSeries,
            totalGuestsAllDay: Math.max(totalGuestsAllDay, totalGuests),
            avgDwell,
            validDwellCount,
            quickDwell,
            standardDwell,
            longDwell,
            turnsPerTable
        }
    }, [bookings, totalGuests, totalTables, dineInCount])

    // Active chart data items based on granularity ('hour' vs 'daypart')
    const chartItems = useMemo(() => {
        const raw = granularity === 'daypart' ? digest.daypartSeries : digest.hourlySeries
        return raw.map((item, index) => {
            const value = activeMetric === 'revenue'
                ? item.revenue
                : activeMetric === 'orders'
                    ? item.orders
                    : item.guests
            return {
                ...item,
                index,
                value
            }
        })
    }, [granularity, digest, activeMetric])

    // Compute peak index, max scale, and non-zero average for the reference line
    const chartStats = useMemo(() => {
        const values = chartItems.map(i => i.value)
        const maxVal = Math.max(...values, 0)
        const nonZeroValues = values.filter(v => v > 0)
        const avgVal = nonZeroValues.length > 0
            ? Math.round(nonZeroValues.reduce((a, b) => a + b, 0) / nonZeroValues.length)
            : 0

        let peakIdx = -1
        if (maxVal > 0) {
            peakIdx = chartItems.findIndex(i => i.value === maxVal)
        }

        // Nice ceiling above maxVal so the floating callout pill never clips
        const ceiling = maxVal > 0 ? maxVal * 1.22 : 100
        const avgPct = maxVal > 0 && avgVal > 0 ? Math.min(82, Math.max(12, (avgVal / ceiling) * 100)) : 0

        return {
            maxVal,
            avgVal,
            peakIdx,
            ceiling,
            avgPct
        }
    }, [chartItems])

    // Highlighted bar index: user-hovered/tapped bar, or the peak bar by default
    const highlightedIdx = focusedIndex !== null ? focusedIndex : chartStats.peakIdx

    // Format metric value for callout pill and axis labels
    const formatMetricValue = (val, compact = false) => {
        const n = Number(val || 0)
        if (activeMetric === 'revenue') {
            return compact ? formatCompactCurrency(n) : `฿${n.toLocaleString()}`
        }
        if (activeMetric === 'orders') {
            return `${n.toLocaleString()} บิล`
        }
        return `${n.toLocaleString()} ท่าน`
    }

    // Revenue delta vs yesterday
    const revenueDelta = useMemo(() => {
        if (yesterdayRevenue > 0) {
            const diff = revenueToday - yesterdayRevenue
            const pct = ((diff / yesterdayRevenue) * 100).toFixed(1).replace(/\.0$/, '')
            return {
                sign: diff > 0 ? '+' : '',
                text: `${diff > 0 ? '+' : ''}${pct}%`,
                sub: 'เทียบเมื่อวาน',
                tone: diff > 0 ? 'pos' : diff < 0 ? 'neg' : 'neutral'
            }
        }
        if (revenueToday > 0) {
            return {
                sign: '+',
                text: `+฿${revenueToday.toLocaleString()}`,
                sub: 'ยอดชำระแล้ววันนี้',
                tone: 'pos'
            }
        }
        return {
            sign: '',
            text: '฿0',
            sub: 'รอเปิดบิลแรก',
            tone: 'neutral'
        }
    }, [revenueToday, yesterdayRevenue])

    // Total orders & average check
    const totalActiveAndSettledOrders = completedOrdersCount + activeUnpaidCount
    const totalCombinedRevenue = revenueToday + activeUnpaidRevenue
    const avgCheck = totalActiveAndSettledOrders > 0
        ? Math.round(totalCombinedRevenue / totalActiveAndSettledOrders)
        : 0

    // Cash Drawer summary from shifts
    const cashSummary = useMemo(() => {
        const sorted = [...(shifts || [])].sort((a, b) => new Date(a.opened_at || 0) - new Date(b.opened_at || 0))
        if (sorted.length === 0) {
            return { hasShift: false, openingFloat: 0, cashSales: paymentBreakdown?.cash || 0, netAdj: 0, expectedCash: paymentBreakdown?.cash || 0, isOpen: false }
        }
        const openingFloat = Number(sorted[0]?.opening_float || 0)
        const cashSales = sorted.reduce((s, sh) => s + Number(sh.cash_sales || 0), 0) || (paymentBreakdown?.cash || 0)
        const totalIn = sorted.reduce((s, sh) => s + Number(sh.total_in || 0), 0)
        const totalOut = sorted.reduce((s, sh) => s + Number(sh.total_out || 0), 0)
        const netAdj = totalIn - totalOut
        const expectedCash = openingFloat + cashSales + netAdj
        const isOpen = sorted.some(sh => sh.status === 'open')
        return {
            hasShift: true,
            openingFloat,
            cashSales,
            totalIn,
            totalOut,
            netAdj,
            expectedCash,
            isOpen,
            shiftCount: sorted.length
        }
    }, [shifts, paymentBreakdown])

    // Payment mix percentages
    const paymentMix = useMemo(() => {
        const cash = Number(paymentBreakdown?.cash || 0)
        const qr = Number(paymentBreakdown?.qr || 0)
        const credit = Number(paymentBreakdown?.credit || 0)
        const sum = cash + qr + credit
        if (sum <= 0) {
            return { sum: 0, cash, qr, credit, cashPct: 0, qrPct: 0, creditPct: 0 }
        }
        return {
            sum,
            cash,
            qr,
            credit,
            cashPct: Math.round((cash / sum) * 100),
            qrPct: Math.round((qr / sum) * 100),
            creditPct: Math.max(0, 100 - Math.round((cash / sum) * 100) - Math.round((qr / sum) * 100))
        }
    }, [paymentBreakdown])

    // Service mix percentages
    const serviceMix = useMemo(() => {
        const total = dineInCount + pickupCount
        if (total <= 0) return { total: 0, dineInPct: 0, pickupPct: 0 }
        const dineInPct = Math.round((dineInCount / total) * 100)
        return {
            total,
            dineInPct,
            pickupPct: Math.max(0, 100 - dineInPct)
        }
    }, [dineInCount, pickupCount])

    // One-line executive finding (references/app-screens.md §2.2)
    const oneFindingText = useMemo(() => {
        const peakItem = chartStats.peakIdx >= 0 ? chartItems[chartStats.peakIdx] : null
        const parts = []
        if (peakItem && peakItem.value > 0) {
            parts.push(`พีคสุดช่วง ${peakItem.label} (${formatMetricValue(peakItem.value)})`)
        }
        if (activeUnpaidCount > 0) {
            parts.push(`กำลังทาน ${activeUnpaidCount} โต๊ะ (รอเช็คบิล ฿${activeUnpaidRevenue.toLocaleString()})`)
        }
        if (pendingInboxCount > 0) {
            parts.push(`รอตรวจสลิป ${pendingInboxCount} รายการ`)
        }
        if (parts.length === 0) {
            return isToday ? 'ยังไม่มีรายการเคลื่อนไหวในวันนี้ · พร้อมเปิดรับออเดอร์' : `สรุปข้อมูลย้อนหลังวันที่ ${formatThaiDateOnly(selectedDate)}`
        }
        return parts.join(' · ')
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chartStats.peakIdx, chartItems, activeUnpaidCount, activeUnpaidRevenue, pendingInboxCount, isToday, selectedDate])

    const occupancyPct = totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0
    const highIntentAds = (adTelemetry?.maps || 0) + (adTelemetry?.contacts || 0) + (adTelemetry?.orders || 0)

    return (
        <section
            aria-label="Executive Overview and Intraday Visualization"
            className="bg-[oklch(98.5%_0.004_28)] border border-[oklch(85%_0.012_28)] rounded-lg overflow-hidden font-sans text-[oklch(18%_0.012_28)]"
        >
            {/* 1. Card Header: Overview Title + One Finding + Scope Switcher */}
            <header className="px-4 sm:px-6 py-3.5 border-b border-[oklch(88%_0.010_28)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[oklch(97.5%_0.006_28)]">
                <div className="flex items-baseline gap-3 flex-wrap min-w-0">
                    <h2 className="text-[15px] font-semibold tracking-tight text-[oklch(18%_0.012_28)]">
                        Overview
                    </h2>
                    <span className="text-xs text-[oklch(48%_0.010_28)] truncate">
                        {oneFindingText}
                    </span>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    {/* Granularity Segmented Control: รายชั่วโมง vs 4 ช่วงเวลา */}
                    <div
                        role="group"
                        aria-label="มุมมองเวลาของกราฟ"
                        className="inline-flex p-0.5 rounded-md bg-[oklch(93%_0.010_28)] border border-[oklch(86%_0.012_28)] text-xs"
                    >
                        <button
                            type="button"
                            onClick={() => {
                                setGranularity('hour')
                                setFocusedIndex(null)
                            }}
                            className={`px-2.5 py-1 rounded-[5px] font-medium transition-colors duration-150 cursor-pointer ${
                                granularity === 'hour'
                                    ? 'bg-[oklch(98.5%_0.004_28)] text-[oklch(18%_0.012_28)] font-semibold'
                                    : 'text-[oklch(48%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                            }`}
                        >
                            รายชั่วโมง
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setGranularity('daypart')
                                setFocusedIndex(null)
                            }}
                            className={`px-2.5 py-1 rounded-[5px] font-medium transition-colors duration-150 cursor-pointer ${
                                granularity === 'daypart'
                                    ? 'bg-[oklch(98.5%_0.004_28)] text-[oklch(18%_0.012_28)] font-semibold'
                                    : 'text-[oklch(48%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                            }`}
                        >
                            4 ช่วงเวลา
                        </button>
                    </div>

                    <span className="text-xs font-mono text-[oklch(48%_0.010_28)] hidden md:inline">
                        {isToday ? 'วันนี้ (11:00–23:00)' : formatThaiDateOnly(selectedDate)}
                    </span>
                </div>
            </header>

            {/* 2. Divided KPI Strip (KPIs are Type & Series Tabs — Zero Icons, Zero Sparklines) */}
            <div
                role="tablist"
                aria-label="ตัวชี้วัดหลัก (คลิกเพื่อสลับข้อมูลกราฟ)"
                className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-[oklch(88%_0.010_28)] border-b border-[oklch(88%_0.010_28)] bg-[oklch(98.5%_0.004_28)]"
            >
                {/* KPI 1: Revenue */}
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeMetric === 'revenue'}
                    onClick={() => {
                        setActiveMetric('revenue')
                        setFocusedIndex(null)
                    }}
                    className={`p-4 sm:px-6 sm:py-4 text-left relative transition-colors duration-150 cursor-pointer focus-visible:outline-none ${
                        activeMetric === 'revenue' ? 'bg-[oklch(98.5%_0.004_28)]' : 'hover:bg-[oklch(96.5%_0.006_28)]'
                    }`}
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs sm:text-[13px] ${activeMetric === 'revenue' ? 'text-[oklch(18%_0.012_28)] font-semibold' : 'text-[oklch(48%_0.010_28)] font-medium'}`}>
                            ยอดขายชำระแล้ว
                        </span>
                        <span className="font-mono text-[11px] text-[oklch(55%_0.010_28)]">Revenue</span>
                    </div>

                    <div className={`mt-1.5 font-mono text-2xl sm:text-[28px] leading-tight tracking-tight tabular-nums ${
                        activeMetric === 'revenue' ? 'font-bold text-[oklch(18%_0.012_28)]' : 'font-semibold text-[oklch(18%_0.012_28)]'
                    }`}>
                        {loading ? '...' : `฿${Number(revenueToday || 0).toLocaleString()}`}
                    </div>

                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-xs font-mono tabular-nums">
                        <span className={`font-semibold ${
                            revenueDelta.tone === 'pos'
                                ? 'text-[oklch(38%_0.10_140)]'
                                : revenueDelta.tone === 'neg'
                                    ? 'text-[oklch(52%_0.16_28)]'
                                    : 'text-[oklch(48%_0.010_28)]'
                        }`}>
                            {revenueDelta.text}
                        </span>
                        <span className="text-[oklch(55%_0.010_28)] font-sans text-[11px]">
                            {activeUnpaidCount > 0
                                ? `· รอเช็คบิล +฿${activeUnpaidRevenue.toLocaleString()}`
                                : revenueDelta.sub}
                        </span>
                    </div>

                    {activeMetric === 'revenue' && (
                        <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[oklch(18%_0.012_28)]" />
                    )}
                </button>

                {/* KPI 2: Orders */}
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeMetric === 'orders'}
                    onClick={() => {
                        setActiveMetric('orders')
                        setFocusedIndex(null)
                    }}
                    className={`p-4 sm:px-6 sm:py-4 text-left relative transition-colors duration-150 cursor-pointer focus-visible:outline-none ${
                        activeMetric === 'orders' ? 'bg-[oklch(98.5%_0.004_28)]' : 'hover:bg-[oklch(96.5%_0.006_28)]'
                    }`}
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs sm:text-[13px] ${activeMetric === 'orders' ? 'text-[oklch(18%_0.012_28)] font-semibold' : 'text-[oklch(48%_0.010_28)] font-medium'}`}>
                            จำนวนบิลทั้งหมด
                        </span>
                        <span className="font-mono text-[11px] text-[oklch(55%_0.010_28)]">Orders</span>
                    </div>

                    <div className={`mt-1.5 font-mono text-2xl sm:text-[28px] leading-tight tracking-tight tabular-nums ${
                        activeMetric === 'orders' ? 'font-bold text-[oklch(18%_0.012_28)]' : 'font-semibold text-[oklch(18%_0.012_28)]'
                    }`}>
                        {loading ? '...' : totalActiveAndSettledOrders.toLocaleString()}
                        <small className="text-xs font-sans font-normal text-[oklch(48%_0.010_28)] ml-1.5">บิล</small>
                    </div>

                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-xs font-mono tabular-nums">
                        <span className="text-[oklch(38%_0.10_140)] font-semibold">
                            ชำระแล้ว {completedOrdersCount}
                        </span>
                        <span className="text-[oklch(55%_0.010_28)] font-sans text-[11px]">
                            {avgCheck > 0 ? `· เฉลี่ย ฿${avgCheck.toLocaleString()}/บิล` : `· กำลังทาน ${activeUnpaidCount}`}
                        </span>
                    </div>

                    {activeMetric === 'orders' && (
                        <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[oklch(18%_0.012_28)]" />
                    )}
                </button>

                {/* KPI 3: Guests & Floor Occupancy */}
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeMetric === 'guests'}
                    onClick={() => {
                        setActiveMetric('guests')
                        setFocusedIndex(null)
                    }}
                    className={`p-4 sm:px-6 sm:py-4 text-left relative transition-colors duration-150 cursor-pointer focus-visible:outline-none ${
                        activeMetric === 'guests' ? 'bg-[oklch(98.5%_0.004_28)]' : 'hover:bg-[oklch(96.5%_0.006_28)]'
                    }`}
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs sm:text-[13px] ${activeMetric === 'guests' ? 'text-[oklch(18%_0.012_28)] font-semibold' : 'text-[oklch(48%_0.010_28)] font-medium'}`}>
                            ลูกค้า & การครองโต๊ะ
                        </span>
                        <span className="font-mono text-[11px] text-[oklch(55%_0.010_28)]">Guests</span>
                    </div>

                    <div className={`mt-1.5 font-mono text-2xl sm:text-[28px] leading-tight tracking-tight tabular-nums ${
                        activeMetric === 'guests' ? 'font-bold text-[oklch(18%_0.012_28)]' : 'font-semibold text-[oklch(18%_0.012_28)]'
                    }`}>
                        {loading ? '...' : digest.totalGuestsAllDay.toLocaleString()}
                        <small className="text-xs font-sans font-normal text-[oklch(48%_0.010_28)] ml-1.5">ท่าน</small>
                    </div>

                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-xs font-mono tabular-nums">
                        <span className={occupiedTables > 0 ? 'text-[oklch(38%_0.10_140)] font-semibold' : 'text-[oklch(48%_0.010_28)]'}>
                            เปิดโต๊ะ {occupiedTables}/{totalTables} ({occupancyPct}%)
                        </span>
                        {digest.avgDwell > 0 && (
                            <span className="text-[oklch(55%_0.010_28)] font-sans text-[11px]">
                                · นั่งเฉลี่ย {digest.avgDwell} น.
                            </span>
                        )}
                    </div>

                    {activeMetric === 'guests' && (
                        <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[oklch(18%_0.012_28)]" />
                    )}
                </button>

                {/* KPI 4: Online & Ad Signals (Non-tab summary / quick link to marketing or inbox) */}
                <div className="p-4 sm:px-6 sm:py-4 text-left flex flex-col justify-between bg-[oklch(98.5%_0.004_28)]">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs sm:text-[13px] text-[oklch(48%_0.010_28)] font-medium">
                            {pendingInboxCount > 0 ? 'สลิปรอตรวจสอบ' : 'ทราฟฟิกแอด & ค้นหา'}
                        </span>
                        <a
                            href="/admin/marketing?tab=ads_landing"
                            className="font-mono text-[11px] text-[oklch(52%_0.16_28)] hover:underline"
                        >
                            Ads &rarr;
                        </a>
                    </div>

                    <div className="mt-1.5 font-mono text-2xl sm:text-[28px] leading-tight tracking-tight font-semibold tabular-nums text-[oklch(18%_0.012_28)]">
                        {loading ? '...' : (pendingInboxCount > 0 ? pendingInboxCount : (adTelemetry?.visits || 0).toLocaleString())}
                        <small className="text-xs font-sans font-normal text-[oklch(48%_0.010_28)] ml-1.5">
                            {pendingInboxCount > 0 ? 'สลิป' : 'เข้าชม'}
                        </small>
                    </div>

                    <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[11px] font-mono text-[oklch(48%_0.010_28)] tabular-nums">
                        {pendingInboxCount > 0 ? (
                            <span className="text-[oklch(52%_0.16_28)] font-bold">
                                ต้องยืนยันสลิป {pendingInboxCount} รายการ
                            </span>
                        ) : (
                            <>
                                <span>Maps <strong className="text-[oklch(18%_0.012_28)]">{adTelemetry?.maps || 0}</strong></span>
                                <span>·</span>
                                <span>ทัก/โทร <strong className="text-[oklch(18%_0.012_28)]">{adTelemetry?.contacts || 0}</strong></span>
                                <span>·</span>
                                <span>สั่ง/จอง <strong className="text-[oklch(38%_0.10_140)]">{adTelemetry?.orders || 0}</strong></span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* 3. Main Bar Chart with Simple Motion (Modeled after tasteskill reference card) */}
            <div
                className="px-4 sm:px-6 pt-4 pb-5 bg-[oklch(98.5%_0.004_28)]"
                onMouseLeave={() => setFocusedIndex(null)}
            >
                {/* Chart Header */}
                <div className="flex items-baseline justify-between gap-2 flex-wrap mb-3">
                    <div className="flex items-baseline gap-2.5">
                        <h3 className="text-xs sm:text-[13px] font-medium text-[oklch(42%_0.010_28)]">
                            {activeMetric === 'revenue'
                                ? (granularity === 'daypart' ? 'ยอดขายแยกตามช่วงเวลา (Revenue by daypart)' : 'ยอดขายรายชั่วโมง (Revenue by hour)')
                                : activeMetric === 'orders'
                                    ? (granularity === 'daypart' ? 'จำนวนบิลแยกตามช่วงเวลา (Orders by daypart)' : 'จำนวนบิลรายชั่วโมง (Orders by hour)')
                                    : (granularity === 'daypart' ? 'จำนวนลูกค้าแยกตามช่วงเวลา (Guests by daypart)' : 'จำนวนลูกค้ารายชั่วโมง (Guests by hour)')}
                        </h3>
                    </div>

                    {/* Active/Hovered Bar Summary on Mobile & Desktop */}
                    <div className="text-xs font-mono text-[oklch(48%_0.010_28)] tabular-nums flex items-center gap-3">
                        {highlightedIdx >= 0 && chartItems[highlightedIdx] && chartItems[highlightedIdx].value > 0 && (
                            <span className="inline-flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-[2px] bg-[oklch(52%_0.16_28)] inline-block" />
                                <span className="text-[oklch(18%_0.012_28)] font-semibold">
                                    {chartItems[highlightedIdx].label}: {formatMetricValue(chartItems[highlightedIdx].value)}
                                </span>
                                <span className="text-[oklch(55%_0.010_28)] hidden sm:inline">
                                    ({chartItems[highlightedIdx].orders} บิล · {chartItems[highlightedIdx].guests} ท่าน)
                                </span>
                            </span>
                        )}
                    </div>
                </div>

                {/* Plot Canvas */}
                <div className="relative h-[168px] sm:h-[188px] pt-9 pb-6 select-none">
                    {/* Subtle Horizontal Baseline */}
                    <div className="absolute inset-x-0 bottom-6 h-[1px] bg-[oklch(86%_0.012_28)] pointer-events-none" />

                    {/* Dashed Average Reference Line (avg ฿...) */}
                    {chartStats.avgVal > 0 && (
                        <div
                            className="absolute inset-x-0 pointer-events-none z-10 transition-[bottom] duration-300"
                            style={{ bottom: `calc(24px + ${chartStats.avgPct}% * 0.72)` }}
                        >
                            <div className="border-t border-dashed border-[oklch(58%_0.012_28)] w-full" />
                            <span className="absolute -top-4 left-0 font-mono text-[11px] text-[oklch(46%_0.010_28)] bg-[oklch(98.5%_0.004_28)]/90 pr-1.5 tabular-nums">
                                avg {formatMetricValue(chartStats.avgVal, true)}
                            </span>
                        </div>
                    )}

                    {/* Columns Flex/Grid Container */}
                    <div className={`relative h-full flex items-end ${granularity === 'daypart' ? 'gap-3 sm:gap-6' : 'gap-1.5 sm:gap-2.5'}`}>
                        {chartItems.map((item, idx) => {
                            const isHighlighted = idx === highlightedIdx && item.value > 0
                            const heightRatio = chartStats.ceiling > 0 ? Math.min(1, item.value / chartStats.ceiling) : 0
                            // Minimum visible 8% height for zero bars (quiet warm-stone stub like in the reference card) or 4px stub
                            const barHeightPct = item.value > 0
                                ? Math.max(10, Math.round(heightRatio * 100))
                                : 5

                            return (
                                <div
                                    key={item.id || item.hour}
                                    onMouseEnter={() => setFocusedIndex(idx)}
                                    onClick={() => setFocusedIndex(prev => prev === idx ? null : idx)}
                                    className="relative flex-1 h-full flex flex-col justify-end items-center group cursor-pointer"
                                >
                                    {/* Floating Dark Callout Pill above Highlighted Bar (Sat €8.1k style) */}
                                    {isHighlighted && (
                                        <div
                                            className="absolute z-20 pointer-events-none flex flex-col items-center transition-opacity duration-200"
                                            style={{
                                                bottom: `calc(${barHeightPct}% + 8px)`
                                            }}
                                        >
                                            <div className="bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-mono font-bold whitespace-nowrap tabular-nums">
                                                {item.shortLabel}{granularity === 'hour' ? ':00' : ''} · {formatMetricValue(item.value, true)}
                                            </div>
                                            <div className="w-2 h-2 bg-[oklch(18%_0.012_28)] rotate-45 -mt-1" />
                                        </div>
                                    )}

                                    {/* Bar Column with Simple, Restrained ScaleY Motion */}
                                    <div
                                        style={{
                                            height: `${barHeightPct}%`,
                                            transform: barsReady ? 'scaleY(1)' : 'scaleY(0)',
                                            transformOrigin: 'bottom',
                                            transition: `transform 460ms cubic-bezier(0.22, 1, 0.36, 1) ${idx * 22}ms, background-color 160ms ease`
                                        }}
                                        className={`w-full rounded-t-[6px] rounded-b-[2px] ${
                                            isHighlighted
                                                ? 'bg-[oklch(55%_0.17_28)]'
                                                : item.value > 0
                                                    ? 'bg-[oklch(88%_0.014_28)] group-hover:bg-[oklch(80%_0.025_28)]'
                                                    : 'bg-[oklch(94%_0.008_28)]'
                                        }`}
                                    />

                                    {/* X-Axis Label Below Baseline */}
                                    <div className={`absolute -bottom-6 inset-x-0 text-center font-mono text-[10px] sm:text-[11px] tabular-nums truncate ${
                                        isHighlighted
                                            ? 'font-bold text-[oklch(18%_0.012_28)]'
                                            : 'text-[oklch(48%_0.010_28)]'
                                    }`}>
                                        {granularity === 'daypart' ? item.shortLabel : item.shortLabel}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* 4. 3-Cell Visual Digest Strip (Consolidates Payment Mix, Service/Dwell Velocity & Cash Drawer) */}
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[oklch(88%_0.010_28)] border-t border-[oklch(88%_0.010_28)] bg-[oklch(97.5%_0.006_28)] text-xs">
                {/* Digest 1: Payment Breakdown Bar */}
                <div className="p-4 sm:px-6 space-y-2.5">
                    <div className="flex items-center justify-between">
                        <span className="font-medium text-[oklch(42%_0.010_28)]">สัดส่วนการรับชำระเงิน</span>
                        <span className="font-mono text-[11px] font-semibold text-[oklch(18%_0.012_28)] tabular-nums">
                            ฿{paymentMix.sum.toLocaleString()}
                        </span>
                    </div>

                    {/* 100% Stacked Bar */}
                    <div className="w-full h-2 rounded-full bg-[oklch(91%_0.010_28)] overflow-hidden flex gap-0.5">
                        {paymentMix.sum > 0 ? (
                            <>
                                {paymentMix.qr > 0 && (
                                    <div
                                        className="h-full bg-[oklch(45%_0.08_140)] transition-[width] duration-500"
                                        style={{ width: `${paymentMix.qrPct}%` }}
                                        title={`PromptPay QR: ฿${paymentMix.qr.toLocaleString()} (${paymentMix.qrPct}%)`}
                                    />
                                )}
                                {paymentMix.cash > 0 && (
                                    <div
                                        className="h-full bg-[oklch(18%_0.012_28)] transition-[width] duration-500"
                                        style={{ width: `${paymentMix.cashPct}%` }}
                                        title={`เงินสด: ฿${paymentMix.cash.toLocaleString()} (${paymentMix.cashPct}%)`}
                                    />
                                )}
                                {paymentMix.credit > 0 && (
                                    <div
                                        className="h-full bg-[oklch(52%_0.16_28)] transition-[width] duration-500"
                                        style={{ width: `${paymentMix.creditPct}%` }}
                                        title={`บัตรเครดิต: ฿${paymentMix.credit.toLocaleString()} (${paymentMix.creditPct}%)`}
                                    />
                                )}
                            </>
                        ) : (
                            <div className="h-full w-0" />
                        )}
                    </div>

                    {/* Tabular Legend */}
                    <div className="grid grid-cols-3 gap-2 pt-0.5 font-mono text-[11px] tabular-nums">
                        <div>
                            <div className="flex items-center gap-1 text-[oklch(48%_0.010_28)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[oklch(45%_0.08_140)] shrink-0" />
                                <span>QR โอน</span>
                            </div>
                            <div className="font-semibold text-[oklch(18%_0.012_28)] mt-0.5">
                                ฿{paymentMix.qr.toLocaleString()}
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-1 text-[oklch(48%_0.010_28)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[oklch(18%_0.012_28)] shrink-0" />
                                <span>เงินสด</span>
                            </div>
                            <div className="font-semibold text-[oklch(18%_0.012_28)] mt-0.5">
                                ฿{paymentMix.cash.toLocaleString()}
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-1 text-[oklch(48%_0.010_28)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[oklch(52%_0.16_28)] shrink-0" />
                                <span>บัตร</span>
                            </div>
                            <div className="font-semibold text-[oklch(18%_0.012_28)] mt-0.5">
                                ฿{paymentMix.credit.toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Digest 2: Service Channel Mix & Table Dwell Velocity */}
                <div className="p-4 sm:px-6 space-y-2.5">
                    <div className="flex items-center justify-between">
                        <span className="font-medium text-[oklch(42%_0.010_28)]">ช่องทางบริการ & หมุนเวียนโต๊ะ</span>
                        <span className="font-mono text-[11px] font-semibold text-[oklch(18%_0.012_28)] tabular-nums">
                            {digest.turnsPerTable} รอบ/โต๊ะ
                        </span>
                    </div>

                    {/* 100% Stacked Channel Bar */}
                    <div className="w-full h-2 rounded-full bg-[oklch(91%_0.010_28)] overflow-hidden flex gap-0.5">
                        {serviceMix.total > 0 && (
                            <>
                                {dineInCount > 0 && (
                                    <div
                                        className="h-full bg-[oklch(52%_0.16_28)] transition-[width] duration-500"
                                        style={{ width: `${serviceMix.dineInPct}%` }}
                                    />
                                )}
                                {pickupCount > 0 && (
                                    <div
                                        className="h-full bg-[oklch(45%_0.08_140)] transition-[width] duration-500"
                                        style={{ width: `${serviceMix.pickupPct}%` }}
                                    />
                                )}
                            </>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-0.5 font-mono text-[11px] tabular-nums">
                        <div>
                            <div className="flex items-center gap-1 text-[oklch(48%_0.010_28)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[oklch(52%_0.16_28)] shrink-0" />
                                <span>ทานที่ร้าน</span>
                            </div>
                            <div className="font-semibold text-[oklch(18%_0.012_28)] mt-0.5">
                                {dineInCount} บิล ({serviceMix.dineInPct}%)
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-1 text-[oklch(48%_0.010_28)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[oklch(45%_0.08_140)] shrink-0" />
                                <span>สั่งกลับ</span>
                            </div>
                            <div className="font-semibold text-[oklch(18%_0.012_28)] mt-0.5">
                                {pickupCount} บิล ({serviceMix.pickupPct}%)
                            </div>
                        </div>
                        <div>
                            <div className="text-[oklch(48%_0.010_28)]">เวลาครองโต๊ะ</div>
                            <div className="font-semibold text-[oklch(18%_0.012_28)] mt-0.5">
                                {digest.avgDwell > 0 ? `~${digest.avgDwell} นาที` : '-'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Digest 3: Cash Drawer & Shift Balance */}
                <div className="p-4 sm:px-6 space-y-2.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="font-medium text-[oklch(42%_0.010_28)]">เงินสดคาดการณ์ในลิ้นชัก</span>
                        {handleOpenShift ? (
                            <button
                                type="button"
                                onClick={handleOpenShift}
                                className="font-mono text-[11px] font-semibold text-[oklch(52%_0.16_28)] hover:underline cursor-pointer"
                            >
                                สมุดกะ &rarr;
                            </button>
                        ) : (
                            <span className="font-mono text-[11px] text-[oklch(48%_0.010_28)]">
                                {cashSummary.isOpen ? 'กะเปิดอยู่' : 'ปิดกะ'}
                            </span>
                        )}
                    </div>

                    <div className="flex items-baseline justify-between font-mono tabular-nums">
                        <span className="text-lg font-bold text-[oklch(18%_0.012_28)]">
                            ฿{cashSummary.expectedCash.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-[oklch(48%_0.010_28)]">
                            {cashSummary.hasShift ? `${cashSummary.shiftCount} กะวันนี้` : 'ยังไม่มีกะเปิด'}
                        </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-0.5 font-mono text-[11px] tabular-nums border-t border-[oklch(90%_0.010_28)]">
                        <div>
                            <span className="text-[oklch(48%_0.010_28)] block">ตั้งต้น</span>
                            <span className="font-semibold text-[oklch(18%_0.012_28)]">฿{cashSummary.openingFloat.toLocaleString()}</span>
                        </div>
                        <div>
                            <span className="text-[oklch(48%_0.010_28)] block">+ขายสด</span>
                            <span className="font-semibold text-[oklch(38%_0.10_140)]">+฿{cashSummary.cashSales.toLocaleString()}</span>
                        </div>
                        <div>
                            <span className="text-[oklch(48%_0.010_28)] block">เข้า/ออกสุทธิ</span>
                            <span className={`font-semibold ${cashSummary.netAdj < 0 ? 'text-[oklch(52%_0.16_28)]' : 'text-[oklch(18%_0.012_28)]'}`}>
                                {cashSummary.netAdj >= 0 ? `+฿${cashSummary.netAdj.toLocaleString()}` : `-฿${Math.abs(cashSummary.netAdj).toLocaleString()}`}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
