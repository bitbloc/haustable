/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React from 'react'

export default function UnmetNeedAnalytics({ data }) {
    const menuMatrix = data?.menuMatrix || []

    return (
        <div className="space-y-6 text-[oklch(18%_0.012_28)] font-sans">
            
            {/* 1. Header Toolbar */}
            <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] divide-y divide-[oklch(85%_0.012_28)]">
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[oklch(94%_0.010_28)]">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] uppercase">
                                MATRIX // ENGINEERING
                            </span>
                            <h3 className="font-bold text-base md:text-lg text-[oklch(18%_0.012_28)] tracking-tight">
                                เมทริกซ์วิเคราะห์เมนูและกำไร (Menu Engineering Matrix)
                            </h3>
                        </div>
                        <p className="text-xs font-mono text-[oklch(42%_0.010_28)] mt-0.5">
                            จำแนก 4 มิติความนิยมและราคาต่อจานตามหลัก BCG Matrix จากยอดขายจริง
                        </p>
                    </div>

                    <div className="font-mono text-xs font-bold text-[oklch(18%_0.012_28)]">
                        POPULARITY VS REVENUE
                    </div>
                </div>
            </div>

            {/* 2. Menu Engineering 4-Quadrant Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {menuMatrix.map((q, idx) => (
                    <div
                        key={idx}
                        className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] p-4 space-y-3"
                    >
                        <div className="flex items-center justify-between font-mono text-xs border-b border-[oklch(85%_0.012_28)] pb-2">
                            <h5 className="font-bold text-sm text-[oklch(18%_0.012_28)] font-sans">{q.quadrant}</h5>
                            <span className="px-2 py-0.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] font-bold text-[oklch(52%_0.16_28)]">
                                {q.tag}
                            </span>
                        </div>

                        <p className="text-xs text-[oklch(42%_0.010_28)] font-mono">
                            {q.desc}
                        </p>

                        {/* Items in Quadrant */}
                        <div className="space-y-1.5 pt-1">
                            <div className="text-[11px] font-mono font-bold text-[oklch(18%_0.012_28)]">
                                รายการเมนูที่เข้าเกณฑ์:
                            </div>
                            <div className="flex flex-wrap gap-1.5 font-mono text-xs">
                                {q.items.map((it, iIdx) => (
                                    <span
                                        key={iIdx}
                                        className="px-2.5 py-1 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-bold font-sans text-xs"
                                    >
                                        {it}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Recommended Action */}
                        <div className="text-xs font-mono pt-2 border-t border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)]">
                            <span className="text-[oklch(52%_0.16_28)] font-bold">แนวทาง:</span> {q.action}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
