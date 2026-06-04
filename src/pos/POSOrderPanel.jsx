import React from 'react';
import { Trash2, Plus, Minus, CreditCard, Banknote, UserPlus, ReceiptText, AlertCircle, Receipt, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function POSOrderPanel({ order, booking, onUpdateQuantity, onClear, onCheckout, onAcceptOrder }) {
    const [includeTax, setIncludeTax] = React.useState(true);
    const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = includeTax ? subtotal * 0.07 : 0;
    const total = subtotal + tax;

    return (
        <aside className="w-[380px] bg-[#1A1A1A] border-l border-white/5 flex flex-col h-full shadow-2xl z-30 font-sans">
            {/* Order Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div>
                    <h3 className="font-bold text-xl">Current Order</h3>
                    <p className="text-xs text-gray-500 font-medium">
                        {order.table ? `Table: ${order.table.table_name}` : 'Walk-in Order'}
                    </p>
                </div>
                <button 
                    onClick={onClear}
                    className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                >
                    <Trash2 size={20} />
                </button>
            </div>

            {/* Pending Order Alert */}
            {booking && booking.status === 'pending' && (
                <div className="mx-6 mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-yellow-500">
                        <AlertCircle size={18} />
                        <span className="font-bold text-sm">New Table Order</span>
                    </div>
                    <p className="text-xs text-gray-400">This order is waiting for staff approval and kitchen print.</p>
                    <button 
                        onClick={onAcceptOrder}
                        className="w-full bg-yellow-500 text-black py-2.5 rounded-xl font-bold text-xs hover:bg-yellow-400 transition-all flex items-center justify-center gap-1.5"
                    >
                        <Check size={14} /> Accept & Print Slip
                    </button>
                </div>
            )}

            {/* Payment Slip Alert */}
            {booking && booking.payment_slip_url && (
                <div className="mx-6 mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-2xl flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-green-400 font-bold text-sm">
                        <Receipt size={18} />
                        <span>Payment Slip Uploaded</span>
                    </div>
                    <button 
                        onClick={() => window.open(`https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/slips/${booking.payment_slip_url}`, '_blank')}
                        className="w-full bg-green-500 text-black py-2.5 rounded-xl font-bold text-xs hover:bg-green-400 transition-all flex items-center justify-center gap-1.5"
                    >
                        <Receipt size={14} /> View Slip Image
                    </button>
                </div>
            )}

            {/* Customer Lookup (CRM Hook) */}
            <div className="px-6 py-4">
                <button className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center gap-4 hover:border-orange-500/30 transition-all group">
                    <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500">
                        <UserPlus size={20} />
                    </div>
                    <div className="text-left flex-1">
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Customer / CRM</p>
                        <p className="text-sm font-bold">Add Member</p>
                    </div>
                </button>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto px-6 space-y-3 scrollbar-none">
                <AnimatePresence>
                    {order.items.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-4 opacity-50">
                            <UtensilsIcon size={48} strokeWidth={1} />
                            <p className="text-sm font-medium">Cart is empty</p>
                        </div>
                    ) : (
                        order.items.map(item => (
                            <motion.div 
                                key={item.id}
                                initial={{ x: 20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -20, opacity: 0 }}
                                className="bg-black/20 p-4 rounded-2xl flex items-center gap-4 group"
                            >
                                <div className="flex-1">
                                    <h5 className="font-bold text-sm leading-tight mb-1">{item.name}</h5>
                                    <p className="text-xs text-orange-500 font-bold">฿{item.price}</p>
                                </div>

                                <div className="flex items-center bg-black/40 rounded-xl p-1 gap-1">
                                    <button 
                                        onClick={() => onUpdateQuantity(item.id, -1)}
                                        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                    >
                                        <Minus size={14} />
                                    </button>
                                    <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                                    <button 
                                        onClick={() => onUpdateQuantity(item.id, 1)}
                                        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>

            {/* Summary & Checkout */}
            <div className="p-6 bg-black/30 border-t border-white/5 space-y-4">
                <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm text-gray-500 font-medium">
                        <span>Subtotal</span>
                        <span>฿{subtotal.toFixed(2)}</span>
                    </div>
                    
                    {/* VAT Toggle Row */}
                    <div className="flex justify-between items-center py-1">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500 font-medium">VAT (7%)</span>
                            <button 
                                onClick={() => setIncludeTax(!includeTax)}
                                className={`w-8 h-4 rounded-full transition-colors relative flex items-center ${includeTax ? 'bg-orange-500' : 'bg-white/10'}`}
                            >
                                <div className={`absolute w-3 h-3 bg-white rounded-full transition-transform ${includeTax ? 'translate-x-4' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        <span className={`text-sm font-bold ${includeTax ? 'text-gray-400' : 'text-gray-600 line-through'}`}>
                            ฿{(subtotal * 0.07).toFixed(2)}
                        </span>
                    </div>

                    <div className="flex justify-between items-end text-2xl font-black pt-2">
                        <span className="text-sm text-gray-500 font-bold pb-1 uppercase tracking-tight">Net Total</span>
                        <span className="text-orange-500">฿{total.toFixed(2)}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                     <PaymentButton icon={Banknote} label="Cash" onClick={() => onCheckout('cash')} />
                     <PaymentButton icon={CreditCard} label="Card/QR" onClick={() => onCheckout('qr')} color="bg-orange-500" />
                </div>

                <button className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 py-3 rounded-2xl text-xs font-bold text-gray-400 transition-all">
                    <ReceiptText size={16} /> Print Kitchen Slip
                </button>
            </div>
        </aside>
    );
}

function UtensilsIcon({ size = 24, strokeWidth = 2 }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>;
}

function PaymentButton({ icon: Icon, label, onClick, color = "bg-white/5" }) {
    return (
        <button 
            onClick={onClick}
            className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl transition-all active:scale-95 ${color} ${color === 'bg-white/5' ? 'hover:bg-white/10' : 'hover:brightness-110 shadow-lg shadow-orange-500/20'}`}
        >
            <Icon size={24} />
            <span className="text-xs font-bold">{label}</span>
        </button>
    );
}
