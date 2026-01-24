import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { Search, Shield, User, Phone, Edit2, X, Clock, Trash2, ChevronRight } from 'lucide-react'
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

    // Delete User
    const handleDeleteUser = async (member) => {
        if (!confirm(`Are you sure you want to DELETE user "${member.display_name}"?\nThis action cannot be undone.`)) return

        try {
            const { error } = await supabase.rpc('delete_user_by_admin', { target_user_id: member.id })
            if (error) throw error

            // Update UI
            setMembers(prev => prev.filter(m => m.id !== member.id))
        } catch (err) {
            console.error(err)
            alert('Failed to delete user: ' + err.message)
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

    // Edit Member State
    const [editingMember, setEditingMember] = useState(null)
    const [editForm, setEditForm] = useState({ display_name: '', phone_number: '', line_user_id: '', admin_notes: '' })

    const openEditModal = (member) => {
        setEditingMember(member)
        setEditForm({
            display_name: member.display_name || '',
            phone_number: member.phone_number || '',
            line_user_id: member.line_user_id || member.line_uid || '', // Support both if legacy exists
            admin_notes: member.admin_notes || '' 
        })
    }

    const handleSaveMember = async (e) => {
        e.preventDefault()
        if (!editingMember) return

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    display_name: editForm.display_name,
                    phone_number: editForm.phone_number,
                    line_user_id: editForm.line_user_id,
                    admin_notes: editForm.admin_notes
                })
                .eq('id', editingMember.id)

            if (error) throw error

            // Update UI
            setMembers(prev => prev.map(m => m.id === editingMember.id ? { ...m, ...editForm } : m))
            setEditingMember(null)
            alert('Member updated successfully!')
        } catch (err) {
            console.error(err)
            alert('Failed to update member: ' + err.message)
        }
    }

    const filteredMembers = members.filter(m =>
        (m.display_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.phone_number || '').includes(searchTerm)
    )

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-ink tracking-tight">
                        Members ({members.length})
                    </h1>
                    <p className="text-subInk text-sm mt-1">Manage users, view stats, and assign roles.</p>
                </div>

                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subInk w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search name, phone..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-paper border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-ink focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all shadow-sm"
                    />
                </div>
            </div>

            {/* List */}
            <div className="grid gap-4">
                {loading ? (
                    <div className="text-subInk text-center py-10 animate-pulse">Loading members...</div>
                ) : (
                    filteredMembers.map((member) => (
                        <motion.div
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={member.id}
                            className={`bg-paper border ${member.role === 'admin' ? 'border-brand shadow-md shadow-brand/10' : 'border-gray-200'} rounded-2xl p-5 flex flex-col md:flex-row items-center gap-6 group hover:border-gray-300 hover:shadow-lg transition-all`}
                        >
                            {/* Avatar / Icon */}
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 border ${member.role === 'admin' ? 'bg-brand text-ink border-brand' : 'bg-canvas text-subInk border-gray-100'}`}>
                                {member.role === 'admin' ? <Shield size={24} /> : <User size={24} />}
                            </div>

                            {/* Info */}
                            <div className="flex-1 text-center md:text-left min-w-0 w-full">
                                <div className="flex items-center justify-center md:justify-start gap-2">
                                    <h3 className="font-bold text-lg text-ink truncate">{member.display_name || 'Unknown User'}</h3>
                                    {member.nickname && <span className="bg-canvas text-subInk text-[10px] px-2 py-0.5 rounded-full border border-gray-100 uppercase tracking-wide">({member.nickname})</span>}
                                </div>
                                <div className="flex flex-col md:flex-row gap-2 md:gap-4 text-xs text-subInk mt-1.5 justify-center md:justify-start">
                                    {member.phone_number && (
                                        <span className="flex items-center gap-1 justify-center md:justify-start font-medium"><Phone size={12} /> {member.phone_number}</span>
                                    )}
                                    <span className="flex items-center gap-1 justify-center md:justify-start font-mono text-gray-400">LINE: {member.line_user_id || '-'}</span>
                                </div>
                                <div className="mt-3 flex gap-3 justify-center md:justify-start">
                                    <button
                                        onClick={() => openEditModal(member)}
                                        className="text-xs flex items-center gap-1 text-subInk hover:text-ink hover:underline transition-colors"
                                    >
                                        <Edit2 size={12} /> Edit Info
                                    </button>
                                    <button
                                        onClick={() => handleViewHistory(member)}
                                        className="text-xs flex items-center gap-1 text-brandDark font-bold hover:underline"
                                    >
                                        <Clock size={12} /> View History
                                    </button>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="flex gap-8 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-8 w-full md:w-auto justify-center">
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-ink">{member.total_bookings}</p>
                                    <p className="text-[10px] text-subInk uppercase tracking-wider font-bold">Total Bookings</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-brandDark">{member.completed_bookings}</p>
                                    <p className="text-[10px] text-subInk uppercase tracking-wider font-bold">Completed</p>
                                </div>
                            </div>

                            {/* Toggle Switch & Delete */}
                            <div className="flex flex-col items-end gap-3 w-full md:w-auto justify-center pt-4 md:pt-0 border-t md:border-t-0 border-gray-100">
                                <div className="flex items-center gap-3">
                                    <span className={`text-xs font-bold uppercase ${member.role === 'admin' ? 'text-brandDark' : 'text-subInk'}`}>
                                        {member.role}
                                    </span>
                                    <button
                                        onClick={() => handleToggleRole(member)}
                                        className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${member.role === 'admin' ? 'bg-brand shadow-inner' : 'bg-gray-200'}`}
                                    >
                                        <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300 ${member.role === 'admin' ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                                <button
                                    onClick={() => handleDeleteUser(member)}
                                    className="flex items-center gap-1 text-red-400 hover:text-error text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                >
                                    <Trash2 size={12} /> Delete User
                                </button>
                            </div>

                        </motion.div>
                    ))
                )}
            </div>

            {/* Edit Member Modal */}
            <AnimatePresence>
                {editingMember && (
                    <div className="fixed inset-0 bg-ink/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-paper w-full max-w-md rounded-2xl border border-gray-200 shadow-xl overflow-hidden"
                        >
                            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white">
                                <h2 className="text-lg font-bold text-ink">Edit Member</h2>
                                <button onClick={() => setEditingMember(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="text-subInk hover:text-ink" size={20} /></button>
                            </div>
                            
                            <form onSubmit={handleSaveMember} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-subInk uppercase mb-1">Display Name</label>
                                    <input 
                                        type="text" 
                                        value={editForm.display_name} 
                                        onChange={e => setEditForm({...editForm, display_name: e.target.value})}
                                        className="w-full bg-canvas border border-gray-200 rounded-lg p-3 text-ink focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-subInk uppercase mb-1">Phone Number</label>
                                    <input 
                                        type="text" 
                                        value={editForm.phone_number} 
                                        onChange={e => setEditForm({...editForm, phone_number: e.target.value})}
                                        className="w-full bg-canvas border border-gray-200 rounded-lg p-3 text-ink focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-green-600 uppercase mb-1">LINE User ID</label>
                                    <input 
                                        type="text" 
                                        placeholder="Uxxxxxxxxxxxxxxxx..."
                                        value={editForm.line_user_id} 
                                        onChange={e => setEditForm({...editForm, line_user_id: e.target.value})}
                                        className="w-full bg-canvas border border-gray-200 rounded-lg p-3 text-ink focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none font-mono text-sm transition-all"
                                    />
                                    <p className="text-[10px] text-subInk mt-1">Found in LINE Developers console or via webhook.</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-subInk uppercase mb-1">Admin Notes</label>
                                    <textarea 
                                        rows={3}
                                        value={editForm.admin_notes} 
                                        onChange={e => setEditForm({...editForm, admin_notes: e.target.value})}
                                        className="w-full bg-canvas border border-gray-200 rounded-lg p-3 text-ink focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all"
                                    />
                                </div>

                                <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-4">
                                    <button type="button" onClick={() => setEditingMember(null)} className="px-4 py-2 text-subInk hover:text-ink font-medium text-sm">Cancel</button>
                                    <button type="submit" className="px-6 py-2 bg-brand text-ink font-bold rounded-lg hover:bg-brandDark hover:text-white transition-colors text-sm shadow-sm">Save Changes</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* History Modal */}
            <AnimatePresence>
                {selectedMember && (
                    <div className="fixed inset-0 bg-ink/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-paper w-full max-w-2xl max-h-[85vh] rounded-3xl border border-gray-200 shadow-2xl flex flex-col overflow-hidden"
                        >
                            <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-white">
                                <div>
                                    <h2 className="text-2xl font-bold text-ink">{selectedMember.display_name}</h2>
                                    <div className="flex flex-wrap gap-4 text-sm text-subInk mt-2">
                                        {selectedMember.nickname && <span>Nickname: <span className="text-ink font-medium">{selectedMember.nickname}</span></span>}
                                        <span>Phone: <span className="text-ink font-medium">{selectedMember.phone_number || '-'}</span></span>
                                        <span>Gender: <span className="text-ink font-medium">{selectedMember.gender || '-'}</span></span>
                                        <span>Birthday: <span className="text-ink font-medium">{selectedMember.birth_day ? `${selectedMember.birth_day}/${selectedMember.birth_month}` : '-'}</span></span>
                                        <span>Line ID: <span className="text-ink font-medium font-mono text-xs">{selectedMember.line_uid || '-'}</span></span>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedMember(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="text-subInk hover:text-ink" /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 bg-canvas">
                                <h3 className="font-bold text-ink mb-4 flex items-center gap-2">
                                    <Clock size={18} className="text-brandDark" /> Booking History
                                </h3>

                                {historyLoading ? (
                                    <div className="text-center py-10 text-subInk">Loading history...</div>
                                ) : memberHistory.length === 0 ? (
                                    <div className="text-center py-10 text-subInk opacity-60">No booking history found.</div>
                                ) : (
                                    <div className="space-y-3">
                                        {memberHistory.map(booking => (
                                            <div key={booking.id} className="bg-paper border border-gray-200 rounded-xl p-4 flex justify-between items-center hover:shadow-md transition-all">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${booking.status === 'completed' ? 'bg-green-50 text-green-600 border border-green-100' :
                                                            booking.status === 'pending' ? 'bg-yellow-50 text-yellow-600 border border-yellow-100' :
                                                                'bg-gray-100 text-subInk border border-gray-200'
                                                            }`}>
                                                            {booking.status}
                                                        </span>
                                                        <span className="text-xs text-subInk">{format(new Date(booking.created_at), 'dd MMM yyyy, HH:mm')}</span>
                                                    </div>
                                                    <div className="text-sm font-bold text-ink mb-1">
                                                        {booking.order_items?.map(i => `${i.menu_items?.name} (x${i.quantity})`).join(', ') || 'No Items'}
                                                    </div>
                                                    <div className="text-xs text-subInk">
                                                        Type: <span className="capitalize text-ink">{booking.booking_type}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-ink font-mono font-bold">{booking.total_amount}.-</div>
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
