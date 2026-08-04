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
                    <label className="block text-xs font-mono font-bold text-subInk uppercase mb-4 px-2">{t('date')}</label>
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
                <div className={`bg-paper p-6 border border-[var(--color-rule)] rounded-rams transition-opacity duration-300 ${!date ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex justify-between items-center mb-4">
                        <label className="text-xs font-mono font-bold text-subInk uppercase">{t('timeSlot')}</label>
                        {!date && <span className="text-xs font-mono text-error font-bold">{t('selectDateFirst')}</span>}
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
                                    className={`py-2 rounded-none font-mono text-sm font-bold transition-all border ${time === tm ? 'bg-ink text-paper border-ink' : (isDisabled ? 'bg-canvas text-subInk border-[var(--color-rule)] cursor-not-allowed' : 'bg-transparent text-ink border-[var(--color-rule)] hover:bg-paper')} `}
                                >
                                    {tm}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Pax */}
                <div className={`bg-paper p-6 border border-[var(--color-rule)] rounded-rams transition-opacity duration-300 ${!time ? 'opacity-50 pointer-events-none' : ''}`}>
                    <label className="block text-xs font-mono font-bold text-subInk uppercase mb-4">{t('guests')}</label>
                    <div className="flex items-center gap-4">
                        <button onClick={() => setPax(Math.max(1, pax - 1))} className="w-10 h-10 border border-[var(--color-rule)] bg-canvas flex items-center justify-center font-bold hover:bg-paper active:scale-95 transition-transform">-</button>
                        <span className="text-2xl font-mono font-bold w-10 text-center">{pax}</span>
                        <button
                            onClick={() => {
                                if (pax >= 10) setShowLargeGroupModal(true)
                                else setPax(pax + 1)
                            }}
                            className="w-10 h-10 border border-ink bg-ink text-paper flex items-center justify-center font-bold hover:bg-paper hover:text-ink active:scale-95 transition-colors"
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
                            className="bg-paper p-6 border border-[var(--color-rule)] max-w-sm w-full text-center space-y-4 rounded-rams"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="w-12 h-12 bg-canvas border border-[var(--color-rule)] flex items-center justify-center mx-auto mb-2 rounded-rams">
                                <span className="text-2xl">👨‍👩‍👧‍👦</span>
                            </div>
                            <h3 className="text-xl font-display font-bold text-ink">{t('largeGroupTitle')}</h3>
                            <p className="text-subInk text-sm font-mono">
                                {t('largeGroupDesc')}
                            </p>
                            <div className="flex flex-col gap-2 pt-2">
                                <a href="tel:0985284217" className="bg-ink text-paper py-2.5 rounded-none font-bold hover:bg-paper hover:text-ink border border-ink transition-colors flex items-center justify-center gap-1.5 text-sm font-mono uppercase">
                                    📞 {t('call')} 098-528-4217
                                </a>
                                <a href="https://www.facebook.com/inthehausth" target="_blank" rel="noreferrer" className="bg-[#1877F2] text-white py-2.5 rounded-none font-bold hover:bg-[#166fe5] border border-[#1877F2] transition-colors flex items-center justify-center gap-1.5 text-sm font-mono uppercase">
                                    FB: ร้านในบ้าน นครพนม
                                </a>
                            </div>
                            <button onClick={() => setShowLargeGroupModal(false)} className="text-subInk text-xs hover:text-ink mt-2 font-mono uppercase">{t('close')}</button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <button onClick={nextStep} disabled={!date || !time} className="w-full bg-ink text-paper border border-ink py-4 rounded-none font-mono font-bold mt-8 hover:bg-paper hover:text-ink disabled:bg-canvas disabled:border-[var(--color-rule)] disabled:text-subInk transition-colors flex justify-center items-center gap-2 uppercase tracking-widest">
                {t('selectTable')} <ArrowRight size={18} />
            </button>
        </div>
    )
}
