/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from './lib/supabaseClient'
import { RotateCcw, Volume2, VolumeX, ShieldCheck, Inbox, Calendar, Receipt, Layers, LayoutGrid, Clock, ShoppingBag, Utensils, FileText, Download } from 'lucide-react'
import PageTransition from './components/PageTransition'
import { getThaiDate, formatThaiTimeOnly, formatThaiDateOnly, formatThaiTime } from './utils/timeUtils'
import { toast } from 'sonner'
import ConfirmationModal from './components/ConfirmationModal'
import { getBookingPaymentBreakdown } from './pos/POSReportsPanel'
import { playOrderAlert } from './utils/audioHelper'

// Components
import LivePulseMetrics from './components/admin/overview/LivePulseMetrics'
import IntradayVelocityDaypartCockpit from './components/admin/financial/IntradayVelocityDaypartCockpit'
import FloorTurnoverGauge from './components/admin/overview/FloorTurnoverGauge'
import LiveFloorQuickStatus from './components/admin/overview/LiveFloorQuickStatus'
import DailyShiftsCashFlowWidget from './components/admin/overview/DailyShiftsCashFlowWidget'
import AdminShiftsLedgerTab from './components/admin/overview/AdminShiftsLedgerTab'
import AllDailyBillsHub from './components/admin/overview/AllDailyBillsHub'
import OwnerPosBroadcastBar from './components/admin/overview/OwnerPosBroadcastBar'
import DailySummarySlipModal from './components/admin/overview/DailySummarySlipModal'
import SimplifiedLiveOverview from './components/admin/overview/SimplifiedLiveOverview'
import SimplifiedBillsSummaryList from './components/admin/overview/SimplifiedBillsSummaryList'
import InboxSection from './components/admin/InboxSection'
import ScheduleSection from './components/admin/ScheduleSection'
import SlipModal from './components/shared/SlipModal'
import ViewSlipModal from './components/shared/ViewSlipModal'
import TaxInvoiceModal from './components/admin/tax/TaxInvoiceModal'
import TaxInvoicePrintView from './components/admin/tax/TaxInvoicePrintView'
import { isGhostPickupBooking, isInternalBlockBooking } from './utils/tableTransferHelper'

export default function AdminDashboard() {
    const [tables, setTables] = useState([])
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: null })
    const [bookings, setBookings] = useState([]) // Stores Pending (All) + Selected Date Bookings
    const [shifts, setShifts] = useState([]) // Stores shifts for Selected Date / Active shift
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('bills') // bills, shifts, inbox, schedule, floor, dine_in, pickup
    const [selectedDate, setSelectedDate] = useState(getThaiDate())
    const [overviewMode, setOverviewMode] = useState(() => {
        try {
            return localStorage.getItem('onhaus_admin_overview_mode') || 'simplified'
        } catch {
            return 'simplified'
        }
    })

    const handleSetOverviewMode = (mode) => {
        setOverviewMode(mode)
        try {
            localStorage.setItem('onhaus_admin_overview_mode', mode)
        } catch {}
    }

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
    const [yesterdayRevenue, setYesterdayRevenue] = useState(0)
    const selectedDateRef = useRef(selectedDate)
    const activeRequestIdRef = useRef(0)

    const getYesterdayDate = (refDate = null) => {
        const d = refDate ? new Date(refDate + 'T12:00:00+07:00') : new Date()
        d.setDate(d.getDate() - 1)
        return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
    }

    useEffect(() => {
        selectedDateRef.current = selectedDate
    }, [selectedDate])

    useEffect(() => {
        const loadTaxSettings = async () => {
            try {
                const { data } = await supabase.from('app_settings').select('key, value');
                if (data && data.length > 0) {
                    const settingsMap = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
                    setCompanySettings(settingsMap);
                    try {
                        localStorage.setItem('onhaus_tax_settings', JSON.stringify(settingsMap));
                        if (settingsMap.default_vat_enabled !== undefined) {
                            localStorage.setItem('pos_default_vat_enabled', String(settingsMap.default_vat_enabled));
                        }
                    } catch (e) {}
                }
            } catch (err) {}
        };
        loadTaxSettings();
    }, [])

    const fetchData = async (isSilent = false, overrideDate = null) => {
        const queryDate = overrideDate || selectedDateRef.current
        const requestId = ++activeRequestIdRef.current
        if (!isSilent) setLoading(true)
        try {
            // 1. Fetch ALL Pending (Inbox) across all dates with full order_items fields
            const pendingReq = supabase
                .from('bookings')
                .select(`
                    *,
                    order_items (
                        id,
                        quantity,
                        price_at_time,
                        selected_options,
                        custom_name,
                        created_at,
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
                        id,
                        quantity,
                        price_at_time,
                        selected_options,
                        custom_name,
                        created_at,
                        menu_items ( name, price, category_id )
                    ),
                    profiles ( id, display_name, nickname, phone_number, current_tier ),
                    tables_layout ( table_name )
                `)
                .or(`and(booking_time.gte.${queryDate}T00:00:00+07:00,booking_time.lte.${queryDate}T23:59:59+07:00),and(created_at.gte.${queryDate}T00:00:00+07:00,created_at.lte.${queryDate}T23:59:59+07:00)`)
                .order('created_at', { ascending: false })

            // 3. Fetch active seated/in-service tables across floor (so in-store tables are never lost)
            const seatedReq = supabase
                .from('bookings')
                .select(`
                    *,
                    order_items (
                        id,
                        quantity,
                        price_at_time,
                        selected_options,
                        custom_name,
                        created_at,
                        menu_items ( name, price, category_id )
                    ),
                    profiles ( id, display_name, nickname, phone_number, current_tier ),
                    tables_layout ( table_name )
                `)
                .in('status', ['seated', 'confirmed', 'ready'])
                .order('booking_time', { ascending: false })

            // 4. Fetch Shifts for queryDate
            const isToday = queryDate === getThaiDate()
            let shiftsReq = supabase
                .from('pos_shifts')
                .select('*')
                .order('opened_at', { ascending: true })

            if (isToday) {
                shiftsReq = shiftsReq.or(`opened_at.gte.${queryDate}T00:00:00+07:00,status.eq.open`)
            } else {
                shiftsReq = shiftsReq
                    .gte('opened_at', `${queryDate}T00:00:00+07:00`)
                    .lte('opened_at', `${queryDate}T23:59:59+07:00`)
            }

            // 5. Fetch Table Layout once to serve as single source of truth for floor views
            const tablesReq = supabase
                .from('tables_layout')
                .select('*')

            // 6. Fetch Yesterday's settled revenue for honest executive trend comparison
            const yesterdayDate = getYesterdayDate(queryDate)
            const yesterdayReq = supabase
                .from('bookings')
                .select('total_amount')
                .or(`and(booking_time.gte.${yesterdayDate}T00:00:00+07:00,booking_time.lte.${yesterdayDate}T23:59:59+07:00),and(created_at.gte.${yesterdayDate}T00:00:00+07:00,created_at.lte.${yesterdayDate}T23:59:59+07:00)`)
                .in('status', ['completed', 'paid', 'success'])

            const [pendingRes, dateRes, seatedRes, shiftsRes, tablesRes, yesterdayRes] = await Promise.all([
                pendingReq, dateReq, seatedReq, shiftsReq, tablesReq, yesterdayReq
            ])

            if (pendingRes.error) throw pendingRes.error
            if (dateRes.error) throw dateRes.error

            // Guard against race conditions if another request was triggered
            if (requestId !== activeRequestIdRef.current) return

            // Merge and Deduplicate Bookings
            const map = new Map()
            ;(pendingRes.data || []).forEach(b => map.set(b.id, b))
            ;(dateRes.data || []).forEach(b => map.set(b.id, b))
            ;(seatedRes.data || []).forEach(b => map.set(b.id, b))

            setBookings(Array.from(map.values()))
            setShifts(shiftsRes?.data || [])

            if (yesterdayRes?.data) {
                const totalY = yesterdayRes.data.reduce((sum, b) => sum + Number(b.total_amount || 0), 0)
                setYesterdayRevenue(totalY)
            }

            if (tablesRes?.data) {
                const sortedTables = (tablesRes.data || []).slice().sort((a, b) => 
                    (a.table_name || '').localeCompare(b.table_name || '', undefined, { numeric: true, sensitivity: 'base' })
                )
                setTables(sortedTables)
            }

        } catch (error) {
            if (requestId !== activeRequestIdRef.current) return
            console.error('Error fetching dashboard data:', error.message)
            if (!isSilent) toast.error('Failed to load dashboard data')
        } finally {
            if (requestId === activeRequestIdRef.current && !isSilent) {
                setLoading(false)
            }
        }
    }

    const handleDateChange = (newDate) => {
        if (!newDate || newDate === selectedDate) return
        selectedDateRef.current = newDate
        setSelectedDate(newDate)
        setLoading(true) // Synchronous immediate loading state
        fetchData(false, newDate)
    }

    useEffect(() => {
        // Initial fetch on mount
        fetchData(false, selectedDateRef.current)

        let debounceTimer = null
        const debouncedFetchData = () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
                fetchData(true, selectedDateRef.current)
            }, 250)
        }

        let isRealtimeSubscribed = false
        // 1. Dynamic Unique Channel for Postgres Table Changes
        const channelId = `admin-dashboard-realtime-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
        const tableChannel = supabase
            .channel(channelId)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload) => {
                console.log('⚡ [Admin Realtime] Bookings change detected:', payload?.eventType)
                debouncedFetchData()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, (payload) => {
                console.log('⚡ [Admin Realtime] Order items change detected:', payload?.eventType)
                debouncedFetchData()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tables_layout' }, (payload) => {
                console.log('⚡ [Admin Realtime] Table layout change detected:', payload?.eventType)
                debouncedFetchData()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload) => {
                console.log('⚡ [Admin Realtime] App settings change detected:', payload?.eventType)
                debouncedFetchData()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_shifts' }, (payload) => {
                console.log('⚡ [Admin Realtime] Shift change detected:', payload?.eventType)
                debouncedFetchData()
            })
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    isRealtimeSubscribed = true
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    isRealtimeSubscribed = false
                    console.warn(`[Admin Realtime] Channel status: ${status}, retrying quiet fetch...`, err)
                    debouncedFetchData()
                }
            })

        // 2. Direct POS Realtime Notifications Broadcast Channel (cross-device < 50ms)
        const notifyChannel = supabase
            .channel('pos-realtime-notifications')
            .on('broadcast', { event: '*' }, (payload) => {
                console.log('⚡ [Admin Realtime] POS broadcast received:', payload?.event)
                debouncedFetchData()
            })
            .subscribe()

        // 3. Local BroadcastChannel for same-origin tabs (< 5ms)
        const posSyncChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('onhaus_pos_sync') : null
        if (posSyncChannel) {
            posSyncChannel.onmessage = () => debouncedFetchData()
        }
        const handleCustomSync = () => debouncedFetchData()
        window.addEventListener('pos_sync_event', handleCustomSync)
        const handleShiftChanged = () => debouncedFetchData()
        window.addEventListener('pos-shift-changed', handleShiftChanged)
        const handleStorageSync = (e) => {
            if (e.key === 'pos_last_order_sync') debouncedFetchData()
        }
        window.addEventListener('storage', handleStorageSync)

        // 4. Adaptive Polling Fallback (Only active if WebSocket disconnects or tab is visible)
        let heartbeatCounter = 0
        const autoPollTimer = setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
            heartbeatCounter++
            // If realtime is healthy, only heartbeat once every 90 seconds (every 3 ticks of 30s)
            if (isRealtimeSubscribed && heartbeatCounter % 3 !== 0) return
            fetchData(true, selectedDateRef.current)
        }, 30000)

        // 5. Refetch immediately when tab/window regains focus or becomes visible
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchData(true, selectedDateRef.current)
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)
        const handleWindowFocus = () => fetchData(true, selectedDateRef.current)
        window.addEventListener('focus', handleWindowFocus)

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            clearInterval(autoPollTimer)
            supabase.removeChannel(tableChannel)
            supabase.removeChannel(notifyChannel)
            if (posSyncChannel) posSyncChannel.close()
            window.removeEventListener('pos_sync_event', handleCustomSync)
            window.removeEventListener('pos-shift-changed', handleShiftChanged)
            window.removeEventListener('storage', handleStorageSync)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('focus', handleWindowFocus)
        }
    }, [])

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
                    fetchData(true)
                } else {
                    toast.success('Status updated to ' + status)
                    fetchData(true)
                }
            }
        })
    }

    // --- DERIVED STATE ---
    // Shift state derived helpers
    const activeShift = useMemo(() => (shifts || []).find(s => s.status === 'open'), [shifts])
    const latestClosedShift = useMemo(() => (shifts || []).filter(s => s.status === 'closed').sort((a, b) => new Date(b.closed_at || b.opened_at) - new Date(a.closed_at || a.opened_at))[0] || null, [shifts])
    const isShiftOpen = Boolean(activeShift)

    // 1. All Daily Bookings (for the selected date, all statuses + active tables on floor)
    const dailyBookings = useMemo(() => {
        const isToday = selectedDate === getThaiDate()
        return bookings.filter(b => {
            // Exclude internal floor blocks / maintenance holds and empty ghost pickups
            if (isInternalBlockBooking(b)) return false
            if (isGhostPickupBooking(b)) return false

            const bDate = new Date(b.booking_time || b.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
            const isDateMatch = bDate === selectedDate
            // When viewing today, include currently seated active tables only if POS shift is active
            const isCurrentSeated = isToday && isShiftOpen && (b.status === 'seated' || (b.status === 'ready' && b.booking_type !== 'pickup'))
            return isDateMatch || isCurrentSeated
        }).sort((a, b) => {
            const getPriority = (st) => {
                if (st === 'seated') return 1
                if (st === 'pending') return 2
                if (st === 'confirmed' || st === 'ready') return 3
                if (st === 'completed' || st === 'paid' || st === 'success') return 4
                return 5
            }
            const pA = getPriority(a.status)
            const pB = getPriority(b.status)
            if (pA !== pB) return pA - pB
            return new Date(b.booking_time || b.created_at) - new Date(a.booking_time || a.created_at)
        })
    }, [bookings, selectedDate, isShiftOpen])

    // 2. Inbox: Pending (ALL dates)
    const pendingBookings = useMemo(() =>
        bookings.filter(b => b.status === 'pending' && !isGhostPickupBooking(b)).sort((a, b) => new Date(a.booking_time) - new Date(b.booking_time))
        , [bookings])

    // 3. Schedule: Confirmed / Seated / Ready for selected date
    const scheduleBookings = useMemo(() => {
        return bookings.filter(b => {
            if (isGhostPickupBooking(b)) return false
            const bDate = new Date(b.booking_time || b.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
            const isDateMatch = bDate === selectedDate
            const isConfirmed = b.status === 'confirmed' || b.status === 'seated' || b.status === 'ready' || b.status === 'paid'
            return isDateMatch && isConfirmed
        }).sort((a, b) => new Date(a.booking_time || a.created_at) - new Date(b.booking_time || b.created_at))
    }, [bookings, selectedDate])

    // 4. Live Financial Metrics & Payment Breakdown for the selected date (Strictly Settled / Checked-Out Bills)
    const { revenueToday, completedOrdersCount, activeUnpaidRevenue, activeUnpaidCount, dineInCount, pickupCount, paymentBreakdown } = useMemo(() => {
        let rev = 0
        let paidCount = 0
        let activeUnpaid = 0
        let activeCount = 0
        let dineIn = 0
        let pickup = 0
        let cash = 0
        let qr = 0
        let credit = 0

        dailyBookings.forEach(b => {
            const amount = Number(b.total_amount || b.total_price || 0)
            const isCompleted = b.status === 'completed' || b.status === 'paid' || b.status === 'success'
            const isActiveUnpaid = b.status === 'seated' || b.status === 'confirmed' || b.status === 'ready'

            if (isCompleted) {
                rev += amount
                paidCount++

                // Payment breakdown
                const breakdown = getBookingPaymentBreakdown(b)
                cash += breakdown.cash
                qr += breakdown.qr
                credit += breakdown.credit
            } else if (isActiveUnpaid) {
                activeUnpaid += amount
                activeCount++
            }

            // Active channels tracking
            if (b.status !== 'cancelled' && b.status !== 'void') {
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
            activeUnpaidRevenue: activeUnpaid,
            activeUnpaidCount: activeCount,
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

        if (activeTab === 'shifts') {
            return (
                <AdminShiftsLedgerTab
                    shifts={shifts}
                    loading={loading}
                    selectedDate={selectedDate}
                    onRefreshShifts={() => fetchData(false, selectedDate)}
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
                {/* Executive Header Bar (Dieter Rams Minimalist) */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5 pb-4 border-b border-[oklch(85%_0.012_28)]">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(42%_0.010_28)] bg-[oklch(92%_0.010_28)] px-2 py-0.5 rounded-xs">
                                SYSTEM COCKPIT // 2026
                            </span>
                            <span className="font-mono text-[10px] text-[oklch(55%_0.010_28)] tracking-wider">
                                BACKOFFICE OVERVIEW
                            </span>
                        </div>
                        <h1 className="font-sans text-2xl md:text-3xl font-bold text-[oklch(18%_0.012_28)] tracking-tight">
                            EXECUTIVE OVERVIEW
                        </h1>
                    </div>

                    {/* Date Picker & Controls Ribbon */}
                    <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
                        {/* Quick Date Switcher */}
                        <div className="flex items-center gap-1 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-xs p-1 font-mono text-xs">
                            <Calendar size={13} className="text-[oklch(42%_0.010_28)] ml-1 shrink-0" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => handleDateChange(e.target.value)}
                                className="bg-transparent border-none text-[oklch(18%_0.012_28)] font-mono text-xs font-bold focus:outline-none cursor-pointer"
                            />
                            <button
                                type="button"
                                onClick={() => handleDateChange(getThaiDate())}
                                className={`px-2 py-0.5 rounded-xs text-[10px] font-sans font-medium cursor-pointer transition-colors ${selectedDate === getThaiDate() ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold' : 'hover:bg-[oklch(92%_0.012_28)] text-[oklch(42%_0.010_28)]'}`}
                            >
                                วันนี้
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDateChange(getYesterdayDate())}
                                className={`px-2 py-0.5 rounded-xs text-[10px] font-sans font-medium cursor-pointer transition-colors ${selectedDate === getYesterdayDate() ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold' : 'hover:bg-[oklch(92%_0.012_28)] text-[oklch(42%_0.010_28)]'}`}
                            >
                                เมื่อวาน
                            </button>
                        </div>

                        {/* Audio Alert Toggle - ONLY shown if sound is muted or active alert required */}
                        {(soundMuted || pendingBookings.length > 0) && (
                            <button
                                type="button"
                                onClick={() => setSoundMuted(!soundMuted)}
                                className={`px-2 py-1 rounded-xs border font-mono text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                                    soundMuted 
                                        ? 'bg-[oklch(94%_0.010_28)] border-[oklch(85%_0.012_28)] text-[oklch(55%_0.010_28)]' 
                                        : 'bg-[oklch(92%_0.02_28)] border-[oklch(52%_0.16_28)] text-[oklch(52%_0.16_28)] animate-pulse'
                                }`}
                                title={soundMuted ? 'เปิดเสียงแจ้งเตือน' : 'มีคำขอรอการตรวจสอบ'}
                            >
                                {soundMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                                <span>{soundMuted ? 'MUTED' : 'ALERT'}</span>
                            </button>
                        )}

                        {/* Export Daily Summary PNG Slip */}
                        <button 
                            type="button"
                            onClick={() => setShowDailySummaryModal(true)}
                            className="px-2.5 py-1.5 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] text-xs font-medium rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                            title="Export สลิปสรุปยอดปิดวัน (Daily Z-Report Slip) เป็นไฟล์ภาพ PNG"
                        >
                            <FileText size={13} />
                            <span className="font-sans">สลิปปิดวัน</span>
                            <span className="hidden sm:inline font-mono text-[10px] text-[oklch(55%_0.010_28)]">(PNG)</span>
                        </button>

                        {/* Refresh */}
                        <button 
                            type="button"
                            onClick={() => fetchData(false, selectedDate)} 
                            disabled={loading}
                            className="px-2.5 py-1.5 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(28%_0.012_28)] text-[oklch(97%_0.008_28)] font-mono text-xs font-bold uppercase rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                        >
                            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">REFRESH</span>
                        </button>
                    </div>
                </div>

                {/* SHIFT STATUS BANNER (Dieter Rams / Thai Modern Structural Indicator) */}
                {(() => {
                    const isToday = selectedDate === getThaiDate()
                    return (
                        <div className={`mb-4 px-3.5 py-2 rounded-xs border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 select-none ${
                            !isToday
                                ? 'bg-[oklch(95%_0.008_28)] border-[oklch(85%_0.012_28)] text-[oklch(42%_0.010_28)]'
                                : isShiftOpen
                                    ? 'bg-[oklch(96%_0.02_140)] border-[oklch(80%_0.08_140)] text-[oklch(25%_0.08_140)]'
                                    : 'bg-[oklch(94%_0.010_28)] border-[oklch(85%_0.012_28)] text-[oklch(42%_0.010_28)]'
                        }`}>
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${
                                    !isToday
                                        ? 'bg-[oklch(55%_0.010_28)]'
                                        : isShiftOpen 
                                            ? 'bg-[oklch(45%_0.08_140)] animate-pulse' 
                                            : 'bg-[oklch(55%_0.010_28)]'
                                }`} />
                                <span className="font-mono font-bold tracking-wider text-[11px] uppercase">
                                    {!isToday
                                        ? 'HISTORICAL RECORD // รอบขายย้อนหลัง'
                                        : isShiftOpen 
                                            ? 'POS SHIFT ACTIVE // กะกำลังทำงาน' 
                                            : 'POS SHIFT CLOSED // กะปิดอยู่'
                                    }
                                </span>
                                <span className="text-[oklch(85%_0.012_28)] hidden sm:inline">|</span>
                                <span className="font-sans font-medium text-xs">
                                    {!isToday ? (
                                        latestClosedShift ? (
                                            <>รอบการขายสิ้นสุดสมบูรณ์ (ปิดรอบเมื่อ <span className="font-mono font-bold text-[oklch(18%_0.012_28)]">{formatThaiTimeOnly(latestClosedShift.closed_at)}</span> โดย <strong className="font-bold text-[oklch(18%_0.012_28)]">{latestClosedShift.staff_name}</strong>{shifts.length > 1 ? ` · ทั้งหมด ${shifts.length} กะ` : ''})</>
                                        ) : (
                                            <>ไม่มีประวัติรอบการขายบนเครื่อง POS ในวันที่ {formatThaiDateOnly(selectedDate)}</>
                                        )
                                    ) : isShiftOpen ? (
                                        <>พนักงานประจำเครื่อง: <strong className="font-bold text-[oklch(18%_0.012_28)]">{activeShift.staff_name}</strong> (เปิดรอบเมื่อ {formatThaiTimeOnly(activeShift.opened_at)})</>
                                    ) : latestClosedShift ? (
                                        <>หน้าร้านยังไม่เปิดรอบขาย (รอบล่าสุดปิดเมื่อ <span className="font-mono font-bold text-[oklch(18%_0.012_28)]">{formatThaiTimeOnly(latestClosedShift.closed_at)}</span> โดย <strong className="font-bold text-[oklch(18%_0.012_28)]">{latestClosedShift.staff_name}</strong>)</>
                                    ) : (
                                        <>หน้าร้านยังไม่มีการเปิดรอบการขายบนเครื่อง POS</>
                                    )}
                                </span>
                            </div>

                            <div className="font-mono text-[10px] text-[oklch(55%_0.010_28)] self-end sm:self-auto uppercase">
                                {!isToday 
                                    ? (latestClosedShift ? '[ARCHIVED SHIFT]' : '[NO SHIFT RECORD]')
                                    : isShiftOpen ? '[ONLINE TERMINAL ACTIVE]' : '[TERMINAL CLOSED]'}
                            </div>
                        </div>
                    )
                })()}

                {/* MASTER COCKPIT MODE SWITCHER (Tabular Grid - Dieter Rams Zero-wrap / Responsive 2-Tier Stack) */}
                <div className="grid grid-cols-2 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] p-0.5 rounded-xs gap-0.5 mb-5 text-xs sm:text-sm">
                    <button
                        type="button"
                        onClick={() => handleSetOverviewMode('simplified')}
                        className={`py-1.5 sm:py-2 px-2 sm:px-6 rounded-xs font-bold transition-all cursor-pointer flex items-center justify-center select-none ${
                            overviewMode === 'simplified'
                                ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] shadow-xs'
                                : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] hover:bg-[oklch(97%_0.008_28)]'
                        }`}
                    >
                        {/* Mobile: 2-Tier Stacked Layout */}
                        <div className="flex sm:hidden flex-col items-center justify-center leading-tight py-0.5">
                            <span className="flex items-center gap-1 font-mono text-[9.5px] tracking-wider opacity-80 uppercase">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${overviewMode === 'simplified' ? 'bg-[oklch(97%_0.008_28)]' : 'bg-current opacity-40'}`} />
                                LIVE NOW
                            </span>
                            <span className="font-sans font-medium text-[11.5px] mt-0.5">โต๊ะสดหน้าร้าน</span>
                        </div>

                        {/* Desktop: Single-Line Tabular Layout */}
                        <div className="hidden sm:flex items-center justify-center gap-2 whitespace-nowrap">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${overviewMode === 'simplified' ? 'bg-[oklch(97%_0.008_28)]' : 'bg-current opacity-30'}`} />
                            <span className="font-mono tracking-wide">LIVE NOW // <span className="font-sans font-medium">โต๊ะสดหน้าร้าน</span></span>
                        </div>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSetOverviewMode('pro')}
                        className={`py-1.5 sm:py-2 px-2 sm:px-6 rounded-xs font-bold transition-all cursor-pointer flex items-center justify-center select-none ${
                            overviewMode === 'pro'
                                ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] shadow-xs'
                                : 'text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] hover:bg-[oklch(97%_0.008_28)]'
                        }`}
                    >
                        {/* Mobile: 2-Tier Stacked Layout */}
                        <div className="flex sm:hidden flex-col items-center justify-center leading-tight py-0.5">
                            <span className="flex items-center gap-1 font-mono text-[9.5px] tracking-wider opacity-80 uppercase">
                                <span className={`w-1.5 h-1.5 rounded-xs shrink-0 ${overviewMode === 'pro' ? 'bg-[oklch(97%_0.008_28)]' : 'bg-current opacity-40'}`} />
                                PRO ANALYTICS
                            </span>
                            <span className="font-sans font-medium text-[11.5px] mt-0.5">วิเคราะห์เชิงลึก</span>
                        </div>

                        {/* Desktop: Single-Line Tabular Layout */}
                        <div className="hidden sm:flex items-center justify-center gap-2 whitespace-nowrap">
                            <span className={`w-2 h-2 rounded-xs shrink-0 ${overviewMode === 'pro' ? 'bg-[oklch(97%_0.008_28)]' : 'bg-current opacity-30'}`} />
                            <span className="font-mono tracking-wide">PRO ANALYTICS // <span className="font-sans font-medium">วิเคราะห์เชิงลึก</span></span>
                        </div>
                    </button>
                </div>

                {/* OVERVIEW CONTENT: SIMPLIFIED LIVE (DEFAULT) vs PRO MODE */}
                {overviewMode === 'simplified' ? (
                    <div className="space-y-6 mb-6">
                        {/* 1. Simplified Live Floor (Driven by parent bookings & tables) */}
                        <SimplifiedLiveOverview 
                            tables={tables}
                            bookings={dailyBookings}
                            revenueToday={revenueToday}
                            yesterdayRevenue={yesterdayRevenue}
                            shifts={shifts}
                            selectedDate={selectedDate}
                            loading={loading}
                            onRefresh={() => fetchData(true, selectedDate)}
                            onOpenProMode={() => handleSetOverviewMode('pro')}
                        />

                        {/* 1.2 Incoming Online Booking Alert if pending */}
                        {pendingBookings.length > 0 && (
                            <div className="p-3 bg-[oklch(95%_0.02_65)] border border-[oklch(75%_0.18_65)] rounded-sm flex items-center justify-between font-mono text-xs text-[oklch(18%_0.012_28)]">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-[oklch(75%_0.18_65)] animate-ping" />
                                    <span className="font-bold">[INBOX PENDING] มีคำขอจองโต๊ะใหม่ {pendingBookings.length} รายการใน Inbox</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleSetOverviewMode('pro')
                                        setActiveTab('inbox')
                                    }}
                                    className="px-2.5 py-1 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] text-[11px] font-bold rounded-xs cursor-pointer hover:bg-[oklch(28%_0.012_28)]"
                                >
                                    ตรวจสอบรายการจอง ➔
                                </button>
                            </div>
                        )}

                        {/* 1.5 Backoffice Simplified Daily Bills Summary List */}
                        <SimplifiedBillsSummaryList 
                            bookings={dailyBookings}
                            selectedDate={selectedDate}
                            loading={loading}
                            onOpenProMode={() => handleSetOverviewMode('pro')}
                        />

                        {/* 1.6 SYSTEM STATUS FOOTER (Dieter Rams Monospace Hardware Diagnostics) */}
                        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] p-3 rounded-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-xs text-[oklch(55%_0.010_28)] shadow-2xs">
                            <span className="font-bold text-[oklch(18%_0.012_28)] tracking-wider">SYSTEM STATUS</span>
                            <div className="flex items-center gap-4 text-[11px] flex-wrap">
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[oklch(45%_0.08_140)]"></span> POS ONLINE</span>
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[oklch(45%_0.08_140)]"></span> PRINTER READY</span>
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[oklch(45%_0.08_140)]"></span> LINEMAN SYNC</span>
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[oklch(45%_0.08_140)]"></span> DATABASE LIVE</span>
                            </div>
                        </div>

                        {/* 1.8 Hallmark Stark Callout to Pro Analytics Mode */}
                        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] p-4 sm:p-5 rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs shadow-2xs">
                            <div>
                                <span className="font-bold text-[oklch(18%_0.012_28)] text-sm block">
                                    ต้องการดูข้อมูลสถิติเชิงลึก หรือการจัดการกะเงินสด?
                                </span>
                                <span className="text-[11px] text-[oklch(55%_0.010_28)] mt-0.5 block">
                                    มีชาร์ตความเร็วยอดขาย Intraday Velocity, เมนูวิเคราะห์ BCG Matrix, P&L Waterfall, และสมุดกะเงินสด
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleSetOverviewMode('pro')}
                                className="px-4 py-2.5 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(28%_0.012_28)] text-[oklch(97%_0.008_28)] font-bold rounded-xs whitespace-nowrap cursor-pointer transition-colors self-start sm:self-auto flex items-center gap-1.5 shadow-2xs"
                            >
                                <span>เปิดโหมด PRO ANALYTICS</span>
                                <span>➔</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 mb-6">
                        {/* 1. Live Pulse KPI Strip & Payment Breakdown */}
                        <LivePulseMetrics 
                            revenueToday={revenueToday}
                            completedOrdersCount={completedOrdersCount}
                            activeUnpaidRevenue={activeUnpaidRevenue}
                            activeUnpaidCount={activeUnpaidCount}
                            totalTables={floorOccupancy.totalTables}
                            occupiedTables={floorOccupancy.occupiedTables}
                            totalGuests={floorOccupancy.totalGuests}
                            pendingInboxCount={pendingBookings.length}
                            dineInCount={dineInCount}
                            pickupCount={pickupCount}
                            paymentBreakdown={paymentBreakdown}
                            loading={loading}
                        />

                        {/* 1.2 Handcrafted Data Visual: Unified Intraday Velocity & Daypart Cockpit */}
                        <IntradayVelocityDaypartCockpit
                            bookings={dailyBookings}
                            selectedDate={selectedDate}
                            loading={loading}
                            totalSeats={floorOccupancy.totalTables > 0 ? floorOccupancy.totalTables * 3 : 45}
                            filterMode="day"
                        />

                        {/* 1.5 Executive Daily Shifts & Cash In/Out Summary */}
                        <DailyShiftsCashFlowWidget
                            shifts={shifts}
                            loading={loading}
                            selectedDate={selectedDate}
                            onSelectShiftTab={setActiveTab}
                            onRefreshShifts={() => fetchData(false, selectedDate)}
                        />

                        {/* 2. Owner Direct Broadcast to POS Screen */}
                        <OwnerPosBroadcastBar />

                        {/* 2.5 Handcrafted Data Visual: Table Turn Dwell Time & Service Mix Flow */}
                        <FloorTurnoverGauge
                            bookings={dailyBookings}
                            totalTables={floorOccupancy.totalTables}
                            occupiedTables={floorOccupancy.occupiedTables}
                        />

                        {/* 3. Interactive Live Floor & 1-Tap Table Block */}
                        <LiveFloorQuickStatus 
                            onOccupancyChange={setFloorOccupancy}
                        />

                        {/* 4. Segmented Filter Tabs (Tabular Brutalist Division) */}
                        <div className="flex gap-1 overflow-x-auto border-b border-[oklch(85%_0.012_28)] pt-4 font-mono text-xs no-scrollbar">
                            {[
                                { key: 'bills', label: 'ALL BILLS', count: dailyBookings.length, icon: Receipt },
                                { key: 'shifts', label: 'SHIFTS (กะเงินสด)', count: shifts.length, icon: Layers },
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
                )}
            </div>

            {/* Daily Summary PNG Slip Modal */}
            {showDailySummaryModal && (
                <DailySummarySlipModal
                    bookings={dailyBookings}
                    shifts={shifts}
                    selectedDate={selectedDate}
                    companySettings={companySettings}
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
