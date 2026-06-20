import React, { useState } from 'react';
import { Package, AlertTriangle, FileText, Minus, Plus, Loader2, Check } from 'lucide-react';
import { formatStockDisplay } from '../../utils/stockUtils';

export default function StockListItem({ 
    item, 
    onClick, 
    onRecipe, 
    quickCountMode = false, 
    onUpdate = null, 
    searchActive = false, 
    categories = [] 
}) {
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    // Status logic
    const qty = Number(item.current_quantity) || 0;
    const minThreshold = Number(item.min_stock_threshold) || 0;
    const reorderPoint = Number(item.reorder_point) || 0;
    const EPSILON = 0.0001;

    const isCritical = (minThreshold > 0 && qty <= minThreshold + EPSILON) || (qty <= EPSILON);
    const isWarning = !isCritical && reorderPoint > 0 && qty <= reorderPoint + EPSILON;

    let bgClass = 'hover:bg-gray-50';
    if (success) {
        bgClass = 'bg-green-50/50 hover:bg-green-50';
    } else if (saving) {
        bgClass = 'bg-blue-50/50 hover:bg-blue-50';
    } else if (isCritical) {
        bgClass = 'bg-red-50/30 hover:bg-red-50/50';
    } else if (isWarning) {
        bgClass = 'bg-orange-50/30 hover:bg-orange-50/50';
    }

    const textClass = isCritical && !saving && !success ? 'text-red-700' : isWarning && !saving && !success ? 'text-orange-700' : 'text-gray-900';

    const getStatusColorClass = (qty, reorder, min) => {
        const numQty = Number(qty) || 0;
        const numMin = Number(min) || 0;
        const numReorder = Number(reorder) || 0;
        const EPSILON = 0.0001;

        if ((numMin > 0 && numQty <= numMin + EPSILON) || numQty <= EPSILON) return 'bg-red-100 text-red-600';
        if (numReorder > 0 && numQty <= numReorder + EPSILON) return 'bg-orange-100 text-orange-700';
        return 'bg-green-50 text-green-700';
    };

    const { fullUnits, percent, hasOpen, remainderUsage } = formatStockDisplay(
        item.current_quantity, 
        item.unit || item.pack_unit,
        item.usage_unit,
        item.conversion_factor
    );

    const triggerUpdate = async (newQty) => {
        if (!onUpdate) return;
        setSaving(true);
        setSuccess(false);
        try {
            await onUpdate(item.id, Number(newQty.toFixed(4)), 'set', {
                note: `ตรวจนับด่วน (List): ${Math.floor(newQty)} ${item.unit || 'ชิ้น'} (เต็ม) ${newQty % 1 > 0 ? `+ เปิดแล้ว ${Math.round((newQty % 1) * 100)}%` : ''}`
            });
            setSuccess(true);
            setTimeout(() => setSuccess(false), 1500);
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const unitLower = (item.unit || '').toLowerCase();
    const isLiquidOrSplit = item.category === 'sauce' || item.category === 'spirits' || 
                           unitLower.includes('bottle') || unitLower.includes('l') || unitLower.includes('ขวด') ||
                           unitLower.includes('bag') || unitLower.includes('ถุง') || unitLower.includes('kg') || unitLower.includes('g') ||
                           item.usage_unit;

    const cat = categories?.find(c => c.id === item.category);
    const categoryLabel = cat ? `${cat.icon} ${cat.label}` : '';

    return (
        <div 
            onClick={() => {
                if (!quickCountMode) onClick(item);
            }}
            className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors border-b border-gray-100 select-none ${bgClass} ${!quickCountMode ? 'cursor-pointer active:bg-gray-100' : ''}`}
        >
            {/* Left Section: Info */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden relative border border-gray-200/50">
                    {item.image_url ? (
                        <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <Package className="w-6 h-6" />
                        </div>
                    )}
                    {/* Status Alert Badge */}
                    {(isCritical || isWarning) && !saving && !success && (
                        <div className="absolute top-0 right-0 w-3 h-3 bg-orange-500 rounded-full border border-white flex items-center justify-center">
                            <div className={`w-1.5 h-1.5 rounded-full ${isCritical ? 'bg-red-500' : 'bg-orange-400'}`}></div>
                        </div>
                    )}
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`font-bold text-sm truncate ${textClass}`}>{item.name}</h3>
                        
                        {/* Recipe indicator */}
                        {item.is_base_recipe && !quickCountMode && (
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onRecipe) onRecipe(item);
                                }}
                                className="p-1 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded transition-colors"
                            >
                                <FileText className="w-3 h-3" />
                            </button>
                        )}
                        
                        {/* Category Badge */}
                        {searchActive && categoryLabel && (
                            <span className="text-[8px] bg-gray-100 border border-gray-200 text-gray-500 font-bold px-1.5 py-0.5 rounded">
                                {categoryLabel}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {formatStockDisplay(item.current_quantity, item.unit || item.pack_unit, item.usage_unit, item.conversion_factor).displayString}
                    </p>
                </div>
            </div>

            {/* Right Section: Display / Adjuster */}
            <div className="flex items-center justify-between md:justify-end gap-4" onClick={e => e.stopPropagation()}>
                {!quickCountMode ? (
                    /* Display Mode */
                    <div className="flex items-center gap-3 ml-auto">
                        <div className={`text-right px-3 py-1 rounded-full text-xs font-bold ${getStatusColorClass(item.current_quantity, item.reorder_point, item.min_stock_threshold)}`}>
                            {formatStockDisplay(item.current_quantity).fullUnits} {item.unit}
                        </div>
                    </div>
                ) : (
                    /* Quick Edit Mode */
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto ml-auto">
                        {/* Counter Adjuster */}
                        <div className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-200">
                            <button 
                                type="button"
                                onClick={() => triggerUpdate(Math.max(0, fullUnits - 1) + (percent / 100))}
                                className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center shadow-sm hover:bg-gray-100 active:scale-90 transition-transform"
                            >
                                <Minus className="w-3 h-3 text-gray-600" />
                            </button>
                            
                            <input 
                                type="number"
                                value={fullUnits}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    triggerUpdate(Math.max(0, val) + (percent / 100));
                                }}
                                className="w-10 bg-transparent text-center font-extrabold text-xs text-gray-900 border-none outline-none focus:ring-0 p-0"
                            />

                            <button 
                                type="button"
                                onClick={() => triggerUpdate((fullUnits + 1) + (percent / 100))}
                                className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center shadow-sm hover:bg-gray-100 active:scale-90 transition-transform"
                            >
                                <Plus className="w-3 h-3 text-gray-600" />
                            </button>
                        </div>

                        {/* Remainder Picker */}
                        {isLiquidOrSplit && (
                            <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-gray-400 uppercase hidden sm:inline">เศษ:</span>
                                <div className="grid grid-cols-4 gap-0.5 bg-gray-100 p-0.5 rounded-lg border border-gray-200 w-36">
                                    {[0, 25, 50, 75].map((p) => {
                                        const isActive = percent === p;
                                        return (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => triggerUpdate(fullUnits + (p / 100))}
                                                className={`text-[8px] font-extrabold py-1.5 rounded transition-all text-center ${
                                                    isActive 
                                                    ? 'bg-blue-600 text-white shadow-sm scale-105' 
                                                    : 'text-gray-500 hover:bg-gray-200'
                                                }`}
                                            >
                                                {p === 0 ? '0%' : `${p}%`}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Save status icons */}
                        <div className="w-6 h-6 flex items-center justify-center">
                            {saving ? (
                                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                            ) : success ? (
                                <Check className="w-4 h-4 text-green-600 font-bold" />
                            ) : null}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
