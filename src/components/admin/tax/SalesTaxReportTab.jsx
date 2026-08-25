/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useMemo } from 'react';
import { 
    FileSpreadsheet, 
    Download, 
    Printer, 
    Search, 
    TrendingUp, 
    ShieldAlert, 
    CheckCircle2, 
    Calendar,
    Filter,
    ArrowUpRight,
    Info,
    Receipt,
    FileText,
    Layers,
    CreditCard,
    Coins,
    QrCode,
    Loader2,
    Clock,
    Sparkles
} from 'lucide-react';
import { 
    formatTaxId, 
    formatBranch, 
    exportUnifiedSalesLedgerCsv, 
    downloadCsvFile,
    thaiBahtText 
} from '../../../utils/thaiTaxHelper';
import SalesTaxLedgerPrintView from './SalesTaxLedgerPrintView';
import { toast } from 'sonner';

const VAT_THRESHOLD_ANNUAL = 1800000; // 1.8 Million THB per Revenue Code

export default function SalesTaxReportTab({ 
    invoices = [], 
    companySettings = {}, 
    onOpenInvoice,
    allYearBookings = []
}) {
    const isVatRegistered = companySettings?.tax_is_vat_registered === 'true' || companySettings?.tax_is_vat_registered === true;

    // Time helper utilities
    const getTodayDate = () => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const getCurrentMonth = () => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    };

    const getYesterdayDate = () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // Filter & Granularity States
    const [timeFilterMode, setTimeFilterMode] = useState('month'); // 'day' | 'month' | 'all'
    const [selectedDate, setSelectedDate] = useState(getTodayDate);
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'cancelled'
    const [dataSourceMode, setDataSourceMode] = useState('all'); // 'all' | 'pos_bills' | 'invoices'
    const [showPrintModal, setShowPrintModal] = useState(false);

    // Format display string for the active period
    const activePeriodLabel = useMemo(() => {
        const monthNames = [
            'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
            'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
        ];
        if (timeFilterMode === 'day') {
            const [y, m, d] = selectedDate.split('-');
            const mIdx = parseInt(m, 10) - 1;
            const thYear = parseInt(y, 10) + 543;
            return `วันที่ ${parseInt(d, 10)} ${monthNames[mIdx] || m} ${thYear}`;
        }
        if (timeFilterMode === 'month') {
            const [year, month] = selectedMonth.split('-');
            const mIdx = parseInt(month, 10) - 1;
            const thYear = parseInt(year, 10) + 543;
            return `เดือน ${monthNames[mIdx] || month} ${thYear}`;
        }
        return 'ทุกช่วงเวลา (All Time)';
    }, [timeFilterMode, selectedDate, selectedMonth]);

    // Normalize & Compile POS Bookings matching time filter into sequential Bill items
    const compiledPosBills = useMemo(() => {
        if (!allYearBookings || allYearBookings.length === 0) return [];
        
        // Filter bookings matching the active date/month filter
        const timeFiltered = allYearBookings.filter(b => {
            const rawDate = b.booking_time || b.created_at || '';
            if (timeFilterMode === 'day') {
                return rawDate.startsWith(selectedDate);
            }
            if (timeFilterMode === 'month') {
                return rawDate.startsWith(selectedMonth);
            }
            return true; // 'all'
        });

        // Sort chronologically ascending
        timeFiltered.sort((a, b) => {
            const timeA = new Date(a.booking_time || a.created_at).getTime();
            const timeB = new Date(b.booking_time || b.created_at).getTime();
            return timeA - timeB;
        });

        // Map to structured bill records with running sequence
        const ymCompact = (selectedMonth || getCurrentMonth()).replace('-', '');
        return timeFiltered.map((b, idx) => {
            const total = Number(b.total_amount || b.total_price || 0);
            const preVat = isVatRegistered ? (total / 1.07) : total;
            const vat = isVatRegistered ? (total - preVat) : 0;
            const seqNumber = String(idx + 1).padStart(4, '0');
            const generatedBillNo = b.order_number || `BILL-${ymCompact}-${seqNumber}`;

            return {
                id: b.id,
                booking_id: b.id,
                bill_number: generatedBillNo,
                invoice_number: generatedBillNo,
                customer_name: b.customer_name || 'ลูกค้าทั่วไป (Walk-in)',
                customer_phone: b.customer_phone || '',
                customer_tax_id: b.customer_tax_id || '',
                customer_branch_type: 'head_office',
                customer_branch_code: '00000',
                issued_at: b.booking_time || b.created_at,
                created_at: b.created_at,
                pre_vat_amount: preVat,
                vat_amount: vat,
                total_amount: total,
                payment_method: b.payment_method || 'promptpay',
                status: b.status === 'cancelled' ? 'cancelled' : 'active',
                source_type: 'pos_bill'
            };
        });
    }, [allYearBookings, timeFilterMode, selectedDate, selectedMonth, isVatRegistered]);

    // Active Compiled Records based on Data Source Mode
    const activeRawRecords = useMemo(() => {
        // Filter invoices by time
        const timeFilteredInvoices = invoices.filter(inv => {
            const rawDate = inv.issued_at || inv.created_at || '';
            if (timeFilterMode === 'day') {
                return rawDate.startsWith(selectedDate);
            }
            if (timeFilterMode === 'month') {
                return rawDate.startsWith(selectedMonth);
            }
            return true;
        }).map(inv => ({ ...inv, source_type: 'tax_invoice' }));

        if (dataSourceMode === 'invoices') {
            return timeFilteredInvoices;
        } else if (dataSourceMode === 'pos_bills') {
            return compiledPosBills;
        } else {
            // Unified Mode (All POS Bills + Invoices that are standalone or linked)
            const invoiceBookingIds = new Set(timeFilteredInvoices.map(i => i.booking_id).filter(Boolean));
            const remainingBills = compiledPosBills.filter(b => !invoiceBookingIds.has(b.booking_id));

            const combined = [...timeFilteredInvoices, ...remainingBills];
            combined.sort((a, b) => {
                const timeA = new Date(a.issued_at || a.created_at).getTime();
                const timeB = new Date(b.issued_at || b.created_at).getTime();
                return timeA - timeB;
            });
            return combined;
        }
    }, [dataSourceMode, invoices, compiledPosBills, timeFilterMode, selectedDate, selectedMonth]);

    // Filter by search query and status
    const filteredRecords = useMemo(() => {
        return activeRawRecords.filter(item => {
            const q = searchQuery.toLowerCase().trim();
            const matchesSearch = !q || 
                (item.invoice_number || '').toLowerCase().includes(q) ||
                (item.bill_number || '').toLowerCase().includes(q) ||
                (item.customer_name || '').toLowerCase().includes(q) ||
                (item.customer_tax_id || '').includes(q) ||
                (item.payment_method || '').toLowerCase().includes(q);

            const matchesStatus = statusFilter === 'all' 
                ? true 
                : (statusFilter === 'active' ? item.status !== 'cancelled' : item.status === 'cancelled');

            return matchesSearch && matchesStatus;
        });
    }, [activeRawRecords, searchQuery, statusFilter]);

    // Financial Aggregate Calculations for Active Selection
    const periodStats = useMemo(() => {
        const activeOnly = filteredRecords.filter(i => i.status !== 'cancelled');
        const grossSales = activeOnly.reduce((sum, i) => sum + Number(i.total_amount || 0), 0);
        const preVatSales = activeOnly.reduce((sum, i) => sum + Number(i.pre_vat_amount || 0), 0);
        const outputVat = activeOnly.reduce((sum, i) => sum + Number(i.vat_amount || 0), 0);
        const recordCount = activeOnly.length;
        const cancelledCount = filteredRecords.filter(i => i.status === 'cancelled').length;

        return {
            grossSales,
            preVatSales: isVatRegistered ? preVatSales : grossSales,
            outputVat: isVatRegistered ? outputVat : 0,
            recordCount,
            cancelledCount
        };
    }, [filteredRecords, isVatRegistered]);

    // YTD Revenue & 1.8M Baht VAT Threshold Progress
    const ytdStats = useMemo(() => {
        const currentYear = (selectedDate || selectedMonth).split('-')[0] || String(new Date().getFullYear());
        
        // Sum from invoices and POS bookings of current year
        const yearInvoices = invoices.filter(i => 
            (i.issued_at || i.created_at || '').startsWith(currentYear) && i.status !== 'cancelled'
        );
        const totalFromInvoices = yearInvoices.reduce((sum, i) => sum + Number(i.total_amount || 0), 0);

        const yearBookings = (allYearBookings || []).filter(b => 
            (b.booking_time || b.created_at || '').startsWith(currentYear) && b.status === 'completed'
        );
        const totalFromBookings = yearBookings.reduce((sum, b) => sum + Number(b.total_amount || b.total_price || 0), 0);

        const ytdGross = Math.max(totalFromInvoices, totalFromBookings);
        const pct = Math.min(100, (ytdGross / VAT_THRESHOLD_ANNUAL) * 100);
        const remaining = Math.max(0, VAT_THRESHOLD_ANNUAL - ytdGross);
        const isNearThreshold = pct >= 80;
        const isExceeded = ytdGross >= VAT_THRESHOLD_ANNUAL;

        return {
            year: currentYear,
            ytdGross,
            pct,
            remaining,
            isNearThreshold,
            isExceeded
        };
    }, [invoices, allYearBookings, selectedDate, selectedMonth]);

    const handleExportCsv = () => {
        if (filteredRecords.length === 0) {
            toast.warning('ไม่พบข้อมูลรายการขายในช่วงเวลาที่เลือก');
            return;
        }
        const timePeriodTag = timeFilterMode === 'day' ? selectedDate : (timeFilterMode === 'month' ? selectedMonth : 'all');
        const csv = exportUnifiedSalesLedgerCsv(filteredRecords, timePeriodTag, isVatRegistered, {
            reportType: dataSourceMode
        });
        const prefix = isVatRegistered ? 'Sales_Tax_Report' : 'Sales_Bill_Ledger';
        const filename = `${prefix}_${dataSourceMode}_${timePeriodTag}.csv`;
        downloadCsvFile(csv, filename);
        toast.success(`ดาวน์โหลดรายงาน ${filename} เรียบร้อยแล้ว (พร้อมเปิดใน Excel)`);
    };

    // Helper for rendering payment method badges
    const renderPaymentBadge = (method) => {
        switch (method) {
            case 'promptpay':
                return (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-[9px] font-bold border border-blue-200">
                        <QrCode size={10} /> พร้อมเพย์
                    </span>
                );
            case 'cash':
                return (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[9px] font-bold border border-emerald-200">
                        <Coins size={10} /> เงินสด
                    </span>
                );
            case 'credit_card':
            case 'card':
                return (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-mono text-[9px] font-bold border border-purple-200">
                        <CreditCard size={10} /> บัตรเครดิต
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 font-mono text-[9px] font-medium">
                        {method ? method.toUpperCase() : 'ทั่วไป'}
                    </span>
                );
        }
    };

    return (
        <div className="space-y-6">
            {/* 1.8 Million Baht VAT Threshold Monitor (Non-VAT Advisory Tracker) */}
            {!isVatRegistered && (
                <div className="bg-white border border-[#D1D1CD] rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <div className={`p-2 rounded-xl font-mono font-bold text-xs ${ytdStats.isExceeded ? 'bg-red-100 text-red-700' : (ytdStats.isNearThreshold ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800')}`}>
                                1.8M VAT TRACKER
                            </div>
                            <div>
                                <h3 className="font-bold text-sm text-zinc-900">
                                    เกณฑ์ติดตามรายได้สะสมประจำปี {ytdStats.year} (เกณฑ์จด VAT 1.8 ล้านบาท)
                                </h3>
                                <p className="text-[11px] text-zinc-500">
                                    ตามประมวลรัษฎากร หากรายรับเกิน 1,800,000 บาท/ปี ต้องยื่นขอจดทะเบียนภาษีมูลค่าเพิ่ม (ภ.พ.20) ภายใน 30 วัน
                                </p>
                            </div>
                        </div>

                        <div className="text-right font-mono">
                            <span className="text-[10px] text-zinc-500 uppercase block">รายรับสะสมปี {ytdStats.year}</span>
                            <span className="font-black text-base text-zinc-950">
                                ฿{ytdStats.ytdGross.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-xs text-zinc-400"> / ฿1,800,000</span>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-zinc-100 rounded-full h-3 overflow-hidden border border-zinc-200">
                        <div 
                            className={`h-full transition-all duration-500 rounded-full ${ytdStats.isExceeded ? 'bg-red-600' : (ytdStats.isNearThreshold ? 'bg-amber-500' : 'bg-emerald-600')}`}
                            style={{ width: `${ytdStats.pct}%` }}
                        />
                    </div>

                    <div className="flex flex-wrap justify-between items-center text-[11px] font-mono text-zinc-600 pt-1">
                        <span>ความคืบหน้า: <strong>{ytdStats.pct.toFixed(1)}%</strong></span>
                        <span>
                            {ytdStats.isExceeded ? (
                                <strong className="text-red-600">เกินเกณฑ์แล้ว! เตรียมยื่นจด VAT (ภ.พ.20) ภายใน 30 วัน</strong>
                            ) : (
                                <span>ยังสามารถรับรายได้แบบ Non-VAT ได้อีก: <strong className="text-emerald-700">฿{ytdStats.remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                            )}
                        </span>
                    </div>
                </div>
            )}

            {/* TOP CONTROL BAR: Granular Date Filter + Data Source Switcher + Actions */}
            <div className="bg-white border border-[#D1D1CD] rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-sm">
                
                {/* ROW 1: Time Range Filters (Day, Month, All + Date Pickers) */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3">
                    
                    {/* Time Filter Mode Pill Group */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex bg-zinc-100 p-0.5 rounded-xl border border-zinc-200 text-xs font-mono">
                            <button
                                onClick={() => {
                                    setTimeFilterMode('day');
                                    setSelectedDate(getTodayDate());
                                }}
                                className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer ${timeFilterMode === 'day' ? 'bg-[#1A1A1A] text-white font-bold shadow-sm' : 'text-zinc-600 hover:text-zinc-950'}`}
                            >
                                <Clock size={12} />
                                <span>รายวัน (Day)</span>
                            </button>

                            <button
                                onClick={() => setTimeFilterMode('month')}
                                className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer ${timeFilterMode === 'month' ? 'bg-[#1A1A1A] text-white font-bold shadow-sm' : 'text-zinc-600 hover:text-zinc-950'}`}
                            >
                                <Calendar size={12} />
                                <span>รายเดือน (Month)</span>
                            </button>

                            <button
                                onClick={() => setTimeFilterMode('all')}
                                className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer ${timeFilterMode === 'all' ? 'bg-[#1A1A1A] text-white font-bold shadow-sm' : 'text-zinc-600 hover:text-zinc-950'}`}
                            >
                                <span>ทุกช่วง (All)</span>
                            </button>
                        </div>

                        {/* Granular Input depending on mode */}
                        {timeFilterMode === 'day' && (
                            <div className="flex items-center gap-1.5">
                                <div className="flex items-center gap-1.5 border border-zinc-300 rounded-xl px-2.5 py-1 bg-white">
                                    <Calendar size={14} className="text-zinc-500" />
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="text-xs font-mono font-bold text-zinc-900 focus:outline-none bg-transparent cursor-pointer"
                                    />
                                </div>
                                <button
                                    onClick={() => setSelectedDate(getTodayDate())}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${selectedDate === getTodayDate() ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-200'}`}
                                >
                                    วันนี้
                                </button>
                                <button
                                    onClick={() => setSelectedDate(getYesterdayDate())}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${selectedDate === getYesterdayDate() ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-200'}`}
                                >
                                    เมื่อวาน
                                </button>
                            </div>
                        )}

                        {timeFilterMode === 'month' && (
                            <div className="flex items-center gap-1.5">
                                <div className="flex items-center gap-1.5 border border-zinc-300 rounded-xl px-2.5 py-1 bg-white">
                                    <Calendar size={14} className="text-zinc-500" />
                                    <input
                                        type="month"
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(e.target.value)}
                                        className="text-xs font-mono font-bold text-zinc-900 focus:outline-none bg-transparent cursor-pointer"
                                    />
                                </div>
                                <button
                                    onClick={() => setSelectedMonth(getCurrentMonth())}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${selectedMonth === getCurrentMonth() ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-200'}`}
                                >
                                    เดือนนี้
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Active Period Label Tag */}
                    <div className="text-xs font-mono text-zinc-700 bg-zinc-100 px-3 py-1 rounded-xl border border-zinc-200">
                        ช่วงที่เลือก: <strong className="text-zinc-950 font-bold">{activePeriodLabel}</strong>
                    </div>
                </div>

                {/* ROW 2: Data Source Switcher, Status Filter, Search & Export Actions */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    
                    {/* Left: Source Tabs & Status */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Data Source Selector */}
                        <div className="flex bg-zinc-100 p-0.5 rounded-xl border border-zinc-200 text-xs font-mono">
                            <button
                                onClick={() => setDataSourceMode('all')}
                                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${dataSourceMode === 'all' ? 'bg-[#1A1A1A] text-white font-bold shadow-sm' : 'text-zinc-600 hover:text-zinc-950'}`}
                            >
                                <Layers size={13} />
                                <span>รวมทุกบิลขาย</span>
                            </button>
                            <button
                                onClick={() => setDataSourceMode('pos_bills')}
                                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${dataSourceMode === 'pos_bills' ? 'bg-[#1A1A1A] text-white font-bold shadow-sm' : 'text-zinc-600 hover:text-zinc-950'}`}
                            >
                                <Receipt size={13} />
                                <span>บิลขาย POS ({compiledPosBills.length})</span>
                            </button>
                            <button
                                onClick={() => setDataSourceMode('invoices')}
                                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${dataSourceMode === 'invoices' ? 'bg-[#1A1A1A] text-white font-bold shadow-sm' : 'text-zinc-600 hover:text-zinc-950'}`}
                            >
                                <FileText size={13} />
                                <span>เอกสารภาษี ({invoices.filter(i => (i.issued_at || '').startsWith(timeFilterMode === 'day' ? selectedDate : (timeFilterMode === 'month' ? selectedMonth : ''))).length})</span>
                            </button>
                        </div>

                        {/* Status Filter */}
                        <div className="flex border border-zinc-300 rounded-xl overflow-hidden text-xs font-mono">
                            <button
                                onClick={() => setStatusFilter('active')}
                                className={`px-2.5 py-1.5 transition-colors cursor-pointer ${statusFilter === 'active' ? 'bg-[#1A1A1A] text-white font-bold' : 'bg-white text-zinc-600 hover:bg-zinc-100'}`}
                            >
                                ปกติ
                            </button>
                            <button
                                onClick={() => setStatusFilter('cancelled')}
                                className={`px-2.5 py-1.5 transition-colors cursor-pointer ${statusFilter === 'cancelled' ? 'bg-[#1A1A1A] text-white font-bold' : 'bg-white text-zinc-600 hover:bg-zinc-100'}`}
                            >
                                ยกเลิก ({periodStats.cancelledCount})
                            </button>
                            <button
                                onClick={() => setStatusFilter('all')}
                                className={`px-2.5 py-1.5 transition-colors cursor-pointer ${statusFilter === 'all' ? 'bg-[#1A1A1A] text-white font-bold' : 'bg-white text-zinc-600 hover:bg-zinc-100'}`}
                            >
                                ทั้งหมด
                            </button>
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="ค้นหาเลขบิล / ลูกค้า / Tax ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8 pr-3 py-1.5 border border-zinc-300 rounded-xl text-xs font-mono w-40 sm:w-48 focus:border-zinc-900 focus:outline-none bg-white"
                            />
                        </div>
                    </div>

                    {/* Right: Export & Print Action Buttons */}
                    <div className="flex items-center gap-2 self-end lg:self-auto">
                        <button
                            onClick={handleExportCsv}
                            className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-xl font-mono font-bold text-xs flex items-center gap-1.5 border border-zinc-300 transition-colors cursor-pointer shadow-xs"
                        >
                            <FileSpreadsheet size={15} className="text-emerald-700" />
                            <span>Export Excel (.csv)</span>
                        </button>

                        <button
                            onClick={() => setShowPrintModal(true)}
                            className="px-4 py-2 bg-[#1A1A1A] hover:bg-black text-white rounded-xl font-mono font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                        >
                            <Printer size={15} className="text-emerald-400" />
                            <span>พิมพ์รายงาน / โหลด PDF</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Metric KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Gross Sales */}
                <div className="bg-white border border-[#D1D1CD] rounded-2xl p-4 shadow-sm">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                        ยอดขายรวมทั้งสิ้น (Gross Sales)
                    </span>
                    <div className="font-mono font-black text-xl text-zinc-950 mt-1">
                        ฿{periodStats.grossSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono mt-0.5 block">
                        {activePeriodLabel} ({periodStats.recordCount} รายการ)
                    </span>
                </div>

                {/* Card 2: Taxable Base */}
                <div className="bg-white border border-[#D1D1CD] rounded-2xl p-4 shadow-sm">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                        มูลค่าฐานภาษี (Taxable Base)
                    </span>
                    <div className="font-mono font-black text-xl text-zinc-950 mt-1">
                        ฿{periodStats.preVatSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono mt-0.5 block">
                        {isVatRegistered ? 'ยอดขายก่อนคิด VAT 7%' : 'ยอดขายสุทธิ (ยังไม่เข้าระบบ VAT)'}
                    </span>
                </div>

                {/* Card 3: Output VAT 7% */}
                <div className="bg-white border border-[#D1D1CD] rounded-2xl p-4 shadow-sm">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                        ภาษีขายที่ต้องนำส่ง (Output VAT 7%)
                    </span>
                    <div className={`font-mono font-black text-xl mt-1 ${isVatRegistered ? 'text-[oklch(52%_0.16_28)]' : 'text-zinc-400'}`}>
                        {isVatRegistered ? `฿${periodStats.outputVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '฿0.00 (Non-VAT)'}
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono mt-0.5 block">
                        {isVatRegistered ? 'สำหรับยื่นแบบ ภ.พ.30' : 'ยังไม่จด VAT ไม่ต้องนำส่งภาษีขาย'}
                    </span>
                </div>

                {/* Card 4: Report Classification */}
                <div className="bg-[#1A1A1A] text-white rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                    <div>
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                            แบบแสดงรายการบัญชี
                        </span>
                        <div className="font-bold text-sm text-emerald-400 mt-1">
                            {isVatRegistered ? 'แบบ ภ.พ.30 (รายงานภาษีขาย)' : 'สมุดรายรับรายบิล (Sales Ledger)'}
                        </div>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">
                        โหมด: {dataSourceMode === 'invoices' ? 'เอกสารภาษี' : (dataSourceMode === 'pos_bills' ? 'บิลขาย POS' : 'รวมทุกบิลขาย')}
                    </span>
                </div>
            </div>

            {/* Official Tabular Sales Tax & Bill Ledger */}
            <div className="bg-white border border-[#D1D1CD] rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-zinc-200 flex flex-wrap justify-between items-center bg-zinc-50/70 gap-2">
                    <div>
                        <h3 className="font-bold text-sm text-zinc-950 font-mono">
                            {isVatRegistered ? 'รายงานภาษีขาย (Sales Tax Report ภ.พ.30)' : 'สมุดรายงานยอดขายและรายรับรายบิล (Sales & Bill Ledger)'}
                        </h3>
                        <p className="text-[11px] text-zinc-500 font-mono">
                            {activePeriodLabel} • จำนวน {filteredRecords.length} รายการ (เรียงลำดับตามเวลาและเลขที่บิล)
                        </p>
                    </div>
                    <div className="text-[11px] font-mono text-zinc-600 bg-white border border-zinc-200 px-3 py-1 rounded-lg">
                        รวมทั้งสิ้น: <strong className="text-zinc-950">฿{periodStats.grossSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-zinc-100/90 border-b border-zinc-300 font-mono text-[10px] uppercase text-zinc-700">
                                <th className="p-3 w-10 text-center">ลำดับ</th>
                                <th className="p-3 w-28">วันที่ / เวลา</th>
                                <th className="p-3 w-36">เลขที่บิล / เอกสาร</th>
                                <th className="p-3">ชื่อผู้ซื้อสินค้า / ลูกค้า</th>
                                <th className="p-3 w-32">เลขผู้เสียภาษี</th>
                                <th className="p-3 w-24">ชำระเงิน</th>
                                <th className="p-3 text-right w-28">{isVatRegistered ? 'มูลค่าก่อนภาษี' : 'มูลค่าสินค้า'}</th>
                                {isVatRegistered && <th className="p-3 text-right w-24">ภาษี 7%</th>}
                                <th className="p-3 text-right w-28">รวมทั้งสิ้น</th>
                                <th className="p-3 text-center w-20">สถานะ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                            {filteredRecords.map((item, idx) => {
                                const isCancelled = item.status === 'cancelled';
                                const rawDate = item.issued_at || item.created_at || item.booking_time;
                                const dateObj = rawDate ? new Date(rawDate) : null;
                                const dateStr = dateObj ? dateObj.toLocaleDateString('th-TH') : '-';
                                const timeStr = dateObj ? dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '';
                                
                                const docNo = item.invoice_number || item.bill_number || (item.id ? `POS-${String(item.id).slice(0, 8).toUpperCase()}` : '-');

                                const preVat = Number(item.pre_vat_amount !== undefined 
                                    ? item.pre_vat_amount 
                                    : (isVatRegistered ? (Number(item.total_amount || item.total_price || 0) / 1.07) : (item.total_amount || item.total_price || 0)));
                                const vat = Number(item.vat_amount !== undefined 
                                    ? item.vat_amount 
                                    : (isVatRegistered ? (Number(item.total_amount || item.total_price || 0) - preVat) : 0));
                                const total = Number(item.total_amount !== undefined ? item.total_amount : (item.total_price || 0));

                                return (
                                    <tr 
                                        key={item.id || idx}
                                        onClick={() => {
                                            if (item.source_type === 'tax_invoice' && onOpenInvoice) {
                                                onOpenInvoice(item);
                                            }
                                        }}
                                        className={`hover:bg-zinc-50 transition-colors ${item.source_type === 'tax_invoice' ? 'cursor-pointer' : ''} ${isCancelled ? 'bg-red-50/40 text-zinc-400' : ''}`}
                                    >
                                        <td className="p-3 text-center font-mono text-zinc-400">{idx + 1}</td>
                                        <td className="p-3 font-mono">
                                            <div>{dateStr}</div>
                                            {timeStr && <div className="text-[10px] text-zinc-400">{timeStr}</div>}
                                        </td>
                                        <td className="p-3 font-mono font-bold text-zinc-900">
                                            <div className="flex items-center gap-1.5">
                                                <span>{docNo}</span>
                                                {item.source_type === 'tax_invoice' && (
                                                    <span className="px-1.5 py-0.2 rounded text-[8px] font-mono bg-blue-100 text-blue-800">
                                                        TAX
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div className="font-semibold text-zinc-900">{item.customer_name || 'ลูกค้าทั่วไป (Walk-in)'}</div>
                                            {item.notes && <div className="text-[10px] text-zinc-400 font-mono">{item.notes}</div>}
                                        </td>
                                        <td className="p-3 font-mono text-[11px]">
                                            {item.customer_tax_id ? formatTaxId(item.customer_tax_id) : <span className="text-zinc-300">-</span>}
                                        </td>
                                        <td className="p-3">
                                            {renderPaymentBadge(item.payment_method)}
                                        </td>
                                        <td className="p-3 text-right font-mono font-semibold">
                                            {isCancelled ? '0.00' : preVat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        {isVatRegistered && (
                                            <td className="p-3 text-right font-mono font-semibold text-[oklch(52%_0.16_28)]">
                                                {isCancelled ? '0.00' : vat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        )}
                                        <td className="p-3 text-right font-mono font-bold text-zinc-950">
                                            {isCancelled ? '0.00' : total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-3 text-center">
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
                                    </tr>
                                );
                            })}

                            {filteredRecords.length === 0 && (
                                <tr>
                                    <td colSpan={isVatRegistered ? 10 : 9} className="p-12 text-center text-zinc-400 font-mono">
                                        ไม่พบรายการบิลขาย/ใบกำกับภาษีในเงื่อนไขที่เลือก
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {filteredRecords.length > 0 && (
                            <tfoot>
                                <tr className="bg-zinc-900 text-white font-mono font-bold text-xs">
                                    <td colSpan={6} className="p-3 text-right">
                                        รวมทั้งสิ้น (TOTAL):
                                    </td>
                                    <td className="p-3 text-right">
                                        ฿{periodStats.preVatSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                    {isVatRegistered && (
                                        <td className="p-3 text-right text-emerald-400">
                                            ฿{periodStats.outputVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </td>
                                    )}
                                    <td className="p-3 text-right text-emerald-400 font-black">
                                        ฿{periodStats.grossSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 text-center text-[10px] text-zinc-400">
                                        {periodStats.recordCount} รายการ
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Printable A4 Modal (SalesTaxLedgerPrintView) */}
            {showPrintModal && (
                <SalesTaxLedgerPrintView
                    periodMonth={selectedMonth}
                    periodDate={selectedDate}
                    filterMode={timeFilterMode}
                    periodLabel={activePeriodLabel}
                    records={filteredRecords}
                    companySettings={companySettings}
                    isVatRegistered={isVatRegistered}
                    dataSourceMode={dataSourceMode}
                    onClose={() => setShowPrintModal(false)}
                />
            )}
        </div>
    );
}
