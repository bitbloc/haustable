/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React from 'react'
import { Utensils, GlassWater, Beer, Users, RefreshCw, Zap, PieChart, Layers } from 'lucide-react'

export default function CasualDiningInsights({ data }) {
    const categoryRatio = data?.categoryRatio || {
        food: { percent: 62.5, revenue: 211500, margin: '58% Margin' },
        beverage: { percent: 18.5, revenue: 62600, margin: '82% Margin' },
        alcohol: { percent: 14.0, revenue: 47450, margin: '76% Margin' },
        dessertCombo: { percent: 5.0, revenue: 16950, margin: '68% Margin' }
    }

    const partySizeBreakdown = data?.partySizeBreakdown || [
        { size: 'Solo Diners (1 ท่าน)', share: 12.0, count: 48, avgSpend: 380, turnTime: 28, tip: 'มักสั่งเมนูจานเดียวด่วน' },
        { size: 'Couples (2 ท่าน)', share: 38.5, count: 124, avgSpend: 840, turnTime: 42, tip: 'มักสั่ง 2 อาหาร + 2 เครื่องดื่ม' },
        { size: 'Medium Groups (3-4 ท่าน)', share: 36.0, count: 86, avgSpend: 1680, turnTime: 58, tip: 'เน้นสั่งชุดเซตต้อนรับและเมนูแชร์' },
        { size: 'Large Parties (5+ ท่าน)', share: 13.5, count: 22, avgSpend: 3450, turnTime: 85, tip: 'ช่วงยอดต่อบิลสูงสุด ต้องจองล่วงหน้า' },
    ]

    const casualMetrics = data?.casualMetrics || {
        avgDwellTimeMins: 48,
        tableTurnsPerDay: 4.2,
        sharingSetPenetration: 34.5,
        bevAttachRate: 84.0,
    }

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b-2 border-[oklch(85%_0.012_28)] gap-2">
                <div>
                    <div className="flex items-center gap-2">
                        <Utensils size={20} className="text-[oklch(52%_0.16_28)] shrink-0" />
                        <h3 className="font-black text-base md:text-lg text-[oklch(18%_0.012_28)] tracking-tight">
                            Casual Dining Operational Insights
                        </h3>
                    </div>
                    <p className="text-xs font-semibold text-[oklch(42%_0.010_28)] mt-0.5">
                        สัดส่วนหมวดสินค้า ขนาดกลุ่ม และอัตราการหมุนเวียนโต๊ะ
                    </p>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg font-mono text-xs text-[oklch(18%_0.012_28)] font-black self-start sm:self-auto">
                    <RefreshCw size={14} className="text-emerald-800" />
                    <span>TURNOVER {casualMetrics.tableTurnsPerDay} TURNS/TABLE</span>
                </div>
            </div>

            {/* Grid Row 1: Food vs Beverage vs Alcohol Split & Party Size */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
                {/* Food vs Beverage Split (6 cols) */}
                <div className="lg:col-span-6 bg-[oklch(97%_0.008_28)] border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-4 md:p-5 space-y-4 shadow-sm">
                    <h4 className="text-xs font-mono font-black tracking-wider text-[oklch(18%_0.012_28)] uppercase">
                        FOOD VS BEVERAGE MARGIN RATIO
                    </h4>

                    {/* Progress Multi-Bar */}
                    <div className="w-full bg-gray-200 h-4 rounded-full overflow-hidden flex font-mono text-[10px]">
                        <div className="bg-[oklch(52%_0.16_28)] h-4" style={{ width: `${categoryRatio.food.percent}%` }} />
                        <div className="bg-emerald-600 h-4" style={{ width: `${categoryRatio.beverage.percent}%` }} />
                        <div className="bg-indigo-600 h-4" style={{ width: `${categoryRatio.alcohol.percent}%` }} />
                        <div className="bg-amber-500 h-4" style={{ width: `${categoryRatio.dessertCombo.percent}%` }} />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 md:gap-3 pt-1">
                        <div className="p-3 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-xl space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-black text-[oklch(18%_0.012_28)]">
                                <span className="w-3 h-3 rounded-full bg-[oklch(52%_0.16_28)]" />
                                <span>อาหาร (Food)</span>
                            </div>
                            <div className="font-mono text-base md:text-lg font-black text-[oklch(18%_0.012_28)]">
                                ฿{categoryRatio.food.revenue.toLocaleString()}
                            </div>
                            <div className="font-mono text-[11px] text-[oklch(52%_0.16_28)] font-black">{categoryRatio.food.percent}% ({categoryRatio.food.margin})</div>
                        </div>

                        <div className="p-3 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-xl space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-black text-emerald-900">
                                <span className="w-3 h-3 rounded-full bg-emerald-600" />
                                <span>เครื่องดื่ม (Beverage)</span>
                            </div>
                            <div className="font-mono text-base md:text-lg font-black text-emerald-800">
                                ฿{categoryRatio.beverage.revenue.toLocaleString()}
                            </div>
                            <div className="font-mono text-[11px] text-emerald-700 font-black">{categoryRatio.beverage.percent}% ({categoryRatio.beverage.margin})</div>
                        </div>

                        <div className="p-3 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-xl space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-black text-indigo-900">
                                <span className="w-3 h-3 rounded-full bg-indigo-600" />
                                <span>แอลกอฮอล์ (Alcohol)</span>
                            </div>
                            <div className="font-mono text-base md:text-lg font-black text-indigo-800">
                                ฿{categoryRatio.alcohol.revenue.toLocaleString()}
                            </div>
                            <div className="font-mono text-[11px] text-indigo-700 font-black">{categoryRatio.alcohol.percent}% ({categoryRatio.alcohol.margin})</div>
                        </div>

                        <div className="p-3 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-xl space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-black text-amber-900">
                                <span className="w-3 h-3 rounded-full bg-amber-500" />
                                <span>ของหวาน & เซต</span>
                            </div>
                            <div className="font-mono text-base md:text-lg font-black text-amber-800">
                                ฿{categoryRatio.dessertCombo.revenue.toLocaleString()}
                            </div>
                            <div className="font-mono text-[11px] text-amber-700 font-black">{categoryRatio.dessertCombo.percent}% ({categoryRatio.dessertCombo.margin})</div>
                        </div>
                    </div>
                </div>

                {/* Party Size Breakdown (6 cols) */}
                <div className="lg:col-span-6 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-4 md:p-5 space-y-3 shadow-sm">
                    <h4 className="text-xs font-mono font-black tracking-wider text-[oklch(18%_0.012_28)] uppercase">
                        PARTY SIZE DYNAMICS
                    </h4>

                    <div className="space-y-2.5">
                        {partySizeBreakdown.map((ps, idx) => (
                            <div key={idx} className="p-3 bg-[oklch(97%_0.008_28)] border-2 border-[oklch(85%_0.012_28)] rounded-xl space-y-1">
                                <div className="flex items-center justify-between text-xs font-black text-[oklch(18%_0.012_28)]">
                                    <div className="flex items-center gap-2">
                                        <Users size={16} className="text-[oklch(52%_0.16_28)]" />
                                        <span>{ps.size}</span>
                                    </div>
                                    <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-white border border-[oklch(85%_0.012_28)]">
                                        {ps.share}% ({ps.count} โต๊ะ)
                                    </span>
                                </div>

                                <div className="flex justify-between items-baseline text-xs font-mono pt-1">
                                    <span className="text-[oklch(42%_0.010_28)] font-bold">ยอดเฉลี่ย/โต๊ะ: <strong className="text-[oklch(52%_0.16_28)] font-black">฿{ps.avgSpend.toLocaleString()}</strong></span>
                                    <span className="text-[oklch(42%_0.010_28)] font-bold">เวลานั่ง: <strong className="text-[oklch(18%_0.012_28)] font-black">{ps.turnTime} นาที</strong></span>
                                </div>
                                <div className="text-[11px] text-[oklch(42%_0.010_28)] font-semibold italic pt-0.5">
                                    💡 {ps.tip}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
