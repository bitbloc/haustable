import { supabase } from '../lib/supabaseClient';

/**
 * Single client entry point for changing a stock quantity.
 * Calls the post_stock_movement RPC, which locks the item, applies the change and
 * writes one ledger row (signed change + balance after) in the same transaction.
 *
 * mode 'delta' -> quantity is a signed change; mode 'set' -> quantity is the counted total.
 *
 * Returns { ok, data, error, rpcMissing }. rpcMissing is true only when the database
 * does not have the RPC yet (migration 20261113120000 not applied), so callers can
 * fall back to the previous write path instead of failing.
 */
export const STOCK_REASONS = Object.freeze({
    OPENING: 'opening',
    PURCHASE: 'purchase',
    SALE: 'sale',
    SALE_VOID: 'sale_void',
    WASTE: 'waste',
    STAFF_MEAL: 'staff_meal',
    PRODUCTION_IN: 'production_in',
    PRODUCTION_OUT: 'production_out',
    TRANSFER: 'transfer',
    COUNT_ADJUST: 'count_adjust',
    ADJUST: 'adjust'
});

// PGRST202: function not in PostgREST schema cache. 42883: undefined_function in Postgres.
const isRpcMissing = (error) =>
    !!error && (error.code === 'PGRST202' || error.code === '42883' ||
        /could not find the function|does not exist/i.test(error.message || ''));

export const postStockMovement = async ({
    itemId,
    mode,
    quantity,
    reason = null,
    performedBy = 'Staff',
    note = null,
    refType = null,
    refId = null,
    shiftId = null,
    occurredAt = null
}) => {
    const qty = Number(Number(quantity).toFixed(4));
    if (!itemId || !['delta', 'set'].includes(mode) || !Number.isFinite(qty)) {
        return { ok: false, data: null, error: new Error('postStockMovement: invalid arguments'), rpcMissing: false };
    }

    const { data, error } = await supabase.rpc('post_stock_movement', {
        p_item_id: itemId,
        p_mode: mode,
        p_quantity: qty,
        p_reason: reason,
        p_performed_by: performedBy,
        p_note: note,
        p_ref_type: refType,
        p_ref_id: refId != null ? String(refId) : null,
        p_shift_id: shiftId,
        p_occurred_at: occurredAt
    });

    if (error) {
        return { ok: false, data: null, error, rpcMissing: isRpcMissing(error) };
    }
    return { ok: true, data, error: null, rpcMissing: false };
};
