// src/AdminDashboard.jsx
import { useState, useEffect, useMemo } from 'react'
import { supabase } from './lib/supabaseClient'
import { RotateCcw } from 'lucide-react'
import PageTransition from './components/PageTransition'
import { getThaiDate } from './utils/timeUtils'
import { toast } from 'sonner'
import ConfirmationModal from './components/ConfirmationModal'

// Components
import InboxSection from './components/admin/InboxSection'
import ScheduleSection from './components/admin/ScheduleSection'

export default function AdminDashboard() {
    // const { toast } = useToast() -> Removed, uses import now
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: null })

    const [bookings, setBookings] = useState([]) // Stores Pending (All) + Today's Bookings
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('overview') // overview, dine_in, pickup, steak

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
        setConfirmModal({
            isOpen: true,
            title: status === 'confirmed' ? 'Confirm Order' : (status === 'cancelled' ? 'Reject Order' : 'Update Status'),
            message: `Are you sure you want to mark this order as ${status}?`,
            isDangerous: status === 'cancelled',
            action: async () => {
                // Optimistic Update can happen here or after success
                // Let's do after success for safety or keep optimistic if preferred
                // Keeping previous logic:
                setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b))

                const { error } = await supabase
                    .from('bookings')
                    .update({ status })
                    .eq('id', id)

                if (error) {
                    toast.error('Error updating status')
                    fetchData()
                } else {
                    toast.success('Status updated')
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

    // --- Sound Logic ---
    const [soundUrl, setSoundUrl] = useState(null)
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
        // Play if there are pending bookings
        if (soundUrl && pendingBookings.length > 0) {
            audio.src = soundUrl
            audio.play().catch(e => console.log('Autoplay blocked:', e)) // Normal for first load without interaction
        } else {
            audio.pause()
            audio.currentTime = 0
        }
        return () => audio.pause()
    }, [pendingBookings.length, soundUrl])
    // -------------------

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
            <ConfirmationModal 
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.action}
                title={confirmModal.title}
                message={confirmModal.message}
                isDangerous={confirmModal.isDangerous}
            />
            
            <div className="pb-20">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-ink tracking-tight">Dashboard</h1>
                        <p className="text-sm text-subInk mt-1">Manage orders and reservations</p>
                    </div>
                    <button onClick={fetchData} className="px-5 py-2.5 bg-paper text-ink font-bold rounded-xl border border-gray-200 shadow-sm hover:border-brand hover:bg-brand/10 transition-colors flex items-center gap-2">
                        <RotateCcw className="w-4 h-4" /> Refresh
                    </button>
                </div>

                {/* --- TABS --- */}
                <div className="flex p-1.5 bg-paper rounded-2xl mb-8 w-fit border border-gray-200 shadow-sm">
                    {['overview', 'dine_in', 'pickup', 'steak'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === tab ? 'bg-brand text-ink shadow-sm' : 'text-subInk hover:text-ink hover:bg-gray-50'}`}
                        >
                            {tab === 'dine_in' ? 'Dine-in Only' : tab === 'pickup' ? 'Pickup Only' : tab === 'steak' ? 'Steak Pre-order' : 'Overview'}
                        </button>
                    ))}
                </div>

                {/* CONTENT */}
                <div className="max-w-7xl mx-auto">
                    {getTabContent()}
                </div>
            </div>
        </PageTransition>
    )
}
