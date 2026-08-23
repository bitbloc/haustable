/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
    Plus, 
    Download, 
    Search, 
    Trash2, 
    Edit2, 
    X, 
    RotateCcw,
    RotateCw,
    ExternalLink,
    AlertTriangle,
    Printer,
    FileText
} from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { downloadCsvFile } from '../../../utils/thaiTaxHelper';
import { EXPENSE_CATEGORIES } from '../../../utils/expenseConstants';
import { findDuplicateClusters } from '../../../utils/duplicateDetector';
import { parseReceiptUrls } from '../../../utils/receiptImageHelper';
import MonthlyTaxReceiptsExporter from './MonthlyTaxReceiptsExporter';
import { toast } from 'sonner';

export default function ExpensesTab({ 
    onOpenCreateModal, 
    onOpenEditModal,
    monthlyPosRevenue = 0 
}) {
    const [expenses, setExpenses] = useState(() => {
        try {
            const local = localStorage.getItem('onhaus_store_expenses');
            return local ? JSON.parse(local) : [];
        } catch {
            return [];
        }
    });

    const [loading, setLoading] = useState(false);

    const [selectedMonth, setSelectedMonth] = useState(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    });

    const [isAllPeriods, setIsAllPeriods] = useState(false);
    const [showOnlyDuplicates, setShowOnlyDuplicates] = useState(false);
    const [showMonthlyExporter, setShowMonthlyExporter] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [previewImage, setPreviewImage] = useState(null);
    const [previewPageIndex, setPreviewPageIndex] = useState(0);
    const [previewRotation, setPreviewRotation] = useState(0);

    const previewUrls = useMemo(() => {
        return parseReceiptUrls(previewImage);
    }, [previewImage]);

    // Handle Escape key to close modal
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && previewImage) {
                setPreviewImage(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [previewImage]);

    const loadExpenses = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
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
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadExpenses(false);

        let debounceTimer = null;
        const debouncedReload = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                loadExpenses(true);
            }, 400);
        };

        const channel = supabase
            .channel('admin-expenses-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'store_expenses' }, debouncedReload)
            .subscribe();

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            supabase.removeChannel(channel);
        };
    }, [loadExpenses]);

    // Duplicate Detection across entire ledger
    const duplicateClusters = useMemo(() => {
        return findDuplicateClusters(expenses);
    }, [expenses]);

    const duplicateIds = useMemo(() => {
        const set = new Set();
        duplicateClusters.forEach(cluster => {
            cluster.forEach(item => set.add(item.id));
        });
        return set;
    }, [duplicateClusters]);

    // Filtered Expenses
    const filteredExpenses = useMemo(() => {
        return expenses.filter(exp => {
            if (showOnlyDuplicates && !duplicateIds.has(exp.id)) {
                return false;
            }

            const expMonth = (exp.expense_date || '').slice(0, 7);
            const matchesMonth = isAllPeriods || showOnlyDuplicates || !selectedMonth || expMonth === selectedMonth;

            const matchesCategory = categoryFilter === 'all' || exp.category === categoryFilter;

            const q = searchQuery.toLowerCase().trim();
            const matchesSearch = !q || 
                (exp.title || '').toLowerCase().includes(q) ||
                (exp.vendor_name || '').toLowerCase().includes(q) ||
                (exp.notes || '').toLowerCase().includes(q);

            return matchesMonth && matchesCategory && matchesSearch;
        });
    }, [expenses, selectedMonth, isAllPeriods, showOnlyDuplicates, duplicateIds, categoryFilter, searchQuery]);

    // Monthly Aggregates
    const monthlyStats = useMemo(() => {
        const totalExpense = filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
        
        // Category breakdown
        const byCategory = {};
        EXPENSE_CATEGORIES.forEach(c => { byCategory[c.id] = 0; });
        filteredExpenses.forEach(e => {
            const cat = e.category || 'other';
            byCategory[cat] = (byCategory[cat] || 0) + Number(e.amount || 0);
        });

        // Tax proof grade breakdown
        const gradeA = filteredExpenses.filter(e => e.doc_type === 'tax_invoice').reduce((s, e) => s + Number(e.amount || 0), 0);
        const gradeB = filteredExpenses.filter(e => e.doc_type === 'cash_bill').reduce((s, e) => s + Number(e.amount || 0), 0);
        const gradeC = filteredExpenses.filter(e => e.doc_type === 'receipt_voucher' || e.doc_type === 'slip_only').reduce((s, e) => s + Number(e.amount || 0), 0);

        // Real Net Profit
        const rawMaterialCost = byCategory['raw_material'] || 0;
        const netProfit = Number(monthlyPosRevenue || 0) - totalExpense;
        const foodCostPct = monthlyPosRevenue > 0 ? (rawMaterialCost / monthlyPosRevenue) * 100 : 0;

        return {
            totalExpense,
            byCategory,
            gradeA,
            gradeB,
            gradeC,
            rawMaterialCost,
            netProfit,
            foodCostPct,
            count: filteredExpenses.length
        };
    }, [filteredExpenses, monthlyPosRevenue]);

    // Delete Record
    const handleDelete = async (id, title) => {
        if (!confirm(`ต้องการลบรายการค่าใช้จ่าย "${title}" หรือไม่?`)) return;
        try {
            if (!String(id).startsWith('local_')) {
                await supabase.from('store_expenses').delete().eq('id', id);
            }
        } catch {
            // Local deletion
        }

        const updated = expenses.filter(e => e.id !== id);
        setExpenses(updated);
        localStorage.setItem('onhaus_store_expenses', JSON.stringify(updated));
        toast.success(`ลบรายการ ${title} แล้ว`);
    };

    // Export CSV
    const handleExportCsv = () => {
        if (filteredExpenses.length === 0) {
            toast.warning('ไม่พบข้อมูลค่าใช้จ่ายในงวดที่เลือก');
            return;
        }

        const headers = [
            'ลำดับ (No.)',
            'วันที่จ่าย (Date)',
            'รายการค่าใช้จ่าย (Title)',
            'หมวดหมู่ (Category)',
            'ร้านค้า / ผู้รับเงิน (Vendor)',
            'ชนิดเอกสาร (Doc Type)',
            'จำนวนเงิน (Amount THB)',
            'วิธีชำระเงิน (Pay Method)',
            'หมายเหตุ (Notes)',
            'มีรูปใบเสร็จ (Has Photo)'
        ];

        const rows = filteredExpenses.map((exp, idx) => {
            const catLabel = EXPENSE_CATEGORIES.find(c => c.id === exp.category)?.label || exp.category;
            return [
                idx + 1,
                `"${exp.expense_date || '-'}"`,
                `"${(exp.title || '-').replace(/"/g, '""')}"`,
                `"${catLabel}"`,
                `"${(exp.vendor_name || '-').replace(/"/g, '""')}"`,
                `"${exp.doc_type || 'tax_invoice'}"`,
                Number(exp.amount || 0).toFixed(2),
                `"${exp.payment_method || 'TRANSFER'}"`,
                `"${(exp.notes || '').replace(/"/g, '""')}"`,
                exp.receipt_image_url ? '"YES"' : '"NO"'
            ];
        });

        const summaryRow = [
            'รวมค่าใช้จ่ายทั้งสิ้น (TOTAL EXPENSES)',
            '',
            '',
            '',
            '',
            '',
            monthlyStats.totalExpense.toFixed(2),
            '',
            '',
            `"รวม ${monthlyStats.count} รายการ"`
        ];

        const periodLabel = showOnlyDuplicates ? 'DUPLICATES_ONLY' : (isAllPeriods ? 'ALL_PERIODS' : selectedMonth);
        const csvLines = [
            `"รายงานสรุปค่าใช้จ่ายและต้นทุนร้าน (Store Expenses & COGS Ledger) - ประจำงวด ${periodLabel}"`,
            headers.join(','),
            ...rows.map(r => r.join(',')),
            summaryRow.join(',')
        ];

        downloadCsvFile(csvLines.join('\r\n'), `Store_Expenses_${periodLabel}.csv`);
        toast.success('ดาวน์โหลดรายงานค่าใช้จ่ายเรียบร้อย');
    };

    return (
        <div className="space-y-6 font-sans text-[var(--color-ink)]">
            
            {/* 1. Structural Metric Grid: Rams High-Contrast Performance Readout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-[var(--color-rule)] divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-rule)] bg-[var(--color-paper)]">
                
                {/* Metric 01: Gross POS Revenue */}
                <div className="p-4 sm:p-5 flex flex-col justify-between space-y-2">
                    <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[var(--color-neutral)]">
                        [01] POS GROSS REVENUE
                    </span>
                    <div>
                        <div className="font-mono font-black text-2xl tracking-tight">
                            ฿{Number(monthlyPosRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        <span className="font-mono text-[10px] text-[var(--color-muted)] mt-0.5 block">
                            PERIOD: {isAllPeriods ? 'ALL TIME' : selectedMonth}
                        </span>
                    </div>
                </div>

                {/* Metric 02: Total Operating Expenses */}
                <div className="p-4 sm:p-5 flex flex-col justify-between space-y-2">
                    <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[var(--color-neutral)]">
                        [02] TOTAL STORE EXPENSES
                    </span>
                    <div>
                        <div className="font-mono font-black text-2xl tracking-tight text-[var(--color-accent)]">
                            ฿{monthlyStats.totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        <span className="font-mono text-[10px] text-[var(--color-muted)] mt-0.5 block">
                            {monthlyStats.count} TRANSACTIONS
                        </span>
                    </div>
                </div>

                {/* Metric 03: Real Net Profit */}
                <div className="p-4 sm:p-5 flex flex-col justify-between space-y-2 bg-[var(--color-paper-2)]">
                    <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[var(--color-neutral)]">
                        [03] REAL NET OPERATING PROFIT
                    </span>
                    <div>
                        <div className={`font-mono font-black text-2xl tracking-tight ${monthlyStats.netProfit >= 0 ? 'text-[var(--color-ink)]' : 'text-red-600'}`}>
                            ฿{monthlyStats.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        <span className="font-mono text-[10px] text-[var(--color-muted)] mt-0.5 block">
                            {monthlyStats.netProfit >= 0 ? 'PROFITABLE (+NET)' : 'DEFICIT (-NET)'}
                        </span>
                    </div>
                </div>

                {/* Metric 04: Food Cost Ratio */}
                <div className="p-4 sm:p-5 flex flex-col justify-between space-y-2 bg-[var(--color-ink)] text-[var(--color-paper)]">
                    <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[var(--color-paper)]/70">
                        [04] FOOD &amp; DRINK COGS RATIO
                    </span>
                    <div>
                        <div className="font-mono font-black text-2xl tracking-tight text-amber-300">
                            {monthlyStats.foodCostPct.toFixed(1)}%
                        </div>
                        <span className="font-mono text-[10px] text-[var(--color-paper)]/60 mt-0.5 block">
                            TARGET BENCHMARK: 30-35%
                        </span>
                    </div>
                </div>
            </div>

            {/* 2. Secondary Analytics Strip: Tax Proof Grade + Category Spread */}
            <div className="grid grid-cols-1 md:grid-cols-12 border border-[var(--color-rule)] divide-y md:divide-y-0 md:divide-x divide-[var(--color-rule)] bg-[var(--color-paper)]">
                
                {/* Proof Reliability (4 Cols) */}
                <div className="md:col-span-4 p-4 sm:p-5 space-y-3">
                    <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[var(--color-neutral)] block border-b border-[var(--color-rule)] pb-2">
                        TAX DEDUCTION PROOF GRADES
                    </span>
                    <div className="space-y-2 font-mono text-xs">
                        <div className="flex justify-between items-center py-1 border-b border-[var(--color-rule)]/60">
                            <span className="text-[var(--color-neutral)]">GRADE A (FULL TAX INV):</span>
                            <span className="font-bold">฿{monthlyStats.gradeA.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-[var(--color-rule)]/60">
                            <span className="text-[var(--color-neutral)]">GRADE B (CASH BILL + SLIP):</span>
                            <span className="font-bold">฿{monthlyStats.gradeB.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                            <span className="text-[var(--color-neutral)]">GRADE C (PAYMENT VOUCHER):</span>
                            <span className="font-bold">฿{monthlyStats.gradeC.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>

                {/* Major Categories Spread (8 Cols) */}
                <div className="md:col-span-8 p-4 sm:p-5 space-y-3 bg-[var(--color-paper-2)]">
                    <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[var(--color-neutral)] block border-b border-[var(--color-rule)] pb-2">
                        EXPENDITURE BY CATEGORY // {isAllPeriods ? 'ALL TIME' : selectedMonth}
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                        {EXPENSE_CATEGORIES.map(cat => {
                            const val = monthlyStats.byCategory[cat.id] || 0;
                            return (
                                <div key={cat.id} className="p-2 border border-[var(--color-rule)] bg-[var(--color-paper)] flex flex-col justify-between min-h-[52px]">
                                    <span className="text-[9px] text-[var(--color-muted)] truncate" title={cat.label}>
                                        {cat.label}
                                    </span>
                                    <span className={`font-bold mt-1 ${val > 0 ? 'text-[var(--color-ink)]' : 'text-gray-400'}`}>
                                        ฿{val.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* DUPLICATE AUDIT ALERT BANNER */}
            {duplicateClusters.size > 0 && (
                <div className="p-4 bg-amber-500/10 border-2 border-amber-500/40 text-amber-950 font-mono text-xs flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                        <div>
                            <div className="font-bold text-xs">
                                ตรวจพบรายการที่อาจเป็นบิลซ้ำ {duplicateClusters.size} คู่ในสมุดบัญชี (DUPLICATE DETECTED)
                            </div>
                            <div className="text-[11px] text-amber-800 mt-0.5">
                                พบรายการที่วันที่และยอดเงินตรงกัน เช่น บิล Makro ฿1,413.75 เพื่อความถูกต้องของภาษี แนะนำให้ตรวจสอบและลบรายการที่ซ้ำออก
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowOnlyDuplicates(!showOnlyDuplicates)}
                            className={`px-3 py-1.5 font-bold text-xs border border-amber-600 transition-colors cursor-pointer ${showOnlyDuplicates ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-900 hover:bg-amber-200'}`}
                        >
                            {showOnlyDuplicates ? '✓ กำลังแสดงเฉพาะบิลซ้ำ (SHOW ALL)' : '🔍 กรองดูเฉพาะบิลซ้ำ (SHOW DUPLICATES)'}
                        </button>
                    </div>
                </div>
            )}

            {/* 3. Brutalist Filter & Control Toolbar */}
            <div className="border border-[var(--color-rule)] p-3 bg-[var(--color-paper)] flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
                <div className="flex flex-wrap items-center gap-2">
                    
                    {/* Period Mode Selector */}
                    <div className="flex border border-[var(--color-rule)]">
                        <button
                            type="button"
                            onClick={() => {
                                setIsAllPeriods(false);
                                setShowOnlyDuplicates(false);
                            }}
                            className={`px-3 py-1.5 transition-colors ${!isAllPeriods && !showOnlyDuplicates ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-bold' : 'bg-[var(--color-paper-2)] text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                        >
                            BY MONTH
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setIsAllPeriods(true);
                                setShowOnlyDuplicates(false);
                            }}
                            className={`px-3 py-1.5 transition-colors border-l border-[var(--color-rule)] ${isAllPeriods && !showOnlyDuplicates ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-bold' : 'bg-[var(--color-paper-2)] text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                        >
                            ALL TIME ({expenses.length})
                        </button>
                        {duplicateClusters.size > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowOnlyDuplicates(true)}
                                className={`px-3 py-1.5 transition-colors border-l border-[var(--color-rule)] flex items-center gap-1 ${showOnlyDuplicates ? 'bg-amber-600 text-white font-bold' : 'bg-amber-100/70 text-amber-900 hover:bg-amber-200'}`}
                            >
                                <AlertTriangle size={11} />
                                <span>DUPLICATES ({duplicateIds.size})</span>
                            </button>
                        )}
                    </div>

                    {!isAllPeriods && !showOnlyDuplicates && (
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="px-3 py-1.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] font-bold text-xs focus:border-[var(--color-ink)] focus:outline-none"
                        />
                    )}

                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="px-3 py-1.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs focus:border-[var(--color-ink)] focus:outline-none"
                    >
                        <option value="all">ALL CATEGORIES</option>
                        {EXPENSE_CATEGORIES.map(c => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                    </select>

                    <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                        <input
                            type="text"
                            placeholder="FILTER VENDOR / NOTES..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-7 pr-3 py-1.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs w-48 sm:w-60 focus:border-[var(--color-ink)] focus:outline-none"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={loadExpenses}
                        disabled={loading}
                        className="px-3 py-1.5 border border-[var(--color-rule)] hover:border-[var(--color-ink)] bg-[var(--color-paper-2)] text-[var(--color-ink)] font-bold flex items-center gap-1.5 transition-colors cursor-pointer text-[11px]"
                        title="โหลดข้อมูลใหม่จากเซิร์ฟเวอร์"
                    >
                        <RotateCcw size={12} className={loading ? 'animate-spin' : ''} />
                        <span>RELOAD</span>
                    </button>

                    <button
                        onClick={handleExportCsv}
                        className="px-3 py-1.5 border border-[var(--color-rule)] hover:border-[var(--color-ink)] bg-[var(--color-paper-2)] text-[var(--color-ink)] font-bold flex items-center gap-1.5 transition-colors cursor-pointer text-[11px]"
                    >
                        <Download size={13} />
                        <span>EXPORT CSV</span>
                    </button>

                    <button
                        onClick={() => setShowMonthlyExporter(true)}
                        className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 transition-colors cursor-pointer text-[11px] shadow-sm"
                        title="เปิดระบบจัดการพิมพ์หลักฐานใบเสร็จทั้งเดือน (A4 Print / B&W Enhanced)"
                    >
                        <Printer size={13} className="text-emerald-300" />
                        <span>🧾 EXPORT TAX (พิมพ์หลักฐาน)</span>
                    </button>

                    <button
                        onClick={onOpenCreateModal}
                        className="px-4 py-1.5 bg-[var(--color-ink)] hover:bg-black text-[var(--color-paper)] font-bold flex items-center gap-1.5 transition-colors cursor-pointer text-[11px] shadow-sm"
                    >
                        <Plus size={14} />
                        <span>+ LOG EXPENSE</span>
                    </button>
                </div>
            </div>

            {/* Empty State Banner Alert if other month has records */}
            {filteredExpenses.length === 0 && expenses.length > 0 && !isAllPeriods && !showOnlyDuplicates && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 font-mono text-xs flex items-center justify-between">
                    <span>
                        ⚠️ ไม่พบรายการในงวด [{selectedMonth}] แต่พบ <strong>{expenses.length} รายการในงวดอื่น</strong>
                    </span>
                    <button
                        type="button"
                        onClick={() => setIsAllPeriods(true)}
                        className="px-3 py-1 bg-amber-900 text-white font-bold rounded text-[11px] cursor-pointer hover:bg-black"
                    >
                        ดูรายการทั้งหมด (VIEW ALL) &rarr;
                    </button>
                </div>
            )}

            {/* 4. Tabular Ledger Grid */}
            <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse font-mono text-xs">
                        <thead>
                            <tr className="bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] text-[10px] text-[var(--color-neutral)] tracking-wider uppercase font-bold">
                                <th className="p-3 border-r border-[var(--color-rule)] w-28">DATE</th>
                                <th className="p-3 border-r border-[var(--color-rule)] min-w-[180px]">TITLE / VENDOR</th>
                                <th className="p-3 border-r border-[var(--color-rule)] w-36">CATEGORY</th>
                                <th className="p-3 border-r border-[var(--color-rule)] w-28 text-center">PROOF GRADE</th>
                                <th className="p-3 border-r border-[var(--color-rule)] w-24 text-center">RECEIPT</th>
                                <th className="p-3 border-r border-[var(--color-rule)] w-32 text-right">AMOUNT (THB)</th>
                                <th className="p-3 w-20 text-center">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-rule)]">
                            {filteredExpenses.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center text-[var(--color-muted)] font-mono text-xs">
                                        {loading ? 'LOADING EXPENSE LEDGER...' : `NO EXPENSE RECORDS FOUND FOR PERIOD [${showOnlyDuplicates ? 'DUPLICATES' : (isAllPeriods ? 'ALL TIME' : selectedMonth)}]`}
                                    </td>
                                </tr>
                            ) : (
                                filteredExpenses.map((exp) => {
                                    const catObj = EXPENSE_CATEGORIES.find(c => c.id === exp.category);
                                    const isDuplicate = duplicateIds.has(exp.id);

                                    return (
                                        <tr key={exp.id} className={`transition-colors ${isDuplicate ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-[var(--color-paper-2)]'}`}>
                                            <td className="p-3 border-r border-[var(--color-rule)] text-[11px] text-[var(--color-neutral)]">
                                                {exp.expense_date}
                                                {isDuplicate && (
                                                    <span className="block mt-1 text-[9px] font-bold text-amber-700 bg-amber-200/80 px-1 py-0.5 border border-amber-300 w-fit">
                                                        ⚠️ DUPLICATE
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 border-r border-[var(--color-rule)]">
                                                <div className="font-sans font-bold text-xs text-[var(--color-ink)] flex items-center gap-1.5">
                                                    <span>{exp.title}</span>
                                                </div>
                                                <div className="text-[10px] text-[var(--color-muted)] flex items-center gap-2 mt-0.5">
                                                    <span>{exp.vendor_name || 'ไม่ระบุผู้ขาย'}</span>
                                                    {exp.vendor_tax_id && (
                                                        <span>• TAX: {exp.vendor_tax_id}</span>
                                                    )}
                                                </div>
                                                {exp.notes && (
                                                    <div className="text-[9px] text-[var(--color-neutral)] italic mt-0.5 truncate max-w-sm">
                                                        {exp.notes}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3 border-r border-[var(--color-rule)] text-[11px]">
                                                <span className="px-1.5 py-0.5 border border-[var(--color-rule)] bg-[var(--color-paper-2)] text-[var(--color-ink)] font-bold text-[10px]">
                                                    {catObj?.label || exp.category}
                                                </span>
                                            </td>
                                            <td className="p-3 border-r border-[var(--color-rule)] text-center text-[10px]">
                                                {exp.doc_type === 'tax_invoice' && (
                                                    <span className="text-[var(--color-ink)] font-bold">GRADE A (INV)</span>
                                                )}
                                                {exp.doc_type === 'cash_bill' && (
                                                    <span className="text-[var(--color-neutral)]">GRADE B (CASH)</span>
                                                )}
                                                {(exp.doc_type === 'receipt_voucher' || exp.doc_type === 'slip_only') && (
                                                    <span className="text-[var(--color-muted)]">GRADE C (SLIP)</span>
                                                )}
                                            </td>
                                            <td className="p-3 border-r border-[var(--color-rule)] text-center">
                                                {(() => {
                                                    const urls = parseReceiptUrls(exp.receipt_image_url);
                                                    if (urls.length === 0) {
                                                        return <span className="text-gray-300 text-[10px]">-</span>;
                                                    }
                                                    return (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setPreviewImage(exp.receipt_image_url);
                                                                setPreviewPageIndex(0);
                                                                setPreviewRotation(0);
                                                            }}
                                                            className="px-2 py-0.5 border border-[var(--color-rule)] hover:border-[var(--color-ink)] text-[10px] font-bold cursor-pointer inline-flex items-center gap-1 bg-white"
                                                        >
                                                            VIEW
                                                            {urls.length > 1 && (
                                                                <span className="bg-[var(--color-ink)] text-white text-[8px] px-1 py-0.2 rounded-xs font-mono">
                                                                    {urls.length}P
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })()}
                                            </td>
                                            <td className="p-3 border-r border-[var(--color-rule)] text-right font-black text-xs text-[var(--color-ink)]">
                                                ฿{Number(exp.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                {exp.vat_included && (
                                                    <div className="text-[9px] text-[var(--color-muted)] font-normal">
                                                        VAT: ฿{Number(exp.vat_amount || 0).toFixed(2)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => onOpenEditModal(exp)}
                                                        className="p-1 hover:text-[var(--color-ink)] text-[var(--color-neutral)] cursor-pointer"
                                                        title="แก้ไข"
                                                    >
                                                        <Edit2 size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(exp.id, exp.title)}
                                                        className="p-1 hover:text-red-600 text-[var(--color-neutral)] cursor-pointer"
                                                        title="ลบ"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* LIGHTBOX MODAL */}
            {previewImage && previewUrls.length > 0 && (
                <div 
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4"
                    onClick={() => setPreviewImage(null)}
                >
                    <div 
                        className="relative max-w-4xl w-full max-h-[92vh] flex flex-col border border-white/20 bg-black overflow-hidden shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-3 bg-zinc-900 text-white flex justify-between items-center font-mono text-xs border-b border-zinc-800">
                            <div className="flex items-center gap-3">
                                <span>RECEIPT OPTICAL INSPECTOR</span>
                                {previewUrls.length > 1 && (
                                    <span className="bg-zinc-800 text-emerald-400 px-2 py-0.5 text-[10px] font-bold border border-zinc-700">
                                        PAGE {previewPageIndex + 1} OF {previewUrls.length}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPreviewRotation(prev => (prev + 90) % 360)}
                                    className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-[11px] font-mono font-bold flex items-center gap-1 border border-zinc-700 cursor-pointer"
                                    title="หมุน 90 องศา"
                                >
                                    <RotateCw size={12} />
                                    <span>หมุน 90°</span>
                                </button>
                                <button onClick={() => setPreviewImage(null)} className="text-white hover:text-red-400 p-1 cursor-pointer">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-4 flex items-center justify-center relative min-h-[400px]">
                            <img 
                                src={previewUrls[previewPageIndex] || previewUrls[0]} 
                                alt={`Receipt Page ${previewPageIndex + 1}`} 
                                className="max-w-full max-h-[75vh] object-contain transition-all duration-200" 
                                style={{ transform: previewRotation ? `rotate(${previewRotation}deg)` : 'none' }}
                            />

                            {/* Previous Button */}
                            {previewUrls.length > 1 && previewPageIndex > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPreviewPageIndex(prev => Math.max(0, prev - 1));
                                        setPreviewRotation(0);
                                    }}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/80 hover:bg-zinc-800 text-white px-3 py-2 border border-white/20 font-mono text-xs cursor-pointer shadow-lg"
                                >
                                    ◀ PREV
                                </button>
                            )}

                            {/* Next Button */}
                            {previewUrls.length > 1 && previewPageIndex < previewUrls.length - 1 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPreviewPageIndex(prev => Math.min(previewUrls.length - 1, prev + 1));
                                        setPreviewRotation(0);
                                    }}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/80 hover:bg-zinc-800 text-white px-3 py-2 border border-white/20 font-mono text-xs cursor-pointer shadow-lg"
                                >
                                    NEXT ▶
                                </button>
                            )}
                        </div>

                        {/* Thumbnail Navigation Bar */}
                        {previewUrls.length > 1 && (
                            <div className="p-2 bg-zinc-950 border-t border-zinc-800 flex items-center justify-center gap-2 overflow-x-auto">
                                {previewUrls.map((url, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => {
                                            setPreviewPageIndex(idx);
                                            setPreviewRotation(0);
                                        }}
                                        className={`w-12 h-12 border transition-all cursor-pointer overflow-hidden p-0.5 ${
                                            previewPageIndex === idx
                                                ? 'border-emerald-400 ring-2 ring-emerald-500/50 scale-105'
                                                : 'border-zinc-700 opacity-60 hover:opacity-100'
                                        }`}
                                    >
                                        <img src={url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MONTHLY TAX RECEIPTS EXPORTER WORKBENCH */}
            {showMonthlyExporter && (
                <MonthlyTaxReceiptsExporter
                    initialMonth={isAllPeriods ? null : selectedMonth}
                    onClose={() => {
                        setShowMonthlyExporter(false);
                        loadExpenses();
                    }}
                />
            )}
        </div>
    );
}
