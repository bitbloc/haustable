/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Count sheet · theme: Thai Modern OKLCH */
import React, { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

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

/**
 * Camera strip that keeps scanning until closed. Works on Android Chrome (native
 * BarcodeDetector when available) and iPhone Safari (built-in decoder).
 * onCode(text) is called for every decode; the caller decides what counts.
 */
export default function ScanStrip({ onCode, onClose, status }) {
    const rawId = useId();
    const elementId = `scan-strip-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const onCodeRef = useRef(onCode);
    const [state, setState] = useState('starting'); // starting | running | error
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);

    useEffect(() => { onCodeRef.current = onCode; }, [onCode]);

    useEffect(() => {
        let cancelled = false;
        let scanner = null;
        setState('starting');
        setError('');

        const start = async () => {
            try {
                scanner = new Html5Qrcode(elementId, { formatsToSupport: FORMATS, verbose: false });
                await scanner.start(
                    { facingMode: 'environment' },
                    {
                        fps: 20,
                        // Barcodes are wide: a wide, short box means fewer pixels to decode per frame.
                        qrbox: (w, h) => ({ width: Math.floor(w * 0.86), height: Math.floor(Math.min(h * 0.5, w * 0.36)) }),
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
                <div id={elementId} className="w-full aspect-[16/9] max-h-[38vh] overflow-hidden [&_video]:w-full [&_video]:h-full [&_video]:object-cover" />
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
                    className="px-4 py-2 font-sans font-bold text-[13px] text-[oklch(97%_0.008_28)] hover:bg-black cursor-pointer">
                    ปิดกล้อง
                </button>
            </div>
        </section>
    );
}
