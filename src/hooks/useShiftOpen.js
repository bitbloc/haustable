import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/**
 * Is a shift open at the POS right now? The staff phone remote only orders and corrects during a shift;
 * the database enforces it (submit_staff_order / staff_adjust_order_item answer NO_OPEN_SHIFT),
 * this only lets the screens say so up front.
 * Returns true, false, or null while unknown (first load, no signal): unknown never blocks the screen.
 */
export function useShiftOpen() {
    const [open, setOpen] = useState(null)
    const mountedRef = useRef(true)

    useEffect(() => {
        mountedRef.current = true
        const check = async () => {
            try {
                const { data, error } = await supabase.rpc('pos_has_open_shift')
                if (!mountedRef.current) return
                setOpen(error ? null : data === true)
            } catch {
                if (mountedRef.current) setOpen(null)
            }
        }
        check()

        let timer = null
        const recheck = () => {
            if (timer) clearTimeout(timer)
            timer = setTimeout(check, 300)
        }
        const channel = supabase
            .channel(`staff-shift-${Math.random().toString(36).slice(2, 8)}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_shifts' }, recheck)
            .subscribe()
        // Realtime may not carry pos_shifts: also look again when the phone wakes, and once a minute
        const onVisible = () => { if (document.visibilityState === 'visible') recheck() }
        document.addEventListener('visibilitychange', onVisible)
        const poll = setInterval(check, 60000)

        return () => {
            mountedRef.current = false
            if (timer) clearTimeout(timer)
            clearInterval(poll)
            document.removeEventListener('visibilitychange', onVisible)
            supabase.removeChannel(channel)
        }
    }, [])

    return open
}

export const SHIFT_CLOSED_TEXT = 'ยังไม่ได้เปิดกะที่เครื่อง POS ดูบิลได้ แต่สั่ง แก้รายการ และรับเงินไม่ได้จนกว่าจะเปิดกะ'
