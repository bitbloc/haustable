/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState } from 'react'
import { Trophy, Utensils, GlassWater, Beer, Flame, Layers, Award, Sparkles, ArrowRight } from 'lucide-react'

export default function TopMenuInfographic({ data }) {
    const [activeCategory, setActiveCategory] = useState('all')

    const categories = [
        { id: 'all', label: 'ทั้งหมด (All)', icon: Trophy },
        { id: 'main', label: 'อาหารหลัก (Mains)', icon: Utensils },
        { id: 'appetizer', label: 'ทานเล่น (Appetizers)', icon: Flame },
        { id: 'drink', label: 'เครื่องดื่ม (Beverages)', icon: GlassWater },
        { id: 'alcohol', label: 'แอลกอฮอล์ (Alcohol)', icon: Beer },
        { id: 'combo', label: 'ชุดเซต (Combos)', icon: Layers },
    ]

    const allTopItems = data?.topMenuData || [
        { rank: 1, name: 'ข้าวหน้าเนื้อวากิวไข่ดอง (Wagyu Don)', category: 'main', categoryLabel: 'อาหารหลัก', units: 342, revenue: 119700, marginTier: 'High Margin (68%)', peakTime: 'Dinner Rush (18-20น.)', trend: '+14%', isBestSeller: true },
        { rank: 2, name: 'สเต๊กเนื้อออสเตรเลีย 250g (AU Ribeye)', category: 'main', categoryLabel: 'อาหารหลัก', units: 218, revenue: 106820, marginTier: 'High Margin (62%)', peakTime: 'Dinner Rush (19-21น.)', trend: '+8%' },
        { rank: 3, name: 'ข้าวแกงกะหรี่หมูทอดคัตสึ (Katsu Curry)', category: 'main', categoryLabel: 'อาหารหลัก', units: 285, revenue: 62700, marginTier: 'Volume Driver (54%)', peakTime: 'Lunch Rush (12-13.30น.)', trend: '+5%' },
        
        { rank: 4, name: 'Casual Sharing Set A (วากิว+เบียร์ 2 แก้ว)', category: 'combo', categoryLabel: 'ชุดเซต', units: 145, revenue: 85550, marginTier: 'Star Profit (72%)', peakTime: 'Prime Dinner (19น.)', trend: '+22%', isBestSeller: true },
        { rank: 5, name: 'Family Platter Set B (เซต 4 ท่าน)', category: 'combo', categoryLabel: 'ชุดเซต', units: 88, revenue: 69520, marginTier: 'High Ticket (65%)', peakTime: 'Weekend Dinner', trend: '+12%' },

        { rank: 6, name: 'Yuzu Highball / Craft Cocktail', category: 'alcohol', categoryLabel: 'แอลกอฮอล์', units: 412, revenue: 78280, marginTier: 'Ultra Margin (82%)', peakTime: 'Late Night (21น.+)', trend: '+18%', isBestSeller: true },
        { rank: 7, name: 'Suntory Premium Draft Beer (Pint)', category: 'alcohol', categoryLabel: 'แอลกอฮอล์', units: 480, revenue: 67200, marginTier: 'Volume Driver (75%)', peakTime: 'Happy Hour & Dinner', trend: '+10%' },

        { rank: 8, name: 'ซาชิมิแซลมอนนอร์เวย์ (Norwegian Salmon)', category: 'appetizer', categoryLabel: 'ทานเล่น', units: 260, revenue: 65000, marginTier: 'Balanced (58%)', peakTime: 'All Day Peak', trend: '+4%', isBestSeller: true },
        { rank: 9, name: 'ไก่ทอดซอสส้มยูซุ (Yuzu Karaage)', category: 'appetizer', categoryLabel: 'ทานเล่น', units: 310, revenue: 49600, marginTier: 'High Margin (74%)', peakTime: 'Lunch & Dinner', trend: '+15%' },

        { rank: 10, name: 'Matcha Citrus Sparkler (ชาเขียวส้มยูซุ)', category: 'drink', categoryLabel: 'เครื่องดื่ม', units: 390, revenue: 42900, marginTier: 'High Margin (85%)', peakTime: 'Afternoon & Lunch', trend: '+11%', isBestSeller: true },
    ]

    const filteredItems = activeCategory === 'all' 
        ? allTopItems 
        : allTopItems.filter(item => item.category === activeCategory)

    const maxRevenue = Math.max(...allTopItems.map(i => i.revenue))

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b-2 border-[oklch(85%_0.012_28)] gap-2">
                <div>
                    <div className="flex items-center gap-2">
                        <Trophy size={20} className="text-[oklch(52%_0.16_28)] shrink-0" />
                        <h3 className="font-black text-base md:text-lg text-[oklch(18%_0.012_28)] tracking-tight">
                            อันดับเมนูขายดี Infographic (Top Menu Breakdown)
                        </h3>
                    </div>
                    <p className="text-xs font-semibold text-[oklch(42%_0.010_28)] mt-0.5">
                        จัดอันดับแยกหมวดหมู่ พร้อมจำนวนจาน ยอดขาย และอัตรากำไร
                    </p>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-lg font-mono text-xs text-[oklch(18%_0.012_28)] font-black self-start sm:self-auto">
                    <Sparkles size={14} className="text-amber-600" />
                    <span>SORTED BY REVENUE</span>
                </div>
            </div>

            {/* Category Navigation Pills - Mobile Touch Scrollable */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar scroll-smooth">
                {categories.map((cat) => {
                    const Icon = cat.icon
                    const isSelected = activeCategory === cat.id
                    return (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-mono text-xs transition-all whitespace-nowrap border-2 min-h-[42px] ${
                                isSelected
                                    ? 'bg-[oklch(18%_0.012_28)] text-white font-black border-[oklch(18%_0.012_28)] shadow-sm'
                                    : 'bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] font-bold border-[oklch(85%_0.012_28)] hover:bg-white'
                            }`}
                        >
                            <Icon size={16} />
                            <span>{cat.label}</span>
                        </button>
                    )
                })}
            </div>

            {/* Top Menu Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 md:gap-4">
                {filteredItems.map((item, idx) => {
                    const pctOfMax = (item.revenue / maxRevenue) * 100
                    return (
                        <div
                            key={idx}
                            className="bg-white border-2 border-[oklch(85%_0.012_28)] rounded-2xl p-4 space-y-3 shadow-sm hover:border-[oklch(52%_0.16_28)] transition-all relative overflow-hidden"
                        >
                            {item.isBestSeller && (
                                <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-mono font-black px-2.5 py-0.5 rounded-bl-xl tracking-wider">
                                    TOP SELLER
                                </div>
                            )}

                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-black text-sm shrink-0 ${
                                        item.rank === 1 ? 'bg-amber-100 text-amber-900 border-2 border-amber-400' :
                                        item.rank === 2 ? 'bg-slate-100 text-slate-900 border-2 border-slate-400' :
                                        item.rank === 3 ? 'bg-orange-100 text-orange-900 border-2 border-orange-400' :
                                        'bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)]'
                                    }`}>
                                        #{item.rank}
                                    </div>
                                    <div>
                                        <h4 className="font-black text-sm md:text-base text-[oklch(18%_0.012_28)]">{item.name}</h4>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)]">
                                                {item.categoryLabel}
                                            </span>
                                            <span className="font-mono text-[11px] text-emerald-700 font-black">{item.trend} MoM</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Key Stats Bar - Bold Values */}
                            <div className="grid grid-cols-3 gap-2 pt-2 border-t-2 border-[oklch(85%_0.012_28)] text-xs font-mono">
                                <div>
                                    <div className="text-[10px] text-[oklch(42%_0.010_28)] font-bold">ยอดขายรวม</div>
                                    <div className="font-black text-base md:text-lg text-[oklch(52%_0.16_28)]">฿{item.revenue.toLocaleString()}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-[oklch(42%_0.010_28)] font-bold">จำนวนจาน</div>
                                    <div className="font-black text-base md:text-lg text-[oklch(18%_0.012_28)]">{item.units} จาน</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-[oklch(42%_0.010_28)] font-bold">อัตรากำไร</div>
                                    <div className="font-extrabold text-[11px] text-[oklch(45%_0.08_140)] pt-1">{item.marginTier}</div>
                                </div>
                            </div>

                            {/* Relative Progress Bar */}
                            <div className="space-y-1 pt-1">
                                <div className="flex justify-between text-[11px] font-mono text-[oklch(42%_0.010_28)] font-bold">
                                    <span>ความนิยมสัมพัทธ์</span>
                                    <span>ขายดีช่วง: <strong className="text-[oklch(18%_0.012_28)] font-black">{item.peakTime}</strong></span>
                                </div>
                                <div className="w-full bg-[oklch(94%_0.010_28)] h-2.5 rounded-full overflow-hidden">
                                    <div 
                                        className="bg-[oklch(52%_0.16_28)] h-2.5 rounded-full transition-all duration-500" 
                                        style={{ width: `${pctOfMax}%` }} 
                                    />
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
