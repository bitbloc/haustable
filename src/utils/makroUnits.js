/**
 * Units for a stock item from a makro.pro product: what one purchase (one pack as sold) holds,
 * in the unit recipes use. Read from the product title ("มิตรผล น้ำเชื่อม 1.8 ล.",
 * "น้ำตาลทราย 1 กก. x 5", "แก้วพลาสติก 16 ออนซ์ x 50") and its unitSize ("50 ชิ้น").
 *
 * Returns { packUnit, usageUnit, conversionFactor, summary } or null when the title has
 * nothing usable. conversionFactor = usage units in one pack (price is per pack).
 */
const CONTENT = [
    { re: /(\d+(?:[.,]\d+)?)\s*(?:มล\.?|มิลลิลิตร|ml)(?![a-z])/i, unit: 'ml', mul: 1 },
    { re: /(\d+(?:[.,]\d+)?)\s*(?:ลิตร|ล\.|l)(?![a-z])/i, unit: 'ml', mul: 1000 },
    { re: /(\d+(?:[.,]\d+)?)\s*(?:กก\.?|กิโลกรัม|kg)(?![a-z])/i, unit: 'g', mul: 1000 },
    { re: /(\d+(?:[.,]\d+)?)\s*(?:กรัม|ก\.|g|gm)(?![a-z])/i, unit: 'g', mul: 1 },
];

const toNumber = (s) => Number(String(s).replace(',', '.'));

/** How many items one purchase holds: "x 50" in the title, else "50 ชิ้น" from unitSize or the title. */
function countPerPack(title, unitSize) {
    const x = String(title).match(/[x×]\s*(\d+)/i);
    if (x) return Number(x[1]);
    const u = String(unitSize || '').match(/(\d+)/);
    if (u && Number(u[1]) > 1) return Number(u[1]);
    const t = String(title).match(/(\d+)\s*(?:ชิ้น|ใบ|อัน|ซอง|ถุง|ขวด|กระป๋อง)/);
    if (t && Number(t[1]) > 1) return Number(t[1]);
    return 1;
}

export function parseMakroUnits(title = '', unitSize = '') {
    const text = String(title);
    const count = countPerPack(text, unitSize);

    // Content per item (volume or weight); "ออนซ์" on cups is a cup size, not content, so it is ignored
    let content = null;
    for (const c of CONTENT) {
        const m = text.match(c.re);
        if (m) { content = { unit: c.unit, qty: toNumber(m[1]) * c.mul }; break; }
    }

    if (content && content.qty > 0) {
        const factor = Math.round(content.qty * count * 1000) / 1000;
        const packUnit = count > 1 ? 'pack' : (content.unit === 'ml' ? 'bottle' : 'bag');
        const packLabel = { pack: 'แพ็ค', bottle: 'ขวด', bag: 'ถุง' }[packUnit];
        const usageLabel = content.unit === 'ml' ? 'มล.' : 'ก.';
        return {
            packUnit,
            usageUnit: content.unit,
            conversionFactor: factor,
            summary: `1 ${packLabel} = ${factor.toLocaleString('th-TH')} ${usageLabel}`
        };
    }
    if (count > 1) {
        return {
            packUnit: 'pack',
            usageUnit: 'pcs',
            conversionFactor: count,
            summary: `1 แพ็ค = ${count.toLocaleString('th-TH')} ชิ้น`
        };
    }
    return null;
}
