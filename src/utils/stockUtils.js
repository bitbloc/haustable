/**
 * Formats stock quantity into a structured object for display.
 * Handles floating point precision safe logic.
 * 
 * @param {number} quantity - The raw stock quantity (float).
 * @param {string} unit - The unit label (e.g., 'ขวด', 'pack').
 * @returns {object} Formatted display data.
 */
export const formatStockDisplay = (quantity, unit = '') => {
  // Safe Number conversion
  const qty = Number(quantity) || 0;
  
  // Integer part (Unopened/Full)
  const fullUnits = Math.floor(qty);
  
  // Decimal part (Opened) - Fix floating point issues (e.g., 1.9 - 1 = 0.89999...)
  const remainder = Number((qty - fullUnits).toFixed(4));
  
  // Convert remainder to percentage (0-100)
  const percent = Math.round(remainder * 100);

  const hasOpen = percent > 0;

  // Construct Thai display string
  // ex: "1 ขวด (ยังไม่เปิด)" or "1 ขวด + 90%"
  let displayString = '';
  
  if (fullUnits > 0) {
      displayString = `${fullUnits} ${unit}`;
  }
  
  if (hasOpen) {
      if (displayString) displayString += ' + ';
      displayString += `เปิดแล้ว ${percent}%`;
  } else if (fullUnits === 0) {
      displayString = `หมด`;
  }

  // If fully unopened (e.g. 2.0)
  if (fullUnits > 0 && !hasOpen) {
      displayString += ' (ยังไม่เปิด)';
  }

  return {
    fullUnits,
    percent,
    remainder,
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
