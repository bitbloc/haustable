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
        if (val === 0) return 'bg-[oklch(94%_0.010_28)] text-[oklch(55%_0.010_28)]'
        if (val <= 2) return 'bg-[oklch(90%_0.02_28)] text-[oklch(18%_0.012_28)] font-bold'
        if (val <= 4) return 'bg-[oklch(80%_0.05_28)] text-[oklch(18%_0.012_28)] font-bold'
        if (val <= 6) return 'bg-[oklch(70%_0.09_28)] text-[oklch(97%_0.008_28)] font-bold'
        if (val <= 8) return 'bg-[oklch(60%_0.13_28)] text-[oklch(97%_0.008_28)] font-bold'
        return 'bg-[oklch(52%_0.16_28)] text-[oklch(97%_0.008_28)] font-bold'
    }

    return (
        <div className="space-y-6 text-[oklch(18%_0.012_28)] font-sans">
            
            {/* 1. Heatmap Matrix 7x12 (Neo-Brutalist Grid Container) */}
            <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] divide-y divide-[oklch(85%_0.012_28)]">
                
                {/* Header */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[oklch(94%_0.010_28)]">
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] uppercase">
                            MATRIX // DENSITY
                        </span>
                        <h4 className="font-bold text-sm md:text-base text-[oklch(18%_0.012_28)]">
                            ความหนาแน่นยอดขายรายชั่วโมง (Heatmap 7 Days x 12 Hours)
                        </h4>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px] text-[oklch(42%_0.010_28)]">
                        <span>น้อย</span>
                        <div className="flex gap-0.5 border border-[oklch(85%_0.012_28)] p-0.5 bg-[oklch(94%_0.010_28)]">
                            <span className="w-3.5 h-3.5 bg-[oklch(90%_0.02_28)]" />
                            <span className="w-3.5 h-3.5 bg-[oklch(80%_0.05_28)]" />
                            <span className="w-3.5 h-3.5 bg-[oklch(70%_0.09_28)]" />
                            <span className="w-3.5 h-3.5 bg-[oklch(52%_0.16_28)]" />
                        </div>
                        <span>พีคสุด</span>
                    </div>
                </div>

                {/* Heatmap Grid Box */}
                <div className="p-4 md:p-6 bg-[oklch(97%_0.008_28)] overflow-x-auto">
                    <div className="min-w-[640px]">
                        {/* Time Slots Header */}
                        <div className="grid grid-cols-13 gap-1 mb-1 font-mono text-[11px] font-bold text-[oklch(42%_0.010_28)] text-center">
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
                                <div key={dayIdx} className="grid grid-cols-13 gap-1 my-1 items-center font-mono text-xs">
                                    <div className="font-bold text-[oklch(18%_0.012_28)] text-left">{day}</div>
                                    {row.map((val, timeIdx) => (
                                        <div
                                            key={timeIdx}
                                            className={`h-9 flex items-center justify-center text-xs border border-[oklch(85%_0.012_28)] cursor-pointer transition-all hover:border-[oklch(18%_0.012_28)] ${getHeatColor(val)}`}
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
            <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] divide-y divide-[oklch(85%_0.012_28)]">
                <div className="p-4 bg-[oklch(94%_0.010_28)] font-mono text-xs font-bold text-[oklch(18%_0.012_28)]">
                    TIME-SLOT BEHAVIOR // สถิติพฤติกรรม 4 ช่วงเวลา
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[oklch(85%_0.012_28)]">
                    {shiftWindows.map((sw) => {
                        const isSelected = selectedSlot === sw.id
                        return (
                            <div
                                key={sw.id}
                                onClick={() => setSelectedSlot(sw.id)}
                                className={`p-4 space-y-3 cursor-pointer transition-colors ${
                                    isSelected
                                        ? 'bg-[oklch(94%_0.010_28)]'
                                        : 'bg-[oklch(97%_0.008_28)] hover:bg-[oklch(94%_0.010_28)]'
                                }`}
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between font-mono text-[11px]">
                                        <span className="font-bold text-[oklch(52%_0.16_28)]">{sw.code}</span>
                                        <span className="px-1.5 py-0.2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] font-bold text-[oklch(18%_0.012_28)]">
                                            {sw.time}
                                        </span>
                                    </div>
                                    <h5 className="font-bold text-sm text-[oklch(18%_0.012_28)]">{sw.name}</h5>
                                    <p className="text-xs text-[oklch(42%_0.010_28)]">{sw.highlight}</p>
                                </div>

                                <div className="space-y-1.5 pt-2 border-t border-[oklch(85%_0.012_28)] font-mono text-xs">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-[oklch(42%_0.010_28)]">ยอดขาย:</span>
                                        <span className="font-bold text-[oklch(18%_0.012_28)] tabular-nums">
                                            ฿{Math.ceil(sw.totalSales || 0).toLocaleString()}
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-baseline">
                                        <span className="text-[oklch(42%_0.010_28)]">ต่อหัว:</span>
                                        <span className="font-bold text-[oklch(52%_0.16_28)] tabular-nums">
                                            ฿{Math.ceil(sw.salesPerHead || 0)} /คน
                                        </span>
                                    </div>

                                    <div className="text-[11px] text-[oklch(42%_0.010_28)] pt-1 border-t border-dashed border-[oklch(85%_0.012_28)]">
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
