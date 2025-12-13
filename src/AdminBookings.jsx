import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { Search, Calendar, ChevronDown, Check, X, Phone, User, Clock } from 'lucide-react'

export default function AdminBookings() {
    const [bookings, setBookings] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all') // all, pending, confirmed, completed, cancelled
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        fetchBookings()
    }, [])

    const fetchBookings = async () => {
        setLoading(true)
        try {
            // 1. Fetch Bookings + Table Info
            // Note: tables_layout join usually works as it is a standard public table.
            const { data: bookingsData, error: bookingsError } = await supabase
                .from('bookings')
                .select(`
                    *,
                    tables_layout (table_name)
                `)
                .order('booking_time', { ascending: false })

            if (bookingsError) throw bookingsError

            // 2. Fetch Profiles Manually (to avoid FK issues with auth.users)
            const userIds = [...new Set(bookingsData.map(b => b.user_id).filter(Boolean))]
            let profilesMap = {}

            if (userIds.length > 0) {
                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, full_name, email, phone_number')
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

    const updateStatus = async (id, newStatus) => {
        if (!confirm(`Change status to ${newStatus}?`)) return
        try {
            const { error } = await supabase
                .from('bookings')
                .update({ status: newStatus })
                .eq('id', id)

            if (error) throw error

            // Optimistic Update
            setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b))
        } catch (err) {
            alert('Error updating status')
        }
    }

    // Filter Logic
    const filteredBookings = bookings.filter(b => {
        const matchesStatus = filter === 'all' || b.status === filter
        const matchesSearch =
            (b.pickup_contact_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (b.pickup_contact_phone || '').includes(searchTerm) ||
            (b.id || '').includes(searchTerm)
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
                </div>
            </div>

            {/* Filters */}
            <div className="grid md:grid-cols-3 gap-4 mb-8">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-3 text-gray-500 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search Name, Phone, ID..."
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
                                <th className="p-4 font-bold">Booking Info</th>
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
                                            <div className="flex flex-col">
                                                <span className="text-white font-bold text-sm">
                                                    {new Date(booking.booking_time).toLocaleDateString()}
                                                </span>
                                                <span className="text-gray-500 text-xs flex items-center gap-1 mt-1">
                                                    <Clock size={10} />
                                                    {new Date(booking.booking_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <span className="text-[#DFFF00] text-xs font-mono mt-1">
                                                    {booking.tables_layout?.table_name || 'N/A'}
                                                </span>
                                                {booking.booking_type === 'pickup' && <span className="bg-blue-900/50 text-blue-300 text-[10px] px-1 rounded w-fit mt-1">PICKUP</span>}
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
                                                {booking.status === 'pending' && (
                                                    <>
                                                        <button onClick={() => updateStatus(booking.id, 'confirmed')} className="p-2 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded-lg" title="Confirm">
                                                            <Check size={16} />
                                                        </button>
                                                        <button onClick={() => updateStatus(booking.id, 'cancelled')} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg" title="Cancel">
                                                            <X size={16} />
                                                        </button>
                                                    </>
                                                )}
                                                {booking.status === 'confirmed' && (
                                                    <button onClick={() => updateStatus(booking.id, 'completed')} className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg" title="Complete (Check Bill)">
                                                        <Check size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
