/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect } from 'react';
import AdminPageHeader, { AdminTabs } from '../AdminPageHeader'
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
import { formatTaxId, formatBranch } from '../../../utils/thaiTaxHelper';
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
            return localStorage.getItem('onhaus_tax_invoice_time_mode') || 'day';
        } catch {
            return 'day';
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
                const { data: bookingsData, error: bookingsErr } = await supabase
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
                    .order('created_at', { ascending: false })
                    .limit(2000);

                if (!bookingsErr && bookingsData && isMounted) {
                    setAllYearBookings(bookingsData);
                    try { localStorage.setItem('onhaus_tax_bookings_cache', JSON.stringify(bookingsData)); } catch {}
                } else if (bookingsErr && isMounted) {
                    console.warn('[AdminTaxHub] Primary query failed, using basic select fallback:', bookingsErr.message);
                    const { data: fallbackData } = await supabase
                        .from('bookings')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(2000);

                    if (fallbackData && isMounted) {
                        setAllYearBookings(fallbackData);
                        try { localStorage.setItem('onhaus_tax_bookings_cache', JSON.stringify(fallbackData)); } catch {}
                    }
                }
            } catch (err) {
                console.error('[AdminTaxHub] Error loading bookings:', err);
                if (isMounted) {
                    try {
                        const local = localStorage.getItem('onhaus_tax_bookings_cache') || localStorage.getItem('pos_cache_active_bookings');
                        if (local) setAllYearBookings(JSON.parse(local));
                    } catch {}
                }
            }

            if (isMounted && !silent) setLoading(false);
        };

        loadInitialData(false);

        const debouncedSync = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                if (isMounted) loadInitialData(true);
            }, 600);
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

    const toLocalDateKey = (rawDate) => {
        if (!rawDate) return '';
        const d = new Date(rawDate);
        if (Number.isNaN(d.getTime())) return String(rawDate).slice(0, 10);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

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
            .filter(b => {
                const isCancelled = b.status === 'cancelled' || b.status === 'void' || b.status === 'deleted';
                if (isCancelled) return false;
                const bDate = b.booking_time || b.created_at || '';
                const bMonth = bDate.slice(0, 7);
                return bMonth === monthFilter;
            })
            .reduce((s, b) => {
                const amt = Number(b.total_amount !== undefined && b.total_amount !== null ? b.total_amount : (b.total_price !== undefined ? b.total_price : (b.deposit_amount || 0)));
                return s + amt;
            }, 0);
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
                        console.error('Supabase fallback void error:', fallbackErr);
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
                    title="Tax & Invoices"
                    description="ใบเสร็จและใบกำกับภาษีเต็มรูป ค่าใช้จ่าย Makro ภ.พ.30 และ 50 ทวิ"
                    meta={isVatRegistered ? 'จดทะเบียน VAT 7%' : 'ไม่ได้จด VAT · ออกใบเสร็จรับเงิน'}
                    actions={<>
                        <a
                            href="/manuals/thai_tax_guide_and_system_manual.html"
                            target="_blank"
                            rel="noreferrer"
                            className="admin-btn"
                        >
                            คู่มือ
                        </a>
                        <button
                            type="button"
                            onClick={() => setShowMonthlyExporter(true)}
                            className="admin-btn"
                            title="Export and print all monthly receipts with B&W auto-crop"
                        >
                            พิมพ์เอกสารทั้งเดือน
                        </button>
                        <button type="button" onClick={() => setShowReceiptPicker(true)} className="admin-btn">
                            ออกจากบิล POS
                        </button>
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
                            {isVatRegistered ? 'ใบกำกับภาษีใหม่' : 'ใบเสร็จใหม่'}
                        </button>
                    </>}
                >
                    <AdminTabs
                        ariaLabel="Tax & Invoices"
                        layoutId="tax-tabs"
                        tabs={[
                            { id: 'cash_ledger', label: 'Cash & tax P&L' },
                            { id: 'sales_tax', label: 'Sales & bills' },
                            { id: 'invoices', label: 'Tax invoices', count: invoices.length },
                            { id: 'expenses', label: 'Expenses & Makro' },
                            { id: 'wht', label: 'WHT 50 ทวิ' },
                            { id: 'settings', label: 'Tax config' }
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
                    <div className="space-y-6">
                        {/* Control Toolbar */}
                        <div className="border border-[var(--color-rule)] p-3 bg-[var(--color-paper)] flex flex-wrap items-center justify-between gap-3 tabular-nums text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex border border-[var(--color-rule)]">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setInvoiceTimeMode('day');
                                            try { localStorage.setItem('onhaus_tax_invoice_time_mode', 'day'); } catch {}
                                        }}
                                        className={`px-3 py-1.5 transition-colors cursor-pointer ${invoiceTimeMode === 'day' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-bold' : 'bg-[var(--color-paper-2)] text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                                    >
                                        รายวัน
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setInvoiceTimeMode('month');
                                            try { localStorage.setItem('onhaus_tax_invoice_time_mode', 'month'); } catch {}
                                        }}
                                        className={`px-3 py-1.5 transition-colors border-l border-[var(--color-rule)] cursor-pointer ${invoiceTimeMode === 'month' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-bold' : 'bg-[var(--color-paper-2)] text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                                    >
                                        รายเดือน
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setInvoiceTimeMode('all');
                                            try { localStorage.setItem('onhaus_tax_invoice_time_mode', 'all'); } catch {}
                                        }}
                                        className={`px-3 py-1.5 transition-colors border-l border-[var(--color-rule)] cursor-pointer ${invoiceTimeMode === 'all' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-bold' : 'bg-[var(--color-paper-2)] text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                                    >
                                        ทั้งหมด
                                    </button>
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
                                            className="px-3 py-1.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] font-bold text-xs focus:border-[var(--color-ink)] focus:outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const d = new Date();
                                                const y = d.getFullYear();
                                                const m = String(d.getMonth() + 1).padStart(2, '0');
                                                const day = String(d.getDate()).padStart(2, '0');
                                                const todayStr = `${y}-${m}-${day}`;
                                                setInvoiceDateFilter(todayStr);
                                                try { localStorage.setItem('onhaus_tax_invoice_date_filter', todayStr); } catch {}
                                            }}
                                            className="px-2 py-1.5 bg-[var(--color-paper-2)] hover:bg-[var(--color-rule)] border border-[var(--color-rule)] font-bold text-xs cursor-pointer"
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
                                        className="px-3 py-1.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] font-bold text-xs focus:border-[var(--color-ink)] focus:outline-none"
                                    />
                                )}

                                <div className="flex border border-[var(--color-rule)]">
                                    <button
                                        onClick={() => setStatusFilter('all')}
                                        className={`px-3 py-1.5 transition-colors ${statusFilter === 'all' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-bold' : 'bg-[var(--color-paper-2)] text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                                    >
                                        ALL
                                    </button>
                                    <button
                                        onClick={() => setStatusFilter('issued')}
                                        className={`px-3 py-1.5 transition-colors border-l border-[var(--color-rule)] ${statusFilter === 'issued' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-bold' : 'bg-[var(--color-paper-2)] text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                                    >
                                        ACTIVE
                                    </button>
                                    <button
                                        onClick={() => setStatusFilter('cancelled')}
                                        className={`px-3 py-1.5 transition-colors border-l border-[var(--color-rule)] ${statusFilter === 'cancelled' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-bold' : 'bg-[var(--color-paper-2)] text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                                    >
                                        VOID
                                    </button>
                                </div>

                                <div className="relative">
                                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                                    <input
                                        type="text"
                                        placeholder="FILTER INVOICE NO / BUYER / TAX ID..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-7 pr-3 py-1.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs w-52 sm:w-72 focus:border-[var(--color-ink)] focus:outline-none"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={fetchInvoices}
                                className="px-3 py-1.5 border border-[var(--color-rule)] hover:border-[var(--color-ink)] bg-[var(--color-paper-2)] text-[var(--color-ink)] font-bold flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
                            >
                                <RotateCcw size={12} />
                                <span>RELOAD</span>
                            </button>
                        </div>

                        {/* Invoices List Table */}
                        <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse tabular-nums text-[13px]">
                                    <thead>
                                        <tr className="bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] text-xs text-[var(--color-neutral)] font-bold">
                                            <th className="p-3 border-r border-[var(--color-rule)] w-12 text-center">NO.</th>
                                            <th className="p-3 border-r border-[var(--color-rule)] w-28">DATE</th>
                                            <th className="p-3 border-r border-[var(--color-rule)] w-36">DOCUMENT NO</th>
                                            <th className="p-3 border-r border-[var(--color-rule)] w-28">TYPE</th>
                                            <th className="p-3 border-r border-[var(--color-rule)] min-w-[200px]">BUYER / CORPORATE</th>
                                            <th className="p-3 border-r border-[var(--color-rule)] w-36">TAX ID</th>
                                            <th className="p-3 border-r border-[var(--color-rule)] text-right w-32">TOTAL (THB)</th>
                                            <th className="p-3 border-r border-[var(--color-rule)] text-center w-24">STATUS</th>
                                            <th className="p-3 text-center w-32">ACTIONS</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--color-rule)]">
                                        {filteredInvoices.map((inv, idx) => {
                                            const isCancelled = inv.status === 'cancelled';
                                            const linkedB = inv.booking_id ? bookingById.get(inv.booking_id) : null;
                                            const effectiveIssuedAt = linkedB?.booking_time || inv.issued_at || inv.created_at;
                                            const dateStr = effectiveIssuedAt ? toLocalDateKey(effectiveIssuedAt) : '-';
                                            const isVatDoc = inv.doc_type === 'tax_invoice';

                                            return (
                                                <tr key={inv.id || idx} className={`hover:bg-[var(--color-paper-2)] transition-colors ${isCancelled ? 'bg-red-50/20 text-[oklch(50%_0.010_28)]' : ''}`}>
                                                    <td className="p-3 border-r border-[var(--color-rule)] text-center text-[var(--color-neutral)]">{idx + 1}</td>
                                                    <td className="p-3 border-r border-[var(--color-rule)]">{dateStr}</td>
                                                    <td className="p-3 border-r border-[var(--color-rule)] font-bold text-[var(--color-ink)]">
                                                        <div>{inv.invoice_number}</div>
                                                        {inv.booking_id && (
                                                            <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-[var(--color-paper-2)] text-[var(--color-neutral)] border border-[var(--color-rule)] text-[11px] tabular-nums font-normal">
                                                                #POS-{String(inv.booking_id).slice(0, 4).toUpperCase()}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 border-r border-[var(--color-rule)] text-[13px]">
                                                        <span className={`px-1.5 py-0.5 border ${isVatDoc ? 'border-amber-400 bg-amber-50 text-amber-900 font-bold' : 'border-[var(--color-rule)] bg-[var(--color-paper-2)] text-[var(--color-ink)]'}`}>
                                                            {isVatDoc ? 'TAX INV' : 'RECEIPT'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 border-r border-[var(--color-rule)]">
                                                        <div className="font-sans font-bold text-xs text-[var(--color-ink)]">{inv.customer_name}</div>
                                                        <div className="text-xs text-[var(--color-muted)] tabular-nums">
                                                            {formatBranch(inv.customer_branch_type, inv.customer_branch_code)}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 border-r border-[var(--color-rule)] tabular-nums text-[13px]">{formatTaxId(inv.customer_tax_id)}</td>
                                                    <td className="p-3 border-r border-[var(--color-rule)] text-right font-black text-[13px] text-[var(--color-ink)]">
                                                        ฿{Number(inv.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="p-3 border-r border-[var(--color-rule)] text-center">
                                                        {isCancelled ? (
                                                            <span className="text-red-600 font-bold text-xs">
                                                                [VOID]
                                                            </span>
                                                        ) : (
                                                            <span className="text-[var(--color-emerald)] font-bold text-xs">
                                                                [ACTIVE]
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                onClick={() => {
                                                                    setPrintModalInitialEmail(false);
                                                                    setActivePrintInvoice(inv);
                                                                }}
                                                                className="px-2 py-1 bg-[var(--color-ink)] hover:bg-[oklch(18%_0.012_28)] text-[var(--color-paper)] font-bold text-xs flex items-center gap-1 cursor-pointer"
                                                                title="เปิดดูและพิมพ์ A4 / ดาวน์โหลด PDF"
                                                            >
                                                                <Printer size={11} />
                                                                <span>A4</span>
                                                            </button>

                                                            <button
                                                                onClick={() => {
                                                                    setEditingInvoice(inv);
                                                                    setSelectedBookingForInvoice(linkedB || null);
                                                                    setShowInvoiceModal(true);
                                                                }}
                                                                className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-[oklch(97%_0.008_28)] font-bold text-xs flex items-center gap-1 cursor-pointer"
                                                                title="แก้ไขข้อมูลเอกสารใบนี้ (รวมรายการ / แก้ไขชื่อ / ยอดเงิน)"
                                                            >
                                                                <Edit3 size={11} />
                                                                <span>EDIT</span>
                                                            </button>

                                                            <button
                                                                onClick={() => {
                                                                    setPrintModalInitialEmail(true);
                                                                    setActivePrintInvoice(inv);
                                                                }}
                                                                className="px-1.5 py-1 bg-blue-700 hover:bg-blue-600 text-[oklch(97%_0.008_28)] font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                                                                title="ส่งเอกสาร PDF ให้ลูกค้าทางอีเมล"
                                                            >
                                                                <Mail size={11} />
                                                            </button>

                                                            {!isCancelled && (
                                                                <button
                                                                    onClick={() => {
                                                                        setCancellationTarget(inv);
                                                                        setCancellationReason('');
                                                                    }}
                                                                    className="p-1 text-[var(--color-neutral)] hover:text-red-600 transition-colors cursor-pointer"
                                                                    title="Cancel / Void this document"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {filteredInvoices.length === 0 && (
                                            <tr>
                                                <td colSpan={9} className="p-12 text-center text-[var(--color-muted)] tabular-nums">
                                                    {loading ? 'LOADING DOCUMENT ARCHIVE...' : 'NO INVOICE RECORDS FOUND'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
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
                                CANCELLATION REASON (สาเหตุการยกเลิก) *
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
                                CANCEL
                            </button>
                            <button
                                type="button"
                                disabled={voiding || !cancellationReason.trim()}
                                onClick={handleConfirmCancel}
                                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-[oklch(97%_0.008_28)] font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                            >
                                <span>{voiding ? 'กำลังยกเลิก...' : 'CONFIRM VOID'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
