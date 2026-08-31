/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, Download, ArrowLeft, CheckCircle2, FileSpreadsheet, Loader2, FileText } from 'lucide-react';
import { formatTaxId, formatBranch, thaiBahtText, downloadCsvFile } from '../../../utils/thaiTaxHelper';
import { generateTaxDocumentPdf, downloadTaxPdf } from '../../../utils/taxPdfHelper';
import { exportCashTaxTemplateExcel, classifyExpenseType } from '../../../utils/thaiTaxExcelHelper';
import { toast } from 'sonner';

export default function CashTaxLedgerPrintView({
    periodMonth = '',
    periodDate = '',
    filterMode = 'month', // 'day' | 'month' | 'all'
    periodLabel = '',
    records = [],
    totals = {},
    companySettings = {},
    isVatRegistered = false,
    onClose
}) {
    const [downloadingPdf, setDownloadingPdf] = useState(false);
    const [exportingExcel, setExportingExcel] = useState(false);

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
            return `${parseInt(d, 10)} ${monthNames[mIdx] || m} พ.ศ. ${thYear}`;
        }
        if (periodMonth) {
            const [year, month] = periodMonth.split('-');
            const mIdx = parseInt(month, 10) - 1;
            const thYear = parseInt(year, 10) + 543;
            return `ประจำเดือน ${monthNames[mIdx] || month} พ.ศ. ${thYear}`;
        }
        return 'รายการทั้งหมดตลอดกาล';
    };

    // Cumulative balance calculation and expense classification
    let currentBalance = 0;
    const recordsWithBalance = records.map((rec) => {
        const inAmt = Number(rec.inAmount || 0);
        const outAmt = Number(rec.outAmount || 0);
        currentBalance = currentBalance + inAmt - outAmt;
        const expType = rec.type === 'EXPENSE' ? (rec.expenseClassification || classifyExpenseType(rec)) : null;

        return {
            ...rec,
            expenseClassification: expType,
            goodsAmount: expType === 'goods' ? outAmt : 0,
            otherAmount: expType === 'other' ? outAmt : 0,
            runningBalance: currentBalance
        };
    });

    // Calculations
    const grandRevenue = totals.totalRevenue || records.reduce((s, r) => s + Number(r.inAmount || 0), 0);
    const grandExpense = totals.totalExpense || records.reduce((s, r) => s + Number(r.outAmount || 0), 0);
    const grandGoodsExpense = totals.totalGoodsExpense || recordsWithBalance.filter(r => r.expenseClassification === 'goods').reduce((s, r) => s + Number(r.outAmount || 0), 0);
    const grandOtherExpense = totals.totalOtherExpense || recordsWithBalance.filter(r => r.expenseClassification === 'other').reduce((s, r) => s + Number(r.outAmount || 0), 0);
    const netProfit = grandRevenue - grandExpense;
    const bahtWords = thaiBahtText(netProfit);

    // Dynamic A4 Smart Pagination (Calibrated for Standard A4 Height):
    // Single page mode: Fits up to 30 rows + financial summary + signatures seamlessly on 1 single sheet!
    // Multi-page mode: Normal pages fit up to 36 rows; Last page fits up to 22 rows + summary + signatures.
    const pages = React.useMemo(() => {
        if (!recordsWithBalance || recordsWithBalance.length === 0) return [[]];

        const totalCount = recordsWithBalance.length;
        const ROWS_SINGLE_PAGE = 30; // Fits up to 30 rows on 1 single sheet
        const ROWS_NORMAL = 36;      // Normal full page without summary
        const ROWS_LAST = 22;        // Last page with summary + signatures

        // 1. Single Page: Everything fits on 1 sheet
        if (totalCount <= ROWS_SINGLE_PAGE) {
            return [recordsWithBalance];
        }

        // 2. Multi-Page: Greedily fill normal pages to prevent huge blank gaps on Page 1
        const pagesList = [];
        let remaining = [...recordsWithBalance];

        while (remaining.length > 0) {
            // If remaining fits on last page
            if (remaining.length <= ROWS_LAST) {
                pagesList.push(remaining);
                break;
            }

            // If remaining fits in 2 pages (current page + final page)
            if (remaining.length <= (ROWS_NORMAL + ROWS_LAST)) {
                // Fill first page up to ROWS_NORMAL, while ensuring final page <= ROWS_LAST
                let firstCount = remaining.length - ROWS_LAST;
                if (firstCount < 1) firstCount = 1;
                if (firstCount > ROWS_NORMAL) firstCount = ROWS_NORMAL;

                // Ensure final page has at least 3 rows so it looks balanced
                const lastCount = remaining.length - firstCount;
                if (lastCount < 3 && firstCount > 10) {
                    firstCount -= (3 - lastCount);
                }

                pagesList.push(remaining.slice(0, firstCount));
                pagesList.push(remaining.slice(firstCount));
                break;
            }

            // Normal full page (36 rows)
            pagesList.push(remaining.slice(0, ROWS_NORMAL));
            remaining = remaining.slice(ROWS_NORMAL);
        }

        return pagesList;
    }, [recordsWithBalance]);

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPdf = async () => {
        const sheetElement = document.getElementById('cash-tax-printable-container');
        if (!sheetElement) {
            toast.error('ไม่พบเนื้อหาเอกสารสำหรับสร้าง PDF');
            return;
        }

        setDownloadingPdf(true);
        const toastId = toast.loading('กำลังสร้างชุดรายงานเงินสดรับ-จ่าย PDF คุณภาพสูง...');
        try {
            const fileName = `Cash_Tax_Ledger_${periodMonth || 'Period'}.pdf`;
            const { blob } = await generateTaxDocumentPdf(sheetElement, { fileName });
            downloadTaxPdf(blob, fileName);
            toast.success(`ดาวน์โหลดเอกสาร ${fileName} เรียบร้อยแล้ว`, { id: toastId });
        } catch (err) {
            console.error('Failed to generate cash tax PDF:', err);
            toast.error('เกิดข้อผิดพลาดในการสร้าง PDF กรุณาลองใช้ปุ่มพิมพ์รายงาน (Print)', { id: toastId });
        } finally {
            setDownloadingPdf(false);
        }
    };

    const handleExportExcel = async () => {
        setExportingExcel(true);
        const toastId = toast.loading('กำลังสร้างไฟล์ Excel รายงานเงินสดรับ-จ่าย ตามแบบฟอร์มสรรพากร...');
        try {
            await exportCashTaxTemplateExcel({
                records: recordsWithBalance,
                companySettings,
                periodLabel: formatThaiDatePeriod(),
                periodMonth: periodMonth || periodDate || 'export',
                mode: 'daily'
            });
            toast.success('ดาวน์โหลดไฟล์ Excel รายงานเงินสดรับ-จ่าย เรียบร้อยแล้ว', { id: toastId });
        } catch (err) {
            console.error('Export Excel failed:', err);
            toast.error('ไม่สามารถสร้าง Excel ได้: ' + err.message, { id: toastId });
        } finally {
            setExportingExcel(false);
        }
    };

    const handleExportCsv = () => {
        const headers = ['ลำดับ', 'วัน/เดือน/ปี', 'รายการ', 'รายรับ (บาท)', 'รายจ่าย-ซื้อสินค้า (บาท)', 'รายจ่าย-ค่าใช้จ่ายอื่นๆ (บาท)', 'ยอดคงเหลือสะสม (บาท)', 'หมายเหตุ/หลักฐาน'];
        const rows = recordsWithBalance.map((item, idx) => [
            idx + 1,
            item.date,
            `"${(item.title || '').replace(/"/g, '""')}"`,
            item.inAmount ? Number(item.inAmount).toFixed(2) : '0.00',
            item.type === 'EXPENSE' && item.expenseClassification === 'goods' ? Number(item.outAmount).toFixed(2) : '0.00',
            item.type === 'EXPENSE' && item.expenseClassification === 'other' ? Number(item.outAmount).toFixed(2) : '0.00',
            item.runningBalance ? Number(item.runningBalance).toFixed(2) : '0.00',
            `"${item.docNo || item.proofType || 'ใบเสร็จ'}"`
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        downloadCsvFile(`รายงานเงินสดรับจ่าย_สรรพากร_${periodMonth || 'export'}.csv`, csvContent);
    };

    // Calculate global running index offset for multi-page numbering
    let runningRowIndex = 0;

    const content = (
        <div className="fixed inset-0 z-[230] flex flex-col bg-zinc-950/85 backdrop-blur-md items-center justify-start p-2 sm:p-4 overflow-y-auto print:static print:p-0 print:m-0 print:bg-white print:overflow-visible font-sans">
            
            {/* Embedded Print CSS */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 6mm 6mm 6mm 6mm;
                    }
                    html, body {
                        background: #ffffff !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    #root {
                        display: none !important;
                    }
                    #print-portal-root {
                        display: block !important;
                        position: static !important;
                        background: #ffffff !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-page-sheet {
                        box-shadow: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        min-height: 0 !important;
                        page-break-after: always !important;
                        break-after: page !important;
                    }
                    .print-page-sheet:last-child {
                        page-break-after: auto !important;
                        break-after: auto !important;
                    }
                }
            ` }} />

            {/* Floating On-Screen Top Bar */}
            <div className="w-full max-w-[210mm] mb-3 flex items-center justify-between bg-zinc-900 border border-zinc-800 text-zinc-100 px-4 py-2.5 shadow-xl shrink-0 no-print">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onClose}
                        className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                        title="ย้อนกลับ"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className="text-xs font-bold font-mono tracking-wide text-zinc-100 flex items-center gap-2">
                            <span>รายงานเงินสดรับ - จ่าย (ม.161)</span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-zinc-800 text-zinc-300 font-normal">
                                {pages.length} หน้า
                            </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono">
                            {formatThaiDatePeriod()} • รวม {records.length} รายการ
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs">
                    <button
                        onClick={handleExportExcel}
                        disabled={exportingExcel}
                        className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white border border-emerald-700 text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        title="ดาวน์โหลดไฟล์ Excel ตามแบบสรรพากรบุคคลธรรมดา"
                    >
                        <FileSpreadsheet size={13} className="text-emerald-300" />
                        <span>EXCEL (.xlsx)</span>
                    </button>
                    <button
                        onClick={handleExportCsv}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                        <FileText size={13} />
                        <span>CSV</span>
                    </button>
                    <button
                        onClick={handleDownloadPdf}
                        disabled={downloadingPdf}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                        {downloadingPdf ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                        <span>PDF</span>
                    </button>
                    <button
                        onClick={handlePrint}
                        className="px-4 py-1.5 bg-white hover:bg-zinc-100 text-black text-[11px] font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    >
                        <Printer size={13} />
                        <span>พิมพ์ (PRINT)</span>
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer ml-1"
                        title="ปิด"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Printable A4 Container */}
            <div id="cash-tax-printable-container" className="flex flex-col gap-6 items-center w-full">
                {pages.map((pageRows, pageIndex) => {
                    const isLastPage = pageIndex === pages.length - 1;
                    const pageStartIdx = runningRowIndex;
                    runningRowIndex += pageRows.length;

                    return (
                        <div 
                            key={`page-${pageIndex}`}
                            className="print-page-sheet w-[210mm] min-h-[297mm] bg-white text-zinc-900 p-6 sm:p-7 shadow-2xl flex flex-col justify-between box-border border border-zinc-200 print:border-none print:shadow-none print:p-0"
                            style={{ fontFamily: "'IBM Plex Sans Thai', 'Sarabun', sans-serif" }}
                        >
                            {/* Page Content */}
                            <div className="flex-1 flex flex-col">
                                
                                {/* 1. Formal Tax Header (ม.161) */}
                                <div className="text-center border-b-2 border-zinc-900 pb-2.5 mb-2.5">
                                    <div className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest mb-0.5">
                                        แบบฟอร์มตามประกาศอธิบดีกรมสรรพากร เกี่ยวกับภาษีเงินได้ (ฉบับที่ ๑๖๑)
                                    </div>
                                    <h1 className="text-base font-bold tracking-tight text-zinc-900 uppercase">
                                        รายงานเงินสดรับ - จ่าย
                                    </h1>
                                    <div className="text-xs font-semibold text-zinc-700 mt-0.5">
                                        {formatThaiDatePeriod()}
                                    </div>
                                </div>

                                {/* 2. Business & Tax Registration Information (Sole Proprietorship / Trade Name) */}
                                <div className="grid grid-cols-2 gap-y-1 text-xs border border-zinc-300 p-2 mb-2.5 bg-zinc-50/50 text-[11px]">
                                    <div>
                                        <span className="text-zinc-500 font-medium">ชื่อผู้ประกอบกิจการ: </span>
                                        <span className="font-bold text-zinc-900">{companySettings.tax_proprietor_name || companySettings.tax_company_name || 'นายธนภัทร บุญเจริญ'}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-zinc-500 font-medium">เลขประจำตัวประชาชน: </span>
                                        <span className="font-mono font-bold text-zinc-900 tracking-wider">
                                            {formatTaxId(companySettings.tax_citizen_id || companySettings.tax_id || '1120100144907')}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-zinc-500 font-medium">ชื่อสถานประกอบการ: </span>
                                        <span className="font-bold text-zinc-900">{companySettings.tax_establishment_name || companySettings.tax_company_name || 'ร้านในบ้าน นครพนม (IN THE HAUS)'}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-zinc-500 font-medium">เลขประจำตัวผู้เสียภาษีอากร: </span>
                                        <span className="font-mono font-bold text-zinc-900 tracking-wider">
                                            {formatTaxId(companySettings.tax_id || '1120100144907')}
                                        </span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-zinc-500 font-medium">ที่ตั้งสถานประกอบการ: </span>
                                        <span className="text-zinc-800">{companySettings.tax_address || companySettings.company_address || '788/1, สุนทรวิจิตร ซ.พนมพนารักษ์ ในเมือง เมืองนครพนม นครพนม 48000'}</span>
                                    </div>
                                    <div>
                                        <span className="text-zinc-500 font-medium">สถานะ: </span>
                                        <span className="font-mono font-bold text-zinc-900">
                                            {isVatRegistered ? '[จดทะเบียน VAT 7%]' : '[บุคคลธรรมดา (NON-VAT)]'}
                                        </span>
                                    </div>
                                    <div className="text-right font-mono text-[10px] text-zinc-500">
                                        หน้า {pageIndex + 1} จากทั้งหมด {pages.length} หน้า
                                    </div>
                                </div>

                                {/* 3. Detailed Data Table */}
                                <div className="border border-zinc-900 overflow-hidden mb-3">
                                    <table className="w-full text-left border-collapse text-[10px]">
                                        <thead>
                                            <tr className="bg-zinc-100 border-b border-zinc-900 font-bold text-zinc-900 text-center">
                                                <th className="py-1 px-1 border-r border-zinc-300 w-8" rowSpan={2}>ลำดับ</th>
                                                <th className="py-1 px-1 border-r border-zinc-300 w-18" rowSpan={2}>ว/ด/ป</th>
                                                <th className="py-1 px-1 border-r border-zinc-300 text-left pl-2" rowSpan={2}>รายการ</th>
                                                <th className="py-1 px-1 border-r border-zinc-300 w-20 text-right pr-2" rowSpan={2}>รายรับ (บาท)</th>
                                                <th className="py-1 px-1 border-r border-zinc-300 text-center bg-zinc-200/60" colSpan={2}>รายจ่าย (บาท)</th>
                                                <th className="py-1 px-1 border-r border-zinc-300 w-20 text-right pr-2" rowSpan={2}>ยอดคงเหลือ</th>
                                                <th className="py-1 px-1 w-24 text-left pl-2" rowSpan={2}>หมายเหตุ</th>
                                            </tr>
                                            <tr className="bg-zinc-100 border-b border-zinc-900 font-bold text-zinc-900 text-center text-[9px]">
                                                <th className="py-1 px-1 border-r border-zinc-300 w-18 text-right pr-1.5">ซื้อสินค้า</th>
                                                <th className="py-1 px-1 border-r border-zinc-300 w-18 text-right pr-1.5">ค่าใช้จ่ายอื่นๆ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pageRows.map((row, rIdx) => {
                                                const globalIndex = pageStartIdx + rIdx + 1;
                                                return (
                                                    <tr key={row.id} className="border-b border-zinc-200 hover:bg-zinc-50 leading-tight">
                                                        <td className="py-1 px-1 border-r border-zinc-200 text-center font-mono text-zinc-600">
                                                            {globalIndex}
                                                        </td>
                                                        <td className="py-1 px-1 border-r border-zinc-200 text-center font-mono text-zinc-800">
                                                            {row.date}
                                                        </td>
                                                        <td className="py-1 px-1 border-r border-zinc-200 text-zinc-900 truncate max-w-[170px] pl-1.5 font-medium">
                                                            {row.title}
                                                        </td>
                                                        <td className="py-1 px-1 border-r border-zinc-200 text-right font-mono font-bold text-zinc-900 pr-1.5">
                                                            {row.inAmount > 0 ? Number(row.inAmount).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                                                        </td>
                                                        <td className="py-1 px-1 border-r border-zinc-200 text-right font-mono text-zinc-900 pr-1.5">
                                                            {row.type === 'EXPENSE' && row.expenseClassification === 'goods' 
                                                                ? <span className="font-bold">{Number(row.outAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span> 
                                                                : '-'}
                                                        </td>
                                                        <td className="py-1 px-1 border-r border-zinc-200 text-right font-mono text-zinc-900 pr-1.5">
                                                            {row.type === 'EXPENSE' && row.expenseClassification === 'other' 
                                                                ? <span className="font-bold">{Number(row.outAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span> 
                                                                : '-'}
                                                        </td>
                                                        <td className="py-1 px-1 border-r border-zinc-200 text-right font-mono font-semibold text-zinc-700 pr-1.5">
                                                            {Number(row.runningBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="py-1 px-1 text-left pl-1.5 font-mono text-[9px] text-zinc-800 truncate max-w-[110px]">
                                                            {row.docNo ? `${row.docNo}` : (row.proofType || 'ใบเสร็จ')}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* 4. Final Page Summary Matrix & Official Certification */}
                                {isLastPage && (
                                    <div className="space-y-2.5 mt-1">
                                        {/* Financial Totals Strip */}
                                        <div className="border border-zinc-900 p-2 bg-zinc-50">
                                            <div className="grid grid-cols-4 gap-2 text-xs font-mono mb-1">
                                                <div>
                                                    <div className="text-zinc-500 text-[9px]">รวมรายรับ (TOTAL IN)</div>
                                                    <div className="text-xs font-bold text-emerald-800">
                                                        ฿{grandRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-zinc-500 text-[9px]">รวมซื้อสินค้า (GOODS)</div>
                                                    <div className="text-xs font-bold text-rose-800">
                                                        ฿{grandGoodsExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-zinc-500 text-[9px]">รวมค่าใช้จ่ายอื่น (OTHER)</div>
                                                    <div className="text-xs font-bold text-rose-800">
                                                        ฿{grandOtherExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-zinc-500 text-[9px]">กำไรสุทธิ (NET PROFIT)</div>
                                                    <div className="text-xs font-bold text-zinc-900">
                                                        ฿{netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="border-t border-zinc-300 pt-1 flex items-center justify-between text-[11px]">
                                                <span className="text-zinc-600 font-medium">จำนวนเงินตัวอักษร:</span>
                                                <span className="font-bold text-zinc-900">({bahtWords})</span>
                                            </div>
                                        </div>

                                        {/* Signatures Strip */}
                                        <div className="grid grid-cols-2 gap-6 pt-4 border-t border-zinc-200 text-center text-xs">
                                            <div className="space-y-5">
                                                <div className="border-b border-zinc-400 w-40 mx-auto"></div>
                                                <div>
                                                    <div className="font-bold text-zinc-900">(........................................................)</div>
                                                    <div className="text-zinc-500 text-[10px] mt-0.5">ผู้จัดทำรายงาน / พนักงานบัญชี</div>
                                                    <div className="text-zinc-400 text-[9px] font-mono">วันที่ .......... / .......... / ..........</div>
                                                </div>
                                            </div>

                                            <div className="space-y-5">
                                                <div className="border-b border-zinc-400 w-40 mx-auto"></div>
                                                <div>
                                                    <div className="font-bold text-zinc-900">({companySettings.tax_signature_name || '........................................................'})</div>
                                                    <div className="text-zinc-500 text-[10px] mt-0.5">ผู้มีเงินได้ / เจ้าของสถานประกอบการ</div>
                                                    <div className="text-zinc-400 text-[9px] font-mono">วันที่ .......... / .......... / ..........</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Page Footer */}
                            <div className="border-t border-zinc-300 pt-1.5 flex items-center justify-between text-[9px] text-zinc-400 font-mono mt-1">
                                <div>ระบบบริหารจัดการภาษี HAUSTABLE TAX ENGINE • อ้างอิง ม.161</div>
                                <div>หน้า {pageIndex + 1} / {pages.length}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const portalRoot = document.getElementById('print-portal-root') || document.body;
    return createPortal(content, portalRoot);
}
