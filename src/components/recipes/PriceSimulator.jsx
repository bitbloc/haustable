/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState } from 'react';
import { calculateSuggestedPrice } from '../../utils/costUtils';
import { ChevronUp, ChevronDown } from 'lucide-react';

export default function PriceSimulator({ totalCost, price, onPriceChange, initialPrice = 0, targetPct = 30, compact = false }) {
    const [localPrice, setLocalPrice] = useState(initialPrice);
    const [targetPercent, setTargetPercent] = useState(targetPct);
    const [isExpanded, setIsExpanded] = useState(!compact);
    
    // Use controlled price if provided, otherwise local
    const sellingPrice = price !== undefined ? price : localPrice;

    // Suggested price based on target food cost %
    const suggestedPrice = calculateSuggestedPrice(totalCost, targetPercent);
    const roundedSuggested = Math.ceil(suggestedPrice / 5) * 5;

    const profit = sellingPrice - totalCost;
    const costPercent = sellingPrice > 0 ? (totalCost / sellingPrice) * 100 : 0;
    const hasPriceSet = sellingPrice > 0;

    const handleSetPrice = (val) => {
        const newPrice = typeof val === 'string' ? (val === '' ? 0 : parseFloat(val)) : val;
        if (onPriceChange) {
            onPriceChange(newPrice);
        } else {
            setLocalPrice(newPrice);
        }
    };

    // Quick price rounding options: nearest 5, 10, 50
    const quickPrices = [
        { label: `฿${roundedSuggested}`, value: roundedSuggested, sub: 'แนะนำ' },
        { label: `฿${Math.ceil(suggestedPrice / 10) * 10}`, value: Math.ceil(suggestedPrice / 10) * 10, sub: 'ปัด 10' },
        { label: `฿${Math.ceil(suggestedPrice / 50) * 50}`, value: Math.ceil(suggestedPrice / 50) * 50, sub: 'ปัด 50' },
    ].filter((v, i, a) => a.findIndex(x => x.value === v.value) === i);

    return (
        <div className="bg-white border-t border-[oklch(85%_0.012_28)] overflow-hidden font-sans">
            {/* Header Bar — Clickable toggle */}
            <button 
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-3 bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] flex justify-between items-center gap-2 hover:bg-[oklch(90%_0.012_28)] transition-colors cursor-pointer select-none font-mono text-xs"
            >
                <div className="flex items-center gap-2">
                    <span className="font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] text-[10px]">
                        [PRICE SIMULATOR]
                    </span>
                    <span className="font-bold text-[oklch(18%_0.012_28)] text-xs">
                        จำลองราคาขาย & กำไรขั้นต้น (GP Model)
                    </span>
                </div>
                
                <div className="flex items-center gap-2">
                    {hasPriceSet && (
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                            <span className={`px-1.5 py-0.2 font-bold ${
                                profit > 0 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : 'bg-red-100 text-red-800'
                            }`}>
                                กำไร ฿{profit.toFixed(0)}
                            </span>
                            <span className={`px-1.5 py-0.2 font-bold ${
                                costPercent <= 30 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : costPercent <= 35 
                                        ? 'bg-[oklch(90%_0.015_28)] text-[oklch(18%_0.012_28)]' 
                                        : 'bg-amber-100 text-amber-800'
                            }`}>
                                ต้นทุน {costPercent.toFixed(1)}%
                            </span>
                        </div>
                    )}
                    <span className="text-[oklch(55%_0.010_28)] font-bold text-[10px]">
                        {isExpanded ? '[ย่อ ▲]' : '[ขยาย ▼]'}
                    </span>
                </div>
            </button>

            {/* Collapsible Body */}
            {isExpanded && (
                <div className="p-4 bg-[oklch(98%_0.004_28)] border-t border-[oklch(85%_0.012_28)] space-y-4 font-mono">
                    
                    {/* 1. Dynamic Slider (Target Food Cost %) */}
                    <div className="bg-white p-3 border border-[oklch(85%_0.012_28)] rounded-xs space-y-2">
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-[oklch(42%_0.010_28)] uppercase tracking-wider text-[11px]">
                                TARGET FOOD COST (เป้าหมายสัดส่วนต้นทุน)
                            </span>
                            <span className="font-bold text-[oklch(52%_0.16_28)] text-sm">
                                {targetPercent}%
                            </span>
                        </div>
                        
                        <div className="py-1">
                            <input 
                                type="range" 
                                min="15" 
                                max="50" 
                                step="1"
                                value={targetPercent}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setTargetPercent(val === '' ? 0 : parseFloat(val));
                                }}
                                className="w-full accent-[oklch(52%_0.16_28)] h-1.5 bg-[oklch(90%_0.012_28)] rounded-none appearance-none cursor-pointer"
                            />
                        </div>

                        {/* Suggested price quick-set buttons */}
                        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-[oklch(90%_0.008_28)] text-xs">
                            <span className="text-[10px] text-[oklch(55%_0.010_28)]">
                                ราคาแนะนำตามเป้าหมาย:
                            </span>
                            <div className="flex gap-1.5">
                                {totalCost > 0 && quickPrices.map((qp, idx) => (
                                    <button
                                        type="button"
                                        key={idx}
                                        onClick={() => handleSetPrice(qp.value)}
                                        className={`px-2 py-0.5 border text-xs font-bold transition-colors cursor-pointer ${
                                            sellingPrice === qp.value 
                                                ? 'bg-[oklch(18%_0.012_28)] text-white border-black' 
                                                : 'bg-white border-[oklch(85%_0.012_28)] text-[oklch(42%_0.010_28)] hover:border-black'
                                        }`}
                                    >
                                        {qp.label} <span className="text-[9px] opacity-70">({qp.sub})</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 2. Manual Selling Price Input & Financial Metrics Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Selling Price Input */}
                        <div className="border border-[oklch(85%_0.012_28)] bg-white p-3 rounded-xs">
                            <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase tracking-wider mb-1">
                                ราคาขายจริง (SELLING PRICE)
                            </label>
                            <div className="flex items-center">
                                <span className="text-sm font-bold text-[oklch(42%_0.010_28)] mr-1">฿</span>
                                <input 
                                    type="number"
                                    inputMode="numeric"
                                    className="w-full text-base font-bold text-[oklch(18%_0.012_28)] bg-transparent outline-none tabular-nums"
                                    value={sellingPrice || ''}
                                    placeholder="0"
                                    onChange={(e) => handleSetPrice(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Profit per Item */}
                        <div className={`border p-3 rounded-xs ${
                            profit > 0 
                                ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900' 
                                : 'border-red-200 bg-red-50/60 text-red-900'
                        }`}>
                            <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                                กำไรต่อจาน (GROSS PROFIT)
                            </div>
                            <div className="text-base font-bold tabular-nums mt-1">
                                {hasPriceSet ? `฿${profit.toFixed(2)}` : '—'}
                            </div>
                        </div>

                        {/* Food Cost % */}
                        <div className={`border p-3 rounded-xs ${
                            costPercent <= 30 
                                ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900' 
                                : costPercent <= 35 
                                    ? 'border-[oklch(85%_0.012_28)] bg-white text-[oklch(18%_0.012_28)]' 
                                    : 'border-amber-200 bg-amber-50/60 text-amber-900'
                        }`}>
                            <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                                สัดส่วนต้นทุน (FOOD COST %)
                            </div>
                            <div className="text-base font-bold tabular-nums mt-1">
                                {hasPriceSet ? `${costPercent.toFixed(1)}%` : '—'}
                            </div>
                        </div>
                    </div>

                    {/* 3. Cost Breakdown Visual Bar */}
                    {hasPriceSet && (
                        <div className="space-y-1 text-xs">
                            <div className="flex justify-between text-[10px] text-[oklch(55%_0.010_28)]">
                                <span>ต้นทุน: ฿{totalCost.toFixed(2)}</span>
                                <span>ราคาขาย: ฿{sellingPrice}</span>
                            </div>
                            <div className="w-full h-2 bg-[oklch(90%_0.012_28)] overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-300 ${
                                        costPercent <= 30 
                                            ? 'bg-emerald-600' 
                                            : costPercent <= 35 
                                                ? 'bg-[oklch(52%_0.16_28)]' 
                                                : 'bg-amber-600'
                                    }`}
                                    style={{ width: `${Math.min(costPercent, 100)}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
