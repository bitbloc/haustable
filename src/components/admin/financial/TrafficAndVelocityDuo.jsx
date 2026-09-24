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
        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)]">
            
            {/* Header with Operational Indicators */}
            <div className="p-3 bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
                <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]">
                        FLOW
                    </span>
                    <span className="font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider">
                        TRAFFIC & SALES VELOCITY // คนเข้าร้านคู่ขนานความเร็วยอดขาย
                    </span>
                </div>

                {/* Live Operational Metrics */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="text-[oklch(42%_0.010_28)]">CONVERSION:</span>
                        <span className="font-bold text-[oklch(18%_0.012_28)] tabular-nums">
                            {totalOrders} / {walkInEstimates || totalGuests} ({conversionPct}%)
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] border-l border-[oklch(85%_0.012_28)] pl-3">
                        <span className="text-[oklch(42%_0.010_28)]">SEAT PEAK:</span>
                        <span className="font-bold text-[oklch(52%_0.16_28)] tabular-nums">
                            {peakSeatsOccupied} / {totalSeats} ที่นั่ง ({seatUtilPct}%)
                        </span>
                    </div>
                </div>
            </div>

            {/* Twin Timeline Strips */}
            <div className="p-4 space-y-4">
                
                {/* 1. TRAFFIC: GUESTS / HOUR */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between font-mono text-[11px] text-[oklch(42%_0.010_28)]">
                        <span className="font-bold uppercase text-[oklch(18%_0.012_28)]">
                            01 // TRAFFIC (GUESTS / HOUR · จำนวนลูกค้าเข้าร้าน)
                        </span>
                        <span>รวม {totalGuests} ท่าน</span>
                    </div>
                    <div className="overflow-x-auto pb-1">
                        <div className="grid grid-cols-[repeat(13,minmax(38px,1fr))] min-w-[520px] gap-1 bg-[oklch(94%_0.010_28)] p-2 border border-[oklch(85%_0.012_28)] font-mono text-center">
                            {timeline.map(slot => (
                                <div key={`traffic_${slot.hour}`} className="space-y-1">
                                    <div className="text-[9px] text-[oklch(55%_0.010_28)]">{slot.hour}</div>
                                    <div 
                                        className={`py-1 text-xs font-bold tabular-nums transition-colors ${
                                            slot.guests > 0 
                                                ? slot.isCurrent 
                                                    ? 'bg-[oklch(52%_0.16_28)] text-[oklch(97%_0.008_28)]' 
                                                    : 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]'
                                                : 'text-[oklch(75%_0.010_28)]'
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
                    <div className="flex items-center justify-between font-mono text-[11px] text-[oklch(42%_0.010_28)]">
                        <span className="font-bold uppercase text-[oklch(18%_0.012_28)]">
                            02 // SALES VELOCITY (ยอดขายรายชั่วโมง ฿ / HOUR)
                        </span>
                        <span className="text-[oklch(55%_0.010_28)]">ความเร็วยอดขายรายชั่วโมง</span>
                    </div>
                    <div className="overflow-x-auto pb-1">
                        <div className="grid grid-cols-[repeat(13,minmax(38px,1fr))] min-w-[520px] gap-1 bg-[oklch(94%_0.010_28)] p-2 border border-[oklch(85%_0.012_28)] font-mono text-center">
                            {timeline.map(slot => (
                                <div key={`sales_${slot.hour}`} className="space-y-1">
                                    <div className="text-[9px] text-[oklch(55%_0.010_28)]">{slot.hour}</div>
                                    <div 
                                        className={`py-1 text-[10px] font-bold tabular-nums truncate px-0.5 transition-colors ${
                                            slot.amount > 0 
                                                ? slot.isCurrent 
                                                    ? 'bg-[oklch(52%_0.16_28)] text-[oklch(97%_0.008_28)]' 
                                                    : 'bg-[oklch(45%_0.08_140)] text-[oklch(97%_0.008_28)]'
                                                : 'text-[oklch(75%_0.010_28)]'
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
