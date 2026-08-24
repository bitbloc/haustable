/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState } from 'react'

export default function TopMenuInfographic({ data }) {
    const [activeCategory, setActiveCategory] = useState('all')

    const categories = [
        { id: 'all', label: 'ทั้งหมด [ALL]', shortLabel: 'ALL' },
        { id: 'main', label: 'อาหารจานหลัก [MAINS]', shortLabel: 'MAIN' },
        { id: 'snack', label: 'ของทานเล่น [SNACKS]', shortLabel: 'SNACK' },
        { id: 'set', label: 'ชุดเซตสำรับ [SETS]', shortLabel: 'SET' },
        { id: 'dessert', label: 'ของหวาน [DESSERTS]', shortLabel: 'DESSERT' },
        { id: 'drink', label: 'เครื่องดื่ม [BEVERAGES]', shortLabel: 'DRINK' },
        { id: 'alcohol', label: 'แอลกอฮอล์ [ALCOHOL]', shortLabel: 'ALCOHOL' },
    ]

    const allTopItems = data?.topMenuData || []

    const filteredItems = activeCategory === 'all' 
        ? allTopItems 
        : allTopItems.filter(item => item.category === activeCategory)

    const totalMenuRevenue = allTopItems.reduce((s, i) => s + (i.revenue || 0), 0)
    const currentCatTotalRevenue = filteredItems.reduce((s, i) => s + (i.revenue || 0), 0)
    const maxRevenue = filteredItems.length > 0 ? Math.max(...filteredItems.map(i => i.revenue || 0), 1) : 1

    return (
        <div className="space-y-6 text-[oklch(18%_0.012_28)] font-sans">
            
            {/* 1. Header Toolbar & Category Filter Matrix */}
            <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] divide-y divide-[oklch(85%_0.012_28)]">
                
                {/* Header Row */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[oklch(94%_0.010_28)]">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] uppercase">
                                RANKING // POS
                            </span>
                            <h3 className="font-bold text-base md:text-lg text-[oklch(18%_0.012_28)] tracking-tight">
                                อันดับเมนูขายดี (Top Menu Revenue & Volume)
                            </h3>
                        </div>
                        <p className="text-xs font-mono text-[oklch(42%_0.010_28)] mt-0.5">
                            จัดอันดับตามยอดขายรวมและจำนวนหน่วยที่สั่งซื้อจากระบบ POS จริง
                        </p>
                    </div>

                    <div className="font-mono text-xs font-bold text-[oklch(18%_0.012_28)]">
                        {activeCategory === 'all' ? (
                            <span>ยอดขายเมนูรวม: ฿{totalMenuRevenue.toLocaleString()}</span>
                        ) : (
                            <span>
                                ยอดหมวด: ฿{currentCatTotalRevenue.toLocaleString()} ({totalMenuRevenue > 0 ? ((currentCatTotalRevenue / totalMenuRevenue) * 100).toFixed(1) : 0}%)
                            </span>
                        )}
                    </div>
                </div>

                {/* Category Navigation Strip */}
                <div className="p-3 bg-[oklch(97%_0.008_28)] flex items-center gap-1.5 overflow-x-auto no-scrollbar font-mono text-xs">
                    {categories.map((cat) => {
                        const isSelected = activeCategory === cat.id
                        const countInCat = cat.id === 'all' 
                            ? allTopItems.length 
                            : allTopItems.filter(i => i.category === cat.id).length

                        return (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`px-3 py-1.5 font-bold transition-colors whitespace-nowrap border ${
                                    isSelected
                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)]'
                                        : 'bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(97%_0.008_28)]'
                                }`}
                            >
                                <span>{cat.label}</span>
                                <span className="ml-1.5 text-[10px] opacity-80">({countInCat})</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* 2. Zero State Alert */}
            {filteredItems.length === 0 && (
                <div className="p-8 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] text-center space-y-1 font-mono text-xs">
                    <p className="font-bold text-sm text-[oklch(18%_0.012_28)]">ไม่มีข้อมูลการขายเมนูในหมวดนี้</p>
                    <p className="text-[oklch(42%_0.010_28)]">ข้อมูลจะอัปเดตอัตโนมัติเมื่อมีการสั่งอาหารและชำระเงินผ่านระบบ POS</p>
                </div>
            )}

            {/* 3. Top Menu Grid Container (Neo-Brutalist 2-Column Matrix) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredItems.map((item, idx) => {
                    const categoryRank = idx + 1
                    const pctOfMax = Math.round((item.revenue / maxRevenue) * 100)
                    const shareOfCat = currentCatTotalRevenue > 0 ? ((item.revenue / currentCatTotalRevenue) * 100).toFixed(1) : 0
                    const shareOfTotal = totalMenuRevenue > 0 ? ((item.revenue / totalMenuRevenue) * 100).toFixed(1) : 0

                    return (
                        <div
                            key={idx}
                            className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] p-4 space-y-3 relative"
                        >
                            {idx === 0 && (
                                <span className="absolute top-0 right-0 bg-[oklch(52%_0.16_28)] text-[oklch(97%_0.008_28)] text-[10px] font-mono font-bold px-2 py-0.5 uppercase tracking-wider">
                                    RANK #1
                                </span>
                            )}

                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 flex items-center justify-center font-mono font-bold text-sm border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] shrink-0">
                                    {String(categoryRank).padStart(2, '0')}
                                </div>
                                <div className="space-y-1">
                                    <h4 className="font-bold text-sm md:text-base text-[oklch(18%_0.012_28)] leading-snug">
                                        {item.name}
                                    </h4>
                                    <div className="flex items-center gap-2 font-mono text-[11px] text-[oklch(42%_0.010_28)]">
                                        <span className="px-1.5 py-0.2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] font-bold text-[oklch(18%_0.012_28)]">
                                            {item.categoryLabel}
                                        </span>
                                        <span>{shareOfCat}% ของหมวด ({shareOfTotal}% รวม)</span>
                                    </div>
                                </div>
                            </div>

                            {/* Key Stats Bar */}
                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[oklch(85%_0.012_28)] font-mono text-xs">
                                <div>
                                    <div className="text-[10px] text-[oklch(42%_0.010_28)]">ยอดขายรวม</div>
                                    <div className="font-bold text-sm text-[oklch(52%_0.16_28)] tabular-nums">
                                        ฿{item.revenue.toLocaleString()}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-[oklch(42%_0.010_28)]">จำนวนที่ขาย</div>
                                    <div className="font-bold text-sm text-[oklch(18%_0.012_28)] tabular-nums">
                                        {item.units} ที่
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-[oklch(42%_0.010_28)]">เฉลี่ย/หน่วย</div>
                                    <div className="font-bold text-sm text-[oklch(18%_0.012_28)] tabular-nums">
                                        ฿{item.units > 0 ? Math.round(item.revenue / item.units) : 0}
                                    </div>
                                </div>
                            </div>

                            {/* Relative Progress Rule */}
                            <div className="space-y-1 pt-1">
                                <div className="flex justify-between font-mono text-[10px] text-[oklch(42%_0.010_28)]">
                                    <span>ความนิยมเทียบอันดับ 1</span>
                                    <span className="font-bold text-[oklch(52%_0.16_28)]">{pctOfMax}%</span>
                                </div>
                                <div className="w-full bg-[oklch(94%_0.010_28)] h-1.5 overflow-hidden">
                                    <div 
                                        className="bg-[oklch(52%_0.16_28)] h-1.5 transition-all duration-500" 
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
