import { Clock, Phone, Printer, ImageIcon, Check, X, ChefHat, LogOut } from 'lucide-react'
import { formatThaiTimeOnly } from '../../utils/timeUtils'

const renderOptions = (item) => {
    // Helper to render options cleanly
    if (!item.selected_options) return null
    
    // Normalize options to array of strings
    let opts = []
    if (Array.isArray(item.selected_options)) {
        opts = item.selected_options.map(o => typeof o === 'object' ? o.name : o)
    } else if (typeof item.selected_options === 'object') {
        opts = Object.values(item.selected_options).flat()
    }
    
    if (opts.length === 0) return null
    return (
        <div className="mt-1 text-xs text-gray-400 font-medium space-y-0.5 ml-4">
            {opts.map((o, i) => <div key={i}>+ {o}</div>)}
        </div>
    )
}

export default function OrderCard({ order, onUpdateStatus, onViewSlip, onPrint, isSchedule = false }) {
    const isPending = order.status === 'pending'
    
    return (
        <div className={`
            bg-white rounded-2xl p-6 transition-all duration-300 relative group overflow-hidden
            ${isPending ? 'shadow-lg shadow-orange-500/10 border border-orange-100' : 'shadow-sm border border-gray-100 hover:border-gray-300'}
        `}>
            {isPending && <div className="absolute top-0 left-0 w-1 h-full bg-[#DFFF00]" />}

            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <div>
                     <div className="flex items-center gap-3 mb-1">
                        <span className="text-2xl font-black text-[#1A1A1A]">
                            {order.tables_layout?.table_name || 'Pickup'}
                        </span>
                        <span className="text-xs font-mono text-gray-300 bg-gray-50 px-2 py-1 rounded-full">
                            #{order.tracking_token ? order.tracking_token.slice(-4).toUpperCase() : order.id.slice(0,4)}
                        </span>
                     </div>
                     <div className="text-sm font-bold text-gray-500">
                        {order.profiles?.display_name || order.pickup_contact_name || 'Guest'}
                     </div>
                </div>
                
                <div className="text-right flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1 text-xs font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                        <Clock className="w-3 h-3" />
                        {formatThaiTimeOnly(order.booking_time)}
                    </div>
                </div>
            </div>

            {/* Items */}
            <div className="space-y-4 mb-6">
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
                        <div className="text-sm font-mono text-gray-400">
                             {/* Price hidden for minimalism if not needed, typically kitchen needs qty, but staff needs price? Staff needs price. */}
                             {item.price_at_time}
                        </div>
                    </div>
                ))}
            </div>
            
            {order.customer_note && (
                 <div className="mb-6 bg-orange-50 p-3 rounded-xl text-xs text-orange-800 font-medium leading-relaxed">
                    Note: {order.customer_note}
                 </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                <div className="flex gap-2">
                     <button onClick={() => onPrint(order)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-[#1A1A1A] transition-colors"><Printer size={16} /></button>
                     {order.payment_slip_url && (
                        <button onClick={() => onViewSlip(order.payment_slip_url)} className="p-2 hover:bg-blue-50 rounded-full text-gray-400 hover:text-blue-600 transition-colors"><ImageIcon size={16} /></button>
                     )}
                </div>

                <div className="flex gap-3">
                    {/* Dynamic Action Buttons based on status */}
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
