import { describe, it, expect } from 'vitest';
import { rankVariance, summarizeRanking, shopDayRange, buildStockCard, reasonLabel } from '../stockReports';
import { shopDayOf } from '../stockCount';

const row = (id, name, variance, value, extra = {}) => ({
    stock_item_id: id, name, unit: 'kg', closing_qty: 1, variance, variance_value: value,
    expected_close: 10, unit_cost: 100, ...extra
});

describe('shopDayRange', () => {
    it('lists the days ending at the given day, oldest first', () => {
        expect(shopDayRange('2026-11-14', 3)).toEqual(['2026-11-12', '2026-11-13', '2026-11-14']);
        expect(shopDayRange('2026-03-01', 2)).toEqual(['2026-02-28', '2026-03-01']);
    });
});

describe('rankVariance', () => {
    const days = [
        { day: '2026-11-12', rows: [row('pork', 'หมู', -2, -360), row('milk', 'นม', 0.1, 5), row('ice', 'น้ำแข็ง', null, null, { closing_qty: null })] },
        { day: '2026-11-13', rows: [row('pork', 'หมู', -1, -180), row('milk', 'นม', -3, -150)] },
        { day: '2026-11-14', rows: [row('pork', 'หมู', 0.5, 90)] }
    ];
    const ranked = rankVariance(days);

    it('adds up counted days only and puts the biggest loss first', () => {
        expect(ranked.map(r => r.stock_item_id)).toEqual(['pork', 'milk']);
        expect(ranked[0]).toMatchObject({ daysCounted: 3, abnormalDays: 2, variance: -2.5, value: -450, shortValue: -540, lastDay: '2026-11-14' });
        expect(ranked[1]).toMatchObject({ daysCounted: 2, abnormalDays: 1, variance: -2.9, value: -145, shortValue: -150 });
    });

    it('summarizes the ranking', () => {
        expect(summarizeRanking(ranked)).toEqual({ items: 2, withAbnormal: 2, shortValue: -690, netValue: -595 });
    });
});

describe('buildStockCard', () => {
    const tx = [
        { created_at: '2026-11-13T03:00:00Z', reason: 'purchase', quantity_change: 5, balance_after: 12, performed_by: 'ก้อง' },
        { created_at: '2026-11-13T15:00:00Z', reason: 'count_adjust', quantity_change: -1.5, balance_after: 10.5, performed_by: 'ปุ้ย', note: 'นับปิด' },
        { created_at: '2026-11-12T22:30:00Z', reason: 'waste', quantity_change: -0.5, balance_after: 7, performed_by: 'ก้อง' }
    ];
    const card = buildStockCard(tx, [{ shop_day: '2026-11-13', quantity: 2.25, order_lines: 9 }],
        [{ sold_at: '2026-11-13T12:00:00Z', quantity: 0.25 }], shopDayOf);

    it('groups by shop day, newest first, with computed usage at the end of the day', () => {
        expect(card.map(d => d.day)).toEqual(['2026-11-13']);
        const d = card[0];
        // 22:30 UTC on the 12th is 05:30 Bangkok on the 13th, so it belongs to the 13th
        expect(d.ledger.map(r => r.label)).toEqual(['ปรับตามนับ', 'รับเข้า', 'ของเสีย']);
        expect(d.netLedger).toBe(3);
        expect(d.computed).toEqual([
            { kind: 'sales', day: '2026-11-13', label: 'ใช้ตามยอดขาย (คำนวณจากสูตร)', change: -2.25, lines: 9 },
            { kind: 'removed_waste', day: '2026-11-13', label: 'ทำแล้วทิ้ง (จากบิล)', change: -0.25 }
        ]);
    });

    it('labels rows written before the ledger reasons existed', () => {
        expect(reasonLabel({ transaction_type: 'in' })).toBe('รับเข้า');
        expect(reasonLabel({ transaction_type: 'out' })).toBe('เบิกออก');
        expect(reasonLabel({ reason: 'staff_meal' })).toBe('พนักงานกิน');
        expect(reasonLabel({ reason: 'adjust', quantity_change: 1 })).toBe('ปรับเพิ่ม');
        expect(reasonLabel({ reason: 'adjust', quantity_change: -2 })).toBe('เบิกอื่น');
    });
});
