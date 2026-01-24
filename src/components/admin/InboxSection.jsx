import { formatThaiTimeOnly, formatThaiDateOnly } from '../../utils/timeUtils'
import { Check, X, Clock, Calendar, User, Phone } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

export default function InboxSection({ bookings, onUpdateStatus }) {
    if (bookings.length === 0) return null

    return (
        <div className="mb-8 animate-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3 mb-4">
                <div className="relative">
                    <div className="absolute -inset-1 bg-brand rounded-full blur opacity-50 animate-pulse"></div>
                    <div className="relative bg-white rounded-full p-2 border border-gray-100 shadow-sm">
                        <span className="text-xl">🔔</span>
                    </div>
                </div>
                <div>
                    <h2 className="text-xl font-bold text-ink">Inbox <span className="text-brandDark">({bookings.length})</span></h2>
                    <p className="text-xs text-subInk">Action Required: Accept or Reject these new orders.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bookings.map(booking => (
                    <div key={booking.id} className="bg-paper border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-brand transition-all group relative overflow-hidden">
                         {/* Decorator Line */}
                         <div className="absolute top-0 left-0 w-1 h-full bg-brand"></div>
                        
                        {/* Header: Time & Date */}
                        <div className="flex justify-between items-start mb-4 border-b border-gray-100 pb-3">
                            <div>
                                <div className="flex items-center gap-2 text-ink font-bold text-lg">
                                    <Clock size={18} className="text-brandDark" />
                                    {formatThaiTimeOnly(booking.booking_time)}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-subInk mt-1">
                                    <Calendar size={12} />
                                    {formatThaiDateOnly(booking.booking_time)}
                                </div>
                            </div>
                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${booking.booking_type === 'dine_in' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                {booking.booking_type === 'dine_in' ? 'Dine-in' : 'Pickup'}
                            </span>
                        </div>

                        {/* Customer Info */}
                        <div className="flex flex-col gap-2 mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-canvas flex items-center justify-center text-subInk border border-gray-100">
                                    <User size={16} />
                                </div>
                                <div>
                                    <div className="font-bold text-ink">
                                        {booking.booking_type === 'pickup' ? booking.pickup_contact_name : (booking.profiles?.display_name || 'Guest')}
                                    </div>
                                    <div className="text-xs text-subInk flex items-center gap-1 font-mono">
                                        <Phone size={10} />
                                        {booking.booking_type === 'pickup' ? booking.pickup_contact_phone : booking.profiles?.phone_number}
                                    </div>
                                </div>
                            </div>
                            {booking.customer_note && (
                                <div className="text-xs bg-yellow-50 text-yellow-800 p-2 rounded-lg border border-yellow-100 mt-2 font-medium">
                                    "{booking.customer_note}"
                                </div>
                            )}
                        </div>

                        {/* Items Preview */}
                        <div className="mb-5 bg-canvas rounded-lg p-3 max-h-32 overflow-y-auto custom-scrollbar border border-gray-100">
                            {booking.order_items.map((item, i) => (
                                <div key={i} className="flex justify-between text-xs text-subInk mb-1 last:mb-0">
                                    <span className="text-ink font-medium">{item.quantity}x {item.menu_items?.name}</span>
                                    <span className="font-mono text-subInk">{item.price_at_time}</span>
                                </div>
                            ))}
                            <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between text-sm font-bold text-ink">
                                <span>Total</span>
                                <span className="text-brandDark">{booking.total_amount?.toLocaleString()}.-</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 mt-auto">
                            <button
                                onClick={() => onUpdateStatus(booking.id, 'cancelled')}
                                className="flex-1 py-2.5 rounded-lg bg-gray-50 text-subInk font-bold text-sm border border-gray-200 hover:bg-red-50 hover:text-error hover:border-red-100 transition-all flex items-center justify-center gap-2"
                            >
                                <X size={16} /> Reject
                            </button>
                            <button
                                onClick={() => onUpdateStatus(booking.id, 'confirmed')}
                                className="flex-[2] py-2.5 rounded-lg bg-brand text-ink font-bold text-sm border border-brandDark/20 shadow-sm hover:bg-brandDark hover:text-white transition-all flex items-center justify-center gap-2"
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
                                    className="text-xs text-blue-500/80 underline hover:text-blue-600"
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
