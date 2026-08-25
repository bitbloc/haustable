import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
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
    Search,
    RefreshCw,
    ArrowRightLeft,
    Phone,
    CheckCircle,
    X,
    Calendar
} from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { toast } from 'sonner';
import { getShortBookingId } from '../utils/printerHelper';
import { safeTimestampUrl, safeCssUrl } from '../utils/urlHelper';
import { posCache } from '../utils/offlineHelper';
import { parseTableTransferInfo } from '../utils/tableTransferHelper';

const formatUpcomingResTime = (timeStr) => {
    if (!timeStr) return '';
    try {
        const d = new Date(timeStr);
        const today = new Date();
        const isToday = d.toDateString() === today.toDateString();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const isTomorrow = d.toDateString() === tomorrow.toDateString();

        const timeOnly = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (isToday) return `${timeOnly}`;
        if (isTomorrow) return `พรุ่งนี้ ${timeOnly}`;
        return `${d.getDate()}/${d.getMonth() + 1} ${timeOnly}`;
    } catch {
        return timeStr;
    }
};

const POSTableGrid = memo(function POSTableGrid({ onSelectTable, onNewWalkInPickup, hasPendingOrders, refreshKey, onOpenNotifDrawer, unreadNotifCount }) {
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [floorplanUrl, setFloorplanUrl] = useState(null);
    const [viewMode, setViewMode] = useState('grid'); // 'floorplan' or 'grid'
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'free', 'occupied', 'pending'
    const [reassignModalBooking, setReassignModalBooking] = useState(null); // Booking needing table re-assignment
    const [reassigning, setReassigning] = useState(false);

    useEffect(() => {
        // Immediate in-memory/local cache render for sub-100ms UI responsiveness
        try {
            const cachedTables = posCache.getTables() || [];
            const cachedBookings = posCache.getBookings() || [];
            const cachedFloorplan = localStorage.getItem('pos_cache_floorplan_url');
            if (cachedFloorplan) {
                setFloorplanUrl(safeTimestampUrl(cachedFloorplan));
            }
            if (cachedTables.length > 0) {
                const merged = cachedTables.map(t => {
                    const booking = cachedBookings.find(b => b.table_id === t.id && b.status !== 'completed' && b.status !== 'void' && b.status !== 'cancelled' && b.status !== 'no_show');
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

        const tablesSub = supabase.channel('pos-tables-layout')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tables_layout' }, fetchTables)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchTables)
            .subscribe((status, err) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
                    console.warn(`[Realtime POS Layout] Channel status: ${status}`, err || '');
                }
            });

        const settingsSub = supabase.channel('pos-app-settings')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => {
                fetchFloorplan();
            })
            .subscribe((status, err) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
                    console.warn(`[Realtime POS Settings] Channel status: ${status}`, err || '');
                }
            });

        // 60-second background heartbeat fallback (Realtime handles instant updates)
        const pollInterval = setInterval(() => {
            fetchTables();
        }, 60000);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchTables();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('online', fetchTables);

        return () => {
            supabase.removeChannel(tablesSub);
            supabase.removeChannel(settingsSub);
            clearInterval(pollInterval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('online', fetchTables);
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
                .select('key, value')
                .in('key', ['floorplan_url', 'floorplan_image_url']);

            const floorSetting = settingsData?.find(s => s.key === 'floorplan_url')?.value 
                              || settingsData?.find(s => s.key === 'floorplan_image_url')?.value;

            if (floorSetting) {
                setFloorplanUrl(safeTimestampUrl(floorSetting));
                try {
                    localStorage.setItem('pos_cache_floorplan_url', floorSetting);
                } catch (e) {
                    console.warn('Failed to cache floorplan url:', e);
                }
            } else if (settingsData && settingsData.length > 0) {
                setFloorplanUrl(null);
                localStorage.removeItem('pos_cache_floorplan_url');
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
                const today = new Date();
                const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).toISOString();
                const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

                const { data: tablesData } = await supabase.from('tables_layout').select('*').order('table_name');
                
                // Fetch active pending, seated, confirmed, ready bookings for today only
                const { data: activeBookings } = await supabase
                    .from('bookings')
                    .select('id, table_id, status, booking_time, booking_type, staff_remark, pickup_contact_name, total_amount, profiles(display_name, nickname, phone_number)')
                    .in('status', ['pending', 'seated', 'confirmed', 'ready'])
                    .gte('booking_time', startOfToday)
                    .lte('booking_time', endOfToday);

                const currentTables = tablesData || [];
                const currentBookings = activeBookings || [];

                // Cache data into in-memory posCache and localStorage
                posCache.setTables(currentTables);
                posCache.setBookings(currentBookings);

                const now = new Date();

                const merged = currentTables.map(t => {
                    const tableBookings = currentBookings.filter(b => b.table_id === t.id && ['pending', 'seated', 'confirmed', 'ready'].includes(b.status));

                    // 1. Actively occupying in-store dining booking
                    const activeBooking = tableBookings.find(b => {
                        if (b.status === 'seated') return true;
                        const isToday = b.booking_time >= startOfToday && b.booking_time <= endOfToday;
                        const isWalkInOrQR = b.booking_type === 'walk_in' || b.booking_type === 'qr' || (b.staff_remark || '').toLowerCase().includes('qr');
                        if (isWalkInOrQR && isToday) return true;
                        if (isToday && ['seated', 'ready'].includes(b.status)) return true;
                        if (isToday && b.status === 'confirmed') {
                            const bTime = new Date(b.booking_time);
                            const diffMins = (bTime.getTime() - now.getTime()) / 60000;
                            if (diffMins <= 30 && diffMins >= -120) return true;
                        }
                        if (isToday && b.status === 'pending' && isWalkInOrQR) return true;
                        return false;
                    });

                    // 2. Upcoming advance reservation (scheduled for later today or future dates)
                    const upcomingRes = tableBookings.find(b => {
                        if (b.id === activeBooking?.id) return false;
                        const bTime = new Date(b.booking_time);
                        return bTime.getTime() > now.getTime() - 15 * 60000;
                    });

                    let status = 'free';
                    if (activeBooking) {
                        status = activeBooking.status === 'pending' ? 'pending' : 'occupied';
                    }

                    return {
                        ...t,
                        status: status,
                        booking: activeBooking || null,
                        upcomingReservation: upcomingRes || null,
                        upcomingConflict: (activeBooking && upcomingRes) ? upcomingRes : null
                    };
                });

                setTables(merged);
            } catch (err) {
                console.warn('[Offline Mode] Failed to fetch tables online, loading cache:', err);
                try {
                    const cachedTables = posCache.getTables() || [];
                    const cachedBookings = posCache.getBookings() || [];
                    const today = new Date();
                    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).toISOString();
                    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();
                    
                    const merged = cachedTables.map(t => {
                        const booking = cachedBookings.find(b => {
                            if (b.table_id !== t.id) return false;
                            if (['completed', 'void', 'cancelled', 'no_show'].includes(b.status)) return false;
                            if (b.status === 'seated') return true;
                            const isToday = b.booking_time >= startOfToday && b.booking_time <= endOfToday;
                            const isWalkInOrQR = b.booking_type === 'walk_in' || b.booking_type === 'qr' || (b.staff_remark || '').toLowerCase().includes('qr');
                            return isToday && isWalkInOrQR;
                        });
                        return {
                            ...t,
                            status: booking ? (booking.status === 'pending' ? 'pending' : 'occupied') : 'free',
                            booking: booking || null
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

    const filteredTables = useMemo(() => {
        if (!searchQuery.trim()) {
            return statusFilter === 'all' ? tables : tables.filter(t => t.status === statusFilter);
        }
        const q = searchQuery.toLowerCase().trim().replace(/^#/, '');
        return tables.filter(table => {
            const tableName = (table.table_name || '').toLowerCase();
            const booking = table.booking;
            const shortId = booking ? getShortBookingId(booking).toLowerCase() : '';
            const tokenStr = (booking?.tracking_token || '').toLowerCase();
            const custName = (booking?.profiles?.display_name || booking?.customer_name || booking?.pickup_contact_name || booking?.customer_note || '').toLowerCase();

            const matchesSearch = tableName.includes(q) || shortId.includes(q) || tokenStr.includes(q) || custName.includes(q);
            const matchesStatus = statusFilter === 'all' || table.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [tables, searchQuery, statusFilter]);

    if (loading) return (
        <div className="flex h-full items-center justify-center bg-[var(--color-paper)]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent)]"></div>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-[var(--color-paper)] overflow-hidden select-none font-sans text-[var(--color-ink)]">
            <style>{`
                @keyframes pos-blink-red {
                    0%, 100% { border-color: var(--color-rule); box-shadow: 0 0 2px rgba(0,0,0,0.1); }
                    50% { border-color: var(--color-accent); box-shadow: 0 0 16px rgba(190,40,20,0.4); }
                }
                @keyframes pos-blink-orange {
                    0%, 100% { border-color: var(--color-rule); box-shadow: 0 0 2px rgba(0,0,0,0.1); }
                    50% { border-color: #FFAA00; box-shadow: 0 0 16px rgba(255,170,0,0.6); }
                }
                @keyframes pos-blink-blue {
                    0%, 100% { border-color: var(--color-rule); box-shadow: 0 0 2px rgba(0,0,0,0.1); }
                    50% { border-color: #0099FF; box-shadow: 0 0 16px rgba(0,153,255,0.6); }
                }
                .animate-pos-blink-red { animation: pos-blink-red 1.0s infinite ease-in-out !important; }
                .animate-pos-blink-orange { animation: pos-blink-orange 1.0s infinite ease-in-out !important; }
                .animate-pos-blink-blue { animation: pos-blink-blue 1.0s infinite ease-in-out !important; }
            `}</style>
            {/* Top Toolbar */}
            <div className="p-4 bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] flex flex-col md:flex-row gap-3 items-center justify-between z-10 shrink-0 shadow-xs">
                {/* Search and Filters */}
                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" size={17} />
                        <input 
                            type="search" 
                            placeholder="ค้นหาชื่อโต๊ะ / คิว..." 
                            className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-md py-2.5 pl-10 pr-4 text-sm text-[var(--color-ink)] placeholder-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent)] font-medium transition-colors touch-manipulation min-h-[44px] shadow-xs"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex bg-[var(--color-paper)] p-1 rounded-md border border-[var(--color-rule)] text-xs font-mono font-bold uppercase tracking-wider touch-manipulation">
                        <button 
                            type="button"
                            onClick={() => setStatusFilter('all')}
                            className={`min-h-[38px] px-3.5 py-1.5 rounded-md transition-all cursor-pointer touch-manipulation ${statusFilter === 'all' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] shadow-xs' : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                        >
                            ทั้งหมด
                        </button>
                        <button 
                            type="button"
                            onClick={() => setStatusFilter('free')}
                            className={`min-h-[38px] px-3.5 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 touch-manipulation ${statusFilter === 'free' ? 'bg-emerald-100 text-emerald-900 shadow-xs' : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                        >
                            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                            ว่าง
                        </button>
                        <button 
                            type="button"
                            onClick={() => setStatusFilter('occupied')}
                            className={`min-h-[38px] px-3.5 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 touch-manipulation ${statusFilter === 'occupied' ? 'bg-[var(--color-accent)] text-white shadow-xs' : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                        >
                            <span className="w-2 h-2 rounded-full bg-white"></span>
                            มีลูกค้า
                        </button>
                        <button 
                            type="button"
                            onClick={() => setStatusFilter('pending')}
                            className={`min-h-[38px] px-3.5 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 touch-manipulation ${statusFilter === 'pending' ? 'bg-amber-200 text-amber-900 shadow-xs' : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'}`}
                        >
                            <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse"></span>
                            รอรับออเดอร์
                        </button>
                    </div>
                </div>

                {/* Layout Mode Toggle */}
                <div className="flex bg-[var(--color-paper)] p-1 rounded-md border border-[var(--color-rule)] shrink-0 font-mono text-xs font-bold uppercase tracking-wider touch-manipulation">
                    <button 
                        type="button"
                        onClick={() => setViewMode('floorplan')} 
                        className={`min-h-[38px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-all cursor-pointer touch-manipulation ${
                            viewMode === 'floorplan' 
                                ? 'bg-[var(--color-ink)] text-[var(--color-paper)] shadow-xs' 
                                : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'
                        } ${hasPendingOrders ? 'animate-pulse bg-amber-100 text-amber-900 border border-amber-300 font-bold shadow-xs' : ''}`}
                    >
                        <Map size={14} /> FLOORPLAN
                    </button>
                    <button 
                        type="button"
                        onClick={() => setViewMode('grid')} 
                        className={`min-h-[38px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-all cursor-pointer touch-manipulation ${
                            viewMode === 'grid' 
                                ? 'bg-[var(--color-ink)] text-[var(--color-paper)] shadow-xs' 
                                : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'
                        } ${hasPendingOrders ? 'animate-pulse bg-amber-100 text-amber-900 border border-amber-300 font-bold shadow-xs' : ''}`}
                    >
                        <LayoutGrid size={14} /> REGISTRY LIST
                    </button>
                    {onOpenNotifDrawer && (
                        <button 
                            type="button"
                            onClick={onOpenNotifDrawer} 
                            className="min-h-[38px] flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer touch-manipulation bg-[var(--color-paper-2)] text-[var(--color-ink)] border border-[var(--color-rule)] hover:bg-[var(--color-paper)] font-mono text-xs font-bold uppercase tracking-wider relative ml-1"
                        >
                            NOTIFS
                            {unreadNotifCount > 0 && (
                                <span className="bg-[var(--color-accent)] text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full leading-none animate-pulse">
                                    {unreadNotifCount}
                                </span>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Main Interactive Screen */}
            <div className="flex-1 relative overflow-hidden flex flex-col">
                {viewMode === 'floorplan' ? (
                    <div className="flex-1 w-full h-full relative">
                        {/* Status Legend Overlay */}
                        <div className="absolute bottom-4 left-4 z-20 bg-[#F5F5F2] border border-[#D1D1CD] p-4 rounded-xl shadow-md flex flex-col gap-2 text-[10px] font-mono font-bold uppercase tracking-wider text-[#767673] select-none">
                            <span className="text-[#1A1A1A] border-b border-[#D1D1CD] pb-1.5 mb-1">คำอธิบายสถานะโต๊ะ (TABLE STATUS)</span>
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#00CC44] border border-black/10"></span>
                                <span>ว่าง (VACANT)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#FF3300] border border-black/10"></span>
                                <span>มีลูกค้า (OCCUPIED)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#FFAA00] animate-pulse border border-black/10"></span>
                                <span>รอรับออเดอร์ (PENDING)</span>
                            </div>
                            <div className="border-t border-[#D1D1CD] pt-2 mt-1 flex items-center gap-2">
                                <span className="bg-[#1A1A1A] text-white text-[8px] font-black px-1 py-0.5 rounded tracking-normal">SLIP</span>
                                <span>แนบสลิปแล้ว</span>
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
                                    <div className="absolute top-4 right-4 z-20 flex flex-col gap-1 bg-[#F5F5F2] border border-[#D1D1CD] p-1 rounded-lg shadow-md">
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
                                                backgroundImage: safeCssUrl(floorplanUrl),
                                                backgroundSize: '100% 100%',
                                                backgroundRepeat: 'no-repeat',
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
                                            {filteredTables.map((table) => (
                                                <FloorplanTableButton 
                                                    key={table.id}
                                                    table={table}
                                                    onSelectTable={onSelectTable}
                                                    onReassign={setReassignModalBooking}
                                                />
                                            ))}
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
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3.5">
                                {filteredTables.map((table) => (
                                    <GridTableButton 
                                        key={table.id}
                                        table={table}
                                        onSelectTable={onSelectTable}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
            {/* 🔄 Smart Re-assignment Modal (แก้ปัญหาคิวจองชนลูกค้านั่งแช่) */}
            {reassignModalBooking && (
                <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border-2 border-amber-500 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                            <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
                                <AlertCircle size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 text-base">ย้ายคิวจองไปโต๊ะอื่น (Re-assign Table)</h3>
                                <p className="text-xs text-gray-500">โต๊ะเดิมมีลูกค้านั่งอยู่ ย้ายคิวไปโต๊ะว่างอื่นได้ทันที</p>
                            </div>
                        </div>

                        <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 mb-4 text-xs text-amber-900 space-y-1">
                            <p className="font-bold">👤 ลูกค้าจอง: {reassignModalBooking.pickup_contact_name || reassignModalBooking.customer_name || 'ลูกค้าออนไลน์'}</p>
                            <p>⏰ เวลาจอง: {new Date(reassignModalBooking.booking_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>

                        <p className="text-xs font-bold text-gray-700 uppercase mb-2">เลือกโต๊ะว่างที่จะย้ายไป:</p>
                        <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto mb-6">
                            {tables.filter(t => t.status === 'free').map(freeT => (
                                <button
                                    key={freeT.id}
                                    type="button"
                                    disabled={reassigning}
                                    onClick={async () => {
                                        setReassigning(true);
                                        try {
                                            const { error } = await supabase
                                                .from('bookings')
                                                .update({ table_id: freeT.id })
                                                .eq('id', reassignModalBooking.id);

                                            if (error) throw error;

                                            toast.success(`ย้ายคิวจองไป ${freeT.table_name} สำเร็จ! (หน้า Tracking ลูกค้าอัปเดตแล้ว)`);
                                            setReassignModalBooking(null);
                                            fetchTables();
                                        } catch (err) {
                                            console.error(err);
                                            toast.error('ไม่สามารถย้ายโต๊ะได้');
                                        } finally {
                                            setReassigning(false);
                                        }
                                    }}
                                    className="p-3 rounded-xl border border-gray-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all cursor-pointer active:scale-95"
                                >
                                    <span className="text-sm font-black">{freeT.table_name}</span>
                                    <span className="text-[9px] opacity-75 font-normal">ว่าง (Free)</span>
                                </button>
                            ))}
                            {tables.filter(t => t.status === 'free').length === 0 && (
                                <div className="col-span-3 text-center text-gray-400 text-xs py-6">ไม่มีโต๊ะว่างในขณะนี้</div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => setReassignModalBooking(null)}
                            className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                        >
                            ยกเลิก
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});

export default POSTableGrid;

const FloorplanTableButton = memo(function FloorplanTableButton({ table, onSelectTable, onReassign }) {
    const isCircle = table.shape === 'circle';
    const rotation = table.rotation || 0;
    
    const isOccupied = table.status === 'occupied';
    const isPending = table.status === 'pending';
    const hasOrder = isPending;
    const hasCallStaff = table.booking?.staff_remark?.includes('[CALL_STAFF]');
    const hasCallBill = table.booking?.staff_remark?.includes('[CALL_BILL]');
    const hasSlip = !!table.booking?.payment_slip_url;
    const transfer = parseTableTransferInfo(table.booking);

    let tableBgClass = 'bg-white border-[#D1D1CD] text-[#1A1A1A]';
    let ledColor = 'bg-[#00CC44]';
    
    if (isOccupied || isPending) {
        tableBgClass = 'bg-[#FF3300] border-[#CC2900] text-white shadow-sm';
        ledColor = 'bg-white';
        
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
            type="button"
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
                <div className="absolute top-1 right-1 flex items-center justify-center gap-1 flex-wrap max-w-[85%] justify-end">
                    {table.upcomingConflict && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onReassign(table.booking); }}
                            className="bg-amber-500 text-black text-[7px] font-mono font-bold px-1 py-0.5 rounded leading-none animate-bounce shadow cursor-pointer pointer-events-auto"
                        >
                            ⚠️ ชนคิว!
                        </button>
                    )}
                    {transfer.isMergedTarget && (
                        <span className="bg-[oklch(45%_0.08_140)] text-white text-[7px] font-mono font-black px-1 py-0.5 rounded leading-none shadow-xs">
                            +{transfer.mergedFromTables.join(',')}
                        </span>
                    )}
                    {transfer.isMoved && (
                        <span className="bg-blue-600 text-white text-[7px] font-mono font-bold px-1 py-0.5 rounded leading-none shadow-xs">
                            ย้าย
                        </span>
                    )}
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

                {/* Upcoming Advance Reservation on Free Table */}
                {table.upcomingReservation && !isOccupied && !isPending && (
                    <span className="mt-0.5 bg-amber-100 text-amber-900 border border-amber-300 text-[7px] font-mono font-bold px-1 py-0.2 rounded leading-tight">
                        🕒 {formatUpcomingResTime(table.upcomingReservation.booking_time)}
                    </span>
                )}
                
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
                            ) : isPending && startMins >= 10 ? (
                                <span className="mt-0.5 bg-red-600 text-white text-[7px] font-mono font-bold px-1 py-0.5 rounded leading-none animate-pulse">
                                    OVERDUE {startMins}M
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
});

const GridTableButton = memo(function GridTableButton({ table, onSelectTable }) {
    const isOccupied = table.status === 'occupied';
    const isPending = table.status === 'pending';
    
    const hasOrder = isPending;
    const hasCallStaff = table.booking?.staff_remark?.includes('[CALL_STAFF]');
    const hasCallBill = table.booking?.staff_remark?.includes('[CALL_BILL]');
    const hasSlip = !!table.booking?.payment_slip_url;
    const transfer = parseTableTransferInfo(table.booking);

    let cellBgClass = 'bg-[var(--color-paper)] border-[var(--color-rule)] text-[var(--color-ink)] hover:border-[var(--color-accent)] shadow-xs';
    let ledColor = 'bg-emerald-500';
    
    if (isOccupied || isPending) {
        cellBgClass = 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white shadow-xs';
        ledColor = 'bg-white';
        
        if (hasCallStaff) {
            cellBgClass = 'animate-pos-blink-blue border-2 shadow-sm';
            ledColor = 'bg-[#0099FF] animate-ping';
        }
        if (hasCallBill) {
            cellBgClass = 'animate-pos-blink-orange border-2 shadow-sm';
            ledColor = 'bg-[#FFAA00] animate-ping';
        }
        if (hasOrder) {
            cellBgClass = 'animate-pos-blink-red border-2 shadow-sm';
            ledColor = 'bg-red-500 animate-ping';
        }
    }

    return (
        <button
            key={table.id}
            type="button"
            onClick={() => onSelectTable(table)}
            className={`min-h-[135px] rounded-md p-3.5 flex flex-col items-stretch justify-between border cursor-pointer relative overflow-hidden transition-all duration-100 hover:scale-[1.01] active:scale-[0.98] ${cellBgClass}`}
        >
            {/* Top row: Status LEDs */}
            <div className="flex justify-between items-center w-full">
                <div className="flex gap-1 items-center flex-wrap">
                     {transfer.isMergedTarget && (
                         <span className="bg-[oklch(45%_0.08_140)] text-white text-[8px] font-mono font-black px-1.5 py-0.5 rounded-xs tracking-wider leading-none uppercase">
                             +{transfer.mergedFromTables.join(',')}
                         </span>
                     )}
                     {transfer.isMoved && (
                         <span className="bg-blue-600 text-white text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-xs tracking-wider leading-none uppercase">
                             ย้ายจาก {transfer.movedFromTable}
                         </span>
                     )}
                     {hasOrder && (
                         <span className="bg-red-600 text-white text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-xs tracking-wider leading-none uppercase animate-pulse">ORDER</span>
                     )}
                     {isPending && table.booking?.booking_time && (Math.floor((Date.now() - new Date(table.booking.booking_time).getTime()) / 60000) >= 10) && (
                         <span className="bg-red-800 text-white text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-xs tracking-wider leading-none uppercase animate-pulse">OVERDUE</span>
                     )}
                     {hasCallStaff && (
                         <span className="bg-[#0099FF] text-white text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-xs tracking-wider leading-none uppercase animate-pulse">CALL</span>
                     )}
                     {hasCallBill && (
                         <span className="bg-[#FFAA00] text-black text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-xs tracking-wider leading-none uppercase animate-pulse">BILL</span>
                     )}
                     {hasSlip && (
                         <span className="bg-emerald-600 text-white text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-xs tracking-wider leading-none uppercase">SLIP</span>
                     )}
                 </div>
                <span className={`w-2 h-2 rounded-full border border-black/10 ${ledColor}`} />
            </div>
            
            {/* Center row: Table Info */}
            <div className="flex flex-col items-center gap-0.5 my-2.5 select-none">
                 <span className="font-mono font-bold text-2xl tracking-tight">{table.table_name}</span>
                 <span className={`text-[9px] font-mono font-bold tracking-widest uppercase ${isOccupied || isPending ? 'text-white/80' : 'text-[var(--color-neutral)]'}`}>
                     {table.booking ? `QUEUE #${getShortBookingId(table.booking)}` : 'TABLE UNIT'}
                 </span>
            </div>
            
            {/* Bottom row: Capacity / Timing */}
            <div className="flex justify-between items-center w-full border-t border-black/10 pt-2 text-[9px] font-mono font-bold uppercase tracking-wider select-none opacity-80">
                 <span>{(isOccupied || isPending) && table.booking?.pax ? `👥 ${table.booking.pax} คน` : `CAP: ${table.capacity}P`}</span>
                {(isOccupied || isPending) ? (
                    <div className="flex items-center gap-1">
                        <Clock size={10} />
                        <span>{new Date(table.booking.booking_time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit'})}</span>
                    </div>
                ) : table.upcomingReservation && (
                    <div className="flex items-center gap-0.5 text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-xs text-[8px] font-mono font-bold">
                        <Clock size={9} />
                        <span>จอง {formatUpcomingResTime(table.upcomingReservation.booking_time)} ({table.upcomingReservation.pax || 2}p)</span>
                    </div>
                )}
            </div>
        </button>
    );
});
