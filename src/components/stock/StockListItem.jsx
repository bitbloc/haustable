import React from 'react';
import { Package, AlertTriangle, FileText } from 'lucide-react';
import { formatStockDisplay } from '../../utils/stockUtils';

export default function StockListItem({ 
    item, 
    onClick, 
    onRecipe, 
    searchActive = false, 
    categories = [] 
}) {

    // Status logic
    const qty = Number(item.current_quantity) || 0;
    const minThreshold = Number(item.min_stock_threshold) || 0;
    const reorderPoint = Number(item.reorder_point) || 0;
    const EPSILON = 0.0001;

    const isCritical = (minThreshold > 0 && qty <= minThreshold + EPSILON) || (qty <= EPSILON);
    const isWarning = !isCritical && reorderPoint > 0 && qty <= reorderPoint + EPSILON;

    let bgClass = 'hover:bg-gray-50/60';
    if (isCritical) {
        bgClass = 'bg-red-50/30 hover:bg-red-50/40';
    } else if (isWarning) {
        bgClass = 'bg-orange-50/30 hover:bg-orange-50/40';
    }

    const textClass = isCritical ? 'text-red-700' : isWarning ? 'text-orange-700' : 'text-[var(--color-hallmark-ink)]';

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



    const cat = categories?.find(c => c.id === item.category);
    const categoryLabel = cat ? `${cat.icon} ${cat.label}` : '';

    return (
        <div 
            onClick={() => onClick(item)}
            className={`sli-item sli-item--interactive ${
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
                    {(isCritical || isWarning) && (
                        <div className={`sli-status-dot ${isCritical ? 'sli-status-dot--critical' : 'sli-status-dot--warning'}`} />
                    )}
                </div>
                
                <div className="sli-info">
                    <div className="sli-info__row">
                        <h3 className={`sli-title ${isCritical ? 'sli-title--critical' : isWarning ? 'sli-title--warning' : ''}`}>{item.name}</h3>
                        
                        {/* Recipe indicator */}
                        {item.is_base_recipe && (
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

            {/* Right Section: quantity */}
            <div className="sli-right">
                <div className={`sli-badge-status ${isCritical ? 'sli-badge-status--critical' : isWarning ? 'sli-badge-status--warning' : 'sli-badge-status--ok'}`}>
                    {formatStockDisplay(item.current_quantity).fullUnits} {item.unit}
                </div>
            </div>
        </div>
    );
}
