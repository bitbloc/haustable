import { displayUnit } from './stockCount';
import { getUnitType } from './unitUtils';
import { fullUnitCapacity } from './recipeGraph';

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
const CONTAINER_UNITS = ['pack', 'box', 'crate', 'carton', 'bag', 'can', 'bottle', 'portion', 'สูตร', 'แพ็ค', 'แพค', 'กล่อง', 'ลัง', 'ถุง', 'ห่อ', 'กระป๋อง', 'ขวด', 'โหล'];

// The generic unit reads as "ชิ้น" on cards; "หน่วย/ชิ้น" is the form's name for it
const cardUnit = (u) => { const label = displayUnit(u); return label === 'หน่วย/ชิ้น' ? 'ชิ้น' : label; };

/**
 * What one full counted unit holds, for saying how much is left in the opened one:
 * a 700 ml bottle -> { amount: 700, unit: 'ml' }, a pack of 110 bags -> { amount: 110, unit: 'pcs' }.
 * Pieces only from a real container, so "1 ชิ้น = 1,000 ขวด" never turns into a count of bottles.
 * null when unknown (the opened one is then said as a percentage).
 */
export function packCapacity(item) {
    const measured = fullUnitCapacity(item);
    if (measured) return measured;
    const low = (v) => String(v || '').trim().toLowerCase();
    const factor = Number(item?.conversion_factor) || 0;
    const usage = low(item?.usage_unit);
    const usageCounts = getUnitType(usage) === 'count' || ['แก้ว', 'ชิ้น', 'ใบ', 'อัน'].includes(usage);
    const packHolds = CONTAINER_UNITS.includes(low(item?.unit)) || CONTAINER_UNITS.includes(low(item?.pack_unit));
    return factor > 1 && usageCounts && packHolds && usage !== low(item?.unit || item?.pack_unit)
        ? { amount: factor, unit: usage }
        : null;
}

export function stockQtyParts(item) {
    const unit = cardUnit(item.unit || item.pack_unit);
    // Counted by weight or volume (กิโลกรัม, ลิตร): there is no "opened pack", the amount is the amount.
    // 0.35 kg is "0.35 กิโลกรัม", never "1 กิโลกรัม with one open".
    // A "แกลลอน" is a jug of any size here (5,000 ml of fish sauce), not 3,785 ml: it is counted
    // like a bottle, so the card says the jugs and the millilitres they hold.
    const countedUnit = String(item.unit || item.pack_unit || '').trim().toLowerCase();
    if (countedUnit !== 'gallon' && ['mass', 'volume'].includes(getUnitType(countedUnit))) {
        const qty = Number(Number(item.current_quantity).toFixed(4)) || 0;
        const maxDigits = qty > 0 && Math.abs(qty) < 0.01 ? 4 : 2;
        return {
            main: qty.toLocaleString('th-TH', { maximumFractionDigits: maxDigits }),
            unit, open: null, openPercent: 0, total: null, totalValue: null, totalUnit: null
        };
    }
    const factor = Number(item.conversion_factor) || 1;
    const usageType = getUnitType(item.usage_unit);
    const usageCounts = usageType === 'count' || ['แก้ว', 'ชิ้น', 'ใบ', 'อัน'].includes(item.usage_unit);
    // Pieces, grams and millilitres are whole numbers: a 4-decimal balance (1.4167 crates) is 17 bottles, not 17.0004
    const wholeUsage = usageCounts || ['g', 'ml'].includes(String(item.usage_unit || '').toLowerCase());
    const roundUsage = (n) => wholeUsage ? Math.round(n) : Math.round(n * 100) / 100;
    const qty = Math.max(0, Number(Number(item.current_quantity).toFixed(4)) || 0);
    const capacity = packCapacity(item);
    let fullUnits = Math.floor(qty + 1e-9);
    let remainder = Math.max(0, qty - fullUnits);
    let leftInOpen = capacity ? roundUsage(remainder * capacity.amount) : null;
    // What is left in the opened one rounds to a full one or to nothing: there is no opened one
    if (capacity && leftInOpen >= capacity.amount) { fullUnits += 1; remainder = 0; leftInOpen = 0; }
    const percent = Math.round(remainder * 100);
    const hasOpen = capacity ? leftInOpen > 0 : percent > 0;
    const left = capacity ? `${leftInOpen.toLocaleString('th-TH')} ${cardUnit(capacity.unit)}` : `${percent}%`;
    // A crate of bottles, a pack of cups: the big number is the full ones, the open one is said
    // in pieces under it ("1 ลัง" and "+ เปิดอยู่ 1 ลัง เหลือ 5 ขวด"), so 17 bottles never read as
    // "2 ลัง" (24 bottles). A bottle of gin keeps counting the opened bottle: "0" read as out.
    const piecesInside = !!capacity && (getUnitType(capacity.unit) === 'count' || ['แก้ว', 'ชิ้น', 'ใบ', 'อัน'].includes(capacity.unit));
    const open = !hasOpen ? null
        : piecesInside ? `+ เปิดอยู่ 1 ${unit} เหลือ ${left}`
        : `${fullUnits > 0 ? `เต็ม ${fullUnits.toLocaleString('th-TH')} · ` : ''}เปิดอยู่ 1 เหลือ ${left}`;
    const onShelf = hasOpen && !piecesInside ? fullUnits + 1 : fullUnits;
    // Both figures (owner, 2026-11-16): how many packs, and how much that is in the unit recipes use
    // ("2 แพ็ค · 143 ชิ้น", "5 ชิ้น · 5,000 กรัม"). Left out when the converter cannot be true
    // ("1 ชิ้น = 1,000 ขวด") so the card never prints a nonsense total.
    const isContainer = (u) => CONTAINER_UNITS.includes(String(u || '').trim().toLowerCase());
    const packUnit = String(item.unit || item.pack_unit || '').trim().toLowerCase();
    const packHolds = isContainer(item.pack_unit) || isContainer(item.unit);
    const sound = usageCounts
        ? packHolds                                   // pieces only from a real container
        : ['mass', 'volume'].includes(usageType);     // grams or ml from a pack, bottle or generic piece
    const hasTotal = factor > 1 && sound && String(item.usage_unit || '').trim().toLowerCase() !== packUnit;
    const amount = hasTotal ? roundUsage(qty * factor) : 0;
    const total = amount > 0 ? `${amount.toLocaleString('th-TH')} ${cardUnit(item.usage_unit)}` : null;
    // House-made bases (unit = 'portion' / 'สูตร') ALWAYS lead with "สูตร" ("ต่อสูตร")
    // while showing the total yield in usage units beside it (e.g. 1 สูตร | 24 ถุง or 1,300 มล.).
    const isPortionBase = packUnit === 'portion' || packUnit === 'potion' || packUnit === 'สูตร';
    // Sold or used one by one (a bottle of beer, a cup): the stock is said in pieces first,
    // "17 ขวด", with the crates beside it (owner, 2026-11-17: ตัดทะลุ shows how many bottles in all)
    if (piecesInside && hasTotal && !isPortionBase) {
        const pieceUnit = cardUnit(item.usage_unit);
        // The crates are a small summary under the count: "1 ลัง + 5 ขวด", "5 แพ็ค"
        const summary = fullUnits > 0
            ? `${fullUnits.toLocaleString('th-TH')} ${unit}${hasOpen ? ` + ${leftInOpen.toLocaleString('th-TH')} ${pieceUnit}` : ''}`
            : null;
        return {
            main: amount.toLocaleString('th-TH'), unit: pieceUnit, open: summary, openPercent: 0,
            total: summary, totalValue: null, totalUnit: null, single: true,
        };
    }
    return {
        main: onShelf.toLocaleString('th-TH'), unit, open, openPercent: hasOpen ? percent : 0, total,
        totalValue: amount > 0 ? amount.toLocaleString('th-TH') : null,
        totalUnit: amount > 0 ? cardUnit(item.usage_unit) : null,
    };
}
