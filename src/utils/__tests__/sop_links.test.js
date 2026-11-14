import { describe, it, expect } from 'vitest';
import { sopLinkOf, mergeLinkedIngredients, ingredientsToStore, groupRecipeRows, rowsForSop } from '../sopLinks';

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
