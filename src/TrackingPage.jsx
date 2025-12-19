import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './lib/supabaseClient'
import { MapPin, Phone, Copy, Share2, Clock, CheckCircle, ChefHat, Utensils, XCircle } from 'lucide-react'
import { motion } from 'framer-motion'

const STATUS_STEPS = [
  { key: 'PENDING', label: 'รอร้านรับ', icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-100' },
  { key: 'CONFIRMED', label: 'รับออเดอร์แล้ว', icon: CheckCircle, color: 'text-blue-500', bg: 'bg-blue-100' },
  { key: 'PREPARING', label: 'กำลังปรุง', icon: ChefHat, color: 'text-orange-500', bg: 'bg-orange-100' },
  { key: 'READY', label: 'พร้อมเสิร์ฟ', icon: Utensils, color: 'text-green-500', bg: 'bg-green-100' },
  { key: 'COMPLETED', label: 'เสร็จสิ้น', icon: CheckCircle, color: 'text-gray-500', bg: 'bg-gray-100' },
]

export default function TrackingPage() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isAccordionOpen, setIsAccordionOpen] = useState(false)

  const fetchTrackingInfo = async () => {
    try {
      const { data: resData, error: apiError } = await supabase.functions.invoke('get-tracking-info', {
        body: { token },
      })

      if (apiError) throw apiError
      if (resData.error) throw new Error(resData.error)

      setData(resData)
    } catch (err) {
      console.error('Tracking Error:', err)
      setError(err.message || 'ไม่สามารถโหลดข้อมูลได้')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTrackingInfo()
    // Auto-refresh every 45 seconds
    const interval = setInterval(fetchTrackingInfo, 45000)
    return () => clearInterval(interval)
  }, [token])

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ติดตามสถานะออเดอร์ - In The Haus',
          text: `เช็คสถานะออเดอร์ของคุณ ${data?.customer_name || ''} ได้ที่นี่`,
          url: url,
        })
      } catch (error) {
        console.log('Error sharing:', error)
      }
    } else {
      navigator.clipboard.writeText(url)
      alert('คัดลอกลิงก์แล้ว!')
    }
  }

  // Get current step index
  const getCurrentStepIndex = (status) => {
    if (status === 'CANCELLED') return -1
    return STATUS_STEPS.findIndex(s => s.key === status)
  }

  if (loading) return <div className="flex h-screen items-center justify-center p-4">กำลังโหลดข้อมูล...</div>
  if (error) return <div className="flex h-screen items-center justify-center p-4 text-red-500">{error}</div>
  if (!data) return null

  const currentStep = getCurrentStepIndex(data.status)
  const isCancelled = data.status === 'CANCELLED'

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header / Hero */}
      <div className="bg-white p-6 shadow-sm rounded-b-3xl">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">สวัสดี, คุณ {data.customer_name}</h1>
        <p className="text-gray-500 text-sm">เลขที่โต๊ะ/Order: {data.table_id || 'N/A'}</p>
        
        {/* Status Display */}
        <div className="mt-8">
            {isCancelled ? (
                <div className="flex flex-col items-center justify-center text-red-500 p-8 border border-red-100 rounded-2xl bg-red-50">
                    <XCircle size={48} className="mb-2"/>
                    <span className="font-semibold text-lg">ออเดอร์ถูกยกเลิก</span>
                </div>
            ) : (
                <div className="space-y-6 relative pl-4 border-l-2 border-gray-100 ml-4">
                  {STATUS_STEPS.slice(0, 4).map((step, index) => {
                    const isActive = index === currentStep
                    const isPassed = index < currentStep
                    const StepIcon = step.icon

                    return (
                      <motion.div 
                        key={step.key}
                        initial={{ opacity: 0.5, x: -10 }}
                        animate={{ opacity: isActive || isPassed ? 1 : 0.4, x: 0 }}
                        className={`flex items-center gap-4 ${isActive ? 'scale-105 origin-left' : ''}`}
                      >
                         <div className={`
                            w-10 h-10 rounded-full flex items-center justify-center z-10 
                            ${isActive ? step.bg + ' ' + step.color + ' ring-4 ring-white shadow-lg' : isPassed ? 'bg-gray-100 text-gray-400' : 'bg-gray-50 text-gray-300'}
                             -ml-[25px] transition-all duration-300
                         `}>
                            <StepIcon size={20} />
                         </div>
                         <div>
                            <p className={`font-semibold ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>{step.label}</p>
                            {isActive && <p className="text-xs text-green-600 animate-pulse">กำลังดำเนินการ...</p>}
                         </div>
                      </motion.div>
                    )
                  })}
                </div>
            )}
        </div>
      </div>

      {/* Info Card */}
      <div className="p-4 space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2 text-gray-700">
                    <Clock size={18} className="text-indigo-500"/>
                    <span className="font-medium">เวลานัดหมาย</span>
                </div>
                <span className="text-lg font-bold text-gray-900">
                    {new Date(data.booking_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                </span>
            </div>
            
             <a 
                href="https://maps.google.com/?q=In+The+Haus" // Replace with actual location if known or variable
                target="_blank" 
                rel="noreferrer"
                className="flex items-center justify-center w-full py-3 gap-2 bg-indigo-50 text-indigo-600 font-semibold rounded-xl hover:bg-indigo-100 transition-colors"
             >
                <MapPin size={18} />
                ดูแผนที่ร้าน
             </a>
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <button 
                onClick={() => setIsAccordionOpen(!isAccordionOpen)}
                className="w-full flex justify-between items-center p-5 bg-white hover:bg-gray-50 transition-colors"
            >
                <span className="font-semibold text-gray-800">รายการอาหาร ({data.items?.length || 0})</span>
                <span className={`text-gray-400 transform transition-transform ${isAccordionOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>
            
            {isAccordionOpen && (
                <div className="p-5 pt-0 border-t border-gray-100">
                    <ul className="space-y-3 mt-4">
                        {data.items?.map((item, i) => (
                            <li key={i} className="flex justify-between text-sm text-gray-600">
                                <span>{item.quantity}x {item.name}</span>
                                <span>{item.price * item.quantity}.-</span>
                            </li>
                        ))}
                    </ul>
                    <div className="mt-4 pt-3 border-t border-dashed border-gray-200 flex justify-between font-bold text-gray-900">
                        <span>ยอดรวม</span>
                        <span>{data.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0)}.-</span>
                    </div>
                </div>
            )}
        </div>
        
        {/* Customer Info (Masked) */}
        <div className="text-center text-xs text-gray-400 mt-8">
            <p>ข้อมูลการติดต่อ: {data.phone}</p>
            <p>Order Token: ...{token?.slice(-6)}</p>
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex gap-3 z-50 max-w-md mx-auto">
         <button 
            onClick={handleShare}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-gray-600 hover:bg-gray-50 rounded-lg active:scale-95 transition-all"
         >
            <Share2 size={20} />
            <span className="text-xs font-medium">แชร์</span>
         </button>
         
         <a 
            href="tel:0812345678" // Replace with shop number
            className="flex-[2] flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 active:scale-95 transition-all hover:bg-indigo-700"
         >
            <Phone size={20} />
            โทรหาร้าน
         </a>
      </div>
    </div>
  )
}
