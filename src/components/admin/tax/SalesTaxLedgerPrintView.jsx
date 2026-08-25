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

    // Dynamic A4 Pagination:
    // Normal pages (without footer summary) fit 20 rows densely & beautifully.
    // Last page (with financial summary box + signatures) fits 14 rows.
    const pages = React.useMemo(() => {
        if (!activeRecords || activeRecords.length === 0) return [[]];

        const ROWS_NORMAL = 20;
        const ROWS_LAST = 14;

        if (activeRecords.length <= ROWS_LAST) {
            return [activeRecords];
        }

        const pagesList = [];
        let remaining = [...activeRecords];

        while (remaining.length > 0) {
            if (remaining.length <= ROWS_LAST) {
                pagesList.push(remaining);
                break;
            }

            if (remaining.length <= ROWS_NORMAL) {
                // E.g. 15 to 20 items: split so the last page has <= ROWS_LAST items
                const p1 = Math.min(ROWS_NORMAL, remaining.length - Math.min(remaining.length, ROWS_LAST));
                const count = p1 > 0 ? p1 : Math.ceil(remaining.length / 2);
                pagesList.push(remaining.slice(0, count));
                remaining = remaining.slice(count);
            } else {
                pagesList.push(remaining.slice(0, ROWS_NORMAL));
                remaining = remaining.slice(ROWS_NORMAL);
            }
        }

        return pagesList;
    }, [activeRecords]);

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
                ? `Sales_Tax_Report_${periodMonth || 'Period'}.pdf` 
                : `Sales_Bill_Ledger_${periodMonth || 'Period'}.pdf`;

            const { blob } = await generateTaxDocumentPdf(sheetElement, { fileName });
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
            ? `Sales_Tax_Report_${periodMonth || 'Period'}.csv` 
            : `Sales_Bill_Ledger_${periodMonth || 'Period'}.csv`;
        downloadCsvFile(csv, filename);
        toast.success(`ดาวน์โหลดรายงาน ${filename} เรียบร้อยแล้ว`);
    };

    const reportTitle = isVatRegistered 
        ? 'รายงานภาษีขาย (SALES TAX REPORT)' 
        : 'สมุดรายงานยอดขายและรายรับรายบิล (SALES & BILL LEDGER)';
    const formSubtitle = isVatRegistered ? '(ตามมาตรา 87(1) แห่งประมวลรัษฎากร - แบบ ภ.พ.30)' : '(หลักฐานประกอบการยื่นแบบแสดงรายการภาษีเงินได้)';

    return (
        <div className="fixed inset-0 z-[230] flex flex-col bg-zinc-950/85 backdrop-blur-md items-center justify-start p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:overflow-visible">
            
            {/* Embedded Print CSS to guarantee exact A4 pagination */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 6mm 6mm 6mm 6mm;
                    }
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .print-page-sheet {
                        page-break-after: always !important;
                        break-after: page !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        height: 285mm !important;
                        max-height: 285mm !important;
                        margin: 0 !important;
                        padding: 6mm 8mm !important;
                        box-sizing: border-box !important;
                    }
                    tr {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                }
            `}} />

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
                            งวด: {periodMonth || periodDate || 'All'} • รวม {records.length} รายการ (ปกติ {activeRecords.length} / ยกเลิก {cancelledCount})
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
                    const pageStartOffset = pages.slice(0, pageIdx).reduce((sum, p) => sum + p.length, 0);

                    return (
                        <div 
                            key={`page-${pageIdx}`}
                            style={{ fontFamily: "'Sarabun', 'Leelawadee', 'TH Sarabun New', system-ui, -apple-system, sans-serif" }}
                            className="print-page-sheet bg-white text-zinc-950 p-6 sm:p-7 border border-zinc-300 shadow-xl text-[10.5pt] flex flex-col justify-between print:m-0 print:border-none print:shadow-none print:page-break-after-always print:break-after-page"
                        >
                            <div>
                                {/* Header Section (Official Revenue Department Format) */}
                                <div className="border-b-2 border-zinc-950 pb-3 mb-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h1 className="font-bold text-[16pt] text-zinc-950 tracking-tight leading-tight">
                                                {reportTitle}
                                            </h1>
                                            <p className="text-[10pt] text-zinc-700 font-mono mt-0.5 font-medium">
                                                {formSubtitle}
                                            </p>
                                        </div>
                                        <div className="text-right font-mono text-[10pt] text-zinc-600">
                                            <div>หน้า / Page: <strong className="text-zinc-950">{pageIdx + 1} / {pages.length}</strong></div>
                                            <div>พิมพ์เมื่อ: {new Date().toLocaleDateString('th-TH')} {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>
                                    </div>

                                    {/* Company Metadata Grid (Balanced 2-Column Tabular Layout) */}
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-2.5 pt-2.5 border-t border-zinc-300 text-[10.5pt]">
                                        <div className="space-y-1">
                                            <div>
                                                <span className="text-zinc-600 font-mono">ชื่อผู้ประกอบการ: </span>
                                                <strong className="text-zinc-950 font-bold">{companySettings?.tax_company_name || 'ร้านในบ้าน นครพนม'}</strong>
                                            </div>
                                            <div className="truncate">
                                                <span className="text-zinc-600 font-mono">ที่อยู่: </span>
                                                <span className="text-zinc-900">{companySettings?.tax_address || '788/1 สุนทรวิจิตร ในเมือง เมืองนครพนม 48000'}</span>
                                            </div>
                                            <div>
                                                <span className="text-zinc-600 font-mono">งวดภาษี / ประจำวันที่: </span>
                                                <strong className="text-zinc-950 font-bold font-mono">
                                                    {formatThaiDatePeriod()}
                                                </strong>
                                            </div>
                                        </div>

                                        <div className="space-y-1 sm:text-right">
                                            <div>
                                                <span className="text-zinc-600 font-mono">เลขประจำตัวผู้เสียภาษี: </span>
                                                <strong className="font-mono text-zinc-950 font-bold whitespace-nowrap">{formatTaxId(companySettings?.tax_id || '1120100144907')}</strong>
                                            </div>
                                            <div>
                                                <span className="text-zinc-600 font-mono">สถานประกอบการ: </span>
                                                <strong className="text-zinc-950 font-bold whitespace-nowrap">
                                                    {companySettings?.tax_branch_type === 'head_office' ? 'สำนักงานใหญ่ (00000)' : `สาขาที่ ${companySettings?.tax_branch_code || '00001'}`}
                                                </strong>
                                            </div>
                                            <div className="font-mono text-[10pt] text-zinc-600">
                                                <span>โหมดข้อมูล: </span>
                                                <span className="text-zinc-800">{dataSourceMode === 'invoices' ? 'ใบกำกับภาษี/ใบเสร็จทางการ' : (dataSourceMode === 'pos_bills' ? 'บิลขายทั้งหมดจาก POS' : 'รวมทุกบิลขายและเอกสารภาษี')}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Table of Sequential Bills */}
                                <table className="w-full table-fixed border-collapse text-[10pt]">
                                    <thead>
                                        <tr className="bg-zinc-100 border-y-2 border-zinc-950 font-mono text-[10pt] uppercase text-zinc-900 font-bold">
                                            <th className="py-1.5 px-1 text-center w-[5%] whitespace-nowrap">ลำดับ</th>
                                            <th className="py-1.5 px-1.5 text-left w-[11%] whitespace-nowrap">วัน/เดือน/ปี</th>
                                            <th className="py-1.5 px-1.5 text-left w-[20%] whitespace-nowrap">เลขที่เอกสาร / บิล</th>
                                            <th className="py-1.5 px-1.5 text-left w-[23%]">ชื่อผู้ซื้อสินค้า / บริการ</th>
                                            <th className="py-1.5 px-1.5 text-left w-[15%] whitespace-nowrap">เลขผู้เสียภาษี</th>
                                            <th className="py-1.5 px-1 text-center w-[7%] whitespace-nowrap">สาขา</th>
                                            {isVatRegistered ? (
                                                <>
                                                    <th className="py-1.5 px-1.5 text-right w-[10%] whitespace-nowrap">ก่อนภาษี</th>
                                                    <th className="py-1.5 px-1 text-right w-[9%] whitespace-nowrap">ภาษี 7%</th>
                                                    <th className="py-1.5 px-1.5 text-right w-[10%] whitespace-nowrap">รวมทั้งสิ้น</th>
                                                </>
                                            ) : (
                                                <th className="py-1.5 px-1.5 text-right w-[12%] whitespace-nowrap">มูลค่าสินค้า</th>
                                            )}
                                            <th className="py-1.5 px-1 text-center w-[7%] whitespace-nowrap">สถานะ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-300 font-sans">
                                        {pageRows.map((item, rowIdx) => {
                                            const globalIndex = pageStartOffset + rowIdx + 1;
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
                                                    <td className="py-1.5 px-1 text-center font-mono text-zinc-500 whitespace-nowrap">{globalIndex}</td>
                                                    <td className="py-1.5 px-1.5 font-mono whitespace-nowrap">{dateStr}</td>
                                                    <td className="py-1.5 px-1.5 font-mono font-bold text-zinc-950 whitespace-nowrap truncate">{docNo}</td>
                                                    <td className="py-1.5 px-1.5 truncate font-medium text-zinc-950">
                                                        {item.customer_name || 'ลูกค้าหน้าร้าน (Walk-in)'}
                                                    </td>
                                                    <td className="py-1.5 px-1.5 font-mono text-[9.5pt] text-zinc-800 whitespace-nowrap">{formatTaxId(item.customer_tax_id) || '-'}</td>
                                                    <td className="py-1.5 px-1 text-center text-[9.5pt] font-mono whitespace-nowrap">{formatBranch(item.customer_branch_type, item.customer_branch_code, true)}</td>
                                                    {isVatRegistered ? (
                                                        <>
                                                            <td className="py-1.5 px-1.5 text-right font-mono font-semibold text-zinc-900 whitespace-nowrap">
                                                                {isCancelled ? '0.00' : preVat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="py-1.5 px-1 text-right font-mono font-semibold text-[oklch(52%_0.16_28)] whitespace-nowrap">
                                                                {isCancelled ? '0.00' : vat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="py-1.5 px-1.5 text-right font-mono font-bold text-zinc-950 whitespace-nowrap">
                                                                {isCancelled ? '0.00' : total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <td className="py-1.5 px-1.5 text-right font-mono font-bold text-zinc-950 whitespace-nowrap">
                                                            {isCancelled ? '0.00' : total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                    )}
                                                    <td className="py-1.5 px-1 text-center font-mono text-[9.5pt] whitespace-nowrap">
                                                        {isCancelled ? (
                                                            <span className="font-bold text-red-600">ยกเลิก</span>
                                                        ) : (
                                                            <span className="text-zinc-600 font-semibold">ปกติ</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {pageRows.length === 0 && (
                                            <tr>
                                                <td colSpan={isVatRegistered ? 10 : 8} className="py-12 text-center text-zinc-500 font-mono">
                                                    ไม่มีรายการขาย / เอกสารภาษี ในงวดภาษีที่เลือก
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Summary & Signatures (Shown on the last page) */}
                            {isLastPage && (
                                <div className="mt-4 pt-3 border-t-2 border-zinc-950 space-y-3">
                                    {/* Financial Summary Box */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-50 border-2 border-zinc-950 p-3 font-mono text-[11pt]">
                                        <div className="space-y-1">
                                            <div className="text-[9.5pt] text-zinc-600 uppercase font-bold">จำนวนเงินตัวอักษร / Thai Baht in Words:</div>
                                            <div className="font-bold text-zinc-950 font-sans text-[11.5pt]">({bahtWords})</div>
                                            <div className="text-[10pt] text-zinc-600 pt-0.5">
                                                จำนวนรายการทั้งหมด: <strong className="text-zinc-950 font-bold">{records.length}</strong> ฉบับ (ปกติ: {activeRecords.length}, ยกเลิก: {cancelledCount})
                                            </div>
                                        </div>
                                        <div className="space-y-1 sm:text-right">
                                            <div className="flex justify-between sm:justify-end gap-4">
                                                <span className="text-zinc-600">มูลค่าฐานภาษีรวม:</span>
                                                <strong className="text-zinc-950 font-bold">฿{totalPreVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                                            </div>
                                            {isVatRegistered && (
                                                <div className="flex justify-between sm:justify-end gap-4">
                                                    <span className="text-zinc-600">ภาษีมูลค่าเพิ่ม 7% รวม:</span>
                                                    <strong className="text-[oklch(52%_0.16_28)] font-bold">฿{totalVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                                                </div>
                                            )}
                                            <div className="flex justify-between sm:justify-end gap-4 text-[12pt] pt-1 border-t border-zinc-300">
                                                <span className="font-bold text-zinc-900">ยอดรวมทั้งสิ้น (GRAND TOTAL):</span>
                                                <strong className="text-zinc-950 font-black text-[13pt]">฿{grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Signatures */}
                                    <div className="grid grid-cols-2 gap-8 font-mono text-[10.5pt] pt-1.5">
                                        <div className="text-center">
                                            <div className="w-48 border-b border-zinc-950 mx-auto pb-6 mb-1"></div>
                                            <div className="font-bold text-zinc-950 text-[11pt]">ผู้จัดทำรายงาน</div>
                                            <div className="text-[9.5pt] text-zinc-600">วันที่: {new Date().toLocaleDateString('th-TH')}</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="w-48 border-b border-zinc-950 mx-auto pb-6 mb-1"></div>
                                            <div className="font-bold text-zinc-950 text-[11pt]">
                                                {companySettings?.tax_signature_name || 'ผู้มีอำนาจลงนาม / เจ้าของกิจการ'}
                                            </div>
                                            <div className="text-[9.5pt] text-zinc-600">วันที่: {new Date().toLocaleDateString('th-TH')}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!isLastPage && (
                                <div className="mt-3 pt-2 border-t border-zinc-200 text-right font-mono text-[10pt] text-zinc-500">
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
