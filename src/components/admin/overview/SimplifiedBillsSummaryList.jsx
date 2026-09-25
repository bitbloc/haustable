import React, { useState, useMemo } from 'react'
import { formatThaiTimeOnly, getThaiDate, formatThaiDateOnly } from '../../../utils/timeUtils'
import { isGhostPickupBooking, isInternalBlockBooking } from '../../../utils/tableTransferHelper'
import { groupOrderItemsIntoRounds } from '../../../utils/orderRoundHelper'

/**
 * SimplifiedBillsSummaryList
 * Clean, lightweight tabular summary list for Backoffice Simplified mode.
 * Dual-display: Responsive card view on mobile (<640px) and high-density table on desktop (>=640px).
 * Restored 2+1 typography, strict 4px/8px grid scale, and zero card-in-card nesting.
 */
export default function SimplifiedBillsSummaryList({
    bookings = [],
    selectedDate = getThaiDate(),
    loading = false,
    onViewSlip,
    onPrintSlip,
    onOpenProMode
}) {
    const isToday = !selectedDate || selectedDate === getThaiDate()
    const [statusFilter, setStatusFilter] = useState('all') // all, settled, active, pickup
    const [page, setPage] = useState(1)
    const [inspectingBill, setInspectingBill] = useState(null)
    const pageSize = 15

    // Clean bookings: purge ghost pickups and maintenance blocks
    const validBookings = useMemo(() => {
        return (bookings || []).filter(b => !isGhostPickupBooking(b) && !isInternalBlockBooking(b))
    }, [bookings])

    // Sort by most recent first
    const sortedBookings = useMemo(() => {
        return [...validBookings].sort((a, b) => {
            const timeA = new Date(a.booking_time || a.created_at).getTime()
            const timeB = new Date(b.booking_time || b.created_at).getTime()
            return timeB - timeA
        })
    }, [validBookings])

    // Filtered bookings
    const filteredBookings = useMemo(() => {
        if (statusFilter === 'settled') {
            return sortedBookings.filter(b => ['completed', 'paid', 'success'].includes(b.status))
        }
        if (statusFilter === 'active') {
            return sortedBookings.filter(b => {
                const isPickup = b.booking_type === 'pickup' || (b.booking_type || '').includes('takeaway')
                return ['seated', 'ready'].includes(b.status) && !isPickup
            })
        }
        if (statusFilter === 'pickup') {
            return sortedBookings.filter(b => b.booking_type === 'pickup' || (b.booking_type || '').includes('takeaway'))
        }
        return sortedBookings
    }, [sortedBookings, statusFilter])

    // Summary KPI calculation
    const metrics = useMemo(() => {
        let totalRevenue = 0
        let settledCount = 0
        let activeCount = 0
        let pickupCount = 0

        validBookings.forEach(b => {
            const amt = Number(b.total_amount || b.total_price || 0)
            const isPickup = b.booking_type === 'pickup' || (b.booking_type || '').includes('takeaway')
            if (['completed', 'paid', 'success'].includes(b.status)) {
                settledCount++
                totalRevenue += amt
            } else if (['seated', 'ready'].includes(b.status)) {
                if (!isPickup) {
                    activeCount++
                }
            }
            if (isPickup) {
                pickupCount++
            }
        })

        return {
            totalCount: validBookings.length,
            settledCount,
            activeCount,
            pickupCount,
            totalRevenue
        }
    }, [validBookings])

    // Pagination slice
    const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize))
    const paginatedBookings = useMemo(() => {
        const start = (page - 1) * pageSize
        return filteredBookings.slice(start, start + pageSize)
    }, [filteredBookings, page, pageSize])

    return (
        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] rounded-xs p-4 sm:p-5 font-sans space-y-4 shadow-2xs">
            {/* Header Strip - "The Hero Table" */}
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 pb-3 border-b border-[oklch(85%_0.012_28)]">
                <div>
                    <div className="font-mono text-[10px] font-bold text-[oklch(42%_0.010_28)] uppercase tracking-wider">
                        {isToday ? 'TODAY // สรุปบิลประจำวัน' : `${selectedDate} // สรุปบิลย้อนหลัง`}
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-[oklch(18%_0.012_28)] mt-0.5 tracking-tight">
                        {isToday ? 'LIST สรุปบิลประจำวัน' : `LIST สรุปบิลวันที่ ${formatThaiDateOnly(selectedDate)}`}
                    </h3>
                    <div className="font-mono text-xs text-[oklch(55%_0.010_28)] mt-1">
                        <span className="font-bold text-[oklch(18%_0.012_28)] text-sm">฿{metrics.totalRevenue.toLocaleString()}</span> · {metrics.totalCount} orders ({metrics.settledCount} ชำระแล้ว)
                    </div>
                </div>

                {/* Filter Tabs & Pro Mode Link */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar text-xs">
                        {[
                            { id: 'all', label: 'ทั้งหมด', count: metrics.totalCount },
                            { id: 'settled', label: 'ชำระแล้ว', count: metrics.settledCount },
                            { id: 'active', label: 'กำลังทาน', count: metrics.activeCount },
                            { id: 'pickup', label: 'สั่งกลับบ้าน', count: metrics.pickupCount }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => {
                                    setStatusFilter(tab.id)
                                    setPage(1)
                                }}
                                className={`px-2.5 py-1 rounded-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                                    statusFilter === tab.id
                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold shadow-xs'
                                        : 'bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] hover:bg-[oklch(90%_0.012_28)]'
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span className="ml-1 font-mono text-[10px] opacity-80 tabular-nums">({tab.count})</span>
                            </button>
                        ))}
                    </div>

                    {onOpenProMode && (
                        <button
                            type="button"
                            onClick={onOpenProMode}
                            className="text-[11px] font-mono text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] hover:underline cursor-pointer whitespace-nowrap ml-1 sm:ml-2"
                        >
                            PRO MODE ➔
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area */}
            {loading ? (
                <div className="py-12 text-center text-xs text-[oklch(55%_0.010_28)] animate-pulse">
                    กำลังโหลดรายการบิล...
                </div>
            ) : filteredBookings.length === 0 ? (
                <div className="py-12 text-center text-xs text-[oklch(55%_0.010_28)] border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] rounded-xs">
                    ไม่พบรายการบิลในหมวดหมู่นี้
                </div>
            ) : (
                <>
                    {/* MOBILE CARD VIEW (< 640px) */}
                    <div className="sm:hidden divide-y divide-[oklch(88%_0.012_28)] border border-[oklch(85%_0.012_28)] rounded-xs overflow-hidden bg-[oklch(97%_0.008_28)]">
                        {paginatedBookings.map((b) => {
                            const timeStr = formatThaiTimeOnly(b.booking_time || b.created_at)
                            const tableName = b.tables_layout?.table_name || (b.booking_type === 'pickup' ? 'PICKUP' : 'WALK-IN')
                            const customerName = b.profiles?.display_name || b.customer_name || 'ลูกค้าทั่วไป'
                            const itemsCount = b.order_items?.length || 0
                            const amount = Number(b.total_amount || b.total_price || 0)
                            const isPickup = b.booking_type === 'pickup' || (b.booking_type || '').includes('takeaway')
                            const isPaid = ['completed', 'paid', 'success'].includes(b.status)
                            const isSeated = ['seated', 'ready'].includes(b.status)
                            const isCancelled = ['cancelled', 'void'].includes(b.status)

                            const itemNames = (b.order_items || [])
                                .map(it => it.menu_items?.name)
                                .filter(Boolean)
                            const itemsPreview = itemNames.length > 0 
                                ? itemNames.slice(0, 2).join(', ') + (itemNames.length > 2 ? ` (+${itemNames.length - 2})` : '')
                                : '-'

                            return (
                                <div 
                                    key={b.id} 
                                    onClick={() => setInspectingBill(b)}
                                    className="p-3 space-y-2 cursor-pointer hover:bg-[oklch(95%_0.008_28)] transition-colors active:bg-[oklch(93%_0.010_28)]"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold text-sm text-[oklch(18%_0.012_28)]">{tableName}</span>
                                            {isPickup && (
                                                <span className="text-[9px] px-1 py-0.5 bg-[oklch(90%_0.010_28)] text-[oklch(55%_0.010_28)] rounded-xs font-mono">
                                                    PICKUP
                                                </span>
                                            )}
                                            <span className="font-mono text-[11px] text-[oklch(55%_0.010_28)] tabular-nums">{timeStr}</span>
                                        </div>
                                        <span className="font-mono font-bold text-sm text-[oklch(18%_0.012_28)] tabular-nums">
                                            ฿{amount.toLocaleString()}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between text-xs gap-2">
                                        <div className="text-[oklch(42%_0.010_28)] truncate max-w-[200px]">
                                            {itemsCount > 0 ? (
                                                <span><strong className="text-[oklch(18%_0.012_28)]">{itemsCount} รายการ:</strong> {itemsPreview}</span>
                                            ) : (
                                                customerName
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {isPaid ? (
                                                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-xs bg-[oklch(92%_0.012_140)] text-[oklch(35%_0.08_140)] border border-[oklch(82%_0.08_140)]">
                                                    ชำระแล้ว
                                                </span>
                                            ) : isCancelled ? (
                                                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-xs bg-[oklch(92%_0.010_28)] text-[oklch(55%_0.010_28)]">
                                                    ยกเลิก
                                                </span>
                                            ) : isSeated ? (
                                                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-xs bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-mono">
                                                    LIVE
                                                </span>
                                            ) : (
                                                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-xs bg-[oklch(90%_0.010_28)] text-[oklch(42%_0.010_28)]">
                                                    {b.status}
                                                </span>
                                            )}
                                            {(b.payment_slip_url || b.slip_url) && (
                                                <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold text-[oklch(35%_0.08_140)] bg-[oklch(92%_0.012_140)] border border-[oklch(82%_0.08_140)] rounded-xs" title="มีสลิปโอนเงิน">
                                                    โอน
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* DESKTOP TABULAR VIEW (>= 640px) - Hero Table Hierarchy */}
                    <div className="hidden sm:block border border-[oklch(85%_0.012_28)] rounded-xs overflow-hidden bg-[oklch(97%_0.008_28)]">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse font-sans">
                                <thead>
                                    <tr className="bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] text-[oklch(42%_0.010_28)] text-[11px] font-bold">
                                        <th className="py-2.5 px-3 whitespace-nowrap">เวลา</th>
                                        <th className="py-2.5 px-3 whitespace-nowrap">โต๊ะ</th>
                                        <th className="py-2.5 px-3 whitespace-nowrap">ลูกค้า / ช่องทาง</th>
                                        <th className="py-2.5 px-3 whitespace-nowrap">รายการอาหาร</th>
                                        <th className="py-2.5 px-3 text-right whitespace-nowrap">ยอดรวม</th>
                                        <th className="py-2.5 px-3 text-right whitespace-nowrap">สถานะ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[oklch(88%_0.012_28)]">
                                    {paginatedBookings.map((b) => {
                                        const timeStr = formatThaiTimeOnly(b.booking_time || b.created_at)
                                        const tableName = b.tables_layout?.table_name || (b.booking_type === 'pickup' ? 'PICKUP' : 'WALK-IN')
                                        const customerName = b.profiles?.display_name || b.customer_name || 'ลูกค้าทั่วไป'
                                        const itemsCount = b.order_items?.length || 0
                                        const amount = Number(b.total_amount || b.total_price || 0)
                                        const isPickup = b.booking_type === 'pickup' || (b.booking_type || '').includes('takeaway')
                                        const isPaid = ['completed', 'paid', 'success'].includes(b.status)
                                        const isSeated = ['seated', 'ready'].includes(b.status)
                                        const isCancelled = ['cancelled', 'void'].includes(b.status)

                                        const itemNames = (b.order_items || [])
                                            .map(it => it.menu_items?.name)
                                            .filter(Boolean)
                                        const itemsPreview = itemNames.length > 0 
                                            ? itemNames.slice(0, 2).join(', ') + (itemNames.length > 2 ? ` (+${itemNames.length - 2})` : '')
                                            : '-'

                                        return (
                                            <tr 
                                                key={b.id}
                                                onClick={() => setInspectingBill(b)}
                                                className="hover:bg-[oklch(95%_0.008_28)] transition-colors cursor-pointer select-none"
                                                title="คลิกเพื่อดูรายละเอียดบิล"
                                            >
                                                {/* 1. Time */}
                                                <td className="py-2.5 px-3 font-mono text-[oklch(55%_0.010_28)] tabular-nums whitespace-nowrap">
                                                    {timeStr}
                                                </td>

                                                {/* 2. Table */}
                                                <td className="py-2.5 px-3 font-bold text-[oklch(18%_0.012_28)] whitespace-nowrap">
                                                    <span className="font-mono">{tableName}</span>
                                                </td>

                                                {/* 3. Customer / Channel */}
                                                <td className="py-2.5 px-3 text-[oklch(42%_0.010_28)] whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="truncate max-w-[130px]">{customerName}</span>
                                                        {isPickup ? (
                                                            <span className="text-[9px] px-1 py-0.5 bg-[oklch(90%_0.010_28)] text-[oklch(55%_0.010_28)] rounded-xs font-mono">
                                                                PICKUP
                                                            </span>
                                                        ) : (
                                                            <span className="text-[9px] px-1 py-0.5 bg-[oklch(94%_0.010_28)] text-[oklch(55%_0.010_28)] rounded-xs font-mono">
                                                                DINE-IN
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* 4. Items */}
                                                <td className="py-2.5 px-3 text-[oklch(42%_0.010_28)] truncate max-w-[240px]">
                                                    {itemsCount > 0 ? (
                                                        <span>
                                                            <strong className="text-[oklch(18%_0.012_28)] mr-1">{itemsCount} รายการ:</strong>
                                                            <span className="text-xs text-[oklch(55%_0.010_28)]">{itemsPreview}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-[oklch(60%_0.010_28)]">-</span>
                                                    )}
                                                </td>

                                                {/* 5. Total (text-right) */}
                                                <td className="py-2.5 px-3 text-right font-mono font-bold text-[oklch(18%_0.012_28)] tabular-nums whitespace-nowrap">
                                                    ฿{amount.toLocaleString()}
                                                </td>

                                                {/* 6. Status (Right-aligned in same visual vertical axis) */}
                                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {isPaid ? (
                                                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-xs bg-[oklch(92%_0.012_140)] text-[oklch(35%_0.08_140)] border border-[oklch(82%_0.08_140)]">
                                                                ชำระแล้ว
                                                            </span>
                                                        ) : isSeated ? (
                                                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-xs bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-mono">
                                                                LIVE
                                                            </span>
                                                        ) : isCancelled ? (
                                                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-xs bg-[oklch(92%_0.010_28)] text-[oklch(55%_0.010_28)]">
                                                                ยกเลิก
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-xs bg-[oklch(90%_0.010_28)] text-[oklch(42%_0.010_28)]">
                                                                {b.status}
                                                            </span>
                                                        )}
                                                        {(b.payment_slip_url || b.slip_url) && (
                                                            <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold text-[oklch(35%_0.08_140)] bg-[oklch(92%_0.012_140)] border border-[oklch(82%_0.08_140)] rounded-xs" title="มีหลักฐานสลิปโอน">
                                                                โอน
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination Bar */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-3 py-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-xs text-xs">
                            <span className="text-[oklch(55%_0.010_28)]">
                                หน้า <span className="font-mono font-bold text-[oklch(18%_0.012_28)]">{page}</span> จาก <span className="font-mono font-bold text-[oklch(18%_0.012_28)]">{totalPages}</span> ({filteredBookings.length} รายการ)
                            </span>
                            <div className="flex items-center gap-1.5 font-bold">
                                <button
                                    type="button"
                                    disabled={page <= 1}
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    className="px-2.5 py-1 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-xs disabled:opacity-30 cursor-pointer hover:bg-[oklch(92%_0.012_28)] transition-colors"
                                >
                                    ย้อนกลับ
                                </button>
                                <button
                                    type="button"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    className="px-2.5 py-1 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-xs disabled:opacity-30 cursor-pointer hover:bg-[oklch(92%_0.012_28)] transition-colors"
                                >
                                    ถัดไป
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* BILL DETAIL MODAL (Rams High-Density Minimalist Modal) */}
            {inspectingBill && (
                <div 
                    onClick={() => setInspectingBill(null)}
                    className="fixed inset-0 bg-[oklch(18%_0.012_28)]/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-2xs"
                >
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-sm max-w-lg w-full p-4 sm:p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden font-sans animate-in zoom-in-95 duration-200"
                    >
                        {/* Modal Header */}
                        <div className="flex items-start justify-between pb-3 border-b border-[oklch(85%_0.012_28)]">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-mono text-xl font-bold text-[oklch(18%_0.012_28)]">
                                        {inspectingBill.tables_layout?.table_name || (inspectingBill.booking_type === 'pickup' ? 'PICKUP' : 'WALK-IN')}
                                    </h3>
                                    <span className="font-mono text-[10px] px-2 py-0.5 bg-[oklch(90%_0.010_28)] rounded-xs text-[oklch(18%_0.012_28)] font-semibold">
                                        ID: {String(inspectingBill.id).slice(0, 8)}
                                    </span>
                                </div>
                                <div className="text-xs text-[oklch(55%_0.010_28)] mt-1 flex items-center gap-2 flex-wrap">
                                    <span>เวลา: <strong className="font-mono text-[oklch(18%_0.012_28)]">{formatThaiTimeOnly(inspectingBill.booking_time || inspectingBill.created_at)}</strong></span>
                                    <span>•</span>
                                    <span>ลูกค้า: <strong className="text-[oklch(18%_0.012_28)]">{inspectingBill.profiles?.display_name || inspectingBill.customer_name || 'ลูกค้าทั่วไป'}</strong></span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setInspectingBill(null)}
                                className="text-xs font-bold text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)] p-1 cursor-pointer"
                            >
                                [ปิด ✕]
                            </button>
                        </div>

                        {/* Customer / Staff Note */}
                        {(inspectingBill.customer_note || inspectingBill.staff_remark) && (
                            <div className="mt-3 p-2 bg-[oklch(94%_0.010_28)] border border-[oklch(88%_0.012_28)] text-xs text-[oklch(42%_0.010_28)] rounded-xs space-y-0.5">
                                {inspectingBill.customer_note && <div>โน้ตลูกค้า: "{inspectingBill.customer_note}"</div>}
                                {inspectingBill.staff_remark && <div>บันทึกพนักงาน: "{inspectingBill.staff_remark}"</div>}
                            </div>
                        )}

                        {/* Order Items Table */}
                        {(() => {
                            const billRounds = groupOrderItemsIntoRounds(inspectingBill.order_items, inspectingBill.booking_time || inspectingBill.created_at)
                            return (
                                <div className="flex-1 overflow-y-auto py-3 divide-y divide-[oklch(88%_0.012_28)] text-xs">
                                    <div className="pb-2 flex justify-between font-bold text-[11px] text-[oklch(55%_0.010_28)]">
                                        <span>
                                            รายการอาหาร ({inspectingBill.order_items?.length || 0})
                                            {billRounds.hasAdditionalOrders && (
                                                <span className="font-mono text-[10px] text-[oklch(52%_0.16_28)] ml-1 font-bold">
                                                    ({billRounds.totalRounds} รอบ · สั่งเพิ่มล่าสุด {billRounds.latestOrderTimeStr})
                                                </span>
                                            )}
                                        </span>
                                        <span className="font-mono uppercase tracking-wider">ยอดเงิน</span>
                                    </div>

                                    {(!inspectingBill.order_items || inspectingBill.order_items.length === 0) ? (
                                        <div className="py-8 text-center text-[oklch(55%_0.010_28)]">
                                            ไม่มีรายการอาหารในบิลนี้
                                        </div>
                                    ) : billRounds.hasAdditionalOrders ? (
                                        billRounds.rounds.map(round => (
                                            <div key={round.roundNumber} className="py-2.5 first:pt-0">
                                                <div className={`p-1.5 rounded-xs border flex items-center justify-between font-mono text-xs font-bold mb-1.5 ${
                                                    round.isAdditional 
                                                        ? 'bg-[oklch(94%_0.015_28)] border-[oklch(52%_0.16_28)] text-[oklch(35%_0.14_28)]' 
                                                        : 'bg-[oklch(94%_0.010_28)] border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)]'
                                                }`}>
                                                    <span className="flex items-center gap-1.5">
                                                        <span className={`px-1.5 py-0.2 rounded-xs text-[9px] uppercase font-mono font-bold ${
                                                            round.isAdditional ? 'bg-[oklch(52%_0.16_28)] text-[oklch(97%_0.008_28)]' : 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]'
                                                        }`}>
                                                            {round.isInitial ? 'รอบ 1' : `รอบ ${round.roundNumber} (สั่งเพิ่ม)`}
                                                        </span>
                                                        <span>{round.timeStr} น.</span>
                                                        {round.elapsedFromStartMinutes > 0 && (
                                                            <span className="font-normal opacity-75 text-[10px]">
                                                                (+{round.elapsedFromStartMinutes}น.)
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="tabular-nums">
                                                        {round.items.length} รายการ · ฿{round.totalAmount.toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="space-y-1 divide-y divide-[oklch(92%_0.010_28)] pl-1">
                                                    {round.items.map((it, idx) => {
                                                        const itemName = it.custom_name || it.menu_items?.name || 'รายการอาหาร'
                                                        const price = Number(it.price_at_time || it.menu_items?.price || 0)
                                                        const qty = Number(it.quantity || 1)
                                                        const lineTotal = price * qty

                                                        return (
                                                            <div key={it.id || idx} className="pt-1 first:pt-0 flex items-start justify-between gap-3">
                                                                <div className="flex items-start gap-2">
                                                                    <span className="w-5 h-5 flex items-center justify-center bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-mono font-bold rounded-xs text-[11px] tabular-nums shrink-0">
                                                                        {qty}
                                                                    </span>
                                                                    <div>
                                                                        <span className="font-sans font-bold text-xs text-[oklch(18%_0.012_28)] block">
                                                                            {itemName}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right shrink-0">
                                                                    <span className="font-mono font-bold text-[oklch(18%_0.012_28)] tabular-nums text-xs">
                                                                        ฿{lineTotal.toLocaleString()}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        inspectingBill.order_items.map((it, idx) => {
                                            const itemName = it.custom_name || it.menu_items?.name || 'รายการอาหาร'
                                            const price = Number(it.price_at_time || it.menu_items?.price || 0)
                                            const qty = Number(it.quantity || 1)
                                            const lineTotal = price * qty

                                            return (
                                                <div key={it.id || idx} className="py-2 flex items-start justify-between gap-3">
                                                    <div className="flex items-start gap-2">
                                                        <span className="w-5 h-5 flex items-center justify-center bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-mono font-bold rounded-xs text-[11px] tabular-nums shrink-0">
                                                            {qty}
                                                        </span>
                                                        <div>
                                                            <span className="font-sans font-bold text-xs text-[oklch(18%_0.012_28)] block">
                                                                {itemName}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <span className="font-mono font-bold text-[oklch(18%_0.012_28)] tabular-nums text-xs">
                                                            ฿{lineTotal.toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            )
                        })()}

                        {/* Payment Slip Preview if present */}
                        {(inspectingBill.payment_slip_url || inspectingBill.slip_url) && (
                            <div className="p-3 bg-[oklch(94%_0.010_28)] border-t border-[oklch(88%_0.012_28)] rounded-xs">
                                <div className="flex items-center justify-between text-xs mb-2">
                                    <span className="font-bold text-[oklch(18%_0.012_28)]">หลักฐานสลิปโอนเงิน</span>
                                    <a
                                        href={inspectingBill.payment_slip_url || inspectingBill.slip_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[oklch(52%_0.16_28)] underline font-mono text-[11px]"
                                    >
                                        [เปิดดูภาพเต็ม ↗]
                                    </a>
                                </div>
                                <div className="max-h-36 overflow-hidden rounded-xs border border-[oklch(85%_0.012_28)] bg-white flex items-center justify-center">
                                    <img
                                        src={inspectingBill.payment_slip_url || inspectingBill.slip_url}
                                        alt="สลิปโอนเงิน"
                                        className="max-h-36 object-contain"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Bill Total Footer */}
                        <div className="pt-3 border-t border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] p-3 rounded-sm space-y-1 text-xs">
                            <div className="flex justify-between items-center text-sm font-bold text-[oklch(18%_0.012_28)]">
                                <span>ยอดสุทธิทั้งสิ้น:</span>
                                <span className="font-mono text-lg text-[oklch(18%_0.012_28)] tabular-nums">
                                    ฿{Number(inspectingBill.total_amount || inspectingBill.total_price || 0).toLocaleString()}
                                </span>
                            </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="pt-3 mt-2 flex items-center justify-between border-t border-[oklch(85%_0.012_28)]">
                            <span className="text-[11px] font-mono text-[oklch(55%_0.010_28)]">
                                STATUS: {inspectingBill.status?.toUpperCase()}
                            </span>
                            <button
                                type="button"
                                onClick={() => setInspectingBill(null)}
                                className="px-5 py-2 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(28%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold text-xs rounded-xs cursor-pointer whitespace-nowrap"
                            >
                                ปิดหน้าต่าง
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
