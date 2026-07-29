import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Globe, 
    AlertCircle, 
    Clock, 
    CheckCircle2, 
    ReceiptText,
    UtensilsCrossed,
    Calendar,
    BellRing
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

export default function POSOnlineHub({ activeShift, onOpenSlipModal, onViewSlipImage, refreshKey }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hubTab, setHubTab] = useState('active'); // 'active' | 'completed' | 'cancelled'
    const [persistentAlert, setPersistentAlert] = useState(null); // stores the incoming order that triggered the alert
    const audioRef = useRef(null);
    const alertIntervalRef = useRef(null);

    // Initialize audio context for alert
    useEffect(() => {
        audioRef.current = new Audio('/arcade/audio/point.wav'); 
        audioRef.current.loop = true;
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            if (alertIntervalRef.current) clearInterval(alertIntervalRef.current);
        };
    }, []);

    const playAlert = () => {
        if (audioRef.current) {
            audioRef.current.play().catch(e => {
                // Autoplay blocked fallback: use AudioContext oscillator
                try {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    const playBeep = () => {
                        const osc = ctx.createOscillator();
                        const gainNode = ctx.createGain();
                        osc.connect(gainNode);
                        gainNode.connect(ctx.destination);
                        osc.type = 'sine';
                        osc.frequency.value = 800;
                        gainNode.gain.setValueAtTime(0, ctx.currentTime);
                        gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.1);
                        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
                        osc.start(ctx.currentTime);
                        osc.stop(ctx.currentTime + 0.5);
                    };
                    playBeep();
                    alertIntervalRef.current = setInterval(playBeep, 2000); // Beep every 2 seconds
                } catch(err) {}
            });
        }
    };

    const stopAlert = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        if (alertIntervalRef.current) {
            clearInterval(alertIntervalRef.current);
            alertIntervalRef.current = null;
        }
    };

    const fetchOnlineData = async () => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayIso = today.toISOString();

            // We fetch bookings that are source = 'online' OR have payment_slip_url (for slip verification) OR booking_type = 'pickup' with online tracking
            const { data, error } = await supabase
                .from('bookings')
                .select('*, profiles(display_name, phone_number)')
                .gte('booking_time', todayIso)
                .order('booking_time', { ascending: false });

            if (error) throw error;

            // Filter for online relevant ones
            const onlineRelevant = (data || []).filter(b => {
                const isOnlineSource = b.source === 'online' || b.source === 'line';
                const hasSlip = !!b.payment_slip_url;
                const isOnlinePickup = b.booking_type === 'pickup' && (b.tracking_token || isOnlineSource);
                return isOnlineSource || hasSlip || isOnlinePickup;
            });

            setOrders(onlineRelevant);
        } catch (err) {
            console.error('Failed to fetch online orders:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOnlineData();

        // Subscription for real-time online order alerts
        const todayStr = new Date().toISOString().split('T')[0];
        
        const channel = supabase.channel('online_orders_hub')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'bookings',
                },
                (payload) => {
                    const b = payload.new;
                    // Check if it's relevant for online hub
                    const isOnlineSource = b.source === 'online' || b.source === 'line';
                    const hasSlip = !!b.payment_slip_url;
                    const isOnlinePickup = b.booking_type === 'pickup' && (b.tracking_token || isOnlineSource);
                    
                    if (isOnlineSource || hasSlip || isOnlinePickup) {
                        // Trigger persistent alert!
                        setPersistentAlert(b);
                        playAlert();
                        fetchOnlineData();
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'bookings',
                },
                (payload) => {
                    fetchOnlineData();
                    // If a slip was just uploaded for an existing booking
                    if (payload.new.payment_slip_url && !payload.old.payment_slip_url) {
                        setPersistentAlert(payload.new);
                        playAlert();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        if (refreshKey > 0) {
            fetchOnlineData();
        }
    }, [refreshKey]);

    const handleAcknowledge = () => {
        setPersistentAlert(null);
        stopAlert();
    };

    const updateBookingStatus = async (id, newStatus) => {
        try {
            const { error } = await supabase
                .from('bookings')
                .update({ status: newStatus })
                .eq('id', id);
            if (error) throw error;
            toast.success(`อัปเดตสถานะเป็น ${newStatus} สำเร็จ`);
            fetchOnlineData();
        } catch (err) {
            console.error(err);
            toast.error('ไม่สามารถอัปเดตสถานะได้');
        }
    };

    // Derived buckets
    const activeOrders = orders
        .filter(o => o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'no_show')
        .sort((a, b) => new Date(b.created_at || b.booking_time) - new Date(a.created_at || a.booking_time));

    const completedOrders = orders
        .filter(o => o.status === 'completed' || o.status === 'seated' || o.status === 'paid' || o.status === 'confirmed')
        .sort((a, b) => new Date(b.updated_at || b.booking_time) - new Date(a.updated_at || a.booking_time));

    const cancelledOrders = orders
        .filter(o => o.status === 'cancelled' || o.status === 'no_show')
        .sort((a, b) => new Date(b.updated_at || b.booking_time) - new Date(a.updated_at || a.booking_time));
    
    // Grouping
    const slipsToVerify = activeOrders.filter(o => !!o.payment_slip_url && o.status !== 'paid' && o.status !== 'completed');
    const newBookings = activeOrders.filter(o => o.booking_type === 'dine_in' && o.status === 'pending');
    const onlinePickups = activeOrders.filter(o => o.booking_type === 'pickup');

    if (loading) return (
        <div className="flex h-full items-center justify-center bg-[oklch(97%_0.008_28)]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[oklch(52%_0.16_28)]"></div>
        </div>
    );

    const renderCard = (order, typeLabel) => {
        const orderTimeStr = order.created_at ? new Date(order.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : null;
        const bookingTimeStr = new Date(order.booking_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        const name = order.profiles?.display_name || order.pickup_contact_name || order.customer_name || 'ลูกค้าทั่วไป';
        const phone = order.profiles?.phone_number || order.pickup_contact_phone || order.customer_phone || '';
        const isPickup = order.booking_type === 'pickup';

        return (
            <motion.div 
                key={order.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-xl p-4 flex flex-col gap-3 shadow-sm hover:border-[oklch(18%_0.012_28)] transition-colors"
            >
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                            <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block ${
                                isPickup ? 'bg-blue-100 text-blue-900 border border-blue-200' : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                            }`}>
                                {isPickup ? '🛍️ PICKUP (รับกลับบ้าน)' : '🍽️ DINE-IN (จองโต๊ะ)'}
                            </span>
                            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] bg-[oklch(52%_0.16_28)]/10 px-2 py-0.5 rounded-full">
                                {typeLabel}
                            </span>
                        </div>
                        <h4 className="font-bold text-[oklch(18%_0.012_28)] leading-tight">{name}</h4>
                        {phone && <p className="text-xs text-[oklch(55%_0.010_28)] font-mono mt-0.5">📞 {phone}</p>}
                    </div>

                    <div className="text-right font-mono shrink-0">
                        {orderTimeStr && (
                            <p className="text-[10px] text-[oklch(55%_0.010_28)]">
                                📩 สั่งเมื่อ: <strong className="text-[oklch(18%_0.012_28)]">{orderTimeStr} น.</strong>
                            </p>
                        )}
                        <p className="text-xs font-bold text-[oklch(18%_0.012_28)] mt-0.5 bg-[oklch(94%_0.010_28)] px-2 py-0.5 rounded border border-[oklch(85%_0.012_28)] inline-block">
                            ⏰ นัดหมาย: {bookingTimeStr} น.
                        </p>
                    </div>
                </div>

                {/* Amount badges */}
                <div className="flex items-center gap-2 font-mono text-xs pt-1 border-t border-[oklch(85%_0.012_28)] flex-wrap">
                    {order.total_amount > 0 && (
                        <span className="font-bold text-[oklch(18%_0.012_28)] bg-[oklch(94%_0.010_28)] px-2.5 py-1 rounded border border-[oklch(85%_0.012_28)]">
                            💰 ยอดรวม: ฿{order.total_amount}
                        </span>
                    )}
                    {order.deposit_amount > 0 && (
                        <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                            💳 โอนมัดจำ: ฿{order.deposit_amount}
                        </span>
                    )}
                </div>

                {order.customer_note && (
                    <div className="bg-[oklch(94%_0.010_28)] p-2 rounded text-xs text-[oklch(18%_0.012_28)] border-l-2 border-[oklch(52%_0.16_28)]">
                        "{order.customer_note}"
                    </div>
                )}

                <div className="mt-auto pt-3 border-t border-[oklch(85%_0.012_28)] flex gap-2">
                    {order.payment_slip_url && (
                        <button 
                            onClick={() => {
                                if (onViewSlipImage && order.payment_slip_url) {
                                    onViewSlipImage(order.payment_slip_url);
                                } else {
                                    onOpenSlipModal(order, 'billing');
                                }
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] text-xs font-bold transition-all hover:opacity-90 active:scale-95 cursor-pointer"
                        >
                            <ReceiptText size={14} />
                            ตรวจสลิป
                        </button>
                    )}

                    {order.booking_type === 'dine_in' && order.status === 'pending' && (
                        <button 
                            onClick={() => updateBookingStatus(order.id, 'confirmed')}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] text-xs font-bold transition-all hover:bg-[oklch(85%_0.012_28)] active:scale-95 cursor-pointer"
                        >
                            <CheckCircle2 size={14} />
                            ยืนยันโต๊ะ
                        </button>
                    )}

                    {order.booking_type === 'pickup' && order.status === 'pending' && (
                        <button 
                            onClick={() => updateBookingStatus(order.id, 'ready')}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] text-xs font-bold transition-all hover:bg-[oklch(85%_0.012_28)] active:scale-95 cursor-pointer"
                        >
                            <CheckCircle2 size={14} />
                            ทำอาหารเสร็จ
                        </button>
                    )}
                    {order.booking_type === 'pickup' && order.status === 'ready' && (
                        <button 
                            onClick={() => updateBookingStatus(order.id, 'completed')}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded bg-[oklch(45%_0.08_140)] text-[oklch(97%_0.008_28)] text-xs font-bold transition-all hover:opacity-90 active:scale-95 cursor-pointer"
                        >
                            <CheckCircle2 size={14} />
                            ลูกค้ารับแล้ว
                        </button>
                    )}

                    {/* Cancel / Dismiss stuck order */}
                    {order.status !== 'cancelled' && order.status !== 'completed' && (
                        <button
                            onClick={() => {
                                if (window.confirm(`ยกเลิกออเดอร์ของ "${name}" ?\nออเดอร์จะถูกย้ายไปแท็บ "ยกเลิกแล้ว"`)) {
                                    updateBookingStatus(order.id, 'cancelled');
                                }
                            }}
                            className="shrink-0 flex items-center justify-center gap-1 py-2 px-3 rounded border border-red-200 bg-red-50 text-red-700 text-xs font-bold transition-all hover:bg-red-100 active:scale-95 cursor-pointer"
                        >
                            ✕ ยกเลิก
                        </button>
                    )}
                </div>
            </motion.div>
        );
    };

    return (
        <div className="h-full flex flex-col bg-[oklch(94%_0.010_28)] overflow-hidden font-sans">
            <Toaster position="top-center" />
            
            {/* Header & Sub-Tabs */}
            <div className="p-6 pb-2 shrink-0">
                <div className="flex justify-between items-end flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-[oklch(18%_0.012_28)] tracking-tight">ONLINE ORDERS HUB</h1>
                        <p className="text-[oklch(55%_0.010_28)] text-sm font-mono mt-1">ศูนย์จัดการคิวจองออนไลน์ สลิปโอนเงิน และออเดอร์รับกลับบ้าน (ตรวจสอบทีละรายการ)</p>
                    </div>

                    {/* Sub-Tab Selector */}
                    <div className="flex items-center gap-2 bg-[oklch(97%_0.008_28)] p-1.5 rounded-2xl border border-[oklch(85%_0.012_28)]">
                        <button
                            type="button"
                            onClick={() => setHubTab('active')}
                            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-2 border ${
                                hubTab === 'active'
                                    ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)] shadow-sm'
                                    : 'bg-transparent text-[oklch(55%_0.010_28)] border-transparent hover:text-[oklch(18%_0.012_28)]'
                            }`}
                        >
                            <span>🟢 รอดำเนินการ (ACTIVE)</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-800">
                                {activeOrders.length}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setHubTab('completed')}
                            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-2 border ${
                                hubTab === 'completed'
                                    ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)] shadow-sm'
                                    : 'bg-transparent text-[oklch(55%_0.010_28)] border-transparent hover:text-[oklch(18%_0.012_28)]'
                            }`}
                        >
                            <span>✅ สำเร็จแล้ว (COMPLETED)</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-800">
                                {completedOrders.length}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setHubTab('cancelled')}
                            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-2 border ${
                                hubTab === 'cancelled'
                                    ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)] shadow-sm'
                                    : 'bg-transparent text-[oklch(55%_0.010_28)] border-transparent hover:text-[oklch(18%_0.012_28)]'
                            }`}
                        >
                            <span>❌ ยกเลิกแล้ว (CANCELLED)</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-800">
                                {cancelledOrders.length}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Content View */}
            {hubTab === 'active' && (
                <div className="flex-1 p-6 overflow-x-auto flex gap-6 snap-x scrollbar-none">
                    {/* Column 1: Slips to Verify */}
                    <div className="w-[320px] shrink-0 flex flex-col snap-start">
                        <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-[oklch(85%_0.012_28)]">
                            <div className="flex items-center gap-2">
                                <ReceiptText className="text-[oklch(18%_0.012_28)]" size={18} />
                                <h2 className="font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider text-sm">Verify Slips</h2>
                            </div>
                            <span className="bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] text-xs font-mono font-bold px-2 py-0.5 rounded-full">
                                {slipsToVerify.length}
                            </span>
                        </div>
                        <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col gap-4 pb-20">
                            {slipsToVerify.length === 0 ? (
                                <div className="text-center text-[oklch(55%_0.010_28)] text-sm font-mono py-10">No slips to verify</div>
                            ) : (
                                <AnimatePresence>
                                    {slipsToVerify.map(o => renderCard(o, 'SLIP VERIFICATION'))}
                                </AnimatePresence>
                            )}
                        </div>
                    </div>

                    {/* Column 2: New Online Bookings */}
                    <div className="w-[320px] shrink-0 flex flex-col snap-start">
                        <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-[oklch(85%_0.012_28)]">
                            <div className="flex items-center gap-2">
                                <Calendar className="text-[oklch(18%_0.012_28)]" size={18} />
                                <h2 className="font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider text-sm">Table Bookings</h2>
                            </div>
                            <span className="bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] text-xs font-mono font-bold px-2 py-0.5 rounded-full">
                                {newBookings.length}
                            </span>
                        </div>
                        <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col gap-4 pb-20">
                            {newBookings.length === 0 ? (
                                <div className="text-center text-[oklch(55%_0.010_28)] text-sm font-mono py-10">No new bookings</div>
                            ) : (
                                <AnimatePresence>
                                    {newBookings.map(o => renderCard(o, 'ONLINE BOOKING'))}
                                </AnimatePresence>
                            )}
                        </div>
                    </div>

                    {/* Column 3: Online Pickups */}
                    <div className="w-[320px] shrink-0 flex flex-col snap-start">
                        <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-[oklch(85%_0.012_28)]">
                            <div className="flex items-center gap-2">
                                <UtensilsCrossed className="text-[oklch(18%_0.012_28)]" size={18} />
                                <h2 className="font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider text-sm">Online Pick-ups</h2>
                            </div>
                            <span className="bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] text-xs font-mono font-bold px-2 py-0.5 rounded-full">
                                {onlinePickups.length}
                            </span>
                        </div>
                        <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col gap-4 pb-20">
                            {onlinePickups.length === 0 ? (
                                <div className="text-center text-[oklch(55%_0.010_28)] text-sm font-mono py-10">No active pick-ups</div>
                            ) : (
                                <AnimatePresence>
                                    {onlinePickups.map(o => renderCard(o, o.status === 'ready' ? 'READY TO PICKUP' : 'PREPARING PICKUP'))}
                                </AnimatePresence>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {hubTab === 'completed' && (
                <div className="flex-1 p-6 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
                        {completedOrders.length === 0 ? (
                            <div className="col-span-full text-center text-[oklch(55%_0.010_28)] text-sm font-mono py-16">
                                ไม่มีออเดอร์ออนไลน์ที่สำเร็จแล้วในวันนี้
                            </div>
                        ) : (
                            completedOrders.map(o => renderCard(o, `✅ ${o.status.toUpperCase()}`))
                        )}
                    </div>
                </div>
            )}

            {hubTab === 'cancelled' && (
                <div className="flex-1 p-6 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
                        {cancelledOrders.length === 0 ? (
                            <div className="col-span-full text-center text-[oklch(55%_0.010_28)] text-sm font-mono py-16">
                                ไม่มีออเดอร์ออนไลน์ที่ยกเลิกในวันนี้
                            </div>
                        ) : (
                            cancelledOrders.map(o => renderCard(o, '❌ CANCELLED'))
                        )}
                    </div>
                </div>
            )}

            {/* Persistent Alert Overlay */}
            <AnimatePresence>
                {persistentAlert && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 bg-[oklch(18%_0.012_28)]/80 backdrop-blur-sm flex items-center justify-center p-6"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-[oklch(97%_0.008_28)] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border-4 border-[oklch(52%_0.16_28)]"
                        >
                            <div className="bg-[oklch(52%_0.16_28)] p-6 text-center text-[oklch(97%_0.008_28)] flex flex-col items-center">
                                <motion.div
                                    animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                                    transition={{ repeat: Infinity, duration: 1.5, repeatDelay: 1 }}
                                >
                                    <BellRing size={48} className="mb-4" />
                                </motion.div>
                                <h2 className="text-2xl font-bold tracking-tight uppercase">NEW ONLINE ORDER</h2>
                                <p className="opacity-80 font-mono text-sm mt-1">Please acknowledge immediately</p>
                            </div>
                            
                            <div className="p-6 flex flex-col items-center text-center gap-2">
                                <p className="text-[oklch(18%_0.012_28)] font-bold text-lg">
                                    {persistentAlert.profiles?.display_name || persistentAlert.pickup_contact_name || persistentAlert.customer_name || 'Customer'}
                                </p>
                                <p className="text-[oklch(55%_0.010_28)] font-mono text-sm">
                                    Type: {persistentAlert.booking_type === 'pickup' ? 'Pick-up' : 'Dine-in'} {persistentAlert.payment_slip_url ? '(with Slip)' : ''}
                                </p>
                                
                                <button 
                                    onClick={handleAcknowledge}
                                    className="mt-6 w-full py-4 rounded-xl bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold text-lg uppercase tracking-widest transition-transform hover:bg-black active:scale-95 shadow-lg cursor-pointer"
                                >
                                    Acknowledge & View
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
}
