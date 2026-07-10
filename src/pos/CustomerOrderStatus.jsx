import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Clock, CheckCircle, Receipt, ArrowLeft, Upload, FileText, Smartphone } from 'lucide-react';
import { motion } from 'framer-motion';
import { Toaster, toast } from 'sonner';

export default function CustomerOrderStatus() {
    const { tableId } = useParams();
    const navigate = useNavigate();

    // UI States
    const [loading, setLoading] = useState(true);
    const [uploadingSlip, setUploadingSlip] = useState(false);
    const [requestingBill, setRequestingBill] = useState(false);
    const [booking, setBooking] = useState(null);
    const [orderItems, setOrderItems] = useState([]);
    const [paymentQrUrl, setPaymentQrUrl] = useState(null);

    useEffect(() => {
        fetchActiveOrder();
        
        // Setup realtime subscription
        const sub = supabase.channel(`customer-order-${tableId}`)
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'bookings',
                filter: `table_id=eq.${tableId}` 
            }, () => {
                fetchActiveOrder(true);
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'order_items'
            }, () => {
                fetchActiveOrder(true);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(sub);
        };
    }, [tableId]);

    const fetchActiveOrder = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            // Find active token from local storage first to query exact booking
            const savedToken = localStorage.getItem(`table_${tableId}_token`);
            
            let query = supabase
                .from('bookings')
                .select('*, tables_layout(*)')
                .eq('table_id', tableId)
                .in('status', ['pending', 'confirmed', 'seated', 'ready']);

            if (savedToken) {
                query = query.eq('tracking_token', savedToken);
            }

            const { data: bookingData, error: bookingError } = await query
                .order('booking_time', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (bookingError || !bookingData) {
                setBooking(null);
                setLoading(false);
                return;
            }
            setBooking(bookingData);

            // Fetch order items for this booking
            const { data: itemsData } = await supabase
                .from('order_items')
                .select('*, menu_items(name)')
                .eq('booking_id', bookingData.id);

            setOrderItems(itemsData || []);

            // Fetch payment QR Code
            const { data: qrData } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'payment_qr_url')
                .maybeSingle();

            if (qrData?.value) {
                setPaymentQrUrl(qrData.value);
            }

        } catch (err) {
            console.error('Error fetching order status:', err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleUploadSlip = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !booking) return;

        setUploadingSlip(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `slip_${booking.id}_${Date.now()}.${fileExt}`;
            
            // Upload to Supabase Storage 'slips' bucket
            const { error: uploadError } = await supabase.storage
                .from('slips')
                .upload(fileName, file, {
                    cacheControl: '15552000'
                });

            if (uploadError) throw uploadError;

            // Update booking with the payment slip filename
            const { error: updateError } = await supabase
                .from('bookings')
                .update({ 
                    payment_slip_url: fileName 
                })
                .eq('id', booking.id);

            if (updateError) throw updateError;

            toast.success('อัปโหลดสลิปเรียบร้อยแล้ว พนักงานกำลังทำการตรวจสอบ');
            fetchActiveOrder(true);

        } catch (err) {
            console.error('Slip upload failed:', err);
            toast.error('อัปโหลดสลิปล้มเหลว: ' + err.message);
        } finally {
            setUploadingSlip(false);
        }
    };

    const handleRequestBill = async () => {
        if (!booking) return;
        setRequestingBill(true);
        try {
            const currentRemark = booking.staff_remark || '';
            const newRemark = currentRemark.includes('[CALL_BILL]') 
                ? currentRemark 
                : `[CALL_BILL] ${currentRemark}`.trim();

            const { error } = await supabase
                .from('bookings')
                .update({ staff_remark: newRemark })
                .eq('id', booking.id);

            if (error) throw error;

            toast.success('แจ้งพนักงานเรียกเช็คบิลเรียบร้อยแล้ว');
            fetchActiveOrder(true);
        } catch (err) {
            console.error('Request bill failed:', err);
            toast.error('ล้มเหลว: ' + err.message);
        } finally {
            setRequestingBill(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0C0C0C] text-white flex flex-col items-center justify-center font-sans">
                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-gray-400 text-sm tracking-widest">Loading order status...</p>
            </div>
        );
    }

    if (!booking) {
        return (
            <div className="min-h-screen bg-[#0C0C0C] text-white flex flex-col items-center justify-center font-sans p-6 text-center">
                <Clock size={48} className="text-gray-600 mb-6" />
                <h3 className="font-bold text-2xl mb-2">No Active Order</h3>
                <p className="text-gray-400 text-sm max-w-xs leading-relaxed mb-8">
                    We couldn't find an active order session for this table.
                </p>
                <button 
                    onClick={() => navigate(`/table/${tableId}`)} 
                    className="bg-orange-500 text-black px-6 py-3 rounded-2xl text-sm font-black active:scale-95 transition-all"
                >
                    ไปที่หน้าสั่งอาหาร (Go to Menu)
                </button>
            </div>
        );
    }

    // Map status to steps
    const steps = [
        { key: 'pending', label: 'ส่งออเดอร์แล้ว', desc: 'รอพนักงานกดยอมรับ', time: booking.booking_time },
        { key: 'seated', label: 'รับออเดอร์แล้ว', desc: 'กำลังจัดเตรียมอาหาร', time: booking.status !== 'pending' ? booking.booking_time : null },
        { key: 'ready', label: 'พร้อมเสิร์ฟ', desc: 'อาหารพร้อมเสิร์ฟที่โต๊ะ', time: booking.status === 'ready' ? new Date().toISOString() : null },
    ];

    const getActiveStepIndex = () => {
        if (booking.status === 'pending') return 0;
        if (booking.status === 'confirmed' || booking.status === 'seated') return 1;
        if (booking.status === 'ready') return 2;
        return 0;
    };

    const activeStep = getActiveStepIndex();

    return (
        <div className="min-h-screen w-full bg-[#0C0C0C] text-white font-sans flex flex-col pb-10 selection:bg-orange-500 selection:text-white">
            <Toaster position="top-center" richColors />

            {/* Header */}
            <header className="sticky top-0 bg-[#0C0C0C]/80 backdrop-blur-xl border-b border-white/5 z-40 p-5 flex items-center gap-4">
                <button 
                    onClick={() => navigate(`/table/${tableId}`)}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="font-bold text-lg">ติดตามสถานะออเดอร์</h1>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-extrabold mt-0.5">
                        Table {booking.tables_layout?.table_name} · Queue #{booking.tracking_token ? booking.tracking_token.slice(0, 4) : booking.id.slice(0, 4)}
                    </p>
                </div>
            </header>

            {/* Status Timeline */}
            <section className="p-6 border-b border-white/5 bg-[#121212]/30">
                <h3 className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-6">ความคืบหน้า (Order Status)</h3>
                
                <div className="relative pl-8 space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
                    {steps.map((step, idx) => {
                        const isDone = idx <= activeStep;
                        const isCurrent = idx === activeStep;
                        return (
                            <div key={step.key} className="relative">
                                {/* Dot Icon */}
                                <div className={`absolute -left-8 top-0.5 w-6.5 h-6.5 rounded-full flex items-center justify-center border-2 transition-all ${
                                    isDone 
                                    ? 'bg-orange-500 border-orange-500 text-black shadow-md shadow-orange-500/10' 
                                    : 'bg-[#121212] border-white/10 text-gray-600'
                                }`}>
                                    {isDone ? (
                                        <CheckCircle size={14} className="shrink-0" />
                                    ) : (
                                        <div className="w-1.5 h-1.5 bg-gray-600 rounded-full" />
                                    )}
                                </div>

                                <div className="pl-2">
                                    <h4 className={`font-bold text-sm leading-none ${isDone ? 'text-white font-extrabold' : 'text-gray-500'}`}>
                                        {step.label}
                                        {isCurrent && <span className="ml-2 text-[10px] bg-orange-500/10 text-orange-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">กำลังเกิดขึ้น</span>}
                                    </h4>
                                    <p className="text-xs text-gray-500 mt-1">{step.desc}</p>
                                    {step.time && isDone && (
                                        <span className="text-[10px] text-gray-600 font-bold mt-1.5 block">
                                            {new Date(step.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Order Items Summary */}
            <section className="p-6 border-b border-white/5">
                <h3 className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-4">รายการอาหารสุทธิ (Items Summary)</h3>
                
                <div className="space-y-4">
                    {orderItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start text-sm">
                            <div className="flex gap-3">
                                <span className="font-bold text-orange-500 text-sm">{item.quantity}x</span>
                                <div>
                                    <span className="font-bold text-white block">{item.menu_items?.name}</span>
                                    {item.selected_options && typeof item.selected_options === 'object' && !Array.isArray(item.selected_options) && (
                                        <div className="text-[10px] text-gray-500 mt-0.5 font-medium italic">
                                            {Object.values(item.selected_options).flat().join(', ')}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <span className="font-mono text-gray-400">฿{(item.price_at_time * item.quantity).toLocaleString()}</span>
                        </div>
                    ))}
                    
                    {orderItems.length === 0 && (
                        <div className="text-center py-6 text-gray-500 text-xs">
                            กำลังโหลดรายละเอียดรายการอาหาร...
                        </div>
                    )}

                    <div className="border-t border-white/5 pt-4 mt-2 flex justify-between items-baseline">
                        <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">ยอดรวมค่าอาหารสุทธิ</span>
                        <span className="text-xl font-black text-orange-500">฿{booking.total_amount?.toLocaleString()}.-</span>
                    </div>
                </div>
            </section>

            {/* Payment Section (Pay at Table) */}
            <section className="p-6">
                <h3 className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-4">สแกนจ่ายเงินที่โต๊ะ (Pay at Table)</h3>
                
                <div className="bg-[#121212] border border-white/5 rounded-3xl p-5 flex flex-col items-center">
                    {paymentQrUrl ? (
                        <>
                            <div className="mb-4 bg-white p-2 rounded-2xl border-2 border-[#DFFF00]/30 shadow-md">
                                <img src={paymentQrUrl} alt="Payment QR" className="w-40 h-40 object-contain rounded-xl" />
                            </div>
                            <p className="text-[10px] text-gray-400 text-center leading-relaxed max-w-[240px] mb-6">
                                สแกน QR Code ด้านบนเพื่อชำระเงิน จากนั้นอัปโหลดสลิปเพื่อแจ้งการชำระเงินกับแคชเชียร์
                            </p>
                        </>
                    ) : (
                        <div className="w-full flex items-center justify-center p-8 bg-black/30 rounded-2xl text-gray-500 text-xs mb-4">
                            ไม่มีรูปภาพ QR ชำระเงินในระบบ
                        </div>
                    )}

                    {booking.payment_slip_url ? (
                        <div className="w-full bg-green-500/10 border border-green-500/20 p-4 rounded-2xl flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center shrink-0">
                                <FileText size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-white">อัปโหลดสลิปสำเร็จแล้ว</p>
                                <p className="text-[10px] text-green-400 font-medium">พนักงานกำลังตรวจสอบเพื่อทำการเช็คเอาท์</p>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full space-y-3">
                            <label className={`w-full cursor-pointer flex flex-col items-center justify-center bg-black/40 border border-dashed border-white/10 hover:border-orange-500/50 rounded-2xl p-5 transition-all text-center group ${uploadingSlip ? 'pointer-events-none opacity-50' : ''}`}>
                                <Upload size={24} className="text-gray-500 group-hover:text-orange-500 transition-colors mb-2" />
                                <span className="text-xs font-bold text-gray-300 group-hover:text-white transition-colors">
                                    {uploadingSlip ? 'กำลังอัปโหลด...' : 'คลิกที่นี่เพื่อส่งสลิปโอนเงิน (Upload Slip)'}
                                </span>
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    accept="image/*" 
                                    onChange={handleUploadSlip} 
                                    disabled={uploadingSlip}
                                />
                            </label>

                            <button
                                onClick={handleRequestBill}
                                disabled={requestingBill || booking.staff_remark?.includes('[CALL_BILL]')}
                                className={`w-full py-3.5 rounded-2xl text-xs font-black transition-all border flex items-center justify-center gap-2 cursor-pointer ${
                                    booking.staff_remark?.includes('[CALL_BILL]')
                                        ? 'bg-orange-500/10 border-orange-500/25 text-orange-400 cursor-not-allowed'
                                        : 'bg-[#FF5500] hover:bg-[#E04B00] border-[#D04500] text-white active:scale-[0.99] shadow-md shadow-orange-500/5'
                                }`}
                            >
                                <Receipt size={16} />
                                {booking.staff_remark?.includes('[CALL_BILL]') ? 'เรียกพนักงานเช็คบิลแล้ว' : 'เรียกพนักงานเช็คบิล (Pay with Cash / Card)'}
                            </button>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
