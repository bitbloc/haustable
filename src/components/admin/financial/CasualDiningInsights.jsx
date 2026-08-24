/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React from 'react'

export default function CasualDiningInsights({ data }) {
    const categoryRatio = data?.categoryRatio || {
        food: { percent: 0, revenue: 0, label: 'อาหารจานหลัก' },
        snack: { percent: 0, revenue: 0, label: 'ของทานเล่น' },
        set: { percent: 0, revenue: 0, label: 'ชุดเซตสำรับ' },
        dessert: { percent: 0, revenue: 0, label: 'ของหวาน' },
        beverage: { percent: 0, revenue: 0, label: 'เครื่องดื่ม' },
        alcohol: { percent: 0, revenue: 0, label: 'แอลกอฮอล์' }
    }

    const partySizeBreakdown = data?.partySizeBreakdown || [
        { size: 'Solo Diners (1 ท่าน)', share: 0, count: 0, avgSpend: 0, note: 'ออเดอร์จานเดี่ยว' },
        { size: 'Couples (2 ท่าน)', share: 0, count: 0, avgSpend: 0, note: 'เมนูคู่และเครื่องดื่ม' },
        { size: 'Medium Groups (3-4 ท่าน)', share: 0, count: 0, avgSpend: 0, note: 'ชุดเซตและเมนูแชร์' },
        { size: 'Large Parties (5+ ท่าน)', share: 0, count: 0, avgSpend: 0, note: 'โต๊ะรวมยอดสูง' },
    ]

    const casualMetrics = data?.casualMetrics || {
        tableTurnsPerDay: '0.0',
        totalOrders: 0,
        totalGuests: 0,
    }

    const catList = [
        { key: 'food', label: 'อาหารจานหลัก', color: 'bg-[oklch(52%_0.16_28)]', data: categoryRatio.food },
        { key: 'snack', label: 'ของทานเล่น', color: 'bg-[oklch(60%_0.14_45)]', data: categoryRatio.snack },
        { key: 'set', label: 'ชุดเซตสำรับ', color: 'bg-[oklch(50%_0.12_60)]', data: categoryRatio.set },
        { key: 'dessert', label: 'ของหวาน', color: 'bg-[oklch(65%_0.12_15)]', data: categoryRatio.dessert },
        { key: 'beverage', label: 'เครื่องดื่ม', color: 'bg-[oklch(45%_0.08_140)]', data: categoryRatio.beverage },
        { key: 'alcohol', label: 'แอลกอฮอล์ & เบียร์', color: 'bg-[oklch(35%_0.06_250)]', data: categoryRatio.alcohol },
    ]

    return (
        <div className="space-y-6 text-[oklch(18%_0.012_28)] font-sans">
            
            {/* 1. Header Toolbar */}
            <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] divide-y divide-[oklch(85%_0.012_28)]">
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[oklch(94%_0.010_28)]">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] uppercase">
                                INSIGHTS // OPERATIONS
                            </span>
                            <h3 className="font-bold text-base md:text-lg text-[oklch(18%_0.012_28)] tracking-tight">
                                สถิติการดำเนินงานร้านอาหาร (Casual Dining Insights)
                            </h3>
                        </div>
                        <p className="text-xs font-mono text-[oklch(42%_0.010_28)] mt-0.5">
                            วิเคราะห์สัดส่วนหมวดสินค้า พฤติกรรมกลุ่มลูกค้า และรอบการหมุนเวียนโต๊ะ
                        </p>
                    </div>

                    <div className="font-mono text-xs font-bold text-[oklch(18%_0.012_28)]">
                        รอบหมุนเวียน: {casualMetrics.tableTurnsPerDay} TURNS/TABLE
                    </div>
                </div>
            </div>

            {/* 2. Grid Row: 6-Category Revenue Split & Party Size Dynamics */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Category Revenue Split (6 cols) */}
                <div className="lg:col-span-6 border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] divide-y divide-[oklch(85%_0.012_28)]">
                    <div className="p-4 bg-[oklch(94%_0.010_28)] font-mono text-xs font-bold text-[oklch(18%_0.012_28)]">
                        CATEGORIES // สัดส่วนรายได้ 6 หมวดหมู่
                    </div>

                    <div className="p-4 space-y-4">
                        {/* Multi-segment Bar */}
                        <div className="w-full bg-[oklch(94%_0.010_28)] h-3 overflow-hidden flex border border-[oklch(85%_0.012_28)]">
                            {catList.map((cat) => (
                                <div
                                    key={cat.key}
                                    className={`${cat.color} h-3 transition-all duration-500`}
                                    style={{ width: `${cat.data?.percent || 0}%` }}
                                    title={`${cat.label}: ${cat.data?.percent || 0}%`}
                                />
                            ))}
                        </div>

                        {/* Category Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 font-mono text-xs">
                            {catList.map((cat) => (
                                <div key={cat.key} className="p-2.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] space-y-1">
                                    <div className="flex items-center gap-1.5 font-bold text-[oklch(18%_0.012_28)] font-sans">
                                        <span className={`w-2 h-2 ${cat.color} shrink-0`} />
                                        <span className="truncate">{cat.label}</span>
                                    </div>
                                    <div className="font-bold text-sm text-[oklch(18%_0.012_28)] tabular-nums">
                                        ฿{(cat.data?.revenue || 0).toLocaleString()}
                                    </div>
                                    <div className="text-[11px] text-[oklch(42%_0.010_28)]">
                                        {cat.data?.percent || 0}%
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Party Size Dynamics (6 cols) */}
                <div className="lg:col-span-6 border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] divide-y divide-[oklch(85%_0.012_28)]">
                    <div className="p-4 bg-[oklch(94%_0.010_28)] font-mono text-xs font-bold text-[oklch(18%_0.012_28)]">
                        PARTY SIZE // สถิติตามขนาดกลุ่มลูกค้า
                    </div>

                    <div className="divide-y divide-[oklch(85%_0.012_28)]">
                        {partySizeBreakdown.map((ps, idx) => (
                            <div key={idx} className="p-3.5 bg-[oklch(97%_0.008_28)] flex items-center justify-between font-mono text-xs">
                                <div>
                                    <div className="font-bold text-[oklch(18%_0.012_28)] font-sans">{ps.size}</div>
                                    <div className="text-[11px] text-[oklch(42%_0.010_28)] mt-0.5">
                                        ยอดเฉลี่ย ฿{ps.avgSpend.toLocaleString()} / บิล ({ps.note})
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-sm text-[oklch(52%_0.16_28)] tabular-nums">
                                        {ps.share}%
                                    </div>
                                    <div className="text-[11px] text-[oklch(42%_0.010_28)]">
                                        {ps.count} บิล
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
