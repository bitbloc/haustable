import React, { useState, useEffect } from 'react';
import { calculateSuggestedPrice } from '../../utils/costUtils';
import { DollarSign, TrendingUp, Target } from 'lucide-react';

export default function PriceSimulator({ totalCost, initialPrice = 0 }) {
    const [sellingPrice, setSellingPrice] = useState(initialPrice);
    const [targetPercent, setTargetPercent] = useState(30); // Default Target 30% Cost
    
    // Derived
    const profit = sellingPrice - totalCost;
    const costPercent = sellingPrice > 0 ? (totalCost / sellingPrice) * 100 : 0;
    
    // Suggested price based on slider
    const suggestedPrice = calculateSuggestedPrice(totalCost, targetPercent);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-[#1A1A1A] text-white flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-[#DFFF00]" /> 
                    จำลองราคา (Price Simulator)
                </h3>
            </div>

            <div className="p-6 space-y-6">
                
                {/* 1. Dynamic Slider (Target Cost) */}
                <div className="bg-gray-50 rounded-xl p-4 border border-dashed border-gray-300">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <Target className="w-4 h-4" /> เป้าหมายต้นทุน (Target Cost %)
                        </label>
                        <span className="text-lg font-bold text-blue-600">{targetPercent}%</span>
                    </div>
                    <input 
                        type="range" 
                        min="10" max="60" step="1"
                        value={targetPercent}
                        onChange={(e) => setTargetPercent(parseFloat(e.target.value))}
                        className="w-full accent-blue-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="mt-2 text-right text-xs text-gray-500">
                        แนะนำขายที่: <span className="font-bold text-lg text-[#1A1A1A]">฿{Math.ceil(suggestedPrice)}</span>
                    </div>
                </div>

                {/* 2. Manual Input */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">ราคาขายจริง (Selling Price)</label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input 
                                type="number"
                                className="w-full pl-10 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl font-bold text-xl focus:border-[#DFFF00] focus:ring-0 outline-none transition-all"
                                value={sellingPrice}
                                onChange={(e) => setSellingPrice(parseFloat(e.target.value))}
                            />
                        </div>
                    </div>
                </div>

                {/* 3. Analysis Result */}
                <div className="grid grid-cols-2 gap-4">
                    <div className={`p-4 rounded-xl text-center ${profit > 0 ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                        <div className="text-xs opacity-70">กำไรต่อแก้ว (Profit)</div>
                        <div className="text-xl font-bold">฿{profit.toFixed(2)}</div>
                    </div>
                    <div className={`p-4 rounded-xl text-center ${costPercent <= 35 ? 'bg-blue-50 text-blue-800' : 'bg-orange-50 text-orange-800'}`}>
                        <div className="text-xs opacity-70">% ต้นทุน (Cost %)</div>
                        <div className="text-xl font-bold">{costPercent.toFixed(1)}%</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
