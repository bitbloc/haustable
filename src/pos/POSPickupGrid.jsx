import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { motion } from 'framer-motion';
import { 
    Clock, 
    AlertCircle, 
    Search,
    ShoppingBag,
    Plus,
    User,
    Phone
} from 'lucide-react';

export default function POSPickupGrid({ onSelectOrder, hasPendingOrders, refreshKey }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'ready', 'completed'

    useEffect(() => {
        fetchOrders();
    }, []);

    useEffect(() => {
        if (refreshKey > 0) {
            fetchOrders();
        }
    }, [refreshKey]);

    const fetchOrders = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data: pickupBookings, error } = await supabase
                .from('bookings')
                .select('*')
                .eq('booking_type', 'pickup')
                .gte('booking_time', `${today}T00:00:00+07:00`)
                .order('booking_time', { ascending: false });

            if (error) throw error;
            
            const activeOrRecent = (pickupBookings || []).filter(b => b.status !== 'completed' || b.status === 'completed');
            setOrders(activeOrRecent);
        } catch (err) {
            console.error('Failed to fetch pickup orders:', err);
            try {
                const cachedBookings = JSON.parse(localStorage.getItem('pos_cache_active_bookings')) || [];
                const pickupCached = cachedBookings.filter(b => b.booking_type === 'pickup');
                setOrders(pickupCached);
            } catch (e) {}
        } finally {
            setLoading(false);
        }
    };

    const filteredOrders = orders.filter(order => {
        const cName = (order.pickup_contact_name || order.customer_note || '').toLowerCase();
        const matchesSearch = cName.includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if (loading) return (
        <div className="flex h-full items-center justify-center bg-[#ECECE9]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff0000]"></div>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-[#ECECE9] overflow-hidden select-none font-sans text-[#1A1A1A]">
            <div className="p-4 bg-[#F5F5F2] border-b border-[#D1D1CD] flex flex-col md:flex-row gap-4 items-center justify-between z-10 shrink-0 shadow-sm">
                
                <div></div>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full sm:w-56">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#767673]" size={16} />
                        <input 
                            type="search" 
                            placeholder="ค้นหาชื่อ/เลขออเดอร์..." 
                            className="w-full bg-white border border-[#D1D1CD] rounded-lg py-2 pl-10 pr-4 text-xs text-[#1A1A1A] placeholder-[#767673] focus:outline-none focus:border-black font-medium transition-colors"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex bg-[#E0E0DC] p-0.5 rounded-lg border border-[#D1D1CD] text-[10px] font-mono font-bold uppercase tracking-wider">
                        <button 
                            type="button"
                            onClick={() => setStatusFilter('all')}
                            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${statusFilter === 'all' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                        >
                            ALL
                        </button>
                        <button 
                            type="button"
                            onClick={() => setStatusFilter('pending')}
                            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${statusFilter === 'pending' ? 'bg-white text-red-600 shadow-sm' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                        >
                            PENDING
                        </button>
                        <button 
                            type="button"
                            onClick={() => setStatusFilter('seated')}
                            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${statusFilter === 'seated' ? 'bg-white text-blue-600 shadow-sm' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                        >
                            PREPARING
                        </button>
                        <button 
                            type="button"
                            onClick={() => setStatusFilter('ready')}
                            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${statusFilter === 'ready' ? 'bg-white text-green-600 shadow-sm' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                        >
                            READY
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto scrollbar-none">
                {filteredOrders.length === 0 ? (
                    <div className="flex flex-col h-full items-center justify-center text-[#767673] gap-2 font-mono text-xs font-bold uppercase tracking-wider">
                        <AlertCircle size={24} />
                        <span>No pick-up orders found</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredOrders.map((order) => {
                            const remarkLower = (order.staff_remark || '').toLowerCase();
                            const sourceLower = (order.source || '').toLowerCase();
                            const isOnline = sourceLower === 'online' || sourceLower === 'line' || sourceLower === 'qr' || remarkLower.includes('qr') || remarkLower.includes('online') || !!order.payment_slip_url;
                            const isPending = order.status === 'pending';
                            const isReady = order.status === 'ready';
                            const isCompleted = order.status === 'completed';

                            let cardBg = 'bg-white border-[#D1D1CD] hover:border-[#B0B0AC]';
                            let accentColor = 'bg-[#767673]';
                            
                            if (isPending) {
                                cardBg = 'bg-red-50 border-red-200 shadow-sm animate-pulse';
                                accentColor = 'bg-red-500';
                            } else if (isReady) {
                                cardBg = 'bg-green-50 border-green-200 shadow-sm';
                                accentColor = 'bg-green-500';
                            } else if (isCompleted) {
                                cardBg = 'bg-[#EAEAE8] border-[#D1D1CD] opacity-70';
                                accentColor = 'bg-gray-400';
                            }

                            return (
                                <motion.button
                                    key={order.id}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => onSelectOrder(order)}
                                    className={`min-h-[140px] rounded-xl p-4 flex flex-col justify-between border cursor-pointer relative overflow-hidden transition-all duration-200 ${cardBg} text-left`}
                                >
                                    <div className="flex justify-between items-start w-full">
                                        <div className="flex gap-2 items-center">
                                            {isOnline ? (
                                                <span className="bg-blue-100 text-blue-700 border border-blue-200 text-[9px] font-mono font-bold px-2 py-0.5 rounded tracking-widest uppercase">
                                                    [ ONLINE ]
                                                </span>
                                            ) : (
                                                <span className="bg-purple-100 text-purple-700 border border-purple-200 text-[9px] font-mono font-bold px-2 py-0.5 rounded tracking-widest uppercase">
                                                    [ IN-HAUS ]
                                                </span>
                                            )}
                                            {order.deposit_amount >= order.total_amount && order.total_amount > 0 && (
                                                <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-[9px] font-mono font-bold px-2 py-0.5 rounded tracking-widest uppercase">
                                                    [ PAID ]
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#767673]">
                                                {order.status}
                                            </span>
                                            <span className={`w-2 h-2 rounded-full border border-black/10 ${accentColor}`} />
                                        </div>
                                    </div>
            
                                    <div className="flex flex-col gap-1 my-3 text-[#1A1A1A]">
                                         <div className="font-bold text-lg leading-tight line-clamp-1">
                                             {order.pickup_contact_name || order.customer_note || 'Walk-in Pick-up'}
                                         </div>
                                         {(order.pickup_contact_phone) && (
                                            <div className="text-xs font-mono font-bold tracking-tight text-[#767673] flex items-center gap-1">
                                                <Phone size={10} />
                                                {order.pickup_contact_phone}
                                            </div>
                                         )}
                                         <div className="text-[10px] font-mono text-[#767673] line-clamp-1 mt-1 uppercase">
                                             ID: #{order.id.substring(0,8)}
                                         </div>
                                    </div>
            
                                    <div className="flex justify-between items-center w-full border-t border-black/5 pt-2 text-[10px] font-mono font-bold tracking-wider">
                                        <div className="flex items-center gap-1 text-[#767673]">
                                            <Clock size={11} />
                                            <span>สั่ง: {order.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit'}) : '-'}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-amber-900 bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-300/80 font-bold">
                                            <ShoppingBag size={11} />
                                            <span>รับ: {new Date(order.booking_time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit'})}</span>
                                        </div>
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
