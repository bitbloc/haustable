import React, { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, X, Image as ImageIcon, Check } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import { useBooking } from '../../hooks/useBooking'
import { supabase } from '../../lib/supabaseClient'
import { safeCssUrl } from '../../utils/urlHelper'

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
    const lastTrackedRef = useRef(null) // Prevents duplicate .track() calls
    const selectedTableRef = useRef(selectedTable)
    const dateRef = useRef(date)
    const timeRef = useRef(time)
    
    // Keep refs up to date
    useEffect(() => {
        selectedTableRef.current = selectedTable
        dateRef.current = date
        timeRef.current = time
    }, [selectedTable, date, time])
    
    // Unique ID for this browser session's presence
    const sessionId = useMemo(() => crypto.randomUUID(), [])

    // Fetch availability on mount (or whenever entering this step)
    useEffect(() => {
        refreshAvailability()

        // 1. Database Real-time (Bookings) with unique channel ID
        const dbChannel = supabase
            .channel(`booking-table-realtime-${sessionId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
                refreshAvailability()
            })
            .subscribe()

        // 2. Presence Real-time (Table Locks scoped to Date & Time)
        const presenceChannel = supabase.channel('table_locks', {
            config: { presence: { key: sessionId } }
        })
        
        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                const state = presenceChannel.presenceState()
                const lockedIds = []
                const currentDate = dateRef.current
                const currentTime = timeRef.current

                for (const key in state) {
                    if (key !== sessionId) { // Don't lock our own selected table
                        state[key].forEach(presence => {
                            if (presence.table_id && presence.date === currentDate) {
                                // If same date, check if time slot overlaps (within 2-hour window)
                                if (!presence.time || !currentTime) {
                                    lockedIds.push(presence.table_id)
                                } else {
                                    const [h1, m1] = String(presence.time).split(':').map(Number)
                                    const [h2, m2] = String(currentTime).split(':').map(Number)
                                    const t1 = (h1 || 0) * 60 + (m1 || 0)
                                    const t2 = (h2 || 0) * 60 + (m2 || 0)
                                    if (Math.abs(t1 - t2) < 120) {
                                        lockedIds.push(presence.table_id)
                                    }
                                }
                            }
                        })
                    }
                }

                const sortedNew = [...new Set(lockedIds)].sort()
                setLockedTableIds(prev => {
                    if (prev.length === sortedNew.length && prev.every((val, idx) => val === sortedNew[idx])) {
                        return prev; // Prevent unnecessary re-render if identical
                    }
                    return sortedNew;
                })
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED' && selectedTableRef.current) {
                    try {
                        await presenceChannel.track({
                            table_id: selectedTableRef.current.id,
                            date: dateRef.current,
                            time: timeRef.current
                        })
                        lastTrackedRef.current = selectedTableRef.current.id
                    } catch (e) {
                        console.warn('Presence initial track warning:', e)
                    }
                }
            })

        channelRef.current = presenceChannel

        return () => {
            if (lastTrackedRef.current && channelRef.current) {
                try {
                    channelRef.current.untrack()
                } catch (e) {}
                lastTrackedRef.current = null
            }
            supabase.removeChannel(dbChannel)
            supabase.removeChannel(presenceChannel)
            channelRef.current = null
        }
    }, [date, time, sessionId]) 

    // Update Presence with 400ms Debounce & 5-minute Auto-Release Timer
    useEffect(() => {
        let idleTimer = null
        let debounceTimer = null

        const currentSelectedId = selectedTable?.id || null

        // Only send presence packet if the selection actually changed
        if (currentSelectedId !== lastTrackedRef.current) {
            debounceTimer = setTimeout(async () => {
                const channel = channelRef.current
                if (!channel || channel.state !== 'joined') return

                try {
                    if (selectedTable) {
                        await channel.track({ table_id: selectedTable.id, date, time })
                        lastTrackedRef.current = selectedTable.id
                    } else if (lastTrackedRef.current) {
                        await channel.untrack()
                        lastTrackedRef.current = null
                    }
                } catch (err) {
                    console.warn('Presence track/untrack rate guard:', err)
                }
            }, 400) // 400ms Debounce prevents rate limit spikes
        }

        if (selectedTable) {
            // 5-minute (300,000ms) Auto-Release Timeout
            idleTimer = setTimeout(() => {
                selectTable(null)
            }, 5 * 60 * 1000)
        }

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            if (idleTimer) clearTimeout(idleTimer)
        }
    }, [selectedTable, date, time])

    // Body scroll lock & Escape key listener for fullscreen mode
    useEffect(() => {
        if (!isExpanded) return;
        
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                dispatch({ type: 'TOGGLE_EXPAND' });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isExpanded, dispatch]);

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
            ? (statusType === 'walk_in' ? 'oklch(52% 0.16 28)' : 'oklch(45% 0.18 28)') 
            : isLockedByOthers 
                ? 'oklch(55% 0.010 28)' // Grey for temporarily locked
                : (isSelected ? 'oklch(18% 0.012 28)' : (table.table_color || 'oklch(97% 0.008 28)'))
            
        let textColor = (isBooked || isSelected || isLockedByOthers || ['#333333', '#7F1D1D', '#14532D', '#1E3A8A', '#581C87'].includes(bgColor)) 
            ? 'oklch(97% 0.008 28)' 
            : 'oklch(18% 0.012 28)'
        let borderColor = isSelected ? 'oklch(52% 0.16 28)' : 'oklch(85% 0.012 28)'

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
                        setAvailabilityTooltip({ x: e.clientX, y: e.clientY, text: `กำลังจอง... (Someone is selecting)`, loading: false })
                        setTimeout(() => setAvailabilityTooltip(null), 2000)
                    } else {
                        selectTable(table)
                    }
                }}
                style={baseStyle}
                className={`transition-all duration-200 flex flex-col items-center justify-center shadow-sm select-none
                ${table.shape === 'circle' ? 'rounded-full' : 'rounded-md'}
                ${isBooked || isLockedByOthers ? 'opacity-85 cursor-not-allowed contrast-100' : 'hover:scale-[1.03] active:scale-95 cursor-pointer'}
                ${isSelected ? 'z-20 ring-2 ring-[oklch(52%_0.16_28)] scale-[1.03]' : ''}
                ${isLockedByOthers ? 'animate-pulse' : ''}
                `}
            >
                <div 
                    className={`absolute inset-0 w-full h-full ${table.shape === 'circle' ? 'rounded-full' : 'rounded-md'}`} 
                    style={{ backgroundColor: bgColor, border: `1.5px solid ${borderColor}` }} 
                />
                <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-1" style={{ transform: `rotate(${-rotation}deg)` }}>
                    {isBooked ? (
                        <>
                            <span className="font-mono font-bold text-[8px] uppercase tracking-wider" style={{ color: textColor }}>
                                {statusType === 'walk_in' ? 'WALK-IN' : t('full')}
                            </span>
                            <span className="font-mono text-[8px] opacity-80" style={{ color: textColor }}>{table.table_name}</span>
                        </>
                    ) : isLockedByOthers ? (
                        <>
                            <span className="font-mono font-bold text-[8px] uppercase tracking-wider" style={{ color: textColor }}>
                                LOCK
                            </span>
                            <span className="font-mono text-[8px] opacity-80" style={{ color: textColor }}>{table.table_name}</span>
                        </>
                    ) : (
                        <>
                            <span className="font-bold text-xs sm:text-sm truncate" style={{ color: textColor }}>{table.table_name}</span>
                            <span className="font-mono text-[8px] sm:text-[9px] opacity-75" style={{ color: textColor }}>{table.capacity}p</span>
                        </>
                    )}
                </div>
            </button>
        )
    }

    // Shared Floorplan Canvas Component
    const renderFloorplanCanvas = (inFullscreen = false) => (
        <div className="relative w-full h-full flex flex-col overflow-hidden bg-[oklch(94%_0.010_28)]">
            <TransformWrapper initialScale={0.88} minScale={0.2} maxScale={4} centerOnInit={true} limitToBounds={false}>
                {({ zoomIn, zoomOut, resetTransform }) => (
                    <>
                        {/* Zoom Controls Panel */}
                        <div className={`absolute ${inFullscreen ? 'bottom-8 right-6' : 'bottom-20 right-4'} z-30 flex flex-col gap-1.5 pointer-events-auto bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] shadow-lg p-1 rounded-lg`}>
                            <button 
                                onClick={() => zoomIn()} 
                                title="Zoom In"
                                className="p-2 hover:bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] active:scale-95 transition-all rounded"
                            >
                                <ZoomIn size={18} />
                            </button>
                            <button 
                                onClick={() => zoomOut()} 
                                title="Zoom Out"
                                className="p-2 hover:bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] active:scale-95 transition-all rounded"
                            >
                                <ZoomOut size={18} />
                            </button>
                            <button 
                                onClick={() => resetTransform()} 
                                title="Reset View"
                                className="p-2 hover:bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] active:scale-95 transition-all rounded border-t border-[oklch(85%_0.012_28)]"
                            >
                                <RotateCcw size={16} />
                            </button>
                        </div>

                        {/* Interactive Zoom/Pan Component */}
                        <TransformComponent 
                            wrapperClass="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing" 
                            contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <div
                                className="relative w-[1000px] aspect-video bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] shadow-sm origin-center"
                                style={{
                                    backgroundImage: safeCssUrl(settings.floorplanUrl),
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

            {/* Selected Table Floating Card */}
            <AnimatePresence>
                {selectedTable && (
                    <motion.div
                        initial={{ y: 60, opacity: 0 }} 
                        animate={{ y: 0, opacity: 1 }} 
                        exit={{ y: 60, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 350, damping: 28 }}
                        className={`absolute ${inFullscreen ? 'bottom-6 left-6 right-6 sm:left-auto sm:right-6 sm:w-96' : 'bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80'} bg-[oklch(97%_0.008_28)] p-4 border border-[oklch(85%_0.012_28)] shadow-2xl z-40 rounded-xl`}
                    >
                        <div className="flex gap-3.5">
                            <div
                                className="w-18 h-18 rounded-lg bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] overflow-hidden cursor-zoom-in shrink-0 relative group"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (selectedTable.image_url) setPreviewImage(selectedTable.image_url);
                                }}
                            >
                                {selectedTable.image_url ? (
                                    <>
                                        <img src={selectedTable.image_url} className="w-full h-full object-cover" alt={selectedTable.table_name} />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                            <Maximize2 size={16} className="text-white opacity-0 group-hover:opacity-100" />
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[oklch(55%_0.010_28)]">
                                        <ImageIcon size={20} />
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-[15px] text-[oklch(18%_0.012_28)] truncate pr-2">
                                            {selectedTable.table_name}
                                        </h3>
                                        <p className="font-mono text-[11px] text-[oklch(55%_0.010_28)]">
                                            {selectedTable.capacity} {t('seats')} ({selectedTable.zone || 'Indoor'})
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => selectTable(null)} 
                                        className="text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] p-1"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                                <button 
                                    onClick={nextStep} 
                                    className="w-full mt-2 bg-[oklch(18%_0.012_28)] hover:opacity-90 text-[oklch(97%_0.008_28)] py-2 px-3 rounded-lg font-mono text-[11px] font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
                                >
                                    <span>[ {t('select')} // CONFIRM TABLE ➔ ]</span>
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );

    return (
        <div className="h-full flex flex-col relative">
            {/* Top Controls Overlay */}
            <div className="mb-3 flex justify-between items-start gap-3 select-none">
                <div className="bg-[oklch(97%_0.008_28)] p-3 sm:p-4 border border-[oklch(85%_0.012_28)] shadow-sm rounded-xl flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base sm:text-lg font-bold text-[oklch(18%_0.012_28)] leading-tight">
                            {t('selectTable')}
                        </h2>
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] text-[oklch(55%_0.010_28)] uppercase rounded">
                            FLOORPLAN
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 mt-2 text-xs text-[oklch(42%_0.010_28)] font-mono font-bold whitespace-nowrap overflow-x-auto pb-0.5">
                        <span className="bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] px-2 py-0.5 rounded">{date}</span>
                        <span className="bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] px-2 py-0.5 rounded">{time}</span>
                        <span className="bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-2 py-0.5 rounded">{pax} {t('guests')}</span>
                    </div>

                    {/* Status Legend */}
                    <div className="flex items-center gap-4 sm:gap-6 mt-3 pt-2.5 border-t border-[oklch(85%_0.012_28)]">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[oklch(55%_0.010_28)]">
                            <span className="w-2.5 h-2.5 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-sm" />
                            <span>{t('available')}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[oklch(55%_0.010_28)]">
                            <span className="w-2.5 h-2.5 bg-[oklch(18%_0.012_28)] rounded-sm" />
                            <span>{t('selected')}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[oklch(55%_0.010_28)]">
                            <span className="w-2.5 h-2.5 bg-[oklch(45%_0.18_28)] rounded-sm" />
                            <span>{t('unavailable')}</span>
                        </div>
                    </div>
                </div>

                {/* Fullscreen Expand Button */}
                <button 
                    onClick={toggleExpanded} 
                    title="Fullscreen Floorplan"
                    className="p-3 bg-[oklch(97%_0.008_28)] hover:bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] shadow-sm rounded-xl transition-all cursor-pointer flex-shrink-0 flex flex-col items-center gap-1 font-mono text-[9px] font-bold"
                >
                    <Maximize2 size={18} />
                    <span>FULL</span>
                </button>
            </div>

            {/* Standard In-card Floorplan View */}
            <div className="flex-1 min-h-[420px] overflow-hidden relative rounded-xl border border-[oklch(85%_0.012_28)] shadow-inner">
                {renderFloorplanCanvas(false)}
            </div>

            {/* FULLSCREEN PORTAL MODAL (Escapes CSS transform containers cleanly) */}
            {isExpanded && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[9999] bg-[oklch(18%_0.012_28)]/60 backdrop-blur-sm flex flex-col overflow-hidden animate-fadeIn">
                    {/* Fullscreen Top Header Bar */}
                    <div className="w-full bg-[oklch(97%_0.008_28)] border-b border-[oklch(85%_0.012_28)] px-4 py-3 flex items-center justify-between shadow-md select-none z-50">
                        <div className="flex items-center gap-3">
                            <h2 className="font-bold text-base text-[oklch(18%_0.012_28)]">
                                {t('selectTable')}
                            </h2>
                            <div className="hidden sm:flex items-center gap-2 font-mono text-xs text-[oklch(42%_0.010_28)]">
                                <span className="bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] px-2 py-0.5 rounded">{date}</span>
                                <span className="bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] px-2 py-0.5 rounded">{time}</span>
                                <span className="bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-2 py-0.5 rounded">{pax} {t('guests')}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="hidden md:inline font-mono text-[10px] text-[oklch(55%_0.010_28)]">
                                [ กด ESC หรือปุ่ม CLOSE เพื่อย่อกลับ ]
                            </span>
                            <button
                                onClick={toggleExpanded}
                                className="px-3.5 py-1.5 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] hover:opacity-90 font-mono text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow cursor-pointer"
                            >
                                <Minimize2 size={14} />
                                <span>CLOSE [ ✕ ]</span>
                            </button>
                        </div>
                    </div>

                    {/* Fullscreen Canvas Viewport */}
                    <div className="flex-1 w-full h-full relative overflow-hidden">
                        {renderFloorplanCanvas(true)}
                    </div>
                </div>,
                document.body
            )}

            {/* Tooltip Popup */}
            {availabilityTooltip && (
                <div
                    className="fixed z-[10000] bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] font-mono text-xs px-3 py-1.5 rounded-lg shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full mt-[-8px]"
                    style={{ left: availabilityTooltip.x, top: availabilityTooltip.y }}
                >
                    {availabilityTooltip.text}
                    <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-[oklch(18%_0.012_28)] rotate-45"></div>
                </div>
            )}

            {/* Lightbox Zoom for Table Image */}
            <AnimatePresence>
                {previewImage && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[10001] bg-black/90 flex items-center justify-center p-4 cursor-pointer"
                        onClick={() => setPreviewImage(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center"
                            onClick={e => e.stopPropagation()}
                        >
                            <button onClick={() => setPreviewImage(null)} className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-md z-10">
                                <X size={24} />
                            </button>
                            <img src={previewImage} className="w-full h-full object-contain rounded-lg" alt="Table Preview" />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
