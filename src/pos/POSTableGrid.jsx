import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

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

export default function POSTableGrid({ onSelectTable, hasPendingOrders, refreshKey }) {
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [floorplanUrl, setFloorplanUrl] = useState(null);
    const [viewMode, setViewMode] = useState('grid'); // 'floorplan' or 'grid'
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'free', 'occupied', 'pending'

    useEffect(() => {
        // Immediate local cache render for sub-100ms UI responsiveness
        try {
            const cachedTables = JSON.parse(localStorage.getItem('pos_cache_tables_layout')) || [];
            const cachedBookings = JSON.parse(localStorage.getItem('pos_cache_active_bookings')) || [];
            if (cachedTables.length > 0) {
                const merged = cachedTables.map(t => {
                    const booking = cachedBookings.find(b => b.table_id === t.id && b.status !== 'completed');
                    return {
                        ...t,
                        status: booking ? (booking.status === 'pending' ? 'pending' : 'occupied') : 'free',
                        booking: booking
                    };
                });
                setTables(merged);
                setLoading(false);
            }
        } catch (e) {
            console.warn('Failed to parse local tables cache:', e);
        }

        fetchTables();
        fetchFloorplan();

        const bookingsSub = supabase.channel('pos-tables-bookings')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchTables)
            .subscribe((status, err) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
                    console.warn(`[Realtime POS Bookings] Channel status: ${status}`, err || '');
                }
            });
            
        const tablesSub = supabase.channel('pos-tables-layout')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tables_layout' }, fetchTables)
            .subscribe((status, err) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
                    console.warn(`[Realtime POS Layout] Channel status: ${status}`, err || '');
                }
            });

        // 5-second polling fallback to keep grid fresh if realtime fails
        const pollInterval = setInterval(() => {
            fetchTables();
        }, 5000);

        return () => {
            supabase.removeChannel(bookingsSub);
            supabase.removeChannel(tablesSub);
            clearInterval(pollInterval);
        };
    }, []);

    useEffect(() => {
        if (refreshKey > 0) {
            fetchTables();
        }
    }, [refreshKey]);

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

    const fetchTimeoutRef = useRef(null);

    const fetchTables = useCallback(async () => {
        if (fetchTimeoutRef.current) {
            clearTimeout(fetchTimeoutRef.current);
        }
        
        fetchTimeoutRef.current = setTimeout(async () => {
            try {
                const { data: tablesData } = await supabase.from('tables_layout').select('*').order('table_name');
                
                // Simplified status check for POC
                const { data: activeBookings } = await supabase
                    .from('bookings')
                    .select('*')
                    .in('status', ['pending', 'confirmed', 'seated', 'ready']);

                const currentTables = tablesData || [];
                const currentBookings = activeBookings || [];

                // Cache data
                localStorage.setItem('pos_cache_tables_layout', JSON.stringify(currentTables));
                localStorage.setItem('pos_cache_active_bookings', JSON.stringify(currentBookings));

                const merged = currentTables.map(t => {
                    const booking = currentBookings.find(b => b.table_id === t.id);
                    return {
                        ...t,
                        status: booking ? (booking.status === 'pending' ? 'pending' : 'occupied') : 'free',
                        booking: booking
                    };
                });

                setTables(merged);
            } catch (err) {
                console.warn('[Offline Mode] Failed to fetch tables online, loading cache:', err);
                try {
                    const cachedTables = JSON.parse(localStorage.getItem('pos_cache_tables_layout')) || [];
                    const cachedBookings = JSON.parse(localStorage.getItem('pos_cache_active_bookings')) || [];
                    
                    const merged = cachedTables.map(t => {
                        const booking = cachedBookings.find(b => b.table_id === t.id && b.status !== 'completed');
                        return {
                            ...t,
                            status: booking ? (booking.status === 'pending' ? 'pending' : 'occupied') : 'free',
                            booking: booking
                        };
                    });
                    setTables(merged);
                } catch (cacheErr) {
                    console.error('Failed to load tables cache:', cacheErr);
                }
            } finally {
                setLoading(false);
            }
        }, 150);
    }, []);

    const filteredTables = tables.filter(table => {
        const matchesSearch = table.table_name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || table.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if (loading) return (
        <div className="flex h-full items-center justify-center bg-[#ECECE9]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff0000]"></div>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-[#ECECE9] overflow-hidden select-none font-sans text-[#1A1A1A]">
            <style>{`
                @keyframes pos-blink-red {
                    0%, 100% { border-color: #2A2B2D; box-shadow: 0 0 2px rgba(0,0,0,0.1); }
                    50% { border-color: #ff0000; box-shadow: 0 0 16px rgba(255,0,0,0.6); }
                }
                @keyframes pos-blink-orange {
                    0%, 100% { border-color: #2A2B2D; box-shadow: 0 0 2px rgba(0,0,0,0.1); }
                    50% { border-color: #FFAA00; box-shadow: 0 0 16px rgba(255,170,0,0.6); }
                }
                @keyframes pos-blink-blue {
                    0%, 100% { border-color: #2A2B2D; box-shadow: 0 0 2px rgba(0,0,0,0.1); }
                    50% { border-color: #0099FF; box-shadow: 0 0 16px rgba(0,153,255,0.6); }
                }
                .animate-pos-blink-red { animation: pos-blink-red 1.0s infinite ease-in-out !important; }
                .animate-pos-blink-orange { animation: pos-blink-orange 1.0s infinite ease-in-out !important; }
                .animate-pos-blink-blue { animation: pos-blink-blue 1.0s infinite ease-in-out !important; }
            `}</style>
            {/* Top Toolbar */}
            <div className="p-4 bg-[#F5F5F2] border-b border-[#D1D1CD] flex flex-col md:flex-row gap-4 items-center justify-between z-10 shrink-0 shadow-sm">
                {/* Search and Filters */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full sm:w-56">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#767673]" size={16} />
                        <input 
                            type="search" 
                            placeholder="ค้นหาโต๊ะ..." 
                            className="w-full bg-white border border-[#D1D1CD] rounded-lg py-2 pl-10 pr-4 text-xs text-[#1A1A1A] placeholder-[#767673] focus:outline-none focus:border-[#ff0000] font-medium transition-colors"
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
                            onClick={() => setStatusFilter('free')}
                            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${statusFilter === 'free' ? 'bg-white text-emerald-600 shadow-sm' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00CC44]"></span>
                            VACANT
                        </button>
                        <button 
                            type="button"
                            onClick={() => setStatusFilter('occupied')}
                            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${statusFilter === 'occupied' ? 'bg-white text-red-600 shadow-sm' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF3300]"></span>
                            OCCUPIED
                        </button>
                        <button 
                            type="button"
                            onClick={() => setStatusFilter('pending')}
                            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${statusFilter === 'pending' ? 'bg-white text-amber-600 shadow-sm' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FFAA00] animate-pulse"></span>
                            PENDING
                        </button>
                    </div>
                </div>

                {/* Layout Mode Toggle */}
                <div className="flex bg-[#E0E0DC] p-0.5 rounded-lg border border-[#D1D1CD] shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider">
                    <button 
                        type="button"
                        onClick={() => setViewMode('floorplan')} 
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                            viewMode === 'floorplan' 
                                ? 'bg-white text-[#1A1A1A] shadow-sm' 
                                : 'text-[#767673] hover:text-[#1A1A1A]'
                        } ${hasPendingOrders ? 'animate-pulse bg-amber-100 text-amber-800 border border-amber-300 font-extrabold shadow-sm' : ''}`}
                    >
                        <Map size={12} /> FLOORPLAN
                    </button>
                    <button 
                        type="button"
                        onClick={() => setViewMode('grid')} 
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                            viewMode === 'grid' 
                                ? 'bg-white text-[#1A1A1A] shadow-sm' 
                                : 'text-[#767673] hover:text-[#1A1A1A]'
                        } ${hasPendingOrders ? 'animate-pulse bg-amber-100 text-amber-800 border border-amber-300 font-extrabold shadow-sm' : ''}`}
                    >
                        <LayoutGrid size={12} /> REGISTRY LIST
                    </button>
                </div>
            </div>

            {/* Main Interactive Screen */}
            <div className="flex-1 relative overflow-hidden flex flex-col">
                {viewMode === 'floorplan' ? (
                    <div className="flex-1 w-full h-full relative">
                        {/* Status Legend Overlay */}
                        <div className="absolute bottom-4 left-4 z-20 bg-[#F5F5F2]/95 border border-[#D1D1CD] p-4 rounded-xl shadow-md backdrop-blur-md flex flex-col gap-2 text-[10px] font-mono font-bold uppercase tracking-wider text-[#767673] select-none">
                            <span className="text-[#1A1A1A] border-b border-[#D1D1CD] pb-1.5 mb-1">TABLE STATUS INDICATORS</span>
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#00CC44] border border-black/10"></span>
                                <span>VACANT (ว่าง)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#FF3300] border border-black/10"></span>
                                <span>OCCUPIED (มีลูกค้า)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#FFAA00] animate-pulse border border-black/10"></span>
                                <span>PENDING (รอยืนยัน)</span>
                            </div>
                            <div className="border-t border-[#D1D1CD] pt-2 mt-1 flex items-center gap-2">
                                <span className="bg-[#1A1A1A] text-white text-[8px] font-black px-1 py-0.5 rounded tracking-normal">SLIP</span>
                                <span>SLIP ATTACHED</span>
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
                                    <div className="absolute top-4 right-4 z-20 flex flex-col gap-1 bg-[#F5F5F2]/95 border border-[#D1D1CD] p-1 rounded-lg shadow-md backdrop-blur-md">
                                        <button type="button" onClick={() => zoomIn()} className="p-2 hover:bg-[#E0E0DC] rounded transition-colors text-[#1A1A1A] cursor-pointer" title="Zoom In"><ZoomIn size={14} /></button>
                                        <button type="button" onClick={() => zoomOut()} className="p-2 hover:bg-[#E0E0DC] rounded transition-colors text-[#1A1A1A] cursor-pointer" title="Zoom Out"><ZoomOut size={14} /></button>
                                        <button type="button" onClick={() => resetTransform()} className="p-2 hover:bg-[#E0E0DC] rounded transition-colors text-[#1A1A1A] cursor-pointer" title="Reset View"><Maximize size={14} /></button>
                                    </div>
                                    
                                    <TransformComponent wrapperClass="w-full h-full cursor-grab active:cursor-grabbing flex items-center justify-center" contentClass="w-full h-full flex items-center justify-center">
                                        <div
                                            className="relative transition-shadow duration-300 shadow-md border border-[#D1D1CD] rounded-[24px] overflow-hidden bg-[#E1E1DE]"
                                            style={{
                                                width: '1000px',
                                                height: '750px',
                                                backgroundImage: floorplanUrl ? `url(${floorplanUrl})` : undefined,
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center',
                                            }}
                                        >
                                            {!floorplanUrl && (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center text-[#767673] font-mono font-bold uppercase tracking-widest opacity-40 select-none">
                                                    <Map size={36} className="mb-2 text-[#767673]" />
                                                    <span>NO FLOORPLAN SCHEMATIC</span>
                                                </div>
                                            )}
                                            
                                            {/* Render positioned tables */}
                                            {filteredTables.map((table) => {
                                                const isCircle = table.shape === 'circle';
                                                const rotation = table.rotation || 0;
                                                
                                                const isOccupied = table.status === 'occupied';
                                                const isPending = table.status === 'pending';
                                                const hasOrder = isPending;
                                                const hasCallStaff = table.booking?.staff_remark?.includes('[CALL_STAFF]');
                                                const hasCallBill = table.booking?.staff_remark?.includes('[CALL_BILL]');
                                                const hasSlip = !!table.booking?.payment_slip_url;

                                                // Braun style tables: Matte colors with clear LED status lights
                                                let tableBgClass = 'bg-white border-[#D1D1CD] text-[#1A1A1A]';
                                                let ledColor = 'bg-[#00CC44]';
                                                
                                                if (isOccupied || isPending) {
                                                    tableBgClass = 'bg-[#3C3D40] border-[#2A2B2D] text-white shadow-sm';
                                                    ledColor = 'bg-[#767673]';
                                                    
                                                    if (hasCallStaff) {
                                                        tableBgClass = 'animate-pos-blink-blue border-2 shadow-md';
                                                        ledColor = 'bg-[#0099FF] animate-ping';
                                                    }
                                                    if (hasCallBill) {
                                                        tableBgClass = 'animate-pos-blink-orange border-2 shadow-md';
                                                        ledColor = 'bg-[#FFAA00] animate-ping';
                                                    }
                                                    if (hasOrder) {
                                                        tableBgClass = 'animate-pos-blink-red border-2 shadow-md';
                                                        ledColor = 'bg-[#ff0000] animate-ping';
                                                    }
                                                }
                                                
                                                return (
                                                    <button
                                                        key={table.id}
                                                        onClick={() => onSelectTable(table)}
                                                        className={`absolute select-none flex flex-col items-center justify-center p-1 cursor-pointer overflow-hidden border ${isCircle ? 'rounded-full' : 'rounded-lg'} ${tableBgClass} hover:scale-[1.03] hover:z-[30] active:scale-[0.98] transition-transform duration-100`}
                                                        style={{
                                                            left: `${table.pos_x}%`,
                                                            top: `${table.pos_y}%`,
                                                            width: `${table.width}%`,
                                                            height: `${table.height}%`,
                                                            transform: `rotate(${rotation}deg)`
                                                        }}
                                                    >
                                                        {/* Counter-rotate content */}
                                                        <div 
                                                            className="flex flex-col items-center justify-center w-full h-full text-center pointer-events-none p-1 relative"
                                                            style={{ transform: `rotate(${-rotation}deg)` }}
                                                        >
                                                            {/* LED indicator light in top-right */}
                                                            <div className="absolute top-1 right-1 flex items-center justify-center gap-1">
                                                                {hasOrder && (
                                                                    <span className="bg-[#ff0000] text-white text-[7px] font-mono font-bold px-1 py-0.5 rounded leading-none animate-pulse">
                                                                        ORDER
                                                                    </span>
                                                                )}
                                                                {hasCallStaff && (
                                                                    <span className="bg-[#0099FF] text-white text-[7px] font-mono font-bold px-1 py-0.5 rounded leading-none animate-pulse">
                                                                        CALL
                                                                    </span>
                                                                )}
                                                                {hasCallBill && (
                                                                    <span className="bg-[#FFAA00] text-black text-[7px] font-mono font-bold px-1 py-0.5 rounded leading-none animate-pulse">
                                                                        BILL
                                                                    </span>
                                                                )}
                                                                {hasSlip && (
                                                                    <span className="bg-[#00CC44] text-white text-[7px] font-mono font-bold px-1 py-0.5 rounded leading-none">
                                                                        SLIP
                                                                    </span>
                                                                )}
                                                                <span className={`w-1.5 h-1.5 rounded-full border border-black/10 ${ledColor}`}></span>
                                                            </div>
                                                            
                                                            {/* Table Name */}
                                                            <span className="font-mono font-bold text-xs md:text-sm tracking-tight leading-tight">
                                                                {table.table_name}
                                                            </span>
                                                            
                                                            {/* Capacity / Guest count */}
                                                            <span className="text-[8px] font-mono font-bold tracking-tight opacity-60 mt-0.5 uppercase">
                                                                {(isOccupied || isPending) && table.booking?.pax ? `👥 ${table.booking.pax}คน` : `${table.capacity}p`}
                                                            </span>
                                                            
                                                            {/* Booking / Seated time & Dwell Counter */}
                                                            {table.booking?.booking_time && (isOccupied || isPending) && (() => {
                                                                const startMins = Math.max(0, Math.floor((Date.now() - new Date(table.booking.booking_time).getTime()) / 60000));
                                                                const isStale = startMins >= 2880; // >48h (2 days)
                                                                const isLongDwell = startMins >= 120; // >2h
                                                                return (
                                                                    <div className="flex flex-col items-center mt-0.5">
                                                                        <div className="flex items-center gap-0.5 text-[8px] font-mono font-bold opacity-80">
                                                                            <Clock size={8} />
                                                                            <span>{new Date(table.booking.booking_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                        </div>
                                                                        {isStale ? (
                                                                            <span className="mt-0.5 bg-red-600 text-white text-[7px] font-mono font-bold px-1 py-0.5 rounded leading-none animate-pulse">
                                                                                ⚠️ บิลค้าง &gt;2วัน
                                                                            </span>
                                                                        ) : isLongDwell ? (
                                                                            <span className="mt-0.5 bg-amber-500 text-black text-[7px] font-mono font-bold px-1 py-0.5 rounded leading-none">
                                                                                🔥 นั่งแช่ {Math.floor(startMins / 60)}h{startMins % 60}m
                                                                            </span>
                                                                        ) : (
                                                                            <span className="mt-0.5 text-[7px] font-mono opacity-70">
                                                                                ⏱️ {startMins < 60 ? `${startMins}m` : `${Math.floor(startMins / 60)}h${startMins % 60}m`}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    </button>
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
                    <div className="flex-1 p-6 overflow-y-auto scrollbar-none">
                        {filteredTables.length === 0 ? (
                            <div className="flex flex-col h-full items-center justify-center text-[#767673] gap-2 font-mono text-xs font-bold uppercase tracking-wider">
                                <AlertCircle size={24} />
                                <span>No tables found matching registry query</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredTables.map((table) => {
                                    const isOccupied = table.status === 'occupied';
                                    const isPending = table.status === 'pending';
                                    
                                    const hasOrder = isPending;
                                    const hasCallStaff = table.booking?.staff_remark?.includes('[CALL_STAFF]');
                                    const hasCallBill = table.booking?.staff_remark?.includes('[CALL_BILL]');
                                    const hasSlip = !!table.booking?.payment_slip_url;

                                    let cellBgClass = 'bg-white border-[#D1D1CD] text-[#1A1A1A] hover:border-[#B0B0AC]';
                                    let ledColor = 'bg-[#00CC44]';
                                    
                                    if (isOccupied || isPending) {
                                        cellBgClass = 'bg-[#3C3D40] border-[#2A2B2D] text-white shadow-sm';
                                        ledColor = 'bg-[#767673]';
                                        
                                        if (hasCallStaff) {
                                            cellBgClass = 'animate-pos-blink-blue border-2 shadow-md';
                                            ledColor = 'bg-[#0099FF] animate-ping';
                                        }
                                        if (hasCallBill) {
                                            cellBgClass = 'animate-pos-blink-orange border-2 shadow-md';
                                            ledColor = 'bg-[#FFAA00] animate-ping';
                                        }
                                        if (hasOrder) {
                                            cellBgClass = 'animate-pos-blink-red border-2 shadow-md';
                                            ledColor = 'bg-[#ff0000] animate-ping';
                                        }
                                    }

                                    return (
                                        <button
                                            key={table.id}
                                            onClick={() => onSelectTable(table)}
                                            className={`min-h-[135px] rounded-xl p-3.5 flex flex-col items-stretch justify-between border cursor-pointer relative overflow-hidden transition-all duration-100 hover:scale-[1.02] active:scale-[0.98] ${cellBgClass}`}
                                        >
                                            {/* Top row: Status LEDs */}
                                            <div className="flex justify-between items-center w-full">
                                                <div className="flex gap-1 items-center">
                                                    {hasOrder && (
                                                        <span className="bg-[#ff0000] text-white text-[8px] font-mono font-bold px-1 py-0.5 rounded tracking-normal leading-none uppercase animate-pulse">ORDER</span>
                                                    )}
                                                    {hasCallStaff && (
                                                        <span className="bg-[#0099FF] text-white text-[8px] font-mono font-bold px-1 py-0.5 rounded tracking-normal leading-none uppercase animate-pulse">CALL</span>
                                                    )}
                                                    {hasCallBill && (
                                                        <span className="bg-[#FFAA00] text-black text-[8px] font-mono font-bold px-1 py-0.5 rounded tracking-normal leading-none uppercase animate-pulse">BILL</span>
                                                    )}
                                                    {hasSlip && (
                                                        <span className="bg-[#00CC44] text-white text-[8px] font-mono font-bold px-1 py-0.5 rounded tracking-normal leading-none uppercase">SLIP</span>
                                                    )}
                                                </div>
                                                <span className={`w-2 h-2 rounded-full border border-black/10 ${ledColor}`} />
                                            </div>
                                            
                                            {/* Center row: Table Info */}
                                            <div className="flex flex-col items-center gap-1 my-3 select-none">
                                                 <span className="font-mono font-black text-2xl tracking-tighter">{table.table_name}</span>
                                                 <span className="text-[9px] font-mono font-bold tracking-widest text-[#767673] uppercase">TABLE UNIT</span>
                                            </div>
                                            
                                            {/* Bottom row: Capacity / Timing */}
                                            <div className="flex justify-between items-center w-full border-t border-black/5 pt-2 text-[9px] font-mono font-bold uppercase tracking-wider select-none text-[#767673]">
                                                 <span>{(isOccupied || isPending) && table.booking?.pax ? `👥 ${table.booking.pax} คน` : `CAPACITY: ${table.capacity}P`}</span>
                                                {(isOccupied || isPending) && (
                                                    <div className="flex items-center gap-1 text-[#1A1A1A] dark:text-inherit">
                                                        <Clock size={10} />
                                                        <span>{new Date(table.booking.booking_time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit'})}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
