import React, { createContext, useContext, useState, useCallback } from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

const ToastContext = createContext()

export const useToast = () => useContext(ToastContext)

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([])

    const addToast = useCallback((message, type = 'info', duration = 3000) => {
        const id = Date.now() + Math.random()
        setToasts(prev => [...prev, { id, message, type, duration }])
        
        if (duration > 0) {
            setTimeout(() => removeToast(id), duration)
        }
    }, [])

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    // Shortcuts
    const toast = {
        success: (msg, duration) => addToast(msg, 'success', duration),
        error: (msg, duration) => addToast(msg, 'error', duration),
        info: (msg, duration) => addToast(msg, 'info', duration),
        custom: (msg, type, duration) => addToast(msg, type, duration)
    }

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
                <AnimatePresence>
                    {toasts.map(t => (
                        <ToastItem key={t.id} {...t} onClose={() => removeToast(t.id)} />
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    )
}

const ToastItem = ({ message, type, onClose }) => {
    const icons = {
        success: <CheckCircle className="text-green-500" size={20} />,
        error: <AlertCircle className="text-red-500" size={20} />,
        info: <Info className="text-blue-500" size={20} />
    }
    
    const bgColors = {
        success: 'bg-[#111] border-green-500/20',
        error: 'bg-[#111] border-red-500/20',
        info: 'bg-[#111] border-blue-500/20'
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={`pointer-events-auto min-w-[300px] max-w-sm p-4 rounded-xl shadow-2xl border flex items-start gap-3 backdrop-blur-md ${bgColors[type] || bgColors.info} text-white`}
        >
            <div className="mt-0.5">{icons[type]}</div>
            <div className="flex-1 text-sm font-medium leading-relaxed">{message}</div>
            <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity">
                <X size={16} />
            </button>
        </motion.div>
    )
}
