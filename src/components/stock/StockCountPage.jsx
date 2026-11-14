/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Count sheet · theme: Thai Modern OKLCH */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabaseClient';
import { logStaffActivity } from '../../utils/auditLogger';
import { usagePerStockUnit } from '../../utils/recipeGraph';
import {
    COUNT_KINDS, defaultCountKind, shopDayOf, displayUnit, parseCount, buildCountLines
} from '../../utils/stockCount';
import { buildBarcodeIndex, resolveScan, createScanGate, addScanToCount, normalizeBarcode } from '../../utils/stockBarcode';
import ScanStrip from './ScanStrip';
import BarcodeLinkSheet from './BarcodeLinkSheet';
import { linkBarcodeToItem } from '../../utils/stockBarcodeLink';

const DRAFT_KEY = (kind, day) => `stock_count_draft_v1:${day}:${kind}`;

const readDraft = (kind, day) => {
    try {
        const raw = localStorage.getItem(DRAFT_KEY(kind, day));
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
};

const writeDraft = (kind, day, counts) => {
    try {
        if (Object.values(counts).some(v => String(v ?? '').trim() !== '')) {
            localStorage.setItem(DRAFT_KEY(kind, day), JSON.stringify(counts));
        } else {
            localStorage.removeItem(DRAFT_KEY(kind, day));
        }
    } catch { /* storage unavailable: counting still works */ }
};

const fmt = (n) => Number(Number(n || 0).toFixed(3)).toLocaleString('th-TH', { maximumFractionDigits: 3 });

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

const MEASURE = new Set(['ml', 'g', 'l', 'kg']);

/** ml (or g) in one full counted unit, when known; otherwise null (use % instead). */
const capacityOf = (item) => {
    const usage = String(item.usage_unit || '').toLowerCase();
    if (MEASURE.has(usage)) {
        const per = usagePerStockUnit(item);
        if (per > 1) return { amount: per, unit: usage };
    }
    if (Number(item.capacity_per_unit) > 0) return { amount: Number(item.capacity_per_unit), unit: 'ml' };
    return null;
};

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
        <div className="col-span-2 border border-[oklch(85%_0.012_28)] bg-[oklch(98%_0.004_28)] p-3 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                    <span className="font-sans text-[12px] leading-5 text-[oklch(42%_0.010_28)] block">ยังไม่เปิด ({unit})</span>
                    <input type="text" inputMode="decimal" value={full} onChange={e => setFull(e.target.value)} autoFocus
                        className="w-full p-2 border border-[oklch(85%_0.012_28)] bg-white font-mono font-bold text-[16px] text-right outline-none focus:border-black" />
                </label>
                <label className="space-y-1">
                    <span className="font-sans text-[12px] leading-5 text-[oklch(42%_0.010_28)] block">
                        {cap ? `เปิดแล้วเหลือ (${cap.unit} จาก ${cap.amount.toLocaleString()})` : 'เปิดแล้วเหลือ (%)'}
                    </span>
                    <input type="text" inputMode="decimal" value={left} onChange={e => setLeft(e.target.value)}
                        className="w-full p-2 border border-[oklch(85%_0.012_28)] bg-white font-mono font-bold text-[16px] text-right outline-none focus:border-black" />
                </label>
            </div>
            {!cap && (
                <div className="flex gap-1.5">
                    {[0, 25, 50, 75].map(p => (
                        <button key={p} type="button" onClick={() => setLeft(String(p))}
                            className={`flex-1 py-1.5 border font-mono text-[13px] cursor-pointer ${String(p) === left ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-black' : 'bg-white border-[oklch(85%_0.012_28)]'}`}>
                            {p}%
                        </button>
                    ))}
                </div>
            )}
            <div className="flex items-center justify-between gap-2">
                <span className="font-sans text-[13px] leading-5">
                    รวม <span className="font-mono font-bold">{total}</span> {unit}
                </span>
                <div className="flex gap-1.5">
                    <button type="button" onClick={onClose}
                        className="px-3 py-1.5 border border-[oklch(85%_0.012_28)] bg-white font-sans font-bold text-[13px] cursor-pointer">ยกเลิก</button>
                    <button type="button" onClick={() => onApply(String(total))}
                        className="px-3 py-1.5 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-sans font-bold text-[13px] cursor-pointer">ใช้ค่านี้</button>
                </div>
            </div>
        </div>
    );
}

export default function StockCountPage() {
    const navigate = useNavigate();
    const shopDay = useMemo(() => shopDayOf(new Date()), []);
    const [kind, setKind] = useState(() => defaultCountKind(new Date()));
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [scope, setScope] = useState('daily'); // 'daily' | 'all'
    const [search, setSearch] = useState('');
    const [counts, setCounts] = useState(() => readDraft(defaultCountKind(new Date()), shopDayOf(new Date())));
    const [showSystem, setShowSystem] = useState(() => !COUNT_KINDS[defaultCountKind(new Date())].blindByDefault);
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
    }, []);

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

    useEffect(() => { writeDraft(kind, shopDay, counts); }, [kind, shopDay, counts]);

    const changeKind = (next) => {
        if (next === kind) return;
        writeDraft(kind, shopDay, counts);
        setKind(next);
        setCounts(readDraft(next, shopDay));
        setShowSystem(!COUNT_KINDS[next].blindByDefault);
        setResult(null);
    };

    const dailyCount = items.filter(i => i.track_mode === 'daily').length;
    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return items
            .filter(i => scope === 'all' || i.track_mode === 'daily')
            .filter(i => !q || i.name.toLowerCase().includes(q));
    }, [items, scope, search]);

    const lines = buildCountLines(counts);
    const filled = lines.length;
    const invalidCount = Object.values(counts).filter(v => String(v ?? '').trim() !== '' && parseCount(v) === null).length;

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
            const { data, error } = await supabase.rpc('submit_stock_count', {
                p_kind: kind,
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
                reason: `${COUNT_KINDS[kind].label}: นับ ${data?.line_count || filled} รายการ ผลต่าง ฿${Number(data?.value_diff || 0).toFixed(2)}`,
                metadata: { module: 'stock', session_id: data?.session_id, kind, shop_day: shopDay, value_diff: data?.value_diff }
            });

            setResult(data);
            setCounts({});
            writeDraft(kind, shopDay, {});
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

    const tabClass = (active) => `flex-1 py-2.5 font-sans font-bold text-[14px] leading-6 transition-colors cursor-pointer ${
        active ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]' : 'bg-white text-[oklch(42%_0.010_28)] hover:bg-[oklch(94%_0.010_28)]'
    }`;

    return (
        <div className="min-h-screen bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] font-sans pb-28">
            {/* Header cells */}
            <header className="sticky top-0 z-20 bg-[oklch(97%_0.008_28)] border-b border-[oklch(85%_0.012_28)]">
                <div className="max-w-3xl mx-auto grid grid-cols-[auto_1fr] divide-x divide-[oklch(85%_0.012_28)] border-x border-[oklch(85%_0.012_28)]">
                    <button
                        type="button"
                        onClick={() => navigate('/staff/stock')}
                        className="px-4 font-sans font-bold text-[13px] text-[oklch(42%_0.010_28)] hover:bg-[oklch(94%_0.010_28)] cursor-pointer"
                    >
                        กลับ
                    </button>
                    <div className="px-4 py-2.5">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] block">STOCK COUNT</span>
                        <h1 className="font-sans font-bold text-lg leading-7">นับสต๊อก</h1>
                        <p className="font-sans text-[12px] leading-5 text-[oklch(42%_0.010_28)]">
                            วันทำการ <span className="font-mono">{shopDay}</span> · ตัดรอบวันตอน 05:00
                        </p>
                    </div>
                </div>

                <div className="max-w-3xl mx-auto border-x border-t border-[oklch(85%_0.012_28)]">
                    <div className="flex divide-x divide-[oklch(85%_0.012_28)]" role="tablist" aria-label="รอบนับ">
                        {Object.entries(COUNT_KINDS).map(([key, k]) => (
                            <button key={key} type="button" role="tab" aria-selected={kind === key}
                                onClick={() => changeKind(key)} className={tabClass(kind === key)}>
                                {k.label}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto border-x border-[oklch(85%_0.012_28)] bg-white min-h-[60vh]">
                {result ? (
                    <section className="p-4 space-y-4" aria-labelledby="count-result">
                        <div>
                            <h2 id="count-result" className="font-sans font-bold text-base leading-7">
                                บันทึก{COUNT_KINDS[result.kind]?.label || ''}แล้ว {result.line_count} รายการ
                            </h2>
                            <p className="font-sans text-[13px] leading-6 text-[oklch(42%_0.010_28)]">
                                ผลต่างจากยอดในระบบรวม{' '}
                                <span className={`font-mono font-bold ${Number(result.value_diff) < 0 ? 'text-[oklch(52%_0.16_28)]' : ''}`}>
                                    ฿{Number(result.value_diff || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </p>
                        </div>
                        <ol className="border border-[oklch(85%_0.012_28)] divide-y divide-[oklch(90%_0.008_28)]">
                            {(result.lines || []).map(l => (
                                <li key={l.stock_item_id} className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-2">
                                    <span className="font-sans font-bold text-[14px] leading-6 min-w-0 break-words">{l.name}</span>
                                    <span className={`font-mono text-[13px] tabular-nums text-right ${Number(l.diff) < 0 ? 'text-[oklch(52%_0.16_28)]' : 'text-[oklch(42%_0.010_28)]'}`}>
                                        {Number(l.diff) > 0 ? '+' : ''}{fmt(l.diff)} {displayUnit(l.unit)}
                                    </span>
                                    <span className="font-sans text-[12px] leading-5 text-[oklch(55%_0.010_28)]">
                                        ระบบ {fmt(l.system_qty)} → นับได้ {fmt(l.counted_qty)}
                                    </span>
                                    <span className="font-mono text-[12px] tabular-nums text-right text-[oklch(55%_0.010_28)]">
                                        ฿{Number(l.value_diff || 0).toFixed(2)}
                                    </span>
                                </li>
                            ))}
                        </ol>
                        <div className="grid grid-cols-2 border border-[oklch(85%_0.012_28)] divide-x divide-[oklch(85%_0.012_28)]">
                            <button type="button" onClick={() => setResult(null)}
                                className="py-3 font-sans font-bold text-[14px] hover:bg-[oklch(94%_0.010_28)] cursor-pointer">
                                นับต่อ
                            </button>
                            <button type="button" onClick={() => navigate('/staff/stock')}
                                className="py-3 font-sans font-bold text-[14px] bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] hover:bg-black cursor-pointer">
                                กลับหน้าคลัง
                            </button>
                        </div>
                    </section>
                ) : (
                    <>
                        {/* Controls */}
                        <div className="p-3 border-b border-[oklch(85%_0.012_28)] space-y-2.5 bg-[oklch(98%_0.004_28)]">
                            <div className="flex flex-wrap gap-2 items-center">
                                <div className="flex border border-[oklch(85%_0.012_28)] divide-x divide-[oklch(85%_0.012_28)]">
                                    <button type="button" onClick={() => setScope('daily')} aria-pressed={scope === 'daily'}
                                        className={`px-3 py-1.5 font-sans font-bold text-[13px] leading-5 cursor-pointer ${scope === 'daily' ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]' : 'bg-white text-[oklch(42%_0.010_28)]'}`}>
                                        นับทุกวัน <span className="font-mono text-[11px]">{dailyCount}</span>
                                    </button>
                                    <button type="button" onClick={() => setScope('all')} aria-pressed={scope === 'all'}
                                        className={`px-3 py-1.5 font-sans font-bold text-[13px] leading-5 cursor-pointer ${scope === 'all' ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]' : 'bg-white text-[oklch(42%_0.010_28)]'}`}>
                                        ทั้งหมด <span className="font-mono text-[11px]">{items.length}</span>
                                    </button>
                                </div>
                                <button type="button" onClick={() => navigate('/staff/stock/labels')}
                                    className="font-sans font-bold text-[13px] leading-5 text-[oklch(42%_0.010_28)] underline underline-offset-2 hover:text-[oklch(18%_0.012_28)] cursor-pointer">
                                    ป้าย QR
                                </button>
                                <label className="flex items-center gap-2 font-sans text-[13px] leading-5 text-[oklch(42%_0.010_28)] cursor-pointer select-none ml-auto">
                                    <input type="checkbox" checked={showSystem} onChange={e => setShowSystem(e.target.checked)}
                                        className="w-4 h-4 accent-[oklch(18%_0.012_28)]" />
                                    แสดงยอดในระบบ
                                </label>
                            </div>
                            <div className="grid grid-cols-[1fr_auto] border border-[oklch(85%_0.012_28)] divide-x divide-[oklch(85%_0.012_28)]">
                                <input
                                    type="search"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="ค้นหาชื่อ..."
                                    aria-label="ค้นหาชื่อวัตถุดิบ"
                                    className="w-full min-w-0 p-2 bg-white font-sans text-[14px] outline-none focus:bg-[oklch(98%_0.004_28)]"
                                />
                                <button type="button" onClick={() => { scanFeedback.ctx?.resume?.(); setScanning(s => !s); gateRef.current.reset(); }}
                                    aria-pressed={scanning}
                                    className={`px-4 font-sans font-bold text-[14px] cursor-pointer ${scanning ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]' : 'bg-white hover:bg-[oklch(94%_0.010_28)]'}`}>
                                    {scanning ? 'กำลังสแกน' : 'สแกน'}
                                </button>
                            </div>
                            {kind === 'closing' && !showSystem && (
                                <p className="font-sans text-[12px] leading-5 text-[oklch(42%_0.010_28)]">
                                    นับปิดร้านแบบไม่เห็นยอดในระบบ นับตามของจริง แล้วระบบจะแสดงผลต่างหลังบันทึก
                                </p>
                            )}
                        </div>

                        {scanning && (
                            <div>
                                <ScanStrip onCode={handleScan} onClose={() => setScanning(false)} status={scanStatus} />
                                {lastScanned && itemsById.get(lastScanned) && (() => {
                                    const it = itemsById.get(lastScanned);
                                    const raw = counts[it.id] ?? '';
                                    return (
                                        <div className="grid grid-cols-[1fr_auto] gap-3 items-center px-3 py-2 bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)]">
                                            <div className="min-w-0">
                                                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(55%_0.010_28)] block">ล่าสุด</span>
                                                <span className="font-sans font-bold text-[15px] leading-6 break-words">{it.name}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <button type="button" aria-label={`ลด ${it.name} 1`}
                                                    onClick={() => setCounts(prev => ({ ...prev, [it.id]: String(Math.max(0, (parseCount(prev[it.id]) ?? 0) - 1)) }))}
                                                    className="w-10 h-10 border border-[oklch(85%_0.012_28)] bg-white font-mono font-bold text-[18px] cursor-pointer">−</button>
                                                <input type="text" inputMode="decimal" value={raw} aria-label={`จำนวน ${it.name}`}
                                                    onChange={e => setCounts(prev => ({ ...prev, [it.id]: e.target.value }))}
                                                    className="w-20 h-10 p-2 border border-[oklch(85%_0.012_28)] bg-white font-mono font-bold text-[16px] text-right outline-none focus:border-black" />
                                                <span className="w-12 font-sans text-[12px] leading-5 text-[oklch(42%_0.010_28)] break-words">{displayUnit(it.unit)}</span>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {loading ? (
                            <p className="p-6 font-sans text-[14px] text-[oklch(55%_0.010_28)]">กำลังโหลด...</p>
                        ) : visible.length === 0 ? (
                            <div className="p-6 space-y-2 font-sans text-[14px] leading-6 text-[oklch(42%_0.010_28)]">
                                {scope === 'daily' && !search
                                    ? <>ยังไม่มีรายการที่นับทุกวัน กด "ทั้งหมด" แล้วกด "นับทุกวัน" ที่รายการที่ต้องการ</>
                                    : <>ไม่พบรายการ</>}
                            </div>
                        ) : (
                            <ul className="divide-y divide-[oklch(90%_0.008_28)]">
                                {visible.map(item => {
                                    const raw = counts[item.id] ?? '';
                                    const invalid = String(raw).trim() !== '' && parseCount(raw) === null;
                                    return (
                                        <li key={item.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-3 py-2.5 items-center">
                                            <div className="min-w-0">
                                                <label htmlFor={`count-${item.id}`} className="font-sans font-bold text-[15px] leading-6 block break-words">
                                                    {item.name}
                                                </label>
                                                <div className="flex flex-wrap gap-x-3 font-sans text-[12px] leading-5 text-[oklch(55%_0.010_28)]">
                                                    {showSystem && <span>ในระบบ <span className="font-mono">{fmt(item.current_quantity)}</span></span>}
                                                    <button type="button" onClick={() => setHelperFor(helperFor === item.id ? null : item.id)}
                                                        className="font-bold underline underline-offset-2 hover:text-[oklch(18%_0.012_28)] cursor-pointer">
                                                        มีของเปิดแล้ว
                                                    </button>
                                                    {scope === 'all' && (
                                                        <button type="button" onClick={() => toggleDaily(item)}
                                                            className="font-bold underline underline-offset-2 hover:text-[oklch(18%_0.012_28)] cursor-pointer">
                                                            {item.track_mode === 'daily' ? 'เลิกนับทุกวัน' : 'นับทุกวัน'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    id={`count-${item.id}`}
                                                    type="text"
                                                    inputMode="decimal"
                                                    autoComplete="off"
                                                    value={raw}
                                                    onChange={e => setCounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                    aria-invalid={invalid}
                                                    className={`w-24 p-2 border bg-white font-mono font-bold text-[16px] text-right outline-none focus:border-black ${invalid ? 'border-[oklch(52%_0.16_28)]' : 'border-[oklch(85%_0.012_28)]'}`}
                                                />
                                                <span className="w-14 font-sans text-[12px] leading-5 text-[oklch(42%_0.010_28)] break-words">{displayUnit(item.unit)}</span>
                                            </div>
                                            {helperFor === item.id && (
                                                <OpenUnitHelper
                                                    item={item}
                                                    onClose={() => setHelperFor(null)}
                                                    onApply={(value) => {
                                                        setCounts(prev => ({ ...prev, [item.id]: value }));
                                                        setHelperFor(null);
                                                    }}
                                                />
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </>
                )}
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

            {!result && (
                <footer className="fixed bottom-0 inset-x-0 z-20 bg-[oklch(97%_0.008_28)] border-t border-[oklch(85%_0.012_28)]">
                    <div className="max-w-3xl mx-auto grid grid-cols-[1fr_auto] items-center border-x border-[oklch(85%_0.012_28)]">
                        <span className="px-4 font-sans text-[13px] leading-5 text-[oklch(42%_0.010_28)]">
                            กรอกแล้ว <span className="font-mono font-bold text-[oklch(18%_0.012_28)]">{filled}</span> รายการ
                            {invalidCount > 0
                                ? <span className="block text-[11px] font-bold text-[oklch(52%_0.16_28)]">แก้ช่องสีแดง {invalidCount} ช่องก่อนบันทึก</span>
                                : <span className="block text-[11px] text-[oklch(55%_0.010_28)]">รายการที่ไม่กรอกจะไม่ถูกเปลี่ยน</span>}
                        </span>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!filled || invalidCount > 0 || saving}
                            className="px-6 py-4 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-sans font-bold text-[15px] hover:bg-black disabled:opacity-40 cursor-pointer"
                        >
                            {saving ? 'กำลังบันทึก...' : `บันทึก${COUNT_KINDS[kind].label}`}
                        </button>
                    </div>
                </footer>
            )}
        </div>
    );
}
