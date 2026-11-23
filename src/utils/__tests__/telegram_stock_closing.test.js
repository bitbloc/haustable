import { describe, it, expect } from 'vitest';
import {
    buildStockClosingMessage,
    buildStockClosingCardPayload,
    isAbnormal,
    needsReorder,
    thaiDay,
    amountText,
    plainAmountText,
} from '../../../supabase/functions/telegram-report/stockClosing.ts';
import {
    visualWidth,
    truncateVisual,
    formatAlignedItemsPre,
} from '../../../supabase/functions/telegram-report/textFormat.ts';
import {
    normalizeThaiForSvg,
    renderDailySummaryCardSvg,
    renderShiftCloseCardSvg,
    renderStockClosingCardSvg,
    renderOnlineOrderCardSvg,
} from '../../../supabase/functions/telegram-report/cardSvg.ts';

const row = (name, variance, value, extra = {}) => ({
    stock_item_id: name, name, unit: 'kg', expected_close: 10, closing_qty: 10 + variance,
    variance, variance_value: value, unit_cost: 100, ...extra
});

describe('stock closing message', () => {
    it('uses the same abnormal rule as the app', () => {
        expect(isAbnormal(row('a', -2, -200))).toBe(true);
        expect(isAbnormal(row('b', -0.5, -50))).toBe(false); // 5%, not over
        expect(isAbnormal(row('c', -2, -50))).toBe(false); // under ฿100
        expect(isAbnormal(row('d', -2, 0, { unit_cost: 0 }))).toBe(true); // unpriced: % only
        expect(isAbnormal(row('e', -2, -200, { closing_qty: null }))).toBe(false);
    });

    it('flags items at or below their reorder point or minimum', () => {
        expect(needsReorder({ name: 'x', current_quantity: 2, reorder_point: 3 })).toBe(true);
        expect(needsReorder({ name: 'x', current_quantity: 2, min_stock_threshold: 2 })).toBe(true);
        expect(needsReorder({ name: 'x', current_quantity: 5, reorder_point: 3 })).toBe(false);
        expect(needsReorder({ name: 'x', current_quantity: 0 })).toBe(false);
    });

    it('lists abnormal items worst first, then what to order', () => {
        const text = buildStockClosingMessage({
            day: '2026-11-14',
            session: { performed_by: 'ก้อง <night>' },
            round: 2,
            timeLabel: '23:40',
            rows: [row('หมู', -1.5, -255), row('นม', -3, -294, { unit: 'bottle' }), row('ไข่', 0.1, 1), row('เกลือ', -1, -1, { closing_qty: null })],
            reorder: [{ name: 'โซดา', unit: 'bottle', current_quantity: 4, reorder_point: 12 }, { name: 'น้ำแข็ง', current_quantity: 9, reorder_point: 3 }]
        });
        const lines = text.split('\n');
        expect(lines[0]).toBe('<b>นับปิดร้าน · ส. 14 พ.ย. · รอบ 2</b>');
        expect(lines[1]).toBe('ก้อง &lt;night&gt; · 23:40 · นับ 3 รายการ');
        expect(lines[2]).toBe('<b>ผิดปกติ 2 รายการ · ขาด ฿549.00</b>');
        expect(text).toContain('นม  −3 ขวด  <code>−฿294.00</code>\nหมู  −1.5 กก.  <code>−฿255.00</code>');
        expect(text).toContain('<b>ต้องสั่ง 1 รายการ</b>');
        expect(text).toContain('โซดา  เหลือ 4 ขวด / สั่งที่ 12 ขวด');
        expect(text).not.toContain('น้ำแข็ง');
    });

    it('says so when nothing is off', () => {
        const text = buildStockClosingMessage({ day: '2026-11-15', session: {}, round: 1, timeLabel: '', rows: [row('ไข่', 0, 0)], reorder: [] });
        expect(text.split('\n').slice(0, 3)).toEqual(['<b>นับปิดร้าน · อา. 15 พ.ย.</b>', 'Staff · นับ 1 รายการ', 'ไม่มีรายการผิดปกติ']);
        expect(thaiDay('2026-11-13')).toBe('ศ. 13 พ.ย.');
    });
});

describe('amounts in crates and bottles', () => {
    it('never says 1.417 crates', () => {
        const singha = { unit: 'crate', pack_unit: 'crate', usage_unit: 'bottle', conversion_factor: 12 };
        expect(amountText(1.4167, singha)).toBe('17 ขวด');
        expect(amountText(-0.25, singha)).toBe('3 ขวด');
        expect(amountText(1.5, { unit: 'kg' })).toBe('1.5 กก.');
        expect(plainAmountText(1, { unit: 'portion' })).toBe('1 สูตร');
    });
});

describe('Telegram Brand v2 cards and aligned monospace tables', () => {
    it('computes Thai visual grapheme widths and aligns receipt columns', () => {
        expect(visualWidth('น้ำแข็ง')).toBe(5);
        expect(truncateVisual('สะตอผัดกุ้งจริตจัด', 10)).toBe('สะตอผัดกุ้งจ…');
        const pre = formatAlignedItemsPre([
            { qty: 2, name: 'ผัดไทยกุ้ง', options: 'ไม่ใส่ถั่ว', priceText: '฿240' },
            { qty: 1, name: 'อเมริกาโน่', priceText: '฿85', voided: true },
        ], true, 28);
        const lines = pre.split('\n');
        expect(visualWidth(lines[0])).toBe(28);
        expect(lines[0].endsWith('฿240')).toBe(true);
        expect(lines[1]).toBe('   ไม่ใส่ถั่ว');
        expect(lines[2]).toContain('<s>');
        expect(lines[2]).toContain('ยกเลิก');
    });

    it('decomposes Thai Sara Am for resvg shaping and renders Brand v2 card SVGs', () => {
        expect(normalizeThaiForSvg('ชำระ น้ำ')).toBe('ช\u0E4D\u0E32ระ น\u0E4D\u0E49\u0E32');

        const stockPayload = buildStockClosingCardPayload({
            day: '2026-11-23',
            session: { performed_by: 'ปอนด์' },
            round: 1,
            timeLabel: '22:45',
            rows: [row('เบสชาไทย', -1, -132, { unit: 'portion' })],
            reorder: [{ name: 'นมสด', unit: 'bottle', current_quantity: 2, reorder_point: 5 }],
        });
        expect(stockPayload.card.abnormalRows[0].diffText).toBe('−1 สูตร');
        expect(stockPayload.caption).toContain('ผิดปกติ 1');

        const stockSvg = renderStockClosingCardSvg(stockPayload.card);
        expect(stockSvg).toContain('#41032A');
        expect(stockSvg).toContain('#F6F2EA');
        expect(stockSvg).toContain('STOCK CLOSING');
        expect(stockSvg).toContain('−1 สูตร');

        const shiftSvg = renderShiftCloseCardSvg({
            staffName: 'เมย์',
            timeRange: '10:00 – 22:00',
            totalSalesText: '฿12,400',
            cashSalesText: '฿3,000',
            qrSalesText: '฿9,400',
            openingFloatText: '฿2,000',
            expectedCashText: '฿5,000',
            closedCashText: '฿5,000',
            diff: 0,
            diffText: '฿0',
            stockCountText: 'นับสต๊อกปิดร้านแล้ว 48 รายการ',
            stockCounted: true,
        });
        expect(shiftSvg).toContain('SHIFT CLOSE');
        expect(shiftSvg).toContain('เงินสดตรงตามยอดระบบ');

        const dailySvg = renderDailySummaryCardSvg({
            title: 'สรุปยอด 23/11',
            revenueText: '฿24,850',
            paidCount: 42,
            avgPerBillText: '฿592',
            pax: 98,
            attention: [],
            byMethod: [{ label: 'QR / PromptPay', count: 30, amountText: '฿18,000' }],
            byChannel: [{ label: 'หน้าร้าน', count: 42, amountText: '฿24,850' }],
            topItems: [{ rank: 1, name: 'ผัดใบเหลียง', qty: 12, amountText: '฿1,668' }],
            floorMeta: 'เปิดโต๊ะ 35',
            periodText: '22/11 – 23/11',
        });
        expect(dailySvg).toContain('DAILY SUMMARY');
        expect(dailySvg).toContain('฿24,850');

        const orderSvg = renderOnlineOrderCardSvg({
            tag: 'TABLE BOOKING',
            bookingRef: '#8421',
            title: 'จองโต๊ะ ศ. 27 พ.ย. 19:00',
            infoRows: [{ label: 'ลูกค้า', value: 'คุณกานต์', bold: true }],
            items: [{ qty: 1, name: 'สะตอผัดกุ้ง', priceText: '฿190' }],
            totalLabel: 'ยอดรวมทั้งหมด',
            totalText: '฿190',
            timestampText: '23/11/2026 16:30',
        });
        expect(orderSvg).toContain('TABLE BOOKING');
        expect(orderSvg).toContain('#8421');
    });
});
