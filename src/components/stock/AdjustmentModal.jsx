import React, { useState, useEffect } from 'react';
import { X, Minus, Plus, Save, Package, Settings } from 'lucide-react'; // Added Settings
import { toast } from 'sonner';
import LiquidLevelSlider from './LiquidLevelSlider';

export default function AdjustmentModal({ item, onClose, onUpdate, onEdit }) { // Added onEdit
    const [amount, setAmount] = useState('');
    const [mode, setMode] = useState('in'); // 'in' or 'out'
    const [selectedUnit, setSelectedUnit] = useState(null); // The unit key from unit_config
    const [unitOptions, setUnitOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Liquid Slider State
    const [showLiquidSlider, setShowLiquidSlider] = useState(false);
    const [liquidPercent, setLiquidPercent] = useState(50); // Default 50%

    useEffect(() => {
        if (item) {
            // Is this a liquid/estimate item?
            // Simple heuristic for now: unit contains 'bottle' or category is 'sauce'/'spirits'
            const isLiquid = item.category === 'sauce' || item.unit.toLowerCase().includes('bottle') || item.unit.toLowerCase().includes('l');
            setShowLiquidSlider(isLiquid);
            
            // ... rest of init logic
            // Structure: { "carton": {"factor": 12, "unit": "bottle"}, ... }
            let options = [];
            
            // Add Base Unit (stock_items.unit) as default option 1
            options.push({
                key: 'base',
                label: item.unit, // e.g., 'Bottle'
                factor: 1
            });

            // Add configured units
            if (item.unit_config) {
                Object.entries(item.unit_config).forEach(([key, config]) => {
                    options.push({
                        key: key,
                        label: config.unit_label || key, // Use label if exists, else key
                        factor: config.factor
                    });
                });
            }

            setUnitOptions(options);
            setSelectedUnit(options[0]); // Default to base
            setAmount('');
        }
    }, [item]);

    const handleSave = async () => {
        if (!amount && !showLiquidSlider) return; // If normal mode, need amount
        if (showLiquidSlider && mode === 'count_update') {
             // Logic for liquid update? 
             // Actually, liquid slider is usually for "remaining in bottle".
             // If we use slider, we might be setting the absolute quantity or creating a transaction based on diff.
             // PHASE 2: "Liquid Scale UI: Slider for estimating remaining liquid"
             // Usually this implies: "I have 0.5 bottles left".
             // So input is 0.5.
        }
        
        // MIXED MODE LOGIC:
        // If Slider is active, we treat the 'amount' as derived from slider?
        // OR does the slider auto-fill the input?
        // Let's make Slider auto-fill the 'amount' input with decimal.
        
        if (!amount || parseFloat(amount) <= 0) return;
        if (!selectedUnit) return;

        setLoading(true);
        const inputVal = parseFloat(amount);
        
        // Calculate actual change in Base Unit
        const actualChange = inputVal * selectedUnit.factor;
        const finalChange = mode === 'in' ? actualChange : -actualChange;
        
        // Prevent negative stock? (Optional, maybe allow for correction)
        // if (mode === 'out' && item.current_quantity + finalChange < 0) ...

        try {
            await onUpdate(item.id, finalChange, mode, {
                note: `Manual ${mode.toUpperCase()} via App (${inputVal} ${selectedUnit.label})`
            });
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Failed to update stock');
        } finally {
            setLoading(false);
        }
    };

    const quickAdd = (val) => {
        const current = amount ? parseFloat(amount) : 0;
        setAmount((current + val).toString());
    };

    if (!item) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                
                {/* Image Header */}
                <div className="relative h-48 bg-gray-100 flex items-center justify-center">
                    {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                        <Package className="w-16 h-16 text-gray-300" />
                    )}
                    
                    <div className="absolute top-4 right-4 z-10 flex gap-2">
                     <button 
                        onClick={onEdit}
                        className="w-10 h-10 bg-black/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/40 transition-colors"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={onClose}
                        className="w-10 h-10 bg-black/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/40 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
                    
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-6 pt-12">
                        <h2 className="text-white text-2xl font-bold leading-tight">{item.name}</h2>
                        <div className="text-white/80 text-sm font-medium flex gap-2">
                             <span>Current: {item.current_quantity?.toLocaleString()} {item.unit}</span>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 flex-1 overflow-y-auto">
                    
                    {/* Action Tabs */}
                    <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
                        <button 
                            onClick={() => setMode('in')}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'in' ? 'bg-white shadow text-green-600' : 'text-gray-400'}`}
                        >
                            + รับเข้า (IN)
                        </button>
                        <button 
                            onClick={() => setMode('out')}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'out' ? 'bg-white shadow text-red-600' : 'text-gray-400'}`}
                        >
                            - เบิกออก (OUT)
                        </button>
                    </div>

                    {/* Unit Selector */}
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Select Unit</label>
                        <div className="grid grid-cols-2 gap-2">
                            {unitOptions.map((opt) => (
                                <button
                                    key={opt.key}
                                    onClick={() => setSelectedUnit(opt)}
                                    className={`
                                        py-2 px-3 rounded-xl border text-sm font-bold transition-all text-left flex justify-between items-center
                                        ${selectedUnit?.key === opt.key ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'}
                                    `}
                                >
                                    <span>{opt.label}</span>
                                    {opt.factor !== 1 && <span className="text-[10px] opacity-60">x{opt.factor}</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Slider Section for Liquids */}
                    {showLiquidSlider && mode === 'in' && (
                         <div className="mb-6 bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-4 items-center">
                             <LiquidLevelSlider 
                                value={liquidPercent} 
                                onChange={(val) => {
                                    setLiquidPercent(val);
                                    // Auto-convert % to decimal amount
                                    // e.g., 50% = 0.5
                                    setAmount((val / 100).toString());
                                }} 
                             />
                             <div className="flex-1 text-sm text-blue-800">
                                 <h4 className="font-bold mb-1">Estimate Remaining</h4>
                                 <p className="leading-tight opacity-80">
                                     Use slider to estimate partial bottle content. <br/>
                                     (e.g., 50% = 0.5 Bottle)
                                 </p>
                             </div>
                         </div>
                    )}

                    {/* Input Numpad Area */}
                    <div className="flex gap-3 mb-6">
                        <button 
                            onClick={() => {
                                const val = parseFloat(amount || 0);
                                if (val > 0) setAmount((val - 1).toString());
                            }}
                            className="w-14 h-14 rounded-2xl border-2 border-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-50 active:scale-95 transition-all"
                        >
                            <Minus className="w-6 h-6" />
                        </button>
                        
                        <div className="flex-1 relative">
                            <input 
                                type="number" 
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0"
                                className="w-full h-14 bg-gray-50 rounded-2xl text-center text-3xl font-bold text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#1A1A1A] transition-all"
                                autoFocus
                            />
                        </div>

                        <button 
                            onClick={() => quickAdd(1)}
                            className="w-14 h-14 rounded-2xl border-2 border-gray-100 flex items-center justify-center text-[#1A1A1A] hover:bg-gray-50 active:scale-95 transition-all"
                        >
                            <Plus className="w-6 h-6" />
                        </button>
                    </div>
                    
                    {/* Quick Options */}
                    <div className="flex gap-2 justify-center mb-6">
                        {[5, 10, 20].map(val => (
                            <button 
                                key={val}
                                onClick={() => quickAdd(val)}
                                className="px-4 py-1.5 rounded-full bg-gray-100 text-xs font-bold text-gray-500 hover:bg-gray-200 transition-colors"
                            >
                                +{val}
                            </button>
                        ))}
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50">
                    <button 
                        onClick={handleSave}
                        disabled={loading || !amount || parseFloat(amount) <= 0}
                        className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 text-white font-bold text-lg shadow-lg transition-all active:scale-95 ${
                            loading ? 'bg-gray-400' : mode === 'in' ? 'bg-[#1A1A1A] hover:bg-gray-900' : 'bg-red-600 hover:bg-red-700'
                        }`}
                    >
                        {loading ? 'Saving...' : (
                            <>
                                <Save className="w-5 h-5" />
                                Confirm {mode === 'in' ? 'Check-in' : 'Withdraw'}
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}
