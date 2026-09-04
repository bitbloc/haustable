import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import POSLayout from './POSLayout';
import POSTableGrid from './POSTableGrid';
import POSMenuGrid from './POSMenuGrid';
import POSOrderPanel from './POSOrderPanel';
import { usePOSOrder } from '../hooks/usePOSOrder';
import { Toaster, toast } from 'sonner';
import POSReportsPanel from './POSReportsPanel';
import POSCRMPanel from './POSCRMPanel';
import POSOpenBillsGrid from './POSOpenBillsGrid';
import POSOfflineQueueDrawer from './POSOfflineQueueDrawer';
import POSSplitPaymentModal from './POSSplitPaymentModal';
import SlipModal from '../components/shared/SlipModal';
import ViewSlipModal from '../components/shared/ViewSlipModal';
import POSOnlineHub from './POSOnlineHub';
import { getCurrentShift, startShift, closeShift, addShiftAdjustment, checkAndRestoreActiveShift, voidShiftTransaction, cleanUpAllShifts, syncShiftToCloud, logPosAudit, calculateShiftMetrics, getBookingPaymentBreakdown, recordShiftTransaction } from '../utils/shiftHelper';
import { isOnline, addToOfflineQueue, posCache } from '../utils/offlineHelper';
import { appendSplitRoundToRemark, getBookingSplitRounds, getSplitTotalPaid } from '../utils/splitPaymentHelper';
import POSPinPad from './POSPinPad';
import { printToSunmiBuiltIn, encodeShiftClosureReportData, compileShiftReportData, initPrinterConfigSync, autoPrintQROrder, silentPrintSlip, getShortBookingId, printSplitQrSlip } from '../utils/printerHelper';
import { formatMergeSourceRemark, formatMergeTargetRemark, formatMoveRemark } from '../utils/tableTransferHelper';
import { resolveDominantCrmMember } from '../utils/crmHelper';
import { sendTrackingBroadcast, sendPOSBroadcast } from '../utils/realtimeNotifier';
import { 
    playOrderAlert, 
    playStaffCallAlert, 
    playBillAlert, 
    playSlipAlert, 
    playDoorbellAlert, 
    playSynthChime, 
    playDoorbellChime, 
    unlockAudioEngine,
    checkEventDeduplication,
    playSystemAlertSound as playSystemAlertSoundUtil 
} from '../utils/audioHelper';
import { useWakeLock } from '../hooks/useWakeLock';
import { Users, Lock, Key, Plus, Minus, LogIn, LogOut, Printer, X, Search, Coins, Check, ReceiptText } from 'lucide-react';

const DEFAULT_BAR_CATS = [
    '7524bb8a-4698-45c6-aa17-d8ccc296f667', // Coffee
    '912683ef-fdc3-40a3-8dd8-b09507791240', // Soft Drink
    'b441665e-2f23-4df3-a11d-63485e1690dc', // Beer
    'a2c783fc-975b-4779-b9eb-67391eeafd1f', // Alcohol
    '1983955d-5787-4351-b729-51b95761f125', // Mocktail & Cocktail
    '1407d869-4eed-489e-aeeb-ba7ef19f57bd', // Bottled
    '8a3dcc6b-9eff-42b2-83d5-1e02dd0a98cd'  // PRO Beer
];

function formatDbOrderItemToCart(oi) {
    if (!oi) return null;
    const isCustom = Boolean(oi.is_custom === true || oi.is_emergency === true || String(oi.id).startsWith('custom_'));
    
    // Normalize options to always be a safe Array
    let optionsArr = [];
    if (Array.isArray(oi.selected_options)) {
        optionsArr = oi.selected_options;
    } else if (oi.selected_options && typeof oi.selected_options === 'object') {
        optionsArr = Object.entries(oi.selected_options).map(([k, v]) => (typeof v === 'object' && v !== null ? v : { name: `${k}: ${v}` }));
    }

    const customNameInOpts = optionsArr.find(o => o?.custom_item_name)?.custom_item_name;
    const resolvedName = oi.custom_name 
        || oi.menu_items?.name 
        || customNameInOpts
        || oi.name 
        || (isCustom ? 'เมนูเพิ่มเติม' : 'Item');
    
    const catId = oi.menu_items?.category_id || oi.category_id || '';
    let resolvedDest = 'kitchen';
    if (DEFAULT_BAR_CATS.includes(catId)) {
        resolvedDest = 'bar';
    } else if (oi.destination === 'bar' || oi.destination === 'drinks') {
        resolvedDest = 'bar';
    } else if (oi.destination === 'other') {
        resolvedDest = 'other';
    } else if (optionsArr.some(o => {
        const oStr = typeof o === 'object' && o !== null ? (o.name || o.destination || '') : String(o || '');
        return oStr.includes('(บาร์)') || oStr.includes('เครื่องดื่ม') || o?.destination === 'bar';
    })) {
        resolvedDest = 'bar';
    }

    const rawId = oi.id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const cleanDbId = typeof rawId === 'string' && rawId.startsWith('db_') ? rawId.replace(/^db_/, '') : rawId;

    return {
        id: String(rawId).startsWith('db_') ? rawId : `db_${rawId}`,
        menu_item_id: oi.menu_item_id,
        name: resolvedName,
        custom_name: isCustom ? (oi.custom_name || resolvedName) : null,
        price: parseFloat(oi.price_at_time ?? oi.price) || 0,
        quantity: oi.quantity || 1,
        db_id: cleanDbId,
        selected_options: optionsArr,
        category_id: oi.menu_items?.category_id || oi.category_id || '',
        category_name: oi.menu_items?.menu_categories?.name || oi.category_name || (resolvedDest === 'bar' ? 'เครื่องดื่ม' : 'อาหาร'),
        destination: resolvedDest,
        is_custom: isCustom,
        is_emergency: isCustom,
        is_drink_stamp_eligible: typeof oi.menu_items?.is_drink_stamp_eligible === 'boolean' 
            ? oi.menu_items.is_drink_stamp_eligible 
            : (typeof oi.is_drink_stamp_eligible === 'boolean' 
                ? oi.is_drink_stamp_eligible 
                : (typeof oi.menu_items?.menu_categories?.is_drink_stamp_eligible === 'boolean' 
                    ? oi.menu_items.menu_categories.is_drink_stamp_eligible 
                    : (typeof oi.menu_categories?.is_drink_stamp_eligible === 'boolean' 
                        ? oi.menu_categories.is_drink_stamp_eligible 
                        : false)))
    };
}

export default function POSDashboard() {
    const { request: requestWakeLock, release: releaseWakeLock } = useWakeLock();
    
    // Maintain active screen wake lock during POS operations
    useEffect(() => {
        requestWakeLock();
        return () => {
            if (releaseWakeLock) releaseWakeLock();
        };
    }, [requestWakeLock, releaseWakeLock]);

    const [view, setView] = useState('tables'); // 'tables' or 'menu'
    const [selectedTable, setSelectedTable] = useState(null);
    const [activeBooking, setActiveBooking] = useState(null);
    const activeBookingRef = useRef(activeBooking);
    useEffect(() => {
        activeBookingRef.current = activeBooking;
    }, [activeBooking]);

    const [currentOrder, setCurrentOrder] = useState({
        items: [],
        note: ''
    });

    const [activeStaff, setActiveStaff] = useState(() => {
        try {
            const saved = localStorage.getItem('pos_active_staff');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });

    const handlePinLogin = async (staff) => {
        setSelectedStaffForLogin(staff);
        localStorage.setItem('pos_active_staff', JSON.stringify(staff));
        setActiveStaff(staff);

        const existingShift = await checkAndRestoreActiveShift();
        if (existingShift) {
            if (existingShift.staffName !== staff.display_name) {
                const updatedShift = {
                    ...existingShift,
                    staffName: staff.display_name
                };
                localStorage.setItem('pos_current_shift', JSON.stringify(updatedShift));
                setActiveShift(updatedShift);
                syncShiftToCloud(updatedShift);
                window.dispatchEvent(new Event('pos-shift-changed'));
            } else {
                setActiveShift(existingShift);
            }
            setIsPinVerified(true);
            toast.success(`ยินดีต้อนรับ: ${staff.display_name} (เข้าสู่กะปัจจุบัน)`);
            setPinInput('');
        } else {
            setShowOpeningFloatModal(true);
        }
    };
    const [activeSlipBooking, setActiveSlipBooking] = useState(null);
    const [activeSlipType, setActiveSlipType] = useState('billing');
    const [viewSlipImageUrl, setViewSlipImageUrl] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const refreshDebounceRef = useRef(null);
    const triggerDebouncedRefresh = useCallback(() => {
        if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
        refreshDebounceRef.current = setTimeout(() => {
            setRefreshKey(prev => prev + 1);
        }, 350);
    }, []);

    // Move / Merge / Split States
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [showSplitModal, setShowSplitModal] = useState(false);
    const [splitIncludeTax, setSplitIncludeTax] = useState(true);
    const [availableTables, setAvailableTables] = useState([]);

    const [hasPendingOrders, setHasPendingOrders] = useState(false);
    const prevHasPendingOrdersRef = useRef(false);

    // Track unique realtime alerts to prevent audio overlap and duplicates
    const activeNotificationsRef = useRef(new Set());
    const lastPlayedSoundTimeRef = useRef(0);

    // Notification History Drawer State
    const [notificationHistory, setNotificationHistory] = useState([]);
    const [showNotifDrawer, setShowNotifDrawer] = useState(false);
    const [unreadNotifCount, setUnreadNotifCount] = useState(0);

    const pushNotifHistory = (type, title, message, tableId) => {
        const item = {
            id: Date.now() + Math.random(),
            type,
            title,
            message,
            tableId,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setNotificationHistory(prev => [item, ...prev].slice(0, 30));
        setUnreadNotifCount(prev => prev + 1);
    };

    // Shift Management States
    const [activeShift, setActiveShift] = useState(getCurrentShift());
    const [realtimeShiftSummary, setRealtimeShiftSummary] = useState(null);
    const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
    const [openShiftForm, setOpenShiftForm] = useState({ staffName: '', openingFloat: '1000' });
    const [closeShiftForm, setCloseShiftForm] = useState({ actualCash: '' });

    // PIN and Cash Adjustment States
    const [staffList, setStaffList] = useState([]);
    const [selectedStaffForLogin, setSelectedStaffForLogin] = useState(null);
    const [pinInput, setPinInput] = useState('');
    const [showOpeningFloatModal, setShowOpeningFloatModal] = useState(false);
    const [showCashAdjustmentModal, setShowCashAdjustmentModal] = useState(false);
    // isPinVerified: Persisted when pos_active_staff exists & pos_is_locked !== 'true'
    // Requires PIN re-entry ONLY when screen is locked or shift is closed/new shift started
    const [isPinVerified, setIsPinVerified] = useState(() => {
        const savedStaff = localStorage.getItem('pos_active_staff');
        const isLocked = localStorage.getItem('pos_is_locked') === 'true';
        return !!savedStaff && !isLocked;
    });
    const [isLocked, setIsLocked] = useState(() => {
        return localStorage.getItem('pos_is_locked') === 'true';
    });
    const [hasSession, setHasSession] = useState(false);
    const [selectedStaffForUnlock, setSelectedStaffForUnlock] = useState(null);
    const [lockPinInput, setLockPinInput] = useState('');

    const lockScreen = () => {
        setIsLocked(true);
        setIsPinVerified(false); // Force PIN re-entry on unlock / switch staff
        localStorage.setItem('pos_is_locked', 'true');
        localStorage.removeItem('pos_active_staff');
        setActiveStaff(null);
        setLockPinInput('');
        setSelectedStaffForUnlock(null);
    };

    const unlockScreen = () => {
        setIsLocked(false);
        localStorage.setItem('pos_is_locked', 'false');
        setSelectedStaffForUnlock(null);
        setLockPinInput('');
    };
    const [cashAdjustmentForm, setCashAdjustmentForm] = useState({ amount: '', note: '', type: 'out' });

    // Pending Online Bookings Pop-up Modal State
    const [pendingBookingsList, setPendingBookingsList] = useState([]);
    const [onlinePendingCount, setOnlinePendingCount] = useState(0);
    const [showPendingModal, setShowPendingModal] = useState(false);
    const prevPendingCountRef = useRef(0);

    // CRM Profile Attach States
    const [showAttachCRMModal, setShowAttachCRMModal] = useState(false);
    const [crmSearchTerm, setCrmSearchTerm] = useState('');
    const [crmMembers, setCrmMembers] = useState([]);
    const [crmLoading, setCrmLoading] = useState(false);
    const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
    const submittingOrderRef = useRef(false);
    const processingQrPrintRef = useRef(new Set());

    const loadCrmMembers = async (searchQuery = '') => {
        setCrmLoading(true);
        try {
            const { data: rpcData, error: rpcError } = await supabase.rpc('search_member_crm_pos', { p_term: searchQuery.trim() });
            if (!rpcError && rpcData) {
                setCrmMembers(rpcData);
                return;
            }

            let query = supabase
                .from('profiles')
                .select('id, display_name, nickname, phone_number, current_tier, xhaus_balance, drink_stamp_count, free_drink_quota')
                .order('display_name', { ascending: true })
                .limit(50);

            if (searchQuery.trim()) {
                const q = `%${searchQuery.trim()}%`;
                query = query.or(`display_name.ilike.${q},phone_number.ilike.${q}`);
            }

            const { data, error } = await query;
            if (error) throw error;
            setCrmMembers(data || []);
        } catch (err) {
            console.error("Error loading profiles:", err);
            toast.error("Failed to load customer profiles");
        } finally {
            setCrmLoading(false);
        }
    };

    useEffect(() => {
        if (showAttachCRMModal) {
            const timer = setTimeout(() => {
                loadCrmMembers(crmSearchTerm);
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [showAttachCRMModal, crmSearchTerm]);

    const handleSelectCrmCustomer = async (member) => {
        if (!member?.id) return;
        let fullMember = member;
        try {
            const { data, error } = await supabase.rpc('get_member_tier_details', { p_user_id: member.id });
            if (!error && data && data.length > 0) {
                fullMember = { ...member, ...data[0] };
            }
        } catch (e) {
            console.warn("Failed to fetch member tier details on select:", e);
        }
        setAttachedMemberCrm(fullMember);
        let bookingId = activeBooking?.id;

        if (!bookingId) {
            if (selectedTable) {
                const newBooking = await createWalkIn(selectedTable, null, member.id);
                if (newBooking) {
                    bookingId = newBooking.id;
                    setActiveBooking({ ...newBooking, user_id: member.id, profiles: fullMember });
                    await attachCustomerToBooking(bookingId, member.id);
                }
            } else {
                setActiveBooking({ id: null, user_id: member.id, profiles: fullMember, booking_type: 'pickup', pax: 1 });
                setShowAttachCRMModal(false);
                toast.success(`ผูกสมาชิก: ${fullMember.display_name || fullMember.phone || 'Customer'}`);
                return;
            }
        } else {
            const success = await attachCustomerToBooking(bookingId, member.id);
            if (success) {
                let updatedBooking = null;
                if (selectedTable?.id) {
                    updatedBooking = await getActiveBooking(selectedTable.id);
                } else if (!String(bookingId).startsWith('local_')) {
                    const { data } = await supabase
                        .from('bookings')
                        .select('*, tables_layout(*), profiles(*), order_items(*, menu_items(name, category_id, is_drink_stamp_eligible, menu_categories(name, is_drink_stamp_eligible)))')
                        .eq('id', bookingId)
                        .maybeSingle();
                    updatedBooking = data;
                }
                if (updatedBooking) {
                    setActiveBooking({ ...updatedBooking, user_id: member.id, profiles: { ...updatedBooking.profiles, ...fullMember } });
                } else {
                    setActiveBooking(prev => prev ? { ...prev, user_id: member.id, profiles: { ...prev.profiles, ...fullMember } } : prev);
                }
            }
            setShowAttachCRMModal(false);
        }
    };

    const filteredCrmMembers = useMemo(() => {
        if (!crmSearchTerm) return crmMembers.slice(0, 50);
        const term = crmSearchTerm.toLowerCase();
        return crmMembers.filter(m => {
            const nameMatch = (m.display_name || '').toLowerCase().includes(term);
            const phoneMatch = (m.phone_number || m.phone || '').toLowerCase().includes(term);
            const nickMatch = (m.nickname || '').toLowerCase().includes(term);
            return nameMatch || phoneMatch || nickMatch;
        }).slice(0, 50);
    }, [crmMembers, crmSearchTerm]);

    const loadStaff = async () => {
        try {
            const { data: rpcStaff, error: rpcError } = await supabase.rpc('get_staff_list_safe');
            if (!rpcError && rpcStaff && rpcStaff.length > 0) {
                setStaffList(rpcStaff);
                return;
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('id, display_name, role')
                .in('role', ['staff', 'admin', 'manager', 'cashier', 'kitchen', 'owner']);
            
            if (!error && data && data.length > 0) {
                setStaffList(data);
            } else {
                const DEFAULT_STAFF = [
                    { id: 'default_1', display_name: 'แคชเชียร์ A (Cashier A)', role: 'staff' },
                    { id: 'default_2', display_name: 'แคชเชียร์ B (Cashier B)', role: 'staff' },
                    { id: 'default_3', display_name: 'ผู้จัดการ (Manager)', role: 'admin' }
                ];
                setStaffList(DEFAULT_STAFF);
            }
        } catch (err) {
            console.error("Failed to load staff profiles:", err);
            const DEFAULT_STAFF = [
                { id: 'default_1', display_name: 'แคชเชียร์ A (Cashier A)', role: 'staff' },
                { id: 'default_2', display_name: 'แคชเชียร์ B (Cashier B)', role: 'staff' },
                { id: 'default_3', display_name: 'ผู้จัดการ (Manager)', role: 'admin' }
            ];
            setStaffList(DEFAULT_STAFF);
        }
    };

    // Offline Queue Drawer State
    const [showOfflineQueueDrawer, setShowOfflineQueueDrawer] = useState(false);

    useEffect(() => {
        // Fetch current session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setHasSession(!!session);
        });

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setHasSession(!!session);
            loadStaff();
        });

        loadStaff();

        checkAndRestoreActiveShift().then(restored => {
            if (restored) {
                setActiveShift(restored);
            }
        });

        const handleShiftChanged = () => {
            setActiveShift(getCurrentShift());
        };
        const handleTriggerClose = async () => {
            const fresh = await checkAndRestoreActiveShift();
            if (fresh) setActiveShift(fresh);
            setShowCloseShiftModal(true);
        };
        const handleTriggerCashAdj = () => {
            setShowCashAdjustmentModal(true);
        };
        const handleTriggerLock = () => {
            lockScreen();
        };
        const handleTriggerOfflineDrawer = () => {
            setShowOfflineQueueDrawer(true);
        };

        window.addEventListener('pos-shift-changed', handleShiftChanged);
        window.addEventListener('pos-trigger-close-shift', handleTriggerClose);
        window.addEventListener('pos-trigger-cash-adjustment', handleTriggerCashAdj);
        window.addEventListener('pos-trigger-lock', handleTriggerLock);
        window.addEventListener('pos-trigger-offline-drawer', handleTriggerOfflineDrawer);

        return () => {
            subscription.unsubscribe();
            window.removeEventListener('pos-shift-changed', handleShiftChanged);
            window.removeEventListener('pos-trigger-close-shift', handleTriggerClose);
            window.removeEventListener('pos-trigger-cash-adjustment', handleTriggerCashAdj);
            window.removeEventListener('pos-trigger-lock', handleTriggerLock);
            window.removeEventListener('pos-trigger-offline-drawer', handleTriggerOfflineDrawer);
        };
    }, []);

    const activeShiftRef = useRef(activeShift);
    useEffect(() => {
        activeShiftRef.current = activeShift;
    }, [activeShift]);

    const shiftSummaryDebounceRef = useRef(null);

    const fetchRealtimeSummary = useCallback(async () => {
        const currentShift = getCurrentShift() || activeShiftRef.current;
        if (!currentShift || !currentShift.openedAt) {
            setRealtimeShiftSummary(null);
            return;
        }
        try {
            const openedAt = currentShift.openedAt;
            const { data, error } = await supabase
                .from('bookings')
                .select('id, status, total_amount, discount_amount, staff_remark, customer_note, payment_slip_url, booking_time, updated_at')
                .eq('status', 'completed')
                .gte('booking_time', openedAt);

            if (error) throw error;

            const metrics = calculateShiftMetrics(currentShift, data || []);
            setRealtimeShiftSummary(metrics);
        } catch (err) {
            console.error("Failed to fetch realtime shift summary:", err);
            const currentShift = getCurrentShift() || activeShiftRef.current;
            const metrics = calculateShiftMetrics(currentShift, []);
            let fallbackCash = 0, fallbackQr = 0, fallbackCredit = 0;
            (currentShift.transactions || []).forEach(tx => {
                const amt = Number(tx.amount) || 0;
                if (tx.paymentMethod === 'cash') fallbackCash += amt;
                else if (tx.paymentMethod === 'credit') fallbackCredit += amt;
                else fallbackQr += amt;
            });
            metrics.cashSales = Math.max(metrics.cashSales, fallbackCash);
            metrics.qrSales = Math.max(metrics.qrSales, fallbackQr);
            metrics.creditSales = Math.max(metrics.creditSales, fallbackCredit);
            metrics.totalSales = metrics.cashSales + metrics.qrSales + metrics.creditSales;
            metrics.expectedCash = metrics.openingFloat + metrics.cashSales + metrics.totalIn - metrics.totalOut;
            setRealtimeShiftSummary(metrics);
        }
    }, []);

    const triggerDebouncedShiftSummary = useCallback(() => {
        if (shiftSummaryDebounceRef.current) clearTimeout(shiftSummaryDebounceRef.current);
        shiftSummaryDebounceRef.current = setTimeout(() => {
            fetchRealtimeSummary();
        }, 500);
    }, [fetchRealtimeSummary]);

    useEffect(() => {
        fetchRealtimeSummary();

        // Realtime Subscription: Instant update when any booking or shift changes
        const shiftSyncChannel = supabase.channel('pos-shift-realtime-dashboard')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
                triggerDebouncedShiftSummary();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_shifts' }, () => {
                checkAndRestoreActiveShift().then(fresh => {
                    if (fresh) setActiveShift(fresh);
                    triggerDebouncedShiftSummary();
                });
            })
            .subscribe();

        const handleLocalTx = () => {
            const fresh = getCurrentShift();
            if (fresh) setActiveShift(fresh);
            triggerDebouncedShiftSummary();
        };
        window.addEventListener('pos-shift-changed', handleLocalTx);
        return () => {
            if (shiftSummaryDebounceRef.current) clearTimeout(shiftSummaryDebounceRef.current);
            supabase.removeChannel(shiftSyncChannel);
            window.removeEventListener('pos-shift-changed', handleLocalTx);
        };
    }, [fetchRealtimeSummary, triggerDebouncedShiftSummary]);

    // Force re-sync when opening Close Shift modal
    useEffect(() => {
        if (showCloseShiftModal && activeShift) {
            checkAndRestoreActiveShift().then(fresh => {
                if (fresh) setActiveShift(fresh);
            });
        }
    }, [showCloseShiftModal]);

    const getShiftSummary = () => {
        const currentShift = getCurrentShift() || activeShift;
        if (!currentShift) return { cashSales: 0, qrSales: 0, creditSales: 0, totalSales: 0, expectedCash: 0, totalIn: 0, totalOut: 0, openingFloat: 0 };

        const adjustments = Array.isArray(currentShift.adjustments) ? currentShift.adjustments : [];
        const totalIn = adjustments.filter(a => a.type === 'in').reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
        const totalOut = adjustments.filter(a => a.type === 'out').reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
        const openingFloat = Number(currentShift.openingFloat || 0);

        let cashSales = 0, qrSales = 0, creditSales = 0;
        if (realtimeShiftSummary) {
            cashSales = Number(realtimeShiftSummary.cashSales || 0);
            qrSales = Number(realtimeShiftSummary.qrSales || 0);
            creditSales = Number(realtimeShiftSummary.creditSales || 0);
        } else {
            (currentShift.transactions || []).forEach(tx => {
                const amt = Number(tx.amount || 0);
                if (tx.paymentMethod === 'cash') cashSales += amt;
                else if (tx.paymentMethod === 'credit') creditSales += amt;
                else qrSales += amt;
            });
        }

        return {
            cashSales,
            qrSales,
            creditSales,
            totalSales: cashSales + qrSales + creditSales,
            openingFloat,
            totalIn,
            totalOut,
            expectedCash: openingFloat + cashSales + totalIn - totalOut
        };
    };

    const handleStartShiftSubmit = (e) => {
        e.preventDefault();
        if (!openShiftForm.staffName.trim()) {
            toast.error('กรุณาระบุชื่อพนักงานเพื่อเปิดรอบ');
            return;
        }
        const newShift = startShift(openShiftForm.staffName.trim(), openShiftForm.openingFloat);
        if (newShift) setActiveShift(newShift);
        toast.success(`เปิดรอบการขายสำเร็จ: พนักงาน ${openShiftForm.staffName}`);
    };

    const handleCloseShiftSubmit = async (e) => {
        e.preventDefault();
        const currentShift = getCurrentShift() || activeShift;
        const actual = parseFloat(closeShiftForm.actualCash) || 0;
        
        const toastId = toast.loading('กำลังปิดกะและพิมพ์รายงาน...');
        
        try {
            // 1. Fetch bookings in this shift (matching booking_time OR updated_at completed in this shift)
            let bookingsData = [];
            
            if (isOnline()) {
                const nowIso = new Date().toISOString();
                const { data } = await supabase
                    .from('bookings')
                    .select(`
                        *,
                        tables_layout (table_name),
                        order_items (
                            id,
                            quantity,
                            price_at_time,
                            menu_item_id,
                            status,
                            destination,
                            custom_name,
                            menu_items (
                                name,
                                category_id
                            )
                        )
                    `)
                    .eq('status', 'completed')
                    .gte('booking_time', currentShift.openedAt)
                    .lte('booking_time', nowIso);
                bookingsData = data || [];
            }
            
            // 2. Fetch categories
            let categoriesData = [];
            if (isOnline()) {
                const { data } = await supabase
                    .from('menu_categories')
                    .select('id, name');
                categoriesData = data || [];
            }
            
            // 3. Compute accurate shift metrics
            const accurateSummary = calculateShiftMetrics(currentShift, bookingsData);

            // 4. Compile reportData
            const compiledReport = compileShiftReportData(
                {
                    ...currentShift,
                    expectedCash: accurateSummary.expectedCash,
                    closedCash: actual,
                    actualCash: actual,
                    difference: actual - accurateSummary.expectedCash,
                    cashSales: accurateSummary.cashSales,
                    qrSales: accurateSummary.qrSales,
                    creditSales: accurateSummary.creditSales,
                    totalSales: accurateSummary.totalSales,
                    totalIn: accurateSummary.totalIn,
                    totalOut: accurateSummary.totalOut
                },
                bookingsData,
                categoriesData
            );
            
            // 5. Print shift report to SUNMI
            let reportPaperSize = '80mm';
            try {
                const storedCfg = localStorage.getItem('onhaus_printer_config');
                if (storedCfg) {
                    const cfg = JSON.parse(storedCfg);
                    reportPaperSize = cfg.cashier_paper_size || cfg.paper_width || '80mm';
                }
            } catch (e) {}

            const rawBytes = encodeShiftClosureReportData(compiledReport, reportPaperSize, 'sunmi');
            const printRes = await printToSunmiBuiltIn(rawBytes);
            
            // 6. Close shift locally & cloud with accurate summary
            closeShift(actual, accurateSummary);
            localStorage.removeItem('pos_active_staff');
            setActiveStaff(null);
            setIsPinVerified(false);
            localStorage.removeItem('pos_is_locked');
            setIsLocked(false);
            setShowCloseShiftModal(false);
            setCloseShiftForm({ actualCash: '' });
            
            toast.dismiss(toastId);
            toast.success('ปิดรอบการทำงานและบันทึกประวัติสำเร็จแล้ว');
            if (printRes) {
                toast.success('พิมพ์ใบสรุปยอดปิดกะเรียบร้อยแล้ว');
            }
        } catch (err) {
            console.error("Failed to close shift or print:", err);
            toast.dismiss(toastId);
            
            // Fallback close shift locally in case of error
            try {
                const summary = getShiftSummary();
                closeShift(actual, summary);
                localStorage.removeItem('pos_active_staff');
                setActiveStaff(null);
                setIsPinVerified(false);
                localStorage.removeItem('pos_is_locked');
                setIsLocked(false);
                setShowCloseShiftModal(false);
                setCloseShiftForm({ actualCash: '' });
                toast.success('ปิดรอบการทำงานสำเร็จ (เกิดข้อผิดพลาดในการดึงข้อมูลพิมพ์)');
            } catch (closeErr) {
                toast.error('ไม่สามารถปิดรอบการทำงานได้: ' + closeErr.message);
            }
        }
    };

    const handleCashAdjustmentSubmit = (e) => {
        e.preventDefault();
        const amount = parseFloat(cashAdjustmentForm.amount) || 0;
        if (amount <= 0) {
            toast.error('กรุณาระบุจำนวนเงินที่ถูกต้อง');
            return;
        }
        if (!cashAdjustmentForm.note.trim()) {
            toast.error('กรุณาระบุเหตุผลการเบิกจ่าย/นำฝาก');
            return;
        }
        
        const updated = addShiftAdjustment(amount, cashAdjustmentForm.note.trim(), cashAdjustmentForm.type);
        if (updated) {
            setActiveShift(updated);
        }
        toast.success(`บันทึกรายการสำเร็จ: ${cashAdjustmentForm.type === 'in' ? 'นำฝากเงินสด' : 'เบิกจ่ายเงินสด'} ฿${amount.toLocaleString()}`);
        setShowCashAdjustmentModal(false);
        setCashAdjustmentForm({ amount: '', note: '', type: 'out' });
    };

    const autoPrintedQrKeysRef = useRef(new Set(JSON.parse(localStorage.getItem('pos_auto_printed_qr_keys') || '[]')));

    const markQrKeyAsPrinted = (key) => {
        autoPrintedQrKeysRef.current.add(key);
        const arr = Array.from(autoPrintedQrKeysRef.current).slice(-200);
        localStorage.setItem('pos_auto_printed_qr_keys', JSON.stringify(arr));
    };

    const handleAutoPrintQROrder = async (bookingId, tableNameHint = 'TABLE') => {
        if (!bookingId) return;
        if (processingQrPrintRef.current.has(bookingId)) return;
        processingQrPrintRef.current.add(bookingId);
        try {
            const { data: fullBooking } = await supabase
                .from('bookings')
                .select('*, tables_layout(*), profiles(*), order_items(*, menu_items(name, category_id, is_drink_stamp_eligible, menu_categories(name, is_drink_stamp_eligible)))')
                .eq('id', bookingId)
                .maybeSingle();

            if (!fullBooking || !fullBooking.order_items || fullBooking.order_items.length === 0) return;

            const remarkStr = (fullBooking.staff_remark || '').toLowerCase();
            const isQrOrder = remarkStr.includes('qr walk-in') || remarkStr.includes('qr') || fullBooking.source === 'online' || fullBooking.source === 'qr';
            if (!isQrOrder) return;

            // Auto-accept if status was pending (change to seated so staff doesn't have to press accept)
            if (fullBooking.status === 'pending') {
                await supabase.from('bookings').update({ status: 'seated' }).eq('id', bookingId);
                fullBooking.status = 'seated';
            }

            // Get already printed items for this booking
            const storageKey = `qr_printed_items_${bookingId}`;
            let printedItems = [];
            try {
                printedItems = JSON.parse(localStorage.getItem(storageKey) || '[]');
            } catch (e) {}

            // Find new items that haven't been printed yet
            const unprintedItems = fullBooking.order_items.filter(item => item.id && !printedItems.includes(item.id));

            if (unprintedItems.length > 0) {
                // Update tracker immediately to prevent duplicate fires
                const newPrintedItems = Array.from(new Set([...printedItems, ...unprintedItems.map(i => i.id).filter(Boolean)]));
                localStorage.setItem(storageKey, JSON.stringify(newPrintedItems));
                
                // Construct a temporary booking object that ONLY contains the unprinted items for the printer
                const partialBooking = {
                    ...fullBooking,
                    order_items: unprintedItems
                };

                const displayTable = fullBooking.tables_layout?.table_name || tableNameHint;
                toast.success(`🛎️ ออเดอร์ QR โต๊ะ ${displayTable} - เพิ่ม ${unprintedItems.length} รายการ (พิมพ์ใบครัวอัตโนมัติแล้ว)`, {
                    duration: 10000,
                    action: {
                        label: 'ดูรายการ',
                        onClick: () => {
                            supabase.from('tables_layout').select('*').eq('id', fullBooking.table_id).single().then(({ data }) => {
                                if (data) handleSelectTable(data);
                            });
                        }
                    }
                });
                playQRAlertSound();

                await autoPrintQROrder(partialBooking);
            }
        } catch (err) {
            console.error("Auto print QR order error:", err);
        } finally {
            setTimeout(() => {
                processingQrPrintRef.current.delete(bookingId);
            }, 1500);
        }
    };

    const refreshActiveBookingItems = async (bookingId) => {
        if (!bookingId) return;
        if (activeBookingRef.current?.id !== bookingId) return;
        try {
            const { data: latestBooking, error } = await supabase
                .from('bookings')
                .select('*, tables_layout(*), profiles(*), order_items(*, menu_items(name, category_id, is_drink_stamp_eligible, menu_categories(name, is_drink_stamp_eligible)))')
                .eq('id', bookingId)
                .maybeSingle();

            if (error || !latestBooking) return;

            if (activeBookingRef.current?.id === bookingId) {
                setActiveBooking(latestBooking);

                const dbItems = (latestBooking.order_items || []).map(formatDbOrderItemToCart).filter(Boolean);

                // Preserve local draft items currently being entered by staff
                setCurrentOrder(prev => {
                    const localDraftItems = (prev.items || []).filter(i => !i.db_id);
                    return {
                        ...prev,
                        items: [...dbItems, ...localDraftItems]
                    };
                });
            }
        } catch (err) {
            console.warn('[refreshActiveBookingItems] Failed to sync latest items:', err);
        }
    };

    const checkPendingOrders = async () => {
        try {
            const today = new Date();
            const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).toISOString();

            const { data: pendingData, error } = await supabase
                .from('bookings')
                .select(`
                    id, tracking_token, table_id, booking_type, booking_time, created_at, status, source, staff_remark,
                    customer_note, pax, deposit_amount, total_amount, payment_slip_url,
                    slip_verified, slip_provider, slip_trans_ref, slip_verification_status,
                    pickup_contact_name, pickup_contact_phone,
                    profiles (display_name, phone_number),
                    tables_layout (table_name),
                    order_items (id, quantity, price_at_time, custom_name, menu_items (name))
                `)
                .in('status', ['pending', 'confirmed'])
                .or(`booking_time.gte.${startOfToday},created_at.gte.${startOfToday}`)
                .order('booking_time', { ascending: false });
            
            if (!error && pendingData) {
                // Filter relevant orders: pending bookings + incoming online pickup waiting for staff approval or slip review
                const pendingOnly = pendingData.filter(b => {
                    const sourceLower = (b.source || '').toLowerCase();
                    const remarkLower = (b.staff_remark || '').toLowerCase();
                    const isLineman = sourceLower === 'lineman' || remarkLower.includes('lineman');
                    const hasOnlineMarker = sourceLower === 'online' || sourceLower === 'line' || remarkLower.includes('[online_pickup]') || remarkLower.includes('easyslip') || !!b.payment_slip_url || (b.order_type || '').startsWith('hausmade');
                    const isExplicitInHouse = !isLineman && !hasOnlineMarker && (sourceLower === 'pos' || sourceLower === 'walk_in' || remarkLower.includes('walk-in') || remarkLower.includes('walk in') || b.booking_type === 'walk_in');
                    if (isExplicitInHouse) return false;

                    // All pending status orders require staff approval
                    if (b.status === 'pending') return true;

                    // If confirmed but has attached slip that is not yet verified or staff remark lacks acknowledgment
                    const hasSlip = !!b.payment_slip_url;
                    const isStaffVerified = remarkLower.includes('[slip_verified]') || remarkLower.includes('[staff_confirmed]') || remarkLower.includes('[staff_accepted]');
                    const isEasySlipVerified = Boolean(b.slip_verified || remarkLower.includes('easyslip'));
                    if (hasSlip && !isStaffVerified && !isEasySlipVerified) return true;

                    return false;
                });

                setPendingBookingsList(pendingOnly);
                const count = pendingOnly.length;
                const hasPending = count > 0;
                setHasPendingOrders(hasPending);

                // Calculate online/pickup/slip pending count for sidebar badge
                const onlineCount = pendingOnly.filter(b => {
                    const sourceLower = (b.source || '').toLowerCase();
                    const remarkLower = (b.staff_remark || '').toLowerCase();
                    const nameLower = (b.profiles?.display_name || b.pickup_contact_name || b.customer_name || '').toLowerCase();
                    const isLineman = sourceLower === 'lineman' || remarkLower.includes('lineman') || nameLower.includes('line man') || nameLower.startsWith('lm-');
                    const hasOnlineMarker = sourceLower === 'online' || sourceLower === 'line' || remarkLower.includes('[online_pickup]') || remarkLower.includes('easyslip') || !!b.payment_slip_url || (b.order_type || '').startsWith('hausmade');
                    const isExplicitInHouse = !isLineman && !hasOnlineMarker && (sourceLower === 'pos' || sourceLower === 'walk_in' || remarkLower.includes('walk-in') || remarkLower.includes('walk in') || b.booking_type === 'walk_in');
                    if (isExplicitInHouse) return false;
                    const isOnline = isLineman || hasOnlineMarker || ((b.booking_type === 'pickup' || b.order_type === 'hausmade_pickup') && !isExplicitInHouse);
                    return isOnline;
                }).length;
                setOnlinePendingCount(onlineCount);

                // Auto trigger pop-up overlay if new pending bookings arrive
                if (count !== prevPendingCountRef.current) {
                    if (count > prevPendingCountRef.current) {
                        setShowPendingModal(true);
                    }
                    prevPendingCountRef.current = count;
                    setRefreshKey(prev => prev + 1);
                }
            }
        } catch (err) {
            console.error("Check pending orders failed:", err);
        }
    };

    useEffect(() => {
        // Request Screen Wake Lock for POS Android APK / Tablet
        requestWakeLock().catch(() => {});

        // Init online printer & slip config sync (pulls online master config & listens for realtime updates)
        const cleanupPrinterSync = initPrinterConfigSync();

        // 1. Initial pending orders check
        checkPendingOrders();

        // Android Foreground Wakeup / Network Reconnect Listener
        const handleForegroundWakeup = () => {
            if (document.visibilityState === 'visible') {
                console.log('⚡ [POS Lifecycle] App foregrounded. Synchronizing data & audio...');
                unlockAudioEngine();
                checkPendingOrders();
                triggerDebouncedRefresh();
            }
        };

        const handleOnlineStatus = () => {
            console.log('⚡ [POS Network] Network restored online. Synchronizing...');
            unlockAudioEngine();
            checkPendingOrders();
            triggerDebouncedRefresh();
        };

        document.addEventListener('visibilitychange', handleForegroundWakeup);
        window.addEventListener('focus', handleForegroundWakeup);
        window.addEventListener('pageshow', handleForegroundWakeup);
        window.addEventListener('online', handleOnlineStatus);

        // Adaptive 60-second backup heartbeat (safety net only)
        const pollInterval = setInterval(checkPendingOrders, 60000);

        // Realtime sync: Auto-update draft cart item prices when menu items change
        const handlePosMenuUpdated = (e) => {
            const updatedMenuItems = e.detail?.items || [];
            if (!updatedMenuItems || updatedMenuItems.length === 0) return;
            
            const priceMap = new Map();
            updatedMenuItems.forEach(item => {
                priceMap.set(item.id, parseFloat(item.price) || 0);
            });

            setCurrentOrder(prev => {
                if (!prev?.items || prev.items.length === 0) return prev;
                let hasChanges = false;
                const newItems = prev.items.map(cartItem => {
                    // Only update unsubmitted draft items without db_id or is_reward
                    if (cartItem.db_id || cartItem.is_reward) return cartItem;
                    const lookupId = cartItem.menu_item_id || cartItem.id;
                    if (priceMap.has(lookupId)) {
                        const newPrice = priceMap.get(lookupId);
                        if (cartItem.price !== newPrice) {
                            hasChanges = true;
                            return { ...cartItem, price: newPrice };
                        }
                    }
                    return cartItem;
                });
                return hasChanges ? { ...prev, items: newItems } : prev;
            });
        };
        window.addEventListener('pos-menu-updated', handlePosMenuUpdated);

        // Global native WMA / LINE MAN bridge order listener
        const handleWmaOrderGlobal = (event) => {
            const b = event.detail?.booking;
            if (b) {
                const eventKey = `wma_dashboard_${b.id || Date.now()}`;
                if (checkEventDeduplication(eventKey, 4000)) {
                    playOrderAlert(eventKey, 1200, 3.4);
                    toast.custom((t) => renderPosToast(t, {
                        badge: 'LINE MAN / WMA · ออเดอร์เข้าใหม่',
                        title: `LINE MAN #${getShortBookingId(b)} สั่งอาหารเข้ามาแล้ว`,
                        subtitle: 'แตะเพื่อเปิดดูใน Online Hub',
                        dot: 'emerald',
                        onClick: () => setView('online_hub')
                    }), { id: eventKey, duration: 10000 });
                    setShowPendingModal(true);
                    checkPendingOrders();
                    triggerDebouncedRefresh();
                }
            }
        };
        window.addEventListener('wma_order_received', handleWmaOrderGlobal);

        return () => {
            clearInterval(pollInterval);
            document.removeEventListener('visibilitychange', handleForegroundWakeup);
            window.removeEventListener('focus', handleForegroundWakeup);
            window.removeEventListener('pageshow', handleForegroundWakeup);
            window.removeEventListener('online', handleOnlineStatus);
            window.removeEventListener('pos-menu-updated', handlePosMenuUpdated);
            window.removeEventListener('wma_order_received', handleWmaOrderGlobal);
            if (cleanupPrinterSync) cleanupPrinterSync();
        };
    }, [requestWakeLock, triggerDebouncedRefresh]);

    const [attachedMemberCrm, setAttachedMemberCrm] = useState(null);

    const handleDetachCrmCustomer = useCallback(() => {
        setAttachedMemberCrm(null);
        if (activeBooking && activeBooking.id) {
            setActiveBooking(prev => prev ? { ...prev, user_id: null, profiles: null } : prev);
        }
        toast.info("ยกเลิกการผูกสมาชิกแล้ว");
    }, [activeBooking]);

    useEffect(() => {
        const fetchAttachedMemberCrm = async () => {
            if (!activeBooking) {
                return; // Preserve attached member for Walk-in drafts
            }
            if (!activeBooking.user_id) {
                // If user attached member manually in draft state, keep it. Only clear if switching active booking with no user_id
                if (activeBooking.id && attachedMemberCrm && attachedMemberCrm.id !== activeBooking.user_id) {
                    setAttachedMemberCrm(null);
                }
                return;
            }
            try {
                let profileData = activeBooking.profiles;
                if (!profileData) {
                    const { data: pData } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', activeBooking.user_id)
                        .maybeSingle();
                    profileData = pData;
                }
                const { data, error } = await supabase.rpc('get_member_tier_details', { p_user_id: activeBooking.user_id });
                if (profileData) {
                    const tierDetails = (!error && data && data.length > 0) ? data[0] : {};
                    setAttachedMemberCrm({ ...profileData, ...tierDetails });
                } else if (!error && data && data.length > 0) {
                    setAttachedMemberCrm({ id: activeBooking.user_id, ...data[0] });
                }
            } catch (err) {
                console.error("Failed to load attached member CRM:", err);
            }
        };
        fetchAttachedMemberCrm();
    }, [activeBooking]);

    // Repeating Sound Alert when pending orders exist & modal is shown (instant stop when modal is closed or orders accepted)
    useEffect(() => {
        if (!hasPendingOrders || !showPendingModal) return;

        // Play high-impact order alert with noti1.mp3
        playOrderAlert('pending_orders_loop', 1000, 3.2);

        // Repeat every 15 seconds if pending modal remains open & unhandled (capped to 2 repeats to prevent infinite ringing)
        let repeatCount = 0;
        const soundInterval = setInterval(() => {
            repeatCount++;
            if (repeatCount >= 2) {
                clearInterval(soundInterval);
                return;
            }
            playOrderAlert('pending_orders_loop', 1000, 3.2);
        }, 15000);

        return () => {
            clearInterval(soundInterval);
        };
    }, [hasPendingOrders, showPendingModal]);

    const playSystemAlertSound = (eventKey = null) => {
        playOrderAlert(eventKey, 800, 3.2);
    };

    const playQRAlertSound = () => {
        playDoorbellAlert('qr_doorbell');
    };

    const renderPosToast = (t, {
        badge,
        title,
        subtitle = 'แตะเพื่อเปิดดูข้อมูล',
        dot = 'emerald',
        onClick
    }) => {
        const dotColor = dot === 'terracotta'
            ? 'bg-[oklch(52%_0.16_28)]'
            : dot === 'neutral'
                ? 'bg-[oklch(42%_0.010_28)]'
                : 'bg-emerald-500';

        const hoverBorder = dot === 'terracotta'
            ? 'hover:border-[oklch(52%_0.16_28)]'
            : 'hover:border-[oklch(45%_0.08_140)]';

        return (
            <div 
                className={`w-full max-w-[340px] bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-xl p-3.5 shadow-xl flex flex-col gap-2 font-sans select-none transition-all duration-150 cursor-pointer active:scale-[0.98] ${hoverBorder}`}
                onClick={() => {
                    toast.dismiss(t);
                    if (onClick) onClick();
                }}
            >
                <div className="flex justify-between items-center border-b border-[oklch(85%_0.012_28)]/80 pb-1.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[oklch(42%_0.010_28)]">
                        {badge}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${dotColor} animate-pulse shrink-0`} />
                </div>
                <div className="text-sm font-bold text-[oklch(18%_0.012_28)] leading-snug">
                    {title}
                </div>
                {subtitle && (
                    <div className="text-[11px] font-mono text-[oklch(55%_0.010_28)] flex items-center justify-between pt-0.5">
                        <span>{subtitle}</span>
                        <span className="text-[10px] text-[oklch(42%_0.010_28)] opacity-60">✕ ปิด</span>
                    </div>
                )}
            </div>
        );
    };

    useEffect(() => {
        let tablesMap = {};
        let activeChannel = null;
        let reconnectTimer = null;
        let isUnmounted = false;

        const loadTablesMap = async () => {
            try {
                const { data } = await supabase.from('tables_layout').select('id, table_name');
                if (data && !isUnmounted) {
                    data.forEach(t => {
                        tablesMap[t.id] = t.table_name;
                    });
                }
            } catch (e) {}
        };
        loadTablesMap();

        const setupMasterChannel = () => {
            if (isUnmounted) return;
            if (activeChannel) {
                try {
                    supabase.removeChannel(activeChannel);
                } catch (e) {}
            }

            const notifyChannel = supabase.channel('pos-realtime-notifications')
                .on('broadcast', { event: 'qr_order_created' }, async ({ payload }) => {
                    console.log('⚡ [Realtime POS] Instant broadcast qr_order_created received:', payload);
                    const bId = payload?.booking_id;
                    const tId = payload?.table_id;
                    const tName = payload?.table_name || (tId ? tablesMap[tId] : null) || `โต๊ะ #${tId || ''}`;
                    const qrItemAlertKey = `order_items_${bId || tId}`;

                    if (checkEventDeduplication(qrItemAlertKey, 4500)) {
                        console.log(`🔊 [POS Alert] Instant chime for QR order: ${bId}`);
                        playOrderAlert(qrItemAlertKey, 1200, 3.4);
                        toast.custom((t) => renderPosToast(t, {
                            badge: 'QR ORDER · ออเดอร์เข้าใหม่',
                            title: `โต๊ะ ${tName} สั่งอาหารผ่าน QR Code เข้ามาแล้ว`,
                            subtitle: 'แตะเพื่อเปิดดูโต๊ะนี้',
                            dot: 'emerald',
                            onClick: () => {
                                if (tId) {
                                    supabase.from('tables_layout').select('*').eq('id', tId).single().then(({ data }) => {
                                        if (data) handleSelectTable(data);
                                    });
                                }
                            }
                        }), { id: qrItemAlertKey, duration: 10000 });
                        pushNotifHistory('ORDER', 'QR Order', `โต๊ะ ${tName} สั่งอาหารผ่าน QR Code เข้ามาแล้ว`, tId);
                    } else {
                        // Still trigger single chime for simultaneous burst if cooldown hasn't sounded
                        playOrderAlert(qrItemAlertKey, 1200, 3.4);
                    }

                    if (bId) {
                        if (window.autoPrintDebounceTimer) {
                            clearTimeout(window.autoPrintDebounceTimer);
                        }
                        window.autoPrintDebounceTimer = setTimeout(() => {
                            handleAutoPrintQROrder(bId, tName);
                        }, 400);
                    }

                    // If currently viewing this table, sync order items immediately
                    if (activeBookingRef.current?.id === bId) {
                        refreshActiveBookingItems(bId);
                    }

                    checkPendingOrders();
                    triggerDebouncedRefresh();
                })
                .on('broadcast', { event: 'call_staff' }, async ({ payload }) => {
                    console.log('⚡ [Realtime POS] Instant broadcast call_staff received:', payload);
                    const tId = payload?.table_id;
                    const bId = payload?.booking_id || tId;
                    const tName = payload?.table_name || (tId ? tablesMap[tId] : null) || `โต๊ะ #${tId || ''}`;
                    const callStaffKey = `${bId}_CALL_STAFF`;

                    if (checkEventDeduplication(callStaffKey, 5000)) {
                        toast.custom((t) => renderPosToast(t, {
                            badge: 'CALL STAFF · เรียกพนักงาน',
                            title: `โต๊ะ ${tName} เรียกพนักงาน`,
                            subtitle: 'แตะเพื่อเปิดดูโต๊ะนี้',
                            dot: 'terracotta',
                            onClick: () => {
                                if (tId) {
                                    supabase.from('tables_layout').select('*').eq('id', tId).single().then(({ data }) => {
                                        if (data) handleSelectTable(data);
                                    });
                                }
                            }
                        }), { id: callStaffKey, duration: 10000 });
                        pushNotifHistory('CALL_STAFF', 'Call Staff', `โต๊ะ ${tName} เรียกพนักงาน`, tId);
                        playStaffCallAlert(callStaffKey);
                    }
                    checkPendingOrders();
                    triggerDebouncedRefresh();
                })
                .on('broadcast', { event: 'call_bill' }, async ({ payload }) => {
                    console.log('⚡ [Realtime POS] Instant broadcast call_bill received:', payload);
                    const tId = payload?.table_id;
                    const bId = payload?.booking_id || tId;
                    const tName = payload?.table_name || (tId ? tablesMap[tId] : null) || `โต๊ะ #${tId || ''}`;
                    const callBillKey = `${bId}_CALL_BILL`;

                    if (checkEventDeduplication(callBillKey, 5000)) {
                        toast.custom((t) => renderPosToast(t, {
                            badge: 'CALL BILL · เรียกเช็คบิล',
                            title: `โต๊ะ ${tName} เรียกเช็คบิล`,
                            subtitle: 'แตะเพื่อเปิดดูและเตรียมบิล',
                            dot: 'terracotta',
                            onClick: () => {
                                if (tId) {
                                    supabase.from('tables_layout').select('*').eq('id', tId).single().then(({ data }) => {
                                        if (data) handleSelectTable(data);
                                    });
                                }
                            }
                        }), { id: callBillKey, duration: 10000 });
                        pushNotifHistory('CALL_BILL', 'Call Bill', `โต๊ะ ${tName} เรียกเช็คบิล`, tId);
                        playBillAlert(callBillKey);
                    }
                    checkPendingOrders();
                    triggerDebouncedRefresh();
                })
                .on('broadcast', { event: 'online_order_created' }, async ({ payload }) => {
                    console.log('⚡ [Realtime POS] Instant broadcast online_order_created received:', payload);
                    const bId = payload?.booking_id;
                    const bType = payload?.booking_type || 'order';
                    const custName = payload?.customer_name || 'ลูกค้าออนไลน์';
                    const isPickup = bType === 'pickup';
                    const label = isPickup ? `รับกลับ: ${custName}` : `จองโต๊ะ: ${custName}`;
                    const eventKey = `online_order_${bId || Date.now()}`;

                    if (checkEventDeduplication(eventKey, 4500)) {
                        playOrderAlert(eventKey, 1200, 3.4);
                        toast.custom((t) => renderPosToast(t, {
                            badge: isPickup ? 'ONLINE PICKUP · สั่งรับกลับ' : 'ONLINE BOOKING · จองโต๊ะ',
                            title: `${label} เข้ามาใหม่ (฿${(payload?.total_amount || 0).toLocaleString()})`,
                            subtitle: 'แตะเพื่อเปิดดูใน Online Hub',
                            dot: 'terracotta',
                            onClick: () => {
                                setView('online_hub');
                            }
                        }), { id: eventKey, duration: 10000 });
                        pushNotifHistory('ONLINE_ORDER', isPickup ? 'Online Pickup' : 'Online Booking', `${label} ส่งเข้ามาใหม่ (฿${(payload?.total_amount || 0).toLocaleString()})`, null);
                        setShowPendingModal(true);
                    } else {
                        playOrderAlert(eventKey, 1200, 3.4);
                    }

                    checkPendingOrders();
                    triggerDebouncedRefresh();
                })
                .on('broadcast', { event: 'payment_slip_uploaded' }, async ({ payload }) => {
                    console.log('⚡ [Realtime POS] Instant broadcast payment_slip_uploaded received:', payload);
                    const bId = payload?.booking_id;
                    const slipEventKey = `slip_upload_${bId || Date.now()}`;
                    if (checkEventDeduplication(slipEventKey, 4500)) {
                        playSlipAlert(slipEventKey);
                        toast.custom((t) => renderPosToast(t, {
                            badge: 'PAYMENT SLIP · มีสลิปใหม่รอตรวจ',
                            title: `มีสลิปโอนเงินแนบเข้ามา (฿${(payload?.total_amount || 0).toLocaleString()})`,
                            subtitle: 'แตะเพื่อเปิดตรวจสลิปใน Online Hub',
                            dot: 'emerald',
                            onClick: () => {
                                setView('online_hub');
                            }
                        }), { id: slipEventKey, duration: 10000 });
                        pushNotifHistory('SLIP', 'Payment Uploaded', `มีสลิปโอนเงินแนบเข้ามา (฿${(payload?.total_amount || 0).toLocaleString()})`, null);
                        setShowPendingModal(true);
                    }
                    checkPendingOrders();
                    triggerDebouncedRefresh();
                })
                .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public', 
                    table: 'tables_layout' 
                }, () => {
                    triggerDebouncedRefresh();
                })
                .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public', 
                    table: 'bookings' 
                }, async (payload) => {
                    checkPendingOrders();
                    triggerDebouncedRefresh();
                    const { eventType, new: newRow, old: oldRow } = payload;
                    const bookingId = newRow?.id || oldRow?.id;
                    if (!bookingId) return;

                    const tableId = newRow?.table_id || oldRow?.table_id || null;
                    const sourceLower = (newRow?.source || oldRow?.source || '').toLowerCase();
                    const remarkLower = (newRow?.staff_remark || oldRow?.staff_remark || '').toLowerCase();
                    const isLineman = sourceLower === 'lineman' || remarkLower.includes('lineman');
                    const hasOnlineMarker = sourceLower === 'online' || sourceLower === 'line' || remarkLower.includes('[online_pickup]') || remarkLower.includes('easyslip') || !!newRow?.payment_slip_url || (newRow?.order_type || '').startsWith('hausmade');
                    const isExplicitInHouse = !isLineman && !hasOnlineMarker && (sourceLower === 'pos' || sourceLower === 'walk_in' || remarkLower.includes('walk-in') || remarkLower.includes('walk in') || newRow?.booking_type === 'walk_in');
                    
                    const isWalkInPickup = newRow?.booking_type === 'pickup' && isExplicitInHouse;
                    const isOnlinePickup = (newRow?.booking_type === 'pickup' || (!tableId && (sourceLower === 'online' || remarkLower.includes('[online_pickup]')))) && !isExplicitInHouse;
                    const isOnlineBooking = (sourceLower === 'online' || sourceLower === 'line' || remarkLower.includes('online')) && !isExplicitInHouse;
                    const tableName = tableId ? (tablesMap[tableId] || `Table #${tableId}`) : (isOnlinePickup || isWalkInPickup ? 'รับกลับ (Pickup)' : 'Online Order');

                    const callBillKey = `${bookingId}_CALL_BILL`;
                    const callStaffKey = `${bookingId}_CALL_STAFF`;
                    const pendingOrderKey = `${bookingId}_PENDING_ORDER`;
                    const slipReceivedKey = `${bookingId}_SLIP_RECEIVED`;

                    if (eventType === 'INSERT') {
                        // In-store walk-in pickup or walk-in table created right here at POS: do not fire online toast or modal
                        if (isWalkInPickup || isExplicitInHouse) {
                            return;
                        }

                        if (tableId && (remarkLower.includes('qr walk-in') || remarkLower.includes('qr') || sourceLower === 'online' || sourceLower === 'qr')) {
                            handleAutoPrintQROrder(bookingId, tableName);
                        }

                        if (newRow.status === 'pending' || sourceLower === 'qr' || remarkLower.includes('qr') || isOnlinePickup || isOnlineBooking || isLineman) {
                            if (checkEventDeduplication(pendingOrderKey, 4500)) {
                                const toastBadge = isOnlinePickup ? 'PICKUP ONLINE · รับกลับ' : (isOnlineBooking ? 'ONLINE BOOKING · จองโต๊ะ' : 'NEW ORDER · อาหารเข้าใหม่');
                                const toastTitle = isOnlinePickup 
                                    ? `ออเดอร์รับกลับ #${getShortBookingId(newRow)} ส่งเข้ามาแล้ว` 
                                    : (isOnlineBooking ? `จองโต๊ะ ${tableName} (${newRow.pickup_contact_name || newRow.customer_name || 'ลูกค้าออนไลน์'}) ส่งเข้ามาแล้ว` : `โต๊ะ ${tableName} สั่งอาหารเข้าห้องครัวแล้ว`);

                                toast.custom((t) => renderPosToast(t, {
                                    badge: toastBadge,
                                    title: toastTitle,
                                    subtitle: isOnlinePickup || isOnlineBooking ? 'แตะเพื่อเปิดดูใน Online Hub' : 'แตะเพื่อเปิดดูโต๊ะนี้',
                                    dot: 'emerald',
                                    onClick: () => {
                                        if (isOnlinePickup || isOnlineBooking) {
                                            setView('online_hub');
                                        } else if (tableId) {
                                            supabase.from('tables_layout').select('*').eq('id', tableId).single().then(({ data }) => {
                                                if (data) handleSelectTable(data);
                                            });
                                        } else {
                                            setView('online_hub');
                                        }
                                    }
                                }), { id: pendingOrderKey, duration: 10000 });
                                pushNotifHistory('ORDER', isOnlinePickup ? 'Online Pickup' : (isOnlineBooking ? 'Online Booking' : 'New Order'), toastTitle, tableId);
                                playOrderAlert(pendingOrderKey, 1200, 3.4);
                                if (isOnlinePickup || isOnlineBooking) {
                                    setShowPendingModal(true);
                                }
                            }
                        }
                    } else if (eventType === 'UPDATE') {
                        const newRemark = newRow?.staff_remark || '';
                        const oldRemark = oldRow?.staff_remark || '';
                        const newSlip = newRow?.payment_slip_url || '';
                        const oldSlip = oldRow?.payment_slip_url || '';

                        // 1. Pending Order Alert (New / Additional)
                        if (newRow?.status === 'pending') {
                            if (checkEventDeduplication(pendingOrderKey, 4500)) {
                                toast.custom((t) => renderPosToast(t, {
                                    badge: 'ADD ORDER · สั่งเพิ่ม',
                                    title: `โต๊ะ ${tableName} สั่งอาหารเพิ่มเติม`,
                                    subtitle: 'แตะเพื่อเปิดดูโต๊ะนี้',
                                    dot: 'emerald',
                                    onClick: () => {
                                        if (tableId) {
                                            supabase.from('tables_layout').select('*').eq('id', tableId).single().then(({ data }) => {
                                                if (data) handleSelectTable(data);
                                            });
                                        }
                                    }
                                }), { id: pendingOrderKey, duration: 10000 });
                                pushNotifHistory('ADD_ORDER', 'Add Order', `โต๊ะ ${tableName} สั่งอาหารเพิ่มเติม`, tableId);
                                playOrderAlert(pendingOrderKey, 1200, 3.4);
                            }
                        }

                        // 2. Call Bill Alert (Strict diffing: only fire if newly added)
                        if (newRemark.includes('[CALL_BILL]') && !oldRemark.includes('[CALL_BILL]')) {
                            if (checkEventDeduplication(callBillKey, 5000)) {
                                toast.custom((t) => renderPosToast(t, {
                                    badge: 'CALL BILL · เรียกเช็คบิล',
                                    title: `โต๊ะ ${tableName} เรียกเช็คบิล`,
                                    subtitle: 'แตะเพื่อเปิดดูและเตรียมบิล',
                                    dot: 'terracotta',
                                    onClick: () => {
                                        if (tableId) {
                                            supabase.from('tables_layout').select('*').eq('id', tableId).single().then(({ data }) => {
                                                if (data) handleSelectTable(data);
                                            });
                                        }
                                    }
                                }), { id: callBillKey, duration: 10000 });
                                pushNotifHistory('CALL_BILL', 'Call Bill', `โต๊ะ ${tableName} เรียกเช็คบิล`, tableId);
                                playBillAlert(callBillKey);
                            }
                        }

                        // 3. Cancellation Alert
                        const cancelKey = `${bookingId}_CANCELLED`;
                        if (newRow?.status === 'cancelled' && oldRow?.status !== 'cancelled') {
                            if (checkEventDeduplication(cancelKey, 8000)) {
                                toast.custom((t) => renderPosToast(t, {
                                    badge: 'CANCELLED · ยกเลิกการจอง',
                                    title: `ลูกค้ายกเลิกการจอง: โต๊ะ ${tableName}`,
                                    subtitle: 'แตะเพื่อปิดการแจ้งเตือน',
                                    dot: 'neutral',
                                }), { id: cancelKey, duration: 15000 });
                                playDoorbellAlert(cancelKey);
                            }
                        }

                        // 4. Customer Arrived Alert (Check-in)
                        const arrivedKey = `${bookingId}_ARRIVED`;
                        if (newRemark.includes('[CUSTOMER_ARRIVED]') && !oldRemark.includes('[CUSTOMER_ARRIVED]')) {
                            if (checkEventDeduplication(arrivedKey, 8000)) {
                                const customerName = newRow?.pickup_contact_name || newRow?.customer_name || 'ลูกค้า';
                                toast.custom((t) => renderPosToast(t, {
                                    badge: 'CUSTOMER ARRIVED · ลูกค้ามาถึง',
                                    title: `ลูกค้า ${customerName} มาถึงหน้าร้านแล้ว`,
                                    subtitle: 'แตะเพื่อปิดการแจ้งเตือน',
                                    dot: 'emerald',
                                }), { id: arrivedKey, duration: 15000 });
                                playDoorbellAlert(arrivedKey);
                            }
                        }

                        // 5. Call Staff Alert (Strict diffing: only fire if newly added)
                        if (newRemark.includes('[CALL_STAFF]') && !oldRemark.includes('[CALL_STAFF]')) {
                            if (checkEventDeduplication(callStaffKey, 5000)) {
                                toast.custom((t) => renderPosToast(t, {
                                    badge: 'CALL STAFF · เรียกพนักงาน',
                                    title: `โต๊ะ ${tableName} เรียกพนักงาน`,
                                    subtitle: 'แตะเพื่อเปิดดูโต๊ะนี้',
                                    dot: 'terracotta',
                                    onClick: () => {
                                        if (tableId) {
                                            supabase.from('tables_layout').select('*').eq('id', tableId).single().then(({ data }) => {
                                                if (data) handleSelectTable(data);
                                            });
                                        }
                                    }
                                }), { id: callStaffKey, duration: 10000 });
                                pushNotifHistory('CALL_STAFF', 'Call Staff', `โต๊ะ ${tableName} เรียกพนักงาน`, tableId);
                                playStaffCallAlert(callStaffKey);
                            }
                        }

                        // 6. Payment Slip Alert (Strict diffing: only fire if new slip URL was uploaded)
                        if (newSlip && newSlip !== oldSlip) {
                            if (checkEventDeduplication(slipReceivedKey, 5000)) {
                                toast.custom((t) => renderPosToast(t, {
                                    badge: 'PAYMENT · ส่งสลิปโอนเงิน',
                                    title: `โต๊ะ ${tableName} ส่งหลักฐานโอนเงินแล้ว`,
                                    subtitle: 'แตะเพื่อเปิดดูโต๊ะนี้',
                                    dot: 'emerald',
                                    onClick: () => {
                                        if (tableId) {
                                            supabase.from('tables_layout').select('*').eq('id', tableId).single().then(({ data }) => {
                                                if (data) handleSelectTable(data);
                                            });
                                        } else {
                                            setView('online_hub');
                                        }
                                    }
                                }), { id: slipReceivedKey, duration: 10000 });
                                pushNotifHistory('SLIP', 'Payment Uploaded', `โต๊ะ ${tableName} ส่งหลักฐานโอนเงินแล้ว`, tableId);
                                playSlipAlert(slipReceivedKey);
                            }
                        }
                    }
                })
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'order_items'
                }, async (payload) => {
                    const bookingId = payload.new?.booking_id || payload.old?.booking_id;
                    if (bookingId) {
                        if (payload.eventType === 'INSERT') {
                            // If staff is currently editing or viewing this booking right on this POS terminal, do not alert
                            const isCurrentPosBooking = activeBookingRef.current?.id === bookingId;

                            // Lookup booking details with tracking_token, status, and sources
                            supabase.from('bookings')
                                .select('id, tracking_token, table_id, staff_remark, source, booking_type, status, pickup_contact_name, payment_slip_url, tables_layout(table_name)')
                                .eq('id', bookingId)
                                .maybeSingle()
                                .then(({ data: bData }) => {
                                    if (!bData) return;
                                    
                                    const sourceLower = (bData.source || '').toLowerCase();
                                    const remarkLower = (bData.staff_remark || '').toLowerCase();
                                    const isLineman = sourceLower === 'lineman' || remarkLower.includes('lineman');
                                    const hasOnlineMarker = sourceLower === 'online' || sourceLower === 'line' || remarkLower.includes('[online_pickup]') || remarkLower.includes('easyslip') || !!bData.payment_slip_url;
                                    const isExplicitInHouse = !isLineman && !hasOnlineMarker && (sourceLower === 'pos' || sourceLower === 'walk_in' || remarkLower.includes('walk-in') || remarkLower.includes('walk in') || bData.booking_type === 'walk_in');
                                    const isWalkInPickup = bData.booking_type === 'pickup' && isExplicitInHouse;

                                    // Strictly suppress notifications and audio for in-store cashier actions or inactive states
                                    if (isExplicitInHouse || isWalkInPickup || isCurrentPosBooking || bData.status === 'completed' || bData.status === 'cancelled') {
                                        return;
                                    }

                                    const qrItemAlertKey = `order_items_${bookingId}`;
                                    if (checkEventDeduplication(qrItemAlertKey, 4500)) {
                                        console.log(`🔊 [POS Alert] Verified incoming QR / Online order items for: ${bookingId}`);
                                        playOrderAlert(qrItemAlertKey, 1200, 3.4);

                                        const isItemPickup = (bData.booking_type === 'pickup' || (!bData.table_id && (sourceLower === 'online' || remarkLower.includes('pickup')))) && !isExplicitInHouse;
                                        const tName = bData.tables_layout?.table_name || (bData.table_id ? (tablesMap[bData.table_id] || `#${bData.table_id}`) : null);
                                        const tId = bData.table_id;
                                        const resolvedShortId = getShortBookingId(bData);

                                        const itemBadge = isItemPickup ? 'ONLINE PICKUP · สั่งรับกลับ' : 'QR ORDER · ออเดอร์เข้าใหม่';
                                        const itemTitle = isItemPickup 
                                            ? `ออเดอร์รับกลับ #${resolvedShortId} มีรายการสั่งอาหารเข้ามา` 
                                            : `โต๊ะ ${tName || 'หน้าร้าน'} สั่งอาหารผ่าน QR Code เข้ามาแล้ว`;

                                        toast.custom((t) => renderPosToast(t, {
                                            badge: itemBadge,
                                            title: itemTitle,
                                            subtitle: isItemPickup ? 'แตะเพื่อเปิดดูใน Online Hub' : 'แตะเพื่อเปิดดูโต๊ะนี้',
                                            dot: 'emerald',
                                            onClick: () => {
                                                if (isItemPickup) {
                                                    setView('online_hub');
                                                } else if (tId) {
                                                    supabase.from('tables_layout').select('*').eq('id', tId).single().then(({ data }) => {
                                                        if (data) handleSelectTable(data);
                                                    });
                                                }
                                            }
                                        }), { id: qrItemAlertKey, duration: 10000 });
                                        pushNotifHistory('ORDER', isItemPickup ? 'Online Pickup' : 'QR Order', itemTitle, tId);
                                    }
                                });

                            if (window.autoPrintDebounceTimer) {
                                clearTimeout(window.autoPrintDebounceTimer);
                            }
                            window.autoPrintDebounceTimer = setTimeout(() => {
                                handleAutoPrintQROrder(bookingId);
                            }, 800); // Debounce bulk inserts
                        }

                        // If staff currently has this booking open on screen, auto-refresh the order items in real-time
                        if (activeBookingRef.current?.id === bookingId) {
                            if (window.activeBookingSyncDebounceTimer) {
                                clearTimeout(window.activeBookingSyncDebounceTimer);
                            }
                            window.activeBookingSyncDebounceTimer = setTimeout(() => {
                                refreshActiveBookingItems(bookingId);
                            }, 500);
                        }

                        checkPendingOrders();
                        triggerDebouncedRefresh();
                    }
                })
                .subscribe((status, err) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('⚡ [Realtime POS] Master notification channel connected.');
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED' || err) {
                        console.warn(`[Realtime POS] Channel status: ${status}. Scheduling auto-reconnect...`, err || '');
                        if (reconnectTimer) clearTimeout(reconnectTimer);
                        reconnectTimer = setTimeout(() => {
                            setupMasterChannel();
                        }, 2500);
                    }
                });

            activeChannel = notifyChannel;
        };

        setupMasterChannel();

        return () => {
            isUnmounted = true;
            if (reconnectTimer) clearTimeout(reconnectTimer);
            if (activeChannel) {
                try {
                    supabase.removeChannel(activeChannel);
                } catch (e) {}
            }
        };
    }, []);

    const handleSaveAndOpenSlip = async (type, checkoutMeta = null) => {
        if (submittingOrderRef.current || isSubmittingOrder) return;
        submittingOrderRef.current = true;
        setIsSubmittingOrder(true);
        let lockedBookingId = activeBooking?.id || null;
        if (lockedBookingId) {
            processingQrPrintRef.current.add(lockedBookingId);
        }
        try {
            if (currentOrder.items.length === 0 && !activeBooking) {
                toast.error("No items in order to print");
                return;
            }

            let bookingId = activeBooking?.id;
            let currentBooking = activeBooking;

            // 1. Create walk-in if no active booking
            if (!bookingId) {
                const memberIdToPass = attachedMemberCrm?.id || activeBooking?.user_id || activeBooking?.profiles?.id || null;
                const newBooking = selectedTable 
                    ? await createWalkIn(selectedTable, null, memberIdToPass)
                    : await createWalkInPickup('Walk-in Customer', memberIdToPass);
                if (!newBooking) return;
                bookingId = newBooking.id;
                currentBooking = newBooking;
                lockedBookingId = bookingId;
                processingQrPrintRef.current.add(bookingId);
            } else {
                lockedBookingId = bookingId;
                processingQrPrintRef.current.add(bookingId);
            }

            // Attach CRM member if attached in local draft state
            const memberToAttach = attachedMemberCrm || activeBooking?.profiles;
            if (memberToAttach?.id && bookingId && (!currentBooking?.user_id || currentBooking.user_id !== memberToAttach.id)) {
                await attachCustomerToBooking(bookingId, memberToAttach.id);
                currentBooking = { ...currentBooking, user_id: memberToAttach.id, profiles: memberToAttach };
            }

            // 2. Submit items
            const newItems = currentOrder.items.filter(i => !i.db_id);
            let newlyInsertedRows = [];
            if (newItems.length > 0) {
                const result = await submitOrderItems(bookingId, newItems);
                if (!result) return;
                if (typeof result === 'object' && result.bookingId) {
                    bookingId = result.bookingId;
                    newlyInsertedRows = result.insertedItems || [];
                } else if (typeof result === 'string') {
                    bookingId = result;
                }
            }

            // Track newly inserted items in QR tracker immediately so realtime listener doesn't double print
            if (newlyInsertedRows.length > 0 && bookingId) {
                const storageKey = `qr_printed_items_${bookingId}`;
                try {
                    const printed = JSON.parse(localStorage.getItem(storageKey) || '[]');
                    const combined = Array.from(new Set([...printed, ...newlyInsertedRows.map(r => r.id).filter(Boolean)]));
                    localStorage.setItem(storageKey, JSON.stringify(combined));
                } catch (e) {}
            }

            // 3. Reload the booking to get updated order_items and references
            let updatedBooking = null;
            if (selectedTable?.id) {
                updatedBooking = await getActiveBooking(selectedTable.id);
            }

            if (!updatedBooking && bookingId) {
                if (isOnline()) {
                    const { data } = await supabase
                        .from('bookings')
                        .select('*, tables_layout(*), profiles(*), order_items(*, menu_items(name, category_id, menu_categories(name, is_drink_stamp_eligible)))')
                        .eq('id', bookingId)
                        .maybeSingle();
                    updatedBooking = data;
                } else {
                    const cached = posCache.getBookings();
                    updatedBooking = cached.find(b => b.id === bookingId);
                }
            }

            let targetBooking = updatedBooking || currentBooking;

            // Construct cart fallback items from currentOrder.items in case order_items from DB is missing or empty
            const cartFallbackOrderItems = (currentOrder.items || []).map((ci, idx) => {
                const isCustom = Boolean(ci.is_custom === true || ci.is_emergency === true || String(ci.id).startsWith('custom_'));
                const resolvedName = ci.custom_name || ci.name || (isCustom ? 'เมนูเพิ่มเติม' : 'Item');
                const catId = ci.category_id || '';
                const DEFAULT_BAR_CATS = [
                    '7524bb8a-4698-45c6-aa17-d8ccc296f667',
                    '912683ef-fdc3-40a3-8dd8-b09507791240',
                    'b441665e-2f23-4df3-a11d-63485e1690dc',
                    'a2c783fc-975b-4779-b9eb-67391eeafd1f',
                    '1983955d-5787-4351-b729-51b95761f125',
                    '1407d869-4eed-489e-aeeb-ba7ef19f57bd',
                    '8a3dcc6b-9eff-42b2-83d5-1e02dd0a98cd'
                ];
                let resolvedDest = DEFAULT_BAR_CATS.includes(catId) || ci.destination === 'bar' ? 'bar' : (ci.destination === 'other' ? 'other' : 'kitchen');

                return {
                    id: ci.db_id || ci.id || `cart_item_${idx}`,
                    booking_id: bookingId,
                    menu_item_id: ci.id || ci.menu_item_id,
                    quantity: Number(ci.quantity) || 1,
                    price_at_time: Number(ci.price) || 0,
                    price: Number(ci.price) || 0,
                    selected_options: ci.selected_options || [],
                    item_note: ci.item_note || '',
                    name: resolvedName,
                    custom_name: isCustom ? (ci.custom_name || resolvedName) : null,
                    destination: resolvedDest,
                    is_custom: isCustom,
                    is_emergency: isCustom,
                    category_id: ci.category_id || '',
                    category_name: ci.category_name || (resolvedDest === 'bar' ? 'เครื่องดื่ม' : 'อาหาร'),
                    menu_items: {
                        name: resolvedName,
                        category_id: ci.category_id || '',
                        menu_categories: { name: ci.category_name || (resolvedDest === 'bar' ? 'เครื่องดื่ม' : 'อาหาร') }
                    }
                };
            });

            const existingOrderItems = targetBooking?.order_items || [];
            const existingIds = new Set(existingOrderItems.map(i => i.id || i.menu_item_id));
            const mergedItems = [...existingOrderItems];

            newlyInsertedRows.forEach(row => {
                const rowKey = row.id || row.menu_item_id;
                if (!existingIds.has(rowKey)) {
                    mergedItems.push(row);
                    existingIds.add(rowKey);
                }
            });

            // Ensure order_items is never empty if cart has items
            const finalOrderItems = mergedItems.length > 0 ? mergedItems : cartFallbackOrderItems;

            targetBooking = {
                ...(targetBooking || {}),
                id: bookingId,
                order_items: finalOrderItems,
                ...(checkoutMeta ? {
                    discount_amount: checkoutMeta.discount_amount ?? checkoutMeta.discountAmount ?? targetBooking?.discount_amount ?? 0,
                    xhaus_discount: checkoutMeta.xhaus_discount ?? checkoutMeta.xhausDiscount ?? targetBooking?.xhaus_discount ?? 0,
                    total_amount: checkoutMeta.total_amount ?? checkoutMeta.total ?? targetBooking?.total_amount,
                    manual_discount: checkoutMeta.manual_discount,
                    promo_discount: checkoutMeta.promo_discount,
                    member_discount: checkoutMeta.member_discount,
                    include_tax: checkoutMeta.include_tax
                } : {})
            };

            if (targetBooking) {
                setActiveBooking(targetBooking);
                // Update currentOrder item db_ids with guaranteed unique IDs
                const updatedItems = (targetBooking.order_items || []).map(formatDbOrderItemToCart).filter(Boolean);
                setCurrentOrder(prev => ({
                    ...prev,
                    items: updatedItems
                }));
                
                if (newItems.length > 0) {
                    toast.success("บันทึกและส่งออเดอร์เข้าครัวสำเร็จ! (กำลังพิมพ์บิล)");
                }
                
                // For kitchen slips, ONLY print the newly inserted items if they exist
                let printBooking = targetBooking;
                if (type === 'kitchen' && newlyInsertedRows.length > 0) {
                    printBooking = { ...targetBooking, order_items: newlyInsertedRows };
                }
                openSlipOrSilentPrint(printBooking, type);
            }
        } finally {
            submittingOrderRef.current = false;
            setIsSubmittingOrder(false);
            if (lockedBookingId) {
                setTimeout(() => {
                    processingQrPrintRef.current.delete(lockedBookingId);
                }, 3500);
            }
        }
    };

    const openSlipOrSilentPrint = useCallback(async (booking, slipType) => {
        if (!booking) return;
        try {
            const silentSuccess = await silentPrintSlip(booking, slipType);
            if (!silentSuccess) {
                setActiveSlipBooking(booking);
                setActiveSlipType(slipType);
            }
        } catch (err) {
            console.error("Silent print failed:", err);
            setActiveSlipBooking(booking);
            setActiveSlipType(slipType);
        }
    }, []);

    const handleSelectOpenBill = useCallback(async (booking) => {
        if (!booking) return;

        let fullBooking = booking;
        // ALWAYS fetch fresh booking details with complete relations from database if online
        if (isOnline() && typeof booking.id === 'string' && !booking.id.startsWith('local_')) {
            try {
                const { data } = await supabase
                    .from('bookings')
                    .select('*, tables_layout(*), profiles(*), order_items(*, menu_items(name, category_id, is_drink_stamp_eligible, menu_categories(name, is_drink_stamp_eligible)))')
                    .eq('id', booking.id)
                    .maybeSingle();
                if (data) fullBooking = data;
            } catch (e) {
                console.warn('Could not fetch full booking details for open bill:', e);
            }
        }

        const tableObj = fullBooking.tables_layout || null;
        if (tableObj?.id) {
            setSelectedTable(tableObj);
            localStorage.setItem('pos_active_table_id', tableObj.id);
        } else {
            setSelectedTable(null);
            localStorage.removeItem('pos_active_table_id');
        }

        if (fullBooking.profiles) {
            setAttachedMemberCrm(fullBooking.profiles);
        } else {
            setAttachedMemberCrm(null);
        }

        setActiveBooking(fullBooking);

        const existingItems = (fullBooking.order_items || []).map(formatDbOrderItemToCart).filter(Boolean);

        const defaultWalkIns = ['walk-in guest', 'walk-in pick-up', 'walk-in customer', 'walk-in', 'walk-in customer (offline)', 'walk-in pick-up (offline)', 'anonymous user', 'walk-in-customer'];
        const customerName = fullBooking.profiles?.display_name 
            || (fullBooking.customer_name && !defaultWalkIns.includes(fullBooking.customer_name.toLowerCase().trim()) ? fullBooking.customer_name : null)
            || (fullBooking.pickup_contact_name && !defaultWalkIns.includes(fullBooking.pickup_contact_name.toLowerCase().trim()) ? fullBooking.pickup_contact_name : null)
            || (tableObj ? `Table ${tableObj.table_name}` : 'Walk-in Guest');

        setCurrentOrder({
            items: existingItems,
            customer: customerName,
            table: tableObj
        });
        
        // Table orders stay on 'tables' view; Direct / Pickup orders open in 'menu' view
        if (tableObj) {
            setView('tables');
        } else {
            setView('menu');
        }
    }, []);

    const { getActiveBooking, createWalkIn, createWalkInPickup, completeCheckout, submitOrderItems, acceptOrder, attachCustomerToBooking, updateGuestCount, deleteOrderItem, updateOrderItemDbQty } = usePOSOrder();

    const [openTableModalData, setOpenTableModalData] = useState(null);
    const [openTablePaxInput, setOpenTablePaxInput] = useState('2');

    // Walk-in Pickup Modal State
    const [showPickupModal, setShowPickupModal] = useState(false);
    const [pickupNoteInput, setPickupNoteInput] = useState('');

    const handleSelectTable = useCallback(async (table) => {
        setSelectedTable(table);
        setAttachedMemberCrm(null); // Clear stale attached member immediately on table change
        if (table?.id) {
            localStorage.setItem('pos_active_table_id', table.id);
        }
        
        // 1. Check for active booking
        const booking = await getActiveBooking(table.id);
        
        if (booking) {
            setActiveBooking(booking);
            // Load existing items with unique cart-level IDs
            const existingItems = (booking.order_items || []).map(formatDbOrderItemToCart).filter(Boolean);
            setCurrentOrder({
                items: existingItems,
                customer: booking.profiles?.display_name || booking.pickup_contact_name || booking.customer_name || 'Customer',
                table: table
            });
            // Keep on 'tables' view so the floorplan remains visible
            setView('tables');
        } else {
            // Table is empty -> Show Open Table Modal to mandate entering guest count!
            setActiveBooking(null);
            setCurrentOrder({
                items: [],
                customer: 'Walk-in Guest',
                table: table
            });
            setOpenTablePaxInput(String(table.capacity || 2));
            setOpenTableModalData({ table });
        }
    }, [getActiveBooking]);

    const handleConfirmOpenTable = useCallback(async () => {
        if (!openTableModalData?.table) return;
        const paxNum = parseInt(openTablePaxInput);
        if (!paxNum || paxNum <= 0) {
            toast.error('กรุณาระบุจำนวนลูกค้าให้ถูกต้อง');
            return;
        }

        const toastId = toast.loading(`กำลังเปิดโต๊ะ ${openTableModalData.table.table_name}...`);
        try {
            const newBooking = await createWalkIn(openTableModalData.table, paxNum);
            if (newBooking) {
                setActiveBooking(newBooking);
                toast.success(`เปิดโต๊ะ ${openTableModalData.table.table_name} (${paxNum} คน) สำเร็จ!`, { id: toastId });
                setOpenTableModalData(null);
                // Keep on 'tables' view so staff sees the open table on the floorplan
                setView('tables');
            } else {
                toast.error('ไม่สามารถเปิดโต๊ะได้', { id: toastId });
            }
        } catch (err) {
            console.error('Failed to open table:', err);
            toast.error('เกิดข้อผิดพลาดในการเปิดโต๊ะ', { id: toastId });
        }
    }, [createWalkIn, openTableModalData, openTablePaxInput]);

    const handleSelectPickupOrder = useCallback(async (booking) => {
        setAttachedMemberCrm(null); // Clear stale member profile immediately
        setActiveBooking(booking);
        setSelectedTable(null); 
        localStorage.removeItem('pos_active_table_id');
        
        if (booking?.user_id) {
            try {
                let profileData = booking.profiles;
                if (!profileData) {
                    const { data: pData } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', booking.user_id)
                        .maybeSingle();
                    profileData = pData;
                }
                const { data, error } = await supabase.rpc('get_member_tier_details', { p_user_id: booking.user_id });
                if (profileData) {
                    const tierDetails = (!error && data && data.length > 0) ? data[0] : {};
                    setAttachedMemberCrm({ ...profileData, ...tierDetails });
                } else if (!error && data && data.length > 0) {
                    setAttachedMemberCrm({ id: booking.user_id, ...data[0] });
                } else if (booking.profiles) {
                    setAttachedMemberCrm(booking.profiles);
                }
            } catch (err) {
                if (booking.profiles) setAttachedMemberCrm(booking.profiles);
            }
        }
        
        const existingItems = (booking.order_items || []).map(formatDbOrderItemToCart).filter(Boolean);
        setCurrentOrder({
            items: existingItems,
            customer: booking.pickup_contact_name || booking.customer_name || booking.customer_note || 'Walk-in Pick-up',
            table: null
        });
        setView('menu');
    }, []);

    const handleNewWalkInPickup = useCallback(() => {
        setPickupNoteInput('');
        setShowPickupModal(true);
    }, []);

    const confirmNewWalkInPickup = useCallback(async () => {
        const note = pickupNoteInput.trim() || 'Walk-in Pick-up';
        setShowPickupModal(false);
        setPickupNoteInput('');
        const newBooking = await createWalkInPickup(note);
        if (newBooking) {
            handleSelectPickupOrder(newBooking);
        }
    }, [createWalkInPickup, handleSelectPickupOrder, pickupNoteInput]);

    useEffect(() => {
        const autoSelectPending = async () => {
            setView('online_hub');
        };

        const params = new URLSearchParams(window.location.search);
        if (params.get('autoSelect') === 'pending') {
            autoSelectPending();
            window.history.replaceState({}, document.title, window.location.pathname);
        } else {
            // Clean initial state: Always start on Tables view
            localStorage.removeItem('pos_active_table_id');
        }
    }, []);

    const handleBackToTables = useCallback(() => {
        if (view === 'menu' && selectedTable) {
            // Return from Menu key-in back to Tables floorplan, preserving active table & items
            setView('tables');
        } else {
            // Full reset to clean Tables floorplan
            localStorage.removeItem('pos_active_table_id');
            setView('tables');
            setSelectedTable(null);
            setActiveBooking(null);
            setCurrentOrder({ items: [], customer: null, table: null });
            setAttachedMemberCrm(null);
            const cfdIdleDetail = { type: 'IDLE', timestamp: Date.now() };
            window.dispatchEvent(new CustomEvent('pos-cfd-broadcast', { detail: cfdIdleDetail }));
            try {
                if (window.AndroidCfdBridge && typeof window.AndroidCfdBridge.sendCfdEvent === 'function') {
                    window.AndroidCfdBridge.sendCfdEvent(JSON.stringify(cfdIdleDetail));
                }
            } catch (e) {}
        }
    }, [selectedTable, view]);

    const handleAddToOrder = useCallback((item) => {
        setCurrentOrder(prev => {
            const addQty = item.quantity || item.qty || 1;
            const itemOpts = item.selected_options || item.optionsSummary || [];
            const itemNote = item.item_note || item.itemNote || '';
            const optsStr = JSON.stringify(itemOpts);
            const isCustom = Boolean(item.is_custom === true || item.is_emergency === true || String(item.id).startsWith('custom_'));
            const targetMenuItemId = isCustom ? null : (item.menu_item_id || item.id);
            const itemName = item.name || item.custom_name || (isCustom ? 'เมนูเพิ่มเติม' : 'Item');

            // Match only against NEW draft items (no db_id) so we never mutate items already stored in DB!
            const existingIndex = prev.items.findIndex(i => {
                if (i.db_id) return false;
                if (isCustom || i.is_custom) {
                    return (i.is_custom || !i.menu_item_id) && i.name === itemName && Number(i.price) === Number(item.price);
                }
                const iTargetId = i.menu_item_id || i.id;
                if (iTargetId !== targetMenuItemId) return false;
                const existingOptsStr = JSON.stringify(i.selected_options || i.optionsSummary || []);
                const existingNote = i.item_note || i.itemNote || '';
                return existingOptsStr === optsStr && existingNote === itemNote;
            });

            const catId = item.category_id || '';
            const DEFAULT_BAR_CATS = [
                '7524bb8a-4698-45c6-aa17-d8ccc296f667', // Coffee
                '912683ef-fdc3-40a3-8dd8-b09507791240', // Soft Drink
                'b441665e-2f23-4df3-a11d-63485e1690dc', // Beer
                'a2c783fc-975b-4779-b9eb-67391eeafd1f', // Alcohol
                '1983955d-5787-4351-b729-51b95761f125', // Mocktail & Cocktail
                '1407d869-4eed-489e-aeeb-ba7ef19f57bd', // Bottled
                '8a3dcc6b-9eff-42b2-83d5-1e02dd0a98cd'  // PRO Beer
            ];
            let resolvedDest = 'kitchen';
            if (DEFAULT_BAR_CATS.includes(catId)) {
                resolvedDest = 'bar';
            } else if (item.destination === 'bar' || item.destination === 'drinks') {
                resolvedDest = 'bar';
            } else if (item.destination === 'other') {
                resolvedDest = 'other';
            } else if (itemOpts.some(o => {
                const oStr = typeof o === 'object' ? (o.name || o.destination || '') : String(o);
                return oStr.includes('(บาร์)') || oStr.includes('เครื่องดื่ม') || o.destination === 'bar';
            })) {
                resolvedDest = 'bar';
            }

            if (existingIndex !== -1) {
                const updatedItems = [...prev.items];
                updatedItems[existingIndex] = {
                    ...updatedItems[existingIndex],
                    quantity: updatedItems[existingIndex].quantity + addQty,
                    price: parseFloat(item.price) || updatedItems[existingIndex].price,
                    destination: resolvedDest || updatedItems[existingIndex].destination || 'kitchen'
                };
                return { ...prev, items: updatedItems };
            }

            const uniqueDraftId = isCustom 
                ? (item.id || `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`) 
                : `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

            return {
                ...prev,
                items: [
                    ...prev.items,
                    {
                        id: uniqueDraftId,
                        menu_item_id: targetMenuItemId,
                        name: itemName,
                        custom_name: isCustom ? (item.custom_name || itemName) : null,
                        price: parseFloat(item.price) || 0,
                        quantity: addQty,
                        selected_options: itemOpts,
                        item_note: itemNote,
                        category_id: catId,
                        category_name: item.category?.name || item.category_name || (resolvedDest === 'bar' ? 'เครื่องดื่ม' : 'อาหาร'),
                        destination: resolvedDest,
                        is_custom: isCustom,
                        is_emergency: isCustom,
                        is_drink_stamp_eligible: item.is_drink_stamp_eligible || false
                    }
                ]
            };
        });
    }, []);

    const qtyDebounceTimersRef = useRef({});

    const handleUpdateQuantity = useCallback((itemId, delta) => {
        let currentTargetItem = null;
        let nextQty = 0;

        setCurrentOrder(prev => {
            const targetItem = prev.items.find(i => i.id === itemId);
            if (!targetItem) return prev;

            const isReward = targetItem.is_reward || !!targetItem.claim_code || (targetItem.name || '').includes('แลกสิทธิ');
            if (isReward && delta > 0) {
                toast.error("รายการแลกสิทธิไม่สามารถเพิ่มจำนวนได้ครับ");
                return prev;
            }

            const newQty = Math.max(0, targetItem.quantity + delta);
            currentTargetItem = targetItem;
            nextQty = newQty;

            return {
                ...prev,
                items: prev.items.map(item => {
                    if (item.id === itemId) {
                        return { ...item, quantity: newQty };
                    }
                    return item;
                }).filter(item => item.quantity > 0)
            };
        });

        // Perform asynchronous DB sync outside the state updater function with debouncing
        if (currentTargetItem && currentTargetItem.db_id) {
            const currentBookingId = activeBookingRef.current?.id;
            const cleanDbId = String(currentTargetItem.db_id).replace(/^db_/, '');

            // Instant optimistic update to activeBooking in memory
            setActiveBooking(prev => {
                if (!prev || !prev.order_items) return prev;
                let updatedOrderItems;
                if (nextQty === 0) {
                    updatedOrderItems = prev.order_items.filter(i => String(i.id).replace(/^db_/, '') !== cleanDbId);
                } else {
                    updatedOrderItems = prev.order_items.map(i => String(i.id).replace(/^db_/, '') === cleanDbId ? { ...i, quantity: nextQty } : i);
                }
                const newTotal = updatedOrderItems.reduce((s, i) => s + ((Number(i.price_at_time || i.price) || 0) * (Number(i.quantity) || 1)), 0);
                return { ...prev, order_items: updatedOrderItems, total_amount: newTotal };
            });

            if (qtyDebounceTimersRef.current[cleanDbId]) {
                clearTimeout(qtyDebounceTimersRef.current[cleanDbId]);
            }

            if (nextQty === 0) {
                deleteOrderItem(cleanDbId, currentBookingId);
                delete qtyDebounceTimersRef.current[cleanDbId];
            } else {
                qtyDebounceTimersRef.current[cleanDbId] = setTimeout(() => {
                    updateOrderItemDbQty(cleanDbId, nextQty, currentBookingId);
                    delete qtyDebounceTimersRef.current[cleanDbId];
                }, 300);
            }
        }
    }, [deleteOrderItem, updateOrderItemDbQty]);

    const handleUpdateItemNote = useCallback((itemId, note) => {
        setCurrentOrder(prev => ({
            ...prev,
            items: prev.items.map(item => {
                if (item.id === itemId) {
                    return { ...item, item_note: note };
                }
                return item;
            })
        }));
    }, []);

    const handleClearOrderOrTable = async () => {
        if (activeBooking) {
            const isConfirmed = window.confirm(`⚠️ คุณต้องการยกเลิกบิล / เคลียร์โต๊ะนี้ใช่หรือไม่?\nการดำเนินการนี้จะเปลี่ยนสถานะบิลเป็นยกเลิก (Void) และคืนค่าโต๊ะเป็นว่างทันที`);
            if (isConfirmed) {
                const toastId = toast.loading('กำลังยกเลิกบิลและเคลียร์โต๊ะ...');
                try {
                    const bookingId = activeBooking.id;
                    const isLocal = typeof bookingId === 'string' && bookingId.startsWith('local_');

                    if (!isLocal && isOnline()) {
                        const { error } = await supabase
                            .from('bookings')
                            .update({ status: 'void' })
                            .eq('id', bookingId);
                        if (error) console.warn("Supabase void error:", error);
                    } else {
                        addToOfflineQueue('void_booking', { bookingId });
                    }
                    
                    // Void in active shift transactions if present
                    voidShiftTransaction(bookingId);

                    // Update posCache active bookings
                    try {
                        const cached = posCache.getBookings().filter(b => b.id !== bookingId);
                        posCache.setBookings(cached);
                    } catch (e) {}

                    // Update localStorage pos_cache_active_bookings
                    try {
                        const cached = JSON.parse(localStorage.getItem('pos_cache_active_bookings') || '[]').filter(b => b.id !== bookingId);
                        localStorage.setItem('pos_cache_active_bookings', JSON.stringify(cached));
                    } catch (e) {}
                    
                    toast.success('ยกเลิกบิลและเคลียร์โต๊ะสำเร็จแล้ว', { id: toastId });
                } catch (err) {
                    console.error("Failed to clear booking:", err);
                    toast.error('เคลียร์ข้อมูลในเครื่องเรียบร้อยแล้ว', { id: toastId });
                } finally {
                    // Always clear states regardless of network errors so user is NEVER stuck
                    localStorage.removeItem('pos_active_table_id');
                    setCurrentOrder({ items: [], customer: null, table: null });
                    setActiveBooking(null);
                    setSelectedTable(null);
                    setAttachedMemberCrm(null);
                    setRefreshKey(prev => prev + 1);
                    setView('tables');
                    const cfdIdleDetail = { type: 'IDLE', timestamp: Date.now() };
                    window.dispatchEvent(new CustomEvent('pos-cfd-broadcast', { detail: cfdIdleDetail }));
                    try {
                        if (window.AndroidCfdBridge && typeof window.AndroidCfdBridge.sendCfdEvent === 'function') {
                            window.AndroidCfdBridge.sendCfdEvent(JSON.stringify(cfdIdleDetail));
                        }
                    } catch (e) {}
                }
            }
        } else {
            // Cart has unsaved items only, no active booking in DB -> completely reset table state
            localStorage.removeItem('pos_active_table_id');
            setCurrentOrder({ items: [], customer: null, table: null });
            setSelectedTable(null);
            setActiveBooking(null);
            setAttachedMemberCrm(null);
            setView('tables');
            const cfdIdleDetail = { type: 'IDLE', timestamp: Date.now() };
            window.dispatchEvent(new CustomEvent('pos-cfd-broadcast', { detail: cfdIdleDetail }));
            try {
                if (window.AndroidCfdBridge && typeof window.AndroidCfdBridge.sendCfdEvent === 'function') {
                    window.AndroidCfdBridge.sendCfdEvent(JSON.stringify(cfdIdleDetail));
                }
            } catch (e) {}
            toast.info('เคลียร์รายการและคืนสถานะเรียบร้อยแล้ว');
        }
    };

    const handleInjectRewardItem = (menuItem, claimCode, rewardId, xhausCost) => {
        if (!menuItem) return;
        const rewardItem = {
            id: `reward-${Date.now()}`,
            menu_item_id: menuItem.id,
            name: `${menuItem.name || 'Reward Item'} (แลกสิทธิ ${claimCode})`,
            price: 0,
            quantity: 1,
            category_id: menuItem.category_id,
            is_reward: true,
            claim_code: claimCode,
            reward_id: rewardId,
            xhaus_cost: xhausCost
        };
        setCurrentOrder(prev => {
            const existingItems = prev?.items || [];
            // Check if there is a matching paid item in cart (price > 0) to deduct
            const matchingIndex = existingItems.findIndex(i => 
                !i.is_reward && 
                (i.menu_item_id === menuItem.id || i.id === menuItem.id || (i.name && menuItem.name && i.name.toLowerCase() === menuItem.name.toLowerCase())) && 
                (parseFloat(i.price) > 0)
            );

            let updatedItems = [...existingItems];
            if (matchingIndex !== -1) {
                const target = updatedItems[matchingIndex];
                if ((target.quantity || 1) > 1) {
                    updatedItems[matchingIndex] = { ...target, quantity: target.quantity - 1 };
                } else {
                    updatedItems.splice(matchingIndex, 1);
                }
            }
            return {
                ...prev,
                items: [...updatedItems, rewardItem]
            };
        });
    };

    const handleRemoveRewardItem = (claimCode) => {
        setCurrentOrder(prev => ({
            ...prev,
            items: (prev?.items || []).filter(item => item?.claim_code !== claimCode)
        }));
    };

    const handleCheckout = async (
        paymentMethod, 
        includeTax, 
        pointsEarned = 0, 
        xhausToRedeem = 0, 
        xhausDiscount = 0,
        promoDiscount = 0,
        manualDiscount = 0,
        rewardCode = null,
        rewardId = null,
        useFreeDrinkQuota = false,
        cashReceived = 0,
        changeDue = 0
    ) => {
        if (submittingOrderRef.current || isSubmittingOrder) return;
        if (currentOrder.items.length === 0) return;
        submittingOrderRef.current = true;
        setIsSubmittingOrder(true);
        try {
            let bookingId = activeBooking?.id;
        let currentBooking = activeBooking;

        // 1. Create walk-in if no active booking
        if (!bookingId) {
            const memberIdToPass = attachedMemberCrm?.id || activeBooking?.user_id || activeBooking?.profiles?.id || null;
            const newBooking = selectedTable 
                ? await createWalkIn(selectedTable, null, memberIdToPass)
                : await createWalkInPickup('Walk-in Customer', memberIdToPass);
            if (!newBooking) return;
            bookingId = newBooking.id;
            currentBooking = newBooking;
        }

        // Attach CRM member if attached in local draft state (works for new & existing bookings)
        const memberToAttach = attachedMemberCrm || activeBooking?.profiles;
        if (memberToAttach?.id && bookingId && (!currentBooking?.user_id || currentBooking.user_id !== memberToAttach.id)) {
            await attachCustomerToBooking(bookingId, memberToAttach.id);
            currentBooking = { ...currentBooking, user_id: memberToAttach.id, profiles: memberToAttach };
        }

        // 2. Submit items
        const newItems = currentOrder.items.filter(i => !i.db_id);
        if (newItems.length > 0) {
            const result = await submitOrderItems(bookingId, newItems);
            if (!result) return;
            if (typeof result === 'string') {
                bookingId = result;
            }
        }

        // 3. Complete Checkout
        const subtotal = currentOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        let memberDiscount = 0; // Member percentage discount disabled (Point-only model)

        let freeDrinkDiscVal = 0;
        if (useFreeDrinkQuota) {
            const eligibleItems = currentOrder.items.filter(item => {
                if (!item || item.is_reward) return false;
                if (typeof item.is_drink_stamp_eligible === 'boolean') return item.is_drink_stamp_eligible;
                if (typeof item.menu_items?.is_drink_stamp_eligible === 'boolean') return item.menu_items.is_drink_stamp_eligible;
                if (typeof item.menu_items?.menu_categories?.is_drink_stamp_eligible === 'boolean') return item.menu_items.menu_categories.is_drink_stamp_eligible;
                if (typeof item.menu_categories?.is_drink_stamp_eligible === 'boolean') return item.menu_categories.is_drink_stamp_eligible;
                return false;
            });
            if (eligibleItems.length > 0) {
                freeDrinkDiscVal = Math.min(...eligibleItems.map(i => parseFloat(i.price) || 0));
            }
        }

        const netBeforeTax = subtotal - memberDiscount - promoDiscount - manualDiscount - xhausDiscount - freeDrinkDiscVal;
        const finalTotal = includeTax ? Math.max(0, netBeforeTax * 1.07) : Math.max(0, netBeforeTax);

        const fallbackProfileId = attachedMemberCrm?.id || currentBooking?.profiles?.id || currentBooking?.user_id || null;

        let finalRewardCode = rewardCode;
        if (useFreeDrinkQuota) {
            finalRewardCode = finalRewardCode ? `${finalRewardCode} | 10 Free 1 Drink` : '10 Free 1 Drink';
        }

        const numCashRecv = Number(cashReceived) || finalTotal;
        const numChangeDue = Number(changeDue) || (paymentMethod === 'cash' ? Math.max(0, numCashRecv - finalTotal) : 0);

        if (paymentMethod === 'cash') {
            try {
                localStorage.setItem('last_cash_received', String(numCashRecv));
                localStorage.setItem('last_cash_change', String(numChangeDue));
            } catch (e) {}
        }

        const success = await completeCheckout(
            bookingId, 
            finalTotal, 
            paymentMethod, 
            memberDiscount + promoDiscount + manualDiscount + xhausDiscount + freeDrinkDiscVal, 
            pointsEarned, 
            xhausToRedeem, 
            xhausDiscount,
            finalRewardCode,
            rewardId,
            fallbackProfileId,
            numCashRecv,
            numChangeDue
        );
        if (success) {
            // Process Automatic Drink Stamps 10 Free 1 for Attached Member Profile
            if (fallbackProfileId) {
                const profileId = fallbackProfileId;
                try {
                    // Fetch dbOrderItems for accurate eligibility check
                    const { data: dbOrderItems } = await supabase
                        .from('order_items')
                        .select('quantity, menu_items(id, name, is_drink_stamp_eligible, category_id, menu_categories(name, is_drink_stamp_eligible))')
                        .eq('booking_id', bookingId);

                    const itemsToCheck = dbOrderItems && dbOrderItems.length > 0 ? dbOrderItems : currentOrder.items;

                    let eligibleDrinkCount = itemsToCheck.reduce((sum, item) => {
                        // Reward items (free items) do not earn stamps
                        if (!item || item.is_reward) return sum;

                        const menuItem = item.menu_items || item;
                        let isEligible = false;

                        // Priority 1: Direct item-level eligibility from DB
                        if (typeof menuItem.is_drink_stamp_eligible === 'boolean') {
                            isEligible = menuItem.is_drink_stamp_eligible;
                        } else if (typeof item.is_drink_stamp_eligible === 'boolean') {
                            isEligible = item.is_drink_stamp_eligible;
                        }
                        // Priority 2: Category-level eligibility from DB
                        else if (typeof menuItem.menu_categories?.is_drink_stamp_eligible === 'boolean') {
                            isEligible = menuItem.menu_categories.is_drink_stamp_eligible;
                        } else if (typeof item.menu_categories?.is_drink_stamp_eligible === 'boolean') {
                            isEligible = item.menu_categories.is_drink_stamp_eligible;
                        }

                        return isEligible ? sum + (parseInt(item.quantity) || 1) : sum;
                    }, 0);

                    if (useFreeDrinkQuota && eligibleDrinkCount > 0) {
                        eligibleDrinkCount = Math.max(0, eligibleDrinkCount - 1);
                    }

                    if (eligibleDrinkCount > 0 || useFreeDrinkQuota) {
                        // Execute SECURITY DEFINER RPC process_drink_stamps
                        const { data: rpcRes, error: rpcErr } = await supabase.rpc('process_drink_stamps', {
                            p_user_id: profileId,
                            p_stamp_count: eligibleDrinkCount,
                            p_quota_used: useFreeDrinkQuota ? 1 : 0
                        });

                        if (!rpcErr && rpcRes && rpcRes.length > 0) {
                            if (eligibleDrinkCount > 0) {
                                toast.success(`☕ อัปเดต Drink Stamp +${eligibleDrinkCount} แก้ว (รวม ${rpcRes[0].new_stamp_count}/10)`);
                            }
                            if (useFreeDrinkQuota) {
                                toast.success(`🎉 ใช้สิทธิ์เครื่องดื่มฟรี 1 แก้วเรียบร้อยแล้ว`);
                            }
                        } else {
                            // Fallback direct profile update if RPC fails
                            const { data: profile } = await supabase
                                .from('profiles')
                                .select('drink_stamp_count, free_drink_quota, total_drinks_purchased')
                                .eq('id', profileId)
                                .maybeSingle();

                            if (profile) {
                                const currentStamps = profile.drink_stamp_count || 0;
                                const currentQuota = profile.free_drink_quota || 0;
                                const currentTotal = profile.total_drinks_purchased || 0;

                                const totalStamps = currentStamps + eligibleDrinkCount;
                                const earnedNewQuota = Math.floor(totalStamps / 10);
                                const newStampCount = totalStamps % 10;
                                const newQuota = Math.max(0, currentQuota - (useFreeDrinkQuota ? 1 : 0) + earnedNewQuota);
                                const newTotalPurchased = currentTotal + eligibleDrinkCount;

                                await supabase
                                    .from('profiles')
                                    .update({
                                        drink_stamp_count: newStampCount,
                                        free_drink_quota: newQuota,
                                        total_drinks_purchased: newTotalPurchased
                                    })
                                    .eq('id', profileId);

                                if (eligibleDrinkCount > 0) {
                                    toast.success(`☕ อัปเดต Drink Stamp +${eligibleDrinkCount} แก้ว`);
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error("Error updating drink stamps on checkout:", err);
                    // Queue stamp update for offline sync
                    try {
                        let offlineEligibleCount = currentOrder.items.reduce((sum, item) => {
                            if (!item || item.is_reward) return sum;
                            const menuItem = item.menu_items || item;
                            let isEligible = false;
                            if (typeof menuItem.is_drink_stamp_eligible === 'boolean') {
                                isEligible = menuItem.is_drink_stamp_eligible;
                            } else if (typeof item.is_drink_stamp_eligible === 'boolean') {
                                isEligible = item.is_drink_stamp_eligible;
                            } else if (typeof menuItem.menu_categories?.is_drink_stamp_eligible === 'boolean') {
                                isEligible = menuItem.menu_categories.is_drink_stamp_eligible;
                            } else if (typeof item.menu_categories?.is_drink_stamp_eligible === 'boolean') {
                                isEligible = item.menu_categories.is_drink_stamp_eligible;
                            }
                            return isEligible ? sum + (parseInt(item.quantity) || 1) : sum;
                        }, 0);
                        if (useFreeDrinkQuota && offlineEligibleCount > 0) {
                            offlineEligibleCount = Math.max(0, offlineEligibleCount - 1);
                        }
                        if (offlineEligibleCount > 0 || useFreeDrinkQuota) {
                            addToOfflineQueue('drink_stamp_update', {
                                profileId,
                                eligibleDrinkCount: offlineEligibleCount,
                                useFreeDrinkQuota
                            });
                        }
                    } catch (queueErr) {
                        console.error("Failed to queue drink stamp update:", queueErr);
                    }
                }
            }

            localStorage.removeItem('pos_active_table_id');
            let completedBooking = null;
            try {
                const { data } = await supabase
                    .from('bookings')
                    .select('*, tables_layout(*), profiles(*), order_items(*, menu_items(name, category_id, is_drink_stamp_eligible, menu_categories(name, is_drink_stamp_eligible)))')
                    .eq('id', bookingId)
                    .single();
                completedBooking = data;
            } catch (err) {
                console.error("Error fetching completed booking for receipt:", err);
            }

            // Broadcast PAYMENT_SUCCESS to CFD screen
            const cfdSuccessDetail = {
                type: 'PAYMENT_SUCCESS',
                payload: {
                    total: finalTotal,
                    pointsEarned,
                    paymentMethod,
                    cashReceived: paymentMethod === 'cash' ? numCashRecv : 0,
                    changeDue: paymentMethod === 'cash' ? numChangeDue : 0,
                    tableName: selectedTable?.table_name || currentBooking?.tables_layout?.table_name || null,
                    customer: currentBooking?.profiles?.display_name || currentBooking?.pickup_contact_name || currentBooking?.customer_name || 'Walk-in Guest'
                },
                timestamp: Date.now()
            };
            window.dispatchEvent(new CustomEvent('pos-cfd-broadcast', { detail: cfdSuccessDetail }));
            try {
                if (window.AndroidCfdBridge && typeof window.AndroidCfdBridge.sendCfdEvent === 'function') {
                    window.AndroidCfdBridge.sendCfdEvent(JSON.stringify(cfdSuccessDetail));
                }
            } catch (e) {}

            const printBookingData = {
                ...(completedBooking || currentBooking),
                payment_method: paymentMethod,
                cash_received: paymentMethod === 'cash' ? numCashRecv : null,
                cash_change: paymentMethod === 'cash' ? numChangeDue : null
            };

            openSlipOrSilentPrint(printBookingData, 'receipt');

            // Clear the cart state after successful checkout
            setCurrentOrder({ items: [], customer: null, table: null });
            setActiveBooking(null);
            setSelectedTable(null);
            setAttachedMemberCrm(null);
            setView('tables');
        }
        } finally {
            submittingOrderRef.current = false;
            setIsSubmittingOrder(false);
        }
    };

    const handleOpenMoveModal = async () => {
        if (!selectedTable || !activeBooking) return;
        try {
            const { data: allTables } = await supabase.from('tables_layout').select('*').order('table_name');
            const today = new Date().toISOString().split('T')[0];
            const { data: activeBookings } = await supabase
                .from('bookings')
                .select('*')
                .in('status', ['pending', 'confirmed', 'seated', 'ready'])
                .gte('booking_time', `${today}T00:00:00+07:00`);

            const occupiedTableIds = (activeBookings || []).map(b => b.table_id);
            const free = (allTables || []).filter(t => !occupiedTableIds.includes(t.id));
            setAvailableTables(free);
            setShowMoveModal(true);
        } catch (err) {
            console.error("Failed to load tables for move, fallback to cache:", err);
            try {
                const cachedTables = posCache.getTables() || [];
                const cachedBookings = posCache.getBookings() || [];
                const occupiedIds = cachedBookings.map(b => b.table_id);
                const free = cachedTables.filter(t => !occupiedIds.includes(t.id));
                setAvailableTables(free);
                setShowMoveModal(true);
            } catch (e) {
                toast.error("ไม่สามารถดึงข้อมูลโต๊ะได้ในขณะนี้");
            }
        }
    };

    const handleExecuteMoveTable = async (targetTable) => {
        if (!activeBooking || !selectedTable) return;
        const toastId = toast.loading(`กำลังย้ายจากโต๊ะ ${selectedTable.table_name} ไปโต๊ะ ${targetTable.table_name}...`);
        const updatedRemark = formatMoveRemark(activeBooking.staff_remark, selectedTable.table_name, targetTable.table_name);
        
        if (!isOnline()) {
            const cachedBookings = posCache.getBookings() || [];
            const updated = cachedBookings.map(b => {
                if (b.id === activeBooking.id) {
                    return { ...b, table_id: targetTable.id, staff_remark: updatedRemark };
                }
                return b;
            });
            posCache.setBookings(updated);
            
            addToOfflineQueue('move_table', { bookingId: activeBooking.id, tableId: targetTable.id, staff_remark: updatedRemark });
            
            toast.success(`⚠️ ออฟไลน์: ย้ายโต๊ะสำเร็จ!`, { id: toastId });
            setShowMoveModal(false);
            setSelectedTable(targetTable);
            setRefreshKey(prev => prev + 1);
            return;
        }

        try {
            const { error } = await supabase
                .from('bookings')
                .update({ 
                    table_id: targetTable.id,
                    staff_remark: updatedRemark
                })
                .eq('id', activeBooking.id);
                
            if (error) throw error;
            
            toast.success(`ย้ายโต๊ะสำเร็จ ไปที่โต๊ะ ${targetTable.table_name}`, { id: toastId });
            setShowMoveModal(false);
            setSelectedTable(targetTable);
            setRefreshKey(prev => prev + 1);
        } catch (err) {
            console.error("Move table failed:", err);
            toast.error("ย้ายโต๊ะไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", { id: toastId });
        }
    };

    const handleOpenMergeModal = async () => {
        if (!selectedTable || !activeBooking) return;
        try {
            const { data: allTables } = await supabase.from('tables_layout').select('*').order('table_name');
            const today = new Date().toISOString().split('T')[0];
            const { data: activeBookings } = await supabase
                .from('bookings')
                .select('*')
                .in('status', ['pending', 'confirmed', 'seated', 'ready'])
                .gte('booking_time', `${today}T00:00:00+07:00`);

            const activeBookingMap = {};
            (activeBookings || []).forEach(b => {
                activeBookingMap[b.table_id] = b;
            });

            const occupied = (allTables || [])
                .filter(t => t.id !== selectedTable.id && activeBookingMap[t.id])
                .map(t => ({
                    ...t,
                    booking: activeBookingMap[t.id]
                }));

            setAvailableTables(occupied);
            setShowMergeModal(true);
        } catch (err) {
            console.error("Failed to load tables for merge, fallback to cache:", err);
            try {
                const cachedTables = posCache.getTables() || [];
                const cachedBookings = posCache.getBookings() || [];
                const activeMap = {};
                cachedBookings.forEach(b => { activeMap[b.table_id] = b; });
                const occupied = cachedTables
                    .filter(t => t.id !== selectedTable.id && activeMap[t.id])
                    .map(t => ({
                        ...t,
                        booking: activeMap[t.id]
                    }));
                setAvailableTables(occupied);
                setShowMergeModal(true);
            } catch (e) {
                toast.error("ไม่สามารถดึงข้อมูลโต๊ะได้ในขณะนี้");
            }
        }
    };

    const handleExecuteMergeBill = async (targetTable) => {
        if (!activeBooking || !selectedTable || !targetTable.booking) return;
        const targetBooking = targetTable.booking;
        
        const isConfirmed = window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการรวมบิลจากโต๊ะ ${selectedTable.table_name} เข้ากับโต๊ะ ${targetTable.table_name}?\nรายการอาหารทั้งหมดจะถูกย้าย และโต๊ะ ${selectedTable.table_name} จะว่างลง`);
        if (!isConfirmed) return;

        const toastId = toast.loading(`กำลังรวมบิลโต๊ะ ${selectedTable.table_name} เข้ากับโต๊ะ ${targetTable.table_name}...`);

        const sourceOriginalTotal = parseFloat(activeBooking.total_amount || activeBooking.total_price || 0);
        const targetShortId = getShortBookingId(targetBooking);
        const sourceShortId = getShortBookingId(activeBooking);
        const sourceRemark = formatMergeSourceRemark(targetTable.table_name, targetShortId, sourceOriginalTotal);
        const targetUpdatedRemark = formatMergeTargetRemark(targetBooking.staff_remark, selectedTable.table_name, sourceShortId);

        // CRM Dominance Logic: Select the customer/member with higher points/CRM tier ("เลือกคนที่คะแนนเยอะกว่าเสมอ")
        const dominantCrm = resolveDominantCrmMember(activeBooking, targetBooking, attachedMemberCrm, null);

        if (!isOnline()) {
            const cachedBookings = posCache.getBookings() || [];
            const updatedBookings = cachedBookings.map(b => {
                if (b.id === targetBooking.id) {
                    const sourceItems = activeBooking.order_items || [];
                    const targetItems = b.order_items || [];
                    const mergedItems = [...targetItems, ...sourceItems.map(item => ({ ...item, booking_id: targetBooking.id }))];
                    const newTotal = (parseFloat(b.total_amount || 0) + sourceOriginalTotal);
                    const updatedTarget = { 
                        ...b, 
                        order_items: mergedItems, 
                        staff_remark: targetUpdatedRemark, 
                        total_amount: newTotal 
                    };
                    if (dominantCrm.wasSourceChosen && dominantCrm.dominantMember) {
                        updatedTarget.user_id = dominantCrm.dominantMember.id || dominantCrm.dominantMember.user_id;
                        updatedTarget.profiles = dominantCrm.dominantMember;
                        if (dominantCrm.dominantMember.display_name) {
                            updatedTarget.pickup_contact_name = dominantCrm.dominantMember.display_name;
                        }
                        if (dominantCrm.dominantMember.phone_number) {
                            updatedTarget.pickup_contact_phone = dominantCrm.dominantMember.phone_number;
                        }
                    }
                    return updatedTarget;
                }
                if (b.id === activeBooking.id) {
                    return { ...b, status: 'void', staff_remark: sourceRemark, total_amount: 0, order_items: [] };
                }
                return b;
            });
            
            posCache.setBookings(updatedBookings);
            addToOfflineQueue('merge_bills', { 
                sourceBookingId: activeBooking.id, 
                targetBookingId: targetBooking.id,
                sourceRemark,
                targetRemark: targetUpdatedRemark,
                sourceOriginalTotal,
                dominantMember: dominantCrm.wasSourceChosen ? dominantCrm.dominantMember : null
            });
            
            const offlineSuccessMsg = dominantCrm.wasSourceChosen && dominantCrm.dominantMember
                ? `⚠️ ออฟไลน์: รวมบิลสำเร็จ! (เลือกสมาชิก ${dominantCrm.dominantMember.display_name || 'บิลต้นทาง'} ที่มีคะแนนเยอะกว่า)`
                : `⚠️ ออฟไลน์: รวมบิลสำเร็จ!`;
            toast.success(offlineSuccessMsg, { id: toastId });
            setShowMergeModal(false);
            setSelectedTable(targetTable);
            setRefreshKey(prev => prev + 1);
            return;
        }

        try {
            // 1. Move all order items to target booking
            const { error: itemsErr } = await supabase
                .from('order_items')
                .update({ booking_id: targetBooking.id })
                .eq('booking_id', activeBooking.id);
                
            if (itemsErr) throw itemsErr;

            // 2. Mark source booking as void with clean remark & clear total_amount
            const { error: voidErr } = await supabase
                .from('bookings')
                .update({ 
                    status: 'void', 
                    staff_remark: sourceRemark,
                    total_amount: 0
                })
                .eq('id', activeBooking.id);
                
            if (voidErr) throw voidErr;

            // 3. Update target booking remark, total amount & dominant CRM member
            const newTargetTotal = parseFloat(targetBooking.total_amount || 0) + sourceOriginalTotal;
            const targetUpdatePayload = {
                staff_remark: targetUpdatedRemark,
                total_amount: newTargetTotal
            };

            if (dominantCrm.wasSourceChosen && dominantCrm.dominantMember) {
                const dominantId = dominantCrm.dominantMember.id || dominantCrm.dominantMember.user_id;
                if (dominantId) targetUpdatePayload.user_id = dominantId;
                if (dominantCrm.dominantMember.display_name) {
                    targetUpdatePayload.pickup_contact_name = dominantCrm.dominantMember.display_name;
                }
                if (dominantCrm.dominantMember.phone_number) {
                    targetUpdatePayload.pickup_contact_phone = dominantCrm.dominantMember.phone_number;
                }
            }

            const { error: targetErr } = await supabase
                .from('bookings')
                .update(targetUpdatePayload)
                .eq('id', targetBooking.id);

            if (targetErr) {
                console.warn("Could not update target booking remark, continuing:", targetErr);
            }
            
            const successMsg = dominantCrm.wasSourceChosen && dominantCrm.dominantMember
                ? `รวมบิลสำเร็จ! ระบบเลือกสมาชิก ${dominantCrm.dominantMember.display_name || 'บิลต้นทาง'} (คะแนนสะสมเยอะกว่า) เป็นสมาชิกหลักของโต๊ะ ${targetTable.table_name}`
                : `รวมบิลเข้าโต๊ะ ${targetTable.table_name} สำเร็จ!`;

            toast.success(successMsg, { id: toastId, duration: 4500 });
            setShowMergeModal(false);
            setSelectedTable(targetTable);
            setRefreshKey(prev => prev + 1);
        } catch (err) {
            console.error("Merge bills failed:", err);
            toast.error("รวมบิลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", { id: toastId });
        }
    };

    const handleExecuteSplitPayment = async (splitPayload) => {
        if (!activeBooking) {
            console.warn("[Split Payment] No active booking to settle");
            toast.error("ไม่พบบิลที่เปิดอยู่สำหรับแบ่งชำระ");
            return;
        }
        const {
            splitMode = 'EQUAL',
            splitTotal = 0,
            paymentMethod = 'cash',
            cashReceived = 0,
            changeDue = 0,
            attachedMember = null,
            splitMeta = {}
        } = splitPayload;

        const roundNum = splitMeta.roundNumber || 1;
        const toastId = toast.loading(`กำลังบันทึกชำระก้อนที่ ${roundNum}...`);

        if (paymentMethod === 'cash') {
            localStorage.setItem('last_cash_received', cashReceived);
            localStorage.setItem('last_cash_change', changeDue);
        }

        const remainingBalanceAfter = splitMeta.remainingBalanceAfterSplit !== undefined ? splitMeta.remainingBalanceAfterSplit : 0;
        const isFullySettled = remainingBalanceAfter <= 0;

        const updatedParentRemark = appendSplitRoundToRemark(activeBooking.staff_remark || '', {
            round: roundNum,
            amount: splitTotal,
            method: paymentMethod,
            mode: splitMode,
            percent: splitMeta.selectedPercent || null,
            payer: attachedMember?.display_name || attachedMember?.phone_number || null,
            time: new Date().toISOString()
        });

        // 1. OFFLINE HANDLING
        if (!isOnline()) {
            const cachedBookings = JSON.parse(localStorage.getItem('pos_cache_active_bookings')) || [];
            const updatedBookings = cachedBookings.map(b => {
                if (b.id === activeBooking.id) {
                    return {
                        ...b,
                        status: isFullySettled ? 'completed' : b.status,
                        staff_remark: updatedParentRemark
                    };
                }
                return b;
            }).filter(b => isFullySettled ? b.id !== activeBooking.id : true);
            localStorage.setItem('pos_cache_active_bookings', JSON.stringify(updatedBookings));

            addToOfflineQueue('split_payment', {
                bookingId: activeBooking.id,
                splitMode,
                paymentMethod,
                totalAmount: splitTotal,
                isFullySettled,
                bookingMetadata: {
                    table_id: activeBooking.table_id || selectedTable?.id || null,
                    booking_type: activeBooking.booking_type || 'walk_in',
                    pax: activeBooking.pax || 0,
                    user_id: attachedMember?.id || activeBooking.user_id || null,
                    staff_remark: updatedParentRemark
                }
            });

            recordShiftTransaction(activeBooking.id, splitTotal, paymentMethod);

            toast.success(`⚠️ ออฟไลน์: บันทึกแบ่งจ่ายก้อนที่ ${roundNum} (฿${splitTotal.toLocaleString()}) สำเร็จ!`, { id: toastId });
            
            if (isFullySettled) {
                const cleanedParentRemark = updatedParentRemark
                    .replace(/\[CALL_BILL\]/gi, '')
                    .replace(/\[CALL_STAFF\]/gi, '')
                    .trim();
                const allSplitRounds = getBookingSplitRounds({ staff_remark: cleanedParentRemark });
                const splitMethods = [...new Set((allSplitRounds || []).map(r => (r.method || 'qr').toLowerCase()))];
                const resolvedPaymentMethod = splitMethods.length === 1 ? splitMethods[0] : (splitMethods.length > 1 ? 'split' : (paymentMethod || 'qr'));

                setShowSplitModal(false);
                openSlipOrSilentPrint({ ...activeBooking, payment_method: resolvedPaymentMethod, staff_remark: cleanedParentRemark, status: 'completed' }, 'receipt');
                
                // Full cleanup of Order Details and Table state
                setCurrentOrder({ items: [], customer: null, table: null });
                setActiveBooking(null);
                activeBookingRef.current = null;
                setSelectedTable(null);
                setAttachedMemberCrm(null);
                localStorage.removeItem('pos_active_table_id');
                setView('tables');

                // Reset CFD to IDLE
                const cfdIdleDetail = { type: 'IDLE', timestamp: Date.now() };
                window.dispatchEvent(new CustomEvent('pos-cfd-broadcast', { detail: cfdIdleDetail }));
                try {
                    if (window.AndroidCfdBridge && typeof window.AndroidCfdBridge.sendCfdEvent === 'function') {
                        window.AndroidCfdBridge.sendCfdEvent(JSON.stringify(cfdIdleDetail));
                    }
                } catch (e) {}
            } else {
                const nextBooking = { ...activeBooking, staff_remark: updatedParentRemark };
                setActiveBooking(nextBooking);
                activeBookingRef.current = nextBooking;
            }
            setRefreshKey(prev => prev + 1);
            return;
        }

        // 2. ONLINE SUPABASE HANDLING: SINGLE BILL GUARANTEE (NO SUB-BOOKINGS)
        try {
            // Record shift transaction against this bill
            recordShiftTransaction(activeBooking.id, splitTotal, paymentMethod);

            if (isFullySettled) {
                const cleanedParentRemark = updatedParentRemark
                    .replace(/\[CALL_BILL\]/gi, '')
                    .replace(/\[CALL_STAFF\]/gi, '')
                    .trim();
                const allSplitRounds = getBookingSplitRounds({ staff_remark: cleanedParentRemark });
                const splitMethods = [...new Set((allSplitRounds || []).map(r => (r.method || 'qr').toLowerCase()))];
                const resolvedPaymentMethod = splitMethods.length === 1 ? splitMethods[0] : (splitMethods.length > 1 ? 'split' : (paymentMethod || 'qr'));

                // Fully paid: Close the bill
                const { error: completeErr } = await supabase
                    .from('bookings')
                    .update({ 
                        status: 'completed',
                        payment_method: resolvedPaymentMethod,
                        staff_remark: cleanedParentRemark
                    })
                    .eq('id', activeBooking.id);

                if (completeErr) throw completeErr;

                if (selectedTable?.id) {
                    await supabase
                        .from('tables_layout')
                        .update({ status: 'available' })
                        .eq('id', selectedTable.id);
                }

                toast.success(`🎉 ชำระครบถ้วน ปิดบิลเรียบร้อยแล้ว! (ก้อนที่ ${roundNum} ฿${splitTotal.toLocaleString()})`, { id: toastId });
                setShowSplitModal(false);
                openSlipOrSilentPrint({ ...activeBooking, payment_method: resolvedPaymentMethod, staff_remark: cleanedParentRemark, status: 'completed' }, 'receipt');
                
                // Full cleanup of Order Details and Table state
                setCurrentOrder({ items: [], customer: null, table: null });
                setActiveBooking(null);
                activeBookingRef.current = null;
                setSelectedTable(null);
                setAttachedMemberCrm(null);
                localStorage.removeItem('pos_active_table_id');
                setView('tables');

                // Reset CFD to IDLE
                const cfdIdleDetail = { type: 'IDLE', timestamp: Date.now() };
                window.dispatchEvent(new CustomEvent('pos-cfd-broadcast', { detail: cfdIdleDetail }));
                try {
                    if (window.AndroidCfdBridge && typeof window.AndroidCfdBridge.sendCfdEvent === 'function') {
                        window.AndroidCfdBridge.sendCfdEvent(JSON.stringify(cfdIdleDetail));
                    }
                } catch (e) {}
            } else {
                // Partial chunk: Update staff remark with the new split round
                const { error: updateErr } = await supabase
                    .from('bookings')
                    .update({ 
                        staff_remark: updatedParentRemark
                    })
                    .eq('id', activeBooking.id);
                
                if (updateErr) throw updateErr;

                toast.success(`บันทึกชำระก้อนที่ ${roundNum} ฿${splitTotal.toLocaleString()} สำเร็จ! คงเหลือ ฿${remainingBalanceAfter.toLocaleString()}`, { id: toastId });
                
                // Update in-memory state so modal immediately shows the next round & reduced balance
                const updatedBooking = { ...activeBooking, staff_remark: updatedParentRemark };
                setActiveBooking(updatedBooking);
                activeBookingRef.current = updatedBooking;
            }

            setRefreshKey(prev => prev + 1);
        } catch (err) {
            console.error("Split payment failed:", err);
            const errDetail = err?.message ? ` (${err.message})` : '';
            toast.error(`บันทึกแบ่งจ่ายไม่สำเร็จ${errDetail} กรุณาลองใหม่อีกครั้ง`, { id: toastId });
        }
    };

    const handlePrintSplitQr = async (splitDetails) => {
        if (!activeBooking) return false;
        return await printSplitQrSlip(activeBooking, splitDetails);
    };

    return (
        <div className="h-screen w-full bg-[#ECECE9] text-[#1A1A1A] overflow-hidden flex flex-col font-sans select-none">
            
            <POSLayout 
                activeView={view} 
                onlinePendingCount={onlinePendingCount}
                onViewChange={(v) => {
                    if (v === 'tables') {
                        handleBackToTables();
                    } else if (v === 'menu' && view === 'tables') {
                        // Clicking Menu directly from Tables sidebar starts a clean Direct/Pickup order
                        setSelectedTable(null);
                        setActiveBooking(null);
                        setCurrentOrder({ items: [], customer: 'Walk-in Pick-up', table: null });
                        setAttachedMemberCrm(null);
                        localStorage.removeItem('pos_active_table_id');
                        setView('menu');
                    } else {
                        setView(v);
                    }
                }}
                selectedTable={selectedTable}
                onBack={handleBackToTables}
            >
                <div className="flex h-full w-full overflow-hidden pos-view-container">
                    {/* Main Content Area */}
                    <div className="flex-1 h-full overflow-hidden relative pos-panel-layer">
                        {/* Core views kept mounted for instant switching */}
                        <div className={view === 'tables' ? 'h-full w-full pos-panel-layer' : 'hidden'}>
                            <POSTableGrid 
                                onSelectTable={handleSelectTable} 
                                hasPendingOrders={hasPendingOrders} 
                                refreshKey={refreshKey}
                                onOpenNotifDrawer={() => {
                                    setShowNotifDrawer(true);
                                    setUnreadNotifCount(0);
                                }}
                                unreadNotifCount={unreadNotifCount}
                            />
                        </div>
                        <div className={view === 'menu' ? 'h-full w-full pos-panel-layer' : 'hidden'}>
                            <POSMenuGrid onAddItem={handleAddToOrder} />
                        </div>

                        {/* Extended panels with layer isolation */}
                        <div className={view === 'open_bills' ? 'h-full w-full pos-panel-layer' : 'hidden'}>
                            <POSOpenBillsGrid 
                                isActive={view === 'open_bills'}
                                onSelectOrder={handleSelectOpenBill} 
                                onOpenSlip={(booking, slipType) => {
                                    openSlipOrSilentPrint(booking, slipType);
                                }} 
                                refreshKey={refreshKey} 
                            />
                        </div>
                        <div className={view === 'crm' ? 'h-full w-full pos-panel-layer' : 'hidden'}>
                            <POSCRMPanel 
                                isActive={view === 'crm'}
                                onAttachToOrder={(member) => {
                                    handleSelectCrmCustomer(member);
                                    setView('menu');
                                }}
                            />
                        </div>
                        <div className={view === 'reports' ? 'h-full w-full pos-panel-layer' : 'hidden'}>
                            <POSReportsPanel isActive={view === 'reports'} refreshKey={refreshKey} />
                        </div>
                        <div className={view === 'online_hub' ? 'h-full w-full pos-panel-layer' : 'hidden'}>
                            <POSOnlineHub 
                                isActive={view === 'online_hub'}
                                activeShift={activeShift} 
                                onOpenSlipModal={(booking, slipType) => {
                                    openSlipOrSilentPrint(booking, slipType);
                                }}
                                onViewSlipImage={(url) => setViewSlipImageUrl(url)}
                                onSelectOrder={handleSelectOpenBill}
                                refreshKey={refreshKey}
                            />
                        </div>
                    </div>

                    {/* Order Panel Sidebar - Persistently mounted with GPU layer to prevent layout reflow jumping */}
                    <div className={view !== 'reports' && view !== 'crm' && view !== 'open_bills' && view !== 'online_hub' ? 'h-full shrink-0 flex pos-panel-layer' : 'hidden'}>
                        <POSOrderPanel 
                            order={currentOrder} 
                            booking={activeBooking}
                            isSubmitting={isSubmittingOrder}
                            attachedMemberCrm={attachedMemberCrm}
                            onSelectCrmCustomer={handleSelectCrmCustomer}
                            onUpdateQuantity={handleUpdateQuantity}
                            onUpdateItemNote={handleUpdateItemNote}
                            onClear={handleClearOrderOrTable}
                            onCheckout={handleCheckout}
                            onOpenMenu={() => setView('menu')}
                            onInjectRewardItem={handleInjectRewardItem}
                            onRemoveRewardItem={handleRemoveRewardItem}
                            onAddEmergencyItem={handleAddToOrder}
                            onAcceptOrder={async () => {
                                if (isSubmittingOrder) return;
                                setIsSubmittingOrder(true);
                                try {
                                    if (activeBooking) {
                                        const success = await acceptOrder(activeBooking.id);
                                    if (success) {
                                        let updatedBooking = null;
                                        if (selectedTable) {
                                            updatedBooking = await getActiveBooking(selectedTable.id);
                                        } else {
                                            const { data } = await supabase.from('bookings').select('*, tables_layout(*), profiles(*), order_items(*, menu_items(name, category_id, is_drink_stamp_eligible, menu_categories(name, is_drink_stamp_eligible)))').eq('id', activeBooking.id).single();
                                            updatedBooking = data;
                                        }
                                        
                                        if (updatedBooking) {
                                            setActiveBooking(updatedBooking);
                                        }
                                        
                                        const finalBooking = updatedBooking || activeBooking;
                                        
                                        // Try silent print first for Kitchen (ONLY for items not already auto-printed)
                                        const storageKey = `qr_printed_items_${activeBooking.id}`;
                                        let printed = [];
                                        try {
                                            printed = JSON.parse(localStorage.getItem(storageKey) || '[]');
                                        } catch (e) {}
                                        
                                        const allItems = finalBooking.order_items || [];
                                        const unprinted = allItems.filter(i => i.id && !printed.includes(i.id));
                                        
                                        if (unprinted.length > 0) {
                                            const newPrinted = Array.from(new Set([...printed, ...unprinted.map(i => i.id).filter(Boolean)]));
                                            localStorage.setItem(storageKey, JSON.stringify(newPrinted));
                                            openSlipOrSilentPrint({ ...finalBooking, order_items: unprinted }, 'kitchen');
                                        }
                                        
                                        // Broadcast ORDER_CONFIRMED to CFD so customer sees confirmation and screen auto-resets to IDLE
                                        const cfdConfirmedDetail = {
                                            type: 'ORDER_CONFIRMED',
                                            payload: {
                                                tableName: selectedTable?.table_name || finalBooking.tables_layout?.table_name || 'Counter Order',
                                                customer: finalBooking.profiles?.display_name || finalBooking.pickup_contact_name || finalBooking.customer_name || 'Walk-in Guest',
                                                itemCount: unprinted.length > 0 ? unprinted.length : (finalBooking.order_items?.length || 0),
                                                totalAmount: (finalBooking.order_items || []).reduce((sum, i) => sum + (parseFloat(i.price_at_time ?? i.price) * (i.quantity || 1)), 0),
                                                bookingId: activeBooking.id
                                            },
                                            timestamp: Date.now()
                                        };
                                        window.dispatchEvent(new CustomEvent('pos-cfd-broadcast', { detail: cfdConfirmedDetail }));
                                        try {
                                            if (window.AndroidCfdBridge && typeof window.AndroidCfdBridge.sendCfdEvent === 'function') {
                                                window.AndroidCfdBridge.sendCfdEvent(JSON.stringify(cfdConfirmedDetail));
                                            }
                                        } catch (e) {}

                                        checkPendingOrders();
                                        }
                                    }
                                } finally {
                                    setIsSubmittingOrder(false);
                                }
                            }}
                            onOpenSlip={handleSaveAndOpenSlip}
                            onOpenSplitPayment={(tax) => { setSplitIncludeTax(tax ?? true); setShowSplitModal(true); }}
                            onMoveTable={handleOpenMoveModal}
                            onMergeBill={handleOpenMergeModal}
                            onAttachCustomer={async (member) => {
                                if (!member?.id) return;
                                let fullMember = member;
                                try {
                                    const { data, error } = await supabase.rpc('get_member_tier_details', { p_user_id: member.id });
                                    if (!error && data && data.length > 0) {
                                        fullMember = { ...member, ...data[0] };
                                    }
                                } catch (e) {}
                                setAttachedMemberCrm(fullMember);
                                let bookingId = activeBooking?.id;

                                if (!bookingId) {
                                    if (selectedTable) {
                                        const newBooking = await createWalkIn(selectedTable, null, member.id);
                                        if (newBooking) {
                                            bookingId = newBooking.id;
                                            setActiveBooking({ ...newBooking, user_id: member.id, profiles: fullMember });
                                            setAttachedMemberCrm(fullMember);
                                            await attachCustomerToBooking(bookingId, member.id);
                                        }
                                    } else {
                                        setActiveBooking({ id: null, user_id: member.id, profiles: member, booking_type: 'pickup', pax: 1 });
                                        toast.success(`ผูกสมาชิก: ${member.display_name || member.phone || 'Customer'}`);
                                        return;
                                    }
                                } else {
                                    const success = await attachCustomerToBooking(bookingId, member.id);
                                    if (success) {
                                        setAttachedMemberCrm(member);
                                        let updatedBooking = null;
                                        if (selectedTable?.id) {
                                            updatedBooking = await getActiveBooking(selectedTable.id);
                                        } else if (!String(bookingId).startsWith('local_')) {
                                            const { data } = await supabase
                                                .from('bookings')
                                                .select('*, tables_layout(*), profiles(*), order_items(*, menu_items(name, category_id, is_drink_stamp_eligible, menu_categories(name, is_drink_stamp_eligible)))')
                                                .eq('id', bookingId)
                                                .maybeSingle();
                                            updatedBooking = data;
                                        }
                                        if (updatedBooking) {
                                            setActiveBooking({ ...updatedBooking, user_id: member.id, profiles: member });
                                        } else {
                                            setActiveBooking(prev => prev ? { ...prev, user_id: member.id, profiles: member } : prev);
                                        }
                                    }
                                }
                            }}
                            onDetachCustomer={async () => {
                                setAttachedMemberCrm(null);
                                if (activeBooking) {
                                    const success = await attachCustomerToBooking(activeBooking.id, null);
                                    if (success) {
                                        if (selectedTable?.id) {
                                            const updatedBooking = await getActiveBooking(selectedTable.id);
                                            setActiveBooking(updatedBooking ? { ...updatedBooking, user_id: null, profiles: null } : null);
                                        } else if (!String(activeBooking.id).startsWith('local_')) {
                                            const { data } = await supabase
                                                .from('bookings')
                                                .select('*, tables_layout(*), profiles(*), order_items(*, menu_items(name, category_id, is_drink_stamp_eligible, menu_categories(name, is_drink_stamp_eligible)))')
                                                .eq('id', activeBooking.id)
                                                .maybeSingle();
                                            if (data) setActiveBooking({ ...data, user_id: null, profiles: null });
                                            else setActiveBooking(prev => prev ? { ...prev, user_id: null, profiles: null } : null);
                                        } else {
                                            setActiveBooking(prev => prev ? { ...prev, user_id: null, profiles: null } : null);
                                        }
                                    }
                                }
                            }}
                            onUpdateCustomerProfile={async () => {
                                if (activeBooking) {
                                    if (selectedTable?.id) {
                                        const updatedBooking = await getActiveBooking(selectedTable.id);
                                        setActiveBooking(updatedBooking);
                                    } else {
                                        const { data } = await supabase
                                            .from('bookings')
                                            .select('*, tables_layout(*), profiles(*), order_items(*, menu_items(name, category_id, is_drink_stamp_eligible, menu_categories(name, is_drink_stamp_eligible)))')
                                            .eq('id', activeBooking.id)
                                            .maybeSingle();
                                        if (data) setActiveBooking(data);
                                    }
                                }
                            }}
                        />
                    </div>
                </div>
            </POSLayout>

            {/* Walk-in Pickup Modal */}
            {showPickupModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl w-full max-w-sm shadow-2xl font-sans text-[#1A1A1A] animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b border-[#D1D1CD] flex items-center justify-between">
                            <div>
                                <h3 className="font-mono font-bold text-xs uppercase tracking-wider">New Walk-in Pickup</h3>
                                <p className="text-[10px] text-[#767673] font-mono mt-0.5">รับกลับบ้าน (สั่งหน้าร้าน)</p>
                            </div>
                            <button onClick={() => setShowPickupModal(false)} className="p-1 hover:bg-[#EAEAE6] rounded-lg text-[#767673]">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-6">
                            <label className="block text-xs font-mono font-bold text-[#767673] uppercase mb-1.5">
                                Customer Name / Note (Optional)
                            </label>
                            <input 
                                type="text"
                                placeholder="Walk-in Pick-up"
                                value={pickupNoteInput}
                                onChange={(e) => setPickupNoteInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') confirmNewWalkInPickup();
                                }}
                                className="w-full bg-white border border-[#D1D1CD] rounded-xl px-3.5 py-3 text-sm font-mono font-bold text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
                                autoFocus
                            />
                        </div>
                        <div className="p-4 border-t border-[#D1D1CD] bg-[#EBEBE9] flex gap-2">
                            <button
                                onClick={() => setShowPickupModal(false)}
                                className="flex-1 bg-white border border-[#D1D1CD] text-[#1A1A1A] py-3 rounded-xl font-mono text-xs font-bold uppercase tracking-wider hover:bg-[#F5F5F2] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmNewWalkInPickup}
                                className="flex-1 bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white py-3 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-colors shadow-md"
                            >
                                Create Order
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Notification History Drawer Modal */}
            {showNotifDrawer && (
                <div className="fixed inset-0 bg-black/60 z-50 flex justify-end">
                    <div className="bg-[#F5F5F2] border-l border-[#D1D1CD] w-full max-w-md h-full shadow-2xl font-sans text-[#1A1A1A] flex flex-col animate-in slide-in-from-right duration-200">
                        <div className="p-4 border-b border-[#D1D1CD] flex items-center justify-between bg-white">
                            <div>
                                <h3 className="font-mono font-bold text-xs uppercase tracking-wider">Notification History</h3>
                                <p className="text-[10px] text-[#767673] font-mono mt-0.5">ประวัติการแจ้งเตือนล่าสุด (30 รายการ)</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setNotificationHistory([])} 
                                    className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#767673] hover:text-[#1A1A1A] px-2 py-1 border border-[#D1D1CD] rounded-lg"
                                >
                                    Clear
                                </button>
                                <button onClick={() => setShowNotifDrawer(false)} className="p-1 hover:bg-[#EAEAE6] rounded-lg text-[#767673]">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                            {notificationHistory.length === 0 ? (
                                <div className="text-center py-12 text-[#767673] font-mono text-xs uppercase">
                                    No Recent Notifications
                                </div>
                            ) : (
                                notificationHistory.map(n => (
                                    <div 
                                        key={n.id} 
                                        onClick={() => {
                                            if (n.tableId) {
                                                setShowNotifDrawer(false);
                                                supabase.from('tables_layout').select('*').eq('id', n.tableId).single().then(({ data }) => {
                                                    if (data) handleSelectTable(data);
                                                });
                                            }
                                        }}
                                        className="bg-white border border-[#D1D1CD] rounded-xl p-3.5 shadow-sm flex flex-col gap-1 hover:border-[#1A1A1A] cursor-pointer transition-all"
                                    >
                                        <div className="flex justify-between items-center border-b border-[#E0E0DC] pb-1.5">
                                            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#767673]">{n.title}</span>
                                            <span className="text-[9px] font-mono text-[#767673]">{n.time}</span>
                                        </div>
                                        <div className="text-xs font-bold text-[#1A1A1A] pt-0.5">{n.message}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeSlipBooking && (
                <SlipModal 
                    booking={activeSlipBooking}
                    type={activeSlipType}
                    onClose={() => {
                        const isSplit = activeSlipBooking?.staff_remark?.includes('Split Paid');
                        setActiveSlipBooking(null);
                        if (activeSlipType === 'receipt' && !isSplit) {
                            handleBackToTables();
                        }
                    }}
                />
            )}

            {viewSlipImageUrl && (
                <ViewSlipModal 
                    url={viewSlipImageUrl}
                    onClose={() => setViewSlipImageUrl(null)}
                />
            )}

            <POSOfflineQueueDrawer 
                isOpen={showOfflineQueueDrawer}
                onClose={() => setShowOfflineQueueDrawer(false)}
            />

            {/* Open Table Modal */}
            {openTableModalData && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 select-none font-sans">
                    <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-[#1A1A1A]">
                        <div className="p-4 border-b border-[#D1D1CD] flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-[#3C3D40] text-white flex items-center justify-center font-mono font-bold text-sm shadow-sm">
                                    {openTableModalData.table.table_name}
                                </div>
                                <div>
                                    <h3 className="font-mono font-bold text-xs uppercase tracking-wider">เปิดโต๊ะ (Open Table)</h3>
                                    <p className="text-[10px] text-[#767673] font-mono mt-0.5">
                                        ความจุแนะนำ: {openTableModalData.table.capacity || 2} คน
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                    setOpenTableModalData(null);
                                }} 
                                className="p-1.5 hover:bg-[#EAEAE6] rounded-lg text-[#767673] hover:text-[#1A1A1A] transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        
                        <div className="p-6 flex flex-col items-center gap-4">
                            <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#1A1A1A] flex items-center gap-1.5">
                                <Users size={16} className="text-[#3C3D40]" />
                                <span>ระบุจำนวนลูกค้า (คน) *</span>
                            </div>
                            
                            {/* Large Stepper Control */}
                            <div className="flex items-center gap-4 my-2">
                                <button 
                                    onClick={() => setOpenTablePaxInput(prev => String(Math.max(1, (parseInt(prev) || 1) - 1)))}
                                    className="w-12 h-12 rounded-xl bg-white border border-[#D1D1CD] hover:border-[#1A1A1A] text-2xl font-bold flex items-center justify-center active:scale-95 transition-all shadow-sm cursor-pointer select-none"
                                >
                                    -
                                </button>
                                <input 
                                    type="number"
                                    min="1"
                                    max="99"
                                    value={openTablePaxInput}
                                    onChange={(e) => setOpenTablePaxInput(e.target.value)}
                                    className="w-24 h-12 bg-white border-2 border-[#3C3D40] rounded-xl text-center text-2xl font-mono font-black text-[#1A1A1A] focus:outline-none focus:border-[#52281C] shadow-inner"
                                    autoFocus
                                />
                                <button 
                                    onClick={() => setOpenTablePaxInput(prev => String((parseInt(prev) || 1) + 1))}
                                    className="w-12 h-12 rounded-xl bg-white border border-[#D1D1CD] hover:border-[#1A1A1A] text-2xl font-bold flex items-center justify-center active:scale-95 transition-all shadow-sm cursor-pointer select-none"
                                >
                                    +
                                </button>
                            </div>

                            {/* Preset Quick Buttons */}
                            <div className="grid grid-cols-5 gap-2 w-full mt-2">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                    <button
                                        key={num}
                                        onClick={() => setOpenTablePaxInput(String(num))}
                                        className={`py-2.5 rounded-xl font-mono font-bold text-sm transition-all cursor-pointer ${parseInt(openTablePaxInput) === num ? 'bg-[#3C3D40] text-white shadow-md scale-[1.03]' : 'bg-white border border-[#D1D1CD] hover:border-[#1A1A1A] text-[#1A1A1A]'}`}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 border-t border-[#D1D1CD] bg-[#EBEBE9] flex gap-3">
                            <button
                                onClick={() => {
                                    setOpenTableModalData(null);
                                }}
                                className="flex-1 bg-white border border-[#D1D1CD] text-[#767673] hover:text-[#1A1A1A] py-3 rounded-xl font-mono text-xs font-bold uppercase transition-all cursor-pointer shadow-sm active:scale-98"
                            >
                                ยกเลิก (Cancel)
                            </button>
                            <button
                                onClick={handleConfirmOpenTable}
                                className="flex-1 bg-[#3C3D40] hover:bg-[#1A1A1A] text-white py-3 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                            >
                                <Check size={16} /> เปิดโต๊ะ (Open Table) *
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 🔔 Incoming Online Bookings Floating Pop-up Overlay Modal (Dieter Rams Ultra-Minimalist + Thai Modern Style, Hallmark Approved - ZERO ICONS) */}
            {/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · minimal-rams-zero-icons */}
            {showPendingModal && pendingBookingsList.length > 0 && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 font-sans select-none animate-in fade-in zoom-in-95 duration-150">
                    <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-[oklch(18%_0.012_28)]">
                        {/* Rams Matte Dark Ink Header (No Icons) */}
                        <div className="bg-[oklch(18%_0.012_28)] px-5 py-4 text-[oklch(97%_0.008_28)] flex justify-between items-center shrink-0 border-b border-[oklch(85%_0.012_28)]">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-sm tracking-tight text-[oklch(97%_0.008_28)] uppercase">
                                        คิวจอง & ออเดอร์ออนไลน์รอยืนยัน
                                    </h3>
                                    <span className="bg-[oklch(52%_0.16_28)] text-white px-2 py-0.5 rounded-md text-xs font-mono font-bold">
                                        {pendingBookingsList.length}
                                    </span>
                                </div>
                                <p className="text-[10px] text-[oklch(55%_0.010_28)] font-mono mt-0.5 tracking-tight">
                                    กล่องตรวจสอบส่วนตัว (แยกเดี่ยว ไม่กระทบผังโต๊ะหน้าร้าน)
                                </p>
                            </div>
                            <button
                                onClick={() => setShowPendingModal(false)}
                                className="px-2.5 py-1 text-[11px] font-mono font-bold text-[oklch(55%_0.010_28)] hover:text-[oklch(97%_0.008_28)] hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                            >
                                [ ปิด ]
                            </button>
                        </div>

                        {/* Scrollable Pending Cards List */}
                        <div className="p-4 overflow-y-auto space-y-3 flex-1 bg-[oklch(94%_0.010_28)] scrollbar-none">
                            {pendingBookingsList.map((item, idx) => {
                                const isPickup = item.booking_type === 'pickup';
                                const isEasySlipVerified = Boolean(item.slip_verified || (item.staff_remark && item.staff_remark.includes('EasySlip')));
                                const isStaffVerified = Boolean(item.staff_remark && item.staff_remark.includes('[SLIP_VERIFIED]'));
                                const isVerified = isEasySlipVerified || isStaffVerified;
                                const hasSlip = Boolean(item.payment_slip_url);

                                return (
                                    <div key={item.id || idx} className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-xl p-4 shadow-sm flex flex-col gap-3">
                                        {/* Card Top Details (No Icons) */}
                                        <div className="flex justify-between items-start border-b border-[oklch(85%_0.012_28)] pb-2.5">
                                            <div>
                                                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap font-mono">
                                                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border inline-block ${
                                                        isPickup 
                                                            ? 'bg-blue-100 text-blue-900 border-blue-200' 
                                                            : 'bg-[oklch(52%_0.16_28)]/10 text-[oklch(52%_0.16_28)] border-[oklch(52%_0.16_28)]/20'
                                                    }`}>
                                                        {isPickup ? 'PICKUP (รับกลับบ้าน)' : 'DINE-IN (จองโต๊ะ)'}
                                                    </span>
                                                    {isVerified && (
                                                        <span className="bg-emerald-100 text-emerald-900 border-emerald-200 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border inline-block">
                                                            {isEasySlipVerified ? '[ EASYSLIP ✓ ]' : '[ SLIP VERIFIED ]'}
                                                        </span>
                                                    )}
                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-[oklch(55%_0.010_28)] bg-[oklch(94%_0.010_28)] px-2 py-0.5 rounded border border-[oklch(85%_0.012_28)] inline-block">
                                                        QUEUE #{getShortBookingId(item)}
                                                    </span>
                                                </div>

                                                <h4 className="font-bold text-sm text-[oklch(18%_0.012_28)] leading-tight">
                                                    {item.profiles?.display_name || item.pickup_contact_name || item.customer_name || (isPickup ? 'ลูกค้าสั่ง Pickup' : 'ลูกค้าออนไลน์')}
                                                </h4>
                                                <p className="text-xs text-[oklch(55%_0.010_28)] font-mono mt-0.5">
                                                    {item.profiles?.phone_number || item.pickup_contact_phone || item.customer_phone || 'ไม่ระบุเบอร์โทร'}
                                                </p>
                                            </div>

                                            <div className="text-right font-mono shrink-0">
                                                <span className="text-xs font-bold text-[oklch(18%_0.012_28)] bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] px-2.5 py-1 rounded-md inline-block">
                                                    เวลา: {new Date(item.booking_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                                                </span>
                                                <p className="text-[10px] text-[oklch(55%_0.010_28)] mt-1 font-bold">
                                                    {isPickup ? 'ประเภท: รับกลับบ้าน' : `จำนวน: ${item.pax || 1} คน`}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Pre-ordered Food Items (No Icons) */}
                                        {item.order_items && item.order_items.length > 0 && (
                                            <div className="bg-[oklch(94%_0.010_28)] p-2.5 rounded-lg border border-[oklch(85%_0.012_28)] space-y-1">
                                                <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-[oklch(55%_0.010_28)] mb-1">
                                                    รายการอาหาร ({item.order_items.length} รายการ)
                                                </p>
                                                <div className="space-y-0.5 text-xs text-[oklch(18%_0.012_28)]">
                                                    {item.order_items.map((oi, i) => (
                                                        <div key={i} className="flex justify-between font-mono text-[11px]">
                                                            <span>{oi.quantity}x {oi.custom_name || oi.menu_items?.name || oi.name || 'รายการอาหาร'}</span>
                                                            <span className="font-bold">฿{(oi.price_at_time || oi.price || 0) * oi.quantity}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Table Preset Information (Only for Dine-in) */}
                                        {!isPickup && item.tables_layout && (
                                            <div className="text-[10px] font-mono text-[oklch(55%_0.010_28)] bg-[oklch(94%_0.010_28)] px-2.5 py-1.5 rounded-lg border border-[oklch(85%_0.012_28)] flex justify-between items-center">
                                                <span>โต๊ะระบุล่วงหน้า: <strong className="text-[oklch(18%_0.012_28)]">{item.tables_layout.table_name}</strong></span>
                                                <span className="text-[oklch(52%_0.16_28)] font-bold">ยังไม่เปิดโต๊ะหน้าร้าน</span>
                                            </div>
                                        )}

                                        {/* Deposit & Slip Section (Multi-Tier EasySlip & Fallback, Zero-Icon) */}
                                        {(item.deposit_amount > 0 || item.total_amount > 0 || hasSlip) && (
                                            <div className={`p-3 rounded-xl border font-mono text-xs flex flex-col gap-2 ${
                                                isVerified 
                                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950' 
                                                    : (hasSlip ? 'bg-amber-500/10 border-amber-500/30 text-amber-950' : 'bg-[oklch(94%_0.010_28)] border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)]')
                                            }`}>
                                                <div className="flex justify-between items-center flex-wrap gap-1">
                                                    <div className="flex items-center gap-2 font-bold">
                                                        {item.deposit_amount > 0 && <span>มัดจำ: ฿{item.deposit_amount.toLocaleString()}</span>}
                                                        {item.total_amount > 0 && <span className="text-[oklch(42%_0.010_28)]">ยอดรวม: ฿{item.total_amount.toLocaleString()}</span>}
                                                    </div>

                                                    {/* Verification Status Tag */}
                                                    <div>
                                                        {isEasySlipVerified ? (
                                                            <span className="bg-emerald-700 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                                                                ✓ EASYSLIP VERIFIED
                                                            </span>
                                                        ) : isStaffVerified ? (
                                                            <span className="bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                                                                ✓ SLIP APPROVED
                                                            </span>
                                                        ) : hasSlip ? (
                                                            <span className="bg-amber-600 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded animate-pulse">
                                                                ⚠️ รอตรวจสลิปโอนเงิน
                                                            </span>
                                                        ) : (
                                                            <span className="bg-[oklch(85%_0.012_28)] text-[oklch(42%_0.010_28)] text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                                                                ยังไม่มีสลิป
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Slip Actions & Details */}
                                                {hasSlip && (
                                                    <div className="flex justify-between items-center border-t border-black/10 pt-2 text-[10px]">
                                                        <span className="text-[oklch(42%_0.010_28)] truncate pr-2">
                                                            {item.slip_trans_ref ? `Ref: ${item.slip_trans_ref}` : (item.slip_provider ? `Provider: ${item.slip_provider}` : 'หลักฐานการโอนเงินแนบมาแล้ว')}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setViewSlipImageUrl(item.payment_slip_url);
                                                                }}
                                                                className="bg-[oklch(18%_0.012_28)] hover:bg-black text-white text-[10px] font-bold px-2.5 py-1 rounded transition-all cursor-pointer shadow-2xs uppercase font-mono"
                                                            >
                                                                ตรวจสลิป (VIEW)
                                                            </button>
                                                            {!isVerified && (
                                                                <button
                                                                    type="button"
                                                                    onClick={async () => {
                                                                        const updates = {
                                                                            deposit_amount: item.deposit_amount > 0 ? item.deposit_amount : (item.total_amount || 0),
                                                                            slip_verified: true,
                                                                            slip_verification_status: 'manual_verified',
                                                                            staff_remark: `${item.staff_remark || ''} [SLIP_VERIFIED]`.trim()
                                                                        };
                                                                        const { error } = await supabase.from('bookings').update(updates).eq('id', item.id);
                                                                        if (!error) {
                                                                            toast.success("อนุมัติสลิปโอนเงินเรียบร้อยแล้ว");
                                                                            checkPendingOrders();
                                                                            triggerDebouncedRefresh();
                                                                        }
                                                                    }}
                                                                    className="bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold px-2.5 py-1 rounded transition-all cursor-pointer shadow-2xs uppercase font-mono"
                                                                >
                                                                    อนุมัติสลิป ✓
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Card Bottom Actions (No Icons) */}
                                        <div className="flex items-center gap-2 pt-1 border-t border-[oklch(85%_0.012_28)]">
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', item.id);
                                                    if (!error) {
                                                        if (item.tracking_token) {
                                                            sendTrackingBroadcast(item.tracking_token, 'order_status_updated', {
                                                                status: 'cancelled',
                                                                booking_id: item.id
                                                            });
                                                        }
                                                        sendPOSBroadcast('online_order_status_updated', {
                                                            booking_id: item.id,
                                                            status: 'cancelled'
                                                        });
                                                        toast.success("ยกเลิกรายการเรียบร้อยแล้ว");
                                                        checkPendingOrders();
                                                        triggerDebouncedRefresh();
                                                    }
                                                }}
                                                className="flex-1 py-2.5 bg-white hover:bg-red-50 text-red-700 border border-red-200 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer text-center font-mono uppercase"
                                            >
                                                ปฏิเสธ{isPickup ? 'ออเดอร์' : 'คิว'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    if (isPickup) {
                                                        const updates = {
                                                            status: 'ready',
                                                            staff_remark: `${item.staff_remark || ''} [STAFF_ACCEPTED]`.trim()
                                                        };
                                                        const { error } = await supabase.from('bookings').update(updates).eq('id', item.id);
                                                        if (!error) {
                                                            if (item.tracking_token) {
                                                                sendTrackingBroadcast(item.tracking_token, 'order_status_updated', {
                                                                    status: 'ready',
                                                                    booking_id: item.id
                                                                });
                                                            }
                                                            sendPOSBroadcast('online_order_status_updated', {
                                                                booking_id: item.id,
                                                                status: 'ready'
                                                            });
                                                            toast.success("อนุมัติออเดอร์ Pickup เรียบร้อยแล้ว!");
                                                            checkPendingOrders();
                                                            triggerDebouncedRefresh();
                                                        }
                                                    } else {
                                                        const updates = {
                                                            status: 'confirmed',
                                                            staff_remark: `${item.staff_remark || ''} [STAFF_CONFIRMED]`.trim()
                                                        };
                                                        const { error } = await supabase.from('bookings').update(updates).eq('id', item.id);
                                                        if (!error) {
                                                            if (item.tracking_token) {
                                                                sendTrackingBroadcast(item.tracking_token, 'order_status_updated', {
                                                                    status: 'confirmed',
                                                                    booking_id: item.id
                                                                });
                                                            }
                                                            sendPOSBroadcast('online_order_status_updated', {
                                                                booking_id: item.id,
                                                                status: 'confirmed'
                                                            });
                                                            toast.success("อนุมัติคิวจองเรียบร้อยแล้ว!");
                                                            checkPendingOrders();
                                                            triggerDebouncedRefresh();
                                                        }
                                                    }
                                                }}
                                                className="flex-2 py-2.5 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(30%_0.012_28)] text-[oklch(97%_0.008_28)] border border-[oklch(18%_0.012_28)] rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-sm text-center font-mono uppercase tracking-wider"
                                            >
                                                {isPickup ? 'อนุมัติออเดอร์ (Pickup)' : 'อนุมัติ & ยืนยันคิว'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Modal Footer (No Icons) */}
                        <div className="p-3 bg-[oklch(97%_0.008_28)] border-t border-[oklch(85%_0.012_28)] flex justify-end">
                            <button
                                onClick={() => setShowPendingModal(false)}
                                className="px-4 py-2 bg-white border border-[oklch(85%_0.012_28)] hover:bg-[oklch(94%_0.010_28)] rounded-xl text-xs font-mono font-bold text-[oklch(55%_0.010_28)] cursor-pointer active:scale-95 transition-all"
                            >
                                ปิดหน้าต่างเตือน (Close Overlay)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showMoveModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 font-sans select-none">
                    <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl w-full max-w-sm shadow-xl p-5 flex flex-col gap-4">
                        <div className="flex justify-between items-center pb-2 border-b border-[#D1D1CD]">
                            <div>
                                <h3 className="text-xs font-mono font-bold tracking-widest text-[#767673] uppercase">MOVE TABLE / ย้ายโต๊ะ</h3>
                                <p className="text-sm font-bold text-[#1A1A1A] mt-0.5">เลือกโต๊ะปลายทางที่จะย้ายไป</p>
                            </div>
                            <button 
                                onClick={() => setShowMoveModal(false)}
                                className="w-7 h-7 rounded-full bg-white border border-[#D1D1CD] flex items-center justify-center text-[#767673] hover:text-[#1A1A1A] transition-colors cursor-pointer"
                            >
                                <X size={14} />
                            </button>
                        </div>
                        
                        <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                            {availableTables.length === 0 ? (
                                <p className="text-[10px] text-center text-[#767673] py-8 uppercase font-mono tracking-wider">ไม่มีโต๊ะว่างในขณะนี้</p>
                            ) : (
                                availableTables.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => handleExecuteMoveTable(t)}
                                        className="w-full bg-white border border-[#D1D1CD] hover:border-[#1A1A1A] p-3 rounded-xl transition-all cursor-pointer flex items-center justify-between font-bold text-xs text-[#1A1A1A] shadow-sm active:scale-99"
                                    >
                                        <span>โต๊ะ {t.table_name}</span>
                                        <span className="text-[8px] font-mono text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">FREE</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showMergeModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 font-sans select-none">
                    <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl w-full max-w-sm shadow-xl p-5 flex flex-col gap-4">
                        <div className="flex justify-between items-center pb-2 border-b border-[#D1D1CD]">
                            <div>
                                <h3 className="text-xs font-mono font-bold tracking-widest text-[#767673] uppercase">MERGE BILLS / รวมบิล</h3>
                                <p className="text-sm font-bold text-[#1A1A1A] mt-0.5">เลือกโต๊ะปลายทางที่จะรวมบิลเข้าด้วยกัน</p>
                            </div>
                            <button 
                                onClick={() => setShowMergeModal(false)}
                                className="w-7 h-7 rounded-full bg-white border border-[#D1D1CD] flex items-center justify-center text-[#767673] hover:text-[#1A1A1A] transition-colors cursor-pointer"
                            >
                                <X size={14} />
                            </button>
                        </div>
                        
                        <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                            {availableTables.length === 0 ? (
                                <p className="text-[10px] text-center text-[#767673] py-8 uppercase font-mono tracking-wider">ไม่มีโต๊ะอื่นที่เปิดออเดอร์อยู่</p>
                            ) : (
                                availableTables.map(t => {
                                    const shortId = getShortBookingId(t.booking);
                                    const targetAmt = parseFloat(t.booking?.total_amount || t.booking?.total_price || 0);
                                    const memberName = t.booking?.profiles?.display_name || t.booking?.pickup_contact_name || t.booking?.customer_name || '';
                                    return (
                                        <button
                                            key={t.id}
                                            onClick={() => handleExecuteMergeBill(t)}
                                            className="w-full bg-white border border-[#D1D1CD] hover:border-[#1A1A1A] p-3 rounded-xl transition-all cursor-pointer flex items-center justify-between font-bold text-xs text-[#1A1A1A] shadow-sm active:scale-99"
                                        >
                                            <div className="flex flex-col items-start gap-0.5 text-left">
                                                <div className="flex items-center gap-1.5">
                                                    <span>โต๊ะ {t.table_name}</span>
                                                    <span className="text-[10px] font-mono text-[oklch(55%_0.010_28)]">({shortId})</span>
                                                </div>
                                                {memberName && (
                                                    <span className="text-[10px] font-normal text-[oklch(42%_0.010_28)]">
                                                        ลูกค้า: {memberName}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs text-[oklch(18%_0.012_28)]">
                                                    ฿{targetAmt.toLocaleString()}
                                                </span>
                                                <span className="text-[8px] font-mono text-amber-700 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                                    ACTIVE
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showSplitModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 font-sans select-none">
                    <POSSplitPaymentModal 
                        order={currentOrder}
                        activeBooking={activeBooking}
                        includeTax={splitIncludeTax}
                        onClose={() => setShowSplitModal(false)}
                        onConfirmSplit={handleExecuteSplitPayment}
                        onPrintSplitQr={handlePrintSplitQr}
                    />
                </div>
            )}
            {/* Open Shift / PIN Verification Overlay (Full Screen PIN Pad) */}
            {/* Always require PIN on fresh page load, even if shift exists */}
            {(!activeShift || !isPinVerified) && (
                <div className="fixed inset-0 bg-[#ECECE9]/95 z-50 flex items-center justify-center p-4">
                    <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl p-8 max-w-md w-full shadow-2xl flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">
                        
                        {!showOpeningFloatModal ? (
                            /* Step 1: Enter PIN Code to Identify Staff */
                            <div className="flex flex-col gap-4">
                                <div className="text-center">
                                    <div className="w-16 h-16 mx-auto mb-2 flex items-center justify-center rounded-full bg-white shadow-sm border border-[#D1D1CD]">
                                        <img src="/logo.png" alt="In the Haus" className="w-10 h-10 object-contain" />
                                    </div>
                                    <h2 className="text-lg font-bold font-sans tracking-tight text-[#1A1A1A]">ระบบลงชื่อเข้าเวร POS</h2>
                                    <p className="text-[10px] text-[#767673] font-mono mt-0.5 uppercase tracking-wider">ENTER PIN TO LOGIN</p>
                                    {!hasSession && (
                                        <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(52%_0.16_28)]/30 text-[oklch(18%_0.012_28)] rounded-xl p-3 text-[11px] font-sans text-left mt-3 flex flex-col gap-1.5 shadow-sm leading-normal">
                                            <span className="font-bold text-[oklch(52%_0.16_28)] flex items-center gap-1">⚠️ ไม่ได้เข้าสู่ระบบ (Guest Session)</span>
                                            <span className="text-[oklch(42%_0.010_28)] font-sans">
                                                ข้อมูลพนักงานจริงและฐานข้อมูลลูกค้า (CRM) จะไม่ถูกดึงจากระบบคลาวด์ กรุณาเข้าสู่ระบบผ่าน LINE (LIFF) ก่อนเข้าเวรครับ
                                            </span>
                                            <button 
                                                onClick={() => window.location.href = '/login?redirect=/pos'}
                                                className="bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-[oklch(97%_0.008_28)] py-1.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wide transition-all w-fit mt-1 shadow-sm cursor-pointer select-none"
                                            >
                                                เข้าสู่ระบบ LINE (LIFF)
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <POSPinPad 
                                    onComplete={async (enteredPin, onError) => {
                                        try {
                                            const { data: verifiedStaff, error } = await supabase.rpc('verify_staff_pin_login', { p_pin: enteredPin });
                                            if (!error && verifiedStaff && verifiedStaff.length > 0) {
                                                handlePinLogin(verifiedStaff[0]);
                                                return;
                                            }
                                        } catch (e) {
                                            console.warn("RPC verify error, checking fallback staff list:", e);
                                        }

                                        const staff = staffList.find(s => s.pin === enteredPin);
                                        if (staff) {
                                            handlePinLogin(staff);
                                        } else {
                                            toast.error('รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
                                            onError();
                                        }
                                    }}
                                />
                            </div>
                        ) : (
                            /* Step 3: Enter Cash Float to Open Shift */
                            <div className="flex flex-col gap-5">
                                <div className="text-center border-b border-[#D1D1CD] pb-4">
                                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2 border border-emerald-100 shadow-inner">
                                        <Key size={20} />
                                    </div>
                                    <h2 className="text-base font-bold text-[#1A1A1A]">ยืนยันรหัสถูกต้องเรียบร้อย</h2>
                                    <p className="text-[10px] text-[#767673] font-mono leading-none mt-1 uppercase">Enter Cash Float for: {selectedStaffForLogin.display_name}</p>
                                </div>

                                <form 
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        const newShift = startShift(selectedStaffForLogin.display_name, openShiftForm.openingFloat);
                                        if (newShift) setActiveShift(newShift);
                                        toast.success(`เปิดรอบการขายสำเร็จ: พนักงาน ${selectedStaffForLogin.display_name}`);
                                        setSelectedStaffForLogin(null);
                                        setPinInput('');
                                        setShowOpeningFloatModal(false);
                                        setIsPinVerified(true);
                                    }} 
                                    className="flex flex-col gap-4"
                                >
                                    <div>
                                        <label className="block text-[10px] font-mono font-bold tracking-widest text-[#767673] uppercase mb-1.5">
                                            ระบุเงินทอนเริ่มต้นในลิ้นชัก (Opening Float)
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-mono text-[#767673] font-bold">฿</span>
                                            <input
                                                type="number"
                                                required
                                                min="0"
                                                step="any"
                                                value={openShiftForm.openingFloat}
                                                onChange={(e) => setOpenShiftForm(prev => ({ ...prev, openingFloat: e.target.value }))}
                                                className="w-full bg-white border border-[#D1D1CD] rounded-xl pl-9 pr-4 py-3 text-base font-mono font-bold focus:outline-none focus:border-[#ff0000] focus:ring-2 focus:ring-[#ff0000]/15 transition-all text-[#1A1A1A] shadow-inner"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-2 mt-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowOpeningFloatModal(false);
                                                setPinInput('');
                                            }}
                                            className="flex-1 bg-white border border-[#D1D1CD] hover:bg-[#ECECE9] text-[#1A1A1A] py-3 px-4 rounded-xl font-bold text-xs uppercase transition-all cursor-pointer shadow-sm active:scale-98"
                                        >
                                            ย้อนหลัง (Back)
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 bg-[#ff0000] hover:bg-[#c00000] text-white py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wide shadow-md active:scale-98 transition-all flex items-center justify-center gap-1 cursor-pointer"
                                        >
                                            <LogIn size={12} />
                                            <span>เปิดรอบขาย (Start)</span>
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                        
                    </div>
                </div>
            )}

            {/* Close Shift Modal */}
            {showCloseShiftModal && activeShift && (() => {
                const currentShift = getCurrentShift() || activeShift;
                const summary = getShiftSummary();
                const adjustments = currentShift.adjustments || [];
                return (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                        <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl p-6 max-w-lg w-full shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between border-b border-[#D1D1CD] pb-3 shrink-0">
                                <div>
                                    <h3 className="text-base font-bold font-sans text-[#1A1A1A]">ปิดรอบการทำงานและตรวจสอบเงินสด</h3>
                                    <p className="text-[10px] text-[#767673] font-mono mt-0.5 uppercase">Shift Closure & Cash Reconciliation</p>
                                </div>
                                <button
                                    onClick={() => setShowCloseShiftModal(false)}
                                    className="text-[#767673] hover:text-[#1A1A1A] text-xl font-bold font-mono p-1"
                                >
                                    ×
                                </button>
                            </div>

                            {/* Shift Information and Stats */}
                            <div className="grid grid-cols-2 gap-3 text-xs bg-white border border-[#D1D1CD] rounded-xl p-4 shadow-sm shrink-0">
                                <div>
                                    <span className="text-[#767673] font-mono font-bold uppercase text-[9px] block">Cashier Staff</span>
                                    <span className="font-bold text-[#1A1A1A]">{currentShift.staffName}</span>
                                </div>
                                <div>
                                    <span className="text-[#767673] font-mono font-bold uppercase text-[9px] block">Opened Time</span>
                                    <span className="font-mono font-bold text-[#1A1A1A]">
                                        {new Date(currentShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="col-span-2 border-t border-[#D1D1CD]/50 pt-2.5 grid grid-cols-2 gap-y-2 gap-x-4">
                                    <div className="flex justify-between">
                                        <span className="text-[#767673] font-mono font-bold uppercase text-[8px]">Opening Float:</span>
                                        <span className="font-mono font-bold">฿{Number(currentShift.openingFloat || 0).toLocaleString(undefined, { minimumFractionDigits: ((currentShift.openingFloat || 0) % 1 !== 0) ? 2 : 0, maximumFractionDigits: 2 })}.-</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[#767673] font-mono font-bold uppercase text-[8px]">Cash Sales:</span>
                                        <span className="font-mono font-bold text-emerald-600">฿{Number(summary.cashSales || 0).toLocaleString(undefined, { minimumFractionDigits: ((summary.cashSales || 0) % 1 !== 0) ? 2 : 0, maximumFractionDigits: 2 })}.-</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[#767673] font-mono font-bold uppercase text-[8px]">QR Sales:</span>
                                        <span className="font-mono font-bold text-blue-600">฿{Number(summary.qrSales || 0).toLocaleString(undefined, { minimumFractionDigits: ((summary.qrSales || 0) % 1 !== 0) ? 2 : 0, maximumFractionDigits: 2 })}.-</span>
                                    </div>
                                    <div className="flex justify-between border-t border-[#D1D1CD]/30 pt-1">
                                        <span className="text-[#767673] font-mono font-bold uppercase text-[8px]">Petty Cash In/Out:</span>
                                        <span className={`font-mono font-bold ${summary.totalIn - summary.totalOut >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {summary.totalIn - summary.totalOut >= 0 ? '+' : '-'}฿{Number(Math.abs(summary.totalIn - summary.totalOut)).toLocaleString(undefined, { minimumFractionDigits: (Math.abs(summary.totalIn - summary.totalOut) % 1 !== 0) ? 2 : 0, maximumFractionDigits: 2 })}.-
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Petty Cash Adjustments Ledger (เบิกจ่ายเงินสด) */}
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[10px] font-mono font-bold tracking-widest text-[#767673] uppercase px-1">ประวัติรายการเบิกจ่ายกะนี้ ({adjustments.length})</span>
                                <div className="border border-[#D1D1CD] rounded-xl bg-white p-2.5 max-h-[110px] overflow-y-auto flex flex-col gap-1 text-[10px] shadow-inner">
                                    {adjustments.length === 0 ? (
                                        <div className="text-center text-[#767673] py-4 italic">ไม่มีรายการเงินเข้า-ออกระหว่างวัน</div>
                                    ) : (
                                        adjustments.map(adj => (
                                            <div key={adj.id} className="flex justify-between items-center py-1 border-b border-[#D1D1CD]/30 last:border-b-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${adj.type === 'in' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                    <span className="text-[#1A1A1A] font-bold">{adj.note}</span>
                                                    <span className="text-[#767673] font-mono text-[8px]">
                                                        ({new Date(adj.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                                                    </span>
                                                </div>
                                                <span className={`font-mono font-bold ${adj.type === 'in' ? 'text-emerald-600' : 'text-red-500'}`}>
                                                    {adj.type === 'in' ? '+' : '-'}฿{Number(adj.amount || 0).toLocaleString(undefined, { minimumFractionDigits: (adj.amount % 1 !== 0) ? 2 : 0, maximumFractionDigits: 2 })}.-
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Expected Cash reconciliation */}
                            <div className="bg-[#FFF9E6] border border-[#E5A900] rounded-xl p-4 flex justify-between items-center shadow-sm shrink-0">
                                <div>
                                    <span className="text-[#805E00] font-mono font-bold uppercase text-[9px] block">Expected Cash in Drawer</span>
                                    <span className="text-[10px] text-amber-800/80 leading-none">เงินสดตั้งต้น + ยอดขายเงินสด + เข้า - ออก</span>
                                </div>
                                <span className="font-mono font-black text-[#1A1A1A] text-lg">
                                    ฿{Number(summary.expectedCash || 0).toLocaleString(undefined, { minimumFractionDigits: ((summary.expectedCash || 0) % 1 !== 0) ? 2 : 0, maximumFractionDigits: 2 })}.-
                                </span>
                            </div>

                            {/* Input for Actual cash */}
                            <form onSubmit={handleCloseShiftSubmit} className="flex flex-col gap-4 shrink-0">
                                <div>
                                    <label className="block text-[10px] font-mono font-bold tracking-widest text-[#767673] uppercase mb-1.5">
                                        เงินสดที่ตรวจนับได้จริง (Actual Cash in Drawer)
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-mono text-[#767673] font-bold">฿</span>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="any"
                                            placeholder="กรอกเงินสดทั้งหมดที่นับได้ในลิ้นชัก"
                                            value={closeShiftForm.actualCash}
                                            onChange={(e) => setCloseShiftForm(prev => ({ ...prev, actualCash: e.target.value }))}
                                            className="w-full bg-white border border-[#D1D1CD] rounded-xl pl-9 pr-4 py-3 text-base font-mono font-bold focus:outline-none focus:border-[#ff0000] focus:ring-2 focus:ring-[#ff0000]/15 transition-all text-[#1A1A1A] shadow-inner"
                                        />
                                    </div>
                                </div>

                                {/* Live Difference calculation display */}
                                {closeShiftForm.actualCash !== '' && (() => {
                                    const diff = (parseFloat(closeShiftForm.actualCash) || 0) - summary.expectedCash;
                                    return (
                                        <div className={`p-3 rounded-xl border text-xs font-mono font-bold flex justify-between items-center shadow-inner ${
                                            diff === 0 
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                            : diff > 0 
                                            ? 'bg-blue-50 border-blue-200 text-blue-700' 
                                            : 'bg-red-50 border-red-200 text-red-700'
                                        }`}>
                                            <span>ยอดขาดเกิน (Difference):</span>
                                            <span>
                                                {diff === 0 ? '฿0.- (ยอดเงินสดตรงกะพอดี)' : diff > 0 ? `+฿${diff.toLocaleString()}.- (ยอดเงินเกิน)` : `-฿${Math.abs(diff).toLocaleString()}.- (ยอดเงินขาด)`}
                                            </span>
                                        </div>
                                    );
                                })()}

                                {/* Action Buttons */}
                                <div className="flex gap-2.5 mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowCloseShiftModal(false)}
                                        className="flex-1 bg-white border border-[#D1D1CD] hover:bg-[#ECECE9] text-[#1A1A1A] py-3.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all cursor-pointer shadow-sm active:scale-98"
                                    >
                                        ยกเลิก (Cancel)
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 bg-[#ff0000] hover:bg-[#c00000] text-white py-3.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 active:scale-98"
                                    >
                                        <Printer size={12} />
                                        <span>ปิดกะและพิมพ์สรุปยอด</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                );
            })()}

            {/* Petty Cash Adjustment Modal (เบิกจ่ายระหว่างวัน เข้า-ออก) */}
            {showCashAdjustmentModal && activeShift && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-[#D1D1CD] pb-3">
                            <div>
                                <h3 className="text-base font-bold font-sans text-[#1A1A1A]">บันทึกรายการเบิกจ่ายเงินสด</h3>
                                <p className="text-[10px] text-[#767673] font-mono mt-0.5 uppercase">Petty Cash Deposit / Withdrawal</p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowCashAdjustmentModal(false);
                                    setCashAdjustmentForm({ amount: '', note: '', type: 'out' });
                                }}
                                className="text-[#767673] hover:text-[#1A1A1A] text-xl font-bold font-mono p-1"
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleCashAdjustmentSubmit} className="flex flex-col gap-4">
                            {/* Adjustment Type Selection */}
                            <div>
                                <label className="block text-[10px] font-mono font-bold tracking-widest text-[#767673] uppercase mb-1.5">
                                    ประเภทรายการ (Transaction Type)
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setCashAdjustmentForm(prev => ({ ...prev, type: 'out' }))}
                                        className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wide border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                            cashAdjustmentForm.type === 'out'
                                            ? 'bg-red-50 border-red-200 text-red-700 shadow-sm'
                                            : 'bg-white border-[#D1D1CD] hover:bg-[#ECECE9] text-[#767673]'
                                        }`}
                                    >
                                        <Minus size={12} />
                                        <span>เบิกจ่ายเงินสด / เงินออก (Payout)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCashAdjustmentForm(prev => ({ ...prev, type: 'in' }))}
                                        className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wide border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                            cashAdjustmentForm.type === 'in'
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm'
                                            : 'bg-white border-[#D1D1CD] hover:bg-[#ECECE9] text-[#767673]'
                                        }`}
                                    >
                                        <Plus size={12} />
                                        <span>นำฝากเงินสด / เงินเข้า (Deposit)</span>
                                    </button>
                                </div>
                            </div>

                            {/* Amount Input */}
                            <div>
                                <label className="block text-[10px] font-mono font-bold tracking-widest text-[#767673] uppercase mb-1.5">
                                    จำนวนเงินสด (Cash Amount)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-mono text-[#767673] font-bold">฿</span>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="any"
                                        placeholder="0.00"
                                        value={cashAdjustmentForm.amount}
                                        onChange={(e) => setCashAdjustmentForm(prev => ({ ...prev, amount: e.target.value }))}
                                        className="w-full bg-white border border-[#D1D1CD] rounded-xl pl-9 pr-4 py-3 text-base font-mono font-bold focus:outline-none focus:border-[#ff0000] focus:ring-2 focus:ring-[#ff0000]/15 transition-all text-[#1A1A1A] shadow-inner"
                                    />
                                </div>
                            </div>

                            {/* Notes Input */}
                            <div>
                                <label className="block text-[10px] font-mono font-bold tracking-widest text-[#767673] uppercase mb-1.5">
                                    รายละเอียด / เหตุผล (Details & Reason)
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="เช่น ซื้อน้ำแข็ง, ทอนเงินเพิ่ม, จ่ายผู้ผลิต"
                                    value={cashAdjustmentForm.note}
                                    onChange={(e) => setCashAdjustmentForm(prev => ({ ...prev, note: e.target.value }))}
                                    className="w-full bg-white border border-[#D1D1CD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#ff0000] focus:ring-2 focus:ring-[#ff0000]/15 transition-all text-[#1A1A1A] font-bold shadow-inner"
                                />
                            </div>

                            {/* Form Submit */}
                            <div className="flex gap-2.5 mt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCashAdjustmentModal(false);
                                        setCashAdjustmentForm({ amount: '', note: '', type: 'out' });
                                    }}
                                    className="flex-1 bg-white border border-[#D1D1CD] hover:bg-[#ECECE9] text-[#1A1A1A] py-3.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all cursor-pointer shadow-sm active:scale-98"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-[#ff0000] hover:bg-[#c00000] text-white py-3.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all cursor-pointer shadow-md active:scale-98"
                                >
                                    บันทึกรายการ
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Lock Screen Overlay (Full Screen PIN Pad / Staff Grid) */}
            {isLocked && activeShift && (
                <div className="fixed inset-0 bg-[#ECECE9]/95 z-50 flex items-center justify-center p-4">
                    <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl p-8 max-w-md w-full shadow-2xl flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">
                        
                        {/* Enter PIN Code to Unlock */}
                        <div className="flex flex-col gap-4">
                            <div className="text-center">
                                <div className="w-14 h-14 bg-[#ff0000]/10 text-[#ff0000] rounded-full flex items-center justify-center mx-auto mb-3 border border-[#ff0000]/20 shadow-inner">
                                    <Lock size={28} />
                                </div>
                                <h2 className="text-lg font-bold font-sans tracking-tight text-[#1A1A1A]">POS หน้าจอถูกล็อค</h2>
                                <p className="text-[10px] text-[#767673] font-mono mt-0.5 uppercase tracking-wider">ENTER PIN TO UNLOCK</p>
                                {!hasSession && (
                                    <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(52%_0.16_28)]/30 text-[oklch(18%_0.012_28)] rounded-xl p-3 text-[11px] font-sans text-left mt-3 flex flex-col gap-1.5 shadow-sm leading-normal">
                                        <span className="font-bold text-[oklch(52%_0.16_28)] flex items-center gap-1">⚠️ เซสชันเข้าสู่ระบบ LINE ขาดการเชื่อมต่อ</span>
                                        <span className="text-[oklch(42%_0.010_28)] font-sans">
                                            ไม่พบข้อมูลบัญชีพนักงานจริง เพื่อให้ระบบบันทึกชื่อผู้ปลดล็อกและการทำรายการได้ถูกต้อง กรุณาเข้าสู่ระบบผ่าน LINE ก่อนครับ
                                        </span>
                                        <button 
                                            onClick={() => window.location.href = '/login?redirect=/pos'}
                                            className="bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-[oklch(97%_0.008_28)] py-1.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wide transition-all w-fit mt-1 shadow-sm cursor-pointer select-none"
                                        >
                                            เข้าสู่ระบบ LINE (LIFF)
                                        </button>
                                    </div>
                                )}
                            </div>

                            <POSPinPad 
                                onComplete={async (enteredPin, onError) => {
                                    let staff = null;
                                    try {
                                        const { data: verifiedStaff, error } = await supabase.rpc('verify_staff_pin_login', { p_pin: enteredPin });
                                        if (!error && verifiedStaff && verifiedStaff.length > 0) {
                                            staff = verifiedStaff[0];
                                        }
                                    } catch (e) {
                                        console.warn("RPC unlock verify error, checking fallback:", e);
                                    }

                                    if (!staff) {
                                        staff = staffList.find(s => s.pin === enteredPin);
                                    }

                                    if (staff) {
                                        if (activeShift?.staffName !== staff.display_name) {
                                            const updatedShift = {
                                                ...activeShift,
                                                staffName: staff.display_name
                                            };
                                            localStorage.setItem('pos_current_shift', JSON.stringify(updatedShift));
                                            setActiveShift(updatedShift);
                                            syncShiftToCloud(updatedShift);
                                            window.dispatchEvent(new Event('pos-shift-changed'));
                                            toast.success(`เปลี่ยนเป็นพนักงาน: ${staff.display_name}`);
                                        } else {
                                            toast.success('ปลดล็อคหน้าจอสำเร็จ');
                                        }
                                        unlockScreen();
                                        setIsPinVerified(true);
                                    } else {
                                        toast.error('รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
                                        onError();
                                    }
                                }}
                            />
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}


