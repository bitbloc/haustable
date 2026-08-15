/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function TableManager({ isStaffView = false, onSelectTable: externalSelectTable }) {
    const [tables, setTables] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [floorplanUrl, setFloorplanUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('floorplan'); // 'floorplan' | 'matrix'
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'free' | 'occupied' | 'calling' | 'upcoming'
    
    // Interactive Modals
    const [inspectedTable, setInspectedTable] = useState(null); // Table + Booking Inspection Modal
    const [seatingModalTable, setSeatingModalTable] = useState(null); // Vacant Table Seating Modal
    const [transferModalData, setTransferModalData] = useState(null); // Table Transfer Modal { fromTable, booking }
    
    // Seating Form State
    const [seatingForm, setSeatingForm] = useState({
        guestName: 'Walk-in Guest',
        phone: '',
        pax: 2,
        durationHours: 2,
        note: '',
        isMaintenanceBlock: false
    });

    const [actionLoading, setActionLoading] = useState(false);

    // Initial Load & Realtime Sync
    useEffect(() => {
        fetchData();
        const pollInterval = setInterval(fetchData, 15000); // 15s fallback poll

        const channel = supabase
            .channel('table-manager-live-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tables_layout' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchData())
            .subscribe();

        return () => {
            clearInterval(pollInterval);
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchData = async () => {
        try {
            // 1. Fetch tables
            const { data: tablesData, error: tErr } = await supabase
                .from('tables_layout')
                .select('*')
                .order('id');
            if (tErr) throw tErr;
            if (tablesData) setTables(tablesData);

            // 2. Settings (Floorplan schematic image)
            const { data: settingsData } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'floorplan_url')
                .single();
            if (settingsData?.value) {
                setFloorplanUrl(`${settingsData.value}?t=${Date.now()}`);
            }

            // 3. Fetch active bookings of today with order items & menu items
            const today = new Date().toISOString().split('T')[0];
            const start = `${today}T00:00:00+07:00`;
            const end = `${today}T23:59:59+07:00`;

            const { data: bookingsData, error: bErr } = await supabase
                .from('bookings')
                .select(`
                    *,
                    profiles(display_name, phone_number),
                    order_items(
                        id, quantity, price, status,
                        menu_items(name, price)
                    )
                `)
                .in('status', ['confirmed', 'pending', 'seated', 'ready', 'approved', 'paid'])
                .gte('booking_time', start)
                .lte('booking_time', end)
                .order('booking_time', { ascending: true });

            if (bErr) throw bErr;
            if (bookingsData) setBookings(bookingsData);

        } catch (err) {
            console.error('[TableManager] Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Calculate dynamic status for a table
    const getTableState = useCallback((tableId) => {
        const now = new Date();
        const tableBookings = bookings.filter(b => b.table_id === tableId);

        if (tableBookings.length === 0) {
            return { status: 'free', booking: null };
        }

        // Active Seated Booking
        const currentBooking = tableBookings.find(b => {
            const bStart = new Date(b.booking_time);
            const bEnd = b.end_time ? new Date(b.end_time) : new Date(bStart.getTime() + 2 * 60 * 60 * 1000);
            return now >= bStart && now < bEnd;
        });

        if (currentBooking) {
            const hasCallStaff = currentBooking.staff_remark?.includes('[CALL_STAFF]');
            const hasCallBill = currentBooking.staff_remark?.includes('[CALL_BILL]');
            const hasSlip = !!currentBooking.payment_slip_url;
            const isInternalBlock = currentBooking.customer_note === 'Internal Block' || currentBooking.customer_note === 'Maintenance Block';

            // Calculate live order totals
            const orderItems = currentBooking.order_items || [];
            const totalBill = orderItems.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0) || Number(currentBooking.total_amount || 0);
            const pendingCookingCount = orderItems.filter(i => i.status === 'pending' || i.status === 'cooking').length;

            return {
                status: isInternalBlock ? 'blocked' : 'occupied',
                type: currentBooking.booking_type === 'walk_in' ? 'walk_in' : 'online',
                booking: currentBooking,
                hasCallStaff,
                hasCallBill,
                hasSlip,
                totalBill,
                orderItemsCount: orderItems.length,
                pendingCookingCount
            };
        }

        // Upcoming reservation arriving in next 60 minutes
        const upcoming = tableBookings.find(b => {
            const bStart = new Date(b.booking_time);
            const diffMins = (bStart - now) / 60000;
            return diffMins > 0 && diffMins <= 60;
        });

        if (upcoming) {
            return {
                status: 'upcoming',
                booking: upcoming
            };
        }

        return { status: 'free', booking: null };
    }, [bookings]);

    // Handle Table Click
    const handleTableClick = (table) => {
        if (externalSelectTable) {
            externalSelectTable(table);
            return;
        }

        const state = getTableState(table.id);
        if (state.status === 'free') {
            // Open quick seating modal
            setSeatingForm({
                guestName: 'Walk-in Guest',
                phone: '',
                pax: table.capacity || 2,
                durationHours: 2,
                note: '',
                isMaintenanceBlock: false
            });
            setSeatingModalTable(table);
        } else {
            // Inspect occupied/reserved table
            setInspectedTable({ table, state });
        }
    };

    // Quick Walk-in Seating Handler
    const handleConfirmSeating = async () => {
        if (!seatingModalTable) return;
        setActionLoading(true);
        try {
            const now = new Date();
            const durationMs = (Number(seatingForm.durationHours) || 2) * 60 * 60 * 1000;
            const endTime = new Date(now.getTime() + durationMs);

            const payload = {
                table_id: seatingModalTable.id,
                booking_time: now.toISOString(),
                end_time: endTime.toISOString(),
                booking_type: 'walk_in',
                status: 'seated',
                pickup_contact_name: seatingForm.isMaintenanceBlock ? 'MAINTENANCE' : (seatingForm.guestName.trim() || 'Walk-in Guest'),
                customer_note: seatingForm.isMaintenanceBlock ? 'Maintenance Block' : seatingForm.note.trim(),
                pax: Number(seatingForm.pax) || seatingModalTable.capacity || 2,
                total_amount: 0,
                tracking_token: crypto.randomUUID()
            };

            const { error } = await supabase.from('bookings').insert(payload);
            if (error) throw error;

            toast.success(`Seated ${seatingModalTable.table_name} (${seatingForm.pax} Guests)`, {
                description: `Duration: ${seatingForm.durationHours}h • Until ${endTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`
            });

            setSeatingModalTable(null);
            fetchData();
        } catch (err) {
            toast.error('Failed to seat table: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    // Release / Clear Table
    const handleReleaseTable = async (bookingId, tableName) => {
        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('bookings')
                .update({ 
                    status: 'completed', 
                    end_time: new Date().toISOString() 
                })
                .eq('id', bookingId);

            if (error) throw error;

            toast.success(`Table ${tableName} Released`, {
                description: 'Table is now free for new guests'
            });

            setInspectedTable(null);
            fetchData();
        } catch (err) {
            toast.error('Failed to release table: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    // Extend Seating Time (+30m / +60m)
    const handleExtendTime = async (booking, addMinutes) => {
        setActionLoading(true);
        try {
            const start = new Date(booking.booking_time);
            const currentEnd = booking.end_time ? new Date(booking.end_time) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
            const newEnd = new Date(currentEnd.getTime() + addMinutes * 60 * 1000);

            const { error } = await supabase
                .from('bookings')
                .update({ end_time: newEnd.toISOString() })
                .eq('id', booking.id);

            if (error) throw error;

            toast.success(`Extended +${addMinutes} Mins`, {
                description: `New End Time: ${newEnd.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`
            });

            setInspectedTable(null);
            fetchData();
        } catch (err) {
            toast.error('Failed to extend time: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    // Clear Service Calls ([CALL_STAFF] or [CALL_BILL])
    const handleClearServiceCall = async (booking) => {
        setActionLoading(true);
        try {
            let updatedRemark = (booking.staff_remark || '')
                .replace(/\[CALL_STAFF\]/g, '')
                .replace(/\[CALL_BILL\]/g, '')
                .trim();

            const { error } = await supabase
                .from('bookings')
                .update({ staff_remark: updatedRemark || null })
                .eq('id', booking.id);

            if (error) throw error;

            toast.success('Service call alert acknowledged and cleared');
            if (inspectedTable) {
                setInspectedTable(prev => prev ? {
                    ...prev,
                    state: {
                        ...prev.state,
                        hasCallStaff: false,
                        hasCallBill: false,
                        booking: { ...prev.state.booking, staff_remark: updatedRemark }
                    }
                } : null);
            }
            fetchData();
        } catch (err) {
            toast.error('Failed to clear alert: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    // Transfer Table / Move Guest
    const handleTransferTable = async (targetTableId, targetTableName) => {
        if (!transferModalData) return;
        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('bookings')
                .update({ table_id: targetTableId })
                .eq('id', transferModalData.booking.id);

            if (error) throw error;

            toast.success(`Guest moved from ${transferModalData.fromTable.table_name} to ${targetTableName}`, {
                description: 'Orders and live tracking updated automatically'
            });

            setTransferModalData(null);
            setInspectedTable(null);
            fetchData();
        } catch (err) {
            toast.error('Failed to transfer table: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    // Filter & Search Tables for Matrix Registry List
    const filteredTables = useMemo(() => {
        return tables.filter(table => {
            const state = getTableState(table.id);
            
            // Status Filter
            if (statusFilter === 'free' && state.status !== 'free') return false;
            if (statusFilter === 'occupied' && state.status !== 'occupied' && state.status !== 'blocked') return false;
            if (statusFilter === 'calling' && !state.hasCallStaff && !state.hasCallBill) return false;
            if (statusFilter === 'upcoming' && state.status !== 'upcoming') return false;

            // Search Query
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase().trim();
            const tableName = (table.table_name || '').toLowerCase();
            const guestName = (state.booking?.pickup_contact_name || state.booking?.profiles?.display_name || '').toLowerCase();
            const phone = (state.booking?.profiles?.phone_number || '').toLowerCase();
            const note = (state.booking?.customer_note || '').toLowerCase();

            return tableName.includes(q) || guestName.includes(q) || phone.includes(q) || note.includes(q);
        });
    }, [tables, getTableState, statusFilter, searchQuery]);

    // Vacant tables for transfer selection
    const vacantTables = useMemo(() => {
        return tables.filter(t => {
            const state = getTableState(t.id);
            return state.status === 'free';
        });
    }, [tables, getTableState]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[460px] bg-[oklch(97%_0.008_28)] font-mono text-xs text-[oklch(55%_0.010_28)] gap-3">
                <div className="w-6 h-6 rounded-full border-2 border-[oklch(85%_0.012_28)] border-t-[oklch(18%_0.012_28)] animate-spin" />
                <span>SYNCHRONIZING LIVE FLOOR & TABLE MATRIX...</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] select-none font-sans">
            
            {/* Top Toolbar */}
            <div className="p-3 sm:p-4 bg-[oklch(98%_0.006_28)] border-b border-[oklch(85%_0.012_28)] flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between z-10 shrink-0">
                
                {/* Search & Status Filters */}
                <div className="flex flex-wrap items-center gap-2.5 flex-1">
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <input
                            type="search"
                            placeholder="SEARCH TABLE, GUEST, PHONE..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] px-3 py-2 text-xs font-mono rounded-sm outline-none focus:border-[oklch(52%_0.16_28)] text-[oklch(18%_0.012_28)] placeholder-[oklch(55%_0.010_28)]"
                        />
                    </div>

                    {/* Filter Pills */}
                    <div className="flex bg-[oklch(94%_0.010_28)] p-0.5 rounded-sm border border-[oklch(85%_0.012_28)] font-mono text-[10px] font-bold uppercase tracking-wider overflow-x-auto">
                        <button
                            type="button"
                            onClick={() => setStatusFilter('all')}
                            className={`px-3 py-1.5 rounded-sm transition-all cursor-pointer ${
                                statusFilter === 'all'
                                    ? 'bg-[oklch(18%_0.012_28)] text-white shadow-xs'
                                    : 'text-[oklch(42%_0.010_28)] hover:text-black'
                            }`}
                        >
                            ALL ({tables.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('free')}
                            className={`px-3 py-1.5 rounded-sm transition-all cursor-pointer ${
                                statusFilter === 'free'
                                    ? 'bg-[oklch(45%_0.08_140)] text-white shadow-xs'
                                    : 'text-[oklch(42%_0.010_28)] hover:text-black'
                            }`}
                        >
                            VACANT ({tables.filter(t => getTableState(t.id).status === 'free').length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('occupied')}
                            className={`px-3 py-1.5 rounded-sm transition-all cursor-pointer ${
                                statusFilter === 'occupied'
                                    ? 'bg-[oklch(52%_0.16_28)] text-white shadow-xs'
                                    : 'text-[oklch(42%_0.010_28)] hover:text-black'
                            }`}
                        >
                            OCCUPIED ({tables.filter(t => ['occupied', 'blocked'].includes(getTableState(t.id).status)).length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('calling')}
                            className={`px-3 py-1.5 rounded-sm transition-all cursor-pointer ${
                                statusFilter === 'calling'
                                    ? 'bg-[oklch(60%_0.15_60)] text-black shadow-xs animate-pulse'
                                    : 'text-[oklch(42%_0.010_28)] hover:text-black'
                            }`}
                        >
                            CALLING ({tables.filter(t => getTableState(t.id).hasCallStaff || getTableState(t.id).hasCallBill).length})
                        </button>
                    </div>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center gap-2 self-end md:self-auto">
                    <div className="flex bg-[oklch(94%_0.010_28)] p-0.5 rounded-sm border border-[oklch(85%_0.012_28)] font-mono text-[10px] font-bold uppercase tracking-wider">
                        <button
                            type="button"
                            onClick={() => setViewMode('floorplan')}
                            className={`px-3 py-1.5 rounded-sm transition-all cursor-pointer ${
                                viewMode === 'floorplan'
                                    ? 'bg-[oklch(18%_0.012_28)] text-white shadow-xs'
                                    : 'text-[oklch(42%_0.010_28)] hover:text-black'
                            }`}
                        >
                            2D FLOOR MAP
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('matrix')}
                            className={`px-3 py-1.5 rounded-sm transition-all cursor-pointer ${
                                viewMode === 'matrix'
                                    ? 'bg-[oklch(18%_0.012_28)] text-white shadow-xs'
                                    : 'text-[oklch(42%_0.010_28)] hover:text-black'
                            }`}
                        >
                            REGISTRY LIST
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={fetchData}
                        title="Reload floor data"
                        className="px-2.5 py-1.5 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] font-mono text-[10px] font-bold uppercase rounded-sm cursor-pointer"
                    >
                        SYNC
                    </button>
                </div>
            </div>

            {/* Main Interactive Screen */}
            <div className="flex-1 relative overflow-hidden flex flex-col min-h-[500px]">
                {viewMode === 'floorplan' ? (
                    // --- 2D Interactive Floorplan View ---
                    <div className="flex-1 w-full h-full relative bg-[oklch(94%_0.010_28)]">
                        
                        {/* Legend Overlay */}
                        <div className="absolute top-4 left-4 z-20 bg-[oklch(98%_0.006_28)]/95 border border-[oklch(85%_0.012_28)] p-3 rounded-sm shadow-xs backdrop-blur-xs font-mono text-[9px] font-bold uppercase tracking-wider text-[oklch(42%_0.010_28)]">
                            <div className="flex items-center gap-3 text-[oklch(18%_0.012_28)]">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-[oklch(45%_0.08_140)] border border-black/10" /> VACANT
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-[oklch(52%_0.16_28)] border border-black/10" /> OCCUPIED
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-[oklch(60%_0.15_60)] border border-black/10" /> RESERVED
                                </span>
                            </div>
                            <div className="border-t border-[oklch(85%_0.012_28)] pt-1.5 mt-1.5 text-[8px] text-[oklch(55%_0.010_28)]">
                                CLICK EMPTY TABLE TO SEAT • CLICK OCCUPIED TO INSPECT & ORDERS
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
                                    {/* Zoom Controls */}
                                    <div className="absolute bottom-4 right-4 z-20 flex gap-1 bg-[oklch(98%_0.006_28)]/95 border border-[oklch(85%_0.012_28)] p-1 rounded-sm shadow-xs">
                                        <button 
                                            type="button"
                                            onClick={() => zoomIn()} 
                                            className="px-2.5 py-1 hover:bg-[oklch(90%_0.012_28)] font-mono text-xs font-bold rounded-sm cursor-pointer"
                                            title="Zoom In"
                                        >
                                            +
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => zoomOut()} 
                                            className="px-2.5 py-1 hover:bg-[oklch(90%_0.012_28)] font-mono text-xs font-bold rounded-sm cursor-pointer"
                                            title="Zoom Out"
                                        >
                                            -
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => resetTransform()} 
                                            className="px-2.5 py-1 hover:bg-[oklch(90%_0.012_28)] font-mono text-[10px] font-bold rounded-sm cursor-pointer uppercase"
                                            title="Reset Scale"
                                        >
                                            RESET
                                        </button>
                                    </div>

                                    <TransformComponent
                                        wrapperClass="w-full h-full cursor-grab active:cursor-grabbing flex items-center justify-center"
                                        contentClass="w-full h-full flex items-center justify-center"
                                    >
                                        <div
                                            className="relative border border-[oklch(85%_0.012_28)] rounded-sm overflow-hidden bg-[oklch(97%_0.008_28)] shadow-sm"
                                            style={{
                                                width: '1000px',
                                                height: '750px',
                                                backgroundImage: floorplanUrl ? `url(${floorplanUrl})` : undefined,
                                                backgroundSize: '100% 100%',
                                                backgroundRepeat: 'no-repeat'
                                            }}
                                        >
                                            {!floorplanUrl && (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center text-[oklch(55%_0.010_28)] font-mono font-bold uppercase tracking-widest opacity-30 select-none">
                                                    <span>NO FLOORPLAN SCHEMATIC IMAGE</span>
                                                    <span className="text-[9px] mt-1">UPLOAD IN LAYOUT & QR STUDIO</span>
                                                </div>
                                            )}

                                            {/* Render positioned tables */}
                                            {tables.map(table => {
                                                const state = getTableState(table.id);
                                                const isOccupied = state.status === 'occupied' || state.status === 'blocked';
                                                const isUpcoming = state.status === 'upcoming';
                                                const rotation = table.rotation || 0;

                                                let bgClass = 'bg-[oklch(98%_0.006_28)] border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] hover:border-[oklch(45%_0.08_140)]';
                                                let ledColor = 'bg-[oklch(45%_0.08_140)]'; // Green LED

                                                if (isOccupied) {
                                                    bgClass = 'bg-[oklch(52%_0.16_28)] border-[oklch(45%_0.16_28)] text-white shadow-xs';
                                                    ledColor = 'bg-white';

                                                    if (state.hasCallStaff) {
                                                        bgClass = 'bg-[oklch(45%_0.15_240)] border-white text-white animate-pulse shadow-md';
                                                        ledColor = 'bg-white';
                                                    } else if (state.hasCallBill) {
                                                        bgClass = 'bg-[oklch(60%_0.15_60)] border-black text-black animate-pulse shadow-md';
                                                        ledColor = 'bg-black';
                                                    }
                                                } else if (isUpcoming) {
                                                    bgClass = 'bg-[oklch(96%_0.02_60)] border-[oklch(60%_0.15_60)] text-[oklch(18%_0.012_28)]';
                                                    ledColor = 'bg-[oklch(60%_0.15_60)] animate-pulse';
                                                }

                                                // Dwell Timer
                                                let dwellText = null;
                                                let isLongDwell = false;
                                                if (isOccupied && state.booking?.booking_time) {
                                                    const startMins = Math.max(0, Math.floor((Date.now() - new Date(state.booking.booking_time).getTime()) / 60000));
                                                    isLongDwell = startMins >= 120;
                                                    dwellText = startMins < 60 ? `${startMins}m` : `${Math.floor(startMins / 60)}h${startMins % 60}m`;
                                                }

                                                return (
                                                    <div
                                                        key={table.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleTableClick(table);
                                                        }}
                                                        style={{
                                                            position: 'absolute',
                                                            left: `${table.pos_x}%`,
                                                            top: `${table.pos_y}%`,
                                                            width: `${table.width}%`,
                                                            height: `${table.height}%`,
                                                            transform: `rotate(${rotation}deg)`
                                                        }}
                                                        className={`cursor-pointer select-none flex flex-col items-center justify-center p-1 border transition-all hover:scale-102 active:scale-98 ${
                                                            table.shape === 'circle' ? 'rounded-full' : 'rounded-sm'
                                                        } ${bgClass}`}
                                                    >
                                                        {/* Status LED & Call Badges */}
                                                        <div className="absolute top-1 right-1 flex items-center gap-1">
                                                            {state.hasCallStaff && (
                                                                <span className="bg-white text-[oklch(45%_0.15_240)] text-[6px] font-mono font-bold px-0.5 rounded leading-none">
                                                                    CALL
                                                                </span>
                                                            )}
                                                            {state.hasCallBill && (
                                                                <span className="bg-black text-white text-[6px] font-mono font-bold px-0.5 rounded leading-none">
                                                                    BILL
                                                                </span>
                                                            )}
                                                            <span className={`w-1.5 h-1.5 rounded-full border border-black/10 ${ledColor}`} />
                                                        </div>

                                                        {/* Counter-rotate label content */}
                                                        <div
                                                            className="flex flex-col items-center pointer-events-none select-none p-0.5 overflow-hidden w-full text-center"
                                                            style={{ transform: `rotate(${-rotation}deg)` }}
                                                        >
                                                            <span className="font-mono font-bold text-[11px] tracking-tight truncate max-w-[90%] leading-tight">
                                                                {table.table_name}
                                                            </span>
                                                            <span className="text-[8px] font-mono font-bold opacity-70 uppercase leading-none mt-0.5">
                                                                {isOccupied && state.booking?.pax ? `${state.booking.pax}p` : `${table.capacity}p`}
                                                            </span>
                                                            {dwellText && (
                                                                <span className={`text-[7px] font-mono font-bold mt-0.5 px-0.5 rounded leading-none ${
                                                                    isLongDwell ? 'bg-black text-amber-300' : 'opacity-80'
                                                                }`}>
                                                                    {dwellText}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </TransformComponent>
                                </>
                            )}
                        </TransformWrapper>
                    </div>
                ) : (
                    // --- High-density Registry List Matrix View ---
                    <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-[oklch(97%_0.008_28)]">
                        {filteredTables.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 font-mono text-xs text-[oklch(55%_0.010_28)] uppercase tracking-wider">
                                <span>NO TABLES MATCH CURRENT QUERY</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                                {filteredTables.map(table => {
                                    const state = getTableState(table.id);
                                    const isOccupied = state.status === 'occupied' || state.status === 'blocked';
                                    const isUpcoming = state.status === 'upcoming';

                                    let cardBg = 'bg-[oklch(98%_0.006_28)] border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] hover:border-[oklch(52%_0.16_28)]';
                                    let statusPill = 'bg-[oklch(92%_0.012_140)] text-[oklch(35%_0.08_140)]';
                                    let statusLabel = 'VACANT';

                                    if (isOccupied) {
                                        cardBg = 'bg-[oklch(96%_0.015_28)] border-[oklch(52%_0.16_28)] text-[oklch(18%_0.012_28)] shadow-xs';
                                        statusPill = 'bg-[oklch(52%_0.16_28)] text-white';
                                        statusLabel = state.type === 'walk_in' ? 'WALK-IN' : 'ONLINE';
                                        if (state.status === 'blocked') {
                                            statusPill = 'bg-[oklch(35%_0.010_28)] text-white';
                                            statusLabel = 'BLOCKED';
                                        }
                                    } else if (isUpcoming) {
                                        cardBg = 'bg-[oklch(96%_0.02_60)] border-[oklch(60%_0.15_60)] text-[oklch(18%_0.012_28)]';
                                        statusPill = 'bg-[oklch(60%_0.15_60)] text-black';
                                        statusLabel = 'RESERVED';
                                    }

                                    // Dwell time
                                    let dwellStr = null;
                                    if (isOccupied && state.booking?.booking_time) {
                                        const mins = Math.max(0, Math.floor((Date.now() - new Date(state.booking.booking_time).getTime()) / 60000));
                                        dwellStr = mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h${mins % 60}m`;
                                    }

                                    return (
                                        <div
                                            key={table.id}
                                            onClick={() => handleTableClick(table)}
                                            className={`p-3 rounded-sm border flex flex-col justify-between min-h-[140px] cursor-pointer transition-all active:scale-98 ${cardBg}`}
                                        >
                                            {/* Header */}
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="font-mono text-base font-bold tracking-tight block">
                                                        {table.table_name}
                                                    </span>
                                                    <span className="font-mono text-[9px] text-[oklch(55%_0.010_28)] uppercase">
                                                        CAP: {table.capacity}P
                                                    </span>
                                                </div>
                                                <span className={`font-mono text-[8px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider ${statusPill}`}>
                                                    {statusLabel}
                                                </span>
                                            </div>

                                            {/* Body Info */}
                                            <div className="my-2 space-y-1 font-mono text-[10px]">
                                                {isOccupied && state.booking ? (
                                                    <>
                                                        <div className="font-bold text-[oklch(18%_0.012_28)] truncate">
                                                            {state.booking.pickup_contact_name || state.booking.profiles?.display_name || 'Guest'}
                                                        </div>
                                                        <div className="flex justify-between text-[9px] text-[oklch(55%_0.010_28)]">
                                                            <span>SEATED: {dwellStr}</span>
                                                            <span>{state.booking.pax || table.capacity} GUESTS</span>
                                                        </div>
                                                        {state.totalBill > 0 && (
                                                            <div className="text-[10px] font-bold text-[oklch(52%_0.16_28)]">
                                                                ฿{state.totalBill.toLocaleString()}
                                                            </div>
                                                        )}
                                                    </>
                                                ) : isUpcoming && state.booking ? (
                                                    <div className="text-[9px] text-[oklch(42%_0.010_28)]">
                                                        ARRIVAL: {new Date(state.booking.booking_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                ) : (
                                                    <div className="text-[9px] text-[oklch(45%_0.08_140)] font-bold">
                                                        AVAILABLE FOR SEATING
                                                    </div>
                                                )}
                                            </div>

                                            {/* Footer Action */}
                                            <div className="border-t border-[oklch(85%_0.012_28)] pt-1.5 flex items-center justify-between font-mono text-[8px] font-bold text-[oklch(55%_0.010_28)] uppercase">
                                                {isOccupied ? (
                                                    <span>CLICK TO INSPECT</span>
                                                ) : (
                                                    <span>+ SEAT WALK-IN</span>
                                                )}
                                                {state.hasCallStaff && <span className="text-blue-600 animate-pulse">CALLING</span>}
                                                {state.hasCallBill && <span className="text-amber-600 animate-pulse">BILL</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* --- VACANT TABLE SEATING MODAL --- */}
            <AnimatePresence>
                {seatingModalTable && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
                        onClick={() => setSeatingModalTable(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[oklch(98%_0.006_28)] border border-[oklch(85%_0.012_28)] p-6 rounded-sm w-full max-w-md shadow-2xl space-y-4 font-sans text-[oklch(18%_0.012_28)]"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="flex justify-between items-start border-b border-[oklch(85%_0.012_28)] pb-3">
                                <div>
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)]">
                                        QUICK WALK-IN SEATING
                                    </span>
                                    <h3 className="font-mono text-xl font-bold uppercase tracking-tight text-[oklch(18%_0.012_28)] mt-0.5">
                                        {seatingModalTable.table_name}
                                    </h3>
                                    <p className="font-mono text-[10px] text-[oklch(55%_0.010_28)] uppercase">
                                        Capacity: {seatingModalTable.capacity} Seats
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSeatingModalTable(null)}
                                    className="font-mono text-xs font-bold text-[oklch(42%_0.010_28)] hover:text-black p-1 cursor-pointer"
                                >
                                    ✕ CLOSE
                                </button>
                            </div>

                            {/* Seating Form */}
                            <div className="space-y-3 font-mono text-xs">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-[oklch(55%_0.010_28)] block mb-1">
                                        GUEST NAME / PARTY IDENTIFIER
                                    </label>
                                    <input
                                        type="text"
                                        value={seatingForm.guestName}
                                        onChange={e => setSeatingForm({ ...seatingForm, guestName: e.target.value })}
                                        placeholder="e.g. Walk-in Guest, Khun Somchai"
                                        className="w-full px-3 py-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-sm outline-none focus:border-[oklch(52%_0.16_28)]"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-[oklch(55%_0.010_28)] block mb-1">
                                            GUESTS (PAX)
                                        </label>
                                        <div className="flex items-center gap-1">
                                            {[1, 2, 4, 6].map(num => (
                                                <button
                                                    key={num}
                                                    type="button"
                                                    onClick={() => setSeatingForm({ ...seatingForm, pax: num })}
                                                    className={`flex-1 py-1.5 border rounded-sm font-bold text-xs cursor-pointer ${
                                                        seatingForm.pax === num
                                                            ? 'bg-[oklch(18%_0.012_28)] text-white border-[oklch(18%_0.012_28)]'
                                                            : 'bg-[oklch(94%_0.010_28)] border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)]'
                                                    }`}
                                                >
                                                    {num}
                                                </button>
                                            ))}
                                            <input
                                                type="number"
                                                min="1"
                                                max="30"
                                                value={seatingForm.pax}
                                                onChange={e => setSeatingForm({ ...seatingForm, pax: parseInt(e.target.value) || 1 })}
                                                className="w-12 px-2 py-1 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-sm text-center font-bold"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-[oklch(55%_0.010_28)] block mb-1">
                                            DURATION (HOURS)
                                        </label>
                                        <div className="flex items-center gap-1">
                                            {[1, 1.5, 2, 3].map(h => (
                                                <button
                                                    key={h}
                                                    type="button"
                                                    onClick={() => setSeatingForm({ ...seatingForm, durationHours: h })}
                                                    className={`flex-1 py-1.5 border rounded-sm font-bold text-[11px] cursor-pointer ${
                                                        seatingForm.durationHours === h
                                                            ? 'bg-[oklch(18%_0.012_28)] text-white border-[oklch(18%_0.012_28)]'
                                                            : 'bg-[oklch(94%_0.010_28)] border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)]'
                                                    }`}
                                                >
                                                    {h}h
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-[oklch(55%_0.010_28)] block mb-1">
                                        NOTES / SPECIAL REQUESTS
                                    </label>
                                    <input
                                        type="text"
                                        value={seatingForm.note}
                                        onChange={e => setSeatingForm({ ...seatingForm, note: e.target.value })}
                                        placeholder="e.g. Birthday, High chair, Indoor preferred"
                                        className="w-full px-3 py-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-sm outline-none focus:border-[oklch(52%_0.16_28)]"
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="pt-3 border-t border-[oklch(85%_0.012_28)] flex flex-col gap-2 font-mono text-[10px] font-bold uppercase tracking-wider">
                                <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={handleConfirmSeating}
                                    className="w-full py-3 bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white rounded-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                                >
                                    <span>SEAT WALK-IN GUEST NOW</span>
                                </button>

                                <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => {
                                        setSeatingForm(prev => ({ ...prev, isMaintenanceBlock: true, guestName: 'MAINTENANCE' }));
                                        setTimeout(() => handleConfirmSeating(), 50);
                                    }}
                                    className="w-full py-2 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(42%_0.010_28)] rounded-sm transition-colors cursor-pointer"
                                >
                                    BLOCK TABLE (MAINTENANCE / RESERVED)
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* --- OCCUPIED TABLE INSPECTION & ORDERS MODAL --- */}
            <AnimatePresence>
                {inspectedTable && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
                        onClick={() => setInspectedTable(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[oklch(98%_0.006_28)] border border-[oklch(85%_0.012_28)] p-6 rounded-sm w-full max-w-lg shadow-2xl space-y-4 font-sans text-[oklch(18%_0.012_28)] max-h-[90vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="flex justify-between items-start border-b border-[oklch(85%_0.012_28)] pb-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] bg-[oklch(94%_0.02_28)] px-2 py-0.5 rounded-sm">
                                            TABLE INSPECTION
                                        </span>
                                        <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 bg-[oklch(18%_0.012_28)] text-white rounded-sm">
                                            {inspectedTable.state.status.toUpperCase()}
                                        </span>
                                    </div>
                                    <h3 className="font-mono text-2xl font-bold uppercase tracking-tight text-[oklch(18%_0.012_28)] mt-1">
                                        {inspectedTable.table.table_name}
                                    </h3>
                                    <p className="font-mono text-[10px] text-[oklch(55%_0.010_28)] uppercase">
                                        Capacity: {inspectedTable.table.capacity} Seats
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setInspectedTable(null)}
                                    className="font-mono text-xs font-bold text-[oklch(42%_0.010_28)] hover:text-black p-1 cursor-pointer"
                                >
                                    ✕ CLOSE
                                </button>
                            </div>

                            {/* Service Call Banner */}
                            {(inspectedTable.state.hasCallStaff || inspectedTable.state.hasCallBill) && (
                                <div className="bg-[oklch(96%_0.03_60)] border border-[oklch(60%_0.15_60)] p-3 rounded-sm flex items-center justify-between gap-3 font-mono text-xs">
                                    <div>
                                        <span className="font-bold uppercase text-[oklch(18%_0.012_28)]">
                                            {inspectedTable.state.hasCallStaff ? '🔔 GUEST CALLING STAFF' : '💳 GUEST REQUESTING BILL'}
                                        </span>
                                        <p className="text-[10px] text-[oklch(42%_0.010_28)] mt-0.5">
                                            Customer tapped call button from digital menu
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={actionLoading}
                                        onClick={() => handleClearServiceCall(inspectedTable.state.booking)}
                                        className="px-3 py-1.5 bg-[oklch(18%_0.012_28)] text-white font-bold text-[10px] uppercase rounded-sm cursor-pointer"
                                    >
                                        CLEAR ALERT
                                    </button>
                                </div>
                            )}

                            {/* Guest Details */}
                            {inspectedTable.state.booking && (
                                <div className="bg-[oklch(94%_0.010_28)] p-4 rounded-sm border border-[oklch(88%_0.008_28)] space-y-2 font-mono text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-[oklch(55%_0.010_28)] uppercase">GUEST NAME</span>
                                        <span className="font-bold text-[oklch(18%_0.012_28)]">
                                            {inspectedTable.state.booking.pickup_contact_name || inspectedTable.state.booking.profiles?.display_name || 'Guest'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[oklch(55%_0.010_28)] uppercase">BOOKING TYPE</span>
                                        <span className="font-bold uppercase text-[oklch(52%_0.16_28)]">
                                            {inspectedTable.state.booking.booking_type} ({inspectedTable.state.booking.pax || inspectedTable.table.capacity} PAX)
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[oklch(55%_0.010_28)] uppercase">SEATED TIME</span>
                                        <span className="font-bold">
                                            {new Date(inspectedTable.state.booking.booking_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                            {inspectedTable.state.booking.end_time && ` - ${new Date(inspectedTable.state.booking.end_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`}
                                        </span>
                                    </div>
                                    {inspectedTable.state.booking.profiles?.phone_number && (
                                        <div className="flex justify-between">
                                            <span className="text-[oklch(55%_0.010_28)] uppercase">PHONE</span>
                                            <a 
                                                href={`tel:${inspectedTable.state.booking.profiles.phone_number}`} 
                                                className="font-bold text-[oklch(52%_0.16_28)] hover:underline"
                                            >
                                                {inspectedTable.state.booking.profiles.phone_number}
                                            </a>
                                        </div>
                                    )}
                                    {inspectedTable.state.booking.customer_note && (
                                        <div className="pt-2 border-t border-[oklch(88%_0.008_28)] text-[11px] text-[oklch(42%_0.010_28)]">
                                            Note: "{inspectedTable.state.booking.customer_note}"
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Order Items Preview */}
                            {inspectedTable.state.booking?.order_items && inspectedTable.state.booking.order_items.length > 0 ? (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center font-mono text-xs font-bold uppercase tracking-wider text-[oklch(42%_0.010_28)] border-b border-[oklch(85%_0.012_28)] pb-1">
                                        <span>ACTIVE ORDER ITEMS ({inspectedTable.state.booking.order_items.length})</span>
                                        <span>STATUS</span>
                                    </div>
                                    <div className="max-h-40 overflow-y-auto space-y-1.5 font-mono text-xs pr-1">
                                        {inspectedTable.state.booking.order_items.map((item, idx) => (
                                            <div key={item.id || idx} className="flex justify-between items-center bg-[oklch(94%_0.010_28)] p-2 rounded-sm">
                                                <div>
                                                    <span className="font-bold text-[oklch(18%_0.012_28)]">
                                                        {item.quantity}x {item.menu_items?.name || 'Item'}
                                                    </span>
                                                    <span className="text-[10px] text-[oklch(55%_0.010_28)] ml-2">
                                                        ฿{(item.price * item.quantity).toLocaleString()}
                                                    </span>
                                                </div>
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase ${
                                                    item.status === 'served'
                                                        ? 'bg-[oklch(92%_0.012_140)] text-[oklch(35%_0.08_140)]'
                                                        : 'bg-[oklch(95%_0.02_28)] text-[oklch(52%_0.16_28)] animate-pulse'
                                                }`}>
                                                    {item.status || 'ORDERED'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-between items-center bg-[oklch(90%_0.012_28)] p-2.5 rounded-sm font-mono text-xs font-bold">
                                        <span>TOTAL BILL AMOUNT</span>
                                        <span className="text-sm text-[oklch(52%_0.16_28)]">
                                            ฿{inspectedTable.state.totalBill.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-4 text-center font-mono text-xs text-[oklch(55%_0.010_28)] bg-[oklch(94%_0.010_28)] rounded-sm">
                                    NO FOOD OR DRINK ORDERS YET
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="pt-3 border-t border-[oklch(85%_0.012_28)] grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[10px] font-bold uppercase tracking-wider">
                                <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => handleExtendTime(inspectedTable.state.booking, 30)}
                                    className="py-2.5 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] rounded-sm cursor-pointer"
                                >
                                    +30 MINS
                                </button>
                                <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => handleExtendTime(inspectedTable.state.booking, 60)}
                                    className="py-2.5 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] rounded-sm cursor-pointer"
                                >
                                    +60 MINS
                                </button>
                                <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => setTransferModalData({ fromTable: inspectedTable.table, booking: inspectedTable.state.booking })}
                                    className="py-2.5 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] rounded-sm cursor-pointer"
                                >
                                    MOVE TABLE
                                </button>
                                <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => handleReleaseTable(inspectedTable.state.booking.id, inspectedTable.table.table_name)}
                                    className="py-2.5 bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white rounded-sm cursor-pointer"
                                >
                                    RELEASE TABLE
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* --- TABLE TRANSFER / MOVE GUEST MODAL --- */}
            <AnimatePresence>
                {transferModalData && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
                        onClick={() => setTransferModalData(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[oklch(98%_0.006_28)] border border-[oklch(85%_0.012_28)] p-6 rounded-sm w-full max-w-md shadow-2xl space-y-4 font-sans text-[oklch(18%_0.012_28)]"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-start border-b border-[oklch(85%_0.012_28)] pb-3">
                                <div>
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)]">
                                        TRANSFER SEATING & ORDERS
                                    </span>
                                    <h3 className="font-mono text-lg font-bold uppercase tracking-tight text-[oklch(18%_0.012_28)] mt-0.5">
                                        Move from {transferModalData.fromTable.table_name}
                                    </h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setTransferModalData(null)}
                                    className="font-mono text-xs font-bold text-[oklch(42%_0.010_28)] hover:text-black p-1 cursor-pointer"
                                >
                                    ✕ CLOSE
                                </button>
                            </div>

                            <p className="font-mono text-xs text-[oklch(55%_0.010_28)]">
                                Select a vacant target table to migrate all active orders, bill total, and guest tracking:
                            </p>

                            <div className="max-h-60 overflow-y-auto grid grid-cols-3 gap-2">
                                {vacantTables.map(targetT => (
                                    <button
                                        key={targetT.id}
                                        type="button"
                                        disabled={actionLoading}
                                        onClick={() => handleTransferTable(targetT.id, targetT.table_name)}
                                        className="p-3 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(92%_0.012_140)] border border-[oklch(85%_0.012_28)] hover:border-[oklch(45%_0.08_140)] rounded-sm text-center font-mono transition-all cursor-pointer"
                                    >
                                        <span className="font-bold text-sm text-[oklch(18%_0.012_28)] block">
                                            {targetT.table_name}
                                        </span>
                                        <span className="text-[9px] text-[oklch(55%_0.010_28)] uppercase">
                                            {targetT.capacity}P
                                        </span>
                                    </button>
                                ))}
                                {vacantTables.length === 0 && (
                                    <div className="col-span-3 py-6 text-center font-mono text-xs text-[oklch(55%_0.010_28)]">
                                        NO VACANT TABLES AVAILABLE
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
