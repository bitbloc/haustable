import { useEffect, useRef, useState } from 'react'
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

/**
 * A button that opens a small floating panel of settings. Closes on outside click,
 * on Escape and when focus leaves. The panel is the one place a shadow is allowed:
 * it really floats.
 */
export default function AdminPopover({ label, children, align = 'right', className = '' }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)
    const reduceMotion = useReducedMotion()

    useEffect(() => {
        if (!open) return
        const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
        document.addEventListener('pointerdown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('pointerdown', onDown)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    return (
        <div ref={ref} className={`relative ${className}`}>
            <button
                type="button"
                className="admin-btn h-8 px-3"
                aria-expanded={open}
                aria-haspopup="dialog"
                onClick={() => setOpen((v) => !v)}
            >
                <span>{label}</span>
                <ChevronDown
                    size={14}
                    strokeWidth={1.5}
                    className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
                />
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        role="dialog"
                        aria-label={label}
                        initial={reduceMotion ? false : { opacity: 0, y: -4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
                        transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                        style={{ transformOrigin: align === 'right' ? 'top right' : 'top left' }}
                        className={`absolute z-40 top-full mt-2 ${align === 'right' ? 'right-0' : 'left-0'} w-72 max-w-[calc(100vw-32px)] p-4 rounded-lg border border-[var(--color-rule)] bg-[var(--color-paper)] shadow-[0_8px_24px_oklch(21.78%_0_0/0.10)] font-sans space-y-4`}
                    >
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

/** One labelled group inside a popover. */
export function AdminPopoverGroup({ label, children }) {
    return (
        <div>
            <div className="text-xs leading-5 text-[var(--color-muted)] mb-1.5">{label}</div>
            {children}
        </div>
    )
}
