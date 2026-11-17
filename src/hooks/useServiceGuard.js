import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { toast } from 'sonner'
import { getLastOrderTime, isWithinBangkokHours } from '../utils/bangkokTime'
import { getEntryBackPath } from '../utils/funnelTracking'

/**
 * Is this service open right now (Asia/Bangkok clock, not the phone's)?
 * cutoff: 'closing' -> open until closing_time
 *         'last_order' -> open until the kitchen last order (qr_kitchen_close_time, 20:45)
 * Returns { status: 'checking' | 'open' | 'error', retry }. On 'closed' it redirects
 * (to /link when the visit came from the ads page, else /). A failed check is reported
 * as 'error' so the page can offer a retry instead of letting the order through blind.
 */
export function useServiceStatus(modeKey, { cutoff = 'closing' } = {}) {
    const navigate = useNavigate()
    const [status, setStatus] = useState('checking')
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        let cancelled = false
        const checkStatus = async () => {
            try {
                const { data, error } = await supabase
                    .from('app_settings')
                    .select('key, value')
                    .in('key', [modeKey, 'shop_mode', 'opening_time', 'closing_time', 'qr_kitchen_close_time'])
                if (error) throw error
                if (cancelled) return
                const s = (data || []).reduce((acc, i) => ({ ...acc, [i.key]: i.value }), {})
                const mode = s[modeKey] || s.shop_mode || 'auto'

                let isOpen
                if (mode === 'manual_open') isOpen = true
                else if (mode === 'manual_close') isOpen = false
                else {
                    const until = cutoff === 'last_order'
                        ? getLastOrderTime({ kitchenCloseTime: s.qr_kitchen_close_time, closingTime: s.closing_time })
                        : (s.closing_time || '23:59')
                    isOpen = isWithinBangkokHours(s.opening_time || '00:00', until)
                }

                if (!isOpen) {
                    toast.error(cutoff === 'last_order'
                        ? 'ขออภัย ตอนนี้ปิดรับออเดอร์แล้ว'
                        : 'ขออภัย บริการนี้ปิดทำการชั่วคราว')
                    const back = getEntryBackPath()
                    // /link is served by api/link.js, outside the React router
                    if (back === '/link') window.location.replace('/link')
                    else navigate('/', { replace: true })
                } else {
                    setStatus('open')
                }
            } catch (err) {
                console.error('Service guard error', err)
                if (!cancelled) setStatus('error')
            }
        }
        setStatus('checking')
        checkStatus()
        return () => { cancelled = true }
    }, [modeKey, cutoff, navigate, attempt])

    const retry = useCallback(() => setAttempt((a) => a + 1), [])
    return { status, retry }
}

// Older call sites (hausmade): boolean "still checking"; an error lets the page render.
export function useServiceGuard(modeKey) {
    const { status } = useServiceStatus(modeKey)
    return status === 'checking'
}
