import React, { useState } from 'react'
import { Upload, X, Tag, AlertCircle } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import { useBooking } from '../../hooks/useBooking'
import { usePromotion } from '../../hooks/usePromotion' // NEW
import ImageModal from '../shared/ImageModal'

export default function BookingCheckout() {
    const { t } = useLanguage()
    const {
        submitBooking, updateForm,
        contactName, contactPhone, specialRequest, isAgreed, slipFile,
        cart, settings, pax
    } = useBooking()

    const [submitting, setSubmitting] = useState(false)
    const [isSlipModalOpen, setIsSlipModalOpen] = useState(false)

    // Promotion Hook
    const { 
        promoCode, setPromoCode, 
        appliedPromo, promoError, isValidating, 
        applyCode, removePromo, revalidatePromo 
    } = usePromotion()

    const cartTotal = cart.reduce((sum, item) => sum + ((item.totalPricePerUnit || item.price) * item.qty), 0)
    
    // Calculate Final Total
    const discountAmount = appliedPromo?.discountAmount || 0
    const finalTotal = Math.max(0, cartTotal - discountAmount)

    // Revalidate when cartTotal changes
    React.useEffect(() => {
        if (appliedPromo) {
            revalidatePromo(cartTotal, 'booking')
        }
    }, [cartTotal, revalidatePromo])

    const handleApplyCode = async () => {
        if (!promoCode) return
        await applyCode(promoCode, cartTotal, 'booking')
    }

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            updateForm('slipFile', e.target.files[0])
        }
    }

    const handleSubmit = async () => {
        setSubmitting(true)
        // Pass promotion data to submitBooking
        const result = await submitBooking(appliedPromo) 
        setSubmitting(false)

        if (result.success) {
            // Check if we have tracking token in the response
            // result.data should be the array or object returned from Supabase
            // Depending on useBooking implementation, it might be result.data[0]
            const bookingData = Array.isArray(result.data) ? result.data[0] : result.data
            const token = bookingData?.tracking_token

            alert(t('confirmBooking') + ' Success!')
            
            if (token) {
                window.location.href = `/tracking/${token}`
            } else {
                window.location.href = '/'
            }
        } else {
            alert('Error: ' + result.error)
        }
    }

    return (
        <div className="flex-1 overflow-y-auto">
            {/* Order Summary */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-4 mb-4">
                <h3 className="font-bold text-sm uppercase border-b border-gray-100 pb-2">{t('bookingSummary')}</h3>

                {/* Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-gray-400 text-xs block uppercase">{t('dateDate')}</span>
                        <span className="font-bold">{useBooking().date}</span>
                    </div>
                    <div>
                        <span className="text-gray-400 text-xs block uppercase">{t('dateTime')}</span>
                        <span className="font-bold">{useBooking().time}</span>
                    </div>
                    <div>
                        <span className="text-gray-400 text-xs block uppercase">{t('tableNumber')}</span>
                        <span className="font-bold">{useBooking().selectedTable?.table_name}</span>
                    </div>
                    <div>
                        <span className="text-gray-400 text-xs block uppercase">{t('guests')}</span>
                        <span className="font-bold">{pax} {t('guests')}</span>
                    </div>
                </div>

                {/* Items */}
                {cart.length > 0 && (
                    <div className="pt-2">
                        <span className="text-gray-400 text-xs block uppercase mb-2">{t('orderItems')}</span>
                        <div className="space-y-2">
                            {cart.map((item, i) => (
                                <div key={i} className="flex justify-between text-sm">
                                    <div className="flex-1">
                                        <div className="font-bold text-black flex gap-2">
                                            <span className="text-gray-500 text-xs mt-0.5">x{item.qty}</span>
                                            {item.name}
                                        </div>
                                        {/* Options */}
                                        {item.optionsSummary && item.optionsSummary.length > 0 && (
                                            <div className="text-xs text-gray-400 pl-6">
                                                {item.optionsSummary.map(o => o.name).join(', ')}
                                            </div>
                                        )}
                                    </div>
                                    <div className="font-mono text-gray-600">
                                        {((item.totalPricePerUnit || item.price) * item.qty)}.-
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>


            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-4 mb-4">
                <h3 className="font-bold text-sm uppercase">1. {t('yourName')}</h3>
                <div className="grid gap-3">
                    <input
                        type="text"
                        placeholder={t('yourName')}
                        value={contactName}
                        onChange={e => updateForm('contactName', e.target.value)}
                        className="w-full bg-gray-50 p-3 rounded-lg text-sm outline-none border border-transparent focus:bg-white focus:border-black transition-colors"
                    />
                    <input
                        type="tel"
                        placeholder={t('phoneNumber')}
                        value={contactPhone}
                        onChange={e => updateForm('contactPhone', e.target.value)}
                        className="w-full bg-gray-50 p-3 rounded-lg text-sm outline-none border border-transparent focus:bg-white focus:border-black transition-colors"
                    />
                    <textarea
                        placeholder="Special Requests (Allergy, Birthday, etc.)"
                        value={specialRequest}
                        onChange={e => updateForm('specialRequest', e.target.value)}
                        className="w-full bg-gray-50 p-3 rounded-lg text-sm outline-none border border-transparent focus:bg-white focus:border-black transition-colors resize-none h-20"
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-4 mb-4">
                <h3 className="font-bold text-sm uppercase">2. {t('paymentTitle')}</h3>
                
                {/* PROMOTION SECTION */}
                <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            placeholder="Promo Code" 
                            value={promoCode}
                            onChange={e => setPromoCode(e.target.value.toUpperCase())}
                            disabled={!!appliedPromo}
                            className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold uppercase placeholder:normal-case outline-none focus:border-black disabled:bg-gray-100 disabled:text-gray-400"
                        />
                        {appliedPromo ? (
                            <button onClick={removePromo} className="bg-red-50 text-red-600 px-3 py-2 rounded-lg font-bold text-xs border border-red-100 hover:bg-red-100">
                                Remove
                            </button>
                        ) : (
                            <button 
                                onClick={handleApplyCode} 
                                disabled={!promoCode || isValidating}
                                className="bg-black text-white px-4 py-2 rounded-lg font-bold text-xs disabled:opacity-50"
                            >
                                {isValidating ? '...' : 'Apply'}
                            </button>
                        )}
                    </div>
                    
                    {/* Error Message */}
                    {promoError && (
                        <p className="text-red-500 text-xs font-bold flex items-center gap-1">
                            <AlertCircle size={12} /> {promoError}
                        </p>
                    )}

                    {/* Valid Message */}
                    {appliedPromo && (
                        <div className="flex items-center gap-2 text-green-600 text-xs font-bold bg-green-50 p-2 rounded border border-green-100">
                            <Tag size={12} /> Code {appliedPromo.code} applied!
                        </div>
                    )}
                </div>

                <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                    <div className="flex justify-between text-xs text-gray-400 uppercase font-bold">
                        <span>Subtotal</span>
                        <span>{cartTotal}.-</span>
                    </div>
                    
                    {appliedPromo && (
                        <div className="flex justify-between text-xs text-green-600 uppercase font-bold">
                            <span>
                                Discount 
                                {appliedPromo.discountType === 'percent' && <span className="ml-1 text-[10px] bg-green-100 px-1 rounded">{appliedPromo.discountValue}%</span>}
                            </span>
                            <span>- {discountAmount}.-</span>
                        </div>
                    )}

                    <div className="flex justify-between items-end border-t border-gray-200 pt-2 mt-2">
                         <span className="text-gray-500 text-xs">{t('totalPrice')}</span>
                         <span className="text-3xl font-bold font-mono tracking-tight">{finalTotal}.-</span>
                    </div>

                    {settings.minSpend > 0 && (
                        <p className="text-[10px] text-gray-400 text-right">Min Spend: {settings.minSpend * pax}.-</p>
                    )}
                </div>

                {settings.qrCodeUrl ? (
                    <div className="flex flex-col items-center gap-2">
                        <img
                            src={settings.qrCodeUrl}
                            className="w-48 h-48 object-contain rounded-lg border shadow-sm cursor-zoom-in"
                            alt="QR Code"
                            onClick={() => setIsSlipModalOpen(true)}
                        />
                        <p className="text-[10px] text-gray-400">{t('clickToEnlarge')}</p>
                    </div>
                ) : (
                    <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-gray-400 rounded-lg">{t('noQrCode')}</div>
                )}

                {/* Note: In StepFood view toggle logic, we handle "Skip Food" which might mean 0 cart but still pay? 
                    Actually minSpend logic might require pay. 
                */}

                <div className="border-t border-gray-100 pt-4">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{t('uploadSlip')}</label>
                    <div className="relative">
                        <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="slip-upload" />
                        <label htmlFor="slip-upload" className={`w-full py-3 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors ${slipFile ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:border-black text-gray-500 hover:text-black'}`}>
                            {slipFile ? (
                                <>
                                    <span className="font-bold text-sm truncate max-w-[200px]">{slipFile.name}</span>
                                    <span className="bg-green-200 px-2 py-0.5 rounded text-[10px]">{t('changeFile')}</span>
                                </>
                            ) : (
                                <>
                                    <Upload size={18} />
                                    <span className="font-bold text-sm">{t('tapToUpload')}</span>
                                </>
                            )}
                        </label>
                    </div>
                </div>
            </div>

            {/* Policy */}
            {settings.policyNote && (
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 mb-4">
                    <h4 className="text-orange-800 font-bold text-xs uppercase mb-1">{t('condition')}</h4>
                    <p className="text-orange-700 text-xs whitespace-pre-line">{settings.policyNote}</p>
                </div>
            )}

            <label className="flex items-start gap-3 p-2 cursor-pointer">
                <input type="checkbox" checked={isAgreed} onChange={e => updateForm('isAgreed', e.target.checked)} className="mt-1 w-4 h-4 accent-black" />
                <span className="text-xs text-gray-500 leading-relaxed">
                    {t('agreeTerms')}
                </span>
            </label>

            <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-black text-white py-4 rounded-xl font-bold mt-4 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
                {submitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {t('confirmBooking')}
            </button>

            {/* QR Modal */}
            <ImageModal
                isOpen={isSlipModalOpen}
                onClose={() => setIsSlipModalOpen(false)}
                imageUrl={settings.qrCodeUrl}
                title="Payment QR Code"
            />
        </div>
    )
}
