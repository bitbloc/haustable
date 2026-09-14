/**
 * SOPPrintableSheet.jsx
 * Printable A4 Layout Sheets for In The Haus SOP Manuals.
 * Adheres strictly to Dieter Rams Minimalist Structure & Thai Modern OKLCH System.
 * Zero-icon discipline: relies on pure typography, monospace badges, and tabular borders.
 */

import React from 'react';

/**
 * Single Recipe A4 Sheet
 * Exactly 794px wide x 1123px high (A4 at 96 DPI)
 */
export function SingleRecipeSheet({ recipe, pageNumber, totalPages }) {
    if (!recipe) return null;

    const ingredients = recipe.display_ingredients || recipe.ingredients || [];
    const steps = recipe.steps || [];
    const adv = recipe.advanced_details || {};
    const sweetnessMatrix = adv.sweetness_matrix;
    const sweeteners = ingredients.filter(i => i.is_sweetener);

    return (
        <div 
            className="sop-print-sheet w-[794px] h-[1123px] max-h-[1123px] bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] p-8 box-border flex flex-col justify-between font-sans relative overflow-hidden select-none border border-[oklch(85%_0.012_28)]"
            style={{ pageBreakAfter: 'always' }}
        >
            {/* Top Running Header */}
            <div>
                <div className="flex justify-between items-center border-b border-[oklch(85%_0.012_28)] pb-2 font-mono text-[10px] text-[oklch(55%_0.010_28)] uppercase tracking-wider">
                    <span>IN THE HAUS — STANDARD OPERATING PROCEDURE</span>
                    <span>SECTION: {recipe.category?.label || 'BEVERAGE'}</span>
                    <span>DOC ID: SOP-{String(recipe.id || '001').substring(0, 8).toUpperCase()}</span>
                </div>

                {/* Recipe Header Block */}
                <div className="mt-4 border border-[oklch(85%_0.012_28)] bg-[oklch(98%_0.004_28)] p-4 flex justify-between items-start">
                    <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-mono text-[9px] font-bold uppercase tracking-wider">
                                {recipe.category?.label || 'BAR'}
                            </span>
                            <span className="font-mono text-[10px] text-[oklch(55%_0.010_28)]">
                                BASE {recipe.base_glass_size_oz || 16} OZ
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-[oklch(18%_0.012_28)] mt-1 uppercase">
                            {recipe.name}
                        </h1>
                        {recipe.name_en && (
                            <p className="text-xs font-mono text-[oklch(42%_0.010_28)] mt-0.5 uppercase tracking-wide">
                                {recipe.name_en}
                            </p>
                        )}
                        {adv.profile && (
                            <p className="text-xs text-[oklch(55%_0.010_28)] mt-1.5 line-clamp-1 italic">
                                "{adv.profile}"
                            </p>
                        )}
                    </div>

                    {/* Quick Metric Cells */}
                    <div className="flex border border-[oklch(85%_0.012_28)] divide-x divide-[oklch(85%_0.012_28)] font-mono text-center flex-shrink-0 bg-[oklch(94%_0.010_28)]">
                        <div className="px-3 py-1.5">
                            <span className="block text-[8px] text-[oklch(55%_0.010_28)] uppercase">GLASS</span>
                            <span className="text-xs font-bold text-[oklch(18%_0.012_28)]">{recipe.base_glass_size_oz || 16} oz</span>
                        </div>
                        <div className="px-3 py-1.5">
                            <span className="block text-[8px] text-[oklch(55%_0.010_28)] uppercase">PREP TIME</span>
                            <span className="text-xs font-bold text-[oklch(18%_0.012_28)]">{adv.prep_time || '2-3 min'}</span>
                        </div>
                        <div className="px-3 py-1.5">
                            <span className="block text-[8px] text-[oklch(55%_0.010_28)] uppercase">ICE</span>
                            <span className="text-xs font-bold text-[oklch(18%_0.012_28)]">{adv.ice_level || '100%'}</span>
                        </div>
                    </div>
                </div>

                {/* 2-Column Body Grid */}
                <div className="grid grid-cols-12 gap-4 mt-4">
                    {/* LEFT COLUMN: Ingredients & Sweetness Matrix (5 Cols) */}
                    <div className="col-span-5 space-y-4">
                        {/* Ingredients Table */}
                        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(98%_0.004_28)]">
                            <div className="p-2 border-b border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex justify-between items-center">
                                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                                    ส่วนผสม (INGREDIENTS)
                                </span>
                                <span className="font-mono text-[9px] text-[oklch(55%_0.010_28)]">
                                    {ingredients.length} ITEMS
                                </span>
                            </div>

                            <table className="w-full text-left font-sans text-xs divide-y divide-[oklch(85%_0.012_28)]">
                                <thead>
                                    <tr className="font-mono text-[9px] text-[oklch(55%_0.010_28)] bg-[oklch(96%_0.006_28)]">
                                        <th className="p-1.5 pl-2.5">รายการ</th>
                                        <th className="p-1.5 text-right">จำนวน</th>
                                        <th className="p-1.5 pr-2.5 text-right">หน่วย</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[oklch(90%_0.008_28)]">
                                    {ingredients.map((ing, idx) => (
                                        <tr key={idx} className={ing.is_sweetener ? 'bg-[oklch(95%_0.02_45)]/30' : ''}>
                                            <td className="p-1.5 pl-2.5">
                                                <div className="font-semibold text-[oklch(18%_0.012_28)]">
                                                    {ing.name}
                                                </div>
                                                {ing.remark && (
                                                    <div className="text-[9px] text-[oklch(55%_0.010_28)]">
                                                        {ing.remark}
                                                    </div>
                                                )}
                                                {ing.is_sweetener && (
                                                    <span className="font-mono text-[8px] font-bold text-[oklch(52%_0.16_28)]">
                                                        [SWEETENER]
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-1.5 text-right font-mono font-bold text-[oklch(18%_0.012_28)] tabular-nums">
                                                {ing.qty}
                                            </td>
                                            <td className="p-1.5 pr-2.5 text-right font-mono text-[10px] text-[oklch(42%_0.010_28)]">
                                                {ing.unit}
                                            </td>
                                        </tr>
                                    ))}
                                    {ingredients.length === 0 && (
                                        <tr>
                                            <td colSpan="3" className="p-3 text-center text-[oklch(55%_0.010_28)] font-mono text-xs">
                                                ไม่มีรายการส่วนผสม
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Sweetness Breakdown Matrix */}
                        {sweeteners.length > 0 && (
                            <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(98%_0.004_28)]">
                                <div className="p-2 border-b border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex justify-between items-center">
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                                        ระดับความหวาน (SWEETNESS MATRIX)
                                    </span>
                                    <span className="font-mono text-[8px] text-[oklch(52%_0.16_28)] font-bold">
                                        4 LEVELS
                                    </span>
                                </div>

                                <div className="p-2">
                                    <table className="w-full text-center font-mono text-[10px] border border-[oklch(85%_0.012_28)]">
                                        <thead>
                                            <tr className="bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] border-b border-[oklch(85%_0.012_28)]">
                                                <th className="p-1 text-left pl-2">สารหวาน</th>
                                                <th className="p-1 border-l border-[oklch(85%_0.012_28)]">ไม่หวาน<br/><span className="text-[8px]">0%</span></th>
                                                <th className="p-1 border-l border-[oklch(85%_0.012_28)]">หวานน้อย<br/><span className="text-[8px]">50%</span></th>
                                                <th className="p-1 border-l border-[oklch(85%_0.012_28)] bg-[oklch(90%_0.015_28)] text-[oklch(18%_0.012_28)]">หวานปกติ<br/><span className="text-[8px]">100%</span></th>
                                                <th className="p-1 border-l border-[oklch(85%_0.012_28)]">หวานมาก<br/><span className="text-[8px]">120%</span></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[oklch(85%_0.012_28)]">
                                            {sweeteners.map((sw, sIdx) => {
                                                const custom = sweetnessMatrix?.levels?.[sw.name] || {};
                                                const noneQty = custom.none !== undefined ? custom.none : 0;
                                                const lessQty = custom.less !== undefined ? custom.less : Math.round(sw.qty * 0.5 * 10) / 10;
                                                const normQty = custom.normal !== undefined ? custom.normal : sw.qty;
                                                const extraQty = custom.extra !== undefined ? custom.extra : Math.round(sw.qty * 1.2 * 10) / 10;

                                                return (
                                                    <tr key={sIdx}>
                                                        <td className="p-1 text-left pl-2 font-sans font-bold text-[oklch(18%_0.012_28)] truncate max-w-[90px]">
                                                            {sw.name}
                                                        </td>
                                                        <td className="p-1 border-l border-[oklch(85%_0.012_28)] tabular-nums">{noneQty} {sw.unit}</td>
                                                        <td className="p-1 border-l border-[oklch(85%_0.012_28)] tabular-nums font-bold text-[oklch(52%_0.16_28)]">{lessQty} {sw.unit}</td>
                                                        <td className="p-1 border-l border-[oklch(85%_0.012_28)] tabular-nums font-bold bg-[oklch(92%_0.015_28)]/50">{normQty} {sw.unit}</td>
                                                        <td className="p-1 border-l border-[oklch(85%_0.012_28)] tabular-nums">{extraQty} {sw.unit}</td>
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
                            <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(98%_0.004_28)] p-2.5">
                                <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[oklch(55%_0.010_28)] block mb-1">
                                    อุปกรณ์เฉพาะ (EQUIPMENT)
                                </span>
                                <p className="text-xs font-mono text-[oklch(18%_0.012_28)]">
                                    {Array.isArray(adv.equipment) ? adv.equipment.join(', ') : adv.equipment}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: Method Steps (7 Cols) */}
                    <div className="col-span-7 space-y-4">
                        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(98%_0.004_28)] p-3">
                            <div className="border-b border-[oklch(85%_0.012_28)] pb-1.5 mb-2.5 flex justify-between items-center">
                                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                                    ขั้นตอนการปฏิบัติงาน (PREPARATION STEPS)
                                </span>
                                <span className="font-mono text-[9px] text-[oklch(55%_0.010_28)]">
                                    {steps.length} STEPS
                                </span>
                            </div>

                            <div className="space-y-2.5">
                                {steps.map((st, sIdx) => (
                                    <div key={sIdx} className="border border-[oklch(85%_0.012_28)] p-2 bg-[oklch(97%_0.008_28)]">
                                        <div className="flex items-center justify-between font-mono text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] flex items-center justify-center font-bold text-[10px]">
                                                    {sIdx + 1}
                                                </span>
                                                <span className="font-bold text-[oklch(18%_0.012_28)]">
                                                    {st.title || `ขั้นตอนที่ ${sIdx + 1}`}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[9px] text-[oklch(55%_0.010_28)]">
                                                {st.duration_sec && <span>[{st.duration_sec}s]</span>}
                                                {st.action && <span className="uppercase">[{st.action}]</span>}
                                            </div>
                                        </div>

                                        <p className="text-xs text-[oklch(18%_0.012_28)] mt-1.5 leading-relaxed font-sans">
                                            {st.instruction}
                                        </p>

                                        {(st.key_points || st.reason) && (
                                            <div className="mt-2 pt-1.5 border-t border-dashed border-[oklch(85%_0.012_28)] space-y-1 font-mono text-[10px]">
                                                {st.key_points && (
                                                    <div className="text-[oklch(52%_0.16_28)]">
                                                        <span className="font-bold uppercase">[KEY POINT]:</span> {st.key_points}
                                                    </div>
                                                )}
                                                {st.reason && (
                                                    <div className="text-[oklch(42%_0.010_28)]">
                                                        <span className="font-bold uppercase">[REASON]:</span> {st.reason}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {steps.length === 0 && (
                                    <div className="p-4 text-center font-mono text-xs text-[oklch(55%_0.010_28)]">
                                        ยังไม่มีขั้นตอนระบุ
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* QC Standards & Shelf Life Box */}
                        {((adv.qc_standards && adv.qc_standards.length > 0) || (adv.shelf_life && adv.shelf_life.length > 0)) && (
                            <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(98%_0.004_28)] p-2.5">
                                <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)] block mb-1.5">
                                    เกณฑ์มาตรฐาน QC & อายุการเก็บรักษา
                                </span>
                                <div className="space-y-1 font-mono text-[10px] text-[oklch(42%_0.010_28)]">
                                    {(adv.qc_standards || []).map((qc, qIdx) => (
                                        <div key={qIdx} className="flex gap-2">
                                            <span className="font-bold text-[oklch(18%_0.012_28)] min-w-[70px]">• {qc.topic}:</span>
                                            <span>{qc.standard}</span>
                                        </div>
                                    ))}
                                    {(adv.shelf_life || []).map((sl, sIdx) => (
                                        <div key={sIdx} className="flex gap-2 text-[oklch(52%_0.16_28)]">
                                            <span className="font-bold min-w-[70px]">• อายุ {sl.item}:</span>
                                            <span>{sl.age}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Footer & Sign-off */}
            <div className="mt-4 pt-3 border-t border-[oklch(85%_0.012_28)] flex justify-between items-end font-mono text-[9px] text-[oklch(55%_0.010_28)]">
                <div>
                    <div>IN THE HAUS CULINARY & BEVERAGE LAB</div>
                    <div>พิมพ์เมื่อ: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div className="flex gap-6 items-center">
                    <div>
                        <span>ลงชื่อผู้ตรวจสอบ: ____________________</span>
                    </div>
                    {pageNumber && totalPages && (
                        <div className="font-bold text-[oklch(18%_0.012_28)]">
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
 */
export function ManualCoverSheet({ recipes = [], department = 'bar', totalPages = 1 }) {
    const categoriesMap = {};
    recipes.forEach(r => {
        const cat = r.category?.label || 'ทั่วไป';
        if (!categoriesMap[cat]) categoriesMap[cat] = [];
        categoriesMap[cat].push(r);
    });

    return (
        <div 
            className="sop-print-sheet w-[794px] h-[1123px] max-h-[1123px] bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] p-10 box-border flex flex-col justify-between font-sans relative overflow-hidden select-none border border-[oklch(85%_0.012_28)]"
            style={{ pageBreakAfter: 'always' }}
        >
            {/* Top Bar */}
            <div>
                <div className="flex justify-between items-center border-b border-[oklch(85%_0.012_28)] pb-2 font-mono text-xs text-[oklch(55%_0.010_28)] uppercase tracking-widest">
                    <span>IN THE HAUS RESTAURANT & BAR</span>
                    <span>INTERNAL OPERATIONS ONLY</span>
                </div>

                {/* Hero Title Block */}
                <div className="mt-12 border-l-4 border-[oklch(52%_0.16_28)] pl-6">
                    <span className="font-mono text-xs font-bold text-[oklch(52%_0.16_28)] uppercase tracking-widest block mb-2">
                        STANDARD OPERATING PROCEDURES (SOP)
                    </span>
                    <h1 className="text-4xl font-bold uppercase tracking-tight text-[oklch(18%_0.012_28)] leading-tight">
                        คู่มือสูตรและมาตรฐาน<br />
                        การปฏิบัติงานเครื่องดื่ม & ครัว
                    </h1>
                    <p className="text-sm font-mono text-[oklch(42%_0.010_28)] mt-3">
                        DEPARTMENT: {department.toUpperCase()} LAB & SERVICE
                    </p>
                </div>

                {/* Meta stats bar */}
                <div className="grid grid-cols-3 border border-[oklch(85%_0.012_28)] divide-x divide-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] font-mono text-xs mt-10">
                    <div className="p-3 text-center">
                        <span className="block text-[10px] text-[oklch(55%_0.010_28)] uppercase">จำนวนสูตรทั้งหมด</span>
                        <span className="text-lg font-bold text-[oklch(18%_0.012_28)]">{recipes.length} เมนู</span>
                    </div>
                    <div className="p-3 text-center">
                        <span className="block text-[10px] text-[oklch(55%_0.010_28)] uppercase">หมวดหมู่</span>
                        <span className="text-lg font-bold text-[oklch(18%_0.012_28)]">{Object.keys(categoriesMap).length} หมวด</span>
                    </div>
                    <div className="p-3 text-center">
                        <span className="block text-[10px] text-[oklch(55%_0.010_28)] uppercase">วันที่ออกเอกสาร</span>
                        <span className="text-lg font-bold text-[oklch(18%_0.012_28)]">
                            {new Date().toLocaleDateString('th-TH', { month: 'short', year: 'numeric' })}
                        </span>
                    </div>
                </div>

                {/* Table of Contents (สารบัญ) */}
                <div className="mt-8 border border-[oklch(85%_0.012_28)] bg-[oklch(98%_0.004_28)] p-4">
                    <div className="border-b border-[oklch(85%_0.012_28)] pb-2 mb-3 flex justify-between font-mono text-xs font-bold uppercase text-[oklch(18%_0.012_28)]">
                        <span>สารบัญสูตร (TABLE OF CONTENTS)</span>
                        <span>หน้า</span>
                    </div>

                    <div className="space-y-3 font-mono text-xs max-h-[460px] overflow-hidden">
                        {Object.entries(categoriesMap).map(([category, items], cIdx) => (
                            <div key={cIdx} className="space-y-1">
                                <div className="text-[10px] font-bold uppercase text-[oklch(52%_0.16_28)] tracking-wider border-b border-dashed border-[oklch(90%_0.008_28)] pb-0.5">
                                    [หมวด {category}] ({items.length} เมนู)
                                </div>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-1 pl-2">
                                    {items.map((it, iIdx) => {
                                        // Recipe pages start after cover (page 2 onward)
                                        const recipePageIndex = recipes.findIndex(r => r.id === it.id) + 2;
                                        return (
                                            <div key={iIdx} className="flex justify-between items-center text-[11px] text-[oklch(18%_0.012_28)]">
                                                <span className="truncate pr-2 font-sans font-medium">{it.name}</span>
                                                <span className="text-[oklch(55%_0.010_28)] tabular-nums">p.{recipePageIndex}</span>
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
            <div className="border-t border-[oklch(85%_0.012_28)] pt-4 flex justify-between items-end font-mono text-xs text-[oklch(55%_0.010_28)]">
                <div>
                    <div className="font-bold text-[oklch(18%_0.012_28)]">IN THE HAUS CAFE & RESTAURANT</div>
                    <div className="text-[10px]">เอกสารสงวนสิทธิ์สำหรับใช้ภายในร้านเท่านั้น ห้ามคัดลอกหรือเผยแพร่</div>
                </div>
                <div className="text-right text-[10px]">
                    <div>PAGE 1 OF {totalPages}</div>
                </div>
            </div>
        </div>
    );
}
