/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Count sheet · theme: Thai Modern OKLCH */
import React, { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { getCodeDetector } from '../../utils/codeDetector';

// Only what shop stock carries: retail barcodes (EAN / UPC), CODE 128 on cases, and our
// own QR labels. Every extra format is one more decoder tried on every frame, which is
// what makes iPhone (no built-in barcode reader, decoding in JavaScript) slow.
const FORMATS = [
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.QR_CODE
];
const explain = (err) => {
    const text = `${err?.name || ''} ${err?.message || err || ''}`;
    if (/NotAllowed|Permission/i.test(text)) return 'ไม่ได้รับอนุญาตให้ใช้กล้อง เปิดสิทธิ์กล้องให้เว็บนี้ในการตั้งค่าเบราว์เซอร์ แล้วกดลองใหม่';
    if (/NotFound|Requested device not found|no camera/i.test(text)) return 'ไม่พบกล้องบนเครื่องนี้';
    if (/NotReadable|Could not start/i.test(text)) return 'กล้องถูกแอปอื่นใช้อยู่ ปิดแอปนั้นแล้วกดลองใหม่';
    if (typeof window !== 'undefined' && !window.isSecureContext) return 'ต้องเปิดผ่าน https ถึงจะใช้กล้องได้';
    return 'เปิดกล้องไม่สำเร็จ กดลองใหม่';
};

const isCameraError = (err) => /NotAllowed|Permission|NotFound|NotReadable|Overconstrained|Requested device/i.test(`${err?.name || ''} ${err?.message || ''}`);

/**
 * Camera strip that keeps scanning until closed.
 *
 * Three engines, fastest first (see utils/codeDetector.js). Android Chrome reads the camera picture
 * with the browser's own BarcodeDetector. iPhone and iPad, which have none, decode each frame with
 * zxing compiled to WebAssembly. Only if neither can be set up does the strip fall back to
 * html5-qrcode, which decodes in JavaScript and is several times slower.
 * onCode(text) is called for every decode; the caller decides what counts.
 */
export default function ScanStrip({ onCode, onClose, status }) {
    const rawId = useId();
    const elementId = `scan-strip-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const onCodeRef = useRef(onCode);
    const videoRef = useRef(null);
    const [state, setState] = useState('starting'); // starting | running | error
    const [engine, setEngine] = useState(null); // 'native' | 'wasm' | 'lib'
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);

    useEffect(() => { onCodeRef.current = onCode; }, [onCode]);

    useEffect(() => {
        let cancelled = false;
        let scanner = null;
        let stream = null;
        let frameHandle = null;
        setState('starting');
        setError('');

        const stopStream = () => {
            const video = videoRef.current;
            if (video && frameHandle !== null) {
                if (video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(frameHandle);
                else cancelAnimationFrame(frameHandle);
            }
            frameHandle = null;
            stream?.getTracks().forEach(t => t.stop());
            stream = null;
            if (video) video.srcObject = null;
        };

        const startNative = async (detector, kind) => {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            if (cancelled) { stopStream(); return; }
            // Keep refocusing as items move in and out; phones that cannot simply ignore it
            stream.getVideoTracks()[0]?.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
            const video = videoRef.current;
            video.srcObject = stream;
            await video.play();
            if (cancelled) { stopStream(); return; }
            setEngine(kind);
            setState('running');

            // The WebAssembly reader takes pixels, not a video element: copy each frame to a canvas.
            // The browser's own reader takes the video as it is.
            let frame = null;
            if (kind === 'wasm') {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                frame = () => {
                    const w = video.videoWidth;
                    const h = video.videoHeight;
                    if (!w || !h) return null;
                    if (canvas.width !== w) canvas.width = w;
                    if (canvas.height !== h) canvas.height = h;
                    ctx.drawImage(video, 0, 0, w, h);
                    return ctx.getImageData(0, 0, w, h);
                };
            }

            let busy = false;
            const schedule = () => {
                if (cancelled) return;
                frameHandle = video.requestVideoFrameCallback
                    ? video.requestVideoFrameCallback(tick)
                    : requestAnimationFrame(tick);
            };
            const tick = async () => {
                if (cancelled) return;
                if (!busy && video.readyState >= 2) {
                    busy = true;
                    try {
                        const source = frame ? frame() : video;
                        const codes = source ? await detector.detect(source) : [];
                        if (!cancelled) for (const code of codes) if (code.rawValue) onCodeRef.current?.(code.rawValue);
                    } catch { /* a frame that could not be read: the next one will be */ }
                    busy = false;
                }
                schedule();
            };
            schedule();
        };

        const startLib = async () => {
            setEngine('lib');
            scanner = new Html5Qrcode(elementId, { formatsToSupport: FORMATS, verbose: false });
            await scanner.start(
                { facingMode: 'environment' },
                {
                    fps: 20,
                    // Nearly the whole picture. A short, wide box read barcodes quickly but cut the shop's
                    // square QR labels in half whenever the label was held close enough to fill the view.
                    qrbox: (w, h) => ({ width: Math.max(50, Math.floor(w * 0.9)), height: Math.max(50, Math.floor(h * 0.86)) }),
                    // Printed codes are never mirrored: skip the second, flipped decode of every frame.
                    disableFlip: true,
                    // Sharper picture so thin bars are read on the first frames (iPhone defaults to a low resolution).
                    videoConstraints: {
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        advanced: [{ focusMode: 'continuous' }]
                    },
                    experimentalFeatures: { useBarCodeDetectorIfSupported: true }
                },
                (text) => { if (!cancelled) onCodeRef.current?.(text); },
                () => {}
            );
            if (cancelled) {
                await scanner.stop().catch(() => {});
                return;
            }
            setState('running');
        };

        const start = async () => {
            try {
                const found = await getCodeDetector();
                if (cancelled) return;
                if (found) {
                    try {
                        await startNative(found.detector, found.kind);
                        return;
                    } catch (err) {
                        stopStream();
                        if (cancelled) return;
                        // No camera or no permission is the same answer for either engine: say so.
                        if (isCameraError(err)) throw err;
                        console.warn(`[ScanStrip] ${found.kind} reader failed, using the JavaScript one`, err);
                    }
                }
                await startLib();
            } catch (err) {
                if (cancelled) return;
                console.warn('[ScanStrip] camera start failed', err);
                setError(explain(err));
                setState('error');
            }
        };
        start();

        return () => {
            cancelled = true;
            stopStream();
            if (scanner) {
                try {
                    const s = scanner.getState?.();
                    if (s === 2 || s === 3) scanner.stop().then(() => scanner.clear()).catch(() => {});
                } catch { /* already stopped */ }
            }
        };
    }, [elementId, attempt]);

    return (
        <section className="border-b border-[oklch(85%_0.012_28)] bg-[oklch(18%_0.012_28)]" aria-label="สแกนบาร์โค้ด">
            <div className="relative">
                <video
                    ref={videoRef}
                    playsInline
                    muted
                    className={`w-full aspect-[16/9] max-h-[38vh] object-cover ${engine && engine !== 'lib' ? 'block' : 'hidden'}`}
                />
                <div id={elementId} className={`w-full aspect-[16/9] max-h-[38vh] overflow-hidden [&_video]:w-full [&_video]:h-full [&_video]:object-cover ${engine && engine !== 'lib' ? 'hidden' : ''}`} />
                {state !== 'running' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
                        <p className="font-sans text-[14px] leading-6 text-[oklch(94%_0.010_28)] max-w-xs">
                            {state === 'starting' ? 'กำลังเปิดกล้อง...' : error}
                        </p>
                        {state === 'error' && (
                            <button type="button" onClick={() => setAttempt(a => a + 1)}
                                className="px-4 py-2 border border-[oklch(85%_0.012_28)] font-sans font-bold text-[13px] text-[oklch(97%_0.008_28)] cursor-pointer">
                                ลองใหม่
                            </button>
                        )}
                    </div>
                )}
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center divide-x divide-[oklch(42%_0.010_28)] border-t border-[oklch(42%_0.010_28)]">
                <p className="px-3 py-2 font-sans text-[13px] leading-5 text-[oklch(94%_0.010_28)] min-w-0 break-words" aria-live="polite">
                    {status || 'ส่องบาร์โค้ดทีละชิ้น สแกน 1 ครั้ง = นับเพิ่ม 1'}
                </p>
                <button type="button" onClick={onClose}
                    className="px-4 py-2 font-sans font-bold text-[13px] text-[oklch(97%_0.008_28)] hover:bg-[oklch(25%_0.012_28)] cursor-pointer">
                    ปิดกล้อง
                </button>
            </div>
        </section>
    );
}
