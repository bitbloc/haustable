import React, { useState, useEffect } from 'react';
import { X, Minus, Plus, Save, Package, Settings, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import LiquidLevelSlider from './LiquidLevelSlider';
import { formatStockDisplay, calculateTotalFromComponents } from '../../utils/stockUtils';

export default function AdjustmentModal({ item, currentUser, onClose, onUpdate, onEdit }) {
    const [amount, setAmount] = useState(''); // Main input (usually integer)
    const [mode, setMode] = useState('in'); // 'in', 'out', 'set' (Check/Count)
    const [selectedUnit, setSelectedUnit] = useState(null);
    const [unitOptions, setUnitOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    
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
            if (item.capacity_per_unit) {
                setFullCapacityMl(item.capacity_per_unit);
            }
            
            let options = [];
            // Add Base Unit (Purchase/Pack Unit)
            options.push({
                key: 'base',
                label: item.unit || 'unit',
                factor: 1
            });

            // Add Usage Unit (Recipe Unit) if different
            if (item.usage_unit && item.usage_unit !== item.unit) {
                options.push({
                    key: 'usage',
                    label: item.usage_unit,
                    factor: 1 / (Number(item.conversion_factor) || 1)
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
            setAmount('');
            setPartialAmount(0);
            
            // Default mode to 'in'
            setMode('in');
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

    // Pre-fill when entering Set mode
    useEffect(() => {
        if (mode === 'set' && item) {
             // Use utility to safely split Integer / Part (percentage)
            const { fullUnits, remainder, percent } = formatStockDisplay(item.current_quantity);
            
            setAmount(fullUnits.toString());
            setPartialAmount(remainder); // 0.something
            
            if (fullCapacityMl) {
                setRemainingMl(Math.round(remainder * fullCapacityMl));
            }
        } else {
            // Should we clear for In/Out? Yes, standard behavior.
            setAmount('');
            setPartialAmount(0);
        }
    }, [mode, item]);

    const handleSave = async () => {
        setLoading(true);
        try {
            // Save Capacity if changed and using calculator
            if (mode === 'set' && useMlCalculator && fullCapacityMl !== item.capacity_per_unit) {
                // Background update capacity
                await import('../../lib/supabaseClient').then(({ supabase }) => 
                    supabase.from('stock_items').update({ capacity_per_unit: fullCapacityMl }).eq('id', item.id)
                );
            }

            const mainVal = parseFloat(amount || 0); // Integer part
            
            if (mode === 'set') {
                // Set Absolute Quantity
                
                // Use safe calculation utility
                // Note: Component uses partialAmount as (0.9), but calculateTotalFromComponents expects (90) if used as second arg?
                // Wait, calculateTotalFromComponents takes (full, percent0-100).
                // My state partialAmount is 0.9.
                // So I should pass partialAmount * 100.
                
                const percent = Math.round(partialAmount * 100);
                const totalBaseQty = calculateTotalFromComponents(mainVal, percent);
                
                // Factor logic? If user selected a Factor Unit (e.g. Box = 12), then mainVal represents Boxes.
                // But partial is usually Base Unit. 
                // But wait, my UI shows partial as "Opened Bottle" (Base Unit).
                // If I have 1 Box and 0.5 Bottle.
                // 1 Box = 12 Bottles.
                // Total = 1 * 12 + 0.5 = 12.5.
                
                // Let's check logic:
                // If unit factor > 1 (e.g. Check by Box), 
                // then mainVal is Boxes.
                // partialAmount is usually "remainder of base unit" if the UI context means "Opened Bottle".
                // Yes "เศษที่เหลือ (เปิดใช้แล้ว)" implies base unit.
                
                // So: Total = (MainVal * Factor) + Remainder(Base)
                
                // However, calculateTotalFromComponents is designed for: X.Y where X is integer of Base.
                // If I am counting Boxes, I should convert Boxes to Base first.
                
                let finalTotal = 0;
                if (selectedUnit.factor !== 1) {
                     // MainVal is Multi-unit or Usage-unit (e.g. 5 Boxes or 500 Glasses)
                     // Partial is Base Unit (e.g. 0.5 Bottle) - we assume partial is always base unit remainder
                     const qtyFromMain = mainVal * selectedUnit.factor;
                     finalTotal = qtyFromMain + partialAmount;
                     finalTotal = Number(finalTotal.toFixed(4));
                } else {
                     // Base Unit
                     finalTotal = calculateTotalFromComponents(mainVal, percent);
                }

                await onUpdate(item.id, finalTotal, 'set', {
                    note: `นับสต็อกได้: ${mainVal} ${selectedUnit.label} (เต็ม) ${partialAmount > 0 ? `+ เปิดแล้ว ${(partialAmount * 100).toFixed(0)}%` : ''}`
                });

            } else {
                // In / Out
                if (mainVal <= 0) {
                     setLoading(false);
                     return;
                }
                const actualChange = mainVal * selectedUnit.factor;
                const finalChange = mode === 'in' ? actualChange : -actualChange;
                
                await onUpdate(item.id, finalChange, mode, {
                    note: `ปรับปรุงรายการ: ${mode === 'in' ? 'รับเข้า' : 'เบิกออก'} ${mainVal} ${selectedUnit.label}`
                });
            }
            
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Failed to update stock');
        } finally {
            setLoading(false);
        }
    };

    const quickAdd = (val) => {
        const current = amount ? parseFloat(amount) : 0;
        setAmount((current + val).toString());
    };

    if (!item) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white w-full max-w-sm rounded-xl overflow-hidden border border-[var(--color-hallmark-rule)] shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150 ease-out">
                
                {/* Header */}
                <div className="relative h-36 bg-gray-100 flex items-center justify-center shrink-0 border-b border-[var(--color-hallmark-rule)]/50">
                    {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                        <Package className="w-12 h-12 text-gray-300" />
                    )}
                    
                    <div className="absolute top-3 right-3 z-10 flex gap-1.5">
                     <button onClick={onEdit} className="w-8.5 h-8.5 bg-black/35 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/50 active:scale-90 transition-all"><Settings className="w-4.5 h-4.5" /></button>
                     <button onClick={onClose} className="w-8.5 h-8.5 bg-black/35 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/50 active:scale-90 transition-all"><X className="w-5 h-5" /></button>
                    </div>
                    
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 to-transparent p-4 pt-12">
                        <h2 className="text-white text-lg font-bold leading-tight truncate">{item.name}</h2>
                        <div className="text-white/80 text-xs font-medium font-mono mt-0.5">
                            {formatStockDisplay(item.current_quantity, item.unit).displayString}
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-4 flex-1 overflow-y-auto">
                    
                    {/* Mode Tabs */}
                    <div className="flex bg-gray-100 p-0.5 rounded-lg border border-[var(--color-hallmark-rule)]/50 mb-4 shadow-inner">
                        <button onClick={() => setMode('in')} className={`flex-1 py-1.5 rounded text-xs font-bold transition-all ${mode === 'in' ? 'bg-white shadow text-green-700' : 'text-gray-400 hover:text-gray-600'}`}>+ รับเข้า</button>
                        <button onClick={() => setMode('out')} className={`flex-1 py-1.5 rounded text-xs font-bold transition-all ${mode === 'out' ? 'bg-white shadow text-red-700' : 'text-gray-400 hover:text-gray-600'}`}>- เบิกออก</button>
                        <button onClick={() => setMode('set')} className={`flex-1 py-1.5 rounded text-xs font-bold transition-all ${mode === 'set' ? 'bg-[#1A1A1A] shadow text-white' : 'text-gray-400 hover:text-gray-600'}`}>📝 ตรวจนับ</button>
                    </div>

                    {/* Unit Selector */}
                    <div className="mb-4">
                        <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">หน่วยนับ</label>
                        <div className="grid grid-cols-2 gap-1.5">
                            {unitOptions.map((opt) => (
                                <button
                                    key={opt.key}
                                    onClick={() => setSelectedUnit(opt)}
                                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all text-center ${selectedUnit?.key === opt.key ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white shadow-sm' : 'border-[var(--color-hallmark-rule)] text-gray-600 hover:bg-gray-50'}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* --- COUNT MODE (Quantity Remaining) --- */}
                    {mode === 'set' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
                            
                            {/* 1. Unopened Section */}
                            <div>
                                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                                    จำนวนที่ยังไม่เปิด
                                </label>
                                <div className="flex gap-2">
                                    <button onClick={() => { const val = parseFloat(amount || 0); if (val > 0) setAmount((val - 1).toString()); }} className="w-10 h-10 rounded-lg border border-[var(--color-hallmark-rule)] flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"><Minus className="w-4 h-4 text-gray-500" /></button>
                                    <input 
                                        type="number" 
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0"
                                        className="flex-1 h-10 bg-gray-50/80 border border-[var(--color-hallmark-rule)] rounded-lg text-center text-xl font-mono font-bold text-[#1A1A1A] outline-none focus:border-[#1A1A1A] focus:ring-1 focus:ring-[#1A1A1A] transition-all"
                                    />
                                    <button onClick={() => quickAdd(1)} className="w-10 h-10 rounded-lg border border-[var(--color-hallmark-rule)] flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"><Plus className="w-4 h-4 text-gray-700" /></button>
                                </div>
                            </div>

                            {/* 2. Opened Section */}
                            <div className="p-3 bg-gray-50/50 rounded-xl border border-[var(--color-hallmark-rule)]/60">
                                <div className="flex items-center justify-between mb-2.5">
                                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                                        จำนวนที่เปิดแล้ว (เศษ)
                                    </label>
                                    
                                    {/* Toggle Opened Item Checkbox/Counter */}
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => {
                                                if (partialAmount > 0) {
                                                    setPartialAmount(0);
                                                } else {
                                                    setPartialAmount(0.5);
                                                }
                                            }}
                                            className={`px-2.5 py-0.5 rounded border text-[10px] font-bold transition-all shadow-sm ${partialAmount > 0 ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'bg-white text-gray-400 border-[var(--color-hallmark-rule)] hover:bg-gray-50'}`}
                                        >
                                            {partialAmount > 0 ? 'มีของเปิดอยู่' : 'ไม่มีของเปิดอยู่'}
                                        </button>
                                    </div>
                                </div>

                                {partialAmount > 0 && (
                                    <div className="animate-in fade-in slide-in-from-top-2 duration-150">
                                        <div className="p-3 bg-white rounded-lg border border-[var(--color-hallmark-rule)]/80 mb-1.5 shadow-sm">
                                            <h4 className="text-[10px] font-bold text-gray-500 mb-2 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                เหลืออยู่กี่ %
                                            </h4>
                                            
                                            {useMlCalculator ? (
                                                <div className="space-y-2">
                                                    <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <label className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 block">ปริมาตรเต็ม (ml)</label>
                                                                <input 
                                                                    type="number" 
                                                                    value={fullCapacityMl || ''} 
                                                                    onChange={e => {
                                                                        const val = e.target.value;
                                                                        setFullCapacityMl(val === '' ? 0 : parseFloat(val));
                                                                    }} 
                                                                    className="w-full p-2 bg-gray-50/50 border border-[var(--color-hallmark-rule)] rounded-lg text-xs font-bold font-mono focus:outline-none focus:border-[#1A1A1A]" 
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 block">คงเหลือ (ml)</label>
                                                                <input 
                                                                    type="number" 
                                                                    value={remainingMl || ''} 
                                                                    onChange={e => {
                                                                        const val = e.target.value;
                                                                        setRemainingMl(val === '' ? 0 : parseFloat(val));
                                                                    }} 
                                                                    className="w-full p-2 bg-gray-50/50 border border-blue-200 text-blue-600 rounded-lg text-xs font-bold font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                                                                    autoFocus 
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between items-center text-[10px] font-bold text-blue-800 pt-1">
                                                            <span className="font-mono">= {((partialAmount || 0) * 100).toFixed(0)}%</span>
                                                            <button onClick={() => setUseMlCalculator(false)} className="text-gray-400 underline decoration-dotted">ใช้แบบเลื่อน</button>
                                                        </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex gap-4 items-center">
                                                        <LiquidLevelSlider 
                                                            value={Math.round(partialAmount * 100)} 
                                                            onChange={(val) => setPartialAmount(val / 100)} 
                                                        />
                                                        <div className="text-[10px] text-gray-500">
                                                            <div className="font-bold text-base text-[#1A1A1A] font-mono">{Math.round(partialAmount * 100)}%</div>
                                                            <div className="opacity-70 leading-tight">ประมาณสายตา</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right mt-1.5 flex justify-end">
                                                         <button onClick={() => { setUseMlCalculator(true); setRemainingMl(0); }} className="text-[9px] font-bold text-blue-600 flex items-center gap-1 justify-end hover:bg-blue-50 px-2 py-0.5 rounded transition-colors border border-blue-100 bg-blue-50/30">
                                                             <Calculator className="w-2.5 h-2.5" /> คำนวณ ml
                                                         </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Summary Section */}
                            <div className="bg-white rounded-lg border border-[var(--color-hallmark-rule)] p-3 shadow-sm">
                                <h4 className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <span className="w-1 h-1 rounded-full bg-[#1A1A1A]"></span>
                                    สรุปรายการตรวจนับ
                                </h4>
                                <div className="space-y-0.5">
                                    <div className="text-xs font-bold text-[#1A1A1A] font-mono">
                                        {amount || 0} {item.unit} (เต็ม) 
                                        {partialAmount > 0 && ` + 1 ${item.unit} (เศษ: ${(partialAmount * 100).toFixed(0)}%)`}
                                    </div>
                                    <div className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                                        ผู้บันทึก: <span className="text-[#1A1A1A] font-bold">{currentUser?.user_metadata?.full_name || 'Staff'}</span>
                                        <span className="opacity-50 font-mono">
                                            ({new Date().toLocaleString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })})
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Main Input for In/Out (Hidden in Set mode) */}
                    {mode !== 'set' && (
                        <div className="mb-2">
                            <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                                จำนวน
                            </label>
                            <div className="flex gap-2">
                                <button onClick={() => { const val = parseFloat(amount || 0); if (val > 0) setAmount((val - 1).toString()); }} className="w-10 h-10 rounded-lg border border-[var(--color-hallmark-rule)] flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"><Minus className="w-4 h-4 text-gray-500" /></button>
                                <input 
                                    type="number" 
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0"
                                    className="flex-1 h-10 bg-gray-50/80 border border-[var(--color-hallmark-rule)] rounded-lg text-center text-xl font-mono font-bold text-[#1A1A1A] outline-none focus:border-[#1A1A1A] focus:ring-1 focus:ring-[#1A1A1A] transition-all"
                                />
                                <button onClick={() => quickAdd(1)} className="w-10 h-10 rounded-lg border border-[var(--color-hallmark-rule)] flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"><Plus className="w-4 h-4 text-gray-700" /></button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-[var(--color-hallmark-rule)]/50 bg-gray-50/50 safe-area-inset-bottom">
                    <button 
                        onClick={handleSave}
                        disabled={loading || (mode !== 'set' && (!amount || parseFloat(amount) <= 0))}
                        className={`w-full py-2.5 rounded-lg flex items-center justify-center gap-1.5 text-white font-bold text-sm shadow-md transition-all active:scale-98 ${
                            loading ? 'bg-gray-400 cursor-not-allowed shadow-none' : 
                            mode === 'in' ? 'bg-green-600 hover:bg-green-700' : 
                            mode === 'out' ? 'bg-red-600 hover:bg-red-700' :
                            'bg-[#1A1A1A] hover:bg-black'
                        }`}
                    >
                        {loading ? 'กำลังบันทึก...' : (
                            <>
                                <Save className="w-4 h-4" />
                                {mode === 'set' ? 'บันทึกการนับ' : `ยืนยัน${mode === 'in' ? 'รับเข้า' : 'เบิกออก'}`}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
