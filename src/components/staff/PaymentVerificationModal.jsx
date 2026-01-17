import React, { useState } from 'react'
import { X, Check, Search, ZoomIn, ZoomOut, DollarSign, Receipt, MessageCircle, Phone, User, Clock, Calendar } from 'lucide-react'
import { formatThaiDateLong, formatThaiTimeOnly } from '../../utils/timeUtils'

export default function PaymentVerificationModal({ order, onClose, onVerify }) {
    if (!order) return null

    const [scale, setScale] = useState(1)

    // Calculate totals
    const total = order.total_amount || 0
    const discount = order.discount_amount || 0
    const subtotal = total + discount
    
    // Parse options for display
    const renderItems = () => {
        return order.order_items?.map((item, idx) => {
            let opts = []
            if (Array.isArray(item.selected_options)) {
                opts = item.selected_options.map(o => typeof o === 'object' ? `${o.name} (+${o.price})` : o)
            } else if (typeof item.selected_options === 'object') {
                opts = Object.entries(item.selected_options).map(([key, value]) => `${key}: ${value}`)
            }

            return (
                <div key={idx} className="flex justify-between items-start text-sm py-2 border-b border-dashed border-gray-100 last:border-0">
                    <div>
                        <div className="font-bold text-[#1A1A1A]">
                            <span className="w-5 inline-block text-gray-400 font-normal">{item.quantity}x</span> 
                            {item.menu_items?.name}
                        </div>
                        {opts.length > 0 && (
                            <div className="text-xs text-gray-400 pl-5 mt-0.5">
                                {opts.join(', ')}
                            </div>
                        )}
                    </div>
                </div>
            )
        })
    }

    return (
        <div 
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div 
                className="bg-white w-full max-w-5xl h-[85vh] rounded-3xl overflow-hidden flex flex-col md:flex-row shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* LEFT: SLIP IMAGE (Dark bg) */}
                <div className="flex-1 bg-[#0a0a0a] relative overflow-hidden flex items-center justify-center group">
                    {order.payment_slip_url ? (
                        <div className="relative w-full h-full flex items-center justify-center overflow-auto p-4 cursor-move active:cursor-grabbing">
                             <img 
                                src={order.payment_slip_url.startsWith('http') ? order.payment_slip_url : `https://your-project-ref.supabase.co/storage/v1/object/public/slips/${order.payment_slip_url}`}
                                alt="Payment Slip" 
                                style={{ transform: `scale(${scale})` }}
                                className="max-w-full max-h-full object-contain transition-transform duration-200"
                            />
                             {/* Floating Controls */}
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 bg-white/10 backdrop-blur rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setScale(Math.max(0.5, scale - 0.5))} className="p-2 text-white hover:bg-white/20 rounded-full"><ZoomOut size={20} /></button>
                                <span className="text-white text-xs font-mono self-center px-2">{Math.round(scale * 100)}%</span>
                                <button onClick={() => setScale(Math.min(3, scale + 0.5))} className="p-2 text-white hover:bg-white/20 rounded-full"><ZoomIn size={20} /></button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-gray-500 flex flex-col items-center">
                            <Search size={48} className="mb-4 opacity-20" />
                            <p>No Slip Uploaded</p>
                        </div>
                    )}
                 
                    {/* Mobile Close Button (Absolute) */}
                    <button onClick={onClose} className="absolute top-4 right-4 md:hidden p-2 bg-black/50 text-white rounded-full">
                        <X size={20} />
                    </button>
                </div>

                {/* RIGHT: DETAILS (White bg) */}
                <div className="w-full md:w-[400px] bg-white flex flex-col h-full border-l border-gray-100">
                    
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100">
                        <div className="flex justify-between items-start mb-1">
                            <div>
                                <h2 className="text-xl font-black text-[#1A1A1A] leading-tight">
                                    {order.tables_layout?.table_name || 'Pickup'}
                                </h2>
                                <p className="text-sm text-gray-500 font-medium">#{order.tracking_token ? order.tracking_token.slice(0,8) : order.id.slice(0,8)}</p>
                            </div>
                            <button onClick={onClose} className="hidden md:block p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex gap-4 mt-4 text-xs font-medium text-gray-600">
                             <div className="flex items-center gap-1.5 align-middle">
                                <User size={14} className="text-[#1A1A1A]" /> 
                                {order.profiles?.display_name || order.pickup_contact_name || 'Guest'}
                             </div>
                             {(order.profiles?.phone_number || order.pickup_contact_phone) && (
                                <a href={`tel:${order.profiles?.phone_number || order.pickup_contact_phone}`} className="flex items-center gap-1.5 text-blue-600 hover:underline">
                                    <Phone size={14} /> 
                                    {order.profiles?.phone_number || order.pickup_contact_phone}
                                </a>
                             )}
                        </div>
                         <div className="flex gap-4 mt-2 text-xs font-medium text-gray-600">
                             <div className="flex items-center gap-1.5">
                                <Calendar size={14} className="text-[#1A1A1A]" /> 
                                {formatThaiDateLong(order.booking_time)}
                             </div>
                             <div className="flex items-center gap-1.5">
                                <Clock size={14} className="text-[#1A1A1A]" /> 
                                {formatThaiTimeOnly(order.booking_time)}
                             </div>
                         </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        
                        {/* Note */}
                        {order.customer_note && (
                            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                                <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <MessageCircle size={12} /> Customer Note
                                </p>
                                <p className="text-sm text-orange-900 leading-relaxed whitespace-pre-wrap font-medium">
                                    {order.customer_note}
                                </p>
                            </div>
                        )}

                        {/* Order Items */}
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Order Summary</p>
                            <div className="space-y-1">
                                {renderItems()}
                            </div>
                        </div>

                    </div>

                    {/* Footer / Actions */}
                    <div className="p-6 bg-gray-50 border-t border-gray-100">
                        <div className="space-y-2 mb-6">
                            <div className="flex justify-between text-sm text-gray-500">
                                <span>Subtotal</span>
                                <span>{subtotal.toFixed(2)}</span>
                            </div>
                            {discount > 0 && (
                                <div className="flex justify-between text-sm text-green-600 font-medium">
                                    <span className="flex items-center gap-1"><Receipt size={14} /> Discount</span>
                                    <span>-{discount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-xl font-bold text-[#1A1A1A] pt-2 border-t border-gray-200">
                                <span>Total</span>
                                <span>{total.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={onClose}
                                className="py-3 rounded-xl font-bold text-sm bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                                Close
                            </button>
                            {order.status === 'pending' && (
                                <button 
                                    onClick={() => { onVerify(order.id, 'confirmed'); onClose(); }}
                                    className="py-3 rounded-xl font-bold text-sm bg-[#1A1A1A] text-white hover:bg-black transition-colors shadow-lg active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Check size={16} /> Verify & Accept
                                </button>
                            )}
                             {order.status === 'confirmed' && (
                                <button 
                                    onClick={() => { onClose(); }} // Just close for now, or allow re-verify?
                                    disabled
                                    className="py-3 rounded-xl font-bold text-sm bg-green-100 text-green-700 opacity-50 cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <Check size={16} /> Verified
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
