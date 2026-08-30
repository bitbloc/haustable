import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useOrderSubmission } from '../../hooks/useOrderSubmission'
import { usePromotion } from '../../hooks/usePromotion'
import { getThaiDate, toThaiISO } from '../../utils/timeUtils'
import { supabase } from '../../lib/supabaseClient'

const LAST_ADDRESS_STORAGE_KEY = 'hausmade_last_shipping_address'

export default function HausmadeCartDrawer({
    isOpen,
    onClose,
    shopState
}) {
    const {
        // Cart state & actions
        cart,
        cartItemCount,
        cartSubtotal,
        hasPreOrderInCart,
        preOrderItemsInCart,
        calculatedShippingFee,
        isFreeShipping,
        itemsNeededForFreeShipping,
        amountNeededForFreeShipping,
        totalAmount: rawTotalAmount,
        updateQuantity,
        removeFromCart,
        clearCart,
        settings,

        // CRM xhaus Loyalty
        memberProfile,
        memberTierInfo,
        availableXhausBalance,
        projectedCoinsEarned,
        redeemedCoinsInput,
        setRedeemedCoinsInput,
        xhausDiscountAmount,
        effectiveXhausRedeemed,
        xhausDiscountCalculation
    } = shopState

    const { submitOrder, isSubmitting, error: submitError } = useOrderSubmission()

    // Fulfilment Mode: 'shipping' | 'pickup'
    const [fulfilmentMode, setFulfilmentMode] = useState('shipping')

    // Customer Form State
    const [contactName, setContactName] = useState('')
    const [contactPhone, setContactPhone] = useState('')
    
    // Address for Shipping
    const [addressLine, setAddressLine] = useState('')
    const [subDistrict, setSubDistrict] = useState('')
    const [district, setDistrict] = useState('')
    const [province, setProvince] = useState('')
    const [postalCode, setPostalCode] = useState('')

    // Date/Time for Pickup
    const [pickupDate, setPickupDate] = useState('today')
    const [pickupTime, setPickupTime] = useState('14:00')

    const [specialRequest, setSpecialRequest] = useState('')
    const [slipFile, setSlipFile] = useState(null)
    const [slipPreviewUrl, setSlipPreviewUrl] = useState(null)
    const [submittedOrder, setSubmittedOrder] = useState(null)
    const [validationError, setValidationError] = useState('')
    const [copyFeedback, setCopyFeedback] = useState('')

    // Promotion Code Hook
    const { 
        promoCode, setPromoCode, 
        appliedPromo, promoError, isValidating: isPromoValidating, 
        applyCode, removePromo, revalidatePromo 
    } = usePromotion()

    // Final total calculation with discount (Promo + xhaus)
    const promoDiscount = appliedPromo?.discountAmount || 0
    const totalDiscountAmount = promoDiscount + (xhausDiscountAmount || 0)
    const activeShippingFee = fulfilmentMode === 'pickup' ? 0 : calculatedShippingFee
    const finalTotalAmount = Math.max(0, (cartSubtotal - totalDiscountAmount) + activeShippingFee)

    // Revalidate promo code when cartSubtotal changes
    useEffect(() => {
        if (appliedPromo) {
            revalidatePromo(cartSubtotal, 'ordering')
        }
    }, [cartSubtotal, appliedPromo, revalidatePromo])

    // Auto-fill from Profile & localStorage
    useEffect(() => {
        let isMounted = true
        async function loadPrefill() {
            try {
                // 1. Check Auth & Profile
                const { data: { user } } = await supabase.auth.getUser()
                if (user && isMounted) {
                    if (user.user_metadata?.full_name) setContactName(user.user_metadata.full_name)
                    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
                    if (profile && isMounted) {
                        if (profile.display_name) setContactName(profile.display_name)
                        if (profile.phone_number) setContactPhone(profile.phone_number)
                    }
                }

                // 2. Load cached shipping address
                const cachedAddr = localStorage.getItem(LAST_ADDRESS_STORAGE_KEY)
                if (cachedAddr && isMounted) {
                    const parsed = JSON.parse(cachedAddr)
                    if (parsed.addressLine) setAddressLine(parsed.addressLine)
                    if (parsed.subDistrict) setSubDistrict(parsed.subDistrict)
                    if (parsed.district) setDistrict(parsed.district)
                    if (parsed.province) setProvince(parsed.province)
                    if (parsed.postalCode) setPostalCode(parsed.postalCode)
                    if (!contactName && parsed.contactName) setContactName(parsed.contactName)
                    if (!contactPhone && parsed.contactPhone) setContactPhone(parsed.contactPhone)
                }
            } catch (err) {
                console.warn('Auto-fill load error:', err)
            }
        }

        if (isOpen) {
            loadPrefill()
        }
        return () => { isMounted = false }
    }, [isOpen])

    if (!isOpen) return null

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0]
            setSlipFile(file)
            setSlipPreviewUrl(URL.createObjectURL(file))
        }
    }

    const handleRemoveSlip = () => {
        setSlipFile(null)
        if (slipPreviewUrl) URL.revokeObjectURL(slipPreviewUrl)
        setSlipPreviewUrl(null)
    }

    const handleCopy = (text, label) => {
        navigator.clipboard.writeText(text)
        setCopyFeedback(label)
        setTimeout(() => setCopyFeedback(''), 2500)
    }

    const handleApplyPromoCode = async () => {
        if (!promoCode.trim()) return
        await applyCode(promoCode.trim().toUpperCase(), cartSubtotal, 'ordering')
    }

    const handleSubmitOrder = async (e) => {
        e.preventDefault()
        setValidationError('')

        if (cart.length === 0) {
            setValidationError('ไม่มีสินค้าในตะกร้า')
            return
        }

        if (!contactName.trim() || !contactPhone.trim()) {
            setValidationError('กรุณากรอกชื่อและเบอร์โทรศัพท์ติดต่อ')
            return
        }

        if (fulfilmentMode === 'shipping') {
            if (!addressLine.trim() || !province.trim() || !postalCode.trim()) {
                setValidationError('กรุณากรอกข้อมูลที่อยู่จัดส่งให้ครบถ้วน')
                return
            }
        }

        if (!slipFile) {
            setValidationError('กรุณาอัปโหลดสลิปการชำระเงิน')
            return
        }

        // Construct Full Address String
        const fullShippingAddress = fulfilmentMode === 'shipping'
            ? `${addressLine} ${subDistrict ? 'ต.' + subDistrict : ''} ${district ? 'อ.' + district : ''} จ.${province} ${postalCode}`.trim()
            : 'รับหน้าร้าน IN THE HAUS'

        // Save last used address
        if (fulfilmentMode === 'shipping') {
            try {
                localStorage.setItem(LAST_ADDRESS_STORAGE_KEY, JSON.stringify({
                    contactName,
                    contactPhone,
                    addressLine,
                    subDistrict,
                    district,
                    province,
                    postalCode
                }))
            } catch {}
        }

        const trackingToken = `HM-${Date.now().toString(36).toUpperCase()}`

        const targetDateStr = pickupDate === 'tomorrow'
            ? (() => {
                const d = new Date()
                d.setDate(d.getDate() + 1)
                return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
            })()
            : getThaiDate()

        const bookingDateTime = fulfilmentMode === 'pickup'
            ? toThaiISO(targetDateStr, pickupTime)
            : toThaiISO(getThaiDate(), '12:00')

        const bookingPayload = {
            pickup_contact_name: contactName,
            pickup_contact_phone: contactPhone,
            booking_time: bookingDateTime,
            status: 'pending',
            deposit_amount: finalTotalAmount,
            total_amount: finalTotalAmount,
            discount_amount: totalDiscountAmount,
            promotion_code_id: appliedPromo?.id || null,
            customer_note: specialRequest ? `[HAUSMADE ${hasPreOrderInCart ? 'PRE-ORDER ' : ''}${fulfilmentMode.toUpperCase()}] ${specialRequest}` : `[HAUSMADE ${hasPreOrderInCart ? 'PRE-ORDER ' : ''}${fulfilmentMode.toUpperCase()}]`,
            order_type: fulfilmentMode === 'shipping' ? 'hausmade_shipping' : 'hausmade_pickup',
            booking_type: 'hausmade',
            is_preorder: hasPreOrderInCart,
            tracking_token: trackingToken,
            shipping_address: fullShippingAddress,
            shipping_fee: activeShippingFee,
            xhaus_earned: projectedCoinsEarned || 0,
            xhaus_redeemed: effectiveXhausRedeemed || 0,
            xhaus_discount: xhausDiscountAmount || 0
        }

        const orderItemsPayload = cart.map(item => ({
            menu_item_id: item.id,
            quantity: item.quantity,
            price_at_time: item.price + (item.optionsPrice || 0),
            selected_options: item.optionsText || null
        }))

        // Optional LINE LIFF token if user is inside LINE
        const lineIdToken = window.liff?.isLoggedIn?.() ? window.liff.getIDToken() : null

        await submitOrder({
            bookingPayload,
            orderItemsPayload,
            slipFile,
            lineIdToken,
            onSuccess: () => {
                setSubmittedOrder({
                    trackingToken,
                    totalAmount: finalTotalAmount,
                    fulfilmentMode,
                    shippingAddress: fullShippingAddress,
                    isPreOrder: hasPreOrderInCart
                })
                clearCart()
            }
        })
    }

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex justify-end">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-[oklch(18%_0.012_28)]/60 backdrop-blur-sm"
                />

                {/* Drawer Panel */}
                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                    className="relative w-full max-w-lg h-full bg-[oklch(97%_0.008_28)] border-l border-[oklch(85%_0.012_28)] shadow-2xl flex flex-col z-10 overflow-hidden"
                >
                    {/* Header Bar */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex-shrink-0">
                        <div>
                            <span className="font-mono text-[10px] font-bold tracking-widest text-[oklch(52%_0.16_28)] uppercase block">
                                // HAUSMADE SHOPPING CART
                            </span>
                            <h2 className="text-lg font-bold text-[oklch(18%_0.012_28)] font-mono uppercase">
                                [ CART // ตะกร้าสินค้า ({cartItemCount}) ]
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="font-mono text-[11px] font-bold text-[oklch(18%_0.012_28)] hover:text-[oklch(52%_0.16_28)] transition-colors px-2.5 py-1 border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)]"
                        >
                            [ ESC / CLOSE ]
                        </button>
                    </div>

                    {/* Main Content Scrollable Area */}
                    <div className="flex-grow overflow-y-auto p-6 flex flex-col gap-6">

                        {submittedOrder ? (
                            /* Order Success State */
                            <div className="flex flex-col gap-5 py-6">
                                <div className="border border-[oklch(45%_0.08_140)] bg-[oklch(45%_0.08_140)]/10 p-5 border-l-4 border-l-[oklch(45%_0.08_140)]">
                                    <span className="font-mono text-[10px] font-bold text-[oklch(45%_0.08_140)] uppercase tracking-wider block mb-1">
                                        [ ORDER TRANSMITTED // สั่งซื้อสำเร็จ ]
                                    </span>
                                    <h3 className="text-lg font-bold text-[oklch(18%_0.012_28)]">
                                        ขอบคุณสำหรับคำสั่งซื้อ HAUSMADE
                                    </h3>
                                    <p className="text-xs text-[oklch(42%_0.010_28)] mt-1 leading-relaxed">
                                        {submittedOrder.isPreOrder 
                                            ? 'ระบบได้รับสลิปคำสั่งซื้อพรีออเดอร์เรียบร้อยแล้ว ทีมงานจะจัดเตรียมผลิตและจัดส่งตามรอบที่กำหนด'
                                            : 'ระบบได้รับสลิปการชำระเงินเรียบร้อยแล้ว ทีมงานจะดำเนินการแพ็คสินค้าและจัดส่งให้โดยเร็วที่สุด'
                                        }
                                    </p>
                                </div>

                                <div className="p-4 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex flex-col gap-2.5 font-mono text-[12px]">
                                    <div className="flex justify-between items-center border-b border-[oklch(85%_0.012_28)] pb-2">
                                        <span className="text-[oklch(55%_0.010_28)]">TRACKING TOKEN:</span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-[oklch(52%_0.16_28)]">{submittedOrder.trackingToken}</span>
                                            <button
                                                onClick={() => handleCopy(submittedOrder.trackingToken, 'คัดลอก Tracking Token แล้ว!')}
                                                className="px-2 py-0.5 border border-[oklch(85%_0.012_28)] bg-white text-[10px] uppercase hover:bg-[oklch(18%_0.012_28)] hover:text-white transition-colors"
                                            >
                                                [ COPY ]
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex justify-between border-b border-[oklch(85%_0.012_28)] pb-2">
                                        <span className="text-[oklch(55%_0.010_28)]">FULFILMENT:</span>
                                        <span className="font-bold">{submittedOrder.fulfilmentMode === 'shipping' ? '🚚 จัดส่งพัสดุเอกชน' : '🏪 รับหน้าร้าน'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-[oklch(85%_0.012_28)] pb-2">
                                        <span className="text-[oklch(55%_0.010_28)]">DESTINATION:</span>
                                        <span className="font-bold text-right max-w-[200px] truncate">{submittedOrder.shippingAddress}</span>
                                    </div>
                                    <div className="flex justify-between pt-1">
                                        <span className="text-[oklch(55%_0.010_28)]">TOTAL PAID:</span>
                                        <span className="font-bold text-sm text-[oklch(18%_0.012_28)]">฿{submittedOrder.totalAmount.toLocaleString()}.-</span>
                                    </div>
                                </div>

                                {copyFeedback && (
                                    <div className="p-2 bg-[oklch(45%_0.08_140)]/10 border border-[oklch(45%_0.08_140)] text-[oklch(45%_0.08_140)] font-mono text-xs font-bold text-center">
                                        {copyFeedback}
                                    </div>
                                )}

                                <div className="flex flex-col gap-2.5">
                                    <a
                                        href={`/tracking/${submittedOrder.trackingToken}`}
                                        className="w-full py-3.5 bg-[oklch(52%_0.16_28)] text-white font-mono text-[12px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity text-center"
                                    >
                                        [ TRACK ORDER // ติดตามสถานะพัสดุ ]
                                    </a>
                                    <button
                                        onClick={() => {
                                            setSubmittedOrder(null)
                                            onClose()
                                        }}
                                        className="w-full py-3 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-mono text-[12px] font-bold uppercase tracking-wider hover:bg-[oklch(18%_0.012_28)] hover:text-[oklch(97%_0.008_28)] transition-colors text-center"
                                    >
                                        [ RETURN TO STORE // กลับสู่หน้าร้าน ]
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Fulfilment Switcher (Tabular Dial) */}
                                <div className="flex flex-col gap-2">
                                    <span className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase tracking-wider">
                                        [ FULFILMENT MODE // วิธีรับสินค้า ]
                                    </span>
                                    <div className="grid grid-cols-2 gap-2 bg-[oklch(94%_0.010_28)] p-1 border border-[oklch(85%_0.012_28)]">
                                        <button
                                            type="button"
                                            onClick={() => setFulfilmentMode('shipping')}
                                            className={`py-2.5 px-3 font-mono text-[11px] font-bold transition-all border ${
                                                fulfilmentMode === 'shipping'
                                                    ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)]'
                                                    : 'bg-transparent text-[oklch(42%_0.010_28)] border-transparent hover:text-[oklch(18%_0.012_28)]'
                                            }`}
                                        >
                                            [ DELIVER // ส่งพัสดุ ]
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFulfilmentMode('pickup')}
                                            className={`py-2.5 px-3 font-mono text-[11px] font-bold transition-all border ${
                                                fulfilmentMode === 'pickup'
                                                    ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)]'
                                                    : 'bg-transparent text-[oklch(42%_0.010_28)] border-transparent hover:text-[oklch(18%_0.012_28)]'
                                            }`}
                                        >
                                            [ PICKUP // รับหน้าร้าน ]
                                        </button>
                                    </div>
                                </div>

                                {/* Free Shipping Progress Bar */}
                                {fulfilmentMode === 'shipping' && (settings.freeShippingMinItems > 0 || settings.freeShippingMinAmount > 0) && (
                                    <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] p-3.5 flex flex-col gap-2">
                                        <div className="flex justify-between font-mono text-[10px] font-bold">
                                            <span className="text-[oklch(18%_0.012_28)]">
                                                {isFreeShipping
                                                    ? '[ FREE SHIPPING UNLOCKED // ได้รับสิทธิ์จัดส่งฟรี ]'
                                                    : `[ PROMOTION // ซื้อครบ ${settings.freeShippingMinItems > 0 ? `${settings.freeShippingMinItems} ชิ้น` : ''} ${settings.freeShippingMinAmount > 0 ? `หรือ ฿${settings.freeShippingMinAmount}.-` : ''} ส่งฟรี ]`}
                                            </span>
                                            <span className="text-[oklch(52%_0.16_28)] font-bold">
                                                {isFreeShipping ? 'FREE' : `${cartItemCount}/${settings.freeShippingMinItems} ITEMS`}
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-[oklch(85%_0.012_28)] overflow-hidden">
                                            <motion.div
                                                className="h-full bg-[oklch(52%_0.16_28)]"
                                                initial={{ width: 0 }}
                                                animate={{
                                                    width: `${Math.min(100, Math.max(
                                                        settings.freeShippingMinItems > 0 ? (cartItemCount / settings.freeShippingMinItems) * 100 : 0,
                                                        settings.freeShippingMinAmount > 0 ? (cartSubtotal / settings.freeShippingMinAmount) * 100 : 0
                                                    ))}%`
                                                }}
                                                transition={{ duration: 0.4 }}
                                            />
                                        </div>
                                        {!isFreeShipping && (
                                            <span className="font-mono text-[10px] text-[oklch(55%_0.010_28)]">
                                                * ซื้อเพิ่มอีก {itemsNeededForFreeShipping > 0 ? `${itemsNeededForFreeShipping} ชิ้น` : ''} {amountNeededForFreeShipping > 0 ? `หรือ ฿${amountNeededForFreeShipping}.-` : ''} เพื่อรับสิทธิ์ส่งฟรีทั่วประเทศ
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Cart Items List */}
                                <div className="flex flex-col gap-3">
                                    <span className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase tracking-wider">
                                        [ ITEMS SUMMARY // รายการสินค้า ]
                                    </span>

                                    {/* Pre-Order Notice in Cart */}
                                    {hasPreOrderInCart && (
                                        <div className="p-3 bg-[oklch(45%_0.08_140)]/15 border border-[oklch(45%_0.08_140)] font-mono text-xs flex flex-col gap-1">
                                            <div className="flex items-center gap-1.5 text-[oklch(45%_0.08_140)] font-bold">
                                                <span>⏳</span>
                                                <span className="uppercase">[ มีสินค้าพรีออเดอร์ในคำสั่งซื้อ ]</span>
                                            </div>
                                            <p className="text-[11px] text-[oklch(18%_0.012_28)] font-sans leading-relaxed">
                                                พัสดุในออเดอร์นี้จะจัดส่งพร้อมกันตามรอบสินค้าพรีออเดอร์ ({preOrderItemsInCart.map(i => i.preOrderEta || '5-7 วัน').filter(Boolean)[0] || 'ตามรอบการผลิต'})
                                            </p>
                                        </div>
                                    )}

                                    {cart.length === 0 ? (
                                        <div className="p-8 border border-dashed border-[oklch(85%_0.012_28)] text-center font-mono text-xs text-[oklch(55%_0.010_28)] uppercase">
                                            [ CART IS EMPTY // ตะกร้าสินค้าว่างเปล่า ]
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            {cart.map((item) => (
                                                <div
                                                    key={item.cartKey}
                                                    className="p-3 border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] flex items-center justify-between gap-3"
                                                >
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-[13px] text-[oklch(18%_0.012_28)]">
                                                                {item.name}
                                                            </span>
                                                            {item.isPreOrder && (
                                                                <span className="px-1.5 py-0.2 bg-[oklch(45%_0.08_140)] text-white font-mono text-[9px] font-bold uppercase rounded-2xs">
                                                                    ⏳ PRE-ORDER
                                                                </span>
                                                            )}
                                                        </div>
                                                        {item.optionsText && (
                                                            <span className="font-mono text-[10px] text-[oklch(55%_0.010_28)] mt-0.5">
                                                                {item.optionsText}
                                                            </span>
                                                        )}
                                                        {item.preOrderEta && (
                                                            <span className="font-mono text-[10px] text-[oklch(45%_0.08_140)] font-bold mt-0.5">
                                                                รอบส่ง: {item.preOrderEta}
                                                            </span>
                                                        )}
                                                        <span className="font-mono text-[11px] font-bold text-[oklch(18%_0.012_28)] mt-1">
                                                            ฿{(item.price + (item.optionsPrice || 0)).toLocaleString()}.-
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)]">
                                                            <button
                                                                type="button"
                                                                onClick={() => updateQuantity(item.cartKey, -1)}
                                                                className="w-7 h-7 font-mono text-xs font-bold text-[oklch(18%_0.012_28)]"
                                                            >
                                                                -
                                                            </button>
                                                            <span className="w-8 text-center font-mono text-xs font-bold">
                                                                {item.quantity}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateQuantity(item.cartKey, 1)}
                                                                className="w-7 h-7 font-mono text-xs font-bold text-[oklch(18%_0.012_28)]"
                                                            >
                                                                +
                                                            </button>
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() => removeFromCart(item.cartKey)}
                                                            className="font-mono text-[10px] text-[oklch(52%_0.16_28)] hover:underline uppercase"
                                                        >
                                                            [ REMOVE ]
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Promo Code Section */}
                                <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] p-3 flex flex-col gap-2">
                                    <span className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase tracking-wider">
                                        [ PROMO CODE // โค้ดส่วนลด ]
                                    </span>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="กรอกรหัสส่วนลด"
                                            value={promoCode}
                                            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                                            disabled={!!appliedPromo}
                                            className="flex-1 px-3 py-1.5 bg-white border border-[oklch(85%_0.012_28)] font-mono text-xs uppercase focus:outline-none focus:border-[oklch(52%_0.16_28)] disabled:bg-[oklch(94%_0.010_28)]"
                                        />
                                        {appliedPromo ? (
                                            <button
                                                type="button"
                                                onClick={removePromo}
                                                className="px-3 py-1.5 border border-[oklch(52%_0.16_28)] bg-[oklch(52%_0.16_28)] text-white font-mono text-xs font-bold uppercase"
                                            >
                                                [ ลบโค้ด ]
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={handleApplyPromoCode}
                                                disabled={!promoCode.trim() || isPromoValidating}
                                                className="px-4 py-1.5 bg-[oklch(18%_0.012_28)] text-white font-mono text-xs font-bold uppercase hover:bg-[oklch(52%_0.16_28)] transition-colors disabled:opacity-50"
                                            >
                                                {isPromoValidating ? '...' : '[ APPLY ]'}
                                            </button>
                                        )}
                                    </div>
                                    {promoError && (
                                        <span className="font-mono text-[10px] text-[oklch(52%_0.16_28)] font-bold">
                                            [ ! ]: {promoError}
                                        </span>
                                    )}
                                    {appliedPromo && (
                                        <span className="font-mono text-[10px] text-[oklch(45%_0.08_140)] font-bold">
                                            ✓ ใช้โค้ด {appliedPromo.code} สำเร็จ (-฿{appliedPromo.discountAmount}.-)
                                        </span>
                                    )}
                                </div>

                                {/* CRM xhaus Loyalty & Rewards Card */}
                                <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] p-3.5 flex flex-col gap-3 font-mono">
                                    <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)] pb-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-bold text-[oklch(52%_0.16_28)] uppercase tracking-wider">
                                                // XHAUS LOYALTY & REWARDS
                                            </span>
                                            {memberTierInfo && (
                                                <span
                                                    className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-2xs"
                                                    style={{ backgroundColor: memberTierInfo.color_accent || '#C84B31', color: '#FFF' }}
                                                >
                                                    {memberTierInfo.name}
                                                </span>
                                            )}
                                        </div>
                                        {memberProfile ? (
                                            <span className="text-xs font-bold text-[oklch(18%_0.012_28)]">
                                                {availableXhausBalance.toLocaleString()} xhaus
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-[oklch(55%_0.010_28)]">
                                                [ GUEST ]
                                            </span>
                                        )}
                                    </div>

                                    {/* Projected Earn */}
                                    <div className="flex items-center justify-between text-xs bg-[oklch(97%_0.008_28)] p-2 border border-[oklch(85%_0.012_28)]">
                                        <span className="text-[oklch(42%_0.010_28)]">
                                            ✨ ช้อปครั้งนี้รับแต้ม ({memberTierInfo?.multiplier || 1.0}x):
                                        </span>
                                        <span className="font-bold text-[oklch(52%_0.16_28)]">
                                            +{projectedCoinsEarned} xhaus
                                        </span>
                                    </div>

                                    {/* Coin Redemption Controls (If member logged in & has coins) */}
                                    {memberProfile && availableXhausBalance > 0 && (
                                        <div className="flex flex-col gap-2 pt-1">
                                            <div className="flex items-center justify-between text-[11px]">
                                                <span className="text-[oklch(55%_0.010_28)]">
                                                    ใช้แต้ม xhaus แลกส่วนลด (1 xhaus = ฿1.-):
                                                </span>
                                                {xhausDiscountAmount > 0 && (
                                                    <span className="text-[oklch(45%_0.08_140)] font-bold">
                                                        -฿{xhausDiscountAmount}.-
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex gap-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={availableXhausBalance}
                                                    step="1"
                                                    value={redeemedCoinsInput || ''}
                                                    onChange={(e) => setRedeemedCoinsInput(Math.max(0, parseInt(e.target.value) || 0))}
                                                    placeholder="จำนวนแต้มที่จะแลก"
                                                    className="flex-1 px-3 py-1.5 bg-white border border-[oklch(85%_0.012_28)] text-xs font-mono focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                                                />
                                                {redeemedCoinsInput > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setRedeemedCoinsInput(0)}
                                                        className="px-2.5 py-1.5 border border-[oklch(85%_0.012_28)] bg-white text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] text-[10px] font-bold uppercase"
                                                    >
                                                        [ ล้าง ]
                                                    </button>
                                                )}
                                            </div>

                                            {/* Quick Pick Buttons */}
                                            <div className="flex gap-1.5 flex-wrap">
                                                {availableXhausBalance >= 50 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setRedeemedCoinsInput(50)}
                                                        className="px-2 py-1 bg-white border border-[oklch(85%_0.012_28)] hover:bg-[oklch(18%_0.012_28)] hover:text-white text-[9px] font-bold uppercase transition-colors"
                                                    >
                                                        [ 50 xhaus ]
                                                    </button>
                                                )}
                                                {availableXhausBalance >= 100 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setRedeemedCoinsInput(100)}
                                                        className="px-2 py-1 bg-white border border-[oklch(85%_0.012_28)] hover:bg-[oklch(18%_0.012_28)] hover:text-white text-[9px] font-bold uppercase transition-colors"
                                                    >
                                                        [ 100 xhaus ]
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setRedeemedCoinsInput(Math.min(availableXhausBalance, cartSubtotal))}
                                                    className="px-2 py-1 bg-white border border-[oklch(85%_0.012_28)] hover:bg-[oklch(52%_0.16_28)] hover:text-white text-[9px] font-bold uppercase transition-colors"
                                                >
                                                    [ แลกสูงสุด ]
                                                </button>
                                            </div>

                                            {xhausDiscountCalculation?.error && (
                                                <span className="text-[10px] text-[oklch(52%_0.16_28)] font-bold">
                                                    [ ! ]: {xhausDiscountCalculation.error}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Form Inputs Section */}
                                <form onSubmit={handleSubmitOrder} className="flex flex-col gap-4 border-t border-[oklch(85%_0.012_28)] pt-5">
                                    <span className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase tracking-wider">
                                        [ RECIPIENT DETAILS // ข้อมูลผู้รับ ]
                                    </span>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="font-mono text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                                ชื่อผู้รับ *
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={contactName}
                                                onChange={(e) => setContactName(e.target.value)}
                                                placeholder="ชื่อ-นามสกุล"
                                                className="w-full px-3 py-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] font-mono text-xs text-[oklch(18%_0.012_28)] focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                                            />
                                        </div>
                                        <div>
                                            <label className="font-mono text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                                เบอร์โทรศัพท์ *
                                            </label>
                                            <input
                                                type="tel"
                                                required
                                                value={contactPhone}
                                                onChange={(e) => setContactPhone(e.target.value)}
                                                placeholder="08X-XXX-XXXX"
                                                className="w-full px-3 py-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] font-mono text-xs text-[oklch(18%_0.012_28)] focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                                            />
                                        </div>
                                    </div>

                                    {/* Shipping Address Inputs */}
                                    {fulfilmentMode === 'shipping' ? (
                                        <div className="flex flex-col gap-3">
                                            <div>
                                                <label className="font-mono text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                                    ที่อยู่จัดส่ง (บ้านเลขที่ / ถนน / ซอย / หมู่บ้าน) *
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={addressLine}
                                                    onChange={(e) => setAddressLine(e.target.value)}
                                                    placeholder="123/45 ถ.สุนทรวิจิตร..."
                                                    className="w-full px-3 py-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] font-mono text-xs text-[oklch(18%_0.012_28)] focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="font-mono text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                                        ตำบล / แขวง
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={subDistrict}
                                                        onChange={(e) => setSubDistrict(e.target.value)}
                                                        placeholder="ในเมือง"
                                                        className="w-full px-3 py-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] font-mono text-xs text-[oklch(18%_0.012_28)] focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="font-mono text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                                        อำเภอ / เขต
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={district}
                                                        onChange={(e) => setDistrict(e.target.value)}
                                                        placeholder="เมืองนครพนม"
                                                        className="w-full px-3 py-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] font-mono text-xs text-[oklch(18%_0.012_28)] focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="font-mono text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                                        จังหวัด *
                                                    </label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={province}
                                                        onChange={(e) => setProvince(e.target.value)}
                                                        placeholder="นครพนม"
                                                        className="w-full px-3 py-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] font-mono text-xs text-[oklch(18%_0.012_28)] focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="font-mono text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                                        รหัสไปรษณีย์ *
                                                    </label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={postalCode}
                                                        onChange={(e) => setPostalCode(e.target.value)}
                                                        placeholder="48000"
                                                        className="w-full px-3 py-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] font-mono text-xs text-[oklch(18%_0.012_28)] focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="font-mono text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                                    วันที่รับ *
                                                </label>
                                                <select
                                                    value={pickupDate}
                                                    onChange={(e) => setPickupDate(e.target.value)}
                                                    className="w-full px-3 py-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] font-mono text-xs text-[oklch(18%_0.012_28)] focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                                                >
                                                    <option value="today">วันนี้ (Today)</option>
                                                    <option value="tomorrow">พรุ่งนี้ (Tomorrow)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="font-mono text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                                    เวลานัดรับ *
                                                </label>
                                                <input
                                                    type="time"
                                                    value={pickupTime}
                                                    onChange={(e) => setPickupTime(e.target.value)}
                                                    className="w-full px-3 py-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] font-mono text-xs text-[oklch(18%_0.012_28)] focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="font-mono text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                            หมายเหตุเพิ่มเติม (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={specialRequest}
                                            onChange={(e) => setSpecialRequest(e.target.value)}
                                            placeholder="เช่น ฝากไว้หน้าบ้าน / บดละเอียดสำหรับ Moka pot"
                                            className="w-full px-3 py-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] font-mono text-xs text-[oklch(18%_0.012_28)] focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                                        />
                                    </div>

                                    {/* Payment Section */}
                                    <div className="border-t border-[oklch(85%_0.012_28)] pt-5 flex flex-col gap-3">
                                        <span className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase tracking-wider">
                                            [ PAYMENT // สแกนชำระเงิน ]
                                        </span>

                                        <div className="p-4 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex flex-col items-center gap-3">
                                            {settings.paymentQrUrl ? (
                                                <img
                                                    src={settings.paymentQrUrl}
                                                    alt="PromptPay QR Code"
                                                    className="w-44 h-44 object-contain border border-[oklch(85%_0.012_28)] bg-white p-2"
                                                />
                                            ) : (
                                                <div className="w-44 h-44 border border-dashed border-[oklch(85%_0.012_28)] bg-white flex items-center justify-center font-mono text-[10px] text-[oklch(55%_0.010_28)] text-center p-4">
                                                    [ PROMPTPAY QR CODE ]
                                                </div>
                                            )}

                                            <div className="text-center font-mono text-xs flex flex-col items-center gap-1">
                                                <div className="font-bold text-[oklch(18%_0.012_28)]">{settings.bankAccountName}</div>
                                                <div className="text-[oklch(52%_0.16_28)] font-bold">{settings.bankAccountNo}</div>
                                                <div className="text-[oklch(55%_0.010_28)] text-[10px]">{settings.bankName}</div>
                                            </div>

                                            {/* 1-Click Copy Buttons */}
                                            <div className="flex gap-2 w-full mt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(settings.bankAccountNo.replace(/-/g, ''), 'คัดลอกเลขบัญชีแล้ว!')}
                                                    className="flex-1 py-1.5 px-2 bg-white border border-[oklch(85%_0.012_28)] hover:bg-[oklch(18%_0.012_28)] hover:text-white transition-colors font-mono text-[10px] font-bold uppercase"
                                                >
                                                    [ COPY ACCT NO. ]
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(finalTotalAmount.toFixed(2), 'คัดลอกยอดเงินแล้ว!')}
                                                    className="flex-1 py-1.5 px-2 bg-white border border-[oklch(85%_0.012_28)] hover:bg-[oklch(18%_0.012_28)] hover:text-white transition-colors font-mono text-[10px] font-bold uppercase"
                                                >
                                                    [ COPY ฿{finalTotalAmount.toLocaleString()} ]
                                                </button>
                                            </div>

                                            {copyFeedback && (
                                                <span className="font-mono text-[10px] text-[oklch(45%_0.08_140)] font-bold">
                                                    ✓ {copyFeedback}
                                                </span>
                                            )}
                                        </div>

                                        {/* Slip Uploader with Preview */}
                                        <div className="flex flex-col gap-2">
                                            <label className="font-mono text-[10px] text-[oklch(42%_0.010_28)] uppercase block">
                                                แนบสลิปการชำระเงิน *
                                            </label>

                                            {slipPreviewUrl ? (
                                                <div className="relative border border-[oklch(85%_0.012_28)] bg-white p-2 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <img src={slipPreviewUrl} alt="Slip Preview" className="w-12 h-12 object-cover border" />
                                                        <span className="font-mono text-xs font-bold text-[oklch(18%_0.012_28)] truncate max-w-[180px]">
                                                            {slipFile?.name || 'slip.jpg'}
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={handleRemoveSlip}
                                                        className="px-2.5 py-1 border border-[oklch(52%_0.16_28)] text-[oklch(52%_0.16_28)] font-mono text-[10px] font-bold uppercase hover:bg-[oklch(52%_0.16_28)] hover:text-white transition-colors"
                                                    >
                                                        [ เปลี่ยนรูป ]
                                                    </button>
                                                </div>
                                            ) : (
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleFileChange}
                                                    className="w-full px-3 py-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] font-mono text-xs text-[oklch(18%_0.012_28)] focus:outline-none focus:border-[oklch(52%_0.16_28)] cursor-pointer"
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {/* Cost Breakdown */}
                                    <div className="p-4 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex flex-col gap-2 font-mono text-xs">
                                        <div className="flex justify-between text-[oklch(42%_0.010_28)]">
                                            <span>ยอดรวมสินค้า ({cartItemCount} ชิ้น):</span>
                                            <span>฿{cartSubtotal.toLocaleString()}.-</span>
                                        </div>
                                        {promoDiscount > 0 && (
                                            <div className="flex justify-between text-[oklch(45%_0.08_140)] font-bold">
                                                <span>ส่วนลดโค้ดโปรโมชั่น ({appliedPromo?.code}):</span>
                                                <span>-฿{promoDiscount.toLocaleString()}.-</span>
                                            </div>
                                        )}
                                        {xhausDiscountAmount > 0 && (
                                            <div className="flex justify-between text-[oklch(52%_0.16_28)] font-bold">
                                                <span>ส่วนลดแต้ม xhaus ({effectiveXhausRedeemed} xhaus):</span>
                                                <span>-฿{xhausDiscountAmount.toLocaleString()}.-</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-[oklch(42%_0.010_28)]">
                                            <span>ค่าจัดส่งพัสดุ:</span>
                                            {fulfilmentMode === 'pickup' ? (
                                                <span>฿0 (รับหน้าร้าน)</span>
                                            ) : isFreeShipping ? (
                                                <span className="text-[oklch(52%_0.16_28)] font-bold">฿0 (ส่งฟรี)</span>
                                            ) : (
                                                <span>฿{calculatedShippingFee.toLocaleString()}.-</span>
                                            )}
                                        </div>
                                        <div className="flex justify-between text-sm font-bold text-[oklch(18%_0.012_28)] border-t border-[oklch(85%_0.012_28)] pt-2 mt-1">
                                            <span>ยอดชำระสุทธิ:</span>
                                            <span className="text-[oklch(52%_0.16_28)]">฿{finalTotalAmount.toLocaleString()}.-</span>
                                        </div>
                                    </div>

                                    {/* Error Messages */}
                                    {(validationError || submitError) && (
                                        <div className="p-3 border border-[oklch(52%_0.16_28)] bg-[oklch(52%_0.16_28)]/10 text-[oklch(52%_0.16_28)] font-mono text-xs font-bold">
                                            [ ERROR ]: {validationError || submitError}
                                        </div>
                                    )}

                                    {/* Submit Action Button */}
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || cart.length === 0}
                                        className="w-full py-4 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-mono text-[12px] font-bold uppercase tracking-wider hover:bg-[oklch(52%_0.16_28)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between px-6"
                                    >
                                        <span>{isSubmitting ? 'TRANSMITTING ORDER...' : 'TRANSMIT ORDER // ชำระเงิน'}</span>
                                        <span>฿{finalTotalAmount.toLocaleString()}.-</span>
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}

