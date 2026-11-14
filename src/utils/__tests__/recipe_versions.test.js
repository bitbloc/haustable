import { describe, it, expect, vi } from 'vitest';
vi.mock('../../lib/supabaseClient', () => ({ supabase: {} }));
import { snapshotRows, diffRecipeRows, isSameRecipe } from '../recipeVersions';

describe('snapshotRows', () => {
    it('keeps id, name, rounded quantity, unit and order', () => {
        expect(snapshotRows([
            { ingredientId: 'shot', ingredient: { name: 'ช็อต', usage_unit: 'shot' }, quantity: 2, unit: 'shot' },
            { ingredientId: 'milk', ingredient: { name: 'นม', usage_unit: 'ml' }, quantity: 150.123456 }
        ])).toEqual([
            { ingredient_id: 'shot', name: 'ช็อต', quantity: 2, unit: 'shot', layer_order: 0 },
            { ingredient_id: 'milk', name: 'นม', quantity: 150.1235, unit: 'ml', layer_order: 1 }
        ]);
    });
});

describe('diffRecipeRows', () => {
    const v1 = [
        { ingredient_id: 'shot', name: 'ช็อต', quantity: 2, unit: 'shot' },
        { ingredient_id: 'milk', name: 'นม', quantity: 150, unit: 'ml' },
        { ingredient_id: 'syrup', name: 'ไซรัป', quantity: 10, unit: 'ml' }
    ];
    const v2 = [
        { ingredient_id: 'shot', name: 'ช็อต', quantity: 2, unit: 'shot' },
        { ingredient_id: 'milk', name: 'นม', quantity: 180, unit: 'ml' },
        { ingredient_id: 'ice', name: 'น้ำแข็ง', quantity: 1, unit: 'แก้ว' }
    ];

    it('lists added, removed and changed lines', () => {
        const d = diffRecipeRows(v1, v2);
        expect(d.added.map(r => r.name)).toEqual(['น้ำแข็ง']);
        expect(d.removed.map(r => r.name)).toEqual(['ไซรัป']);
        expect(d.changed).toEqual([{ name: 'นม', from: 150, to: 180, unit: 'ml', fromUnit: 'ml' }]);
    });

    it('treats a reordered but equal recipe as the same', () => {
        expect(isSameRecipe(v1, [...v1].reverse())).toBe(true);
        expect(isSameRecipe(v1, v2)).toBe(false);
    });
});
