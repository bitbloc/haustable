/**
 * sopPdfHelper.js
 * High-definition, proportional A4 PDF Document Generator for In The Haus SOP Manuals.
 * Powered by html-to-image and jsPDF.
 * Fully compliant with Dieter Rams + Thai Modern OKLCH styling.
 */

import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { isMobileBrowser } from './taxPdfHelper';

/**
 * Generate A4 PDF from an offscreen DOM element containing one or multiple pages.
 * @param {HTMLElement} element - Root element containing `.sop-print-sheet` pages
 * @param {Object} options
 * @param {string} [options.fileName='haus-sop-manual.pdf']
 * @param {Function} [options.onProgress] - Callback (current, total)
 * @returns {Promise<{ pdf: jsPDF, blob: Blob, file: File, dataUrl: string, fileName: string }>}
 */
export async function generateSOPPdfDocument(element, options = {}) {
    if (!element) {
        throw new Error('Element to generate SOP PDF from is missing');
    }

    const fileName = options.fileName || 'haus-sop-manual.pdf';

    // 1. Wait for document fonts to load completely
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
        try {
            await document.fonts.ready;
        } catch {
            // non-fatal
        }
    }

    // 2. Identify individual A4 page sheets
    const pageSheets = Array.from(element.querySelectorAll('.sop-print-sheet'));
    const targets = pageSheets.length > 0 ? pageSheets : [element];

    const orientation = 'portrait';
    const pdfWidth = 210; // mm
    const pdfHeight = 297; // mm

    // Standard A4 pixel dimensions at 96 DPI: 794px x 1123px
    const standardWidth = 794;
    const standardHeight = 1123;

    // Pixel ratio: 2.0 on mobile to prevent memory exhaustion, 2.5 on desktop
    const isMobile = isMobileBrowser();
    const pixelRatio = options.pixelRatio || (isMobile ? 2.0 : 2.5);

    const pdf = new jsPDF({
        orientation,
        unit: 'mm',
        format: 'a4',
        compress: true
    });

    for (let i = 0; i < targets.length; i++) {
        if (i > 0) {
            pdf.addPage('a4', orientation);
        }

        if (options.onProgress) {
            options.onProgress(i + 1, targets.length);
        }

        const target = targets[i];

        // Measure content height and scale proportionally if content slightly exceeds A4 (1123px)
        // This guarantees that 100% of tables and footer fit cleanly without clipping
        const scrollH = target.scrollHeight || standardHeight;
        const needsScale = scrollH > standardHeight;
        const scaleFactor = needsScale ? Math.max(0.75, (standardHeight - 4) / scrollH) : 1;
        const targetTransform = needsScale ? `scale(${scaleFactor})` : 'none';

        let imgData = null;
        try {
            imgData = await toPng(target, {
                pixelRatio,
                backgroundColor: '#fbf9f5', // Warm paper tint
                cacheBust: false,
                quality: 0.98,
                width: standardWidth,
                height: standardHeight,
                canvasWidth: Math.round(standardWidth * pixelRatio),
                canvasHeight: Math.round(standardHeight * pixelRatio),
                style: {
                    width: `${standardWidth}px`,
                    minWidth: `${standardWidth}px`,
                    maxWidth: `${standardWidth}px`,
                    height: `${standardHeight}px`,
                    minHeight: `${standardHeight}px`,
                    maxHeight: `${standardHeight}px`,
                    margin: '0',
                    transform: targetTransform,
                    transformOrigin: 'top center',
                    boxSizing: 'border-box'
                },
                filter: (node) => {
                    if (node.classList && (node.classList.contains('print:hidden') || node.classList.contains('no-print'))) {
                        return false;
                    }
                    return true;
                }
            });
        } catch (err) {
            console.warn('First pass capture warning, retrying with fallback settings:', err);
            imgData = await toPng(target, {
                pixelRatio: 1.5,
                backgroundColor: '#ffffff',
                cacheBust: true,
                width: standardWidth,
                height: standardHeight,
                style: {
                    width: `${standardWidth}px`,
                    minWidth: `${standardWidth}px`,
                    maxWidth: `${standardWidth}px`,
                    height: `${standardHeight}px`,
                    margin: '0',
                    transform: targetTransform,
                    transformOrigin: 'top center',
                    boxSizing: 'border-box'
                },
                filter: (node) => !(node.classList && (node.classList.contains('print:hidden') || node.classList.contains('no-print')))
            });
        }

        pdf.addImage(
            imgData,
            'PNG',
            0,
            0,
            pdfWidth,
            pdfHeight,
            undefined,
            'FAST'
        );
    }

    const blob = pdf.output('blob');
    const file = new File([blob], fileName, { type: 'application/pdf' });
    const dataUrl = URL.createObjectURL(blob);

    return {
        pdf,
        blob,
        file,
        dataUrl,
        fileName
    };
}

/**
 * Dispatcher: Download or share PDF depending on device
 * @param {Object} pdfResult 
 * @param {Object} options 
 */
export async function saveOrShareSOPPdf(pdfResult, options = {}) {
    const fileName = options.fileName || pdfResult?.fileName || 'haus-sop-manual.pdf';
    const blob = pdfResult?.blob || (pdfResult instanceof Blob ? pdfResult : null);
    const file = pdfResult?.file || (blob ? new File([blob], fileName, { type: 'application/pdf' }) : null);
    const dataUrl = pdfResult?.dataUrl || (blob ? URL.createObjectURL(blob) : null);
    const title = options.title || 'In The Haus — SOP Manual';
    const text = options.text || 'คู่มือสูตรมาตรฐานและขั้นตอนการปฏิบัติงาน (SOP)';

    const isMobile = isMobileBrowser();

    // 1. Try Native Web Share API on mobile devices
    if (options.preferShare !== false && isMobile && file && typeof navigator !== 'undefined' && navigator.canShare) {
        try {
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title,
                    text,
                    files: [file]
                });
                return { shared: true, downloaded: false };
            }
        } catch (shareErr) {
            if (shareErr.name === 'AbortError') {
                return { shared: false, downloaded: false, cancelled: true };
            }
            console.warn('Web Share failed, falling back to download:', shareErr);
        }
    }

    // 2. Desktop or Mobile fallback: standard browser trigger
    if (typeof document !== 'undefined') {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = fileName;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
        }, 150);
        return { shared: false, downloaded: true };
    }

    return { shared: false, downloaded: false };
}
