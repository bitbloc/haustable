import { supabase } from '../lib/supabaseClient';

/**
 * Why an item that was already sent to the kitchen / bar leaves the bill.
 *   not_made     nothing was used; the sale's stock usage is simply returned
 *   made_wasted  it was made and thrown away; its ingredients count as waste
 * See supabase/migrations/20261115120000_order_item_removal_reasons.sql
 */
export const REMOVAL_REASONS = Object.freeze([
    { key: 'not_made', label: 'ยังไม่ได้ทำ', hint: 'คืนวัตถุดิบ' },
    { key: 'made_wasted', label: 'ทำแล้ว ต้องทิ้ง', hint: 'ลงเป็นของเสีย' }
]);

const isMissingRpc = (error) => {
    const text = `${error?.code || ''} ${error?.message || ''}`;
    return /PGRST202|42883|Could not find the function/i.test(text);
};

/**
 * Record a removal before the bill row is deleted or its quantity lowered.
 * Never throws: the bill change must go ahead even when this cannot be saved.
 * Returns { ok, removalId, rpcMissing, error }.
 */
export const logOrderItemRemoval = async ({ orderItemId, newQuantity, reason, removedBy = null, note = null }) => {
    const id = Number(String(orderItemId ?? '').replace(/^db_/, ''));
    if (!Number.isFinite(id) || id <= 0 || !REMOVAL_REASONS.some(r => r.key === reason)) {
        return { ok: false, removalId: null, rpcMissing: false, error: new Error('invalid removal') };
    }
    try {
        const { data, error } = await supabase.rpc('log_order_item_removal', {
            p_order_item_id: id,
            p_new_quantity: Math.max(0, Number(newQuantity) || 0),
            p_reason: reason,
            p_removed_by: removedBy,
            p_note: note
        });
        if (error) return { ok: false, removalId: null, rpcMissing: isMissingRpc(error), error };
        return { ok: true, removalId: data?.removal_id ?? null, rpcMissing: false, error: null };
    } catch (error) {
        return { ok: false, removalId: null, rpcMissing: false, error };
    }
};

/** Undo a logged removal whose bill change did not go through. Never throws. */
export const cancelOrderItemRemoval = async (removalId) => {
    if (!removalId) return false;
    try {
        const { data, error } = await supabase.rpc('cancel_order_item_removal', { p_removal_id: removalId });
        return !error && data?.success === true;
    } catch {
        return false;
    }
};
