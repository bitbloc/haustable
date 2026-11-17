/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useMemo } from 'react'
import { formatThaiTimeOnly, getThaiDate, formatThaiDateOnly } from '../../../utils/timeUtils'
import { isGhostPickupBooking, isInternalBlockBooking, isDuplicateGhostBooking, parseTableTransferInfo } from '../../../utils/tableTransferHelper'
import { groupOrderItemsIntoRounds } from '../../../utils/orderRoundHelper'
import { AdminSkeletonRows } from '../AdminKit'

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
    onOpenProMode
}) {
    const isToday = !selectedDate || selectedDate === getThaiDate()
    const [statusFilter, setStatusFilter] = useState('all') // all, settled, active, pickup
    const [page, setPage] = useState(1)
    const [inspectingBill, setInspectingBill] = useState(null)
    const pageSize = 15

    // Clean bookings: purge ghost pickups, maintenance blocks, and duplicate ghost table sessions
    const validBookings = useMemo(() => {
        return (bookings || []).filter(b => !isGhostPickupBooking(b) && !isInternalBlockBooking(b) && !isDuplicateGhostBooking(b, bookings))
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
        <div className="border border-[var(--color-paper-3)] bg-[var(--color-paper)] rounded-2xl p-4 sm:p-5 font-sans space-y-4 ">
            {/* Header Strip */}
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 pb-3 border-b border-[var(--color-paper-3)]">
                <div>
                    <div className="text-xs text-[var(--color-neutral)]">
                        {isToday ? 'สรุปบิลประจำวัน' : `สรุปบิลย้อนหลัง · ${selectedDate}`}
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-[var(--color-ink)] mt-0.5 tracking-tight">
                        {isToday ? 'LIST สรุปบิลประจำวัน' : `LIST สรุปบิลวันที่ ${formatThaiDateOnly(selectedDate)}`}
                    </h3>
                    <div className=" text-xs text-[var(--color-neutral)] mt-1 tabular-nums">
                        <span className="font-semibold text-[var(--color-ink)] text-sm">฿{metrics.totalRevenue.toLocaleString()}</span> · {metrics.totalCount} ออเดอร์ ({metrics.settledCount} ชำระแล้ว)
                    </div>
                </div>

                {/* Filter Tabs & Pro Mode Link */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar text-xs bg-[var(--color-paper-2)] p-1 rounded-xl border border-[var(--color-paper-3)]">
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
                                className={`px-2.5 py-1 rounded-lg font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                                    statusFilter === tab.id
                                        ? 'bg-[var(--color-ink)] text-[var(--color-paper)] '
                                        : 'text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper)]'
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span className="ml-1 text-xs opacity-80 tabular-nums">({tab.count})</span>
                            </button>
                        ))}
                    </div>

                    {onOpenProMode && (
                        <button
                            type="button"
                            onClick={onOpenProMode}
                            className="text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)] px-2.5 py-1.5 rounded-xl border border-[var(--color-paper-3)] bg-[var(--color-paper-2)] cursor-pointer whitespace-nowrap transition-colors"
                        >
                            โหมดวิเคราะห์เชิงลึก &rarr;
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area */}
            {loading ? (
                <AdminSkeletonRows rows={6} />
            ) : filteredBookings.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--color-neutral)] border border-[var(--color-paper-3)] bg-[var(--color-paper)] rounded-xl">
                    ไม่พบรายการบิลในหมวดหมู่นี้
                </div>
            ) : (
                <>
                    {/* MOBILE CARD VIEW (< 640px) */}
                    <div className="sm:hidden divide-y divide-[var(--color-paper-3)] border border-[var(--color-paper-3)] rounded-xl overflow-hidden bg-[var(--color-paper)]">
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
                            const transfer = parseTableTransferInfo(b, bookings)
                            const adMatch = (b.staff_remark || '').match(/\[AD:\s*([^\]]+)\]/i)
                            const adTag = adMatch ? adMatch[1].trim() : ((b.source || '').startsWith('online:') ? b.source.split(':')[1] : null)

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
                                    className="p-3 space-y-2 cursor-pointer hover:bg-[var(--color-paper-2)] transition-colors active:bg-[var(--color-paper-2)]"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="tabular-nums font-bold text-sm text-[var(--color-ink)]">{tableName}</span>
                                            {transfer.isMergedSource && (
                                                <span className="text-[11px] px-1.5 py-0.5 bg-[var(--color-paper-2)] text-[var(--brand-plum)] border border-[var(--brand-plum)] rounded-md tabular-nums font-semibold">
                                                    &rarr; โต๊ะ {transfer.mergedToTable}
                                                </span>
                                            )}
                                            {transfer.isMergedTarget && (
                                                <span className="text-[11px] px-1 py-0.5 bg-[oklch(92%_0.02_140)] text-[oklch(28%_0.08_140)] border border-[oklch(82%_0.04_140)] rounded-xs tabular-nums font-bold">
                                                    +รวม {transfer.mergedFromTables.join(', ')}
                                                </span>
                                            )}
                                            {isPickup && (
                                                <span className="text-[11px] px-1 py-0.5 bg-[var(--color-paper-3)] text-[var(--color-neutral)] rounded-xs tabular-nums">
                                                    PICKUP
                                                </span>
                                            )}
                                            {adTag && (
                                                <span className="text-[11px] px-1 py-0.5 bg-[oklch(93%_0.02_250)] text-[oklch(35%_0.10_250)] border border-[oklch(80%_0.04_250)] rounded-xs tabular-nums font-bold ">
                                                    AD: {adTag}
                                                </span>
                                            )}
                                            <span className=" text-xs text-[var(--color-neutral)] tabular-nums">{timeStr}</span>
                                        </div>
                                        {transfer.isMergedSource ? (
                                            <div className="text-right">
                                                {transfer.originalTotal > 0 && (
                                                    <span className=" text-xs text-[var(--color-neutral)] line-through tabular-nums mr-1">
                                                        ฿{transfer.originalTotal.toLocaleString()}
                                                    </span>
                                                )}
                                                <span className=" font-bold text-sm text-[var(--brand-plum)] tabular-nums">
                                                    ฿0
                                                </span>
                                            </div>
                                        ) : (
                                            <span className=" font-bold text-sm text-[var(--color-ink)] tabular-nums">
                                                ฿{amount.toLocaleString()}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between text-xs gap-2">
                                        <div className="text-[var(--color-muted)] truncate max-w-[200px]">
                                            {transfer.isMergedSource ? (
                                                <span className="tabular-nums text-xs text-[var(--color-muted)]">
                                                    โอนรายการไปที่ {transfer.targetTableDisplay || `โต๊ะ ${transfer.mergedToTable}`}
                                                </span>
                                            ) : itemsCount > 0 ? (
                                                <span><strong className="text-[var(--color-ink)]">{itemsCount} รายการ:</strong> {itemsPreview}</span>
                                            ) : (
                                                customerName
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {transfer.isMergedSource ? (
                                                <span className="px-1.5 py-0.5 text-[11px] font-bold rounded-xs bg-[var(--color-paper-2)] text-[var(--brand-plum)] border border-[var(--brand-plum)] tabular-nums">
                                                    รวมบิล
                                                </span>
                                            ) : isPaid ? (
                                                <span className="px-1.5 py-0.5 text-[11px] font-bold rounded-xs bg-[oklch(92%_0.012_140)] text-[oklch(35%_0.08_140)] border border-[oklch(82%_0.08_140)]">
                                                    ชำระแล้ว
                                                </span>
                                            ) : isCancelled ? (
                                                <span className="px-1.5 py-0.5 text-[11px] font-bold rounded-xs bg-[var(--color-paper-2)] text-[var(--color-neutral)]">
                                                    ยกเลิก
                                                </span>
                                            ) : isSeated ? (
                                                <span className="px-1.5 py-0.5 text-[11px] font-bold rounded-xs bg-[var(--color-ink)] text-[var(--color-paper)] tabular-nums">
                                                    LIVE
                                                </span>
                                            ) : (
                                                <span className="px-1.5 py-0.5 text-[11px] font-bold rounded-xs bg-[var(--color-paper-3)] text-[var(--color-muted)]">
                                                    {b.status}
                                                </span>
                                            )}
                                            {(b.payment_slip_url || b.slip_url) && (
                                                <span className="px-1.5 py-0.5 text-[11px] tabular-nums font-bold text-[oklch(35%_0.08_140)] bg-[oklch(92%_0.012_140)] border border-[oklch(82%_0.08_140)] rounded-xs" title="มีสลิปโอนเงิน">
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
                    <div className="hidden sm:block border border-[var(--color-rule)] rounded-xs overflow-hidden bg-[var(--color-paper)]">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-[13px] border-collapse font-sans">
                                <thead>
                                    <tr className="bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] text-[var(--color-muted)] text-xs font-bold">
                                        <th className="py-2.5 px-3 whitespace-nowrap">เวลา</th>
                                        <th className="py-2.5 px-3 whitespace-nowrap">โต๊ะ</th>
                                        <th className="py-2.5 px-3 whitespace-nowrap">ลูกค้า / ช่องทาง</th>
                                        <th className="py-2.5 px-3 whitespace-nowrap">รายการอาหาร</th>
                                        <th className="py-2.5 px-3 text-right whitespace-nowrap">ยอดรวม</th>
                                        <th className="py-2.5 px-3 text-right whitespace-nowrap">สถานะ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--color-paper-3)]">
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
                                        const transfer = parseTableTransferInfo(b, bookings)
                            const adMatch = (b.staff_remark || '').match(/\[AD:\s*([^\]]+)\]/i)
                            const adTag = adMatch ? adMatch[1].trim() : ((b.source || '').startsWith('online:') ? b.source.split(':')[1] : null)

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
                                                className="hover:bg-[var(--color-paper-2)] transition-colors cursor-pointer select-none"
                                                title="คลิกเพื่อดูรายละเอียดบิล"
                                            >
                                                {/* 1. Time */}
                                                <td className="py-2.5 px-3 text-[var(--color-neutral)] tabular-nums whitespace-nowrap">
                                                    {timeStr}
                                                </td>

                                                {/* 2. Table */}
                                                <td className="py-2.5 px-3 font-bold text-[var(--color-ink)] whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="tabular-nums">{tableName}</span>
                                                        {transfer.isMergedSource && (
                                                            <span className="text-[11px] tabular-nums px-1.5 py-0.5 rounded-md bg-[var(--color-paper-2)] text-[var(--brand-plum)] border border-[var(--brand-plum)] font-semibold">
                                                                &rarr; โต๊ะ {transfer.mergedToTable}
                                                            </span>
                                                        )}
                                                        {transfer.isMergedTarget && (
                                                            <span className="text-[11px] tabular-nums px-1.5 py-0.2 rounded-xs bg-[oklch(92%_0.02_140)] text-[oklch(28%_0.08_140)] border border-[oklch(82%_0.04_140)] font-bold">
                                                                +รวม {transfer.mergedFromTables.join(', ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* 3. Customer / Channel */}
                                                <td className="py-2.5 px-3 text-[var(--color-muted)] whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="truncate max-w-[130px]">{customerName}</span>
                                                        {isPickup ? (
                                                            <span className="text-[11px] px-1 py-0.5 bg-[var(--color-paper-3)] text-[var(--color-neutral)] rounded-xs tabular-nums">
                                                                PICKUP
                                                            </span>
                                                        ) : (
                                                            <span className="text-[11px] px-1 py-0.5 bg-[var(--color-paper-2)] text-[var(--color-neutral)] rounded-xs tabular-nums">
                                                                DINE-IN
                                                            </span>
                                                        )}
                                                        {adTag && (
                                                            <span className="text-[11px] px-1.5 py-0.2 bg-[oklch(93%_0.02_250)] text-[oklch(35%_0.10_250)] border border-[oklch(80%_0.04_250)] rounded-xs tabular-nums font-bold ">
                                                                AD: {adTag}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* 4. Items */}
                                                <td className="py-2.5 px-3 text-[var(--color-muted)] truncate max-w-[240px]">
                                                    {transfer.isMergedSource ? (
                                                        <span className="tabular-nums text-xs text-[var(--color-muted)]">
                                                            โอนรายการไปที่ {transfer.targetTableDisplay || `โต๊ะ ${transfer.mergedToTable}`}
                                                        </span>
                                                    ) : itemsCount > 0 ? (
                                                        <span>
                                                            <strong className="text-[var(--color-ink)] mr-1">{itemsCount} รายการ:</strong>
                                                            <span className="text-xs text-[var(--color-neutral)]">{itemsPreview}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-[var(--color-neutral)]">-</span>
                                                    )}
                                                </td>

                                                {/* 5. Total (text-right) */}
                                                <td className="py-2.5 px-3 text-right font-bold text-[var(--color-ink)] tabular-nums whitespace-nowrap">
                                                    {transfer.isMergedSource ? (
                                                        <div>
                                                            <div className="text-xs font-bold text-[var(--brand-plum)]">฿0 (โอนแล้ว)</div>
                                                            {transfer.originalTotal > 0 && (
                                                                <div className="text-xs text-[var(--color-neutral)] line-through">
                                                                    ฿{transfer.originalTotal.toLocaleString()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        `฿${amount.toLocaleString()}`
                                                    )}
                                                </td>

                                                {/* 6. Status (Right-aligned in same visual vertical axis) */}
                                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {transfer.isMergedSource ? (
                                                            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-[var(--color-paper-2)] text-[var(--brand-plum)] border border-[var(--brand-plum)] tabular-nums">
                                                                รวมบิล &rarr; โต๊ะ {transfer.mergedToTable}
                                                            </span>
                                                        ) : isPaid ? (
                                                            <span className="px-2 py-0.5 text-[11px] font-bold rounded-xs bg-[oklch(92%_0.012_140)] text-[oklch(35%_0.08_140)] border border-[oklch(82%_0.08_140)]">
                                                                ชำระแล้ว
                                                            </span>
                                                        ) : isSeated ? (
                                                            <span className="px-2 py-0.5 text-[11px] font-bold rounded-xs bg-[var(--color-ink)] text-[var(--color-paper)] tabular-nums">
                                                                LIVE
                                                            </span>
                                                        ) : isCancelled ? (
                                                            <span className="px-2 py-0.5 text-[11px] font-bold rounded-xs bg-[var(--color-paper-2)] text-[var(--color-neutral)]">
                                                                ยกเลิก
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 text-[11px] font-bold rounded-xs bg-[var(--color-paper-3)] text-[var(--color-muted)]">
                                                                {b.status}
                                                            </span>
                                                        )}
                                                        {(b.payment_slip_url || b.slip_url) && (
                                                            <span className="px-1.5 py-0.5 text-[11px] tabular-nums font-bold text-[oklch(35%_0.08_140)] bg-[oklch(92%_0.012_140)] border border-[oklch(82%_0.08_140)] rounded-xs" title="มีหลักฐานสลิปโอน">
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
                        <div className="flex items-center justify-between px-3 py-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-xs text-xs">
                            <span className="text-[var(--color-neutral)]">
                                หน้า <span className="tabular-nums font-bold text-[var(--color-ink)]">{page}</span> จาก <span className="tabular-nums font-bold text-[var(--color-ink)]">{totalPages}</span> ({filteredBookings.length} รายการ)
                            </span>
                            <div className="flex items-center gap-1.5 font-bold">
                                <button
                                    type="button"
                                    disabled={page <= 1}
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    className="px-2.5 py-1 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xs disabled:opacity-30 cursor-pointer hover:bg-[var(--color-paper-2)] transition-colors"
                                >
                                    ย้อนกลับ
                                </button>
                                <button
                                    type="button"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    className="px-2.5 py-1 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xs disabled:opacity-30 cursor-pointer hover:bg-[var(--color-paper-2)] transition-colors"
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
                    className="fixed inset-0 bg-[var(--color-ink)]/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-2xs"
                >
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm max-w-lg w-full p-4 sm:p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden font-sans animate-in zoom-in-95 duration-200"
                    >
                        {/* Modal Header */}
                        <div className="flex items-start justify-between pb-3 border-b border-[var(--color-rule)]">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="tabular-nums text-xl font-bold text-[var(--color-ink)]">
                                        {inspectingBill.tables_layout?.table_name || (inspectingBill.booking_type === 'pickup' ? 'PICKUP' : 'WALK-IN')}
                                    </h3>
                                    <span className="tabular-nums text-[11px] px-2 py-0.5 bg-[var(--color-paper-3)] rounded-xs text-[var(--color-ink)] font-semibold">
                                        ID: {String(inspectingBill.id).slice(0, 8)}
                                    </span>
                                </div>
                                <div className="text-xs text-[var(--color-neutral)] mt-1 flex items-center gap-2 flex-wrap">
                                    <span>เวลา: <strong className="tabular-nums text-[var(--color-ink)]">{formatThaiTimeOnly(inspectingBill.booking_time || inspectingBill.created_at)}</strong></span>
                                    <span>•</span>
                                    <span>ลูกค้า: <strong className="text-[var(--color-ink)]">{inspectingBill.profiles?.display_name || inspectingBill.customer_name || 'ลูกค้าทั่วไป'}</strong></span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setInspectingBill(null)}
                                className="text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)] px-2.5 py-1 rounded-lg bg-[var(--color-paper-2)] cursor-pointer transition-colors"
                            >
                                ปิด
                            </button>
                        </div>

                        {/* Customer / Staff Note & Merged Notice */}
                        {(() => {
                            const inspectingTransfer = parseTableTransferInfo(inspectingBill, bookings)
                            return (
                                <>
                                    {inspectingTransfer.isMergedSource && (
                                        <div className="mt-3 p-2.5 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xs flex items-center justify-between text-xs tabular-nums text-[var(--brand-plum)]">
                                            <div className="flex items-center gap-2">
                                                <span className="px-1.5 py-0.5 bg-[var(--brand-plum)] text-[var(--color-paper)] rounded-xs text-[11px] font-bold">รวมบิล</span>
                                                <span>บิลนี้ถูกรวมเข้ากับ <strong>{inspectingTransfer.targetTableDisplay || `โต๊ะ ${inspectingTransfer.mergedToTable}`}</strong> แล้ว</span>
                                            </div>
                                            {inspectingTransfer.originalTotal > 0 && (
                                                <span className="text-xs font-bold tabular-nums">ยอดเดิม ฿{inspectingTransfer.originalTotal.toLocaleString()}</span>
                                            )}
                                        </div>
                                    )}
                                    {inspectingTransfer.isMergedTarget && (
                                        <div className="mt-3 p-2.5 bg-[oklch(95%_0.02_140)] border border-[oklch(82%_0.04_140)] rounded-xs flex items-center justify-between text-xs tabular-nums text-[oklch(28%_0.08_140)]">
                                            <div className="flex items-center gap-2">
                                                <span className="px-1.5 py-0.5 bg-[oklch(45%_0.08_140)] text-[var(--color-paper)] rounded-xs text-[11px] font-bold">รวมโต๊ะ</span>
                                                <span>รวมรายการอาหารมาจาก <strong>{inspectingTransfer.mergedFromTableDisplay || `โต๊ะ ${inspectingTransfer.mergedFromTables.join(', ')}`}</strong></span>
                                            </div>
                                        </div>
                                    )}
                                    {(inspectingBill.customer_note || inspectingTransfer.cleanRemark) && (
                                        <div className="mt-3 p-2 bg-[var(--color-paper-2)] border border-[var(--color-paper-3)] text-xs text-[var(--color-muted)] rounded-xs space-y-0.5">
                                            {inspectingBill.customer_note && <div>โน้ตลูกค้า: "{inspectingBill.customer_note}"</div>}
                                            {inspectingTransfer.cleanRemark && <div>บันทึก: "{inspectingTransfer.cleanRemark}"</div>}
                                        </div>
                                    )}
                                </>
                            )
                        })()}

                        {/* Order Items Table */}
                        {(() => {
                            const billRounds = groupOrderItemsIntoRounds(inspectingBill.order_items, inspectingBill.booking_time || inspectingBill.created_at)
                            return (
                                <div className="flex-1 overflow-y-auto py-3 divide-y divide-[var(--color-paper-3)] text-xs">
                                    <div className="pb-2 flex justify-between font-bold text-xs text-[var(--color-neutral)]">
                                        <span>
                                            รายการอาหาร ({inspectingBill.order_items?.length || 0})
                                            {billRounds.hasAdditionalOrders && (
                                                <span className="tabular-nums text-xs text-[var(--brand-plum)] ml-1 font-bold">
                                                    ({billRounds.totalRounds} รอบ · สั่งเพิ่มล่าสุด {billRounds.latestOrderTimeStr})
                                                </span>
                                            )}
                                        </span>
                                        <span className="tabular-nums  ">ยอดเงิน</span>
                                    </div>

                                    {(!inspectingBill.order_items || inspectingBill.order_items.length === 0) ? (
                                        <div className="py-8 text-center text-[var(--color-neutral)]">
                                            ไม่มีรายการอาหารในบิลนี้
                                        </div>
                                    ) : billRounds.hasAdditionalOrders ? (
                                        billRounds.rounds.map(round => (
                                            <div key={round.roundNumber} className="py-2.5 first:pt-0">
                                                <div className={`p-1.5 rounded-xs border flex items-center justify-between tabular-nums text-xs font-bold mb-1.5 ${
                                                    round.isAdditional 
                                                        ? 'bg-[var(--color-paper-2)] border-[var(--brand-plum)] text-[var(--brand-plum)]' 
                                                        : 'bg-[var(--color-paper-2)] border-[var(--color-rule)] text-[var(--color-ink)]'
                                                }`}>
                                                    <span className="flex items-center gap-1.5">
                                                        <span className={`px-1.5 py-0.2 rounded-xs text-[11px] tabular-nums font-bold ${
                                                            round.isAdditional ? 'bg-[var(--brand-plum)] text-[var(--color-paper)]' : 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                                                        }`}>
                                                            {round.isInitial ? 'รอบ 1' : `รอบ ${round.roundNumber} (สั่งเพิ่ม)`}
                                                        </span>
                                                        <span>{round.timeStr} น.</span>
                                                        {round.elapsedFromStartMinutes > 0 && (
                                                            <span className="font-normal opacity-75 text-xs">
                                                                (+{round.elapsedFromStartMinutes}น.)
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="tabular-nums">
                                                        {round.items.length} รายการ · ฿{round.totalAmount.toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="space-y-1 divide-y divide-[var(--color-paper-2)] pl-1">
                                                    {round.items.map((it, idx) => {
                                                        const itemName = it.custom_name || it.menu_items?.name || 'รายการอาหาร'
                                                        const price = Number(it.price_at_time || it.menu_items?.price || 0)
                                                        const qty = Number(it.quantity || 1)
                                                        const lineTotal = price * qty

                                                        return (
                                                            <div key={it.id || idx} className="pt-1 first:pt-0 flex items-start justify-between gap-3">
                                                                <div className="flex items-start gap-2">
                                                                    <span className="w-5 h-5 flex items-center justify-center bg-[var(--color-ink)] text-[var(--color-paper)] font-bold rounded-xs text-[11px] tabular-nums shrink-0">
                                                                        {qty}
                                                                    </span>
                                                                    <div>
                                                                        <span className="font-sans font-bold text-xs text-[var(--color-ink)] block">
                                                                            {itemName}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right shrink-0">
                                                                    <span className=" font-bold text-[var(--color-ink)] tabular-nums text-xs">
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
                                                        <span className="w-5 h-5 flex items-center justify-center bg-[var(--color-ink)] text-[var(--color-paper)] font-bold rounded-xs text-[11px] tabular-nums shrink-0">
                                                            {qty}
                                                        </span>
                                                        <div>
                                                            <span className="font-sans font-bold text-xs text-[var(--color-ink)] block">
                                                                {itemName}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <span className=" font-bold text-[var(--color-ink)] tabular-nums text-xs">
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
                            <div className="p-3 bg-[var(--color-paper-2)] border-t border-[var(--color-paper-3)] rounded-xs">
                                <div className="flex items-center justify-between text-xs mb-2">
                                    <span className="font-bold text-[var(--color-ink)]">หลักฐานสลิปโอนเงิน</span>
                                    <a
                                        href={inspectingBill.payment_slip_url || inspectingBill.slip_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[var(--brand-plum)] underline tabular-nums text-xs"
                                    >
                                        [เปิดดูภาพเต็ม ↗]
                                    </a>
                                </div>
                                <div className="max-h-36 overflow-hidden rounded-xs border border-[var(--color-rule)] bg-[var(--color-paper)] flex items-center justify-center">
                                    <img
                                        src={inspectingBill.payment_slip_url || inspectingBill.slip_url}
                                        alt="สลิปโอนเงิน"
                                        className="max-h-36 object-contain"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Bill Total Footer */}
                        <div className="pt-3 border-t border-[var(--color-rule)] bg-[var(--color-paper-2)] p-3 rounded-sm space-y-1 text-xs">
                            <div className="flex justify-between items-center text-sm font-bold text-[var(--color-ink)]">
                                <span>ยอดสุทธิทั้งสิ้น:</span>
                                {(() => {
                                    const modalTransfer = parseTableTransferInfo(inspectingBill, bookings)
                                    if (modalTransfer.isMergedSource) {
                                        return (
                                            <div className="text-right tabular-nums">
                                                {modalTransfer.originalTotal > 0 && (
                                                    <span className="text-xs text-[var(--color-neutral)] line-through mr-1.5 tabular-nums">
                                                        เดิม ฿{modalTransfer.originalTotal.toLocaleString()}
                                                    </span>
                                                )}
                                                <span className="text-lg font-bold text-[var(--brand-plum)] tabular-nums">
                                                    ฿0 (โอนแล้ว)
                                                </span>
                                            </div>
                                        )
                                    }
                                    return (
                                        <span className=" text-lg text-[var(--color-ink)] tabular-nums">
                                            ฿{Number(inspectingBill.total_amount || inspectingBill.total_price || 0).toLocaleString()}
                                        </span>
                                    )
                                })()}
                            </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="pt-3 mt-2 flex items-center justify-between border-t border-[var(--color-rule)]">
                            <span className="text-xs tabular-nums text-[var(--color-neutral)]">
                                STATUS: {inspectingBill.status?.toUpperCase()}
                            </span>
                            <button
                                type="button"
                                onClick={() => setInspectingBill(null)}
                                className="px-5 py-2 bg-[var(--color-ink)] hover:bg-[oklch(28%_0.012_348.33)] text-[var(--color-paper)] font-bold text-xs rounded-xs cursor-pointer whitespace-nowrap"
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
