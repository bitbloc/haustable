/**
 * Monthly payroll from the HR system as one expense (Tax & Invoices -> ค่าใช้จ่าย).
 *
 * The HR system (inthehaus-hr) works out each month's pay. The edge function
 * hr-labor-cost returns its totals without names; the owner reviews them and records one
 * staff_wages expense per month, so wages reach the expense ledger, its exports and the
 * cash ledger like every other cost, with room for the payment evidence.
 */
import { supabase } from '../lib/supabaseClient';

const MONTHS_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

export const PAYROLL_CATEGORY = 'staff_wages';
// Marks an expense written from the HR figures (notes start with it)
export const PAYROLL_NOTE_PREFIX = 'เงินเดือนจากระบบ HR';

const isMonth = (ym) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(ym || ''));
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const fmt = (n) => r2(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Today in Bangkok as YYYY-MM-DD. */
export const bangkokToday = (now = Date.now()) => new Date(now + 7 * 3600 * 1000).toISOString().slice(0, 10);

/** The month before the current Bangkok month: the last one whose pay is complete. */
export const previousMonth = (today = bangkokToday()) => {
    const [y, m] = today.slice(0, 7).split('-').map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};

/** Last day of a month as YYYY-MM-DD. */
export const lastDayOfMonth = (ym) => {
    if (!isMonth(ym)) return '';
    const [y, m] = ym.split('-').map(Number);
    return `${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
};

/** "พฤศจิกายน 2569" (Buddhist year). */
export const thaiMonthLabel = (ym) => {
    if (!isMonth(ym)) return '';
    const [y, m] = ym.split('-').map(Number);
    return `${MONTHS_TH[m - 1]} ${y + 543}`;
};

/** 'ended' | 'current' | 'future', against today in Bangkok. */
export const monthState = (ym, today = bangkokToday()) => {
    const now = today.slice(0, 7);
    if (ym < now) return 'ended';
    if (ym === now) return 'current';
    return 'future';
};

/** Wage expenses already recorded in a month, the ones written from HR first. */
export const wagesInMonth = (expenses = [], ym) => (expenses || [])
    .filter(e => e && e.category === PAYROLL_CATEGORY && String(e.expense_date || '').slice(0, 7) === ym)
    .map(e => ({ ...e, fromHr: String(e.notes || '').startsWith(PAYROLL_NOTE_PREFIX) }))
    .sort((a, b) => Number(b.fromHr) - Number(a.fromHr));

/** The amount a basis stands for: 'gross' (cost to the shop) or 'net' (paid out). */
export const basisAmount = (summary, basis = 'gross') => r2(basis === 'net' ? summary?.net : summary?.gross);

/** What the expense's notes keep of the HR figures. */
export const payrollNotes = (summary, basis = 'gross') => [
    `${PAYROLL_NOTE_PREFIX} เดือน ${thaiMonthLabel(summary?.month)} (${basis === 'net' ? 'ยอดจ่ายจริง' : 'ยอดก่อนหัก'})`,
    `พนักงาน ${Number(summary?.headcount) || 0} คน`,
    `ค่าแรง ${fmt(summary?.wages)}`,
    `OT ${fmt(summary?.overtime)}`,
    `เบี้ยเลี้ยงและโบนัส ${fmt(summary?.allowances)}`,
    `รายการหัก ${fmt(summary?.deductions)}`,
    `ยอดก่อนหัก ${fmt(summary?.gross)}`,
    `ยอดจ่ายจริง ${fmt(summary?.net)}`
].join(' | ');

/**
 * The store_expenses row for a month, or { error } in the shop's words.
 * `amount` and `date` are what the owner confirmed on screen.
 */
export const buildPayrollExpense = ({ summary, basis = 'gross', amount, date, paymentMethod = 'TRANSFER' }) => {
    const month = summary?.month;
    if (!isMonth(month)) return { error: 'ยังไม่ได้ดึงยอดจาก HR' };
    const value = r2(String(amount ?? '').replace(/,/g, ''));
    if (!(value > 0)) return { error: 'จำนวนเงินต้องมากกว่า 0' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return { error: 'เลือกวันที่ลงรายการ' };
    if (String(date).slice(0, 7) !== month) return { error: `วันที่ต้องอยู่ในเดือน ${thaiMonthLabel(month)}` };
    return {
        row: {
            expense_date: date,
            title: `เงินเดือนพนักงาน เดือน ${thaiMonthLabel(month)}`,
            category: PAYROLL_CATEGORY,
            vendor_name: 'พนักงานร้าน',
            doc_type: 'receipt_voucher',
            amount: value,
            vat_included: false,
            vat_amount: 0,
            payment_method: paymentMethod,
            notes: payrollNotes(summary, basis)
        }
    };
};

/** Why HR gave no figures, in the shop's words. */
export const hrPayrollError = (code) => {
    const text = String(code || '');
    if (/FORBIDDEN/.test(text)) return 'ดึงยอดเงินเดือนได้เฉพาะบัญชีผู้ดูแลระบบ';
    if (/UNAUTHORIZED|401/.test(text)) return 'ไม่ได้เข้าสู่ระบบ หรือระบบ HR ไม่รับกุญแจเชื่อมต่อ';
    if (/HR_PAYROLL_KEY/.test(text)) return 'ยังไม่ได้ตั้งกุญแจเชื่อมต่อระบบ HR';
    if (/unreachable|timeout|abort/i.test(text)) return 'ติดต่อระบบ HR ไม่ได้ ลองอีกครั้ง';
    return text ? `ระบบ HR ตอบกลับ: ${text}` : 'ดึงยอดจาก HR ไม่สำเร็จ';
};

/** HR totals for a month through hr-labor-cost. Never throws: { ok, data } or { ok: false, message }. */
export async function fetchHrPayroll(ym) {
    if (!isMonth(ym)) return { ok: false, message: 'เลือกเดือนก่อน' };
    try {
        const { data, error } = await supabase.functions.invoke('hr-labor-cost', { body: { month: ym } });
        if (error) {
            // The function answers 401/403 as an error; its body carries the code
            let code = error.message;
            try { code = (await error.context?.json?.())?.error || code; } catch { /* keep the message */ }
            return { ok: false, message: hrPayrollError(code) };
        }
        if (!data?.ok || !data.data) return { ok: false, message: hrPayrollError(data?.error) };
        return { ok: true, data: data.data };
    } catch (err) {
        return { ok: false, message: hrPayrollError(err?.message) };
    }
}
