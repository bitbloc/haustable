import React from 'react';
import { FileText, X } from 'lucide-react';
import { getShortBookingId } from '../utils/printerHelper';

const getBookingPaymentMethod = (b) => {
    if (!b) return 'CASH';
    const remark = (b.staff_remark || '').toLowerCase();
    if (remark.includes('credit') || remark.includes('บัตรเครดิต')) return 'CREDIT CARD';
    if (b.payment_slip_url || remark.includes('qr') || remark.includes('transfer') || remark.includes('โอน')) return 'QR TRANSFER';
    return 'CASH';
};

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
                                {booking.booking_time ? new Date(booking.booking_time).toLocaleString('th-TH') : '-'}
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
                    <div className="bg-white border border-[#D1D1CD] rounded-xl p-3.5 flex flex-col gap-2 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold text-[#767673] uppercase tracking-wider">Customer / สมาชิก</span>
                            <span className="text-xs font-mono font-bold text-[var(--color-accent)] bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                {booking.booking_type === 'pickup' ? 'รับกลับ (PICKUP)' : `โต๊ะ ${booking.tables_layout?.table_name || 'PICK'}`}
                            </span>
                        </div>

                        {booking.profiles ? (
                            <div className="flex flex-col gap-1.5 pt-1 border-t border-[#ECECE9]">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-emerald-600 text-white">
                                            สมาชิก MEMBER
                                        </span>
                                        <span className="font-bold text-[#1A1A1A] text-sm">
                                            {booking.profiles.display_name || booking.profiles.nickname || 'สมาชิก'}
                                        </span>
                                    </div>
                                    {booking.profiles.phone_number && (
                                        <span className="font-mono text-xs text-[#767673]">
                                            {booking.profiles.phone_number}
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                    {booking.profiles.current_tier && (
                                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-[#1A1A1A] text-white">
                                            {booking.profiles.current_tier}
                                        </span>
                                    )}
                                    {Number(booking.xhaus_earned || 0) > 0 && (
                                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                                            สะสม +{Number(booking.xhaus_earned).toFixed(2)} xhaus
                                        </span>
                                    )}
                                    {Number(booking.xhaus_redeemed || 0) > 0 && (
                                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold border bg-amber-50 text-amber-700 border-amber-200">
                                            ตัดแต้ม -{Number(booking.xhaus_redeemed).toFixed(2)} xhaus {Number(booking.xhaus_discount || 0) > 0 && `(-฿${Number(booking.xhaus_discount).toLocaleString()})`}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between pt-1 border-t border-[#ECECE9]">
                                <div className="flex items-center gap-1.5">
                                    <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-gray-200 text-gray-700 border border-gray-300">
                                        ทั่วไป NON-MEMBER
                                    </span>
                                    <span className="font-bold text-[#1A1A1A] text-xs">
                                        {booking.pickup_contact_name || booking.customer_name || 'ลูกค้าทั่วไป (Walk-in)'}
                                    </span>
                                </div>
                                <span className="text-[10px] font-mono text-[#767673] italic">ไม่ได้ผูกสมาชิก</span>
                            </div>
                        )}
                    </div>

                    {/* Order Items */}
                    <div className="bg-white border border-[#D1D1CD] rounded-xl p-3.5 flex flex-col gap-3 shadow-sm">
                        <div className="flex justify-between items-center text-[10px] font-mono font-bold text-[#767673] uppercase tracking-wider border-b border-[#ECECE9] pb-2">
                            <span>Order Items / รายการที่สั่ง</span>
                            <span>{booking.order_items?.length || 0} รายการ</span>
                        </div>
                        <div className="flex flex-col gap-2.5 divide-y divide-[#ECECE9]">
                            {booking.order_items?.map((item, idx) => {
                                const itemName = item.item_name || item.name || item.menu_items?.name || 'รายการสินค้า';
                                const itemPrice = Number(item.price_at_time || item.price || 0);
                                const opts = Array.isArray(item.selected_options) ? item.selected_options : [];
                                return (
                                    <div key={idx} className="flex justify-between items-start text-xs pt-1.5 first:pt-0">
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-bold text-[#1A1A1A] bg-neutral-100 px-1.5 py-0.5 rounded text-[10px]">
                                                    {item.quantity}x
                                                </span>
                                                <span className="font-bold text-[#1A1A1A]">{itemName}</span>
                                            </div>
                                            {opts.length > 0 && (
                                                <div className="pl-6 text-[10px] font-mono text-zinc-500">
                                                    {opts.map((opt, oIdx) => {
                                                        const optText = typeof opt === 'string' ? opt : (opt?.name || opt?.label || '');
                                                        if (!optText) return null;
                                                        return <span key={oIdx} className="block">• {optText}</span>;
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                        <span className="font-mono font-bold text-[#1A1A1A]">
                                            ฿{(itemPrice * (item.quantity || 1)).toLocaleString()}
                                        </span>
                                    </div>
                                );
                            })}
                            {(!booking.order_items || booking.order_items.length === 0) && (
                                <div className="text-xs text-[#767673] italic">ไม่มีรายการสั่งซื้อย่อย</div>
                            )}
                        </div>
                    </div>

                    {/* Payment Summary */}
                    <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-xl p-4 flex flex-col gap-2 shadow-sm">
                        <div className="flex justify-between items-center text-xs text-[#767673]">
                            <span>Subtotal</span>
                            <span className="font-mono">฿{((Number(booking.total_amount) || 0) + (Number(booking.discount_amount) || 0) + (Number(booking.xhaus_discount) || 0)).toLocaleString()}</span>
                        </div>
                        
                        {Number(booking.xhaus_discount || 0) > 0 && (
                            <div className="flex justify-between items-center text-xs text-amber-600">
                                <span>xHaus Discount</span>
                                <span className="font-mono">-฿{Number(booking.xhaus_discount).toLocaleString()}</span>
                            </div>
                        )}
                        
                        {Number(booking.discount_amount || 0) > 0 && (
                            <div className="flex justify-between items-center text-xs text-emerald-600">
                                <span>Other Discounts</span>
                                <span className="font-mono">-฿{Number(booking.discount_amount).toLocaleString()}</span>
                            </div>
                        )}

                        <div className="border-t border-[#D1D1CD] my-1"></div>
                        
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-[#1A1A1A] text-sm">Net Total</span>
                            <span className="font-mono font-black text-[#ff0000] text-lg">
                                ฿{(Number(booking.total_amount) || 0).toLocaleString()}
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
