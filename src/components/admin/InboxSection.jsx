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
            <div className="flex items-center justify-between bg-[var(--color-paper-2)] border border-[var(--brand-plum)] px-4 py-3 rounded-sm mb-4">
                <div className="flex items-center gap-3">
                    <span className="flex h-3 w-3 relative">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--brand-plum)] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--brand-plum)]"></span>
                    </span>
                    <div>
                        <div className="tabular-nums text-xs md:text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
                            <span>PRIORITY INBOX</span>
                            <span className="bg-[var(--brand-plum)] text-[var(--color-paper)] px-2 py-0.5 text-[11px] rounded-sm">
                                {bookings.length} ACTION REQUIRED
                            </span>
                        </div>
                        <p className="tabular-nums text-[13px] text-[var(--color-muted)] mt-0.5">
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
                            className="bg-[var(--color-paper)] border-2 border-[var(--color-rule)] hover:border-[var(--brand-plum)] rounded-sm p-4 flex flex-col justify-between transition-all"
                        >
                            {/* Card Header */}
                            <div className="flex justify-between items-start pb-3 border-b border-[var(--color-paper-3)] mb-3">
                                <div>
                                    <div className="tabular-nums text-base font-bold text-[var(--color-ink)] flex items-center gap-1.5">
                                        <Clock size={15} className="text-[var(--brand-plum)]" />
                                        {formatThaiTimeOnly(booking.booking_time)}
                                    </div>
                                    <div className="tabular-nums text-xs text-[var(--color-neutral)] flex items-center gap-1 mt-0.5">
                                        <Calendar size={11} />
                                        {formatThaiDateOnly(booking.booking_time)}
                                    </div>
                                </div>

                                <span className={`tabular-nums text-[11px] font-bold px-2 py-0.5 rounded-sm border ${
                                    isDineIn 
                                        ? 'bg-[var(--color-paper-2)] text-[var(--brand-plum)] border-[oklch(82%_0.012_348.33)]' 
                                        : 'bg-[oklch(94%_0.02_220)] text-[oklch(35%_0.10_220)] border-[oklch(82%_0.02_220)]'
                                }`}>
                                    {isDineIn ? 'DINE-IN' : 'PICKUP'}
                                </span>
                            </div>

                            {/* Customer Info */}
                            <div className="space-y-2 mb-3">
                                <div className="flex items-center justify-between">
                                    <div className="font-bold text-sm text-[var(--color-ink)] truncate">
                                        {customerName}
                                    </div>
                                    {booking.tables_layout?.table_name && (
                                        <span className="tabular-nums text-[11px] font-bold bg-[var(--color-paper-2)] px-1.5 py-0.5 rounded-sm">
                                            {booking.tables_layout.table_name}
                                        </span>
                                    )}
                                </div>

                                {customerPhone && (
                                    <a 
                                        href={`tel:${customerPhone}`}
                                        className="tabular-nums text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)] flex items-center gap-1.5 underline decoration-dotted"
                                    >
                                        <Phone size={12} /> {customerPhone}
                                    </a>
                                )}

                                {booking.customer_note && (
                                    <div className="tabular-nums text-xs bg-[oklch(95%_0.012_60)] text-[oklch(30%_0.05_60)] p-2 rounded-sm border border-[oklch(88%_0.02_60)]">
                                        Note: "{booking.customer_note}"
                                    </div>
                                )}
                            </div>

                            {/* Items Preview */}
                            <div className="bg-[var(--color-paper-2)] rounded-sm p-2.5 mb-4 border border-[var(--color-paper-3)] max-h-28 overflow-y-auto">
                                {booking.order_items && booking.order_items.length > 0 ? (
                                    booking.order_items.map((item, i) => {
                                        const lineTotal = Number(item.price_at_time || 0) * (item.quantity || 1)
                                        return (
                                            <div key={i} className="flex justify-between text-xs tabular-nums text-[var(--color-muted)] py-0.5 border-b border-[var(--color-paper-3)] last:border-0">
                                                <span className="truncate max-w-[140px]">{item.quantity}x {item.custom_name || item.name || item.item_name || item.menu_items?.name || 'รายการสินค้า'}</span>
                                                <span className="font-bold text-[var(--color-ink)]">฿{lineTotal.toLocaleString()}</span>
                                            </div>
                                        )
                                    })
                                ) : (
                                    <div className="tabular-nums text-xs text-[var(--color-neutral)] italic">
                                        Standard Table Reservation ({booking.pax || 2} Pax)
                                    </div>
                                )}

                                <div className="flex justify-between items-center pt-2 mt-1 border-t border-[var(--color-rule)] tabular-nums text-xs font-bold text-[var(--color-ink)]">
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
                                        className="w-full py-1.5 tabular-nums text-xs font-bold text-[oklch(35%_0.10_220)] bg-[oklch(94%_0.02_220)] hover:bg-[oklch(90%_0.03_220)] border border-[oklch(82%_0.02_220)] rounded-sm flex items-center justify-center gap-1.5 transition-colors"
                                    >
                                        <ImageIcon size={13} /> VIEW PAYMENT SLIP
                                    </button>
                                )}

                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => onUpdateStatus(booking.id, 'cancelled')}
                                        className="py-2 tabular-nums text-xs font-bold rounded-sm border border-[oklch(80%_0.05_25)] text-[oklch(45%_0.18_25)] hover:bg-[oklch(95%_0.03_25)] transition-colors flex items-center justify-center gap-1"
                                    >
                                        <X size={14} /> REJECT
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => onUpdateStatus(booking.id, 'confirmed')}
                                        className="py-2 tabular-nums text-xs font-bold rounded-sm bg-[var(--color-ink)] hover:bg-[oklch(28%_0.012_348.33)] text-[var(--color-paper)] border border-[var(--color-ink)] transition-colors flex items-center justify-center gap-1"
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
