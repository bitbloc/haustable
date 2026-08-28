/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
    FileSpreadsheet, 
    Printer, 
    Download, 
    Search, 
    Filter, 
    CheckCircle2, 
    AlertCircle, 
    TrendingUp, 
    TrendingDown,
    Scale,
    ExternalLink,
    Calendar,
    ChevronRight,
    ArrowUpRight,
    RotateCcw,
    Sparkles,
    Eye,
    Plus,
    X,
    FileText
} from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { downloadCsvFile, thaiBahtText, formatTaxId, formatBranch } from '../../../utils/thaiTaxHelper';
import { EXPENSE_CATEGORIES, getCleanCategoryLabel } from '../../../utils/expenseConstants';
import { parseReceiptUrls } from '../../../utils/receiptImageHelper';
import CashTaxLedgerPrintView from './CashTaxLedgerPrintView';
import POSBillDetailsModal from '../../../pos/POSBillDetailsModal';
import { toast } from 'sonner';

export default function CashTaxLedgerTab({
    companySettings = {},
    allYearBookings = [],
    onOpenCreateExpense,
    onOpenCreateInvoice
}) {
    const isVatRegistered = companySettings?.tax_is_vat_registered === 'true' || companySettings?.tax_is_vat_registered === true;

    // Expenses State
    const [expenses, setExpenses] = useState(() => {
        try {
            const local = localStorage.getItem('onhaus_store_expenses');
            return local ? JSON.parse(local) : [];
        } catch {
            return [];
        }
    });
    const [loadingExpenses, setLoadingExpenses] = useState(false);

    // Filter & Period States
    const [periodMode, setPeriodMode] = useState('month'); // 'month' | 'day' | 'year' | 'all'
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    });
    const [selectedDate, setSelectedDate] = useState(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    });
    const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));
    const [auditFilter, setAuditFilter] = useState('all'); // 'all' | 'verified_only' | 'missing_receipt' | 'in_only' | 'out_only'
    const [searchQuery, setSearchQuery] = useState('');

    // Modals
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [selectedBillForDetail, setSelectedBillForDetail] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);

    // Fetch Expenses
    const loadExpenses = useCallback(async (silent = false) => {
        if (!silent) setLoadingExpenses(true);
        try {
            const { data, error } = await supabase
                .from('store_expenses')
                .select('*')
                .order('expense_date', { ascending: false });

            if (!error && data) {
                setExpenses(data);
                localStorage.setItem('onhaus_store_expenses', JSON.stringify(data));
            } else {
                const local = localStorage.getItem('onhaus_store_expenses');
                if (local) setExpenses(JSON.parse(local));
            }
        } catch {
            const local = localStorage.getItem('onhaus_store_expenses');
            if (local) setExpenses(JSON.parse(local));
        } finally {
            if (!silent) setLoadingExpenses(false);
        }
    }, []);

    useEffect(() => {
        loadExpenses(false);

        const channel = supabase
            .channel(`cash-ledger-expenses-sync-${Math.random().toString(36).substring(2, 7)}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'store_expenses' }, () => {
                loadExpenses(true);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadExpenses]);

    // Format Period Label for Header & Prints
    const activePeriodLabel = useMemo(() => {
        const monthNames = [
            'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
        ];
        if (periodMode === 'day') {
            const [y, m, d] = selectedDate.split('-');
            const mIdx = parseInt(m, 10) - 1;
            const thYear = parseInt(y, 10) + 543;
            return `ประจำวันที่ ${parseInt(d, 10)} ${monthNames[mIdx] || m} พ.ศ. ${thYear}`;
        }
        if (periodMode === 'month') {
            const [y, m] = selectedMonth.split('-');
            const mIdx = parseInt(m, 10) - 1;
            const thYear = parseInt(y, 10) + 543;
            return `ประจำเดือน ${monthNames[mIdx] || m} พ.ศ. ${thYear}`;
        }
        if (periodMode === 'year') {
            const thYear = parseInt(selectedYear, 10) + 543;
            return `ประจำปีภาษี พ.ศ. ${thYear} (ค.ศ. ${selectedYear})`;
        }
        return 'รายการทั้งหมดตลอดกาล';
    }, [periodMode, selectedDate, selectedMonth, selectedYear]);

    // 1. Process Income Items (Inflow from Bookings / POS Bills)
    const incomeItems = useMemo(() => {
        return allYearBookings
            .filter(b => {
                const s = String(b.status || '').toLowerCase();
                const ps = String(b.payment_status || '').toLowerCase();
                if (s === 'cancelled' || s === 'void' || s === 'voided' || s === 'deleted') return false;
                if (ps !== 'paid' && s !== 'completed' && s !== 'seated') return false;

                const rawDate = b.created_at || b.booking_date || '';
                if (periodMode === 'day') {
                    return rawDate.startsWith(selectedDate);
                } else if (periodMode === 'month') {
                    return rawDate.startsWith(selectedMonth);
                } else if (periodMode === 'year') {
                    return rawDate.startsWith(selectedYear);
                }
                return true;
            })
            .map(b => {
                const total = parseFloat(b.final_total_price || b.total_price || 0);
                const vatAmt = isVatRegistered ? (total * 7 / 107) : 0;
                const dateStr = (b.created_at || b.booking_date || '').slice(0, 10);
                const docNo = b.invoice_number || `POS-${String(b.id).slice(0, 8)}`;
                const desc = b.table_name || b.table_number 
                    ? `ยอดขายอาหารและเครื่องดื่ม (${b.table_name || `โต๊ะ ${b.table_number}`})` 
                    : `ยอดขาย Takeaway / Online Order`;

                return {
                    id: `rev_${b.id}`,
                    rawBooking: b,
                    date: dateStr,
                    docNo: docNo,
                    type: 'INCOME',
                    title: desc,
                    category: 'รายได้จากการขายอาหารและบริการ',
                    inAmount: total,
                    outAmount: 0,
                    vatAmount: vatAmt,
                    hasProof: !!(b.slip_url || b.payment_slip_url),
                    proofUrl: b.slip_url || b.payment_slip_url || null,
                    isDeductible: true,
                    referenceType: 'POS_BILL'
                };
            });
    }, [allYearBookings, periodMode, selectedDate, selectedMonth, selectedYear, isVatRegistered]);

    // 2. Process Expense Items (Outflow from Store Expenses / Makro / Utilities)
    const expenseItems = useMemo(() => {
        return expenses
            .filter(e => {
                const rawDate = e.expense_date || e.created_at || '';
                if (periodMode === 'day') {
                    return rawDate.startsWith(selectedDate);
                } else if (periodMode === 'month') {
                    return rawDate.startsWith(selectedMonth);
                } else if (periodMode === 'year') {
                    return rawDate.startsWith(selectedYear);
                }
                return true;
            })
            .map(e => {
                const total = parseFloat(e.amount || 0);
                const vatAmt = parseFloat(e.vat_amount || (e.has_vat ? (total * 7 / 107) : 0));
                const dateStr = (e.expense_date || e.created_at || '').slice(0, 10);
                const docNo = e.receipt_number || e.invoice_number || `EXP-${String(e.id).slice(0, 8)}`;
                const catLabel = getCleanCategoryLabel(e.category) || 'ต้นทุนสินค้าและค่าใช้จ่ายดำเนินงาน';

                return {
                    id: `exp_${e.id}`,
                    rawExpense: e,
                    date: dateStr,
                    docNo: docNo,
                    type: 'EXPENSE',
                    title: e.title || e.description || e.vendor_name || 'ค่าใช้จ่ายดำเนินงาน',
                    category: catLabel,
                    inAmount: 0,
                    outAmount: total,
                    vatAmount: vatAmt,
                    hasProof: !!(e.receipt_url || e.image_url),
                    proofUrl: e.receipt_url || e.image_url || null,
                    isDeductible: e.is_tax_deductible !== false,
                    referenceType: 'EXPENSE_DOC'
                };
            });
    }, [expenses, periodMode, selectedDate, selectedMonth, selectedYear]);

    // 3. Combined Chronological Ledger
    const combinedLedger = useMemo(() => {
        const combined = [...incomeItems, ...expenseItems];
        return combined.sort((a, b) => {
            if (a.date === b.date) {
                // Incomes first, then expenses
                return a.type === 'INCOME' ? -1 : 1;
            }
            return new Date(a.date) - new Date(b.date);
        });
    }, [incomeItems, expenseItems]);

    // 4. Filtered Ledger by Audit Filter & Search
    const filteredLedger = useMemo(() => {
        return combinedLedger.filter(item => {
            if (auditFilter === 'verified_only' && !item.hasProof) return false;
            if (auditFilter === 'missing_receipt' && item.hasProof) return false;
            if (auditFilter === 'in_only' && item.type !== 'INCOME') return false;
            if (auditFilter === 'out_only' && item.type !== 'EXPENSE') return false;

            if (searchQuery) {
                const q = searchQuery.toLowerCase().trim();
                const matchDoc = (item.docNo || '').toLowerCase().includes(q);
                const matchTitle = (item.title || '').toLowerCase().includes(q);
                const matchCat = (item.category || '').toLowerCase().includes(q);
                return matchDoc || matchTitle || matchCat;
            }
            return true;
        });
    }, [combinedLedger, auditFilter, searchQuery]);

    // 5. Totals & Tax Strategy Calculations
    const totals = useMemo(() => {
        const totalRevenue = incomeItems.reduce((s, r) => s + r.inAmount, 0);
        const totalExpense = expenseItems.reduce((s, e) => s + e.outAmount, 0);
        const deductibleExpense = expenseItems.filter(e => e.isDeductible).reduce((s, e) => s + e.outAmount, 0);
        const netProfit = totalRevenue - totalExpense;

        // Personal Income Tax Strategy Analysis (ภ.ง.ด.90/94 ม.40(8))
        const flat60Expense = totalRevenue * 0.60;
        const actualDeductible = deductibleExpense;
        const actualIsBetter = actualDeductible > flat60Expense;
        const difference = Math.abs(actualDeductible - flat60Expense);

        // VAT Summary (ภ.พ.30)
        const outputVat = incomeItems.reduce((s, r) => s + r.vatAmount, 0);
        const inputVat = expenseItems.reduce((s, e) => s + e.vatAmount, 0);
        const netVat = outputVat - inputVat;

        // Proof Verification Health
        const verifiedExpenseCount = expenseItems.filter(e => e.hasProof).length;
        const totalExpenseCount = expenseItems.length;
        const proofHealthPercent = totalExpenseCount > 0 ? Math.round((verifiedExpenseCount / totalExpenseCount) * 100) : 100;

        return {
            totalRevenue,
            totalExpense,
            deductibleExpense,
            netProfit,
            flat60Expense,
            actualDeductible,
            actualIsBetter,
            difference,
            outputVat,
            inputVat,
            netVat,
            verifiedExpenseCount,
            totalExpenseCount,
            proofHealthPercent
        };
    }, [incomeItems, expenseItems]);

    // Export CSV Handler
    const handleExportCsv = () => {
        const headers = ['ลำดับ', 'วัน/เดือน/ปี', 'เลขที่เอกสาร', 'ประเภท', 'รายการ', 'หมวดหมู่', 'รายรับ (บาท)', 'รายจ่าย (บาท)', 'VAT 7%', 'สถานะหลักฐาน'];
        const rows = filteredLedger.map((item, idx) => [
            idx + 1,
            item.date,
            `"${item.docNo}"`,
            item.type === 'INCOME' ? 'รายรับ' : 'รายจ่าย',
            `"${(item.title || '').replace(/"/g, '""')}"`,
            `"${item.category || ''}"`,
            item.inAmount ? Number(item.inAmount).toFixed(2) : '0.00',
            item.outAmount ? Number(item.outAmount).toFixed(2) : '0.00',
            item.vatAmount ? Number(item.vatAmount).toFixed(2) : '0.00',
            item.hasProof ? 'เอกสารสมบูรณ์' : 'ไม่มีหลักฐานแนบ'
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        downloadCsvFile(`รายงานเงินสดรับจ่าย_สรรพากร_${selectedMonth || 'export'}.csv`, csvContent);
    };

    return (
        <div className="space-y-6 font-sans">
            
            {/* 1. Structural Header: Dieter Rams Tabular Box */}
            <div className="border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider bg-[var(--color-ink)] text-[var(--color-paper)]">
                            REVENUE DEPT // FORM 161
                        </span>
                        <span className="font-mono text-[10px] text-[var(--color-neutral)] uppercase tracking-wider">
                            [รายงานเงินสดรับ - จ่าย ตามประกาศอธิบดีกรมสรรพากร]
                        </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-ink)] font-mono uppercase">
                        CASH &amp; TAX P&amp;L LEDGER (เปรียบเทียบรายรับ-รายจ่ายทางภาษี)
                    </h2>
                    <div className="text-xs text-[var(--color-neutral)] font-mono flex items-center gap-2 flex-wrap">
                        <span>รอบระยะเวลา: <strong className="text-[var(--color-ink)]">{activePeriodLabel}</strong></span>
                        <span>•</span>
                        <span>ผู้เสียภาษี: <strong className="text-[var(--color-ink)]">{formatTaxId(companySettings.tax_id || '0105566012341')}</strong></span>
                        <span>•</span>
                        <span>สาขา: <strong className="text-[var(--color-ink)]">{formatBranch(companySettings.branch_number || '00000', companySettings.is_head_office !== 'false')}</strong></span>
                    </div>
                </div>

                {/* Top Action CTAs */}
                <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
                    <button
                        onClick={() => loadExpenses(false)}
                        className="p-2 bg-[var(--color-paper)] hover:bg-white text-[var(--color-ink)] border border-[var(--color-rule)] transition-colors cursor-pointer"
                        title="รีเฟรชข้อมูล"
                    >
                        <RotateCcw size={14} className={loadingExpenses ? 'animate-spin' : ''} />
                    </button>

                    <button
                        onClick={handleExportCsv}
                        className="px-3 py-2 bg-[var(--color-paper)] hover:bg-white text-[var(--color-ink)] border border-[var(--color-rule)] font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                        <FileSpreadsheet size={14} className="text-emerald-700" />
                        <span>EXPORT CSV (ส่งบัญชี)</span>
                    </button>

                    <button
                        onClick={() => setShowPrintModal(true)}
                        className="px-4 py-2 bg-[var(--color-ink)] hover:bg-black text-[var(--color-paper)] font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    >
                        <Printer size={14} />
                        <span>พิมพ์ฟอร์มสรรพากร (A4 / PDF)</span>
                    </button>
                </div>
            </div>

            {/* 2. Brutalist KPI Matrix & Smart Tax Strategy Advisor */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Total Cash In (Revenue) */}
                <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] p-4 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[var(--color-neutral)] uppercase font-bold">
                        <span>TOTAL CASH IN (รายรับ)</span>
                        <TrendingUp size={15} className="text-emerald-600" />
                    </div>
                    <div className="text-2xl font-bold font-mono text-emerald-800">
                        ฿{totals.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] font-mono text-[var(--color-muted)] flex items-center justify-between">
                        <span>ยอดขาย POS &amp; จองโต๊ะ:</span>
                        <span className="font-bold text-[var(--color-ink)]">{incomeItems.length} รายการ</span>
                    </div>
                </div>

                {/* Total Cash Out (Expenses) */}
                <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] p-4 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[var(--color-neutral)] uppercase font-bold">
                        <span>TOTAL CASH OUT (รายจ่าย)</span>
                        <TrendingDown size={15} className="text-rose-600" />
                    </div>
                    <div className="text-2xl font-bold font-mono text-rose-800">
                        ฿{totals.totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] font-mono text-[var(--color-muted)] flex items-center justify-between">
                        <span>หักภาษีได้ตามจริง:</span>
                        <span className="font-bold text-rose-700">฿{totals.deductibleExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>

                {/* Net Operating Profit */}
                <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] p-4 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[var(--color-neutral)] uppercase font-bold">
                        <span>NET PROFIT (กำไรสุทธิก่อนภาษี)</span>
                        <Scale size={15} className="text-blue-600" />
                    </div>
                    <div className={`text-2xl font-bold font-mono ${totals.netProfit >= 0 ? 'text-[var(--color-ink)]' : 'text-rose-700'}`}>
                        ฿{totals.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] font-mono text-[var(--color-muted)] flex items-center justify-between">
                        <span>อัตรากำไร (Margin):</span>
                        <span className="font-bold text-[var(--color-ink)]">
                            {totals.totalRevenue > 0 ? ((totals.netProfit / totals.totalRevenue) * 100).toFixed(1) : 0}%
                        </span>
                    </div>
                </div>

                {/* Tax Optimization Advisor (ภ.ง.ด.90/94 ม.40(8)) */}
                <div className="border-2 border-amber-400 bg-amber-50/70 p-4 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-mono text-amber-900 font-bold uppercase">
                        <span className="flex items-center gap-1">
                            <Sparkles size={13} className="text-amber-600" />
                            <span>TAX ENGINE // คำแนะนำ</span>
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-amber-200 text-amber-900 font-mono font-bold">
                            ภ.ง.ด.90/94
                        </span>
                    </div>
                    <div className="text-sm font-bold font-mono text-amber-950">
                        {totals.actualIsBetter ? '✅ หักตามจริง ประหยัดกว่า' : '💡 หักเหมา 60% ประหยัดกว่า'}
                    </div>
                    <div className="text-[10px] text-amber-900 font-mono leading-tight">
                        {totals.actualIsBetter 
                            ? `รายจ่ายจริงสูงกว่าหักเหมา ฿${totals.difference.toLocaleString('en-US', { maximumFractionDigits: 0 })} ยื่นตามจริงจะลดหย่อนภาษีได้มากกว่า`
                            : `หักเหมา 60% (฿${totals.flat60Expense.toLocaleString('en-US', { maximumFractionDigits: 0 })}) สูงกว่ารายจ่ายจริง ฿${totals.difference.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                    </div>
                </div>
            </div>

            {/* 3. Secondary Metrics: VAT & Evidence Health Strip */}
            <div className="border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-3 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-rule)] font-mono text-xs">
                {/* VAT Summary */}
                <div className="px-3 py-1.5 flex items-center justify-between">
                    <div>
                        <div className="text-[10px] text-[var(--color-neutral)] uppercase">ภาษีขาย (OUTPUT VAT 7%)</div>
                        <div className="text-sm font-bold text-[var(--color-ink)]">฿{totals.outputVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] text-[var(--color-neutral)] uppercase">ภาษีซื้อ (INPUT VAT 7%)</div>
                        <div className="text-sm font-bold text-[var(--color-ink)]">฿{totals.inputVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    </div>
                </div>

                {/* Net VAT Balance */}
                <div className="px-3 py-1.5 flex items-center justify-between">
                    <div>
                        <div className="text-[10px] text-[var(--color-neutral)] uppercase">ภ.พ.30 สุทธิ (ชำระ/ขอคืน)</div>
                        <div className={`text-sm font-bold ${totals.netVat >= 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                            {totals.netVat >= 0 ? `ต้องชำระ: ฿${totals.netVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : `ขอคืนได้: ฿${Math.abs(totals.netVat).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                        </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-neutral)]">
                        {isVatRegistered ? 'VAT 7% REG' : 'NON-VAT'}
                    </span>
                </div>

                {/* Evidence Completeness Health */}
                <div className="px-3 py-1.5 flex items-center justify-between">
                    <div>
                        <div className="text-[10px] text-[var(--color-neutral)] uppercase">ความสมบูรณ์ของหลักฐานภาษี</div>
                        <div className="text-sm font-bold text-emerald-800">
                            {totals.verifiedExpenseCount}/{totals.totalExpenseCount} รายจ่าย ({totals.proofHealthPercent}%)
                        </div>
                    </div>
                    <div className="w-16 bg-[var(--color-rule)] h-2 rounded-full overflow-hidden">
                        <div 
                            className="bg-emerald-600 h-full transition-all" 
                            style={{ width: `${totals.proofHealthPercent}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* 4. Filter & Controls Bar */}
            <div className="border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-3 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
                
                {/* Granularity & Time Filter */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Period Mode Selector */}
                    <div className="flex items-center border border-[var(--color-rule)] divide-x divide-[var(--color-rule)] bg-[var(--color-paper)]">
                        <button
                            onClick={() => setPeriodMode('day')}
                            className={`px-3 py-1.5 font-bold cursor-pointer transition-colors ${periodMode === 'day' ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                        >
                            รายวัน
                        </button>
                        <button
                            onClick={() => setPeriodMode('month')}
                            className={`px-3 py-1.5 font-bold cursor-pointer transition-colors ${periodMode === 'month' ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                        >
                            รายเดือน (ภ.พ.30)
                        </button>
                        <button
                            onClick={() => setPeriodMode('year')}
                            className={`px-3 py-1.5 font-bold cursor-pointer transition-colors ${periodMode === 'year' ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                        >
                            รายปี (ภ.ง.ด.90)
                        </button>
                        <button
                            onClick={() => setPeriodMode('all')}
                            className={`px-3 py-1.5 font-bold cursor-pointer transition-colors ${periodMode === 'all' ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                        >
                            ทั้งหมด
                        </button>
                    </div>

                    {/* Dynamic Date/Month/Year Picker Input */}
                    {periodMode === 'day' && (
                        <input 
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="px-2.5 py-1.5 border border-[var(--color-rule)] bg-[var(--color-paper)] text-[var(--color-ink)] font-mono font-bold focus:outline-hidden text-xs"
                        />
                    )}
                    {periodMode === 'month' && (
                        <input 
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="px-2.5 py-1.5 border border-[var(--color-rule)] bg-[var(--color-paper)] text-[var(--color-ink)] font-mono font-bold focus:outline-hidden text-xs"
                        />
                    )}
                    {periodMode === 'year' && (
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="px-2.5 py-1.5 border border-[var(--color-rule)] bg-[var(--color-paper)] text-[var(--color-ink)] font-mono font-bold focus:outline-hidden text-xs cursor-pointer"
                        >
                            {[2024, 2025, 2026, 2027].map(y => (
                                <option key={y} value={y}>ปีภาษี {y + 543} (ค.ศ. {y})</option>
                            ))}
                        </select>
                    )}

                    {/* Audit Sub-Filters */}
                    <div className="flex items-center border border-[var(--color-rule)] divide-x divide-[var(--color-rule)] bg-[var(--color-paper)]">
                        <button
                            onClick={() => setAuditFilter('all')}
                            className={`px-2.5 py-1.5 cursor-pointer ${auditFilter === 'all' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-bold' : 'text-[var(--color-neutral)]'}`}
                        >
                            ทั้งหมด ({combinedLedger.length})
                        </button>
                        <button
                            onClick={() => setAuditFilter('in_only')}
                            className={`px-2.5 py-1.5 cursor-pointer ${auditFilter === 'in_only' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-bold' : 'text-[var(--color-neutral)]'}`}
                        >
                            เฉพาะรายรับ ({incomeItems.length})
                        </button>
                        <button
                            onClick={() => setAuditFilter('out_only')}
                            className={`px-2.5 py-1.5 cursor-pointer ${auditFilter === 'out_only' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-bold' : 'text-[var(--color-neutral)]'}`}
                        >
                            เฉพาะรายจ่าย ({expenseItems.length})
                        </button>
                        <button
                            onClick={() => setAuditFilter('missing_receipt')}
                            className={`px-2.5 py-1.5 cursor-pointer ${auditFilter === 'missing_receipt' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-bold' : 'text-amber-800'}`}
                            title="แสดงรายการที่ยังไม่มีสลิปหรือใบกำกับแนบ"
                        >
                            รอแนบหลักฐาน
                        </button>
                    </div>
                </div>

                {/* Search Box */}
                <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-[var(--color-neutral)]" />
                    <input 
                        type="text"
                        placeholder="ค้นหาเลขที่บิล / เอกสาร / รายการ..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 pr-3 py-1.5 border border-[var(--color-rule)] bg-[var(--color-paper)] text-[var(--color-ink)] font-mono text-xs w-64 focus:outline-hidden"
                    />
                </div>
            </div>

            {/* 5. Official Cash Receipts and Payments Table (Form 161) */}
            <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs divide-y divide-[var(--color-rule)]">
                        <thead className="bg-[var(--color-paper-2)] text-[var(--color-neutral)] font-bold uppercase tracking-wider text-[10px]">
                            <tr>
                                <th className="p-3 w-12 text-center">#</th>
                                <th className="p-3 w-24">วัน/เดือน/ปี</th>
                                <th className="p-3 w-32">เลขที่เอกสาร</th>
                                <th className="p-3">รายการรับ-จ่าย</th>
                                <th className="p-3 w-36">หมวดหมู่สรรพากร</th>
                                <th className="p-3 w-28 text-right text-emerald-800 font-bold">รายรับ (บาท)</th>
                                <th className="p-3 w-28 text-right text-rose-800 font-bold">รายจ่าย (บาท)</th>
                                {isVatRegistered && <th className="p-3 w-24 text-right">VAT (7%)</th>}
                                <th className="p-3 w-28 text-center">หลักฐานแนบ</th>
                                <th className="p-3 w-16 text-center">ดูบิล</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-rule)]">
                            {filteredLedger.length === 0 ? (
                                <tr>
                                    <td colSpan={isVatRegistered ? 10 : 9} className="p-10 text-center text-[var(--color-neutral)]">
                                        <div className="space-y-1">
                                            <div className="text-sm font-bold font-mono text-[var(--color-ink)]">ไม่พบรายการเงินสดรับ-จ่ายในรอบระยะเวลานี้</div>
                                            <div className="text-xs text-[var(--color-muted)]">ลองปรับเลือกช่วงวันที่หรือเงื่อนไขการค้นหาใหม่</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredLedger.map((item, idx) => (
                                    <tr key={item.id} className="hover:bg-[var(--color-paper-2)] transition-colors">
                                        <td className="p-3 text-center text-[var(--color-muted)] font-mono text-[11px]">
                                            {idx + 1}
                                        </td>
                                        <td className="p-3 font-mono text-[var(--color-ink)]">
                                            {item.date}
                                        </td>
                                        <td className="p-3 font-bold font-mono text-[var(--color-ink)]">
                                            {item.docNo}
                                        </td>
                                        <td className="p-3">
                                            <div className="font-sans font-medium text-[var(--color-ink)] flex items-center gap-2">
                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.type === 'INCOME' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                                <span className="truncate max-w-sm">{item.title}</span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-[var(--color-neutral)] text-[11px] truncate max-w-[140px]">
                                            {item.category}
                                        </td>
                                        <td className="p-3 text-right font-bold font-mono text-emerald-800">
                                            {item.inAmount > 0 ? item.inAmount.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                                        </td>
                                        <td className="p-3 text-right font-bold font-mono text-rose-800">
                                            {item.outAmount > 0 ? item.outAmount.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                                        </td>
                                        {isVatRegistered && (
                                            <td className="p-3 text-right font-mono text-[var(--color-muted)] text-[11px]">
                                                {item.vatAmount > 0 ? item.vatAmount.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                                            </td>
                                        )}
                                        <td className="p-3 text-center">
                                            {item.proofUrl ? (
                                                <button
                                                    onClick={() => setPreviewImage(item.proofUrl)}
                                                    className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 text-[11px] font-bold cursor-pointer"
                                                >
                                                    <CheckCircle2 size={13} />
                                                    <span>ดูหลักฐาน</span>
                                                </button>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[var(--color-muted)] text-[10px]">
                                                    <AlertCircle size={12} className="text-amber-500" />
                                                    <span>ไม่มีแนบ</span>
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 text-center">
                                            {item.referenceType === 'POS_BILL' && item.rawBooking && (
                                                <button
                                                    onClick={() => setSelectedBillForDetail(item.rawBooking)}
                                                    className="p-1 hover:bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] text-[11px] transition-colors cursor-pointer"
                                                    title="ดูรายละเอียดบิล POS"
                                                >
                                                    <Eye size={13} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        
                        {/* Table Footer Totals */}
                        <tfoot className="bg-[var(--color-paper-2)] font-bold text-xs border-t-2 border-[var(--color-rule)]">
                            <tr>
                                <td colSpan={5} className="p-3 text-right text-[var(--color-ink)] font-mono">
                                    รวมยอดทั้งสิ้น ({thaiBahtText(totals.netProfit)}):
                                </td>
                                <td className="p-3 text-right font-mono text-emerald-800 text-sm">
                                    ฿{totals.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-3 text-right font-mono text-rose-800 text-sm">
                                    ฿{totals.totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                                {isVatRegistered && (
                                    <td className="p-3 text-right font-mono text-[var(--color-ink)] text-xs">
                                        ฿{totals.netVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                )}
                                <td colSpan={2}></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Print View Portal Modal */}
            {showPrintModal && (
                <CashTaxLedgerPrintView
                    periodMonth={selectedMonth}
                    periodDate={selectedDate}
                    filterMode={periodMode}
                    periodLabel={activePeriodLabel}
                    records={filteredLedger}
                    totals={totals}
                    companySettings={companySettings}
                    isVatRegistered={isVatRegistered}
                    onClose={() => setShowPrintModal(false)}
                />
            )}

            {/* POS Bill Details Modal */}
            {selectedBillForDetail && (
                <POSBillDetailsModal
                    booking={selectedBillForDetail}
                    onClose={() => setSelectedBillForDetail(null)}
                />
            )}

            {/* Receipt / Slip Image Modal */}
            {previewImage && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs cursor-pointer"
                    onClick={() => setPreviewImage(null)}
                >
                    <div 
                        className="relative max-w-xl max-h-[85vh] bg-[var(--color-paper)] p-3 border border-[var(--color-rule)] shadow-2xl cursor-default"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--color-rule)]">
                            <span className="font-mono text-xs font-bold uppercase text-[var(--color-ink)]">หลักฐานการรับ-จ่ายเงิน</span>
                            <button
                                onClick={() => setPreviewImage(null)}
                                className="p-1 hover:bg-black/5 text-[var(--color-neutral)] hover:text-black cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="overflow-auto max-h-[75vh] flex items-center justify-center">
                            <img 
                                src={previewImage} 
                                alt="Tax Evidence Slip" 
                                className="max-w-full max-h-[70vh] object-contain"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
