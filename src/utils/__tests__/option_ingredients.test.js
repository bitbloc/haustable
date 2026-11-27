import { describe, it, expect } from 'vitest';
import {
    parseOptionAmountInput,
    planChoiceIngredientSave,
    signedQuantity,
    stepOptionAmount,
    summarizeChoiceIngredients,
    validateChoiceIngredients
} from '../optionIngredients';

describe('signedQuantity', () => {
    it('applies the sign and rounds to 4 decimals', () => {
        expect(signedQuantity('plus', '30')).toBe(30);
        expect(signedQuantity('minus', '150')).toBe(-150);
        expect(signedQuantity('plus', '0.123456')).toBe(0.1235);
        expect(signedQuantity('minus', '-5')).toBe(-5);
        expect(signedQuantity('plus', '0,5')).toBe(0.5);
        expect(signedQuantity('minus', '2,5')).toBe(-2.5);
        expect(signedQuantity('plus', '1,000')).toBe(1000);
        expect(signedQuantity('plus', '1,500.25')).toBe(1500.25);
        expect(signedQuantity('minus', '−5')).toBe(-5);
        expect(Number.isNaN(signedQuantity('plus', ''))).toBe(true);
        expect(Number.isNaN(signedQuantity('plus', 'abc'))).toBe(true);
    });
});

describe('parseOptionAmountInput', () => {
    it('switches sign on leading - or + and keeps partial decimals', () => {
        expect(parseOptionAmountInput('-5', 'plus')).toEqual({ sign: 'minus', amount: '5' });
        expect(parseOptionAmountInput('−2.5', 'plus')).toEqual({ sign: 'minus', amount: '2.5' });
        expect(parseOptionAmountInput('+3', 'minus')).toEqual({ sign: 'plus', amount: '3' });
        expect(parseOptionAmountInput('-', 'plus')).toEqual({ sign: 'minus', amount: '' });
        expect(parseOptionAmountInput('0.', 'plus')).toEqual({ sign: 'plus', amount: '0.' });
        expect(parseOptionAmountInput('.5', 'minus')).toEqual({ sign: 'minus', amount: '.5' });
        expect(parseOptionAmountInput('1,5', 'plus')).toEqual({ sign: 'plus', amount: '1,5' });
        expect(parseOptionAmountInput('12a.5', 'plus')).toEqual({ sign: 'plus', amount: '12.5' });
    });
});

describe('stepOptionAmount', () => {
    it('increments and decrements from empty, whole and decimal values without going below zero', () => {
        expect(stepOptionAmount('', 1)).toBe('1');
        expect(stepOptionAmount('', -1)).toBe('0');
        expect(stepOptionAmount('1', 1)).toBe('2');
        expect(stepOptionAmount('2', -1)).toBe('1');
        expect(stepOptionAmount('0.5', 1)).toBe('1.5');
        expect(stepOptionAmount('1.5', -1)).toBe('0.5');
        expect(stepOptionAmount('0.5', -1)).toBe('0');
        expect(stepOptionAmount('0,5', 1)).toBe('1.5');
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
    const menus = new Map([[67, { id: 67, name: 'ชาไทย (ร้อน,เย็น)' }]]);
    it('describes one row and counts several', () => {
        expect(summarizeChoiceIngredients([], items)).toBe('');
        expect(summarizeChoiceIngredients([{ stock_item_id: 'shot', quantity: 1 }], items)).toBe('+1 shot ช็อตเอสเปรสโซ');
        expect(summarizeChoiceIngredients([{ stock_item_id: 'shot', quantity: -2 }], items)).toBe('−2 shot ช็อตเอสเปรสโซ');
        expect(summarizeChoiceIngredients([{ stock_item_id: 'a', quantity: 1 }, { stock_item_id: 'b', quantity: 1 }], items)).toBe('2 วัตถุดิบ');
        expect(summarizeChoiceIngredients([{ linked_menu_item_id: 67, quantity: 1 }], items, menus)).toBe('+1 ที่ สูตรเมนู: ชาไทย (ร้อน,เย็น)');
    });

    it('validates and plans linked_menu_item_id rows', () => {
        const { rows, errors } = validateChoiceIngredients([
            { key: 'm1', stock_item_id: '', linked_menu_item_id: 67, sign: 'plus', amount: '1', menu_item_id: null },
            { key: 'm2', stock_item_id: '', linked_menu_item_id: 67, sign: 'plus', amount: '1', menu_item_id: null }
        ]);
        expect(Object.keys(errors)).toEqual(['m2']);
        expect(rows).toEqual([
            { id: null, stock_item_id: null, linked_menu_item_id: 67, menu_item_id: null, quantity: 1 }
        ]);
        const plan = planChoiceIngredientSave('c1', [], rows);
        expect(plan.inserts).toEqual([
            { choice_id: 'c1', stock_item_id: null, linked_menu_item_id: 67, menu_item_id: null, quantity: 1 }
        ]);
    });
});

describe('fixed choices of a linked menu', () => {
    it('keeps them on a linked-menu row and not on a stock row', () => {
        const { rows, errors } = validateChoiceIngredients([
            { key: 'a', linked_menu_item_id: 55, linked_choice_ids: ['iced', 'bean', 'iced'], menu_item_id: null, sign: 'plus', amount: '1' },
            { key: 'b', stock_item_id: 's1', linked_choice_ids: [], menu_item_id: null, sign: 'plus', amount: '2' }
        ]);
        expect(errors).toEqual({});
        expect(rows[0].linked_choice_ids).toEqual(['iced', 'bean']);
        expect(rows[1]).not.toHaveProperty('linked_choice_ids');
    });

    it('updates a row when only its fixed choices changed', () => {
        const existing = [{ id: 'r1', choice_id: 'c', stock_item_id: null, linked_menu_item_id: 55, menu_item_id: null, quantity: 1, linked_choice_ids: ['iced'] }];
        const same = planChoiceIngredientSave('c', existing, [
            { id: 'r1', stock_item_id: null, linked_menu_item_id: 55, menu_item_id: null, quantity: 1, linked_choice_ids: ['iced'] }
        ]);
        expect(same.updates).toHaveLength(0);

        const changed = planChoiceIngredientSave('c', existing, [
            { id: 'r1', stock_item_id: null, linked_menu_item_id: 55, menu_item_id: null, quantity: 1, linked_choice_ids: ['iced', 'bean'] }
        ]);
        expect(changed.updates).toHaveLength(1);
        expect(changed.updates[0].linked_choice_ids).toEqual(['iced', 'bean']);
    });

    it('leaves the column alone when the editor did not send it', () => {
        const existing = [{ id: 'r1', choice_id: 'c', stock_item_id: null, linked_menu_item_id: 55, menu_item_id: null, quantity: 1, linked_choice_ids: ['iced'] }];
        const plan = planChoiceIngredientSave('c', existing, [
            { id: 'r1', stock_item_id: null, linked_menu_item_id: 55, menu_item_id: null, quantity: 2 }
        ]);
        expect(plan.updates).toHaveLength(1);
        expect(plan.updates[0]).not.toHaveProperty('linked_choice_ids');
    });
});
