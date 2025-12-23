import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, Bell } from 'lucide-react'
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
          initial={{ y: -100, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -100, opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed top-4 left-4 right-4 z-[9999] md:max-w-md md:left-1/2 md:-translate-x-1/2"
        >
          <div className="bg-[#1A1A1A] text-white p-4 rounded-2xl shadow-2xl border border-gray-800 flex flex-col gap-3 relative overflow-hidden">
            {/* Gloss Effect */}
            <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>

            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center animate-bounce shadow-lg shadow-yellow-500/20">
                    <Bell className="w-5 h-5 text-black" fill="currentColor" />
                 </div>
                 <div>
                    <h3 className="font-bold text-lg leading-tight">{title}</h3>
                    <p className="text-gray-400 text-sm mt-0.5">{message}</p>
                 </div>
              </div>
              <button 
                  onClick={onClose}
                  className="p-1 hover:bg-white/10 rounded-full text-gray-400"
              >
                  <X className="w-5 h-5" />
              </button>
            </div>

            {price && (
                <div className="bg-gray-800/50 rounded-lg p-2 px-3 self-start text-xs font-mono text-yellow-500 border border-yellow-500/20">
                    Total: {price}.-
                </div>
            )}

            <div className="flex gap-2 mt-1 relative z-10 pt-2 border-t border-white/10">
                <button
                    onClick={onAccept}
                    className="flex-1 bg-white text-black font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-gray-100 active:scale-95 transition-transform"
                >
                    <Check className="w-4 h-4" />
                    Accept Order
                </button>
                <button
                    onClick={onClose}
                    className="flex-1 bg-transparent border border-white/20 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-white/5 active:scale-95 transition-transform"
                >
                    Dismiss
                </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
