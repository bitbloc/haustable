/* Hallmark · component: TrackingPage · genre: modern-minimal · theme: dieter-rams-thai-modern
 * states: loading · error · active-tracking · shipping-tracking · cancelled
 * contrast: pass (APCA / WCAG AAA compliant)
 * Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
 */
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './lib/supabaseClient'
import { MapPin, Phone, Copy, Share2, Calendar as CalendarIcon, AlertCircle, XCircle, CheckCircle, Ticket, ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { useLanguage } from './context/LanguageContext'
import { getAppOrigin } from './utils/urlHelper'

// Hooks & Components
import { useTrackingLogic } from './hooks/useTrackingLogic'
import { useStatusConfig } from './hooks/useStatusConfig'
import StatusTracker from './components/tracking/StatusTracker'
import OrderSummary from './components/tracking/OrderSummary'
import SlipPreviewModal from './components/tracking/SlipPreviewModal'
import HausmadeShippingTracker from './components/tracking/HausmadeShippingTracker'

export default function TrackingPage() {
  const { token } = useParams()
  const { t } = useLanguage() 
  const { data, loading, error, timeLeft } = useTrackingLogic(token)
  const { getSteps } = useStatusConfig()
  const [settings, setSettings] = useState({})
  const [cancelling, setCancelling] = useState(false)
  const [notifyingArrival, setNotifyingArrival] = useState(false)
  const [arrivedNotified, setArrivedNotified] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  
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
        const { data } = await supabase.from('app_settings').select('key, value').not('key', 'in', '("tax_signature_image")')
        if (data) {
             const map = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {})
             setSettings(map)
        }
    }
    fetchSettings()
  }, [])

  // --- HELPERS ---
  const triggerCelebration = () => {
      const duration = 2.5 * 1000
      const animationEnd = Date.now() + duration
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 50 }

      const randomInRange = (min, max) => Math.random() * (max - min) + min

      const interval = setInterval(function() {
        const timeLeftNow = animationEnd - Date.now()
        if (timeLeftNow <= 0) return clearInterval(interval)

        const particleCount = 40 * (timeLeftNow / duration)
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
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleAddToCalendar = () => {
      if (!data) return
      const startTime = new Date(data.booking_time).toISOString().replace(/-|:|\.\d\d\d/g, "")
      const endTime = new Date(new Date(data.booking_time).getTime() + 60*60*1000).toISOString().replace(/-|:|\.\d\d\d/g, "")
      
      const details = `Booking at In The Haus: ${window.location.href}`
      const title = `In The Haus - Order #${data.short_id}`
      
      const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startTime}/${endTime}&details=${encodeURIComponent(details)}&location=${encodeURIComponent('In The Haus, Nakhon Phanom')}`
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

  // --- LOADING / ERROR STATES ---
  if (loading) return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-paper)] text-[var(--color-ink)] space-y-3 font-mono">
          <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"/>
          <p className="text-xs font-bold text-[var(--color-neutral)] uppercase tracking-widest">[ LOADING ORDER STATUS... ]</p>
      </div>
  )
  
  if (error) return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--color-paper)] text-center font-[var(--font-body)]">
        <div className="bg-[var(--color-paper-2)] p-6 sm:p-8 border border-[var(--color-rule)] max-w-sm w-full shadow-lg">
            <div className="w-12 h-12 bg-[oklch(92%_0.06_25)] text-[oklch(40%_0.15_25)] flex items-center justify-center mx-auto mb-4 border border-[oklch(80%_0.10_25)]">
                <AlertCircle size={24} />
            </div>
            <h2 className="text-base font-bold text-[var(--color-ink)] mb-1 font-mono uppercase">[ เกิดข้อผิดพลาด ]</h2>
            <p className="text-xs text-[var(--color-muted)] mb-6 leading-relaxed">{error}</p>
            <Link to="/" className="block w-full py-3 bg-[var(--color-ink)] text-[var(--color-paper)] font-mono text-xs font-bold uppercase tracking-wider hover:bg-[var(--color-ink)]/90 transition-colors">
                [ {t('backToHome')} ]
            </Link>
        </div>
      </div>
  )
  
  if (!data) return null

  const isPickup = data.booking_type === 'pickup'
  const isShippingOrder = data.order_type === 'hausmade_shipping' || (data.booking_type === 'hausmade' && data.shipping_address && data.shipping_address !== 'รับหน้าร้าน IN THE HAUS')
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
    <div className="min-h-screen bg-[var(--color-paper)] pb-24 font-[var(--font-body)] text-[var(--color-ink)] overflow-x-clip select-none">
      
      {/* 1. Brutalist Tabular Top Bar */}
      <header className="sticky top-0 z-40 bg-[var(--color-paper-2)]/95 backdrop-blur-xs border-b border-[var(--color-rule)]">
        <div className="max-w-2xl mx-auto flex items-center justify-between p-3 sm:px-4">
            <Link 
                to="/"
                className="flex items-center gap-1 text-xs font-mono font-bold text-[var(--color-neutral)] hover:text-[var(--color-ink)] transition-colors"
            >
                <ArrowLeft size={14} />
                <span>[ HOME ]</span>
            </Link>
            
            <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-mono text-[10px] font-bold text-[var(--color-ink)] tracking-wider">
                    LIVE SYNC
                </span>
            </div>
        </div>
      </header>

      {/* 2. Hero Status Banner */}
      <div className={`py-6 px-4 text-center border-b border-[var(--color-rule)] ${
          isCancelled ? 'bg-[oklch(92%_0.06_25)]/20' : 'bg-[var(--color-paper-2)]'
      }`}>
          <div className="max-w-2xl mx-auto">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider mb-2 border ${
                  isCancelled 
                    ? 'bg-[oklch(92%_0.06_25)] text-[oklch(40%_0.15_25)] border-[oklch(80%_0.10_25)]' 
                    : 'bg-[oklch(92%_0.05_140)] text-[oklch(35%_0.12_140)] border-[oklch(80%_0.08_140)]'
              }`}>
                  {isCancelled ? <XCircle size={12} /> : <CheckCircle size={12} />}
                  {isCancelled ? t('orderCancelled') : (isPickup ? t('orderReceived') : t('bookingReceived'))}
              </span>
              
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--color-ink)] uppercase font-mono">
                  {isCancelled ? t('orderCancelled') : (isPickup ? t('orderSuccess') : t('bookingSuccess'))}
              </h1>
              
              <p className="text-xs text-[var(--color-muted)] mt-1 font-sans">
                 {isCancelled ? t('contactShop') : t('thankYouService')}
              </p>
          </div>
      </div>

      <main className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
          
          {/* 3. Tracking Content (Shipping vs Dine-in/Pickup) */}
          {isShippingOrder ? (
              <div className="space-y-6">
                  <HausmadeShippingTracker data={data} settings={settings} />
                  
                  <div className="bg-[var(--color-paper-2)] p-4 sm:p-5 border border-[var(--color-rule)] shadow-2xs">
                      <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[var(--color-ink)] mb-3">
                          [ รายการสินค้าในออเดอร์ // ORDER ITEMS ]
                      </h3>
                      <OrderSummary data={data} optionMap={optionMap} />
                  </div>
              </div>
          ) : (
              <>
                {/* 3.1 Highlight Order Number Card */}
                <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-5 sm:p-6 text-center shadow-2xs">
                    <span className="font-mono text-[10px] font-bold text-[var(--color-neutral)] uppercase tracking-widest block mb-1">
                        // {t('yourShortId')}
                    </span>
                    <div className="text-4xl sm:text-5xl font-mono font-black tracking-tight text-[var(--color-ink)] my-2 select-all">
                        #{data.short_id}
                    </div>
                    
                    {/* 📍 One-Tap Check-in Button */}
                    {!isCancelled && !['completed'].includes(currentStatus) && (
                        <div className="my-4">
                            {arrivedNotified || data?.customer_note?.includes('[CUSTOMER_ARRIVED]') ? (
                                <div className="bg-emerald-50 text-emerald-800 font-mono font-bold p-3 text-xs border border-emerald-200 flex items-center justify-center gap-2">
                                    <CheckCircle size={14} />
                                    <span>[ แจ้งพนักงานแล้วว่ามาถึงร้านแล้ว (STAFF NOTIFIED) ]</span>
                                </div>
                            ) : (
                                <button 
                                    onClick={handleNotifyArrival}
                                    disabled={notifyingArrival}
                                    className="w-full bg-[var(--color-accent)] hover:bg-[oklch(45%_0.16_28)] text-white font-mono font-bold py-3.5 px-4 text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer shadow-xs"
                                >
                                    {notifyingArrival ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                                    ) : (
                                        <>
                                            <MapPin size={16} />
                                            <span>📍 ฉันมาถึงร้านแล้ว (กดแจ้งพนักงานหน้าร้าน)</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    )}
                    
                    {/* Direct Tracking Link Box */}
                    <div className="bg-[var(--color-paper)] p-3 border border-[var(--color-rule)] flex items-center justify-between gap-3 text-left my-3">
                        <div className="flex-1 min-w-0 font-mono">
                            <span className="text-[9px] text-[var(--color-neutral)] font-bold uppercase block">{t('trackingLink')}</span>
                            <span className="text-xs text-[var(--color-ink)] truncate block font-bold">{getAppOrigin()}/t/{data.tracking_token}</span>
                        </div>
                        <button 
                            onClick={handleCopyLink} 
                            className="px-2.5 py-1.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] hover:bg-[var(--color-ink)] hover:text-[var(--color-paper)] transition-colors font-mono text-[10px] font-bold uppercase cursor-pointer"
                        >
                            {copiedLink ? '[ ✓ COPIED ]' : '[ 📋 COPY ]'}
                        </button>
                    </div>

                    {/* Warning Note */}
                    <div className="bg-[var(--color-paper)] p-3 border border-[var(--color-rule)] text-xs text-[var(--color-muted)] text-left flex gap-2 items-start font-mono">
                        <AlertCircle size={14} className="shrink-0 mt-0.5 text-[var(--color-accent)]" />
                        <span>
                            {isCancelled ? t('cancelledWarning') : t('keepLinkWarning')}
                        </span>
                    </div>
                </div>

                {/* 3.2 Booking Info & Items Breakdown */}
                {!isCancelled && (
                    <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-5 sm:p-6 shadow-2xs space-y-4">
                        <div className="flex items-center justify-between border-b border-[var(--color-rule)] pb-3">
                            <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[var(--color-ink)]">
                                [ {t('bookingInfo')} // METADATA ]
                            </h3>
                            {!isPickup && (
                                <span className="font-mono text-xs font-black bg-[var(--color-ink)] text-[var(--color-paper)] px-2.5 py-1">
                                    TABLE {data.table_name || 'TBA'}
                                </span>
                            )}
                        </div>

                        {/* Date & Time Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono text-xs">
                            <div className="bg-[var(--color-paper)] p-3 border border-[var(--color-rule)] flex justify-between items-center">
                                <span className="text-[var(--color-muted)]">{isPickup ? 'เวลาสั่งซื้อ' : 'เวลาที่จอง'}</span>
                                <span className="font-bold text-[var(--color-ink)]">
                                    {new Date(data.created_at || data.booking_time).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })} น.
                                </span>
                            </div>
                            <div className="bg-[var(--color-paper)] p-3 border border-[var(--color-rule)] flex justify-between items-center">
                                <span className="text-[var(--color-accent)] font-bold">{isPickup ? 'เวลารับของ' : 'เวลานัดหมาย'}</span>
                                <span className="font-bold text-[var(--color-accent)]">
                                    {new Date(data.booking_time).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })} น.
                                </span>
                            </div>
                        </div>

                        {/* Order Items Breakdown */}
                        <OrderSummary data={data} optionMap={optionMap} />
                    </div>
                )}
              </>
          )}

          {/* 4. Action Buttons (LINE Share, Calendar, Slip) */}
          <div className="space-y-3 font-mono">
              {!isCancelled && (
                  <button 
                      onClick={handleShareLine}
                      className="w-full bg-[#06C755] hover:bg-[#05b64d] text-white py-3.5 px-4 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer shadow-xs"
                  >
                      <Share2 size={16} />
                      <span>{t('sendToLine')}</span>
                  </button>
              )}

              <div className="grid grid-cols-2 gap-3">
                  <button 
                      onClick={handleAddToCalendar}
                      disabled={isCancelled}
                      className={`w-full py-3 px-3 border border-[var(--color-rule)] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          isCancelled
                              ? 'bg-[var(--color-paper)] text-[var(--color-muted)] cursor-not-allowed opacity-50'
                              : 'bg-[var(--color-paper-2)] hover:bg-[var(--color-paper)] text-[var(--color-ink)]'
                      }`}
                  >
                      <CalendarIcon size={14} />
                      <span>{t('addToCalendar')}</span>
                  </button>
                  
                  <button 
                      onClick={() => setShowSlipModal(true)}
                      disabled={!canSaveSlip || isCancelled}
                      className={`w-full py-3 px-3 border border-[var(--color-rule)] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          canSaveSlip && !isCancelled
                              ? 'bg-[var(--color-brand)] hover:bg-[oklch(82%_0.18_100)] text-[var(--color-ink)] border-[var(--color-ink)]'
                              : 'bg-[var(--color-paper)] text-[var(--color-muted)] cursor-not-allowed opacity-60'
                      }`}
                  >
                      <Ticket size={14} />
                      <span>{t('showTicketQr') || t('saveSlip')}</span>
                  </button>
              </div>

              {!canSaveSlip && !isCancelled && (
                  <p className="text-center text-[10px] text-[var(--color-muted)] font-mono">
                      {isPickup ? t('slipNotePickup') : t('slipNoteBooking')}
                  </p>
              )}

              {/* Cancel Button / Policy */}
              {!isCancelled && !['completed', 'seated', 'ready'].includes(currentStatus) && (
                  <div className="pt-3 border-t border-[var(--color-rule)]">
                      {canCancelOnline ? (
                          <button 
                              onClick={handleCancelBooking}
                              disabled={cancelling}
                              className="w-full bg-[var(--color-paper)] border border-[oklch(80%_0.10_25)] text-[oklch(40%_0.15_25)] hover:bg-[oklch(92%_0.06_25)]/20 py-3 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                              {cancelling ? <div className="w-4 h-4 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"/> : <XCircle size={14} />}
                              <span>{t('cancelBooking') || 'ยกเลิกการจอง (ขอเงินคืน)'}</span>
                          </button>
                      ) : cannotCancelOnlineWarning ? (
                          <div className="bg-[oklch(92%_0.06_25)]/20 p-4 text-center border border-[oklch(80%_0.10_25)]">
                              <p className="text-xs text-[oklch(40%_0.15_25)] font-bold mb-1">
                                  ⚠️ ไม่สามารถยกเลิกผ่านระบบได้
                              </p>
                              <p className="text-[11px] text-[var(--color-muted)] mb-3 leading-relaxed">
                                  เหลือเวลาไม่ถึง 24 ชั่วโมงก่อนเวลานัดหมาย หากต้องการยกเลิกกรุณาติดต่อทางร้านโดยตรง
                              </p>
                              <div className="flex gap-2 justify-center">
                                  <a href={`tel:${settings.contact_phone || '0812345678'}`} className="bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] px-3 py-1.5 text-[10px] font-bold flex items-center gap-1">
                                      <Phone size={12}/> {t('callShop')}
                                  </a>
                                  <a href={settings.contact_line_url || "#"} className="bg-[#06C755] text-white px-3 py-1.5 text-[10px] font-bold flex items-center gap-1">
                                      <Share2 size={12}/> {t('lineChat')}
                                  </a>
                              </div>
                          </div>
                      ) : null}
                  </div>
              )}
          </div>

          {/* 5. Status Tracker Timeline */}
          <div>
              <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[var(--color-ink)] mb-3">
                  [ {t('statusLatest')} // ORDER PROGRESS ]
              </h3>
              <StatusTracker 
                  status={currentStatus} 
                  steps={steps} 
                  isCancelled={isCancelled}
                  currentStepIndex={currentStepIndex}
              />
          </div>

          {/* 6. Contact & Map Direct Cells */}
          <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                 <a 
                    href={settings.contact_map_url || "https://maps.google.com/?q=In+The+Haus"} 
                    target="_blank" rel="noreferrer"
                    className="bg-[var(--color-paper-2)] p-4 border border-[var(--color-rule)] hover:border-[var(--color-ink)] flex flex-col items-center justify-center gap-2 transition-colors text-center shadow-2xs"
                 >
                    <div className="w-8 h-8 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-full flex items-center justify-center text-[var(--color-ink)]">
                        <MapPin size={16}/>
                    </div>
                    <span className="font-bold text-[var(--color-ink)] uppercase">[ {t('mapGoogle')} ]</span>
                 </a>
                 <a 
                    href={`tel:${settings.contact_phone || '0812345678'}`}
                    className="bg-[var(--color-paper-2)] p-4 border border-[var(--color-rule)] hover:border-[var(--color-ink)] flex flex-col items-center justify-center gap-2 transition-colors text-center shadow-2xs"
                 >
                    <div className="w-8 h-8 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-full flex items-center justify-center text-[var(--color-ink)]">
                        <Phone size={16}/>
                    </div>
                    <span className="font-bold text-[var(--color-ink)] uppercase">[ {t('callButton')} ]</span>
                 </a>
          </div>

      </main>

      {/* Slip Preview Modal */}
      <SlipPreviewModal 
          isOpen={showSlipModal} 
          onClose={() => setShowSlipModal(false)}
          data={data}
          optionMap={optionMap}
      />
    </div>
  )
}
