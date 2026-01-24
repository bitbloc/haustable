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
    
    let totalMaterialCost = 0; // Sum of Ingredients + Packaging
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
            breakdown.ingredients.push({
                name: item.name,
                cost: 0,
                error: 'Circular Ref'
            });
            return;
        }

        let unitCost = 0;

        if (item.is_base_recipe) {
            // Base Recipe Logic:
            // Ideally, Base Recipe stores its calculated Cost Price in the DB (Master Data 1.2)
            // So we treat it exactly like a Raw Ingredient (Master Data 1.1)
            // Start Step 1: Calculate Ingredient Cost
            unitCost = calculateRealUnitCost(item);
        } else {
            // Raw Ingredient / Packaging (Master Data 1.1)
            // Start Step 1: Calculate Ingredient Cost
            unitCost = calculateRealUnitCost(item);
        }

        const usageCost = unitCost * (parseFloat(entry.quantity) || 0);
        
        // Accumulate for Step 2: Sub Total
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

    // Step 2: Sub Total
    breakdown.subTotal = totalMaterialCost;
    
    // Step 3: Apply Q-Factor (Hidden Cost = Sub Total * %)
    // User Formula: Hidden Cost = Sub Total x (Q-Factor % / 100)
    const allowance = (totalMaterialCost * (qFactorPercent / 100));
    breakdown.qFactorCost = allowance;
    
    // Step 4: Final Total Cost (Sub Total + Hidden Cost)
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
