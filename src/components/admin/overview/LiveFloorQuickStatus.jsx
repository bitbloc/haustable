/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Lock, Unlock, Clock, User, Phone, CheckCircle2, AlertTriangle, ArrowUpRight, RotateCcw } from 'lucide-react'

export default function LiveFloorQuickStatus({ onOccupancyChange }) {
    const [tables, setTables] = useState([])
    const [bookings, setBookings] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedTableData, setSelectedTableData] = useState(null)
    const [actionLoading, setActionLoading] = useState(false)

    useEffect(() => {
        fetchFloorData()

        const channel = supabase
            .channel('overview-tables-live')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
                fetchFloorData()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const fetchFloorData = async () => {
        try {
            // 1. Fetch tables
            const { data: tablesData, error: tErr } = await supabase
                .from('tables_layout')
                .select('*')
                .order('id')

            if (tErr) throw tErr

            // 2. Fetch today's active bookings
            const today = new Date().toISOString().split('T')[0]
            const start = `${today}T00:00:00+07:00`
            const end = `${today}T23:59:59+07:00`

            const { data: bookingsData, error: bErr } = await supabase
                .from('bookings')
                .select('*, profiles(display_name, phone_number)')
                .in('status', ['confirmed', 'pending', 'seated', 'ready', 'approved', 'paid'])
                .gte('booking_time', start)
                .lte('booking_time', end)

            if (bErr) throw bErr

            const activeTables = tablesData || []
            const activeBookings = bookingsData || []

            setTables(activeTables)
            setBookings(activeBookings)

            // Calculate occupancy for parent
            if (onOccupancyChange) {
                const now = new Date()
                let occupiedCount = 0
                let seatedGuests = 0

                activeTables.forEach(table => {
                    const tBookings = activeBookings.filter(b => b.table_id === table.id)
                    const isOcc = tBookings.some(b => {
                        const bStart = new Date(b.booking_time)
                        const bEnd = b.end_time ? new Date(b.end_time) : new Date(bStart.getTime() + 2 * 60 * 60 * 1000)
                        return now >= bStart && now < bEnd
                    })
                    if (isOcc) {
                        occupiedCount++
                        seatedGuests += table.capacity || 2
                    }
                })

                onOccupancyChange({
                    totalTables: activeTables.length,
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

        // Current active booking
        const currentBooking = tableBookings.find(b => {
            const start = new Date(b.booking_time)
            const endTime = b.end_time ? new Date(b.end_time) : new Date(start.getTime() + 2 * 60 * 60 * 1000)
            return now >= start && now < endTime
        })

        if (currentBooking) {
            const isInternalBlock = currentBooking.booking_type === 'walk_in' && currentBooking.customer_note === 'Internal Block'
            return {
                status: isInternalBlock ? 'blocked' : 'occupied',
                booking: currentBooking
            }
        }

        // Upcoming reservation within 60 mins
        const upcoming = tableBookings.find(b => {
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
            const newEnd = new Date(currentEnd.getTime() + mins * 60 * 1000)

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

                        if (state.status === 'occupied') {
                            bgStyle = 'bg-[oklch(95%_0.02_28)] text-[oklch(18%_0.012_28)] border-[oklch(52%_0.16_28)]'
                            statusTag = 'OCCUPIED'
                            tagStyle = 'bg-[oklch(52%_0.16_28)] text-white'
                        } else if (state.status === 'upcoming') {
                            bgStyle = 'bg-[oklch(96%_0.02_60)] text-[oklch(18%_0.012_28)] border-[oklch(60%_0.15_60)]'
                            statusTag = 'RESERVED'
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
                                className={`relative p-3 rounded-sm border transition-all text-left flex flex-col justify-between min-h-[84px] active:scale-95 select-none ${bgStyle}`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-mono text-xs md:text-sm font-bold tracking-tight">
                                        {table.table_name}
                                    </span>
                                    <span className="font-mono text-[9px] opacity-70">
                                        {table.capacity}P
                                    </span>
                                </div>

                                <div className="mt-2">
                                    <span className={`font-mono text-[8px] md:text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider block text-center truncate ${tagStyle}`}>
                                        {statusTag}
                                    </span>
                                </div>
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

                        {selectedTableData.state.booking && (
                            <div className="my-4 space-y-3 font-mono text-xs">
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
                                            {new Date(selectedTableData.state.booking.booking_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    {selectedTableData.state.booking.customer_note && (
                                        <div className="pt-1 text-[11px] text-[oklch(42%_0.010_28)] border-t border-[oklch(88%_0.008_28)]">
                                            Note: "{selectedTableData.state.booking.customer_note}"
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

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
