import React, { useState, useEffect } from 'react';
import { FileText, X, Loader2, Receipt, Printer } from 'lucide-react';
import { getShortBookingId } from '../utils/printerHelper';
import { supabase } from '../lib/supabaseClient';
import TaxInvoiceModal from '../components/admin/tax/TaxInvoiceModal';
import TaxInvoicePrintView from '../components/admin/tax/TaxInvoicePrintView';

const getBookingPaymentMethod = (b) => {
    if (!b) return 'CASH';
    const remark = (b.staff_remark || '').toLowerCase();
    if (remark.includes('credit') || remark.includes('บัตรเครดิต')) return 'CREDIT CARD';
    if (b.payment_slip_url || remark.includes('qr') || remark.includes('transfer') || remark.includes('โอน')) return 'QR TRANSFER';
    return 'CASH';
};

class ModalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error("POSBillDetailsModal error caught:", error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 font-sans">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4 border border-[#D1D1CD]">
                        <div className="flex justify-between items-center border-b pb-3">
                            <h3 className="font-bold text-red-600 text-sm">Bill Details Display Notice</h3>
                            <button onClick={this.props.onClose} className="p-1 hover:bg-gray-100 rounded cursor-pointer">
                                <X size={18} />
                            </button>
                        </div>
                        <p className="text-xs text-gray-600">
                            ไม่สามารถแสดงรายละเอียดบิลนี้ได้เนื่องจากรูปแบบข้อมูล (Error: {String(this.state.error?.message || 'Data format mismatch')})
                        </p>
                        <button onClick={this.props.onClose} className="w-full bg-[#1A1A1A] text-white py-2 rounded text-xs font-mono font-bold cursor-pointer">
                            CLOSE
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

function POSBillDetailsContent({ booking: initialBooking, onClose }) {
    const [fetchedBooking, setFetchedBooking] = useState(null);
    const [showTaxModal, setShowTaxModal] = useState(false);
    const [printInvoiceData, setPrintInvoiceData] = useState(null);
    const [companySettings, setCompanySettings] = useState(() => {
        try {
            const local = localStorage.getItem('onhaus_tax_settings');
            return local ? JSON.parse(local) : {};
        } catch {
            return {};
        }
    });

    const booking = fetchedBooking || initialBooking;

    useEffect(() => {
        supabase
            .from('app_settings')
            .select('key, value')
            .like('key', 'tax_%')
            .then(({ data }) => {
                if (data && data.length > 0) {
                    const map = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
                    setCompanySettings(map);
                }
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (initialBooking?.id && (!initialBooking.order_items || initialBooking.order_items.length === 0 || !initialBooking.profiles)) {
            supabase
                .from('bookings')
                .select(`
                    *,
                    profiles ( id, display_name, nickname, phone_number, current_tier ),
                    tables_layout (table_name),
                    order_items (
                        id,
                        quantity,
                        price_at_time,
                        selected_options,
                        menu_item_id,
                        menu_items (
                            name,
                            category_id
                        )
                    ),
                    promotion_codes (code)
                `)
                .eq('id', initialBooking.id)
                .maybeSingle()
                .then(({ data, error }) => {
                    if (!error && data) {
                        setFetchedBooking(data);
                    }
                })
                .catch(() => {});
        }
    }, [initialBooking]);

    if (!booking) return null;

    const shortId = getShortBookingId(booking);
    const orderPlacedAtRaw = booking.created_at || booking.order_time || (booking.booking_type !== 'dine_in' && booking.booking_type !== 'pickup' ? booking.booking_time : null) || new Date().toISOString();
    const orderPlacedStr = new Date(orderPlacedAtRaw).toLocaleString('th-TH', { 
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
    const bookingTimeStr = booking.booking_time ? new Date(booking.booking_time).toLocaleString('th-TH', { 
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    }) : '-';
    
    const isPickup = booking.booking_type === 'pickup';
    const isDineInBooking = booking.booking_type === 'dine_in';
    const profileObj = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles;
    const tableObj = Array.isArray(booking.tables_layout) ? booking.tables_layout[0] : booking.tables_layout;
    const tableName = tableObj?.table_name || booking.table_name || (isPickup ? 'PICK' : '-');

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 font-sans">
            <div className="bg-[#ECECE9] rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden border border-[#D1D1CD]">
                {/* Header */}
                <div className="bg-[#1A1A1A] text-white p-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <FileText size={20} className="text-[var(--color-accent)]" />
                        <div>
                            <h2 className="font-mono font-bold text-sm tracking-wider uppercase">
                                Bill #{shortId}
                            </h2>
                            <p className="text-[10px] text-[#A3A39E] font-mono">
                                เวลาทำรายการ: {orderPlacedStr} น.
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer">
                        <X size={20} />
                    </button>
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
                    
                    {/* Timestamp Details & Order Type */}
                    <div className="bg-white border border-[#D1D1CD] rounded-xl p-3.5 flex flex-col gap-2.5 shadow-sm font-mono text-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-[#767673] uppercase tracking-wider">ประเภทบริการ / SERVICE</span>
                            <span className="text-xs font-bold text-[var(--color-accent)] bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                {isPickup ? 'รับกลับบ้าน (PICKUP)' : `โต๊ะ ${tableName}`}
                            </span>
                        </div>

                        <div className="bg-[#F5F5F2] border border-[#ECECE9] rounded-lg p-2.5 flex flex-col gap-1.5">
                            <div className="flex justify-between items-center text-[11px] text-[#767673]">
                                <span>เวลาทำรายการ (Order Time):</span>
                                <span className="font-bold text-[#1A1A1A]">{orderPlacedStr} น.</span>
                            </div>
                            {isPickup ? (
                                <div className="flex justify-between items-center text-[11px] text-amber-950 font-bold border-t border-[#D1D1CD] pt-1.5">
                                    <span>วันเวลามารับ (Pickup Time):</span>
                                    <span className="bg-amber-100/90 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                                        {bookingTimeStr} น.
                                    </span>
                                </div>
                            ) : (
                                <div className="flex justify-between items-center text-[11px] text-[#1A1A1A] font-bold border-t border-[#D1D1CD] pt-1.5">
                                    <span>วันเวลาที่จองโต๊ะ (Reserved For):</span>
                                    <span className="bg-[oklch(92%_0.012_28)] px-2 py-0.5 rounded border border-[oklch(85%_0.012_28)]">
                                        {bookingTimeStr} น.
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Member / Guest Info */}
                    <div className="bg-white border border-[#D1D1CD] rounded-xl p-3.5 flex flex-col gap-2 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold text-[#767673] uppercase tracking-wider">Customer / ข้อมูลลูกค้า</span>
                        </div>

                        {profileObj ? (
                            <div className="flex flex-col gap-1.5 pt-1 border-t border-[#ECECE9]">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-emerald-600 text-white">
                                            สมาชิก MEMBER
                                        </span>
                                        <span className="font-bold text-[#1A1A1A] text-sm">
                                            {profileObj.display_name || profileObj.nickname || 'สมาชิก'}
                                        </span>
                                    </div>
                                    {profileObj.phone_number && (
                                        <span className="font-mono text-xs text-[#767673]">
                                            {profileObj.phone_number}
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                    {profileObj.current_tier && (
                                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-[#1A1A1A] text-white">
                                            {profileObj.current_tier}
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
                            <span>{Array.isArray(booking.order_items) ? booking.order_items.length : 0} รายการ</span>
                        </div>
                        <div className="flex flex-col gap-2.5 divide-y divide-[#ECECE9]">
                            {Array.isArray(booking.order_items) && booking.order_items.map((item, idx) => {
                                if (!item) return null;
                                const menuItemObj = Array.isArray(item.menu_items) ? item.menu_items[0] : item.menu_items;
                                const itemName = item.item_name || item.name || menuItemObj?.name || 'รายการสินค้า';
                                const itemPrice = Number(item.price_at_time || item.price || menuItemObj?.price || 0);
                                const rawOpts = item.selected_options;
                                let opts = [];
                                if (Array.isArray(rawOpts)) {
                                    opts = rawOpts;
                                } else if (typeof rawOpts === 'string') {
                                    try {
                                        const parsed = JSON.parse(rawOpts);
                                        opts = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' ? Object.values(parsed) : [rawOpts]);
                                    } catch {
                                        opts = rawOpts ? [rawOpts] : [];
                                    }
                                } else if (rawOpts && typeof rawOpts === 'object') {
                                    opts = Object.values(rawOpts);
                                }

                                return (
                                    <div key={idx} className="flex justify-between items-start text-xs pt-1.5 first:pt-0">
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-bold text-[#1A1A1A] bg-neutral-100 px-1.5 py-0.5 rounded text-[10px]">
                                                    {item.quantity || 1}x
                                                </span>
                                                <span className="font-bold text-[#1A1A1A]">{itemName}</span>
                                            </div>
                                            {opts.length > 0 && (
                                                <div className="pl-6 text-[10px] font-mono text-zinc-500">
                                                    {opts.map((opt, oIdx) => {
                                                        let optText = '';
                                                        if (typeof opt === 'string' || typeof opt === 'number') {
                                                            optText = String(opt);
                                                        } else if (opt && typeof opt === 'object') {
                                                            optText = opt.name || opt.label || opt.choice_name || opt.value || '';
                                                        }
                                                        if (!optText || optText === '{}' || optText === '[]') return null;
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
                            {(!Array.isArray(booking.order_items) || booking.order_items.length === 0) && (
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
                <div className="p-4 bg-white border-t border-[#D1D1CD] shrink-0 flex items-center gap-2">
                    <button 
                        type="button"
                        onClick={() => setShowTaxModal(true)}
                        className="flex-1 cursor-pointer bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white py-2.5 rounded-lg font-mono font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md"
                    >
                        <Receipt size={15} />
                        <span>ออกใบเสร็จ / ใบกำกับภาษี</span>
                    </button>
                    
                    <button 
                        type="button"
                        onClick={onClose}
                        className="w-24 cursor-pointer bg-[#1A1A1A] hover:bg-black text-white py-2.5 rounded-lg font-mono font-bold text-xs transition-colors"
                    >
                        CLOSE
                    </button>
                </div>
            </div>

            {/* Modal: Issue Tax Invoice from this bill */}
            {showTaxModal && (
                <TaxInvoiceModal
                    booking={booking}
                    companySettings={companySettings}
                    onClose={() => setShowTaxModal(false)}
                    onSaveSuccess={(savedInvoice, printImmediately) => {
                        setShowTaxModal(false);
                        if (printImmediately) {
                            setPrintInvoiceData(savedInvoice);
                        }
                    }}
                />
            )}

            {/* Modal: Print A4 View */}
            {printInvoiceData && (
                <TaxInvoicePrintView
                    invoice={printInvoiceData}
                    companySettings={companySettings}
                    onClose={() => setPrintInvoiceData(null)}
                />
            )}
        </div>
    );
}

export default function POSBillDetailsModal({ booking, onClose }) {
    return (
        <ModalErrorBoundary onClose={onClose}>
            <POSBillDetailsContent booking={booking} onClose={onClose} />
        </ModalErrorBoundary>
    );
}
