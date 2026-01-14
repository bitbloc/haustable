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
            // Add Base Unit
            options.push({
                key: 'base',
                label: item.unit,
                factor: 1
            });

            // Add configured units
            if (item.unit_config) {
                Object.entries(item.unit_config).forEach(([key, config]) => {
                    options.push({
                        key: key,
                        label: config.unit_label || key,
                        factor: config.factor
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
                if (selectedUnit.factor > 1) {
                     // MainVal is Multi-unit (e.g. 5 Boxes)
                     // Partial is Base Unit (e.g. 0.5 Bottle)
                     const qtyFromFull = mainVal * selectedUnit.factor;
                     
                     // We just add them. But we need to be careful of floats.
                     // 12 + 0.5 = 12.5
                     finalTotal = qtyFromFull + partialAmount;
                     
                     // Use fix to 4 digits
                     finalTotal = Number(finalTotal.toFixed(4));
                } else {
                     // Base Unit
                     // Use utility for safe float math
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="relative h-40 bg-gray-100 flex items-center justify-center shrink-0">
                    {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                        <Package className="w-16 h-16 text-gray-300" />
                    )}
                    
                    <div className="absolute top-4 right-4 z-10 flex gap-2">
                     <button onClick={onEdit} className="w-10 h-10 bg-black/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/40"><Settings className="w-5 h-5" /></button>
                     <button onClick={onClose} className="w-10 h-10 bg-black/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/40"><X className="w-6 h-6" /></button>
                    </div>
                    
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-10">
                        <h2 className="text-white text-xl font-bold leading-tight truncate">{item.name}</h2>
                        <div className="text-white/80 text-sm font-medium">
                            {formatStockDisplay(item.current_quantity, item.unit).displayString}
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-5 flex-1 overflow-y-auto">
                    
                    {/* Mode Tabs */}
                    <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
                        <button onClick={() => setMode('in')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'in' ? 'bg-white shadow text-green-600' : 'text-gray-400'}`}>+ รับเข้า</button>
                        <button onClick={() => setMode('out')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'out' ? 'bg-white shadow text-red-600' : 'text-gray-400'}`}>- เบิกออก</button>
                        <button onClick={() => setMode('set')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'set' ? 'bg-[#1A1A1A] shadow text-white' : 'text-gray-400'}`}>📝 ปริมาณคงเหลือ</button>
                    </div>

                    {/* Unit Selector */}
                    <div className="mb-4">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">หน่วยนับ</label>
                        <div className="grid grid-cols-2 gap-2">
                            {unitOptions.map((opt) => (
                                <button
                                    key={opt.key}
                                    onClick={() => setSelectedUnit(opt)}
                                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-left flex justify-between items-center ${selectedUnit?.key === opt.key ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white' : 'border-gray-200 text-gray-600'}`}
                                >
                                    <span>{opt.label}</span>
                                    {opt.factor !== 1 && <span className="opacity-60">x{opt.factor}</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* --- COUNT MODE (Quantity Remaining) --- */}
                    {mode === 'set' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                            
                            {/* 1. Unopened Section */}
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                                    จำนวนที่ยังไม่เปิด
                                </label>
                                <div className="flex gap-3">
                                    <button onClick={() => { const val = parseFloat(amount || 0); if (val > 0) setAmount((val - 1).toString()); }} className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50"><Minus className="w-5 h-5 text-gray-400" /></button>
                                    <input 
                                        type="number" 
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0"
                                        className="flex-1 h-12 bg-gray-50 rounded-xl text-center text-2xl font-bold text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#1A1A1A]"
                                    />
                                    <button onClick={() => quickAdd(1)} className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50"><Plus className="w-5 h-5 text-[#1A1A1A]" /></button>
                                </div>
                            </div>

                            {/* 2. Opened Section */}
                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                        จำนวนที่เปิดแล้ว (เศษ)
                                    </label>
                                    
                                    {/* Toggle Opened Item Checkbox/Counter */}
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => {
                                                if (partialAmount > 0) {
                                                    setPartialAmount(0);
                                                } else {
                                                    setPartialAmount(0.5); // Default to 50% if turned on
                                                }
                                            }}
                                            className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${partialAmount > 0 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-400 border-gray-200'}`}
                                        >
                                            {partialAmount > 0 ? 'มีของเปิดอยู่' : 'ไม่มีของเปิดอยู่'}
                                        </button>
                                    </div>
                                </div>

                                {partialAmount > 0 && (
                                    <div className="animate-in fade-in slide-in-from-top-2">
                                        <div className="p-3 bg-white rounded-xl border border-blue-100 mb-2">
                                            <h4 className="text-xs font-bold text-blue-800 mb-2 flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                เหลืออยู่กี่ %
                                            </h4>
                                            
                                            {useMlCalculator ? (
                                                <div className="space-y-3">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-[10px] text-gray-500 mb-1 block">ปริมาตรเต็ม (ml)</label>
                                                            <input type="number" value={fullCapacityMl} onChange={e => setFullCapacityMl(parseFloat(e.target.value))} className="w-full p-2 rounded-lg border border-gray-200 text-sm font-bold" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] text-gray-500 mb-1 block">คงเหลือ (ml)</label>
                                                            <input type="number" value={remainingMl} onChange={e => setRemainingMl(parseFloat(e.target.value))} className="w-full p-2 rounded-lg border border-blue-200 bg-white text-sm font-bold text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none" autoFocus />
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs font-bold text-blue-800 pt-1">
                                                        <span>= {(partialAmount * 100).toFixed(0)}%</span>
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
                                                        <div className="text-xs text-blue-800">
                                                            <div className="font-bold text-lg">{Math.round(partialAmount * 100)}%</div>
                                                            <div className="opacity-70 leading-tight">ประมาณด้วยสายตา</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right mt-1 flex justify-end gap-2">
                                                         <button onClick={() => { setUseMlCalculator(true); setRemainingMl(0); }} className="text-[10px] font-bold text-blue-600 flex items-center gap-1 justify-end hover:bg-blue-100 px-2 py-1 rounded transition-colors">
                                                             <Calculator className="w-3 h-3" /> คำนวณ ml
                                                         </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Summary Section */}
                            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <span className="w-1 h-1 rounded-full bg-black"></span>
                                    สรุปรายการ
                                </h4>
                                <div className="space-y-1">
                                    <div className="text-sm font-bold text-[#1A1A1A]">
                                        {amount || 0} {item.unit} (ยังไม่เปิด) 
                                        {partialAmount > 0 && ` + 1 ${item.unit} (เปิดแล้ว ${Math.round(partialAmount * 100)}%)`}
                                    </div>
                                    <div className="text-xs text-gray-500 font-medium flex items-center gap-1">
                                        ผู้บันทึก: <span className="text-[#1A1A1A]">{currentUser?.user_metadata?.full_name || 'Staff'}</span>
                                        <span className="opacity-50">
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
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                                จำนวน
                            </label>
                            <div className="flex gap-3">
                                <button onClick={() => { const val = parseFloat(amount || 0); if (val > 0) setAmount((val - 1).toString()); }} className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50"><Minus className="w-5 h-5 text-gray-400" /></button>
                                <input 
                                    type="number" 
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0"
                                    className="flex-1 h-12 bg-gray-50 rounded-xl text-center text-2xl font-bold text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#1A1A1A]"
                                />
                                <button onClick={() => quickAdd(1)} className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50"><Plus className="w-5 h-5 text-[#1A1A1A]" /></button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 safe-area-inset-bottom">
                    <button 
                        onClick={handleSave}
                        disabled={loading || (mode !== 'set' && (!amount || parseFloat(amount) <= 0))}
                        className={`w-full py-3.5 rounded-xl flex items-center justify-center gap-2 text-white font-bold text-base shadow-lg transition-all active:scale-95 ${
                            loading ? 'bg-gray-400' : 
                            mode === 'in' ? 'bg-green-600 hover:bg-green-700' : 
                            mode === 'out' ? 'bg-red-600 hover:bg-red-700' :
                            'bg-[#1A1A1A] hover:bg-gray-900' // Set mode
                        }`}
                    >
                        {loading ? 'กำลังบันทึก...' : (
                            <>
                                <Save className="w-5 h-5" />
                                {mode === 'set' ? 'บันทึกการนับ' : `ยืนยัน ${mode === 'in' ? 'รับเข้า' : 'เบิกออก'}`}
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}
