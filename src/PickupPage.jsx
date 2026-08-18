import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutGrid, List as ListIcon, Search, Check, ArrowRight, ArrowLeft, Clock } from 'lucide-react'
import { useLanguage } from './context/LanguageContext'
import { getThaiDate, toThaiISO } from './utils/timeUtils'

import MenuCard from './components/shared/MenuCard'
import ViewToggle from './components/shared/ViewToggle'
import OptionSelectionModal from './components/shared/OptionSelectionModal'
import { usePromotion } from './hooks/usePromotion'
import { useMenuData } from './hooks/useMenuData' // NEW
import { useOrderSubmission } from './hooks/useOrderSubmission' // NEW
import { useServiceGuard } from './hooks/useServiceGuard'
import { safeTimestampUrl } from './utils/urlHelper'
import { Tag, AlertCircle, Crown, Coffee } from 'lucide-react'

// --- Main Page ---
export default function PickupPage() {
    const { t } = useLanguage()
    const navigate = useNavigate()
    const isChecking = useServiceGuard('shop_mode_pickup')
    const [viewMode, setViewMode] = useState('grid')
    const [step, setStep] = useState(1)
    const [menuItems, setMenuItems] = useState([])
    const [cart, setCart] = useState([])
    const [searchTerm, setSearchTerm] = useState('')
    const [activeCategory, setActiveCategory] = useState('All')
    const [selectedItem, setSelectedItem] = useState(null) 

    // CRM Member State
    const [memberProfile, setMemberProfile] = useState(null)
    const [tierDetails, setTierDetails] = useState({
        current_tier: 'Haus Common',
        multiplier: 1.00,
        is_in_grace_period: false
    })

    // Checkout Form State
    const [pickupTime, setPickupTime] = useState('') // Now acts as the selected value for Dropdown
    const [contactName, setContactName] = useState('')
    const [contactPhone, setContactPhone] = useState('')
    const [specialRequest, setSpecialRequest] = useState('')
    const [isAgreed, setIsAgreed] = useState(false)
    const [slipFile, setSlipFile] = useState(null)
    const [submitting, setSubmitting] = useState(false)

    // Settings State
    const [qrCodeUrl, setQrCodeUrl] = useState(null)
    const [policyNote, setPolicyNote] = useState('')
    const [minAdvanceHours, setMinAdvanceHours] = useState(1) 
    const [pickupDate, setPickupDate] = useState('today') // 'today' | 'tomorrow'
    const [openingTime, setOpeningTime] = useState('10:00')
    const [closingTime, setClosingTime] = useState('20:00')
    const [crmBaseSpendAmount, setCrmBaseSpendAmount] = useState(100)

    // --- Hooks ---
    const { menuItems: allMenuItems, categories, loading: menuLoading } = useMenuData()
    const { submitOrder, isSubmitting } = useOrderSubmission()

    // Filter Menu for Pickup
    useEffect(() => {
        if (allMenuItems) {
            setMenuItems(allMenuItems.filter(item => item.is_pickup_available !== false))
        }
    }, [allMenuItems])

    // Load Settings Only (Menu handled by hook)
    useEffect(() => {
        const fetchSettings = async () => {
            // 2. Settings
            const { data: settings } = await supabase.from('app_settings').select('*')
            if (settings) {
                const map = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {})
                if (map.payment_qr_url) setQrCodeUrl(safeTimestampUrl(map.payment_qr_url))
                if (map.policy_pickup) setPolicyNote(map.policy_pickup)
                if (map.pickup_min_advance_hours) setMinAdvanceHours(Number(map.pickup_min_advance_hours))
                if (map.opening_time) setOpeningTime(map.opening_time)
                if (map.closing_time) setClosingTime(map.closing_time)
                if (map.crm_base_spend_amount) setCrmBaseSpendAmount(parseFloat(map.crm_base_spend_amount) || 100)
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
    }, [])

    // --- Helpers for Time Slots ---
    const generateTimeSlots = () => {
        const slots = []
        const [openHour, openMin] = openingTime.split(':').map(Number)
        const [closeHour, closeMin] = closingTime.split(':').map(Number)
        
        let current = new Date()
        current.setHours(openHour, openMin, 0, 0)
        
        const end = new Date()
        end.setHours(closeHour, closeMin, 0, 0)

        // Generate 15 min intervals
        while (current <= end) {
            const timeStr = current.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
            slots.push(timeStr)
            current.setMinutes(current.getMinutes() + 15)
        }
        return slots
    }

    const availableTimeSlots = () => {
        const allSlots = generateTimeSlots()
        const now = new Date()
        
        // Min Advance time from NOW
        const minTime = new Date(now.getTime() + minAdvanceHours * 60 * 60 * 1000)

        return allSlots.filter(slot => {
            if (pickupDate === 'tomorrow') return true // All slots available tomorrow (within open hours)

            // If Today, checking against minAdvance
            const [h, m] = slot.split(':').map(Number)
            const slotTime = new Date()
            slotTime.setHours(h, m, 0, 0)
            
            return slotTime > minTime
        })
    }

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

     // Calculate Final Total
     const discountAmount = appliedPromo?.discountAmount || 0
     const finalTotal = Math.max(0, cartTotal - discountAmount)
 
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

    const filteredMenu = menuItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesCategory = activeCategory === 'All'
            ? true
            : (item.category === activeCategory || item.category_id === categories.find(c => c.name === activeCategory)?.id)
        return matchesSearch && matchesCategory
    })

    const handleSubmit = async () => {
        if (submitting || isSubmitting) return
        if (!contactName || !contactPhone) return alert(t('fillContact'))
        if (!isAgreed) return alert(t('agreeTerms'))
        if (!slipFile) return alert(t('uploadSlipDesc'))
        if (!pickupTime) return alert(t('selectPickupTime'))

        setSubmitting(true)
        try {
            // Prepare Payload
            const dateBasis = new Date()
            if (pickupDate === 'tomorrow') {
                dateBasis.setDate(dateBasis.getDate() + 1)
            }
            const dateStr = dateBasis.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }) 
            const bookingDateTime = toThaiISO(dateStr, pickupTime)
            const customerNoteContent = `Pickup Order` + (specialRequest ? `\nNote: ${specialRequest}` : '')

            const bookingPayload = {
                booking_type: 'pickup',
                status: 'pending',
                booking_time: bookingDateTime,
                pickup_contact_name: contactName,
                pickup_contact_phone: contactPhone,
                customer_note: customerNoteContent,
                promotion_code_id: appliedPromo?.id || null, 
                discount_amount: appliedPromo?.discountAmount || 0,
                total_amount: finalTotal,
                deposit_amount: finalTotal, // 100% deposit for pickup
                tracking_token: crypto.randomUUID(),
                payment_slip_url: null // Will be handled by hook if slipFile present
            }

            const orderItemsPayload = cart.map(item => ({
                menu_item_id: item.id,
                quantity: item.qty,
                price_at_time: item.totalPricePerUnit,
                selected_options: item.optionsSummary 
            }))
            
            // Use Line Token if not logged in (logic inside component for token fetch)
            const { data: { user } } = await supabase.auth.getUser()
            const lineIdToken = !user && (window.liff?.isLoggedIn() ? window.liff.getIDToken() : null)

            const result = await submitOrder({
                bookingPayload,
                orderItemsPayload,
                slipFile,
                lineIdToken
            })

            if (result.success) {
                alert(t('confirmOrder') + ' Success!')
                if (result.trackingToken) {
                    window.location.replace(`/tracking/${result.trackingToken}`)
                } else {
                    navigate('/', { replace: true })
                }
            } else {
                alert('Error: ' + result.error)
            }
        } finally {
            setSubmitting(false)
        }
    }

    if (isChecking) {
        return (
            <div className="min-h-screen bg-canvas flex flex-col items-center justify-center text-ink font-mono text-xs uppercase tracking-widest gap-3 select-none">
                <div className="w-6 h-6 rounded-full border-2 border-zinc-300 border-t-zinc-800 animate-spin" />
                <span>CHECKING STATUS...</span>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-canvas flex flex-col p-6 font-sans text-ink">
            {/* Nav */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-[var(--color-rule)]">
                <button onClick={() => step === 1 ? navigate('/') : setStep(1)} className="p-2 hover:bg-paper rounded-rams transition-colors border border-[var(--color-rule)]">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex gap-1">
                    <div className={`h-1 w-8 transition-all ${step >= 1 ? 'bg-ink' : 'bg-[var(--color-rule)]'}`} />
                    <div className={`h-1 w-8 transition-all ${step >= 2 ? 'bg-ink' : 'bg-[var(--color-rule)]'}`} />
                </div>
            </div>

            <div className="flex-1 max-w-lg mx-auto w-full relative flex flex-col">
                <AnimatePresence mode="wait">

                    {/* Step 1: Menu */}
                    {step === 1 && (
                        <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col h-full">
                            <div className="mb-6">
                                <h1 className="text-3xl font-display font-bold tracking-tight">{t('orderFood')}</h1>
                                <p className="text-subInk text-sm uppercase tracking-widest font-mono">{t('pickup')}</p>
                            </div>

                            <div className="flex justify-between items-end mb-4 shrink-0">
                                <div className="relative flex-1 mr-4">
                                    <Search className="absolute left-3 top-2.5 text-subInk w-4 h-4" />
                                    <input type="text" placeholder={t('searchMenu')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-paper border border-[var(--color-rule)] pl-9 pr-4 py-2 rounded-rams text-sm focus:outline-none focus:border-ink transition-colors" />
                                </div>
                                <ViewToggle mode={viewMode} setMode={setViewMode} />
                            </div>

                            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide mb-2 border-b border-[var(--color-rule)]">
                                <button onClick={() => setActiveCategory('All')} className={`whitespace-nowrap px-4 py-2 rounded-none text-xs font-mono transition-all border ${activeCategory === 'All' ? 'bg-ink text-paper border-ink' : 'bg-paper text-subInk border-[var(--color-rule)] hover:border-ink'}`}>All</button>
                                {categories.map(cat => (
                                    <button key={cat.id} onClick={() => setActiveCategory(cat.name)} className={`whitespace-nowrap px-4 py-2 rounded-none text-xs font-mono transition-all border ${activeCategory === cat.name ? 'bg-ink text-paper border-ink' : 'bg-paper text-subInk border-[var(--color-rule)] hover:border-ink'}`}>{cat.name}</button>
                                ))}
                            </div>

                            <div className="flex-1 overflow-y-auto pr-1 pb-32">
                                <div className={`grid gap-3 ${viewMode === 'grid' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                    {filteredMenu.map(item => (
                                        <MenuCard key={item.id} item={item} mode={viewMode} onAdd={() => handleItemClick(item)} onRemove={() => { }} qty={0} t={t} />
                                    ))}
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
                                            <button onClick={() => setStep(2)} className="bg-brand text-ink border border-ink px-8 py-3 rounded-none font-bold text-sm flex items-center gap-2 hover:bg-paper transition-all active:scale-95">
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
                                    <h3 className="text-xs font-mono text-subInk uppercase">{t('contactInfo')}</h3>
                                    <input type="text" placeholder={t('yourName')} value={contactName} onChange={e => setContactName(e.target.value)} className="w-full bg-transparent border-b border-[var(--color-rule)] py-2 focus:border-ink outline-none transition-colors" />
                                    <input type="tel" placeholder={t('phoneNumber')} value={contactPhone} onChange={e => setContactPhone(e.target.value)} className="w-full bg-transparent border-b border-[var(--color-rule)] py-2 focus:border-ink outline-none transition-colors" />
                                </div>

                                <div className="bg-paper p-6 border border-[var(--color-rule)] rounded-rams">
                                    <label className="text-xs font-mono text-subInk uppercase block mb-3">{t('specialRequest')}</label>
                                    <textarea value={specialRequest} onChange={e => setSpecialRequest(e.target.value)} placeholder={t('specialRequestPlaceholder')} className="w-full bg-transparent border-b border-[var(--color-rule)] py-2 focus:border-ink outline-none resize-none text-sm transition-colors" rows={2} />
                                </div>

                                {/* Pickup Time Dropdown */}
                                <div className="bg-paper p-6 border border-[var(--color-rule)] rounded-rams">
                                    <label className="text-xs font-mono text-subInk uppercase block mb-3">{t('pickupTime')}</label>
                                    
                                    <div className="flex border border-[var(--color-rule)] mb-4 rounded-rams overflow-hidden">
                                        <button onClick={() => { setPickupDate('today'); setPickupTime(''); }} className={`flex-1 py-2 text-sm font-bold transition-all ${pickupDate === 'today' ? 'bg-ink text-paper' : 'bg-transparent text-subInk hover:bg-canvas'}`}>{t('today')}</button>
                                        <div className="w-px bg-[var(--color-rule)]"></div>
                                        <button onClick={() => { setPickupDate('tomorrow'); setPickupTime(''); }} className={`flex-1 py-2 text-sm font-bold transition-all ${pickupDate === 'tomorrow' ? 'bg-ink text-paper' : 'bg-transparent text-subInk hover:bg-canvas'}`}>{t('tomorrow')}</button>
                                    </div>

                                    <div className="relative">
                                        <Clock className="absolute left-3 top-3 text-subInk w-5 h-5 pointer-events-none" />
                                        <select 
                                            value={pickupTime} 
                                            onChange={(e) => setPickupTime(e.target.value)} 
                                            className="w-full bg-canvas border border-[var(--color-rule)] text-ink font-mono font-bold p-3 pl-10 rounded-rams outline-none focus:border-ink appearance-none transition-colors"
                                        >
                                            <option value="" disabled selected>{t('selectPickupTime')}</option>
                                            {availableTimeSlots().length === 0 ? (
                                                <option disabled>{t('noValidTimes')}</option>
                                            ) : (
                                                availableTimeSlots().map(slot => (
                                                    <option key={slot} value={slot}>{slot}</option>
                                                ))
                                            )}
                                        </select>
                                        {/* Custom chevron */}
                                        <div className="absolute right-4 top-4 w-2 h-2 border-r-2 border-b-2 border-subInk rotate-45 pointer-events-none"></div>
                                    </div>
                                 </div>

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
                                                <span className="text-xs font-bold text-emerald-700">+{Math.floor((finalTotal / (crmBaseSpendAmount || 100)) * (tierDetails.multiplier || 1.0))} xhaus</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-paper p-6 border border-[var(--color-rule)] rounded-rams">
                                    <h3 className="text-xs font-mono text-subInk uppercase mb-3">{t('orderSummary')}</h3>
                                    {cart.map((item, index) => (
                                        <div key={index} className="flex justify-between text-sm mb-3 border-b border-[var(--color-rule)] pb-2 last:border-0 last:pb-0">
                                            <div>
                                                <div className="text-ink font-bold">{item.name} <span className="text-subInk text-xs font-mono">x{item.qty}</span></div>
                                                {item.optionsSummary?.map((opt, i) => <div key={i} className="text-xs font-mono text-subInk">+ {opt.name} ({opt.price})</div>)}
                                                {item.specialRequest && <div className="text-xs font-mono text-brand">{t('note')}: {item.specialRequest}</div>}
                                            </div>
                                            <span className="font-bold font-mono text-ink">{item.totalPricePerUnit * item.qty}.-</span>
                                        </div>
                                    ))}
                                    <div className="border-t border-[var(--color-rule)] mt-2 pt-2 space-y-1">
                                         <div className="flex justify-between font-mono text-base text-subInk"><span>{t('subtotal')}</span><span>{cartTotal}.-</span></div>
                                         
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
                                            <div className="flex justify-between font-mono text-base text-ink font-bold">
                                                <span>
                                                    {t('discount')}
                                                    {appliedPromo.discountType === 'percent' && <span className="ml-2 text-xs bg-[var(--color-rule)] px-1.5 py-0.5 align-middle">{appliedPromo.discountValue}%</span>}
                                                </span>
                                                <span>- {discountAmount}.-</span>
                                            </div>
                                         )}

                                         <div className="flex justify-between font-mono font-bold text-xl pt-2 border-t border-[var(--color-rule)]">
                                            <span>{t('total')}</span>
                                            <span>{finalTotal}.-</span>
                                         </div>
                                    </div>
                                </div>

                                <div className="bg-canvas p-4 rounded-rams border border-[var(--color-rule)] text-ink text-xs leading-relaxed">
                                    <p className="font-mono font-bold mb-2 text-sm uppercase">100% Payment Required</p>
                                    {qrCodeUrl && <div className="mb-4 flex justify-center bg-paper p-2 border border-[var(--color-rule)]"><img src={qrCodeUrl} alt="Payment QR" className="w-48 h-auto object-contain mix-blend-multiply" /></div>}
                                    <p className="opacity-90 font-medium text-xs mb-3 border-b border-[var(--color-rule)] pb-3 leading-relaxed">
                                        • ต้องโอนชำระเงินเต็มจำนวน 100% เท่านั้น<br/>
                                        • ไม่สามารถยกเลิกออเดอร์และขอคืนเงินได้ทุกกรณีหลังยืนยันการชำระเงิน
                                    </p>
                                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                        <input type="checkbox" checked={isAgreed} onChange={e => setIsAgreed(e.target.checked)} className="accent-ink w-4 h-4" />
                                        <span className="font-mono font-bold">{t('agreeTerms')}</span>
                                    </label>
                                </div>

                                <div>
                                    <label className="block text-xs font-mono font-bold text-subInk uppercase mb-2">{t('uploadSlip')}</label>
                                    <input type="file" accept="image/*" onChange={e => setSlipFile(e.target.files[0])} className="block w-full text-sm text-subInk file:mr-4 file:py-2 file:px-4 file:rounded-none file:border-0 file:bg-ink file:text-paper hover:file:bg-canvas hover:file:text-ink hover:file:border hover:file:border-ink transition-colors cursor-pointer" />
                                </div>

                                <button onClick={handleSubmit} disabled={submitting || !isAgreed || !pickupTime || !slipFile} className="w-full bg-brand text-ink border border-ink py-4 rounded-none font-bold text-lg hover:bg-paper disabled:bg-canvas disabled:text-subInk disabled:border-[var(--color-rule)] disabled:cursor-not-allowed transition-all mt-4 font-mono uppercase tracking-widest">
                                    {submitting ? t('processing') : `${t('confirmOrder')} ${finalTotal}.-`}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}