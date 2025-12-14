import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutGrid, List as ListIcon, Search, Check, ArrowRight, ArrowLeft } from 'lucide-react'
import { useLanguage } from './context/LanguageContext'
import { getThaiDate, toThaiISO } from './utils/timeUtils'

import MenuCard from './components/shared/MenuCard'
import ViewToggle from './components/shared/ViewToggle'

// --- Components ---


// --- Main Page ---
export default function PickupPage() {
    const { t } = useLanguage()
    const navigate = useNavigate()
    const [viewMode, setViewMode] = useState('grid')
    const [step, setStep] = useState(1)
    const [menuItems, setMenuItems] = useState([])
    const [cart, setCart] = useState([])
    const [searchTerm, setSearchTerm] = useState('')

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

    // Load Menu & Settings
    useEffect(() => {
        const fetchMenu = async () => {
            // 1. Menu
            const { data: m } = await supabase.from('menu_items').select('*').eq('is_available', true).order('category')
            setMenuItems(m || [])

            // 2. Settings (Policy & QR)
            const { data: settings } = await supabase.from('app_settings').select('*')
            if (settings) {
                const map = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {})
                if (map.payment_qr_url) setQrCodeUrl(`${map.payment_qr_url}?t=${Date.now()}`)
                if (map.policy_pickup) setPolicyNote(map.policy_pickup)
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
    const addToCart = (item) => {
        setCart(prev => {
            const exist = prev.find(i => i.id === item.id)
            if (exist) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i)
            return [...prev, { ...item, qty: 1 }]
        })
    }

    const removeFromCart = (item) => {
        setCart(prev => {
            const exist = prev.find(i => i.id === item.id)
            if (!exist) return prev
            if (exist.qty === 1) return prev.filter(i => i.id !== item.id)
            return prev.map(i => i.id === item.id ? { ...i, qty: i.qty - 1 } : i)
        })
    }

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0)
    const filteredMenu = menuItems.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))

    const handleSubmit = async () => {
        if (!contactName || !contactPhone) return alert('Please fill contact info')
        if (!isAgreed) return alert(t('agreeTerms'))
        if (!slipFile) return alert(t('uploadSlipDesc'))
        if (!pickupTime) return alert('Select pickup time')

        setSubmitting(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()

            // Construct Booking Time (Today + Time)
            const today = getThaiDate() // YYYY-MM-DD in Thai time
            const bookingDateTime = toThaiISO(today, pickupTime) // +07:00

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
                    price_at_time: item.price
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

                            {/* Menu Grid */}
                            <div className="flex-1 overflow-y-auto pr-1 pb-20">
                                <div className={`grid gap-3 ${viewMode === 'grid' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                    {filteredMenu.map(item => (
                                        <MenuCard key={item.id} item={item} mode={viewMode} onAdd={addToCart} onRemove={removeFromCart} qty={cart.find(c => c.id === item.id)?.qty || 0} t={t} />
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
                                    <input type="time" value={pickupTime} onChange={e => setPickupTime(e.target.value)} className="w-full text-lg font-bold bg-transparent outline-none" />
                                </div>

                                {/* Order Summary */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">{t('orderSummary')}</h3>
                                    {cart.map(item => (
                                        <div key={item.id} className="flex justify-between text-sm mb-2">
                                            <span className="text-gray-600">{item.name} x{item.qty}</span>
                                            <span className="font-bold font-mono">{item.price * item.qty}.-</span>
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