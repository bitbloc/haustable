/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Receiving sheet · theme: Thai Modern OKLCH */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabaseClient';
import { logStaffActivity } from '../../utils/auditLogger';
import { displayUnit, addDays, shopDayOf } from '../../utils/stockCount';
import { buildBarcodeIndex, resolveScan, createScanGate, normalizeBarcode } from '../../utils/stockBarcode';
import { linkBarcodeToItem } from '../../utils/stockBarcodeLink';
import { validateReceiveLines, priceChange, expenseProblem, countUnitCost } from '../../utils/stockReceiving';
import ScanStrip from './ScanStrip';
import BarcodeLinkSheet from './BarcodeLinkSheet';

const DRAFT_KEY = 'stock_receive_draft_v1';
const newRef = () => (globalThis.crypto?.randomUUID?.() || `r_${Date.now()}_${Math.random().toString(36).slice(2)}`);
let keySeq = 0;
const nextKey = () => `l${Date.now()}_${++keySeq}`;

const readDraft = () => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; }
};
const writeDraft = (draft) => {
    try {
        if (draft.lines.length || draft.vendor) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        else localStorage.removeItem(DRAFT_KEY);
    } catch { /* storage unavailable */ }
};

const baht = (n) => `฿${Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const qty = (n) => Number(Number(n || 0).toFixed(3)).toLocaleString('th-TH', { maximumFractionDigits: 3 });

const INK = 'text-[oklch(18%_0.012_28)]';
const MUTED = 'text-[oklch(42%_0.010_28)]';
const NEUTRAL = 'text-[oklch(55%_0.010_28)]';
const RULE = 'border-[oklch(85%_0.012_28)]';
const ACCENT = 'text-[oklch(52%_0.16_28)]';
const segBtn = (active) => `px-3 py-2 font-sans font-bold text-[13px] leading-5 cursor-pointer text-left ${active ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]' : `bg-white ${MUTED} hover:bg-[oklch(94%_0.010_28)]`}`;

/**
 * Goods in: what arrived, how many, what the bill says. One save adds the stock,
 * updates cost prices and creates (or links) the expense, so the bill is keyed once.
 */
export default function StockReceivePage() {
    const navigate = useNavigate();
    const saved = useMemo(() => readDraft(), []);
    const [items, setItems] = useState([]);
    const [extraBarcodes, setExtraBarcodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [vendor, setVendor] = useState(saved?.vendor || '');
    const [note, setNote] = useState(saved?.note || '');
    const [lines, setLines] = useState(saved?.lines || []);
    const [expenseMode, setExpenseMode] = useState(saved?.expenseMode || 'new');
    const [payment, setPayment] = useState(saved?.payment || 'CASH');
    const [vatIncluded, setVatIncluded] = useState(saved?.vatIncluded ?? false);
    const [linkedExpenseId, setLinkedExpenseId] = useState(null);
    const [recentExpenses, setRecentExpenses] = useState([]);
    const [search, setSearch] = useState('');
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState(null);
    const [clientRef, setClientRef] = useState(() => saved?.clientRef || newRef());
    // scanning
    const [scanning, setScanning] = useState(false);
    const [scanStatus, setScanStatus] = useState('');
    const [unknownCode, setUnknownCode] = useState(null);
    const [linking, setLinking] = useState(false);
    const gateRef = useRef(createScanGate(1200));
    const unknownRef = useRef(null);
    useEffect(() => { unknownRef.current = unknownCode; }, [unknownCode]);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
        const since = addDays(shopDayOf(new Date()), -14);
        Promise.all([
            supabase.from('stock_items').select('*').order('name'),
            supabase.from('stock_item_barcodes').select('barcode, stock_item_id, units_per_scan'),
            supabase.from('store_expenses').select('id, expense_date, title, vendor_name, amount, category')
                .gte('expense_date', since).order('expense_date', { ascending: false }).limit(40)
        ]).then(([it, bc, ex]) => {
            if (it.error) throw it.error;
            setItems((it.data || []).filter(i => (i.item_type ?? 'raw') === 'raw' || (i.item_type === 'prep' && (i.prep_mode ?? 'stocked') === 'stocked')));
            setExtraBarcodes(bc.error ? [] : (bc.data || []));
            setRecentExpenses(ex.error ? [] : (ex.data || []));
        }).catch(err => {
            console.error(err);
            toast.error('โหลดรายการสต๊อกไม่สำเร็จ');
        }).finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!result) writeDraft({ vendor, note, lines, expenseMode, payment, vatIncluded, clientRef });
    }, [vendor, note, lines, expenseMode, payment, vatIncluded, clientRef, result]);

    const itemsById = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);
    const barcodeIndex = useMemo(() => buildBarcodeIndex(items, extraBarcodes), [items, extraBarcodes]);
    const check = useMemo(() => validateReceiveLines(lines), [lines]);
    const problem = expenseProblem(expenseMode, check, linkedExpenseId);

    const matches = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return [];
        return items.filter(i => i.name.toLowerCase().includes(q)).slice(0, 8);
    }, [items, search]);

    const updateLine = (key, patch) => {
        setLines(prev => prev.map(l => (l.key === key ? { ...l, ...patch } : l)));
        setErrors(prev => { if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
    };

    const addItem = useCallback((itemId, amount = 1, fromScan = false) => {
        setLines(prev => {
            const existing = prev.find(l => l.stockItemId === itemId);
            if (existing && fromScan) {
                const n = (Number(existing.quantity) || 0) + amount;
                return prev.map(l => (l === existing ? { ...l, quantity: String(Math.round(n * 10000) / 10000) } : l));
            }
            if (existing) return prev;
            return [{ key: nextKey(), stockItemId: itemId, quantity: String(amount), lineTotal: '', updateCost: true }, ...prev];
        });
    }, []);

    const handleScan = useCallback((text) => {
        const code = String(text || '').trim();
        const fresh = code && gateRef.current.accept(normalizeBarcode(code) || code);
        if (!fresh || unknownRef.current) return;
        const hit = resolveScan(barcodeIndex, code, new Set(itemsById.keys()));
        if (hit.itemId) {
            addItem(hit.itemId, hit.perScan, true);
            setScanStatus(`+${hit.perScan} ${itemsById.get(hit.itemId)?.name || ''}`);
            try { navigator.vibrate?.(35); } catch { /* iPhone */ }
        } else {
            setScanStatus(hit.isLabel ? 'ป้ายนี้เป็นของรายการที่รับเข้าไม่ได้' : `ยังไม่รู้จัก ${hit.code}`);
            if (!hit.isLabel) setUnknownCode(hit.code);
        }
    }, [barcodeIndex, itemsById, addItem]);

    const performedBy = user?.user_metadata?.full_name || user?.email || 'Staff';

    const linkUnknown = async (item, perScan) => {
        if (!unknownCode || linking) return;
        setLinking(true);
        const res = await linkBarcodeToItem({ item, code: unknownCode, perScan, performedBy });
        setLinking(false);
        if (!res.ok) { toast.error(res.message); return; }
        if (res.kind === 'main') setItems(prev => prev.map(i => i.id === item.id ? { ...i, barcode: unknownCode } : i));
        else setExtraBarcodes(prev => [...prev, res.row]);
        setUnknownCode(null);
        addItem(item.id, perScan, true);
        toast.success(`ผูกบาร์โค้ดกับ ${item.name} แล้ว`);
    };

    const handleSave = async () => {
        if (saving) return;
        setErrors(check.errors);
        if (Object.keys(check.errors).length) { toast.error('ยังมีรายการที่ต้องแก้'); return; }
        if (!check.lines.length) { toast.error('ยังไม่มีรายการรับเข้า'); return; }
        if (problem) { toast.error(problem); return; }
        setSaving(true);
        try {
            const { data, error } = await supabase.rpc('receive_stock', {
                p_lines: check.lines,
                p_vendor: vendor.trim() || null,
                p_expense: expenseMode === 'link'
                    ? { mode: 'link', expense_id: linkedExpenseId }
                    : expenseMode === 'new'
                        ? { mode: 'new', payment_method: payment, vat_included: vatIncluded, doc_type: vatIncluded ? 'tax_invoice' : 'cash_bill' }
                        : { mode: 'none' },
                p_performed_by: performedBy,
                p_note: note.trim() || null,
                p_client_ref: clientRef
            });
            if (error) throw error;
            logStaffActivity('stock', 'stock_receive', {
                staffName: performedBy,
                amount: Number(data?.total) || 0,
                reason: `รับของเข้า ${data?.line_count} รายการ${vendor ? ` จาก ${vendor}` : ''}${data?.total ? ` ${baht(data.total)}` : ''}`,
                metadata: { module: 'stock', receipt_id: data?.receipt_id, expense_id: data?.expense_id }
            });
            setResult(data);
            try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
            toast.success(data?.duplicate ? 'บิลนี้บันทึกไปแล้ว' : `รับเข้า ${data?.line_count} รายการแล้ว`);
        } catch (err) {
            console.error(err);
            const missing = err?.code === 'PGRST202' || /could not find the function/i.test(err?.message || '');
            toast.error(missing ? 'ฐานข้อมูลยังไม่มีระบบรับของเข้า กรุณาติดตั้ง migration ก่อน' : 'บันทึกไม่สำเร็จ: ' + (err?.message || ''));
        } finally {
            setSaving(false);
        }
    };

    const startNext = () => {
        setResult(null);
        setLines([]);
        setNote('');
        setLinkedExpenseId(null);
        setClientRef(newRef());
        gateRef.current.reset();
    };

    return (
        <div className={`min-h-screen bg-[oklch(97%_0.008_28)] ${INK} font-sans pb-28`}>
            <header className={`sticky top-0 z-20 bg-[oklch(97%_0.008_28)] border-b ${RULE}`}>
                <div className={`max-w-3xl mx-auto grid grid-cols-[auto_1fr] divide-x divide-[oklch(85%_0.012_28)] border-x ${RULE}`}>
                    <button type="button" onClick={() => navigate('/staff/stock')}
                        className={`px-4 font-bold text-[13px] ${MUTED} hover:bg-[oklch(94%_0.010_28)] cursor-pointer`}>
                        กลับ
                    </button>
                    <div className="px-4 py-2.5">
                        <span className={`font-mono text-[10px] font-bold uppercase tracking-wider ${ACCENT} block`}>GOODS IN</span>
                        <h1 className="font-bold text-lg leading-7">รับของเข้า</h1>
                        <p className={`text-[12px] leading-5 ${MUTED}`}>บันทึกครั้งเดียว ได้ทั้งสต๊อก ราคาทุนล่าสุด และค่าใช้จ่าย</p>
                    </div>
                </div>
            </header>

            <main className={`max-w-3xl mx-auto border-x ${RULE} bg-white min-h-[60vh]`}>
                {result ? (
                    <section className="p-4 space-y-4" aria-labelledby="receive-result">
                        <div>
                            <h2 id="receive-result" className="font-bold text-base leading-7">
                                รับเข้าแล้ว {result.line_count} รายการ{result.total ? ` · ${baht(result.total)}` : ''}
                            </h2>
                            <p className={`text-[13px] leading-6 ${MUTED}`}>
                                {result.duplicate
                                    ? 'บิลนี้ถูกบันทึกไปแล้วก่อนหน้า ไม่ได้รับเข้าซ้ำ'
                                    : result.expense_id
                                        ? (expenseMode === 'link' ? 'ผูกกับค่าใช้จ่ายที่บันทึกไว้แล้ว' : 'สร้างค่าใช้จ่ายวัตถุดิบในหน้าบัญชีแล้ว')
                                        : 'ไม่ได้บันทึกค่าใช้จ่าย'}
                            </p>
                        </div>
                        {Array.isArray(result.lines) && (
                            <ol className={`border ${RULE} divide-y divide-[oklch(90%_0.008_28)]`}>
                                {result.lines.map(l => (
                                    <li key={l.stock_item_id} className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-2">
                                        <span className="font-bold text-[14px] leading-6 min-w-0 break-words">{l.name}</span>
                                        <span className="font-mono text-[13px] tabular-nums text-right">+{qty(l.quantity)} {displayUnit(l.unit)}</span>
                                        <span className={`text-[12px] leading-5 ${NEUTRAL}`}>
                                            {l.new_cost_price !== null && l.new_cost_price !== undefined
                                                ? `ราคาทุนอัปเดตเป็น ฿${Number(l.unit_cost).toFixed(2)}/${displayUnit(l.unit)}`
                                                : 'ราคาทุนเดิม'}
                                        </span>
                                        <span className={`font-mono text-[12px] tabular-nums text-right ${NEUTRAL}`}>เหลือ {qty(l.balance_after)}</span>
                                    </li>
                                ))}
                            </ol>
                        )}
                        <div className={`grid grid-cols-2 border ${RULE} divide-x divide-[oklch(85%_0.012_28)]`}>
                            <button type="button" onClick={startNext} className="py-3 font-bold text-[14px] hover:bg-[oklch(94%_0.010_28)] cursor-pointer">รับบิลถัดไป</button>
                            <button type="button" onClick={() => navigate('/staff/stock')}
                                className="py-3 font-bold text-[14px] bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] hover:bg-black cursor-pointer">กลับหน้าคลัง</button>
                        </div>
                    </section>
                ) : (
                    <>
                        {/* Bill */}
                        <section className={`p-3 border-b ${RULE} bg-[oklch(98%_0.004_28)] grid gap-2 sm:grid-cols-2`} aria-label="ข้อมูลบิล">
                            <label className="block">
                                <span className={`block text-[12px] leading-5 ${MUTED} mb-1`}>ร้าน / ผู้ขาย</span>
                                <input type="text" value={vendor} onChange={e => setVendor(e.target.value)} list="receive-vendors" placeholder="เช่น Makro, ตลาด"
                                    className={`w-full p-2 border ${RULE} bg-white text-[14px] outline-none focus:border-black`} />
                                <datalist id="receive-vendors">
                                    {[...new Set(['Makro', 'Siam Makro', 'ตลาด', ...recentExpenses.map(e => e.vendor_name).filter(Boolean)])].map(v => <option key={v} value={v} />)}
                                </datalist>
                            </label>
                            <label className="block">
                                <span className={`block text-[12px] leading-5 ${MUTED} mb-1`}>โน้ต (ไม่บังคับ)</span>
                                <input type="text" value={note} onChange={e => setNote(e.target.value)} maxLength={200} placeholder="เลขที่บิล หรือหมายเหตุ"
                                    className={`w-full p-2 border ${RULE} bg-white text-[14px] outline-none focus:border-black`} />
                            </label>
                        </section>

                        {/* Add items */}
                        <section className={`p-3 border-b ${RULE} space-y-2`} aria-label="เพิ่มรายการ">
                            <div className={`grid grid-cols-[1fr_auto] border ${RULE} divide-x divide-[oklch(85%_0.012_28)]`}>
                                <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาวัตถุดิบที่รับเข้า..."
                                    aria-label="ค้นหาวัตถุดิบ" className="w-full min-w-0 p-2 bg-white text-[14px] outline-none" />
                                <button type="button" onClick={() => { setScanning(s => !s); gateRef.current.reset(); }} aria-pressed={scanning}
                                    className={`px-4 font-bold text-[14px] cursor-pointer ${scanning ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]' : 'bg-white hover:bg-[oklch(94%_0.010_28)]'}`}>
                                    {scanning ? 'กำลังสแกน' : 'สแกน'}
                                </button>
                            </div>
                            {matches.length > 0 && (
                                <ul className={`border ${RULE} divide-y divide-[oklch(90%_0.008_28)]`}>
                                    {matches.map(i => (
                                        <li key={i.id}>
                                            <button type="button" onClick={() => { addItem(i.id, 1); setSearch(''); }}
                                                className="w-full text-left px-3 py-2 grid grid-cols-[1fr_auto] gap-3 items-baseline hover:bg-[oklch(94%_0.010_28)] cursor-pointer">
                                                <span className="font-bold text-[14px] leading-6 break-words min-w-0">{i.name}</span>
                                                <span className={`text-[12px] ${NEUTRAL}`}>{displayUnit(i.unit)}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {search.trim() && matches.length === 0 && !loading && <p className={`text-[13px] ${NEUTRAL}`}>ไม่พบวัตถุดิบชื่อนี้</p>}
                        </section>

                        {scanning && (
                            <ScanStrip onCode={handleScan} onClose={() => setScanning(false)} status={scanStatus || 'สแกนของที่รับเข้า สแกน 1 ครั้ง = รับเพิ่ม 1'} />
                        )}

                        {/* Lines */}
                        {loading ? (
                            <p className={`p-6 text-[14px] ${NEUTRAL}`}>กำลังโหลด...</p>
                        ) : lines.length === 0 ? (
                            <p className={`p-6 text-[14px] leading-6 ${MUTED}`}>ค้นหาหรือสแกนของที่รับเข้า ใส่จำนวนตามหน่วยนับในคลัง และราคารวมตามบิล</p>
                        ) : (
                            <ul className="divide-y divide-[oklch(90%_0.008_28)]" aria-label="รายการรับเข้า">
                                {lines.map(l => {
                                    const item = itemsById.get(l.stockItemId);
                                    const change = item ? priceChange(item, l.quantity, l.lineTotal) : null;
                                    const err = errors[l.key];
                                    const u = displayUnit(item?.unit);
                                    return (
                                        <li key={l.key} className={`px-3 py-3 space-y-2 ${err ? 'bg-[oklch(97%_0.02_28)]' : ''}`}>
                                            <div className="grid grid-cols-[1fr_auto] gap-3 items-baseline">
                                                <span className="font-bold text-[15px] leading-6 break-words min-w-0">{item?.name || 'ไม่พบวัตถุดิบ'}</span>
                                                <button type="button" onClick={() => setLines(prev => prev.filter(x => x.key !== l.key))}
                                                    className={`text-[12px] font-bold ${NEUTRAL} hover:text-[oklch(52%_0.16_28)] cursor-pointer`}>ลบ</button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <label className={`flex items-center border ${RULE} bg-white focus-within:border-black`}>
                                                    <input type="text" inputMode="decimal" value={l.quantity} onChange={e => updateLine(l.key, { quantity: e.target.value })}
                                                        aria-label={`จำนวน ${item?.name || ''}`} placeholder="0"
                                                        className="w-full min-w-0 p-2 bg-transparent font-mono font-bold text-[16px] text-right outline-none" />
                                                    <span className={`pr-2 text-[12px] shrink-0 ${MUTED}`}>{u}</span>
                                                </label>
                                                <label className={`flex items-center border ${RULE} bg-white focus-within:border-black`}>
                                                    <span className={`pl-2 text-[12px] shrink-0 ${MUTED}`}>รวม ฿</span>
                                                    <input type="text" inputMode="decimal" value={l.lineTotal} onChange={e => updateLine(l.key, { lineTotal: e.target.value })}
                                                        aria-label={`ราคารวม ${item?.name || ''}`} placeholder="ตามบิล"
                                                        className="w-full min-w-0 p-2 bg-transparent font-mono font-bold text-[16px] text-right outline-none" />
                                                </label>
                                            </div>
                                            {change && (
                                                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                                    <span className={`text-[12px] leading-5 ${change.big ? `${ACCENT} font-bold` : NEUTRAL}`}>
                                                        ฿{change.unitNow.toFixed(2)}/{u}
                                                        {change.before > 0
                                                            ? ` · เดิม ฿${change.before.toFixed(2)} (${change.pct >= 0 ? '+' : ''}${change.pct.toFixed(0)}%)`
                                                            : ' · ยังไม่มีราคาทุน'}
                                                        {change.big ? ' ตรวจจำนวนกับราคาอีกครั้ง' : ''}
                                                    </span>
                                                    <label className={`flex items-center gap-1.5 text-[12px] leading-5 ${MUTED} cursor-pointer select-none`}>
                                                        <input type="checkbox" checked={l.updateCost !== false} onChange={e => updateLine(l.key, { updateCost: e.target.checked })}
                                                            className="w-4 h-4 accent-[oklch(18%_0.012_28)]" />
                                                        อัปเดตราคาทุน
                                                    </label>
                                                </div>
                                            )}
                                            {!change && item && countUnitCost(item) > 0 && (
                                                <span className={`block text-[12px] leading-5 ${NEUTRAL}`}>ราคาทุนเดิม ฿{countUnitCost(item).toFixed(2)}/{u}</span>
                                            )}
                                            {err && <p className={`text-[12px] font-bold ${ACCENT}`}>{err}</p>}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}

                        {/* Expense */}
                        <section className={`p-3 border-t ${RULE} bg-[oklch(98%_0.004_28)] space-y-2`} aria-label="ค่าใช้จ่าย">
                            <span className={`block text-[12px] leading-5 font-bold ${MUTED}`}>ค่าใช้จ่ายของบิลนี้</span>
                            <div className={`grid sm:grid-cols-3 border ${RULE} divide-y sm:divide-y-0 sm:divide-x divide-[oklch(85%_0.012_28)]`} role="radiogroup" aria-label="ค่าใช้จ่าย">
                                {[['new', 'สร้างค่าใช้จ่ายใหม่'], ['link', 'บันทึกไว้แล้ว (ผูก)'], ['none', 'ไม่บันทึก']].map(([v, label]) => (
                                    <button key={v} type="button" role="radio" aria-checked={expenseMode === v} onClick={() => setExpenseMode(v)} className={segBtn(expenseMode === v)}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                            {expenseMode === 'new' && (
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                    <div className={`flex border ${RULE} divide-x divide-[oklch(85%_0.012_28)]`} role="radiogroup" aria-label="วิธีจ่าย">
                                        {[['CASH', 'เงินสด'], ['TRANSFER', 'โอน'], ['CREDIT', 'เครดิต']].map(([v, label]) => (
                                            <button key={v} type="button" role="radio" aria-checked={payment === v} onClick={() => setPayment(v)} className={segBtn(payment === v)}>{label}</button>
                                        ))}
                                    </div>
                                    <label className={`flex items-center gap-2 text-[13px] leading-5 ${MUTED} cursor-pointer select-none`}>
                                        <input type="checkbox" checked={vatIncluded} onChange={e => setVatIncluded(e.target.checked)} className="w-4 h-4 accent-[oklch(18%_0.012_28)]" />
                                        ใบกำกับภาษี (รวม VAT 7%)
                                    </label>
                                </div>
                            )}
                            {expenseMode === 'link' && (
                                recentExpenses.length === 0 ? (
                                    <p className={`text-[13px] leading-6 ${MUTED}`}>ไม่มีค่าใช้จ่ายใน 14 วันที่ผ่านมา</p>
                                ) : (
                                    <ul className={`border ${RULE} bg-white divide-y divide-[oklch(90%_0.008_28)] max-h-64 overflow-y-auto`} role="radiogroup" aria-label="ค่าใช้จ่ายที่บันทึกไว้">
                                        {recentExpenses.map(e => (
                                            <li key={e.id}>
                                                <button type="button" role="radio" aria-checked={linkedExpenseId === e.id} onClick={() => setLinkedExpenseId(e.id)}
                                                    className={`w-full text-left px-3 py-2 grid grid-cols-[1fr_auto] gap-x-3 cursor-pointer ${linkedExpenseId === e.id ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]' : 'hover:bg-[oklch(94%_0.010_28)]'}`}>
                                                    <span className="font-bold text-[14px] leading-6 break-words min-w-0">{e.vendor_name || e.title}</span>
                                                    <span className="font-mono text-[13px] tabular-nums">{baht(e.amount)}</span>
                                                    <span className={`text-[12px] leading-5 break-words ${linkedExpenseId === e.id ? 'text-[oklch(85%_0.012_28)]' : NEUTRAL}`}>{e.title}</span>
                                                    <span className={`font-mono text-[12px] ${linkedExpenseId === e.id ? 'text-[oklch(85%_0.012_28)]' : NEUTRAL}`}>{e.expense_date}</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )
                            )}
                            {expenseMode === 'none' && <p className={`text-[12px] leading-5 ${NEUTRAL}`}>เช่น ของที่ได้ฟรี หรือย้ายมาจากอีกสาขา สต๊อกเพิ่มแต่ไม่มีค่าใช้จ่าย</p>}
                            {problem && lines.length > 0 && <p className={`text-[12px] leading-5 font-bold ${ACCENT}`}>{problem}</p>}
                        </section>
                    </>
                )}
            </main>

            {!result && (
                <footer className={`fixed bottom-0 inset-x-0 z-20 bg-[oklch(97%_0.008_28)] border-t ${RULE}`}>
                    <div className={`max-w-3xl mx-auto grid grid-cols-[1fr_auto] items-center border-x ${RULE}`}>
                        <span className={`px-4 text-[13px] leading-5 ${MUTED}`}>
                            <span className={`font-mono font-bold ${INK}`}>{lines.length}</span> รายการ
                            {check.priced > 0 && <> · <span className={`font-mono font-bold ${INK}`}>{baht(check.total)}</span></>}
                            <span className={`block text-[11px] ${NEUTRAL}`}>ร่างบันทึกไว้ในเครื่อง ปิดหน้าแล้วกลับมาต่อได้</span>
                        </span>
                        <button type="button" onClick={handleSave} disabled={saving || !lines.length || Boolean(problem)}
                            className="px-6 py-4 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold text-[15px] hover:bg-black disabled:opacity-40 cursor-pointer">
                            {saving ? 'กำลังบันทึก...' : 'บันทึกรับเข้า'}
                        </button>
                    </div>
                </footer>
            )}

            {unknownCode && (
                <BarcodeLinkSheet code={unknownCode} items={items} saving={linking} onLink={linkUnknown} onSkip={() => setUnknownCode(null)} />
            )}
        </div>
    );
}
