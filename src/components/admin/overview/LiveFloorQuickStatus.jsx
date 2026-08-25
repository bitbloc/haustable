/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Lock, Unlock, Clock, User, Phone, CheckCircle2, AlertTriangle, ArrowUpRight, RotateCcw, Timer } from 'lucide-react'

import { getThaiDate, formatThaiTimeOnly, calculateDurationMinutes, formatThaiDuration, formatShortDuration } from '../../../utils/timeUtils'
import { parseTableTransferInfo } from '../../../utils/tableTransferHelper'

export default function LiveFloorQuickStatus({ onOccupancyChange }) {
    const [tables, setTables] = useState([])
    const [bookings, setBookings] = useState([])
    const [loading, setLoading] = useState(true)
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

    useEffect(() => {
        fetchFloorData()

        let debounceTimer = null
        const debouncedFetch = () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
                fetchFloorData()
            }, 400)
        }

        const channel = supabase
            .channel('overview-tables-live')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tables_layout' }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, debouncedFetch)
            .subscribe()

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            supabase.removeChannel(channel)
        }
    }, [])

    const fetchFloorData = async () => {
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

            // 2. Fetch today's active bookings + any active seated bookings
            const today = getThaiDate()
            const start = `${today}T00:00:00+07:00`
            const end = `${today}T23:59:59+07:00`

            const { data: bookingsData, error: bErr } = await supabase
                .from('bookings')
                .select('*, profiles(display_name, phone_number), order_items(price_at_time, quantity)')
                .in('status', ['confirmed', 'pending', 'seated', 'ready', 'approved', 'paid'])
                .gte('booking_time', start)
                .lte('booking_time', end)

            if (bErr) throw bErr

            const activeBookings = bookingsData || []

            setTables(sortedTables)
            setBookings(activeBookings)

            // Calculate occupancy for parent
            if (onOccupancyChange) {
                const now = new Date()
                let occupiedCount = 0
                let seatedGuests = 0

                sortedTables.forEach(table => {
                    const tBookings = activeBookings.filter(b => b.table_id === table.id)
                    const isOcc = tBookings.some(b => {
                        if (b.status === 'seated') return true
                        if (b.status === 'ready' && b.booking_type !== 'pickup') return true
                        const bStart = new Date(b.booking_time)
                        const bEnd = b.end_time ? new Date(b.end_time) : new Date(bStart.getTime() + 2 * 60 * 60 * 1000)
                        return now >= bStart && now < bEnd
                    })
                    if (isOcc) {
                        occupiedCount++
                        seatedGuests += Number(table.capacity) || 2
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

        // Current active booking (Seated / In-store Dining / Time Window)
        const currentBooking = tableBookings.find(b => {
            if (b.status === 'seated') return true
            if (b.status === 'ready' && b.booking_type !== 'pickup') return true
            const start = new Date(b.booking_time)
            const endTime = b.end_time ? new Date(b.end_time) : new Date(start.getTime() + 2 * 60 * 60 * 1000)
            return now >= start && now < endTime
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

    const handleTableClick = async (table, state) => {
        if (state.status === 'free') {
            // 1-Tap Quick Walk-in Block
            await quickBlockTable(table)
        } else {
            // Open inspection sheet / modal
            setSelectedTableData({ table, state })
        }
    }

    const quickBlockTable = async (table) => {
        setActionLoading(true)
        try {
            const now = new Date()
            const endTime = new Date(now.getTime() + 2 * 60 * 60 * 1000) // +2 Hours

            const payload = {
                table_id: table.id,
                booking_time: now.toISOString(),
                end_time: endTime.toISOString(),
                booking_type: 'walk_in',
                status: 'seated',
                pickup_contact_name: 'Walk-in Guest',
                customer_note: 'Internal Block',
                pax: table.capacity || 2,
                total_amount: 0,
                tracking_token: crypto.randomUUID()
            }

            const { error } = await supabase.from('bookings').insert(payload)
            if (error) throw error

            toast.success(`Blocked ${table.table_name} for 2 Hours`, {
                description: 'Tap table again to release',
                duration: 2500
            })
            fetchFloorData()
        } catch (err) {
            toast.error('Failed to block table: ' + err.message)
        } finally {
            setActionLoading(false)
        }
    }

    const handleReleaseTable = async (bookingId, tableName) => {
        setActionLoading(true)
        try {
            const { error } = await supabase
                .from('bookings')
                .update({ status: 'completed', end_time: new Date().toISOString() })
                .eq('id', bookingId)

            if (error) throw error

            toast.success(`Released ${tableName}`, { description: 'Table is now available' })
            setSelectedTableData(null)
            fetchFloorData()
        } catch (err) {
            toast.error('Failed to release: ' + err.message)
        } finally {
            setActionLoading(false)
        }
    }

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

            toast.success(`Extended +${mins} mins`, { description: `New end time: ${newEnd.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}` })
            setSelectedTableData(null)
            fetchFloorData()
        } catch (err) {
            toast.error('Failed to extend: ' + err.message)
        } finally {
            setActionLoading(false)
        }
    }

    return (
        <div className="bg-[oklch(98%_0.006_28)] border border-[oklch(85%_0.012_28)] rounded-sm p-4 md:p-6 mb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[oklch(85%_0.012_28)]">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[oklch(52%_0.16_28)]" />
                        <h2 className="font-mono text-sm md:text-base font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                            LIVE FLOOR & 1-TAP TABLE BLOCK
                        </h2>
                    </div>
                    <p className="text-xs text-[oklch(55%_0.010_28)] font-mono mt-0.5">
                        Tap empty table to block 2h for walk-in • Tap occupied table to release
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Legend badges */}
                    <div className="hidden sm:flex items-center gap-2 font-mono text-[10px] text-[oklch(42%_0.010_28)]">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[oklch(45%_0.08_140)]" /> FREE
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[oklch(52%_0.16_28)]" /> OCCUPIED
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[oklch(60%_0.15_60)]" /> UPCOMING
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[oklch(35%_0.010_28)]" /> BLOCKED
                        </span>
                    </div>

                    <Link 
                        to="/admin/tables" 
                        className="inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)] hover:text-[oklch(52%_0.16_28)] bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] px-3 py-1.5 rounded-sm transition-colors"
                    >
                        FULL FLOORPLAN <ArrowUpRight size={14} />
                    </Link>
                </div>
            </div>

            {/* Table Matrix Grid */}
            {loading ? (
                <div className="py-12 text-center font-mono text-xs text-[oklch(55%_0.010_28)] animate-pulse">
                    LOADING LIVE FLOOR STATUS...
                </div>
            ) : tables.length === 0 ? (
                <div className="py-12 text-center font-mono text-xs text-[oklch(55%_0.010_28)]">
                    NO TABLES CONFIGURED IN SYSTEM
                </div>
            ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 pt-4">
                    {tables.map(table => {
                        const state = getTableState(table.id)
                        let bgStyle = 'bg-[oklch(98%_0.006_28)] text-[oklch(18%_0.012_28)] border-[oklch(82%_0.012_28)] hover:border-[oklch(45%_0.08_140)]'
                        let statusTag = 'FREE'
                        let tagStyle = 'bg-[oklch(92%_0.012_140)] text-[oklch(35%_0.08_140)]'

                        const transfer = parseTableTransferInfo(state.booking)
                        const hasCallStaff = state.booking?.staff_remark?.includes('[CALL_STAFF]')
                        const hasCallBill = state.booking?.staff_remark?.includes('[CALL_BILL]')
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
                                ? 'bg-[oklch(96%_0.03_28)] text-[oklch(18%_0.012_28)] border-[oklch(52%_0.16_28)] ring-1 ring-[oklch(52%_0.16_28)]' 
                                : isWarning 
                                    ? 'bg-amber-50/70 text-[oklch(18%_0.012_28)] border-amber-300'
                                    : 'bg-[oklch(95%_0.02_28)] text-[oklch(18%_0.012_28)] border-[oklch(52%_0.16_28)]'
                            statusTag = billTotal > 0 ? `฿${billTotal.toLocaleString()} • ${formattedDur}` : `${formattedDur}`
                            tagStyle = isLongStay ? 'bg-[oklch(52%_0.16_28)] text-white' : 'bg-[oklch(52%_0.16_28)] text-white'
                        } else if (state.status === 'upcoming') {
                            bgStyle = 'bg-[oklch(96%_0.02_60)] text-[oklch(18%_0.012_28)] border-[oklch(60%_0.15_60)]'
                            const bTime = state.booking?.booking_time ? new Date(state.booking.booking_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''
                            statusTag = bTime ? `RES ${bTime}` : 'RESERVED'
                            tagStyle = 'bg-[oklch(60%_0.15_60)] text-black'
                        } else if (state.status === 'blocked') {
                            bgStyle = 'bg-[oklch(30%_0.010_28)] text-white border-[oklch(20%_0.010_28)]'
                            statusTag = 'BLOCKED'
                            tagStyle = 'bg-black/40 text-white'
                        }

                        return (
                            <button
                                key={table.id}
                                onClick={() => handleTableClick(table, state)}
                                disabled={actionLoading}
                                className={`relative p-3 rounded-sm border transition-all text-left flex flex-col justify-between min-h-[84px] active:scale-95 select-none ${bgStyle} ${
                                    hasCallStaff || hasCallBill ? 'ring-2 ring-amber-500 animate-pulse' : ''
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-mono text-xs md:text-sm font-bold tracking-tight">
                                        {table.table_name}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        {transfer.isMergedTarget && (
                                            <span className="bg-[oklch(45%_0.08_140)] text-white text-[8px] font-mono font-bold px-1 rounded-xs">
                                                +{transfer.mergedFromTables.join(',')}
                                            </span>
                                        )}
                                        {transfer.isMoved && (
                                            <span className="bg-blue-600 text-white text-[8px] font-mono font-bold px-1 rounded-xs">
                                                ย้าย
                                            </span>
                                        )}
                                        <span className="font-mono text-[9px] opacity-70">
                                            {table.capacity}P
                                        </span>
                                    </div>
                                </div>

                                {hasCallStaff || hasCallBill ? (
                                    <div className="mt-2">
                                        <span className="font-mono text-[8px] md:text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider block text-center truncate bg-amber-500 text-black">
                                            {hasCallBill ? 'CALL BILL' : 'CALL STAFF'}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="mt-2">
                                        <span className={`font-mono text-[8px] md:text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider block text-center truncate ${tagStyle}`}>
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
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-[oklch(98%_0.006_28)] border border-[oklch(85%_0.012_28)] rounded-sm max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between pb-3 border-b border-[oklch(85%_0.012_28)]">
                            <div>
                                <span className="font-mono text-[10px] uppercase font-bold text-[oklch(55%_0.010_28)]">
                                    TABLE INSPECTION
                                </span>
                                <h3 className="font-mono text-lg font-bold text-[oklch(18%_0.012_28)]">
                                    {selectedTableData.table.table_name} ({selectedTableData.table.capacity} Pax)
                                </h3>
                            </div>
                            <button 
                                onClick={() => setSelectedTableData(null)}
                                className="font-mono text-xs font-bold text-[oklch(42%_0.010_28)] hover:text-black p-1"
                            >
                                ✕ CLOSE
                            </button>
                        </div>

                        {selectedTableData.state.booking && (() => {
                            const modalTransfer = parseTableTransferInfo(selectedTableData.state.booking)
                            return (
                                <div className="my-4 space-y-3 font-mono text-xs">
                                    {modalTransfer.isMergedTarget && (
                                        <div className="bg-[oklch(94%_0.02_140)] text-[oklch(30%_0.08_140)] border border-[oklch(82%_0.04_140)] p-2 rounded-sm font-bold flex items-center gap-1.5">
                                            <span>COMBINED BILL:</span>
                                            <span>บิลนี้รวมรายการมาจาก โต๊ะ {modalTransfer.mergedFromTables.join(', ')}</span>
                                        </div>
                                    )}
                                    {modalTransfer.isMoved && (
                                        <div className="bg-[oklch(94%_0.02_220)] text-[oklch(30%_0.10_220)] border border-[oklch(82%_0.04_220)] p-2 rounded-sm font-bold flex items-center gap-1.5">
                                            <span>MOVED:</span>
                                            <span>ลูกค้าย้ายมาจาก โต๊ะ {modalTransfer.movedFromTable}</span>
                                        </div>
                                    )}
                                    <div className="bg-[oklch(94%_0.010_28)] p-3 rounded-sm border border-[oklch(88%_0.008_28)] space-y-1.5">
                                        <div className="flex justify-between">
                                            <span className="text-[oklch(55%_0.010_28)]">GUEST NAME</span>
                                            <span className="font-bold text-[oklch(18%_0.012_28)]">
                                                {selectedTableData.state.booking.pickup_contact_name || selectedTableData.state.booking.profiles?.display_name || 'Guest'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-[oklch(55%_0.010_28)]">TYPE</span>
                                            <span className="font-bold uppercase text-[oklch(52%_0.16_28)]">
                                                {selectedTableData.state.booking.booking_type}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-[oklch(55%_0.010_28)]">START TIME</span>
                                            <span className="font-bold">
                                                {formatThaiTimeOnly(selectedTableData.state.booking.booking_time)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-[oklch(55%_0.010_28)]">ELAPSED (เวลาที่ใช้บริการ)</span>
                                            <span className="font-bold font-mono text-[oklch(52%_0.16_28)]">
                                                {formatThaiDuration(calculateDurationMinutes(selectedTableData.state.booking.booking_time, currentTime))}
                                            </span>
                                        </div>
                                        {selectedTableData.state.booking.customer_note && (
                                            <div className="pt-1 text-[11px] text-[oklch(42%_0.010_28)] border-t border-[oklch(88%_0.008_28)]">
                                                Note: "{selectedTableData.state.booking.customer_note}"
                                            </div>
                                        )}
                                        {modalTransfer.cleanRemark && (
                                            <div className="pt-1 text-[11px] text-[oklch(42%_0.010_28)] border-t border-[oklch(88%_0.008_28)]">
                                                Remark: "{modalTransfer.cleanRemark}"
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })()}

                        <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-3 border-t border-[oklch(85%_0.012_28)]">
                            {selectedTableData.state.booking && (
                                <>
                                    <button
                                        onClick={() => handleExtendTable(selectedTableData.state.booking, 30)}
                                        disabled={actionLoading}
                                        className="flex-1 py-2.5 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-mono font-bold text-xs uppercase rounded-sm"
                                    >
                                        +30 MINS
                                    </button>
                                    <button
                                        onClick={() => handleReleaseTable(selectedTableData.state.booking.id, selectedTableData.table.table_name)}
                                        disabled={actionLoading}
                                        className="flex-1 py-2.5 bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white font-mono font-bold text-xs uppercase rounded-sm flex items-center justify-center gap-1.5"
                                    >
                                        <Unlock size={14} /> RELEASE TABLE
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
