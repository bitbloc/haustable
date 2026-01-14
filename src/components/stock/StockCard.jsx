import React from 'react';
import { Package, AlertTriangle } from 'lucide-react';
import { formatStockDisplay } from '../../utils/stockUtils';

export default function StockCard({ item, onClick }) {
    // Nendo Logic: Visual Color Status
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

    // Format Data
    const { fullUnits, percent, hasOpen } = formatStockDisplay(item.current_quantity, item.unit);

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
                <div className="flex flex-col w-full">
                    {/* Main Integer Count */}
                    <div className="flex items-baseline justify-between">
                         <span className="text-xs text-gray-500 font-medium">{item.unit}</span>
                         <span className={`text-xl font-extrabold ${textClass}`}>
                            {fullUnits}
                         </span>
                    </div>

                    {/* Opened / Partial Detail */}
                    {hasOpen ? (
                        <div className="mt-1 p-1.5 bg-white/50 rounded-lg border border-black/5 flex items-center justify-between text-xs">
                             <span className="text-gray-500 font-bold text-[10px]">เปิดแล้ว</span>
                             <div className="flex items-center gap-1.5 font-bold text-blue-600">
                                 <span>{percent}%</span>
                                 <div className="w-8 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                     <div className="h-full bg-blue-500 rounded-full" style={{ width: `${percent}%` }} />
                                 </div>
                             </div>
                        </div>
                    ) : (
                         <div className="mt-1 h-[26px] flex items-center justify-end">
                            <span className="text-[10px] text-gray-400 font-medium bg-gray-100/50 px-2 py-0.5 rounded-full">ยังไม่เปิด</span>
                         </div>
                    )}
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
