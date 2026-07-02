/**
 * Formats stock quantity into a structured object for display.
 * Handles floating point precision safe logic.
 * 
 * @param {number} quantity - The raw stock quantity (float).
 * @param {string} unit - The unit label (e.g., 'ขวด', 'pack').
 * @returns {object} Formatted display data.
 */
export const formatStockDisplay = (quantity, unit = '', usageUnit = null, factor = 1) => {
  // Safe Number conversion
  const qty = Number(Number(quantity).toFixed(4)) || 0;
  
  // Integer part (Unopened/Full)
  const fullUnits = Math.floor(qty);
  
  // Decimal part (Opened) - Fix floating point issues
  const remainder = Number((qty - fullUnits).toFixed(4));
  
  // Convert remainder to percentage (0-100)
  const percent = Math.round(remainder * 100);

  // Convert remainder to Usage Units if available
  const remainderUsage = usageUnit && factor > 1 
    ? Number((remainder * factor).toFixed(2))
    : null;

  const hasOpen = percent > 0;
  const openedUnits = hasOpen ? 1 : 0;
  const totalPhysical = fullUnits + openedUnits;

  // Construct Thai display string
  // User formatting: "ยังไม่เปิด 1 ถุง เปิดแล้ว 1 ถุง (เหลือ 10%)"
  let displayString = '';
  
  if (fullUnits > 0) {
      displayString = `ยังไม่เปิด ${fullUnits} ${unit}`;
  } else if (hasOpen) {
      displayString = `ยังไม่มีสินค้าที่ยังไม่เปิด`;
  } else {
      displayString = 'หมด';
  }
  
  if (hasOpen) {
      const breakdown = remainderUsage !== null 
        ? `${remainderUsage} ${usageUnit}`
        : `${percent}%`;
      displayString += ` เปิดแล้ว 1 ${unit.replace('(', '').replace(')', '')} (เหลือ ${breakdown})`;
  }

  // Fallback for simple display if needed
  // const shortDisplay = `${qty} ${unit}`;

  return {
    fullUnits,
    openedUnits,
    totalPhysical,
    percent,
    remainder,
    remainderUsage,
    hasOpen,
    displayString,
    raw: qty
  };
};

/**
 * Calculates total stock from integer and percentage components.
 * 
 * @param {number} fullUnits - Integer part.
 * @param {number} percent - Percentage part (0-100).
 * @returns {number} Total float quantity.
 */
export const calculateTotalFromComponents = (fullUnits, percent) => {
    const safeFull = Math.max(0, parseInt(fullUnits) || 0);
    const safePercent = Math.max(0, parseFloat(percent) || 0);
    
    // Calculate total and ensure precision
    const total = safeFull + (safePercent / 100);
    return Number(total.toFixed(4));
};
