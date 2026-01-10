import React from 'react';
import { Package, AlertTriangle } from 'lucide-react';

export default function StockCard({ item, onClick }) {
    // Nendo Logic: Visual Color Status
    // User Request: If qty < 1.5 (1 bottle 50%), show Red.
    const isCritical = (item.current_quantity || 0) < 1.5 || item.current_quantity <= item.min_stock_threshold;
    const isWarning = !isCritical && item.current_quantity <= item.reorder_point;
    
    // Choose styling based on status
    const bgClass = isCritical 
        ? 'bg-red-50 border-red-200 shadow-red-100' 
        : isWarning 
            ? 'bg-orange-50 border-orange-200 shadow-orange-100' 
            : 'bg-white border-gray-100 shadow-sm';

    const textClass = isCritical
        ? 'text-red-700'
        : isWarning
            ? 'text-orange-700'
            : 'text-gray-900';

    return (
        <button 
            onClick={() => onClick(item)}
            className={`
                relative flex flex-col items-center p-3 rounded-2xl border transition-all active:scale-95 text-left w-full h-full
                ${bgClass}
            `}
        >
            {/* Status Indicator Icon (only for issues) */}
            {(isCritical || isWarning) && (
                <div className={`absolute top-2 right-2 ${textClass}`}>
                    <AlertTriangle className="w-4 h-4" />
                </div>
            )}

            {/* Image Area */}
            <div className="w-20 h-20 mb-3 rounded-xl overflow-hidden bg-white shadow-inner flex items-center justify-center">
                {item.image_url ? (
                    <img 
                        src={item.image_url} 
                        alt={item.name} 
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <Package className="w-8 h-8 text-gray-300" />
                )}
            </div>

            {/* Info */}
            <div className="w-full">
                <h3 className={`font-bold text-sm leading-tight mb-1 line-clamp-2 ${textClass}`}>
                    {item.name}
                </h3>
                
                {/* Quantity Display */}
                <div className="flex items-baseline justify-between w-full">
                    <span className="text-xs text-gray-500 font-medium">
                        {item.unit}
                    </span>
                    
                    <div className="text-right">
                        <span className={`text-lg font-extrabold ${textClass}`}>
                             {/* Show Integer Part */}
                             {Math.floor(item.current_quantity || 0)}
                        </span>
                        
                        {/* Decimal/Partial Part Visualization */}
                        {(item.current_quantity % 1) > 0.01 && (
                            <div className="text-xs font-bold text-blue-600 flex flex-col items-end">
                                {item.capacity_per_unit ? (
                                    <span>
                                        + {Math.round((item.current_quantity % 1) * item.capacity_per_unit)} ml
                                    </span>
                                ) : (
                                    <span>
                                        + {Math.round((item.current_quantity % 1) * 100)}%
                                    </span>
                                )}
                                
                                {/* Mini Bar for Partial */}
                                <div className="w-12 h-1.5 bg-gray-100 rounded-full mt-0.5 overflow-hidden border border-gray-200">
                                    <div 
                                        className="h-full bg-blue-500 rounded-full" 
                                        style={{ width: `${(item.current_quantity % 1) * 100}%` }} 
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Visual Bar for Proportional Layout (Optional Micro-interaction) */}
            {item.par_level > 0 && (
                <div className="w-full h-1 bg-gray-200/50 rounded-full mt-2 overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all duration-500 ${isCritical ? 'bg-red-500' : isWarning ? 'bg-orange-400' : 'bg-[#1A1A1A]'}`}
                        style={{ width: `${Math.min((item.current_quantity / item.par_level) * 100, 100)}%` }}
                    />
                </div>
            )}
        </button>
    );
}
