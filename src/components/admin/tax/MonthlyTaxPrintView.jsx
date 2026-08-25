/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState } from 'react';
import { Printer, X, Download, FileText, ArrowLeft, Loader2 } from 'lucide-react';
import { formatTaxId, formatBranch, thaiBahtText } from '../../../utils/thaiTaxHelper';
import { generateTaxDocumentPdf, downloadTaxPdf } from '../../../utils/taxPdfHelper';
import { EXPENSE_CATEGORIES } from '../../../utils/expenseConstants';
import { toast } from 'sonner';

export default function MonthlyTaxPrintView({
    periodMonth,
    selectedExpenses = [],
    companySettings = {},
    enhancedImagesMap = {},
    layoutMode = '2up', // '2up' | '4up' | '1up' | 'cover_only'
    includeCover = true,
    onClose
}) {
    const [downloadingPdf, setDownloadingPdf] = useState(false);

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPdf = async () => {
        const sheetElement = document.getElementById('monthly-tax-printable-container');
        if (!sheetElement) {
            toast.error('ไม่พบเนื้อหาเอกสารสำหรับสร้าง PDF');
            return;
        }

        setDownloadingPdf(true);
        const toastId = toast.loading('กำลังสร้างชุดเอกสาร PDF คุณภาพสูง...');
        try {
            const fileName = `Monthly_Tax_Dossier_${periodMonth || 'Period'}.pdf`;
            const { blob } = await generateTaxDocumentPdf(sheetElement, { fileName });
            downloadTaxPdf(blob, fileName);
            toast.success(`ดาวน์โหลดเอกสาร ${fileName} เรียบร้อยแล้ว`, { id: toastId });
        } catch (err) {
            console.error('Failed to generate monthly tax PDF:', err);
            toast.error('เกิดข้อผิดพลาดในการสร้าง PDF กรุณาลองใช้ปุ่มพิมพ์รายงาน (Print)', { id: toastId });
        } finally {
            setDownloadingPdf(false);
        }
    };

    // Calculate Totals
    const totalAmount = selectedExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const totalVat = selectedExpenses.reduce((s, e) => s + Number(e.vat_amount || 0), 0);
    const gradeA = selectedExpenses.filter(e => e.doc_type === 'tax_invoice').reduce((s, e) => s + Number(e.amount || 0), 0);
    const gradeB = selectedExpenses.filter(e => e.doc_type === 'cash_bill').reduce((s, e) => s + Number(e.amount || 0), 0);
    const gradeC = selectedExpenses.filter(e => e.doc_type === 'receipt_voucher' || e.doc_type === 'slip_only').reduce((s, e) => s + Number(e.amount || 0), 0);

    const bahtWords = thaiBahtText(totalAmount);

    // Group expenses into pages based on layoutMode
    const itemsPerPage = layoutMode === '4up' ? 4 : (layoutMode === '1up' ? 1 : 2);
    const receiptPages = [];
    if (layoutMode !== 'cover_only') {
        for (let i = 0; i < selectedExpenses.length; i += itemsPerPage) {
            receiptPages.push(selectedExpenses.slice(i, i + itemsPerPage));
        }
    }

    const formatThaiMonthYear = (monthStr) => {
        if (!monthStr) return '';
        const [year, month] = monthStr.split('-');
        const monthNames = [
            'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
        ];
        const mIdx = parseInt(month, 10) - 1;
        const thYear = parseInt(year, 10) + 543;
        return `${monthNames[mIdx] || month} พ.ศ. ${thYear}`;
    };

    return (
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
                    body > * {
                        visibility: hidden !important;
                    }
                    #monthly-tax-printable-container,
                    #monthly-tax-printable-container * {
                        visibility: visible !important;
                    }
                    #monthly-tax-printable-container {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        display: block !important;
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
                        [ MONTHLY TAX DOSSIER PRINT VIEW ]
                    </span>
                    <span className="text-zinc-400">
                        {periodMonth} ({selectedExpenses.length} RECEIPTS)
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDownloadPdf}
                        disabled={downloadingPdf}
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors flex items-center gap-1.5 cursor-pointer rounded-xs shadow-md disabled:opacity-50"
                    >
                        {downloadingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        <span>DOWNLOAD PDF</span>
                    </button>

                    <button
                        onClick={handlePrint}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase transition-colors flex items-center gap-2 cursor-pointer rounded-xs shadow-md"
                    >
                        <Printer size={15} />
                        <span>PRINT / SAVE AS PDF</span>
                    </button>

                    <button
                        onClick={onClose}
                        className="p-2 border border-zinc-700 hover:bg-zinc-800 text-white transition-colors cursor-pointer rounded-xs"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Printable Container (A4 Multi-page Stack) */}
            <div id="monthly-tax-printable-container" className="w-full max-w-4xl space-y-8 print:space-y-0 print:w-full print:max-w-none">
                
                {/* PAGE 1: COVER SHEET (ใบปะหน้าสรุปเอกสารภาษีประจำเดือน) */}
                {includeCover && (
                    <div 
                        style={{ fontFamily: "'Sarabun', 'Leelawadee', 'TH Sarabun New', system-ui, -apple-system, sans-serif" }}
                        className="print-page-sheet bg-white text-zinc-950 p-6 sm:p-8 border border-zinc-300 shadow-xl text-[11.5pt] min-h-[285mm] flex flex-col justify-between print:m-0 print:p-8 print:border-none print:shadow-none print:page-break-after-always print:break-after-page"
                    >
                        <div>
                            {/* Header Section */}
                            <div className="border-b-2 border-zinc-950 pb-4 flex justify-between items-start gap-6">
                                <div className="flex items-start gap-4 flex-1 min-w-0">
                                    {/* In The Haus Logo */}
                                    <div className="shrink-0 pt-1">
                                        <img 
                                            src={companySettings?.tax_logo_url || companySettings?.receipt_shop_logo_url || companySettings?.shop_logo_url || '/logo.png'} 
                                            alt="IN THE HAUS" 
                                            className="w-16 h-16 sm:w-20 sm:h-20 object-contain object-left-top shrink-0"
                                            crossOrigin="anonymous"
                                            onError={(e) => {
                                                if (e.target.src !== `${window.location.origin}/logo.png`) {
                                                    e.target.src = '/logo.png';
                                                }
                                            }}
                                        />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="font-mono text-[10pt] font-bold text-zinc-600 uppercase tracking-wider mb-0.5">
                                            [ OFFICIAL MONTHLY TAX DOSSIER &amp; EXPENSE SUMMARY ]
                                        </div>
                                        <h1 className="font-bold text-[18pt] sm:text-[20pt] uppercase tracking-tight text-zinc-950 leading-tight">
                                            {companySettings?.tax_company_name || 'IN THE HAUS'}
                                        </h1>
                                        {companySettings?.tax_company_name_en && (
                                            <p className="font-mono text-[11pt] text-zinc-600 font-semibold uppercase mt-0.5">
                                                {companySettings.tax_company_name_en}
                                            </p>
                                        )}
                                        <div className="mt-1.5 text-[11.5pt] text-zinc-800 leading-relaxed max-w-lg">
                                            <p>{companySettings?.tax_address || '788/1 สุนทรวิจิตร ในเมือง เมืองนครพนม 48000'}</p>
                                            <div className="flex flex-wrap gap-x-4 mt-0.5 font-mono text-[11pt]">
                                                <span>เลขประจำตัวผู้เสียภาษี: <strong className="text-zinc-950 font-bold">{formatTaxId(companySettings?.tax_id)}</strong></span>
                                                <span>สาขา: <strong className="text-zinc-950 font-bold">{formatBranch(companySettings?.tax_branch_type, companySettings?.tax_branch_code)}</strong></span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right shrink-0 border-2 border-zinc-950 p-4 bg-zinc-50 min-w-[210px]">
                                    <span className="font-mono text-[10pt] font-bold text-zinc-600 uppercase tracking-wider block">
                                        เอกสารหลักฐานประกอบภาษี
                                    </span>
                                    <span className="font-bold text-[13pt] text-zinc-950 block mt-0.5">
                                        ประจำงวดเดือน
                                    </span>
                                    <span className="font-bold text-[14pt] text-[#a33716] block mt-0.5">
                                        {formatThaiMonthYear(periodMonth)}
                                    </span>
                                    <span className="font-mono text-[10.5pt] text-zinc-600 block mt-1.5 border-t border-zinc-300 pt-1">
                                        รวมทั้งสิ้น {selectedExpenses.length} รายการ
                                    </span>
                                </div>
                            </div>

                            {/* Summary Financial Metric Boxes */}
                            <div className="mt-4 grid grid-cols-3 border-2 border-zinc-950 divide-x-2 divide-zinc-950 bg-zinc-50 text-center font-mono">
                                <div className="p-3">
                                    <span className="text-[10pt] font-bold text-zinc-600 uppercase block">ยอดรวมค่าใช้จ่ายทั้งสิ้น</span>
                                    <span className="font-black text-[15pt] sm:text-[17pt] text-zinc-950 mt-0.5 block">
                                        ฿{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="p-3">
                                    <span className="text-[10pt] font-bold text-zinc-600 uppercase block">ภาษีมูลค่าเพิ่ม (VAT 7%)</span>
                                    <span className="font-black text-[15pt] sm:text-[17pt] text-zinc-950 mt-0.5 block">
                                        ฿{totalVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="p-3">
                                    <span className="text-[10pt] font-bold text-zinc-600 uppercase block">จำนวนชุดเอกสารแนบ</span>
                                    <span className="font-black text-[15pt] sm:text-[17pt] text-zinc-950 mt-0.5 block">
                                        {selectedExpenses.length} บิล
                                    </span>
                                </div>
                            </div>

                            {/* Baht Text Banner */}
                            <div className="mt-2.5 p-3 bg-zinc-100 border-2 border-zinc-950 font-mono text-[11.5pt] flex justify-between items-center">
                                <span className="text-zinc-600 text-[10.5pt] font-bold">จำนวนเงินตัวอักษร:</span>
                                <span className="font-bold text-zinc-950 text-[12.5pt]">({bahtWords})</span>
                            </div>

                            {/* Proof Grade & Category Summary Grid */}
                            <div className="mt-4 grid grid-cols-2 gap-4">
                                {/* Proof Reliability Breakdown */}
                                <div className="border-2 border-zinc-950 p-3 bg-zinc-50 font-mono text-[11pt] space-y-1.5">
                                    <div className="font-bold text-[10.5pt] uppercase text-zinc-700 border-b border-zinc-300 pb-1">
                                        [ การจำแนกตามชั้นหลักฐานภาษี (PROOF GRADES) ]
                                    </div>
                                    <div className="flex justify-between py-0.5">
                                        <span>GRADE A (ใบกำกับภาษีเต็มรูป):</span>
                                        <strong className="text-zinc-950 font-bold">฿{gradeA.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                                    </div>
                                    <div className="flex justify-between py-0.5">
                                        <span>GRADE B (บิลเงินสด + สลิปโอน):</span>
                                        <strong className="text-zinc-950 font-bold">฿{gradeB.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                                    </div>
                                    <div className="flex justify-between py-0.5">
                                        <span>GRADE C (ใบสำคัญจ่าย / สลิป):</span>
                                        <strong className="text-zinc-950 font-bold">฿{gradeC.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                                    </div>
                                </div>

                                {/* Top Categories */}
                                <div className="border-2 border-zinc-950 p-3 bg-zinc-50 font-mono text-[11pt] space-y-1.5">
                                    <div className="font-bold text-[10.5pt] uppercase text-zinc-700 border-b border-zinc-300 pb-1">
                                        [ ค่าใช้จ่ายแยกตามหมวดหมู่งวด {periodMonth} ]
                                    </div>
                                    {EXPENSE_CATEGORIES.slice(0, 4).map(cat => {
                                        const catTotal = selectedExpenses
                                            .filter(e => e.category === cat.id)
                                            .reduce((s, e) => s + Number(e.amount || 0), 0);
                                        if (catTotal === 0) return null;
                                        return (
                                            <div key={cat.id} className="flex justify-between py-0.5 text-[10.5pt]">
                                                <span className="truncate max-w-[180px]">{cat.label}:</span>
                                                <strong className="text-zinc-950 font-bold">฿{catTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Itemized Table Index */}
                            <div className="mt-4">
                                <div className="font-mono text-[10.5pt] font-bold text-zinc-700 uppercase mb-1">
                                    [ สารบัญและดัชนีรายการเอกสารแนบ (ATTACHED RECEIPT INDEX) ]
                                </div>
                                <table className="w-full text-left border-collapse border-2 border-zinc-950 font-mono text-[10.5pt]">
                                    <thead>
                                        <tr className="bg-zinc-100 border-b-2 border-zinc-950 uppercase font-bold text-zinc-900">
                                            <th className="p-2 border-r border-zinc-950 w-14 text-center">ลำดับ</th>
                                            <th className="p-2 border-r border-zinc-950 w-28">วันที่</th>
                                            <th className="p-2 border-r border-zinc-950">รายการ / ผู้ขาย (VENDOR)</th>
                                            <th className="p-2 border-r border-zinc-950 w-28">หมวดหมู่</th>
                                            <th className="p-2 border-r border-zinc-950 w-24 text-center">หลักฐาน</th>
                                            <th className="p-2 text-right w-28">ยอดเงิน (บาท)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-300">
                                        {selectedExpenses.map((exp, idx) => {
                                            const catObj = EXPENSE_CATEGORIES.find(c => c.id === exp.category);
                                            return (
                                                <tr key={exp.id || idx}>
                                                    <td className="p-1.5 border-r border-zinc-950 text-center font-bold">#{idx + 1}</td>
                                                    <td className="p-1.5 border-r border-zinc-950">{exp.expense_date || '-'}</td>
                                                    <td className="p-1.5 border-r border-zinc-950">
                                                        <div className="font-bold text-zinc-950 truncate max-w-xs">{exp.title}</div>
                                                        <div className="text-[9.5pt] text-zinc-600 truncate">{exp.vendor_name || '-'}</div>
                                                    </td>
                                                    <td className="p-1.5 border-r border-zinc-950 text-[10pt]">{catObj?.label || exp.category}</td>
                                                    <td className="p-1.5 border-r border-zinc-950 text-center text-[10pt]">
                                                        {exp.doc_type === 'tax_invoice' ? 'GRADE A' : (exp.doc_type === 'cash_bill' ? 'GRADE B' : 'GRADE C')}
                                                    </td>
                                                    <td className="p-1.5 text-right font-bold text-zinc-950">
                                                        ฿{Number(exp.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Signatures Footer */}
                        <div className="mt-6 pt-3.5 border-t-2 border-zinc-950 grid grid-cols-2 gap-8 font-mono text-[11pt]">
                            <div className="flex flex-col items-center text-center p-3 border border-zinc-300">
                                <div className="w-48 border-b border-zinc-950 pb-8 mb-2"></div>
                                <div className="font-bold text-zinc-950 text-[11.5pt]">ผู้จัดทำรายงาน / ฝ่ายบัญชี</div>
                                <div className="text-[10pt] text-zinc-600">วันที่: ______/______/__________</div>
                            </div>

                            <div className="flex flex-col items-center text-center p-3 border border-zinc-300">
                                <div className="w-48 border-b border-zinc-950 pb-8 mb-2"></div>
                                <div className="font-bold text-zinc-950 text-[11.5pt]">{companySettings?.tax_signature_name || 'ผู้มีอำนาจลงนาม / กรรมการผู้จัดการ'}</div>
                                <div className="text-[10pt] text-zinc-600">วันที่: ______/______/__________</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* PAGE 2+: RECEIPT SLIPS PAGES (2-Up, 4-Up, or 1-Up Grid Layouts) */}
                {receiptPages.map((pageItems, pageIdx) => (
                    <div 
                        key={`page-${pageIdx}`}
                        style={{ fontFamily: "'Sarabun', 'Leelawadee', 'TH Sarabun New', system-ui, -apple-system, sans-serif" }}
                        className="print-page-sheet bg-white text-zinc-950 p-6 sm:p-8 border border-zinc-300 shadow-xl text-[11pt] min-h-[285mm] flex flex-col justify-between print:m-0 print:p-6 print:border-none print:shadow-none print:page-break-after-always print:break-after-page"
                    >
                        <div>
                            {/* Page Header Strip */}
                            <div className="border-b-2 border-zinc-950 pb-2 mb-3.5 flex justify-between items-center font-mono text-[10.5pt] text-zinc-600">
                                <div className="flex items-center gap-2">
                                    <strong className="text-zinc-950 uppercase font-bold">{companySettings?.tax_company_name || 'IN THE HAUS'}</strong>
                                    <span>• หลักฐานภาษีงวด {periodMonth}</span>
                                </div>
                                <div className="font-bold text-zinc-950">
                                    ATTACHED SLIPS PAGE {pageIdx + 1} / {receiptPages.length}
                                </div>
                            </div>

                            {/* Slips Layout Grid */}
                            <div className={`grid gap-4 ${
                                layoutMode === '4up' 
                                    ? 'grid-cols-2 grid-rows-2' 
                                    : (layoutMode === '1up' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2')
                            }`}>
                                {pageItems.map((exp, itemIdx) => {
                                    const globalIndex = (pageIdx * itemsPerPage) + itemIdx + 1;
                                    const enhancedSrc = enhancedImagesMap[exp.id] || exp.receipt_image_url;
                                    const catObj = EXPENSE_CATEGORIES.find(c => c.id === exp.category);

                                    return (
                                        <div 
                                            key={exp.id || itemIdx}
                                            className="border-2 border-zinc-950 p-3 bg-zinc-50/50 flex flex-col justify-between font-mono"
                                            style={{ minHeight: layoutMode === '1up' ? '700px' : (layoutMode === '4up' ? '340px' : '440px') }}
                                        >
                                            {/* Slip Info Header Box */}
                                            <div className="bg-zinc-100 border border-zinc-950 p-2.5 mb-2">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <span className="font-bold text-[11.5pt] text-zinc-950 block">
                                                            REF #{globalIndex} • {exp.title}
                                                        </span>
                                                        <span className="text-[10.5pt] text-zinc-700 block mt-0.5 font-medium">
                                                            ร้านค้า: {exp.vendor_name || 'ไม่ระบุผู้ขาย'} {exp.vendor_tax_id ? `(TAX: ${exp.vendor_tax_id})` : ''}
                                                        </span>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <span className="font-bold text-[13pt] text-zinc-950 block">
                                                            ฿{Number(exp.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                        </span>
                                                        <span className="text-[10pt] text-zinc-600 block">
                                                            {exp.expense_date}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="mt-1.5 pt-1.5 border-t border-zinc-300 flex justify-between text-[10pt] text-zinc-700">
                                                    <span>หมวดหมู่: {catObj?.label || exp.category}</span>
                                                    <span className="font-bold uppercase text-zinc-950">
                                                        {exp.doc_type === 'tax_invoice' ? '[GRADE A: TAX INV]' : (exp.doc_type === 'cash_bill' ? '[GRADE B: CASH BILL]' : '[GRADE C: SLIP]')}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Receipt Enhanced Image Display Viewport */}
                                            <div className="flex-1 border border-zinc-400 bg-white flex items-center justify-center p-1.5 overflow-hidden min-h-[220px]">
                                                {enhancedSrc ? (
                                                    <img 
                                                        src={enhancedSrc} 
                                                        alt={`Receipt #${globalIndex}`}
                                                        className="max-w-full max-h-full object-contain filter contrast-110"
                                                        style={{ maxHeight: layoutMode === '1up' ? '650px' : (layoutMode === '4up' ? '260px' : '380px') }}
                                                    />
                                                ) : (
                                                    <div className="text-center text-zinc-500 p-4 text-[11pt]">
                                                        [ไม่มีรูปภาพใบเสร็จแนบ]
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Page Bottom Footer */}
                        <div className="mt-4 pt-2 border-t border-zinc-300 flex justify-between text-[10pt] font-mono text-zinc-500">
                            <span>IN THE HAUS TAX ENGINE • DOCUMENT ARCHIVE</span>
                            <span>CONFIDENTIAL FINANCIAL RECORDS</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
