/**
 * Tax Invoice & Official Receipt PDF Generator Utility
 * Generates crisp A4 PDF documents from printable HTML sheets using html2canvas & jsPDF.
 */
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Generates an A4 PDF Blob and Data URL from an HTML element
 * @param {HTMLElement} element - DOM element to render (e.g. document.getElementById('tax-invoice-printable-sheet'))
 * @param {Object} options - Configuration options
 * @param {string} options.fileName - Output PDF filename (e.g. 'REC-202608-6778.pdf')
 * @returns {Promise<{ pdf: jsPDF, blob: Blob, file: File, dataUrl: string, fileName: string }>}
 */
export async function generateTaxDocumentPdf(element, options = {}) {
    if (!element) {
        throw new Error('Element to generate PDF from is missing');
    }

    const fileName = options.fileName || 'tax-invoice.pdf';

    // 1. Capture high-resolution raster canvas (scale: 2 for crisp 300dpi-equivalent print quality)
    const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: element.scrollWidth || 1024,
        onclone: (clonedDoc) => {
            // Ensure printable element is visible and properly styled in clone
            const clonedEl = clonedDoc.getElementById(element.id) || clonedDoc.querySelector('[id="tax-invoice-printable-sheet"]');
            if (clonedEl) {
                clonedEl.style.transform = 'none';
                clonedEl.style.boxShadow = 'none';
                clonedEl.style.borderRadius = '0';
                clonedEl.style.margin = '0';
                clonedEl.style.width = '100%';
                clonedEl.style.maxWidth = '100%';
            }
        }
    });

    // 2. Initialize jsPDF in A4 Portrait mode
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
    });

    const pdfWidth = pdf.internal.pageSize.getWidth(); // 210 mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // 297 mm

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const imgProps = pdf.getImageProperties(imgData);
    const imgRatio = imgProps.height / imgProps.width;

    // Standard A4 Print Margin (6mm)
    const margin = 6;
    const renderWidth = pdfWidth - (margin * 2);
    let renderHeight = renderWidth * imgRatio;

    // Constrain height if it slightly exceeds single A4 page
    if (renderHeight > (pdfHeight - (margin * 2))) {
        renderHeight = pdfHeight - (margin * 2);
    }

    // Top-aligned with clean margins
    pdf.addImage(
        imgData,
        'JPEG',
        margin,
        margin,
        renderWidth,
        renderHeight,
        undefined,
        'FAST'
    );

    // 3. Generate Blob and File instances
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
 * @param {jsPDF|Blob} pdfOrBlob 
 * @param {string} fileName 
 */
export function downloadTaxPdf(pdfOrBlob, fileName = 'tax-invoice.pdf') {
    if (pdfOrBlob instanceof Blob) {
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
