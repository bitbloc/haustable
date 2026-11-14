/**
 * Kitchen / bar slip print de-duplication.
 *
 * Two layers decide whether an order item still needs a slip:
 *   1. Database (source of truth, shared by every device): order_items.kitchen_printed_at,
 *      claimed atomically through the claim_order_items_for_print RPC before printing.
 *   2. Per-device localStorage tracker (qr_printed_items_<bookingId>): fast pre-filter and
 *      the fallback when the device is offline or the migration is not applied yet.
 */
import { supabase } from '../lib/supabaseClient';

const TRACKER_PREFIX = 'qr_printed_items_';
const TRACKER_INDEX_KEY = 'qr_printed_items_index';
const TRACKER_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const DEVICE_ID_KEY = 'pos_device_id';

let memoryDeviceId = null;
// null = unknown, true = RPCs exist, false = migration not applied (stop calling for a while)
let rpcSupported = null;
let rpcUnsupportedAt = 0;
const RPC_RETRY_MS = 10 * 60 * 1000;

export function getPosDeviceId() {
    if (memoryDeviceId) return memoryDeviceId;
    try {
        const saved = localStorage.getItem(DEVICE_ID_KEY);
        if (saved) {
            memoryDeviceId = saved;
            return saved;
        }
    } catch (e) {}
    memoryDeviceId = `pos_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    try {
        localStorage.setItem(DEVICE_ID_KEY, memoryDeviceId);
    } catch (e) {}
    return memoryDeviceId;
}

/* ----------------------------- local tracker ----------------------------- */

const sameId = (a, b) => String(a) === String(b);

export function getLocallyPrintedIds(bookingId) {
    if (!bookingId) return [];
    try {
        const parsed = JSON.parse(localStorage.getItem(`${TRACKER_PREFIX}${bookingId}`) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function touchTrackerIndex(bookingId) {
    try {
        const index = JSON.parse(localStorage.getItem(TRACKER_INDEX_KEY) || '{}') || {};
        index[bookingId] = Date.now();
        localStorage.setItem(TRACKER_INDEX_KEY, JSON.stringify(index));
    } catch (e) {}
}

/**
 * Adds ids to a booking's tracker. Always re-reads the stored list first so a concurrent
 * writer (staff submit while an auto-print is in flight) is never overwritten.
 */
export function addLocallyPrintedIds(bookingId, ids = []) {
    const cleanIds = (ids || []).filter(id => id !== null && id !== undefined && id !== '');
    if (!bookingId || cleanIds.length === 0) return;
    try {
        const current = getLocallyPrintedIds(bookingId);
        const merged = [...current];
        cleanIds.forEach(id => {
            if (!merged.some(existing => sameId(existing, id))) merged.push(id);
        });
        localStorage.setItem(`${TRACKER_PREFIX}${bookingId}`, JSON.stringify(merged));
        touchTrackerIndex(bookingId);
    } catch (e) {
        console.warn('[PrintClaim] Could not update local print tracker:', e);
    }
}

export function filterLocallyUnprinted(bookingId, items = []) {
    const printed = getLocallyPrintedIds(bookingId);
    return (items || []).filter(item => item && item.id && !printed.some(id => sameId(id, item.id)));
}

/** Carries the printed ids of a merged-away bill over to the bill that received its items. */
export function carryOverLocallyPrinted(sourceBookingId, targetBookingId) {
    if (!sourceBookingId || !targetBookingId) return;
    addLocallyPrintedIds(targetBookingId, getLocallyPrintedIds(sourceBookingId));
}

/** Removes trackers not touched for 3 days so localStorage never fills up. */
export function pruneLocalPrintTracker(now = Date.now()) {
    try {
        const index = JSON.parse(localStorage.getItem(TRACKER_INDEX_KEY) || '{}') || {};
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(TRACKER_PREFIX) && key !== TRACKER_INDEX_KEY) keys.push(key);
        }
        let removed = 0;
        const liveIds = new Set();
        keys.forEach(key => {
            const bookingId = key.slice(TRACKER_PREFIX.length);
            liveIds.add(bookingId);
            if (!index[bookingId]) {
                // Legacy key written before the index existed: start its clock now.
                index[bookingId] = now;
            } else if (now - index[bookingId] > TRACKER_TTL_MS) {
                localStorage.removeItem(key);
                delete index[bookingId];
                liveIds.delete(bookingId);
                removed++;
            }
        });
        Object.keys(index).forEach(bookingId => {
            if (!liveIds.has(bookingId)) delete index[bookingId];
        });
        localStorage.setItem(TRACKER_INDEX_KEY, JSON.stringify(index));
        return removed;
    } catch (e) {
        return 0;
    }
}

/* ------------------------------ database claim --------------------------- */

// order_items.id is a bigint; offline placeholders ("local_item_...") never reach the DB.
const toDbIds = (ids = []) => (ids || [])
    .map(id => (typeof id === 'number' ? id : (/^\d+$/.test(String(id)) ? Number(id) : null)))
    .filter(id => id !== null && Number.isSafeInteger(id));

function canCallRpc() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    if (rpcSupported === false && Date.now() - rpcUnsupportedAt < RPC_RETRY_MS) return false;
    return true;
}

function noteRpcResult(error) {
    if (!error) {
        rpcSupported = true;
        return;
    }
    const msg = `${error.code || ''} ${error.message || ''}`;
    // PGRST202 / 42883: function does not exist => migration not applied yet.
    if (/PGRST202|42883|could not find the function|does not exist/i.test(msg)) {
        rpcSupported = false;
        rpcUnsupportedAt = Date.now();
    }
}

/** True when the item row itself says a slip was already printed (any device). */
export const isDbPrinted = (item) => Boolean(item && item.kitchen_printed_at);

/**
 * Atomically claims items for printing on this device.
 * @returns {{ claimedIds: Array, authoritative: boolean }}
 *   authoritative=true  -> only print claimedIds (another device owns the rest)
 *   authoritative=false -> DB unavailable; caller falls back to the local tracker (print all)
 */
export async function claimItemsForPrint(ids = []) {
    const dbIds = toDbIds(ids);
    const nonDbIds = (ids || []).filter(id => !dbIds.some(d => sameId(d, id)));
    if (dbIds.length === 0 || !canCallRpc()) {
        return { claimedIds: [...(ids || [])], authoritative: false };
    }
    try {
        const { data, error } = await supabase.rpc('claim_order_items_for_print', {
            p_item_ids: dbIds,
            p_device: getPosDeviceId()
        });
        noteRpcResult(error);
        if (error) return { claimedIds: [...(ids || [])], authoritative: false };
        const won = (data || []).map(row => (row && typeof row === 'object' ? (row.id ?? Object.values(row)[0]) : row));
        return { claimedIds: [...won, ...nonDbIds], authoritative: true };
    } catch (e) {
        return { claimedIds: [...(ids || [])], authoritative: false };
    }
}

async function callBestEffort(fn, ids) {
    const dbIds = toDbIds(ids);
    if (dbIds.length === 0 || !canCallRpc()) return false;
    try {
        const { error } = await supabase.rpc(fn, { p_item_ids: dbIds, p_device: getPosDeviceId() });
        noteRpcResult(error);
        return !error;
    } catch (e) {
        return false;
    }
}

/** Records that slips for these items were printed (shared with every device). */
export const markItemsPrinted = (ids = []) => callBestEffort('mark_order_items_printed', ids);

/** Gives a claim back after a failed print so the next attempt can retry. */
export const releasePrintClaim = (ids = []) => callBestEffort('release_order_items_print_claim', ids);

/** Test hook. */
export function __resetPrintClaimState() {
    memoryDeviceId = null;
    rpcSupported = null;
    rpcUnsupportedAt = 0;
}
