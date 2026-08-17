import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function HausmadeProductModal({ product, isOpen, onClose, onAddToCart }) {
    const [quantity, setQuantity] = useState(1)
    const [selectedOptions, setSelectedOptions] = useState({})
    const [validationMsg, setValidationMsg] = useState('')

    // Reset or initialize options when modal opens with a new product
    useEffect(() => {
        if (product && isOpen) {
            setQuantity(1)
            setValidationMsg('')
            
            // Auto-select first choice for required single-select option groups
            const initial = {}
            const optionGroups = product.menu_item_options?.map(o => o.option_groups).filter(Boolean) || []
            optionGroups.forEach(group => {
                if (group.is_required && group.option_choices && group.option_choices.length > 0) {
                    const firstChoice = group.option_choices[0]
                    initial[group.id] = {
                        choiceId: firstChoice.id,
                        choicePrice: firstChoice.price || 0,
                        name: firstChoice.name
                    }
                }
            })
            setSelectedOptions(initial)
        }
    }, [product, isOpen])

    // Keyboard ESC listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    if (!isOpen || !product) return null

    // Option groups calculation
    const optionGroups = product.menu_item_options?.map(o => o.option_groups).filter(Boolean) || []

    const handleOptionChange = (groupId, choiceId, choicePrice, choiceName) => {
        setValidationMsg('')
        setSelectedOptions(prev => ({
            ...prev,
            [groupId]: { choiceId, choicePrice, name: choiceName }
        }))
    }

    const calculateExtraPrice = () => {
        return Object.values(selectedOptions).reduce((sum, opt) => sum + (opt.choicePrice || 0), 0)
    }

    const unitPrice = (product.price || 0) + calculateExtraPrice()
    const totalPrice = unitPrice * quantity

    const handleConfirm = () => {
        // Validate required groups
        for (const group of optionGroups) {
            if (group.is_required && !selectedOptions[group.id]) {
                setValidationMsg(`กรุณาเลือกตัวเลือกในหมวด "${group.name}"`)
                return
            }
        }

        const optionsText = Object.entries(selectedOptions)
            .map(([groupId, opt]) => {
                const group = optionGroups.find(g => String(g.id) === String(groupId))
                const choice = group?.option_choices?.find(c => String(c.id) === String(opt.choiceId))
                return choice ? `${group.name}: ${choice.name}` : ''
            })
            .filter(Boolean)
            .join(' | ')

        onAddToCart(product, selectedOptions, quantity, calculateExtraPrice(), optionsText)
        onClose()
    }

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-[oklch(18%_0.012_28)]/60 backdrop-blur-sm"
                />

                {/* Modal Container */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 12 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                    className="relative w-full max-w-lg bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
                >
                    {/* Header Bar */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)]">
                        <div>
                            <span className="font-mono text-[10px] font-bold tracking-widest text-[oklch(52%_0.16_28)] uppercase block">
                                // HAUSMADE ITEM SPECIFICATION
                            </span>
                            <span className="font-mono text-xs font-bold text-[oklch(18%_0.012_28)] uppercase">
                                [ PRODUCT // CUSTOMIZATION ]
                            </span>
                        </div>
                        <button
                            onClick={onClose}
                            className="font-mono text-[11px] font-bold text-[oklch(18%_0.012_28)] hover:text-[oklch(52%_0.16_28)] transition-colors px-2 py-0.5 border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)]"
                        >
                            [ ESC / CLOSE ]
                        </button>
                    </div>

                    {/* Content Body */}
                    <div className="p-6 overflow-y-auto flex-grow flex flex-col gap-6">
                        {/* Image & Title Header */}
                        {product.image_url ? (
                            <div className="w-full h-52 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] overflow-hidden">
                                <img
                                    src={product.image_url}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ) : (
                            <div className="w-full h-24 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] flex items-center justify-center font-mono text-[11px] text-[oklch(55%_0.010_28)] uppercase">
                                [ HAUSMADE NAKHON PHANOM // ORIGINAL CRAFT ]
                            </div>
                        )}

                        <div>
                            <span className="font-mono text-[10px] font-bold text-[oklch(52%_0.16_28)] uppercase tracking-wider block mb-1">
                                // {product.menu_categories?.name || product.category || 'HAUSMADE CRAFT'}
                            </span>
                            <h3 className="text-xl font-bold text-[oklch(18%_0.012_28)] tracking-tight leading-snug">
                                {product.name}
                            </h3>
                            {product.description && (
                                <p className="text-xs text-[oklch(42%_0.010_28)] mt-2 leading-relaxed">
                                    {product.description}
                                </p>
                            )}
                            <div className="mt-3 font-mono text-lg font-bold text-[oklch(18%_0.012_28)]">
                                ฿{unitPrice.toLocaleString()}.-
                            </div>
                        </div>

                        {/* Options Section */}
                        {optionGroups.length > 0 && (
                            <div className="flex flex-col gap-5 border-t border-[oklch(85%_0.012_28)] pt-5">
                                {optionGroups.map((group) => (
                                    <div key={group.id} className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <span className="font-mono text-[11px] font-bold text-[oklch(18%_0.012_28)] uppercase">
                                                {group.name}
                                            </span>
                                            {group.is_required && (
                                                <span className="font-mono text-[9px] text-[oklch(52%_0.16_28)] uppercase font-bold">
                                                    [ REQUIRED / ต้องเลือก ]
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            {group.option_choices?.map((choice) => {
                                                const isSelected = selectedOptions[group.id]?.choiceId === choice.id
                                                return (
                                                    <button
                                                        key={choice.id}
                                                        type="button"
                                                        onClick={() => handleOptionChange(group.id, choice.id, choice.price || 0, choice.name)}
                                                        className={`px-3 py-2.5 text-left border font-mono text-[12px] transition-all flex items-center justify-between ${
                                                            isSelected
                                                                ? 'border-[oklch(52%_0.16_28)] bg-[oklch(52%_0.16_28)]/10 text-[oklch(18%_0.012_28)] font-bold shadow-xs'
                                                                : 'border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] text-[oklch(42%_0.010_28)] hover:bg-[oklch(94%_0.010_28)]'
                                                        }`}
                                                    >
                                                        <span>{choice.name}</span>
                                                        {choice.price > 0 && (
                                                            <span className="text-[10px] text-[oklch(55%_0.010_28)]">
                                                                +฿{choice.price}
                                                            </span>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Quantity Counter */}
                        <div className="flex items-center justify-between border-t border-[oklch(85%_0.012_28)] pt-5">
                            <span className="font-mono text-[11px] font-bold text-[oklch(18%_0.012_28)] uppercase">
                                [ QUANTITY // จำนวน ]
                            </span>
                            <div className="flex items-center border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)]">
                                <button
                                    type="button"
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="w-9 h-9 font-mono text-sm font-bold text-[oklch(18%_0.012_28)] hover:bg-[oklch(85%_0.012_28)] transition-colors"
                                >
                                    -
                                </button>
                                <span className="w-12 text-center font-mono text-sm font-bold text-[oklch(18%_0.012_28)]">
                                    {quantity}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setQuantity(quantity + 1)}
                                    className="w-9 h-9 font-mono text-sm font-bold text-[oklch(18%_0.012_28)] hover:bg-[oklch(85%_0.012_28)] transition-colors"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        {/* Validation Error Message */}
                        {validationMsg && (
                            <div className="p-2.5 border border-[oklch(52%_0.16_28)] bg-[oklch(52%_0.16_28)]/10 text-[oklch(52%_0.16_28)] font-mono text-xs font-bold">
                                [ ! ]: {validationMsg}
                            </div>
                        )}
                    </div>

                    {/* Footer Action Bar */}
                    <div className="p-4 border-t border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className="w-full py-3.5 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-mono text-[12px] font-bold uppercase tracking-wider hover:bg-[oklch(52%_0.16_28)] transition-colors flex items-center justify-between px-6"
                        >
                            <span>ADD TO CART // เพิ่มลงตะกร้า</span>
                            <span>฿{totalPrice.toLocaleString()}.-</span>
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}

