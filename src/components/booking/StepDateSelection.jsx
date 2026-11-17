import React, { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import { useBooking } from '../../hooks/useBooking'
import BookingHeader from './BookingHeader'
import CustomCalendar from './CustomCalendar'
import { getBookingSlotsForDate } from '../../utils/storeHours'
import { bangkokNow, toMinutes } from '../../utils/bangkokTime'

// Renders before the booking data arrives (defaults from the reducer), so the first paint
// is the real form, not a loader. "Next" waits for the data.
export default function StepDateSelection() {
    const { t } = useLanguage()
    const {
        date, setDate,
        time, setTime,
        pax, setPax,
        settings,
        nextStep,
        isLoading,
        blockedDates
    } = useBooking()

    const [showLargeGroupModal, setShowLargeGroupModal] = useState(false)
    const [dateNotice, setDateNotice] = useState('')
    const timeSlots = getBookingSlotsForDate(settings.bookingTimeSlots, date)

    // Blocked dates can arrive after a date was picked: clear it and say why, in place
    useEffect(() => {
        if (date && (blockedDates || []).some(b => b.blocked_date === date)) {
            setDate('')
            setDateNotice(t('dateUnavailable'))
        }
    }, [blockedDates, date, setDate, t])

    // Slot is too soon when it starts before now + minAdvanceHours (Bangkok clock)
    const now = bangkokNow()
    const isSlotTooSoon = (tm) => {
        if (!date) return false
        if (date > now.dateStr) return false
        if (date < now.dateStr) return true
        return toMinutes(tm) < now.minutes + (Number(settings.minAdvanceHours) || 0) * 60
    }

    const handleDateChange = (newDate) => {
        setDateNotice('')
        setDate(newDate)
        if (time && !getBookingSlotsForDate(settings.bookingTimeSlots, newDate).includes(time)) setTime('')
    }

    return (
        <div className="h-full flex flex-col">
            <BookingHeader title={t('reservation')} subtitle={t('stepDate')} />

            {/* Free booking note: does not wait for data (default settings say free) */}
            {!settings.bookingDepositRequired && (
                <div className="mb-4 px-4 py-3 bg-paper border border-[var(--color-rule)] rounded-rams text-sm leading-relaxed text-ink">
                    <span className="font-bold mr-1.5">จองฟรี ไม่มีค่าใช้จ่าย</span>
                    <span>
                        การจองฟรี<strong>ต้องได้รับการยืนยันจากทางร้านเสมอ</strong> หากยังไม่ได้รับการติดต่อ กรุณาโทร{' '}
                        <a href="tel:0985284217" className="font-mono font-bold underline whitespace-nowrap">098-528-4217</a>
                    </span>
                </div>
            )}

            <div className="space-y-6 flex-1 py-1">
                {/* Calendar */}
                <div>
                    <label className="block text-sm font-bold text-[var(--color-muted)] mb-3">{t('date')}</label>
                    <CustomCalendar value={date} onChange={handleDateChange} blockedDates={blockedDates} />
                    <p role="status" aria-live="polite" className={`text-sm font-bold text-error mt-2 leading-normal ${dateNotice ? '' : 'sr-only'}`}>
                        {dateNotice}
                    </p>
                </div>

                {/* Time */}
                <div aria-disabled={!date} className={`bg-paper p-4 sm:p-6 border border-[var(--color-rule)] rounded-rams ${!date ? 'pointer-events-none' : ''}`}>
                    <div className="flex justify-between items-center gap-2 mb-4">
                        <label className="text-sm font-bold text-[var(--color-muted)]">{t('timeSlot')}</label>
                        {!date && <span className="text-sm text-[var(--color-muted)]">{t('selectDateFirst')}</span>}
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                        {timeSlots.map(tm => {
                            const isDisabled = !date || isSlotTooSoon(tm)
                            const isSelected = time === tm
                            return (
                                <button
                                    key={tm}
                                    type="button"
                                    onClick={() => !isDisabled && setTime(tm)}
                                    disabled={isDisabled}
                                    aria-pressed={isSelected}
                                    className={`min-h-12 rounded-none font-mono text-base font-bold transition-colors duration-150 border ${isSelected
                                        ? 'bg-ink text-paper border-ink'
                                        : (isDisabled
                                            ? 'bg-canvas text-subInk border-[var(--color-rule)] cursor-not-allowed'
                                            : 'bg-transparent text-ink border-[var(--color-rule)] hover:bg-canvas')}`}
                                >
                                    {tm}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Pax */}
                <div aria-disabled={!time} className={`bg-paper p-4 sm:p-6 border border-[var(--color-rule)] rounded-rams ${!time ? 'pointer-events-none' : ''}`}>
                    <label className="block text-sm font-bold text-[var(--color-muted)] mb-4">{t('guests')}</label>
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            aria-label="ลดจำนวนลูกค้า"
                            onClick={() => setPax(Math.max(1, pax - 1))}
                            className="w-12 h-12 border border-[var(--color-rule)] bg-canvas flex items-center justify-center text-xl font-bold hover:bg-paper transition-colors"
                        >-</button>
                        <span className="text-2xl font-mono font-bold w-10 text-center" aria-live="polite">{pax}</span>
                        <button
                            type="button"
                            aria-label="เพิ่มจำนวนลูกค้า"
                            onClick={() => {
                                if (pax >= 10) setShowLargeGroupModal(true)
                                else setPax(pax + 1)
                            }}
                            className="w-12 h-12 border border-ink bg-ink text-paper flex items-center justify-center text-xl font-bold hover:bg-[var(--color-muted)] transition-colors"
                        >+</button>
                    </div>
                </div>
            </div>

            {/* Large Group sheet */}
            {showLargeGroupModal && (
                <div
                    className="sheet-fade fixed inset-0 z-50 bg-ink/60 flex items-center justify-center p-6"
                    onClick={() => setShowLargeGroupModal(false)}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="large-group-title"
                        className="bg-paper p-6 border border-[var(--color-rule)] max-w-sm w-full text-center space-y-4 rounded-rams"
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 id="large-group-title" className="text-xl font-display text-ink leading-normal">{t('largeGroupTitle')}</h3>
                        <p className="text-subInk text-base leading-relaxed">{t('largeGroupDesc')}</p>
                        <div className="flex flex-col gap-2 pt-2">
                            <a href="tel:0985284217" className="min-h-12 bg-ink text-paper rounded-none font-bold border border-ink flex items-center justify-center gap-1.5 text-base">
                                {t('call')} <span className="font-mono">098-528-4217</span>
                            </a>
                            <a href="https://www.facebook.com/inthehausth" target="_blank" rel="noreferrer" className="min-h-12 bg-[var(--brand-plum)] text-cream rounded-none font-bold flex items-center justify-center text-base">
                                Facebook: ร้านในบ้าน นครพนม
                            </a>
                        </div>
                        <button type="button" onClick={() => setShowLargeGroupModal(false)} className="min-h-12 w-full text-subInk text-base hover:text-ink">{t('close')}</button>
                    </div>
                </div>
            )}

            <button
                type="button"
                onClick={nextStep}
                disabled={!date || !time || isLoading}
                className="w-full min-h-14 bg-ink text-paper border border-ink py-4 rounded-none font-bold mt-8 hover:bg-[var(--color-muted)] disabled:bg-canvas disabled:border-[var(--color-rule)] disabled:text-subInk transition-colors flex justify-center items-center gap-2 text-base"
            >
                {isLoading && date && time ? 'กำลังโหลดข้อมูลโต๊ะ...' : t('nextChooseTable')} <ArrowRight size={18} />
            </button>
        </div>
    )
}
