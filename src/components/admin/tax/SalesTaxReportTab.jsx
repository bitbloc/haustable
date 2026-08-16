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
    Info
} from 'lucide-react';
import { 
    formatTaxId, 
    formatBranch, 
    exportSalesTaxReportCsv, 
    downloadCsvFile 
} from '../../../utils/thaiTaxHelper';
import { toast } from 'sonner';

const VAT_THRESHOLD_ANNUAL = 1800000; // 1.8 Million THB per Revenue Code

export default function SalesTaxReportTab({ 
    invoices = [], 
    companySettings = {}, 
    onOpenInvoice,
    allYearBookings = []
}) {
    const isVatRegistered = companySettings?.tax_is_vat_registered === 'true' || companySettings?.tax_is_vat_registered === true;

    // Filters
    const getCurrentMonth = () => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    };

    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('active'); // 'all' | 'active' | 'cancelled'

    // Filter invoices by month and query
    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            const invMonth = (inv.issued_at || inv.created_at || '').slice(0, 7);
            const matchesMonth = !selectedMonth || invMonth === selectedMonth;

            const q = searchQuery.toLowerCase().trim();
            const matchesSearch = !q || 
                (inv.invoice_number || '').toLowerCase().includes(q) ||
                (inv.customer_name || '').toLowerCase().includes(q) ||
                (inv.customer_tax_id || '').includes(q);

            const matchesStatus = statusFilter === 'all' 
                ? true 
                : (statusFilter === 'active' ? inv.status !== 'cancelled' : inv.status === 'cancelled');

            return matchesMonth && matchesSearch && matchesStatus;
        });
    }, [invoices, selectedMonth, searchQuery, statusFilter]);

    // Monthly Calculations
    const monthlyStats = useMemo(() => {
        const activeOnly = filteredInvoices.filter(i => i.status !== 'cancelled');
        const grossSales = activeOnly.reduce((sum, i) => sum + Number(i.total_amount || 0), 0);
        const preVatSales = activeOnly.reduce((sum, i) => sum + Number(i.pre_vat_amount || 0), 0);
        const outputVat = activeOnly.reduce((sum, i) => sum + Number(i.vat_amount || 0), 0);
        const invoiceCount = activeOnly.length;
        const cancelledCount = filteredInvoices.filter(i => i.status === 'cancelled').length;

        return {
            grossSales,
            preVatSales: isVatRegistered ? preVatSales : grossSales,
            outputVat: isVatRegistered ? outputVat : 0,
            invoiceCount,
            cancelledCount
        };
    }, [filteredInvoices, isVatRegistered]);

    // YTD Revenue & 1.8M Baht VAT Threshold Progress
    const ytdStats = useMemo(() => {
        const currentYear = selectedMonth.split('-')[0] || String(new Date().getFullYear());
        
        // Sum from invoices and POS bookings of current year
        const yearInvoices = invoices.filter(i => 
            (i.issued_at || i.created_at || '').startsWith(currentYear) && i.status !== 'cancelled'
        );
        const totalFromInvoices = yearInvoices.reduce((sum, i) => sum + Number(i.total_amount || 0), 0);

        const yearBookings = allYearBookings.filter(b => 
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
    }, [invoices, allYearBookings, selectedMonth]);

    const handleExportCsv = () => {
        if (filteredInvoices.length === 0) {
            toast.warning('ไม่พบข้อมูลเอกสารในเดือนที่เลือก');
            return;
        }
        const csv = exportSalesTaxReportCsv(filteredInvoices, selectedMonth, isVatRegistered);
        const filename = `Sales_Tax_Report_${selectedMonth}.csv`;
        downloadCsvFile(csv, filename);
        toast.success(`ดาวน์โหลดรายงานภาษี ${filename} เรียบร้อยแล้ว`);
    };

    const handlePrintLedger = () => {
        window.print();
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

            {/* Monthly Controls & Filters */}
            <div className="bg-white border border-[#D1D1CD] rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Month Picker */}
                    <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-zinc-500" />
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="px-3 py-1.5 border border-zinc-300 rounded-lg text-xs font-mono font-bold focus:border-zinc-900 focus:outline-none bg-white"
                        />
                    </div>

                    {/* Status Filter */}
                    <div className="flex border border-zinc-300 rounded-lg overflow-hidden text-xs font-mono">
                        <button
                            onClick={() => setStatusFilter('active')}
                            className={`px-3 py-1.5 transition-colors ${statusFilter === 'active' ? 'bg-[#1A1A1A] text-white font-bold' : 'bg-white text-zinc-600 hover:bg-zinc-100'}`}
                        >
                            ปกติ (Active)
                        </button>
                        <button
                            onClick={() => setStatusFilter('cancelled')}
                            className={`px-3 py-1.5 transition-colors ${statusFilter === 'cancelled' ? 'bg-[#1A1A1A] text-white font-bold' : 'bg-white text-zinc-600 hover:bg-zinc-100'}`}
                        >
                            ยกเลิก ({monthlyStats.cancelledCount})
                        </button>
                        <button
                            onClick={() => setStatusFilter('all')}
                            className={`px-3 py-1.5 transition-colors ${statusFilter === 'all' ? 'bg-[#1A1A1A] text-white font-bold' : 'bg-white text-zinc-600 hover:bg-zinc-100'}`}
                        >
                            ทั้งหมด
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="ค้นหาเลขที่ / ชื่อลูกค้า / Tax ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 pr-3 py-1.5 border border-zinc-300 rounded-lg text-xs font-mono w-48 sm:w-64 focus:border-zinc-900 focus:outline-none bg-white"
                        />
                    </div>
                </div>

                {/* Export & Print CTAs */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportCsv}
                        className="px-3.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg font-mono font-bold text-xs flex items-center gap-1.5 border border-zinc-300 transition-colors cursor-pointer"
                    >
                        <FileSpreadsheet size={15} />
                        <span>Export CSV / Excel</span>
                    </button>

                    <button
                        onClick={handlePrintLedger}
                        className="px-3.5 py-1.5 bg-[#1A1A1A] hover:bg-black text-white rounded-lg font-mono font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                        <Printer size={15} />
                        <span>พิมพ์สมุดรายงาน (Print Ledger)</span>
                    </button>
                </div>
            </div>

            {/* Monthly Summary Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Gross Sales */}
                <div className="bg-white border border-[#D1D1CD] rounded-xl p-4 shadow-sm">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                        ยอดขายรวมทั้งสิ้น (Gross Sales)
                    </span>
                    <div className="font-mono font-black text-xl text-zinc-950 mt-1">
                        ฿{monthlyStats.grossSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono mt-0.5 block">
                        ประจำเดือน {selectedMonth} ({monthlyStats.invoiceCount} ฉบับ)
                    </span>
                </div>

                {/* Card 2: Taxable Base */}
                <div className="bg-white border border-[#D1D1CD] rounded-xl p-4 shadow-sm">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                        มูลค่าฐานภาษี (Taxable Base)
                    </span>
                    <div className="font-mono font-black text-xl text-zinc-950 mt-1">
                        ฿{monthlyStats.preVatSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono mt-0.5 block">
                        {isVatRegistered ? 'ยอดขายก่อนคิด VAT 7%' : 'ยอดขายสุทธิ (ยังไม่เข้าระบบ VAT)'}
                    </span>
                </div>

                {/* Card 3: Output VAT 7% */}
                <div className="bg-white border border-[#D1D1CD] rounded-xl p-4 shadow-sm">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                        ภาษีขายที่ต้องนำส่ง (Output VAT 7%)
                    </span>
                    <div className={`font-mono font-black text-xl mt-1 ${isVatRegistered ? 'text-[oklch(52%_0.16_28)]' : 'text-zinc-400'}`}>
                        {isVatRegistered ? `฿${monthlyStats.outputVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '฿0.00 (Non-VAT)'}
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono mt-0.5 block">
                        {isVatRegistered ? 'สำหรับยื่นแบบ ภ.พ.30' : 'ยังไม่จด VAT ไม่ต้องนำส่งภาษีขาย'}
                    </span>
                </div>

                {/* Card 4: Status Indicator */}
                <div className="bg-[#1A1A1A] text-white rounded-xl p-4 shadow-sm flex flex-col justify-between">
                    <div>
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                            แบบแสดงรายการภาษี
                        </span>
                        <div className="font-bold text-sm text-emerald-400 mt-1">
                            {isVatRegistered ? 'แบบ ภ.พ.30 (VAT 7%)' : 'ภาษีเงินได้นิติบุคคล / บุคคลธรรมดา'}
                        </div>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">
                        ยื่นภายในวันที่ 15 ของเดือนถัดไป
                    </span>
                </div>
            </div>

            {/* Official Tabular Sales Tax Ledger */}
            <div className="bg-white border border-[#D1D1CD] rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50/50">
                    <div>
                        <h3 className="font-bold text-sm text-zinc-950 font-mono">
                            {isVatRegistered ? 'รายงานภาษีขาย (Sales Tax Report ภ.พ.30)' : 'สมุดรายงานยอดขายและรายรับ (Sales & Income Ledger)'}
                        </h3>
                        <p className="text-[11px] text-zinc-500 font-mono">
                            งวดภาษี: {selectedMonth} • จำนวน {filteredInvoices.length} รายการ
                        </p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-zinc-100 border-b border-zinc-300 font-mono text-[10px] uppercase text-zinc-700">
                                <th className="p-3 w-12 text-center">ลำดับ</th>
                                <th className="p-3 w-24">วันที่</th>
                                <th className="p-3 w-36">เลขที่เอกสาร</th>
                                <th className="p-3">ชื่อผู้ซื้อสินค้า / บริการ</th>
                                <th className="p-3 w-36">เลขประจำตัวผู้เสียภาษี</th>
                                <th className="p-3 w-28">สถานประกอบการ</th>
                                <th className="p-3 text-right w-28">{isVatRegistered ? 'มูลค่าก่อนภาษี' : 'มูลค่าสินค้า'}</th>
                                {isVatRegistered && <th className="p-3 text-right w-24">ภาษี 7%</th>}
                                <th className="p-3 text-right w-28">รวมทั้งสิ้น</th>
                                <th className="p-3 text-center w-24">สถานะ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                            {filteredInvoices.map((inv, idx) => {
                                const isCancelled = inv.status === 'cancelled';
                                const dateStr = inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('th-TH') : '-';

                                return (
                                    <tr 
                                        key={inv.id || idx}
                                        onClick={() => onOpenInvoice && onOpenInvoice(inv)}
                                        className={`hover:bg-zinc-50 transition-colors cursor-pointer ${isCancelled ? 'bg-red-50/40 text-zinc-400' : ''}`}
                                    >
                                        <td className="p-3 text-center font-mono text-zinc-400">{idx + 1}</td>
                                        <td className="p-3 font-mono">{dateStr}</td>
                                        <td className="p-3 font-mono font-bold text-zinc-900">
                                            {inv.invoice_number}
                                        </td>
                                        <td className="p-3">
                                            <div className="font-semibold text-zinc-900">{inv.customer_name}</div>
                                            {inv.notes && <div className="text-[10px] text-zinc-400 font-mono">{inv.notes}</div>}
                                        </td>
                                        <td className="p-3 font-mono">{formatTaxId(inv.customer_tax_id)}</td>
                                        <td className="p-3 font-mono text-[11px]">{formatBranch(inv.customer_branch_type, inv.customer_branch_code)}</td>
                                        <td className="p-3 text-right font-mono font-semibold">
                                            {isCancelled ? '0.00' : Number(inv.pre_vat_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </td>
                                        {isVatRegistered && (
                                            <td className="p-3 text-right font-mono font-semibold text-[oklch(52%_0.16_28)]">
                                                {isCancelled ? '0.00' : Number(inv.vat_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>
                                        )}
                                        <td className="p-3 text-right font-mono font-bold text-zinc-950">
                                            {isCancelled ? '0.00' : Number(inv.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
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

                            {filteredInvoices.length === 0 && (
                                <tr>
                                    <td colSpan={isVatRegistered ? 10 : 9} className="p-12 text-center text-zinc-400 font-mono">
                                        ไม่พบรายการใบเสร็จ/ใบกำกับภาษีในเงื่อนไขที่เลือก
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {filteredInvoices.length > 0 && (
                            <tfoot>
                                <tr className="bg-zinc-900 text-white font-mono font-bold text-xs">
                                    <td colSpan={6} className="p-3 text-right">
                                        รวมทั้งสิ้น (TOTAL):
                                    </td>
                                    <td className="p-3 text-right">
                                        ฿{monthlyStats.preVatSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                    {isVatRegistered && (
                                        <td className="p-3 text-right text-emerald-400">
                                            ฿{monthlyStats.outputVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </td>
                                    )}
                                    <td className="p-3 text-right text-emerald-400 font-black">
                                        ฿{monthlyStats.grossSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 text-center text-[10px] text-zinc-400">
                                        {monthlyStats.invoiceCount} ฉบับ
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}
