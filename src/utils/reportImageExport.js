import { toPng } from 'html-to-image';
import html2canvas from 'html2canvas';

/**
 * Render a report element to a full-height PNG data URL from a detached offscreen clone,
 * so scroll containers and the viewport do not crop it. Same approach as the monthly
 * executive report: html-to-image first, html2canvas as fallback.
 */
export const exportElementImage = async (element, width = 1000) => {
    if (!element) return null;
    const container = document.createElement('div');
    Object.assign(container.style, {
        position: 'fixed', left: '-10000px', top: '0', width: `${width}px`,
        background: '#ffffff', zIndex: '-1', margin: '0', padding: '0'
    });
    const clone = element.cloneNode(true);
    Object.assign(clone.style, {
        width: `${width}px`, maxWidth: `${width}px`, height: 'auto', overflow: 'visible', transform: 'none', margin: '0'
    });
    clone.querySelectorAll('[data-export-hide]').forEach(n => n.remove());
    clone.querySelectorAll('[data-export-unclip]').forEach(n => { n.style.overflow = 'visible'; n.style.maxHeight = 'none'; });
    container.appendChild(clone);
    document.body.appendChild(container);
    await new Promise(r => setTimeout(r, 150));
    try {
        const height = Math.max(clone.scrollHeight, clone.offsetHeight);
        const scale = height * 2 > 6000 ? Math.max(1, +(6000 / height).toFixed(2)) : 2;
        try {
            const url = await toPng(clone, { pixelRatio: scale, cacheBust: true, skipFonts: true, backgroundColor: '#ffffff', width, height });
            if (url && url.length > 5000) return url;
        } catch (err) {
            console.warn('toPng failed, falling back to html2canvas:', err);
        }
        const canvas = await html2canvas(clone, { scale, backgroundColor: '#ffffff', useCORS: true, logging: false, width, height });
        return canvas.toDataURL('image/png');
    } finally {
        container.remove();
    }
};

export const downloadDataUrl = (dataUrl, filename) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => link.remove(), 100);
};

export const copyDataUrlImage = async (dataUrl) => {
    const blob = await (await fetch(dataUrl)).blob();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
};
