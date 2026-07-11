import React, { useState, useEffect } from 'react';
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
import { getCurrentShift, startShift, closeShift } from '../utils/shiftHelper';
import { isOnline } from '../utils/offlineHelper';
import { printToSunmiBuiltIn, encodeShiftReportData } from '../utils/printerHelper';

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

    // Shift Management States
    const [activeShift, setActiveShift] = useState(getCurrentShift());
    const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
    const [openShiftForm, setOpenShiftForm] = useState({ staffName: '', openingFloat: '1000' });
    const [closeShiftForm, setCloseShiftForm] = useState({ actualCash: '' });

    useEffect(() => {
        const handleShiftChanged = () => {
            setActiveShift(getCurrentShift());
        };
        const handleTriggerClose = () => {
            setShowCloseShiftModal(true);
        };
        window.addEventListener('pos-shift-changed', handleShiftChanged);
        window.addEventListener('pos-trigger-close-shift', handleTriggerClose);
        return () => {
            window.removeEventListener('pos-shift-changed', handleShiftChanged);
            window.removeEventListener('pos-trigger-close-shift', handleTriggerClose);
        };
    }, []);

    const getShiftSummary = () => {
        if (!activeShift) return { cashSales: 0, qrSales: 0, totalSales: 0, expectedCash: 0 };
        const cashSales = activeShift.transactions
            .filter(tx => tx.paymentMethod === 'cash')
            .reduce((sum, tx) => sum + tx.amount, 0);
        const qrSales = activeShift.transactions
            .filter(tx => tx.paymentMethod === 'qr')
            .reduce((sum, tx) => sum + tx.amount, 0);
        return {
            cashSales,
            qrSales,
            totalSales: cashSales + qrSales,
            expectedCash: activeShift.openingFloat + cashSales
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
            const rawBytes = encodeShiftReportData(reportData, '80mm');
            const printRes = await printToSunmiBuiltIn(rawBytes);
            if (printRes) {
                toast.success('พิมพ์ใบสรุปยอดปิดกะเรียบร้อยแล้ว');
            }
        } catch (printErr) {
            console.error("Failed to print shift report on SUNMI:", printErr);
            toast.error('ไม่สามารถพิมพ์ใบรายงานได้ แต่ระบบทำการปิดกะสำเร็จแล้ว');
        }
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
                const { eventType, new: newRow, old: oldRow } = payload;
                const tableId = newRow?.table_id || oldRow?.table_id;
                if (!tableId) return;

                const tableName = tablesMap[tableId] || `Table #${tableId}`;

                if (eventType === 'INSERT') {
                    if (newRow.status === 'pending') {
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
                } else if (eventType === 'UPDATE') {
                    const oldRemark = oldRow?.staff_remark || '';
                    const newRemark = newRow?.staff_remark || '';
                    if (newRemark.includes('[CALL_BILL]') && !oldRemark.includes('[CALL_BILL]')) {
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

                    if (newRemark.includes('[CALL_STAFF]') && !oldRemark.includes('[CALL_STAFF]')) {
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

                    const oldSlip = oldRow?.payment_slip_url || '';
                    const newSlip = newRow?.payment_slip_url || '';
                    if (newSlip && !oldSlip) {
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

    const { getActiveBooking, createWalkIn, completeCheckout, submitOrderItems, acceptOrder } = usePOSOrder();

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

    const handleCheckout = async (paymentMethod, includeTax) => {
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
        const finalTotal = includeTax ? subtotal * 1.07 : subtotal;

        const success = await completeCheckout(bookingId, finalTotal, paymentMethod);
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
            <Toaster position="top-right" richColors />
            
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

            {/* Open Shift Overlay (Full Screen) */}
            {!activeShift && (
                <div className="fixed inset-0 bg-[#ECECE9]/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl p-8 max-w-md w-full shadow-2xl flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="text-center">
                            <div className="w-14 h-14 bg-[#FF5500]/10 text-[#FF5500] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#FF5500]/20 shadow-inner">
                                <Users size={28} />
                            </div>
                            <h2 className="text-xl font-bold font-sans tracking-tight text-[#1A1A1A]">เปิดรอบการทำงานเครื่อง POS</h2>
                            <p className="text-xs text-[#767673] font-mono mt-1 uppercase tracking-wide">Enter Cashier Name & Opening Float</p>
                        </div>

                        <form onSubmit={handleStartShiftSubmit} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-[10px] font-mono font-bold tracking-widest text-[#767673] uppercase mb-1.5">
                                    ชื่อพนักงาน (Staff Name)
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="ระบุชื่อพนักงานผู้รับผิดชอบกะ"
                                    value={openShiftForm.staffName}
                                    onChange={(e) => setOpenShiftForm(prev => ({ ...prev, staffName: e.target.value }))}
                                    className="w-full bg-white border border-[#D1D1CD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF5500] focus:ring-2 focus:ring-[#FF5500]/15 transition-all text-[#1A1A1A] font-bold shadow-inner"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-mono font-bold tracking-widest text-[#767673] uppercase mb-1.5">
                                    เงินทอนเริ่มต้น (Opening Float)
                                </label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    step="any"
                                    value={openShiftForm.openingFloat}
                                    onChange={(e) => setOpenShiftForm(prev => ({ ...prev, openingFloat: e.target.value }))}
                                    className="w-full bg-white border border-[#D1D1CD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF5500] focus:ring-2 focus:ring-[#FF5500]/15 transition-all text-[#1A1A1A] font-mono font-bold shadow-inner"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-[#FF5500] hover:bg-[#D04500] text-white py-3.5 rounded-xl font-bold text-sm tracking-wide shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
                            >
                                <Users size={16} />
                                <span>เปิดกะระบบขาย (Start Shift)</span>
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Close Shift Modal */}
            {showCloseShiftModal && activeShift && (() => {
                const summary = getShiftSummary();
                return (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
                        <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl p-6 max-w-lg w-full shadow-2xl flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between border-b border-[#D1D1CD] pb-3">
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
                            <div className="grid grid-cols-2 gap-3 text-xs bg-white border border-[#D1D1CD] rounded-xl p-4 shadow-sm">
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
                                <div className="col-span-2 border-t border-[#D1D1CD]/50 pt-2 grid grid-cols-3 gap-2">
                                    <div>
                                        <span className="text-[#767673] font-mono font-bold uppercase text-[8px] block">Opening Float</span>
                                        <span className="font-mono font-bold">฿{activeShift.openingFloat.toLocaleString()}.-</span>
                                    </div>
                                    <div>
                                        <span className="text-[#767673] font-mono font-bold uppercase text-[8px] block">Cash Sales</span>
                                        <span className="font-mono font-bold text-emerald-600">฿{summary.cashSales.toLocaleString()}.-</span>
                                    </div>
                                    <div>
                                        <span className="text-[#767673] font-mono font-bold uppercase text-[8px] block">QR Sales</span>
                                        <span className="font-mono font-bold text-blue-600">฿{summary.qrSales.toLocaleString()}.-</span>
                                    </div>
                                </div>
                            </div>

                            {/* Expected Cash reconciliation */}
                            <div className="bg-[#FFF9E6] border border-[#E5A900] rounded-xl p-4 flex justify-between items-center shadow-sm">
                                <div>
                                    <span className="text-[#805E00] font-mono font-bold uppercase text-[9px] block">Expected Cash in Drawer</span>
                                    <span className="text-[10px] text-amber-800/80 leading-none">เงินสดตั้งต้น + ยอดขายเงินสด</span>
                                </div>
                                <span className="font-mono font-black text-[#1A1A1A] text-lg">
                                    ฿{summary.expectedCash.toLocaleString()}.-
                                </span>
                            </div>

                            {/* Input for Actual cash */}
                            <form onSubmit={handleCloseShiftSubmit} className="flex flex-col gap-4">
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
                                            className="w-full bg-white border border-[#D1D1CD] rounded-xl pl-9 pr-4 py-3 text-base font-mono font-bold focus:outline-none focus:border-[#FF5500] focus:ring-2 focus:ring-[#FF5500]/15 transition-all text-[#1A1A1A] shadow-inner"
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
                                        className="flex-1 bg-[#FF5500] hover:bg-[#D04500] text-white py-3.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 active:scale-98"
                                    >
                                        <span>ปิดกะและพิมพ์สรุปยอด</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
