import React, { useState } from 'react'
import { Upload, X } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import { useBooking } from '../../hooks/useBooking'
import SlipModal from '../shared/SlipModal'

export default function BookingCheckout() {
    const { t } = useLanguage()
    const {
        submitBooking, updateForm,
        contactName, contactPhone, specialRequest, isAgreed, slipFile,
        cart, settings, pax
    } = useBooking()

    const [submitting, setSubmitting] = useState(false)
    const [isSlipModalOpen, setIsSlipModalOpen] = useState(false)

    const cartTotal = cart.reduce((sum, item) => sum + ((item.totalPricePerUnit || item.price) * item.qty), 0)

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            updateForm('slipFile', e.target.files[0])
        }
    }

    const handleSubmit = async () => {
        setSubmitting(true)
        const result = await submitBooking()
        setSubmitting(false)

        if (result.success) {
            alert(t('confirmBooking') + ' Success!')
            window.location.href = '/' // Simple redirect or use router
        } else {
            alert('Error: ' + result.error)
        }
    }

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-4 mb-4">
                <h3 className="font-bold text-sm uppercase">1. {t('contactInfo')}</h3>
                <div className="grid gap-3">
                    <input
                        type="text"
                        placeholder="ชื่อผู้จอง (Name)"
                        value={contactName}
                        onChange={e => updateForm('contactName', e.target.value)}
                        className="w-full bg-gray-50 p-3 rounded-lg text-sm outline-none border border-transparent focus:bg-white focus:border-black transition-colors"
                    />
                    <input
                        type="tel"
                        placeholder="เบอร์โทรศัพท์ (Phone)"
                        value={contactPhone}
                        onChange={e => updateForm('contactPhone', e.target.value)}
                        className="w-full bg-gray-50 p-3 rounded-lg text-sm outline-none border border-transparent focus:bg-white focus:border-black transition-colors"
                    />
                    <textarea
                        placeholder="คำขอพิเศษ (แพ้อาหาร, วันเกิด, etc.)"
                        value={specialRequest}
                        onChange={e => updateForm('specialRequest', e.target.value)}
                        className="w-full bg-gray-50 p-3 rounded-lg text-sm outline-none border border-transparent focus:bg-white focus:border-black transition-colors resize-none h-20"
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-4 mb-4">
                <h3 className="font-bold text-sm uppercase">2. {t('payment')}</h3>
                <div className="bg-gray-50 p-4 rounded-xl text-center space-y-2">
                    <p className="text-gray-500 text-xs">ยอดรวมที่ต้องชำระ (Total)</p>
                    <p className="text-3xl font-bold font-mono tracking-tight">{cartTotal}.-</p>
                    {settings.minSpend > 0 && (
                        <p className="text-[10px] text-gray-400">Min Spend: {settings.minSpend * pax}.-</p>
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
                        <p className="text-[10px] text-gray-400">Click QR to Enlarge</p>
                    </div>
                ) : (
                    <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-gray-400 rounded-lg">No QR Code</div>
                )}

                {/* Note: In StepFood view toggle logic, we handle "Skip Food" which might mean 0 cart but still pay? 
                    Actually minSpend logic might require pay. 
                */}

                <div className="border-t border-gray-100 pt-4">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Upload Slip</label>
                    <div className="relative">
                        <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="slip-upload" />
                        <label htmlFor="slip-upload" className={`w-full py-3 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors ${slipFile ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:border-black text-gray-500 hover:text-black'}`}>
                            {slipFile ? (
                                <>
                                    <span className="font-bold text-sm truncate max-w-[200px]">{slipFile.name}</span>
                                    <span className="bg-green-200 px-2 py-0.5 rounded text-[10px]">Change</span>
                                </>
                            ) : (
                                <>
                                    <Upload size={18} />
                                    <span className="font-bold text-sm">Tap to Upload</span>
                                </>
                            )}
                        </label>
                    </div>
                </div>
            </div>

            {/* Policy */}
            {settings.policyNote && (
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 mb-4">
                    <h4 className="text-orange-800 font-bold text-xs uppercase mb-1">Condition / เงื่อนไข</h4>
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
            <SlipModal
                isOpen={isSlipModalOpen}
                onClose={() => setIsSlipModalOpen(false)}
                imageUrl={settings.qrCodeUrl}
                title="Payment QR Code"
            />
        </div>
    )
}
