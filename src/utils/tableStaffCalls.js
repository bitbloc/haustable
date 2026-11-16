/**
 * Durable record of "call staff" from a table that has NO open bill.
 *
 * A table with a bill stores the call as a [CALL_STAFF] tag on its booking, so the POS safety
 * heartbeat can recover it. A free table had nothing to tag: the call was only a realtime
 * broadcast, and if the POS was offline or restarting at that instant it was lost while the
 * customer saw "staff called". These rows are the backup the heartbeat reads.
 *
 * Every function is best-effort: if the table does not exist yet (migration
 * 20261116235500_table_staff_calls.sql not applied) the POS simply keeps the old behaviour.
 */
import { supabase } from '../lib/supabaseClient';

const OPEN_CALL_WINDOW_MS = 30 * 60 * 1000;
const UNAVAILABLE_RETRY_MS = 10 * 60 * 1000;
let unavailableSince = 0;

function isAvailable() {
    return !unavailableSince || Date.now() - unavailableSince > UNAVAILABLE_RETRY_MS;
}

function noteResult(error) {
    if (!error) {
        unavailableSince = 0;
        return;
    }
    const msg = `${error.code || ''} ${error.message || ''}`;
    // PGRST205 / 42P01: relation does not exist => migration not applied yet
    if (/PGRST205|42P01|could not find the table|does not exist/i.test(msg)) {
        unavailableSince = Date.now();
    }
}

/** Customer side: remember that this free table asked for staff. */
export async function recordTableStaffCall(tableId, tableName = null) {
    if (!tableId || !isAvailable()) return false;
    try {
        const { error } = await supabase
            .from('table_staff_calls')
            .insert({ table_id: tableId, table_name: tableName });
        noteResult(error);
        return !error;
    } catch (e) {
        return false;
    }
}

/**
 * POS side: calls from the last 30 minutes that nobody has acknowledged,
 * one per table (the most recent).
 */
export async function fetchOpenTableStaffCalls() {
    if (!isAvailable()) return [];
    try {
        const since = new Date(Date.now() - OPEN_CALL_WINDOW_MS).toISOString();
        const { data, error } = await supabase
            .from('table_staff_calls')
            .select('id, table_id, table_name, created_at')
            .is('cleared_at', null)
            .gte('created_at', since)
            .order('created_at', { ascending: false });
        noteResult(error);
        if (error || !data) return [];
        const seen = new Set();
        return data.filter(row => {
            const key = String(row.table_id);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    } catch (e) {
        return [];
    }
}

/** POS side: staff has seen the call for this table. */
export async function clearTableStaffCalls(tableId) {
    if (!tableId || !isAvailable()) return false;
    try {
        const { error } = await supabase
            .from('table_staff_calls')
            .update({ cleared_at: new Date().toISOString() })
            .eq('table_id', tableId)
            .is('cleared_at', null);
        noteResult(error);
        return !error;
    } catch (e) {
        return false;
    }
}

/** Test hook. */
export function __resetTableStaffCallsState() {
    unavailableSince = 0;
}
