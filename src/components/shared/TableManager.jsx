import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { ZoomIn, ZoomOut, RotateCw, Clock, User, Phone, CheckCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function TableManager({ isStaffView = false }) {
    const [tables, setTables] = useState([]);
    const [bookings, setBookings] = useState([]); // Current Active Bookings
    const [floorplanUrl, setFloorplanUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedTable, setSelectedTable] = useState(null); // For Action Modal
    
    // Auto-refresh interval
    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // Poll every 30s
        
        // Subscribe to realtime changes for instant updates
        const channel = supabase
            .channel('table-manager')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
                fetchData();
            })
            .subscribe();

        return () => {
             clearInterval(interval);
             supabase.removeChannel(channel);
        };
    }, []);

    const fetchData = async () => {
        try {
            // 1. Tables
            const { data: tablesData } = await supabase.from('tables_layout').select('*');
            if (tablesData) setTables(tablesData);

            // 2. Settings (Floorplan)
            const { data: settingsData } = await supabase.from('app_settings').select('value').eq('key', 'floorplan_url').single();
            if (settingsData?.value) setFloorplanUrl(settingsData.value);

            // 3. Active Bookings
            const today = new Date().toISOString().split('T')[0];
            const start = `${today}T00:00:00`;
            const end = `${today}T23:59:59`;

            const { data: bookingsData } = await supabase
                .from('bookings')
                .select('*, profiles(display_name, phone_number)')
                .in('status', ['confirmed', 'pending', 'seated', 'ready', 'approved', 'paid'])
                .gte('booking_time', start)
                .lte('booking_time', end);
            
            if (bookingsData) setBookings(bookingsData);

            setLoading(false);
        } catch (err) {
            console.error("Fetch Error", err);
        }
    };

    // --- Logic ---
    const getTableStatus = (tableId) => {
        const now = new Date();
        const tableBookings = bookings.filter(b => b.table_id === tableId);
        
        if (tableBookings.length === 0) return 'free';

        // Check for current overlap
        const currentBooking = tableBookings.find(b => {
             const start = new Date(b.booking_time);
             const endTime = b.end_time ? new Date(b.end_time) : new Date(start.getTime() + (2 * 60 * 60 * 1000));
             return now >= start && now < endTime;
        });

        if (currentBooking) {
            return {
                status: 'occupied',
                type: ['steak', 'preorder_steak'].includes(currentBooking.booking_type) ? 'steak' : (currentBooking.booking_type === 'walk_in' ? 'walk_in' : 'online'),
                booking: currentBooking
            };
        }

        // Check for future/upcoming in next 60 mins (Warning)
        const upcomingBooking = tableBookings.find(b => {
            const start = new Date(b.booking_time);
            const diff = (start - now) / 60000;
            return diff > 0 && diff <= 60;
        });

        if (upcomingBooking) {
            return {
                status: 'upcoming',
                booking: upcomingBooking
            };
        }

        return 'free';
    };

    // --- Actions ---
    const handleTableClick = (table, statusData) => {
        if (statusData === 'free') {
            quickBlock(table);
        } else {
            setSelectedTable({ table, statusData });
        }
    };

    const quickBlock = async (table) => {
        try {
            const now = new Date();
            const endTime = new Date(now.getTime() + (2 * 60 * 60 * 1000)); // +2 Hours

            const payload = {
                table_id: table.id,
                booking_time: now.toISOString(),
                end_time: endTime.toISOString(),
                booking_type: 'walk_in',
                status: 'confirmed',
                pickup_contact_name: 'Walk-in Guest',
                customer_note: 'Internal Block',
                pax: table.capacity,
                total_amount: 0,
                tracking_token: crypto.randomUUID()
            };

            const { error } = await supabase.from('bookings').insert(payload);
            if (error) throw error;

            toast.success(`Blocked ${table.table_name} for 2 Hours`, {
                description: 'Tap table again to release',
                duration: 2000
            });
            fetchData(); 

        } catch (err) {
            toast.error('Failed to block: ' + err.message);
        }
    };

    const handleRelease = async (bookingId) => {
        try {
            const { error } = await supabase
                .from('bookings')
                .update({ status: 'completed', end_time: new Date().toISOString() })
                .eq('id', bookingId);

            if (error) throw error;
            
            toast.success('Table Released');
            setSelectedTable(null);
            fetchData();
        } catch (err) {
            toast.error('Release failed: ' + err.message);
        }
    };

    const handleExtendTime = async (bookingId, minutes) => {
        try {
             const booking = selectedTable.statusData.booking;
             const currentEnd = booking.end_time ? new Date(booking.end_time) : new Date(new Date(booking.booking_time).getTime() + 2*60*60*1000);
             const newEnd = new Date(currentEnd.getTime() + (minutes * 60000));

             const { error } = await supabase.from('bookings').update({ end_time: newEnd.toISOString() }).eq('id', bookingId);
             if (error) throw error;
             
             toast.success(`Extended by ${minutes} mins`);
             setSelectedTable(null);
             fetchData();

        } catch (err) {
             toast.error('Extend failed');
        }
    };

    // --- Renderers ---
    const renderTable = (table) => {
        const statusData = getTableStatus(table.id);
        const isOccupied = typeof statusData === 'object' && statusData.status === 'occupied';
        const isUpcoming = typeof statusData === 'object' && statusData.status === 'upcoming';
        
        let tableBgClass = 'bg-white border-[#D1D1CD] text-[#1A1A1A]';
        let ledColor = 'bg-[#00CC44]'; // Green LED
        
        if (isOccupied) {
            if (statusData.type === 'walk_in') {
                tableBgClass = 'bg-[#FF5500] border-[#E04B00] text-white';
                ledColor = 'bg-white';
            } else if (statusData.type === 'steak') {
                tableBgClass = 'bg-amber-400 border-amber-500 text-black';
                ledColor = 'bg-[#FF5500]';
            } else {
                tableBgClass = 'bg-[#3C3D40] border-[#2A2B2D] text-white';
                ledColor = 'bg-[#FF3300]'; // Red LED
            }
            
            if (statusData.booking?.staff_remark?.includes('[CALL_STAFF]')) {
                tableBgClass = 'animate-pos-blink border-2 shadow-md';
                ledColor = 'bg-[#FF0055] animate-ping';
            } else if (statusData.booking?.staff_remark?.includes('[CALL_BILL]')) {
                tableBgClass = 'animate-pos-blink border-2 shadow-md';
                ledColor = 'bg-[#FFAA00] animate-ping';
            }
        } else if (isUpcoming) {
            tableBgClass = 'bg-[#FFF9E6] border-[#E5A900] text-[#805E00]';
            ledColor = 'bg-[#FFAA00] animate-pulse';
        }

        const rotation = table.rotation || 0;
        const style = {
            position: 'absolute',
            left: `${table.pos_x}%`,
            top: `${table.pos_y}%`,
            width: `${table.width}%`,
            height: `${table.height}%`,
            transform: `rotate(${rotation}deg)`,
            transition: 'all 0.25s ease'
        };

        return (
            <div
                key={table.id}
                onClick={(e) => { e.stopPropagation(); handleTableClick(table, statusData); }}
                style={style}
                className={`cursor-pointer select-none flex flex-col items-center justify-center p-1 border shadow-sm hover:scale-102 hover:shadow-md active:scale-98 transition-all ${table.shape === 'circle' ? 'rounded-full' : 'rounded-lg'} ${tableBgClass}`}
            >
                {/* Status LED */}
                <div className="absolute top-1 right-1 flex items-center gap-1">
                    {isOccupied && statusData.booking?.staff_remark?.includes('[CALL_STAFF]') && (
                        <span className="bg-[#FF0055] text-white text-[6px] font-mono font-bold px-0.5 rounded leading-none animate-pulse">CALL</span>
                    )}
                    {isOccupied && statusData.booking?.staff_remark?.includes('[CALL_BILL]') && (
                        <span className="bg-[#FFAA00] text-black text-[6px] font-mono font-bold px-0.5 rounded leading-none animate-pulse">BILL</span>
                    )}
                    {isOccupied && statusData.booking?.payment_slip_url && (
                        <span className="bg-[#FF5500] text-white text-[6px] font-mono font-bold px-0.5 rounded leading-none">SLIP</span>
                    )}
                    <span className={`w-1.5 h-1.5 rounded-full border border-black/10 block ${ledColor}`}></span>
                </div>

                <div className="flex flex-col items-center pointer-events-none select-none p-0.5 overflow-hidden w-full text-center" style={{ transform: `rotate(${-rotation}deg)` }}>
                    <span className="font-mono font-bold text-[11px] tracking-tight truncate max-w-[90%] leading-tight">{table.table_name}</span>
                    <span className="text-[8px] font-mono font-bold opacity-60 mt-0.5 uppercase">{table.capacity}p</span>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-[#ECECE9] w-full h-full min-h-[500px] relative overflow-hidden flex flex-col rounded-xl border border-[#D1D1CD] text-[#1A1A1A] font-sans select-none">
            {/* Header / Instructions */}
            <div className="absolute top-4 left-4 z-10 bg-[#F5F5F2]/95 border border-[#D1D1CD] p-3 rounded-lg shadow-sm backdrop-blur-md font-mono text-[9px] font-bold uppercase tracking-wider text-[#767673]">
                <div className="flex flex-wrap items-center gap-3 mb-1 text-[#1A1A1A]">
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#00CC44] border border-black/10"></span> VACANT</div>
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#FF5500] border border-black/10"></span> WALK-IN</div>
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#3C3D40] border border-black/10"></span> ONLINE</div>
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#FFAA00] animate-pulse border border-black/10"></span> UPCOMING</div>
                </div>
                <div className="text-[8px] border-t border-[#D1D1CD] pt-1.5 mt-1.5 leading-normal">
                    TAP VACANT TO QUICK-BLOCK (2HR). TAP OCCUPIED TO VIEW/RELEASE.
                </div>
            </div>

            <TransformWrapper 
                initialScale={0.8} 
                minScale={0.2} 
                maxScale={4} 
                centerOnInit={true} 
                limitToBounds={false}
                panning={{ velocityDisabled: false }}
            >
                {({ zoomIn, zoomOut, resetTransform }) => (
                    <>
                         <div className="absolute bottom-4 right-4 z-10 flex gap-1 bg-[#F5F5F2]/95 border border-[#D1D1CD] p-1 rounded-lg shadow-sm backdrop-blur-md">
                             <button onClick={() => zoomIn()} className="p-2 hover:bg-[#E0E0DC] rounded transition-colors text-[#1A1A1A] cursor-pointer"><ZoomIn size={16}/></button>
                             <button onClick={() => zoomOut()} className="p-2 hover:bg-[#E0E0DC] rounded transition-colors text-[#1A1A1A] cursor-pointer"><ZoomOut size={16}/></button>
                             <button onClick={() => resetTransform()} className="p-2 hover:bg-[#E0E0DC] rounded transition-colors text-[#1A1A1A] cursor-pointer"><RotateCw size={16}/></button>
                         </div>

                         <TransformComponent wrapperClass="w-full h-full cursor-grab active:cursor-grabbing" contentStyle={{ width: '100%', height: '100%' }}>
                            <div 
                                className="relative w-[1000px] aspect-video bg-[#E1E1DE] shadow-sm border border-[#D1D1CD] rounded-[24px] overflow-hidden origin-center"
                                style={{
                                    backgroundImage: floorplanUrl ? `url(${floorplanUrl})` : undefined,
                                    backgroundSize: '100% 100%',
                                    backgroundRepeat: 'no-repeat',
                                }}
                                onClick={() => setSelectedTable(null)}
                            >
                                {tables.map(renderTable)}
                            </div>
                         </TransformComponent>
                    </>
                )}
            </TransformWrapper>

            {/* ACTION MODAL */}
            <AnimatePresence>
                {selectedTable && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedTable(null)}>
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }} 
                            animate={{ scale: 1, opacity: 1 }} 
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white border border-[#D1D1CD] p-5 rounded-xl w-full max-w-sm shadow-md space-y-4 font-sans text-[#1A1A1A]"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-start border-b border-[#ECECE9] pb-3">
                                <div>
                                    <h3 className="font-mono font-bold text-sm tracking-wider uppercase">{selectedTable.table.table_name}</h3>
                                    <p className="text-[10px] text-[#767673] font-mono font-bold uppercase tracking-tight mt-0.5">{selectedTable.table.capacity} SEATS CAPACITY</p>
                                </div>
                                {selectedTable.statusData.status === 'occupied' && (
                                    <span className="px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase tracking-wider bg-[#FF5500]/10 text-[#FF5500] border border-[#FF5500]/20">
                                        {selectedTable.statusData.type}
                                    </span>
                                )}
                            </div>

                            {/* Info Section */}
                             {selectedTable.statusData.status === 'occupied' && (
                                <div className="bg-[#F5F5F2] border border-[#D1D1CD] p-3 rounded-lg space-y-2 text-xs font-mono">
                                    <div className="flex items-center gap-2 text-[#1A1A1A]">
                                        <Clock size={12} className="text-[#767673]" />
                                        <span>
                                            START: {new Date(selectedTable.statusData.booking.booking_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                             {selectedTable.statusData.booking.end_time && ` - END: ${new Date(selectedTable.statusData.booking.end_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[#1A1A1A]">
                                        <User size={12} className="text-[#767673]" />
                                        <span className="uppercase font-bold">{selectedTable.statusData.booking.profiles?.display_name || selectedTable.statusData.booking.pickup_contact_name || 'Walk-in Guest'}</span>
                                    </div>
                                    {selectedTable.statusData.booking.profiles?.phone_number && (
                                         <div className="flex items-center gap-2 text-[#1A1A1A]">
                                            <Phone size={12} className="text-[#767673]" />
                                            <span>{selectedTable.statusData.booking.profiles.phone_number}</span>
                                        </div>
                                    )}
                                </div>
                             )}

                             {/* Upcoming Warning */}
                             {selectedTable.statusData.status === 'upcoming' && (
                                 <div className="bg-[#FFF9E6] border border-[#E5A900] p-3 rounded-lg flex items-start gap-2 text-[#805E00] text-xs font-mono">
                                     <AlertCircle size={14} className="mt-0.5 shrink-0 text-[#FFAA00]" />
                                     <div>
                                         <strong>UPCOMING BOOKING:</strong> ARRIVAL AT {new Date(selectedTable.statusData.booking.booking_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                     </div>
                                 </div>
                             )}

                             {/* Actions */}
                             <div className="grid grid-cols-2 gap-3 pt-2 font-mono text-[10px] font-bold uppercase tracking-wider">
                                {selectedTable.statusData.status === 'occupied' ? (
                                    <>
                                        <button 
                                            onClick={() => handleExtendTime(selectedTable.statusData.booking.id, 30)}
                                            className="bg-white hover:bg-[#E0E0DC] border border-[#D1D1CD] py-2.5 rounded-lg text-[#1A1A1A] transition-colors cursor-pointer"
                                        >
                                            +30 Mins
                                        </button>
                                        <button 
                                            onClick={() => handleRelease(selectedTable.statusData.booking.id)}
                                            className="bg-[#FF5500] hover:bg-[#E04B00] border border-[#D04500] text-white py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                                        >
                                            Release Table
                                        </button>
                                    </>
                                ) : (
                                    <button 
                                        onClick={() => { quickBlock(selectedTable.table); setSelectedTable(null); }}
                                        className="col-span-2 bg-[#FF5500] hover:bg-[#E04B00] border border-[#D04500] text-white py-3 rounded-lg transition-colors cursor-pointer"
                                    >
                                        Block Manual
                                    </button>
                                )}
                             </div>
                             
                             <button onClick={() => setSelectedTable(null)} className="w-full text-center text-[#767673] hover:text-[#1A1A1A] text-xs font-mono font-bold uppercase mt-2 pt-2 border-t border-[#ECECE9] cursor-pointer">Close</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
