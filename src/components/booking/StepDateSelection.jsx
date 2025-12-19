import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Calendar } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import { useBooking } from '../../hooks/useBooking'
import BookingHeader from './BookingHeader'
import CustomCalendar from './CustomCalendar'

export default function StepDateSelection() {
    const { t } = useLanguage()
    const {
        date, setDate,
        time, setTime,
        pax, setPax,
        settings,
        nextStep,
        blockedDates // New
    } = useBooking()

    const [showLargeGroupModal, setShowLargeGroupModal] = useState(false)

    // Format Date Display (DD/MM/YYYY)
    const formatDateDisplay = (isoDate) => {
        if (!isoDate) return ''
        const [y, m, d] = isoDate.split('-')
        return `${d}/${m}/${y}`
    }

    const handleDateChange = (e) => {
        const val = e.target.value
        if (!val) {
            setDate('')
            return
        }

        // Check blocked
        const isBlocked = (blockedDates || []).some(b => b.blocked_date === val)
        if (isBlocked) {
            alert(t('dateUnavailable'))
            setDate('') // Auto Clear
            return
        }
        setDate(val)
    }

    return (
        <div className="h-full flex flex-col">
            <BookingHeader title={t('reservation')} subtitle={t('stepDate')} />

            <div className="space-y-6 flex-1 overflow-y-auto px-1 py-1">
                {/* Custom Calendar */}
                <div className="animate-fade-in-up">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-4 px-2">{t('date')}</label>
                    <CustomCalendar
                        value={date}
                        onChange={(newDate) => {
                            setDate(newDate)
                            // Auto scroll to time if needed, or visual cue
                        }}
                        blockedDates={blockedDates}
                    />
                </div>

                {/* Time */}
                <div className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition-opacity duration-300 ${!date ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex justify-between items-center mb-4">
                        <label className="text-xs font-bold text-gray-400 uppercase">{t('timeSlot')}</label>
                        {!date && <span className="text-xs text-red-400 font-bold">{t('selectDateFirst')}</span>}
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                        {settings.bookingTimeSlots.map(tm => {
                            let isDisabled = false
                            if (date) {
                                const now = new Date()
                                const [hours, minutes] = tm.split(':').map(Number)
                                const [year, month, day] = date.split('-').map(Number)
                                const slotDate = new Date(year, month - 1, day, hours, minutes)
                                const minTime = new Date(now.getTime() + (settings.minAdvanceHours * 60 * 60 * 1000))
                                if (slotDate < minTime) isDisabled = true
                            }

                            return (
                                <button
                                    key={tm}
                                    onClick={() => !isDisabled && setTime(tm)}
                                    disabled={isDisabled}
                                    className={`py-2 rounded-lg text-sm font-bold transition-all active:scale-95 ${time === tm ? 'bg-black text-white' : (isDisabled ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-gray-50 text-gray-500 hover:bg-gray-100')} `}
                                >
                                    {tm}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Pax */}
                <div className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition-opacity duration-300 ${!time ? 'opacity-50 pointer-events-none' : ''}`}>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-4">{t('guests')}</label>
                    <div className="flex items-center gap-4">
                        <button onClick={() => setPax(Math.max(1, pax - 1))} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold hover:bg-gray-200 active:scale-90 transition-transform">-</button>
                        <span className="text-2xl font-bold w-10 text-center">{pax}</span>
                        <button
                            onClick={() => {
                                if (pax >= 10) setShowLargeGroupModal(true)
                                else setPax(pax + 1)
                            }}
                            className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold hover:bg-gray-800 active:scale-90 transition-transform"
                        >
                            +
                        </button>
                    </div>
                </div>
            </div>

            {/* Large Group Modal */}
            <AnimatePresence>
                {showLargeGroupModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
                        onClick={() => setShowLargeGroupModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                            className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center space-y-4"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-2">
                                <span className="text-2xl">👨‍👩‍👧‍👦</span>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">{t('largeGroupTitle')}</h3>
                            <p className="text-gray-500 text-sm">
                                {t('largeGroupDesc')}
                            </p>
                            <div className="flex flex-col gap-2 pt-2">
                                <a href="tel:0961424663" className="bg-black text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors">
                                    📞 {t('call')} 096-142-4663
                                </a>
                                <a href="https://facebook.com" target="_blank" rel="noreferrer" className="bg-[#1877F2] text-white py-3 rounded-xl font-bold hover:bg-[#166fe5] transition-colors">
                                    FB: ร้านในบ้าน นตรพนม
                                </a>
                            </div>
                            <button onClick={() => setShowLargeGroupModal(false)} className="text-gray-400 text-xs hover:text-black mt-2">{t('close')}</button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <button onClick={nextStep} disabled={!date || !time} className="w-full bg-black text-white py-4 rounded-xl font-bold mt-8 shadow-lg disabled:opacity-20 transition-all flex justify-center items-center gap-2 active:scale-95">
                {t('selectTable')} <ArrowRight size={18} />
            </button>
        </div>
    )
}
