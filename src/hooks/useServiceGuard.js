import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { toast } from 'sonner'

export function useServiceGuard(modeKey) {
    const navigate = useNavigate()
    const [isChecking, setIsChecking] = useState(true)

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const { data } = await supabase.from('app_settings').select('key, value').in('key', [modeKey, 'shop_mode', 'opening_time', 'closing_time'])
                if (data) {
                    const s = data.reduce((acc, i) => ({ ...acc, [i.key]: i.value }), {})
                    const mode = s[modeKey] || s['shop_mode'] || 'auto'
                    
                    let isOpen = false
                    if (mode === 'manual_open') isOpen = true
                    else if (mode === 'manual_close') isOpen = false
                    else {
                        const now = new Date()
                        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
                        isOpen = currentTime >= (s.opening_time || '00:00') && currentTime < (s.closing_time || '23:59')
                    }

                    if (!isOpen) {
                        toast.error('ขออภัยครับ บริการนี้ปิดทำการชั่วคราว')
                        navigate('/', { replace: true })
                    } else {
                        setIsChecking(false)
                    }
                }
            } catch (err) {
                console.error("Service guard error", err)
                setIsChecking(false)
            }
        }
        checkStatus()
    }, [modeKey, navigate])

    return isChecking
}
