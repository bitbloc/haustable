/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Count sheet · theme: Thai Modern OKLCH */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabaseClient';
import { logStaffActivity } from '../../utils/auditLogger';
import { packCapacity } from '../../utils/stockUtils';
import {
    COUNT_KINDS, defaultCountKind, shopDayOf, displayUnit, parseCount, buildCountLines, addDays, carryOverClosing, stepCount,
    countsWholeUnits, splitQty, openLeftText, qtyInWords, diffInWords, mergeOpenLeft,
    countsInPieces, splitPieces, mergeLoosePieces
} from '../../utils/stockCount';
import { buildBarcodeIndex, resolveScan, createScanGate, addScanToCount, normalizeBarcode } from '../../utils/stockBarcode';
import ScanStrip from './ScanStrip';
import { preloadCodeDetector } from '../../utils/codeDetector';
import { rankVariance, shopDayRange, suggestSpotCount } from '../../utils/stockReports';
import { countUnitCost } from '../../utils/stockReceiving';
import BarcodeLinkSheet from './BarcodeLinkSheet';
import { linkBarcodeToItem } from '../../utils/stockBarcodeLink';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import * as ui from './stockUi';

const DRAFT_KEY = (day) => `stock_count_draft_v2:${day}`;
// Drafts from when the screen had three rounds; picked up once so nothing typed is lost.
const OLD_DRAFT_KEYS = (day) => ['opening', 'spot', 'closing'].map(k => `stock_count_draft_v1:${day}:${k}`);

const readDraft = (day) => {
    try {
        const raw = localStorage.getItem(DRAFT_KEY(day));
        if (raw) return JSON.parse(raw);
        return OLD_DRAFT_KEYS(day).reduce((all, key) => ({ ...all, ...JSON.parse(localStorage.getItem(key) || '{}') }), {});
    } catch {
        return {};
    }
};

const OPEN_KEY = (day) => `${DRAFT_KEY(day)}:open`;
const readOpenDraft = (day) => {
    try { return JSON.parse(localStorage.getItem(OPEN_KEY(day)) || '{}'); } catch { return {}; }
};
const writeOpenDraft = (day, openLeft) => {
    try {
        if (Object.keys(openLeft).length) localStorage.setItem(OPEN_KEY(day), JSON.stringify(openLeft));
        else localStorage.removeItem(OPEN_KEY(day));
    } catch { /* storage unavailable */ }
};

// Loose pieces typed beside the full packs (cups out of an opened pack), as typed.
const LOOSE_KEY = (day) => `${DRAFT_KEY(day)}:loose`;
const readLooseDraft = (day) => {
    try { return JSON.parse(localStorage.getItem(LOOSE_KEY(day)) || '{}'); } catch { return {}; }
};
const writeLooseDraft = (day, loose) => {
    try {
        if (Object.values(loose).some(v => String(v ?? '').trim() !== '')) localStorage.setItem(LOOSE_KEY(day), JSON.stringify(loose));
        else localStorage.removeItem(LOOSE_KEY(day));
    } catch { /* storage unavailable */ }
};

const writeDraft = (day, counts) => {
    try {
        OLD_DRAFT_KEYS(day).forEach(key => localStorage.removeItem(key));
        if (Object.values(counts).some(v => String(v ?? '').trim() !== '')) {
            localStorage.setItem(DRAFT_KEY(day), JSON.stringify(counts));
        } else {
            localStorage.removeItem(DRAFT_KEY(day));
        }
    } catch { /* storage unavailable: counting still works */ }
};


const loadItems = async () => {
    // select('*') so the screen works before and after newer columns (track_mode) exist
    const { data, error } = await supabase
        .from('stock_items')
        .select('*')
        .order('name');
    if (error) throw error;
    return (data || []).filter(i =>
        (i.item_type ?? 'raw') === 'raw' || (i.item_type === 'prep' && (i.prep_mode ?? 'stocked') === 'stocked'))
        .filter(i => (i.track_mode ?? 'weekly') !== 'none');
};

// Extra barcodes (other brands, cases). Empty when the table is not installed yet.
const loadExtraBarcodes = async () => {
    const { data, error } = await supabase.from('stock_item_barcodes').select('barcode, stock_item_id, units_per_scan');
    return error ? [] : (data || []);
};

const scanFeedback = (ok) => {
    try { navigator.vibrate?.(ok ? 35 : [60, 60, 60]); } catch { /* not supported (iPhone) */ }
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        scanFeedback.ctx = scanFeedback.ctx || new Ctx();
        const ctx = scanFeedback.ctx;
        if (ctx.state === 'suspended') ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = ok ? 1320 : 330;
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.13);
    } catch { /* sound is optional */ }
};

const capacityOf = packCapacity;

// Count fields: 16px so phones do not zoom on focus; border colour is added per state.
const numInput = `h-11 px-2 rounded-md border ${ui.PAPER} ${ui.INK} text-base font-semibold tabular-nums text-right outline-none transition-colors focus:border-[oklch(18%_0.012_28)] placeholder:font-normal placeholder:text-[oklch(62%_0.010_28)]`;
const stepBtn = `w-11 h-11 shrink-0 rounded-md border ${ui.RULE} ${ui.PAPER} text-xl leading-none ${ui.INK} flex items-center justify-center select-none touch-manipulation transition-[background-color,border-color,transform] hover:bg-[oklch(94%_0.010_28)] hover:border-[oklch(42%_0.010_28)] active:scale-95 cursor-pointer`;
const smallPrimary = 'h-9 px-3 rounded-md bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] text-sm font-semibold whitespace-nowrap transition-colors hover:bg-[oklch(25%_0.012_28)] cursor-pointer';

/** Full units + what is left in the open one -> one decimal count. */
function OpenUnitHelper({ item, onApply, onClose }) {
    const cap = capacityOf(item);
    const [full, setFull] = useState('');
    const [left, setLeft] = useState('');
    const fullN = parseCount(full) ?? 0;
    const leftN = parseCount(left) ?? 0;
    const fraction = cap ? Math.min(leftN / cap.amount, 0.9999) : Math.min(leftN / 100, 0.9999);
    const total = Number((fullN + fraction).toFixed(4));
    const unit = displayUnit(item.unit);
    return (
        <div className={`rounded-md border ${ui.RULE} ${ui.PAPER2} p-3 space-y-3`}>
            <div className="grid grid-cols-2 gap-2">
                <label className="block min-w-0">
                    <span className={ui.label}>ยังไม่เปิด ({unit})</span>
                    <input type="text" inputMode="decimal" value={full} onChange={e => setFull(e.target.value)} autoFocus
                        className={`w-full ${numInput} ${ui.RULE}`} />
                </label>
                <label className="block min-w-0">
                    <span className={ui.label}>
                        {cap ? `เปิดแล้วเหลือ (${displayUnit(cap.unit)} จาก ${cap.amount.toLocaleString()})` : 'เปิดแล้วเหลือ (%)'}
                    </span>
                    <input type="text" inputMode="decimal" value={left} onChange={e => setLeft(e.target.value)}
                        className={`w-full ${numInput} ${ui.RULE}`} />
                </label>
            </div>
            {!cap && (
                <div className="grid grid-cols-4 gap-2">
                    {[0, 25, 50, 75].map(p => (
                        <button key={p} type="button" onClick={() => setLeft(String(p))} aria-pressed={String(p) === left}
                            className={`${ui.chip(String(p) === left)} tabular-nums`}>
                            {p}%
                        </button>
                    ))}
                </div>
            )}
            <div className="flex items-center justify-between gap-3">
                <span className={`text-[14px] leading-5 ${ui.MUTED}`}>
                    รวม <span className={`font-semibold ${ui.INK}`}>{qtyInWords(item, total, cap)}</span>
                </span>
                <div className="flex gap-2">
                    <button type="button" onClick={onClose} className={ui.ghostBtn}>ยกเลิก</button>
                    <button type="button" onClick={() => onApply({ full: fullN, frac: Number(fraction.toFixed(4)), total })} className={smallPrimary}>ใช้ค่านี้</button>
                </div>
            </div>
        </div>
    );
}

const num = (n) => Number(n).toLocaleString('th-TH', { maximumFractionDigits: 2 });

/**
 * What will be saved for one row, said in full, so nobody has to guess whether the number typed is
 * the whole amount or an addition: it is the whole amount and it replaces the one in the system.
 */
function CountOutcome({ item, total, cap, pieces, showSystem }) {
    const unit = displayUnit(item.unit);
    const system = Number(item.current_quantity) || 0;
    let amount;
    if (pieces) {
        const sp = splitPieces(total, cap.amount);
        const pu = displayUnit(cap.unit);
        amount = sp.packs > 0 && sp.rest > 0
            ? `${num(sp.packs)} ${unit} ${num(sp.rest)} ${pu} (รวม ${num(sp.pieces)} ${pu})`
            : sp.packs > 0 ? `${num(sp.packs)} ${unit} (${num(sp.pieces)} ${pu})` : `${num(sp.pieces)} ${pu}`;
    } else {
        amount = qtyInWords(item, total, cap);
    }
    const diff = total - system;
    let versus = null;
    if (showSystem) {
        if (Math.abs(diff) < 0.00005) versus = 'ตรงกับในระบบ';
        else if (pieces) {
            const d = Math.round(Math.abs(diff) * cap.amount);
            versus = `${diff > 0 ? 'มากกว่า' : 'น้อยกว่า'}ในระบบ ${num(d)} ${displayUnit(cap.unit)}`;
        } else {
            versus = `${diff > 0 ? 'มากกว่า' : 'น้อยกว่า'}ในระบบ ${diffInWords(item, Math.abs(diff), cap).replace(/^[+-]/, '')}`;
        }
    }
    return (
        <p className={`mt-2 text-[12px] leading-5 ${ui.MUTED}`} role="status">
            จะบันทึกยอดทั้งหมดเป็น <span className={`font-semibold text-[14px] tabular-nums ${ui.INK}`}>{amount}</span>
            {versus && <span className={`block tabular-nums ${showSystem && diff < -0.00005 ? ui.ACCENT : ''}`}>{versus}</span>}
        </p>
    );
}

export default function StockCountPage() {
    const navigate = useNavigate();
    const reduceMotion = useReducedMotion();
    const fade = reduceMotion
        ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
        : { initial: { opacity: 0, y: -6 }, animate: { opacity: 1, y: 0, transition: { duration: 0.18, ease: ui.EASE } }, exit: { opacity: 0, transition: { duration: 0.1 } } };
    const shopDay = useMemo(() => shopDayOf(new Date()), []);
    // One way to count. The round (opening / mid-day / closing) is worked out from the clock and
    // filed with the count, so the reports that read the day's first and last count keep working.
    const [kind] = useState(() => defaultCountKind(new Date()));
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [scope, setScope] = useState('daily'); // 'daily' | 'all' | 'suggested'
    const [spotData, setSpotData] = useState(null); // { ranked, lastCounted } for mid-day suggestions
    const [search, setSearch] = useState('');
    const [counts, setCounts] = useState(() => readDraft(shopDayOf(new Date())));
    const [showSystem, setShowSystem] = useState(true);
    // The opened unit of an item, as a fraction of a full one. Kept beside the field, which holds
    // the unopened units, so nobody reads or types "2.2 bottles".
    const [openLeft, setOpenLeft] = useState(() => readOpenDraft(shopDayOf(new Date())));
    // Loose pieces of pack items (cups out of an opened pack), as typed. Any number: all the cups may go here.
    const [loose, setLoose] = useState(() => readLooseDraft(shopDayOf(new Date())));
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState(null);
    const [user, setUser] = useState(null);
    const [helperFor, setHelperFor] = useState(null);
    // Scan-to-count
    const [scanning, setScanning] = useState(false);
    const [extraBarcodes, setExtraBarcodes] = useState([]);
    const [lastScanned, setLastScanned] = useState(null); // item id
    const [scanStatus, setScanStatus] = useState('');
    const [unknownCode, setUnknownCode] = useState(null);
    const [linking, setLinking] = useState(false);
    const gateRef = useRef(createScanGate(1200));
    // Yesterday's closing count, offered as today's opening
    const [lastClosing, setLastClosing] = useState(null); // { sessions, lines }

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
        loadItems()
            .then(list => {
                setItems(list);
                if (!list.some(i => i.track_mode === 'daily')) setScope('all');
            })
            .catch(err => {
                console.error(err);
                toast.error('โหลดรายการสต๊อกไม่สำเร็จ');
            })
            .finally(() => setLoading(false));
        loadExtraBarcodes().then(setExtraBarcodes);
        preloadCodeDetector(); // the reader is ready by the time "สแกน" is pressed
    }, []);

    useEffect(() => {
        if (kind !== 'opening') return;
        let cancelled = false;
        (async () => {
            const { data: sessions } = await supabase.from('stock_count_sessions')
                .select('id, performed_by, created_at, line_count')
                .eq('shop_day', addDays(shopDay, -1)).eq('kind', 'closing').order('created_at');
            if (cancelled || !sessions?.length) { if (!cancelled) setLastClosing(null); return; }
            const { data: lines } = await supabase.from('stock_count_lines')
                .select('session_id, stock_item_id, counted_qty')
                .in('session_id', sessions.map(x => x.id));
            if (cancelled) return;
            const at = new Map(sessions.map(x => [x.id, x.created_at]));
            setLastClosing({ sessions, lines: (lines || []).map(l => ({ ...l, created_at: at.get(l.session_id) })) });
        })();
        return () => { cancelled = true; };
    }, [kind, shopDay]);

    // Mid-day count: suggest the few items most worth checking now
    useEffect(() => {
        if (kind !== 'spot' || spotData) return;
        let cancelled = false;
        (async () => {
            const days = shopDayRange(addDays(shopDay, -1), 7);
            const since = new Date(`${days[0]}T05:00:00+07:00`).toISOString();
            const [recon, counted] = await Promise.all([
                Promise.all(days.map(d => supabase.rpc('stock_daily_reconciliation', { p_day: d })
                    .then(({ data }) => ({ day: d, rows: data || [] })))),
                supabase.from('stock_count_lines')
                    .select('stock_item_id, stock_count_sessions!inner(created_at)')
                    .gte('stock_count_sessions.created_at', since)
            ]);
            if (cancelled) return;
            const lastCounted = new Map();
            for (const l of counted.data || []) {
                const t = l.stock_count_sessions?.created_at;
                if (t && (!lastCounted.has(l.stock_item_id) || t > lastCounted.get(l.stock_item_id))) lastCounted.set(l.stock_item_id, t);
            }
            setSpotData({ ranked: rankVariance(recon), lastCounted });
        })().catch(err => console.warn('[spot suggestions]', err));
        return () => { cancelled = true; };
    }, [kind, shopDay, spotData]);

    const spotSuggestions = useMemo(() => (spotData && kind === 'spot'
        ? suggestSpotCount({ ranked: spotData.ranked, items, lastCounted: spotData.lastCounted, unitCostOf: countUnitCost })
        : []), [spotData, kind, items]);
    const suggestedIds = useMemo(() => new Set(spotSuggestions.map(x => x.item.id)), [spotSuggestions]);

    const applyLastClosing = () => {
        if (!lastClosing) return;
        const { counts: carried, filled } = carryOverClosing(lastClosing.lines, new Set(items.map(i => i.id)), counts);
        const next = { ...carried };
        const opened = { ...openLeft };
        for (const item of items) {
            if (carried[item.id] === counts[item.id] || !countsWholeUnits(item)) continue;
            const { whole, frac } = splitQty(parseCount(carried[item.id]));
            next[item.id] = String(whole);
            if (frac > 0) opened[item.id] = frac;
        }
        setCounts(next);
        setOpenLeft(opened);
        if (filled && scope === 'daily' && lastClosing.lines.some(l => itemsById.get(l.stock_item_id)?.track_mode !== 'daily')) setScope('all');
        toast.success(filled ? `ใส่ยอดเมื่อคืน ${filled} รายการ แก้เฉพาะตัวที่ไม่ตรงแล้วบันทึก` : 'ทุกรายการกรอกไว้แล้ว');
    };

    const barcodeIndex = useMemo(() => buildBarcodeIndex(items, extraBarcodes), [items, extraBarcodes]);
    const itemsById = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);
    const unknownRef = useRef(null);
    useEffect(() => { unknownRef.current = unknownCode; }, [unknownCode]);

    const countScan = useCallback((itemId, perScan) => {
        const item = itemsById.get(itemId);
        setCounts(prev => {
            const next = addScanToCount(prev[itemId], perScan);
            setScanStatus(`${item?.name || 'รายการ'} = ${next} ${displayUnit(item?.unit)}`);
            return { ...prev, [itemId]: next };
        });
        setLastScanned(itemId);
        scanFeedback(true);
    }, [itemsById]);

    const handleScan = useCallback((text) => {
        const code = String(text || '').trim();
        // Run the gate first, even while the link sheet is open, so a bottle that is
        // still in view after linking is not counted a second time.
        const fresh = code && gateRef.current.accept(normalizeBarcode(code) || code);
        if (!fresh || unknownRef.current) return; // waiting for the person to link the last code
        const hit = resolveScan(barcodeIndex, code, new Set(itemsById.keys()));
        if (hit.itemId) {
            countScan(hit.itemId, hit.perScan);
        } else {
            scanFeedback(false);
            setScanStatus(hit.isLabel ? 'ป้ายนี้เป็นของรายการที่ไม่ได้นับ' : `ยังไม่รู้จัก ${hit.code}`);
            if (!hit.isLabel) setUnknownCode(hit.code);
        }
    }, [barcodeIndex, itemsById, countScan]);

    const linkBarcode = async (item, perScan) => {
        if (!unknownCode || linking) return;
        setLinking(true);
        const performedBy = user?.user_metadata?.full_name || user?.email || 'Staff';
        const res = await linkBarcodeToItem({ item, code: unknownCode, perScan, performedBy });
        setLinking(false);
        if (!res.ok) {
            toast.error(res.message);
            return;
        }
        if (res.kind === 'main') setItems(prev => prev.map(i => i.id === item.id ? { ...i, barcode: unknownCode } : i));
        else setExtraBarcodes(prev => [...prev, res.row]);
        toast.success(`ผูกบาร์โค้ดกับ ${item.name} แล้ว`);
        setUnknownCode(null);
        countScan(item.id, perScan);
    };

    useEffect(() => { writeDraft(shopDay, counts); }, [shopDay, counts]);
    useEffect(() => { writeOpenDraft(shopDay, openLeft); }, [shopDay, openLeft]);
    useEffect(() => { writeLooseDraft(shopDay, loose); }, [shopDay, loose]);

    // Plus / minus on an empty field: the first tap starts from the amount in the system (when it is on
    // show), so a count that is nearly right is two taps, not retyping. The field itself stays empty until
    // touched: a prefilled number would be saved as "counted" for shelves nobody looked at.
    // Whole things (bottles, packs) put the full ones in the field and carry the opened one beside it.
    const step = (item, delta) => {
        const blank = String(counts[item.id] ?? '').trim() === '';
        const system = showSystem ? Math.max(0, Number(item.current_quantity) || 0) : 0;
        if (blank && countsWholeUnits(item)) {
            const { whole, frac } = splitQty(system);
            setCounts(prev => ({ ...prev, [item.id]: stepCount('', delta, whole) }));
            if (frac > 0 && openLeft[item.id] === undefined && loose[item.id] === undefined) setOpenLeft(prev => ({ ...prev, [item.id]: frac }));
            return;
        }
        setCounts(prev => ({ ...prev, [item.id]: stepCount(prev[item.id], delta, system) }));
    };
    // "It is exactly what the system says": one deliberate tap instead of + then -
    const fillSystem = (item) => {
        const system = Math.max(0, Number(item.current_quantity) || 0);
        if (!countsWholeUnits(item)) { setCounts(prev => ({ ...prev, [item.id]: String(system) })); return; }
        const { whole, frac } = splitQty(system);
        setCounts(prev => ({ ...prev, [item.id]: String(whole) }));
        setLoose(prev => { const next = { ...prev }; delete next[item.id]; return next; });
        setOpenLeft(prev => { const next = { ...prev }; if (frac > 0) next[item.id] = frac; else delete next[item.id]; return next; });
    };
    const clearOpen = (id) => setOpenLeft(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
    });

    const dailyCount = items.filter(i => i.track_mode === 'daily').length;
    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return items
            .filter(i => scope === 'all' || (scope === 'suggested' ? suggestedIds.has(i.id) : i.track_mode === 'daily'))
            .filter(i => !q || i.name.toLowerCase().includes(q));
    }, [items, scope, search, suggestedIds]);

    // Pieces per pack for the items counted as packs + pieces
    const pieceCaps = useMemo(() => {
        const caps = {};
        for (const item of items) {
            const cap = capacityOf(item);
            if (countsInPieces(item, cap)) caps[item.id] = cap.amount;
        }
        return caps;
    }, [items]);
    // What the pieces field shows: what was typed, else the opened pack carried in from the system or a scan
    const looseShown = (item) => {
        if (loose[item.id] !== undefined) return loose[item.id];
        const frac = Number(openLeft[item.id]);
        return frac > 0 && pieceCaps[item.id] ? String(Math.round(frac * pieceCaps[item.id])) : '';
    };
    const setLoosePieces = (id, value) => {
        setLoose(prev => ({ ...prev, [id]: value }));
        clearOpen(id);
    };

    const merged = mergeLoosePieces(mergeOpenLeft(counts, openLeft), loose, pieceCaps);
    const lines = buildCountLines(merged);
    const filled = lines.length;
    const totalsById = new Map(lines.map(l => [l.stock_item_id, l.counted_qty]));
    const unreadable = (v) => String(v ?? '').trim() !== '' && parseCount(v) === null;
    const invalidCount = Object.values(counts).filter(unreadable).length
        + Object.entries(loose).filter(([id, v]) => pieceCaps[id] && unreadable(v)).length;

    const toggleDaily = async (item) => {
        const next = item.track_mode === 'daily' ? 'weekly' : 'daily';
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, track_mode: next } : i));
        const { error } = await supabase.from('stock_items').update({ track_mode: next }).eq('id', item.id);
        if (error) {
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, track_mode: item.track_mode } : i));
            toast.error(/track_mode/.test(error.message || '')
                ? 'ฐานข้อมูลยังไม่รองรับรายการนับรายวัน กรุณาติดตั้ง migration ก่อน'
                : 'บันทึกไม่สำเร็จ: ' + error.message);
        }
    };

    const handleSubmit = async () => {
        if (!filled || invalidCount || saving) return;
        setSaving(true);
        try {
            const performedBy = user?.user_metadata?.full_name || user?.email || 'Staff';
            const round = defaultCountKind(new Date()); // the screen may have been open for hours
            const { data, error } = await supabase.rpc('submit_stock_count', {
                p_kind: round,
                p_lines: lines,
                p_performed_by: performedBy,
                p_note: null,
                p_blind: !showSystem,
                p_shop_day: shopDay
            });
            if (error) throw error;

            logStaffActivity('stock', 'stock_count_session', {
                staffName: performedBy,
                amount: data?.line_count || filled,
                reason: `${COUNT_KINDS[round].label}: นับ ${data?.line_count || filled} รายการ ผลต่าง ฿${Number(data?.value_diff || 0).toFixed(2)}`,
                metadata: { module: 'stock', session_id: data?.session_id, kind: round, shop_day: shopDay, value_diff: data?.value_diff }
            });

            setResult(data);
            setCounts({});
            setOpenLeft({});
            setLoose({});
            writeDraft(shopDay, {});
            const fresh = await loadItems().catch(() => null);
            if (fresh) setItems(fresh);
            toast.success(`บันทึกการนับ ${data?.line_count || filled} รายการแล้ว`);
        } catch (err) {
            console.error(err);
            const missing = err?.code === 'PGRST202' || /could not find the function/i.test(err?.message || '');
            toast.error(missing
                ? 'ฐานข้อมูลยังไม่มีระบบรอบนับ กรุณาติดตั้ง migration ก่อน'
                : 'บันทึกไม่สำเร็จ: ' + (err?.message || 'ไม่ทราบสาเหตุ'));
        } finally {
            setSaving(false);
        }
    };

    const pillTransition = reduceMotion ? { duration: 0 } : { duration: 0.22, ease: ui.EASE };

    return (
        <div className={`min-h-screen bg-[oklch(97%_0.008_28)] ${ui.INK} font-sans pb-28`}>
            <header className={`sticky top-0 z-20 bg-[oklch(97%_0.008_28)] border-b ${ui.RULE}`}>
                <div className={`max-w-3xl mx-auto grid grid-cols-[auto_1fr] divide-x divide-[oklch(85%_0.012_28)] border-x ${ui.RULE}`}>
                    <button type="button" onClick={() => navigate('/staff/stock')}
                        className={`px-4 font-bold text-[14px] ${ui.MUTED} hover:bg-[oklch(94%_0.010_28)] cursor-pointer`}>
                        กลับ
                    </button>
                    <div className="px-4 py-2.5">
                        <h1 className="font-semibold text-xl leading-7">นับสต๊อก</h1>
                        <p className={`text-[12px] leading-5 ${ui.MUTED}`}>
                            วันทำการ <span className="tabular-nums">{shopDay}</span> · ตัดรอบวันตอน 05:00
                        </p>
                    </div>
                </div>
            </header>

            <main className={`max-w-3xl mx-auto border-x ${ui.RULE} ${ui.PAPER} min-h-[60vh]`}>
                <AnimatePresence mode="wait" initial={false}>
                {result ? (
                    <motion.section key="result" {...fade} className="p-4 space-y-4" aria-labelledby="count-result">
                        <div>
                            <h2 id="count-result" className="font-semibold text-base leading-7">
                                บันทึกการนับแล้ว {result.line_count} รายการ
                            </h2>
                            <p className={`text-[14px] leading-6 ${ui.MUTED}`}>
                                ผลต่างจากยอดในระบบรวม{' '}
                                <span className={`font-semibold tabular-nums ${Number(result.value_diff) < 0 ? ui.ACCENT : ui.INK}`}>
                                    ฿{Number(result.value_diff || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </p>
                        </div>
                        <ol className={`rounded-md border ${ui.RULE} divide-y divide-[oklch(90%_0.008_28)] overflow-hidden`}>
                            {(result.lines || []).map((l, i) => {
                                const it = itemsById.get(l.stock_item_id) || { unit: l.unit };
                                const cap = capacityOf(it);
                                return (
                                <motion.li key={l.stock_item_id} className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-2.5"
                                    initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0, transition: { duration: 0.18, ease: ui.EASE, delay: Math.min(i, 12) * 0.02 } }}>
                                    <span className="font-semibold text-[14px] leading-6 min-w-0 break-words">{l.name}</span>
                                    <span className={`text-[14px] leading-6 tabular-nums text-right ${Number(l.diff) < 0 ? ui.ACCENT : ui.MUTED}`}>
                                        {diffInWords(it, l.diff, cap)}
                                    </span>
                                    <span className={`text-[12px] leading-5 ${ui.NEUTRAL}`}>
                                        ระบบ {qtyInWords(it, l.system_qty, cap)} → นับได้ {qtyInWords(it, l.counted_qty, cap)}
                                    </span>
                                    <span className={`text-[12px] leading-5 tabular-nums text-right ${ui.NEUTRAL}`}>
                                        ฿{Number(l.value_diff || 0).toFixed(2)}
                                    </span>
                                </motion.li>
                                );
                            })}
                        </ol>
                        <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setResult(null)}
                                className={`h-12 rounded-md border ${ui.RULE} text-base font-semibold ${ui.INK} hover:border-[oklch(18%_0.012_28)] transition-colors cursor-pointer`}>
                                นับต่อ
                            </button>
                            <button type="button" onClick={() => navigate('/staff/stock')} className={ui.primaryBtn}>
                                กลับหน้าคลัง
                            </button>
                        </div>
                    </motion.section>
                ) : (
                    <motion.div key="sheet" {...fade}>
                        {/* Controls */}
                        <div className={`p-3 border-b ${ui.RULE} space-y-3`}>
                            <div className="flex flex-wrap gap-2 items-center">
                                <div className={`relative inline-grid grid-cols-2 p-1 rounded-md ${ui.PAPER2}`} role="group" aria-label="รายการที่แสดง">
                                    {[
                                        { id: 'daily', label: 'นับทุกวัน', n: dailyCount },
                                        { id: 'all', label: 'ทั้งหมด', n: items.length }
                                    ].map(s => (
                                        <button key={s.id} type="button" onClick={() => setScope(s.id)} aria-pressed={scope === s.id}
                                            className={`relative h-8 px-3 rounded text-[14px] whitespace-nowrap transition-colors cursor-pointer ${scope === s.id ? `${ui.INK} font-semibold` : `${ui.NEUTRAL} hover:text-[oklch(18%_0.012_28)]`}`}>
                                            {scope === s.id && (
                                                <motion.span layoutId="count-scope-pill" transition={pillTransition}
                                                    className={`absolute inset-0 rounded ${ui.PAPER} shadow-[0_1px_2px_oklch(18%_0.012_28/0.12)]`} />
                                            )}
                                            <span className="relative">{s.label} <span className={`tabular-nums ${ui.NEUTRAL}`}>{s.n}</span></span>
                                        </button>
                                    ))}
                                </div>
                                <button type="button" onClick={() => navigate('/staff/stock/labels')} className={ui.ghostBtn}>
                                    ป้าย QR
                                </button>
                                <button type="button" role="switch" aria-checked={showSystem} onClick={() => setShowSystem(v => !v)}
                                    className={`ml-auto flex items-center gap-2 h-9 text-[14px] ${ui.MUTED} cursor-pointer select-none`}>
                                    แสดงยอดในระบบ
                                    <span className={`relative w-11 h-6 rounded-full transition-colors ${showSystem ? 'bg-[oklch(18%_0.012_28)]' : 'bg-[oklch(85%_0.012_28)]'}`}>
                                        <motion.span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-[oklch(99%_0.004_28)]"
                                            animate={{ x: showSystem ? 20 : 0 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: ui.EASE }} />
                                    </span>
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="search"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="ค้นหาชื่อ..."
                                    aria-label="ค้นหาชื่อวัตถุดิบ"
                                    className={`${ui.input} flex-1 min-w-0`}
                                />
                                <button type="button" onClick={() => { scanFeedback.ctx?.resume?.(); setScanning(s => !s); gateRef.current.reset(); }}
                                    aria-pressed={scanning}
                                    className={`h-11 px-4 shrink-0 rounded-md border text-sm font-semibold transition-colors cursor-pointer ${scanning
                                        ? 'border-[oklch(18%_0.012_28)] bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]'
                                        : `${ui.RULE} ${ui.INK} hover:border-[oklch(18%_0.012_28)]`}`}>
                                    {scanning ? 'กำลังสแกน' : 'สแกน'}
                                </button>
                            </div>
                            <p className={`rounded-md border ${ui.RULE} ${ui.PAPER2} px-3 py-2.5 text-[14px] leading-6 ${ui.INK}`}>
                                <span className="font-semibold">ใส่จำนวนที่มีอยู่จริงทั้งหมด</span> ไม่ใช่จำนวนที่เพิ่มเข้ามา
                                <span className={`block text-[12px] leading-5 ${ui.MUTED}`}>
                                    {showSystem
                                        ? 'ตัวเลขสีเทาในช่องคือยอดในระบบ ยังไม่ถือว่านับ กด − + เพื่อปรับจากยอดนั้น พิมพ์ทับ หรือกด "ตรงกับในระบบ"'
                                        : 'ยอดที่ใส่จะแทนยอดในระบบ'}
                                    {' '}ของที่มาเป็นแพ็คนับเป็นแพ็ค เป็นชิ้น หรือทั้งสองอย่างก็ได้
                                </span>
                            </p>
                            <AnimatePresence initial={false}>
                                {!showSystem && (
                                    <motion.p key="blind" {...fade} className={`text-[12px] leading-5 ${ui.MUTED}`}>
                                        นับแบบไม่เห็นยอดในระบบ นับตามของจริง แล้วระบบจะแสดงผลต่างหลังบันทึก
                                    </motion.p>
                                )}
                                {kind === 'spot' && spotSuggestions.length > 0 && (
                                    <motion.div key="spot" {...fade} className={`rounded-md border ${ui.RULE} ${ui.PAPER} overflow-hidden`}>
                                        <div className="grid grid-cols-[1fr_auto] gap-3 items-center px-3 py-2.5 border-b border-[oklch(90%_0.008_28)]">
                                            <p className={`text-[12px] leading-5 ${ui.MUTED} min-w-0`}>
                                                <span className={`font-semibold text-[14px] ${ui.INK}`}>แนะนำให้นับตอนนี้ {spotSuggestions.length} รายการ</span>
                                                <span className="block">ไม่ต้องนับทั้งร้าน ตัวที่ขาดบ่อยหรือมูลค่าสูงที่ยังไม่ได้นับ</span>
                                            </p>
                                            <button type="button" onClick={() => setScope(scope === 'suggested' ? 'all' : 'suggested')} aria-pressed={scope === 'suggested'}
                                                className={scope === 'suggested' ? ui.ghostBtn : smallPrimary}>
                                                {scope === 'suggested' ? 'แสดงทั้งหมด' : 'นับเฉพาะที่แนะนำ'}
                                            </button>
                                        </div>
                                        <ul className="divide-y divide-[oklch(92%_0.006_28)]">
                                            {spotSuggestions.map(({ item, why }) => (
                                                <li key={item.id} className="grid sm:grid-cols-[1fr_auto] gap-x-3 px-3 py-2 text-[12px] leading-5">
                                                    <span className={`font-semibold ${ui.INK} break-words min-w-0`}>{item.name}</span>
                                                    <span className={`${ui.NEUTRAL} sm:text-right`}>{why}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </motion.div>
                                )}
                                {kind === 'opening' && lastClosing && (
                                    <motion.div key="carry" {...fade} className={`grid grid-cols-[1fr_auto] gap-3 items-center rounded-md border ${ui.RULE} ${ui.PAPER} px-3 py-2.5`}>
                                        <p className={`text-[12px] leading-5 ${ui.MUTED} min-w-0`}>
                                            เมื่อคืนนับไว้ <span className={`font-semibold tabular-nums ${ui.INK}`}>{new Set(lastClosing.lines.map(l => l.stock_item_id)).size}</span> รายการ
                                            {' '}({lastClosing.sessions.map(x => `${new Date(x.created_at).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })} ${x.performed_by || ''}`.trim()).join(', ')})
                                            <span className="block">ถ้าของไม่ได้เปลี่ยนตั้งแต่ปิดร้าน ใส่ยอดนั้นให้ทุกช่อง แล้วแก้เฉพาะที่ไม่ตรง</span>
                                        </p>
                                        <button type="button" onClick={applyLastClosing} className={smallPrimary}>
                                            ใส่ยอดเมื่อคืน
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <AnimatePresence initial={false}>
                            {scanning && (
                                <motion.div key="scan" {...fade} className={`border-b ${ui.RULE}`}>
                                    <ScanStrip onCode={handleScan} onClose={() => setScanning(false)} status={scanStatus} />
                                    {lastScanned && itemsById.get(lastScanned) && (() => {
                                        const it = itemsById.get(lastScanned);
                                        const raw = counts[it.id] ?? '';
                                        return (
                                            <div className={`grid grid-cols-[1fr_auto] gap-3 items-center px-3 py-2.5 ${ui.PAPER2}`}>
                                                <AnimatePresence mode="wait" initial={false}>
                                                    <motion.div key={it.id} {...fade} className="min-w-0">
                                                        <span className={`text-[12px] leading-4 ${ui.NEUTRAL} block`}>สแกนล่าสุด</span>
                                                        <span className="font-semibold text-base leading-6 break-words">{it.name}</span>
                                                        <span className={`text-[12px] leading-5 ${ui.NEUTRAL} block`}>นับเป็น{displayUnit(it.unit)}</span>
                                                        {Number(openLeft[it.id]) > 0 && (
                                                            <span className={`text-[14px] leading-6 font-semibold ${ui.INK} block`}>
                                                                + เปิดอยู่ 1 เหลือ <span className="tabular-nums">{openLeftText(Number(openLeft[it.id]), capacityOf(it))}</span>
                                                            </span>
                                                        )}
                                                    </motion.div>
                                                </AnimatePresence>
                                                <div className="flex items-center gap-2">
                                                    <button type="button" aria-label={`ลด ${it.name} 1`} onClick={() => step(it, -1)} className={stepBtn}>−</button>
                                                    <input type="text" inputMode="decimal" value={raw} aria-label={`จำนวน ${it.name}`}
                                                        onChange={e => setCounts(prev => ({ ...prev, [it.id]: e.target.value }))}
                                                        className={`w-16 ${numInput} ${ui.RULE}`} />
                                                    <button type="button" aria-label={`เพิ่ม ${it.name} 1`} onClick={() => step(it, 1)} className={stepBtn}>+</button>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {loading ? (
                            <p className={`p-6 text-[14px] ${ui.NEUTRAL}`}>กำลังโหลด...</p>
                        ) : visible.length === 0 ? (
                            <div className={`p-6 space-y-2 text-[14px] leading-6 ${ui.MUTED}`}>
                                {scope === 'daily' && !search
                                    ? <>ยังไม่มีรายการที่นับทุกวัน กด "ทั้งหมด" แล้วกด "นับทุกวัน" ที่รายการที่ต้องการ</>
                                    : <>ไม่พบรายการ</>}
                            </div>
                        ) : (
                            <motion.ul key={scope} initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.18 } }}
                                className="divide-y divide-[oklch(90%_0.008_28)]">
                                {visible.map(item => {
                                    const raw = counts[item.id] ?? '';
                                    const cap = capacityOf(item);
                                    const pieces = !!pieceCaps[item.id];
                                    const looseRaw = pieces ? looseShown(item) : '';
                                    const opened = !pieces && Number(openLeft[item.id]) > 0 ? Number(openLeft[item.id]) : 0;
                                    const typed = String(raw).trim() !== '';
                                    const invalid = typed && parseCount(raw) === null;
                                    const looseInvalid = pieces && unreadable(looseRaw);
                                    const entered = typed || opened > 0 || String(looseRaw).trim() !== '';
                                    const total = totalsById.get(item.id);
                                    const unit = displayUnit(item.unit);
                                    const pieceUnit = pieces ? displayUnit(cap.unit) : '';
                                    const linkCls = 'font-medium underline underline-offset-2 decoration-[oklch(85%_0.012_28)] hover:text-[oklch(18%_0.012_28)] hover:decoration-current transition-colors cursor-pointer';
                                    const meta = (
                                        <div className={`flex flex-wrap gap-x-3 text-[12px] leading-5 ${ui.NEUTRAL}`}>
                                            <span>
                                                {showSystem
                                                    ? <>ในระบบ <span className="tabular-nums">{qtyInWords(item, item.current_quantity, cap)}{pieces && Number(item.current_quantity) > 0 ? ` (${num(splitPieces(item.current_quantity, cap.amount).pieces)} ${pieceUnit})` : ''}</span></>
                                                    : <>นับเป็น{unit}{pieces ? `หรือ${pieceUnit}` : ''}</>}
                                            </span>
                                            {pieces && <span className="tabular-nums whitespace-nowrap">1 {unit} = {num(cap.amount)} {pieceUnit}</span>}
                                            {showSystem && !entered && Number(item.current_quantity) > 0 && (
                                                <button type="button" onClick={() => fillSystem(item)} className={linkCls}>
                                                    ตรงกับในระบบ
                                                </button>
                                            )}
                                            {!pieces && (
                                                <button type="button" onClick={() => setHelperFor(helperFor === item.id ? null : item.id)}
                                                    aria-expanded={helperFor === item.id}
                                                    className={`${linkCls} ${helperFor === item.id ? ui.INK : ''}`}>
                                                    มีของเปิดแล้ว
                                                </button>
                                            )}
                                            {scope === 'all' && (
                                                <button type="button" onClick={() => toggleDaily(item)} className={linkCls}>
                                                    {item.track_mode === 'daily' ? 'เลิกนับทุกวัน' : 'นับทุกวัน'}
                                                </button>
                                            )}
                                        </div>
                                    );
                                    // The amount in the system sits in the empty field in grey: seen, not yet counted.
                                    // It turns to ink (and is saved) once the row is touched.
                                    const sys = Math.max(0, Number(item.current_quantity) || 0);
                                    const sysSplit = splitQty(sys);
                                    const hint = !showSystem ? '' : countsWholeUnits(item) ? String(sysSplit.whole) : String(Number(sys.toFixed(2)));
                                    const looseHint = !showSystem || !pieces ? '' : String(Math.round(sysSplit.frac * cap.amount));
                                    const fieldBorder = (bad, on) => bad ? 'border-[oklch(52%_0.16_28)]' : on ? 'border-[oklch(42%_0.010_28)]' : ui.RULE;
                                    return (
                                        <li key={item.id} className={`px-3 py-3 transition-colors ${entered && !invalid && !looseInvalid ? 'bg-[oklch(97.5%_0.006_28)]' : ''}`}>
                                            {pieces ? (
                                                <>
                                                    <span className="font-semibold text-base leading-6 block break-words">{item.name}</span>
                                                    {meta}
                                                    {/* 375px: 44 + 64 + 44 + 2 × 6 = 164 for the packs, 16 for the plus, the rest for the pieces */}
                                                    <div className="mt-2 grid grid-cols-[auto_auto_minmax(0,1fr)] gap-x-2 items-end">
                                                        <div>
                                                            <label htmlFor={`count-${item.id}`} className={`block text-[12px] leading-5 font-medium ${ui.MUTED}`}>{unit}เต็ม</label>
                                                            <div className="flex items-center gap-1.5">
                                                                <button type="button" aria-label={`ลด ${item.name} 1 ${unit}`} onClick={() => step(item, -1)} className={stepBtn}>−</button>
                                                                <input
                                                                    id={`count-${item.id}`}
                                                                    type="text"
                                                                    inputMode="decimal"
                                                                    autoComplete="off"
                                                                    value={raw}
                                                                    placeholder={hint}
                                                                    onChange={e => setCounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                                    aria-invalid={invalid}
                                                                    className={`w-16 ${numInput} ${fieldBorder(invalid, typed)}`}
                                                                />
                                                                <button type="button" aria-label={`เพิ่ม ${item.name} 1 ${unit}`} onClick={() => step(item, 1)} className={stepBtn}>+</button>
                                                            </div>
                                                        </div>
                                                        <span className={`h-11 flex items-center text-base ${ui.NEUTRAL}`} aria-hidden="true">+</span>
                                                        <div className="min-w-0 max-w-[200px]">
                                                            <label htmlFor={`loose-${item.id}`} className={`block text-[12px] leading-5 font-medium ${ui.MUTED} truncate`}>{pieceUnit} (เศษ หรือนับทั้งหมด)</label>
                                                            <input
                                                                id={`loose-${item.id}`}
                                                                type="text"
                                                                inputMode="decimal"
                                                                autoComplete="off"
                                                                value={looseRaw}
                                                                placeholder={entered ? '' : looseHint}
                                                                onChange={e => setLoosePieces(item.id, e.target.value)}
                                                                aria-invalid={looseInvalid}
                                                                className={`w-full ${numInput} ${fieldBorder(looseInvalid, String(looseRaw).trim() !== '')}`}
                                                            />
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                            <div className="grid grid-cols-[1fr_auto] gap-x-3 items-center">
                                                <div className="min-w-0">
                                                    <label htmlFor={`count-${item.id}`} className="font-semibold text-base leading-6 block break-words">
                                                        {item.name}
                                                    </label>
                                                    {meta}
                                                    {opened > 0 && (
                                                        <div className={`flex flex-wrap gap-x-3 text-[14px] leading-6 ${ui.INK}`}>
                                                            <span className="font-semibold">+ เปิดอยู่ 1 เหลือ <span className="tabular-nums">{openLeftText(opened, cap)}</span></span>
                                                            <button type="button" onClick={() => clearOpen(item.id)}
                                                                className={`text-[12px] ${ui.NEUTRAL} ${linkCls}`}>
                                                                ไม่มีของเปิด
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1.5 sm:gap-2">
                                                        <button type="button" aria-label={`ลด ${item.name} 1`} onClick={() => step(item, -1)} className={stepBtn}>−</button>
                                                        <input
                                                            id={`count-${item.id}`}
                                                            type="text"
                                                            inputMode="decimal"
                                                            autoComplete="off"
                                                            value={raw}
                                                            placeholder={hint}
                                                            onChange={e => setCounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                            aria-invalid={invalid}
                                                            className={`w-16 sm:w-20 ${numInput} ${fieldBorder(invalid, entered)}`}
                                                        />
                                                        <button type="button" aria-label={`เพิ่ม ${item.name} 1`} onClick={() => step(item, 1)} className={stepBtn}>+</button>
                                                    </div>
                                                    <span className={`block text-center text-[12px] leading-5 ${ui.NEUTRAL}`}>{unit}</span>
                                                </div>
                                            </div>
                                            )}
                                            {total !== undefined && !invalid && !looseInvalid && (
                                                <CountOutcome item={item} total={total} cap={cap} pieces={pieces} showSystem={showSystem} />
                                            )}
                                            <AnimatePresence initial={false}>
                                                {helperFor === item.id && (
                                                    <motion.div key="helper"
                                                        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                                                        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, height: 'auto', transition: { duration: 0.22, ease: ui.EASE } }}
                                                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, transition: { duration: 0.14, ease: ui.EASE } }}
                                                        className="overflow-hidden">
                                                        <div className="pt-3">
                                                            <OpenUnitHelper
                                                                item={item}
                                                                onClose={() => setHelperFor(null)}
                                                                onApply={({ full, frac, total }) => {
                                                                    if (countsWholeUnits(item)) {
                                                                        setCounts(prev => ({ ...prev, [item.id]: String(full) }));
                                                                        if (frac > 0) setOpenLeft(prev => ({ ...prev, [item.id]: frac }));
                                                                        else clearOpen(item.id);
                                                                    } else {
                                                                        setCounts(prev => ({ ...prev, [item.id]: String(total) }));
                                                                    }
                                                                    setHelperFor(null);
                                                                }}
                                                            />
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </li>
                                    );
                                })}
                            </motion.ul>
                        )}
                    </motion.div>
                )}
                </AnimatePresence>
            </main>

            {unknownCode && (
                <BarcodeLinkSheet
                    code={unknownCode}
                    items={items}
                    saving={linking}
                    onLink={linkBarcode}
                    onSkip={() => setUnknownCode(null)}
                />
            )}

            <AnimatePresence>
                {!result && (
                    <motion.footer key="footer"
                        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: ui.EASE } }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, transition: { duration: 0.14, ease: ui.EASE } }}
                        className={`fixed bottom-0 inset-x-0 z-20 bg-[oklch(97%_0.008_28)] border-t ${ui.RULE}`}>
                        <div className={`max-w-3xl mx-auto flex items-center gap-3 px-3 py-3 border-x ${ui.RULE}`}>
                            <span className={`flex-1 min-w-0 text-[14px] leading-5 ${ui.MUTED}`}>
                                กรอกแล้ว{' '}
                                <motion.span key={filled} className={`inline-block font-semibold tabular-nums ${ui.INK}`}
                                    initial={reduceMotion || !filled ? false : { opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0, transition: { duration: 0.16, ease: ui.EASE } }}>
                                    {filled}
                                </motion.span> รายการ
                                {invalidCount > 0
                                    ? <span className={`block text-[12px] font-semibold ${ui.ACCENT}`}>แก้ช่องสีแดง {invalidCount} ช่องก่อนบันทึก</span>
                                    : <span className={`block text-[12px] ${ui.NEUTRAL}`}>รายการที่ไม่กรอกจะไม่ถูกเปลี่ยน</span>}
                            </span>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={!filled || invalidCount > 0 || saving}
                                className="h-12 px-6 shrink-0 rounded-md bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] text-base font-semibold transition-[background-color,opacity,transform] hover:bg-[oklch(25%_0.012_28)] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {saving ? 'กำลังบันทึก...' : 'บันทึกการนับ'}
                            </button>
                        </div>
                    </motion.footer>
                )}
            </AnimatePresence>
        </div>
    );
}
