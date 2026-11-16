/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { summariseTables, formatBaht, formatDwell } from '../utils/staffOrder'
import { useShiftOpen, SHIFT_CLOSED_TEXT } from '../hooks/useShiftOpen'
import './StaffRemote.css'

const clock = (date) => date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

const FILTERS = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'open', label: 'มีบิล' },
    { key: 'free', label: 'ว่าง' },
]

/* The floor as a waiter needs it on a phone: every table, what it owes, who is calling. Tap a table to open its bill. */
export default function StaffTableList({ onOpenTable }) {
    const [tables, setTables] = useState([])
    const [bookings, setBookings] = useState([])
    const [loading, setLoading] = useState(true)
    const [failed, setFailed] = useState(false)
    const [filter, setFilter] = useState('all')
    const [now, setNow] = useState(() => new Date())
    const mountedRef = useRef(true)
    const shiftOpen = useShiftOpen()

    const load = useCallback(async () => {
        try {
            const since = new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString()
            const [tablesRes, bookingsRes] = await Promise.all([
                supabase.from('tables_layout').select('id, table_name, capacity').order('table_name'),
                supabase
                    .from('bookings')
                    .select('id, table_id, status, booking_type, booking_time, created_at, staff_remark, customer_note, discount_amount, xhaus_discount, deposit_amount, total_amount, order_items(id, quantity, price_at_time)')
                    .in('status', ['pending', 'confirmed', 'seated', 'ready'])
                    .not('table_id', 'is', null)
                    .gte('booking_time', since),
            ])
            if (tablesRes.error) throw tablesRes.error
            if (bookingsRes.error) throw bookingsRes.error
            if (!mountedRef.current) return
            setTables(tablesRes.data || [])
            setBookings(bookingsRes.data || [])
            setFailed(false)
            setNow(new Date())
        } catch (err) {
            console.error('[StaffTableList] load failed:', err)
            if (mountedRef.current) setFailed(true)
        } finally {
            if (mountedRef.current) setLoading(false)
        }
    }, [])

    useEffect(() => {
        mountedRef.current = true
        load()
        let timer = null
        const reload = () => {
            if (timer) clearTimeout(timer)
            timer = setTimeout(() => { if (mountedRef.current) load() }, 400)
        }
        const channel = supabase
            .channel(`staff-floor-${Math.random().toString(36).slice(2, 8)}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, reload)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, reload)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tables_layout' }, reload)
            .subscribe()
        const tick = setInterval(() => setNow(new Date()), 60000)
        const onVisible = () => { if (document.visibilityState === 'visible') reload() }
        document.addEventListener('visibilitychange', onVisible)
        return () => {
            mountedRef.current = false
            if (timer) clearTimeout(timer)
            clearInterval(tick)
            document.removeEventListener('visibilitychange', onVisible)
            supabase.removeChannel(channel)
        }
    }, [load])

    const rows = useMemo(() => summariseTables(tables, bookings, now), [tables, bookings, now])
    const openCount = rows.filter(r => r.state === 'open').length
    const calling = rows.filter(r => r.callStaff || r.callBill)
    const shown = rows.filter(r => filter === 'all' || (filter === 'open' ? r.state === 'open' : r.state === 'free'))

    let lede = `มีบิลเปิด ${openCount} จาก ${rows.length} โต๊ะ แตะโต๊ะเพื่อดูบิลหรือสั่งอาหาร`
    if (calling.length > 0) lede = `${calling.map(r => r.name).join(', ')} เรียกอยู่ · มีบิลเปิด ${openCount} จาก ${rows.length} โต๊ะ`

    return (
        <main className="sd-wrap sr-main sr-main--floor">
            {shiftOpen === false && <p className="sr-notice is-warn" role="status">{SHIFT_CLOSED_TEXT}</p>}
            {!loading && !failed && <p className={`sr-lede ${calling.length > 0 ? 'is-strong' : ''}`}>{lede}</p>}

            <div className="sd-tabs" role="tablist" aria-label="กรองโต๊ะ">
                {FILTERS.map(f => (
                    <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} className={`sd-tab ${filter === f.key ? 'is-active' : ''}`} onClick={() => setFilter(f.key)}>
                        {f.label}
                    </button>
                ))}
            </div>

            {failed && (
                <div className="sr-notice is-warn" role="alert">
                    โหลดรายการโต๊ะไม่ได้ ตรวจสัญญาณอินเทอร์เน็ตแล้วลองอีกครั้ง
                    <div className="sr-notice__actions">
                        <button type="button" className="sr-btn sr-btn--ghost" onClick={load}>ลองอีกครั้ง</button>
                    </div>
                </div>
            )}

            {!failed && (
                <section className="sd-panel sr-floor" aria-busy={loading}>
                    {loading && [0, 1, 2, 3].map(i => (
                        <div key={i} className="sr-table"><span className="sr-table__main"><span className="sd-bar sd-bar--line" /><span className="sd-bar sd-bar--sub" /></span></div>
                    ))}
                    {!loading && shown.length === 0 && (
                        <p className="sd-note">{filter === 'open' ? 'ยังไม่มีโต๊ะที่เปิดบิล' : (filter === 'free' ? 'ไม่มีโต๊ะว่าง' : 'ยังไม่ได้ตั้งค่าโต๊ะ')}</p>
                    )}
                    {!loading && shown.map(row => {
                        let sub = `ว่าง · ${row.capacity || '-'} ที่นั่ง`
                        if (row.state === 'blocked') sub = 'ปิดใช้งานชั่วคราว'
                        else if (row.state === 'open') sub = `นั่ง ${formatDwell(row.minutes)} · ${row.itemCount} รายการ`
                        else if (row.arriving) sub = `ว่าง · มีจอง ${clock(row.arriving)}`
                        return (
                            <button key={row.id} type="button" className="sr-table" onClick={() => onOpenTable(row)} disabled={row.state === 'blocked'}>
                                <span className="sr-table__main">
                                    <span className="sr-table__name">{row.name}</span>
                                    <span className="sr-table__sub">{sub}</span>
                                </span>
                                <span className="sr-table__side">
                                    {row.callStaff && <span className="sr-chip is-cart">เรียกพนักงาน</span>}
                                    {row.callBill && <span className="sr-chip is-cart">ขอเช็กบิล</span>}
                                    {row.state === 'open' && <span className="sr-table__due">{formatBaht(row.due)}</span>}
                                </span>
                            </button>
                        )
                    })}
                </section>
            )}
        </main>
    )
}
