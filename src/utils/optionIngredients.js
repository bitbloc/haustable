/**
 * Option choice -> stock ingredients (table option_choice_ingredients).
 *
 * A row says what choosing an option adds (quantity > 0) or takes away
 * (quantity < 0) per ordered item, in the stock item's usage_unit.
 * menu_item_id null = every menu; rows for a specific menu replace the
 * generic rows of that choice for that menu (see stock_requirements_for_sale).
 */

const toNum = (v) => {
    if (v === '' || v === null || v === undefined) return NaN;
    if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
    const raw = String(v).trim().replace(/−/g, '-');
    if (raw === '') return NaN;
    // Support both "1,000" (thousands) and "0,5" / "2,5" (regional decimal comma)
    const normalized = /^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)
        ? raw.replace(/,/g, '')
        : (raw.includes(',') && !raw.includes('.') ? raw.replace(',', '.') : raw.replace(/,/g, ''));
    const n = Number(normalized);
    return Number.isFinite(n) ? n : NaN;
};

const scopeKey = (row) => {
    const scope = row.menu_item_id ?? 'all';
    const target = row.linked_menu_item_id != null
        ? `menu:${row.linked_menu_item_id}`
        : `stock:${row.stock_item_id}`;
    return `${scope}:${target}`;
};

/**
 * Parse a raw string typed into an option ingredient amount field.
 * Leading "-" / "−" switches sign to "minus"; leading "+" switches to "plus".
 * Keeps partial decimal entry (e.g. "0.", ".5", "1,5") intact while typing.
 */
export const parseOptionAmountInput = (raw, currentSign = 'plus') => {
    const str = String(raw ?? '').trimStart();
    let sign = currentSign === 'minus' ? 'minus' : 'plus';
    let rest = str;
    if (rest.startsWith('-') || rest.startsWith('−')) {
        sign = 'minus';
        rest = rest.slice(1);
    } else if (rest.startsWith('+')) {
        sign = 'plus';
        rest = rest.slice(1);
    }
    const cleaned = rest.replace(/[^0-9.,]/g, '');
    return { sign, amount: cleaned };
};

/**
 * Step an option ingredient amount up or down by `delta` (default 1), clamped at 0.
 * Empty input starts from 0 so tapping "+" sets "1".
 */
export const stepOptionAmount = (raw, delta = 1) => {
    const current = toNum(raw);
    const start = Number.isFinite(current) ? Math.abs(current) : 0;
    const next = Math.max(0, start + (Number(delta) || 0));
    return String(Math.round(next * 10000) / 10000);
};

/** Signed quantity from the editor's sign + magnitude fields, rounded like the column (4 dp). */
export const signedQuantity = (sign, amount) => {
    const n = toNum(amount);
    if (!Number.isFinite(n)) return NaN;
    const q = Math.round(Math.abs(n) * 10000) / 10000;
    return sign === 'minus' ? -q : q;
};

/** Check the editor rows; returns { rows, errors } where errors is keyed by row key. */
export const validateChoiceIngredients = (draft = []) => {
    const errors = {};
    const seen = new Map();
    const rows = [];
    for (const d of draft) {
        const quantity = signedQuantity(d.sign, d.amount);
        const hasStock = Boolean(d.stock_item_id);
        const hasLinkedMenu = d.linked_menu_item_id !== null && d.linked_menu_item_id !== undefined && d.linked_menu_item_id !== '';
        if (!hasStock && !hasLinkedMenu) {
            errors[d.key] = 'เลือกวัตถุดิบหรือเมนู';
        } else if (!Number.isFinite(quantity) || quantity === 0) {
            errors[d.key] = 'ใส่จำนวนมากกว่า 0';
        } else {
            const row = {
                id: d.id || null,
                stock_item_id: hasStock ? d.stock_item_id : null,
                ...(hasLinkedMenu ? { linked_menu_item_id: Number(d.linked_menu_item_id) } : {}),
                // Choices of the linked menu that are always deducted with its recipe
                ...(hasLinkedMenu && Array.isArray(d.linked_choice_ids)
                    ? { linked_choice_ids: [...new Set(d.linked_choice_ids)] }
                    : {}),
                menu_item_id: d.menu_item_id ?? null,
                quantity
            };
            const k = scopeKey(row);
            if (seen.has(k)) {
                errors[d.key] = hasLinkedMenu ? 'เมนูนี้ซ้ำในขอบเขตเดียวกัน' : 'วัตถุดิบนี้ซ้ำในขอบเขตเดียวกัน';
            } else {
                seen.set(k, true);
                rows.push(row);
            }
        }
    }
    return { rows, errors };
};

const sameIds = (a = [], b = []) => {
    const x = [...(a || [])].sort();
    const y = [...(b || [])].sort();
    return x.length === y.length && x.every((v, i) => v === y[i]);
};

/**
 * What to send to the database to turn `existing` rows into `rows`.
 * Deletes go first so removing and re-adding the same item never hits the unique index.
 */
export const planChoiceIngredientSave = (choiceId, existing = [], rows = []) => {
    const keep = new Set(rows.filter(r => r.id).map(r => r.id));
    const before = new Map(existing.map(e => [e.id, e]));
    const deletes = existing.filter(e => !keep.has(e.id)).map(e => e.id);
    const updates = [];
    const inserts = [];
    for (const r of rows) {
        const old = r.id ? before.get(r.id) : null;
        const payload = {
            choice_id: choiceId,
            stock_item_id: r.stock_item_id ?? null,
            ...(r.linked_menu_item_id != null || (old && old.linked_menu_item_id != null)
                ? { linked_menu_item_id: r.linked_menu_item_id ?? null }
                : {}),
            menu_item_id: r.menu_item_id,
            quantity: r.quantity,
            ...(Array.isArray(r.linked_choice_ids) ? { linked_choice_ids: r.linked_choice_ids } : {})
        };
        if (!old) {
            inserts.push(payload);
        } else if (
            (old.stock_item_id ?? null) !== (r.stock_item_id ?? null) ||
            (old.linked_menu_item_id ?? null) !== (r.linked_menu_item_id ?? null) ||
            (old.menu_item_id ?? null) !== (r.menu_item_id ?? null) ||
            Number(old.quantity) !== r.quantity ||
            (Array.isArray(r.linked_choice_ids) && !sameIds(old.linked_choice_ids, r.linked_choice_ids))
        ) {
            updates.push({ id: r.id, ...payload });
        }
    }
    return { deletes, updates, inserts };
};

/** Short summary for a choice card: "+1 ช็อต", "+1 ที่ ชาไทย (ร้อน,เย็น)", "2 วัตถุดิบ". */
export const summarizeChoiceIngredients = (rows = [], itemsById = new Map(), menusById = new Map()) => {
    if (!rows.length) return '';
    if (rows.length > 1) {
        const hasMenu = rows.some(r => r.linked_menu_item_id != null);
        const hasStock = rows.some(r => r.stock_item_id != null);
        if (hasMenu && !hasStock) return `${rows.length} เมนู`;
        if (hasMenu && hasStock) return `${rows.length} รายการ`;
        return `${rows.length} วัตถุดิบ`;
    }
    const r = rows[0];
    const q = Number(r.quantity);
    if (r.linked_menu_item_id != null) {
        const menu = menusById.get(Number(r.linked_menu_item_id)) || r.linked_menu;
        const menuName = menu?.name || `เมนู #${r.linked_menu_item_id}`;
        return `${q > 0 ? '+' : '−'}${Math.abs(q)} ที่ สูตรเมนู: ${menuName}`.replace(/\s+/g, ' ').trim();
    }
    const item = itemsById.get(r.stock_item_id);
    const unit = item?.usage_unit || item?.unit || '';
    const name = item?.name || 'วัตถุดิบ';
    return `${q > 0 ? '+' : '−'}${Math.abs(q)} ${unit} ${name}`.replace(/\s+/g, ' ').trim();
};
