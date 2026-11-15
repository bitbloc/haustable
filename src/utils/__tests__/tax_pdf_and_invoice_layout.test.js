import { describe, it, expect } from 'vitest';
import { isMobileBrowser, saveOrShareTaxPdf, paginateInvoiceItems } from '../taxPdfHelper';
import { thaiBahtText, formatTaxId, formatBranch } from '../thaiTaxHelper';

describe('taxPdfHelper & Mobile Invoicing Logic', () => {
    it('isMobileBrowser returns boolean safely', () => {
        const result = isMobileBrowser();
        expect(typeof result).toBe('boolean');
    });

    it('formatTaxId properly formats 13-digit Thai tax ID', () => {
        expect(formatTaxId('1120100144907')).toBe('1-1201-00144-90-7');
        expect(formatTaxId('')).toBe('-');
    });

    it('thaiBahtText calculates correct Thai baht strings', () => {
        expect(thaiBahtText(1898)).toBe('หนึ่งพันแปดร้อยเก้าสิบแปดบาทถ้วน');
        expect(thaiBahtText(0)).toBe('ศูนย์บาทถ้วน');
    });

    it('saveOrShareTaxPdf handles fallback gracefully when navigator.share is absent', async () => {
        const fakeBlob = new Blob(['%PDF-1.4 test'], { type: 'application/pdf' });
        const result = await saveOrShareTaxPdf(
            { blob: fakeBlob, fileName: 'test-invoice.pdf' },
            { preferShare: false }
        );
        expect(result).toBeDefined();
        expect(result.downloaded || result.openedInTab || result.shared !== undefined).toBe(true);
    });

    it('invoice pagination always ends on a page with totals and keeps every item', () => {
        const make = (n) => Array.from({ length: n }, (_, i) => ({ name: 'Item ' + (i + 1) }));
        for (let n = 0; n <= 60; n++) {
            const pages = paginateInvoiceItems(make(n));
            const last = pages[pages.length - 1];
            expect(last.isLast).toBe(true);
            expect(pages.filter(p => p.isLast)).toHaveLength(1);
            expect(pages[0].isFirst).toBe(true);
            expect(pages.reduce((s, p) => s + p.items.length, 0)).toBe(n);
            expect(last.items.length).toBeLessThanOrEqual(12);
            if (n > 0) expect(last.items.length).toBeGreaterThan(0);
            pages.forEach((p, i) => {
                expect(p.pageNum).toBe(i + 1);
                expect(p.totalPages).toBe(pages.length);
                expect(p.items.length).toBeLessThanOrEqual(i === 0 ? 14 : 18);
            });
        }
        expect(paginateInvoiceItems(make(11))).toHaveLength(1);
        expect(paginateInvoiceItems(make(13))).toHaveLength(2); // was 1 page with no totals
        expect(paginateInvoiceItems(make(14))).toHaveLength(2);
    });
});
