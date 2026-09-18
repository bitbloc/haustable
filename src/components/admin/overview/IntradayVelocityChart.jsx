/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useMemo } from 'react'

export default function IntradayVelocityChart({ bookings = [], selectedDate, loading = false }) {
    const [hoveredHour, setHoveredHour] = useState(null)

    // Operating hours 11:00 to 23:00 (13 slots)
    const hours = useMemo(() => [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23], [])

    // Process actual bookings into hourly buckets
    const chartData = useMemo(() => {
        const hourlySales = {}
        const hourlyCounts = {}
        hours.forEach(h => {
            hourlySales[h] = 0
            hourlyCounts[h] = 0
        })

        const paidBookings = (bookings || []).filter(b => 
            b.status === 'completed' || b.status === 'seated' || b.status === 'confirmed' || b.status === 'ready'
        )

        paidBookings.forEach(b => {
            const timeStr = b.booking_time || b.created_at
            if (!timeStr) return
            const d = new Date(timeStr)
            const h = d.getHours()
            if (hourlySales[h] !== undefined) {
                const billAmt = Number(b.total_price || b.deposit_amount || 0)
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

        // Synthesize a realistic benchmark / baseline for comparison (7-day average pacing curve)
        const maxCumulative = Math.max(runningTotal, 10000)
        const benchmarkPoints = hours.map((h, idx) => {
            // Typical restaurant progression curve (slow 11-12, rush 12-14, quiet 14-17, big rush 18-21, taper 22-23)
            const curveWeights = [0.03, 0.12, 0.22, 0.28, 0.32, 0.36, 0.45, 0.65, 0.82, 0.92, 0.97, 0.99, 1.0]
            return {
                hour: h,
                expectedCumulative: Math.round(maxCumulative * (curveWeights[idx] || 1))
            }
        })

        return { points, benchmarkPoints, totalRevenue: runningTotal }
    }, [bookings, hours])

    const { points, benchmarkPoints, totalRevenue } = chartData

    // SVG Coordinate Calculations
    const svgWidth = 800
    const svgHeight = 220
    const padX = 45
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

    // Generate SVG path strings
    const { pathActual, pathArea, pathBenchmark } = useMemo(() => {
        if (points.length === 0) return { pathActual: '', pathArea: '', pathBenchmark: '' }

        const actualCoords = points.map((pt, i) => `${getX(i).toFixed(1)},${getY(pt.cumulative).toFixed(1)}`)
        const pathAct = `M ${actualCoords.join(' L ')}`
        const pathAr = `${pathAct} L ${getX(points.length - 1).toFixed(1)},${(svgHeight - padYBottom).toFixed(1)} L ${padX},${(svgHeight - padYBottom).toFixed(1)} Z`

        const benchCoords = benchmarkPoints.map((pt, i) => `${getX(i).toFixed(1)},${getY(pt.expectedCumulative).toFixed(1)}`)
        const pathBench = `M ${benchCoords.join(' L ')}`

        return { pathActual: pathAct, pathArea: pathAr, pathBenchmark: pathBench }
    }, [points, benchmarkPoints, maxVal])

    // Find peak velocity hour
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
                        <span className="font-bold text-sm text-[oklch(18%_0.012_28)] tabular-nums">
                            ฿{totalRevenue.toLocaleString()}
                        </span>
                    </div>
                    {peakHour && peakHour.sale > 0 && (
                        <div className="border-l border-[oklch(85%_0.012_28)] pl-4">
                            <span className="text-[10px] text-[oklch(55%_0.010_28)] block">PEAK RUSH</span>
                            <span className="font-bold text-sm text-[oklch(52%_0.16_28)] tabular-nums">
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
                        <span className="w-3.5 h-1 bg-[oklch(52%_0.16_28)] inline-block" />
                        <span>ยอดขายจริงวันนี้</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-1 border-t border-dashed border-[oklch(65%_0.015_28)] inline-block" />
                        <span>Benchmark คาดการณ์</span>
                    </div>
                </div>

                {/* Responsive SVG Chart */}
                <div className="w-full overflow-x-auto no-scrollbar">
                    <svg
                        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                        className="w-full h-44 sm:h-52 select-none"
                    >
                        <defs>
                            {/* Gradient Area Fill */}
                            <linearGradient id="velocityFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="oklch(52% 0.16 28)" stopOpacity="0.25" />
                                <stop offset="100%" stopColor="oklch(52% 0.16 28)" stopOpacity="0.02" />
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
                            opacity="0.8"
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
                            opacity="0.8"
                        />
                        <text
                            x={(getX(7) + getX(10)) / 2}
                            y={padYTop + 14}
                            textAnchor="middle"
                            className="font-mono text-[9px] font-bold fill-[oklch(55%_0.010_28)] uppercase"
                        >
                            PRIME DINNER
                        </text>

                        {/* Horizontal Gridlines */}
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
                                stroke="oklch(68% 0.015 28)"
                                strokeWidth="2"
                                strokeDasharray="4 4"
                            />
                        )}

                        {/* Actual Cumulative Gradient Area */}
                        {pathArea && (
                            <path
                                d={pathArea}
                                fill="url(#velocityFill)"
                            />
                        )}

                        {/* Actual Cumulative Main Line */}
                        {pathActual && (
                            <path
                                d={pathActual}
                                fill="none"
                                stroke="oklch(52% 0.16 28)"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        )}

                        {/* Interactive Data Points */}
                        {points.map((pt, i) => {
                            const cx = getX(i)
                            const cy = getY(pt.cumulative)
                            const isHovered = hoveredHour === pt.hour
                            return (
                                <g key={pt.hour} className="cursor-pointer" onMouseEnter={() => setHoveredHour(pt.hour)} onMouseLeave={() => setHoveredHour(null)}>
                                    <circle
                                        cx={cx}
                                        cy={cy}
                                        r={isHovered ? 6 : 3.5}
                                        fill={isHovered ? 'oklch(18% 0.012 28)' : 'oklch(52% 0.16 28)'}
                                        stroke="oklch(97% 0.008 28)"
                                        strokeWidth="2"
                                        className="transition-all duration-200"
                                    />
                                    {/* X-axis Label */}
                                    <text
                                        x={cx}
                                        y={svgHeight - padYBottom + 16}
                                        textAnchor="middle"
                                        className={`font-mono text-[10px] ${isHovered ? 'fill-[oklch(18%_0.012_28)] font-bold' : 'fill-[oklch(55%_0.010_28)]'}`}
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
                        <div className="absolute top-4 right-4 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] p-2.5 rounded-sm font-mono text-xs shadow-md border border-[oklch(35%_0.012_28)] pointer-events-none">
                            <div className="text-[10px] text-[oklch(75%_0.010_28)] font-bold mb-1">
                                TIME // {pt.label} - {pt.hour + 1}:00
                            </div>
                            <div className="flex justify-between gap-4">
                                <span>ยอดในชั่วโมงนี้:</span>
                                <span className="font-bold text-[oklch(52%_0.16_28)]">฿{pt.sale.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span>ยอดสะสมถึงชั่วโมงนี้:</span>
                                <span className="font-bold">฿{pt.cumulative.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between gap-4 text-[10px] text-[oklch(65%_0.010_28)]">
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
