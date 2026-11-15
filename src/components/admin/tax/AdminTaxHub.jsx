/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect } from 'react';
import AdminPageHeader, { AdminTabs } from '../AdminPageHeader'
import AdminPopover from '../AdminPopover'
import { 
    FileText, 
    FileSpreadsheet, 
    Plus, 
    Settings, 
    Receipt, 
    Printer, 
    Search, 
    RotateCcw,
    X,
    BookOpen,
    ShoppingCart,
    ShieldAlert,
    Mail,
    Scale,
    Edit3
} from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { formatTaxId, formatBranch, toBangkokDateKey, bangkokYearStartIso, isTaxableSale, bookingSaleAmount } from '../../../utils/thaiTaxHelper';
import { toast } from 'sonner';
import { logStaffActivity } from '../../../utils/auditLogger';

// Sub Tabs Components
import SalesTaxReportTab from './SalesTaxReportTab';
import WithholdingTaxTab from './WithholdingTaxTab';
import TaxSettingsTab from './TaxSettingsTab';
import ExpensesTab from './ExpensesTab';
import CashTaxLedgerTab from './CashTaxLedgerTab';
import TaxInvoiceModal from './TaxInvoiceModal';
import TaxInvoicePrintView from './TaxInvoicePrintView';
import ExpenseModal from './ExpenseModal';
import ReceiptPickerModal from './ReceiptPickerModal';
import MonthlyTaxReceiptsExporter from './MonthlyTaxReceiptsExporter';

export default function AdminTaxHub() {
    // Navigation Sub-tab
    const [activeTab, setActiveTab] = useState('invoices'); // 'invoices' | 'expenses' | 'sales_tax' | 'wht' | 'settings'

    // Data State
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [companySettings, setCompanySettings] = useState({});
    const [allYearBookings, setAllYearBookings] = useState([]);

    // Filter & Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'issued' | 'cancelled'
    const [invoiceTimeMode, setInvoiceTimeMode] = useState(() => {
        try {
            return localStorage.getItem('onhaus_tax_invoice_period_v2') || 'month'; // tax work is monthly
        } catch {
            return 'month';
        }
    }); // 'day' | 'month' | 'all'
    const [invoiceDateFilter, setInvoiceDateFilter] = useState(() => {
        try {
            const saved = localStorage.getItem('onhaus_tax_invoice_date_filter');
            if (saved) return saved;
        } catch {}
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    });
    const [monthFilter, setMonthFilter] = useState(() => {
        try {
            const saved = localStorage.getItem('onhaus_tax_invoice_month_filter');
            if (saved) return saved;
        } catch {}
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    });

    // Modals
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [showReceiptPicker, setShowReceiptPicker] = useState(false);
    const [showMonthlyExporter, setShowMonthlyExporter] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState(null);
    const [selectedBookingForInvoice, setSelectedBookingForInvoice] = useState(null);
    const [activePrintInvoice, setActivePrintInvoice] = useState(null);
    const [printModalInitialEmail, setPrintModalInitialEmail] = useState(false);
    const [cancellationTarget, setCancellationTarget] = useState(null);
    const [cancellationReason, setCancellationReason] = useState('');
    const [voiding, setVoiding] = useState(false);

    // Expense Modals
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [lastSavedExpense, setLastSavedExpense] = useState(null);

    // Fetch Invoices
    const fetchInvoices = async () => {
        try {
            const { data, error } = await supabase
                .from('tax_invoices')
                .select('*')
                .order('issued_at', { ascending: false });

            if (!error && data) {
                setInvoices(data);
                localStorage.setItem('onhaus_tax_invoices', JSON.stringify(data));
            } else {
                const local = localStorage.getItem('onhaus_tax_invoices');
                if (local) setInvoices(JSON.parse(local));
            }
        } catch {
            const local = localStorage.getItem('onhaus_tax_invoices');
            if (local) setInvoices(JSON.parse(local));
        }
    };

    // Initial Load & Realtime Sync
    useEffect(() => {
        let isMounted = true;
        let debounceTimer = null;
        
        const loadInitialData = async (silent = false) => {
            if (!silent) setLoading(true);
            try {
                // 1. Fetch Company Tax Settings
                const { data: settingsData } = await supabase
                    .from('app_settings')
                    .select('key, value');

                if (isMounted && settingsData) {
                    const mapped = {};
                    settingsData.forEach(item => {
                        mapped[item.key] = item.value;
                    });
                    setCompanySettings(mapped);
                    localStorage.setItem('onhaus_tax_settings', JSON.stringify(mapped));
                }
            } catch {
                if (isMounted) {
                    const localSettings = localStorage.getItem('onhaus_tax_settings');
                    if (localSettings) setCompanySettings(JSON.parse(localSettings));
                }
            }

            // 2. Fetch Invoices
            await fetchInvoices();

            // 3. Fetch POS Bookings for Annual VAT Threshold & Sales Ledger
            try {
                // The API caps each response at 1,000 rows, so a single .limit(2000) silently
                // returned only the newest ~2 months. Page through this Thai year and last year.
                const sinceIso = bangkokYearStartIso(Number(toBangkokDateKey(new Date()).slice(0, 4)) - 1);
                const PAGE = 1000;
                const fetchPage = (from) => supabase
                    .from('bookings')
                    .select(`
                        id, 
                        booking_time, 
                        created_at, 
                        updated_at,
                        total_amount, 
                        discount_amount, 
                        xhaus_discount,
                        status, 
                        pax, 
                        booking_type, 
                        payment_slip_url, 
                        staff_remark, 
                        customer_note, 
                        user_id,
                        tables_layout (
                            id,
                            table_name
                        ),
                        profiles (
                            id,
                            display_name,
                            nickname,
                            phone_number,
                            current_tier
                        ),
                        order_items (
                            id,
                            quantity,
                            price_at_time,
                            custom_name,
                            menu_items (
                                id,
                                name,
                                price
                            )
                        )
                    `)
                    .gte('created_at', sinceIso)
                    .order('created_at', { ascending: false })
                    .range(from, from + PAGE - 1);

                let bookingsData = [];
                let bookingsErr = null;
                for (let from = 0; from < 50 * PAGE; from += PAGE) {
                    const { data: page, error } = await fetchPage(from);
                    if (error) { bookingsErr = error; break; }
                    bookingsData = bookingsData.concat(page || []);
                    if (!page || page.length < PAGE) break;
                }

                if (!bookingsErr && bookingsData && isMounted) {
                    setAllYearBookings(bookingsData);
                    try { localStorage.setItem('onhaus_tax_bookings_cache', JSON.stringify(bookingsData)); } catch {}
                } else if (bookingsErr && isMounted) {
                    console.warn('[AdminTaxHub] Primary query failed, using basic select fallback:', bookingsErr.message);
                    let fallbackData = [];
                    for (let from = 0; from < 50 * PAGE; from += PAGE) {
                        const { data: page, error } = await supabase
                            .from('bookings')
                            .select('*')
                            .gte('created_at', sinceIso)
                            .order('created_at', { ascending: false })
                            .range(from, from + PAGE - 1);
                        if (error) { fallbackData = null; break; }
                        fallbackData = fallbackData.concat(page || []);
                        if (!page || page.length < PAGE) break;
                    }
                    if (!fallbackData) toast.error('โหลดบิลขายไม่ครบ ตัวเลขภาษีอาจไม่ถูกต้อง ลองกดโหลดใหม่');

                    if (fallbackData && isMounted) {
                        setAllYearBookings(fallbackData);
                        try { localStorage.setItem('onhaus_tax_bookings_cache', JSON.stringify(fallbackData)); } catch {}
                    }
                }
            } catch (err) {
                console.error('[AdminTaxHub] Error loading bookings:', err);
                if (isMounted) {
                    try {
                        const local = localStorage.getItem('onhaus_tax_bookings_cache');
                        if (local) setAllYearBookings(JSON.parse(local));
                    } catch {}
                    toast.error('โหลดบิลขายจากเซิร์ฟเวอร์ไม่ได้ กำลังแสดงข้อมูลที่บันทึกไว้ล่าสุด');
                }
            }

            if (isMounted && !silent) setLoading(false);
        };

        loadInitialData(false);

        const debouncedSync = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                if (isMounted) loadInitialData(true);
            }, 3000); // a busy POS changes bookings constantly; the full-year reload is a few pages
        };

        // Realtime Subscription: tax_invoices, app_settings, bookings with safe unique channel name
        const channelName = `admin-tax-hub-${Math.random().toString(36).substring(2, 9)}`;
        const channel = supabase
            .channel(channelName)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tax_invoices' }, debouncedSync)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, debouncedSync)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, debouncedSync)
            .subscribe();

        return () => {
            isMounted = false;
            if (debounceTimer) {
                clearTimeout(debounceTimer);
                debounceTimer = null;
            }
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, []);

    const isVatRegistered = companySettings?.tax_is_vat_registered === 'true' || companySettings?.tax_is_vat_registered === true;

    const toLocalDateKey = toBangkokDateKey;

    const bookingById = React.useMemo(() => {
        const map = new Map();
        (allYearBookings || []).forEach(b => {
            if (b?.id) map.set(b.id, b);
        });
        return map;
    }, [allYearBookings]);

    // Filter Invoices
    const filteredInvoices = invoices.filter(inv => {
        const linkedB = inv.booking_id ? bookingById.get(inv.booking_id) : null;
        const effectiveIssuedAt = linkedB?.booking_time || inv.issued_at || inv.created_at || '';
        const localIssuedDate = toLocalDateKey(effectiveIssuedAt);
        const localCreatedDate = toLocalDateKey(inv.created_at || '');
        let matchesTime = true;
        if (invoiceTimeMode === 'day') {
            matchesTime = localIssuedDate === invoiceDateFilter || localCreatedDate === invoiceDateFilter;
        } else if (invoiceTimeMode === 'month') {
            matchesTime = !monthFilter || localIssuedDate.startsWith(monthFilter) || localCreatedDate.startsWith(monthFilter);
        }

        const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;

        const q = searchQuery.toLowerCase().trim();
        const matchesSearch = !q || 
            (inv.invoice_number || '').toLowerCase().includes(q) ||
            (inv.customer_name || '').toLowerCase().includes(q) ||
            (inv.customer_tax_id || '').includes(q) ||
            (inv.booking_id || '').toLowerCase().includes(q);

        return matchesTime && matchesStatus && matchesSearch;
    });

    // Calculate current month's POS Revenue (Excluding only cancelled/voided bookings)
    const currentMonthPosRevenue = React.useMemo(() => {
        if (!allYearBookings || allYearBookings.length === 0) return 0;
        return allYearBookings
            .filter(b => isTaxableSale(b) && toBangkokDateKey(b.booking_time || b.created_at).slice(0, 7) === monthFilter)
            .reduce((s, b) => s + bookingSaleAmount(b), 0);
    }, [allYearBookings, monthFilter]);

    // Handle Document Cancellation (with resilient DB fallback)
    const handleConfirmCancel = async () => {
        if (!cancellationTarget) return;
        if (!cancellationReason.trim()) {
            toast.error('กรุณาระบุเหตุผลการยกเลิกเอกสาร');
            return;
        }

        setVoiding(true);
        try {
            const updatedPayload = {
                status: 'cancelled',
                cancellation_reason: cancellationReason.trim(),
                cancelled_at: new Date().toISOString()
            };

            if (!String(cancellationTarget.id).startsWith('local_')) {
                // 1. Try full update with cancelled_at
                const { error: primaryErr } = await supabase
                    .from('tax_invoices')
                    .update(updatedPayload)
                    .eq('id', cancellationTarget.id);

                if (primaryErr) {
                    console.warn('Primary update error, attempting fallback update:', primaryErr);
                    // Fallback in case schema cache doesn't have cancelled_at
                    const { error: fallbackErr } = await supabase
                        .from('tax_invoices')
                        .update({
                            status: 'cancelled',
                            cancellation_reason: cancellationReason.trim()
                        })
                        .eq('id', cancellationTarget.id);

                    if (fallbackErr) {
                        // Do not mark it cancelled on screen when the database still has it issued
                        throw new Error(fallbackErr.message);
                    }
                }
            }

            const updatedInvoices = invoices.map(i => 
                i.id === cancellationTarget.id ? { ...i, ...updatedPayload } : i
            );
            setInvoices(updatedInvoices);
            localStorage.setItem('onhaus_tax_invoices', JSON.stringify(updatedInvoices));

            toast.success(`ยกเลิกเอกสาร ${cancellationTarget.invoice_number} เรียบร้อยแล้ว`);

            logStaffActivity('tax', 'tax_invoice_void', {
                amount: cancellationTarget.total_amount || 0,
                reason: `ยกเลิกใบกำกับภาษี ${cancellationTarget.invoice_number}: ${cancellationReason.trim()}`,
                metadata: {
                    invoice_id: cancellationTarget.id,
                    invoice_number: cancellationTarget.invoice_number,
                    customer_name: cancellationTarget.customer_name,
                    cancellation_reason: cancellationReason.trim()
                }
            });

            setCancellationTarget(null);
            setCancellationReason('');
        } catch (err) {
            toast.error('เกิดข้อผิดพลาดในการยกเลิก: ' + err.message);
        } finally {
            setVoiding(false);
        }
    };

    return (
        <div className="bg-[var(--color-paper)] text-[var(--color-ink)] font-sans">
            <div className="max-w-7xl mx-auto space-y-6">
                
                <AdminPageHeader
                    className=""
                    title="ภาษีและใบเสร็จ"
                    description="ใบเสร็จรับเงิน ยอดขาย ค่าใช้จ่าย และรายงานสำหรับยื่นภาษี"
                    meta={isVatRegistered ? 'จดทะเบียน VAT 7%' : 'ไม่ได้จด VAT · ออกใบเสร็จรับเงิน'}
                    actions={<>
                        <AdminPopover label="เพิ่มเติม">
                            <div className="flex flex-col -m-2">
                                {[
                                    { label: 'ออกใบเสร็จจากบิล POS', onClick: () => setShowReceiptPicker(true) },
                                    { label: 'พิมพ์เอกสารทั้งเดือน', onClick: () => setShowMonthlyExporter(true) },
                                    { label: 'คู่มือภาษีและระบบ', href: '/manuals/thai_tax_guide_and_system_manual.html' }
                                ].map(item => item.href ? (
                                    <a key={item.label} href={item.href} target="_blank" rel="noreferrer" className="px-2 py-2 text-sm text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]">
                                        {item.label}
                                    </a>
                                ) : (
                                    <button key={item.label} type="button" onClick={item.onClick} className="px-2 py-2 text-left text-sm text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] cursor-pointer">
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </AdminPopover>
                        <button
                            type="button"
                            onClick={() => {
                                setEditingExpense(null);
                                setShowExpenseModal(true);
                            }}
                            className="admin-btn"
                        >
                            บันทึกค่าใช้จ่าย
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setEditingInvoice(null);
                                setSelectedBookingForInvoice(null);
                                setShowInvoiceModal(true);
                            }}
                            className="admin-btn is-primary"
                        >
                            {isVatRegistered ? 'ออกใบกำกับภาษี' : 'ออกใบเสร็จ'}
                        </button>
                    </>}
                >
                    <AdminTabs
                        ariaLabel="ภาษีและใบเสร็จ"
                        layoutId="tax-tabs"
                        tabs={[
                            { id: 'cash_ledger', label: 'รายรับ-รายจ่าย' },
                            { id: 'sales_tax', label: 'ยอดขาย' },
                            { id: 'invoices', label: 'ใบเสร็จ', count: invoices.length },
                            { id: 'expenses', label: 'ค่าใช้จ่าย' },
                            { id: 'wht', label: '50 ทวิ' },
                            { id: 'settings', label: 'ตั้งค่า' }
                        ]}
                        active={activeTab}
                        onChange={setActiveTab}
                    />
                </AdminPageHeader>

                {/* 3. SUB-TAB VIEWPORT */}

                {/* TAB 0: CASH & TAX P&L (รายงานเงินสดรับ-จ่าย ตาม ม.161) */}
                {activeTab === 'cash_ledger' && (
                    <CashTaxLedgerTab
                        companySettings={companySettings}
                        allYearBookings={allYearBookings}
                        onOpenCreateExpense={() => {
                            setEditingExpense(null);
                            setShowExpenseModal(true);
                        }}
                        onOpenCreateInvoice={() => {
                            setEditingInvoice(null);
                            setSelectedBookingForInvoice(null);
                            setShowInvoiceModal(true);
                        }}
                    />
                )}

                {/* TAB 1: INVOICES ARCHIVE LEDGER */}
                {activeTab === 'invoices' && (
                    <div className="space-y-4">
                        {/* Toolbar: period, status, search */}
                        <div className="border border-[var(--color-rule)] p-3 bg-[var(--color-paper)] flex flex-wrap items-center justify-between gap-3 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex border border-[var(--color-rule)]">
                                    {[['month', 'รายเดือน'], ['day', 'รายวัน'], ['all', 'ทั้งหมด']].map(([mode, label], i) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => {
                                                setInvoiceTimeMode(mode);
                                                try { localStorage.setItem('onhaus_tax_invoice_period_v2', mode); } catch {}
                                            }}
                                            className={`px-3 py-1.5 transition-colors cursor-pointer ${i > 0 ? 'border-l border-[var(--color-rule)]' : ''} ${invoiceTimeMode === mode ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-semibold' : 'bg-[var(--color-paper-2)] text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>

                                {invoiceTimeMode === 'day' && (
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="date"
                                            value={invoiceDateFilter}
                                            onChange={(e) => {
                                                setInvoiceDateFilter(e.target.value);
                                                try { localStorage.setItem('onhaus_tax_invoice_date_filter', e.target.value); } catch {}
                                            }}
                                            className="px-3 py-1.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] tabular-nums focus:border-[var(--color-ink)] focus:outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const todayStr = toBangkokDateKey(new Date());
                                                setInvoiceDateFilter(todayStr);
                                                try { localStorage.setItem('onhaus_tax_invoice_date_filter', todayStr); } catch {}
                                            }}
                                            className="px-2.5 py-1.5 bg-[var(--color-paper-2)] hover:bg-[var(--color-rule)] border border-[var(--color-rule)] cursor-pointer"
                                        >
                                            วันนี้
                                        </button>
                                    </div>
                                )}

                                {invoiceTimeMode === 'month' && (
                                    <input
                                        type="month"
                                        value={monthFilter}
                                        onChange={(e) => {
                                            setMonthFilter(e.target.value);
                                            try { localStorage.setItem('onhaus_tax_invoice_month_filter', e.target.value); } catch {}
                                        }}
                                        className="px-3 py-1.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] tabular-nums focus:border-[var(--color-ink)] focus:outline-none"
                                    />
                                )}

                                <div className="flex border border-[var(--color-rule)]">
                                    {[['all', 'ทุกสถานะ'], ['issued', 'ใช้งาน'], ['cancelled', 'ยกเลิก']].map(([status, label], i) => (
                                        <button
                                            key={status}
                                            type="button"
                                            onClick={() => setStatusFilter(status)}
                                            className={`px-3 py-1.5 transition-colors cursor-pointer ${i > 0 ? 'border-l border-[var(--color-rule)]' : ''} ${statusFilter === status ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-semibold' : 'bg-[var(--color-paper-2)] text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>

                                <div className="relative w-full sm:w-72">
                                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                                    <input
                                        type="text"
                                        placeholder="ค้นหาเลขที่ ผู้ซื้อ หรือเลขผู้เสียภาษี"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-8 pr-3 py-1.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] focus:border-[var(--color-ink)] focus:outline-none"
                                    />
                                </div>
                            </div>

                            <button type="button" onClick={fetchInvoices} className="admin-btn">
                                <RotateCcw size={13} />
                                <span>โหลดใหม่</span>
                            </button>
                        </div>

                        {/* What is listed, and its total */}
                        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-[var(--color-muted)]">
                            <span>
                                {filteredInvoices.length} เอกสาร
                                {filteredInvoices.some(i => i.status === 'cancelled') && ` · ยกเลิก ${filteredInvoices.filter(i => i.status === 'cancelled').length}`}
                            </span>
                            <span className="tabular-nums">
                                ยอดรวมที่ใช้งาน <strong className="text-[var(--color-ink)]">฿{filteredInvoices.filter(i => i.status !== 'cancelled').reduce((s, i) => s + Number(i.total_amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                            </span>
                        </div>

                        {(() => {
                            const rows = filteredInvoices.map((inv) => {
                                const linkedB = inv.booking_id ? bookingById.get(inv.booking_id) : null;
                                const effectiveIssuedAt = linkedB?.booking_time || inv.issued_at || inv.created_at;
                                return {
                                    inv,
                                    linkedB,
                                    isCancelled: inv.status === 'cancelled',
                                    dateStr: effectiveIssuedAt ? toLocalDateKey(effectiveIssuedAt) : '-',
                                    typeLabel: inv.doc_type === 'tax_invoice' ? 'ใบกำกับภาษี' : (inv.doc_type === 'credit_note' ? 'ใบลดหนี้' : 'ใบเสร็จ'),
                                    amount: `฿${Number(inv.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                                };
                            });
                            const openPrint = (inv, email = false) => { setPrintModalInitialEmail(email); setActivePrintInvoice(inv); };
                            const openReissue = (inv, linkedB) => { setEditingInvoice(inv); setSelectedBookingForInvoice(linkedB || null); setShowInvoiceModal(true); };
                            const actionBtn = 'px-2.5 py-1 border border-[var(--color-rule)] bg-[var(--color-paper)] hover:border-[var(--color-ink)] text-[var(--color-ink)] text-xs font-semibold cursor-pointer';
                            const renderActions = ({ inv, linkedB, isCancelled }) => (
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <button type="button" onClick={() => openPrint(inv)} className={actionBtn} title="เปิดดู พิมพ์ A4 หรือดาวน์โหลด PDF">เปิด / PDF</button>
                                    <button type="button" onClick={() => openPrint(inv, true)} className={actionBtn} title="ส่ง PDF ให้ลูกค้าทางอีเมล">อีเมล</button>
                                    {!isCancelled && (
                                        <button type="button" onClick={() => openReissue(inv, linkedB)} className={actionBtn} title="ใบที่ออกแล้วแก้ไม่ได้: ยกเลิกใบนี้และออกใบใหม่แทน">แก้ไข (ออกใบใหม่)</button>
                                    )}
                                    {!isCancelled && (
                                        <button
                                            type="button"
                                            onClick={() => { setCancellationTarget(inv); setCancellationReason(''); }}
                                            className="px-2.5 py-1 text-xs font-semibold text-[var(--color-accent)] hover:underline cursor-pointer"
                                        >
                                            ยกเลิก
                                        </button>
                                    )}
                                </div>
                            );
                            const renderStatus = ({ inv, isCancelled }) => (
                                isCancelled
                                    ? <span className="text-xs font-semibold whitespace-nowrap text-[var(--color-accent)]" title={inv.cancellation_reason || ''}>ยกเลิกแล้ว</span>
                                    : <span className="text-xs font-semibold text-[var(--color-accent-2)]">ใช้งาน</span>
                            );

                            if (rows.length === 0) {
                                return (
                                    <div className="border border-[var(--color-rule)] p-10 text-center text-sm text-[var(--color-muted)]">
                                        {loading ? 'กำลังโหลดเอกสาร…' : 'ไม่มีเอกสารในช่วงที่เลือก'}
                                    </div>
                                );
                            }

                            return (<>
                                {/* Phones and tablets: one card per document, amount and actions visible without scrolling sideways */}
                                <ul className="lg:hidden border border-[var(--color-rule)] divide-y divide-[var(--color-rule)] bg-[var(--color-paper)]">
                                    {rows.map((row, idx) => (
                                        <li key={row.inv.id || idx} className={`p-4 space-y-2 ${row.isCancelled ? 'opacity-60' : ''}`}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className={`font-semibold tabular-nums text-[var(--color-ink)] ${row.isCancelled ? 'line-through' : ''}`}>{row.inv.invoice_number}</div>
                                                    <div className="text-xs text-[var(--color-muted)] tabular-nums">{row.dateStr} · {row.typeLabel}</div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="font-bold tabular-nums text-[var(--color-ink)]">{row.amount}</div>
                                                    {renderStatus(row)}
                                                </div>
                                            </div>
                                            <div className="text-sm text-[var(--color-ink)] leading-snug">{row.inv.customer_name}</div>
                                            {row.inv.customer_tax_id && (
                                                <div className="text-xs text-[var(--color-muted)] tabular-nums">
                                                    {formatTaxId(row.inv.customer_tax_id)} · {formatBranch(row.inv.customer_branch_type, row.inv.customer_branch_code)}
                                                </div>
                                            )}
                                            {renderActions(row)}
                                        </li>
                                    ))}
                                </ul>

                                {/* Desktop: table */}
                                <div className="hidden lg:block border border-[var(--color-rule)] bg-[var(--color-paper)] overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-sm">
                                        <thead>
                                            <tr className="bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] text-xs text-[var(--color-muted)] font-semibold">
                                                <th className="p-3 w-28">วันที่</th>
                                                <th className="p-3 w-40">เลขที่</th>
                                                <th className="p-3 min-w-[220px]">ผู้ซื้อ</th>
                                                <th className="p-3 w-36">เลขผู้เสียภาษี</th>
                                                <th className="p-3 text-right w-32">ยอดเงิน</th>
                                                <th className="p-3 w-24">สถานะ</th>
                                                <th className="p-3">จัดการ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--color-rule)]">
                                            {rows.map((row, idx) => (
                                                <tr key={row.inv.id || idx} className={`align-top hover:bg-[var(--color-paper-2)] transition-colors ${row.isCancelled ? 'text-[var(--color-muted)]' : ''}`}>
                                                    <td className="p-3 tabular-nums whitespace-nowrap">{row.dateStr}</td>
                                                    <td className="p-3">
                                                        <div className={`font-semibold tabular-nums whitespace-nowrap text-[var(--color-ink)] ${row.isCancelled ? 'line-through' : ''}`}>{row.inv.invoice_number}</div>
                                                        <div className="text-xs text-[var(--color-muted)]">{row.typeLabel}</div>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="font-medium text-[var(--color-ink)] leading-snug">{row.inv.customer_name}</div>
                                                        <div className="text-xs text-[var(--color-muted)]">{formatBranch(row.inv.customer_branch_type, row.inv.customer_branch_code)}</div>
                                                    </td>
                                                    <td className="p-3 tabular-nums whitespace-nowrap">{formatTaxId(row.inv.customer_tax_id)}</td>
                                                    <td className="p-3 text-right font-bold tabular-nums text-[var(--color-ink)]">{row.amount}</td>
                                                    <td className="p-3">{renderStatus(row)}</td>
                                                    <td className="p-3">{renderActions(row)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>);
                        })()}
                    </div>
                )}

                {/* TAB 2: STORE EXPENSES & MAKRO PURCHASES */}
                {activeTab === 'expenses' && (
                    <ExpensesTab
                        allYearBookings={allYearBookings}
                        monthlyPosRevenue={currentMonthPosRevenue}
                        companySettings={companySettings}
                        isVatRegistered={isVatRegistered}
                        lastSavedExpense={lastSavedExpense}
                        onOpenCreateModal={() => {
                            setEditingExpense(null);
                            setShowExpenseModal(true);
                        }}
                        onOpenEditModal={(exp) => {
                            setEditingExpense(exp);
                            setShowExpenseModal(true);
                        }}
                    />
                )}

                {/* TAB 3: SALES TAX REPORT & 1.8M PROGRESS */}
                {activeTab === 'sales_tax' && (
                    <SalesTaxReportTab
                        invoices={invoices}
                        companySettings={companySettings}
                        onOpenInvoice={(inv) => setActivePrintInvoice(inv)}
                        allYearBookings={allYearBookings}
                        onDeleteBooking={(bookingId) => {
                            setAllYearBookings(prev => prev.filter(b => b.id !== bookingId));
                        }}
                        onDeleteInvoice={(invoiceId) => {
                            setInvoices(prev => prev.filter(i => i.id !== invoiceId));
                        }}
                    />
                )}

                {/* TAB 4: WITHHOLDING TAX (50 ทวิ) */}
                {activeTab === 'wht' && (
                    <WithholdingTaxTab
                        companySettings={companySettings}
                    />
                )}

                {/* TAB 5: TAX SETTINGS & CUSTOMER DIRECTORY */}
                {activeTab === 'settings' && (
                    <TaxSettingsTab
                        companySettings={companySettings}
                        onSettingsUpdated={(newSettings) => setCompanySettings(newSettings)}
                    />
                )}
            </div>

            {/* MODALS */}

            {/* 1. Tax Invoice Creation Modal */}
            {showInvoiceModal && (
                <TaxInvoiceModal
                    existingInvoice={editingInvoice}
                    booking={selectedBookingForInvoice}
                    companySettings={companySettings}
                    onClose={() => {
                        setShowInvoiceModal(false);
                        setEditingInvoice(null);
                        setSelectedBookingForInvoice(null);
                    }}
                    onSaveSuccess={(savedInvoice) => {
                        setShowInvoiceModal(false);
                        setEditingInvoice(null);
                        setSelectedBookingForInvoice(null);
                        fetchInvoices();
                        setActivePrintInvoice(savedInvoice);
                    }}
                />
            )}

            {/* 1.1 POS Receipt Picker Modal */}
            {showReceiptPicker && (
                <ReceiptPickerModal
                    onSelectReceipt={(selectedBooking) => {
                        setShowReceiptPicker(false);
                        setEditingInvoice(null);
                        setSelectedBookingForInvoice(selectedBooking);
                        setShowInvoiceModal(true);
                    }}
                    onClose={() => setShowReceiptPicker(false)}
                />
            )}

            {/* 2. Expense / Makro Receipt Capture Modal (with Gemini AI) */}
            {showExpenseModal && (
                <ExpenseModal
                    existingExpense={editingExpense}
                    onClose={() => {
                        setShowExpenseModal(false);
                        setEditingExpense(null);
                    }}
                    onSaveSuccess={(savedExpense) => {
                        setShowExpenseModal(false);
                        setEditingExpense(null);
                        setActiveTab('expenses');
                        setLastSavedExpense(savedExpense);
                    }}
                />
            )}

            {/* 2.1 Monthly Tax Receipts Exporter & A4 Dossier Workbench */}
            {showMonthlyExporter && (
                <MonthlyTaxReceiptsExporter
                    initialMonth={monthFilter}
                    companySettings={companySettings}
                    onClose={() => setShowMonthlyExporter(false)}
                />
            )}

            {/* 3. A4 Official Printable Tax Invoice / Receipt View */}
            {activePrintInvoice && (
                <TaxInvoicePrintView
                    invoice={activePrintInvoice}
                    companySettings={companySettings}
                    initialShowEmail={printModalInitialEmail}
                    onClose={() => {
                        setActivePrintInvoice(null);
                        setPrintModalInitialEmail(false);
                    }}
                    onEdit={(invToEdit) => {
                        setActivePrintInvoice(null);
                        setPrintModalInitialEmail(false);
                        setEditingInvoice(invToEdit);
                        const linkedB = invToEdit.booking_id ? bookingById.get(invToEdit.booking_id) : null;
                        setSelectedBookingForInvoice(linkedB || null);
                        setShowInvoiceModal(true);
                    }}
                />
            )}

            {/* 4. Document Cancellation Confirmation Modal */}
            {cancellationTarget && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 font-sans text-xs">
                    <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] w-full max-w-md p-6 space-y-4 shadow-2xl">
                        <div className="border-b border-[var(--color-rule)] pb-3 flex items-center gap-2 text-red-600">
                            <ShieldAlert size={18} />
                            <h3 className="tabular-nums font-bold text-sm text-[var(--color-ink)] ">
                                CONFIRM DOCUMENT VOID // {cancellationTarget.invoice_number}
                            </h3>
                        </div>

                        <p className="text-[12px] text-[var(--color-neutral)] leading-relaxed">
                            การยกเลิกเอกสารนี้จะถูกบันทึกประวัติการยกเลิกในระบบ และสถานะจะเปลี่ยนเป็น [VOID] ทันที
                        </p>

                        <div>
                            <label className="tabular-nums text-xs font-bold text-[var(--color-neutral)] block mb-1">
                                เหตุผลการยกเลิก *
                            </label>
                            <input
                                type="text"
                                value={cancellationReason}
                                onChange={(e) => setCancellationReason(e.target.value)}
                                placeholder="พิมพ์สาเหตุ หรือคลิกเลือกจากตัวเลือกด้านล่าง"
                                className="w-full px-3 py-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-medium focus:border-[var(--color-ink)] focus:outline-none"
                                autoFocus
                            />

                            {/* Quick Reason Chips */}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {[
                                    'พิมพ์ผิด / แก้ไขข้อมูล',
                                    'ลูกค้ายกเลิกออเดอร์',
                                    'เปลี่ยนชื่อ / ที่อยู่ผู้ซื้อ',
                                    'ออกเอกสารซ้ำ',
                                    'ลูกค้าขอเปลี่ยนเป็นใบกำกับภาษี'
                                ].map((reason) => (
                                    <button
                                        key={reason}
                                        type="button"
                                        onClick={() => setCancellationReason(reason)}
                                        className={`px-2 py-0.5 border text-[11px] tabular-nums transition-colors cursor-pointer ${
                                            cancellationReason === reason
                                                ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)] font-bold'
                                                : 'bg-[var(--color-paper-2)] text-[var(--color-neutral)] border-[var(--color-rule)] hover:text-[var(--color-ink)] hover:border-[var(--color-ink)]'
                                        }`}
                                    >
                                        + {reason}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-rule)] tabular-nums text-xs">
                            <button
                                type="button"
                                disabled={voiding}
                                onClick={() => setCancellationTarget(null)}
                                className="px-4 py-2 border border-[var(--color-rule)] text-[var(--color-neutral)] hover:text-[var(--color-ink)] font-bold cursor-pointer disabled:opacity-50"
                            >
                                ไม่ยกเลิก
                            </button>
                            <button
                                type="button"
                                disabled={voiding || !cancellationReason.trim()}
                                onClick={handleConfirmCancel}
                                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-[oklch(97%_0.008_28)] font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                            >
                                <span>{voiding ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิกเอกสาร'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
