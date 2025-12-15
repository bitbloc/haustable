import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { Search, Shield, User, Phone, Edit2, X, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'

export default function AdminMembers() {
    const [members, setMembers] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    // History Modal State
    const [selectedMember, setSelectedMember] = useState(null)
    const [memberHistory, setMemberHistory] = useState([])
    const [historyLoading, setHistoryLoading] = useState(false)

    // Fetch Data
    const fetchMembers = async () => {
        setLoading(true)
        try {
            // 1. Get Profiles
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false })

            if (profileError) throw profileError

            // 2. Get Booking Counts (Aggregation)
            const { data: bookings, error: bookingError } = await supabase
                .from('bookings')
                .select('user_id, status')

            if (bookingError) throw bookingError

            // 3. Merge Data
            const merged = profiles.map(p => {
                const userBookings = bookings.filter(b => b.user_id === p.id)
                const completed = userBookings.filter(b => b.status === 'completed' || b.status === 'confirmed').length
                return {
                    ...p,
                    total_bookings: userBookings.length,
                    completed_bookings: completed,
                    last_active: 'N/A'
                }
            })

            setMembers(merged)

        } catch (err) {
            console.error(err)
            alert('Error fetching members')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchMembers()
    }, [])

    const handleViewHistory = async (member) => {
        setSelectedMember(member)
        setHistoryLoading(true)
        setMemberHistory([])
        try {
            const { data, error } = await supabase
                .from('bookings')
                .select(`
                    *,
                    order_items (
                        quantity,
                        menu_items (name)
                    )
                `)
                .eq('user_id', member.id)
                .order('created_at', { ascending: false })

            if (error) throw error
            setMemberHistory(data || [])
        } catch (err) {
            console.error(err)
            alert("Could not load history")
        } finally {
            setHistoryLoading(false)
        }
    }

    // Toggle Role
    const handleToggleRole = async (member) => {
        const newRole = member.role === 'admin' ? 'customer' : 'admin'
        const confirmMsg = member.role === 'admin'
            ? `⚠️ Remove Admin rights from ${member.display_name}?`
            : `Promote ${member.display_name} to Admin?`

        if (!window.confirm(confirmMsg)) return

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', member.id)

            if (error) throw error

            // Update UI
            setMembers(prev => prev.map(m => m.id === member.id ? { ...m, role: newRole } : m))

        } catch (err) {
            console.error(err)
            alert('Failed to update role')
        }
    }

    // Update Note
    const handleUpdateNote = async (userId, note) => {
        try {
            const { error } = await supabase.from('profiles').update({ admin_notes: note }).eq('id', userId)
            if (error) throw error
            setMembers(prev => prev.map(m => m.id === userId ? { ...m, admin_notes: note } : m))
        } catch (err) {
            alert('Failed to update note')
        }
    }

    const filteredMembers = members.filter(m =>
        (m.display_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.phone_number || '').includes(searchTerm)
    )

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">
                        Members ({members.length})
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Manage users, view stats, and assign roles.</p>
                </div>

                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search name, phone..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#DFFF00] transition-colors"
                    />
                </div>
            </div>

            {/* List */}
            <div className="grid gap-4">
                {loading ? (
                    <div className="text-gray-500 text-center py-10">Loading members...</div>
                ) : (
                    filteredMembers.map((member) => (
                        <motion.div
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={member.id}
                            className={`bg-[#111] border ${member.role === 'admin' ? 'border-[#DFFF00]/30' : 'border-white/5'} rounded-2xl p-5 flex flex-col md:flex-row items-center gap-6 group hover:border-white/20 transition-all`}
                        >
                            {/* Avatar / Icon */}
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${member.role === 'admin' ? 'bg-[#DFFF00] text-black' : 'bg-gray-800 text-gray-400'}`}>
                                {member.role === 'admin' ? <Shield size={20} /> : <User size={20} />}
                            </div>

                            {/* Info */}
                            <div className="flex-1 text-center md:text-left min-w-0 w-full">
                                <div className="flex items-center justify-center md:justify-start gap-2">
                                    <h3 className="font-bold text-lg text-white truncate">{member.display_name || 'Unknown User'}</h3>
                                    {member.nickname && <span className="bg-gray-800 text-gray-300 text-[10px] px-2 py-0.5 rounded-full">({member.nickname})</span>}
                                </div>
                                <div className="flex flex-col md:flex-row gap-2 md:gap-4 text-xs text-gray-400 mt-1 justify-center md:justify-start">
                                    {member.phone_number && (
                                        <span className="flex items-center gap-1 justify-center md:justify-start"><Phone size={12} /> {member.phone_number}</span>
                                    )}
                                    <span className="flex items-center gap-1 justify-center md:justify-start font-mono text-gray-500">ID: {member.id.substring(0, 8)}...</span>
                                </div>
                                <div className="mt-3 flex gap-3 justify-center md:justify-start">
                                    <button
                                        onClick={() => {
                                            const note = prompt("Edit Customer Note:", member.admin_notes || '')
                                            if (note !== null) handleUpdateNote(member.id, note)
                                        }}
                                        className="text-xs flex items-center gap-1 text-gray-500 hover:text-[#DFFF00] transition-colors"
                                    >
                                        <Edit2 size={12} /> {member.admin_notes ? <span className="text-white">{member.admin_notes}</span> : "Add Note"}
                                    </button>
                                    <button
                                        onClick={() => handleViewHistory(member)}
                                        className="text-xs flex items-center gap-1 text-[#DFFF00] hover:underline"
                                    >
                                        <Clock size={12} /> View History
                                    </button>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="flex gap-8 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-8 w-full md:w-auto justify-center">
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-white">{member.total_bookings}</p>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total Bookings</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-[#DFFF00]">{member.completed_bookings}</p>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Completed</p>
                                </div>
                            </div>

                            {/* Toggle Switch */}
                            <div className="flex items-center gap-3 w-full md:w-auto justify-center pt-4 md:pt-0 border-t md:border-t-0 border-white/10">
                                <span className={`text-xs font-bold uppercase ${member.role === 'admin' ? 'text-[#DFFF00]' : 'text-gray-500'}`}>
                                    {member.role}
                                </span>
                                <button
                                    onClick={() => handleToggleRole(member)}
                                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${member.role === 'admin' ? 'bg-[#DFFF00]' : 'bg-gray-700'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300 ${member.role === 'admin' ? 'translate-x-6' : 'translate-x-0'}`} />
                                </button>
                            </div>

                        </motion.div>
                    ))
                )}
            </div>

            {/* History Modal */}
            <AnimatePresence>
                {selectedMember && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-[#1A1A1A] w-full max-w-2xl max-h-[85vh] rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
                        >
                            <div className="p-6 border-b border-white/10 flex justify-between items-start bg-[#222]">
                                <div>
                                    <h2 className="text-2xl font-bold text-white">{selectedMember.display_name}</h2>
                                    <div className="flex flex-wrap gap-4 text-sm text-gray-400 mt-2">
                                        {selectedMember.nickname && <span>Nickname: <span className="text-white">{selectedMember.nickname}</span></span>}
                                        <span>Phone: <span className="text-white">{selectedMember.phone_number || '-'}</span></span>
                                        <span>Gender: <span className="text-white">{selectedMember.gender || '-'}</span></span>
                                        <span>Birthday: <span className="text-white">{selectedMember.birth_day ? `${selectedMember.birth_day}/${selectedMember.birth_month}` : '-'}</span></span>
                                        <span>Line ID: <span className="text-white">{selectedMember.line_uid || '-'}</span></span>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedMember(null)} className="p-2 hover:bg-white/10 rounded-full"><X className="text-gray-400 hover:text-white" /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6">
                                <h3 className="font-bold text-[#DFFF00] mb-4 flex items-center gap-2">
                                    <Clock size={18} /> Booking History
                                </h3>

                                {historyLoading ? (
                                    <div className="text-center py-10 text-gray-500">Loading history...</div>
                                ) : memberHistory.length === 0 ? (
                                    <div className="text-center py-10 text-gray-600">No booking history found.</div>
                                ) : (
                                    <div className="space-y-3">
                                        {memberHistory.map(booking => (
                                            <div key={booking.id} className="bg-[#111] border border-white/5 rounded-xl p-4 flex justify-between items-center hover:border-white/10 transition-colors">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${booking.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                                                            booking.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                                                                'bg-gray-700 text-gray-400'
                                                            }`}>
                                                            {booking.status}
                                                        </span>
                                                        <span className="text-xs text-gray-500">{format(new Date(booking.created_at), 'dd MMM yyyy, HH:mm')}</span>
                                                    </div>
                                                    <div className="text-sm font-bold text-white mb-1">
                                                        {booking.order_items?.map(i => `${i.menu_items?.name} (x${i.quantity})`).join(', ') || 'No Items'}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        Type: <span className="capitalize">{booking.booking_type}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[#DFFF00] font-mono font-bold">{booking.total_amount}.-</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
