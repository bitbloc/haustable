/**
 * Recompute the sale shadow of past order lines with today's recipes
 * (database function recompute_sale_stock_shadow, shadow mode only).
 *
 * A sale records what it used when the line is written. A recipe entered or corrected
 * later does not reach the lines already sold until someone asks for it here.
 */
import { supabase } from '../lib/supabaseClient';

/** Stock reports look back this far. */
export const RECOMPUTE_DAYS = 30;

const DAY_MS = 864e5;

/** Why the database refused, in the shop's words. */
export const recomputeRefusal = (data) => {
    if (data?.code === 'NOT_SHADOW') {
        return data.mode === 'live'
            ? 'ระบบตัดสต๊อกจริงอยู่ ยอดใช้ของบิลเก่าคำนวณใหม่ไม่ได้'
            : 'ระบบคำนวณยอดใช้จากยอดขายปิดอยู่';
    }
    if (data?.code === 'NO_PERIOD') return 'ไม่ได้ระบุช่วงเวลา';
    return 'ฐานข้อมูลไม่รับคำสั่ง';
};

/** One call to the database. Never throws: { ok, lines, errors, message }. */
const callRecompute = async (params) => {
    try {
        const { data, error } = await supabase.rpc('recompute_sale_stock_shadow', params);
        if (error) return { ok: false, lines: 0, errors: 0, message: error.message || 'เรียกฐานข้อมูลไม่สำเร็จ' };
        if (!data?.success) return { ok: false, lines: 0, errors: 0, message: recomputeRefusal(data) };
        return { ok: true, lines: Number(data.lines) || 0, errors: Number(data.errors) || 0, message: '' };
    } catch (err) {
        return { ok: false, lines: 0, errors: 0, message: err?.message || 'เรียกฐานข้อมูลไม่สำเร็จ' };
    }
};

/** The sold lines of one menu (and of options that deduct that menu's recipe). */
export const recomputeMenuShadow = (menuId, days = RECOMPUTE_DAYS, now = Date.now()) => callRecompute({
    p_from: new Date(now - days * DAY_MS).toISOString(),
    p_menu_item_id: menuId
});

/**
 * Day windows covering the last `days` days, oldest first. The last one is open-ended
 * (to: null) so a sale written while the run is going is not left out.
 */
export const recomputeWindows = (days = RECOMPUTE_DAYS, now = Date.now()) => {
    const start = now - days * DAY_MS;
    return Array.from({ length: days }, (_, i) => ({
        from: new Date(start + i * DAY_MS).toISOString(),
        to: i === days - 1 ? null : new Date(start + (i + 1) * DAY_MS).toISOString()
    }));
};

/**
 * Every sold line of the last `days` days, one day per call so no call runs long.
 * Stops at the first day that fails: { ok, lines, errors, daysDone, days, message }.
 */
export const recomputeAllShadow = async (days = RECOMPUTE_DAYS, onProgress = null, now = Date.now()) => {
    const windows = recomputeWindows(days, now);
    let lines = 0;
    let errors = 0;
    for (let i = 0; i < windows.length; i++) {
        onProgress?.(i, windows.length);
        const res = await callRecompute({ p_from: windows[i].from, p_to: windows[i].to });
        if (!res.ok) return { ok: false, lines, errors, daysDone: i, days: windows.length, message: res.message };
        lines += res.lines;
        errors += res.errors;
    }
    onProgress?.(windows.length, windows.length);
    return { ok: true, lines, errors, daysDone: windows.length, days: windows.length, message: '' };
};
