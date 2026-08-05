import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './lib/supabaseClient'
import { MapPin, Phone, Copy, Share2, Calendar as CalendarIcon, AlertCircle, XCircle, CheckCircle, Ticket } from 'lucide-react'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { useLanguage } from './context/LanguageContext'
import { getAppOrigin } from './utils/urlHelper'

// Hooks & Components
import { useTrackingLogic } from './hooks/useTrackingLogic'
import { useStatusConfig } from './hooks/useStatusConfig'
import BookingSlip from './components/tracking/BookingSlip'
import StatusTracker from './components/tracking/StatusTracker'
import OrderSummary from './components/tracking/OrderSummary'
import SlipPreviewModal from './components/tracking/SlipPreviewModal'

export default function TrackingPage() {
  const { token } = useParams()
  const { t } = useLanguage() 
  const { data, loading, error, timeLeft } = useTrackingLogic(token)
  const { getSteps } = useStatusConfig()
  const [settings, setSettings] = useState({})
  const [cancelling, setCancelling] = useState(false)
  const [notifyingArrival, setNotifyingArrival] = useState(false)
  const [arrivedNotified, setArrivedNotified] = useState(false)
  
  // State for Slip Modal & Options
  const [showSlipModal, setShowSlipModal] = useState(false)
  const [optionMap, setOptionMap] = useState({})

  // Fetch Options Map
  useEffect(() => {
    const fetchOptions = async () => {
        const { data: opts } = await supabase.from('option_choices').select('id, name')
        if (opts) {
            const map = opts.reduce((acc, o) => ({...acc, [o.id]: o.name}), {})
            setOptionMap(map)
        }
    }
    fetchOptions()
  }, [])
  
  // App Settings for Contact Info
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

  // --- HELPERS ---
  const triggerCelebration = () => {
      const duration = 3 * 1000
      const animationEnd = Date.now() + duration
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 50 }

      const randomInRange = (min, max) => Math.random() * (max - min) + min

      const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now()

        if (timeLeft <= 0) {
          return clearInterval(interval)
        }

        const particleCount = 50 * (timeLeft / duration)
        
        confetti({
          ...defaults, 
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        })
        confetti({
          ...defaults, 
          particleCount, 
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        })
      }, 250)
  }

  // Celebration Effect
  useEffect(() => {
      if (!data?.status) return
      
      const isPickup = data.booking_type === 'pickup'
      const status = data.status.toLowerCase()
      
      // Celebrate if completed (dine-in) or ready (pickup)
      const shouldCelebrate = (!isPickup && status === 'completed') || (isPickup && status === 'ready')

      if (shouldCelebrate) {
          triggerCelebration()
      }
  }, [data?.status, data?.booking_type])

  // --- ACTIONS ---
  const handleShareLine = () => {
      const url = window.location.href
      const text = `${t('trackingTitle')} #${data?.short_id}: ${url}`
      window.location.href = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`
  }

  const handleCopyLink = () => {
      navigator.clipboard.writeText(window.location.href)
      alert(t('copyLink') + '!')
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

  const handleNotifyArrival = async () => {
      if (!data?.id) return
      setNotifyingArrival(true)
      try {
          const currentNote = data.customer_note || ''
          if (!currentNote.includes('[CUSTOMER_ARRIVED]')) {
              const updatedNote = `${currentNote}\n[CUSTOMER_ARRIVED] Customer arrived at shop (${new Date().toLocaleTimeString('th-TH')})`
              const { error } = await supabase
                  .from('bookings')
                  .update({ customer_note: updatedNote })
                  .eq('id', data.id)
              if (error) throw error
          }
          setArrivedNotified(true)
      } catch (err) {
          console.error(err)
          alert('เกิดข้อผิดพลาดในการแจ้งพนักงาน กรุณาลองอีกครั้ง')
      } finally {
          setNotifyingArrival(false)
      }
  }

  const handleCancelBooking = async () => {
      if (!window.confirm(t('confirmCancel') || 'คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการจองนี้?')) return;
      
      setCancelling(true)
      try {
          const { error } = await supabase
              .from('bookings')
              .update({ status: 'cancelled' })
              .eq('id', data.id)
              
          if (error) throw error
          window.location.reload()
      } catch (err) {
          console.error(err)
          alert('ไม่สามารถยกเลิกการจองได้ กรุณาลองใหม่อีกครั้ง')
      } finally {
          setCancelling(false)
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
                {t('backToHome')}
            </a>
        </div>
      </div>
  )
  
  if (!data) return null

  const isPickup = data.booking_type === 'pickup'
  const steps = getSteps(isPickup)
  const currentStatus = data.status?.toLowerCase() || 'pending'
  const currentStepIndex = steps.findIndex(s => s.key === currentStatus)
  const isCancelled = ['cancelled', 'void', 'rejected'].includes(currentStatus)
  
  // Logic to Enable Slip Download
  const isBookingConfirmed = !isPickup && ['confirmed', 'seated', 'completed'].includes(currentStatus)
  const isPickupReady = isPickup && ['ready', 'completed'].includes(currentStatus)
  const canSaveSlip = isBookingConfirmed || isPickupReady

  // Cancellation Logic (24 hours rule)
  const bookingTime = new Date(data.booking_time).getTime()
  const now = Date.now()
  const hoursUntilBooking = (bookingTime - now) / (1000 * 60 * 60)
  const canCancelOnline = hoursUntilBooking > 24 && !isCancelled && !['completed', 'seated', 'ready'].includes(currentStatus)
  const cannotCancelOnlineWarning = hoursUntilBooking <= 24 && !isCancelled && !['completed', 'seated', 'ready'].includes(currentStatus)

  return (
    <div className="min-h-screen bg-[oklch(97%_0.008_28)] pb-32 font-inter text-[oklch(18%_0.012_28)] selection:bg-[oklch(52%_0.16_28)] selection:text-white overflow-hidden relative">
      
      {/* 🔴 LIVE SYNC INDICATOR */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm border border-gray-100">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
        <span className="text-[10px] font-bold text-gray-600 tracking-wider">LIVE SYNC</span>
      </div>

      {/* 1. Header Area with Gradient */}
      <div className={`pt-12 pb-6 px-6 text-center ${isCancelled ? 'bg-red-50' : 'bg-gradient-to-b from-[oklch(94%_0.010_28)] to-[oklch(97%_0.008_28)]'}`}>
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }}
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 ${isCancelled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
          >
              {isCancelled ? <XCircle size={14} /> : <CheckCircle size={14} />}
              {isCancelled ? t('orderCancelled') : (isPickup ? t('orderReceived') : t('bookingReceived'))}
          </motion.div>
          <h1 className={`text-3xl font-bold mb-2 ${isCancelled ? 'text-red-600' : 'text-[#1A1A1A]'}`}>
              {isCancelled ? t('orderCancelled') : (isPickup ? t('orderSuccess') : t('bookingSuccess'))}
          </h1>
          <p className="text-gray-500 text-sm">
             {isCancelled ? t('contactShop') : t('thankYouService')}
          </p>
      </div>

      {/* 2. Highlight Box (The "Realize" Section) */}
      <div className="px-6 mb-8">
          <div className="bg-white rounded-3xl p-6 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.08)] border border-[oklch(85%_0.012_28)] text-center relative overflow-hidden">
             {/* Decorative background blob */}
             <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl ${isCancelled ? 'bg-red-400/10' : 'bg-[oklch(52%_0.16_28)]/10'}`} />
             
             <p className="text-xs font-bold text-[oklch(55%_0.010_28)] uppercase tracking-widest mb-2">{t('yourShortId')}</p>
             <div className="text-5xl font-mono font-bold tracking-tighter text-[oklch(18%_0.012_28)] mb-4">
                 #{data.short_id}
             </div>
             
             {/* 📍 One-Tap Check-in Button */}
             {!isCancelled && !['completed'].includes(currentStatus) && (
                 <div className="mb-4">
                     {arrivedNotified || data?.customer_note?.includes('[CUSTOMER_ARRIVED]') ? (
                         <div className="bg-emerald-50 text-emerald-700 font-bold px-4 py-3 rounded-xl text-xs border border-emerald-200 flex items-center justify-center gap-2">
                             <CheckCircle size={16} />
                             แจ้งพนักงานแล้วว่ามาถึงร้านแล้ว! (Staff Notified)
                         </div>
                     ) : (
                         <button 
                             onClick={handleNotifyArrival}
                             disabled={notifyingArrival}
                             className="w-full bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white font-bold py-3.5 px-4 rounded-xl shadow-md text-sm transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                         >
                             {notifyingArrival ? (
                                 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                             ) : (
                                 <>
                                     <MapPin size={18} />
                                     📍 ฉันมาถึงร้านแล้ว (กดแจ้งพนักงานหน้าร้าน)
                                 </>
                             )}
                         </button>
                     )}
                 </div>
             )}
             
             <div className="bg-gray-50 rounded-xl p-3 mb-4 flex items-center justify-between gap-3 border border-gray-100">
                 <div className="flex-1 min-w-0">
                     <p className="text-[10px] text-gray-400 text-left mb-0.5 uppercase font-bold">{t('trackingLink')}</p>
                     <p className="text-xs text-blue-600 truncate font-mono text-left">{getAppOrigin()}/t/{data.tracking_token}</p>
                 </div>
                 <button onClick={handleCopyLink} className="p-2 bg-white rounded-lg shadow-sm hover:bg-gray-100 transition-colors text-gray-600">
                     <Copy size={16} />
                 </button>
             </div>

             <div className={`${isCancelled ? 'bg-red-50 text-red-600' : 'bg-red-50 text-red-600'} px-4 py-3 rounded-xl text-xs font-medium flex gap-2 items-start text-left`}>
                 <AlertCircle size={16} className="shrink-0 mt-0.5" />
                 {isCancelled 
                    ? t('cancelledWarning')
                    : t('keepLinkWarning')
                 }
             </div>
          </div>
      </div>

       {/* 2.5 Order Summary & Table */}
       {!isCancelled && (
        <div className="px-6 mb-8">
            <h3 className="font-bold text-gray-900 mb-4">{t('bookingInfo')}</h3>
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                {/* Table Name */}
                {!isPickup && (
                    <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-100">
                        <span className="text-sm font-medium text-gray-500">{t('tableNumber')}</span>
                        <span className="text-2xl font-bold bg-black text-white px-4 py-2 rounded-xl">
                            {data.table_name || 'TBA'}
                        </span>
                    </div>
                )}

                {/* Date & Time */}
                <div className="flex flex-col gap-3 mb-6 pb-6 border-b border-gray-100">
                    <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <span className="block text-xs font-bold text-gray-500">{isPickup ? 'วันที่ทำรายการ (Order Date)' : 'วันที่จอง (Booking Made)'}</span>
                        <div className="text-right">
                             <span className="block text-sm font-bold text-gray-900">{new Date(data.created_at || data.booking_time).toLocaleDateString('th-TH')}</span>
                             <span className="block text-[10px] text-gray-500">{new Date(data.created_at || data.booking_time).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})} น.</span>
                        </div>
                    </div>
                    <div className="flex justify-between items-center bg-[oklch(97%_0.008_28)] p-3 rounded-xl border border-[oklch(85%_0.012_28)]">
                        <span className="block text-xs font-bold text-[oklch(18%_0.012_28)]">{isPickup ? 'เวลารับของ (Pickup Time)' : 'เวลานัดหมาย (Reservation)'}</span>
                        <div className="text-right">
                             <span className="block text-sm font-bold text-[oklch(52%_0.16_28)]">{new Date(data.booking_time).toLocaleDateString('th-TH')}</span>
                             <span className="block text-[10px] text-[oklch(52%_0.16_28)] font-bold">{new Date(data.booking_time).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})} น.</span>
                        </div>
                    </div>
                </div>

                <OrderSummary data={data} optionMap={optionMap} />
            </div>
        </div>
       )}

      {/* 3. Action Buttons */}
      <div className="px-6 mb-10 space-y-3">
          {/* Contact Actions for Cancelled - Prominent */}
          {isCancelled && (
              <div className="grid grid-cols-2 gap-3 mb-4 animate-in fade-in slide-in-from-bottom-4">
                  <a 
                     href={`tel:${settings.contact_phone || '0812345678'}`}
                     className="bg-[oklch(18%_0.012_28)] text-white p-4 rounded-xl shadow-lg flex flex-col items-center justify-center gap-2 hover:bg-black transition-all active:scale-95"
                  >
                     <Phone size={24}/>
                     <span className="text-xs font-bold">{t('callShop')}</span>
                  </a>
                  <a 
                     href={settings.contact_line_url || "#"} 
                     target="_blank" rel="noreferrer"
                     className="bg-[#06C755] text-white p-4 rounded-xl shadow-lg shadow-green-500/20 flex flex-col items-center justify-center gap-2 hover:bg-[#05b64d] transition-all active:scale-95"
                  >
                     <Share2 size={24}/> 
                     <span className="text-xs font-bold">{t('lineChat')}</span>
                  </a>
              </div>
          )}

          {!isCancelled && (
             <button 
                onClick={handleShareLine}
                className="w-full bg-[#06C755] hover:bg-[#05b64d] text-white py-4 rounded-xl font-bold shadow-lg shadow-green-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                <Share2 size={20} />
                {t('sendToLine')}
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
                  {t('addToCalendar')}
              </button>
              
              <button 
                onClick={() => setShowSlipModal(true)}
                disabled={!canSaveSlip || isCancelled}
                className={`w-full border py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-all
                    ${(canSaveSlip && !isCancelled)
                        ? 'bg-[#DFFF00] border-transparent text-black shadow-md hover:bg-[#cbe600] active:scale-[0.98]' 
                        : 'bg-gray-100 border-transparent text-gray-400 cursor-not-allowed'}
                `}
              >
                  <Ticket size={18} />
                  {t('showTicketQr') || t('saveSlip')}
              </button>
              
              {/* Slip Modal */}
              <SlipPreviewModal 
                isOpen={showSlipModal} 
                onClose={() => setShowSlipModal(false)}
                data={data}
                optionMap={optionMap}
              />
          </div>
            {!canSaveSlip && !isCancelled && (
                <p className="text-center text-xs text-red-400 mt-2">
                    {isPickup ? t('slipNotePickup') : t('slipNoteBooking')}
                </p>
            )}

            {/* Cancel Button section */}
            {!isCancelled && !['completed', 'seated', 'ready'].includes(currentStatus) && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                    {canCancelOnline ? (
                        <button 
                            onClick={handleCancelBooking}
                            disabled={cancelling}
                            className="w-full bg-white border border-red-200 text-red-600 hover:bg-red-50 py-3 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                            {cancelling ? <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"/> : <XCircle size={18} />}
                            {t('cancelBooking') || 'ยกเลิกการจอง (ขอเงินคืน)'}
                        </button>
                    ) : cannotCancelOnlineWarning ? (
                        <div className="bg-red-50 p-4 rounded-xl text-center border border-red-100">
                            <p className="text-xs text-red-600 font-bold mb-2">
                                ⚠️ ไม่สามารถยกเลิกผ่านระบบได้
                            </p>
                            <p className="text-[10px] text-red-500 mb-3">
                                เหลือเวลาไม่ถึง 24 ชั่วโมงก่อนเวลานัดหมาย หากต้องการยกเลิกกรุณาติดต่อทางร้านโดยตรง (สงวนสิทธิ์ไม่คืนเงินมัดจำ)
                            </p>
                            <div className="flex gap-2 justify-center">
                                <a href={`tel:${settings.contact_phone || '0812345678'}`} className="bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm">
                                    <Phone size={12}/> {t('callShop')}
                                </a>
                                <a href={settings.contact_line_url || "#"} className="bg-[#06C755] text-white px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm">
                                    <Share2 size={12}/> {t('lineChat')}
                                </a>
                            </div>
                        </div>
                    ) : null}
                </div>
            )}
      </div>

      {/* 4. Status Tracker */}
      <div className="px-6 mb-8">
          <h3 className="font-bold text-gray-900 mb-4">{t('statusLatest')}</h3>
          <StatusTracker 
            status={currentStatus} 
            steps={steps} 
            isCancelled={isCancelled}
            currentStepIndex={currentStepIndex}
          />
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
                <span className="text-xs font-bold text-gray-700">{t('mapGoogle')}</span>
             </a>
             <a 
                href={`tel:${settings.contact_phone || '0812345678'}`}
                className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
             >
                <div className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                    <Phone size={20}/>
                </div>
                <span className="text-xs font-bold text-gray-700">{t('callButton')}</span>
             </a>
      </div>

    </div>
  )
}
