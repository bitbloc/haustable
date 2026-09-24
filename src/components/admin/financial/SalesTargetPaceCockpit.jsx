/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useMemo } from 'react'

/**
 * SalesTargetPaceCockpit
 * Level 2: Sales vs Target & Hourly Run-Rate
 * Solves: "วันนี้ร้านกำลังไปตามเป้าหรือไม่" within 3 seconds.
 */
export default function SalesTargetPaceCockpit({
    currentSales = 0,
    targetSales = 10000,
    hourlyData = [], // array of { hour: 11, amount: 890, bills: 2 }
    currentHour = 19,
    currentVelocity = 0,
    closingHour = 23
}) {
    const progressPct = targetSales > 0 ? Math.min(100, Math.round((currentSales / targetSales) * 100)) : 0
    const remaining = Math.max(0, targetSales - currentSales)
    const hoursLeft = Math.max(1, closingHour - currentHour)
    const requiredPace = Math.round(remaining / hoursLeft)

    const isHit = currentSales >= targetSales
    const isOnPace = currentVelocity >= requiredPace || isHit

    // Filter operating hours (11 to 23)
    const operatingHours = useMemo(() => {
        const slots = []
        for (let h = 11; h <= 23; h++) {
            const found = hourlyData.find(item => item.hour === h)
            slots.push({
                hour: h,
                amount: found ? found.amount : 0,
                isPast: h <= currentHour,
                isCurrent: h === currentHour
            })
        }
        return slots
    }, [hourlyData, currentHour])

    const maxHourlyAmount = useMemo(() => {
        const amounts = operatingHours.map(s => s.amount)
        return Math.max(...amounts, 1500)
    }, [operatingHours])

    return (
        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)]">
            
            {/* Header / Status Banner */}
            <div className="p-4 bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
                <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 font-bold uppercase text-[10px] bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]">
                        PACE // TARGET
                    </span>
                    <span className="font-bold text-[oklch(18%_0.012_28)]">
                        ความคืบหน้าเทียบเป้าหมายประจำวัน (Sales vs Target)
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-[11px] font-bold uppercase border ${
                        isHit
                            ? 'bg-[oklch(45%_0.08_140)] text-[oklch(97%_0.008_28)] border-[oklch(45%_0.08_140)]'
                            : isOnPace
                            ? 'bg-[oklch(97%_0.008_28)] text-[oklch(45%_0.08_140)] border-[oklch(45%_0.08_140)]'
                            : 'bg-[oklch(97%_0.008_28)] text-[oklch(52%_0.16_28)] border-[oklch(52%_0.16_28)]'
                    }`}>
                        {isHit ? '✓ TARGET HIT' : isOnPace ? '↑ ON TRACK (กำลังดี)' : '↓ BEHIND PACE (ต้องเร่ง)'}
                    </span>
                </div>
            </div>

            {/* Split Grid: Left = Target Gauge & Remaining Pace / Right = Mini Hourly Sparkline */}
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-[oklch(85%_0.012_28)]">
                
                {/* Left 6 cols: Target Numbers & Progress Bar */}
                <div className="p-4 md:p-6 md:col-span-6 space-y-4">
                    <div className="flex items-baseline justify-between">
                        <div>
                            <span className="text-[11px] font-mono text-[oklch(42%_0.010_28)] block">TODAY SALES ACCUMULATED</span>
                            <div className="font-mono text-3xl font-bold text-[oklch(18%_0.012_28)] tabular-nums">
                                ฿{Math.round(currentSales).toLocaleString()}{' '}
                                <span className="text-sm font-normal text-[oklch(55%_0.010_28)]">
                                    / ฿{targetSales.toLocaleString()}
                                </span>
                            </div>
                        </div>
                        <div className="text-right font-mono">
                            <span className="text-2xl font-bold text-[oklch(52%_0.16_28)] tabular-nums">{progressPct}%</span>
                        </div>
                    </div>

                    {/* Progress Bar (Rams Minimalist) */}
                    <div className="w-full h-3 bg-[oklch(90%_0.010_28)] rounded-none overflow-hidden relative border border-[oklch(85%_0.012_28)]">
                        <div 
                            className="h-full bg-[oklch(18%_0.012_28)] transition-all duration-500 ease-out"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>

                    {/* Pace Math Row */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[oklch(85%_0.012_28)] font-mono text-xs">
                        <div className="p-2.5 bg-[oklch(94%_0.010_28)]">
                            <span className="text-[10px] text-[oklch(42%_0.010_28)] block uppercase">ยอดคงเหลือถึงเป้า</span>
                            <span className="text-sm font-bold text-[oklch(18%_0.012_28)] tabular-nums">
                                {remaining === 0 ? 'ครบเป้าแล้ว' : `฿${remaining.toLocaleString()}`}
                            </span>
                        </div>
                        <div className="p-2.5 bg-[oklch(94%_0.010_28)]">
                            <span className="text-[10px] text-[oklch(42%_0.010_28)] block uppercase">
                                Pace ที่ต้องทำ (เหลือ {hoursLeft} ชม.)
                            </span>
                            <span className={`text-sm font-bold tabular-nums ${isOnPace ? 'text-[oklch(45%_0.08_140)]' : 'text-[oklch(52%_0.16_28)]'}`}>
                                {remaining === 0 ? '0' : `฿${requiredPace.toLocaleString()}`} <span className="text-[10px] font-normal text-[oklch(42%_0.010_28)]">/ ชม.</span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right 6 cols: Mini Hourly Sparkline Chart */}
                <div className="p-4 md:p-6 md:col-span-6 flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-[11px] text-[oklch(42%_0.010_28)] uppercase">
                            ยอดขายรายชั่วโมง (Sales by Hour: 11:00 - 23:00)
                        </span>
                        <span className="text-[10px] text-[oklch(55%_0.010_28)]">
                            ความเร็วปัจจุบัน: ฿{Math.round(currentVelocity).toLocaleString()}/ชม.
                        </span>
                    </div>

                    {/* Sparkline Bar Chart */}
                    <div className="h-28 flex items-end gap-1.5 pt-4 pb-1 border-b border-[oklch(85%_0.012_28)]">
                        {operatingHours.map(slot => {
                            const barHeightPct = maxHourlyAmount > 0 ? Math.min(100, Math.round((slot.amount / maxHourlyAmount) * 100)) : 0
                            return (
                                <div 
                                    key={slot.hour} 
                                    className="flex-1 flex flex-col items-center h-full justify-end group relative"
                                >
                                    {/* Tooltip on hover */}
                                    <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute -top-8 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-1.5 py-0.5 rounded text-[10px] font-mono whitespace-nowrap z-20 transition-opacity">
                                        {slot.hour}:00 · ฿{slot.amount.toLocaleString()}
                                    </div>

                                    {/* Bar Fill */}
                                    <div 
                                        className={`w-full transition-all duration-300 ${
                                            slot.isCurrent
                                                ? 'bg-[oklch(52%_0.16_28)]' // Terracotta highlight current hour
                                                : slot.amount > 0
                                                ? 'bg-[oklch(35%_0.012_28)]' // Solid warm charcoal
                                                : 'bg-[oklch(88%_0.010_28)]' // Empty placeholder
                                        }`}
                                        style={{ height: `${Math.max(barHeightPct, 6)}%` }}
                                    />
                                    <span className="text-[9px] font-mono text-[oklch(55%_0.010_28)] mt-1 select-none">
                                        {slot.hour}
                                    </span>
                                </div>
                            )
                        })}
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-[oklch(42%_0.010_28)]">
                        <span>11:00 (เปิดร้าน)</span>
                        <span className="text-[oklch(52%_0.16_28)] font-bold">■ ชั่วโมงปัจจุบัน ({currentHour}:00)</span>
                        <span>23:00 (ปิดร้าน)</span>
                    </div>
                </div>

            </div>
        </div>
    )
}
