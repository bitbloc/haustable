import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Clock, CheckCircle, Receipt, ArrowLeft, Upload, FileText, Smartphone, Users, Edit, Check, X, Gamepad2, Crown, Sparkles, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Toaster, toast } from 'sonner';

export default function CustomerOrderStatus() {
    const { tableId } = useParams();
    const navigate = useNavigate();

    // UI States
    const [showPaxModal, setShowPaxModal] = useState(false);
    const [editPaxInput, setEditPaxInput] = useState('1');
    const [loading, setLoading] = useState(true);
    const [uploadingSlip, setUploadingSlip] = useState(false);
    const [requestingBill, setRequestingBill] = useState(false);
    const [booking, setBooking] = useState(null);
    const [orderItems, setOrderItems] = useState([]);
    const [paymentQrUrl, setPaymentQrUrl] = useState(null);

    useEffect(() => {
        if (tableId) {
            localStorage.setItem('active_customer_table_id', tableId);
        }
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
            <header className="sticky top-0 bg-[#F5F5F2]/95 backdrop-blur-md border-b border-[#D1D1CD] z-40 p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => navigate(`/table/${tableId}`)}
                        className="p-2 bg-white border border-[#D1D1CD] hover:bg-[#E0E0DC] rounded-full text-[#767673] hover:text-[#1A1A1A] transition-colors cursor-pointer"
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <h1 className="font-bold text-sm text-[#1A1A1A] flex items-center gap-2">
                            <span>ติดตามสถานะออเดอร์</span>
                            {booking.booking_time && (() => {
                                const startMins = Math.max(0, Math.floor((Date.now() - new Date(booking.booking_time).getTime()) / 60000));
                                const formatted = startMins < 60 ? `${startMins}m` : `${Math.floor(startMins / 60)}h${startMins % 60}m`;
                                return (
                                    <span className="bg-white border border-[#D1D1CD] text-[#1A1A1A] px-2 py-0.5 rounded-full font-mono text-[9px] font-bold">
                                        ⏱️ {formatted}
                                    </span>
                                );
                            })()}
                        </h1>
                        <p className="text-[9px] text-[#767673] uppercase tracking-widest font-mono font-bold mt-0.5">
                            Table {booking.tables_layout?.table_name} · Queue #{booking.tracking_token ? booking.tracking_token.slice(0, 4) : String(booking.id).slice(0, 4)}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        setEditPaxInput(String(booking.pax || 1));
                        setShowPaxModal(true);
                    }}
                    className="bg-white border border-[#D1D1CD] hover:border-[#1A1A1A] text-[#1A1A1A] px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                    <span>👥 {booking.pax || 1} คน</span>
                    <Edit size={10} className="text-[#ff0000]" />
                </button>
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

                {/* Arcade Invitation Section (Dieter Rams Braun Dial & Terracotta Clay) */}
                <section className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-xl p-5 shadow-sm relative overflow-hidden">
                    <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-[oklch(52%_0.16_28)]/10 text-[oklch(52%_0.16_28)] border border-[oklch(52%_0.16_28)]/20 flex items-center justify-center font-black">
                                <Gamepad2 size={18} />
                            </div>
                            <div>
                                <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                                    HAUS ARCADE PLAYGROUND
                                </h3>
                                <p className="text-[9px] text-[oklch(42%_0.010_28)] font-mono uppercase tracking-widest mt-0.5">
                                    PLAY WHILE WAITING FOR FOOD
                                </p>
                            </div>
                        </div>
                        <span className="bg-[oklch(52%_0.16_28)]/10 text-[oklch(52%_0.16_28)] text-[9px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            P2E REWARDS
                        </span>
                    </div>

                    <p className="text-xs text-[oklch(18%_0.012_28)] leading-relaxed mb-4">
                        ระหว่างรอห้องครัวจัดเตรียมอาหาร ชวนเล่นเกม <strong>Flappy Cat</strong> สะสมแต้ม 🪙 <strong>xhaus</strong> และรับสิทธิ์ลุ้นรางวัลพิเศษได้ทันที!
                    </p>

                    <button
                        onClick={() => navigate(`/arcade?tableId=${tableId}`)}
                        className="w-full bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white py-3 px-4 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-97 cursor-pointer flex items-center justify-center gap-2"
                    >
                        <span>🎮 เข้าสู่ Arcade เล่นเกมรออาหาร</span>
                        <ArrowRight size={14} />
                    </button>
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
                                        {item.selected_options && (
                                            <div className="text-[9px] text-[#ff0000] mt-0.5 font-bold space-y-0.5">
                                                {Array.isArray(item.selected_options) ? (
                                                    item.selected_options.map((opt, i) => (
                                                        <div key={i}>
                                                            ▶ {typeof opt === 'object' ? `${opt.group_name ? `${opt.group_name}: ` : ''}${opt.name}` : opt}
                                                        </div>
                                                    ))
                                                ) : typeof item.selected_options === 'object' ? (
                                                    Object.entries(item.selected_options).map(([k, v], i) => (
                                                        <div key={i}>
                                                            ▶ {Array.isArray(v) ? `${k}: ${v.join(', ')}` : `${k}: ${v}`}
                                                        </div>
                                                    ))
                                                ) : null}
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

            {/* Edit Pax Modal */}
            {showPaxModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl font-sans text-[#1A1A1A]">
                        <div className="p-4 border-b border-[#D1D1CD] flex items-center justify-between">
                            <div>
                                <h3 className="font-mono font-bold text-xs uppercase tracking-wider">ปรับจำนวนลูกค้า (Party Size)</h3>
                                <p className="text-[10px] text-[#767673] font-mono mt-0.5">โต๊ะ {booking.tables_layout?.table_name}</p>
                            </div>
                            <button onClick={() => setShowPaxModal(false)} className="p-1 hover:bg-[#EAEAE6] rounded-lg text-[#767673]">
                                <X size={16} />
                            </button>
                        </div>
                        
                        <div className="p-6 flex flex-col items-center gap-4 text-center">
                            <div className="text-xs font-bold text-[#1A1A1A]">
                                ระบุจำนวนลูกค้าล่าสุดสำหรับโต๊ะนี้
                            </div>

                            {/* Stepper */}
                            <div className="flex items-center gap-4 my-1">
                                <button 
                                    onClick={() => setEditPaxInput(prev => String(Math.max(1, (parseInt(prev) || 1) - 1)))}
                                    className="w-12 h-12 rounded-xl bg-white border border-[#D1D1CD] hover:border-[#1A1A1A] text-2xl font-bold flex items-center justify-center active:scale-95 transition-all shadow-sm cursor-pointer select-none"
                                >
                                    -
                                </button>
                                <input 
                                    type="number"
                                    min="1"
                                    max="99"
                                    value={editPaxInput}
                                    onChange={(e) => setEditPaxInput(e.target.value)}
                                    className="w-24 h-12 bg-white border-2 border-[#ff0000] rounded-xl text-center text-2xl font-mono font-black text-[#1A1A1A] focus:outline-none focus:border-[#d00000] shadow-inner"
                                />
                                <button 
                                    onClick={() => setEditPaxInput(prev => String((parseInt(prev) || 1) + 1))}
                                    className="w-12 h-12 rounded-xl bg-white border border-[#D1D1CD] hover:border-[#1A1A1A] text-2xl font-bold flex items-center justify-center active:scale-95 transition-all shadow-sm cursor-pointer select-none"
                                >
                                    +
                                </button>
                            </div>

                            {/* Quick Presets */}
                            <div className="grid grid-cols-5 gap-2 w-full mt-2">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                    <button
                                        key={num}
                                        onClick={() => setEditPaxInput(String(num))}
                                        className={`py-2 rounded-xl font-mono font-bold text-xs transition-all cursor-pointer ${parseInt(editPaxInput) === num ? 'bg-[#ff0000] text-white shadow-md scale-[1.03]' : 'bg-white border border-[#D1D1CD] text-[#1A1A1A]'}`}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 border-t border-[#D1D1CD] bg-[#EBEBE9]">
                            <button
                                onClick={async () => {
                                    const num = parseInt(editPaxInput);
                                    if (!num || num <= 0) {
                                        toast.error('กรุณาระบุจำนวนคนให้ถูกต้อง');
                                        return;
                                    }
                                    const { error } = await supabase
                                        .from('bookings')
                                        .update({ pax: num })
                                        .eq('id', booking.id);

                                    if (error) {
                                        toast.error('ล้มเหลว: ' + error.message);
                                    } else {
                                        toast.success(`อัปเดตจำนวนลูกค้าเป็น ${num} คนแล้ว`);
                                        fetchActiveOrder(true);
                                        setShowPaxModal(false);
                                    }
                                }}
                                className="w-full bg-[#ff0000] hover:bg-[#d00000] text-white py-3 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                            >
                                <Check size={16} /> บันทึกจำนวนคน (Save)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
