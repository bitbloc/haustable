import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, Zap, PackageSearch, ScanLine } from 'lucide-react';
import { toast } from 'sonner';

// Real OpenFoodFacts API Lookup
const fetchThaiProductData = async (barcode) => {
    try {
        const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
        const data = await response.json();
        
        if (data.status === 1 && data.product) {
            const p = data.product;
            return {
                name: p.product_name_th || p.product_name || p.product_name_en || "Unknown Product",
                brand: p.brands || "",
                category: p.categories_tags ? p.categories_tags[0]?.replace('en:', '') : "consumable",
                image_url: p.image_front_url || p.image_url || "",
                found: true
            };
        }
    } catch (e) {
        console.warn("API Lookup failed", e);
    }
    return null; // Not found or error
};

export default function SmartBarcodeScanner({ onScan, onClose }) {
    const scannerRef = useRef(null);
    const [isScanning, setIsScanning] = useState(false);
    const [permissionError, setPermissionError] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [cameraHint, setCameraHint] = useState("วางบาร์โค้ดให้อยู่ในกรอบ");
    const [errorMessage, setErrorMessage] = useState("");
    
    // Feature States
    const [zoom, setZoom] = useState({ supported: false, min: 1, max: 3, value: 1, step: 0.1 });
    const [torchOn, setTorchOn] = useState(false);
    const [torchSupported, setTorchSupported] = useState(false);
    const [useHD, setUseHD] = useState(false); // Default to SD (Safe)

    const startScanning = async () => {
        if (isScanning) return;
        setErrorMessage("");
        setTorchOn(false);
        const scannerId = "reader-manual";
        
        try {
            if (!scannerRef.current) {
                scannerRef.current = new Html5Qrcode(scannerId);
            }
            
    // --- Config กล้อง: SD (Safe) vs HD (Sharp) ---
            const videoConstraints = {
                facingMode: "environment",
                // Improve default resolution for better barcode reading (720p minimum for SD usually helps)
                width: useHD ? { min: 1280, ideal: 1920 } : { min: 720, ideal: 1280 },
                height: useHD ? { min: 720, ideal: 1080 } : { min: 480, ideal: 720 },
                // Use a wider aspect ratio if possible for barcodes, or just standard
                aspectRatio: { ideal: 1.777 }, // 16:9
                advanced: [{ focusMode: "continuous" }] 
            };

            const config = { 
                fps: 30, // Increased to 30 for smoother feedback
                // Rectangular Scan Area: Better for 1D Barcodes
                qrbox: { width: 300, height: 150 },
                aspectRatio: 1.777,
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true
                },
                formatsToSupport: [ 
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E
                ]
            };

            // Double check cleanup before start
            if (scannerRef.current) {
                try {
                    const state = scannerRef.current.getState();
                    if (state === 2 || state === 3) { // SCANNING or PAUSED
                         await scannerRef.current.stop();
                    }
                } catch (e) { console.warn("Cleanup check warning", e); }
            }

            await scannerRef.current.start(
                videoConstraints, 
                config,
                (decodedText, decodedResult) => {
                    handleScanSuccess(decodedText);
                },
                (errorMessage) => {
                    // Ignore errors
                }
            );
            
            // --- Check Capabilities (Zoom & Torch) ---
            try {
                const capabilities = scannerRef.current.getRunningTrackCameraCapabilities();
                
                // Zoom
                if (capabilities.zoom) {
                    setZoom({
                        supported: true,
                        min: capabilities.zoom.min,
                        max: capabilities.zoom.max,
                        value: capabilities.zoom.min,
                        step: capabilities.zoom.step
                    });
                } else {
                    setZoom(prev => ({ ...prev, supported: false }));
                }

                // Torch
                if (capabilities.torch) {
                    setTorchSupported(true);
                } else {
                    setTorchSupported(false);
                }

            } catch(e) { 
                console.log("Capabilities check failed", e); 
            }

            setIsScanning(true);
            setPermissionError(false);
            
            setTimeout(() => {
                setCameraHint(useHD ? "หากสแกนยาก ให้ลองถอยห่าง" : "ลองเปิดโหมด HD หรือแตะเพื่อโฟกัส");
            }, 3000);

        } catch (err) {
            console.error("Camera start failed", err);
            setPermissionError(true);
            setErrorMessage(err.name + ": " + err.message || "Unknown error");
            // toast.error("Camera Error: " + (err.message || "Unknown"));
            setIsScanning(false);
        }
    };

    // Toggle Torch
    const handleTorchToggle = async () => {
        if (scannerRef.current && torchSupported) {
            try {
                await scannerRef.current.applyVideoConstraints({
                    advanced: [{ torch: !torchOn }]
                });
                setTorchOn(!torchOn);
            } catch (err) {
                console.error("Torch failed", err);
                toast.error("เปิดไฟฉายไม่ได้");
            }
        }
    };

    // Toggle HD Mode (Requires Restart)
    const toggleHD = async () => {
        setIsScanning(false);
        if (scannerRef.current) {
            await scannerRef.current.stop().catch(() => {});
        }
        setUseHD(!useHD);
        setTimeout(() => startScanning(), 300);
    };

    // Zoom Handler
    const handleZoomChange = async (e) => {
        const value = Number(e.target.value);
        setZoom(prev => ({ ...prev, value }));
        
        if (scannerRef.current) {
            try {
                await scannerRef.current.applyVideoConstraints({
                    advanced: [{ zoom: value }]
                });
            } catch (err) {
                console.warn("Zoom failed", err);
            }
        }
    };

    // Scan Success
    const handleScanSuccess = async (barcode) => {
        if(scannerRef.current) await scannerRef.current.pause();

        if (navigator.vibrate) navigator.vibrate(200);
        const audio = new Audio('https://cdn.freesound.org/previews/242/242501_4414128-lq.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {});

        setIsLoadingData(true);
        try {
            const productInfo = await fetchThaiProductData(barcode);
            if (productInfo) {
                toast.success(`พบสินค้า: ${productInfo.name}`);
                onScan({ barcode, ...productInfo }); 
            } else {
                 onScan({ barcode, found: false });
            }
            // await stopScanning(); // Don't stop fully yet, let parent close or we close
            onClose();
        } catch (error) {
            toast.error("Error processing scan");
            if(scannerRef.current) await scannerRef.current.resume();
        } finally {
            setIsLoadingData(false);
        }
    };

    const stopScanning = async () => {
        if (scannerRef.current) {
            try {
                const state = scannerRef.current.getState();
                if (state === 2 || state === 3) await scannerRef.current.stop();
                scannerRef.current.clear(); // Important: Clear to remove DOM element issues
                scannerRef.current = null;
            } catch (err) { console.warn("Stop warning:", err); } 
            finally { setIsScanning(false); }
        }
    };

    useEffect(() => {
        // Auto-start (optional) or just cleanup
        // If we want to auto-start:
        // startScanning();
        
        return () => {
             if (scannerRef.current) {
                 scannerRef.current.stop().catch(console.error).finally(() => {
                     if (scannerRef.current) scannerRef.current.clear();
                 });
             }
        };
    }, []);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm">
            <div className="w-full max-w-md h-full md:h-auto md:rounded-3xl overflow-hidden relative flex flex-col bg-black">
                 {/* Header */}
                 <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-20 bg-gradient-to-b from-black/60 to-transparent">
                    <h3 className="font-medium text-white text-lg tracking-wide flex items-center gap-2">
                        <ScanLine className="w-5 h-5 text-emerald-400" /> สแกนสินค้า
                        {useHD && <span className="text-[10px] bg-emerald-500 text-black px-1.5 py-0.5 rounded font-bold">HD</span>}
                    </h3>
                    <button onClick={() => { stopScanning(); onClose(); }} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all">
                        <X className="w-6 h-6 text-white" />
                    </button>
                </div>

                {/* Viewport */}
                <div className="flex-1 relative flex items-center justify-center bg-black">
                    <div id="reader-manual" className="w-full h-full object-cover"></div>

                    {/* Overlay */}
                    {isScanning && !isLoadingData && (
                        <>
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                {/* Rectangular Scan Area for Barcodes */}
                                <div className="w-[300px] h-[150px] border-2 border-white/60 rounded-xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
                                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-500 rounded-tl -mt-1 -ml-1"></div>
                                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-500 rounded-tr -mt-1 -mr-1"></div>
                                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-500 rounded-bl -mb-1 -ml-1"></div>
                                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-500 rounded-br -mb-1 -mr-1"></div>
                                    <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,1)] animate-[scan_1.5s_ease-in-out_infinite]"></div>
                                </div>
                            </div>
                            
                            {/* --- Control Bar (Zoom, Torch, HD) --- */}
                            <div className="absolute bottom-10 left-0 right-0 z-30 flex flex-col items-center gap-6 px-6 pb-6">
                                
                                {/* Zoom Slider */}
                                {zoom.supported && (
                                    <div className="flex items-center gap-4 w-full max-w-xs bg-black/40 backdrop-blur-md p-3 rounded-full border border-white/10">
                                        <span className="text-white text-xs font-bold w-6 text-right">1x</span>
                                        <input 
                                            type="range" 
                                            min={zoom.min} 
                                            max={zoom.max} 
                                            step={zoom.step}
                                            value={zoom.value} 
                                            onChange={handleZoomChange}
                                            className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-emerald-500" 
                                        />
                                        <span className="text-white text-xs font-bold w-6 text-left">{(zoom.max || 3).toFixed(0)}x</span>
                                    </div>
                                )}

                                {/* Tools: Torch & HD Toggle */}
                                <div className="flex items-center gap-4">
                                    {/* Torch Button */}
                                    {torchSupported && (
                                        <button 
                                            onClick={handleTorchToggle}
                                            className={`p-4 rounded-full backdrop-blur-md border transition-all ${torchOn ? 'bg-amber-400 text-black border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.5)]' : 'bg-white/10 text-white border-white/10 hover:bg-white/20'}`}
                                        >
                                            <Zap className={`w-6 h-6 ${torchOn ? 'fill-black' : ''}`} />
                                        </button>
                                    )}

                                    {/* HD Toggle Button */}
                                    <button 
                                        onClick={toggleHD}
                                        className={`px-6 py-3 rounded-full backdrop-blur-md border transition-all font-bold text-sm tracking-wide ${useHD ? 'bg-emerald-500 text-black border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-white/10 text-white border-white/10 hover:bg-white/20'}`}
                                    >
                                        {useHD ? 'HD ON' : 'SD MODE'}
                                    </button>
                                </div>

                                <p className="text-white/50 text-xs text-center animate-pulse">
                                    {cameraHint}
                                </p>
                            </div>
                        </>
                    )}
                    
                   {/* Loading Overlay */}
                    {isLoadingData && (
                        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                            <PackageSearch className="w-12 h-12 text-white animate-bounce mb-4" />
                            <p className="text-white font-medium">กำลังค้นหาข้อมูลสินค้า...</p>
                        </div>
                    )}

                    {/* Initial / Error State */}
                    {!isScanning && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#111] z-10">
                            {permissionError ? (
                                <div className="text-center p-6 text-red-400 max-w-xs">
                                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Camera className="w-8 h-8 text-red-400" />
                                    </div>
                                    <p className="font-bold text-lg mb-2">กล้องไม่ทำงาน ({useHD ? 'HD' : 'SD'})</p>
                                    <p className="text-sm mb-4 text-white/70">{errorMessage}</p>
                                    
                                    <div className="flex gap-3 justify-center">
                                        {useHD && (
                                            <button
                                                 onClick={() => { setUseHD(false); setTimeout(startScanning, 100); }}
                                                 className="bg-white/10 text-white border border-white/20 px-4 py-2 rounded-full text-sm hover:bg-white/20 transition-colors"
                                            >
                                                ลดความชัด (SD)
                                            </button>
                                        )}
                                        <button
                                            onClick={() => { setPermissionError(false); startScanning(); }}
                                            className="bg-red-500/20 text-red-300 border border-red-500/50 px-6 py-2 rounded-full text-sm hover:bg-red-500/30 transition-colors"
                                        >
                                            ลองใหม่
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full"></div>
                                        <Zap className="w-16 h-16 text-emerald-400 relative z-10 mx-auto" />
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className="text-2xl font-bold text-white">พร้อมสแกน</h2>
                                        <p className="text-gray-400 text-sm">เลือกโหมดความชัดด้านล่างได้</p>
                                    </div>
                                    <button
                                        onClick={startScanning}
                                        className="bg-white text-black px-10 py-4 rounded-full font-bold text-lg hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                                    >
                                        แตะเพื่อเริ่มสแกน
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <style jsx>{`
                @keyframes scan {
                    0% { top: 5%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 95%; opacity: 0; }
                }
            `}</style>
        </div>
    );
}