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
            <div className="min-h-screen bg-[#ECECE9] text-[#1A1A1A] flex flex-col items-center justify-center font-sans">
                <div className="w-12 h-12 border-4 border-[#FF5500] border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-[#767673] text-xs font-mono font-bold tracking-widest uppercase">Loading order status...</p>
            </div>
        );
    }

    if (!booking) {
        return (
            <div className="min-h-screen bg-[#ECECE9] text-[#1A1A1A] flex flex-col items-center justify-center font-sans p-6 text-center">
                <Clock size={48} className="text-[#767673] mb-6" />
                <h3 className="font-mono font-bold text-sm tracking-wider uppercase mb-2">No Active Order</h3>
                <p className="text-[#767673] text-xs max-w-xs leading-relaxed mb-8">
                    We couldn't find an active order session for this table.
                </p>
                <button 
                    onClick={() => navigate(`/table/${tableId}`)} 
                    className="bg-[#FF5500] hover:bg-[#E04B00] border border-[#D04500] text-white px-6 py-3.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer shadow-sm"
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
        <div className="min-h-screen w-full bg-[#ECECE9] text-[#1A1A1A] font-sans flex flex-col pb-10 selection:bg-[#FF5500] selection:text-white select-none">
            <Toaster position="top-center" richColors />

            {/* Header */}
            <header className="sticky top-0 bg-[#F5F5F2]/95 backdrop-blur-md border-b border-[#D1D1CD] z-40 p-4 flex items-center gap-4 shadow-sm">
                <button 
                    onClick={() => navigate(`/table/${tableId}`)}
                    className="p-2 bg-white border border-[#D1D1CD] hover:bg-[#E0E0DC] rounded-full text-[#767673] hover:text-[#1A1A1A] transition-colors cursor-pointer"
                >
                    <ArrowLeft size={16} />
                </button>
                <div>
                    <h1 className="font-bold text-sm text-[#1A1A1A]">ติดตามสถานะออเดอร์</h1>
                    <p className="text-[9px] text-[#767673] uppercase tracking-widest font-mono font-bold mt-0.5">
                        Table {booking.tables_layout?.table_name} · Queue #{booking.tracking_token ? booking.tracking_token.slice(0, 4) : booking.id.slice(0, 4)}
                    </p>
                </div>
            </header>

            {/* Order More Section */}
            <div className="p-4 bg-white border-b border-[#D1D1CD]">
                <button
                    onClick={() => navigate(`/table/${tableId}`)}
                    className="w-full bg-[#FF5500] hover:bg-[#E04B00] border border-[#D04500] text-white py-3.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                    + สั่งอาหารเพิ่ม (Order More)
                </button>
            </div>

            {/* Status Timeline */}
            <section className="p-6 border-b border-[#D1D1CD] bg-[#F5F5F2]/50">
                <h3 className="text-[10px] text-[#767673] font-mono font-bold uppercase tracking-wider mb-6">ความคืบหน้า (Order Status)</h3>
                
                <div className="relative pl-8 space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#D1D1CD]">
                    {steps.map((step, idx) => {
                        const isDone = idx <= activeStep;
                        const isCurrent = idx === activeStep;
                        return (
                            <div key={step.key} className="relative">
                                {/* Dot Icon */}
                                <div className={`absolute -left-8 top-0.5 w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                                    isDone 
                                    ? 'bg-[#FF5500] border-[#D04500] text-white shadow-sm' 
                                    : 'bg-white border-[#D1D1CD] text-[#767673]'
                                }`}>
                                    {isDone ? (
                                        <CheckCircle size={12} className="shrink-0" />
                                    ) : (
                                        <div className="w-1.5 h-1.5 bg-[#767673] rounded-full" />
                                    )}
                                </div>

                                <div className="pl-2">
                                    <h4 className={`font-bold text-xs leading-none ${isDone ? 'text-[#1A1A1A] font-extrabold' : 'text-[#767673]'}`}>
                                        {step.label}
                                        {isCurrent && <span className="ml-2 text-[8px] bg-[#FF5500]/10 text-[#FF5500] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">กำลังเตรียม</span>}
                                    </h4>
                                    <p className="text-[10px] text-[#767673] mt-1">{step.desc}</p>
                                    {step.time && isDone && (
                                        <span className="text-[9px] text-[#767673] font-mono font-bold mt-1.5 block">
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
            <section className="p-6 border-b border-[#D1D1CD] bg-white">
                <h3 className="text-[10px] text-[#767673] font-mono font-bold uppercase tracking-wider mb-4">รายการอาหารสุทธิ (Items Summary)</h3>
                
                <div className="space-y-4">
                    {orderItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start text-xs text-[#1A1A1A]">
                            <div className="flex gap-3">
                                <span className="font-bold text-[#FF5500] text-xs">{item.quantity}x</span>
                                <div>
                                    <span className="font-bold text-[#1A1A1A] block">{item.menu_items?.name}</span>
                                    {item.selected_options && typeof item.selected_options === 'object' && !Array.isArray(item.selected_options) && (
                                        <div className="text-[9px] text-[#767673] mt-0.5 font-medium italic">
                                            {Object.values(item.selected_options).flat().join(', ')}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <span className="font-mono text-[#767673]">฿{(item.price_at_time * item.quantity).toLocaleString()}</span>
                        </div>
                    ))}
                    
                    {orderItems.length === 0 && (
                        <div className="text-center py-6 text-[#767673] font-mono text-[10px] font-bold uppercase">
                            กำลังโหลดรายละเอียดรายการอาหาร...
                        </div>
                    )}

                    <div className="border-t border-[#D1D1CD] pt-4 mt-2 flex justify-between items-baseline">
                        <span className="text-[10px] text-[#767673] font-mono font-bold uppercase tracking-wider">ยอดรวมค่าอาหารสุทธิ</span>
                        <span className="text-lg font-black text-[#FF5500] font-mono">฿{booking.total_amount?.toLocaleString()}.-</span>
                    </div>
                </div>
            </section>

            {/* Payment Section (Pay at Table) */}
            <section className="p-6">
                <h3 className="text-[10px] text-[#767673] font-mono font-bold uppercase tracking-wider mb-4">การเช็คบิลและชำระเงิน (Checkout & Payment)</h3>
                
                <div className="bg-white border border-[#D1D1CD] rounded-2xl p-5 flex flex-col items-center">
                    {!booking.staff_remark?.includes('[CALL_BILL]') ? (
                        // Case 1: Bill not requested yet
                        <div className="w-full text-center space-y-4">
                            <Smartphone size={32} className="text-[#767673] mx-auto mb-2 animate-pulse" />
                            <div>
                                <h4 className="font-bold text-xs text-[#1A1A1A]">ต้องการเช็คบิลชำระเงิน?</h4>
                                <p className="text-[10px] text-[#767673] mt-1 leading-relaxed">กดปุ่มด้านล่างเพื่อเรียกพนักงานมาเช็คบิลและแสดง QR Code ชำระเงิน</p>
                            </div>
                            <button
                                onClick={handleRequestBill}
                                disabled={requestingBill}
                                className="w-full bg-[#FF5500] hover:bg-[#E04B00] border border-[#D04500] text-white py-3.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                            >
                                <Receipt size={14} />
                                {requestingBill ? 'กำลังดำเนินการ...' : 'เรียกพนักงานเช็คบิล (Request Bill)'}
                            </button>
                        </div>
                    ) : (
                        // Case 2: Bill requested! Show QR and Slip upload
                        <div className="w-full space-y-4">
                            <div className="bg-[#00CC44]/10 border border-[#00CC44]/20 rounded-xl p-3 flex items-center gap-2.5 text-[#00CC44] font-mono font-bold text-[10px] uppercase tracking-wider justify-center">
                                <CheckCircle size={14} />
                                <span>เรียกพนักงานเช็คบิลแล้ว</span>
                            </div>

                            {paymentQrUrl ? (
                                <div className="flex flex-col items-center">
                                    <div className="mb-3 bg-white p-2.5 rounded-xl border border-[#D1D1CD] shadow-sm">
                                        <img src={paymentQrUrl} alt="Payment QR" className="w-36 h-36 object-contain" />
                                    </div>
                                    <p className="text-[9px] text-[#767673] text-center leading-relaxed max-w-[220px] mb-2">
                                        สแกน QR Code เพื่อชำระเงินออนไลน์ จากนั้นอัปโหลดภาพสลิปเพื่อแจ้งพนักงาน
                                    </p>
                                </div>
                            ) : (
                                <div className="w-full flex items-center justify-center p-6 bg-[#F5F5F2] rounded-xl text-[#767673] text-[10px] font-mono font-bold uppercase tracking-wider border border-[#D1D1CD]">
                                    ไม่มีรูปภาพ QR ในระบบ (ติดต่อพนักงาน)
                                </div>
                            )}

                            {booking.payment_slip_url ? (
                                <div className="w-full bg-[#00CC44]/10 border border-[#00CC44]/20 p-4 rounded-xl flex items-center gap-3">
                                    <div className="w-8 h-8 bg-[#00CC44]/20 text-[#00CC44] rounded-full flex items-center justify-center shrink-0">
                                        <FileText size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-[#1A1A1A]">แจ้งโอนเงินสำเร็จแล้ว</p>
                                        <p className="text-[10px] text-[#00CC44] font-bold">พนักงานกำลังตรวจสอบเพื่อทำการเช็คเอาท์</p>
                                    </div>
                                </div>
                            ) : (
                                <label className={`w-full cursor-pointer flex flex-col items-center justify-center bg-white border border-dashed border-[#D1D1CD] hover:border-[#FF5500] rounded-xl p-4 transition-all text-center group ${uploadingSlip ? 'pointer-events-none opacity-50' : ''}`}>
                                    <Upload size={20} className="text-[#767673] group-hover:text-[#FF5500] transition-colors mb-1.5" />
                                    <span className="text-[10px] font-bold text-[#767673] group-hover:text-[#1A1A1A] transition-colors">
                                        {uploadingSlip ? 'กำลังอัปโหลด...' : 'ส่งหลักฐานโอนเงิน / อัปโหลดสลิป'}
                                    </span>
                                    <input 
                                        type="file" 
                                        className="hidden" 
                                        accept="image/*" 
                                        onChange={handleUploadSlip} 
                                        disabled={uploadingSlip}
                                    />
                                </label>
                            )}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
