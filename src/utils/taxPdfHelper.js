/**
 * Tax Invoice & Official Receipt PDF Generator Utility
 * Generates crisp, proportional A4 PDF documents from printable HTML sheets using html-to-image & jsPDF.
 * Fully compatible with modern CSS (OKLCH, CSS Variables, Flex/Grid layouts, Print stylesheets).
 * Enhanced for iOS Safari, Android, and LINE in-app browsers with Web Share API and memory-safe pixel ratios.
 */
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

/**
 * Checks if the current environment is a mobile / tablet browser
 * @returns {boolean}
 */
export function isMobileBrowser() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const isMobileUa = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini|Line/i.test(ua);
    return isMobileUa || (isTouch && window.innerWidth < 1024);
}

/**
 * Generates an A4 PDF Blob and Data URL from an HTML element
 * @param {HTMLElement} element - DOM element to render (e.g. document.getElementById('tax-invoice-printable-sheet'))
 * @param {Object} options - Configuration options
 * @param {string} [options.fileName='tax-invoice.pdf'] - Output PDF filename
 * @param {string} [options.orientation] - 'portrait' | 'landscape' (auto-detected if omitted)
 * @param {number} [options.pixelRatio] - Resolution multiplier (default 2.0 on mobile, 2.5 on desktop)
 * @returns {Promise<{ pdf: jsPDF, blob: Blob, file: File, dataUrl: string, fileName: string }>}
 */
export async function generateTaxDocumentPdf(element, options = {}) {
    if (!element) {
        throw new Error('Element to generate PDF from is missing');
    }

    const fileName = options.fileName || 'tax-invoice.pdf';

    // 1. Wait for document fonts to be ready
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
        try {
            await document.fonts.ready;
        } catch {
            // Non-fatal if font check is not available
        }
    }

    // 2. Find individual page sheets if present, or fallback to the root element
    const pageSheets = element.querySelectorAll ? Array.from(element.querySelectorAll('.print-page-sheet')) : [];
    const targets = pageSheets.length > 0 ? pageSheets : [element];

    // Detect orientation from options or first target dimensions
    const firstTarget = targets[0];
    const initialWidth = firstTarget.offsetWidth || firstTarget.scrollWidth || 800;
    const initialHeight = firstTarget.offsetHeight || firstTarget.scrollHeight || 1130;
    const isLandscape = options.orientation === 'landscape' || (options.orientation !== 'portrait' && initialWidth > initialHeight * 1.15);

    const orientation = isLandscape ? 'landscape' : 'portrait';
    const pdfWidth = isLandscape ? 297 : 210; // mm
    const pdfHeight = isLandscape ? 210 : 297; // mm

    // 3. Adaptive pixel ratio to guarantee stability on iOS Safari without canvas memory exhaustion
    const isMobile = isMobileBrowser();
    const adaptivePixelRatio = options.pixelRatio || (isMobile ? 2.0 : 2.5);

    // 4. Initialize jsPDF in correct mode
    const pdf = new jsPDF({
        orientation,
        unit: 'mm',
        format: 'a4',
        compress: true
    });

    // 5. Capture and append each page
    for (let i = 0; i < targets.length; i++) {
        if (i > 0) {
            pdf.addPage('a4', orientation);
        }

        const target = targets[i];
        const targetWidth = target.offsetWidth || target.scrollWidth || initialWidth;
        const targetHeight = target.offsetHeight || target.scrollHeight || initialHeight;
        const aspectRatio = targetHeight / targetWidth;

        let imgData = null;
        try {
            imgData = await toPng(target, {
                pixelRatio: adaptivePixelRatio,
                backgroundColor: '#ffffff',
                cacheBust: false,
                quality: 0.98,
                skipAutoScale: true,
                filter: (node) => {
                    if (node.classList && (node.classList.contains('print:hidden') || node.classList.contains('no-print'))) {
                        return false;
                    }
                    return true;
                }
            });
        } catch (captureErr) {
            console.warn('First pass capture warning, retrying with fallback settings:', captureErr);
            // Fallback retry with safe pixelRatio 1.5
            imgData = await toPng(target, {
                pixelRatio: 1.5,
                backgroundColor: '#ffffff',
                cacheBust: true,
                filter: (node) => !(node.classList && (node.classList.contains('print:hidden') || node.classList.contains('no-print')))
            });
        }

        // Calculate rendered height in mm based on full page width (no stretching/squishing)
        const renderedHeightMm = pdfWidth * aspectRatio;

        if (renderedHeightMm <= pdfHeight) {
            // Fits cleanly within A4 height: preserve 100% natural proportions
            pdf.addImage(
                imgData,
                'PNG',
                0,
                0,
                pdfWidth,
                renderedHeightMm,
                undefined,
                'FAST'
            );
        } else {
            // If taller than A4, scale down proportionally to fit the page without distortion
            const scale = pdfHeight / renderedHeightMm;
            const scaledWidthMm = pdfWidth * scale;
            const offsetX = (pdfWidth - scaledWidthMm) / 2;
            pdf.addImage(
                imgData,
                'PNG',
                offsetX,
                0,
                scaledWidthMm,
                pdfHeight,
                undefined,
                'FAST'
            );
        }
    }

    // 6. Generate Blob and File instances
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
 * Robust Mobile & Desktop PDF Save / Share Dispatcher
 * - On Mobile (iOS / Android): Uses Web Share API if supported to open native Save to Files / LINE / Drive sheet.
 * - On Desktop / Fallback: Triggers standard browser download or opens in new tab.
 * 
 * @param {Object} pdfResult - Object returned from generateTaxDocumentPdf
 * @param {Blob|File} [pdfResult.blob]
 * @param {File} [pdfResult.file]
 * @param {string} [pdfResult.dataUrl]
 * @param {string} [pdfResult.fileName]
 * @param {Object} [options]
 * @param {string} [options.title] - Share title
 * @param {string} [options.text] - Share description
 * @param {boolean} [options.preferShare=true] - Prefer Web Share on mobile
 * @returns {Promise<{ shared: boolean, downloaded: boolean, openedInTab: boolean }>}
 */
export async function saveOrShareTaxPdf(pdfResult, options = {}) {
    const fileName = options.fileName || pdfResult?.fileName || 'tax-invoice.pdf';
    const blob = pdfResult?.blob || (pdfResult instanceof Blob ? pdfResult : null);
    const file = pdfResult?.file || (blob ? new File([blob], fileName, { type: 'application/pdf' }) : null);
    const dataUrl = pdfResult?.dataUrl || (blob ? URL.createObjectURL(blob) : null);
    const title = options.title || fileName.replace('.pdf', '');
    const text = options.text || `เอกสารทางการ ${title}`;

    const isMobile = isMobileBrowser();

    // 1. Try Native Web Share API with File (iOS 15+, Android Chrome, modern WebKit)
    if (options.preferShare !== false && isMobile && file && typeof navigator !== 'undefined' && navigator.canShare) {
        try {
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title,
                    text,
                    files: [file]
                });
                return { shared: true, downloaded: false, openedInTab: false };
            }
        } catch (shareErr) {
            // User cancelled share or share aborted
            if (shareErr.name === 'AbortError') {
                return { shared: false, downloaded: false, openedInTab: false, cancelled: true };
            }
            console.warn('Web Share failed, falling back to direct download/view:', shareErr);
        }
    }

    // 2. Mobile iOS / LINE fallback: Open PDF in new tab if direct download is blocked
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    const isLineApp = /Line/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);

    if (isIOS && !isLineApp && dataUrl) {
        // iOS Safari handles window.open on blob cleanly
        const opened = window.open(dataUrl, '_blank');
        if (opened) {
            return { shared: false, downloaded: false, openedInTab: true };
        }
    }

    // 3. Standard Download via <a> tag
    if (blob || file) {
        const downloadUrl = dataUrl || URL.createObjectURL(blob || file);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => {
            if (!pdfResult?.dataUrl) {
                URL.revokeObjectURL(downloadUrl);
            }
        }, 15000);
        return { shared: false, downloaded: true, openedInTab: false };
    }

    // 4. jsPDF instance fallback
    if (pdfResult?.pdf && typeof pdfResult.pdf.save === 'function') {
        pdfResult.pdf.save(fileName);
        return { shared: false, downloaded: true, openedInTab: false };
    }

    return { shared: false, downloaded: false, openedInTab: false };
}

/**
 * Direct download backward compatibility
 * @param {jsPDF|Blob|File} pdfOrBlob 
 * @param {string} fileName 
 */
export function downloadTaxPdf(pdfOrBlob, fileName = 'tax-invoice.pdf') {
    if (pdfOrBlob instanceof Blob || pdfOrBlob instanceof File) {
        saveOrShareTaxPdf({ blob: pdfOrBlob, fileName }, { preferShare: false });
    } else if (pdfOrBlob && typeof pdfOrBlob.save === 'function') {
        pdfOrBlob.save(fileName);
    }
}

/**
 * Opens a generated PDF directly in a new browser tab for full previewing
 * @param {Object} pdfResult 
 */
export function openPdfInNewTab(pdfResult) {
    if (!pdfResult) return;
    const url = pdfResult.dataUrl || (pdfResult.blob ? URL.createObjectURL(pdfResult.blob) : null);
    if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}
