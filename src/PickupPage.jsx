import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from './lib/supabaseClient'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutGrid, List as ListIcon, Search, Check, ArrowRight, ArrowLeft, Clock } from 'lucide-react'
import { useLanguage } from './context/LanguageContext'
import { toThaiISO } from './utils/timeUtils'

import MenuCard from './components/shared/MenuCard'
import ViewToggle from './components/shared/ViewToggle'
import OptionSelectionModal from './components/shared/OptionSelectionModal'
import { usePromotion } from './hooks/usePromotion'
import { useMenuData } from './hooks/useMenuData' // NEW
import { useOrderSubmission } from './hooks/useOrderSubmission' // NEW
import { useServiceStatus } from './hooks/useServiceGuard'
import RetryState from './components/shared/RetryState'
import { PICKUP_SETTING_KEYS, fetchSettingsMap } from './utils/publicSettings'
import { getPickupSlots, getPickupDateStr, getLastOrderTime } from './utils/bangkokTime'
import { ensureLiff, liffNeededEarly, getLiffIdToken } from './utils/liffLoader'
import { getEntryBackPath, rememberEntry, trackFunnel, trackFunnelPageView } from './utils/funnelTracking'
import { safeTimestampUrl } from './utils/urlHelper'
import { verifyPaymentSlip } from './utils/slipVerificationHelper'
import LazyPromptPayQR from './components/shared/LazyPromptPayQR'
import { Tag, AlertCircle, Crown, Coffee, QrCode, Wallet, CheckCircle2, AlertTriangle, Copy, RefreshCw, Check as CheckIcon, X as CloseIcon } from 'lucide-react'
import { toast } from 'sonner'
import CRMCheckoutPrivileges from './components/shared/CRMCheckoutPrivileges'
import { DEFAULT_CRM_SETTINGS } from './utils/crmHelper'
import { trackPickupComplete } from './utils/analyticsHelper'

// --- Main Page ---
export default function PickupPage() {
    const { t } = useLanguage()
    const navigate = useNavigate()
    // Pickup is same-day food: open until the kitchen's last order (20:45), Bangkok time
    const { status: serviceStatus, retry: retryService } = useServiceStatus('shop_mode_pickup', { cutoff: 'last_order' })
    const [viewMode, setViewMode] = useState('grid')
    const [step, setStep] = useState(1)
    const [menuItems, setMenuItems] = useState([])
    const [cart, setCart] = useState([])
    const [searchTerm, setSearchTerm] = useState('')
    const [activeCategory, setActiveCategory] = useState('All')
    const [selectedItem, setSelectedItem] = useState(null) 

    // CRM Member State
    const [memberProfile, setMemberProfile] = useState(null)
    const [crmSettings, setCrmSettings] = useState({
        ...DEFAULT_CRM_SETTINGS
    })
    const [eligibleCategoryIds, setEligibleCategoryIds] = useState(new Set())
    const [tierDetails, setTierDetails] = useState({
        current_tier: 'Haus Common',
        multiplier: 1.00,
        is_in_grace_period: false
    })

    // CRM Redemption State
    const [xhausToRedeem, setXhausToRedeem] = useState(0)
    const [useFreeDrinkQuota, setUseFreeDrinkQuota] = useState(false)

    // Checkout Form State
    const [pickupTime, setPickupTime] = useState('') // Now acts as the selected value for Dropdown
    const [contactName, setContactName] = useState('')
    const [contactPhone, setContactPhone] = useState('')
    const [specialRequest, setSpecialRequest] = useState('')
    const [isAgreed, setIsAgreed] = useState(false)
    const [slipFile, setSlipFile] = useState(null)
    const [slipPreviewUrl, setSlipPreviewUrl] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState('')

    // Payment & Slip Verification State
    const [paymentMethod, setPaymentMethod] = useState('promptpay') // 'promptpay' | 'truewallet'
    const [payTiming, setPayTiming] = useState('now') // 'now' (transfer + slip) | 'store' (pay on pickup, staff calls to confirm)
    // null until settings arrive: the note is not drawn and then removed (that moved the menu 133px, CLS)
    const [payAtStoreEnabled, setPayAtStoreEnabled] = useState(null)
    const [promptpayId, setPromptpayId] = useState('')
    const [promptpayName, setPromptpayName] = useState('')
    const [truewalletPhone, setTruewalletPhone] = useState('')
    const [truewalletName, setTruewalletName] = useState('')
    const [truewalletQrUrl, setTruewalletQrUrl] = useState(null)
    const [isVerifyingSlip, setIsVerifyingSlip] = useState(false)
    const [slipVerifyResult, setSlipVerifyResult] = useState(null)
    const [slipVerifyError, setSlipVerifyError] = useState(null)
    const [allowManualFallback, setAllowManualFallback] = useState(false)
    const [copiedField, setCopiedField] = useState(null)
    const [selectedModalImage, setSelectedModalImage] = useState(null)

    // Settings State
    const [qrCodeUrl, setQrCodeUrl] = useState(null)
    const [policyNote, setPolicyNote] = useState('')
    const [minAdvanceHours, setMinAdvanceHours] = useState(1) 
    const [pickupDate, setPickupDate] = useState('today') // 'today' | 'tomorrow'
    const [openingTime, setOpeningTime] = useState('11:00')
    const [closingTime, setClosingTime] = useState('21:30')
    const [kitchenCloseTime, setKitchenCloseTime] = useState(null) // qr_kitchen_close_time (last order)
    const [settingsError, setSettingsError] = useState(false)
    const [settingsAttempt, setSettingsAttempt] = useState(0)
    const [crmBaseSpendAmount, setCrmBaseSpendAmount] = useState(100)
    const [easySlipEnabled, setEasySlipEnabled] = useState(true)

    // --- Hooks ---
    const { menuItems: allMenuItems, categories, loading: menuLoading, error: menuError, refreshMenu } = useMenuData({ live: step === 1 })
    const { submitOrder, isSubmitting } = useOrderSubmission()

    // QR libraries load only on the checkout step (LazyPromptPayQR)
    const promptpayIdForQr = promptpayId || '0985284217'

    // Filter Menu for Pickup
    useEffect(() => {
        if (allMenuItems) {
            setMenuItems(allMenuItems.filter(item => item.is_pickup_available !== false))
        }
    }, [allMenuItems])

    // Load Settings Only (Menu handled by hook)
    useEffect(() => {
        const fetchSettings = async () => {
            // 2. Settings: only the keys this page shows
            let map
            try {
                map = await fetchSettingsMap(PICKUP_SETTING_KEYS)
                setSettingsError(false)
            } catch (err) {
                console.error('Pickup settings load failed', err)
                setSettingsError(true)
                return
            }
            {
                if (map.payment_qr_url) setQrCodeUrl(safeTimestampUrl(map.payment_qr_url))
                if (map.promptpay_id) setPromptpayId(map.promptpay_id)
                if (map.promptpay_name) setPromptpayName(map.promptpay_name)
                if (map.truewallet_phone) setTruewalletPhone(map.truewallet_phone)
                if (map.truewallet_account_name) setTruewalletName(map.truewallet_account_name)
                if (map.truewallet_qr_url) setTruewalletQrUrl(safeTimestampUrl(map.truewallet_qr_url))
                if (map.policy_pickup) setPolicyNote(map.policy_pickup)
                if (map.pickup_min_advance_hours) setMinAdvanceHours(Number(map.pickup_min_advance_hours))
                if (map.opening_time) setOpeningTime(map.opening_time)
                if (map.closing_time) setClosingTime(map.closing_time)
                if (map.qr_kitchen_close_time) setKitchenCloseTime(map.qr_kitchen_close_time)
                if (map.crm_base_spend_amount) setCrmBaseSpendAmount(parseFloat(map.crm_base_spend_amount) || 100)
                if (map.easyslip_enabled_pickup !== undefined) setEasySlipEnabled(map.easyslip_enabled_pickup !== 'false')
                setPayAtStoreEnabled(map.pickup_pay_at_store_enabled !== 'false')

                setCrmSettings(prev => ({
                    ...prev,
                    ...map
                }))
            }

            // Fetch eligible drink categories
            const { data: cats } = await supabase
                .from('menu_categories')
                .select('id, name')
                .eq('is_drink_stamp_eligible', true)
            if (cats) {
                setEligibleCategoryIds(new Set(cats.map(c => c.id)))
            }

            // 3. User
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                setContactName(user.user_metadata.full_name || '')
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
                if (profile) {
                    setMemberProfile(profile)
                    if (profile.phone_number) setContactPhone(profile.phone_number)
                    if (profile.display_name && !user.user_metadata.full_name) setContactName(profile.display_name)
                    
                    const { data: tierData } = await supabase.rpc('get_member_tier_details', { p_user_id: user.id })
                    if (tierData && tierData.length > 0) {
                        setTierDetails(tierData[0])
                    }
                }
            }
        }
        fetchSettings()
    }, [settingsAttempt])

    useEffect(() => {
        rememberEntry()
        trackFunnelPageView('pickup')
        // LINE login is optional here: load LIFF only inside LINE / for a returning LINE user
        if (liffNeededEarly()) ensureLiff()
    }, [])

    useEffect(() => {
        trackFunnel(step === 1 ? 'pickup_step_menu' : 'pickup_step_checkout')
    }, [step])

    // --- Time Slots (Bangkok clock, last slot = last order) ---
    const availableTimeSlots = () => getPickupSlots({
        day: pickupDate,
        openingTime,
        closingTime,
        kitchenCloseTime,
        minAdvanceHours
    })

    // --- Logic ---
    const handleItemClick = (item) => {
        setSelectedItem(item)
    }

    const handleConfirmAddItem = (newItem) => {
        setCart(prev => {
            const existIndex = prev.findIndex(i =>
                i.id === newItem.id &&
                JSON.stringify(i.selectedOptions) === JSON.stringify(newItem.selectedOptions)
            )

            if (existIndex > -1) {
                const newCart = [...prev]
                newCart[existIndex].qty += newItem.qty
                return newCart
            }
            return [...prev, newItem]
        })
        setSelectedItem(null)
    }

    const removeFromCart = (index) => {
        setCart(prev => prev.filter((_, i) => i !== index))
    }


    
    // Logic
    const cartTotal = cart.reduce((sum, item) => sum + (item.totalPricePerUnit * item.qty), 0)

    // Promotion Hook
    const { 
        promoCode, setPromoCode, 
        appliedPromo, promoError, isValidating, 
        applyCode, removePromo, revalidatePromo 
    } = usePromotion()

    // Drink stamp eligibility checker
    const isItemDrinkStampEligible = useCallback((item) => {
        if (!item || item.is_reward) return false
        if (item.is_drink_stamp_eligible === true) return true
        if (item.menu_items?.is_drink_stamp_eligible === true) return true
        if (item.menu_categories?.is_drink_stamp_eligible === true) return true
        if (item.category_id && eligibleCategoryIds.has(item.category_id)) return true
        const catName = String(item.category || item.menu_categories?.name || '').toLowerCase()
        const name = String(item.name || '').toLowerCase()
        const beverageKeywords = ['coffee', 'tea', 'drink', 'beverage', 'soda', 'matcha', 'cocoa', 'latte', 'espresso', 'americano', 'cappuccino', 'mocha', 'dirty', 'brew', 'smoothie', 'frappe', 'juice', 'milk', 'lemonade', 'water', 'กาแฟ', 'ชา', 'มัทฉะ', 'น้ำ']
        return beverageKeywords.some(k => catName.includes(k) || name.includes(k))
    }, [eligibleCategoryIds])

    // Available Free Drinks Quota
    const availableFreeDrinks = useMemo(() => {
        if (!memberProfile) return 0
        const quota = parseInt(memberProfile.free_drink_quota || 0, 10)
        const stamps = parseInt(memberProfile.drink_stamp_count || 0, 10)
        return Math.max(0, quota + Math.floor(stamps / 10))
    }, [memberProfile])

    const eligibleDrinkItems = useMemo(() => {
        return cart.filter(isItemDrinkStampEligible)
    }, [cart, isItemDrinkStampEligible])

    const freeDrinkDiscount = useMemo(() => {
        if (!useFreeDrinkQuota || availableFreeDrinks <= 0 || eligibleDrinkItems.length === 0) return 0
        const prices = eligibleDrinkItems.map(i => parseFloat(i.totalPricePerUnit || i.price) || 0)
        return Math.min(...prices)
    }, [useFreeDrinkQuota, availableFreeDrinks, eligibleDrinkItems])

    // Promotion Discount
    const promoDiscount = appliedPromo?.discountAmount || 0
    const netBeforeXhaus = Math.max(0, cartTotal - promoDiscount - freeDrinkDiscount)

    // xhaus Discount Constraints
    const memberCoinsBalance = Math.max(0, parseFloat(memberProfile?.xhaus_balance || 0))
    const redeemRate = parseFloat(crmSettings.crm_redeem_rate_xhaus) || 1.0
    const maxRedeemPercent = parseFloat(crmSettings.crm_max_redeem_percent) || 100.0
    const minRedeem = parseFloat(crmSettings.crm_min_redeem_xhaus) || 10.0

    const maxAllowedDiscountBaht = (netBeforeXhaus * maxRedeemPercent) / 100
    const maxCoinsAllowed = Math.min(memberCoinsBalance, Math.floor((maxAllowedDiscountBaht / redeemRate) * 100) / 100)

    const effectiveXhausDiscount = useMemo(() => {
        if (xhausToRedeem <= 0 || !memberProfile) return 0
        const rawDisc = xhausToRedeem * redeemRate
        return Math.min(rawDisc, maxAllowedDiscountBaht, netBeforeXhaus)
    }, [xhausToRedeem, redeemRate, maxAllowedDiscountBaht, netBeforeXhaus, memberProfile])

    // Auto-reset free drink if no eligible drinks remain
    useEffect(() => {
        if (useFreeDrinkQuota && eligibleDrinkItems.length === 0) {
            setUseFreeDrinkQuota(false)
        }
    }, [useFreeDrinkQuota, eligibleDrinkItems.length])

    // Auto-adjust xhaus if netBeforeXhaus shrinks
    useEffect(() => {
        if (xhausToRedeem > 0) {
            if (maxCoinsAllowed < minRedeem) {
                setXhausToRedeem(0)
            } else if (xhausToRedeem > maxCoinsAllowed) {
                setXhausToRedeem(maxCoinsAllowed)
            }
        }
    }, [maxCoinsAllowed, minRedeem, xhausToRedeem])

    // Total Discounts & Final Total
    const totalDiscounts = promoDiscount + freeDrinkDiscount + effectiveXhausDiscount
    const finalTotal = Math.max(0, cartTotal - totalDiscounts)
    const estimatedPointsEarned = Math.floor((finalTotal / (parseFloat(crmSettings.crm_base_spend_amount) || 100)) * (tierDetails.multiplier || 1.0))

     // Revalidate when cartTotal changes
     useEffect(() => {
         if (appliedPromo) {
             revalidatePromo(cartTotal, 'ordering')
         }
     }, [cartTotal])
 
     const handleApplyCode = async () => {
         if (!promoCode) return
         await applyCode(promoCode, cartTotal, 'ordering')
     }

    // Filter Category Tabs to only show categories that contain pickup items
    const availableCategories = useMemo(() => {
        return categories.filter(cat => 
            menuItems.some(item => item.category_id === cat.id || item.category === cat.name)
        )
    }, [categories, menuItems])

    const filteredMenu = menuItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesCategory = activeCategory === 'All'
            ? true
            : (item.category === activeCategory || item.category_id === categories.find(c => c.name === activeCategory)?.id)
        return matchesSearch && matchesCategory
    })

    const handleSlipFileChange = async (file) => {
        if (!file) return
        setSlipFile(file)
        setSlipPreviewUrl(URL.createObjectURL(file))
        setSlipVerifyResult(null)
        setSlipVerifyError(null)
        setAllowManualFallback(false)

        if (!easySlipEnabled) {
            return
        }

        setIsVerifyingSlip(true)
        try {
            const res = await verifyPaymentSlip({
                file,
                matchAmount: finalTotal,
                provider: paymentMethod,
                remark: `Pickup Order ฿${finalTotal}`
            })

            if (res.verified) {
                setSlipVerifyResult(res)
                setSlipVerifyError(null)
            } else if (res.success && !res.isAmountMatched) {
                setSlipVerifyResult(res)
                setSlipVerifyError(`ยอดเงินในสลิป (฿${res.amountInSlip}) ไม่ตรงกับยอดที่ต้องชำระ (฿${finalTotal})`)
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

    const copyToClipboard = (text, fieldName) => {
        if (!text) return
        navigator.clipboard.writeText(text)
        setCopiedField(fieldName)
        setTimeout(() => setCopiedField(null), 2000)
    }

    const isContactValid = Boolean(contactName?.trim() && contactPhone?.trim()?.replace(/\D/g, '').length >= 9)
    const isPayAtStore = payAtStoreEnabled === true && payTiming === 'store'

    const handleSubmit = async () => {
        if (submitting || isSubmitting) return

        const trimmedName = (contactName || '').trim()
        const trimmedPhone = (contactPhone || '').trim()
        const cleanPhone = trimmedPhone.replace(/\D/g, '')

        if (!trimmedName) return toast.error(t('fillContact') || 'กรุณากรอกชื่อผู้รับสินค้า (Name is required)')
        if (!trimmedPhone || cleanPhone.length < 9) return toast.error('กรุณากรอกเบอร์โทรศัพท์ที่ถูกต้องอย่างน้อย 9-10 หลัก (Valid Phone Number is required)')
        if (!isAgreed) return toast.error(t('agreeTerms'))
        if (!isPayAtStore && finalTotal > 0 && !slipFile) return toast.error(t('uploadSlipDesc'))
        if (!pickupTime) return toast.error(t('selectPickupTime'))

        if (!isPayAtStore && easySlipEnabled && finalTotal > 0 && !slipVerifyResult?.verified && !allowManualFallback) {
            return toast.error('กรุณารอผลตรวจสลิปให้ผ่าน หรือกดเลือก "ส่งให้เจ้าหน้าที่ตรวจสอบด้วยตนเอง"')
        }

        setSubmitError('')
        setSubmitting(true)
        let redirecting = false
        try {
            // Prepare Payload
            const dateStr = getPickupDateStr(pickupDate)
            const bookingDateTime = toThaiISO(dateStr, pickupTime)
            const customerNoteContent = `Pickup Order` + (specialRequest ? `\nNote: ${specialRequest}` : '')

            const isAutoVerified = !isPayAtStore && Boolean(slipVerifyResult?.verified)
            let staffRemarkText = isPayAtStore
                ? '[ONLINE_PICKUP] [PAY_AT_STORE] สั่งรับกลับ จ่ายที่ร้าน (โทรยืนยันก่อนทำ)'
                : isAutoVerified
                    ? `[ONLINE_PICKUP] สั่งรับกลับ (ตรวจสลิป Auto EasySlip ✓ ${typeof slipVerifyResult?.bankName === 'object' ? (slipVerifyResult?.bankName?.th || slipVerifyResult?.bankName?.en || '') : (slipVerifyResult?.bankName || '')})`
                    : '[ONLINE_PICKUP] สั่งรับกลับ'
            
            const perksUsed = []
            if (useFreeDrinkQuota && freeDrinkDiscount > 0) perksUsed.push(`แก้วฟรี 10 แถม 1 (-฿${freeDrinkDiscount})`)
            if (effectiveXhausDiscount > 0) perksUsed.push(`เหรียญ xhaus ${xhausToRedeem} pts (-฿${effectiveXhausDiscount})`)
            if (perksUsed.length > 0) {
                staffRemarkText += ` [CRM: ${perksUsed.join(', ')}]`
            }

            const bookingPayload = {
                source: 'online',
                booking_type: 'pickup',
                status: isAutoVerified ? 'confirmed' : 'pending',
                booking_time: bookingDateTime,
                pickup_contact_name: trimmedName,
                pickup_contact_phone: trimmedPhone,
                customer_note: customerNoteContent + (perksUsed.length > 0 ? `\n(CRM: ${perksUsed.join(', ')})` : ''),
                staff_remark: staffRemarkText,
                promotion_code_id: appliedPromo?.id || null, 
                discount_amount: promoDiscount,
                xhaus_redeemed: xhausToRedeem > 0 ? xhausToRedeem : null,
                xhaus_discount: effectiveXhausDiscount > 0 ? effectiveXhausDiscount : null,
                use_free_drink_quota: Boolean(useFreeDrinkQuota && freeDrinkDiscount > 0),
                total_amount: finalTotal,
                deposit_amount: isPayAtStore ? 0 : finalTotal, // 100% prepaid, or 0 when paying at the counter
                tracking_token: crypto.randomUUID(),
                payment_slip_url: null, // Will be handled by hook if slipFile present
                slip_verified: isAutoVerified,
                slip_provider: isPayAtStore ? null : (slipVerifyResult?.provider || paymentMethod),
                slip_trans_ref: isPayAtStore ? null : (slipVerifyResult?.transRef || null),
                slip_verification_status: isPayAtStore ? null : (isAutoVerified ? 'auto_verified' : (slipVerifyResult ? 'manual_pending' : 'pending')),
                slip_verified_data: isPayAtStore ? null : (slipVerifyResult?.rawSlip || null)
            }

            const orderItemsPayload = cart.map(item => ({
                menu_item_id: item.id,
                name: item.name || item.custom_name || 'สินค้า',
                quantity: item.qty,
                price_at_time: item.totalPricePerUnit,
                price: item.totalPricePerUnit,
                selected_options: item.optionsSummary 
            }))
            
            // Use Line Token if not logged in (logic inside component for token fetch)
            const { data: { user } } = await supabase.auth.getUser()
            const lineIdToken = !user && getLiffIdToken()

            const result = await submitOrder({
                bookingPayload,
                orderItemsPayload,
                slipFile: isPayAtStore ? null : slipFile,
                lineIdToken
            })

            if (result.success) {
                toast.success('สั่งอาหารสำเร็จ' + (isPayAtStore ? ' ร้านจะโทรยืนยันก่อนเริ่มทำ' : isAutoVerified ? ' สลิปผ่านการตรวจอัตโนมัติ' : ''))
                // Conversion: pickup order actually placed. Wait for GTM before leaving the page.
                await trackPickupComplete({
                    transactionId: result.trackingToken,
                    value: finalTotal
                })
                redirecting = true
                if (result.trackingToken) {
                    window.location.replace(`/tracking/${result.trackingToken}`)
                } else {
                    navigate('/', { replace: true })
                }
            } else {
                setSubmitError(result.error || 'ส่งออเดอร์ไม่สำเร็จ กรุณาลองใหม่')
                toast.error('ส่งออเดอร์ไม่สำเร็จ')
            }
        } catch (err) {
            console.error('Pickup submit failed', err)
            setSubmitError('ส่งออเดอร์ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่')
        } finally {
            if (!redirecting) setSubmitting(false)
        }
    }

    const goBack = () => {
        if (step !== 1) return setStep(1)
        const back = getEntryBackPath()
        // /link is api/link.js, outside the React router
        if (back === '/link') window.location.assign('/link')
        else navigate('/')
    }

    // A failed check never lets an order through blind: one retry state, one button that
    // retries everything that failed (opening hours, menu, shop settings)
    const serviceFailed = serviceStatus === 'error'
    const menuFailed = Boolean(menuError) && allMenuItems.length === 0
    if (serviceFailed || menuFailed || settingsError) {
        const retryAll = () => {
            if (serviceFailed) retryService()
            if (menuFailed) refreshMenu()
            if (settingsError) setSettingsAttempt(a => a + 1)
        }
        return <RetryState title="โหลดข้อมูลไม่สำเร็จ" onRetry={retryAll} />
    }

    return (
        <div className="min-h-screen bg-canvas flex flex-col p-6 font-sans text-ink">
            {/* Nav */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-[var(--color-rule)]">
                <button type="button" onClick={goBack} aria-label="ย้อนกลับ" className="w-12 h-12 flex items-center justify-center hover:bg-paper rounded-rams transition-colors border border-[var(--color-rule)]">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex gap-1" aria-label={`ขั้นตอน ${step} จาก 2`}>
                    <div className={`h-1 w-8 transition-colors duration-150 ${step >= 1 ? 'bg-ink' : 'bg-[var(--color-rule)]'}`} />
                    <div className={`h-1 w-8 transition-colors duration-150 ${step >= 2 ? 'bg-ink' : 'bg-[var(--color-rule)]'}`} />
                </div>
            </div>

            <div className="flex-1 max-w-lg mx-auto w-full relative flex flex-col">
                {/* initial={false}: the first paint is not animated (and the LCP text is visible at once) */}
                <AnimatePresence mode="wait" initial={false}>

                    {/* Step 1: Menu */}
                    {step === 1 && (
                        <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col h-full">
                            <div className="mb-4">
                                <h1 className="text-3xl font-display leading-normal">{t('orderFood')}</h1>
                                <p className="text-[var(--color-muted)] text-sm leading-normal">{t('pickup')}</p>
                                {payAtStoreEnabled === true && (
                                    <div className="mt-3 px-4 py-3 bg-paper border border-[var(--color-rule)] rounded-rams text-sm leading-relaxed text-ink">
                                        <span className="font-bold mr-1.5">จ่ายหน้าร้านตอนรับได้</span>
                                        <span>
                                            สามารถเลือกโอนจ่ายทันที หรือชำระที่หน้าร้านตอนมารับได้ • <strong>กรณีรับหน้าร้านแบบจ่ายที่ร้าน ต้องได้รับการยืนยันจากทางร้านเสมอ</strong> มิฉะนั้นกรุณาโทร{' '}
                                            <a href="tel:0985284217" className="font-mono font-bold underline">098-528-4217</a>
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-between items-end mb-4 shrink-0">
                                <div className="relative flex-1 mr-4">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subInk w-4 h-4" />
                                    <input type="text" placeholder={t('searchMenu')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full min-h-12 bg-paper border border-[var(--color-rule)] pl-9 pr-4 py-2 rounded-rams text-base focus:outline-none focus:border-ink transition-colors" />
                                </div>
                                <ViewToggle mode={viewMode} setMode={setViewMode} />
                            </div>

                            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide mb-2 border-b border-[var(--color-rule)]">
                                <button type="button" onClick={() => setActiveCategory('All')} className={`whitespace-nowrap px-4 min-h-12 rounded-none text-sm font-bold transition-colors border ${activeCategory === 'All' ? 'bg-ink text-paper border-ink' : 'bg-paper text-subInk border-[var(--color-rule)] hover:border-ink'}`}>{t('allCategories')}</button>
                                {availableCategories.map(cat => (
                                    <button type="button" key={cat.id} onClick={() => setActiveCategory(cat.name)} className={`whitespace-nowrap px-4 min-h-12 rounded-none text-sm font-bold transition-colors border ${activeCategory === cat.name ? 'bg-ink text-paper border-ink' : 'bg-paper text-subInk border-[var(--color-rule)] hover:border-ink'}`}>{cat.name}</button>
                                ))}
                            </div>

                            {/* Reserved height: the menu arriving does not push the footer around */}
                            <div className="flex-1 min-h-[70vh] overflow-y-auto pr-1 pb-32">
                                <div className={`grid gap-3 ${viewMode === 'grid' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                    {filteredMenu.map(item => (
                                        <MenuCard key={item.id} item={item} mode={viewMode} onAdd={() => handleItemClick(item)} onRemove={() => { }} qty={0} t={t} />
                                    ))}
                                    {menuLoading && filteredMenu.length === 0 && (
                                        <div className="col-span-full py-16 text-center text-subInk text-base" aria-busy="true">กำลังโหลดเมนู...</div>
                                    )}
                                    {!menuLoading && filteredMenu.length === 0 && (
                                        <div className="col-span-full py-16 text-center text-subInk text-base">
                                            {t('noMenuItems') || 'ไม่พบรายการอาหาร'}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <AnimatePresence>
                                {cart.length > 0 && (
                                    <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} transition={{ type: "tween", duration: 0.3, ease: "easeOut" }} className="fixed bottom-0 left-0 right-0 bg-paper/90 backdrop-blur-md border-t border-[var(--color-rule)] p-4 pb-8 z-50">
                                        <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
                                            <div className="flex flex-col">
                                                <div className="text-xs font-mono text-subInk uppercase tracking-wider mb-0.5">{t('cartTotal')}</div>
                                                <div className="flex items-end gap-2">
                                                    <span className="font-mono text-sm bg-ink text-paper px-2 py-0.5 border border-[var(--color-rule)]">{cart.reduce((a, b) => a + b.qty, 0)} {t('itemsCount')}</span>
                                                    <span className="font-mono font-bold text-2xl leading-none">฿{cartTotal}</span>
                                                </div>
                                            </div>
                                            <button onClick={() => setStep(2)} className="bg-brand text-cream border border-ink px-8 py-3 rounded-none font-bold text-sm flex items-center gap-2 hover:bg-paper hover:text-ink transition-all active:scale-95">
                                                {t('next')} <ArrowRight size={18} />
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}

                    <AnimatePresence>
                        {selectedItem && (
                            <OptionSelectionModal item={selectedItem} onClose={() => setSelectedItem(null)} onConfirm={handleConfirmAddItem} />
                        )}
                    </AnimatePresence>

                    {/* Step 2: Checkout */}
                    {step === 2 && (
                        <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex-1 flex flex-col h-full overflow-y-auto">
                            <div className="mb-6">
                                <h1 className="text-3xl font-display font-bold tracking-tight">{t('confirmOrder')}</h1>
                                <p className="text-subInk font-mono text-sm uppercase tracking-widest">{t('checkout')}</p>
                            </div>

                            <div className="space-y-4 pb-20">
                                <div className="bg-paper p-6 border border-[var(--color-rule)] rounded-rams space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-mono font-bold text-subInk uppercase">
                                            {t('contactInfo')} <span className="text-[var(--color-accent)]">*</span>
                                        </h3>
                                        <span className={`text-[10px] font-mono font-bold ${isContactValid ? 'text-[var(--color-accent-2)]' : 'text-[var(--color-accent)]'}`}>
                                            {isContactValid ? '✓ ข้อมูลครบถ้วน' : '* บังคับกรอกชื่อและเบอร์โทร'}
                                        </span>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-[11px] font-mono text-subInk font-bold block mb-1">
                                                {t('yourName')} <span className="text-[var(--color-accent)]">*</span>
                                            </label>
                                            <input 
                                                type="text" 
                                                placeholder={t('yourName') + ' (เช่น คุณสมชาย)'} 
                                                value={contactName} 
                                                onChange={e => setContactName(e.target.value)} 
                                                className="w-full bg-canvas border border-[var(--color-rule)] px-3 py-2.5 rounded-rams text-sm font-sans focus:border-ink outline-none transition-colors" 
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-mono text-subInk font-bold block mb-1">
                                                {t('phoneNumber')} <span className="text-[var(--color-accent)]">* (9-10 หลัก)</span>
                                            </label>
                                            <input 
                                                type="tel" 
                                                placeholder={t('phoneNumber') + ' (เช่น 0812345678)'} 
                                                value={contactPhone} 
                                                onChange={e => setContactPhone(e.target.value)} 
                                                className="w-full bg-canvas border border-[var(--color-rule)] px-3 py-2.5 rounded-rams text-sm font-mono focus:border-ink outline-none transition-colors" 
                                                required
                                            />
                                            {contactPhone && contactPhone.replace(/\D/g, '').length > 0 && contactPhone.replace(/\D/g, '').length < 9 && (
                                                <p className="text-[10px] text-amber-700 font-mono mt-1">
                                                    * เบอร์โทรศัพท์ต้องมีอย่างน้อย 9-10 หลัก (ปัจจุบัน {contactPhone.replace(/\D/g, '').length} หลัก)
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-paper p-6 border border-[var(--color-rule)] rounded-rams">
                                    <label className="text-xs font-mono text-subInk uppercase block mb-3">{t('specialRequest')}</label>
                                    <textarea value={specialRequest} onChange={e => setSpecialRequest(e.target.value)} placeholder={t('specialRequestPlaceholder')} className="w-full bg-transparent border-b border-[var(--color-rule)] py-2 focus:border-ink outline-none resize-none text-sm transition-colors" rows={2} />
                                </div>

                                {/* Pickup Time Dropdown */}
                                <div className="bg-paper p-6 border border-[var(--color-rule)] rounded-rams">
                                    <label className="text-sm font-bold text-[var(--color-muted)] block mb-3">{t('pickupTime')}</label>
                                    
                                    <div className="flex border border-[var(--color-rule)] mb-4 rounded-rams overflow-hidden">
                                        <button type="button" aria-pressed={pickupDate === 'today'} onClick={() => { setPickupDate('today'); setPickupTime(''); }} className={`flex-1 min-h-12 text-base font-bold transition-colors ${pickupDate === 'today' ? 'bg-ink text-paper' : 'bg-transparent text-subInk hover:bg-canvas'}`}>{t('today')}</button>
                                        <div className="w-px bg-[var(--color-rule)]"></div>
                                        <button type="button" aria-pressed={pickupDate === 'tomorrow'} onClick={() => { setPickupDate('tomorrow'); setPickupTime(''); }} className={`flex-1 min-h-12 text-base font-bold transition-colors ${pickupDate === 'tomorrow' ? 'bg-ink text-paper' : 'bg-transparent text-subInk hover:bg-canvas'}`}>{t('tomorrow')}</button>
                                    </div>

                                    <div className="relative">
                                        <Clock className="absolute left-3 top-3 text-subInk w-5 h-5 pointer-events-none" />
                                        <select 
                                            value={pickupTime} 
                                            onChange={(e) => setPickupTime(e.target.value)} 
                                            className="w-full min-h-12 bg-canvas border border-[var(--color-rule)] text-ink font-mono font-bold text-base p-3 pl-10 rounded-rams outline-none focus:border-ink appearance-none transition-colors"
                                        >
                                            <option value="" disabled>{t('selectPickupTime')}</option>
                                            {availableTimeSlots().length === 0 ? (
                                                <option disabled>{t('noValidTimes')}</option>
                                            ) : (
                                                availableTimeSlots().map(slot => (
                                                    <option key={slot} value={slot}>{slot}</option>
                                                ))
                                            )}
                                        </select>
                                        <div className="absolute right-4 top-4 w-2 h-2 border-r-2 border-b-2 border-subInk rotate-45 pointer-events-none"></div>
                                    </div>
                                    {pickupDate === 'today' && availableTimeSlots().length === 0 && (
                                        <p className="mt-3 text-base text-ink leading-relaxed">
                                            วันนี้ปิดรับออเดอร์แล้ว (รับออเดอร์ถึง {getLastOrderTime({ kitchenCloseTime, closingTime })} น.){' '}
                                            <button type="button" onClick={() => { setPickupDate('tomorrow'); setPickupTime('') }} className="font-bold underline min-h-12">สั่งรับพรุ่งนี้</button>
                                        </p>
                                    )}
                                 </div>

                                {/* Member CRM Privileges Badge */}
                                {memberProfile && (
                                    <div className="bg-[var(--color-paper-2)] border border-[var(--brand-plum)]/30 p-4 rounded-rams space-y-3">
                                        <div className="flex justify-between items-center border-b border-[var(--color-rule)] pb-2.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-[var(--brand-plum)] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                                                    <Crown size={14} />
                                                </div>
                                                <div>
                                                    <span className="font-bold text-xs text-[var(--color-ink)] block">คุณ {memberProfile.display_name}</span>
                                                    <span className="text-[9px] font-mono text-[var(--color-neutral)]">สิทธิประโยชน์สมาชิก CRM</span>
                                                </div>
                                            </div>
                                            <span className="px-2.5 py-1 bg-[var(--brand-plum)] text-white text-[9px] font-mono font-bold rounded-rams uppercase tracking-wider">
                                                {tierDetails.current_tier} ({tierDetails.multiplier}x)
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 text-center font-mono">
                                            <div className="bg-white/80 border border-[var(--color-rule)] p-2 rounded-rams">
                                                <span className="text-[8px] text-[var(--color-neutral)] uppercase block">xhaus Balance</span>
                                                <span className="text-xs font-bold text-[var(--brand-plum)]">🪙 {parseFloat(memberProfile.xhaus_balance || 0).toFixed(0)}</span>
                                            </div>
                                            <div className="bg-white/80 border border-[var(--color-rule)] p-2 rounded-rams">
                                                <span className="text-[8px] text-[var(--color-neutral)] uppercase block">Drink Stamps</span>
                                                <span className="text-xs font-bold text-[var(--color-ink)]">☕ {memberProfile.drink_stamp_count || 0}/10</span>
                                            </div>
                                            <div className="bg-white/80 border border-[var(--color-rule)] p-2 rounded-rams">
                                                <span className="text-[8px] text-[var(--color-neutral)] uppercase block">Earn Points</span>
                                                <span className="text-xs font-bold text-emerald-700">+{estimatedPointsEarned} xhaus</span>
                                            </div>
                                        </div>

                                        {availableFreeDrinks > 0 && (
                                            <div className="bg-[oklch(45%_0.08_140)]/10 border border-[oklch(45%_0.08_140)]/30 px-3 py-1.5 rounded-rams flex items-center justify-between text-xs font-mono">
                                                <span className="text-[oklch(45%_0.08_140)] font-bold">
                                                    ☕ สะสมครบแล้ว! มีสิทธิ์แก้วฟรี {availableFreeDrinks} แก้ว
                                                </span>
                                                <span className="text-[10px] text-[oklch(45%_0.08_140)] font-bold">
                                                    {useFreeDrinkQuota ? 'กำลังใช้งาน ✓' : 'กดใช้สิทธิ์ที่สรุปรายการ'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="bg-paper p-6 border border-[var(--color-rule)] rounded-rams">
                                    <h3 className="text-xs font-mono text-subInk uppercase mb-3">{t('orderSummary')}</h3>
                                    {cart.map((item, index) => (
                                        <div key={index} className="flex justify-between text-sm mb-3 border-b border-[var(--color-rule)] pb-2 last:border-0 last:pb-0">
                                            <div>
                                                <div className="text-ink font-bold">{item.name} <span className="text-subInk text-xs font-mono">x{item.qty}</span></div>
                                                {item.optionsSummary?.map((opt, i) => <div key={i} className="text-xs font-mono text-subInk">+ {opt.name} ({opt.price})</div>)}
                                                {item.specialRequest && <div className="text-xs font-mono text-[var(--brand-plum)]">{t('note')}: {item.specialRequest}</div>}
                                            </div>
                                            <span className="font-bold font-mono text-ink">{item.totalPricePerUnit * item.qty}.-</span>
                                        </div>
                                    ))}
                                    <div className="border-t border-[var(--color-rule)] mt-2 pt-2 space-y-1">
                                         <div className="flex justify-between font-mono text-base text-subInk"><span>{t('subtotal')}</span><span>{cartTotal}.-</span></div>
                                         
                                         {/* CRM PRIVILEGES (Redeem xhaus & Free Drink) */}
                                         {memberProfile && (
                                             <div className="pt-2">
                                                 <CRMCheckoutPrivileges
                                                     memberProfile={memberProfile}
                                                     crmSettings={crmSettings}
                                                     cart={cart}
                                                     isItemDrinkStampEligible={isItemDrinkStampEligible}
                                                     useFreeDrinkQuota={useFreeDrinkQuota}
                                                     onToggleFreeDrink={setUseFreeDrinkQuota}
                                                     xhausToRedeem={xhausToRedeem}
                                                     onApplyXhaus={(coins) => setXhausToRedeem(coins)}
                                                     onCancelXhaus={() => setXhausToRedeem(0)}
                                                     cartSubtotal={cartTotal}
                                                     promoDiscount={promoDiscount}
                                                 />
                                             </div>
                                         )}

                                         {/* PROMO INPUT */}
                                         <div className="py-2">
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text" 
                                                    placeholder="Promo Code" 
                                                    value={promoCode}
                                                    onChange={e => setPromoCode(e.target.value.toUpperCase())}
                                                    disabled={!!appliedPromo}
                                                    className="flex-1 bg-canvas border border-[var(--color-rule)] rounded-none px-3 py-2 text-sm font-mono font-bold uppercase placeholder:normal-case outline-none focus:border-ink disabled:bg-[var(--color-rule)] disabled:text-subInk"
                                                />
                                                {appliedPromo ? (
                                                    <button onClick={removePromo} className="bg-canvas text-error px-3 py-2 rounded-none font-mono font-bold text-xs border border-[var(--color-rule)] hover:bg-error hover:text-paper">
                                                        Remove
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={handleApplyCode} 
                                                        disabled={!promoCode || isValidating}
                                                        className="bg-ink text-paper px-4 py-2 rounded-none font-mono font-bold text-xs disabled:opacity-50"
                                                    >
                                                        {isValidating ? '...' : 'Apply'}
                                                    </button>
                                                )}
                                            </div>
                                             {/* Error Message */}
                                            {promoError && (
                                                <p className="text-error text-xs font-mono font-bold flex items-center gap-1 mt-1">
                                                    <AlertCircle size={12} /> {promoError}
                                                </p>
                                            )}
                                            {/* Valid Message */}
                                            {appliedPromo && (
                                                <div className="flex items-center gap-2 text-ink text-xs font-mono font-bold bg-[var(--color-rule)] p-2 rounded-none mt-2">
                                                    <Tag size={12} /> Code {appliedPromo.code} applied!
                                                </div>
                                            )}
                                         </div>

                                         {appliedPromo && (
                                            <div className="flex justify-between font-mono text-sm text-ink font-bold">
                                                <span>
                                                    {t('discount')}
                                                    {appliedPromo.discountType === 'percent' && <span className="ml-2 text-xs bg-[var(--color-rule)] px-1.5 py-0.5 align-middle">{appliedPromo.discountValue}%</span>}
                                                </span>
                                                <span>- {promoDiscount}.-</span>
                                            </div>
                                         )}

                                         {useFreeDrinkQuota && freeDrinkDiscount > 0 && (
                                             <div className="flex justify-between font-mono text-sm text-emerald-800 font-bold">
                                                 <span>สิทธิ์แก้วฟรี (10 แถม 1)</span>
                                                 <span>- {freeDrinkDiscount}.-</span>
                                             </div>
                                         )}

                                         {effectiveXhausDiscount > 0 && (
                                             <div className="flex justify-between font-mono text-sm text-amber-900 font-bold">
                                                 <span>ส่วนลดเหรียญ xhaus ({xhausToRedeem} pts)</span>
                                                 <span>- {effectiveXhausDiscount}.-</span>
                                             </div>
                                         )}

                                         <div className="flex justify-between font-mono font-bold text-xl pt-2 border-t border-[var(--color-rule)]">
                                             <span>{t('total')}</span>
                                             <span>{finalTotal}.-</span>
                                         </div>
                                    </div>
                                </div>

                                {/* PAYMENT METHODS SELECTOR & QR (Dieter Rams Tabular Layout) */}
                                <div className="bg-paper p-6 rounded-rams border border-[var(--color-rule)] space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-mono font-bold text-subInk uppercase">ชำระเงิน</h3>
                                        <span className="text-[10px] font-mono bg-ink text-paper px-2 py-0.5 rounded-none font-bold">฿{finalTotal}.-</span>
                                    </div>

                                    {/* Pay now vs pay at store */}
                                    {payAtStoreEnabled === true && finalTotal > 0 && (
                                        <div className="grid grid-cols-2 border border-[var(--color-rule)] rounded-rams overflow-hidden bg-canvas">
                                            <button
                                                type="button"
                                                onClick={() => setPayTiming('now')}
                                                className={`py-3 px-3 text-left transition-all ${payTiming === 'now' ? 'bg-ink text-paper' : 'text-subInk hover:text-ink'}`}
                                            >
                                                <span className="block text-sm font-bold leading-snug">โอนจ่ายตอนนี้</span>
                                                <span className="block text-[11px] leading-snug opacity-80 mt-1">แนบสลิป ร้านเริ่มทำทันที</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPayTiming('store')}
                                                className={`py-3 px-3 text-left transition-all border-l border-[var(--color-rule)] ${payTiming === 'store' ? 'bg-ink text-paper' : 'text-subInk hover:text-ink'}`}
                                            >
                                                <span className="block text-sm font-bold leading-snug">จ่ายที่ร้านตอนรับ</span>
                                                <span className="block text-[11px] leading-snug opacity-80 mt-1">ร้านโทรยืนยันก่อนเริ่มทำ</span>
                                            </button>
                                        </div>
                                    )}

                                    {isPayAtStore ? (
                                        <div className="bg-canvas p-4 rounded-rams border border-[var(--color-rule)] space-y-2 text-sm leading-relaxed">
                                            <p className="text-ink">
                                                {contactPhone?.trim() ? (
                                                    <>พนักงานจะโทรยืนยัน<span className="whitespace-nowrap">ออเดอร์</span>ที่เบอร์ <strong className="font-mono">{contactPhone.trim()}</strong> ก่อนเริ่มทำอาหาร</>
                                                ) : (
                                                    <>พนักงานจะโทรยืนยัน<span className="whitespace-nowrap">ออเดอร์</span>ตามเบอร์โทรศัพท์ที่ระบุก่อนเริ่มทำอาหาร</>
                                                )}
                                            </p>
                                            <p className="text-xs font-mono font-bold text-[var(--color-accent)]">
                                                * ต้องได้รับการยืนยันจากทางร้านก่อนเริ่มทำอาหารเสมอ หากยังไม่ได้รับการติดต่อ กรุณาโทรตามเบอร์ <a href="tel:0985284217" className="underline">098-528-4217</a>
                                            </p>
                                            <p className="text-subInk text-xs">
                                                ชำระ <strong className="font-mono text-ink">฿{finalTotal}.-</strong> ที่หน้าร้านตอนมารับ <span className="whitespace-nowrap">(เงินสด / สแกนจ่าย)</span> • หากติดต่อไม่ได้ ร้านขอสงวนสิทธิ์<span className="whitespace-nowrap">ยกเลิกออเดอร์</span>
                                            </p>
                                        </div>
                                    ) : (<>
                                    {/* Tab Navigation */}
                                    <div className="grid grid-cols-2 border border-[var(--color-rule)] rounded-rams overflow-hidden bg-canvas">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPaymentMethod('promptpay');
                                                if (slipFile) handleSlipFileChange(slipFile);
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
                                                if (slipFile) handleSlipFileChange(slipFile);
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
                                                <div className="flex justify-center bg-white p-3 rounded-rams border border-[var(--color-rule)] mb-3">
                                                    <LazyPromptPayQR
                                                        promptpayId={promptpayIdForQr}
                                                        amount={finalTotal}
                                                        size={176}
                                                        fallbackUrl={qrCodeUrl}
                                                        className="cursor-zoom-in"
                                                        onClick={() => setSelectedModalImage({ type: 'vector', promptpayId: promptpayIdForQr, amount: finalTotal, title: 'PromptPay QR (สแกนจ่าย)' })}
                                                    />
                                                </div>

                                                <div className="space-y-1.5 font-mono text-xs">
                                                    {promptpayName && (
                                                        <div className="flex justify-between items-center text-subInk">
                                                            <span>ชื่อบัญชี:</span>
                                                            <strong className="text-ink">{promptpayName}</strong>
                                                        </div>
                                                    )}
                                                    {promptpayId && (
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-subInk">พร้อมเพย์ ID:</span>
                                                            <div className="flex items-center gap-1.5">
                                                                <strong className="text-ink">{promptpayId}</strong>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => copyToClipboard(promptpayId, 'promptpay')}
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
                                                <div className="flex justify-center bg-white p-3 rounded-rams border border-[var(--color-rule)] mb-3">
                                                    {(truewalletQrUrl || qrCodeUrl) ? (
                                                        <img src={truewalletQrUrl || qrCodeUrl} alt="TrueMoney QR" className="w-44 h-44 object-contain cursor-zoom-in" onClick={() => setSelectedModalImage({ type: 'image', url: truewalletQrUrl || qrCodeUrl, title: 'TrueMoney QR' })} />
                                                    ) : (
                                                        <div className="w-44 h-44 flex items-center justify-center text-subInk font-mono text-xs">กำลังโหลด QR TrueMoney...</div>
                                                    )}
                                                </div>

                                                <div className="space-y-1.5 font-mono text-xs">
                                                    {truewalletName && (
                                                        <div className="flex justify-between items-center text-subInk">
                                                            <span>ชื่อบัญชี TrueMoney:</span>
                                                            <strong className="text-ink">{truewalletName}</strong>
                                                        </div>
                                                    )}
                                                    {truewalletPhone ? (
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-subInk">เบอร์ TrueMoney Wallet:</span>
                                                            <div className="flex items-center gap-1.5">
                                                                <strong className="text-ink font-bold">{truewalletPhone}</strong>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => copyToClipboard(truewalletPhone, 'truewallet')}
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
                                            • ต้องโอนชำระเงินเต็มจำนวน <strong>฿{finalTotal}.-</strong> เท่านั้น<br />
                                            • ระบบจะตรวจสลิปอัตโนมัติทันทีที่อัปโหลด
                                        </p>
                                    </div>

                                    {/* SLIP UPLOAD & AUTO-VERIFICATION STATUS */}
                                    <div className="space-y-2.5 pt-2 border-t border-[var(--color-rule)]">
                                        <label className="block text-xs font-mono font-bold text-subInk uppercase">
                                            {t('uploadSlip')} (หลักฐานการโอน)
                                        </label>

                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    handleSlipFileChange(e.target.files[0]);
                                                }
                                            }}
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
                                                    <span>สลิปผ่านการตรวจสอบอัตโนมัติเรียบร้อย ✓</span>
                                                </div>
                                                <div className="text-[11px] text-emerald-900/90 pl-5 space-y-0.5">
                                                    <p>ผู้โอน: <strong>{typeof slipVerifyResult.senderName === 'object' ? (slipVerifyResult.senderName?.th || slipVerifyResult.senderName?.en || 'ไม่ระบุ') : (slipVerifyResult.senderName || 'ไม่ระบุ')}</strong></p>
                                                    <p>ยอดโอน: <strong>฿{typeof slipVerifyResult.amountInSlip === 'number' ? slipVerifyResult.amountInSlip : Number(slipVerifyResult.amountInSlip || 0)}.-</strong> ({typeof slipVerifyResult.bankName === 'object' ? (slipVerifyResult.bankName?.th || slipVerifyResult.bankName?.en || 'ธนาคาร') : (slipVerifyResult.bankName || 'ธนาคาร')})</p>
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
                                                        ✓ เปิดโหมดส่งให้เจ้าหน้าที่ตรวจสอบแล้ว คุณสามารถกดสั่งอาหารได้
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    </>)}

                                    <label className="flex items-start gap-3 mt-2 py-3 min-h-12 cursor-pointer border-t border-[var(--color-rule)]">
                                        <input type="checkbox" checked={isAgreed} onChange={e => setIsAgreed(e.target.checked)} className="accent-ink w-5 h-5 mt-1 shrink-0" />
                                        <span className="text-base text-ink leading-relaxed">
                                            {isPayAtStore
                                                ? 'ฉันยืนยันการสั่งอาหารและรับทราบว่าพนักงานจะโทรยืนยันออเดอร์ก่อนเริ่มทำอาหาร'
                                                : 'ฉันตรวจสอบรายการอาหารและเวลารับออเดอร์ถูกต้องแล้ว'}
                                        </span>
                                    </label>
                                </div>

                                {submitError && (
                                    <p role="alert" className="text-base font-bold text-error leading-relaxed border border-error/40 bg-paper p-3">{submitError}</p>
                                )}
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={submitting || !isContactValid || !isAgreed || !pickupTime || (!isPayAtStore && ((finalTotal > 0 && !slipFile) || isVerifyingSlip || (easySlipEnabled && finalTotal > 0 && !slipVerifyResult?.verified && !allowManualFallback)))}
                                    className="w-full bg-brand text-cream border border-ink py-4 rounded-none font-bold text-lg hover:bg-paper hover:text-ink disabled:bg-canvas disabled:text-subInk disabled:border-[var(--color-rule)] disabled:cursor-not-allowed transition-all mt-4 font-mono uppercase tracking-widest flex items-center justify-center gap-2"
                                >
                                    {submitting ? t('processing') : `${t('confirmOrder')} ${finalTotal}.-`}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* QR Zoom Modal */}
            {selectedModalImage && (
                <div 
                    className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4 select-none backdrop-blur-xs animate-in fade-in duration-150"
                    onClick={() => setSelectedModalImage(null)}
                >
                    <div 
                        className="bg-white p-5 rounded-2xl max-w-sm w-full flex flex-col items-center gap-3 shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-full flex justify-between items-center border-b border-[var(--color-rule)] pb-2">
                            <span className="font-bold text-xs font-mono uppercase text-ink">{selectedModalImage.title}</span>
                            <button 
                                onClick={() => setSelectedModalImage(null)}
                                className="p-1 rounded-md hover:bg-paper text-subInk hover:text-ink transition-colors cursor-pointer"
                            >
                                <CloseIcon size={16} />
                            </button>
                        </div>
                        <div className="p-3 bg-white border border-[var(--color-rule)] rounded-xl my-2 flex justify-center items-center shadow-inner">
                            {selectedModalImage.type === 'vector' ? (
                                <LazyPromptPayQR promptpayId={selectedModalImage.promptpayId} amount={selectedModalImage.amount} size={240} />
                            ) : (
                                <img src={selectedModalImage.url} alt="QR Zoom" className="max-w-[240px] max-h-[300px] w-auto h-auto object-contain" />
                            )}
                        </div>
                        <div className="text-center font-mono space-y-1">
                            <span className="text-xs font-bold text-ink">ยอดชำระ: ฿{finalTotal}.-</span>
                            <p className="text-[10px] text-subInk">บันทึกรูปหรือสแกนผ่านแอปธนาคารได้ทันที</p>
                        </div>
                        <button 
                            onClick={() => setSelectedModalImage(null)}
                            className="w-full py-2.5 bg-ink text-paper text-xs font-mono font-bold rounded-rams hover:bg-subInk transition-colors cursor-pointer"
                        >
                            ปิดหน้าต่าง
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}