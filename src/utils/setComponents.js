/**
 * Set menus (table menu_set_components).
 *
 * A set is made of other menus: selling it deducts `quantity` servings of each component's
 * own recipe, plus the stock rules of the option choices the set fixes on that component
 * (database function stock_requirements_for_sale). The same reading gives the set its cost.
 */

const toNum = (v) => {
    if (v === '' || v === null || v === undefined) return NaN;
    const n = Number(String(v).trim().replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
};

const round4 = (n) => Math.round(n * 10000) / 10000;

const isTakeawayOnly = (row) => (row?.order_scope || 'all') === 'takeaway';

/**
 * Cost of recipe rows ({ ingredient_id, quantity, order_scope }) at `unitCostOf(stockId)`.
 * Takeaway-only packaging is kept apart from the dine-in cost, as on the Menu Cost page.
 */
export const recipeRowsCost = (rows = [], unitCostOf = () => 0) => {
    let cost = 0;
    let takeawayExtraCost = 0;
    for (const row of rows || []) {
        if (!row || !row.ingredient_id) continue;
        const line = (Number(unitCostOf(row.ingredient_id)) || 0) * (Number(row.quantity) || 0);
        if (isTakeawayOnly(row)) takeawayExtraCost += line;
        else cost += line;
    }
    return { cost, takeawayExtraCost };
};

/**
 * Stock rules of one choice on one menu: rows written for that menu replace the
 * "every menu" rows of the choice.
 */
export const rulesForChoice = (choiceId, menuId, ruleRows = []) => {
    const mine = (ruleRows || []).filter(r => r.choice_id === choiceId);
    const specific = mine.filter(r => r.menu_item_id !== null && r.menu_item_id !== undefined && String(r.menu_item_id) === String(menuId));
    return specific.length ? specific : mine.filter(r => r.menu_item_id === null || r.menu_item_id === undefined);
};

/** What the fixed choices add to (or take off) one serving, counting stock rules only. */
export const fixedChoicesCost = (choiceIds = [], menuId, ruleRows = [], unitCostOf = () => 0) => {
    let cost = 0;
    for (const choiceId of choiceIds || []) {
        for (const rule of rulesForChoice(choiceId, menuId, ruleRows)) {
            if (!rule.stock_item_id) continue;
            cost += (Number(unitCostOf(rule.stock_item_id)) || 0) * (Number(rule.quantity) || 0);
        }
    }
    return cost;
};

/**
 * Cost of a set from its components.
 *
 * @param components   rows { component_menu_item_id, quantity, choice_ids }
 * @param recipeRowsByMenu  { [menuId]: recipe rows } of the component menus
 * @param ruleRows     option_choice_ingredients rows of the fixed choices
 * @returns {{ lines: Array<{menuId, quantity, unitCost, total, hasRecipe}>, cost: number, takeawayExtraCost: number }}
 */
export const setComponentsCost = (components = [], { recipeRowsByMenu = {}, ruleRows = [], unitCostOf = () => 0 } = {}) => {
    const lines = [];
    let cost = 0;
    let takeawayExtraCost = 0;
    for (const c of components || []) {
        if (!c || c.component_menu_item_id === null || c.component_menu_item_id === undefined) continue;
        const menuId = c.component_menu_item_id;
        const rows = recipeRowsByMenu[String(menuId)] || [];
        const quantity = Number(c.quantity) || 0;
        const recipe = recipeRowsCost(rows, unitCostOf);
        const unitCost = recipe.cost + fixedChoicesCost(c.choice_ids, menuId, ruleRows, unitCostOf);
        const total = unitCost * quantity;
        cost += total;
        takeawayExtraCost += recipe.takeawayExtraCost * quantity;
        lines.push({ menuId, quantity, unitCost, total, hasRecipe: rows.length > 0 });
    }
    return { lines, cost, takeawayExtraCost };
};

/** Group component rows by the set they belong to: { [setMenuId]: rows in menu order }. */
export const componentsBySet = (rows = []) => {
    const map = {};
    for (const row of rows || []) {
        if (!row) continue;
        const key = String(row.set_menu_item_id);
        (map[key] = map[key] || []).push(row);
    }
    for (const key of Object.keys(map)) {
        map[key].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }
    return map;
};

/**
 * Check the editor rows ({ key, menuId, amount, choiceIds }) of one set.
 * Returns { rows, errors }: rows ready for save_menu_set_components, errors keyed by row key.
 */
export const validateSetComponents = (draft = [], setMenuId = null) => {
    const errors = {};
    const seen = new Set();
    const rows = [];
    for (const d of draft || []) {
        const quantity = toNum(d.amount);
        const menuId = d.menuId === null || d.menuId === undefined || d.menuId === '' ? null : Number(d.menuId);
        if (menuId === null || !Number.isFinite(menuId)) {
            errors[d.key] = 'เลือกเมนู';
        } else if (setMenuId !== null && String(menuId) === String(setMenuId)) {
            errors[d.key] = 'ใส่เซตนี้เป็นส่วนประกอบของตัวเองไม่ได้';
        } else if (!Number.isFinite(quantity) || quantity <= 0) {
            errors[d.key] = 'ใส่จำนวนมากกว่า 0';
        } else if (seen.has(menuId)) {
            errors[d.key] = 'เมนูนี้อยู่ในเซตแล้ว';
        } else {
            seen.add(menuId);
            rows.push({
                component_menu_item_id: menuId,
                quantity: round4(quantity),
                choice_ids: [...new Set(d.choiceIds || [])]
            });
        }
    }
    return { rows, errors };
};

/** Step a serving count up or down, never below 0. Empty starts from 0. */
export const stepServings = (raw, delta = 1) => {
    const current = toNum(raw);
    const start = Number.isFinite(current) ? current : 0;
    return String(round4(Math.max(0, start + (Number(delta) || 0))));
};

/** The database's refusal, in the shop's words. */
export const setSaveError = (message) => {
    const text = String(message || '');
    if (/SET_IN_SET/.test(text)) {
        return /already part of a set/.test(text)
            ? 'เมนูนี้เป็นส่วนประกอบของเซตอื่นอยู่ จึงตั้งเป็นเซตไม่ได้'
            : 'เมนูที่เลือกเป็นเซตอยู่แล้ว เซตซ้อนเซตไม่ได้ ให้ใส่เมนูเดี่ยวแทน';
    }
    return text || 'ฐานข้อมูลไม่รับคำสั่ง';
};
