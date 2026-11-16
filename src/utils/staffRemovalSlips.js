// POS side of the staff phone remote: print the cancel / reduce slip for an item a waiter removed
// from a bill on their phone. The phone cannot print; the POS terminal holds the printer.
// Removals wait in order_item_removals (source = 'staff_remote') until a terminal claims them,
// prints and settles the claim. See supabase/migrations/20261116124000_staff_adjust_order_item.sql
import { supabase } from '../lib/supabaseClient';
import { getPosDeviceId } from './printClaim';

const RPC_RETRY_MS = 10 * 60 * 1000;
let running = false;
let rpcMissingAt = 0;

const REASON_LABELS = { not_made: 'ยังไม่ได้ทำ', made_wasted: 'ทำแล้ว ต้องทิ้ง' };

/** The slip payload autoPrintQROrder expects, for one phone removal. Same wording as the POS's own change slips. */
export function buildRemovalSlipBooking(row) {
    const removed = Number(row?.quantity_removed) || 0;
    const left = Number(row?.quantity_after) || 0;
    const baseName = row?.item_name || 'รายการ';
    const tag = left === 0 ? '[ยกเลิกรายการ]' : '[ลดจำนวน]';
    const taggedName = `${tag} ${baseName}`;
    const destination = row?.destination || 'kitchen';
    const categoryName = destination === 'bar' ? 'เครื่องดื่ม' : 'อาหาร';
    const note = [
        left === 0 ? `ยกเลิกรายการทั้งหมด (-${removed} ชิ้น)` : `ลดจำนวน -${removed} ชิ้น (คงเหลือ ${left} ชิ้น)`,
        REASON_LABELS[row?.reason] || '',
        row?.note || '',
        row?.removed_by ? `โดย ${row.removed_by} (มือถือ)` : 'จากมือถือพนักงาน',
    ].filter(Boolean).join(' | ');

    return {
        id: row?.booking_id || `removal_${row?.id}`,
        table_id: null,
        tables_layout: row?.table_name ? { table_name: row.table_name } : null,
        booking_type: 'walk_in',
        pax: 1,
        customer_name: 'Walk-in Guest',
        created_at: row?.removed_at || new Date().toISOString(),
        order_items: [{
            id: `removal_${row?.id}`,
            booking_id: row?.booking_id || null,
            menu_item_id: row?.menu_item_id ?? null,
            quantity: removed,
            price_at_time: Number(row?.unit_price) || 0,
            price: Number(row?.unit_price) || 0,
            selected_options: Array.isArray(row?.selected_options) ? row.selected_options : [],
            item_note: note,
            name: taggedName,
            custom_name: taggedName,
            destination,
            is_custom: false,
            category_name: categoryName,
            menu_items: { name: taggedName, menu_categories: { name: categoryName } },
        }],
    };
}

/**
 * Claim, print and settle every waiting phone removal. Never throws.
 * @param {(booking: object) => Promise<boolean>} printSlip resolves true when the slip came out
 * @returns {{ printed: object[], failed: object[] }} the removal rows, by outcome
 */
export async function printStaffRemovalSlips(printSlip) {
    const outcome = { printed: [], failed: [] };
    if (running || typeof printSlip !== 'function') return outcome;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return outcome;
    if (rpcMissingAt && Date.now() - rpcMissingAt < RPC_RETRY_MS) return outcome;

    running = true;
    try {
        const device = getPosDeviceId();
        const { data, error } = await supabase.rpc('claim_staff_removal_slips', { p_device: device });
        if (error) {
            // Migration not applied yet: stop asking for a while
            if (/PGRST202|42883|could not find the function/i.test(`${error.code || ''} ${error.message || ''}`)) {
                rpcMissingAt = Date.now();
            }
            return outcome;
        }
        rpcMissingAt = 0;
        const rows = Array.isArray(data) ? data : [];

        for (const row of rows) {
            let ok = false;
            try {
                ok = (await printSlip(buildRemovalSlipBooking(row))) === true;
            } catch (err) {
                console.error('[StaffRemovalSlips] Print failed:', err);
            }
            (ok ? outcome.printed : outcome.failed).push(row);
        }

        const settle = (list, printed) => (list.length === 0
            ? Promise.resolve()
            : supabase.rpc('settle_staff_removal_slips', { p_ids: list.map(r => r.id), p_device: device, p_printed: printed }));
        await Promise.allSettled([settle(outcome.printed, true), settle(outcome.failed, false)]);
    } catch (err) {
        console.warn('[StaffRemovalSlips] Skipped:', err);
    } finally {
        running = false;
    }
    return outcome;
}

/** Test hook. */
export function __resetStaffRemovalSlips() {
    running = false;
    rpcMissingAt = 0;
}
