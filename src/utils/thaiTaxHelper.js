/**
 * Thai Tax & Invoicing Helper Utilities
 * Compliant with Thai Revenue Department (กรมสรรพากร) standards.
 */

// Digits and position words in Thai
const THAI_DIGITS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const THAI_POSITIONS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

/**
 * Converts a number to Thai Baht text format (e.g. 1500.25 -> "หนึ่งพันห้าร้อยบาทยี่สิบห้าสตางค์")
 * @param {number|string} amount 
 * @returns {string} Thai Baht text
 */
export function thaiBahtText(amount) {
    const num = parseFloat(amount);
    if (isNaN(num)) return 'ศูนย์บาทถ้วน';
    if (num === 0) return 'ศูนย์บาทถ้วน';

    // Handle negative numbers
    const isNegative = num < 0;
    const absNum = Math.abs(num);

    // Format to 2 decimal places
    const fixedStr = absNum.toFixed(2);
    const [bahtStr, satangStr] = fixedStr.split('.');

    const convertGroup = (str) => {
        let result = '';
        const len = str.length;
        for (let i = 0; i < len; i++) {
            const digit = parseInt(str.charAt(i), 10);
            const pos = len - i - 1;

            if (digit !== 0) {
                if (pos === 0 && digit === 1 && len > 1 && parseInt(str.charAt(len - 2), 10) !== 0) {
                    result += 'เอ็ด';
                } else if (pos === 1 && digit === 2) {
                    result += 'ยี่สิบ';
                } else if (pos === 1 && digit === 1) {
                    result += 'สิบ';
                } else {
                    result += THAI_DIGITS[digit] + (pos === 1 ? '' : THAI_POSITIONS[pos]);
                    if (pos === 1) result += 'สิบ';
                }
            }
        }
        return result;
    };

    // Convert Baht section (supports numbers > 1 million recursively)
    const convertBaht = (str) => {
        if (parseInt(str, 10) === 0) return '';
        if (str.length <= 6) return convertGroup(str);
        
        const millions = str.slice(0, -6);
        const remainder = str.slice(-6);
        return convertBaht(millions) + 'ล้าน' + convertGroup(remainder);
    };

    let bahtText = convertBaht(bahtStr);
    if (!bahtText) bahtText = 'ศูนย์';
    bahtText += 'บาท';

    const satangVal = parseInt(satangStr, 10);
    let satangText = '';
    if (satangVal > 0) {
        satangText = convertGroup(satangStr) + 'สตางค์';
    } else {
        satangText = 'ถ้วน';
    }

    return (isNegative ? 'ลบ' : '') + bahtText + satangText;
}

/**
 * Validates a 13-digit Thai National ID / Corporate Tax ID using Mod 11 checksum
 * @param {string} taxId 
 * @returns {boolean}
 */
export function validateThaiTaxId(taxId) {
    if (!taxId) return false;
    const cleanId = String(taxId).replace(/\D/g, '');
    if (cleanId.length !== 13) return false;

    // Checksum calculation (Standard Thai 13-digit algorithm)
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += parseInt(cleanId.charAt(i), 10) * (13 - i);
    }
    const checkDigit = (11 - (sum % 11)) % 10;
    return checkDigit === parseInt(cleanId.charAt(12), 10);
}

/**
 * Formats a 13-digit Tax ID into standard Thai layout: X-XXXX-XXXXX-XX-X
 * @param {string} taxId 
 * @returns {string}
 */
export function formatTaxId(taxId) {
    if (!taxId) return '-';
    const clean = String(taxId).replace(/\D/g, '');
    if (clean.length !== 13) return clean || '-';
    return `${clean.slice(0, 1)}-${clean.slice(1, 5)}-${clean.slice(5, 10)}-${clean.slice(10, 12)}-${clean.slice(12, 13)}`;
}

/**
 * Formats Branch code / Type to readable Thai string
 * @param {string} branchType 'head_office' | 'branch'
 * @param {string} branchCode '00000', '00001', etc.
 * @returns {string}
 */
export function formatBranch(branchType, branchCode) {
    if (branchType === 'head_office' || branchCode === '00000' || !branchCode) {
        return 'สำนักงานใหญ่ (Head Office)';
    }
    return `สาขาที่ ${String(branchCode).padStart(5, '0')}`;
}

/**
 * Calculates complete tax breakdown for VAT / Non-VAT
 * @param {Object} params
 * @param {Array} params.items - List of { price, quantity, vat_eligible }
 * @param {number} params.discountAmount - Total discount in THB
 * @param {boolean} params.isVatRegistered - true if business is registered for VAT
 * @param {string} params.vatModel - 'inclusive' (default in TH restaurants) or 'exclusive'
 * @param {number} params.vatRate - 7 (percent)
 * @param {number} params.whtRate - 0, 1, 2, 3, 5 (Withholding tax percent)
 */
export function calculateDocumentTotals({
    items = [],
    discountAmount = 0,
    isVatRegistered = false,
    vatModel = 'inclusive',
    vatRate = 7,
    whtRate = 0
}) {
    const rawSubtotal = items.reduce((acc, item) => {
        const p = parseFloat(item.price || item.price_at_time || 0);
        const q = parseFloat(item.quantity || 1);
        return acc + (p * q);
    }, 0);

    const discount = Math.min(rawSubtotal, Math.max(0, parseFloat(discountAmount || 0)));
    const totalAfterDiscount = Math.max(0, rawSubtotal - discount);

    let preVatAmount = totalAfterDiscount;
    let vatAmount = 0;
    let grandTotal = totalAfterDiscount;

    if (isVatRegistered) {
        const rate = parseFloat(vatRate || 7);
        if (vatModel === 'inclusive') {
            // Inclusive VAT: Gross = Total, Net = Total * 100 / (100 + rate), VAT = Total * rate / (100 + rate)
            preVatAmount = (totalAfterDiscount * 100) / (100 + rate);
            vatAmount = totalAfterDiscount - preVatAmount;
            grandTotal = totalAfterDiscount;
        } else {
            // Exclusive VAT: Net = Total, VAT = Net * rate / 100, Grand = Net + VAT
            preVatAmount = totalAfterDiscount;
            vatAmount = (preVatAmount * rate) / 100;
            grandTotal = preVatAmount + vatAmount;
        }
    }

    // Withholding Tax (WHT) calculation (if applicable, e.g. for corporate service billing)
    const whtPercent = parseFloat(whtRate || 0);
    const whtAmount = whtPercent > 0 ? (preVatAmount * whtPercent) / 100 : 0;
    const netPayable = Math.max(0, grandTotal - whtAmount);

    return {
        subtotal: parseFloat(rawSubtotal.toFixed(2)),
        discountAmount: parseFloat(discount.toFixed(2)),
        preVatAmount: parseFloat(preVatAmount.toFixed(2)),
        vatRate: isVatRegistered ? parseFloat(vatRate || 7) : 0,
        vatAmount: parseFloat(vatAmount.toFixed(2)),
        totalAmount: parseFloat(grandTotal.toFixed(2)),
        whtRate: whtPercent,
        whtAmount: parseFloat(whtAmount.toFixed(2)),
        netPayable: parseFloat(netPayable.toFixed(2)),
        isVatRegistered: Boolean(isVatRegistered),
        vatModel
    };
}

/**
 * Generates official sequence number
 * @param {string} prefix e.g. 'REC' or 'INV'
 * @param {string} yearMonthStr e.g. '202608'
 * @param {number} seqNumber e.g. 1 -> '0001'
 * @returns {string} e.g. 'REC-202608-0001'
 */
export function generateDocumentNumber(prefix = 'REC', yearMonthStr, seqNumber = 1) {
    const ym = yearMonthStr || new Date().toISOString().slice(0, 7).replace('-', '');
    const padded = String(seqNumber).padStart(4, '0');
    return `${prefix}-${ym}-${padded}`;
}

/**
 * Triggers CSV Download in browser
 * @param {string} csvContent 
 * @param {string} filename 
 */
export function downloadCsvFile(csvContent, filename) {
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Generates Thai Revenue Department compliant Sales Tax Report (รายงานภาษีขาย ภ.พ.30) or Non-VAT Sales Ledger CSV
 */
export function exportSalesTaxReportCsv(invoices = [], monthStr = '', isVatRegistered = false) {
    const title = isVatRegistered 
        ? `"รายงานภาษีขาย (Sales Tax Report ภ.พ.30) - ประจำงวด ${monthStr || ''}"`
        : `"รายงานสรุปยอดขายและรายรับ (Sales & Revenue Ledger) - ประจำงวด ${monthStr || ''}"`;

    const headers = [
        'ลำดับ (No.)',
        'วัน เดือน ปี (Date)',
        'เล่มที่/เลขที่เอกสาร (Doc No.)',
        'ชื่อผู้ซื้อสินค้า/บริการ (Customer Name)',
        'เลขประจำตัวผู้เสียภาษี (Tax ID)',
        'สถานประกอบการ (Branch)',
        isVatRegistered ? 'มูลค่าสินค้า/บริการก่อนภาษี (Pre-VAT)' : 'มูลค่าสินค้า/บริการ (Amount)',
        isVatRegistered ? 'ภาษีมูลค่าเพิ่ม 7% (VAT)' : 'ภาษีมูลค่าเพิ่ม (VAT Exempt)',
        'จำนวนเงินรวม (Total Amount)',
        'สถานะ (Status)'
    ];

    const rows = invoices.map((inv, index) => {
        const dateStr = inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('th-TH') : '-';
        const isCancelled = inv.status === 'cancelled';
        const branchStr = inv.customer_branch_type === 'head_office' || inv.customer_branch_code === '00000' 
            ? 'สำนักงานใหญ่' 
            : `สาขาที่ ${inv.customer_branch_code || '00001'}`;

        return [
            index + 1,
            `"${dateStr}"`,
            `"${inv.invoice_number || '-'}"`,
            `"${(inv.customer_name || 'ลูกค้าทั่วไป').replace(/"/g, '""')}"`,
            `"${formatTaxId(inv.customer_tax_id)}"`,
            `"${branchStr}"`,
            isCancelled ? '0.00' : (Number(inv.pre_vat_amount || 0)).toFixed(2),
            isCancelled ? '0.00' : (Number(inv.vat_amount || 0)).toFixed(2),
            isCancelled ? '0.00' : (Number(inv.total_amount || 0)).toFixed(2),
            `"${isCancelled ? 'ยกเลิก (CANCELLED)' : 'ปกติ (ACTIVE)'}"`
        ];
    });

    // Summary calculations
    const activeInvoices = invoices.filter(i => i.status !== 'cancelled');
    const totalPreVat = activeInvoices.reduce((sum, i) => sum + Number(i.pre_vat_amount || 0), 0);
    const totalVat = activeInvoices.reduce((sum, i) => sum + Number(i.vat_amount || 0), 0);
    const grandTotal = activeInvoices.reduce((sum, i) => sum + Number(i.total_amount || 0), 0);

    const summaryRow = [
        'รวมทั้งสิ้น (TOTAL)',
        '',
        '',
        '',
        '',
        '',
        totalPreVat.toFixed(2),
        totalVat.toFixed(2),
        grandTotal.toFixed(2),
        `"รวม ${activeInvoices.length} ฉบับ"`
    ];

    const csvLines = [
        title,
        headers.join(','),
        ...rows.map(r => r.join(',')),
        summaryRow.join(',')
    ];

    return csvLines.join('\r\n');
}

/**
 * Generates Withholding Tax Report (ภ.ง.ด. 1, 3, 53) CSV
 */
export function exportWithholdingTaxCsv(records = [], monthStr = '') {
    const headers = [
        'ลำดับ (No.)',
        'วันที่จ่าย (Payment Date)',
        'เลขที่เอกสาร 50 ทวิ (Doc No.)',
        'แบบยื่น (Form)',
        'ชื่อผู้ถูกหักภาษี (Payee Name)',
        'เลขประจำตัวผู้เสียภาษี (Tax ID)',
        'ประเภทเงินได้ (Income Type)',
        'อัตราภาษี (Rate %)',
        'จำนวนเงินที่จ่าย (Gross Amount)',
        'ภาษีที่หักและนำส่ง (Tax Withheld)',
        'ยอดจ่ายสุทธิ (Net Paid)'
    ];

    const rows = records.map((rec, index) => {
        const dateStr = rec.payment_date ? new Date(rec.payment_date).toLocaleDateString('th-TH') : '-';
        return [
            index + 1,
            `"${dateStr}"`,
            `"${rec.doc_number || '-'}"`,
            `"${rec.form_type || 'PND53'}"`,
            `"${(rec.payee_name || '-').replace(/"/g, '""')}"`,
            `"${formatTaxId(rec.payee_tax_id)}"`,
            `"${(rec.income_type || 'ค่าบริการ').replace(/"/g, '""')}"`,
            `${rec.tax_rate || 3}%`,
            (Number(rec.gross_amount || 0)).toFixed(2),
            (Number(rec.tax_withheld || 0)).toFixed(2),
            (Number(rec.net_paid || 0)).toFixed(2)
        ];
    });

    const totalGross = records.reduce((sum, r) => sum + Number(r.gross_amount || 0), 0);
    const totalTax = records.reduce((sum, r) => sum + Number(r.tax_withheld || 0), 0);
    const totalNet = records.reduce((sum, r) => sum + Number(r.net_paid || 0), 0);

    const summaryRow = [
        'รวมทั้งสิ้น (TOTAL)',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        totalGross.toFixed(2),
        totalTax.toFixed(2),
        totalNet.toFixed(2)
    ];

    const csvLines = [
        `"รายงานสรุปภาษีเงินได้หัก ณ ที่จ่าย (Withholding Tax Report) - ประจำงวด ${monthStr || ''}"`,
        headers.join(','),
        ...rows.map(r => r.join(',')),
        summaryRow.join(',')
    ];

    return csvLines.join('\r\n');
}
