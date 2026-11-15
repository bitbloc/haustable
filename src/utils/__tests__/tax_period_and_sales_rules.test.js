import { describe, it, expect } from 'vitest';
import {
    toBangkokDateKey,
    bangkokYearStartIso,
    isTaxableSale,
    bookingSaleAmount,
    buildStableBillNumbers
} from '../thaiTaxHelper';
import { expenseDocGrade } from '../expenseConstants';
import { taxCustomerKey } from '../taxCustomerDirectory';

describe('Tax customer directory key', () => {
    it('same tax ID and branch is the same customer, whatever the name spelling', () => {
        const a = taxCustomerKey({ tax_id: '0905555001144', branch_type: 'head_office', company_name: 'บริษัท เวิลด์เทรนนิ่ง จำกัด' });
        const b = taxCustomerKey({ tax_id: '0-9055-55001-14-4', branch_type: 'head_office', company_name: 'บริษัท เวิลด์เทรนนิ่ง จำกัด ( สำนักงานใหญ่ )' });
        expect(a).toBe(b);
    });
    it('different branches of one company are different customers', () => {
        expect(taxCustomerKey({ tax_id: '0105540030477', branch_type: 'branch', branch_code: '00001' }))
            .not.toBe(taxCustomerKey({ tax_id: '0105540030477', branch_type: 'head_office' }));
    });
    it('without a tax ID the name identifies the customer', () => {
        expect(taxCustomerKey({ tax_id: '', company_name: ' คุณอ้อน ' })).toBe(taxCustomerKey({ company_name: 'คุณอ้อน' }));
    });
});

describe('Thai tax periods use Bangkok calendar days', () => {
    it('a bill at 00:30 Bangkok on the 1st belongs to the new month, not the old one', () => {
        // 2026-12-01 00:30 +07:00 is still 2026-11-30 in UTC
        expect(toBangkokDateKey('2026-11-30T17:30:00Z')).toBe('2026-12-01');
        expect(toBangkokDateKey('2026-12-31T17:00:00Z')).toBe('2027-01-01');
        expect(toBangkokDateKey('2026-12-31T16:59:59Z')).toBe('2026-12-31');
    });

    it('year start is midnight Bangkok', () => {
        expect(bangkokYearStartIso(2026)).toBe('2025-12-31T17:00:00.000Z');
    });

    it('handles empty and invalid input', () => {
        expect(toBangkokDateKey('')).toBe('');
        expect(toBangkokDateKey(null)).toBe('');
    });
});

describe('One rule for what counts as a sale', () => {
    it('only completed bills are sales', () => {
        expect(isTaxableSale({ status: 'completed' })).toBe(true);
        ['seated', 'pending', 'confirmed', 'cancelled', 'void', 'deleted', undefined].forEach(status => {
            expect(isTaxableSale({ status })).toBe(false);
        });
    });

    it('sale amount is what the customer was charged', () => {
        expect(bookingSaleAmount({ total_amount: 1234.5 })).toBe(1234.5);
        expect(bookingSaleAmount({ total_amount: 0, total_price: 99 })).toBe(0);
        expect(bookingSaleAmount({ total_price: 99 })).toBe(99);
        expect(bookingSaleAmount({})).toBe(0);
    });
});

describe('Stable bill numbers', () => {
    const bills = [
        { id: 'c', status: 'completed', created_at: '2026-11-02T05:00:00Z' },
        { id: 'a', status: 'completed', created_at: '2026-11-01T05:00:00Z' },
        { id: 'x', status: 'seated', created_at: '2026-11-01T06:00:00Z' },
        { id: 'b', status: 'completed', created_at: '2026-11-01T07:00:00Z' },
        { id: 'd', status: 'completed', created_at: '2026-12-01T05:00:00Z' },
        { id: 'e', status: 'completed', created_at: '2026-12-02T05:00:00Z', order_number: 'ORD-77' }
    ];

    it('numbers run in time order per Thai month and skip non-sales', () => {
        const n = buildStableBillNumbers(bills);
        expect(n.get('a')).toBe('BILL-202611-0001');
        expect(n.get('b')).toBe('BILL-202611-0002');
        expect(n.get('c')).toBe('BILL-202611-0003');
        expect(n.get('d')).toBe('BILL-202612-0001');
        expect(n.get('e')).toBe('ORD-77');
        expect(n.has('x')).toBe(false);
    });

    it('a bill keeps its number whatever else is filtered on screen', () => {
        const all = buildStableBillNumbers(bills);
        const again = buildStableBillNumbers([...bills].reverse());
        expect(again.get('c')).toBe(all.get('c'));
    });
});

describe('Expense evidence grades always cover every expense', () => {
    it('maps every doc type to exactly one grade', () => {
        expect(expenseDocGrade({ doc_type: 'tax_invoice' })).toBe('A');
        expect(expenseDocGrade({ doc_type: 'cash_bill' })).toBe('B');
        ['slip_only', 'receipt_voucher', 'slip', undefined, ''].forEach(doc_type => {
            expect(expenseDocGrade({ doc_type })).toBe('C');
        });
    });
});
