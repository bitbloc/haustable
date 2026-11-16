import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { pickOpenBill } from '../utils/staffOrder'

/**
 * A table and its live bill for the staff phone remote. Read-only: the bill is changed only through
 * the submit_staff_order RPC and closed only at the POS. Reloads when the POS or another phone
 * changes the bill's rows.
 */
export function useStaffBill(tableId) {
    const [table, setTable] = useState(null)
    const [bill, setBill] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [live, setLive] = useState(false)
    const [updatedAt, setUpdatedAt] = useState(null)
    const mountedRef = useRef(true)
    const billIdRef = useRef(null)

    const load = useCallback(async () => {
        const id = Number(tableId)
        if (!Number.isInteger(id)) {
            setError('TABLE_NOT_FOUND')
            setLoading(false)
            return
        }
        try {
            const [tableRes, billsRes] = await Promise.all([
                supabase.from('tables_layout').select('id, table_name, capacity').eq('id', id).maybeSingle(),
                supabase
                    .from('bookings')
                    .select('*, order_items(*, menu_items(name))')
                    .eq('table_id', id)
                    .in('status', ['pending', 'confirmed', 'seated', 'ready'])
                    .order('booking_time', { ascending: false }),
            ])
            if (tableRes.error) throw tableRes.error
            if (billsRes.error) throw billsRes.error
            if (!mountedRef.current) return

            if (!tableRes.data) {
                setError('TABLE_NOT_FOUND')
                return
            }
            let open = pickOpenBill(billsRes.data)
            // Dev server only: a sample bill for checking the screens when no table is open. Stripped from builds.
            if (import.meta.env.DEV && !open && new URLSearchParams(window.location.search).get('fixture') === '1') {
                open = (await import('../staff/__fixtures__/sampleBill.js')).sampleBill()
            }
            if (open) {
                open.order_items = [...(open.order_items || [])].sort(
                    (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
                )
            }
            billIdRef.current = open?.id || null
            setTable(tableRes.data)
            setBill(open)
            setError(null)
            setUpdatedAt(new Date())
        } catch (err) {
            console.error('[useStaffBill] load failed:', err)
            if (mountedRef.current) setError('LOAD_FAILED')
        } finally {
            if (mountedRef.current) setLoading(false)
        }
    }, [tableId])

    useEffect(() => {
        mountedRef.current = true
        setLoading(true)
        load()

        let timer = null
        const reload = () => {
            if (timer) clearTimeout(timer)
            timer = setTimeout(() => { if (mountedRef.current) load() }, 300)
        }
        const id = Number(tableId)
        const channel = supabase
            .channel(`staff-bill-${id}-${Math.random().toString(36).slice(2, 8)}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `table_id=eq.${id}` }, reload)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, (payload) => {
                const bookingId = payload.new?.booking_id || payload.old?.booking_id
                if (!billIdRef.current || !bookingId || bookingId === billIdRef.current) reload()
            })
            .subscribe((status) => { if (mountedRef.current) setLive(status === 'SUBSCRIBED') })

        const onVisible = () => { if (document.visibilityState === 'visible') reload() }
        document.addEventListener('visibilitychange', onVisible)

        return () => {
            mountedRef.current = false
            if (timer) clearTimeout(timer)
            document.removeEventListener('visibilitychange', onVisible)
            supabase.removeChannel(channel)
        }
    }, [tableId, load])

    return { table, bill, loading, error, live, updatedAt, reload: load }
}
