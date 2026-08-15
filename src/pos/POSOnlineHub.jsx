/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Search, 
    RefreshCw, 
    Volume2, 
    VolumeX, 
    Check, 
    X, 
    ExternalLink, 
    Printer, 
    FileText, 
    Image as ImageIcon,
    Clock,
    User,
    Phone,
    CreditCard,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { getShortBookingId } from '../utils/printerHelper';

export default function POSOnlineHub({ activeShift, onOpenSlipModal, onViewSlipImage, onSelectOrder, refreshKey }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hubTab, setHubTab] = useState('active'); // 'active' | 'completed' | 'cancelled'
    const [channelFilter, setChannelFilter] = useState('all'); // 'all' | 'slips' | 'bookings' | 'pickups'
    const [searchQuery, setSearchQuery] = useState('');
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [persistentAlert, setPersistentAlert] = useState(null);
    const [approvingId, setApprovingId] = useState(null);

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
        if (!soundEnabled) return;
        if (audioRef.current) {
            audioRef.current.play().catch(() => {
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
                    alertIntervalRef.current = setInterval(playBeep, 2500);
                } catch (err) {}
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
            setLoading(true);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayIso = today.toISOString();

            const { data, error } = await supabase
                .from('bookings')
                .select('*, tables_layout(*), profiles(display_name, phone_number), order_items(*, menu_items(name, category_id))')
                .gte('booking_time', todayIso)
                .order('booking_time', { ascending: false });

            if (error) throw error;

            const onlineRelevant = (data || []).filter(b => {
                const sourceLower = (b.source || '').toLowerCase();
                const remarkLower = (b.staff_remark || '').toLowerCase();
                const isOnlineSource = sourceLower === 'online' || sourceLower === 'line' || sourceLower === 'qr' || remarkLower.includes('qr') || remarkLower.includes('online');
                const hasSlip = !!b.payment_slip_url;
                const isOnlinePickup = b.booking_type === 'pickup' && isOnlineSource;
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
                    const sourceLower = (b.source || '').toLowerCase();
                    const remarkLower = (b.staff_remark || '').toLowerCase();
                    const isOnlineSource = sourceLower === 'online' || sourceLower === 'line' || sourceLower === 'qr' || remarkLower.includes('qr') || remarkLower.includes('online');
                    const hasSlip = !!b.payment_slip_url;
                    const isOnlinePickup = b.booking_type === 'pickup' && isOnlineSource;
                    
                    if (isOnlineSource || hasSlip || isOnlinePickup) {
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
                    if (payload.new.payment_slip_url && !payload.old?.payment_slip_url) {
                        setPersistentAlert(payload.new);
                        playAlert();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [soundEnabled]);

    useEffect(() => {
        if (refreshKey > 0) {
            fetchOnlineData();
        }
    }, [refreshKey]);

    const handleAcknowledge = () => {
        setPersistentAlert(null);
        stopAlert();
    };

    const updateBookingStatus = async (id, newStatus, customData = {}) => {
        try {
            const { error } = await supabase
                .from('bookings')
                .update({ status: newStatus, ...customData })
                .eq('id', id);
            if (error) throw error;
            toast.success(`อัปเดตสถานะเป็น [${newStatus.toUpperCase()}] สำเร็จ`);
            fetchOnlineData();
        } catch (err) {
            console.error(err);
            toast.error('ไม่สามารถอัปเดตสถานะได้: ' + (err.message || 'Error'));
        }
    };

    // Handler to approve attached bank transfer slip
    const handleApproveSlip = async (order) => {
        try {
            setApprovingId(order.id);
            const total = order.total_amount || 0;
            const updates = {
                status: order.booking_type === 'dine_in' ? 'confirmed' : 'seated',
                deposit_amount: order.deposit_amount > 0 ? order.deposit_amount : total,
                staff_remark: `${order.staff_remark || ''} [SLIP_VERIFIED]`.trim()
            };

            const { error } = await supabase
                .from('bookings')
                .update(updates)
                .eq('id', order.id);

            if (error) throw error;
            toast.success(`อนุมัติสลิปออเดอร์ #${getShortBookingId(order)} สำเร็จ`);

            // Auto-trigger kitchen order print if items exist
            if (order.order_items && order.order_items.length > 0 && onOpenSlipModal) {
                onOpenSlipModal({ ...order, ...updates }, 'kitchen');
            }

            fetchOnlineData();
        } catch (err) {
            console.error('Failed to approve slip:', err);
            toast.error('อนุมัติสลิปไม่สำเร็จ: ' + err.message);
        } finally {
            setApprovingId(null);
        }
    };

    // Normalized search and channel filter
    const matchesFilter = (order) => {
        const q = searchQuery.toLowerCase().trim().replace(/^#/, '');
        if (q) {
            const shortId = getShortBookingId(order).toLowerCase();
            const tokenStr = (order.tracking_token || '').toLowerCase();
            const idStr = String(order.id).toLowerCase();
            const tableName = (order.tables_layout?.table_name || '').toLowerCase();
            const custName = (order.profiles?.display_name || order.customer_name || order.pickup_contact_name || order.customer_note || '').toLowerCase();
            const phone = (order.profiles?.phone_number || order.pickup_contact_phone || '').toLowerCase();
            const remark = (order.staff_remark || '').toLowerCase();
            const itemsStr = (order.order_items || []).map(i => i.menu_items?.name || i.name || '').join(' ').toLowerCase();

            const isMatch = shortId.includes(q) || tokenStr.includes(q) || idStr.includes(q) || tableName.includes(q) || custName.includes(q) || phone.includes(q) || remark.includes(q) || itemsStr.includes(q);
            if (!isMatch) return false;
        }

        if (channelFilter === 'slips' && !order.payment_slip_url) return false;
        if (channelFilter === 'bookings' && order.booking_type !== 'dine_in') return false;
        if (channelFilter === 'pickups' && order.booking_type !== 'pickup') return false;

        return true;
    };

    // Derived buckets
    const activeOrders = useMemo(() => {
        return orders
            .filter(o => o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'no_show' && o.status !== 'void')
            .filter(matchesFilter)
            .sort((a, b) => new Date(b.created_at || b.booking_time) - new Date(a.created_at || a.booking_time));
    }, [orders, searchQuery, channelFilter]);

    const completedOrders = useMemo(() => {
        return orders
            .filter(o => o.status === 'completed' || o.status === 'paid')
            .filter(matchesFilter)
            .sort((a, b) => new Date(b.updated_at || b.booking_time) - new Date(a.updated_at || a.booking_time));
    }, [orders, searchQuery, channelFilter]);

    const cancelledOrders = useMemo(() => {
        return orders
            .filter(o => o.status === 'cancelled' || o.status === 'no_show' || o.status === 'void')
            .filter(matchesFilter)
            .sort((a, b) => new Date(b.updated_at || b.booking_time) - new Date(a.updated_at || a.booking_time));
    }, [orders, searchQuery, channelFilter]);

    // Active column groups (without confusing card duplicates)
    const slipsToVerify = activeOrders.filter(o => !!o.payment_slip_url && o.status === 'pending');
    const newBookings = activeOrders.filter(o => o.booking_type === 'dine_in' && (!o.payment_slip_url || o.status !== 'pending'));
    const onlinePickups = activeOrders.filter(o => o.booking_type === 'pickup' && (!o.payment_slip_url || o.status !== 'pending'));

    const renderCard = (order, typeBadge) => {
        const shortId = getShortBookingId(order);
        const orderTimeStr = order.created_at ? new Date(order.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : null;
        const bookingTimeStr = new Date(order.booking_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        const defaultWalkIns = ['walk-in guest', 'walk-in pick-up', 'walk-in customer', 'walk-in', 'walk-in customer (offline)', 'walk-in pick-up (offline)', 'anonymous user', 'walk-in-customer', 'ลูกค้าทั่วไป'];
        const name = order.profiles?.display_name 
            || (order.pickup_contact_name && !defaultWalkIns.includes(order.pickup_contact_name.toLowerCase().trim()) ? order.pickup_contact_name : null)
            || (order.customer_name && !defaultWalkIns.includes(order.customer_name.toLowerCase().trim()) ? order.customer_name : null)
            || 'Guest';
        const phone = order.profiles?.phone_number || order.pickup_contact_phone || order.customer_phone || '';
        const isPickup = order.booking_type === 'pickup';
        const items = order.order_items || [];
        const tableName = order.tables_layout?.table_name;
        const isPaid = (order.deposit_amount >= order.total_amount && order.total_amount > 0) || order.status === 'paid';
        const isPending = order.status === 'pending';
        const isReady = order.status === 'ready';

        return (
            <motion.div 
                key={order.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-xl p-4 flex flex-col gap-3 shadow-2xs hover:border-[oklch(18%_0.012_28)] transition-colors"
            >
                {/* Header: Short ID, Channel, Status */}
                <div className="flex justify-between items-start gap-2 border-b border-[oklch(85%_0.012_28)] pb-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-[oklch(18%_0.012_28)] bg-[oklch(94%_0.010_28)] px-2 py-0.5 rounded border border-[oklch(85%_0.012_28)]">
                            #{shortId}
                        </span>

                        <span className={`font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            isPickup ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-[#1A1A1A] text-white'
                        }`}>
                            {isPickup ? 'PICK-UP' : `TABLE ${tableName || 'TBA'}`}
                        </span>

                        {order.payment_slip_url && (
                            <span className="font-mono text-[9px] font-bold uppercase tracking-wider bg-blue-100 text-blue-900 border border-blue-300 px-1.5 py-0.5 rounded">
                                SLIP
                            </span>
                        )}

                        <span className={`font-mono text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                            isPaid 
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300' 
                                : 'bg-[oklch(94%_0.010_28)] text-[oklch(55%_0.010_28)] border-[oklch(85%_0.012_28)]'
                        }`}>
                            {isPaid ? 'PAID' : 'UNPAID'}
                        </span>
                    </div>

                    <div className="text-right font-mono shrink-0">
                        <span className="text-[10px] text-[oklch(55%_0.010_28)] block">
                            {orderTimeStr ? `ORDER: ${orderTimeStr}` : `TIME: ${bookingTimeStr}`}
                        </span>
                    </div>
                </div>

                {/* Customer Details */}
                <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-[oklch(18%_0.012_28)] truncate">
                        <User size={13} className="text-[oklch(55%_0.010_28)] shrink-0" />
                        <span className="truncate">{name}</span>
                    </div>
                    {phone && (
                        <div className="flex items-center gap-1.5 text-xs font-mono text-[oklch(55%_0.010_28)]">
                            <Phone size={11} className="shrink-0" />
                            <span>{phone}</span>
                        </div>
                    )}
                </div>

                {/* Order Items Preview */}
                {items.length > 0 ? (
                    <div className="bg-[oklch(94%_0.010_28)] p-2.5 rounded-lg border border-[oklch(85%_0.012_28)] text-xs font-sans space-y-1">
                        <div className="font-mono text-[9px] font-bold text-[oklch(55%_0.010_28)] uppercase tracking-wider">
                            ITEMS ({items.reduce((s, i) => s + (i.quantity || 1), 0)} TOTAL):
                        </div>
                        <ul className="space-y-0.5">
                            {items.slice(0, 3).map((item, idx) => (
                                <li key={item.id || idx} className="flex justify-between items-center text-[oklch(18%_0.012_28)]">
                                    <span className="truncate pr-2 font-medium">
                                        <strong className="font-mono font-bold mr-1">{item.quantity}x</strong> 
                                        {item.menu_items?.name || item.name || 'Item'}
                                    </span>
                                    <span className="font-mono text-[10px] text-[oklch(42%_0.010_28)] shrink-0">
                                        ฿{((item.price_at_time || item.price || 0) * (item.quantity || 1)).toLocaleString()}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        {items.length > 3 && (
                            <div className="text-[9px] font-mono text-[oklch(55%_0.010_28)] text-right pt-0.5 font-bold">
                                + อีก {items.length - 3} รายการ...
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-2 text-[10px] font-mono text-[oklch(55%_0.010_28)] italic bg-[oklch(94%_0.010_28)] rounded-lg border border-[oklch(85%_0.012_28)]">
                        ไม่มีรายการอาหาร (จองโต๊ะเปล่า)
                    </div>
                )}

                {order.customer_note && (
                    <div className="bg-[oklch(94%_0.010_28)] p-2 rounded-lg text-xs text-[oklch(18%_0.012_28)] font-medium border-l-2 border-[oklch(52%_0.16_28)]">
                        "{order.customer_note}"
                    </div>
                )}

                {/* Amount Totals */}
                <div className="flex items-center justify-between pt-1 border-t border-[oklch(85%_0.012_28)] font-mono text-xs">
                    <span className="text-[10px] text-[oklch(55%_0.010_28)] uppercase tracking-wider font-bold">
                        TOTAL DUE
                    </span>
                    <span className="font-bold text-[oklch(18%_0.012_28)]">
                        ฿{(order.total_amount || 0).toLocaleString()}
                    </span>
                </div>

                {/* Quick Print & POS Links */}
                <div className="grid grid-cols-3 gap-1 font-mono text-[9px] font-bold uppercase tracking-wider">
                    <button
                        type="button"
                        onClick={() => onOpenSlipModal && onOpenSlipModal(order, 'kitchen')}
                        className="py-1.5 px-2 rounded-md bg-white hover:bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] transition-all flex items-center justify-center gap-1 cursor-pointer truncate"
                        title="พิมพ์ใบสั่งครัว"
                    >
                        <Printer size={10} />
                        <span>KITCHEN</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => onOpenSlipModal && onOpenSlipModal(order, order.status === 'completed' ? 'receipt' : 'billing')}
                        className="py-1.5 px-2 rounded-md bg-white hover:bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] transition-all flex items-center justify-center gap-1 cursor-pointer truncate"
                        title="พิมพ์ใบแจ้งยอด / ใบเสร็จ"
                    >
                        <FileText size={10} />
                        <span>SLIP</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => onSelectOrder && onSelectOrder(order)}
                        className="py-1.5 px-2 rounded-md bg-white hover:bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] transition-all flex items-center justify-center gap-1 cursor-pointer truncate"
                        title="เปิดแก้ไขและคิดเงินใน POS"
                    >
                        <ExternalLink size={10} />
                        <span>POS</span>
                    </button>
                </div>

                {/* Main Action Bar */}
                <div className="pt-2 border-t border-[oklch(85%_0.012_28)] flex gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider">
                    {/* If has slip to verify */}
                    {order.payment_slip_url && (
                        <button
                            type="button"
                            onClick={() => {
                                if (onViewSlipImage) {
                                    onViewSlipImage(order.payment_slip_url);
                                } else {
                                    onOpenSlipModal(order, 'billing');
                                }
                            }}
                            className="flex-1 py-2 rounded-lg bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] hover:opacity-90 transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                            <ImageIcon size={12} />
                            <span>VIEW SLIP</span>
                        </button>
                    )}

                    {order.payment_slip_url && order.status === 'pending' && (
                        <button
                            type="button"
                            disabled={approvingId === order.id}
                            onClick={() => handleApproveSlip(order)}
                            className="flex-1 py-2 rounded-lg bg-[oklch(45%_0.08_140)] text-white hover:opacity-90 transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                            <CheckCircle2 size={12} />
                            <span>{approvingId === order.id ? 'APPROVING...' : 'APPROVE'}</span>
                        </button>
                    )}

                    {/* Dine-in pending */}
                    {order.booking_type === 'dine_in' && order.status === 'pending' && !order.payment_slip_url && (
                        <button
                            type="button"
                            onClick={() => updateBookingStatus(order.id, 'confirmed')}
                            className="flex-1 py-2 rounded-lg bg-[oklch(52%_0.16_28)] text-white hover:opacity-90 transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                            <Check size={12} />
                            <span>CONFIRM DINE-IN</span>
                        </button>
                    )}

                    {/* Pickup pending */}
                    {order.booking_type === 'pickup' && order.status === 'pending' && !order.payment_slip_url && (
                        <button
                            type="button"
                            onClick={() => {
                                updateBookingStatus(order.id, 'seated');
                                if (onOpenSlipModal && items.length > 0) {
                                    onOpenSlipModal(order, 'kitchen');
                                }
                            }}
                            className="flex-1 py-2 rounded-lg bg-[oklch(52%_0.16_28)] text-white hover:opacity-90 transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                            <Check size={12} />
                            <span>ACCEPT & COOK</span>
                        </button>
                    )}

                    {/* Pickup seated/confirmed/preparing */}
                    {order.booking_type === 'pickup' && (order.status === 'seated' || order.status === 'confirmed') && (
                        <button
                            type="button"
                            onClick={() => updateBookingStatus(order.id, 'ready')}
                            className="flex-1 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                            <Check size={12} />
                            <span>MARK READY</span>
                        </button>
                    )}

                    {/* Pickup ready */}
                    {order.booking_type === 'pickup' && order.status === 'ready' && (
                        isPaid ? (
                            <button
                                type="button"
                                onClick={() => updateBookingStatus(order.id, 'completed')}
                                className="flex-1 py-2 rounded-lg bg-[oklch(45%_0.08_140)] text-white hover:opacity-90 transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                                <CheckCircle2 size={12} />
                                <span>PICKED UP</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => onSelectOrder && onSelectOrder(order)}
                                className="flex-1 py-2 rounded-lg bg-[oklch(18%_0.012_28)] text-white hover:opacity-90 transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                                <CreditCard size={12} />
                                <span>CHECKOUT POS</span>
                            </button>
                        )
                    )}

                    {/* Cancel button */}
                    {order.status !== 'cancelled' && order.status !== 'completed' && (
                        <button
                            type="button"
                            onClick={() => {
                                if (window.confirm(`ยกเลิกออเดอร์ #${shortId} ของ "${name}"?`)) {
                                    updateBookingStatus(order.id, 'cancelled');
                                }
                            }}
                            className="py-2 px-2.5 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-all cursor-pointer"
                            title="ยกเลิกออเดอร์"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>
            </motion.div>
        );
    };

    return (
        <div className="h-full flex flex-col bg-[oklch(94%_0.010_28)] overflow-hidden select-none font-sans text-[oklch(18%_0.012_28)]">
            <Toaster position="top-center" />

            {/* Header & Sub-Bar */}
            <div className="p-4 bg-[oklch(97%_0.008_28)] border-b border-[oklch(85%_0.012_28)] flex flex-col gap-3 shrink-0 shadow-2xs">
                <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                    <div>
                        <h1 className="text-base font-mono font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                            ONLINE ORDERS HUB / ศูนย์จัดการออเดอร์ออนไลน์
                        </h1>
                        <p className="text-[11px] font-mono text-[oklch(55%_0.010_28)] mt-0.5">
                            จัดการสลิปโอนเงิน การจองโต๊ะล่วงหน้า และออเดอร์รับกลับบ้าน
                        </p>
                    </div>

                    {/* Status Tabs */}
                    <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-wider">
                        <div className="flex bg-[oklch(94%_0.010_28)] p-0.5 rounded-lg border border-[oklch(85%_0.012_28)]">
                            <button
                                type="button"
                                onClick={() => setHubTab('active')}
                                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                                    hubTab === 'active' 
                                        ? 'bg-white text-[oklch(18%_0.012_28)] shadow-2xs' 
                                        : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                                }`}
                            >
                                <span>ACTIVE</span>
                                <span className="bg-[oklch(52%_0.16_28)]/15 text-[oklch(52%_0.16_28)] px-1.5 py-0.2 rounded text-[9px]">
                                    {activeOrders.length}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setHubTab('completed')}
                                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                                    hubTab === 'completed' 
                                        ? 'bg-white text-[oklch(18%_0.012_28)] shadow-2xs' 
                                        : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                                }`}
                            >
                                <span>COMPLETED</span>
                                <span className="bg-emerald-100 text-emerald-900 px-1.5 py-0.2 rounded text-[9px]">
                                    {completedOrders.length}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setHubTab('cancelled')}
                                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                                    hubTab === 'cancelled' 
                                        ? 'bg-white text-[oklch(18%_0.012_28)] shadow-2xs' 
                                        : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                                }`}
                            >
                                <span>CANCELLED</span>
                                <span className="bg-red-100 text-red-900 px-1.5 py-0.2 rounded text-[9px]">
                                    {cancelledOrders.length}
                                </span>
                            </button>
                        </div>

                        {/* Sound Toggle */}
                        <button
                            type="button"
                            onClick={() => setSoundEnabled(prev => !prev)}
                            className={`p-2 rounded-lg border transition-all cursor-pointer ${
                                soundEnabled 
                                    ? 'bg-white border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] shadow-2xs' 
                                    : 'bg-red-50 border-red-200 text-red-700'
                            }`}
                            title={soundEnabled ? 'ปิดเสียงแจ้งเตือน' : 'เปิดเสียงแจ้งเตือน'}
                        >
                            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                        </button>

                        <button
                            type="button"
                            onClick={fetchOnlineData}
                            className="p-2 bg-white border border-[oklch(85%_0.012_28)] rounded-lg text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] transition-colors cursor-pointer"
                            title="รีเฟรชออเดอร์ออนไลน์"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Search & Quick Filter Chips */}
                <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between pt-1">
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[oklch(55%_0.010_28)]" size={14} />
                        <input
                            type="search"
                            placeholder="ค้นหา Short ID (#A2EB), ชื่อ, โทร..."
                            className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-lg py-1.5 pl-8 pr-3 text-xs text-[oklch(18%_0.012_28)] placeholder-[oklch(55%_0.010_28)] focus:outline-none focus:border-[oklch(18%_0.012_28)] transition-colors font-mono"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex bg-[oklch(94%_0.010_28)] p-0.5 rounded-lg border border-[oklch(85%_0.012_28)] font-mono text-[9px] font-bold uppercase tracking-wider overflow-x-auto w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => setChannelFilter('all')}
                            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${channelFilter === 'all' ? 'bg-white text-[oklch(18%_0.012_28)] shadow-2xs' : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'}`}
                        >
                            ALL TYPES
                        </button>
                        <button
                            type="button"
                            onClick={() => setChannelFilter('slips')}
                            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${channelFilter === 'slips' ? 'bg-white text-[oklch(18%_0.012_28)] shadow-2xs' : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'}`}
                        >
                            SLIPS ONLY
                        </button>
                        <button
                            type="button"
                            onClick={() => setChannelFilter('bookings')}
                            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${channelFilter === 'bookings' ? 'bg-white text-[oklch(18%_0.012_28)] shadow-2xs' : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'}`}
                        >
                            DINE-IN
                        </button>
                        <button
                            type="button"
                            onClick={() => setChannelFilter('pickups')}
                            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${channelFilter === 'pickups' ? 'bg-white text-[oklch(18%_0.012_28)] shadow-2xs' : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'}`}
                        >
                            PICK-UP
                        </button>
                    </div>
                </div>
            </div>

            {/* Active Kanban View */}
            {hubTab === 'active' && (
                <div className="flex-1 p-4 overflow-x-auto flex gap-4 snap-x scrollbar-none">
                    {/* Column 1: Slips to Verify */}
                    <div className="w-[340px] shrink-0 flex flex-col snap-start bg-[oklch(97%_0.008_28)] rounded-xl border border-[oklch(85%_0.012_28)] p-3.5 shadow-2xs">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[oklch(85%_0.012_28)]">
                            <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                                    VERIFY SLIPS / ตรวจสลิป
                                </span>
                            </div>
                            <span className="bg-blue-100 text-blue-900 border border-blue-200 text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                                {slipsToVerify.length}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col gap-3 pb-6">
                            {slipsToVerify.length === 0 ? (
                                <div className="text-center text-[oklch(55%_0.010_28)] text-xs font-mono py-12">
                                    ไม่มีสลิปค้างตรวจสอบ
                                </div>
                            ) : (
                                <AnimatePresence>
                                    {slipsToVerify.map(o => renderCard(o, 'SLIP VERIFY'))}
                                </AnimatePresence>
                            )}
                        </div>
                    </div>

                    {/* Column 2: Dine-in Reservations */}
                    <div className="w-[340px] shrink-0 flex flex-col snap-start bg-[oklch(97%_0.008_28)] rounded-xl border border-[oklch(85%_0.012_28)] p-3.5 shadow-2xs">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[oklch(85%_0.012_28)]">
                            <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                                    DINE-IN BOOKINGS / จองโต๊ะ
                                </span>
                            </div>
                            <span className="bg-[oklch(18%_0.012_28)] text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                                {newBookings.length}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col gap-3 pb-6">
                            {newBookings.length === 0 ? (
                                <div className="text-center text-[oklch(55%_0.010_28)] text-xs font-mono py-12">
                                    ไม่มีรายการจองโต๊ะค้างอยู่
                                </div>
                            ) : (
                                <AnimatePresence>
                                    {newBookings.map(o => renderCard(o, 'DINE-IN BOOKING'))}
                                </AnimatePresence>
                            )}
                        </div>
                    </div>

                    {/* Column 3: Pick-up Orders */}
                    <div className="w-[340px] shrink-0 flex flex-col snap-start bg-[oklch(97%_0.008_28)] rounded-xl border border-[oklch(85%_0.012_28)] p-3.5 shadow-2xs">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[oklch(85%_0.012_28)]">
                            <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                                    ONLINE PICKUPS / รับกลับบ้าน
                                </span>
                            </div>
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                                {onlinePickups.length}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col gap-3 pb-6">
                            {onlinePickups.length === 0 ? (
                                <div className="text-center text-[oklch(55%_0.010_28)] text-xs font-mono py-12">
                                    ไม่มีออเดอร์รับกลับบ้านที่กำลังดำเนินการ
                                </div>
                            ) : (
                                <AnimatePresence>
                                    {onlinePickups.map(o => renderCard(o, o.status === 'ready' ? 'READY' : 'PREPARING'))}
                                </AnimatePresence>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Completed Tab */}
            {hubTab === 'completed' && (
                <div className="flex-1 p-4 overflow-y-auto">
                    {completedOrders.length === 0 ? (
                        <div className="text-center text-[oklch(55%_0.010_28)] text-xs font-mono py-16">
                            ไม่มีออเดอร์ออนไลน์ที่สำเร็จแล้วในวันนี้
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 pb-10">
                            {completedOrders.map(o => renderCard(o, `COMPLETED`))}
                        </div>
                    )}
                </div>
            )}

            {/* Cancelled Tab */}
            {hubTab === 'cancelled' && (
                <div className="flex-1 p-4 overflow-y-auto">
                    {cancelledOrders.length === 0 ? (
                        <div className="text-center text-[oklch(55%_0.010_28)] text-xs font-mono py-16">
                            ไม่มีออเดอร์ออนไลน์ที่ยกเลิกในวันนี้
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 pb-10">
                            {cancelledOrders.map(o => renderCard(o, 'CANCELLED'))}
                        </div>
                    )}
                </div>
            )}

            {/* Persistent Sound Alert Modal */}
            <AnimatePresence>
                {persistentAlert && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
                    >
                        <motion.div 
                            initial={{ scale: 0.95, y: 10 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 10 }}
                            className="bg-[oklch(97%_0.008_28)] rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden border-2 border-[oklch(52%_0.16_28)] font-sans"
                        >
                            <div className="bg-[oklch(52%_0.16_28)] p-5 text-center text-white flex flex-col items-center">
                                <span className="font-mono text-[10px] font-bold uppercase tracking-widest bg-black/20 px-2 py-0.5 rounded mb-1">
                                    INCOMING NOTIFICATION
                                </span>
                                <h2 className="text-xl font-bold tracking-tight uppercase">
                                    NEW ONLINE ORDER
                                </h2>
                                <span className="font-mono text-sm font-bold mt-1">
                                    #{getShortBookingId(persistentAlert)}
                                </span>
                            </div>
                            
                            <div className="p-5 flex flex-col items-center text-center gap-2 font-sans">
                                <p className="text-[oklch(18%_0.012_28)] font-bold text-base">
                                    {persistentAlert.profiles?.display_name || persistentAlert.pickup_contact_name || persistentAlert.customer_name || 'Online Customer'}
                                </p>
                                <p className="text-[oklch(55%_0.010_28)] font-mono text-xs">
                                    {persistentAlert.booking_type === 'pickup' ? '[PICK-UP ORDER]' : '[DINE-IN RESERVATION]'}
                                    {persistentAlert.payment_slip_url ? ' · WITH SLIP' : ''}
                                </p>
                                
                                <button 
                                    onClick={handleAcknowledge}
                                    className="mt-4 w-full py-3 rounded-xl bg-[oklch(18%_0.012_28)] text-white font-mono font-bold text-xs uppercase tracking-wider hover:bg-black active:scale-98 shadow-sm cursor-pointer transition-all"
                                >
                                    ACKNOWLEDGE & VIEW
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
