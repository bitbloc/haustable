import { useRef, useState, useEffect } from 'react'
import { toPng } from 'html-to-image'
import { X, Download, Save } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '../../context/LanguageContext'
import BookingSlip from './BookingSlip'

export default function SlipPreviewModal({ isOpen, onClose, data, optionMap }) {
    const { t } = useLanguage()
    const slipRef = useRef(null)
    const [imageUrl, setImageUrl] = useState(null)
    const [generating, setGenerating] = useState(false)
    const [error, setError] = useState(null)

    // Reset when opening
    useEffect(() => {
        if (isOpen) {
            setImageUrl(null)
            setError(null)
        }
    }, [isOpen])

    const handleSave = async () => {
        if (!slipRef.current) return
        setGenerating(true)
        setError(null)

        try {
            // 1. Generate Image (High Quality)
            await document.fonts.ready
            await new Promise(r => setTimeout(r, 100)) 

            const dataUrl = await toPng(slipRef.current, {
                cacheBust: true,
                backgroundColor: 'transparent', 
                pixelRatio: 3,
                skipAutoScale: true
            })

            setImageUrl(dataUrl)

            // 2. Try Programmantic Download 
            const isWebView = /Line|FB_IAB/i.test(navigator.userAgent) || /iPhone|iPad|iPod/i.test(navigator.userAgent)
            
            if (!isWebView) {
                const link = document.createElement('a')
                link.href = dataUrl
                link.download = `Slip-${data.short_id || 'Order'}.png`
                link.click()
            }

        } catch (err) {
            console.error("Slip Gen Error:", err)
            setError("Cannot generate image. Please screenshot manually.")
        } finally {
            setGenerating(false)
        }
    }

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(window.location.href)}`
    
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div 
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="relative bg-[#1a1a1a] w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center p-4 border-b border-white/10 text-white z-10 bg-[#1a1a1a]">
                            <h3 className="font-bold flex items-center gap-2">
                                {t('saveSlip')}
                                <span className="text-xs bg-white/20 px-2 py-0.5 rounded text-gray-300 font-normal">
                                    #{data.short_id}
                                </span>
                            </h3>
                            <button 
                                onClick={onClose}
                                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#222] p-6 text-center relative">
                            
                            {/* If Image Generated -> Show Image (For Long Press) */}
                            {imageUrl ? (
                                <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                                    <div className="text-sm text-green-400 font-bold flex items-center justify-center gap-2">
                                        <Save size={16} />
                                        Ready to Save!
                                    </div>
                                    <img src={imageUrl} alt="Slip" className="w-full h-auto rounded shadow-xl mx-auto max-w-[380px]" />
                                    <p className="text-xs text-gray-400">
                                        Touch and hold the image to save if download didn't start.
                                    </p>
                                    <button 
                                        onClick={() => setImageUrl(null)}
                                        className="text-xs text-blue-400 hover:text-blue-300 underline"
                                    >
                                        Edit / Regenerate
                                    </button>
                                </div>
                            ) : (
                                /* Else -> Show HTML Component */
                                <div className="flex justify-center min-h-[400px]">
                                    {/* Wrapper for capture */}
                                    <div className="relative">
                                        <div ref={slipRef} className="bg-transparent">
                                            <BookingSlip 
                                                data={data}
                                                qrCodeUrl={qrUrl}
                                                optionMap={optionMap}
                                                isForCapture={true}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                             {error && (
                                <div className="mt-4 p-3 bg-red-500/20 text-red-200 text-xs rounded-xl border border-red-500/50">
                                    {error}
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        {!imageUrl && (
                            <div className="p-4 bg-[#1a1a1a] border-t border-white/10">
                                <button 
                                    onClick={handleSave}
                                    disabled={generating}
                                    className="w-full py-4 bg-[#DFFF00] hover:bg-[#cbe600] text-black font-black text-lg rounded-2xl shadow-lg shadow-yellow-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {generating ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"/>
                                        </>
                                    ) : (
                                        <>
                                            <Download size={24} />
                                            Save Image
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
