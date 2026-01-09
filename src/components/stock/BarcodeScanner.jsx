import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, Zap, PackageSearch } from 'lucide-react';
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
    const [isLoadingData, setIsLoadingData] = useState(false); // State สำหรับตอนโหลดข้อมูล

    const startScanning = async () => {
        if (isScanning) return;
        const scannerId = "reader-manual";
        
        try {
            if (!scannerRef.current) {
                // Config ให้รองรับ Barcode 1D (สินค้าทั่วไป) และ QR Code
                scannerRef.current = new Html5Qrcode(scannerId);
            }
            
            const config = { 
                fps: 20, // เพิ่ม FPS เพื่อความลื่นไหล
                qrbox: { width: 280, height: 280 }, // ขยายพื้นที่ scan เล็กน้อย
                aspectRatio: 1.0,
                // !สำคัญ: ใช้ Native API ของ Browser (AI ในตัว Chrome) ช่วยอ่านบาร์โค้ดเบี้ยว/โค้ง
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true
                },
                // เน้นอ่าน Barcode ทั่วไป (EAN/UPC)
                formatsToSupport: [ 
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.QR_CODE 
                ]
            };

            await scannerRef.current.start(
                { facingMode: "environment" }, 
                config,
                async (decodedText, decodedResult) => {
                    // Success Callback
                    handleScanSuccess(decodedText);
                },
                (errorMessage) => {
                    // Ignore frame scan errors to keep logs clean
                }
            );
            
            setIsScanning(true);
            setPermissionError(false);
        } catch (err) {
            console.error("Camera start failed", err);
            setPermissionError(true);
            toast.error("ไม่สามารถเข้าถึงกล้องได้ กรุณาตรวจสอบสิทธิ์การใช้งาน");
        }
    };

    const handleScanSuccess = async (barcode) => {
        // 1. หยุดสแกนชั่วคราวเพื่อกันการสแกนซ้ำ
        if(scannerRef.current) await scannerRef.current.pause();

        // 2. Feedback: สั่นและเสียง (Haptic & Sound)
        if (navigator.vibrate) navigator.vibrate(200); // สั่น 200ms
        const audio = new Audio('https://cdn.freesound.org/previews/242/242501_4414128-lq.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {});

        // 3. เริ่มกระบวนการ "AI Lookup"
        setIsLoadingData(true);
        try {
            // จำลองการค้นหาข้อมูล
            const productInfo = await fetchThaiProductData(barcode);
            
            toast.success(`พบสินค้า: ${productInfo.name}`);
            
            // ส่งข้อมูลกลับไป component แม่
            onScan({ barcode, ...productInfo }); 
            
            // ปิด Scanner หรือจะ resume ก็ได้
            await stopScanning();
            onClose();

        } catch (error) {
            toast.error("ไม่พบข้อมูลสินค้า");
            // ถ้าไม่เจอ ให้ resume สแกนต่อ
            if(scannerRef.current) await scannerRef.current.resume();
        } finally {
            setIsLoadingData(false);
        }
    };

    const stopScanning = async () => {
        if (scannerRef.current) {
            try {
                const state = scannerRef.current.getState();
                if (state === 2 || state === 3) { // Scanning or Paused
                    await scannerRef.current.stop();
                }
            } catch (err) {
                 console.warn("Stop warning:", err);
            } finally {
                 setIsScanning(false);
            }
        }
    };

    // Cleanup
    useEffect(() => {
        return () => {
             if (scannerRef.current && scannerRef.current.isScanning) {
                 scannerRef.current.stop().catch(console.error);
             }
        };
    }, []);

    // --- UI Implementation (Nendo Inspired: Clean & Functional) ---
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md h-full md:h-auto md:rounded-3xl overflow-hidden relative flex flex-col bg-black">
                
                {/* Header: Simple & High Contrast */}
                <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-20 bg-gradient-to-b from-black/80 to-transparent">
                    <h3 className="font-medium text-white text-lg tracking-wide">Scanner</h3>
                    <button 
                        onClick={() => { stopScanning(); onClose(); }}
                        className="bg-white/10 hover:bg-white/20 p-2 rounded-full backdrop-blur-md transition-all active:scale-95"
                    >
                        <X className="w-6 h-6 text-white" />
                    </button>
                </div>

                {/* Viewport Area */}
                <div className="flex-1 relative flex items-center justify-center bg-black">
                    <div id="reader-manual" className="w-full h-full object-cover"></div>

                    {/* Overlay Guides */}
                    {isScanning && !isLoadingData && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            {/* กรอบสแกนแบบ Minimalist (Rams style: Less but better) */}
                            <div className="w-72 h-48 border-2 border-white/40 rounded-lg relative transition-all duration-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg -mt-1 -ml-1"></div>
                                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg -mt-1 -mr-1"></div>
                                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg -mb-1 -ml-1"></div>
                                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-500 rounded-br-lg -mb-1 -mr-1"></div>
                                
                                {/* Scanning Laser Animation */}
                                <div className="absolute left-2 right-2 top-1/2 h-0.5 bg-emerald-500/80 shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-[scan_2s_infinite]"></div>
                            </div>
                        </div>
                    )}

                    {/* Loading Overlay */}
                    {isLoadingData && (
                        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                            <PackageSearch className="w-12 h-12 text-white animate-bounce mb-4" />
                            <p className="text-white font-medium">กำลังค้นหาข้อมูลสินค้า...</p>
                        </div>
                    )}

                    {/* Initial State / Error State */}
                    {!isScanning && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#111] z-10">
                            {permissionError ? (
                                <div className="text-center p-6 text-red-400">
                                    <p>กรุณาอนุญาตให้เข้าถึงกล้องถ่ายรูป</p>
                                </div>
                            ) : (
                                <div className="text-center space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full"></div>
                                        <Zap className="w-16 h-16 text-emerald-400 relative z-10 mx-auto" />
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className="text-2xl font-bold text-white">พร้อมสแกน</h2>
                                        <p className="text-gray-400 text-sm">รองรับบาร์โค้ดสินค้าและ QR Code</p>
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

                {/* Footer Hint */}
                {isScanning && (
                    <div className="absolute bottom-10 left-0 right-0 text-center z-20">
                        <span className="bg-black/60 text-white/80 px-4 py-2 rounded-full text-xs backdrop-blur-md border border-white/10">
                            วางบาร์โค้ดให้อยู่ในกรอบ
                        </span>
                    </div>
                )}
            </div>
            
            <style jsx>{`
                @keyframes scan {
                    0%, 100% { transform: translateY(-80px); opacity: 0; }
                    10% { opacity: 1; }
                    50% { transform: translateY(80px); }
                    90% { opacity: 1; }
                }
            `}</style>
        </div>
    );
}