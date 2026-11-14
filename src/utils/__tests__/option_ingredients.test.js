import { describe, it, expect } from 'vitest';
import { signedQuantity, validateChoiceIngredients, planChoiceIngredientSave, summarizeChoiceIngredients } from '../optionIngredients';

describe('signedQuantity', () => {
    it('applies the sign and rounds to 4 decimals', () => {
        expect(signedQuantity('plus', '30')).toBe(30);
        expect(signedQuantity('minus', '150')).toBe(-150);
        expect(signedQuantity('plus', '0.123456')).toBe(0.1235);
        expect(signedQuantity('minus', '-5')).toBe(-5);
        expect(Number.isNaN(signedQuantity('plus', ''))).toBe(true);
        expect(Number.isNaN(signedQuantity('plus', 'abc'))).toBe(true);
    });
});

describe('validateChoiceIngredients', () => {
    it('flags missing items, zero amounts and duplicates in the same scope', () => {
        const { rows, errors } = validateChoiceIngredients([
            { key: 'a', stock_item_id: 'shot', sign: 'plus', amount: '1', menu_item_id: null },
            { key: 'b', stock_item_id: '', sign: 'plus', amount: '1' },
            { key: 'c', stock_item_id: 'milk', sign: 'minus', amount: '0' },
            { key: 'd', stock_item_id: 'shot', sign: 'plus', amount: '2', menu_item_id: null },
            { key: 'e', stock_item_id: 'shot', sign: 'plus', amount: '2', menu_item_id: 12 }
        ]);
        expect(Object.keys(errors).sort()).toEqual(['b', 'c', 'd']);
        expect(rows).toEqual([
            { id: null, stock_item_id: 'shot', menu_item_id: null, quantity: 1 },
            { id: null, stock_item_id: 'shot', menu_item_id: 12, quantity: 2 }
        ]);
    });
});

describe('planChoiceIngredientSave', () => {
    const existing = [
        { id: 'r1', stock_item_id: 'oat', menu_item_id: null, quantity: 150 },
        { id: 'r2', stock_item_id: 'milk', menu_item_id: null, quantity: -150 },
        { id: 'r3', stock_item_id: 'shot', menu_item_id: null, quantity: 1 }
    ];

    it('deletes removed rows, updates changed rows and inserts new ones', () => {
        const plan = planChoiceIngredientSave('c1', existing, [
            { id: 'r1', stock_item_id: 'oat', menu_item_id: null, quantity: 150 },
            { id: 'r2', stock_item_id: 'milk', menu_item_id: null, quantity: -180 },
            { id: null, stock_item_id: 'syrup', menu_item_id: 7, quantity: 10 }
        ]);
        expect(plan.deletes).toEqual(['r3']);
        expect(plan.updates).toEqual([{ id: 'r2', choice_id: 'c1', stock_item_id: 'milk', menu_item_id: null, quantity: -180 }]);
        expect(plan.inserts).toEqual([{ choice_id: 'c1', stock_item_id: 'syrup', menu_item_id: 7, quantity: 10 }]);
    });

    it('sends nothing when nothing changed', () => {
        const plan = planChoiceIngredientSave('c1', existing, existing.map(e => ({ ...e })));
        expect(plan).toEqual({ deletes: [], updates: [], inserts: [] });
    });
});

describe('summarizeChoiceIngredients', () => {
    const items = new Map([['shot', { name: 'ช็อตเอสเปรสโซ', usage_unit: 'shot' }]]);
    it('describes one row and counts several', () => {
        expect(summarizeChoiceIngredients([], items)).toBe('');
        expect(summarizeChoiceIngredients([{ stock_item_id: 'shot', quantity: 1 }], items)).toBe('+1 shot ช็อตเอสเปรสโซ');
        expect(summarizeChoiceIngredients([{ stock_item_id: 'shot', quantity: -2 }], items)).toBe('−2 shot ช็อตเอสเปรสโซ');
        expect(summarizeChoiceIngredients([{ stock_item_id: 'a', quantity: 1 }, { stock_item_id: 'b', quantity: 1 }], items)).toBe('2 วัตถุดิบ');
    });
});
