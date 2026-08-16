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
    Calendar, 
    Building2, 
    TrendingUp, 
    AlertCircle, 
    RotateCcw,
    X,
    CheckCircle2,
    Eye,
    Trash2,
    Download,
    BookOpen
} from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { formatTaxId, formatBranch } from '../../../utils/thaiTaxHelper';
import { toast } from 'sonner';

// Sub-tabs
import SalesTaxReportTab from './SalesTaxReportTab';
import WithholdingTaxTab from './WithholdingTaxTab';
import TaxSettingsTab from './TaxSettingsTab';
import ExpensesTab from './ExpensesTab';
import TaxInvoiceModal from './TaxInvoiceModal';
import TaxInvoicePrintView from './TaxInvoicePrintView';
import ExpenseModal from './ExpenseModal';
import { ShoppingCart } from 'lucide-react';

export default function AdminTaxHub({ defaultTab = 'invoices' }) {
    const [activeTab, setActiveTab] = useState(defaultTab); // 'invoices' | 'sales_tax' | 'wht' | 'settings'
    const [loading, setLoading] = useState(false);
    
    // Invoices Ledger State
    const [invoices, setInvoices] = useState([]);
    const [allYearBookings, setAllYearBookings] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'issued' | 'cancelled'
    const [monthFilter, setMonthFilter] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    // Company Tax Settings State
    const [companySettings, setCompanySettings] = useState(() => {
        try {
            const local = localStorage.getItem('onhaus_tax_settings');
            return local ? JSON.parse(local) : {};
        } catch {
            return {};
        }
    });

    // Modals
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState(null);
    const [selectedBookingForInvoice, setSelectedBookingForInvoice] = useState(null);
    const [activePrintInvoice, setActivePrintInvoice] = useState(null);
    const [cancellationTarget, setCancellationTarget] = useState(null);
    const [cancellationReason, setCancellationReason] = useState('');

    // Expense Modals
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);

    // Calculate current month's POS completed revenue
    const currentMonthPosRevenue = React.useMemo(() => {
        const targetMonth = monthFilter || new Date().toISOString().slice(0, 7);
        return allYearBookings
            .filter(b => (b.booking_time || b.created_at || '').startsWith(targetMonth))
            .reduce((sum, b) => sum + Number(b.total_amount || b.total_price || 0), 0);
    }, [allYearBookings, monthFilter]);

    useEffect(() => {
        fetchCompanySettings();
        fetchInvoices();
        fetchYearBookings();
    }, []);

    // 1. Fetch Company Settings from Supabase app_settings
    const fetchCompanySettings = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('key, value')
                .like('key', 'tax_%');

            if (!error && data && data.length > 0) {
                const settingsMap = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
                setCompanySettings(prev => ({ ...prev, ...settingsMap }));
                localStorage.setItem('onhaus_tax_settings', JSON.stringify(settingsMap));
            }
        } catch (err) {
            console.warn('Error loading tax settings from db:', err);
        }
    };

    // 2. Fetch Invoices from Supabase & LocalStorage
    const fetchInvoices = async () => {
        setLoading(true);
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
        } finally {
            setLoading(false);
        }
    };

    // 3. Fetch Completed Bookings of Current Year (for Revenue Analysis)
    const fetchYearBookings = async () => {
        try {
            const currentYear = new Date().getFullYear();
            const { data, error } = await supabase
                .from('bookings')
                .select('id, booking_time, created_at, status, total_amount, total_price, customer_name, pickup_contact_name')
                .gte('created_at', `${currentYear}-01-01T00:00:00+07:00`)
                .eq('status', 'completed');

            if (!error && data) {
                setAllYearBookings(data);
            }
        } catch {
            // Fallback gracefully
        }
    };

    // Filter invoices in Tab 1
    const filteredInvoices = invoices.filter(inv => {
        const invMonth = (inv.issued_at || inv.created_at || '').slice(0, 7);
        const matchesMonth = !monthFilter || invMonth === monthFilter;

        const q = searchQuery.toLowerCase().trim();
        const matchesSearch = !q || 
            (inv.invoice_number || '').toLowerCase().includes(q) ||
            (inv.customer_name || '').toLowerCase().includes(q) ||
            (inv.customer_tax_id || '').includes(q);

        const matchesStatus = statusFilter === 'all' 
            ? true 
            : (statusFilter === 'issued' ? inv.status !== 'cancelled' : inv.status === 'cancelled');

        return matchesMonth && matchesSearch && matchesStatus;
    });

    const isVatRegistered = companySettings?.tax_is_vat_registered === 'true' || companySettings?.tax_is_vat_registered === true;

    // Void / Cancel Invoice
    const handleConfirmCancelInvoice = async () => {
        if (!cancellationTarget) return;
        if (!cancellationReason.trim()) {
            toast.error('กรุณาระบุเหตุผลการยกเลิกเอกสาร');
            return;
        }

        try {
            const updatedPayload = {
                status: 'cancelled',
                cancellation_reason: cancellationReason.trim()
            };

            if (!String(cancellationTarget.id).startsWith('local_')) {
                await supabase
                    .from('tax_invoices')
                    .update(updatedPayload)
                    .eq('id', cancellationTarget.id);
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
        }
    };

    return (
        <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)] p-4 sm:p-8 font-sans">
            {/* Master Workbench Container */}
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Header Banner - Dieter Rams / Thai Modern Grid */}
                <div className="bg-white border border-[var(--color-rule)] rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded font-mono text-[10px] font-bold uppercase tracking-wider bg-[oklch(52%_0.16_28)] text-white">
                                THAI TAX & INVOICE HUB
                            </span>
                            <span className="font-mono text-xs text-[var(--color-neutral)]">
                                {isVatRegistered ? 'โหมดภาษีมูลค่าเพิ่ม (VAT 7%)' : 'โหมดปกติ (Non-VAT / ออกใบเสร็จรับเงินทางการ)'}
                            </span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 font-serif">
                            ระบบภาษี & ออกใบเสร็จ / ใบกำกับภาษี
                        </h1>
                        <p className="text-xs text-[var(--color-neutral)] max-w-2xl leading-relaxed">
                            บริหารจัดการเอกสารภาษี ออกใบเสร็จรับเงิน/ใบกำกับภาษีเต็มรูปแบบ จัดทำรายงานภาษีขาย (ภ.พ.30) และภาษีหัก ณ ที่จ่าย (50 ทวิ) ตามเกณฑ์สรรพากร
                        </p>
                    </div>

                    {/* Quick CTAs */}
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        <a
                            href="/manuals/thai_tax_guide_and_system_manual.html"
                            target="_blank"
                            rel="noreferrer"
                            className="px-3.5 py-2.5 bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-300 rounded-xl font-mono font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                        >
                            <BookOpen size={15} className="text-zinc-600" />
                            <span>คู่มือภาษี & ระบบ (PDF)</span>
                        </a>

                        <button
                            onClick={() => {
                                setEditingExpense(null);
                                setShowExpenseModal(true);
                            }}
                            className="px-4 py-2.5 bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white rounded-xl font-mono font-bold text-xs flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
                        >
                            <ShoppingCart size={15} />
                            <span>+ บันทึกบิล Makro / ค่าน้ำไฟ</span>
                        </button>

                        <button
                            onClick={() => {
                                setEditingInvoice(null);
                                setSelectedBookingForInvoice(null);
                                setShowInvoiceModal(true);
                            }}
                            className="px-4 py-2.5 bg-[#1A1A1A] hover:bg-black text-white rounded-xl font-mono font-bold text-xs flex items-center gap-2 shadow-lg hover:shadow-xl transition-all cursor-pointer"
                        >
                            <Plus size={16} />
                            <span>{isVatRegistered ? 'ออกใบกำกับภาษีใหม่' : 'ออกใบเสร็จรับเงินใหม่'}</span>
                        </button>
                    </div>
                </div>

                {/* Tab Navigation Strip */}
                <div className="border-b border-[var(--color-rule)] flex flex-wrap gap-2 text-xs font-mono">
                    <button
                        onClick={() => setActiveTab('invoices')}
                        className={`px-4 py-2.5 border-b-2 font-bold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'invoices' ? 'border-[oklch(52%_0.16_28)] text-[oklch(52%_0.16_28)] bg-white/60 rounded-t-lg' : 'border-transparent text-zinc-600 hover:text-zinc-900'}`}
                    >
                        <Receipt size={15} />
                        <span>รายการเอกสารทั้งหมด ({invoices.length})</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('expenses')}
                        className={`px-4 py-2.5 border-b-2 font-bold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'expenses' ? 'border-[oklch(52%_0.16_28)] text-[oklch(52%_0.16_28)] bg-white/60 rounded-t-lg' : 'border-transparent text-zinc-600 hover:text-zinc-900'}`}
                    >
                        <ShoppingCart size={15} />
                        <span>ค่าใช้จ่ายร้าน & บิล Makro</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('sales_tax')}
                        className={`px-4 py-2.5 border-b-2 font-bold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'sales_tax' ? 'border-[oklch(52%_0.16_28)] text-[oklch(52%_0.16_28)] bg-white/60 rounded-t-lg' : 'border-transparent text-zinc-600 hover:text-zinc-900'}`}
                    >
                        <FileSpreadsheet size={15} />
                        <span>{isVatRegistered ? 'รายงานภาษีขาย (ภ.พ.30)' : 'รายงานยอดขาย & เกณฑ์ 1.8M'}</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('wht')}
                        className={`px-4 py-2.5 border-b-2 font-bold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'wht' ? 'border-[oklch(52%_0.16_28)] text-[oklch(52%_0.16_28)] bg-white/60 rounded-t-lg' : 'border-transparent text-zinc-600 hover:text-zinc-900'}`}
                    >
                        <FileText size={15} />
                        <span>ภาษีหัก ณ ที่จ่าย (50 ทวิ)</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`px-4 py-2.5 border-b-2 font-bold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'settings' ? 'border-[oklch(52%_0.16_28)] text-[oklch(52%_0.16_28)] bg-white/60 rounded-t-lg' : 'border-transparent text-zinc-600 hover:text-zinc-900'}`}
                    >
                        <Settings size={15} />
                        <span>ตั้งค่าระบบภาษี & สมุดรายชื่อ</span>
                    </button>
                </div>

                {/* TAB 1: INVOICES & RECEIPTS ARCHIVE LEDGER */}
                {activeTab === 'invoices' && (
                    <div className="space-y-6">
                        {/* Control Bar */}
                        <div className="bg-white border border-[#D1D1CD] rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
                            <div className="flex flex-wrap items-center gap-3">
                                {/* Month Filter */}
                                <div className="flex items-center gap-2">
                                    <Calendar size={16} className="text-zinc-400" />
                                    <input
                                        type="month"
                                        value={monthFilter}
                                        onChange={(e) => setMonthFilter(e.target.value)}
                                        className="px-3 py-1.5 border border-zinc-300 rounded-lg text-xs font-mono font-bold focus:border-zinc-900 focus:outline-none bg-white"
                                    />
                                </div>

                                {/* Status Filter */}
                                <div className="flex border border-zinc-300 rounded-lg overflow-hidden text-xs font-mono">
                                    <button
                                        onClick={() => setStatusFilter('all')}
                                        className={`px-3 py-1.5 transition-colors ${statusFilter === 'all' ? 'bg-[#1A1A1A] text-white font-bold' : 'bg-white text-zinc-600 hover:bg-zinc-100'}`}
                                    >
                                        ทั้งหมด
                                    </button>
                                    <button
                                        onClick={() => setStatusFilter('issued')}
                                        className={`px-3 py-1.5 transition-colors ${statusFilter === 'issued' ? 'bg-[#1A1A1A] text-white font-bold' : 'bg-white text-zinc-600 hover:bg-zinc-100'}`}
                                    >
                                        ปกติ
                                    </button>
                                    <button
                                        onClick={() => setStatusFilter('cancelled')}
                                        className={`px-3 py-1.5 transition-colors ${statusFilter === 'cancelled' ? 'bg-[#1A1A1A] text-white font-bold' : 'bg-white text-zinc-600 hover:bg-zinc-100'}`}
                                    >
                                        ยกเลิก
                                    </button>
                                </div>

                                {/* Search */}
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                    <input
                                        type="text"
                                        placeholder="ค้นหาเลขที่บิล / ชื่อลูกค้า / Tax ID..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-8 pr-3 py-1.5 border border-zinc-300 rounded-lg text-xs font-mono w-52 sm:w-72 focus:border-zinc-900 focus:outline-none bg-white"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={fetchInvoices}
                                className="px-3 py-1.5 border border-zinc-300 text-zinc-700 rounded-lg text-xs font-mono hover:bg-zinc-100 flex items-center gap-1.5 cursor-pointer"
                            >
                                <RotateCcw size={13} />
                                <span>รีเฟรช</span>
                            </button>
                        </div>

                        {/* Invoices List Table */}
                        <div className="bg-white border border-[#D1D1CD] rounded-2xl overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-zinc-100 border-b border-zinc-300 font-mono text-[10px] uppercase text-zinc-700">
                                            <th className="p-3.5 w-12 text-center">No.</th>
                                            <th className="p-3.5 w-32">วันที่ออก</th>
                                            <th className="p-3.5 w-36">เลขที่เอกสาร</th>
                                            <th className="p-3.5 w-28">ประเภท</th>
                                            <th className="p-3.5">ผู้ซื้อ / บริษัท</th>
                                            <th className="p-3.5 w-36">Tax ID (13 หลัก)</th>
                                            <th className="p-3.5 text-right w-32">ยอดรวมสุทธิ</th>
                                            <th className="p-3.5 text-center w-24">สถานะ</th>
                                            <th className="p-3.5 text-center w-36">การกระทำ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-200">
                                        {filteredInvoices.map((inv, idx) => {
                                            const isCancelled = inv.status === 'cancelled';
                                            const dateStr = inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('th-TH') : '-';
                                            const isVatDoc = inv.doc_type === 'tax_invoice';

                                            return (
                                                <tr key={inv.id || idx} className={`hover:bg-zinc-50 transition-colors ${isCancelled ? 'bg-red-50/30' : ''}`}>
                                                    <td className="p-3.5 text-center font-mono text-zinc-400">{idx + 1}</td>
                                                    <td className="p-3.5 font-mono">{dateStr}</td>
                                                    <td className="p-3.5 font-mono font-bold text-zinc-950">
                                                        {inv.invoice_number}
                                                    </td>
                                                    <td className="p-3.5 font-mono">
                                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${isVatDoc ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-zinc-100 text-zinc-800'}`}>
                                                            {isVatDoc ? 'ใบกำกับภาษี' : 'ใบเสร็จรับเงิน'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3.5">
                                                        <div className="font-semibold text-zinc-900">{inv.customer_name}</div>
                                                        <div className="text-[10px] text-zinc-400 font-mono">
                                                            {formatBranch(inv.customer_branch_type, inv.customer_branch_code)}
                                                        </div>
                                                    </td>
                                                    <td className="p-3.5 font-mono">{formatTaxId(inv.customer_tax_id)}</td>
                                                    <td className="p-3.5 text-right font-mono font-bold text-sm text-zinc-950">
                                                        ฿{Number(inv.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        {isCancelled ? (
                                                            <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-red-100 text-red-700">
                                                                ยกเลิก
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-emerald-100 text-emerald-800">
                                                                ปกติ
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                onClick={() => setActivePrintInvoice(inv)}
                                                                className="px-2.5 py-1 bg-zinc-900 hover:bg-black text-white rounded font-mono text-[11px] flex items-center gap-1 cursor-pointer"
                                                                title="ดูและพิมพ์เอกสาร A4"
                                                            >
                                                                <Printer size={13} />
                                                                <span>พิมพ์ A4</span>
                                                            </button>

                                                            {!isCancelled && (
                                                                <button
                                                                    onClick={() => setCancellationTarget(inv)}
                                                                    className="p-1 text-zinc-400 hover:text-red-600 transition-colors cursor-pointer"
                                                                    title="ยกเลิกเอกสารนี้"
                                                                >
                                                                    <X size={15} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {filteredInvoices.length === 0 && (
                                            <tr>
                                                <td colSpan={9} className="p-12 text-center text-zinc-400 font-mono">
                                                    {loading ? 'กำลังโหลดข้อมูลเอกสาร...' : 'ไม่พบรายการเอกสารในเดือนนี้'}
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

            {/* MODAL: CREATE / EDIT STORE EXPENSE */}
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
                    }}
                />
            )}

            {/* MODAL: CREATE / EDIT TAX INVOICE */}
            {showInvoiceModal && (
                <TaxInvoiceModal
                    booking={selectedBookingForInvoice}
                    existingInvoice={editingInvoice}
                    companySettings={companySettings}
                    onClose={() => {
                        setShowInvoiceModal(false);
                        setEditingInvoice(null);
                        setSelectedBookingForInvoice(null);
                    }}
                    onSaveSuccess={(savedRecord, printImmediately) => {
                        setShowInvoiceModal(false);
                        fetchInvoices();
                        if (printImmediately) {
                            setActivePrintInvoice(savedRecord);
                        }
                    }}
                />
            )}

            {/* MODAL: OFFICIAL A4 / THERMAL PRINT VIEW */}
            {activePrintInvoice && (
                <TaxInvoicePrintView
                    invoice={activePrintInvoice}
                    companySettings={companySettings}
                    onClose={() => setActivePrintInvoice(null)}
                />
            )}

            {/* MODAL: CANCEL / VOID INVOICE CONFIRMATION */}
            {cancellationTarget && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 font-sans text-xs">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-zinc-300 space-y-4">
                        <div className="flex items-center gap-3 text-red-600">
                            <AlertCircle size={24} />
                            <div>
                                <h3 className="font-bold text-sm text-zinc-950">
                                    ยืนยันการยกเลิกเอกสาร #{cancellationTarget.invoice_number}
                                </h3>
                                <p className="text-[11px] text-zinc-500 font-mono">
                                    ตามเกณฑ์กรมสรรพากร เอกสารที่ยกเลิกจะยังคงแสดงในสมุดรายงานภาษีแต่ไม่คิดยอดเงิน
                                </p>
                            </div>
                        </div>

                        <div>
                            <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                                ระบุเหตุผลการยกเลิก (Cancellation Reason) *
                            </label>
                            <textarea
                                value={cancellationReason}
                                onChange={(e) => setCancellationReason(e.target.value)}
                                placeholder="เช่น ลูกค้าขอแก้ไขข้อมูลที่อยู่ / ยกเลิกคำสั่งซื้อ"
                                rows={3}
                                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs focus:border-zinc-900 focus:outline-none"
                                autoFocus
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={() => setCancellationTarget(null)}
                                className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-lg font-mono font-bold text-xs hover:bg-zinc-100 cursor-pointer"
                            >
                                ยกเลิก (Back)
                            </button>
                            <button
                                onClick={handleConfirmCancelInvoice}
                                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-mono font-bold text-xs cursor-pointer shadow-md"
                            >
                                ยืนยันการยกเลิกเอกสาร
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
