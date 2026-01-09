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

    const startScanning = async () => {
        if (isScanning) return;
        const scannerId = "reader-manual";
        
        try {
            if (!scannerRef.current) {
                scannerRef.current = new Html5Qrcode(scannerId);
            }
            
            // --- Config กล้อง: บังคับความละเอียดสูง ---
            const videoConstraints = {
                facingMode: "environment", // กล้องหลัง
                // บังคับความละเอียดสูงเพื่อให้กล้องพยายามโฟกัส
                width: { min: 640, ideal: 1280, max: 1920 },
                height: { min: 480, ideal: 720, max: 1080 },
                // พยายามขอโหมดโฟกัส
                focusMode: "continuous", 
                advanced: [{ focusMode: "continuous" }]
            };

            const config = { 
                fps: 30, // เพิ่ม FPS ให้ภาพลื่นไหลขึ้น
                qrbox: { width: 250, height: 250 }, // ขนาดกรอบสแกน
                aspectRatio: 1.0,
                // Use Native Barcode Detector (AI ในเครื่อง)
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true
                },
                 formatsToSupport: [ 
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.CODE_128, // เพิ่ม Code 128
                    Html5QrcodeSupportedFormats.QR_CODE 
                ]
            };

            await scannerRef.current.start(
                videoConstraints, // ส่ง constraints ที่ตั้งค่าใหม่เข้าไป
                config,
                (decodedText, decodedResult) => {
                    handleScanSuccess(decodedText);
                },
                (errorMessage) => {
                    // Ignore errors
                }
            );
            
            setIsScanning(true);
            setPermissionError(false);
            
            // เปลี่ยนข้อความแนะนำหลังจากเปิดกล้องสักพัก
            setTimeout(() => {
                setCameraHint("หากภาพเบลอ ให้ถอยห่างออกมาเล็กน้อย");
            }, 3000);

        } catch (err) {
            console.error("Camera start failed", err);
            setPermissionError(true);
            toast.error("ไม่สามารถเข้าถึงกล้อง หรือกล้องไม่รองรับความละเอียดที่ต้องการ");
        }
    };

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
                // Not found, return basic info
                 onScan({ barcode, found: false });
            }
            
            await stopScanning();
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

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm">
            <div className="w-full max-w-md h-full md:h-auto md:rounded-3xl overflow-hidden relative flex flex-col bg-black">
                 {/* Header */}
                 <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-20 bg-gradient-to-b from-black/60 to-transparent">
                    <h3 className="font-medium text-white text-lg tracking-wide flex items-center gap-2">
                        <ScanLine className="w-5 h-5 text-emerald-400" /> สแกนสินค้า
                    </h3>
                    <button onClick={() => { stopScanning(); onClose(); }} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all">
                        <X className="w-6 h-6 text-white" />
                    </button>
                </div>

                {/* Viewport */}
                <div className="flex-1 relative flex items-center justify-center bg-black">
                    <div id="reader-manual" className="w-full h-full object-cover"></div>

                    {/* Overlay & Guides */}
                    {isScanning && !isLoadingData && (
                        <>
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                {/* กรอบสแกนที่ดู Clean ตาขึ้น */}
                                <div className="w-64 h-40 border-2 border-white/60 rounded-xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
                                    {/* มุมกรอบ */}
                                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-500 rounded-tl -mt-1 -ml-1"></div>
                                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-500 rounded-tr -mt-1 -mr-1"></div>
                                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-500 rounded-bl -mb-1 -ml-1"></div>
                                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-500 rounded-br -mb-1 -mr-1"></div>
                                    {/* เส้นเลเซอร์กวาด */}
                                    <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,1)] animate-[scan_1.5s_ease-in-out_infinite]"></div>
                                </div>
                            </div>
                            
                            {/* --- UX Hint: ข้อความแนะนำผู้ใช้ --- */}
                            <div className="absolute bottom-24 left-0 right-0 text-center z-20 px-4">
                                <p className="inline-block bg-black/70 text-white text-sm px-6 py-3 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg font-medium animate-pulse leading-relaxed">
                                    {/* ใช้ไอคอนช่วยสื่อสาร */}
                                    📷 {cameraHint}
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