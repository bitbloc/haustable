/**
 * Receipt Image Processing Engine
 * High-performance client-side HTML5 Canvas algorithms for:
 * 1. Auto-Cropping (Luminosity & Edge Gradient Bounding)
 * 2. High-Contrast B&W Document Scanning (Adaptive/Otsu & Fixed Thresholding)
 * 3. 3x3 Convolution Sharpening (High-pass filter for crisp Thai text & numbers)
 * 4. Exposure, Brightness, Contrast & Level Adjustments
 * 5. Batch Image Enhancement & Export
 */

/**
 * Loads an image from a URL or Base64 string into an HTMLImageElement
 * @param {string} src 
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImageElement(src) {
    return new Promise((resolve, reject) => {
        if (!src) return reject(new Error('Empty image source'));
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(new Error(`Failed to load image: ${err?.message || 'Network/CORS error'}`));
        img.src = src;
    });
}

/**
 * Auto-detects the rectangular receipt bounds on a contrasting background
 * Scans image luminosity gradient along rows and columns to find the paper envelope.
 * 
 * @param {HTMLImageElement|HTMLCanvasElement|string} source 
 * @param {number} [marginRatio=0.01] - Extra padding margin inside or outside
 * @returns {Promise<{ x: number, y: number, width: number, height: number }>}
 */
export async function detectReceiptCropBounds(source, marginRatio = 0.01) {
    let img;
    if (typeof source === 'string') {
        img = await loadImageElement(source);
    } else {
        img = source;
    }

    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;

    // Use a downscaled canvas for fast processing
    const sampleMax = 600;
    let sampleW = origW;
    let sampleH = origH;
    if (sampleW > sampleH) {
        if (sampleW > sampleMax) {
            sampleH = Math.round(sampleH * (sampleMax / sampleW));
            sampleW = sampleMax;
        }
    } else {
        if (sampleH > sampleMax) {
            sampleW = Math.round(sampleW * (sampleMax / sampleH));
            sampleH = sampleMax;
        }
    }

    const canvas = document.createElement('canvas');
    canvas.width = sampleW;
    canvas.height = sampleH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, sampleW, sampleH);

    const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
    const data = imgData.data;

    // 1. Calculate row and column luminance profiles
    const rowLuminance = new Float32Array(sampleH);
    const colLuminance = new Float32Array(sampleW);

    for (let y = 0; y < sampleH; y++) {
        let rowSum = 0;
        const rowOffset = y * sampleW * 4;
        for (let x = 0; x < sampleW; x++) {
            const idx = rowOffset + (x * 4);
            // Relative luminance (Rec. 709)
            const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            rowSum += lum;
            colLuminance[x] += lum;
        }
        rowLuminance[y] = rowSum / sampleW;
    }
    for (let x = 0; x < sampleW; x++) {
        colLuminance[x] = colLuminance[x] / sampleH;
    }

    // 2. Compute background baseline from edges (corners)
    const cornerMarginY = Math.max(1, Math.floor(sampleH * 0.05));
    const cornerMarginX = Math.max(1, Math.floor(sampleW * 0.05));
    
    let bgEstimate = (
        rowLuminance[0] + rowLuminance[sampleH - 1] + 
        colLuminance[0] + colLuminance[sampleW - 1]
    ) / 4;

    // Find min and max luminance
    let minLum = 255;
    let maxLum = 0;
    for (let y = 0; y < sampleH; y++) {
        if (rowLuminance[y] < minLum) minLum = rowLuminance[y];
        if (rowLuminance[y] > maxLum) maxLum = rowLuminance[y];
    }

    // Contrast threshold between receipt paper (typically brighter) and surface
    const range = maxLum - minLum;
    // If very low contrast, return full image
    if (range < 20) {
        return { x: 0, y: 0, width: origW, height: origH };
    }

    // 3. Find boundaries (top, bottom, left, right)
    let top = 0;
    let bottom = sampleH - 1;
    let left = 0;
    let right = sampleW - 1;

    // Scan Top
    for (let y = 0; y < sampleH * 0.45; y++) {
        if (Math.abs(rowLuminance[y] - bgEstimate) > range * 0.18) {
            top = y;
            break;
        }
    }

    // Scan Bottom
    for (let y = sampleH - 1; y > sampleH * 0.55; y--) {
        if (Math.abs(rowLuminance[y] - bgEstimate) > range * 0.18) {
            bottom = y;
            break;
        }
    }

    // Scan Left
    for (let x = 0; x < sampleW * 0.45; x++) {
        if (Math.abs(colLuminance[x] - bgEstimate) > range * 0.18) {
            left = x;
            break;
        }
    }

    // Scan Right
    for (let x = sampleW - 1; x > sampleW * 0.55; x--) {
        if (Math.abs(colLuminance[x] - bgEstimate) > range * 0.18) {
            right = x;
            break;
        }
    }

    // Safety fallback if boundaries are too tight or invalid
    if ((right - left) < sampleW * 0.3 || (bottom - top) < sampleH * 0.3) {
        return { x: 0, y: 0, width: origW, height: origH };
    }

    // Scale back to original coordinates
    const scaleX = origW / sampleW;
    const scaleY = origH / sampleH;

    const padX = Math.round((right - left) * marginRatio * scaleX);
    const padY = Math.round((bottom - top) * marginRatio * scaleY);

    const cropX = Math.max(0, Math.floor(left * scaleX) - padX);
    const cropY = Math.max(0, Math.floor(top * scaleY) - padY);
    const cropW = Math.min(origW - cropX, Math.ceil((right - left) * scaleX) + (padX * 2));
    const cropH = Math.min(origH - cropY, Math.ceil((bottom - top) * scaleY) + (padY * 2));

    return {
        x: cropX,
        y: cropY,
        width: Math.max(50, cropW),
        height: Math.max(50, cropH)
    };
}

/**
 * 3x3 Convolution Sharpening kernel
 * Sharpen factor ranges from 0 (off) to 5 (extra sharp)
 */
function applySharpeningFilter(data, width, height, strength = 1.0) {
    if (strength <= 0) return;

    const clampedStrength = Math.min(3.0, Math.max(0.2, strength * 0.6));
    const kernel = [
        0, -clampedStrength, 0,
        -clampedStrength, 1 + (4 * clampedStrength), -clampedStrength,
        0, -clampedStrength, 0
    ];

    const copy = new Uint8ClampedArray(data);
    const w4 = width * 4;

    for (let y = 1; y < height - 1; y++) {
        const yOffset = y * w4;
        const yPrev = (y - 1) * w4;
        const yNext = (y + 1) * w4;

        for (let x = 1; x < width - 1; x++) {
            const x4 = x * 4;
            const idx = yOffset + x4;

            for (let c = 0; c < 3; c++) {
                const val = 
                    copy[yPrev + x4 - 4 + c] * kernel[0] +
                    copy[yPrev + x4 + c]     * kernel[1] +
                    copy[yPrev + x4 + 4 + c] * kernel[2] +
                    copy[yOffset + x4 - 4 + c] * kernel[3] +
                    copy[yOffset + x4 + c]     * kernel[4] +
                    copy[yOffset + x4 + 4 + c] * kernel[5] +
                    copy[yNext + x4 - 4 + c] * kernel[6] +
                    copy[yNext + x4 + c]     * kernel[7] +
                    copy[yNext + x4 + 4 + c] * kernel[8];

                data[idx + c] = val < 0 ? 0 : (val > 255 ? 255 : val);
            }
        }
    }
}

/**
 * Applies full document enhancement pipeline to an image source.
 * 
 * @param {string|HTMLImageElement|HTMLCanvasElement} source 
 * @param {Object} options
 * @param {'bw'|'grayscale'|'color'|'original'} [options.mode='bw'] - Filter mode
 * @param {number} [options.brightness=0] - (-100 to 100)
 * @param {number} [options.contrast=25] - (-100 to 100)
 * @param {number} [options.threshold=145] - (0 to 255) for B&W threshold
 * @param {number} [options.sharpness=1.2] - (0 to 5)
 * @param {number} [options.rotation=0] - (0, 90, 180, 270 degrees)
 * @param {{x: number, y: number, width: number, height: number}|null} [options.cropRect=null]
 * @param {number} [options.maxDimension=2400] - Max output pixel dimension for crisp print
 * @returns {Promise<{ dataUrl: string, blob: Blob, width: number, height: number }>}
 */
export async function applyDocumentEnhancement(source, options = {}) {
    const {
        mode = 'bw',
        brightness = 0,
        contrast = 25,
        threshold = 145,
        sharpness = 1.2,
        rotation = 0,
        cropRect = null,
        maxDimension = 2400
    } = options;

    let img;
    if (typeof source === 'string') {
        img = await loadImageElement(source);
    } else {
        img = source;
    }

    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;

    // 1. Determine Crop Region
    let sourceX = 0;
    let sourceY = 0;
    let sourceW = origW;
    let sourceH = origH;

    if (cropRect && cropRect.width > 10 && cropRect.height > 10) {
        sourceX = Math.max(0, Math.min(origW - 10, cropRect.x));
        sourceY = Math.max(0, Math.min(origH - 10, cropRect.y));
        sourceW = Math.min(origW - sourceX, cropRect.width);
        sourceH = Math.min(origH - sourceY, cropRect.height);
    }

    // 2. Handle Rotation Dimension Swapping
    const normRotation = ((rotation % 360) + 360) % 360;
    const isRotated90or270 = normRotation === 90 || normRotation === 270;

    let targetW = isRotated90or270 ? sourceH : sourceW;
    let targetH = isRotated90or270 ? sourceW : sourceH;

    // Scale to max dimension if needed while keeping aspect ratio
    if (targetW > maxDimension || targetH > maxDimension) {
        if (targetW > targetH) {
            targetH = Math.round(targetH * (maxDimension / targetW));
            targetW = maxDimension;
        } else {
            targetW = Math.round(targetW * (maxDimension / targetH));
            targetH = maxDimension;
        }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // 3. Draw with Rotation & Crop onto Canvas
    ctx.save();
    ctx.translate(targetW / 2, targetH / 2);
    ctx.rotate((normRotation * Math.PI) / 180);

    const drawW = isRotated90or270 ? targetH : targetW;
    const drawH = isRotated90or270 ? targetW : targetH;

    ctx.drawImage(
        img,
        sourceX, sourceY, sourceW, sourceH,
        -drawW / 2, -drawH / 2, drawW, drawH
    );
    ctx.restore();

    // If mode is 'original' with no other adjustments, we can export directly
    if (mode === 'original' && brightness === 0 && contrast === 0 && sharpness <= 0) {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve({ dataUrl, blob, width: targetW, height: targetH });
            }, 'image/jpeg', 0.92);
        });
    }

    // 4. Pixel Level Processing: Brightness, Contrast, Grayscale, Thresholding
    const imgData = ctx.getImageData(0, 0, targetW, targetH);
    const data = imgData.data;
    const totalPixels = targetW * targetH;

    // Precalculate Contrast Multiplier (Factor Formula)
    // contrast in [-100, 100] -> factor in [0, 3]
    const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const brightShift = brightness * 1.5;

    for (let i = 0; i < totalPixels * 4; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        // Apply Brightness & Contrast
        r = contrastFactor * (r - 128) + 128 + brightShift;
        g = contrastFactor * (g - 128) + 128 + brightShift;
        b = contrastFactor * (b - 128) + 128 + brightShift;

        // Clamp
        r = r < 0 ? 0 : (r > 255 ? 255 : r);
        g = g < 0 ? 0 : (g > 255 ? 255 : g);
        b = b < 0 ? 0 : (b > 255 ? 255 : b);

        // Calculate Luminance
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        if (mode === 'bw') {
            // Adaptive clean-paper thresholding
            // Values above threshold become crisp paper white (255)
            // Values below threshold become deep ink black (0 or dark gray with soft anti-aliased edge)
            const margin = 18;
            if (lum >= threshold + margin) {
                data[i] = 255;
                data[i + 1] = 255;
                data[i + 2] = 255;
            } else if (lum <= threshold - margin) {
                data[i] = 0;
                data[i + 1] = 0;
                data[i + 2] = 0;
            } else {
                // Soft edge transition for smooth Thai character rendering
                const factor = (lum - (threshold - margin)) / (margin * 2);
                const val = Math.round(factor * 255);
                data[i] = val;
                data[i + 1] = val;
                data[i + 2] = val;
            }
        } else if (mode === 'grayscale') {
            const gray = lum < 0 ? 0 : (lum > 255 ? 255 : lum);
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
        } else if (mode === 'color') {
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
        }
    }

    // 5. Apply Convolution Sharpening to ensure crisp text
    if (sharpness > 0) {
        applySharpeningFilter(data, targetW, targetH, sharpness);
    }

    ctx.putImageData(imgData, 0, 0);

    // 6. Export as high-quality JPEG
    const dataUrl = canvas.toDataURL('image/jpeg', 0.90);
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve({
                dataUrl,
                blob,
                width: targetW,
                height: targetH
            });
        }, 'image/jpeg', 0.90);
    });
}

/**
 * Enhancement Presets Configuration
 */
export const ENHANCEMENT_PRESETS = [
    {
        id: 'bw_clean',
        label: 'สแกนเอกสารขาว-ดำ (Magic B&W)',
        labelEn: 'MAGIC B&W (TAX OPTIMIZED)',
        description: 'ลบพื้นหลังและแสงสะท้อน ตัวหนังสือดำสนิท กระดาษขาวสะอาด ประหยัดหมึกพิมพ์',
        options: {
            mode: 'bw',
            brightness: 10,
            contrast: 35,
            threshold: 148,
            sharpness: 1.5
        }
    },
    {
        id: 'bw_high_contrast',
        label: 'ขาว-ดำ คมชัดพิเศษ (High Contrast)',
        labelEn: 'HIGH CONTRAST B&W',
        description: 'สำหรับใบเสร็จความร้อนที่ตัวอักษรเริ่มซีดจาง หรือภาพถ่ายในที่มืด',
        options: {
            mode: 'bw',
            brightness: -10,
            contrast: 55,
            threshold: 130,
            sharpness: 2.0
        }
    },
    {
        id: 'grayscale_crisp',
        label: 'เกรย์สเกลเนียน (Crisp Grayscale)',
        labelEn: 'CRISP GRAYSCALE',
        description: 'ไล่เฉดเทาคมชัด เก็บรายละเอียดภาพถ่ายและโลโก้ร้านค้า',
        options: {
            mode: 'grayscale',
            brightness: 5,
            contrast: 30,
            threshold: 140,
            sharpness: 1.2
        }
    },
    {
        id: 'color_enhanced',
        label: 'ภาพสีคมชัดปรับแสง (Clean Color)',
        labelEn: 'ENHANCED COLOR',
        description: 'คงสีต้นฉบับ ปรับแสงสว่างและเพิ่มความคมชัดของข้อความ',
        options: {
            mode: 'color',
            brightness: 12,
            contrast: 20,
            threshold: 140,
            sharpness: 1.0
        }
    },
    {
        id: 'original',
        label: 'รูปต้นฉบับ (Original Raw)',
        labelEn: 'ORIGINAL RAW',
        description: 'ไม่ปรับแต่งฟิลเตอร์ ใช้ภาพจริงตามที่ถ่าย',
        options: {
            mode: 'original',
            brightness: 0,
            contrast: 0,
            threshold: 140,
            sharpness: 0
        }
    }
];

/**
 * Downloads a Base64 data URL or Blob as a file
 * @param {string|Blob} dataUrlOrBlob 
 * @param {string} filename 
 */
export function downloadFile(dataUrlOrBlob, filename) {
    let url = dataUrlOrBlob;
    let revokeNeeded = false;

    if (dataUrlOrBlob instanceof Blob) {
        url = URL.createObjectURL(dataUrlOrBlob);
        revokeNeeded = true;
    }

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (revokeNeeded) {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}
