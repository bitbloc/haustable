import React, { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X } from 'lucide-react';

export default function BarcodeScanner({ onScan, onClose }) {
    useEffect(() => {
        // ID 'reader' must exist in DOM
        const scannerId = "reader";
        
        const onScanSuccess = (decodedText, decodedResult) => {
            // Handle success
            // console.log(`Code matched = ${decodedText}`, decodedResult);
            onScan(decodedText);
            
            // Optional: Stop scanning after first match? 
            // Often better to let parent decide or keep scanning.
            // But usually we close modal on success.
            // For now, we trust the parent 'onScan' to handle data.
        };

        const onScanFailure = (error) => {
            // handle scan failure, usually better to ignore and keep scanning.
            // console.warn(`Code scan error = ${error}`);
        };

        const html5QrcodeScanner = new Html5QrcodeScanner(
            scannerId, 
            { fps: 10, qrbox: 250 },
            /* verbose= */ false
        );
        
        html5QrcodeScanner.render(onScanSuccess, onScanFailure);

        // CLEANUP
        return () => {
            html5QrcodeScanner.clear().catch(error => {
                console.error("Failed to clear html5QrcodeScanner. ", error);
            });
        };
    }, [onScan]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden relative m-4">
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/20 text-white hover:bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="p-4 bg-[#1A1A1A] text-white text-center">
                    <h3 className="font-bold text-lg">Scan Barcode</h3>
                    <p className="text-sm text-gray-400">Point camera at product barcode</p>
                </div>

                <div className="bg-white p-4">
                    <div id="reader" className="w-full"></div>
                </div>
            </div>
        </div>
    );
}
