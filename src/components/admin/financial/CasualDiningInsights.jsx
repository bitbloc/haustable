/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React from 'react'
import { Utensils, GlassWater, Beer, Users, RefreshCw, Flame, Layers, Sparkles } from 'lucide-react'

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
        { size: 'Solo Diners (1 ท่าน)', share: 0, count: 0, avgSpend: 0, turnTime: 0, tip: 'มักสั่งเมนูจานเดียวด่วน' },
        { size: 'Couples (2 ท่าน)', share: 0, count: 0, avgSpend: 0, turnTime: 0, tip: 'มักสั่ง 2 อาหาร + 2 เครื่องดื่ม' },
        { size: 'Medium Groups (3-4 ท่าน)', share: 0, count: 0, avgSpend: 0, turnTime: 0, tip: 'เน้นสั่งชุดเซตและเมนูแชร์' },
        { size: 'Large Parties (5+ ท่าน)', share: 0, count: 0, avgSpend: 0, turnTime: 0, tip: 'ช่วงยอดต่อบิลสูง' },
    ]

    const casualMetrics = data?.casualMetrics || {
        avgDwellTimeMins: 0,
        tableTurnsPerDay: 0,
        sharingSetPenetration: 0,
        bevAttachRate: 0,
    }

    const catList = [
        { key: 'food', label: 'อาหารจานหลัก', colorDot: 'bg-[oklch(52%_0.16_28)]', barColor: 'bg-[oklch(52%_0.16_28)]', textColor: 'text-[oklch(52%_0.16_28)]', data: categoryRatio.food },
        { key: 'snack', label: 'ของทานเล่น', colorDot: 'bg-orange-500', barColor: 'bg-orange-500', textColor: 'text-orange-700', data: categoryRatio.snack },
        { key: 'set', label: 'ชุดเซตสำรับ', colorDot: 'bg-amber-600', barColor: 'bg-amber-600', textColor: 'text-amber-800', data: categoryRatio.set },
        { key: 'dessert', label: 'ของหวาน', colorDot: 'bg-rose-500', barColor: 'bg-rose-500', textColor: 'text-rose-700', data: categoryRatio.dessert },
        { key: 'beverage', label: 'เครื่องดื่ม', colorDot: 'bg-emerald-600', barColor: 'bg-emerald-600', textColor: 'text-emerald-700', data: categoryRatio.beverage },
        { key: 'alcohol', label: 'แอลกอฮอล์ & เบียร์', colorDot: 'bg-indigo-600', barColor: 'bg-indigo-600', textColor: 'text-indigo-700', data: categoryRatio.alcohol },
    ]

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
                        สัดส่วนหมวดสินค้า ขนาดกลุ่มลูกค้า และอัตราการหมุนเวียนโต๊ะ
                    </p>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg font-mono text-xs text-[oklch(18%_0.012_28)] font-black self-start sm:self-auto">
                    <RefreshCw size={14} className="text-emerald-800" />
                    <span>TURNOVER {casualMetrics.tableTurnsPerDay} TURNS/TABLE</span>
                </div>
            </div>

            {/* Grid Row 1: Food vs Beverage vs Alcohol Split & Party Size */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
                {/* Category Revenue Split (6 cols) */}
                <div className="lg:col-span-6 bg-[oklch(97%_0.008_28)] border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-4 md:p-5 space-y-4 shadow-sm">
                    <h4 className="text-xs font-mono font-black tracking-wider text-[oklch(18%_0.012_28)] uppercase">
                        CATEGORY REVENUE SPLIT GAUGE (6 หมวดหมู่)
                    </h4>

                    {/* Progress Multi-Bar */}
                    <div className="w-full bg-gray-200 h-4 rounded-full overflow-hidden flex font-mono text-[10px]">
                        {catList.map((cat) => (
                            <div
                                key={cat.key}
                                className={`${cat.barColor} h-4 transition-all duration-500`}
                                style={{ width: `${cat.data?.percent || 0}%` }}
                                title={`${cat.label}: ${cat.data?.percent || 0}%`}
                            />
                        ))}
                    </div>

                    {/* Category Cards Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                        {catList.map((cat) => (
                            <div key={cat.key} className="p-2.5 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-xl space-y-1 shadow-sm">
                                <div className="flex items-center gap-1.5 text-xs font-black text-[oklch(18%_0.012_28)]">
                                    <span className={`w-2.5 h-2.5 rounded-full ${cat.colorDot} shrink-0`} />
                                    <span className="truncate">{cat.label}</span>
                                </div>
                                <div className="font-mono text-sm md:text-base font-black text-[oklch(18%_0.012_28)]">
                                    ฿{(cat.data?.revenue || 0).toLocaleString()}
                                </div>
                                <div className={`font-mono text-[11px] ${cat.textColor} font-black`}>
                                    {cat.data?.percent || 0}%
                                </div>
                            </div>
                        ))}
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
                                        {ps.share}% ({ps.count} บิล)
                                    </span>
                                </div>

                                <div className="flex justify-between items-baseline text-xs font-mono pt-1">
                                    <span className="text-[oklch(42%_0.010_28)] font-bold">ยอดเฉลี่ย/บิล: <strong className="text-[oklch(52%_0.16_28)] font-black">฿{ps.avgSpend.toLocaleString()}</strong></span>
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
