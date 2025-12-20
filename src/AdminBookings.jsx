import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { Search, Calendar, ChevronDown, Check, X, Phone, User, Clock, Printer, ChefHat, FileText, Trash2, ArrowUpDown, History } from 'lucide-react'
import SlipModal from './components/shared/SlipModal'
import ViewSlipModal from './components/shared/ViewSlipModal'
import HoldToDeleteButton from './components/HoldToDeleteButton'

export default function AdminBookings() {
    const [bookings, setBookings] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all') // all, pending, confirmed, completed, cancelled
    const [searchTerm, setSearchTerm] = useState('')

    const [slipData, setSlipData] = useState(null) // { booking, type }
    const [viewSlipUrl, setViewSlipUrl] = useState(null)

    // New State for Batch/Sort
    const [selectedIds, setSelectedIds] = useState([])
    const [sortConfig, setSortConfig] = useState({ key: 'booking_time', direction: 'desc' })

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
                    promotion_codes (code),
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

    // Secure Delete Handler (Single)
    // Removed handleDelete wrapper as HoldToDelete calls executeDelete directly
    
    // Batch Delete Handler (Modified to just select targets)
    // The visual button in header will trigger executeDelete
    
    // Core Delete Logic (No PIN)
    const executeDelete = async (targets) => {
        try {
            setLoading(true)
            
            // 2. Delete Slip Images
            const slipsToDelete = targets.map(b => b.payment_slip_url).filter(Boolean)
            if (slipsToDelete.length > 0) {
                const { error: storageError } = await supabase.storage
                    .from('slips')
                    .remove(slipsToDelete)
                if (storageError) console.warn("Slip deletion warning:", storageError)
            }

            // 3. Delete Booking Records
            const targetIds = targets.map(b => b.id)
            const { error: dbError, count } = await supabase
                .from('bookings')
                .delete({ count: 'exact' }) // Request count
                .in('id', targetIds)

            if (dbError) throw dbError

            // Verify count
            if (count === 0 && targets.length > 0) {
                throw new Error("Deletion permission denied or records already gone.")
            }

            // 4. Update UI
            setBookings(prev => prev.filter(b => !targetIds.includes(b.id)))
            setSelectedIds([]) 
            alert(`Successfully deleted ${targets.length} bookings.`)

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

    // Sorting Helper
    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }))
    }

    // Selection Helper
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

    // Helper
    const getShortId = (token) => token ? token.slice(-4).toUpperCase() : '----'

    // Filter & Sort Logic
    const filteredBookings = bookings.filter(b => {
        const matchesStatus = filter === 'all' || b.status === filter
        const shortId = getShortId(b.tracking_token)
        const nameToSearch = b.pickup_contact_name || b.profiles?.display_name || ''
        
        const matchesSearch =
            nameToSearch.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (b.pickup_contact_phone || '').includes(searchTerm) ||
            (b.id || '').includes(searchTerm) ||
            shortId.includes(searchTerm.toUpperCase())
        return matchesStatus && matchesSearch
    }).sort((a, b) => {
        const aValue = sortConfig.key === 'customer' 
            ? (a.pickup_contact_name || a.profiles?.display_name || '') 
            : a[sortConfig.key]
        const bValue = sortConfig.key === 'customer'
            ? (b.pickup_contact_name || b.profiles?.display_name || '')
            : b[sortConfig.key]

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
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

            {/* Batch Action Bar */}
            {selectedIds.length > 0 && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between animate-fade-in gap-4">
                    <span className="text-red-400 text-sm font-medium pl-2">
                        {selectedIds.length} orders selected
                    </span>
                    
                    {/* Filter Selected (ensure only deletable ones are passed) */}
                     {(() => {
                        const validBookings = bookings.filter(b => selectedIds.includes(b.id) && (b.status === 'completed' || b.status === 'cancelled'))
                        
                        // Disable if no valid bookings
                        if (validBookings.length === 0) return (
                            <div className="text-xs text-red-500/50">Only Completed/Cancelled orders can be deleted</div>
                        )

                        return (
                             <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase text-red-500/60 font-bold tracking-wider">Hold 5s to Delete</span>
                                <HoldToDeleteButton 
                                    onConfirm={() => executeDelete(validBookings)}
                                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg flex items-center gap-2 font-bold transition-colors"
                                />
                             </div>
                        )
                    })()}
                </div>
            )}

            {/* Table */}
            <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 text-gray-500 text-xs uppercase tracking-wider">
                                <th className="p-4 w-12 text-center">
                                    <input 
                                        type="checkbox" 
                                        className="rounded border-gray-600 bg-transparent checked:bg-[#DFFF00]"
                                        checked={filteredBookings.length > 0 && selectedIds.length === filteredBookings.length}
                                        onChange={() => toggleSelectAll(filteredBookings)}
                                    />
                                </th>
                                <th className="p-4 font-bold cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('booking_time')}>
                                    <div className="flex items-center gap-1">
                                        Booking Date
                                        <ArrowUpDown size={12} className={sortConfig.key === 'booking_time' ? 'text-[#DFFF00]' : 'opacity-30'} />
                                    </div>
                                </th>
                                <th className="p-4 font-bold cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('customer')}>
                                    <div className="flex items-center gap-1">
                                        Customer
                                        <ArrowUpDown size={12} className={sortConfig.key === 'customer' ? 'text-[#DFFF00]' : 'opacity-30'} />
                                    </div>
                                </th>
                                <th className="p-4 font-bold">Total</th>
                                <th className="p-4 font-bold">Status</th>
                                <th className="p-4 font-bold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr><td colSpan="6" className="p-8 text-center text-gray-500">Loading...</td></tr>
                            ) : filteredBookings.length === 0 ? (
                                <tr><td colSpan="6" className="p-8 text-center text-gray-500">No bookings found</td></tr>
                            ) : (
                                filteredBookings.map(booking => (
                                    <tr key={booking.id} className={`hover:bg-white/[0.02] transition-colors ${selectedIds.includes(booking.id) ? 'bg-white/[0.03]' : ''}`}>
                                        <td className="p-4 text-center">
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-gray-600 bg-transparent checked:bg-[#DFFF00]"
                                                checked={selectedIds.includes(booking.id)}
                                                onChange={() => toggleSelect(booking.id)}
                                            />
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1.5">
                                                {/* Booking Time (Primary) */}
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-[#DFFF00] text-black text-xs font-bold px-1.5 py-0.5 rounded">
                                                        #{getShortId(booking.tracking_token)}
                                                    </span>
                                                    <span className="text-white font-bold text-sm">
                                                        {new Date(booking.booking_time).toLocaleDateString()}
                                                    </span>
                                                    <span className="text-gray-400 text-xs">
                                                        {new Date(booking.booking_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>

                                                {/* Order Time (Secondary) */}
                                                <div className="flex items-center gap-1.5 text-xs text-gray-600 pl-1 border-l-2 border-gray-800">
                                                    <History size={10} />
                                                    <span>Order: {new Date(booking.created_at).toLocaleString('th-TH', { 
                                                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                                                    })}</span>
                                                </div>

                                                <span className="text-gray-500 text-xs font-mono mt-0.5">
                                                    {booking.tables_layout?.table_name || 'N/A'} 
                                                    {booking.booking_type === 'pickup' && <span className="ml-2 text-blue-400">PICKUP</span>}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="text-white font-medium text-sm">
                                                    {booking.pickup_contact_name || booking.profiles?.display_name || 'Guest User'}
                                                </span>
                                                <span className="text-gray-500 text-xs flex items-center gap-1 mt-1">
                                                    <Phone size={10} />
                                                    {booking.pickup_contact_phone || booking.profiles?.phone_number || '-'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="text-white font-mono">{booking.total_amount?.toLocaleString()}.-</span>
                                                {booking.discount_amount > 0 && (
                                                    <span className="text-green-500 text-[10px] font-mono">
                                                        -{booking.discount_amount} ({booking.promotion_codes?.code})
                                                    </span>
                                                )}
                                            </div>
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
                                                {booking.payment_slip_url && (
                                                    <button onClick={() => setViewSlipUrl(booking.payment_slip_url)} className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg" title="View Slip">
                                                        <Search size={16} />
                                                    </button>
                                                )}
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
                                                <div className="w-px bg-white/10 mx-1"></div>
                                                <HoldToDeleteButton 
                                                    onConfirm={() => executeDelete([booking])}
                                                    disabled={booking.status !== 'completed' && booking.status !== 'cancelled'}
                                                    className={`p-2 rounded-lg transition-colors ${(booking.status === 'completed' || booking.status === 'cancelled') ? 'bg-red-500/10 hover:bg-red-500/20 text-red-500' : 'bg-gray-800 text-gray-600'}`}
                                                />
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

            {viewSlipUrl && (
                <ViewSlipModal 
                    url={viewSlipUrl.startsWith('http') ? viewSlipUrl : supabase.storage.from('slips').getPublicUrl(viewSlipUrl).data.publicUrl} 
                    onClose={() => setViewSlipUrl(null)} 
                />
            )}

        </div>
    )
}
