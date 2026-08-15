/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useTrackingLogic(token) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [timeLeft, setTimeLeft] = useState('')
  const [isDataLoaded, setIsDataLoaded] = useState(false)
  const isFetchingRef = useRef(false)

  const fetchTrackingInfo = useCallback(async () => {
    if (!token || isFetchingRef.current) return
    isFetchingRef.current = true

    try {
      const { data: resData, error: apiError } = await supabase.functions.invoke('get-tracking-info', {
        body: { token },
      })

      if (apiError) {
        if (apiError.status === 404 || apiError.context?.status === 404) {
            throw new Error('ไม่พบข้อมูลคำสั่งซื้อ (Order not found)')
        }
        if (apiError.status === 410 || apiError.context?.status === 410) {
            throw new Error('ลิงก์นี้หมดอายุแล้ว (Link Expired)')
        }
        throw apiError
      }
      if (resData?.error) {
        if (resData.code === 'TOKEN_EXPIRED') throw new Error('ลิงก์นี้หมดอายุแล้ว (Link Expired)')
        if (resData.code === 'NOT_FOUND') throw new Error('ไม่พบข้อมูลคำสั่งซื้อ (Order not found)')
        throw new Error(resData.error)
      }

      setData(resData)
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

  // Realtime Postgres Changes Subscription + Polling Fallback
  useEffect(() => {
    fetchTrackingInfo()

    if (!token) return

    // 1. Direct Realtime Subscription on Booking Token
    const channel = supabase
      .channel(`tracking-realtime-${token}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'bookings',
        filter: `tracking_token=eq.${token}`
      }, (payload) => {
        fetchTrackingInfo()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'order_items'
      }, () => {
        fetchTrackingInfo()
      })
      .subscribe()

    // 2. Backup Polling (every 30s) in case of websocket drop
    const interval = setInterval(fetchTrackingInfo, 30000)

    return () => {
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
