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
                <div className="w-12 h-12 border-4 border-[#ff0000] border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-[#767673] text-xs font-mono font-bold tracking-widest uppercase">Loading order status...</p>
            </div>
        );
    }

    if (!booking) {
        return (
            <div className="min-h-screen bg-[#F0F0EC] text-[#1A1A1A] flex flex-col items-center justify-center font-sans p-6 text-center">
                <Clock size={48} className="text-[#767673] mb-6" />
                <h3 className="font-mono font-bold text-sm tracking-wider uppercase mb-2">No Active Order</h3>
                <p className="text-[#767673] text-xs max-w-xs leading-relaxed mb-8">
                    We couldn't find an active order session for this table.
                </p>
                <button 
                    onClick={() => navigate(`/table/${tableId}`)} 
                    className="bg-[#ff0000] hover:bg-[#d00000] border border-[#c00000] text-white px-6 py-3.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer shadow-sm"
                >
                    ไปที่หน้าสั่งอาหาร (Go to Menu)
                </button>
            </div>
        );
    }
    // Map status to steps
    const steps = [
        { key: 'pending', label: 'ส่งออเดอร์แล้ว', desc: 'รอพนักงานกดยอมรับ', time: booking.booking_time },
        { key: 'seated', label: 'รับออเดอร์แล้ว', desc: 'พนักงานยอมรับออเดอร์แล้ว กำลังจัดเตรียมอาหาร', time: booking.status !== 'pending' ? booking.booking_time : null },
    ];

    const getActiveStepIndex = () => {
        if (booking.status === 'pending') return 0;
        return 1;
    };

    const activeStep = getActiveStepIndex();

    return (
        <div className="min-h-screen w-full bg-[#F0F0EC] text-[#1A1A1A] font-sans flex flex-col pb-10 selection:bg-[#ff0000] selection:text-white select-none">
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
            <div className="p-4 bg-transparent">
                <button
                    onClick={() => navigate(`/table/${tableId}`)}
                    className="w-full bg-[#ff0000] hover:bg-[#d00000] border border-[#c00000] text-white py-3.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-98"
                >
                    + สั่งอาหารเพิ่ม (Order More)
                </button>
            </div>

            {/* main frame */}
            <div className="px-4 space-y-4">
                {/* Timeline Steps (Rams Dial/LED style) */}
                <section className="bg-white border border-[#D1D1CD] rounded-xl p-5 shadow-sm">
                    <h3 className="text-[9px] text-[#767673] font-mono font-bold uppercase tracking-widest mb-5">ความคืบหน้า (ORDER STATUS)</h3>
                    <div className="relative pl-7 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[1px] before:bg-[#D1D1CD]">
                        {steps.map((step, idx) => {
                            const isDone = idx <= activeStep;
                            const isCurrent = idx === activeStep;
                            return (
                                <div key={step.key} className="relative">
                                    {/* Indicator light */}
                                    <div className="absolute -left-7 top-0.5 w-4 h-4 rounded-full bg-white border border-[#D1D1CD] flex items-center justify-center">
                                        {isCurrent ? (
                                            <span className="w-2 h-2 rounded-full bg-[#ff0000] shadow-[0_0_6px_#ff0000] animate-pulse" />
                                        ) : isDone ? (
                                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                        ) : (
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#D1D1CD]" />
                                        )}
                                    </div>

                                    <div className="pl-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-bold ${isDone ? 'text-[#1A1A1A]' : 'text-[#767673]'}`}>
                                                {step.label}
                                            </span>
                                            {isCurrent && (
                                                <span className="bg-[#ff0000]/10 text-[#ff0000] text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded leading-none">
                                                    กำลังเตรียม
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-[#767673] mt-0.5 leading-relaxed">{step.desc}</p>
                                        {step.time && isDone && (
                                            <span className="text-[9px] text-[#767673] font-mono font-bold mt-1 block">
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
                <section className="bg-white border border-[#D1D1CD] rounded-xl p-5 shadow-sm">
                    <h3 className="text-[9px] text-[#767673] font-mono font-bold uppercase tracking-widest mb-4">รายการอาหารสุทธิ (ITEMS SUMMARY)</h3>
                    
                    <div className="space-y-3.5">
                        {orderItems.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-start text-xs text-[#1A1A1A] pb-3 border-b border-[#D1D1CD]/30 last:border-b-0 last:pb-0">
                                <div className="flex gap-2.5">
                                    <span className="font-bold text-[#ff0000]">{item.quantity}x</span>
                                    <div>
                                        <span className="font-bold text-[#1A1A1A] block leading-tight">{item.menu_items?.name}</span>
                                        {item.selected_options && typeof item.selected_options === 'object' && !Array.isArray(item.selected_options) && (
                                            <div className="text-[9px] text-[#767673] mt-0.5 italic font-medium">
                                                {Object.values(item.selected_options).flat().join(', ')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <span className="font-mono text-[#767673] font-bold">฿{(item.price_at_time * item.quantity).toLocaleString()}</span>
                            </div>
                        ))}
                        
                        {orderItems.length === 0 && (
                            <div className="text-center py-4 text-[#767673] font-mono text-[9px] font-bold uppercase">
                                กำลังโหลดรายละเอียดรายการอาหาร...
                            </div>
                        )}

                        <div className="border-t border-[#D1D1CD] pt-3.5 mt-2 flex justify-between items-baseline">
                            <span className="text-[10px] text-[#767673] font-mono font-bold uppercase tracking-wider">ยอดรวมค่าอาหารสุทธิ</span>
                            <span className="text-lg font-black text-[#ff0000] font-mono">฿{booking.total_amount?.toLocaleString()}.-</span>
                        </div>
                    </div>
                </section>

                {/* Payment Section (Pay at Table) */}
                <section className="bg-white border border-[#D1D1CD] rounded-xl p-5 shadow-sm flex flex-col items-center">
                    <h3 className="text-[9px] text-[#767673] font-mono font-bold uppercase tracking-widest mb-3 self-start">การเช็คบิลและชำระเงิน (Checkout & Payment)</h3>
                    
                    {!booking.staff_remark?.includes('[CALL_BILL]') ? (
                        // Case 1: Bill not requested yet
                        <div className="w-full text-center space-y-3.5 py-2">
                            <Smartphone size={28} className="text-[#767673] mx-auto animate-pulse" />
                            <div>
                                <h4 className="font-bold text-xs text-[#1A1A1A]">ต้องการเช็คบิลชำระเงิน?</h4>
                                <p className="text-[10px] text-[#767673] mt-0.5 leading-relaxed">กดปุ่มเพื่อเรียกพนักงานเช็คบิลและรับ QR Code เพื่อสแกนจ่ายได้ทันที</p>
                            </div>
                            <button
                                onClick={handleRequestBill}
                                disabled={requestingBill}
                                className="w-full bg-[#ff0000] hover:bg-[#d00000] border border-[#c00000] text-white py-3.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-97"
                            >
                                <Receipt size={12} />
                                {requestingBill ? 'กำลังดำเนินการ...' : 'เรียกพนักงานเช็คบิล (Request Bill)'}
                            </button>
                        </div>
                    ) : (
                        // Case 2: Bill requested! Show QR and Slip upload
                        <div className="w-full space-y-4">
                            <div className="bg-[#00CC44]/10 border border-[#00CC44]/20 rounded-xl py-2 px-3 flex items-center gap-2 text-[#00CC44] font-mono font-bold text-[9px] uppercase tracking-wider justify-center">
                                <CheckCircle size={12} />
                                <span>เรียกพนักงานเช็คบิลแล้ว</span>
                            </div>

                            <div className="w-full text-center py-6 bg-white border border-[#D1D1CD] rounded-xl flex flex-col items-center gap-2.5 shadow-sm">
                                <Smartphone size={32} className="text-[#ff0000] animate-bounce" />
                                <div>
                                    <h4 className="font-bold text-xs text-[#1A1A1A]">กรุณาชำระเงินโดยสแกนกับพนักงาน</h4>
                                    <p className="text-[10px] text-[#767673] max-w-[250px] leading-relaxed mx-auto mt-1 px-4">
                                        พนักงานกำลังนำใบแจ้งยอดชำระเงิน (Bill) และ QR Code ไปแสดงที่โต๊ะของท่านเพื่อสแกนจ่ายโดยตรง
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
