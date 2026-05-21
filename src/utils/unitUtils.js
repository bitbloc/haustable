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
    'box': 1, 
    'pack': 1,
    'can': 1,
    'bottle': 1,
    'bag': 1,
    'crate': 1,
    'carton': 1,
    'glass': 1,
};

// Thai Unit Labels
export const THAI_UNITS = [
    // Mass
    { value: 'g', label: 'กรัม (g)', type: 'mass' },
    { value: 'kg', label: 'กิโลกรัม (kg)', type: 'mass' },
    { value: 'oz', label: 'ออนซ์ (oz)', type: 'mass' },
    { value: 'lb', label: 'ปอนด์ (lb)', type: 'mass' },
    { value: 'ขีด', label: 'ขีด', type: 'mass' },

    // Volume
    { value: 'ml', label: 'มิลลิลิตร (ml)', type: 'volume' },
    { value: 'l', label: 'ลิตร (L)', type: 'volume' },
    { value: 'oz_fl', label: 'ออนซ์ของเหลว (fl oz)', type: 'volume' },
    { value: 'shot', label: 'ช็อต (Shot)', type: 'volume' },
    { value: 'tsp', label: 'ช้อนชา (tsp)', type: 'volume' },
    { value: 'tbsp', label: 'ช้อนโต๊ะ (tbsp)', type: 'volume' },
    { value: 'cup', label: 'ถ้วยตวง (Cup)', type: 'volume' },
    { value: 'gallon', label: 'แกลลอน (Gallon)', type: 'volume' },

    // Count / Container
    { value: 'unit', label: 'หน่วย/ชิ้น (Unit)', type: 'count' },
    { value: 'pcs', label: 'ชิ้น (Pcs)', type: 'count' },
    { value: 'pack', label: 'แพ็ค (Pack)', type: 'count' },
    { value: 'box', label: 'กล่อง (Box)', type: 'count' },
    { value: 'can', label: 'กระป๋อง (Can)', type: 'count' },
    { value: 'bottle', label: 'ขวด (Bottle)', type: 'count' },
    { value: 'glass', label: 'แก้ว (Glass)', type: 'count' },
    { value: 'bag', label: 'ถุง (Bag)', type: 'count' },
    { value: 'crate', label: 'ลัง (Crate)', type: 'count' },
    { value: 'carton', label: 'คาร์ตัน (Carton)', type: 'count' },
];

/**
 * Get the category of a unit (mass, volume, count, or unknown)
 * @param {string} unit 
 * @returns {string} type
 */
export const getUnitType = (unit) => {
    const normalized = unit?.toLowerCase();
    if (!normalized) return 'unknown';

    const found = THAI_UNITS.find(u => u.value.toLowerCase() === normalized);
    if (found) return found.type;

    // Fallback classification from keys
    const massKeys = ['kg', 'g', 'mg', 'ขีด', 'lb', 'oz'];
    const volumeKeys = ['l', 'ml', 'gallon', 'oz_fl', 'cup', 'tbsp', 'tsp', 'shot'];
    const countKeys = ['unit', 'pcs', 'box', 'pack', 'can', 'bottle', 'bag', 'crate', 'carton', 'glass'];

    if (massKeys.includes(normalized)) return 'mass';
    if (volumeKeys.includes(normalized)) return 'volume';
    if (countKeys.includes(normalized)) return 'count';

    return 'unknown';
};

/**
 * Check if two unit types are compatible (i.e. same category and not unknown)
 * @param {string} unitA 
 * @param {string} unitB 
 * @returns {boolean}
 */
export const areUnitTypesCompatible = (unitA, unitB) => {
    const typeA = getUnitType(unitA);
    const typeB = getUnitType(unitB);
    if (typeA === 'unknown' || typeB === 'unknown') return false;
    return typeA === typeB;
};

/**
 * Suggest a conversion factor based on From/To units
 * @param {string} fromUnit 
 * @param {string} toUnit 
 * @returns {number|null} Suggested factor (null if incompatible or custom required)
 */
export const suggestConversionFactor = (fromUnit, toUnit) => {
    const from = fromUnit?.toLowerCase();
    const to = toUnit?.toLowerCase();
    
    if (!from || !to) return null;
    if (from === to) return 1;

    const typeFrom = getUnitType(from);
    const typeTo = getUnitType(to);

    // Only suggest factor if they are standard compatible categories and not count/unknown
    if (typeFrom === typeTo && typeFrom !== 'count' && typeFrom !== 'unknown') {
        const fromVal = UNIT_FACTORS[from];
        const toVal = UNIT_FACTORS[to];

        if (fromVal && toVal) {
            return fromVal / toVal;
        }
    }

    return null; // Force manual input
};

/**
 * Convert value between units
 */
export const convertValue = (value, factor) => {
    return (parseFloat(value) || 0) * (parseFloat(factor) || 1);
};

