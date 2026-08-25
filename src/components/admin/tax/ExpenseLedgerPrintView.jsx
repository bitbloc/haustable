/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, Download, ArrowLeft, CheckCircle2, FileSpreadsheet, Loader2 } from 'lucide-react';
import { formatTaxId, formatBranch, thaiBahtText, downloadCsvFile } from '../../../utils/thaiTaxHelper';
import { generateTaxDocumentPdf, downloadTaxPdf } from '../../../utils/taxPdfHelper';
import { EXPENSE_CATEGORIES, getCleanCategoryLabel } from '../../../utils/expenseConstants';
import { toast } from 'sonner';

export default function ExpenseLedgerPrintView({
    periodMonth = '',
    periodDate = '',
    filterMode = 'month', // 'day' | 'month' | 'all'
    periodLabel = '',
    expenses = [],
    companySettings = {},
    isVatRegistered = false,
    categoryFilter = 'all',
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
            return `${parseInt(d, 10)} ${monthNames[mIdx] || m} พ.ศ. ${thYear}`;
        }
        if (periodMonth) {
            const [year, month] = periodMonth.split('-');
            const mIdx = parseInt(month, 10) - 1;
            const thYear = parseInt(year, 10) + 543;
            return `ประจำเดือน ${monthNames[mIdx] || month} พ.ศ. ${thYear}`;
        }
        return 'ค่าใช้จ่ายทั้งหมดตลอดกาล';
    };

    // Financial calculations
    const grandTotal = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const bahtWords = thaiBahtText(grandTotal);

    // Stats by Grade
    const gradeA = expenses.filter(e => e.doc_type === 'tax_invoice').reduce((s, e) => s + Number(e.amount || 0), 0);
    const gradeB = expenses.filter(e => e.doc_type === 'cash_bill').reduce((s, e) => s + Number(e.amount || 0), 0);
    const gradeC = expenses.filter(e => e.doc_type === 'slip' || !e.doc_type).reduce((s, e) => s + Number(e.amount || 0), 0);

    // Stats by Category
    const categoryTotals = expenses.reduce((acc, exp) => {
        const cat = exp.category || 'other';
        acc[cat] = (acc[cat] || 0) + Number(exp.amount || 0);
        return acc;
    }, {});

    // Dynamic A4 Pagination:
    // Normal pages fit 20 rows densely.
    // Last page (with summary box & signatures) fits 14 rows.
    const pages = React.useMemo(() => {
        if (!expenses || expenses.length === 0) return [[]];

        const ROWS_NORMAL = 20;
        const ROWS_LAST = 14;

        if (expenses.length <= ROWS_LAST) {
            return [expenses];
        }

        const pagesList = [];
        let remaining = [...expenses];

        while (remaining.length > 0) {
            if (remaining.length <= ROWS_LAST) {
                pagesList.push(remaining);
                break;
            }

            if (remaining.length <= ROWS_NORMAL) {
                const p1 = Math.min(ROWS_NORMAL, remaining.length - Math.min(remaining.length, ROWS_LAST));
                if (p1 > 0) {
                    pagesList.push(remaining.slice(0, p1));
                    pagesList.push(remaining.slice(p1));
                } else {
                    const half = Math.ceil(remaining.length / 2);
                    pagesList.push(remaining.slice(0, half));
                    pagesList.push(remaining.slice(half));
                }
                break;
            }

            pagesList.push(remaining.slice(0, ROWS_NORMAL));
            remaining = remaining.slice(ROWS_NORMAL);
        }

        return pagesList;
    }, [expenses]);

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPdf = async () => {
        const sheetElement = document.getElementById('expense-ledger-printable-container');
        if (!sheetElement) {
            toast.error('ไม่พบโครงสร้างเอกสารสำหรับพิมพ์');
            return;
        }

        try {
            setDownloadingPdf(true);
            toast.info('กำลังสร้างไฟล์ PDF สมุดรายงานค่าใช้จ่าย...', { duration: 3000 });

            const periodSlug = (periodMonth || periodDate || 'all').replace(/[^a-zA-Z0-9_-]/g, '_');
            const fileName = `Expense_Ledger_${periodSlug}.pdf`;

            const pdfBlob = await generateTaxDocumentPdf(sheetElement, {
                title: `รายงานสรุปค่าใช้จ่ายและต้นทุนร้าน - ${formatThaiDatePeriod()}`,
                orientation: 'portrait',
                scale: 2
            });

            downloadTaxPdf(pdfBlob, fileName);
            toast.success(`ดาวน์โหลดไฟล์ ${fileName} สำเร็จ`);
        } catch (err) {
            console.error('Failed to generate expense ledger PDF:', err);
            toast.error('เกิดข้อผิดพลาดในการสร้างไฟล์ PDF: ' + (err.message || 'Unknown error'));
        } finally {
            setDownloadingPdf(false);
        }
    };

    const handleExportCsv = () => {
        if (expenses.length === 0) {
            toast.warning('ไม่พบข้อมูลค่าใช้จ่าย');
            return;
        }

        const headers = [
            'ลำดับ (No.)',
            'วันที่จ่าย (Date)',
            'เลขที่ใบเสร็จ/เอกสาร (Doc No)',
            'รายการ / ชื่อร้านค้า (Title / Vendor)',
            'เลขผู้เสียภาษี (Tax ID)',
            'หมวดหมู่ (Category)',
            'เกรดเอกสาร (Doc Grade)',
            'จำนวนเงิน (Amount THB)',
            'วิธีชำระ (Payment Method)',
            'หมายเหตุ (Notes)'
        ];

        const rows = expenses.map((exp, idx) => {
            const catLabel = getCleanCategoryLabel(exp.category);
            const docGrade = exp.doc_type === 'tax_invoice' ? 'Grade A (ใบกำกับภาษี)' : (exp.doc_type === 'cash_bill' ? 'Grade B (บิลเงินสด)' : 'Grade C (สลิปโอน)');
            return [
                idx + 1,
                `"${exp.expense_date || '-'}"`,
                `"${(exp.receipt_number || exp.invoice_number || exp.doc_no || '-').replace(/"/g, '""')}"`,
                `"${(exp.vendor_name || exp.title || '-').replace(/"/g, '""')}"`,
                `"${exp.vendor_tax_id || '-'}"`,
                `"${catLabel}"`,
                `"${docGrade}"`,
                Number(exp.amount || 0).toFixed(2),
                `"${exp.payment_method || 'TRANSFER'}"`,
                `"${(exp.notes || '-').replace(/"/g, '""')}"`
            ];
        });

        const periodLabelStr = formatThaiDatePeriod();
        const summaryRow = [
            'รวมค่าใช้จ่ายทั้งสิ้น', '', '', '', '', '', '',
            grandTotal.toFixed(2), '', `(${bahtWords})`
        ];

        const csvLines = [
            `"รายงานสรุปค่าใช้จ่ายและต้นทุนร้าน (Expense & Purchase Ledger) - ${periodLabelStr}"`,
            headers.join(','),
            ...rows.map(r => r.join(',')),
            summaryRow.join(',')
        ];

        const periodSlug = (periodMonth || periodDate || 'all').replace(/[^a-zA-Z0-9_-]/g, '_');
        downloadCsvFile(csvLines.join('\r\n'), `Expense_Ledger_${periodSlug}.csv`);
        toast.success('ดาวน์โหลดไฟล์ CSV เรียบร้อย');
    };

    const formTitle = isVatRegistered ? 'รายงานภาษีซื้อ (PURCHASE TAX REPORT)' : 'สมุดรายงานสรุปค่าใช้จ่ายและต้นทุนร้าน (STORE EXPENSE LEDGER)';
    const formSubtitle = isVatRegistered
        ? 'ตามประมวลรัษฎากร มาตรา 87(2) แห่งประมวลรัษฎากร'
        : 'เอกสารประกอบการลงบัญชีและหักค่าใช้จ่ายตามประมวลรัษฎากร';

    const content = (
        <div className="fixed inset-0 z-[230] flex flex-col bg-zinc-950/85 backdrop-blur-md items-center justify-start p-2 sm:p-4 overflow-y-auto print:static print:p-0 print:m-0 print:bg-white print:overflow-visible">
            
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
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                    }
                    .print-page-sheet {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        margin: 0 !important;
                        padding: 2mm 3mm !important;
                        box-sizing: border-box !important;
                        height: auto !important;
                        min-height: 0 !important;
                        max-height: none !important;
                        border: none !important;
                        box-shadow: none !important;
                        overflow: visible !important;
                    }
                    .print-page-sheet:not(:last-child) {
                        page-break-after: always !important;
                        break-after: page !important;
                    }
                    .print-page-sheet:last-child {
                        page-break-after: auto !important;
                        break-after: auto !important;
                    }
                }
            `}} />

            {/* Top Toolbar (Hidden on Print) */}
            <div className="w-full max-w-5xl bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-4 sm:px-6 py-3 border border-[oklch(85%_0.012_28)] flex flex-wrap items-center justify-between font-mono text-xs mb-4 print:hidden gap-3 shadow-2xl shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="px-2.5 py-1.5 border border-zinc-700 hover:bg-zinc-800 text-white uppercase transition-colors flex items-center gap-1 cursor-pointer rounded-xs"
                    >
                        <ArrowLeft size={14} />
                        <span>BACK</span>
                    </button>
                    <span className="font-bold text-[oklch(52%_0.16_28)] uppercase tracking-wider">
                        [ EXPENSE LEDGER REPORT ]
                    </span>
                    <span className="text-zinc-400">
                        {formatThaiDatePeriod()} ({expenses.length} รายการ)
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportCsv}
                        className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600 font-bold transition-colors flex items-center gap-1.5 cursor-pointer rounded-xs shadow-md"
                        title="ดาวน์โหลดข้อมูลเป็นไฟล์ Excel / CSV"
                    >
                        <FileSpreadsheet size={14} className="text-emerald-400" />
                        <span>EXCEL/CSV</span>
                    </button>

                    <button
                        onClick={handleDownloadPdf}
                        disabled={downloadingPdf}
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors flex items-center gap-1.5 cursor-pointer rounded-xs shadow-md disabled:opacity-50"
                        title="ดาวน์โหลดรายงานเป็นไฟล์ PDF ทันที"
                    >
                        {downloadingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        <span>DOWNLOAD PDF</span>
                    </button>

                    <button
                        onClick={handlePrint}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase transition-colors flex items-center gap-2 cursor-pointer rounded-xs shadow-md"
                        title="สั่งพิมพ์หรือบันทึกเป็น PDF ผ่านเบราว์เซอร์"
                    >
                        <Printer size={16} />
                        <span>PRINT / SAVE AS PDF</span>
                    </button>

                    <button
                        onClick={onClose}
                        className="p-2 border border-zinc-700 hover:bg-red-950 text-zinc-400 hover:text-white transition-colors cursor-pointer rounded-xs ml-2"
                        title="ปิดหน้าต่างนี้"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Printable Container */}
            <div id="expense-ledger-printable-container" className="w-full max-w-5xl space-y-6 print:space-y-0 print:w-full print:max-w-none">
                {pages.map((pageRows, pageIdx) => {
                    const isLastPage = pageIdx === pages.length - 1;
                    const pageStartOffset = pages.slice(0, pageIdx).reduce((acc, p) => acc + p.length, 0);

                    return (
                        <div 
                            key={pageIdx}
                            style={{ fontFamily: "'Sarabun', 'Leelawadee', 'TH Sarabun New', system-ui, -apple-system, sans-serif" }}
                            className="print-page-sheet bg-white text-zinc-950 p-6 sm:p-7 border border-zinc-300 shadow-xl text-[10.5pt] flex flex-col justify-between print:m-0 print:p-0 print:border-none print:shadow-none"
                        >
                            <div>
                                {/* Header Section (Official Revenue Department Format) */}
                                <div className="border-b-2 border-zinc-950 pb-3 mb-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h1 className="font-bold text-[16pt] text-zinc-950 tracking-tight leading-tight">
                                                {formTitle}
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

                                    {/* Company Metadata Grid */}
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mt-2.5 pt-2.5 border-t border-zinc-300 text-[10.5pt]">
                                        <div className="space-y-1">
                                            <div>
                                                <span className="text-zinc-600 font-mono">ชื่อผู้ประกอบการ: </span>
                                                <strong className="text-zinc-950 font-bold">{companySettings?.tax_company_name || 'ร้านในบ้าน นครพนม'}</strong>
                                            </div>
                                            <div>
                                                <span className="text-zinc-600 font-mono">ชื่อสถานประกอบการ: </span>
                                                <strong className="text-zinc-950 font-bold">{companySettings?.tax_company_name_en ? `${companySettings?.tax_company_name || 'ร้านในบ้าน นครพนม'} (${companySettings.tax_company_name_en})` : (companySettings?.tax_company_name || 'ร้านในบ้าน นครพนม')}</strong>
                                            </div>
                                            <div className="leading-snug">
                                                <span className="text-zinc-600 font-mono">ที่อยู่สถานประกอบการ: </span>
                                                <span className="text-zinc-900 font-normal">{companySettings?.tax_address || '788/1 ถ.สุนทรวิจิตร ต.ในเมือง อ.เมือง นครพนม 48000'}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-1 sm:text-right">
                                            <div>
                                                <span className="text-zinc-600 font-mono">เลขประจำตัวผู้เสียภาษีอากร: </span>
                                                <strong className="font-mono text-zinc-950 font-bold whitespace-nowrap">{formatTaxId(companySettings?.tax_id || '1120100144907')}</strong>
                                            </div>
                                            <div>
                                                <span className="text-zinc-600 font-mono">สถานประกอบการ: </span>
                                                <strong className="text-zinc-950 font-bold whitespace-nowrap">
                                                    {companySettings?.tax_branch_type === 'head_office' ? 'สำนักงานใหญ่ (00000)' : `สาขาที่ ${companySettings?.tax_branch_code || '00001'}`}
                                                </strong>
                                            </div>
                                            <div>
                                                <span className="text-zinc-600 font-mono">งวดภาษี / ประจำวันที่: </span>
                                                <strong className="text-zinc-950 font-bold font-mono">
                                                    {formatThaiDatePeriod()}
                                                </strong>
                                            </div>
                                            <div className="font-mono text-[9.5pt] text-zinc-500">
                                                <span>หมวดหมู่: </span>
                                                <span className="text-zinc-800 font-medium">{categoryFilter === 'all' ? 'ทุกหมวดหมู่ค่าใช้จ่าย' : getCleanCategoryLabel(categoryFilter, false)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Table of Sequential Expenses */}
                                <table className="w-full table-fixed border-collapse text-[10pt]">
                                    <thead>
                                        <tr className="bg-zinc-100 border-y-2 border-zinc-950 font-mono text-[10pt] uppercase text-zinc-900 font-bold">
                                            <th className="py-1.5 px-1 text-center w-[4%] whitespace-nowrap">ลำดับ</th>
                                            <th className="py-1.5 px-1.5 text-left w-[10%] whitespace-nowrap">วัน/เดือน/ปี</th>
                                            <th className="py-1.5 px-1.5 text-left w-[15%] whitespace-nowrap">เลขที่เอกสาร / บิล</th>
                                            <th className="py-1.5 px-1.5 text-left w-[20%]">รายการ / ผู้ขาย / ร้านค้า</th>
                                            <th className="py-1.5 px-1.5 text-left w-[15%] whitespace-nowrap">เลขผู้เสียภาษี</th>
                                            <th className="py-1.5 px-1.5 text-left w-[17%] whitespace-nowrap">หมวดหมู่</th>
                                            <th className="py-1.5 px-1 text-center w-[6%] whitespace-nowrap">หลักฐาน</th>
                                            <th className="py-1.5 pr-2.5 pl-1 text-right w-[13%] whitespace-nowrap">จำนวนเงิน</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-300 font-sans">
                                        {pageRows.map((item, rowIdx) => {
                                            const globalIndex = pageStartOffset + rowIdx + 1;
                                            const rawDate = item.expense_date || item.created_at;
                                            const dateObj = rawDate ? new Date(rawDate) : null;
                                            const dateStr = dateObj ? dateObj.toLocaleDateString('th-TH') : '-';
                                            const docNo = item.receipt_number || item.invoice_number || item.doc_no || (item.id ? `EXP-${String(item.id).slice(0, 6).toUpperCase()}` : '-');
                                            const catLabel = getCleanCategoryLabel(item.category);
                                            const amount = Number(item.amount || 0);

                                            let proofLabel = 'Slip';
                                            let proofClass = 'bg-zinc-100 text-zinc-700';
                                            if (item.doc_type === 'tax_invoice') {
                                                proofLabel = 'Grade A';
                                                proofClass = 'bg-emerald-100 text-emerald-800 font-bold';
                                            } else if (item.doc_type === 'cash_bill') {
                                                proofLabel = 'Grade B';
                                                proofClass = 'bg-blue-100 text-blue-800 font-bold';
                                            }

                                            return (
                                                <tr key={item.id || rowIdx}>
                                                    <td className="py-1.5 px-1 text-center font-mono text-zinc-500 whitespace-nowrap">{globalIndex}</td>
                                                    <td className="py-1.5 px-1.5 font-mono whitespace-nowrap">{dateStr}</td>
                                                    <td className="py-1.5 px-1.5 font-mono font-bold text-zinc-950 whitespace-nowrap truncate">{docNo}</td>
                                                    <td className="py-1.5 px-1.5 truncate font-medium text-zinc-950">
                                                        {item.vendor_name || item.title || 'ค่าใช้จ่ายทั่วไป'}
                                                    </td>
                                                    <td className="py-1.5 px-1.5 font-mono text-[9pt] text-zinc-800 whitespace-nowrap">{formatTaxId(item.vendor_tax_id) || '-'}</td>
                                                    <td className="py-1.5 px-1.5 text-[9.5pt] text-zinc-800 font-normal truncate">{catLabel}</td>
                                                    <td className="py-1.5 px-1 text-center font-mono text-[8pt] whitespace-nowrap">
                                                        <span className={`px-1.5 py-0.5 rounded text-[7.5pt] ${proofClass}`}>
                                                            {proofLabel}
                                                        </span>
                                                    </td>
                                                    <td className="py-1.5 pr-2.5 pl-1 text-right font-mono font-bold text-zinc-950 whitespace-nowrap">
                                                        {amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {pageRows.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className="py-12 text-center text-zinc-500 font-mono">
                                                    ไม่มีรายการค่าใช้จ่ายในงวดที่เลือก
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
                                                จำนวนรายการทั้งหมด: <strong className="text-zinc-950 font-bold">{expenses.length}</strong> รายการ
                                            </div>
                                            <div className="text-[9.5pt] text-zinc-600 pt-0.5 flex flex-wrap gap-x-3">
                                                <span>Grade A (ใบกำกับ): <strong>฿{gradeA.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                                                <span>Grade B (บิลเงินสด): <strong>฿{gradeB.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                                                <span>Grade C: <strong>฿{gradeC.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                                            </div>
                                        </div>
                                        <div className="space-y-1 sm:text-right flex flex-col justify-end">
                                            <div className="flex justify-between sm:justify-end gap-4 text-[12pt] pt-1 border-t border-zinc-300">
                                                <span className="font-bold text-zinc-900">รวมค่าใช้จ่ายทั้งสิ้น (GRAND TOTAL):</span>
                                                <strong className="text-zinc-950 font-black text-[13.5pt]">฿{grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
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
                                                {companySettings?.tax_signer_name || 'ผู้มีอำนาจลงนาม / ผู้ตรวจสอบ'}
                                            </div>
                                            <div className="text-[9.5pt] text-zinc-600">วันที่: {new Date().toLocaleDateString('th-TH')}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Page Footer */}
                            <div className="mt-3 pt-2 border-t border-zinc-300 flex justify-between text-[9pt] font-mono text-zinc-500">
                                <span>IN THE HAUS TAX ENGINE • EXPENSE &amp; PURCHASE LEDGER</span>
                                <span>หน้า / Page {pageIdx + 1} จาก {pages.length}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const portalTarget = typeof document !== 'undefined' ? (document.getElementById('print-portal-root') || document.body) : null;
    return portalTarget ? createPortal(content, portalTarget) : content;
}
