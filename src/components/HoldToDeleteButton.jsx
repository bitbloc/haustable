import { useState, useRef } from 'react'
import { motion, useAnimation } from 'framer-motion'
import { Trash2 } from 'lucide-react'

export default function HoldToDeleteButton({ onConfirm, duration = 5000, className, disabled }) {
    const [isHolding, setIsHolding] = useState(false)
    const timeoutRef = useRef(null)
    const controls = useAnimation()
    const [progress, setProgress] = useState(0)

    const startHold = () => {
        if (disabled) return
        setIsHolding(true)
        
        // Start animation
        controls.start({
            pathLength: 1,
            transition: { duration: duration / 1000, ease: "linear" }
        })

        // Start timer
        timeoutRef.current = setTimeout(() => {
            handleComplete()
        }, duration)
    }

    const cancelHold = () => {
        if (!isHolding) return
        setIsHolding(false)
        clearTimeout(timeoutRef.current)
        controls.stop()
        controls.set({ pathLength: 0 })
    }

    const handleComplete = () => {
        setIsHolding(false)
        controls.set({ pathLength: 0 })
        // Trigger generic vibration if supported
        if (navigator.vibrate) navigator.vibrate(200)
        onConfirm()
    }

    return (
        <button
            className={`relative group select-none touch-none ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} overflow-hidden relative`}
            onMouseDown={startHold}
            onMouseUp={cancelHold}
            onMouseLeave={cancelHold}
            onTouchStart={(e) => {
                // Prevent scrolling while holding
                // e.preventDefault() 
                startHold()
            }}
            onTouchEnd={cancelHold}
            title={disabled ? "" : "Hold to Delete (5s)"}
            type="button"
        >
            {/* Background Fill for visual feedback (Rectangular) */}
            <motion.div 
                className="absolute inset-0 bg-red-500/20 origin-left"
                initial={{ scaleX: 0 }}
                animate={isHolding ? { scaleX: 1 } : { scaleX: 0 }}
                transition={isHolding ? { duration: duration / 1000, ease: "linear" } : { duration: 0.1 }}
            />

            {/* Circular Progress (for Icon style) */}
            <div className="relative z-10 flex items-center justify-center p-2">
                 <div className="relative">
                    <Trash2 size={16} className={isHolding ? "text-red-500 animate-pulse" : disabled ? "text-gray-500" : "text-red-500"} />
                    
                    {/* Ring Overlay */}
                    <svg className="absolute -inset-[6px] w-[calc(100%+12px)] h-[calc(100%+12px)] -rotate-90 pointer-events-none">
                        <motion.circle
                            cx="50%"
                            cy="50%"
                            r="11"
                            stroke="#ef4444" 
                            strokeWidth="2"
                            initial={{ pathLength: 0 }}
                            animate={controls}
                            strokeLinecap="round"
                            fill="transparent"
                        />
                    </svg>
                 </div>
            </div>
        </button>
    )
}
