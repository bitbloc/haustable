// What is wrong with how stock items are set up (units, cost, duplicates), in the order it hurts:
// first what bends menu cost and GP, then what makes counts and reorder points misleading.
// Pure: fed by the stock page's rows and a map of how many recipes use each item.
import { getUnitType } from './unitUtils';
import { displayUnit } from './stockCount';
import { usagePerStockUnit, unitCode } from './recipeGraph';

const lower = (v) => String(v ?? '').trim().toLowerCase();
const factorOf = (item) => Number(item?.conversion_factor) || 1;
const GENERIC = ['unit', 'pcs', ''];
const MEASURE = ['mass', 'volume'];

// Things that are counted, not weighed. The word must open the name: "ถ้วยน้ำจิ้ม" is a cup,
// "กุ้งขาว/กล่อง" is prawns that come in a box.
const PACKAGING_RE = /^\s*(ถุง|ถ้วย|ชาม|กล่อง|ชุดช้อน|ช้อน|ส้อม|หลอด|แก้ว|ฝา|ไส้กรอง|หนังยาง|แผ่น|ทิชชู่|ตะเกียบ|ไม้จิ้มฟัน)/;

const isMade = (item) => Boolean(item?.is_base_recipe) || lower(item?.item_type) === 'prep';

/** Bags, cups and cutlery set up by weight or volume. */
export const isPackagingByWeight = (item) =>
    MEASURE.includes(getUnitType(item?.pack_unit || item?.unit))
    && PACKAGING_RE.test(item?.name || '');

/** A converter that cannot be true: "1 กก. = 1,000 ชิ้น", "1 ชิ้น = 1,000 ขวด", "1 ขวด = 3 ขวด". */
export const hasBrokenFactor = (item) => {
    const pack = lower(item?.pack_unit || item?.unit);
    const usage = lower(item?.usage_unit);
    const f = factorOf(item);
    if (pack && pack === usage && f !== 1) return true;
    const packIsLoose = GENERIC.includes(pack) || MEASURE.includes(getUnitType(pack));
    return getUnitType(usage) === 'count' && f >= 100 && packIsLoose;
};

/** "1 ชิ้น = 1 กรัม": the whole pack's price becomes the price of one gram. */
export const isOneUnitOneGram = (item) =>
    GENERIC.includes(lower(item?.pack_unit)) && MEASURE.includes(getUnitType(item?.usage_unit)) && factorOf(item) === 1;

/** Never set up: counted 1:1 in a generic unit. */
export const unitsNeverSet = (item) =>
    GENERIC.includes(lower(item?.pack_unit)) && ['unit', 'pcs', 'pack', ''].includes(lower(item?.usage_unit)) && factorOf(item) === 1;

/** "1 กิโลกรัม = 1,000 กรัม": how an item is set up, in the words the form uses. */
export const unitLine = (item) => `1 ${displayUnit(item.pack_unit || item.unit || 'unit')} = ${factorOf(item).toLocaleString('th-TH')} ${displayUnit(item.usage_unit || 'unit')}`;

export const HEALTH_GROUPS = [
    {
        key: 'cost_in_recipe', urgent: true,
        title: 'อยู่ในสูตร แต่ต้นทุนเป็น 0',
        why: 'ต้นทุนเมนูและ GP ของสูตรที่ใช้รายการนี้ต่ำกว่าจริง',
        test: (item, recipes) => recipes > 0 && !isMade(item) && !(Number(item.cost_price) > 0),
    },
    {
        key: 'gram_per_unit', urgent: true,
        title: 'ตั้งว่า 1 ชิ้น = 1 กรัม (หรือ 1 มล.)',
        why: 'ราคาทั้งแพ็คถูกคิดเป็นราคาต่อกรัม ต้นทุนในสูตรจะสูงเกินจริงมาก ให้ใส่ว่าแพ็คหนึ่งมีกี่กรัม',
        test: (item) => !isMade(item) && isOneUnitOneGram(item),
    },
    {
        key: 'broken_factor', urgent: true,
        title: 'ตัวแปลงหน่วยเป็นไปไม่ได้',
        why: 'เช่น 1 กิโลกรัม = 1,000 ชิ้น จำนวนชิ้นและต้นทุนต่อชิ้นจะผิด',
        test: (item) => hasBrokenFactor(item),
    },
    {
        key: 'packaging_by_weight',
        title: 'บรรจุภัณฑ์ที่ตั้งเป็นน้ำหนัก',
        why: 'ถุง ถ้วย ช้อนส้อม ควรนับเป็นแพ็คและชิ้น กดราคากลาง makro ในฟอร์มเพื่อเปลี่ยนให้เอง',
        test: (item) => isPackagingByWeight(item),
    },
    {
        key: 'count_unit_differs',
        title: 'หน่วยนับไม่ตรงกับหน่วยซื้อ',
        why: 'จุดสั่งซื้อและป้าย "ควรสั่ง" อาจเตือนผิด',
        test: (item) => !isMade(item) && lower(item.unit) && lower(item.pack_unit) && unitCode(item.unit) !== unitCode(item.pack_unit),
    },
    {
        key: 'units_unset',
        title: 'ยังไม่ได้ตั้งหน่วย',
        why: 'ระบบไม่รู้ว่าแพ็คหนึ่งมีเท่าไร จึงแสดงจำนวนชิ้นและคิดต้นทุนต่อหน่วยไม่ได้',
        test: (item) => !isMade(item) && unitsNeverSet(item),
    },
    {
        key: 'cost_zero',
        title: 'ยังไม่ได้ใส่ราคาซื้อ',
        why: 'ยังไม่อยู่ในสูตรไหน แต่มูลค่าสต็อกและรายงานจะขาดรายการนี้',
        test: (item, recipes) => recipes === 0 && !isMade(item) && !(Number(item.cost_price) > 0),
    },
];

/** Items whose names differ only by a trailing "/แพ็ค", "/ขวด"… or by spacing and case. */
export function findDuplicateNames(items = []) {
    const keyOf = (name) => lower(name)
        .replace(/\s*\/\s*(แพ็ค|แพค|ขวด|ถุง|ซอง|กก|แกลอน|แกลลอน|ก้อน|ลูก|โหล|กล่อง|ม้วน|ฟอง|หัว)\s*$/, '')
        .replace(/\s+/g, '');
    const byKey = new Map();
    items.forEach(item => {
        const key = keyOf(item.name);
        if (!key) return;
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push(item);
    });
    return [...byKey.values()]
        .filter(group => group.length > 1)
        .map(group => [...group].sort((a, b) => String(a.name).localeCompare(String(b.name), 'th')))
        .sort((a, b) => String(a[0].name).localeCompare(String(b[0].name), 'th'));
}

/**
 * @param {object[]} items stock_items rows
 * @param {Record<string, number>} recipeCounts item id -> recipes that use it as an ingredient
 * @returns {{ groups: Array<{key,title,why,urgent,rows:Array<{item,recipes,detail}>}>, duplicates: object[][], urgentCount: number }}
 */
export function stockHealth(items = [], recipeCounts = {}) {
    const groups = HEALTH_GROUPS.map(g => ({
        key: g.key, title: g.title, why: g.why, urgent: Boolean(g.urgent),
        rows: items
            .filter(item => g.test(item, Number(recipeCounts[item.id]) || 0))
            .map(item => ({ item, recipes: Number(recipeCounts[item.id]) || 0, detail: unitLine(item) }))
            // what is in recipes first, then by name
            .sort((a, b) => (b.recipes - a.recipes) || String(a.item.name).localeCompare(String(b.item.name), 'th')),
    }));
    const urgentIds = new Set();
    groups.filter(g => g.urgent).forEach(g => g.rows.forEach(r => urgentIds.add(r.item.id)));
    return { groups, duplicates: findDuplicateNames(items), urgentCount: urgentIds.size };
}

/** Warnings for the item form, shown before saving. Never blocks the save. */
export function unitSetupWarnings(form = {}) {
    const out = [];
    if (hasBrokenFactor(form)) {
        out.push(`ตัวแปลงหน่วย "${unitLine(form)}" ดูไม่ถูก ตรวจหน่วยซื้อ หน่วยใช้ และตัวเลขอีกครั้ง`);
    } else if (isPackagingByWeight(form)) {
        out.push('ชื่อรายการนี้ดูเป็นบรรจุภัณฑ์ แต่ตั้งหน่วยเป็นน้ำหนักหรือปริมาตร ถ้านับเป็นชิ้น ให้ตั้งเป็นแพ็คและชิ้น หรือกดราคากลาง makro');
    } else if (!isMade(form) && isOneUnitOneGram(form) && Number(form.cost_price) > 0) {
        out.push('ตั้งไว้ว่า 1 ชิ้น = 1 กรัม (หรือ 1 มล.) ราคาที่ใส่จะถูกคิดเป็นราคาต่อกรัม ให้ใส่ว่าแพ็คหนึ่งมีกี่กรัม');
    }
    return out;
}

const MERGE_MESSAGES = {
    NOT_SIGNED_IN: 'หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่',
    NOT_ALLOWED: 'เฉพาะเจ้าของ แอดมิน หรือผู้จัดการ ที่รวมรายการได้',
    NOT_FOUND: 'ไม่พบรายการ อาจถูกลบหรือรวมไปแล้ว',
    SAME_ITEM: 'เลือกรายการเดียวกัน',
    UNITS_DIFFER: 'สองรายการนี้ตั้งหน่วยไม่เหมือนกัน ใส่ว่าหนึ่งหน่วยของรายการที่จะลบเท่ากับเท่าไรของรายการที่เก็บ',
    RECIPE_UNITS: 'รายการที่จะลบมีสูตรของตัวเองและตั้งหน่วยต่างกัน ให้เลือกเก็บรายการนั้นไว้แทน',
    BOTH_HAVE_RECIPES: 'ทั้งสองรายการมีสูตรของตัวเอง ให้ลบสูตรของรายการที่จะเลิกใช้ก่อน',
    OPTION_CONFLICT: 'ตัวเลือกเมนูบางตัวผูกกับทั้งสองรายการ ให้แก้ที่ตัวเลือกนั้นก่อน',
    NOT_INSTALLED: 'ระบบรวมรายการยังไม่ได้เปิดใช้ในฐานข้อมูล',
    UNKNOWN: 'รวมไม่สำเร็จ ข้อมูลยังเหมือนเดิม',
};

const stockUnitOf = (item) => lower(item?.unit || item?.pack_unit);

/** Same counting unit, recipe unit and converter: the two can be added as they are. */
// Same set-up only when one counted unit also holds the same amount: a 325 ml soda and a
// 1,250 ml soda are both bottles of ml, but merging them needs a ratio (same rule as SQL merge)
export const sameUnitSetup = (a, b) => stockUnitOf(a) === stockUnitOf(b)
    && lower(a?.usage_unit) === lower(b?.usage_unit)
    && factorOf(a) === factorOf(b)
    && Math.abs(usagePerStockUnit(a) - usagePerStockUnit(b)) < 1e-9;

const BASE = { g: ['mass', 1], kg: ['mass', 1000], ml: ['volume', 1], l: ['volume', 1000] };

/**
 * How many of the kept item's counting units one counting unit of the removed item is, when the
 * set-up says so: both are used by weight (or both by volume) and neither converter is one of the
 * impossible ones. "1 ถุง = 500 กรัม" into "1 กิโลกรัม = 1,000 กรัม" -> 0.5.
 * Returns null when a person has to say (pieces against grams, or a set-up that cannot be true).
 */
export function suggestMergeRatio(keep, remove) {
    if (sameUnitSetup(keep, remove)) return 1;
    const k = BASE[lower(keep?.usage_unit)];
    const g = BASE[lower(remove?.usage_unit)];
    if (!k || !g || k[0] !== g[0]) return null;
    if ([keep, remove].some(i => hasBrokenFactor(i) || isOneUnitOneGram(i))) return null;
    const ratio = (factorOf(remove) * g[1]) / (factorOf(keep) * k[1]);
    return Number.isFinite(ratio) && ratio > 0 ? Math.round(ratio * 10000) / 10000 : null;
}

/** Ratio typed by a person -> number, or null when empty or not above zero. */
export const parseRatio = (raw) => {
    const n = Number(String(raw ?? '').trim().replace(',', '.'));
    return String(raw ?? '').trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Units the converter may be answered in: the kept item's counting unit, plus the units that
 * convert into it for certain. Counted by weight -> kg and g. A bottle known to hold 700 ml ->
 * bottle, ml and l. A piece with no size -> only itself.
 */
export function ratioUnitOptions(keep) {
    const own = stockUnitOf(keep) || 'unit';
    const family = (kind) => Object.keys(BASE).filter(u => BASE[u][0] === kind);
    if (BASE[own]) return [own, ...family(BASE[own][0]).filter(u => u !== own)];
    const usage = BASE[lower(keep?.usage_unit)];
    if (usage && factorOf(keep) > 1 && !hasBrokenFactor(keep)) return [own, ...family(usage[0])];
    return [own];
}

/** A converter typed in one of ratioUnitOptions -> kept counting units, or null. */
export function ratioInKeepUnits(raw, unit, keep) {
    const n = parseRatio(raw);
    if (n === null) return null;
    const own = stockUnitOf(keep) || 'unit';
    const u = lower(unit) || own;
    if (u === own) return n;
    if (!ratioUnitOptions(keep).includes(u)) return null;
    const out = BASE[own]
        ? (n * BASE[u][1]) / BASE[own][1]
        : (n * BASE[u][1]) / (factorOf(keep) * BASE[lower(keep.usage_unit)][1]);
    return out > 0 ? Math.round(out * 1000000) / 1000000 : null;
}

/** The kept item's balance after the merge, in its own counting unit. */
export const mergedQuantity = (keep, others = [], ratios = {}) => Math.round(others.reduce(
    (sum, o) => sum + (Number(o.current_quantity) || 0) * (sameUnitSetup(keep, o) ? 1 : (Number(ratios[o.id]) || 0)),
    Number(keep?.current_quantity) || 0
) * 10000) / 10000;

/** Normalise a merge_stock_items answer into { ok, code, message, data }. */
export function readMergeResult({ data, error }) {
    if (error) {
        const text = `${error.code || ''} ${error.message || ''}`;
        const code = (error.code === 'PGRST202' || /could not find the function/i.test(text)) ? 'NOT_INSTALLED' : 'UNKNOWN';
        return { ok: false, code, message: MERGE_MESSAGES[code], data: null };
    }
    if (data?.success) return { ok: true, code: 'OK', message: '', data };
    const code = MERGE_MESSAGES[data?.code] ? data.code : 'UNKNOWN';
    return { ok: false, code, message: MERGE_MESSAGES[code], data: data || null };
}
