/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect } from 'react';
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
    Mail
} from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { formatTaxId, formatBranch } from '../../../utils/thaiTaxHelper';
import { toast } from 'sonner';

// Sub Tabs Components
import SalesTaxReportTab from './SalesTaxReportTab';
import WithholdingTaxTab from './WithholdingTaxTab';
import TaxSettingsTab from './TaxSettingsTab';
import ExpensesTab from './ExpensesTab';
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
    const [invoiceTimeMode, setInvoiceTimeMode] = useState('month'); // 'month' | 'day' | 'all'
    const [invoiceDateFilter, setInvoiceDateFilter] = useState(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    });
    const [monthFilter, setMonthFilter] = useState(() => {
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
    const [expensesKey, setExpensesKey] = useState(0);

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

    // Filter Invoices
    const filteredInvoices = invoices.filter(inv => {
        const rawDate = inv.issued_at || inv.created_at || '';
        let matchesTime = true;
        if (invoiceTimeMode === 'day') {
            matchesTime = rawDate.startsWith(invoiceDateFilter);
        } else if (invoiceTimeMode === 'month') {
            matchesTime = !monthFilter || rawDate.startsWith(monthFilter);
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

    // Calculate current month's POS Revenue
    const currentMonthPosRevenue = React.useMemo(() => {
        if (!allYearBookings || allYearBookings.length === 0) return 0;
        return allYearBookings
            .filter(b => {
                const bDate = b.booking_time || b.created_at || '';
                const bMonth = bDate.slice(0, 7);
                const isPaid = b.status === 'completed' || b.status === 'confirmed';
                return bMonth === monthFilter && isPaid;
            })
            .reduce((s, b) => s + Number(b.total_amount || b.deposit_amount || 0), 0);
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
            setCancellationTarget(null);
            setCancellationReason('');
        } catch (err) {
            toast.error('เกิดข้อผิดพลาดในการยกเลิก: ' + err.message);
        } finally {
            setVoiding(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)] p-3 sm:p-6 lg:p-8 font-sans">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* 1. Structural Header: Dieter Rams Tabular Container */}
                <div className="border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider bg-[var(--color-ink)] text-[var(--color-paper)]">
                                TAX//OPERATING SYSTEM
                            </span>
                            <span className="font-mono text-[10px] text-[var(--color-neutral)] uppercase tracking-wider">
                                {isVatRegistered ? '[STATUS: VAT 7% REGISTERED]' : '[STATUS: NON-VAT / OFFICIAL RECEIPTS]'}
                            </span>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-ink)] font-mono uppercase">
                            TAX MANAGEMENT &amp; INVOICE WORKBENCH
                        </h1>
                        <p className="text-xs text-[var(--color-neutral)] font-mono max-w-2xl leading-relaxed">
                            ระบบออกเอกสารภาษี ใบเสร็จรับเงิน/ใบกำกับภาษีเต็มรูป (ม.86/4 &amp; 105), บันทึกค่าใช้จ่าย Makro ด้วย AI, รายงานภาษีขาย (ภ.พ.30) และ 50 ทวิ
                        </p>
                    </div>

                    {/* Quick CTA Actions */}
                    <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
                        <a
                            href="/manuals/thai_tax_guide_and_system_manual.html"
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-2 bg-[var(--color-paper)] hover:bg-white text-[var(--color-ink)] border border-[var(--color-rule)] font-bold text-[11px] flex items-center gap-1.5 transition-colors"
                        >
                            <BookOpen size={14} className="text-[var(--color-neutral)]" />
                            <span>MANUAL (PDF)</span>
                        </a>

                        <button
                            onClick={() => setShowMonthlyExporter(true)}
                            className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                            title="Export and print all monthly receipts with B&W auto-crop"
                        >
                            <FileText size={14} className="text-emerald-300" />
                            <span>🧾 EXPORT MONTHLY TAX (จัดพิมพ์ทั้งเดือน)</span>
                        </button>

                        <button
                            onClick={() => setShowReceiptPicker(true)}
                            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                        >
                            <Receipt size={14} />
                            <span>+ ออกจากบิล POS</span>
                        </button>

                        <button
                            onClick={() => {
                                setEditingExpense(null);
                                setShowExpenseModal(true);
                            }}
                            className="px-3.5 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-dark)] text-white font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                        >
                            <ShoppingCart size={14} />
                            <span>+ LOG EXPENSE (MAKRO)</span>
                        </button>

                        <button
                            onClick={() => {
                                setEditingInvoice(null);
                                setSelectedBookingForInvoice(null);
                                setShowInvoiceModal(true);
                            }}
                            className="px-4 py-2 bg-[var(--color-ink)] hover:bg-black text-[var(--color-paper)] font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                        >
                            <Plus size={15} />
                            <span>{isVatRegistered ? '+ NEW TAX INVOICE' : '+ NEW RECEIPT'}</span>
                        </button>
                    </div>
                </div>

                {/* 2. Structural Tab Navigation Strip */}
                <div className="border border-[var(--color-rule)] bg-[var(--color-paper-2)] grid grid-cols-2 sm:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-[var(--color-rule)] font-mono text-xs font-bold">
                    <button
                        onClick={() => setActiveTab('sales_tax')}
                        className={`p-3 text-center transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                            activeTab === 'sales_tax' 
                                ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' 
                                : 'bg-[var(--color-paper)] text-[var(--color-neutral)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]'
                        }`}
                    >
                        <FileSpreadsheet size={14} />
                        <span>ALL SALES &amp; BILLS (บิลขายทั้งหมด)</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('invoices')}
                        className={`p-3 text-center transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                            activeTab === 'invoices' 
                                ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' 
                                : 'bg-[var(--color-paper)] text-[var(--color-neutral)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]'
                        }`}
                    >
                        <Receipt size={14} />
                        <span>TAX INVOICES ({invoices.length})</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('expenses')}
                        className={`p-3 text-center transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                            activeTab === 'expenses' 
                                ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' 
                                : 'bg-[var(--color-paper)] text-[var(--color-neutral)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]'
                        }`}
                    >
                        <ShoppingCart size={14} />
                        <span>EXPENSES &amp; MAKRO</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('wht')}
                        className={`p-3 text-center transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                            activeTab === 'wht' 
                                ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' 
                                : 'bg-[var(--color-paper)] text-[var(--color-neutral)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]'
                        }`}
                    >
                        <FileText size={14} />
                        <span>WHT 50 ทวิ</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`p-3 text-center transition-colors cursor-pointer flex items-center justify-center gap-2 col-span-2 sm:col-span-1 ${
                            activeTab === 'settings' 
                                ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' 
                                : 'bg-[var(--color-paper)] text-[var(--color-neutral)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]'
                        }`}
                    >
                        <Settings size={14} />
                        <span>TAX CONFIG</span>
                    </button>
                </div>

                {/* 3. SUB-TAB VIEWPORT */}

                {/* TAB 1: INVOICES ARCHIVE LEDGER */}
                {activeTab === 'invoices' && (
                    <div className="space-y-6">
                        {/* Control Toolbar */}
                        <div className="border border-[var(--color-rule)] p-3 bg-[var(--color-paper)] flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex border border-[var(--color-rule)]">
                                    <button
                                        type="button"
                                        onClick={() => setInvoiceTimeMode('day')}
                                        className={`px-3 py-1.5 transition-colors ${invoiceTimeMode === 'day' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-bold' : 'bg-[var(--color-paper-2)] text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                                    >
                                        รายวัน
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setInvoiceTimeMode('month')}
                                        className={`px-3 py-1.5 transition-colors border-l border-[var(--color-rule)] ${invoiceTimeMode === 'month' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-bold' : 'bg-[var(--color-paper-2)] text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                                    >
                                        รายเดือน
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setInvoiceTimeMode('all')}
                                        className={`px-3 py-1.5 transition-colors border-l border-[var(--color-rule)] ${invoiceTimeMode === 'all' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-bold' : 'bg-[var(--color-paper-2)] text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                                    >
                                        ทั้งหมด
                                    </button>
                                </div>

                                {invoiceTimeMode === 'day' && (
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="date"
                                            value={invoiceDateFilter}
                                            onChange={(e) => setInvoiceDateFilter(e.target.value)}
                                            className="px-3 py-1.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] font-bold text-xs focus:border-[var(--color-ink)] focus:outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const d = new Date();
                                                const y = d.getFullYear();
                                                const m = String(d.getMonth() + 1).padStart(2, '0');
                                                const day = String(d.getDate()).padStart(2, '0');
                                                setInvoiceDateFilter(`${y}-${m}-${day}`);
                                            }}
                                            className="px-2 py-1.5 bg-[var(--color-paper-2)] hover:bg-[var(--color-rule)] border border-[var(--color-rule)] font-bold text-[11px]"
                                        >
                                            วันนี้
                                        </button>
                                    </div>
                                )}

                                {invoiceTimeMode === 'month' && (
                                    <input
                                        type="month"
                                        value={monthFilter}
                                        onChange={(e) => setMonthFilter(e.target.value)}
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
                                className="px-3 py-1.5 border border-[var(--color-rule)] hover:border-[var(--color-ink)] bg-[var(--color-paper-2)] text-[var(--color-ink)] font-bold flex items-center gap-1.5 transition-colors cursor-pointer text-[11px]"
                            >
                                <RotateCcw size={12} />
                                <span>RELOAD</span>
                            </button>
                        </div>

                        {/* Invoices List Table */}
                        <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse font-mono text-xs">
                                    <thead>
                                        <tr className="bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] text-[10px] text-[var(--color-neutral)] tracking-wider uppercase font-bold">
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
                                            const dateStr = inv.issued_at ? new Date(inv.issued_at).toISOString().slice(0, 10) : '-';
                                            const isVatDoc = inv.doc_type === 'tax_invoice';

                                            return (
                                                <tr key={inv.id || idx} className={`hover:bg-[var(--color-paper-2)] transition-colors ${isCancelled ? 'bg-red-50/20 text-gray-400' : ''}`}>
                                                    <td className="p-3 border-r border-[var(--color-rule)] text-center text-[var(--color-neutral)]">{idx + 1}</td>
                                                    <td className="p-3 border-r border-[var(--color-rule)]">{dateStr}</td>
                                                    <td className="p-3 border-r border-[var(--color-rule)] font-bold text-[var(--color-ink)]">
                                                        <div>{inv.invoice_number}</div>
                                                        {inv.booking_id && (
                                                            <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-[var(--color-paper-2)] text-[var(--color-neutral)] border border-[var(--color-rule)] text-[9px] font-mono font-normal">
                                                                #POS-{String(inv.booking_id).slice(0, 4).toUpperCase()}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 border-r border-[var(--color-rule)] text-[10px]">
                                                        <span className={`px-1.5 py-0.5 border ${isVatDoc ? 'border-amber-400 bg-amber-50 text-amber-900 font-bold' : 'border-[var(--color-rule)] bg-[var(--color-paper-2)] text-[var(--color-ink)]'}`}>
                                                            {isVatDoc ? 'TAX INV' : 'RECEIPT'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 border-r border-[var(--color-rule)]">
                                                        <div className="font-sans font-bold text-xs text-[var(--color-ink)]">{inv.customer_name}</div>
                                                        <div className="text-[10px] text-[var(--color-muted)] font-mono">
                                                            {formatBranch(inv.customer_branch_type, inv.customer_branch_code)}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 border-r border-[var(--color-rule)] font-mono text-[11px]">{formatTaxId(inv.customer_tax_id)}</td>
                                                    <td className="p-3 border-r border-[var(--color-rule)] text-right font-black text-xs text-[var(--color-ink)]">
                                                        ฿{Number(inv.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="p-3 border-r border-[var(--color-rule)] text-center">
                                                        {isCancelled ? (
                                                            <span className="text-red-600 font-bold text-[10px]">
                                                                [VOID]
                                                            </span>
                                                        ) : (
                                                            <span className="text-[var(--color-emerald)] font-bold text-[10px]">
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
                                                                className="px-2 py-1 bg-[var(--color-ink)] hover:bg-black text-[var(--color-paper)] font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                                                                title="เปิดดูและพิมพ์ A4 / ดาวน์โหลด PDF"
                                                            >
                                                                <Printer size={11} />
                                                                <span>A4</span>
                                                            </button>

                                                            <button
                                                                onClick={() => {
                                                                    setPrintModalInitialEmail(true);
                                                                    setActivePrintInvoice(inv);
                                                                }}
                                                                className="px-1.5 py-1 bg-blue-700 hover:bg-blue-600 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer"
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
                                                <td colSpan={9} className="p-12 text-center text-[var(--color-muted)] font-mono">
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
                        key={expensesKey}
                        monthlyPosRevenue={currentMonthPosRevenue}
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
                    onSaveSuccess={() => {
                        setShowExpenseModal(false);
                        setEditingExpense(null);
                        setActiveTab('expenses');
                        setExpensesKey(k => k + 1);
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
                />
            )}

            {/* 4. Document Cancellation Confirmation Modal */}
            {cancellationTarget && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 font-sans text-xs">
                    <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] w-full max-w-md p-6 space-y-4 shadow-2xl">
                        <div className="border-b border-[var(--color-rule)] pb-3 flex items-center gap-2 text-red-600">
                            <ShieldAlert size={18} />
                            <h3 className="font-mono font-bold text-sm text-[var(--color-ink)] uppercase">
                                CONFIRM DOCUMENT VOID // {cancellationTarget.invoice_number}
                            </h3>
                        </div>

                        <p className="text-[12px] text-[var(--color-neutral)] leading-relaxed">
                            การยกเลิกเอกสารนี้จะถูกบันทึกประวัติการยกเลิกในระบบ และสถานะจะเปลี่ยนเป็น [VOID] ทันที
                        </p>

                        <div>
                            <label className="font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--color-neutral)] block mb-1">
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
                                        className={`px-2 py-0.5 border text-[10px] font-mono transition-colors cursor-pointer ${
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

                        <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-rule)] font-mono text-xs">
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
                                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
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
