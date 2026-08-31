/**
 * Tax Invoice & Official Receipt PDF Generator Utility
 * Generates crisp, proportional A4 PDF documents from printable HTML sheets using html-to-image & jsPDF.
 * Fully compatible with modern CSS (OKLCH, CSS Variables, Flex/Grid layouts).
 */
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

/**
 * Generates an A4 PDF Blob and Data URL from an HTML element
 * @param {HTMLElement} element - DOM element to render (e.g. document.getElementById('tax-invoice-printable-sheet'))
 * @param {Object} options - Configuration options
 * @param {string} options.fileName - Output PDF filename (e.g. 'REC-202608-6778.pdf')
 * @param {string} options.orientation - 'portrait' | 'landscape' (auto-detected if omitted)
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

    // 3. Initialize jsPDF in correct mode
    const pdf = new jsPDF({
        orientation,
        unit: 'mm',
        format: 'a4',
        compress: true
    });

    // 4. Capture and append each page
    for (let i = 0; i < targets.length; i++) {
        if (i > 0) {
            pdf.addPage('a4', orientation);
        }

        const target = targets[i];
        const targetWidth = target.offsetWidth || target.scrollWidth || initialWidth;
        const targetHeight = target.offsetHeight || target.scrollHeight || initialHeight;
        const aspectRatio = targetHeight / targetWidth;

        const imgData = await toPng(target, {
            pixelRatio: 3.0, // High-DPI 300+ resolution
            backgroundColor: '#ffffff',
            cacheBust: true,
            quality: 1.0,
            filter: (node) => {
                if (node.classList && (node.classList.contains('print:hidden') || node.classList.contains('no-print'))) {
                    return false;
                }
                return true;
            }
        });

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

    // 5. Generate Blob and File instances
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
 * Downloads a generated PDF directly to the user's browser
 * @param {jsPDF|Blob|File} pdfOrBlob 
 * @param {string} fileName 
 */
export function downloadTaxPdf(pdfOrBlob, fileName = 'tax-invoice.pdf') {
    if (pdfOrBlob instanceof Blob || pdfOrBlob instanceof File) {
        const url = URL.createObjectURL(pdfOrBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    } else if (pdfOrBlob && typeof pdfOrBlob.save === 'function') {
        pdfOrBlob.save(fileName);
    }
}
