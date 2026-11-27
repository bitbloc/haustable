import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/supabaseClient', () => ({ supabase: {} }));

import {
    basisAmount,
    buildPayrollExpense,
    hrPayrollError,
    lastDayOfMonth,
    monthState,
    payrollNotes,
    previousMonth,
    thaiMonthLabel,
    wagesInMonth,
    PAYROLL_NOTE_PREFIX
} from '../payrollExpense';

// Dummy figures
const summary = {
    month: '2026-11', headcount: 4, wages: 30000, overtime: 1500, allowances: 2000,
    deductions: 1200, gross: 33500, net: 32300
};

describe('month helpers', () => {
    it('finds the last day, also in a leap February', () => {
        expect(lastDayOfMonth('2026-11')).toBe('2026-11-30');
        expect(lastDayOfMonth('2028-02')).toBe('2028-02-29');
        expect(lastDayOfMonth('2026-13')).toBe('');
    });

    it('names the month with the Buddhist year', () => {
        expect(thaiMonthLabel('2026-11')).toBe('พฤศจิกายน 2569');
    });

    it('takes the month before, across a year', () => {
        expect(previousMonth('2026-11-27')).toBe('2026-10');
        expect(previousMonth('2027-01-05')).toBe('2026-12');
    });

    it('tells ended, current and future months apart', () => {
        expect(monthState('2026-10', '2026-11-27')).toBe('ended');
        expect(monthState('2026-11', '2026-11-27')).toBe('current');
        expect(monthState('2026-12', '2026-11-27')).toBe('future');
    });
});

describe('wagesInMonth', () => {
    it('lists the month\'s wage rows, the HR one first', () => {
        const rows = wagesInMonth([
            { id: 1, category: 'staff_wages', expense_date: '2026-11-05', notes: 'จ่ายล่วงหน้า' },
            { id: 2, category: 'staff_wages', expense_date: '2026-11-30', notes: `${PAYROLL_NOTE_PREFIX} เดือน ...` },
            { id: 3, category: 'staff_wages', expense_date: '2026-10-31', notes: '' },
            { id: 4, category: 'raw_material', expense_date: '2026-11-30', notes: '' }
        ], '2026-11');
        expect(rows.map(r => r.id)).toEqual([2, 1]);
        expect(rows[0].fromHr).toBe(true);
    });
});

describe('buildPayrollExpense', () => {
    it('writes one wage expense on the confirmed amount and date', () => {
        const { row, error } = buildPayrollExpense({ summary, basis: 'gross', amount: '33,500', date: '2026-11-30' });
        expect(error).toBeUndefined();
        expect(row).toMatchObject({
            expense_date: '2026-11-30',
            title: 'เงินเดือนพนักงาน เดือน พฤศจิกายน 2569',
            category: 'staff_wages',
            doc_type: 'receipt_voucher',
            amount: 33500,
            vat_included: false,
            vat_amount: 0,
            payment_method: 'TRANSFER'
        });
        expect(row.notes.startsWith(PAYROLL_NOTE_PREFIX)).toBe(true);
        expect(row.notes).toContain('ยอดก่อนหัก');
    });

    it('refuses a date outside the month, no amount, or no HR figures', () => {
        expect(buildPayrollExpense({ summary, amount: 100, date: '2026-12-01' }).error).toContain('พฤศจิกายน');
        expect(buildPayrollExpense({ summary, amount: '0', date: '2026-11-30' }).error).toBeTruthy();
        expect(buildPayrollExpense({ summary: null, amount: 100, date: '2026-11-30' }).error).toBeTruthy();
    });

    it('keeps the HR breakdown and the basis in the notes', () => {
        const notes = payrollNotes(summary, 'net');
        expect(notes).toContain('ยอดจ่ายจริง)');
        expect(notes).toContain('พนักงาน 4 คน');
        expect(notes).toContain('OT 1,500.00');
    });
});

describe('basisAmount and errors', () => {
    it('picks gross or net', () => {
        expect(basisAmount(summary, 'gross')).toBe(33500);
        expect(basisAmount(summary, 'net')).toBe(32300);
    });

    it('explains why HR gave nothing', () => {
        expect(hrPayrollError('FORBIDDEN')).toContain('ผู้ดูแลระบบ');
        expect(hrPayrollError('HR unreachable: timeout')).toContain('ติดต่อระบบ HR ไม่ได้');
        expect(hrPayrollError('')).toBe('ดึงยอดจาก HR ไม่สำเร็จ');
    });
});
