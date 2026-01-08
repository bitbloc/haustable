import React, { useState } from 'react'
import { Calendar, Users, Clock, MapPin } from 'lucide-react'
import { motion } from 'framer-motion'
import CustomCalendar from '../booking/CustomCalendar'

export default function StepDateSelector({ state, dispatch, onNext, isValid }) {
    const { date, time, pax, selectedTable } = state // selectedTable logic or just zone?

    // Hardcoded Time Slots (reuse from settings if available in context, requiring context access)
    // For now, let's assume we can pass settings or use default. 
    // Ideally useSteakBooking should provide settings.
    // Let's mock or use standard list.
    const timeSlots = ["11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00"]

    const zones = [
        { id: 'Any', label: 'Any Preference' },
        { id: 'Indoor', label: 'Indoor (Air Conditioned)' },
        { id: 'Outdoor', label: 'Outdoor (Garden View)' },
        { id: 'Private', label: 'Private Room' }
    ]

    const [tempZone, setTempZone] = useState('Any') // Temporary local state for zone if we don't have table logic yet

    return (
        <div className="space-y-6 flex-1 overflow-y-auto pb-20">
            {/* Date */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-4 text-xs font-bold text-gray-400 uppercase">
                    <Calendar size={14} /> Date
                </div>
                <CustomCalendar 
                    value={date} 
                    onChange={(d) => {
                        if (isValid(d)) dispatch({ type: 'SET_DATE_TIME', payload: { date: d, time: null } })
                        else alert('Steak Pre-order requires 1 day advance notice.')
                    }} 
                />
            </div>

            {/* Time */}
            <div className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition-opacity ${!date ? 'opacity-50 pointer-events-none' : ''}`}>
               <div className="flex items-center gap-2 mb-4 text-xs font-bold text-gray-400 uppercase">
                    <Clock size={14} /> Time
                </div>
                <div className="grid grid-cols-4 gap-3">
                    {timeSlots.map(t => (
                        <button
                            key={t}
                            onClick={() => dispatch({ type: 'SET_DATE_TIME', payload: { date, time: t } })}
                            className={`py-2 rounded-lg text-sm font-bold border transition-all ${time === t ? 'bg-black text-white border-black' : 'bg-transparent text-gray-600 border-gray-200 hover:border-black'}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* Pax */}
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-4 text-xs font-bold text-gray-400 uppercase">
                    <Users size={14} /> Party Size
                </div>
                <div className="flex items-center justify-between">
                    <button onClick={() => dispatch({ type: 'SET_PAX', payload: Math.max(1, pax - 1) })} className="w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center text-xl hover:bg-gray-50">-</button>
                    <span className="text-3xl font-light">{pax}</span>
                    <button onClick={() => dispatch({ type: 'SET_PAX', payload: pax + 1 })} className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center text-xl hover:bg-gray-800">+</button>
                </div>
            </div>

             {/* Zone Preference (Simplified Table Selection) */}
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-4 text-xs font-bold text-gray-400 uppercase">
                    <MapPin size={14} /> Seating Preference
                </div>
                <div className="space-y-2">
                    {zones.map(z => (
                        <button
                            key={z.id}
                            onClick={() => {
                                setTempZone(z.id)
                                // Mock selecting a table object for validaton 
                                dispatch({ type: 'SELECT_TABLE', payload: { id: z.id, table_name: z.label + ' Preference' } })
                            }}
                            className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex justify-between items-center ${tempZone === z.id ? 'border-black bg-gray-50' : 'border-gray-100 hover:border-gray-300'}`}
                        >
                            <span className="font-medium text-sm">{z.label}</span>
                            {tempZone === z.id && <div className="w-2 h-2 rounded-full bg-green-500" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* Next Button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur border-t border-gray-200">
                <div className="max-w-2xl mx-auto">
                    <button
                        onClick={onNext}
                        disabled={!date || !time || !tempZone}
                        className="w-full bg-[#1a1a1a] text-white py-4 rounded-full font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] transition-transform"
                    >
                        Continue to Steak Selection
                    </button>
                </div>
            </div>
        </div>
    )
}
