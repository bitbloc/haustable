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
    const [expanded, setExpanded] = useState(defaultExpanded);
    const [selectedSizeOz, setSelectedSizeOz] = useState(recipe?.base_glass_size_oz || 16);

    // Scale ingredients based on selected glass size
    const scaledIngredients = useMemo(() => {
        if (!scaleIngredients) return recipe?.display_ingredients || recipe?.ingredients || [];
        return scaleIngredients(recipe, selectedSizeOz);
    }, [recipe, selectedSizeOz, scaleIngredients]);

    const visibleIngredients = useMemo(() => scaledIngredients.filter(i => !i.isHidden), [scaledIngredients]);

    const steps = recipe?.steps || [];
    const isBaseSize = selectedSizeOz === (recipe?.base_glass_size_oz || 16);

    // Theme classes
    const t = darkMode ? {
        card: 'bg-[#1A1A1A] border-[#2A2A2A]',
        cardHover: 'hover:bg-[#222222]',
        cardExpanded: 'bg-[#1A1A1A] border-[#333333]',
        text: 'text-[#E5E5E5]',
        textMuted: 'text-[#888888]',
        textBright: 'text-white',
        accent: 'text-[#DFFF00]',
        accentBg: 'bg-[#DFFF00]/10',
        divider: 'border-[#2A2A2A]',
        badge: 'bg-[#2A2A2A] text-[#CCCCCC]',
        badgeActive: 'bg-[#DFFF00] text-[#0D0D0D]',
        stepBg: 'bg-[#111111]',
        sectionLabel: 'text-[#666666]',
        ingredientRow: 'border-[#222222]',
        scaledHighlight: 'text-[#DFFF00] font-bold',
        glassPill: 'bg-[#2A2A2A] text-[#999999] border-[#333333]',
        glassPillActive: 'bg-[#DFFF00] text-[#0D0D0D] border-[#DFFF00] font-bold',
    } : {
        card: 'bg-white border-gray-200',
        cardHover: 'hover:bg-gray-50',
        cardExpanded: 'bg-white border-gray-300',
        text: 'text-gray-800',
        textMuted: 'text-gray-500',
        textBright: 'text-gray-900',
        accent: 'text-purple-600',
        accentBg: 'bg-purple-50',
        divider: 'border-gray-200',
        badge: 'bg-gray-100 text-gray-600',
        badgeActive: 'bg-purple-600 text-white',
        stepBg: 'bg-gray-50',
        sectionLabel: 'text-gray-400',
        ingredientRow: 'border-gray-100',
        scaledHighlight: 'text-purple-600 font-bold',
        glassPill: 'bg-gray-100 text-gray-600 border-gray-200',
        glassPillActive: 'bg-purple-600 text-white border-purple-600 font-bold',
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
                            <span>{recipe?.base_glass_size_oz || 16}oz</span>
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
                    {/* Glass Size Selector */}
                    {glassSizes.length > 0 && (
                        <div>
                            <div className={`text-[10px] uppercase tracking-wider font-bold mb-2 ${t.sectionLabel}`}>
                                ขนาดแก้ว / Glass Size
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                {glassSizes.map(gs => {
                                    const isActive = gs.size_oz === selectedSizeOz;
                                    const isDefault = gs.size_oz === (recipe?.base_glass_size_oz || 16);
                                    return (
                                        <button
                                            key={gs.id}
                                            onClick={() => setSelectedSizeOz(gs.size_oz)}
                                            className={`px-3 py-1.5 rounded-full text-sm border transition-all flex items-center gap-1 ${
                                                isActive ? t.glassPillActive : t.glassPill
                                            }`}
                                        >
                                            {gs.size_oz}oz
                                            {isDefault && <Star size={10} className="opacity-60" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Divider */}
                    <div className={`border-t ${t.divider}`} />

                    {/* Ingredients */}
                    {visibleIngredients.length > 0 && (
                        <div>
                            <div className={`text-[10px] uppercase tracking-wider font-bold mb-2 flex items-center gap-2 ${t.sectionLabel}`}>
                                📦 ส่วนผสม
                                {!isBaseSize && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${t.accentBg} ${t.accent}`}>
                                        {selectedSizeOz}oz
                                    </span>
                                )}
                            </div>
                            <div className="space-y-0">
                                {visibleIngredients.map((ing, i) => (
                                    <div 
                                        key={i} 
                                        className={`flex items-center justify-between py-2 border-b last:border-0 ${t.ingredientRow}`}
                                    >
                                        <span className={`text-sm ${t.text}`}>
                                            {ing.name}
                                        </span>
                                        <span className={`text-sm tabular-nums font-mono ${
                                            ing.isScaled ? t.scaledHighlight : t.text
                                        }`}>
                                            {ing.scaledQty ?? ing.qty} {ing.unit}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Steps */}
                    {steps.length > 0 && (
                        <div>
                            <div className={`text-[10px] uppercase tracking-wider font-bold mb-2 ${t.sectionLabel}`}>
                                📋 ขั้นตอน
                            </div>
                            <div className="space-y-2">
                                {steps.map((step, i) => {
                                    const action = getActionByKey(step.action);
                                    return (
                                        <div 
                                            key={i}
                                            className={`flex items-start gap-3 p-3 rounded-xl ${t.stepBg}`}
                                        >
                                            {/* Step number */}
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${t.badgeActive}`}>
                                                {i + 1}
                                            </div>
                                            {/* Action icon */}
                                            <span className="text-xl flex-shrink-0 select-none mt-0.5" title={action.label}>
                                                {action.icon}
                                            </span>
                                            {/* Instruction */}
                                            <div className="flex-1 min-w-0">
                                                <div className={`text-sm leading-relaxed ${t.text}`}>
                                                    <span className="font-bold mr-2">{action.label}</span>
                                                    {step.instruction && <span>{step.instruction}</span>}
                                                </div>
                                                {step.duration_sec && (
                                                    <span className={`block text-xs mt-0.5 ${t.textMuted}`}>
                                                        ⏱ {step.duration_sec}s
                                                    </span>
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
