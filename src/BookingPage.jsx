import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, LayoutGrid, List as ListIcon, Search, Maximize, Minimize, X, ZoomIn, ZoomOut, RotateCw, Image } from 'lucide-react'
import { useLanguage } from './context/LanguageContext'
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"

// --- Animation Variants ---
const slideVariants = {
    enter: (direction) => ({ x: direction > 0 ? 50 : -50, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction) => ({ x: direction < 0 ? 50 : -50, opacity: 0 }),
}

// --- Sub Components ---
const Header = ({ title, subtitle }) => (
    <div className="mb-6">
        <h1 className="text-3xl font-bold text-black tracking-tight">{title}</h1>
        <p className="text-gray-500 text-sm uppercase tracking-widest">{subtitle}</p>
    </div>
)

const ViewToggle = ({ mode, setMode }) => (
    <div className="flex bg-gray-200 rounded-lg p-1 gap-1">
        <button onClick={() => setMode('grid')} className={`p-2 rounded-md transition-all ${mode === 'grid' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`}>
            <LayoutGrid size={18} />
        </button>
        <button onClick={() => setMode('list')} className={`p-2 rounded-md transition-all ${mode === 'list' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`}>
            <ListIcon size={18} />
        </button>
    </div>
)

const MenuCard = ({ item, mode, onAdd, onRemove, qty, t }) => {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`group bg-white rounded-xl border border-gray-100 overflow-hidden hover:border-black/20 transition-all ${mode === 'list' ? 'flex flex-row items-center p-3 gap-4 h-24' : 'flex flex-col h-full'}`}
        >
            <div className={`bg-gray-100 overflow-hidden relative ${mode === 'list' ? 'w-20 h-full rounded-lg shrink-0' : 'w-full aspect-square'}`}>
                {item.image_url ? (
                    <img src={item.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={item.name} />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No Image</div>
                )}
                {/* Qty Badge (Grid only - optional, since we have controls now, but keep for clarity if needed. Removing to clean up UI as controls show qty) */}
            </div>

            <div className={`flex flex-col justify-between ${mode === 'list' ? 'flex-1 py-1' : 'p-4 flex-1'}`}>
                <div>
                    <div className="flex justify-between items-start">
                        <h3 className="font-bold text-gray-900 text-sm leading-tight">{item.name}</h3>
                        {mode === 'list' && <span className="font-mono text-sm font-bold ml-2">{item.price}.-</span>}
                    </div>
                    {mode === 'grid' && <p className="text-gray-400 text-xs mt-1 uppercase tracking-wider">{item.category}</p>}
                </div>

                <div className={`flex items-end justify-between ${mode === 'grid' ? 'mt-3' : 'mt-0'}`}>
                    {mode === 'grid' && <span className="font-mono text-sm font-bold">{item.price}.-</span>}

                    {/* Quantity Control */}
                    {qty > 0 ? (
                        <div className={`flex items-center bg-black text-white rounded-full shadow-lg overflow-hidden ${mode === 'list' ? 'h-8' : 'h-8'}`}>
                            <button
                                onClick={(e) => { e.stopPropagation(); onRemove(item); }}
                                className="w-8 h-full flex items-center justify-center hover:bg-gray-800 active:scale-95 transition-all text-lg font-bold pb-1"
                            >
                                -
                            </button>
                            <span className="font-bold text-sm min-w-[20px] text-center">{qty}</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); onAdd(item); }}
                                className="w-8 h-full flex items-center justify-center hover:bg-gray-800 active:scale-95 transition-all text-lg font-bold pb-1"
                            >
                                +
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => onAdd(item)}
                            className={`active:scale-95 transition-transform flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-black group-hover:bg-[#DFFF00] group-hover:text-black ${mode === 'list' ? 'px-4 py-1.5 rounded-full text-xs font-bold' : 'w-8 h-8 rounded-full'}`}
                        >
                            {mode === 'list' ? t('addToCart') : <PlusIcon size={16} />}
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    )
}

// Icon Helper since I used PlusIcon
const PlusIcon = ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
)

export default function BookingPage() {
    const { t } = useLanguage()
    const navigate = useNavigate()
    const [step, setStep] = useState(1)
    const [direction, setDirection] = useState(0) // 1 = Next, -1 = Back

    // Data
    const [tables, setTables] = useState([])
    const [floorplanUrl, setFloorplanUrl] = useState(null)
    const [bookedTableIds, setBookedTableIds] = useState([])
    const [qrCodeUrl, setQrCodeUrl] = useState(null) // New
    const [policyNote, setPolicyNote] = useState('') // New
    const [minSpend, setMinSpend] = useState(0) // New
    const [minAdvanceHours, setMinAdvanceHours] = useState(2) // Default 2 hours based on user request
    const [previewImage, setPreviewImage] = useState(null) // Lightbox State

    // Selection
    const [date, setDate] = useState('')
    const [time, setTime] = useState('')
    const [selectedTable, setSelectedTable] = useState(null)
    const [pax, setPax] = useState(2)
    const [isExpanded, setIsExpanded] = useState(false) // Toggle full floorplan view

    // Menu & Cart
    const [menuItems, setMenuItems] = useState([])
    const [cart, setCart] = useState([])
    const [viewMode, setViewMode] = useState('grid')
    const [searchTerm, setSearchTerm] = useState('')
    const [isCheckoutMode, setIsCheckoutMode] = useState(false)

    // Checkout Form
    const [contactName, setContactName] = useState('')
    const [contactPhone, setContactPhone] = useState('')
    const [specialRequest, setSpecialRequest] = useState('') // New
    const [isAgreed, setIsAgreed] = useState(false)
    const [slipFile, setSlipFile] = useState(null)
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        const load = async () => {
            // 1. Load Tables & Floorplan & Settings
            const { data: tData } = await supabase.from('tables_layout').select('*')
            setTables(tData || [])

            const { data: settings } = await supabase.from('app_settings').select('*')
            if (settings) {
                const map = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {})
                if (map.floorplan_url) setFloorplanUrl(`${map.floorplan_url}?t=${Date.now()}`)
                if (map.payment_qr_url) setQrCodeUrl(`${map.payment_qr_url}?t=${Date.now()}`)
                if (map.policy_dine_in) setPolicyNote(map.policy_dine_in)
                if (map.booking_min_spend) setMinSpend(parseInt(map.booking_min_spend))
                if (map.booking_min_advance_hours) setMinAdvanceHours(Number(map.booking_min_advance_hours))
            }

            // 2. Load Menu
            const { data: m } = await supabase.from('menu_items').select('*').eq('is_available', true).order('category')
            setMenuItems(m || [])

            // 3. User Info
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                setContactName(user.user_metadata.full_name || '')
                const { data: profile } = await supabase.from('profiles').select('phone_number').eq('id', user.id).single()
                if (profile?.phone_number) setContactPhone(profile.phone_number)
            }
        }
        load()
    }, [])
    const nextStep = () => { setDirection(1); setStep(s => s + 1) }
    const prevStep = () => { setDirection(-1); setStep(s => s - 1) }

    // Cart Logic
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

    // Submit Logic
    const handleSubmit = async () => {
        if (!contactName || !contactPhone) return alert('กรุณากรอกข้อมูลให้ครบ')
        if (!isAgreed) return alert(t('agreeTerms'))
        if (!slipFile) return alert(t('uploadSlipDesc'))

        // Min Spend Check
        if (minSpend > 0) {
            const requiredSpend = minSpend * pax
            if (cartTotal < requiredSpend) {
                return alert(`ยอดขั้นต่ำต่อท่านคือ ${minSpend} บาท สำหรับ ${pax} ท่านต้องมียอดรวม ${requiredSpend} บาท (ขาดอีก ${requiredSpend - cartTotal} บาท)`)
            }
        }

        setSubmitting(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Please Login')

            const bookingDateTime = `${date} ${time}:00`

            // --- DOUBLE CHECK AVAILABILITY ---
            // Prevent Race Condition: Check one last time before insert
            const { count, error: checkError } = await supabase
                .from('bookings')
                .select('id', { count: 'exact', head: true })
                .eq('booking_time', bookingDateTime)
                .eq('table_id', selectedTable.id)
                .in('status', ['pending', 'confirmed'])

            if (checkError) throw checkError
            if (count > 0) {
                alert('ขออภัย! โต๊ะนี้เพิ่งถูกจองตัดหน้าไปเมื่อสักครู่ กรุณาเลือกโต๊ะใหม่ (Sorry, this table was just taken!)')
                // Refresh data
                fetchBookings()
                setSelectedTable(null)
                // Go back to step 2?
                setStep(2)
                setDirection(-1)
                return // Stop submission
            }

            const fileExt = slipFile.name.split('.').pop()
            const fileName = `booking_${Math.random()}.${fileExt}`
            const { error: uploadError } = await supabase.storage.from('slips').upload(fileName, slipFile)
            if (uploadError) throw uploadError

            // Create Booking
            const customerNoteContent = `Booking ${selectedTable.table_name} (${pax} Pax)` + (specialRequest ? `\nNote: ${specialRequest}` : '')

            const { data: bookingData, error: bookingError } = await supabase.from('bookings').insert({
                user_id: user.id,
                booking_type: 'dine_in', // CHANGED to match AdminDashboard filter
                status: 'pending',
                booking_time: bookingDateTime,
                table_id: selectedTable.id,
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

            alert(t('confirmBooking') + ' Success!')
            navigate('/')

        } catch (error) {
            alert('Error: ' + error.message)
        } finally {
            setSubmitting(false)
        }
    }

    // Helper to render a table button
    const renderTable = (table) => {
        const isBooked = bookedTableIds.includes(table.id)
        const isSelected = selectedTable?.id === table.id
        const rotation = table.rotation || 0

        // Calculate style
        const baseStyle = {
            position: 'absolute',
            left: `${table.pos_x}%`,
            top: `${table.pos_y}%`,
            width: `${table.width}%`,
            height: `${table.height}%`,
            transform: `rotate(${rotation}deg)`
        }

        // Color Logic
        let bgColor = isBooked ? '#ef4444' : (isSelected ? '#000000' : (table.table_color || '#ffffff'))
        let textColor = (isBooked || isSelected || ['#333333', '#7F1D1D', '#14532D', '#1E3A8A', '#581C87'].includes(bgColor)) ? 'white' : 'black'
        let borderColor = isSelected ? 'white' : 'transparent'

        return (
            <button
                key={table.id}
                disabled={isBooked}
                onClick={(e) => {
                    e.stopPropagation()
                    if (!isBooked) {
                        setSelectedTable(table)
                        if (isExpanded) setIsExpanded(false) // Option: close on select
                    }
                }}
                style={baseStyle}
                className={`transition-all duration-300 flex flex-col items-center justify-center shadow-md
                    ${table.shape === 'circle' ? 'rounded-full' : 'rounded-lg'}
                    ${isBooked ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95 cursor-pointer'}
                    ${isSelected ? 'z-20 ring-4 ring-black/20' : ''}
                `}
            >
                {/* Background */}
                <div className={`absolute inset-0 w-full h-full ${table.shape === 'circle' ? 'rounded-full' : 'rounded-lg'}`} style={{ backgroundColor: bgColor, border: `2px solid ${borderColor}` }} />

                {/* Content */}
                <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-1" style={{ transform: `rotate(${-rotation}deg)` }}>
                    {isBooked ? (
                        <>
                            <span className="font-bold text-[8px] uppercase tracking-wider" style={{ color: textColor }}>Full</span>
                            <span className="text-[8px] opacity-75" style={{ color: textColor }}>{table.table_name}</span>
                        </>
                    ) : (
                        <>
                            <span className="font-bold text-xs sm:text-sm truncate" style={{ color: textColor }}>{table.table_name}</span>
                            <span className="text-[8px] sm:text-[10px] opacity-75" style={{ color: textColor }}>{table.capacity}p</span>
                        </>
                    )}
                </div>
            </button>
        )
    }

    return (
        <div className="min-h-screen bg-[#F9F9F9] flex flex-col p-6 font-sans text-black">

            {/* Top Nav */}
            <div className="flex justify-between items-center mb-6">
                <button onClick={() => {
                    if (step === 3 && isCheckoutMode) { setIsCheckoutMode(false); return; }
                    if (step === 1) navigate('/')
                    else prevStep()
                }} className="p-2 hover:bg-white rounded-full transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex gap-1">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`h-1 w-8 rounded-full transition-all duration-500 ${i <= step ? 'bg-black' : 'bg-gray-200'}`} />
                    ))}
                </div>
            </div>

            <div className="flex-1 max-w-lg mx-auto w-full relative">
                <AnimatePresence custom={direction} mode="wait">

                    {/* STEP 1: Date, Time, Pax */}
                    {step === 1 && (
                        <motion.div
                            key="step1" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit"
                            className="h-full flex flex-col"
                        >
                            <Header title={t('reservation')} subtitle={t('stepDate')} />

                            <div className="space-y-6 flex-1">
                                {/* Date */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{t('date')}</label>
                                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full text-lg font-bold border-b border-gray-200 py-2 outline-none focus:border-black bg-transparent" />
                                </div>

                                {/* Time */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-4">{t('timeSlot')}</label>
                                    <div className="grid grid-cols-4 gap-3">
                                        {['11:00', '12:00', '13:00', '14:00', '17:00', '18:00', '19:00', '20:00'].map(tm => {
                                            // Advance Booking Logic
                                            let isDisabled = false
                                            if (date) {
                                                const now = new Date()
                                                const [hours, minutes] = tm.split(':').map(Number)
                                                // Create a date object for this slot
                                                const slotDate = new Date(date)
                                                slotDate.setHours(hours, minutes, 0, 0)

                                                // If 'date' string implies UTC? No, usually local browser Parse.
                                                // new Date('2025-12-20') is UTC 00:00 usually or local?
                                                // Simplest: Compare timestamps if date is TODAY.
                                                const todayStr = now.toLocaleDateString('en-CA') // YYYY-MM-DD

                                                if (date === todayStr) {
                                                    // It is today. Check time.
                                                    // Need (CurrentTime + MinAdvance) <= SlotTime
                                                    const minTime = now.getTime() + (minAdvanceHours * 60 * 60 * 1000)

                                                    // Fix: new Date(date) might be midnight UTC.
                                                    // Construct slot time relative to NOW's day?
                                                    // Safe approach: Parse the slot date/time in local component
                                                    const checkDate = new Date()
                                                    // checkDate is Now. We want to set it to target time.
                                                    checkDate.setHours(hours, minutes, 0, 0)

                                                    if (checkDate.getTime() < minTime) {
                                                        isDisabled = true
                                                    }
                                                } else if (new Date(date) < new Date(todayStr)) {
                                                    // Past date selection (if datepicker allows)
                                                    isDisabled = true
                                                }
                                            }

                                            return (
                                                <button
                                                    key={tm}
                                                    onClick={() => !isDisabled && setTime(tm)}
                                                    disabled={isDisabled}
                                                    className={`py-2 rounded-lg text-sm font-bold transition-all ${time === tm ? 'bg-black text-white' : (isDisabled ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-gray-50 text-gray-500 hover:bg-gray-100')}`}
                                                >
                                                    {tm}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Pax */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-4">{t('guests')}</label>
                                    <div className="flex items-center gap-4">
                                        <button onClick={() => setPax(Math.max(1, pax - 1))} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold hover:bg-gray-200">-</button>
                                        <span className="text-2xl font-bold w-10 text-center">{pax}</span>
                                        <button onClick={() => setPax(pax + 1)} className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold hover:bg-gray-800">+</button>
                                    </div>
                                </div>
                            </div>

                            <button onClick={nextStep} disabled={!date || !time} className="w-full bg-black text-white py-4 rounded-xl font-bold mt-8 shadow-lg disabled:opacity-20 transition-all flex justify-center items-center gap-2">
                                {t('selectTable')} <ArrowRight size={18} />
                            </button>
                        </motion.div>
                    )}

                    {/* STEP 2: Floor Plan */}
                    {step === 2 && (
                        <motion.div
                            key="step2" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit"
                            className="h-full flex flex-col relative"
                        >
                            {/* Top Controls Overlay */}
                            <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-start pointer-events-none">
                                {/* Info Card */}
                                <div className="bg-white/90 backdrop-blur-xl p-4 rounded-2xl shadow-lg border border-white/50 pointer-events-auto">
                                    <h2 className="text-lg font-bold text-black leading-none">{t('selectTable')}</h2>
                                    <div className="flex items-center gap-2 mt-2 text-xs sm:text-sm text-gray-600 font-medium whitespace-nowrap">
                                        <span className="bg-gray-100 px-2 py-1 rounded-md">{date}</span>
                                        <span className="bg-gray-100 px-2 py-1 rounded-md">{time}</span>
                                        <span className="bg-black text-white px-2 py-1 rounded-md">{pax} Pax</span>
                                    </div>
                                </div>

                                <button onClick={() => setIsExpanded(!isExpanded)} className="bg-white p-3 rounded-full shadow-lg text-black pointer-events-auto hover:bg-gray-50 transition-colors">
                                    {isExpanded ? <Minimize size={20} /> : <Maximize size={20} />}
                                </button>
                            </div>

                            {/* Image Lightbox Overlay */}
                            <AnimatePresence>
                                {previewImage && (
                                    <motion.div
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                        className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
                                        onClick={() => setPreviewImage(null)}
                                    >
                                        <motion.div
                                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                                            className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center"
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <button onClick={() => setPreviewImage(null)} className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-md z-10">
                                                <X size={24} />
                                            </button>
                                            <img src={previewImage} className="w-full h-full object-contain rounded-lg shadow-2xl" alt="Table Preview" />
                                        </motion.div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className={`flex-1 overflow-hidden relative rounded-3xl border-2 border-gray-100 bg-[#f0f0f0] transition-all duration-500 ${isExpanded ? 'fixed inset-0 z-50 rounded-none' : ''}`}>
                                <TransformWrapper
                                    initialScale={0.9}
                                    minScale={0.2}
                                    maxScale={4}
                                    centerOnInit={true}
                                    limitToBounds={false}
                                    panning={{ velocityDisabled: false }}
                                >
                                    {({ zoomIn, zoomOut, resetTransform }) => (
                                        <>
                                            <div className="absolute bottom-24 right-4 z-20 flex flex-col gap-2 pointer-events-auto">
                                                <button onClick={() => zoomIn()} className="bg-white p-2 rounded-lg shadow-sm hover:bg-gray-50"><ZoomIn size={20} /></button>
                                                <button onClick={() => zoomOut()} className="bg-white p-2 rounded-lg shadow-sm hover:bg-gray-50"><ZoomOut size={20} /></button>
                                                <button onClick={() => resetTransform()} className="bg-white p-2 rounded-lg shadow-sm hover:bg-gray-50"><RotateCw size={20} /></button>
                                            </div>
                                            <TransformComponent
                                                wrapperClass="w-full h-full flex items-center justify-center bg-[#f0f0f0]"
                                                contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                <div
                                                    className="relative w-[1000px] aspect-video bg-white shadow-2xl origin-center"
                                                    style={{
                                                        backgroundImage: floorplanUrl ? `url(${floorplanUrl})` : undefined,
                                                        backgroundSize: '100% 100%',
                                                        backgroundRepeat: 'no-repeat',
                                                    }}
                                                    onClick={() => setSelectedTable(null)}
                                                >
                                                    {tables.map(table => renderTable(table))}
                                                </div>
                                            </TransformComponent>
                                        </>
                                    )}
                                </TransformWrapper>

                                {/* Float Card (Refactored) */}
                                <AnimatePresence>
                                    {selectedTable && (
                                        <motion.div
                                            initial={{ y: 50, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            exit={{ y: 50, opacity: 0 }}
                                            className="absolute bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white/50 z-30"
                                        >
                                            <div className="flex gap-4">
                                                {/* Image Thumbnail */}
                                                <div
                                                    className="w-20 h-20 rounded-lg bg-gray-100 overflow-hidden cursor-zoom-in shrink-0 relative group"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (selectedTable.image_url) setPreviewImage(selectedTable.image_url);
                                                    }}
                                                >
                                                    {selectedTable.image_url ? (
                                                        <>
                                                            <img src={selectedTable.image_url} className="w-full h-full object-cover" />
                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                                                <Maximize size={16} className="text-white opacity-0 group-hover:opacity-100" />
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-300"><Image size={24} /></div>
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <h3 className="font-bold text-lg truncate pr-2">{selectedTable.table_name}</h3>
                                                        <button onClick={() => setSelectedTable(null)} className="text-gray-400 hover:text-black"><X size={18} /></button>
                                                    </div>
                                                    <p className="text-gray-500 text-xs mb-3">{selectedTable.capacity} Seats</p>
                                                    <button onClick={nextStep} className="w-full bg-black text-white py-2 rounded-lg font-bold text-xs shadow-md">
                                                        Select
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                        </motion.div>
                    )}

                    {/* STEP 3: Food & Pay */}
                    {step === 3 && (
                        <motion.div
                            key="step3" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit"
                            className="h-full flex flex-col"
                        >
                            <Header title={isCheckoutMode ? t('confirmBooking') : t('foodAndDetail')} subtitle={t('stepFood')} />

                            {!isCheckoutMode ? (
                                <div className="flex-1 flex flex-col min-h-0">
                                    <div className="flex justify-between items-end mb-4 shrink-0">
                                        <div className="relative flex-1 mr-4">
                                            <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                                            <input type="text" placeholder={t('searchMenu')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-white border border-gray-200 pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:border-black" />
                                        </div>
                                        <ViewToggle mode={viewMode} setMode={setViewMode} />
                                    </div>

                                    <div className="flex-1 overflow-y-auto pr-1">
                                        <div className={`grid gap-3 ${viewMode === 'grid' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                            {filteredMenu.map(item => (
                                                <MenuCard key={item.id} item={item} mode={viewMode} onAdd={addToCart} onRemove={removeFromCart} qty={cart.find(c => c.id === item.id)?.qty || 0} t={t} />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-gray-200 shrink-0">
                                        <div onClick={() => setIsCheckoutMode(true)} className="bg-black text-white p-4 rounded-xl flex justify-between items-center cursor-pointer hover:bg-gray-800 transition-colors shadow-lg">
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
                                    <button
                                        onClick={() => {
                                            // Pre-check Min Spend
                                            if (minSpend > 0 && cartTotal < (minSpend * pax)) {
                                                alert(`ยอดขั้นต่ำต่อท่านคือ ${minSpend}.- (รวม ${minSpend * pax}.-)\nกรุณาสั่งอาหารเพิ่มอีก ${(minSpend * pax) - cartTotal}.-`)
                                                return
                                            }
                                            setIsCheckoutMode(true)
                                        }}
                                        className="w-full text-center text-xs text-gray-400 mt-2 hover:text-black"
                                    >
                                        {t('skipFood')} (Pay Only)
                                    </button>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto">
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6">
                                        <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">{t('bookingDetail')}</h3>
                                        <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">{t('table')}</span><span className="font-bold">{selectedTable?.table_name} ({pax} Pax)</span></div>
                                        <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">{t('date')}</span><span className="font-bold">{date}</span></div>
                                        <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">{t('timeSlot')}</span><span className="font-bold">{time}</span></div>
                                        {cart.length > 0 && <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-bold"><span>{t('foodTotal')}</span><span>{cartTotal}.-</span></div>}

                                        {/* Min Spend Warning */}
                                        {(minSpend > 0 && cartTotal < (minSpend * pax)) && (
                                            <div className="mt-3 bg-red-50 border border-red-100 rounded-lg p-2 text-xs text-red-600">
                                                <div className="flex justify-between mb-1">
                                                    <span>Min Spend ({minSpend}x{pax}):</span>
                                                    <span className="font-bold">{minSpend * pax}.-</span>
                                                </div>
                                                <div className="flex justify-between font-bold text-red-700 border-t border-red-200 pt-1 mt-1">
                                                    <span>Missing (ยังขาดอีก):</span>
                                                    <span>{(minSpend * pax) - cartTotal}.-</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className="text-xs font-bold text-gray-400 uppercase block mb-1">{t('yourName')}</label><input type="text" value={contactName} onChange={e => setContactName(e.target.value)} className="w-full bg-white border-b border-gray-200 py-2 focus:border-black outline-none" /></div>
                                            <div><label className="text-xs font-bold text-gray-400 uppercase block mb-1">{t('phoneNumber')}</label><input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} className="w-full bg-white border-b border-gray-200 py-2 focus:border-black outline-none" /></div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Special Request (Note)</label>
                                            <textarea
                                                value={specialRequest}
                                                onChange={e => setSpecialRequest(e.target.value)}
                                                placeholder="แพ้อาหาร, ขอเก้าอี้เด็ก, etc."
                                                className="w-full bg-white border-b border-gray-200 py-2 focus:border-black outline-none resize-none text-sm"
                                                rows={2}
                                            />
                                        </div>

                                        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 text-xs text-yellow-800">
                                            <p className="font-bold mb-2 text-sm">{t('paymentRequired')}</p>

                                            {qrCodeUrl && (
                                                <div className="mb-4 flex justify-center bg-white p-2 rounded-lg border border-yellow-200">
                                                    <img src={qrCodeUrl} alt="Payment QR" className="w-48 h-auto object-contain" />
                                                </div>
                                            )}

                                            <p>{t('uploadSlipDesc')}</p>
                                            <p className="mt-2 opacity-75 whitespace-pre-line leading-relaxed border-t border-yellow-200/50 pt-2">
                                                {policyNote || t('minCondition')}
                                            </p>

                                            <label className="flex items-center gap-2 mt-4 cursor-pointer">
                                                <input type="checkbox" checked={isAgreed} onChange={e => setIsAgreed(e.target.checked)} className="accent-black w-4 h-4" />
                                                <span className="font-bold">{t('agreeTerms')}</span>
                                            </label>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-gray-400 uppercase block mb-2">{t('uploadSlip')}</label>
                                            <input type="file" accept="image/*" onChange={e => setSlipFile(e.target.files[0])} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-black file:text-white file:text-xs file:font-bold hover:file:bg-gray-800 cursor-pointer" />
                                        </div>
                                    </div>

                                    <button onClick={handleSubmit} disabled={submitting || !isAgreed || !slipFile} className="w-full bg-black text-white py-4 rounded-xl font-bold mt-6 shadow-lg disabled:opacity-20 transition-all flex justify-center items-center gap-2">
                                        {submitting ? t('processing') : t('confirmBooking')}
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>
        </div >
    )
}
