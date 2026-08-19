/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'

export function OrderNotificationToast({ 
  visible, 
  title, 
  message, 
  price, 
  onAccept, 
  onClose,
  duration = 0 
}) {
    
  useEffect(() => {
    if (visible && duration > 0) {
        const timer = setTimeout(onClose, duration)
        return () => clearTimeout(timer)
    }
  }, [visible, duration, onClose])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -100, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -100, opacity: 0, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
          className="fixed top-4 left-4 right-4 z-[9999] md:max-w-md md:left-1/2 md:-translate-x-1/2"
        >
          <div className="bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] p-4 rounded-xl shadow-2xl border border-[oklch(85%_0.012_28)] flex flex-col gap-3 font-sans relative">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                 </div>
                 <div>
                    <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[oklch(42%_0.010_28)]">Kitchen Ticket Alert</div>
                    <h3 className="font-bold text-base leading-tight text-[oklch(18%_0.012_28)] mt-0.5">{title}</h3>
                    <p className="text-[oklch(55%_0.010_28)] text-xs mt-0.5">{message}</p>
                 </div>
              </div>
              <button 
                  onClick={onClose}
                  className="px-2 py-1 text-xs font-mono text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] hover:bg-[oklch(94%_0.010_28)] rounded transition-colors"
              >
                  ESC
              </button>
            </div>

            {price && (
                <div className="bg-[oklch(94%_0.010_28)] rounded-md px-2.5 py-1 self-start text-xs font-mono font-bold text-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)]">
                    ฿{price}.-
                </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-[oklch(85%_0.012_28)]">
                <button
                    onClick={onAccept}
                    className="flex-1 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-98 transition-all"
                >
                    รับออเดอร์ (Accept)
                </button>
                <button
                    onClick={onClose}
                    className="px-4 bg-transparent border border-[oklch(85%_0.012_28)] text-[oklch(42%_0.010_28)] font-bold py-2.5 rounded-lg text-sm hover:bg-[oklch(94%_0.010_28)] active:scale-98 transition-all"
                >
                    ปิด
                </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
