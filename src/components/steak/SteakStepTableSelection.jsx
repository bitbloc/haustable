import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import { Maximize, Minimize, ZoomIn, ZoomOut, RotateCw, X, Image } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

export default function SteakStepTableSelection({ 
    state, 
    dispatch, 
    onNext 
}) {
    const {
        date, time, pax,
        tables, bookedTableIds,
        selectedTable
    } = state

    // State for Settings
    const [floorplanUrl, setFloorplanUrl] = useState(null)

    // Fetch Settings (Floorplan)
    useEffect(() => {
        const fetchSettings = async () => {
            const { data, error } = await supabase
                .from('app_settings')
                .select('key, value')
                .eq('key', 'floorplan_url')
                .single()
            
            if (data && data.value) {
                setFloorplanUrl(data.value)
            }
        }
        fetchSettings()
    }, [])

    const [isExpanded, setIsExpanded] = useState(false)
    const [previewImage, setPreviewImage] = useState(null)
    const [availabilityTooltip, setAvailabilityTooltip] = useState(null)

    const toggleExpanded = () => setIsExpanded(!isExpanded)

    const selectTable = (table) => {
        dispatch({ type: 'SELECT_TABLE', payload: table })
    }

    const renderTable = (table) => {
        const isBooked = bookedTableIds.includes(table.id)
        const isSelected = selectedTable?.id === table.id
        const rotation = table.rotation || 0

        const baseStyle = {
            position: 'absolute',
            left: `${table.pos_x}%`,
            top: `${table.pos_y}%`,
            width: `${table.width}%`,
            height: `${table.height}%`,
            transform: `rotate(${rotation}deg)`
        }

        let bgColor = isBooked ? '#ef4444' : (isSelected ? '#000000' : (table.table_color || '#ffffff'))
        let textColor = (isBooked || isSelected || ['#333333', '#7F1D1D', '#14532D', '#1E3A8A', '#581C87'].includes(bgColor)) ? 'white' : 'black'
        let borderColor = isSelected ? 'white' : 'transparent'

        return (
            <button
                key={table.id}
                onClick={(e) => {
                    e.stopPropagation()
                    if (isBooked) {
                        setAvailabilityTooltip({ x: e.clientX, y: e.clientY, text: `Table Unavailable`, loading: false })
                        setTimeout(() => setAvailabilityTooltip(null), 2000)
                    } else {
                        selectTable(table)
                    }
                }}
                style={baseStyle}
                className={`transition-all duration-300 flex flex-col items-center justify-center shadow-md
                ${table.shape === 'circle' ? 'rounded-full' : 'rounded-lg'}
                ${isBooked ? 'opacity-50 cursor-not-allowed bg-gray-300 contrast-50' : 'hover:scale-105 active:scale-95 cursor-pointer'}
                ${isSelected ? 'z-20 ring-4 ring-black/20' : ''}
                `}
            >
                <div className={`absolute inset-0 w-full h-full ${table.shape === 'circle' ? 'rounded-full' : 'rounded-lg'} `} style={{ backgroundColor: bgColor, border: `2px solid ${borderColor} ` }} />
                <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-1" style={{ transform: `rotate(${-rotation}deg)` }}>
                    {isBooked ? (
                        <>
                            <span className="font-bold text-[8px] uppercase tracking-wider" style={{ color: textColor }}>FULL</span>
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
        <div className="h-full flex flex-col relative min-h-[500px] bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            {/* Top Controls Overlay */}
            <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-start pointer-events-none">
                <div className="bg-white/90 backdrop-blur-xl p-4 rounded-2xl shadow-lg border border-white/50 pointer-events-auto">
                    <h2 className="text-lg font-bold text-black leading-none">Select Table</h2>
                    <div className="flex items-center gap-2 mt-2 text-xs sm:text-sm text-gray-600 font-medium whitespace-nowrap">
                        <span className="bg-gray-100 px-2 py-1 rounded-md">{date ? new Date(date).toLocaleDateString() : 'Date'}</span>
                        <span className="bg-gray-100 px-2 py-1 rounded-md">{time || 'Time'}</span>
                        <span className="bg-black text-white px-2 py-1 rounded-md">{pax} Guests</span>
                    </div>
                </div>
                <button onClick={toggleExpanded} className="bg-white p-3 rounded-full shadow-lg text-black pointer-events-auto hover:bg-gray-50 transition-colors">
                    {isExpanded ? <Minimize size={20} /> : <Maximize size={20} />}
                </button>
            </div>

            {/* Tooltip */}
            {availabilityTooltip && (
                <div
                    className="fixed z-50 bg-black text-white text-xs px-3 py-1 rounded-full shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full mt-[-8px]"
                    style={{ left: availabilityTooltip.x, top: availabilityTooltip.y }}
                >
                    {availabilityTooltip.text}
                    <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-black rotate-45"></div>
                </div>
            )}

            {/* Lightbox */}
            <AnimatePresence>
                {previewImage && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
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
                            <img src={previewImage} className="w-full h-full object-contain rounded-lg shadow-2xl" alt="Table Preview" />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className={`flex-1 overflow-hidden relative transition-all duration-500 ${isExpanded ? 'fixed inset-0 z-50 bg-[#f0f0f0]' : 'bg-[#f0f0f0]'} `}>
                <TransformWrapper initialScale={0.9} minScale={0.2} maxScale={4} centerOnInit={true} limitToBounds={false}>
                    {({ zoomIn, zoomOut, resetTransform }) => (
                        <>
                            <div className="absolute bottom-24 right-4 z-20 flex flex-col gap-2 pointer-events-auto">
                                <button onClick={() => zoomIn()} className="bg-white p-2 rounded-lg shadow-sm hover:bg-gray-50 active:scale-90 transition-transform"><ZoomIn size={20} /></button>
                                <button onClick={() => zoomOut()} className="bg-white p-2 rounded-lg shadow-sm hover:bg-gray-50 active:scale-90 transition-transform"><ZoomOut size={20} /></button>
                                <button onClick={() => resetTransform()} className="bg-white p-2 rounded-lg shadow-sm hover:bg-gray-50 active:scale-90 transition-transform"><RotateCw size={20} /></button>
                            </div>
                            <TransformComponent wrapperClass="w-full h-full flex items-center justify-center bg-[#f0f0f0]" contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div
                                    className="relative w-[1000px] aspect-video bg-white shadow-2xl origin-center"
                                    style={{
                                        backgroundImage: floorplanUrl ? `url(${floorplanUrl})` : undefined,
                                        backgroundSize: '100% 100%',
                                        backgroundRepeat: 'no-repeat',
                                    }}
                                    onClick={() => selectTable(null)}
                                >
                                     {/* Grid Lines (Optional style) */}
                                     <div className="absolute inset-0 opacity-10 pointer-events-none" 
                                        style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '40px 40px' }}
                                     />
                                    
                                    {/* Tables */}
                                    {tables && tables.map(table => renderTable(table))}
                                    
                                    {!tables || tables.length === 0 && (
                                        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                                            Loading Map... or No Tables Found
                                        </div>
                                    )}
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
                            className="absolute bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white/50 z-30"
                        >
                            <div className="flex gap-4">
                                <div
                                    className="w-20 h-20 rounded-lg bg-gray-100 overflow-hidden cursor-zoom-in shrink-0 relative group"
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
                                    <p className="text-gray-500 text-xs mb-3">{selectedTable.capacity} Seats</p>
                                    <button onClick={onNext} className="w-full bg-black text-white py-2 rounded-lg font-bold text-xs shadow-md">
                                        Select this Table
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
