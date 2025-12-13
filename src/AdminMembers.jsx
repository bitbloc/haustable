import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { Search, Shield, ShieldOff, User, Phone, Calendar } from 'lucide-react'
import { motion } from 'framer-motion'

export default function AdminMembers() {
    const [members, setMembers] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

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
            // Note: asking for all bookings might be heavy later, but fine for now. 
            // Better approach: .rpc() if complex, but client-side count is ok for < 1000 users.
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
                    last_active: 'N/A' // strict auth logs not available to client easily, can add updated_at later
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
                                <h3 className="font-bold text-lg text-white truncate">{member.display_name || 'Unknown User'}</h3>
                                <div className="flex flex-col md:flex-row gap-2 md:gap-4 text-xs text-gray-400 mt-1 justify-center md:justify-start">
                                    {member.phone_number && (
                                        <span className="flex items-center gap-1 justify-center md:justify-start"><Phone size={12} /> {member.phone_number}</span>
                                    )}
                                    <span className="flex items-center gap-1 justify-center md:justify-start font-mono text-gray-500">ID: {member.id.substring(0, 8)}...</span>
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
        </div>
    )
}
