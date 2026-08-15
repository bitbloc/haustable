/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from './lib/supabaseClient'
import { RotateCcw, ArrowUpRight, Volume2, VolumeX, ShieldCheck, Sparkles } from 'lucide-react'
import PageTransition from './components/PageTransition'
import { getThaiDate } from './utils/timeUtils'
import { toast } from 'sonner'
import ConfirmationModal from './components/ConfirmationModal'

// Components
import LivePulseMetrics from './components/admin/overview/LivePulseMetrics'
import LiveFloorQuickStatus from './components/admin/overview/LiveFloorQuickStatus'
import InboxSection from './components/admin/InboxSection'
import ScheduleSection from './components/admin/ScheduleSection'
import SlipModal from './components/shared/SlipModal'
import ViewSlipModal from './components/shared/ViewSlipModal'

export default function AdminDashboard() {
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: null })
    const [bookings, setBookings] = useState([]) // Stores Pending (All) + Today's Bookings
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('overview') // overview, dine_in, pickup
    const [slipData, setSlipData] = useState(null) // { booking, type }
    const [viewSlipUrl, setViewSlipUrl] = useState(null)
    const [floorOccupancy, setFloorOccupancy] = useState({ totalTables: 12, occupiedTables: 0, totalGuests: 0 })

    useEffect(() => {
        fetchData()

        // Real-time: Refresh on any booking change
        const subscription = supabase
            .channel('public:admin-dashboard')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchData)
            .subscribe()

        return () => {
            supabase.removeChannel(subscription)
        }
    }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            const today = getThaiDate() // YYYY-MM-DD

            // 1. Fetch ALL Pending (Inbox)
            const pendingReq = supabase
                .from('bookings')
                .select(`
                    *,
                    order_items (
                        quantity,
                        price_at_time,
                        menu_items ( name, price )
                    ),
                    profiles ( display_name, phone_number ),
                    tables_layout ( table_name )
                `)
                .eq('status', 'pending')
                .order('booking_time', { ascending: true })

            // 2. Fetch ALL Today's bookings (Schedule / Logs)
            const todayReq = supabase
                .from('bookings')
                .select(`
                    *,
                    order_items (
                        quantity,
                        price_at_time,
                        menu_items ( name, price )
                    ),
                    profiles ( display_name, phone_number ),
                    tables_layout ( table_name )
                `)
                .gte('booking_time', `${today}T00:00:00+07:00`)
                .lte('booking_time', `${today}T23:59:59+07:00`)
                .order('booking_time', { ascending: true })

            const [pendingRes, todayRes] = await Promise.all([pendingReq, todayReq])

            if (pendingRes.error) throw pendingRes.error
            if (todayRes.error) throw todayRes.error

            // Merge and Deduplicate (in case a pending booking is also today)
            const map = new Map()
            ;(pendingRes.data || []).forEach(b => map.set(b.id, b))
            ;(todayRes.data || []).forEach(b => map.set(b.id, b))

            setBookings(Array.from(map.values()))

        } catch (error) {
            console.error('Error fetching dashboard data:', error.message)
            toast.error('Failed to load dashboard data')
        } finally {
            setLoading(false)
        }
    }

    const updateStatus = async (id, status) => {
        setConfirmModal({
            isOpen: true,
            title: status === 'confirmed' ? 'Confirm Order' : (status === 'cancelled' ? 'Reject Order' : 'Update Status'),
            message: `Are you sure you want to mark this order as ${status}?`,
            isDangerous: status === 'cancelled',
            action: async () => {
                setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b))

                const { error } = await supabase
                    .from('bookings')
                    .update({ status })
                    .eq('id', id)

                if (error) {
                    toast.error('Error updating status: ' + error.message)
                    fetchData()
                } else {
                    toast.success('Status updated to ' + status)
                    fetchData()
                }
            }
        })
    }

    // --- DERIVED STATE ---
    // 1. Inbox: Pending (ALL dates)
    const pendingBookings = useMemo(() =>
        bookings.filter(b => b.status === 'pending').sort((a, b) => new Date(a.booking_time) - new Date(b.booking_time))
        , [bookings])

    // 2. Schedule: Confirmed Today
    const scheduleBookings = useMemo(() => {
        const todayStr = getThaiDate()
        return bookings.filter(b => {
            const bDate = new Date(b.booking_time).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
            const isToday = bDate === todayStr
            const isConfirmed = b.status === 'confirmed' || b.status === 'seated' || b.status === 'ready' || b.status === 'paid'
            return isToday && isConfirmed
        }).sort((a, b) => new Date(a.booking_time) - new Date(b.booking_time))
    }, [bookings])

    // 3. Live Financial Metrics for Today
    const { revenueToday, completedOrdersCount, dineInCount, pickupCount } = useMemo(() => {
        const todayStr = getThaiDate()
        let rev = 0
        let paidCount = 0
        let dineIn = 0
        let pickup = 0

        bookings.forEach(b => {
            const bDate = new Date(b.booking_time).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
            if (bDate === todayStr && (b.status === 'confirmed' || b.status === 'completed' || b.status === 'paid' || b.status === 'seated')) {
                const amount = Number(b.total_amount || b.total_price || 0)
                rev += amount
                paidCount++

                if (b.booking_type === 'dine_in' || b.booking_type === 'walk_in') {
                    dineIn++
                } else if (b.booking_type === 'pickup') {
                    pickup++
                }
            }
        })

        return {
            revenueToday: rev,
            completedOrdersCount: paidCount,
            dineInCount: dineIn,
            pickupCount: pickup
        }
    }, [bookings])

    // --- Sound Logic ---
    const [soundUrl, setSoundUrl] = useState(null)
    const [soundMuted, setSoundMuted] = useState(false)
    const [audio] = useState(new Audio())

    useEffect(() => {
        const fetchSound = async () => {
            const { data } = await supabase.from('app_settings').select('value').eq('key', 'alert_sound_url').single()
            if (data?.value) setSoundUrl(data.value)
        }
        fetchSound()
        audio.loop = true
    }, [])

    useEffect(() => {
        if (!soundMuted && soundUrl && pendingBookings.length > 0) {
            audio.src = soundUrl
            audio.play().catch(e => console.log('Autoplay blocked:', e))
        } else {
            audio.pause()
            audio.currentTime = 0
        }
        return () => audio.pause()
    }, [pendingBookings.length, soundUrl, soundMuted])

    const handlePrint = (booking, type) => {
        setSlipData({ booking, type })
    }

    const getTabContent = () => {
        if (activeTab === 'overview') {
            return (
                <div className="space-y-6">
                    {/* ZERO INBOX */}
                    <InboxSection 
                        bookings={pendingBookings} 
                        onUpdateStatus={updateStatus}
                        onViewSlip={setViewSlipUrl}
                    />

                    {/* TODAY'S SCHEDULE */}
                    <ScheduleSection 
                        bookings={scheduleBookings} 
                        loading={loading} 
                        onPrint={handlePrint}
                        onViewSlip={setViewSlipUrl}
                    />
                </div>
            )
        }

        const filtered = bookings.filter(b => b.booking_type === activeTab && (b.status === 'confirmed' || b.status === 'pending' || b.status === 'seated'))
        return (
            <ScheduleSection 
                bookings={filtered} 
                loading={loading} 
                onPrint={handlePrint}
                onViewSlip={setViewSlipUrl}
            />
        )
    }

    return (
        <PageTransition>
            <ConfirmationModal 
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.action}
                title={confirmModal.title}
                message={confirmModal.message}
                isDangerous={confirmModal.isDangerous}
            />
            
            <div className="pb-24">
                {/* Executive Header Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[oklch(85%_0.012_28)]">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(45%_0.08_140)] bg-[oklch(92%_0.012_140)] px-2 py-0.5 rounded-sm">
                                SYSTEM COCKPIT // 2026
                            </span>
                            <span className="font-mono text-[10px] text-[oklch(55%_0.010_28)]">
                                {getThaiDate()}
                            </span>
                        </div>
                        <h1 className="font-mono text-2xl md:text-3xl font-bold text-[oklch(18%_0.012_28)] tracking-tight mt-1">
                            EXECUTIVE OVERVIEW
                        </h1>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Audio Alert Toggle */}
                        <button
                            type="button"
                            onClick={() => setSoundMuted(!soundMuted)}
                            className={`p-2 rounded-sm border font-mono text-xs font-bold transition-colors flex items-center gap-1.5 ${
                                soundMuted 
                                    ? 'bg-[oklch(94%_0.010_28)] border-[oklch(85%_0.012_28)] text-[oklch(55%_0.010_28)]' 
                                    : 'bg-[oklch(92%_0.012_140)] border-[oklch(82%_0.08_140)] text-[oklch(35%_0.08_140)]'
                            }`}
                            title={soundMuted ? 'Alert Sound Muted' : 'Alert Sound Active'}
                        >
                            {soundMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                            <span className="hidden sm:inline">{soundMuted ? 'MUTED' : 'ALERT ON'}</span>
                        </button>

                        {/* Direct POS Link */}
                        <a
                            href="/pos"
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-2 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-mono text-xs font-bold uppercase rounded-sm flex items-center gap-1.5 transition-colors"
                        >
                            <span>OPEN POS</span>
                            <ArrowUpRight size={14} />
                        </a>

                        {/* Refresh */}
                        <button 
                            type="button"
                            onClick={fetchData} 
                            disabled={loading}
                            className="px-3.5 py-2 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(28%_0.012_28)] text-white font-mono text-xs font-bold uppercase rounded-sm flex items-center gap-1.5 transition-colors"
                        >
                            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            <span>REFRESH</span>
                        </button>
                    </div>
                </div>

                {/* 1. Live Pulse KPI Strip */}
                <LivePulseMetrics 
                    revenueToday={revenueToday}
                    completedOrdersCount={completedOrdersCount}
                    totalTables={floorOccupancy.totalTables}
                    occupiedTables={floorOccupancy.occupiedTables}
                    totalGuests={floorOccupancy.totalGuests}
                    pendingInboxCount={pendingBookings.length}
                    dineInCount={dineInCount}
                    pickupCount={pickupCount}
                    loading={loading}
                />

                {/* 2. Interactive Live Floor & 1-Tap Table Block */}
                <LiveFloorQuickStatus 
                    onOccupancyChange={setFloorOccupancy}
                />

                {/* 3. Segmented Filter Tabs */}
                <div className="flex gap-2 border-b border-[oklch(85%_0.012_28)] mb-6 font-mono text-xs">
                    {[
                        { key: 'overview', label: `ALL SCHEDULE (${scheduleBookings.length + pendingBookings.length})` },
                        { key: 'dine_in', label: 'DINE-IN ONLY' },
                        { key: 'pickup', label: 'PICKUP ONLY' }
                    ].map((tab) => {
                        const isActive = activeTab === tab.key
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`pb-2.5 px-3 font-bold uppercase tracking-wider transition-all border-b-2 -mb-[2px] ${
                                    isActive 
                                        ? 'border-[oklch(52%_0.16_28)] text-[oklch(18%_0.012_28)] bg-[oklch(95%_0.010_28)]' 
                                        : 'border-transparent text-[oklch(55%_0.010_28)] hover:text-black'
                                }`}
                            >
                                {tab.label}
                            </button>
                        )
                    })}
                </div>

                {/* 4. Tab Content: Priority Inbox & Schedule */}
                <div>
                    {getTabContent()}
                </div>
            </div>

            {/* Slip Modal */}
            {slipData && (
                <SlipModal
                    booking={slipData.booking}
                    type={slipData.type}
                    onClose={() => setSlipData(null)}
                />
            )}

            {/* View Slip Modal */}
            {viewSlipUrl && (
                <ViewSlipModal 
                    url={viewSlipUrl.startsWith('http') ? viewSlipUrl : supabase.storage.from('slips').getPublicUrl(viewSlipUrl).data.publicUrl} 
                    onClose={() => setViewSlipUrl(null)} 
                />
            )}
        </PageTransition>
    )
}
