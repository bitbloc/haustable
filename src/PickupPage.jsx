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
import { usePromotion } from './hooks/usePromotion' // NEW
import { Tag, AlertCircle } from 'lucide-react'

// --- Main Page ---
export default function PickupPage() {
    const { t } = useLanguage()
    const navigate = useNavigate()
    const [viewMode, setViewMode] = useState('grid')
    const [step, setStep] = useState(1)
    const [menuItems, setMenuItems] = useState([])
    const [categories, setCategories] = useState([]) 
    const [cart, setCart] = useState([])
    const [searchTerm, setSearchTerm] = useState('')
    const [activeCategory, setActiveCategory] = useState('All')
    const [selectedItem, setSelectedItem] = useState(null) 

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

    // Load Menu & Settings
    useEffect(() => {
        const fetchMenu = async () => {
            // 1. Menu & Categories
            const { data: menuRaw } = await supabase.from('menu_items').select('*, menu_item_options(*, option_groups(*, option_choices(*)))').order('category')
            const { data: c } = await supabase.from('menu_categories').select('*').order('display_order')
            setCategories(c || [])

            // Sort Logic
            const categoryOrder = (c || []).reduce((acc, cat, idx) => {
                acc[cat.name] = cat.display_order ?? idx
                return acc
            }, {})

            const sortedMenu = (menuRaw || [])
                .filter(item => item.is_pickup_available !== false) 
                .sort((a, b) => {
                    if (a.is_recommended !== b.is_recommended) return (b.is_recommended ? 1 : 0) - (a.is_recommended ? 1 : 0)
                    if (a.is_available !== b.is_available) return (b.is_available ? 1 : 0) - (a.is_available ? 1 : 0)
                    const orderA = categoryOrder[a.category] ?? 999
                    const orderB = categoryOrder[b.category] ?? 999
                    if (orderA !== orderB) return orderA - orderB
                    return a.name.localeCompare(b.name)
                })

            setMenuItems(sortedMenu)

            // 2. Settings
            const { data: settings } = await supabase.from('app_settings').select('*')
            if (settings) {
                const map = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {})
                if (map.payment_qr_url) setQrCodeUrl(`${map.payment_qr_url}?t=${Date.now()}`)
                if (map.policy_pickup) setPolicyNote(map.policy_pickup)
                if (map.pickup_min_advance_hours) setMinAdvanceHours(Number(map.pickup_min_advance_hours))
                if (map.opening_time) setOpeningTime(map.opening_time)
                if (map.closing_time) setClosingTime(map.closing_time)
            }

            // 3. User
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                setContactName(user.user_metadata.full_name || '')
                const { data: profile } = await supabase.from('profiles').select('phone_number').eq('id', user.id).single()
                if (profile?.phone_number) setContactPhone(profile.phone_number)
            }
        }
        fetchMenu()
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
        if (!contactName || !contactPhone) return alert(t('fillContact'))
        if (!isAgreed) return alert(t('agreeTerms'))
        if (!slipFile) return alert(t('uploadSlipDesc'))
        if (!pickupTime) return alert(t('selectPickupTime'))

        setSubmitting(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()

            const dateBasis = new Date()
            if (pickupDate === 'tomorrow') {
                dateBasis.setDate(dateBasis.getDate() + 1)
            }
            const dateStr = dateBasis.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }) 
            const bookingDateTime = toThaiISO(dateStr, pickupTime)

            // Submit
            const fileExt = slipFile.name.split('.').pop()
            const fileName = `pickup_${Math.random()}.${fileExt}`
            const { error: uploadError } = await supabase.storage.from('slips').upload(fileName, slipFile)
            if (uploadError) throw uploadError

            const customerNoteContent = `Pickup Order` + (specialRequest ? `\nNote: ${specialRequest}` : '')
            
            // Prepare Payload parts
            const bookingPayload = {
                booking_type: 'pickup',
                status: 'pending',
                booking_time: bookingDateTime,
                pickup_contact_name: contactName,
                pickup_contact_phone: contactPhone,
                customer_note: customerNoteContent,
                // Promos
                promotion_code_id: appliedPromo?.id || null, 
                discount_amount: appliedPromo?.discountAmount || 0,
                total_amount: finalTotal // CORRECTED: Was missing or wrong scope? It was hardcoded or cartTotal before.
            }
            const orderItemsPayload = cart.map(item => ({
                menu_item_id: item.id,
                quantity: item.qty,
                price_at_time: item.totalPricePerUnit,
                selected_options: item.optionsSummary 
            }))


            // Check Auth (Standard vs LINE)
            // FIX: Prioritize Supabase Session (User) if available.
            // (User fetched above at line 176)
            
            // Only use Line Token if NO Supabase User.
            const lineIdToken = !user && (window.liff?.isLoggedIn() ? window.liff.getIDToken() : null)

            let trackingToken = null

            if (user) {
                // --- STANDARD USER FLOW (Direct Insert) ---
                console.log("Submitting Pickup as Authenticated User:", user.id)
                const { data: bookingData, error: bookingError } = await supabase.from('bookings').insert({
                    ...bookingPayload,
                    user_id: user.id
                }).select().single()

                if (bookingError) throw bookingError
                trackingToken = bookingData?.tracking_token

                if (orderItemsPayload.length > 0) {
                     const items = orderItemsPayload.map(item => ({
                        booking_id: bookingData.id,
                        ...item
                    }))
                    await supabase.from('order_items').insert(items)
                }

            } else if (lineIdToken) {
                 // --- LINE USER FLOW (Edge Function) - FALLBACK ---
                 console.warn("Submitting Pickup via Edge Function (No Supabase Session)...")
                 const { data, error } = await supabase.functions.invoke('manage-booking', {
                    body: { 
                        action: 'create_booking', 
                        idToken: lineIdToken,
                        bookingData: { ...bookingPayload, orderItems: orderItemsPayload }
                    }
                })

                if (error) throw error
                if (!data.success) throw new Error(data.error || 'Booking Failed')
                trackingToken = data.data?.tracking_token

            } else {
                throw new Error("Please Login before ordering.")
            }

            alert(t('confirmOrder') + ' Success!')
            
            if (trackingToken) {
                window.location.href = `/tracking/${trackingToken}`
            } else {
                navigate('/')
            }

        } catch (error) {
            alert('Error: ' + error.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#F9F9F9] flex flex-col p-6 font-sans text-black">
            {/* Nav */}
            <div className="flex justify-between items-center mb-6">
                <button onClick={() => step === 1 ? navigate('/') : setStep(1)} className="p-2 hover:bg-white rounded-full transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex gap-1">
                    <div className={`h-1 w-8 rounded-full transition-all ${step >= 1 ? 'bg-black' : 'bg-gray-200'}`} />
                    <div className={`h-1 w-8 rounded-full transition-all ${step >= 2 ? 'bg-black' : 'bg-gray-200'}`} />
                </div>
            </div>

            <div className="flex-1 max-w-lg mx-auto w-full relative flex flex-col">
                <AnimatePresence mode="wait">

                    {/* Step 1: Menu */}
                    {step === 1 && (
                        <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col h-full">
                            <div className="mb-6">
                                <h1 className="text-3xl font-bold tracking-tight">{t('orderFood')}</h1>
                                <p className="text-gray-500 text-sm uppercase tracking-widest">{t('pickup')}</p>
                            </div>

                            <div className="flex justify-between items-end mb-4 shrink-0">
                                <div className="relative flex-1 mr-4">
                                    <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                                    <input type="text" placeholder={t('searchMenu')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-white border border-gray-200 pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:border-black" />
                                </div>
                                <ViewToggle mode={viewMode} setMode={setViewMode} />
                            </div>

                            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide mb-2">
                                <button onClick={() => setActiveCategory('All')} className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all border ${activeCategory === 'All' ? 'bg-black text-white border-black shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>All</button>
                                {categories.map(cat => (
                                    <button key={cat.id} onClick={() => setActiveCategory(cat.name)} className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all border ${activeCategory === cat.name ? 'bg-black text-white border-black shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>{cat.name}</button>
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
                                    <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-200 p-4 pb-8 z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.1)]">
                                        <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
                                            <div className="flex flex-col">
                                                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">{t('cartTotal')}</div>
                                                <div className="flex items-end gap-2">
                                                    <span className="font-bold text-sm bg-black text-white px-2 py-0.5 rounded-full">{cart.reduce((a, b) => a + b.qty, 0)} {t('itemsCount')}</span>
                                                    <span className="font-mono font-bold text-2xl leading-none">฿{cartTotal}</span>
                                                </div>
                                            </div>
                                            <button onClick={() => setStep(2)} className="bg-black text-[#DFFF00] px-8 py-3 rounded-full font-bold text-sm flex items-center gap-2 hover:bg-gray-900 transition-transform active:scale-95 shadow-lg">
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
                                <h1 className="text-3xl font-bold tracking-tight">{t('confirmOrder')}</h1>
                                <p className="text-gray-500 text-sm uppercase tracking-widest">{t('checkout')}</p>
                            </div>

                            <div className="space-y-4 pb-20">
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase">{t('contactInfo')}</h3>
                                    <input type="text" placeholder={t('yourName')} value={contactName} onChange={e => setContactName(e.target.value)} className="w-full bg-gray-50 border-b border-gray-200 py-2 focus:border-black outline-none" />
                                    <input type="tel" placeholder={t('phoneNumber')} value={contactPhone} onChange={e => setContactPhone(e.target.value)} className="w-full bg-gray-50 border-b border-gray-200 py-2 focus:border-black outline-none" />
                                </div>

                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                    <label className="text-xs font-bold text-gray-400 uppercase block mb-3">{t('specialRequest')}</label>
                                    <textarea value={specialRequest} onChange={e => setSpecialRequest(e.target.value)} placeholder={t('specialRequestPlaceholder')} className="w-full bg-transparent border-b border-gray-200 py-2 focus:border-black outline-none resize-none text-sm" rows={2} />
                                </div>

                                {/* Pickup Time Dropdown */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                    <label className="text-xs font-bold text-gray-400 uppercase block mb-3">{t('pickupTime')}</label>
                                    
                                    <div className="flex bg-gray-100 rounded-lg p-1 mb-4">
                                        <button onClick={() => { setPickupDate('today'); setPickupTime(''); }} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${pickupDate === 'today' ? 'bg-white shadow text-black' : 'text-gray-400'}`}>{t('today')}</button>
                                        <button onClick={() => { setPickupDate('tomorrow'); setPickupTime(''); }} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${pickupDate === 'tomorrow' ? 'bg-white shadow text-black' : 'text-gray-400'}`}>{t('tomorrow')}</button>
                                    </div>

                                    <div className="relative">
                                        <Clock className="absolute left-3 top-3 text-gray-400 w-5 h-5 pointer-events-none" />
                                        <select 
                                            value={pickupTime} 
                                            onChange={(e) => setPickupTime(e.target.value)} 
                                            className="w-full bg-gray-50 border border-gray-200 text-black font-bold p-3 pl-10 rounded-xl outline-none focus:border-black appearance-none"
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
                                        <div className="absolute right-4 top-4 w-2 h-2 border-r-2 border-b-2 border-gray-400 rotate-45 pointer-events-none"></div>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2">*{t('advanceBooking')}: {minAdvanceHours} {t('hours')}.</p>
                                </div>

                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">{t('orderSummary')}</h3>
                                    {cart.map((item, index) => (
                                        <div key={index} className="flex justify-between text-sm mb-3 border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                                            <div>
                                                <div className="text-gray-900 font-bold">{item.name} <span className="text-gray-400 text-xs">x{item.qty}</span></div>
                                                {item.optionsSummary?.map((opt, i) => <div key={i} className="text-xs text-gray-500">+ {opt.name} ({opt.price})</div>)}
                                                {item.specialRequest && <div className="text-xs text-brand">{t('note')}: {item.specialRequest}</div>}
                                            </div>
                                            <span className="font-bold font-mono text-gray-900">{item.totalPricePerUnit * item.qty}.-</span>
                                        </div>
                                    ))}
                                    <div className="border-t border-gray-100 mt-2 pt-2 space-y-1">
                                         <div className="flex justify-between text-base text-gray-500"><span>{t('subtotal')}</span><span>{cartTotal}.-</span></div>
                                         
                                         {/* PROMO INPUT */}
                                         <div className="py-2">
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text" 
                                                    placeholder="Promo Code" 
                                                    value={promoCode}
                                                    onChange={e => setPromoCode(e.target.value.toUpperCase())}
                                                    disabled={!!appliedPromo}
                                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold uppercase placeholder:normal-case outline-none focus:border-black disabled:bg-gray-100 disabled:text-gray-400"
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
                                                <p className="text-red-500 text-xs font-bold flex items-center gap-1 mt-1">
                                                    <AlertCircle size={12} /> {promoError}
                                                </p>
                                            )}
                                            {/* Valid Message */}
                                            {appliedPromo && (
                                                <div className="flex items-center gap-2 text-green-600 text-xs font-bold bg-green-50 p-2 rounded border border-green-100 mt-2">
                                                    <Tag size={12} /> Code {appliedPromo.code} applied!
                                                </div>
                                            )}
                                         </div>

                                         {appliedPromo && (
                                            <div className="flex justify-between text-base text-green-600 font-bold">
                                                <span>
                                                    {t('discount')}
                                                    {appliedPromo.discountType === 'percent' && <span className="ml-2 text-xs bg-green-100 px-1.5 py-0.5 rounded-md align-middle">{appliedPromo.discountValue}%</span>}
                                                </span>
                                                <span>- {discountAmount}.-</span>
                                            </div>
                                         )}

                                         <div className="flex justify-between font-bold text-xl pt-2 border-t border-gray-100">
                                            <span>{t('total')}</span>
                                            <span>{finalTotal}.-</span>
                                         </div>
                                    </div>
                                </div>

                                <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-red-800 text-xs leading-relaxed">
                                    <p className="font-bold mb-2 text-sm">{t('paymentRequired')}</p>
                                    {qrCodeUrl && <div className="mb-4 flex justify-center bg-white p-2 rounded-lg border border-red-200"><img src={qrCodeUrl} alt="Payment QR" className="w-48 h-auto object-contain" /></div>}
                                    <p className="opacity-75 whitespace-pre-line mb-3 border-b border-red-200/50 pb-3">{policyNote || t('minCondition')}</p>
                                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                        <input type="checkbox" checked={isAgreed} onChange={e => setIsAgreed(e.target.checked)} className="accent-black w-4 h-4" />
                                        <span className="font-bold">{t('agreeTerms')}</span>
                                    </label>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('uploadSlip')}</label>
                                    <input type="file" accept="image/*" onChange={e => setSlipFile(e.target.files[0])} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-black file:text-white hover:file:bg-gray-800 transition-colors cursor-pointer" />
                                </div>

                                <button onClick={handleSubmit} disabled={submitting || !isAgreed || !pickupTime || !slipFile} className="w-full bg-[#DFFF00] text-black py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-[#cce600] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all mt-4">
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