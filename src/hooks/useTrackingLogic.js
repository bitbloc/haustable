import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useTrackingLogic(token) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [timeLeft, setTimeLeft] = useState('')
  const [isDataLoaded, setIsDataLoaded] = useState(false)

  const fetchTrackingInfo = async () => {
    try {
      const { data: resData, error: apiError } = await supabase.functions.invoke('get-tracking-info', {
        body: { token },
      })

      if (apiError) {
        // Handle 404 from Function (Booking not found)
        if (apiError.status === 404 || (apiError.context && apiError.context.status === 404)) {
            throw new Error('ไม่พบข้อมูลการจอง (Booking not found)')
        }
        throw apiError
      }
      if (resData.error) {
        if (resData.code === 'TOKEN_EXPIRED') throw new Error('ลิงก์นี้หมดอายุแล้ว (Link Expired)')
        if (resData.code === 'NOT_FOUND') throw new Error('ไม่พบข้อมูลการจอง (Booking not found)')
        throw new Error(resData.error)
      }

      setData(resData)
      setIsDataLoaded(true)
      setError(null) 
    } catch (err) {
      console.error('Tracking Error:', err)
      setError(err.message || 'ไม่สามารถโหลดข้อมูลได้')
    } finally {
      setLoading(false)
    }
  }

  // Poll for updates
  useEffect(() => {
    fetchTrackingInfo()
    
    // Adaptive polling: Poll faster if not yet completed/cancelled
    let intervalTime = 45000 
    if (data && ['pending', 'confirmed', 'preparing', 'seated'].includes(data.status)) {
        intervalTime = 15000 
    }

    const interval = setInterval(fetchTrackingInfo, intervalTime)
    return () => clearInterval(interval)
  }, [token, data?.status])

  // Countdown Logic
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

  return { data, loading, error, timeLeft, isDataLoaded }
}
