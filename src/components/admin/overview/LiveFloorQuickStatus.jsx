/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { getThaiDate, formatThaiTimeOnly, calculateDurationMinutes, formatThaiDuration, formatShortDuration } from '../../../utils/timeUtils'
import { parseTableTransferInfo, isInternalBlockBooking } from '../../../utils/tableTransferHelper'
import { subscribePOSBroadcast } from '../../../utils/realtimeNotifier'

export default function LiveFloorQuickStatus({ onOccupancyChange, externalTables, externalBookings }) {
    const isManaged = Boolean(externalTables && externalBookings)
    const [tables, setTables] = useState(externalTables || [])
    const [bookings, setBookings] = useState(externalBookings || [])
    const [loading, setLoading] = useState(!isManaged)
    const [selectedTableData, setSelectedTableData] = useState(null)
    const [actionLoading, setActionLoading] = useState(false)
    const [currentTime, setCurrentTime] = useState(Date.now())

    // Real-time ticking interval for live floor duration
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(Date.now())
        }, 10000) // Update every 10s
        return () => clearInterval(timer)
    }, [])

    // Synchronize from parent props when managed by AdminDashboard (avoids 100% duplicate queries & duplicate sockets)
    useEffect(() => {
        if (!isManaged) return
        setTables(externalTables || [])
        setBookings(externalBookings || [])
        setLoading(false)

        if (onOccupancyChange && externalTables && externalBookings) {
            const now = new Date()
            let occupiedCount = 0
            let seatedGuests = 0

            externalTables.forEach(table => {
                const tBookings = externalBookings.filter(b => b.table_id === table.id && !isInternalBlockBooking(b))
                const activeB = tBookings.find(b => {
                    if (['completed', 'cancelled', 'void', 'no_show'].includes(b.status)) return false
                    if (b.status === 'seated') return true
                    if (b.status === 'ready' && b.booking_type !== 'pickup') return true
                    if (b.status === 'confirmed' || b.status === 'approved') {
                        const bStart = new Date(b.booking_time)
                        const bEnd = b.end_time ? new Date(b.end_time) : new Date(bStart.getTime() + 2 * 60 * 60 * 1000)
                        return now >= bStart && now < bEnd
                    }
                    return false
                })
                if (activeB) {
                    occupiedCount++
                    seatedGuests += Number(activeB.pax || activeB.guest_count || table.capacity) || 2
                }
            })

            onOccupancyChange({
                totalTables: externalTables.length,
                occupiedTables: occupiedCount,
                totalGuests: seatedGuests
            })
        }
    }, [isManaged, externalTables, externalBookings, onOccupancyChange])

    // Self-managed standalone mode (only runs when NOT managed by AdminDashboard)
    useEffect(() => {
        if (isManaged) return

        fetchFloorData(false)

        let debounceTimer = null
        const debouncedFetch = () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
                fetchFloorData(true)
            }, 250)
        }

        let isRealtimeSubscribed = false
        const channelId = `overview-tables-live-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
        const channel = supabase
            .channel(channelId)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tables_layout' }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, debouncedFetch)
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    isRealtimeSubscribed = true
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    isRealtimeSubscribed = false
                    debouncedFetch()
                }
            })

        // Direct POS broadcast channel (cross-device < 50ms & local BroadcastChannel deduplicated)
        const unsubscribePosBroadcast = subscribePOSBroadcast(() => debouncedFetch())

        const handleStorageSync = (e) => {
            if (e.key === 'pos_last_order_sync') debouncedFetch()
        }
        window.addEventListener('storage', handleStorageSync)

        // Adaptive Polling Fallback (Only active if WebSocket disconnects or tab is visible)
        let heartbeatCounter = 0
        const autoPollTimer = setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
            heartbeatCounter++
            // If realtime is healthy, only heartbeat once every 180 seconds (every 6 ticks of 30s)
            if (isRealtimeSubscribed && heartbeatCounter % 6 !== 0) return
            if (!isRealtimeSubscribed && heartbeatCounter % 2 !== 0) return
            fetchFloorData(true)
        }, 30000)

        // Refetch when tab/window regains focus (with 500ms debounce)
        let focusDebounceTimer = null
        const handleVisibilityOrFocus = () => {
            if (document.visibilityState === 'visible') {
                if (focusDebounceTimer) clearTimeout(focusDebounceTimer)
                focusDebounceTimer = setTimeout(() => {
                    fetchFloorData(true)
                }, 500)
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityOrFocus)
        window.addEventListener('focus', handleVisibilityOrFocus)

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            if (focusDebounceTimer) clearTimeout(focusDebounceTimer)
            clearInterval(autoPollTimer)
            supabase.removeChannel(channel)
            unsubscribePosBroadcast()
            window.removeEventListener('storage', handleStorageSync)
            document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
            window.removeEventListener('focus', handleVisibilityOrFocus)
        }
    }, [isManaged])

    const fetchFloorData = async (isSilent = false) => {
        if (!isSilent) setLoading(true)
        try {
            // 1. Fetch tables with natural table name sorting
            const { data: tablesData, error: tErr } = await supabase
                .from('tables_layout')
                .select('*')

            if (tErr) throw tErr

            // Natural alphanumeric collation (e.g. T1, T2, T3 ... T10, T11)
            const sortedTables = (tablesData || []).slice().sort((a, b) => 
                (a.table_name || '').localeCompare(b.table_name || '', undefined, { numeric: true, sensitivity: 'base' })
            )

            // 2. Fetch today's active bookings + any currently seated tables across floor
            const today = getThaiDate()
            const start = `${today}T00:00:00+07:00`
            const end = `${today}T23:59:59+07:00`
            const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

            const todayReq = supabase
                .from('bookings')
                .select('*, profiles(display_name, phone_number), order_items(price_at_time, quantity)')
                .in('status', ['confirmed', 'pending', 'seated', 'ready', 'approved', 'paid'])
                .or(`and(booking_time.gte.${start},booking_time.lte.${end}),and(created_at.gte.${start},created_at.lte.${end})`)

            const seatedReq = supabase
                .from('bookings')
                .select('*, profiles(display_name, phone_number), order_items(price_at_time, quantity)')
                .in('status', ['seated', 'confirmed', 'ready'])
                .gte('booking_time', recentCutoff)

            const [todayRes, seatedRes] = await Promise.all([todayReq, seatedReq])

            if (todayRes.error) throw todayRes.error

            // Merge & deduplicate
            const bMap = new Map()
            ;(todayRes.data || []).forEach(b => bMap.set(b.id, b))
            ;(seatedRes.data || []).forEach(b => bMap.set(b.id, b))

            const activeBookings = Array.from(bMap.values())

            setTables(sortedTables)
            setBookings(activeBookings)

            // Calculate occupancy for parent
            if (onOccupancyChange) {
                const now = new Date()
                let occupiedCount = 0
                let seatedGuests = 0

                sortedTables.forEach(table => {
                    const tBookings = activeBookings.filter(b => b.table_id === table.id && !isInternalBlockBooking(b))
                    const activeB = tBookings.find(b => {
                        if (['completed', 'cancelled', 'void', 'no_show'].includes(b.status)) return false
                        if (b.status === 'seated') return true
                        if (b.status === 'ready' && b.booking_type !== 'pickup') return true
                        if (b.status === 'confirmed' || b.status === 'approved') {
                            const bStart = new Date(b.booking_time)
                            const bEnd = b.end_time ? new Date(b.end_time) : new Date(bStart.getTime() + 2 * 60 * 60 * 1000)
                            return now >= bStart && now < bEnd
                        }
                        return false
                    })
                    if (activeB) {
                        occupiedCount++
                        seatedGuests += Number(activeB.pax || activeB.guest_count || table.capacity) || 2
                    }
                })

                onOccupancyChange({
                    totalTables: sortedTables.length,
                    occupiedTables: occupiedCount,
                    totalGuests: seatedGuests
                })
            }
        } catch (err) {
            console.error('Error fetching live floor status:', err)
        } finally {
            setLoading(false)
        }
    }

    const getTableState = (tableId) => {
        const now = new Date()
        const tableBookings = bookings.filter(b => b.table_id === tableId)

        if (tableBookings.length === 0) return { status: 'free', booking: null }

        // Current active booking (Seated / In-store Dining / Confirmed Time Window)
        const currentBooking = tableBookings.find(b => {
            if (['completed', 'cancelled', 'void', 'no_show'].includes(b.status)) return false
            if (b.status === 'seated') return true
            if (b.status === 'ready' && b.booking_type !== 'pickup') return true
            if (b.status === 'confirmed' || b.status === 'approved') {
                const start = new Date(b.booking_time)
                const endTime = b.end_time ? new Date(b.end_time) : new Date(start.getTime() + 2 * 60 * 60 * 1000)
                return now >= start && now < endTime
            }
            return false
        })

        if (currentBooking) {
            const isInternalBlock = currentBooking.customer_note === 'Internal Block' || currentBooking.customer_note === 'Maintenance Block' || (currentBooking.booking_type === 'walk_in' && currentBooking.customer_note === 'Internal Block')
            return {
                status: isInternalBlock ? 'blocked' : 'occupied',
                booking: currentBooking
            }
        }

        // Upcoming reservation within 60 mins
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

    const handleTableClick = (table, state) => {
        setSelectedTableData({ table, state })
    }

    return (
        <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm p-4 md:p-6 mb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--color-rule)]">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[var(--brand-plum)]" />
                        <h2 className="tabular-nums text-sm md:text-base font-bold text-[var(--color-ink)]">
                            ผังโต๊ะสดและล็อกโต๊ะด่วน
                        </h2>
                    </div>
                    <p className="text-[13px] text-[var(--color-neutral)] mt-0.5">
                        แตะโต๊ะว่างเพื่อล็อก 2 ชม. หรือแตะโต๊ะที่กำลังทานเพื่อดูรายละเอียด
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Legend badges */}
                    <div className="hidden sm:flex items-center gap-1.5 text-xs">
                        <span className="px-2 py-0.5 rounded-md bg-[var(--status-ok-bg)] text-[var(--status-ok-ink)] font-semibold">ว่าง</span>
                        <span className="px-2 py-0.5 rounded-md bg-[var(--color-plum-pale)] text-[var(--brand-plum)] font-semibold">กำลังทาน</span>
                        <span className="px-2 py-0.5 rounded-md bg-[var(--status-warn-bg)] text-[var(--status-warn-ink)] font-semibold">กำลังจะมา</span>
                        <span className="px-2 py-0.5 rounded-md bg-[var(--color-ink-soft)] text-[var(--color-paper)] font-semibold">งดใช้งาน</span>
                    </div>

                    <Link 
                        to="/admin/tables" 
                        className="inline-flex items-center text-xs font-semibold text-[var(--color-ink)] hover:text-[var(--brand-plum)] bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-3)] border border-[var(--color-rule)] px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                    >
                        เปิดผังโต๊ะเต็ม
                    </Link>
                </div>
            </div>

            {/* Table Matrix Grid */}
            {loading ? (
                <div className="py-12 text-center text-xs text-[var(--color-neutral)]">
                    กำลังโหลดสถานะผังโต๊ะ…
                </div>
            ) : tables.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--color-neutral)]">
                    ยังไม่มีข้อมูลโต๊ะในระบบ
                </div>
            ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 pt-4">
                    {tables.map(table => {
                        const state = getTableState(table.id)
                        let bgStyle = 'bg-[var(--color-paper)] text-[var(--color-ink)] border-[var(--color-control)] hover:border-[var(--status-ok-fill)]'
                        let statusTag = 'ว่าง'
                        let tagStyle = 'bg-[var(--status-ok-bg)] text-[var(--status-ok-ink)]'

                        const transfer = parseTableTransferInfo(state.booking)
                        const hasCallStaff = state.status === 'occupied' && Boolean(state.booking?.staff_remark?.includes('[CALL_STAFF]'))
                        const hasCallBill = state.status === 'occupied' && Boolean(state.booking?.staff_remark?.includes('[CALL_BILL]'))
                        const orderItems = state.booking?.order_items || []
                        const billTotal = orderItems.length > 0 
                            ? orderItems.reduce((sum, item) => sum + (Number(item.price_at_time || 0) * Number(item.quantity || 1)), 0)
                            : Number(state.booking?.total_amount || 0)

                        const startTime = state.booking?.booking_time || state.booking?.created_at
                        const elapsedMins = calculateDurationMinutes(startTime, currentTime)
                        const formattedDur = formatShortDuration(elapsedMins)
                        const isLongStay = elapsedMins >= 90
                        const isWarning = elapsedMins >= 60

                        if (state.status === 'occupied') {
                            bgStyle = isLongStay 
                                ? 'bg-[var(--color-plum-pale)] text-[var(--color-ink)] border-[var(--brand-plum)] ring-1 ring-[var(--brand-plum)]' 
                                : isWarning 
                                    ? 'bg-[var(--status-warn-bg)] text-[var(--color-ink)] border-[var(--status-warn-border)]' 
                                    : 'bg-[var(--color-paper-2)] text-[var(--color-ink)] border-[var(--brand-plum)]'
                            statusTag = billTotal > 0 ? `฿${billTotal.toLocaleString()} (${formattedDur})` : `${formattedDur}`
                            tagStyle = 'bg-[var(--brand-plum)] text-[var(--color-paper)]'
                        } else if (state.status === 'upcoming') {
                            bgStyle = 'bg-[var(--status-warn-bg)] text-[var(--color-ink)] border-[var(--status-warn-border)]'
                            const bTime = state.booking?.booking_time ? new Date(state.booking.booking_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''
                            statusTag = bTime ? `จอง ${bTime}` : 'จองแล้ว'
                            tagStyle = 'bg-[var(--status-warn-bright)] text-[var(--color-ink)]'
                        } else if (state.status === 'blocked') {
                            bgStyle = 'bg-[var(--color-ink-soft)] text-[var(--color-paper)] border-[var(--color-ink)]'
                            statusTag = 'งดใช้งาน'
                            tagStyle = 'bg-[var(--charcoal)] text-[var(--color-paper)]'
                        }

                        return (
                            <button
                                key={table.id}
                                type="button"
                                onClick={() => handleTableClick(table, state)}
                                disabled={actionLoading}
                                className={`relative p-3 rounded-lg border transition-colors text-left flex flex-col justify-between min-h-[84px] active:scale-95 select-none cursor-pointer ${bgStyle} ${
                                    hasCallStaff || hasCallBill ? 'ring-2 ring-[var(--status-warn-border)]' : ''
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="tabular-nums text-xs md:text-sm font-bold tracking-tight">
                                        {table.table_name}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        {transfer.isMergedTarget && (
                                            <span className="bg-[var(--status-ok-fill)] text-[var(--color-paper)] text-[11px] tabular-nums font-bold px-1 rounded-sm">
                                                +{transfer.mergedFromTables.join(',')}
                                            </span>
                                        )}
                                        {transfer.isMoved && (
                                            <span className="bg-[var(--status-info-fill)] text-[var(--color-paper)] text-[11px] tabular-nums font-bold px-1 rounded-sm">
                                                ย้าย
                                            </span>
                                        )}
                                        <span className="tabular-nums text-xs opacity-70">
                                            {table.capacity}P
                                        </span>
                                    </div>
                                </div>

                                {hasCallStaff || hasCallBill ? (
                                    <div className="mt-2">
                                        <span className="tabular-nums text-[11px] font-bold px-1.5 py-0.5 rounded-md block text-center truncate bg-[var(--status-warn-bright)] text-[var(--color-ink)]">
                                            {hasCallBill ? 'เรียกเช็คบิล' : 'เรียกพนักงาน'}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="mt-2">
                                        <span className={`tabular-nums text-[11px] font-semibold px-1.5 py-0.5 rounded-md block text-center truncate ${tagStyle}`}>
                                            {statusTag}
                                        </span>
                                    </div>
                                )}
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Inspection / Action Modal */}
            {selectedTableData && (
                <div className="fixed inset-0 bg-[var(--color-veil)] z-50 flex items-center justify-center p-4">
                    <div className="bg-[var(--color-paper)] rounded-xl max-w-md w-full p-6 shadow-[var(--shadow-sheet)]">
                        <div className="flex items-center justify-between pb-3 border-b border-[var(--color-rule)]">
                            <div>
                                <h3 className="tabular-nums text-lg font-bold text-[var(--color-ink)]">
                                    โต๊ะ {selectedTableData.table.table_name} ({selectedTableData.table.capacity} ที่นั่ง)
                                </h3>
                                <p className="text-xs text-[var(--color-neutral)]">
                                    ข้อมูลโต๊ะหน้าร้าน
                                </p>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setSelectedTableData(null)}
                                className="text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)] px-2.5 py-1.5 rounded-lg bg-[var(--color-paper-2)] cursor-pointer transition-colors"
                            >
                                ปิด
                            </button>
                        </div>

                        {selectedTableData.state.booking && (() => {
                            const modalTransfer = parseTableTransferInfo(selectedTableData.state.booking, bookings)
                            return (
                                <div className="my-4 space-y-3 tabular-nums text-xs">
                                    {modalTransfer.isMergedTarget && (
                                        <div className="bg-[var(--status-ok-bg)] text-[var(--status-ok-ink)] border border-[var(--status-ok-border)] p-2.5 rounded-lg font-semibold flex items-center gap-1.5">
                                            <span>รวมบิล:</span>
                                            <span>บิลนี้รวมรายการมาจาก {modalTransfer.mergedFromTableDisplay || `โต๊ะ ${modalTransfer.mergedFromTables.join(', ')}`}</span>
                                        </div>
                                    )}
                                    {modalTransfer.isMoved && (
                                        <div className="bg-[var(--status-info-bg)] text-[var(--status-info-ink)] border border-[var(--status-info-border)] p-2.5 rounded-lg font-semibold flex items-center gap-1.5">
                                            <span>ย้ายโต๊ะ:</span>
                                            <span>ลูกค้าย้ายมาจาก โต๊ะ {modalTransfer.movedFromTable}</span>
                                        </div>
                                    )}
                                    <div className="bg-[var(--color-paper-2)] p-3 rounded-lg border border-[var(--color-paper-3)] space-y-1.5">
                                        <div className="flex justify-between">
                                            <span className="text-[var(--color-neutral)]">ชื่อลูกค้า</span>
                                            <span className="font-bold text-[var(--color-ink)]">
                                                {selectedTableData.state.booking.pickup_contact_name || selectedTableData.state.booking.profiles?.display_name || 'ลูกค้าทั่วไป'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-[var(--color-neutral)]">ประเภท</span>
                                            <span className="font-bold text-[var(--brand-plum)]">
                                                {selectedTableData.state.booking.booking_type}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-[var(--color-neutral)]">เวลาเริ่ม</span>
                                            <span className="font-bold">
                                                {formatThaiTimeOnly(selectedTableData.state.booking.booking_time)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-[var(--color-neutral)]">เวลาที่ใช้บริการ</span>
                                            <span className="font-bold tabular-nums text-[var(--brand-plum)]">
                                                {formatThaiDuration(calculateDurationMinutes(selectedTableData.state.booking.booking_time, currentTime))}
                                            </span>
                                        </div>
                                        {selectedTableData.state.booking.customer_note && (
                                            <div className="pt-1 text-xs text-[var(--color-muted)] border-t border-[var(--color-paper-3)]">
                                                โน้ตลูกค้า: "{selectedTableData.state.booking.customer_note}"
                                            </div>
                                        )}
                                        {modalTransfer.cleanRemark && (
                                            <div className="pt-1 text-xs text-[var(--color-muted)] border-t border-[var(--color-paper-3)]">
                                                หมายเหตุ: "{modalTransfer.cleanRemark}"
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })()}

                        {!selectedTableData.state.booking && (
                            <div className="my-6 py-4 text-center text-xs text-[var(--color-neutral)] bg-[var(--color-paper-2)] rounded-lg border border-[var(--color-paper-3)]">
                                โต๊ะว่าง พร้อมเปิดบริการที่หน้าเครื่อง POS
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4 pt-3 border-t border-[var(--color-rule)]">
                            <span className="text-xs text-[var(--color-neutral)]">
                                การเปิดโต๊ะ เช็คบิล และเคลียร์โต๊ะ ดำเนินการผ่านเครื่อง POS หน้าร้าน
                            </span>
                            <button
                                type="button"
                                onClick={() => setSelectedTableData(null)}
                                className="px-5 py-2.5 bg-[var(--color-ink)] hover:bg-[var(--action-primary-hover)] text-[var(--color-paper)] font-semibold text-xs rounded-lg cursor-pointer whitespace-nowrap self-end sm:self-auto transition-colors"
                            >
                                ปิดหน้าต่าง
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
