import { X, Image as ImageIcon, ExternalLink } from 'lucide-react'

export default function ViewSlipModal({ url, onClose }) {
    if (!url) return null

    return (
        <div 
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div 
                className="relative bg-black rounded-2xl overflow-hidden max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-white/10"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#111]">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <ImageIcon size={18} className="text-[#DFFF00]" />
                        Payment Slip Evidence
                    </h3>
                    <div className="flex items-center gap-2">
                         <a 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors"
                            title="Open Original"
                        >
                            <ExternalLink size={18} />
                        </a>
                        <button 
                            onClick={onClose}
                            className="p-2 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Image Container */}
                <div className="flex-1 overflow-auto bg-[#0a0a0a] p-4 flex items-center justify-center">
                    <img 
                        src={url} 
                        alt="Payment Slip" 
                        className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                    />
                </div>
                
                {/* Footer */}
                <div className="p-4 bg-[#111] border-t border-white/10 text-center">
                    <p className="text-xs text-gray-500">
                        ตรวจสอบสลิปการโอนเงิน | Check payment slip
                    </p>
                </div>
            </div>
        </div>
    )
}
