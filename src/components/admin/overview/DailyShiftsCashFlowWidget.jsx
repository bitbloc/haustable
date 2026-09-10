/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useMemo } from 'react'
import { ChevronRight, ArrowDownLeft, ArrowUpRight, Lock, CheckCircle2, AlertTriangle, Clock, RefreshCw } from 'lucide-react'

/**
 * Smart Category Classifier for Shift Petty Cash Adjustments
 * Detects common Thai operational patterns (ตลาด, น้ำแข็ง, พัสดุ, เงินทอน, ส่งเงิน, etc.)
 */
export function classifyAdjustmentNote(note = '', type = 'out') {
    const text = (note || '').toLowerCase()
    
    if (text.includes('ทอน') || text.includes('float') || text.includes('change') || text.includes('สำรอง')) {
        return { label: 'เงินทอน/สำรอง', color: 'bg-[oklch(93%_0.03_140)] text-[oklch(35%_0.08_140)] border-[oklch(80%_0.06_140)]' }
    }
    if (text.includes('ตลาด') || text.includes('ผัก') || text.includes('เนื้อ') || text.includes('หมู') || text.includes('วัตถุดิบ') || text.includes('ของสด') || text.includes('market')) {
        return { label: 'ตลาด/ของสด', color: 'bg-[oklch(94%_0.04_65)] text-[oklch(38%_0.10_65)] border-[oklch(82%_0.07_65)]' }
    }
    if (text.includes('น้ำแข็ง') || text.includes('ice') || text.includes('ยูนิต')) {
        return { label: 'น้ำแข็ง/เครื่องดื่ม', color: 'bg-[oklch(93%_0.04_220)] text-[oklch(35%_0.08_220)] border-[oklch(80%_0.07_220)]' }
    }
    if (text.includes('พัสดุ') || text.includes('ส่งของ') || text.includes('per') || text.includes('flash') || text.includes('kerry') || text.includes('ไปรษณีย์') || text.includes('ค่าส่ง')) {
        return { label: 'พัสดุ/จัดส่ง', color: 'bg-[oklch(93%_0.04_280)] text-[oklch(35%_0.08_280)] border-[oklch(82%_0.07_280)]' }
    }
    if (text.includes('ส่งเงิน') || text.includes('เจ้าของ') || text.includes('บอย') || text.includes('owner') || text.includes('drop')) {
        return { label: 'ส่งยอดเจ้าของ', color: 'bg-[oklch(92%_0.04_28)] text-[oklch(32%_0.12_28)] border-[oklch(80%_0.08_28)]' }
    }
    if (text.includes('ซ่อม') || text.includes('ช่าง') || text.includes('แก๊ส') || text.includes('ไฟ') || text.includes('น้ำ')) {
        return { label: 'ซ่อมบำรุง/สาธารณูปโภค', color: 'bg-[oklch(92%_0.03_45)] text-[oklch(38%_0.08_45)] border-[oklch(80%_0.06_45)]' }
    }
    return {
        label: type === 'in' ? 'นำเข้าทั่วไป' : 'เบิกจ่ายทั่วไป',
        color: type === 'in' ? 'bg-[oklch(94%_0.02_140)] text-[oklch(40%_0.06_140)] border-[oklch(85%_0.04_140)]' : 'bg-[oklch(94%_0.02_28)] text-[oklch(40%_0.14_28)] border-[oklch(85%_0.04_28)]'
    }
}

export default function DailyShiftsCashFlowWidget({
    shifts = [],
    loading = false,
    selectedDate = '',
    onSelectShiftTab = null,
    onRefreshShifts = null
}) {
    // Active shift filter tab: 'all' or shift.id
    const [selectedShiftId, setSelectedShiftId] = useState('all')

    // Format Bangkok time safely
    const formatTime = (isoString) => {
        if (!isoString) return '-'
        try {
            return new Date(isoString).toLocaleTimeString('th-TH', { 
                hour: '2-digit', 
                minute: '2-digit',
                timeZone: 'Asia/Bangkok'
            }) + ' น.'
        } catch {
            return '-'
        }
    }

    // Sort shifts chronologically (Shift 1 morning first)
    const sortedShifts = useMemo(() => {
        return [...(shifts || [])].sort((a, b) => new Date(a.opened_at || 0) - new Date(b.opened_at || 0))
    }, [shifts])

    // Current displayed shift or combined shifts
    const activeShift = useMemo(() => {
        if (selectedShiftId === 'all') return null
        return sortedShifts.find(s => s.id === selectedShiftId) || null
    }, [selectedShiftId, sortedShifts])

    // Compute aggregated day-level cash flow across all shifts on selectedDate
    const aggregatedMetrics = useMemo(() => {
        let totalOpeningFloat = 0
        let totalCashSales = 0
        let totalCashIn = 0
        let totalCashOut = 0
        let openShiftsCount = 0
        let closedShiftsCount = 0
        const allAdjustments = []

        sortedShifts.forEach((s, idx) => {
            const isOpen = s.status === 'open'
            if (isOpen) openShiftsCount++
            else closedShiftsCount++

            const fl = Number(s.opening_float || 0)
            const cs = Number(s.cash_sales || 0)
            const tIn = Number(s.total_in || 0)
            const tOut = Number(s.total_out || 0)

            // In day aggregation, opening float of first shift is the anchor
            if (idx === 0) {
                totalOpeningFloat = fl
            }
            totalCashSales += cs
            totalCashIn += tIn
            totalCashOut += tOut

            // Collect itemized adjustments with shift attribution
            const adjs = Array.isArray(s.adjustments) ? s.adjustments : []
            adjs.forEach(a => {
                allAdjustments.push({
                    ...a,
                    shiftId: s.id,
                    staffName: s.staff_name || 'Staff',
                    shiftIndex: idx + 1
                })
            })
        })

        // In continuous shift handover, day expected cash is calculated from day anchor float + day sales + day net adjustments
        const totalExpectedCash = totalOpeningFloat + totalCashSales + totalCashIn - totalCashOut
        const totalClosedCash = sortedShifts.length > 0 ? Number(sortedShifts[sortedShifts.length - 1].closed_cash || 0) : 0
        const totalDiff = openShiftsCount > 0 ? 0 : (totalClosedCash - totalExpectedCash)

        // Sort all adjustments by timestamp descending (most recent first)
        allAdjustments.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))

        // Group adjustments by category for quick summary
        const categoryMap = {}
        allAdjustments.forEach(a => {
            const cat = classifyAdjustmentNote(a.note, a.type)
            const amt = Number(a.amount || 0)
            if (!categoryMap[cat.label]) {
                categoryMap[cat.label] = {
                    label: cat.label,
                    color: cat.color,
                    type: a.type,
                    total: 0,
                    count: 0
                }
            }
            categoryMap[cat.label].total += amt
            categoryMap[cat.label].count += 1
        })

        return {
            totalOpeningFloat,
            totalCashSales,
            totalCashIn,
            totalCashOut,
            netCashMovement: totalCashIn - totalCashOut,
            totalExpectedCash,
            totalClosedCash,
            totalDiff,
            openShiftsCount,
            closedShiftsCount,
            allAdjustments,
            categorySummary: Object.values(categoryMap).sort((a, b) => b.total - a.total)
        }
    }, [sortedShifts])

    // Current view calculations (either single shift or combined day)
    const currentViewData = useMemo(() => {
        if (activeShift) {
            const isOpen = activeShift.status === 'open'
            const fl = Number(activeShift.opening_float || 0)
            const cs = Number(activeShift.cash_sales || 0)
            const tIn = Number(activeShift.total_in || 0)
            const tOut = Number(activeShift.total_out || 0)
            const exp = Number(activeShift.expected_cash ?? (fl + cs + tIn - tOut))
            const cl = Number(activeShift.closed_cash || 0)
            const diff = Number(activeShift.difference ?? (isOpen ? 0 : (cl - exp)))
            const adjs = Array.isArray(activeShift.adjustments) ? [...activeShift.adjustments] : []
            adjs.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))

            // Category summary for this shift
            const catMap = {}
            adjs.forEach(a => {
                const cat = classifyAdjustmentNote(a.note, a.type)
                const amt = Number(a.amount || 0)
                if (!catMap[cat.label]) {
                    catMap[cat.label] = { label: cat.label, color: cat.color, type: a.type, total: 0, count: 0 }
                }
                catMap[cat.label].total += amt
                catMap[cat.label].count += 1
            })

            return {
                title: `กะที่ ${sortedShifts.indexOf(activeShift) + 1}: ${activeShift.staff_name || 'Staff'}`,
                staffName: activeShift.staff_name,
                isOpen,
                openTime: formatTime(activeShift.opened_at),
                closeTime: isOpen ? 'กำลังเปิดใช้งาน' : formatTime(activeShift.closed_at),
                openingFloat: fl,
                cashSales: cs,
                totalIn: tIn,
                totalOut: tOut,
                netCashMovement: tIn - tOut,
                expectedCash: exp,
                closedCash: cl,
                difference: diff,
                adjustments: adjs,
                categorySummary: Object.values(catMap).sort((a, b) => b.total - a.total),
                qrSales: Number(activeShift.qr_sales || 0),
                creditSales: Number(activeShift.credit_sales || 0),
                totalSales: Number(activeShift.total_sales || 0)
            }
        }

        // All shifts combined view
        return {
            title: `สรุปรวมทุกกะ (${sortedShifts.length} กะ)`,
            staffName: 'เจ้าหน้าที่ทุกคน',
            isOpen: aggregatedMetrics.openShiftsCount > 0,
            openTime: sortedShifts.length > 0 ? formatTime(sortedShifts[0].opened_at) : '-',
            closeTime: aggregatedMetrics.openShiftsCount > 0 ? `${aggregatedMetrics.openShiftsCount} กะเปิดอยู่` : 'ปิดครบทุกกะแล้ว',
            openingFloat: aggregatedMetrics.totalOpeningFloat,
            cashSales: aggregatedMetrics.totalCashSales,
            totalIn: aggregatedMetrics.totalCashIn,
            totalOut: aggregatedMetrics.totalCashOut,
            netCashMovement: aggregatedMetrics.netCashMovement,
            expectedCash: aggregatedMetrics.totalExpectedCash,
            closedCash: aggregatedMetrics.totalClosedCash,
            difference: aggregatedMetrics.totalDiff,
            adjustments: aggregatedMetrics.allAdjustments,
            categorySummary: aggregatedMetrics.categorySummary,
            qrSales: sortedShifts.reduce((s, x) => s + Number(x.qr_sales || 0), 0),
            creditSales: sortedShifts.reduce((s, x) => s + Number(x.credit_sales || 0), 0),
            totalSales: sortedShifts.reduce((s, x) => s + Number(x.total_sales || 0), 0)
        }
    }, [activeShift, sortedShifts, aggregatedMetrics])

    return (
        <div className="bg-[oklch(98%_0.006_28)] border border-[oklch(85%_0.012_28)] rounded-sm mb-6 overflow-hidden transition-all">
            {/* Header: Title & Shift Selector Tabs (Brutalist Tabular Division) */}
            <div className="flex flex-col md:flex-row md:items-stretch justify-between border-b border-[oklch(85%_0.012_28)] bg-[oklch(96%_0.008_28)]">
                {/* Left Title Cell */}
                <div className="p-3.5 md:p-4 flex items-center gap-3 border-b md:border-b-0 md:border-r border-[oklch(85%_0.012_28)]">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold tracking-wider uppercase text-[oklch(52%_0.16_28)] bg-[oklch(93%_0.03_28)] px-1.5 py-0.5 rounded-xs border border-[oklch(85%_0.06_28)]">
                                CASH DRAWER & SHIFTS
                            </span>
                            <span className="font-mono text-[11px] text-[oklch(42%_0.010_28)] font-bold">
                                // สรุปเงินสดเข้า-ออกประจำกะ
                            </span>
                        </div>
                        <div className="font-mono text-xs text-[oklch(55%_0.010_28)] mt-0.5">
                            {selectedDate} · มีทั้งหมด <strong className="text-[oklch(18%_0.012_28)]">{sortedShifts.length} กะ</strong>
                            {aggregatedMetrics.openShiftsCount > 0 && (
                                <span className="ml-1.5 text-[oklch(45%_0.08_140)] font-bold">({aggregatedMetrics.openShiftsCount} กะกำลังเปิด 🟢)</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Shift Selector Ribbon */}
                <div className="flex items-center gap-1 p-2 md:p-2.5 overflow-x-auto no-scrollbar font-mono text-xs">
                    {/* All Shifts Option */}
                    <button
                        type="button"
                        onClick={() => setSelectedShiftId('all')}
                        className={`px-3 py-1.5 rounded-xs font-bold uppercase transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                            selectedShiftId === 'all'
                                ? 'bg-[oklch(18%_0.012_28)] text-white shadow-2xs'
                                : 'bg-white hover:bg-[oklch(92%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(42%_0.010_28)]'
                        }`}
                    >
                        <span>ภาพรวมรวมทุกกะ</span>
                        <span className={`text-[10px] px-1 rounded-xs tabular-nums ${selectedShiftId === 'all' ? 'bg-white/20 text-white' : 'bg-[oklch(90%_0.010_28)]'}`}>
                            {sortedShifts.length}
                        </span>
                    </button>

                    {/* Individual Shifts */}
                    {sortedShifts.map((s, idx) => {
                        const isSelected = selectedShiftId === s.id
                        const isOpen = s.status === 'open'
                        return (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => setSelectedShiftId(s.id)}
                                className={`px-3 py-1.5 rounded-xs font-bold uppercase transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                                    isSelected
                                        ? 'bg-[oklch(18%_0.012_28)] text-white shadow-2xs'
                                        : 'bg-white hover:bg-[oklch(92%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(42%_0.010_28)]'
                                }`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-[oklch(45%_0.08_140)] animate-pulse' : 'bg-[oklch(55%_0.010_28)]'}`} />
                                <span>กะ {idx + 1}: {s.staff_name || 'Staff'}</span>
                                {isOpen && <span className="text-[9px] text-emerald-400 font-normal">[LIVE]</span>}
                            </button>
                        )
                    })}

                    {onRefreshShifts && (
                        <button
                            type="button"
                            onClick={onRefreshShifts}
                            title="รีเฟรชข้อมูลกะล่าสุด"
                            disabled={loading}
                            className="p-1.5 bg-white hover:bg-[oklch(92%_0.012_28)] border border-[oklch(85%_0.012_28)] rounded-xs text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] transition-colors cursor-pointer ml-1"
                        >
                            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        </button>
                    )}
                </div>
            </div>

            {/* Empty State Guard */}
            {sortedShifts.length === 0 ? (
                <div className="p-8 text-center font-mono">
                    <p className="text-xs font-bold text-[oklch(42%_0.010_28)] uppercase tracking-wider">
                        ยังไม่มีข้อมูลการเปิดกะ POS ในวันที่ {selectedDate}
                    </p>
                    <p className="text-[11px] text-[oklch(55%_0.010_28)] mt-1">
                        เมื่อพนักงานเปิดกะและทำรายการผ่านระบบ POS รายการเงินสดเข้า-ออกจะปรากฏที่นี่โดยอัตโนมัติ
                    </p>
                </div>
            ) : (
                <div>
                    {/* Shift Metadata Banner (Active Staff, Timing & Status) */}
                    <div className="px-4 py-2.5 bg-[oklch(95%_0.010_28)] border-b border-[oklch(88%_0.012_28)] flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[oklch(18%_0.012_28)]">{currentViewData.title}</span>
                            <span className="text-[oklch(55%_0.010_28)]">·</span>
                            <span className="text-[oklch(42%_0.010_28)] flex items-center gap-1">
                                <Clock size={12} />
                                <span>เปิด {currentViewData.openTime} → {currentViewData.closeTime}</span>
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            {currentViewData.isOpen ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs font-bold text-[10px] bg-[oklch(92%_0.04_140)] text-[oklch(35%_0.08_140)] border border-[oklch(80%_0.06_140)]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[oklch(45%_0.08_140)] animate-pulse" />
                                    <span>กะกำลังทำงานอยู่ (ACTIVE 🟢)</span>
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs font-bold text-[10px] bg-[oklch(92%_0.012_28)] text-[oklch(35%_0.012_28)] border border-[oklch(82%_0.012_28)]">
                                    <Lock size={10} />
                                    <span>ปิดกะแล้ว (CLOSED 🔒)</span>
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Cellular Drawer Reconciliation Grid (Dieter Rams + Tabular Precision) */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-[oklch(88%_0.012_28)] border-b border-[oklch(85%_0.012_28)] bg-white font-mono">
                        {/* 1. Opening Float */}
                        <div className="p-3">
                            <div className="text-[10px] uppercase font-bold text-[oklch(55%_0.010_28)] tracking-wider">
                                เงินทอนตั้งต้น
                            </div>
                            <div className="text-base md:text-lg font-bold text-[oklch(18%_0.012_28)] tabular-nums mt-1">
                                ฿{currentViewData.openingFloat.toLocaleString()}
                            </div>
                            <div className="text-[9px] text-[oklch(55%_0.010_28)] mt-0.5">
                                [FLOAT OPEN]
                            </div>
                        </div>

                        {/* 2. Cash Sales */}
                        <div className="p-3">
                            <div className="text-[10px] uppercase font-bold text-[oklch(35%_0.08_140)] tracking-wider flex items-center justify-between">
                                <span>+ ขายเงินสด</span>
                                <span className="text-[9px]">IN</span>
                            </div>
                            <div className="text-base md:text-lg font-bold text-[oklch(35%_0.08_140)] tabular-nums mt-1">
                                +฿{currentViewData.cashSales.toLocaleString()}
                            </div>
                            <div className="text-[9px] text-[oklch(55%_0.010_28)] mt-0.5">
                                [CASH SALES]
                            </div>
                        </div>

                        {/* 3. Cash In (Total In) */}
                        <div className="p-3 bg-[oklch(98%_0.02_140)]/40">
                            <div className="text-[10px] uppercase font-bold text-[oklch(35%_0.08_140)] tracking-wider flex items-center justify-between">
                                <span>+ เงินนำเข้า</span>
                                <span className="text-[9px] bg-[oklch(90%_0.04_140)] px-1 rounded-2xs">+{currentViewData.adjustments.filter(a => a.type === 'in').length}</span>
                            </div>
                            <div className="text-base md:text-lg font-bold text-[oklch(35%_0.08_140)] tabular-nums mt-1">
                                +฿{currentViewData.totalIn.toLocaleString()}
                            </div>
                            <div className="text-[9px] text-[oklch(55%_0.010_28)] mt-0.5">
                                [DEPOSITS / ทอน]
                            </div>
                        </div>

                        {/* 4. Cash Out (Total Out) */}
                        <div className="p-3 bg-[oklch(98%_0.02_28)]/40">
                            <div className="text-[10px] uppercase font-bold text-[oklch(52%_0.16_28)] tracking-wider flex items-center justify-between">
                                <span>- เงินนำออก</span>
                                <span className="text-[9px] bg-[oklch(90%_0.04_28)] px-1 rounded-2xs">-{currentViewData.adjustments.filter(a => a.type === 'out').length}</span>
                            </div>
                            <div className="text-base md:text-lg font-bold text-[oklch(52%_0.16_28)] tabular-nums mt-1">
                                -฿{currentViewData.totalOut.toLocaleString()}
                            </div>
                            <div className="text-[9px] text-[oklch(55%_0.010_28)] mt-0.5">
                                [PAYOUTS / จ่าย]
                            </div>
                        </div>

                        {/* 5. Expected in Drawer */}
                        <div className="p-3 bg-[oklch(96%_0.008_28)]">
                            <div className="text-[10px] uppercase font-bold text-[oklch(18%_0.012_28)] tracking-wider">
                                = เงินที่ควรมี
                            </div>
                            <div className="text-base md:text-lg font-bold text-[oklch(18%_0.012_28)] tabular-nums mt-1">
                                ฿{currentViewData.expectedCash.toLocaleString()}
                            </div>
                            <div className="text-[9px] text-[oklch(55%_0.010_28)] mt-0.5">
                                [EXPECTED DRAWER]
                            </div>
                        </div>

                        {/* 6. Closed Actual Cash */}
                        <div className="p-3">
                            <div className="text-[10px] uppercase font-bold text-[oklch(42%_0.010_28)] tracking-wider">
                                เงินสดนับจริง
                            </div>
                            <div className="text-base md:text-lg font-bold text-[oklch(18%_0.012_28)] tabular-nums mt-1">
                                {currentViewData.isOpen ? (
                                    <span className="text-xs font-normal text-[oklch(55%_0.010_28)]">รอนับตอนปิดกะ</span>
                                ) : (
                                    `฿${currentViewData.closedCash.toLocaleString()}`
                                )}
                            </div>
                            <div className="text-[9px] text-[oklch(55%_0.010_28)] mt-0.5">
                                [COUNTED ACTUAL]
                            </div>
                        </div>

                        {/* 7. Discrepancy Difference */}
                        <div className={`p-3 ${
                            currentViewData.isOpen 
                                ? 'bg-white' 
                                : Math.abs(currentViewData.difference) < 0.01 
                                    ? 'bg-[oklch(95%_0.04_140)]/30' 
                                    : 'bg-[oklch(95%_0.04_28)]/40'
                        }`}>
                            <div className="text-[10px] uppercase font-bold text-[oklch(42%_0.010_28)] tracking-wider">
                                ส่วนต่าง (ผลลัพธ์)
                            </div>
                            <div className="text-base md:text-lg font-bold tabular-nums mt-1">
                                {currentViewData.isOpen ? (
                                    <span className="text-xs font-normal text-[oklch(55%_0.010_28)]">—</span>
                                ) : Math.abs(currentViewData.difference) < 0.01 ? (
                                    <span className="text-[oklch(35%_0.08_140)] flex items-center gap-1 text-sm md:text-base">
                                        <CheckCircle2 size={14} />
                                        <span>ตรงยอดพอดี</span>
                                    </span>
                                ) : (
                                    <span className="text-[oklch(52%_0.16_28)] flex items-center gap-1 text-sm md:text-base">
                                        <AlertTriangle size={14} />
                                        <span>{currentViewData.difference > 0 ? `+฿${currentViewData.difference.toLocaleString()}` : `-฿${Math.abs(currentViewData.difference).toLocaleString()}`}</span>
                                    </span>
                                )}
                            </div>
                            <div className="text-[9px] text-[oklch(55%_0.010_28)] mt-0.5">
                                {currentViewData.isOpen ? '[SHIFT ACTIVE]' : Math.abs(currentViewData.difference) < 0.01 ? '[BALANCED ✓]' : currentViewData.difference > 0 ? '[CASH OVER]' : '[CASH SHORT]'}
                            </div>
                        </div>
                    </div>

                    {/* Spending Summary Category Pills */}
                    {currentViewData.categorySummary.length > 0 && (
                        <div className="px-4 py-2.5 bg-[oklch(96%_0.008_28)] border-b border-[oklch(88%_0.012_28)] flex flex-wrap items-center gap-2 font-mono text-xs">
                            <span className="text-[10px] font-bold uppercase text-[oklch(42%_0.010_28)] tracking-wider">
                                สรุปหมวดหมู่ค่าใช้จ่ายในกะ:
                            </span>
                            {currentViewData.categorySummary.map((cat, idx) => (
                                <span
                                    key={idx}
                                    className={`px-2 py-0.5 rounded-xs border text-[11px] font-bold tabular-nums flex items-center gap-1.5 ${cat.color}`}
                                >
                                    <span>{cat.label}</span>
                                    <span className="text-[10px] opacity-80">({cat.count} รายการ)</span>
                                    <strong className="ml-0.5">{cat.type === 'in' ? '+' : '-'}฿{cat.total.toLocaleString()}</strong>
                                </span>
                            ))}

                            <div className="ml-auto text-[11px] text-[oklch(42%_0.010_28)] font-bold">
                                <span>สุทธิเงินสดไหลเวียน (Net Cash): </span>
                                <strong className={currentViewData.netCashMovement >= 0 ? 'text-[oklch(35%_0.08_140)]' : 'text-[oklch(52%_0.16_28)]'}>
                                    {currentViewData.netCashMovement >= 0 ? `+฿${currentViewData.netCashMovement.toLocaleString()}` : `-฿${Math.abs(currentViewData.netCashMovement).toLocaleString()}`}
                                </strong>
                            </div>
                        </div>
                    )}

                    {/* Itemized Cash In / Cash Out Table (บอกว่าเงินเข้า-ออกใช้ทำอะไรบ้าง) */}
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-2 font-mono">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider">
                                    รายการนำเงินเข้า - ออกในลิ้นชัก (ADJUSTMENTS LOG)
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-xs bg-[oklch(90%_0.010_28)] text-[oklch(35%_0.012_28)] font-bold tabular-nums">
                                    {currentViewData.adjustments.length} รายการ
                                </span>
                            </div>

                            {onSelectShiftTab && (
                                <button
                                    type="button"
                                    onClick={() => onSelectShiftTab('shifts')}
                                    className="text-[11px] text-[oklch(52%_0.16_28)] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                                >
                                    <span>ดูรายงานกะฉบับเต็ม</span>
                                    <ChevronRight size={13} />
                                </button>
                            )}
                        </div>

                        {currentViewData.adjustments.length === 0 ? (
                            <div className="py-6 text-center border border-dashed border-[oklch(85%_0.012_28)] rounded-xs bg-[oklch(98%_0.006_28)] font-mono text-xs text-[oklch(55%_0.010_28)]">
                                ไม่มีการนำเงินสดเข้าหรือเบิกจ่ายเงินสดระหว่างกะนี้ (No Adjustments Recorded)
                            </div>
                        ) : (
                            <div className="border border-[oklch(85%_0.012_28)] rounded-xs overflow-hidden bg-white">
                                <div className="overflow-x-auto max-h-[280px] overflow-y-auto no-scrollbar">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] font-mono text-[9px] uppercase tracking-wider text-[oklch(42%_0.010_28)] select-none sticky top-0 z-10">
                                                <th className="py-2.5 px-3 w-20">เวลา</th>
                                                <th className="py-2.5 px-3 w-28">ประเภท</th>
                                                <th className="py-2.5 px-3 w-32 text-right">จำนวนเงิน</th>
                                                <th className="py-2.5 px-3">บันทึกเหตุผลว่าใช้ทำอะไร (PURPOSE / NOTE)</th>
                                                <th className="py-2.5 px-3 w-36">หมวดหมู่</th>
                                                <th className="py-2.5 px-3 w-28 text-right">ผู้บันทึก</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[oklch(92%_0.010_28)] font-sans text-[oklch(18%_0.012_28)]">
                                            {currentViewData.adjustments.map((adj, idx) => {
                                                const isIn = adj.type === 'in'
                                                const cat = classifyAdjustmentNote(adj.note, adj.type)
                                                const timeStr = adj.timestamp ? new Date(adj.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) + ' น.' : '-'
                                                const amt = Number(adj.amount || 0)

                                                return (
                                                    <tr key={adj.id || idx} className="hover:bg-[oklch(96%_0.008_28)] transition-colors">
                                                        {/* Time */}
                                                        <td className="py-2.5 px-3 font-mono text-[10px] text-[oklch(50%_0.010_28)] tabular-nums whitespace-nowrap">
                                                            {timeStr}
                                                        </td>

                                                        {/* Type Tag */}
                                                        <td className="py-2.5 px-3">
                                                            {isIn ? (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-2xs font-mono text-[9px] font-bold uppercase bg-[oklch(92%_0.04_140)] text-[oklch(35%_0.08_140)] border border-[oklch(80%_0.06_140)]">
                                                                    <ArrowDownLeft size={10} />
                                                                    <span>เงินเข้า (IN)</span>
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-2xs font-mono text-[9px] font-bold uppercase bg-[oklch(92%_0.04_28)] text-[oklch(40%_0.14_28)] border border-[oklch(80%_0.08_28)]">
                                                                    <ArrowUpRight size={10} />
                                                                    <span>เงินออก (OUT)</span>
                                                                </span>
                                                            )}
                                                        </td>

                                                        {/* Amount */}
                                                        <td className={`py-2.5 px-3 font-mono text-sm font-bold text-right tabular-nums whitespace-nowrap ${
                                                            isIn ? 'text-[oklch(35%_0.08_140)]' : 'text-[oklch(52%_0.16_28)]'
                                                        }`}>
                                                            {isIn ? `+฿${amt.toLocaleString()}` : `-฿${amt.toLocaleString()}`}
                                                        </td>

                                                        {/* Reason / Purpose Note */}
                                                        <td className="py-2.5 px-3 font-medium text-xs">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[oklch(18%_0.012_28)] font-semibold">
                                                                    {adj.note || 'ไม่ระบุบันทึก'}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        {/* Category Badge */}
                                                        <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[10px]">
                                                            <span className={`px-1.5 py-0.5 rounded-2xs border font-bold ${cat.color}`}>
                                                                {cat.label}
                                                            </span>
                                                        </td>

                                                        {/* Staff Attribution */}
                                                        <td className="py-2.5 px-3 font-mono text-[10px] text-right text-[oklch(50%_0.010_28)] whitespace-nowrap">
                                                            {adj.staffName ? `${adj.staffName} ${adj.shiftIndex ? `(กะ ${adj.shiftIndex})` : ''}` : (currentViewData.staffName || '-')}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Non-cash contextual payment summary strip */}
                    <div className="px-4 py-2 bg-[oklch(96%_0.008_28)] border-t border-[oklch(88%_0.012_28)] flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-[oklch(42%_0.010_28)]">
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-bold uppercase tracking-wider text-[10px]">ยอดชำระแบบไร้เงินสด (NON-CASH SALES):</span>
                            <span>PromptPay QR: <strong className="text-[oklch(18%_0.012_28)] tabular-nums">฿{currentViewData.qrSales.toLocaleString()}</strong></span>
                            <span>·</span>
                            <span>บัตรเครดิต: <strong className="text-[oklch(18%_0.012_28)] tabular-nums">฿{currentViewData.creditSales.toLocaleString()}</strong></span>
                            <span>·</span>
                            <span>รวมยอดขายทุกช่องทาง: <strong className="text-[oklch(18%_0.012_28)] tabular-nums">฿{currentViewData.totalSales.toLocaleString()}</strong></span>
                        </div>
                        <div className="text-[10px] text-[oklch(55%_0.010_28)]">
                            *ยอดเงินสดในลิ้นชักคิดเฉพาะเงินสดที่รับจริง (Cash Sales) + เงินทอน/นำเข้า - เบิกจ่ายออก
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
