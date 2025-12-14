// src/AdminDashboard.jsx
import { useState, useEffect, useMemo } from 'react'
import { supabase } from './lib/supabaseClient'
import { RotateCcw } from 'lucide-react'
import PageTransition from './components/PageTransition'
import { getThaiDate } from './utils/timeUtils'

// Components
import InboxSection from './components/admin/InboxSection'
import ScheduleSection from './components/admin/ScheduleSection'

export default function AdminDashboard() {
    const [bookings, setBookings] = useState([]) // Stores Pending (All) + Today's Bookings
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('overview') // overview, dine_in, pickup

    useEffect(() => {
        fetchData()

        // Real-time: Refresh on any booking change
        const subscription = supabase
            .channel('public:bookings')
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
            pendingRes.data.forEach(b => map.set(b.id, b))
            todayRes.data.forEach(b => map.set(b.id, b))

            // Convert to Array
            const merged = Array.from(map.values())

            // Sort: Pending first? No, UI handles separation.
            // Just keep them in state.
            setBookings(merged)

        } catch (error) {
            console.error('Error fetching dashboard data:', error.message)
        } finally {
            setLoading(false)
        }
    }

    const updateStatus = async (id, status) => {
        // Optimistic Update
        setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b))

        const { error } = await supabase
            .from('bookings')
            .update({ status })
            .eq('id', id)

        if (error) {
            alert('Error updating status')
            fetchData() // Revert
        } else {
            fetchData() // Refresh to be sure
        }
    }

    // --- DERIVED STATE ---

    // 1. Inbox: Pending (ALL dates)
    const pendingBookings = useMemo(() =>
        bookings.filter(b => b.status === 'pending').sort((a, b) => new Date(a.booking_time) - new Date(b.booking_time))
        , [bookings])

    // 2. Schedule: Confirmed (Today Only)
    // We filter from 'bookings'. Note that 'bookings' contains 'Today' (all statuses) + 'Pending' (future).
    // So for Schedule, we want Status=Confirmed AND Date=Today.
    const scheduleBookings = useMemo(() => {
        const todayStr = getThaiDate()
        return bookings.filter(b => {
            // Date Check
            const bDate = new Date(b.booking_time).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
            const isToday = bDate === todayStr
            const isConfirmed = b.status === 'confirmed'
            return isToday && isConfirmed
        }).sort((a, b) => new Date(a.booking_time) - new Date(b.booking_time))
    }, [bookings])

    // 3. Other Log (Today's Cancelled/Completed) - Optional?
    // User asked for "Inbox" and "Schedule". 
    // What about "Completed" or "Cancelled"?
    // They are in 'bookings' (if today). We can show them if needed, or just focus on the requested 2 boxes.
    // Let's stick to the requested structure.

    // 4. Filter for Tabs (Dine-in / Pickup) - View ONLY Today's Confirmed/Pending?
    // Let's make tabs act as filters on the "Today" list mostly.
    const getTabContent = () => {
        if (activeTab === 'overview') {
            return (
                <div className="space-y-8 animate-in fade-in duration-500">
                    {/* ZERO INBOX */}
                    <InboxSection bookings={pendingBookings} onUpdateStatus={updateStatus} />

                    {/* TODAY'S SCHEDULE */}
                    <ScheduleSection bookings={scheduleBookings} loading={loading} />
                </div>
            )
        }

        // Fallback for old tabs (Dine In / Pickup) - Just show a simple list of TODAY's relevant items
        const filtered = bookings.filter(b => b.booking_type === activeTab && (b.status === 'confirmed' || b.status === 'pending'))
        return <ScheduleSection bookings={filtered} loading={loading} />
    }

    return (
        <PageTransition>
            <div className="p-6 bg-bgDark min-h-screen text-white pb-20">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-primary">Admin Dashboard</h1>
                        <p className="text-xs text-gray-400">Manage orders and reservations</p>
                    </div>
                    <button onClick={fetchData} className="px-4 py-2 bg-primary text-bgDark font-bold rounded-xl hover:bg-primary/80 transition-colors flex items-center gap-2">
                        <RotateCcw className="w-4 h-4" /> Refresh
                    </button>
                </div>

                {/* --- TABS --- */}
                <div className="flex p-1 bg-cardDark rounded-2xl mb-8 w-fit border border-gray-800">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'overview' ? 'bg-primary text-bgDark shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('dine_in')}
                        className={`px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'dine_in' ? 'bg-primary text-bgDark shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        Dine-in Only
                    </button>
                    <button
                        onClick={() => setActiveTab('pickup')}
                        className={`px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'pickup' ? 'bg-primary text-bgDark shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        Pickup Only
                    </button>
                </div>

                {/* CONTENT */}
                <div className="max-w-7xl mx-auto">
                    {getTabContent()}
                </div>
            </div>
        </PageTransition>
    )
}
