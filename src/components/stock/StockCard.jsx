import React from 'react';
import { formatStockDisplay } from '../../utils/stockUtils';

export default function StockCard({ 
    item, 
    onClick, 
    onRecipe, 
    searchActive = false, 
    categories = [] 
}) {

    // Status Logic
    const qty = Number(item.current_quantity) || 0;
    const minThreshold = Number(item.min_stock_threshold) || 0;
    const reorderPoint = Number(item.reorder_point) || 0;
    const EPSILON = 0.0001;

    const isCritical = (minThreshold > 0 && qty <= minThreshold + EPSILON) || (qty <= EPSILON);
    const isWarning = !isCritical && reorderPoint > 0 && qty <= reorderPoint + EPSILON;
    
    // Styling by stock status
    let bgClass = 'bg-white border-[var(--color-hallmark-rule)] shadow-sm';
    if (isCritical) {
        bgClass = 'bg-red-50/40 border-red-200 shadow-sm';
    } else if (isWarning) {
        bgClass = 'bg-orange-50/40 border-orange-200 shadow-sm';
    }

    const textClass = isCritical
        ? 'text-red-700'
        : isWarning
            ? 'text-orange-700'
            : 'text-[var(--color-hallmark-ink)]';

    const labelClass = isCritical
        ? 'text-red-500'
        : isWarning
            ? 'text-orange-500'
            : 'text-gray-400';

    // Format Data
    const { fullUnits, percent, hasOpen, remainderUsage } = formatStockDisplay(
        item.current_quantity, 
        item.unit || item.pack_unit,
        item.usage_unit,
        item.conversion_factor
    );



    const cat = categories?.find(c => c.id === item.category);
    const categoryLabel = cat ? cat.label : '';

    return (
        <div 
            onClick={() => onClick(item)}
            className={`sc-card ${
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
            {!searchActive && (
                <div 
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onRecipe) onRecipe(item);
                    }}
                    className="absolute top-2 left-2 z-10"
                >
                    <div className={`sc-recipe ${item.is_base_recipe ? 'sc-recipe--active' : ''}`}>
                        <span>สูตร</span>
                    </div>
                </div>
            )}

            {/* Status: text tag, no icon */}
            {(isCritical || isWarning) && (
                <span className={`sc-status-tag ${isCritical ? 'sc-status-tag--critical' : 'sc-status-tag--warning'}`}>
                    {isCritical ? 'หมด' : 'ใกล้หมด'}
                </span>
            )}

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
                    <span className="sc-image-placeholder" aria-hidden="true">
                        ยังไม่มีรูป
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
                </div>
            </div>
            
            {/* Visual Bar for Proportional Layout */}
            {item.par_level > 0 && (
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
