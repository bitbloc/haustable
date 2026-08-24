/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState } from 'react'

export default function DetailedSalesSummary({ data, timeRangeLabel }) {
    const [hoveredHour, setHoveredHour] = useState(null)

    const paymentMethods = data?.paymentMethods || [
        { name: 'PromptPay QR', amount: 0, percent: 0, count: 0, code: 'QR' },
        { name: 'Credit / Debit Card', amount: 0, percent: 0, count: 0, code: 'CC' },
        { name: 'Cash (เงินสด)', amount: 0, percent: 0, count: 0, code: 'CSH' },
        { name: 'Member Wallet', amount: 0, percent: 0, count: 0, code: 'WAL' },
    ]

    const diningChannels = data?.diningChannels || [
        { name: 'Dine-In (ทานที่ร้าน / จองโต๊ะ)', amount: 0, percent: 0, tables: 0, avgPerTable: 0, code: 'DINE_IN' },
        { name: 'Takeaway / Pickup (รับกลับบ้าน)', amount: 0, percent: 0, orders: 0, avgPerOrder: 0, code: 'PICKUP' },
    ]

    const auditReconciliation = data?.auditReconciliation || {
        grossSales: 0,
        totalDiscounts: 0,
        discountCount: 0,
        taxableSubtotal: 0,
        netPayable: 0,
        avgTicket: 0,
        totalExpenses: 0,
        netOperatingIncome: 0,
    }

    const hourlyVelocity = data?.hourlyVelocity || []

    // Calculate max hourly revenue for graph scaling
    const maxHourlyGross = Math.max(...hourlyVelocity.map(h => h.gross || 0), 100)
    const peakHourData = hourlyVelocity.reduce((max, h) => (h.gross > (max?.gross || 0) ? h : max), null)

    return (
        <div className="space-y-6 text-[oklch(18%_0.012_28)] font-sans">
            
            {/* 1. Hourly Sales Velocity Visualizer (SVG Matrix Graph) */}
            <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] divide-y divide-[oklch(85%_0.012_28)]">
                
                {/* Header */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[oklch(94%_0.010_28)]">
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] uppercase">
                            VELOCITY // HOURLY
                        </span>
                        <h4 className="font-bold text-sm md:text-base text-[oklch(18%_0.012_28)]">
                            ความเร็วของยอดขายรายชั่วโมง (Hourly Sales Velocity)
                        </h4>
                    </div>
                    {peakHourData && peakHourData.gross > 0 && (
                        <span className="font-mono text-xs font-bold text-[oklch(52%_0.16_28)] bg-[oklch(97%_0.008_28)] border border-[oklch(52%_0.16_28)]/40 px-2.5 py-0.5">
                            PEAK: {peakHourData.hour} (฿{peakHourData.gross.toLocaleString()})
                        </span>
                    )}
                </div>

                {/* SVG Visual Bars */}
                <div className="p-4 md:p-6 bg-[oklch(97%_0.008_28)]">
                    <div className="grid grid-cols-12 md:grid-cols-14 gap-2 items-end h-44 pt-6 px-1">
                        {hourlyVelocity.map((h, idx) => {
                            const heightPct = Math.max(4, Math.round((h.gross / maxHourlyGross) * 100))
                            const isPeak = peakHourData?.hour === h.hour && h.gross > 0
                            const isHovered = hoveredHour === h.hour

                            return (
                                <div
                                    key={idx}
                                    onMouseEnter={() => setHoveredHour(h.hour)}
                                    onMouseLeave={() => setHoveredHour(null)}
                                    className="flex flex-col items-center h-full justify-end group relative cursor-pointer"
                                >
                                    {/* Tooltip on Hover */}
                                    {isHovered && (
                                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-20 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] text-[10px] font-mono px-2 py-1 border border-[oklch(85%_0.012_28)] whitespace-nowrap pointer-events-none text-center">
                                            <div className="font-bold text-[oklch(97%_0.008_28)]">฿{h.gross.toLocaleString()}</div>
                                            <div className="text-[oklch(85%_0.012_28)] text-[9px]">{h.bills} บิล // {h.hour}</div>
                                        </div>
                                    )}

                                    {/* Bar Element */}
                                    <div className="w-full flex justify-center items-end h-full">
                                        <div
                                            style={{ height: `${heightPct}%` }}
                                            className={`w-full max-w-[28px] transition-all duration-300 ${
                                                isPeak
                                                    ? 'bg-[oklch(52%_0.16_28)]'
                                                    : h.gross > 0
                                                    ? 'bg-[oklch(85%_0.012_28)] group-hover:bg-[oklch(52%_0.16_28)]'
                                                    : 'bg-[oklch(94%_0.010_28)]'
                                            }`}
                                        />
                                    </div>

                                    {/* Hour Label */}
                                    <span className={`text-[10px] font-mono mt-2 font-bold truncate max-w-full ${
                                        isPeak ? 'text-[oklch(52%_0.16_28)]' : 'text-[oklch(42%_0.010_28)]'
                                    }`}>
                                        {h.hour?.split(':')[0] || idx}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* 2. Grid Row: Settlement & Dining Channels Matrix */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Payment Methods Breakdown (7 cols) */}
                <div className="lg:col-span-7 border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] divide-y divide-[oklch(85%_0.012_28)]">
                    <div className="p-4 bg-[oklch(94%_0.010_28)] flex items-center justify-between font-mono text-xs">
                        <span className="font-bold text-[oklch(18%_0.012_28)]">
                            PAYMENT METHODS // สรุปช่องทางชำระเงิน
                        </span>
                        <span className="font-bold text-[oklch(52%_0.16_28)] tabular-nums">
                            TOTAL: ฿{Math.ceil(paymentMethods.reduce((a,b)=>a+b.amount, 0)).toLocaleString()}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[oklch(85%_0.012_28)]">
                        {paymentMethods.map((pm, idx) => (
                            <div key={idx} className="p-4 space-y-2 bg-[oklch(97%_0.008_28)]">
                                <div className="flex items-center justify-between text-xs font-mono">
                                    <span className="font-bold text-[oklch(18%_0.012_28)] font-sans">{pm.name}</span>
                                    <span className="px-1.5 py-0.2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] font-bold">
                                        {pm.percent}%
                                    </span>
                                </div>

                                <div className="font-mono text-xl font-bold text-[oklch(18%_0.012_28)] tabular-nums">
                                    ฿{Math.ceil(pm.amount || 0).toLocaleString()}
                                </div>

                                <div className="flex justify-between items-center text-[11px] font-mono text-[oklch(42%_0.010_28)]">
                                    <span>{pm.count || 0} รายการ</span>
                                    <span>เฉลี่ย ฿{pm.count > 0 ? Math.round(pm.amount/pm.count) : 0}</span>
                                </div>

                                {/* Minimal Progress Rule */}
                                <div className="w-full bg-[oklch(94%_0.010_28)] h-1.5 overflow-hidden">
                                    <div className="bg-[oklch(52%_0.16_28)] h-1.5 transition-all duration-500" style={{ width: `${pm.percent || 0}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Dining Channels Share (5 cols) */}
                <div className="lg:col-span-5 border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] divide-y divide-[oklch(85%_0.012_28)]">
                    <div className="p-4 bg-[oklch(94%_0.010_28)] font-mono text-xs font-bold text-[oklch(18%_0.012_28)]">
                        DINING CHANNELS // สัดส่วนช่องทางขาย
                    </div>

                    <div className="divide-y divide-[oklch(85%_0.012_28)]">
                        {diningChannels.map((ch, idx) => (
                            <div key={idx} className="p-4 flex items-center justify-between bg-[oklch(97%_0.008_28)]">
                                <div>
                                    <div className="text-xs font-bold text-[oklch(18%_0.012_28)]">{ch.name}</div>
                                    <div className="text-[11px] font-mono text-[oklch(42%_0.010_28)] mt-0.5">
                                        เฉลี่ย ฿{ch.avgPerTable || ch.avgPerOrder || 0} / ออเดอร์ ({ch.tables || ch.orders || 0} ครั้ง)
                                    </div>
                                </div>
                                <div className="text-right font-mono">
                                    <div className="text-base font-bold text-[oklch(18%_0.012_28)] tabular-nums">
                                        ฿{Math.ceil(ch.amount).toLocaleString()}
                                    </div>
                                    <div className="text-[11px] text-[oklch(52%_0.16_28)] font-bold">
                                        {ch.percent}% of total
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 3. Grid Row: Balanced Financial Reconciliation & Hourly Audit Table */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Financial Reconciliation Statement (5 cols) */}
                <div className="lg:col-span-5 border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] divide-y divide-[oklch(85%_0.012_28)]">
                    <div className="p-4 bg-[oklch(94%_0.010_28)] font-mono text-xs font-bold text-[oklch(18%_0.012_28)]">
                        STATEMENT // ตารางกระทบยอดรายได้และค่าใช้จ่ายจริง
                    </div>

                    <div className="p-4 space-y-3 font-mono text-xs">
                        <div className="flex justify-between items-baseline py-1">
                            <span className="text-[oklch(42%_0.010_28)] font-sans">ยอดขายรวมก่อนหักส่วนลด (Gross Sales)</span>
                            <span className="font-bold text-sm text-[oklch(18%_0.012_28)] tabular-nums">
                                ฿{Math.ceil(auditReconciliation.grossSales).toLocaleString()}
                            </span>
                        </div>

                        <div className="flex justify-between items-baseline py-1 text-[oklch(52%_0.16_28)] border-t border-dashed border-[oklch(85%_0.012_28)]">
                            <span className="font-sans">หัก: ส่วนลดรวมจริง ({auditReconciliation.discountCount} รายการ)</span>
                            <span className="font-bold tabular-nums">
                                -฿{Math.ceil(auditReconciliation.totalDiscounts).toLocaleString()}
                            </span>
                        </div>

                        <div className="flex justify-between items-baseline py-1.5 border-t border-[oklch(85%_0.012_28)] font-bold text-[oklch(18%_0.012_28)]">
                            <span className="font-sans">ยอดขายสุทธิที่รับชำระ (Net Revenue)</span>
                            <span className="text-base tabular-nums">
                                ฿{Math.ceil(auditReconciliation.netPayable).toLocaleString()}
                            </span>
                        </div>

                        <div className="flex justify-between items-baseline py-1 text-[oklch(42%_0.010_28)] border-t border-dashed border-[oklch(85%_0.012_28)]">
                            <span className="font-sans">หัก: รายจ่ายร้านที่บันทึกจริง (Store Expenses)</span>
                            <span className="font-bold tabular-nums">
                                -฿{Math.ceil(auditReconciliation.totalExpenses).toLocaleString()}
                            </span>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] mt-4">
                            <span className="font-bold font-sans">กำไรจากการดำเนินงาน (Operating Profit)</span>
                            <span className="font-mono text-lg font-bold tabular-nums text-[oklch(97%_0.008_28)]">
                                ฿{Math.ceil(auditReconciliation.netOperatingIncome).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Hourly Velocity Table (7 cols) */}
                <div className="lg:col-span-7 border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] divide-y divide-[oklch(85%_0.012_28)]">
                    <div className="p-4 bg-[oklch(94%_0.010_28)] flex items-center justify-between font-mono text-xs">
                        <span className="font-bold text-[oklch(18%_0.012_28)]">
                            HOURLY LOG // สถิติรายชั่วโมง
                        </span>
                        <span className="text-[oklch(42%_0.010_28)]">
                            AVG ฿{auditReconciliation.avgTicket} / บิล
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left font-mono text-xs min-w-[500px]">
                            <thead>
                                <tr className="bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] text-[oklch(42%_0.010_28)] text-[11px] font-bold uppercase">
                                    <th className="p-3 border-r border-[oklch(85%_0.012_28)]">ช่วงเวลา</th>
                                    <th className="p-3 text-right border-r border-[oklch(85%_0.012_28)]">ยอดขาย (฿)</th>
                                    <th className="p-3 text-right border-r border-[oklch(85%_0.012_28)]">บิล</th>
                                    <th className="p-3 text-right border-r border-[oklch(85%_0.012_28)]">เฉลี่ย/บิล</th>
                                    <th className="p-3">เมนูเด่นประจำช่วง</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)]">
                                {hourlyVelocity.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-6 text-center text-[oklch(42%_0.010_28)] font-sans">
                                            ไม่มีสถิติรายชั่วโมงในช่วงเวลาที่เลือก
                                        </td>
                                    </tr>
                                ) : (
                                    hourlyVelocity.map((hv, idx) => (
                                        <tr key={idx} className="hover:bg-[oklch(94%_0.010_28)] transition-colors">
                                            <td className="p-3 font-bold border-r border-[oklch(85%_0.012_28)]">{hv.hour}</td>
                                            <td className="p-3 text-right font-bold text-[oklch(52%_0.16_28)] border-r border-[oklch(85%_0.012_28)] tabular-nums">
                                                ฿{Math.ceil(hv.gross).toLocaleString()}
                                            </td>
                                            <td className="p-3 text-right border-r border-[oklch(85%_0.012_28)] tabular-nums">{hv.bills}</td>
                                            <td className="p-3 text-right text-[oklch(42%_0.010_28)] border-r border-[oklch(85%_0.012_28)] tabular-nums">
                                                ฿{Math.ceil(hv.avgBill).toLocaleString()}
                                            </td>
                                            <td className="p-3 font-sans truncate max-w-[140px]">
                                                <span className="px-2 py-0.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] font-bold text-[11px]">
                                                    {hv.peakItem}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
