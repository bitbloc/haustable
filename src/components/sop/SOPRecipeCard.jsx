import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Star } from 'lucide-react';
import { getActionByKey } from '../../hooks/useBarSOP';
import { defaultSweetLevel, factorPercent } from '../../utils/sopLinks';

// Sweetness of an SOP that is not linked to a menu (its own table, 4 fixed levels)
const LEGACY_SWEET = [
    { key: '0%', label: 'ไม่หวาน', sub: '0%' },
    { key: '50%', label: 'หวานน้อย', sub: '50%' },
    { key: '100%', label: 'หวานปกติ', sub: '100%' },
    { key: '120%', label: 'หวานมาก', sub: '120%' }
];

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
    const customPresets = useMemo(() => {
        return isCustomMode ? (recipe?.scaling_rules?.presets || []) : [];
    }, [isCustomMode, recipe?.scaling_rules?.presets]);

    // Linked to a menu: the levels are the menu's sweetness choices (the same ones a sale deducts by)
    const menuLevels = Array.isArray(recipe?.sweetness_levels) ? recipe.sweetness_levels : null;
    const sweetOptions = useMemo(() => (menuLevels
        ? menuLevels.map(l => ({ key: l.id, label: l.label, sub: factorPercent(l.factor) }))
        : LEGACY_SWEET), [menuLevels]);
    const baseSweet = menuLevels ? (defaultSweetLevel(menuLevels)?.id ?? null) : '100%';

    const [expanded, setExpanded] = useState(defaultExpanded);
    const [cups, setCups] = useState(1);
    const [sweetness, setSweetness] = useState(baseSweet);
    const [selectedSizeOz, setSelectedSizeOz] = useState(
        isCustomMode 
            ? (customPresets.find(p => p.isBase)?.name || customPresets[0]?.name || 'Base')
            : (recipe?.base_glass_size_oz || 16)
    );

    // Reset selection if recipe changes
    React.useEffect(() => {
        setCups(1);
        setSweetness(baseSweet);
        if (isCustomMode) {
            setSelectedSizeOz(customPresets.find(p => p.isBase)?.name || customPresets[0]?.name || 'Base');
        } else {
            setSelectedSizeOz(recipe?.base_glass_size_oz || 16);
        }
    }, [recipe?.id, isCustomMode, customPresets, recipe?.base_glass_size_oz, baseSweet]);

    // Scale ingredients based on selected glass size, cups and sweetness
    const scaledIngredients = useMemo(() => {
        if (!scaleIngredients) return recipe?.display_ingredients || recipe?.ingredients || [];
        return scaleIngredients(recipe, selectedSizeOz, cups, sweetness);
    }, [recipe, selectedSizeOz, scaleIngredients, cups, sweetness]);

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
        cardExpanded: 'bg-[#181818] border-[#333333]',
        text: 'text-[#CCCCCC]',
        textMuted: 'text-[#666666]',
        textBright: 'text-[#FFFFFF]',
        accent: 'text-[var(--on-plum-2)]',
        accentBg: 'bg-[var(--brand-plum)]/40 border border-[var(--brand-plum-3)]',
        sweetAccent: 'text-[#FF9F00]',
        sweetAccentBg: 'bg-[#FF9F00]/10 border border-[#FF9F00]/20',
        divider: 'border-[#2A2A2A]',
        badge: 'bg-[#222222] text-[#888888] group-hover:bg-[#333333]',
        badgeActive: 'bg-[var(--brand-plum)] text-[var(--cream)]',
        stepBg: 'bg-[#161616] border border-[#2A2A2A]',
        sectionLabel: 'text-[#777777] flex items-center gap-2',
        ingredientRow: 'border-dashed border-[#333333]',
        scaledHighlight: 'text-[var(--on-plum-2)] font-bold',
        sweetScaledHighlight: 'text-[#FF9F00] font-bold drop-shadow-[0_0_8px_rgba(255,159,0,0.25)]',
        glassPill: 'text-[#888888] hover:text-[var(--color-paper)]',
        glassPillActive: 'bg-[var(--brand-plum)] text-[var(--cream)] font-bold rounded-md',
        sweetPillActive: 'bg-[#FF9F00] text-[#0D0D0D] font-bold shadow-[0_0_12px_rgba(255,159,0,0.3)] rounded-md',
    } : {
        // Staff screens: achromatic ledger. Ink and grey only; clay marks what the sweetness setting changed.
        card: 'bg-[var(--color-paper)] border-[var(--color-paper-3)]',
        cardHover: 'hover:border-[var(--color-ink)]',
        cardExpanded: 'bg-[var(--color-paper)] border-[oklch(82%_0.012_348.33)]',
        text: 'text-[var(--color-muted)]',
        textMuted: 'text-[var(--color-neutral)]',
        textBright: 'text-[var(--color-ink)]',
        accent: 'text-[var(--color-ink)]',
        accentBg: 'bg-[var(--color-paper-2)] border border-[var(--color-paper-3)]',
        sweetAccent: 'text-[var(--color-plum)]',
        sweetAccentBg: 'bg-[var(--color-paper-2)]',
        divider: 'border-[var(--color-paper-2)]',
        badge: 'text-[var(--color-muted)]',
        badgeActive: 'text-[var(--color-ink)]',
        stepBg: 'bg-[oklch(96%_0.005_110)]',
        sectionLabel: 'text-[var(--color-muted)] flex items-center gap-2 text-xs',
        ingredientRow: 'border-dotted border-[oklch(82%_0.012_348.33)]',
        scaledHighlight: 'text-[var(--color-ink)] font-semibold',
        sweetScaledHighlight: 'bg-[var(--color-paper-2)] text-[var(--color-plum)] px-1 rounded-xs font-semibold',
        glassPill: 'text-[var(--color-muted)] hover:text-[var(--color-ink)]',
        glassPillActive: 'bg-[var(--color-ink)] text-[var(--color-paper)] font-medium rounded-md',
        sweetPillActive: 'bg-[var(--color-ink)] text-[var(--color-paper)] font-medium rounded-md',
    };

    return (
        <div className={`rounded-lg border transition-colors duration-200 overflow-hidden ${
            expanded ? `${t.cardExpanded} md:col-span-2` : `${t.card} ${t.cardHover}`
        }`}>
            {/* Collapsed Header — always visible */}
            <button
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
                className={`w-full text-left flex items-center justify-between gap-3 active:scale-[0.99] transition-transform ${darkMode ? 'px-5 py-4' : 'px-4 py-3 min-h-[72px] cursor-pointer'}`}
            >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Category Icon */}
                    {darkMode && (
                        <span className="text-2xl flex-shrink-0 select-none">
                            {recipe?.category?.icon || ''}
                        </span>
                    )}
                    <div className="min-w-0 flex-1">
                        <h3 className={`${darkMode ? 'font-bold text-lg leading-tight' : 'font-semibold text-base leading-[1.6]'} truncate ${t.textBright}`}>
                            {recipe?.name || 'Untitled'}
                        </h3>
                        <div className={`flex items-center gap-2 mt-0.5 text-xs tabular-nums ${t.textMuted}`}>
                            {recipe?.advanced_details?.prep_time && <span className="px-2 py-0.5 rounded-xs tabular-nums bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[var(--color-ink)] font-bold">เตรียม {recipe.advanced_details.prep_time}</span>}
                            {recipe?.advanced_details?.ice_level && <span className="px-2 py-0.5 rounded-xs tabular-nums bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[var(--color-ink)] font-bold">น้ำแข็ง {recipe.advanced_details.ice_level}</span>}
                            {!recipe?.advanced_details?.prep_time && <span className="whitespace-nowrap">{isCustomMode ? 'ขนาดกำหนดเอง' : `${recipe?.base_glass_size_oz || 16} oz`}</span>}
                            <span>·</span>
                            <span className="whitespace-nowrap">{steps.length > 0 ? `${steps.length} ขั้นตอน` : 'ยังไม่มีขั้นตอน'}</span>
                            {recipe?.garnish && (
                                <>
                                    <span>·</span>
                                    <span className="truncate">แต่งแก้ว {recipe.garnish}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                {darkMode ? (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${t.badge}`}>
                        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                ) : (
                    <span className={`flex-shrink-0 text-sm ${t.badge}`}>{expanded ? 'ปิด' : 'ดูสูตร'}</span>
                )}
            </button>

            {/* Profile Description */}
            {expanded && recipe?.advanced_details?.profile && (
                <div className="px-5 pb-3 animate-fade-in">
                    <div className={`text-sm border-l-2 pl-3 py-1 ${darkMode ? 'italic border-[var(--on-plum-2)] text-[var(--color-neutral)]' : 'border-[oklch(82%_0.012_348.33)] text-[var(--color-muted)]'}`}>
                        {recipe.advanced_details.profile}
                    </div>
                </div>
            )}

            {/* Expanded Content */}
            {expanded && (
                <div className="px-5 pb-5 space-y-4 animate-fade-in">
                    {/* Size Selector (Segmented Control) */}
                    <div className="flex flex-wrap gap-4 items-end">
                        {(isCustomMode ? customPresets.length > 0 : glassSizes.length > 0) && (
                            <div>
                                <div className={`text-xs font-bold mb-3 ${t.sectionLabel}`}>
                                    {darkMode && <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-plum)] opacity-50"></span>}
                                    {isCustomMode ? 'ขนาด' : 'ขนาดแก้ว'}
                                </div>
                                <div className={`p-1 rounded-lg inline-flex flex-wrap gap-1 ${darkMode ? 'bg-[#0A0A0A] border border-[#222] shadow-inner' : 'bg-[oklch(96%_0.005_110)] border border-[var(--color-paper-3)]'}`}>
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
                                                    {preset.isBase && (darkMode ? <Star size={10} className={isActive ? "opacity-60" : "opacity-40"} /> : <span className="text-xs opacity-70">สูตรหลัก</span>)}
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
                                                    <span className={isActive ? 'text-lg' : ''}>{gs.size_oz}</span><span className="text-xs ">oz</span>
                                                    {isBase && (darkMode ? <Star size={10} className={isActive ? "opacity-60" : "opacity-40"} /> : <span className="text-xs opacity-70">สูตรหลัก</span>)}
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Cups Multiplier */}
                        <div className="flex-1 min-w-[200px]">
                            <div className={`text-xs font-bold mb-3 ${t.sectionLabel}`}>
                                จำนวนแก้ว
                            </div>
                            <div className={`p-1 rounded-lg flex flex-wrap gap-1 ${darkMode ? 'bg-[#0A0A0A] border border-[#222] shadow-inner' : 'bg-[oklch(96%_0.005_110)] border border-[var(--color-paper-3)]'}`}>
                                {[1, 2, 3, 4, 5].map(num => (
                                    <button
                                        key={num}
                                        onClick={() => setCups(num)}
                                        className={`flex-1 min-w-[36px] h-9 text-sm transition-all duration-300 flex items-center justify-center rounded-md ${
                                            cups === num ? t.glassPillActive : t.glassPill
                                        }`}
                                    >
                                        <span className={cups === num ? 'text-lg font-bold' : ''}>{num}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Sweetness Selector: only when the recipe has something to sweeten with,
                        otherwise the levels change nothing on screen. For a menu-linked SOP the levels
                        are the menu's own sweetness choices, so the sheet matches what a sale deducts. */}
                    {visibleIngredients.some(i => i.is_sweetener) && sweetOptions.length > 0 && (
                    <div>
                        <div className={`text-xs tabular-nums font-bold mb-2 ${t.sectionLabel}`}>
                            ระดับความหวาน
                        </div>
                        <div className="p-1 rounded bg-[var(--color-paper-2)] border border-[var(--color-rule)] inline-flex flex-wrap gap-1">
                            {sweetOptions.map(opt => {
                                const isActive = sweetness === opt.key;
                                return (
                                    <button
                                        key={opt.key}
                                        type="button"
                                        onClick={() => setSweetness(opt.key)}
                                        aria-pressed={isActive}
                                        className={`px-3 py-1.5 text-xs tabular-nums font-bold transition-all flex items-center gap-1.5 cursor-pointer rounded-xs ${
                                            isActive
                                                ? 'bg-[var(--color-ink)] text-[var(--color-paper)] '
                                                : 'text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-3)]'
                                        }`}
                                    >
                                        <span>{opt.label}</span>
                                        <span className="text-xs opacity-70">({opt.sub})</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    )}

                    {/* Divider */}
                    <div className={`border-t border-dashed ${t.divider}`} />

                    {/* Equipment */}
                    {recipe?.advanced_details?.equipment?.length > 0 && (
                        <div className="mb-4">
                            <div className={`text-xs tabular-nums font-bold mb-2 ${t.sectionLabel}`}>
                                อุปกรณ์
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {(Array.isArray(recipe.advanced_details.equipment) ? recipe.advanced_details.equipment : [recipe.advanced_details.equipment]).map((eq, i) => (
                                    <span key={i} className="text-xs px-2.5 py-1 rounded-xs tabular-nums bg-[var(--color-paper-2)] text-[var(--color-ink)] border border-[var(--color-rule)]">
                                        {eq}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Ingredients (Menu Style) */}
                    {visibleIngredients.length > 0 && (
                        <div>
                            <div className={`text-xs tabular-nums font-bold mb-4 flex items-center justify-between ${t.sectionLabel}`}>
                                <span>ส่วนผสม</span>
                                {(!isBaseSize || cups > 1 || sweetness !== baseSweet) && (
                                    <div className="flex flex-wrap gap-1.5 tabular-nums">
                                        {(!isBaseSize || cups > 1) && (
                                            <span className="text-[11px] px-2 py-0.5 rounded-xs font-bold bg-[var(--color-paper-3)] text-[var(--color-ink)] border border-[var(--color-rule)]">
                                                ปรับตาม {cups > 1 ? `${cups} แก้ว ` : ''}({isCustomMode ? selectedSizeOz : `${selectedSizeOz} oz`})
                                            </span>
                                        )}
                                        {sweetness !== baseSweet && (
                                            <span className="text-[11px] px-2 py-0.5 rounded-xs font-bold bg-[oklch(95%_0.02_45)] text-[var(--brand-plum)] border border-[var(--color-rule)]">
                                                หวาน: {(() => { const o = sweetOptions.find(x => x.key === sweetness); return o ? `${o.label} (${o.sub})` : sweetness; })()}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                {visibleIngredients.map((ing, i) => (
                                    <div key={i} className="flex flex-col group">
                                        <div className="flex items-end justify-between">
                                            <span className={`text-[14px] font-medium tracking-wide ${t.textBright} flex items-center gap-1.5`}>
                                                <span>{ing.name}</span>
                                                {ing.is_sweetener && (
                                                    <span className="text-[11px] tabular-nums font-bold px-1.5 py-0.2 rounded-xs bg-[oklch(95%_0.02_45)] text-[var(--brand-plum)] border border-[var(--color-rule)]">
                                                        ให้ความหวาน
                                                    </span>
                                                )}
                                            </span>
                                            <div className={`flex-1 mx-3 mb-1.5 border-b ${t.ingredientRow} group-hover:border-[#555] transition-colors`} />
                                            <span className={`text-sm tabular-nums font-bold ${
                                                ing.isSweetScaled 
                                                    ? (darkMode ? 'text-[var(--brand-plum)]' : 'bg-[var(--color-paper-2)] text-[var(--color-plum)] px-1 rounded-xs') 
                                                    : ing.isScaled 
                                                        ? 'text-[var(--color-ink)]' 
                                                        : t.textBright
                                            }`}>
                                                {ing.scaledQty ?? ing.qty} <span className={`text-xs ml-0.5 ${t.textMuted}`}>{ing.unit}</span>
                                            </span>
                                        </div>
                                        {ing.remark && <div className="text-xs mt-0.5 text-[var(--color-neutral)]">{ing.remark}</div>}
                                    </div>
                                ))}
                            </div>

                            {/* Quick Sweetness Reference Table for Baristas: every level, at the chosen size */}
                            {visibleIngredients.some(i => i.is_sweetener) && sweetOptions.length > 0 && scaleIngredients && (() => {
                                const byLevel = sweetOptions.map(opt => ({ opt, rows: scaleIngredients(recipe, selectedSizeOz, 1, opt.key) }));
                                const sweeteners = visibleIngredients.filter(i => i.is_sweetener);
                                return (
                                <div className="mt-4 pt-3 border-t border-[var(--color-rule)]">
                                    <div className="text-xs tabular-nums font-medium text-[var(--color-muted)] mb-2 flex justify-between items-center gap-2">
                                        <span>ปริมาณตามระดับความหวาน</span>
                                        <span className="text-xs font-bold">ขนาด {selectedSizeOz}{isCustomMode ? '' : ' oz'} · 1 แก้ว</span>
                                    </div>
                                    <div className="overflow-x-auto border border-[var(--color-rule)] bg-[var(--color-paper)]">
                                        <table className="w-full text-center tabular-nums text-xs divide-y divide-[var(--color-rule)]">
                                            <thead>
                                                <tr className="bg-[var(--color-paper-2)] text-[var(--color-muted)] text-xs">
                                                    <th className="p-1.5 text-left pl-2.5">สารหวาน</th>
                                                    {sweetOptions.map(opt => (
                                                        <th key={opt.key} className={`p-1.5 ${sweetness === opt.key ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' : ''}`}>
                                                            {opt.label} ({opt.sub})
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[var(--color-paper-3)]">
                                                {sweeteners.map((sw, idx) => (
                                                    <tr key={idx}>
                                                        <td className="p-1.5 text-left pl-2.5 font-sans font-bold text-[var(--color-ink)] truncate max-w-[120px]">{sw.name}</td>
                                                        {byLevel.map(({ opt, rows }) => {
                                                            const hit = rows.find(r => r.name === sw.name && r.is_sweetener);
                                                            return (
                                                                <td key={opt.key} className={`p-1.5 tabular-nums ${sweetness === opt.key ? 'font-bold bg-[var(--color-paper-3)]/50' : ''}`}>
                                                                    {hit ? (hit.scaledQty ?? hit.qty) : '–'} {sw.unit}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {menuLevels && (
                                        <p className="mt-1.5 text-[11px] leading-4 text-[var(--color-neutral)]">
                                            ระดับและปริมาณเดียวกับที่ระบบตัดสต๊อกเมื่อขาย
                                        </p>
                                    )}
                                </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Steps (Vertical Timeline) */}
                    {steps.length > 0 && (
                        <div className="mt-6">
                            <div className={`text-xs tabular-nums font-bold mb-6 ${t.sectionLabel}`}>
                                ขั้นตอน
                            </div>
                            <div className={`relative ml-3 pl-6 border-l-2 space-y-6 pb-2 ${darkMode ? 'border-[#333333]' : 'border-[var(--color-paper-3)]'}`}>
                                {steps.map((step, i) => {
                                    const action = getActionByKey(step.action);
                                    return (
                                        <div key={i} className="relative">
                                            {/* Glowing Node */}
                                            <div className={`absolute -left-[35px] top-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-10 ${
                                                darkMode 
                                                ? 'bg-[#1A1A1A] border-2 border-[var(--on-plum-2)] text-[var(--on-plum-2)]'
                                                : 'bg-[var(--color-plum)] text-[var(--color-cream)] font-mono tabular-nums'
                                            }`}>
                                                {i + 1}
                                            </div>
                                            
                                            {/* Content Card */}
                                            <div className={`${darkMode ? 'p-4 rounded-xl' : 'p-3 rounded-lg'} ${t.stepBg}`}>
                                                <div className="flex items-center gap-2 mb-2">
                                                    {(darkMode || (action.key !== 'bullet' && step.title)) && (
                                                        <span className={`tabular-nums font-bold text-[11px] px-1.5 py-0.5 rounded-xs bg-[var(--color-paper-3)] text-[var(--color-ink)]  `}>
                                                            {darkMode ? (action.labelEn || action.label) : action.label}
                                                        </span>
                                                    )}
                                                    <span className={`font-bold text-[13px]   ${t.accent}`}>
                                                        {step.title ? step.title : action.label}
                                                    </span>
                                                </div>
                                                {step.instruction && (
                                                    <div className={`text-sm leading-relaxed ${t.textBright}`}>
                                                        <p>{step.instruction}</p>
                                                        {(() => {
                                                            const refs = step.ingredient_refs || (step.ingredient_ref ? [step.ingredient_ref] : []);
                                                            if (refs.length === 0) return null;
                                                            return (
                                                                <div className={`mt-2 font-bold flex flex-wrap gap-x-2 gap-y-1 items-center p-2 rounded-lg border ${darkMode ? 'bg-[var(--brand-plum)]/40 border-[var(--brand-plum-3)]' : 'bg-[var(--color-paper)] border-[var(--color-paper-3)]'}`}>
                                                                    {refs.map((ref, idx) => {
                                                                        const linkedIng = scaledIngredients.find(ing => ing.name === ref);
                                                                        if (!linkedIng) return null;
                                                                        return (
                                                                            <span key={idx} className={`inline-flex items-center ${
                                                                                linkedIng.isSweetScaled 
                                                                                    ? t.sweetScaledHighlight 
                                                                                    : linkedIng.isScaled 
                                                                                        ? t.scaledHighlight 
                                                                                        : t.accent
                                                                            }`}>
                                                                                {idx > 0 && <span className="mr-2 text-[var(--color-neutral)] font-normal">+</span>}
                                                                                {linkedIng.name} ({linkedIng.scaledQty ?? linkedIng.qty} <span className="text-xs opacity-80 ml-0.5">{linkedIng.unit}</span>)
                                                                            </span>
                                                                        );
                                                                    })}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                )}
                                                {step.key_points && (
                                                    <div className={`mt-3 border rounded-lg p-2.5 ${darkMode ? 'bg-[#1A1A1A] border-[var(--brand-plum-3)]' : 'bg-[var(--color-paper-2)] border-[var(--color-plum)]'}`}>
                                                        <div className={`text-xs tabular-nums font-bold mb-1 flex items-center gap-1 ${darkMode ? 'text-[var(--on-plum-2)]' : 'text-[var(--color-plum)]'}`}>
                                                            จุดสำคัญ
                                                        </div>
                                                        <p className={`text-[13px] ${darkMode ? 'text-[var(--color-neutral)]' : 'text-[var(--color-ink)]'}`}>{step.key_points}</p>
                                                    </div>
                                                )}
                                                {step.reason && (
                                                    <div className={`mt-2 text-xs tabular-nums pl-2 border-l ${darkMode ? 'italic text-[var(--color-neutral)] border-gray-600' : 'text-[var(--color-muted)] border-[oklch(82%_0.012_348.33)]'}`}>
                                                        เหตุผล: {step.reason}
                                                    </div>
                                                )}
                                                {step.duration_sec && (
                                                    <div className={`mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${
                                                        darkMode ? 'bg-black/60 border-[#333333]' : 'bg-[var(--color-paper)] border-[var(--color-paper-3)]'
                                                    }`}>
                                                        <span className={`text-xs tabular-nums font-bold ${t.accent}`}>{step.duration_sec} วินาที</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* PRO DETAILS SECTION */}
                    {(recipe?.advanced_details?.qc_standards?.length > 0 || 
                      recipe?.advanced_details?.troubleshooting?.length > 0 || 
                      recipe?.advanced_details?.shelf_life?.length > 0 || 
                      recipe?.advanced_details?.checklist?.length > 0) && (
                        <div className={`mt-6 pt-6 border-t border-dashed space-y-6 ${darkMode ? 'border-[#333]' : 'border-[var(--color-paper-3)]'}`}>
                            
                            {/* QC Standards */}
                            {recipe?.advanced_details?.qc_standards?.length > 0 && (
                                <div>
                                    <div className={`text-xs tabular-nums font-bold mb-3 ${t.sectionLabel}`}>มาตรฐานรสชาติและคุณภาพ</div>
                                    <div className={`rounded-xl overflow-hidden border ${darkMode ? 'bg-[#111] border-[#222]' : 'bg-[var(--color-paper)] border-[var(--color-paper-3)]'}`}>
                                        {recipe.advanced_details.qc_standards.map((qc, i) => (
                                            <div key={i} className={`flex border-b last:border-0 text-sm ${darkMode ? 'border-[#222]' : 'border-[var(--color-paper-3)]'}`}>
                                                <div className={`w-1/3 p-2.5 font-bold tabular-nums text-xs ${darkMode ? 'bg-[#1A1A1A] text-[#888]' : 'bg-[oklch(96%_0.005_110)] text-[var(--color-muted)]'}`}>{qc.topic}</div>
                                                <div className={`flex-1 p-2.5 ${darkMode ? 'text-gray-200' : 'text-[var(--color-ink)]'}`}>{qc.standard}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Troubleshooting */}
                            {recipe?.advanced_details?.troubleshooting?.length > 0 && (
                                <div>
                                    <div className={`text-xs tabular-nums font-bold mb-3 ${t.sectionLabel}`}>แก้ปัญหาเบื้องต้น</div>
                                    <div className="space-y-2">
                                        {recipe.advanced_details.troubleshooting.map((tb, i) => (
                                            <div key={i} className={`border p-3 rounded-xl text-sm ${darkMode ? 'bg-[#111] border-[#222]' : 'bg-[oklch(96%_0.005_110)] border-[var(--color-paper-3)]'}`}>
                                                <div className={`font-bold tabular-nums text-xs mb-1 flex items-center gap-1 ${darkMode ? 'text-red-400' : 'text-[oklch(21%_0.008_110)]'}`}>ปัญหา: {tb.problem}</div>
                                                <div className={`mb-2 text-xs tabular-nums ${darkMode ? 'text-[#888]' : 'text-[var(--color-muted)]'}`}>สาเหตุ: {tb.cause}</div>
                                                <div className={`text-xs px-2 py-1.5 rounded flex items-center gap-1 tabular-nums ${darkMode ? 'bg-[#1A1A1A] text-[var(--on-plum-2)]' : 'bg-[var(--color-paper)] border border-[var(--color-paper-3)] text-[var(--color-ink)] font-medium'}`}>
                                                    วิธีแก้: {tb.solution}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Shelf Life */}
                                {recipe?.advanced_details?.shelf_life?.length > 0 && (
                                    <div>
                                        <div className={`text-xs tabular-nums font-bold mb-3 ${t.sectionLabel}`}>การเก็บรักษา</div>
                                        <ul className={`space-y-1.5 text-xs ${darkMode ? 'text-[var(--color-neutral)]' : 'text-[var(--color-muted)]'}`}>
                                            {recipe.advanced_details.shelf_life.map((sl, i) => (
                                                <li key={i} className={`flex justify-between items-center border px-2 py-1.5 rounded-lg ${darkMode ? 'bg-[#111] border-[#222]' : 'bg-[var(--color-paper)] border-[var(--color-paper-3)]'}`}>
                                                    <span>{sl.item}</span>
                                                    <span className={`tabular-nums ${darkMode ? 'text-[#888]' : 'text-[var(--color-muted)]'}`}>{sl.age}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Checklist */}
                                {recipe?.advanced_details?.checklist?.length > 0 && (
                                    <div>
                                        <div className={`text-xs tabular-nums font-bold mb-3 ${t.sectionLabel}`}>ตรวจก่อนเสิร์ฟ</div>
                                        <ul className={`space-y-1.5 text-xs ${darkMode ? 'text-[var(--color-neutral)]' : 'text-[var(--color-muted)]'}`}>
                                            {recipe.advanced_details.checklist.map((cl, i) => (
                                                <li key={i} className={`flex items-start gap-2 border px-2 py-1.5 rounded-lg ${darkMode ? 'bg-[#111] border-[#222]' : 'bg-[var(--color-paper)] border-[var(--color-paper-3)]'}`}>
                                                    <span>{cl}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Garnish */}
                    {recipe?.garnish && (
                        <div className={`p-3 rounded-xs border border-[var(--color-rule)] bg-[var(--color-paper)] flex items-start gap-2`}>
                            <span className="tabular-nums text-xs font-medium text-[var(--color-muted)] whitespace-nowrap">แต่งแก้ว</span>
                            <p className="text-[13px] text-[var(--color-ink)]">{recipe.garnish}</p>
                        </div>
                    )}

                    {/* Notes */}
                    {recipe?.notes && (
                        <div className="p-3 rounded-xs border border-dashed border-[var(--color-rule)] bg-[var(--color-paper-2)] flex items-start gap-2">
                            <span className="tabular-nums text-xs font-medium text-[var(--color-muted)] whitespace-nowrap">หมายเหตุ</span>
                            <p className="text-[13px] text-[var(--color-ink)]">{recipe.notes}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
