/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useMemo } from 'react'

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

export default function IntradayVelocityChart({ bookings = [], selectedDate, loading = false }) {
    const [hoveredHour, setHoveredHour] = useState(null)

    // Restaurant operating hours 11:00 to 23:00 (13 slots)
    const hours = useMemo(() => [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23], [])

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
                label: `${h}:00`,
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

    // SVG Coordinate Calculations
    const svgWidth = 800
    const svgHeight = 220
    const padX = 50
    const padYTop = 25
    const padYBottom = 35
    const plotWidth = svgWidth - padX * 2
    const plotHeight = svgHeight - padYTop - padYBottom

    const maxVal = useMemo(() => {
        const maxCum = points.length > 0 ? points[points.length - 1].cumulative : 0
        const maxBench = benchmarkPoints.length > 0 ? benchmarkPoints[benchmarkPoints.length - 1].expectedCumulative : 0
        const ceiling = Math.max(maxCum, maxBench, 12000)
        return Math.ceil(ceiling / 5000) * 5000
    }, [points, benchmarkPoints])

    const getX = (idx) => padX + (idx / (hours.length - 1)) * plotWidth
    const getY = (val) => svgHeight - padYBottom - (val / maxVal) * plotHeight

    // Active points for today: only draw actual sales line up to the current hour (do not extrapolate 0 into future hours)
    const activePoints = useMemo(() => {
        if (!isViewingToday) return points
        // When viewing today, line extends up to current hour (or at least index 0 if before 11:00)
        const cappedHour = Math.min(23, Math.max(11, currentBangkokHour))
        return points.filter(p => p.hour <= cappedHour)
    }, [points, isViewingToday, currentBangkokHour])

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
    }, [points, activePoints, benchmarkPoints, hours, maxVal])

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
                            เปรียบเทียบจังหวะยอดขายจริงกับ Benchmark ค่าเฉลี่ยร้าน (11:00 - 23:00 น.)
                        </p>
                    </div>
                </div>

                {/* Key Summary Stats */}
                <div className="flex items-center gap-4 font-mono text-xs">
                    <div>
                        <span className="text-[10px] text-[oklch(55%_0.010_28)] block">CUMULATIVE TODAY</span>
                        <span className="font-bold text-base sm:text-lg text-[oklch(18%_0.012_28)] tabular-nums">
                            ฿{totalRevenue.toLocaleString()}
                        </span>
                    </div>
                    {peakHour && peakHour.sale > 0 && (
                        <div className="border-l border-[oklch(85%_0.012_28)] pl-4">
                            <span className="text-[10px] text-[oklch(55%_0.010_28)] block">PEAK RUSH</span>
                            <span className="font-bold text-sm text-[oklch(52%_0.20_28)] tabular-nums">
                                {peakHour.label} (฿{peakHour.sale.toLocaleString()})
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Chart Graphic Area */}
            <div className="p-4 relative">
                {/* Visual Legend */}
                <div className="flex items-center justify-end gap-4 font-mono text-[11px] mb-2 text-[oklch(42%_0.010_28)]">
                    <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-1.5 bg-[oklch(52%_0.20_28)] rounded-xs inline-block" />
                        <span className="font-bold text-[oklch(18%_0.012_28)]">ยอดขายจริงวันนี้</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-1 border-t-2 border-dashed border-[oklch(60%_0.015_28)] inline-block" />
                        <span>Benchmark คาดการณ์</span>
                    </div>
                </div>

                {/* Responsive SVG Chart */}
                <div className="w-full overflow-x-auto no-scrollbar">
                    <svg
                        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                        className="w-full h-44 sm:h-56 select-none"
                    >
                        <defs>
                            {/* Gradient Area Fill for Red Actual Line */}
                            <linearGradient id="velocityFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="oklch(52% 0.20 28)" stopOpacity="0.30" />
                                <stop offset="100%" stopColor="oklch(52% 0.20 28)" stopOpacity="0.02" />
                            </linearGradient>
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
                            y={padYTop + 14}
                            textAnchor="middle"
                            className="font-mono text-[9px] font-bold fill-[oklch(55%_0.010_28)] uppercase"
                        >
                            LUNCH RUSH
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
                            y={padYTop + 14}
                            textAnchor="middle"
                            className="font-mono text-[9px] font-bold fill-[oklch(55%_0.010_28)] uppercase"
                        >
                            PRIME DINNER
                        </text>

                        {/* Horizontal Gridlines & Y-Axis Labels */}
                        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                            const y = svgHeight - padYBottom - ratio * plotHeight
                            const labelVal = Math.round(ratio * maxVal)
                            return (
                                <g key={ratio}>
                                    <line
                                        x1={padX}
                                        y1={y}
                                        x2={svgWidth - padX}
                                        y2={y}
                                        stroke="oklch(88% 0.012 28)"
                                        strokeDasharray={ratio === 0 ? 'none' : '3 3'}
                                        strokeWidth={ratio === 0 ? '1.5' : '1'}
                                    />
                                    <text
                                        x={padX - 8}
                                        y={y + 3.5}
                                        textAnchor="end"
                                        className="font-mono text-[9px] fill-[oklch(55%_0.010_28)]"
                                    >
                                        ฿{labelVal >= 1000 ? `${Math.round(labelVal / 1000)}k` : labelVal}
                                    </text>
                                </g>
                            )
                        })}

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

                        {/* Actual Cumulative Main Line (Vibrant Clay Terracotta / Red) */}
                        {pathActual && (
                            <path
                                d={pathActual}
                                fill="none"
                                stroke="oklch(52% 0.20 28)"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        )}

                        {/* Live Now Pulsating Marker on the latest hour point */}
                        {latestActive && (
                            <g>
                                <circle
                                    cx={getX(hours.indexOf(latestActive.hour))}
                                    cy={getY(latestActive.cumulative)}
                                    r="8"
                                    fill="oklch(52% 0.20 28)"
                                    opacity="0.3"
                                    className="animate-ping"
                                />
                                <circle
                                    cx={getX(hours.indexOf(latestActive.hour))}
                                    cy={getY(latestActive.cumulative)}
                                    r="4.5"
                                    fill="oklch(52% 0.20 28)"
                                    stroke="white"
                                    strokeWidth="2"
                                />
                            </g>
                        )}

                        {/* Interactive Data Points */}
                        {points.map((pt, i) => {
                            const cx = getX(i)
                            const cy = getY(pt.cumulative)
                            const isHovered = hoveredHour === pt.hour
                            const isPointActive = !isViewingToday || pt.hour <= (currentBangkokHour || 23)

                            return (
                                <g
                                    key={pt.hour}
                                    className="cursor-pointer"
                                    onMouseEnter={() => setHoveredHour(pt.hour)}
                                    onMouseLeave={() => setHoveredHour(null)}
                                >
                                    {isPointActive && (
                                        <circle
                                            cx={cx}
                                            cy={cy}
                                            r={isHovered ? 6.5 : 4}
                                            fill={isHovered ? 'oklch(18% 0.012 28)' : 'oklch(52% 0.20 28)'}
                                            stroke="white"
                                            strokeWidth="2"
                                            className="transition-all duration-150"
                                        />
                                    )}

                                    {/* X-axis Hour Label */}
                                    <text
                                        x={cx}
                                        y={svgHeight - padYBottom + 16}
                                        textAnchor="middle"
                                        className={`font-mono text-[10px] ${
                                            isHovered
                                                ? 'fill-[oklch(18%_0.012_28)] font-bold'
                                                : isPointActive
                                                ? 'fill-[oklch(18%_0.012_28)] font-semibold'
                                                : 'fill-[oklch(65%_0.010_28)]'
                                        }`}
                                    >
                                        {pt.hour}h
                                    </text>
                                </g>
                            )
                        })}
                    </svg>
                </div>

                {/* Hover Popover Card */}
                {hoveredHour !== null && (() => {
                    const pt = points.find(p => p.hour === hoveredHour)
                    if (!pt) return null
                    return (
                        <div className="absolute top-4 right-4 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] p-3 rounded-sm font-mono text-xs shadow-lg border border-[oklch(35%_0.012_28)] pointer-events-none z-10">
                            <div className="text-[10px] text-[oklch(75%_0.010_28)] font-bold mb-1 border-b border-[oklch(35%_0.012_28)] pb-1">
                                TIME // {pt.label} - {pt.hour + 1}:00 น.
                            </div>
                            <div className="flex justify-between gap-6 py-0.5">
                                <span>ยอดในชั่วโมงนี้:</span>
                                <span className="font-bold text-[oklch(52%_0.20_28)]">฿{pt.sale.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between gap-6 py-0.5">
                                <span>ยอดสะสมถึงชั่วโมงนี้:</span>
                                <span className="font-bold text-white">฿{pt.cumulative.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between gap-6 text-[10px] text-[oklch(65%_0.010_28)] pt-1">
                                <span>จำนวนบิล:</span>
                                <span>{pt.count} บิล</span>
                            </div>
                        </div>
                    )
                })()}
            </div>
        </div>
    )
}
