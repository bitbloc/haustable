import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useOrderSubmission } from '../../hooks/useOrderSubmission'
import { getThaiDate, toThaiISO } from '../../utils/timeUtils'

export default function HausmadeCartDrawer({
    isOpen,
    onClose,
    shopState
}) {
    const {
        cart,
        cartItemCount,
        cartSubtotal,
        calculatedShippingFee,
        isFreeShipping,
        itemsNeededForFreeShipping,
        totalAmount,
        updateQuantity,
        removeFromCart,
        clearCart,
        settings
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
    const [submittedOrder, setSubmittedOrder] = useState(null)
    const [validationError, setValidationError] = useState('')

    if (!isOpen) return null

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setSlipFile(e.target.files[0])
        }
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
            deposit_amount: totalAmount,
            total_amount: totalAmount,
            customer_note: specialRequest ? `[HAUSMADE ${fulfilmentMode.toUpperCase()}] ${specialRequest}` : `[HAUSMADE ${fulfilmentMode.toUpperCase()}]`,
            order_type: fulfilmentMode === 'shipping' ? 'hausmade_shipping' : 'hausmade_pickup',
            booking_type: 'hausmade',
            tracking_token: trackingToken,
            shipping_address: fullShippingAddress,
            shipping_fee: calculatedShippingFee
        }

        const orderItemsPayload = cart.map(item => ({
            menu_item_id: item.id,
            quantity: item.quantity,
            price_at_time: item.price + (item.optionsPrice || 0),
            selected_options: item.optionsText || null
        }))

        await submitOrder({
            bookingPayload,
            orderItemsPayload,
            slipFile,
            onSuccess: (result) => {
                setSubmittedOrder({
                    trackingToken,
                    totalAmount,
                    fulfilmentMode,
                    shippingAddress: fullShippingAddress
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
                                        [ ORDER CONFIRMED // สั่งซื้อสำเร็จ ]
                                    </span>
                                    <h3 className="text-lg font-bold text-[oklch(18%_0.012_28)]">
                                        ขอบคุณสำหรับคำสั่งซื้อ HAUSMADE
                                    </h3>
                                    <p className="text-xs text-[oklch(42%_0.010_28)] mt-1">
                                        ระบบได้รับสลิปการชำระเงินเรียบร้อยแล้ว ทีมงานจะดำเนินการแพ็คสินค้าและจัดส่งให้โดยเร็วที่สุด
                                    </p>
                                </div>

                                <div className="p-4 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex flex-col gap-2 font-mono text-[12px]">
                                    <div className="flex justify-between border-b border-[oklch(85%_0.012_28)] pb-1.5">
                                        <span className="text-[oklch(55%_0.010_28)]">TRACKING TOKEN:</span>
                                        <span className="font-bold text-[oklch(52%_0.16_28)]">{submittedOrder.trackingToken}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-[oklch(85%_0.012_28)] pb-1.5">
                                        <span className="text-[oklch(55%_0.010_28)]">FULFILMENT:</span>
                                        <span className="font-bold">{submittedOrder.fulfilmentMode === 'shipping' ? 'จัดส่งพัสดุเอกชน' : 'รับหน้าร้าน'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-[oklch(85%_0.012_28)] pb-1.5">
                                        <span className="text-[oklch(55%_0.010_28)]">DESTINATION:</span>
                                        <span className="font-bold text-right max-w-[200px] truncate">{submittedOrder.shippingAddress}</span>
                                    </div>
                                    <div className="flex justify-between pt-1">
                                        <span className="text-[oklch(55%_0.010_28)]">TOTAL PAID:</span>
                                        <span className="font-bold">฿{submittedOrder.totalAmount.toLocaleString()}.-</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        setSubmittedOrder(null)
                                        onClose()
                                    }}
                                    className="w-full py-3.5 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-mono text-[12px] font-bold uppercase tracking-wider hover:bg-[oklch(52%_0.16_28)] transition-colors text-center"
                                >
                                    [ RETURN TO SHOP // กลับสู่หน้าร้าน ]
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Fulfilment Switcher (Braun Dial Tabs) */}
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
                                {fulfilmentMode === 'shipping' && settings.freeShippingMinItems > 0 && (
                                    <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] p-3.5 flex flex-col gap-2">
                                        <div className="flex justify-between font-mono text-[10px] font-bold">
                                            <span className="text-[oklch(18%_0.012_28)]">
                                                {isFreeShipping ? '[ FREE SHIPPING UNLOCKED // ได้รับสิทธิ์จัดส่งฟรี ]' : `[ FREE SHIPPING PROMO // ซื้อครบ ${settings.freeShippingMinItems} ชิ้นส่งฟรี ]`}
                                            </span>
                                            <span className="text-[oklch(52%_0.16_28)] font-bold">
                                                {cartItemCount}/{settings.freeShippingMinItems} ITEMS
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-[oklch(85%_0.012_28)] overflow-hidden">
                                            <motion.div
                                                className="h-full bg-[oklch(52%_0.16_28)]"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.min(100, (cartItemCount / settings.freeShippingMinItems) * 100)}%` }}
                                                transition={{ duration: 0.4 }}
                                            />
                                        </div>
                                        {itemsNeededForFreeShipping > 0 && (
                                            <span className="font-mono text-[10px] text-[oklch(55%_0.010_28)]">
                                                * ซื้อเพิ่มอีก {itemsNeededForFreeShipping} ชิ้น เพื่อรับสิทธิ์จัดส่งฟรีทั่วประเทศ
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Cart Items List */}
                                <div className="flex flex-col gap-3">
                                    <span className="font-mono text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase tracking-wider">
                                        [ ITEMS SUMMARY // รายการสินค้า ]
                                    </span>

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
                                                        <span className="font-bold text-[13px] text-[oklch(18%_0.012_28)]">
                                                            {item.name}
                                                        </span>
                                                        {item.optionsText && (
                                                            <span className="font-mono text-[10px] text-[oklch(55%_0.010_28)] mt-0.5">
                                                                {item.optionsText}
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

                                    {fulfilmentMode === 'shipping' ? (
                                        <div className="flex flex-col gap-3">
                                            <div>
                                                <label className="font-mono text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                                    ที่อยู่จัดส่ง (บ้านเลขที่ / ถนน / ซอย) *
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={addressLine}
                                                    onChange={(e) => setAddressLine(e.target.value)}
                                                    placeholder="เช่น 123/45 ถนนสุนทรวิจิตร"
                                                    className="w-full px-3 py-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] font-mono text-xs text-[oklch(18%_0.012_28)] focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="font-mono text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                                        แขวง / ตำบล
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={subDistrict}
                                                        onChange={(e) => setSubDistrict(e.target.value)}
                                                        placeholder="ตำบล ในเมือง"
                                                        className="w-full px-3 py-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] font-mono text-xs text-[oklch(18%_0.012_28)] focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="font-mono text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                                        เขต / อำเภอ
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={district}
                                                        onChange={(e) => setDistrict(e.target.value)}
                                                        placeholder="อำเภอ เมือง"
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

                                            <div className="text-center font-mono text-xs">
                                                <div className="font-bold text-[oklch(18%_0.012_28)]">{settings.bankAccountName}</div>
                                                <div className="text-[oklch(52%_0.16_28)] font-bold mt-0.5">{settings.bankAccountNo}</div>
                                                <div className="text-[oklch(55%_0.010_28)] text-[10px]">{settings.bankName}</div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="font-mono text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                                แนบสลิปการชำระเงิน *
                                            </label>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleFileChange}
                                                className="w-full px-3 py-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] font-mono text-xs text-[oklch(18%_0.012_28)] focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                                            />
                                        </div>
                                    </div>

                                    {/* Cost Breakdown */}
                                    <div className="p-4 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex flex-col gap-2 font-mono text-xs">
                                        <div className="flex justify-between text-[oklch(42%_0.010_28)]">
                                            <span>ยอดรวมสินค้า ({cartItemCount} ชิ้น):</span>
                                            <span>฿{cartSubtotal.toLocaleString()}.-</span>
                                        </div>
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
                                            <span className="text-[oklch(52%_0.16_28)]">฿{totalAmount.toLocaleString()}.-</span>
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
                                        <span>฿{totalAmount.toLocaleString()}.-</span>
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
