import { describe, it, expect } from 'vitest';
import { thaiBahtText, validateThaiTaxId, calculateDocumentTotals } from '../thaiTaxHelper';
import { getPrinterCellWidth, padEndPrinter, wrapTextByWords } from '../printerHelper';
import { calculateMemberTier, parseTiersConfig, DEFAULT_CRM_TIERS } from '../crmHelper';
import { checkDuplicateExpense } from '../duplicateDetector';

describe('System Audit - Phase 1 & 4: Thai Tax & Financial Calculation Engine', () => {
    it('should convert numbers to Thai Baht text correctly (thaiBahtText)', () => {
        expect(thaiBahtText(0)).toBe('ศูนย์บาทถ้วน');
        expect(thaiBahtText(1)).toBe('หนึ่งบาทถ้วน');
        expect(thaiBahtText(11)).toBe('สิบเอ็ดบาทถ้วน');
        expect(thaiBahtText(21)).toBe('ยี่สิบเอ็ดบาทถ้วน');
        expect(thaiBahtText(100)).toBe('หนึ่งร้อยบาทถ้วน');
        expect(thaiBahtText(1011)).toBe('หนึ่งพันสิบเอ็ดบาทถ้วน');
        expect(thaiBahtText(1520.50)).toBe('หนึ่งพันห้าร้อยยี่สิบบาทห้าสิบสตางค์');
        expect(thaiBahtText(1000000)).toBe('หนึ่งล้านบาทถ้วน');
        expect(thaiBahtText(1234567.89)).toBe('หนึ่งล้านสองแสนสามหมื่นสี่พันห้าร้อยหกสิบเจ็ดบาทแปดสิบเก้าสตางค์');
    });

    it('should validate Thai Tax IDs with Mod 11 checksum (validateThaiTaxId)', () => {
        // Valid 13-digit Thai Tax ID / ID card (Mod 11 verified: 1100700123455)
        expect(validateThaiTaxId('1100700123455')).toBe(true);
        // Invalid IDs
        expect(validateThaiTaxId('1234567890123')).toBe(false);
        expect(validateThaiTaxId('123')).toBe(false);
        expect(validateThaiTaxId('')).toBe(false);
    });

    it('should calculate VAT 7% inclusive and exclusive correctly (calculateDocumentTotals)', () => {
        // Inclusive VAT (e.g. Total 107 -> Pre-VAT 100, VAT 7)
        const inclusive = calculateDocumentTotals({
            items: [{ price: 107, quantity: 1 }],
            isVatRegistered: true,
            vatModel: 'inclusive'
        });
        expect(inclusive.subtotal).toBe(107);
        expect(inclusive.preVatAmount).toBe(100);
        expect(inclusive.vatAmount).toBe(7);
        expect(inclusive.totalAmount).toBe(107);

        // Exclusive VAT (e.g. Net 100 -> VAT 7 -> Grand Total 107)
        const exclusive = calculateDocumentTotals({
            items: [{ price: 100, quantity: 1 }],
            isVatRegistered: true,
            vatModel: 'exclusive'
        });
        expect(exclusive.subtotal).toBe(100);
        expect(exclusive.preVatAmount).toBe(100);
        expect(exclusive.vatAmount).toBe(7);
        expect(exclusive.totalAmount).toBe(107);

        // Withholding Tax 3%
        const wht = calculateDocumentTotals({
            items: [{ price: 1000, quantity: 1 }],
            isVatRegistered: false,
            whtRate: 3
        });
        expect(wht.whtAmount).toBe(30);
        expect(wht.netPayable).toBe(970);
    });
});

describe('System Audit - Phase 2: ESC/POS Thermal Printer & Thai Graphemes Engine', () => {
    it('should count combining Thai vowels and tone marks correctly by printhead cell width', () => {
        // "กิมจิ" has 3 clusters: ก+ิ (1 cell), ม (1 cell), จ+ิ (1 cell) -> exactly 3 cells!
        expect(getPrinterCellWidth('กิมจิ')).toBe(3);
        expect(getPrinterCellWidth('ชาไทย')).toBe(5);
    });

    it('should pad string based on printer cell width without right-edge distortion', () => {
        const padded = padEndPrinter('โต๊ะ 1', 10);
        expect(getPrinterCellWidth(padded)).toBe(10);
    });

    it('should wrap Thai sentences by word tokens (wrapTextByWords)', () => {
        const text = 'น้ำผึ้งมะนาวโซดาปั่นท็อปปิ้งเจลลี่';
        const lines = wrapTextByWords(text, 15);
        expect(lines.length).toBeGreaterThan(1);
        lines.forEach(line => {
            expect(getPrinterCellWidth(line)).toBeLessThanOrEqual(15);
        });
    });
});

describe('System Audit - Phase 3: CRM Loyalty Tier & Duplicate Detection Engine', () => {
    it('should calculate tier thresholds and multipliers correctly', () => {
        const tiers = parseTiersConfig(DEFAULT_CRM_TIERS);

        // 0 - 3999 -> Common (1.0x)
        const user1 = calculateMemberTier(1500, 1500, tiers);
        expect(user1.current_tier).toBe('Haus Common');
        expect(user1.multiplier).toBe(1.00);

        // 4000 - 11999 -> People (1.25x)
        const user2 = calculateMemberTier(5000, 5000, tiers);
        expect(user2.current_tier).toBe('Haus People');
        expect(user2.multiplier).toBe(1.25);

        // 12000+ -> Inner Haus (1.50x)
        const user3 = calculateMemberTier(15000, 15000, tiers);
        expect(user3.current_tier).toBe('Inner Haus');
        expect(user3.multiplier).toBe(1.50);
    });

    it('should detect duplicate expense receipts by invoice number and exact amount+date', () => {
        const existingExpenses = [
            {
                id: 'exp_1',
                amount: 1500,
                expense_date: '2026-08-19T10:00:00',
                vendor_name: 'Siam Makro',
                invoice_no: 'INV-9988'
            }
        ];

        // Match by invoice number
        const match1 = checkDuplicateExpense({
            amount: 2000,
            expense_date: '2026-08-20',
            vendor_name: 'Makro',
            invoice_no: 'INV-9988'
        }, existingExpenses);
        expect(match1?.isDuplicate).toBe(true);
        expect(match1?.confidence).toBe('HIGH');

        // Match by amount + date + vendor
        const match2 = checkDuplicateExpense({
            amount: 1500,
            expense_date: '2026-08-19',
            vendor_name: 'Siam Makro'
        }, existingExpenses);
        expect(match2?.isDuplicate).toBe(true);
        expect(match2?.confidence).toBe('HIGH');

        // Distinct expense (different date & amount)
        const noMatch = checkDuplicateExpense({
            amount: 320,
            expense_date: '2026-08-21',
            vendor_name: 'PTT Gas'
        }, existingExpenses);
        expect(noMatch).toBeNull();
    });
});
