
import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import { ZoomIn, ZoomOut, RotateCw, Maximize, X, Clock, User, Phone, Trash2, CheckCircle, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { formatThaiTime } from '../../utils/timeUtils' // Ensure this exists or use local helper

export default function TableManager({ isStaffView = false }) {
    const [tables, setTables] = useState([])
    const [bookings, setBookings] = useState([]) // Current Active Bookings
    const [floorplanUrl, setFloorplanUrl] = useState(null)
    const [loading, setLoading] = useState(true)
    const [selectedTable, setSelectedTable] = useState(null) // For Action Modal
    
    // Auto-refresh interval
    useEffect(() => {
        fetchData()
        const interval = setInterval(fetchData, 30000) // Poll every 30s
        
        // Subscribe to realtime changes for instant updates
        const channel = supabase
            .channel('table-manager')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
                fetchData()
            })
            .subscribe()

        return () => {
             clearInterval(interval)
             supabase.removeChannel(channel)
        }
    }, [])

    const fetchData = async () => {
        try {
            // 1. Tables
            const { data: tablesData } = await supabase.from('tables_layout').select('*')
            if (tablesData) setTables(tablesData)

            // 2. Settings (Floorplan)
            const { data: settingsData } = await supabase.from('app_settings').select('value').eq('key', 'floorplan_url').single()
            if (settingsData?.value) setFloorplanUrl(settingsData.value)

            // 3. Active Bookings (Today & Overlapping NOW)
            // Logic: Booking is active if (status in confirmed, pending, seated, ready) AND (overlaps current time OR is future today)
            // For Blocking view, we care about "Is it occupied NOW or SOON?"
            // Simplify: Fetch ALL bookings for TODAY (00:00 to 23:59) and let JS filter for color status
            const today = new Date().toISOString().split('T')[0]
            const start = `${today}T00:00:00`
            const end = `${today}T23:59:59`

            const { data: bookingsData } = await supabase
                .from('bookings')
                .select('*, profiles(display_name, phone_number)')
                .in('status', ['confirmed', 'pending', 'seated', 'ready'])
                .gte('booking_time', start)
                .lte('booking_time', end)
            
            if (bookingsData) setBookings(bookingsData)

            setLoading(false)
        } catch (err) {
            console.error("Fetch Error", err)
        }
    }

    // --- Logic ---
    const getTableStatus = (tableId) => {
        const now = new Date()
        // Find bookings for this table
        const tableBookings = bookings.filter(b => b.table_id === tableId)
        
        if (tableBookings.length === 0) return 'free'

        // Check for current overlap
        const currentBooking = tableBookings.find(b => {
             const start = new Date(b.booking_time)
             // End Time: Use specific end_time column OR default to start + 2 hours
             const endTime = b.end_time ? new Date(b.end_time) : new Date(start.getTime() + (2 * 60 * 60 * 1000))
             return now >= start && now < endTime
        })

        if (currentBooking) {
            return {
                status: 'occupied',
                type: currentBooking.booking_type === 'walk_in' ? 'walk_in' : 'online',
                booking: currentBooking
            }
        }

        // Check for future/upcoming in next 30 mins (Warning)
        const upcomingBooking = tableBookings.find(b => {
            const start = new Date(b.booking_time)
            const diff = (start - now) / 60000 // minutes
            return diff > 0 && diff <= 60
        })

        if (upcomingBooking) {
            return {
                status: 'upcoming',
                booking: upcomingBooking
            }
        }

        return 'free'
    }

    // --- Actions ---
    const handleTableClick = (table, statusData) => {
        if (statusData === 'free') {
            // Quick Block Logic (Single Tap)
            quickBlock(table)
        } else {
            // Show Details (Occupied or Upcoming)
            setSelectedTable({ table, statusData })
        }
    }

    const quickBlock = async (table) => {
        try {
            // Optimistic UI could happen here
            const now = new Date()
            const endTime = new Date(now.getTime() + (2 * 60 * 60 * 1000)) // +2 Hours

            const payload = {
                table_id: table.id,
                booking_time: now.toISOString(),
                end_time: endTime.toISOString(), // New Column
                booking_type: 'walk_in',
                status: 'confirmed',
                pickup_contact_name: 'Walk-in Guest',
                customer_note: 'Internal Block',
                pax: table.capacity,
                total_amount: 0,
                tracking_token: crypto.randomUUID()
            }

            const { error } = await supabase.from('bookings').insert(payload)
            if (error) throw error

            toast.success(`Blocked ${table.table_name} for 2 Hours`, {
                description: 'Tap table again to release',
                duration: 2000
            })
            fetchData() 

        } catch (err) {
            toast.error('Failed to block: ' + err.message)
        }
    }

    const handleRelease = async (bookingId) => {
        try {
            // Release = set end_time to NOW (finish early) OR set status to completed
            // If it's a walk-in that just started, maybe "Void" or "Completed"
            // Let's set to 'completed' so it clears from "Active" checks
            const { error } = await supabase
                .from('bookings')
                .update({ status: 'completed', end_time: new Date().toISOString() })
                .eq('id', bookingId)

            if (error) throw error
            
            toast.success('Table Released')
            setSelectedTable(null)
            fetchData()
        } catch (err) {
            toast.error('Release failed: ' + err.message)
        }
    }

     const handleExtendTime = async (bookingId, minutes) => {
        try {
             // Fetch current end_time first to be safe, or use what we have
             // We can just query valid booking again or use selectedTable.statusData.booking
             const booking = selectedTable.statusData.booking
             const currentEnd = booking.end_time ? new Date(booking.end_time) : new Date(new Date(booking.booking_time).getTime() + 2*60*60*1000)
             const newEnd = new Date(currentEnd.getTime() + (minutes * 60000))

             const { error } = await supabase.from('bookings').update({ end_time: newEnd.toISOString() }).eq('id', bookingId)
             if (error) throw error
             
             toast.success(`Extended by ${minutes} mins`)
             setSelectedTable(null)
             fetchData()

        } catch (err) {
             toast.error('Extend failed')
        }
    }

    // --- Renderers ---
    const renderTable = (table) => {
        const statusData = getTableStatus(table.id)
        const isOccupied = typeof statusData === 'object' && statusData.status === 'occupied'
        const isUpcoming = typeof statusData === 'object' && statusData.status === 'upcoming'
        
        let bgColor = '#10B981' // Green (Free)
        let borderColor = 'transparent'
        
        if (isOccupied) {
            if (statusData.type === 'walk_in') bgColor = '#F97316' // Orange (Walk-in)
            else bgColor = '#EF4444' // Red (Online)
        } else if (isUpcoming) {
            bgColor = '#EAB308' // Yellow (Warning)
            borderColor = '#EF4444' 
        } else if (table.table_color && table.table_color !== '#333333') {
             // Keep custom color if free? Or force green for "Manager View" consistency?
             // User requested "Green = Available", "Red = Occupied". 
             // Let's override custom colors with Status Colors for this specific Manager View.
        }

        const rotation = table.rotation || 0
        const style = {
            position: 'absolute',
            left: `${table.pos_x}%`,
            top: `${table.pos_y}%`,
            width: `${table.width}%`,
            height: `${table.height}%`,
            transform: `rotate(${rotation}deg)`,
            transition: 'all 0.3s ease'
        }

        return (
            <div
                key={table.id}
                onClick={(e) => { e.stopPropagation(); handleTableClick(table, statusData); }}
                style={style}
                className={`cursor-pointer group ${table.shape === 'circle' ? 'rounded-full' : 'rounded-lg'} shadow-md hover:shadow-xl hover:scale-105 active:scale-95`}
            >
                <div className={`absolute inset-0 w-full h-full ${table.shape === 'circle' ? 'rounded-full' : 'rounded-lg'} opacity-90`} style={{ backgroundColor: bgColor, border: isUpcoming ? `2px solid ${borderColor}` : 'none' }} />
                
                {/* Content */}
                <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-1 text-white" style={{ transform: `rotate(${-rotation}deg)` }}>
                    <span className="font-bold text-xs sm:text-sm drop-shadow-md truncate">{table.table_name}</span>
                    {isOccupied && (
                        <span className="text-[10px] font-medium opacity-90 drop-shadow-md">
                            {statusData.type === 'walk_in' ? 'Walk-in' : 'Online'}
                        </span>
                    )}
                    {isUpcoming && (
                        <span className="text-[10px] font-bold text-red-600 bg-white/90 px-1 rounded-full animate-pulse">
                            Soon
                        </span>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="bg-[#1a1a1a] w-full h-full min-h-[500px] relative overflow-hidden flex flex-col rounded-xl border border-gray-800">
            {/* Header / Instructions */}
            <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur text-white p-3 rounded-xl border border-white/10 pointer-events-none">
                <div className="flex items-center gap-3 text-xs mb-1">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-[#10B981]"></div> Available</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-[#F97316]"></div> Walk-in</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-[#EF4444]"></div> Online</div>
                </div>
                <div className="text-[10px] text-gray-400">
                    Tap Available to Block (2hr). Tap Occupied to Release.
                </div>
            </div>

            <TransformWrapper initialScale={0.8} minScale={0.2} maxScale={4} centerOnInit={true}>
                {({ zoomIn, zoomOut, resetTransform }) => (
                    <>
                         <div className="absolute bottom-4 right-4 z-10 flex gap-2">
                             <button onClick={() => zoomIn()} className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg"><ZoomIn size={20}/></button>
                             <button onClick={() => zoomOut()} className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg"><ZoomOut size={20}/></button>
                             <button onClick={() => resetTransform()} className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg"><RotateCw size={20}/></button>
                         </div>

                         <TransformComponent wrapperClass="w-full h-full" contentStyle={{ width: '100%', height: '100%' }}>
                            <div 
                                className="relative w-[1000px] aspect-video bg-[#222] shadow-2xl origin-center"
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
                    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedTable(null)}>
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }} 
                            animate={{ scale: 1, opacity: 1 }} 
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white text-black p-6 rounded-2xl w-full max-w-sm shadow-2xl space-y-4"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-bold">{selectedTable.table.table_name}</h3>
                                    <p className="text-sm text-gray-500">{selectedTable.table.capacity} Seats</p>
                                </div>
                                {selectedTable.statusData.status === 'occupied' && (
                                    <span className={`px-2 py-1 rounded-lg text-xs font-bold uppercase ${selectedTable.statusData.type === 'walk_in' ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'}`}>
                                        {selectedTable.statusData.type}
                                    </span>
                                )}
                            </div>

                            {/* Info Section */}
                             {selectedTable.statusData.status === 'occupied' && (
                                <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-sm">
                                    <div className="flex items-center gap-2 text-gray-700">
                                        <Clock size={16} />
                                        <span>
                                            Start: {new Date(selectedTable.statusData.booking.booking_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                             {selectedTable.statusData.booking.end_time && ` - End: ${new Date(selectedTable.statusData.booking.end_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-700">
                                        <User size={16} />
                                        <span>{selectedTable.statusData.booking.profiles?.display_name || selectedTable.statusData.booking.pickup_contact_name || 'Guest'}</span>
                                    </div>
                                    {selectedTable.statusData.booking.profiles?.phone_number && (
                                         <div className="flex items-center gap-2 text-gray-700">
                                            <Phone size={16} />
                                            <span>{selectedTable.statusData.booking.profiles.phone_number}</span>
                                        </div>
                                    )}
                                </div>
                             )}

                             {/* Upcoming Warning */}
                             {selectedTable.statusData.status === 'upcoming' && (
                                 <div className="bg-yellow-50 p-3 rounded-xl flex items-start gap-2 text-yellow-800 text-sm">
                                     <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                     <div>
                                         <strong>Coming Soon:</strong> Check-in at {new Date(selectedTable.statusData.booking.booking_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                     </div>
                                 </div>
                             )}

                             {/* Actions */}
                             <div className="grid grid-cols-2 gap-3 pt-2">
                                {selectedTable.statusData.status === 'occupied' ? (
                                    <>
                                        <button 
                                            onClick={() => handleExtendTime(selectedTable.statusData.booking.id, 30)}
                                            className="col-span-1 bg-gray-100 hover:bg-gray-200 text-black py-3 rounded-xl font-bold text-sm transition-colors"
                                        >
                                            +30 Mins
                                        </button>
                                        <button 
                                            onClick={() => handleRelease(selectedTable.statusData.booking.id)}
                                            className="col-span-1 bg-black text-white hover:bg-gray-800 py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                                        >
                                            Release Table
                                        </button>
                                    </>
                                ) : (
                                    // Fallback for "Free" if we opened modal via Long Press (future)
                                    // Or if status changed
                                    <button 
                                        onClick={() => { quickBlock(selectedTable.table); setSelectedTable(null); }}
                                        className="col-span-2 bg-orange-500 text-white py-3 rounded-xl font-bold"
                                    >
                                        Block Manual
                                    </button>
                                )}
                             </div>
                             
                             <button onClick={() => setSelectedTable(null)} className="w-full text-center text-gray-400 text-sm py-2">Close</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
