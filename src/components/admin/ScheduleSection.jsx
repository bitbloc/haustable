/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React from 'react'
import { formatThaiTimeOnly } from '../../utils/timeUtils'
import { Printer, CheckCircle, Image as ImageIcon, Receipt } from 'lucide-react'

export default function ScheduleSection({ bookings, loading, onPrint, onViewSlip }) {
    if (loading) {
        return (
            <div className="bg-[oklch(98%_0.006_28)] border border-[oklch(85%_0.012_28)] p-12 text-center font-mono text-xs text-[oklch(55%_0.010_28)] animate-pulse rounded-sm">
                LOADING SERVICE SCHEDULE...
            </div>
        )
    }

    return (
        <div className="bg-[oklch(98%_0.006_28)] border border-[oklch(85%_0.012_28)] rounded-sm overflow-hidden">
            {/* Header */}
            <div className="p-4 md:p-5 border-b border-[oklch(85%_0.012_28)] flex justify-between items-center bg-[oklch(96%_0.008_28)]">
                <div>
                    <h2 className="font-mono text-sm md:text-base font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)] flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[oklch(45%_0.08_140)]" />
                        TODAY'S SERVICE SCHEDULE
                    </h2>
                    <p className="font-mono text-xs text-[oklch(55%_0.010_28)] mt-0.5">
                        Chronological queue of confirmed reservations and pickup orders
                    </p>
                </div>

                <div className="font-mono text-[11px] font-bold text-[oklch(18%_0.012_28)] bg-[oklch(92%_0.012_28)] px-3 py-1 rounded-sm border border-[oklch(85%_0.012_28)]">
                    {bookings.length} CONFIRMED
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead className="bg-[oklch(94%_0.010_28)] text-[10px] uppercase text-[oklch(42%_0.010_28)] font-bold tracking-wider border-b border-[oklch(85%_0.012_28)]">
                        <tr>
                            <th className="p-3.5 pl-5">TIME</th>
                            <th className="p-3.5">TABLE / TYPE</th>
                            <th className="p-3.5">GUEST</th>
                            <th className="p-3.5">ITEMS & VALUE</th>
                            <th className="p-3.5">STATUS</th>
                            <th className="p-3.5 pr-5 text-right">ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[oklch(90%_0.008_28)]">
                        {bookings.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="p-12 text-center">
                                    <div className="flex flex-col items-center gap-2 text-[oklch(55%_0.010_28)]">
                                        <div className="w-8 h-8 rounded-full border border-[oklch(80%_0.012_28)] flex items-center justify-center font-mono text-sm">
                                            ✓
                                        </div>
                                        <p className="font-bold text-[oklch(18%_0.012_28)]">No confirmed bookings scheduled for today.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            bookings.map(booking => {
                                const isDineIn = booking.booking_type === 'dine_in'
                                const guestName = booking.booking_type === 'pickup' 
                                    ? (booking.pickup_contact_name || 'Guest') 
                                    : (booking.profiles?.display_name || booking.pickup_contact_name || 'Guest')

                                return (
                                    <tr key={booking.id} className="hover:bg-[oklch(96%_0.006_28)] transition-colors">
                                        <td className="p-3.5 pl-5 font-bold text-[oklch(18%_0.012_28)] whitespace-nowrap">
                                            {formatThaiTimeOnly(booking.booking_time)}
                                        </td>

                                        <td className="p-3.5">
                                            {isDineIn ? (
                                                <span className="bg-[oklch(92%_0.012_28)] text-[oklch(18%_0.012_28)] px-2.5 py-1 rounded-sm text-[11px] font-bold border border-[oklch(85%_0.012_28)]">
                                                    {booking.tables_layout?.table_name || 'Table ?'} ({booking.pax || 2}P)
                                                </span>
                                            ) : (
                                                <span className="bg-[oklch(92%_0.02_220)] text-[oklch(35%_0.10_220)] px-2.5 py-1 rounded-sm text-[11px] font-bold border border-[oklch(82%_0.02_220)]">
                                                    PICKUP
                                                </span>
                                            )}
                                        </td>

                                        <td className="p-3.5">
                                            <div className="font-sans font-bold text-sm text-[oklch(18%_0.012_28)]">
                                                {guestName}
                                            </div>
                                            {booking.customer_note && (
                                                <div className="text-[10px] text-[oklch(42%_0.010_28)] truncate max-w-[180px]">
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
                                                                <div key={i} className="text-[11px] text-[oklch(42%_0.010_28)] flex justify-between gap-2">
                                                                    <span className="truncate max-w-[140px]">{item.quantity}x {item.menu_items?.name || 'Item'}</span>
                                                                    <span className="font-bold text-[oklch(18%_0.012_28)]">฿{lineTotal.toLocaleString()}</span>
                                                                </div>
                                                            )
                                                        })}
                                                        {booking.order_items.length > 2 && (
                                                            <span className="text-[10px] text-[oklch(60%_0.010_28)]">
                                                                +{booking.order_items.length - 2} more items
                                                            </span>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="text-[11px] text-[oklch(55%_0.010_28)]">Reservation Only</span>
                                                )}
                                                <div className="text-xs font-bold text-[oklch(18%_0.012_28)] pt-0.5 border-t border-[oklch(90%_0.008_28)] mt-0.5 flex justify-between">
                                                    <span>TOTAL:</span>
                                                    <span>฿{Number(booking.total_amount || 0).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="p-3.5">
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase border ${
                                                booking.status === 'seated'
                                                    ? 'bg-[oklch(94%_0.02_220)] text-[oklch(35%_0.10_220)] border-[oklch(82%_0.02_220)]'
                                                    : (booking.status === 'completed'
                                                        ? 'bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)]'
                                                        : 'bg-[oklch(92%_0.012_140)] text-[oklch(35%_0.08_140)] border-[oklch(85%_0.08_140)]')
                                            }`}>
                                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                                {booking.status || 'CONFIRMED'}
                                            </span>
                                        </td>

                                        <td className="p-3.5 pr-5 text-right">
                                            <div className="flex justify-end items-center gap-1.5">
                                                {/* View / Copy Slip as PNG */}
                                                <button 
                                                    type="button"
                                                    onClick={() => onPrint && onPrint(booking, booking.status === 'completed' ? 'receipt' : 'billing')} 
                                                    className="p-1.5 bg-[oklch(98%_0.006_28)] hover:bg-[oklch(92%_0.012_28)] border border-[oklch(85%_0.012_28)] rounded-sm text-[oklch(35%_0.010_28)] transition-colors cursor-pointer" 
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
