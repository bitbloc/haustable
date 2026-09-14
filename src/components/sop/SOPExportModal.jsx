/**
 * SOPExportModal.jsx
 * Export Dialog for generating Single and Combined SOP Manual PDFs.
 * Dieter Rams + Thai Modern OKLCH aesthetic, zero-icon discipline.
 */

import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { SingleRecipeSheet, ManualCoverSheet } from './SOPPrintableSheet';
import { generateSOPPdfDocument, saveOrShareSOPPdf } from '../../utils/sopPdfHelper';

export default function SOPExportModal({ 
    isOpen, 
    onClose, 
    recipes = [], 
    categories = [], 
    activeCategory = null,
    department = 'bar',
    initialSelectedRecipeId = null
}) {
    const [scope, setScope] = useState(initialSelectedRecipeId ? 'single' : 'all');
    const [selectedCatId, setSelectedCatId] = useState(activeCategory || categories[0]?.id || '');
    const [selectedIds, setSelectedIds] = useState(
        initialSelectedRecipeId ? [initialSelectedRecipeId] : recipes.map(r => r.id)
    );
    const [includeCover, setIncludeCover] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    const offscreenContainerRef = useRef(null);

    // Compute target recipes to export
    const targetRecipes = React.useMemo(() => {
        if (scope === 'single') {
            return recipes.filter(r => r.id === (initialSelectedRecipeId || selectedIds[0]));
        }
        if (scope === 'category') {
            return recipes.filter(r => r.category_id === selectedCatId || r.category?.id === selectedCatId);
        }
        if (scope === 'custom') {
            return recipes.filter(r => selectedIds.includes(r.id));
        }
        return recipes;
    }, [scope, selectedCatId, selectedIds, recipes, initialSelectedRecipeId]);

    const totalPages = (scope !== 'single' && includeCover ? 1 : 0) + targetRecipes.length;

    // Toggle recipe selection
    const toggleRecipe = (id) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    // Execute PDF Generation
    const handleGeneratePdf = async () => {
        if (targetRecipes.length === 0) {
            toast.error('กรุณาเลือกอย่างน้อย 1 สูตรเพื่อส่งออก');
            return;
        }

        setIsGenerating(true);
        setProgress({ current: 0, total: totalPages });

        try {
            // Small pause for DOM mount of offscreen sheets
            await new Promise(r => setTimeout(r, 100));

            const container = offscreenContainerRef.current;
            if (!container) throw new Error('Render container not ready');

            const fileName = scope === 'single' && targetRecipes[0]
                ? `SOP-${targetRecipes[0].name.replace(/\s+/g, '_')}.pdf`
                : `IN_THE_HAUS_SOP_MANUAL_${new Date().toISOString().slice(0, 10)}.pdf`;

            const pdfResult = await generateSOPPdfDocument(container, {
                fileName,
                onProgress: (cur, tot) => setProgress({ current: cur, total: tot })
            });

            await saveOrShareSOPPdf(pdfResult, {
                fileName,
                title: 'In The Haus SOP Manual'
            });

            toast.success(`ส่งออก PDF สำเร็จ (${totalPages} หน้า)`);
            onClose();
        } catch (err) {
            console.error('Failed to generate SOP PDF:', err);
            toast.error('สร้างไฟล์ PDF ไม่สำเร็จ: ' + (err.message || 'โปรดลองอีกครั้ง'));
        } finally {
            setIsGenerating(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
            <div className="bg-[oklch(98%_0.004_28)] border border-[oklch(85%_0.012_28)] max-w-xl w-full rounded-sm shadow-2xl overflow-hidden font-sans flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="p-4 border-b border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex justify-between items-center">
                    <div>
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] block">
                            DOCUMENT EXPORT ENGINE
                        </span>
                        <h2 className="font-mono text-base font-bold uppercase tracking-tight text-[oklch(18%_0.012_28)]">
                            ส่งออกคู่มือ SOP (A4 PDF)
                        </h2>
                    </div>
                    <button 
                        onClick={onClose} 
                        disabled={isGenerating}
                        className="p-1.5 text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] rounded hover:bg-[oklch(90%_0.012_28)] transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
                    {/* Scope Selector */}
                    <div>
                        <label className="font-mono font-bold uppercase tracking-wider text-[oklch(55%_0.010_28)] block mb-2">
                            ขอบเขตการส่งออก (EXPORT SCOPE)
                        </label>
                        <div className="grid grid-cols-3 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] divide-x divide-[oklch(85%_0.012_28)] font-mono">
                            <button
                                type="button"
                                onClick={() => setScope('all')}
                                className={`py-2 px-3 text-center font-bold uppercase transition-colors ${
                                    scope === 'all' 
                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]' 
                                        : 'hover:bg-[oklch(90%_0.012_28)] text-[oklch(42%_0.010_28)]'
                                }`}
                            >
                                รวมทั้งร้าน ({recipes.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setScope('category')}
                                className={`py-2 px-3 text-center font-bold uppercase transition-colors ${
                                    scope === 'category' 
                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]' 
                                        : 'hover:bg-[oklch(90%_0.012_28)] text-[oklch(42%_0.010_28)]'
                                }`}
                            >
                                แยกตามหมวดหมู่
                            </button>
                            <button
                                type="button"
                                onClick={() => setScope('custom')}
                                className={`py-2 px-3 text-center font-bold uppercase transition-colors ${
                                    scope === 'custom' 
                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]' 
                                        : 'hover:bg-[oklch(90%_0.012_28)] text-[oklch(42%_0.010_28)]'
                                }`}
                            >
                                เลือกเฉพาะสูตร ({selectedIds.length})
                            </button>
                        </div>
                    </div>

                    {/* Category Selector if category scope */}
                    {scope === 'category' && (
                        <div className="border border-[oklch(85%_0.012_28)] p-3 bg-[oklch(97%_0.008_28)] space-y-1.5">
                            <label className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase block">
                                เลือกหมวดหมู่ที่ต้องการส่งออก
                            </label>
                            <select
                                value={selectedCatId}
                                onChange={e => setSelectedCatId(e.target.value)}
                                className="w-full p-2 border border-[oklch(85%_0.012_28)] bg-white text-xs font-mono font-bold outline-none focus:border-[oklch(18%_0.012_28)]"
                            >
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.label} ({recipes.filter(r => r.category_id === cat.id || r.category?.id === cat.id).length} เมนู)
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Custom Recipe Checklist if custom scope */}
                    {scope === 'custom' && (
                        <div className="border border-[oklch(85%_0.012_28)] bg-white">
                            <div className="p-2 bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] flex justify-between items-center font-mono text-[10px]">
                                <span className="font-bold uppercase text-[oklch(18%_0.012_28)]">
                                    รายการสูตร ({selectedIds.length} / {recipes.length} เลือกแล้ว)
                                </span>
                                <div className="flex gap-2">
                                    <button 
                                        type="button" 
                                        onClick={() => setSelectedIds(recipes.map(r => r.id))} 
                                        className="text-[oklch(52%_0.16_28)] hover:underline font-bold"
                                    >
                                        [เลือกทั้งหมด]
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setSelectedIds([])} 
                                        className="text-[oklch(55%_0.010_28)] hover:underline"
                                    >
                                        [ล้างการเลือก]
                                    </button>
                                </div>
                            </div>
                            <div className="max-h-48 overflow-y-auto divide-y divide-[oklch(90%_0.008_28)] p-1">
                                {recipes.map(r => {
                                    const isChecked = selectedIds.includes(r.id);
                                    return (
                                        <label 
                                            key={r.id} 
                                            className="p-2 flex items-center justify-between hover:bg-[oklch(97%_0.008_28)] cursor-pointer select-none"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <input 
                                                    type="checkbox" 
                                                    checked={isChecked} 
                                                    onChange={() => toggleRecipe(r.id)} 
                                                    className="w-4 h-4 rounded text-black border-[oklch(85%_0.012_28)] focus:ring-0" 
                                                />
                                                <span className="font-bold text-xs text-[oklch(18%_0.012_28)] truncate">{r.name}</span>
                                            </div>
                                            <span className="font-mono text-[10px] text-[oklch(55%_0.010_28)]">
                                                {r.category?.label || 'ทั่วไป'}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Book Options */}
                    {scope !== 'single' && (
                        <div className="border border-[oklch(85%_0.012_28)] p-3 bg-[oklch(97%_0.008_28)] space-y-2">
                            <span className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase block">
                                ตัวเลือกโครงสร้างเล่ม (BOOK STRUCTURE)
                            </span>
                            <label className="flex items-center gap-2 text-xs font-mono cursor-pointer select-none">
                                <input 
                                    type="checkbox" 
                                    checked={includeCover} 
                                    onChange={e => setIncludeCover(e.target.checked)} 
                                    className="w-4 h-4 rounded text-black border-[oklch(85%_0.012_28)] focus:ring-0" 
                                />
                                <span className="text-[oklch(18%_0.012_28)]">
                                    รวมหน้าปกและสารบัญพร้อมเลขหน้า (Cover & Table of Contents)
                                </span>
                            </label>
                        </div>
                    )}

                    {/* Summary Box */}
                    <div className="border border-[oklch(85%_0.012_28)] p-3 bg-[oklch(94%_0.010_28)] font-mono text-xs flex justify-between items-center">
                        <span className="text-[oklch(55%_0.010_28)]">ขนาดเอกสารประเมิน:</span>
                        <span className="font-bold text-[oklch(18%_0.012_28)]">
                            {targetRecipes.length} สูตร ({totalPages} หน้า A4)
                        </span>
                    </div>

                    {/* Progress indicator when generating */}
                    {isGenerating && (
                        <div className="border border-[oklch(52%_0.16_28)] p-3 bg-[oklch(95%_0.02_45)]/20 font-mono text-xs text-center space-y-2 animate-pulse">
                            <div className="flex items-center justify-center gap-2 font-bold text-[oklch(52%_0.16_28)]">
                                <Loader2 size={16} className="animate-spin" />
                                <span>กำลังประมวลผล PDF หน้า {progress.current} จาก {progress.total}...</span>
                            </div>
                            <p className="text-[10px] text-[oklch(42%_0.010_28)]">กรุณารอสักครู่ ระบบกำลังจัดหน้าเวกเตอร์และเรนเดอร์แบบความละเอียดสูง</p>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="p-4 border-t border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex justify-end gap-3 font-mono text-xs">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isGenerating}
                        className="px-4 py-2 border border-[oklch(85%_0.012_28)] bg-white text-[oklch(42%_0.010_28)] font-bold uppercase hover:bg-[oklch(90%_0.012_28)] transition-colors cursor-pointer"
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="button"
                        onClick={handleGeneratePdf}
                        disabled={isGenerating || targetRecipes.length === 0}
                        className="px-5 py-2 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold uppercase hover:bg-black transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                        {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        <span>{isGenerating ? 'กำลังสร้างเอกสาร...' : `ดาวน์โหลด PDF (${totalPages} หน้า)`}</span>
                    </button>
                </div>
            </div>

            {/* Offscreen Print Container (Positioned far offscreen) */}
            <div 
                ref={offscreenContainerRef}
                style={{ 
                    position: 'fixed', 
                    top: '-10000px', 
                    left: '-10000px', 
                    width: '794px', 
                    zIndex: -100, 
                    pointerEvents: 'none',
                    opacity: 1
                }}
            >
                {/* 1. Cover Sheet if requested */}
                {scope !== 'single' && includeCover && (
                    <ManualCoverSheet 
                        recipes={targetRecipes} 
                        department={department} 
                        totalPages={totalPages} 
                    />
                )}

                {/* 2. Individual Recipe Sheets */}
                {targetRecipes.map((recipe, idx) => {
                    const pageNum = (scope !== 'single' && includeCover ? 1 : 0) + idx + 1;
                    return (
                        <SingleRecipeSheet 
                            key={recipe.id || idx} 
                            recipe={recipe} 
                            pageNumber={pageNum} 
                            totalPages={totalPages} 
                        />
                    );
                })}
            </div>
        </div>,
        document.body
    );
}
