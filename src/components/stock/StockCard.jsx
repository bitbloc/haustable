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

    // Status Logic
    const qty = Number(item.current_quantity) || 0;
    const minThreshold = Number(item.min_stock_threshold) || 0;
    const reorderPoint = Number(item.reorder_point) || 0;
    const EPSILON = 0.0001;

    const isCritical = (minThreshold > 0 && qty <= minThreshold + EPSILON) || (qty <= EPSILON);
    const isWarning = !isCritical && reorderPoint > 0 && qty <= reorderPoint + EPSILON;
    
    // Choose styling based on status and saving state
    let bgClass = 'bg-white border-[var(--color-hallmark-rule)] shadow-sm';
    if (success) {
        bgClass = 'bg-green-50/50 border-green-300 shadow-sm';
    } else if (saving) {
        bgClass = 'bg-blue-50/50 border-blue-300 shadow-sm';
    } else if (isCritical) {
        bgClass = 'bg-red-50/40 border-red-200 shadow-sm';
    } else if (isWarning) {
        bgClass = 'bg-orange-50/40 border-orange-200 shadow-sm';
    }

    const textClass = isCritical && !saving && !success
        ? 'text-red-700'
        : isWarning && !saving && !success
            ? 'text-orange-700'
            : 'text-[var(--color-hallmark-ink)]';

    const labelClass = isCritical && !saving && !success
        ? 'text-red-500'
        : isWarning && !saving && !success
            ? 'text-orange-500'
            : 'text-gray-400';

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
                relative flex flex-col items-center p-3.5 rounded-xl border transition-[border-color,box-shadow] duration-150 ease-out text-left w-full h-full select-none
                ${bgClass}
                ${!quickCountMode ? 'cursor-pointer hover:shadow-md hover:border-[var(--color-hallmark-ink-muted)]' : ''}
            `}
        >
            {/* Category badge for global search */}
            {searchActive && categoryLabel && (
                <div className="absolute top-2 left-2 z-10 bg-white/90 text-gray-500 font-bold px-2 py-0.5 rounded border border-[var(--color-hallmark-rule)] text-[8px] uppercase tracking-wider">
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
                        flex items-center gap-1.5 px-2 py-1 rounded-md transition-all shadow-sm border text-[10px] font-bold
                        ${item.is_base_recipe 
                            ? 'bg-orange-100/90 border-orange-200 text-orange-800' 
                            : 'bg-white border-[var(--color-hallmark-rule)] text-gray-400 hover:bg-gray-50 hover:text-[#1A1A1A] opacity-0 group-hover:opacity-100'
                        }
                    `}>
                        <FileText className="w-3 h-3" />
                        <span>สูตร</span>
                    </div>
                </div>
            )}

            {/* Status Indicator Icon / Saving Spinner / Success Check */}
            <div className="absolute top-2.5 right-2.5 z-10">
                {saving ? (
                    <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                ) : success ? (
                    <Check className="w-3.5 h-3.5 text-green-600 font-bold" />
                ) : (isCritical || isWarning) && (
                    <div className={textClass}>
                        <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                )}
            </div>

            {/* Image Area */}
            <div className="w-14 h-14 mb-2.5 rounded-lg overflow-hidden bg-gray-50 border border-[var(--color-hallmark-rule)]/50 flex items-center justify-center shrink-0 mt-4 shadow-sm">
                {item.image_url ? (
                    <img 
                        src={item.image_url} 
                        alt={item.name} 
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <Package className="w-5 h-5 text-gray-300" />
                )}
            </div>

            {/* Info */}
            <div className="w-full flex-1 flex flex-col justify-between">
                <div>
                    <h3 className={`font-bold text-xs leading-tight mb-1.5 line-clamp-2 ${textClass}`}>
                        {item.name}
                    </h3>
                </div>
                
                {/* Quantity Display */}
                <div className="w-full">
                    {!quickCountMode ? (
                        <div className="flex flex-col w-full gap-1">
                            {/* Main Summary */}
                            <div className="flex items-baseline justify-between mb-0.5">
                                 <span className={`text-[9px] font-bold uppercase tracking-wider ${labelClass}`}>คงเหลือรวม</span>
                                 <span className={`text-lg font-mono font-extrabold ${textClass}`}>
                                    {fullUnits + (hasOpen ? 1 : 0)}
                                 </span>
                            </div>

                            {/* Detailed Breakdown */}
                            <div className="flex flex-col gap-1">
                                {/* Unopened */}
                                {fullUnits > 0 && (
                                     <div className="flex justify-between items-center text-[10px] bg-gray-50/50 p-1.5 rounded-lg border border-[var(--color-hallmark-rule)]/60">
                                         <span className="text-gray-400 font-bold">ยังไม่เปิด</span>
                                         <span className="font-bold text-gray-900 font-mono">{fullUnits} {item.unit || item.pack_unit}</span>
                                     </div>
                                )}

                                {/* Opened */}
                                {hasOpen && (
                                     <div className="p-1.5 bg-blue-50/40 rounded-lg border border-blue-100 flex items-center justify-between text-[10px]">
                                         <span className="text-blue-800 font-bold text-[9px]">เปิดแล้ว</span>
                                         <span className="text-blue-600 font-bold font-mono">
                                            {remainderUsage !== null ? `${remainderUsage} ${item.usage_unit}` : `${percent}%`}
                                         </span>
                                     </div>
                                )}
                                
                                {fullUnits === 0 && !hasOpen && (
                                     <div className="text-center text-[10px] text-red-500 font-bold py-1 bg-red-50/30 rounded-lg border border-red-100/50">สินค้าหมด</div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Inline Adjuster Mode */
                        <div className="flex flex-col w-full gap-1.5 mt-1 border-t border-[var(--color-hallmark-rule)]/50 pt-2" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">ยังไม่เปิด ({item.unit})</span>
                            </div>
                            
                            {/* Counter */}
                            <div className="flex items-center justify-between bg-gray-50/80 p-0.5 rounded-lg border border-[var(--color-hallmark-rule)] shadow-inner">
                                <button 
                                    type="button"
                                    onClick={() => triggerUpdate(Math.max(0, fullUnits - 1) + (percent / 100))}
                                    className="w-6.5 h-6.5 rounded-md bg-white border border-[var(--color-hallmark-rule)] flex items-center justify-center shadow-sm hover:bg-gray-100 active:scale-95 transition-all text-gray-600"
                                >
                                    <Minus className="w-3 h-3" />
                                </button>
                                
                                <input 
                                    type="number"
                                    value={fullUnits}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value) || 0;
                                        triggerUpdate(Math.max(0, val) + (percent / 100));
                                    }}
                                    className="w-8 bg-transparent text-center font-mono font-bold text-xs text-gray-900 border-none outline-none focus:ring-0 p-0"
                                />

                                <button 
                                    type="button"
                                    onClick={() => triggerUpdate((fullUnits + 1) + (percent / 100))}
                                    className="w-6.5 h-6.5 rounded-md bg-white border border-[var(--color-hallmark-rule)] flex items-center justify-center shadow-sm hover:bg-gray-100 active:scale-95 transition-all text-gray-600"
                                >
                                    <Plus className="w-3 h-3" />
                                </button>
                            </div>

                            {/* Percentage buttons for opened liquid/remainder */}
                            {isLiquidOrSplit && (
                                <div className="flex flex-col gap-1 mt-1">
                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">เปิดแล้ว (เศษ):</span>
                                    <div className="grid grid-cols-4 gap-0.5 bg-gray-150 p-0.5 rounded-md border border-[var(--color-hallmark-rule)]">
                                        {[0, 25, 50, 75].map((p) => {
                                            const isActive = percent === p;
                                            return (
                                                <button
                                                    key={p}
                                                    type="button"
                                                    onClick={() => triggerUpdate(fullUnits + (p / 100))}
                                                    className={`text-[8px] py-1 rounded transition-all text-center px-0.5 font-bold ${
                                                        isActive 
                                                        ? 'bg-[#1A1A1A] text-white shadow-sm font-extrabold' 
                                                        : 'text-gray-500 hover:bg-gray-50'
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
                <div className="w-full h-1 bg-gray-100 rounded-full mt-2.5 overflow-hidden shrink-0 border border-gray-200/10">
                    <div 
                        className={`h-full rounded-full transition-[width] duration-300 ${isCritical ? 'bg-red-500' : isWarning ? 'bg-orange-400' : 'bg-[var(--color-brand)]'}`}
                        style={{ width: `${Math.min(((Number(item.current_quantity) || 0) / (Number(item.par_level) || 1)) * 100, 100)}%` }}
                    />
                </div>
            )}
        </div>
    );
}
