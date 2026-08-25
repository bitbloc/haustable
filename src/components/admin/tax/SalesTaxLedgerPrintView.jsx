/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState } from 'react';
import { Printer, X, Download, ArrowLeft, CheckCircle2, FileSpreadsheet, Loader2 } from 'lucide-react';
import { formatTaxId, formatBranch, thaiBahtText, exportUnifiedSalesLedgerCsv, downloadCsvFile } from '../../../utils/thaiTaxHelper';
import { generateTaxDocumentPdf, downloadTaxPdf } from '../../../utils/taxPdfHelper';
import { toast } from 'sonner';

export default function SalesTaxLedgerPrintView({
    periodMonth = '',
    periodDate = '',
    filterMode = 'month', // 'day' | 'month' | 'all'
    periodLabel = '',
    records = [],
    companySettings = {},
    isVatRegistered = false,
    dataSourceMode = 'invoices', // 'invoices' | 'pos_bills' | 'all'
    onClose
}) {
    const [downloadingPdf, setDownloadingPdf] = useState(false);

    // Format Date / Month Thai string
    const formatThaiDatePeriod = () => {
        if (periodLabel) return periodLabel;
        const monthNames = [
            'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
        ];
        if (filterMode === 'day' && periodDate) {
            const [y, m, d] = periodDate.split('-');
            const mIdx = parseInt(m, 10) - 1;
            const thYear = parseInt(y, 10) + 543;
            return `ประจำวันที่ ${parseInt(d, 10)} ${monthNames[mIdx] || m} พ.ศ. ${thYear}`;
        }
        if (periodMonth) {
            const [year, month] = periodMonth.split('-');
            const mIdx = parseInt(month, 10) - 1;
            const thYear = parseInt(year, 10) + 543;
            return `ประจำเดือน ${monthNames[mIdx] || month} พ.ศ. ${thYear}`;
        }
        return 'ทุกช่วงเวลา (All Periods)';
    };

    // Calculate Financial Aggregates
    const activeRecords = records.filter(r => r.status !== 'cancelled');
    const cancelledCount = records.filter(r => r.status === 'cancelled').length;

    const totalPreVat = activeRecords.reduce((sum, item) => {
        const preVat = Number(item.pre_vat_amount !== undefined 
            ? item.pre_vat_amount 
            : (isVatRegistered ? (Number(item.total_amount || item.total_price || 0) / 1.07) : (item.total_amount || item.total_price || 0)));
        return sum + preVat;
    }, 0);

    const totalVat = activeRecords.reduce((sum, item) => {
        const preVat = Number(item.pre_vat_amount !== undefined 
            ? item.pre_vat_amount 
            : (isVatRegistered ? (Number(item.total_amount || item.total_price || 0) / 1.07) : (item.total_amount || item.total_price || 0)));
        const vat = Number(item.vat_amount !== undefined 
            ? item.vat_amount 
            : (isVatRegistered ? (Number(item.total_amount || item.total_price || 0) - preVat) : 0));
        return sum + vat;
    }, 0);

    const grandTotal = activeRecords.reduce((sum, item) => {
        const total = Number(item.total_amount !== undefined ? item.total_amount : (item.total_price || 0));
        return sum + total;
    }, 0);

    const bahtWords = thaiBahtText(grandTotal);

    // Split records into pages for clean A4 printing (approx 18-20 rows per A4 page)
    const ROWS_PER_PAGE = 18;
    const pages = [];
    if (records.length === 0) {
        pages.push([]);
    } else {
        for (let i = 0; i < records.length; i += ROWS_PER_PAGE) {
            pages.push(records.slice(i, i + ROWS_PER_PAGE));
        }
    }

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadDirectPdf = async () => {
        const sheetElement = document.getElementById('sales-tax-ledger-printable-container');
        if (!sheetElement) {
            toast.error('ไม่พบเนื้อหาเอกสารสำหรับสร้าง PDF');
            return;
        }

        setDownloadingPdf(true);
        const toastId = toast.loading('กำลังสร้างเอกสาร PDF คุณภาพสูง...');
        try {
            const fileName = isVatRegistered 
                ? `Sales_Tax_Report_${periodMonth}.pdf` 
                : `Sales_Bill_Ledger_${periodMonth}.pdf`;

            const { pdf, blob } = await generateTaxDocumentPdf(sheetElement, { fileName });
            downloadTaxPdf(blob, fileName);
            toast.success(`ดาวน์โหลดเอกสาร ${fileName} เรียบร้อยแล้ว`, { id: toastId });
        } catch (err) {
            console.error('Failed to generate sales ledger PDF:', err);
            toast.error('เกิดข้อผิดพลาดในการสร้าง PDF กรุณาลองใช้ปุ่มพิมพ์รายงาน (Print)', { id: toastId });
        } finally {
            setDownloadingPdf(false);
        }
    };

    const handleExportCsv = () => {
        const csv = exportUnifiedSalesLedgerCsv(records, periodMonth, isVatRegistered);
        const filename = isVatRegistered 
            ? `Sales_Tax_Report_${periodMonth}.csv` 
            : `Sales_Bill_Ledger_${periodMonth}.csv`;
        downloadCsvFile(csv, filename);
        toast.success(`ดาวน์โหลดรายงาน ${filename} เรียบร้อยแล้ว`);
    };

    const reportTitle = isVatRegistered 
        ? 'รายงานภาษีขาย (SALES TAX REPORT)' 
        : 'สมุดรายงานยอดขายและรายรับรายบิล (SALES & BILL LEDGER)';
    const formSubtitle = isVatRegistered ? '(ตามมาตรา 87(1) แห่งประมวลรัษฎากร - แบบ ภ.พ.30)' : '(หลักฐานประกอบการยื่นแบบแสดงรายการภาษีเงินได้)';

    return (
        <div className="fixed inset-0 z-[230] flex flex-col bg-zinc-950/85 backdrop-blur-md items-center justify-start p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:overflow-visible">
            
            {/* Top Navigation & Action Toolbar (Hidden in Print) */}
            <div className="w-full max-w-5xl bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-4 sm:px-6 py-3 border border-[oklch(85%_0.012_28)] flex flex-wrap items-center justify-between font-mono text-xs mb-4 print:hidden gap-3 shadow-2xl shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="px-2.5 py-1.5 border border-zinc-700 hover:bg-zinc-800 text-white uppercase transition-colors flex items-center gap-1 cursor-pointer rounded-xs"
                    >
                        <ArrowLeft size={14} />
                        <span>BACK</span>
                    </button>
                    <div>
                        <div className="font-bold text-[oklch(52%_0.16_28)] uppercase tracking-wider">
                            [ {reportTitle} ]
                        </div>
                        <div className="text-[10px] text-zinc-400">
                            งวด: {periodMonth} • รวม {records.length} รายการ (ปกติ {activeRecords.length} / ยกเลิก {cancelledCount})
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={handleExportCsv}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600 transition-colors flex items-center gap-1.5 cursor-pointer rounded-xs text-xs font-bold"
                    >
                        <FileSpreadsheet size={14} className="text-emerald-400" />
                        <span>Excel / CSV</span>
                    </button>

                    <button
                        onClick={handleDownloadDirectPdf}
                        disabled={downloadingPdf}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1.5 cursor-pointer rounded-xs text-xs font-bold shadow-sm disabled:opacity-50"
                    >
                        {downloadingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        <span>DOWNLOAD PDF</span>
                    </button>

                    <button
                        onClick={handlePrint}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase transition-colors flex items-center gap-1.5 cursor-pointer rounded-xs shadow-sm"
                    >
                        <Printer size={14} />
                        <span>PRINT / SAVE AS PDF</span>
                    </button>

                    <button
                        onClick={onClose}
                        className="p-1.5 border border-zinc-700 hover:bg-zinc-800 text-white transition-colors cursor-pointer rounded-xs"
                        aria-label="Close"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Printable Container (A4 Multi-page Stack) */}
            <div id="sales-tax-ledger-printable-container" className="w-full max-w-5xl space-y-6 print:space-y-0 print:w-full print:max-w-none">
                
                {pages.map((pageRows, pageIdx) => {
                    const isLastPage = pageIdx === pages.length - 1;

                    return (
                        <div 
                            key={`page-${pageIdx}`}
                            className="bg-white text-zinc-950 p-8 sm:p-10 border border-zinc-300 shadow-xl font-sans text-xs min-h-[297mm] flex flex-col justify-between print:m-0 print:p-6 print:border-none print:shadow-none print:min-h-screen print:page-break-after-always print:break-after-page"
                        >
                            <div>
                                {/* Header Section (Official Revenue Department Format) */}
                                <div className="border-b-2 border-zinc-950 pb-4 mb-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h1 className="font-bold text-base text-zinc-950 tracking-tight">
                                                {reportTitle}
                                            </h1>
                                            <p className="text-[10px] text-zinc-600 font-mono mt-0.5">
                                                {formSubtitle}
                                            </p>
                                        </div>
                                        <div className="text-right font-mono text-[10px] text-zinc-500">
                                            <div>หน้า / Page: <strong>{pageIdx + 1} / {pages.length}</strong></div>
                                            <div>พิมพ์เมื่อ: {new Date().toLocaleDateString('th-TH')} {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>
                                    </div>

                                    {/* Company Metadata Grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-zinc-200 text-[11px]">
                                        <div className="col-span-2 sm:col-span-2">
                                            <span className="text-zinc-500 font-mono">ชื่อผู้ประกอบการ / สถานประกอบการ: </span>
                                            <strong className="text-zinc-950">{companySettings?.tax_company_name || 'ร้านในบ้าน นครพนม'}</strong>
                                        </div>
                                        <div>
                                            <span className="text-zinc-500 font-mono">เลขประจำตัวผู้เสียภาษี: </span>
                                            <strong className="font-mono text-zinc-950 font-bold">{formatTaxId(companySettings?.tax_id || '1120100144907')}</strong>
                                        </div>
                                        <div className="col-span-2 sm:col-span-2">
                                            <span className="text-zinc-500 font-mono">ที่อยู่: </span>
                                            <span className="text-zinc-800">{companySettings?.tax_address || 'นครพนม'}</span>
                                        </div>
                                        <div>
                                            <span className="text-zinc-500 font-mono">สถานประกอบการ: </span>
                                            <strong className="text-zinc-900">
                                                {companySettings?.tax_branch_type === 'head_office' ? 'สำนักงานใหญ่ (00000)' : `สาขาที่ ${companySettings?.tax_branch_code || '00001'}`}
                                            </strong>
                                        </div>
                                        <div className="col-span-2 sm:col-span-3 pt-1 border-t border-zinc-100 flex items-center justify-between">
                                            <div>
                                                <span className="text-zinc-500 font-mono">งวดภาษี / ประจำวันที่: </span>
                                                <strong className="text-zinc-950 font-bold font-mono">
                                                    {formatThaiDatePeriod()}
                                                </strong>
                                            </div>
                                            <div className="font-mono text-[10px] text-zinc-500">
                                                โหมดข้อมูล: {dataSourceMode === 'invoices' ? 'เอกสารใบกำกับภาษี/ใบเสร็จทางการ' : (dataSourceMode === 'pos_bills' ? 'บิลขายทั้งหมดจาก POS' : 'รวมทุกบิลขายและเอกสารภาษี')}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Table of Sequential Bills */}
                                <table className="w-full border-collapse text-[10.5px]">
                                    <thead>
                                        <tr className="bg-zinc-100 border-y border-zinc-950 font-mono text-[9.5px] uppercase text-zinc-800">
                                            <th className="py-2 px-1 text-center w-8">ลำดับ</th>
                                            <th className="py-2 px-1 text-left w-20">วัน/เดือน/ปี</th>
                                            <th className="py-2 px-1 text-left w-28">เล่มที่/เลขที่เอกสาร</th>
                                            <th className="py-2 px-1 text-left">ชื่อผู้ซื้อสินค้า / บริการ</th>
                                            <th className="py-2 px-1 text-left w-28">เลขผู้เสียภาษี</th>
                                            <th className="py-2 px-1 text-left w-16">สาขา</th>
                                            <th className="py-2 px-1 text-right w-24">{isVatRegistered ? 'มูลค่าก่อนภาษี' : 'มูลค่าสินค้า'}</th>
                                            {isVatRegistered && <th className="py-2 px-1 text-right w-20">ภาษี 7%</th>}
                                            <th className="py-2 px-1 text-right w-24">รวมทั้งสิ้น</th>
                                            <th className="py-2 px-1 text-center w-14">สถานะ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-200 font-sans">
                                        {pageRows.map((item, rowIdx) => {
                                            const globalIndex = (pageIdx * ROWS_PER_PAGE) + rowIdx + 1;
                                            const isCancelled = item.status === 'cancelled';
                                            const rawDate = item.issued_at || item.created_at || item.booking_time;
                                            const dateObj = rawDate ? new Date(rawDate) : null;
                                            const dateStr = dateObj ? dateObj.toLocaleDateString('th-TH') : '-';
                                            const docNo = item.invoice_number || item.bill_number || item.order_number || (item.id ? `POS-${String(item.id).slice(0, 8).toUpperCase()}` : '-');

                                            const preVat = Number(item.pre_vat_amount !== undefined 
                                                ? item.pre_vat_amount 
                                                : (isVatRegistered ? (Number(item.total_amount || item.total_price || 0) / 1.07) : (item.total_amount || item.total_price || 0)));
                                            const vat = Number(item.vat_amount !== undefined 
                                                ? item.vat_amount 
                                                : (isVatRegistered ? (Number(item.total_amount || item.total_price || 0) - preVat) : 0));
                                            const total = Number(item.total_amount !== undefined ? item.total_amount : (item.total_price || 0));

                                            return (
                                                <tr key={item.id || rowIdx} className={isCancelled ? 'bg-red-50/50 text-zinc-400 line-through' : ''}>
                                                    <td className="py-1.5 px-1 text-center font-mono text-zinc-400">{globalIndex}</td>
                                                    <td className="py-1.5 px-1 font-mono">{dateStr}</td>
                                                    <td className="py-1.5 px-1 font-mono font-bold text-zinc-900">{docNo}</td>
                                                    <td className="py-1.5 px-1 truncate max-w-[140px] font-medium text-zinc-900">
                                                        {item.customer_name || 'ลูกค้าทั่วไป (Walk-in)'}
                                                    </td>
                                                    <td className="py-1.5 px-1 font-mono text-[10px] text-zinc-700">{formatTaxId(item.customer_tax_id)}</td>
                                                    <td className="py-1.5 px-1 text-[10px] font-mono">{formatBranch(item.customer_branch_type, item.customer_branch_code)}</td>
                                                    <td className="py-1.5 px-1 text-right font-mono font-semibold">
                                                        {isCancelled ? '0.00' : preVat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                    {isVatRegistered && (
                                                        <td className="py-1.5 px-1 text-right font-mono font-semibold text-[oklch(52%_0.16_28)]">
                                                            {isCancelled ? '0.00' : vat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                    )}
                                                    <td className="py-1.5 px-1 text-right font-mono font-bold text-zinc-950">
                                                        {isCancelled ? '0.00' : total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="py-1.5 px-1 text-center font-mono text-[9px]">
                                                        {isCancelled ? (
                                                            <span className="font-bold text-red-600">ยกเลิก</span>
                                                        ) : (
                                                            <span className="text-zinc-600">ปกติ</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {pageRows.length === 0 && (
                                            <tr>
                                                <td colSpan={isVatRegistered ? 10 : 9} className="py-12 text-center text-zinc-400 font-mono">
                                                    ไม่มีรายการขาย / เอกสารภาษี ในงวดภาษีที่เลือก
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Summary & Signatures (Shown on the last page) */}
                            {isLastPage && (
                                <div className="mt-6 pt-4 border-t-2 border-zinc-950 space-y-4">
                                    {/* Financial Summary Box */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-50 border border-zinc-200 p-3 rounded-xs font-mono text-xs">
                                        <div className="space-y-1">
                                            <div className="text-[10px] text-zinc-500 uppercase font-bold">จำนวนเงินตัวอักษร / Thai Baht in Words:</div>
                                            <div className="font-bold text-zinc-900 font-sans">({bahtWords})</div>
                                            <div className="text-[10px] text-zinc-500 pt-1">
                                                จำนวนรายการทั้งหมด: <strong>{records.length}</strong> ฉบับ (ปกติ: {activeRecords.length}, ยกเลิก: {cancelledCount})
                                            </div>
                                        </div>
                                        <div className="space-y-1 sm:text-right">
                                            <div className="flex justify-between sm:justify-end gap-4">
                                                <span className="text-zinc-500">มูลค่าฐานภาษีรวม:</span>
                                                <strong className="text-zinc-950 font-bold">฿{totalPreVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                                            </div>
                                            {isVatRegistered && (
                                                <div className="flex justify-between sm:justify-end gap-4">
                                                    <span className="text-zinc-500">ภาษีมูลค่าเพิ่ม 7% รวม:</span>
                                                    <strong className="text-[oklch(52%_0.16_28)] font-bold">฿{totalVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                                                </div>
                                            )}
                                            <div className="flex justify-between sm:justify-end gap-4 text-sm pt-1 border-t border-zinc-200">
                                                <span className="font-bold text-zinc-900">ยอดรวมทั้งสิ้น (GRAND TOTAL):</span>
                                                <strong className="text-zinc-950 font-black text-base">฿{grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Official Signature Lines */}
                                    <div className="grid grid-cols-2 gap-8 pt-4 text-center font-sans text-xs">
                                        <div className="space-y-1">
                                            <div className="h-10 flex items-end justify-center">
                                                <span className="border-b border-dotted border-zinc-400 w-48 block"></span>
                                            </div>
                                            <p className="font-medium text-zinc-800">
                                                ( {companySettings?.tax_signature_name || '............................................................'} )
                                            </p>
                                            <p className="text-[10px] text-zinc-500 font-mono">ผู้จัดทำรายงาน / ผู้รับเงิน</p>
                                            <p className="text-[10px] text-zinc-400 font-mono">วันที่ ........ / ........ / ................</p>
                                        </div>

                                        <div className="space-y-1">
                                            <div className="h-10 flex items-end justify-center">
                                                <span className="border-b border-dotted border-zinc-400 w-48 block"></span>
                                            </div>
                                            <p className="font-medium text-zinc-800">
                                                ( {companySettings?.tax_signature_position ? companySettings?.tax_signature_name : '............................................................'} )
                                            </p>
                                            <p className="text-[10px] text-zinc-500 font-mono">กรรมการผู้มีอำนาจ / ผู้ตรวจสอบบัญชี</p>
                                            <p className="text-[10px] text-zinc-400 font-mono">วันที่ ........ / ........ / ................</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!isLastPage && (
                                <div className="mt-4 pt-2 border-t border-zinc-200 text-right font-mono text-[10px] text-zinc-400">
                                    ( มียอดรวมยกไปหน้าถัดไป ... )
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
