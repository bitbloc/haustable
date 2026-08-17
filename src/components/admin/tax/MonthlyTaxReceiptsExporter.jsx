/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    X, 
    Printer, 
    Download, 
    Sparkles, 
    Crop, 
    CheckSquare, 
    Square, 
    Filter, 
    Sliders, 
    RotateCcw, 
    FileSpreadsheet, 
    Check, 
    AlertCircle, 
    Search,
    Layers,
    Eye,
    Maximize2,
    Settings,
    FileText
} from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { EXPENSE_CATEGORIES } from '../../../utils/expenseConstants';
import { parseReceiptUrls } from '../../../utils/receiptImageHelper';
import { 
    applyDocumentEnhancement, 
    detectReceiptCropBounds, 
    downloadFile,
    ENHANCEMENT_PRESETS 
} from '../../../utils/receiptImageProcessor';
import { downloadCsvFile, formatTaxId } from '../../../utils/thaiTaxHelper';
import { toast } from 'sonner';

// Subcomponents
import ReceiptImageEnhancerModal from './ReceiptImageEnhancerModal';
import MonthlyTaxPrintView from './MonthlyTaxPrintView';

export default function MonthlyTaxReceiptsExporter({
    initialMonth = null,
    companySettings = {},
    onClose
}) {
    // Current Period Month (YYYY-MM)
    const [selectedMonth, setSelectedMonth] = useState(() => {
        if (initialMonth) return initialMonth;
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    });

    // Expenses Data
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);

    // Selected items for export (Set of expense IDs)
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Enhanced Images Cache: { [expenseId]: { enhancedDataUrl, options } }
    const [enhancedCache, setEnhancedCache] = useState({});

    // Filter controls
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [gradeFilter, setGradeFilter] = useState('all');
    const [hasPhotoOnly, setHasPhotoOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Print & Layout Configuration
    const [layoutMode, setLayoutMode] = useState('2up'); // '2up' | '4up' | '1up' | 'cover_only'
    const [includeCover, setIncludeCover] = useState(true);
    const [showPrintModal, setShowPrintModal] = useState(false);

    // Single Tuning Modal
    const [tuningItem, setTuningItem] = useState(null);

    // Batch Processing Progress
    const [batchProcessing, setBatchProcessing] = useState(false);
    const [batchProgress, setBatchProgress] = useState(0);

    // 1. Fetch Expenses for Selected Month
    const fetchMonthExpenses = useCallback(async () => {
        setLoading(true);
        try {
            const startIso = `${selectedMonth}-01`;
            const [y, m] = selectedMonth.split('-');
            const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
            const endIso = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

            const { data, error } = await supabase
                .from('store_expenses')
                .select('*')
                .gte('expense_date', startIso)
                .lte('expense_date', endIso)
                .order('expense_date', { ascending: true });

            if (!error && data) {
                setExpenses(data);
                // Auto-select all items by default
                setSelectedIds(new Set(data.map(d => d.id)));
            } else {
                // Fallback to local storage
                const local = localStorage.getItem('onhaus_store_expenses');
                if (local) {
                    const parsed = JSON.parse(local);
                    const filtered = parsed.filter(e => (e.expense_date || '').startsWith(selectedMonth));
                    setExpenses(filtered);
                    setSelectedIds(new Set(filtered.map(d => d.id)));
                }
            }
        } catch {
            const local = localStorage.getItem('onhaus_store_expenses');
            if (local) {
                const parsed = JSON.parse(local);
                const filtered = parsed.filter(e => (e.expense_date || '').startsWith(selectedMonth));
                setExpenses(filtered);
                setSelectedIds(new Set(filtered.map(d => d.id)));
            }
        } finally {
            setLoading(false);
        }
    }, [selectedMonth]);

    useEffect(() => {
        fetchMonthExpenses();
    }, [fetchMonthExpenses]);

    // 2. Filtered Expenses
    const filteredExpenses = useMemo(() => {
        return expenses.filter(exp => {
            if (hasPhotoOnly && !exp.receipt_image_url) return false;
            if (categoryFilter !== 'all' && exp.category !== categoryFilter) return false;
            if (gradeFilter !== 'all') {
                if (gradeFilter === 'A' && exp.doc_type !== 'tax_invoice') return false;
                if (gradeFilter === 'B' && exp.doc_type !== 'cash_bill') return false;
                if (gradeFilter === 'C' && exp.doc_type !== 'receipt_voucher' && exp.doc_type !== 'slip_only') return false;
            }
            const q = searchQuery.toLowerCase().trim();
            if (q) {
                const titleMatch = (exp.title || '').toLowerCase().includes(q);
                const vendorMatch = (exp.vendor_name || '').toLowerCase().includes(q);
                const noteMatch = (exp.notes || '').toLowerCase().includes(q);
                if (!titleMatch && !vendorMatch && !noteMatch) return false;
            }
            return true;
        });
    }, [expenses, categoryFilter, gradeFilter, hasPhotoOnly, searchQuery]);

    // List of selected expense objects (in indexed order)
    const selectedExpensesList = useMemo(() => {
        return expenses
            .filter(e => selectedIds.has(e.id))
            .map((e, idx) => ({ ...e, refNo: idx + 1 }));
    }, [expenses, selectedIds]);

    // Enhanced map mapping expenseId -> dataUrl string
    const enhancedImagesMap = useMemo(() => {
        const map = {};
        Object.entries(enhancedCache).forEach(([id, item]) => {
            if (item?.enhancedDataUrl) {
                map[id] = item.enhancedDataUrl;
            }
        });
        return map;
    }, [enhancedCache]);

    // Toggle Select One
    const toggleSelect = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    // Select All / Deselect All
    const handleSelectAll = () => {
        if (selectedIds.size === filteredExpenses.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredExpenses.map(e => e.id)));
        }
    };

    // 3. Batch Image Enhancement Function
    const handleBatchEnhance = async (presetId = 'bw_clean', autoCrop = false) => {
        const preset = ENHANCEMENT_PRESETS.find(p => p.id === presetId) || ENHANCEMENT_PRESETS[0];
        const targetExpenses = selectedExpensesList.filter(e => !!e.receipt_image_url);

        if (targetExpenses.length === 0) {
            toast.warning('ไม่พบรายการที่มีรูปภาพใบเสร็จสำหรับปรับแต่ง');
            return;
        }

        setBatchProcessing(true);
        setBatchProgress(0);
        toast.info(`กำลังประมวลผล ${targetExpenses.length} รูปภาพ (${preset.label})...`);

        try {
            const nextCache = { ...enhancedCache };
            let completed = 0;

            for (const exp of targetExpenses) {
                const urls = parseReceiptUrls(exp.receipt_image_url);
                const firstUrl = urls[0];
                if (firstUrl) {
                    let cropRect = null;
                    if (autoCrop) {
                        try {
                            cropRect = await detectReceiptCropBounds(firstUrl, 0.015);
                        } catch {
                            cropRect = null;
                        }
                    }

                    const opt = {
                        ...preset.options,
                        cropRect,
                        rotation: nextCache[exp.id]?.options?.rotation || 0
                    };

                    const result = await applyDocumentEnhancement(firstUrl, opt);
                    nextCache[exp.id] = {
                        enhancedDataUrl: result.dataUrl,
                        options: opt
                    };
                }
                completed++;
                setBatchProgress(Math.round((completed / targetExpenses.length) * 100));
            }

            setEnhancedCache(nextCache);
            toast.success(`ปรับแต่งภาพใบเสร็จ ${targetExpenses.length} รูปเรียบร้อยแล้ว`);
        } catch (err) {
            console.error('Batch enhancement error:', err);
            toast.error('เกิดข้อผิดพลาดในการปรับแต่ง: ' + err.message);
        } finally {
            setBatchProcessing(false);
        }
    };

    // Reset All Images to Raw
    const handleResetAllToRaw = () => {
        setEnhancedCache({});
        toast.info('รีเซ็ตภาพทั้งหมดเป็นรูปต้นฉบับ');
    };

    // 4. Batch Download Enhanced Images
    const handleDownloadAllImages = () => {
        const targets = selectedExpensesList.filter(e => !!(enhancedImagesMap[e.id] || e.receipt_image_url));
        if (targets.length === 0) {
            toast.warning('ไม่พบรูปภาพที่สามารถดาวน์โหลดได้');
            return;
        }

        toast.info(`กำลังเริ่มดาวน์โหลด ${targets.length} ไฟล์...`);
        targets.forEach((exp, idx) => {
            const dataUrl = enhancedImagesMap[exp.id] || exp.receipt_image_url;
            const refNo = String(idx + 1).padStart(2, '0');
            const cleanVendor = (exp.vendor_name || 'Vendor').replace(/[^a-zA-Z0-9ก-๙]/g, '_');
            const fileName = `${selectedMonth}_TAX_#${refNo}_${cleanVendor}_${Number(exp.amount || 0).toFixed(0)}.jpg`;
            
            setTimeout(() => {
                downloadFile(dataUrl, fileName);
            }, idx * 180);
        });
    };

    // 5. Export CSV Summary
    const handleExportCsv = () => {
        if (selectedExpensesList.length === 0) {
            toast.warning('ไม่พบรายการที่เลือก');
            return;
        }

        const headers = [
            'ลำดับ (No.)',
            'วันที่จ่าย (Date)',
            'รายการค่าใช้จ่าย (Title)',
            'ร้านค้า / ผู้ขาย (Vendor)',
            'เลขประจำตัวผู้เสียภาษี (Tax ID)',
            'หมวดหมู่ (Category)',
            'ระดับหลักฐานภาษี (Proof Grade)',
            'จำนวนเงิน (Amount THB)',
            'ภาษีมูลค่าเพิ่ม (VAT THB)',
            'วิธีชำระเงิน (Payment Method)',
            'หมายเหตุ (Notes)',
            'สถานะรูปภาพ (Image Status)'
        ];

        const rows = selectedExpensesList.map((exp, idx) => {
            const catLabel = EXPENSE_CATEGORIES.find(c => c.id === exp.category)?.label || exp.category;
            const hasEnhanced = !!enhancedImagesMap[exp.id];
            return [
                idx + 1,
                `"${exp.expense_date || '-'}"`,
                `"${(exp.title || '-').replace(/"/g, '""')}"`,
                `"${(exp.vendor_name || '-').replace(/"/g, '""')}"`,
                `"${exp.vendor_tax_id || '-'}"`,
                `"${catLabel}"`,
                `"${exp.doc_type || 'tax_invoice'}"`,
                Number(exp.amount || 0).toFixed(2),
                Number(exp.vat_amount || 0).toFixed(2),
                `"${exp.payment_method || 'TRANSFER'}"`,
                `"${(exp.notes || '').replace(/"/g, '""')}"`,
                hasEnhanced ? '"ENHANCED_BW"' : (exp.receipt_image_url ? '"RAW_IMAGE"' : '"NO_IMAGE"')
            ];
        });

        const totalAmount = selectedExpensesList.reduce((s, e) => s + Number(e.amount || 0), 0);
        const totalVat = selectedExpensesList.reduce((s, e) => s + Number(e.vat_amount || 0), 0);

        const summaryRow = [
            'รวมทั้งสิ้น (GRAND TOTAL)',
            '',
            '',
            '',
            '',
            '',
            `"รวม ${selectedExpensesList.length} รายการ"`,
            totalAmount.toFixed(2),
            totalVat.toFixed(2),
            '',
            '',
            ''
        ];

        const csvContent = [
            `"รายงานสรุปค่าใช้จ่ายและใบเสร็จภาษีประจำงวด (Tax Receipts Dossier) - ${selectedMonth}"`,
            headers.join(','),
            ...rows.map(r => r.join(',')),
            summaryRow.join(',')
        ].join('\r\n');

        downloadCsvFile(csvContent, `Tax_Receipts_Ledger_${selectedMonth}.csv`);
        toast.success('ดาวน์โหลดไฟล์สรุปบัญชีเรียบร้อย');
    };

    // Calculate Page count estimation
    const estimatedPages = useMemo(() => {
        const count = selectedExpensesList.length;
        const perPage = layoutMode === '4up' ? 4 : (layoutMode === '1up' ? 1 : 2);
        const slipPages = layoutMode === 'cover_only' ? 0 : Math.ceil(count / perPage);
        return (includeCover ? 1 : 0) + slipPages;
    }, [selectedExpensesList.length, layoutMode, includeCover]);

    return (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/85 backdrop-blur-xs p-2 sm:p-4 font-sans text-xs">
            <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] w-full max-w-7xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden">
                
                {/* 1. Header Toolbar */}
                <div className="bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] px-4 py-3.5 flex flex-wrap items-center justify-between font-mono gap-3">
                    <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 bg-[var(--color-ink)] text-[var(--color-paper)] font-bold text-[9px] uppercase tracking-widest">
                            TAX//EXPORTER
                        </span>
                        <div>
                            <h1 className="font-bold text-base text-[var(--color-ink)] uppercase">
                                MONTHLY TAX RECEIPTS DOSSIER WORKBENCH
                            </h1>
                            <p className="text-[11px] text-[var(--color-neutral)]">
                                รวมใบเสร็จทั้งเดือน ปรับภาพขาว-ดำ คมชัด ตัดขอบอัตโนมัติ พร้อมส่งออกพิมพ์ A4 สรรพากร/บัญชี
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Month Selector */}
                        <div className="flex items-center gap-1.5 bg-[var(--color-paper)] border border-[var(--color-rule)] px-2.5 py-1">
                            <span className="text-[10px] text-[var(--color-neutral)] font-bold">งวดเดือน:</span>
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="bg-transparent border-none font-bold text-xs focus:outline-none cursor-pointer"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleExportCsv}
                            className="px-3 py-1.5 border border-[var(--color-rule)] hover:border-[var(--color-ink)] bg-[var(--color-paper)] text-[var(--color-ink)] font-bold flex items-center gap-1.5 transition-colors cursor-pointer text-[11px]"
                            title="ดาวน์โหลด CSV สรุปรายการ"
                        >
                            <FileSpreadsheet size={13} />
                            <span>CSV</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleDownloadAllImages}
                            className="px-3 py-1.5 border border-[var(--color-rule)] hover:border-[var(--color-ink)] bg-[var(--color-paper)] text-[var(--color-ink)] font-bold flex items-center gap-1.5 transition-colors cursor-pointer text-[11px]"
                            title="ดาวน์โหลดรูปภาพทั้งหมดที่แต่งแล้ว"
                        >
                            <Download size={13} />
                            <span>DOWNLOAD IMAGES</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setShowPrintModal(true)}
                            className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold flex items-center gap-1.5 transition-colors cursor-pointer text-[11px] shadow-sm"
                        >
                            <Printer size={14} />
                            <span>🖨️ PRINT / PDF ({estimatedPages} หน้า)</span>
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 hover:bg-[var(--color-paper)] text-[var(--color-neutral)] hover:text-[var(--color-ink)] cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Batch Progress Indicator */}
                {batchProcessing && (
                    <div className="bg-amber-500 text-black px-4 py-2 font-mono text-xs flex items-center justify-between font-bold animate-pulse">
                        <span>⚡ กำลังประมวลผลภาพอัตโนมัติ (AUTO-ENHANCING RECEIPTS)... {batchProgress}%</span>
                        <div className="w-48 bg-black/20 h-2 rounded-full overflow-hidden">
                            <div className="bg-black h-full transition-all duration-150" style={{ width: `${batchProgress}%` }} />
                        </div>
                    </div>
                )}

                {/* 2. Secondary Ribbon: Batch Actions & Filter Controls */}
                <div className="bg-[var(--color-paper)] border-b border-[var(--color-rule)] p-3 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
                    
                    {/* Batch Actions Group */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-neutral)]">
                            BATCH COMMANDS:
                        </span>

                        <button
                            type="button"
                            onClick={() => handleBatchEnhance('bw_clean', false)}
                            disabled={batchProcessing}
                            className="px-3 py-1.5 bg-[var(--color-ink)] hover:bg-black text-[var(--color-paper)] font-bold flex items-center gap-1.5 cursor-pointer text-[11px]"
                            title="แปลงภาพใบเสร็จทั้งหมดที่เลือกเป็น ขาว-ดำ คมชัด"
                        >
                            <Sparkles size={13} className="text-amber-300" />
                            <span>ปรับขาว-ดำ ทุกใบ (MAGIC B&amp;W)</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleBatchEnhance('bw_clean', true)}
                            disabled={batchProcessing}
                            className="px-3 py-1.5 border border-[var(--color-rule)] hover:border-[var(--color-ink)] bg-[var(--color-paper-2)] text-[var(--color-ink)] font-bold flex items-center gap-1.5 cursor-pointer text-[11px]"
                            title="ตัดขอบโต๊ะอัตโนมัติ + ปรับขาว-ดำ ทุกใบ"
                        >
                            <Crop size={13} />
                            <span>AUTO CROP + ขาวดำ</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleResetAllToRaw}
                            className="px-2.5 py-1.5 border border-[var(--color-rule)] hover:border-[var(--color-ink)] bg-[var(--color-paper-2)] text-[var(--color-neutral)] hover:text-[var(--color-ink)] font-bold flex items-center gap-1 cursor-pointer text-[10px]"
                            title="ยกเลิกการแต่งภาพทั้งหมด"
                        >
                            <RotateCcw size={11} />
                            <span>รีเซ็ตภาพเดิม</span>
                        </button>
                    </div>

                    {/* Filter & Search Controls */}
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="px-2.5 py-1 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[11px] focus:outline-none"
                        >
                            <option value="all">ทุกหมวดหมู่</option>
                            {EXPENSE_CATEGORIES.map(c => (
                                <option key={c.id} value={c.id}>{c.label}</option>
                            ))}
                        </select>

                        <select
                            value={gradeFilter}
                            onChange={(e) => setGradeFilter(e.target.value)}
                            className="px-2.5 py-1 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[11px] focus:outline-none"
                        >
                            <option value="all">ทุกระดับหลักฐาน</option>
                            <option value="A">GRADE A (ใบกำกับภาษี)</option>
                            <option value="B">GRADE B (บิลเงินสด+สลิป)</option>
                            <option value="C">GRADE C (ใบสำคัญจ่าย)</option>
                        </select>

                        <label className="flex items-center gap-1.5 text-[11px] cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={hasPhotoOnly}
                                onChange={(e) => setHasPhotoOnly(e.target.checked)}
                                className="accent-[var(--color-ink)]"
                            />
                            <span>เฉพาะที่มีรูป ({expenses.filter(e => !!e.receipt_image_url).length})</span>
                        </label>

                        <div className="relative">
                            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                            <input
                                type="text"
                                placeholder="ค้นหาร้านค้า..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-6 pr-2 py-1 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[11px] w-36 focus:outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* 3. Main Workbench Layout: Grid of Receipts Cards */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-[var(--color-paper)] space-y-4">
                    
                    {/* Header Select All Strip */}
                    <div className="flex items-center justify-between border-b border-[var(--color-rule)] pb-2 font-mono text-xs">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                className="flex items-center gap-1.5 font-bold hover:text-[var(--color-accent)] cursor-pointer"
                            >
                                {selectedIds.size === filteredExpenses.length && filteredExpenses.length > 0 ? (
                                    <CheckSquare size={16} className="text-[var(--color-ink)]" />
                                ) : (
                                    <Square size={16} className="text-[var(--color-neutral)]" />
                                )}
                                <span>
                                    เลือกทั้งหมด ({selectedIds.size} / {filteredExpenses.length} รายการ)
                                </span>
                            </button>
                        </div>

                        <div className="flex items-center gap-4 text-[11px] text-[var(--color-neutral)]">
                            <span>
                                ยอดรวมที่เลือก: <strong className="text-[var(--color-ink)] font-bold">฿{selectedExpensesList.reduce((s, e) => s + Number(e.amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                            </span>
                            <span>
                                ปรับแต่งแล้ว: <strong className="text-emerald-700 font-bold">{Object.keys(enhancedCache).length} ใบ</strong>
                            </span>
                        </div>
                    </div>

                    {/* Receipts Cards Grid */}
                    {loading ? (
                        <div className="py-20 text-center font-mono text-xs text-[var(--color-neutral)] flex flex-col items-center gap-2">
                            <div className="w-8 h-8 rounded-full border-2 border-[var(--color-rule)] border-t-[var(--color-ink)] animate-spin" />
                            <span>กำลังโหลดรายการใบเสร็จประจำงวด {selectedMonth}...</span>
                        </div>
                    ) : filteredExpenses.length === 0 ? (
                        <div className="py-16 text-center border-2 border-dashed border-[var(--color-rule)] p-6 font-mono text-xs text-[var(--color-neutral)] space-y-2">
                            <AlertCircle size={28} className="mx-auto text-[var(--color-muted)]" />
                            <div className="font-bold text-[var(--color-ink)]">ไม่พบรายการใบเสร็จในงวดเดือน {selectedMonth}</div>
                            <p className="text-[11px] text-[var(--color-muted)]">ลองเปลี่ยนเดือน หรือบันทึกค่าใช้จ่ายใหม่ผ่านแท็บ Log Expense</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {filteredExpenses.map((exp, idx) => {
                                const isSelected = selectedIds.has(exp.id);
                                const urls = parseReceiptUrls(exp.receipt_image_url);
                                const rawUrl = urls[0];
                                const enhancedItem = enhancedCache[exp.id];
                                const displaySrc = enhancedItem?.enhancedDataUrl || rawUrl;
                                const catObj = EXPENSE_CATEGORIES.find(c => c.id === exp.category);
                                const isEnhanced = !!enhancedItem;

                                return (
                                    <div
                                        key={exp.id || idx}
                                        className={`border transition-all flex flex-col justify-between overflow-hidden font-mono ${
                                            isSelected 
                                                ? 'border-[var(--color-ink)] bg-[var(--color-paper-2)] shadow-sm' 
                                                : 'border-[var(--color-rule)] bg-[var(--color-paper)] opacity-70 hover:opacity-100'
                                        }`}
                                    >
                                        {/* Card Top Strip */}
                                        <div className="p-2.5 border-b border-[var(--color-rule)] flex items-start justify-between gap-2">
                                            <div className="flex items-start gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSelect(exp.id)}
                                                    className="mt-0.5 cursor-pointer text-[var(--color-ink)]"
                                                >
                                                    {isSelected ? <CheckSquare size={16} /> : <Square size={16} className="text-[var(--color-neutral)]" />}
                                                </button>
                                                <div>
                                                    <div className="font-bold text-xs text-[var(--color-ink)] truncate max-w-[140px]" title={exp.title}>
                                                        {exp.title}
                                                    </div>
                                                    <div className="text-[10px] text-[var(--color-muted)] truncate max-w-[140px]">
                                                        {exp.vendor_name || 'ไม่ระบุผู้ขาย'}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <span className="font-bold text-xs text-[var(--color-ink)] block">
                                                    ฿{Number(exp.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </span>
                                                <span className="text-[9px] text-[var(--color-muted)] block">
                                                    {exp.expense_date}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Card Image Viewport */}
                                        <div className="relative bg-zinc-950 flex items-center justify-center min-h-[190px] max-h-[220px] overflow-hidden p-2 group">
                                            {displaySrc ? (
                                                <img
                                                    src={displaySrc}
                                                    alt={exp.title}
                                                    className="max-w-full max-h-full object-contain transition-all duration-150"
                                                />
                                            ) : (
                                                <div className="text-zinc-500 text-[10px] text-center p-4">
                                                    [ไม่มีรูปภาพใบเสร็จ]
                                                </div>
                                            )}

                                            {/* Status Badge */}
                                            <div className="absolute top-2 left-2 flex items-center gap-1">
                                                {isEnhanced ? (
                                                    <span className="px-1.5 py-0.5 bg-emerald-800 text-white font-bold text-[8px] uppercase tracking-wider shadow-xs">
                                                        ✓ {enhancedItem.options?.mode?.toUpperCase() || 'ENHANCED'}
                                                    </span>
                                                ) : displaySrc ? (
                                                    <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 font-bold text-[8px] uppercase tracking-wider">
                                                        RAW IMAGE
                                                    </span>
                                                ) : null}
                                                {enhancedItem?.options?.cropRect && (
                                                    <span className="px-1 py-0.5 bg-amber-800 text-white text-[8px]">
                                                        CROP
                                                    </span>
                                                )}
                                            </div>

                                            {/* Quick Tune Overlay Button */}
                                            {rawUrl && (
                                                <button
                                                    type="button"
                                                    onClick={() => setTuningItem({ ...exp, initialUrl: rawUrl })}
                                                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white font-bold text-xs cursor-pointer"
                                                >
                                                    <Sliders size={14} />
                                                    <span>ปรับแต่งภาพ / CROP</span>
                                                </button>
                                            )}
                                        </div>

                                        {/* Card Footer Actions */}
                                        <div className="p-2 border-t border-[var(--color-rule)] flex items-center justify-between text-[10px] bg-[var(--color-paper)]">
                                            <span className="text-[var(--color-muted)] truncate max-w-[120px]">
                                                {catObj?.label || exp.category}
                                            </span>

                                            {rawUrl && (
                                                <button
                                                    type="button"
                                                    onClick={() => setTuningItem({ ...exp, initialUrl: rawUrl })}
                                                    className="px-2 py-1 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] font-bold flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Sliders size={11} />
                                                    <span>TUNE</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 4. Bottom Control Bar: A4 Layout & Print Configuration */}
                <div className="bg-[var(--color-paper-2)] border-t border-[var(--color-rule)] px-4 py-3.5 flex flex-wrap items-center justify-between font-mono gap-3">
                    
                    {/* Layout Format Selector */}
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[10px] font-bold text-[var(--color-neutral)] uppercase tracking-wider">
                            A4 PRINT LAYOUT:
                        </span>

                        <div className="flex border border-[var(--color-rule)] bg-[var(--color-paper)]">
                            <button
                                type="button"
                                onClick={() => setLayoutMode('2up')}
                                className={`px-3 py-1.5 transition-colors cursor-pointer text-xs ${
                                    layoutMode === '2up' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-bold' : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'
                                }`}
                            >
                                2 ใบต่อหน้า A4 (มาตรฐาน)
                            </button>
                            <button
                                type="button"
                                onClick={() => setLayoutMode('4up')}
                                className={`px-3 py-1.5 transition-colors border-l border-[var(--color-rule)] cursor-pointer text-xs ${
                                    layoutMode === '4up' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-bold' : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'
                                }`}
                            >
                                4 ใบต่อหน้า A4 (ประหยัด)
                            </button>
                            <button
                                type="button"
                                onClick={() => setLayoutMode('1up')}
                                className={`px-3 py-1.5 transition-colors border-l border-[var(--color-rule)] cursor-pointer text-xs ${
                                    layoutMode === '1up' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-bold' : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'
                                }`}
                            >
                                1 ใบเต็มหน้า (บิลยาว)
                            </button>
                            <button
                                type="button"
                                onClick={() => setLayoutMode('cover_only')}
                                className={`px-3 py-1.5 transition-colors border-l border-[var(--color-rule)] cursor-pointer text-xs ${
                                    layoutMode === 'cover_only' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-bold' : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'
                                }`}
                            >
                                เฉพาะใบปะหน้าสรุป
                            </button>
                        </div>

                        <label className="flex items-center gap-1.5 text-xs text-[var(--color-ink)] cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={includeCover}
                                onChange={(e) => setIncludeCover(e.target.checked)}
                                className="accent-[var(--color-ink)]"
                            />
                            <span>พิมพ์ใบปะหน้าสรุป (Cover Sheet)</span>
                        </label>
                    </div>

                    {/* Launch Print Preview CTA */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-[var(--color-rule)] hover:border-[var(--color-ink)] text-[var(--color-neutral)] hover:text-[var(--color-ink)] font-bold text-xs cursor-pointer"
                        >
                            CLOSE
                        </button>

                        <button
                            type="button"
                            onClick={() => setShowPrintModal(true)}
                            className="px-6 py-2 bg-[var(--color-ink)] hover:bg-black text-[var(--color-paper)] font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm"
                        >
                            <Printer size={15} />
                            <span>LAUNCH PRINT DOSSIER ({estimatedPages} PAGES)</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* SINGLE RECEIPT TUNER MODAL */}
            {tuningItem && (
                <ReceiptImageEnhancerModal
                    receiptItem={tuningItem}
                    imageUrl={tuningItem.initialUrl}
                    initialOptions={enhancedCache[tuningItem.id]?.options}
                    onSave={({ enhancedDataUrl, options }) => {
                        setEnhancedCache(prev => ({
                            ...prev,
                            [tuningItem.id]: { enhancedDataUrl, options }
                        }));
                        setTuningItem(null);
                    }}
                    onClose={() => setTuningItem(null)}
                />
            )}

            {/* A4 PRINT VIEW MODAL */}
            {showPrintModal && (
                <MonthlyTaxPrintView
                    periodMonth={selectedMonth}
                    selectedExpenses={selectedExpensesList}
                    companySettings={companySettings}
                    enhancedImagesMap={enhancedImagesMap}
                    layoutMode={layoutMode}
                    includeCover={includeCover}
                    onClose={() => setShowPrintModal(false)}
                />
            )}
        </div>
    );
}
