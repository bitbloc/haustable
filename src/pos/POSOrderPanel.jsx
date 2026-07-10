import React from 'react';
import { Trash2, Plus, Minus, CreditCard, Banknote, UserPlus, ReceiptText, AlertCircle, Receipt, Check, Printer, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { supabase } from '../lib/supabaseClient';

export default function POSOrderPanel({ order, booking, onUpdateQuantity, onClear, onCheckout, onAcceptOrder, onOpenSlip }) {
    const [includeTax, setIncludeTax] = React.useState(true);
    const [paymentMethod, setPaymentMethod] = React.useState('cash'); // 'cash' | 'qr'

    React.useEffect(() => {
        const loadDefaultVat = async () => {
            try {
                const { data } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'default_vat_enabled')
                    .single();
                if (data && data.value) {
                    setIncludeTax(data.value === 'true');
                }
            } catch (err) {
                console.error("Error loading default VAT:", err);
            }
        };
        loadDefaultVat();
    }, []);
    const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = includeTax ? subtotal * 0.07 : 0;
    const total = subtotal + tax;
    const hasNewItems = order.items.some(item => !item.db_id);

    return (
        <aside className="w-[320px] md:w-[340px] bg-[#F5F5F2] border-l border-[#D1D1CD] flex flex-col h-full shadow-sm z-30 font-sans text-[#1A1A1A] select-none shrink-0 overflow-hidden">
            {/* Order Header */}
            <div className="p-4 border-b border-[#D1D1CD] flex items-center justify-between shrink-0">
                <div>
                    <h3 className="font-mono font-bold text-xs tracking-wider uppercase">Order Details</h3>
                    <p className="text-[10px] text-[#767673] font-bold font-mono mt-0.5 uppercase tracking-tight">
                        {order.table ? `TABLE: ${order.table.table_name}` : 'WALK-IN ORDER'}
                    </p>
                </div>
                <button 
                    onClick={onClear}
                    className="p-1.5 text-[#767673] hover:text-red-600 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-lg transition-all cursor-pointer"
                >
                    <Trash2 size={14} />
                </button>
            </div>

            {/* Pending Order Alert */}
            {booking && booking.status === 'pending' && (
                <div className="mx-3 mt-3 p-3 bg-[#FFF9E6] border border-[#E5A900] rounded-xl flex flex-col gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 text-amber-700 font-mono text-[9px] font-bold uppercase tracking-wider">
                        <AlertCircle size={12} className="text-[#FFAA00] animate-pulse" />
                        <span>Pending Approval</span>
                    </div>
                    <p className="text-[9px] text-amber-800/80 font-medium">Order submitted by customer. Awaiting confirmation.</p>
                    <button 
                        onClick={onAcceptOrder}
                        className="w-full bg-[#FFAA00] hover:bg-[#E5A900] text-black py-1.5 rounded-lg font-bold text-[10px] transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                    >
                        <Check size={10} /> Accept & Print Slip
                    </button>
                </div>
            )}

            {/* Payment Slip Alert */}
            {booking && booking.payment_slip_url && (
                <div className="mx-3 mt-3 p-3 bg-emerald-50 border border-[#00CC44] rounded-xl flex flex-col gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-mono text-[9px] font-bold uppercase tracking-wider">
                        <Receipt size={12} className="text-[#00CC44]" />
                        <span>Payment Slip Received</span>
                    </div>
                    <button 
                        onClick={() => window.open(`https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/slips/${booking.payment_slip_url}`, '_blank')}
                        className="w-full bg-[#00CC44] hover:bg-[#00B33C] text-white py-1.5 rounded-lg font-bold text-[10px] transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                    >
                        <Receipt size={10} /> View Slip Image
                    </button>
                </div>
            )}

            {/* Customer Lookup (CRM Hook) */}
            <div className="px-3 py-2 shrink-0">
                <button className="w-full bg-white border border-[#D1D1CD] rounded-xl p-2.5 flex items-center gap-3 hover:border-[#B0B0AC] transition-all cursor-pointer group shadow-sm">
                    <div className="w-7 h-7 rounded-full bg-[#E0E0DC] flex items-center justify-center text-[#1A1A1A] shrink-0">
                        <UserPlus size={14} />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                        <p className="text-[8px] font-mono font-bold tracking-widest text-[#767673] uppercase leading-none">CUSTOMER CRM</p>
                        <p className="text-[11px] font-bold uppercase mt-0.5 truncate">Attach Customer Profile</p>
                    </div>
                </button>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1.5 scrollbar-none">
                <AnimatePresence>
                    {order.items.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-[#767673] gap-2 opacity-50 font-mono text-[9px] font-bold uppercase tracking-wider py-8">
                            <UtensilsIcon size={24} strokeWidth={1.5} />
                            <span>Cart is empty</span>
                        </div>
                    ) : (
                        order.items.map(item => (
                            <motion.div 
                                key={item.id}
                                initial={{ x: 10, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -10, opacity: 0 }}
                                className="bg-white border border-[#D1D1CD] p-2.5 rounded-lg flex items-center justify-between shadow-sm"
                            >
                                <div className="flex-1 min-w-0 mr-2">
                                    <h5 className="font-bold text-[11px] leading-tight text-[#1A1A1A] uppercase truncate">{item.name}</h5>
                                    <p className="text-[9px] text-[#FF5500] font-mono font-bold mt-0.5">฿{item.price}</p>
                                </div>

                                <div className="flex items-center bg-[#E0E0DC] border border-[#B0B0AC] rounded-md p-0.5 gap-0.5 shrink-0 scale-90 origin-right">
                                    <button 
                                        onClick={() => onUpdateQuantity(item.id, -1)}
                                        className="w-7 h-7 rounded flex items-center justify-center hover:bg-white text-[#767673] hover:text-[#1A1A1A] transition-colors cursor-pointer"
                                    >
                                        <Minus size={10} />
                                    </button>
                                    <span className="w-6 text-center font-mono font-bold text-[11px] text-[#1A1A1A]">{item.quantity}</span>
                                    <button 
                                        onClick={() => onUpdateQuantity(item.id, 1)}
                                        className="w-7 h-7 rounded flex items-center justify-center hover:bg-white text-[#767673] hover:text-[#1A1A1A] transition-colors cursor-pointer"
                                    >
                                        <Plus size={10} />
                                    </button>
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>

            {/* Summary & Checkout */}
            <div className="p-4 bg-[#EBEBE9] border-t border-[#D1D1CD] space-y-3 shrink-0">
                <div className="space-y-1 font-mono text-[9px] font-bold uppercase tracking-wider text-[#767673]">
                    <div className="flex justify-between items-center">
                        <span>SUBTOTAL</span>
                        <span className="text-[#1A1A1A]">฿{subtotal.toFixed(2)}</span>
                    </div>
                    
                    {/* VAT Toggle Row */}
                    <div className="flex justify-between items-center py-0.5 border-b border-dashed border-[#D1D1CD] pb-1.5">
                        <div className="flex items-center gap-1.5">
                            <span>VAT (7%)</span>
                            <button 
                                onClick={() => setIncludeTax(!includeTax)}
                                className={`w-7 h-3.5 rounded-full transition-colors relative flex items-center cursor-pointer ${includeTax ? 'bg-[#FF5500]' : 'bg-white/30'}`}
                            >
                                <div className={`absolute w-2.5 h-2.5 bg-white rounded-full transition-transform ${includeTax ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                            </button>
                        </div>
                        <span className={`font-bold ${includeTax ? 'text-[#1A1A1A]' : 'text-gray-400 line-through'}`}>
                            ฿{(subtotal * 0.07).toFixed(2)}
                        </span>
                    </div>

                    <div className="flex justify-between items-end text-[#1A1A1A] pt-1">
                        <span className="text-[9px] font-bold pb-0.5">NET TOTAL</span>
                        <span className="text-lg font-black text-[#FF5500]">฿{total.toFixed(2)}</span>
                    </div>
                </div>

                {/* Payment Method Selector / Actions */}
                {(order.items.length > 0 || booking) && (
                    <div className="space-y-2">
                        <div className="flex bg-[#E0E0DC] p-0.5 rounded-lg border border-[#D1D1CD] w-full font-mono text-[9px] font-bold uppercase tracking-wider">
                            <button 
                                type="button"
                                onClick={() => setPaymentMethod('cash')}
                                className={`flex-1 py-1.5 rounded-md transition-all flex items-center justify-center gap-1 cursor-pointer ${paymentMethod === 'cash' ? 'bg-white text-[#1A1A1A] shadow-sm font-black' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                            >
                                <Banknote size={10} /> CASH / เงินสด
                            </button>
                            <button 
                                type="button"
                                onClick={() => setPaymentMethod('qr')}
                                className={`flex-1 py-1.5 rounded-md transition-all flex items-center justify-center gap-1 cursor-pointer ${paymentMethod === 'qr' ? 'bg-white text-[#1A1A1A] shadow-sm font-black' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                            >
                                <CreditCard size={10} /> TRANSFER / โอน
                            </button>
                        </div>

                        {/* Print Bill / Show QR button if QR is chosen */}
                        {paymentMethod === 'qr' && (
                            <button 
                                onClick={() => onOpenSlip && onOpenSlip('billing')}
                                className="w-full bg-white hover:bg-[#FDFDFD] border border-[#D1D1CD] text-[#1A1A1A] py-2 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                            >
                                <Printer size={10} /> DISPLAY QR / พิมพ์ใบแจ้งยอด
                            </button>
                        )}

                        <div className="grid grid-cols-2 gap-2 font-mono text-[9px] font-bold uppercase tracking-wider">
                            {hasNewItems ? (
                                <button 
                                    onClick={() => onOpenSlip && onOpenSlip('kitchen')}
                                    className="col-span-2 bg-[#00CC44] hover:bg-[#00B33C] border border-[#009933] text-white py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-98 cursor-pointer"
                                >
                                    <Send size={10} /> SEND TO KITCHEN / ส่งครัว
                                </button>
                            ) : (
                                <>
                                    <button 
                                        onClick={() => onOpenSlip && onOpenSlip('kitchen')}
                                        className="flex items-center justify-center gap-1 bg-white hover:bg-[#FDFDFD] border border-[#D1D1CD] py-2 rounded-lg text-[#767673] hover:text-[#1A1A1A] transition-all shadow-sm cursor-pointer"
                                    >
                                        <ReceiptText size={10} /> KITCHEN SLIP
                                    </button>
                                    <button 
                                        onClick={() => onCheckout(paymentMethod, includeTax)}
                                        className="flex items-center justify-center gap-1 bg-[#FF5500] hover:bg-[#E04B00] border border-[#D04500] text-white py-2 rounded-lg transition-all shadow-sm active:scale-98 cursor-pointer"
                                    >
                                        <Check size={10} /> CHECKOUT / ปิดโต๊ะ
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
                
                {/* Branding footer */}
                <div className="text-center pt-2 text-[8px] font-mono font-bold tracking-widest text-[#767673]/60 uppercase border-t border-[#D1D1CD] select-none">
                    ONHAUS SYSTEM ©
                </div>
            </div>
        </aside>
    );
}

function UtensilsIcon({ size = 24, strokeWidth = 2 }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>;
}
