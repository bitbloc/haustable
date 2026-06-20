import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { motion } from 'framer-motion';
import { 
    Users, 
    Clock, 
    AlertCircle, 
    Receipt,
    ZoomIn,
    ZoomOut,
    Maximize,
    LayoutGrid,
    Map,
    Search
} from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

export default function POSTableGrid({ onSelectTable }) {
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [floorplanUrl, setFloorplanUrl] = useState(null);
    const [viewMode, setViewMode] = useState('floorplan'); // 'floorplan' or 'grid'
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'free', 'occupied', 'pending'

    useEffect(() => {
        fetchTables();
        fetchFloorplan();

        const bookingsSub = supabase.channel('pos-tables-bookings')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchTables)
            .subscribe();
            
        const tablesSub = supabase.channel('pos-tables-layout')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tables_layout' }, fetchTables)
            .subscribe();

        return () => {
            supabase.removeChannel(bookingsSub);
            supabase.removeChannel(tablesSub);
        };
    }, []);

    const fetchFloorplan = async () => {
        try {
            const { data: settingsData } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'floorplan_url')
                .single();
            if (settingsData?.value) {
                setFloorplanUrl(`${settingsData.value}?t=${new Date().getTime()}`);
            }
        } catch (err) {
            console.error("Error fetching floorplan URL:", err);
        }
    };

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

    const filteredTables = tables.filter(table => {
        const matchesSearch = table.table_name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || table.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if (loading) return (
        <div className="flex h-full items-center justify-center bg-[#121212]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-[#121212] overflow-hidden select-none">
            {/* Top Toolbar */}
            <div className="p-6 bg-[#1A1A1A] border-b border-white/5 flex flex-col md:flex-row gap-4 items-center justify-between z-10 shrink-0">
                {/* Search and Filters */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full sm:w-60">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input 
                            type="search" 
                            placeholder="ค้นหาโต๊ะ..." 
                            className="w-full bg-black/30 border border-white/10 rounded-2xl py-2.5 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex bg-black/25 p-1 rounded-xl border border-white/5 text-xs font-semibold">
                        <button 
                            type="button"
                            onClick={() => setStatusFilter('all')}
                            className={`px-3 py-2 rounded-lg transition-all ${statusFilter === 'all' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            ทั้งหมด
                        </button>
                        <button 
                            type="button"
                            onClick={() => setStatusFilter('free')}
                            className={`px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 ${statusFilter === 'free' ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-400 hover:text-white'}`}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            ว่าง
                        </button>
                        <button 
                            type="button"
                            onClick={() => setStatusFilter('occupied')}
                            className={`px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 ${statusFilter === 'occupied' ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:text-white'}`}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            ไม่ว่าง
                        </button>
                        <button 
                            type="button"
                            onClick={() => setStatusFilter('pending')}
                            className={`px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 ${statusFilter === 'pending' ? 'bg-yellow-500/20 text-yellow-400 animate-pulse' : 'text-gray-400 hover:text-white'}`}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                            จองใหม่
                        </button>
                    </div>
                </div>

                {/* Layout Mode Toggle */}
                <div className="flex bg-black/30 p-1 rounded-xl border border-white/5 shrink-0">
                    <button 
                        type="button"
                        onClick={() => setViewMode('floorplan')} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'floorplan' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Map size={14} /> แผนผังร้าน
                    </button>
                    <button 
                        type="button"
                        onClick={() => setViewMode('grid')} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'grid' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                    >
                        <LayoutGrid size={14} /> รายการโต๊ะ
                    </button>
                </div>
            </div>

            {/* Main Interactive Screen */}
            <div className="flex-1 relative overflow-hidden flex flex-col">
                {viewMode === 'floorplan' ? (
                    <div className="flex-1 w-full h-full relative">
                        {/* Status Legend Overlay */}
                        <div className="absolute bottom-4 left-4 z-20 bg-[#1A1A1A]/90 border border-white/10 p-4 rounded-2xl shadow-xl backdrop-blur-md flex flex-col gap-2.5 text-xs text-gray-400">
                            <span className="font-bold text-white mb-0.5">สถานะโต๊ะ (Legend)</span>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
                                <span>ว่าง (Free)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"></span>
                                <span>มีลูกค้า (Occupied)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.5)]"></span>
                                <span>รอยืนยัน (Pending / New)</span>
                            </div>
                            <div className="border-t border-white/5 pt-2 flex items-center gap-2">
                                <span className="bg-emerald-500 text-black text-[8px] font-black px-1 py-0.5 rounded">SLIP</span>
                                <span>แนบสลิปแล้ว (Slip Uploaded)</span>
                            </div>
                        </div>

                        <TransformWrapper
                            initialScale={0.85}
                            minScale={0.2}
                            maxScale={4}
                            centerOnInit={true}
                            limitToBounds={false}
                        >
                            {({ zoomIn, zoomOut, resetTransform }) => (
                                <>
                                    {/* Floating Zoom Controls */}
                                    <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5 bg-[#1A1A1A]/90 border border-white/10 p-1.5 rounded-2xl shadow-xl backdrop-blur-md">
                                        <button type="button" onClick={() => zoomIn()} className="p-2 hover:bg-white/5 rounded-xl transition-colors text-white" title="Zoom In"><ZoomIn size={16} /></button>
                                        <button type="button" onClick={() => zoomOut()} className="p-2 hover:bg-white/5 rounded-xl transition-colors text-white" title="Zoom Out"><ZoomOut size={16} /></button>
                                        <button type="button" onClick={() => resetTransform()} className="p-2 hover:bg-white/5 rounded-xl transition-colors text-white" title="Reset View"><Maximize size={16} /></button>
                                    </div>
                                    
                                    <TransformComponent wrapperClass="w-full h-full cursor-grab active:cursor-grabbing flex items-center justify-center" contentClass="w-full h-full flex items-center justify-center">
                                        <div
                                            className="relative transition-shadow duration-300 shadow-2xl border border-white/5 rounded-[32px] overflow-hidden bg-[#161616]"
                                            style={{
                                                width: '1000px',
                                                height: '750px',
                                                backgroundImage: floorplanUrl ? `url(${floorplanUrl})` : undefined,
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center',
                                            }}
                                        >
                                            {!floorplanUrl && (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 font-bold opacity-30 select-none">
                                                    <Map size={48} className="mb-2" />
                                                    <span>ไม่มีภาพแผนผังร้าน</span>
                                                </div>
                                            )}
                                            
                                            {/* Render positioned tables */}
                                            {filteredTables.map((table) => {
                                                const isCircle = table.shape === 'circle';
                                                const rotation = table.rotation || 0;
                                                const customBg = table.table_color || '#333333';
                                                
                                                const isOccupied = table.status === 'occupied';
                                                const isPending = table.status === 'pending';
                                                
                                                // Status rings/glows
                                                let ringStyle = 'border-white/10';
                                                let glowStyle = '';
                                                if (isOccupied) {
                                                    ringStyle = 'border-red-500 border-2';
                                                    glowStyle = 'shadow-[0_0_15px_rgba(239,68,68,0.4)]';
                                                } else if (isPending) {
                                                    ringStyle = 'border-yellow-500 border-2 animate-pulse';
                                                    glowStyle = 'shadow-[0_0_15px_rgba(234,179,8,0.5)]';
                                                } else {
                                                    ringStyle = 'border-[#ffffff18] hover:border-emerald-500/80';
                                                    glowStyle = 'hover:shadow-[0_0_15px_rgba(16,185,129,0.35)]';
                                                }

                                                // Determine text color based on table theme color darkness
                                                const isDarkColor = ['#333333', '#7F1D1D', '#14532D', '#1E3A8A', '#581C87'].includes(customBg);
                                                const textColor = isDarkColor ? 'text-white' : 'text-zinc-900';
                                                const subTextColor = isDarkColor ? 'text-white/60' : 'text-zinc-900/60';
                                                
                                                return (
                                                    <motion.button
                                                        key={table.id}
                                                        whileHover={{ scale: 1.05, zIndex: 30 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={() => onSelectTable(table)}
                                                        className={`absolute select-none flex flex-col items-center justify-center transition-all p-1 cursor-pointer overflow-hidden ${isCircle ? 'rounded-full' : 'rounded-[16px]'} ${ringStyle} ${glowStyle}`}
                                                        style={{
                                                            left: `${table.pos_x}%`,
                                                            top: `${table.pos_y}%`,
                                                            width: `${table.width}%`,
                                                            height: `${table.height}%`,
                                                            transform: `rotate(${rotation}deg)`,
                                                            backgroundColor: customBg,
                                                        }}
                                                    >
                                                        {/* Counter-rotate content */}
                                                        <div 
                                                            className="flex flex-col items-center justify-center w-full h-full text-center pointer-events-none p-1 relative"
                                                            style={{ transform: `rotate(${-rotation}deg)` }}
                                                        >
                                                            {/* Action Badges in absolute corner */}
                                                            <div className="absolute top-0 right-0 flex gap-0.5">
                                                                {isPending && (
                                                                    <span className="bg-yellow-500 text-black text-[7px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-md">
                                                                        <AlertCircle size={8} /> NEW
                                                                    </span>
                                                                )}
                                                                {isOccupied && table.booking?.payment_slip_url && (
                                                                    <span className="bg-emerald-500 text-black text-[7px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-md">
                                                                        <Receipt size={8} /> SLIP
                                                                    </span>
                                                                )}
                                                            </div>
                                                            
                                                            {/* Table Name */}
                                                            <span className={`font-black text-xs md:text-sm tracking-tight leading-tight ${textColor}`}>
                                                                {table.table_name}
                                                            </span>
                                                            
                                                            {/* Capacity */}
                                                            <span className={`text-[8px] md:text-[9px] font-semibold mt-0.5 ${subTextColor}`}>
                                                                {table.capacity} Seats
                                                            </span>
                                                            
                                                            {/* Booking / Seated time */}
                                                            {table.booking?.booking_time && (isOccupied || isPending) && (
                                                                <div className={`flex items-center gap-0.5 text-[8px] font-bold mt-0.5 ${isPending ? 'text-yellow-400' : 'text-red-400'}`}>
                                                                    <Clock size={8} />
                                                                    <span>
                                                                        {new Date(table.booking.booking_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </motion.button>
                                                );
                                            })}
                                        </div>
                                    </TransformComponent>
                                </>
                            )}
                        </TransformWrapper>
                    </div>
                ) : (
                    // Regular grid layout (highly stable list fallback)
                    <div className="flex-1 p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                        {filteredTables.length === 0 ? (
                            <div className="flex flex-col h-full items-center justify-center text-gray-500 gap-2">
                                <AlertCircle size={32} />
                                <span>ไม่พบโต๊ะที่ค้นหา</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                {filteredTables.map((table) => (
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
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
