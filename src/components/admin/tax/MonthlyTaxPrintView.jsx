/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React from 'react';
import { Printer, X, Download, FileText, ArrowLeft } from 'lucide-react';
import { formatTaxId, formatBranch, thaiBahtText } from '../../../utils/thaiTaxHelper';
import { EXPENSE_CATEGORIES } from '../../../utils/expenseConstants';

export default function MonthlyTaxPrintView({
    periodMonth,
    selectedExpenses = [],
    companySettings = {},
    enhancedImagesMap = {},
    layoutMode = '2up', // '2up' | '4up' | '1up' | 'cover_only'
    includeCover = true,
    onClose
}) {
    const handlePrint = () => {
        window.print();
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
        <div className="fixed inset-0 z-[230] flex flex-col bg-zinc-950/85 backdrop-blur-md items-center justify-start p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:overflow-visible">
            
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
                        onClick={handlePrint}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase transition-colors flex items-center gap-2 cursor-pointer rounded-xs shadow-md"
                    >
                        <Printer size={15} />
                        <span>PRINT / SAVE AS PDF (พิมพ์ชุดหลักฐาน)</span>
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
            <div className="w-full max-w-4xl space-y-8 print:space-y-0 print:w-full print:max-w-none">
                
                {/* PAGE 1: COVER SHEET (ใบปะหน้าสรุปเอกสารภาษีประจำเดือน) */}
                {includeCover && (
                    <div className="bg-white text-zinc-950 p-8 sm:p-10 border border-zinc-300 shadow-xl font-sans text-xs min-h-[297mm] flex flex-col justify-between print:m-0 print:p-8 print:border-none print:shadow-none print:min-h-screen print:page-break-after-always print:break-after-page">
                        <div>
                            {/* Header Section */}
                            <div className="border-b-2 border-zinc-950 pb-5 flex justify-between items-start gap-6">
                                <div>
                                    <div className="font-mono text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                                        [ OFFICIAL MONTHLY TAX DOSSIER &amp; EXPENSE SUMMARY ]
                                    </div>
                                    <h1 className="font-serif font-black text-2xl uppercase tracking-tight text-zinc-950">
                                        {companySettings?.tax_company_name || 'IN THE HAUS'}
                                    </h1>
                                    {companySettings?.tax_company_name_en && (
                                        <p className="font-mono text-xs text-zinc-600 font-semibold uppercase">
                                            {companySettings.tax_company_name_en}
                                        </p>
                                    )}
                                    <div className="mt-2 text-[11px] text-zinc-700 leading-relaxed max-w-lg">
                                        <p>{companySettings?.tax_address || 'ที่อยู่สถานประกอบการจดทะเบียน'}</p>
                                        <div className="flex flex-wrap gap-x-4 mt-1 font-mono font-medium">
                                            <span>เลขประจำตัวผู้เสียภาษี: <strong className="text-zinc-950">{formatTaxId(companySettings?.tax_id)}</strong></span>
                                            <span>สาขา: <strong>{formatBranch(companySettings?.tax_branch_type, companySettings?.tax_branch_code)}</strong></span>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right shrink-0 border-2 border-zinc-950 p-3.5 bg-zinc-50 min-w-[200px]">
                                    <span className="font-mono text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                                        เอกสารหลักฐานประกอบภาษี
                                    </span>
                                    <span className="font-bold text-base text-zinc-950 block mt-0.5">
                                        ประจำงวดเดือน
                                    </span>
                                    <span className="font-serif font-black text-sm text-[oklch(52%_0.16_28)] block mt-0.5">
                                        {formatThaiMonthYear(periodMonth)}
                                    </span>
                                    <span className="font-mono text-[10px] text-zinc-600 block mt-1 border-t border-zinc-200 pt-1">
                                        รวมทั้งสิ้น {selectedExpenses.length} รายการ
                                    </span>
                                </div>
                            </div>

                            {/* Summary Financial Metric Boxes */}
                            <div className="mt-5 grid grid-cols-3 border border-zinc-950 divide-x divide-zinc-950 bg-zinc-50 text-center font-mono">
                                <div className="p-3.5">
                                    <span className="text-[9px] font-bold text-zinc-500 uppercase block">ยอดรวมค่าใช้จ่ายทั้งสิ้น</span>
                                    <span className="font-black text-lg text-zinc-950 mt-1 block">
                                        ฿{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="p-3.5">
                                    <span className="text-[9px] font-bold text-zinc-500 uppercase block">ภาษีมูลค่าเพิ่ม (VAT 7%)</span>
                                    <span className="font-black text-lg text-zinc-950 mt-1 block">
                                        ฿{totalVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="p-3.5">
                                    <span className="text-[9px] font-bold text-zinc-500 uppercase block">จำนวนชุดเอกสารแนบ</span>
                                    <span className="font-black text-lg text-zinc-950 mt-1 block">
                                        {selectedExpenses.length} บิล
                                    </span>
                                </div>
                            </div>

                            {/* Baht Text Banner */}
                            <div className="mt-2 p-2.5 bg-zinc-100 border border-zinc-900 font-mono text-xs flex justify-between items-center">
                                <span className="text-zinc-600 text-[10px] font-bold">จำนวนเงินตัวอักษร:</span>
                                <span className="font-bold text-zinc-950">({bahtWords})</span>
                            </div>

                            {/* Proof Grade & Category Summary Grid */}
                            <div className="mt-5 grid grid-cols-2 gap-4">
                                {/* Proof Reliability Breakdown */}
                                <div className="border border-zinc-900 p-3 bg-zinc-50 font-mono text-[11px] space-y-1.5">
                                    <div className="font-bold text-[10px] uppercase text-zinc-500 border-b border-zinc-300 pb-1">
                                        [ การจำแนกตามชั้นหลักฐานภาษี (PROOF GRADES) ]
                                    </div>
                                    <div className="flex justify-between py-0.5">
                                        <span>GRADE A (ใบกำกับภาษีเต็มรูป):</span>
                                        <strong className="text-zinc-950">฿{gradeA.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                                    </div>
                                    <div className="flex justify-between py-0.5">
                                        <span>GRADE B (บิลเงินสด + สลิปโอน):</span>
                                        <strong className="text-zinc-950">฿{gradeB.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                                    </div>
                                    <div className="flex justify-between py-0.5">
                                        <span>GRADE C (ใบสำคัญจ่าย / สลิป):</span>
                                        <strong className="text-zinc-950">฿{gradeC.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                                    </div>
                                </div>

                                {/* Top Categories */}
                                <div className="border border-zinc-900 p-3 bg-zinc-50 font-mono text-[11px] space-y-1.5">
                                    <div className="font-bold text-[10px] uppercase text-zinc-500 border-b border-zinc-300 pb-1">
                                        [ ค่าใช้จ่ายแยกตามหมวดหมู่งวด {periodMonth} ]
                                    </div>
                                    {EXPENSE_CATEGORIES.slice(0, 4).map(cat => {
                                        const catTotal = selectedExpenses
                                            .filter(e => e.category === cat.id)
                                            .reduce((s, e) => s + Number(e.amount || 0), 0);
                                        if (catTotal === 0) return null;
                                        return (
                                            <div key={cat.id} className="flex justify-between py-0.5 text-[10px]">
                                                <span className="truncate max-w-[180px]">{cat.label}:</span>
                                                <strong className="text-zinc-950">฿{catTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Itemized Table Index */}
                            <div className="mt-5">
                                <div className="font-mono text-[10px] font-bold text-zinc-500 uppercase mb-1">
                                    [ สารบัญและดัชนีรายการเอกสารแนบ (ATTACHED RECEIPT INDEX) ]
                                </div>
                                <table className="w-full text-left border-collapse border border-zinc-900 font-mono text-[10px]">
                                    <thead>
                                        <tr className="bg-zinc-100 border-b border-zinc-900 uppercase font-bold text-zinc-700">
                                            <th className="p-1.5 border-r border-zinc-900 w-12 text-center">ลำดับ</th>
                                            <th className="p-1.5 border-r border-zinc-900 w-24">วันที่</th>
                                            <th className="p-1.5 border-r border-zinc-900">รายการ / ผู้ขาย (VENDOR)</th>
                                            <th className="p-1.5 border-r border-zinc-900 w-24">หมวดหมู่</th>
                                            <th className="p-1.5 border-r border-zinc-900 w-20 text-center">หลักฐาน</th>
                                            <th className="p-1.5 text-right w-24">ยอดเงิน (บาท)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-200">
                                        {selectedExpenses.map((exp, idx) => {
                                            const catObj = EXPENSE_CATEGORIES.find(c => c.id === exp.category);
                                            return (
                                                <tr key={exp.id || idx}>
                                                    <td className="p-1.5 border-r border-zinc-900 text-center font-bold">#{idx + 1}</td>
                                                    <td className="p-1.5 border-r border-zinc-900">{exp.expense_date || '-'}</td>
                                                    <td className="p-1.5 border-r border-zinc-900">
                                                        <div className="font-bold text-zinc-950 truncate max-w-xs">{exp.title}</div>
                                                        <div className="text-[9px] text-zinc-500 truncate">{exp.vendor_name || '-'}</div>
                                                    </td>
                                                    <td className="p-1.5 border-r border-zinc-900 text-[9px]">{catObj?.label || exp.category}</td>
                                                    <td className="p-1.5 border-r border-zinc-900 text-center text-[9px]">
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
                        <div className="mt-8 pt-4 border-t-2 border-zinc-950 grid grid-cols-2 gap-8 font-mono text-[10px]">
                            <div className="flex flex-col items-center text-center p-3 border border-zinc-300">
                                <div className="w-44 border-b border-zinc-900 pb-8 mb-2"></div>
                                <div className="font-bold text-zinc-950">ผู้จัดทำรายงาน / ฝ่ายบัญชี</div>
                                <div className="text-[9px] text-zinc-500">วันที่: ______/______/__________</div>
                            </div>

                            <div className="flex flex-col items-center text-center p-3 border border-zinc-300">
                                <div className="w-44 border-b border-zinc-900 pb-8 mb-2"></div>
                                <div className="font-bold text-zinc-950">{companySettings?.tax_signature_name || 'ผู้มีอำนาจลงนาม / กรรมการผู้จัดการ'}</div>
                                <div className="text-[9px] text-zinc-500">วันที่: ______/______/__________</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* PAGE 2+: RECEIPT SLIPS PAGES (2-Up, 4-Up, or 1-Up Grid Layouts) */}
                {receiptPages.map((pageItems, pageIdx) => (
                    <div 
                        key={`page-${pageIdx}`}
                        className="bg-white text-zinc-950 p-6 sm:p-8 border border-zinc-300 shadow-xl font-sans text-xs min-h-[297mm] flex flex-col justify-between print:m-0 print:p-6 print:border-none print:shadow-none print:min-h-screen print:page-break-after-always print:break-after-page"
                    >
                        <div>
                            {/* Page Header Strip */}
                            <div className="border-b border-zinc-900 pb-2 mb-4 flex justify-between items-center font-mono text-[10px] text-zinc-500">
                                <div className="flex items-center gap-2">
                                    <strong className="text-zinc-950 uppercase">{companySettings?.tax_company_name || 'IN THE HAUS'}</strong>
                                    <span>• หลักฐานภาษีงวด {periodMonth}</span>
                                </div>
                                <div>
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
                                            className="border border-zinc-900 p-2.5 bg-zinc-50/50 flex flex-col justify-between font-mono"
                                            style={{ minHeight: layoutMode === '1up' ? '700px' : (layoutMode === '4up' ? '340px' : '440px') }}
                                        >
                                            {/* Slip Info Header Box */}
                                            <div className="bg-zinc-100 border border-zinc-900 p-2 mb-2">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <span className="font-bold text-xs text-zinc-950 block">
                                                            REF #{globalIndex} • {exp.title}
                                                        </span>
                                                        <span className="text-[10px] text-zinc-600 block mt-0.5">
                                                            ร้านค้า: {exp.vendor_name || 'ไม่ระบุผู้ขาย'} {exp.vendor_tax_id ? `(TAX: ${exp.vendor_tax_id})` : ''}
                                                        </span>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <span className="font-bold text-sm text-zinc-950 block">
                                                            ฿{Number(exp.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                        </span>
                                                        <span className="text-[9px] text-zinc-500 block">
                                                            {exp.expense_date}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="mt-1 pt-1 border-t border-zinc-300 flex justify-between text-[9px] text-zinc-600">
                                                    <span>หมวดหมู่: {catObj?.label || exp.category}</span>
                                                    <span className="font-bold uppercase">
                                                        {exp.doc_type === 'tax_invoice' ? '[GRADE A: TAX INV]' : (exp.doc_type === 'cash_bill' ? '[GRADE B: CASH BILL]' : '[GRADE C: SLIP]')}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Receipt Enhanced Image Display Viewport */}
                                            <div className="flex-1 border border-zinc-300 bg-white flex items-center justify-center p-1 overflow-hidden min-h-[220px]">
                                                {enhancedSrc ? (
                                                    <img 
                                                        src={enhancedSrc} 
                                                        alt={`Receipt #${globalIndex}`}
                                                        className="max-w-full max-h-full object-contain filter contrast-110"
                                                        style={{ maxHeight: layoutMode === '1up' ? '650px' : (layoutMode === '4up' ? '260px' : '380px') }}
                                                    />
                                                ) : (
                                                    <div className="text-center text-zinc-400 p-4 text-[10px]">
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
                        <div className="mt-4 pt-2 border-t border-zinc-300 flex justify-between text-[9px] font-mono text-zinc-400">
                            <span>IN THE HAUS TAX ENGINE • DOCUMENT ARCHIVE</span>
                            <span>CONFIDENTIAL FINANCIAL RECORDS</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
