/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from './lib/supabaseClient'
import { RotateCcw, ArrowUpRight, Volume2, VolumeX, ShieldCheck, Inbox, Calendar, Receipt, Layers, LayoutGrid, Clock, ShoppingBag, Utensils, FileText, Download } from 'lucide-react'
import PageTransition from './components/PageTransition'
import { getThaiDate } from './utils/timeUtils'
import { toast } from 'sonner'
import ConfirmationModal from './components/ConfirmationModal'
import { getBookingPaymentBreakdown } from './pos/POSReportsPanel'
import { playOrderAlert } from './utils/audioHelper'

// Components
import LivePulseMetrics from './components/admin/overview/LivePulseMetrics'
import LiveFloorQuickStatus from './components/admin/overview/LiveFloorQuickStatus'
import AllDailyBillsHub from './components/admin/overview/AllDailyBillsHub'
import OwnerPosBroadcastBar from './components/admin/overview/OwnerPosBroadcastBar'
import DailySummarySlipModal from './components/admin/overview/DailySummarySlipModal'
import InboxSection from './components/admin/InboxSection'
import ScheduleSection from './components/admin/ScheduleSection'
import SlipModal from './components/shared/SlipModal'
import ViewSlipModal from './components/shared/ViewSlipModal'
import TaxInvoiceModal from './components/admin/tax/TaxInvoiceModal'
import TaxInvoicePrintView from './components/admin/tax/TaxInvoicePrintView'

export default function AdminDashboard() {
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: null })
    const [bookings, setBookings] = useState([]) // Stores Pending (All) + Selected Date Bookings
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('bills') // bills, inbox, schedule, floor, dine_in, pickup
    const [selectedDate, setSelectedDate] = useState(getThaiDate())
    const [slipData, setSlipData] = useState(null) // { booking, type }
    const [viewSlipUrl, setViewSlipUrl] = useState(null)
    const [taxInvoiceBooking, setTaxInvoiceBooking] = useState(null)
    const [activePrintInvoice, setActivePrintInvoice] = useState(null)
    const [companySettings, setCompanySettings] = useState(() => {
        try {
            const stored = localStorage.getItem('onhaus_tax_settings');
            return stored ? JSON.parse(stored) : {};
        } catch {
            return {};
        }
    })
    const [floorOccupancy, setFloorOccupancy] = useState({ totalTables: 12, occupiedTables: 0, totalGuests: 0 })
    const [showDailySummaryModal, setShowDailySummaryModal] = useState(false)

    useEffect(() => {
        // Load company tax settings
        supabase
            .from('app_settings')
            .select('key, value')
            .or('key.like.tax_%,key.eq.receipt_shop_logo_url,key.eq.shop_logo_url')
            .not('key', 'eq', 'tax_signature_image')
            .then(({ data }) => {
                if (data && data.length > 0) {
                    const map = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
                    setCompanySettings(map);
                    localStorage.setItem('onhaus_tax_settings', JSON.stringify(map));
                }
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        fetchData()

        let debounceTimer = null
        const debouncedFetchData = () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
                fetchData()
            }, 300)
        }

        // Real-time: Refresh on any booking, order items, tables layout, or app settings change
        const subscription = supabase
            .channel('public:admin-dashboard')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, debouncedFetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, debouncedFetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tables_layout' }, debouncedFetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, debouncedFetchData)
            .on('broadcast', { event: '*' }, debouncedFetchData)
            .subscribe()

        // Instant local BroadcastChannel synchronization with POS terminals (< 10ms)
        const posSyncChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('onhaus_pos_sync') : null
        if (posSyncChannel) {
            posSyncChannel.onmessage = () => debouncedFetchData()
        }
        const handleCustomSync = () => debouncedFetchData()
        window.addEventListener('pos_sync_event', handleCustomSync)
        window.addEventListener('storage', (e) => {
            if (e.key === 'pos_last_order_sync') debouncedFetchData()
        })

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            supabase.removeChannel(subscription)
            if (posSyncChannel) posSyncChannel.close()
            window.removeEventListener('pos_sync_event', handleCustomSync)
        }
    }, [selectedDate])

    const fetchData = async () => {
        setLoading(true)
        try {
            // 1. Fetch ALL Pending (Inbox) across all dates
            const pendingReq = supabase
                .from('bookings')
                .select(`
                    *,
                    order_items (
                        quantity,
                        price_at_time,
                        selected_options,
                        menu_items ( name, price, category_id )
                    ),
                    profiles ( id, display_name, nickname, phone_number, current_tier ),
                    tables_layout ( table_name )
                `)
                .eq('status', 'pending')
                .order('booking_time', { ascending: true })

            // 2. Fetch ALL Selected Date's bookings (All statuses: completed, seated, confirmed, ready, void, cancelled)
            const dateReq = supabase
                .from('bookings')
                .select(`
                    *,
                    order_items (
                        quantity,
                        price_at_time,
                        selected_options,
                        menu_items ( name, price, category_id )
                    ),
                    profiles ( id, display_name, nickname, phone_number, current_tier ),
                    tables_layout ( table_name )
                `)
                .gte('booking_time', `${selectedDate}T00:00:00+07:00`)
                .lte('booking_time', `${selectedDate}T23:59:59+07:00`)
                .order('booking_time', { ascending: false })

            // 3. Fetch active seated/in-service tables across floor (so in-store tables are never lost)
            const seatedReq = supabase
                .from('bookings')
                .select(`
                    *,
                    order_items (
                        quantity,
                        price_at_time,
                        selected_options,
                        menu_items ( name, price, category_id )
                    ),
                    profiles ( id, display_name, nickname, phone_number, current_tier ),
                    tables_layout ( table_name )
                `)
                .in('status', ['seated', 'confirmed'])
                .order('booking_time', { ascending: false })

            const [pendingRes, dateRes, seatedRes] = await Promise.all([pendingReq, dateReq, seatedReq])

            if (pendingRes.error) throw pendingRes.error
            if (dateRes.error) throw dateRes.error

            // Merge and Deduplicate
            const map = new Map()
            ;(pendingRes.data || []).forEach(b => map.set(b.id, b))
            ;(dateRes.data || []).forEach(b => map.set(b.id, b))
            ;(seatedRes.data || []).forEach(b => map.set(b.id, b))

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
    // 1. All Daily Bookings (for the selected date, all statuses + active tables on floor)
    const dailyBookings = useMemo(() => {
        return bookings.filter(b => {
            if (b.status === 'seated' || b.status === 'confirmed') return true
            const bDate = new Date(b.booking_time || b.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
            return bDate === selectedDate
        }).sort((a, b) => {
            const getPriority = (st) => {
                if (st === 'seated') return 1
                if (st === 'pending') return 2
                if (st === 'confirmed') return 3
                if (st === 'completed' || st === 'paid' || st === 'success') return 4
                return 5
            }
            const pA = getPriority(a.status)
            const pB = getPriority(b.status)
            if (pA !== pB) return pA - pB
            return new Date(b.booking_time || b.created_at) - new Date(a.booking_time || a.created_at)
        })
    }, [bookings, selectedDate])

    // 2. Inbox: Pending (ALL dates)
    const pendingBookings = useMemo(() =>
        bookings.filter(b => b.status === 'pending').sort((a, b) => new Date(a.booking_time) - new Date(b.booking_time))
        , [bookings])

    // 3. Schedule: Confirmed / Seated / Ready for selected date
    const scheduleBookings = useMemo(() => {
        return bookings.filter(b => {
            const bDate = new Date(b.booking_time || b.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
            const isDateMatch = bDate === selectedDate
            const isConfirmed = b.status === 'confirmed' || b.status === 'seated' || b.status === 'ready' || b.status === 'paid'
            return isDateMatch && isConfirmed
        }).sort((a, b) => new Date(a.booking_time) - new Date(b.booking_time))
    }, [bookings, selectedDate])

    // 4. Live Financial Metrics & Payment Breakdown for the selected date
    const { revenueToday, completedOrdersCount, dineInCount, pickupCount, paymentBreakdown } = useMemo(() => {
        let rev = 0
        let paidCount = 0
        let dineIn = 0
        let pickup = 0
        let cash = 0
        let qr = 0
        let credit = 0

        dailyBookings.forEach(b => {
            const amount = Number(b.total_amount || b.total_price || 0)
            const isRevenueStatus = b.status === 'confirmed' || b.status === 'completed' || b.status === 'paid' || b.status === 'seated' || b.status === 'success'

            if (isRevenueStatus) {
                rev += amount
                if (b.status === 'completed' || b.status === 'paid' || b.status === 'success') {
                    paidCount++
                }

                if (b.booking_type === 'dine_in' || b.booking_type === 'walk_in') {
                    dineIn++
                } else if (b.booking_type === 'pickup') {
                    pickup++
                }

                // Payment breakdown
                const breakdown = getBookingPaymentBreakdown(b)
                cash += breakdown.cash
                qr += breakdown.qr
                credit += breakdown.credit
            }
        })

        return {
            revenueToday: rev,
            completedOrdersCount: paidCount,
            dineInCount: dineIn,
            pickupCount: pickup,
            paymentBreakdown: { cash, qr, credit }
        }
    }, [dailyBookings])

    // --- Sound Alert Logic (noti1.mp3 High-Gain Engine) ---
    const [soundMuted, setSoundMuted] = useState(false)
    const alertIntervalRef = useRef(null)

    useEffect(() => {
        if (!soundMuted && pendingBookings.length > 0) {
            playOrderAlert('admin_pending_orders', 800, 3.2)
            if (!alertIntervalRef.current) {
                alertIntervalRef.current = setInterval(() => {
                    playOrderAlert('admin_pending_orders', 1000, 3.2)
                }, 12000)
            }
        } else {
            if (alertIntervalRef.current) {
                clearInterval(alertIntervalRef.current)
                alertIntervalRef.current = null
            }
        }
        return () => {
            if (alertIntervalRef.current) {
                clearInterval(alertIntervalRef.current)
                alertIntervalRef.current = null
            }
        }
    }, [pendingBookings.length, soundMuted])

    const handlePrint = (booking, type) => {
        setSlipData({ booking, type })
    }

    const getYesterdayDate = () => {
        const d = new Date()
        d.setDate(d.getDate() - 1)
        return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
    }

    const getTabContent = () => {
        if (activeTab === 'bills') {
            return (
                <AllDailyBillsHub
                    bookings={dailyBookings}
                    loading={loading}
                    onPrintSlip={handlePrint}
                    onViewSlip={setViewSlipUrl}
                    onOpenTaxInvoice={setTaxInvoiceBooking}
                    onUpdateStatus={updateStatus}
                    selectedDate={selectedDate}
                />
            )
        }

        if (activeTab === 'inbox') {
            return (
                <InboxSection 
                    bookings={pendingBookings} 
                    onUpdateStatus={updateStatus}
                    onViewSlip={setViewSlipUrl}
                />
            )
        }

        if (activeTab === 'schedule') {
            return (
                <ScheduleSection 
                    bookings={scheduleBookings} 
                    loading={loading} 
                    onPrint={handlePrint}
                    onViewSlip={setViewSlipUrl}
                />
            )
        }

        if (activeTab === 'floor') {
            return (
                <div className="space-y-6">
                    <LiveFloorQuickStatus onOccupancyChange={setFloorOccupancy} />
                </div>
            )
        }

        if (activeTab === 'dine_in') {
            const filtered = dailyBookings.filter(b => b.booking_type === 'dine_in' || b.booking_type === 'walk_in')
            return (
                <AllDailyBillsHub
                    bookings={filtered}
                    loading={loading}
                    onPrintSlip={handlePrint}
                    onViewSlip={setViewSlipUrl}
                    onOpenTaxInvoice={setTaxInvoiceBooking}
                    onUpdateStatus={updateStatus}
                    selectedDate={selectedDate}
                />
            )
        }

        if (activeTab === 'pickup') {
            const filtered = dailyBookings.filter(b => b.booking_type === 'pickup' || (b.booking_type || '').includes('takeaway'))
            return (
                <AllDailyBillsHub
                    bookings={filtered}
                    loading={loading}
                    onPrintSlip={handlePrint}
                    onViewSlip={setViewSlipUrl}
                    onOpenTaxInvoice={setTaxInvoiceBooking}
                    onUpdateStatus={updateStatus}
                    selectedDate={selectedDate}
                />
            )
        }

        return null
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
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(45%_0.08_140)] bg-[oklch(92%_0.012_140)] px-2 py-0.5 rounded-sm">
                                SYSTEM COCKPIT // 2026
                            </span>
                            <span className="font-mono text-[10px] text-[oklch(55%_0.010_28)]">
                                BACKOFFICE OVERVIEW
                            </span>
                        </div>
                        <h1 className="font-mono text-2xl md:text-3xl font-bold text-[oklch(18%_0.012_28)] tracking-tight mt-1">
                            EXECUTIVE OVERVIEW
                        </h1>
                    </div>

                    {/* Date Picker & Controls Ribbon */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Quick Date Switcher */}
                        <div className="flex items-center gap-1 bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-1 font-mono text-xs font-bold">
                            <Calendar size={14} className="text-[oklch(52%_0.16_28)] ml-1" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent border-none text-[oklch(18%_0.012_28)] font-mono text-xs font-bold focus:outline-none cursor-pointer"
                            />
                            <button
                                onClick={() => setSelectedDate(getThaiDate())}
                                className={`px-2 py-0.5 rounded-sm text-[10px] ${selectedDate === getThaiDate() ? 'bg-[oklch(18%_0.012_28)] text-white' : 'hover:bg-gray-100'}`}
                            >
                                วันนี้
                            </button>
                            <button
                                onClick={() => setSelectedDate(getYesterdayDate())}
                                className={`px-2 py-0.5 rounded-sm text-[10px] ${selectedDate === getYesterdayDate() ? 'bg-[oklch(18%_0.012_28)] text-white' : 'hover:bg-gray-100'}`}
                            >
                                เมื่อวาน
                            </button>
                        </div>

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

                        {/* Export Daily Summary PNG Slip */}
                        <button 
                            type="button"
                            onClick={() => setShowDailySummaryModal(true)}
                            className="px-3.5 py-2 bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white font-mono text-xs font-bold uppercase rounded-sm flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                            title="Export สลิปสรุปยอดปิดวัน (Daily Z-Report Slip) เป็นไฟล์ภาพ PNG"
                        >
                            <FileText size={14} />
                            <span>EXPORT สลิปปิดวัน (PNG)</span>
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

                {/* 1. Live Pulse KPI Strip & Payment Breakdown */}
                <LivePulseMetrics 
                    revenueToday={revenueToday}
                    completedOrdersCount={completedOrdersCount}
                    totalTables={floorOccupancy.totalTables}
                    occupiedTables={floorOccupancy.occupiedTables}
                    totalGuests={floorOccupancy.totalGuests}
                    pendingInboxCount={pendingBookings.length}
                    dineInCount={dineInCount}
                    pickupCount={pickupCount}
                    paymentBreakdown={paymentBreakdown}
                    loading={loading}
                />

                {/* 2. Owner Direct Broadcast to POS Screen */}
                <div className="mb-6">
                    <OwnerPosBroadcastBar />
                </div>

                {/* 3. Interactive Live Floor & 1-Tap Table Block (Shown always for quick overview) */}
                <LiveFloorQuickStatus 
                    onOccupancyChange={setFloorOccupancy}
                />

                {/* 4. Segmented Filter Tabs (Tabular Brutalist Division) */}
                <div className="flex gap-1 overflow-x-auto border-b border-[oklch(85%_0.012_28)] mb-6 font-mono text-xs no-scrollbar">
                    {[
                        { key: 'bills', label: 'ALL BILLS', count: dailyBookings.length, icon: Receipt },
                        { key: 'inbox', label: 'INBOX', count: pendingBookings.length, icon: Inbox },
                        { key: 'schedule', label: 'SCHEDULE', count: scheduleBookings.length, icon: Clock },
                        { key: 'dine_in', label: 'DINE-IN', count: dineInCount, icon: Utensils },
                        { key: 'pickup', label: 'PICKUP', count: pickupCount, icon: ShoppingBag }
                    ].map((tab) => {
                        const isActive = activeTab === tab.key
                        const Icon = tab.icon
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`pb-2.5 px-3.5 font-bold uppercase tracking-wider transition-all border-b-2 -mb-[1px] flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                                    isActive 
                                        ? 'border-[oklch(52%_0.16_28)] text-[oklch(18%_0.012_28)] bg-[oklch(95%_0.010_28)]' 
                                        : 'border-transparent text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                                }`}
                            >
                                <Icon size={14} className={isActive ? 'text-[oklch(52%_0.16_28)]' : 'text-[oklch(55%_0.010_28)]'} />
                                <span>{tab.label}</span>
                                <span className={`px-1.5 py-0.2 rounded-xs text-[10px] tabular-nums font-mono ${
                                    isActive ? 'bg-[oklch(18%_0.012_28)] text-white' : 'bg-[oklch(90%_0.010_28)] text-[oklch(42%_0.010_28)]'
                                }`}>
                                    {tab.count}
                                </span>
                            </button>
                        )
                    })}
                </div>

                {/* 5. Tab Content: Master Bills Hub / Inbox / Schedule */}
                <div>
                    {getTabContent()}
                </div>
            </div>

            {/* Daily Summary PNG Slip Modal */}
            {showDailySummaryModal && (
                <DailySummarySlipModal
                    bookings={dailyBookings}
                    selectedDate={selectedDate}
                    onClose={() => setShowDailySummaryModal(false)}
                />
            )}

            {/* Slip Modal (Admin Digital Bill & Receipt) */}
            {slipData && (
                <SlipModal
                    booking={slipData.booking}
                    type={slipData.type}
                    isAdmin={true}
                    onClose={() => setSlipData(null)}
                />
            )}

            {/* View Slip Modal */}
            {viewSlipUrl && (
                <ViewSlipModal 
                    slipUrl={viewSlipUrl}
                    onClose={() => setViewSlipUrl(null)} 
                />
            )}

            {/* Tax Invoice Full Modal */}
            {taxInvoiceBooking && (
                <TaxInvoiceModal
                    booking={taxInvoiceBooking}
                    companySettings={companySettings}
                    onClose={() => setTaxInvoiceBooking(null)}
                    onSaveSuccess={(savedInvoice, printImmediately) => {
                        setTaxInvoiceBooking(null);
                        fetchData();
                        if (printImmediately) {
                            setActivePrintInvoice(savedInvoice);
                        }
                    }}
                />
            )}

            {/* A4 Official Printable Tax Invoice / Receipt View */}
            {activePrintInvoice && (
                <TaxInvoicePrintView
                    invoice={activePrintInvoice}
                    companySettings={companySettings}
                    onClose={() => setActivePrintInvoice(null)}
                />
            )}
        </PageTransition>
    )
}
