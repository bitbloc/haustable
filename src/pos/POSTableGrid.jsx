import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { motion } from 'framer-motion';
import { Users, Clock, AlertCircle, Receipt } from 'lucide-react';

export default function POSTableGrid({ onSelectTable }) {
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTables();
        const sub = supabase.channel('pos-tables')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchTables)
            .subscribe();
        return () => supabase.removeChannel(sub);
    }, []);

    const fetchTables = async () => {
        const { data: tablesData } = await supabase.from('tables_layout').select('*').order('table_name');
        
        // Simplified status check for POC
        const today = new Date().toISOString().split('T')[0];
        const { data: activeBookings } = await supabase
            .from('bookings')
            .select('*')
            .in('status', ['pending', 'confirmed', 'seated', 'ready'])
            .gte('booking_time', `${today}T00:00:00`);

        const merged = (tablesData || []).map(t => {
            const booking = (activeBookings || []).find(b => b.table_id === t.id);
            return {
                ...t,
                status: booking ? (booking.status === 'pending' ? 'pending' : 'occupied') : 'free',
                booking: booking
            };
        });

        setTables(merged);
        setLoading(false);
    };

    if (loading) return (
        <div className="flex h-full items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
    );

    return (
        <div className="p-8 h-full overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                {tables.map((table) => (
                    <motion.button
                        key={table.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onSelectTable(table)}
                        className={`aspect-square rounded-3xl p-6 flex flex-col items-center justify-between border-2 transition-all relative overflow-hidden ${
                            table.status === 'occupied' 
                            ? 'bg-red-500/10 border-red-500/50 text-white' 
                            : table.status === 'pending'
                            ? 'bg-yellow-500/10 border-yellow-500/50 text-white animate-pulse'
                            : 'bg-[#1A1A1A] border-white/5 hover:border-orange-500/50'
                        }`}
                    >
                        {/* Status Badges */}
                        {table.status === 'pending' && (
                            <div className="absolute top-2 left-2 bg-yellow-500 text-black text-[9px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-md z-10">
                                <AlertCircle size={10} /> NEW
                            </div>
                        )}
                        {table.status === 'occupied' && table.booking?.payment_slip_url && (
                            <div className="absolute top-2 left-2 bg-green-500 text-black text-[9px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-md z-10">
                                <Receipt size={10} /> SLIP
                            </div>
                        )}

                        {/* Status Glow */}
                        <div className={`absolute top-0 right-0 w-2 h-2 rounded-full m-4 ${
                            table.status === 'occupied' ? 'bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 
                            table.status === 'pending' ? 'bg-yellow-500 animate-pulse shadow-[0_0_10px_rgba(234,179,8,0.5)]' :
                            'bg-green-500'
                        }`} />

                        <div className="flex flex-col items-center gap-2">
                             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${table.status === 'occupied' || table.status === 'pending' ? 'bg-red-500/20' : 'bg-white/5'}`}>
                                <Users size={24} className={table.status === 'occupied' || table.status === 'pending' ? 'text-red-400' : 'text-gray-400'} />
                             </div>
                             <span className="font-bold text-xl">{table.table_name}</span>
                        </div>

                        <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 font-medium">{table.capacity} Seats</span>
                            {(table.status === 'occupied' || table.status === 'pending') && (
                                <div className="flex items-center gap-1 text-[10px] text-red-400 font-bold mt-1">
                                    <Clock size={10} />
                                    <span>{new Date(table.booking.booking_time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit'})}</span>
                                </div>
                            )}
                        </div>
                    </motion.button>
                ))}
            </div>
        </div>
    );
}
