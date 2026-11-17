/**
 * SOPPrintableSheet.jsx
 * Printable A4 Layout Sheets for In The Haus SOP Manuals.
 * Adheres strictly to Dieter Rams Minimalist Structure & Thai Modern OKLCH System.
 * Zero-icon discipline: relies on pure typography, monospace badges, and tabular borders.
 * Auto-fits content gracefully to prevent table truncation or abrupt clipping.
 */

import React from 'react';

/**
 * Single Recipe A4 Sheet
 * Standard A4 at 96 DPI: 794px wide x 1123px high
 * Formatted to fit 100% cleanly on 1 page without cutting tables or content.
 */
export function SingleRecipeSheet({ recipe, pageNumber, totalPages }) {
    if (!recipe) return null;

    const ingredients = recipe.display_ingredients || recipe.ingredients || [];
    const steps = recipe.steps || [];
    const adv = recipe.advanced_details || {};
    const sweetnessMatrix = adv.sweetness_matrix;
    const sweeteners = ingredients.filter(i => i.is_sweetener);

    const hasNoSteps = steps.length === 0;
    const isHighDensity = ingredients.length > 8 || steps.length > 4 || (sweeteners.length > 0 && ingredients.length > 6);
    const isExtremeDensity = ingredients.length > 14 || steps.length > 6;

    // Helper: render ingredients table rows
    const renderIngredientRows = (items) => (
        items.map((ing, idx) => (
            <tr key={idx} className={`border-b border-[var(--color-paper-3)] last:border-b-0 ${ing.is_sweetener ? 'bg-[oklch(95%_0.02_45)]/30' : ''}`}>
                <td className={`${isExtremeDensity ? 'py-0.5 pl-2' : isHighDensity ? 'py-1 pl-2' : 'p-1.5 pl-2.5'}`}>
                    <div className={`font-semibold text-[var(--color-ink)] ${isExtremeDensity ? 'text-[10px]' : isHighDensity ? 'text-[11px]' : 'text-xs'} leading-tight`}>
                        {ing.name}
                    </div>
                    {ing.remark && (
                        <div className="text-[8px] text-[var(--color-neutral)] line-clamp-1 leading-tight">
                            {ing.remark}
                        </div>
                    )}
                    {ing.is_sweetener && (
                        <span className="font-mono text-[7px] font-bold text-[var(--brand-plum)] tracking-wider">
                            [SWEETENER]
                        </span>
                    )}
                </td>
                <td className={`${isExtremeDensity ? 'py-0.5' : isHighDensity ? 'py-1' : 'p-1.5'} text-right font-mono font-bold text-[var(--color-ink)] tabular-nums ${isExtremeDensity ? 'text-[10px]' : isHighDensity ? 'text-[11px]' : 'text-xs'}`}>
                    {ing.qty}
                </td>
                <td className={`${isExtremeDensity ? 'py-0.5 pr-2' : isHighDensity ? 'py-1 pr-2' : 'p-1.5 pr-2.5'} text-right font-mono ${isExtremeDensity ? 'text-[8px]' : isHighDensity ? 'text-[9px]' : 'text-[10px]'} text-[var(--color-muted)]`}>
                    {ing.unit}
                </td>
            </tr>
        ))
    );

    return (
        <div 
            className="sop-print-sheet w-[794px] min-h-[1123px] max-h-[1123px] bg-[var(--color-paper)] text-[var(--color-ink)] p-6 box-border flex flex-col justify-between font-sans relative select-none border border-[var(--color-rule)]"
            style={{ pageBreakAfter: 'always', breakAfter: 'page' }}
        >
            {/* Top Section */}
            <div className="flex-1 flex flex-col min-h-0">
                {/* 1. Top Running Header */}
                <div className="flex justify-between items-center border-b border-[var(--color-rule)] pb-1.5 font-mono text-[10px] text-[var(--color-neutral)] uppercase tracking-wider flex-shrink-0">
                    <span>IN THE HAUS — STANDARD OPERATING PROCEDURE</span>
                    <span>SECTION: {recipe.category?.label || 'BEVERAGE'}</span>
                    <span>DOC ID: SOP-{String(recipe.id || '001').substring(0, 8).toUpperCase()}</span>
                </div>

                {/* 2. Recipe Header Block */}
                <div className="mt-3 border border-[var(--color-rule)] bg-[var(--color-paper)] p-3 flex justify-between items-start flex-shrink-0">
                    <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-[var(--color-ink)] text-[var(--color-paper)] font-mono text-[9px] font-bold uppercase tracking-wider">
                                {recipe.category?.label || 'BAR'}
                            </span>
                            <span className="font-mono text-[10px] text-[var(--color-neutral)]">
                                BASE {recipe.base_glass_size_oz || 16} OZ
                            </span>
                        </div>
                        <h1 className="text-xl font-bold tracking-tight text-[var(--color-ink)] mt-1 uppercase leading-tight">
                            {recipe.name}
                        </h1>
                        {recipe.name_en && (
                            <p className="text-[11px] font-mono text-[var(--color-muted)] mt-0.5 uppercase tracking-wide">
                                {recipe.name_en}
                            </p>
                        )}
                        {adv.profile && (
                            <p className="text-[11px] text-[var(--color-neutral)] mt-1 line-clamp-1 italic">
                                "{adv.profile}"
                            </p>
                        )}
                    </div>

                    {/* Quick Metric Cells */}
                    <div className="flex border border-[var(--color-rule)] divide-x divide-[var(--color-rule)] font-mono text-center flex-shrink-0 bg-[var(--color-paper-2)]">
                        <div className="px-3 py-1.5">
                            <span className="block text-[8px] text-[var(--color-neutral)] uppercase">GLASS</span>
                            <span className="text-xs font-bold text-[var(--color-ink)]">{recipe.base_glass_size_oz || 16} oz</span>
                        </div>
                        <div className="px-3 py-1.5">
                            <span className="block text-[8px] text-[var(--color-neutral)] uppercase">PREP TIME</span>
                            <span className="text-xs font-bold text-[var(--color-ink)]">{adv.prep_time || '2-3 min'}</span>
                        </div>
                        <div className="px-3 py-1.5">
                            <span className="block text-[8px] text-[var(--color-neutral)] uppercase">ICE</span>
                            <span className="text-xs font-bold text-[var(--color-ink)]">{adv.ice_level || '100%'}</span>
                        </div>
                    </div>
                </div>

                {/* 3. Body Content Area */}
                {hasNoSteps ? (
                    /* ── NO STEPS LAYOUT: Full-width multi-column grid for ingredients ── */
                    <div className="mt-3 space-y-3 flex-1">
                        {/* Ingredients Table (2 side-by-side columns if > 6 items) */}
                        <div className="border border-[var(--color-rule)] bg-[var(--color-paper)]">
                            <div className="p-2 border-b border-[var(--color-rule)] bg-[var(--color-paper-2)] flex justify-between items-center">
                                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink)]">
                                    ส่วนผสมและวัตถุดิบ (INGREDIENTS SPECIFICATION)
                                </span>
                                <span className="font-mono text-[9px] text-[var(--color-neutral)]">
                                    {ingredients.length} ITEMS
                                </span>
                            </div>

                            {ingredients.length > 6 ? (
                                <div className="grid grid-cols-2 divide-x divide-[var(--color-rule)]">
                                    {/* Left Sub-Column */}
                                    <table className="w-full text-left font-sans text-xs">
                                        <thead>
                                            <tr className="font-mono text-[9px] text-[var(--color-neutral)] bg-[var(--color-paper)] border-b border-[var(--color-rule)]">
                                                <th className="p-1.5 pl-2.5">รายการ</th>
                                                <th className="p-1.5 text-right">จำนวน</th>
                                                <th className="p-1.5 pr-2.5 text-right">หน่วย</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {renderIngredientRows(ingredients.slice(0, Math.ceil(ingredients.length / 2)))}
                                        </tbody>
                                    </table>

                                    {/* Right Sub-Column */}
                                    <table className="w-full text-left font-sans text-xs">
                                        <thead>
                                            <tr className="font-mono text-[9px] text-[var(--color-neutral)] bg-[var(--color-paper)] border-b border-[var(--color-rule)]">
                                                <th className="p-1.5 pl-2.5">รายการ</th>
                                                <th className="p-1.5 text-right">จำนวน</th>
                                                <th className="p-1.5 pr-2.5 text-right">หน่วย</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {renderIngredientRows(ingredients.slice(Math.ceil(ingredients.length / 2)))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <table className="w-full text-left font-sans text-xs">
                                    <thead>
                                        <tr className="font-mono text-[9px] text-[var(--color-neutral)] bg-[var(--color-paper)] border-b border-[var(--color-rule)]">
                                            <th className="p-1.5 pl-2.5">รายการ</th>
                                            <th className="p-1.5 text-right">จำนวน</th>
                                            <th className="p-1.5 pr-2.5 text-right">หน่วย</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {renderIngredientRows(ingredients)}
                                        {ingredients.length === 0 && (
                                            <tr>
                                                <td colSpan="3" className="p-3 text-center text-[var(--color-neutral)] font-mono text-xs">
                                                    ไม่มีรายการส่วนผสม
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Sweetness Matrix (Full-width) */}
                        {sweeteners.length > 0 && (
                            <div className="border border-[var(--color-rule)] bg-[var(--color-paper)]">
                                <div className="p-2 border-b border-[var(--color-rule)] bg-[var(--color-paper-2)] flex justify-between items-center">
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink)]">
                                        ระดับความหวาน (SWEETNESS MATRIX)
                                    </span>
                                    <span className="font-mono text-[8px] text-[var(--brand-plum)] font-bold">
                                        4 LEVELS
                                    </span>
                                </div>
                                <div className="p-2">
                                    <table className="w-full text-center font-mono text-[10px] border border-[var(--color-rule)]">
                                        <thead>
                                            <tr className="bg-[var(--color-paper-2)] text-[var(--color-muted)] border-b border-[var(--color-rule)]">
                                                <th className="p-1.5 text-left pl-2">สารหวาน</th>
                                                <th className="p-1.5 border-l border-[var(--color-rule)]">ไม่หวาน (0%)</th>
                                                <th className="p-1.5 border-l border-[var(--color-rule)]">หวานน้อย (50%)</th>
                                                <th className="p-1.5 border-l border-[var(--color-rule)] bg-[var(--color-paper-3)] text-[var(--color-ink)]">หวานปกติ (100%)</th>
                                                <th className="p-1.5 border-l border-[var(--color-rule)]">หวานมาก (120%)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--color-rule)]">
                                            {sweeteners.map((sw, sIdx) => {
                                                const custom = sweetnessMatrix?.levels?.[sw.name] || {};
                                                const noneQty = custom.none !== undefined ? custom.none : 0;
                                                const lessQty = custom.less !== undefined ? custom.less : Math.round(sw.qty * 0.5 * 10) / 10;
                                                const normQty = custom.normal !== undefined ? custom.normal : sw.qty;
                                                const extraQty = custom.extra !== undefined ? custom.extra : Math.round(sw.qty * 1.2 * 10) / 10;

                                                return (
                                                    <tr key={sIdx}>
                                                        <td className="p-1 text-left pl-2 font-sans font-bold text-[var(--color-ink)]">{sw.name}</td>
                                                        <td className="p-1 border-l border-[var(--color-rule)] tabular-nums">{noneQty} {sw.unit}</td>
                                                        <td className="p-1 border-l border-[var(--color-rule)] tabular-nums font-bold text-[var(--brand-plum)]">{lessQty} {sw.unit}</td>
                                                        <td className="p-1 border-l border-[var(--color-rule)] tabular-nums font-bold bg-[var(--color-paper-2)]/50">{normQty} {sw.unit}</td>
                                                        <td className="p-1 border-l border-[var(--color-rule)] tabular-nums">{extraQty} {sw.unit}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Equipment / Notes row */}
                        <div className="grid grid-cols-2 gap-3">
                            {adv.equipment && (
                                <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] p-2">
                                    <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--color-neutral)] block mb-0.5">
                                        อุปกรณ์เฉพาะ (EQUIPMENT)
                                    </span>
                                    <p className="text-xs font-mono text-[var(--color-ink)]">
                                        {Array.isArray(adv.equipment) ? adv.equipment.join(', ') : adv.equipment}
                                    </p>
                                </div>
                            )}
                            {((adv.qc_standards && adv.qc_standards.length > 0) || (adv.shelf_life && adv.shelf_life.length > 0)) && (
                                <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] p-2">
                                    <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--color-ink)] block mb-1">
                                        เกณฑ์มาตรฐาน QC & อายุเก็บรักษา
                                    </span>
                                    <div className="space-y-0.5 font-mono text-[10px] text-[var(--color-muted)]">
                                        {(adv.qc_standards || []).map((qc, qIdx) => (
                                            <div key={qIdx} className="truncate">• {qc.topic}: {qc.standard}</div>
                                        ))}
                                        {(adv.shelf_life || []).map((sl, sIdx) => (
                                            <div key={sIdx} className="truncate text-[var(--brand-plum)]">• {sl.item}: {sl.age}</div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* ── STANDARD 2-COLUMN LAYOUT: Ingredients (Left) & Steps (Right) ── */
                    <div className="grid grid-cols-12 gap-3 mt-3 flex-1">
                        {/* LEFT COLUMN: Ingredients & Sweetness Matrix (5 Cols) */}
                        <div className="col-span-5 space-y-3">
                            {/* Ingredients Table */}
                            <div className="border border-[var(--color-rule)] bg-[var(--color-paper)]">
                                <div className="p-2 border-b border-[var(--color-rule)] bg-[var(--color-paper-2)] flex justify-between items-center">
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink)]">
                                        ส่วนผสม (INGREDIENTS)
                                    </span>
                                    <span className="font-mono text-[9px] text-[var(--color-neutral)]">
                                        {ingredients.length} ITEMS
                                    </span>
                                </div>

                                <table className="w-full text-left font-sans text-xs">
                                    <thead>
                                        <tr className="font-mono text-[9px] text-[var(--color-neutral)] bg-[var(--color-paper)] border-b border-[var(--color-rule)]">
                                            <th className="p-1 pl-2">รายการ</th>
                                            <th className="p-1 text-right">จำนวน</th>
                                            <th className="p-1 pr-2 text-right">หน่วย</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {renderIngredientRows(ingredients)}
                                        {ingredients.length === 0 && (
                                            <tr>
                                                <td colSpan="3" className="p-3 text-center text-[var(--color-neutral)] font-mono text-xs">
                                                    ไม่มีรายการส่วนผสม
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Sweetness Breakdown Matrix */}
                            {sweeteners.length > 0 && (
                                <div className="border border-[var(--color-rule)] bg-[var(--color-paper)]">
                                    <div className="p-1.5 border-b border-[var(--color-rule)] bg-[var(--color-paper-2)] flex justify-between items-center">
                                        <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--color-ink)]">
                                            ระดับความหวาน (SWEETNESS)
                                        </span>
                                        <span className="font-mono text-[7px] text-[var(--brand-plum)] font-bold">
                                            4 LEVELS
                                        </span>
                                    </div>

                                    <div className="p-1.5">
                                        <table className="w-full text-center font-mono text-[9px] border border-[var(--color-rule)]">
                                            <thead>
                                                <tr className="bg-[var(--color-paper-2)] text-[var(--color-muted)] border-b border-[var(--color-rule)]">
                                                    <th className="p-0.5 text-left pl-1">สารหวาน</th>
                                                    <th className="p-0.5 border-l border-[var(--color-rule)]">0%</th>
                                                    <th className="p-0.5 border-l border-[var(--color-rule)]">50%</th>
                                                    <th className="p-0.5 border-l border-[var(--color-rule)] bg-[var(--color-paper-3)] text-[var(--color-ink)]">100%</th>
                                                    <th className="p-0.5 border-l border-[var(--color-rule)]">120%</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[var(--color-rule)]">
                                                {sweeteners.map((sw, sIdx) => {
                                                    const custom = sweetnessMatrix?.levels?.[sw.name] || {};
                                                    const noneQty = custom.none !== undefined ? custom.none : 0;
                                                    const lessQty = custom.less !== undefined ? custom.less : Math.round(sw.qty * 0.5 * 10) / 10;
                                                    const normQty = custom.normal !== undefined ? custom.normal : sw.qty;
                                                    const extraQty = custom.extra !== undefined ? custom.extra : Math.round(sw.qty * 1.2 * 10) / 10;

                                                    return (
                                                        <tr key={sIdx}>
                                                            <td className="p-0.5 text-left pl-1 font-sans font-bold text-[var(--color-ink)] truncate max-w-[80px]">
                                                                {sw.name}
                                                            </td>
                                                            <td className="p-0.5 border-l border-[var(--color-rule)] tabular-nums">{noneQty}</td>
                                                            <td className="p-0.5 border-l border-[var(--color-rule)] tabular-nums font-bold text-[var(--brand-plum)]">{lessQty}</td>
                                                            <td className="p-0.5 border-l border-[var(--color-rule)] tabular-nums font-bold bg-[var(--color-paper-2)]/50">{normQty}</td>
                                                            <td className="p-0.5 border-l border-[var(--color-rule)] tabular-nums">{extraQty}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Equipment */}
                            {adv.equipment && adv.equipment.length > 0 && (
                                <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] p-2">
                                    <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--color-neutral)] block mb-0.5">
                                        อุปกรณ์เฉพาะ (EQUIPMENT)
                                    </span>
                                    <p className="text-[11px] font-mono text-[var(--color-ink)]">
                                        {Array.isArray(adv.equipment) ? adv.equipment.join(', ') : adv.equipment}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* RIGHT COLUMN: Method Steps (7 Cols) */}
                        <div className="col-span-7 space-y-3">
                            <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] p-2.5">
                                <div className="border-b border-[var(--color-rule)] pb-1 mb-2 flex justify-between items-center">
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink)]">
                                        ขั้นตอนการปฏิบัติงาน (PREPARATION STEPS)
                                    </span>
                                    <span className="font-mono text-[9px] text-[var(--color-neutral)]">
                                        {steps.length} STEPS
                                    </span>
                                </div>

                                <div className={`${isHighDensity ? 'space-y-1.5' : 'space-y-2'}`}>
                                    {steps.map((st, sIdx) => (
                                        <div key={sIdx} className={`border border-[var(--color-rule)] ${isHighDensity ? 'p-1.5' : 'p-2'} bg-[var(--color-paper)]`}>
                                            <div className="flex items-center justify-between font-mono text-xs">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-4 h-4 bg-[var(--color-ink)] text-[var(--color-paper)] flex items-center justify-center font-bold text-[9px]">
                                                        {sIdx + 1}
                                                    </span>
                                                    <span className="font-bold text-[var(--color-ink)] text-[11px]">
                                                        {st.title || `ขั้นตอนที่ ${sIdx + 1}`}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1 text-[8px] text-[var(--color-neutral)]">
                                                    {st.duration_sec && <span>[{st.duration_sec}s]</span>}
                                                    {st.action && <span className="uppercase">[{st.action}]</span>}
                                                </div>
                                            </div>

                                            <p className={`text-[var(--color-ink)] ${isHighDensity ? 'mt-1 text-[11px] leading-snug' : 'mt-1.5 text-xs leading-relaxed'} font-sans`}>
                                                {st.instruction}
                                            </p>

                                            {(st.key_points || st.reason) && (
                                                <div className="mt-1 pt-1 border-t border-dashed border-[var(--color-rule)] space-y-0.5 font-mono text-[9px]">
                                                    {st.key_points && (
                                                        <div className="text-[var(--brand-plum)]">
                                                            <span className="font-bold uppercase">[KEY POINT]:</span> {st.key_points}
                                                        </div>
                                                    )}
                                                    {st.reason && (
                                                        <div className="text-[var(--color-muted)]">
                                                            <span className="font-bold uppercase">[REASON]:</span> {st.reason}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* QC Standards & Shelf Life Box */}
                            {((adv.qc_standards && adv.qc_standards.length > 0) || (adv.shelf_life && adv.shelf_life.length > 0)) && (
                                <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] p-2">
                                    <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--color-ink)] block mb-1">
                                        เกณฑ์มาตรฐาน QC & อายุการเก็บรักษา
                                    </span>
                                    <div className="space-y-0.5 font-mono text-[9px] text-[var(--color-muted)]">
                                        {(adv.qc_standards || []).map((qc, qIdx) => (
                                            <div key={qIdx} className="flex gap-2">
                                                <span className="font-bold text-[var(--color-ink)] min-w-[65px]">• {qc.topic}:</span>
                                                <span>{qc.standard}</span>
                                            </div>
                                        ))}
                                        {(adv.shelf_life || []).map((sl, sIdx) => (
                                            <div key={sIdx} className="flex gap-2 text-[var(--brand-plum)]">
                                                <span className="font-bold min-w-[65px]">• อายุ {sl.item}:</span>
                                                <span>{sl.age}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Footer & Sign-off */}
            <div className="mt-3 pt-2 border-t border-[var(--color-rule)] flex justify-between items-end font-mono text-[9px] text-[var(--color-neutral)] flex-shrink-0">
                <div>
                    <div>IN THE HAUS CULINARY & BEVERAGE LAB</div>
                    <div>พิมพ์เมื่อ: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div className="flex gap-6 items-center">
                    <div>
                        <span>ลงชื่อผู้ตรวจสอบ: ____________________</span>
                    </div>
                    {pageNumber && totalPages && (
                        <div className="font-bold text-[var(--color-ink)]">
                            หน้า {pageNumber} / {totalPages}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Combined Manual Book Cover Sheet
 * Exactly 794px wide x 1123px high (A4 at 96 DPI)
 * Only rendered for multi-recipe collections (totalPages > 1).
 */
export function ManualCoverSheet({ recipes = [], department = 'bar', totalPages = 1 }) {
    // Never render cover sheet for a single recipe
    if (!recipes || recipes.length <= 1) return null;

    const categoriesMap = {};
    recipes.forEach(r => {
        const cat = r.category?.label || 'ทั่วไป';
        if (!categoriesMap[cat]) categoriesMap[cat] = [];
        categoriesMap[cat].push(r);
    });

    const totalCount = recipes.length;
    // Choose table of contents column layout based on count
    const tocColsClass = totalCount > 30 
        ? 'grid grid-cols-3 gap-x-4 gap-y-0.5 text-[10px]' 
        : totalCount > 12 
            ? 'grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]' 
            : 'grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs';

    return (
        <div 
            className="sop-print-sheet w-[794px] min-h-[1123px] max-h-[1123px] bg-[var(--color-paper)] text-[var(--color-ink)] p-8 box-border flex flex-col justify-between font-sans relative select-none border border-[var(--color-rule)]"
            style={{ pageBreakAfter: 'always', breakAfter: 'page' }}
        >
            {/* Top Bar & Header */}
            <div className="flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-center border-b border-[var(--color-rule)] pb-2 font-mono text-xs text-[var(--color-neutral)] uppercase tracking-widest flex-shrink-0">
                    <span>IN THE HAUS RESTAURANT & BAR</span>
                    <span>INTERNAL OPERATIONS ONLY</span>
                </div>

                {/* Hero Title Block */}
                <div className="mt-8 border-l-4 border-[var(--brand-plum)] pl-5 flex-shrink-0">
                    <span className="font-mono text-xs font-bold text-[var(--brand-plum)] uppercase tracking-widest block mb-1.5">
                        STANDARD OPERATING PROCEDURES (SOP)
                    </span>
                    <h1 className="text-3xl font-bold uppercase tracking-tight text-[var(--color-ink)] leading-tight">
                        คู่มือสูตรและมาตรฐาน<br />
                        การปฏิบัติงานเครื่องดื่ม & ครัว
                    </h1>
                    <p className="text-xs font-mono text-[var(--color-muted)] mt-2">
                        DEPARTMENT: {department.toUpperCase()} LAB & SERVICE
                    </p>
                </div>

                {/* Meta stats bar */}
                <div className="grid grid-cols-3 border border-[var(--color-rule)] divide-x divide-[var(--color-rule)] bg-[var(--color-paper-2)] font-mono text-xs mt-6 flex-shrink-0">
                    <div className="p-2.5 text-center">
                        <span className="block text-[10px] text-[var(--color-neutral)] uppercase">จำนวนสูตรทั้งหมด</span>
                        <span className="text-base font-bold text-[var(--color-ink)]">{recipes.length} เมนู</span>
                    </div>
                    <div className="p-2.5 text-center">
                        <span className="block text-[10px] text-[var(--color-neutral)] uppercase">หมวดหมู่</span>
                        <span className="text-base font-bold text-[var(--color-ink)]">{Object.keys(categoriesMap).length} หมวด</span>
                    </div>
                    <div className="p-2.5 text-center">
                        <span className="block text-[10px] text-[var(--color-neutral)] uppercase">วันที่ออกเอกสาร</span>
                        <span className="text-base font-bold text-[var(--color-ink)]">
                            {new Date().toLocaleDateString('th-TH', { month: 'short', year: 'numeric' })}
                        </span>
                    </div>
                </div>

                {/* Table of Contents (สารบัญ) */}
                <div className="mt-6 border border-[var(--color-rule)] bg-[var(--color-paper)] p-4 flex-1 flex flex-col min-h-0">
                    <div className="border-b border-[var(--color-rule)] pb-2 mb-3 flex justify-between font-mono text-xs font-bold uppercase text-[var(--color-ink)] flex-shrink-0">
                        <span>สารบัญสูตร (TABLE OF CONTENTS)</span>
                        <span>หน้า</span>
                    </div>

                    <div className="space-y-3 font-mono overflow-y-hidden flex-1">
                        {Object.entries(categoriesMap).map(([category, items], cIdx) => (
                            <div key={cIdx} className="space-y-1">
                                <div className="text-[10px] font-bold uppercase text-[var(--brand-plum)] tracking-wider border-b border-dashed border-[var(--color-paper-3)] pb-0.5">
                                    [หมวด {category}] ({items.length} เมนู)
                                </div>
                                <div className={tocColsClass}>
                                    {items.map((it, iIdx) => {
                                        // Recipe pages start after cover (page 2 onward)
                                        const recipePageIndex = recipes.findIndex(r => r.id === it.id) + 2;
                                        return (
                                            <div key={iIdx} className="flex justify-between items-center text-[var(--color-ink)] border-b border-[var(--color-paper-2)] pb-0.5">
                                                <span className="truncate pr-2 font-sans font-medium">{it.name}</span>
                                                <span className="text-[var(--color-neutral)] tabular-nums flex-shrink-0">p.{recipePageIndex}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Signature & Notice */}
            <div className="border-t border-[var(--color-rule)] pt-3 flex justify-between items-end font-mono text-xs text-[var(--color-neutral)] flex-shrink-0">
                <div>
                    <div className="font-bold text-[var(--color-ink)]">IN THE HAUS CAFE & RESTAURANT</div>
                    <div className="text-[10px]">เอกสารสงวนสิทธิ์สำหรับใช้ภายในร้านเท่านั้น ห้ามคัดลอกหรือเผยแพร่</div>
                </div>
                <div className="text-right text-[10px]">
                    <div>PAGE 1 OF {totalPages}</div>
                </div>
            </div>
        </div>
    );
}
