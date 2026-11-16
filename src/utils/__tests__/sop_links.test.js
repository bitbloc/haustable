import { describe, it, expect } from 'vitest';
import { sopLinkOf, mergeLinkedIngredients, ingredientsToStore, groupRecipeRows, rowsForSop, isSweetGroup, sweetnessLevelsByMenu, defaultSweetLevel, factorPercent } from '../sopLinks';

const rows = [
    { parent_menu_item_id: 67, quantity: 150, unit: 'ml', ingredient: { id: 'base', name: 'เบสชาไทย', usage_unit: 'ml' } },
    { parent_menu_item_id: 67, quantity: 20, unit: 'unit', ingredient: { id: 'syrup', name: 'น้ำเชื่อม', usage_unit: 'ml' } },
    { parent_stock_item_id: 'base', quantity: 12, unit: 'g', ingredient: { id: 'tea', name: 'ใบชา', usage_unit: 'g' } }
];

describe('sopLinkOf', () => {
    it('prefers the menu link', () => {
        expect(sopLinkOf({ source_menu_item_id: 67, source_stock_item_id: 'x' })).toEqual({ type: 'menu', id: 67 });
        expect(sopLinkOf({ source_stock_item_id: 'base' })).toEqual({ type: 'stock', id: 'base' });
        expect(sopLinkOf({})).toBeNull();
    });
});

describe('mergeLinkedIngredients', () => {
    it('takes quantities from the recipe and flags from the SOP, then manual lines', () => {
        const sop = [
            { id: 'syrup', name: 'น้ำเชื่อม', qty: 99, is_sweetener: true, isLinked: true },
            { name: 'น้ำแข็ง', qty: 1, unit: 'แก้ว', isLinked: false }
        ];
        expect(mergeLinkedIngredients(sop, rows.slice(0, 2))).toEqual([
            { id: 'base', name: 'เบสชาไทย', qty: 150, unit: 'ml', scalable: true, is_sweetener: false, isHidden: false, remark: '', isLinked: true },
            { id: 'syrup', name: 'น้ำเชื่อม', qty: 20, unit: 'ml', scalable: true, is_sweetener: true, isHidden: false, remark: '', isLinked: true },
            { name: 'น้ำแข็ง', qty: 1, unit: 'แก้ว', isLinked: false }
        ]);
    });

    it('matches old SOP lines by name when they had no id', () => {
        const merged = mergeLinkedIngredients([{ name: 'เบสชาไทย ', scalable: false }], rows.slice(0, 1));
        expect(merged[0].scalable).toBe(false);
    });
});

describe('ingredientsToStore', () => {
    it('stores flags only for linked lines', () => {
        expect(ingredientsToStore([
            { id: 'a', name: 'A', qty: 10, unit: 'ml', isLinked: true, is_sweetener: true },
            { name: 'B', qty: 1, unit: 'แก้ว' }
        ])).toEqual([
            { id: 'a', name: 'A', isLinked: true, scalable: true, is_sweetener: true, isHidden: false, remark: '' },
            { name: 'B', qty: 1, unit: 'แก้ว', isLinked: false }
        ]);
    });
});

describe('groupRecipeRows / rowsForSop', () => {
    it('finds the rows of the linked menu or base', () => {
        const g = groupRecipeRows(rows);
        expect(rowsForSop({ source_menu_item_id: 67 }, g)).toHaveLength(2);
        expect(rowsForSop({ source_stock_item_id: 'base' }, g)).toHaveLength(1);
        expect(rowsForSop({ source_menu_item_id: 1 }, g)).toEqual([]);
        expect(rowsForSop({}, g)).toBeNull();
    });
});

describe('sweetness has one home: the menu', () => {
    const groups = [
        { id: 'temp', name: 'ร้อน/เย็น', option_choices: [{ id: 'h', name: 'ร้อน', sweetener_factor: null }, { id: 'c', name: 'เย็น' }] },
        { id: 'sweet', name: 'ความหวาน', option_choices: [
            { id: 'x', name: 'หวานมาก', sweetener_factor: 1.2, display_order: 3 },
            { id: 'n', name: 'ไม่หวาน', sweetener_factor: 0, display_order: 0 },
            { id: 'p', name: 'ปกติ', sweetener_factor: 1, display_order: 2 },
            { id: 'l', name: 'หวานน้อย', sweetener_factor: '0.5', display_order: 1 }
        ] }
    ];

    it('finds the sweetness group by its factors, not its name', () => {
        expect(isSweetGroup(groups[0])).toBe(false);
        expect(isSweetGroup(groups[1])).toBe(true);
    });

    it('gives each menu the levels of its own sweetness group, in till order', () => {
        const map = sweetnessLevelsByMenu([
            { menu_item_id: 7, option_group_id: 'temp' },
            { menu_item_id: 7, option_group_id: 'sweet' },
            { menu_item_id: 9, option_group_id: 'temp' }
        ], groups);
        expect(map.get('7')).toEqual([
            { id: 'n', label: 'ไม่หวาน', factor: 0 },
            { id: 'l', label: 'หวานน้อย', factor: 0.5 },
            { id: 'p', label: 'ปกติ', factor: 1 },
            { id: 'x', label: 'หวานมาก', factor: 1.2 }
        ]);
        expect(map.has('9')).toBe(false); // no sweetness option: the bar shows no levels
    });

    it('makes a drink at the normal level unless asked', () => {
        expect(defaultSweetLevel([{ id: 'a', factor: 0 }, { id: 'b', factor: 1 }, { id: 'c', factor: 1.2 }]).id).toBe('b');
        expect(defaultSweetLevel([{ id: 'a', factor: 0.5 }, { id: 'c', factor: 1.2 }]).id).toBe('c');
        expect(defaultSweetLevel([])).toBeNull();
        expect(factorPercent(0.5)).toBe('50%');
    });

    it('a menu link takes the sweetener flag of the stock item; a base link keeps the SOP flag', () => {
        const sop = [{ id: 'syrup', name: 'ไซรัป', is_sweetener: false, isLinked: true }];
        const linked = [{ quantity: 20, unit: 'ml', ingredient: { id: 'syrup', name: 'ไซรัป', is_sweetener: true } }];
        expect(mergeLinkedIngredients(sop, linked, { stockSweetener: true })[0].is_sweetener).toBe(true);
        expect(mergeLinkedIngredients(sop, linked)[0].is_sweetener).toBe(false);
    });
});
