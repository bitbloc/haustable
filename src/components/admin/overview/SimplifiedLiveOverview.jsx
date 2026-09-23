/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { toast } from 'sonner'
import { getThaiDate, formatThaiTimeOnly, formatThaiDateOnly, calculateDurationMinutes, formatThaiDuration } from '../../../utils/timeUtils'
import { parseTableTransferInfo, isGhostPickupBooking, isInternalBlockBooking } from '../../../utils/tableTransferHelper'
import { formatOrderItemOptions } from '../../../utils/menuHelper'

/**
 * Isolated live duration display that updates itself without re-rendering the whole floor grid
 */
function LiveDuration({ startTime, className = '' }) {
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        if (!startTime) return
        const timer = setInterval(() => setNow(Date.now()), 15000)
        return () => clearInterval(timer)
    }, [startTime])

    const elapsedMins = calculateDurationMinutes(startTime, now)
    return <span className={className}>{formatThaiDuration(elapsedMins)}</span>
}

/**
 * Isolated duration badge with progressive stay colors
 */
function LiveDurationBadge({ startTime }) {
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        if (!startTime) return
        const timer = setInterval(() => setNow(Date.now()), 15000)
        return () => clearInterval(timer)
    }, [startTime])

    const elapsedMins = calculateDurationMinutes(startTime, now)
    
    let pillStyle = 'bg-[oklch(92%_0.012_140)] text-[oklch(35%_0.08_140)]'
    if (elapsedMins >= 75) {
        pillStyle = 'bg-[oklch(52%_0.16_28)] text-[oklch(97%_0.008_28)]'
    } else if (elapsedMins >= 45) {
        pillStyle = 'bg-[oklch(75%_0.18_65)] text-[oklch(18%_0.012_28)]'
    } else {
        pillStyle = 'bg-[oklch(45%_0.08_140)] text-[oklch(97%_0.008_28)]'
    }

    return (
        <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-xs tabular-nums ${pillStyle}`}>
            {formatThaiDuration(elapsedMins)}
        </span>
    )
}

/**
 * SimplifiedLiveOverview Component
 * Focused on instant situational awareness:
 * - Realtime floor status with isolated duration counters
 * - Mobile-friendly 3-item card preview + Modal checklist (Zero scroll hijacking)
 * - Restored 2+1 typography pairing (grotesque headers, readable neutral sans body, monospace outliers)
 * - Strict 4px/8px spacing grid and Thai Modern OKLCH aesthetics
 */
export default function SimplifiedLiveOverview({ 
    tables: parentTables = [],
    bookings: parentBookings = [], 
    revenueToday = 0, 
    yesterdayRevenue = 0,
    shifts = [], 
    selectedDate = getThaiDate(),
    loading = false, 
    onRefresh,
    onOpenProMode 
}) {
    const [internalTables, setInternalTables] = useState([])
    const [internalBookings, setInternalBookings] = useState([])
    const [loadingInternal, setLoadingInternal] = useState(false)
    const [selectedFilter, setSelectedFilter] = useState('occupied')
    const [zoomMode, setZoomMode] = useState('card') // 'card' | 'list'
    const [inspectingTable, setInspectingTable] = useState(null)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)
    const containerRef = useRef(null)

    const isToday = !selectedDate || selectedDate === getThaiDate()

    // Driver by parent if provided, avoiding redundant duplicate fetches
    const isParentDriven = parentTables.length > 0 || parentBookings.length > 0
    const tables = parentTables.length > 0 ? parentTables : internalTables
    const liveBookings = parentBookings.length > 0 ? parentBookings : internalBookings

    // Total guests across bookings for selected date
    const totalGuestsOnDate = useMemo(() => {
        return liveBookings.reduce((sum, b) => {
            if (['cancelled', 'void'].includes(b.status)) return sum
            return sum + (Number(b.pax) || 1)
        }, 0)
    }, [liveBookings])

    // Shift Awareness: Determine whether front-of-house POS shift is active or closed
    const activeShift = useMemo(() => (shifts || []).find(s => s.status === 'open'), [shifts])
    const latestClosedShift = useMemo(() => (shifts || []).filter(s => s.status === 'closed').sort((a, b) => new Date(b.closed_at || b.opened_at) - new Date(a.closed_at || a.opened_at))[0] || null, [shifts])
    const isShiftOpen = Boolean(activeShift)

    // Quiet internal fallback fetch if rendered standalone
    const fetchFloorData = async (isSilent = false) => {
        if (!isSilent) setLoadingInternal(true)
        try {
            const { data: tablesData, error: tErr } = await supabase
                .from('tables_layout')
                .select('*')

            if (tErr) throw tErr

            const sorted = (tablesData || []).slice().sort((a, b) => 
                (a.table_name || '').localeCompare(b.table_name || '', undefined, { numeric: true, sensitivity: 'base' })
            )
            setInternalTables(sorted)

            const today = getThaiDate()
            const start = `${today}T00:00:00+07:00`
            const end = `${today}T23:59:59+07:00`

            const { data: bData, error: bErr } = await supabase
                .from('bookings')
                .select(`
                    *,
                    order_items (
                        id,
                        quantity,
                        price_at_time,
                        selected_options,
                        custom_name,
                        menu_items ( name, price, category_id )
                    ),
                    profiles ( id, display_name, phone_number ),
                    tables_layout ( table_name )
                `)
                .or(`and(booking_time.gte.${start},booking_time.lte.${end}),and(created_at.gte.${start},created_at.lte.${end}),status.in.(seated,ready,confirmed)`)
                .order('booking_time', { ascending: false })

            if (bErr) throw bErr
            setInternalBookings(bData || [])
        } catch (err) {
            console.error('Error in SimplifiedLiveOverview fetch:', err)
        } finally {
            setLoadingInternal(false)
        }
    }

    useEffect(() => {
        // Only run internal fetch and Realtime channel if not driven by parent sync hub
        if (isParentDriven) return

        fetchFloorData(false)

        let debounceTimer = null
        const debouncedFetch = () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
                fetchFloorData(true)
                if (onRefresh) onRefresh()
            }, 300)
        }

        const channelId = `simplified-live-floor-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
        const channel = supabase
            .channel(channelId)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tables_layout' }, debouncedFetch)
            .subscribe()

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            supabase.removeChannel(channel)
        }
    }, [isParentDriven])

    // Fullscreen change listener
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement))
        }
        document.addEventListener('fullscreenchange', handleFullscreenChange)
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }, [])

    // Helper: Determine table state using centralized business logic
    const getTableState = (tableId) => {
        const now = new Date()
        const tableBookings = liveBookings.filter(b => b.table_id === tableId && !isGhostPickupBooking(b))

        if (tableBookings.length === 0) return { status: 'free', booking: null }

        // 1. Current active seated / dining booking
        const currentBooking = tableBookings.find(b => {
            if (['completed', 'paid', 'cancelled', 'void'].includes(b.status)) return false

            // If POS shift is currently closed, bookings from or prior to the closed shift must NOT occupy the table
            if (!isShiftOpen && latestClosedShift) {
                const bTime = new Date(b.booking_time || b.created_at)
                const closedTime = new Date(latestClosedShift.closed_at || latestClosedShift.opened_at)
                if (bTime <= closedTime) return false
            }

            if (b.status === 'seated') return true
            if (b.status === 'ready' && b.booking_type !== 'pickup') return true
            const start = new Date(b.booking_time)
            const endTime = b.end_time ? new Date(b.end_time) : new Date(start.getTime() + 2 * 60 * 60 * 1000)
            return now >= start && now < endTime
        })

        if (currentBooking) {
            const isInternalBlock = isInternalBlockBooking(currentBooking) || currentBooking.customer_note === 'Internal Block' || currentBooking.customer_note === 'Maintenance Block'
            return {
                status: isInternalBlock ? 'blocked' : 'occupied',
                booking: currentBooking
            }
        }

        // 2. Upcoming reservation within 60 mins (only if shift is open or reservation is in future)
        const upcoming = tableBookings.find(b => {
            if (['completed', 'cancelled', 'void', 'no_show'].includes(b.status)) return false
            const start = new Date(b.booking_time)
            const diffMins = (start - now) / 60000
            return diffMins > 0 && diffMins <= 60
        })

        if (upcoming) {
            return { status: 'upcoming', booking: upcoming }
        }

        return { status: 'free', booking: null }
    }

    // Process table list with stats (currentTime decoupled to eliminate 10s re-render thrashing)
    const floorList = useMemo(() => {
        return tables.map(table => {
            const state = getTableState(table.id)
            const booking = state.booking
            const orderItems = booking?.order_items || []
            
            // Calculate bill total
            const billTotal = orderItems.length > 0 
                ? orderItems.reduce((sum, it) => sum + (Number(it.price_at_time || it.menu_items?.price || 0) * Number(it.quantity || 1)), 0)
                : Number(booking?.total_amount || 0)

            const startTime = booking?.booking_time || booking?.created_at
            const transfer = parseTableTransferInfo(booking)
            
            const hasCallStaff = state.status === 'occupied' && Boolean(booking?.staff_remark?.includes('[CALL_STAFF]'))
            const hasCallBill = state.status === 'occupied' && Boolean(booking?.staff_remark?.includes('[CALL_BILL]'))

            return {
                table,
                state,
                booking,
                orderItems,
                billTotal,
                startTime,
                transfer,
                hasCallStaff,
                hasCallBill
            }
        })
    }, [tables, liveBookings, shifts, isShiftOpen, latestClosedShift])

    // Summary counts
    const counts = useMemo(() => {
        let occupied = 0
        let calling = 0
        let upcoming = 0
        let free = 0
        let activeRevenue = 0
        let totalGuests = 0

        floorList.forEach(item => {
            if (item.state.status === 'occupied') {
                occupied++
                activeRevenue += item.billTotal
                totalGuests += Number(item.booking?.guest_count || item.table.capacity || 2)
                if (item.hasCallBill || item.hasCallStaff) calling++
            } else if (item.state.status === 'upcoming') {
                upcoming++
            } else if (item.state.status === 'free') {
                free++
            }
        })

        return {
            total: floorList.length,
            occupied,
            calling,
            upcoming,
            free,
            activeRevenue,
            totalGuests,
            occupancyPct: floorList.length > 0 ? Math.round((occupied / floorList.length) * 100) : 0
        }
    }, [floorList])

    // Executive Trend Metric: Comparison vs yesterday's actual settled revenue
    const trendText = useMemo(() => {
        if (yesterdayRevenue > 0) {
            const diff = revenueToday - yesterdayRevenue
            const pct = Math.round((diff / yesterdayRevenue) * 100)
            const sign = pct >= 0 ? '+' : ''
            return `${sign}${pct}% vs yesterday`
        }
        if (revenueToday > 0) {
            return `+฿${revenueToday.toLocaleString()} vs yesterday`
        }
        return 'พร้อมรับออเดอร์แรก'
    }, [revenueToday, yesterdayRevenue])

    // Filtered list
    const filteredFloor = useMemo(() => {
        if (selectedFilter === 'occupied') return floorList.filter(i => i.state.status === 'occupied')
        if (selectedFilter === 'calling') return floorList.filter(i => i.hasCallBill || i.hasCallStaff)
        if (selectedFilter === 'upcoming') return floorList.filter(i => i.state.status === 'upcoming')
        if (selectedFilter === 'free') return floorList.filter(i => i.state.status === 'free')
        return floorList
    }, [floorList, selectedFilter])

    // Fullscreen Toggle with iOS fallback safety
    const handleToggleFullscreen = () => {
        if (!document.fullscreenElement) {
            if (containerRef.current?.requestFullscreen) {
                containerRef.current.requestFullscreen().catch(err => {
                    console.warn('Fullscreen request failed:', err)
                    setIsFullscreen(true)
                })
            } else {
                setIsFullscreen(true)
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => setIsFullscreen(false))
            } else {
                setIsFullscreen(false)
            }
        }
    }

    // Dismiss Call Staff / Bill Alert
    const handleDismissAlert = async (bookingId, e) => {
        if (e) e.stopPropagation()
        setActionLoading(true)
        try {
            const currentBooking = liveBookings.find(b => b.id === bookingId)
            const cleanRemark = (currentBooking?.staff_remark || '')
                .replace(/\[CALL_BILL\]/gi, '')
                .replace(/\[CALL_STAFF\]/gi, '')
                .trim()
            
            const { error } = await supabase
                .from('bookings')
                .update({ staff_remark: cleanRemark || null })
                .eq('id', bookingId)

            if (error) throw error
            toast.success('ปิดการแจ้งเตือนเรียบร้อย')
            if (onRefresh) onRefresh()
        } catch (err) {
            toast.error('ไม่สามารถอัปเดตสถานะ: ' + err.message)
        } finally {
            setActionLoading(false)
        }
    }

    const isDataLoading = loading || loadingInternal

    return (
        <div 
            ref={containerRef}
            className={`space-y-4 font-sans select-none transition-all duration-200 ${
                isFullscreen ? 'fixed inset-0 z-50 bg-[oklch(97%_0.008_28)] p-4 md:p-6 overflow-y-auto' : ''
            }`}
        >
            {/* 1. Hero Pulse: 3-Second Executive Awareness Strip (Equal Weight Blocks) */}
            <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] p-4 sm:p-5 rounded-xs shadow-2xs">
                {/* 3 Primary KPIs: Balanced visual weight */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-[oklch(85%_0.012_28)]">
                    {/* KPI 1: LIVE NOW / FLOOR STATUS / DATE SUMMARY */}
                    <div className="pt-2 first:pt-0 sm:pt-0 sm:px-4 first:pl-0">
                        <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold tracking-wider text-[oklch(42%_0.010_28)] uppercase">
                                {!isToday ? 'DATE SUMMARY' : isShiftOpen ? 'LIVE NOW' : 'FLOOR STATUS'}
                            </span>
                            <span className={`w-2 h-2 rounded-full ${!isToday ? 'bg-[oklch(55%_0.010_28)]' : isShiftOpen ? 'bg-[oklch(18%_0.012_28)] animate-pulse' : 'bg-[oklch(55%_0.010_28)]'}`} />
                        </div>
                        <div className="mt-1 flex items-baseline gap-2">
                            <h2 className="font-mono text-3xl sm:text-4xl font-bold text-[oklch(18%_0.012_28)] tabular-nums">
                                {!isToday ? liveBookings.length : (isShiftOpen ? counts.occupied : 0)}
                            </h2>
                            <span className="font-sans text-xs text-[oklch(55%_0.010_28)] font-medium">
                                {!isToday 
                                    ? `บันทึกประวัติย้อนหลัง · ${liveBookings.length} ออเดอร์`
                                    : isShiftOpen 
                                        ? `${counts.occupied === 1 ? '1 order' : `${counts.occupied} orders`} · ${counts.occupancyPct}% occupied`
                                        : 'กะปิดอยู่ · ยังไม่เปิดรอบขาย'
                                }
                            </span>
                        </div>
                    </div>

                    {/* KPI 2: PEOPLE IN STORE / GUESTS ON DATE */}
                    <div className="pt-3 sm:pt-0 sm:px-4">
                        <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold tracking-wider text-[oklch(42%_0.010_28)] uppercase">
                                {!isToday ? 'GUESTS ON DATE' : 'PEOPLE IN STORE'}
                            </span>
                        </div>
                        <div className="mt-1 flex items-baseline gap-2">
                            <div className="font-mono text-3xl sm:text-4xl font-bold text-[oklch(18%_0.012_28)] tabular-nums">
                                {!isToday ? totalGuestsOnDate : (isShiftOpen ? counts.totalGuests : 0)}
                            </div>
                            <span className="font-sans text-xs text-[oklch(55%_0.010_28)] font-medium">
                                {!isToday 
                                    ? `pax รวมตลอดวัน (${formatThaiDateOnly(selectedDate)})`
                                    : isShiftOpen 
                                        ? `pax ในร้าน (${counts.occupied}/${counts.total} โต๊ะ)`
                                        : '0 pax (หน้าร้านปิดรอบขาย)'
                                }
                            </span>
                        </div>
                    </div>

                    {/* KPI 3: SALES TODAY / DAILY REVENUE */}
                    <div className="pt-3 sm:pt-0 sm:px-4">
                        <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold tracking-wider text-[oklch(42%_0.010_28)] uppercase">
                                {!isToday ? 'DAILY REVENUE' : 'SALES TODAY'}
                            </span>
                        </div>
                        <div className="mt-1">
                            <div className="font-mono text-3xl sm:text-4xl font-bold text-[oklch(18%_0.012_28)] tabular-nums">
                                ฿{revenueToday.toLocaleString()}
                            </div>
                            <div className="font-mono text-[11px] font-medium text-[oklch(55%_0.010_28)] mt-0.5">
                                {trendText}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sub-bar: Density Switcher & Fullscreen (Restrained and Aligned) */}
                <div className="mt-4 pt-3 border-t border-[oklch(88%_0.012_28)] flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-2 font-mono text-[11px] text-[oklch(55%_0.010_28)]">
                        <span className="font-bold text-[oklch(18%_0.012_28)] uppercase">{!isToday ? 'FLOOR SNAPSHOT' : 'CURRENT ACTIVITY'}</span>
                        <span>//</span>
                        <span>{!isToday ? `ผังโต๊ะบันทึกย้อนหลัง (${counts.total} โต๊ะ)` : isShiftOpen ? `${counts.occupied} โต๊ะกำลังทาน` : 'กะปิดหน้าร้าน (0 โต๊ะกำลังทาน)'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* View Density Toggle */}
                        <div className="flex items-center border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] p-0.5 rounded-xs text-[11px] font-sans">
                            <button
                                type="button"
                                onClick={() => setZoomMode('card')}
                                className={`px-2.5 py-1 rounded-xs font-medium transition-all cursor-pointer ${
                                    zoomMode !== 'list'
                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold'
                                        : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                                }`}
                                title="ผังการ์ดอาหาร"
                            >
                                ผังการ์ด
                            </button>
                            <button
                                type="button"
                                onClick={() => setZoomMode('list')}
                                className={`px-2.5 py-1 rounded-xs font-medium transition-all cursor-pointer ${
                                    zoomMode === 'list'
                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold'
                                        : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                                }`}
                                title="List สรุปโต๊ะ"
                            >
                                List สรุป
                            </button>
                        </div>

                        {/* Fullscreen Button */}
                        <button
                            type="button"
                            onClick={handleToggleFullscreen}
                            className="px-2.5 py-1 border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] hover:bg-[oklch(92%_0.012_28)] text-[oklch(18%_0.012_28)] text-[11px] font-mono rounded-xs cursor-pointer"
                        >
                            {isFullscreen ? '✕ EXIT' : '⛶ เต็มจอ'}
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Rapid Filter Chips (4px/8px scale, Thai font-sans, monospace counts) */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 text-xs font-sans">
                {[
                    { id: 'occupied', label: 'กำลังเปิดโต๊ะ', count: counts.occupied, isDefault: true },
                    ...(counts.calling > 0 ? [{ id: 'calling', label: 'เรียกพนักงาน / บิล', count: counts.calling, alert: true }] : []),
                    { id: 'all', label: 'ผังโต๊ะทั้งหมด', count: counts.total }
                ].map(chip => (
                    <button
                        key={chip.id}
                        type="button"
                        onClick={() => setSelectedFilter(chip.id)}
                        className={`px-3 py-1.5 rounded-sm font-semibold transition-all whitespace-nowrap border cursor-pointer flex items-center gap-2 ${
                            selectedFilter === chip.id
                                ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)] shadow-sm'
                                : 'bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(90%_0.012_28)]'
                        } ${chip.alert ? 'ring-1 ring-[oklch(52%_0.16_28)] text-[oklch(52%_0.16_28)]' : ''}`}
                    >
                        {chip.isDefault && <span className="w-1.5 h-1.5 rounded-full bg-[oklch(52%_0.16_28)] shrink-0" />}
                        <span>{chip.label}</span>
                        <span className={`px-1.5 py-0.5 font-mono text-[10px] font-bold rounded-xs tabular-nums ${
                            selectedFilter === chip.id ? 'bg-[oklch(97%_0.008_28)]/20 text-[oklch(97%_0.008_28)]' : 'bg-[oklch(88%_0.012_28)] text-[oklch(18%_0.012_28)]'
                        }`}>
                            {chip.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* 3. Table Views Based on Zoom Level */}
            {isDataLoading ? (
                <div className="py-16 text-center text-xs text-[oklch(55%_0.010_28)] font-sans animate-pulse border border-dashed border-[oklch(85%_0.012_28)]">
                    กำลังดึงข้อมูลโต๊ะสดแบบเรียลไทม์...
                </div>
            ) : filteredFloor.length === 0 ? (
                <div className="py-12 px-4 text-center font-sans border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] rounded-sm space-y-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-[oklch(45%_0.08_140)] mx-auto" />
                    <h4 className="font-bold text-sm sm:text-base text-[oklch(18%_0.012_28)]">
                        {selectedFilter === 'occupied' ? `ไม่มีโต๊ะที่กำลังเปิดอยู่ในขณะนี้ (0/${counts.total} โต๊ะ)` : 'ไม่มีโต๊ะในหมวดหมู่นี้'}
                    </h4>
                    <p className="text-xs text-[oklch(55%_0.010_28)] max-w-sm mx-auto">
                        {selectedFilter === 'occupied' 
                            ? 'ทุกโต๊ะว่างและพร้อมให้บริการ หรือยังไม่มีลูกค้าเปิดโต๊ะเช็คอิน'
                            : 'ลองเลือกตัวกรองอื่นเพื่อดูรายการโต๊ะ'}
                    </p>
                    {selectedFilter !== 'all' && (
                        <div className="pt-1 flex justify-center">
                            <button
                                type="button"
                                onClick={() => setSelectedFilter('all')}
                                className="px-3.5 py-1.5 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] text-xs font-bold rounded-xs cursor-pointer hover:bg-[oklch(28%_0.012_28)]"
                            >
                                ดูผังโต๊ะทั้งหมด ({counts.total} โต๊ะ)
                            </button>
                        </div>
                    )}
                </div>
            ) : zoomMode === 'list' ? (
                /* -------------------------------------------------------------
                   LIST VIEW: SUMMARY TABLE (กระชับ & ปลอดภัยต่อจอเล็ก)
                ------------------------------------------------------------- */
                <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] rounded-sm overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse font-sans">
                            <thead>
                                <tr className="bg-[oklch(94%_0.010_28)] border-b border-[oklch(85%_0.012_28)] text-[oklch(42%_0.010_28)] text-[11px] font-bold">
                                    <th className="py-2.5 px-3 whitespace-nowrap">โต๊ะ / ความจุ</th>
                                    <th className="py-2.5 px-3 whitespace-nowrap">เวลา / สถานะ</th>
                                    <th className="py-2.5 px-3 whitespace-nowrap">รายการอาหารที่สั่ง</th>
                                    <th className="py-2.5 px-3 text-right whitespace-nowrap">ยอดรวมบิล</th>
                                    <th className="py-2.5 px-3 text-right whitespace-nowrap">รายละเอียด</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[oklch(88%_0.012_28)]">
                                {filteredFloor.map(item => {
                                    const isOccupied = item.state.status === 'occupied'
                                    const isUpcoming = item.state.status === 'upcoming'
                                    const isBlocked = item.state.status === 'blocked'
                                    const orderItems = item.orderItems

                                    const itemPreviews = orderItems.map(it => `${it.quantity}x ${it.menu_items?.name || 'อาหาร'}`)
                                    const foodText = itemPreviews.length > 0 
                                        ? itemPreviews.slice(0, 3).join(', ') + (itemPreviews.length > 3 ? ` (+${itemPreviews.length - 3})` : '')
                                        : 'ยังไม่มีรายการ'

                                    return (
                                        <tr
                                            key={item.table.id}
                                            onClick={() => setInspectingTable(item)}
                                            className={`hover:bg-[oklch(94%_0.010_28)] transition-colors cursor-pointer select-none ${
                                                item.hasCallBill || item.hasCallStaff ? 'bg-[oklch(96%_0.03_65)]' : ''
                                            }`}
                                        >
                                            {/* Table & Pax */}
                                            <td className="py-3 px-3 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-base text-[oklch(18%_0.012_28)]">
                                                        {item.table.table_name}
                                                    </span>
                                                    <span className="font-mono text-[10px] px-1.5 py-0.5 bg-[oklch(90%_0.010_28)] text-[oklch(42%_0.010_28)] rounded-xs font-semibold">
                                                        {item.table.capacity} Pax
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Time / Status (Using isolated LiveDurationBadge) */}
                                            <td className="py-3 px-3 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    {isOccupied ? (
                                                        <>
                                                            <LiveDurationBadge startTime={item.startTime} />
                                                            <span className="font-mono text-[10px] text-[oklch(55%_0.010_28)] hidden sm:inline tabular-nums">
                                                                (เริ่ม {formatThaiTimeOnly(item.booking?.booking_time)})
                                                            </span>
                                                        </>
                                                    ) : isUpcoming ? (
                                                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-xs bg-[oklch(60%_0.15_60)] text-[oklch(18%_0.012_28)]">
                                                            จองล่วงหน้า
                                                        </span>
                                                    ) : isBlocked ? (
                                                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-xs bg-[oklch(18%_0.012_28)]/40 text-[oklch(97%_0.008_28)] font-mono">
                                                            BLOCKED
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-xs bg-[oklch(92%_0.012_140)] text-[oklch(35%_0.08_140)]">
                                                            โต๊ะว่าง
                                                        </span>
                                                    )}

                                                    {/* Call Alert Badge */}
                                                    {(item.hasCallBill || item.hasCallStaff) && (
                                                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[oklch(75%_0.18_65)] text-[oklch(18%_0.012_28)] rounded-xs animate-pulse">
                                                            {item.hasCallBill ? 'เช็คบิล' : 'เรียกพนักงาน'}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Order Items Preview */}
                                            <td className="py-3 px-3 max-w-[280px] truncate">
                                                {isOccupied ? (
                                                    <div className="flex items-center gap-1.5 truncate">
                                                        <span className="font-bold text-[oklch(18%_0.012_28)] whitespace-nowrap">
                                                            {orderItems.length} รายการ:
                                                        </span>
                                                        <span className="text-xs text-[oklch(55%_0.010_28)] truncate">
                                                            {foodText}
                                                        </span>
                                                        <span className="text-[11px] text-[oklch(52%_0.16_28)] font-bold whitespace-nowrap ml-1 underline">
                                                            [ดูครบ]
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[oklch(60%_0.010_28)] text-xs">-</span>
                                                )}
                                            </td>

                                            {/* Total Amount */}
                                            <td className="py-3 px-3 text-right whitespace-nowrap">
                                                <span className="font-mono font-bold text-sm text-[oklch(18%_0.012_28)] tabular-nums">
                                                    {isOccupied ? `฿${item.billTotal.toLocaleString()}` : '-'}
                                                </span>
                                            </td>

                                            {/* Action */}
                                            <td className="py-3 px-3 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end">
                                                    {isOccupied && item.booking ? (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setInspectingTable(item)
                                                            }}
                                                            className="px-2.5 py-1 text-[11px] font-bold bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] rounded-xs cursor-pointer flex items-center gap-1"
                                                            title="แตะเพื่อดูเช็คลิสต์รายการอาหารครบถ้วน"
                                                        >
                                                            <span>ดูบิลอาหาร</span>
                                                            <span>➔</span>
                                                        </button>
                                                    ) : (
                                                        <span className="text-[11px] text-[oklch(60%_0.010_28)]">โต๊ะว่าง</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* -------------------------------------------------------------
                   CARD VIEW: COMPLETE MENU CARDS (Zero Scroll-Hijacking on Mobile)
                ------------------------------------------------------------- */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 transition-all duration-200 font-sans">
                    {filteredFloor.map(item => {
                        const isOccupied = item.state.status === 'occupied'
                        const isUpcoming = item.state.status === 'upcoming'
                        const isBlocked = item.state.status === 'blocked'
                        const orderItems = item.orderItems
                        const guestCount = item.booking?.guest_count || item.table.capacity || 2

                        let borderStyle = 'border-[oklch(85%_0.012_28)] hover:border-[oklch(18%_0.012_28)]'
                        let bgStyle = 'bg-[oklch(97%_0.008_28)]'

                        if (isOccupied) {
                            // Red is STRICTLY reserved for action-required alerts (hasCallBill / hasCallStaff)
                            borderStyle = (item.hasCallBill || item.hasCallStaff)
                                ? 'border-[oklch(52%_0.16_28)] ring-1 ring-[oklch(52%_0.16_28)]' 
                                : 'border-[oklch(18%_0.012_28)]'
                            bgStyle = 'bg-[oklch(97%_0.008_28)]'
                        } else if (isUpcoming) {
                            borderStyle = 'border-[oklch(85%_0.012_28)]'
                            bgStyle = 'bg-[oklch(95%_0.010_28)]'
                        } else if (isBlocked) {
                            borderStyle = 'border-[oklch(85%_0.012_28)]'
                            bgStyle = 'bg-[oklch(92%_0.010_28)]'
                        }

                        return (
                            <div
                                key={item.table.id}
                                onClick={() => setInspectingTable(item)}
                                className={`p-3.5 rounded-xs border transition-all cursor-pointer flex flex-col justify-between shadow-2xs hover:shadow-xs ${bgStyle} ${borderStyle}`}
                            >
                                {/* 1. Card Top: Table Name, Pax & Time vs Total & LIVE Tag */}
                                <div>
                                    <div className="flex items-start justify-between pb-2 border-b border-[oklch(88%_0.012_28)]">
                                        <div>
                                            <div className="flex items-baseline gap-2">
                                                <span className="font-mono text-xl font-bold text-[oklch(18%_0.012_28)]">
                                                    {item.table.table_name}
                                                </span>
                                            </div>
                                            <div className="text-[11px] font-mono text-[oklch(55%_0.010_28)] mt-0.5">
                                                {isOccupied ? (
                                                    <>{guestCount} pax · {formatThaiTimeOnly(item.booking?.booking_time)}</>
                                                ) : (
                                                    <>{item.table.capacity} pax</>
                                                )}
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            {isOccupied ? (
                                                <>
                                                    <div className="font-mono text-base font-bold text-[oklch(18%_0.012_28)] tabular-nums">
                                                        ฿{item.billTotal.toLocaleString()}
                                                    </div>
                                                    <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded-xs font-mono text-[9px] font-bold uppercase bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]">
                                                        LIVE
                                                    </span>
                                                </>
                                            ) : isUpcoming ? (
                                                <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold rounded-xs bg-[oklch(92%_0.010_28)] text-[oklch(42%_0.010_28)] uppercase font-mono">
                                                    RESERVED
                                                </span>
                                            ) : isBlocked ? (
                                                <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold rounded-xs bg-[oklch(88%_0.010_28)] text-[oklch(42%_0.010_28)] uppercase font-mono">
                                                    BLOCKED
                                                </span>
                                            ) : (
                                                <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold rounded-xs bg-[oklch(92%_0.012_140)] text-[oklch(35%_0.08_140)] uppercase font-mono">
                                                    FREE
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Required: Call Staff / Bill Alert Badge (RED ONLY HERE) */}
                                    {(item.hasCallBill || item.hasCallStaff) && (
                                        <div className="mt-2 px-2 py-1 bg-[oklch(92%_0.02_28)] border border-[oklch(52%_0.16_28)] text-[oklch(52%_0.16_28)] text-xs font-bold rounded-xs flex items-center justify-between animate-pulse">
                                            <span>[ALERT] {item.hasCallBill ? 'ขอเช็คบิล' : 'เรียกพนักงาน'}</span>
                                            <button
                                                type="button"
                                                onClick={(e) => handleDismissAlert(item.booking?.id, e)}
                                                className="underline text-[10px] cursor-pointer"
                                            >
                                                ปิดเตือน
                                            </button>
                                        </div>
                                    )}

                                    {/* Customer Note */}
                                    {item.booking?.customer_note && (
                                        <div className="mt-2 px-2 py-0.5 bg-[oklch(92%_0.010_28)] rounded-xs text-[11px] text-[oklch(42%_0.010_28)] truncate">
                                            โน้ต: "{item.booking.customer_note}"
                                        </div>
                                    )}

                                    {/* 2. Menu Items Section: Prominent count, compact secondary items (~70-80% height) */}
                                    {isOccupied ? (
                                        <div className="mt-2.5 pt-1.5">
                                            <div className="font-sans text-xs font-bold text-[oklch(18%_0.012_28)] mb-1.5">
                                                {orderItems.length} รายการ
                                            </div>

                                            {orderItems.length === 0 ? (
                                                <span className="text-xs text-[oklch(60%_0.010_28)] italic block py-2 text-center">
                                                    ยังไม่มีรายการสั่งอาหาร
                                                </span>
                                            ) : (
                                                <div className="max-h-[115px] overflow-y-auto space-y-1 pr-1 overscroll-contain divide-y divide-[oklch(92%_0.010_28)] text-xs">
                                                    {orderItems.map((it, idx) => {
                                                        const itemName = it.custom_name || it.menu_items?.name || 'อาหาร'
                                                        const price = Number(it.price_at_time || it.menu_items?.price || 0)
                                                        const lineTotal = price * Number(it.quantity || 1)

                                                        return (
                                                            <div key={it.id || idx} className="pt-1 first:pt-0 flex items-center justify-between gap-2 text-[11px] text-[oklch(42%_0.010_28)]">
                                                                <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                                                                    <span className="font-mono font-medium text-[oklch(55%_0.010_28)] tabular-nums shrink-0">
                                                                        {it.quantity}x
                                                                    </span>
                                                                    <span className="truncate">
                                                                        {itemName}
                                                                    </span>
                                                                </div>
                                                                <span className="font-mono tabular-nums text-[oklch(42%_0.010_28)] shrink-0">
                                                                    ฿{lineTotal.toLocaleString()}
                                                                </span>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    ) : isUpcoming ? (
                                        <div className="mt-3 py-2 px-2 bg-[oklch(94%_0.010_28)] rounded-xs border border-dashed border-[oklch(85%_0.012_28)] text-center text-xs">
                                            <span className="font-bold text-[oklch(18%_0.012_28)] block">
                                                จอง {formatThaiTimeOnly(item.booking?.booking_time)}
                                            </span>
                                            <span className="text-[11px] text-[oklch(55%_0.010_28)] block">
                                                {item.booking?.customer_name || 'ลูกค้า'} ({guestCount} ท่าน)
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="mt-3 py-2 text-center text-xs text-[oklch(60%_0.010_28)]">
                                            โต๊ะว่าง พร้อมเปิดบริการ
                                        </div>
                                    )}
                                </div>

                                {/* 3. Card Footer: Prominent TOTAL */}
                                <div className="mt-2.5 pt-2 border-t border-[oklch(85%_0.012_28)] flex items-center justify-between text-xs">
                                    <span className="font-mono font-bold text-[11px] tracking-wider text-[oklch(18%_0.012_28)]">
                                        TOTAL
                                    </span>
                                    <span className="font-mono font-bold text-sm text-[oklch(18%_0.012_28)] tabular-nums">
                                        {isOccupied ? `฿${item.billTotal.toLocaleString()}` : '-'}
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* 4. Complete Food & Drink Order Checklist Modal */}
            {inspectingTable && (
                <div 
                    onClick={() => setInspectingTable(null)}
                    className="fixed inset-0 bg-[oklch(18%_0.012_28)]/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-2xs"
                >
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-sm max-w-lg w-full p-4 sm:p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden font-sans animate-in zoom-in-95 duration-200"
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-[oklch(85%_0.012_28)]">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-mono text-xl font-bold text-[oklch(18%_0.012_28)]">
                                        {inspectingTable.table.table_name}
                                    </h3>
                                    <span className="font-mono text-xs px-2 py-0.5 bg-[oklch(90%_0.010_28)] rounded-xs text-[oklch(18%_0.012_28)] font-semibold">
                                        {inspectingTable.table.capacity} Pax
                                    </span>
                                </div>
                                <p className="text-xs text-[oklch(55%_0.010_28)] mt-0.5">
                                    {inspectingTable.state.status === 'occupied' ? (
                                        <>เริ่มเปิดโต๊ะ: <span className="font-mono font-semibold text-[oklch(18%_0.012_28)]">{formatThaiTimeOnly(inspectingTable.booking?.booking_time)}</span> • นั่งมาแล้ว <span className="font-semibold text-[oklch(52%_0.16_28)]"><LiveDuration startTime={inspectingTable.startTime} /></span></>
                                    ) : (
                                        'สถานะโต๊ะ: พร้อมให้บริการ'
                                    )}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setInspectingTable(null)}
                                className="text-xs font-bold text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)] p-1 cursor-pointer"
                            >
                                ✕ ปิด
                            </button>
                        </div>

                        {/* Customer / Transfer Note */}
                        {inspectingTable.booking?.customer_note && (
                            <div className="mt-3 p-2 bg-[oklch(94%_0.010_28)] border border-[oklch(88%_0.012_28)] text-xs text-[oklch(42%_0.010_28)] rounded-xs">
                                โน้ตลูกค้า: "{inspectingTable.booking.customer_note}"
                            </div>
                        )}

                        {/* Full Items Checklist Area */}
                        <div className="flex-1 overflow-y-auto py-3 divide-y divide-[oklch(88%_0.012_28)] text-xs">
                            <div className="pb-2 flex justify-between font-bold text-[11px] text-[oklch(55%_0.010_28)]">
                                <span>รายการอาหาร & ตัวเลือก</span>
                                <span className="font-mono uppercase tracking-wider">AMOUNT</span>
                            </div>

                            {inspectingTable.orderItems.length === 0 ? (
                                <div className="py-10 text-center text-[oklch(55%_0.010_28)]">
                                    ยังไม่มีรายการอาหารสำหรับโต๊ะนี้
                                </div>
                            ) : (
                                inspectingTable.orderItems.map((item, idx) => {
                                    const itemName = item.custom_name || item.menu_items?.name || 'รายการอาหาร'
                                    const price = Number(item.price_at_time || item.menu_items?.price || 0)
                                    const lineTotal = price * Number(item.quantity || 1)
                                    const optList = formatOrderItemOptions(item.selected_options)

                                    return (
                                        <div key={item.id || idx} className="py-2.5 flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-2.5">
                                                <span className="w-5 h-5 flex items-center justify-center bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-mono font-bold rounded-xs text-[11px] tabular-nums mt-0.5 shrink-0">
                                                    {item.quantity}
                                                </span>
                                                <div>
                                                    <span className="font-sans font-bold text-sm text-[oklch(18%_0.012_28)] leading-normal block">
                                                        {itemName}
                                                    </span>
                                                    {optList.length > 0 && (
                                                        <div className="text-xs text-[oklch(52%_0.16_28)] space-y-0.5 mt-1">
                                                            {optList.map((optStr, optIdx) => (
                                                                <span key={optIdx} className="block font-medium">
                                                                    • {optStr}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="font-mono font-bold text-[oklch(18%_0.012_28)] tabular-nums text-sm">
                                                    ฿{lineTotal.toLocaleString()}
                                                </span>
                                                {item.quantity > 1 && (
                                                    <span className="block font-mono text-[10px] text-[oklch(55%_0.010_28)] tabular-nums">
                                                        (@ ฿{price.toLocaleString()})
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        {/* Bill Total Footer */}
                        <div className="pt-3 border-t border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] p-3 rounded-sm space-y-1.5 text-xs">
                            <div className="flex justify-between items-center text-sm font-bold text-[oklch(18%_0.012_28)]">
                                <span>ยอดรวมค่าอาหารทั้งบิล ({inspectingTable.orderItems.length} รายการ):</span>
                                <span className="font-mono text-base text-[oklch(52%_0.16_28)] tabular-nums">
                                    ฿{inspectingTable.billTotal.toLocaleString()}
                                </span>
                            </div>
                        </div>

                        {/* Modal Footer (Read-only Remote Cockpit) */}
                        <div className="pt-3 mt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-[oklch(85%_0.012_28)]">
                            <span className="text-[11px] font-mono text-[oklch(55%_0.010_28)]">
                                [INFO] การเช็คบิลและเคลียร์โต๊ะ ดำเนินการผ่าน POS หน้าร้าน
                            </span>
                            <button
                                type="button"
                                onClick={() => setInspectingTable(null)}
                                className="px-5 py-2 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(28%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold text-xs rounded-sm cursor-pointer whitespace-nowrap"
                            >
                                ✕ ปิดหน้าต่าง
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
