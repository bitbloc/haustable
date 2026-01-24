/**
 * unitUtils.js
 * Utility for Unit Conversion logic (Thai Context)
 */

// Common conversion factors to Base Units (g, ml)
const UNIT_FACTORS = {
    // Mass (Base: g)
    'kg': 1000,
    'g': 1,
    'mg': 0.001,
    'ขีด': 100,
    'lb': 453.592,
    'oz': 28.3495,
    
    // Volume (Base: ml)
    'l': 1000,
    'ml': 1,
    'gallon': 3785.41,
    'oz_fl': 29.5735,
    'cup': 240, // standard metric cup
    'tbsp': 15,
    'tsp': 5,
    'shot': 30, // bar standard
    
    // Count
    'unit': 1,
    'pcs': 1,
    'box': 1, // varied
    'pack': 1, // varied
};

// Thai Unit Labels
export const THAI_UNITS = [
    { value: 'g', label: 'กรัม (g)' },
    { value: 'kg', label: 'กิโลกรัม (kg)' },
    { value: 'ml', label: 'มิลลิลิตร (ml)' },
    { value: 'l', label: 'ลิตร (L)' },
    { value: 'oz', label: 'ออนซ์ (oz)' },
    { value: 'oz_fl', label: 'ออนซ์ของเหลว (fl oz)' },
    { value: 'shot', label: 'ช็อต (Shot)' },
    { value: 'tsp', label: 'ช้อนชา (tsp)' },
    { value: 'tbsp', label: 'ช้อนโต๊ะ (tbsp)' },
    { value: 'unit', label: 'หน่วย/ชิ้น' },
    { value: 'gallon', label: 'แกลลอน (Gallon)' },
];

/**
 * Suggest a conversion factor based on From/To units
 * @param {string} fromUnit 
 * @param {string} toUnit 
 * @returns {number} Suggested factor (1 if unknown)
 */
export const suggestConversionFactor = (fromUnit, toUnit) => {
    const from = fromUnit?.toLowerCase();
    const to = toUnit?.toLowerCase();
    
    if (!from || !to) return 1;
    if (from === to) return 1;

    const fromVal = UNIT_FACTORS[from];
    const toVal = UNIT_FACTORS[to];

    if (fromVal && toVal) {
        // Example: kg (1000) -> g (1) = 1000 / 1 = 1000
        // Example: g (1) -> kg (1000) = 1 / 1000 = 0.001
        return fromVal / toVal;
    }

    return 1; // Fallback manual
};

/**
 * Convert value between units
 */
export const convertValue = (value, factor) => {
    return (parseFloat(value) || 0) * (parseFloat(factor) || 1);
};
