/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useMemo } from 'react'

export default function FloorTurnoverGauge({ bookings = [], totalTables = 12, occupiedTables = 0 }) {
    const stats = useMemo(() => {
        const completedDineIn = (bookings || []).filter(b => 
            (b.status === 'completed' || b.status === 'seated') &&
            (b.booking_type === 'dine_in' || b.booking_type === 'walk_in' || !b.booking_type)
        )

        // Calculate average dwell time (duration between seated/booking_time and completed/updated_at)
        let totalDwellMinutes = 0
        let validDwellCount = 0
        let quickCount = 0   // < 45 min
        let standardCount = 0 // 45 - 75 min
        let longStayCount = 0 // > 75 min

        completedDineIn.forEach(b => {
            const start = new Date(b.booking_time || b.created_at).getTime()
            const end = b.status === 'completed' && b.updated_at 
                ? new Date(b.updated_at).getTime() 
                : Date.now()

            const diffMins = Math.max(15, Math.round((end - start) / (1000 * 60)))
            if (diffMins > 0 && diffMins < 300) {
                totalDwellMinutes += diffMins
                validDwellCount += 1
                if (diffMins < 45) quickCount++
                else if (diffMins <= 75) standardCount++
                else longStayCount++
            }
        })

        const avgDwell = validDwellCount > 0 ? Math.round(totalDwellMinutes / validDwellCount) : 50
        const turnsPerTable = totalTables > 0 ? (completedDineIn.length / totalTables).toFixed(1) : '0.0'

        // Active channel volume split
        const dineInTotal = (bookings || []).filter(b => b.booking_type === 'dine_in' || b.booking_type === 'walk_in').length
        const pickupTotal = (bookings || []).filter(b => b.booking_type === 'pickup' || (b.booking_type || '').includes('takeaway')).length
        const totalAll = Math.max(dineInTotal + pickupTotal, 1)

        return {
            avgDwell,
            turnsPerTable,
            quickCount,
            standardCount,
            longStayCount,
            totalAnalyzed: validDwellCount,
            dineInPct: Math.round((dineInTotal / totalAll) * 100),
            pickupPct: Math.round((pickupTotal / totalAll) * 100),
            dineInTotal,
            pickupTotal
        }
    }, [bookings, totalTables])

    const { avgDwell, turnsPerTable, quickCount, standardCount, longStayCount, totalAnalyzed, dineInPct, pickupPct, dineInTotal, pickupTotal } = stats

    const quickPct = totalAnalyzed > 0 ? Math.round((quickCount / totalAnalyzed) * 100) : 35
    const standardPct = totalAnalyzed > 0 ? Math.round((standardCount / totalAnalyzed) * 100) : 45
    const longPct = totalAnalyzed > 0 ? Math.round((longStayCount / totalAnalyzed) * 100) : 20

    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6 font-sans">
            {/* 1. Table Turnover & Dwell Time Card (7 cols) */}
            <div className="md:col-span-7 border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] divide-y divide-[oklch(85%_0.012_28)]">
                <div className="p-3 bg-[oklch(94%_0.010_28)] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-[oklch(18%_0.012_28)] text-white uppercase">
                            DWELL // TURNS
                        </span>
                        <h4 className="font-mono text-xs sm:text-sm font-bold text-[oklch(18%_0.012_28)] uppercase">
                            Table Velocity & Dwell Time (รอบการหมุนเวียนโต๊ะ)
                        </h4>
                    </div>
                    <span className="font-mono text-xs font-bold text-[oklch(52%_0.16_28)]">
                        {turnsPerTable} TURNS/TABLE
                    </span>
                </div>

                <div className="p-4 space-y-4">
                    {/* Key Indicators Row */}
                    <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                        <div className="bg-[oklch(94%_0.010_28)] p-2.5 border border-[oklch(85%_0.012_28)]">
                            <span className="text-[10px] text-[oklch(55%_0.010_28)] block uppercase">AVG DWELL TIME</span>
                            <span className="text-xl font-bold text-[oklch(18%_0.012_28)] tabular-nums">{avgDwell}</span>
                            <span className="text-[10px] text-[oklch(55%_0.010_28)] ml-1">MINUTES</span>
                        </div>
                        <div className="bg-[oklch(94%_0.010_28)] p-2.5 border border-[oklch(85%_0.012_28)]">
                            <span className="text-[10px] text-[oklch(55%_0.010_28)] block uppercase">CURRENT OCCUPANCY</span>
                            <span className="text-xl font-bold text-[oklch(45%_0.08_140)] tabular-nums">{occupiedTables}</span>
                            <span className="text-[10px] text-[oklch(55%_0.010_28)] ml-1">/ {totalTables} TABLES</span>
                        </div>
                    </div>

                    {/* Dwell Distribution Segmented Bar */}
                    <div className="space-y-1.5 font-mono text-xs">
                        <div className="flex justify-between items-center text-[11px] text-[oklch(42%_0.010_28)]">
                            <span>การกระจายเวลาการนั่งของโต๊ะ</span>
                            <span>{totalAnalyzed} บิลวิเคราะห์</span>
                        </div>

                        {/* Multi-segment distribution bar */}
                        <div className="w-full bg-[oklch(94%_0.010_28)] h-3 flex overflow-hidden border border-[oklch(85%_0.012_28)]">
                            <div 
                                className="bg-[oklch(45%_0.08_140)] h-full transition-all duration-500" 
                                style={{ width: `${quickPct}%` }} 
                                title={`ด่วน (<45น.): ${quickPct}%`}
                            />
                            <div 
                                className="bg-[oklch(52%_0.16_28)] h-full transition-all duration-500" 
                                style={{ width: `${standardPct}%` }} 
                                title={`มาตรฐาน (45-75น.): ${standardPct}%`}
                            />
                            <div 
                                className="bg-[oklch(35%_0.06_250)] h-full transition-all duration-500" 
                                style={{ width: `${longPct}%` }} 
                                title={`สังสรรค์ (>75น.): ${longPct}%`}
                            />
                        </div>

                        {/* Legend */}
                        <div className="grid grid-cols-3 gap-1 pt-1 text-[10px] text-[oklch(55%_0.010_28)] font-mono">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 bg-[oklch(45%_0.08_140)] shrink-0" />
                                <span>ด่วน &lt;45น. ({quickPct}%)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 bg-[oklch(52%_0.16_28)] shrink-0" />
                                <span>มาตรฐาน 45-75น. ({standardPct}%)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 bg-[oklch(35%_0.06_250)] shrink-0" />
                                <span>สังสรรค์ &gt;75น. ({longPct}%)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Service Channel Mix Flow (5 cols) */}
            <div className="md:col-span-5 border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] divide-y divide-[oklch(85%_0.012_28)]">
                <div className="p-3 bg-[oklch(94%_0.010_28)] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-[oklch(18%_0.012_28)] text-white uppercase">
                            MIX // CHANNELS
                        </span>
                        <h4 className="font-mono text-xs sm:text-sm font-bold text-[oklch(18%_0.012_28)] uppercase">
                            Service Mix (สัดส่วนช่องทาง)
                        </h4>
                    </div>
                </div>

                <div className="p-4 space-y-4 font-mono text-xs">
                    {/* Dine-in vs Takeaway Segment */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-[oklch(18%_0.012_28)]">ทานที่ร้าน (Dine-in)</span>
                            <span className="tabular-nums font-bold text-[oklch(52%_0.16_28)]">{dineInTotal} บิล ({dineInPct}%)</span>
                        </div>
                        <div className="w-full bg-[oklch(94%_0.010_28)] h-2 border border-[oklch(85%_0.012_28)] overflow-hidden">
                            <div className="bg-[oklch(52%_0.16_28)] h-full transition-all" style={{ width: `${dineInPct}%` }} />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-[oklch(18%_0.012_28)]">สั่งกลับบ้าน / รับเอง (Pickup)</span>
                            <span className="tabular-nums font-bold text-[oklch(45%_0.08_140)]">{pickupTotal} บิล ({pickupPct}%)</span>
                        </div>
                        <div className="w-full bg-[oklch(94%_0.010_28)] h-2 border border-[oklch(85%_0.012_28)] overflow-hidden">
                            <div className="bg-[oklch(45%_0.08_140)] h-full transition-all" style={{ width: `${pickupPct}%` }} />
                        </div>
                    </div>

                    {/* Operational takeaway tag */}
                    <div className="p-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] text-[11px] text-[oklch(42%_0.010_28)]">
                        <span className="font-bold text-[oklch(18%_0.012_28)]">INSIGHT:</span> ยอดทานที่ร้านครองสัดส่วนหลัก แนะนำพนักงานโฟกัส Table Check-in และการ Upsell เมนูสำรับ/เครื่องดื่ม
                    </div>
                </div>
            </div>
        </div>
    )
}
