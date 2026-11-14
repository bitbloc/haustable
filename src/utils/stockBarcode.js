/**
 * Barcodes for stock counting.
 *
 * An item can be found by
 *   - stock_items.barcode            (one per item, existing column)
 *   - stock_item_barcodes rows       (extra codes: other brands, a case of 24)
 *   - a shop label QR "INHAUS:STOCK:<item id>" for things without a factory barcode
 *
 * Scanners disagree about UPC-A: some report 12 digits, some the 13-digit EAN
 * form with a leading 0. Codes are compared in one normal form.
 */

export const SHOP_LABEL_PREFIX = 'INHAUS:STOCK:';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Trim and drop spaces; a 13-digit code starting with 0 is the same product as its 12-digit UPC-A. */
export const normalizeBarcode = (code) => {
    const s = String(code ?? '').replace(/\s+/g, '').trim();
    if (/^0\d{12}$/.test(s)) return s.slice(1);
    return s;
};

/** Item id from a shop label QR, or null. */
export const parseShopLabel = (code) => {
    const s = String(code ?? '').trim();
    if (!s.toUpperCase().startsWith(SHOP_LABEL_PREFIX)) return null;
    const id = s.slice(SHOP_LABEL_PREFIX.length).trim();
    return UUID.test(id) ? id.toLowerCase() : null;
};

export const shopLabelFor = (itemId) => `${SHOP_LABEL_PREFIX}${itemId}`;

/**
 * Map normalized code -> { itemId, perScan }.
 * Extra rows win over the item column only when the column is empty for that code.
 */
export const buildBarcodeIndex = (items = [], extraRows = []) => {
    const index = new Map();
    for (const item of items) {
        const code = normalizeBarcode(item?.barcode);
        if (code) index.set(code, { itemId: item.id, perScan: 1 });
    }
    for (const row of extraRows) {
        const code = normalizeBarcode(row?.barcode);
        if (!code || index.has(code)) continue;
        const per = Number(row.units_per_scan);
        index.set(code, { itemId: row.stock_item_id, perScan: per > 0 ? per : 1 });
    }
    return index;
};

/** What a scanned code refers to: { itemId, perScan, code } or { itemId: null, code } when unknown. */
export const resolveScan = (index, rawCode, knownIds = null) => {
    const labelId = parseShopLabel(rawCode);
    if (labelId) {
        const known = !knownIds || knownIds.has(labelId);
        return { itemId: known ? labelId : null, perScan: 1, code: String(rawCode).trim(), isLabel: true };
    }
    const code = normalizeBarcode(rawCode);
    const hit = code ? index.get(code) : null;
    return hit ? { ...hit, code, isLabel: false } : { itemId: null, perScan: 1, code, isLabel: false };
};

/**
 * Camera decoders report the same code many times a second while it is in view.
 * accept(code) is true for a new code, or for the same code once it has been out
 * of view for `quietMs` (each sighting restarts the wait), so holding a bottle in
 * front of the camera counts once and showing it again counts again.
 */
export const createScanGate = (quietMs = 1200, now = () => Date.now()) => {
    let lastCode = null;
    let lastSeen = 0;
    return {
        accept(code) {
            const t = now();
            const same = code === lastCode && t - lastSeen < quietMs;
            lastCode = code;
            lastSeen = t;
            return !same;
        },
        reset() { lastCode = null; lastSeen = 0; }
    };
};

/** New count text after a scan: adds perScan to what is typed (empty or invalid counts as 0). */
export const addScanToCount = (current, perScan = 1) => {
    const n = Number(String(current ?? '').replace(/,/g, '').trim());
    const base = Number.isFinite(n) && String(current ?? '').trim() !== '' ? n : 0;
    return String(Math.round((base + perScan) * 10000) / 10000);
};
