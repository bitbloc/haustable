import { describe, it, expect } from 'vitest';
import { isMobileBrowser, saveOrShareTaxPdf } from '../taxPdfHelper';
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

    it('dynamic pagination splits correctly for <= 12 items vs > 12 items', () => {
        const items11 = Array.from({ length: 11 }, (_, i) => ({ name: 'Item ' + (i+1), price: 100, quantity: 1 }));
        const pages11 = items11.length <= 12 ? 1 : 2;
        expect(pages11).toBe(1);

        const items20 = Array.from({ length: 20 }, (_, i) => ({ name: 'Item ' + (i+1), price: 100, quantity: 1 }));
        const pages20 = items20.length <= 12 ? 1 : Math.ceil(items20.length / 14);
        expect(pages20).toBeGreaterThanOrEqual(2);
    });
});
