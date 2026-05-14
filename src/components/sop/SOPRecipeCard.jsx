import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Star } from 'lucide-react';
import { getActionByKey } from '../../hooks/useBarSOP';

/**
 * SOPRecipeCard — Expandable SOP recipe card
 * Dark theme for staff, light for admin preview
 * Designed for glanceability — large text, clear icons
 */
export default function SOPRecipeCard({ 
    recipe, 
    glassSizes = [], 
    scaleIngredients,
    darkMode = true,
    defaultExpanded = false 
}) {
    const isCustomMode = recipe?.scaling_rules?._mode === 'custom';
    const customPresets = isCustomMode ? (recipe?.scaling_rules?.presets || []) : [];

    const [expanded, setExpanded] = useState(defaultExpanded);
    const [selectedSizeOz, setSelectedSizeOz] = useState(
        isCustomMode 
            ? (customPresets.find(p => p.isBase)?.name || customPresets[0]?.name || 'Base')
            : (recipe?.base_glass_size_oz || 16)
    );

    // Reset selection if recipe changes
    React.useEffect(() => {
        if (isCustomMode) {
            setSelectedSizeOz(customPresets.find(p => p.isBase)?.name || customPresets[0]?.name || 'Base');
        } else {
            setSelectedSizeOz(recipe?.base_glass_size_oz || 16);
        }
    }, [recipe?.id, isCustomMode]);

    // Scale ingredients based on selected glass size
    const scaledIngredients = useMemo(() => {
        if (!scaleIngredients) return recipe?.display_ingredients || recipe?.ingredients || [];
        return scaleIngredients(recipe, selectedSizeOz);
    }, [recipe, selectedSizeOz, scaleIngredients]);

    const visibleIngredients = useMemo(() => scaledIngredients.filter(i => !i.isHidden), [scaledIngredients]);

    const steps = recipe?.steps || [];
    
    // Check if current selection is the base size
    const isBaseSize = isCustomMode 
        ? (customPresets.find(p => p.name === selectedSizeOz)?.isBase === true)
        : (selectedSizeOz === (recipe?.base_glass_size_oz || 16));

    // Theme classes
    const t = darkMode ? {
        card: 'bg-[#1A1A1A] border-[#2A2A2A]',
        cardHover: 'hover:bg-[#222222]',
        cardExpanded: 'bg-gradient-to-b from-[#1E1E1E] to-[#111111] border-[#333333] shadow-2xl',
        text: 'text-[#CCCCCC]',
        textMuted: 'text-[#666666]',
        textBright: 'text-[#FFFFFF]',
        accent: 'text-[#DFFF00]',
        accentBg: 'bg-[#DFFF00]/10 border border-[#DFFF00]/20',
        divider: 'border-[#2A2A2A]',
        badge: 'bg-[#222222] text-[#888888] group-hover:bg-[#333333]',
        badgeActive: 'bg-[#DFFF00] text-[#0D0D0D]',
        stepBg: 'bg-gradient-to-br from-[#1A1A1A] to-transparent border border-[#2A2A2A]',
        sectionLabel: 'text-[#777777] flex items-center gap-2',
        ingredientRow: 'border-dashed border-[#333333]',
        scaledHighlight: 'text-[#DFFF00] font-bold drop-shadow-[0_0_8px_rgba(223,255,0,0.25)]',
        glassPill: 'text-[#888888] hover:text-white',
        glassPillActive: 'bg-[#DFFF00] text-[#0D0D0D] font-bold shadow-[0_0_12px_rgba(223,255,0,0.3)] rounded-md',
    } : {
        card: 'bg-white border-gray-200',
        cardHover: 'hover:bg-gray-50',
        cardExpanded: 'bg-white border-gray-300 shadow-xl',
        text: 'text-gray-700',
        textMuted: 'text-gray-400',
        textBright: 'text-gray-900',
        accent: 'text-purple-600',
        accentBg: 'bg-purple-50 border border-purple-100',
        divider: 'border-gray-200',
        badge: 'bg-gray-100 text-gray-500 group-hover:bg-gray-200',
        badgeActive: 'bg-purple-600 text-white',
        stepBg: 'bg-gray-50 border border-gray-100',
        sectionLabel: 'text-gray-400 flex items-center gap-2',
        ingredientRow: 'border-dashed border-gray-200',
        scaledHighlight: 'text-purple-600 font-bold drop-shadow-sm',
        glassPill: 'text-gray-500 hover:text-gray-800',
        glassPillActive: 'bg-white text-purple-700 font-bold shadow-sm rounded-md border border-gray-200',
    };

    return (
        <div className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
            expanded ? t.cardExpanded : `${t.card} ${t.cardHover}`
        }`}>
            {/* Collapsed Header — always visible */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full text-left px-5 py-4 flex items-center justify-between gap-3 active:scale-[0.99] transition-transform"
            >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Category Icon */}
                    <span className="text-2xl flex-shrink-0 select-none">
                        {recipe?.category?.icon || '📋'}
                    </span>
                    <div className="min-w-0 flex-1">
                        <h3 className={`font-bold text-lg leading-tight truncate ${t.textBright}`}>
                            {recipe?.name || 'Untitled'}
                        </h3>
                        <div className={`flex items-center gap-2 mt-0.5 text-xs ${t.textMuted}`}>
                            <span>{isCustomMode ? 'Custom Prep' : `${recipe?.base_glass_size_oz || 16}oz`}</span>
                            <span>•</span>
                            <span>{steps.length} steps</span>
                            {recipe?.garnish && (
                                <>
                                    <span>•</span>
                                    <span className="truncate">{recipe.garnish}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${t.badge}`}>
                    {expanded 
                        ? <ChevronUp size={18} /> 
                        : <ChevronDown size={18} />
                    }
                </div>
            </button>

            {/* Expanded Content */}
            {expanded && (
                <div className="px-5 pb-5 space-y-4 animate-fade-in">
                    {/* Size Selector (Segmented Control) */}
                    {(isCustomMode ? customPresets.length > 0 : glassSizes.length > 0) && (
                        <div>
                            <div className={`text-[10px] uppercase tracking-widest font-bold mb-3 ${t.sectionLabel}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-[#DFFF00] opacity-50"></span>
                                {isCustomMode ? 'ตัวเลือกขนาด / Size' : 'ขนาดแก้ว / Glass Size'}
                            </div>
                            <div className={`p-1 rounded-lg inline-flex ${darkMode ? 'bg-[#0A0A0A] border border-[#222] shadow-inner' : 'bg-gray-100 border border-gray-200'}`}>
                                {isCustomMode ? (
                                    customPresets.map((preset, idx) => {
                                        const isActive = preset.name === selectedSizeOz;
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => setSelectedSizeOz(preset.name)}
                                                className={`px-4 py-2 text-sm transition-all duration-300 flex items-center gap-1.5 ${
                                                    isActive ? t.glassPillActive : t.glassPill
                                                }`}
                                            >
                                                {preset.name}
                                                {preset.isBase && <Star size={10} className={isActive ? "opacity-60" : "opacity-40"} />}
                                            </button>
                                        );
                                    })
                                ) : (
                                    glassSizes.map(gs => {
                                        const isBase = gs.size_oz === recipe.base_glass_size_oz;
                                        const isAvailable = isBase || recipe?.scaling_rules?.[String(gs.size_oz)] !== undefined;
                                        if (!isAvailable) return null; // Only show available sizes
                                        
                                        const isActive = gs.size_oz === selectedSizeOz;
                                        return (
                                            <button
                                                key={gs.id}
                                                onClick={() => setSelectedSizeOz(gs.size_oz)}
                                                className={`px-4 py-2 text-sm transition-all duration-300 flex items-center gap-1.5 ${
                                                    isActive ? t.glassPillActive : t.glassPill
                                                }`}
                                            >
                                                <span className={isActive ? 'text-lg' : ''}>{gs.size_oz}</span><span className="text-[10px] uppercase">oz</span>
                                                {isBase && <Star size={10} className={isActive ? "opacity-60" : "opacity-40"} />}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {/* Divider */}
                    <div className={`border-t border-dashed ${t.divider}`} />

                    {/* Ingredients (Menu Style) */}
                    {visibleIngredients.length > 0 && (
                        <div>
                            <div className={`text-[10px] uppercase tracking-widest font-bold mb-4 flex items-center justify-between ${t.sectionLabel}`}>
                                <span>📦 ส่วนผสม / INGREDIENTS</span>
                                {!isBaseSize && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${t.accentBg} ${t.accent}`}>
                                        SCALED TO {isCustomMode ? selectedSizeOz : `${selectedSizeOz}oz`}
                                    </span>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                {visibleIngredients.map((ing, i) => (
                                    <div 
                                        key={i} 
                                        className="flex items-end justify-between group"
                                    >
                                        <span className={`text-[15px] tracking-wide ${t.textBright}`}>
                                            {ing.name}
                                        </span>
                                        <div className={`flex-1 mx-3 mb-1.5 border-b ${t.ingredientRow} group-hover:border-[#555] transition-colors`} />
                                        <span className={`text-sm tabular-nums font-mono ${
                                            ing.isScaled ? t.scaledHighlight : t.textBright
                                        }`}>
                                            {ing.scaledQty ?? ing.qty} <span className={`text-[10px] uppercase ml-0.5 ${t.textMuted}`}>{ing.unit}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Steps (Vertical Timeline) */}
                    {steps.length > 0 && (
                        <div className="mt-6">
                            <div className={`text-[10px] uppercase tracking-widest font-bold mb-6 ${t.sectionLabel}`}>
                                📋 ขั้นตอน / METHOD
                            </div>
                            <div className={`relative ml-3 pl-6 border-l-2 space-y-6 pb-2 ${darkMode ? 'border-[#333333]' : 'border-gray-200'}`}>
                                {steps.map((step, i) => {
                                    const action = getActionByKey(step.action);
                                    return (
                                        <div key={i} className="relative">
                                            {/* Glowing Node */}
                                            <div className={`absolute -left-[35px] top-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold z-10 ${
                                                darkMode 
                                                ? 'bg-[#1A1A1A] border-2 border-[#DFFF00] text-[#DFFF00] shadow-[0_0_10px_rgba(223,255,0,0.3)]'
                                                : 'bg-white border-2 border-purple-600 text-purple-600 shadow-sm'
                                            }`}>
                                                {i + 1}
                                            </div>
                                            
                                            {/* Content Card */}
                                            <div className={`p-4 rounded-xl ${t.stepBg}`}>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-xl drop-shadow-md">{action.icon}</span>
                                                    <span className={`font-bold text-[13px] uppercase tracking-widest ${t.accent}`}>{action.label}</span>
                                                </div>
                                                {step.instruction && (
                                                    <p className={`text-sm leading-relaxed ${t.textBright}`}>
                                                        {step.instruction}
                                                        {step.ingredient_ref && (
                                                            <span className="ml-2 font-bold whitespace-nowrap">
                                                                {(() => {
                                                                    const linkedIng = scaledIngredients.find(ing => ing.name === step.ingredient_ref);
                                                                    if (linkedIng) {
                                                                        return (
                                                                            <span className={linkedIng.isScaled ? t.scaledHighlight : t.accent}>
                                                                                ({linkedIng.scaledQty ?? linkedIng.qty} <span className="text-[10px] uppercase opacity-80">{linkedIng.unit}</span>)
                                                                            </span>
                                                                        );
                                                                    }
                                                                    return null;
                                                                })()}
                                                            </span>
                                                        )}
                                                    </p>
                                                )}
                                                {step.duration_sec && (
                                                    <div className={`mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${
                                                        darkMode ? 'bg-black/60 border-[#333333]' : 'bg-white border-gray-200'
                                                    }`}>
                                                        <span className="text-[10px]">⏱</span>
                                                        <span className={`text-xs font-mono font-bold ${t.accent}`}>{step.duration_sec}s</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Garnish */}
                    {recipe?.garnish && (
                        <div className={`flex items-center gap-2 p-3 rounded-xl ${t.stepBg}`}>
                            <span className="text-lg select-none">🎀</span>
                            <div>
                                <span className={`text-[10px] uppercase tracking-wider font-bold ${t.sectionLabel}`}>
                                    ตกแต่ง
                                </span>
                                <p className={`text-sm ${t.text}`}>{recipe.garnish}</p>
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    {recipe?.notes && (
                        <div className={`text-xs p-3 rounded-xl ${t.stepBg} ${t.textMuted}`}>
                            💡 {recipe.notes}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
