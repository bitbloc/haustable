/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from './lib/supabaseClient'
import { 
    Search, Calendar, ChevronDown, ChevronUp, Check, X, Phone, User, Clock, 
    Printer, ChefHat, FileText, Trash2, ArrowUpDown, History, Image as ImageIcon, 
    Edit3, RefreshCw, Layers, Filter, CheckCircle, AlertCircle, Eye, Utensils,
    DollarSign, Sparkles
} from 'lucide-react'
import SlipModal from './components/shared/SlipModal'
import ViewSlipModal from './components/shared/ViewSlipModal'
import HoldToDeleteButton from './components/HoldToDeleteButton'
import { formatThaiTimeOnly, formatThaiDateOnly, formatThaiTime, getThaiDate } from './utils/timeUtils'
import { getShortBookingId } from './utils/printerHelper'
import { toast } from 'sonner'

// Helper to format item options into clean human-readable tags
function formatOptionList(options) {
    if (!options) return []
    if (Array.isArray(options)) {
        return options.map(opt => {
            if (typeof opt === 'object' && opt !== null) {
                if (opt.group_name && opt.name) {
                    const priceStr = opt.price && Number(opt.price) > 0 ? ` (+฿${opt.price})` : ''
                    return `${opt.group_name}: ${opt.name}${priceStr}`
                }
                if (opt.name) {
                    const priceStr = opt.price && Number(opt.price) > 0 ? ` (+฿${opt.price})` : ''
                    return `${opt.name}${priceStr}`
                }
                return JSON.stringify(opt)
            }
            return String(opt)
        })
    }
    if (typeof options === 'object' && options !== null) {
        return Object.entries(options).flatMap(([key, val]) => {
            if (Array.isArray(val)) return val.map(v => `${key}: ${v}`)
            return [`${key}: ${val}`]
        })
    }
    return [String(options)]
}

export default function AdminBookings() {
    const [bookings, setBookings] = useState([])
    const [tablesList, setTablesList] = useState([])
    const [loading, setLoading] = useState(true)

    // Filters
    const [statusFilter, setStatusFilter] = useState('all') // all, pending, confirmed, seated, preparing, ready, completed, cancelled
    const [typeFilter, setTypeFilter] = useState('all') // all, dine_in, pickup, shop
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

    // 1. Initial Load & Real-time Subscription
    useEffect(() => {
        fetchBookings()
        fetchTables()

        const channel = supabase
            .channel('admin-bookings-hub')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
                fetchBookings(false) // Silent refresh without full skeleton
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const fetchTables = async () => {
        try {
            const { data, error } = await supabase
                .from('tables_layout')
                .select('id, table_name, capacity, is_active')
                .order('table_name', { ascending: true })
            if (!error && data) {
                setTablesList(data)
            }
        } catch (e) {
            console.error('Failed to load tables:', e)
        }
    }

    const fetchBookings = async (showLoadingState = true) => {
        if (showLoadingState) setLoading(true)
        try {
            // 1. Fetch Bookings + Table Info + Order Items + Promos
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

            setBookings(merged)
        } catch (err) {
            console.error('Error fetching bookings:', err)
            toast.error('Error loading bookings: ' + err.message)
        } finally {
            if (showLoadingState) setLoading(false)
        }
    }

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
                            date: new Date(booking.booking_time).toLocaleDateString('th-TH'),
                            time: new Date(booking.booking_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
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
                if (storageError) console.warn("Slip deletion warning:", storageError)
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
            setLoading(false)
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

    // Date Filtering Logic
    const isDateMatch = useCallback((bookingTimeStr) => {
        if (!bookingTimeStr) return true
        if (datePreset === 'all') return true

        const bDate = new Date(bookingTimeStr).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
        const today = getThaiDate()

        if (datePreset === 'today') {
            return bDate === today
        }

        if (datePreset === 'tomorrow') {
            const tomorrow = new Date()
            tomorrow.setDate(tomorrow.getDate() + 1)
            const tomorrowStr = tomorrow.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
            return bDate === tomorrowStr
        }

        if (datePreset === 'week') {
            const now = new Date()
            const dayOfWeek = now.getDay() || 7 // Monday = 1
            const startOfWeek = new Date(now)
            startOfWeek.setDate(now.getDate() - dayOfWeek + 1)
            startOfWeek.setHours(0, 0, 0, 0)

            const endOfWeek = new Date(startOfWeek)
            endOfWeek.setDate(startOfWeek.getDate() + 6)
            endOfWeek.setHours(23, 59, 59, 999)

            const bTime = new Date(bookingTimeStr).getTime()
            return bTime >= startOfWeek.getTime() && bTime <= endOfWeek.getTime()
        }

        if (datePreset === 'month') {
            const now = new Date()
            const bDateObj = new Date(bookingTimeStr)
            return bDateObj.getFullYear() === now.getFullYear() && bDateObj.getMonth() === now.getMonth()
        }

        if (datePreset === 'custom') {
            return bDate === customDate
        }

        return true
    }, [datePreset, customDate])

    // Filter & Sort Pipeline
    const filteredBookings = useMemo(() => {
        return bookings.filter(b => {
            // 1. Status Filter
            const matchesStatus = statusFilter === 'all' || b.status === statusFilter

            // 2. Type Filter (Steak removed entirely)
            const matchesType = typeFilter === 'all' 
                || (typeFilter === 'dine_in' && (b.booking_type === 'dine_in' || b.booking_type === 'walk_in'))
                || (typeFilter === 'pickup' && b.booking_type === 'pickup')
                || (typeFilter === 'shop' && (b.booking_type === 'shop' || b.booking_type === 'hausmade_shipping'))
                || b.booking_type === typeFilter

            // 3. Date Filter
            const matchesDate = isDateMatch(b.booking_time || b.created_at)

            // 4. Search Query Match
            const shortId = getShortBookingId(b)
            const customerName = b.pickup_contact_name || b.profiles?.display_name || ''
            const customerPhone = b.pickup_contact_phone || b.profiles?.phone_number || ''
            const tableName = b.tables_layout?.table_name || ''
            const query = searchTerm.toLowerCase().trim()

            const matchesSearch = !query ||
                customerName.toLowerCase().includes(query) ||
                customerPhone.includes(query) ||
                (b.id || '').toLowerCase().includes(query) ||
                (b.tracking_token || '').toLowerCase().includes(query) ||
                shortId.includes(query.toUpperCase()) ||
                tableName.toLowerCase().includes(query)

            return matchesStatus && matchesType && matchesDate && matchesSearch
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
    }, [bookings, statusFilter, typeFilter, isDateMatch, searchTerm, sortConfig])

    // KPI Summary Metrics
    const kpiSummary = useMemo(() => {
        let totalRevenue = 0
        let pendingCount = 0
        let confirmedCount = 0
        let completedCount = 0
        let depositTotal = 0

        bookings.forEach(b => {
            if (b.status === 'pending') pendingCount++
            if (b.status === 'confirmed' || b.status === 'seated' || b.status === 'preparing' || b.status === 'ready') confirmedCount++
            if (b.status === 'completed' || b.status === 'paid') {
                completedCount++
                totalRevenue += Number(b.total_amount || 0)
            }
            if (b.deposit_amount) {
                depositTotal += Number(b.deposit_amount || 0)
            }
        })

        return {
            totalRevenue,
            pendingCount,
            confirmedCount,
            completedCount,
            depositTotal
        }
    }, [bookings])

    // Status Count helper for badges
    const statusCounts = useMemo(() => {
        const counts = { all: bookings.length }
        bookings.forEach(b => {
            counts[b.status] = (counts[b.status] || 0) + 1
        })
        return counts
    }, [bookings])

    const getStatusStyle = (st) => {
        switch (st) {
            case 'pending':
                return 'bg-[oklch(94%_0.02_28)] text-[oklch(52%_0.16_28)] border-[oklch(52%_0.16_28)]'
            case 'confirmed':
                return 'bg-[oklch(92%_0.012_140)] text-[oklch(35%_0.08_140)] border-[oklch(82%_0.08_140)]'
            case 'seated':
                return 'bg-[oklch(94%_0.02_220)] text-[oklch(35%_0.10_220)] border-[oklch(82%_0.02_220)]'
            case 'preparing':
                return 'bg-[oklch(94%_0.02_60)] text-[oklch(40%_0.12_60)] border-[oklch(85%_0.05_60)]'
            case 'ready':
                return 'bg-[oklch(90%_0.04_140)] text-[oklch(28%_0.12_140)] border-[oklch(75%_0.10_140)]'
            case 'completed':
            case 'paid':
                return 'bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)]'
            case 'cancelled':
            case 'void':
                return 'bg-[oklch(95%_0.03_25)] text-[oklch(45%_0.18_25)] border-[oklch(80%_0.05_25)]'
            default:
                return 'bg-[oklch(94%_0.010_28)] text-[oklch(55%_0.010_28)] border-[oklch(85%_0.012_28)]'
        }
    }

    return (
        <div className="max-w-7xl mx-auto pb-24 animate-in fade-in duration-200">
            {/* 1. Executive Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[oklch(85%_0.012_28)]">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] bg-[oklch(94%_0.02_28)] px-2 py-0.5 rounded-sm border border-[oklch(85%_0.012_28)]">
                            RESERVATIONS & FULFILLMENT // 2026
                        </span>
                        <span className="font-mono text-[10px] text-[oklch(55%_0.010_28)]">
                            {bookings.length} TOTAL RECORDS
                        </span>
                    </div>
                    <h1 className="font-mono text-2xl md:text-3xl font-bold text-[oklch(18%_0.012_28)] tracking-tight mt-1">
                        BOOKINGS & ORDERS HUB
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        type="button"
                        onClick={() => fetchBookings(true)} 
                        disabled={loading}
                        className="px-3.5 py-2 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(28%_0.012_28)] text-white font-mono text-xs font-bold uppercase rounded-sm flex items-center gap-1.5 transition-colors"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        <span>REFRESH</span>
                    </button>
                </div>
            </div>

            {/* 2. KPI Metrics Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="p-4 bg-[oklch(98%_0.006_28)] border border-[oklch(85%_0.012_28)] rounded-sm">
                    <div className="font-mono text-[10px] uppercase text-[oklch(55%_0.010_28)] font-bold">TOTAL REVENUE (PAID)</div>
                    <div className="font-mono text-xl font-bold text-[oklch(18%_0.012_28)] mt-1">
                        ฿{kpiSummary.totalRevenue.toLocaleString()}
                    </div>
                    <div className="font-mono text-[10px] text-[oklch(45%_0.08_140)] mt-0.5">
                        {kpiSummary.completedCount} Completed Orders
                    </div>
                </div>

                <div className="p-4 bg-[oklch(98%_0.006_28)] border border-[oklch(85%_0.012_28)] rounded-sm">
                    <div className="font-mono text-[10px] uppercase text-[oklch(52%_0.16_28)] font-bold">PENDING INBOX</div>
                    <div className="font-mono text-xl font-bold text-[oklch(52%_0.16_28)] mt-1">
                        {kpiSummary.pendingCount}
                    </div>
                    <div className="font-mono text-[10px] text-[oklch(55%_0.010_28)] mt-0.5">
                        Requires Action
                    </div>
                </div>

                <div className="p-4 bg-[oklch(98%_0.006_28)] border border-[oklch(85%_0.012_28)] rounded-sm">
                    <div className="font-mono text-[10px] uppercase text-[oklch(55%_0.010_28)] font-bold">ACTIVE SERVICE QUEUE</div>
                    <div className="font-mono text-xl font-bold text-[oklch(18%_0.012_28)] mt-1">
                        {kpiSummary.confirmedCount}
                    </div>
                    <div className="font-mono text-[10px] text-[oklch(55%_0.010_28)] mt-0.5">
                        Confirmed & In-House
                    </div>
                </div>

                <div className="p-4 bg-[oklch(98%_0.006_28)] border border-[oklch(85%_0.012_28)] rounded-sm">
                    <div className="font-mono text-[10px] uppercase text-[oklch(55%_0.010_28)] font-bold">DEPOSITS COLLECTED</div>
                    <div className="font-mono text-xl font-bold text-[oklch(35%_0.10_220)] mt-1">
                        ฿{kpiSummary.depositTotal.toLocaleString()}
                    </div>
                    <div className="font-mono text-[10px] text-[oklch(55%_0.010_28)] mt-0.5">
                        Advance Online Deposits
                    </div>
                </div>
            </div>

            {/* 3. Multi-Tier Filter Control Bar */}
            <div className="bg-[oklch(98%_0.006_28)] border border-[oklch(85%_0.012_28)] p-4 rounded-sm space-y-4 mb-6">
                {/* Search & Date Presets */}
                <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
                    {/* Search Field */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-[oklch(55%_0.010_28)] w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search Customer Name, Phone, ID (#ABCD), Table..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] pl-9 pr-4 py-2 rounded-sm text-xs font-mono text-[oklch(18%_0.012_28)] placeholder:text-[oklch(60%_0.010_28)] focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-2.5 text-[oklch(55%_0.010_28)] hover:text-black font-mono text-xs"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Date Range Presets */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar font-mono text-xs">
                        <span className="text-[10px] uppercase text-[oklch(55%_0.010_28)] font-bold pr-1">DATE:</span>
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
                                className={`px-2.5 py-1.5 rounded-sm font-bold uppercase tracking-wider text-[11px] border transition-colors ${
                                    datePreset === d.key
                                        ? 'bg-[oklch(18%_0.012_28)] text-white border-[oklch(18%_0.012_28)]'
                                        : 'bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(90%_0.012_28)]'
                                }`}
                            >
                                {d.label}
                            </button>
                        ))}

                        {/* Custom Date Picker */}
                        <input
                            type="date"
                            value={customDate}
                            onChange={(e) => {
                                setCustomDate(e.target.value)
                                setDatePreset('custom')
                            }}
                            className={`px-2 py-1 bg-[oklch(94%_0.010_28)] border rounded-sm font-mono text-xs ${
                                datePreset === 'custom'
                                    ? 'border-[oklch(52%_0.16_28)] text-[oklch(18%_0.012_28)] font-bold'
                                    : 'border-[oklch(85%_0.012_28)] text-[oklch(55%_0.010_28)]'
                            }`}
                        />
                    </div>
                </div>

                {/* Status Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar font-mono text-xs border-t border-[oklch(90%_0.008_28)] pt-3">
                    <span className="text-[10px] uppercase text-[oklch(55%_0.010_28)] font-bold pr-1">STATUS:</span>
                    {[
                        { key: 'all', label: 'ALL' },
                        { key: 'pending', label: 'PENDING' },
                        { key: 'confirmed', label: 'CONFIRMED' },
                        { key: 'seated', label: 'SEATED' },
                        { key: 'preparing', label: 'PREPARING' },
                        { key: 'ready', label: 'READY' },
                        { key: 'completed', label: 'COMPLETED' },
                        { key: 'cancelled', label: 'CANCELLED' }
                    ].map(st => {
                        const count = statusCounts[st.key] || 0
                        return (
                            <button
                                key={st.key}
                                type="button"
                                onClick={() => setStatusFilter(st.key)}
                                className={`px-2.5 py-1 rounded-sm font-bold uppercase text-[11px] border flex items-center gap-1.5 transition-colors ${
                                    statusFilter === st.key
                                        ? 'bg-[oklch(18%_0.012_28)] text-white border-[oklch(18%_0.012_28)]'
                                        : 'bg-[oklch(97%_0.008_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(92%_0.012_28)]'
                                }`}
                            >
                                <span>{st.label}</span>
                                {count > 0 && (
                                    <span className={`px-1 rounded-sm text-[9px] font-mono ${
                                        statusFilter === st.key ? 'bg-white/20 text-white' : 'bg-[oklch(90%_0.012_28)] text-[oklch(35%_0.010_28)]'
                                    }`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* Type Filter Tabs (Steak completely removed) */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar font-mono text-xs border-t border-[oklch(90%_0.008_28)] pt-3">
                    <span className="text-[10px] uppercase text-[oklch(55%_0.010_28)] font-bold pr-1">TYPE:</span>
                    {[
                        { key: 'all', label: 'ALL TYPES' },
                        { key: 'dine_in', label: 'DINE-IN (TABLE & WALK-IN)' },
                        { key: 'pickup', label: 'PICKUP (TAKEAWAY)' },
                        { key: 'shop', label: 'HAUSMADE SHOP' }
                    ].map(tp => (
                        <button
                            key={tp.key}
                            type="button"
                            onClick={() => setTypeFilter(tp.key)}
                            className={`px-2.5 py-1 rounded-sm font-bold uppercase text-[10px] border transition-colors ${
                                typeFilter === tp.key
                                    ? 'bg-[oklch(52%_0.16_28)] text-white border-[oklch(52%_0.16_28)]'
                                    : 'bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(90%_0.012_28)]'
                            }`}
                        >
                            {tp.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 4. Batch Action Bar */}
            {selectedIds.length > 0 && (
                <div className="mb-4 p-3 bg-[oklch(95%_0.03_25)] border border-[oklch(80%_0.05_25)] rounded-sm flex items-center justify-between font-mono text-xs gap-4 shadow-sm animate-in slide-in-from-top-2">
                    <span className="text-[oklch(45%_0.18_25)] font-bold pl-2">
                        {selectedIds.length} ORDERS SELECTED
                    </span>
                    
                    {(() => {
                        const validDeletable = bookings.filter(b => selectedIds.includes(b.id) && (b.status === 'completed' || b.status === 'cancelled' || b.status === 'void'))
                        
                        if (validDeletable.length === 0) return (
                            <div className="text-[11px] text-[oklch(55%_0.010_28)]">
                                Only Completed/Cancelled orders can be deleted
                            </div>
                        )

                        return (
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase text-[oklch(45%_0.18_25)] font-bold tracking-wider">
                                    Hold 5s to Delete ({validDeletable.length})
                                </span>
                                <HoldToDeleteButton 
                                    onConfirm={() => executeDelete(validDeletable)}
                                    className="px-3 py-1.5 bg-white text-[oklch(45%_0.18_25)] border border-[oklch(80%_0.05_25)] hover:bg-[oklch(95%_0.03_25)] rounded-sm font-bold text-xs shadow-sm transition-colors"
                                />
                            </div>
                        )
                    })()}
                </div>
            )}

            {/* 5. Main Tabular Grid */}
            <div className="bg-[oklch(98%_0.006_28)] border border-[oklch(85%_0.012_28)] rounded-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse font-mono text-xs">
                        <thead>
                            <tr className="bg-[oklch(94%_0.010_28)] text-[10px] uppercase text-[oklch(42%_0.010_28)] font-bold tracking-wider border-b border-[oklch(85%_0.012_28)]">
                                <th className="p-3.5 w-10 text-center">
                                    <input 
                                        type="checkbox" 
                                        className="rounded-sm border-[oklch(80%_0.012_28)] checked:bg-[oklch(18%_0.012_28)] focus:ring-0 cursor-pointer"
                                        checked={filteredBookings.length > 0 && selectedIds.length === filteredBookings.length}
                                        onChange={() => toggleSelectAll(filteredBookings)}
                                    />
                                </th>
                                <th className="p-3.5 cursor-pointer hover:text-black transition-colors" onClick={() => handleSort('booking_time')}>
                                    <div className="flex items-center gap-1">
                                        DATE & TIME
                                        <ArrowUpDown size={11} className={sortConfig.key === 'booking_time' ? 'text-[oklch(52%_0.16_28)]' : 'opacity-30'} />
                                    </div>
                                </th>
                                <th className="p-3.5">TABLE / TYPE</th>
                                <th className="p-3.5 cursor-pointer hover:text-black transition-colors" onClick={() => handleSort('customer')}>
                                    <div className="flex items-center gap-1">
                                        CUSTOMER
                                        <ArrowUpDown size={11} className={sortConfig.key === 'customer' ? 'text-[oklch(52%_0.16_28)]' : 'opacity-30'} />
                                    </div>
                                </th>
                                <th className="p-3.5 cursor-pointer hover:text-black transition-colors" onClick={() => handleSort('total')}>
                                    <div className="flex items-center gap-1">
                                        ORDER & VALUE
                                        <ArrowUpDown size={11} className={sortConfig.key === 'total' ? 'text-[oklch(52%_0.16_28)]' : 'opacity-30'} />
                                    </div>
                                </th>
                                <th className="p-3.5">STATUS</th>
                                <th className="p-3.5 pr-5 text-right">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[oklch(90%_0.008_28)]">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="p-12 text-center text-[oklch(55%_0.010_28)] animate-pulse">
                                        LOADING BOOKING RECORDS...
                                    </td>
                                </tr>
                            ) : filteredBookings.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="p-12 text-center">
                                        <div className="flex flex-col items-center gap-2 text-[oklch(55%_0.010_28)]">
                                            <div className="w-8 h-8 rounded-full border border-[oklch(80%_0.012_28)] flex items-center justify-center text-xs">
                                                Ø
                                            </div>
                                            <p className="font-bold text-[oklch(18%_0.012_28)]">No bookings found for the selected criteria.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredBookings.map(booking => {
                                    const isExpanded = expandedIds.has(booking.id)
                                    const shortId = getShortBookingId(booking)
                                    const isDineIn = booking.booking_type === 'dine_in' || booking.booking_type === 'walk_in'
                                    const customerName = booking.pickup_contact_name || booking.profiles?.display_name || 'Guest Customer'
                                    const customerPhone = booking.pickup_contact_phone || booking.profiles?.phone_number || '-'
                                    const itemCount = booking.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0

                                    return (
                                        <>
                                            <tr 
                                                key={booking.id} 
                                                className={`hover:bg-[oklch(96%_0.006_28)] transition-colors ${
                                                    selectedIds.includes(booking.id) ? 'bg-[oklch(94%_0.02_28)]/40' : ''
                                                } ${isExpanded ? 'bg-[oklch(96%_0.006_28)]' : ''}`}
                                            >
                                                {/* Checkbox */}
                                                <td className="p-3.5 text-center">
                                                    <input 
                                                        type="checkbox" 
                                                        className="rounded-sm border-[oklch(80%_0.012_28)] checked:bg-[oklch(18%_0.012_28)] focus:ring-0 cursor-pointer"
                                                        checked={selectedIds.includes(booking.id)}
                                                        onChange={() => toggleSelect(booking.id)}
                                                    />
                                                </td>

                                                {/* Date & Time */}
                                                <td className="p-3.5">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-mono text-[10px] font-bold bg-[oklch(92%_0.012_28)] px-1.5 py-0.5 rounded-sm border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)]">
                                                                #{shortId}
                                                            </span>
                                                            <span className="font-bold text-sm text-[oklch(18%_0.012_28)]">
                                                                {formatThaiTimeOnly(booking.booking_time || booking.created_at)}
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-[oklch(55%_0.010_28)] flex items-center gap-1">
                                                            <Calendar size={10} />
                                                            <span>{formatThaiDateOnly(booking.booking_time || booking.created_at)}</span>
                                                        </div>
                                                        {booking.created_at && (
                                                            <div className="text-[9px] font-mono text-[oklch(55%_0.010_28)]">
                                                                สั่ง: {formatThaiTimeOnly(booking.created_at)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Table / Type */}
                                                <td className="p-3.5">
                                                    <div className="flex flex-col gap-1">
                                                        {isDineIn ? (
                                                            <span className="inline-flex items-center gap-1 bg-[oklch(92%_0.012_28)] text-[oklch(18%_0.012_28)] px-2 py-0.5 rounded-sm text-[11px] font-bold border border-[oklch(85%_0.012_28)] max-w-fit">
                                                                <Utensils size={11} />
                                                                {booking.tables_layout?.table_name || 'Unassigned'} ({booking.pax || 2}P)
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 bg-[oklch(92%_0.02_220)] text-[oklch(35%_0.10_220)] px-2 py-0.5 rounded-sm text-[10px] font-bold border border-[oklch(82%_0.02_220)] max-w-fit">
                                                                {booking.booking_type?.toUpperCase()}
                                                            </span>
                                                        )}

                                                        {booking.source && (
                                                            <span className="text-[9px] text-[oklch(55%_0.010_28)] uppercase tracking-wider">
                                                                VIA: {booking.source}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Customer */}
                                                <td className="p-3.5">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-sans font-bold text-sm text-[oklch(18%_0.012_28)] truncate max-w-[160px]">
                                                            {customerName}
                                                        </span>
                                                        <div className="flex items-center gap-1 text-[11px] text-[oklch(42%_0.010_28)]">
                                                            <Phone size={10} />
                                                            <span>{customerPhone}</span>
                                                        </div>
                                                        {booking.customer_note && (
                                                            <span className="text-[10px] text-[oklch(52%_0.16_28)] italic truncate max-w-[160px]">
                                                                "{booking.customer_note}"
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Order & Value */}
                                                <td className="p-3.5">
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="font-bold text-sm text-[oklch(18%_0.012_28)]">
                                                            ฿{Number(booking.total_amount || 0).toLocaleString()}
                                                        </div>

                                                        <div className="flex items-center gap-1.5 text-[10px]">
                                                            <span className="text-[oklch(55%_0.010_28)]">
                                                                {itemCount > 0 ? `${itemCount} items` : 'Reservation only'}
                                                            </span>

                                                            {booking.deposit_amount > 0 && (
                                                                <span className="bg-[oklch(92%_0.02_220)] text-[oklch(35%_0.10_220)] px-1 rounded-sm text-[9px] font-bold">
                                                                    DEP: ฿{booking.deposit_amount}
                                                                </span>
                                                            )}

                                                            {booking.discount_amount > 0 && (
                                                                <span className="text-[oklch(45%_0.08_140)] text-[9px] font-bold">
                                                                    -฿{booking.discount_amount}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Status Badge */}
                                                <td className="p-3.5">
                                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase border ${getStatusStyle(booking.status)}`}>
                                                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                                        {booking.status}
                                                    </span>
                                                </td>

                                                {/* Actions */}
                                                <td className="p-3.5 pr-5 text-right">
                                                    <div className="flex justify-end items-center gap-1.5">
                                                        {/* Details Toggle */}
                                                        <button 
                                                            type="button"
                                                            onClick={() => toggleExpand(booking.id)}
                                                            className={`p-1.5 rounded-sm border text-xs font-bold transition-colors ${
                                                                isExpanded 
                                                                    ? 'bg-[oklch(18%_0.012_28)] text-white border-[oklch(18%_0.012_28)]' 
                                                                    : 'bg-[oklch(98%_0.006_28)] hover:bg-[oklch(92%_0.012_28)] border-[oklch(85%_0.012_28)] text-[oklch(35%_0.010_28)]'
                                                            }`}
                                                            title="Toggle Details"
                                                        >
                                                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                                        </button>

                                                        {/* Edit Modal Button */}
                                                        <button 
                                                            type="button"
                                                            onClick={() => setEditingBooking(booking)}
                                                            className="p-1.5 bg-[oklch(98%_0.006_28)] hover:bg-[oklch(92%_0.012_28)] border border-[oklch(85%_0.012_28)] rounded-sm text-[oklch(35%_0.010_28)] transition-colors"
                                                            title="Edit Booking"
                                                        >
                                                            <Edit3 size={13} />
                                                        </button>

                                                        {/* Print Kitchen Slip */}
                                                        <button 
                                                            type="button"
                                                            onClick={() => handlePrint(booking, 'kitchen')} 
                                                            className="p-1.5 bg-[oklch(98%_0.006_28)] hover:bg-[oklch(92%_0.012_28)] border border-[oklch(85%_0.012_28)] rounded-sm text-[oklch(35%_0.010_28)] transition-colors" 
                                                            title="Print Kitchen Slip"
                                                        >
                                                            <ChefHat size={13} />
                                                        </button>

                                                        {/* Print Customer Bill */}
                                                        <button 
                                                            type="button"
                                                            onClick={() => handlePrint(booking, 'customer')} 
                                                            className="p-1.5 bg-[oklch(98%_0.006_28)] hover:bg-[oklch(92%_0.012_28)] border border-[oklch(85%_0.012_28)] rounded-sm text-[oklch(35%_0.010_28)] transition-colors" 
                                                            title="Print Bill / Receipt"
                                                        >
                                                            <Printer size={13} />
                                                        </button>

                                                        {/* View Payment Slip */}
                                                        {booking.payment_slip_url && (
                                                            <button 
                                                                type="button"
                                                                onClick={() => setViewSlipUrl(booking.payment_slip_url)} 
                                                                className="p-1.5 bg-[oklch(92%_0.02_220)] hover:bg-[oklch(88%_0.03_220)] border border-[oklch(82%_0.02_220)] text-[oklch(35%_0.10_220)] rounded-sm transition-colors" 
                                                                title="View Slip"
                                                            >
                                                                <ImageIcon size={13} />
                                                            </button>
                                                        )}

                                                        {/* Quick Advance Status Action */}
                                                        {booking.status === 'pending' && (
                                                            <button 
                                                                type="button"
                                                                onClick={() => updateStatus(booking, 'confirmed')}
                                                                className="px-2 py-1 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(28%_0.012_28)] text-white text-[10px] font-bold uppercase rounded-sm transition-colors"
                                                                title="Accept Order"
                                                            >
                                                                ACCEPT
                                                            </button>
                                                        )}

                                                        {booking.status === 'confirmed' && isDineIn && (
                                                            <button 
                                                                type="button"
                                                                onClick={() => updateStatus(booking, 'seated')}
                                                                className="px-2 py-1 bg-[oklch(92%_0.02_220)] hover:bg-[oklch(88%_0.03_220)] text-[oklch(35%_0.10_220)] border border-[oklch(82%_0.02_220)] text-[10px] font-bold uppercase rounded-sm transition-colors"
                                                                title="Mark Seated"
                                                            >
                                                                SEAT
                                                            </button>
                                                        )}

                                                        {(booking.status === 'confirmed' || booking.status === 'seated' || booking.status === 'ready') && (
                                                            <button 
                                                                type="button"
                                                                onClick={() => updateStatus(booking, 'completed')}
                                                                className="px-2 py-1 bg-[oklch(92%_0.012_140)] hover:bg-[oklch(85%_0.08_140)] text-[oklch(35%_0.08_140)] border border-[oklch(85%_0.08_140)] text-[10px] font-bold uppercase rounded-sm transition-colors"
                                                                title="Check Out / Complete"
                                                            >
                                                                COMPLETE
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Expandable Order Detail Drawer */}
                                            {isExpanded && (
                                                <tr className="bg-[oklch(96%_0.008_28)] border-b border-[oklch(85%_0.012_28)]">
                                                    <td colSpan="7" className="p-4 pl-12">
                                                        <div className="bg-[oklch(98%_0.006_28)] border border-[oklch(85%_0.012_28)] p-4 rounded-sm space-y-4">
                                                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-[oklch(90%_0.008_28)] pb-3">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="font-bold text-xs uppercase text-[oklch(18%_0.012_28)]">
                                                                        ORDER ITEMS & PREFERENCES BREAKDOWN
                                                                    </span>
                                                                    <span className="text-[10px] text-[oklch(55%_0.010_28)]">
                                                                        สั่งเมื่อ: {formatThaiTime(booking.created_at)} | นัดหมาย: {formatThaiTime(booking.booking_time)}
                                                                    </span>
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    {booking.tracking_token && (
                                                                        <span className="font-mono text-[10px] bg-[oklch(92%_0.012_28)] px-2 py-0.5 rounded-sm text-[oklch(42%_0.010_28)]">
                                                                            TRACKING: {booking.tracking_token}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Items Table */}
                                                            {booking.order_items && booking.order_items.length > 0 ? (
                                                                <div className="space-y-2">
                                                                    <div className="grid grid-cols-12 text-[10px] uppercase font-bold text-[oklch(55%_0.010_28)] border-b border-[oklch(90%_0.008_28)] pb-1">
                                                                        <div className="col-span-6">ITEM / OPTIONS</div>
                                                                        <div className="col-span-2 text-center">QTY</div>
                                                                        <div className="col-span-2 text-right">UNIT PRICE</div>
                                                                        <div className="col-span-2 text-right">LINE TOTAL</div>
                                                                    </div>

                                                                    {booking.order_items.map((item, idx) => {
                                                                        const optList = formatOptionList(item.selected_options)
                                                                        const unitPrice = Number(item.price_at_time || 0)
                                                                        const lineTotal = unitPrice * item.quantity

                                                                        return (
                                                                            <div key={idx} className="grid grid-cols-12 text-xs py-1.5 border-b border-[oklch(92%_0.008_28)] last:border-0 items-start">
                                                                                <div className="col-span-6">
                                                                                    <div className="font-bold text-[oklch(18%_0.012_28)]">
                                                                                        {item.menu_items?.name || 'Menu Item'}
                                                                                    </div>
                                                                                    {optList.length > 0 && (
                                                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                                                            {optList.map((opt, oIdx) => (
                                                                                                <span key={oIdx} className="bg-[oklch(94%_0.010_28)] border border-[oklch(88%_0.012_28)] text-[10px] text-[oklch(42%_0.010_28)] px-1.5 py-0.2 rounded-sm">
                                                                                                    ▶ {opt}
                                                                                                </span>
                                                                                            ))}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                <div className="col-span-2 text-center font-bold">
                                                                                    x{item.quantity}
                                                                                </div>
                                                                                <div className="col-span-2 text-right text-[oklch(55%_0.010_28)]">
                                                                                    ฿{unitPrice.toLocaleString()}
                                                                                </div>
                                                                                <div className="col-span-2 text-right font-bold text-[oklch(18%_0.012_28)]">
                                                                                    ฿{lineTotal.toLocaleString()}
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                <div className="text-xs text-[oklch(55%_0.010_28)] italic py-2">
                                                                    Standard Table Reservation (No pre-ordered dishes).
                                                                </div>
                                                            )}

                                                            {/* Notes & Financial Breakdown */}
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-[oklch(90%_0.008_28)] text-xs">
                                                                <div className="space-y-2">
                                                                    {booking.customer_note && (
                                                                        <div className="p-2.5 bg-[oklch(95%_0.012_60)] border border-[oklch(88%_0.02_60)] rounded-sm">
                                                                            <span className="font-bold text-[10px] text-[oklch(30%_0.05_60)] uppercase block mb-0.5">
                                                                                CUSTOMER NOTE:
                                                                            </span>
                                                                            <p className="text-[oklch(30%_0.05_60)]">{booking.customer_note}</p>
                                                                        </div>
                                                                    )}

                                                                    {booking.staff_remark && (
                                                                        <div className="p-2.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-sm">
                                                                            <span className="font-bold text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-0.5">
                                                                                STAFF INTERNAL REMARK:
                                                                            </span>
                                                                            <p className="text-[oklch(18%_0.012_28)]">{booking.staff_remark}</p>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="bg-[oklch(95%_0.008_28)] p-3 rounded-sm border border-[oklch(88%_0.008_28)] space-y-1.5 text-xs font-mono">
                                                                    <div className="flex justify-between text-[oklch(42%_0.010_28)]">
                                                                        <span>SUBTOTAL:</span>
                                                                        <span>฿{Number(booking.total_amount || 0) + Number(booking.discount_amount || 0)}</span>
                                                                    </div>
                                                                    {booking.discount_amount > 0 && (
                                                                        <div className="flex justify-between text-[oklch(45%_0.08_140)]">
                                                                            <span>DISCOUNT ({booking.promotion_codes?.code || 'PROMO'}):</span>
                                                                            <span>-฿{booking.discount_amount}</span>
                                                                        </div>
                                                                    )}
                                                                    {booking.deposit_amount > 0 && (
                                                                        <div className="flex justify-between text-[oklch(35%_0.10_220)]">
                                                                            <span>ADVANCE DEPOSIT PAID:</span>
                                                                            <span>-฿{booking.deposit_amount}</span>
                                                                        </div>
                                                                    )}
                                                                    <div className="flex justify-between font-bold text-sm text-[oklch(18%_0.012_28)] pt-2 border-t border-[oklch(85%_0.012_28)]">
                                                                        <span>FINAL AMOUNT DUE:</span>
                                                                        <span>฿{Math.max(0, Number(booking.total_amount || 0) - Number(booking.deposit_amount || 0)).toLocaleString()}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit Booking Modal */}
            {editingBooking && (
                <EditBookingModal 
                    booking={editingBooking}
                    tablesList={tablesList}
                    onClose={() => setEditingBooking(null)}
                    onSave={handleSaveEdit}
                />
            )}

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
        </div>
    )
}

// ----------------------------------------------------
// EDIT BOOKING MODAL (Dieter Rams Structural Grid)
// ----------------------------------------------------
function EditBookingModal({ booking, tablesList, onClose, onSave }) {
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

        // Construct ISO Timestamp
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
            <div className="bg-[oklch(98%_0.006_28)] border-2 border-[oklch(85%_0.012_28)] max-w-xl w-full rounded-sm p-6 font-mono text-xs shadow-2xl animate-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex justify-between items-center pb-4 mb-4 border-b border-[oklch(85%_0.012_28)]">
                    <div>
                        <span className="text-[10px] font-bold text-[oklch(52%_0.16_28)] uppercase tracking-wider block">
                            EDIT RECORD // #{getShortBookingId(booking)}
                        </span>
                        <h2 className="text-base font-bold text-[oklch(18%_0.012_28)] uppercase mt-0.5">
                            MODIFY RESERVATION & ORDER
                        </h2>
                    </div>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="p-1.5 text-[oklch(55%_0.010_28)] hover:text-black border border-[oklch(85%_0.012_28)] rounded-sm"
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Grid: Table & Pax */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                ASSIGNED TABLE
                            </label>
                            <select
                                value={tableName}
                                onChange={(e) => setTableName(e.target.value)}
                                className="w-full p-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-sm text-xs font-mono font-bold focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                            >
                                <option value="">-- UNASSIGNED (NONE) --</option>
                                {tablesList.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.table_name} (Cap: {t.capacity}P)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                GUESTS (PAX)
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="50"
                                value={pax}
                                onChange={(e) => setPax(e.target.value)}
                                className="w-full p-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-sm text-xs font-mono font-bold focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                            />
                        </div>
                    </div>

                    {/* Grid: Date & Time */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                SERVICE DATE
                            </label>
                            <input
                                type="date"
                                required
                                value={bookingDate}
                                onChange={(e) => setBookingDate(e.target.value)}
                                className="w-full p-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-sm text-xs font-mono font-bold focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                SERVICE TIME (HH:MM)
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="18:00"
                                value={bookingTime}
                                onChange={(e) => setBookingTime(e.target.value)}
                                className="w-full p-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-sm text-xs font-mono font-bold focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                            />
                        </div>
                    </div>

                    {/* Grid: Customer Contact */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                CUSTOMER NAME
                            </label>
                            <input
                                type="text"
                                value={contactName}
                                onChange={(e) => setContactName(e.target.value)}
                                className="w-full p-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-sm text-xs font-mono font-bold focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                PHONE NUMBER
                            </label>
                            <input
                                type="text"
                                value={contactPhone}
                                onChange={(e) => setContactPhone(e.target.value)}
                                className="w-full p-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-sm text-xs font-mono font-bold focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                            />
                        </div>
                    </div>

                    {/* Status & Financial Adjustments */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                STATUS
                            </label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full p-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-sm text-xs font-mono font-bold focus:outline-none focus:border-[oklch(52%_0.16_28)] uppercase"
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
                            <label className="text-[10px] font-bold text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                TOTAL AMOUNT (฿)
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={totalAmount}
                                onChange={(e) => setTotalAmount(e.target.value)}
                                className="w-full p-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-sm text-xs font-mono font-bold focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                DEPOSIT PAID (฿)
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={depositAmount}
                                onChange={(e) => setDepositAmount(e.target.value)}
                                className="w-full p-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-sm text-xs font-mono font-bold focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <div>
                            <label className="text-[10px] font-bold text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                CUSTOMER NOTE
                            </label>
                            <input
                                type="text"
                                placeholder="Customer's dietary or seating requests"
                                value={customerNote}
                                onChange={(e) => setCustomerNote(e.target.value)}
                                className="w-full p-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-sm text-xs font-mono focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                STAFF INTERNAL REMARK
                            </label>
                            <textarea
                                rows={2}
                                placeholder="Internal instructions for kitchen / cashier"
                                value={staffRemark}
                                onChange={(e) => setStaffRemark(e.target.value)}
                                className="w-full p-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-sm text-xs font-mono focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-2 pt-4 border-t border-[oklch(85%_0.012_28)]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] text-[oklch(18%_0.012_28)] font-bold text-xs uppercase rounded-sm transition-colors"
                        >
                            CANCEL
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-5 py-2 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(28%_0.012_28)] text-white font-bold text-xs uppercase rounded-sm transition-colors flex items-center gap-1.5"
                        >
                            {saving ? 'SAVING...' : 'SAVE CHANGES'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
