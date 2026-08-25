/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from './lib/supabaseClient'
import SlipModal from './components/shared/SlipModal'
import ViewSlipModal from './components/shared/ViewSlipModal'
import HoldToDeleteButton from './components/HoldToDeleteButton'
import { formatThaiTimeOnly, formatThaiDateOnly, formatThaiTime, getThaiDate } from './utils/timeUtils'
import { getShortBookingId } from './utils/printerHelper'
import { formatOrderItemOptions } from './utils/menuHelper'
import { parseTableTransferInfo } from './utils/tableTransferHelper'
import { toast } from 'sonner'

// Helper to format item options into clean human-readable tags
const formatOptionList = (options, note) => formatOrderItemOptions(options, note)

// Precision Thai Currency Formatter
const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Helper to classify order origin & channel cleanly (Online vs In-Store)
export const getOrderOrigin = (b) => {
    const sourceLower = (b.source || '').toLowerCase()
    const remarkLower = (b.staff_remark || '').toLowerCase()
    const noteLower = (b.customer_note || '').toLowerCase()
    const nameLower = (b.customer_name || b.pickup_contact_name || b.profiles?.display_name || '').toLowerCase()

    // 1. LINE MAN Delivery
    if (sourceLower === 'lineman' || remarkLower.includes('lineman') || noteLower.includes('lineman') || nameLower.includes('line man') || nameLower.startsWith('lm-')) {
        return {
            key: 'lineman',
            label: 'LINE MAN DELIVERY',
            shortTag: 'LINE MAN',
            isOnline: true,
            badgeClass: 'bg-[var(--color-paper-2)] text-[var(--color-accent-2)] border-[var(--color-accent-2)]'
        }
    }

    // 2. Hausmade Shop E-Commerce / Shipping
    if (b.booking_type === 'shop' || b.booking_type === 'hausmade_shipping') {
        return {
            key: 'shop',
            label: 'HAUSMADE SHOP',
            shortTag: 'SHOP / PARCEL',
            isOnline: true,
            badgeClass: 'bg-[var(--color-paper-2)] text-[var(--color-accent-2)] border-[var(--color-rule)]'
        }
    }

    // Explicit In-House / POS Indicator
    const isExplicitInHouse = sourceLower === 'pos' || sourceLower === 'walk_in' || remarkLower.includes('walk-in') || b.booking_type === 'walk_in'

    // Online Source Signals
    const isOnlineSource = (sourceLower === 'online' || sourceLower === 'line' || remarkLower.includes('online') || noteLower.includes('online') || Boolean(b.payment_slip_url)) && !isExplicitInHouse

    // 3. Pickup / Takeaway (Online Pickup vs In-House / POS Takeaway)
    const isPickupOrder = b.booking_type === 'pickup' || remarkLower.includes('pickup') || remarkLower.includes('takeaway') || remarkLower.includes('รับกลับ') || noteLower.includes('pickup')
    if (isPickupOrder) {
        if (isOnlineSource) {
            return {
                key: 'pickup',
                label: 'ONLINE PICKUP',
                shortTag: 'ONLINE PICKUP',
                isOnline: true,
                badgeClass: 'bg-[var(--color-paper-2)] text-[var(--color-accent)] border-[var(--color-accent)]'
            }
        }
        return {
            key: 'in_house_pickup',
            label: 'IN-HOUSE PICKUP',
            shortTag: 'TAKEAWAY',
            isOnline: false,
            badgeClass: 'bg-[var(--color-paper-2)] text-[var(--color-ink)] border-[var(--color-rule)]'
        }
    }

    // 4. Online Dine-In Reservation vs In-House Walk-in
    const hasOnlineReservationSignal = (isOnlineSource || Number(b.deposit_amount || 0) > 0 || (b.booking_type === 'dine_in' && sourceLower !== 'pos' && sourceLower !== 'walk_in' && sourceLower !== 'qr')) && !isExplicitInHouse

    if (hasOnlineReservationSignal && b.booking_type !== 'walk_in') {
        return {
            key: 'online_booking',
            label: 'ONLINE RESERVATION',
            shortTag: 'ONLINE DINE-IN',
            isOnline: true,
            badgeClass: 'bg-[var(--color-paper-2)] text-[var(--color-accent)] border-[var(--color-accent)]'
        }
    }

    // 5. In-House / POS / Table QR Walk-in
    return {
        key: 'in_house',
        label: 'IN-HOUSE DINE-IN',
        shortTag: 'IN-HOUSE',
        isOnline: false,
        badgeClass: 'bg-[var(--color-paper-2)] text-[var(--color-ink)] border-[var(--color-rule)]'
    }
}

export default function AdminBookings() {
    const [bookings, setBookings] = useState([])
    const [tablesList, setTablesList] = useState([])
    const [loading, setLoading] = useState(true)

    // Filters
    const [statusFilter, setStatusFilter] = useState('all') // all, pending, confirmed, seated, preparing, ready, completed, cancelled
    const [typeFilter, setTypeFilter] = useState('all') // all, online_all, online_booking, pickup, shop, in_house, lineman
    const [datePreset, setDatePreset] = useState('today') // today, tomorrow, week, month, all, custom
    const [customDate, setCustomDate] = useState(getThaiDate())
    const [searchTerm, setSearchTerm] = useState('')

    // Selection & Sort
    const [selectedIds, setSelectedIds] = useState([])
    const [sortConfig, setSortConfig] = useState({ key: 'booking_time', direction: 'desc' })
    const [expandedIds, setExpandedIds] = useState(new Set())

    // Modals
    const [slipData, setSlipData] = useState(null) // { booking, type }
    const [viewSlipUrl, setViewSlipUrl] = useState(null)
    const [editingBooking, setEditingBooking] = useState(null) // Booking object being edited

    // Concurrency & Lifecycle Guards to prevent memory leaks and request storms
    const isMountedRef = useRef(true)
    const inFlightFetchRef = useRef(false)
    const pendingRefetchRef = useRef(false)
    const lastFetchTimeRef = useRef(Date.now())

    const fetchTables = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('tables_layout')
                .select('id, table_name, capacity, is_active')
                .order('table_name', { ascending: true })
            if (!error && data && isMountedRef.current) {
                setTablesList(data)
            }
        } catch (e) {
            console.error('Failed to load tables:', e)
        }
    }, [])

    const fetchBookings = useCallback(async (showLoadingState = true) => {
        // Concurrency Guard: prevent multiple parallel fetches
        if (inFlightFetchRef.current) {
            pendingRefetchRef.current = true
            return
        }
        inFlightFetchRef.current = true

        if (showLoadingState && isMountedRef.current) setLoading(true)
        try {
            // 1. Fetch Bookings + Table Info + Order Items + Promos (Recent 200)
            const { data: bookingsData, error: bookingsError } = await supabase
                .from('bookings')
                .select(`
                    *,
                    tables_layout (id, table_name, capacity),
                    promotion_codes (code, discount_value, discount_type),
                    order_items (
                        id,
                        quantity,
                        price_at_time,
                        selected_options,
                        menu_item_id,
                        status,
                        menu_items (id, name, price, category_id)
                    )
                `)
                .order('created_at', { ascending: false })
                .limit(200)

            if (bookingsError) throw bookingsError

            // 2. Fetch Profiles for display name and phone
            const userIds = [...new Set((bookingsData || []).map(b => b.user_id).filter(Boolean))]
            let profilesMap = {}

            if (userIds.length > 0) {
                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, phone_number, line_user_id, display_name')
                    .in('id', userIds)

                if (!profilesError && profilesData) {
                    profilesData.forEach(p => { profilesMap[p.id] = p })
                }
            }

            // 3. Merge profiles into bookings
            const merged = (bookingsData || []).map(b => ({
                ...b,
                profiles: profilesMap[b.user_id] || null
            }))

            if (isMountedRef.current) {
                setBookings(merged)
                lastFetchTimeRef.current = Date.now()
            }
        } catch (err) {
            console.error('Error fetching bookings:', err)
            if (isMountedRef.current) {
                toast.error('Error loading bookings: ' + err.message)
            }
        } finally {
            inFlightFetchRef.current = false
            if (showLoadingState && isMountedRef.current) {
                setLoading(false)
            }
            // If another event was queued during in-flight fetch, execute it once
            if (pendingRefetchRef.current && isMountedRef.current) {
                pendingRefetchRef.current = false
                fetchBookings(false)
            }
        }
    }, [])

    // 1. Initial Load & Real-time Event Subscription (Zero-Leak WebSocket architecture)
    useEffect(() => {
        isMountedRef.current = true
        fetchBookings(true)
        fetchTables()

        // Debounce timer for bookings/orders realtime events
        let bookingsDebounceTimer = null
        const debouncedFetchBookings = () => {
            if (bookingsDebounceTimer) clearTimeout(bookingsDebounceTimer)
            bookingsDebounceTimer = setTimeout(() => {
                if (isMountedRef.current) {
                    fetchBookings(false) // Silent background refresh
                }
            }, 350)
        }

        // Debounce timer for tables_layout changes only
        let tablesDebounceTimer = null
        const debouncedFetchTables = () => {
            if (tablesDebounceTimer) clearTimeout(tablesDebounceTimer)
            tablesDebounceTimer = setTimeout(() => {
                if (isMountedRef.current) {
                    fetchTables()
                }
            }, 500)
        }

        // Unique Channel instance to prevent cross-component subscription collisions
        const channelId = `admin-bookings-hub-${Math.random().toString(36).slice(2, 8)}`
        const channel = supabase
            .channel(channelId)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, debouncedFetchBookings)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, debouncedFetchBookings)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'promotion_codes' }, debouncedFetchBookings)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tables_layout' }, debouncedFetchTables)
            .subscribe()

        // Visibility & Window Focus Sync (Syncs on resume without running wasteful interval polling)
        const handleVisibilityOrFocus = () => {
            if (document.visibilityState === 'visible' && isMountedRef.current) {
                const elapsed = Date.now() - lastFetchTimeRef.current
                if (elapsed > 15000) { // If tab was inactive for > 15s, refresh cleanly
                    fetchBookings(false)
                    fetchTables()
                }
            }
        }

        window.addEventListener('focus', handleVisibilityOrFocus)
        document.addEventListener('visibilitychange', handleVisibilityOrFocus)

        return () => {
            isMountedRef.current = false
            if (bookingsDebounceTimer) clearTimeout(bookingsDebounceTimer)
            if (tablesDebounceTimer) clearTimeout(tablesDebounceTimer)
            window.removeEventListener('focus', handleVisibilityOrFocus)
            document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
            supabase.removeChannel(channel)
        }
    }, [fetchBookings, fetchTables])

    // LINE Notification Trigger
    const sendNotification = async (booking, type) => {
        try {
            if (booking.profiles?.line_user_id) {
                await supabase.functions.invoke('send-line-push', {
                    body: { 
                        userId: booking.user_id,
                        targetLineId: booking.profiles.line_user_id,
                        type,
                        bookingDetails: {
                            id: booking.id,
                            date: new Date(booking.booking_time).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }),
                            time: new Date(booking.booking_time).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }),
                            tableName: booking.tables_layout?.table_name || 'N/A',
                            pax: booking.pax,
                            total: booking.total_amount,
                            customerName: booking.profiles.display_name || booking.pickup_contact_name || 'Customer'
                        }
                    }
                })
            }
        } catch (error) {
            console.error('Notification Error:', error)
        }
    }

    // Update Status Handler
    const updateStatus = async (booking, newStatus) => {
        try {
            const { error } = await supabase
                .from('bookings')
                .update({ status: newStatus })
                .eq('id', booking.id)

            if (error) throw error

            setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: newStatus } : b))
            toast.success(`Status updated to ${newStatus.toUpperCase()}`)

            if (newStatus === 'confirmed' || newStatus === 'cancelled') {
                await sendNotification(booking, newStatus)
            }
        } catch (err) {
            toast.error('Failed to update status: ' + err.message)
        }
    }

    // Delete Handler
    const executeDelete = async (targets) => {
        try {
            setLoading(true)
            const slipsToDelete = targets.map(b => b.payment_slip_url).filter(Boolean)
            if (slipsToDelete.length > 0) {
                const { error: storageError } = await supabase.storage
                    .from('slips')
                    .remove(slipsToDelete)
                if (storageError) console.warn('Slip deletion warning:', storageError)
            }

            const targetIds = targets.map(b => b.id)
            const { error: dbError } = await supabase
                .from('bookings')
                .delete()
                .in('id', targetIds)

            if (dbError) throw dbError

            setBookings(prev => prev.filter(b => !targetIds.includes(b.id)))
            setSelectedIds([])
            toast.success(`Deleted ${targets.length} order(s) successfully`)
        } catch (err) {
            console.error(err)
            toast.error('Delete failed: ' + err.message)
        } finally {
            if (isMountedRef.current) setLoading(false)
        }
    }

    // Modal Edit Save Handler
    const handleSaveEdit = async (updatedFields) => {
        if (!editingBooking) return
        try {
            const { error } = await supabase
                .from('bookings')
                .update(updatedFields)
                .eq('id', editingBooking.id)

            if (error) throw error

            // Fetch table info if table_id changed
            let updatedTableLayout = editingBooking.tables_layout
            if (updatedFields.table_id !== editingBooking.table_id) {
                updatedTableLayout = tablesList.find(t => t.id === updatedFields.table_id) || null
            }

            setBookings(prev => prev.map(b => b.id === editingBooking.id ? {
                ...b,
                ...updatedFields,
                tables_layout: updatedTableLayout
            } : b))

            toast.success('Booking details updated successfully')
            setEditingBooking(null)
        } catch (err) {
            toast.error('Failed to update booking: ' + err.message)
        }
    }

    // Print Handler
    const handlePrint = (booking, type) => {
        setSlipData({ booking, type })
    }

    // Expand / Collapse Row Toggle
    const toggleExpand = (id) => {
        setExpandedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    // Selection Helpers
    const toggleSelect = (id) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    const toggleSelectAll = (displayedBookings) => {
        if (selectedIds.length === displayedBookings.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(displayedBookings.map(b => b.id))
        }
    }

    // Sorting Helper
    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }))
    }

    // Date Filtering Logic Normalized to Bangkok Timezone
    const isDateMatch = useCallback((bookingTimeStr) => {
        if (!bookingTimeStr) return true
        if (datePreset === 'all') return true

        const bDate = new Date(bookingTimeStr).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
        const today = getThaiDate()

        if (datePreset === 'today') {
            return bDate === today
        }

        if (datePreset === 'tomorrow') {
            const tomorrow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
            tomorrow.setDate(tomorrow.getDate() + 1)
            const tomorrowStr = tomorrow.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
            return bDate === tomorrowStr
        }

        if (datePreset === 'week') {
            const nowBkk = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
            const dayOfWeek = nowBkk.getDay() || 7 // Monday = 1
            const startOfWeek = new Date(nowBkk)
            startOfWeek.setDate(nowBkk.getDate() - dayOfWeek + 1)
            startOfWeek.setHours(0, 0, 0, 0)

            const endOfWeek = new Date(startOfWeek)
            endOfWeek.setDate(startOfWeek.getDate() + 6)
            endOfWeek.setHours(23, 59, 59, 999)

            const bTime = new Date(bookingTimeStr).getTime()
            return bTime >= startOfWeek.getTime() && bTime <= endOfWeek.getTime()
        }

        if (datePreset === 'month') {
            const currentMonthPrefix = today.slice(0, 7) // "YYYY-MM"
            return bDate.startsWith(currentMonthPrefix)
        }

        if (datePreset === 'custom') {
            return bDate === customDate
        }

        return true
    }, [datePreset, customDate])

    // Date & Channel Scoped Bookings (Used for accurate dynamic KPIs)
    const dateAndTypeFilteredBookings = useMemo(() => {
        return bookings.filter(b => {
            const origin = getOrderOrigin(b)

            const matchesChannel = (() => {
                if (typeFilter === 'all') return true
                if (typeFilter === 'online_all') return origin.isOnline
                if (typeFilter === 'online_booking') return origin.key === 'online_booking'
                if (typeFilter === 'pickup') return origin.key === 'pickup' || origin.key === 'in_house_pickup'
                if (typeFilter === 'shop') return origin.key === 'shop'
                if (typeFilter === 'in_house') return origin.key === 'in_house' || origin.key === 'in_house_pickup' || !origin.isOnline
                if (typeFilter === 'lineman') return origin.key === 'lineman'
                return true
            })()

            const matchesDate = isDateMatch(b.booking_time || b.created_at)
            return matchesChannel && matchesDate
        })
    }, [bookings, typeFilter, isDateMatch])

    // Full Filter & Sort Pipeline (Including Search Term & Status)
    const filteredBookings = useMemo(() => {
        return dateAndTypeFilteredBookings.filter(b => {
            const transfer = parseTableTransferInfo(b, bookings)

            // Status Filter
            const matchesStatus = (() => {
                if (statusFilter === 'all') return true
                if (statusFilter === 'merged') return transfer.isMergedSource || transfer.isMergedTarget
                if (statusFilter === 'cancelled') return (b.status === 'cancelled' || b.status === 'void') && !transfer.isMergedSource
                return b.status === statusFilter
            })()

            // Search Query Match
            const shortId = getShortBookingId(b)
            const customerName = b.pickup_contact_name || b.profiles?.display_name || ''
            const customerPhone = b.pickup_contact_phone || b.profiles?.phone_number || ''
            const tableName = b.tables_layout?.table_name || ''
            const query = searchTerm.toLowerCase().trim()

            const isTransferMatch = query && (
                ((query.includes('รวม') || query.includes('merge')) && (transfer.isMergedSource || transfer.isMergedTarget)) ||
                (transfer.mergedToTable && transfer.mergedToTable.toLowerCase().includes(query)) ||
                (transfer.mergedToBillId && transfer.mergedToBillId.toLowerCase().includes(query)) ||
                (transfer.mergedFromTables && transfer.mergedFromTables.some(t => t.toLowerCase().includes(query))) ||
                (transfer.mergedFromBillIds && transfer.mergedFromBillIds.some(id => id.toLowerCase().includes(query))) ||
                (transfer.movedFromTable && transfer.movedFromTable.toLowerCase().includes(query)) ||
                (transfer.movedToTable && transfer.movedToTable.toLowerCase().includes(query))
            )

            const matchesSearch = !query ||
                customerName.toLowerCase().includes(query) ||
                customerPhone.includes(query) ||
                (b.id || '').toLowerCase().includes(query) ||
                (b.tracking_token || '').toLowerCase().includes(query) ||
                shortId.includes(query.toUpperCase()) ||
                tableName.toLowerCase().includes(query) ||
                isTransferMatch

            return matchesStatus && matchesSearch
        }).sort((a, b) => {
            let aValue = a[sortConfig.key]
            let bValue = b[sortConfig.key]

            if (sortConfig.key === 'customer') {
                aValue = a.pickup_contact_name || a.profiles?.display_name || ''
                bValue = b.pickup_contact_name || b.profiles?.display_name || ''
            } else if (sortConfig.key === 'total') {
                aValue = Number(a.total_amount || 0)
                bValue = Number(b.total_amount || 0)
            } else if (sortConfig.key === 'booking_time') {
                aValue = new Date(a.booking_time || a.created_at).getTime()
                bValue = new Date(b.booking_time || b.created_at).getTime()
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
            return 0
        })
    }, [dateAndTypeFilteredBookings, bookings, statusFilter, searchTerm, sortConfig])

    // Dynamic KPI Summary Metrics Scoped to Current Filter Window with Channel Breakdown
    const kpiSummary = useMemo(() => {
        let totalRevenue = 0
        let onlineRevenue = 0
        let inHouseRevenue = 0
        let pendingCount = 0
        let activeQueueCount = 0
        let completedCount = 0
        let depositTotal = 0
        let onlineCount = 0
        let inHouseCount = 0

        dateAndTypeFilteredBookings.forEach(b => {
            const origin = getOrderOrigin(b)
            if (origin.isOnline) onlineCount++
            else inHouseCount++

            if (b.status === 'pending') pendingCount++
            if (b.status === 'confirmed' || b.status === 'seated' || b.status === 'preparing' || b.status === 'ready') {
                activeQueueCount++
            }
            if (b.status === 'completed' || b.status === 'paid') {
                completedCount++
                const amt = Number(b.total_amount || 0)
                totalRevenue += amt
                if (origin.isOnline) onlineRevenue += amt
                else inHouseRevenue += amt
            }
            // Exclude cancelled/void orders from deposits collected
            if (b.deposit_amount && b.status !== 'cancelled' && b.status !== 'void') {
                depositTotal += Number(b.deposit_amount || 0)
            }
        })

        return {
            totalRevenue,
            onlineRevenue,
            inHouseRevenue,
            pendingCount,
            activeQueueCount,
            completedCount,
            depositTotal,
            onlineCount,
            inHouseCount
        }
    }, [dateAndTypeFilteredBookings])

    // Status Count helper for badges within active date/channel window
    const statusCounts = useMemo(() => {
        const counts = { all: dateAndTypeFilteredBookings.length, merged: 0 }
        dateAndTypeFilteredBookings.forEach(b => {
            const transfer = parseTableTransferInfo(b, bookings)
            if (transfer.isMergedSource || transfer.isMergedTarget) {
                counts.merged = (counts.merged || 0) + 1
            }
            counts[b.status] = (counts[b.status] || 0) + 1
        })
        return counts
    }, [dateAndTypeFilteredBookings, bookings])

    const getStatusBadgeClass = (st) => {
        switch (st) {
            case 'pending':
                return 'bg-[var(--color-paper-2)] text-[var(--color-accent)] border-[var(--color-accent)]'
            case 'confirmed':
                return 'bg-[var(--color-paper-2)] text-[var(--color-accent-2)] border-[var(--color-accent-2)]'
            case 'seated':
                return 'bg-[var(--color-paper-2)] text-[var(--color-ink)] border-[var(--color-ink)]'
            case 'preparing':
                return 'bg-[var(--color-paper-2)] text-[var(--color-accent)] border-[var(--color-rule)]'
            case 'ready':
                return 'bg-[var(--color-paper-2)] text-[var(--color-accent-2)] border-[var(--color-accent-2)]'
            case 'completed':
            case 'paid':
                return 'bg-[var(--color-paper)] text-[var(--color-muted)] border-[var(--color-rule)]'
            case 'cancelled':
            case 'void':
                return 'bg-[var(--color-paper-2)] text-[var(--color-neutral)] border-[var(--color-rule)] line-through'
            default:
                return 'bg-[var(--color-paper-2)] text-[var(--color-neutral)] border-[var(--color-rule)]'
        }
    }

    const getDateLabel = () => {
        if (datePreset === 'today') return 'TODAY'
        if (datePreset === 'tomorrow') return 'TOMORROW'
        if (datePreset === 'week') return 'THIS WEEK'
        if (datePreset === 'month') return 'THIS MONTH'
        if (datePreset === 'custom') return customDate
        return 'ALL TIME'
    }

    return (
        <div className="max-w-7xl mx-auto pb-24 font-mono text-xs">
            {/* 1. Header Block (Dieter Rams Tabular Header) */}
            <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 border-b border-[var(--color-rule)]">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold tracking-wider text-[var(--color-accent)] uppercase bg-[var(--color-paper-2)] px-2 py-0.5 border border-[var(--color-rule)]">
                                SYS.ADMIN · 2026
                            </span>
                            <span className="text-[10px] text-[var(--color-neutral)]">
                                {bookings.length} TOTAL IN MEMORY · SCOPE: {getDateLabel()}
                            </span>
                        </div>
                        <h1 className="text-xl md:text-2xl font-bold text-[var(--color-ink)] tracking-tight mt-1 uppercase">
                            Bookings & Orders Hub
                        </h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <button 
                            type="button"
                            onClick={() => fetchBookings(true)} 
                            disabled={loading}
                            className="px-4 py-2 bg-[var(--color-ink)] hover:opacity-90 text-[var(--color-paper)] font-bold uppercase transition-opacity flex items-center gap-2 border border-[var(--color-ink)]"
                        >
                            <span>{loading ? 'SYNCING…' : 'REFRESH'}</span>
                        </button>
                    </div>
                </div>

                {/* 2. Integrated KPI Instrument Strip (Connected Cellular Grid with Channel Breakdown) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-[var(--color-rule)] bg-[var(--color-paper)]">
                    <div className="p-4">
                        <div className="text-[10px] uppercase text-[var(--color-neutral)] font-bold">TOTAL REVENUE (PAID)</div>
                        <div className="text-lg md:text-xl font-bold text-[var(--color-ink)] tabular-nums mt-1">
                            ฿{formatCurrency(kpiSummary.totalRevenue)}
                        </div>
                        <div className="text-[10px] text-[var(--color-accent-2)] mt-0.5 font-bold">
                            {kpiSummary.completedCount} Orders (Online: ฿{formatCurrency(kpiSummary.onlineRevenue)} · In-House: ฿{formatCurrency(kpiSummary.inHouseRevenue)})
                        </div>
                    </div>

                    <div className="p-4">
                        <div className="text-[10px] uppercase text-[var(--color-accent)] font-bold">PENDING INBOX</div>
                        <div className="text-lg md:text-xl font-bold text-[var(--color-accent)] tabular-nums mt-1">
                            {String(kpiSummary.pendingCount).padStart(2, '0')}
                        </div>
                        <div className="text-[10px] text-[var(--color-neutral)] mt-0.5">
                            Requires Immediate Action
                        </div>
                    </div>

                    <div className="p-4">
                        <div className="text-[10px] uppercase text-[var(--color-neutral)] font-bold">ACTIVE SERVICE QUEUE</div>
                        <div className="text-lg md:text-xl font-bold text-[var(--color-ink)] tabular-nums mt-1">
                            {String(kpiSummary.activeQueueCount).padStart(2, '0')}
                        </div>
                        <div className="text-[10px] text-[var(--color-neutral)] mt-0.5">
                            Confirmed, Seated & In-House Dining
                        </div>
                    </div>

                    <div className="p-4">
                        <div className="text-[10px] uppercase text-[var(--color-neutral)] font-bold">DEPOSITS COLLECTED</div>
                        <div className="text-lg md:text-xl font-bold text-[var(--color-ink)] tabular-nums mt-1">
                            ฿{formatCurrency(kpiSummary.depositTotal)}
                        </div>
                        <div className="text-[10px] text-[var(--color-neutral)] mt-0.5">
                            Active Online Advance Deposits
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Multi-Tier Control Panel (Modular Integrated Rows) */}
            <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] divide-y divide-[var(--color-rule)] mb-4">
                {/* Row 1: Search & Date Presets */}
                <div className="p-3 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
                    {/* Search Field */}
                    <div className="relative flex-1 flex items-center border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-2.5 py-1.5">
                        <span className="text-[10px] text-[var(--color-neutral)] font-bold uppercase mr-2 tracking-wider">
                            SEARCH:
                        </span>
                        <input
                            type="text"
                            placeholder="Customer Name, Phone, #ID, Table…"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-transparent text-xs text-[var(--color-ink)] placeholder:text-[var(--color-neutral)] focus:outline-none"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="text-[var(--color-neutral)] hover:text-[var(--color-ink)] text-xs font-bold pl-2"
                            >
                                [✕]
                            </button>
                        )}
                    </div>

                    {/* Date Presets */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                        <span className="text-[10px] uppercase text-[var(--color-neutral)] font-bold pr-1">DATE:</span>
                        {[
                            { key: 'today', label: 'TODAY' },
                            { key: 'tomorrow', label: 'TOMORROW' },
                            { key: 'week', label: 'THIS WEEK' },
                            { key: 'month', label: 'THIS MONTH' },
                            { key: 'all', label: 'ALL TIME' }
                        ].map(d => (
                            <button
                                key={d.key}
                                type="button"
                                onClick={() => setDatePreset(d.key)}
                                className={`px-2.5 py-1.5 font-bold uppercase tracking-wider text-[11px] border transition-colors ${
                                    datePreset === d.key
                                        ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)]'
                                        : 'bg-[var(--color-paper-2)] text-[var(--color-muted)] border-[var(--color-rule)] hover:bg-[var(--color-paper)]'
                                }`}
                            >
                                {d.label}
                            </button>
                        ))}

                        {/* Custom Date Input */}
                        <input
                            type="date"
                            value={customDate}
                            onChange={(e) => {
                                setCustomDate(e.target.value)
                                setDatePreset('custom')
                            }}
                            className={`px-2 py-1 bg-[var(--color-paper-2)] border text-xs font-mono ${
                                datePreset === 'custom'
                                    ? 'border-[var(--color-accent)] text-[var(--color-ink)] font-bold'
                                    : 'border-[var(--color-rule)] text-[var(--color-neutral)]'
                            }`}
                        />
                    </div>
                </div>

                {/* Row 2: Status Tabs */}
                <div className="p-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    <span className="text-[10px] uppercase text-[var(--color-neutral)] font-bold pr-1">STATUS:</span>
                    {[
                        { key: 'all', label: 'ALL' },
                        { key: 'pending', label: 'PENDING' },
                        { key: 'confirmed', label: 'CONFIRMED' },
                        { key: 'seated', label: 'SEATED' },
                        { key: 'preparing', label: 'PREPARING' },
                        { key: 'ready', label: 'READY' },
                        { key: 'completed', label: 'COMPLETED' },
                        { key: 'merged', label: 'MERGED (รวมโต๊ะ)' },
                        { key: 'cancelled', label: 'CANCELLED' }
                    ].map(st => {
                        const count = statusCounts[st.key] || 0
                        return (
                            <button
                                key={st.key}
                                type="button"
                                onClick={() => setStatusFilter(st.key)}
                                className={`px-2.5 py-1 font-bold uppercase text-[11px] border flex items-center gap-1.5 transition-colors ${
                                    statusFilter === st.key
                                        ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)]'
                                        : 'bg-[var(--color-paper-2)] text-[var(--color-muted)] border-[var(--color-rule)] hover:bg-[var(--color-paper)]'
                                }`}
                            >
                                <span>{st.label}</span>
                                {count > 0 && (
                                    <span className={`px-1 text-[9px] tabular-nums ${
                                        statusFilter === st.key ? 'bg-white/20 text-white' : 'bg-[var(--color-paper)] text-[var(--color-neutral)] border border-[var(--color-rule)]'
                                    }`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* Row 3: Channel & Origin Filter Tabs (Online vs In-Store) */}
                <div className="p-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    <span className="text-[10px] uppercase text-[var(--color-neutral)] font-bold pr-1">CHANNEL:</span>
                    {[
                        { key: 'all', label: 'ALL CHANNELS' },
                        { key: 'online_all', label: 'ALL ONLINE (BOOKING, PICKUP, SHOP, LINE MAN)' },
                        { key: 'online_booking', label: 'ONLINE RESERVATION' },
                        { key: 'pickup', label: 'PICKUP / TAKEAWAY' },
                        { key: 'shop', label: 'HAUSMADE SHOP (PARCEL)' },
                        { key: 'in_house', label: 'IN-HOUSE (DINE-IN & TAKEAWAY)' },
                        { key: 'lineman', label: 'LINE MAN DELIVERY' }
                    ].map(tp => (
                        <button
                            key={tp.key}
                            type="button"
                            onClick={() => setTypeFilter(tp.key)}
                            className={`px-2.5 py-1 font-bold uppercase text-[10px] border transition-colors ${
                                typeFilter === tp.key
                                    ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                                    : 'bg-[var(--color-paper-2)] text-[var(--color-muted)] border-[var(--color-rule)] hover:bg-[var(--color-paper)]'
                            }`}
                        >
                            {tp.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 4. Batch Action Bar */}
            {selectedIds.length > 0 && (
                <div className="mb-4 p-3 bg-[var(--color-paper-2)] border border-[var(--color-accent)] flex items-center justify-between gap-4 shadow-sm">
                    <span className="text-[var(--color-accent)] font-bold pl-2">
                        {selectedIds.length} ORDERS SELECTED
                    </span>
                    
                    {(() => {
                        const validDeletable = bookings.filter(b => selectedIds.includes(b.id) && (b.status === 'completed' || b.status === 'cancelled' || b.status === 'void'))
                        
                        if (validDeletable.length === 0) return (
                            <div className="text-[11px] text-[var(--color-neutral)]">
                                Only Completed/Cancelled orders can be deleted
                            </div>
                        )

                        return (
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase text-[var(--color-accent)] font-bold tracking-wider">
                                    Hold 5s to Delete ({validDeletable.length})
                                </span>
                                <HoldToDeleteButton 
                                    onConfirm={() => executeDelete(validDeletable)}
                                    className="px-3 py-1.5 bg-[var(--color-paper)] text-[var(--color-accent)] border border-[var(--color-accent)] hover:bg-[var(--color-paper-2)] font-bold text-xs shadow-sm transition-colors"
                                />
                            </div>
                        )
                    })()}
                </div>
            )}

            {/* 5. Main Tabular Grid */}
            <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse font-mono text-xs">
                        <thead>
                            <tr className="bg-[var(--color-paper-2)] text-[10px] uppercase text-[var(--color-muted)] font-bold tracking-wider border-b border-[var(--color-rule)]">
                                <th className="p-3 w-10 text-center border-r border-[var(--color-rule)]">
                                    <input 
                                        type="checkbox" 
                                        className="border-[var(--color-rule)] checked:bg-[var(--color-ink)] focus:ring-0 cursor-pointer"
                                        checked={filteredBookings.length > 0 && selectedIds.length === filteredBookings.length}
                                        onChange={() => toggleSelectAll(filteredBookings)}
                                    />
                                </th>
                                <th className="p-3 cursor-pointer hover:text-[var(--color-ink)] transition-colors border-r border-[var(--color-rule)]" onClick={() => handleSort('booking_time')}>
                                    <div className="flex items-center gap-1">
                                        <span>DATE & TIME</span>
                                        <span className="text-[9px] text-[var(--color-accent)]">
                                            {sortConfig.key === 'booking_time' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '·'}
                                        </span>
                                    </div>
                                </th>
                                <th className="p-3 border-r border-[var(--color-rule)]">CHANNEL / TABLE</th>
                                <th className="p-3 cursor-pointer hover:text-[var(--color-ink)] transition-colors border-r border-[var(--color-rule)]" onClick={() => handleSort('customer')}>
                                    <div className="flex items-center gap-1">
                                        <span>CUSTOMER</span>
                                        <span className="text-[9px] text-[var(--color-accent)]">
                                            {sortConfig.key === 'customer' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '·'}
                                        </span>
                                    </div>
                                </th>
                                <th className="p-3 cursor-pointer hover:text-[var(--color-ink)] transition-colors border-r border-[var(--color-rule)]" onClick={() => handleSort('total')}>
                                    <div className="flex items-center gap-1">
                                        <span>ORDER & VALUE</span>
                                        <span className="text-[9px] text-[var(--color-accent)]">
                                            {sortConfig.key === 'total' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '·'}
                                        </span>
                                    </div>
                                </th>
                                <th className="p-3 border-r border-[var(--color-rule)]">STATUS</th>
                                <th className="p-3 pr-4 text-right">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-rule)]">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="p-12 text-center text-[var(--color-neutral)] font-bold">
                                        LOADING BOOKING RECORDS…
                                    </td>
                                </tr>
                            ) : filteredBookings.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="p-12 text-center">
                                        <div className="flex flex-col items-center gap-2 text-[var(--color-neutral)]">
                                            <div className="border border-[var(--color-rule)] px-2.5 py-1 text-xs font-bold">
                                                [ Ø ] NO RECORDS FOUND
                                            </div>
                                            <p className="font-bold text-[var(--color-ink)]">No bookings match the selected criteria.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredBookings.map(booking => {
                                    const isExpanded = expandedIds.has(booking.id)
                                    const shortId = getShortBookingId(booking)
                                    const origin = getOrderOrigin(booking)
                                    const isDineIn = booking.booking_type === 'dine_in' || booking.booking_type === 'walk_in'
                                    const customerName = booking.pickup_contact_name || booking.profiles?.display_name || 'Guest Customer'
                                    const customerPhone = booking.pickup_contact_phone || booking.profiles?.phone_number || '—'
                                    const itemCount = booking.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0
                                    const transfer = parseTableTransferInfo(booking, bookings)

                                    return (
                                        <tr 
                                            key={booking.id} 
                                            className={`hover:bg-[var(--color-paper-2)] transition-colors ${
                                                selectedIds.includes(booking.id) ? 'bg-[var(--color-paper-2)]' : ''
                                            } ${isExpanded ? 'bg-[var(--color-paper-2)]' : ''}`}
                                        >
                                            {/* Checkbox */}
                                            <td className="p-3 text-center border-r border-[var(--color-rule)]">
                                                <input 
                                                    type="checkbox" 
                                                    className="border-[var(--color-rule)] checked:bg-[var(--color-ink)] focus:ring-0 cursor-pointer"
                                                    checked={selectedIds.includes(booking.id)}
                                                    onChange={() => toggleSelect(booking.id)}
                                                />
                                            </td>

                                            {/* Date & Time */}
                                            <td className="p-3 border-r border-[var(--color-rule)]">
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] font-bold bg-[var(--color-paper-2)] px-1.5 py-0.2 border border-[var(--color-rule)] text-[var(--color-ink)]">
                                                            #{shortId}
                                                        </span>
                                                        <span className="font-bold text-xs text-[var(--color-ink)]">
                                                            {formatThaiTimeOnly(booking.booking_time || booking.created_at)}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] text-[var(--color-neutral)]">
                                                        {formatThaiDateOnly(booking.booking_time || booking.created_at)}
                                                    </div>
                                                    {booking.created_at && (
                                                        <div className="text-[9px] text-[var(--color-neutral)]">
                                                            ORDERED: {formatThaiTimeOnly(booking.created_at)}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Channel / Table */}
                                            <td className="p-3 border-r border-[var(--color-rule)]">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className={`px-1.5 py-0.2 text-[9px] font-bold uppercase border ${origin.badgeClass}`}>
                                                            {origin.shortTag}
                                                        </span>
                                                        {isDineIn && (
                                                            <span className="text-[11px] font-bold text-[var(--color-ink)]">
                                                                {booking.tables_layout?.table_name || 'UNASSIGNED'} · {booking.pax || 2}P
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Merged & Transferred Table Indicator Badges */}
                                                    {transfer.isMergedSource && (
                                                        <div className="flex items-center gap-1">
                                                            <span className="px-1.5 py-0.2 bg-[oklch(94%_0.02_28)] text-[oklch(40%_0.16_28)] border border-[oklch(52%_0.16_28)] text-[9px] font-mono font-bold rounded-xs">
                                                                โต๊ะรวม ➔ {transfer.targetTableDisplay || `โต๊ะ ${transfer.mergedToTable}`}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {transfer.isMergedTarget && (
                                                        <div className="flex items-center gap-1">
                                                            <span className="px-1.5 py-0.2 bg-[oklch(92%_0.02_140)] text-[oklch(30%_0.08_140)] border border-[oklch(82%_0.04_140)] text-[9px] font-mono font-bold rounded-xs">
                                                                โต๊ะรวม (+{transfer.mergedFromTableDisplay || transfer.mergedFromTables.join(', ')})
                                                            </span>
                                                        </div>
                                                    )}
                                                    {transfer.isMoved && (
                                                        <div className="flex items-center gap-1">
                                                            <span className="px-1.5 py-0.2 bg-[oklch(92%_0.02_220)] text-[oklch(30%_0.10_220)] border border-[oklch(82%_0.02_220)] text-[9px] font-mono font-bold rounded-xs">
                                                                ย้ายจาก โต๊ะ {transfer.movedFromTable}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {booking.source && (
                                                        <span className="text-[9px] text-[var(--color-neutral)] uppercase tracking-wider">
                                                            VIA: {booking.source}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Customer */}
                                            <td className="p-3 border-r border-[var(--color-rule)]">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-bold text-xs text-[var(--color-ink)] truncate max-w-[160px]">
                                                        {customerName}
                                                    </span>
                                                    <div className="text-[11px] text-[var(--color-muted)]">
                                                        {customerPhone}
                                                    </div>
                                                    {booking.customer_note && (
                                                        <span className="text-[10px] text-[var(--color-accent)] italic truncate max-w-[160px]">
                                                            “{booking.customer_note}”
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Order & Value */}
                                            <td className="p-3 border-r border-[var(--color-rule)] tabular-nums">
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="font-bold text-xs text-[var(--color-ink)]">
                                                        ฿{formatCurrency(booking.total_amount)}
                                                    </div>

                                                    <div className="flex items-center gap-1.5 text-[10px]">
                                                        <span className="text-[var(--color-neutral)]">
                                                            {itemCount > 0 ? `${itemCount} items` : 'Reservation only'}
                                                        </span>

                                                        {booking.deposit_amount > 0 && (
                                                            <span className="bg-[var(--color-paper-2)] text-[var(--color-ink)] px-1 border border-[var(--color-rule)] text-[9px] font-bold">
                                                                DEP: ฿{formatCurrency(booking.deposit_amount)}
                                                            </span>
                                                        )}

                                                        {booking.discount_amount > 0 && (
                                                            <span className="text-[var(--color-accent-2)] text-[9px] font-bold">
                                                                -฿{formatCurrency(booking.discount_amount)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Status Badge */}
                                            <td className="p-3 border-r border-[var(--color-rule)]">
                                                {transfer.isMergedSource ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase border bg-[oklch(94%_0.02_28)] text-[oklch(40%_0.16_28)] border-[oklch(52%_0.16_28)]" title={`บิลนี้รวมเข้ากับ ${transfer.targetTableDisplay || transfer.mergedToTable}`}>
                                                        MERGED (โต๊ะรวม)
                                                    </span>
                                                ) : (
                                                    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase border ${getStatusBadgeClass(booking.status)}`}>
                                                        {booking.status}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="p-3 pr-4 text-right">
                                                <div className="flex justify-end items-center gap-1.5">
                                                    {/* Details Toggle */}
                                                    <button 
                                                        type="button"
                                                        onClick={() => toggleExpand(booking.id)}
                                                        className={`px-2 py-1 border text-[10px] font-bold transition-colors ${
                                                            isExpanded 
                                                                ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)]' 
                                                                : 'bg-[var(--color-paper-2)] hover:bg-[var(--color-paper)] border-[var(--color-rule)] text-[var(--color-ink)]'
                                                        }`}
                                                        title="Toggle Order Details"
                                                    >
                                                        {isExpanded ? '[-] HIDE' : '[+] VIEW'}
                                                    </button>

                                                    {/* Edit Modal Button */}
                                                    <button 
                                                        type="button"
                                                        onClick={() => setEditingBooking(booking)}
                                                        className="px-2 py-1 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] text-[10px] font-bold transition-colors"
                                                        title="Edit Booking"
                                                    >
                                                        [EDIT]
                                                    </button>

                                                    {/* View / Copy Slip as PNG */}
                                                    <button 
                                                        type="button"
                                                        onClick={() => handlePrint(booking, booking.status === 'completed' ? 'receipt' : 'billing')} 
                                                        className="px-2 py-1 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] text-[10px] font-bold transition-colors cursor-pointer" 
                                                        title="Open Slip / Receipt Modal"
                                                    >
                                                        [BILL]
                                                    </button>

                                                    {/* View Payment Slip */}
                                                    {booking.payment_slip_url && (
                                                        <button 
                                                            type="button"
                                                            onClick={() => setViewSlipUrl(booking.payment_slip_url)} 
                                                            className="px-2 py-1 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-accent)] text-[10px] font-bold transition-colors" 
                                                            title="View Payment Slip Image"
                                                        >
                                                            [SLIP]
                                                        </button>
                                                    )}

                                                    {/* Quick Advance Status Actions */}
                                                    {booking.status === 'pending' && (
                                                        <button 
                                                            type="button"
                                                            onClick={() => updateStatus(booking, 'confirmed')}
                                                            className="px-2.5 py-1 bg-[var(--color-ink)] hover:opacity-90 text-[var(--color-paper)] text-[10px] font-bold uppercase transition-opacity"
                                                            title="Accept Order"
                                                        >
                                                            [ACCEPT]
                                                        </button>
                                                    )}

                                                    {booking.status === 'confirmed' && isDineIn && (
                                                        <button 
                                                            type="button"
                                                            onClick={() => updateStatus(booking, 'seated')}
                                                            className="px-2.5 py-1 bg-[var(--color-paper-2)] text-[var(--color-ink)] border border-[var(--color-ink)] text-[10px] font-bold uppercase hover:bg-[var(--color-paper)] transition-colors"
                                                            title="Mark Seated"
                                                        >
                                                            [SEAT]
                                                        </button>
                                                    )}

                                                    {(booking.status === 'confirmed' || booking.status === 'seated' || booking.status === 'ready') && (
                                                        <button 
                                                            type="button"
                                                            onClick={() => updateStatus(booking, 'completed')}
                                                            className="px-2.5 py-1 bg-[var(--color-accent-2)] text-white border border-[var(--color-accent-2)] text-[10px] font-bold uppercase hover:opacity-90 transition-opacity"
                                                            title="Check Out / Complete"
                                                        >
                                                            [COMPLETE]
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Expandable Order Detail Drawer Container (Rendered under table for expanded rows) */}
            {Array.from(expandedIds).map(id => {
                const booking = bookings.find(b => b.id === id)
                if (!booking) return null
                const transfer = parseTableTransferInfo(booking, bookings)

                return (
                    <div key={id} className="mt-2 p-4 bg-[var(--color-paper)] border border-[var(--color-rule)] space-y-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-[var(--color-rule)] pb-3">
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-xs uppercase text-[var(--color-ink)]">
                                    ORDER BREAKDOWN · #{getShortBookingId(booking)}
                                </span>
                                <span className="text-[10px] text-[var(--color-neutral)]">
                                    ORDERED: {formatThaiTime(booking.created_at)} | APPOINTMENT: {formatThaiTime(booking.booking_time)}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                {booking.tracking_token && (
                                    <span className="text-[10px] bg-[var(--color-paper-2)] px-2 py-0.5 border border-[var(--color-rule)] text-[var(--color-muted)]">
                                        TRACKING: {booking.tracking_token}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Table Transfer Banner Strip */}
                        {transfer.isMergedSource && (
                            <div className="p-3 bg-[oklch(94%_0.02_28)] border-2 border-[oklch(52%_0.16_28)] text-[oklch(35%_0.14_28)] text-xs font-mono font-bold space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="px-1.5 py-0.2 bg-[oklch(52%_0.16_28)] text-white text-[9px] uppercase font-black">
                                        MERGED TABLE (โต๊ะรวม)
                                    </span>
                                    <span>บิลนี้ถูกรวมรายการอาหารไปยัง <strong>{transfer.targetTableDisplay || `โต๊ะ ${transfer.mergedToTable}`}</strong> เรียบร้อยแล้ว</span>
                                </div>
                                {transfer.originalTotal > 0 && (
                                    <div className="text-[11px] text-[oklch(45%_0.10_28)] pl-1">
                                        ยอดเงินเดิมก่อนรวมบิล: ฿{formatCurrency(transfer.originalTotal)}
                                    </div>
                                )}
                            </div>
                        )}

                        {transfer.isMergedTarget && (
                            <div className="p-3 bg-[oklch(92%_0.02_140)] border-2 border-[oklch(82%_0.04_140)] text-[oklch(30%_0.08_140)] text-xs font-mono font-bold flex items-center gap-2">
                                <span className="px-1.5 py-0.2 bg-[oklch(45%_0.08_140)] text-white text-[9px] uppercase font-black">
                                    COMBINED TABLE (โต๊ะรวม)
                                </span>
                                <span>บิลนี้เป็นโต๊ะรวมที่รับการรวมรายการอาหารมาจาก <strong>{transfer.mergedFromTableDisplay || transfer.mergedFromTables.join(', ')}</strong></span>
                            </div>
                        )}

                        {transfer.isMoved && (
                            <div className="p-3 bg-[oklch(92%_0.02_220)] border-2 border-[oklch(82%_0.02_220)] text-[oklch(30%_0.10_220)] text-xs font-mono font-bold flex items-center gap-2">
                                <span className="px-1.5 py-0.2 bg-[oklch(40%_0.12_220)] text-white text-[9px] uppercase font-black">
                                    MOVED TABLE (ย้ายโต๊ะ)
                                </span>
                                <span>ลูกค้าย้ายมาจาก <strong>โต๊ะ {transfer.movedFromTable}</strong> {transfer.moveTimestamp && `(${transfer.moveTimestamp})`}</span>
                            </div>
                        )}

                        {/* Items Table */}
                        {booking.order_items && booking.order_items.length > 0 ? (
                            <div className="space-y-2">
                                <div className="grid grid-cols-12 text-[10px] uppercase font-bold text-[var(--color-neutral)] border-b border-[var(--color-rule)] pb-1">
                                    <div className="col-span-6">ITEM / OPTIONS</div>
                                    <div className="col-span-2 text-center">QTY</div>
                                    <div className="col-span-2 text-right">UNIT PRICE</div>
                                    <div className="col-span-2 text-right">LINE TOTAL</div>
                                </div>

                                {booking.order_items.map((item, idx) => {
                                    const optList = formatOptionList(item.selected_options, item.item_note || item.special_instructions || item.notes || item.remark)
                                    const unitPrice = Number(item.price_at_time || 0)
                                    const lineTotal = unitPrice * item.quantity

                                    return (
                                        <div key={idx} className="grid grid-cols-12 text-xs py-1.5 border-b border-[var(--color-rule)] last:border-0 items-start tabular-nums">
                                            <div className="col-span-6">
                                                <div className="font-bold text-[var(--color-ink)]">
                                                    {item.custom_name || item.menu_items?.name || item.name || 'Menu Item'}
                                                </div>
                                                {optList.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {optList.map((opt, oIdx) => (
                                                            <span key={oIdx} className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[10px] text-[var(--color-muted)] px-1.5 py-0.2">
                                                                ▶ {opt}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="col-span-2 text-center font-bold">
                                                x{item.quantity}
                                            </div>
                                            <div className="col-span-2 text-right text-[var(--color-neutral)]">
                                                ฿{formatCurrency(unitPrice)}
                                            </div>
                                            <div className="col-span-2 text-right font-bold text-[var(--color-ink)]">
                                                ฿{formatCurrency(lineTotal)}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="text-xs text-[var(--color-neutral)] italic py-2">
                                Standard Table Reservation (No pre-ordered dishes).
                            </div>
                        )}

                        {/* Notes & Financial Breakdown */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-[var(--color-rule)] text-xs">
                            <div className="space-y-2">
                                {booking.customer_note && (
                                    <div className="p-2.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)]">
                                        <span className="font-bold text-[10px] text-[var(--color-accent)] uppercase block mb-0.5">
                                            CUSTOMER NOTE:
                                        </span>
                                        <p className="text-[var(--color-ink)]">{booking.customer_note}</p>
                                    </div>
                                )}

                                {booking.staff_remark && (
                                    <div className="p-2.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)]">
                                        <span className="font-bold text-[10px] text-[var(--color-muted)] uppercase block mb-0.5">
                                            STAFF INTERNAL REMARK:
                                        </span>
                                        <p className="text-[var(--color-ink)]">{booking.staff_remark}</p>
                                    </div>
                                )}
                            </div>

                            <div className="bg-[var(--color-paper-2)] p-3 border border-[var(--color-rule)] space-y-1.5 text-xs font-mono tabular-nums">
                                <div className="flex justify-between text-[var(--color-muted)]">
                                    <span>SUBTOTAL:</span>
                                    <span>฿{formatCurrency(Number(booking.total_amount || 0) + Number(booking.discount_amount || 0))}</span>
                                </div>
                                {booking.discount_amount > 0 && (
                                    <div className="flex justify-between text-[var(--color-accent-2)] font-bold">
                                        <span>DISCOUNT ({booking.promotion_codes?.code || 'PROMO'}):</span>
                                        <span>-฿{formatCurrency(booking.discount_amount)}</span>
                                    </div>
                                )}
                                {booking.deposit_amount > 0 && (
                                    <div className="flex justify-between text-[var(--color-ink)] font-bold">
                                        <span>ADVANCE DEPOSIT PAID:</span>
                                        <span>-฿{formatCurrency(booking.deposit_amount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between font-bold text-sm text-[var(--color-ink)] pt-2 border-t border-[var(--color-rule)]">
                                    <span>FINAL AMOUNT DUE:</span>
                                    <span>฿{formatCurrency(Math.max(0, Number(booking.total_amount || 0) - Number(booking.deposit_amount || 0)))}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}

            {/* Edit Booking Modal */}
            {editingBooking && (
                <EditBookingModal 
                    booking={editingBooking}
                    tablesList={tablesList}
                    onClose={() => setEditingBooking(null)}
                    onSave={handleSaveEdit}
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
                    url={viewSlipUrl.startsWith('http') ? viewSlipUrl : supabase.storage.from('slips').getPublicUrl(viewSlipUrl).data.publicUrl} 
                    onClose={() => setViewSlipUrl(null)} 
                />
            )}
        </div>
    )
}

// ----------------------------------------------------
// EDIT BOOKING MODAL (Dieter Rams Clean Minimalist Form)
// ----------------------------------------------------
function EditBookingModal({ booking, tablesList, onClose, onSave }) {
    const transfer = parseTableTransferInfo(booking)
    const [tableName, setTableName] = useState(booking.table_id || '')
    const [pax, setPax] = useState(booking.pax || 2)
    const [bookingDate, setBookingDate] = useState(() => {
        if (booking.booking_time) {
            return new Date(booking.booking_time).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
        }
        return getThaiDate()
    })
    const [bookingTime, setBookingTime] = useState(() => {
        if (booking.booking_time) {
            return new Date(booking.booking_time).toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })
        }
        return '18:00'
    })
    const [contactName, setContactName] = useState(booking.pickup_contact_name || booking.profiles?.display_name || '')
    const [contactPhone, setContactPhone] = useState(booking.pickup_contact_phone || booking.profiles?.phone_number || '')
    const [customerNote, setCustomerNote] = useState(booking.customer_note || '')
    const [staffRemark, setStaffRemark] = useState(booking.staff_remark || '')
    const [status, setStatus] = useState(booking.status || 'pending')
    const [totalAmount, setTotalAmount] = useState(booking.total_amount || 0)
    const [depositAmount, setDepositAmount] = useState(booking.deposit_amount || 0)
    const [saving, setSaving] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)

        // Construct ISO Timestamp with explicit Thailand offset (+07:00)
        const cleanTime = String(bookingTime).trim().replace('.', ':')
        const isoString = `${bookingDate}T${cleanTime}:00+07:00`

        await onSave({
            table_id: tableName || null,
            pax: Number(pax),
            booking_time: isoString,
            pickup_contact_name: contactName,
            pickup_contact_phone: contactPhone,
            customer_note: customerNote,
            staff_remark: staffRemark,
            status,
            total_amount: Number(totalAmount),
            deposit_amount: Number(depositAmount)
        })

        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[var(--color-paper)] border-2 border-[var(--color-rule)] max-w-xl w-full p-6 font-mono text-xs shadow-2xl">
                {/* Header */}
                <div className="flex justify-between items-center pb-4 mb-4 border-b border-[var(--color-rule)]">
                    <div>
                        <span className="text-[10px] font-bold text-[var(--color-accent)] uppercase tracking-wider block">
                            EDIT RECORD · #{getShortBookingId(booking)}
                        </span>
                        <h2 className="text-base font-bold text-[var(--color-ink)] uppercase mt-0.5">
                            Modify Reservation & Order
                        </h2>
                    </div>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="px-2 py-1 text-[var(--color-neutral)] hover:text-[var(--color-ink)] border border-[var(--color-rule)] bg-[var(--color-paper-2)] font-bold text-xs"
                    >
                        [✕]
                    </button>
                </div>

                {/* Transfer Info Banner if Merged / Moved */}
                {transfer.isMergedSource && (
                    <div className="mb-4 p-2.5 bg-[oklch(94%_0.02_28)] border border-[oklch(52%_0.16_28)] text-[oklch(35%_0.14_28)] text-xs font-mono font-bold">
                        ⚠️ โต๊ะรวม: บิลนี้โอนรายการอาหารไปยัง <strong>{transfer.targetTableDisplay || `โต๊ะ ${transfer.mergedToTable}`}</strong> เรียบร้อยแล้ว
                    </div>
                )}
                {transfer.isMergedTarget && (
                    <div className="mb-4 p-2.5 bg-[oklch(92%_0.02_140)] border border-[oklch(82%_0.04_140)] text-[oklch(30%_0.08_140)] text-xs font-mono font-bold">
                        🔗 โต๊ะรวม: บิลนี้รวมรายการอาหารมาจาก <strong>{transfer.mergedFromTableDisplay || transfer.mergedFromTables.join(', ')}</strong>
                    </div>
                )}
                {transfer.isMoved && (
                    <div className="mb-4 p-2.5 bg-[oklch(92%_0.02_220)] border border-[oklch(82%_0.02_220)] text-[oklch(30%_0.10_220)] text-xs font-mono font-bold">
                        🔄 ย้ายโต๊ะ: ลูกค้าย้ายมาจาก <strong>โต๊ะ {transfer.movedFromTable}</strong>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Grid: Table & Pax */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                                ASSIGNED TABLE
                            </label>
                            <select
                                value={tableName}
                                onChange={(e) => setTableName(e.target.value)}
                                className="w-full p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-mono font-bold focus:outline-none focus:border-[var(--color-accent)]"
                            >
                                <option value="">— UNASSIGNED —</option>
                                {tablesList.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.table_name} (Cap: {t.capacity}P)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                                GUESTS (PAX)
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="50"
                                value={pax}
                                onChange={(e) => setPax(e.target.value)}
                                className="w-full p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-mono font-bold focus:outline-none focus:border-[var(--color-accent)] tabular-nums"
                            />
                        </div>
                    </div>

                    {/* Grid: Date & Time */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                                SERVICE DATE
                            </label>
                            <input
                                type="date"
                                required
                                value={bookingDate}
                                onChange={(e) => setBookingDate(e.target.value)}
                                className="w-full p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-mono font-bold focus:outline-none focus:border-[var(--color-accent)]"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                                SERVICE TIME (HH:MM)
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="18:00"
                                value={bookingTime}
                                onChange={(e) => setBookingTime(e.target.value)}
                                className="w-full p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-mono font-bold focus:outline-none focus:border-[var(--color-accent)] tabular-nums"
                            />
                        </div>
                    </div>

                    {/* Grid: Customer Contact */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                                CUSTOMER NAME
                            </label>
                            <input
                                type="text"
                                value={contactName}
                                onChange={(e) => setContactName(e.target.value)}
                                className="w-full p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-mono font-bold focus:outline-none focus:border-[var(--color-accent)]"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                                PHONE NUMBER
                            </label>
                            <input
                                type="text"
                                value={contactPhone}
                                onChange={(e) => setContactPhone(e.target.value)}
                                className="w-full p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-mono font-bold focus:outline-none focus:border-[var(--color-accent)] tabular-nums"
                            />
                        </div>
                    </div>

                    {/* Status & Financial Adjustments */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                                STATUS
                            </label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-mono font-bold focus:outline-none focus:border-[var(--color-accent)] uppercase"
                            >
                                <option value="pending">PENDING</option>
                                <option value="confirmed">CONFIRMED</option>
                                <option value="seated">SEATED</option>
                                <option value="preparing">PREPARING</option>
                                <option value="ready">READY</option>
                                <option value="completed">COMPLETED</option>
                                <option value="cancelled">CANCELLED</option>
                                <option value="void">VOID</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                                TOTAL AMOUNT (฿)
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={totalAmount}
                                onChange={(e) => setTotalAmount(e.target.value)}
                                className="w-full p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-mono font-bold focus:outline-none focus:border-[var(--color-accent)] tabular-nums"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                                DEPOSIT PAID (฿)
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={depositAmount}
                                onChange={(e) => setDepositAmount(e.target.value)}
                                className="w-full p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-mono font-bold focus:outline-none focus:border-[var(--color-accent)] tabular-nums"
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <div>
                            <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                                CUSTOMER NOTE
                            </label>
                            <input
                                type="text"
                                placeholder="Customer's dietary or seating requests"
                                value={customerNote}
                                onChange={(e) => setCustomerNote(e.target.value)}
                                className="w-full p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-mono focus:outline-none focus:border-[var(--color-accent)]"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                                STAFF INTERNAL REMARK
                            </label>
                            <textarea
                                rows={2}
                                placeholder="Internal instructions for kitchen / cashier"
                                value={staffRemark}
                                onChange={(e) => setStaffRemark(e.target.value)}
                                className="w-full p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-mono focus:outline-none focus:border-[var(--color-accent)]"
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-rule)]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-[var(--color-rule)] bg-[var(--color-paper-2)] hover:bg-[var(--color-paper)] text-[var(--color-ink)] font-bold text-xs uppercase transition-colors"
                        >
                            CANCEL
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-5 py-2 bg-[var(--color-ink)] hover:opacity-90 text-[var(--color-paper)] font-bold text-xs uppercase transition-opacity flex items-center gap-1.5"
                        >
                            {saving ? 'SAVING…' : 'SAVE CHANGES'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
