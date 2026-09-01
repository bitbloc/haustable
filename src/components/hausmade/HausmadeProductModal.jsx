/* Hallmark · component: HausmadeProductModal · theme: Atelier (Thai Modern OKLCH)
 * features: Multi-Image Interactive Gallery, Lightbox Zoom, Variant Stock Indicators, Sold-Out Protection, Craft Metadata (Roast/Batch), Quantity Safeguard
 */
import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { isPreOrderItem, getPreOrderEta, getProductImages } from '../../hooks/useHausmadeShop'

export const TSHIRT_SIZE_CHART = [
    { size: 'S', chest: '37.0"', length: '25"', sleeve: '3.0"' },
    { size: 'M', chest: '39.4"', length: '25"', sleeve: '3.5"' },
    { size: 'L', chest: '41.7"', length: '26"', sleeve: '4.0"' },
    { size: 'XL', chest: '44.0"', length: '27"', sleeve: '4.5"' },
    { size: '2XL', chest: '46.4"', length: '28"', sleeve: '5.0"' },
    { size: '3XL', chest: '48.8"', length: '29"', sleeve: '5.5"' },
    { size: '4XL', chest: '51.8"', length: '30"', sleeve: '6.0"' }
]

export function getSizingInfo(name) {
    if (!name) return null
    const clean = name.trim().toUpperCase()
    return TSHIRT_SIZE_CHART.find(s => {
        if (clean === s.size) return true
        if (clean === `SIZE ${s.size}` || clean === `ไซส์ ${s.size}` || clean === `ขนาด ${s.size}`) return true
        if (clean.startsWith(`${s.size} `) || clean.endsWith(` ${s.size}`)) return true
        if (s.size === '2XL' && (clean === 'XXL' || clean === 'SIZE XXL')) return true
        if (s.size === '3XL' && (clean === 'XXXL' || clean === 'SIZE XXXL')) return true
        return false
    }) || null
}

export default function HausmadeProductModal({ product, isOpen, onClose, onAddToCart }) {
    const [quantity, setQuantity] = useState(1)
    const [selectedOptions, setSelectedOptions] = useState({})
    const [giftNote, setGiftNote] = useState('')
    const [validationMsg, setValidationMsg] = useState('')
    const [showSizeChart, setShowSizeChart] = useState(false)
    const [activeImgIdx, setActiveImgIdx] = useState(0)
    const [isLightboxOpen, setIsLightboxOpen] = useState(false)

    // Extract product images
    const productImages = useMemo(() => {
        return getProductImages(product)
    }, [product])

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
            setShowSizeChart(false)
            setActiveImgIdx(0)
            setIsLightboxOpen(false)
            
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

    // Keyboard navigation listener (ESC & Arrow keys for gallery)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return
            if (e.key === 'Escape') {
                if (isLightboxOpen) {
                    setIsLightboxOpen(false)
                } else {
                    onClose()
                }
            } else if (e.key === 'ArrowLeft' && productImages.length > 1) {
                setActiveImgIdx(prev => (prev > 0 ? prev - 1 : productImages.length - 1))
            } else if (e.key === 'ArrowRight' && productImages.length > 1) {
                setActiveImgIdx(prev => (prev < productImages.length - 1 ? prev + 1 : 0))
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose, isLightboxOpen, productImages.length])

    // Determine Maximum Available Stock for current combination
    const maxAvailableStock = useMemo(() => {
        if (!product) return 999
        let maxLimit = product.stock_quantity ?? product.remaining_stock ?? 999
        Object.values(selectedOptions).forEach(opt => {
            if (opt?.stock !== null && opt?.stock !== undefined) {
                maxLimit = Math.min(maxLimit, Number(opt.stock))
            }
        })
        return maxLimit
    }, [product, selectedOptions])

    if (!isOpen || !product) return null

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

    // Check if product is apparel / clothing
    const isApparelProduct = (product.name || '').toLowerCase().includes('shirt') || (product.name || '').includes('เสื้อ') || (product.category || '').toLowerCase().includes('shirt') || (product.description || '').includes('เสื้อ')

    const currentImage = productImages[activeImgIdx] || product.image_url

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
                                // HAUSMADE SPECIFICATION & GALLERY
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
                        
                        {/* 1. INTERACTIVE MULTI-IMAGE GALLERY VIEWPORT */}
                        {currentImage ? (
                            <div className="flex flex-col gap-2.5">
                                <div className="w-full h-64 sm:h-72 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] overflow-hidden relative group select-none">
                                    <AnimatePresence mode="wait">
                                        <motion.img
                                            key={currentImage}
                                            src={currentImage}
                                            alt={`${product.name} visual ${activeImgIdx + 1}`}
                                            initial={{ opacity: 0, scale: 0.98 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.98 }}
                                            transition={{ duration: 0.25 }}
                                            onClick={() => setIsLightboxOpen(true)}
                                            className="w-full h-full object-cover cursor-zoom-in"
                                        />
                                    </AnimatePresence>

                                    {/* Gallery Navigation Arrows */}
                                    {productImages.length > 1 && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setActiveImgIdx(prev => (prev > 0 ? prev - 1 : productImages.length - 1))
                                                }}
                                                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-[oklch(18%_0.012_28)]/80 hover:bg-[oklch(18%_0.012_28)] text-white font-mono text-xs font-bold flex items-center justify-center transition-all shadow-md cursor-pointer z-10"
                                                title="รูปก่อนหน้า"
                                            >
                                                ◀
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setActiveImgIdx(prev => (prev < productImages.length - 1 ? prev + 1 : 0))
                                                }}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-[oklch(18%_0.012_28)]/80 hover:bg-[oklch(18%_0.012_28)] text-white font-mono text-xs font-bold flex items-center justify-center transition-all shadow-md cursor-pointer z-10"
                                                title="รูปถัดไป"
                                            >
                                                ▶
                                            </button>
                                        </>
                                    )}

                                    {/* Top Right Counter & Zoom Hint */}
                                    <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                                        <button
                                            type="button"
                                            onClick={() => setIsLightboxOpen(true)}
                                            className="px-2 py-0.5 bg-[oklch(18%_0.012_28)]/80 hover:bg-[oklch(18%_0.012_28)] text-white font-mono text-[9px] font-bold uppercase tracking-wider backdrop-blur-xs flex items-center gap-1 cursor-pointer"
                                            title="คลิกเพื่อดูภาพขยายเต็มจอ"
                                        >
                                            <span>🔍 ZOOM</span>
                                        </button>
                                        {productImages.length > 1 && (
                                            <div className="px-2 py-0.5 bg-[oklch(18%_0.012_28)] text-white font-mono text-[9px] font-bold tracking-wider">
                                                [ {String(activeImgIdx + 1).padStart(2, '0')} / {String(productImages.length).padStart(2, '0')} ]
                                            </div>
                                        )}
                                    </div>

                                    {/* Stock warning pill */}
                                    {maxAvailableStock > 0 && maxAvailableStock <= 5 && (
                                        <div className="absolute bottom-2 left-2 bg-[oklch(52%_0.16_28)] text-white px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider shadow-sm z-10">
                                            [ เหลือเพียง {maxAvailableStock} ชิ้นสุดท้าย ]
                                        </div>
                                    )}
                                </div>

                                {/* Thumbnail Selector Strip */}
                                {productImages.length > 1 && (
                                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                                        {productImages.map((thumbUrl, idx) => {
                                            const isActive = idx === activeImgIdx
                                            return (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => setActiveImgIdx(idx)}
                                                    className={`w-14 h-14 flex-shrink-0 bg-[oklch(94%_0.010_28)] overflow-hidden transition-all cursor-pointer relative ${
                                                        isActive
                                                            ? 'border-2 border-[oklch(52%_0.16_28)] ring-2 ring-[oklch(52%_0.16_28)]/30'
                                                            : 'border border-[oklch(85%_0.012_28)] opacity-60 hover:opacity-100'
                                                    }`}
                                                >
                                                    <img
                                                        src={thumbUrl}
                                                        alt={`Thumbnail ${idx + 1}`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    {idx === 0 && (
                                                        <span className="absolute bottom-0 inset-x-0 bg-[oklch(18%_0.012_28)] text-white text-[7px] font-mono font-bold uppercase text-center">
                                                            COVER
                                                        </span>
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="w-full h-28 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] flex items-center justify-center font-mono text-[11px] text-[oklch(55%_0.010_28)] uppercase">
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
                                <p className="text-xs text-[oklch(42%_0.010_28)] mt-2 leading-relaxed font-sans whitespace-pre-line">
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

                        {/* Option Groups (Size, Grind, Packaging) with Variant Stock Indicator & Size Chart */}
                        {optionGroups.length > 0 && (
                            <div className="flex flex-col gap-5 border-t border-[oklch(85%_0.012_28)] pt-5">
                                {optionGroups.map((group) => {
                                    const gName = (group.name || '').toLowerCase()
                                    const isSizeGroup = gName.includes('size') || gName.includes('ไซส์') || gName.includes('ขนาด') || isApparelProduct

                                    return (
                                        <div key={group.id} className="flex flex-col gap-2.5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-[11px] font-bold text-[oklch(18%_0.012_28)] uppercase">
                                                        [ {group.name} ]
                                                    </span>
                                                    {group.is_required && (
                                                        <span className="font-mono text-[9px] text-[oklch(52%_0.16_28)] uppercase font-bold">
                                                            *จำเป็น
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Size Chart Toggle Button */}
                                                {isSizeGroup && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowSizeChart(prev => !prev)}
                                                        className="font-mono text-[10px] font-bold text-[oklch(52%_0.16_28)] hover:text-[oklch(18%_0.012_28)] uppercase underline cursor-pointer flex items-center gap-1"
                                                    >
                                                        <span>📏 {showSizeChart ? '[ ซ่อนตารางไซส์ ]' : '[ ดูตารางไซส์ (SIZE CHART) ]'}</span>
                                                    </button>
                                                )}
                                            </div>

                                            {/* Expandable Dieter Rams Minimalist Size Chart Table */}
                                            {isSizeGroup && showSizeChart && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="border-2 border-[oklch(18%_0.012_28)] bg-[oklch(94%_0.010_28)] p-4 font-mono text-xs flex flex-col gap-2.5 overflow-hidden"
                                                >
                                                    <div className="flex justify-between items-center border-b border-[oklch(85%_0.012_28)] pb-2">
                                                        <div>
                                                            <span className="font-black text-sm uppercase tracking-tight text-[oklch(18%_0.012_28)] block">
                                                                SIZE CHART // ตารางไซส์เสื้อ
                                                            </span>
                                                            <span className="text-[10px] text-[oklch(55%_0.010_28)] block">
                                                                T-SHIRT SIZING GUIDE (INCHES / นิ้ว)
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowSizeChart(false)}
                                                            className="text-[10px] text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] uppercase"
                                                        >
                                                            [ CLOSE / ปิด ]
                                                        </button>
                                                    </div>

                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-center border-collapse">
                                                            <thead>
                                                                <tr className="border-b-2 border-[oklch(18%_0.012_28)] text-[oklch(18%_0.012_28)] font-bold text-[11px]">
                                                                    <th className="py-2 text-left font-black">ขนาด</th>
                                                                    <th className="py-2">อก (Chest)</th>
                                                                    <th className="py-2">ยาว (Length)</th>
                                                                    <th className="py-2">แขน (Sleeve)</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {TSHIRT_SIZE_CHART.map((row) => {
                                                                    const currentSelectedChoiceName = selectedOptions[group.id]?.name
                                                                    const isRowSelected = currentSelectedChoiceName && getSizingInfo(currentSelectedChoiceName)?.size === row.size

                                                                    return (
                                                                        <tr
                                                                            key={row.size}
                                                                            className={`border-b border-[oklch(85%_0.012_28)]/60 text-[11px] transition-colors ${
                                                                                isRowSelected
                                                                                    ? 'bg-[oklch(52%_0.16_28)]/15 font-bold text-[oklch(52%_0.16_28)]'
                                                                                    : 'text-[oklch(18%_0.012_28)] hover:bg-[oklch(97%_0.008_28)]'
                                                                            }`}
                                                                        >
                                                                            <td className="py-2 text-left font-black">{row.size}</td>
                                                                            <td className="py-2 font-bold">{row.chest}</td>
                                                                            <td className="py-2">{row.length}</td>
                                                                            <td className="py-2">{row.sleeve}</td>
                                                                        </tr>
                                                                    )
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </motion.div>
                                            )}

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {group.option_choices?.map((choice) => {
                                                    const isSelected = selectedOptions[group.id]?.choiceId === choice.id
                                                    
                                                    // Compute stock per option choice
                                                    const choiceStock = choice.stock_quantity ?? choice.remaining_stock ?? null
                                                    const isSoldOut = choice.is_available === false || (choiceStock !== null && choiceStock <= 0)
                                                    const isLowStock = choiceStock !== null && choiceStock > 0 && choiceStock <= 5
                                                    const choicePrice = Number(choice.price_modifier || choice.price || 0)
                                                    const sizeDim = isSizeGroup ? getSizingInfo(choice.name) : null

                                                    return (
                                                        <button
                                                            key={choice.id}
                                                            type="button"
                                                            disabled={isSoldOut}
                                                            onClick={() => handleOptionChange(group, choice)}
                                                            className={`px-3.5 py-2.5 text-left border font-mono text-[11px] transition-all flex flex-col justify-between gap-1.5 cursor-pointer ${
                                                                isSoldOut
                                                                    ? 'border-dashed border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)]/50 text-[oklch(55%_0.010_28)] opacity-50 cursor-not-allowed'
                                                                    : isSelected
                                                                        ? 'border-[oklch(52%_0.16_28)] bg-[oklch(52%_0.16_28)]/10 text-[oklch(18%_0.012_28)] font-bold shadow-xs'
                                                                        : 'border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] text-[oklch(42%_0.010_28)] hover:bg-[oklch(94%_0.010_28)]'
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between w-full">
                                                                <span className="font-bold text-xs">{choice.name}</span>
                                                                {choicePrice > 0 && (
                                                                    <span className="text-[10px] text-[oklch(52%_0.16_28)] font-bold">
                                                                        +฿{choicePrice}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Quick Size Measurements Subtitle */}
                                                            {sizeDim && (
                                                                <div className="text-[10px] text-[oklch(55%_0.010_28)] font-sans">
                                                                    อก {sizeDim.chest} · ยาว {sizeDim.length} {sizeDim.sleeve ? `· แขน ${sizeDim.sleeve}` : ''}
                                                                </div>
                                                            )}

                                                            {/* Stock Status Badge per Variant */}
                                                            <div className="flex items-center justify-between w-full text-[9px] border-t border-[oklch(85%_0.012_28)]/40 pt-1">
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
                                    )
                                })}
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
                                {isPreOrderItem(product) ? '⏳ PRE-ORDER NOW // ยืนยันการสั่งจองล่วงหน้า' : 'ADD TO CART // เพิ่มลงตะกร้า'}
                            </span>
                            <span>฿{totalPrice.toLocaleString()}.-</span>
                        </button>

                    </div>
                </motion.div>

                {/* FULLSCREEN LIGHTBOX ZOOM MODAL */}
                <AnimatePresence>
                    {isLightboxOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-60 bg-[oklch(18%_0.012_28)]/95 backdrop-blur-md flex flex-col items-center justify-between p-4 select-none"
                            onClick={() => setIsLightboxOpen(false)}
                        >
                            {/* Lightbox Top Bar */}
                            <div className="w-full max-w-4xl flex items-center justify-between text-[oklch(97%_0.008_28)] font-mono text-xs z-10">
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-[oklch(52%_0.16_28)]">
                                        // {product.name}
                                    </span>
                                    {productImages.length > 1 && (
                                        <span className="text-[oklch(85%_0.012_28)]">
                                            [ {activeImgIdx + 1} / {productImages.length} ]
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsLightboxOpen(false)}
                                    className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white font-mono text-xs font-bold uppercase transition-colors cursor-pointer border border-white/20"
                                >
                                    [ ESC / ปิด ]
                                </button>
                            </div>

                            {/* Lightbox Main Image */}
                            <div
                                className="relative flex-grow flex items-center justify-center max-w-4xl w-full my-4"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <motion.img
                                    key={currentImage}
                                    src={currentImage}
                                    alt={product.name}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                    className="max-h-[75vh] max-w-full object-contain border border-[oklch(85%_0.012_28)]/30 shadow-2xl"
                                />

                                {/* Lightbox Navigation Buttons */}
                                {productImages.length > 1 && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setActiveImgIdx(prev => (prev > 0 ? prev - 1 : productImages.length - 1))
                                            }}
                                            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 hover:bg-black/90 text-white font-mono text-sm font-bold flex items-center justify-center transition-colors cursor-pointer border border-white/20"
                                            title="ก่อนหน้า"
                                        >
                                            ◀
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setActiveImgIdx(prev => (prev < productImages.length - 1 ? prev + 1 : 0))
                                            }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 hover:bg-black/90 text-white font-mono text-sm font-bold flex items-center justify-center transition-colors cursor-pointer border border-white/20"
                                            title="ถัดไป"
                                        >
                                            ▶
                                        </button>
                                    </>
                                )}
                            </div>

                            {/* Lightbox Bottom Thumbnail Row */}
                            {productImages.length > 1 && (
                                <div
                                    className="w-full max-w-2xl flex items-center justify-center gap-2 overflow-x-auto p-2"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {productImages.map((thumbUrl, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setActiveImgIdx(idx)}
                                            className={`w-12 h-12 flex-shrink-0 bg-black/40 overflow-hidden transition-all cursor-pointer ${
                                                idx === activeImgIdx
                                                    ? 'border-2 border-[oklch(52%_0.16_28)] scale-105'
                                                    : 'border border-white/20 opacity-50 hover:opacity-100'
                                            }`}
                                        >
                                            <img
                                                src={thumbUrl}
                                                alt={`Thumb ${idx + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </AnimatePresence>
    )
}

