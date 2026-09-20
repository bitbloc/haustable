/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useMemo } from 'react'
import { formatThaiTimeOnly } from '../../../utils/timeUtils'
import { getShortBookingId } from '../../../utils/printerHelper'

/**
 * SimplifiedBillsSummaryList
 * Clean, lightweight tabular summary list for Backoffice Simplified mode.
 * Replaces the heavy AllDailyBillsHub in Simplified view with a concise,
 * scannable ledger of today's bills.
 */
export default function SimplifiedBillsSummaryList({
    bookings = [],
    loading = false,
    onViewSlip,
    onPrintSlip,
    onOpenProMode
}) {
    const [statusFilter, setStatusFilter] = useState('all') // all, settled, active, pickup
    const [page, setPage] = useState(1)
    const pageSize = 15

    // Sort by most recent first
    const sortedBookings = useMemo(() => {
        return [...bookings].sort((a, b) => {
            const timeA = new Date(a.booking_time || a.created_at).getTime()
            const timeB = new Date(b.booking_time || b.created_at).getTime()
            return timeB - timeA
        })
    }, [bookings])

    // Filtered bookings
    const filteredBookings = useMemo(() => {
        if (statusFilter === 'settled') {
            return sortedBookings.filter(b => ['completed', 'paid', 'success'].includes(b.status))
        }
        if (statusFilter === 'active') {
            return sortedBookings.filter(b => ['seated', 'ready'].includes(b.status))
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

        bookings.forEach(b => {
            const amt = Number(b.total_amount || 0)
            if (['completed', 'paid', 'success'].includes(b.status)) {
                settledCount++
                totalRevenue += amt
            } else if (['seated', 'ready'].includes(b.status)) {
                activeCount++
            }
            if (b.booking_type === 'pickup' || (b.booking_type || '').includes('takeaway')) {
                pickupCount++
            }
        })

        return {
            totalCount: bookings.length,
            settledCount,
            activeCount,
            pickupCount,
            totalRevenue
        }
    }, [bookings])

    // Pagination slice
    const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize))
    const paginatedBookings = useMemo(() => {
        const start = (page - 1) * pageSize
        return filteredBookings.slice(start, start + pageSize)
    }, [filteredBookings, page, pageSize])

    return (
        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] rounded-sm p-4 sm:p-5 font-mono space-y-4 shadow-2xs">
            {/* Header Strip */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[oklch(85%_0.012_28)]">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-[oklch(52%_0.16_28)] uppercase tracking-wider">
                            SUMMARY LEDGER // บันทึกบิลวันนี้
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-[oklch(90%_0.010_28)] text-[oklch(18%_0.012_28)] font-bold rounded-xs tabular-nums">
                            {metrics.totalCount} บิล
                        </span>
                    </div>
                    <h3 className="text-lg font-bold text-[oklch(18%_0.012_28)] tracking-tight mt-0.5">
                        LIST สรุปบิลประจำวัน
                    </h3>
                </div>

                {/* KPI Overview Pills */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                    <div className="px-3 py-1.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-xs">
                        <span className="text-[10px] text-[oklch(55%_0.010_28)] block">ปิดยอดแล้ว ({metrics.settledCount})</span>
                        <span className="font-bold text-[oklch(45%_0.08_140)] tabular-nums">
                            ฿{metrics.totalRevenue.toLocaleString()}
                        </span>
                    </div>
                    <div className="px-3 py-1.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-xs">
                        <span className="text-[10px] text-[oklch(55%_0.010_28)] block">กำลังเปิดบิลอยู่</span>
                        <span className="font-bold text-[oklch(52%_0.16_28)] tabular-nums">
                            {metrics.activeCount} โต๊ะ
                        </span>
                    </div>
                </div>
            </div>

            {/* Quick Filter Segmented Control */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
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
                            className={`px-3 py-1 rounded-xs font-bold transition-all cursor-pointer border ${
                                statusFilter === tab.id
                                    ? 'bg-[oklch(18%_0.012_28)] text-white border-[oklch(18%_0.012_28)]'
                                    : 'bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(90%_0.012_28)]'
                            }`}
                        >
                            <span>{tab.label}</span>
                            <span className="ml-1.5 text-[10px] opacity-75 tabular-nums">({tab.count})</span>
                        </button>
                    ))}
                </div>

                {/* Pro Mode Switcher */}
                {onOpenProMode && (
                    <button
                        type="button"
                        onClick={onOpenProMode}
                        className="text-[11px] font-bold text-[oklch(52%_0.16_28)] hover:underline cursor-pointer flex items-center gap-1"
                    >
                        <span>จัดการขั้นสูงใน PRO MODE ➔</span>
                    </button>
                )}
            </div>

            {/* Tabular Summary Table */}
            {loading ? (
                <div className="py-12 text-center text-xs text-[oklch(55%_0.010_28)] animate-pulse">
                    กำลังโหลดรายการบิล...
                </div>
            ) : filteredBookings.length === 0 ? (
                <div className="py-12 text-center text-xs text-[oklch(55%_0.010_28)] border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] rounded-xs">
                    ไม่พบรายการบิลในหมวดหมู่นี้
                </div>
            ) : (
                <div className="border border-[oklch(85%_0.012_28)] rounded-xs overflow-hidden bg-white">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] text-[oklch(42%_0.010_28)] text-[11px] font-bold">
                                    <th className="py-2.5 px-3 whitespace-nowrap">เวลา</th>
                                    <th className="py-2.5 px-3 whitespace-nowrap">โต๊ะ / ประเภท</th>
                                    <th className="py-2.5 px-3 whitespace-nowrap hidden sm:table-cell">ลูกค้า</th>
                                    <th className="py-2.5 px-3 whitespace-nowrap">รายการอาหาร</th>
                                    <th className="py-2.5 px-3 text-right whitespace-nowrap">ยอดรวม</th>
                                    <th className="py-2.5 px-3 whitespace-nowrap">สถานะ</th>
                                    <th className="py-2.5 px-3 text-right whitespace-nowrap">สลิป</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[oklch(88%_0.012_28)]">
                                {paginatedBookings.map((b) => {
                                    const timeStr = formatThaiTimeOnly(b.booking_time || b.created_at)
                                    const tableName = b.tables_layout?.table_name || (b.booking_type === 'pickup' ? 'PICKUP' : 'WALK-IN')
                                    const customerName = b.profiles?.display_name || b.customer_name || 'ลูกค้าทั่วไป'
                                    const itemsCount = b.order_items?.length || 0
                                    const amount = Number(b.total_amount || 0)
                                    const isPaid = ['completed', 'paid', 'success'].includes(b.status)
                                    const isSeated = ['seated', 'ready'].includes(b.status)
                                    const isCancelled = ['cancelled', 'void'].includes(b.status)

                                    // Preview up to 2 item names
                                    const itemNames = (b.order_items || [])
                                        .map(it => it.menu_items?.name)
                                        .filter(Boolean)
                                    const itemsPreview = itemNames.length > 0 
                                        ? itemNames.slice(0, 2).join(', ') + (itemNames.length > 2 ? ` (+${itemNames.length - 2})` : '')
                                        : '-'

                                    return (
                                        <tr 
                                            key={b.id}
                                            className="hover:bg-[oklch(96%_0.008_28)] transition-colors"
                                        >
                                            {/* Time */}
                                            <td className="py-2.5 px-3 text-[oklch(55%_0.010_28)] tabular-nums whitespace-nowrap">
                                                {timeStr}
                                            </td>

                                            {/* Table / Type */}
                                            <td className="py-2.5 px-3 font-bold text-[oklch(18%_0.012_28)] whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <span>{tableName}</span>
                                                    {b.booking_type === 'pickup' && (
                                                        <span className="text-[9px] px-1 py-0.2 bg-[oklch(90%_0.010_28)] text-[oklch(55%_0.010_28)] rounded-xs">
                                                            กลับบ้าน
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Customer */}
                                            <td className="py-2.5 px-3 text-[oklch(42%_0.010_28)] truncate max-w-[140px] hidden sm:table-cell">
                                                {customerName}
                                            </td>

                                            {/* Items Preview */}
                                            <td className="py-2.5 px-3 text-[oklch(42%_0.010_28)] truncate max-w-[200px]">
                                                {itemsCount > 0 ? (
                                                    <span>
                                                        <strong className="text-[oklch(18%_0.012_28)] mr-1">{itemsCount} รายการ:</strong>
                                                        <span className="text-[11px] text-[oklch(55%_0.010_28)]">{itemsPreview}</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-[oklch(60%_0.010_28)]">-</span>
                                                )}
                                            </td>

                                            {/* Total Amount */}
                                            <td className="py-2.5 px-3 text-right font-bold text-[oklch(18%_0.012_28)] tabular-nums whitespace-nowrap">
                                                ฿{amount.toLocaleString()}
                                            </td>

                                            {/* Status Badge */}
                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                {isPaid ? (
                                                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-xs bg-[oklch(92%_0.012_140)] text-[oklch(35%_0.08_140)] border border-[oklch(85%_0.012_140)]">
                                                        ชำระแล้ว
                                                    </span>
                                                ) : isSeated ? (
                                                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-xs bg-[oklch(92%_0.02_28)] text-[oklch(52%_0.16_28)] border border-[oklch(85%_0.012_28)]">
                                                        กำลังทาน
                                                    </span>
                                                ) : isCancelled ? (
                                                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-xs bg-[oklch(92%_0.010_28)] text-[oklch(55%_0.010_28)]">
                                                        ยกเลิก
                                                    </span>
                                                ) : (
                                                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-xs bg-[oklch(90%_0.010_28)] text-[oklch(42%_0.010_28)]">
                                                        {b.status}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Digital Slip Actions */}
                                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {onPrintSlip && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onPrintSlip(b, 'order')}
                                                            className="px-2 py-0.5 text-[10px] font-bold bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] rounded-xs cursor-pointer"
                                                            title="เปิดดูสลิปบิลดิจิทัล"
                                                        >
                                                            สลิป
                                                        </button>
                                                    )}
                                                    {b.slip_url && onViewSlip && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onViewSlip(b.slip_url)}
                                                            className="px-2 py-0.5 text-[10px] font-bold bg-[oklch(45%_0.08_140)] text-white rounded-xs cursor-pointer"
                                                            title="ดูสลิปโอนเงิน"
                                                        >
                                                            โอน
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Bar */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-3 py-2 bg-[oklch(94%_0.010_28)] border-t border-[oklch(85%_0.012_28)] text-[11px]">
                            <span className="text-[oklch(55%_0.010_28)]">
                                หน้า {page} จาก {totalPages} ({filteredBookings.length} รายการ)
                            </span>
                            <div className="flex items-center gap-1 font-bold">
                                <button
                                    type="button"
                                    disabled={page <= 1}
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    className="px-2 py-1 bg-white border border-[oklch(85%_0.012_28)] rounded-xs disabled:opacity-30 cursor-pointer"
                                >
                                    ◀ ย้อนกลับ
                                </button>
                                <button
                                    type="button"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    className="px-2 py-1 bg-white border border-[oklch(85%_0.012_28)] rounded-xs disabled:opacity-30 cursor-pointer"
                                >
                                    ถัดไป ▶
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
