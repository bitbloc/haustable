import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import POSLayout from './POSLayout';
import POSTableGrid from './POSTableGrid';
import POSMenuGrid from './POSMenuGrid';
import POSOrderPanel from './POSOrderPanel';
import { usePOSOrder } from '../hooks/usePOSOrder';
import { Toaster, toast } from 'sonner';
import POSReportsPanel from './POSReportsPanel';
import POSCRMPanel from './POSCRMPanel';
import SlipModal from '../components/shared/SlipModal';
import { getCurrentShift, startShift, closeShift, addShiftAdjustment, checkAndRestoreActiveShift } from '../utils/shiftHelper';
import { isOnline } from '../utils/offlineHelper';
import { printToSunmiBuiltIn, encodeShiftClosureReportData } from '../utils/printerHelper';
import { Users, Lock, Key, Plus, Minus, LogIn, LogOut, Printer, X, Search } from 'lucide-react';

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

    const [alertSoundUrl, setAlertSoundUrl] = useState(null);
    const [audioContext, setAudioContext] = useState(null);
    const [hasPendingOrders, setHasPendingOrders] = useState(false);

    // Track unique realtime alerts to prevent audio overlap and duplicates
    const activeNotificationsRef = useRef(new Set());
    const lastPlayedSoundTimeRef = useRef(0);

    // Shift Management States
    const [activeShift, setActiveShift] = useState(getCurrentShift());
    const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
    const [openShiftForm, setOpenShiftForm] = useState({ staffName: '', openingFloat: '1000' });
    const [closeShiftForm, setCloseShiftForm] = useState({ actualCash: '' });

    // PIN and Cash Adjustment States
    const [staffList, setStaffList] = useState([]);
    const [selectedStaffForLogin, setSelectedStaffForLogin] = useState(null);
    const [pinInput, setPinInput] = useState('');
    const [showOpeningFloatModal, setShowOpeningFloatModal] = useState(false);
    const [showCashAdjustmentModal, setShowCashAdjustmentModal] = useState(false);
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
                const updatedData = [...data];
                for (let i = 0; i < updatedData.length; i++) {
                    const profile = updatedData[i];
                    if (!profile.pin) {
                        const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
                        const { error: updateErr } = await supabase
                            .from('profiles')
                            .update({ pin: randomPin })
                            .eq('id', profile.id);
                        
                        if (!updateErr) {
                            updatedData[i] = { ...profile, pin: randomPin };
                        } else {
                            const localPins = JSON.parse(localStorage.getItem('pos_staff_pins')) || {};
                            localPins[profile.id] = randomPin;
                            localStorage.setItem('pos_staff_pins', JSON.stringify(localPins));
                            updatedData[i] = { ...profile, pin: randomPin };
                        }
                    }
                }
                setStaffList(updatedData);
            } else {
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from('profiles')
                    .select('id, display_name, role')
                    .in('role', ['staff', 'admin']);
                
                if (!fallbackError && fallbackData && fallbackData.length > 0) {
                    const localPins = JSON.parse(localStorage.getItem('pos_staff_pins')) || {};
                    const mapped = fallbackData.map(p => {
                        let pin = localPins[p.id];
                        if (!pin) {
                            pin = Math.floor(1000 + Math.random() * 9000).toString();
                            localPins[p.id] = pin;
                        }
                        return { ...p, pin };
                    });
                    localStorage.setItem('pos_staff_pins', JSON.stringify(localPins));
                    setStaffList(mapped);
                } else {
                    const DEFAULT_STAFF = [
                        { id: 'default_1', display_name: 'แคชเชียร์ A (Cashier A)', role: 'staff', pin: '1111' },
                        { id: 'default_2', display_name: 'แคชเชียร์ B (Cashier B)', role: 'staff', pin: '2222' },
                        { id: 'default_3', display_name: 'ผู้จัดการ (Manager)', role: 'admin', pin: '9999' }
                    ];
                    setStaffList(DEFAULT_STAFF);
                }
            }
        } catch (err) {
            console.error("Failed to load staff profiles, loading mock defaults:", err);
            const DEFAULT_STAFF = [
                { id: 'default_1', display_name: 'แคชเชียร์ A (Cashier A)', role: 'staff', pin: '1111' },
                { id: 'default_2', display_name: 'แคชเชียร์ B (Cashier B)', role: 'staff', pin: '2222' },
                { id: 'default_3', display_name: 'ผู้จัดการ (Manager)', role: 'admin', pin: '9999' }
            ];
            setStaffList(DEFAULT_STAFF);
        }
    };

    useEffect(() => {
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

        window.addEventListener('pos-shift-changed', handleShiftChanged);
        window.addEventListener('pos-trigger-close-shift', handleTriggerClose);
        window.addEventListener('pos-trigger-cash-adjustment', handleTriggerCashAdj);

        return () => {
            window.removeEventListener('pos-shift-changed', handleShiftChanged);
            window.removeEventListener('pos-trigger-close-shift', handleTriggerClose);
            window.removeEventListener('pos-trigger-cash-adjustment', handleTriggerCashAdj);
        };
    }, []);

    const getShiftSummary = () => {
        if (!activeShift) return { cashSales: 0, qrSales: 0, totalSales: 0, expectedCash: 0, totalIn: 0, totalOut: 0 };
        const cashSales = activeShift.transactions
            .filter(tx => tx.paymentMethod === 'cash')
            .reduce((sum, tx) => sum + tx.amount, 0);
        const qrSales = activeShift.transactions
            .filter(tx => tx.paymentMethod === 'qr')
            .reduce((sum, tx) => sum + tx.amount, 0);
            
        const adjustments = activeShift.adjustments || [];
        const totalIn = adjustments.filter(a => a.type === 'in').reduce((sum, a) => sum + a.amount, 0);
        const totalOut = adjustments.filter(a => a.type === 'out').reduce((sum, a) => sum + a.amount, 0);

        return {
            cashSales,
            qrSales,
            totalSales: cashSales + qrSales,
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
        
        const reportData = {
            staffName: activeShift.staffName,
            openedAt: activeShift.openedAt,
            closedAt: new Date().toISOString(),
            openingFloat: activeShift.openingFloat,
            cashSales: summary.cashSales,
            qrSales: summary.qrSales,
            totalSales: summary.totalSales,
            totalIn: summary.totalIn,
            totalOut: summary.totalOut,
            expectedCash: summary.expectedCash,
            actualCash: actual,
            difference: actual - summary.expectedCash
        };

        // Close shift locally
        closeShift(actual);
        setShowCloseShiftModal(false);
        setCloseShiftForm({ actualCash: '' });
        toast.success('ปิดรอบการทำงานและบันทึกประวัติสำเร็จแล้ว');

        // Print shift report to SUNMI
        try {
            const rawBytes = encodeShiftClosureReportData(reportData, '80mm', 'sunmi');
            const printRes = await printToSunmiBuiltIn(rawBytes);
            if (printRes) {
                toast.success('พิมพ์ใบสรุปยอดปิดกะเรียบร้อยแล้ว');
            }
        } catch (printErr) {
            console.error("Failed to print shift report on SUNMI:", printErr);
            toast.error('ไม่สามารถพิมพ์ใบรายงานได้ แต่ระบบทำการปิดกะสำเร็จแล้ว');
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

    // Check pending orders helper
    const checkPendingOrders = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const { count, error } = await supabase
                .from('bookings')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pending')
                .gte('booking_time', `${today}T00:00:00`);
            
            if (!error) {
                setHasPendingOrders((count || 0) > 0);
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

        // Poll pending orders every 8 seconds
        const pollInterval = setInterval(checkPendingOrders, 8000);

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
    }, [hasPendingOrders, alertSoundUrl, audioContext]);

    const playSystemAlertSound = () => {
        const now = Date.now();
        if (now - lastPlayedSoundTimeRef.current < 4000) {
            console.log("Sound alert play throttled to prevent overlap.");
            return;
        }
        lastPlayedSoundTimeRef.current = now;

        if (alertSoundUrl) {
            try {
                const audio = new Audio(alertSoundUrl);
                audio.play().catch(e => {
                    console.warn("Failed to play custom sound, playing synth beep:", e);
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
        const updatedBooking = await getActiveBooking(selectedTable.id);
        if (updatedBooking) {
            setActiveBooking(updatedBooking);
            // Update currentOrder item db_ids so they don't get re-submitted
            const updatedItems = updatedBooking.order_items.map(oi => ({
                id: oi.menu_item_id,
                name: oi.menu_items?.name || oi.name || 'Item',
                price: oi.price_at_time,
                quantity: oi.quantity,
                db_id: oi.id,
                selected_options: oi.selected_options
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

    const { getActiveBooking, createWalkIn, completeCheckout, submitOrderItems, acceptOrder, attachCustomerToBooking } = usePOSOrder();

    const handleSelectTable = async (table) => {
        setSelectedTable(table);
        
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
        } else {
            setActiveBooking(null);
            setCurrentOrder({
                items: [],
                customer: 'Walk-in Guest',
                table: table
            });
        }
        
        setView('menu');
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

        const params = new URLSearchParams(window.location.search);
        if (params.get('autoSelect') === 'pending') {
            autoSelectPending();
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    const handleBackToTables = () => {
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

    const handleCheckout = async (
        paymentMethod, 
        includeTax, 
        pointsEarned = 0, 
        xhausToRedeem = 0, 
        xhausDiscount = 0,
        promoDiscount = 0,
        manualDiscount = 0,
        rewardCode = null
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
            rewardCode
        );
        if (success) {
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
                        {view === 'tables' ? (
                            <POSTableGrid onSelectTable={handleSelectTable} hasPendingOrders={hasPendingOrders} refreshKey={refreshKey} />
                        ) : view === 'menu' ? (
                            <POSMenuGrid onAddItem={handleAddToOrder} />
                        ) : view === 'crm' ? (
                            <POSCRMPanel />
                        ) : (
                            <POSReportsPanel />
                        )}
                    </div>

                    {/* Order Panel Sidebar */}
                    {view !== 'reports' && view !== 'crm' && (
                        <POSOrderPanel 
                            order={currentOrder} 
                            booking={activeBooking}
                            attachedMemberCrm={attachedMemberCrm}
                            onUpdateQuantity={handleUpdateQuantity}
                            onClear={() => setCurrentOrder({ items: [], customer: null, table: selectedTable })}
                            onCheckout={handleCheckout}
                            onAcceptOrder={async () => {
                                if (activeBooking) {
                                    const success = await acceptOrder(activeBooking.id);
                                    if (success) {
                                        const updatedBooking = await getActiveBooking(selectedTable.id);
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
                            onAttachCustomer={() => {
                                if (!activeBooking) {
                                    toast.error("กรุณากดเปิดโต๊ะ (Seated Table) ก่อนผูกโปรไฟล์ลูกค้าครับ");
                                    return;
                                }
                                setShowAttachCRMModal(true);
                            }}
                            onDetachCustomer={async () => {
                                if (activeBooking) {
                                    const success = await attachCustomerToBooking(activeBooking.id, null);
                                    if (success) {
                                        const updatedBooking = await getActiveBooking(selectedTable.id);
                                        setActiveBooking(updatedBooking);
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
                        setActiveSlipBooking(null);
                        if (activeSlipType === 'receipt') {
                            handleBackToTables();
                        }
                    }}
                />
            )}

            {/* Attach Customer CRM Modal */}
            {showAttachCRMModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl overflow-hidden max-w-md w-full shadow-2xl flex flex-col max-h-[80vh]">
                        {/* Header */}
                        <div className="p-4 flex justify-between items-center text-[#1A1A1A] border-b border-[#D1D1CD]">
                            <h3 className="font-mono font-bold text-xs uppercase tracking-widest">Attach Customer Profile</h3>
                            <button 
                                onClick={() => setShowAttachCRMModal(false)} 
                                className="p-2 hover:bg-[#E0E0DC] text-[#767673] hover:text-[#1A1A1A] rounded-full transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="p-4 border-b border-[#D1D1CD] bg-white">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#767673]" size={14} />
                                <input 
                                    type="text"
                                    placeholder="SEARCH CUSTOMERS BY NAME OR PHONE..."
                                    value={crmSearchTerm}
                                    onChange={(e) => setCrmSearchTerm(e.target.value)}
                                    className="w-full bg-[#F5F5F2] border border-[#D1D1CD] rounded-lg py-2.5 pl-9 pr-4 text-xs text-[#1A1A1A] placeholder-[#767673] focus:outline-none focus:border-[#ff0000] font-medium transition-colors font-mono"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Customer List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-white max-h-[50vh]">
                            {crmLoading ? (
                                <div className="flex flex-col items-center justify-center opacity-50 py-12">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#ff0000] mb-2"></div>
                                    <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-[#767673]">LOADING REGISTRY...</span>
                                </div>
                            ) : filteredCrmMembers.length > 0 ? (
                                filteredCrmMembers.map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => handleSelectCrmCustomer(m)}
                                        className="w-full text-left bg-[#F5F5F2] hover:bg-[#E0E0DC] border border-[#D1D1CD] hover:border-[#B0B0AC] p-3 rounded-xl transition-all cursor-pointer flex items-center justify-between group shadow-sm"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-full border border-[#D1D1CD] bg-white overflow-hidden p-0.5 select-none shrink-0 flex items-center justify-center font-mono font-bold text-xs text-[#767673]">
                                                {m.avatar_url ? (
                                                    <img src={m.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                                ) : (
                                                    m.display_name?.charAt(0).toUpperCase() || 'U'
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-xs text-[#1A1A1A] uppercase tracking-tight truncate">{m.display_name || 'Anonymous User'}</p>
                                                <p className="text-[9px] font-mono text-[#767673] mt-0.5">{m.phone || m.email || 'No Phone/Email'}</p>
                                            </div>
                                        </div>
                                        <span className="text-[9px] font-mono font-bold text-[#ff0000] uppercase tracking-wider border border-[#ff0000]/20 bg-[#ff0000]/5 px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                            ATTACH
                                        </span>
                                    </button>
                                ))
                            ) : (
                                <div className="text-center font-mono text-[9px] text-[#767673] py-12 uppercase italic">
                                    No customer profiles found
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Open Shift Overlay (Full Screen PIN Pad / Staff Grid) */}
            {!activeShift && (
                <div className="fixed inset-0 bg-[#ECECE9]/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl p-8 max-w-md w-full shadow-2xl flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">
                        
                        {!selectedStaffForLogin ? (
                            /* Step 1: Select Staff Member */
                            <div className="flex flex-col gap-5">
                                <div className="text-center">
                                    <div className="w-14 h-14 bg-[#ff0000]/10 text-[#ff0000] rounded-full flex items-center justify-center mx-auto mb-3 border border-[#ff0000]/20 shadow-inner">
                                        <Users size={28} />
                                    </div>
                                    <h2 className="text-lg font-bold font-sans tracking-tight text-[#1A1A1A]">ระบบลงชื่อเข้าเวร POS</h2>
                                    <p className="text-[10px] text-[#767673] font-mono mt-0.5 uppercase tracking-wider">Select Cashier Staff Profile</p>
                                </div>

                                <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                                    {staffList.map(staff => (
                                        <button
                                            key={staff.id}
                                            onClick={() => {
                                                setSelectedStaffForLogin(staff);
                                                setPinInput('');
                                                setShowOpeningFloatModal(false);
                                            }}
                                            className="w-full bg-white border border-[#D1D1CD] hover:border-[#ff0000]/40 rounded-xl p-3 flex items-center justify-between text-left transition-all active:scale-[0.99] cursor-pointer shadow-sm group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-[#EAEAEA] flex items-center justify-center font-bold text-[#ff0000] uppercase text-xs border border-[#D1D1CD] group-hover:bg-[#ff0000]/10 transition-colors">
                                                    {staff.display_name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-[#1A1A1A] leading-tight">{staff.display_name}</p>
                                                    <p className="text-[8px] font-mono text-[#767673] uppercase tracking-widest leading-none mt-0.5">{staff.role}</p>
                                                </div>
                                            </div>
                                            <Lock size={12} className="text-[#D1D1CD] group-hover:text-[#ff0000] transition-colors" />
                                        </button>
                                    ))}
                                </div>

                                {/* Debug Dev PIN Help (Manager view for easy testing) */}
                                <div className="bg-[#FFF9E6] border border-[#E5A900] rounded-lg p-2.5 text-[9px] text-amber-800/80 font-mono flex flex-col gap-0.5 shadow-sm leading-tight">
                                    <span className="font-bold uppercase tracking-wider block text-amber-900/90">Staff PIN Directory (Testing):</span>
                                    {staffList.map(s => (
                                        <span key={s.id}>• {s.display_name}: PIN {s.pin}</span>
                                    ))}
                                </div>
                            </div>
                        ) : !showOpeningFloatModal ? (
                            /* Step 2: Enter PIN Code */
                            <div className="flex flex-col gap-4">
                                <div className="text-center">
                                    <p className="text-[9px] font-mono font-bold text-[#767673] uppercase tracking-widest">SECURITY VERIFICATION</p>
                                    <h3 className="text-sm font-bold text-[#1A1A1A] mt-0.5">ระบุรหัส PIN ของ {selectedStaffForLogin.display_name}</h3>
                                    
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
                                                        if (newPin === selectedStaffForLogin.pin) {
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
                                                    if (newPin === selectedStaffForLogin.pin) {
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

                                <button
                                    onClick={() => setSelectedStaffForLogin(null)}
                                    className="w-full text-center text-[#767673] hover:text-[#1A1A1A] text-[10px] font-bold uppercase tracking-wider py-1.5 transition-colors cursor-pointer mt-2"
                                >
                                    ย้อนกลับเลือกพนักงาน (Change Staff)
                                </button>
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
        </div>
    );
}
