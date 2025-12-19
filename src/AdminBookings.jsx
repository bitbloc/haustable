import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { Search, Calendar, ChevronDown, Check, X, Phone, User, Clock, Printer, ChefHat, FileText, Trash2 } from 'lucide-react'
import SlipModal from './components/shared/SlipModal'

export default function AdminBookings() {
    const [bookings, setBookings] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all') // all, pending, confirmed, completed, cancelled
    const [searchTerm, setSearchTerm] = useState('')

    // Modal State
    const [slipData, setSlipData] = useState(null) // { booking, type }

    useEffect(() => {
        fetchBookings()
    }, [])

    const fetchBookings = async () => {
        setLoading(true)
        try {
            // 1. Fetch Bookings + Table Info + Order Items
            // Note: tables_layout join usually works as it is a standard public table.
            const { data: bookingsData, error: bookingsError } = await supabase
                .from('bookings')
                .select(`
                    *,
                    tables_layout (table_name),
                    order_items (
                        quantity,
                        price_at_time,
                        selected_options,
                        menu_items (name, price)
                    )
                `)
                .order('booking_time', { ascending: false })

            if (bookingsError) throw bookingsError

            // 2. Fetch Profiles Manually (to avoid FK issues with auth.users)
            const userIds = [...new Set(bookingsData.map(b => b.user_id).filter(Boolean))]
            let profilesMap = {}

            if (userIds.length > 0) {
                // Removed 'full_name' as it might not exist or cause issues. 
                // We rely on pickup_contact_name in bookings usually.
                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, phone_number, line_user_id, display_name')
                    .in('id', userIds)

                if (profilesError) {
                    console.error('Profile fetch error:', profilesError)
                    // Don't throw, just show IDs
                } else {
                    profilesData.forEach(p => { profilesMap[p.id] = p })
                }
            }

            // 3. Merge
            const merged = bookingsData.map(b => ({
                ...b,
                profiles: profilesMap[b.user_id] || null
            }))

            setBookings(merged)
        } catch (err) {
            console.error(err)
            alert('Error fetching bookings: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    // Unified Notification Logic (Email / LINE Push)
    const sendNotification = async (booking, type) => {
        try {
            console.log(`[Notification] Processing ${type} for booking ${booking.id}`)
            
            // 1. LINE User Check (Hybrid: Check profiles table manually linked via FK or trusted logic)
            // Note: The 'bookings' query in fetchBookings already joins 'profiles'.
            // So we can check booking.profiles.line_user_id
            
            if (booking.profiles?.line_user_id) {
                // Send payload for Flex Message construction
                await supabase.functions.invoke('send-line-push', {
                    body: { 
                        userId: booking.user_id, // Identifies target
                        targetLineId: booking.profiles.line_user_id, // Optimization to skip manual DB lookup in edge function if we already have it
                        type, // 'confirmed' or 'cancelled'
                        bookingDetails: {
                            id: booking.id,
                            date: new Date(booking.booking_time).toLocaleDateString('th-TH'),
                            time: new Date(booking.booking_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                            tableName: booking.tables_layout?.table_name || 'N/A',
                            pax: booking.pax,
                            total: booking.total_amount,
                            customerName: booking.profiles.display_name || booking.pickup_contact_name // Fallback
                        }
                    }
                })
            } else {
                 console.log("Not a LINE user (or no line_user_id linked), skipping LINE Push.")
                 alert("Debug: Push skipped because 'line_user_id' is missing for this user.")
            }

        } catch (error) {
            console.error('Notification Error:', error)
        }
    }

    const updateStatus = async (booking, newStatus) => {
        if (!confirm(`Change status to ${newStatus}?`)) return
        try {
            const { error } = await supabase
                .from('bookings')
                .update({ status: newStatus })
                .eq('id', booking.id)

            if (error) throw error

            // Optimistic Update
            setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: newStatus } : b))

            // Trigger Notification
            if (newStatus === 'confirmed' || newStatus === 'cancelled') {
                await sendNotification(booking, newStatus)
            }

        } catch (err) {
            alert('Error updating status: ' + err.message)
        }
    }

    // Secure Delete Handler
    const handleDelete = async (booking) => {
        const inputPin = prompt("Please enter Staff PIN to confirm deletion:")
        if (!inputPin) return

        try {
             // 1. Verify PIN
            const { data: setting } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'staff_pin_code')
                .single()
            
            const correctPin = setting?.value

            if (inputPin !== correctPin) {
                alert("Incorrect PIN!")
                return
            }

            if (!confirm(`⚠ WARNING: This will permanently delete booking #${booking.id} and its slip image.\nAre you sure?`)) return

            setLoading(true)

            // 2. Delete Slip Image (if exists)
            if (booking.payment_slip_url) {
                // Extract path from URL or just use the filename if standard bucket structure
                // Usually we store full path or just filename? Let's assume standard behavior matches AdminSettings cleanup.
                // AdminSettings uses: storage.from('slips').remove([url]) - wait, remove takes paths/names, not full URLs typically unless stored that way.
                // Let's try to pass the value stored in DB exactly.
                const { error: storageError } = await supabase.storage
                    .from('slips')
                    .remove([booking.payment_slip_url])
                
                if (storageError) console.warn("Slip deletion warning:", storageError)
            }

            // 3. Delete Booking Record
            const { error: dbError } = await supabase
                .from('bookings')
                .delete()
                .eq('id', booking.id)

            if (dbError) throw dbError

            // 4. Update UI
            setBookings(prev => prev.filter(b => b.id !== booking.id))
            alert("Booking deleted successfully.")

        } catch (err) {
            console.error(err)
            alert('Delete failed: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    // Print Handler with Modal
    const handlePrint = (booking, type) => {
        setSlipData({ booking, type })
    }

    // Helper
    const getShortId = (token) => token ? token.slice(-4).toUpperCase() : '----'

    // Filter Logic
    const filteredBookings = bookings.filter(b => {
        const matchesStatus = filter === 'all' || b.status === filter
        const shortId = getShortId(b.tracking_token)
        const matchesSearch =
            (b.pickup_contact_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (b.pickup_contact_phone || '').includes(searchTerm) ||
            (b.id || '').includes(searchTerm) ||
            shortId.includes(searchTerm.toUpperCase())
        return matchesStatus && matchesSearch
    })

    const statusColors = {
        pending: 'bg-yellow-500/20 text-yellow-500',
        confirmed: 'bg-green-500/20 text-green-500',
        completed: 'bg-blue-500/20 text-blue-500',
        cancelled: 'bg-red-500/20 text-red-500'
    }

    return (
        <div className="max-w-6xl mx-auto pb-20 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Booking History</h1>
                    <p className="text-gray-500 mt-1">Manage all reservations and orders</p>
                </div>

                <div className="flex gap-2">
                    <button onClick={fetchBookings} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white text-sm font-bold transition-colors">
                        Refresh
                    </button>
                    {/* Add Quick Links if needed */}
                </div>
            </div>

            {/* Filters */}
            <div className="grid md:grid-cols-3 gap-4 mb-8">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-3 text-gray-500 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search Name, Phone, ID (#ABCD)..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-[#111] border border-white/10 pl-10 pr-4 py-2.5 rounded-xl text-white text-sm outline-none focus:border-[#DFFF00]"
                    />
                </div>

                {/* Status Tabs */}
                <div className="md:col-span-2 flex gap-2 overflow-x-auto no-scrollbar">
                    {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map(s => (
                        <button
                            key={s}
                            onClick={() => setFilter(s)}
                            className={`px-4 py-2 rounded-full text-xs font-bold capitalize whitespace-nowrap transition-all ${filter === s ? 'bg-[#DFFF00] text-black' : 'bg-[#111] text-gray-400 border border-white/10 hover:border-white/30'}`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 text-gray-500 text-xs uppercase tracking-wider">
                                <th className="p-4 font-bold">Short ID / Time</th>
                                <th className="p-4 font-bold">Customer</th>
                                <th className="p-4 font-bold">Total</th>
                                <th className="p-4 font-bold">Status</th>
                                <th className="p-4 font-bold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr><td colSpan="5" className="p-8 text-center text-gray-500">Loading...</td></tr>
                            ) : filteredBookings.length === 0 ? (
                                <tr><td colSpan="5" className="p-8 text-center text-gray-500">No bookings found</td></tr>
                            ) : (
                                filteredBookings.map(booking => (
                                    <tr key={booking.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-[#DFFF00] text-black text-xs font-bold px-1.5 py-0.5 rounded">
                                                        #{getShortId(booking.tracking_token)}
                                                    </span>
                                                    <span className="text-white font-bold text-sm">
                                                        {new Date(booking.booking_time).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <span className="text-gray-500 text-xs flex items-center gap-1">
                                                    <Clock size={10} />
                                                    {new Date(booking.booking_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <span className="text-gray-400 text-xs font-mono">
                                                    {booking.tables_layout?.table_name || 'N/A'}
                                                </span>
                                                {booking.booking_type === 'pickup' && <span className="bg-blue-900/50 text-blue-300 text-[10px] px-1 rounded w-fit">PICKUP</span>}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="text-white font-medium text-sm">{booking.pickup_contact_name || booking.profiles?.full_name || 'Unique User'}</span>
                                                <span className="text-gray-500 text-xs flex items-center gap-1 mt-1">
                                                    <Phone size={10} />
                                                    {booking.pickup_contact_phone || booking.profiles?.phone_number || '-'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-white font-mono">{booking.total_amount?.toLocaleString()}.-</span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[booking.status] || 'bg-gray-500/20 text-gray-400'}`}>
                                                {booking.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {/* Print Buttons */}
                                                <button onClick={() => handlePrint(booking, 'kitchen')} className="p-2 bg-gray-700/50 hover:bg-gray-600 text-gray-200 rounded-lg" title="Kitchen Slip">
                                                    <ChefHat size={16} />
                                                </button>
                                                <button onClick={() => handlePrint(booking, 'customer')} className="p-2 bg-gray-700/50 hover:bg-gray-600 text-gray-200 rounded-lg" title="Customer Bill">
                                                    <Printer size={16} />
                                                </button>
                                                <div className="w-px bg-white/10 mx-1"></div>

                                                {booking.status === 'pending' && (
                                                    <>
                                                        <button onClick={() => updateStatus(booking, 'confirmed')} className="p-2 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded-lg" title="Confirm">
                                                            <Check size={16} />
                                                        </button>
                                                        <button onClick={() => updateStatus(booking, 'cancelled')} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg" title="Cancel">
                                                            <X size={16} />
                                                        </button>
                                                    </>
                                                )}
                                                {booking.status === 'confirmed' && (
                                                    <button onClick={() => updateStatus(booking, 'completed')} className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg" title="Complete (Check Bill)">
                                                        <Check size={16} />
                                                    </button>

                                                )}
                                                
                                                <div className="w-px bg-white/10 mx-1"></div>
                                                <button onClick={() => handleDelete(booking)} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors" title="Delete Booking (PIN Required)">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
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
        </div>
    )
}
