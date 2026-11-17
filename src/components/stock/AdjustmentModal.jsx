import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import * as ui from './stockUi';
import { toast } from 'sonner';
import LiquidLevelSlider from './LiquidLevelSlider';
import { formatStockDisplay, packCapacity } from '../../utils/stockUtils';
import { displayUnit, qtyInWords } from '../../utils/stockCount';
import { usagePerStockUnit, fullUnitCapacity } from '../../utils/recipeGraph';
import { STOCK_REASONS } from '../../utils/stockLedger';
import { getUnitType } from '../../utils/unitUtils';

// Why stock leaves outside of sales. Waste and staff meals get their own column
// in the daily reconciliation; everything else is "other out".
const WITHDRAW_REASONS = [
    { key: STOCK_REASONS.WASTE, label: 'ของเสีย / ทิ้ง' },
    { key: STOCK_REASONS.STAFF_MEAL, label: 'พนักงานกิน' },
    { key: STOCK_REASONS.ADJUST, label: 'อื่น ๆ' }
];

export default function AdjustmentModal({ item, currentUser, onClose, onUpdate, onEdit }) {
    const [amount, setAmount] = useState(''); // Main input (usually integer)
    const [mode, setMode] = useState('in'); // 'in', 'out', 'set' (Check/Count)
    const [outReason, setOutReason] = useState(null); // required for 'out'
    const [outNote, setOutNote] = useState('');
    const [selectedUnit, setSelectedUnit] = useState(null);
    const [unitOptions, setUnitOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const savingRef = useRef(false); // Sync lock to prevent double-click
    const countInPieces = useRef(null); // a crate of bottles is counted in bottles
    const reduceMotion = useReducedMotion();
    
    // Liquid / Partial State (for Set/Count mode)
    const [showLiquidSlider, setShowLiquidSlider] = useState(false);
    const [partialAmount, setPartialAmount] = useState(0); // 0.0 - 0.99
    const [useMlCalculator, setUseMlCalculator] = useState(false);
    const [fullCapacityMl, setFullCapacityMl] = useState(750); // Default 750ml standard
    const [remainingMl, setRemainingMl] = useState(0);

    useEffect(() => {
        if (item) {
            // Is this a liquid/estimate item or ANY item we want to allow partial counting for?
            // Now including bags, kg, g for split counting (1 full + 1 open)
            const unitLower = item.unit.toLowerCase();
            const isLiquid = item.category === 'sauce' || item.category === 'spirits' || 
                           unitLower.includes('bottle') || unitLower.includes('l') || unitLower.includes('ขวด') ||
                           unitLower.includes('bag') || unitLower.includes('ถุง') || unitLower.includes('kg') || unitLower.includes('g');
            
            setShowLiquidSlider(isLiquid);
            
            // Load capacity if exists
            // Full bottle size from the item's recipe unit setting (e.g. 700 ml); 750 ml if unknown
            const cap = fullUnitCapacity(item);
            if (cap && cap.unit === 'ml') setFullCapacityMl(cap.amount);
            
            let options = [];
            // Add Base Unit (Purchase/Pack Unit)
            options.push({
                key: 'base',
                label: displayUnit(item.unit) || 'หน่วย',
                factor: 1
            });

            // Add Usage Unit (Recipe Unit) if different
            if (item.usage_unit && item.usage_unit !== item.unit) {
                options.push({
                    key: 'usage',
                    label: displayUnit(item.usage_unit),
                    // Same rule as recipe deduction: a soda bottle holds 325 ml, not 1 ml
                    factor: 1 / (usagePerStockUnit(item) || 1)
                });
            }

            // Add configured multi-units (e.g., Boxes, Packs)
            if (item.unit_config) {
                Object.entries(item.unit_config).forEach(([key, config]) => {
                    options.push({
                        key: key,
                        label: config.unit_label || key,
                        factor: Number(config.factor) || 1
                    });
                });
            }

            setUnitOptions(options);
            setSelectedUnit(options[0]);
            // Only things inside that are counted one by one (bottles of a crate, cups of a pack).
            // A piece of galangal holding 100 g keeps its "opened one" switch.
            const inside = packCapacity(item);
            const piecesInside = !!inside && (getUnitType(inside.unit) === 'count' || ['แก้ว', 'ชิ้น', 'ใบ', 'อัน'].includes(inside.unit));
            countInPieces.current = piecesInside ? options.find(o => o.key === 'usage') || null : null;
            setAmount('');
            setPartialAmount(0);
            
            // Default mode to 'in'
            setMode('in');
            setOutReason(null);
            setOutNote('');
        }
    }, [item]);

    // Calculator Logic
    useEffect(() => {
        if (useMlCalculator && fullCapacityMl > 0) {
            const ratio = remainingMl / fullCapacityMl;
            const clamped = Math.min(Math.max(ratio, 0), 1);
            setPartialAmount(clamped);
        }
    }, [remainingMl, fullCapacityMl, useMlCalculator]);

    // Pre-fill when entering Set mode, in the unit picked. A crate of bottles is counted in
    // bottles (17), never as "1 crate + 42% of one", so the opened part only exists for the
    // counting unit itself.
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

    const handleSave = async () => {
        if (savingRef.current) return; // Sync lock: prevents double-click
        savingRef.current = true;
        setLoading(true);
        try {

            const mainVal = parseFloat(amount || 0); // Integer part
            
            if (mode === 'set') {
                // Counted in another unit (bottles of a crate): that count is the whole amount.
                // Counted in the counting unit: whole units plus the opened one, kept exact
                // (rounding it to a percent turned 17 bottles into 17.04 on an untouched save).
                const opened = selectedUnit.factor !== 1 ? 0 : partialAmount;
                const finalTotal = Number((mainVal * selectedUnit.factor + opened).toFixed(4));

                await onUpdate(item.id, finalTotal, 'set', {
                    note: `นับสต็อกได้: ${qtyInWords(item, finalTotal, packCapacity(item))}`
                });

            } else {
                // In / Out
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
                const extra = outNote.trim() ? ` · ${outNote.trim()}` : '';

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
            toast.error('Failed to update stock');
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
    // An opened bottle is guessed by eye; a crate of bottles is counted in bottles only, so
    // the loose bottles of an opened crate can never be dropped by counting "1 ลัง"
    const countsOpened = selectedUnit?.factor === 1 && !countInPieces.current;
    const shownUnits = mode === 'set' && countInPieces.current ? unitOptions.filter(o => o.key !== 'base') : unitOptions;
    const disabled = loading || (mode !== 'set' && (!amount || parseFloat(amount) <= 0)) || (mode === 'out' && !outReason);
    const confirmLabel = loading ? 'กำลังบันทึก…' : mode === 'set' ? 'บันทึกการนับ' : mode === 'in' ? 'ยืนยันรับเข้า' : 'ยืนยันเบิกออก';

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
                className={`flex-1 min-w-0 h-12 rounded-md border ${ui.RULE} ${ui.PAPER} text-center text-2xl font-semibold tabular-nums ${ui.INK} outline-none transition-colors focus:border-[var(--color-ink)]`}
            />
            <button type="button" onClick={() => quickAdd(1)} className={ui.stepBtn} aria-label="เพิ่ม 1">+</button>
        </div>
    );

    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-[oklch(21.78%_0_0/0.45)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.18 } }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <motion.div
                {...ui.sheetMotion(reduceMotion)}
                role="dialog"
                aria-modal="true"
                aria-label={`ปรับสต๊อก ${item.name}`}
                className={`${ui.PAPER} w-full sm:max-w-sm border ${ui.RULE} rounded-t-xl sm:rounded-lg shadow-[0_12px_32px_oklch(21.78%_0_0/0.14)] flex flex-col max-h-[92vh] overflow-hidden`}
            >
                {/* Header: photo, name, what is in stock now */}
                <div className="px-4 pt-4 pb-3 flex items-start gap-3">
                    <div className={`w-14 h-14 rounded-md overflow-hidden border ${ui.RULE} ${ui.PAPER2} shrink-0`}>
                        {item.image_url
                            ? <img src={item.image_url} alt="" className="w-full h-full object-cover" />
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

                {/* Mode switch with a sliding pill */}
                <div className="px-4">
                    <div className={`relative grid grid-cols-3 p-1 rounded-md ${ui.PAPER2}`} role="tablist" aria-label="ประเภทการปรับสต๊อก">
                        {MODES.map(m => (
                            <button
                                key={m.id}
                                type="button"
                                role="tab"
                                aria-selected={mode === m.id}
                                onClick={() => { if (m.id === 'set' && countInPieces.current) setSelectedUnit(countInPieces.current); setMode(m.id); }}
                                className={`relative h-9 rounded text-sm transition-colors ${mode === m.id ? `${ui.INK} font-semibold` : `${ui.NEUTRAL} hover:text-[var(--color-ink)]`}`}
                            >
                                {mode === m.id && (
                                    <motion.span
                                        layoutId="adjust-mode-pill"
                                        className={`absolute inset-0 rounded ${ui.PAPER} shadow-[0_1px_2px_oklch(21.78%_0_0/0.12)]`}
                                        transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: ui.EASE }}
                                    />
                                )}
                                <span className="relative">{m.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Body */}
                <div className="px-4 py-4 flex-1 overflow-y-auto space-y-4">
                    {/* Unit */}
                    {shownUnits.length > 1 && (
                        <div>
                            <span className={ui.label}>หน่วย</span>
                            <div className="flex flex-wrap gap-1.5">
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

                                {/* Opened container: only when counting in the counting unit */}
                                {countsOpened && <div className={`rounded-md border ${ui.RULE} p-3 space-y-3`}>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={`text-sm ${ui.INK}`}>มีของที่เปิดใช้อยู่</span>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={partialAmount > 0}
                                            onClick={() => setPartialAmount(partialAmount > 0 ? 0 : 0.5)}
                                            className={`relative w-11 h-6 rounded-full transition-colors ${partialAmount > 0 ? 'bg-[var(--color-ink)]' : 'bg-[var(--color-rule)]'}`}
                                        >
                                            <motion.span
                                                className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-[var(--color-paper)]"
                                                animate={{ x: partialAmount > 0 ? 20 : 0 }}
                                                transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: ui.EASE }}
                                            />
                                        </button>
                                    </div>
                                    <AnimatePresence initial={false}>
                                        {partialAmount > 0 && (
                                            <motion.div
                                                key="opened"
                                                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto', transition: { duration: 0.2, ease: ui.EASE } }}
                                                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, transition: { duration: 0.14 } }}
                                                className="overflow-hidden"
                                            >
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
                                                            <button type="button" onClick={() => setUseMlCalculator(false)} className={`text-xs ${ui.MUTED} underline underline-offset-2`}>กะด้วยสายตา</button>
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
                                                        <button type="button" onClick={() => { setUseMlCalculator(true); setRemainingMl(0); }} className={`text-xs ${ui.MUTED} underline underline-offset-2`}>
                                                            คำนวณจาก มล.
                                                        </button>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>}

                                {/* Summary */}
                                <div className={`rounded-md ${ui.PAPER2} px-3 py-2.5`}>
                                    <div className={`text-xs ${ui.NEUTRAL}`}>จะบันทึกว่า</div>
                                    <div className={`text-sm font-semibold tabular-nums ${ui.INK}`}>
                                        {amount || 0} {selectedUnit?.label || displayUnit(item.unit)}
                                        {countsOpened && partialAmount > 0 && ` + ที่เปิดอยู่ ${Math.round(partialAmount * 100)}%`}
                                    </div>
                                    <div className={`text-xs ${ui.NEUTRAL}`}>
                                        โดย {currentUser?.user_metadata?.full_name || 'พนักงาน'} · {new Date().toLocaleString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
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
                                        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="เหตุผลการเบิกออก">
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
                </div>

                {/* Footer */}
                <div className={`px-4 py-3 border-t ${ui.RULE} pb-[max(0.75rem,env(safe-area-inset-bottom))]`}>
                    <button type="button" onClick={handleSave} disabled={disabled} className={ui.primaryBtn}>
                        {confirmLabel}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
