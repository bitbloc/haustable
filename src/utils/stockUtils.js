import { displayUnit } from './stockCount';
import { getUnitType } from './unitUtils';

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

const STATUS_EPSILON = 0.0001;

/**
 * Where an item stands, for the stock screens: 'out' (nothing left), 'low' (at or under the
 * minimum), 'reorder' (at or under the reorder point) or 'ok'. One rule for cards, rows and
 * the summary, so a tag never says "หมด" while the number says 2.
 */
export const stockStatus = (item = {}) => {
  const qty = Number(item.current_quantity) || 0;
  const min = Number(item.min_stock_threshold) || 0;
  const reorder = Number(item.reorder_point) || 0;
  if (qty <= STATUS_EPSILON) return 'out';
  if (min > 0 && qty <= min + STATUS_EPSILON) return 'low';
  if (reorder > 0 && qty <= reorder + STATUS_EPSILON) return 'reorder';
  return 'ok';
};

export const STOCK_STATUS_LABEL = Object.freeze({ out: 'หมด', low: 'เหลือน้อย', reorder: 'ควรสั่ง', ok: '' });

/** "2 ขวด" and, when one is open, what is left in it ("เปิดแล้ว 300 ml" / "เปิดแล้ว 40%"). */
// Units that hold many of something; the piece total is shown only for these
const CONTAINER_UNITS = ['pack', 'box', 'crate', 'carton', 'bag', 'can', 'bottle', 'แพ็ค', 'แพค', 'กล่อง', 'ลัง', 'ถุง', 'ห่อ', 'กระป๋อง', 'ขวด', 'โหล'];

export function stockQtyParts(item) {
    const unit = displayUnit(item.unit || item.pack_unit);
    // Counted by weight or volume (กิโลกรัม, ลิตร): there is no "opened pack", the amount is the amount.
    // 0.35 kg is "0.35 กิโลกรัม", never "1 กิโลกรัม with one open".
    if (['mass', 'volume'].includes(getUnitType(item.unit || item.pack_unit))) {
        const qty = Number(Number(item.current_quantity).toFixed(4)) || 0;
        return {
            main: qty.toLocaleString('th-TH', { maximumFractionDigits: 2 }),
            unit, open: null, openPercent: 0, total: null
        };
    }
    const { fullUnits, percent, hasOpen, remainderUsage } = formatStockDisplay(
        item.current_quantity, item.unit || item.pack_unit, item.usage_unit, item.conversion_factor
    );
    // The big number is what is on the shelf, the opened pack included: "0" with an open bottle read as out.
    // The line under it says one of them is open and how much is left in it.
    const open = hasOpen
        ? `เปิดอยู่ 1 · เหลือ ${remainderUsage !== null ? `${remainderUsage.toLocaleString('th-TH')} ${displayUnit(item.usage_unit)}` : `${percent}%`}`
        : null;
    const onShelf = hasOpen ? fullUnits + 1 : fullUnits;
    // Packs of countable things (bags, cups, straws): how many pieces that is, so a glance answers "how many are left"
    const factor = Number(item.conversion_factor) || 1;
    // Only for real containers (แพ็ค, กล่อง, ลัง, ถุง…): a pack set up in kilograms, or "1 ชิ้น = 1,000 ขวด",
    // is a unit set-up mistake and would print a nonsense total.
    const isContainer = (u) => CONTAINER_UNITS.includes(String(u || '').trim().toLowerCase());
    const countedInPieces = factor > 1
        && (getUnitType(item.usage_unit) === 'count' || ['แก้ว', 'ชิ้น', 'ใบ', 'อัน'].includes(item.usage_unit))
        && (isContainer(item.pack_unit) || isContainer(item.unit))
        && String(item.usage_unit) !== String(item.unit || item.pack_unit);
    const pieces = countedInPieces ? Math.round((Number(item.current_quantity) || 0) * factor) : 0;
    const total = pieces > 0 ? `${pieces.toLocaleString('th-TH')} ${displayUnit(item.usage_unit)}` : null;
    return { main: onShelf.toLocaleString('th-TH'), unit, open, openPercent: hasOpen ? percent : 0, total };
}
