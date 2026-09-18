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
            let color = 'oklch(55% 0.010 28)'
            let action = 'พิจารณาปรับสูตร ลดต้นทุน หรือหมุนเวียนเมนูใหม่'

            if (units >= avgUnits && price >= avgPrice) {
                quadrant = 'stars'
                quadrantLabel = 'Stars (ดาวเด่น)'
                color = 'oklch(52% 0.16 28)'
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
        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] divide-y divide-[oklch(85%_0.012_28)] font-sans">
            {/* Header Toolbar */}
            <div className="p-4 bg-[oklch(94%_0.010_28)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] uppercase">
                            SCATTER // BCG MATRIX
                        </span>
                        <h3 className="font-bold text-base md:text-lg text-[oklch(18%_0.012_28)] tracking-tight">
                            เมทริกซ์วิเคราะห์เมนูแบบโต้ตอบ (Interactive Menu Engineering Scatter Plot)
                        </h3>
                    </div>
                    <p className="text-xs font-mono text-[oklch(42%_0.010_28)] mt-0.5">
                        แกน X = จำนวนยอดขาย (Volume) // แกน Y = ราคาต่อจานและกำไร (Margin) // ขนาด Bubble = รายได้รวม
                    </p>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex items-center gap-2 font-mono text-xs">
                    <input
                        type="text"
                        placeholder="ค้นหาเมนู..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-[oklch(85%_0.012_28)] rounded-sm text-[oklch(18%_0.012_28)] focus:outline-none focus:border-[oklch(18%_0.012_28)]"
                    />
                </div>
            </div>

            {/* Quadrant Quick Tabs */}
            <div className="p-2 bg-[oklch(97%_0.008_28)] flex items-center gap-1.5 overflow-x-auto no-scrollbar font-mono text-xs border-b border-[oklch(85%_0.012_28)]">
                {[
                    { id: 'all', label: 'ทั้งหมด [ALL]', count: scatterItems.length },
                    { id: 'stars', label: '🌟 STARS (ดาวเด่น)', count: scatterItems.filter(i => i.quadrant === 'stars').length },
                    { id: 'plowhorses', label: '🐴 PLOWHORSES (เน้นปริมาณ)', count: scatterItems.filter(i => i.quadrant === 'plowhorses').length },
                    { id: 'puzzles', label: '❓ PUZZLES (กำไรต่อจานสูง)', count: scatterItems.filter(i => i.quadrant === 'puzzles').length },
                    { id: 'dogs', label: '🐕 DOGS (รอทบทวน)', count: scatterItems.filter(i => i.quadrant === 'dogs').length },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setSelectedQuadrant(tab.id)}
                        className={`px-3 py-1 font-bold rounded-sm transition-colors whitespace-nowrap border ${
                            selectedQuadrant === tab.id
                                ? 'bg-[oklch(18%_0.012_28)] text-white border-[oklch(18%_0.012_28)]'
                                : 'bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(90%_0.012_28)]'
                        }`}
                    >
                        <span>{tab.label}</span>
                        <span className="ml-1.5 opacity-80 text-[10px]">({tab.count})</span>
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
                            fill="oklch(52% 0.16 28)"
                            opacity="0.04"
                        />
                        <text
                            x={svgWidth - pad.right - 10}
                            y={pad.top + 18}
                            textAnchor="end"
                            className="font-mono text-[10px] font-bold fill-[oklch(52%_0.16_28)] uppercase"
                        >
                            🌟 STARS (ยอดขายสูง / ราคาสูง)
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
                            className="font-mono text-[10px] font-bold fill-[oklch(35%_0.06_250)] uppercase"
                        >
                            ❓ PUZZLES (ยอดขายน้อย / ราคาสูง)
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
                            className="font-mono text-[10px] font-bold fill-[oklch(45%_0.08_140)] uppercase"
                        >
                            🐴 PLOWHORSES (ยอดขายสูง / ราคาประหยัด)
                        </text>

                        {/* Bottom-Left: DOGS */}
                        <rect
                            x={pad.left}
                            y={midY}
                            width={midX - pad.left}
                            height={svgHeight - pad.bottom - midY}
                            fill="oklch(55% 0.010 28)"
                            opacity="0.03"
                        />
                        <text
                            x={pad.left + 10}
                            y={svgHeight - pad.bottom - 10}
                            textAnchor="start"
                            className="font-mono text-[10px] font-bold fill-[oklch(55%_0.010_28)] uppercase"
                        >
                            🐕 DOGS (ยอดขายน้อย / ราคาต่ำ)
                        </text>

                        {/* Quadrant Dividing Crosshairs */}
                        <line
                            x1={midX}
                            y1={pad.top}
                            x2={midX}
                            y2={svgHeight - pad.bottom}
                            stroke="oklch(75% 0.012 28)"
                            strokeWidth="1.5"
                            strokeDasharray="4 4"
                        />
                        <line
                            x1={pad.left}
                            y1={midY}
                            x2={svgWidth - pad.right}
                            y2={midY}
                            stroke="oklch(75% 0.012 28)"
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
                            stroke="oklch(85% 0.012 28)"
                            strokeWidth="1"
                        />

                        {/* X-axis ticks & labels */}
                        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                            const val = Math.round(ratio * maxUnits)
                            const x = pad.left + ratio * plotW
                            return (
                                <g key={ratio}>
                                    <line x1={x} y1={svgHeight - pad.bottom} x2={x} y2={svgHeight - pad.bottom + 4} stroke="oklch(55% 0.010 28)" />
                                    <text x={x} y={svgHeight - pad.bottom + 16} textAnchor="middle" className="font-mono text-[9px] fill-[oklch(55%_0.010_28)]">
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
                                    <line x1={pad.left - 4} y1={y} x2={pad.left} y2={y} stroke="oklch(55% 0.010 28)" />
                                    <text x={pad.left - 8} y={y + 3.5} textAnchor="end" className="font-mono text-[9px] fill-[oklch(55%_0.010_28)]">
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
                            className="font-mono text-[10px] font-bold fill-[oklch(18%_0.012_28)] uppercase"
                        >
                            ยอดขายเชิงปริมาณ (UNITS SOLD) ➔
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
                                        stroke={isHovered ? 'oklch(18% 0.012 28)' : 'white'}
                                        strokeWidth={isHovered ? 2.5 : 1.5}
                                        className="transition-all duration-150"
                                    />
                                    {/* Item Label for top sellers */}
                                    {(isHovered || item.rank <= 5) && (
                                        <text
                                            x={cx}
                                            y={cy - radius - 4}
                                            textAnchor="middle"
                                            className="font-sans text-[10px] font-bold fill-[oklch(18%_0.012_28)] pointer-events-none"
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
                    <div className="absolute top-6 right-6 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] p-3 rounded-sm font-mono text-xs shadow-lg border border-[oklch(35%_0.012_28)] max-w-xs pointer-events-none z-10">
                        <div className="flex items-center justify-between border-b border-[oklch(35%_0.012_28)] pb-1.5 mb-2">
                            <span className="font-bold text-sm text-[oklch(97%_0.008_28)] font-sans truncate">{hoveredItem.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-[oklch(35%_0.012_28)] uppercase">{hoveredItem.quadrant}</span>
                        </div>
                        <div className="space-y-1 text-[11px]">
                            <div className="flex justify-between">
                                <span className="text-[oklch(75%_0.010_28)]">ราคาขาย:</span>
                                <span className="font-bold">฿{hoveredItem.price}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[oklch(75%_0.010_28)]">จำนวนที่ขายได้:</span>
                                <span className="font-bold">{hoveredItem.units} จาน</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[oklch(75%_0.010_28)]">รายได้รวม:</span>
                                <span className="font-bold text-[oklch(52%_0.16_28)]">฿{(hoveredItem.revenue || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[oklch(75%_0.010_28)]">กำไรประเมิน:</span>
                                <span className="font-bold text-[oklch(45%_0.08_140)]">~{hoveredItem.estMarginPct}%</span>
                            </div>
                            <div className="pt-2 mt-1 border-t border-[oklch(35%_0.012_28)] text-[10px] text-[oklch(85%_0.012_28)]">
                                <span className="font-bold text-[oklch(52%_0.16_28)]">คำแนะนำ:</span> {hoveredItem.action}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
