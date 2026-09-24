/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React from 'react'

/**
 * SalesDriversTable
 * Level 3: What is Driving Sales?
 * Displays Top 5-10 Products with Sales, Qty, Gross Margin %, and % of Orders (Attach Rate).
 */
export default function SalesDriversTable({
    items = [],
    totalSales = 0,
    totalOrders = 1,
    onViewAllMenu = null
}) {
    // Take top 6 items
    const topItems = (items || []).slice(0, 6)

    return (
        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)]">
            
            {/* Header */}
            <div className="p-3 bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] flex items-center justify-between font-mono text-xs">
                <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]">
                        DRIVERS
                    </span>
                    <span className="font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider">
                        SALES DRIVERS // เมนูขับเคลื่อนยอดขาย
                    </span>
                </div>
                {onViewAllMenu && (
                    <button
                        type="button"
                        onClick={onViewAllMenu}
                        className="text-[11px] underline hover:text-[oklch(18%_0.012_28)] text-[oklch(42%_0.010_28)] cursor-pointer"
                    >
                        ดูทั้งหมด ({items?.length || 0}) →
                    </button>
                )}
            </div>

            {/* Table Header Strip */}
            <div className="grid grid-cols-12 px-4 py-2 bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] font-mono text-[10px] text-[oklch(42%_0.010_28)] uppercase">
                <div className="col-span-1">#</div>
                <div className="col-span-5">รายการเมนู</div>
                <div className="col-span-2 text-right">จำนวน</div>
                <div className="col-span-2 text-right">ยอดขาย (แชร์)</div>
                <div className="col-span-2 text-right">Margin / บิล</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-[oklch(85%_0.012_28)] font-mono text-xs">
                {topItems.length === 0 ? (
                    <div className="p-6 text-center text-[oklch(55%_0.010_28)]">
                        ยังไม่มีข้อมูลออเดอร์ในรอบนี้
                    </div>
                ) : (
                    topItems.map((item, idx) => {
                        const revenue = item.revenue || ((item.units || 1) * (item.price || 0))
                        const sharePct = totalSales > 0 ? ((revenue / totalSales) * 100).toFixed(1) : 0
                        const units = item.units || item.quantity || 1
                        const attachRate = totalOrders > 0 ? Math.min(100, Math.round((units / totalOrders) * 100)) : 0
                        const marginPct = item.estMarginPct || (item.category === 'drink' ? 78 : item.category === 'alcohol' ? 52 : 65)

                        return (
                            <div 
                                key={item.id || idx}
                                className="grid grid-cols-12 px-4 py-2.5 items-center hover:bg-[oklch(94%_0.010_28)] transition-colors"
                            >
                                <div className="col-span-1 text-[oklch(55%_0.010_28)] font-bold">
                                    {String(idx + 1).padStart(2, '0')}
                                </div>
                                <div className="col-span-5 truncate pr-2 font-sans font-medium text-[oklch(18%_0.012_28)]">
                                    {item.name || item.custom_name || 'เมนูทั่วไป'}
                                </div>
                                <div className="col-span-2 text-right text-[oklch(42%_0.010_28)] tabular-nums">
                                    {units} <span className="text-[10px] text-[oklch(55%_0.010_28)]">จาน</span>
                                </div>
                                <div className="col-span-2 text-right tabular-nums">
                                    <span className="font-bold text-[oklch(18%_0.012_28)]">฿{revenue.toLocaleString()}</span>
                                    <span className="text-[10px] text-[oklch(55%_0.010_28)] block">{sharePct}%</span>
                                </div>
                                <div className="col-span-2 text-right tabular-nums">
                                    <span className="font-bold text-[oklch(45%_0.08_140)]">~{marginPct}%</span>
                                    <span className="text-[10px] text-[oklch(55%_0.010_28)] block">{attachRate}% บิล</span>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
