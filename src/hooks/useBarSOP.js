import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import { logStaffActivity } from '../utils/auditLogger';
import { groupRecipeRows, rowsForSop, mergeLinkedIngredients, ingredientsToStore } from '../utils/sopLinks';

/**
 * useBarSOP — Data layer hook for Bar SOP system
 * Handles fetching, searching, scaling, saving SOP recipes
 */
export default function useBarSOP({ department = 'bar', staffMode = false } = {}) {
    const [recipes, setRecipes] = useState([]);
    const [categories, setCategories] = useState([]);
    const [glassSizes, setGlassSizes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const cacheRef = useRef({});
    const isInitRef = useRef(false);

    // ────────────────────────────────
    // Fetch Categories
    // ────────────────────────────────
    const fetchCategories = useCallback(async () => {
        // Check cache
        if (cacheRef.current.categories) {
            setCategories(cacheRef.current.categories);
            return cacheRef.current.categories;
        }

        const { data, error } = await supabase
            .from('sop_categories')
            .select('*')
            .eq('is_active', true)
            .in('department', [department, 'all'])
            .order('sort_order');

        if (error) {
            console.error('Failed to load SOP categories:', error);
            return [];
        }

        cacheRef.current.categories = data || [];
        setCategories(data || []);

        // Auto-select first category if none selected
        if (!activeCategory && data?.length > 0) {
            setActiveCategory(data[0].id);
        }

        return data || [];
    }, [department, activeCategory]);

    // ────────────────────────────────
    // Fetch Glass Sizes
    // ────────────────────────────────
    const fetchGlassSizes = useCallback(async () => {
        if (cacheRef.current.glassSizes) {
            setGlassSizes(cacheRef.current.glassSizes);
            return cacheRef.current.glassSizes;
        }

        const { data, error } = await supabase
            .from('sop_glass_sizes')
            .select('*')
            .order('sort_order');

        if (error) {
            console.error('Failed to load glass sizes:', error);
            return [];
        }

        // Deduplicate glass sizes by size_oz to prevent duplicate buttons in the UI
        const uniqueGlassSizes = [];
        const seenSizes = new Set();
        for (const gs of (data || [])) {
            if (!seenSizes.has(gs.size_oz)) {
                seenSizes.add(gs.size_oz);
                uniqueGlassSizes.push(gs);
            }
        }

        cacheRef.current.glassSizes = uniqueGlassSizes;
        setGlassSizes(uniqueGlassSizes);
        return uniqueGlassSizes;
    }, []);

    // ────────────────────────────────
    // Auto Synchronization between Recipe Lab & SOP Recipes
    // ────────────────────────────────
    // SOPs are no longer created, renamed or deleted from Recipe Lab items: the SOP is the
    // method, the menu / base recipe is the ingredient list (see utils/sopLinks.js).
    const syncCategoriesAndRecipes = useCallback(async () => ({}), []);

    // ────────────────────────────────
    // Fetch Recipes
    // ────────────────────────────────
    const fetchRecipes = useCallback(async (categoryId = null) => {
        setLoading(true);
        try {
            let query = supabase
                .from('sop_recipes')
                .select('*, category:sop_categories(id, label, icon)')
                .eq('department', department)
                .order('sort_order')
                .order('name');

            // Staff mode: only published
            if (staffMode) {
                query = query.eq('is_published', true);
            }

            // Category filter
            if (categoryId) {
                query = query.eq('category_id', categoryId);
            }

            // Fetch the SOP recipes
            const { data: sops, error } = await query;
            if (error) throw error;

            // Ingredients come from the linked menu or base recipe
            const menuIds = [...new Set(sops.map(r => r.source_menu_item_id).filter(Boolean))];
            const stockIds = [...new Set(sops.filter(r => !r.source_menu_item_id).map(r => r.source_stock_item_id).filter(Boolean))];
            const select = `parent_menu_item_id, parent_stock_item_id, quantity, unit, layer_order,
                        ingredient:stock_items!recipe_ingredients_ingredient_id_fkey ( id, name, usage_unit )`;
            const [menuRows, stockRows] = await Promise.all([
                menuIds.length ? supabase.from('recipe_ingredients').select(select).in('parent_menu_item_id', menuIds).order('layer_order') : { data: [] },
                stockIds.length ? supabase.from('recipe_ingredients').select(select).in('parent_stock_item_id', stockIds).order('layer_order') : { data: [] }
            ]);
            const grouped = groupRecipeRows([...(menuRows.data || []), ...(stockRows.data || [])]);

            const populatedData = sops.map(r => {
                const rows = rowsForSop(r, grouped);
                // Not linked: whatever was written stays as plain text lines (never dropped on save).
                const currentIngs = rows
                    ? mergeLinkedIngredients(r.ingredients || [], rows)
                    : (r.ingredients || []).map(i => ({ ...i, isLinked: false }));
                return {
                    ...r,
                    ingredients: currentIngs,
                    display_ingredients: currentIngs
                };
            });

            setRecipes(populatedData);

            // Cache for offline
            if (staffMode) {
                try {
                    localStorage.setItem(`sop_cache_${department}`, JSON.stringify({
                        data: populatedData,
                        timestamp: Date.now()
                    }));
                } catch { /* ignore storage errors */ }
            }

            return populatedData;
        } catch (err) {
            console.error('Failed to load SOP recipes:', err);

            // Try offline cache
            if (staffMode) {
                try {
                    const cached = JSON.parse(localStorage.getItem(`sop_cache_${department}`));
                    if (cached?.data) {
                        setRecipes(cached.data);
                        toast.info('แสดงข้อมูลจาก cache (offline)');
                        return cached.data;
                    }
                } catch { /* ignore */ }
            }

            toast.error('โหลดข้อมูล SOP ไม่สำเร็จ');
            return [];
        } finally {
            setLoading(false);
        }
    }, [department, staffMode]);

    // ────────────────────────────────
    // Scale Ingredients
    // ── Helper: Scale Ingredients with Sweetness Matrix ──
    const scaleIngredients = useCallback((recipe, targetSizeOrPreset, cups = 1, sweetnessLevel = '100%') => {
        if (!recipe) return [];
        const ingredients = recipe.display_ingredients || recipe.ingredients || [];
        const rules = recipe.scaling_rules || {};
        const isCustomMode = rules._mode === 'custom';
        
        // Get size multiplier
        let sizeMultiplier = 1;
        if (isCustomMode) {
            const presets = rules.presets || [];
            const preset = presets.find(p => p.name === targetSizeOrPreset);
            if (preset) {
                sizeMultiplier = parseFloat(preset.multiplier) || 1;
            }
        } else {
            const baseOz = parseFloat(recipe.base_glass_size_oz) || 16;
            const targetSizeOz = parseFloat(targetSizeOrPreset) || baseOz;
            
            if (rules[String(targetSizeOz)] !== undefined) {
                sizeMultiplier = parseFloat(rules[String(targetSizeOz)]);
            } else {
                sizeMultiplier = targetSizeOz / baseOz;
            }
        }

        // Sweetness Multiplier & Custom Matrix
        // Normalize sweetness key
        let sweetKey = 'normal';
        if (sweetnessLevel === '0%' || sweetnessLevel === 'none' || sweetnessLevel === 'ไม่หวาน') sweetKey = 'none';
        else if (sweetnessLevel === '25%' || sweetnessLevel === 'very_less' || sweetnessLevel === 'หวานน้อยมาก') sweetKey = 'very_less';
        else if (sweetnessLevel === '50%' || sweetnessLevel === 'less' || sweetnessLevel === 'หวานน้อย') sweetKey = 'less';
        else if (sweetnessLevel === '100%' || sweetnessLevel === 'normal' || sweetnessLevel === 'หวานปกติ') sweetKey = 'normal';
        else if (sweetnessLevel === '120%' || sweetnessLevel === 'extra' || sweetnessLevel === 'หวานมาก') sweetKey = 'extra';

        const customRules = recipe.advanced_details?.sweetness_rules || {};
        const customMatrix = recipe.advanced_details?.sweetness_matrix;
        
        let sweetnessMultiplier = 1.0;
        switch (sweetKey) {
            case 'none':
                sweetnessMultiplier = customRules.none !== undefined ? customRules.none : 0.0;
                break;
            case 'very_less':
                sweetnessMultiplier = customRules.very_less !== undefined ? customRules.very_less : 0.25;
                break;
            case 'less':
                sweetnessMultiplier = customRules.less !== undefined ? customRules.less : 0.5;
                break;
            case 'normal':
                sweetnessMultiplier = customRules.normal !== undefined ? customRules.normal : 1.0;
                break;
            case 'extra':
                sweetnessMultiplier = customRules.extra !== undefined ? customRules.extra : 1.2;
                break;
            default:
                sweetnessMultiplier = 1.0;
        }

        return ingredients.map(ing => {
            const unitLower = (ing.unit || '').toLowerCase();
            const isPieceItem = ['pcs', 'glass', 'cup', 'pack', 'กล่อง', 'ถุง', 'ขวด', 'แผ่น', 'หลอด', 'ชิ้น', 'อัน', 'ฝา'].includes(unitLower) || 
                                ing.unit === 'GLASS' || 
                                ing.unit === 'PCS';

            let finalMultiplier = isPieceItem ? cups : (sizeMultiplier * cups);
            
            // Check if ingredient is a sweetener
            const isSweet = ing.is_sweetener === true;
            let finalCalculatedQty = ing.qty;

            if (isSweet) {
                // Check if custom matrix has an exact override for this sweetener at this level
                if (customMatrix && customMatrix.levels && customMatrix.levels[ing.name] && customMatrix.levels[ing.name][sweetKey] !== undefined) {
                    const customExactVal = parseFloat(customMatrix.levels[ing.name][sweetKey]);
                    const baseVal = isNaN(customExactVal) ? (ing.qty * sweetnessMultiplier) : customExactVal;
                    finalCalculatedQty = Math.round((baseVal * (isCustomMode ? sizeMultiplier : 1) * cups) * 100) / 100;
                } else {
                    finalCalculatedQty = Math.round((ing.qty * (finalMultiplier * sweetnessMultiplier)) * 100) / 100;
                }
            } else {
                finalCalculatedQty = ing.scalable !== false
                    ? Math.round((ing.qty * finalMultiplier) * 100) / 100
                    : ing.qty;
            }

            let name = ing.name || '';
            if (isPieceItem && name.includes('แก้ว')) {
                name = name.replace(/\d+\s*(ออนซ์|oz)/i, `${targetSizeOrPreset} $1`);
            }

            return {
                ...ing,
                name,
                scaledQty: finalCalculatedQty,
                isScaled: (ing.scalable !== false && finalMultiplier !== 1),
                isSweetScaled: isSweet && (sweetKey !== 'normal' || sweetnessMultiplier !== 1.0)
            };
        });
    }, []);

    // ────────────────────────────────
    // Search / Filter
    // ────────────────────────────────
    const filteredRecipes = recipes.filter(r => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            r.name?.toLowerCase().includes(q) ||
            r.name_en?.toLowerCase().includes(q) ||
            r.garnish?.toLowerCase().includes(q)
        );
    });

    // ────────────────────────────────
    // Link to Recipe Lab (Fetch summary for preview)
    // ────────────────────────────────
    const fetchRecipeLabSummary = useCallback(async (sourceId, sourceType = 'stock') => {
        try {
            const queryField = sourceType === 'menu'
                ? 'parent_menu_item_id'
                : 'parent_stock_item_id';

            const { data: recipeData, error } = await supabase
                .from('recipe_ingredients')
                .select(`
                    quantity,
                    unit,
                    ingredient:stock_items!recipe_ingredients_ingredient_id_fkey (
                        id, name, usage_unit
                    )
                `)
                .eq(queryField, sourceId);

            if (error) throw error;
            
            return recipeData.map(r => ({
                id: r.ingredient?.id,
                name: r.ingredient?.name || 'Unknown',
                qty: r.quantity || 0,
                unit: r.unit || r.ingredient?.usage_unit || 'unit',
                scalable: true,
                isLinked: true,
                isHidden: false
            }));
        } catch (err) {
            console.error('Fetch linked failed:', err);
            return [];
        }
    }, []);

    // ────────────────────────────────
    // Save SOP Recipe
    // ────────────────────────────────
    const saveSOPRecipe = useCallback(async (recipe) => {
        try {
            // The SOP saves its own fields only. Ingredients live in the linked menu / base
            // recipe and are edited there; here we keep display flags and non-stock lines.
            const updatedIngredients = ingredientsToStore(recipe.ingredients || []);

            const payload = {
                name: recipe.name,
                name_en: recipe.name_en || null,
                category_id: recipe.category_id,
                department: recipe.department || department,
                base_glass_size_oz: recipe.base_glass_size_oz || 16,
                source_menu_item_id: recipe.source_menu_item_id || null,
                source_stock_item_id: recipe.source_menu_item_id ? null : (recipe.source_stock_item_id || null),
                ingredients: updatedIngredients,
                steps: recipe.steps || [],
                scaling_rules: recipe.scaling_rules || { "8": 0.5, "12": 0.75, "16": 1, "22": 1.375 },
                garnish: recipe.garnish || null,
                notes: recipe.notes || null,
                is_published: recipe.is_published ?? false,
                sort_order: recipe.sort_order || 0,
                advanced_details: recipe.advanced_details || {},
                updated_at: new Date().toISOString()
            };

            let result;
            if (recipe.id) {
                // Update
                const { data, error } = await supabase
                    .from('sop_recipes')
                    .update(payload)
                    .eq('id', recipe.id)
                    .select('*, category:sop_categories(id, label, icon)')
                    .single();
                if (error) throw error;
                result = data;

                logStaffActivity('sop', 'sop_update', {
                    reason: `แก้ไขสูตร SOP: ${recipe.name}`,
                    metadata: {
                        sop_id: recipe.id,
                        name: recipe.name,
                        department: recipe.department || department,
                        ingredients_count: updatedIngredients?.length || 0,
                        steps_count: (recipe.steps || []).length,
                        is_published: recipe.is_published
                    }
                });
            } else {
                // Create
                const { data, error } = await supabase
                    .from('sop_recipes')
                    .insert(payload)
                    .select('*, category:sop_categories(id, label, icon)')
                    .single();
                if (error) throw error;
                result = data;

                logStaffActivity('sop', 'sop_create', {
                    reason: `สร้างสูตร SOP ใหม่: ${recipe.name}`,
                    metadata: {
                        sop_id: result?.id,
                        name: recipe.name,
                        department: recipe.department || department,
                        ingredients_count: updatedIngredients?.length || 0,
                        steps_count: (recipe.steps || []).length,
                        is_published: recipe.is_published
                    }
                });
            }

            toast.success('บันทึก SOP สำเร็จ');
            return result;
        } catch (err) {
            console.error('Save SOP failed:', err);
            toast.error('บันทึกไม่สำเร็จ: ' + (err.message || 'Unknown'));
            return null;
        }
    }, [department]);

    // ────────────────────────────────
    // Delete SOP Recipe
    // ────────────────────────────────
    const deleteSOPRecipe = useCallback(async (id) => {
        try {
            const { data: recipe } = await supabase
                .from('sop_recipes')
                .select('name')
                .eq('id', id)
                .single();

            const { error } = await supabase
                .from('sop_recipes')
                .delete()
                .eq('id', id);
            if (error) throw error;

            logStaffActivity('sop', 'sop_delete', {
                reason: `ลบสูตร SOP: ${recipe?.name || id}`,
                metadata: {
                    sop_id: id,
                    name: recipe?.name
                }
            });

            setRecipes(prev => prev.filter(r => r.id !== id));
            toast.success('ลบ SOP สำเร็จ');
            return true;
        } catch (err) {
            console.error('Delete SOP failed:', err);
            toast.error('ลบไม่สำเร็จ');
            return false;
        }
    }, []);

    // ────────────────────────────────
    // Duplicate SOP Recipe (1-Click Clone)
    // ────────────────────────────────
    const duplicateSOPRecipe = useCallback(async (recipeId) => {
        try {
            const target = recipes.find(r => r.id === recipeId);
            if (!target) throw new Error('ไม่พบสูตรที่ต้องการคัดลอก');

            const clonePayload = {
                ...target,
                id: undefined,
                name: `${target.name} (สำเนา)`,
                name_en: target.name_en ? `${target.name_en} (Copy)` : '',
                is_published: false,
                source_stock_item_id: null,
                source_menu_item_id: null,
                sort_order: (target.sort_order || 0) + 1,
                created_at: undefined,
                updated_at: undefined
            };

            const newRecipe = await saveSOPRecipe(clonePayload);
            if (newRecipe) {
                logStaffActivity('sop', 'sop_duplicate', {
                    reason: `คัดลอกสูตร SOP จาก: ${target.name} → ${newRecipe.name}`,
                    metadata: {
                        source_id: recipeId,
                        new_id: newRecipe.id,
                        name: newRecipe.name
                    }
                });
                await fetchRecipes(activeCategory);
                toast.success(`คัดลอกสูตร "${newRecipe.name}" สำเร็จ`);
                return newRecipe;
            }
            return null;
        } catch (err) {
            console.error('Duplicate SOP failed:', err);
            toast.error('คัดลอกสูตรไม่สำเร็จ: ' + err.message);
            return null;
        }
    }, [recipes, saveSOPRecipe, fetchRecipes, activeCategory]);

    // ────────────────────────────────
    // Save Category
    // ────────────────────────────────
    const saveCategory = useCallback(async (category) => {
        try {
            const { data, error } = await supabase
                .from('sop_categories')
                .upsert(category, { onConflict: 'id' })
                .select()
                .single();
            if (error) throw error;

            logStaffActivity('sop', 'sop_category_save', {
                reason: `บันทึกหมวดหมู่ SOP: ${category.label || category.id}`,
                metadata: {
                    category_id: category.id,
                    label: category.label,
                    icon: category.icon,
                    department: category.department || department
                }
            });

            cacheRef.current.categories = null; // Invalidate cache
            await fetchCategories();
            return data;
        } catch (err) {
            console.error('Save category failed:', err);
            toast.error('บันทึกหมวดหมู่ไม่สำเร็จ');
            return null;
        }
    }, [fetchCategories, department]);

    // ────────────────────────────────
    // Delete Category
    // ────────────────────────────────
    const deleteCategory = useCallback(async (id) => {
        try {
            const { error } = await supabase
                .from('sop_categories')
                .delete()
                .eq('id', id);
            if (error) throw error;

            logStaffActivity('sop', 'sop_category_delete', {
                reason: `ลบหมวดหมู่ SOP: ${id}`,
                metadata: { category_id: id }
            });

            cacheRef.current.categories = null;
            await fetchCategories();
            toast.success('ลบหมวดหมู่สำเร็จ');
            return true;
        } catch (err) {
            console.error('Delete category failed:', err);
            toast.error('ลบหมวดหมู่ไม่สำเร็จ');
            return false;
        }
    }, [fetchCategories]);

    // ────────────────────────────────
    // Sync with Recipe Lab
    // ────────────────────────────────
    const syncSOPWithRecipeLab = useCallback(async (sourceId, sourceType, currentIngredients = []) => {
        if (!sourceId) return currentIngredients;
        const freshLinked = await fetchRecipeLabSummary(sourceId, sourceType);
        if (!freshLinked || freshLinked.length === 0) {
            toast.error('ไม่พบส่วนผสมใน Recipe Lab หรือสูตรว่างเปล่า');
            return currentIngredients;
        }

        // Merge: keep manual items (isLinked !== true), replace or append linked items
        const manuals = currentIngredients.filter(i => !i.isLinked);
        const merged = [...freshLinked, ...manuals];
        
        toast.success('ซิงค์ข้อมูลจาก Recipe Lab สำเร็จ');
        return merged;
    }, [fetchRecipeLabSummary]);

    // ────────────────────────────────
    // Save Glass Size
    // ────────────────────────────────
    const saveGlassSize = useCallback(async (glassSize) => {
        try {
            const { data, error } = await supabase
                .from('sop_glass_sizes')
                .upsert(glassSize)
                .select()
                .single();
            if (error) throw error;

            cacheRef.current.glassSizes = null;
            await fetchGlassSizes();
            return data;
        } catch {
            toast.error('บันทึกขนาดแก้วไม่สำเร็จ');
            return null;
        }
    }, [fetchGlassSizes]);

    // ────────────────────────────────
    // Unified Load and Fetch
    // ────────────────────────────────
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                if (!staffMode) {
                    await syncCategoriesAndRecipes();
                }
                await Promise.all([fetchCategories(), fetchGlassSizes()]);
                await fetchRecipes(activeCategory);
                isInitRef.current = true;
            } catch (err) {
                console.error('Initialization failed:', err);
            } finally {
                setLoading(false);
            }
        };

        if (!isInitRef.current) {
            init();
        } else {
            fetchRecipes(activeCategory);
        }
    }, [activeCategory, staffMode, syncCategoriesAndRecipes, fetchCategories, fetchGlassSizes, fetchRecipes]);

    return {
        // Data
        recipes: filteredRecipes,
        allRecipes: recipes,
        categories,
        glassSizes,
        loading,

        // State
        activeCategory,
        setActiveCategory,
        searchQuery,
        setSearchQuery,

        // Actions
        fetchRecipes,
        fetchCategories,
        fetchGlassSizes,
        scaleIngredients,
        fetchRecipeLabSummary,
        syncSOPWithRecipeLab,
        saveSOPRecipe,
        duplicateSOPRecipe,
        deleteSOPRecipe,
        saveCategory,
        deleteCategory,
        saveGlassSize,

        // Refresh
        refresh: async () => {
            cacheRef.current = {};
            setLoading(true);
            await syncCategoriesAndRecipes();
            await Promise.all([fetchCategories(), fetchGlassSizes()]);
            await fetchRecipes(activeCategory);
            setLoading(false);
        }
    };
}

// ────────────────────────────────
// Action Types (ขั้นตอนการทำ)
// ────────────────────────────────
export const SOP_ACTIONS = [
    { key: 'prepare',  icon: '🔪', label: 'เตรียม',     labelEn: 'Prepare' },
    { key: 'bullet',   icon: '🔸', label: 'ขั้นตอน',    labelEn: 'Step' }
];

export const getActionByKey = (key) => SOP_ACTIONS.find(a => a.key === key) || { key: 'bullet', icon: '🔸', label: 'ขั้นตอน', labelEn: 'Step' };
