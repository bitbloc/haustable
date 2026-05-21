import React, { useState, useEffect, useRef } from 'react';
import { calculateSuggestedPrice } from '../../utils/costUtils';
import { TrendingUp, Target, ChevronUp, ChevronDown } from 'lucide-react';

export default function PriceSimulator({ totalCost, price, onPriceChange, initialPrice = 0, targetPct = 30, compact = false }) {
    const [localPrice, setLocalPrice] = useState(initialPrice);
    const [targetPercent, setTargetPercent] = useState(targetPct);
    const hasAutoSet = useRef(false);
    const [isExpanded, setIsExpanded] = useState(!compact);
    
    // Use controlled price if provided, otherwise local
    const sellingPrice = price !== undefined ? price : localPrice;
    
    // Sync if prop changes (e.g. loaded from settings)
    useEffect(() => {
        if(targetPct) setTargetPercent(targetPct);
    }, [targetPct]);

    // Suggested price based on slider
    const suggestedPrice = calculateSuggestedPrice(totalCost, targetPercent);
    const roundedSuggested = Math.ceil(suggestedPrice / 5) * 5;

    // Auto-initialize selling price from suggested price when cost data first loads
    useEffect(() => {
        if (!hasAutoSet.current && totalCost > 0 && sellingPrice === 0 && suggestedPrice > 0) {
            if (onPriceChange) {
                onPriceChange(roundedSuggested);
            } else {
                setLocalPrice(roundedSuggested);
            }
            hasAutoSet.current = true;
        }
    }, [totalCost, suggestedPrice]);

    const profit = sellingPrice - totalCost;
    const costPercent = sellingPrice > 0 ? (totalCost / sellingPrice) * 100 : 0;
    const hasPriceSet = sellingPrice > 0;

    // Color helpers
    const profitColor = !hasPriceSet 
        ? 'bg-gray-50 text-gray-400' 
        : profit > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100';
    const costColor = !hasPriceSet 
        ? 'bg-gray-50 text-gray-400' 
        : costPercent <= 30 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
        : costPercent <= 35 ? 'bg-blue-50 text-blue-700 border border-blue-100' 
        : 'bg-orange-50 text-orange-700 border border-orange-100';

    const handleSetPrice = (val) => {
        const newPrice = typeof val === 'string' ? (val === '' ? 0 : parseFloat(val)) : val;
        if (onPriceChange) {
            onPriceChange(newPrice);
        } else {
            setLocalPrice(newPrice);
        }
    };

    // Quick price buttons: round to nearest 5, 10, 50
    const quickPrices = [
        { label: `฿${roundedSuggested}`, value: roundedSuggested, sub: 'แนะนำ' },
        { label: `฿${Math.ceil(suggestedPrice / 10) * 10}`, value: Math.ceil(suggestedPrice / 10) * 10, sub: 'ปัดขึ้น 10' },
        { label: `฿${Math.ceil(suggestedPrice / 50) * 50}`, value: Math.ceil(suggestedPrice / 50) * 50, sub: 'ปัดขึ้น 50' },
    ].filter((v, i, a) => a.findIndex(x => x.value === v.value) === i); // Remove duplicates

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header — Always visible, clickable on mobile to expand */}
            <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-3 md:p-4 bg-[#1A1A1A] text-white flex justify-between items-center gap-2 active:bg-[#2A2A2A] transition-colors"
            >
                <h3 className="font-bold flex items-center gap-2 text-sm md:text-base">
                    <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-[#DFFF00] flex-shrink-0" /> 
                    <span className="truncate">จำลองราคา</span>
                </h3>
                <div className="flex items-center gap-2">
                    {/* Always show key metrics in header */}
                    {hasPriceSet && (
                        <div className="flex items-center gap-2 text-xs">
                            <span className={`px-2 py-0.5 rounded-full font-bold ${profit > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                                ฿{profit.toFixed(0)}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full font-bold ${costPercent <= 35 ? 'bg-blue-500/20 text-blue-300' : 'bg-orange-500/20 text-orange-300'}`}>
                                {costPercent.toFixed(0)}%
                            </span>
                        </div>
                    )}
                    {isExpanded ? <ChevronDown size={18} className="text-gray-400 flex-shrink-0" /> : <ChevronUp size={18} className="text-gray-400 flex-shrink-0" />}
                </div>
            </button>

            {/* Collapsible Body */}
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                    
                    {/* 1. Dynamic Slider (Target Cost) */}
                    <div className="bg-gray-50 rounded-xl p-3 md:p-4 border border-dashed border-gray-200">
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-xs md:text-sm font-bold text-gray-600 flex items-center gap-1.5">
                                <Target className="w-3.5 h-3.5 md:w-4 md:h-4" /> 
                                <span>เป้าหมายต้นทุน</span>
                            </label>
                            <span className="text-base md:text-lg font-bold text-blue-600 tabular-nums">{targetPercent}%</span>
                        </div>
                        {/* Slider with larger touch target on mobile */}
                        <div className="py-2 touch-pan-x">
                            <input 
                                type="range" 
                                min="10" max="60" step="1"
                                value={targetPercent}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setTargetPercent(val === '' ? 0 : parseFloat(val));
                                }}
                                className="w-full accent-blue-600 h-2 md:h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                style={{ WebkitAppearance: 'none', touchAction: 'pan-x' }}
                            />
                        </div>
                        {/* Suggested price + quick-set buttons */}
                        <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
                            {totalCost > 0 && quickPrices.map((qp, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleSetPrice(qp.value)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                                        sellingPrice === qp.value 
                                            ? 'bg-blue-600 text-white shadow-md' 
                                            : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
                                    }`}
                                >
                                    {qp.label}
                                    {idx === 0 && <span className="ml-1 opacity-60">✨</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 2. Manual Input — Larger on mobile for easy tap */}
                    <div>
                        <label className="block text-[10px] md:text-xs font-bold text-gray-400 uppercase mb-1.5">
                            ราคาขายจริง (Selling Price)
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg md:text-xl font-bold">฿</span>
                            <input 
                                type="number"
                                inputMode="numeric"
                                className="w-full pl-9 md:pl-12 pr-4 py-3 md:py-3 bg-white border-2 border-gray-200 rounded-xl font-bold text-lg md:text-xl focus:border-[#DFFF00] focus:ring-0 outline-none transition-all tabular-nums"
                                value={sellingPrice || ''}
                                placeholder="0"
                                onChange={(e) => handleSetPrice(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* 3. Analysis Result — Responsive grid */}
                    <div className="grid grid-cols-2 gap-2 md:gap-4">
                        <div className={`p-3 md:p-4 rounded-xl text-center transition-colors ${profitColor}`}>
                            <div className="text-[10px] md:text-xs opacity-70 font-medium">กำไรต่อจาน</div>
                            <div className="text-lg md:text-xl font-bold tabular-nums mt-0.5">
                                {hasPriceSet ? `฿${profit.toFixed(2)}` : '—'}
                            </div>
                        </div>
                        <div className={`p-3 md:p-4 rounded-xl text-center transition-colors ${costColor}`}>
                            <div className="text-[10px] md:text-xs opacity-70 font-medium">% ต้นทุน</div>
                            <div className="text-lg md:text-xl font-bold tabular-nums mt-0.5">
                                {hasPriceSet ? `${costPercent.toFixed(1)}%` : '—'}
                            </div>
                        </div>
                    </div>

                    {/* 4. Cost Breakdown Mini Bar (Visual Aid) */}
                    {hasPriceSet && (
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] md:text-xs text-gray-400 font-medium">
                                <span>ต้นทุน ฿{totalCost.toFixed(2)}</span>
                                <span>ราคาขาย ฿{sellingPrice}</span>
                            </div>
                            <div className="w-full h-2.5 md:h-3 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full rounded-full transition-all duration-500 ${
                                        costPercent <= 30 ? 'bg-emerald-500' : costPercent <= 35 ? 'bg-blue-500' : 'bg-orange-500'
                                    }`}
                                    style={{ width: `${Math.min(costPercent, 100)}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
