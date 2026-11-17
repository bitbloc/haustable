/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React from 'react'

export default function UnmetNeedAnalytics({ data }) {
    const menuMatrix = data?.menuMatrix || []

    return (
        <div className="space-y-6 text-[var(--color-ink)] font-sans">
            
            {/* 1. Header Toolbar */}
            <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] divide-y divide-[var(--color-rule)]">
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--color-paper-2)]">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-[11px] tabular-nums font-bold bg-[var(--color-ink)] text-[var(--color-paper)] ">
                                MATRIX // ENGINEERING
                            </span>
                            <h3 className="font-bold text-base md:text-lg text-[var(--color-ink)] tracking-tight">
                                เมทริกซ์วิเคราะห์เมนูและกำไร (Menu Engineering Matrix)
                            </h3>
                        </div>
                        <p className="text-[13px] tabular-nums text-[var(--color-muted)] mt-0.5">
                            จำแนก 4 มิติความนิยมและราคาต่อจานตามหลัก BCG Matrix จากยอดขายจริง
                        </p>
                    </div>

                    <div className="tabular-nums text-xs font-bold text-[var(--color-ink)]">
                        POPULARITY VS REVENUE
                    </div>
                </div>
            </div>

            {/* 2. Menu Engineering 4-Quadrant Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {menuMatrix.map((q, idx) => (
                    <div
                        key={idx}
                        className="border border-[var(--color-rule)] bg-[var(--color-paper)] p-4 space-y-3"
                    >
                        <div className="flex items-center justify-between tabular-nums text-xs border-b border-[var(--color-rule)] pb-2">
                            <h5 className="font-bold text-sm text-[var(--color-ink)] font-sans">{q.quadrant}</h5>
                            <span className="px-2 py-0.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] font-bold text-[var(--brand-plum)]">
                                {q.tag}
                            </span>
                        </div>

                        <p className="text-[13px] text-[var(--color-muted)] tabular-nums">
                            {q.desc}
                        </p>

                        {/* Items in Quadrant */}
                        <div className="space-y-1.5 pt-1">
                            <div className="text-xs tabular-nums font-bold text-[var(--color-ink)]">
                                รายการเมนูที่เข้าเกณฑ์:
                            </div>
                            <div className="flex flex-wrap gap-1.5 tabular-nums text-xs">
                                {q.items.map((it, iIdx) => (
                                    <span
                                        key={iIdx}
                                        className="px-2.5 py-1 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[var(--color-ink)] font-bold font-sans text-xs"
                                    >
                                        {it}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Recommended Action */}
                        <div className="text-xs tabular-nums pt-2 border-t border-[var(--color-rule)] text-[var(--color-ink)]">
                            <span className="text-[var(--brand-plum)] font-bold">แนวทาง:</span> {q.action}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
