/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useMemo } from 'react'

/**
 * SmartAnomalyAlerts
 * Scans business metrics for critical operational red flags.
 * Prevents store owners from having to manually scrutinize 20 different graphs.
 */
export default function SmartAnomalyAlerts({
    foodCostPct = 30,
    foodCostTarget = 30,
    avgTicketGrowthPct = 0,
    currentAvgTicket = 308,
    deliveryFeeRatioPct = 0, // platform fee % of total sales
    daypartAnomalies = [],
    customAlerts = []
}) {
    const alerts = useMemo(() => {
        const list = []

        // 1. Food Cost Alert
        if (foodCostPct > foodCostTarget + 2.0) {
            list.push({
                id: 'food_cost_spike',
                severity: 'warning',
                code: 'COST_SPIKE',
                title: 'Food Cost สูงกว่าเกณฑ์ควบคุม',
                metric: `${foodCostPct.toFixed(1)}%`,
                diff: `+${(foodCostPct - foodCostTarget).toFixed(1)}% vs เป้า (${foodCostTarget}%)`,
                suggestion: 'ตรวจสอบสูตรการชั่งตวงวัตถุดิบครัว หรือของเสีย (Wastage) ประจำกะ'
            })
        }

        // 2. Avg Ticket Drop Alert
        const ticketDrop = parseFloat(avgTicketGrowthPct) || 0
        if (ticketDrop < -8.0) {
            list.push({
                id: 'ticket_drop',
                severity: 'warning',
                code: 'TICKET_DROP',
                title: 'ยอดเฉลี่ยต่อบิล (Avg Ticket) ลดลงผิดปกติ',
                metric: `฿${Math.round(currentAvgTicket).toLocaleString()}`,
                diff: `${ticketDrop.toFixed(1)}% vs ช่วงก่อนหน้า`,
                suggestion: 'แนะนำพนักงานหน้าร้านเชียร์เครื่องดื่ม/ของทานเล่น (Upsell) เพิ่มเติม'
            })
        }

        // 3. Delivery Fee / GP Platform Leak
        if (deliveryFeeRatioPct > 7.0) {
            list.push({
                id: 'delivery_fee_high',
                severity: 'info',
                code: 'PLATFORM_GP',
                title: 'สัดส่วนค่าธรรมเนียม Platform สูง',
                metric: `${deliveryFeeRatioPct.toFixed(1)}%`,
                diff: 'ของยอดขายรวม',
                suggestion: 'ควรดันโปรโมชัน Walk-in หน้าร้าน หรือสั่งผ่าน LINE Official Direct'
            })
        }

        // 4. Daypart Anomalies
        if (daypartAnomalies && daypartAnomalies.length > 0) {
            daypartAnomalies.forEach((dp, idx) => {
                list.push({
                    id: `daypart_${idx}`,
                    severity: 'info',
                    code: 'DAYPART_PACE',
                    title: `${dp.name || 'ช่วงเวลา'} ยอดต่ำกว่าเกณฑ์เฉลี่ย`,
                    metric: dp.metric || 'ซบเซา',
                    diff: dp.diff || '-25%',
                    suggestion: dp.suggestion || 'พิจารณาจัดชุดเซตโปรโมชันกระตุ้นทราฟฟิกช่วง Off-Peak'
                })
            })
        }

        // 5. Append Custom or External Alerts
        if (customAlerts && customAlerts.length > 0) {
            list.push(...customAlerts)
        }

        return list
    }, [foodCostPct, foodCostTarget, avgTicketGrowthPct, currentAvgTicket, deliveryFeeRatioPct, daypartAnomalies, customAlerts])

    return (
        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)]">
            {/* Header */}
            <div className="p-3 bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] flex items-center justify-between font-mono text-xs">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[oklch(52%_0.16_28)] animate-pulse"></span>
                    <span className="font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider">
                        OPERATIONAL ALERTS // ระบบเฝ้าระวังความผิดปกติ
                    </span>
                </div>
                <span className="text-[10px] text-[oklch(42%_0.010_28)] font-mono">
                    {alerts.length === 0 ? 'STATUS: NORMAL' : `ตรวจพบ ${alerts.length} รายการ`}
                </span>
            </div>

            {/* Content List */}
            <div className="p-4 space-y-3 font-mono text-xs">
                {alerts.length === 0 ? (
                    <div className="py-6 text-center text-[oklch(45%_0.08_140)] font-mono font-bold text-xs">
                        [ALL NORMAL] ตัวแปรการดำเนินงานทั้งหมดอยู่ในเกณฑ์ควบคุมปกติ
                    </div>
                ) : (
                    alerts.map(item => (
                        <div 
                            key={item.id}
                            className="p-3 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]">
                                        {item.code}
                                    </span>
                                    <span className="font-bold text-[oklch(18%_0.012_28)]">
                                        {item.title}
                                    </span>
                                </div>
                                <p className="text-[11px] text-[oklch(42%_0.010_28)] font-sans">
                                    → {item.suggestion}
                                </p>
                            </div>

                            <div className="text-right whitespace-nowrap pl-4 border-l border-[oklch(85%_0.012_28)]">
                                <div className="text-sm font-bold text-[oklch(52%_0.16_28)] tabular-nums">
                                    {item.metric}
                                </div>
                                <div className="text-[10px] text-[oklch(55%_0.010_28)]">
                                    {item.diff}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
