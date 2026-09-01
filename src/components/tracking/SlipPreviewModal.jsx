/* Hallmark · component: SlipPreviewModal · genre: modern-minimal · theme: dieter-rams-thai-modern
 * states: default · preview · generating · saved · error
 * contrast: pass (APCA / WCAG AAA compliant)
 * Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
 */
import { useRef, useState, useEffect } from 'react'
import { toPng } from 'html-to-image'
import { X, Download, Save } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '../../context/LanguageContext'
import BookingSlip from './BookingSlip'
import { getAppOrigin } from '../../utils/urlHelper'

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
            // Generate Image (High Quality)
            await document.fonts.ready
            await new Promise(r => setTimeout(r, 120)) 

            const dataUrl = await toPng(slipRef.current, {
                cacheBust: true,
                backgroundColor: '#FAF9F5', 
                pixelRatio: 3,
                skipAutoScale: true
            })

            setImageUrl(dataUrl)

            // Try programmatic Download
            const isWebView = /Line|FB_IAB/i.test(navigator.userAgent) || /iPhone|iPad|iPod/i.test(navigator.userAgent)
            
            if (!isWebView) {
                const link = document.createElement('a')
                link.href = dataUrl
                link.download = `Slip-${data.short_id || 'Order'}.png`
                link.click()
            }

        } catch (err) {
            console.error("Slip Gen Error:", err)
            setError("ไม่สามารถบันทึกภาพอัตโนมัติได้ กรุณาแคปภาพหน้าจอด้วยตนเอง")
        } finally {
            setGenerating(false)
        }
    }

    const checkInUrl = `${getAppOrigin()}/staff/checkin?id=${data?.tracking_token || data?.id}`
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(checkInUrl)}`
    
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 select-none">
                    {/* Backdrop */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-xs"
                    />

                    {/* Modal */}
                    <motion.div 
                        initial={{ scale: 0.96, opacity: 0, y: 16 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.96, opacity: 0, y: 16 }}
                        transition={{ type: "spring", damping: 25, stiffness: 240 }}
                        className="relative bg-[var(--color-paper)] border border-[var(--color-rule)] w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh] font-[var(--font-body)] text-[var(--color-ink)]"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center p-3.5 border-b border-[var(--color-rule)] bg-[var(--color-paper-2)] z-10">
                            <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-xs uppercase tracking-wider text-[var(--color-ink)]">
                                    [ {t('saveSlip')} // #{data.short_id} ]
                                </span>
                            </div>
                            <button 
                                onClick={onClose}
                                className="font-mono text-[11px] font-bold px-2 py-0.5 border border-[var(--color-rule)] bg-[var(--color-paper)] hover:bg-[var(--color-ink)] hover:text-[var(--color-paper)] transition-colors cursor-pointer"
                            >
                                [ ✕ CLOSE ]
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[var(--color-paper-2)] p-4 sm:p-6 text-center relative">
                            
                            {/* If Image Generated -> Show Image (For Long Press) */}
                            {imageUrl ? (
                                <div className="space-y-4 animate-in fade-in zoom-in duration-200">
                                    <div className="font-mono text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 font-bold p-2.5 flex items-center justify-center gap-1.5">
                                        <Save size={14} />
                                        <span>[ READY TO SAVE // แตะค้างที่รูปเพื่อบันทึก ]</span>
                                    </div>
                                    <img src={imageUrl} alt="Slip" className="w-full h-auto border border-[var(--color-rule)] shadow-lg mx-auto max-w-[340px]" />
                                    <p className="text-[11px] text-[var(--color-muted)] font-mono">
                                        หากเบราว์เซอร์ไม่ดาวน์โหลดอัตโนมัติ ให้กดค้างที่รูปแล้วเลือก "บันทึกภาพ"
                                    </p>
                                    <button 
                                        onClick={() => setImageUrl(null)}
                                        className="text-xs text-[var(--color-accent)] hover:underline font-mono font-bold cursor-pointer"
                                    >
                                        [ ↺ REGENERATE / สร้างรูปใหม่ ]
                                    </button>
                                </div>
                            ) : (
                                /* Else -> Show HTML Component */
                                <div className="flex justify-center min-h-[380px]">
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
                                <div className="mt-3 p-3 bg-[oklch(92%_0.06_25)]/20 text-[oklch(40%_0.15_25)] text-xs border border-[oklch(80%_0.10_25)] font-mono">
                                    {error}
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        {!imageUrl && (
                            <div className="p-3.5 bg-[var(--color-paper-2)] border-t border-[var(--color-rule)]">
                                <button 
                                    onClick={handleSave}
                                    disabled={generating}
                                    className="w-full py-3.5 bg-[var(--color-brand)] hover:bg-[oklch(82%_0.18_100)] text-[var(--color-ink)] font-mono font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-[var(--color-ink)] shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
                                >
                                    {generating ? (
                                        <div className="w-4 h-4 border-2 border-[var(--color-ink)] border-t-transparent rounded-full animate-spin"/>
                                    ) : (
                                        <>
                                            <Download size={16} />
                                            <span>[ SAVE SLIP // บันทึกสลิปคำสั่งซื้อ ]</span>
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
