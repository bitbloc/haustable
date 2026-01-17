import { useState } from 'react'
import { Clock, Phone, Printer, ImageIcon, Check, X, ChefHat, LogOut, ChevronDown, ChevronUp, Users, AlertCircle, Receipt } from 'lucide-react'
import { formatThaiTimeOnly, formatThaiDateLong } from '../../utils/timeUtils'

const renderOptions = (item) => {
    if (!item.selected_options) return null
    
    // Normalize options to array of strings or Key-Value pairs
    let opts = []
    if (Array.isArray(item.selected_options)) {
        opts = item.selected_options.map(o => typeof o === 'object' ? `${o.name} (+${o.price})` : o)
    } else if (typeof item.selected_options === 'object') {
        // Handle Key-Value objects (e.g. { Doneness: 'Medium' })
        opts = Object.entries(item.selected_options).map(([key, value]) => `${key}: ${value}`)
    }
    
    if (opts.length === 0) return null
    return (
        <div className="mt-1 text-xs text-gray-400 font-medium space-y-0.5 ml-4">
            {opts.map((o, i) => <div key={i}>+ {o}</div>)}
        </div>
    )
}

export default function OrderCard({ order, onUpdateStatus, onVerifyPayment, onPrint, isSchedule = false }) {
    const isPending = order.status === 'pending'
    const isPickup = (order.booking_type === 'pickup') || (!order.tables_layout) // Fallback if type not set
    
    const customerPhone = order.profiles?.phone_number || order.pickup_contact_phone
    const customerName = order.profiles?.display_name || order.pickup_contact_name || 'Guest'
    const pax = order.pax || 0

    return (
        <div className={`
            bg-white rounded-2xl p-5 transition-all duration-300 relative group overflow-hidden
            ${isPending ? 'shadow-lg shadow-orange-500/10 border border-orange-100' : 'shadow-sm border border-gray-100 hover:border-gray-300'}
        `}>
            {isPending && <div className="absolute top-0 left-0 w-1 h-full bg-[#DFFF00]" />}

            {/* Header: Compact Row */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col gap-1">
                     <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-[#1A1A1A] leading-none">
                            {order.tables_layout?.table_name || 'Pickup'}
                        </span>
                        
                        {/* Pax: Show only if NOT pickup and > 0 */}
                        {!isPickup && pax > 0 && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                                <Users size={10} /> {pax}
                            </span>
                        )}
                        <span className="text-[10px] font-mono text-gray-300 bg-gray-50 px-1.5 py-0.5 rounded-full">
                            #{order.tracking_token ? order.tracking_token.slice(-4).toUpperCase() : order.id.slice(0,4)}
                        </span>
                     </div>

                     <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                        <span>{customerName}</span>
                         {customerPhone && (
                            <>
                                <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                <a href={`tel:${customerPhone}`} className="text-blue-600 hover:underline flex items-center gap-1">
                                   <Phone size={10} /> {customerPhone}
                                </a>
                            </>
                        )}
                     </div>
                </div>
                
                <div className="text-right">
                    <div className="text-sm font-bold text-[#1A1A1A]">
                        {formatThaiTimeOnly(order.booking_time)}
                    </div>
                    <div className="text-[10px] text-gray-400">
                        Ordered {new Date(order.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </div>

            {/* Items (Compact) */}
            <div className="space-y-3 mb-4">
                {order.order_items?.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                        <div className="text-xs font-bold text-[#1A1A1A] min-w-[1.5rem]">
                            {item.quantity}x
                        </div>
                        <div className="flex-1">
                            <div className="text-sm font-medium text-[#1A1A1A] leading-tight">
                                {item.menu_items?.name}
                            </div>
                            {renderOptions(item)}
                        </div>
                    </div>
                ))}
            </div>
            
            {/* Customer Note Preview */}
            {order.customer_note && (
                 <div className="mb-4 bg-orange-50 px-3 py-2 rounded-lg border border-orange-100 flex gap-2">
                    <AlertCircle size={14} className="text-orange-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-orange-900 font-medium line-clamp-2">
                        {order.customer_note}
                    </p>
                 </div>
            )}

            {/* Actions Footer - Clean */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                <div className="flex gap-2">
                    {/* Verify Payment Button */}
                    {order.payment_slip_url ? (
                        <button 
                            onClick={() => onVerifyPayment(order)} 
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        >
                            <Receipt size={14} /> 
                            Verify Payment
                        </button>
                    ) : (
                         <span className="text-[10px] text-gray-400 font-medium py-2 px-1">No Slip</span>
                    )}
                </div>

                <div className="flex gap-2">
                    <button onClick={() => onPrint(order)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#1A1A1A] transition-colors" title="Print Ticket">
                        <Printer size={16} />
                    </button>

                    {/* Status Actions */}
                    {order.status === 'pending' && (
                        <>
                            <button onClick={() => onUpdateStatus(order.id, 'cancelled')} className="px-3 py-2 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors">Reject</button>
                            <button onClick={() => onUpdateStatus(order.id, 'confirmed')} className="px-4 py-2 rounded-lg text-xs font-bold bg-[#1A1A1A] text-white hover:bg-black transition-transform active:scale-95 shadow-lg shadow-black/10">Accept</button>
                        </>
                    )}
                    
                    {order.status === 'confirmed' && (
                        <button onClick={() => onUpdateStatus(order.id, order.booking_type === 'pickup' ? 'ready' : 'seated')} className="px-4 py-2 rounded-lg text-xs font-bold bg-white border border-gray-200 text-[#1A1A1A] hover:bg-gray-50 transition-colors flex items-center gap-2">
                             {order.booking_type === 'pickup' ? <ChefHat size={14} /> : <Check size={14} />}
                             {order.booking_type === 'pickup' ? 'Ready' : 'Check-in'}
                        </button>
                    )}

                     {(order.status === 'ready' || order.status === 'seated') && (
                        <button onClick={() => onUpdateStatus(order.id, 'completed')} className="px-4 py-2 rounded-lg text-xs font-bold bg-[#DFFF00] text-[#1A1A1A] hover:bg-[#ccff00] shadow-sm flex items-center gap-2">
                             <LogOut size={14} /> Complete
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
