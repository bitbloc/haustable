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
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                {/* Modal */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-sm p-6 relative z-10 shadow-2xl"
                >
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 mx-auto">
                        <AlertTriangle className={isDangerous ? "text-red-500" : "text-yellow-500"} size={24} />
                    </div>
                    
                    <h3 className="text-xl font-bold text-white text-center mb-2">{title}</h3>
                    <p className="text-gray-400 text-center text-sm mb-6 leading-relaxed">
                        {message}
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={onClose}
                            className="py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-sm transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button 
                            onClick={() => { onConfirm(); onClose(); }}
                            className={`py-3 rounded-xl font-bold text-white text-sm transition-colors shadow-lg ${isDangerous ? 'bg-red-600 hover:bg-red-500' : 'bg-[#DFFF00] hover:bg-[#cbe600] text-black'}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
