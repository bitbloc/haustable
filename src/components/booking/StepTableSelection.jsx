import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import { Maximize, Minimize, ZoomIn, ZoomOut, RotateCw, X, Image } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import { useBooking } from '../../hooks/useBooking'
import { supabase } from '../../lib/supabaseClient' // For direct Tooltip availability check if needed

export default function StepTableSelection() {
    const { t } = useLanguage()
    const {
        date, time, pax,
        tables, bookedTableIds, bookedTableStatuses,
        selectedTable,
        selectTable,
        isExpanded, dispatch, nextStep,
        settings,
        refreshAvailability
    } = useBooking()

    // Local UI State
    const [previewImage, setPreviewImage] = useState(null)
    const [availabilityTooltip, setAvailabilityTooltip] = useState(null)
    const [lockedTableIds, setLockedTableIds] = useState([]) // From Presence
    const channelRef = useRef(null)
    
    // Unique ID for this browser session's presence
    const sessionId = useMemo(() => crypto.randomUUID(), [])

    // Fetch availability on mount (or whenever entering this step)
    useEffect(() => {
        refreshAvailability()

        // 1. Database Real-time (Bookings)
        const dbChannel = supabase
            .channel('public:bookings')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload) => {
                refreshAvailability()
            })
            .subscribe()

        // 2. Presence Real-time (Table Locks)
        const presenceChannel = supabase.channel('table_locks', {
            config: { presence: { key: sessionId } }
        })
        
        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                const state = presenceChannel.presenceState()
                const lockedIds = []
                for (const key in state) {
                    if (key !== sessionId) { // Don't lock our own selected table
                        state[key].forEach(presence => {
                            if (presence.table_id) lockedIds.push(presence.table_id)
                        })
                    }
                }
                setLockedTableIds(lockedIds)
            })
            .subscribe()

        channelRef.current = presenceChannel

        return () => {
            supabase.removeChannel(dbChannel)
            supabase.removeChannel(presenceChannel)
        }
    }, [date, time, sessionId]) 

    // Update Presence & 5-minute Auto-Release Timer when selectedTable changes
    useEffect(() => {
        let idleTimer = null;
        if (channelRef.current && channelRef.current.state === 'joined') {
            if (selectedTable) {
                channelRef.current.track({ table_id: selectedTable.id })
                
                // 5-minute (300,000ms) Auto-Release Timeout
                idleTimer = setTimeout(() => {
                    selectTable(null)
                }, 5 * 60 * 1000)
            } else {
                channelRef.current.untrack()
            }
        }
        return () => {
            if (idleTimer) clearTimeout(idleTimer)
        }
    }, [selectedTable])

    // Toggle Expanded
    const toggleExpanded = () => dispatch({ type: 'TOGGLE_EXPAND' })

    const renderTable = (table) => {
        const isBooked = bookedTableIds.includes(table.id)
        const isLockedByOthers = lockedTableIds.includes(table.id) && !isBooked
        const isSelected = selectedTable?.id === table.id
        const rotation = table.rotation || 0

        // Status Logic
        let statusType = 'online'
        if (isBooked && bookedTableStatuses && bookedTableStatuses[table.id]) {
            statusType = bookedTableStatuses[table.id].type 
        }

        const baseStyle = {
            position: 'absolute',
            left: `${table.pos_x}%`,
            top: `${table.pos_y}%`,
            width: `${table.width}%`,
            height: `${table.height}%`,
            transform: `rotate(${rotation}deg)`
        }

        let bgColor = isBooked 
            ? (statusType === 'walk_in' ? '#F97316' : '#ef4444') 
            : isLockedByOthers 
                ? '#9CA3AF' // Grey for temporarily locked
                : (isSelected ? '#000000' : (table.table_color || '#ffffff'))
            
        let textColor = (isBooked || isSelected || isLockedByOthers || ['#333333', '#7F1D1D', '#14532D', '#1E3A8A', '#581C87'].includes(bgColor)) ? 'white' : 'black'
        let borderColor = isSelected ? 'white' : 'transparent'

        return (
            <button
                key={table.id}
                onClick={(e) => {
                    e.stopPropagation()
                    if (isBooked) {
                        const statusLabel = statusType === 'walk_in' ? 'Walk-in' : 'Booked'
                        setAvailabilityTooltip({ x: e.clientX, y: e.clientY, text: `${t('bookedTooltip')} (${statusLabel})`, loading: false })
                        setTimeout(() => setAvailabilityTooltip(null), 2000)
                    } else if (isLockedByOthers) {
                        setAvailabilityTooltip({ x: e.clientX, y: e.clientY, text: `กำลังจอง... (Someone is looking)`, loading: false })
                        setTimeout(() => setAvailabilityTooltip(null), 2000)
                    } else {
                        selectTable(table)
                    }
                }}
                style={baseStyle}
                className={`transition-all duration-300 flex flex-col items-center justify-center shadow-md
                ${table.shape === 'circle' ? 'rounded-full' : 'rounded-lg'}
                ${isBooked || isLockedByOthers ? 'opacity-90 cursor-not-allowed contrast-100' : 'hover:scale-105 active:scale-95 cursor-pointer'}
                ${isSelected ? 'z-20 ring-4 ring-black/20 scale-105' : ''}
                ${isLockedByOthers ? 'animate-pulse' : ''}
                `}
            >
                <div className={`absolute inset-0 w-full h-full ${table.shape === 'circle' ? 'rounded-full' : 'rounded-lg'} `} style={{ backgroundColor: bgColor, border: `2px solid ${borderColor} ` }} />
                <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-1" style={{ transform: `rotate(${-rotation}deg)` }}>
                    {isBooked ? (
                        <>
                            <span className="font-bold text-[8px] uppercase tracking-wider" style={{ color: textColor }}>
                                {statusType === 'walk_in' ? 'WALK-IN' : t('full')}
                            </span>
                            <span className="text-[8px] opacity-75" style={{ color: textColor }}>{table.table_name}</span>
                        </>
                    ) : isLockedByOthers ? (
                        <>
                            <span className="font-bold text-[8px] uppercase tracking-wider" style={{ color: textColor }}>
                                LOCK
                            </span>
                            <span className="text-[8px] opacity-75" style={{ color: textColor }}>{table.table_name}</span>
                        </>
                    ) : (
                        <>
                            <span className="font-bold text-xs sm:text-sm truncate" style={{ color: textColor }}>{table.table_name}</span>
                            <span className="text-[8px] sm:text-[10px] opacity-75" style={{ color: textColor }}>{table.capacity}p</span>
                        </>
                    )}
                </div>
            </button>
        )
    }

    return (
        <div className="h-full flex flex-col relative">
            {/* Top Controls Overlay */}
            <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-start pointer-events-none">
                <div className="bg-paper p-4 rounded-rams border border-ink pointer-events-auto">
                    <h2 className="text-lg font-bold text-ink leading-none">{t('selectTable')}</h2>
                    <div className="flex items-center gap-2 mt-2 text-xs sm:text-sm text-subInk font-medium whitespace-nowrap">
                        <span className="bg-paper border border-[var(--color-rule)] px-2 py-1 rounded-rams">{date}</span>
                        <span className="bg-paper border border-[var(--color-rule)] px-2 py-1 rounded-rams">{time}</span>
                        <span className="bg-ink text-paper px-2 py-1 rounded-rams">{pax} {t('guests')}</span>
                    </div>
                    {/* Legend */}
                    <div className="flex justify-center gap-6 mt-4 mb-2">
                        <div className="flex items-center gap-2 text-xs font-mono text-subInk font-bold"><div className="w-3 h-3 bg-[#4CAF50] rounded-none"></div>{t('available')}</div>
                        <div className="flex items-center gap-2 text-xs font-mono text-subInk font-bold"><div className="w-3 h-3 bg-brand rounded-none border border-ink"></div>{t('selected')}</div>
                        <div className="flex items-center gap-2 text-xs font-mono text-subInk font-bold"><div className="w-3 h-3 bg-[var(--color-rule)] rounded-none"></div>{t('unavailable')}</div>
                    </div>
                </div>
                <button onClick={toggleExpanded} className="bg-paper p-3 rounded-rams border border-ink text-ink pointer-events-auto hover:bg-paper transition-colors">
                    {isExpanded ? <Minimize size={20} /> : <Maximize size={20} />}
                </button>
            </div>

            {/* Tooltip */}
            {availabilityTooltip && (
                <div
                    className="fixed z-50 bg-ink text-paper text-xs px-3 py-1 rounded-rams pointer-events-none transform -translate-x-1/2 -translate-y-full mt-[-8px]"
                    style={{ left: availabilityTooltip.x, top: availabilityTooltip.y }}
                >
                    {availabilityTooltip.text}
                    <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-ink rotate-45"></div>
                </div>
            )}

            {/* Lightbox */}
            <AnimatePresence>
                {previewImage && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[100] bg-ink/95 flex items-center justify-center p-4 cursor-pointer"
                        onClick={() => setPreviewImage(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center"
                            onClick={e => e.stopPropagation()}
                        >
                            <button onClick={() => setPreviewImage(null)} className="absolute top-4 right-4 bg-paper/20 hover:bg-paper/40 text-paper p-2 rounded-rams backdrop-blur-md z-10">
                                <X size={24} />
                            </button>
                            <img src={previewImage} className="w-full h-full object-contain rounded-rams" alt="Table Preview" />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className={`flex-1 overflow-hidden relative rounded-rams border border-ink bg-[#f0f0f0] transition-all duration-500 ${isExpanded ? 'fixed inset-0 z-50 rounded-none' : ''} `}>
                <TransformWrapper initialScale={0.9} minScale={0.2} maxScale={4} centerOnInit={true} limitToBounds={false}>
                    {({ zoomIn, zoomOut, resetTransform }) => (
                        <>
                            <div className="absolute bottom-24 right-4 z-20 flex flex-col gap-2 pointer-events-auto">
                                <button onClick={() => zoomIn()} className="bg-paper p-2 rounded-rams border border-ink hover:bg-gray-50 active:scale-90 transition-transform"><ZoomIn size={20} /></button>
                                <button onClick={() => zoomOut()} className="bg-paper p-2 rounded-rams border border-ink hover:bg-gray-50 active:scale-90 transition-transform"><ZoomOut size={20} /></button>
                                <button onClick={() => resetTransform()} className="bg-paper p-2 rounded-rams border border-ink hover:bg-gray-50 active:scale-90 transition-transform"><RotateCw size={20} /></button>
                            </div>
                            <TransformComponent wrapperClass="w-full h-full flex items-center justify-center bg-[#f0f0f0]" contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div
                                    className="relative w-[1000px] aspect-video bg-paper border border-[var(--color-rule)] origin-center"
                                    style={{
                                        backgroundImage: settings.floorplanUrl ? `url(${settings.floorplanUrl})` : undefined,
                                        backgroundSize: '100% 100%',
                                        backgroundRepeat: 'no-repeat',
                                    }}
                                    onClick={() => selectTable(null)}
                                >
                                    {tables.map(table => renderTable(table))}
                                </div>
                            </TransformComponent>
                        </>
                    )}
                </TransformWrapper>

                {/* Selected Table Card */}
                <AnimatePresence>
                    {selectedTable && (
                        <motion.div
                            initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
                            transition={{ type: "tween", duration: 0.2 }}
                            className="absolute bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 bg-paper p-4 rounded-rams border border-ink z-30 shadow-lg"
                        >
                            <div className="flex gap-4">
                                <div
                                    className="w-20 h-20 rounded-rams bg-paper border border-[var(--color-rule)] overflow-hidden cursor-zoom-in shrink-0 relative group"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (selectedTable.image_url) setPreviewImage(selectedTable.image_url);
                                    }}
                                >
                                    {selectedTable.image_url ? (
                                        <>
                                            <img src={selectedTable.image_url} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                                <Maximize size={16} className="text-white opacity-0 group-hover:opacity-100" />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300"><Image size={24} /></div>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-lg truncate pr-2">{selectedTable.table_name}</h3>
                                        <button onClick={() => selectTable(null)} className="text-gray-400 hover:text-black"><X size={18} /></button>
                                    </div>
                                    <p className="text-gray-500 text-xs mb-3">{selectedTable.capacity} {t('seats')}</p>
                                    <button onClick={nextStep} className="w-full bg-black text-white py-2 rounded-lg font-bold text-xs shadow-md">
                                        {t('select')}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
