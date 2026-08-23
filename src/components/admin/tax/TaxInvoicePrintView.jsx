/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect } from 'react';
import { 
    Printer, 
    X, 
    Copy, 
    Check, 
    Mail, 
    PenTool, 
    Send, 
    ExternalLink, 
    Share2, 
    FileText, 
    CheckCircle2, 
    Sparkles,
    Eye,
    EyeOff
} from 'lucide-react';
import { thaiBahtText, formatTaxId, formatBranch } from '../../../utils/thaiTaxHelper';
import { supabase } from '../../../lib/supabaseClient';
import { toast } from 'sonner';

export default function TaxInvoicePrintView({ invoice, companySettings, onClose }) {
    const [copied, setCopied] = useState(false);
    const [activeCopyType, setActiveCopyType] = useState('original'); // 'original' | 'copy'
    
    // Digital Signature State
    const signatureImage = companySettings?.tax_signature_image || localStorage.getItem('onhaus_tax_signature_image') || invoice?.signature_url || '';
    const [showSignature, setShowSignature] = useState(() => {
        if (companySettings?.tax_signature_enabled === 'false') return false;
        return Boolean(signatureImage);
    });

    // Email Modal State
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [recipientEmail, setRecipientEmail] = useState(invoice?.customer_email || '');
    const [emailSubject, setEmailSubject] = useState('');
    const [copiedEmailText, setCopiedEmailText] = useState(false);

    if (!invoice) return null;

    const isVat = Boolean(invoice.doc_type === 'tax_invoice' || (invoice.vat_amount && Number(invoice.vat_amount) > 0));
    const docTitle = isVat ? 'ใบเสร็จรับเงิน / ใบกำกับภาษี' : 'ใบเสร็จรับเงิน';
    const docTitleEn = isVat ? 'RECEIPT / TAX INVOICE' : 'OFFICIAL RECEIPT';
    const copyLabel = activeCopyType === 'original' ? 'ต้นฉบับ (ORIGINAL)' : 'สำเนา (COPY)';
    const copySubtitle = activeCopyType === 'original' 
        ? '(เอกสารออกเป็นชุด: ต้นฉบับสำหรับผู้ซื้อ / ผู้รับบริการ)' 
        : '(เอกสารออกเป็นชุด: สำเนาสำหรับผู้ขาย / แผนกบัญชี)';

    const items = Array.isArray(invoice.items) ? invoice.items : [];
    const formattedDate = invoice.issued_at 
        ? new Date(invoice.issued_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
        : new Date().toLocaleDateString('th-TH');

    const bahtWords = thaiBahtText(invoice.total_amount || invoice.net_payable || 0);

    // Prepare default Email Subject on load
    useEffect(() => {
        const issuer = companySettings?.tax_company_name || invoice.issuer_name || 'IN THE HAUS';
        setEmailSubject(`[${docTitle}] เลขที่ ${invoice.invoice_number} - ${issuer}`);
        if (invoice?.customer_email && !recipientEmail) {
            setRecipientEmail(invoice.customer_email);
        }
    }, [invoice, companySettings]);

    const handlePrint = () => {
        window.print();
    };

    const handleCopyJson = () => {
        navigator.clipboard.writeText(JSON.stringify(invoice, null, 2));
        setCopied(true);
        toast.success('คัดลอกข้อมูลเอกสาร JSON เรียบร้อย');
        setTimeout(() => setCopied(false), 2000);
    };

    // Generate formatted Plain Text Email Body
    const generateEmailBodyText = () => {
        const issuerName = companySettings?.tax_company_name || invoice.issuer_name || 'ร้านในบ้าน (IN THE HAUS)';
        const issuerTaxId = companySettings?.tax_id || invoice.issuer_tax_id || '1120100144907';
        const issuerBranch = formatBranch(companySettings?.tax_branch_type, companySettings?.tax_branch_code);
        const issuerAddress = companySettings?.tax_address || invoice.issuer_address || '788/1 สุนทรวิจิตร ในเมือง เมืองนครพนม 48000';
        const issuerPhone = companySettings?.tax_phone || invoice.issuer_phone || '0961424663';

        const lines = [
            `==================================================`,
            `  ${docTitle.toUpperCase()} / ${docTitleEn}`,
            `  ${issuerName.toUpperCase()}`,
            `==================================================`,
            `เลขที่เอกสาร: ${invoice.invoice_number}`,
            `วันที่ออกเอกสาร: ${formattedDate}`,
            invoice.booking_id ? `อ้างอิงบิล POS: #${String(invoice.booking_id).slice(0, 8)}` : '',
            ``,
            `--- ข้อมูลผู้ขาย / สถานประกอบการ ---`,
            `${issuerName}`,
            `ที่อยู่: ${issuerAddress}`,
            `เลขประจำตัวผู้เสียภาษี: ${formatTaxId(issuerTaxId)} (${issuerBranch})`,
            `โทรศัพท์: ${issuerPhone}`,
            ``,
            `--- ข้อมูลผู้ซื้อ / ผู้รับบริการ ---`,
            `ชื่อ: ${invoice.customer_name || 'ลูกค้าทั่วไป'}`,
            `ที่อยู่: ${invoice.customer_address || '-'}`,
            invoice.customer_tax_id ? `เลขประจำตัวผู้เสียภาษี: ${formatTaxId(invoice.customer_tax_id)} (${formatBranch(invoice.customer_branch_type, invoice.customer_branch_code)})` : '',
            invoice.customer_phone ? `โทร: ${invoice.customer_phone}` : '',
            ``,
            `--- รายการสินค้าและบริการ ---`,
            ...items.map((it, idx) => {
                const qty = Number(it.quantity || 1);
                const price = Number(it.price || it.price_at_time || 0);
                const total = Number(it.amount || (qty * price));
                return `${idx + 1}. ${it.name || it.item_name} x ${qty} @ ฿${price.toFixed(2)} = ฿${total.toFixed(2)}`;
            }),
            ``,
            `--------------------------------------------------`,
            `รวมเป็นเงิน (Subtotal): ฿${Number(invoice.subtotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            Number(invoice.discount_amount || 0) > 0 ? `หักส่วนลด (Discount): -฿${Number(invoice.discount_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '',
            isVat ? `มูลค่าก่อนภาษี (Pre-VAT): ฿${Number(invoice.pre_vat_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '',
            isVat ? `ภาษีมูลค่าเพิ่ม 7% (VAT): ฿${Number(invoice.vat_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '',
            `จำนวนเงินรวมทั้งสิ้น (Grand Total): ฿${Number(invoice.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} บาท`,
            `(${bahtWords})`,
            Number(invoice.wht_amount || 0) > 0 ? `หักภาษี ณ ที่จ่าย ${invoice.wht_rate}%: -฿${Number(invoice.wht_amount).toFixed(2)} บาท` : '',
            Number(invoice.net_payable || 0) > 0 ? `ยอดชำระสุทธิ (Net Payable): ฿${Number(invoice.net_payable).toLocaleString('en-US', { minimumFractionDigits: 2 })} บาท` : '',
            `--------------------------------------------------`,
            !isVat ? `* เอกสารนี้ไม่อยู่ในบังคับภาษีมูลค่าเพิ่ม (Non-VAT) / ใช้เป็นหลักฐานรายจ่ายได้ถูกต้องตามกฎหมาย` : `* ภาษีมูลค่าเพิ่มคำนวณตามประมวลรัษฎากร มาตรา 86/4`,
            ``,
            `ขอขอบพระคุณที่ใช้บริการ`,
            `${issuerName}`
        ].filter(Boolean);

        return lines.join('\n');
    };

    // 1. Open in Gmail Web
    const handleOpenGmail = () => {
        const body = generateEmailBodyText();
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipientEmail)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(body)}`;
        window.open(gmailUrl, '_blank', 'noopener,noreferrer');
        saveCustomerEmailToInvoice();
    };

    // 2. Open in Outlook Web
    const handleOpenOutlook = () => {
        const body = generateEmailBodyText();
        const outlookUrl = `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(recipientEmail)}&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(body)}`;
        window.open(outlookUrl, '_blank', 'noopener,noreferrer');
        saveCustomerEmailToInvoice();
    };

    // 3. Open Default Mail Client (mailto:)
    const handleOpenMailto = () => {
        const body = generateEmailBodyText();
        const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoUrl;
        saveCustomerEmailToInvoice();
    };

    // 4. Copy Text for LINE / Chat
    const handleCopyEmailText = () => {
        const body = generateEmailBodyText();
        navigator.clipboard.writeText(body);
        setCopiedEmailText(true);
        toast.success('คัดลอกข้อความสรุปเอกสารเรียบร้อย นำไปวางใน Email หรือ LINE ได้ทันที');
        setTimeout(() => setCopiedEmailText(false), 2500);
        saveCustomerEmailToInvoice();
    };

    // 5. Native Web Share API if supported
    const handleNativeShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: emailSubject,
                    text: generateEmailBodyText()
                });
                toast.success('แชร์เอกสารเรียบร้อยแล้ว');
            } catch (err) {
                if (err.name !== 'AbortError') {
                    toast.error('ไม่สามารถแชร์ได้: ' + err.message);
                }
            }
        } else {
            handleCopyEmailText();
        }
    };

    // Persist email back to invoice & customer profile if updated
    const saveCustomerEmailToInvoice = async () => {
        if (!recipientEmail || recipientEmail === invoice.customer_email) return;
        try {
            if (invoice.id && !String(invoice.id).startsWith('local_')) {
                await supabase
                    .from('tax_invoices')
                    .update({ customer_email: recipientEmail.trim() })
                    .eq('id', invoice.id);
            }
            invoice.customer_email = recipientEmail.trim();
        } catch {
            // Ignore background sync errors
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex flex-col bg-zinc-950/85 backdrop-blur-md items-center justify-start py-4 sm:py-6 px-2 sm:px-4 overflow-y-auto print:p-0 print:m-0 print:bg-white print:overflow-visible font-sans text-xs">
            {/* Custom Print Style Tag for Guaranteed 1-Page A4 Precision */}
            <style>{`
                @page {
                    size: A4 portrait;
                    margin: 6mm 8mm;
                }
                @media print {
                    html, body {
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        width: 100% !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    #tax-invoice-printable-sheet {
                        width: 100% !important;
                        max-width: 100% !important;
                        min-height: auto !important;
                        height: auto !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                        page-break-after: avoid !important;
                        break-after: avoid !important;
                    }
                    .print\\:hidden, .no-print {
                        display: none !important;
                    }
                }
            `}</style>

            {/* Top Toolbar (Non-printable) */}
            <div className="w-full max-w-4xl bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-4 sm:px-6 py-2.5 border border-[oklch(85%_0.012_28)] flex flex-wrap items-center justify-between font-mono text-xs mb-3 print:hidden gap-2.5 shadow-2xl shrink-0">
                <div className="flex items-center gap-3">
                    <span className="font-bold text-[oklch(52%_0.16_28)] uppercase tracking-wider text-[11px]">
                        [ {isVat ? 'FULL TAX INVOICE' : 'OFFICIAL RECEIPT'} ]
                    </span>
                    <span className="text-zinc-400 font-mono text-[11px]">
                        #{invoice.invoice_number}
                    </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs">
                    {/* Original / Copy Toggle */}
                    <div className="flex border border-zinc-700 bg-zinc-900 rounded overflow-hidden text-[10px]">
                        <button
                            onClick={() => setActiveCopyType('original')}
                            className={`px-2.5 py-1 font-mono transition-colors ${activeCopyType === 'original' ? 'bg-[oklch(52%_0.16_28)] text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
                        >
                            ต้นฉบับ (Original)
                        </button>
                        <button
                            onClick={() => setActiveCopyType('copy')}
                            className={`px-2.5 py-1 font-mono transition-colors ${activeCopyType === 'copy' ? 'bg-[oklch(52%_0.16_28)] text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
                        >
                            สำเนา (Copy)
                        </button>
                    </div>

                    {/* Signature Toggle */}
                    <button
                        onClick={() => setShowSignature(!showSignature)}
                        className={`px-2.5 py-1 rounded border text-[10px] font-mono flex items-center gap-1 transition-colors cursor-pointer ${
                            showSignature && signatureImage 
                                ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300 font-bold' 
                                : 'border-zinc-700 text-zinc-400 hover:text-white'
                        }`}
                        title={signatureImage ? 'เปิด/ปิดการแสดงลายเซ็นบนเอกสาร' : 'ยังไม่มีรูปลายเซ็นในระบบ'}
                    >
                        <PenTool size={11} />
                        <span>{showSignature && signatureImage ? '✓ ลายเซ็นดิจิทัล: เปิด' : 'ลายเซ็น: ปิด'}</span>
                    </button>

                    {/* Send Email Action Button */}
                    <button
                        onClick={() => setShowEmailModal(true)}
                        className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white font-bold uppercase transition-colors flex items-center gap-1.5 rounded cursor-pointer text-[11px]"
                    >
                        <Mail size={13} />
                        <span>ส่งอีเมล (Email)</span>
                    </button>

                    {/* Print Button */}
                    <button
                        onClick={handlePrint}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase transition-colors flex items-center gap-1.5 rounded cursor-pointer text-[11px]"
                    >
                        <Printer size={13} />
                        <span>พิมพ์ (Print / PDF)</span>
                    </button>

                    {/* Copy JSON */}
                    <button
                        onClick={handleCopyJson}
                        className="px-2.5 py-1.5 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors flex items-center gap-1 rounded cursor-pointer text-[11px]"
                        title="Copy Raw JSON Data"
                    >
                        {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        <span className="hidden sm:inline">JSON</span>
                    </button>

                    {/* Close Modal */}
                    <button
                        onClick={onClose}
                        className="p-1.5 border border-zinc-700 hover:bg-zinc-800 text-white uppercase transition-colors rounded cursor-pointer"
                        title="Close Viewer"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* A4 Printable Document Sheet */}
            <div 
                id="tax-invoice-printable-sheet"
                className="w-full max-w-4xl bg-white text-zinc-900 p-5 sm:p-7 border border-zinc-300 shadow-2xl font-sans text-[11px] print:m-0 print:p-6 print:border-none print:shadow-none print:w-full print:max-w-none flex flex-col justify-between"
            >
                <div>
                    {/* Header Section */}
                    <div className="flex justify-between items-start border-b-2 border-zinc-900 pb-3 gap-4">
                        {/* Company / Issuer Info */}
                        <div className="flex-1">
                            <h1 className="font-bold text-base sm:text-lg uppercase tracking-tight text-zinc-950 font-serif">
                                {companySettings?.tax_company_name || invoice.issuer_name || 'ร้านในบ้าน นครพนม'}
                            </h1>
                            {companySettings?.tax_company_name_en && (
                                <p className="font-mono text-[11px] text-zinc-600 uppercase font-semibold">
                                    {companySettings.tax_company_name_en}
                                </p>
                            )}
                            <div className="mt-1 text-[10.5px] text-zinc-700 leading-relaxed max-w-lg">
                                <p>{companySettings?.tax_address || invoice.issuer_address || '788/1 สุนทรวิจิตร ในเมือง เมืองนครพนม 48000'}</p>
                                <div className="flex flex-wrap gap-x-3 mt-0.5 font-mono font-medium">
                                    <span>เลขประจำตัวผู้เสียภาษี: <strong className="text-zinc-950">{formatTaxId(companySettings?.tax_id || invoice.issuer_tax_id || '1120100144907')}</strong></span>
                                    <span>สถานประกอบการ: <strong>{formatBranch(companySettings?.tax_branch_type, companySettings?.tax_branch_code)}</strong></span>
                                </div>
                                <div className="flex flex-wrap gap-x-3 font-mono text-zinc-600 mt-0.5">
                                    {companySettings?.tax_phone && <span>โทร: {companySettings.tax_phone}</span>}
                                    {companySettings?.tax_email && <span>อีเมล: {companySettings.tax_email}</span>}
                                </div>
                            </div>
                        </div>

                        {/* Document Title & Number Badge */}
                        <div className="text-right flex flex-col items-end shrink-0">
                            <div className="border-2 border-zinc-900 px-3.5 py-1.5 bg-zinc-50 text-right min-w-[180px]">
                                <span className="font-bold text-sm sm:text-base block text-zinc-950 leading-tight">
                                    {docTitle}
                                </span>
                                <span className="font-mono text-[9px] font-bold text-zinc-600 uppercase tracking-wider block">
                                    {docTitleEn}
                                </span>
                                <span className="font-mono text-[9px] font-bold text-[oklch(52%_0.16_28)] uppercase tracking-wider block mt-0.5">
                                    {copyLabel}
                                </span>
                            </div>

                            <div className="mt-1.5 font-mono text-[10.5px] space-y-0.5 text-right">
                                <div><span className="text-zinc-500">เลขที่ / No:</span> <strong className="text-zinc-950 font-bold">{invoice.invoice_number}</strong></div>
                                <div><span className="text-zinc-500">วันที่ / Date:</span> <span className="text-zinc-900">{formattedDate}</span></div>
                                {invoice.booking_id && (
                                    <div className="text-[9.5px] text-zinc-500">
                                        อ้างอิงบิล POS: #{String(invoice.booking_id).slice(0, 8)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Copy Subtitle Indicator */}
                    <div className="text-right text-[9.5px] font-mono text-zinc-500 mt-0.5 italic">
                        {copySubtitle}
                    </div>

                    {/* Customer Info Box */}
                    <div className="mt-2.5 border border-zinc-900 bg-zinc-50/70 p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <div className="font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5">
                                [ ข้อมูลผู้ซื้อสินค้า / ผู้รับบริการ (CUSTOMER INFO) ]
                            </div>
                            <div className="font-bold text-xs sm:text-sm text-zinc-950">
                                {invoice.customer_name || 'ลูกค้าทั่วไป (Cash Customer)'}
                            </div>
                            <div className="text-[10.5px] text-zinc-700 leading-relaxed mt-0.5">
                                {invoice.customer_address || '-'}
                            </div>
                        </div>

                        <div className="flex flex-col justify-end md:items-end font-mono text-[10.5px] space-y-0.5">
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
                    <div className="mt-3">
                        <table className="w-full text-left border-collapse border border-zinc-900 text-[10.5px]">
                            <thead>
                                <tr className="bg-zinc-100 border-b-2 border-zinc-900 font-mono text-[9.5px] uppercase">
                                    <th className="p-2 border-r border-zinc-900 w-10 text-center">ลำดับ<br/>(No.)</th>
                                    <th className="p-2 border-r border-zinc-900">รายการสินค้า / บริการ<br/>(Description)</th>
                                    <th className="p-2 border-r border-zinc-900 w-16 text-center">จำนวน<br/>(Qty)</th>
                                    <th className="p-2 border-r border-zinc-900 w-24 text-right">ราคาต่อหน่วย<br/>(Unit Price)</th>
                                    <th className="p-2 w-24 text-right">จำนวนเงิน (บาท)<br/>(Amount THB)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => {
                                    const qty = Number(item.quantity || 1);
                                    const unitPrice = Number(item.price || item.price_at_time || 0);
                                    const amount = Number(item.amount || (qty * unitPrice));

                                    return (
                                        <tr key={idx} className="border-b border-zinc-300">
                                            <td className="p-1.5 border-r border-zinc-900 text-center font-mono">{idx + 1}</td>
                                            <td className="p-1.5 border-r border-zinc-900">
                                                <div className="font-semibold text-zinc-950">{item.name || item.item_name}</div>
                                                {item.selected_options && (
                                                    <div className="text-[9.5px] text-zinc-500 font-mono">{item.selected_options}</div>
                                                )}
                                            </td>
                                            <td className="p-1.5 border-r border-zinc-900 text-center font-mono">{qty}</td>
                                            <td className="p-1.5 border-r border-zinc-900 text-right font-mono">{unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                            <td className="p-1.5 text-right font-mono font-semibold">{amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    );
                                })}

                                {items.length === 0 && (
                                    <tr className="border-b border-zinc-300">
                                        <td colSpan={5} className="p-6 text-center text-zinc-400 italic">
                                            ไม่มีรายการย่อย
                                        </td>
                                    </tr>
                                )}

                                {/* Compact blank filler rows only if very few items */}
                                {items.length < 3 && Array.from({ length: Math.max(0, 3 - items.length) }).map((_, i) => (
                                    <tr key={`filler-${i}`} className="border-b border-zinc-200 text-transparent select-none">
                                        <td className="p-1 border-r border-zinc-900 text-center font-mono">-</td>
                                        <td className="p-1 border-r border-zinc-900">-</td>
                                        <td className="p-1 border-r border-zinc-900 text-center font-mono">-</td>
                                        <td className="p-1 border-r border-zinc-900 text-right font-mono">-</td>
                                        <td className="p-1 text-right font-mono">-</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary & Totals Calculation Block */}
                    <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                        {/* Baht Text Box & Non-VAT Notice */}
                        <div className="border border-zinc-900 p-2.5 bg-zinc-50 flex flex-col justify-between min-h-[90px]">
                            <div>
                                <span className="font-mono text-[8.5px] font-bold text-zinc-500 uppercase tracking-wider block">
                                    [ จำนวนเงินตัวอักษร / AMOUNT IN WORDS ]
                                </span>
                                <div className="font-bold text-zinc-950 text-xs sm:text-sm mt-0.5">
                                    ({bahtWords})
                                </div>
                            </div>

                            <div className="font-mono text-[8.5px] text-zinc-500 mt-1.5 pt-1.5 border-t border-zinc-200">
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
                        <div className="border border-zinc-900 divide-y divide-zinc-300 font-mono text-[10.5px]">
                            <div className="flex justify-between p-1.5">
                                <span className="text-zinc-600">รวมเป็นเงิน (Subtotal):</span>
                                <span className="font-semibold text-zinc-950">฿{Number(invoice.subtotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                            </div>

                            {Number(invoice.discount_amount || 0) > 0 && (
                                <div className="flex justify-between p-1.5 bg-amber-50/50 text-amber-900">
                                    <span>หักส่วนลด (Discount):</span>
                                    <span className="font-semibold">-฿{Number(invoice.discount_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}

                            {isVat && (
                                <>
                                    <div className="flex justify-between p-1.5">
                                        <span className="text-zinc-600">มูลค่าสินค้าก่อนภาษี (Pre-VAT):</span>
                                        <span className="font-semibold text-zinc-950">฿{Number(invoice.pre_vat_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between p-1.5">
                                        <span className="text-zinc-600">ภาษีมูลค่าเพิ่ม 7% (VAT):</span>
                                        <span className="font-semibold text-zinc-950">฿{Number(invoice.vat_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </>
                            )}

                            <div className="flex justify-between p-2 bg-zinc-100 font-bold text-xs text-zinc-950">
                                <span>จำนวนเงินรวมทั้งสิ้น (Grand Total):</span>
                                <span>฿{Number(invoice.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                            </div>

                            {Number(invoice.wht_amount || 0) > 0 && (
                                <>
                                    <div className="flex justify-between p-1.5 text-zinc-600 bg-zinc-50">
                                        <span>หักภาษี ณ ที่จ่าย {invoice.wht_rate}% (WHT):</span>
                                        <span className="text-red-600 font-semibold">-฿{Number(invoice.wht_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between p-2 bg-zinc-900 text-white font-bold text-xs">
                                        <span>ยอดชำระสุทธิ (Net Payable):</span>
                                        <span>฿{Number(invoice.net_payable || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Signatures & Footer Section */}
                <div className="mt-5 pt-3 border-t-2 border-zinc-900 grid grid-cols-2 gap-6 font-mono text-[10.5px]">
                    {/* Left: Customer Signature */}
                    <div className="flex flex-col items-center justify-end text-center p-2.5 border border-zinc-300">
                        <div className="w-40 border-b border-zinc-900 pb-7 mb-1.5"></div>
                        <div className="font-bold text-zinc-950 text-[11px]">ผู้รับสินค้าหรือบริการ</div>
                        <div className="text-[9px] text-zinc-500">วันที่ / Date: ______/______/__________</div>
                    </div>

                    {/* Right: Issuer Authorized Signature with Overlay */}
                    <div className="flex flex-col items-center justify-end text-center p-2.5 border border-zinc-300 relative">
                        <div className="relative w-44 h-12 flex items-end justify-center mb-1">
                            {showSignature && signatureImage ? (
                                <img
                                    src={signatureImage}
                                    alt="Authorized Signature"
                                    className="max-h-11 max-w-full object-contain filter drop-shadow-xs mb-0.5"
                                />
                            ) : (
                                <div className="text-[9px] text-zinc-300 italic pb-0.5">
                                    {!signatureImage ? '' : ''}
                                </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 border-b border-zinc-900"></div>
                        </div>

                        <div className="font-bold text-zinc-950 text-[11px]">
                            ( {companySettings?.tax_signature_name || invoice.signature_name || 'ผู้มีอำนาจลงนาม / ผู้รับเงิน'} )
                        </div>
                        {companySettings?.tax_signature_position && (
                            <div className="text-[9.5px] text-zinc-600 font-sans">
                                {companySettings.tax_signature_position}
                            </div>
                        )}
                        <div className="text-[9px] text-zinc-500">วันที่ / Date: {formattedDate}</div>
                    </div>
                </div>
            </div>

            {/* SEND EMAIL MODAL */}
            {showEmailModal && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-sans text-xs">
                    <div className="bg-white border border-zinc-300 shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="bg-zinc-950 text-white px-5 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1 bg-blue-600 text-white rounded">
                                    <Mail size={16} />
                                </div>
                                <h3 className="font-mono font-bold text-sm uppercase">
                                    ส่งเอกสารให้ลูกค้าทางอีเมล (Send via Email)
                                </h3>
                            </div>
                            <button 
                                onClick={() => setShowEmailModal(false)}
                                className="p-1 text-zinc-400 hover:text-white rounded cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 space-y-4 overflow-y-auto">
                            <div>
                                <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                                    อีเมลผู้รับ (Customer Email Address) *
                                </label>
                                <input
                                    type="email"
                                    value={recipientEmail}
                                    onChange={(e) => setRecipientEmail(e.target.value)}
                                    placeholder="client@company.com หรือ customer@gmail.com"
                                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs font-mono focus:border-zinc-950 focus:outline-none"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                                    หัวข้ออีเมล (Subject)
                                </label>
                                <input
                                    type="text"
                                    value={emailSubject}
                                    onChange={(e) => setEmailSubject(e.target.value)}
                                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs font-semibold focus:border-zinc-950 focus:outline-none"
                                />
                            </div>

                            {/* Email Summary Preview Box */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase">
                                        ตัวอย่างเนื้อหาข้อความสรุปในอีเมล (Body Preview)
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleCopyEmailText}
                                        className="text-blue-600 hover:text-blue-800 font-mono text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                        {copiedEmailText ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                                        <span>{copiedEmailText ? 'คัดลอกแล้ว!' : 'คัดลอกข้อความ'}</span>
                                    </button>
                                </div>
                                <pre className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg font-mono text-[10px] text-zinc-700 max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                                    {generateEmailBodyText()}
                                </pre>
                            </div>

                            {/* One-Click Send Options */}
                            <div className="space-y-2 pt-2 border-t border-zinc-200">
                                <span className="font-mono font-bold text-[10px] text-zinc-500 uppercase block">
                                    เลือกช่องทางส่งเอกสาร (Choose Send Channel):
                                </span>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
                                    {/* 1. Gmail Web */}
                                    <button
                                        type="button"
                                        onClick={handleOpenGmail}
                                        className="p-2.5 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 rounded-xl font-bold flex items-center justify-between transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <ExternalLink size={14} />
                                            <span>เปิด Gmail Web</span>
                                        </div>
                                        <span className="text-[9px] bg-red-200 px-1.5 py-0.5 rounded font-normal">ยอดนิยม</span>
                                    </button>

                                    {/* 2. Outlook Web */}
                                    <button
                                        type="button"
                                        onClick={handleOpenOutlook}
                                        className="p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl font-bold flex items-center justify-between transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <ExternalLink size={14} />
                                            <span>เปิด Outlook Web</span>
                                        </div>
                                        <span className="text-[9px] bg-blue-200 px-1.5 py-0.5 rounded font-normal">Microsoft</span>
                                    </button>

                                    {/* 3. Native Mail Client */}
                                    <button
                                        type="button"
                                        onClick={handleOpenMailto}
                                        className="p-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-300 rounded-xl font-bold flex items-center justify-between transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Send size={14} />
                                            <span>เปิด Mail App (เครื่อง)</span>
                                        </div>
                                        <span className="text-[9px] bg-zinc-300 px-1.5 py-0.5 rounded font-normal">Default</span>
                                    </button>

                                    {/* 4. Copy Text / Share */}
                                    <button
                                        type="button"
                                        onClick={handleNativeShare}
                                        className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl font-bold flex items-center justify-between transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Share2 size={14} />
                                            <span>แชร์ / ส่งใน LINE</span>
                                        </div>
                                        <span className="text-[9px] bg-emerald-200 px-1.5 py-0.5 rounded font-normal">Chat/LINE</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3 bg-zinc-50 border-t border-zinc-200 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowEmailModal(false)}
                                className="px-4 py-2 border border-zinc-300 text-zinc-700 hover:bg-zinc-100 rounded-lg font-mono font-bold text-xs cursor-pointer"
                            >
                                ปิดหน้าต่าง (Close)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
