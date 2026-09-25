/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useMemo } from 'react'

const THAI_MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

/**
 * SalesTargetPaceCockpit
 * Level 2: Sales vs Target & Period Run-Rate / Pacing
 * Solves: "ยอดขายกำลังไปตามเป้าหมายของรอบเวลาที่เลือกหรือไม่" within 3 seconds.
 */
export default function SalesTargetPaceCockpit({
    currentSales = 0,
    targetSales = 10000,
    hourlyData = [], // array of { hour: 11, amount: 890, bills: 2 }
    currentHour = 19,
    currentVelocity = 0,
    closingHour = 23,
    filterMode = 'day', // 'day', 'month', 'year'
    periodPacingData = [],
    daysLeft = 0,
    daysInMonth = 30,
    daysElapsed = 1,
    monthsLeft = 0,
    monthsElapsed = 1,
    todayDay = 1,
    todayMonth = 1,
    selectedMonth = '',
    selectedYear = '',
}) {
    const progressPct = targetSales > 0 ? Math.min(100, Math.round((currentSales / targetSales) * 100)) : 0
    const remaining = Math.max(0, targetSales - currentSales)
    const isHit = currentSales >= targetSales

    // Pacing calculations per period mode
    const pacingCalc = useMemo(() => {
        if (filterMode === 'month') {
            const effectiveDaysLeft = Math.max(0, daysLeft)
            const requiredDailyPace = effectiveDaysLeft > 0 ? Math.round(remaining / effectiveDaysLeft) : 0
            const expectedMonthPct = Math.round((daysElapsed / Math.max(1, daysInMonth)) * 100)
            const isOnPace = isHit || (progressPct >= expectedMonthPct) || (effectiveDaysLeft > 0 && currentVelocity >= requiredDailyPace)

            return {
                title: 'ความคืบหน้าเทียบเป้าหมายประจำเดือน (Monthly Sales vs Target)',
                accumulatedLabel: 'MONTH SALES ACCUMULATED',
                remainingLabel: remaining === 0 ? 'ครบเป้าแล้ว' : `฿${remaining.toLocaleString()}`,
                paceBoxTitle: effectiveDaysLeft > 0 ? `Pace ที่ต้องทำ (เหลือ ${effectiveDaysLeft} วัน)` : 'สิ้นสุดรอบเดือน',
                paceBoxVal: remaining === 0 ? '0' : effectiveDaysLeft === 0 ? `฿${remaining.toLocaleString()}` : `฿${requiredDailyPace.toLocaleString()}`,
                paceBoxUnit: effectiveDaysLeft > 0 ? '/ วัน' : '',
                isOnPace,
                chartTitle: `ยอดขายรายวันในเดือนนี้ (Daily Sales Pacing: วันที่ 1 - ${daysInMonth})`,
                velocitySubtitle: `เฉลี่ยต่อวัน: ฿${Math.round(currentVelocity).toLocaleString()}/วัน`,
                footerStart: 'วันที่ 1',
                footerMid: `■ วันนี้ (วันที่ ${todayDay})`,
                footerEnd: `วันที่ ${daysInMonth}`
            }
        }

        if (filterMode === 'year') {
            const effectiveMonthsLeft = Math.max(0, monthsLeft)
            const requiredMonthlyPace = effectiveMonthsLeft > 0 ? Math.round(remaining / effectiveMonthsLeft) : 0
            const expectedYearPct = Math.round((monthsElapsed / 12) * 100)
            const isOnPace = isHit || (progressPct >= expectedYearPct) || (effectiveMonthsLeft > 0 && currentVelocity >= requiredMonthlyPace)

            return {
                title: 'ความคืบหน้าเทียบเป้าหมายประจำปี (Yearly Sales vs Target)',
                accumulatedLabel: 'YEAR SALES ACCUMULATED',
                remainingLabel: remaining === 0 ? 'ครบเป้าแล้ว' : `฿${remaining.toLocaleString()}`,
                paceBoxTitle: effectiveMonthsLeft > 0 ? `Pace ที่ต้องทำ (เหลือ ${effectiveMonthsLeft} เดือน)` : 'สิ้นสุดรอบปี',
                paceBoxVal: remaining === 0 ? '0' : effectiveMonthsLeft === 0 ? `฿${remaining.toLocaleString()}` : `฿${requiredMonthlyPace.toLocaleString()}`,
                paceBoxUnit: effectiveMonthsLeft > 0 ? '/ เดือน' : '',
                isOnPace,
                chartTitle: 'ยอดขายรายเดือนในรอบปี (Monthly Sales: ม.ค. - ธ.ค.)',
                velocitySubtitle: `เฉลี่ยต่อเดือน: ฿${Math.round(currentVelocity).toLocaleString()}/เดือน`,
                footerStart: 'ม.ค.',
                footerMid: `■ เดือนปัจจุบัน (${THAI_MONTH_SHORT[todayMonth - 1] || ''})`,
                footerEnd: 'ธ.ค.'
            }
        }

        // Default: filterMode === 'day'
        const hoursLeft = Math.max(1, closingHour - currentHour)
        const requiredPace = Math.round(remaining / hoursLeft)
        const isOnPace = currentVelocity >= requiredPace || isHit

        return {
            title: 'ความคืบหน้าเทียบเป้าหมายประจำวัน (Sales vs Target)',
            accumulatedLabel: 'TODAY SALES ACCUMULATED',
            remainingLabel: remaining === 0 ? 'ครบเป้าแล้ว' : `฿${remaining.toLocaleString()}`,
            paceBoxTitle: `Pace ที่ต้องทำ (เหลือ ${hoursLeft} ชม.)`,
            paceBoxVal: remaining === 0 ? '0' : `฿${requiredPace.toLocaleString()}`,
            paceBoxUnit: '/ ชม.',
            isOnPace,
            chartTitle: 'ยอดขายรายชั่วโมง (Sales by Hour: 11:00 - 23:00)',
            velocitySubtitle: `ความเร็วปัจจุบัน: ฿${Math.round(currentVelocity).toLocaleString()}/ชม.`,
            footerStart: '11:00 (เปิดร้าน)',
            footerMid: `■ ชั่วโมงปัจจุบัน (${currentHour}:00)`,
            footerEnd: '23:00 (ปิดร้าน)'
        }
    }, [filterMode, remaining, daysLeft, daysElapsed, daysInMonth, monthsLeft, monthsElapsed, isHit, progressPct, currentVelocity, currentHour, closingHour, todayDay, todayMonth])

    // Operating hours for Day view
    const operatingHours = useMemo(() => {
        if (filterMode !== 'day') return []
        const slots = []
        for (let h = 11; h <= 23; h++) {
            const found = hourlyData.find(item => item.hour === h)
            slots.push({
                key: h,
                label: `${h}`,
                tooltip: `${h}:00 · ฿${(found ? found.amount : 0).toLocaleString()}`,
                amount: found ? found.amount : 0,
                isCurrent: h === currentHour
            })
        }
        return slots
    }, [filterMode, hourlyData, currentHour])

    // Daily pacing bars for Month view (1..daysInMonth)
    const monthDailySlots = useMemo(() => {
        if (filterMode !== 'month') return []
        const slots = []
        const dataMap = {}
        periodPacingData.forEach(p => {
            if (p.day) dataMap[p.day] = p
        })

        for (let d = 1; d <= daysInMonth; d++) {
            const found = dataMap[d]
            const amt = found ? found.amount : 0
            slots.push({
                key: d,
                label: d === 1 || d === 5 || d === 10 || d === 15 || d === 20 || d === 25 || d === daysInMonth || d === todayDay ? `${d}` : '',
                tooltip: `วันที่ ${d} · ฿${amt.toLocaleString()}${found?.bills ? ` (${found.bills} บิล)` : ''}`,
                amount: amt,
                isCurrent: d === todayDay
            })
        }
        return slots
    }, [filterMode, periodPacingData, daysInMonth, todayDay])

    // Monthly pacing bars for Year view (1..12)
    const yearMonthSlots = useMemo(() => {
        if (filterMode !== 'year') return []
        const slots = []
        const dataMap = {}
        periodPacingData.forEach(p => {
            if (p.month) dataMap[p.month] = p
        })

        for (let m = 1; m <= 12; m++) {
            const found = dataMap[m]
            const amt = found ? found.amount : 0
            const mLabel = THAI_MONTH_SHORT[m - 1]
            slots.push({
                key: m,
                label: mLabel,
                tooltip: `${mLabel} · ฿${amt.toLocaleString()}${found?.bills ? ` (${found.bills} บิล)` : ''}`,
                amount: amt,
                isCurrent: m === todayMonth
            })
        }
        return slots
    }, [filterMode, periodPacingData, todayMonth])

    // Active chart slots based on current filter mode
    const activeSlots = useMemo(() => {
        if (filterMode === 'month') return monthDailySlots
        if (filterMode === 'year') return yearMonthSlots
        return operatingHours
    }, [filterMode, monthDailySlots, yearMonthSlots, operatingHours])

    const maxSlotAmount = useMemo(() => {
        const amounts = activeSlots.map(s => s.amount)
        return Math.max(...amounts, 1500)
    }, [activeSlots])

    return (
        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)]">
            
            {/* Header / Status Banner */}
            <div className="p-4 bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
                <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 font-bold uppercase text-[10px] bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]">
                        PACE // TARGET
                    </span>
                    <span className="font-bold text-[oklch(18%_0.012_28)]">
                        {pacingCalc.title}
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-[11px] font-bold uppercase border ${
                        isHit
                            ? 'bg-[oklch(45%_0.08_140)] text-[oklch(97%_0.008_28)] border-[oklch(45%_0.08_140)]'
                            : pacingCalc.isOnPace
                            ? 'bg-[oklch(97%_0.008_28)] text-[oklch(45%_0.08_140)] border-[oklch(45%_0.08_140)]'
                            : 'bg-[oklch(97%_0.008_28)] text-[oklch(52%_0.16_28)] border-[oklch(52%_0.16_28)]'
                    }`}>
                        {isHit ? '✓ TARGET HIT' : pacingCalc.isOnPace ? '↑ ON TRACK (ตามเป้า)' : '↓ BEHIND PACE (ต้องเร่ง)'}
                    </span>
                </div>
            </div>

            {/* Split Grid: Left = Target Gauge & Remaining Pace / Right = Period Sparkline Chart */}
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-[oklch(85%_0.012_28)]">
                
                {/* Left 6 cols: Target Numbers & Progress Bar */}
                <div className="p-4 md:p-6 md:col-span-6 space-y-4">
                    <div className="flex items-baseline justify-between">
                        <div>
                            <span className="text-[11px] font-mono text-[oklch(42%_0.010_28)] block">
                                {pacingCalc.accumulatedLabel}
                            </span>
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
                                {pacingCalc.remainingLabel}
                            </span>
                        </div>
                        <div className="p-2.5 bg-[oklch(94%_0.010_28)]">
                            <span className="text-[10px] text-[oklch(42%_0.010_28)] block uppercase">
                                {pacingCalc.paceBoxTitle}
                            </span>
                            <span className={`text-sm font-bold tabular-nums ${pacingCalc.isOnPace ? 'text-[oklch(45%_0.08_140)]' : 'text-[oklch(52%_0.16_28)]'}`}>
                                {pacingCalc.paceBoxVal}{' '}
                                {pacingCalc.paceBoxUnit && (
                                    <span className="text-[10px] font-normal text-[oklch(42%_0.010_28)]">{pacingCalc.paceBoxUnit}</span>
                                )}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right 6 cols: Period Sparkline Chart (Hourly for Day, Daily for Month, Monthly for Year) */}
                <div className="p-4 md:p-6 md:col-span-6 flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-[11px] text-[oklch(42%_0.010_28)] uppercase">
                            {pacingCalc.chartTitle}
                        </span>
                        <span className="text-[10px] text-[oklch(55%_0.010_28)]">
                            {pacingCalc.velocitySubtitle}
                        </span>
                    </div>

                    {/* Sparkline Bar Chart */}
                    <div className="h-28 flex items-end gap-1 pt-4 pb-1 border-b border-[oklch(85%_0.012_28)]">
                        {activeSlots.map(slot => {
                            const barHeightPct = maxSlotAmount > 0 ? Math.min(100, Math.round((slot.amount / maxSlotAmount) * 100)) : 0
                            return (
                                <div 
                                    key={slot.key} 
                                    className="flex-1 flex flex-col items-center h-full justify-end group relative"
                                >
                                    {/* Tooltip on hover */}
                                    <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute -top-8 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-1.5 py-0.5 rounded-none text-[10px] font-mono whitespace-nowrap z-20 transition-opacity">
                                        {slot.tooltip}
                                    </div>

                                    {/* Bar Fill */}
                                    <div 
                                        className={`w-full transition-all duration-300 ${
                                            slot.isCurrent
                                                ? 'bg-[oklch(52%_0.16_28)]' // Terracotta highlight current period
                                                : slot.amount > 0
                                                ? 'bg-[oklch(35%_0.012_28)]' // Solid warm charcoal
                                                : 'bg-[oklch(88%_0.010_28)]' // Empty placeholder
                                        }`}
                                        style={{ height: `${Math.max(barHeightPct, 6)}%` }}
                                    />
                                    <span className="text-[9px] font-mono text-[oklch(55%_0.010_28)] mt-1 select-none truncate">
                                        {slot.label}
                                    </span>
                                </div>
                            )
                        })}
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-[oklch(42%_0.010_28)]">
                        <span>{pacingCalc.footerStart}</span>
                        <span className="text-[oklch(52%_0.16_28)] font-bold">{pacingCalc.footerMid}</span>
                        <span>{pacingCalc.footerEnd}</span>
                    </div>
                </div>

            </div>
        </div>
    )
}

