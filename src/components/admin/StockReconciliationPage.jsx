/* Hallmark · shape: app screen · theme: Thai Twist Modern (Brand v2) · v2.0.0 */
/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabaseClient';
import {
    shopDayOf, addDays, isAbnormal, summarizeReconciliation, sortReconciliation,
    COUNT_KINDS, DEFAULT_THRESHOLDS, THRESHOLD_KEYS, thresholdsFromSettings,
    classifyReconRow, defaultReconFilter, formatReconQty, cleanCategoryLabel, shortUnit
} from '../../utils/stockCount';
import { exportElementImage, downloadDataUrl, copyDataUrlImage } from '../../utils/reportImageExport';
import {
    rankVariance, summarizeRanking, shopDayRange, rankByCounter, groupCountSessions
} from '../../utils/stockReports';
import StockCardPanel from './StockCardPanel';

const baht = (v) => (v === null || v === undefined)
    ? '—'
    : `฿${Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const signedBaht = (v) => {
    if (v === null || v === undefined) return '—';
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    if (Math.abs(n) < 0.005) return '฿0.00';
    return `${n < 0 ? '-' : '+'}฿${Math.abs(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const timeOf = (iso) => iso
    ? new Date(iso).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })
    : '';

const shortDate = (ymd) => new Date(`${ymd}T12:00:00+07:00`).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit'
});

const dayMonthIso = (iso) => iso
    ? new Date(iso).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' })
    : '';

const thaiDate = (ymd) => new Date(`${ymd}T12:00:00+07:00`).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
});

const kindShortLabel = (kind) => {
    if (kind === 'closing') return 'นับปิดร้าน';
    if (kind === 'opening') return 'นับเปิดร้าน';
    if (kind === 'spot') return 'นับรายตัว';
    return COUNT_KINDS[kind]?.label || 'นับสต๊อก';
};

const statusBadgeClass = (tone) => {
    if (tone === 'plum') return 'border-[var(--brand-plum)] text-[var(--brand-plum)] bg-[var(--color-paper)] font-bold';
    if (tone === 'muted') return 'border-[var(--color-rule)] text-[var(--color-muted)] bg-[var(--color-paper-2)] font-medium';
    return 'border-[var(--color-paper-3)] text-[var(--color-neutral)] bg-[var(--color-paper)] font-normal';
};

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)] focus-visible:-outline-offset-2 active:translate-y-px motion-reduce:active:translate-y-0';

/**
 * Daily & accumulated stock reconciliation (Shadow-mode friendly).
 * Compares expected close (opening + ledger movements - shadow sales usage)
 * against the day's latest physical count (closing or staff spot count).
 */
export default function StockReconciliationPage() {
    const [day, setDay] = useState(() => shopDayOf(new Date()));
    const [view, setView] = useState('day'); // 'day' | 7 | 30
    const [rows, setRows] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [filter, setFilter] = useState('abnormal'); // 'abnormal' | 'counted' | 'sold' | 'all'
    const [manualFilter, setManualFilter] = useState(false);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [denseCols, setDenseCols] = useState(false); // false = 6-col readable, true = full accounting
    const [exporting, setExporting] = useState(false);

    const [deductionMode, setDeductionMode] = useState('shadow');
    const [carryoverByItem, setCarryoverByItem] = useState({});
    const [itemUnits, setItemUnits] = useState({});
    const [categories, setCategories] = useState([]);
    const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
    const [thDraft, setThDraft] = useState(null);

    const [ranking, setRanking] = useState({ loading: false, rows: [], counters: [], days: 0, error: null });
    const [cardFor, setCardFor] = useState(null); // { id, name, unit }

    const reportRef = useRef(null);
    const today = shopDayOf(new Date());

    // Reference metadata: unit conversions, categories, thresholds, deduction mode
    useEffect(() => {
        let cancelled = false;
        Promise.all([
            supabase.from('stock_items').select('id, conversion_factor, usage_unit'),
            supabase.from('stock_categories').select('id, label, sort_order').order('sort_order').order('label'),
            supabase.from('app_settings').select('key, value').in('key', Object.values(THRESHOLD_KEYS)),
            supabase.from('stock_deduction_settings').select('mode').maybeSingle()
        ]).then(([itemsRes, catsRes, thRes, modeRes]) => {
            if (cancelled) return;
            if (itemsRes.data) {
                setItemUnits(Object.fromEntries(itemsRes.data.map(i => [
                    i.id, { factor: Number(i.conversion_factor) || 1, usageUnit: i.usage_unit || '' }
                ])));
            }
            if (catsRes.data) {
                setCategories(catsRes.data.map(c => ({ id: c.id, label: cleanCategoryLabel(c.label) || c.id })));
            }
            setThresholds(thresholdsFromSettings(thRes.data || []));
            if (modeRes.data?.mode) setDeductionMode(modeRes.data.mode);
        });
        return () => { cancelled = true; };
    }, []);

    const categoryLabelMap = useMemo(
        () => Object.fromEntries(categories.map(c => [c.id, c.label])),
        [categories]
    );
    const catLabel = useCallback((id) => categoryLabelMap[id] || cleanCategoryLabel(id) || 'ไม่ระบุหมวด', [categoryLabelMap]);

    const fmtQty = useCallback((val, r, digits = 2) => {
        const u = itemUnits[r.stock_item_id] || {};
        return formatReconQty(val, { unit: r.unit, factor: u.factor, usageUnit: u.usageUnit }, digits);
    }, [itemUnits]);

    const fmtSignedQty = useCallback((val, r, digits = 2) => {
        if (val === null || val === undefined) return '—';
        const n = Number(val);
        if (!Number.isFinite(n)) return '—';
        if (Math.abs(n) < 0.00005) return 'ตรง';
        return `${n > 0 ? '+' : '-'}${fmtQty(Math.abs(n), r, digits)}`;
    }, [fmtQty]);

    // Reset auto-filter whenever the date changes so the user always sees active data first
    useEffect(() => {
        setManualFilter(false);
    }, [day]);

    // Load single shop day
    const loadDay = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [recon, sess, carry] = await Promise.all([
                supabase.rpc('stock_daily_reconciliation', { p_day: day }),
                supabase.from('stock_count_sessions')
                    .select('id, kind, performed_by, line_count, value_diff, blind, created_at')
                    .eq('shop_day', day)
                    .order('created_at'),
                supabase.rpc('stock_shadow_carryover', { p_day: day })
            ]);
            if (recon.error) throw recon.error;
            const loaded = recon.data || [];
            setRows(loaded);
            setSessions(sess.data || []);
            if (!carry.error && Array.isArray(carry.data)) {
                setCarryoverByItem(Object.fromEntries(carry.data.map(c => [c.stock_item_id, c])));
            } else {
                setCarryoverByItem({});
            }
        } catch (err) {
            console.error(err);
            setError(err);
            setRows([]);
            setSessions([]);
            setCarryoverByItem({});
        } finally {
            setLoading(false);
        }
    }, [day]);

    useEffect(() => {
        if (view === 'day') loadDay();
    }, [view, loadDay]);

    // Pick best initial filter when a new day finishes loading
    useEffect(() => {
        if (loading || manualFilter) return;
        setFilter(defaultReconFilter(rows, thresholds));
    }, [loading, manualFilter, rows, thresholds]);

    // Load 7-day / 30-day accumulated variance
    useEffect(() => {
        if (view === 'day') return;
        let cancelled = false;
        const days = shopDayRange(day, view);
        setRanking(r => ({ ...r, loading: true, error: null }));
        Promise.all([
            Promise.all(days.map(d => supabase.rpc('stock_daily_reconciliation', { p_day: d })
                .then(({ data, error: rpcErr }) => { if (rpcErr) throw rpcErr; return { day: d, rows: data || [] }; }))),
            supabase.from('stock_count_sessions')
                .select('shop_day, kind, performed_by, created_at')
                .in('kind', ['closing', 'spot'])
                .gte('shop_day', days[0]).lte('shop_day', days[days.length - 1]),
            supabase.from('stock_count_lines')
                .select('stock_item_id, stock_count_sessions!inner(shop_day, kind, performed_by, created_at)')
                .in('stock_count_sessions.kind', ['closing', 'spot'])
                .gte('stock_count_sessions.shop_day', days[0]).lte('stock_count_sessions.shop_day', days[days.length - 1])
                .limit(5000)
        ])
            .then(([results, sess, lineRes]) => {
                if (cancelled) return;
                const closingBy = new Map();
                for (const x of sess.data || []) {
                    if (!closingBy.has(x.shop_day)) closingBy.set(x.shop_day, []);
                    closingBy.get(x.shop_day).push(x.performed_by);
                }

                // Match SQL priority: closing beats spot, latest created_at wins per (shop_day, item)
                const winnerMeta = new Map();
                for (const l of lineRes.data || []) {
                    const s = l.stock_count_sessions;
                    if (!s?.shop_day || !l.stock_item_id) continue;
                    const key = `${s.shop_day}:${l.stock_item_id}`;
                    const prev = winnerMeta.get(key);
                    const isClosing = s.kind === 'closing' ? 1 : 0;
                    const prevClosing = prev?.isClosing ?? -1;
                    const newer = isClosing > prevClosing
                        || (isClosing === prevClosing && String(s.created_at || '') >= String(prev?.created_at || ''));
                    if (newer) {
                        winnerMeta.set(key, { isClosing, created_at: s.created_at, by: s.performed_by || 'ไม่ระบุ' });
                    }
                }
                const counterByDayItem = new Map([...winnerMeta.entries()].map(([k, v]) => [k, v.by]));

                setRanking({
                    loading: false,
                    rows: rankVariance(results, thresholds),
                    counters: rankByCounter(results, closingBy, thresholds, counterByDayItem),
                    days: results.filter(r => r.rows.some(x => x.closing_qty !== null)).length,
                    error: null
                });
            })
            .catch(err => {
                if (!cancelled) setRanking({ loading: false, rows: [], counters: [], days: 0, error: err });
            });
        return () => { cancelled = true; };
    }, [view, day, thresholds]);

    const saveThresholds = async () => {
        const p = Number(thDraft?.percent);
        const b = Number(thDraft?.baht);
        if (!Number.isFinite(p) || p < 0 || !Number.isFinite(b) || b < 0) {
            toast.error('กรุณากรอกตัวเลขตั้งแต่ 0 ขึ้นไป');
            return;
        }
        const { error: saveErr } = await supabase.from('app_settings').upsert([
            { key: THRESHOLD_KEYS.percent, value: String(p) },
            { key: THRESHOLD_KEYS.baht, value: String(b) }
        ]);
        if (saveErr) { toast.error('บันทึกเกณฑ์ไม่สำเร็จ: ' + saveErr.message); return; }
        setThresholds({ percent: p, baht: b });
        setThDraft(null);
        toast.success(`บันทึกเกณฑ์ใหม่แล้ว: ต่างเกิน ${p}% และเกิน ฿${b}`);
    };

    const summary = useMemo(() => summarizeReconciliation(rows, thresholds), [rows, thresholds]);
    const rankSummary = useMemo(() => summarizeRanking(ranking.rows), [ranking.rows]);
    const groupedSessions = useMemo(() => groupCountSessions(sessions), [sessions]);

    // Categories available in current dataset
    const activeCategories = useMemo(() => {
        const source = view === 'day' ? rows : ranking.rows;
        const present = new Set(source.map(r => r.category).filter(Boolean));
        const ordered = categories.filter(c => present.has(c.id));
        for (const id of present) {
            if (!ordered.some(c => c.id === id)) ordered.push({ id, label: catLabel(id) });
        }
        return ordered;
    }, [view, rows, ranking.rows, categories, catLabel]);

    const normalizedSearch = search.trim().toLowerCase();

    const visibleDayRows = useMemo(() => {
        const sorted = sortReconciliation(rows, thresholds);
        return sorted.filter(r => {
            if (filter === 'abnormal' && !isAbnormal(r, thresholds)) return false;
            if (filter === 'counted' && (r.closing_qty === null || r.closing_qty === undefined)) return false;
            if (filter === 'sold' && !(Number(r.sales_usage) > 0)) return false;
            if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
            if (normalizedSearch) {
                const hay = `${r.name || ''} ${catLabel(r.category)}`.toLowerCase();
                if (!hay.includes(normalizedSearch)) return false;
            }
            return true;
        });
    }, [rows, filter, thresholds, categoryFilter, normalizedSearch, catLabel]);

    const visibleRankRows = useMemo(() => {
        return ranking.rows.filter(r => {
            if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
            if (normalizedSearch) {
                const hay = `${r.name || ''} ${catLabel(r.category)}`.toLowerCase();
                if (!hay.includes(normalizedSearch)) return false;
            }
            return true;
        });
    }, [ranking.rows, categoryFilter, normalizedSearch, catLabel]);

    const missingRpc = error && (error.code === 'PGRST202' || /could not find the function/i.test(error.message || ''));

    const selectFilter = (next) => {
        setManualFilter(true);
        setFilter(next);
    };

    const runExport = async (mode) => {
        if (exporting) return;
        setExporting(true);
        const toastId = toast.loading(mode === 'copy' ? 'กำลังคัดลอกรูปรายงาน...' : 'กำลังบันทึก PNG...');
        try {
            const url = await exportElementImage(reportRef.current, 1120);
            if (!url) throw new Error('แปลงเป็นรูปไม่สำเร็จ');
            if (mode === 'copy') {
                await copyDataUrlImage(url);
                toast.success('คัดลอกรูปแล้ว วางส่งใน LINE ได้เลย', { id: toastId });
            } else {
                downloadDataUrl(url, view === 'day' ? `STOCK_RECON_${day}.png` : `STOCK_VARIANCE_${view}D_${day}.png`);
                toast.success('บันทึกไฟล์ PNG แล้ว', { id: toastId });
            }
        } catch (err) {
            console.error(err);
            toast.error('ส่งออกไม่สำเร็จ: ' + (err?.message || ''), { id: toastId });
        } finally {
            setExporting(false);
        }
    };

    // Movement summary chips for compact desktop/mobile views (only non-zero entries)
    const movementParts = (r) => {
        const parts = [];
        if (Number(r.received) > 0) parts.push({ label: 'รับเข้า', text: `+${fmtQty(r.received, r)}`, tone: 'ink' });
        if (Number(r.produced) > 0) parts.push({ label: 'ผลิต', text: `+${fmtQty(r.produced, r)}`, tone: 'ink' });
        if (Number(r.used_in_production) > 0) parts.push({ label: 'ใช้ผลิต', text: `-${fmtQty(r.used_in_production, r)}`, tone: 'muted' });
        if (Number(r.waste) > 0) parts.push({ label: 'เสีย', text: `-${fmtQty(r.waste, r)}`, tone: 'plum' });
        if (Number(r.other_out) > 0) parts.push({ label: 'เบิกอื่น', text: `-${fmtQty(r.other_out, r)}`, tone: 'muted' });
        return parts;
    };

    const thCell = 'px-3.5 py-2.5 text-right text-[12px] leading-5 font-bold text-[var(--color-muted)] whitespace-nowrap';
    const tdCell = 'px-3.5 py-3 text-right text-[14px] leading-5 tabular-nums whitespace-nowrap align-top';

    return (
        <div className="font-sans text-[var(--color-ink)] space-y-4 min-w-0">
            {/* Top Controls Header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="font-sans font-bold text-xl leading-8 text-[var(--color-ink)]">
                        {view === 'day' ? 'กระทบยอดสต๊อกรายวัน' : `อันดับผลต่างสะสม ${view} วัน`}
                    </h2>
                    <p className="text-[13px] leading-5 text-[var(--color-muted)] mt-0.5">
                        {view === 'day'
                            ? 'เทียบยอดที่ควรเหลือจากสูตรขายกับยอดนับจริงของวัน (รวมการนับรายตัวจากหน้าคลัง) ตัดรอบ 05:00'
                            : 'รวมผลต่างทุกวันที่มีการนับจริง เพื่อดูวัตถุดิบที่ขาดซ้ำหรือต้องปรับสูตร'}
                    </p>
                </div>

                {/* Controls cluster */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Period Switch */}
                    <div
                        className="inline-flex border border-[var(--color-rule)] divide-x divide-[var(--color-rule)] bg-[var(--color-paper)]"
                        role="tablist"
                        aria-label="ช่วงรายงาน"
                    >
                        {[['day', 'รายวัน'], [7, 'สะสม 7 วัน'], [30, 'สะสม 30 วัน']].map(([v, label]) => {
                            const active = view === v;
                            return (
                                <button
                                    key={v}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => setView(v)}
                                    className={`px-3.5 min-h-[42px] text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors ${FOCUS} ${active ? 'bg-[var(--brand-plum)] text-[var(--color-paper)]' : 'text-[var(--color-muted)] hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]'}`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Date Stepper */}
                    <div className="inline-flex border border-[var(--color-rule)] divide-x divide-[var(--color-rule)] bg-[var(--color-paper)]">
                        <button
                            type="button"
                            onClick={() => setDay(d => addDays(d, -1))}
                            aria-label="วันก่อนหน้า"
                            className={`px-3 min-h-[42px] text-[13px] font-bold text-[var(--color-muted)] hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)] cursor-pointer whitespace-nowrap transition-colors ${FOCUS}`}
                        >
                            ก่อนหน้า
                        </button>
                        <input
                            type="date"
                            value={day}
                            max={today}
                            onChange={e => e.target.value && setDay(e.target.value)}
                            aria-label="วันทำการ"
                            className={`px-2.5 min-h-[42px] text-[13px] font-mono tabular-nums bg-[var(--color-paper)] text-[var(--color-ink)] ${FOCUS}`}
                        />
                        {day < today && (
                            <button
                                type="button"
                                onClick={() => setDay(today)}
                                className={`px-3 min-h-[42px] text-[13px] font-bold text-[var(--brand-plum)] hover:bg-[var(--color-paper-2)] cursor-pointer whitespace-nowrap transition-colors ${FOCUS}`}
                            >
                                วันนี้
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setDay(d => addDays(d, 1))}
                            disabled={day >= today}
                            aria-label="วันถัดไป"
                            className={`px-3 min-h-[42px] text-[13px] font-bold text-[var(--color-muted)] hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap transition-colors ${FOCUS}`}
                        >
                            ถัดไป
                        </button>
                    </div>

                    {/* Digital Export Actions (Back-Office Policy: PNG + Copy Image only) */}
                    <button
                        type="button"
                        onClick={() => runExport('png')}
                        disabled={exporting || (view === 'day' ? loading : ranking.loading)}
                        className={`px-3.5 min-h-[42px] border border-[var(--color-rule)] bg-[var(--color-paper)] text-[13px] font-bold text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] disabled:opacity-40 cursor-pointer whitespace-nowrap transition-colors ${FOCUS}`}
                    >
                        บันทึก PNG
                    </button>
                    <button
                        type="button"
                        onClick={() => runExport('copy')}
                        disabled={exporting || (view === 'day' ? loading : ranking.loading)}
                        className={`px-4 min-h-[42px] bg-[var(--color-ink)] text-[var(--color-paper)] text-[13px] font-bold hover:bg-[var(--action-primary-hover)] disabled:opacity-40 cursor-pointer whitespace-nowrap transition-colors ${FOCUS}`}
                    >
                        คัดลอกรูป (LINE)
                    </button>
                </div>
            </div>

            {/* Shadow Mode / Deduction Status Banner (Brand Plum structural banner) */}
            <div className="border border-[var(--color-rule)] bg-[var(--color-paper)]">
                <div className={`px-4 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 ${deductionMode === 'shadow' ? 'bg-[var(--brand-plum)] text-[var(--color-paper)]' : 'bg-[var(--color-paper-2)] text-[var(--color-ink)]'}`}>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 min-w-0">
                        <span className="font-bold text-[14px] leading-6 whitespace-nowrap">
                            {deductionMode === 'shadow'
                                ? 'โหมดเทียบสูตร (Shadow)'
                                : deductionMode === 'live'
                                    ? 'โหมดตัดสต๊อกจริง (Live)'
                                    : 'ปิดการคำนวณจากยอดขาย'}
                        </span>
                        <span className={`text-[13px] leading-5 ${deductionMode === 'shadow' ? 'text-[var(--on-plum-2)]' : 'text-[var(--color-muted)]'}`}>
                            {deductionMode === 'shadow'
                                ? 'หักยอดขายสะสมตั้งแต่นับครั้งก่อนให้อัตโนมัติ (รอบนับชนรอบนับ) ไม่ต้องนับทุกวัน ยังไม่ตัดสต๊อกจริง'
                                : deductionMode === 'live'
                                    ? 'ระบบหักสต๊อกอัตโนมัติตามสูตรเมื่อขาย'
                                    : 'ยังไม่บันทึกยอดใช้จากยอดขาย'}
                        </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0" data-export-hide>
                        <span className={`text-[12px] leading-5 tabular-nums ${deductionMode === 'shadow' ? 'text-[var(--on-plum-2)]' : 'text-[var(--color-muted)]'}`}>
                            เกณฑ์ผิดปกติ: เกิน {thresholds.percent}% และ ฿{thresholds.baht}
                        </span>
                        <button
                            type="button"
                            onClick={() => setThDraft(d => d ? null : { percent: String(thresholds.percent), baht: String(thresholds.baht) })}
                            className={`px-2.5 py-1 text-[12px] font-bold whitespace-nowrap cursor-pointer transition-colors ${FOCUS} ${deductionMode === 'shadow' ? 'bg-[var(--brand-plum-2)] text-[var(--color-paper)] hover:bg-[var(--brand-plum-3)]' : 'border border-[var(--color-rule)] bg-[var(--color-paper)] text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]'}`}
                        >
                            {thDraft ? 'ปิด' : 'ตั้งเกณฑ์'}
                        </button>
                    </div>
                </div>

                {/* Inline Threshold Editor (when opened) */}
                {thDraft && (
                    <div className="px-4 py-3 border-t border-[var(--color-rule)] bg-[var(--color-paper-2)] flex flex-wrap items-center gap-2.5 text-[13px]" data-export-hide>
                        <span className="font-bold text-[var(--color-ink)]">แจ้งผิดปกติเมื่อส่วนต่างเกิน</span>
                        <label className="inline-flex items-center gap-1.5">
                            <input
                                type="text"
                                inputMode="decimal"
                                value={thDraft.percent}
                                onChange={e => setThDraft(d => ({ ...d, percent: e.target.value }))}
                                aria-label="เปอร์เซ็นต์ส่วนต่าง"
                                className={`w-16 h-9 px-2 border border-[var(--color-rule)] bg-[var(--color-paper)] text-right font-mono tabular-nums text-[var(--color-ink)] ${FOCUS}`}
                            />
                            <span className="text-[var(--color-muted)]">%</span>
                        </label>
                        <span className="text-[var(--color-muted)]">และมูลค่าเกิน</span>
                        <label className="inline-flex items-center gap-1.5">
                            <span className="text-[var(--color-muted)]">฿</span>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={thDraft.baht}
                                onChange={e => setThDraft(d => ({ ...d, baht: e.target.value }))}
                                aria-label="มูลค่าส่วนต่าง (บาท)"
                                className={`w-20 h-9 px-2 border border-[var(--color-rule)] bg-[var(--color-paper)] text-right font-mono tabular-nums text-[var(--color-ink)] ${FOCUS}`}
                            />
                        </label>
                        <span className="text-[12px] text-[var(--color-neutral)]">(รายการที่ยังไม่ตั้งราคาใช้เฉพาะ %)</span>
                        <div className="flex items-center gap-2 ml-auto">
                            <button
                                type="button"
                                onClick={saveThresholds}
                                className={`px-3.5 h-9 bg-[var(--brand-plum)] text-[var(--color-paper)] font-bold text-[13px] cursor-pointer whitespace-nowrap ${FOCUS}`}
                            >
                                บันทึกเกณฑ์
                            </button>
                            <button
                                type="button"
                                onClick={() => setThDraft(null)}
                                className={`px-3 h-9 border border-[var(--color-rule)] bg-[var(--color-paper)] text-[var(--color-muted)] font-bold text-[13px] cursor-pointer whitespace-nowrap ${FOCUS}`}
                            >
                                ยกเลิก
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {missingRpc ? (
                <div className="p-6 border border-[var(--color-rule)] bg-[var(--color-paper)]">
                    <p className="font-bold text-[15px] text-[var(--color-ink)]">ฐานข้อมูลยังไม่มีระบบกระทบยอด</p>
                    <p className="text-[13px] leading-6 text-[var(--color-muted)] mt-1">
                        กรุณาติดตั้ง migration รอบนับและกระทบยอดสต๊อกก่อนใช้งานหน้านี้
                    </p>
                </div>
            ) : view !== 'day' ? (
                /* ──────────────────── 7-DAY / 30-DAY ACCUMULATED VIEW ──────────────────── */
                <div ref={reportRef} className="bg-[var(--color-paper)] border border-[var(--color-rule)]">
                    {/* KPI Strip (4 cells) */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-[var(--color-rule)] border-b border-[var(--color-rule)]">
                        <div className="p-4 col-span-2 lg:col-span-1">
                            <span className="text-[12px] leading-5 text-[var(--color-neutral)] block">ช่วงรายงาน</span>
                            <span className="font-bold text-[16px] leading-6 text-[var(--color-ink)] block mt-0.5">
                                <span className="whitespace-nowrap">{shortDate(shopDayRange(day, view)[0])}</span>
                                {' – '}
                                <span className="whitespace-nowrap">{shortDate(day)}</span>
                            </span>
                            <span className="text-[12px] leading-5 text-[var(--color-muted)] block mt-0.5 tabular-nums">
                                มีการนับจริง {ranking.days} จาก {view} วัน
                            </span>
                        </div>
                        <div className="p-4">
                            <span className="text-[12px] leading-5 text-[var(--color-neutral)] block">รายการที่เคยผิดปกติ</span>
                            <div className="mt-0.5 flex items-baseline gap-1.5">
                                <span className={`font-bold text-2xl leading-8 tabular-nums ${rankSummary.withAbnormal ? 'text-[var(--brand-plum)]' : 'text-[var(--color-ink)]'}`}>
                                    {rankSummary.withAbnormal}
                                </span>
                                <span className="text-[13px] text-[var(--color-neutral)] tabular-nums">/ {rankSummary.items} รายการ</span>
                            </div>
                        </div>
                        <div className="p-4">
                            <span className="text-[12px] leading-5 text-[var(--color-neutral)] block">มูลค่าขาดสะสม</span>
                            <span className={`font-bold text-2xl leading-8 tabular-nums block mt-0.5 ${rankSummary.shortValue < 0 ? 'text-[var(--brand-plum)]' : 'text-[var(--color-ink)]'}`}>
                                {baht(rankSummary.shortValue)}
                            </span>
                        </div>
                        <div className="p-4">
                            <span className="text-[12px] leading-5 text-[var(--color-neutral)] block">สุทธิ (ขาด + เกิน)</span>
                            <span className="font-bold text-2xl leading-8 tabular-nums text-[var(--color-ink)] block mt-0.5">
                                {signedBaht(rankSummary.netValue)}
                            </span>
                        </div>
                    </div>

                    {/* Search & Category Filter for Ranking */}
                    <div className="px-4 py-2.5 border-b border-[var(--color-rule)] bg-[var(--color-paper-2)]/50 flex flex-wrap items-center gap-2.5" data-export-hide>
                        <div className="flex-1 min-w-[200px] max-w-sm flex items-center border border-[var(--color-rule)] bg-[var(--color-paper)] focus-within:border-[var(--color-ink)]">
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="ค้นหาชื่อวัตถุดิบ..."
                                aria-label="ค้นหาชื่อวัตถุดิบ"
                                className="w-full h-10 px-3 bg-transparent text-[14px] text-[var(--color-ink)] placeholder:text-[var(--color-neutral)] focus:outline-none"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className={`px-3 h-10 text-[12px] font-bold text-[var(--color-muted)] hover:text-[var(--color-ink)] cursor-pointer whitespace-nowrap ${FOCUS}`}
                                >
                                    ล้าง
                                </button>
                            )}
                        </div>
                        <select
                            value={categoryFilter}
                            onChange={e => setCategoryFilter(e.target.value)}
                            aria-label="กรองตามหมวดหมู่"
                            className={`h-10 px-3 border border-[var(--color-rule)] bg-[var(--color-paper)] text-[13px] font-medium text-[var(--color-ink)] cursor-pointer ${FOCUS}`}
                        >
                            <option value="all">หมวดหมู่ทั้งหมด</option>
                            {activeCategories.map(c => (
                                <option key={c.id} value={c.id}>{c.label}</option>
                            ))}
                        </select>
                        <span className="text-[12px] text-[var(--color-neutral)] ml-auto tabular-nums">
                            แสดง {visibleRankRows.length} รายการ
                        </span>
                    </div>

                    {/* Ranking Body */}
                    {ranking.loading ? (
                        <div className="p-4 space-y-2.5" aria-busy="true" aria-label={`กำลังรวมข้อมูล ${view} วัน`}>
                            {Array.from({ length: 6 }, (_, i) => (
                                <div key={i} className="h-12 bg-[var(--color-paper-2)]/70 border border-[var(--color-paper-3)]" />
                            ))}
                        </div>
                    ) : ranking.error ? (
                        <div className="p-6 space-y-2">
                            <p className="font-bold text-[15px] text-[var(--error-red)]">โหลดข้อมูลสะสมไม่สำเร็จ</p>
                            <p className="text-[13px] text-[var(--color-muted)]">{ranking.error.message}</p>
                        </div>
                    ) : visibleRankRows.length === 0 ? (
                        <div className="p-6 space-y-2">
                            <p className="text-[15px] leading-6 text-[var(--color-muted)]">
                                {ranking.rows.length === 0
                                    ? 'ยังไม่มีการบันทึกนับสต๊อกในช่วงนี้ จึงยังจัดอันดับผลต่างไม่ได้'
                                    : 'ไม่พบรายการที่ตรงกับคำค้นหาหรือหมวดหมู่ที่เลือก'}
                            </p>
                            {(search || categoryFilter !== 'all') && (
                                <button
                                    type="button"
                                    onClick={() => { setSearch(''); setCategoryFilter('all'); }}
                                    className={`px-3 py-1.5 border border-[var(--color-rule)] bg-[var(--color-paper)] text-[13px] font-bold text-[var(--color-ink)] cursor-pointer ${FOCUS}`}
                                >
                                    ล้างตัวกรอง
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Desktop Ranking Table (always visible in PNG export) */}
                            <div className="hidden md:block overflow-x-auto" data-export-show data-export-unclip>
                                <table className="w-full border-collapse text-[14px]">
                                    <thead className="bg-[var(--color-paper-2)] border-b border-[var(--color-rule)]">
                                        <tr>
                                            <th className={`${thCell} w-12`}>อันดับ</th>
                                            <th className="px-3.5 py-2.5 text-left text-[12px] leading-5 font-bold text-[var(--color-muted)] whitespace-nowrap">วัตถุดิบ</th>
                                            <th className={thCell}>วันที่นับ</th>
                                            <th className={thCell}>วันผิดปกติ</th>
                                            <th className={thCell}>ส่วนต่างสะสม</th>
                                            <th className={thCell}>ขาดสะสม</th>
                                            <th className={thCell}>สุทธิ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--color-paper-3)]">
                                        {visibleRankRows.map((r, i) => (
                                            <tr key={r.stock_item_id} className="hover:bg-[var(--color-paper-2)]/40 transition-colors">
                                                <td className={`${tdCell} text-[var(--color-neutral)] font-mono`}>{i + 1}</td>
                                                <td className="px-3.5 py-3 text-left align-top">
                                                    <button
                                                        type="button"
                                                        onClick={() => setCardFor({ id: r.stock_item_id, name: r.name, unit: r.unit })}
                                                        className={`font-bold text-[15px] leading-6 text-left text-[var(--color-ink)] underline decoration-[var(--color-rule)] underline-offset-4 hover:decoration-[var(--color-ink)] cursor-pointer ${FOCUS}`}
                                                    >
                                                        {r.name}
                                                    </button>
                                                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] leading-5 text-[var(--color-neutral)]">
                                                        <span>{catLabel(r.category)}</span>
                                                        <span>หน่วย {shortUnit(r.unit)}</span>
                                                    </div>
                                                </td>
                                                <td className={tdCell}>{r.daysCounted} วัน</td>
                                                <td className={`${tdCell} font-bold ${r.abnormalDays ? 'text-[var(--brand-plum)]' : 'text-[var(--color-neutral)]'}`}>
                                                    {r.abnormalDays ? `${r.abnormalDays} วัน` : '0'}
                                                </td>
                                                <td className={`${tdCell} font-medium ${r.variance < 0 ? 'text-[var(--brand-plum)]' : 'text-[var(--color-ink)]'}`}>
                                                    {fmtSignedQty(r.variance, r, 3)}
                                                </td>
                                                <td className={`${tdCell} font-bold ${r.shortValue < 0 ? 'text-[var(--brand-plum)]' : 'text-[var(--color-ink)]'}`}>
                                                    {r.priced ? baht(r.shortValue) : <span className="text-[12px] font-normal text-[var(--color-neutral)]">ไม่มีราคา</span>}
                                                </td>
                                                <td className={tdCell}>{r.priced ? signedBaht(r.value) : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Ranking List */}
                            <div className="md:hidden divide-y divide-[var(--color-rule)]" data-export-hide>
                                {visibleRankRows.map((r, i) => (
                                    <div key={r.stock_item_id} className="p-4 space-y-2">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setCardFor({ id: r.stock_item_id, name: r.name, unit: r.unit })}
                                                    className={`font-bold text-[15px] leading-6 text-left text-[var(--color-ink)] underline decoration-[var(--color-rule)] underline-offset-4 cursor-pointer ${FOCUS}`}
                                                >
                                                    <span className="font-mono text-[13px] text-[var(--color-neutral)] mr-1.5">#{i + 1}</span>
                                                    {r.name}
                                                </button>
                                                <div className="text-[12px] leading-5 text-[var(--color-neutral)] mt-0.5">
                                                    {catLabel(r.category)}
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0 tabular-nums">
                                                <span className={`block font-bold text-[15px] leading-6 ${r.shortValue < 0 ? 'text-[var(--brand-plum)]' : 'text-[var(--color-ink)]'}`}>
                                                    {r.priced ? baht(r.shortValue) : 'ไม่มีราคา'}
                                                </span>
                                                <span className={`block text-[12px] leading-5 ${r.variance < 0 ? 'text-[var(--brand-plum)]' : 'text-[var(--color-muted)]'}`}>
                                                    {fmtSignedQty(r.variance, r, 3)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--color-paper-3)] text-[12px] tabular-nums">
                                            <div>
                                                <span className="text-[var(--color-neutral)] block">วันที่นับ</span>
                                                <span className="font-bold text-[var(--color-ink)]">{r.daysCounted} วัน</span>
                                            </div>
                                            <div>
                                                <span className="text-[var(--color-neutral)] block">ผิดปกติ</span>
                                                <span className={`font-bold ${r.abnormalDays ? 'text-[var(--brand-plum)]' : 'text-[var(--color-ink)]'}`}>{r.abnormalDays} วัน</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[var(--color-neutral)] block">สุทธิ</span>
                                                <span className="font-bold text-[var(--color-ink)]">{r.priced ? signedBaht(r.value) : '—'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Breakdown by Counter */}
                    {ranking.counters?.length > 0 && (
                        <div className="border-t border-[var(--color-rule)]">
                            <div className="px-4 py-3 bg-[var(--color-paper-2)]/60 border-b border-[var(--color-rule)]">
                                <h3 className="font-bold text-[14px] leading-5 text-[var(--color-ink)]">สรุปตามผู้บันทึกการนับ</h3>
                            </div>
                            <div className="overflow-x-auto" data-export-unclip>
                                <table className="w-full min-w-[460px] border-collapse text-[14px]">
                                    <thead className="bg-[var(--color-paper-2)] border-b border-[var(--color-rule)]">
                                        <tr>
                                            <th className="px-3.5 py-2 text-left text-[12px] leading-5 font-bold text-[var(--color-muted)]">ผู้นับ</th>
                                            <th className={thCell}>วันที่นับ</th>
                                            <th className={thCell}>รายการที่นับ</th>
                                            <th className={thCell}>ผิดปกติ</th>
                                            <th className={thCell}>ขาดสะสม</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--color-paper-3)]">
                                        {ranking.counters.map(c => (
                                            <tr key={c.name}>
                                                <td className="px-3.5 py-2.5 font-bold text-[14px] leading-5 text-[var(--color-ink)] break-words">{c.name}</td>
                                                <td className={tdCell}>{c.days} วัน</td>
                                                <td className={tdCell}>{c.items}</td>
                                                <td className={`${tdCell} ${c.abnormal ? 'text-[var(--brand-plum)] font-bold' : 'text-[var(--color-neutral)]'}`}>{c.abnormal}</td>
                                                <td className={`${tdCell} font-bold ${c.shortValue < 0 ? 'text-[var(--brand-plum)]' : ''}`}>{baht(c.shortValue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <p className="px-4 py-3 border-t border-[var(--color-rule)] text-[12px] leading-5 text-[var(--color-neutral)]">
                        รวมเฉพาะวันที่มีการนับจริง เรียงจากมูลค่าขาดมากสุด รายการที่ขาดซ้ำทุกวันในสัดส่วนเดิมมักแปลว่าสูตรตั้งไว้น้อยกว่าที่ทำจริง กดชื่อวัตถุดิบเพื่อดูประวัติและเมนูที่คำนวณใช้
                    </p>
                </div>
            ) : (
                /* ──────────────────── DAILY RECONCILIATION VIEW ──────────────────── */
                <div ref={reportRef} className="bg-[var(--color-paper)] border border-[var(--color-rule)]">
                    {/* KPI Strip (4 interactive cells) */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-[var(--color-rule)] border-b border-[var(--color-rule)]">
                        <button
                            type="button"
                            onClick={() => selectFilter('abnormal')}
                            aria-pressed={filter === 'abnormal'}
                            className={`relative p-4 text-left cursor-pointer transition-colors hover:bg-[var(--color-paper-2)]/50 ${FOCUS} ${filter === 'abnormal' ? 'bg-[var(--color-paper-2)]/60' : ''}`}
                        >
                            <span className="text-[12px] leading-5 text-[var(--color-muted)] block">ต้องตรวจสอบ (ผิดปกติ)</span>
                            <div className="mt-0.5 flex items-baseline gap-1.5">
                                <span className={`font-bold text-2xl leading-8 tabular-nums ${summary.abnormal > 0 ? 'text-[var(--brand-plum)]' : 'text-[var(--color-ink)]'}`}>
                                    {summary.abnormal}
                                </span>
                                <span className="text-[13px] text-[var(--color-neutral)]">รายการ</span>
                            </div>
                            <span className="text-[12px] leading-5 text-[var(--color-neutral)] block mt-0.5 tabular-nums">
                                {summary.abnormal > 0
                                    ? `ขาด ${summary.abnormalShort} เกิน ${summary.abnormalOver}`
                                    : (summary.counted > 0 ? 'อยู่ในเกณฑ์ทั้งหมด' : 'ยังไม่มีการนับวันนี้')}
                            </span>
                            {filter === 'abnormal' && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--brand-plum)]" data-export-hide />}
                        </button>

                        <button
                            type="button"
                            onClick={() => selectFilter('counted')}
                            aria-pressed={filter === 'counted'}
                            className={`relative p-4 text-left cursor-pointer transition-colors hover:bg-[var(--color-paper-2)]/50 ${FOCUS} ${filter === 'counted' ? 'bg-[var(--color-paper-2)]/60' : ''}`}
                        >
                            <span className="text-[12px] leading-5 text-[var(--color-muted)] block">นับจริงแล้ววันนี้</span>
                            <div className="mt-0.5 flex items-baseline gap-1.5">
                                <span className="font-bold text-2xl leading-8 tabular-nums text-[var(--color-ink)]">
                                    {summary.counted}
                                </span>
                                <span className="text-[13px] text-[var(--color-neutral)] tabular-nums">/ {summary.items} รายการ</span>
                            </div>
                            <span className="text-[12px] leading-5 text-[var(--color-neutral)] block mt-0.5 tabular-nums">
                                ตรงหรือใกล้เคียง {summary.matched} รายการ
                            </span>
                            {filter === 'counted' && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--color-ink)]" data-export-hide />}
                        </button>

                        <div className="p-4 text-left">
                            <span className="text-[12px] leading-5 text-[var(--color-muted)] block">มูลค่าขาด / เกิน</span>
                            <span className={`font-bold text-2xl leading-8 tabular-nums block mt-0.5 ${summary.shortValue < 0 ? 'text-[var(--brand-plum)]' : 'text-[var(--color-ink)]'}`}>
                                {baht(summary.shortValue)}
                            </span>
                            <span className="text-[12px] leading-5 text-[var(--color-neutral)] block mt-0.5 tabular-nums">
                                เกิน {baht(summary.overValue)}
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={() => selectFilter('sold')}
                            aria-pressed={filter === 'sold'}
                            className={`relative p-4 text-left cursor-pointer transition-colors hover:bg-[var(--color-paper-2)]/50 ${FOCUS} ${filter === 'sold' ? 'bg-[var(--color-paper-2)]/60' : ''}`}
                        >
                            <span className="text-[12px] leading-5 text-[var(--color-muted)] block">ใช้จากยอดขาย (Shadow)</span>
                            <div className="mt-0.5 flex items-baseline gap-1.5">
                                <span className="font-bold text-2xl leading-8 tabular-nums text-[var(--color-ink)]">
                                    {summary.sold}
                                </span>
                                <span className="text-[13px] text-[var(--color-neutral)]">วัตถุดิบ</span>
                            </div>
                            <span className="text-[12px] leading-5 text-[var(--color-neutral)] block mt-0.5">
                                {thaiDate(day)}
                            </span>
                            {filter === 'sold' && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--color-ink)]" data-export-hide />}
                        </button>
                    </div>

                    {/* Grouped Count Activity Strip (collapses 100+ single-item spot counts into clean per-staff blocks) */}
                    <div className="px-4 py-2.5 border-b border-[var(--color-rule)] bg-[var(--color-paper-2)]/40 flex flex-wrap items-center gap-2 text-[12px] leading-5">
                        <span className="font-bold text-[var(--color-ink)] shrink-0">การนับวันนี้</span>
                        {groupedSessions.length === 0 ? (
                            <span className="text-[var(--color-muted)]">
                                ยังไม่มีการบันทึกนับสต๊อกในวันนี้ ยอดเปิดอ้างอิงยอดคงเหลือตอน 05:00
                            </span>
                        ) : (
                            <div className="flex flex-wrap items-center gap-2">
                                {groupedSessions.map(g => {
                                    const first = timeOf(g.firstAt);
                                    const last = timeOf(g.lastAt);
                                    const range = first && last && first !== last ? `${first}–${last}` : first;
                                    return (
                                        <div
                                            key={g.key}
                                            className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 px-2.5 py-1 border border-[var(--color-rule)] bg-[var(--color-paper)]"
                                        >
                                            <span className="font-bold text-[var(--brand-plum)]">{kindShortLabel(g.kind)}</span>
                                            <span className="font-bold text-[var(--color-ink)]">{g.performedBy}</span>
                                            <span className="tabular-nums text-[var(--color-muted)]">{g.lineCount} รายการ</span>
                                            {range && <span className="font-mono tabular-nums text-[var(--color-neutral)]">{range}</span>}
                                            {g.blind && <span className="text-[var(--color-neutral)]">(ปิดยอดระบบ)</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Filter Tabs + Search + Category + Column Mode Toolbar */}
                    <div className="border-b border-[var(--color-rule)] divide-y divide-[var(--color-rule)]" data-export-hide>
                        {/* Row 1: Filter Tabs */}
                        <div className="flex overflow-x-auto divide-x divide-[var(--color-rule)]" role="tablist" aria-label="กรองรายการกระทบยอด">
                            {[
                                ['abnormal', 'ต้องตรวจ', summary.abnormal],
                                ['counted', 'นับแล้ววันนี้', summary.counted],
                                ['sold', 'ใช้จากยอดขาย', summary.sold],
                                ['all', 'ทั้งหมด', summary.items]
                            ].map(([v, label, count]) => {
                                const active = filter === v;
                                return (
                                    <button
                                        key={v}
                                        type="button"
                                        role="tab"
                                        aria-selected={active}
                                        onClick={() => selectFilter(v)}
                                        className={`px-4 min-h-[44px] text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors flex items-center gap-2 shrink-0 ${FOCUS} ${active ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' : 'bg-[var(--color-paper)] text-[var(--color-muted)] hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]'}`}
                                    >
                                        <span>{label}</span>
                                        <span className={`font-mono text-[12px] tabular-nums ${active ? 'text-[var(--color-paper)]' : (v === 'abnormal' && count > 0 ? 'text-[var(--brand-plum)]' : 'text-[var(--color-neutral)]')}`}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Row 2: Search, Category, Density */}
                        <div className="px-4 py-2.5 bg-[var(--color-paper)] flex flex-wrap items-center gap-2.5">
                            <div className="flex-1 min-w-[190px] max-w-sm flex items-center border border-[var(--color-rule)] bg-[var(--color-paper)] focus-within:border-[var(--color-ink)]">
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="ค้นหาชื่อวัตถุดิบ..."
                                    aria-label="ค้นหาชื่อวัตถุดิบ"
                                    className="w-full h-10 px-3 bg-transparent text-[14px] text-[var(--color-ink)] placeholder:text-[var(--color-neutral)] focus:outline-none"
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => setSearch('')}
                                        className={`px-3 h-10 text-[12px] font-bold text-[var(--color-muted)] hover:text-[var(--color-ink)] cursor-pointer whitespace-nowrap ${FOCUS}`}
                                    >
                                        ล้าง
                                    </button>
                                )}
                            </div>

                            <select
                                value={categoryFilter}
                                onChange={e => setCategoryFilter(e.target.value)}
                                aria-label="กรองตามหมวดหมู่"
                                className={`h-10 px-3 border border-[var(--color-rule)] bg-[var(--color-paper)] text-[13px] font-medium text-[var(--color-ink)] cursor-pointer ${FOCUS}`}
                            >
                                <option value="all">หมวดหมู่ทั้งหมด</option>
                                {activeCategories.map(c => (
                                    <option key={c.id} value={c.id}>{c.label}</option>
                                ))}
                            </select>

                            <div className="hidden md:inline-flex border border-[var(--color-rule)] divide-x divide-[var(--color-rule)] ml-auto">
                                <button
                                    type="button"
                                    onClick={() => setDenseCols(false)}
                                    aria-pressed={!denseCols}
                                    className={`px-3 h-10 text-[12px] font-bold whitespace-nowrap cursor-pointer transition-colors ${FOCUS} ${!denseCols ? 'bg-[var(--color-paper-2)] text-[var(--color-ink)]' : 'bg-[var(--color-paper)] text-[var(--color-muted)] hover:bg-[var(--color-paper-2)]/50'}`}
                                >
                                    มุมมองอ่านง่าย
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDenseCols(true)}
                                    aria-pressed={denseCols}
                                    className={`px-3 h-10 text-[12px] font-bold whitespace-nowrap cursor-pointer transition-colors ${FOCUS} ${denseCols ? 'bg-[var(--color-paper-2)] text-[var(--color-ink)]' : 'bg-[var(--color-paper)] text-[var(--color-muted)] hover:bg-[var(--color-paper-2)]/50'}`}
                                >
                                    ตารางละเอียด
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Area: Loading / Error / Empty / Data */}
                    {loading ? (
                        <div className="p-4 space-y-2.5" aria-busy="true" aria-label="กำลังโหลดข้อมูลกระทบยอด">
                            {Array.from({ length: 6 }, (_, i) => (
                                <div key={i} className="h-14 bg-[var(--color-paper-2)]/70 border border-[var(--color-paper-3)]" />
                            ))}
                        </div>
                    ) : error ? (
                        <div className="p-6 space-y-3">
                            <div>
                                <p className="font-bold text-[15px] text-[var(--error-red)]">โหลดข้อมูลไม่สำเร็จ</p>
                                <p className="text-[13px] leading-5 text-[var(--color-muted)] mt-0.5">{error.message}</p>
                            </div>
                            <button
                                type="button"
                                onClick={loadDay}
                                className={`px-4 h-10 border border-[var(--color-rule)] bg-[var(--color-paper)] text-[13px] font-bold text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] cursor-pointer ${FOCUS}`}
                            >
                                ลองโหลดใหม่
                            </button>
                        </div>
                    ) : visibleDayRows.length === 0 ? (
                        <div className="p-6 space-y-3">
                            <p className="text-[15px] leading-6 text-[var(--color-muted)]">
                                {search || categoryFilter !== 'all'
                                    ? 'ไม่พบวัตถุดิบที่ตรงกับคำค้นหาหรือหมวดหมู่ที่เลือก'
                                    : filter === 'abnormal'
                                        ? (summary.counted > 0
                                            ? 'ไม่มีรายการที่ส่วนต่างเกินเกณฑ์ผิดปกติในวันนี้'
                                            : 'ยังไม่มีการนับสต๊อกในวันนี้ จึงยังไม่มีผลต่าง')
                                        : filter === 'counted'
                                            ? 'ยังไม่มีรายการที่ถูกนับจริงในวันนี้'
                                            : filter === 'sold'
                                                ? 'ยังไม่มียอดใช้จากสูตรขายในวันนี้'
                                                : 'ไม่มีความเคลื่อนไหวของสต๊อกในวันนี้'}
                            </p>
                            <div className="flex flex-wrap gap-2" data-export-hide>
                                {(search || categoryFilter !== 'all') && (
                                    <button
                                        type="button"
                                        onClick={() => { setSearch(''); setCategoryFilter('all'); }}
                                        className={`px-3.5 h-10 border border-[var(--color-rule)] bg-[var(--color-paper)] text-[13px] font-bold text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] cursor-pointer ${FOCUS}`}
                                    >
                                        ล้างตัวกรอง
                                    </button>
                                )}
                                {filter !== 'all' && rows.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => selectFilter('all')}
                                        className={`px-3.5 h-10 border border-[var(--color-rule)] bg-[var(--color-paper)] text-[13px] font-bold text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] cursor-pointer ${FOCUS}`}
                                    >
                                        ดูทั้งหมด ({rows.length} รายการ)
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table (always rendered into 1120px PNG export via data-export-show) */}
                            <div className="hidden md:block overflow-x-auto" data-export-show data-export-unclip>
                                {!denseCols ? (
                                    /* Readable 6-column Ledger (zero horizontal scroll!) */
                                    <table className="w-full border-collapse text-[14px]">
                                        <thead className="bg-[var(--color-paper-2)] border-b border-[var(--color-rule)]">
                                            <tr>
                                                <th className="px-4 py-2.5 text-left text-[12px] leading-5 font-bold text-[var(--color-muted)]">วัตถุดิบ / สถานะ</th>
                                                <th className={thCell}>ยอดเปิด / เคลื่อนไหว</th>
                                                <th className={thCell}>ใช้จากยอดขาย</th>
                                                <th className={thCell}>ควรเหลือ</th>
                                                <th className={thCell}>นับจริง</th>
                                                <th className={`${thCell} pr-4`}>ส่วนต่าง / มูลค่า</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--color-paper-3)]">
                                            {visibleDayRows.map(r => {
                                                const info = classifyReconRow(r, thresholds);
                                                const moves = movementParts(r);
                                                const carry = carryoverByItem[r.stock_item_id] || null;
                                                const priorShadow = Number(carry?.prior_shadow_usage) || 0;
                                                const v = Number(r.variance);
                                                const counted = r.closing_qty !== null && r.closing_qty !== undefined;
                                                const salesNum = Number(r.sales_usage) || 0;
                                                return (
                                                    <tr key={r.stock_item_id} className="hover:bg-[var(--color-paper-2)]/35 transition-colors">
                                                        <td className="px-4 py-3 text-left align-top max-w-[340px]">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setCardFor({ id: r.stock_item_id, name: r.name, unit: r.unit })}
                                                                    className={`font-bold text-[15px] leading-6 text-left text-[var(--color-ink)] underline decoration-[var(--color-rule)] underline-offset-4 hover:decoration-[var(--color-ink)] cursor-pointer break-words ${FOCUS}`}
                                                                >
                                                                    {r.name}
                                                                </button>
                                                                <span className={`inline-block px-2 py-0.5 text-[11px] leading-4 border whitespace-nowrap ${statusBadgeClass(info.tone)}`}>
                                                                    {info.label}
                                                                </span>
                                                            </div>
                                                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] leading-5 text-[var(--color-neutral)]">
                                                                <span>{catLabel(r.category)}</span>
                                                                {r.closing_counted_at && (
                                                                    <span className="tabular-nums">นับ <span className="font-mono">{timeOf(r.closing_counted_at)}</span></span>
                                                                )}
                                                                {carry?.anchor_at && Number(carry.days_since_anchor) > 1 && (
                                                                    <span className="tabular-nums">
                                                                        รอบก่อน {dayMonthIso(carry.anchor_at)} ({carry.days_since_anchor} วัน)
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {info.hint && (
                                                                <p className={`mt-1 text-[12px] leading-5 ${info.tone === 'plum' ? 'text-[var(--brand-plum)] font-medium' : 'text-[var(--color-muted)]'}`}>
                                                                    {info.hint}
                                                                </p>
                                                            )}
                                                        </td>

                                                        <td className={tdCell}>
                                                            <span className="block text-[var(--color-ink)]">{fmtQty(r.opening_qty, r)}</span>
                                                            {priorShadow > 0 && (
                                                                <span className="block mt-0.5 text-[11px] leading-4 text-[var(--color-neutral)]">
                                                                    หักขายค้าง -{fmtQty(priorShadow, r)} ({dayMonthIso(carry.anchor_at)})
                                                                </span>
                                                            )}
                                                            {moves.length > 0 && (
                                                                <div className="mt-1 flex flex-col items-end gap-0.5 text-[12px] leading-4">
                                                                    {moves.map(m => (
                                                                        <span
                                                                            key={m.label}
                                                                            className={m.tone === 'plum' ? 'text-[var(--brand-plum)] font-medium' : 'text-[var(--color-muted)]'}
                                                                        >
                                                                            {m.label} {m.text}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </td>

                                                        <td className={`${tdCell} ${salesNum > 0 ? 'text-[var(--color-ink)] font-medium' : 'text-[var(--color-neutral)]'}`}>
                                                            {salesNum > 0 ? `-${fmtQty(salesNum, r)}` : '0'}
                                                        </td>

                                                        <td className={`${tdCell} font-bold text-[var(--color-ink)]`}>
                                                            {fmtQty(r.expected_close, r)}
                                                        </td>

                                                        <td className={`${tdCell} font-bold ${counted ? 'text-[var(--color-ink)]' : 'text-[var(--color-neutral)] font-normal'}`}>
                                                            {counted ? fmtQty(r.closing_qty, r) : 'รอนับ'}
                                                        </td>

                                                        <td className={`${tdCell} pr-4`}>
                                                            {!counted ? (
                                                                <span className="text-[12px] text-[var(--color-neutral)]">รอนับ</span>
                                                            ) : (
                                                                <>
                                                                    <div className={`font-bold ${info.tone === 'plum' || v < 0 ? 'text-[var(--brand-plum)]' : 'text-[var(--color-ink)]'}`}>
                                                                        {fmtSignedQty(v, r)}
                                                                        {info.pct !== null && Math.abs(v) >= 0.00005 && (
                                                                            <span className="ml-1.5 font-mono text-[12px] font-normal text-[var(--color-muted)]">
                                                                                ({info.pct > 0 ? '+' : ''}{Math.round(info.pct)}%)
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className={`mt-0.5 text-[12px] leading-5 ${Number(r.variance_value) < 0 ? 'text-[var(--brand-plum)] font-medium' : 'text-[var(--color-muted)]'}`}>
                                                                        {Number(r.unit_cost) > 0 ? signedBaht(r.variance_value) : 'ยังไม่มีราคา'}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                ) : (
                                    /* Detailed 11-column Accounting Breakdown */
                                    <table className="w-full min-w-[980px] border-collapse text-[13px]">
                                        <thead className="bg-[var(--color-paper-2)] border-b border-[var(--color-rule)]">
                                            <tr>
                                                <th className="px-3.5 py-2.5 text-left text-[12px] leading-5 font-bold text-[var(--color-muted)] whitespace-nowrap sticky left-0 bg-[var(--color-paper-2)]">รายการ</th>
                                                <th className={thCell}>ยอดเปิด</th>
                                                <th className={thCell}>รับเข้า</th>
                                                <th className={thCell}>ผลิต</th>
                                                <th className={thCell}>ใช้ผลิต</th>
                                                <th className={thCell}>เสีย</th>
                                                <th className={thCell}>ใช้จากยอดขาย</th>
                                                <th className={thCell}>ควรเหลือ</th>
                                                <th className={thCell}>นับจริง</th>
                                                <th className={thCell}>ส่วนต่าง</th>
                                                <th className={thCell}>มูลค่า</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--color-paper-3)]">
                                            {visibleDayRows.map(r => {
                                                const info = classifyReconRow(r, thresholds);
                                                const v = Number(r.variance);
                                                const counted = r.closing_qty !== null && r.closing_qty !== undefined;
                                                return (
                                                    <tr key={r.stock_item_id} className="hover:bg-[var(--color-paper-2)]/35 transition-colors">
                                                        <td className="px-3.5 py-2.5 text-left sticky left-0 bg-[var(--color-paper)] align-top">
                                                            <button
                                                                type="button"
                                                                onClick={() => setCardFor({ id: r.stock_item_id, name: r.name, unit: r.unit })}
                                                                className={`font-bold text-[14px] leading-5 block text-left underline decoration-[var(--color-rule)] underline-offset-2 hover:decoration-[var(--color-ink)] cursor-pointer ${FOCUS}`}
                                                            >
                                                                {r.name}
                                                            </button>
                                                            <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] leading-4 text-[var(--color-neutral)]">
                                                                <span>{catLabel(r.category)}</span>
                                                                {r.closing_counted_at && <span className="tabular-nums">นับ <span className="font-mono">{timeOf(r.closing_counted_at)}</span></span>}
                                                            </div>
                                                        </td>
                                                        <td className={tdCell}>{fmtQty(r.opening_qty, r)}</td>
                                                        <td className={tdCell}>{fmtQty(r.received, r)}</td>
                                                        <td className={tdCell}>{fmtQty(r.produced, r)}</td>
                                                        <td className={tdCell}>{fmtQty(r.used_in_production, r)}</td>
                                                        <td className={tdCell}>{fmtQty(r.waste, r)}</td>
                                                        <td className={tdCell}>{fmtQty(r.sales_usage, r)}</td>
                                                        <td className={`${tdCell} font-bold`}>{fmtQty(r.expected_close, r)}</td>
                                                        <td className={`${tdCell} font-bold`}>{counted ? fmtQty(r.closing_qty, r) : '—'}</td>
                                                        <td className={`${tdCell} font-bold ${info.tone === 'plum' || v < 0 ? 'text-[var(--brand-plum)]' : ''}`}>
                                                            {counted ? fmtSignedQty(v, r) : '—'}
                                                        </td>
                                                        <td className={`${tdCell} ${Number(r.variance_value) < 0 ? 'text-[var(--brand-plum)] font-bold' : ''}`}>
                                                            {!counted ? '—' : (Number(r.unit_cost) > 0 ? signedBaht(r.variance_value) : <span className="text-[12px] text-[var(--color-neutral)]">ไม่มีราคา</span>)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* Mobile Structured Ledger List (zero horizontal scroll on phones) */}
                            <div className="md:hidden divide-y divide-[var(--color-rule)]" data-export-hide>
                                {visibleDayRows.map(r => {
                                    const info = classifyReconRow(r, thresholds);
                                    const moves = movementParts(r);
                                    const carry = carryoverByItem[r.stock_item_id] || null;
                                    const priorShadow = Number(carry?.prior_shadow_usage) || 0;
                                    const v = Number(r.variance);
                                    const counted = r.closing_qty !== null && r.closing_qty !== undefined;
                                    const salesNum = Number(r.sales_usage) || 0;
                                    return (
                                        <div key={r.stock_item_id} className="p-4 space-y-2.5 bg-[var(--color-paper)]">
                                            {/* Row Header: Name + Status + Variance */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => setCardFor({ id: r.stock_item_id, name: r.name, unit: r.unit })}
                                                        className={`font-bold text-[15px] leading-6 text-left text-[var(--color-ink)] underline decoration-[var(--color-rule)] underline-offset-4 cursor-pointer break-words ${FOCUS}`}
                                                    >
                                                        {r.name}
                                                    </button>
                                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] leading-5">
                                                        <span className={`inline-block px-2 py-0.5 text-[11px] leading-4 border ${statusBadgeClass(info.tone)}`}>
                                                            {info.label}
                                                        </span>
                                                        <span className="text-[var(--color-neutral)]">{catLabel(r.category)}</span>
                                                        {r.closing_counted_at && (
                                                            <span className="tabular-nums text-[var(--color-neutral)]">
                                                                นับ <span className="font-mono">{timeOf(r.closing_counted_at)}</span>
                                                            </span>
                                                        )}
                                                        {carry?.anchor_at && Number(carry.days_since_anchor) > 1 && (
                                                            <span className="tabular-nums text-[var(--color-neutral)]">
                                                                รอบก่อน {dayMonthIso(carry.anchor_at)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="text-right shrink-0 tabular-nums">
                                                    {counted ? (
                                                        <>
                                                            <span className={`block font-bold text-[15px] leading-6 ${info.tone === 'plum' || v < 0 ? 'text-[var(--brand-plum)]' : 'text-[var(--color-ink)]'}`}>
                                                                {fmtSignedQty(v, r)}
                                                            </span>
                                                            <span className={`block text-[12px] leading-5 ${Number(r.variance_value) < 0 ? 'text-[var(--brand-plum)]' : 'text-[var(--color-muted)]'}`}>
                                                                {Number(r.unit_cost) > 0 ? signedBaht(r.variance_value) : 'ไม่มีราคา'}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="text-[13px] text-[var(--color-neutral)]">รอนับ</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 4-cell comparison strip */}
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2 pt-2 border-t border-[var(--color-paper-3)] text-[12px] leading-5 tabular-nums">
                                                <div>
                                                    <span className="text-[var(--color-neutral)] block">ยอดเปิด</span>
                                                    <span className="font-medium text-[var(--color-ink)] block">{fmtQty(r.opening_qty, r)}</span>
                                                    {priorShadow > 0 && (
                                                        <span className="text-[11px] leading-4 text-[var(--color-neutral)] block">
                                                            หักขายค้าง -{fmtQty(priorShadow, r)}
                                                        </span>
                                                    )}
                                                </div>
                                                <div>
                                                    <span className="text-[var(--color-neutral)] block">ใช้จากยอดขาย</span>
                                                    <span className={`font-medium ${salesNum > 0 ? 'text-[var(--color-ink)]' : 'text-[var(--color-neutral)]'}`}>
                                                        {salesNum > 0 ? `-${fmtQty(salesNum, r)}` : '0'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[var(--color-neutral)] block">ควรเหลือ</span>
                                                    <span className="font-bold text-[var(--color-ink)]">{fmtQty(r.expected_close, r)}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[var(--color-neutral)] block">นับจริง</span>
                                                    <span className={`font-bold ${counted ? 'text-[var(--color-ink)]' : 'text-[var(--color-neutral)] font-normal'}`}>
                                                        {counted ? fmtQty(r.closing_qty, r) : 'รอนับ'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Non-zero movements & diagnostic hint */}
                                            {(moves.length > 0 || info.hint) && (
                                                <div className="pt-1.5 space-y-1 text-[12px] leading-5">
                                                    {moves.length > 0 && (
                                                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[var(--color-muted)] tabular-nums">
                                                            {moves.map(m => (
                                                                <span key={m.label} className={m.tone === 'plum' ? 'text-[var(--brand-plum)] font-medium' : ''}>
                                                                    {m.label} {m.text}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {info.hint && (
                                                        <p className={info.tone === 'plum' ? 'text-[var(--brand-plum)] font-medium' : 'text-[var(--color-muted)]'}>
                                                            {info.hint}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {/* Report Footer Legend */}
                    <div className="px-4 py-3 border-t border-[var(--color-rule)] bg-[var(--color-paper-2)]/30 text-[12px] leading-5 text-[var(--color-neutral)] flex flex-wrap items-center justify-between gap-2">
                        <span>
                            ควรเหลือ = ยอดเปิด (หักยอดขายสะสมตั้งแต่นับครั้งก่อนในโหมด Shadow) + รับเข้า + ผลิต − ใช้ผลิต − เสีย − ใช้จากยอดขายวันนี้
                        </span>
                        <span>ไม่ต้องนับทุกวัน กดชื่อวัตถุดิบเพื่อดูประวัติและเมนูที่คำนวณใช้</span>
                    </div>
                </div>
            )}

            {cardFor && (
                <StockCardPanel
                    itemId={cardFor.id}
                    itemName={cardFor.name}
                    unit={cardFor.unit}
                    focusDay={view === 'day' ? day : null}
                    onClose={() => setCardFor(null)}
                />
            )}
        </div>
    );
}
