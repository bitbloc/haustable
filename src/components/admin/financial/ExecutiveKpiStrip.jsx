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
    onEditTarget = null,
    filterMode = 'day',
    targetLabel = null,
    salesTitle = null,
    compareSubtext = null,
    velocityUnit = '/ ชม.',
}) {
    const targetProgressPct = salesTarget > 0 ? Math.min(100, Math.round((salesToday / salesTarget) * 100)) : 0
    const remainingToTarget = Math.max(0, salesTarget - salesToday)

    const resolvedTargetLabel = targetLabel || (
        filterMode === 'month' ? 'เป้าหมายรายเดือน' :
        filterMode === 'year' ? 'เป้าหมายรายปี' :
        'เป้าหมายรายวัน'
    )

    const resolvedSalesTitle = salesTitle || (
        filterMode === 'month' ? 'SALES THIS MONTH' :
        filterMode === 'year' ? 'SALES THIS YEAR' :
        'SALES TODAY'
    )

    const resolvedCompareSubtext = compareSubtext || (
        filterMode === 'month' ? 'vs M-1' :
        filterMode === 'year' ? 'vs Y-1' :
        'vs W-1'
    )

    const formatDiff = (pct) => {
        const num = parseFloat(pct) || 0
        if (num > 0) return `+${num.toFixed(1)}%`
        if (num < 0) return `${num.toFixed(1)}%`
        return '0.0%'
    }

    const isPositive = (pct) => (parseFloat(pct) || 0) >= 0

    return (
        <div className="border border-[var(--color-rule)] bg-[var(--color-paper)]">
            {/* Header Meta Strip */}
            <div className="px-4 py-2 bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] flex flex-wrap items-center justify-between gap-2 tabular-nums text-xs text-[var(--color-muted)]">
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-plum)]"></span>
                    <span className="font-bold text-[var(--color-ink)]  ">
                        AT-A-GLANCE STATUS
                    </span>
                    <span className="text-[var(--color-neutral)]">เปรียบเทียบ: {compareLabel}</span>
                </div>
                <div className="flex items-center gap-3">
                    <span>{resolvedTargetLabel}: ฿{salesTarget.toLocaleString()}</span>
                    {onEditTarget && (
                        <button
                            type="button"
                            onClick={onEditTarget}
                            className="underline hover:text-[var(--color-ink)] transition-colors cursor-pointer"
                        >
                            [ปรับเป้า]
                        </button>
                    )}
                </div>
            </div>

            {/* 6-Cell Responsive Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y lg:divide-y-0 divide-[var(--color-rule)]">
                
                {/* Cell 1: Sales Today / Period */}
                <div className="p-4 flex flex-col justify-between space-y-2 bg-[var(--color-paper)]">
                    <div className="flex items-center justify-between text-xs tabular-nums text-[var(--color-muted)]">
                        <span>{resolvedSalesTitle}</span>
                        <span className="text-[11px] px-1 py-0.2 border border-[var(--color-rule)]">NET</span>
                    </div>
                    <div>
                        <div className=" text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-ink)] tabular-nums">
                            ฿{Math.round(salesToday).toLocaleString()}
                        </div>
                    </div>
                    <div className="tabular-nums text-xs pt-1.5 border-t border-[var(--color-rule)] flex items-center justify-between">
                        <span className={isPositive(salesGrowthPct) ? 'text-[oklch(45%_0.08_140)] font-bold' : 'text-[var(--brand-plum)] font-bold'}>
                            {formatDiff(salesGrowthPct)}
                        </span>
                        <span className="text-[var(--color-neutral)] text-xs truncate max-w-[80px]">{resolvedCompareSubtext}</span>
                    </div>
                </div>

                {/* Cell 2: Completed Orders */}
                <div className="p-4 flex flex-col justify-between space-y-2 bg-[var(--color-paper)]">
                    <div className="flex items-center justify-between text-xs tabular-nums text-[var(--color-muted)]">
                        <span>ORDERS</span>
                        <span className="text-[11px] px-1 py-0.2 border border-[var(--color-rule)]">BILLS</span>
                    </div>
                    <div>
                        <div className=" text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-ink)] tabular-nums">
                            {orderCount}
                        </div>
                    </div>
                    <div className="tabular-nums text-xs pt-1.5 border-t border-[var(--color-rule)] flex items-center justify-between">
                        <span className={isPositive(orderGrowthPct) ? 'text-[oklch(45%_0.08_140)] font-bold' : 'text-[var(--brand-plum)] font-bold'}>
                            {formatDiff(orderGrowthPct)}
                        </span>
                        <span className="text-[var(--color-neutral)] text-xs">บิลสำเร็จ</span>
                    </div>
                </div>

                {/* Cell 3: Guests (Pax) */}
                <div className="p-4 flex flex-col justify-between space-y-2 bg-[var(--color-paper)]">
                    <div className="flex items-center justify-between text-xs tabular-nums text-[var(--color-muted)]">
                        <span>GUESTS</span>
                        <span className="text-[11px] px-1 py-0.2 border border-[var(--color-rule)]">HEADCOUNT</span>
                    </div>
                    <div>
                        <div className=" text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-ink)] tabular-nums">
                            {guestCount} <span className="text-xs font-normal text-[var(--color-neutral)]">ท่าน</span>
                        </div>
                    </div>
                    <div className="tabular-nums text-xs pt-1.5 border-t border-[var(--color-rule)] flex items-center justify-between">
                        <span className={isPositive(guestGrowthPct) ? 'text-[oklch(45%_0.08_140)] font-bold' : 'text-[var(--brand-plum)] font-bold'}>
                            {formatDiff(guestGrowthPct)}
                        </span>
                        <span className="text-[var(--color-neutral)] text-xs">ผู้ทานในร้าน</span>
                    </div>
                </div>

                {/* Cell 4: Average Ticket (Avg Bill) */}
                <div className="p-4 flex flex-col justify-between space-y-2 bg-[var(--color-paper)]">
                    <div className="flex items-center justify-between text-xs tabular-nums text-[var(--color-muted)]">
                        <span>AVG TICKET</span>
                        <span className="text-[11px] px-1 py-0.2 border border-[var(--color-rule)]">PER BILL</span>
                    </div>
                    <div>
                        <div className=" text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-ink)] tabular-nums">
                            ฿{Math.round(avgTicket).toLocaleString()}
                        </div>
                    </div>
                    <div className="tabular-nums text-xs pt-1.5 border-t border-[var(--color-rule)] flex items-center justify-between">
                        <span className={isPositive(avgTicketGrowthPct) ? 'text-[oklch(45%_0.08_140)] font-bold' : 'text-[var(--brand-plum)] font-bold'}>
                            {formatDiff(avgTicketGrowthPct)}
                        </span>
                        <span className="text-[var(--color-neutral)] text-xs">เฉลี่ยต่อบิล</span>
                    </div>
                </div>

                {/* Cell 5: Sales Target Progress */}
                <div className="p-4 flex flex-col justify-between space-y-2 bg-[var(--color-paper)]">
                    <div className="flex items-center justify-between text-xs tabular-nums text-[var(--color-muted)]">
                        <span>TARGET %</span>
                        <span className="text-xs font-bold text-[var(--brand-plum)] ">{targetProgressPct}%</span>
                    </div>
                    <div>
                        <div className=" text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-ink)] tabular-nums">
                            {targetProgressPct}%
                        </div>
                    </div>
                    <div className="tabular-nums text-xs pt-1.5 border-t border-[var(--color-rule)] flex items-center justify-between">
                        <span className="text-[var(--color-neutral)] text-xs">ขาดอีก:</span>
                        <span className="text-[var(--color-ink)] font-bold">฿{remainingToTarget.toLocaleString()}</span>
                    </div>
                </div>

                {/* Cell 6: Velocity & Forecast Close */}
                <div className="p-4 flex flex-col justify-between space-y-2 bg-[var(--color-paper-2)]">
                    <div className="flex items-center justify-between text-xs tabular-nums text-[var(--color-muted)]">
                        <span className="font-bold text-[var(--color-ink)]">VELOCITY</span>
                        <span className="text-[11px] px-1 bg-[var(--color-ink)] text-[var(--color-paper)] font-bold">
                            {currentHourStr}
                        </span>
                    </div>
                    <div>
                        <div className=" text-xl sm:text-2xl font-bold tracking-tight text-[var(--brand-plum)] tabular-nums">
                            ฿{Math.round(currentVelocityPerHour).toLocaleString()} <span className="text-xs font-normal text-[var(--color-muted)]">{velocityUnit}</span>
                        </div>
                    </div>
                    <div className="tabular-nums text-xs pt-1.5 border-t border-[var(--color-rule)] flex items-center justify-between">
                        <span className="text-[var(--color-neutral)] text-xs">Forecast:</span>
                        <span className="font-bold text-[var(--color-ink)]">≈ ฿{Math.round(forecastClose).toLocaleString()}</span>
                    </div>
                </div>

            </div>
        </div>
    )
}
