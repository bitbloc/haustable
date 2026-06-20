import React, { useState } from 'react';
import { Package, AlertTriangle, FileText, Minus, Plus, Loader2, Check } from 'lucide-react';
import { formatStockDisplay } from '../../utils/stockUtils';

export default function StockCard({ 
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

    // Nendo Logic: Visual Color Status
    const qty = Number(item.current_quantity) || 0;
    const minThreshold = Number(item.min_stock_threshold) || 0;
    const reorderPoint = Number(item.reorder_point) || 0;
    const EPSILON = 0.0001;

    const isCritical = (minThreshold > 0 && qty <= minThreshold + EPSILON) || (qty <= EPSILON);
    const isWarning = !isCritical && reorderPoint > 0 && qty <= reorderPoint + EPSILON;
    
    // Choose styling based on status and saving state
    let bgClass = 'bg-white border-gray-100 shadow-sm';
    if (success) {
        bgClass = 'bg-green-50/50 border-green-300 shadow-green-100';
    } else if (saving) {
        bgClass = 'bg-blue-50/50 border-blue-300 shadow-blue-100';
    } else if (isCritical) {
        bgClass = 'bg-red-50 border-red-200 shadow-red-100';
    } else if (isWarning) {
        bgClass = 'bg-orange-50 border-orange-200 shadow-orange-100';
    }

    const textClass = isCritical && !saving && !success
        ? 'text-red-700'
        : isWarning && !saving && !success
            ? 'text-orange-700'
            : 'text-gray-900';

    // Format Data
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
                note: `ตรวจนับด่วน: ${Math.floor(newQty)} ${item.unit || 'ชิ้น'} (เต็ม) ${newQty % 1 > 0 ? `+ เปิดแล้ว ${Math.round((newQty % 1) * 100)}%` : ''}`
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
            className={`
                relative flex flex-col items-center p-3 rounded-2xl border transition-all text-left w-full h-full select-none
                ${bgClass}
                ${!quickCountMode ? 'cursor-pointer hover:shadow-md active:scale-95' : ''}
            `}
        >
            {/* Category badge for global search */}
            {searchActive && categoryLabel && (
                <div className="absolute top-2 left-2 z-10 bg-gray-100/90 text-gray-600 font-bold px-1.5 py-0.5 rounded text-[8px] border border-gray-200">
                    {categoryLabel}
                </div>
            )}

            {/* Recipe trigger */}
            {!searchActive && !quickCountMode && (
                <div 
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onRecipe) onRecipe(item);
                    }}
                    className="absolute top-2 left-2 z-10"
                >
                    <div className={`
                        flex items-center gap-1 px-2 py-1.5 rounded-lg backdrop-blur-md transition-all shadow-sm border
                        ${item.is_base_recipe 
                            ? 'bg-orange-100/90 border-orange-200 text-orange-800' 
                            : 'bg-white/60 border-gray-200 text-gray-500 hover:bg-white hover:text-black opacity-0 group-hover:opacity-100'
                        }
                    `}>
                        <FileText className="w-3 h-3" />
                        <span className="text-[10px] font-bold">สูตร</span>
                    </div>
                </div>
            )}

            {/* Status Indicator Icon / Saving Spinner / Success Check */}
            <div className="absolute top-2 right-2 z-10">
                {saving ? (
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                ) : success ? (
                    <Check className="w-4 h-4 text-green-600 font-bold" />
                ) : (isCritical || isWarning) && (
                    <div className={textClass}>
                        <AlertTriangle className="w-4 h-4" />
                    </div>
                )}
            </div>

            {/* Image Area */}
            <div className="w-16 h-16 mb-2 rounded-xl overflow-hidden bg-white shadow-inner flex items-center justify-center shrink-0 mt-4">
                {item.image_url ? (
                    <img 
                        src={item.image_url} 
                        alt={item.name} 
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <Package className="w-6 h-6 text-gray-300" />
                )}
            </div>

            {/* Info */}
            <div className="w-full flex-1 flex flex-col justify-between">
                <div>
                    <h3 className={`font-bold text-xs leading-tight mb-1 line-clamp-2 ${textClass}`}>
                        {item.name}
                    </h3>
                </div>
                
                {/* Quantity Display */}
                <div className="w-full">
                    {!quickCountMode ? (
                        <div className="flex flex-col w-full gap-1">
                            {/* Main Summary */}
                            <div className="flex items-baseline justify-between mb-1">
                                 <span className="text-[10px] text-gray-400 font-bold uppercase">คงเหลือรวม</span>
                                 <span className={`text-lg font-extrabold ${textClass}`}>
                                    {fullUnits + (hasOpen ? 1 : 0)}
                                 </span>
                            </div>

                            {/* Detailed Breakdown */}
                            <div className="flex flex-col gap-1">
                                {/* Unopened */}
                                {fullUnits > 0 && (
                                    <div className="flex justify-between items-center text-[10px] bg-gray-50 p-1 rounded-lg border border-gray-100">
                                        <span className="text-gray-400 font-bold">ยังไม่เปิด</span>
                                        <span className="font-bold text-gray-900">{fullUnits} {item.unit || item.pack_unit}</span>
                                    </div>
                                )}

                                {/* Opened */}
                                {hasOpen && (
                                     <div className="p-1 bg-blue-50/50 rounded-lg border border-blue-100 flex items-center justify-between text-[10px]">
                                         <span className="text-blue-800 font-bold text-[9px]">เปิดแล้ว</span>
                                         <div className="flex items-center gap-2">
                                             <span className="text-blue-600 font-bold min-w-[20px] text-right">
                                                {remainderUsage !== null ? `${remainderUsage} ${item.usage_unit}` : `${percent}%`}
                                             </span>
                                         </div>
                                     </div>
                                )}
                                
                                {fullUnits === 0 && !hasOpen && (
                                     <div className="text-center text-[10px] text-red-400 font-bold py-1">สินค้าหมด</div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Inline Adjuster Mode */
                        <div className="flex flex-col w-full gap-1.5 mt-1 border-t border-gray-100 pt-1.5" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] text-gray-400 font-bold uppercase">ยังไม่เปิด ({item.unit})</span>
                            </div>
                            
                            {/* Counter */}
                            <div className="flex items-center justify-between bg-gray-50 p-1 rounded-xl border border-gray-200">
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

                            {/* Percentage buttons for opened liquid/remainder */}
                            {isLiquidOrSplit && (
                                <div className="flex flex-col gap-1 mt-1">
                                    <span className="text-[8px] font-bold text-gray-400 uppercase">เปิดแล้ว (เศษ):</span>
                                    <div className="grid grid-cols-4 gap-0.5 bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                                        {[0, 25, 50, 75].map((p) => {
                                            const isActive = percent === p;
                                            return (
                                                <button
                                                    key={p}
                                                    type="button"
                                                    onClick={() => triggerUpdate(fullUnits + (p / 100))}
                                                    className={`text-[8px] font-extrabold py-1.5 rounded transition-all text-center px-0.5 ${
                                                        isActive 
                                                        ? 'bg-blue-600 text-white shadow-sm scale-105 font-black' 
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
                        </div>
                    )}
                </div>
            </div>
            
            {/* Visual Bar for Proportional Layout */}
            {!quickCountMode && item.par_level > 0 && (
                <div className="w-full h-1 bg-gray-200/50 rounded-full mt-2 overflow-hidden shrink-0">
                    <div 
                        className={`h-full rounded-full transition-all duration-500 ${isCritical ? 'bg-red-500' : isWarning ? 'bg-orange-400' : 'bg-[#1A1A1A]'}`}
                        style={{ width: `${Math.min(((Number(item.current_quantity) || 0) / (Number(item.par_level) || 1)) * 100, 100)}%` }}
                    />
                </div>
            )}
        </div>
    );
}
