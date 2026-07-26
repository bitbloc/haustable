/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState } from 'react'
import { Flame, Clock, Sun, Sunset, Moon, Coffee, TrendingUp, Users, ArrowUpRight } from 'lucide-react'

export default function FinancialHeatmap({ data }) {
    const [selectedSlot, setSelectedSlot] = useState('dinner')

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const timeSlots = [
        '11:00', '12:00', '13:00', '14:00', '15:00', '16:00',
        '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'
    ]

    const heatmapMatrix = data?.heatmapMatrix || [
        [2, 5, 4, 2, 1, 1, 4, 6, 7, 5, 3, 2], // Mon
        [2, 6, 4, 2, 1, 2, 4, 7, 8, 6, 4, 2], // Tue
        [3, 7, 5, 3, 2, 2, 5, 8, 9, 7, 5, 3], // Wed
        [3, 7, 5, 3, 2, 2, 6, 8, 9, 8, 6, 4], // Thu
        [4, 8, 6, 3, 2, 3, 7, 10, 10, 9, 8, 6], // Fri
        [5, 9, 7, 4, 3, 4, 8, 10, 10, 9, 9, 7], // Sat
        [4, 8, 6, 4, 3, 3, 7, 9, 8, 7, 5, 3], // Sun
    ]

    const shiftWindows = [
        {
            id: 'lunch',
            name: 'Lunch Rush',
            time: '11:00 - 14:00',
            icon: Sun,
            totalSales: 133700,
            salesPerHead: 385,
            tableTurnMins: 42,
            foodDrinkRatio: '82% Food / 18% Drink',
            highlight: 'ชุดเซตอาหารกลางวันและสเต๊กจานเดียวขายดีที่สุด',
            iconBg: 'bg-amber-100 text-amber-900 border border-amber-300'
        },
        {
            id: 'downtime',
            name: 'Afternoon Downtime',
            time: '14:00 - 17:00',
            icon: Coffee,
            totalSales: 32500,
            salesPerHead: 215,
            tableTurnMins: 65,
            foodDrinkRatio: '45% Food / 55% Drink',
            highlight: 'เครื่องดื่มชา/กาแฟ และของหวานทานเล่นครองยอดขาย',
            iconBg: 'bg-emerald-100 text-emerald-900 border border-emerald-300'
        },
        {
            id: 'dinner',
            name: 'Prime Dinner Rush',
            time: '17:00 - 21:00',
            icon: Sunset,
            totalSales: 194200,
            salesPerHead: 580,
            tableTurnMins: 55,
            foodDrinkRatio: '68% Food / 32% Drink',
            highlight: 'ช่วงเวลากำไรสูงสุด ยอดต่อหัว ฿580 (เน้นเมนูแชร์กลุ่ม)',
            iconBg: 'bg-[oklch(52%_0.16_28)] text-white'
        },
        {
            id: 'late',
            name: 'Late Night Drinks',
            time: '21:00 - 23:00',
            icon: Moon,
            totalSales: 38500,
            salesPerHead: 420,
            tableTurnMins: 75,
            foodDrinkRatio: '25% Food / 75% Alcohol',
            highlight: 'เน้นเครื่องดื่มแอลกอฮอล์และกับแกล้มยามดึก',
            iconBg: 'bg-indigo-100 text-indigo-900 border border-indigo-300'
        }
    ]

    const getHeatColor = (val) => {
        if (val === 0) return 'bg-[oklch(94%_0.010_28)] text-gray-400'
        if (val <= 2) return 'bg-[oklch(90%_0.02_28)] text-[oklch(18%_0.012_28)] font-bold'
        if (val <= 4) return 'bg-[oklch(80%_0.05_28)] text-[oklch(18%_0.012_28)] font-bold'
        if (val <= 6) return 'bg-[oklch(70%_0.09_28)] text-white font-bold'
        if (val <= 8) return 'bg-[oklch(60%_0.13_28)] text-white font-black'
        return 'bg-[oklch(52%_0.16_28)] text-white font-black shadow'
    }

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b-2 border-[oklch(85%_0.012_28)] gap-2">
                <div>
                    <div className="flex items-center gap-2">
                        <Flame size={20} className="text-[oklch(52%_0.16_28)] shrink-0" />
                        <h3 className="font-black text-base md:text-lg text-[oklch(18%_0.012_28)] tracking-tight">
                            Heatmap Matrix & Time-Slot Infographics
                        </h3>
                    </div>
                    <p className="text-xs font-semibold text-[oklch(42%_0.010_28)] mt-0.5">
                        ความหนาแน่นยอดขายรายชั่วโมง (Heatmap 7x12) และสถิติช่วงเวลา
                    </p>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] text-[oklch(18%_0.012_28)] font-bold self-start sm:self-auto">
                    <span>น้อย</span>
                    <div className="flex gap-1">
                        <span className="w-3.5 h-3.5 rounded bg-[oklch(90%_0.02_28)] border border-[oklch(85%_0.012_28)]" />
                        <span className="w-3.5 h-3.5 rounded bg-[oklch(80%_0.05_28)]" />
                        <span className="w-3.5 h-3.5 rounded bg-[oklch(70%_0.09_28)]" />
                        <span className="w-3.5 h-3.5 rounded bg-[oklch(52%_0.16_28)]" />
                    </div>
                    <span>พีคสุด</span>
                </div>
            </div>

            {/* Heatmap Grid Box - Touch Scrollable on Mobile */}
            <div className="bg-[oklch(97%_0.008_28)] border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-4 md:p-5 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                    <h4 className="text-xs font-mono font-black tracking-wider text-[oklch(18%_0.012_28)] uppercase">
                        REVENUE DENSITY HEATMAP (7 DAYS x 12 HRS)
                    </h4>
                    <span className="font-mono text-xs text-[oklch(52%_0.16_28)] font-black">Peak: Fri/Sat 18-20น.</span>
                </div>

                <div className="overflow-x-auto pb-1 scroll-smooth">
                    <div className="min-w-[620px]">
                        {/* Time Slots Header */}
                        <div className="grid grid-cols-13 gap-1 mb-1 font-mono text-[11px] font-black text-[oklch(42%_0.010_28)] text-center">
                            <div className="text-left">Day/Hr</div>
                            {timeSlots.map((ts, idx) => (
                                <div key={idx}>{ts}</div>
                            ))}
                        </div>

                        {/* Day Rows */}
                        {days.map((day, dayIdx) => (
                            <div key={dayIdx} className="grid grid-cols-13 gap-1 my-1 items-center font-mono text-xs">
                                <div className="font-black text-[oklch(18%_0.012_28)] text-left">{day}</div>
                                {heatmapMatrix[dayIdx].map((val, timeIdx) => (
                                    <div
                                        key={timeIdx}
                                        className={`h-9 rounded-lg flex items-center justify-center text-xs transition-transform active:scale-95 cursor-pointer ${getHeatColor(val)}`}
                                        title={`${day} ${timeSlots[timeIdx]}: Level ${val}/10`}
                                    >
                                        {val > 0 ? val : '-'}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Time-Slot Behavior Infographic Cards - Stack cleanly on mobile */}
            <div className="space-y-3">
                <h4 className="text-xs font-mono font-black tracking-wider text-[oklch(18%_0.012_28)] uppercase">
                    TIME-SLOT BEHAVIOR COMPARISON
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    {shiftWindows.map((sw) => {
                        const Icon = sw.icon
                        const isSelected = selectedSlot === sw.id
                        return (
                            <div
                                key={sw.id}
                                onClick={() => setSelectedSlot(sw.id)}
                                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                                    isSelected
                                        ? 'border-[oklch(52%_0.16_28)] bg-white ring-2 ring-[oklch(60%_0.15_28)]/20 shadow-md'
                                        : 'border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] hover:bg-white'
                                }`}
                            >
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className={`p-2 rounded-xl ${sw.iconBg}`}>
                                            <Icon size={18} />
                                        </div>
                                        <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-lg bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)]">
                                            {sw.time}
                                        </span>
                                    </div>

                                    <div>
                                        <h5 className="font-black text-sm md:text-base text-[oklch(18%_0.012_28)]">{sw.name}</h5>
                                        <p className="text-xs font-medium text-[oklch(42%_0.010_28)] mt-0.5">{sw.highlight}</p>
                                    </div>
                                </div>

                                <div className="space-y-2 pt-2 border-t-2 border-[oklch(85%_0.012_28)] text-xs font-mono">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-[oklch(42%_0.010_28)] font-bold">ยอดขายช่วงนี้</span>
                                        <span className="font-black text-sm text-[oklch(18%_0.012_28)]">฿{sw.totalSales.toLocaleString()}</span>
                                    </div>

                                    <div className="flex justify-between items-baseline">
                                        <span className="text-[oklch(42%_0.010_28)] font-bold">ยอดขายต่อหัว</span>
                                        <span className="font-black text-sm text-[oklch(52%_0.16_28)]">฿{sw.salesPerHead} /คน</span>
                                    </div>

                                    <div className="flex justify-between items-baseline">
                                        <span className="text-[oklch(42%_0.010_28)] font-bold">เวลานั่งเฉลี่ย</span>
                                        <span className="font-black text-[oklch(18%_0.012_28)]">{sw.tableTurnMins} นาที</span>
                                    </div>

                                    <div className="text-[11px] font-bold text-[oklch(18%_0.012_28)] pt-1 border-t border-dashed border-[oklch(85%_0.012_28)]">
                                        Ratio: {sw.foodDrinkRatio}
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
