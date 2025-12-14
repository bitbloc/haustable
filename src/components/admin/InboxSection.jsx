import { formatThaiTimeOnly, formatThaiDateOnly } from '../../utils/timeUtils'
import { Check, X, Clock, Calendar, User, Phone } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

export default function InboxSection({ bookings, onUpdateStatus }) {
    if (bookings.length === 0) return null

    return (
        <div className="mb-8 animate-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3 mb-4">
                <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-red-600 rounded-full blur opacity-75 animate-pulse"></div>
                    <div className="relative bg-[#1a1a1a] rounded-full p-2 border border-orange-500/50">
                        <span className="text-xl">🔔</span>
                    </div>
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">Inbox <span className="text-orange-500">({bookings.length})</span></h2>
                    <p className="text-xs text-gray-400">Action Required: Accept or Reject these new orders.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bookings.map(booking => (
                    <div key={booking.id} className="bg-[#1a1a1a] border border-orange-500/30 rounded-2xl p-4 shadow-[0_4px_20px_-5px_rgba(249,115,22,0.1)] hover:border-orange-500/60 transition-all group">
                        {/* Header: Time & Date */}
                        <div className="flex justify-between items-start mb-3 border-b border-white/5 pb-3">
                            <div>
                                <div className="flex items-center gap-2 text-white font-bold text-lg">
                                    <Clock size={18} className="text-orange-500" />
                                    {formatThaiTimeOnly(booking.booking_time)}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                                    <Calendar size={12} />
                                    {formatThaiDateOnly(booking.booking_time)}
                                </div>
                            </div>
                            <span className="bg-orange-500/10 text-orange-400 text-[10px] px-2 py-1 rounded-full border border-orange-500/20 font-bold uppercase tracking-wider">
                                {booking.booking_type === 'dine_in' ? 'Dine-in' : 'Pickup'}
                            </span>
                        </div>

                        {/* Customer Info */}
                        <div className="flex flex-col gap-2 mb-4">
                            <div className="flex items-center gap-2 text-sm text-gray-300">
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400">
                                    <User size={14} />
                                </div>
                                <div>
                                    <div className="font-bold text-white">
                                        {booking.booking_type === 'pickup' ? booking.pickup_contact_name : (booking.profiles?.display_name || 'Guest')}
                                    </div>
                                    <div className="text-xs text-gray-500 flex items-center gap-1">
                                        <Phone size={10} />
                                        {booking.booking_type === 'pickup' ? booking.pickup_contact_phone : booking.profiles?.phone_number}
                                    </div>
                                </div>
                            </div>
                            {booking.customer_note && (
                                <div className="text-xs bg-yellow-500/10 text-yellow-200 p-2 rounded-lg border border-yellow-500/20 mt-1">
                                    "{booking.customer_note}"
                                </div>
                            )}
                        </div>

                        {/* Items Preview */}
                        <div className="mb-4 bg-black/20 rounded-xl p-3 max-h-32 overflow-y-auto custom-scrollbar">
                            {booking.order_items.map((item, i) => (
                                <div key={i} className="flex justify-between text-xs text-gray-400 mb-1 last:mb-0">
                                    <span className="text-gray-300">{item.quantity}x {item.menu_items?.name}</span>
                                    <span className="font-mono">{item.price_at_time}</span>
                                </div>
                            ))}
                            <div className="border-t border-white/10 mt-2 pt-2 flex justify-between text-sm font-bold text-white">
                                <span>Total</span>
                                <span className="text-primary">{booking.total_amount?.toLocaleString()}.-</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 mt-auto">
                            <button
                                onClick={() => onUpdateStatus(booking.id, 'cancelled')}
                                className="flex-1 py-2.5 rounded-xl bg-red-500/10 text-red-500 font-bold text-sm border border-red-500/20 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                            >
                                <X size={16} /> Reject
                            </button>
                            <button
                                onClick={() => onUpdateStatus(booking.id, 'confirmed')}
                                className="flex-[2] py-2.5 rounded-xl bg-green-500 text-black font-bold text-sm shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:bg-green-400 hover:shadow-[0_0_25px_rgba(34,197,94,0.5)] transition-all flex items-center justify-center gap-2"
                            >
                                <Check size={16} /> Accept Order
                            </button>
                        </div>

                        {booking.payment_slip_url && (
                            <div className="mt-3 text-center">
                                <a
                                    href={supabase.storage.from('slips').getPublicUrl(booking.payment_slip_url).data.publicUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-blue-400 underline hover:text-blue-300"
                                >
                                    View Payment Slip
                                </a>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
