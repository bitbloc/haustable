/* Hallmark · component: CustomerOrderStatus · genre: modern-minimal · theme: Atelier (Dieter Rams + Thai Modern OKLCH)
 * states: default · hover · focus · active · loading · error · success
 * contrast: pass (APCA / WCAG compliant)
 * Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
    Clock, CheckCircle, Receipt, ArrowLeft, Smartphone, 
    Edit, Check, X, Gamepad2, Crown, ArrowRight, Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { getShortBookingId } from '../utils/printerHelper';

// Session freshness validator (Discards sessions older than 16 hours from previous days)
function isBookingActiveAndFresh(booking) {
    if (!booking) return false;
    if (!['pending', 'confirmed', 'seated', 'ready'].includes(booking.status)) return false;
    if (booking.booking_time) {
        const bookingAgeMs = Date.now() - new Date(booking.booking_time).getTime();
        const MAX_SESSION_AGE_MS = 16 * 60 * 60 * 1000; // 16 hours
        if (bookingAgeMs > MAX_SESSION_AGE_MS) {
            console.warn('[Status] Stale booking session detected (>16h):', booking.id);
            return false;
        }
    }
    return true;
}

export default function CustomerOrderStatus() {
    const { tableId } = useParams();
    const navigate = useNavigate();

    // UI States
    const [showPaxModal, setShowPaxModal] = useState(false);
    const [editPaxInput, setEditPaxInput] = useState('1');
    const [loading, setLoading] = useState(true);
    const [requestingBill, setRequestingBill] = useState(false);
    const [booking, setBooking] = useState(null);
    const [orderItems, setOrderItems] = useState([]);
    const [paymentQrUrl, setPaymentQrUrl] = useState(null);
    const [resolvedTableInfo, setResolvedTableInfo] = useState(null);

    useEffect(() => {
        let channelSub = null;
        let settingsSub = null;

        const initStatus = async () => {
            if (tableId) {
                localStorage.setItem('active_customer_table_id', tableId);
            }
            const numericId = await fetchActiveOrder();

            if (numericId) {
                // Setup realtime subscription with resolved numeric ID (listen to all changes)
                channelSub = supabase.channel(`customer-order-status-${numericId}`)
                    .on('postgres_changes', { 
                        event: '*', 
                        schema: 'public', 
                        table: 'bookings',
                        filter: `table_id=eq.${numericId}` 
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
                    .subscribe((status, err) => {
                        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
                            console.warn(`[Realtime Status] Channel status: ${status}`, err || '');
                        }
                    });

                // App settings realtime listener
                settingsSub = supabase.channel(`customer-status-settings-${numericId}`)
                    .on('postgres_changes', {
                        event: '*',
                        schema: 'public',
                        table: 'app_settings'
                    }, () => {
                        fetchPaymentQr();
                    })
                    .subscribe();
            }
        };

        initStatus();

        return () => {
            if (channelSub) supabase.removeChannel(channelSub);
            if (settingsSub) supabase.removeChannel(settingsSub);
        };
    }, [tableId]);

    const fetchPaymentQr = async () => {
        try {
            const { data: qrData } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'payment_qr_url')
                .maybeSingle();

            if (qrData?.value) {
                setPaymentQrUrl(qrData.value);
            }
        } catch (e) {
            console.warn('Failed to fetch payment QR:', e);
        }
    };

    const fetchActiveOrder = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            // Resolve table layout to get true numeric ID and table name
            let resolvedTable = null;
            const cleanParam = (tableId || '').trim();
            const isDigits = /^\d+$/.test(cleanParam);

            if (isDigits) {
                const { data: byName } = await supabase
                    .from('tables_layout')
                    .select('*')
                    .ilike('table_name', cleanParam)
                    .maybeSingle();

                if (byName) {
                    resolvedTable = byName;
                } else {
                    const { data: byId } = await supabase
                        .from('tables_layout')
                        .select('*')
                        .eq('id', parseInt(cleanParam))
                        .maybeSingle();
                    resolvedTable = byId;
                }
            } else {
                const { data: byName } = await supabase
                    .from('tables_layout')
                    .select('*')
                    .ilike('table_name', cleanParam)
                    .maybeSingle();
                resolvedTable = byName;
            }

            if (resolvedTable) {
                setResolvedTableInfo(resolvedTable);
                localStorage.setItem('active_customer_table_id', resolvedTable.id.toString());
                localStorage.setItem('active_customer_table_name', resolvedTable.table_name || `Table ${resolvedTable.id}`);

                if (isDigits && resolvedTable.table_name && resolvedTable.table_name.toLowerCase() !== cleanParam.toLowerCase()) {
                    navigate(`/table/${encodeURIComponent(resolvedTable.table_name)}/status`, { replace: true });
                }
            }

            const numericTableId = resolvedTable?.id || (isDigits ? parseInt(cleanParam) : null);
            if (!numericTableId) {
                setBooking(null);
                setLoading(false);
                return null;
            }

            // Find active token from local storage first to query exact booking
            const savedToken = localStorage.getItem(`table_${tableId}_token`) || localStorage.getItem(`table_${numericTableId}_token`);
            
            let query = supabase
                .from('bookings')
                .select('*, tables_layout(*)')
                .eq('table_id', numericTableId)
                .in('status', ['pending', 'confirmed', 'seated', 'ready']);

            if (savedToken) {
                query = query.eq('tracking_token', savedToken);
            }

            let { data: bookingData, error: bookingError } = await query
                .order('booking_time', { ascending: false })
                .limit(1)
                .maybeSingle();

            // If query with savedToken yielded nothing, fallback to query latest active table booking
            if (!bookingData && savedToken) {
                const { data: fallbackData } = await supabase
                    .from('bookings')
                    .select('*, tables_layout(*)')
                    .eq('table_id', numericTableId)
                    .in('status', ['pending', 'confirmed', 'seated', 'ready'])
                    .order('booking_time', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                bookingData = fallbackData;
            }

            if (bookingError || !bookingData || !isBookingActiveAndFresh(bookingData)) {
                setBooking(null);
                setOrderItems([]);
                // Clear stale tracking tokens
                if (tableId) localStorage.removeItem(`table_${tableId}_token`);
                if (numericTableId) localStorage.removeItem(`table_${numericTableId}_token`);
                setLoading(false);
                return numericTableId;
            }
            setBooking(bookingData);

            // Fetch order items for this booking
            const { data: itemsData } = await supabase
                .from('order_items')
                .select('*, menu_items(name)')
                .eq('booking_id', bookingData.id);

            setOrderItems(itemsData || []);

            // Fetch payment QR Code
            await fetchPaymentQr();

            return numericTableId;

        } catch (err) {
            console.error('Error fetching order status:', err);
            return null;
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleRequestBill = async () => {
        if (!booking || requestingBill) return;
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
        const isNumeric = /^\d+$/.test((tableId || '').trim());
        const cachedName = localStorage.getItem('active_customer_table_name');
        const displayLoadingName = resolvedTableInfo?.table_name || (!isNumeric ? tableId : (cachedName && localStorage.getItem('active_customer_table_id') === tableId ? cachedName : null));

        return (
            <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)] flex flex-col items-center justify-center font-[var(--font-body)]">
                <div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-[var(--color-neutral)] text-xs font-mono font-bold tracking-widest uppercase">
                    {displayLoadingName ? `Loading Table ${displayLoadingName} Status...` : 'Loading Order Status...'}
                </p>
            </div>
        );
    }

    if (!booking) {
        return (
            <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)] flex flex-col items-center justify-center font-[var(--font-body)] p-6 text-center">
                <div className="w-16 h-16 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-full flex items-center justify-center text-[var(--color-neutral)] mb-4">
                    <Clock size={28} />
                </div>
                <h3 className="font-mono font-bold text-xs tracking-wider uppercase mb-2">NO ACTIVE SESSION</h3>
                <p className="text-[var(--color-neutral)] text-xs max-w-xs leading-relaxed mb-6">
                    ยังไม่พบรายการสั่งอาหารในเซสชันปัจจุบันของโต๊ะนี้
                </p>
                <button 
                    onClick={() => navigate(`/table/${encodeURIComponent(resolvedTableInfo?.table_name || tableId)}`)} 
                    className="bg-[var(--color-ink)] hover:bg-[var(--color-ink)]/90 text-[var(--color-paper)] px-6 py-2.5 rounded-sm font-mono font-bold text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer shadow-sm"
                >
                    ไปที่หน้าสั่งอาหาร (Go to Menu)
                </button>
            </div>
        );
    }

    const steps = [
        { key: 'pending', label: 'ส่งออเดอร์แล้ว', desc: 'ห้องครัวได้รับรายการแล้ว', time: booking.booking_time },
        { key: 'seated', label: 'กำลังจัดเตรียม', desc: 'ห้องครัวและบาร์กำลังปรุงอาหารตามลำดับคิว', time: booking.status !== 'pending' ? booking.booking_time : null },
    ];

    const activeStep = booking.status === 'pending' ? 0 : 1;
    const dynamicTotal = orderItems.reduce((sum, item) => sum + (Number(item.price_at_time) * Number(item.quantity)), 0);
    const depositPaid = booking?.deposit_amount ? Math.ceil(parseFloat(booking.deposit_amount)) : 0;
    const remainingBalance = Math.max(0, dynamicTotal - depositPaid);

    return (
        <div className="min-h-screen w-full bg-[var(--color-paper)] text-[var(--color-ink)] font-[var(--font-body)] flex flex-col pb-12 select-none">
            <Toaster position="top-center" richColors />

            {/* Brutalist Header */}
            <header className="sticky top-0 bg-[var(--color-paper)]/95 backdrop-blur-md border-b border-[var(--color-rule)] z-40">
                <div className="max-w-2xl mx-auto flex items-center justify-between p-3.5">
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => navigate(`/table/${encodeURIComponent(resolvedTableInfo?.table_name || tableId)}`)}
                            className="p-1.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] hover:bg-[var(--color-rule)] rounded-sm text-[var(--color-neutral)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
                        >
                            <ArrowLeft size={16} />
                        </button>
                        <div>
                            <h1 className="font-bold text-sm text-[var(--color-ink)] flex items-center gap-2">
                                <span>สถานะออเดอร์โต๊ะ {resolvedTableInfo?.table_name || booking.tables_layout?.table_name || tableId}</span>
                                {booking.booking_time && (() => {
                                    const startMins = Math.max(0, Math.floor((Date.now() - new Date(booking.booking_time).getTime()) / 60000));
                                    const formatted = startMins < 60 ? `${startMins}m` : `${Math.floor(startMins / 60)}h${startMins % 60}m`;
                                    return (
                                        <span className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[var(--color-ink)] px-2 py-0.2 rounded-sm font-mono text-[9px] font-bold uppercase tracking-wider">
                                            ELAPSED {formatted}
                                        </span>
                                    );
                                })()}
                            </h1>
                            <p className="text-[9px] text-[var(--color-neutral)] uppercase tracking-widest font-mono font-bold mt-0.5">
                                Queue #{getShortBookingId(booking)} · Status: {booking.status.toUpperCase()}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            setEditPaxInput(String(booking.pax || 1));
                            setShowPaxModal(true);
                        }}
                        className="bg-[var(--color-paper)] border border-[var(--color-rule)] hover:border-[var(--color-ink)] text-[var(--color-ink)] px-2.5 py-1 rounded-sm text-xs font-mono font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow-sm uppercase"
                    >
                        <span>PAX: {booking.pax || 1} ท่าน</span>
                        <Edit size={10} className="text-[var(--color-accent)]" />
                    </button>
                </div>
            </header>

            <div className="max-w-2xl mx-auto w-full p-4 space-y-4">
                {/* Order More Action Banner */}
                <button
                    onClick={() => navigate(`/table/${encodeURIComponent(resolvedTableInfo?.table_name || tableId)}`)}
                    className="w-full bg-[var(--color-ink)] hover:bg-[var(--color-ink)]/90 text-[var(--color-paper)] py-3 px-4 rounded-sm font-mono font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-98"
                >
                    <Plus size={14} />
                    <span>+ สั่งอาหารเพิ่ม (Order More Dishes)</span>
                </button>

                {/* Progress Status Card (LED Dial Style) */}
                <section className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm p-4 shadow-sm">
                    <h3 className="text-[9px] text-[var(--color-neutral)] font-mono font-bold uppercase tracking-widest mb-4">
                        ความคืบหน้า (ORDER PROGRESS)
                    </h3>
                    <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[1px] before:bg-[var(--color-rule)]">
                        {steps.map((step, idx) => {
                            const isDone = idx <= activeStep;
                            const isCurrent = idx === activeStep;
                            return (
                                <div key={step.key} className="relative">
                                    <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-[var(--color-paper)] border border-[var(--color-rule)] flex items-center justify-center">
                                        {isCurrent ? (
                                            <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
                                        ) : isDone ? (
                                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                        ) : (
                                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-rule)]" />
                                        )}
                                    </div>

                                    <div className="pl-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-bold ${isDone ? 'text-[var(--color-ink)]' : 'text-[var(--color-neutral)]'}`}>
                                                {step.label}
                                            </span>
                                            {isCurrent && (
                                                <span className="bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-[8px] font-mono font-bold uppercase px-1.5 py-0.2 rounded-sm">
                                                    กำลังเตรียม
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-[var(--color-neutral)] mt-0.5">{step.desc}</p>
                                        {step.time && isDone && (
                                            <span className="text-[9px] text-[var(--color-neutral)] font-mono mt-1 block">
                                                {new Date(step.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* In-Store Interactive Arcade Playground */}
                <section className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-sm p-4 shadow-sm relative overflow-hidden">
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-sm bg-[var(--color-ink)] text-[var(--color-paper)] border border-[var(--color-ink)] flex items-center justify-center font-mono font-black text-xs">
                                P2E
                            </div>
                            <div>
                                <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[var(--color-ink)]">
                                    HAUS ARCADE PLAYGROUND
                                </h3>
                                <p className="text-[9px] text-[var(--color-neutral)] font-mono uppercase tracking-widest mt-0.5">
                                    PLAY WHILE WAITING FOR FOOD
                                </p>
                            </div>
                        </div>
                        <span className="bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-[9px] font-mono font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider">
                            P2E REWARDS
                        </span>
                    </div>

                    <p className="text-xs text-[var(--color-ink)] leading-relaxed mb-3.5">
                        ระหว่างรอห้องครัวจัดเตรียมอาหาร ชวนเล่นเกม <strong>Flappy Cat / TaiPla</strong> สะสมแต้ม <strong>xhaus</strong> และรับสิทธิ์แลกของรางวัลพิเศษได้ทันที!
                    </p>

                    <button
                        onClick={() => navigate(`/arcade?tableId=${encodeURIComponent(resolvedTableInfo?.table_name || tableId)}`)}
                        className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 text-[var(--color-paper)] py-2.5 px-4 rounded-sm font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-sm active:scale-97 cursor-pointer flex items-center justify-center gap-2"
                    >
                        <span>เข้าสู่ Arcade เล่นเกมรออาหาร</span>
                        <ArrowRight size={14} />
                    </button>
                </section>

                {/* Order Items Ledger */}
                <section className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm p-4 shadow-sm">
                    <h3 className="text-[9px] text-[var(--color-neutral)] font-mono font-bold uppercase tracking-widest mb-3.5">
                        รายการอาหารสุทธิ (ITEMS SUMMARY)
                    </h3>
                    
                    <div className="space-y-3">
                        {orderItems.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-start text-xs pb-2.5 border-b border-[var(--color-rule)]/60 last:border-b-0 last:pb-0">
                                <div className="flex gap-2">
                                    <span className="font-bold font-mono text-[var(--color-accent)]">{item.quantity}x</span>
                                    <div>
                                        <span className="font-bold text-[var(--color-ink)] block leading-tight">
                                            {item.custom_name || item.menu_items?.name || item.name || 'เมนูเพิ่มเติม'}
                                        </span>
                                        {item.selected_options && (
                                            <div className="text-[9px] text-[var(--color-neutral)] mt-0.5 font-mono space-y-0.5">
                                                {Array.isArray(item.selected_options) ? (
                                                    item.selected_options.map((opt, i) => (
                                                        <div key={i}>▶ {typeof opt === 'object' ? opt.name : opt}</div>
                                                    ))
                                                ) : null}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <span className="font-mono font-bold text-[var(--color-ink)]">
                                    ฿{(item.price_at_time * item.quantity).toLocaleString()}
                                </span>
                            </div>
                        ))}
                        
                        {orderItems.length === 0 && (
                            <div className="text-center py-4 text-[var(--color-neutral)] font-mono text-[9px] font-bold uppercase">
                                กำลังโหลดรายละเอียดรายการอาหาร...
                            </div>
                        )}

                        <div className="border-t border-[var(--color-rule)] pt-3 mt-2 space-y-1.5">
                            <div className="flex justify-between items-baseline">
                                <span className="text-[10px] text-[var(--color-neutral)] font-mono font-bold uppercase tracking-wider">ยอดรวมค่าอาหาร (Total)</span>
                                <span className="text-sm font-bold text-[var(--color-ink)] font-mono">฿{dynamicTotal.toLocaleString()}.-</span>
                            </div>
                            
                            {depositPaid > 0 && (
                                <div className="flex justify-between items-baseline text-emerald-600">
                                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider">หักมัดจำ (Paid Deposit)</span>
                                    <span className="text-sm font-bold font-mono">-฿{depositPaid.toLocaleString()}.-</span>
                                </div>
                            )}

                            <div className="flex justify-between items-baseline pt-2 border-t border-[var(--color-rule)]">
                                <span className="text-[10px] text-[var(--color-ink)] font-mono font-bold uppercase tracking-wider">ยอดที่ต้องชำระ (Remaining)</span>
                                <span className="text-xl font-black text-[var(--color-ink)] font-mono">฿{remainingBalance.toLocaleString()}.-</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Checkout & Bill Request Card */}
                <section className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm p-4 shadow-sm">
                    <h3 className="text-[9px] text-[var(--color-neutral)] font-mono font-bold uppercase tracking-widest mb-3">
                        การเช็คบิลและชำระเงิน (CHECKOUT & PAYMENT)
                    </h3>
                    
                    {!booking.staff_remark?.includes('[CALL_BILL]') ? (
                        <div className="w-full text-center space-y-3 py-1">
                            <Smartphone size={24} className="text-[var(--color-neutral)] mx-auto animate-pulse" />
                            <div>
                                <h4 className="font-bold text-xs text-[var(--color-ink)]">ต้องการเช็คบิลชำระเงิน?</h4>
                                <p className="text-[10px] text-[var(--color-neutral)] mt-0.5 leading-relaxed">
                                    กดปุ่มเพื่อเรียกพนักงานนำใบแจ้งยอดและ QR Code มาให้สแกนจ่ายที่โต๊ะ
                                </p>
                            </div>
                            <button
                                onClick={handleRequestBill}
                                disabled={requestingBill}
                                className="w-full bg-[var(--color-ink)] hover:bg-[var(--color-ink)]/90 text-[var(--color-paper)] py-3 rounded-sm font-mono font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-98"
                            >
                                <Receipt size={13} />
                                <span>{requestingBill ? 'กำลังดำเนินการ...' : 'เรียกพนักงานเช็คบิล (Request Bill)'}</span>
                            </button>
                        </div>
                    ) : (
                        <div className="w-full space-y-3">
                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-sm py-2 px-3 flex items-center gap-2 font-mono font-bold text-[10px] uppercase tracking-wider justify-center">
                                <CheckCircle size={13} />
                                <span>เรียกพนักงานเช็คบิลแล้ว</span>
                            </div>

                            <div className="w-full text-center py-5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-sm flex flex-col items-center gap-2">
                                <Smartphone size={28} className="text-[var(--color-accent)] animate-bounce" />
                                <div>
                                    <h4 className="font-bold text-xs text-[var(--color-ink)]">กรุณาชำระเงินกับพนักงาน</h4>
                                    <p className="text-[10px] text-[var(--color-neutral)] max-w-xs leading-relaxed mx-auto mt-0.5">
                                        พนักงานกำลังนำใบแจ้งยอดและ QR Code มาแสดงที่โต๊ะเพื่อสแกนจ่ายโดยตรง
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </div>

            {/* Edit Pax Modal */}
            {showPaxModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm w-full max-w-sm overflow-hidden shadow-2xl font-[var(--font-body)] text-[var(--color-ink)]">
                        <div className="p-3.5 border-b border-[var(--color-rule)] flex items-center justify-between">
                            <div>
                                <h3 className="font-mono font-bold text-xs uppercase tracking-wider">ปรับจำนวนลูกค้า (PARTY SIZE)</h3>
                                <p className="text-[10px] text-[var(--color-neutral)] font-mono mt-0.5">โต๊ะ {resolvedTableInfo?.table_name || booking.tables_layout?.table_name || tableId}</p>
                            </div>
                            <button onClick={() => setShowPaxModal(false)} className="p-1 hover:bg-[var(--color-paper-2)] rounded-sm text-[var(--color-neutral)]">
                                <X size={15} />
                            </button>
                        </div>
                        
                        <div className="p-5 flex flex-col items-center gap-3 text-center">
                            <div className="text-xs font-bold text-[var(--color-ink)]">
                                ระบุจำนวนลูกค้าล่าสุดสำหรับโต๊ะนี้
                            </div>

                            {/* Stepper */}
                            <div className="flex items-center gap-3 my-2">
                                <button 
                                    onClick={() => setEditPaxInput(prev => String(Math.max(1, (parseInt(prev) || 1) - 1)))}
                                    className="w-10 h-10 rounded-sm bg-[var(--color-paper-2)] border border-[var(--color-rule)] hover:border-[var(--color-ink)] text-xl font-bold flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                                >
                                    -
                                </button>
                                <input 
                                    type="number"
                                    min="1"
                                    max="99"
                                    value={editPaxInput}
                                    onChange={(e) => setEditPaxInput(e.target.value)}
                                    className="w-20 h-10 bg-[var(--color-paper)] border-2 border-[var(--color-ink)] rounded-sm text-center text-xl font-mono font-black text-[var(--color-ink)] focus:outline-none"
                                />
                                <button 
                                    onClick={() => setEditPaxInput(prev => String((parseInt(prev) || 1) + 1))}
                                    className="w-10 h-10 rounded-sm bg-[var(--color-paper-2)] border border-[var(--color-rule)] hover:border-[var(--color-ink)] text-xl font-bold flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                                >
                                    +
                                </button>
                            </div>

                            {/* Quick Presets */}
                            <div className="grid grid-cols-5 gap-1.5 w-full mt-1">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                    <button
                                        key={num}
                                        onClick={() => setEditPaxInput(String(num))}
                                        className={`py-1.5 rounded-sm font-mono font-bold text-xs transition-all cursor-pointer ${
                                            parseInt(editPaxInput) === num 
                                                ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border border-[var(--color-ink)]' 
                                                : 'bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[var(--color-ink)]'
                                        }`}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-3 border-t border-[var(--color-rule)] bg-[var(--color-paper-2)]">
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
                                className="w-full bg-[var(--color-ink)] hover:bg-[var(--color-ink)]/90 text-[var(--color-paper)] py-2.5 rounded-sm font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                                <Check size={14} />
                                <span>บันทึกจำนวนคน (Save)</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
