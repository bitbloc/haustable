import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'

function isValidToken(tok) {
  if (!tok || typeof tok !== 'string') return false
  const clean = tok.trim()
  return /^[a-zA-Z0-9_-]{4,64}$/.test(clean)
}

export function useTrackingLogic(token) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [timeLeft, setTimeLeft] = useState('')
  const [isDataLoaded, setIsDataLoaded] = useState(false)
  const isFetchingRef = useRef(false)

  const fetchTrackingInfo = useCallback(async () => {
    if (!token || !isValidToken(token) || isFetchingRef.current) {
      if (token && !isValidToken(token)) {
        setError('ไม่พบรหัสติดตามออเดอร์ที่ถูกต้อง (Invalid Tracking Link)')
        setLoading(false)
      }
      return
    }
    isFetchingRef.current = true

    try {
      let trackingResult = null

      try {
        const { data: resData, error: apiError } = await supabase.functions.invoke('get-tracking-info', {
          body: { token: token.trim() },
        })

        if (!apiError && resData && !resData.error) {
          trackingResult = resData
        }
      } catch (fnErr) {
        console.warn('[useTrackingLogic] Edge function fallback triggered:', fnErr)
      }

      // Direct DB Fallback if Edge function was unavailable or incomplete
      if (!trackingResult) {
        const { data: dbBooking, error: dbError } = await supabase
          .from('bookings')
          .select(`
            *,
            tables_layout ( table_name ),
            promotion_codes ( code ),
            profiles ( display_name, phone_number ),
            order_items (
              quantity,
              price_at_time,
              custom_name,
              selected_options,
              menu_items ( name, image_url )
            )
          `)
          .eq('tracking_token', token.trim())
          .maybeSingle()

        if (dbBooking) {
          const shortId = token.trim().slice(-4).toUpperCase()
          const fullName = dbBooking.pickup_contact_name || dbBooking.profiles?.display_name || dbBooking.customer_name || 'Guest'
          const safeName = fullName.split(' ')[0]
          let maskedPhone = ''
          const rawPhone = dbBooking.pickup_contact_phone || dbBooking.phone || dbBooking.profiles?.phone_number || ''
          if (rawPhone && rawPhone.length >= 10) {
            const p = rawPhone.replace(/[^0-9]/g, '')
            maskedPhone = `${p.substring(0, 3)}-xxx-${p.substring(p.length - 4)}`
          } else {
            maskedPhone = rawPhone
          }

          const items = dbBooking.order_items?.map((item) => ({
            name: item.custom_name || item.menu_items?.name || 'Unknown Item',
            quantity: item.quantity,
            price: item.price_at_time,
            options: item.selected_options
          })) || []

          trackingResult = {
            id: dbBooking.id,
            short_id: shortId,
            status: dbBooking.status,
            booking_type: dbBooking.booking_type || 'dine_in',
            order_type: dbBooking.order_type || (dbBooking.booking_type === 'hausmade' ? (dbBooking.shipping_address ? 'hausmade_shipping' : 'hausmade_pickup') : null),
            customer_name: safeName,
            full_name: fullName,
            phone: maskedPhone,
            pickup_contact_name: dbBooking.pickup_contact_name,
            pickup_contact_phone: dbBooking.pickup_contact_phone,
            shipping_address: dbBooking.shipping_address,
            shipping_fee: dbBooking.shipping_fee,
            courier_name: dbBooking.courier_name || 'Flash Express',
            tracking_number: dbBooking.tracking_number,
            customer_note: dbBooking.customer_note,
            staff_remark: dbBooking.staff_remark,
            is_preorder: dbBooking.is_preorder,
            preorder_eta: dbBooking.preorder_eta,
            created_at: dbBooking.created_at,
            booking_time: dbBooking.booking_time,
            pax: dbBooking.pax,
            items: items,
            table_name: dbBooking.tables_layout?.table_name,
            total_amount: dbBooking.total_amount,
            discount_amount: dbBooking.discount_amount,
            promotion_codes: dbBooking.promotion_codes,
            profiles: dbBooking.profiles,
            payment_slip_url: dbBooking.payment_slip_url,
            slip_verified: dbBooking.slip_verified,
            token_expires_at: dbBooking.token_expires_at
          }
        } else if (dbError) {
          throw dbError
        }
      }

      if (!trackingResult) {
        throw new Error('ไม่พบข้อมูลคำสั่งซื้อ หรือลิงก์นี้ไม่ถูกต้อง (Order not found)')
      }

      setData(trackingResult)
      setIsDataLoaded(true)
      setError(null) 
    } catch (err) {
      console.error('Tracking Error:', err)
      setError(err.message || 'ไม่สามารถโหลดข้อมูลคำสั่งซื้อได้')
    } finally {
      setLoading(false)
      isFetchingRef.current = false
    }
  }, [token])

  // Realtime Broadcast Room + Postgres Changes Subscription + Polling Fallback
  useEffect(() => {
    fetchTrackingInfo()

    if (!token || !isValidToken(token)) return

    // 1. Dedicated Instant Realtime Broadcast Room for this tracking token (< 50ms)
    const cleanToken = token.trim()
    const channel = supabase
      .channel(`tracking_room_${cleanToken}`)
      .on('broadcast', { event: 'order_status_updated' }, (payload) => {
        console.log('⚡ [Realtime Tracking] Instant broadcast received:', payload)
        const newStatus = payload?.payload?.status
        if (newStatus) {
          // Instant optimistic UI transition
          setData(prev => prev ? { ...prev, status: newStatus } : prev)
        }
        fetchTrackingInfo()
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'bookings',
        filter: `tracking_token=eq.${cleanToken}`
      }, (payload) => {
        const newRow = payload?.new
        if (newRow?.status) {
          setData(prev => prev ? { ...prev, status: newRow.status } : prev)
        }
        fetchTrackingInfo()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'order_items'
      }, () => {
        fetchTrackingInfo()
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || err) {
          console.warn('[Realtime Tracking] Channel error:', status, err)
        }
      })

    // 2. Active Tab Focus / Visibility Listener (Instant sync on resume)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchTrackingInfo()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleVisibilityChange)

    // 3. Backup Polling (every 10s for active orders)
    const interval = setInterval(fetchTrackingInfo, 10000)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [token, fetchTrackingInfo])

  // Countdown Logic for Arrival / Ready time
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

  return { data, loading, error, timeLeft, isDataLoaded, refetch: fetchTrackingInfo }
}
