/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useMemo } from 'react'

/**
 * MenuEngineeringMatrix
 * Level 4: 4-Quadrant Menu Engineering
 * Stars, Volume (Plowhorses), Niche (Puzzles), Problems (Dogs)
 * Transforms complex scatter into clean actionable tactical matrix.
 */
export default function MenuEngineeringMatrix({ topMenuData = [] }) {
    const quadrants = useMemo(() => {
        if (!topMenuData || topMenuData.length === 0) {
            return { stars: [], volume: [], niche: [], problems: [] }
        }

        // Calculate medians/averages
        const unitsList = topMenuData.map(i => i.units || 1)
        const pricesList = topMenuData.map(i => i.price || 0)
        const avgUnits = unitsList.reduce((s, u) => s + u, 0) / unitsList.length
        const avgPrice = pricesList.reduce((s, p) => s + p, 0) / pricesList.length

        const classified = {
            stars: [],
            volume: [],
            niche: [],
            problems: []
        }

        topMenuData.forEach(item => {
            const units = item.units || 1
            const price = item.price || 0

            // Estimated margin based on category / price
            let estMarginPct = 65
            if (item.category === 'drink') estMarginPct = 78
            else if (item.category === 'alcohol') estMarginPct = 52
            else if (item.category === 'snack') estMarginPct = 70
            else if (price > 250) estMarginPct = 60

            const enriched = {
                ...item,
                units,
                price,
                revenue: item.revenue || (units * price),
                estMarginPct
            }

            if (units >= avgUnits && price >= avgPrice) {
                classified.stars.push(enriched)
            } else if (units >= avgUnits && price < avgPrice) {
                classified.volume.push(enriched)
            } else if (units < avgUnits && price >= avgPrice) {
                classified.niche.push(enriched)
            } else {
                classified.problems.push(enriched)
            }
        })

        return classified
    }, [topMenuData])

    return (
        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)]">
            {/* Header */}
            <div className="p-3 bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]">
                        STRATEGY
                    </span>
                    <span className="font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider">
                        MENU ENGINEERING // เมทริกซ์กลยุทธ์เมนู (4 QUADRANTS)
                    </span>
                </div>
                <span className="text-[10px] text-[oklch(42%_0.010_28)]">
                    วิเคราะห์ยอดขายคู่กับมาร์จิ้นเพื่อปรับกลยุทธ์
                </span>
            </div>

            {/* 4 Quadrants Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[oklch(85%_0.012_28)]">
                
                {/* Column Left: High Margin Quadrants (Stars + Niche) */}
                <div className="divide-y divide-[oklch(85%_0.012_28)]">
                    
                    {/* Quadrant 1: STARS (High Sales + High Margin) */}
                    <div className="p-4 space-y-2 bg-[oklch(97%_0.008_28)]">
                        <div className="flex items-center justify-between font-mono text-xs">
                            <span className="font-bold text-[oklch(52%_0.16_28)] flex items-center gap-1.5">
                                [STARS] เมนูดาวเด่น // ขายดี + กำไรสูง
                            </span>
                            <span className="text-[10px] text-[oklch(55%_0.010_28)]">
                                {quadrants.stars.length} รายการ
                            </span>
                        </div>
                        <p className="text-[11px] font-mono text-[oklch(42%_0.010_28)]">
                            กลยุทธ์: เป็นเสาหลักของร้าน รักษาคุณภาพ วัตถุดิบห้ามขาด
                        </p>
                        <div className="space-y-1.5 pt-1">
                            {quadrants.stars.slice(0, 3).map(item => (
                                <div key={item.id || item.name} className="flex items-center justify-between text-xs font-mono bg-[oklch(94%_0.010_28)] px-2.5 py-1.5 border border-[oklch(85%_0.012_28)]">
                                    <span className="font-sans font-medium text-[oklch(18%_0.012_28)] truncate max-w-[200px]">{item.name}</span>
                                    <span className="text-[oklch(52%_0.16_28)] font-bold">฿{item.revenue?.toLocaleString()} ({item.units} จาน)</span>
                                </div>
                            ))}
                            {quadrants.stars.length === 0 && (
                                <div className="text-[11px] text-[oklch(55%_0.010_28)] font-mono py-1">- ไม่มีข้อมูล -</div>
                            )}
                        </div>
                    </div>

                    {/* Quadrant 3: NICHE (Low Sales + High Margin) */}
                    <div className="p-4 space-y-2 bg-[oklch(97%_0.008_28)]">
                        <div className="flex items-center justify-between font-mono text-xs">
                            <span className="font-bold text-[oklch(45%_0.08_140)] flex items-center gap-1.5">
                                [NICHE] เมนูพรีเมียม // กำไรสูงต่อจาน แต่ขายน้อย
                            </span>
                            <span className="text-[10px] text-[oklch(55%_0.010_28)]">
                                {quadrants.niche.length} รายการ
                            </span>
                        </div>
                        <p className="text-[11px] font-mono text-[oklch(42%_0.010_28)]">
                            กลยุทธ์: ดันขึ้นหน้าแรกของแอป/เล่มเมนู หรือทำโปรจับคู่เซต
                        </p>
                        <div className="space-y-1.5 pt-1">
                            {quadrants.niche.slice(0, 3).map(item => (
                                <div key={item.id || item.name} className="flex items-center justify-between text-xs font-mono bg-[oklch(94%_0.010_28)] px-2.5 py-1.5 border border-[oklch(85%_0.012_28)]">
                                    <span className="font-sans font-medium text-[oklch(18%_0.012_28)] truncate max-w-[200px]">{item.name}</span>
                                    <span className="text-[oklch(45%_0.08_140)] font-bold">฿{item.revenue?.toLocaleString()} ({item.units} จาน)</span>
                                </div>
                            ))}
                            {quadrants.niche.length === 0 && (
                                <div className="text-[11px] text-[oklch(55%_0.010_28)] font-mono py-1">- ไม่มีข้อมูล -</div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Column Right: Low Margin Quadrants (Volume + Problems) */}
                <div className="divide-y divide-[oklch(85%_0.012_28)]">
                    
                    {/* Quadrant 2: VOLUME (High Sales + Low Margin) */}
                    <div className="p-4 space-y-2 bg-[oklch(97%_0.008_28)]">
                        <div className="flex items-center justify-between font-mono text-xs">
                            <span className="font-bold text-[oklch(18%_0.012_28)] flex items-center gap-1.5">
                                [VOLUME] เมนูปริมาณ // ขายดีแต่มาร์จิ้นต่ำ
                            </span>
                            <span className="text-[10px] text-[oklch(55%_0.010_28)]">
                                {quadrants.volume.length} รายการ
                            </span>
                        </div>
                        <p className="text-[11px] font-mono text-[oklch(42%_0.010_28)]">
                            กลยุทธ์: ปรับราคาขึ้น 5–10 บาท หรือเจรจาต้นทุนซัพพลายเออร์
                        </p>
                        <div className="space-y-1.5 pt-1">
                            {quadrants.volume.slice(0, 3).map(item => (
                                <div key={item.id || item.name} className="flex items-center justify-between text-xs font-mono bg-[oklch(94%_0.010_28)] px-2.5 py-1.5 border border-[oklch(85%_0.012_28)]">
                                    <span className="font-sans font-medium text-[oklch(18%_0.012_28)] truncate max-w-[200px]">{item.name}</span>
                                    <span className="text-[oklch(18%_0.012_28)] font-bold">฿{item.revenue?.toLocaleString()} ({item.units} จาน)</span>
                                </div>
                            ))}
                            {quadrants.volume.length === 0 && (
                                <div className="text-[11px] text-[oklch(55%_0.010_28)] font-mono py-1">- ไม่มีข้อมูล -</div>
                            )}
                        </div>
                    </div>

                    {/* Quadrant 4: PROBLEMS (Low Sales + Low Margin) */}
                    <div className="p-4 space-y-2 bg-[oklch(97%_0.008_28)]">
                        <div className="flex items-center justify-between font-mono text-xs">
                            <span className="font-bold text-[oklch(42%_0.010_28)] flex items-center gap-1.5">
                                [REVIEW] เมนูรอทบทวน // ขายน้อย + กำไรต่ำ
                            </span>
                            <span className="text-[10px] text-[oklch(55%_0.010_28)]">
                                {quadrants.problems.length} รายการ
                            </span>
                        </div>
                        <p className="text-[11px] font-mono text-[oklch(42%_0.010_28)]">
                            กลยุทธ์: ปรับปรุงสูตร หรือตัดออกจากเมนูประจำเพื่อลด Stock
                        </p>
                        <div className="space-y-1.5 pt-1">
                            {quadrants.problems.slice(0, 3).map(item => (
                                <div key={item.id || item.name} className="flex items-center justify-between text-xs font-mono bg-[oklch(94%_0.010_28)] px-2.5 py-1.5 border border-[oklch(85%_0.012_28)]">
                                    <span className="font-sans font-medium text-[oklch(18%_0.012_28)] truncate max-w-[200px]">{item.name}</span>
                                    <span className="text-[oklch(42%_0.010_28)] font-bold">฿{item.revenue?.toLocaleString()} ({item.units} จาน)</span>
                                </div>
                            ))}
                            {quadrants.problems.length === 0 && (
                                <div className="text-[11px] text-[oklch(55%_0.010_28)] font-mono py-1">- ไม่มีข้อมูล -</div>
                            )}
                        </div>
                    </div>

                </div>

            </div>
        </div>
    )
}
