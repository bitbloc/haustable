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
        <div className="space-y-6 text-[var(--color-ink)] font-sans">
            
            {/* 1. Header Toolbar & Category Filter Matrix */}
            <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] divide-y divide-[var(--color-rule)]">
                
                {/* Header Row */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--color-paper-2)]">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-[11px] tabular-nums font-bold bg-[var(--color-ink)] text-[var(--color-paper)] ">
                                RANKING // POS
                            </span>
                            <h3 className="font-bold text-base md:text-lg text-[var(--color-ink)] tracking-tight">
                                อันดับเมนูขายดี (Top Menu Revenue & Volume)
                            </h3>
                        </div>
                        <p className="text-[13px] tabular-nums text-[var(--color-muted)] mt-0.5">
                            จัดอันดับตามยอดขายรวมและจำนวนหน่วยที่สั่งซื้อจากระบบ POS จริง
                        </p>
                    </div>

                    <div className="tabular-nums text-xs font-bold text-[var(--color-ink)]">
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
                <div className="p-3 bg-[var(--color-paper)] flex items-center gap-1.5 overflow-x-auto no-scrollbar tabular-nums text-xs">
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
                                        ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)]'
                                        : 'bg-[var(--color-paper-2)] text-[var(--color-muted)] border-[var(--color-rule)] hover:bg-[var(--color-paper)]'
                                }`}
                            >
                                <span>{cat.label}</span>
                                <span className="ml-1.5 text-xs opacity-80">({countInCat})</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* 2. Zero State Alert */}
            {filteredItems.length === 0 && (
                <div className="p-8 border border-[var(--color-rule)] bg-[var(--color-paper-2)] text-center space-y-1 tabular-nums text-xs">
                    <p className="font-bold text-sm text-[var(--color-ink)]">ไม่มีข้อมูลการขายเมนูในหมวดนี้</p>
                    <p className="text-[var(--color-muted)]">ข้อมูลจะอัปเดตอัตโนมัติเมื่อมีการสั่งอาหารและชำระเงินผ่านระบบ POS</p>
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
                            className="border border-[var(--color-rule)] bg-[var(--color-paper)] p-4 space-y-3 relative"
                        >
                            {idx === 0 && (
                                <span className="absolute top-0 right-0 bg-[var(--brand-plum)] text-[var(--color-paper)] text-[11px] tabular-nums font-bold px-2 py-0.5  ">
                                    RANK #1
                                </span>
                            )}

                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 flex items-center justify-center tabular-nums font-bold text-sm border border-[var(--color-rule)] bg-[var(--color-paper-2)] text-[var(--color-ink)] shrink-0">
                                    {String(categoryRank).padStart(2, '0')}
                                </div>
                                <div className="space-y-1">
                                    <h4 className="font-bold text-sm md:text-base text-[var(--color-ink)] leading-snug">
                                        {item.name}
                                    </h4>
                                    <div className="flex items-center gap-2 tabular-nums text-xs text-[var(--color-muted)]">
                                        <span className="px-1.5 py-0.2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] font-bold text-[var(--color-ink)]">
                                            {item.categoryLabel}
                                        </span>
                                        <span>{shareOfCat}% ของหมวด ({shareOfTotal}% รวม)</span>
                                    </div>
                                </div>
                            </div>

                            {/* Key Stats Bar */}
                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--color-rule)] tabular-nums text-xs">
                                <div>
                                    <div className="text-xs text-[var(--color-muted)]">ยอดขายรวม</div>
                                    <div className="font-bold text-sm text-[var(--brand-plum)] tabular-nums">
                                        ฿{item.revenue.toLocaleString()}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-[var(--color-muted)]">จำนวนที่ขาย</div>
                                    <div className="font-bold text-sm text-[var(--color-ink)] tabular-nums">
                                        {item.units} ที่
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-[var(--color-muted)]">เฉลี่ย/หน่วย</div>
                                    <div className="font-bold text-sm text-[var(--color-ink)] tabular-nums">
                                        ฿{item.units > 0 ? Math.round(item.revenue / item.units) : 0}
                                    </div>
                                </div>
                            </div>

                            {/* Relative Progress Rule */}
                            <div className="space-y-1 pt-1">
                                <div className="flex justify-between tabular-nums text-xs text-[var(--color-muted)]">
                                    <span>ความนิยมเทียบอันดับ 1</span>
                                    <span className="font-bold text-[var(--brand-plum)]">{pctOfMax}%</span>
                                </div>
                                <div className="w-full bg-[var(--color-paper-2)] h-1.5 overflow-hidden">
                                    <div 
                                        className="bg-[var(--brand-plum)] h-1.5 transition-all duration-500" 
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
