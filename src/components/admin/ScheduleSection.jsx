/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React from 'react'
import { formatThaiTimeOnly } from '../../utils/timeUtils'
import { Printer, CheckCircle, Image as ImageIcon, Receipt } from 'lucide-react'
import { parseTableTransferInfo } from '../../utils/tableTransferHelper'

export default function ScheduleSection({ bookings, loading, onPrint, onViewSlip }) {
    if (loading) {
        return (
            <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] p-12 text-center tabular-nums text-xs text-[var(--color-neutral)] rounded-sm">
                LOADING SERVICE SCHEDULE...
            </div>
        )
    }

    return (
        <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm overflow-hidden">
            {/* Header */}
            <div className="p-4 md:p-5 border-b border-[var(--color-rule)] flex justify-between items-center bg-[var(--color-paper)]">
                <div>
                    <h2 className="tabular-nums text-sm md:text-base font-bold text-[var(--color-ink)] flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[oklch(45%_0.08_140)]" />
                        TODAY'S SERVICE SCHEDULE
                    </h2>
                    <p className="tabular-nums text-[13px] text-[var(--color-neutral)] mt-0.5">
                        Chronological queue of confirmed reservations and pickup orders
                    </p>
                </div>

                <div className="tabular-nums text-xs font-bold text-[var(--color-ink)] bg-[var(--color-paper-2)] px-3 py-1 rounded-sm border border-[var(--color-rule)]">
                    {bookings.length} CONFIRMED
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse tabular-nums text-[13px]">
                    <thead className="bg-[var(--color-paper-2)] text-xs text-[var(--color-muted)] font-bold border-b border-[var(--color-rule)]">
                        <tr>
                            <th className="p-3.5 pl-5">TIME</th>
                            <th className="p-3.5">TABLE / TYPE</th>
                            <th className="p-3.5">GUEST</th>
                            <th className="p-3.5">ITEMS & VALUE</th>
                            <th className="p-3.5">STATUS</th>
                            <th className="p-3.5 pr-5 text-right">ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-paper-3)]">
                        {bookings.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="p-12 text-center">
                                    <div className="flex flex-col items-center gap-2 text-[var(--color-neutral)]">
                                        <div className="w-8 h-8 rounded-full border border-[oklch(80%_0.012_348.33)] flex items-center justify-center tabular-nums text-sm">
                                            ✓
                                        </div>
                                        <p className="font-bold text-[var(--color-ink)]">No confirmed bookings scheduled for today.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            bookings.map(booking => {
                                const transfer = parseTableTransferInfo(booking, bookings)
                                const isDineIn = booking.booking_type === 'dine_in'
                                const guestName = booking.booking_type === 'pickup' 
                                    ? (booking.pickup_contact_name || 'Guest') 
                                    : (booking.profiles?.display_name || booking.pickup_contact_name || 'Guest')

                                return (
                                    <tr key={booking.id} className={`hover:bg-[var(--color-paper)] transition-colors ${transfer.isMergedSource ? 'opacity-75 bg-[var(--color-paper)]' : ''}`}>
                                        <td className="p-3.5 pl-5 font-bold text-[var(--color-ink)] whitespace-nowrap">
                                            {formatThaiTimeOnly(booking.booking_time)}
                                        </td>

                                        <td className="p-3.5">
                                            {transfer.isMergedSource ? (
                                                <span className="bg-[var(--color-paper-2)] text-[var(--brand-plum)] px-2.5 py-1 rounded-sm text-xs font-bold border border-[oklch(85%_0.04_348.33)]">
                                                    โต๊ะ {booking.tables_layout?.table_name || '?'} ➔ รวมเข้า {transfer.targetTableDisplay || `โต๊ะ ${transfer.mergedToTable}`}
                                                </span>
                                            ) : isDineIn ? (
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="bg-[var(--color-paper-2)] text-[var(--color-ink)] px-2.5 py-1 rounded-sm text-xs font-bold border border-[var(--color-rule)]">
                                                        {booking.tables_layout?.table_name || 'Table ?'} ({booking.pax || 2}P)
                                                    </span>
                                                    {transfer.isMergedTarget && (
                                                        <span className="bg-[oklch(92%_0.02_140)] text-[oklch(35%_0.08_140)] px-1.5 py-0.5 rounded-xs text-[11px] font-bold border border-[oklch(82%_0.04_140)]">
                                                            +รวมจาก {transfer.mergedFromTableDisplay || transfer.mergedFromTables.join(', ')}
                                                        </span>
                                                    )}
                                                    {transfer.isMoved && (
                                                        <span className="bg-[oklch(92%_0.02_220)] text-[oklch(35%_0.10_220)] px-1.5 py-0.5 rounded-xs text-[11px] font-bold border border-[oklch(82%_0.02_220)]">
                                                            ย้ายจาก {transfer.movedFromTable}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="bg-[oklch(92%_0.02_220)] text-[oklch(35%_0.10_220)] px-2.5 py-1 rounded-sm text-xs font-bold border border-[oklch(82%_0.02_220)]">
                                                    PICKUP
                                                </span>
                                            )}
                                        </td>

                                        <td className="p-3.5">
                                            <div className="font-sans font-bold text-sm text-[var(--color-ink)]">
                                                {guestName}
                                            </div>
                                            {booking.customer_note && (
                                                <div className="text-xs text-[var(--color-muted)] truncate max-w-[180px]">
                                                    Note: {booking.customer_note}
                                                </div>
                                            )}
                                        </td>

                                        <td className="p-3.5">
                                            <div className="flex flex-col gap-0.5 max-w-[220px]">
                                                {booking.order_items && booking.order_items.length > 0 ? (
                                                    <>
                                                        {booking.order_items.slice(0, 2).map((item, i) => {
                                                            const lineTotal = Number(item.price_at_time || 0) * (item.quantity || 1)
                                                            return (
                                                                <div key={i} className="text-xs text-[var(--color-muted)] flex justify-between gap-2">
                                                                    <span className="truncate max-w-[140px]">{item.quantity}x {item.custom_name || item.name || item.item_name || item.menu_items?.name || 'รายการสินค้า'}</span>
                                                                    <span className="font-bold text-[var(--color-ink)]">฿{lineTotal.toLocaleString()}</span>
                                                                </div>
                                                            )
                                                        })}
                                                        {booking.order_items.length > 2 && (
                                                            <span className="text-xs text-[var(--color-neutral)]">
                                                                +{booking.order_items.length - 2} more items
                                                            </span>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="text-xs text-[var(--color-neutral)]">Reservation Only</span>
                                                )}
                                                <div className="text-xs font-bold text-[var(--color-ink)] pt-0.5 border-t border-[var(--color-paper-3)] mt-0.5 flex justify-between">
                                                    <span>TOTAL:</span>
                                                    <span>฿{Number(booking.total_amount || 0).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="p-3.5">
                                            {transfer.isMergedSource ? (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-bold border bg-[var(--color-paper-2)] text-[var(--brand-plum)] border-[oklch(85%_0.04_348.33)]">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                                    MERGED ➔ {transfer.targetTableDisplay || transfer.mergedToTable}
                                                </span>
                                            ) : (
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-bold border ${
                                                    booking.status === 'seated'
                                                        ? 'bg-[oklch(94%_0.02_220)] text-[oklch(35%_0.10_220)] border-[oklch(82%_0.02_220)]'
                                                        : (booking.status === 'completed'
                                                            ? 'bg-[var(--color-paper-2)] text-[var(--color-muted)] border-[var(--color-rule)]'
                                                            : 'bg-[oklch(92%_0.012_140)] text-[oklch(35%_0.08_140)] border-[oklch(85%_0.08_140)]')
                                                }`}>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                                    {booking.status || 'CONFIRMED'}
                                                </span>
                                            )}
                                        </td>

                                        <td className="p-3.5 pr-5 text-right">
                                            <div className="flex justify-end items-center gap-1.5">
                                                {/* View / Copy Slip as PNG */}
                                                <button 
                                                    type="button"
                                                    onClick={() => onPrint && onPrint(booking, booking.status === 'completed' ? 'receipt' : 'billing')} 
                                                    className="p-1.5 bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-sm text-[oklch(35%_0.01_348.33)] transition-colors cursor-pointer" 
                                                    title="เปิดดูภาพสลิป/PNG (คัดลอกรูปส่ง LINE หรือบันทึกรูป)"
                                                >
                                                    <Receipt size={14} />
                                                </button>

                                                {/* View Slip */}
                                                {booking.payment_slip_url && (
                                                    <button 
                                                        type="button"
                                                        onClick={() => onViewSlip && onViewSlip(booking.payment_slip_url)} 
                                                        className="p-1.5 bg-[oklch(92%_0.02_220)] hover:bg-[oklch(88%_0.03_220)] border border-[oklch(82%_0.02_220)] text-[oklch(35%_0.10_220)] rounded-sm transition-colors" 
                                                        title="View Slip"
                                                    >
                                                        <ImageIcon size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
