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
        <div className="border border-[var(--color-rule)] bg-[var(--color-paper)]">
            
            {/* Header */}
            <div className="p-3 bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] flex items-center justify-between tabular-nums text-xs">
                <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.2 text-[11px] font-bold bg-[var(--color-ink)] text-[var(--color-paper)]">
                        DRIVERS
                    </span>
                    <span className="font-bold text-[var(--color-ink)]  ">
                        SALES DRIVERS // เมนูขับเคลื่อนยอดขาย
                    </span>
                </div>
                {onViewAllMenu && (
                    <button
                        type="button"
                        onClick={onViewAllMenu}
                        className="text-xs underline hover:text-[var(--color-ink)] text-[var(--color-muted)] cursor-pointer"
                    >
                        ดูทั้งหมด ({items?.length || 0}) →
                    </button>
                )}
            </div>

            {/* Table Header Strip */}
            <div className="grid grid-cols-12 px-4 py-2 bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] tabular-nums text-xs text-[var(--color-muted)] ">
                <div className="col-span-1">#</div>
                <div className="col-span-5">รายการเมนู</div>
                <div className="col-span-2 text-right">จำนวน</div>
                <div className="col-span-2 text-right">ยอดขาย (แชร์)</div>
                <div className="col-span-2 text-right">Margin / บิล</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-[var(--color-rule)] tabular-nums text-xs">
                {topItems.length === 0 ? (
                    <div className="p-6 text-center text-[var(--color-neutral)]">
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
                                className="grid grid-cols-12 px-4 py-2.5 items-center hover:bg-[var(--color-paper-2)] transition-colors"
                            >
                                <div className="col-span-1 text-[var(--color-neutral)] font-bold">
                                    {String(idx + 1).padStart(2, '0')}
                                </div>
                                <div className="col-span-5 truncate pr-2 font-sans font-medium text-[var(--color-ink)]">
                                    {item.name || item.custom_name || 'เมนูทั่วไป'}
                                </div>
                                <div className="col-span-2 text-right text-[var(--color-muted)] tabular-nums">
                                    {units} <span className="text-xs text-[var(--color-neutral)]">จาน</span>
                                </div>
                                <div className="col-span-2 text-right tabular-nums">
                                    <span className="font-bold text-[var(--color-ink)]">฿{revenue.toLocaleString()}</span>
                                    <span className="text-xs text-[var(--color-neutral)] block">{sharePct}%</span>
                                </div>
                                <div className="col-span-2 text-right tabular-nums">
                                    <span className="font-bold text-[oklch(45%_0.08_140)]">~{marginPct}%</span>
                                    <span className="text-xs text-[var(--color-neutral)] block">{attachRate}% บิล</span>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
