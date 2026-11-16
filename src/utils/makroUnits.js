/**
 * Units for a stock item from a makro.pro product: what one purchase (one pack as sold) holds,
 * in the unit recipes use. Read from the product title ("มิตรผล น้ำเชื่อม 1.8 ล.",
 * "น้ำตาลทราย 1 กก. x 5", "แก้วพลาสติก 16 ออนซ์ x 50") and its unitSize ("50 ชิ้น").
 *
 * Returns { packUnit, usageUnit, conversionFactor, summary } or null when the title has
 * nothing usable. conversionFactor = usage units in one pack (price is per pack).
 */
// A Thai letter right after the unit means it is the start of a word ("5 ลูก", "กกระดาษ"), not a unit.
const NOT_THAI = '(?![\\u0E00-\\u0E7F])';
const CONTENT = [
    { re: new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:มล\\.?|มิลลิลิตร|ซีซี|ml|cc)(?![a-z])`, 'i'), unit: 'ml', mul: 1 },
    { re: new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:ลิตร|ล\\.|ล${NOT_THAI}|l)(?![a-z])`, 'i'), unit: 'ml', mul: 1000 },
    { re: new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:กก\\.?|ก\\.ก\\.?|กิโลกรัม|กิโล${NOT_THAI}|kg)(?![a-z])`, 'i'), unit: 'g', mul: 1000 },
    { re: new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:กรัม|ก\\.|ก${NOT_THAI}|gm|g)(?![a-z])`, 'i'), unit: 'g', mul: 1 },
];

// Words that count things in a pack ("100 ชิ้น", "30 ฟอง", "12 ขวด", "5 ห่อ"). Sheets (แผ่น) are left out:
// "150 แผ่น" on tissue is the size of one box, not how many boxes the pack holds.
const COUNT_WORDS = 'ชิ้น|ใบ|อัน|ซอง|ถุง|ขวด|กระป๋อง|ฟอง|เส้น|ห่อ|แพ็ค|แพค|ม้วน|คู่|ลูก|ก้อน|กล่อง|หลอด|ถ้วย|แท่ง|ชุด';
const COUNT_RE = new RegExp(`(\\d+)(?:\\s*\\+\\s*(\\d+))?\\s*(${COUNT_WORDS})`, 'g');
// "x 50", "X 6", "x 5+1", "(1x24)"; a number with a decimal or an area / length after it is a size, not a count
const TIMES_RE = new RegExp(`[x×X*]\\s*(\\d+)(?:\\s*\\+\\s*(\\d+))?(?![\\d.,])(?!\\s*(?:ตร|ซม|มม|นิ้ว|cm|mm|ม\\.|เมตร|ฟุต))(?:\\s*(?:${COUNT_WORDS}))?`, 'g');
// Sizes printed on bags, boxes and foil: "12X17 ซม.", "24x28 นิ้ว", "5*9", "18 นิ้ว", "37.5 ตรฟ.", "90 ม."
const SIZE_RES = [
    /\d+(?:[.,]\d+)?\s*"?\s*[x×X*]\s*\d+(?:[.,]\d+)?\s*(?:ซม\.?|cm|มม\.?|mm|นิ้ว|")?/gi,
    /\d+(?:[.,]\d+)?\s*(?:ตรฟ\.?|ตารางฟุต|ตร\.?ม\.?|ซม\.?|มม\.?|นิ้ว|cm|mm|ม\.|เมตร)/gi,
];

// Disposable packaging: a volume in its title is its capacity
const PACKAGING_RE = /กล่อง(?:กระดาษ|อาหาร|ข้าว|พลาสติก|ใส่)|ถ้วย|แก้ว(?:น้ำ|น้ํา|พลาสติก|กระดาษ|พีพี|จัมโบ้|ร้อน|เย็น)|ชาม|จาน|ฝาโดม|ฝาถ้วย|ฝาแก้ว/;

const toNumber = (s) => {
    const str = String(s);
    return /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(str) ? Number(str.replace(/,/g, '')) : Number(str.replace(',', '.'));
};

/** The title without the sizes printed on bags, boxes and foil, so they are not read as counts. */
function stripSizes(title) {
    // Keep "(1x24)" style counts: a pair with no length unit after it and a small first number is a count
    return SIZE_RES.reduce((text, re) => text.replace(re, (m) => (/^\s*1\s*[x×X*]/.test(m) && !/[^\d\s.x×X*,]/.test(m) ? m : ' ')), String(title));
}

/**
 * How many items one purchase holds. Every count in the title multiplies:
 * "100 ชิ้น 5 ห่อ" = 500, "215 ชิ้น x 10" = 2,150, "30 ฟอง x 5" = 150, "1 ล. 12 ขวด" = 12 bottles.
 * The unitSize from makro ("150 ชิ้น") is used only when the title has no count.
 */
function countPerPack(title, unitSize) {
    let text = stripSizes(title);
    let count = 1;
    let found = false;
    text = text.replace(TIMES_RE, (m, a, b) => {
        count *= Number(a) + (b ? Number(b) : 0);
        found = true;
        return ' ';
    });
    const counts = [...text.matchAll(COUNT_RE)].map(m => ({ n: Number(m[1]) + (m[2] ? Number(m[2]) : 0), word: m[3] }));
    const pieces = counts.some(c => c.word !== 'คู่') ? counts.filter(c => c.word !== 'คู่') : counts;
    for (const c of pieces) {
        if (c.n > 0) {
            count *= c.n;
            found = true;
        }
    }
    if (found && count > 0) return count;
    const u = String(unitSize || '').match(/(\d+)/);
    if (u && Number(u[1]) > 1) return Number(u[1]);
    return 1;
}

/** What one item is sold in, from the words of the title. */
function containerOf(title, contentUnit) {
    const t = String(title);
    if (/แกลลอน|แกลอน|gallon/i.test(t)) return 'bottle';
    if (/ขวด/.test(t)) return 'bottle';
    if (/กระป๋อง/.test(t)) return 'can';
    if (/กล่อง/.test(t)) return 'box';
    if (/ถุง|ซอง/.test(t)) return 'bag';
    return contentUnit === 'ml' ? 'bottle' : 'bag';
}

export function parseMakroUnits(title = '', unitSize = '') {
    const text = String(title);
    const count = countPerPack(text, unitSize);

    // Content per item (volume or weight); "ออนซ์" on cups is a cup size, not content, so it is ignored,
    // and so is "725 มล." on boxes, cups and bowls (how much they hold). makro's unitSize ("1 kg") is
    // the fallback for meat and produce priced per kilo.
    let content = null;
    const sized = stripSizes(text);
    for (const source of [sized, String(unitSize || '')]) {
        for (const c of CONTENT) {
            const m = source.match(c.re);
            if (m) { content = { unit: c.unit, qty: toNumber(m[1]) * c.mul }; break; }
        }
        if (content) break;
    }
    if (content && content.unit === 'ml' && PACKAGING_RE.test(text)) content = null;

    if (content && content.qty > 0) {
        const factor = Math.round(content.qty * count * 1000) / 1000;
        const packUnit = count > 1 ? 'pack' : containerOf(text, content.unit);
        const packLabel = { pack: 'แพ็ค', bottle: 'ขวด', bag: 'ถุง', can: 'กระป๋อง', box: 'กล่อง' }[packUnit];
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

/** True when an item's units were never really set up (counted 1:1 in a generic count unit). */
export function unitsLookUnset(item = {}) {
    const usage = item.usage_unit || 'unit';
    return Number(item.conversion_factor || 1) === 1 && ['unit', 'pcs', 'pack'].includes(usage);
}

/**
 * What picking a makro.pro product changes on a stock item form: always the price; the photo
 * when the item has none; the units when they were never set up, or when makro's usage unit is
 * the one the item already uses (then only the pack size changes, so recipe quantities keep
 * their meaning).
 * @returns {{ patch: object, units: object|null, appliedUnits: boolean, appliedImage: boolean }}
 */
export function makroPickPatch(product = {}, current = {}, { unitsUnset = unitsLookUnset(current) } = {}) {
    const units = parseMakroUnits(product.title, product.unitSize);
    const patch = {};
    if (Number.isFinite(Number(product.price))) patch.cost_price = Number(product.price);
    const appliedImage = Boolean(product.image && !current.image_url);
    if (appliedImage) patch.image_url = product.image;
    const appliedUnits = Boolean(units && (unitsUnset || units.usageUnit === current.usage_unit));
    if (appliedUnits) {
        Object.assign(patch, {
            pack_size: 1,
            pack_unit: units.packUnit,
            usage_unit: units.usageUnit,
            conversion_factor: units.conversionFactor
        });
    }
    return { patch, units, appliedUnits, appliedImage };
}

/** One-line Thai summary of what a pick filled in, for a toast or a note under the form. */
export function describeMakroPick(product, { units, appliedUnits, appliedImage }) {
    const parts = [`ราคา ฿${Number(product.price).toLocaleString('th-TH')}`];
    if (appliedUnits) parts.push(units.summary);
    if (appliedImage) parts.push('รูป');
    let text = `ใส่${parts.join(' · ')} จาก makro แล้ว`;
    if (units && !appliedUnits) text += ` · makro ระบุ ${units.summary} ถ้าไม่ตรงกับหน่วยของรายการนี้ ให้แก้เอง`;
    return text;
}
