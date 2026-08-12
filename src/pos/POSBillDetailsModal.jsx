import React from 'react';
import { FileText, X } from 'lucide-react';
import { getShortBookingId } from '../utils/printerHelper';
import { getBookingPaymentMethod } from '../utils/printerHelper';

export default function POSBillDetailsModal({ booking, onClose }) {
    if (!booking) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans">
            <div className="bg-[#ECECE9] rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden border border-[#D1D1CD]">
                {/* Header */}
                <div className="bg-[#1A1A1A] text-white p-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <FileText size={20} className="text-[var(--color-accent)]" />
                        <div>
                            <h2 className="font-mono font-bold text-sm tracking-wider uppercase">
                                Bill #{getShortBookingId(booking)}
                            </h2>
                            <p className="text-[10px] text-[#A3A39E] font-mono">
                                {new Date(booking.booking_time).toLocaleString('th-TH')}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer">
                        <X size={20} />
                    </button>
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
                    
                    {/* Member / Guest Info */}
                    <div className="bg-white border border-[#D1D1CD] rounded-xl p-3 flex flex-col gap-2 shadow-sm">
                        <div className="text-[10px] font-mono font-bold text-[#767673] uppercase tracking-wider">Customer Info</div>
                        <div className="flex items-center justify-between">
                            <div className="font-bold text-[#1A1A1A]">
                                {booking.profiles?.display_name || booking.pickup_contact_name || 'Walk-in Guest'}
                            </div>
                            <div className="text-xs font-mono font-bold text-[var(--color-accent)]">
                                Table: {booking.tables_layout?.table_name || 'PICK'}
                            </div>
                        </div>
                        {booking.profiles && (
                            <div className="flex flex-wrap gap-2 mt-1">
                                {(booking.xhaus_earned || 0) > 0 && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                                        EARNED +{booking.xhaus_earned} PTS
                                    </span>
                                )}
                                {(booking.xhaus_redeemed || 0) > 0 && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border bg-amber-50 text-amber-700 border-amber-200">
                                        USED -{booking.xhaus_redeemed} PTS
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Order Items */}
                    <div className="bg-white border border-[#D1D1CD] rounded-xl p-3 flex flex-col gap-3 shadow-sm">
                        <div className="text-[10px] font-mono font-bold text-[#767673] uppercase tracking-wider border-b border-[#ECECE9] pb-2">
                            Order Items
                        </div>
                        <div className="flex flex-col gap-2">
                            {booking.order_items?.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-start text-xs">
                                    <div className="flex gap-2">
                                        <span className="font-mono font-bold text-[#1A1A1A]">{item.quantity}x</span>
                                        <span className="text-[#1A1A1A]">{item.menu_items?.name || 'Unknown Item'}</span>
                                    </div>
                                    <span className="font-mono text-[#767673]">
                                        ฿{((item.price_at_time || 0) * item.quantity).toLocaleString()}
                                    </span>
                                </div>
                            ))}
                            {(!booking.order_items || booking.order_items.length === 0) && (
                                <div className="text-xs text-[#767673] italic">No items recorded (Split bill or voided items)</div>
                            )}
                        </div>
                    </div>

                    {/* Payment Summary */}
                    <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-xl p-4 flex flex-col gap-2 shadow-sm">
                        <div className="flex justify-between items-center text-xs text-[#767673]">
                            <span>Subtotal</span>
                            <span className="font-mono">฿{((booking.total_amount || 0) + (booking.discount_amount || 0) + (booking.xhaus_discount || 0)).toLocaleString()}</span>
                        </div>
                        
                        {(booking.xhaus_discount || 0) > 0 && (
                            <div className="flex justify-between items-center text-xs text-amber-600">
                                <span>xHaus Discount</span>
                                <span className="font-mono">-฿{booking.xhaus_discount.toLocaleString()}</span>
                            </div>
                        )}
                        
                        {(booking.discount_amount || 0) > 0 && (
                            <div className="flex justify-between items-center text-xs text-emerald-600">
                                <span>Other Discounts</span>
                                <span className="font-mono">-฿{booking.discount_amount.toLocaleString()}</span>
                            </div>
                        )}

                        <div className="border-t border-[#D1D1CD] my-1"></div>
                        
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-[#1A1A1A] text-sm">Net Total</span>
                            <span className="font-mono font-black text-[#ff0000] text-lg">
                                ฿{booking.total_amount?.toLocaleString()}
                            </span>
                        </div>

                        <div className="flex justify-between items-center mt-2">
                            <span className="text-[10px] font-mono font-bold text-[#767673] uppercase">Pay Method</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border bg-white text-[#1A1A1A] border-[#D1D1CD]">
                                {getBookingPaymentMethod(booking)}
                            </span>
                        </div>
                    </div>
                    
                    {booking.staff_remark && (
                        <div className="text-[10px] text-[#767673] italic bg-white border border-[#ECECE9] p-2 rounded-lg">
                            * Remark: {booking.staff_remark}
                        </div>
                    )}
                </div>
                
                {/* Footer */}
                <div className="p-4 bg-white border-t border-[#D1D1CD] shrink-0">
                    <button 
                        onClick={onClose}
                        className="w-full cursor-pointer bg-[#1A1A1A] hover:bg-black text-white py-2.5 rounded-lg font-mono font-bold text-xs transition-colors"
                    >
                        CLOSE
                    </button>
                </div>
            </div>
        </div>
    );
}
