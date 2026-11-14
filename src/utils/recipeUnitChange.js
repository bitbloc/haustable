import { supabase } from '../lib/supabaseClient';
import { planUsageUnitChange } from './recipeUnits';

/**
 * An ingredient's usage unit was changed from oldUnit to newUnit. Recipes store
 * quantities in the usage unit, so 50 (g) would silently become 50 (kg).
 * Convert the recipe rows that can be converted (g -> kg); label the rest with the
 * old unit so the unit check on Food & Drink lists them for a person.
 * Never throws. Returns { converted, manual, failed }.
 */
export const convertRecipesForUnitChange = async (itemId, oldUnit, newUnit) => {
    const from = String(oldUnit || '').trim().toLowerCase();
    const to = String(newUnit || '').trim().toLowerCase();
    if (!itemId || !from || !to || from === to) return { converted: 0, manual: 0, failed: false };
    try {
        const { data: rows, error } = await supabase
            .from('recipe_ingredients')
            .select('id, quantity, unit')
            .eq('ingredient_id', itemId);
        if (error) throw error;
        const { updates, manual } = planUsageUnitChange(rows || [], from, to);
        for (const u of updates) {
            const { error: upErr } = await supabase
                .from('recipe_ingredients')
                .update({ quantity: u.quantity, unit: u.unit })
                .eq('id', u.id);
            if (upErr) throw upErr;
        }
        return { converted: updates.length - manual, manual, failed: false };
    } catch (err) {
        console.error('[recipeUnitChange] failed', err);
        return { converted: 0, manual: 0, failed: true };
    }
};

/** One line for a toast, or '' when nothing used the item. */
export const describeUnitChange = (res, oldUnit, newUnit) => {
    if (res.failed) return `เปลี่ยนหน่วยแล้ว แต่ปรับสูตรที่ใช้วัตถุดิบนี้ไม่สำเร็จ ตรวจที่ Food & Drink → เมนู`;
    if (!res.converted && !res.manual) return '';
    const parts = [];
    if (res.converted) parts.push(`แปลงปริมาณในสูตร ${res.converted} แถวจาก ${oldUnit} เป็น ${newUnit}`);
    if (res.manual) parts.push(`${res.manual} แถวแปลงเองไม่ได้ ดูที่แผงตรวจหน่วยใน Food & Drink`);
    return parts.join(' · ');
};
