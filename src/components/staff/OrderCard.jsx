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

export default function OrderCard({ order, onUpdateStatus, onViewSlip, onPrint, isSchedule = false }) {
    const [isExpanded, setIsExpanded] = useState(false)
    const isPending = order.status === 'pending'
    
    const customerPhone = order.profiles?.phone_number || order.pickup_contact_phone
    const customerName = order.profiles?.display_name || order.pickup_contact_name || 'Guest'
    const pax = order.pax || 0

    return (
        <div className={`
            bg-white rounded-2xl p-6 transition-all duration-300 relative group overflow-hidden
            ${isPending ? 'shadow-lg shadow-orange-500/10 border border-orange-100' : 'shadow-sm border border-gray-100 hover:border-gray-300'}
        `}>
            {isPending && <div className="absolute top-0 left-0 w-1 h-full bg-[#DFFF00]" />}

            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <div>
                     <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl font-black text-[#1A1A1A]">
                            {order.tables_layout?.table_name || 'Pickup'}
                        </span>
                        {pax > 0 && (
                            <span className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                <Users size={12} /> {pax}
                            </span>
                        )}
                        <span className="text-xs font-mono text-gray-300 bg-gray-50 px-2 py-1 rounded-full">
                            #{order.tracking_token ? order.tracking_token.slice(-4).toUpperCase() : order.id.slice(0,4)}
                        </span>
                     </div>
                     <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold text-gray-500">{customerName}</span>
                         {customerPhone && (
                            <a href={`tel:${customerPhone}`} className="text-xs font-medium text-blue-600 flex items-center gap-1 hover:underline decoration-1 underline-offset-2">
                                <Phone size={10} /> {customerPhone}
                            </a>
                        )}
                     </div>
                </div>
                
                <div className="text-right flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1 text-xs font-bold text-gray-700 bg-[#F4F4F4] px-2 py-1 rounded-lg">
                        <Clock className="w-3 h-3" />
                        {formatThaiTimeOnly(order.booking_time)}
                    </div>
                    <div className="text-[10px] text-gray-400">
                        Ordered: {new Date(order.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </div>

            {/* Items */}
            <div className="space-y-4 mb-4">
                {order.order_items?.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-4">
                        <div className="w-6 h-6 bg-[#F4F4F4] rounded flex items-center justify-center text-xs font-bold text-[#1A1A1A] shrink-0 mt-0.5">
                            {item.quantity}
                        </div>
                        <div className="flex-1">
                            <div className="text-sm font-bold text-[#1A1A1A] leading-tight">
                                {item.menu_items?.name}
                            </div>
                            {renderOptions(item)}
                        </div>
                         {/* Optional Price Display if needed for verify */}
                        {/* <div className="text-sm font-mono text-gray-400">{item.price_at_time}</div> */}
                    </div>
                ))}
            </div>
            
            {/* Expandable Details Section */}
            <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="pt-4 border-t border-gray-50 space-y-3 pb-2">
                    
                    {/* Customer Note */}
                    {order.customer_note && (
                         <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
                            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider block mb-1">Customer Note</span>
                            <div className="text-xs text-orange-900 font-medium leading-relaxed whitespace-pre-wrap">
                                {order.customer_note}
                            </div>
                         </div>
                    )}

                    {/* Discount Info */}
                    {(order.discount_amount > 0) && (
                        <div className="flex justify-between items-center bg-green-50 p-3 rounded-xl border border-green-100">
                            <span className="text-xs font-bold text-green-700 flex items-center gap-2">
                                <Receipt size={14} /> Discount Applied
                            </span>
                            <span className="text-xs font-mono font-bold text-green-700">-{order.discount_amount}</span>
                        </div>
                    )}

                    {/* Slip Thumbnail */}
                     {order.payment_slip_url && (
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Payment Slip</span>
                            <div className="relative group/slip cursor-pointer w-full h-32 rounded-lg overflow-hidden bg-white border border-gray-200" onClick={() => onViewSlip(order.payment_slip_url)}>
                                <img 
                                    src={order.payment_slip_url.startsWith('http') ? order.payment_slip_url : `https://your-project-ref.supabase.co/storage/v1/object/public/slips/${order.payment_slip_url}`} // Simple check, ideally passed down or handled by util
                                    alt="Slip" 
                                    className="w-full h-full object-cover transition-transform group-hover/slip:scale-105"
                                    onError={(e) => {
                                        // Fallback if direct link fails, usually rely on parent to pass full URL or handle it. 
                                        // For now assuming parent handles URL or this relative path works with global supabase context if configured, 
                                        // but safely we should probably just show icon if broken or rely on onViewSlip to handle the logic.
                                        e.target.style.display = 'none' 
                                    }}
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover/slip:bg-black/10 transition-colors flex items-center justify-center">
                                    <ImageIcon className="text-white opacity-0 group-hover/slip:opacity-100 drop-shadow-md transition-opacity" />
                                </div>
                            </div>
                        </div>
                     )}
                </div>
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                <div className="flex gap-2">
                     <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {isExpanded ? 'Hide Details' : 'Details'}
                     </button>
                     <button onClick={() => onPrint(order)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-[#1A1A1A] transition-colors" title="Print Ticket">
                        <Printer size={16} />
                     </button>
                </div>

                <div className="flex gap-3">
                    {/* Status Actions */}
                    {order.status === 'pending' && (
                        <>
                            <button onClick={() => onUpdateStatus(order.id, 'cancelled')} className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors">Reject</button>
                            <button onClick={() => onUpdateStatus(order.id, 'confirmed')} className="px-6 py-2 rounded-xl text-xs font-bold bg-[#1A1A1A] text-white shadow-lg shadow-black/20 hover:bg-black transition-all active:scale-95">Accept</button>
                        </>
                    )}
                    
                    {order.status === 'confirmed' && (
                        <button onClick={() => onUpdateStatus(order.id, order.booking_type === 'pickup' ? 'ready' : 'seated')} className="px-6 py-2 rounded-xl text-xs font-bold bg-white border border-gray-200 text-[#1A1A1A] hover:bg-gray-50 transition-colors flex items-center gap-2">
                             {order.booking_type === 'pickup' ? <ChefHat size={14} /> : <Check size={14} />}
                             {order.booking_type === 'pickup' ? 'Mark Ready' : 'Check-in'}
                        </button>
                    )}

                     {(order.status === 'ready' || order.status === 'seated') && (
                        <button onClick={() => onUpdateStatus(order.id, 'completed')} className="px-6 py-2 rounded-xl text-xs font-bold bg-[#DFFF00] text-[#1A1A1A] hover:bg-[#ccff00] transition-colors shadow-sm flex items-center gap-2">
                             <LogOut size={14} /> Complete
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
