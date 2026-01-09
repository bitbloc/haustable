import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';
import { toast } from 'sonner';

export default function BarcodeScanner({ onScan, onClose }) {
    const scannerRef = useRef(null);
    const [isScanning, setIsScanning] = useState(false);
    const [permissionError, setPermissionError] = useState(false);

    const startScanning = async () => {
        const scannerId = "reader-manual";
        
        try {
            // Check permissions first? simple way is to just start.
            // Using back camera by default
            if (!scannerRef.current) {
                scannerRef.current = new Html5Qrcode(scannerId);
            }
            
            await scannerRef.current.start(
                { facingMode: "environment" }, 
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText, decodedResult) => {
                    // Success
                    onScan(decodedText);
                    stopScanning(); // Stop on first match? Usually yes for single scan.
                },
                (errorMessage) => {
                    // ignore
                }
            );
            
            setIsScanning(true);
            setPermissionError(false);
        } catch (err) {
            console.error("Camera start failed", err);
            setPermissionError(true);
            toast.error("Camera access failed. Please allow permissions.");
        }
    };

    const stopScanning = async () => {
        if (scannerRef.current) {
            try {
                // Check if scanner is actually running (State 2 = Scanning, 3 = Paused)
                // Html5QrcodeScannerState: UNKNOWN(0), NOT_STARTED(1), SCANNING(2), PAUSED(3)
                // We access the enum-like values or just check the getter if available.
                // The library instance exposes getState()
                // Safest to just try/catch if getState is flaky, but improved logic:
                
                const state = scannerRef.current.getState();
                if (state === 2 || state === 3) {
                    await scannerRef.current.stop();
                }
            } catch (err) {
                 if (!err?.toString().includes("is not running")) {
                    console.warn("Scanner stop warning:", err);
                 }
            } finally {
                 setIsScanning(false);
            }
        }
    };

    useEffect(() => {
        // Cleanup on unmount
        return () => {
             // We can't await in cleanup, but we can fire the stop promise.
             if (scannerRef.current) {
                 const state = scannerRef.current.getState();
                 if (state === 2 || state === 3) {
                     scannerRef.current.stop().catch(e => {
                         // Suppress unmount cleanup errors specifically
                         if (!e?.toString().includes("is not running")) {
                             console.warn("Cleanup stop warning:", e);
                         }
                     });
                 }
             }
        };
    }, []);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden relative m-4 flex flex-col items-center">
                
                {/* Header */}
                <div className="w-full p-4 bg-[#1A1A1A] text-white flex justify-between items-center">
                    <h3 className="font-bold text-lg">Scan Barcode</h3>
                    <button 
                        onClick={() => { stopScanning(); onClose(); }}
                        className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Camera Viewport */}
                <div className="relative w-full aspect-square bg-black flex items-center justify-center">
                    {/* The div where video renders */}
                    <div id="reader-manual" className="w-full h-full"></div>

                    {/* Overlay UI if not scanning */}
                    {!isScanning && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 z-10">
                            {permissionError ? (
                                <div className="text-center p-4 text-red-500">
                                    <p className="font-bold mb-2">Camera Error</p>
                                    <p className="text-sm">Check browser permissions.</p>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Camera className="w-10 h-10 text-gray-400" />
                                    </div>
                                    <p className="text-gray-500 mb-6">Ready to scan</p>
                                </div>
                            )}
                            
                            <button
                                onClick={startScanning}
                                className="bg-[#1A1A1A] text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:scale-105 transition-transform shadow-lg"
                            >
                                <Camera className="w-5 h-5" />
                                Tap to Open Camera
                            </button>
                        </div>
                    )}
                    
                    {/* Scanning Overlay Guide */}
                    {isScanning && (
                        <div className="absolute inset-0 pointer-events-none border-2 border-white/30 flex items-center justify-center">
                            <div className="w-64 h-64 border-2 border-red-500/50 rounded-xl relative">
                                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-red-500 -mt-1 -ml-1"></div>
                                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-red-500 -mt-1 -mr-1"></div>
                                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-red-500 -mb-1 -ml-1"></div>
                                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-red-500 -mb-1 -mr-1"></div>
                            </div>
                            <p className="absolute bottom-4 text-white text-xs bg-black/50 px-2 py-1 rounded">Scanning...</p>
                        </div>
                    )}
                </div>

                <div className="p-4 w-full text-center text-xs text-gray-400">
                    Align barcode within the frame
                </div>
            </div>
        </div>
    );
}
