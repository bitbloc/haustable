import { describe, it, expect } from 'vitest';
import { planMoveRecipeToMenu } from '../recipeMove';

const recipeRows = [
    { ingredient_id: 'shot', quantity: 2, unit: 'shot', layer_order: 0 },
    { ingredient_id: 'water', quantity: 150, unit: 'ml', layer_order: 1 }
];

describe('planMoveRecipeToMenu', () => {
    it('copies the rows into an empty target menu', () => {
        const plan = planMoveRecipeToMenu({ recipeId: 'ame', recipeRows, menuRows: [], targetMenuId: 55 });
        expect(plan).toEqual({
            deletes: [],
            inserts: [
                { parent_menu_item_id: 55, ingredient_id: 'shot', quantity: 2, unit: 'shot', layer_order: 0 },
                { parent_menu_item_id: 55, ingredient_id: 'water', quantity: 150, unit: 'ml', layer_order: 1 }
            ],
            menus: ['55'],
            conflict: false
        });
    });

    it('expands menus that used the recipe item, scaled by their quantity', () => {
        const menuRows = [
            { id: 1, parent_menu_item_id: 57, ingredient_id: 'ame', quantity: 1, layer_order: 0 },
            { id: 2, parent_menu_item_id: 57, ingredient_id: 'yuzu', quantity: 20, layer_order: 1 },
            { id: 3, parent_menu_item_id: 58, ingredient_id: 'ame', quantity: 0.5, layer_order: 2 }
        ];
        const plan = planMoveRecipeToMenu({ recipeId: 'ame', recipeRows, menuRows, targetMenuId: 57 });
        expect(plan.deletes).toEqual([1, 3]);
        expect(plan.inserts.filter(r => r.parent_menu_item_id === 58)).toEqual([
            { parent_menu_item_id: 58, ingredient_id: 'shot', quantity: 1, unit: 'shot', layer_order: 2 },
            { parent_menu_item_id: 58, ingredient_id: 'water', quantity: 75, unit: 'ml', layer_order: 3 }
        ]);
        expect(plan.menus).toEqual(['57', '58']);
        expect(plan.conflict).toBe(false);
    });

    it('stops when the target already has its own recipe, unless told to replace it', () => {
        const menuRows = [{ id: 9, parent_menu_item_id: 55, ingredient_id: 'milk', quantity: 100 }];
        expect(planMoveRecipeToMenu({ recipeId: 'ame', recipeRows, menuRows, targetMenuId: 55 }).conflict).toBe(true);
        const replace = planMoveRecipeToMenu({ recipeId: 'ame', recipeRows, menuRows, targetMenuId: 55, replaceTarget: true });
        expect(replace.deletes).toEqual([9]);
        expect(replace.inserts).toHaveLength(2);
    });
});
