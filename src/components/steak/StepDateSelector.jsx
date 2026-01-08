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

    // Helper to block Sat/Sun in Calendar UI
    const isDateBlocked = (date) => {
        // Use the main validation logic, but we need to pass a string or ensure Date object handling matches
        // isDateValid expects a string or date that can be parsed. 
        // Let's pass the date object directly if isDateValid handles it, or formatted string.
        // Looking at useSteakBooking: isDateValid(dateStr) -> new Date(dateStr).
        // So passing Date object .toISOString() or similar is safest, or just the Date object if it handles it.
        // Actually, let's just replicate the specific "invalid" logic here or wrap isValid.
        // Since isValid is passed from hook, let's try to use it.
        // Note: isDateValid checks if content is VALID. So isBlocked = !isValid.
        return !isValid(date) 
    }

    return (
        <div className="space-y-6 flex-1 overflow-y-auto pb-20">
            {/* Date */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">
                        <Calendar size={14} /> Date
                    </div>
                </div>
                
                {/* Rules Text */}
                <div className="mb-4 text-xs text-red-500 bg-red-50 p-3 rounded-lg border border-red-100">
                    * จองล่วงหน้าก่อนหนึ่งวัน ตัดยอดและรายการจอง 18.00 น.
                    <br/>(Book 1 day in advance. Cutoff at 18:00)
                </div>

                <CustomCalendar 
                    value={date} 
                    onChange={(d) => {
                        if (isValid(d)) dispatch({ type: 'SET_DATE_TIME', payload: { date: d, time: null } })
                    }}
                    isDateBlocked={isDateBlocked}
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

            {/* Next Button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur border-t border-gray-200">
                <div className="max-w-2xl mx-auto">
                    <button
                        onClick={onNext}
                        disabled={!date || !time}
                        className="w-full bg-[#1a1a1a] text-white py-4 rounded-full font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] transition-transform"
                    >
                        Continue to Table Selection
                    </button>
                </div>
            </div>
        </div>
    )
}
