import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

export default function ImageModal({ isOpen, onClose, imageUrl, title }) {
    if (!isOpen) return null

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 z-[100]">
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    onClick={onClose}
                />
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white rounded-2xl overflow-hidden shadow-2xl relative max-w-sm w-full"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-lg">{title || 'Image'}</h3>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-8 flex items-center justify-center bg-white">
                        <img src={imageUrl} className="max-w-full max-h-[60vh] object-contain rounded-lg" alt={title} />
                    </div>
                    <div className="p-4 bg-gray-50 text-center text-xs text-gray-500 border-t border-gray-100">
                        Scan with your banking app
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
