/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState } from 'react'
import { Trophy, Utensils, GlassWater, Beer, Flame, Layers, Award, Sparkles, Inbox } from 'lucide-react'

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

    const allTopItems = data?.topMenuData || []

    const filteredItems = activeCategory === 'all' 
        ? allTopItems 
        : allTopItems.filter(item => item.category === activeCategory)

    const maxRevenue = allTopItems.length > 0 ? Math.max(...allTopItems.map(i => i.revenue || 0), 1) : 1

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
                    <p className="text-xs font-bold text-[oklch(42%_0.010_28)] mt-0.5">
                        จัดอันดับเมนูขายดีจากข้อมูลออเดอร์ POS จริง
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

            {/* Zero State Alert when no menu items found */}
            {filteredItems.length === 0 && (
                <div className="p-8 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-2xl text-center space-y-2">
                    <Inbox size={36} className="mx-auto text-[oklch(55%_0.010_28)] opacity-60" />
                    <h4 className="font-black text-sm text-[oklch(18%_0.012_28)]">ไม่มีข้อมูลการขายเมนูในหมวดนี้</h4>
                    <p className="text-xs text-[oklch(42%_0.010_28)] font-bold">ข้อมูลจะอัปเดตอัตโนมัติเมื่อมีการสั่งอาหารและชำระเงินผ่านระบบ POS</p>
                </div>
            )}

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
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Key Stats Bar */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t-2 border-[oklch(85%_0.012_28)] text-xs font-mono">
                                <div>
                                    <div className="text-[10px] text-[oklch(42%_0.010_28)] font-bold">ยอดขายรวม</div>
                                    <div className="font-black text-base md:text-lg text-[oklch(52%_0.16_28)]">฿{item.revenue.toLocaleString()}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-[oklch(42%_0.010_28)] font-bold font-sans">จำนวนที่ขายได้</div>
                                    <div className="font-black text-base md:text-lg text-[oklch(18%_0.012_28)]">{item.units} จาน</div>
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <div className="text-[10px] text-[oklch(42%_0.010_28)] font-bold">ที่มาจาก POS</div>
                                    <div className="font-extrabold text-[11px] text-[oklch(45%_0.08_140)] pt-1">{item.marginTier}</div>
                                </div>
                            </div>

                            {/* Relative Progress Bar */}
                            <div className="space-y-1 pt-1">
                                <div className="flex justify-between text-[11px] font-mono text-[oklch(42%_0.010_28)] font-bold">
                                    <span>สัดส่วนความนิยมในหมวด</span>
                                    <span className="font-black text-[oklch(52%_0.16_28)]">{Math.round(pctOfMax)}%</span>
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
