/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React from 'react'

/**
 * ExecutiveKpiStrip (Level 1 - Today At-a-Glance)
 * 5 Core Decision Cards + Sales Velocity & Forecast Close
 * Built according to Dieter Rams tabular grid & Thai Modern OKLCH color rules.
 */
export default function ExecutiveKpiStrip({
    salesToday = 0,
    salesGrowthPct = 0,
    orderCount = 0,
    orderGrowthPct = 0,
    guestCount = 0,
    guestGrowthPct = 0,
    avgTicket = 0,
    avgTicketGrowthPct = 0,
    salesTarget = 10000,
    currentVelocityPerHour = 0,
    forecastClose = 0,
    currentHourStr = '19:30',
    compareLabel = 'vs same day last week',
    onEditTarget = null
}) {
    const targetProgressPct = salesTarget > 0 ? Math.min(100, Math.round((salesToday / salesTarget) * 100)) : 0
    const remainingToTarget = Math.max(0, salesTarget - salesToday)

    const formatDiff = (pct) => {
        const num = parseFloat(pct) || 0
        if (num > 0) return `+${num.toFixed(1)}%`
        if (num < 0) return `${num.toFixed(1)}%`
        return '0.0%'
    }

    const isPositive = (pct) => (parseFloat(pct) || 0) >= 0

    return (
        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)]">
            {/* Header Meta Strip */}
            <div className="px-4 py-2 bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-[oklch(42%_0.010_28)]">
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[oklch(52%_0.16_28)]"></span>
                    <span className="font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider">
                        LEVEL 1 // AT-A-GLANCE STATUS
                    </span>
                    <span className="text-[oklch(55%_0.010_28)]">เปรียบเทียบ: {compareLabel}</span>
                </div>
                <div className="flex items-center gap-3">
                    <span>เป้าหมายวันนี้: ฿{salesTarget.toLocaleString()}</span>
                    {onEditTarget && (
                        <button
                            type="button"
                            onClick={onEditTarget}
                            className="underline hover:text-[oklch(18%_0.012_28)] transition-colors cursor-pointer"
                        >
                            [ปรับเป้า]
                        </button>
                    )}
                </div>
            </div>

            {/* 6-Cell Responsive Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y lg:divide-y-0 divide-[oklch(85%_0.012_28)]">
                
                {/* Cell 1: Sales Today */}
                <div className="p-4 flex flex-col justify-between space-y-2 bg-[oklch(97%_0.008_28)]">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[oklch(42%_0.010_28)]">
                        <span>01 // SALES TODAY</span>
                        <span className="text-[9px] uppercase px-1 py-0.2 border border-[oklch(85%_0.012_28)]">NET</span>
                    </div>
                    <div>
                        <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-[oklch(18%_0.012_28)] tabular-nums">
                            ฿{Math.round(salesToday).toLocaleString()}
                        </div>
                    </div>
                    <div className="font-mono text-[11px] pt-1.5 border-t border-[oklch(85%_0.012_28)] flex items-center justify-between">
                        <span className={isPositive(salesGrowthPct) ? 'text-[oklch(45%_0.08_140)] font-bold' : 'text-[oklch(52%_0.16_28)] font-bold'}>
                            {formatDiff(salesGrowthPct)}
                        </span>
                        <span className="text-[oklch(55%_0.010_28)] text-[10px] truncate max-w-[80px]">vs W-1</span>
                    </div>
                </div>

                {/* Cell 2: Completed Orders */}
                <div className="p-4 flex flex-col justify-between space-y-2 bg-[oklch(97%_0.008_28)]">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[oklch(42%_0.010_28)]">
                        <span>02 // ORDERS</span>
                        <span className="text-[9px] uppercase px-1 py-0.2 border border-[oklch(85%_0.012_28)]">BILLS</span>
                    </div>
                    <div>
                        <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-[oklch(18%_0.012_28)] tabular-nums">
                            {orderCount}
                        </div>
                    </div>
                    <div className="font-mono text-[11px] pt-1.5 border-t border-[oklch(85%_0.012_28)] flex items-center justify-between">
                        <span className={isPositive(orderGrowthPct) ? 'text-[oklch(45%_0.08_140)] font-bold' : 'text-[oklch(52%_0.16_28)] font-bold'}>
                            {formatDiff(orderGrowthPct)}
                        </span>
                        <span className="text-[oklch(55%_0.010_28)] text-[10px]">บิลสำเร็จ</span>
                    </div>
                </div>

                {/* Cell 3: Guests (Pax) */}
                <div className="p-4 flex flex-col justify-between space-y-2 bg-[oklch(97%_0.008_28)]">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[oklch(42%_0.010_28)]">
                        <span>03 // GUESTS</span>
                        <span className="text-[9px] uppercase px-1 py-0.2 border border-[oklch(85%_0.012_28)]">HEADCOUNT</span>
                    </div>
                    <div>
                        <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-[oklch(18%_0.012_28)] tabular-nums">
                            {guestCount} <span className="text-xs font-normal text-[oklch(55%_0.010_28)]">ท่าน</span>
                        </div>
                    </div>
                    <div className="font-mono text-[11px] pt-1.5 border-t border-[oklch(85%_0.012_28)] flex items-center justify-between">
                        <span className={isPositive(guestGrowthPct) ? 'text-[oklch(45%_0.08_140)] font-bold' : 'text-[oklch(52%_0.16_28)] font-bold'}>
                            {formatDiff(guestGrowthPct)}
                        </span>
                        <span className="text-[oklch(55%_0.010_28)] text-[10px]">ผู้ทานในร้าน</span>
                    </div>
                </div>

                {/* Cell 4: Average Ticket (Avg Bill) */}
                <div className="p-4 flex flex-col justify-between space-y-2 bg-[oklch(97%_0.008_28)]">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[oklch(42%_0.010_28)]">
                        <span>04 // AVG TICKET</span>
                        <span className="text-[9px] uppercase px-1 py-0.2 border border-[oklch(85%_0.012_28)]">PER BILL</span>
                    </div>
                    <div>
                        <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-[oklch(18%_0.012_28)] tabular-nums">
                            ฿{Math.round(avgTicket).toLocaleString()}
                        </div>
                    </div>
                    <div className="font-mono text-[11px] pt-1.5 border-t border-[oklch(85%_0.012_28)] flex items-center justify-between">
                        <span className={isPositive(avgTicketGrowthPct) ? 'text-[oklch(45%_0.08_140)] font-bold' : 'text-[oklch(52%_0.16_28)] font-bold'}>
                            {formatDiff(avgTicketGrowthPct)}
                        </span>
                        <span className="text-[oklch(55%_0.010_28)] text-[10px]">เฉลี่ยต่อบิล</span>
                    </div>
                </div>

                {/* Cell 5: Sales Target Progress */}
                <div className="p-4 flex flex-col justify-between space-y-2 bg-[oklch(97%_0.008_28)]">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[oklch(42%_0.010_28)]">
                        <span>05 // TARGET %</span>
                        <span className="text-[9px] font-bold text-[oklch(52%_0.16_28)] uppercase">{targetProgressPct}%</span>
                    </div>
                    <div>
                        <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-[oklch(18%_0.012_28)] tabular-nums">
                            {targetProgressPct}%
                        </div>
                    </div>
                    <div className="font-mono text-[11px] pt-1.5 border-t border-[oklch(85%_0.012_28)] flex items-center justify-between">
                        <span className="text-[oklch(55%_0.010_28)] text-[10px]">ขาดอีก:</span>
                        <span className="text-[oklch(18%_0.012_28)] font-bold">฿{remainingToTarget.toLocaleString()}</span>
                    </div>
                </div>

                {/* Cell 6: Velocity & Forecast Close */}
                <div className="p-4 flex flex-col justify-between space-y-2 bg-[oklch(94%_0.010_28)]">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[oklch(42%_0.010_28)]">
                        <span className="font-bold text-[oklch(18%_0.012_28)]">06 // VELOCITY</span>
                        <span className="text-[9px] uppercase px-1 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold">
                            {currentHourStr}
                        </span>
                    </div>
                    <div>
                        <div className="font-mono text-xl sm:text-2xl font-bold tracking-tight text-[oklch(52%_0.16_28)] tabular-nums">
                            ฿{Math.round(currentVelocityPerHour).toLocaleString()} <span className="text-xs font-normal text-[oklch(42%_0.010_28)]">/ ชม.</span>
                        </div>
                    </div>
                    <div className="font-mono text-[11px] pt-1.5 border-t border-[oklch(85%_0.012_28)] flex items-center justify-between">
                        <span className="text-[oklch(55%_0.010_28)] text-[10px]">Forecast:</span>
                        <span className="font-bold text-[oklch(18%_0.012_28)]">≈ ฿{Math.round(forecastClose).toLocaleString()}</span>
                    </div>
                </div>

            </div>
        </div>
    )
}
