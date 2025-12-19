import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './lib/supabaseClient'
import { MapPin, Phone, Copy, Share2, Clock, CheckCircle, ChefHat, Utensils, XCircle, AlertCircle, ArrowRight, Download, Calendar as CalendarIcon, Lock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from './context/LanguageContext'
import html2canvas from 'html2canvas'
import QRCode from 'qrcode'

// --- CONSTANTS ---
const BOOKING_STEPS = [
  { key: 'pending', label: 'รอพนักงานยืนยัน', sub: 'Waiting for Confirmation', icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-50' },
  { key: 'confirmed', label: 'จองโต๊ะสำเร็จ', sub: 'Table Reserved', icon: CheckCircle, color: 'text-blue-500', bg: 'bg-blue-50' },
  { key: 'seated', label: 'เช็คอินแล้ว', sub: 'Arrived', icon: Utensils, color: 'text-green-500', bg: 'bg-green-50' },
  { key: 'completed', label: 'เสร็จสิ้น', sub: 'Completed', icon: CheckCircle, color: 'text-gray-400', bg: 'bg-gray-100' },
]

const PICKUP_STEPS = [
  { key: 'pending', label: 'รอรับออเดอร์', sub: 'Order Sent', icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-50' },
  { key: 'confirmed', label: 'กำลังเตรียม', sub: 'Preparing', icon: ChefHat, color: 'text-orange-500', bg: 'bg-orange-50' }, 
  { key: 'preparing', label: 'กำลังปรุงอาหาร', sub: 'Cooking', icon: ChefHat, color: 'text-orange-500', bg: 'bg-orange-50' },
  { key: 'ready', label: 'อาหารเสร็จแล้ว', sub: 'Ready for Pickup', icon: Utensils, color: 'text-white', bg: 'bg-green-500' }, 
  { key: 'completed', label: 'รับสินค้าแล้ว', sub: 'Collected', icon: CheckCircle, color: 'text-gray-400', bg: 'bg-gray-100' },
]

export default function TrackingPage() {
  const { token } = useParams()
  // eslint-disable-next-line no-unused-vars
  const { t } = useLanguage() 
  const [data, setData] = useState(null)
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isAccordionOpen, setIsAccordionOpen] = useState(true) // Open by default
  const [timeLeft, setTimeLeft] = useState('')
  const [downloadingSlip, setDownloadingSlip] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  
  const slipRef = useRef(null)

  // Fetch App Settings
  useEffect(() => {
    const fetchSettings = async () => {
        const { data } = await supabase.from('app_settings').select('*')
        if (data) {
             const map = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {})
             setSettings(map)
        }
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
        if (resData.code === 'TOKEN_EXPIRED') throw new Error('ลิงก์นี้หมดอายุแล้ว (Link Expired)')
        throw new Error(resData.error)
      }

      setData(resData)
      setError(null) 
    } catch (err) {
      console.error('Tracking Error:', err)
      setError(err.message || 'ไม่สามารถโหลดข้อมูลได้')
    } finally {
      setLoading(false)
    }
  }

  // Generate QR
  useEffect(() => {
      if (token) {
          const url = `${window.location.origin}/t/${token}` // Use token or short_id URL
          QRCode.toDataURL(url, { width: 200, margin: 2 }, (err, url) => {
              if (!err) setQrDataUrl(url)
          })
      }
  }, [token])

  // Adaptive Polling
  useEffect(() => {
    fetchTrackingInfo()
    let intervalTime = 45000 
    if (data && ['pending', 'confirmed', 'preparing'].includes(data.status)) {
        intervalTime = 15000 
    }
    const interval = setInterval(fetchTrackingInfo, intervalTime)
    return () => clearInterval(interval)
  }, [token, data?.status]) 

  // Countdown
  useEffect(() => {
    if (!data?.booking_time) return
    const updateTime = () => {
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
    }
    updateTime()
    const timer = setInterval(updateTime, 60000)
    return () => clearInterval(timer)
  }, [data?.booking_time])


  // --- ACTIONS ---

  const handleShareLine = () => {
      const url = window.location.href
      const text = `เช็คสถานะออเดอร์ #${data?.short_id} ของฉันได้ที่นี่: ${url}`
      window.location.href = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`
  }

  const handleCopyLink = () => {
      navigator.clipboard.writeText(window.location.href)
      alert('คัดลอกลิงก์เรียบร้อย!')
  }

  const handleAddToCalendar = () => {
      if (!data) return
      const startTime = new Date(data.booking_time).toISOString().replace(/-|:|\.\d\d\d/g, "")
      const endTime = new Date(new Date(data.booking_time).getTime() + 60*60*1000).toISOString().replace(/-|:|\.\d\d\d/g, "")
      
      const details = `Booking at In The Haus using Link: ${window.location.href}`
      const title = `In The Haus - Order #${data.short_id}`
      
      const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startTime}/${endTime}&details=${encodeURIComponent(details)}&location=${encodeURIComponent('In The Haus')}`
      window.open(googleUrl, '_blank')
  }

  const handleDownloadSlip = async () => {
      if (!slipRef.current) return
      if (!qrDataUrl) return alert("QR Code ยังไม่พร้อม")

      setDownloadingSlip(true)
      try {
          // Force render sync?
          await new Promise(r => setTimeout(r, 100))

          const canvas = await html2canvas(slipRef.current, {
              scale: 2,
              backgroundColor: '#ffffff',
              logging: false,
              useCORS: true // Safe now with dataUrl
          })
          
          const image = canvas.toDataURL("image/png")
          const link = document.createElement('a')
          link.href = image
          link.download = `Slip-${data.short_id}.png`
          link.click()
          
      } catch (err) {
          console.error("Slip Error:", err)
          alert("ไม่สามารถบันทึกรูปได้: " + err.message)
      } finally {
          setDownloadingSlip(false)
      }
  }

  // --- RENDER ---
  if (loading) return (
      <div className="flex flex-col h-screen items-center justify-center bg-gray-50 space-y-4">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-black rounded-full animate-spin"/>
          <p className="text-gray-400 text-sm font-medium animate-pulse">Loading...</p>
      </div>
  )
  
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
  let currentStatus = data.status?.toLowerCase() || 'pending'
  const currentStepIndex = steps.findIndex(s => s.key === currentStatus)
  
  // Logic to Enable Slip Download
  // Booking: Confirmed or later
  // Pickup: Ready or later
  const isBookingConfirmed = !isPickup && ['confirmed', 'seated', 'completed'].includes(currentStatus)
  const isPickupReady = isPickup && ['ready', 'completed'].includes(currentStatus)
  const canSaveSlip = isBookingConfirmed || isPickupReady
  const isCancelled = ['cancelled', 'void', 'rejected'].includes(currentStatus)

  return (
    <div className="min-h-screen bg-gray-50 pb-32 font-inter text-gray-900 selection:bg-black selection:text-white">
      
      {/* 1. Header Area with Gradient */}
      <div className={`pt-10 pb-6 px-6 text-center ${isCancelled ? 'bg-red-50' : 'bg-gradient-to-b from-white to-gray-50'}`}>
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }}
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 ${isCancelled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
          >
              {isCancelled ? <XCircle size={14} /> : <CheckCircle size={14} />}
              {isCancelled ? 'Cancelled' : (isPickup ? 'Order Received' : 'Booking Received')}
          </motion.div>
          <h1 className={`text-3xl font-bold mb-2 ${isCancelled ? 'text-red-600' : 'text-[#1A1A1A]'}`}>
              {isCancelled ? 'รายการถูกยกเลิก' : (isPickup ? 'สั่งอาหารสำเร็จ!' : 'จองโต๊ะสำเร็จ!')}
          </h1>
          <p className="text-gray-500 text-sm">
             {isCancelled ? 'กรุณาติดต่อร้านค้าเพื่อสอบถามข้อมูลเพิ่มเติม' : 'ขอบคุณที่ใช้บริการครับ'}
          </p>
      </div>

      {/* 2. Highlight Box (The "Realize" Section) */}
      <div className="px-6 mb-8">
          <div className="bg-white rounded-3xl p-6 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.08)] border border-gray-100 text-center relative overflow-hidden">
             {/* Decorative background blob */}
             <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl ${isCancelled ? 'bg-red-400/10' : 'bg-yellow-400/10'}`} />
             
             <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Your Short ID</p>
             <div className="text-5xl font-mono font-bold tracking-tighter text-black mb-4">
                 #{data.short_id}
             </div>
             
             <div className="bg-gray-50 rounded-xl p-3 mb-4 flex items-center justify-between gap-3 border border-gray-100">
                 <div className="flex-1 min-w-0">
                     <p className="text-[10px] text-gray-400 text-left mb-0.5 uppercase font-bold">Tracking Link</p>
                     <p className="text-xs text-blue-600 truncate font-mono text-left">{window.location.host}/t/{data.short_id}</p>
                 </div>
                 <button onClick={handleCopyLink} className="p-2 bg-white rounded-lg shadow-sm hover:bg-gray-100 transition-colors text-gray-600">
                     <Copy size={16} />
                 </button>
             </div>

             <div className={`${isCancelled ? 'bg-red-50 text-red-600' : 'bg-red-50 text-red-600'} px-4 py-3 rounded-xl text-xs font-medium flex gap-2 items-start text-left`}>
                 <AlertCircle size={16} className="shrink-0 mt-0.5" />
                 {isCancelled 
                    ? 'รายการนี้ถูกยกเลิก โปรดติดต่อร้านค้าหากมีข้อสงสัย'
                    : 'โปรดเก็บลิงก์นี้ไว้ เพื่อใช้ตรวจสอบสถานะอาหารและคิวของคุณ'
                 }
             </div>
          </div>
      </div>

      {/* 3. Action Buttons */}
      <div className="px-6 mb-10 space-y-3">
          {/* Contact Actions for Cancelled - Prominent */}
          {isCancelled && (
              <div className="grid grid-cols-2 gap-3 mb-4 animate-in fade-in slide-in-from-bottom-4">
                  <a 
                     href={`tel:${settings.contact_phone || '0812345678'}`}
                     className="bg-black text-white p-4 rounded-xl shadow-lg shadow-black/20 flex flex-col items-center justify-center gap-2 hover:bg-gray-900 transition-all active:scale-95"
                  >
                     <Phone size={24}/>
                     <span className="text-xs font-bold">Call Shop</span>
                  </a>
                  <a 
                     href={settings.contact_line_url || "#"} 
                     target="_blank" rel="noreferrer"
                     className="bg-[#06C755] text-white p-4 rounded-xl shadow-lg shadow-green-500/20 flex flex-col items-center justify-center gap-2 hover:bg-[#05b64d] transition-all active:scale-95"
                  >
                     <Share2 size={24}/> {/* Using Share2 icon logic as placeholder if needed, or specific component */}
                     <span className="text-xs font-bold">Line Chat</span>
                  </a>
              </div>
          )}

          {!isCancelled && (
             <button 
                onClick={handleShareLine}
                className="w-full bg-[#06C755] hover:bg-[#05b64d] text-white py-4 rounded-xl font-bold shadow-lg shadow-green-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                <Share2 size={20} />
                ส่งเข้า LINE
            </button>
          )}
          
          <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={handleAddToCalendar}
                disabled={isCancelled}
                className={`w-full border py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-all
                    ${isCancelled 
                        ? 'bg-gray-50 border-transparent text-gray-300 cursor-not-allowed opacity-50' 
                        : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50 active:scale-[0.98]'}
                `}
              >
                  <CalendarIcon size={18} />
                  Add to Calendar
              </button>
              <button 
                onClick={handleDownloadSlip}
                disabled={!canSaveSlip || downloadingSlip || isCancelled}
                className={`w-full border py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-all
                    ${(canSaveSlip && !isCancelled)
                        ? 'bg-white border-gray-200 hover:bg-gray-50 text-gray-900 active:scale-[0.98]' 
                        : 'bg-gray-100 border-transparent text-gray-400 cursor-not-allowed'}
                `}
              >
                  {canSaveSlip ? <Download size={18} /> : <Lock size={18} />}
                  {downloadingSlip ? 'Saving...' : 'Save Slip'}
              </button>
          </div>
            {!canSaveSlip && !isCancelled && (
                <p className="text-center text-xs text-red-400 mt-2">
                    {isPickup ? '*บันทึกได้เมื่ออาหารเสร็จแล้ว' : '*บันทึกได้เมื่อยืนยันโต๊ะแล้ว'}
                </p>
            )}
      </div>

      {/* 4. Status Tracker */}
      <div className="px-6 mb-8">
          <h3 className="font-bold text-gray-900 mb-4">สถานะล่าสุด</h3>
          <div className={`rounded-3xl p-6 shadow-sm border ${isCancelled ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
              
                {isCancelled ? (
                     <div className="text-center py-8">
                         <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in duration-300">
                             <XCircle size={32} />
                         </div>
                         <h2 className="text-xl font-bold text-red-700 mb-2">Order Cancelled</h2>
                         <p className="text-sm text-red-600/80">
                             ขออภัย รายการนี้ถูกยกเลิก<br/>โปรดติดต่อเจ้าหน้าที่
                         </p>
                     </div>
                ) : (
                    <div className="relative pl-2">
                        <div className="absolute left-[19px] top-2 bottom-4 w-[2px] bg-gray-100"/>
                        <div className="space-y-6">
                            {steps.map((step, idx) => {
                                const isCurrent = idx === currentStepIndex
                                const isActive = idx <= currentStepIndex
                                return (
                                    <div key={step.key} className={`relative flex items-center gap-4 ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                                        <div className={`
                                            w-10 h-10 rounded-full flex items-center justify-center z-10 border-4 border-white shadow-sm
                                            ${isActive ? step.bg + ' ' + step.color : 'bg-gray-100 text-gray-300'}
                                            ${isCurrent ? 'ring-2 ring-offset-2 ring-blackScale' : ''}
                                        `}>
                                            <step.icon size={16} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900">{step.label}</p>
                                            {isCurrent && <p className="text-xs text-orange-500 animate-pulse">{step.sub}</p>}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
          </div>
      </div>

      {/* 5. Contact & Map */}
      <div className="px-6 mb-8 grid grid-cols-2 gap-4">
             <a 
                href={settings.contact_map_url || "https://maps.google.com/?q=In+The+Haus"} 
                target="_blank" rel="noreferrer"
                className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
             >
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                    <MapPin size={20}/>
                </div>
                <span className="text-xs font-bold text-gray-700">Google Maps</span>
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

      {/* Hidden Slip Component for Capture */}
      <div className="fixed top-0 left-0 -z-50 opacity-0 pointer-events-none">
          <div ref={slipRef} className="w-[400px] bg-white p-8 text-center text-black font-inter border border-gray-200">
               <div className="mb-6">
                   <h2 className="text-2xl font-bold tracking-tight">IN THE HAUS</h2>
                   <p className="text-xs text-gray-400 uppercase tracking-widest">Booking Slip</p>
               </div>
               
               <div className="border-t border-b border-black py-6 mb-6">
                   <p className="text-sm text-gray-500 mb-1">Make Note of this ID</p>
                   <div className="text-6xl font-mono font-bold tracking-tight">#{data.short_id}</div>
               </div>
               
               <div className="text-left space-y-2 mb-8 text-sm">
                   <div className="flex justify-between">
                       <span className="text-gray-500">Guest Name</span>
                       <span className="font-bold">{data.customer_name}</span>
                   </div>
                   <div className="flex justify-between">
                       <span className="text-gray-500">Date</span>
                       <span className="font-bold">{new Date(data.booking_time).toLocaleDateString()}</span>
                   </div>
                   <div className="flex justify-between">
                       <span className="text-gray-500">Time</span>
                       <span className="font-bold">{new Date(data.booking_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                   </div>
                   {/* Table or Pickup Info */}
                   {data.tables_layout && (
                         <div className="flex justify-between">
                             <span className="text-gray-500">Table</span>
                             <span className="font-bold">{data.tables_layout.table_name}</span>
                         </div>
                   )}
                   {isPickup && (
                         <div className="flex justify-between">
                             <span className="text-gray-500">Type</span>
                             <span className="font-bold">Take Away</span>
                         </div>
                   )}

                    {data.items?.length > 0 && (
                        <div className="flex justify-between">
                            <span className="text-gray-500">Items</span>
                            <span className="font-bold">{data.items.length} items</span>
                        </div>
                    )}
                   <div className="flex justify-between border-t border-dashed border-gray-300 pt-2 mt-2">
                       <span className="font-bold">Total</span>
                       <span className="font-bold">{data.total_amount}.-</span>
                   </div>
               </div>
               
               <div className="bg-gray-100 p-4 rounded-xl">
                   <p className="text-xs text-gray-500 mb-2">Scan to Track</p>
                   {qrDataUrl && (
                        <img 
                            src={qrDataUrl} 
                            className="w-24 h-24 mx-auto mix-blend-multiply"
                            alt="QR"
                        />
                   )}
               </div>
          </div>
      </div>

    </div>
  )
}
