import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';

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

        cacheRef.current.glassSizes = data || [];
        setGlassSizes(data || []);
        return data || [];
    }, []);

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

            // Map ingredients directly to display_ingredients for compatibility
            const populatedData = sops.map(r => ({
                ...r,
                display_ingredients: r.ingredients || []
            }));

            setRecipes(populatedData);

            // Cache for offline
            if (staffMode) {
                try {
                    localStorage.setItem(`sop_cache_${department}`, JSON.stringify({
                        data: populatedData,
                        timestamp: Date.now()
                    }));
                } catch (e) { /* ignore storage errors */ }
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
                } catch (e) { /* ignore */ }
            }

            toast.error('โหลดข้อมูล SOP ไม่สำเร็จ');
            return [];
        } finally {
            setLoading(false);
        }
    }, [department, staffMode]);

    // ────────────────────────────────
    // Scale Ingredients
    // ── Helper: Scale Ingredients ──
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

        // Sweetness Multiplier
        // Support custom overrides in recipe.advanced_details.sweetness_rules or default values
        const customRules = recipe.advanced_details?.sweetness_rules || {};
        let sweetnessMultiplier = 1.0;
        
        switch (sweetnessLevel) {
            case '0%':
            case 'none':
                sweetnessMultiplier = customRules.none !== undefined ? customRules.none : 0.0;
                break;
            case '25%':
            case 'very_less':
                sweetnessMultiplier = customRules.very_less !== undefined ? customRules.very_less : 0.25;
                break;
            case '50%':
            case 'less':
                sweetnessMultiplier = customRules.less !== undefined ? customRules.less : 0.5;
                break;
            case '100%':
            case 'normal':
                sweetnessMultiplier = customRules.normal !== undefined ? customRules.normal : 1.0;
                break;
            case '120%':
            case 'extra':
                sweetnessMultiplier = customRules.extra !== undefined ? customRules.extra : 1.2;
                break;
            default:
                sweetnessMultiplier = 1.0;
        }

        return ingredients.map(ing => {
            let finalMultiplier = sizeMultiplier * cups;
            
            // Check if ingredient is a sweetener
            const isSweet = ing.is_sweetener === true;
            if (isSweet) {
                finalMultiplier *= sweetnessMultiplier;
            }

            const isScalable = ing.scalable !== false;

            return {
                ...ing,
                scaledQty: isScalable
                    ? Math.round((ing.qty * finalMultiplier) * 100) / 100
                    : ing.qty,
                isScaled: isScalable && finalMultiplier !== 1,
                isSweetScaled: isSweet && sweetnessMultiplier !== 1.0
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
            const payload = {
                name: recipe.name,
                name_en: recipe.name_en || null,
                category_id: recipe.category_id,
                department: recipe.department || department,
                base_glass_size_oz: recipe.base_glass_size_oz || 16,
                source_menu_item_id: recipe.source_menu_item_id || null,
                source_stock_item_id: recipe.source_stock_item_id || null,
                ingredients: recipe.ingredients || [],
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
            } else {
                // Create
                const { data, error } = await supabase
                    .from('sop_recipes')
                    .insert(payload)
                    .select('*, category:sop_categories(id, label, icon)')
                    .single();
                if (error) throw error;
                result = data;
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
            const { error } = await supabase
                .from('sop_recipes')
                .delete()
                .eq('id', id);
            if (error) throw error;

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

            cacheRef.current.categories = null; // Invalidate cache
            await fetchCategories();
            return data;
        } catch (err) {
            console.error('Save category failed:', err);
            toast.error('บันทึกหมวดหมู่ไม่สำเร็จ');
            return null;
        }
    }, [fetchCategories]);

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
        } catch (err) {
            toast.error('บันทึกขนาดแก้วไม่สำเร็จ');
            return null;
        }
    }, [fetchGlassSizes]);

    // ────────────────────────────────
    // Initial Load
    // ────────────────────────────────
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await Promise.all([fetchCategories(), fetchGlassSizes()]);
            setLoading(false);
        };
        init();
    }, []);

    // Fetch recipes when category changes (including null for 'All')
    useEffect(() => {
        fetchRecipes(activeCategory);
    }, [activeCategory, fetchRecipes]);

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
        deleteSOPRecipe,
        saveCategory,
        deleteCategory,
        saveGlassSize,

        // Refresh
        refresh: () => {
            cacheRef.current = {};
            fetchCategories();
            fetchGlassSizes();
            fetchRecipes(activeCategory);
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
