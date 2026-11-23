/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useMemo } from 'react'

/**
 * Smart Category Classifier for Shift Petty Cash Adjustments
 * Detects common Thai operational patterns (ตลาด, น้ำแข็ง, พัสดุ, เงินทอน, ส่งเงิน, etc.)
 */
export function classifyAdjustmentNote(note = '', type = 'out') {
    const text = (note || '').toLowerCase()
    
    if (text.includes('ทอน') || text.includes('float') || text.includes('change') || text.includes('สำรอง')) {
        return { label: 'เงินทอน/สำรอง', color: 'bg-[var(--status-ok-bg)] text-[var(--status-ok-ink)] border-[var(--status-ok-border)]' }
    }
    if (text.includes('ตลาด') || text.includes('ผัก') || text.includes('เนื้อ') || text.includes('หมู') || text.includes('วัตถุดิบ') || text.includes('ของสด') || text.includes('market')) {
        return { label: 'ตลาด/ของสด', color: 'bg-[var(--status-warn-bg)] text-[var(--status-warn-ink)] border-[var(--status-warn-border)]' }
    }
    if (text.includes('น้ำแข็ง') || text.includes('ice') || text.includes('ยูนิต')) {
        return { label: 'น้ำแข็ง/เครื่องดื่ม', color: 'bg-[var(--status-info-bg)] text-[var(--status-info-ink)] border-[var(--status-info-border)]' }
    }
    if (text.includes('พัสดุ') || text.includes('ส่งของ') || text.includes('per') || text.includes('flash') || text.includes('kerry') || text.includes('ไปรษณีย์') || text.includes('ค่าส่ง')) {
        return { label: 'พัสดุ/จัดส่ง', color: 'bg-[var(--color-plum-pale)] text-[var(--brand-plum)] border-[var(--color-plum-border)]' }
    }
    if (text.includes('ส่งเงิน') || text.includes('เจ้าของ') || text.includes('บอย') || text.includes('owner') || text.includes('drop')) {
        return { label: 'ส่งยอดเจ้าของ', color: 'bg-[var(--color-plum-pale)] text-[var(--brand-plum)] border-[var(--color-plum-border)]' }
    }
    if (text.includes('ซ่อม') || text.includes('ช่าง') || text.includes('แก๊ส') || text.includes('ไฟ') || text.includes('น้ำ')) {
        return { label: 'ซ่อมบำรุง/สาธารณูปโภค', color: 'bg-[var(--status-warn-bg)] text-[var(--status-warn-ink)] border-[var(--status-warn-border)]' }
    }
    return {
        label: type === 'in' ? 'นำเข้าทั่วไป' : 'เบิกจ่ายทั่วไป',
        color: type === 'in'
            ? 'bg-[var(--status-ok-bg)] text-[var(--status-ok-ink)] border-[var(--status-ok-border)]'
            : 'bg-[var(--color-paper-2)] text-[var(--brand-plum)] border-[var(--color-plum-border)]'
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
        <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xl mb-6 overflow-hidden">
            {/* Header: Title & Shift Selector Tabs (Brutalist Tabular Division) */}
            <div className="flex flex-col md:flex-row md:items-stretch justify-between border-b border-[var(--color-rule)] bg-[var(--color-paper)]">
                {/* Left Title Cell */}
                <div className="p-3.5 md:p-4 flex items-center gap-3 border-b md:border-b-0 md:border-r border-[var(--color-rule)]">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="tabular-nums text-[11px] font-semibold text-[var(--brand-plum)] bg-[var(--color-plum-pale)] px-2 py-0.5 rounded-md border border-[var(--color-plum-border)]">
                                ลิ้นชักและกะ POS
                            </span>
                            <span className="tabular-nums text-xs text-[var(--color-muted)] font-semibold">
                                สรุปเงินสดเข้า-ออกประจำกะ
                            </span>
                        </div>
                        <div className="tabular-nums text-xs text-[var(--color-neutral)] mt-1 flex items-center gap-x-2.5 flex-wrap">
                            <span>{selectedDate}</span>
                            <span>ทั้งหมด <strong className="text-[var(--color-ink)]">{sortedShifts.length} กะ</strong></span>
                            {aggregatedMetrics.openShiftsCount > 0 && (
                                <span className="text-[var(--status-ok-ink)] font-semibold">กำลังเปิด {aggregatedMetrics.openShiftsCount} กะ</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Shift Selector Ribbon */}
                <div className="flex items-center gap-1.5 p-2 md:p-2.5 overflow-x-auto no-scrollbar tabular-nums text-xs">
                    {/* All Shifts Option */}
                    <button
                        type="button"
                        onClick={() => setSelectedShiftId('all')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                            selectedShiftId === 'all'
                                ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                                : 'bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[var(--color-muted)]'
                        }`}
                    >
                        <span>ภาพรวมทุกกะ</span>
                        <span className={`text-[11px] px-1.5 rounded-md tabular-nums ${selectedShiftId === 'all' ? 'bg-[var(--cream)]/20 text-[var(--color-paper)]' : 'bg-[var(--color-paper-3)]'}`}>
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
                                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                                    isSelected
                                        ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                                        : 'bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[var(--color-muted)]'
                                }`}
                            >
                                <span>กะ {idx + 1}: {s.staff_name || 'พนักงาน'}</span>
                                {isOpen && (
                                    <span className={`text-[11px] px-1.5 py-0.2 rounded-md font-semibold ${
                                        isSelected ? 'bg-[var(--cream)]/20 text-[var(--color-paper)]' : 'bg-[var(--status-ok-bg)] text-[var(--status-ok-ink)]'
                                    }`}>
                                        เปิดอยู่
                                    </span>
                                )}
                            </button>
                        )
                    })}

                    {onRefreshShifts && (
                        <button
                            type="button"
                            onClick={onRefreshShifts}
                            title="รีเฟรชข้อมูลกะล่าสุด"
                            disabled={loading}
                            className="px-2.5 py-1.5 bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-lg text-[var(--color-neutral)] hover:text-[var(--color-ink)] tabular-nums text-xs font-semibold transition-colors cursor-pointer ml-1 whitespace-nowrap"
                        >
                            <span>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Empty State Guard */}
            {sortedShifts.length === 0 ? (
                <div className="p-8 text-center tabular-nums">
                    <p className="text-[13px] font-bold text-[var(--color-muted)]">
                        ยังไม่มีข้อมูลการเปิดกะ POS ในวันที่ {selectedDate}
                    </p>
                    <p className="text-[13px] text-[var(--color-neutral)] mt-1">
                        เมื่อพนักงานเปิดกะและทำรายการผ่านระบบ POS รายการเงินสดเข้า-ออกจะปรากฏที่นี่โดยอัตโนมัติ
                    </p>
                </div>
            ) : (
                <div>
                    {/* Shift Metadata Banner (Active Staff, Timing & Status) */}
                    <div className="px-4 py-2.5 bg-[var(--color-paper-2)] border-b border-[var(--color-paper-3)] flex flex-wrap items-center justify-between gap-2 tabular-nums text-xs">
                        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
                            <span className="font-bold text-[var(--color-ink)]">{currentViewData.title}</span>
                            <span className="text-[var(--color-muted)]">
                                เวลาทำการ เปิด {currentViewData.openTime} ถึง {currentViewData.closeTime}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            {currentViewData.isOpen ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] bg-[var(--status-ok-bg)] text-[var(--status-ok-ink)] border border-[var(--status-ok-border)]">
                                    กะกำลังทำงานอยู่
                                </span>
                            ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] bg-[var(--color-paper)] text-[var(--color-ink-soft)] border border-[var(--color-control)]">
                                    ปิดกะแล้ว
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Cellular Drawer Reconciliation Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-[var(--color-paper-3)] border-b border-[var(--color-rule)] bg-[var(--color-paper)] tabular-nums">
                        {/* 1. Opening Float */}
                        <div className="p-3">
                            <div className="text-xs font-bold text-[var(--color-neutral)]">
                                เงินทอนตั้งต้น
                            </div>
                            <div className="text-base md:text-lg font-bold text-[var(--color-ink)] tabular-nums mt-1">
                                ฿{currentViewData.openingFloat.toLocaleString()}
                            </div>
                            <div className="text-[11px] text-[var(--color-neutral)] mt-0.5">
                                เงินเปิดลิ้นชัก
                            </div>
                        </div>

                        {/* 2. Cash Sales */}
                        <div className="p-3">
                            <div className="text-xs font-bold text-[var(--status-ok-ink)] flex items-center justify-between">
                                <span>+ ขายเงินสด</span>
                            </div>
                            <div className="text-base md:text-lg font-bold text-[var(--status-ok-ink)] tabular-nums mt-1">
                                +฿{currentViewData.cashSales.toLocaleString()}
                            </div>
                            <div className="text-[11px] text-[var(--color-neutral)] mt-0.5">
                                รับเงินสดหน้าร้าน
                            </div>
                        </div>

                        {/* 3. Cash In (Total In) */}
                        <div className="p-3 bg-[var(--status-ok-bg-soft)]">
                            <div className="text-xs font-bold text-[var(--status-ok-ink)] flex items-center justify-between">
                                <span>+ เงินนำเข้า</span>
                                <span className="text-[11px] bg-[var(--status-ok-bg)] px-1.5 rounded-md">+{currentViewData.adjustments.filter(a => a.type === 'in').length}</span>
                            </div>
                            <div className="text-base md:text-lg font-bold text-[var(--status-ok-ink)] tabular-nums mt-1">
                                +฿{currentViewData.totalIn.toLocaleString()}
                            </div>
                            <div className="text-[11px] text-[var(--color-neutral)] mt-0.5">
                                เติมทอน / นำเข้า
                            </div>
                        </div>

                        {/* 4. Cash Out (Total Out) */}
                        <div className="p-3 bg-[var(--color-paper)]">
                            <div className="text-xs font-bold text-[var(--brand-plum)] flex items-center justify-between">
                                <span>- เงินนำออก</span>
                                <span className="text-[11px] bg-[var(--color-plum-pale)] px-1.5 rounded-md">-{currentViewData.adjustments.filter(a => a.type === 'out').length}</span>
                            </div>
                            <div className="text-base md:text-lg font-bold text-[var(--brand-plum)] tabular-nums mt-1">
                                -฿{currentViewData.totalOut.toLocaleString()}
                            </div>
                            <div className="text-[11px] text-[var(--color-neutral)] mt-0.5">
                                เบิกจ่าย / นำออก
                            </div>
                        </div>

                        {/* 5. Expected in Drawer */}
                        <div className="p-3 bg-[var(--color-paper)]">
                            <div className="text-xs font-bold text-[var(--color-ink)]">
                                = เงินที่ควรมี
                            </div>
                            <div className="text-base md:text-lg font-bold text-[var(--color-ink)] tabular-nums mt-1">
                                ฿{currentViewData.expectedCash.toLocaleString()}
                            </div>
                            <div className="text-[11px] text-[var(--color-neutral)] mt-0.5">
                                ยอดคาดการณ์
                            </div>
                        </div>

                        {/* 6. Closed Actual Cash */}
                        <div className="p-3">
                            <div className="text-xs font-bold text-[var(--color-muted)]">
                                เงินสดนับจริง
                            </div>
                            <div className="text-base md:text-lg font-bold text-[var(--color-ink)] tabular-nums mt-1">
                                {currentViewData.isOpen ? (
                                    <span className="text-xs font-normal text-[var(--color-neutral)]">รอนับตอนปิดกะ</span>
                                ) : (
                                    `฿${currentViewData.closedCash.toLocaleString()}`
                                )}
                            </div>
                            <div className="text-[11px] text-[var(--color-neutral)] mt-0.5">
                                นับตอนปิดรอบ
                            </div>
                        </div>

                        {/* 7. Discrepancy Difference */}
                        <div className={`p-3 ${
                            currentViewData.isOpen 
                                ? 'bg-[var(--color-paper)]' 
                                : Math.abs(currentViewData.difference) < 0.01 
                                    ? 'bg-[var(--status-ok-bg-soft)]' 
                                    : 'bg-[var(--color-plum-pale)]'
                        }`}>
                            <div className="text-xs font-bold text-[var(--color-muted)]">
                                ส่วนต่าง
                            </div>
                            <div className="text-base md:text-lg font-bold tabular-nums mt-1">
                                {currentViewData.isOpen ? (
                                    <span className="text-xs font-normal text-[var(--color-neutral)]">-</span>
                                ) : Math.abs(currentViewData.difference) < 0.01 ? (
                                    <span className="text-[var(--status-ok-ink)] text-sm md:text-base font-bold">
                                        ตรงยอดพอดี
                                    </span>
                                ) : (
                                    <span className="text-[var(--brand-plum)] text-sm md:text-base font-bold">
                                        {currentViewData.difference > 0 ? `+฿${currentViewData.difference.toLocaleString()}` : `-฿${Math.abs(currentViewData.difference).toLocaleString()}`}
                                    </span>
                                )}
                            </div>
                            <div className="text-[11px] text-[var(--color-neutral)] mt-0.5">
                                {currentViewData.isOpen ? 'กำลังเปิดกะ' : Math.abs(currentViewData.difference) < 0.01 ? 'ยอดตรง' : currentViewData.difference > 0 ? 'เงินเกิน' : 'เงินขาด'}
                            </div>
                        </div>
                    </div>

                    {/* Spending Summary Category Pills */}
                    {currentViewData.categorySummary.length > 0 && (
                        <div className="px-4 py-2.5 bg-[var(--color-paper)] border-b border-[var(--color-paper-3)] flex flex-wrap items-center gap-2 tabular-nums text-xs">
                            <span className="text-xs font-bold text-[var(--color-muted)]">
                                สรุปหมวดหมู่ค่าใช้จ่ายในกะ:
                            </span>
                            {currentViewData.categorySummary.map((cat, idx) => (
                                <span
                                    key={idx}
                                    className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold tabular-nums flex items-center gap-1.5 ${cat.color}`}
                                >
                                    <span>{cat.label}</span>
                                    <span className="text-xs opacity-80">({cat.count} รายการ)</span>
                                    <strong className="ml-0.5">{cat.type === 'in' ? '+' : '-'}฿{cat.total.toLocaleString()}</strong>
                                </span>
                            ))}

                            <div className="ml-auto text-xs text-[var(--color-muted)] font-bold">
                                <span>สุทธิเงินสดไหลเวียน: </span>
                                <strong className={currentViewData.netCashMovement >= 0 ? 'text-[var(--status-ok-ink)]' : 'text-[var(--brand-plum)]'}>
                                    {currentViewData.netCashMovement >= 0 ? `+฿${currentViewData.netCashMovement.toLocaleString()}` : `-฿${Math.abs(currentViewData.netCashMovement).toLocaleString()}`}
                                </strong>
                            </div>
                        </div>
                    )}

                    {/* Itemized Cash In / Cash Out Table */}
                    <div className="p-4">
                        <div className="flex items-center justify-between gap-2 mb-2 tabular-nums">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[var(--color-ink)]">
                                    รายการนำเงินเข้า - ออกในลิ้นชัก
                                </span>
                                <span className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--color-paper-3)] text-[var(--color-ink-soft)] font-semibold tabular-nums">
                                    {currentViewData.adjustments.length} รายการ
                                </span>
                            </div>

                            {onSelectShiftTab && (
                                <button
                                    type="button"
                                    onClick={() => onSelectShiftTab('shifts')}
                                    className="text-xs text-[var(--brand-plum)] hover:underline font-semibold cursor-pointer whitespace-nowrap"
                                >
                                    ดูรายงานกะฉบับเต็ม
                                </button>
                            )}
                        </div>

                        {currentViewData.adjustments.length === 0 ? (
                            <div className="py-6 text-center border border-dashed border-[var(--color-rule)] rounded-lg bg-[var(--color-paper)] tabular-nums text-xs text-[var(--color-neutral)]">
                                ไม่มีการนำเงินสดเข้าหรือเบิกจ่ายเงินสดระหว่างกะนี้
                            </div>
                        ) : (
                            <div className="border border-[var(--color-rule)] rounded-lg overflow-hidden bg-[var(--color-paper)]">
                                <div className="overflow-x-auto max-h-[280px] overflow-y-auto no-scrollbar">
                                    <table className="w-full text-left border-collapse text-[13px]">
                                        <thead>
                                            <tr className="bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] tabular-nums text-xs text-[var(--color-muted)] select-none sticky top-0 z-10">
                                                <th className="py-2.5 px-3 w-20">เวลา</th>
                                                <th className="py-2.5 px-3 w-28">ประเภท</th>
                                                <th className="py-2.5 px-3 w-32 text-right">จำนวนเงิน</th>
                                                <th className="py-2.5 px-3">เหตุผล / บันทึก</th>
                                                <th className="py-2.5 px-3 w-36">หมวดหมู่</th>
                                                <th className="py-2.5 px-3 w-28 text-right">ผู้บันทึก</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--color-paper-2)] font-sans text-[var(--color-ink)]">
                                            {currentViewData.adjustments.map((adj, idx) => {
                                                const isIn = adj.type === 'in'
                                                const cat = classifyAdjustmentNote(adj.note, adj.type)
                                                const timeStr = adj.timestamp ? new Date(adj.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) + ' น.' : '-'
                                                const amt = Number(adj.amount || 0)

                                                return (
                                                    <tr key={adj.id || idx} className="hover:bg-[var(--color-paper-2)] transition-colors">
                                                        {/* Time */}
                                                        <td className="py-2.5 px-3 text-[13px] text-[var(--color-neutral)] tabular-nums whitespace-nowrap">
                                                            {timeStr}
                                                        </td>

                                                        {/* Type Tag */}
                                                        <td className="py-2.5 px-3">
                                                            {isIn ? (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md tabular-nums text-[11px] font-semibold bg-[var(--status-ok-bg)] text-[var(--status-ok-ink)] border border-[var(--status-ok-border)]">
                                                                    เงินเข้า
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md tabular-nums text-[11px] font-semibold bg-[var(--color-plum-pale)] text-[var(--brand-plum)] border border-[var(--color-plum-border)]">
                                                                    เงินออก
                                                                </span>
                                                            )}
                                                        </td>

                                                        {/* Amount */}
                                                        <td className={`py-2.5 px-3 text-sm font-bold text-right tabular-nums whitespace-nowrap ${
                                                            isIn ? 'text-[var(--status-ok-ink)]' : 'text-[var(--brand-plum)]'
                                                        }`}>
                                                            {isIn ? `+฿${amt.toLocaleString()}` : `-฿${amt.toLocaleString()}`}
                                                        </td>

                                                        {/* Reason / Purpose Note */}
                                                        <td className="py-2.5 px-3 font-medium text-[13px]">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[var(--color-ink)] font-semibold">
                                                                    {adj.note || 'ไม่ระบุบันทึก'}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        {/* Category Badge */}
                                                        <td className="py-2.5 px-3 whitespace-nowrap tabular-nums text-[13px]">
                                                            <span className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${cat.color}`}>
                                                                {cat.label}
                                                            </span>
                                                        </td>

                                                        {/* Staff Attribution */}
                                                        <td className="py-2.5 px-3 tabular-nums text-[13px] text-right text-[var(--color-neutral)] whitespace-nowrap">
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
                    <div className="px-4 py-2.5 bg-[var(--color-paper-2)] border-t border-[var(--color-paper-3)] flex flex-wrap items-center justify-between gap-2 tabular-nums text-xs text-[var(--color-muted)]">
                        <div className="flex items-center gap-x-4 gap-y-1 flex-wrap">
                            <span className="font-bold text-[var(--color-ink)]">ยอดชำระแบบไร้เงินสด</span>
                            <span>PromptPay QR <strong className="text-[var(--color-ink)] tabular-nums">฿{currentViewData.qrSales.toLocaleString()}</strong></span>
                            <span>บัตรเครดิต <strong className="text-[var(--color-ink)] tabular-nums">฿{currentViewData.creditSales.toLocaleString()}</strong></span>
                            <span>รวมยอดขายทุกช่องทาง <strong className="text-[var(--color-ink)] tabular-nums">฿{currentViewData.totalSales.toLocaleString()}</strong></span>
                        </div>
                        <div className="text-xs text-[var(--color-neutral)]">
                            ยอดเงินสดในลิ้นชักคิดเฉพาะเงินสดรับจริง + เงินทอน/นำเข้า - เบิกจ่ายออก
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
