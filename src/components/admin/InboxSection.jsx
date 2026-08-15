/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React from 'react'
import { formatThaiTimeOnly, formatThaiDateOnly } from '../../utils/timeUtils'
import { Check, X, Clock, Calendar, User, Phone, Image as ImageIcon, MessageSquare } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

export default function InboxSection({ bookings, onUpdateStatus, onViewSlip }) {
    if (!bookings || bookings.length === 0) return null

    return (
        <div className="mb-8 animate-in slide-in-from-top-3 duration-300">
            {/* Header Banner */}
            <div className="flex items-center justify-between bg-[oklch(94%_0.02_28)] border border-[oklch(52%_0.16_28)] px-4 py-3 rounded-sm mb-4">
                <div className="flex items-center gap-3">
                    <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[oklch(52%_0.16_28)] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-[oklch(52%_0.16_28)]"></span>
                    </span>
                    <div>
                        <div className="font-mono text-xs md:text-sm font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)] flex items-center gap-2">
                            <span>PRIORITY INBOX</span>
                            <span className="bg-[oklch(52%_0.16_28)] text-white px-2 py-0.5 text-[10px] rounded-sm">
                                {bookings.length} ACTION REQUIRED
                            </span>
                        </div>
                        <p className="font-mono text-[11px] text-[oklch(42%_0.010_28)] mt-0.5">
                            New incoming reservations and customer slip submissions awaiting review
                        </p>
                    </div>
                </div>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bookings.map(booking => {
                    const isDineIn = booking.booking_type === 'dine_in'
                    const customerName = booking.booking_type === 'pickup' 
                        ? (booking.pickup_contact_name || 'Guest') 
                        : (booking.profiles?.display_name || booking.pickup_contact_name || 'Guest')
                    const customerPhone = booking.booking_type === 'pickup'
                        ? booking.pickup_contact_phone
                        : (booking.profiles?.phone_number || booking.pickup_contact_phone)

                    return (
                        <div 
                            key={booking.id} 
                            className="bg-[oklch(98%_0.006_28)] border-2 border-[oklch(85%_0.012_28)] hover:border-[oklch(52%_0.16_28)] rounded-sm p-4 flex flex-col justify-between transition-all"
                        >
                            {/* Card Header */}
                            <div className="flex justify-between items-start pb-3 border-b border-[oklch(88%_0.008_28)] mb-3">
                                <div>
                                    <div className="font-mono text-base font-bold text-[oklch(18%_0.012_28)] flex items-center gap-1.5">
                                        <Clock size={15} className="text-[oklch(52%_0.16_28)]" />
                                        {formatThaiTimeOnly(booking.booking_time)}
                                    </div>
                                    <div className="font-mono text-[10px] text-[oklch(55%_0.010_28)] flex items-center gap-1 mt-0.5">
                                        <Calendar size={11} />
                                        {formatThaiDateOnly(booking.booking_time)}
                                    </div>
                                </div>

                                <span className={`font-mono text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider rounded-sm border ${
                                    isDineIn 
                                        ? 'bg-[oklch(94%_0.02_28)] text-[oklch(40%_0.12_28)] border-[oklch(82%_0.02_28)]' 
                                        : 'bg-[oklch(94%_0.02_220)] text-[oklch(35%_0.10_220)] border-[oklch(82%_0.02_220)]'
                                }`}>
                                    {isDineIn ? 'DINE-IN' : 'PICKUP'}
                                </span>
                            </div>

                            {/* Customer Info */}
                            <div className="space-y-2 mb-3">
                                <div className="flex items-center justify-between">
                                    <div className="font-bold text-sm text-[oklch(18%_0.012_28)] truncate">
                                        {customerName}
                                    </div>
                                    {booking.tables_layout?.table_name && (
                                        <span className="font-mono text-[10px] font-bold bg-[oklch(92%_0.012_28)] px-1.5 py-0.5 rounded-sm">
                                            {booking.tables_layout.table_name}
                                        </span>
                                    )}
                                </div>

                                {customerPhone && (
                                    <a 
                                        href={`tel:${customerPhone}`}
                                        className="font-mono text-xs text-[oklch(42%_0.010_28)] hover:text-black flex items-center gap-1.5 underline decoration-dotted"
                                    >
                                        <Phone size={12} /> {customerPhone}
                                    </a>
                                )}

                                {booking.customer_note && (
                                    <div className="font-mono text-[11px] bg-[oklch(95%_0.012_60)] text-[oklch(30%_0.05_60)] p-2 rounded-sm border border-[oklch(88%_0.02_60)]">
                                        Note: "{booking.customer_note}"
                                    </div>
                                )}
                            </div>

                            {/* Items Preview */}
                            <div className="bg-[oklch(95%_0.008_28)] rounded-sm p-2.5 mb-4 border border-[oklch(88%_0.008_28)] max-h-28 overflow-y-auto">
                                {booking.order_items && booking.order_items.length > 0 ? (
                                    booking.order_items.map((item, i) => (
                                        <div key={i} className="flex justify-between text-xs font-mono text-[oklch(42%_0.010_28)] py-0.5 border-b border-[oklch(90%_0.008_28)] last:border-0">
                                            <span className="truncate max-w-[140px]">{item.quantity}x {item.menu_items?.name || 'Item'}</span>
                                            <span>฿{Number(item.price_at_time || 0).toLocaleString()}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="font-mono text-[11px] text-[oklch(55%_0.010_28)] italic">
                                        Standard Table Reservation ({booking.pax || 2} Pax)
                                    </div>
                                )}

                                <div className="flex justify-between items-center pt-2 mt-1 border-t border-[oklch(85%_0.012_28)] font-mono text-xs font-bold text-[oklch(18%_0.012_28)]">
                                    <span>TOTAL</span>
                                    <span>฿{Number(booking.total_amount || 0).toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Slip & Action Buttons */}
                            <div className="space-y-2 mt-auto">
                                {booking.payment_slip_url && (
                                    <button
                                        type="button"
                                        onClick={() => onViewSlip && onViewSlip(booking.payment_slip_url)}
                                        className="w-full py-1.5 font-mono text-[11px] font-bold text-[oklch(35%_0.10_220)] bg-[oklch(94%_0.02_220)] hover:bg-[oklch(90%_0.03_220)] border border-[oklch(82%_0.02_220)] rounded-sm flex items-center justify-center gap-1.5 transition-colors"
                                    >
                                        <ImageIcon size={13} /> VIEW PAYMENT SLIP
                                    </button>
                                )}

                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => onUpdateStatus(booking.id, 'cancelled')}
                                        className="py-2 font-mono text-xs font-bold uppercase rounded-sm border border-[oklch(80%_0.05_25)] text-[oklch(45%_0.18_25)] hover:bg-[oklch(95%_0.03_25)] transition-colors flex items-center justify-center gap-1"
                                    >
                                        <X size={14} /> REJECT
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => onUpdateStatus(booking.id, 'confirmed')}
                                        className="py-2 font-mono text-xs font-bold uppercase rounded-sm bg-[oklch(18%_0.012_28)] hover:bg-[oklch(28%_0.012_28)] text-white border border-[oklch(18%_0.012_28)] transition-colors flex items-center justify-center gap-1"
                                    >
                                        <Check size={14} /> ACCEPT
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
