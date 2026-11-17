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
    const [includeCover, setIncludeCover] = useState(!initialSelectedRecipeId);
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

    // Single recipe never needs a cover page; multi-recipe honors includeCover toggle
    const isSingleRecipe = targetRecipes.length <= 1;
    const effectiveIncludeCover = !isSingleRecipe && scope !== 'single' && includeCover;
    const totalPages = (effectiveIncludeCover ? 1 : 0) + targetRecipes.length;

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
            <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] max-w-xl w-full rounded-sm shadow-2xl overflow-hidden font-sans flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="p-4 border-b border-[var(--color-rule)] bg-[var(--color-paper-2)] flex justify-between items-center">
                    <div>
                        <h2 className="tabular-nums text-base font-bold tracking-tight text-[var(--color-ink)]">
                            ส่งออกคู่มือ SOP (A4 PDF)
                        </h2>
                    </div>
                    <button 
                        onClick={onClose} 
                        disabled={isGenerating}
                        className="p-1.5 text-[var(--color-neutral)] hover:text-[var(--color-ink)] rounded hover:bg-[var(--color-paper-3)] transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
                    {/* Scope Selector */}
                    <div>
                        <label className="tabular-nums font-bold text-[var(--color-neutral)] block mb-2">
                            ขอบเขตการส่งออก (EXPORT SCOPE)
                        </label>
                        <div className="grid grid-cols-3 border border-[var(--color-rule)] bg-[var(--color-paper-2)] divide-x divide-[var(--color-rule)] tabular-nums">
                            <button
                                type="button"
                                onClick={() => setScope('all')}
                                className={`py-2 px-3 text-center font-bold transition-colors ${
                                    scope === 'all' 
                                        ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' 
                                        : 'hover:bg-[var(--color-paper-3)] text-[var(--color-muted)]'
                                }`}
                            >
                                รวมทั้งร้าน ({recipes.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setScope('category')}
                                className={`py-2 px-3 text-center font-bold transition-colors ${
                                    scope === 'category' 
                                        ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' 
                                        : 'hover:bg-[var(--color-paper-3)] text-[var(--color-muted)]'
                                }`}
                            >
                                แยกตามหมวดหมู่
                            </button>
                            <button
                                type="button"
                                onClick={() => setScope('custom')}
                                className={`py-2 px-3 text-center font-bold transition-colors ${
                                    scope === 'custom' 
                                        ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' 
                                        : 'hover:bg-[var(--color-paper-3)] text-[var(--color-muted)]'
                                }`}
                            >
                                เลือกเฉพาะสูตร ({selectedIds.length})
                            </button>
                        </div>
                    </div>

                    {/* Category Selector if category scope */}
                    {scope === 'category' && (
                        <div className="border border-[var(--color-rule)] p-3 bg-[var(--color-paper)] space-y-1.5">
                            <label className="tabular-nums text-xs font-bold text-[var(--color-neutral)] block">
                                เลือกหมวดหมู่ที่ต้องการส่งออก
                            </label>
                            <select
                                value={selectedCatId}
                                onChange={e => setSelectedCatId(e.target.value)}
                                className="w-full p-2 border border-[var(--color-rule)] bg-[var(--color-paper)] text-sm outline-none focus:border-[var(--color-ink)]"
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
                        <div className="border border-[var(--color-rule)] bg-[var(--color-paper)]">
                            <div className="p-2 bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] flex justify-between items-center tabular-nums text-xs">
                                <span className="font-bold text-[var(--color-ink)]">
                                    รายการสูตร ({selectedIds.length} / {recipes.length} เลือกแล้ว)
                                </span>
                                <div className="flex gap-2">
                                    <button 
                                        type="button" 
                                        onClick={() => setSelectedIds(recipes.map(r => r.id))} 
                                        className="text-[var(--brand-plum)] hover:underline font-bold"
                                    >
                                        เลือกทั้งหมด
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setSelectedIds([])} 
                                        className="text-[var(--color-neutral)] hover:underline"
                                    >
                                        ล้างการเลือก
                                    </button>
                                </div>
                            </div>
                            <div className="max-h-48 overflow-y-auto divide-y divide-[var(--color-paper-3)] p-1">
                                {recipes.map(r => {
                                    const isChecked = selectedIds.includes(r.id);
                                    return (
                                        <label 
                                            key={r.id} 
                                            className="p-2 flex items-center justify-between hover:bg-[var(--color-paper)] cursor-pointer select-none"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <input 
                                                    type="checkbox" 
                                                    checked={isChecked} 
                                                    onChange={() => toggleRecipe(r.id)} 
                                                    className="w-4 h-4 rounded text-[var(--color-ink)] border-[var(--color-rule)] focus:ring-0" 
                                                />
                                                <span className="font-bold text-xs text-[var(--color-ink)] truncate">{r.name}</span>
                                            </div>
                                            <span className="tabular-nums text-xs text-[var(--color-neutral)]">
                                                {r.category?.label || 'ทั่วไป'}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Book Options */}
                    {!isSingleRecipe && scope !== 'single' ? (
                        <div className="border border-[var(--color-rule)] p-3 bg-[var(--color-paper)] space-y-2">
                            <span className="tabular-nums text-xs font-bold text-[var(--color-neutral)] block">
                                ตัวเลือกโครงสร้างเล่ม (BOOK STRUCTURE)
                            </span>
                            <label className="flex items-center gap-2 text-xs tabular-nums cursor-pointer select-none">
                                <input 
                                    type="checkbox" 
                                    checked={includeCover} 
                                    onChange={e => setIncludeCover(e.target.checked)} 
                                    className="w-4 h-4 rounded text-[var(--color-ink)] border-[var(--color-rule)] focus:ring-0" 
                                />
                                <span className="text-[var(--color-ink)]">
                                    รวมหน้าปกและสารบัญพร้อมเลขหน้า (Cover & Table of Contents)
                                </span>
                            </label>
                        </div>
                    ) : (
                        <div className="border border-[var(--color-rule)] p-2.5 bg-[var(--color-paper-2)] tabular-nums text-xs text-[var(--color-muted)] flex items-center justify-between">
                            <span>รูปแบบการพิมพ์:</span>
                            <span className="font-bold text-[var(--color-ink)]">สูตรเดี่ยว 1 หน้าจบพอดี ไม่มีใบปะหน้า</span>
                        </div>
                    )}

                    {/* Summary Box */}
                    <div className="border border-[var(--color-rule)] p-3 bg-[var(--color-paper-2)] tabular-nums text-xs flex justify-between items-center">
                        <span className="text-[var(--color-neutral)]">ขนาดเอกสารประเมิน:</span>
                        <span className="font-bold text-[var(--color-ink)]">
                            {targetRecipes.length} สูตร ({totalPages} หน้า A4 {isSingleRecipe ? '• 1 หน้าจบ' : ''})
                        </span>
                    </div>

                    {/* Progress indicator when generating */}
                    {isGenerating && (
                        <div className="border border-[var(--brand-plum)] p-3 bg-[oklch(95%_0.02_45)]/20 tabular-nums text-xs text-center space-y-2 ">
                            <div className="flex items-center justify-center gap-2 font-bold text-[var(--brand-plum)]">
                                <Loader2 size={16} className="animate-spin" />
                                <span>กำลังประมวลผล PDF หน้า {progress.current} จาก {progress.total}...</span>
                            </div>
                            <p className="text-[13px] text-[var(--color-muted)]">กรุณารอสักครู่ ระบบกำลังจัดหน้าเวกเตอร์และเรนเดอร์แบบความละเอียดสูง</p>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="p-4 border-t border-[var(--color-rule)] bg-[var(--color-paper-2)] flex justify-end gap-3 tabular-nums text-xs">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isGenerating}
                        className="admin-btn h-9"
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="button"
                        onClick={handleGeneratePdf}
                        disabled={isGenerating || targetRecipes.length === 0}
                        className="admin-btn is-primary h-9 disabled:opacity-50"
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
                {/* 1. Cover Sheet only if multi-recipe and requested */}
                {effectiveIncludeCover && (
                    <ManualCoverSheet 
                        recipes={targetRecipes} 
                        department={department} 
                        totalPages={totalPages} 
                    />
                )}

                {/* 2. Individual Recipe Sheets */}
                {targetRecipes.map((recipe, idx) => {
                    const pageNum = (effectiveIncludeCover ? 1 : 0) + idx + 1;
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
