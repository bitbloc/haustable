/* Hallmark · shape: app screen · theme: Thai Twist Modern (Brand v2) · v2.0.0 */
/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import * as ui from './stockUi';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabaseClient';
import LiquidLevelSlider from './LiquidLevelSlider';
import { formatStockDisplay, packCapacity } from '../../utils/stockUtils';
import { displayUnit, qtyInWords, evaluateStockAdjustment, formatReconQty } from '../../utils/stockCount';
import { usagePerStockUnit, fullUnitCapacity } from '../../utils/recipeGraph';
import { STOCK_REASONS } from '../../utils/stockLedger';
import { getUnitType } from '../../utils/unitUtils';
import { optimizeImageUrl } from '../../utils/urlHelper';

// Why stock leaves outside of sales. Waste and staff meals get their own column
// in the daily reconciliation; everything else is "other out".
const WITHDRAW_REASONS = [
    { key: STOCK_REASONS.WASTE, label: 'ของเสีย / ทิ้ง' },
    { key: STOCK_REASONS.STAFF_MEAL, label: 'พนักงานกิน' },
    { key: STOCK_REASONS.ADJUST, label: 'อื่น ๆ' }
];

export default function AdjustmentModal({ item, initialMode = 'in', currentUser, onClose, onUpdate, onEdit }) {
    const [amount, setAmount] = useState('');
    const [mode, setMode] = useState(initialMode || 'in'); // 'in' | 'out' | 'set'
    const [outReason, setOutReason] = useState(null);
    const [outNote, setOutNote] = useState('');
    const [selectedUnit, setSelectedUnit] = useState(null);
    const [unitOptions, setUnitOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [recentPurchase, setRecentPurchase] = useState(null);
    const [confirmedWarning, setConfirmedWarning] = useState(false);

    const savingRef = useRef(false);
    const countInPieces = useRef(null);
    const reduceMotion = useReducedMotion();

    // Liquid / Partial State (for Set/Count mode)
    const [partialAmount, setPartialAmount] = useState(0); // 0.0 - 0.99
    const [useMlCalculator, setUseMlCalculator] = useState(false);
    const [fullCapacityMl, setFullCapacityMl] = useState(750);
    const [remainingMl, setRemainingMl] = useState(0);

    useEffect(() => {
        if (!item) return;
        const cap = fullUnitCapacity(item);
        if (cap && cap.unit === 'ml') setFullCapacityMl(cap.amount);

        const options = [{
            key: 'base',
            label: displayUnit(item.unit || item.pack_unit) || 'หน่วย',
            factor: 1
        }];

        if (item.usage_unit && item.usage_unit !== item.unit) {
            options.push({
                key: 'usage',
                label: displayUnit(item.usage_unit),
                factor: 1 / (usagePerStockUnit(item) || 1)
            });
        }

        if (item.unit_config) {
            Object.entries(item.unit_config).forEach(([key, config]) => {
                options.push({
                    key,
                    label: config.unit_label || key,
                    factor: Number(config.factor) || 1
                });
            });
        }

        const baseLower = String(item.unit || item.pack_unit || '').trim().toLowerCase();
        const isPortionBase = baseLower === 'portion' || baseLower === 'potion' || baseLower === 'สูตร';
        const inside = packCapacity(item);
        const piecesInside = !isPortionBase && !!inside && (getUnitType(inside.unit) === 'count' || ['แก้ว', 'ชิ้น', 'ใบ', 'อัน'].includes(inside.unit));
        const pieceOpt = piecesInside ? options.find(o => o.key === 'usage') || null : null;
        countInPieces.current = pieceOpt;

        const startMode = initialMode || 'in';
        setUnitOptions(options);
        setSelectedUnit(startMode === 'set' && pieceOpt ? pieceOpt : options[0]);
        setAmount('');
        setPartialAmount(0);
        setMode(startMode);
        setOutReason(null);
        setOutNote('');
        setConfirmedWarning(false);
        setRecentPurchase(null);

        // Fetch any purchase logged in the last 60 minutes to warn if staff count equal to just-received qty
        let cancelled = false;
        const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        supabase.from('stock_transactions')
            .select('quantity_change, created_at')
            .eq('stock_item_id', item.id)
            .eq('reason', 'purchase')
            .gte('created_at', sinceIso)
            .order('created_at', { ascending: false })
            .limit(1)
            .then(({ data }) => {
                if (cancelled) return;
                const latest = data?.[0];
                if (latest && Number(latest.quantity_change) > 0) {
                    setRecentPurchase({ qty: Number(latest.quantity_change), at: latest.created_at });
                }
            });
        return () => { cancelled = true; };
    }, [item, initialMode]);

    // Calculator Logic
    useEffect(() => {
        if (useMlCalculator && fullCapacityMl > 0) {
            const ratio = remainingMl / fullCapacityMl;
            setPartialAmount(Math.min(Math.max(ratio, 0), 1));
        }
    }, [remainingMl, fullCapacityMl, useMlCalculator]);

    // Pre-fill when entering Set mode
    useEffect(() => {
        if (mode === 'set' && item && selectedUnit) {
            const qty = Math.max(0, Number(item.current_quantity) || 0);
            if (selectedUnit.factor !== 1) {
                const inUnit = qty / selectedUnit.factor;
                setAmount(String(Number(inUnit.toFixed(2))));
                setPartialAmount(0);
            } else {
                const { fullUnits, remainder } = formatStockDisplay(qty);
                setAmount(fullUnits.toString());
                setPartialAmount(remainder);
                if (fullCapacityMl) setRemainingMl(Math.round(remainder * fullCapacityMl));
            }
        }
    }, [mode, item, selectedUnit]); // eslint-disable-line react-hooks/exhaustive-deps

    // Receiving and withdrawing start from an empty field
    useEffect(() => {
        if (mode !== 'set') { setAmount(''); setPartialAmount(0); }
    }, [mode, item]);

    // Reset warning confirmation whenever the staff edits the value, unit, or mode
    useEffect(() => {
        setConfirmedWarning(false);
    }, [amount, selectedUnit, mode, partialAmount]);

    const evaluation = useMemo(() => evaluateStockAdjustment({
        item, mode, amount, selectedUnit, partialAmount, recentPurchase
    }), [item, mode, amount, selectedUnit, partialAmount, recentPurchase]);

    const hasHighWarning = evaluation.warnings.some(w => w.severity === 'high');

    const handleSave = async () => {
        if (savingRef.current) return;
        if (hasHighWarning && !confirmedWarning) {
            setConfirmedWarning(true);
            return;
        }
        savingRef.current = true;
        setLoading(true);
        try {
            const mainVal = parseFloat(amount || 0);

            if (mode === 'set') {
                const opened = selectedUnit.factor !== 1 ? 0 : partialAmount;
                const finalTotal = Number((mainVal * selectedUnit.factor + opened).toFixed(4));

                await onUpdate(item.id, finalTotal, 'set', {
                    note: `นับสต็อกได้: ${qtyInWords(item, finalTotal, packCapacity(item))}`
                });
            } else {
                if (mainVal <= 0) {
                    setLoading(false);
                    savingRef.current = false;
                    return;
                }
                const actualChange = mainVal * selectedUnit.factor;
                const finalChange = mode === 'in' ? actualChange : -actualChange;
                const reason = mode === 'out' ? WITHDRAW_REASONS.find(r => r.key === outReason) : null;
                if (mode === 'out' && !reason) {
                    toast.error('เลือกเหตุผลการเบิกออกก่อน');
                    setLoading(false);
                    savingRef.current = false;
                    return;
                }
                const extra = outNote.trim() ? ` (${outNote.trim()})` : '';

                await onUpdate(item.id, finalChange, mode, {
                    reason: reason?.key,
                    note: mode === 'in'
                        ? `ปรับปรุงรายการ: รับเข้า ${mainVal} ${selectedUnit.label}`
                        : `เบิกออก (${reason.label}) ${mainVal} ${selectedUnit.label}${extra}`
                });
            }

            onClose();
        } catch (error) {
            console.error(error);
            toast.error('บันทึกการปรับสต๊อกไม่สำเร็จ');
        } finally {
            setLoading(false);
            savingRef.current = false;
        }
    };

    const quickAdd = (val) => {
        const current = amount ? parseFloat(amount) : 0;
        setAmount((current + val).toString());
    };

    if (!item) return null;

    const MODES = [
        { id: 'in', label: 'รับเข้า' },
        { id: 'out', label: 'เบิกออก' },
        { id: 'set', label: 'ตรวจนับ' }
    ];
    const decrement = () => { const val = parseFloat(amount || 0); if (val > 0) setAmount(String(Math.max(0, val - 1))); };
    const stockNow = qtyInWords(item, item.current_quantity, packCapacity(item));
    const countsOpened = selectedUnit?.factor === 1 && !countInPieces.current;
    const shownUnits = mode === 'set' && countInPieces.current ? unitOptions.filter(o => o.key !== 'base') : unitOptions;
    const disabled = loading || (mode !== 'set' && (!amount || parseFloat(amount) <= 0)) || (mode === 'out' && !outReason);

    const fmtBase = (val) => formatReconQty(val, {
        unit: item.unit || item.pack_unit,
        factor: Number(item.conversion_factor) || 1,
        usageUnit: item.usage_unit || ''
    }, 2);

    const confirmLabel = loading
        ? 'กำลังบันทึก…'
        : hasHighWarning && !confirmedWarning
            ? 'ตรวจตัวเลขแล้ว กดอีกครั้งเพื่อยืนยัน'
            : mode === 'set'
                ? 'บันทึกการนับ'
                : mode === 'in'
                    ? 'ยืนยันรับเข้า'
                    : 'ยืนยันเบิกออก';

    const renderStepper = (ariaLabel) => (
        <div className="flex gap-2">
            <button type="button" onClick={decrement} className={ui.stepBtn} aria-label="ลด 1">−</button>
            <input
                type="number"
                inputMode="decimal"
                aria-label={ariaLabel}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className={`flex-1 min-w-0 h-12 rounded-md border ${ui.RULE} ${ui.PAPER} text-center text-2xl font-semibold tabular-nums ${ui.INK} outline-none transition-colors focus:border-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)]`}
            />
            <button type="button" onClick={() => quickAdd(1)} className={ui.stepBtn} aria-label="เพิ่ม 1">+</button>
        </div>
    );

    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-[var(--color-veil)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.16 } }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <motion.div
                {...ui.sheetMotion(reduceMotion)}
                role="dialog"
                aria-modal="true"
                aria-label={`ปรับสต๊อก ${item.name}`}
                className={`${ui.PAPER} w-full sm:max-w-sm border ${ui.RULE} rounded-t-xl sm:rounded-lg shadow-[var(--shadow-sheet)] flex flex-col max-h-[92dvh] overflow-hidden`}
            >
                {/* Header: photo, name, what is in stock now */}
                <div className="px-4 pt-4 pb-3 flex items-start gap-3">
                    <div className={`w-14 h-14 rounded-md overflow-hidden border ${ui.RULE} ${ui.PAPER2} shrink-0`}>
                        {item.image_url
                            ? <img src={optimizeImageUrl(item.image_url, 120, 75)} alt="" className="w-full h-full object-cover" onError={e => { if (e.currentTarget.src !== item.image_url) e.currentTarget.src = item.image_url; }} />
                            : <div className={`w-full h-full flex items-center justify-center text-[12px] ${ui.NEUTRAL}`}>ไม่มีรูป</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className={`text-base font-semibold leading-6 ${ui.INK} line-clamp-2`}>{item.name}</h2>
                        <div className={`text-sm ${ui.MUTED} tabular-nums`}>คงเหลือ {stockNow}</div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                        <button type="button" onClick={onEdit} className={ui.ghostBtn}>แก้</button>
                        <button type="button" onClick={onClose} className={ui.ghostBtn}>ปิด</button>
                    </div>
                </div>

                {/* Mode switch */}
                <div className="px-4">
                    <div className={`relative grid grid-cols-3 p-1 rounded-md ${ui.PAPER2}`} role="tablist" aria-label="ประเภทการปรับสต๊อก">
                        {MODES.map(m => (
                            <button
                                key={m.id}
                                type="button"
                                role="tab"
                                aria-selected={mode === m.id}
                                onClick={() => { if (m.id === 'set' && countInPieces.current) setSelectedUnit(countInPieces.current); setMode(m.id); }}
                                className={`relative min-h-[40px] rounded text-sm transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)] ${mode === m.id ? `${ui.INK} font-semibold` : `${ui.NEUTRAL} hover:text-[var(--color-ink)]`}`}
                            >
                                {mode === m.id && (
                                    <motion.span
                                        layoutId="adjust-mode-pill"
                                        className={`absolute inset-0 rounded ${ui.PAPER} shadow-[var(--shadow-pill)]`}
                                        transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: ui.EASE }}
                                    />
                                )}
                                <span className="relative">{m.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Body */}
                <div className="px-4 py-4 flex-1 overflow-y-auto space-y-4">
                    {/* Unit Selector */}
                    {shownUnits.length > 1 && (
                        <div>
                            <span className={ui.label}>เลือกหน่วยที่กรอก</span>
                            <div className="flex flex-wrap gap-2">
                                {shownUnits.map(opt => (
                                    <button key={opt.key} type="button" onClick={() => setSelectedUnit(opt)} className={ui.chip(selectedUnit?.key === opt.key)}>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <AnimatePresence mode="wait" initial={false}>
                        {mode === 'set' ? (
                            <motion.div key="set" {...ui.panelMotion(reduceMotion)} className="space-y-4">
                                <div>
                                    <span className={ui.label}>{countsOpened ? 'ยังไม่เปิด' : 'นับได้ทั้งหมด'} ({selectedUnit?.label})</span>
                                    {renderStepper('จำนวนที่ยังไม่เปิด')}
                                </div>

                                {countsOpened && (
                                    <div className={`rounded-md border ${ui.RULE} p-3 space-y-3`}>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={`text-sm ${ui.INK}`}>มีของที่เปิดใช้อยู่</span>
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={partialAmount > 0}
                                                onClick={() => setPartialAmount(partialAmount > 0 ? 0 : 0.5)}
                                                className={`relative w-12 h-7 rounded-full transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)] ${partialAmount > 0 ? 'bg-[var(--color-ink)]' : 'bg-[var(--color-rule)]'}`}
                                            >
                                                <motion.span
                                                    className="absolute top-1 left-1 w-5 h-5 rounded-full bg-[var(--color-paper)]"
                                                    animate={{ x: partialAmount > 0 ? 20 : 0 }}
                                                    transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: ui.EASE }}
                                                />
                                            </button>
                                        </div>
                                        {partialAmount > 0 && (
                                            <div className="pt-1 space-y-2">
                                                {useMlCalculator ? (
                                                    <div className="space-y-2">
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <label className={ui.label}>เต็มขวด (มล.)</label>
                                                                <input type="number" inputMode="decimal" value={fullCapacityMl || ''}
                                                                    onChange={e => setFullCapacityMl(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                                                    className={`${ui.input} tabular-nums`} />
                                                            </div>
                                                            <div>
                                                                <label className={ui.label}>เหลือ (มล.)</label>
                                                                <input type="number" inputMode="decimal" value={remainingMl || ''} autoFocus
                                                                    onChange={e => setRemainingMl(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                                                    className={`${ui.input} tabular-nums`} />
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center justify-between text-sm">
                                                            <span className={`${ui.INK} font-semibold tabular-nums`}>= {Math.round((partialAmount || 0) * 100)}%</span>
                                                            <button type="button" onClick={() => setUseMlCalculator(false)} className={`text-xs ${ui.MUTED} underline underline-offset-2 cursor-pointer`}>กะด้วยสายตา</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-4">
                                                            <LiquidLevelSlider value={Math.round(partialAmount * 100)} onChange={(val) => setPartialAmount(val / 100)} />
                                                            <div>
                                                                <div className={`text-2xl font-semibold tabular-nums ${ui.INK}`}>{Math.round(partialAmount * 100)}%</div>
                                                                <div className={`text-xs ${ui.NEUTRAL}`}>ประมาณด้วยสายตา</div>
                                                            </div>
                                                        </div>
                                                        <button type="button" onClick={() => { setUseMlCalculator(true); setRemainingMl(0); }} className={`text-xs ${ui.MUTED} underline underline-offset-2 cursor-pointer`}>
                                                            คำนวณจาก มล.
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div key={mode} {...ui.panelMotion(reduceMotion)} className="space-y-4">
                                <div>
                                    <span className={ui.label}>จำนวน{selectedUnit ? ` (${selectedUnit.label})` : ''}</span>
                                    {renderStepper(mode === 'in' ? 'จำนวนรับเข้า' : 'จำนวนเบิกออก')}
                                </div>
                                {mode === 'out' && (
                                    <div className="space-y-2">
                                        <span className={ui.label}>เหตุผล</span>
                                        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="เหตุผลการเบิกออก">
                                            {WITHDRAW_REASONS.map(r => (
                                                <button key={r.key} type="button" role="radio" aria-checked={outReason === r.key}
                                                    onClick={() => setOutReason(r.key)}
                                                    className={`${ui.chip(outReason === r.key)} px-2 leading-snug`}>
                                                    {r.label}
                                                </button>
                                            ))}
                                        </div>
                                        <input
                                            type="text"
                                            value={outNote}
                                            onChange={(e) => setOutNote(e.target.value)}
                                            placeholder={outReason === STOCK_REASONS.WASTE ? 'เช่น เสีย หมดอายุ ทำหก' : 'โน้ต (ไม่บังคับ)'}
                                            maxLength={120}
                                            className={ui.input}
                                        />
                                        <p className={`text-xs ${ui.NEUTRAL} leading-relaxed`}>
                                            ของที่ใช้ทำเมนูที่ขาย ระบบคิดจากสูตรให้แล้ว เบิกออกเฉพาะของเสีย ของที่พนักงานกิน หรือเหตุอื่น
                                        </p>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Sanity Guardrail Warnings (with 1-tap unit switch for kg/g & l/ml mix-ups) */}
                    {evaluation.warnings.length > 0 && (
                        <div className="rounded-md border border-[var(--brand-plum)] bg-[var(--color-plum-pale)] p-3 space-y-2" role="alert">
                            {evaluation.warnings.map(w => (
                                <div key={w.code} className="space-y-2">
                                    <p className="text-[13px] leading-5 font-semibold text-[var(--brand-plum)]">
                                        {w.message}
                                    </p>
                                    {w.fixUnitKey && unitOptions.some(o => o.key === w.fixUnitKey) && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const nextUnit = unitOptions.find(o => o.key === w.fixUnitKey);
                                                if (nextUnit) setSelectedUnit(nextUnit);
                                            }}
                                            className="px-3 min-h-[36px] rounded border border-[var(--brand-plum)] bg-[var(--color-paper)] text-[13px] font-bold text-[var(--brand-plum)] hover:bg-[var(--brand-plum)] hover:text-[var(--color-paper)] transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)]"
                                        >
                                            เปลี่ยนหน่วยเป็น {w.fixUnitLabel}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Live Before -> After Equation Preview (for ALL 3 modes) */}
                    {evaluation.valid && (
                        <div className={`rounded-md border ${ui.RULE} ${ui.PAPER2} px-3 py-2.5 space-y-1`}>
                            <div className={`text-xs ${ui.NEUTRAL}`}>
                                สรุปยอดหลังบันทึก ({currentUser?.user_metadata?.full_name || 'พนักงาน'})
                            </div>
                            <div className={`text-sm font-semibold tabular-nums ${ui.INK} flex flex-wrap items-baseline gap-x-2`}>
                                <span className={ui.MUTED}>เดิม {fmtBase(evaluation.currentQty)}</span>
                                <span className={ui.NEUTRAL}>→</span>
                                <span className={evaluation.deltaQty < 0 ? 'text-[var(--brand-plum)]' : ui.INK}>
                                    ใหม่ {fmtBase(evaluation.nextQty)}
                                </span>
                                {Math.abs(evaluation.deltaQty) >= 0.0001 && (
                                    <span className={`text-xs font-medium ${evaluation.deltaQty < 0 ? 'text-[var(--brand-plum)]' : ui.MUTED}`}>
                                        ({evaluation.deltaQty > 0 ? '+' : '-'}{fmtBase(Math.abs(evaluation.deltaQty))})
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={`px-4 py-3 border-t ${ui.RULE} pb-[max(0.75rem,env(safe-area-inset-bottom))]`}>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={disabled}
                        className={hasHighWarning && !confirmedWarning
                            ? 'w-full h-12 rounded-md bg-[var(--brand-plum)] text-[var(--color-paper)] text-base font-semibold cursor-pointer transition-[background-color,transform] hover:bg-[var(--brand-plum-2)] active:scale-[0.99] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-[var(--brand-plum)] disabled:bg-[var(--color-paper-3)] disabled:text-[var(--color-neutral)] disabled:cursor-not-allowed'
                            : ui.primaryBtn}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
