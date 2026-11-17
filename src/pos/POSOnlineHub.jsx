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
import { toast } from 'sonner';
import { getShortBookingId } from '../utils/printerHelper';
import { getBookingHoldMinutes, isHoldExpired, refundBookingLoyaltyIfNeeded, formatPosDateTime } from '../utils/availabilityUtils';
import { 
    playOrderAlert, 
    playSystemAlertSound, 
    checkEventDeduplication,
    getCanonicalOrderAlertKey,
    getCanonicalSlipAlertKey
} from '../utils/audioHelper';
import { sendTrackingBroadcast, sendPOSBroadcast, subscribePOSBroadcast } from '../utils/realtimeNotifier';
import POSVolumeControl from './POSVolumeControl';
import { guardReservationCheckIn } from '../utils/reservationCheckIn';

export default function POSOnlineHub({ activeShift, onOpenSlipModal, onViewSlipImage, onSelectOrder, refreshKey, isActive = true }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hubTab, setHubTab] = useState('active'); // 'active' | 'completed' | 'cancelled'
    const [channelFilter, setChannelFilter] = useState('all'); // 'all' | 'slips' | 'bookings' | 'pickups'
    const [searchQuery, setSearchQuery] = useState('');
    const [persistentAlert, setPersistentAlert] = useState(null);
    const [approvingId, setApprovingId] = useState(null);

    const alertIntervalRef = useRef(null);
    const isFetchingRef = useRef(false);
    const pendingFetchRef = useRef(false);
    const fetchDebounceRef = useRef(null);
    const isActiveRef = useRef(isActive);
    const hasLoadedOnceRef = useRef(false);

    useEffect(() => {
        isActiveRef.current = isActive;
    }, [isActive]);

    const playAlert = (eventKey = null) => {
        const didPlay = playOrderAlert(eventKey, 1200, 3.4);
        if (!didPlay) return; // Deduplicated or throttled, do not start duplicate loop

        if (alertIntervalRef.current) {
            clearInterval(alertIntervalRef.current);
            alertIntervalRef.current = null;
        }
        let repeatCount = 0;
        alertIntervalRef.current = setInterval(() => {
            repeatCount++;
            if (repeatCount >= 2) {
                stopAlert();
                return;
            }
            playOrderAlert('online_hub_repeat', 1000, 3.4);
        }, 15000);
    };

    const stopAlert = () => {
        if (alertIntervalRef.current) {
            clearInterval(alertIntervalRef.current);
            alertIntervalRef.current = null;
        }
    };

    useEffect(() => {
        return () => {
            stopAlert();
            if (fetchDebounceRef.current) {
                clearTimeout(fetchDebounceRef.current);
                fetchDebounceRef.current = null;
            }
        };
    }, []);

    const isOrderLineman = (b) => {
        if (!b) return false;
        const sourceLower = (b.source || '').toLowerCase();
        const remarkLower = (b.staff_remark || '').toLowerCase();
        const nameLower = (b.customer_name || '').toLowerCase();
        return sourceLower === 'lineman' || remarkLower.includes('lineman') || nameLower.includes('line man') || nameLower.startsWith('lm-');
    };

    const isOrderHausmade = (b) => {
        if (!b) return false;
        const sourceLower = (b.source || '').toLowerCase();
        const bookingType = (b.booking_type || '').toLowerCase();
        const orderType = (b.order_type || '').toLowerCase();
        const note = (b.customer_note || '').toLowerCase();
        const remark = (b.staff_remark || '').toLowerCase();
        return bookingType === 'hausmade' || orderType.startsWith('hausmade') || sourceLower.includes('hausmade') || note.includes('hausmade') || remark.includes('hausmade');
    };

    const fetchOnlineData = async (forceSpinner = false) => {
        if (!isActiveRef.current && hasLoadedOnceRef.current) return;
        if (isFetchingRef.current) {
            pendingFetchRef.current = true;
            return;
        }
        isFetchingRef.current = true;
        try {
            if (!hasLoadedOnceRef.current || forceSpinner) {
                setLoading(true);
            }
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayIso = today.toISOString();

            const { data, error } = await supabase
                .from('bookings')
                .select('*, tables_layout(*), profiles(display_name, phone_number), order_items(*, menu_items(name, price, category_id, menu_categories(name)))')
                .or(`booking_time.gte.${todayIso},created_at.gte.${todayIso},and(booking_type.eq.hausmade,status.in.(pending,confirmed,seated,preparing,packing,ready)),and(order_type.in.(hausmade_shipping,hausmade_pickup),status.in.(pending,confirmed,seated,preparing,packing,ready))`)
                .order('booking_time', { ascending: false });

            if (error) throw error;

            const onlineRelevant = (data || []).filter(b => {
                const sourceLower = (b.source || '').toLowerCase();
                const remarkLower = (b.staff_remark || '').toLowerCase();
                const isLineman = isOrderLineman(b);
                const isHausmade = isOrderHausmade(b);
                const hasOnlineMarker = sourceLower === 'online' || sourceLower === 'line' || remarkLower.includes('[online_pickup]') || remarkLower.includes('easyslip') || !!b.payment_slip_url || isHausmade;
                const isExplicitInHouse = !isLineman && !hasOnlineMarker && (sourceLower === 'pos' || sourceLower === 'walk_in' || remarkLower.includes('walk-in') || remarkLower.includes('walk in') || b.booking_type === 'walk_in');
                if (isExplicitInHouse) return false;

                // Physical dine-in table QR orders belong strictly to Table Grid / Floorplan, NEVER to Online Hub.
                // An online advance reservation stays here even if a table QR order touched it (source flipped to 'qr').
                const isOnlineReservation = b.booking_type === 'dine_in' && remarkLower.includes('[online]');
                const isTableQrOrder = !isOnlineReservation && Boolean(b.table_id) && (sourceLower === 'qr' || remarkLower.includes('qr walk-in') || b.booking_type === 'walk_in');
                if (isTableQrOrder) return false;

                const isOnlineSource = (sourceLower === 'online' || sourceLower === 'line' || remarkLower.includes('online') || isLineman || isHausmade);
                const hasSlip = !!b.payment_slip_url;
                const isOnlinePickup = (b.booking_type === 'pickup' || b.order_type === 'hausmade_pickup') && !isExplicitInHouse;
                return isOnlineSource || hasSlip || isOnlinePickup || isLineman || isHausmade;
            });

            setOrders(onlineRelevant);
            hasLoadedOnceRef.current = true;
        } catch (err) {
            console.error('Failed to fetch online orders:', err);
        } finally {
            setLoading(false);
            isFetchingRef.current = false;
            if (pendingFetchRef.current) {
                pendingFetchRef.current = false;
                scheduleFetchOnlineData(150);
            }
        }
    };

    const scheduleFetchOnlineData = (delayMs = 220) => {
        if (fetchDebounceRef.current) {
            clearTimeout(fetchDebounceRef.current);
        }
        fetchDebounceRef.current = setTimeout(() => {
            fetchDebounceRef.current = null;
            fetchOnlineData(false);
        }, delayMs);
    };

    useEffect(() => {
        if (isActive) {
            fetchOnlineData(false);
        }
    }, [isActive]);

    useEffect(() => {
        const handleIncomingBroadcast = async ({ event, payload }) => {
            if (event === 'online_order_created') {
                const bId = payload?.booking_id;
                const eventKey = getCanonicalOrderAlertKey(bId) || `order_${Date.now()}`;
                if (checkEventDeduplication(eventKey, 5000)) {
                    if (payload) {
                        setPersistentAlert({
                            id: bId,
                            booking_type: payload.booking_type || 'pickup',
                            customer_name: payload.customer_name,
                            pickup_contact_name: payload.customer_name,
                            total_amount: payload.total_amount,
                            payment_slip_url: payload.has_slip ? 'slip' : null,
                            tracking_token: payload.tracking_token
                        });
                    }
                    playAlert(eventKey);
                }
                if (isActiveRef.current) scheduleFetchOnlineData(120);
            } else if (event === 'payment_slip_uploaded') {
                const bId = payload?.booking_id;
                const slipEventKey = getCanonicalSlipAlertKey(bId);
                if (checkEventDeduplication(slipEventKey, 5000)) {
                    playAlert(slipEventKey);
                }
                if (isActiveRef.current) scheduleFetchOnlineData(120);
            } else if (event === 'online_order_status_updated' || event === 'customer_arrived') {
                if (isActiveRef.current) scheduleFetchOnlineData(120);
            }
        };

        const unsubscribeBroadcast = subscribePOSBroadcast(handleIncomingBroadcast);

        const channelName = `pos-online-hub-db-${Math.random().toString(36).slice(2, 8)}`;
        const dbChannel = supabase.channel(channelName)
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
                    const isLineman = isOrderLineman(b);
                    const isHausmade = isOrderHausmade(b);
                    const hasOnlineMarker = sourceLower === 'online' || sourceLower === 'line' || remarkLower.includes('[online_pickup]') || remarkLower.includes('easyslip') || !!b.payment_slip_url || isHausmade;
                    const isExplicitInHouse = !isLineman && !hasOnlineMarker && (sourceLower === 'pos' || sourceLower === 'walk_in' || remarkLower.includes('walk-in') || remarkLower.includes('walk in') || b.booking_type === 'walk_in');
                    
                    // In-store walk-in orders & physical table QR orders must NEVER trigger persistent alerts or sound in Online Hub!
                    if (isExplicitInHouse) return;

                    // Physical dine-in table QR orders belong strictly to Table Grid / Floorplan, NEVER to Online Hub!
                    const isTableQrOrder = Boolean(b.table_id) && (sourceLower === 'qr' || remarkLower.includes('qr') || b.booking_type === 'walk_in');
                    if (isTableQrOrder) return;

                    const isOnlineSource = (sourceLower === 'online' || sourceLower === 'line' || remarkLower.includes('online') || isLineman);
                    const hasSlip = !!b.payment_slip_url;
                    const isOnlinePickup = (b.booking_type === 'pickup' || b.order_type === 'hausmade_pickup') && !isExplicitInHouse;
                    
                    if (isOnlineSource || hasSlip || isOnlinePickup || isLineman || isHausmade) {
                        const eventKey = getCanonicalOrderAlertKey(b.id);
                        if (checkEventDeduplication(eventKey, 5000)) {
                            setPersistentAlert(b);
                            playAlert(eventKey);
                        }
                        if (isActiveRef.current) scheduleFetchOnlineData(180);
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
                    if (isActiveRef.current) scheduleFetchOnlineData(180);
                    const updated = payload.new;
                    
                    // Auto-dismiss persistent alert if this order was accepted/cancelled/completed from another terminal!
                    setPersistentAlert(prev => {
                        if (prev && prev.id === updated.id) {
                            const isNoLongerPending = ['confirmed', 'seated', 'preparing', 'ready', 'completed', 'cancelled', 'void'].includes(updated.status);
                            if (isNoLongerPending) {
                                stopAlert();
                                return null;
                            }
                        }
                        return prev;
                    });

                    // Only trigger alert for NEW payment slip upload
                    if (updated.payment_slip_url && updated.payment_slip_url !== payload.old?.payment_slip_url) {
                        const eventKey = getCanonicalSlipAlertKey(updated.id);
                        if (checkEventDeduplication(eventKey, 5000)) {
                            setPersistentAlert(updated);
                            playAlert(eventKey);
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'order_items',
                },
                () => {
                    if (isActiveRef.current) scheduleFetchOnlineData(250);
                }
            )
            .subscribe();

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && isActiveRef.current) {
                scheduleFetchOnlineData(150);
            }
        };
        const handleOnline = () => {
            if (isActiveRef.current) scheduleFetchOnlineData(150);
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('online', handleOnline);

        return () => {
            stopAlert();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('online', handleOnline);
            unsubscribeBroadcast();
            supabase.removeChannel(dbChannel);
        };
    }, []);

    useEffect(() => {
        if (isActive && refreshKey > 0) {
            scheduleFetchOnlineData(150);
        }
    }, [isActive, refreshKey]);

    const handleAcknowledge = () => {
        setPersistentAlert(null);
        stopAlert();
    };

    const updateBookingStatus = async (id, newStatus, customData = {}) => {
        try {
            const targetOrder = orders.find(o => o.id === id);
            const payload = { status: newStatus, ...customData };
            const { error } = await supabase
                .from('bookings')
                .update(payload)
                .eq('id', id);
            if (error) throw error;

            // Refund only after the status change is saved, so a failed update never refunds
            if (['cancelled', 'rejected', 'no_show'].includes(newStatus) && targetOrder) {
                await refundBookingLoyaltyIfNeeded({ ...targetOrder, staff_remark: payload.staff_remark ?? targetOrder.staff_remark }, supabase);
            }
            toast.success(`อัปเดตสถานะเป็น [${newStatus.toUpperCase()}] สำเร็จ`);

            // Instant Realtime Broadcast to customer tracking page (< 50ms)
            const trackingToken = targetOrder?.tracking_token || customData.tracking_token;
            if (trackingToken) {
                sendTrackingBroadcast(trackingToken, 'order_status_updated', {
                    status: newStatus,
                    booking_id: id,
                    ...customData
                });
            }
            sendPOSBroadcast('online_order_status_updated', {
                booking_id: id,
                status: newStatus
            });

            scheduleFetchOnlineData(50);
            return true;
        } catch (err) {
            console.error(err);
            toast.error('ไม่สามารถอัปเดตสถานะได้: ' + (err.message || 'Error'));
            return false;
        }
    };

    // Handler to approve attached bank transfer slip
    const handleApproveSlip = async (order) => {
        try {
            setApprovingId(order.id);
            const total = order.total_amount || 0;
            const updates = {
                status: 'confirmed',
                deposit_amount: order.deposit_amount > 0 ? order.deposit_amount : total,
                slip_verified: true,
                slip_verification_status: 'manual_verified',
                staff_remark: `${order.staff_remark || ''} [SLIP_VERIFIED]`.trim()
            };

            const { error } = await supabase
                .from('bookings')
                .update(updates)
                .eq('id', order.id);

            if (error) throw error;
            toast.success(`อนุมัติสลิปออเดอร์ #${getShortBookingId(order)} สำเร็จ`);

            // Instant Realtime Broadcast to tracking page
            if (order.tracking_token) {
                sendTrackingBroadcast(order.tracking_token, 'order_status_updated', {
                    status: updates.status,
                    booking_id: order.id
                });
            }
            sendPOSBroadcast('online_order_status_updated', {
                booking_id: order.id,
                status: updates.status
            });

            // Auto-trigger kitchen order print if items exist for pickup/hausmade orders
            if (order.booking_type !== 'dine_in' && order.order_items && order.order_items.length > 0 && onOpenSlipModal) {
                onOpenSlipModal({ ...order, ...updates }, 'kitchen');
            }

            scheduleFetchOnlineData(50);
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
        if (channelFilter === 'lineman' && !isOrderLineman(order)) return false;
        if (channelFilter === 'bookings' && (order.booking_type !== 'dine_in' || isOrderLineman(order) || isOrderHausmade(order))) return false;
        if (channelFilter === 'pickups' && ((order.booking_type !== 'pickup' && order.order_type !== 'hausmade_pickup') || isOrderLineman(order))) return false;
        if (channelFilter === 'hausmade' && !isOrderHausmade(order)) return false;

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
    const slipsToVerify = activeOrders.filter(o => !!o.payment_slip_url && o.status === 'pending' && !o.slip_verified);
    const linemanOrders = activeOrders.filter(o => isOrderLineman(o));
    const newBookings = activeOrders.filter(o => !isOrderLineman(o) && !isOrderHausmade(o) && o.booking_type === 'dine_in' && (!o.payment_slip_url || o.status !== 'pending' || o.slip_verified));
    const onlinePickups = activeOrders.filter(o => !isOrderLineman(o) && (o.booking_type === 'pickup' || o.order_type === 'hausmade_pickup') && (!o.payment_slip_url || o.status !== 'pending' || o.slip_verified));
    const hausmadeOrders = activeOrders.filter(o => isOrderHausmade(o) && (!o.payment_slip_url || o.status !== 'pending' || o.slip_verified));

    const normalizeSelectedOptions = (rawOpts) => {
        if (!rawOpts) return [];
        if (Array.isArray(rawOpts)) return rawOpts;
        if (typeof rawOpts === 'string') {
            return rawOpts.trim() ? [rawOpts.trim()] : [];
        }
        if (typeof rawOpts === 'object') {
            return Object.entries(rawOpts)
                .filter(([, val]) => val != null && val !== '' && (!Array.isArray(val) || val.length > 0))
                .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`);
        }
        return [];
    };

    const renderCard = (order, typeBadge) => {
        const shortId = getShortBookingId(order);
        const isLineman = isOrderLineman(order);
        const isHausmade = isOrderHausmade(order);
        const isHausmadePickup = order.order_type === 'hausmade_pickup';
        const isHausmadeShipping = order.order_type === 'hausmade_shipping' || (isHausmade && !isHausmadePickup);
        const isPickup = order.booking_type === 'pickup' || isHausmadePickup;
        const isCustomerArrived = (order.customer_note || '').includes('[CUSTOMER_ARRIVED]') || (order.staff_remark || '').includes('[CUSTOMER_ARRIVED]');
        
        // Order submission timestamp (when created) & Scheduled appointment date/time
        const orderCreatedDt = formatPosDateTime(order.created_at || order.booking_time);
        const apptDt = formatPosDateTime(order.booking_time);

        const defaultWalkIns = ['walk-in guest', 'walk-in pick-up', 'walk-in customer', 'walk-in', 'walk-in customer (offline)', 'walk-in pick-up (offline)', 'anonymous user', 'walk-in-customer', 'ลูกค้าทั่วไป'];
        const name = order.profiles?.display_name 
            || (order.pickup_contact_name && !defaultWalkIns.includes(order.pickup_contact_name.toLowerCase().trim()) ? order.pickup_contact_name : null)
            || (order.customer_name && !defaultWalkIns.includes(order.customer_name.toLowerCase().trim()) ? order.customer_name : null)
            || (isLineman ? `LINE MAN #${shortId}` : isHausmade ? `HAUSMADE #${shortId}` : 'Guest');
        const phone = order.profiles?.phone_number || order.pickup_contact_phone || order.customer_phone || '';
        const items = order.order_items || [];
        const tableName = order.tables_layout?.table_name;
        const isPaid = (order.deposit_amount >= order.total_amount && order.total_amount > 0) || order.status === 'paid' || isLineman;
        const isPending = order.status === 'pending';
        const isReady = order.status === 'ready';
        const isPayAtStore = (order.staff_remark || '').includes('[PAY_AT_STORE]') || (order.staff_remark || '').includes('[CALL_CONFIRM]');
        const awaitingCallConfirm = isPayAtStore && isPending;
        const holdMinutes = getBookingHoldMinutes(order);
        const holdExpired = order.booking_type === 'dine_in' && isHoldExpired(order);

        return (
            <motion.div 
                key={order.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-[var(--color-paper)] border rounded-xl p-4 flex flex-col gap-3 shadow-2xs transition-colors ${
                    isLineman 
                        ? 'border-[oklch(45%_0.08_140)]/40 hover:border-[oklch(45%_0.08_140)]' 
                        : isHausmade
                            ? 'border-[var(--brand-plum)]/40 hover:border-[var(--brand-plum)]'
                            : 'border-[var(--color-rule)] hover:border-[var(--color-ink)]'
                }`}
            >
                {/* Header: Short ID, Channel, Status & Clean Complete Date/Time Strip */}
                <div className="flex flex-col gap-2 border-b border-[var(--color-rule)] pb-2.5">
                    <div className="flex justify-between items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs font-bold text-[var(--color-ink)] bg-[var(--color-paper-2)] px-2 py-0.5 rounded border border-[var(--color-rule)]">
                                #{shortId}
                            </span>

                            {isLineman ? (
                                <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[oklch(45%_0.08_140)]/15 text-[oklch(45%_0.08_140)] border border-[oklch(45%_0.08_140)]/40">
                                    LINE MAN
                                </span>
                            ) : isHausmade ? (
                                <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--brand-plum)]/15 text-[var(--brand-plum)] border border-[var(--brand-plum)]/40">
                                    {isHausmadeShipping ? 'HAUSMADE SHIP' : 'HAUSMADE PICKUP'}
                                </span>
                            ) : (
                                <span className={`font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                    isPickup ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-[#1A1A1A] text-white'
                                }`}>
                                    {isPickup ? 'PICK-UP' : `TABLE ${tableName || 'TBA'}`}
                                </span>
                            )}

                            {order.slip_verified ? (
                                <span className="font-mono text-[9px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <CheckCircle2 size={10} className="text-emerald-700" />
                                    <span>{order.slip_provider === 'truewallet' ? 'AUTO-WALLET' : 'AUTO-SLIP'}</span>
                                </span>
                            ) : order.payment_slip_url ? (
                                <span className="font-mono text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded">
                                    SLIP (MANUAL)
                                </span>
                            ) : null}

                            <span className={`font-mono text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                isPaid 
                                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300' 
                                    : 'bg-[var(--color-paper-2)] text-[var(--color-neutral)] border-[var(--color-rule)]'
                            }`}>
                                {isPaid ? (isLineman ? 'PREPAID' : 'PAID') : (isPayAtStore ? 'PAY AT STORE' : 'UNPAID')}
                            </span>

                            {awaitingCallConfirm && (
                                <span className="font-mono text-[9px] font-bold uppercase tracking-wider bg-[var(--color-ink)] text-[var(--color-paper)] px-1.5 py-0.5 rounded">
                                    รอโทรยืนยัน
                                </span>
                            )}

                            {holdExpired ? (
                                <span className="font-mono text-[9px] font-bold uppercase tracking-wider bg-[var(--brand-plum)] text-white px-1.5 py-0.5 rounded">
                                    เลยเวลา {holdMinutes} นาที · ปล่อยโต๊ะแล้ว
                                </span>
                            ) : holdMinutes !== null && order.booking_type === 'dine_in' && (isPending || order.status === 'confirmed') && (
                                <span className="font-mono text-[9px] font-bold uppercase tracking-wider bg-[var(--color-paper-2)] text-[var(--color-muted)] border border-[var(--color-rule)] px-1.5 py-0.5 rounded">
                                    เก็บโต๊ะ {holdMinutes} นาที
                                </span>
                            )}

                            {isCustomerArrived && (
                                <span className="font-mono text-[9px] font-bold uppercase tracking-wider bg-[var(--brand-plum)] text-white px-1.5 py-0.5 rounded animate-pulse">
                                    ARRIVED · มาถึงร้านแล้ว
                                </span>
                            )}
                        </div>

                        <span className="font-mono text-[10px] text-[var(--color-neutral)] shrink-0">
                            สั่งเมื่อ: {orderCreatedDt.compactText}
                        </span>
                    </div>

                    {/* Clear, Scannable Appointment Date & Time Row */}
                    <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border font-mono text-xs ${
                        isPickup
                            ? 'bg-amber-100/70 border-amber-300/80 text-amber-950'
                            : isLineman
                                ? 'bg-emerald-50/80 border-emerald-200 text-[oklch(45%_0.08_140)]'
                                : apptDt.isFutureDay
                                    ? 'bg-[var(--brand-plum)]/10 border-[var(--brand-plum)]/30 text-[var(--brand-plum)]'
                                    : 'bg-[var(--color-paper-2)] border-[var(--color-rule)] text-[var(--color-ink)]'
                    }`}>
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                            {isPickup ? 'วัน-เวลานัดรับ' : isLineman ? 'วัน-เวลารับอาหาร' : 'วัน-เวลาจองโต๊ะ'}
                        </span>
                        <span className="font-black">
                            {apptDt.shortText}
                        </span>
                    </div>
                </div>

                {/* Customer & Rider Details */}
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-[var(--color-ink)] truncate">
                        <User size={13} className="text-[var(--color-neutral)] shrink-0" />
                        <span className="truncate">{name}</span>
                    </div>
                    {phone && (
                        <div className="flex items-center gap-1.5 text-xs font-mono text-[var(--color-neutral)]">
                            <Phone size={11} className="shrink-0" />
                            <span>{phone}</span>
                        </div>
                    )}
                    {order.staff_remark && (order.staff_remark.includes('Rider:') || order.staff_remark.includes('ไรเดอร์')) && (
                        <div className="text-[11px] font-mono text-[oklch(45%_0.08_140)] font-bold bg-[var(--color-paper-2)] px-2 py-0.5 rounded border border-[var(--color-rule)] truncate">
                            🛵 {order.staff_remark.replace(/\[LINEMAN:[^\]]+\]\s*/i, '')}
                        </div>
                    )}
                </div>

                {/* Order Items Preview */}
                {items.length > 0 ? (
                    <div className="bg-[var(--color-paper-2)] p-2.5 rounded-lg border border-[var(--color-rule)] text-xs font-sans space-y-1.5">
                        <div className="font-mono text-[9px] font-bold text-[var(--color-neutral)] uppercase tracking-wider">
                            ITEMS ({items.reduce((s, i) => s + (i.quantity || 1), 0)} TOTAL):
                        </div>
                        <ul className="space-y-1.5">
                            {items.slice(0, 4).map((item, idx) => {
                                const optsList = normalizeSelectedOptions(item.selected_options);
                                return (
                                    <li key={item.id || idx} className="text-[var(--color-ink)]">
                                        <div className="flex justify-between items-center">
                                            <span className="truncate pr-2 font-medium">
                                                <strong className="font-mono font-bold mr-1">{item.quantity}x</strong> 
                                                {item.custom_name || item.menu_items?.name || item.name || 'เมนูเพิ่มเติม'}
                                            </span>
                                            <span className="font-mono text-[10px] text-[var(--color-muted)] shrink-0">
                                                ฿{((item.price_at_time || item.price || 0) * (item.quantity || 1)).toLocaleString()}
                                            </span>
                                        </div>
                                        {/* Options & Modifiers */}
                                        {optsList.length > 0 && (
                                            <div className="text-[10px] text-[var(--color-neutral)] font-mono pl-4">
                                                {optsList.map((opt, oIdx) => (
                                                    <span key={oIdx} className="inline-block mr-1.5">
                                                        • {typeof opt === 'object' ? (opt.name || opt.choice || JSON.stringify(opt)) : opt}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                        {items.length > 4 && (
                            <div className="text-[9px] font-mono text-[var(--color-neutral)] text-right pt-0.5 font-bold">
                                + อีก {items.length - 4} รายการ...
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-2 text-[10px] font-mono text-[var(--color-neutral)] italic bg-[var(--color-paper-2)] rounded-lg border border-[var(--color-rule)]">
                        ไม่มีรายการอาหาร (จองโต๊ะเปล่า)
                    </div>
                )}

                {order.customer_note && (
                    <div className="bg-[var(--color-paper-2)] p-2 rounded-lg text-xs text-[var(--color-ink)] font-medium border-l-2 border-[var(--brand-plum)]">
                        "{order.customer_note}"
                    </div>
                )}

                {/* Amount Totals */}
                <div className="flex items-center justify-between pt-1 border-t border-[var(--color-rule)] font-mono text-xs">
                    <span className="text-[10px] text-[var(--color-neutral)] uppercase tracking-wider font-bold">
                        {isLineman ? 'PLATFORM TOTAL' : 'TOTAL DUE'}
                    </span>
                    <span className="font-bold text-[var(--color-ink)]">
                        ฿{(order.total_amount || 0).toLocaleString()}
                    </span>
                </div>

                {/* Quick Print & POS Links */}
                <div className="grid grid-cols-3 gap-1 font-mono text-[9px] font-bold uppercase tracking-wider">
                    <button
                        type="button"
                        onClick={() => onOpenSlipModal && onOpenSlipModal(order, 'kitchen')}
                        className="py-1.5 px-2 rounded-md bg-white hover:bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[var(--color-ink)] transition-all flex items-center justify-center gap-1 cursor-pointer truncate"
                        title="พิมพ์ใบสั่งครัว"
                    >
                        <Printer size={10} />
                        <span>KITCHEN</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => onOpenSlipModal && onOpenSlipModal(order, order.status === 'completed' ? 'receipt' : 'billing')}
                        className="py-1.5 px-2 rounded-md bg-white hover:bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[var(--color-ink)] transition-all flex items-center justify-center gap-1 cursor-pointer truncate"
                        title="พิมพ์ใบแจ้งยอด / ใบเสร็จ"
                    >
                        <FileText size={10} />
                        <span>SLIP</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => onSelectOrder && onSelectOrder(order)}
                        className="py-1.5 px-2 rounded-md bg-white hover:bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[var(--color-ink)] transition-all flex items-center justify-center gap-1 cursor-pointer truncate"
                        title="เปิดแก้ไขและคิดเงินใน POS"
                    >
                        <ExternalLink size={10} />
                        <span>POS</span>
                    </button>
                </div>

                {/* Main Action Bar */}
                <div className="pt-2 border-t border-[var(--color-rule)] flex gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider">
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
                            className="flex-1 py-2 rounded-lg bg-[var(--color-ink)] text-[var(--color-paper)] hover:opacity-90 transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                            <ImageIcon size={12} />
                            <span>VIEW SLIP</span>
                        </button>
                    )}

                    {order.payment_slip_url && order.status === 'pending' && !order.slip_verified && (
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

                    {/* LINE MAN Actions */}
                    {isLineman && (order.status === 'confirmed' || order.status === 'pending') && (
                        <button
                            type="button"
                            onClick={() => {
                                updateBookingStatus(order.id, 'seated');
                                if (onOpenSlipModal && items.length > 0) {
                                    onOpenSlipModal(order, 'kitchen');
                                }
                            }}
                            className="flex-1 py-2 rounded-lg bg-[var(--brand-plum)] text-white hover:opacity-90 transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                            <Check size={12} />
                            <span>ACCEPT & COOK</span>
                        </button>
                    )}

                    {isLineman && (order.status === 'seated' || order.status === 'preparing') && (
                        <button
                            type="button"
                            onClick={() => updateBookingStatus(order.id, 'ready')}
                            className="flex-1 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                            <Check size={12} />
                            <span>READY FOR RIDER</span>
                        </button>
                    )}

                    {isLineman && order.status === 'ready' && (
                        <button
                            type="button"
                            onClick={() => updateBookingStatus(order.id, 'completed')}
                            className="flex-1 py-2 rounded-lg bg-[oklch(45%_0.08_140)] text-white hover:opacity-90 transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                            <CheckCircle2 size={12} />
                            <span>RIDER PICKED UP</span>
                        </button>
                    )}

                    {/* Free booking: phone the guest before confirming */}
                    {!isLineman && order.booking_type === 'dine_in' && awaitingCallConfirm && phone && (
                        <a
                            href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                            className="py-2 px-3 rounded-lg border border-[var(--color-ink)] text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                            <Phone size={12} />
                            <span>CALL</span>
                        </a>
                    )}

                    {/* Guest missed the hold window: free the table for walk-ins */}
                    {!isLineman && holdExpired && (
                        <button
                            type="button"
                            onClick={() => {
                                if (window.confirm(`ลูกค้า "${name}" ไม่มาตามเวลา ปล่อยโต๊ะ ${tableName || ''} (NO-SHOW)?`)) {
                                    updateBookingStatus(order.id, 'no_show');
                                }
                            }}
                            className="flex-1 py-2 rounded-lg border border-[var(--brand-plum)] text-[var(--brand-plum)] hover:bg-[var(--color-paper-2)] transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                            <X size={12} />
                            <span>NO-SHOW</span>
                        </button>
                    )}

                    {/* Standard Dine-in pending */}
                    {!isLineman && order.booking_type === 'dine_in' && order.status === 'pending' && !order.payment_slip_url && (
                        <button
                            type="button"
                            onClick={() => {
                                if (awaitingCallConfirm && !window.confirm(`โทรคุยกับ "${name}" ยืนยันการจองโต๊ะ ${tableName || ''} แล้ว?`)) return;
                                updateBookingStatus(order.id, 'confirmed');
                            }}
                            className="flex-1 py-2 rounded-lg bg-[var(--brand-plum)] text-white hover:opacity-90 transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                            <Check size={12} />
                            <span>{awaitingCallConfirm ? 'ยืนยันทางโทรศัพท์แล้ว' : 'CONFIRM DINE-IN'}</span>
                        </button>
                    )}

                    {/* Standard Dine-in confirmed -> 1-Tap SEAT GUEST NOW */}
                    {!isLineman && order.booking_type === 'dine_in' && order.status === 'confirmed' && (
                        <button
                            type="button"
                            onClick={async () => {
                                const allowed = await guardReservationCheckIn(order, {
                                    tableName: order.tables_layout?.table_name || tableName || '',
                                    onBlocked: (msg) => toast.error(msg)
                                });
                                if (!allowed) return;
                                const ok = await updateBookingStatus(order.id, 'seated');
                                if (!ok) return;
                                if (onOpenSlipModal && items.length > 0) {
                                    onOpenSlipModal({ ...order, status: 'seated' }, 'kitchen');
                                }
                                if (onSelectOrder) {
                                    onSelectOrder({ ...order, status: 'seated' });
                                }
                                toast.success(`เช็คอินลูกค้าโต๊ะ ${order.tables_layout?.table_name || ''} เรียบร้อย`);
                            }}
                            className="flex-1 py-2 rounded-lg bg-[var(--color-ink)] text-white hover:opacity-90 transition-all flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                        >
                            <CheckCircle2 size={12} />
                            <span className="whitespace-nowrap">เช็คอิน · SEAT</span>
                        </button>
                    )}

                    {/* Pay-at-store pickup: staff must phone the customer before anything reaches the kitchen */}
                    {!isLineman && !isHausmade && order.booking_type === 'pickup' && awaitingCallConfirm && (
                        <>
                            {phone && (
                                <a
                                    href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                                    className="py-2 px-3 rounded-lg border border-[var(--color-ink)] text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] transition-all flex items-center justify-center gap-1 cursor-pointer"
                                >
                                    <Phone size={12} />
                                    <span>CALL</span>
                                </a>
                            )}
                            <button
                                type="button"
                                onClick={async () => {
                                    if (window.confirm(`โทรคุยกับ "${name}" ยืนยันออเดอร์ #${shortId} และสั่งพิมพ์ใบครัวทันที?`)) {
                                        const nextRemark = `${order.staff_remark || ''} [STAFF_CONFIRMED] [STAFF_ACCEPTED]`.trim();
                                        await updateBookingStatus(order.id, 'preparing', { staff_remark: nextRemark });
                                        if (onOpenSlipModal && items.length > 0) {
                                            onOpenSlipModal({ ...order, status: 'preparing', staff_remark: nextRemark }, 'kitchen');
                                        }
                                    }
                                }}
                                className="flex-1 py-2 rounded-lg bg-[var(--brand-plum)] text-white hover:opacity-90 transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                                <Printer size={12} />
                                <span>โทรยืนยันแล้ว + สั่งพิมพ์ใบครัวทันที</span>
                            </button>
                        </>
                    )}

                    {/* Standard Pickup pending or confirmed -> ACCEPT & COOK (send to kitchen & print) */}
                    {!isLineman && !isHausmade && order.booking_type === 'pickup' && !awaitingCallConfirm && ((order.status === 'pending' && (!order.payment_slip_url || order.slip_verified)) || order.status === 'confirmed') && (
                        <button
                            type="button"
                            onClick={() => {
                                updateBookingStatus(order.id, 'preparing');
                                if (onOpenSlipModal && items.length > 0) {
                                    onOpenSlipModal({ ...order, status: 'preparing' }, 'kitchen');
                                }
                            }}
                            className="flex-1 py-2 rounded-lg bg-[var(--brand-plum)] text-white hover:opacity-90 transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                            <Check size={12} />
                            <span>COOK & PRINT</span>
                        </button>
                    )}

                    {/* Standard Pickup seated/preparing -> MARK READY (confirmed orders go through COOK & PRINT first) */}
                    {!isLineman && !isHausmade && order.booking_type === 'pickup' && (order.status === 'seated' || order.status === 'preparing') && (
                        <>
                            <button
                                type="button"
                                onClick={() => updateBookingStatus(order.id, 'ready')}
                                className="flex-1 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                                <Check size={12} />
                                <span>MARK READY</span>
                            </button>
                            {!isPaid && (
                                <button
                                    type="button"
                                    onClick={() => onSelectOrder && onSelectOrder(order)}
                                    className="py-2 px-3 rounded-lg bg-[var(--color-ink)] text-white hover:opacity-90 transition-all flex items-center justify-center gap-1 cursor-pointer"
                                >
                                    <CreditCard size={12} />
                                    <span>CHECKOUT POS</span>
                                </button>
                            )}
                        </>
                    )}

                    {/* Standard Pickup ready */}
                    {!isLineman && !isHausmade && order.booking_type === 'pickup' && order.status === 'ready' && (
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
                                className="flex-1 py-2 rounded-lg bg-[var(--color-ink)] text-white hover:opacity-90 transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                                <CreditCard size={12} />
                                <span>CHECKOUT POS</span>
                            </button>
                        )
                    )}

                    {/* HAUSMADE Pickup Actions */}
                    {isHausmade && isHausmadePickup && (order.status === 'confirmed' || order.status === 'packing' || order.status === 'preparing') && (
                        <button
                            type="button"
                            onClick={() => updateBookingStatus(order.id, 'ready')}
                            className="flex-1 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                            <Check size={12} />
                            <span>พร้อมรับหน้าร้าน (READY)</span>
                        </button>
                    )}

                    {isHausmade && isHausmadePickup && order.status === 'ready' && (
                        <button
                            type="button"
                            onClick={() => updateBookingStatus(order.id, 'completed')}
                            className="flex-1 py-2 rounded-lg bg-[oklch(45%_0.08_140)] text-white hover:opacity-90 transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                            <CheckCircle2 size={12} />
                            <span>จ่ายของแล้ว (HANDED OVER)</span>
                        </button>
                    )}

                    {/* HAUSMADE Shipping Actions */}
                    {isHausmade && isHausmadeShipping && order.status === 'confirmed' && (
                        <button
                            type="button"
                            onClick={() => updateBookingStatus(order.id, 'packing')}
                            className="flex-1 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                            <Check size={12} />
                            <span>กำลังแพ็ค (PACKING)</span>
                        </button>
                    )}

                    {/* Cancel button */}
                    {order.status !== 'cancelled' && order.status !== 'completed' && order.status !== 'no_show' && order.status !== 'void' && (
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
        <div className="h-full flex flex-col bg-[var(--color-paper-2)] overflow-hidden select-none font-sans text-[var(--color-ink)]">
            {/* Header & Sub-Bar */}
            <div className="p-4 bg-[var(--color-paper)] border-b border-[var(--color-rule)] flex flex-col gap-3 shrink-0 shadow-2xs">
                <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                    <div>
                        <h1 className="text-base font-mono font-bold uppercase tracking-wider text-[var(--color-ink)]">
                            ONLINE ORDERS HUB / ศูนย์จัดการออเดอร์ออนไลน์
                        </h1>
                        <p className="text-[11px] font-mono text-[var(--color-neutral)] mt-0.5">
                            จัดการสลิปโอนเงิน การจองโต๊ะล่วงหน้า และออเดอร์รับกลับบ้าน
                        </p>
                    </div>

                    {/* Status Tabs */}
                    <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-wider">
                        <div className="flex bg-[var(--color-paper-2)] p-0.5 rounded-lg border border-[var(--color-rule)]">
                            <button
                                type="button"
                                onClick={() => setHubTab('active')}
                                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                                    hubTab === 'active' 
                                        ? 'bg-white text-[var(--color-ink)] shadow-2xs' 
                                        : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'
                                }`}
                            >
                                <span>ACTIVE</span>
                                <span className="bg-[var(--brand-plum)]/15 text-[var(--brand-plum)] px-1.5 py-0.2 rounded text-[9px]">
                                    {activeOrders.length}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setHubTab('completed')}
                                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                                    hubTab === 'completed' 
                                        ? 'bg-white text-[var(--color-ink)] shadow-2xs' 
                                        : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'
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
                                        ? 'bg-white text-[var(--color-ink)] shadow-2xs' 
                                        : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'
                                }`}
                            >
                                <span>CANCELLED</span>
                                <span className="bg-red-100 text-red-900 px-1.5 py-0.2 rounded text-[9px]">
                                    {cancelledOrders.length}
                                </span>
                            </button>
                        </div>

                        {/* POS Audio Volume Control */}
                        <POSVolumeControl />

                        <button
                            type="button"
                            onClick={fetchOnlineData}
                            className="p-2 bg-white border border-[var(--color-rule)] rounded-lg text-[var(--color-neutral)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
                            title="รีเฟรชออเดอร์ออนไลน์"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Search & Quick Filter Chips */}
                <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between pt-1">
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-neutral)]" size={14} />
                        <input
                            type="search"
                            placeholder="ค้นหา Short ID (#A2EB), ชื่อ, โทร..."
                            className="w-full bg-white border border-[var(--color-rule)] rounded-lg py-1.5 pl-8 pr-3 text-xs text-[var(--color-ink)] placeholder-[var(--color-neutral)] focus:outline-none focus:border-[var(--color-ink)] transition-colors font-mono"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex bg-[var(--color-paper-2)] p-0.5 rounded-lg border border-[var(--color-rule)] font-mono text-[9px] font-bold uppercase tracking-wider overflow-x-auto w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => setChannelFilter('all')}
                            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${channelFilter === 'all' ? 'bg-white text-[var(--color-ink)] shadow-2xs' : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                        >
                            ALL TYPES
                        </button>
                        <button
                            type="button"
                            onClick={() => setChannelFilter('lineman')}
                            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${channelFilter === 'lineman' ? 'bg-white text-[var(--color-ink)] shadow-2xs' : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                        >
                            LINE MAN
                        </button>
                        <button
                            type="button"
                            onClick={() => setChannelFilter('slips')}
                            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${channelFilter === 'slips' ? 'bg-white text-[var(--color-ink)] shadow-2xs' : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                        >
                            SLIPS ONLY
                        </button>
                        <button
                            type="button"
                            onClick={() => setChannelFilter('bookings')}
                            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${channelFilter === 'bookings' ? 'bg-white text-[var(--color-ink)] shadow-2xs' : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                        >
                            DINE-IN
                        </button>
                        <button
                            type="button"
                            onClick={() => setChannelFilter('pickups')}
                            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${channelFilter === 'pickups' ? 'bg-white text-[var(--color-ink)] shadow-2xs' : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                        >
                            PICK-UP
                        </button>
                        <button
                            type="button"
                            onClick={() => setChannelFilter('hausmade')}
                            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${channelFilter === 'hausmade' ? 'bg-[var(--brand-plum)] text-white shadow-2xs font-bold' : 'text-[var(--color-neutral)] hover:text-[var(--brand-plum)]'}`}
                        >
                            <span>HAUSMADE</span>
                            {hausmadeOrders.length > 0 && (
                                <span className={`px-1 py-0.2 text-[9px] rounded font-mono ${channelFilter === 'hausmade' ? 'bg-white text-[var(--brand-plum)]' : 'bg-[var(--brand-plum)] text-white'}`}>
                                    {hausmadeOrders.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Active Kanban View */}
            {hubTab === 'active' && (
                <div className="flex-1 p-4 overflow-x-auto flex gap-4 snap-x scrollbar-none">
                    {/* Column 1: Slips to Verify */}
                    <div className="w-[340px] shrink-0 flex flex-col snap-start bg-[var(--color-paper)] rounded-xl border border-[var(--color-rule)] p-3.5 shadow-2xs">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--color-rule)]">
                            <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">
                                    VERIFY SLIPS / ตรวจสลิป
                                </span>
                            </div>
                            <span className="bg-blue-100 text-blue-900 border border-blue-200 text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                                {slipsToVerify.length}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col gap-3 pb-6">
                            {slipsToVerify.length === 0 ? (
                                <div className="text-center text-[var(--color-neutral)] text-xs font-mono py-12">
                                    ไม่มีสลิปค้างตรวจสอบ
                                </div>
                            ) : (
                                <AnimatePresence>
                                    {slipsToVerify.map(o => renderCard(o, 'SLIP VERIFY'))}
                                </AnimatePresence>
                            )}
                        </div>
                    </div>

                    {/* Column 2: LINE MAN Orders */}
                    <div className="w-[340px] shrink-0 flex flex-col snap-start bg-[var(--color-paper)] rounded-xl border border-[var(--color-rule)] p-3.5 shadow-2xs">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--color-rule)]">
                            <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">
                                    LINE MAN / เดลิเวอรี
                                </span>
                            </div>
                            <span className="bg-[oklch(45%_0.08_140)]/15 text-[oklch(45%_0.08_140)] border border-[oklch(45%_0.08_140)]/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                                {linemanOrders.length}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col gap-3 pb-6">
                            {linemanOrders.length === 0 ? (
                                <div className="text-center text-[var(--color-neutral)] text-xs font-mono py-12">
                                    ไม่มีออเดอร์ LINE MAN ค้างอยู่
                                </div>
                            ) : (
                                <AnimatePresence>
                                    {linemanOrders.map(o => renderCard(o, o.status === 'ready' ? 'READY' : 'PREPARING'))}
                                </AnimatePresence>
                            )}
                        </div>
                    </div>

                    {/* Column 3: Pick-up Orders */}
                    <div className="w-[340px] shrink-0 flex flex-col snap-start bg-[var(--color-paper)] rounded-xl border border-[var(--color-rule)] p-3.5 shadow-2xs">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--color-rule)]">
                            <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">
                                    ONLINE PICKUPS / รับกลับบ้าน
                                </span>
                            </div>
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                                {onlinePickups.length}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col gap-3 pb-6">
                            {onlinePickups.length === 0 ? (
                                <div className="text-center text-[var(--color-neutral)] text-xs font-mono py-12">
                                    ไม่มีออเดอร์รับกลับบ้านที่กำลังดำเนินการ
                                </div>
                            ) : (
                                <AnimatePresence>
                                    {onlinePickups.map(o => renderCard(o, o.status === 'ready' ? 'READY' : 'PREPARING'))}
                                </AnimatePresence>
                            )}
                        </div>
                    </div>

                    {/* Column 4: Dine-in Reservations */}
                    <div className="w-[340px] shrink-0 flex flex-col snap-start bg-[var(--color-paper)] rounded-xl border border-[var(--color-rule)] p-3.5 shadow-2xs">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--color-rule)]">
                            <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">
                                    DINE-IN BOOKINGS / จองโต๊ะ
                                </span>
                            </div>
                            <span className="bg-[var(--color-ink)] text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                                {newBookings.length}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col gap-3 pb-6">
                            {newBookings.length === 0 ? (
                                <div className="text-center text-[var(--color-neutral)] text-xs font-mono py-12">
                                    ไม่มีรายการจองโต๊ะค้างอยู่
                                </div>
                            ) : (
                                <AnimatePresence>
                                    {newBookings.map(o => renderCard(o, 'DINE-IN BOOKING'))}
                                </AnimatePresence>
                            )}
                        </div>
                    </div>

                    {/* Column 5: HAUSMADE Orders */}
                    <div className="w-[340px] shrink-0 flex flex-col snap-start bg-[var(--color-paper)] rounded-xl border border-[var(--brand-plum)]/40 p-3.5 shadow-2xs">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--color-rule)]">
                            <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--brand-plum)]">
                                    HAUSMADE / สินค้า & พัสดุ
                                </span>
                            </div>
                            <span className="bg-[var(--brand-plum)] text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                                {hausmadeOrders.length}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col gap-3 pb-6">
                            {hausmadeOrders.length === 0 ? (
                                <div className="text-center text-[var(--color-neutral)] text-xs font-mono py-12">
                                    ไม่มีออเดอร์ HAUSMADE ค้างอยู่
                                </div>
                            ) : (
                                <AnimatePresence>
                                    {hausmadeOrders.map(o => renderCard(o, o.order_type === 'hausmade_shipping' ? 'HAUSMADE SHIPPING' : 'HAUSMADE PICKUP'))}
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
                        <div className="text-center text-[var(--color-neutral)] text-xs font-mono py-16">
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
                        <div className="text-center text-[var(--color-neutral)] text-xs font-mono py-16">
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
                {persistentAlert && (() => {
                    const alertApptDt = formatPosDateTime(persistentAlert.booking_time);
                    const alertCreatedDt = formatPosDateTime(persistentAlert.created_at || persistentAlert.booking_time);
                    const isPickupAlert = persistentAlert.booking_type === 'pickup';
                    return (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
                        >
                            <motion.div 
                                initial={{ scale: 0.95, y: 10 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.95, y: 10 }}
                                className="bg-[var(--color-paper)] rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden border-2 border-[var(--brand-plum)] font-sans"
                            >
                                <div className={`${isOrderLineman(persistentAlert) ? 'bg-[oklch(45%_0.08_140)]' : 'bg-[var(--error-red)]'} p-5 text-center text-white flex flex-col items-center`}>
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest bg-black/20 px-2 py-0.5 rounded mb-1">
                                        {isOrderLineman(persistentAlert) ? 'LINE MAN DELIVERY' : 'INCOMING NOTIFICATION'}
                                    </span>
                                    <h2 className="text-xl font-bold tracking-tight uppercase">
                                        {isOrderLineman(persistentAlert) ? 'NEW DELIVERY ORDER' : (isPickupAlert ? 'NEW PICK-UP ORDER' : 'NEW TABLE BOOKING')}
                                    </h2>
                                    <span className="font-mono text-sm font-bold mt-1">
                                        #{getShortBookingId(persistentAlert)}
                                    </span>
                                </div>
                                
                                <div className="p-5 flex flex-col items-center text-center gap-3 font-sans">
                                    <div>
                                        <p className="text-[var(--color-ink)] font-bold text-base">
                                            {persistentAlert.profiles?.display_name || persistentAlert.pickup_contact_name || persistentAlert.customer_name || 'Online Customer'}
                                        </p>
                                        <p className="text-[var(--color-neutral)] font-mono text-xs mt-0.5">
                                            {isOrderLineman(persistentAlert) 
                                                ? `[LINE MAN PREPAID · ฿${(persistentAlert.total_amount || 0).toLocaleString()}]` 
                                                : (isPickupAlert ? '[PICK-UP ORDER · รับกลับบ้าน]' : `[DINE-IN · ${persistentAlert.pax || 2} ท่าน${persistentAlert.tables_layout?.table_name ? ` · โต๊ะ ${persistentAlert.tables_layout.table_name}` : ''}]`)}
                                            {persistentAlert.payment_slip_url ? ' · WITH SLIP' : ''}
                                        </p>
                                    </div>

                                    {/* Complete Date & Time Block */}
                                    <div className="w-full bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-xl p-3 font-mono text-xs flex flex-col gap-1.5 text-left">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold uppercase text-[var(--color-neutral)]">
                                                {isPickupAlert ? 'วัน-เวลานัดรับ:' : 'วัน-เวลานัดหมาย:'}
                                            </span>
                                            <span className="font-black text-[var(--color-ink)]">
                                                {alertApptDt.shortText}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center border-t border-[var(--color-rule)] pt-1 text-[11px] text-[var(--color-neutral)]">
                                            <span>ทำรายการเมื่อ:</span>
                                            <span className="font-bold">{alertCreatedDt.compactText}</span>
                                        </div>
                                    </div>
                                    
                                    <button 
                                        onClick={handleAcknowledge}
                                        className="mt-1 w-full py-3 rounded-xl bg-[var(--color-ink)] text-white font-mono font-bold text-xs uppercase tracking-wider hover:bg-black active:scale-98 shadow-sm cursor-pointer transition-all"
                                    >
                                        ACKNOWLEDGE & VIEW
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    );
                })()}
            </AnimatePresence>
        </div>
    );
}
