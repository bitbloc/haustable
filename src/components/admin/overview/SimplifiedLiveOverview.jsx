/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { getThaiDate, formatThaiTimeOnly, calculateDurationMinutes, formatThaiDuration, formatShortDuration } from '../../../utils/timeUtils'
import { parseTableTransferInfo } from '../../../utils/tableTransferHelper'

/**
 * SimplifiedLiveOverview Component
 * Focused on instant situational awareness:
 * - Realtime floor status with live ticking elapsed time
 * - Full food & drink checklist for each occupied table
 * - 3-level Zoom: Bird's-eye (หลายโต๊ะ), Standard (สมดุล), and Focus (โต๊ะเดียว)
 * - Fullscreen mode for iPad / wall counter display
 * - Zero-icon discipline & Thai Modern OKLCH aesthetics
 */
export default function SimplifiedLiveOverview({ 
    bookings: parentBookings = [], 
    revenueToday = 0, 
    shifts = [], 
    loading = false, 
    onRefresh,
    onOpenProMode 
}) {
    const [tables, setTables] = useState([])
    const [liveBookings, setLiveBookings] = useState([])
    const [loadingTables, setLoadingTables] = useState(true)
    const [selectedFilter, setSelectedFilter] = useState('all') // all, occupied, calling, upcoming, free
    const [zoomMode, setZoomMode] = useState('standard') // 'compact' (หลายโต๊ะ), 'standard' (สมดุล), 'focus' (โต๊ะเดียว)
    const [focusedTableIndex, setFocusedTableIndex] = useState(0)
    const [inspectingTable, setInspectingTable] = useState(null) // Table selected for full food checklist modal
    const [currentTime, setCurrentTime] = useState(Date.now())
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)
    const containerRef = useRef(null)

    // 1. Real-time 10s ticking clock for sitting duration
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(Date.now())
        }, 10000)
        return () => clearInterval(timer)
    }, [])

    // 2. Fetch tables and live bookings, with robust Realtime subscriptions
    const fetchFloorData = async (isSilent = false) => {
        if (!isSilent) setLoadingTables(true)
        try {
            // Fetch tables sorted natural alphanumeric (T1, T2 ... T10, T11)
            const { data: tablesData, error: tErr } = await supabase
                .from('tables_layout')
                .select('*')

            if (tErr) throw tErr

            const sorted = (tablesData || []).slice().sort((a, b) => 
                (a.table_name || '').localeCompare(b.table_name || '', undefined, { numeric: true, sensitivity: 'base' })
            )
            setTables(sorted)

            // Fetch active bookings for floor (seated, confirmed, ready, pending)
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
                        menu_items ( name, price, category_id )
                    ),
                    profiles ( id, display_name, phone_number ),
                    tables_layout ( table_name )
                `)
                .or(`and(booking_time.gte.${start},booking_time.lte.${end}),and(created_at.gte.${start},created_at.lte.${end}),status.in.(seated,ready,confirmed)`)
                .order('booking_time', { ascending: false })

            if (bErr) throw bErr
            setLiveBookings(bData || [])
        } catch (err) {
            console.error('Error in SimplifiedLiveOverview fetch:', err)
        } finally {
            setLoadingTables(false)
        }
    }

    useEffect(() => {
        fetchFloorData(false)

        let debounceTimer = null
        const debouncedFetch = () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
                fetchFloorData(true)
                if (onRefresh) onRefresh()
            }, 300)
        }

        // Supabase Realtime Channel
        const channelId = `simplified-live-floor-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
        const channel = supabase
            .channel(channelId)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tables_layout' }, debouncedFetch)
            .subscribe()

        // POS broadcast channel & BroadcastChannel
        const notifyChannel = supabase
            .channel('pos-realtime-notifications')
            .on('broadcast', { event: '*' }, debouncedFetch)
            .subscribe()

        const posSyncChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('onhaus_pos_sync') : null
        if (posSyncChannel) {
            posSyncChannel.onmessage = () => debouncedFetch()
        }

        // Fullscreen change listener
        const handleFullscreenChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement))
        }
        document.addEventListener('fullscreenchange', handleFullscreenChange)

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            supabase.removeChannel(channel)
            supabase.removeChannel(notifyChannel)
            if (posSyncChannel) posSyncChannel.close()
            document.removeEventListener('fullscreenchange', handleFullscreenChange)
        }
    }, [])

    // Synchronize parent bookings if provided
    useEffect(() => {
        if (parentBookings && parentBookings.length > 0) {
            setLiveBookings(prev => {
                const map = new Map()
                prev.forEach(b => map.set(b.id, b))
                parentBookings.forEach(b => map.set(b.id, b))
                return Array.from(map.values())
            })
        }
    }, [parentBookings])

    // Helper: Determine table state
    const getTableState = (tableId) => {
        const now = new Date()
        const tableBookings = liveBookings.filter(b => b.table_id === tableId)

        if (tableBookings.length === 0) return { status: 'free', booking: null }

        // 1. Current active seated / dining booking
        const currentBooking = tableBookings.find(b => {
            if (b.status === 'seated') return true
            if (b.status === 'ready' && b.booking_type !== 'pickup') return true
            const start = new Date(b.booking_time)
            const endTime = b.end_time ? new Date(b.end_time) : new Date(start.getTime() + 2 * 60 * 60 * 1000)
            return now >= start && now < endTime && !['completed', 'paid', 'cancelled', 'void'].includes(b.status)
        })

        if (currentBooking) {
            const isInternalBlock = currentBooking.customer_note === 'Internal Block' || currentBooking.customer_note === 'Maintenance Block'
            return {
                status: isInternalBlock ? 'blocked' : 'occupied',
                booking: currentBooking
            }
        }

        // 2. Upcoming reservation within 60 mins
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

    // Process table list with stats
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
            const elapsedMins = calculateDurationMinutes(startTime, currentTime)
            const transfer = parseTableTransferInfo(booking)
            
            const hasCallStaff = state.status === 'occupied' && Boolean(booking?.staff_remark?.includes('[CALL_STAFF]'))
            const hasCallBill = state.status === 'occupied' && Boolean(booking?.staff_remark?.includes('[CALL_BILL]'))

            return {
                table,
                state,
                booking,
                orderItems,
                billTotal,
                elapsedMins,
                transfer,
                hasCallStaff,
                hasCallBill
            }
        })
    }, [tables, liveBookings, currentTime])

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
                totalGuests += Number(item.table.capacity || 2)
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

    // Filtered list
    const filteredFloor = useMemo(() => {
        if (selectedFilter === 'occupied') return floorList.filter(i => i.state.status === 'occupied')
        if (selectedFilter === 'calling') return floorList.filter(i => i.hasCallBill || i.hasCallStaff)
        if (selectedFilter === 'upcoming') return floorList.filter(i => i.state.status === 'upcoming')
        if (selectedFilter === 'free') return floorList.filter(i => i.state.status === 'free')
        return floorList
    }, [floorList, selectedFilter])

    // Fullscreen Toggle
    const handleToggleFullscreen = () => {
        if (!document.fullscreenElement) {
            if (containerRef.current?.requestFullscreen) {
                containerRef.current.requestFullscreen().catch(err => {
                    console.warn('Fullscreen request failed:', err)
                })
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen()
            }
        }
    }

    // Dismiss Call Staff / Bill
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
            toast.success('ปิดการแจ้งเตือนเรียกพนักงานเรียบร้อย')
            fetchFloorData(true)
        } catch (err) {
            toast.error('ไม่สามารถอัปเดตสถานะ: ' + err.message)
        } finally {
            setActionLoading(false)
        }
    }

    // Release table
    const handleReleaseTable = async (bookingId, tableName) => {
        setActionLoading(true)
        try {
            const currentBooking = liveBookings.find(b => b.id === bookingId)
            const isInternalBlock = currentBooking?.customer_note === 'Internal Block' || currentBooking?.customer_note === 'Maintenance Block'
            const targetStatus = isInternalBlock ? 'cancelled' : 'completed'

            const { error } = await supabase
                .from('bookings')
                .update({ status: targetStatus, end_time: new Date().toISOString() })
                .eq('id', bookingId)

            if (error) throw error
            toast.success(`เคลียร์โต๊ะ ${tableName} เรียบร้อย`)
            setInspectingTable(null)
            fetchFloorData(true)
        } catch (err) {
            toast.error('เคลียร์โต๊ะไม่สำเร็จ: ' + err.message)
        } finally {
            setActionLoading(false)
        }
    }

    // Extend table duration
    const handleExtendTable = async (booking, mins = 30) => {
        setActionLoading(true)
        try {
            const currentEnd = booking.end_time ? new Date(booking.end_time) : new Date(new Date(booking.booking_time).getTime() + 2 * 60 * 60 * 1000)
            const baseTime = currentEnd > new Date() ? currentEnd : new Date()
            const newEnd = new Date(baseTime.getTime() + mins * 60 * 1000)

            const { error } = await supabase
                .from('bookings')
                .update({ end_time: newEnd.toISOString() })
                .eq('id', booking.id)

            if (error) throw error
            toast.success(`ต่อเวลาโต๊ะ +${mins} นาทีเรียบร้อย`)
            fetchFloorData(true)
        } catch (err) {
            toast.error('ต่อเวลาไม่สำเร็จ: ' + err.message)
        } finally {
            setActionLoading(false)
        }
    }

    return (
        <div 
            ref={containerRef}
            className={`space-y-4 font-sans select-none transition-all duration-300 ${
                isFullscreen ? 'fixed inset-0 z-50 bg-[oklch(97%_0.008_28)] p-4 md:p-6 overflow-y-auto' : ''
            }`}
        >
            {/* 1. Hero Pulse & Live Awareness Bar */}
            <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] p-3 sm:p-4 rounded-sm flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
                {/* Left: Stark Dieter Rams Typography Pulse */}
                <div className="flex items-center gap-4 flex-wrap">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[oklch(52%_0.16_28)] animate-ping" />
                            <span className="font-mono text-[10px] font-bold tracking-widest text-[oklch(52%_0.16_28)] uppercase">
                                LIVE PULSE // เปิดโต๊ะสด
                            </span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-0.5">
                            <h2 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-[oklch(18%_0.012_28)] tabular-nums">
                                {counts.occupied} <span className="text-sm sm:text-base font-normal text-[oklch(55%_0.010_28)]">/ {counts.total} โต๊ะ</span>
                            </h2>
                            <span className="font-mono text-xs font-bold px-1.5 py-0.5 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] rounded-xs tabular-nums">
                                {counts.occupancyPct}% OCCUPIED
                            </span>
                        </div>
                    </div>

                    <div className="h-8 w-px bg-[oklch(85%_0.012_28)] hidden sm:block" />

                    <div>
                        <span className="font-mono text-[10px] text-[oklch(55%_0.010_28)] uppercase block">
                            ACTIVE BILLS IN STORE
                        </span>
                        <div className="font-mono text-base sm:text-lg font-bold text-[oklch(18%_0.012_28)] tabular-nums">
                            ฿{counts.activeRevenue.toLocaleString()}
                        </div>
                    </div>

                    <div className="h-8 w-px bg-[oklch(85%_0.012_28)] hidden sm:block" />

                    <div>
                        <span className="font-mono text-[10px] text-[oklch(55%_0.010_28)] uppercase block">
                            SETTLED TODAY (ยอดปิดแล้ว)
                        </span>
                        <div className="font-mono text-base sm:text-lg font-bold text-[oklch(45%_0.08_140)] tabular-nums">
                            ฿{revenueToday.toLocaleString()}
                        </div>
                    </div>
                </div>

                {/* Right: Zoom Controls & Fullscreen Trigger */}
                <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
                    {/* 3-Level Zoom Selector */}
                    <div className="flex items-center border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] p-0.5 rounded-sm font-mono text-[11px]">
                        <button
                            type="button"
                            onClick={() => setZoomMode('compact')}
                            className={`px-2.5 py-1 rounded-xs font-bold transition-all cursor-pointer ${
                                zoomMode === 'compact'
                                    ? 'bg-[oklch(18%_0.012_28)] text-white'
                                    : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                            }`}
                            title="ซูมแบบหลายโต๊ะ (Bird's-eye View)"
                        >
                            หลายโต๊ะ
                        </button>
                        <button
                            type="button"
                            onClick={() => setZoomMode('standard')}
                            className={`px-2.5 py-1 rounded-xs font-bold transition-all cursor-pointer ${
                                zoomMode === 'standard'
                                    ? 'bg-[oklch(18%_0.012_28)] text-white'
                                    : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                            }`}
                            title="ซูมแบบมาตรฐาน (Standard)"
                        >
                            มาตรฐาน
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setZoomMode('focus')
                                setFocusedTableIndex(0)
                            }}
                            className={`px-2.5 py-1 rounded-xs font-bold transition-all cursor-pointer ${
                                zoomMode === 'focus'
                                    ? 'bg-[oklch(18%_0.012_28)] text-white'
                                    : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                            }`}
                            title="ซูมแบบโต๊ะเดียว (Single Table Focus)"
                        >
                            โต๊ะเดียว
                        </button>
                    </div>

                    {/* Fullscreen Button */}
                    <button
                        type="button"
                        onClick={handleToggleFullscreen}
                        className="px-2.5 py-1.5 border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] hover:bg-[oklch(90%_0.012_28)] text-[oklch(18%_0.012_28)] font-mono text-[11px] font-bold rounded-sm uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1"
                        title={isFullscreen ? 'ออกจากโหมดเต็มจอ' : 'เปิดโหมดเต็มจอ (สำหรับ iPad/หน้าร้าน)'}
                    >
                        <span>{isFullscreen ? '✕ EXIT' : '⛶ FULLSCREEN'}</span>
                    </button>

                    {/* Pro Mode Quick Jump */}
                    {onOpenProMode && (
                        <button
                            type="button"
                            onClick={onOpenProMode}
                            className="px-2.5 py-1.5 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(28%_0.012_28)] text-[oklch(97%_0.008_28)] font-mono text-[11px] font-bold rounded-sm uppercase tracking-wider transition-colors cursor-pointer"
                        >
                            PRO MODE ➔
                        </button>
                    )}
                </div>
            </div>

            {/* 2. Rapid Filter Chips (Thumb-friendly on iPhone) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar font-mono text-xs pb-1">
                {[
                    { id: 'all', label: 'ทั้งหมด', count: counts.total },
                    { id: 'occupied', label: 'กำลังเปิดโต๊ะ', count: counts.occupied },
                    { id: 'calling', label: 'เรียกพนักงาน / บิล', count: counts.calling, alert: counts.calling > 0 },
                    { id: 'upcoming', label: 'จองล่วงหน้า', count: counts.upcoming },
                    { id: 'free', label: 'โต๊ะว่าง', count: counts.free }
                ].map(chip => (
                    <button
                        key={chip.id}
                        onClick={() => setSelectedFilter(chip.id)}
                        className={`px-3 py-1.5 rounded-sm font-bold transition-all whitespace-nowrap border cursor-pointer flex items-center gap-1.5 ${
                            selectedFilter === chip.id
                                ? 'bg-[oklch(18%_0.012_28)] text-white border-[oklch(18%_0.012_28)] shadow-sm'
                                : 'bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(90%_0.012_28)]'
                        } ${chip.alert ? 'ring-1 ring-[oklch(52%_0.16_28)] text-[oklch(52%_0.16_28)]' : ''}`}
                    >
                        <span>{chip.label}</span>
                        <span className={`px-1.5 py-0.2 text-[10px] rounded-xs tabular-nums ${
                            selectedFilter === chip.id ? 'bg-white/20 text-white' : 'bg-[oklch(88%_0.012_28)] text-[oklch(18%_0.012_28)]'
                        }`}>
                            {chip.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* 3. Table Views Based on Zoom Level */}
            {loadingTables ? (
                <div className="py-16 text-center font-mono text-xs text-[oklch(55%_0.010_28)] animate-pulse border border-dashed border-[oklch(85%_0.012_28)]">
                    กำลังดึงข้อมูลโต๊ะสดแบบเรียลไทม์...
                </div>
            ) : filteredFloor.length === 0 ? (
                <div className="py-16 text-center font-mono text-xs text-[oklch(55%_0.010_28)] border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)]">
                    ไม่มีโต๊ะในหมวดหมู่นี้
                </div>
            ) : zoomMode === 'focus' ? (
                /* -------------------------------------------------------------
                   ZOOM LEVEL 3: SINGLE TABLE FOCUS (โต๊ะเดียว)
                ------------------------------------------------------------- */
                (() => {
                    const activeList = filteredFloor
                    const item = activeList[focusedTableIndex] || activeList[0]
                    if (!item) return null

                    const isOccupied = item.state.status === 'occupied'
                    const orderItems = item.orderItems

                    return (
                        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] p-4 sm:p-6 rounded-sm space-y-6">
                            {/* Navigation Header */}
                            <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)] pb-4">
                                <div className="flex items-center gap-3">
                                    <span className="font-mono text-3xl font-bold text-[oklch(18%_0.012_28)]">
                                        {item.table.table_name}
                                    </span>
                                    <span className="font-mono text-xs px-2 py-0.5 bg-[oklch(90%_0.010_28)] rounded-xs font-bold text-[oklch(18%_0.012_28)]">
                                        {item.table.capacity} ที่นั่ง
                                    </span>
                                    {isOccupied && (
                                        <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-xs ${
                                            item.elapsedMins >= 75
                                                ? 'bg-[oklch(52%_0.16_28)] text-white'
                                                : item.elapsedMins >= 45
                                                ? 'bg-[oklch(75%_0.18_65)] text-[oklch(18%_0.012_28)]'
                                                : 'bg-[oklch(45%_0.08_140)] text-white'
                                        }`}>
                                            ใช้บริการ {formatThaiDuration(item.elapsedMins)}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 font-mono text-xs">
                                    <button
                                        type="button"
                                        disabled={focusedTableIndex <= 0}
                                        onClick={() => setFocusedTableIndex(i => Math.max(0, i - 1))}
                                        className="px-3 py-1.5 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] disabled:opacity-30 border border-[oklch(85%_0.012_28)] rounded-xs font-bold cursor-pointer"
                                    >
                                        ← โต๊ะก่อนหน้า
                                    </button>
                                    <span className="tabular-nums font-bold">
                                        {focusedTableIndex + 1} / {activeList.length}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={focusedTableIndex >= activeList.length - 1}
                                        onClick={() => setFocusedTableIndex(i => Math.min(activeList.length - 1, i + 1))}
                                        className="px-3 py-1.5 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] disabled:opacity-30 border border-[oklch(85%_0.012_28)] rounded-xs font-bold cursor-pointer"
                                    >
                                        โต๊ะถัดไป →
                                    </button>
                                </div>
                            </div>

                            {/* Alert Ribbon if calling */}
                            {(item.hasCallBill || item.hasCallStaff) && (
                                <div className="p-3 bg-[oklch(75%_0.18_65)] text-[oklch(18%_0.012_28)] font-mono text-xs font-bold flex items-center justify-between rounded-xs animate-pulse">
                                    <span>🔔 โต๊ะนี้กำลังเรียก: {item.hasCallBill ? 'CHECKOUT // ขอเช็คบิล' : 'CALL STAFF // เรียกพนักงาน'}</span>
                                    <button
                                        type="button"
                                        onClick={(e) => handleDismissAlert(item.booking?.id, e)}
                                        className="px-2 py-1 bg-[oklch(18%_0.012_28)] text-white rounded-xs cursor-pointer text-[10px]"
                                    >
                                        รับทราบแล้ว (เคลียร์การแจ้งเตือน)
                                    </button>
                                </div>
                            )}

                            {/* Detailed Order Breakdown Checklist */}
                            <div>
                                <div className="flex items-center justify-between font-mono text-xs font-bold pb-2 border-b border-[oklch(85%_0.012_28)] text-[oklch(55%_0.010_28)]">
                                    <span>รายการอาหารและเครื่องดื่มที่สั่ง ({orderItems.length} รายการ)</span>
                                    <span className="text-[oklch(18%_0.012_28)] text-sm">
                                        ยอดรวม: ฿{item.billTotal.toLocaleString()}
                                    </span>
                                </div>

                                {orderItems.length === 0 ? (
                                    <div className="py-8 text-center font-mono text-xs text-[oklch(55%_0.010_28)]">
                                        ยังไม่มีรายการอาหารที่บันทึกในบิลนี้
                                    </div>
                                ) : (
                                    <div className="divide-y divide-[oklch(88%_0.012_28)] font-mono text-xs">
                                        {orderItems.map((order, idx) => {
                                            const itemName = order.menu_items?.name || 'รายการอาหาร'
                                            const price = Number(order.price_at_time || order.menu_items?.price || 0)
                                            const lineTotal = price * Number(order.quantity || 1)
                                            const options = order.selected_options

                                            return (
                                                <div key={order.id || idx} className="py-2.5 flex items-start justify-between gap-4">
                                                    <div className="flex items-start gap-2.5">
                                                        <span className="w-5 h-5 flex items-center justify-center bg-[oklch(90%_0.010_28)] text-[oklch(18%_0.012_28)] font-bold rounded-xs text-[11px] tabular-nums">
                                                            {order.quantity}x
                                                        </span>
                                                        <div>
                                                            <span className="font-bold text-[oklch(18%_0.012_28)] text-sm">
                                                                {itemName}
                                                            </span>
                                                            {options && (
                                                                <p className="text-[11px] text-[oklch(55%_0.010_28)] mt-0.5">
                                                                    {typeof options === 'object' ? JSON.stringify(options).replace(/["{}]/g, ' ') : String(options)}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="font-bold text-[oklch(18%_0.012_28)] tabular-nums">
                                                            ฿{lineTotal.toLocaleString()}
                                                        </span>
                                                        {order.quantity > 1 && (
                                                            <span className="block text-[10px] text-[oklch(55%_0.010_28)] tabular-nums">
                                                                (@ ฿{price.toLocaleString()})
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex flex-wrap gap-2 pt-4 border-t border-[oklch(85%_0.012_28)]">
                                {item.booking && (
                                    <>
                                        <button
                                            type="button"
                                            disabled={actionLoading}
                                            onClick={() => handleExtendTable(item.booking, 30)}
                                            className="px-4 py-2 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-mono font-bold text-xs rounded-sm cursor-pointer"
                                        >
                                            +30 นาที
                                        </button>
                                        <button
                                            type="button"
                                            disabled={actionLoading}
                                            onClick={() => handleReleaseTable(item.booking.id, item.table.table_name)}
                                            className="px-4 py-2 bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white font-mono font-bold text-xs rounded-sm cursor-pointer"
                                        >
                                            เคลียร์โต๊ะนี้
                                        </button>
                                        <Link
                                            to={`/pos?table=${item.table.table_name}`}
                                            target="_blank"
                                            className="px-4 py-2 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(28%_0.012_28)] text-white font-mono font-bold text-xs rounded-sm cursor-pointer ml-auto"
                                        >
                                            เปิด POS โต๊ะนี้ ➔
                                        </Link>
                                    </>
                                )}
                            </div>
                        </div>
                    )
                })()
            ) : (
                /* -------------------------------------------------------------
                   ZOOM LEVEL 1 & 2: COMPACT (หลายโต๊ะ) OR STANDARD (มาตรฐาน)
                ------------------------------------------------------------- */
                <div className={`grid gap-2.5 sm:gap-3.5 transition-all duration-300 ${
                    zoomMode === 'compact'
                        ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8'
                        : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                }`}>
                    {filteredFloor.map(item => {
                        const isOccupied = item.state.status === 'occupied'
                        const isUpcoming = item.state.status === 'upcoming'
                        const isBlocked = item.state.status === 'blocked'
                        const orderItems = item.orderItems

                        // Progressive stay color
                        let borderStyle = 'border-[oklch(85%_0.012_28)] hover:border-[oklch(52%_0.16_28)]'
                        let bgStyle = 'bg-[oklch(97%_0.008_28)]'
                        let pillStyle = 'bg-[oklch(92%_0.012_140)] text-[oklch(35%_0.08_140)]'
                        let statusText = 'ว่าง (FREE)'

                        if (isOccupied) {
                            if (item.elapsedMins >= 75) {
                                borderStyle = 'border-[oklch(52%_0.16_28)] ring-1 ring-[oklch(52%_0.16_28)]'
                                bgStyle = 'bg-[oklch(96%_0.02_28)]'
                                pillStyle = 'bg-[oklch(52%_0.16_28)] text-white'
                            } else if (item.elapsedMins >= 45) {
                                borderStyle = 'border-[oklch(75%_0.18_65)]'
                                bgStyle = 'bg-[oklch(96%_0.02_65)]'
                                pillStyle = 'bg-[oklch(75%_0.18_65)] text-[oklch(18%_0.012_28)]'
                            } else {
                                borderStyle = 'border-[oklch(52%_0.16_28)]'
                                bgStyle = 'bg-[oklch(95%_0.015_28)]'
                                pillStyle = 'bg-[oklch(52%_0.16_28)] text-white'
                            }
                            statusText = formatShortDuration(item.elapsedMins)
                        } else if (isUpcoming) {
                            borderStyle = 'border-[oklch(60%_0.15_60)]'
                            bgStyle = 'bg-[oklch(96%_0.02_60)]'
                            pillStyle = 'bg-[oklch(60%_0.15_60)] text-black'
                            statusText = 'RESERVED'
                        } else if (isBlocked) {
                            borderStyle = 'border-[oklch(35%_0.010_28)]'
                            bgStyle = 'bg-[oklch(30%_0.010_28)] text-white'
                            pillStyle = 'bg-black/40 text-white'
                            statusText = 'BLOCKED'
                        }

                        // Compact view (หลายโต๊ะ)
                        if (zoomMode === 'compact') {
                            return (
                                <button
                                    key={item.table.id}
                                    type="button"
                                    onClick={() => setInspectingTable(item)}
                                    className={`relative p-2.5 rounded-sm border text-left flex flex-col justify-between min-h-[90px] transition-all cursor-pointer select-none active:scale-97 ${bgStyle} ${borderStyle} ${
                                        item.hasCallBill || item.hasCallStaff ? 'ring-2 ring-[oklch(75%_0.18_65)] animate-pulse' : ''
                                    }`}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <span className="font-mono text-sm font-bold tracking-tight text-[oklch(18%_0.012_28)]">
                                            {item.table.table_name}
                                        </span>
                                        <span className="font-mono text-[9px] opacity-70">
                                            {item.table.capacity}P
                                        </span>
                                    </div>

                                    {item.hasCallBill || item.hasCallStaff ? (
                                        <span className="font-mono text-[8.5px] font-bold px-1 py-0.5 rounded-xs bg-[oklch(78%_0.18_65)] text-[oklch(18%_0.012_28)] truncate block text-center mt-1">
                                            {item.hasCallBill ? 'CALL BILL' : 'CALL STAFF'}
                                        </span>
                                    ) : isOccupied ? (
                                        <div className="mt-1">
                                            <span className="font-mono text-xs font-bold text-[oklch(18%_0.012_28)] block tabular-nums truncate">
                                                ฿{item.billTotal.toLocaleString()}
                                            </span>
                                            <span className={`font-mono text-[8px] font-bold px-1 py-0.2 rounded-xs inline-block mt-0.5 ${pillStyle}`}>
                                                {statusText}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className={`font-mono text-[8px] font-bold px-1 py-0.5 rounded-xs block text-center mt-1 ${pillStyle}`}>
                                            {statusText}
                                        </span>
                                    )}
                                </button>
                            )
                        }

                        // Standard view (สมดุล - พร้อมพรีวิวอาหาร)
                        return (
                            <div
                                key={item.table.id}
                                onClick={() => setInspectingTable(item)}
                                className={`p-3.5 rounded-sm border transition-all cursor-pointer flex flex-col justify-between min-h-[140px] shadow-2xs hover:shadow-sm ${bgStyle} ${borderStyle} ${
                                    item.hasCallBill || item.hasCallStaff ? 'ring-2 ring-[oklch(75%_0.18_65)]' : ''
                                }`}
                            >
                                {/* Header */}
                                <div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-base sm:text-lg font-bold text-[oklch(18%_0.012_28)]">
                                                {item.table.table_name}
                                            </span>
                                            <span className="font-mono text-[10px] text-[oklch(55%_0.010_28)]">
                                                ({item.table.capacity} Pax)
                                            </span>
                                        </div>

                                        <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-xs uppercase tracking-wider ${pillStyle}`}>
                                            {isOccupied ? `${item.elapsedMins} นาที` : statusText}
                                        </span>
                                    </div>

                                    {/* Call Alert Badge */}
                                    {(item.hasCallBill || item.hasCallStaff) && (
                                        <div className="mt-2 px-2 py-1 bg-[oklch(78%_0.18_65)] text-[oklch(18%_0.012_28)] font-mono text-[10px] font-bold rounded-xs flex items-center justify-between animate-pulse">
                                            <span>🔔 {item.hasCallBill ? 'ขอเช็คบิล' : 'เรียกพนักงาน'}</span>
                                            <button
                                                type="button"
                                                onClick={(e) => handleDismissAlert(item.booking?.id, e)}
                                                className="underline ml-1 cursor-pointer text-[9px]"
                                            >
                                                ปิดแจ้งเตือน
                                            </button>
                                        </div>
                                    )}

                                    {/* Food Items Preview (Standard View requirement: แสดงอาหารเบื้องต้น) */}
                                    {isOccupied && (
                                        <div className="mt-2.5 space-y-1 font-mono text-[11px] text-[oklch(42%_0.010_28)]">
                                            {orderItems.length === 0 ? (
                                                <span className="text-[10px] text-[oklch(60%_0.010_28)] italic block">
                                                    ยังไม่มีรายการสั่งอาหาร
                                                </span>
                                            ) : (
                                                <>
                                                    {orderItems.slice(0, 2).map((it, idx) => (
                                                        <div key={idx} className="flex justify-between items-center truncate">
                                                            <span className="truncate">
                                                                {it.quantity}x {it.menu_items?.name || 'อาหาร'}
                                                            </span>
                                                            <span className="tabular-nums font-bold text-[oklch(18%_0.012_28)] ml-1">
                                                                ฿{(Number(it.price_at_time || it.menu_items?.price || 0) * Number(it.quantity || 1)).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {orderItems.length > 2 && (
                                                        <span className="text-[10px] text-[oklch(52%_0.16_28)] font-bold block pt-0.5">
                                                            + อีก {orderItems.length - 2} รายการ (แตะเพื่อดูครบ)
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Footer Bar */}
                                <div className="mt-3 pt-2.5 border-t border-[oklch(85%_0.012_28)] flex items-center justify-between font-mono text-xs">
                                    <span className="text-[10px] text-[oklch(55%_0.010_28)]">
                                        {isOccupied ? `${orderItems.length} รายการ` : 'พร้อมให้บริการ'}
                                    </span>
                                    <span className="font-bold text-sm text-[oklch(18%_0.012_28)] tabular-nums">
                                        {isOccupied ? `฿${item.billTotal.toLocaleString()}` : '-'}
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* 4. Complete Food & Drink Order Checklist Modal ("รายการอาหารต้องขึ้นครบเช๊คได้ ครบถ้วน") */}
            {inspectingTable && (
                <div 
                    onClick={() => setInspectingTable(null)}
                    className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-2xs"
                >
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-sm max-w-lg w-full p-4 sm:p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-[oklch(85%_0.012_28)]">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-mono text-xl font-bold text-[oklch(18%_0.012_28)]">
                                        {inspectingTable.table.table_name}
                                    </h3>
                                    <span className="font-mono text-xs px-2 py-0.5 bg-[oklch(90%_0.010_28)] rounded-xs text-[oklch(18%_0.012_28)]">
                                        {inspectingTable.table.capacity} Pax
                                    </span>
                                </div>
                                <p className="font-mono text-xs text-[oklch(55%_0.010_28)] mt-0.5">
                                    {inspectingTable.state.status === 'occupied' 
                                        ? `เริ่มเปิดโต๊ะ: ${formatThaiTimeOnly(inspectingTable.booking?.booking_time)} • นั่งมาแล้ว ${formatThaiDuration(inspectingTable.elapsedMins)}`
                                        : 'สถานะโต๊ะ: พร้อมให้บริการ'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setInspectingTable(null)}
                                className="font-mono text-xs font-bold text-[oklch(42%_0.010_28)] hover:text-black p-1 cursor-pointer"
                            >
                                ✕ ปิด
                            </button>
                        </div>

                        {/* Customer / Transfer Note */}
                        {inspectingTable.booking?.customer_note && (
                            <div className="mt-3 p-2 bg-[oklch(94%_0.010_28)] border border-[oklch(88%_0.012_28)] font-mono text-[11px] text-[oklch(42%_0.010_28)] rounded-xs">
                                โน้ตลูกค้า: "{inspectingTable.booking.customer_note}"
                            </div>
                        )}

                        {/* Full Items Checklist Area */}
                        <div className="flex-1 overflow-y-auto py-3 divide-y divide-[oklch(88%_0.012_28)] font-mono text-xs">
                            <div className="pb-2 flex justify-between font-bold text-[11px] text-[oklch(55%_0.010_28)] uppercase tracking-wider">
                                <span>รายการอาหาร & ตัวเลือก</span>
                                <span>ยอดเงิน</span>
                            </div>

                            {inspectingTable.orderItems.length === 0 ? (
                                <div className="py-10 text-center text-[oklch(55%_0.010_28)]">
                                    ยังไม่มีรายการอาหารสำหรับโต๊ะนี้
                                </div>
                            ) : (
                                inspectingTable.orderItems.map((item, idx) => {
                                    const itemName = item.menu_items?.name || 'รายการอาหาร'
                                    const price = Number(item.price_at_time || item.menu_items?.price || 0)
                                    const lineTotal = price * Number(item.quantity || 1)
                                    const options = item.selected_options

                                    return (
                                        <div key={item.id || idx} className="py-2.5 flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-2.5">
                                                <span className="w-5 h-5 flex items-center justify-center bg-[oklch(18%_0.012_28)] text-white font-bold rounded-xs text-[11px] tabular-nums mt-0.5">
                                                    {item.quantity}
                                                </span>
                                                <div>
                                                    <span className="font-bold text-sm text-[oklch(18%_0.012_28)] block">
                                                        {itemName}
                                                    </span>
                                                    {options && (
                                                        <span className="text-[11px] text-[oklch(52%_0.16_28)] block mt-0.5">
                                                            {typeof options === 'object' ? JSON.stringify(options).replace(/["{}]/g, ' ') : String(options)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="font-bold text-[oklch(18%_0.012_28)] tabular-nums text-sm">
                                                    ฿{lineTotal.toLocaleString()}
                                                </span>
                                                {item.quantity > 1 && (
                                                    <span className="block text-[10px] text-[oklch(55%_0.010_28)] tabular-nums">
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
                        <div className="pt-3 border-t border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] p-3 rounded-sm space-y-1.5 font-mono text-xs">
                            <div className="flex justify-between items-center text-sm font-bold text-[oklch(18%_0.012_28)]">
                                <span>ยอดรวมค่าอาหารทั้งบิล ({inspectingTable.orderItems.length} รายการ):</span>
                                <span className="text-base text-[oklch(52%_0.16_28)] tabular-nums">
                                    ฿{inspectingTable.billTotal.toLocaleString()}
                                </span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-3 mt-2 flex flex-wrap gap-2">
                            {inspectingTable.booking && (
                                <>
                                    <button
                                        type="button"
                                        disabled={actionLoading}
                                        onClick={() => handleExtendTable(inspectingTable.booking, 30)}
                                        className="flex-1 py-2 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-mono font-bold text-xs rounded-sm cursor-pointer"
                                    >
                                        +30 นาที
                                    </button>
                                    <button
                                        type="button"
                                        disabled={actionLoading}
                                        onClick={() => handleReleaseTable(inspectingTable.booking.id, inspectingTable.table.table_name)}
                                        className="flex-1 py-2 bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white font-mono font-bold text-xs rounded-sm cursor-pointer"
                                    >
                                        เคลียร์โต๊ะ
                                    </button>
                                    <Link
                                        to={`/pos?table=${inspectingTable.table.table_name}`}
                                        target="_blank"
                                        className="flex-1 py-2 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(28%_0.012_28)] text-white font-mono font-bold text-xs rounded-sm text-center cursor-pointer"
                                    >
                                        เปิดใน POS ➔
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
