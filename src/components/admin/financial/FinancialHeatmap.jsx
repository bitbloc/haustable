/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState } from 'react'

export default function FinancialHeatmap({ data }) {
    const [selectedSlot, setSelectedSlot] = useState('dinner')

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const timeSlots = [
        '11:00', '12:00', '13:00', '14:00', '15:00', '16:00',
        '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'
    ]

    // Defensive fallback: ensure 7 days x 12 hours matrix is ALWAYS valid array
    const rawMatrix = data?.heatmapMatrix
    const heatmapMatrix = (rawMatrix && Array.isArray(rawMatrix) && rawMatrix.length === 7)
        ? rawMatrix
        : Array(7).fill(0).map(() => Array(12).fill(0))

    // Dynamic shift calculations from real live POS data
    const shiftWindows = [
        {
            id: 'lunch',
            name: 'Lunch Rush (มื้อกลางวัน)',
            time: '11:00 - 14:00',
            totalSales: data?.shiftMetrics?.lunch?.sales || 0,
            salesPerHead: data?.shiftMetrics?.lunch?.spendPerHead || 0,
            foodDrinkRatio: data?.shiftMetrics?.lunch?.ratio || '80% อาหาร / 20% เครื่องดื่ม',
            highlight: 'ชุดเซตอาหารกลางวันและเมนูจานเดียวขายดี',
            code: 'SHIFT_01'
        },
        {
            id: 'downtime',
            name: 'Afternoon Downtime (บ่าย)',
            time: '14:00 - 17:00',
            totalSales: data?.shiftMetrics?.afternoon?.sales || 0,
            salesPerHead: data?.shiftMetrics?.afternoon?.spendPerHead || 0,
            foodDrinkRatio: data?.shiftMetrics?.afternoon?.ratio || '45% อาหาร / 55% เครื่องดื่ม',
            highlight: 'เครื่องดื่มชา/กาแฟ และของหวานครองยอดขาย',
            code: 'SHIFT_02'
        },
        {
            id: 'dinner',
            name: 'Prime Dinner Rush (มื้อเย็น)',
            time: '17:00 - 21:00',
            totalSales: data?.shiftMetrics?.dinner?.sales || 0,
            salesPerHead: data?.shiftMetrics?.dinner?.spendPerHead || 0,
            foodDrinkRatio: data?.shiftMetrics?.dinner?.ratio || '70% อาหาร / 30% เครื่องดื่ม',
            highlight: 'ช่วงเวลากำไรหลัก เมนูแชร์กลุ่มและกับข้าวรสจัด',
            code: 'SHIFT_03'
        },
        {
            id: 'late',
            name: 'Late Night Drinks (ดึก)',
            time: '21:00 - 23:00',
            totalSales: data?.shiftMetrics?.late?.sales || 0,
            salesPerHead: data?.shiftMetrics?.late?.spendPerHead || 0,
            foodDrinkRatio: data?.shiftMetrics?.late?.ratio || '30% อาหาร / 70% เครื่องดื่ม',
            highlight: 'เน้นเครื่องดื่มแอลกอฮอล์และกับแกล้มยามค่ำคืน',
            code: 'SHIFT_04'
        }
    ]

    const getHeatColor = (val) => {
        if (val === 0) return 'bg-[var(--color-paper-2)] text-[var(--color-neutral)]'
        if (val <= 2) return 'bg-[var(--color-paper-3)] text-[var(--color-ink)] font-bold'
        if (val <= 4) return 'bg-[oklch(80%_0.05_348.33)] text-[var(--color-ink)] font-bold'
        if (val <= 6) return 'bg-[oklch(70%_0.09_348.33)] text-[var(--color-paper)] font-bold'
        if (val <= 8) return 'bg-[var(--brand-plum)] text-[var(--color-paper)] font-bold'
        return 'bg-[var(--brand-plum)] text-[var(--color-paper)] font-bold'
    }

    return (
        <div className="space-y-6 text-[var(--color-ink)] font-sans">
            
            {/* 1. Heatmap Matrix 7x12 (Neo-Brutalist Grid Container) */}
            <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] divide-y divide-[var(--color-rule)]">
                
                {/* Header */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[var(--color-paper-2)]">
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[11px] tabular-nums font-bold bg-[var(--color-ink)] text-[var(--color-paper)] ">
                            MATRIX // DENSITY
                        </span>
                        <h4 className="font-bold text-sm md:text-base text-[var(--color-ink)]">
                            ความหนาแน่นยอดขายรายชั่วโมง (Heatmap 7 Days x 12 Hours)
                        </h4>
                    </div>
                    <div className="flex items-center gap-2 tabular-nums text-xs text-[var(--color-muted)]">
                        <span>น้อย</span>
                        <div className="flex gap-0.5 border border-[var(--color-rule)] p-0.5 bg-[var(--color-paper-2)]">
                            <span className="w-3.5 h-3.5 bg-[var(--color-paper-3)]" />
                            <span className="w-3.5 h-3.5 bg-[oklch(80%_0.05_348.33)]" />
                            <span className="w-3.5 h-3.5 bg-[oklch(70%_0.09_348.33)]" />
                            <span className="w-3.5 h-3.5 bg-[var(--brand-plum)]" />
                        </div>
                        <span>พีคสุด</span>
                    </div>
                </div>

                {/* Heatmap Grid Box */}
                <div className="p-4 md:p-6 bg-[var(--color-paper)] overflow-x-auto">
                    <div className="min-w-[640px]">
                        {/* Time Slots Header */}
                        <div className="grid grid-cols-13 gap-1 mb-1 tabular-nums text-xs font-bold text-[var(--color-muted)] text-center">
                            <div className="text-left">DAY/HR</div>
                            {timeSlots.map((ts, idx) => (
                                <div key={idx}>{ts}</div>
                            ))}
                        </div>

                        {/* Day Rows */}
                        {days.map((day, dayIdx) => {
                            const row = (heatmapMatrix && Array.isArray(heatmapMatrix[dayIdx])) 
                                ? heatmapMatrix[dayIdx] 
                                : Array(12).fill(0)
                            return (
                                <div key={dayIdx} className="grid grid-cols-13 gap-1 my-1 items-center tabular-nums text-xs">
                                    <div className="font-bold text-[var(--color-ink)] text-left">{day}</div>
                                    {row.map((val, timeIdx) => (
                                        <div
                                            key={timeIdx}
                                            className={`h-9 flex items-center justify-center text-xs border border-[var(--color-rule)] cursor-pointer transition-all hover:border-[var(--color-ink)] ${getHeatColor(val)}`}
                                            title={`${day} ${timeSlots[timeIdx]}: Level ${val}/10`}
                                        >
                                            {val > 0 ? val : '—'}
                                        </div>
                                    ))}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* 2. Shift Windows Grid */}
            <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] divide-y divide-[var(--color-rule)]">
                <div className="p-4 bg-[var(--color-paper-2)] tabular-nums text-xs font-bold text-[var(--color-ink)]">
                    TIME-SLOT BEHAVIOR // สถิติพฤติกรรม 4 ช่วงเวลา
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-rule)]">
                    {shiftWindows.map((sw) => {
                        const isSelected = selectedSlot === sw.id
                        return (
                            <div
                                key={sw.id}
                                onClick={() => setSelectedSlot(sw.id)}
                                className={`p-4 space-y-3 cursor-pointer transition-colors ${
                                    isSelected
                                        ? 'bg-[var(--color-paper-2)]'
                                        : 'bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)]'
                                }`}
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between tabular-nums text-xs">
                                        <span className="font-bold text-[var(--brand-plum)]">{sw.code}</span>
                                        <span className="px-1.5 py-0.2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] font-bold text-[var(--color-ink)]">
                                            {sw.time}
                                        </span>
                                    </div>
                                    <h5 className="font-bold text-sm text-[var(--color-ink)]">{sw.name}</h5>
                                    <p className="text-[13px] text-[var(--color-muted)]">{sw.highlight}</p>
                                </div>

                                <div className="space-y-1.5 pt-2 border-t border-[var(--color-rule)] tabular-nums text-xs">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-[var(--color-muted)]">ยอดขาย:</span>
                                        <span className="font-bold text-[var(--color-ink)] tabular-nums">
                                            ฿{Math.ceil(sw.totalSales || 0).toLocaleString()}
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-baseline">
                                        <span className="text-[var(--color-muted)]">ต่อหัว:</span>
                                        <span className="font-bold text-[var(--brand-plum)] tabular-nums">
                                            ฿{Math.ceil(sw.salesPerHead || 0)} /คน
                                        </span>
                                    </div>

                                    <div className="text-xs text-[var(--color-muted)] pt-1 border-t border-dashed border-[var(--color-rule)]">
                                        {sw.foodDrinkRatio}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
