/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useMemo } from 'react'

/**
 * TrafficAndVelocityDuo
 * Level 5: Traffic (Guests/Hour) vs Sales Velocity (฿/Hour)
 * Decoupled twin sparkbars + Conversion & Seat Utilization indicators.
 */
export default function TrafficAndVelocityDuo({
    hourlyData = [], // array of { hour, guests, amount, bills }
    totalGuests = 23,
    totalOrders = 23,
    walkInEstimates = 28, // estimated traffic
    totalSeats = 45,
    currentHour = 19
}) {
    // Generate clean 11:00 - 23:00 timeline
    const timeline = useMemo(() => {
        const slots = []
        for (let h = 11; h <= 23; h++) {
            const found = (hourlyData || []).find(d => d.hour === h)
            slots.push({
                hour: h,
                guests: found ? (found.guests || found.pax || 0) : 0,
                amount: found ? (found.amount || found.gross || 0) : 0,
                bills: found ? (found.bills || 0) : 0,
                isCurrent: h === currentHour
            })
        }
        return slots
    }, [hourlyData, currentHour])

    const maxGuests = useMemo(() => {
        const list = timeline.map(t => t.guests)
        return Math.max(...list, 8)
    }, [timeline])

    const maxAmount = useMemo(() => {
        const list = timeline.map(t => t.amount)
        return Math.max(...list, 1500)
    }, [timeline])

    // Peak seats in any single hour
    const peakSeatsOccupied = useMemo(() => {
        const list = timeline.map(t => t.guests)
        return Math.max(...list, 0)
    }, [timeline])

    const conversionPct = walkInEstimates > 0 ? Math.min(100, Math.round((totalOrders / walkInEstimates) * 100)) : 0
    const seatUtilPct = totalSeats > 0 ? Math.min(100, Math.round((peakSeatsOccupied / totalSeats) * 100)) : 0

    return (
        <div className="border border-[var(--color-rule)] bg-[var(--color-paper)]">
            
            {/* Header with Operational Indicators */}
            <div className="p-3 bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] flex flex-wrap items-center justify-between gap-3 tabular-nums text-xs">
                <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.2 text-[11px] font-bold bg-[var(--color-ink)] text-[var(--color-paper)]">
                        FLOW
                    </span>
                    <span className="font-bold text-[var(--color-ink)]  ">
                        TRAFFIC & SALES VELOCITY // คนเข้าร้านคู่ขนานความเร็วยอดขาย
                    </span>
                </div>

                {/* Live Operational Metrics */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-[var(--color-muted)]">CONVERSION:</span>
                        <span className="font-bold text-[var(--color-ink)] tabular-nums">
                            {totalOrders} / {walkInEstimates || totalGuests} ({conversionPct}%)
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs border-l border-[var(--color-rule)] pl-3">
                        <span className="text-[var(--color-muted)]">SEAT PEAK:</span>
                        <span className="font-bold text-[var(--brand-plum)] tabular-nums">
                            {peakSeatsOccupied} / {totalSeats} ที่นั่ง ({seatUtilPct}%)
                        </span>
                    </div>
                </div>
            </div>

            {/* Twin Timeline Strips */}
            <div className="p-4 space-y-4">
                
                {/* 1. TRAFFIC: GUESTS / HOUR */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between tabular-nums text-xs text-[var(--color-muted)]">
                        <span className="font-bold text-[var(--color-ink)]">
                            01 // TRAFFIC (GUESTS / HOUR · จำนวนลูกค้าเข้าร้าน)
                        </span>
                        <span>รวม {totalGuests} ท่าน</span>
                    </div>
                    <div className="overflow-x-auto pb-1">
                        <div className="grid grid-cols-[repeat(13,minmax(38px,1fr))] min-w-[520px] gap-1 bg-[var(--color-paper-2)] p-2 border border-[var(--color-rule)] tabular-nums text-center">
                            {timeline.map(slot => (
                                <div key={`traffic_${slot.hour}`} className="space-y-1">
                                    <div className="text-xs text-[var(--color-neutral)]">{slot.hour}</div>
                                    <div 
                                        className={`py-1 text-xs font-bold tabular-nums transition-colors ${
                                            slot.guests > 0 
                                                ? slot.isCurrent 
                                                    ? 'bg-[var(--brand-plum)] text-[var(--color-paper)]' 
                                                    : 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                                                : 'text-[oklch(75%_0.01_348.33)]'
                                        }`}
                                    >
                                        {slot.guests || '-'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 2. SALES VELOCITY: ฿ / HOUR */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between tabular-nums text-xs text-[var(--color-muted)]">
                        <span className="font-bold text-[var(--color-ink)]">
                            02 // SALES VELOCITY (ยอดขายรายชั่วโมง ฿ / HOUR)
                        </span>
                        <span className="text-[var(--color-neutral)]">ความเร็วยอดขายรายชั่วโมง</span>
                    </div>
                    <div className="overflow-x-auto pb-1">
                        <div className="grid grid-cols-[repeat(13,minmax(38px,1fr))] min-w-[520px] gap-1 bg-[var(--color-paper-2)] p-2 border border-[var(--color-rule)] tabular-nums text-center">
                            {timeline.map(slot => (
                                <div key={`sales_${slot.hour}`} className="space-y-1">
                                    <div className="text-xs text-[var(--color-neutral)]">{slot.hour}</div>
                                    <div 
                                        className={`py-1 text-xs font-bold tabular-nums truncate px-0.5 transition-colors ${
                                            slot.amount > 0 
                                                ? slot.isCurrent 
                                                    ? 'bg-[var(--brand-plum)] text-[var(--color-paper)]' 
                                                    : 'bg-[oklch(45%_0.08_140)] text-[var(--color-paper)]'
                                                : 'text-[oklch(75%_0.01_348.33)]'
                                        }`}
                                    >
                                        {slot.amount > 0 ? `฿${Math.round(slot.amount)}` : '-'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
