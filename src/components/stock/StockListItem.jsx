import React, { useState, useRef } from 'react';
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
    const lockRef = useRef(false); // Debounce lock to prevent concurrent saves

    // Status logic
    const qty = Number(item.current_quantity) || 0;
    const minThreshold = Number(item.min_stock_threshold) || 0;
    const reorderPoint = Number(item.reorder_point) || 0;
    const EPSILON = 0.0001;

    const isCritical = (minThreshold > 0 && qty <= minThreshold + EPSILON) || (qty <= EPSILON);
    const isWarning = !isCritical && reorderPoint > 0 && qty <= reorderPoint + EPSILON;

    let bgClass = 'hover:bg-gray-50/60';
    if (success) {
        bgClass = 'bg-green-50/50 hover:bg-green-50';
    } else if (saving) {
        bgClass = 'bg-blue-50/50 hover:bg-blue-50';
    } else if (isCritical) {
        bgClass = 'bg-red-50/30 hover:bg-red-50/40';
    } else if (isWarning) {
        bgClass = 'bg-orange-50/30 hover:bg-orange-50/40';
    }

    const textClass = isCritical && !saving && !success ? 'text-red-700' : isWarning && !saving && !success ? 'text-orange-700' : 'text-[var(--color-hallmark-ink)]';

    const getStatusColorClass = (qty, reorder, min) => {
        const numQty = Number(qty) || 0;
        const numMin = Number(min) || 0;
        const numReorder = Number(reorder) || 0;
        const EPSILON = 0.0001;

        if ((numMin > 0 && numQty <= numMin + EPSILON) || numQty <= EPSILON) return 'bg-red-50 border-red-200 text-red-700';
        if (numReorder > 0 && numQty <= numReorder + EPSILON) return 'bg-orange-50 border-orange-200 text-orange-700';
        return 'bg-green-50 border-green-200 text-green-700';
    };

    const { fullUnits, percent, hasOpen, remainderUsage } = formatStockDisplay(
        item.current_quantity, 
        item.unit || item.pack_unit,
        item.usage_unit,
        item.conversion_factor
    );

    const successTimerRef = useRef(null);

    React.useEffect(() => {
        return () => {
            if (successTimerRef.current) clearTimeout(successTimerRef.current);
        };
    }, []);

    const triggerUpdate = async (newQty) => {
        if (!onUpdate || lockRef.current) return; // Skip if already saving
        lockRef.current = true;
        setSaving(true);
        setSuccess(false);
        try {
            await onUpdate(item.id, Number(newQty.toFixed(4)), 'set', {
                note: `ตรวจนับด่วน (List): ${Math.floor(newQty)} ${item.unit || 'ชิ้น'} (เต็ม) ${newQty % 1 > 0 ? `+ เปิดแล้ว ${Math.round((newQty % 1) * 100)}%` : ''}`
            });
            setSuccess(true);
            if (successTimerRef.current) clearTimeout(successTimerRef.current);
            successTimerRef.current = setTimeout(() => setSuccess(false), 1500);
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
            lockRef.current = false;
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
            className={`sli-item ${!quickCountMode ? 'sli-item--interactive' : ''} ${
                success ? 'sli-item--success' : 
                saving ? 'sli-item--saving' : 
                isCritical ? 'sli-item--critical' : 
                isWarning ? 'sli-item--warning' : ''
            }`}
        >
            {/* Left Section: Info */}
            <div className="sli-item__main">
                <div className="sli-image-wrap">
                    {item.image_url ? (
                        <img src={item.image_url} alt="" className="sli-image" loading="lazy" />
                    ) : (
                        <div className="sli-image-placeholder">
                            <Package className="w-5 h-5" />
                        </div>
                    )}
                    {/* Status Alert Badge */}
                    {(isCritical || isWarning) && !saving && !success && (
                        <div className={`sli-status-dot ${isCritical ? 'sli-status-dot--critical' : 'sli-status-dot--warning'}`} />
                    )}
                </div>
                
                <div className="sli-info">
                    <div className="sli-info__row">
                        <h3 className={`sli-title ${isCritical ? 'sli-title--critical' : isWarning ? 'sli-title--warning' : ''}`}>{item.name}</h3>
                        
                        {/* Recipe indicator */}
                        {item.is_base_recipe && !quickCountMode && (
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onRecipe) onRecipe(item);
                                }}
                                className="sli-recipe"
                            >
                                <FileText className="w-3 h-3" />
                            </button>
                        )}
                        
                        {/* Category Badge */}
                        {searchActive && categoryLabel && (
                            <span className="sli-badge">
                                {categoryLabel}
                            </span>
                        )}
                    </div>
                    <p className="sli-subtitle">
                        {formatStockDisplay(item.current_quantity, item.unit || item.pack_unit, item.usage_unit, item.conversion_factor).displayString}
                    </p>
                </div>
            </div>

            {/* Right Section: Display / Adjuster */}
            <div className="sli-right" onClick={e => e.stopPropagation()}>
                {!quickCountMode ? (
                    /* Display Mode */
                    <div className={`sli-badge-status ${isCritical ? 'sli-badge-status--critical' : isWarning ? 'sli-badge-status--warning' : 'sli-badge-status--ok'}`}>
                        {formatStockDisplay(item.current_quantity).fullUnits} {item.unit}
                    </div>
                ) : (
                    /* Quick Edit Mode */
                    <div className="sp-adjuster">
                        {/* Counter Adjuster */}
                        <div className="sp-adjuster__counter">
                            <button 
                                type="button"
                                onClick={() => triggerUpdate(Math.max(0, fullUnits - 1) + (percent / 100))}
                                className="sp-adjuster__btn"
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
                                className="sp-adjuster__input"
                            />

                            <button 
                                type="button"
                                onClick={() => triggerUpdate((fullUnits + 1) + (percent / 100))}
                                className="sp-adjuster__btn"
                            >
                                <Plus className="w-3 h-3" />
                            </button>
                        </div>

                        {/* Remainder Picker */}
                        {isLiquidOrSplit && (
                            <div className="sp-adjuster__percent-grid">
                                {[0, 25, 50, 75].map((p) => {
                                    const isActive = percent === p;
                                    return (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => triggerUpdate(fullUnits + (p / 100))}
                                            className={`sp-adjuster__percent-btn ${isActive ? 'sp-adjuster__percent-btn--active' : ''}`}
                                        >
                                            {p === 0 ? '0%' : `${p}%`}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Save status icons */}
                        <div style={{ display: 'none' }}>
                            {saving ? (
                                <Loader2 className="animate-spin" />
                            ) : success ? (
                                <Check />
                            ) : null}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
