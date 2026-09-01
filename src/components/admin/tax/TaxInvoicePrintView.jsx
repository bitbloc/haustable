/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
    EyeOff,
    Download,
    Loader2,
    Paperclip,
    FileCheck,
    Smartphone
} from 'lucide-react';
import { thaiBahtText, formatTaxId, formatBranch } from '../../../utils/thaiTaxHelper';
import { generateTaxDocumentPdf, downloadTaxPdf, saveOrShareTaxPdf, openPdfInNewTab, isMobileBrowser } from '../../../utils/taxPdfHelper';
import { supabase } from '../../../lib/supabaseClient';
import { toast } from 'sonner';

export default function TaxInvoicePrintView({ invoice, companySettings, onClose, initialShowEmail = false }) {
    const [copied, setCopied] = useState(false);
    const [activeCopyType, setActiveCopyType] = useState('original'); // 'original' | 'copy'
    const printableSheetRef = useRef(null);
    
    // Digital Signature State
    const signatureImage = companySettings?.tax_signature_image || localStorage.getItem('onhaus_tax_signature_image') || invoice?.signature_url || '';
    const [showSignature, setShowSignature] = useState(() => {
        if (companySettings?.tax_signature_enabled === 'false') return false;
        return Boolean(signatureImage);
    });

    // PDF State
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [pdfDownloaded, setPdfDownloaded] = useState(false);
    const [lastPdfResult, setLastPdfResult] = useState(null);

    // Email Modal State
    const [showEmailModal, setShowEmailModal] = useState(Boolean(initialShowEmail));
    const [recipientEmail, setRecipientEmail] = useState(invoice?.customer_email || '');
    const [emailSubject, setEmailSubject] = useState('');
    const [copiedEmailText, setCopiedEmailText] = useState(false);

    const isMobile = isMobileBrowser();

    if (!invoice) return null;

    const isVat = Boolean(invoice.doc_type === 'tax_invoice' || (invoice.vat_amount && Number(invoice.vat_amount) > 0));
    const docTitle = isVat ? 'ใบเสร็จรับเงิน / ใบกำกับภาษี' : 'ใบเสร็จรับเงิน';
    const docTitleEn = isVat ? 'RECEIPT / TAX INVOICE' : 'OFFICIAL RECEIPT';
    const copyLabel = activeCopyType === 'original' ? 'ต้นฉบับ (ORIGINAL)' : 'สำเนา (COPY)';
    const copySubtitle = activeCopyType === 'original' 
        ? '(เอกสารออกเป็นชุด: ต้นฉบับสำหรับผู้ซื้อ / ผู้รับบริการ)' 
        : '(เอกสารออกเป็นชุด: สำเนาสำหรับผู้ขาย / แผนกบัญชี)';

    const rawItems = Array.isArray(invoice.items) ? invoice.items : [];
    const formattedDate = invoice.issued_at 
        ? new Date(invoice.issued_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
        : new Date().toLocaleDateString('th-TH');

    const bahtWords = thaiBahtText(invoice.total_amount || invoice.net_payable || 0);
    const pdfFileName = `${invoice.invoice_number || 'tax-invoice'}_${activeCopyType === 'original' ? 'ORIGINAL' : 'COPY'}.pdf`;

    // Dynamic Pagination Logic for Invoices:
    // - If items <= 12: 1 Single A4 Page (fits header, customer, items, summary, signatures seamlessly).
    // - If items > 12: Multi-page A4 pagination (Page 1: 14 items; Middle pages: 18 items; Final page: remaining + summary + signatures).
    const pages = React.useMemo(() => {
        if (rawItems.length <= 12) {
            return [{ items: rawItems, isFirst: true, isLast: true, pageNum: 1, totalPages: 1 }];
        }

        const result = [];
        let remaining = [...rawItems];
        let pageIdx = 1;

        // First page
        const firstPageItems = remaining.splice(0, 14);
        result.push({ items: firstPageItems, isFirst: true, isLast: false, pageNum: pageIdx });
        pageIdx++;

        // Middle and last pages
        while (remaining.length > 0) {
            if (remaining.length <= 12) {
                // Fits cleanly on last page with summary & signatures
                result.push({ items: remaining, isFirst: false, isLast: true, pageNum: pageIdx });
                remaining = [];
            } else {
                const chunk = remaining.splice(0, 18);
                const isFinal = remaining.length === 0;
                result.push({ items: chunk, isFirst: false, isLast: isFinal, pageNum: pageIdx });
            }
            pageIdx++;
        }

        const totalPages = result.length;
        return result.map(p => ({ ...p, totalPages }));
    }, [rawItems]);

    // Prepare default Email Subject on load
    useEffect(() => {
        const issuer = companySettings?.tax_company_name || invoice.issuer_name || 'ร้านในบ้าน นครพนม';
        setEmailSubject(`[${docTitle}] เลขที่ ${invoice.invoice_number} - ${issuer}`);
        if (invoice?.customer_email && !recipientEmail) {
            setRecipientEmail(invoice.customer_email);
        }
    }, [invoice, companySettings, docTitle]);

    const handlePrint = () => {
        window.print();
    };

    const handleCopyJson = () => {
        navigator.clipboard.writeText(JSON.stringify(invoice, null, 2));
        setCopied(true);
        toast.success('คัดลอกข้อมูลเอกสาร JSON เรียบร้อย');
        setTimeout(() => setCopied(false), 2000);
    };

    // Helper: Build or get PDF instance
    const getOrGeneratePdf = async () => {
        const sheetEl = printableSheetRef.current || document.getElementById('tax-invoice-printable-container');
        if (!sheetEl) {
            throw new Error('ไม่พบส่วนแสดงเอกสารสำหรับสร้าง PDF');
        }
        const result = await generateTaxDocumentPdf(sheetEl, { fileName: pdfFileName });
        setLastPdfResult(result);
        return result;
    };

    // 1. Mobile-friendly Save / Share PDF (Web Share API on mobile, Direct Download on desktop)
    const handleSaveOrSharePdf = async () => {
        setIsGeneratingPdf(true);
        const toastId = toast.loading(isMobile ? 'กำลังเตรียมไฟล์ PDF สำหรับบันทึก/แชร์...' : 'กำลังสร้างไฟล์ PDF คุณภาพสูง (A4)...');
        try {
            const pdfResult = await getOrGeneratePdf();
            const res = await saveOrShareTaxPdf(pdfResult, {
                fileName: pdfFileName,
                title: `${docTitle} #${invoice.invoice_number}`,
                text: `${docTitle} เลขที่ ${invoice.invoice_number} วันที่ ${formattedDate} ยอดรวม ฿${Number(invoice.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} บาท`
            });

            if (res.shared) {
                toast.success('แชร์ไฟล์เอกสาร PDF เรียบร้อยแล้ว', { id: toastId });
            } else if (res.downloaded) {
                setPdfDownloaded(true);
                toast.success(`ดาวน์โหลดไฟล์ ${pdfFileName} เรียบร้อยแล้ว`, { id: toastId });
                setTimeout(() => setPdfDownloaded(false), 3000);
            } else if (res.openedInTab) {
                toast.success('เปิดไฟล์ PDF ในแท็บใหม่แล้ว สามารถแตะเพื่อบันทึกลงในเครื่องได้ทันที', { id: toastId });
            } else if (res.cancelled) {
                toast.dismiss(toastId);
            } else {
                toast.success(`พร้อมบันทึกไฟล์ ${pdfFileName}`, { id: toastId });
            }
        } catch (err) {
            console.error('PDF Generation Error:', err);
            toast.error('ไม่สามารถสร้างไฟล์ PDF ได้: ' + err.message, { id: toastId });
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    // 2. Open PDF directly in new tab for instant mobile viewing
    const handleOpenPdfTab = async () => {
        setIsGeneratingPdf(true);
        const toastId = toast.loading('กำลังเปิดดูตัวอย่าง PDF...');
        try {
            const pdfResult = await getOrGeneratePdf();
            openPdfInNewTab(pdfResult);
            toast.success('เปิดตัวอย่างเอกสาร PDF ในแท็บใหม่เรียบร้อย', { id: toastId });
        } catch (err) {
            console.error('Open PDF Error:', err);
            toast.error('ไม่สามารถเปิด PDF ได้: ' + err.message, { id: toastId });
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    // Generate formatted Professional Email Body
    const generateEmailBodyText = () => {
        const issuerName = companySettings?.tax_company_name || invoice.issuer_name || 'ร้านในบ้าน (IN THE HAUS)';
        const issuerPhone = companySettings?.tax_phone || invoice.issuer_phone || '0961424663';
        const customerName = invoice.customer_name || 'ลูกค้าผู้มีอุปการคุณ';

        const lines = [
            `เรียน ${customerName},`,
            ``,
            `ทาง${issuerName} ขอส่งเอกสาร ${docTitle} เลขที่ ${invoice.invoice_number} ประจำวันที่ ${formattedDate} มาพร้อมกับอีเมลนี้เพื่อเป็นหลักฐาน`,
            ``,
            `รายละเอียดเอกสาร:`,
            `- เอกสาร: ${docTitle} (${copyLabel})`,
            `- เลขที่เอกสาร: ${invoice.invoice_number}`,
            `- วันที่ออกเอกสาร: ${formattedDate}`,
            invoice.booking_id ? `- อ้างอิงบิล POS: #${String(invoice.booking_id).slice(0, 8)}` : '',
            `- ผู้ซื้อ/ผู้รับบริการ: ${invoice.customer_name || 'ลูกค้าทั่วไป'}`,
            invoice.customer_tax_id ? `- เลขประจำตัวผู้เสียภาษีผู้ซื้อ: ${formatTaxId(invoice.customer_tax_id)}` : '',
            `- ยอดรวมทั้งสิ้น: ฿${Number(invoice.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} บาท (${bahtWords})`,
            Number(invoice.wht_amount || 0) > 0 ? `- หักภาษี ณ ที่จ่าย: -฿${Number(invoice.wht_amount).toFixed(2)} บาท (ยอดชำระสุทธิ: ฿${Number(invoice.net_payable).toLocaleString('en-US', { minimumFractionDigits: 2 })} บาท)` : '',
            ``,
            `📎 ไฟล์แนบ: เอกสารฉบับเต็ม PDF (${pdfFileName})`,
            !isVat ? `* เอกสารนี้ไม่อยู่ในบังคับภาษีมูลค่าเพิ่ม (Non-VAT) / ใช้เป็นหลักฐานรายจ่ายได้ถูกต้องตามกฎหมาย` : `* ภาษีมูลค่าเพิ่มคำนวณตามประมวลรัษฎากร มาตรา 86/4`,
            ``,
            `ขอแสดงความนับถือ,`,
            `${issuerName}`,
            issuerPhone ? `โทร: ${issuerPhone}` : ''
        ].filter(Boolean);

        return lines.join('\n');
    };

    // Helper to ensure PDF is ready & downloaded for email attachment
    const preparePdfForEmail = async () => {
        try {
            const result = await getOrGeneratePdf();
            downloadTaxPdf(result.blob, result.fileName);
            return result;
        } catch (err) {
            console.warn('Auto PDF download failed:', err);
            return null;
        }
    };

    // 1. Open in Gmail Web + Auto PDF Download
    const handleOpenGmail = async () => {
        setIsGeneratingPdf(true);
        await preparePdfForEmail();
        setIsGeneratingPdf(false);

        const body = generateEmailBodyText();
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipientEmail)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(body)}`;
        window.open(gmailUrl, '_blank', 'noopener,noreferrer');
        saveCustomerEmailToInvoice();
        toast.info(`ดาวน์โหลด ${pdfFileName} แล้ว พร้อมลากแนบไฟล์ (Attach) ในหน้าต่าง Gmail`);
    };

    // 2. Open in Outlook Web + Auto PDF Download
    const handleOpenOutlook = async () => {
        setIsGeneratingPdf(true);
        await preparePdfForEmail();
        setIsGeneratingPdf(false);

        const body = generateEmailBodyText();
        const outlookUrl = `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(recipientEmail)}&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(body)}`;
        window.open(outlookUrl, '_blank', 'noopener,noreferrer');
        saveCustomerEmailToInvoice();
        toast.info(`ดาวน์โหลด ${pdfFileName} แล้ว พร้อมแนบไฟล์ (Attach) ใน Outlook`);
    };

    // 3. Open Default Mail Client (mailto:) + Auto PDF Download
    const handleOpenMailto = async () => {
        setIsGeneratingPdf(true);
        await preparePdfForEmail();
        setIsGeneratingPdf(false);

        const body = generateEmailBodyText();
        const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoUrl;
        saveCustomerEmailToInvoice();
        toast.info(`ดาวน์โหลด ${pdfFileName} แล้ว พร้อมแนบไฟล์ในโปรแกรม Mail`);
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

    // 5. Native Web Share API with actual PDF File
    const handleNativeShare = async () => {
        await handleSaveOrSharePdf();
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

    const content = (
        <div className="fixed inset-0 z-[200] flex flex-col bg-zinc-950/85 backdrop-blur-md items-center justify-start py-3 sm:py-6 px-2 sm:px-4 overflow-y-auto print:static print:p-0 print:m-0 print:bg-white print:overflow-visible font-sans text-xs">
            {/* Custom Print Style Tag for Guaranteed A4 Precision */}
            <style>{`
                @page {
                    size: A4 portrait;
                    margin: 6mm 8mm;
                }
                @media print {
                    html, body {
                        background: #ffffff !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        width: 100% !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    /* Completely hide the entire background React application tree in print */
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
                    #tax-invoice-printable-container {
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .print-page-sheet {
                        width: 100% !important;
                        max-width: 100% !important;
                        min-height: 275mm !important;
                        height: 275mm !important;
                        padding: 6mm 8mm !important;
                        margin: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                        page-break-after: always !important;
                        break-after: page !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        box-sizing: border-box !important;
                    }
                    .print-page-sheet:last-child {
                        page-break-after: auto !important;
                        break-after: auto !important;
                    }
                    .avoid-page-break {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .print\\:hidden, .no-print {
                        display: none !important;
                    }
                }
            `}</style>

            {/* Top Toolbar (Non-printable) */}
            <div className="w-full max-w-4xl bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-3.5 sm:px-6 py-2.5 border border-[oklch(85%_0.012_28)] flex flex-wrap items-center justify-between font-mono text-xs mb-3 print:hidden gap-2.5 shadow-2xl shrink-0">
                <div className="flex items-center gap-2 sm:gap-3">
                    <span className="font-bold text-[oklch(52%_0.16_28)] uppercase tracking-wider text-[10.5px] sm:text-[11px]">
                        [ {isVat ? 'FULL TAX INVOICE' : 'OFFICIAL RECEIPT'} ]
                    </span>
                    <span className="text-zinc-400 font-mono text-[10.5px] sm:text-[11px]">
                        #{invoice.invoice_number}
                    </span>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-xs">
                    {/* Original / Copy Toggle */}
                    <div className="flex border border-zinc-700 bg-zinc-900 rounded overflow-hidden text-[10px]">
                        <button
                            type="button"
                            onClick={() => setActiveCopyType('original')}
                            className={`px-2 py-1 font-mono transition-colors cursor-pointer ${activeCopyType === 'original' ? 'bg-[oklch(52%_0.16_28)] text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
                        >
                            ต้นฉบับ
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveCopyType('copy')}
                            className={`px-2 py-1 font-mono transition-colors cursor-pointer ${activeCopyType === 'copy' ? 'bg-[oklch(52%_0.16_28)] text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
                        >
                            สำเนา
                        </button>
                    </div>

                    {/* Signature Toggle */}
                    <button
                        type="button"
                        onClick={() => setShowSignature(!showSignature)}
                        className={`px-2 py-1 rounded border text-[10px] font-mono flex items-center gap-1 transition-colors cursor-pointer ${
                            showSignature && signatureImage 
                                ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300 font-bold' 
                                : 'border-zinc-700 text-zinc-400 hover:text-white'
                        }`}
                        title={signatureImage ? 'เปิด/ปิดการแสดงลายเซ็นบนเอกสาร' : 'ยังไม่มีรูปลายเซ็นในระบบ'}
                    >
                        <PenTool size={11} />
                        <span className="hidden sm:inline">{showSignature && signatureImage ? 'ลายเซ็น: เปิด' : 'ลายเซ็น: ปิด'}</span>
                    </button>

                    {/* Mobile & Desktop Save / Share PDF */}
                    <button
                        type="button"
                        onClick={handleSaveOrSharePdf}
                        disabled={isGeneratingPdf}
                        className="px-2.5 sm:px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold uppercase transition-colors flex items-center gap-1.5 rounded cursor-pointer disabled:opacity-50 text-[10.5px] sm:text-[11px] shadow-xs"
                        title="บันทึกไฟล์ PDF หรือแชร์ไปยังแอปต่างๆ (LINE, Drive, Files)"
                    >
                        {isGeneratingPdf ? <Loader2 size={13} className="animate-spin" /> : (isMobile ? <Share2 size={13} /> : <Download size={13} />)}
                        <span>{isMobile ? 'บันทึก / แชร์ PDF' : (pdfDownloaded ? 'บันทึกแล้ว' : 'ดาวน์โหลด PDF')}</span>
                    </button>

                    {/* Open in Tab for Mobile Preview */}
                    <button
                        type="button"
                        onClick={handleOpenPdfTab}
                        disabled={isGeneratingPdf}
                        className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold uppercase transition-colors hidden sm:flex items-center gap-1 rounded cursor-pointer disabled:opacity-50 text-[10.5px]"
                        title="เปิดไฟล์ PDF เต็มจอในแท็บใหม่"
                    >
                        <Eye size={12} />
                        <span>ดู PDF</span>
                    </button>

                    {/* Send Email Action Button */}
                    <button
                        type="button"
                        onClick={() => setShowEmailModal(true)}
                        className="px-2.5 sm:px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white font-bold uppercase transition-colors flex items-center gap-1.5 rounded cursor-pointer text-[10.5px] sm:text-[11px]"
                    >
                        <Mail size={13} />
                        <span className="hidden sm:inline">ส่งอีเมล (Email)</span>
                    </button>

                    {/* Print & Native Browser PDF Save Button */}
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="px-3 sm:px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase transition-colors flex items-center gap-1.5 rounded cursor-pointer text-[10.5px] sm:text-[11px] shadow-sm"
                        title="พิมพ์หรือ Save as PDF ผ่านเบราว์เซอร์"
                    >
                        <Printer size={13} />
                        <span>พิมพ์</span>
                    </button>

                    {/* Copy JSON */}
                    <button
                        type="button"
                        onClick={handleCopyJson}
                        className="px-2 py-1.5 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors hidden md:flex items-center gap-1 rounded cursor-pointer text-[10.5px]"
                        title="Copy Raw JSON Data"
                    >
                        {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        <span>JSON</span>
                    </button>

                    {/* Close Modal */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 border border-zinc-700 hover:bg-zinc-800 text-white uppercase transition-colors rounded cursor-pointer"
                        title="Close Viewer"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Printable Document Container (Supports 1-Page & Multi-Page A4 Precision) */}
            <div 
                id="tax-invoice-printable-container"
                ref={printableSheetRef}
                className="w-full max-w-4xl space-y-4 print:space-y-0"
            >
                {pages.map((page, pIdx) => {
                    // Calculate starting index for item numbering
                    const itemStartIndex = pages.slice(0, pIdx).reduce((acc, p) => acc + p.items.length, 0);

                    return (
                        <div 
                            key={`sheet-${pIdx}`}
                            style={{ 
                                fontFamily: "'Sarabun', 'Leelawadee', 'TH Sarabun New', system-ui, -apple-system, sans-serif",
                                minHeight: '280mm',
                                boxSizing: 'border-box'
                            }}
                            className="print-page-sheet w-full bg-white text-zinc-950 px-6 py-5 sm:px-8 sm:py-6 border border-zinc-300 shadow-2xl text-[10.5pt] leading-normal print:m-0 print:border-none print:shadow-none print:w-full print:max-w-none flex flex-col justify-between"
                        >
                            <div>
                                {/* Header Section */}
                                <div className="flex justify-between items-start border-b-2 border-zinc-950 pb-2.5 gap-3">
                                    {/* Company / Issuer Info */}
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        {/* In The Haus Logo */}
                                        <div className="shrink-0 pt-0.5">
                                            <img 
                                                src={companySettings?.tax_logo_url || companySettings?.receipt_shop_logo_url || companySettings?.shop_logo_url || '/logo.png'} 
                                                alt="IN THE HAUS" 
                                                className="w-14 h-14 sm:w-16 sm:h-16 object-contain object-left-top shrink-0"
                                                crossOrigin="anonymous"
                                                onError={(e) => {
                                                    if (e.target.src !== `${window.location.origin}/logo.png`) {
                                                        e.target.src = '/logo.png';
                                                    }
                                                }}
                                            />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h1 className="font-bold text-[14pt] uppercase tracking-tight text-zinc-950 leading-tight">
                                                {companySettings?.tax_company_name || invoice.issuer_name || 'ร้านในบ้าน นครพนม'}
                                            </h1>
                                            {companySettings?.tax_company_name_en && (
                                                <p className="font-mono text-[9.5pt] text-zinc-700 uppercase font-semibold mt-0.5">
                                                    {companySettings.tax_company_name_en}
                                                </p>
                                            )}
                                            <div className="mt-0.5 text-[10pt] text-zinc-800 leading-snug max-w-lg">
                                                <p>{companySettings?.tax_address || invoice.issuer_address || '788/1 สุนทรวิจิตร ในเมือง เมืองนครพนม 48000'}</p>
                                                <div className="flex flex-wrap gap-x-2.5 mt-0.5 font-mono text-[9.5pt]">
                                                    <span>เลขประจำตัวผู้เสียภาษี: <strong className="text-zinc-950 font-bold">{formatTaxId(companySettings?.tax_id || invoice.issuer_tax_id || '1120100144907')}</strong></span>
                                                    <span>สถานประกอบการ: <strong className="text-zinc-950 font-bold">{formatBranch(companySettings?.tax_branch_type, companySettings?.tax_branch_code)}</strong></span>
                                                </div>
                                                <div className="flex flex-wrap gap-x-2.5 font-mono text-[9pt] text-zinc-600 mt-0.5">
                                                    {companySettings?.tax_phone && <span>โทร: {companySettings.tax_phone}</span>}
                                                    {companySettings?.tax_email && <span>อีเมล: {companySettings.tax_email}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Document Title & Number Badge */}
                                    <div className="text-right flex flex-col items-end shrink-0">
                                        <div className="border-2 border-zinc-950 px-3 py-1.5 bg-zinc-50 text-right min-w-[190px]">
                                            <span className="font-bold text-[13.5pt] sm:text-[15pt] block text-zinc-950 leading-tight">
                                                {docTitle}
                                            </span>
                                            <span className="font-mono text-[9pt] font-bold text-zinc-700 uppercase tracking-wider block mt-0.5">
                                                {docTitleEn}
                                            </span>
                                            <span className="font-mono text-[9pt] font-bold text-[#a33716] uppercase tracking-wider block mt-0.5">
                                                {copyLabel}
                                            </span>
                                        </div>

                                        <div className="mt-1.5 font-mono text-[10pt] space-y-0.5 text-right">
                                            <div><span className="text-zinc-600">เลขที่ / No:</span> <strong className="text-zinc-950 font-bold">{invoice.invoice_number}</strong></div>
                                            <div><span className="text-zinc-600">วันที่ / Date:</span> <span className="text-zinc-950 font-semibold">{formattedDate}</span></div>
                                            {invoice.booking_id && (
                                                <div className="text-[9pt] text-zinc-500">
                                                    อ้างอิงบิล POS: #{String(invoice.booking_id).slice(0, 8)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Copy Subtitle Indicator & Page Indicator */}
                                <div className="flex justify-between items-center text-[9pt] font-mono text-zinc-500 mt-1">
                                    <span className="italic">{copySubtitle}</span>
                                    {page.totalPages > 1 && (
                                        <span className="font-bold bg-zinc-100 px-2 py-0.5 rounded border border-zinc-300">
                                            หน้า {page.pageNum} / {page.totalPages}
                                        </span>
                                    )}
                                </div>

                                {/* Customer Info Box (Shown on first page or multi-page header) */}
                                {page.isFirst && (
                                    <div className="mt-2 border-2 border-zinc-950 bg-zinc-50/70 px-3 py-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-[10.5pt]">
                                        <div>
                                            <div className="font-mono text-[9pt] font-bold uppercase tracking-wider text-zinc-600 mb-0.5">
                                                [ ข้อมูลผู้ซื้อสินค้า / ผู้รับบริการ (CUSTOMER INFO) ]
                                            </div>
                                            <div className="font-bold text-[11.5pt] text-zinc-950">
                                                {invoice.customer_name || 'ลูกค้าทั่วไป (Cash Customer)'}
                                            </div>
                                            <div className="text-[10pt] text-zinc-800 leading-tight mt-0.5">
                                                {invoice.customer_address || '-'}
                                            </div>
                                        </div>

                                        <div className="flex flex-col justify-end md:items-end font-mono text-[10pt] space-y-0.5">
                                            <div>
                                                <span className="text-zinc-600">เลขประจำตัวผู้เสียภาษี: </span>
                                                <strong className="text-zinc-950 font-bold">{formatTaxId(invoice.customer_tax_id)}</strong>
                                            </div>
                                            <div>
                                                <span className="text-zinc-600">สถานประกอบการ: </span>
                                                <span className="text-zinc-950 font-semibold">{formatBranch(invoice.customer_branch_type, invoice.customer_branch_code)}</span>
                                            </div>
                                            {invoice.customer_phone && (
                                                <div>
                                                    <span className="text-zinc-600">เบอร์โทรศัพท์: </span>
                                                    <span className="text-zinc-900">{invoice.customer_phone}</span>
                                                </div>
                                            )}
                                            {invoice.customer_email && (
                                                <div>
                                                    <span className="text-zinc-600">อีเมล: </span>
                                                    <span className="text-zinc-900">{invoice.customer_email}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Items Table */}
                                <div className="mt-2.5">
                                    <table className="w-full text-left border-collapse border-2 border-zinc-950 text-[10.5pt]">
                                        <thead>
                                            <tr className="bg-zinc-100 border-b-2 border-zinc-950 font-mono text-[10pt] uppercase">
                                                <th className="py-1.5 px-2 border-r border-zinc-950 w-12 text-center">ลำดับ<br/>(No.)</th>
                                                <th className="py-1.5 px-2 border-r border-zinc-950">รายการสินค้า / บริการ<br/>(Description)</th>
                                                <th className="py-1.5 px-2 border-r border-zinc-950 w-16 text-center">จำนวน<br/>(Qty)</th>
                                                <th className="py-1.5 px-2 border-r border-zinc-950 w-24 text-right">ราคาต่อหน่วย<br/>(Unit Price)</th>
                                                <th className="py-1.5 px-2 w-24 text-right">จำนวนเงิน (บาท)<br/>(Amount THB)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {page.items.map((item, idx) => {
                                                const qty = Number(item.quantity || 1);
                                                const unitPrice = Number(item.price || item.price_at_time || 0);
                                                const amount = Number(item.amount || (qty * unitPrice));
                                                const globalIndex = itemStartIndex + idx + 1;

                                                return (
                                                    <tr key={idx} className="border-b border-zinc-300">
                                                        <td className="py-1 px-2 border-r border-zinc-950 text-center font-mono">{globalIndex}</td>
                                                        <td className="py-1 px-2 border-r border-zinc-950">
                                                            <div className="font-semibold text-zinc-950">{item.name || item.item_name}</div>
                                                            {item.selected_options && (
                                                                <div className="text-[9pt] text-zinc-600 font-mono">{item.selected_options}</div>
                                                            )}
                                                        </td>
                                                        <td className="py-1 px-2 border-r border-zinc-950 text-center font-mono">{qty}</td>
                                                        <td className="py-1 px-2 border-r border-zinc-950 text-right font-mono">{unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                                        <td className="py-1 px-2 text-right font-mono font-semibold text-zinc-950">{amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                                    </tr>
                                                );
                                            })}

                                            {page.items.length === 0 && (
                                                <tr className="border-b border-zinc-300">
                                                    <td colSpan={5} className="p-4 text-center text-zinc-500 italic">
                                                        ไม่มีรายการสินค้า
                                                    </td>
                                                </tr>
                                            )}

                                            {/* Compact filler rows only if very few items on single-page document */}
                                            {page.totalPages === 1 && page.items.length < 3 && Array.from({ length: Math.max(0, 3 - page.items.length) }).map((_, i) => (
                                                <tr key={`filler-${i}`} className="border-b border-zinc-200 text-transparent select-none">
                                                    <td className="py-1 px-2 border-r border-zinc-950 text-center font-mono">-</td>
                                                    <td className="py-1 px-2 border-r border-zinc-950">-</td>
                                                    <td className="py-1 px-2 border-r border-zinc-950 text-center font-mono">-</td>
                                                    <td className="py-1 px-2 border-r border-zinc-950 text-right font-mono">-</td>
                                                    <td className="py-1 px-2 text-right font-mono">-</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Multi-Page Continuation Notice */}
                                {!page.isLast && (
                                    <div className="text-right font-mono text-[9pt] text-zinc-500 mt-2 italic">
                                        (มีต่อหน้าถัดไป / Continued on page {page.pageNum + 1})
                                    </div>
                                )}

                                {/* Summary & Totals Calculation Block (Rendered on final page) */}
                                {page.isLast && (
                                    <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-2.5 items-start avoid-page-break">
                                        {/* Baht Text Box & Non-VAT Notice */}
                                        <div className="border-2 border-zinc-950 p-2.5 bg-zinc-50 flex flex-col justify-between min-h-[85px]">
                                            <div>
                                                <span className="font-mono text-[9pt] font-bold text-zinc-600 uppercase tracking-wider block">
                                                    [ จำนวนเงินตัวอักษร / AMOUNT IN WORDS ]
                                                </span>
                                                <div className="font-bold text-zinc-950 text-[11.5pt] mt-0.5 leading-snug">
                                                    ({bahtWords})
                                                </div>
                                            </div>

                                            <div className="font-mono text-[8.5pt] text-zinc-600 mt-1.5 pt-1.5 border-t border-zinc-300 leading-tight">
                                                {!isVat ? (
                                                    <span className="text-zinc-700 font-semibold">
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
                                        <div className="border-2 border-zinc-950 divide-y divide-zinc-300 font-mono text-[10.5pt]">
                                            <div className="flex justify-between px-2.5 py-1.5">
                                                <span className="text-zinc-700">รวมเป็นเงิน (Subtotal):</span>
                                                <span className="font-semibold text-zinc-950">฿{Number(invoice.subtotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                            </div>

                                            {Number(invoice.discount_amount || 0) > 0 && (
                                                <div className="flex justify-between px-2.5 py-1 bg-amber-50/50 text-amber-900">
                                                    <span>หักส่วนลด (Discount):</span>
                                                    <span className="font-semibold">-฿{Number(invoice.discount_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            )}

                                            {isVat && (
                                                <>
                                                    <div className="flex justify-between px-2.5 py-1">
                                                        <span className="text-zinc-700">มูลค่าสินค้าก่อนภาษี (Pre-VAT):</span>
                                                        <span className="font-semibold text-zinc-950">฿{Number(invoice.pre_vat_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                    <div className="flex justify-between px-2.5 py-1">
                                                        <span className="text-zinc-700">ภาษีมูลค่าเพิ่ม 7% (VAT):</span>
                                                        <span className="font-semibold text-zinc-950">฿{Number(invoice.vat_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                </>
                                            )}

                                            <div className="flex justify-between px-2.5 py-1.5 bg-zinc-100 font-bold text-[12pt] text-zinc-950">
                                                <span>จำนวนเงินรวมทั้งสิ้น (Grand Total):</span>
                                                <span>฿{Number(invoice.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                            </div>

                                            {Number(invoice.wht_amount || 0) > 0 && (
                                                <>
                                                    <div className="flex justify-between px-2.5 py-1 text-zinc-700 bg-zinc-50">
                                                        <span>หักภาษี ณ ที่จ่าย {invoice.wht_rate}% (WHT):</span>
                                                        <span className="text-red-600 font-semibold">-฿{Number(invoice.wht_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                    <div className="flex justify-between px-2.5 py-1.5 bg-zinc-900 text-white font-bold text-[12pt]">
                                                        <span>ยอดชำระสุทธิ (Net Payable):</span>
                                                        <span>฿{Number(invoice.net_payable || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Signatures & Footer Section (Rendered on final page) */}
                            {page.isLast && (
                                <div className="mt-3.5 pt-2 border-t-2 border-zinc-950 grid grid-cols-2 gap-4 font-mono text-[10pt] avoid-page-break">
                                    {/* Left: Customer Signature */}
                                    <div className="flex flex-col items-center justify-end text-center p-2.5 border border-zinc-300">
                                        <div className="w-44 border-b border-zinc-950 pb-5 mb-1"></div>
                                        <div className="font-bold text-zinc-950 text-[10.5pt]">ผู้รับสินค้าหรือบริการ</div>
                                        <div className="text-[9pt] text-zinc-600">วันที่ / Date: ______/______/__________</div>
                                    </div>

                                    {/* Right: Issuer Authorized Signature with Overlay */}
                                    <div className="flex flex-col items-center justify-end text-center p-2.5 border border-zinc-300 relative">
                                        <div className="relative w-44 h-10 flex items-end justify-center mb-0.5">
                                            {showSignature && signatureImage ? (
                                                <img
                                                    src={signatureImage}
                                                    alt="Authorized Signature"
                                                    className="max-h-9 max-w-full object-contain filter drop-shadow-xs mb-0.5"
                                                />
                                            ) : null}
                                            <div className="absolute bottom-0 left-0 right-0 border-b border-zinc-950"></div>
                                        </div>

                                        <div className="font-bold text-zinc-950 text-[10.5pt]">
                                            ( {companySettings?.tax_signature_name || invoice.signature_name || 'ผู้มีอำนาจลงนาม / ผู้รับเงิน'} )
                                        </div>
                                        {companySettings?.tax_signature_position && (
                                            <div className="text-[9.5pt] text-zinc-700 font-sans">
                                                {companySettings.tax_signature_position}
                                            </div>
                                        )}
                                        <div className="text-[9pt] text-zinc-600">วันที่ / Date: {formattedDate}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* SEND EMAIL MODAL */}
            {showEmailModal && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 font-sans text-xs">
                    <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] shadow-2xl rounded-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
                        {/* Modal Header */}
                        <div className="bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-5 py-3.5 flex items-center justify-between border-b border-[oklch(85%_0.012_28)]">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-[oklch(52%_0.16_28)] text-white rounded">
                                    <Mail size={15} />
                                </div>
                                <div>
                                    <h3 className="font-mono font-bold text-sm uppercase tracking-tight">
                                        ส่งเอกสารให้ลูกค้าทางอีเมล (Send PDF via Email)
                                    </h3>
                                    <p className="font-mono text-[10px] text-zinc-400">
                                        แนบเอกสาร {docTitle} รูปแบบ PDF ขนาด A4 ตรงตามระเบียบสรรพากร
                                    </p>
                                </div>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setShowEmailModal(false)}
                                className="p-1 text-zinc-400 hover:text-white rounded cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto bg-[oklch(97%_0.008_28)]">
                            {/* 1. PDF Attachment Status Card */}
                            <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] p-3.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="p-2.5 bg-red-100 text-red-700 rounded-lg shrink-0 border border-red-200">
                                        <FileText size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-mono text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 bg-red-700 text-white rounded">
                                                PDF DOCUMENT
                                            </span>
                                            <span className="font-mono font-bold text-xs text-[oklch(18%_0.012_28)] truncate">
                                                {pdfFileName}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-[oklch(42%_0.010_28)] mt-0.5 font-mono">
                                            A4 Portrait • ความละเอียดสูง • พร้อมหัวบิลและลายเซ็นดิจิทัล
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleSaveOrSharePdf}
                                    disabled={isGeneratingPdf}
                                    className="w-full sm:w-auto px-3.5 py-2 bg-[oklch(18%_0.012_28)] hover:bg-black disabled:opacity-50 text-[oklch(97%_0.008_28)] rounded-lg font-mono font-bold text-[11px] flex items-center justify-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                                >
                                    {isGeneratingPdf ? (
                                        <>
                                            <Loader2 size={12} className="animate-spin" />
                                            <span>กำลังเตรียม PDF...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Download size={12} />
                                            <span>บันทึก / ดาวน์โหลด PDF</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* 2. Customer Email & Subject Inputs */}
                            <div className="grid grid-cols-1 gap-3">
                                <div>
                                    <label className="font-mono font-bold text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                        อีเมลผู้รับ (Customer Email Address) *
                                    </label>
                                    <input
                                        type="email"
                                        value={recipientEmail}
                                        onChange={(e) => setRecipientEmail(e.target.value)}
                                        placeholder="client@company.com หรือ customer@gmail.com"
                                        className="w-full px-3 py-2 bg-white border border-[oklch(85%_0.012_28)] rounded-lg text-xs font-mono text-[oklch(18%_0.012_28)] focus:border-[oklch(52%_0.16_28)] focus:outline-none"
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="font-mono font-bold text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                        หัวข้ออีเมล (Subject)
                                    </label>
                                    <input
                                        type="text"
                                        value={emailSubject}
                                        onChange={(e) => setEmailSubject(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-[oklch(85%_0.012_28)] rounded-lg text-xs font-semibold text-[oklch(18%_0.012_28)] focus:border-[oklch(52%_0.16_28)] focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* 3. Professional Email Message Preview */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="font-mono font-bold text-[10px] text-[oklch(42%_0.010_28)] uppercase">
                                        ตัวอย่างเนื้อหาข้อความในอีเมล (Body Preview)
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleCopyEmailText}
                                        className="text-blue-700 hover:text-blue-900 font-mono text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                        {copiedEmailText ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                                        <span>{copiedEmailText ? 'คัดลอกข้อความแล้ว!' : 'คัดลอกข้อความ'}</span>
                                    </button>
                                </div>
                                <pre className="p-3 bg-white border border-[oklch(85%_0.012_28)] rounded-lg font-mono text-[10px] text-zinc-800 max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                                    {generateEmailBodyText()}
                                </pre>
                            </div>

                            {/* 4. One-Click Send Options with Auto-Download PDF */}
                            <div className="space-y-2 pt-2 border-t border-[oklch(85%_0.012_28)]">
                                <div className="flex items-center justify-between">
                                    <span className="font-mono font-bold text-[10px] text-[oklch(42%_0.010_28)] uppercase block">
                                        เลือกช่องทางส่งเอกสาร (Choose Send Channel):
                                    </span>
                                    <span className="font-mono text-[9.5px] text-[oklch(52%_0.16_28)]">
                                        * บันทึก PDF ให้อัตโนมัติพร้อมแนบส่ง
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
                                    {/* 1. Gmail Web */}
                                    <button
                                        type="button"
                                        onClick={handleOpenGmail}
                                        disabled={isGeneratingPdf}
                                        className="p-2.5 bg-red-50 hover:bg-red-100 text-red-900 border border-red-200 rounded-xl font-bold flex items-center justify-between transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        <div className="flex items-center gap-2">
                                            <ExternalLink size={14} />
                                            <span>เปิด Gmail Web</span>
                                        </div>
                                        <span className="text-[9px] bg-red-200 text-red-900 px-1.5 py-0.5 rounded font-normal">ยอดนิยม</span>
                                    </button>

                                    {/* 2. Outlook Web */}
                                    <button
                                        type="button"
                                        onClick={handleOpenOutlook}
                                        disabled={isGeneratingPdf}
                                        className="p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl font-bold flex items-center justify-between transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        <div className="flex items-center gap-2">
                                            <ExternalLink size={14} />
                                            <span>เปิด Outlook Web</span>
                                        </div>
                                        <span className="text-[9px] bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded font-normal">Microsoft</span>
                                    </button>

                                    {/* 3. Native Mail Client */}
                                    <button
                                        type="button"
                                        onClick={handleOpenMailto}
                                        disabled={isGeneratingPdf}
                                        className="p-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-300 rounded-xl font-bold flex items-center justify-between transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Send size={14} />
                                            <span>เปิด Mail App (เครื่อง)</span>
                                        </div>
                                        <span className="text-[9px] bg-zinc-300 text-zinc-900 px-1.5 py-0.5 rounded font-normal">Default</span>
                                    </button>

                                    {/* 4. Native Share PDF File / LINE */}
                                    <button
                                        type="button"
                                        onClick={handleNativeShare}
                                        disabled={isGeneratingPdf}
                                        className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl font-bold flex items-center justify-between transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Share2 size={14} />
                                            <span>แชร์ไฟล์ PDF / ส่งใน LINE</span>
                                        </div>
                                        <span className="text-[9px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded font-normal">แชร์ไฟล์</span>
                                    </button>
                                </div>

                                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-900 leading-relaxed font-sans">
                                    💡 <strong>คำแนะนำ:</strong> เมื่อกดเปิด Gmail หรือ Outlook ระบบจะบันทึกไฟล์ <strong>{pdfFileName}</strong> ลงในเครื่องให้ท่านทันที เพียงลากไฟล์มาวางหรือกดปุ่มแนบไฟล์ (Attachment) เพื่อส่งให้ลูกค้าได้อย่างเป็นทางการ
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3 bg-[oklch(94%_0.010_28)] border-t border-[oklch(85%_0.012_28)] flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowEmailModal(false)}
                                className="px-4 py-2 border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] hover:bg-white rounded-lg font-mono font-bold text-xs cursor-pointer"
                            >
                                ปิดหน้าต่าง (Close)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const portalTarget = typeof document !== 'undefined' ? (document.getElementById('print-portal-root') || document.body) : null;
    return portalTarget ? createPortal(content, portalTarget) : content;
}

