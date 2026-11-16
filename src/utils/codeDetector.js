/**
 * A barcode reader for camera frames, the fastest one the phone can run.
 *
 * - 'native': the browser's own BarcodeDetector (Android Chrome). Reads the camera picture directly.
 * - 'wasm':   the same interface from the barcode-detector package (zxing-cpp compiled to WebAssembly),
 *             for browsers with no reader of their own: iPhone and iPad Safari. Many times faster than
 *             a decoder written in JavaScript. The .wasm file is served by this app, not a CDN, so the
 *             scanner works on the shop's own network rules and offline once cached.
 * - null:     neither could be set up; the caller falls back to html5-qrcode.
 */

// What shop stock carries: retail barcodes (EAN / UPC), CODE 128 on cases, and our own QR labels.
// Every extra format is one more decoder tried on every frame.
export const SCAN_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'code_128', 'qr_code'];

const nativeDetector = async () => {
    if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return null;
    const supported = await window.BarcodeDetector.getSupportedFormats();
    if (!SCAN_FORMATS.every(f => supported.includes(f))) return null;
    return new window.BarcodeDetector({ formats: SCAN_FORMATS });
};

let wasmDetectorPromise = null;
const wasmDetector = () => {
    // Loaded once per page, and only on phones that need it: Android never downloads the 0.9 MB file.
    wasmDetectorPromise ??= (async () => {
        const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
            import('barcode-detector/ponyfill'),
            import('zxing-wasm/reader/zxing_reader.wasm?url')
        ]);
        prepareZXingModule({
            overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) }
        });
        const detector = new BarcodeDetector({ formats: SCAN_FORMATS });
        // Warm up: fetch and compile the module now, so the first real frame is not the slow one,
        // and a phone that cannot run it is found out before the camera opens.
        await detector.detect(new ImageData(16, 16));
        return detector;
    })().catch((err) => {
        wasmDetectorPromise = null;
        throw err;
    });
    return wasmDetectorPromise;
};

/** -> { detector, kind: 'native' | 'wasm' } or null. Never throws. */
export async function getCodeDetector() {
    try {
        const native = await nativeDetector();
        if (native) return { detector: native, kind: 'native' };
    } catch { /* try the next one */ }
    try {
        return { detector: await wasmDetector(), kind: 'wasm' };
    } catch (err) {
        console.warn('[codeDetector] WebAssembly reader unavailable', err);
        return null;
    }
}

/** Start loading the reader before the camera is opened (call when a scan screen mounts). */
export const preloadCodeDetector = () => { getCodeDetector(); };
