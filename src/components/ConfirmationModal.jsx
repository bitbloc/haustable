import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'

export default function ConfirmationModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', isDangerous = false }) {
    if (!isOpen) return null

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                />

                {/* Modal */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="bg-paper border border-gray-200 rounded-2xl w-full max-w-sm p-6 relative z-10 shadow-2xl"
                >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto ${isDangerous ? 'bg-red-50' : 'bg-brand/10'}`}>
                        <AlertTriangle className={isDangerous ? "text-red-500" : "text-brandDark"} size={24} />
                    </div>
                    
                    <h3 className="text-xl font-bold text-ink text-center mb-2">{title}</h3>
                    <p className="text-subInk text-center text-sm mb-6 leading-relaxed">
                        {message}
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={onClose}
                            className="py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-subInk font-bold text-sm transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button 
                            onClick={() => { onConfirm(); onClose(); }}
                            className={`py-3 rounded-xl font-bold text-sm transition-colors shadow-lg ${isDangerous ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-brand hover:bg-brandDark text-ink'}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
