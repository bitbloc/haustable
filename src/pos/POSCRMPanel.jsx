import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Search, Shield, User, Phone, Clock, RefreshCw, FileText, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getShortBookingId } from '../utils/printerHelper';
import POSBillDetailsModal from './POSBillDetailsModal';
import { posCache } from '../utils/offlineHelper';

export default function POSCRMPanel({ onAttachToOrder, isActive = true }) {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMember, setSelectedMember] = useState(null);
    const [memberHistory, setMemberHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [activeViewBooking, setActiveViewBooking] = useState(null);

    const [hasSession, setHasSession] = useState(true);
    
    // In-memory cache for instant 0ms history switching
    const historyCacheRef = useRef(new Map());
    const selectedMemberRef = useRef(selectedMember);
    selectedMemberRef.current = selectedMember;

    const fetchMembers = useCallback(async (isInitial = false) => {
        if (isInitial) setLoading(true);
        try {
            // 1. Fetch Profiles
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('id, display_name, nickname, phone_number, email, avatar_url, role, current_tier, xhaus_balance, drink_stamp_count, free_drink_quota, created_at')
                .order('created_at', { ascending: false })
                .limit(200);

            if (profileError) throw profileError;

            // 2. Fetch Aggregated Bookings efficiently (user_id and status only)
            const { data: bookings, error: bookingError } = await supabase
                .from('bookings')
                .select('user_id, pickup_contact_phone, status')
                .in('status', ['completed', 'confirmed', 'seated', 'pending', 'paid']);

            // O(M) Map aggregation
            const bookingMapByUser = new Map();
            const bookingMapByPhone = new Map();

            if (bookings && Array.isArray(bookings)) {
                bookings.forEach(b => {
                    const isFinished = b.status === 'completed' || b.status === 'confirmed' || b.status === 'paid';
                    if (b.user_id) {
                        const cur = bookingMapByUser.get(b.user_id) || { total: 0, completed: 0 };
                        cur.total++;
                        if (isFinished) cur.completed++;
                        bookingMapByUser.set(b.user_id, cur);
                    }
                    if (b.pickup_contact_phone) {
                        const norm = b.pickup_contact_phone.replace(/\D/g, '');
                        if (norm) {
                            const curP = bookingMapByPhone.get(norm) || { total: 0, completed: 0 };
                            curP.total++;
                            if (isFinished) curP.completed++;
                            bookingMapByPhone.set(norm, curP);
                        }
                    }
                });
            }

            // O(N) linear merge
            const merged = (profiles || []).map(p => {
                const normPPhone = p.phone_number ? p.phone_number.replace(/\D/g, '') : '';
                const userStat = bookingMapByUser.get(p.id);
                const phoneStat = normPPhone ? bookingMapByPhone.get(normPPhone) : null;
                
                const totalBookings = userStat?.total || phoneStat?.total || 0;
                const completedBookings = userStat?.completed || phoneStat?.completed || 0;

                return {
                    ...p,
                    total_bookings: totalBookings,
                    completed_bookings: completedBookings
                };
            });

            setMembers(merged);

            // Keep selected member stats updated silently
            const curSel = selectedMemberRef.current;
            if (curSel?.id) {
                const updatedSel = merged.find(m => m.id === curSel.id);
                if (updatedSel) {
                    setSelectedMember(prev => ({ ...prev, ...updatedSel }));
                }
            }
        } catch (err) {
            console.error('Failed to load CRM members:', err);
        } finally {
            if (isInitial) setLoading(false);
        }
    }, []);

    const handleSelectMember = useCallback(async (member) => {
        if (!member?.id) return;
        setSelectedMember(member);

        // Instant cache lookup for 0ms response
        const cachedHistory = historyCacheRef.current.get(member.id);
        if (cachedHistory) {
            setMemberHistory(cachedHistory);
            setHistoryLoading(false);
        } else {
            setMemberHistory([]);
            setHistoryLoading(true);
        }

        try {
            let fetchedHistory = [];
            const { data: rpcData, error: rpcErr } = await supabase.rpc('get_member_service_history', { p_user_id: member.id });
            if (!rpcErr && rpcData && Array.isArray(rpcData)) {
                fetchedHistory = rpcData;
            } else {
                const { data, error } = await supabase
                    .from('bookings')
                    .select(`
                        *,
                        order_items (
                            id,
                            quantity,
                            price_at_time,
                            menu_items (name)
                        )
                    `)
                    .or(`user_id.eq.${member.id},pickup_contact_phone.eq.${member.phone_number || 'NONE'}`)
                    .order('created_at', { ascending: false })
                    .limit(50);

                if (error) throw error;
                fetchedHistory = data || [];
            }
            
            // Merge local/offline completed bills
            const localBookings = posCache.getBookings().filter(b => b.user_id === member.id && b.status === 'completed');
            const mergedHistory = [...fetchedHistory];
            
            localBookings.forEach(localB => {
                if (!mergedHistory.find(h => h.id === localB.id)) {
                    mergedHistory.unshift({
                        ...localB,
                        order_items: localB.order_items || [],
                        is_offline: true
                    });
                }
            });
            
            // Sort merged history by created_at descending
            mergedHistory.sort((a, b) => new Date(b.created_at || b.booking_time) - new Date(a.created_at || a.booking_time));
            
            // Save to in-memory cache
            historyCacheRef.current.set(member.id, mergedHistory);
            
            // Only update state if this member is still the selected one
            if (selectedMemberRef.current?.id === member.id) {
                setMemberHistory(mergedHistory);
            }
        } catch (err) {
            console.error('Failed to load member service history:', err);
        } finally {
            if (selectedMemberRef.current?.id === member.id) {
                setHistoryLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        if (!isActive) return;
        
        supabase.auth.getSession().then(({ data: { session } }) => {
            setHasSession(!!session);
            if (session) {
                fetchMembers(true);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setHasSession(!!session);
            if (session) {
                fetchMembers(false);
            }
        });

        // Supabase Realtime subscription for live CRM updates (does NOT depend on selectedMember)
        const channel = supabase
            .channel('pos_crm_panel_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
                if (isActive) {
                    fetchMembers(false);
                    const curSel = selectedMemberRef.current;
                    if (curSel?.id) {
                        handleSelectMember(curSel);
                    }
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                if (isActive) fetchMembers(false);
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
            supabase.removeChannel(channel);
        };
    }, [isActive, fetchMembers, handleSelectMember]);

    const filteredMembers = useMemo(() => {
        if (!searchTerm.trim()) return members;
        const term = searchTerm.toLowerCase().trim();
        return members.filter(m => {
            const nameMatch = (m.display_name || '').toLowerCase().includes(term);
            const phoneMatch = (m.phone_number || '').includes(term);
            const emailMatch = (m.email || '').toLowerCase().includes(term);
            const nicknameMatch = (m.nickname || '').toLowerCase().includes(term);
            return nameMatch || phoneMatch || emailMatch || nicknameMatch;
        });
    }, [members, searchTerm]);

    if (!hasSession) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-[#ECECE9] p-6 font-sans">
                <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl p-8 max-w-md w-full shadow-lg flex flex-col items-center text-center gap-4">
                    <div className="w-14 h-14 bg-[oklch(52%_0.16_28)]/10 text-[oklch(52%_0.16_28)] rounded-full flex items-center justify-center border border-[oklch(52%_0.16_28)]/20 shadow-inner">
                        <User size={28} />
                    </div>
                    <h3 className="text-base font-bold text-[#1A1A1A]">ยังไม่ได้เข้าสู่ระบบ LINE / Supabase</h3>
                    <p className="text-xs text-[oklch(42%_0.010_28)] leading-relaxed">
                        ไม่สามารถแสดงข้อมูลลูกค้าระบบ CRM ได้เนื่องจากยังไม่ได้ล็อกอินด้วยบัญชีที่มีสิทธิ์ใช้งาน กรุณาเข้าสู่ระบบผ่าน LINE LIFF ก่อนครับ
                    </p>
                    <button 
                        onClick={() => window.location.href = '/login?redirect=/pos'}
                        className="bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-[oklch(97%_0.008_28)] py-3 px-6 rounded-xl font-bold text-xs uppercase tracking-wide transition-all shadow-md active:scale-98 cursor-pointer select-none"
                    >
                        เข้าสู่ระบบ LINE (LIFF)
                    </button>
                </div>
            </div>
        );
    }

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
                                        <th className="py-3 px-4 text-right">xhaus Coins</th>
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
                                                {m.phone_number ? (
                                                    <span className="flex items-center gap-1.5"><Phone size={10} className="text-[#767673]" /> {m.phone_number}</span>
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
                                            <td className="py-3 px-4 text-right font-mono font-bold text-xs text-[oklch(52%_0.16_28)]">
                                                {Number(m.xhaus_balance || 0).toFixed(2)}
                                            </td>
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
                                {selectedMember.phone_number && (
                                    <span className="font-mono text-[10px] text-[#1A1A1A] mt-1.5 flex items-center gap-1"><Phone size={10} className="text-[#767673]" /> {selectedMember.phone_number}</span>
                                )}
                                <span className="font-mono text-[9px] font-bold text-[#767673] uppercase tracking-widest mt-1 block">REGISTRATION DETAIL</span>

                                {/* Stats grid */}
                                <div className="grid grid-cols-3 gap-2 w-full mt-3 pt-3 border-t border-[#ECECE9]">
                                    <div className="text-center">
                                        <p className="font-mono font-bold text-sm text-[#1A1A1A]">{selectedMember.total_bookings || 0}</p>
                                        <p className="font-mono text-[7px] text-[#767673] uppercase font-bold tracking-wider">Visits</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-mono font-bold text-sm text-[oklch(52%_0.16_28)]">{Number(selectedMember.xhaus_balance || 0).toFixed(0)}</p>
                                        <p className="font-mono text-[7px] text-[#767673] uppercase font-bold tracking-wider">xhaus</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-mono font-bold text-sm text-[#1A1A1A]">{selectedMember.free_drink_quota || 0}</p>
                                        <p className="font-mono text-[7px] text-[#767673] uppercase font-bold tracking-wider">Free Drink</p>
                                    </div>
                                </div>

                                {/* Drink Stamp Progress (10 free 1) */}
                                {(() => {
                                    const stamps = selectedMember.drink_stamp_count || 0;
                                    const maxStamps = 10;
                                    const freeDrinks = selectedMember.free_drink_quota || 0;
                                    return (
                                        <div className="w-full mt-3 pt-3 border-t border-[#ECECE9]">
                                            <div className="flex justify-between items-center mb-1.5">
                                                <span className="font-mono text-[8px] font-bold text-[#767673] uppercase tracking-wider">Drink Stamps</span>
                                                <span className="font-mono text-[9px] font-bold text-[#1A1A1A]">{stamps} / {maxStamps}</span>
                                            </div>
                                            <div className="flex gap-1">
                                                {Array.from({ length: maxStamps }).map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className={`flex-1 h-2 rounded-full transition-all ${
                                                            i < stamps ? 'bg-[oklch(52%_0.16_28)]' : 'bg-[#E0E0DC]'
                                                        }`}
                                                    />
                                                ))}
                                            </div>
                                            {freeDrinks > 0 && (
                                                <p className="font-mono text-[9px] font-bold text-emerald-600 mt-1.5 text-center uppercase">
                                                    {freeDrinks} FREE DRINK AVAILABLE
                                                </p>
                                            )}
                                        </div>
                                    );
                                })()}

                                {onAttachToOrder && (
                                    <button
                                        type="button"
                                        onClick={() => onAttachToOrder(selectedMember)}
                                        className="w-full mt-3 bg-[oklch(18%_0.012_28)] hover:bg-black text-[oklch(97%_0.008_28)] py-2.5 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        <ShoppingBag size={14} className="text-[oklch(52%_0.16_28)]" /> ผูกสมาชิก & สั่งซื้อ
                                    </button>
                                )}
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
                                                    <span className="uppercase text-[9px]">VISIT #{getShortBookingId(h)} {h.is_offline && <span className="text-amber-500 bg-amber-50 px-1 rounded ml-1 lowercase">(offline)</span>}</span>
                                                    <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase ${
                                                        h.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                    }`}>
                                                        {h.status}
                                                    </span>
                                                </div>
                                                <div className="text-[#767673] font-mono flex items-center justify-between gap-1 text-[9px]">
                                                    <span className="flex items-center gap-1"><Clock size={10} /> {new Date(h.booking_time).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                                    {(() => {
                                                        const startMins = Math.max(0, Math.floor(((h.updated_at ? new Date(h.updated_at).getTime() : Date.now()) - new Date(h.booking_time).getTime()) / 60000));
                                                        let tag = { label: '⚡ กินแล้วไป', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
                                                        if (startMins > 120) {
                                                            tag = { label: '🔥 นั่งแช่ยยาว (>2ชม.)', color: 'bg-amber-50 text-amber-700 border-amber-200' };
                                                        } else if (startMins > 45) {
                                                            tag = { label: '☕ นั่งชิล (45-120ม.)', color: 'bg-blue-50 text-blue-700 border-blue-200' };
                                                        }
                                                        return (
                                                            <span className={`px-1 py-0.5 rounded text-[8px] font-bold border ${tag.color}`}>
                                                                {tag.label}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                                {(Number(h.xhaus_earned || 0) > 0 || Number(h.xhaus_redeemed || 0) > 0 || Number(h.xhaus_discount || 0) > 0) && (
                                                    <div className="flex flex-wrap gap-1 mt-1 font-mono text-[8px] font-bold">
                                                        {Number(h.xhaus_earned || 0) > 0 && (
                                                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                +{Number(h.xhaus_earned)} xhaus
                                                            </span>
                                                        )}
                                                        {Number(h.xhaus_redeemed || 0) > 0 && (
                                                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                                                -{Number(h.xhaus_redeemed)} xhaus
                                                            </span>
                                                        )}
                                                        {Number(h.xhaus_discount || 0) > 0 && (
                                                            <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                                                -฿{Number(h.xhaus_discount).toLocaleString()} disc
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="border-t border-[#ECECE9] pt-1.5 mt-1.5 text-[#1A1A1A]">
                                                    <p className="font-bold text-[9px] text-[#767673] uppercase mb-1">ORDER ITEMS</p>
                                                    {h.order_items?.map((item, idx) => (
                                                        <div key={idx} className="flex justify-between">
                                                            <span className="truncate max-w-[180px]">{item.item_name || item.name || item.menu_items?.name || 'รายการสินค้า'}</span>
                                                            <span className="font-bold">x{item.quantity}</span>
                                                        </div>
                                                    ))}
                                                    {(!h.order_items || h.order_items.length === 0) && (
                                                        <span className="text-[#767673] italic">No items ordered</span>
                                                    )}
                                                    
                                                    {/* Add View Bill Details Button */}
                                                    <div className="pt-2 mt-2 border-t border-dashed border-[#ECECE9]">
                                                        <button
                                                            type="button"
                                                            onClick={() => setActiveViewBooking(h)}
                                                            className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-[#F5F5F2] hover:bg-[#E0E0DC] border border-[#D1D1CD] text-[#1A1A1A] rounded text-[9px] font-bold uppercase tracking-widest transition-colors"
                                                        >
                                                            <FileText size={10} /> View Bill Details
                                                        </button>
                                                    </div>
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
            
            {/* View Bill Details Modal */}
            {activeViewBooking && (
                <POSBillDetailsModal 
                    booking={activeViewBooking} 
                    onClose={() => setActiveViewBooking(null)} 
                />
            )}
        </div>
    );
}
