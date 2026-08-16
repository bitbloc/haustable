/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React from 'react';
import { Printer, X, Copy, Check } from 'lucide-react';
import { thaiBahtText, formatTaxId, formatBranch } from '../../../utils/thaiTaxHelper';
import { toast } from 'sonner';

export default function TaxInvoicePrintView({ invoice, companySettings, onClose }) {
    const [copied, setCopied] = React.useState(false);
    const [activeCopyType, setActiveCopyType] = React.useState('original'); // 'original' | 'copy'

    if (!invoice) return null;

    const isVat = Boolean(invoice.doc_type === 'tax_invoice' || (invoice.vat_amount && Number(invoice.vat_amount) > 0));
    const docTitle = isVat ? 'ใบเสร็จรับเงิน / ใบกำกับภาษี' : 'ใบเสร็จรับเงิน';
    const docTitleEn = isVat ? 'RECEIPT / TAX INVOICE' : 'OFFICIAL RECEIPT';
    const copyLabel = activeCopyType === 'original' ? 'ต้นฉบับ (ORIGINAL)' : 'สำเนา (COPY)';
    const copySubtitle = activeCopyType === 'original' 
        ? '(เอกสารออกเป็นชุด: ต้นฉบับสำหรับผู้ซื้อ / ผู้รับบริการ)' 
        : '(เอกสารออกเป็นชุด: สำเนาสำหรับผู้ขาย / แผนกบัญชี)';

    const handlePrint = () => {
        window.print();
    };

    const handleCopyJson = () => {
        navigator.clipboard.writeText(JSON.stringify(invoice, null, 2));
        setCopied(true);
        toast.success('คัดลอกข้อมูลเอกสารเรียบร้อย');
        setTimeout(() => setCopied(false), 2000);
    };

    const items = Array.isArray(invoice.items) ? invoice.items : [];
    const formattedDate = invoice.issued_at 
        ? new Date(invoice.issued_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
        : new Date().toLocaleDateString('th-TH');

    const bahtWords = thaiBahtText(invoice.total_amount || invoice.net_payable || 0);

    return (
        <div className="fixed inset-0 z-[200] flex flex-col bg-zinc-950/80 backdrop-blur-md items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white">
            {/* Top Toolbar (Non-printable) */}
            <div className="w-full max-w-4xl bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-4 sm:px-6 py-3 border border-[oklch(85%_0.012_28)] flex flex-wrap items-center justify-between font-mono text-xs mb-3 print:hidden gap-3 shadow-2xl">
                <div className="flex items-center gap-3">
                    <span className="font-bold text-[oklch(52%_0.16_28)] uppercase tracking-wider">
                        [ {isVat ? 'FULL TAX INVOICE' : 'OFFICIAL RECEIPT'} ]
                    </span>
                    <span className="text-zinc-400 font-mono">
                        #{invoice.invoice_number}
                    </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Original / Copy Toggle */}
                    <div className="flex border border-zinc-700 bg-zinc-900 rounded overflow-hidden text-[11px]">
                        <button
                            onClick={() => setActiveCopyType('original')}
                            className={`px-3 py-1 font-mono transition-colors ${activeCopyType === 'original' ? 'bg-[oklch(52%_0.16_28)] text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
                        >
                            ต้นฉบับ (Original)
                        </button>
                        <button
                            onClick={() => setActiveCopyType('copy')}
                            className={`px-3 py-1 font-mono transition-colors ${activeCopyType === 'copy' ? 'bg-[oklch(52%_0.16_28)] text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
                        >
                            สำเนา (Copy)
                        </button>
                    </div>

                    <button
                        onClick={handlePrint}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase transition-colors flex items-center gap-1.5 rounded cursor-pointer"
                    >
                        <Printer size={14} />
                        <span>พิมพ์เอกสาร (Print / PDF)</span>
                    </button>

                    <button
                        onClick={handleCopyJson}
                        className="px-3 py-1.5 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors flex items-center gap-1 rounded cursor-pointer"
                        title="Copy Raw Data"
                    >
                        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        <span className="hidden sm:inline">JSON</span>
                    </button>

                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 border border-zinc-700 hover:bg-zinc-800 text-white uppercase transition-colors rounded cursor-pointer"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* A4 Printable Document Container */}
            <div 
                id="tax-invoice-printable-sheet"
                className="w-full max-w-4xl bg-white text-zinc-900 p-6 sm:p-10 border border-zinc-300 shadow-2xl font-sans text-xs print:m-0 print:p-8 print:border-none print:shadow-none print:w-full print:max-w-none min-h-[297mm] flex flex-col justify-between"
            >
                <div>
                    {/* Header Section */}
                    <div className="flex justify-between items-start border-b-2 border-zinc-900 pb-5 gap-6">
                        {/* Company / Issuer Info */}
                        <div className="flex-1">
                            <h1 className="font-bold text-lg sm:text-xl uppercase tracking-tight text-zinc-950 font-serif">
                                {companySettings?.tax_company_name || invoice.issuer_name || 'IN THE HAUS'}
                            </h1>
                            {companySettings?.tax_company_name_en && (
                                <p className="font-mono text-xs text-zinc-600 uppercase font-semibold">
                                    {companySettings.tax_company_name_en}
                                </p>
                            )}
                            <div className="mt-2 text-[11px] text-zinc-700 leading-relaxed max-w-lg">
                                <p>{companySettings?.tax_address || invoice.issuer_address || 'ที่อยู่จดทะเบียนร้านค้า'}</p>
                                <div className="flex flex-wrap gap-x-4 mt-1 font-mono font-medium">
                                    <span>เลขประจำตัวผู้เสียภาษี: <strong className="text-zinc-950">{formatTaxId(companySettings?.tax_id || invoice.issuer_tax_id)}</strong></span>
                                    <span>สถานประกอบการ: <strong>{formatBranch(companySettings?.tax_branch_type, companySettings?.tax_branch_code)}</strong></span>
                                </div>
                                <div className="flex flex-wrap gap-x-4 font-mono text-zinc-600 mt-0.5">
                                    {companySettings?.tax_phone && <span>โทร: {companySettings.tax_phone}</span>}
                                    {companySettings?.tax_email && <span>อีเมล: {companySettings.tax_email}</span>}
                                </div>
                            </div>
                        </div>

                        {/* Document Title & Number Badge */}
                        <div className="text-right flex flex-col items-end shrink-0">
                            <div className="border-2 border-zinc-900 px-4 py-2 bg-zinc-50 text-right min-w-[200px]">
                                <span className="font-bold text-sm sm:text-base block text-zinc-950 leading-tight">
                                    {docTitle}
                                </span>
                                <span className="font-mono text-[10px] font-bold text-zinc-600 uppercase tracking-wider block">
                                    {docTitleEn}
                                </span>
                                <span className="font-mono text-[9px] font-bold text-[oklch(52%_0.16_28)] uppercase tracking-wider block mt-1">
                                    {copyLabel}
                                </span>
                            </div>

                            <div className="mt-2 font-mono text-[11px] space-y-0.5 text-right">
                                <div><span className="text-zinc-500">เลขที่ / No:</span> <strong className="text-zinc-950 font-bold">{invoice.invoice_number}</strong></div>
                                <div><span className="text-zinc-500">วันที่ / Date:</span> <span className="text-zinc-900">{formattedDate}</span></div>
                                {invoice.booking_id && (
                                    <div className="text-[10px] text-zinc-500">
                                        อ้างอิงบิล POS: #{String(invoice.booking_id).slice(0, 8)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Copy Subtitle Indicator */}
                    <div className="text-right text-[10px] font-mono text-zinc-500 mt-1 italic">
                        {copySubtitle}
                    </div>

                    {/* Customer Info Box */}
                    <div className="mt-4 border border-zinc-900 bg-zinc-50/70 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                                [ ข้อมูลผู้ซื้อสินค้า / ผู้รับบริการ (CUSTOMER INFO) ]
                            </div>
                            <div className="font-bold text-sm text-zinc-950">
                                {invoice.customer_name || 'ลูกค้าทั่วไป (Cash Customer)'}
                            </div>
                            <div className="text-[11px] text-zinc-700 leading-relaxed mt-1">
                                {invoice.customer_address || '-'}
                            </div>
                        </div>

                        <div className="flex flex-col justify-end md:items-end font-mono text-[11px] space-y-1">
                            <div>
                                <span className="text-zinc-500">เลขประจำตัวผู้เสียภาษี: </span>
                                <strong className="text-zinc-950">{formatTaxId(invoice.customer_tax_id)}</strong>
                            </div>
                            <div>
                                <span className="text-zinc-500">สถานประกอบการ: </span>
                                <span className="text-zinc-900">{formatBranch(invoice.customer_branch_type, invoice.customer_branch_code)}</span>
                            </div>
                            {invoice.customer_phone && (
                                <div>
                                    <span className="text-zinc-500">เบอร์โทรศัพท์: </span>
                                    <span className="text-zinc-900">{invoice.customer_phone}</span>
                                </div>
                            )}
                            {invoice.customer_email && (
                                <div>
                                    <span className="text-zinc-500">อีเมล: </span>
                                    <span className="text-zinc-900">{invoice.customer_email}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="mt-5">
                        <table className="w-full text-left border-collapse border border-zinc-900 text-[11px]">
                            <thead>
                                <tr className="bg-zinc-100 border-b-2 border-zinc-900 font-mono text-[10px] uppercase">
                                    <th className="p-2.5 border-r border-zinc-900 w-10 text-center">ลำดับ<br/>(No.)</th>
                                    <th className="p-2.5 border-r border-zinc-900">รายการสินค้า / บริการ<br/>(Description)</th>
                                    <th className="p-2.5 border-r border-zinc-900 w-20 text-center">จำนวน<br/>(Qty)</th>
                                    <th className="p-2.5 border-r border-zinc-900 w-28 text-right">ราคาต่อหน่วย<br/>(Unit Price)</th>
                                    <th className="p-2.5 w-28 text-right">จำนวนเงิน (บาท)<br/>(Amount THB)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => {
                                    const qty = Number(item.quantity || 1);
                                    const unitPrice = Number(item.price || item.price_at_time || 0);
                                    const amount = Number(item.amount || (qty * unitPrice));

                                    return (
                                        <tr key={idx} className="border-b border-zinc-300">
                                            <td className="p-2.5 border-r border-zinc-900 text-center font-mono">{idx + 1}</td>
                                            <td className="p-2.5 border-r border-zinc-900">
                                                <div className="font-semibold text-zinc-950">{item.name || item.item_name}</div>
                                                {item.selected_options && (
                                                    <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{item.selected_options}</div>
                                                )}
                                            </td>
                                            <td className="p-2.5 border-r border-zinc-900 text-center font-mono">{qty}</td>
                                            <td className="p-2.5 border-r border-zinc-900 text-right font-mono">{unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                            <td className="p-2.5 text-right font-mono font-semibold">{amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    );
                                })}

                                {items.length === 0 && (
                                    <tr className="border-b border-zinc-300">
                                        <td colSpan={5} className="p-8 text-center text-zinc-400 italic">
                                            ไม่มีรายการย่อย
                                        </td>
                                    </tr>
                                )}

                                {/* Blank rows filler for aesthetic A4 balance */}
                                {items.length < 5 && Array.from({ length: Math.max(0, 5 - items.length) }).map((_, i) => (
                                    <tr key={`filler-${i}`} className="border-b border-zinc-200 text-transparent select-none">
                                        <td className="p-2 border-r border-zinc-900 text-center font-mono">-</td>
                                        <td className="p-2 border-r border-zinc-900">-</td>
                                        <td className="p-2 border-r border-zinc-900 text-center font-mono">-</td>
                                        <td className="p-2 border-r border-zinc-900 text-right font-mono">-</td>
                                        <td className="p-2 text-right font-mono">-</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary & Totals Calculation Block */}
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                        {/* Baht Text Box & Non-VAT Notice */}
                        <div className="border border-zinc-900 p-3 bg-zinc-50 flex flex-col justify-between min-h-[110px]">
                            <div>
                                <span className="font-mono text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">
                                    [ จำนวนเงินตัวอักษร / AMOUNT IN WORDS ]
                                </span>
                                <div className="font-bold text-zinc-950 text-sm mt-1">
                                    ({bahtWords})
                                </div>
                            </div>

                            <div className="font-mono text-[9px] text-zinc-500 mt-2 pt-2 border-t border-zinc-200">
                                {!isVat ? (
                                    <span className="text-zinc-600 font-semibold">
                                        * เอกสารนี้ไม่อยู่ในบังคับภาษีมูลค่าเพิ่ม (Non-VAT) / ใช้เป็นหลักฐานรายจ่ายได้ถูกต้องตามกฎหมาย
                                    </span>
                                ) : (
                                    <span>
                                        * ภาษีมูลค่าเพิ่มคำนวณตามประมวลรัษฎากร มาตรา 86/4
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Numeric Breakdown Table */}
                        <div className="border border-zinc-900 divide-y divide-zinc-300 font-mono text-[11px]">
                            <div className="flex justify-between p-2">
                                <span className="text-zinc-600">รวมเป็นเงิน (Subtotal):</span>
                                <span className="font-semibold text-zinc-950">฿{Number(invoice.subtotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                            </div>

                            {Number(invoice.discount_amount || 0) > 0 && (
                                <div className="flex justify-between p-2 bg-amber-50/50 text-amber-900">
                                    <span>หักส่วนลด (Discount):</span>
                                    <span className="font-semibold">-฿{Number(invoice.discount_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}

                            {isVat && (
                                <>
                                    <div className="flex justify-between p-2">
                                        <span className="text-zinc-600">มูลค่าสินค้า/บริการก่อนภาษี (Pre-VAT):</span>
                                        <span className="font-semibold text-zinc-950">฿{Number(invoice.pre_vat_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between p-2">
                                        <span className="text-zinc-600">ภาษีมูลค่าเพิ่ม 7% (VAT):</span>
                                        <span className="font-semibold text-zinc-950">฿{Number(invoice.vat_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </>
                            )}

                            <div className="flex justify-between p-2.5 bg-zinc-100 font-bold text-xs sm:text-sm text-zinc-950">
                                <span>จำนวนเงินรวมทั้งสิ้น (Grand Total):</span>
                                <span>฿{Number(invoice.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                            </div>

                            {Number(invoice.wht_amount || 0) > 0 && (
                                <>
                                    <div className="flex justify-between p-2 text-zinc-600 bg-zinc-50">
                                        <span>หักภาษี ณ ที่จ่าย {invoice.wht_rate}% (WHT):</span>
                                        <span className="text-red-600 font-semibold">-฿{Number(invoice.wht_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between p-2.5 bg-zinc-900 text-white font-bold text-sm">
                                        <span>ยอดเงินที่ต้องชำระสุทธิ (Net Payable):</span>
                                        <span>฿{Number(invoice.net_payable || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Signatures & Footer Section */}
                <div className="mt-8 pt-4 border-t-2 border-zinc-900 grid grid-cols-2 gap-8 font-mono text-[11px]">
                    <div className="flex flex-col items-center justify-end text-center p-3 border border-zinc-300">
                        <div className="w-48 border-b border-zinc-900 pb-8 mb-2"></div>
                        <div className="font-bold text-zinc-950">ผู้รับสินค้าหรือบริการ</div>
                        <div className="text-[10px] text-zinc-500">วันที่ / Date: ______/______/__________</div>
                    </div>

                    <div className="flex flex-col items-center justify-end text-center p-3 border border-zinc-300">
                        <div className="w-48 border-b border-zinc-900 pb-8 mb-2"></div>
                        <div className="font-bold text-zinc-950">{companySettings?.tax_signature_name || 'ผู้รับเงิน / ผู้มีอำนาจลงนาม'}</div>
                        <div className="text-[10px] text-zinc-500">วันที่ / Date: {formattedDate}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
