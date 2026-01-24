/**
 * costUtils.js
 * Core Cost Calculation Logic
 */

/**
 * Calculate the Real Unit Cost of an ingredient
 * Formula: (Price / (PackSize * ConversionFactor)) / (Yield% / 100)
 * 
 * Example: Coffee Beans
 * Price: 500
 * Pack: 1 (Unit: kg)
 * Usage Unit: g
 * Factor: 1000 (1kg = 1000g)
 * Yield: 95%
 * 
 * Cost per Pack = 500
 * Net Usable Qty = 1 * 1000 * 0.95 = 950g
 * Unit Cost = 500 / 950 = 0.5263 baht/g
 */
export const calculateRealUnitCost = (item) => {
    if (!item) return 0;
    
    // Safety
    const price = parseFloat(item.cost_price) || 0;
    const packSize = parseFloat(item.pack_size) || 1;
    const factor = parseFloat(item.conversion_factor) || 1;
    const yieldPercent = parseFloat(item.yield_percent) || 100;
    
    if (packSize <= 0) return 0;

    const usablePercent = yieldPercent / 100;
    const totalUsableUnits = packSize * factor * usablePercent;
    
    if (totalUsableUnits <= 0) return 0;

    return price / totalUsableUnits;
};

/**
 * Calculate Recipe Cost (Start to Finish)
 * @param {Array} ingredients - List of recipe_ingredients linked to this item
 * @param {Function} getIngredientById - Function to lookup ingredient details (needed for recursion)
 * @param {Object} options - { qFactorPercent, visitedIds }
 */
export const calculateRecipeCost = (ingredients, getIngredientById, options = {}) => {
    const { qFactorPercent = 0, visitedIds = new Set() } = options;
    
    let totalMaterialCost = 0;
    const breakdown = {
        ingredients: [],
        subTotal: 0,
        qFactorCost: 0,
        totalCost: 0
    };

    if (!ingredients || !Array.isArray(ingredients)) return breakdown;

    ingredients.forEach(entry => {
        const item = getIngredientById(entry.ingredient_id);
        if (!item) return;

        // Circular Dependency Check
        if (visitedIds.has(item.id)) {
            console.error(`Circular dependency detected: ${item.name}`);
            // We skip this item instead of crashing
            breakdown.ingredients.push({
                name: item.name,
                cost: 0,
                error: 'Circular Ref'
            });
            return;
        }

        let unitCost = 0;

        if (item.is_base_recipe) {
            // Recursive Calculation for Base Recipe
            // We need the Sub-ingredients of this base recipe.
            // Note: This requires the caller to provide a way to get sub-ingredients.
            // If data structure is flat (all ingredients loaded), we might need passed 'allRecipes' map.
            // For MVP, if we don't have sub-ingredients handy, we use its 'cached' cost if we stored it,
            // OR we rely on the fact that Base Recipes should act like Stock Items with a pre-calculated cost?
            // BETTER APPROACH: Base Recipes should behave like Stock Items. 
            // When a Base Recipe is "Produced", it updates its own `cost_price` in stock_items.
            // So we just use `calculateRealUnitCost` same as raw ingredients!
            // This decouples "Planning Cost" (Theoretical) vs "Inventory Cost" (Actual).
            // For "Planning Mode", we might want dynamic recursion.
            
            // Let's support Dynamic Recursion if 'subRecipeFetcher' is provided, otherwise fallback to stored Cost.
            if (options.subRecipeFetcher) {
                const subIngredients = options.subRecipeFetcher(item.id);
                const subCost = calculateRecipeCost(subIngredients, getIngredientById, {
                    ...options,
                    visitedIds: new Set([...visitedIds, item.id])
                });
                // Base Recipe Unit Cost depends on its own "Yield" or "Batch Size".
                // Usually Base Recipe Output = X units.
                // If the recipe makes 1000ml, the subCost.totalCost is for 1000ml.
                // unitCost = subCost.totalCost / BatchSize.
                
                // Keep it simple for now: Use stored Unit Cost
                 unitCost = calculateRealUnitCost(item);
            } else {
                 unitCost = calculateRealUnitCost(item);
            }
        } else {
            // Raw Ingredient
            unitCost = calculateRealUnitCost(item);
        }

        const usageCost = unitCost * (parseFloat(entry.quantity) || 0);
        
        totalMaterialCost += usageCost;
        
        breakdown.ingredients.push({
            id: item.id,
            name: item.name,
            qty: entry.quantity,
            unit: entry.unit,
            unitCost,
            total: usageCost
        });
    });

    breakdown.subTotal = totalMaterialCost;
    
    // Q-Factor (Hidden Cost)
    const allowance = (totalMaterialCost * (qFactorPercent / 100));
    breakdown.qFactorCost = allowance;
    
    breakdown.totalCost = totalMaterialCost + allowance;

    return breakdown;
};

/**
 * Reverse Pricing: Calculate Selling Price based on Target Cost %
 */
export const calculateSuggestedPrice = (totalCost, targetCostPercent) => {
    if (targetCostPercent <= 0 || targetCostPercent >= 100) return 0;
    return totalCost / (targetCostPercent / 100);
};

// Add color helper for UI? (Optional)
export const getLayerColor = (index) => {
    const colors = [
        'bg-orange-100 border-orange-200 text-orange-800', // Base
        'bg-blue-100 border-blue-200 text-blue-800',     // Body
        'bg-green-100 border-green-200 text-green-800',   // Accent
        'bg-purple-100 border-purple-200 text-purple-800', // Garnish
        'bg-pink-100 border-pink-200 text-pink-800' // Extra
    ];
    return colors[index % colors.length];
};
