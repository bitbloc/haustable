import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Search, Shield, User, Phone, Clock, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function POSCRMPanel() {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMember, setSelectedMember] = useState(null);
    const [memberHistory, setMemberHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    useEffect(() => {
        fetchMembers();
    }, []);

    const fetchMembers = async () => {
        setLoading(true);
        try {
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (profileError) throw profileError;

            const { data: bookings, error: bookingError } = await supabase
                .from('bookings')
                .select('user_id, status');

            if (bookingError) throw bookingError;

            const merged = (profiles || []).map(p => {
                const userBookings = (bookings || []).filter(b => b.user_id === p.id);
                const completed = userBookings.filter(b => b.status === 'completed' || b.status === 'confirmed').length;
                return {
                    ...p,
                    total_bookings: userBookings.length,
                    completed_bookings: completed
                };
            });

            setMembers(merged);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectMember = async (member) => {
        setSelectedMember(member);
        setHistoryLoading(true);
        setMemberHistory([]);
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
                .order('created_at', { ascending: false });

            if (error) throw error;
            setMemberHistory(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setHistoryLoading(false);
        }
    };

    const filteredMembers = members.filter(m => {
        const nameMatch = (m.display_name || '').toLowerCase().includes(searchTerm.toLowerCase());
        const phoneMatch = (m.phone || '').toLowerCase().includes(searchTerm.toLowerCase());
        const emailMatch = (m.email || '').toLowerCase().includes(searchTerm.toLowerCase());
        return nameMatch || phoneMatch || emailMatch;
    });

    return (
        <div className="h-full flex bg-[#ECECE9] text-[#1A1A1A] font-sans overflow-hidden select-none">
            {/* Left side: CRM Registry List */}
            <div className="flex-1 flex flex-col p-6 overflow-hidden">
                {/* Search & Actions Bar */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 pb-4 border-b border-[#D1D1CD] shrink-0">
                    <div>
                        <h3 className="font-mono font-bold text-sm tracking-wider uppercase">CRM Customer Registry</h3>
                        <p className="text-[10px] text-[#767673] font-bold font-mono mt-0.5 uppercase tracking-tight">Active profiles and visitation log</p>
                    </div>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto font-mono text-[10px]">
                        <div className="relative w-full sm:w-56">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#767673]" size={14} />
                            <input 
                                type="search"
                                placeholder="SEARCH PROFILES..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white border border-[#D1D1CD] rounded-lg py-2 pl-9 pr-4 text-xs text-[#1A1A1A] placeholder-[#767673] focus:outline-none focus:border-[#ff0000] font-medium transition-colors"
                            />
                        </div>
                        <button 
                            onClick={fetchMembers}
                            className="p-2 bg-white hover:bg-[#E0E0DC] border border-[#D1D1CD] rounded-lg text-[#1A1A1A] cursor-pointer"
                        >
                            <RefreshCw size={14} />
                        </button>
                    </div>
                </div>

                {/* List Container */}
                <div className="flex-1 overflow-y-auto bg-white border border-[#D1D1CD] rounded-xl shadow-sm overflow-hidden flex flex-col">
                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center opacity-50 py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff0000] mb-2"></div>
                            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#767673]">SYNCING REGISTRY...</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-[#D1D1CD] bg-[#F5F5F2] text-[#767673] font-mono text-[9px] font-bold uppercase tracking-wider select-none">
                                        <th className="py-3 px-4">Profile</th>
                                        <th className="py-3 px-4">Contact</th>
                                        <th className="py-3 px-4">Access Tier</th>
                                        <th className="py-3 px-4 text-center">Visits</th>
                                        <th className="py-3 px-4 text-center">Completed</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#ECECE9]">
                                    {filteredMembers.map((m) => (
                                        <tr 
                                            key={m.id} 
                                            onClick={() => handleSelectMember(m)}
                                            className={`hover:bg-[#F5F5F2] cursor-pointer transition-colors ${selectedMember?.id === m.id ? 'bg-[#E0E0DC]' : ''}`}
                                        >
                                            <td className="py-3 px-4 flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full border border-[#D1D1CD] bg-[#ECECE9] overflow-hidden select-none shrink-0 p-0.5">
                                                    {m.avatar_url ? (
                                                        <img src={m.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full rounded-full bg-[#E0E0DC] flex items-center justify-center text-[#767673] font-mono font-bold text-xs">
                                                            {m.display_name?.charAt(0) || 'U'}
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-xs text-[#1A1A1A] uppercase tracking-tight">{m.display_name || 'Anonymous User'}</p>
                                                    <p className="text-[9px] font-mono text-[#767673] tracking-normal mt-0.5">{m.email || 'NO EMAIL LOG'}</p>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 font-mono text-[10px] text-[#1A1A1A]">
                                                {m.phone ? (
                                                    <span className="flex items-center gap-1.5"><Phone size={10} className="text-[#767673]" /> {m.phone}</span>
                                                ) : (
                                                    <span className="text-[#767673] italic">No Phone</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase tracking-wider ${
                                                    m.role === 'admin' ? 'bg-[#ff0000]/10 text-[#ff0000] border border-[#ff0000]/20' : 'bg-[#E0E0DC] text-[#1A1A1A] border border-[#B0B0AC]'
                                                }`}>
                                                    {m.role || 'GUEST'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center font-mono font-bold text-xs">{m.total_bookings}</td>
                                            <td className="py-3 px-4 text-center font-mono font-bold text-xs text-emerald-600">{m.completed_bookings}</td>
                                        </tr>
                                    ))}
                                    {filteredMembers.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="py-10 text-center font-mono text-[10px] text-[#767673] italic uppercase">
                                                No member profiles match filter query
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Right side: Selected Member Details / History Drawer */}
            <div className="w-[300px] border-l border-[#D1D1CD] bg-[#F5F5F2] flex flex-col h-full shrink-0 overflow-hidden">
                <AnimatePresence mode="wait">
                    {selectedMember ? (
                        <motion.div 
                            key={selectedMember.id}
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 20, opacity: 0 }}
                            className="flex flex-col h-full"
                        >
                            {/* Profile card summary */}
                            <div className="p-5 border-b border-[#D1D1CD] bg-white flex flex-col items-center text-center">
                                <div className="w-16 h-16 rounded-full border border-[#D1D1CD] bg-[#ECECE9] overflow-hidden p-1 shadow-sm mb-3">
                                    {selectedMember.avatar_url ? (
                                        <img src={selectedMember.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full rounded-full bg-[#E0E0DC] flex items-center justify-center text-[#767673] font-mono font-black text-2xl">
                                            {selectedMember.display_name?.charAt(0) || 'U'}
                                        </div>
                                    )}
                                </div>
                                <h4 className="font-bold text-sm text-[#1A1A1A] uppercase tracking-tight leading-none">{selectedMember.display_name}</h4>
                                <span className="font-mono text-[9px] font-bold text-[#767673] uppercase tracking-widest mt-1 block">REGISTRATION DETAIL</span>
                            </div>

                            {/* Visitation Log history */}
                            <div className="flex-1 flex flex-col p-4 overflow-hidden">
                                <h5 className="font-mono font-bold text-[9px] tracking-widest text-[#767673] uppercase mb-2">VISITATION LOG ({memberHistory.length})</h5>
                                
                                <div className="flex-1 overflow-y-auto space-y-2 scrollbar-none pr-1">
                                    {historyLoading ? (
                                        <div className="flex flex-col items-center justify-center opacity-50 py-12">
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#ff0000] mb-2"></div>
                                            <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-[#767673]">LOADING LOGS...</span>
                                        </div>
                                    ) : (
                                        memberHistory.map((h, i) => (
                                            <div key={i} className="bg-white border border-[#D1D1CD] rounded-lg p-3 space-y-1.5 shadow-sm text-[10px] font-mono">
                                                <div className="flex justify-between items-center font-bold text-[#1A1A1A]">
                                                    <span className="uppercase text-[9px]">VISIT #{h.tracking_token ? h.tracking_token.slice(-4).toUpperCase() : h.id.slice(0, 4)}</span>
                                                    <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase ${
                                                        h.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                    }`}>
                                                        {h.status}
                                                    </span>
                                                </div>
                                                <p className="text-[#767673] font-mono flex items-center gap-1">
                                                    <Clock size={10} /> {new Date(h.booking_time).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                                                </p>
                                                <div className="border-t border-[#ECECE9] pt-1.5 mt-1.5 text-[#1A1A1A]">
                                                    <p className="font-bold text-[9px] text-[#767673] uppercase mb-1">ORDER ITEMS</p>
                                                    {h.order_items?.map((item, idx) => (
                                                        <div key={idx} className="flex justify-between">
                                                            <span className="truncate max-w-[180px]">{item.menu_items?.name}</span>
                                                            <span className="font-bold">x{item.quantity}</span>
                                                        </div>
                                                    ))}
                                                    {(!h.order_items || h.order_items.length === 0) && (
                                                        <span className="text-[#767673] italic">No items ordered</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    {memberHistory.length === 0 && !historyLoading && (
                                        <div className="text-center font-mono text-[9px] text-[#767673] py-12 uppercase italic">
                                            No visits logged for this customer
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#767673] font-mono text-[9px] font-bold uppercase tracking-widest leading-normal">
                            <User size={24} className="mb-2 text-[#767673]/50" />
                            <span>Select a customer registry profile to view log</span>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
