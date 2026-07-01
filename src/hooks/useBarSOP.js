import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
// Global lock to prevent concurrent database sync runs
let globalSyncPromise = null;

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
    const syncCategoriesAndRecipes = useCallback(async () => {
        if (globalSyncPromise) {
            return globalSyncPromise;
        }

        globalSyncPromise = (async () => {
            try {
                // Fetch everything in parallel
                const [
                    { data: stockItems, error: stockErr },
                    { data: cats, error: catErr },
                    { data: sops, error: recipeErr }
                ] = await Promise.all([
                    supabase.from('stock_items').select('*').eq('is_base_recipe', true),
                    supabase.from('sop_categories').select('*').eq('is_active', true).in('department', [department, 'all']),
                    supabase.from('sop_recipes').select('*').eq('department', department)
                ]);

                if (stockErr || catErr || recipeErr) {
                    console.error('Sync fetch error:', { stockErr, catErr, recipeErr });
                    return { categories: cats || [], recipes: sops || [] };
                }

                // Identify unique folders from Recipe Lab
                const folders = Array.from(new Set(
                    stockItems.map(item => {
                        const cat = item.category;
                        if (cat && cat.startsWith('folder:')) {
                            return cat.substring(7);
                        }
                        return 'ทั่วไป';
                    })
                ));

                // Ensure categories exist in sop_categories
                let finalCats = [...(cats || [])];
                let categoryAdded = false;
                for (const folder of folders) {
                    const exists = finalCats.some(c => c.label.toLowerCase() === folder.toLowerCase());
                    if (!exists) {
                        const cleanLabel = folder.toLowerCase().trim()
                            .replace(/\s+/g, '_')
                            .replace(/[^a-zA-Z0-9_]/g, '');
                        const catId = `folder_${cleanLabel || 'cat'}_${Math.random().toString(36).substring(2, 7)}`;

                        const { data: newCat, error: insertErr } = await supabase
                            .from('sop_categories')
                            .insert({
                                id: catId,
                                label: folder,
                                icon: '📁',
                                department: department,
                                is_active: true,
                                sort_order: 0
                            })
                            .select()
                            .single();
                        if (!insertErr && newCat) {
                            finalCats.push(newCat);
                            categoryAdded = true;
                        }
                    }
                }
                if (categoryAdded) {
                    setCategories(finalCats);
                    cacheRef.current.categories = finalCats;
                }

                // Clean up any existing duplicate SOP recipes for the same source_stock_item_id
                let recipesModified = false;
                const seenStockIds = new Set();
                const uniqueSops = [];
                for (const sop of sops) {
                    if (sop.source_stock_item_id) {
                        if (seenStockIds.has(sop.source_stock_item_id)) {
                            console.log(`Deleting duplicate SOP recipe: ${sop.name} (${sop.id})`);
                            await supabase.from('sop_recipes').delete().eq('id', sop.id);
                            recipesModified = true;
                        } else {
                            seenStockIds.add(sop.source_stock_item_id);
                            uniqueSops.push(sop);
                        }
                    } else {
                        uniqueSops.push(sop);
                    }
                }

                // Fetch ingredients for all stockItems in a single query to avoid N+1 sequential requests
                const { data: allRecipeData, error: allRecipeErr } = await supabase
                    .from('recipe_ingredients')
                    .select(`
                        parent_stock_item_id,
                        quantity,
                        unit,
                        ingredient:stock_items!recipe_ingredients_ingredient_id_fkey (
                            id, name, usage_unit
                        )
                    `)
                    .in('parent_stock_item_id', stockItems.map(item => item.id));

                if (allRecipeErr) {
                    console.error('Failed to load ingredients for sync:', allRecipeErr);
                }

                // Sync stockItems to sop_recipes
                for (const item of stockItems) {
                    const matchedSop = uniqueSops.find(r => r.source_stock_item_id === item.id);
                    const folderName = item.category && item.category.startsWith('folder:')
                        ? item.category.substring(7)
                        : 'ทั่วไป';
                    const cat = finalCats.find(c => c.label.toLowerCase() === folderName.toLowerCase()) || finalCats[0];
                    const categoryId = cat ? cat.id : null;

                    if (!matchedSop) {
                        const recipeData = (allRecipeData || []).filter(ri => ri.parent_stock_item_id === item.id);
                        const ingredients = recipeData.map(ri => ({
                            id: ri.ingredient?.id,
                            name: ri.ingredient?.name || 'Unknown',
                            qty: ri.quantity || 0,
                            unit: ri.unit || ri.ingredient?.usage_unit || 'unit',
                            scalable: true,
                            isLinked: true,
                            isHidden: false
                        }));

                        await supabase.from('sop_recipes').insert({
                            name: item.name,
                            source_stock_item_id: item.id,
                            category_id: categoryId,
                            department: department,
                            base_glass_size_oz: 16,
                            is_published: true,
                            ingredients: ingredients,
                            steps: [],
                            scaling_rules: { "8": 0.5, "12": 0.75, "16": 1, "22": 1.375 },
                            sort_order: 0,
                            advanced_details: {}
                        });
                        recipesModified = true;
                    } else {
                        if (matchedSop.name !== item.name || matchedSop.category_id !== categoryId) {
                            await supabase
                                .from('sop_recipes')
                                .update({
                                    name: item.name,
                                    category_id: categoryId
                                })
                                .eq('id', matchedSop.id);
                            recipesModified = true;
                        }
                    }
                }

                // Cleanup orphaned SOP recipes where the Recipe Lab base recipe no longer exists
                for (const sop of uniqueSops) {
                    if (sop.source_stock_item_id) {
                        const exists = stockItems.some(item => item.id === sop.source_stock_item_id);
                        if (!exists) {
                            await supabase.from('sop_recipes').delete().eq('id', sop.id);
                            recipesModified = true;
                        }
                    }
                }

                if (recipesModified) {
                    const { data: refreshedSops } = await supabase
                        .from('sop_recipes')
                        .select('*')
                        .eq('department', department);
                    return { categories: finalCats, recipes: refreshedSops || [] };
                }

                return { categories: finalCats, recipes: uniqueSops };
            } catch (err) {
                console.error('Auto sync failed:', err);
                return { categories: [], recipes: [] };
            }
        })();

        const res = await globalSyncPromise;
        globalSyncPromise = null;
        return res;
    }, [department]);

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

            // Fetch fresh ingredients from recipe_ingredients for all linked recipes
            const linkedStockIds = sops.map(r => r.source_stock_item_id).filter(Boolean);
            let freshIngredients = [];
            if (linkedStockIds.length > 0) {
                const { data: recipeData, error: riError } = await supabase
                    .from('recipe_ingredients')
                    .select(`
                        parent_stock_item_id,
                        quantity,
                        unit,
                        ingredient:stock_items!recipe_ingredients_ingredient_id_fkey (
                            id, name, usage_unit
                        )
                    `)
                    .in('parent_stock_item_id', linkedStockIds);
                if (!riError && recipeData) {
                    freshIngredients = recipeData;
                }
            }

            // Map ingredients dynamically to display_ingredients for compatibility and keep them synchronized
            const populatedData = sops.map(r => {
                let currentIngs = r.ingredients || [];
                if (r.source_stock_item_id) {
                    const linkedIngs = freshIngredients
                        .filter(ri => ri.parent_stock_item_id === r.source_stock_item_id)
                        .map(ri => {
                            const existing = (r.ingredients || []).find(i => i.id === ri.ingredient?.id || i.name === ri.ingredient?.name);
                            return {
                                id: ri.ingredient?.id,
                                name: ri.ingredient?.name || 'Unknown',
                                qty: ri.quantity || 0,
                                unit: ri.unit || ri.ingredient?.usage_unit || 'unit',
                                scalable: existing?.scalable !== false,
                                is_sweetener: existing?.is_sweetener === true,
                                isHidden: existing?.isHidden === true,
                                isLinked: true,
                                remark: existing?.remark || ''
                            };
                        });
                    
                    const manualIngs = (r.ingredients || []).filter(i => !i.isLinked);
                    currentIngs = [...linkedIngs, ...manualIngs];
                }

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
    }, [department, staffMode, syncCategoriesAndRecipes]);

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
            const unitLower = (ing.unit || '').toLowerCase();
            // Solid/piece items units that do not scale with glass size, only scale with cups count
            const isPieceItem = ['pcs', 'glass', 'cup', 'pack', 'กล่อง', 'ถุง', 'ขวด', 'แผ่น', 'หลอด', 'ชิ้น', 'อัน', 'ฝา'].includes(unitLower) || 
                                ing.unit === 'GLASS' || 
                                ing.unit === 'PCS';

            let finalMultiplier = isPieceItem ? cups : (sizeMultiplier * cups);
            
            // Check if ingredient is a sweetener
            const isSweet = ing.is_sweetener === true;
            if (isSweet) {
                finalMultiplier *= sweetnessMultiplier;
            }

            const isScalable = ing.scalable !== false;

            let name = ing.name || '';
            if (isPieceItem && name.includes('แก้ว')) {
                // Dynamically recommend correct cup size in the name
                name = name.replace(/\d+\s*(ออนซ์|oz)/i, `${targetSizeOrPreset} $1`);
            }

            return {
                ...ing,
                name,
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
            // 1. Ensure stock_items (Recipe Lab base recipe) is updated/created
            let stockItemId = recipe.source_stock_item_id;
            const cat = categories.find(c => c.id === recipe.category_id);
            const folderName = cat ? `folder:${cat.label}` : 'restock';

            if (!stockItemId) {
                // Create new base recipe in stock_items
                const { data: newStock, error: stockErr } = await supabase
                    .from('stock_items')
                    .insert({
                        name: recipe.name,
                        is_base_recipe: true,
                        category: folderName,
                        cost_price: 0,
                        pack_size: 1,
                        pack_unit: 'unit',
                        usage_unit: 'unit',
                        unit: 'unit',
                        current_quantity: 0
                    })
                    .select()
                    .single();
                if (stockErr) throw stockErr;
                stockItemId = newStock.id;
                recipe.source_stock_item_id = stockItemId;
            } else {
                // Update existing base recipe in stock_items
                const { error: stockErr } = await supabase
                    .from('stock_items')
                    .update({
                        name: recipe.name,
                        category: folderName
                    })
                    .eq('id', stockItemId);
                if (stockErr) throw stockErr;
            }

            // 2. Resolve ingredients: check if any ingredient needs a new stock_items entry
            const updatedIngredients = [];
            for (const ing of (recipe.ingredients || [])) {
                let ingId = ing.id;
                if (!ingId) {
                    // Check if stock item with this name already exists
                    const { data: existingStock } = await supabase
                        .from('stock_items')
                        .select('id')
                        .eq('name', ing.name)
                        .limit(1);
                    if (existingStock && existingStock.length > 0) {
                        ingId = existingStock[0].id;
                    } else {
                        // Create a new raw stock item
                        const { data: newIng, error: ingErr } = await supabase
                            .from('stock_items')
                            .insert({
                                name: ing.name,
                                is_base_recipe: false,
                                category: 'restock',
                                cost_price: 0,
                                pack_size: 1,
                                pack_unit: ing.unit || 'unit',
                                usage_unit: ing.unit || 'unit',
                                unit: ing.unit || 'unit',
                                current_quantity: 0
                            })
                            .select()
                            .single();
                        if (ingErr) throw ingErr;
                        ingId = newIng.id;
                    }
                }
                updatedIngredients.push({
                    ...ing,
                    id: ingId,
                    isLinked: true
                });
            }
            recipe.ingredients = updatedIngredients;

            // 3. Update ingredients in recipe_ingredients (Recipe Lab)
            await supabase.from('recipe_ingredients').delete().eq('parent_stock_item_id', stockItemId);
            const payloadItems = updatedIngredients.map((ing, idx) => ({
                parent_stock_item_id: stockItemId,
                ingredient_id: ing.id,
                quantity: ing.qty,
                unit: ing.unit,
                layer_order: idx
            }));
            if (payloadItems.length > 0) {
                const { error: riErr } = await supabase.from('recipe_ingredients').insert(payloadItems);
                if (riErr) throw riErr;
            }

            const payload = {
                name: recipe.name,
                name_en: recipe.name_en || null,
                category_id: recipe.category_id,
                department: recipe.department || department,
                base_glass_size_oz: recipe.base_glass_size_oz || 16,
                source_menu_item_id: recipe.source_menu_item_id || null,
                source_stock_item_id: stockItemId,
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
    }, [department, categories]);

    // ────────────────────────────────
    // Delete SOP Recipe
    // ────────────────────────────────
    const deleteSOPRecipe = useCallback(async (id) => {
        try {
            // Get source_stock_item_id first to delete from stock_items as well
            const { data: recipe } = await supabase
                .from('sop_recipes')
                .select('source_stock_item_id')
                .eq('id', id)
                .single();

            const { error } = await supabase
                .from('sop_recipes')
                .delete()
                .eq('id', id);
            if (error) throw error;

            if (recipe && recipe.source_stock_item_id) {
                await supabase.from('stock_items').delete().eq('id', recipe.source_stock_item_id);
            }

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
