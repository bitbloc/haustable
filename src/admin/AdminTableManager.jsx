/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import TableManager from '../components/shared/TableManager'
import AdminTableEditor from '../AdminTableEditor'

export default function AdminTableManager({ defaultTab = 'live' }) {
    const [activeTab, setActiveTab] = useState(defaultTab) // 'live' | 'editor'
    
    // Live Summary Stats
    const [metrics, setMetrics] = useState({
        totalTables: 0,
        totalCapacity: 0,
        occupiedTables: 0,
        occupancyRate: 0,
        seatedGuests: 0,
        activeBillTotal: 0,
        pendingCalls: 0
    })

    useEffect(() => {
        fetchMetrics()

        const channel = supabase
            .channel('admin-table-manager-kpi')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => fetchMetrics())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tables_layout' }, () => fetchMetrics())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchMetrics())
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const fetchMetrics = async () => {
        try {
            // 1. Tables
            const { data: tablesData } = await supabase.from('tables_layout').select('id, capacity')
            const totalTables = tablesData ? tablesData.length : 0
            const totalCapacity = tablesData ? tablesData.reduce((sum, t) => sum + (Number(t.capacity) || 0), 0) : 0

            // 2. Active Bookings
            const today = new Date().toISOString().split('T')[0]
            const start = `${today}T00:00:00+07:00`
            const end = `${today}T23:59:59+07:00`

            const { data: bookingsData } = await supabase
                .from('bookings')
                .select(`
                    id, table_id, booking_time, end_time, pax, status, staff_remark, total_amount,
                    order_items(price_at_time, quantity)
                `)
                .in('status', ['confirmed', 'pending', 'seated', 'ready', 'approved', 'paid'])
                .gte('booking_time', start)
                .lte('booking_time', end)

            const now = new Date()
            let occupiedCount = 0
            let seatedPax = 0
            let billSum = 0
            let callAlerts = 0

            if (bookingsData && tablesData) {
                bookingsData.forEach(b => {
                    const bStart = new Date(b.booking_time)
                    const bEnd = b.end_time ? new Date(b.end_time) : new Date(bStart.getTime() + 2 * 60 * 60 * 1000)
                    const isCurrent = now >= bStart && now < bEnd

                    if (isCurrent) {
                        occupiedCount++
                        seatedPax += Number(b.pax) || 2
                        
                        // Calculate order total
                        const items = b.order_items || []
                        const bTotal = items.reduce((sum, i) => sum + (Number(i.price_at_time || i.price || 0) * Number(i.quantity || 1)), 0) || Number(b.total_amount || 0)
                        billSum += bTotal

                        if (b.staff_remark?.includes('[CALL_STAFF]') || b.staff_remark?.includes('[CALL_BILL]')) {
                            callAlerts++
                        }
                    }
                })
            }

            const occRate = totalTables > 0 ? Math.round((occupiedCount / totalTables) * 100) : 0

            setMetrics({
                totalTables,
                totalCapacity,
                occupiedTables: occupiedCount,
                occupancyRate: occRate,
                seatedGuests: seatedPax,
                activeBillTotal: billSum,
                pendingCalls: callAlerts
            })
        } catch (err) {
            console.error('Error fetching table KPI metrics:', err)
        }
    }

    return (
        <div className="flex flex-col min-h-[calc(100vh-140px)] font-sans pb-12">
            
            {/* Top Hub Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 pb-4 border-b border-[oklch(85%_0.012_28)]">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] bg-[oklch(94%_0.02_28)] px-2 py-0.5 rounded-sm">
                            FLOOR & TABLE HUB
                        </span>
                        {metrics.pendingCalls > 0 && (
                            <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-[oklch(60%_0.15_60)] text-black px-2 py-0.5 rounded-sm animate-pulse">
                                {metrics.pendingCalls} SERVICE CALLS
                            </span>
                        )}
                    </div>
                    <h1 className="font-mono text-2xl font-bold tracking-tight text-[oklch(18%_0.012_28)] uppercase mt-1">
                        Floor & Tables
                    </h1>
                    <p className="text-xs text-[oklch(55%_0.010_28)] font-mono mt-0.5">
                        Manage live table availability, guest seating, floorplan geometry & table QR codes
                    </p>
                </div>

                {/* Sub-tab Switcher & External POS */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex bg-[oklch(94%_0.010_28)] p-1 rounded-sm border border-[oklch(85%_0.012_28)] font-mono text-xs">
                        <button
                            type="button"
                            onClick={() => setActiveTab('live')}
                            className={`px-4 py-2 rounded-sm font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                activeTab === 'live'
                                    ? 'bg-[oklch(18%_0.012_28)] text-white shadow-xs'
                                    : 'text-[oklch(42%_0.010_28)] hover:text-black'
                            }`}
                        >
                            Live Operations
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('editor')}
                            className={`px-4 py-2 rounded-sm font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                activeTab === 'editor'
                                    ? 'bg-[oklch(18%_0.012_28)] text-white shadow-xs'
                                    : 'text-[oklch(42%_0.010_28)] hover:text-black'
                            }`}
                        >
                            Layout & QR Studio
                        </button>
                    </div>

                    <a
                        href="/pos"
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2.5 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-mono font-bold text-xs uppercase rounded-sm transition-colors"
                        title="Open POS Terminal"
                    >
                        POS TERMINAL ↗
                    </a>
                </div>
            </div>

            {/* Realtime KPI Bar (Dieter Rams Structural Grid) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <div className="bg-[oklch(98%_0.006_28)] border border-[oklch(85%_0.012_28)] p-3 rounded-sm font-mono">
                    <span className="text-[9px] font-bold uppercase text-[oklch(55%_0.010_28)] tracking-wider block">
                        TOTAL STORE CAPACITY
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-xl font-black text-[oklch(18%_0.012_28)]">
                            {metrics.totalTables} TABLES
                        </span>
                        <span className="text-xs text-[oklch(55%_0.010_28)]">
                            ({metrics.totalCapacity} Seats)
                        </span>
                    </div>
                </div>

                <div className="bg-[oklch(98%_0.006_28)] border border-[oklch(85%_0.012_28)] p-3 rounded-sm font-mono">
                    <span className="text-[9px] font-bold uppercase text-[oklch(55%_0.010_28)] tracking-wider block">
                        LIVE OCCUPANCY RATE
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-xl font-black text-[oklch(52%_0.16_28)]">
                            {metrics.occupancyRate}%
                        </span>
                        <span className="text-xs text-[oklch(55%_0.010_28)]">
                            ({metrics.occupiedTables}/{metrics.totalTables} Occ)
                        </span>
                    </div>
                </div>

                <div className="bg-[oklch(98%_0.006_28)] border border-[oklch(85%_0.012_28)] p-3 rounded-sm font-mono">
                    <span className="text-[9px] font-bold uppercase text-[oklch(55%_0.010_28)] tracking-wider block">
                        SEATED GUESTS
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-xl font-black text-[oklch(18%_0.012_28)]">
                            {metrics.seatedGuests} PAX
                        </span>
                        <span className="text-xs text-[oklch(45%_0.08_140)] font-bold">
                            ACTIVE
                        </span>
                    </div>
                </div>

                <div className="bg-[oklch(98%_0.006_28)] border border-[oklch(85%_0.012_28)] p-3 rounded-sm font-mono">
                    <span className="text-[9px] font-bold uppercase text-[oklch(55%_0.010_28)] tracking-wider block">
                        ACTIVE BILLS TOTAL
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-xl font-black text-[oklch(18%_0.012_28)]">
                            ฿{metrics.activeBillTotal.toLocaleString()}
                        </span>
                        <span className="text-xs text-[oklch(55%_0.010_28)]">
                            LIVE
                        </span>
                    </div>
                </div>
            </div>

            {/* Tab Body */}
            <div className="flex-1 bg-[oklch(98%_0.006_28)] rounded-sm border border-[oklch(85%_0.012_28)] overflow-hidden">
                {activeTab === 'live' ? (
                    <TableManager isStaffView={false} />
                ) : (
                    <AdminTableEditor />
                )}
            </div>
        </div>
    )
}
