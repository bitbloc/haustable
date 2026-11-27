import { describe, it, expect } from 'vitest';
import {
    componentsBySet,
    fixedChoicesCost,
    recipeRowsCost,
    rulesForChoice,
    setComponentsCost,
    setSaveError,
    stepServings,
    validateSetComponents
} from '../setComponents';

// Unit costs per usage unit (dummy figures)
const COST = { rice: 0.01, pork: 0.2, box: 5, bamboo: 0.1, shoot: 0.3 };
const unitCostOf = (id) => COST[id] ?? 0;

const recipeRowsByMenu = {
    // dish 1: 200 g rice + 100 g pork, a box when taken away
    1: [
        { ingredient_id: 'rice', quantity: 200, order_scope: 'all' },
        { ingredient_id: 'pork', quantity: 100, order_scope: 'all' },
        { ingredient_id: 'box', quantity: 1, order_scope: 'takeaway' }
    ],
    // dish 2: a jar of rice
    2: [{ ingredient_id: 'rice', quantity: 700, order_scope: 'all' }]
};

describe('recipeRowsCost', () => {
    it('keeps takeaway-only packaging apart', () => {
        const { cost, takeawayExtraCost } = recipeRowsCost(recipeRowsByMenu[1], unitCostOf);
        expect(cost).toBeCloseTo(22, 5);
        expect(takeawayExtraCost).toBeCloseTo(5, 5);
    });

    it('is zero for no rows', () => {
        expect(recipeRowsCost([], unitCostOf)).toEqual({ cost: 0, takeawayExtraCost: 0 });
    });
});

describe('rulesForChoice', () => {
    const rules = [
        { choice_id: 'c1', menu_item_id: null, stock_item_id: 'bamboo', quantity: 100 },
        { choice_id: 'c1', menu_item_id: 3, stock_item_id: 'shoot', quantity: 50 },
        { choice_id: 'c2', menu_item_id: null, stock_item_id: 'pork', quantity: 10 }
    ];

    it('prefers the rows written for the menu', () => {
        expect(rulesForChoice('c1', 3, rules).map(r => r.stock_item_id)).toEqual(['shoot']);
    });

    it('falls back to the every-menu rows', () => {
        expect(rulesForChoice('c1', 9, rules).map(r => r.stock_item_id)).toEqual(['bamboo']);
    });

    it('costs fixed choices from their stock rules', () => {
        expect(fixedChoicesCost(['c1', 'c2'], 9, rules, unitCostOf)).toBeCloseTo(10 + 2, 5);
        expect(fixedChoicesCost(['c1'], 3, rules, unitCostOf)).toBeCloseTo(15, 5);
    });
});

describe('setComponentsCost', () => {
    it('adds each component by its servings', () => {
        const components = [
            { component_menu_item_id: 1, quantity: 1, choice_ids: [] },
            { component_menu_item_id: 2, quantity: 2, choice_ids: [] }
        ];
        const res = setComponentsCost(components, { recipeRowsByMenu, unitCostOf });
        expect(res.cost).toBeCloseTo(22 + 2 * 7, 5);
        expect(res.takeawayExtraCost).toBeCloseTo(5, 5);
        expect(res.lines).toEqual([
            { menuId: 1, quantity: 1, unitCost: 22, total: 22, hasRecipe: true },
            { menuId: 2, quantity: 2, unitCost: 7, total: 14, hasRecipe: true }
        ]);
    });

    it('adds the choices a set fixes on a component', () => {
        const ruleRows = [{ choice_id: 'c1', menu_item_id: null, stock_item_id: 'bamboo', quantity: 100 }];
        const res = setComponentsCost(
            [{ component_menu_item_id: 1, quantity: 1, choice_ids: ['c1'] }],
            { recipeRowsByMenu, ruleRows, unitCostOf });
        expect(res.cost).toBeCloseTo(32, 5);
    });

    it('marks a component that has no recipe yet', () => {
        const res = setComponentsCost([{ component_menu_item_id: 7, quantity: 1 }], { recipeRowsByMenu, unitCostOf });
        expect(res.cost).toBe(0);
        expect(res.lines[0].hasRecipe).toBe(false);
    });

    it('is empty for a menu that is not a set', () => {
        expect(setComponentsCost([], { recipeRowsByMenu, unitCostOf })).toEqual({ lines: [], cost: 0, takeawayExtraCost: 0 });
    });
});

describe('componentsBySet', () => {
    it('groups by set and keeps the menu order', () => {
        const map = componentsBySet([
            { set_menu_item_id: 10, component_menu_item_id: 2, sort_order: 1 },
            { set_menu_item_id: 11, component_menu_item_id: 1, sort_order: 0 },
            { set_menu_item_id: 10, component_menu_item_id: 1, sort_order: 0 }
        ]);
        expect(map['10'].map(r => r.component_menu_item_id)).toEqual([1, 2]);
        expect(map['11']).toHaveLength(1);
    });
});

describe('validateSetComponents', () => {
    it('returns rows ready to save', () => {
        const { rows, errors } = validateSetComponents([
            { key: 'a', menuId: 1, amount: '1', choiceIds: [] },
            { key: 'b', menuId: '2', amount: '2', choiceIds: ['c1', 'c1'] }
        ], 10);
        expect(errors).toEqual({});
        expect(rows).toEqual([
            { component_menu_item_id: 1, quantity: 1, choice_ids: [] },
            { component_menu_item_id: 2, quantity: 2, choice_ids: ['c1'] }
        ]);
    });

    it('accepts half a serving, also typed with a comma', () => {
        const { rows } = validateSetComponents([{ key: 'a', menuId: 1, amount: '0,5' }], 10);
        expect(rows[0].quantity).toBe(0.5);
    });

    it('refuses an empty or zero amount, a repeat, and the set itself', () => {
        const { rows, errors } = validateSetComponents([
            { key: 'a', menuId: 1, amount: '' },
            { key: 'b', menuId: 2, amount: '0' },
            { key: 'c', menuId: 3, amount: '1' },
            { key: 'd', menuId: 3, amount: '1' },
            { key: 'e', menuId: 10, amount: '1' }
        ], 10);
        expect(rows.map(r => r.component_menu_item_id)).toEqual([3]);
        expect(Object.keys(errors).sort()).toEqual(['a', 'b', 'd', 'e']);
    });
});

describe('stepServings', () => {
    it('steps by one and stops at zero', () => {
        expect(stepServings('', 1)).toBe('1');
        expect(stepServings('1', 1)).toBe('2');
        expect(stepServings('0.5', -1)).toBe('0');
    });
});

describe('setSaveError', () => {
    it('explains a set inside a set', () => {
        expect(setSaveError('SET_IN_SET: menu 141 is itself a set')).toContain('เซตซ้อนเซตไม่ได้');
        expect(setSaveError('SET_IN_SET: menu 9 is already part of a set')).toContain('เป็นส่วนประกอบของเซตอื่น');
    });

    it('passes other messages through', () => {
        expect(setSaveError('boom')).toBe('boom');
    });
});
