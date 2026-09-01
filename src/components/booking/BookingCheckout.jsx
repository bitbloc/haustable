import React, { useState, useEffect } from 'react'
import { Upload, X, Tag, AlertCircle, Crown, Sparkles, Coins, Coffee, QrCode, Wallet, CheckCircle2, AlertTriangle, Copy, RefreshCw, Check as CheckIcon } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import { useBooking } from '../../hooks/useBooking'
import { usePromotion } from '../../hooks/usePromotion' // NEW
import ImageModal from '../shared/ImageModal'
import { supabase } from '../../lib/supabaseClient'
import { verifyPaymentSlip } from '../../utils/slipVerificationHelper'

export default function BookingCheckout() {
    const { t } = useLanguage()
    const {
        submitBooking, updateForm,
        contactName, contactPhone, specialRequest, isAgreed, slipFile,
        cart, settings, pax, date, time, selectedTable, table
    } = useBooking()

    // Localize form state to prevent global re-renders on keystrokes
    const [localName, setLocalName] = useState(contactName || '')
    const [localPhone, setLocalPhone] = useState(contactPhone || '')

    const [submitting, setSubmitting] = useState(false)
    const [isSlipModalOpen, setIsSlipModalOpen] = useState(false)

    // Payment & Auto-Verification State
    const [paymentMethod, setPaymentMethod] = useState('promptpay') // 'promptpay' | 'truewallet'
    const [isVerifyingSlip, setIsVerifyingSlip] = useState(false)
    const [slipVerifyResult, setSlipVerifyResult] = useState(null)
    const [slipVerifyError, setSlipVerifyError] = useState(null)
    const [allowManualFallback, setAllowManualFallback] = useState(false)
    const [copiedField, setCopiedField] = useState(null)

    // Member CRM state
    const [memberProfile, setMemberProfile] = useState(null)
    const [crmBaseSpendAmount, setCrmBaseSpendAmount] = useState(100)
    const [tierDetails, setTierDetails] = useState({
        current_tier: 'Haus Common',
        multiplier: 1.00,
        is_in_grace_period: false
    })

    useEffect(() => {
        const loadMemberProfile = async () => {
            try {
                // Fetch CRM base spend amount setting
                const { data: settingData } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'crm_base_spend_amount')
                    .maybeSingle();
                if (settingData?.value) {
                    setCrmBaseSpendAmount(parseFloat(settingData.value) || 100);
                }

                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
                    if (prof) {
                        setMemberProfile(prof)
                        if (!localName && prof.display_name) {
                            setLocalName(prof.display_name)
                            updateForm('contactName', prof.display_name)
                        }
                        if (!localPhone && prof.phone_number) {
                            setLocalPhone(prof.phone_number)
                            updateForm('contactPhone', prof.phone_number)
                        }

                        const { data: tierData } = await supabase.rpc('get_member_tier_details', { p_user_id: user.id })
                        if (tierData && tierData.length > 0) {
                            setTierDetails(tierData[0])
                        }
                    }
                }
            } catch (e) {
                console.warn('Load member CRM error in BookingCheckout:', e)
            }
        }
        loadMemberProfile()
    }, [])

    // Promotion Hook
    const { 
        promoCode, setPromoCode, 
        appliedPromo, promoError, isValidating, 
        applyCode, removePromo, revalidatePromo 
    } = usePromotion()

    const cartTotal = cart.reduce((sum, item) => sum + ((item.totalPricePerUnit || item.price) * item.qty), 0)
    
    // Calculate Final Total & Deposit
    const discountAmount = appliedPromo?.discountAmount || 0
    const finalTotal = Math.max(0, cartTotal - discountAmount)
    const depositAmount = Math.ceil(finalTotal * 0.5)

    // Estimated points earned
    const estimatedPointsEarned = Math.floor((finalTotal / (crmBaseSpendAmount || 100)) * (tierDetails.multiplier || 1.0))

    // Revalidate when cartTotal changes
    useEffect(() => {
        if (appliedPromo) {
            revalidatePromo(cartTotal, 'booking')
        }
    }, [cartTotal, revalidatePromo])

    const handleApplyCode = async () => {
        if (!promoCode) return
        await applyCode(promoCode, cartTotal, 'booking')
    }

    const copyToClipboard = (text, fieldName) => {
        if (!text) return
        navigator.clipboard.writeText(text)
        setCopiedField(fieldName)
        setTimeout(() => setCopiedField(null), 2000)
    }

    const handleFileChange = async (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0]
            updateForm('slipFile', file)
            setSlipVerifyResult(null)
            setSlipVerifyError(null)
            setAllowManualFallback(false)

            if (settings.easySlipEnabled === false) {
                return
            }

            setIsVerifyingSlip(true)
            try {
                const res = await verifyPaymentSlip({
                    file,
                    matchAmount: depositAmount,
                    provider: paymentMethod,
                    remark: `Table Booking Deposit ฿${depositAmount}`
                })

                if (res.verified) {
                    setSlipVerifyResult(res)
                    setSlipVerifyError(null)
                } else if (res.success && !res.isAmountMatched) {
                    setSlipVerifyResult(res)
                    setSlipVerifyError(`ยอดเงินในสลิป (฿${res.amountInSlip}) ไม่ตรงกับยอดมัดจำ (฿${depositAmount})`)
                } else if (res.isDuplicate) {
                    setSlipVerifyResult(res)
                    setSlipVerifyError('สลิปนี้ถูกบันทึกในระบบไปแล้ว ไม่สามารถใช้ซ้ำได้')
                } else {
                    setSlipVerifyResult(null)
                    setSlipVerifyError(res.error || 'ไม่สามารถตรวจสอบข้อมูลสลิปได้')
                }
            } catch (err) {
                setSlipVerifyError('เกิดข้อผิดพลาดในการตรวจสอบสลิป: ' + err.message)
            } finally {
                setIsVerifyingSlip(false)
            }
        }
    }

    const handleSubmit = async () => {
        if (submitting) return
        if (settings.easySlipEnabled !== false && !slipVerifyResult?.verified && !allowManualFallback) {
            return alert('กรุณารอผลตรวจสลิปให้ผ่าน หรือกดเลือก "ส่งให้เจ้าหน้าที่ตรวจสอบด้วยตนเอง"')
        }

        setSubmitting(true)
        
        try {
            // Sync final values before submit
            updateForm('contactName', localName)
            updateForm('contactPhone', localPhone)

            const result = await submitBooking(appliedPromo, depositAmount, {
                contactName: localName,
                contactPhone: localPhone,
                slipFile: slipFile,
                slipVerifyResult: slipVerifyResult,
                paymentMethod: paymentMethod
            }) 

            if (result.success) {
                const bookingData = Array.isArray(result.data) ? result.data[0] : result.data
                const token = bookingData?.tracking_token

                alert(t('confirmBooking') + ' Success!' + (slipVerifyResult?.verified ? ' (สลิปมัดจำผ่านการตรวจอัตโนมัติ ✓)' : ''))
                
                if (token) {
                    window.location.replace(`/tracking/${token}`)
                } else {
                    window.location.replace('/')
                }
            } else {
                alert('Error: ' + result.error)
            }
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="flex-1 overflow-y-auto space-y-4">
            {/* Member CRM Privileges Badge */}
            {memberProfile && (
                <div className="bg-[oklch(94%_0.010_28)] border border-[oklch(52%_0.16_28)]/30 p-4 rounded-rams space-y-3">
                    <div className="flex justify-between items-center border-b border-[oklch(85%_0.012_28)] pb-2.5">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[oklch(52%_0.16_28)] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                                <Crown size={14} />
                            </div>
                            <div>
                                <span className="font-bold text-xs text-[oklch(18%_0.012_28)] block">คุณ {memberProfile.display_name}</span>
                                <span className="text-[9px] font-mono text-[oklch(55%_0.010_28)]">สิทธิประโยชน์สมาชิก CRM</span>
                            </div>
                        </div>
                        <span className="px-2.5 py-1 bg-[oklch(52%_0.16_28)] text-white text-[9px] font-mono font-bold rounded-rams uppercase tracking-wider">
                            {tierDetails.current_tier} ({tierDetails.multiplier}x)
                        </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center font-mono">
                        <div className="bg-white/80 border border-[oklch(85%_0.012_28)] p-2 rounded-rams">
                            <span className="text-[8px] text-[oklch(55%_0.010_28)] uppercase block">xhaus Balance</span>
                            <span className="text-xs font-bold text-[oklch(52%_0.16_28)]">🪙 {parseFloat(memberProfile.xhaus_balance || 0).toFixed(0)}</span>
                        </div>
                        <div className="bg-white/80 border border-[oklch(85%_0.012_28)] p-2 rounded-rams">
                            <span className="text-[8px] text-[oklch(55%_0.010_28)] uppercase block">Drink Stamps</span>
                            <span className="text-xs font-bold text-[oklch(18%_0.012_28)]">☕ {memberProfile.drink_stamp_count || 0}/10</span>
                        </div>
                        <div className="bg-white/80 border border-[oklch(85%_0.012_28)] p-2 rounded-rams">
                            <span className="text-[8px] text-[oklch(55%_0.010_28)] uppercase block">Earn Points</span>
                            <span className="text-xs font-bold text-emerald-700">+{estimatedPointsEarned} xhaus</span>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-paper p-6 border border-[var(--color-rule)] rounded-rams">
                <h3 className="text-xs font-mono font-bold text-subInk uppercase mb-3">{t('bookingSummary')}</h3>
                <div className="space-y-2 mb-4 text-sm font-mono border-b border-[var(--color-rule)] pb-4">
                    <div className="flex justify-between">
                        <span className="text-subInk">{t('date')}</span>
                        <span className="font-bold text-ink">{date}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-subInk">{t('time')}</span>
                        <span className="font-bold text-ink">{time}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-subInk">{t('guests')}</span>
                        <span className="font-bold text-ink">{pax}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-subInk">{t('table')}</span>
                        <span className="font-bold text-ink">{(selectedTable || table)?.table_name || 'Table'}</span>
                    </div>
                </div>
                {cart.length > 0 && (
                    <div className="space-y-2">
                        {cart.map((item, index) => (
                            <div key={index} className="flex justify-between text-sm mb-3 border-b border-[var(--color-rule)] pb-2 last:border-0 last:pb-0">
                                <div>
                                    <div className="text-ink font-bold font-sans">{item.name} <span className="text-subInk text-xs font-mono">x{item.qty}</span></div>
                                    {item.optionsSummary?.map((opt, i) => <div key={i} className="text-xs font-mono text-subInk">+ {opt.name}</div>)}
                                </div>
                                <span className="font-bold font-mono text-ink">{((item.totalPricePerUnit || item.price) * item.qty)}.-</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-paper p-6 border border-[var(--color-rule)] rounded-rams space-y-4">
                <h3 className="text-xs font-mono font-bold text-subInk uppercase">{t('contactInfo')}</h3>
                <input 
                    type="text" 
                    placeholder={t('yourName')} 
                    value={localName} 
                    onChange={e => setLocalName(e.target.value)} 
                    onBlur={() => updateForm('contactName', localName)}
                    className="w-full bg-transparent border-b border-[var(--color-rule)] py-2 focus:border-ink outline-none transition-colors" 
                />
                <input 
                    type="tel" 
                    placeholder={t('phoneNumber')} 
                    value={localPhone} 
                    onChange={e => setLocalPhone(e.target.value)} 
                    onBlur={() => updateForm('contactPhone', localPhone)}
                    className="w-full bg-transparent border-b border-[var(--color-rule)] py-2 focus:border-ink outline-none transition-colors" 
                />
            </div>

            <div className="bg-paper p-6 border border-[var(--color-rule)] rounded-rams space-y-4">
                <h3 className="text-xs font-mono font-bold text-subInk uppercase">2. {t('paymentTitle')}</h3>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder="Promo Code" 
                        value={promoCode}
                        onChange={e => setPromoCode(e.target.value.toUpperCase())}
                        disabled={!!appliedPromo}
                        className="flex-1 bg-transparent border border-[var(--color-rule)] px-3 py-2 text-sm font-mono uppercase outline-none focus:border-ink disabled:opacity-50"
                    />
                    {appliedPromo ? (
                        <button onClick={removePromo} className="text-error px-3 py-2 font-mono text-xs border border-[var(--color-rule)] hover:bg-error hover:text-paper">Remove</button>
                    ) : (
                        <button onClick={handleApplyCode} disabled={!promoCode || isValidating} className="bg-ink text-paper px-4 py-2 font-mono text-xs disabled:opacity-50">Apply</button>
                    )}
                </div>
                
                {promoError && (
                    <p className="text-error text-xs font-mono font-bold flex items-center gap-1">
                        <AlertCircle size={12} /> {promoError}
                    </p>
                )}

                {appliedPromo && (
                    <div className="flex items-center gap-2 text-ink text-xs font-mono font-bold bg-[var(--color-rule)] p-2 rounded-none">
                        <Tag size={12} /> Code {appliedPromo.code} applied!
                    </div>
                )}

                <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-xs font-mono text-subInk font-bold">
                        <span>Subtotal</span>
                        <span>{cartTotal}.-</span>
                    </div>
                    
                    {appliedPromo && (
                        <div className="flex justify-between text-xs font-mono text-ink font-bold">
                            <span>
                                Discount 
                                {appliedPromo.discountType === 'percent' && <span className="ml-1 text-[10px] bg-[var(--color-rule)] px-1 rounded-none">{appliedPromo.discountValue}%</span>}
                            </span>
                            <span>- {discountAmount}.-</span>
                        </div>
                    )}

                    <div className="flex justify-between items-end border-t border-[var(--color-rule)] pt-2 mt-2">
                         <span className="text-subInk text-xs font-mono uppercase">{t('totalPrice')} (Food)</span>
                         <span className="text-xl font-bold font-mono tracking-tight text-ink">{finalTotal}.-</span>
                    </div>
                    
                    <div className="flex justify-between items-end border-t border-[var(--color-rule)] pt-2 mt-2 bg-canvas p-2 rounded-rams border border-ink">
                         <div>
                             <span className="text-ink text-xs font-mono font-bold block uppercase">Deposit Required (50%)</span>
                             <span className="text-[10px] text-subInk font-mono block">ยอดมัดจำ 50% ที่ต้องชำระตอนนี้</span>
                         </div>
                         <span className="text-3xl font-bold font-mono tracking-tight text-ink">{depositAmount}.-</span>
                    </div>

                    <p className="text-[10px] text-subInk font-mono text-right mt-1">ขั้นต่ำ 150 บาท ต่อท่าน (Min Spend: {150 * pax}.-)</p>
                </div>

                {/* PAYMENT METHODS SELECTOR & QR (Dieter Rams Tabular Layout) */}
                <div className="border-t border-[var(--color-rule)] pt-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-mono font-bold text-subInk uppercase">เลือกช่องทางชำระเงินมัดจำ 50%</h4>
                        <span className="text-[10px] font-mono bg-ink text-paper px-2 py-0.5 rounded-none font-bold">ยอดมัดจำ ฿{depositAmount}.-</span>
                    </div>

                    {/* Tab Navigation */}
                    <div className="grid grid-cols-2 border border-[var(--color-rule)] rounded-rams overflow-hidden bg-canvas">
                        <button
                            type="button"
                            onClick={() => {
                                setPaymentMethod('promptpay');
                                if (slipFile) {
                                    handleFileChange({ target: { files: [slipFile] } });
                                }
                            }}
                            className={`py-2.5 px-3 flex items-center justify-center gap-2 text-xs font-mono font-bold transition-all ${paymentMethod === 'promptpay' ? 'bg-ink text-paper' : 'text-subInk hover:text-ink'}`}
                        >
                            <QrCode size={14} />
                            <span>พร้อมเพย์ QR</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setPaymentMethod('truewallet');
                                if (slipFile) {
                                    handleFileChange({ target: { files: [slipFile] } });
                                }
                            }}
                            className={`py-2.5 px-3 flex items-center justify-center gap-2 text-xs font-mono font-bold transition-all border-l border-[var(--color-rule)] ${paymentMethod === 'truewallet' ? 'bg-[#ff6000] text-white' : 'text-subInk hover:text-ink'}`}
                        >
                            <Wallet size={14} />
                            <span>TrueMoney</span>
                        </button>
                    </div>

                    {/* QR Code & Account Display */}
                    <div className="bg-canvas p-4 rounded-rams border border-[var(--color-rule)] space-y-3">
                        {paymentMethod === 'promptpay' ? (
                            <div>
                                {settings.qrCodeUrl ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="bg-white p-3 rounded-rams border border-[var(--color-rule)]">
                                            <img
                                                src={settings.qrCodeUrl}
                                                className="w-44 h-44 object-contain cursor-zoom-in mix-blend-multiply"
                                                alt="Payment QR"
                                                onClick={() => setIsSlipModalOpen(true)}
                                            />
                                        </div>
                                        <p className="text-[10px] text-subInk font-mono">{t('clickToEnlarge')}</p>
                                    </div>
                                ) : (
                                    <div className="w-full h-32 bg-canvas flex items-center justify-center text-subInk rounded-rams font-mono text-xs">{t('noQrCode')}</div>
                                )}

                                <div className="space-y-1.5 font-mono text-xs pt-2">
                                    {settings.promptpayName && (
                                        <div className="flex justify-between items-center text-subInk">
                                            <span>ชื่อบัญชี:</span>
                                            <strong className="text-ink">{settings.promptpayName}</strong>
                                        </div>
                                    )}
                                    {settings.promptpayId && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-subInk">พร้อมเพย์ ID:</span>
                                            <div className="flex items-center gap-1.5">
                                                <strong className="text-ink">{settings.promptpayId}</strong>
                                                <button
                                                    type="button"
                                                    onClick={() => copyToClipboard(settings.promptpayId, 'promptpay')}
                                                    className="p-1 text-subInk hover:text-ink hover:bg-paper rounded transition-colors"
                                                    title="คัดลอก"
                                                >
                                                    {copiedField === 'promptpay' ? <CheckIcon size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div>
                                {(settings.trueWalletQrUrl || settings.qrCodeUrl) ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="bg-white p-3 rounded-rams border border-[var(--color-rule)]">
                                            <img
                                                src={settings.trueWalletQrUrl || settings.qrCodeUrl}
                                                className="w-44 h-44 object-contain cursor-zoom-in mix-blend-multiply"
                                                alt="TrueMoney QR"
                                                onClick={() => setIsSlipModalOpen(true)}
                                            />
                                        </div>
                                        <p className="text-[10px] text-subInk font-mono">{t('clickToEnlarge')}</p>
                                    </div>
                                ) : (
                                    <div className="w-full h-32 bg-canvas flex items-center justify-center text-subInk rounded-rams font-mono text-xs">กำลังโหลด QR TrueMoney...</div>
                                )}

                                <div className="space-y-1.5 font-mono text-xs pt-2">
                                    {settings.trueWalletName && (
                                        <div className="flex justify-between items-center text-subInk">
                                            <span>ชื่อบัญชี TrueMoney:</span>
                                            <strong className="text-ink">{settings.trueWalletName}</strong>
                                        </div>
                                    )}
                                    {settings.trueWalletPhone ? (
                                        <div className="flex justify-between items-center">
                                            <span className="text-subInk">เบอร์ TrueMoney Wallet:</span>
                                            <div className="flex items-center gap-1.5">
                                                <strong className="text-ink font-bold">{settings.trueWalletPhone}</strong>
                                                <button
                                                    type="button"
                                                    onClick={() => copyToClipboard(settings.trueWalletPhone, 'truewallet')}
                                                    className="p-1 text-subInk hover:text-ink hover:bg-paper rounded transition-colors"
                                                    title="คัดลอก"
                                                >
                                                    {copiedField === 'truewallet' ? <CheckIcon size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-subInk font-mono">สามารถสแกน QR ผ่านแอป TrueMoney Wallet ได้ทันที</p>
                                    )}
                                </div>
                            </div>
                        )}

                        <p className="text-[10px] text-subInk font-mono border-t border-[var(--color-rule)] pt-2 leading-relaxed">
                            • ชำระเงินมัดจำ <strong>฿{depositAmount}.-</strong> (หักคืนให้อัตโนมัติในบิลหน้าร้าน)<br />
                            • ระบบจะตรวจสลิปมัดจำอัตโนมัติทันทีที่อัปโหลด
                        </p>
                    </div>

                    {/* SLIP UPLOAD & AUTO-VERIFICATION STATUS */}
                    <div className="space-y-2.5 pt-2 border-t border-[var(--color-rule)]">
                        <label className="block text-xs font-mono font-bold text-subInk uppercase">
                            {t('uploadSlip')} (หลักฐานโอนเงินมัดจำ ฿{depositAmount}.-)
                        </label>

                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="block w-full text-xs text-subInk file:mr-3 file:py-2 file:px-3 file:rounded-none file:border-0 file:bg-ink file:text-paper hover:file:bg-canvas hover:file:text-ink hover:file:border hover:file:border-ink transition-colors cursor-pointer font-mono"
                        />

                        {/* Verification Status Card */}
                        {isVerifyingSlip && (
                            <div className="bg-canvas border border-[var(--color-rule)] p-3 rounded-rams flex items-center gap-2.5 text-xs font-mono text-subInk animate-pulse">
                                <RefreshCw size={15} className="animate-spin text-ink shrink-0" />
                                <span>กำลังตรวจสอบสลิปอัตโนมัติผ่าน EasySlip...</span>
                            </div>
                        )}

                        {slipVerifyResult?.verified && (
                            <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-rams space-y-1 text-xs font-mono">
                                <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                                    <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
                                    <span>สลิปมัดจำผ่านการตรวจสอบอัตโนมัติเรียบร้อย ✓</span>
                                </div>
                                <div className="text-[11px] text-emerald-900/90 pl-5 space-y-0.5">
                                    <p>ผู้โอน: <strong>{slipVerifyResult.senderName}</strong></p>
                                    <p>ยอดโอน: <strong>฿{slipVerifyResult.amountInSlip}.-</strong> ({slipVerifyResult.bankName})</p>
                                    {slipVerifyResult.transRef && <p className="text-[9px] text-emerald-800/80">Ref: {slipVerifyResult.transRef}</p>}
                                </div>
                            </div>
                        )}

                        {slipVerifyError && (
                            <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-rams space-y-2 text-xs font-mono">
                                <div className="flex items-start gap-1.5 text-amber-900 font-bold">
                                    <AlertTriangle size={15} className="text-amber-700 shrink-0 mt-0.5" />
                                    <span>{slipVerifyError}</span>
                                </div>
                                {!allowManualFallback && (
                                    <div className="pl-5 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setAllowManualFallback(true)}
                                            className="text-[11px] font-bold text-ink underline hover:opacity-75 cursor-pointer"
                                        >
                                            ส่งสลิปนี้ให้เจ้าหน้าที่ตรวจสอบด้วยตนเอง (Manual Review)
                                        </button>
                                    </div>
                                )}
                                {allowManualFallback && (
                                    <p className="text-[10px] text-amber-800 pl-5">
                                        ✓ เปิดโหมดส่งให้เจ้าหน้าที่ตรวจสอบแล้ว คุณสามารถกดยืนยันการจองได้
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-canvas p-4 rounded-rams border border-[var(--color-rule)] text-ink text-xs leading-relaxed space-y-2">
                <h4 className="font-mono font-bold text-sm uppercase">📌 เงื่อนไขการจองโต๊ะ (Dine-in Conditions)</h4>
                <ul className="text-subInk text-xs space-y-1 pl-4 list-disc font-mono">
                    <li>สั่งอาหารขั้นต่ำ 150 บาทต่อท่าน (Min Spend 150 THB/pax)</li>
                    <li>ชำระเงินมัดจำ 50% จากยอดค่าอาหาร (หักคืนให้อัตโนมัติจากบิลหน้าร้าน)</li>
                    <li>ยกเลิกและขอคืนเงินมัดจำได้ผ่านระบบล่วงหน้าไม่น้อยกว่า 24 ชั่วโมงก่อนเวลานัดหมาย</li>
                </ul>
                <div className="text-[11px] font-mono text-error font-bold bg-[var(--color-rule)] p-2.5 rounded-none mt-2">
                    ⚠️ หมายเหตุ: หากยกเลิกกระทันหันน้อยกว่า 24 ชั่วโมงก่อนเวลานัดหมาย ระบบจะไม่สามารถคืนเงินมัดจำได้ กรุณาติดต่อทางร้านโดยตรง
                </div>
            </div>

            <label className="flex items-start gap-3 p-2 cursor-pointer">
                <input type="checkbox" checked={isAgreed} onChange={e => updateForm('isAgreed', e.target.checked)} className="mt-1 w-4 h-4 accent-ink" />
                <span className="text-xs font-mono text-subInk leading-relaxed">
                    {t('agreeTerms')}
                </span>
            </label>

            <button
                onClick={handleSubmit}
                disabled={submitting || !isAgreed || !slipFile || isVerifyingSlip || (settings.easySlipEnabled !== false && !slipVerifyResult?.verified && !allowManualFallback)}
                className="w-full bg-brand text-ink border border-ink py-4 rounded-none font-mono font-bold text-lg uppercase tracking-widest mt-4 hover:bg-paper disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-colors"
            >
                {submitting ? t('processing') : t('confirmBooking')}
            </button>

            {/* QR Modal */}
            <ImageModal
                isOpen={isSlipModalOpen}
                onClose={() => setIsSlipModalOpen(false)}
                imageUrl={paymentMethod === 'truewallet' ? (settings.trueWalletQrUrl || settings.qrCodeUrl) : settings.qrCodeUrl}
                title="Payment QR Code"
            />
        </div>
    )
}
