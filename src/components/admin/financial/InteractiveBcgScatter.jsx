/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useMemo } from 'react'

export default function InteractiveBcgScatter({ topMenuData = [], menuMatrix = [] }) {
    const [selectedQuadrant, setSelectedQuadrant] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [hoveredItem, setHoveredItem] = useState(null)

    // Calculate dynamic coordinates for each item
    const scatterItems = useMemo(() => {
        if (!topMenuData || topMenuData.length === 0) return []

        // Calculate medians/averages for quadrant division
        const unitsList = topMenuData.map(i => i.units || 1)
        const pricesList = topMenuData.map(i => i.price || 0)
        const avgUnits = unitsList.reduce((s, u) => s + u, 0) / unitsList.length
        const avgPrice = pricesList.reduce((s, p) => s + p, 0) / pricesList.length

        return topMenuData.map((item) => {
            const units = item.units || 1
            const price = item.price || 0
            const revenue = item.revenue || (units * price)

            // Estimate margin based on category
            let estMarginPct = 65
            if (item.category === 'drink') estMarginPct = 78
            else if (item.category === 'alcohol') estMarginPct = 52
            else if (item.category === 'snack') estMarginPct = 70
            else if (item.category === 'dessert') estMarginPct = 68
            else if (item.category === 'set') estMarginPct = 58
            else if (price > 250) estMarginPct = 60

            // Classify into 4 BCG Quadrants
            let quadrant = 'dogs'
            let quadrantLabel = 'Dogs (รอทบทวน)'
            let color = 'oklch(48.01% 0.0120 345.78)'
            let action = 'พิจารณาปรับสูตร ลดต้นทุน หรือหมุนเวียนเมนูใหม่'

            if (units >= avgUnits && price >= avgPrice) {
                quadrant = 'stars'
                quadrantLabel = 'Stars (ดาวเด่น)'
                color = 'oklch(25.18% 0.1001 348.33)'
                action = 'รักษาคุณภาพสม่ำเสมอ เป็นเมนูตัวชูโรงหลักของร้าน'
            } else if (units >= avgUnits && price < avgPrice) {
                quadrant = 'plowhorses'
                quadrantLabel = 'Plowhorses (ทำปริมาณ)'
                color = 'oklch(45% 0.08 140)'
                action = 'ขายดีมาก พิจารณาปรับขึ้นราคา 5-10 บาทเพื่อเพิ่มกำไร'
            } else if (units < avgUnits && price >= avgPrice) {
                quadrant = 'puzzles'
                quadrantLabel = 'Puzzles (ทำกำไรต่อจานสูง)'
                color = 'oklch(35% 0.06 250)'
                action = 'กำไรดีแต่ขายน้อย จัดวางหน้าแรกของเล่มเมนู หรือทำโปรคู่เครื่องดื่ม'
            }

            return {
                ...item,
                estMarginPct,
                quadrant,
                quadrantLabel,
                color,
                action,
                avgUnits,
                avgPrice
            }
        })
    }, [topMenuData])

    // Filter items based on active quadrant and search query
    const filteredItems = useMemo(() => {
        return scatterItems.filter(item => {
            const matchesQuad = selectedQuadrant === 'all' || item.quadrant === selectedQuadrant
            const matchesQuery = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase())
            return matchesQuad && matchesQuery
        })
    }, [scatterItems, selectedQuadrant, searchQuery])

    // Coordinate space sizing
    const svgWidth = 800
    const svgHeight = 360
    const pad = { top: 30, right: 40, bottom: 45, left: 55 }
    const plotW = svgWidth - pad.left - pad.right
    const plotH = svgHeight - pad.top - pad.bottom

    const maxUnits = useMemo(() => {
        const maxU = Math.max(...scatterItems.map(i => i.units), 10)
        return Math.ceil(maxU / 10) * 10
    }, [scatterItems])

    const maxPrice = useMemo(() => {
        const maxP = Math.max(...scatterItems.map(i => i.price), 200)
        return Math.ceil(maxP / 50) * 50
    }, [scatterItems])

    const getX = (units) => pad.left + (units / maxUnits) * plotW
    const getY = (price) => svgHeight - pad.bottom - (price / maxPrice) * plotH

    // Midpoint dividing lines
    const midUnits = scatterItems.length > 0 ? scatterItems[0].avgUnits : maxUnits / 2
    const midPrice = scatterItems.length > 0 ? scatterItems[0].avgPrice : maxPrice / 2

    const midX = getX(midUnits)
    const midY = getY(midPrice)

    return (
        <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] divide-y divide-[var(--color-rule)] font-sans">
            {/* Header Toolbar */}
            <div className="p-4 bg-[var(--color-paper-2)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[11px] tabular-nums font-bold bg-[var(--color-ink)] text-[var(--color-paper)] ">
                            SCATTER // BCG MATRIX
                        </span>
                        <h3 className="font-bold text-base md:text-lg text-[var(--color-ink)] tracking-tight">
                            เมทริกซ์วิเคราะห์เมนูแบบโต้ตอบ (Interactive Menu Engineering Scatter Plot)
                        </h3>
                    </div>
                    <p className="text-[13px] tabular-nums text-[var(--color-muted)] mt-0.5">
                        แกน X = จำนวนยอดขาย (Volume) // แกน Y = ราคาต่อจานและกำไร (Margin) // ขนาด Bubble = รายได้รวม
                    </p>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex items-center gap-2 tabular-nums text-xs">
                    <input
                        type="text"
                        placeholder="ค้นหาเมนู..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="px-2.5 py-1.5 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-ink)]"
                    />
                </div>
            </div>

            {/* Quadrant Quick Tabs */}
            <div className="p-2 bg-[var(--color-paper)] flex items-center gap-1.5 overflow-x-auto no-scrollbar tabular-nums text-xs border-b border-[var(--color-rule)]">
                {[
                    { id: 'all', label: 'ทั้งหมด [ALL]', count: scatterItems.length },
                    { id: 'stars', label: '[STARS] เมนูดาวเด่น', count: scatterItems.filter(i => i.quadrant === 'stars').length },
                    { id: 'plowhorses', label: '[PLOWHORSES] เน้นปริมาณขาย', count: scatterItems.filter(i => i.quadrant === 'plowhorses').length },
                    { id: 'puzzles', label: '[PUZZLES] กำไรต่อจานสูง', count: scatterItems.filter(i => i.quadrant === 'puzzles').length },
                    { id: 'dogs', label: '[DOGS] รอทบทวนเมนู', count: scatterItems.filter(i => i.quadrant === 'dogs').length },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setSelectedQuadrant(tab.id)}
                        className={`px-3 py-1 font-bold rounded-sm transition-colors whitespace-nowrap border ${
                            selectedQuadrant === tab.id
                                ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)]'
                                : 'bg-[var(--color-paper-2)] text-[var(--color-muted)] border-[var(--color-rule)] hover:bg-[var(--color-paper-3)]'
                        }`}
                    >
                        <span>{tab.label}</span>
                        <span className="ml-1.5 opacity-80 text-xs">({tab.count})</span>
                    </button>
                ))}
            </div>

            {/* Scatter SVG Plot Canvas */}
            <div className="p-4 relative">
                <div className="w-full overflow-x-auto no-scrollbar">
                    <svg
                        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                        className="w-full h-72 sm:h-96 select-none"
                    >
                        {/* 4 Quadrant Background Tints */}
                        {/* Top-Right: STARS */}
                        <rect
                            x={midX}
                            y={pad.top}
                            width={svgWidth - pad.right - midX}
                            height={midY - pad.top}
                            fill="oklch(25.18% 0.1001 348.33)"
                            opacity="0.04"
                        />
                        <text
                            x={svgWidth - pad.right - 10}
                            y={pad.top + 18}
                            textAnchor="end"
                            className="tabular-nums text-xs font-bold fill-[var(--brand-plum)] "
                        >
                            [STARS] (ยอดขายสูง / ราคาสูง)
                        </text>

                        {/* Top-Left: PUZZLES */}
                        <rect
                            x={pad.left}
                            y={pad.top}
                            width={midX - pad.left}
                            height={midY - pad.top}
                            fill="oklch(35% 0.06 250)"
                            opacity="0.04"
                        />
                        <text
                            x={pad.left + 10}
                            y={pad.top + 18}
                            textAnchor="start"
                            className="tabular-nums text-xs font-bold fill-[oklch(35%_0.06_250)] "
                        >
                            [PUZZLES] (ยอดขายน้อย / ราคาสูง)
                        </text>

                        {/* Bottom-Right: PLOWHORSES */}
                        <rect
                            x={midX}
                            y={midY}
                            width={svgWidth - pad.right - midX}
                            height={svgHeight - pad.bottom - midY}
                            fill="oklch(45% 0.08 140)"
                            opacity="0.04"
                        />
                        <text
                            x={svgWidth - pad.right - 10}
                            y={svgHeight - pad.bottom - 10}
                            textAnchor="end"
                            className="tabular-nums text-xs font-bold fill-[oklch(45%_0.08_140)] "
                        >
                            [PLOWHORSES] (ยอดขายสูง / ราคาประหยัด)
                        </text>

                        {/* Bottom-Left: DOGS */}
                        <rect
                            x={pad.left}
                            y={midY}
                            width={midX - pad.left}
                            height={svgHeight - pad.bottom - midY}
                            fill="oklch(48.01% 0.0120 345.78)"
                            opacity="0.03"
                        />
                        <text
                            x={pad.left + 10}
                            y={svgHeight - pad.bottom - 10}
                            textAnchor="start"
                            className="tabular-nums text-xs font-bold fill-[var(--color-neutral)] "
                        >
                            [DOGS] (ยอดขายน้อย / ราคาต่ำ)
                        </text>

                        {/* Quadrant Dividing Crosshairs */}
                        <line
                            x1={midX}
                            y1={pad.top}
                            x2={midX}
                            y2={svgHeight - pad.bottom}
                            stroke="oklch(75% 0.012 348.33)"
                            strokeWidth="1.5"
                            strokeDasharray="4 4"
                        />
                        <line
                            x1={pad.left}
                            y1={midY}
                            x2={svgWidth - pad.right}
                            y2={midY}
                            stroke="oklch(75% 0.012 348.33)"
                            strokeWidth="1.5"
                            strokeDasharray="4 4"
                        />

                        {/* Border Enclosure */}
                        <rect
                            x={pad.left}
                            y={pad.top}
                            width={plotW}
                            height={plotH}
                            fill="none"
                            stroke="oklch(85.05% 0.0113 348.48)"
                            strokeWidth="1"
                        />

                        {/* X-axis ticks & labels */}
                        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                            const val = Math.round(ratio * maxUnits)
                            const x = pad.left + ratio * plotW
                            return (
                                <g key={ratio}>
                                    <line x1={x} y1={svgHeight - pad.bottom} x2={x} y2={svgHeight - pad.bottom + 4} stroke="oklch(48.01% 0.0120 345.78)" />
                                    <text x={x} y={svgHeight - pad.bottom + 16} textAnchor="middle" className="tabular-nums text-xs fill-[var(--color-neutral)]">
                                        {val} จาน
                                    </text>
                                </g>
                            )
                        })}

                        {/* Y-axis ticks & labels */}
                        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                            const val = Math.round(ratio * maxPrice)
                            const y = svgHeight - pad.bottom - ratio * plotH
                            return (
                                <g key={ratio}>
                                    <line x1={pad.left - 4} y1={y} x2={pad.left} y2={y} stroke="oklch(48.01% 0.0120 345.78)" />
                                    <text x={pad.left - 8} y={y + 3.5} textAnchor="end" className="tabular-nums text-xs fill-[var(--color-neutral)]">
                                        ฿{val}
                                    </text>
                                </g>
                            )
                        })}

                        {/* Axis Title Labels */}
                        <text
                            x={pad.left + plotW / 2}
                            y={svgHeight - 10}
                            textAnchor="middle"
                            className="tabular-nums text-xs font-bold fill-[var(--color-ink)] "
                        >
                            ยอดขายเชิงปริมาณ (UNITS SOLD) -&gt;
                        </text>

                        {/* Data Bubbles */}
                        {filteredItems.map((item, idx) => {
                            const cx = getX(item.units)
                            const cy = getY(item.price)
                            const isHovered = hoveredItem?.name === item.name
                            const radius = Math.min(18, Math.max(5, Math.round(Math.sqrt(item.revenue || 100) / 8)))

                            return (
                                <g
                                    key={idx}
                                    className="cursor-pointer transition-transform"
                                    onMouseEnter={() => setHoveredItem(item)}
                                    onMouseLeave={() => setHoveredItem(null)}
                                >
                                    <circle
                                        cx={cx}
                                        cy={cy}
                                        r={isHovered ? radius + 4 : radius}
                                        fill={item.color}
                                        fillOpacity={isHovered ? '0.9' : '0.6'}
                                        stroke={isHovered ? 'oklch(21.78% 0 0)' : 'white'}
                                        strokeWidth={isHovered ? 2.5 : 1.5}
                                        className="transition-all duration-150"
                                    />
                                    {/* Item Label for top sellers */}
                                    {(isHovered || item.rank <= 5) && (
                                        <text
                                            x={cx}
                                            y={cy - radius - 4}
                                            textAnchor="middle"
                                            className="font-sans text-xs font-bold fill-[var(--color-ink)] pointer-events-none"
                                        >
                                            {item.name}
                                        </text>
                                    )}
                                </g>
                            )
                        })}
                    </svg>
                </div>

                {/* Hover Details Popover */}
                {hoveredItem && (
                    <div className="absolute top-6 right-6 bg-[var(--color-ink)] text-[var(--color-paper)] p-3 rounded-sm tabular-nums text-xs shadow-lg border border-[oklch(35%_0.012_348.33)] max-w-xs pointer-events-none z-10">
                        <div className="flex items-center justify-between border-b border-[oklch(35%_0.012_348.33)] pb-1.5 mb-2">
                            <span className="font-bold text-sm text-[var(--color-paper)] font-sans truncate">{hoveredItem.name}</span>
                            <span className="text-[11px] px-1.5 py-0.2 bg-[oklch(35%_0.012_348.33)] ">{hoveredItem.quadrant}</span>
                        </div>
                        <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                                <span className="text-[oklch(75%_0.01_348.33)]">ราคาขาย:</span>
                                <span className="font-bold">฿{hoveredItem.price}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[oklch(75%_0.01_348.33)]">จำนวนที่ขายได้:</span>
                                <span className="font-bold">{hoveredItem.units} จาน</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[oklch(75%_0.01_348.33)]">รายได้รวม:</span>
                                <span className="font-bold text-[var(--brand-plum)]">฿{(hoveredItem.revenue || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[oklch(75%_0.01_348.33)]">กำไรประเมิน:</span>
                                <span className="font-bold text-[oklch(45%_0.08_140)]">~{hoveredItem.estMarginPct}%</span>
                            </div>
                            <div className="pt-2 mt-1 border-t border-[oklch(35%_0.012_348.33)] text-xs text-[var(--color-rule)]">
                                <span className="font-bold text-[var(--brand-plum)]">คำแนะนำ:</span> {hoveredItem.action}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
