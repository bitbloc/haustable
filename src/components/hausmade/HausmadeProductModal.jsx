/* Hallmark · component: HausmadeProductModal · theme: Atelier (Thai Modern OKLCH)
 * features: Variant Stock Indicators, Sold-Out Protection, Craft Metadata (Roast/Batch), Quantity Safeguard
 */
import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { isPreOrderItem, getPreOrderEta } from '../../hooks/useHausmadeShop'

export default function HausmadeProductModal({ product, isOpen, onClose, onAddToCart }) {
    const [quantity, setQuantity] = useState(1)
    const [selectedOptions, setSelectedOptions] = useState({})
    const [giftNote, setGiftNote] = useState('')
    const [validationMsg, setValidationMsg] = useState('')

    // Option groups calculation
    const optionGroups = useMemo(() => {
        return product?.menu_item_options?.map(o => o.option_groups).filter(Boolean) || []
    }, [product])

    // Reset or initialize options when modal opens with a new product
    useEffect(() => {
        if (product && isOpen) {
            setQuantity(1)
            setValidationMsg('')
            setGiftNote('')
            
            // Auto-select first in-stock choice for required option groups
            const initial = {}
            optionGroups.forEach(group => {
                if (group.is_required && group.option_choices && group.option_choices.length > 0) {
                    // Find first choice that is NOT sold out
                    const availableChoice = group.option_choices.find(c => {
                        const isSoldOut = c.is_available === false || (c.stock_quantity !== undefined && c.stock_quantity <= 0) || (c.remaining_stock !== undefined && c.remaining_stock <= 0)
                        return !isSoldOut
                    }) || group.option_choices[0]

                    if (availableChoice) {
                        initial[group.id] = {
                            choiceId: availableChoice.id,
                            choicePrice: availableChoice.price_modifier || availableChoice.price || 0,
                            name: availableChoice.name,
                            stock: availableChoice.stock_quantity ?? availableChoice.remaining_stock ?? null
                        }
                    }
                }
            })
            setSelectedOptions(initial)
        }
    }, [product, isOpen, optionGroups])

    // Keyboard ESC listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    if (!isOpen || !product) return null

    // Determine Maximum Available Stock for current combination
    const maxAvailableStock = useMemo(() => {
        let maxLimit = product.stock_quantity ?? product.remaining_stock ?? 999
        Object.values(selectedOptions).forEach(opt => {
            if (opt.stock !== null && opt.stock !== undefined) {
                maxLimit = Math.min(maxLimit, Number(opt.stock))
            }
        })
        return maxLimit
    }, [product, selectedOptions])

    const handleOptionChange = (group, choice) => {
        const isSoldOut = choice.is_available === false || (choice.stock_quantity !== undefined && choice.stock_quantity <= 0) || (choice.remaining_stock !== undefined && choice.remaining_stock <= 0)
        if (isSoldOut) return

        setValidationMsg('')
        const choicePrice = Number(choice.price_modifier || choice.price || 0)
        const choiceStock = choice.stock_quantity ?? choice.remaining_stock ?? null

        setSelectedOptions(prev => ({
            ...prev,
            [group.id]: {
                choiceId: choice.id,
                choicePrice,
                name: choice.name,
                stock: choiceStock
            }
        }))

        // Adjust quantity if exceeds new variant's stock
        if (choiceStock !== null && quantity > choiceStock) {
            setQuantity(Math.max(1, choiceStock))
        }
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

        const optionsTextList = Object.entries(selectedOptions)
            .map(([groupId, opt]) => {
                const group = optionGroups.find(g => String(g.id) === String(groupId))
                const choice = group?.option_choices?.find(c => String(c.id) === String(opt.choiceId))
                return choice ? `${group.name}: ${choice.name}` : ''
            })
            .filter(Boolean)

        if (giftNote.trim()) {
            optionsTextList.push(`ข้อความของฝาก: ${giftNote.trim()}`)
        }

        const optionsText = optionsTextList.join(' | ')

        onAddToCart(product, selectedOptions, quantity, calculateExtraPrice(), optionsText)
        onClose()
    }

    // Check if product has coffee/craft roast metadata
    const craftSpecs = product.craft_specs || product.metadata || {}
    const hasCraftSpecs = craftSpecs.roast_level || craftSpecs.origin || craftSpecs.process || craftSpecs.tasting_notes || product.origin || product.tasting_notes

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
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
                    className="relative w-full max-w-lg bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] shadow-2xl overflow-hidden z-10 flex flex-col max-h-[92vh] font-sans"
                >
                    {/* Header Bar */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex-shrink-0">
                        <div>
                            <span className="font-mono text-[10px] font-bold tracking-widest text-[oklch(52%_0.16_28)] uppercase block">
                                // HAUSMADE SPECIFICATION & STOCK
                            </span>
                            <span className="font-mono text-xs font-bold text-[oklch(18%_0.012_28)] uppercase">
                                [ PRODUCT // CUSTOMIZATION ]
                            </span>
                        </div>
                        <button
                            onClick={onClose}
                            className="font-mono text-[11px] font-bold text-[oklch(18%_0.012_28)] hover:text-[oklch(52%_0.16_28)] transition-colors px-2 py-0.5 border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] cursor-pointer"
                        >
                            [ ESC / CLOSE ]
                        </button>
                    </div>

                    {/* Content Body (Scrollable) */}
                    <div className="p-6 overflow-y-auto flex-grow flex flex-col gap-6">
                        
                        {/* Image & Title Header */}
                        {product.image_url ? (
                            <div className="w-full h-52 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] overflow-hidden relative">
                                <img
                                    src={product.image_url}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                />
                                {maxAvailableStock > 0 && maxAvailableStock <= 5 && (
                                    <div className="absolute bottom-2 left-2 bg-[oklch(52%_0.16_28)] text-white px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider shadow-sm">
                                        [ เหลือเพียง {maxAvailableStock} ชิ้นสุดท้าย ]
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="w-full h-24 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] flex items-center justify-center font-mono text-[11px] text-[oklch(55%_0.010_28)] uppercase">
                                [ HAUSMADE NAKHON PHANOM // ORIGINAL CRAFT ]
                            </div>
                        )}

                        <div>
                            <div className="flex justify-between items-start gap-3">
                                <div>
                                    <span className="font-mono text-[10px] font-bold text-[oklch(52%_0.16_28)] uppercase tracking-wider block mb-1">
                                        // {product.menu_categories?.name || product.category || 'HAUSMADE CRAFT'}
                                    </span>
                                    <h3 className="text-xl font-bold text-[oklch(18%_0.012_28)] tracking-tight leading-snug">
                                        {product.name}
                                    </h3>
                                </div>
                                <div className="font-mono text-lg font-bold text-[oklch(18%_0.012_28)] whitespace-nowrap">
                                    ฿{unitPrice.toLocaleString()}.-
                                </div>
                            </div>

                            {product.description && (
                                <p className="text-xs text-[oklch(42%_0.010_28)] mt-2 leading-relaxed font-sans">
                                    {product.description}
                                </p>
                            )}
                        </div>

                        {/* Pre-Order Schedule Notice */}
                        {isPreOrderItem(product) && (
                            <div className="p-3.5 bg-[oklch(45%_0.08_140)]/10 border border-[oklch(45%_0.08_140)] font-mono text-xs flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 text-[oklch(45%_0.08_140)] font-bold">
                                    <span>⏳</span>
                                    <span className="uppercase">[ PRE-ORDER // สินค้าเปิดสั่งจองล่วงหน้า ]</span>
                                </div>
                                <p className="text-[11px] text-[oklch(18%_0.012_28)] font-sans mt-0.5 leading-relaxed">
                                    สินค้าชิ้นนี้ผลิตสดใหม่ตามรอบสั่งจอง กำหนดการจัดส่งพัสดุ: <strong className="font-mono text-[oklch(45%_0.08_140)]">{getPreOrderEta(product)}</strong>
                                </p>
                            </div>
                        )}

                        {/* Artisanal Craft Metadata Box (Coffee / Sauce / Batch) */}
                        {hasCraftSpecs && (
                            <div className="p-3.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] font-mono text-[11px] flex flex-col gap-1.5">
                                <span className="text-[10px] font-bold text-[oklch(52%_0.16_28)] uppercase tracking-wider">
                                    [ CRAFT BATCH & ORIGIN METADATA ]
                                </span>
                                {(craftSpecs.origin || product.origin) && (
                                    <div className="flex justify-between border-b border-[oklch(85%_0.012_28)]/60 pb-1">
                                        <span className="text-[oklch(55%_0.010_28)]">ORIGIN / แหล่งปลูก:</span>
                                        <span className="font-bold text-[oklch(18%_0.012_28)]">{craftSpecs.origin || product.origin}</span>
                                    </div>
                                )}
                                {(craftSpecs.process || craftSpecs.roast_level) && (
                                    <div className="flex justify-between border-b border-[oklch(85%_0.012_28)]/60 pb-1">
                                        <span className="text-[oklch(55%_0.010_28)]">ROAST / PROCESS:</span>
                                        <span className="font-bold text-[oklch(18%_0.012_28)]">{craftSpecs.process || craftSpecs.roast_level}</span>
                                    </div>
                                )}
                                {(craftSpecs.tasting_notes || product.tasting_notes) && (
                                    <div className="flex justify-between">
                                        <span className="text-[oklch(55%_0.010_28)]">TASTING NOTES:</span>
                                        <span className="font-bold text-[oklch(52%_0.16_28)] text-right">{craftSpecs.tasting_notes || product.tasting_notes}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Option Groups (Size, Grind, Packaging) with Variant Stock Indicator */}
                        {optionGroups.length > 0 && (
                            <div className="flex flex-col gap-5 border-t border-[oklch(85%_0.012_28)] pt-5">
                                {optionGroups.map((group) => (
                                    <div key={group.id} className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <span className="font-mono text-[11px] font-bold text-[oklch(18%_0.012_28)] uppercase">
                                                [ {group.name} ]
                                            </span>
                                            {group.is_required && (
                                                <span className="font-mono text-[9px] text-[oklch(52%_0.16_28)] uppercase font-bold">
                                                    [ REQUIRED / ต้องเลือก ]
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {group.option_choices?.map((choice) => {
                                                const isSelected = selectedOptions[group.id]?.choiceId === choice.id
                                                
                                                // Compute stock per option choice
                                                const choiceStock = choice.stock_quantity ?? choice.remaining_stock ?? null
                                                const isSoldOut = choice.is_available === false || (choiceStock !== null && choiceStock <= 0)
                                                const isLowStock = choiceStock !== null && choiceStock > 0 && choiceStock <= 5
                                                const choicePrice = Number(choice.price_modifier || choice.price || 0)

                                                return (
                                                    <button
                                                        key={choice.id}
                                                        type="button"
                                                        disabled={isSoldOut}
                                                        onClick={() => handleOptionChange(group, choice)}
                                                        className={`px-3.5 py-2.5 text-left border font-mono text-[11px] transition-all flex flex-col justify-between gap-1 cursor-pointer ${
                                                            isSoldOut
                                                                ? 'border-dashed border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)]/50 text-[oklch(55%_0.010_28)] opacity-50 cursor-not-allowed'
                                                                : isSelected
                                                                    ? 'border-[oklch(52%_0.16_28)] bg-[oklch(52%_0.16_28)]/10 text-[oklch(18%_0.012_28)] font-bold shadow-xs'
                                                                    : 'border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] text-[oklch(42%_0.010_28)] hover:bg-[oklch(94%_0.010_28)]'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between w-full">
                                                            <span className="font-bold">{choice.name}</span>
                                                            {choicePrice > 0 && (
                                                                <span className="text-[10px] text-[oklch(52%_0.16_28)]">
                                                                    +฿{choicePrice}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Stock Status Badge per Variant */}
                                                        <div className="flex items-center justify-between w-full text-[9px]">
                                                            {isSoldOut ? (
                                                                <span className="text-red-600 font-bold">[ SOLD OUT // หมด ]</span>
                                                            ) : isLowStock ? (
                                                                <span className="text-[oklch(52%_0.16_28)] font-bold">● เหลือ {choiceStock} ชิ้น</span>
                                                            ) : choiceStock !== null ? (
                                                                <span className="text-[oklch(45%_0.08_140)]">มีสินค้า ({choiceStock})</span>
                                                            ) : (
                                                                <span className="text-[oklch(55%_0.010_28)]">พร้อมส่ง</span>
                                                            )}

                                                            {isSelected && (
                                                                <span className="font-bold text-[oklch(52%_0.16_28)]">[ SELECTED ]</span>
                                                            )}
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Gift Note / Greeting Card (Optional Craft Feature) */}
                        <div className="flex flex-col gap-2 border-t border-[oklch(85%_0.012_28)] pt-4">
                            <span className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase tracking-wider">
                                [ ฝากข้อความ / การ์ดของฝาก (OPTIONAL) ]
                            </span>
                            <input
                                type="text"
                                value={giftNote}
                                onChange={(e) => setGiftNote(e.target.value)}
                                placeholder="เช่น เขียนการ์ดสุขสันต์วันเกิด / บดสำหรับ Cold Brew"
                                className="w-full px-3 py-2 bg-white border border-[oklch(85%_0.012_28)] font-mono text-xs text-[oklch(18%_0.012_28)] focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                            />
                        </div>

                        {/* Quantity Counter with Stock Safeguard */}
                        <div className="flex items-center justify-between border-t border-[oklch(85%_0.012_28)] pt-5">
                            <div className="flex flex-col">
                                <span className="font-mono text-[11px] font-bold text-[oklch(18%_0.012_28)] uppercase">
                                    [ QUANTITY // จำนวน ]
                                </span>
                                {maxAvailableStock < 999 && (
                                    <span className="font-mono text-[10px] text-[oklch(52%_0.16_28)]">
                                        (สั่งได้สูงสุด {maxAvailableStock} ชิ้น)
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)]">
                                <button
                                    type="button"
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="w-9 h-9 font-mono text-sm font-bold text-[oklch(18%_0.012_28)] hover:bg-[oklch(85%_0.012_28)] transition-colors cursor-pointer"
                                >
                                    -
                                </button>
                                <span className="w-12 text-center font-mono text-sm font-bold">
                                    {quantity}
                                </span>
                                <button
                                    type="button"
                                    disabled={quantity >= maxAvailableStock}
                                    onClick={() => setQuantity(Math.min(maxAvailableStock, quantity + 1))}
                                    className="w-9 h-9 font-mono text-sm font-bold text-[oklch(18%_0.012_28)] hover:bg-[oklch(85%_0.012_28)] transition-colors disabled:opacity-30 cursor-pointer"
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
                    <div className="p-4 border-t border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex items-center gap-3 flex-shrink-0">
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className={`w-full py-3.5 font-mono text-[12px] font-bold uppercase tracking-wider transition-colors flex items-center justify-between px-6 cursor-pointer shadow-xs ${
                                isPreOrderItem(product)
                                    ? 'bg-[oklch(45%_0.08_140)] hover:bg-[oklch(38%_0.08_140)] text-white'
                                    : 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] hover:bg-[oklch(52%_0.16_28)]'
                            }`}
                        >
                            <span>
                                {isPreOrderItem(product) ? '⏳ PRE-ORDER NOW // ยืนยันการสั่งจอง' : 'ADD TO CART // เพิ่มลงตะกร้า'}
                            </span>
                            <span>฿{totalPrice.toLocaleString()}.-</span>
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
