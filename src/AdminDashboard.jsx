/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useMemo, useRef, useCallback, useTransition, lazy, Suspense } from 'react'
import { supabase } from './lib/supabaseClient'

import { getThaiDate, formatThaiTimeOnly, formatThaiDateOnly } from './utils/timeUtils'
import { toast } from 'sonner'
import ConfirmationModal from './components/ConfirmationModal'
import { getBookingPaymentBreakdown } from './utils/shiftHelper'
import { playOrderAlert } from './utils/audioHelper'
import { subscribePOSBroadcast, sendTrackingBroadcast, sendPOSBroadcast } from './utils/realtimeNotifier'
import { RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'

// Live Now (default landing) stays in the main chunk
import SimplifiedLiveOverview from './components/admin/overview/SimplifiedLiveOverview'
import SimplifiedBillsSummaryList from './components/admin/overview/SimplifiedBillsSummaryList'
import { AdminSkeletonRows } from './components/admin/AdminKit'
import { isGhostPickupBooking, isInternalBlockBooking, isDuplicateGhostBooking } from './utils/tableTransferHelper'
import { computeDailyOverviewMetrics } from './utils/overviewMetricsHelper'
import { withoutSecretSettings } from './utils/secretSettingKeys'

// Pro Analytics blocks load only when that mode is opened (keeps Live Now light)
const AdminExecutiveDataVizDashboard = lazy(() => import('./components/admin/overview/AdminExecutiveDataVizDashboard'))
const IntradayVelocityDaypartCockpit = lazy(() => import('./components/admin/financial/IntradayVelocityDaypartCockpit'))
const LaborVsSalesCard = lazy(() => import('./components/admin/overview/LaborVsSalesCard'))
const AiCostCard = lazy(() => import('./components/admin/overview/AiCostCard'))
const LiveFloorQuickStatus = lazy(() => import('./components/admin/overview/LiveFloorQuickStatus'))
const AdminShiftsLedgerTab = lazy(() => import('./components/admin/overview/AdminShiftsLedgerTab'))
const AllDailyBillsHub = lazy(() => import('./components/admin/overview/AllDailyBillsHub'))
const OwnerPosBroadcastBar = lazy(() => import('./components/admin/overview/OwnerPosBroadcastBar'))
const OnlineAdvanceOrdersHub = lazy(() => import('./components/admin/overview/OnlineAdvanceOrdersHub'))
const InboxSection = lazy(() => import('./components/admin/InboxSection'))
const ScheduleSection = lazy(() => import('./components/admin/ScheduleSection'))

// Lazy-Loaded Dialog Modals (Improves First Contentful Paint & Mobile Performance)
const DailySummarySlipModal = lazy(() => import('./components/admin/overview/DailySummarySlipModal'))
const SlipModal = lazy(() => import('./components/shared/SlipModal'))
const ViewSlipModal = lazy(() => import('./components/shared/ViewSlipModal'))
const TaxInvoiceModal = lazy(() => import('./components/admin/tax/TaxInvoiceModal'))
const TaxInvoicePrintView = lazy(() => import('./components/admin/tax/TaxInvoicePrintView'))

export default function AdminDashboard() {
    const [tables, setTables] = useState([])
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: null })
    const [bookings, setBookings] = useState([]) // Stores Pending (All) + Selected Date Bookings
    const [shifts, setShifts] = useState([]) // Stores shifts for Selected Date / Active shift
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('bills') // bills, shifts, inbox, schedule, floor
    // Placeholders only before the first answer. After that a reload (date change, refresh) keeps the
    // rows on screen, dimmed and inert, instead of swapping them for "loading" text and back.
    const [hasLoaded, setHasLoaded] = useState(false)
    const [selectedDate, setSelectedDate] = useState(getThaiDate())
    const [overviewMode, setOverviewMode] = useState(() => {
        // Always default to 'simplified' (LIVE NOW // โต๊ะสดหน้าร้าน) on initial landing
        if (typeof window !== 'undefined') {
            try {
                // Clear any legacy persistent 'pro' from localStorage so LIVE NOW is always the default landing
                localStorage.removeItem('onhaus_admin_overview_mode')
                const params = new URLSearchParams(window.location.search)
                const urlMode = params.get('mode')
                if (urlMode === 'pro' || urlMode === 'simplified') return urlMode
                const sessionMode = sessionStorage.getItem('onhaus_admin_overview_mode')
                if (sessionMode === 'pro' || sessionMode === 'simplified') return sessionMode
            } catch {
                // ignore sessionStorage error
            }
        }
        return 'simplified' // Default: LIVE NOW
    })

    // Mode and tab switches run as transitions: the Pro blocks and each tab body are lazy chunks, and a plain
    // state change swapped the whole view for a short placeholder while the chunk loaded. The page collapsed
    // to one screen, the browser clamped the scroll to the top, and the owner had to scroll back down.
    // In a transition React keeps the current view on screen (dimmed below) until the next one is ready.
    const [isSwitching, startSwitch] = useTransition()

    const handleSetOverviewMode = (mode) => {
        startSwitch(() => setOverviewMode(mode))
        try {
            sessionStorage.setItem('onhaus_admin_overview_mode', mode)
        } catch {
            // ignore sessionStorage error
        }
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
    const handleOccupancyChange = useCallback((newOcc) => {
        setFloorOccupancy(prev => {
            if (!newOcc) return prev
            if (prev.totalTables === newOcc.totalTables &&
                prev.occupiedTables === newOcc.occupiedTables &&
                prev.totalGuests === newOcc.totalGuests) {
                return prev
            }
            return newOcc
        })
    }, [])
    const [showDailySummaryModal, setShowDailySummaryModal] = useState(false)
    const [yesterdayRevenue, setYesterdayRevenue] = useState(0)
    const [adTelemetry, setAdTelemetry] = useState({ visits: 0, maps: 0, contacts: 0, orders: 0, totalEvents: 0 })
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
                    // Secrets stay out of page state and localStorage
                    const settingsMap = withoutSecretSettings(data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {}));
                    setCompanySettings(settingsMap);
                    try {
                        localStorage.setItem('onhaus_tax_settings', JSON.stringify(settingsMap));
                        if (settingsMap.default_vat_enabled !== undefined) {
                            localStorage.setItem('pos_default_vat_enabled', String(settingsMap.default_vat_enabled));
                        }
                    } catch {
                        // ignore storage error
                    }
                }
            } catch {
                // ignore network error
            }
        };
        loadTaxSettings();
    }, [])

    const fetchData = async (isSilent = false, overrideDate = null) => {
        const queryDate = overrideDate || selectedDateRef.current
        const requestId = ++activeRequestIdRef.current
        if (!isSilent) setLoading(true)
        try {
            const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

            // 1. Fetch Recent Pending (Inbox) with full order_items fields
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
                .gte('booking_time', recentCutoff)
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

            // 3. Fetch active seated/in-service tables across floor (bounded to recent 7 days + future reservations)
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
                .in('status', ['seated', 'confirmed', 'ready', 'preparing'])
                .gte('booking_time', recentCutoff)
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

            // 7. Fetch Ad & Traffic Events for the queryDate
            const adReq = supabase
                .from('ad_events')
                .select('event_name, utm_source')
                .gte('created_at', `${queryDate}T00:00:00+07:00`)
                .lte('created_at', `${queryDate}T23:59:59+07:00`)

            const [pendingRes, dateRes, seatedRes, shiftsRes, tablesRes, yesterdayRes, adRes] = await Promise.all([
                pendingReq, dateReq, seatedReq, shiftsReq, tablesReq, yesterdayReq, adReq
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

            if (adRes?.data) {
                const adData = adRes.data
                setAdTelemetry({
                    visits: adData.filter(e => e.event_name === 'page_view').length,
                    maps: adData.filter(e => ['find_location', 'click_directions', 'directions'].includes(e.event_name)).length,
                    contacts: adData.filter(e => ['generate_lead', 'click_line', 'line', 'contact', 'click_phone', 'click_call', 'call'].includes(e.event_name)).length,
                    orders: adData.filter(e => ['click_booking_link', 'click_pickup_link', 'click_booking', 'click_pickup', 'booking_complete', 'pickup_complete'].includes(e.event_name)).length,
                    totalEvents: adData.length
                })
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
            // The newest request always clears the loading state. A silent refetch can
            // supersede the first (non-silent) one, which then returns early above; if only
            // non-silent requests cleared it, the page stayed on "loading" forever.
            if (requestId === activeRequestIdRef.current) {
                setLoading(false)
                setHasLoaded(true)
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
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, debouncedFetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, debouncedFetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tables_layout' }, debouncedFetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, debouncedFetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_shifts' }, debouncedFetchData)
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    isRealtimeSubscribed = true
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    isRealtimeSubscribed = false
                    console.warn(`[Admin Realtime] Channel status: ${status}, retrying quiet fetch...`, err)
                    debouncedFetchData()
                }
            })

        // 2. Direct POS Realtime Notifications Broadcast Channel (cross-device < 50ms & local BroadcastChannel deduplicated)
        const unsubscribePosBroadcast = subscribePOSBroadcast(() => debouncedFetchData());

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
            // If realtime is healthy, only heartbeat once every 180 seconds (every 6 ticks of 30s)
            if (isRealtimeSubscribed && heartbeatCounter % 6 !== 0) return
            // If disconnected from WebSocket, fallback poll every 60s
            if (!isRealtimeSubscribed && heartbeatCounter % 2 !== 0) return
            fetchData(true, selectedDateRef.current)
        }, 30000)

        // 5. Refetch when tab/window regains focus or becomes visible (with 500ms debounce)
        let focusDebounceTimer = null
        const handleVisibilityOrFocus = () => {
            if (document.visibilityState === 'visible') {
                if (focusDebounceTimer) clearTimeout(focusDebounceTimer)
                focusDebounceTimer = setTimeout(() => {
                    fetchData(true, selectedDateRef.current)
                }, 500)
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityOrFocus)
        window.addEventListener('focus', handleVisibilityOrFocus)

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            if (focusDebounceTimer) clearTimeout(focusDebounceTimer)
            clearInterval(autoPollTimer)
            supabase.removeChannel(tableChannel)
            unsubscribePosBroadcast()
            window.removeEventListener('pos-shift-changed', handleShiftChanged)
            window.removeEventListener('storage', handleStorageSync)
            document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
            window.removeEventListener('focus', handleVisibilityOrFocus)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const updateStatus = async (id, status) => {
        setConfirmModal({
            isOpen: true,
            title: status === 'confirmed' ? 'Confirm Order' : (status === 'cancelled' ? 'Reject Order' : 'Update Status'),
            message: `Are you sure you want to mark this order as ${status}?`,
            isDangerous: status === 'cancelled',
            action: async () => {
                setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b))

                const { data: updatedRow, error } = await supabase
                    .from('bookings')
                    .update({ status })
                    .eq('id', id)
                    .select('id, tracking_token, status')
                    .maybeSingle()

                if (error) {
                    toast.error('Error updating status: ' + error.message)
                    fetchData(true)
                } else {
                    if (updatedRow?.tracking_token) {
                        sendTrackingBroadcast(updatedRow.tracking_token, 'order_status_updated', {
                            status,
                            booking_id: id
                        })
                    }
                    sendPOSBroadcast('online_order_status_updated', {
                        booking_id: id,
                        status
                    })
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
            // Exclude internal floor blocks / maintenance holds, empty ghost pickups, and duplicate ghost table sessions
            if (isInternalBlockBooking(b)) return false
            if (isGhostPickupBooking(b)) return false
            if (isDuplicateGhostBooking(b, bookings)) return false

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

    // 1.5 Omni-Date Active Online Bookings & Pickups (No matter what day, must show up!)
    const omniOnlineBookings = useMemo(() => {
        const today = getThaiDate()
        return bookings.filter(b => {
            if (isInternalBlockBooking(b)) return false
            if (isGhostPickupBooking(b)) return false
            if (isDuplicateGhostBooking(b, bookings)) return false
            const st = (b.status || '').toLowerCase()
            if (['cancelled', 'void', 'completed', 'paid', 'success'].includes(st)) return false

            const sourceLower = (b.source || '').toLowerCase()
            const remarkLower = (b.staff_remark || '').toLowerCase()
            const isLineman = sourceLower === 'lineman' || remarkLower.includes('lineman') || (b.customer_name || '').toLowerCase().includes('line man')
            const isPickup = b.booking_type === 'pickup' || b.order_type === 'hausmade_pickup' || remarkLower.includes('pickup') || remarkLower.includes('takeaway') || remarkLower.includes('รับกลับ')
            const isShop = b.booking_type === 'shop' || b.booking_type === 'hausmade_shipping'
            const isOnlineBooking = (sourceLower === 'online' || sourceLower === 'line' || Number(b.deposit_amount || 0) > 0 || Boolean(b.payment_slip_url)) && b.booking_type !== 'walk_in'
            
            // Advance booking for today or future dates that is not an in-store seated session
            const bDate = new Date(b.booking_time || b.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
            const isAdvance = bDate >= today && st !== 'seated'

            return isLineman || isPickup || isShop || isOnlineBooking || isAdvance
        })
    }, [bookings])

    // 2. Inbox: Pending (ALL dates)
    const pendingBookings = useMemo(() =>
        bookings.filter(b => b.status === 'pending' && !isGhostPickupBooking(b) && !isDuplicateGhostBooking(b, bookings)).sort((a, b) => new Date(a.booking_time) - new Date(b.booking_time))
        , [bookings])

    // 3. Schedule: Confirmed / Seated / Ready for selected date
    const scheduleBookings = useMemo(() => {
        return bookings.filter(b => {
            if (isGhostPickupBooking(b)) return false
            if (isDuplicateGhostBooking(b, bookings)) return false
            const bDate = new Date(b.booking_time || b.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
            const isDateMatch = bDate === selectedDate
            const isConfirmed = b.status === 'confirmed' || b.status === 'seated' || b.status === 'ready' || b.status === 'paid'
            return isDateMatch && isConfirmed
        }).sort((a, b) => new Date(a.booking_time || a.created_at) - new Date(b.booking_time || b.created_at))
    }, [bookings, selectedDate])

    // 4. Live Financial Metrics & Payment Breakdown for the selected date (Settled vs Active Unpaid Bills)
    const { revenueToday, completedOrdersCount, activeUnpaidRevenue, activeUnpaidCount, dineInCount, pickupCount, paymentBreakdown } = useMemo(
        () => computeDailyOverviewMetrics(dailyBookings, getBookingPaymentBreakdown),
        [dailyBookings]
    )

    // 5. Derived Floor Occupancy (Always accurate in both LIVE NOW and PRO ANALYTICS)
    const derivedFloorOccupancy = useMemo(() => {
        const totalT = tables.length || floorOccupancy.totalTables || 12
        const isToday = selectedDate === getThaiDate()
        if (!isToday) {
            const historicalGuests = dailyBookings.reduce((sum, b) => {
                if (['cancelled', 'void'].includes(b.status)) return sum
                if (isInternalBlockBooking(b)) return sum
                return sum + Number(b.guest_count || b.pax || 2)
            }, 0)
            const uniqueTables = new Set(
                dailyBookings
                    .filter(b => !['cancelled', 'void'].includes(b.status) && b.table_id)
                    .map(b => b.table_id)
            )
            return {
                totalTables: totalT,
                occupiedTables: uniqueTables.size,
                totalGuests: historicalGuests
            }
        }

        const seatedBookings = dailyBookings.filter(b => b.status === 'seated' && !isInternalBlockBooking(b))
        const occupiedTableSet = new Set(seatedBookings.map(b => b.table_id).filter(Boolean))
        const activeGuests = seatedBookings.reduce((sum, b) => sum + Number(b.guest_count || b.pax || 2), 0)
        return {
            totalTables: totalT,
            occupiedTables: occupiedTableSet.size || floorOccupancy.occupiedTables || 0,
            totalGuests: activeGuests || floorOccupancy.totalGuests || 0
        }
    }, [tables.length, floorOccupancy, dailyBookings, selectedDate])

    // --- Sound Alert Logic (noti1.mp3 High-Gain Engine) ---
    const [soundMuted, setSoundMuted] = useState(false)
    const alertIntervalRef = useRef(null)

    useEffect(() => {
        if (!soundMuted && pendingBookings.length > 0) {
            playOrderAlert('admin_pending_orders', 800, 3.2)
            if (!alertIntervalRef.current) {
                alertIntervalRef.current = setInterval(() => {
                    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
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

    const firstLoad = loading && !hasLoaded
    const isStale = isSwitching || (loading && hasLoaded)

    const getTabContent = () => {
        if (activeTab === 'bills') {
            return (
                <AllDailyBillsHub
                    bookings={dailyBookings}
                    loading={firstLoad}
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
                    loading={firstLoad}
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
                    loading={firstLoad} 
                    onPrint={handlePrint}
                    onViewSlip={setViewSlipUrl}
                />
            )
        }

        if (activeTab === 'floor') {
            return (
                <div className="space-y-6">
                    <LiveFloorQuickStatus 
                        onOccupancyChange={setFloorOccupancy} 
                        externalTables={tables}
                        externalBookings={bookings}
                    />
                </div>
            )
        }

        return null
    }

    return (
        <>
            <ConfirmationModal 
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.action}
                title={confirmModal.title}
                message={confirmModal.message}
                isDangerous={confirmModal.isDangerous}
            />
            
            <div className="pb-24 w-full min-w-0 overflow-x-clip">
                {/* Title row: the screen's name, the shift status as its one line of data, the day's controls */}
                {(() => {
                    const isToday = selectedDate === getThaiDate()
                    const strong = 'font-medium text-[var(--color-ink)]'
                    const dateChip = (active) => `h-9 px-3 rounded-md text-[13px] cursor-pointer transition-colors whitespace-nowrap ${active ? 'bg-[var(--color-paper)] text-[var(--color-ink)] font-medium border border-[var(--color-rule)]' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)] border border-transparent'}`
                    const ghostBtn = 'h-11 px-3.5 rounded-lg border border-[var(--color-rule)] text-[13px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 active:translate-y-px'
                    const shiftPillClass = !isToday
                        ? 'bg-[var(--color-paper-2)] text-[var(--color-muted)] border-[var(--color-rule)]'
                        : isShiftOpen
                            ? 'bg-[var(--status-ok-bg)] text-[var(--status-ok-ink)] border-[var(--status-ok-border)]'
                            : 'bg-[var(--color-paper-2)] text-[var(--color-muted)] border-[var(--color-rule)]'
                    const shiftPillLabel = !isToday
                        ? 'ข้อมูลย้อนหลัง'
                        : isShiftOpen
                            ? 'กะเปิดอยู่'
                            : 'ยังไม่เปิดรอบ'
                    return (
                        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 mb-6">
                            <div className="min-w-0">
                                <h1 className="text-2xl font-semibold leading-9 text-[var(--color-ink)]">
                                    ภาพรวมหน้าร้าน
                                </h1>
                                <div className="mt-1.5 text-sm leading-6 text-[var(--color-muted)] flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold whitespace-nowrap ${shiftPillClass}`}>
                                        {shiftPillLabel}
                                    </span>
                                    {!isToday ? (
                                        latestClosedShift ? (
                                            <>
                                                <span>ปิดรอบ <span className={`tabular-nums ${strong}`}>{formatThaiTimeOnly(latestClosedShift.closed_at)}</span> โดย <span className={strong}>{latestClosedShift.staff_name}</span></span>
                                                {shifts.length > 1 && <span className="tabular-nums text-[var(--color-neutral)]">ทั้งหมด {shifts.length} กะ</span>}
                                            </>
                                        ) : (
                                            <span>ไม่มีรอบขาย POS ในวันที่ {formatThaiDateOnly(selectedDate)}</span>
                                        )
                                    ) : isShiftOpen ? (
                                        <span><span className={strong}>{activeShift.staff_name}</span> เปิดเมื่อ <span className="tabular-nums">{formatThaiTimeOnly(activeShift.opened_at)}</span></span>
                                    ) : latestClosedShift ? (
                                        <span>ล่าสุดปิด <span className="tabular-nums">{formatThaiTimeOnly(latestClosedShift.closed_at)}</span> โดย <span className={strong}>{latestClosedShift.staff_name}</span></span>
                                    ) : (
                                        <span>ยังไม่มีการเปิดรอบขายบนเครื่อง POS</span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-1 h-11 px-1 rounded-lg border border-[var(--color-rule)] bg-[var(--color-paper-2)] w-full sm:w-auto min-w-0">
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => handleDateChange(e.target.value)}
                                        aria-label="เลือกวันที่"
                                        className="bg-transparent border-none text-[var(--color-ink)] text-[13px] tabular-nums px-2 focus:outline-none cursor-pointer min-w-0 flex-1"
                                    />
                                    <button type="button" onClick={() => handleDateChange(getThaiDate())} className={dateChip(isToday)}>
                                        วันนี้
                                    </button>
                                    <button type="button" onClick={() => handleDateChange(getYesterdayDate())} className={dateChip(selectedDate === getYesterdayDate())}>
                                        เมื่อวาน
                                    </button>
                                </div>

                                {(soundMuted || pendingBookings.length > 0) && (
                                    <button
                                        type="button"
                                        onClick={() => setSoundMuted(!soundMuted)}
                                        className={`${ghostBtn} ${soundMuted ? 'text-[var(--color-muted)]' : 'border-[var(--brand-plum)] text-[var(--brand-plum)] bg-[var(--color-plum-pale)]'}`}
                                        title={soundMuted ? 'เปิดเสียงแจ้งเตือนคำขอรอตรวจ' : 'ปิดเสียงแจ้งเตือนคำขอรอตรวจ'}
                                    >
                                        <span>{soundMuted ? 'เสียงปิด' : 'เสียงเปิด'}</span>
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={() => setShowDailySummaryModal(true)}
                                    className={ghostBtn}
                                    title="ส่งออกสลิปสรุปยอดปิดวันเป็นภาพ PNG"
                                >
                                    สลิปปิดวัน
                                </button>

                                <button
                                    type="button"
                                    onClick={() => fetchData(false, selectedDate)}
                                    disabled={loading}
                                    className={`${ghostBtn} w-11 px-0 justify-center`}
                                    title="รีเฟรชข้อมูลล่าสุด"
                                    aria-label="รีเฟรชข้อมูลล่าสุด"
                                >
                                    <RefreshCw strokeWidth={1.5} className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>
                    )
                })()}

                {/* Mode switch: Thai-first tabs on a full-width hairline */}
                <div className="flex gap-6 border-b border-[var(--color-paper-3)] mb-6" role="tablist" aria-label="โหมดภาพรวม">
                    {[
                        { key: 'simplified', label: 'โต๊ะสดหน้าร้าน', sub: 'Live' },
                        { key: 'pro', label: 'วิเคราะห์เชิงลึก', sub: 'Analytics' }
                    ].map((m) => {
                        const on = overviewMode === m.key
                        return (
                            <button
                                key={m.key}
                                type="button"
                                role="tab"
                                aria-selected={on}
                                onClick={() => handleSetOverviewMode(m.key)}
                                className={`relative h-11 text-sm cursor-pointer transition-colors whitespace-nowrap inline-flex items-baseline gap-1.5 ${on ? 'text-[var(--color-ink)] font-semibold' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}
                            >
                                <span>{m.label}</span>
                                <span className="hidden sm:inline font-mono text-xs text-[var(--color-neutral)] font-normal">{m.sub}</span>
                                {on && (
                                    <motion.span
                                        layoutId="overview-mode-underline"
                                        className="absolute left-0 right-0 -bottom-px h-0.5 bg-[var(--color-ink)]"
                                        transition={{ type: 'spring', stiffness: 520, damping: 42, mass: 0.6 }}
                                    />
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* OVERVIEW CONTENT: SIMPLIFIED LIVE (DEFAULT) vs PRO MODE */}
                <div
                    className={`transition-opacity duration-150 ${isStale ? 'opacity-60 pointer-events-none' : ''}`}
                    aria-busy={isStale || undefined}
                >
                <Suspense fallback={<AdminSkeletonRows rows={12} className="mb-6" />}>
                {overviewMode === 'simplified' ? (
                    <div className="space-y-6 mb-6">
                        {/* 1. Simplified Live Floor (Direct Floor Awareness with Zero Graph Clutter) */}
                        <SimplifiedLiveOverview 
                            tables={tables}
                            bookings={dailyBookings}
                            omniOnlineBookings={omniOnlineBookings}
                            revenueToday={revenueToday}
                            yesterdayRevenue={yesterdayRevenue}
                            activeUnpaidRevenue={activeUnpaidRevenue}
                            activeUnpaidCount={activeUnpaidCount}
                            shifts={shifts}
                            selectedDate={selectedDate}
                            loading={firstLoad}
                            hideHeroKpis={false}
                            onRefresh={() => fetchData(true, selectedDate)}
                            onOpenProMode={() => handleSetOverviewMode('pro')}
                            onViewSlip={setViewSlipUrl}
                            onUpdateStatus={updateStatus}
                        />

                        {/* 2. Backoffice Simplified Daily Bills Summary List */}
                        <SimplifiedBillsSummaryList 
                            bookings={dailyBookings}
                            selectedDate={selectedDate}
                            loading={firstLoad}
                            onOpenProMode={() => handleSetOverviewMode('pro')}
                        />
                    </div>
                ) : (
                    <div className="space-y-6 mb-6">
                        {/* 0. Modern Bento Executive Data Visualization Dashboard */}
                        <AdminExecutiveDataVizDashboard
                            bookings={dailyBookings}
                            revenueToday={revenueToday}
                            yesterdayRevenue={yesterdayRevenue}
                            completedOrdersCount={completedOrdersCount}
                            activeUnpaidRevenue={activeUnpaidRevenue}
                            activeUnpaidCount={activeUnpaidCount}
                            totalTables={derivedFloorOccupancy.totalTables}
                            occupiedTables={derivedFloorOccupancy.occupiedTables}
                            totalGuests={derivedFloorOccupancy.totalGuests}
                            dineInCount={dineInCount}
                            pickupCount={pickupCount}
                            paymentBreakdown={paymentBreakdown}
                            adTelemetry={adTelemetry}
                            shifts={shifts}
                            selectedDate={selectedDate}
                            loading={firstLoad}
                            onOpenShiftLedger={() => setActiveTab('shifts')}
                            onSwitchToLiveNow={() => handleSetOverviewMode('simplified')}
                            onOpenDailySlip={() => setShowDailySummaryModal(true)}
                        />

                        {/* 0.5 Labour vs sales (analytics only, owner 2026-11-26; hides without HR data) */}
                        <LaborVsSalesCard selectedDate={selectedDate} />

                        {/* 0.6 Estimated AI spend (analytics only, owner 2026-11-26; admin only) */}
                        <AiCostCard selectedDate={selectedDate} />

                        {/* 1. Omni-Date Online & Advance Orders Hub */}
                        <OnlineAdvanceOrdersHub 
                            bookings={omniOnlineBookings}
                            onViewSlip={setViewSlipUrl}
                            onInspectBill={(order) => handlePrint(order, 'bill')}
                            onUpdateStatus={updateStatus}
                            onOpenProMode={() => setActiveTab('inbox')}
                            loading={firstLoad}
                        />

                        {/* 2. Intraday Velocity & Daypart Chart (Compact Header Mode avoids duplicate KPI clutter) */}
                        <IntradayVelocityDaypartCockpit
                            bookings={dailyBookings}
                            selectedDate={selectedDate}
                            loading={firstLoad}
                            totalSeats={derivedFloorOccupancy.totalTables > 0 ? derivedFloorOccupancy.totalTables * 3 : 45}
                            filterMode="day"
                            compactMode={true}
                        />

                        {/* 3. Owner Direct Broadcast to POS Screen */}
                        <OwnerPosBroadcastBar />

                        {/* 4. Segmented Filter Tabs (Clean Bento Pill Bar) */}
                        <div className="flex gap-6 overflow-x-auto border-b border-[var(--color-paper-3)] text-sm no-scrollbar">
                            {[
                                { key: 'bills', label: 'บิลทั้งหมด', count: dailyBookings.length },
                                { key: 'shifts', label: 'กะเงินสด (Shifts)', count: shifts.length },
                                { key: 'inbox', label: 'คำขอรอตรวจ', count: pendingBookings.length },
                                { key: 'schedule', label: 'ตารางจอง', count: scheduleBookings.length },
                                { key: 'floor', label: 'ผังโต๊ะ', count: derivedFloorOccupancy.occupiedTables }
                            ].map((tab) => {
                                const isActive = activeTab === tab.key
                                return (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => startSwitch(() => setActiveTab(tab.key))}
                                        className={`h-11 -mb-px border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                                            isActive
                                                ? 'border-[var(--color-ink)] text-[var(--color-ink)] font-medium'
                                                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                                        }`}
                                    >
                                        <span>{tab.label}</span>
                                        <span className={`text-xs tabular-nums ${isActive ? 'text-[var(--color-muted)]' : 'text-[var(--color-neutral)]'}`}>
                                            {tab.count}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>

                        {/* 5. Tab Content */}
                        {/* Own boundary: a tab body that is still loading holds its place with rows, never the whole Pro view.
                            The floor of 70vh keeps the tab strip where it is when a short tab (an empty inbox) follows a long one;
                            without it the page got shorter than the scroll position and the browser pulled the view up. */}
                        <div className="min-h-[70vh]">
                            <Suspense fallback={<AdminSkeletonRows rows={8} />}>
                                {getTabContent()}
                            </Suspense>
                        </div>
                    </div>
                )}
                </Suspense>
                </div>
            </div>

            {/* Lazy-Loaded Modals Wrapped in Suspense */}
            <Suspense fallback={null}>
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
                        booking={taxInvoiceBooking?.invoice_number ? null : taxInvoiceBooking}
                        existingInvoice={taxInvoiceBooking?.invoice_number ? taxInvoiceBooking : null}
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
                        onEdit={(inv) => {
                            setActivePrintInvoice(null);
                            setTaxInvoiceBooking(inv);
                        }}
                    />
                )}
            </Suspense>
        </>
    )
}
