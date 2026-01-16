import { Volume2, ArrowLeft, Download } from 'lucide-react'

// Simple Nendo-style status indicator
// Minimal, breathing animation, clean typography
export default function SystemStatus({ onStart, onRequestPermission, isIOS }) {
    return (
        <div className="min-h-screen bg-[#F9F9F9] flex flex-col items-center justify-center p-6 text-[#1A1A1A]">
             <div className="relative w-full max-w-sm bg-white p-10 rounded-3xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] text-center border border-gray-100">
                
                {/* Breathing Icon */}
                <div className="relative w-20 h-20 mx-auto mb-8">
                    <div className="absolute inset-0 bg-[#1A1A1A] rounded-full opacity-5 animate-ping"></div>
                    <div className="relative w-20 h-20 bg-[#1A1A1A] text-white rounded-full flex items-center justify-center shadow-xl">
                        <Volume2 className="w-8 h-8" />
                    </div>
                </div>

                <h1 className="text-xl font-bold mb-2 tracking-tight">System Ready</h1>
                <p className="text-gray-400 text-sm mb-10 leading-relaxed font-medium">
                    Tap to initialize sound & connection.<br/>
                    Please keep this device active.
                </p>

                <div className="space-y-4">
                    <button 
                        onClick={() => { onRequestPermission(); onStart(); }}
                        className="w-full bg-[#1A1A1A] text-white font-bold py-4 rounded-2xl hover:bg-black transition-all active:scale-95 shadow-lg shadow-black/10 text-sm tracking-wide"
                    >
                        Initialize System
                    </button>
                    
                    <button 
                         onClick={() => window.location.href = '/staff'}
                         className="text-gray-400 text-xs font-bold hover:text-black transition-colors"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
            
            {isIOS && (
                <div className="mt-8 text-center">
                   <p className="text-[10px] text-gray-300 font-medium uppercase tracking-widest">Running on iOS Mode</p>
                </div>
            )}
        </div>
    )
}
