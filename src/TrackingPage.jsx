import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './lib/supabaseClient'
import { MapPin, Phone, Copy, Share2, Clock, CheckCircle, ChefHat, Utensils, XCircle, AlertCircle, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from './context/LanguageContext'

// --- CONSTANTS ---
const BOOKING_STEPS = [
  { key: 'pending', label: 'รอพนักงานยืนยัน', sub: 'Waiting for Confirmation', icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-50' },
  { key: 'confirmed', label: 'จองโต๊ะสำเร็จ', sub: 'Table Reserved', icon: CheckCircle, color: 'text-blue-500', bg: 'bg-blue-50' },
  { key: 'seated', label: 'เช็คอินแล้ว', sub: 'Arrived', icon: Utensils, color: 'text-green-500', bg: 'bg-green-50' },
  { key: 'completed', label: 'เสร็จสิ้น', sub: 'Completed', icon: CheckCircle, color: 'text-gray-400', bg: 'bg-gray-100' },
]

const PICKUP_STEPS = [
  { key: 'pending', label: 'รอรับออเดอร์', sub: 'Order Sent', icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-50' },
  { key: 'confirmed', label: 'กำลังเตรียม', sub: 'Preparing', icon: ChefHat, color: 'text-orange-500', bg: 'bg-orange-50' }, // Mapping 'confirmed' to Preparing for simplicity if no separate state
  { key: 'preparing', label: 'กำลังปรุงอาหาร', sub: 'Cooking', icon: ChefHat, color: 'text-orange-500', bg: 'bg-orange-50' },
  { key: 'ready', label: 'อาหารเสร็จแล้ว', sub: 'Ready for Pickup', icon: Utensils, color: 'text-white', bg: 'bg-green-500' }, // Special High Contrast
  { key: 'completed', label: 'รับสินค้าแล้ว', sub: 'Collected', icon: CheckCircle, color: 'text-gray-400', bg: 'bg-gray-100' },
]

export default function TrackingPage() {
  const { token } = useParams()
  const { t } = useLanguage() // Use context if available
  const [data, setData] = useState(null)
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isAccordionOpen, setIsAccordionOpen] = useState(false)
  const [timeLeft, setTimeLeft] = useState('')

  // Fetch App Settings (Map, Phone)
  useEffect(() => {
    const fetchSettings = async () => {
        const { data } = await supabase.from('app_settings').select('payment_qr_url, service_charge_percent').single() 
        // Note: Phone and Map might need to be added to app_settings or hardcoded if not present. 
        // For now using placeholder or if user added them.
        if (data) setSettings(data)
    }
    fetchSettings()
  }, [])

  const fetchTrackingInfo = async () => {
    try {
      const { data: resData, error: apiError } = await supabase.functions.invoke('get-tracking-info', {
        body: { token },
      })

      if (apiError) throw apiError
      if (resData.error) {
        // Handle specific codes
        if (resData.code === 'TOKEN_EXPIRED') throw new Error('ลิงก์นี้หมดอายุแล้ว (Link Expired)')
        throw new Error(resData.error)
      }

      setData(resData)
      // Clear error if success
      setError(null) 
    } catch (err) {
      console.error('Tracking Error:', err)
      setError(err.message || 'ไม่สามารถโหลดข้อมูลได้')
    } finally {
      setLoading(false)
    }
  }

  // Adaptive Polling
  useEffect(() => {
    fetchTrackingInfo()
    
    // Determine interval based on status
    let intervalTime = 45000 // Default 45s
    if (data) {
        if (['pending', 'confirmed', 'preparing'].includes(data.status)) {
            intervalTime = 15000 // Faster update for active states
        }
    }

    const interval = setInterval(fetchTrackingInfo, intervalTime)
    return () => clearInterval(interval)
  }, [token, data?.status]) // Re-run if status changes

  // Countdown Logic (For Booking)
  useEffect(() => {
    if (!data?.booking_time) return
    const timer = setInterval(() => {
        const now = new Date()
        const target = new Date(data.booking_time)
        const diff = target - now
        
        if (diff > 0) {
            const hours = Math.floor(diff / (1000 * 60 * 60))
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
            setTimeLeft(`${hours}h ${minutes}m`)
        } else {
            setTimeLeft('Arrived')
        }
    }, 60000)
    return () => clearInterval(timer)
  }, [data?.booking_time])


  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Order #${data?.short_id || ''} - In The Haus`,
          text: `เช็คสถานะออเดอร์ ${data?.short_id} ของคุณ ${data?.customer_name} ได้ที่นี่`,
          url: url,
        })
      } catch (error) { console.log('Error sharing:', error) }
    } else {
      navigator.clipboard.writeText(url)
      alert('คัดลอกลิงก์แล้ว!')
    }
  }

  if (loading) return (
      <div className="flex flex-col h-screen items-center justify-center bg-gray-50 space-y-4">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-black rounded-full animate-spin"/>
          <p className="text-gray-400 text-sm font-medium animate-pulse">Loading Tracking Info...</p>
      </div>
  )
  
  // ERROR STATE UI
  if (error) return (
      <div className="flex flex-col h-screen items-center justify-center p-8 bg-gray-50 text-center">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 max-w-sm w-full">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={32} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">เกิดข้อผิดพลาด</h2>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed">{error}</p>
            
            <a href="/" className="block w-full py-4 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-all">
                กลับหน้าหลัก
            </a>
          </div>
      </div>
  )
  
  if (!data) return null

  const isPickup = data.booking_type === 'pickup'
  const steps = isPickup ? PICKUP_STEPS : BOOKING_STEPS
  
  // Normalize Status
  let currentStatus = data.status?.toLowerCase() || 'pending'
  // Fix for pickup 'ready' mapping if needed, or stick to DB status enum.
  // Assuming DB has 'pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'
  
  const currentStepIndex = steps.findIndex(s => s.key === currentStatus)
  const isCancelled = currentStatus === 'cancelled'
  const isReady = currentStatus === 'ready' && isPickup // Special State

  // --- RENDER: READY STATE (PICKUP ONLY) ---
  if (isReady) {
      return (
        <div className="min-h-screen bg-green-500 text-white flex flex-col items-center justify-between p-8 relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                 <ChefHat size={400} className="absolute -right-20 -top-20 transform rotate-45"/>
                 <Utensils size={300} className="absolute -left-20 bottom-0 transform -rotate-12"/>
            </div>

            <div className="z-10 w-full pt-10">
                 <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-sm font-medium mb-6">
                    <CheckCircle size={16} />
                    Order is Ready
                 </div>
                 <h1 className="text-5xl font-bold mb-2">อาหาร<br/>เสร็จแล้ว!</h1>
                 <p className="text-green-100 text-lg">เชิญรับสินค้าที่เคาน์เตอร์</p>
            </div>

            <div className="z-10 bg-white text-black w-full rounded-3xl p-8 shadow-2xl text-center">
                 <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Order ID</p>
                 <div className="text-6xl font-mono font-bold tracking-tighter mb-4">#{data.short_id}</div>
                 <p className="text-gray-500 text-sm">คุณ {data.customer_name}</p>
                 
                 <div className="mt-8 pt-8 border-t border-gray-100 grid grid-cols-2 gap-4">
                     <div className="text-left">
                        <span className="block text-xs text-gray-400">Items</span>
                        <span className="font-bold text-xl">{data.items?.length || 0}</span>
                     </div>
                     <div className="text-right">
                        <span className="block text-xs text-gray-400">Total</span>
                        <span className="font-bold text-xl">{data.total_amount}.-</span>
                     </div>
                 </div>
            </div>

             <div className="z-10 w-full text-center pb-4 text-green-100 text-xs">
                หากได้รับสินค้าแล้ว กดปุ่มจบงานโดยพนักงาน
             </div>
        </div>
      )
  }

  // --- RENDER: STANDARD FLOW ---
  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-inter text-gray-900 selection:bg-black selection:text-white">
      
      {/* Header */}
      <div className="bg-white px-6 pt-12 pb-8 rounded-b-[2.5rem] shadow-[0_2px_20px_-5px_rgba(0,0,0,0.05)]">
         <div className="flex justify-between items-start mb-6">
             <div>
                <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2 ${isPickup ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                    {isPickup ? 'Pickup Order' : 'Table Booking'}
                </span>
                <h1 className="text-3xl font-bold tracking-tight">#{data.short_id}</h1>
                <p className="text-gray-400 text-sm mt-1">คุณ {data.customer_name}</p>
             </div>
             {/* Simple Status Badge at top right */}
             <div className="text-right">
                <p className="text-xs text-gray-400 mb-1">Status</p>
                <p className={`font-bold ${isCancelled ? 'text-red-500' : 'text-black'}`}>
                    {isCancelled ? 'CANCELLED' : steps[currentStepIndex]?.label || currentStatus}
                </p>
             </div>
         </div>

         {/* Steps Visualization */}
         <div className="relative pl-8 pt-2">
             {/* Vertical Line */}
             <div className="absolute left-[19px] top-4 bottom-4 w-[2px] bg-gray-100"/>
             
             <div className="space-y-8">
                 {steps.map((step, idx) => {
                     const isPast = idx < currentStepIndex
                     const isCurrent = idx === currentStepIndex
                     const Icon = step.icon

                     return (
                         <div key={step.key} className={`relative flex items-center gap-4 ${idx > currentStepIndex ? 'opacity-30 blur-[0.5px]' : ''}`}>
                             <div className={`
                                w-10 h-10 rounded-full flex items-center justify-center z-10 border-4 border-white shadow-sm transition-all duration-500
                                ${isCurrent || isPast ? step.bg + ' ' + step.color : 'bg-gray-100 text-gray-300'}
                                ${isCurrent ? 'scale-110 ring-4 ring-gray-50' : ''}
                             `}>
                                 <Icon size={16} />
                             </div>
                             <div>
                                 <p className={`text-sm font-bold ${isCurrent ? 'text-black' : 'text-gray-500'}`}>{step.label}</p>
                                 {isCurrent && <p className="text-xs text-gray-400 animate-pulse">{step.sub}</p>}
                             </div>
                         </div>
                     )
                 })}
             </div>
         </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6 space-y-6">
        
        {/* Booking Countdown (Only for Dine-in & confirmed/pending) */}
        {!isPickup && !isCancelled && ['pending', 'confirmed'].includes(currentStatus) && (
            <div className="bg-black text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
                <div className="relative z-10 flex justify-between items-center">
                    <div>
                        <p className="text-white/60 text-xs uppercase tracking-wider mb-1">Time until booking</p>
                        <h2 className="text-4xl font-mono font-bold">{timeLeft || '--'}</h2>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold">{new Date(data.booking_time).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit', hour12: false})}</p>
                        <p className="text-white/60 text-xs">{new Date(data.booking_time).toLocaleDateString('en-GB')}</p>
                    </div>
                </div>
                {/* Decoration */}
                <div className="absolute -right-6 -bottom-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"/>
            </div>
        )}

        {/* Info Actions */}
        <div className="grid grid-cols-2 gap-4">
             <a 
                href="https://maps.google.com/?q=In+The+Haus" 
                target="_blank" rel="noreferrer"
                className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
             >
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                    <MapPin size={20}/>
                </div>
                <span className="text-xs font-bold text-gray-700">Get Directions</span>
             </a>
             <a 
                href={`tel:${settings.contact_phone || '0812345678'}`}
                className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
             >
                <div className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                    <Phone size={20}/>
                </div>
                <span className="text-xs font-bold text-gray-700">Call Shop</span>
             </a>
        </div>

        {/* Order Details Accordion */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div 
                onClick={() => setIsAccordionOpen(!isAccordionOpen)}
                className="p-5 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="bg-gray-100 p-2 rounded-lg text-gray-500">
                        <Utensils size={18}/>
                    </div>
                    <div>
                        <p className="font-bold text-sm text-gray-900">Order Summary</p>
                        <p className="text-xs text-gray-400">{data.items?.length || 0} Items</p>
                    </div>
                </div>
                <ArrowRight size={18} className={`text-gray-400 transition-transform ${isAccordionOpen ? 'rotate-90' : ''}`}/>
            </div>
            
            <AnimatePresence>
                {isAccordionOpen && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-5 pb-5 pt-0 border-t border-gray-50">
                            <ul className="mt-4 space-y-4">
                                {data.items?.map((item, i) => (
                                    <li key={i} className="flex justify-between text-sm">
                                        <div className="flex gap-3">
                                            <span className="font-mono text-gray-400 w-6">x{item.quantity}</span>
                                            <div>
                                                <p className="text-gray-900 font-medium">{item.name}</p>
                                                {item.options && Object.keys(item.options).length > 0 && (
                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                        {Object.values(item.options).join(', ')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <span className="font-mono text-gray-500">{item.price * item.quantity}</span>
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-6 pt-4 border-t border-dashed border-gray-200 flex justify-between items-center">
                                <span className="text-sm text-gray-400">Total Amount</span>
                                <span className="text-2xl font-bold font-mono tracking-tight">{data.total_amount}.-</span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
      </div>
      
      {/* Floating Share Button */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <button 
            onClick={handleShare}
            className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all font-bold text-sm"
          >
            <Share2 size={16} />
            Share Tracking Link
          </button>
      </div>

    </div>
  )
}
