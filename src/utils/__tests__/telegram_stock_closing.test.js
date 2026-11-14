import { describe, it, expect } from 'vitest';
import { buildStockClosingMessage, isAbnormal, needsReorder, thaiDay } from '../../../supabase/functions/telegram-report/stockClosing.ts';

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
        expect(text).toContain('โซดา  เหลือ 4 / สั่งที่ 12 ขวด');
        expect(text).not.toContain('น้ำแข็ง');
    });

    it('says so when nothing is off', () => {
        const text = buildStockClosingMessage({ day: '2026-11-15', session: {}, round: 1, timeLabel: '', rows: [row('ไข่', 0, 0)], reorder: [] });
        expect(text.split('\n').slice(0, 3)).toEqual(['<b>นับปิดร้าน · อา. 15 พ.ย.</b>', 'Staff · นับ 1 รายการ', 'ไม่มีรายการผิดปกติ']);
        expect(thaiDay('2026-11-13')).toBe('ศ. 13 พ.ย.');
    });
});
