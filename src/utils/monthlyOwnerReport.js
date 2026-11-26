// Numbers for the owner's monthly report (/admin/monthly-report).
//
// Reuses the definitions the rest of the back office already uses:
// - paid bill: status completed/paid/success, not an internal block, not a ghost
//   pickup, not the source bill of a merged table (AdminFinancialDashboard)
// - order items: void/cancelled lines are left out (overviewMetricsHelper)
// - payment split: getBookingPaymentBreakdown (shiftHelper)
// - expenses: store_expenses by expense_date and category (expenseConstants)
// - stock loss: stock_daily_reconciliation per shop day, ranked by rankVariance
// All dates are Bangkok (UTC+7, no daylight saving).

import { supabase } from '../lib/supabaseClient';
import { isGhostPickupBooking, isInternalBlockBooking, parseTableTransferInfo } from './tableTransferHelper';
import { getBookingPaymentBreakdown } from './shiftHelper';
import { EXPENSE_CATEGORIES, getCleanCategoryLabel } from './expenseConstants';
import { rankVariance, summarizeRanking, summarizeWithdrawals } from './stockReports';
import { THRESHOLD_KEYS, thresholdsFromSettings } from './stockCount';

const PAID = new Set(['completed', 'paid', 'success']);
const BKK_OFFSET_MS = 7 * 3600 * 1000;
const WEEKDAYS_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

export const bangkokMonthNow = () => new Date(Date.now() + BKK_OFFSET_MS).toISOString().slice(0, 7);

export const stepMonth = (ym, delta) => {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    return d.toISOString().slice(0, 7);
};

const daysInMonth = (ym) => {
    const [y, m] = ym.split('-').map(Number);
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

const monthBounds = (ym) => ({
    startIso: `${ym}-01T00:00:00+07:00`,
    endIso: `${ym}-${String(daysInMonth(ym)).padStart(2, '0')}T23:59:59+07:00`,
    firstDay: `${ym}-01`,
    lastDay: `${ym}-${String(daysInMonth(ym)).padStart(2, '0')}`,
});

const bkkDate = (iso) => new Date(new Date(iso).getTime() + BKK_OFFSET_MS);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const isPaidBill = (b) =>
    PAID.has(String(b.status || '').toLowerCase()) &&
    !isInternalBlockBooking(b) &&
    !isGhostPickupBooking(b) &&
    !parseTableTransferInfo(b).isMergedSource;

const countableItems = (b) => (b.order_items || []).filter((it) => {
    const st = String(it.status || '').toLowerCase();
    return st !== 'void' && st !== 'cancelled'; // order_items has no is_reward column
});

const BOOKING_SELECT = `id, table_id, booking_time, total_amount, deposit_amount, discount_amount, xhaus_discount,
    status, pax, source, booking_type, order_type, payment_method, staff_remark, customer_note,
    order_items(id, quantity, price_at_time, cost_at_sale, status, custom_name, menu_items(name, fixed_cost))`;

async function fetchPaidBills(ym) {
    const { startIso, endIso } = monthBounds(ym);
    const rows = [];
    // Page through: a busy month can pass PostgREST's default row cap.
    for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('bookings').select(BOOKING_SELECT)
            .gte('booking_time', startIso).lte('booking_time', endIso)
            .order('booking_time', { ascending: true }).range(from, from + 999);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < 1000) break;
    }
    return rows.filter(isPaidBill);
}

function summarizeSales(bills, ym) {
    const days = daysInMonth(ym);
    const daily = Array.from({ length: days }, (_, i) => ({ day: i + 1, sales: 0, bills: 0, pax: 0 }));
    const weekday = WEEKDAYS_TH.map((label) => ({ label, sales: 0, days: new Set() }));
    const pay = { cash: 0, qr: 0, credit: 0, wallet: 0 };
    let net = 0, discount = 0, pax = 0, dineIn = 0, takeaway = 0, recordedCost = 0;
    const items = new Map();

    for (const b of bills) {
        const amt = Number.parseFloat(b.total_amount) || 0;
        const d = bkkDate(b.booking_time);
        const dayIdx = d.getUTCDate() - 1;
        const guests = Number.parseInt(b.pax || 1, 10) || 1;
        net += amt;
        discount += (Number.parseFloat(b.discount_amount) || 0) + (Number.parseFloat(b.xhaus_discount) || 0);
        pax += guests;
        if (daily[dayIdx]) { daily[dayIdx].sales += amt; daily[dayIdx].bills += 1; daily[dayIdx].pax += guests; }
        weekday[d.getUTCDay()].sales += amt;
        weekday[d.getUTCDay()].days.add(dayIdx);

        const type = `${b.booking_type || ''} ${b.order_type || ''}`.toLowerCase();
        if (type.includes('pickup') || type.includes('takeaway')) takeaway += amt; else dineIn += amt;

        const remark = String(b.staff_remark || '').toLowerCase();
        if (remark.includes('wallet') && !remark.includes('paid by cash') && !remark.includes('paid by qr')) {
            pay.wallet += amt;
        } else {
            const br = getBookingPaymentBreakdown(b);
            pay.cash += br.cash || 0; pay.qr += br.qr || 0; pay.credit += br.credit || 0;
        }

        for (const it of countableItems(b)) {
            const name = it.custom_name || it.menu_items?.name || 'ไม่ทราบชื่อ';
            const qty = Number(it.quantity) || 0;
            const revenue = (Number(it.price_at_time) || 0) * qty;
            const cost = (it.cost_at_sale ?? it.menu_items?.fixed_cost ?? 0) * qty;
            recordedCost += Number(cost) || 0;
            const e = items.get(name) || { name, units: 0, revenue: 0, cost: 0 };
            e.units += qty; e.revenue += revenue; e.cost += Number(cost) || 0;
            items.set(name, e);
        }
    }

    const openDays = daily.filter((d) => d.bills > 0).length;
    return {
        net: round2(net),
        gross: round2(net + discount),
        discount: round2(discount),
        bills: bills.length,
        pax,
        openDays,
        perHead: pax ? Math.round(net / pax) : 0,
        perBill: bills.length ? Math.round(net / bills.length) : 0,
        perOpenDay: openDays ? Math.round(net / openDays) : 0,
        dineIn: round2(dineIn),
        takeaway: round2(takeaway),
        payments: Object.fromEntries(Object.entries(pay).map(([k, v]) => [k, round2(v)])),
        recordedFoodCost: round2(recordedCost),
        daily: daily.map((d) => ({ ...d, sales: round2(d.sales) })),
        weekday: weekday.map((w) => ({ label: w.label, avg: w.days.size ? Math.round(w.sales / w.days.size) : 0, days: w.days.size })),
        topItems: [...items.values()]
            .map((e) => ({ ...e, revenue: round2(e.revenue), marginPct: e.revenue ? Math.round((1 - e.cost / e.revenue) * 100) : null }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10),
    };
}

async function fetchExpenses(ym) {
    const { firstDay, lastDay } = monthBounds(ym);
    const { data, error } = await supabase.from('store_expenses')
        .select('amount, category, doc_type, expense_date')
        .gte('expense_date', firstDay).lte('expense_date', lastDay);
    if (error) throw error;
    const byCat = new Map();
    let total = 0;
    for (const e of data || []) {
        const amt = Number.parseFloat(e.amount) || 0;
        total += amt;
        const key = e.category || 'other';
        byCat.set(key, (byCat.get(key) || 0) + amt);
    }
    const order = EXPENSE_CATEGORIES.map((c) => c.id);
    return {
        total: round2(total),
        count: (data || []).length,
        byCategory: [...byCat.entries()]
            .map(([id, amount]) => ({ id, label: getCleanCategoryLabel(id), amount: round2(amount) }))
            .sort((a, b) => b.amount - a.amount || order.indexOf(a.id) - order.indexOf(b.id)),
    };
}

/**
 * Stock loss for the month. stock_daily_reconciliation takes ~6 s per day on production,
 * so it is called only for shop days that had a closing or spot count (variance needs a
 * count anyway), three at a time. Loaded separately from the rest of the report.
 */
export async function fetchMonthlyStock(ym) {
    const { firstDay, lastDay } = monthBounds(ym);
    const [thRes, txRes, sessRes] = await Promise.all([
        supabase.from('app_settings').select('key, value').in('key', Object.values(THRESHOLD_KEYS)),
        supabase.from('stock_transactions')
            .select('stock_item_id, quantity_change, reason, transaction_type, stock_items(name, unit)')
            .lt('quantity_change', 0)
            .gte('created_at', `${ym}-01T05:00:00+07:00`)
            .lt('created_at', `${stepMonth(ym, 1)}-01T05:00:00+07:00`),
        supabase.from('stock_count_sessions').select('shop_day')
            .in('kind', ['closing', 'spot']).gte('shop_day', firstDay).lte('shop_day', lastDay),
    ]);
    const countDays = [...new Set((sessRes.data || []).map((r) => r.shop_day))].sort();
    const dayResults = [];
    for (let i = 0; i < countDays.length; i += 3) {
        const chunk = await Promise.all(countDays.slice(i, i + 3).map((day) =>
            supabase.rpc('stock_daily_reconciliation', { p_day: day })
                .then(({ data, error }) => (error ? { day, rows: [] } : { day, rows: data || [] }))));
        dayResults.push(...chunk);
    }
    const ranked = rankVariance(dayResults, thresholdsFromSettings(thRes.data || []));
    const summary = summarizeRanking(ranked);
    const withdrawals = summarizeWithdrawals(txRes.data || []);
    return {
        countDays: countDays.length,
        countedItems: summary.items,
        shortValue: summary.shortValue,
        netValue: summary.netValue,
        worst: ranked.filter((r) => r.shortValue < 0).slice(0, 30)
            .map((r) => ({ name: r.name, unit: r.unit, variance: r.variance, shortValue: r.shortValue, abnormalDays: r.abnormalDays, daysCounted: r.daysCounted })),
        topWaste: withdrawals.filter((w) => w.waste > 0).slice(0, 5)
            .map((w) => ({ name: w.name, unit: w.unit, waste: w.waste })),
    };
}

/**
 * Split stock loss into believable items and suspect ones. A single item that "lost" more than
 * half the month's raw-material purchases (or 10% of sales when none were recorded) almost always
 * means a wrong unit or unit cost on the item, not real loss; it is shown apart and left out of the
 * total so it does not mislead the owner or the AI.
 */
export function splitStockLoss(stock, report) {
    if (!stock) return null;
    const rawMaterial = report?.expenses?.byCategory?.find((c) => c.id === 'raw_material')?.amount || 0;
    const limit = Math.max(5000, rawMaterial ? rawMaterial * 0.5 : (report?.sales?.net || 0) * 0.1);
    const suspect = stock.worst.filter((w) => Math.abs(w.shortValue) > limit);
    const believable = stock.worst.filter((w) => Math.abs(w.shortValue) <= limit);
    const suspectValue = suspect.reduce((sum, w) => sum + w.shortValue, 0);
    return {
        ...stock,
        limit: round2(limit),
        shortValue: round2(stock.shortValue - suspectValue),
        worst: believable.slice(0, 8),
        suspect: suspect.map((w) => ({ name: w.name, shortValue: w.shortValue })),
    };
}

/** Everything the page and the AI prompt need for one month. */
export async function buildMonthlyOwnerReport(ym) {
    const prevYm = stepMonth(ym, -1);
    const [bills, prevBills, expenses] = await Promise.all([
        fetchPaidBills(ym), fetchPaidBills(prevYm), fetchExpenses(ym),
    ]);
    const sales = summarizeSales(bills, ym);
    const prev = summarizeSales(prevBills, prevYm);
    const rawMaterial = expenses.byCategory.find((c) => c.id === 'raw_material')?.amount || 0;
    const wages = expenses.byCategory.find((c) => c.id === 'staff_wages')?.amount || 0;
    const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
    const today = new Date(Date.now() + BKK_OFFSET_MS).toISOString().slice(0, 10);
    const partialDays = today.startsWith(ym) ? Number(today.slice(8, 10)) : null;
    return {
        month: ym,
        prevMonth: prevYm,
        // Current month: compare with care, the previous month is complete.
        partial: partialDays ? { daysSoFar: partialDays, daysInMonth: daysInMonth(ym) } : null,
        sales,
        prev: { net: prev.net, bills: prev.bills, pax: prev.pax, perHead: prev.perHead },
        change: {
            netPct: prev.net ? Math.round(((sales.net - prev.net) / prev.net) * 1000) / 10 : null,
            billsPct: prev.bills ? Math.round(((sales.bills - prev.bills) / prev.bills) * 1000) / 10 : null,
        },
        expenses,
        ratios: {
            rawMaterialPct: pct(rawMaterial, sales.net),
            wagesPct: pct(wages, sales.net),
            expensesPct: pct(expenses.total, sales.net),
            recordedFoodCostPct: pct(sales.recordedFoodCost, sales.net),
        },
        result: round2(sales.net - expenses.total),
        stock: null, // filled by fetchMonthlyStock
        notes: [
            ...(partialDays ? [`เดือนนี้ยังไม่จบ (ข้อมูล ${partialDays} จาก ${daysInMonth(ym)} วัน) การเทียบกับเดือนก่อนซึ่งครบเดือนจึงดูต่ำกว่าความจริง`] : []),
            'ค่าแรงในรายงานนี้มาจากค่าใช้จ่ายหมวดเงินเดือนที่บันทึกในหลังบ้านเท่านั้น ยังไม่ได้ดึงจากระบบ HR',
            'ร้านไม่ได้จดทะเบียน VAT: ยอดทั้งหมดเป็นยอดรวม ไม่แยกภาษี',
        ],
    };
}

/** Thai prompt for the AI write-up; numbers only, no customer or staff names. */
export function buildReportPrompt(report) {
    return `คุณคือที่ปรึกษาการเงินและการดำเนินงานของร้านอาหาร "ในบ้าน (In The Haus)" ริมโขง นครพนม (45 ที่นั่ง ร้านไม่ได้จดทะเบียน VAT)
เขียนรายงานถึงเจ้าของร้านสำหรับเดือน ${report.month} จากข้อมูลจริงด้านล่าง (JSON) เท่านั้น ห้ามเดาตัวเลขที่ไม่มีในข้อมูล

ข้อมูล:
${JSON.stringify(report)}

รูปแบบคำตอบ (ภาษาไทย อ่านง่าย ไม่ใช้ markdown ตัวหนา ไม่ใช้อีโมจิ):
1. สรุปเดือนนี้ใน 3 บรรทัด: ยอดขายสุทธิ เทียบเดือนก่อน และผลต่างยอดขายกับค่าใช้จ่ายที่บันทึก
2. ยอดขาย: วันไหนในสัปดาห์ขายดี/เงียบ ค่าเฉลี่ยต่อหัวและต่อบิล สัดส่วนทานที่ร้านกับซื้อกลับ เมนูที่ทำเงินและเมนูที่กำไรต่ำ
3. ต้นทุน: สัดส่วนวัตถุดิบและค่าแรงต่อยอดขาย หมวดค่าใช้จ่ายที่สูงผิดปกติ (ถ้ามี)
4. สต็อก: ของที่หายเกินจากที่ควรใช้ (มูลค่าบาท) และของเสียที่ทิ้ง ถ้าไม่มีการนับ ให้บอกตรงๆ รายการใน stock.suspect คือตัวเลขที่น่าจะเกิดจากหน่วยหรือต้นทุนต่อหน่วยตั้งผิด ไม่ใช่ของหายจริง ให้แนะนำให้ตรวจการตั้งค่า อย่านับเป็นความเสียหาย
5. สิ่งที่ควรทำเดือนหน้า 3 ข้อ เรียงจากคุ้มที่สุด แต่ละข้อบอกตัวเลขที่ใช้ตัดสินใจ

ข้อจำกัด: ถ้าข้อมูลส่วนใดเป็นศูนย์หรือไม่มี ให้ระบุว่ายังไม่มีข้อมูล อย่าตีความเกินข้อมูล ความยาวรวมไม่เกิน 450 คำ`;
}
