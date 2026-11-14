import { describe, it, expect, beforeEach, vi } from 'vitest';

const calls = [];
let rows = [];
vi.mock('../../lib/supabaseClient', () => ({
    supabase: {
        from: () => ({
            select: () => ({ eq: async () => ({ data: rows, error: null }) }),
            update: (patch) => ({ eq: async (_col, id) => { calls.push({ id, ...patch }); return { error: null }; } })
        })
    }
}));

import { convertRecipesForUnitChange, describeUnitChange } from '../recipeUnitChange';

describe('convertRecipesForUnitChange', () => {
    beforeEach(() => { calls.length = 0; });

    it('converts rows that can be converted and labels the rest', async () => {
        rows = [{ id: 1, quantity: 50, unit: 'g' }, { id: 2, quantity: 2, unit: null }];
        const res = await convertRecipesForUnitChange('pork', 'g', 'kg');
        expect(res).toEqual({ converted: 2, manual: 0, failed: false });
        expect(calls).toEqual([{ id: 1, quantity: 0.05, unit: 'kg' }, { id: 2, quantity: 0.002, unit: 'kg' }]);
    });

    it('marks rows it cannot convert and does nothing when the unit is unchanged', async () => {
        rows = [{ id: 3, quantity: 1, unit: 'ml' }];
        expect(await convertRecipesForUnitChange('x', 'ml', 'unit')).toEqual({ converted: 0, manual: 1, failed: false });
        expect(calls).toEqual([{ id: 3, quantity: 1, unit: 'ml' }]);
        calls.length = 0;
        expect(await convertRecipesForUnitChange('x', 'g', 'g')).toEqual({ converted: 0, manual: 0, failed: false });
        expect(calls).toEqual([]);
    });
});

describe('describeUnitChange', () => {
    it('says what happened in one line', () => {
        expect(describeUnitChange({ converted: 0, manual: 0, failed: false }, 'g', 'kg')).toBe('');
        expect(describeUnitChange({ converted: 3, manual: 1, failed: false }, 'g', 'kg'))
            .toBe('แปลงปริมาณในสูตร 3 แถวจาก g เป็น kg · 1 แถวแปลงเองไม่ได้ ดูที่แผงตรวจหน่วยใน Food & Drink');
        expect(describeUnitChange({ failed: true }, 'g', 'kg')).toMatch(/ไม่สำเร็จ/);
    });
});
