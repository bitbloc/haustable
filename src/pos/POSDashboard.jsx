import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import POSLayout from './POSLayout';
import POSTableGrid from './POSTableGrid';
import POSMenuGrid from './POSMenuGrid';
import POSPickupGrid from './POSPickupGrid';
import POSOrderPanel from './POSOrderPanel';
import { usePOSOrder } from '../hooks/usePOSOrder';
import { Toaster, toast } from 'sonner';
import POSReportsPanel from './POSReportsPanel';
import POSCRMPanel from './POSCRMPanel';
import POSOpenBillsGrid from './POSOpenBillsGrid';
import POSOfflineQueueDrawer from './POSOfflineQueueDrawer';
import SlipModal from '../components/shared/SlipModal';
import { getCurrentShift, startShift, closeShift, addShiftAdjustment, checkAndRestoreActiveShift, voidShiftTransaction } from '../utils/shiftHelper';
import { isOnline } from '../utils/offlineHelper';
import { printToSunmiBuiltIn, encodeShiftClosureReportData, compileShiftReportData } from '../utils/printerHelper';
import { Users, Lock, Key, Plus, Minus, LogIn, LogOut, Printer, X, Search, Coins } from 'lucide-react';

export default function POSDashboard() {
    const [view, setView] = useState('tables'); // 'tables' or 'menu'
    const [selectedTable, setSelectedTable] = useState(null);
    const [activeBooking, setActiveBooking] = useState(null);
    const [currentOrder, setCurrentOrder] = useState({
        items: [],
        customer: null,
        table: null
    });
    const [activeSlipBooking, setActiveSlipBooking] = useState(null);
    const [activeSlipType, setActiveSlipType] = useState('billing');
    const [refreshKey, setRefreshKey] = useState(0);

    // Move / Merge / Split States
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [showSplitModal, setShowSplitModal] = useState(false);
    const [availableTables, setAvailableTables] = useState([]);

    const [alertSoundUrl, setAlertSoundUrl] = useState(null);
    const [audioContext, setAudioContext] = useState(null);
    const [hasPendingOrders, setHasPendingOrders] = useState(false);
    const prevHasPendingOrdersRef = useRef(false);

    // Track unique realtime alerts to prevent audio overlap and duplicates
    const activeNotificationsRef = useRef(new Set());
    const lastPlayedSoundTimeRef = useRef(0);

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
    const [isLocked, setIsLocked] = useState(() => {
        return localStorage.getItem('pos_is_locked') === 'true';
    });
    const [hasSession, setHasSession] = useState(false);
    const [selectedStaffForUnlock, setSelectedStaffForUnlock] = useState(null);
    const [lockPinInput, setLockPinInput] = useState('');

    const lockScreen = () => {
        setIsLocked(true);
        localStorage.setItem('pos_is_locked', 'true');
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

    // CRM Profile Attach States
    const [showAttachCRMModal, setShowAttachCRMModal] = useState(false);
    const [crmSearchTerm, setCrmSearchTerm] = useState('');
    const [crmMembers, setCrmMembers] = useState([]);
    const [crmLoading, setCrmLoading] = useState(false);

    const loadCrmMembers = async () => {
        setCrmLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('display_name', { ascending: true });
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
            loadCrmMembers();
            setCrmSearchTerm('');
        }
    }, [showAttachCRMModal]);

    const handleSelectCrmCustomer = async (member) => {
        if (!activeBooking) return;
        const success = await attachCustomerToBooking(activeBooking.id, member.id);
        if (success) {
            const updatedBooking = await getActiveBooking(selectedTable.id);
            setActiveBooking(updatedBooking);
            setShowAttachCRMModal(false);
        }
    };

    const filteredCrmMembers = crmMembers.filter(m => {
        const nameMatch = (m.display_name || '').toLowerCase().includes(crmSearchTerm.toLowerCase());
        const phoneMatch = (m.phone || '').toLowerCase().includes(crmSearchTerm.toLowerCase());
        const emailMatch = (m.email || '').toLowerCase().includes(crmSearchTerm.toLowerCase());
        return nameMatch || phoneMatch || emailMatch;
    });

    const loadStaff = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, display_name, role, pin')
                .in('role', ['staff', 'admin']);
            
            if (!error && data && data.length > 0) {
                setStaffList(data);
            } else {
                const DEFAULT_STAFF = [
                    { id: 'default_1', display_name: 'แคชเชียร์ A (Cashier A)', role: 'staff', pin: '1111' },
                    { id: 'default_2', display_name: 'แคชเชียร์ B (Cashier B)', role: 'staff', pin: '2222' },
                    { id: 'default_3', display_name: 'ผู้จัดการ (Manager)', role: 'admin', pin: '9999' }
                ];
                setStaffList(DEFAULT_STAFF);
            }
        } catch (err) {
            console.error("Failed to load staff profiles:", err);
            const DEFAULT_STAFF = [
                { id: 'default_1', display_name: 'แคชเชียร์ A (Cashier A)', role: 'staff', pin: '1111' },
                { id: 'default_2', display_name: 'แคชเชียร์ B (Cashier B)', role: 'staff', pin: '2222' },
                { id: 'default_3', display_name: 'ผู้จัดการ (Manager)', role: 'admin', pin: '9999' }
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
        const handleTriggerClose = () => {
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

    useEffect(() => {
        if (!activeShift) {
            setRealtimeShiftSummary(null);
            return;
        }

        let isMounted = true;
        const fetchRealtimeSummary = async () => {
            try {
                const { data, error } = await supabase
                    .from('bookings')
                    .select('id, status, total_amount, staff_remark, payment_slip_url')
                    .eq('status', 'completed')
                    .gte('booking_time', activeShift.openedAt);

                if (error) throw error;
                if (!isMounted) return;

                let cashSales = 0;
                let qrSales = 0;
                let creditSales = 0;

                (data || []).forEach(b => {
                    const remark = (b.staff_remark || '').toLowerCase();
                    const amt = parseFloat(b.total_amount) || 0;
                    
                    if (remark.includes('credit') || remark.includes('บัตรเครดิต')) {
                        creditSales += amt;
                    } else if (b.payment_slip_url || remark.includes('qr') || remark.includes('transfer') || remark.includes('โอน')) {
                        qrSales += amt;
                    } else {
                        cashSales += amt;
                    }
                });

                const adjustments = activeShift.adjustments || [];
                const totalIn = adjustments.filter(a => a.type === 'in').reduce((sum, a) => sum + a.amount, 0);
                const totalOut = adjustments.filter(a => a.type === 'out').reduce((sum, a) => sum + a.amount, 0);

                setRealtimeShiftSummary({
                    cashSales,
                    qrSales,
                    creditSales,
                    totalSales: cashSales + qrSales + creditSales,
                    totalIn,
                    totalOut,
                    expectedCash: activeShift.openingFloat + cashSales + totalIn - totalOut
                });
            } catch (err) {
                console.error("Failed to fetch realtime shift summary:", err);
                if (!isMounted) return;
                const cashSales = activeShift.transactions
                    .filter(tx => tx.paymentMethod === 'cash')
                    .reduce((sum, tx) => sum + tx.amount, 0);
                const qrSales = activeShift.transactions
                    .filter(tx => tx.paymentMethod === 'qr')
                    .reduce((sum, tx) => sum + tx.amount, 0);
                const creditSales = activeShift.transactions
                    .filter(tx => tx.paymentMethod === 'credit')
                    .reduce((sum, tx) => sum + tx.amount, 0);
                const adjustments = activeShift.adjustments || [];
                const totalIn = adjustments.filter(a => a.type === 'in').reduce((sum, a) => sum + a.amount, 0);
                const totalOut = adjustments.filter(a => a.type === 'out').reduce((sum, a) => sum + a.amount, 0);
                setRealtimeShiftSummary({
                    cashSales,
                    qrSales,
                    creditSales,
                    totalSales: cashSales + qrSales + creditSales,
                    totalIn,
                    totalOut,
                    expectedCash: activeShift.openingFloat + cashSales + totalIn - totalOut
                });
            }
        };

        fetchRealtimeSummary();

        const handleLocalTx = () => {
            fetchRealtimeSummary();
        };
        window.addEventListener('pos-shift-changed', handleLocalTx);
        return () => {
            isMounted = false;
            window.removeEventListener('pos-shift-changed', handleLocalTx);
        };
    }, [activeShift, refreshKey]);

    const getShiftSummary = () => {
        if (realtimeShiftSummary) return realtimeShiftSummary;

        if (!activeShift) return { cashSales: 0, qrSales: 0, creditSales: 0, totalSales: 0, expectedCash: 0, totalIn: 0, totalOut: 0 };
        const cashSales = activeShift.transactions
            .filter(tx => tx.paymentMethod === 'cash')
            .reduce((sum, tx) => sum + tx.amount, 0);
        const qrSales = activeShift.transactions
            .filter(tx => tx.paymentMethod === 'qr')
            .reduce((sum, tx) => sum + tx.amount, 0);
        const creditSales = activeShift.transactions
            .filter(tx => tx.paymentMethod === 'credit')
            .reduce((sum, tx) => sum + tx.amount, 0);
            
        const adjustments = activeShift.adjustments || [];
        const totalIn = adjustments.filter(a => a.type === 'in').reduce((sum, a) => sum + a.amount, 0);
        const totalOut = adjustments.filter(a => a.type === 'out').reduce((sum, a) => sum + a.amount, 0);

        return {
            cashSales,
            qrSales,
            creditSales,
            totalSales: cashSales + qrSales + creditSales,
            totalIn,
            totalOut,
            expectedCash: activeShift.openingFloat + cashSales + totalIn - totalOut
        };
    };

    const handleStartShiftSubmit = (e) => {
        e.preventDefault();
        if (!openShiftForm.staffName.trim()) {
            toast.error('กรุณาระบุชื่อพนักงานเพื่อเปิดรอบ');
            return;
        }
        startShift(openShiftForm.staffName.trim(), openShiftForm.openingFloat);
        toast.success(`เปิดรอบการขายสำเร็จ: พนักงาน ${openShiftForm.staffName}`);
    };

    const handleCloseShiftSubmit = async (e) => {
        e.preventDefault();
        const summary = getShiftSummary();
        const actual = parseFloat(closeShiftForm.actualCash) || 0;
        
        const toastId = toast.loading('กำลังปิดกะและพิมพ์รายงาน...');
        
        try {
            // 1. Fetch bookings in this shift
            let bookingsData = [];
            
            if (isOnline()) {
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
                            menu_items (
                                name,
                                category_id
                            )
                        )
                    `)
                    .gte('booking_time', activeShift.openedAt)
                    .lte('booking_time', new Date().toISOString());
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
            
            // 3. Compile reportData
            const compiledReport = compileShiftReportData(
                {
                    ...activeShift,
                    expectedCash: summary.expectedCash,
                    closedCash: actual,
                    difference: actual - summary.expectedCash,
                    cashSales: summary.cashSales,
                    qrSales: summary.qrSales,
                    creditSales: summary.creditSales,
                    totalSales: summary.totalSales,
                    totalIn: summary.totalIn,
                    totalOut: summary.totalOut
                },
                bookingsData,
                categoriesData
            );
            
            // 4. Print shift report to SUNMI
            const rawBytes = encodeShiftClosureReportData(compiledReport, '80mm', 'sunmi');
            const printRes = await printToSunmiBuiltIn(rawBytes);
            
            // 5. Close shift locally & cloud
            closeShift(actual, summary);
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
                closeShift(actual, summary);
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
        
        addShiftAdjustment(amount, cashAdjustmentForm.note.trim(), cashAdjustmentForm.type);
        toast.success(`บันทึกรายการสำเร็จ: ${cashAdjustmentForm.type === 'in' ? 'นำฝากเงินสด' : 'เบิกจ่ายเงินสด'} ฿${amount.toLocaleString()}`);
        setShowCashAdjustmentModal(false);
        setCashAdjustmentForm({ amount: '', note: '', type: 'out' });
    };

    const checkPendingOrders = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const { count, error } = await supabase
                .from('bookings')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pending')
                .gte('booking_time', `${today}T00:00:00`);
            
            if (!error) {
                const hasPending = (count || 0) > 0;
                setHasPendingOrders(hasPending);
                if (hasPending !== prevHasPendingOrdersRef.current) {
                    prevHasPendingOrdersRef.current = hasPending;
                    setRefreshKey(prev => prev + 1);
                }
            }
        } catch (err) {
            console.error("Check pending orders failed:", err);
        }
    };

    useEffect(() => {
        // Fetch sound setting once at mount
        const fetchSound = async () => {
            const { data } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'alert_sound_url')
                .maybeSingle();
            if (data?.value) {
                setAlertSoundUrl(data.value);
            }
        };
        fetchSound();
        checkPendingOrders();

        // Warning toast to unlock sound (De-duplicated using id)
        toast.info("🔊 กรุณาแตะที่ใดก็ได้บนหน้าจอ 1 ครั้ง เพื่อเปิดระบบเสียงแจ้งเตือนออเดอร์", { id: "unlock-sound-toast" });

        // Poll pending orders every 4 seconds
        const pollInterval = setInterval(checkPendingOrders, 4000);

        // Unlock audio context on first click/touch
        const unlock = () => {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) {
                    const ctx = new AudioContext();
                    if (ctx.state === 'suspended') {
                        ctx.resume();
                    }
                    // Silent osc to trigger browser permissions
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    gain.gain.value = 0;
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(0);
                    osc.stop(0.01);
                    setAudioContext(ctx);
                }
                window.removeEventListener('click', unlock);
                window.removeEventListener('touchstart', unlock);
            } catch (err) {
                console.error("Failed to unlock audio context:", err);
            }
        };
        window.addEventListener('click', unlock);
        window.addEventListener('touchstart', unlock);

        return () => {
            clearInterval(pollInterval);
            window.removeEventListener('click', unlock);
            window.removeEventListener('touchstart', unlock);
        };
    }, []);

    const [attachedMemberCrm, setAttachedMemberCrm] = useState(null);

    useEffect(() => {
        const fetchAttachedMemberCrm = async () => {
            if (!activeBooking?.user_id) {
                setAttachedMemberCrm(null);
                return;
            }
            try {
                const { data, error } = await supabase.rpc('get_member_tier_details', { p_user_id: activeBooking.user_id });
                if (!error && data && data.length > 0) {
                    setAttachedMemberCrm(data[0]);
                }
            } catch (err) {
                console.error("Failed to load attached member CRM:", err);
            }
        };
        fetchAttachedMemberCrm();
    }, [activeBooking]);

    const activeAudioElementRef = useRef(null);

    // Repeating Sound Alert when pending orders exist
    useEffect(() => {
        if (!hasPendingOrders) return;

        // Play alert immediately
        playSystemAlertSound();

        // Repeat every 6 seconds
        const soundInterval = setInterval(() => {
            playSystemAlertSound();
        }, 6000);

        return () => {
            clearInterval(soundInterval);
        };
    }, [hasPendingOrders, alertSoundUrl]);

    const playSystemAlertSound = () => {
        const now = Date.now();
        if (now - lastPlayedSoundTimeRef.current < 3500) {
            console.log("Sound alert play throttled to prevent overlap.");
            return;
        }
        lastPlayedSoundTimeRef.current = now;

        if (alertSoundUrl) {
            try {
                if (!activeAudioElementRef.current || activeAudioElementRef.current.src !== alertSoundUrl) {
                    activeAudioElementRef.current = new Audio(alertSoundUrl);
                } else {
                    activeAudioElementRef.current.currentTime = 0;
                }
                activeAudioElementRef.current.play().catch(e => {
                    console.warn("Failed to play custom sound, playing synth chime:", e);
                    playSynthChime();
                });
                return;
            } catch (e) {
                console.warn("Custom sound play error:", e);
            }
        }
        playSynthChime();
    };

    const playSynthChime = () => {
        try {
            const ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)();
            if (ctx.state === 'suspended') {
                ctx.resume();
            }
            
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.frequency.value = 880;
            gain1.gain.setValueAtTime(0.3, ctx.currentTime);
            gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
            osc1.start(ctx.currentTime);
            osc1.stop(ctx.currentTime + 0.15);
            
            const delay = 0.12;
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.frequency.value = 1100;
            gain2.gain.setValueAtTime(0.3, ctx.currentTime + delay);
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.25);
            osc2.start(ctx.currentTime + delay);
            osc2.stop(ctx.currentTime + delay + 0.25);
        } catch (err) {
            console.error("Web Audio API failed:", err);
        }
    };

    useEffect(() => {
        let tablesMap = {};
        const loadTablesMap = async () => {
            const { data } = await supabase.from('tables_layout').select('id, table_name');
            if (data) {
                data.forEach(t => {
                    tablesMap[t.id] = t.table_name;
                });
            }
        };
        loadTablesMap();

        const notifyChannel = supabase.channel('pos-realtime-notifications')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'bookings' 
            }, async (payload) => {
                checkPendingOrders();
                setRefreshKey(prev => prev + 1);
                const { eventType, new: newRow } = payload;
                const tableId = newRow?.table_id || payload.old?.table_id;
                if (!tableId) return;

                const tableName = tablesMap[tableId] || `Table #${tableId}`;
                const bookingId = newRow?.id || payload.old?.id;
                if (!bookingId) return;

                const callBillKey = `${bookingId}_CALL_BILL`;
                const callStaffKey = `${bookingId}_CALL_STAFF`;
                const pendingOrderKey = `${bookingId}_PENDING_ORDER`;
                const slipReceivedKey = `${bookingId}_SLIP_RECEIVED`;

                if (eventType === 'INSERT') {
                    if (newRow.status === 'pending') {
                        if (!activeNotificationsRef.current.has(pendingOrderKey)) {
                            activeNotificationsRef.current.add(pendingOrderKey);
                            toast.success(`🛎️ ออเดอร์ใหม่! โต๊ะ ${tableName} สั่งอาหารเข้าห้องครัวแล้ว`, {
                                duration: 10000,
                                action: {
                                    label: 'ดูรายการ',
                                    onClick: () => {
                                        supabase.from('tables_layout').select('*').eq('id', tableId).single().then(({ data }) => {
                                            if (data) handleSelectTable(data);
                                        });
                                    }
                                }
                            });
                            playSystemAlertSound();
                        }
                    }
                } else if (eventType === 'UPDATE') {
                    const newRemark = newRow?.staff_remark || '';
                    const newSlip = newRow?.payment_slip_url || '';

                    // 1. Pending Order Alert (New / Additional)
                    if (newRow?.status === 'pending') {
                        if (!activeNotificationsRef.current.has(pendingOrderKey)) {
                            activeNotificationsRef.current.add(pendingOrderKey);
                            toast.success(`🛎️ ออเดอร์เพิ่มเติม! โต๊ะ ${tableName} สั่งอาหารเข้าห้องครัวแล้ว`, {
                                duration: 10000,
                                action: {
                                    label: 'ดูรายการ',
                                    onClick: () => {
                                        supabase.from('tables_layout').select('*').eq('id', tableId).single().then(({ data }) => {
                                            if (data) handleSelectTable(data);
                                        });
                                    }
                                }
                            });
                            playSystemAlertSound();
                        }
                    } else {
                        // Clear pending status flag once order is accepted
                        activeNotificationsRef.current.delete(pendingOrderKey);
                    }

                    // 2. Call Bill Alert
                    if (newRemark.includes('[CALL_BILL]')) {
                        if (!activeNotificationsRef.current.has(callBillKey)) {
                            activeNotificationsRef.current.add(callBillKey);
                            toast.warning(`💵 โต๊ะ ${tableName} เรียกเช็คบิล!`, {
                                duration: 10000,
                                action: {
                                    label: 'เช็คบิล',
                                    onClick: () => {
                                        supabase.from('tables_layout').select('*').eq('id', tableId).single().then(({ data }) => {
                                            if (data) handleSelectTable(data);
                                        });
                                    }
                                }
                            });
                            playSystemAlertSound();
                        }
                    } else {
                        // Clear notification key if [CALL_BILL] is removed
                        activeNotificationsRef.current.delete(callBillKey);
                    }

                    // 3. Call Staff Alert
                    if (newRemark.includes('[CALL_STAFF]')) {
                        if (!activeNotificationsRef.current.has(callStaffKey)) {
                            activeNotificationsRef.current.add(callStaffKey);
                            toast.warning(`🔔 โต๊ะ ${tableName} เรียกพนักงาน!`, {
                                duration: 10000,
                                action: {
                                    label: 'ดูรายการ',
                                    onClick: () => {
                                        supabase.from('tables_layout').select('*').eq('id', tableId).single().then(({ data }) => {
                                            if (data) handleSelectTable(data);
                                        });
                                    }
                                }
                            });
                            playSystemAlertSound();
                        }
                    } else {
                        // Clear notification key if [CALL_STAFF] is removed
                        activeNotificationsRef.current.delete(callStaffKey);
                    }

                    // 4. Payment Slip Alert
                    if (newSlip) {
                        if (!activeNotificationsRef.current.has(slipReceivedKey)) {
                            activeNotificationsRef.current.add(slipReceivedKey);
                            toast.success(`📸 โต๊ะ ${tableName} ส่งหลักฐานโอนเงินแล้ว!`, {
                                duration: 10000,
                                action: {
                                    label: 'ตรวจสลิป',
                                    onClick: () => {
                                        supabase.from('tables_layout').select('*').eq('id', tableId).single().then(({ data }) => {
                                            if (data) handleSelectTable(data);
                                        });
                                    }
                                }
                            });
                            playSystemAlertSound();
                        }
                    } else {
                        activeNotificationsRef.current.delete(slipReceivedKey);
                    }
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(notifyChannel);
        };
    }, []);

    const handleSaveAndOpenSlip = async (type) => {
        if (currentOrder.items.length === 0 && !activeBooking) {
            toast.error("No items in order to print");
            return;
        }

        let bookingId = activeBooking?.id;
        let currentBooking = activeBooking;

        // 1. Create walk-in if no active booking
        if (!bookingId) {
            const newBooking = await createWalkIn(selectedTable);
            if (!newBooking) return;
            bookingId = newBooking.id;
            currentBooking = newBooking;
        }

        // 2. Submit items
        const newItems = currentOrder.items.filter(i => !i.db_id);
        if (newItems.length > 0) {
            const success = await submitOrderItems(bookingId, newItems);
            if (!success) return;
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
                    .select('*, tables_layout(*), profiles(*), order_items(*, menu_items(name, category_id))')
                    .eq('id', bookingId)
                    .maybeSingle();
                updatedBooking = data;
            } else {
                const cached = posCache.getBookings();
                updatedBooking = cached.find(b => b.id === bookingId);
            }
        }

        if (updatedBooking) {
            setActiveBooking(updatedBooking);
            // Update currentOrder item db_ids so they don't get re-submitted
            const updatedItems = (updatedBooking.order_items || []).map(oi => ({
                id: oi.menu_item_id,
                name: oi.menu_items?.name || oi.name || 'Item',
                price: oi.price_at_time,
                quantity: oi.quantity,
                db_id: oi.id,
                selected_options: oi.selected_options,
                category_id: oi.menu_items?.category_id || oi.category_id
            }));
            setCurrentOrder(prev => ({
                ...prev,
                items: updatedItems
            }));
            
            // 4. Open the Slip Modal
            setActiveSlipBooking(updatedBooking);
            setActiveSlipType(type);
        } else {
            setActiveSlipBooking(currentBooking);
            setActiveSlipType(type);
        }
    };

    const handleSelectOpenBill = async (booking) => {
        if (!booking) return;

        if (booking.table_id && booking.tables_layout) {
            handleSelectTable(booking.tables_layout);
        } else if (booking.table_id) {
            try {
                const { data: tableData } = await supabase
                    .from('tables_layout')
                    .select('*')
                    .eq('id', booking.table_id)
                    .maybeSingle();
                if (tableData) {
                    handleSelectTable(tableData);
                } else {
                    handleSelectPickupOrder(booking);
                }
            } catch (e) {
                handleSelectPickupOrder(booking);
            }
        } else if (booking.booking_type === 'pickup') {
            handleSelectPickupOrder(booking);
        } else {
            setActiveBooking(booking);
            setSelectedTable(null);
            const existingItems = (booking.order_items || []).map(oi => ({
                id: oi.menu_item_id,
                name: oi.menu_items?.name || oi.name || 'Item',
                price: oi.price_at_time,
                quantity: oi.quantity,
                db_id: oi.id,
                selected_options: oi.selected_options,
                category_id: oi.menu_items?.category_id || oi.category_id
            }));
            setCurrentOrder({
                items: existingItems,
                customer: booking.customer_name || booking.profiles?.display_name || 'Walk-in Guest',
                table: null
            });
            setView('menu');
        }
    };

    const { getActiveBooking, createWalkIn, createWalkInPickup, completeCheckout, submitOrderItems, acceptOrder, attachCustomerToBooking, updateGuestCount } = usePOSOrder();

    const [openTableModalData, setOpenTableModalData] = useState(null);
    const [openTablePaxInput, setOpenTablePaxInput] = useState('2');

    const handleSelectTable = async (table) => {
        setSelectedTable(table);
        if (table?.id) {
            localStorage.setItem('pos_active_table_id', table.id);
        }
        
        // 1. Check for active booking
        const booking = await getActiveBooking(table.id);
        
        if (booking) {
            setActiveBooking(booking);
            // Load existing items if any
            const existingItems = booking.order_items.map(oi => ({
                id: oi.menu_item_id,
                name: oi.menu_items?.name || oi.name || 'Item',
                price: oi.price_at_time,
                quantity: oi.quantity,
                db_id: oi.id,
                selected_options: oi.selected_options
            }));
            setCurrentOrder({
                items: existingItems,
                customer: booking.customer_name || 'Customer',
                table: table
            });
            setView('menu');
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
    };

    const handleConfirmOpenTable = async () => {
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
                setView('menu');
            } else {
                toast.error('ไม่สามารถเปิดโต๊ะได้', { id: toastId });
            }
        } catch (err) {
            console.error('Failed to open table:', err);
            toast.error('เกิดข้อผิดพลาดในการเปิดโต๊ะ', { id: toastId });
        }
    };

    const handleSelectPickupOrder = async (booking) => {
        setActiveBooking(booking);
        setSelectedTable(null); 
        
        const existingItems = booking.order_items ? booking.order_items.map(oi => ({
            id: oi.menu_item_id,
            name: oi.menu_items?.name || oi.name || 'Item',
            price: oi.price_at_time,
            quantity: oi.quantity,
            db_id: oi.id,
            selected_options: oi.selected_options
        })) : [];
        setCurrentOrder({
            items: existingItems,
            customer: booking.pickup_contact_name || booking.customer_note || 'Walk-in Pick-up',
            table: null
        });
        setView('menu');
    };

    const handleNewWalkInPickup = async () => {
        const note = prompt("กรุณาระบุชื่อลูกค้า หรือรายละเอียดออเดอร์ (Optional):", "Walk-in Pick-up") || "Walk-in Pick-up";
        const newBooking = await createWalkInPickup(note);
        if (newBooking) {
            handleSelectPickupOrder(newBooking);
        }
    };

    useEffect(() => {
        const autoSelectPending = async () => {
            try {
                const today = new Date().toISOString().split('T')[0];
                const { data: pendingBookings } = await supabase
                    .from('bookings')
                    .select('*, tables_layout(*)')
                    .eq('status', 'pending')
                    .gte('booking_time', `${today}T00:00:00`)
                    .order('booking_time', { ascending: false });
                    
                if (pendingBookings && pendingBookings.length > 0) {
                    const firstPending = pendingBookings[0];
                    if (firstPending.tables_layout) {
                        handleSelectTable(firstPending.tables_layout);
                    }
                }
            } catch (err) {
                console.error("Auto select pending failed:", err);
            }
        };

        const autoRestoreActiveTable = async () => {
            try {
                const activeTableId = localStorage.getItem('pos_active_table_id');
                if (activeTableId) {
                    const { data: tableData } = await supabase
                        .from('tables_layout')
                        .select('*')
                        .eq('id', activeTableId)
                        .maybeSingle();
                    if (tableData) {
                        const booking = await getActiveBooking(tableData.id);
                        if (booking) {
                            handleSelectTable(tableData);
                            return;
                        }
                    }
                }
            } catch (err) {
                console.error("Auto restore active table failed:", err);
            }
        };

        const params = new URLSearchParams(window.location.search);
        if (params.get('autoSelect') === 'pending') {
            autoSelectPending();
            window.history.replaceState({}, document.title, window.location.pathname);
        } else {
            autoRestoreActiveTable();
        }
    }, []);

    const handleBackToTables = () => {
        localStorage.removeItem('pos_active_table_id');
        setView('tables');
        setSelectedTable(null);
        setActiveBooking(null);
        setCurrentOrder({ items: [], customer: null, table: null });
    };

    const handleAddToOrder = (item) => {
        setCurrentOrder(prev => {
            const existing = prev.items.find(i => i.id === item.id);
            if (existing) {
                return {
                    ...prev,
                    items: prev.items.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)
                };
            }
            return {
                ...prev,
                items: [...prev.items, { ...item, quantity: 1 }]
            };
        });
    };

    const handleUpdateQuantity = (itemId, delta) => {
        setCurrentOrder(prev => ({
            ...prev,
            items: prev.items.map(item => {
                if (item.id === itemId) {
                    const newQty = Math.max(0, item.quantity + delta);
                    return { ...item, quantity: newQty };
                }
                return item;
            }).filter(item => item.quantity > 0)
        }));
    };

    const handleUpdateItemNote = (itemId, note) => {
        setCurrentOrder(prev => ({
            ...prev,
            items: prev.items.map(item => {
                if (item.id === itemId) {
                    return { ...item, item_note: note };
                }
                return item;
            })
        }));
    };

    const handleClearOrderOrTable = async () => {
        if (activeBooking) {
            const isConfirmed = window.confirm(`⚠️ คุณต้องการยกเลิกบิล / เคลียร์โต๊ะนี้ใช่หรือไม่?\nการดำเนินการนี้จะเปลี่ยนสถานะบิลเป็นยกเลิก (Void) และคืนค่าโต๊ะเป็นว่างทันที`);
            if (isConfirmed) {
                const toastId = toast.loading('กำลังยกเลิกบิลและเคลียร์โต๊ะ...');
                try {
                    const { error } = await supabase
                        .from('bookings')
                        .update({ status: 'void' })
                        .eq('id', activeBooking.id);
                    
                    if (error) throw error;
                    
                    // Void in active shift transactions if present
                    voidShiftTransaction(activeBooking.id);
                    
                    toast.success('ยกเลิกบิลและเคลียร์โต๊ะสำเร็จแล้ว', { id: toastId });
                    
                    // Clear states
                    localStorage.removeItem('pos_active_table_id');
                    setCurrentOrder({ items: [], customer: null, table: selectedTable });
                    setActiveBooking(null);
                    setAttachedMemberCrm(null);
                    setRefreshKey(prev => prev + 1);
                    
                    // Back to tables grid
                    setView('tables');
                    setSelectedTable(null);
                } catch (err) {
                    console.error("Failed to clear booking:", err);
                    toast.error('ไม่สามารถยกเลิกบิลได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง', { id: toastId });
                }
            }
        } else {
            // Cart has unsaved items only, no active booking in DB
            setCurrentOrder({ items: [], customer: null, table: selectedTable });
            setAttachedMemberCrm(null);
        }
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
        rewardId = null
    ) => {
        if (currentOrder.items.length === 0) return;

        let bookingId = activeBooking?.id;
        let currentBooking = activeBooking;

        // 1. Create walk-in if no active booking
        if (!bookingId) {
            const newBooking = await createWalkIn(selectedTable);
            if (!newBooking) return;
            bookingId = newBooking.id;
            currentBooking = newBooking;
        }

        // 2. Submit items
        const newItems = currentOrder.items.filter(i => !i.db_id);
        if (newItems.length > 0) {
            const success = await submitOrderItems(bookingId, newItems);
            if (!success) return;
        }

        // 3. Complete Checkout
        const subtotal = currentOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        let memberDiscount = 0;
        if (currentBooking && currentBooking.profiles) {
            const role = (currentBooking.profiles.role || 'customer').toLowerCase();
            const tier = attachedMemberCrm?.current_tier || '';
            const completedCount = parseInt(currentBooking.profiles.completed_bookings) || 0;
            let rate = 0;
            if (role === 'admin' || role === 'vip' || tier === 'Inner Haus') {
                rate = 0.15;
            } else if (role === 'gold' || tier === 'Haus People') {
                rate = 0.10;
            } else if (role === 'customer' || tier === 'Haus Common') {
                rate = 0.05;
            }
            memberDiscount = subtotal * rate;
        }

        const netBeforeTax = subtotal - memberDiscount - promoDiscount - manualDiscount - xhausDiscount;
        const finalTotal = includeTax ? Math.max(0, netBeforeTax * 1.07) : Math.max(0, netBeforeTax);

        const success = await completeCheckout(
            bookingId, 
            finalTotal, 
            paymentMethod, 
            memberDiscount + promoDiscount + manualDiscount + xhausDiscount, 
            pointsEarned, 
            xhausToRedeem, 
            xhausDiscount,
            rewardCode,
            rewardId
        );
        if (success) {
            localStorage.removeItem('pos_active_table_id');
            const updatedBooking = await getActiveBooking(selectedTable.id);
            if (updatedBooking) {
                setActiveSlipBooking(updatedBooking);
                setActiveSlipType('receipt');
            } else {
                setActiveSlipBooking(currentBooking);
                setActiveSlipType('receipt');
            }
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
                .gte('booking_time', `${today}T00:00:00`);

            const occupiedTableIds = (activeBookings || []).map(b => b.table_id);
            const free = (allTables || []).filter(t => !occupiedTableIds.includes(t.id));
            setAvailableTables(free);
            setShowMoveModal(true);
        } catch (err) {
            console.error("Failed to load tables for move, fallback to cache:", err);
            try {
                const cachedTables = JSON.parse(localStorage.getItem('pos_cache_tables_layout')) || [];
                const cachedBookings = JSON.parse(localStorage.getItem('pos_cache_active_bookings')) || [];
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
        
        if (!isOnline()) {
            const cachedBookings = JSON.parse(localStorage.getItem('pos_cache_active_bookings')) || [];
            const updated = cachedBookings.map(b => {
                if (b.id === activeBooking.id) {
                    return { ...b, table_id: targetTable.id };
                }
                return b;
            });
            localStorage.setItem('pos_cache_active_bookings', JSON.stringify(updated));
            
            addToOfflineQueue('move_table', { bookingId: activeBooking.id, tableId: targetTable.id });
            
            toast.success(`⚠️ ออฟไลน์: ย้ายโต๊ะสำเร็จ!`, { id: toastId });
            setShowMoveModal(false);
            setSelectedTable(targetTable);
            setRefreshKey(prev => prev + 1);
            return;
        }

        try {
            const { error } = await supabase
                .from('bookings')
                .update({ table_id: targetTable.id })
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
                .gte('booking_time', `${today}T00:00:00`);

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
                const cachedTables = JSON.parse(localStorage.getItem('pos_cache_tables_layout')) || [];
                const cachedBookings = JSON.parse(localStorage.getItem('pos_cache_active_bookings')) || [];
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

        if (!isOnline()) {
            const cachedBookings = JSON.parse(localStorage.getItem('pos_cache_active_bookings')) || [];
            const updatedBookings = cachedBookings.map(b => {
                if (b.id === targetBooking.id) {
                    const sourceItems = activeBooking.order_items || [];
                    const targetItems = b.order_items || [];
                    const mergedItems = [...targetItems, ...sourceItems.map(item => ({ ...item, booking_id: targetBooking.id }))];
                    return { ...b, order_items: mergedItems };
                }
                return b;
            }).filter(b => b.id !== activeBooking.id);
            
            localStorage.setItem('pos_cache_active_bookings', JSON.stringify(updatedBookings));
            addToOfflineQueue('merge_bills', { sourceBookingId: activeBooking.id, targetBookingId: targetBooking.id });
            
            toast.success(`⚠️ ออฟไลน์: รวมบิลสำเร็จ!`, { id: toastId });
            setShowMergeModal(false);
            setSelectedTable(targetTable);
            setRefreshKey(prev => prev + 1);
            return;
        }

        try {
            const { error: itemsErr } = await supabase
                .from('order_items')
                .update({ booking_id: targetBooking.id })
                .eq('booking_id', activeBooking.id);
                
            if (itemsErr) throw itemsErr;

            const { error: voidErr } = await supabase
                .from('bookings')
                .update({ status: 'void', staff_remark: `Merged into Table ${targetTable.table_name}` })
                .eq('id', activeBooking.id);
                
            if (voidErr) throw voidErr;
            
            toast.success(`รวมบิลเข้าโต๊ะ ${targetTable.table_name} สำเร็จ!`, { id: toastId });
            setShowMergeModal(false);
            setSelectedTable(targetTable);
            setRefreshKey(prev => prev + 1);
        } catch (err) {
            console.error("Merge bills failed:", err);
            toast.error("รวมบิลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", { id: toastId });
        }
    };

    const handleExecuteSplitPayment = async (paidItems, splitTotal, splitPaymentMethod, splitCashReceived, splitChange) => {
        if (!activeBooking || !selectedTable) return;
        const toastId = toast.loading('กำลังบันทึกแบ่งชำระเงิน...');

        const mockSplitBooking = {
            ...activeBooking,
            total_amount: splitTotal,
            discount_amount: 0,
            staff_remark: `Split Paid by ${splitPaymentMethod.toUpperCase()}`,
            order_items: paidItems.map(item => ({
                id: item.db_id || `split_${Date.now()}_${item.id}`,
                booking_id: activeBooking.id,
                menu_item_id: item.id,
                quantity: item.selectedQty,
                price_at_time: item.price,
                selected_options: item.selected_options || [],
                menu_items: { name: item.name }
            }))
        };

        if (splitPaymentMethod === 'cash') {
            localStorage.setItem('last_cash_received', splitCashReceived);
            localStorage.setItem('last_cash_change', splitChange);
        }

        if (!isOnline()) {
            const cachedBookings = JSON.parse(localStorage.getItem('pos_cache_active_bookings')) || [];
            const updatedBookings = cachedBookings.map(b => {
                if (b.id === activeBooking.id) {
                    const remainingItems = b.order_items.map(dbItem => {
                        const paid = paidItems.find(p => p.id === dbItem.menu_item_id);
                        if (paid) {
                            return { ...dbItem, quantity: Math.max(0, dbItem.quantity - paid.selectedQty) };
                        }
                        return dbItem;
                    }).filter(dbItem => dbItem.quantity > 0);
                    return { ...b, order_items: remainingItems };
                }
                return b;
            });
            localStorage.setItem('pos_cache_active_bookings', JSON.stringify(updatedBookings));

            addToOfflineQueue('split_payment', {
                bookingId: activeBooking.id,
                paidItems: paidItems.map(p => ({ menu_item_id: p.id, quantity: p.selectedQty })),
                paymentMethod: splitPaymentMethod,
                totalAmount: splitTotal
            });

            recordShiftTransaction(activeBooking.id, splitTotal, splitPaymentMethod);

            toast.success(`⚠️ ออฟไลน์: บันทึกแบ่งจ่ายสำเร็จ!`, { id: toastId });
            setShowSplitModal(false);
            setActiveSlipBooking(mockSplitBooking);
            setActiveSlipType('receipt');
            setRefreshKey(prev => prev + 1);
            return;
        }

        try {
            for (const item of paidItems) {
                if (item.selectedQty === item.quantity) {
                    const { error } = await supabase
                        .from('order_items')
                        .delete()
                        .eq('id', item.db_id);
                    if (error) throw error;
                } else {
                    const { error } = await supabase
                        .from('order_items')
                        .update({ quantity: item.quantity - item.selectedQty })
                        .eq('id', item.db_id);
                    if (error) throw error;
                }
            }

            recordShiftTransaction(activeBooking.id, splitTotal, splitPaymentMethod);

            toast.success('แบ่งจ่ายสำเร็จ!', { id: toastId });
            setShowSplitModal(false);
            setActiveSlipBooking(mockSplitBooking);
            setActiveSlipType('receipt');
            setRefreshKey(prev => prev + 1);
        } catch (err) {
            console.error("Split payment failed:", err);
            toast.error("บันทึกแบ่งจ่ายไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", { id: toastId });
        }
    };

    return (
        <div className="h-screen w-full bg-[#ECECE9] text-[#1A1A1A] overflow-hidden flex flex-col font-sans select-none">
            
            <POSLayout 
                activeView={view} 
                onViewChange={setView}
                selectedTable={selectedTable}
                onBack={handleBackToTables}
            >
                <div className="flex h-full w-full overflow-hidden">
                    {/* Main Content Area */}
                    <div className="flex-1 h-full overflow-hidden relative">
                        {/* Core views kept mounted for instant switching */}
                        <div className={view === 'tables' ? 'h-full' : 'hidden'}>
                            <POSTableGrid onSelectTable={handleSelectTable} hasPendingOrders={hasPendingOrders} refreshKey={refreshKey} />
                        </div>
                        <div className={view === 'menu' ? 'h-full' : 'hidden'}>
                            <POSMenuGrid onAddItem={handleAddToOrder} />
                        </div>

                        {/* Less frequent panels mounted conditionally */}
                        {view === 'open_bills' && (
                            <POSOpenBillsGrid 
                                onSelectOrder={handleSelectOpenBill} 
                                onOpenSlip={(booking, slipType) => {
                                    setActiveSlipBooking(booking);
                                    setActiveSlipType(slipType);
                                }} 
                                refreshKey={refreshKey} 
                            />
                        )}
                        {view === 'pickup' && (
                            <POSPickupGrid onSelectOrder={handleSelectPickupOrder} hasPendingOrders={hasPendingOrders} refreshKey={refreshKey} />
                        )}
                        {view === 'crm' && (
                            <POSCRMPanel />
                        )}
                        {view === 'reports' && (
                            <POSReportsPanel />
                        )}
                    </div>

                    {/* Order Panel Sidebar */}
                    {view !== 'reports' && view !== 'crm' && view !== 'open_bills' && (
                        <POSOrderPanel 
                            order={currentOrder} 
                            booking={activeBooking}
                            attachedMemberCrm={attachedMemberCrm}
                            onUpdateQuantity={handleUpdateQuantity}
                            onUpdateItemNote={handleUpdateItemNote}
                            onClear={handleClearOrderOrTable}
                            onCheckout={handleCheckout}
                            onAcceptOrder={async () => {
                                if (activeBooking) {
                                    const success = await acceptOrder(activeBooking.id);
                                    if (success) {
                                        let updatedBooking = null;
                                        if (selectedTable) {
                                            updatedBooking = await getActiveBooking(selectedTable.id);
                                        } else {
                                            const { data } = await supabase.from('bookings').select('*, tables_layout(*), profiles(*), order_items(*, menu_items(name, category_id))').eq('id', activeBooking.id).single();
                                            updatedBooking = data;
                                        }
                                        
                                        if (updatedBooking) {
                                            setActiveBooking(updatedBooking);
                                            setActiveSlipBooking(updatedBooking);
                                        } else {
                                            setActiveSlipBooking(activeBooking);
                                        }
                                        setActiveSlipType('kitchen');
                                        checkPendingOrders();
                                    }
                                }
                            }}
                            onOpenSlip={handleSaveAndOpenSlip}
                            onOpenSplitPayment={() => setShowSplitModal(true)}
                            onMoveTable={handleOpenMoveModal}
                            onMergeBill={handleOpenMergeModal}
                            onAttachCustomer={async (member) => {
                                if (!activeBooking) {
                                    toast.error("กรุณากดเปิดโต๊ะ (Seated Table) ก่อนผูกโปรไฟล์ลูกค้าครับ");
                                    return;
                                }
                                const success = await attachCustomerToBooking(activeBooking.id, member.id);
                                if (success) {
                                    const updatedBooking = await getActiveBooking(selectedTable.id);
                                    setActiveBooking(updatedBooking);
                                }
                            }}
                            onDetachCustomer={async () => {
                                if (activeBooking) {
                                    const success = await attachCustomerToBooking(activeBooking.id, null);
                                    if (success) {
                                        if (selectedTable) {
                                            const updatedBooking = await getActiveBooking(selectedTable.id);
                                            setActiveBooking(updatedBooking);
                                        } else {
                                            const { data } = await supabase.from('bookings').select('*, tables_layout(*), profiles(*), order_items(*, menu_items(name, category_id))').eq('id', activeBooking.id).single();
                                            if (data) setActiveBooking(data);
                                        }
                                    }
                                }
                            }}
                            onUpdateCustomerProfile={async () => {
                                if (activeBooking) {
                                    if (selectedTable) {
                                        const updatedBooking = await getActiveBooking(selectedTable.id);
                                        setActiveBooking(updatedBooking);
                                    } else {
                                        const { data } = await supabase.from('bookings').select('*, tables_layout(*), profiles(*), order_items(*, menu_items(name, category_id))').eq('id', activeBooking.id).single();
                                        if (data) setActiveBooking(data);
                                    }
                                }
                            }}
                        />
                    )}
                </div>
            </POSLayout>

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

            <POSOfflineQueueDrawer 
                isOpen={showOfflineQueueDrawer}
                onClose={() => setShowOfflineQueueDrawer(false)}
            />

            {/* Open Table Modal */}
            {openTableModalData && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none font-sans">
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

            {showMoveModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none">
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
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none">
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
                                availableTables.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => handleExecuteMergeBill(t)}
                                        className="w-full bg-white border border-[#D1D1CD] hover:border-[#1A1A1A] p-3 rounded-xl transition-all cursor-pointer flex items-center justify-between font-bold text-xs text-[#1A1A1A] shadow-sm active:scale-99"
                                    >
                                        <span>โต๊ะ {t.table_name}</span>
                                        <span className="text-[8px] font-mono text-[#ff0000] uppercase tracking-widest bg-red-50 px-2 py-0.5 rounded border border-red-100">OCCUPIED</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showSplitModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none">
                    <SplitPaymentModalInner 
                        order={currentOrder}
                        activeBooking={activeBooking}
                        includeTax={includeTax}
                        onClose={() => setShowSplitModal(false)}
                        onConfirmSplit={handleExecuteSplitPayment}
                    />
                </div>
            )}
            {/* Open Shift Overlay (Full Screen PIN Pad / Staff Grid) */}
            {!activeShift && (
                <div className="fixed inset-0 bg-[#ECECE9]/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl p-8 max-w-md w-full shadow-2xl flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">
                        
                        {!showOpeningFloatModal ? (
                            /* Step 1: Enter PIN Code to Identify Staff */
                            <div className="flex flex-col gap-4">
                                <div className="text-center">
                                    <div className="w-14 h-14 bg-[#ff0000]/10 text-[#ff0000] rounded-full flex items-center justify-center mx-auto mb-3 border border-[#ff0000]/20 shadow-inner">
                                        <Users size={28} />
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
                                    
                                    {/* PIN Dot Indicators */}
                                    <div className="flex justify-center gap-3.5 my-4">
                                        {[1, 2, 3, 4].map(idx => (
                                            <div 
                                                key={idx} 
                                                className={`w-3.5 h-3.5 rounded-full border border-[#D1D1CD] transition-all duration-100 ${
                                                    pinInput.length >= idx ? 'bg-[#ff0000] border-[#ff0000] scale-110 shadow-sm' : 'bg-white'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Numeric PIN Grid */}
                                <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto w-full">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                        <button
                                            key={num}
                                            onClick={() => {
                                                if (pinInput.length < 4) {
                                                    const newPin = pinInput + num;
                                                    setPinInput(newPin);
                                                    if (newPin.length === 4) {
                                                        const staff = staffList.find(s => s.pin === newPin);
                                                        if (staff) {
                                                            setSelectedStaffForLogin(staff);
                                                            setShowOpeningFloatModal(true);
                                                        } else {
                                                            toast.error('รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
                                                            setPinInput('');
                                                        }
                                                    }
                                                }
                                            }}
                                            className="h-12 rounded-xl bg-white border border-[#D1D1CD] hover:bg-[#EAEAEA] active:scale-95 text-sm font-mono font-bold text-[#1A1A1A] transition-all shadow-sm flex items-center justify-center cursor-pointer"
                                        >
                                            {num}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setPinInput('')}
                                        className="h-12 rounded-xl bg-[#FFF0F0] border border-[#FAD2D2] hover:bg-[#FCDCDC] active:scale-95 text-[10px] font-bold text-[#D32F2F] transition-all shadow-sm flex items-center justify-center cursor-pointer uppercase"
                                    >
                                        ล้าง (C)
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (pinInput.length < 4) {
                                                const newPin = pinInput + '0';
                                                setPinInput(newPin);
                                                if (newPin.length === 4) {
                                                    const staff = staffList.find(s => s.pin === newPin);
                                                    if (staff) {
                                                        setSelectedStaffForLogin(staff);
                                                        setShowOpeningFloatModal(true);
                                                    } else {
                                                        toast.error('รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
                                                        setPinInput('');
                                                    }
                                                }
                                            }
                                        }}
                                        className="h-12 rounded-xl bg-white border border-[#D1D1CD] hover:bg-[#EAEAEA] active:scale-95 text-sm font-mono font-bold text-[#1A1A1A] transition-all shadow-sm flex items-center justify-center cursor-pointer"
                                    >
                                        0
                                    </button>
                                    <button
                                        onClick={() => setPinInput(prev => prev.slice(0, -1))}
                                        className="h-12 rounded-xl bg-white border border-[#D1D1CD] hover:bg-[#EAEAEA] active:scale-95 text-sm font-mono font-bold text-[#1A1A1A] transition-all shadow-sm flex items-center justify-center cursor-pointer"
                                    >
                                        ←
                                    </button>
                                </div>
                                

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
                                        startShift(selectedStaffForLogin.display_name, openShiftForm.openingFloat);
                                        toast.success(`เปิดรอบการขายสำเร็จ: พนักงาน ${selectedStaffForLogin.display_name}`);
                                        setSelectedStaffForLogin(null);
                                        setPinInput('');
                                        setShowOpeningFloatModal(false);
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
                const summary = getShiftSummary();
                const adjustments = activeShift.adjustments || [];
                return (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
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
                                    <span className="font-bold text-[#1A1A1A]">{activeShift.staffName}</span>
                                </div>
                                <div>
                                    <span className="text-[#767673] font-mono font-bold uppercase text-[9px] block">Opened Time</span>
                                    <span className="font-mono font-bold text-[#1A1A1A]">
                                        {new Date(activeShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="col-span-2 border-t border-[#D1D1CD]/50 pt-2.5 grid grid-cols-2 gap-y-2 gap-x-4">
                                    <div className="flex justify-between">
                                        <span className="text-[#767673] font-mono font-bold uppercase text-[8px]">Opening Float:</span>
                                        <span className="font-mono font-bold">฿{activeShift.openingFloat.toLocaleString()}.-</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[#767673] font-mono font-bold uppercase text-[8px]">Cash Sales:</span>
                                        <span className="font-mono font-bold text-emerald-600">฿{summary.cashSales.toLocaleString()}.-</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[#767673] font-mono font-bold uppercase text-[8px]">QR Sales:</span>
                                        <span className="font-mono font-bold text-blue-600">฿{summary.qrSales.toLocaleString()}.-</span>
                                    </div>
                                    <div className="flex justify-between border-t border-[#D1D1CD]/30 pt-1">
                                        <span className="text-[#767673] font-mono font-bold uppercase text-[8px]">Petty Cash In/Out:</span>
                                        <span className={`font-mono font-bold ${summary.totalIn - summary.totalOut >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {summary.totalIn - summary.totalOut >= 0 ? '+' : '-'}฿{Math.abs(summary.totalIn - summary.totalOut).toLocaleString()}.-
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
                                                    {adj.type === 'in' ? '+' : '-'}฿{adj.amount.toLocaleString()}.-
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
                                    ฿{summary.expectedCash.toLocaleString()}.-
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
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
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
                <div className="fixed inset-0 bg-[#ECECE9]/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
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
                                
                                {/* PIN Dot Indicators */}
                                <div className="flex justify-center gap-3.5 my-4">
                                    {[1, 2, 3, 4].map(idx => (
                                        <div 
                                            key={idx} 
                                            className={`w-3.5 h-3.5 rounded-full border border-[#D1D1CD] transition-all duration-100 ${
                                                lockPinInput.length >= idx ? 'bg-[#ff0000] border-[#ff0000] scale-110 shadow-sm' : 'bg-white'
                                            }`}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Numeric PIN Grid */}
                            <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto w-full">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                    <button
                                        key={num}
                                        onClick={() => {
                                            if (lockPinInput.length < 4) {
                                                const newPin = lockPinInput + num;
                                                setLockPinInput(newPin);
                                                if (newPin.length === 4) {
                                                    const staff = staffList.find(s => s.pin === newPin);
                                                    if (staff) {
                                                        // Verify / Switch active shift staff name
                                                        if (activeShift.staffName !== staff.display_name) {
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
                                                        setIsLocked(false);
                                                        setLockPinInput('');
                                                    } else {
                                                        toast.error('รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
                                                        setLockPinInput('');
                                                    }
                                                }
                                            }
                                        }}
                                        className="h-12 rounded-xl bg-white border border-[#D1D1CD] hover:bg-[#EAEAEA] active:scale-95 text-sm font-mono font-bold text-[#1A1A1A] transition-all shadow-sm flex items-center justify-center cursor-pointer"
                                    >
                                        {num}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setLockPinInput('')}
                                    className="h-12 rounded-xl bg-[#FFF0F0] border border-[#FAD2D2] hover:bg-[#FCDCDC] active:scale-95 text-[10px] font-bold text-[#D32F2F] transition-all shadow-sm flex items-center justify-center cursor-pointer uppercase"
                                >
                                    ล้าง (C)
                                </button>
                                <button
                                    onClick={() => {
                                        if (lockPinInput.length < 4) {
                                            const newPin = lockPinInput + '0';
                                            setLockPinInput(newPin);
                                            if (newPin.length === 4) {
                                                const staff = staffList.find(s => s.pin === newPin);
                                                if (staff) {
                                                    if (activeShift.staffName !== staff.display_name) {
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
                                                    setIsLocked(false);
                                                    setLockPinInput('');
                                                } else {
                                                    toast.error('รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
                                                    setLockPinInput('');
                                                }
                                            }
                                        }
                                    }}
                                    className="h-12 rounded-xl bg-white border border-[#D1D1CD] hover:bg-[#EAEAEA] active:scale-95 text-sm font-mono font-bold text-[#1A1A1A] transition-all shadow-sm flex items-center justify-center cursor-pointer"
                                >
                                    0
                                </button>
                                <button
                                    onClick={() => setLockPinInput(prev => prev.slice(0, -1))}
                                    className="h-12 rounded-xl bg-white border border-[#D1D1CD] hover:bg-[#EAEAEA] active:scale-95 text-sm font-mono font-bold text-[#1A1A1A] transition-all shadow-sm flex items-center justify-center cursor-pointer"
                                >
                                    ←
                                </button>
                            </div>
                            

                        </div>
                        
                    </div>
                </div>
            )}
        </div>
    );
}

function SplitPaymentModalInner({ order, activeBooking, includeTax, onClose, onConfirmSplit }) {
    const [splitQuantities, setSplitQuantities] = useState({});
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [cashReceived, setCashReceived] = useState('');

    useEffect(() => {
        const initial = {};
        order.items.forEach(item => {
            initial[item.id] = 0;
        });
        setSplitQuantities(initial);
    }, [order.items]);

    const handleQtyChange = (itemId, change, maxQty) => {
        setSplitQuantities(prev => {
            const current = prev[itemId] || 0;
            const next = Math.max(0, Math.min(maxQty, current + change));
            return { ...prev, [itemId]: next };
        });
    };

    const hasNewItems = order.items.some(item => !item.db_id);
    const selectedItems = order.items.map(item => ({
        ...item,
        selectedQty: splitQuantities[item.id] || 0
    })).filter(item => item.selectedQty > 0);

    const splitSubtotal = selectedItems.reduce((sum, item) => sum + (item.price * item.selectedQty), 0);
    const splitTax = includeTax ? splitSubtotal * 0.07 : 0;
    const splitTotal = splitSubtotal + splitTax;

    const isPayingAll = selectedItems.length > 0 && selectedItems.every(item => item.selectedQty === item.quantity) && selectedItems.length === order.items.length;

    const handleConfirmClick = () => {
        if (selectedItems.length === 0) {
            toast.error("กรุณาเลือกรายการสินค้าที่จะชำระเงินก่อนครับ");
            return;
        }

        if (paymentMethod === 'cash') {
            const cashRecvVal = parseFloat(cashReceived) || 0;
            if (cashRecvVal < splitTotal) {
                toast.error("จำนวนเงินสดที่รับมาไม่เพียงพอครับ");
                return;
            }
        }

        if (isPayingAll) {
            toast.info("เลือกทุกรายการสินค้า ระบบจะเปลี่ยนเป็นการเช็คบิลปกติโดยอัตโนมัติ");
            onClose();
            // Trigger regular checkout by finding checkout button or closing modal
            return;
        }

        const changeVal = paymentMethod === 'cash' ? Math.max(0, (parseFloat(cashReceived) || 0) - splitTotal).toFixed(2) : '0.00';
        onConfirmSplit(selectedItems, splitTotal, paymentMethod, parseFloat(cashReceived) || 0, changeVal);
    };

    return (
        <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl w-full max-w-md shadow-xl p-5 flex flex-col gap-4 text-[#1A1A1A]">
            <div className="flex justify-between items-center pb-2 border-b border-[#D1D1CD]">
                <div>
                    <h3 className="text-xs font-mono font-bold tracking-widest text-[#767673] uppercase">SPLIT BILL / แบ่งชำระเงิน</h3>
                    <p className="text-sm font-bold text-[#1A1A1A] mt-0.5">เลือกรายการสินค้าและจำนวนที่จะจ่ายรอบนี้</p>
                </div>
                <button 
                    onClick={onClose}
                    className="w-7 h-7 rounded-full bg-white border border-[#D1D1CD] flex items-center justify-center text-[#767673] hover:text-[#1A1A1A] transition-colors cursor-pointer"
                >
                    <X size={14} />
                </button>
            </div>

            {hasNewItems && (
                <div className="bg-[#FFF9E6] border border-[#E5A900] rounded-xl p-3 text-[10px] text-amber-800 font-medium">
                    ⚠️ มีรายการยังไม่ส่งครัว! กรุณากดส่งครัว (Send to Kitchen) เพื่อบันทึกออเดอร์ให้เรียบร้อยก่อนทำการแบ่งจ่ายครับ
                </div>
            )}

            {/* Items Listing */}
            <div className="flex-1 overflow-y-auto max-h-60 space-y-1.5 pr-1">
                {order.items.map(item => {
                    const currentSelected = splitQuantities[item.id] || 0;
                    return (
                        <div key={item.id} className="bg-white border border-[#D1D1CD] p-2.5 rounded-xl flex items-center justify-between shadow-sm">
                            <div className="min-w-0 flex-1">
                                <h5 className="font-bold text-[11px] text-[#1A1A1A] uppercase truncate">{item.name}</h5>
                                <p className="text-[9px] text-[#ff0000] font-mono font-bold">฿{item.price}</p>
                            </div>
                            
                            <div className="flex items-center gap-3 shrink-0">
                                <span className="text-[10px] font-mono text-[#767673] font-bold">Max: {item.quantity}</span>
                                <div className="flex items-center bg-[#E0E0DC] border border-[#B0B0AC] rounded-md p-0.5 gap-0.5 scale-90">
                                    <button 
                                        type="button"
                                        disabled={hasNewItems}
                                        onClick={() => handleQtyChange(item.id, -1, item.quantity)}
                                        className="w-6 h-6 rounded flex items-center justify-center hover:bg-white text-[#767673] hover:text-[#1A1A1A] transition-colors cursor-pointer disabled:opacity-30"
                                    >
                                        <Minus size={8} />
                                    </button>
                                    <span className="w-5 text-center font-mono font-bold text-[10px]">{currentSelected}</span>
                                    <button 
                                        type="button"
                                        disabled={hasNewItems}
                                        onClick={() => handleQtyChange(item.id, 1, item.quantity)}
                                        className="w-6 h-6 rounded flex items-center justify-center hover:bg-white text-[#767673] hover:text-[#1A1A1A] transition-colors cursor-pointer disabled:opacity-30"
                                    >
                                        <Plus size={8} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Split total & payment selector */}
            <div className="border-t border-[#D1D1CD] pt-3 space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold">
                    <span>ยอดที่เลือกจ่ายรอบนี้ (Selected Total)</span>
                    <span className="text-sm font-black text-[#ff0000]">฿{splitTotal.toFixed(2)}</span>
                </div>

                <div className="flex bg-[#E0E0DC] p-0.5 rounded-lg border border-[#D1D1CD] w-full font-mono text-[9px] font-bold uppercase tracking-wider gap-0.5">
                    <button 
                        type="button"
                        onClick={() => setPaymentMethod('cash')}
                        className={`flex-1 py-1 rounded-md transition-all flex items-center justify-center gap-0.5 cursor-pointer ${paymentMethod === 'cash' ? 'bg-white text-[#1A1A1A] shadow-sm font-black' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                    >
                        CASH
                    </button>
                    <button 
                        type="button"
                        onClick={() => setPaymentMethod('qr')}
                        className={`flex-1 py-1 rounded-md transition-all flex items-center justify-center gap-0.5 cursor-pointer ${paymentMethod === 'qr' ? 'bg-white text-[#1A1A1A] shadow-sm font-black' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                    >
                        QR
                    </button>
                </div>

                {paymentMethod === 'cash' && (
                    <div className="bg-white border border-[#D1D1CD] rounded-xl p-2.5 space-y-2 text-left shadow-sm">
                        <div className="flex justify-between items-center">
                            <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-[#767673]">
                                Cash Received (รับเงินมา)
                            </span>
                            <input 
                                type="number"
                                placeholder="0.00"
                                value={cashReceived}
                                onChange={(e) => setCashReceived(e.target.value)}
                                className="w-24 text-right bg-[#F5F5F2] border border-[#D1D1CD] rounded-lg px-2 py-0.5 text-xs font-mono font-bold text-[#1A1A1A] outline-none focus:border-black"
                            />
                        </div>
                        <div className="flex justify-between items-center text-[9px] border-t border-dashed border-[#D1D1CD] pt-2">
                            <span className="font-bold text-[#767673]">Change (เงินทอน)</span>
                            <span className={`font-mono font-bold text-xs ${parseFloat(cashReceived) >= splitTotal ? 'text-green-600' : 'text-[#ff0000]'}`}>
                                {parseFloat(cashReceived) >= splitTotal 
                                    ? `฿${(parseFloat(cashReceived) - splitTotal).toFixed(2)}` 
                                    : cashReceived ? `ขาดอีก ฿${(splitTotal - parseFloat(cashReceived)).toFixed(2)}` : '฿0.00'}
                            </span>
                        </div>
                    </div>
                )}

                <button
                    type="button"
                    disabled={hasNewItems || selectedItems.length === 0}
                    onClick={handleConfirmClick}
                    className="w-full bg-[#ff0000] hover:bg-[#d00000] border border-[#c00000] text-white py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer mt-1"
                >
                    Confirm Pay Split / ยืนยันชำระเงิน
                </button>
            </div>
        </div>
    );
}

