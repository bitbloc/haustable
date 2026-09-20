/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { getThaiDate } from '../../utils/timeUtils';
import { fetchAndSortMenu } from '../../utils/menuHelper';
import { sendPOSBroadcast } from '../../utils/realtimeNotifier';
import { playOrderAlert } from '../../utils/audioHelper';
import { getShortBookingId } from '../../utils/printerHelper';
import { toast } from 'sonner';

export default function AdminTestSandboxModal({
    isOpen,
    onClose,
    tablesList = [],
    onSuccess
}) {
    // Active Tab: 'dine_in' | 'pickup' | 'purge'
    const [activeTab, setActiveTab] = useState('dine_in');

    // Menu state
    const [menuItems, setMenuItems] = useState([]);
    const [loadingMenu, setLoadingMenu] = useState(false);

    // Common Submission State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastCreatedBooking, setLastCreatedBooking] = useState(null);

    // ==========================================
    // TAB 1: DINE-IN TABLE RESERVATION STATE
    // ==========================================
    const [dineInTableId, setDineInTableId] = useState('');
    const [dineInDate, setDineInDate] = useState(() => getThaiDate());
    const [dineInTime, setDineInTime] = useState('18:00');
    const [dineInPax, setDineInPax] = useState(2);
    const [dineInCustomerName, setDineInCustomerName] = useState('[TEST] คุณทดสอบ จองโต๊ะ');
    const [dineInCustomerPhone, setDineInCustomerPhone] = useState('089-999-9999');
    const [dineInSelectedItems, setDineInSelectedItems] = useState([]); // [{ id, name, price, quantity }]
    const [dineInDepositMode, setDineInDepositMode] = useState('half'); // 'half' (50%) | 'full' (100%) | 'custom'
    const [dineInCustomDeposit, setDineInCustomDeposit] = useState('');

    // ==========================================
    // TAB 2: PICK-UP ORDER STATE
    // ==========================================
    const [pickupTimeOffset, setPickupTimeOffset] = useState(20); // Minutes from now
    const [pickupCustomerName, setPickupCustomerName] = useState('[TEST] คุณทดสอบ รับกลับ');
    const [pickupCustomerPhone, setPickupCustomerPhone] = useState('089-999-9999');
    const [pickupSelectedItems, setPickupSelectedItems] = useState([]);

    // ==========================================
    // TAB 3: TEST RECORDS & PURGE STATE
    // ==========================================
    const [testRecords, setTestRecords] = useState([]);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [isPurging, setIsPurging] = useState(false);

    // Load menu on mount / modal open
    useEffect(() => {
        if (isOpen) {
            loadMenu();
            if (tablesList.length > 0 && !dineInTableId) {
                const firstActive = tablesList.find(t => t.is_active !== false);
                if (firstActive) setDineInTableId(firstActive.id);
            }
            if (activeTab === 'purge') {
                fetchTestRecords();
            }
        }
    }, [isOpen, activeTab]);

    const loadMenu = async () => {
        if (menuItems.length > 0) return;
        setLoadingMenu(true);
        try {
            const { menuItems: items } = await fetchAndSortMenu();
            setMenuItems(items || []);
            // Pre-select 2 popular real items if cart is empty
            if (items && items.length > 0) {
                const item1 = items[0];
                const item2 = items[1] || items[0];
                if (dineInSelectedItems.length === 0) {
                    setDineInSelectedItems([
                        { id: item1.id, name: item1.name, price: Number(item1.price || 0), quantity: 1 },
                        { id: item2.id, name: item2.name, price: Number(item2.price || 0), quantity: 1 }
                    ]);
                }
                if (pickupSelectedItems.length === 0) {
                    setPickupSelectedItems([
                        { id: item1.id, name: item1.name, price: Number(item1.price || 0), quantity: 1 }
                    ]);
                }
            }
        } catch (e) {
            console.warn('[AdminTestSandboxModal] Failed to load menu items:', e);
        } finally {
            setLoadingMenu(false);
        }
    };

    // Calculate Dine-in Financials (Real Sum & Deposit Calculation)
    const dineInTotal = useMemo(() => {
        return dineInSelectedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    }, [dineInSelectedItems]);

    const dineInDeposit = useMemo(() => {
        if (dineInDepositMode === 'full') return dineInTotal;
        if (dineInDepositMode === 'custom') {
            const parsed = parseFloat(dineInCustomDeposit);
            return isNaN(parsed) ? 0 : Math.min(dineInTotal, Math.max(0, parsed));
        }
        // Default: 50% deposit (Standard shop policy)
        return Math.ceil(dineInTotal * 0.5);
    }, [dineInTotal, dineInDepositMode, dineInCustomDeposit]);

    const dineInRemainingDue = useMemo(() => {
        return Math.max(0, dineInTotal - dineInDeposit);
    }, [dineInTotal, dineInDeposit]);

    // Calculate Pickup Financials (100% Paid by default)
    const pickupTotal = useMemo(() => {
        return pickupSelectedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    }, [pickupSelectedItems]);

    // Item List Mutators
    const handleUpdateDineInItemQty = (itemId, delta) => {
        setDineInSelectedItems(prev => {
            return prev.map(item => {
                if (item.id === itemId) {
                    const newQty = item.quantity + delta;
                    return newQty > 0 ? { ...item, quantity: newQty } : null;
                }
                return item;
            }).filter(Boolean);
        });
    };

    const handleAddDineInItem = (menuItem) => {
        setDineInSelectedItems(prev => {
            const existing = prev.find(i => i.id === menuItem.id);
            if (existing) {
                return prev.map(i => i.id === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, {
                id: menuItem.id,
                name: menuItem.name,
                price: Number(menuItem.price || 0),
                quantity: 1
            }];
        });
    };

    const handleUpdatePickupItemQty = (itemId, delta) => {
        setPickupSelectedItems(prev => {
            return prev.map(item => {
                if (item.id === itemId) {
                    const newQty = item.quantity + delta;
                    return newQty > 0 ? { ...item, quantity: newQty } : null;
                }
                return item;
            }).filter(Boolean);
        });
    };

    const handleAddPickupItem = (menuItem) => {
        setPickupSelectedItems(prev => {
            const existing = prev.find(i => i.id === menuItem.id);
            if (existing) {
                return prev.map(i => i.id === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, {
                id: menuItem.id,
                name: menuItem.name,
                price: Number(menuItem.price || 0),
                quantity: 1
            }];
        });
    };

    // ==========================================
    // ACTION 1: SUBMIT DINE-IN TEST BOOKING
    // ==========================================
    const handleSubmitDineInTest = async () => {
        if (!dineInTableId) {
            return toast.error('กรุณาเลือกโต๊ะสำหรับการจอง');
        }
        if (dineInSelectedItems.length === 0 || dineInTotal <= 0) {
            return toast.error('กรุณาเลือกรายการอาหารอย่างน้อย 1 รายการ');
        }

        setIsSubmitting(true);
        setLastCreatedBooking(null);

        try {
            const cleanTime = String(dineInTime).trim().replace('.', ':');
            const bookingTimeIso = `${dineInDate}T${cleanTime}:00+07:00`;
            const endDate = new Date(new Date(bookingTimeIso).getTime() + (2 * 60 * 60 * 1000));
            const endTimeIso = endDate.toISOString();

            const mockTransRef = `MOCK-SCB-${Date.now().toString().slice(-8)}`;
            const trackingToken = crypto.randomUUID();

            const mockSlipVerifiedData = {
                mock: true,
                transRef: mockTransRef,
                amountInSlip: dineInDeposit,
                bankName: 'SCB (ไทยพาณิชย์ Easy)',
                senderName: dineInCustomerName,
                receiverName: 'IN THE HAUS CO., LTD.',
                verifiedAt: new Date().toISOString()
            };

            const staffRemarkTag = `[TEST_BOOKING] ทดสอบระบบจองโต๊ะ (มัดจำ ฿${dineInDeposit} / คงเหลือ ฿${dineInRemainingDue})`;

            const bookingPayload = {
                booking_type: 'dine_in',
                status: 'confirmed',
                table_id: dineInTableId,
                booking_time: bookingTimeIso,
                end_time: endTimeIso,
                pax: Number(dineInPax) || 2,
                pickup_contact_name: dineInCustomerName.trim(),
                pickup_contact_phone: dineInCustomerPhone.trim() || null,
                total_amount: dineInTotal,
                deposit_amount: dineInDeposit,
                payment_slip_url: null,
                slip_verified: true,
                slip_provider: 'bank',
                slip_trans_ref: mockTransRef,
                slip_verification_status: 'auto_verified',
                slip_verified_data: mockSlipVerifiedData,
                customer_note: 'ทดสอบการหักเงินมัดจำหน้าร้าน POS (Zero-Cost Simulation)',
                staff_remark: staffRemarkTag,
                source: 'online',
                tracking_token: trackingToken,
                created_at: new Date().toISOString()
            };

            // 1. Insert Booking Record
            const { data: createdBooking, error: insertError } = await supabase
                .from('bookings')
                .insert(bookingPayload)
                .select(`
                    *,
                    tables_layout (id, table_name, capacity)
                `)
                .single();

            if (insertError) throw insertError;

            // 2. Insert Pre-ordered Items
            if (dineInSelectedItems.length > 0 && createdBooking?.id) {
                const orderItemsToInsert = dineInSelectedItems.map(item => ({
                    booking_id: createdBooking.id,
                    menu_item_id: item.id,
                    quantity: Number(item.quantity || 1),
                    price_at_time: Number(item.price || 0),
                    selected_options: null,
                    status: 'pending'
                }));

                const { error: itemsError } = await supabase
                    .from('order_items')
                    .insert(orderItemsToInsert);

                if (itemsError) console.warn('[AdminTestSandboxModal] Order items insert warning:', itemsError);
            }

            // 3. Emit Realtime Notifications & Play Sound
            const targetTable = tablesList.find(t => t.id === dineInTableId);
            const targetTableName = targetTable?.table_name || 'N/A';

            await sendPOSBroadcast('online_order_created', {
                booking_id: createdBooking.id,
                table_id: dineInTableId,
                table_name: targetTableName,
                deposit_amount: dineInDeposit,
                total_amount: dineInTotal
            });

            playOrderAlert('new_booking');

            setLastCreatedBooking({
                ...createdBooking,
                tableName: targetTableName,
                type: 'dine_in'
            });

            toast.success(`สร้างการจองโต๊ะ ${targetTableName} สำเร็จ! มัดจำ ฿${dineInDeposit} เข้าสู่ POS แล้ว`);
            if (onSuccess) onSuccess();

        } catch (err) {
            console.error('[AdminTestSandboxModal] Submission Error:', err);
            toast.error('เกิดข้อผิดพลาดในการสร้างการจองทดสอบ: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ==========================================
    // ACTION 2: SUBMIT PICK-UP TEST ORDER
    // ==========================================
    const handleSubmitPickupTest = async () => {
        if (pickupSelectedItems.length === 0 || pickupTotal <= 0) {
            return toast.error('กรุณาเลือกรายการอาหารอย่างน้อย 1 รายการ');
        }

        setIsSubmitting(true);
        setLastCreatedBooking(null);

        try {
            const now = new Date();
            const pickupTargetDate = new Date(now.getTime() + (Number(pickupTimeOffset) * 60 * 1000));
            const pickupIso = pickupTargetDate.toISOString();

            const mockTransRef = `MOCK-KP-${Date.now().toString().slice(-8)}`;
            const trackingToken = crypto.randomUUID();

            const mockSlipVerifiedData = {
                mock: true,
                transRef: mockTransRef,
                amountInSlip: pickupTotal,
                bankName: 'K PLUS (กสิกรไทย)',
                senderName: pickupCustomerName,
                receiverName: 'IN THE HAUS CO., LTD.',
                verifiedAt: new Date().toISOString()
            };

            const staffRemarkTag = `[TEST_PICKUP] ทดสอบสั่งรับกลับ (ชำระเต็มจำนวน ฿${pickupTotal} / สลิปตรวจผ่าน ✓)`;

            const bookingPayload = {
                booking_type: 'pickup',
                status: 'confirmed',
                table_id: null,
                booking_time: pickupIso,
                end_time: null,
                pax: 1,
                pickup_contact_name: pickupCustomerName.trim(),
                pickup_contact_phone: pickupCustomerPhone.trim() || null,
                total_amount: pickupTotal,
                deposit_amount: pickupTotal, // 100% full payment
                payment_slip_url: null,
                slip_verified: true,
                slip_provider: 'bank',
                slip_trans_ref: mockTransRef,
                slip_verification_status: 'auto_verified',
                slip_verified_data: mockSlipVerifiedData,
                customer_note: `เวลารับสินค้า: ${pickupTargetDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น. (ทดสอบ POS Pickup)`,
                staff_remark: staffRemarkTag,
                source: 'online',
                tracking_token: trackingToken,
                created_at: new Date().toISOString()
            };

            // 1. Insert Booking Record
            const { data: createdBooking, error: insertError } = await supabase
                .from('bookings')
                .insert(bookingPayload)
                .select('*')
                .single();

            if (insertError) throw insertError;

            // 2. Insert Pre-ordered Items
            if (pickupSelectedItems.length > 0 && createdBooking?.id) {
                const orderItemsToInsert = pickupSelectedItems.map(item => ({
                    booking_id: createdBooking.id,
                    menu_item_id: item.id,
                    quantity: Number(item.quantity || 1),
                    price_at_time: Number(item.price || 0),
                    selected_options: null,
                    status: 'pending'
                }));

                const { error: itemsError } = await supabase
                    .from('order_items')
                    .insert(orderItemsToInsert);

                if (itemsError) console.warn('[AdminTestSandboxModal] Pickup order items warning:', itemsError);
            }

            // 3. Emit Realtime Notifications & Play Sound
            await sendPOSBroadcast('online_order_created', {
                booking_id: createdBooking.id,
                booking_type: 'pickup',
                total_amount: pickupTotal,
                deposit_amount: pickupTotal
            });

            playOrderAlert('new_order');

            setLastCreatedBooking({
                ...createdBooking,
                type: 'pickup'
            });

            toast.success(`สร้างออเดอร์ Pick-up สำเร็จ! ยอด ฿${pickupTotal} [PAID] ส่งเข้า POS เรียบร้อย`);
            if (onSuccess) onSuccess();

        } catch (err) {
            console.error('[AdminTestSandboxModal] Pickup Submission Error:', err);
            toast.error('เกิดข้อผิดพลาดในการสร้างออเดอร์ Pick-up ทดสอบ: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ==========================================
    // ACTION 3: FETCH & PURGE TEST DATA
    // ==========================================
    const fetchTestRecords = useCallback(async () => {
        setLoadingRecords(true);
        try {
            const { data, error } = await supabase
                .from('bookings')
                .select(`
                    id,
                    booking_type,
                    status,
                    total_amount,
                    deposit_amount,
                    pickup_contact_name,
                    staff_remark,
                    booking_time,
                    created_at,
                    tables_layout (table_name)
                `)
                .or('staff_remark.ilike.%[TEST_%,pickup_contact_name.ilike.%[TEST_%')
                .order('created_at', { ascending: false })
                .limit(50);

            if (!error && data) {
                setTestRecords(data);
            }
        } catch (e) {
            console.warn('Fetch test records warning:', e);
        } finally {
            setLoadingRecords(false);
        }
    }, []);

    const handlePurgeAllTests = async () => {
        if (!window.confirm('ยืนยันการล้างข้อมูลการทดสอบทั้งหมด? โต๊ะใน POS จะกลับสู่สถานะว่าง และออเดอร์ทดสอบจะถูกลบออกจากระบบ')) {
            return;
        }

        setIsPurging(true);
        try {
            const testIds = testRecords.map(r => r.id);
            if (testIds.length === 0) {
                toast.info('ไม่พบข้อมูลทดสอบที่ต้องลบ');
                return;
            }

            // Delete order_items first
            await supabase.from('order_items').delete().in('booking_id', testIds);
            // Delete bookings
            const { error } = await supabase.from('bookings').delete().in('id', testIds);

            if (error) throw error;

            toast.success(`ล้างข้อมูลทดสอบจำนวน ${testIds.length} รายการเรียบร้อย`);
            setTestRecords([]);
            setLastCreatedBooking(null);

            // Notify POS to refresh tables
            await sendPOSBroadcast('BOOKING_UPDATED', { action: 'purge_test' });
            if (onSuccess) onSuccess();
        } catch (err) {
            toast.error('เกิดข้อผิดพลาดในการล้างข้อมูลทดสอบ: ' + err.message);
        } finally {
            setIsPurging(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 font-mono text-xs animate-in fade-in duration-150">
            <div className="bg-[var(--color-paper)] border-2 border-[var(--color-rule)] max-w-3xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
                
                {/* 1. Modal Top Bar (Tabular Header) */}
                <div className="p-4 border-b border-[var(--color-rule)] bg-[var(--color-paper-2)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold tracking-wider text-[var(--color-accent)] uppercase bg-[var(--color-paper)] px-2 py-0.5 border border-[var(--color-rule)]">
                                SYS.SANDBOX · ZERO COST · POS ENGINE
                            </span>
                            <span className="text-[10px] text-[var(--color-neutral)]">
                                V1.0 · ATELIER WORKBENCH
                            </span>
                        </div>
                        <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)] uppercase mt-1 tracking-tight">
                            ศูนย์ทดสอบระบบ POS & ยอดมัดจำหน้าร้าน
                        </h2>
                        <p className="text-[11px] text-[var(--color-neutral)] mt-0.5 font-sans font-medium">
                            จำลองการจองโต๊ะและการสั่งรับกลับด้วยยอดเงินจริง เพื่อตรวจสอบการหักเงินมัดจำในบิล POS โดยไม่ต้องโอนเงินจริง
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="self-end sm:self-center px-3 py-1.5 border border-[var(--color-rule)] bg-[var(--color-paper)] hover:bg-[var(--color-ink)] hover:text-[var(--color-paper)] text-[var(--color-ink)] font-bold text-xs uppercase transition-colors cursor-pointer"
                    >
                        [✕ ปิดหน้าต่าง]
                    </button>
                </div>

                {/* 2. Navigation Tabs (Cellular Dividers) */}
                <div className="grid grid-cols-3 border-b border-[var(--color-rule)] bg-[var(--color-paper)] select-none">
                    <button
                        type="button"
                        onClick={() => { setActiveTab('dine_in'); setLastCreatedBooking(null); }}
                        className={`p-3 text-left font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer border-r border-[var(--color-rule)] flex flex-col justify-between min-h-[54px] ${
                            activeTab === 'dine_in'
                                ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                                : 'bg-[var(--color-paper)] text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]'
                        }`}
                    >
                        <span className="text-[10px] opacity-75 font-mono">01/ DINE-IN</span>
                        <span className="truncate">จองโต๊ะ & หักมัดจำ</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => { setActiveTab('pickup'); setLastCreatedBooking(null); }}
                        className={`p-3 text-left font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer border-r border-[var(--color-rule)] flex flex-col justify-between min-h-[54px] ${
                            activeTab === 'pickup'
                                ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                                : 'bg-[var(--color-paper)] text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]'
                        }`}
                    >
                        <span className="text-[10px] opacity-75 font-mono">02/ PICKUP</span>
                        <span className="truncate">สั่งกลับ & ตัดจ่าย [PAID]</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => { setActiveTab('purge'); setLastCreatedBooking(null); fetchTestRecords(); }}
                        className={`p-3 text-left font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer flex flex-col justify-between min-h-[54px] ${
                            activeTab === 'purge'
                                ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                                : 'bg-[var(--color-paper)] text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]'
                        }`}
                    >
                        <span className="text-[10px] opacity-75 font-mono">03/ PURGE</span>
                        <span className="truncate">ข้อมูลทดสอบ & ล้างข้อมูล</span>
                    </button>
                </div>

                {/* 3. Main Modal Body (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">

                    {/* Success Beacon & Direct POS Navigation Banner */}
                    {lastCreatedBooking && (
                        <div className="p-4 bg-[oklch(94%_0.03_140)] border-2 border-[var(--color-accent-2)] text-[oklch(22%_0.06_140)] space-y-2.5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--color-accent-2)]/30 pb-2">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent-2)] block">
                                        SUCCESSFULLY INJECTED INTO POS ENGINE
                                    </span>
                                    <h4 className="text-sm font-bold uppercase text-[var(--color-ink)] mt-0.5">
                                        {lastCreatedBooking.type === 'dine_in'
                                            ? `บันทึกการจองโต๊ะ ${lastCreatedBooking.tableName || ''} เรียบร้อยแล้ว`
                                            : `บันทึกออเดอร์ Pick-up #${getShortBookingId(lastCreatedBooking)} เรียบร้อยแล้ว`}
                                    </h4>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-1 bg-[var(--color-paper)] border border-[var(--color-accent-2)] text-[var(--color-accent-2)] uppercase self-start">
                                    MOCK SLIP AUTO-VERIFIED ✓
                                </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                                <div>
                                    <span className="text-[10px] text-[var(--color-neutral)] block">ยอดรวมอาหารจริง:</span>
                                    <strong className="text-sm text-[var(--color-ink)]">฿{Number(lastCreatedBooking.total_amount || 0).toLocaleString()}</strong>
                                </div>
                                <div>
                                    <span className="text-[10px] text-[var(--color-accent)] block">ยอดมัดจำที่โอนแล้ว:</span>
                                    <strong className="text-sm text-[var(--color-accent)]">฿{Number(lastCreatedBooking.deposit_amount || 0).toLocaleString()}</strong>
                                </div>
                                <div>
                                    <span className="text-[10px] text-[var(--color-neutral)] block">คงเหลือเรียกเก็บที่ POS:</span>
                                    <strong className="text-sm text-[var(--color-ink)]">
                                        ฿{Math.max(0, Number(lastCreatedBooking.total_amount || 0) - Number(lastCreatedBooking.deposit_amount || 0)).toLocaleString()}
                                    </strong>
                                </div>
                                <div>
                                    <span className="text-[10px] text-[var(--color-neutral)] block">รหัสธุรกรรมจำลอง:</span>
                                    <strong className="text-[11px] text-[var(--color-neutral)] block truncate">{lastCreatedBooking.slip_trans_ref}</strong>
                                </div>
                            </div>

                            <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-[var(--color-accent-2)]/30">
                                <a
                                    href="/pos"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-4 py-2 bg-[var(--color-ink)] text-[var(--color-paper)] hover:opacity-90 font-bold uppercase text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                                >
                                    <span>🚀 ไปที่หน้า POS หน้าร้าน เพื่อดูบิลและการหักมัดจำ (/pos) →</span>
                                </a>
                                {lastCreatedBooking.tracking_token && (
                                    <a
                                        href={`/tracking/${lastCreatedBooking.tracking_token}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="px-3 py-2 bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] font-bold text-xs uppercase"
                                    >
                                        [ ดูหน้า Tracking ]
                                    </a>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ==================================================== */}
                    {/* TAB 1: DINE-IN RESERVATION TEST                      */}
                    {/* ==================================================== */}
                    {activeTab === 'dine_in' && (
                        <div className="space-y-4">
                            {/* Step 1: Table & Timing Selection */}
                            <div className="p-3.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] space-y-3">
                                <div className="flex items-center justify-between border-b border-[var(--color-rule)] pb-2">
                                    <span className="text-[10px] font-bold text-[var(--color-neutral)] uppercase tracking-wider">
                                        ขั้นตอนที่ 1 / เลือกโต๊ะ และเวลารับบริการ
                                    </span>
                                    <span className="text-[10px] font-mono text-[var(--color-accent)] font-bold">
                                        TABLE TARGET
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                    <div className="sm:col-span-2">
                                        <label className="text-[10px] font-bold text-[var(--color-neutral)] uppercase block mb-1">
                                            เลือกโต๊ะจากแปลนร้าน (Active Tables)
                                        </label>
                                        <select
                                            value={dineInTableId}
                                            onChange={(e) => setDineInTableId(e.target.value)}
                                            className="w-full p-2 bg-[var(--color-paper)] border border-[var(--color-rule)] text-xs font-mono font-bold text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-ink)]"
                                        >
                                            <option value="">— เลือกโต๊ะ —</option>
                                            {tablesList.map(t => (
                                                <option key={t.id} value={t.id}>
                                                    {t.table_name} (ความจุ: {t.capacity} ที่นั่ง)
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold text-[var(--color-neutral)] uppercase block mb-1">
                                            จำนวนแขก (PAX)
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="30"
                                            value={dineInPax}
                                            onChange={(e) => setDineInPax(e.target.value)}
                                            className="w-full p-2 bg-[var(--color-paper)] border border-[var(--color-rule)] text-xs font-mono font-bold text-[var(--color-ink)]"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold text-[var(--color-neutral)] uppercase block mb-1">
                                            เวลาจอง (TIME)
                                        </label>
                                        <input
                                            type="text"
                                            value={dineInTime}
                                            onChange={(e) => setDineInTime(e.target.value)}
                                            className="w-full p-2 bg-[var(--color-paper)] border border-[var(--color-rule)] text-xs font-mono font-bold text-[var(--color-ink)]"
                                            placeholder="18:00"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Step 2: Real Menu Selection */}
                            <div className="p-3.5 bg-[var(--color-paper)] border border-[var(--color-rule)] space-y-3">
                                <div className="flex items-center justify-between border-b border-[var(--color-rule)] pb-2">
                                    <span className="text-[10px] font-bold text-[var(--color-neutral)] uppercase tracking-wider">
                                        ขั้นตอนที่ 2 / รายการอาหารจริงที่สั่งล่วงหน้า (Real Menu Items)
                                    </span>
                                    <span className="text-xs font-bold text-[var(--color-ink)] font-mono">
                                        ยอดรวมค่าอาหาร: ฿{dineInTotal.toLocaleString()}
                                    </span>
                                </div>

                                {/* Active Selected Items list */}
                                <div className="space-y-1.5">
                                    {dineInSelectedItems.map(item => (
                                        <div key={item.id} className="flex items-center justify-between p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)]">
                                            <div>
                                                <span className="font-bold text-[var(--color-ink)] text-xs block">{item.name}</span>
                                                <span className="text-[10px] text-[var(--color-neutral)]">ราคาจานละ ฿{item.price.toLocaleString()}</span>
                                            </div>
                                            <div className="flex items-center gap-2 font-mono">
                                                <div className="flex items-center border border-[var(--color-rule)] bg-[var(--color-paper)]">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateDineInItemQty(item.id, -1)}
                                                        className="px-2 py-0.5 hover:bg-[var(--color-paper-2)] text-[var(--color-ink)] font-bold cursor-pointer"
                                                    >
                                                        -
                                                    </button>
                                                    <span className="px-2 py-0.5 font-bold">{item.quantity}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateDineInItemQty(item.id, 1)}
                                                        className="px-2 py-0.5 hover:bg-[var(--color-paper-2)] text-[var(--color-ink)] font-bold cursor-pointer"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                                <span className="w-16 text-right font-bold text-[var(--color-ink)]">
                                                    ฿{(item.price * item.quantity).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Quick Menu Picker */}
                                <div>
                                    <span className="text-[10px] font-bold text-[var(--color-neutral)] uppercase block mb-1.5">
                                        + เพิ่มเมนูจริงจากร้านค้า (Quick Add from Store Menu):
                                    </span>
                                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)]">
                                        {loadingMenu && <span className="text-[10px] text-[var(--color-neutral)]">กำลังโหลดเมนู...</span>}
                                        {menuItems.slice(0, 15).map(m => (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => handleAddDineInItem(m)}
                                                className="px-2 py-1 bg-[var(--color-paper)] border border-[var(--color-rule)] hover:border-[var(--color-ink)] text-[11px] text-[var(--color-ink)] font-medium transition-colors cursor-pointer flex items-center gap-1"
                                            >
                                                <span>+ {m.name}</span>
                                                <span className="font-bold font-mono text-[10px] text-[var(--color-neutral)]">฿{Number(m.price || 0)}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Step 3: Real Deposit Ratio Calculation */}
                            <div className="p-3.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] space-y-3">
                                <div className="flex items-center justify-between border-b border-[var(--color-rule)] pb-2">
                                    <span className="text-[10px] font-bold text-[var(--color-neutral)] uppercase tracking-wider">
                                        ขั้นตอนที่ 3 / คำนวณยอดเงินมัดจำจริง (Deposit Calculation)
                                    </span>
                                    <span className="text-[10px] font-mono text-[var(--color-accent)] font-bold">
                                        POS DEDUCTION FORMULA
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setDineInDepositMode('half')}
                                        className={`p-2.5 text-center border font-bold text-xs uppercase transition-colors cursor-pointer ${
                                            dineInDepositMode === 'half'
                                                ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)]'
                                                : 'bg-[var(--color-paper)] text-[var(--color-ink)] border-[var(--color-rule)] hover:bg-[var(--color-paper-2)]'
                                        }`}
                                    >
                                        <div className="text-[10px] opacity-75">ค่ามาตรฐาน 50%</div>
                                        <div className="text-sm font-mono mt-0.5">฿{Math.ceil(dineInTotal * 0.5).toLocaleString()}</div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setDineInDepositMode('full')}
                                        className={`p-2.5 text-center border font-bold text-xs uppercase transition-colors cursor-pointer ${
                                            dineInDepositMode === 'full'
                                                ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)]'
                                                : 'bg-[var(--color-paper)] text-[var(--color-ink)] border-[var(--color-rule)] hover:bg-[var(--color-paper-2)]'
                                        }`}
                                    >
                                        <div className="text-[10px] opacity-75">จ่ายครบ 100%</div>
                                        <div className="text-sm font-mono mt-0.5">฿{dineInTotal.toLocaleString()}</div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDineInDepositMode('custom');
                                            if (!dineInCustomDeposit) setDineInCustomDeposit(String(Math.ceil(dineInTotal * 0.3)));
                                        }}
                                        className={`p-2.5 text-center border font-bold text-xs uppercase transition-colors cursor-pointer ${
                                            dineInDepositMode === 'custom'
                                                ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)]'
                                                : 'bg-[var(--color-paper)] text-[var(--color-ink)] border-[var(--color-rule)] hover:bg-[var(--color-paper-2)]'
                                        }`}
                                    >
                                        <div className="text-[10px] opacity-75">กำหนดยอดเอง</div>
                                        <div className="text-sm font-mono mt-0.5">฿{dineInDeposit.toLocaleString()}</div>
                                    </button>
                                </div>

                                {dineInDepositMode === 'custom' && (
                                    <div className="flex items-center gap-2 pt-1">
                                        <label className="text-[11px] font-bold text-[var(--color-ink)]">
                                            ระบุยอดเงินมัดจำ (฿):
                                        </label>
                                        <input
                                            type="number"
                                            value={dineInCustomDeposit}
                                            onChange={(e) => setDineInCustomDeposit(e.target.value)}
                                            className="w-32 p-1.5 bg-[var(--color-paper)] border border-[var(--color-rule)] font-mono font-bold text-xs text-[var(--color-ink)]"
                                        />
                                    </div>
                                )}

                                {/* Bill Simulation Preview Box */}
                                <div className="p-3 bg-[var(--color-paper)] border border-[var(--color-rule)] font-mono text-xs space-y-1">
                                    <div className="text-[10px] text-[var(--color-neutral)] uppercase font-bold mb-1">
                                        การแสดงผลลัพธ์ในบิล POS เมื่อเปิดโต๊ะนี้:
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[var(--color-neutral)]">ค่าอาหารรวม (SUBTOTAL):</span>
                                        <span className="font-bold text-[var(--color-ink)]">฿{dineInTotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-[var(--color-accent)] font-bold">
                                        <span>DEPOSIT PAID (หักมัดจำล่วงหน้า):</span>
                                        <span>-฿{dineInDeposit.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-dashed border-[var(--color-rule)] pt-1 text-sm font-bold text-[var(--color-ink)]">
                                        <span>NET REMAINING (ยอดคงเหลือเก็บที่ POS):</span>
                                        <span>฿{dineInRemainingDue.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Step 4: Customer Details & Mock Slip Badge */}
                            <div className="p-3.5 bg-[var(--color-paper)] border border-[var(--color-rule)] grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-[var(--color-neutral)] uppercase block mb-1">
                                        ชื่อผู้จอง (Customer Name)
                                    </label>
                                    <input
                                        type="text"
                                        value={dineInCustomerName}
                                        onChange={(e) => setDineInCustomerName(e.target.value)}
                                        className="w-full p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-mono font-bold"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-[var(--color-neutral)] uppercase block mb-1">
                                        เบอร์โทรติดต่อ (Phone)
                                    </label>
                                    <input
                                        type="text"
                                        value={dineInCustomerPhone}
                                        onChange={(e) => setDineInCustomerPhone(e.target.value)}
                                        className="w-full p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-mono font-bold"
                                    />
                                </div>

                                <div className="sm:col-span-2 p-2.5 bg-[oklch(95%_0.02_140)] border border-[var(--color-accent-2)]/40 flex items-center justify-between text-[11px] text-[oklch(25%_0.06_140)]">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-[var(--color-accent-2)]" />
                                        <span>สลิปมัดจำจะถูกตั้งเป็น <strong>AUTO_VERIFIED (จำลองตรวจผ่านอัตโนมัติ)</strong> โดยไม่ต้องโอนเงินจริง</span>
                                    </div>
                                    <span className="font-bold font-mono">฿0.00 COST</span>
                                </div>
                            </div>

                            {/* Action Button */}
                            <div className="pt-2 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={handleSubmitDineInTest}
                                    disabled={isSubmitting}
                                    className="w-full sm:w-auto px-6 py-3 bg-[var(--color-ink)] hover:opacity-90 text-[var(--color-paper)] font-bold text-xs uppercase transition-opacity flex items-center justify-center gap-2 cursor-pointer border border-[var(--color-ink)] shadow-sm"
                                >
                                    <span>{isSubmitting ? 'กำลังบันทึกข้อมูล...' : '⚡ บันทึกการจองและส่งเข้า POS ทันที'}</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ==================================================== */}
                    {/* TAB 2: PICK-UP ORDER TEST                            */}
                    {/* ==================================================== */}
                    {activeTab === 'pickup' && (
                        <div className="space-y-4">
                            {/* Step 1: Real Takeaway Items Selection */}
                            <div className="p-3.5 bg-[var(--color-paper)] border border-[var(--color-rule)] space-y-3">
                                <div className="flex items-center justify-between border-b border-[var(--color-rule)] pb-2">
                                    <span className="text-[10px] font-bold text-[var(--color-neutral)] uppercase tracking-wider">
                                        ขั้นตอนที่ 1 / รายการอาหารสั่งกลับ (Takeaway Items)
                                    </span>
                                    <span className="text-xs font-bold text-[var(--color-ink)] font-mono">
                                        ยอดรวมสุทธิ: ฿{pickupTotal.toLocaleString()}
                                    </span>
                                </div>

                                <div className="space-y-1.5">
                                    {pickupSelectedItems.map(item => (
                                        <div key={item.id} className="flex items-center justify-between p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)]">
                                            <div>
                                                <span className="font-bold text-[var(--color-ink)] text-xs block">{item.name}</span>
                                                <span className="text-[10px] text-[var(--color-neutral)]">ราคาจานละ ฿{item.price.toLocaleString()}</span>
                                            </div>
                                            <div className="flex items-center gap-2 font-mono">
                                                <div className="flex items-center border border-[var(--color-rule)] bg-[var(--color-paper)]">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdatePickupItemQty(item.id, -1)}
                                                        className="px-2 py-0.5 hover:bg-[var(--color-paper-2)] text-[var(--color-ink)] font-bold cursor-pointer"
                                                    >
                                                        -
                                                    </button>
                                                    <span className="px-2 py-0.5 font-bold">{item.quantity}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdatePickupItemQty(item.id, 1)}
                                                        className="px-2 py-0.5 hover:bg-[var(--color-paper-2)] text-[var(--color-ink)] font-bold cursor-pointer"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                                <span className="w-16 text-right font-bold text-[var(--color-ink)]">
                                                    ฿{(item.price * item.quantity).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div>
                                    <span className="text-[10px] font-bold text-[var(--color-neutral)] uppercase block mb-1.5">
                                        + เพิ่มเมนูจริงจากร้านค้า (Quick Add):
                                    </span>
                                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)]">
                                        {menuItems.slice(0, 15).map(m => (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => handleAddPickupItem(m)}
                                                className="px-2 py-1 bg-[var(--color-paper)] border border-[var(--color-rule)] hover:border-[var(--color-ink)] text-[11px] text-[var(--color-ink)] font-medium transition-colors cursor-pointer flex items-center gap-1"
                                            >
                                                <span>+ {m.name}</span>
                                                <span className="font-bold font-mono text-[10px] text-[var(--color-neutral)]">฿{Number(m.price || 0)}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Step 2: Pickup Timing & Status */}
                            <div className="p-3.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] space-y-3">
                                <div className="flex items-center justify-between border-b border-[var(--color-rule)] pb-2">
                                    <span className="text-[10px] font-bold text-[var(--color-neutral)] uppercase tracking-wider">
                                        ขั้นตอนที่ 2 / กำหนดเวลารับสินค้า และสถานะการชำระเงิน
                                    </span>
                                    <span className="text-[10px] font-mono text-[var(--color-accent-2)] font-bold">
                                        100% PAID STATUS
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPickupTimeOffset(15)}
                                        className={`p-2 text-center border font-bold text-xs uppercase cursor-pointer ${
                                            pickupTimeOffset === 15 ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' : 'bg-[var(--color-paper)] text-[var(--color-ink)]'
                                        }`}
                                    >
                                        อีก 15 นาที
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPickupTimeOffset(30)}
                                        className={`p-2 text-center border font-bold text-xs uppercase cursor-pointer ${
                                            pickupTimeOffset === 30 ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' : 'bg-[var(--color-paper)] text-[var(--color-ink)]'
                                        }`}
                                    >
                                        อีก 30 นาที
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPickupTimeOffset(60)}
                                        className={`p-2 text-center border font-bold text-xs uppercase cursor-pointer ${
                                            pickupTimeOffset === 60 ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' : 'bg-[var(--color-paper)] text-[var(--color-ink)]'
                                        }`}
                                    >
                                        อีก 1 ชั่วโมง
                                    </button>
                                </div>

                                <div className="p-3 bg-[var(--color-paper)] border border-[var(--color-rule)] font-mono text-xs space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-[var(--color-neutral)]">ยอดชำระออนไลน์ 100%:</span>
                                        <span className="font-bold text-[var(--color-ink)]">฿{pickupTotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-[var(--color-accent-2)] font-bold">
                                        <span>สถานะการจ่ายเงินที่ POS:</span>
                                        <span>[ PAID ] (ชำระเต็มจำนวนแล้ว)</span>
                                    </div>
                                    <div className="text-[10px] text-[var(--color-neutral)] pt-1">
                                        • เมื่อออเดอร์เข้า POS หน้าร้าน แคชเชียร์สามารถกดพิมพ์สลิปส่งครัวหรือส่งมอบได้ทันทีโดยไม่ต้องเก็บเงินเพิ่ม
                                    </div>
                                </div>
                            </div>

                            {/* Step 3: Customer Information */}
                            <div className="p-3.5 bg-[var(--color-paper)] border border-[var(--color-rule)] grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-[var(--color-neutral)] uppercase block mb-1">
                                        ชื่อผู้รับสินค้า (Customer Name)
                                    </label>
                                    <input
                                        type="text"
                                        value={pickupCustomerName}
                                        onChange={(e) => setPickupCustomerName(e.target.value)}
                                        className="w-full p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-mono font-bold"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-[var(--color-neutral)] uppercase block mb-1">
                                        เบอร์โทรติดต่อ (Phone)
                                    </label>
                                    <input
                                        type="text"
                                        value={pickupCustomerPhone}
                                        onChange={(e) => setPickupCustomerPhone(e.target.value)}
                                        className="w-full p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-mono font-bold"
                                    />
                                </div>
                            </div>

                            {/* Action Button */}
                            <div className="pt-2 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={handleSubmitPickupTest}
                                    disabled={isSubmitting}
                                    className="w-full sm:w-auto px-6 py-3 bg-[var(--color-ink)] hover:opacity-90 text-[var(--color-paper)] font-bold text-xs uppercase transition-opacity flex items-center justify-center gap-2 cursor-pointer border border-[var(--color-ink)] shadow-sm"
                                >
                                    <span>{isSubmitting ? 'กำลังบันทึกข้อมูล...' : '⚡ บันทึกออเดอร์ Pick-up ส่งเข้า POS'}</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ==================================================== */}
                    {/* TAB 3: TEST RECORDS & PURGE                          */}
                    {/* ==================================================== */}
                    {activeTab === 'purge' && (
                        <div className="space-y-4">
                            <div className="p-3.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <h4 className="text-xs font-bold uppercase text-[var(--color-ink)]">
                                        รายการทดสอบในระบบ ({testRecords.length} รายการ)
                                    </h4>
                                    <p className="text-[11px] text-[var(--color-neutral)] font-sans">
                                        แสดงเฉพาะออเดอร์และรายการจองที่มีแท็กทดสอบ [TEST_ เพื่อให้สามารถล้างข้อมูลออกได้โดยไม่กระทบยอดขายจริง
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={fetchTestRecords}
                                        disabled={loadingRecords}
                                        className="px-3 py-1.5 bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] font-bold text-xs uppercase hover:bg-[var(--color-paper-2)] cursor-pointer"
                                    >
                                        {loadingRecords ? 'โหลด...' : 'รีเฟรช'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handlePurgeAllTests}
                                        disabled={isPurging || testRecords.length === 0}
                                        className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        {isPurging ? 'กำลังล้าง...' : '🗑️ ล้างรายการทดสอบทั้งหมด'}
                                    </button>
                                </div>
                            </div>

                            {/* Table of Test Records */}
                            <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] overflow-x-auto">
                                <table className="w-full text-left font-mono text-[11px]">
                                    <thead className="bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] text-[10px] text-[var(--color-neutral)] uppercase select-none">
                                        <tr>
                                            <th className="p-2">ID</th>
                                            <th className="p-2">ประเภท</th>
                                            <th className="p-2">โต๊ะ</th>
                                            <th className="p-2">ลูกค้า</th>
                                            <th className="p-2 text-right">ยอดรวม</th>
                                            <th className="p-2 text-right">มัดจำ</th>
                                            <th className="p-2">สถานะ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--color-rule)]">
                                        {testRecords.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="p-6 text-center text-[var(--color-neutral)]">
                                                    {loadingRecords ? 'กำลังโหลดรายการทดสอบ...' : 'ไม่พบข้อมูลการทดสอบในระบบ (ฐานข้อมูลสะอาด)'}
                                                </td>
                                            </tr>
                                        ) : (
                                            testRecords.map(rec => (
                                                <tr key={rec.id} className="hover:bg-[var(--color-paper-2)]">
                                                    <td className="p-2 font-bold text-[var(--color-ink)]">
                                                        #{rec.id.slice(0, 6)}
                                                    </td>
                                                    <td className="p-2">
                                                        <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase border ${
                                                            rec.booking_type === 'dine_in'
                                                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                                                : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                                        }`}>
                                                            {rec.booking_type === 'dine_in' ? 'จองโต๊ะ' : 'รับกลับ'}
                                                        </span>
                                                    </td>
                                                    <td className="p-2 text-[var(--color-ink)] font-bold">
                                                        {rec.tables_layout?.table_name || '—'}
                                                    </td>
                                                    <td className="p-2 text-[var(--color-ink)] truncate max-w-[120px]">
                                                        {rec.pickup_contact_name || '—'}
                                                    </td>
                                                    <td className="p-2 text-right font-bold text-[var(--color-ink)]">
                                                        ฿{Number(rec.total_amount || 0).toLocaleString()}
                                                    </td>
                                                    <td className="p-2 text-right font-bold text-[var(--color-accent)]">
                                                        ฿{Number(rec.deposit_amount || 0).toLocaleString()}
                                                    </td>
                                                    <td className="p-2">
                                                        <span className="text-[10px] text-[var(--color-accent-2)] font-bold">
                                                            {rec.status.toUpperCase()}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* 4. Modal Footer Bar */}
                <div className="p-3 border-t border-[var(--color-rule)] bg-[var(--color-paper-2)] flex items-center justify-between text-[11px] text-[var(--color-neutral)] select-none">
                    <span className="font-mono">
                        STATUS: ACTIVE · ENGINE: POS D2S PLUS / CLOUD SYNC
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1 bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] font-bold text-xs uppercase hover:bg-[var(--color-ink)] hover:text-[var(--color-paper)] transition-colors cursor-pointer"
                    >
                        ปิดหน้าต่าง
                    </button>
                </div>
            </div>
        </div>
    );
}
