/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Ledger report · theme: Thai Modern OKLCH */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabaseClient';
import {
    shopDayOf, addDays, displayUnit, isAbnormal, summarizeReconciliation, sortReconciliation, COUNT_KINDS,
    DEFAULT_THRESHOLDS, THRESHOLD_KEYS, thresholdsFromSettings
} from '../../utils/stockCount';
import { exportElementImage, downloadDataUrl, copyDataUrlImage } from '../../utils/reportImageExport';
import { rankVariance, summarizeRanking, shopDayRange } from '../../utils/stockReports';
import StockCardPanel from './StockCardPanel';

const num = (v, digits = 2) => {
    if (v === null || v === undefined) return '—';
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    if (n === 0) return '0';
    return Number(n.toFixed(digits)).toLocaleString('th-TH', { maximumFractionDigits: digits });
};
const baht = (v) => (v === null || v === undefined) ? '—'
    : `฿${Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const timeOf = (iso) => iso
    ? new Date(iso).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })
    : '';
const shortDate = (ymd) => new Date(`${ymd}T12:00:00+07:00`).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit'
});
const thaiDate = (ymd) => new Date(`${ymd}T12:00:00+07:00`).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
});

/**
 * Daily stock reconciliation: opening + received + produced - used in production - waste
 * - sales usage = expected close, against the closing count.
 */
export default function StockReconciliationPage() {
    const [day, setDay] = useState(() => shopDayOf(new Date()));
    const [rows, setRows] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('abnormal'); // 'abnormal' | 'counted' | 'all'
    const [exporting, setExporting] = useState(false);
    const [view, setView] = useState('day'); // 'day' | 7 | 30 (days of accumulated variance)
    const [ranking, setRanking] = useState({ loading: false, rows: [], days: 0, error: null });
    const [cardFor, setCardFor] = useState(null); // { id, name, unit }
    // "Abnormal" = off by more than X% AND more than ฿Y (app_settings, shared with Telegram)
    const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
    const [thDraft, setThDraft] = useState(null); // { percent, baht } while editing

    useEffect(() => {
        supabase.from('app_settings').select('key, value').in('key', Object.values(THRESHOLD_KEYS))
            .then(({ data }) => setThresholds(thresholdsFromSettings(data || [])));
    }, []);

    const saveThresholds = async () => {
        const p = Number(thDraft?.percent);
        const b = Number(thDraft?.baht);
        if (!Number.isFinite(p) || p < 0 || !Number.isFinite(b) || b < 0) {
            toast.error('ใส่ตัวเลขตั้งแต่ 0 ขึ้นไป');
            return;
        }
        const { error } = await supabase.from('app_settings').upsert([
            { key: THRESHOLD_KEYS.percent, value: String(p) },
            { key: THRESHOLD_KEYS.baht, value: String(b) }
        ]);
        if (error) { toast.error('บันทึกเกณฑ์ไม่สำเร็จ: ' + error.message); return; }
        setThresholds({ percent: p, baht: b });
        setThDraft(null);
        toast.success(`เกณฑ์ผิดปกติ: ต่างเกิน ${p}% และเกิน ฿${b}`);
    };
    const reportRef = useRef(null);

    useEffect(() => {
        if (view === 'day') return;
        let cancelled = false;
        const days = shopDayRange(day, view);
        setRanking(r => ({ ...r, loading: true, error: null }));
        Promise.all(days.map(d => supabase.rpc('stock_daily_reconciliation', { p_day: d })
            .then(({ data, error }) => { if (error) throw error; return { day: d, rows: data || [] }; })))
            .then(results => {
                if (cancelled) return;
                setRanking({ loading: false, rows: rankVariance(results, thresholds), days: results.filter(r => r.rows.some(x => x.closing_qty !== null)).length, error: null });
            })
            .catch(err => { if (!cancelled) setRanking({ loading: false, rows: [], days: 0, error: err }); });
        return () => { cancelled = true; };
    }, [view, day, thresholds]);

    const rankSummary = useMemo(() => summarizeRanking(ranking.rows), [ranking.rows]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [recon, sess] = await Promise.all([
                supabase.rpc('stock_daily_reconciliation', { p_day: day }),
                supabase.from('stock_count_sessions')
                    .select('id, kind, performed_by, line_count, value_diff, blind, created_at')
                    .eq('shop_day', day)
                    .order('created_at')
            ]);
            if (recon.error) throw recon.error;
            setRows(recon.data || []);
            setSessions(sess.data || []);
        } catch (err) {
            console.error(err);
            setError(err);
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [day]);

    useEffect(() => { load(); }, [load]);

    const summary = useMemo(() => summarizeReconciliation(rows, thresholds), [rows, thresholds]);
    const visible = useMemo(() => {
        const sorted = sortReconciliation(rows, thresholds);
        if (filter === 'abnormal') return sorted.filter(r => isAbnormal(r, thresholds));
        if (filter === 'counted') return sorted.filter(r => r.closing_qty !== null);
        return sorted;
    }, [rows, filter, thresholds]);

    const today = shopDayOf(new Date());
    const missingRpc = error && (error.code === 'PGRST202' || /could not find the function/i.test(error.message || ''));

    const runExport = async (mode) => {
        if (exporting) return;
        setExporting(true);
        const id = toast.loading(mode === 'copy' ? 'กำลังคัดลอกรูปรายงาน...' : 'กำลังบันทึก PNG...');
        try {
            const url = await exportElementImage(reportRef.current, 1100);
            if (!url) throw new Error('แปลงเป็นรูปไม่สำเร็จ');
            if (mode === 'copy') {
                await copyDataUrlImage(url);
                toast.success('คัดลอกรูปแล้ว วางใน LINE ได้เลย', { id });
            } else {
                downloadDataUrl(url, view === 'day' ? `STOCK_RECON_${day}.png` : `STOCK_VARIANCE_${view}D_${day}.png`);
                toast.success('บันทึก PNG แล้ว', { id });
            }
        } catch (err) {
            console.error(err);
            toast.error('ส่งออกไม่สำเร็จ: ' + (err?.message || ''), { id });
        } finally {
            setExporting(false);
        }
    };

    const cellHead = 'px-3 py-2 text-right font-sans text-[12px] leading-5 font-bold text-[oklch(42%_0.010_28)] whitespace-nowrap';
    const cell = 'px-3 py-2 text-right font-mono text-[13px] tabular-nums whitespace-nowrap';
    const btn = 'px-3 py-2 border border-[oklch(85%_0.012_28)] bg-white font-sans font-bold text-[13px] leading-5 text-[oklch(42%_0.010_28)] hover:bg-[oklch(94%_0.010_28)] disabled:opacity-40 cursor-pointer whitespace-nowrap';

    return (
        <div className="font-sans text-[oklch(18%_0.012_28)] space-y-4">
            {/* Controls */}
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] block">STOCK RECONCILIATION</span>
                    <h2 className="font-sans font-bold text-xl leading-8">{view === 'day' ? 'กระทบยอดสต๊อกรายวัน' : `อันดับผลต่างสะสม ${view} วัน`}</h2>
                    <p className="font-sans text-[12px] leading-5 text-[oklch(42%_0.010_28)] max-w-prose">
                        {view === 'day'
                            ? 'ยอดเปิด + รับเข้า + ผลิต − ใช้ผลิต − เสีย − ใช้ตามยอดขาย = ควรเหลือ เทียบกับยอดนับปิดร้าน วันทำการตัดรอบ 05:00'
                            : 'รวมผลต่างของทุกวันที่นับปิดร้าน หาวัตถุดิบที่ขาดซ้ำ ๆ เพื่อตามแก้สูตรหรือการเบิก'}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex border border-[oklch(85%_0.012_28)] divide-x divide-[oklch(85%_0.012_28)] bg-white" role="tablist" aria-label="ช่วงรายงาน">
                        {[['day', 'รายวัน'], [7, 'สะสม 7 วัน'], [30, 'สะสม 30 วัน']].map(([v, label]) => (
                            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
                                className={`px-3 py-2 font-sans font-bold text-[13px] leading-5 cursor-pointer whitespace-nowrap ${view === v ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]' : 'hover:bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)]'}`}>
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className="flex border border-[oklch(85%_0.012_28)] divide-x divide-[oklch(85%_0.012_28)] bg-white">
                        <button type="button" onClick={() => setDay(d => addDays(d, -1))} aria-label="วันก่อนหน้า"
                            className="px-3 py-2 font-sans font-bold text-[13px] hover:bg-[oklch(94%_0.010_28)] cursor-pointer">ก่อนหน้า</button>
                        <input type="date" value={day} max={today} onChange={e => e.target.value && setDay(e.target.value)}
                            aria-label="วันทำการ" className="px-2 py-2 font-mono text-[13px] bg-white outline-none" />
                        <button type="button" onClick={() => setDay(d => addDays(d, 1))} disabled={day >= today} aria-label="วันถัดไป"
                            className="px-3 py-2 font-sans font-bold text-[13px] hover:bg-[oklch(94%_0.010_28)] disabled:opacity-40 cursor-pointer">ถัดไป</button>
                    </div>
                    <button type="button" className={btn} onClick={() => runExport('png')} disabled={exporting || loading}>บันทึก PNG</button>
                    <button type="button" className={btn} onClick={() => runExport('copy')} disabled={exporting || loading}>คัดลอกรูป</button>
                </div>
            </div>

            {missingRpc ? (
                <p className="p-4 border border-[oklch(85%_0.012_28)] bg-white font-sans text-[14px] leading-6">
                    ฐานข้อมูลยังไม่มีระบบกระทบยอด กรุณาติดตั้ง migration รอบนับและกระทบยอดก่อน
                </p>
            ) : view !== 'day' ? (
                <div ref={reportRef} className="bg-white border border-[oklch(85%_0.012_28)]">
                    <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-[oklch(85%_0.012_28)] border-b border-[oklch(85%_0.012_28)]">
                        <div className="p-3 col-span-2 lg:col-span-1">
                            <span className="font-sans text-[12px] leading-5 text-[oklch(55%_0.010_28)] block">ช่วง</span>
                            <span className="font-sans font-bold text-[15px] leading-6">
                                <span className="whitespace-nowrap">{shortDate(shopDayRange(day, view)[0])}</span> – <span className="whitespace-nowrap">{shortDate(day)}</span>
                            </span>
                            <span className="font-sans text-[12px] leading-5 text-[oklch(55%_0.010_28)] block">มีนับปิดร้าน {ranking.days} จาก {view} วัน</span>
                        </div>
                        <div className="p-3">
                            <span className="font-sans text-[12px] leading-5 text-[oklch(55%_0.010_28)] block">รายการที่เคยผิดปกติ</span>
                            <span className={`font-mono font-bold text-xl tabular-nums ${rankSummary.withAbnormal ? 'text-[oklch(52%_0.16_28)]' : ''}`}>{rankSummary.withAbnormal}</span>
                            <span className="font-sans text-[12px] text-[oklch(55%_0.010_28)]"> / {rankSummary.items}</span>
                        </div>
                        <div className="p-3">
                            <span className="font-sans text-[12px] leading-5 text-[oklch(55%_0.010_28)] block">ขาดสะสม (มูลค่า)</span>
                            <span className={`font-mono font-bold text-xl tabular-nums ${rankSummary.shortValue < 0 ? 'text-[oklch(52%_0.16_28)]' : ''}`}>{baht(rankSummary.shortValue)}</span>
                        </div>
                        <div className="p-3">
                            <span className="font-sans text-[12px] leading-5 text-[oklch(55%_0.010_28)] block">สุทธิ (ขาด + เกิน)</span>
                            <span className="font-mono font-bold text-xl tabular-nums">{baht(rankSummary.netValue)}</span>
                        </div>
                    </div>
                    {ranking.loading ? (
                        <p className="p-6 font-sans text-[14px] text-[oklch(55%_0.010_28)]">กำลังรวม {view} วัน...</p>
                    ) : ranking.error ? (
                        <p className="p-6 font-sans text-[14px] text-[oklch(52%_0.16_28)]">โหลดไม่สำเร็จ: {ranking.error.message}</p>
                    ) : ranking.rows.length === 0 ? (
                        <p className="p-6 font-sans text-[14px] leading-6 text-[oklch(42%_0.010_28)]">ยังไม่มีวันที่นับปิดร้านในช่วงนี้ จึงยังจัดอันดับผลต่างไม่ได้</p>
                    ) : (
                        <div className="overflow-x-auto" data-export-unclip>
                            <table className="w-full min-w-[720px] border-collapse">
                                <thead className="bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)]">
                                    <tr>
                                        <th className={`${cellHead} w-10`}>#</th>
                                        <th className="px-3 py-2 text-left font-sans text-[12px] leading-5 font-bold text-[oklch(42%_0.010_28)] whitespace-nowrap">รายการ</th>
                                        <th className={cellHead}>วันที่นับ</th>
                                        <th className={cellHead}>วันผิดปกติ</th>
                                        <th className={cellHead}>ต่างรวม</th>
                                        <th className={cellHead}>ขาดรวม</th>
                                        <th className={cellHead}>สุทธิ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[oklch(90%_0.008_28)]">
                                    {ranking.rows.map((r, i) => (
                                        <tr key={r.stock_item_id} className={r.abnormalDays ? 'bg-[oklch(97%_0.02_28)]' : ''}>
                                            <td className={`${cell} text-[oklch(55%_0.010_28)]`}>{i + 1}</td>
                                            <td className="px-3 py-2 text-left">
                                                <button type="button" onClick={() => setCardFor({ id: r.stock_item_id, name: r.name, unit: r.unit })}
                                                    className="font-sans font-bold text-[13px] leading-5 text-left underline decoration-[oklch(85%_0.012_28)] underline-offset-2 hover:decoration-[oklch(18%_0.012_28)] cursor-pointer">
                                                    {r.name}
                                                </button>
                                                <span className="font-sans text-[11px] leading-4 text-[oklch(55%_0.010_28)] block">{displayUnit(r.unit)}</span>
                                            </td>
                                            <td className={cell}>{r.daysCounted}</td>
                                            <td className={`${cell} font-bold ${r.abnormalDays ? 'text-[oklch(52%_0.16_28)]' : ''}`}>{r.abnormalDays}</td>
                                            <td className={`${cell} ${r.variance < 0 ? 'text-[oklch(52%_0.16_28)]' : ''}`}>{`${r.variance > 0 ? '+' : ''}${num(r.variance, 3)}`}</td>
                                            <td className={`${cell} font-bold ${r.shortValue < 0 ? 'text-[oklch(52%_0.16_28)]' : ''}`}>
                                                {r.priced ? baht(r.shortValue) : <span className="font-sans text-[11px] text-[oklch(55%_0.010_28)]">ไม่มีราคา</span>}
                                            </td>
                                            <td className={cell}>{r.priced ? baht(r.value) : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <p className="px-3 py-2 border-t border-[oklch(85%_0.012_28)] font-sans text-[11px] leading-5 text-[oklch(55%_0.010_28)]">
                        นับเฉพาะวันที่มีนับปิดร้าน · เรียงจากขาดมากสุด · รายการที่ขาดซ้ำทุกวันในสัดส่วนเดิม มักแปลว่าสูตรตักน้อยกว่าที่ทำจริง · กดชื่อเพื่อดูความเคลื่อนไหว
                    </p>
                </div>
            ) : (
                <div ref={reportRef} className="bg-white border border-[oklch(85%_0.012_28)]">
                    {/* Summary cells */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-[oklch(85%_0.012_28)] border-b border-[oklch(85%_0.012_28)]">
                        <div className="p-3 col-span-2 lg:col-span-1">
                            <span className="font-sans text-[12px] leading-5 text-[oklch(55%_0.010_28)] block">วันทำการ</span>
                            <span className="font-sans font-bold text-[15px] leading-6">{thaiDate(day)}</span>
                        </div>
                        <div className="p-3">
                            <span className="font-sans text-[12px] leading-5 text-[oklch(55%_0.010_28)] block">นับปิดร้านแล้ว</span>
                            <span className="font-mono font-bold text-xl tabular-nums">{summary.counted}</span>
                            <span className="font-sans text-[12px] text-[oklch(55%_0.010_28)]"> / {summary.items} รายการ</span>
                        </div>
                        <div className="p-3">
                            <span className="font-sans text-[12px] leading-5 text-[oklch(55%_0.010_28)] block">ผิดปกติ</span>
                            <span className={`font-mono font-bold text-xl tabular-nums ${summary.abnormal ? 'text-[oklch(52%_0.16_28)]' : ''}`}>{summary.abnormal}</span>
                            <span className="font-sans text-[12px] text-[oklch(55%_0.010_28)]"> รายการ</span>
                        </div>
                        <div className="p-3">
                            <span className="font-sans text-[12px] leading-5 text-[oklch(55%_0.010_28)] block">ขาด (มูลค่า)</span>
                            <span className={`font-mono font-bold text-xl tabular-nums ${summary.shortValue < 0 ? 'text-[oklch(52%_0.16_28)]' : ''}`}>{baht(summary.shortValue)}</span>
                        </div>
                        <div className="p-3">
                            <span className="font-sans text-[12px] leading-5 text-[oklch(55%_0.010_28)] block">เกิน (มูลค่า)</span>
                            <span className="font-mono font-bold text-xl tabular-nums">{baht(summary.overValue)}</span>
                        </div>
                    </div>

                    {/* Count sessions of the day */}
                    <div className="px-3 py-2 border-b border-[oklch(85%_0.012_28)] bg-[oklch(98%_0.004_28)] font-sans text-[12px] leading-5 text-[oklch(42%_0.010_28)] flex flex-wrap gap-x-4 gap-y-1">
                        {sessions.length === 0 ? (
                            <span>ยังไม่มีการนับในวันนี้ ยอดเปิดใช้ยอดในระบบตอน 05:00 และยังไม่มีผลต่างจนกว่าจะนับปิดร้าน</span>
                        ) : sessions.map(s => (
                            <span key={s.id} className="whitespace-nowrap">
                                <span className="font-bold text-[oklch(18%_0.012_28)]">{COUNT_KINDS[s.kind]?.label}</span>{' '}
                                <span className="font-mono">{timeOf(s.created_at)}</span> · {s.line_count} รายการ · {s.performed_by}
                                {s.blind ? ' · ไม่เห็นยอดระบบ' : ''}
                            </span>
                        ))}
                    </div>

                    {/* Filter */}
                    <div className="flex border-b border-[oklch(85%_0.012_28)] divide-x divide-[oklch(85%_0.012_28)]" role="tablist" aria-label="กรองรายการ" data-export-hide>
                        {[['abnormal', 'ผิดปกติ', summary.abnormal], ['counted', 'นับแล้ว', summary.counted], ['all', 'ทั้งหมด', summary.items]].map(([v, label, n]) => (
                            <button key={v} type="button" role="tab" aria-selected={filter === v} onClick={() => setFilter(v)}
                                className={`flex-1 sm:flex-none px-4 py-2 font-sans font-bold text-[13px] leading-5 cursor-pointer whitespace-nowrap ${filter === v ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]' : 'bg-white text-[oklch(42%_0.010_28)] hover:bg-[oklch(94%_0.010_28)]'}`}>
                                {label} <span className="font-mono text-[11px]">{n}</span>
                            </button>
                        ))}
                    </div>

                    {/* Table */}
                    {loading ? (
                        <p className="p-6 font-sans text-[14px] text-[oklch(55%_0.010_28)]">กำลังโหลด...</p>
                    ) : error ? (
                        <p className="p-6 font-sans text-[14px] text-[oklch(52%_0.16_28)]">โหลดไม่สำเร็จ: {error.message}</p>
                    ) : visible.length === 0 ? (
                        <p className="p-6 font-sans text-[14px] leading-6 text-[oklch(42%_0.010_28)]">
                            {filter === 'abnormal'
                                ? (summary.counted ? 'ไม่มีรายการผิดปกติ' : 'ยังไม่ได้นับปิดร้าน จึงยังไม่มีผลต่าง')
                                : 'ไม่มีรายการในวันนี้'}
                        </p>
                    ) : (
                        <div className="overflow-x-auto" data-export-unclip>
                            <table className="w-full min-w-[960px] border-collapse">
                                <thead className="bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)]">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-sans text-[12px] leading-5 font-bold text-[oklch(42%_0.010_28)] whitespace-nowrap sticky left-0 bg-[oklch(94%_0.010_28)]">รายการ</th>
                                        <th className={cellHead}>ยอดเปิด</th>
                                        <th className={cellHead}>รับเข้า</th>
                                        <th className={cellHead}>ผลิต</th>
                                        <th className={cellHead}>ใช้ผลิต</th>
                                        <th className={cellHead}>เสีย</th>
                                        <th className={cellHead}>ใช้ตามยอดขาย</th>
                                        <th className={cellHead}>ควรเหลือ</th>
                                        <th className={cellHead}>นับปิด</th>
                                        <th className={cellHead}>ต่าง</th>
                                        <th className={cellHead}>มูลค่า</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[oklch(90%_0.008_28)]">
                                    {visible.map(r => {
                                        const bad = isAbnormal(r, thresholds);
                                        const v = Number(r.variance);
                                        return (
                                            <tr key={r.stock_item_id} className={bad ? 'bg-[oklch(97%_0.02_28)]' : ''}>
                                                <td className={`px-3 py-2 text-left sticky left-0 ${bad ? 'bg-[oklch(97%_0.02_28)]' : 'bg-white'}`}>
                                                    <button type="button" onClick={() => setCardFor({ id: r.stock_item_id, name: r.name, unit: r.unit })}
                                                        className="font-sans font-bold text-[13px] leading-5 block text-left underline decoration-[oklch(85%_0.012_28)] underline-offset-2 hover:decoration-[oklch(18%_0.012_28)] cursor-pointer">
                                                        {bad && <span className="inline-block w-1.5 h-1.5 mr-1.5 align-middle bg-[oklch(52%_0.16_28)]" aria-label="ผิดปกติ" />}
                                                        {r.name}
                                                    </button>
                                                    <span className="font-sans text-[11px] leading-4 text-[oklch(55%_0.010_28)]">
                                                        {displayUnit(r.unit)}{r.opening_source === 'ledger' ? ' · ยอดเปิดจากระบบ' : ''}
                                                        {r.closing_counted_at ? ` · นับ ${timeOf(r.closing_counted_at)}` : ''}
                                                    </span>
                                                </td>
                                                <td className={cell}>{num(r.opening_qty)}</td>
                                                <td className={cell}>{num(r.received)}</td>
                                                <td className={cell}>{num(r.produced)}</td>
                                                <td className={cell}>{num(r.used_in_production)}</td>
                                                <td className={cell}>{num(r.waste)}</td>
                                                <td className={cell}>{num(r.sales_usage)}</td>
                                                <td className={`${cell} font-bold`}>{num(r.expected_close)}</td>
                                                <td className={`${cell} font-bold`}>{num(r.closing_qty)}</td>
                                                <td className={`${cell} font-bold ${v < 0 ? 'text-[oklch(52%_0.16_28)]' : ''}`}>
                                                    {r.variance === null ? '—' : `${v > 0 ? '+' : ''}${num(v)}`}
                                                </td>
                                                <td className={`${cell} ${Number(r.variance_value) < 0 ? 'text-[oklch(52%_0.16_28)]' : ''}`}>
                                                    {Number(r.unit_cost) > 0 ? baht(r.variance_value) : <span className="font-sans text-[11px] text-[oklch(55%_0.010_28)]">ไม่มีราคา</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="px-3 py-2 border-t border-[oklch(85%_0.012_28)] font-sans text-[11px] leading-5 text-[oklch(55%_0.010_28)] flex flex-wrap items-center gap-x-3 gap-y-1">
                        {thDraft ? (
                            <span className="flex flex-wrap items-center gap-1.5" data-export-hide>
                                ผิดปกติเมื่อต่างเกิน
                                <input type="text" inputMode="decimal" value={thDraft.percent} onChange={e => setThDraft(d => ({ ...d, percent: e.target.value }))} aria-label="เปอร์เซ็นต์"
                                    className="w-12 px-1.5 py-0.5 border border-[oklch(85%_0.012_28)] bg-white font-mono text-[12px] text-right text-[oklch(18%_0.012_28)]" />
                                % และเกิน ฿
                                <input type="text" inputMode="decimal" value={thDraft.baht} onChange={e => setThDraft(d => ({ ...d, baht: e.target.value }))} aria-label="บาท"
                                    className="w-16 px-1.5 py-0.5 border border-[oklch(85%_0.012_28)] bg-white font-mono text-[12px] text-right text-[oklch(18%_0.012_28)]" />
                                <button type="button" onClick={saveThresholds} className="px-2 py-0.5 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold cursor-pointer">บันทึก</button>
                                <button type="button" onClick={() => setThDraft(null)} className="px-2 py-0.5 border border-[oklch(85%_0.012_28)] bg-white font-bold cursor-pointer">ยกเลิก</button>
                            </span>
                        ) : (
                            <span>
                                ผิดปกติ = ต่างเกิน {thresholds.percent}% ของยอดที่ควรเหลือ และเกิน ฿{thresholds.baht} (รายการที่ไม่มีราคาใช้เฉพาะ %)
                                {' '}<button type="button" data-export-hide onClick={() => setThDraft({ percent: String(thresholds.percent), baht: String(thresholds.baht) })}
                                    className="font-bold underline underline-offset-2 hover:text-[oklch(18%_0.012_28)] cursor-pointer">ตั้งเกณฑ์</button>
                            </span>
                        )}
                        <span>ใช้ตามยอดขายคำนวณจากสูตร ยังไม่ได้ตัดสต๊อกจริง · กดชื่อเพื่อดูความเคลื่อนไหว</span>
                    </div>
                </div>
            )}

            {cardFor && (
                <StockCardPanel itemId={cardFor.id} itemName={cardFor.name} unit={cardFor.unit} onClose={() => setCardFor(null)} />
            )}
        </div>
    );
}
