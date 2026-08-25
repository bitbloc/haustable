import React, { useState, useRef } from 'react';
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
    const lockRef = useRef(false); // Debounce lock to prevent concurrent saves

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
                note: `ตรวจนับด่วน: ${Math.floor(newQty)} ${item.unit || 'ชิ้น'} (เต็ม) ${newQty % 1 > 0 ? `+ เปิดแล้ว ${Math.round((newQty % 1) * 100)}%` : ''}`
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
            className={`sc-card ${quickCountMode ? 'sc-card--non-interactive' : ''} ${
                success ? 'sc-card--success' : 
                saving ? 'sc-card--saving' : 
                isCritical ? 'sc-card--critical' : 
                isWarning ? 'sc-card--warning' : ''
            }`}
        >
            {/* Category badge for global search */}
            {searchActive && categoryLabel && (
                <div className="sc-badge">
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
                    <div className={`sc-recipe ${item.is_base_recipe ? 'sc-recipe--active' : ''}`}>
                        <FileText />
                        <span>สูตร</span>
                    </div>
                </div>
            )}

            {/* Status Indicator Icon / Saving Spinner / Success Check */}
            <div className={`sc-status-icon ${isCritical ? 'sc-status-icon--critical' : 'sc-status-icon--warning'}`}>
                {saving ? (
                    <Loader2 className="animate-spin" />
                ) : success ? (
                    <Check />
                ) : (isCritical || isWarning) && (
                    <AlertTriangle />
                )}
            </div>

            {/* Image Area */}
            <div className="sc-image-wrap">
                {item.image_url ? (
                    <img 
                        src={item.image_url} 
                        alt={item.name} 
                        className="sc-image"
                        loading="lazy"
                    />
                ) : (
                    <span className="sc-image-placeholder">
                        <Package />
                    </span>
                )}
            </div>

            {/* Info */}
            <div className="sc-info">
                <div>
                    <h3 className={`sc-title ${isCritical ? 'sc-title--critical' : isWarning ? 'sc-title--warning' : ''}`}>
                        {item.name}
                    </h3>
                </div>
                
                {/* Quantity Display */}
                <div className="sc-qty">
                    {!quickCountMode ? (
                        <div className="sc-breakdown">
                            {/* Main Summary */}
                            <div className="sc-qty__header">
                                 <span className={`sc-qty__label ${isCritical ? 'sc-qty__label--critical' : isWarning ? 'sc-qty__label--warning' : ''}`}>คงเหลือรวม</span>
                                 <span className={`sc-qty__val ${isCritical ? 'sc-qty__val--critical' : isWarning ? 'sc-qty__val--warning' : ''}`}>
                                    {fullUnits + (hasOpen ? 1 : 0)}
                                 </span>
                            </div>

                            {/* Detailed Breakdown */}
                            <div className="sc-breakdown">
                                {/* Unopened */}
                                {fullUnits > 0 && (
                                     <div className="sc-breakdown__item">
                                         <span>ยังไม่เปิด</span>
                                         <span>{fullUnits} {item.unit || item.pack_unit}</span>
                                     </div>
                                )}

                                {/* Opened */}
                                {hasOpen && (
                                     <div className="sc-breakdown__item sc-breakdown__item--open">
                                         <span>เปิดแล้ว</span>
                                         <span>
                                            {remainderUsage !== null ? `${remainderUsage} ${item.usage_unit}` : `${percent}%`}
                                         </span>
                                     </div>
                                )}
                                
                                {fullUnits === 0 && !hasOpen && (
                                     <div className="sc-breakdown__item sc-breakdown__item--empty">สินค้าหมด</div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Inline Adjuster Mode */
                        <div className="sp-adjuster" onClick={e => e.stopPropagation()}>
                            <div className="sp-adjuster__header">ยังไม่เปิด ({item.unit})</div>
                            
                            {/* Counter */}
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

                            {/* Percentage buttons for opened liquid/remainder */}
                            {isLiquidOrSplit && (
                                <>
                                    <div className="sp-adjuster__percent-label">เปิดแล้ว (เศษ)</div>
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
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            {/* Visual Bar for Proportional Layout */}
            {!quickCountMode && item.par_level > 0 && (
                <div className="sc-par-bar">
                    <div 
                        className={`sc-par-fill ${isCritical ? 'sc-par-fill--critical' : isWarning ? 'sc-par-fill--warning' : ''}`}
                        style={{ width: `${Math.min(((Number(item.current_quantity) || 0) / (Number(item.par_level) || 1)) * 100, 100)}%` }}
                    />
                </div>
            )}
        </div>
    );
}
