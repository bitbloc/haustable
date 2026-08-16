import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Trash2, AlertTriangle, ShieldCheck, RefreshCw, CheckCircle2, Lock, Sparkles, Database, HelpCircle, Layers } from 'lucide-react';

const REQUIRED_PASSCODE = '1500323553';

export default function DataPurgePanel() {
    const [counts, setCounts] = useState({
        orders: 0,
        order_items: 0,
        shifts: 0,
        stock_transactions: 0,
        tax_invoices: 0,
        withholding_tax: 0,
        store_expenses: 0,
        audit_logs: 0,
        payment_slips: 0,
        song_requests: 0,
        arcade_logs: 0,
        leaderboard: 0,
        checkins: 0,
        protected_profiles: 0,
        protected_menu_items: 0,
        protected_stock_items: 0
    });

    const [loadingCounts, setLoadingCounts] = useState(false);
    const [activeModal, setActiveModal] = useState(null); // category object or null
    const [inputPasscode, setInputPasscode] = useState('');
    const [resetStockQty, setResetStockQty] = useState(false);
    const [isPurging, setIsPurging] = useState(false);
    const [toastMessage, setToastMessage] = useState(null);

    // Show temporary toast notification
    const showToast = (message, type = 'success') => {
        setToastMessage({ message, type });
        setTimeout(() => setToastMessage(null), 4500);
    };

    // Fetch live record counts
    const fetchRecordCounts = useCallback(async () => {
        setLoadingCounts(true);
        try {
            // Try RPC first
            const { data, error } = await supabase.rpc('get_system_record_counts');
            if (!error && data) {
                setCounts(data);
            } else {
                // Client-side fallback count queries
                const [
                    { count: ordersCnt },
                    { count: orderItemsCnt },
                    { count: shiftsCnt },
                    { count: stockTxCnt },
                    { count: taxInvoicesCnt },
                    { count: whtCnt },
                    { count: expensesCnt },
                    { count: auditLogsCnt },
                    { count: slipsCnt },
                    { count: songsCnt },
                    { count: arcadeCnt },
                    { count: leaderboardCnt },
                    { count: checkinsCnt },
                    { count: profilesCnt },
                    { count: menuCnt },
                    { count: stockItemsCnt }
                ] = await Promise.all([
                    supabase.from('bookings').select('*', { count: 'exact', head: true }),
                    supabase.from('order_items').select('*', { count: 'exact', head: true }),
                    supabase.from('pos_shifts').select('*', { count: 'exact', head: true }),
                    supabase.from('stock_transactions').select('*', { count: 'exact', head: true }),
                    supabase.from('tax_invoices').select('*', { count: 'exact', head: true }),
                    supabase.from('withholding_tax_records').select('*', { count: 'exact', head: true }),
                    supabase.from('store_expenses').select('*', { count: 'exact', head: true }),
                    supabase.from('pos_audit_logs').select('*', { count: 'exact', head: true }),
                    supabase.from('payment_slips_registry').select('*', { count: 'exact', head: true }),
                    supabase.from('song_requests').select('*', { count: 'exact', head: true }),
                    supabase.from('arcade_rewards_log').select('*', { count: 'exact', head: true }),
                    supabase.from('leaderboard').select('*', { count: 'exact', head: true }),
                    supabase.from('haus_checkins').select('*', { count: 'exact', head: true }),
                    supabase.from('profiles').select('*', { count: 'exact', head: true }),
                    supabase.from('menu_items').select('*', { count: 'exact', head: true }),
                    supabase.from('stock_items').select('*', { count: 'exact', head: true })
                ]);

                setCounts({
                    orders: ordersCnt || 0,
                    order_items: orderItemsCnt || 0,
                    shifts: shiftsCnt || 0,
                    stock_transactions: stockTxCnt || 0,
                    tax_invoices: taxInvoicesCnt || 0,
                    withholding_tax: whtCnt || 0,
                    store_expenses: expensesCnt || 0,
                    audit_logs: auditLogsCnt || 0,
                    payment_slips: slipsCnt || 0,
                    song_requests: songsCnt || 0,
                    arcade_logs: arcadeCnt || 0,
                    leaderboard: leaderboardCnt || 0,
                    checkins: checkinsCnt || 0,
                    protected_profiles: profilesCnt || 0,
                    protected_menu_items: menuCnt || 0,
                    protected_stock_items: stockItemsCnt || 0
                });
            }
        } catch (err) {
            console.error('Failed to fetch counts:', err);
        } finally {
            setLoadingCounts(false);
        }
    }, []);

    useEffect(() => {
        fetchRecordCounts();
    }, [fetchRecordCounts]);

    // Categories Configuration
    const PURGE_CATEGORIES = [
        {
            id: 'orders',
            title: '1. ออเดอร์ & บิลขาย (Orders & Billing)',
            subtitle: 'ล้างประวัติการสั่งอาหาร, บิลโต๊ะ, บิล Takeaway และเคลียร์สถานะโต๊ะทั้งหมด',
            dangerLevel: 'high',
            tables: ['order_items', 'bookings', 'tax_invoices', 'withholding_tax_records', 'payment_slips_registry'],
            recordsCount: (counts.orders || 0) + (counts.order_items || 0),
            recordsBreakdown: `${counts.orders || 0} บิล / ${counts.order_items || 0} รายการอาหาร`,
            badge: 'Transactional',
            confirmTitle: 'ยืนยันการล้างข้อมูลออเดอร์และบิลขายทั้งหมด',
            warningNotes: 'รายการอาหารในบิลและสถานะโต๊ะที่ถูกเปิดใช้งานจะถูกรีเซ็ตให้ว่างทั้งหมด'
        },
        {
            id: 'shifts',
            title: '2. กะการเงิน POS (POS Shifts & Audit Logs)',
            subtitle: 'ล้างประวัติการเปิด-ปิดกะ เงินสดยกมา/ส่งมอบ และ Audit logs ทั้งหมด',
            dangerLevel: 'medium',
            tables: ['pos_shifts', 'pos_audit_logs'],
            recordsCount: (counts.shifts || 0) + (counts.audit_logs || 0),
            recordsBreakdown: `${counts.shifts || 0} กะการเงิน / ${counts.audit_logs || 0} Audit logs`,
            badge: 'Cashier Log',
            confirmTitle: 'ยืนยันการล้างประวัติกะการเงิน POS',
            warningNotes: 'ประวัติการส่งยอดเงินสดและการบันทึกกะก่อนหน้านี้จะถูกลบทั้งหมด'
        },
        {
            id: 'stock',
            title: '3. ประวัติความเคลื่อนไหวสต็อก (Stock Movement)',
            subtitle: 'ล้างประวัติการรับเข้า/เบิกออก/ตัดสต็อกทดสอบ (มีตัวเลือกให้รีเซ็ตจำนวนคงเหลือเป็น 0)',
            dangerLevel: 'medium',
            tables: ['stock_transactions'],
            recordsCount: counts.stock_transactions || 0,
            recordsBreakdown: `${counts.stock_transactions || 0} รายการตัด/ปรับสต็อก`,
            badge: 'Inventory History',
            confirmTitle: 'ยืนยันการล้างประวัติการเคลื่อนไหวสต็อก',
            warningNotes: 'ประวัติ Log การปรับสต็อกจะถูกลบ โดยรายการสินค้าในคลังหลักยังคงอยู่',
            hasStockZeroOption: true
        },
        {
            id: 'tax_expenses',
            title: '4. ภาษี & บันทึกรายจ่ายร้าน (Tax & Expenses)',
            subtitle: 'ล้างใบกำกับภาษีทดสอบ และประวัติการสแกนบิลค่าใช้จ่าย (Makro ฯลฯ)',
            dangerLevel: 'medium',
            tables: ['tax_invoices', 'withholding_tax_records', 'store_expenses'],
            recordsCount: (counts.tax_invoices || 0) + (counts.withholding_tax || 0) + (counts.store_expenses || 0),
            recordsBreakdown: `${counts.tax_invoices || 0} ใบกำกับภาษี / ${counts.store_expenses || 0} บิลรายจ่าย`,
            badge: 'Tax & Accounting',
            confirmTitle: 'ยืนยันการล้างข้อมูลภาษีและรายจ่ายร้านทดสอบ',
            warningNotes: 'ใบกำกับภาษีและรายการบันทึกค่าใช้จ่ายทั้งหมดจะถูกล้าง'
        },
        {
            id: 'activities',
            title: '5. กิจกรรม & บันเทิง (Entertainment & Logs)',
            subtitle: 'ล้างประวัติขอเพลง, คะแนน Leaderboard, บันทึกแลกของรางวัล Arcade, เช็คอิน',
            dangerLevel: 'low',
            tables: ['song_requests', 'leaderboard', 'arcade_rewards_log', 'haus_checkins'],
            recordsCount: (counts.song_requests || 0) + (counts.leaderboard || 0) + (counts.arcade_logs || 0) + (counts.checkins || 0),
            recordsBreakdown: `${counts.song_requests || 0} ขอเพลง / ${counts.leaderboard || 0} เกม / ${counts.checkins || 0} เช็คอิน`,
            badge: 'Entertainment',
            confirmTitle: 'ยืนยันการล้างกิจกรรมและบันทึกบันเทิง',
            warningNotes: 'ประวัติการขอเพลงและอันดับคะแนนเกมจะถูกรีเซ็ตใหม่'
        },
        {
            id: 'crm_balances',
            title: '6. รีเซ็ตแต้ม/สแตมป์สมาชิก CRM (Reset Balances Only)',
            subtitle: 'รีเซ็ตแต้มสะสม xHaus เป็น Welcome Bonus (10.00) และแสตมป์เป็น 0 (ไม่ลบรายชื่อลูกค้า)',
            dangerLevel: 'medium',
            tables: ['profiles (เฉพาะคอลัมน์แต้ม/สแตมป์)'],
            recordsCount: counts.protected_profiles || 0,
            recordsBreakdown: `สมาชิกลูกค้าทั้งหมด ${counts.protected_profiles || 0} บัญชี`,
            badge: 'CRM Balances',
            confirmTitle: 'ยืนยันการรีเซ็ตแต้มสะสมและสแตมป์สมาชิก',
            warningNotes: 'รายชื่อลูกค้า, เบอร์โทร, LINE ID และวันเกิดจะยังอยู่ครบ 100% มีเพียงตัวเลขแต้มที่จะถูกรีเซ็ตเป็นค่าเริ่มต้น',
            isCrmSafe: true
        }
    ];

    // Execute Data Purge
    const handleExecutePurge = async () => {
        if (inputPasscode.trim() !== REQUIRED_PASSCODE) {
            showToast('❌ รหัสความปลอดภัยไม่ถูกต้อง กรุณาตรวจสอบรหัส 10 หลัก', 'error');
            return;
        }

        if (!activeModal) return;
        setIsPurging(true);

        try {
            // Attempt Supabase RPC execution
            const { data, error } = await supabase.rpc('purge_system_data', {
                p_category: activeModal.id,
                p_passcode: inputPasscode.trim(),
                p_reset_stock_qty: resetStockQty
            });

            if (error) {
                // If RPC fails (e.g. not created yet in SQL editor), perform fallback deletion
                console.warn('RPC execution returned error, attempting direct fallback operations:', error);
                await executeDirectFallback(activeModal.id, resetStockQty);
            }

            showToast(`✅ ล้างข้อมูลหมวด "${activeModal.title}" เรียบร้อยแล้ว!`, 'success');
            setActiveModal(null);
            setInputPasscode('');
            setResetStockQty(false);
            await fetchRecordCounts();
        } catch (err) {
            console.error('Purge error:', err);
            showToast(`❌ เกิดข้อผิดพลาด: ${err.message || err}`, 'error');
        } finally {
            setIsPurging(false);
        }
    };

    // Client-side fallback deletion
    const executeDirectFallback = async (categoryId, shouldResetStock) => {
        if (categoryId === 'orders' || categoryId === 'all_operational') {
            await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('tax_invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('withholding_tax_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('payment_slips_registry').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('bookings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('tables_layout').update({ status: 'available' }).neq('id', '00000000-0000-0000-0000-000000000000');
        }
        if (categoryId === 'shifts' || categoryId === 'all_operational') {
            await supabase.from('pos_audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('pos_shifts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        }
        if (categoryId === 'stock' || categoryId === 'all_operational') {
            await supabase.from('stock_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (shouldResetStock) {
                await supabase.from('stock_items').update({ current_quantity: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');
            }
        }
        if (categoryId === 'tax_expenses' || categoryId === 'all_operational') {
            await supabase.from('tax_invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('withholding_tax_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('store_expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        }
        if (categoryId === 'activities' || categoryId === 'all_operational') {
            await supabase.from('song_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('leaderboard').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('arcade_rewards_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('haus_checkins').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        }
        if (categoryId === 'crm_balances') {
            await supabase.from('profiles').update({
                xhaus_balance: 10.00,
                total_earned_xhaus: 10.00,
                total_redeemed_xhaus: 0.00,
                drink_stamp_count: 0,
                free_drink_quota: 0,
                total_drinks_purchased: 0,
                current_tier: 'Haus Common'
            }).neq('id', '00000000-0000-0000-0000-000000000000');
        }
    };

    return (
        <div className="space-y-6 animate-fade-in text-[oklch(18%_0.012_28)]">
            {/* Notification Toast */}
            {toastMessage && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-bold flex items-center gap-2 animate-bounce-short ${
                    toastMessage.type === 'error'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}>
                    {toastMessage.message}
                </div>
            )}

            {/* Header Banner - Dieter Rams / Thai Modern Industrial Style */}
            <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-6 rounded-2xl shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="bg-[oklch(18%_0.012_28)] text-white text-[10px] font-mono px-2 py-0.5 rounded tracking-wider uppercase font-bold">
                                SYSTEM UTILITY
                            </span>
                            <span className="text-[10px] font-mono text-[oklch(55%_0.010_28)] font-bold">
                                GO-LIVE DATA PURGE
                            </span>
                        </div>
                        <h2 className="text-xl font-bold text-[oklch(18%_0.012_28)] mt-1 tracking-tight">
                            ระบบล้างข้อมูลทดสอบก่อนเปิดร้านจริง (Go-Live System Reset)
                        </h2>
                        <p className="text-xs text-[oklch(42%_0.010_28)] mt-1 max-w-2xl leading-relaxed">
                            เลือกล้างข้อมูลการทดสอบระบบแยกตามหมวดหมู่ได้อย่างอิสระ มีระบบป้องกันความปลอดภัยโดยต้องกรอกรหัสยืนยัน <strong className="text-[oklch(18%_0.012_28)] font-mono">1500323553</strong> ก่อนดำเนินการ
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={fetchRecordCounts}
                        disabled={loadingCounts}
                        className="self-start md:self-auto flex items-center gap-2 bg-white border border-[oklch(85%_0.012_28)] hover:bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={loadingCounts ? 'animate-spin' : ''} />
                        รีเฟรชยอดข้อมูล
                    </button>
                </div>

                {/* Safe CRM Guarantee Banner */}
                <div className="mt-5 bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-4 flex items-start gap-3">
                    <div className="p-2 bg-emerald-600 text-white rounded-lg shrink-0 mt-0.5">
                        <ShieldCheck size={18} strokeWidth={2.2} />
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                            การันตีความปลอดภัย: ข้อมูลลูกค้าและสมาชิกระบบ CRM ปลอดภัย 100%
                        </h4>
                        <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                            ระบบนี้ถูกออกแบบมาเพื่อล้างเฉพาะข้อมูลการทำรายการทดสอบ (บิล, รายการสั่ง, กะ, ประวัติสต็อก, ภาษี) 
                            โดย <strong className="font-bold">รายชื่อลูกค้า, เบอร์โทรศัพท์, LINE User ID, วันเกิด, ผังโต๊ะ, เมนูอาหาร และสูตร SOP ทั้งหมดจะไม่ถูกลบเด็ดขาด</strong>
                        </p>
                    </div>
                </div>
            </div>

            {/* Master All-In-One Purge CTA */}
            <div className="bg-[#1A1A1A] text-white p-6 rounded-2xl border border-black shadow-md flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="space-y-1 max-w-2xl">
                    <div className="inline-flex items-center gap-1.5 bg-[#E9F344] text-[#1A1A1A] px-2.5 py-0.5 rounded text-[10px] font-mono font-black uppercase tracking-wider">
                        ⚡ ALL-IN-ONE GO-LIVE RESET
                    </div>
                    <h3 className="text-base font-bold text-white tracking-tight">
                        ล้างข้อมูลทดสอบทั้งหมดพร้อมกัน (Wipe All Operational Test Data)
                    </h3>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                        ล้างข้อมูลออเดอร์, บิลขาย, กะการเงิน, ประวัติสต็อก, ภาษี และบันทึกกิจกรรมทั้งหมดในคลิกเดียว เพื่อเตรียมเปิดร้านจริงวันที่ 1 โดยยังคงข้อมูลลูกค้า CRM, เมนูอาหาร และผังโต๊ะไว้ครบถ้วน
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setActiveModal({
                        id: 'all_operational',
                        title: 'ล้างข้อมูลทดสอบการทำงานทั้งหมด (All Operational Test Data)',
                        subtitle: 'ล้างออเดอร์, บิล, กะการเงิน, ประวัติสต็อก, ภาษี, และกิจกรรมเสริมทั้งหมดพร้อมกัน',
                        dangerLevel: 'critical',
                        tables: ['order_items', 'bookings', 'pos_shifts', 'pos_audit_logs', 'stock_transactions', 'tax_invoices', 'withholding_tax_records', 'store_expenses', 'payment_slips_registry', 'song_requests', 'leaderboard', 'arcade_rewards_log', 'haus_checkins'],
                        recordsCount: (counts.orders || 0) + (counts.shifts || 0) + (counts.stock_transactions || 0) + (counts.tax_invoices || 0),
                        confirmTitle: 'ยืนยันการล้างข้อมูลทดสอบทั้งหมดในระบบ',
                        warningNotes: 'การดำเนินการนี้จะลบข้อมูลธุรกรรมการทดสอบทั้งหมด แต่จะเก็บรายชื่อลูกค้า CRM เมนู และการตั้งค่าร้านไว้ 100%',
                        hasStockZeroOption: true
                    })}
                    className="shrink-0 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs px-6 py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer border border-red-500"
                >
                    <Trash2 size={16} />
                    ล้างข้อมูลทดสอบทั้งหมด
                </button>
            </div>

            {/* Categorized Purge Grid (6 Modular Categories) */}
            <div className="grid md:grid-cols-2 gap-4">
                {PURGE_CATEGORIES.map((cat) => {
                    const isHighDanger = cat.dangerLevel === 'high';
                    return (
                        <div
                            key={cat.id}
                            className="bg-white border border-[oklch(85%_0.012_28)] hover:border-[oklch(55%_0.010_28)] p-5 rounded-2xl shadow-sm transition-all flex flex-col justify-between"
                        >
                            <div className="space-y-3">
                                <div className="flex items-center justify-between gap-2 border-b border-[oklch(94%_0.010_28)] pb-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)]">
                                            {cat.badge}
                                        </span>
                                        <span className="text-xs font-bold text-[oklch(18%_0.012_28)] truncate">
                                            {cat.title}
                                        </span>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-800 border border-zinc-200">
                                            {cat.recordsCount} รายการ
                                        </span>
                                    </div>
                                </div>

                                <p className="text-xs text-[oklch(42%_0.010_28)] leading-relaxed">
                                    {cat.subtitle}
                                </p>

                                <div className="bg-[oklch(97%_0.008_28)] rounded-lg p-2.5 text-[11px] font-mono text-[oklch(42%_0.010_28)] border border-[oklch(90%_0.010_28)]">
                                    <div className="font-bold text-[10px] text-[oklch(55%_0.010_28)] uppercase tracking-wider mb-1">
                                        ขอบเขตข้อมูลในระบบ:
                                    </div>
                                    <div className="text-[oklch(18%_0.012_28)] font-sans text-xs">
                                        {cat.recordsBreakdown}
                                    </div>
                                    <div className="text-[10px] text-[oklch(55%_0.010_28)] mt-1 truncate">
                                        ตาราง: {cat.tables.join(', ')}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-[oklch(94%_0.010_28)] flex items-center justify-between">
                                {cat.isCrmSafe ? (
                                    <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                                        <ShieldCheck size={13} /> ไม่ลบรายชื่อสมาชิก
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-zinc-500 font-mono">
                                        รหัส: 1500323553
                                    </span>
                                )}

                                <button
                                    type="button"
                                    onClick={() => setActiveModal(cat)}
                                    className={`text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                                        isHighDanger
                                            ? 'bg-red-50 hover:bg-red-600 hover:text-white text-red-700 border border-red-200'
                                            : 'bg-zinc-100 hover:bg-zinc-800 hover:text-white text-zinc-800 border border-zinc-300'
                                    }`}
                                >
                                    <Trash2 size={13} />
                                    {cat.isCrmSafe ? 'รีเซ็ตแต้มเริ่มต้น' : 'ล้างข้อมูลหมวดนี้'}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Protected Master Data Legend */}
            <div className="bg-white border border-[oklch(85%_0.012_28)] p-5 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                    <Database size={16} className="text-[oklch(52%_0.16_28)]" />
                    <h3 className="text-xs font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider">
                        ฐานข้อมูลหลักที่ระบบล็อกความปลอดภัยไว้ (Master & Configuration Data)
                    </h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-[oklch(97%_0.008_28)] rounded-xl border border-[oklch(90%_0.010_28)]">
                        <div className="text-[10px] text-[oklch(55%_0.010_28)] font-mono font-bold uppercase">ลูกค้า & CRM</div>
                        <div className="font-bold text-sm text-[oklch(18%_0.012_28)] mt-0.5">{counts.protected_profiles} บัญชี</div>
                        <div className="text-[10px] text-emerald-600 font-bold mt-0.5">✓ ปลอดภัย 100%</div>
                    </div>
                    <div className="p-3 bg-[oklch(97%_0.008_28)] rounded-xl border border-[oklch(90%_0.010_28)]">
                        <div className="text-[10px] text-[oklch(55%_0.010_28)] font-mono font-bold uppercase">เมนูอาหาร</div>
                        <div className="font-bold text-sm text-[oklch(18%_0.012_28)] mt-0.5">{counts.protected_menu_items} รายการ</div>
                        <div className="text-[10px] text-emerald-600 font-bold mt-0.5">✓ ปลอดภัย 100%</div>
                    </div>
                    <div className="p-3 bg-[oklch(97%_0.008_28)] rounded-xl border border-[oklch(90%_0.010_28)]">
                        <div className="text-[10px] text-[oklch(55%_0.010_28)] font-mono font-bold uppercase">รายการคลังวัตถุดิบ</div>
                        <div className="font-bold text-sm text-[oklch(18%_0.012_28)] mt-0.5">{counts.protected_stock_items} รายการ</div>
                        <div className="text-[10px] text-emerald-600 font-bold mt-0.5">✓ ปลอดภัย 100%</div>
                    </div>
                    <div className="p-3 bg-[oklch(97%_0.008_28)] rounded-xl border border-[oklch(90%_0.010_28)]">
                        <div className="text-[10px] text-[oklch(55%_0.010_28)] font-mono font-bold uppercase">การตั้งค่าร้าน & SOP</div>
                        <div className="font-bold text-sm text-[oklch(18%_0.012_28)] mt-0.5">ผังโต๊ะ / เครื่องพิมพ์</div>
                        <div className="text-[10px] text-emerald-600 font-bold mt-0.5">✓ ปลอดภัย 100%</div>
                    </div>
                </div>
            </div>

            {/* SECURITY MODAL: Passcode Verification */}
            {activeModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl max-w-lg w-full border border-gray-200 shadow-2xl overflow-hidden animate-scale-up">
                        {/* Modal Header */}
                        <div className="bg-red-600 text-white p-5 flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-red-700/80 rounded-xl">
                                    <AlertTriangle size={22} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-white tracking-tight">
                                        {activeModal.confirmTitle}
                                    </h3>
                                    <p className="text-xs text-red-100 mt-0.5 font-mono">
                                        SECURITY PASSCODE VERIFICATION
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-5 text-gray-800">
                            {/* Warning Box */}
                            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-900 leading-relaxed">
                                <strong className="font-bold block mb-1">ข้อควรระวัง:</strong>
                                {activeModal.warningNotes}
                            </div>

                            {/* Tables to be purged */}
                            <div className="text-xs space-y-1">
                                <span className="font-bold text-gray-600 uppercase text-[10px] tracking-wider">
                                    ตารางฐานข้อมูลที่จะได้รับผลกระทบ:
                                </span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {activeModal.tables.map(t => (
                                        <span key={t} className="bg-gray-100 text-gray-800 font-mono text-[11px] px-2 py-0.5 rounded border border-gray-200">
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Optional Stock Quantity Zeroing Checkbox */}
                            {activeModal.hasStockZeroOption && (
                                <label className="flex items-start gap-3 p-3 bg-zinc-50 border border-zinc-200 rounded-xl cursor-pointer hover:bg-zinc-100/70 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={resetStockQty}
                                        onChange={(e) => setResetStockQty(e.target.checked)}
                                        className="mt-0.5 w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer"
                                    />
                                    <div>
                                        <span className="font-bold text-xs text-gray-900 block">
                                            รีเซ็ตจำนวนสต็อกสินค้าคงเหลือ (Current Quantity) เป็น 0
                                        </span>
                                        <span className="text-[11px] text-gray-500">
                                            เลือกตัวเลือกนี้หากต้องการเริ่มนับสต็อกจริงหน้างาน (Physical Count) ก่อนเปิดร้าน
                                        </span>
                                    </div>
                                </label>
                            )}

                            {/* Passcode Input Field */}
                            <div className="space-y-2 pt-2 border-t border-gray-100">
                                <label className="block text-xs font-bold text-gray-800">
                                    กรุณากรอกรหัสผ่านความปลอดภัย <span className="font-mono text-red-600 font-bold">1500323553</span> เพื่อยืนยัน:
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                                        <Lock size={16} />
                                    </div>
                                    <input
                                        type="text"
                                        autoFocus
                                        placeholder="กรอกรหัส 1500323553"
                                        value={inputPasscode}
                                        onChange={(e) => setInputPasscode(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-mono tracking-widest text-gray-900 outline-none focus:border-red-600 focus:bg-white transition-all font-bold"
                                    />
                                </div>
                                {inputPasscode && inputPasscode.trim() !== REQUIRED_PASSCODE && (
                                    <p className="text-[11px] text-red-600 font-bold">
                                        รหัสไม่ถูกต้อง (ต้องเป็น 1500323553)
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-gray-50 p-4 border-t border-gray-200 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveModal(null);
                                    setInputPasscode('');
                                    setResetStockQty(false);
                                }}
                                disabled={isPurging}
                                className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                onClick={handleExecutePurge}
                                disabled={inputPasscode.trim() !== REQUIRED_PASSCODE || isPurging}
                                className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow flex items-center gap-2 ${
                                    inputPasscode.trim() === REQUIRED_PASSCODE && !isPurging
                                        ? 'bg-red-600 hover:bg-red-700 cursor-pointer shadow-red-500/20 active:scale-95'
                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
                                }`}
                            >
                                {isPurging ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        กำลังล้างข้อมูล...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={14} />
                                        ยืนยันการล้างข้อมูล
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
