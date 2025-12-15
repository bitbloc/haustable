import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutGrid, List as ListIcon, Search, Check, ArrowRight, ArrowLeft } from 'lucide-react'
import { useLanguage } from './context/LanguageContext'
import { getThaiDate, toThaiISO } from './utils/timeUtils'

import MenuCard from './components/shared/MenuCard'
import ViewToggle from './components/shared/ViewToggle'
import OptionSelectionModal from './components/shared/OptionSelectionModal'

// --- Components ---


// --- Main Page ---
export default function PickupPage() {
    const { t } = useLanguage()
    const navigate = useNavigate()
    const [viewMode, setViewMode] = useState('grid')
    const [step, setStep] = useState(1)
    const [menuItems, setMenuItems] = useState([])
    const [categories, setCategories] = useState([]) // New: Categories
    const [cart, setCart] = useState([])
    const [searchTerm, setSearchTerm] = useState('')
    const [activeCategory, setActiveCategory] = useState('All') // New: Active Category
    const [selectedItem, setSelectedItem] = useState(null) // New: For Modal

    // Checkout Form State
    const [pickupTime, setPickupTime] = useState('')
    const [contactName, setContactName] = useState('')
    const [contactPhone, setContactPhone] = useState('')
    const [specialRequest, setSpecialRequest] = useState('') // New
    const [isAgreed, setIsAgreed] = useState(false)
    const [slipFile, setSlipFile] = useState(null)
    const [submitting, setSubmitting] = useState(false)

    // Settings State
    const [qrCodeUrl, setQrCodeUrl] = useState(null)
    const [policyNote, setPolicyNote] = useState('')
    const [minAdvanceHours, setMinAdvanceHours] = useState(1) // Default 1 hr
    const [pickupDate, setPickupDate] = useState('today') // 'today' | 'tomorrow'

    // Load Menu & Settings
    useEffect(() => {
        const fetchMenu = async () => {
            // 1. Menu
            // 1. Menu & Categories
            // 1. Menu & Categories
            const { data: menuRaw } = await supabase.from('menu_items').select('*, menu_item_options(*, option_groups(*, option_choices(*)))').order('category')

            const { data: c } = await supabase.from('menu_categories').select('*').order('display_order')
            setCategories(c || [])

            // SMART SORT logic
            const categoryOrder = (c || []).reduce((acc, cat, idx) => {
                acc[cat.name] = cat.display_order ?? idx
                return acc
            }, {})

            const sortedMenu = (menuRaw || [])
                .filter(item => item.is_pickup_available !== false) // Filter out items not for pickup
                .sort((a, b) => {
                    // 1. Availability (available first using is_available)
                    if (a.is_available !== b.is_available) return b.is_available - a.is_available
                    // 2. Category Order
                    const orderA = categoryOrder[a.category] ?? 999
                    const orderB = categoryOrder[b.category] ?? 999
                    if (orderA !== orderB) return orderA - orderB
                    // 3. Name
                    return a.name.localeCompare(b.name)
                })

            setMenuItems(sortedMenu)

            // 2. Settings (Policy & QR)
            const { data: settings } = await supabase.from('app_settings').select('*')
            if (settings) {
                const map = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {})
                if (map.payment_qr_url) setQrCodeUrl(`${map.payment_qr_url}?t=${Date.now()}`)
                if (map.policy_pickup) setPolicyNote(map.policy_pickup)
                if (map.pickup_min_advance_hours) setMinAdvanceHours(Number(map.pickup_min_advance_hours))
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

    // --- Logic ---
    // Replacement for direct addToCart: Open Modal
    const handleItemClick = (item) => {
        setSelectedItem(item)
    }

    const handleConfirmAddItem = (newItem) => {
        setCart(prev => {
            // Check if same item with same options exists
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

    const cartTotal = cart.reduce((sum, item) => sum + (item.totalPricePerUnit * item.qty), 0)

    // Filter Logic
    const filteredMenu = menuItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesCategory = activeCategory === 'All'
            ? true
            : (item.category === activeCategory || item.category_id === categories.find(c => c.name === activeCategory)?.id)
        return matchesSearch && matchesCategory
    })

    const handleSubmit = async () => {
        if (!contactName || !contactPhone) return alert('Please fill contact info')
        if (!isAgreed) return alert(t('agreeTerms'))
        if (!slipFile) return alert(t('uploadSlipDesc'))
        if (!pickupTime) return alert('Select pickup time')

        setSubmitting(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()

            // Construct Booking Time (Today + Time)
            // Construct Booking Time
            const now = new Date()
            const dateBasis = new Date()
            if (pickupDate === 'tomorrow') {
                dateBasis.setDate(dateBasis.getDate() + 1)
            }
            const dateStr = dateBasis.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }) // YYYY-MM-DD
            const bookingDateTime = toThaiISO(dateStr, pickupTime) // +07:00

            // Validation: Advance Notice
            const pickupDateTime = new Date(bookingDateTime)
            const minTime = new Date(now.getTime() + minAdvanceHours * 60 * 60 * 1000)

            if (pickupDateTime < minTime) {
                alert(`Please order at least ${minAdvanceHours} hour(s) in advance.`)
                setSubmitting(false)
                return
            }

            // Upload Slip
            const fileExt = slipFile.name.split('.').pop()
            const fileName = `pickup_${Math.random()}.${fileExt}`
            const { error: uploadError } = await supabase.storage.from('slips').upload(fileName, slipFile)
            if (uploadError) throw uploadError

            // Insert Booking
            const customerNoteContent = `Pickup Order` + (specialRequest ? `\nNote: ${specialRequest}` : '')

            const { data: bookingData, error: bookingError } = await supabase.from('bookings').insert({
                user_id: user?.id || null,
                booking_type: 'pickup',
                status: 'pending',
                booking_time: bookingDateTime,
                total_amount: cartTotal,
                payment_slip_url: fileName,
                pickup_contact_name: contactName,
                pickup_contact_phone: contactPhone,
                customer_note: customerNoteContent
            }).select().single()

            if (bookingError) throw bookingError

            // Order Items
            if (cart.length > 0) {
                const orderItems = cart.map(item => ({
                    booking_id: bookingData.id,
                    menu_item_id: item.id,
                    quantity: item.qty,
                    price_at_time: item.totalPricePerUnit,
                    options: item.optionsSummary // Store options summary if schema allows or use another field
                }))
                await supabase.from('order_items').insert(orderItems)
            }

            alert(t('confirmOrder') + ' Success!')
            navigate('/')

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

                            {/* Search & Toggle */}
                            <div className="flex justify-between items-end mb-4 shrink-0">
                                <div className="relative flex-1 mr-4">
                                    <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                                    <input type="text" placeholder={t('searchMenu')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-white border border-gray-200 pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:border-black" />
                                </div>
                                <ViewToggle mode={viewMode} setMode={setViewMode} />
                            </div>

                            {/* Category Tabs */}
                            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide mb-2">
                                <button
                                    onClick={() => setActiveCategory('All')}
                                    className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all border ${activeCategory === 'All' ? 'bg-black text-white border-black shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
                                >
                                    All
                                </button>
                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setActiveCategory(cat.name)}
                                        className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all border ${activeCategory === cat.name ? 'bg-black text-white border-black shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>

                            {/* Menu Grid */}
                            <div className="flex-1 overflow-y-auto pr-1 pb-20">
                                <div className={`grid gap-3 ${viewMode === 'grid' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                    {filteredMenu.map(item => (
                                        <MenuCard
                                            key={item.id}
                                            item={item}
                                            mode={viewMode}
                                            onAdd={() => handleItemClick(item)}
                                            onRemove={() => { }} // Remove logic not needed in card for popup flow
                                            qty={0} // Always 0 to force 'Plus' button behavior which opens modal
                                            t={t}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Footer Cart Bar */}
                            {cart.length > 0 && (
                                <div className="fixed bottom-6 left-6 right-6 max-w-lg mx-auto">
                                    <div onClick={() => setStep(2)} className="bg-black text-white p-4 rounded-xl flex justify-between items-center cursor-pointer hover:bg-gray-800 transition-colors shadow-2xl">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-white text-black w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs">{cart.reduce((a, b) => a + b.qty, 0)}</div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">{t('cartTotal')}</span>
                                                <span className="font-mono font-bold text-lg leading-none">{cartTotal}.-</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 font-bold text-sm">{t('next')} <ArrowRight size={16} /></div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Modal */}
                    <AnimatePresence>
                        {selectedItem && (
                            <OptionSelectionModal
                                item={selectedItem}
                                onClose={() => setSelectedItem(null)}
                                onConfirm={handleConfirmAddItem}
                            />
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
                                {/* Contact Info */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase">{t('contactInfo')}</h3>
                                    <input type="text" placeholder={t('yourName')} value={contactName} onChange={e => setContactName(e.target.value)} className="w-full bg-gray-50 border-b border-gray-200 py-2 focus:border-black outline-none" />
                                    <input type="tel" placeholder={t('phoneNumber')} value={contactPhone} onChange={e => setContactPhone(e.target.value)} className="w-full bg-gray-50 border-b border-gray-200 py-2 focus:border-black outline-none" />
                                </div>

                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                    <label className="text-xs font-bold text-gray-400 uppercase block mb-3">Special Request (Note)</label>
                                    <textarea
                                        value={specialRequest}
                                        onChange={e => setSpecialRequest(e.target.value)}
                                        placeholder="แพ้อาหาร, เพิ่มเติม..."
                                        className="w-full bg-transparent border-b border-gray-200 py-2 focus:border-black outline-none resize-none text-sm"
                                        rows={2}
                                    />
                                </div>

                                {/* Pickup Time */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                    <label className="text-xs font-bold text-gray-400 uppercase block mb-3">{t('pickupTime')}</label>

                                    {/* Date Selection */}
                                    <div className="flex bg-gray-100 rounded-lg p-1 mb-4">
                                        <button
                                            onClick={() => setPickupDate('today')}
                                            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${pickupDate === 'today' ? 'bg-white shadow text-black' : 'text-gray-400'}`}
                                        >
                                            Today
                                        </button>
                                        <button
                                            onClick={() => setPickupDate('tomorrow')}
                                            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${pickupDate === 'tomorrow' ? 'bg-white shadow text-black' : 'text-gray-400'}`}
                                        >
                                            Tomorrow
                                        </button>
                                    </div>

                                    <input
                                        type="time"
                                        value={pickupTime}
                                        onChange={e => setPickupTime(e.target.value)}
                                        className="w-full text-lg font-bold bg-transparent outline-none"
                                        placeholder="ระบุเวลาที่มารับ (Time to pick up)"
                                    />
                                    <p className="text-xs text-gray-400 mt-2">*Please order at least {minAdvanceHours} hour(s) in advance.</p>
                                </div>

                                {/* Order Summary */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">{t('orderSummary')}</h3>
                                    {cart.map((item, index) => (
                                        <div key={index} className="flex justify-between text-sm mb-3 border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                                            <div>
                                                <div className="text-gray-900 font-bold">{item.name} <span className="text-gray-400 text-xs">x{item.qty}</span></div>
                                                {item.optionsSummary?.map((opt, i) => (
                                                    <div key={i} className="text-xs text-gray-500">+ {opt.name} ({opt.price})</div>
                                                ))}
                                                {item.specialRequest && <div className="text-xs text-brand">Note: {item.specialRequest}</div>}
                                            </div>
                                            <span className="font-bold font-mono text-gray-900">{item.totalPricePerUnit * item.qty}.-</span>
                                        </div>
                                    ))}
                                    <div className="border-t border-gray-100 mt-2 pt-2 flex justify-between font-bold text-base">
                                        <span>{t('total')}</span>
                                        <span>{cartTotal}.-</span>
                                    </div>
                                </div>

                                {/* Payment & Disclaimer */}
                                <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-red-800 text-xs leading-relaxed">
                                    <p className="font-bold mb-2 text-sm">{t('paymentRequired')}</p>

                                    {qrCodeUrl && (
                                        <div className="mb-4 flex justify-center bg-white p-2 rounded-lg border border-red-200">
                                            <img src={qrCodeUrl} alt="Payment QR" className="w-48 h-auto object-contain" />
                                        </div>
                                    )}

                                    <p className="opacity-75 whitespace-pre-line mb-3 border-b border-red-200/50 pb-3">
                                        {policyNote || t('minCondition')}
                                    </p>

                                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                        <input type="checkbox" checked={isAgreed} onChange={e => setIsAgreed(e.target.checked)} className="accent-black w-4 h-4" />
                                        <span className="font-bold">{t('agreeTerms')}</span>
                                    </label>
                                </div>

                                {/* Upload Slip */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('uploadSlip')}</label>
                                    <input type="file" accept="image/*" onChange={e => setSlipFile(e.target.files[0])} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-black file:text-white hover:file:bg-gray-800 transition-colors cursor-pointer" />
                                </div>

                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting || !isAgreed || !pickupTime || !slipFile}
                                    className="w-full bg-[#DFFF00] text-black py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-[#cce600] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all mt-4"
                                >
                                    {submitting ? t('processing') : `${t('confirmOrder')} ${cartTotal}.-`}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}