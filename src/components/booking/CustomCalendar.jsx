import React, { useState } from 'react'
import { addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, addDays, format, isSameMonth, isBefore, startOfDay } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import { bangkokNow } from '../../utils/bangkokTime'

const WEEKDAYS = {
    th: ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'],
    en: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
}
const LEGEND = {
    th: { selected: 'วันที่เลือก', available: 'จองได้', blocked: 'ปิดรับจอง', prev: 'เดือนก่อน', next: 'เดือนถัดไป' },
    en: { selected: 'Selected', available: 'Available', blocked: 'Closed', prev: 'Previous month', next: 'Next month' }
}

// 'YYYY-MM-DD' -> local Date at midnight (no UTC shift)
const parseDay = (s) => {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d)
}

/**
 * Month grid, always 6 weeks tall so switching months never moves the form below.
 * Full-bleed on phones so each day is at least 48px wide.
 */
export default function CustomCalendar({ value, onChange, blockedDates = [], isDateBlocked }) {
    const { lang } = useLanguage()
    const l = lang === 'th' ? 'th' : 'en'
    const todayStr = bangkokNow().dateStr
    const today = startOfDay(parseDay(todayStr))
    const [currentMonth, setCurrentMonth] = useState(() => (value ? parseDay(value) : today))

    const monthStart = startOfMonth(currentMonth)
    const gridStart = startOfWeek(monthStart)
    const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
    const blockedSet = new Set((blockedDates || []).map(b => b.blocked_date))
    const canGoBack = !isBefore(endOfMonth(subMonths(currentMonth, 1)), today)

    const monthLabel = currentMonth.toLocaleDateString(l === 'th' ? 'th-TH' : 'en-GB', { month: 'long', year: 'numeric' })

    return (
        <div className="-mx-6 sm:mx-0 bg-paper border-y sm:border border-[var(--color-rule)] sm:rounded-rams py-3 sm:px-3">
            <div className="flex justify-between items-center mb-2 px-1">
                <button
                    type="button"
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    disabled={!canGoBack}
                    aria-label={LEGEND[l].prev}
                    className="w-12 h-12 flex items-center justify-center rounded-rams hover:bg-canvas transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <ChevronLeft size={20} className="text-ink" />
                </button>
                <span className="text-lg font-bold text-ink leading-normal" aria-live="polite">{monthLabel}</span>
                <button
                    type="button"
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    aria-label={LEGEND[l].next}
                    className="w-12 h-12 flex items-center justify-center rounded-rams hover:bg-canvas transition-colors"
                >
                    <ChevronRight size={20} className="text-ink" />
                </button>
            </div>

            <div className="grid grid-cols-7" aria-hidden="true">
                {WEEKDAYS[l].map(day => (
                    <div key={day} className="text-center text-sm font-bold text-[var(--color-muted)] py-1 leading-normal">{day}</div>
                ))}
            </div>

            <div className="grid grid-cols-7" role="grid">
                {days.map((dayItem) => {
                    const dayStr = format(dayItem, 'yyyy-MM-dd')
                    const inMonth = isSameMonth(dayItem, monthStart)
                    if (!inMonth) return <div key={dayStr} className="h-12" aria-hidden="true" />

                    const isBlocked = blockedSet.has(dayStr) || Boolean(isDateBlocked && isDateBlocked(dayItem))
                    const isPast = dayStr < todayStr
                    const isSelected = value === dayStr
                    const isDisabled = isPast || isBlocked

                    let cls = 'relative h-12 w-full flex items-center justify-center text-base font-mono transition-colors duration-150 '
                    if (isSelected) cls += 'bg-ink text-paper font-bold '
                    else if (isBlocked) cls += 'text-subInk line-through cursor-not-allowed '
                    else if (isPast) cls += 'text-subInk opacity-50 cursor-not-allowed '
                    else cls += 'text-ink hover:bg-canvas cursor-pointer '

                    return (
                        <button
                            key={dayStr}
                            type="button"
                            disabled={isDisabled}
                            aria-pressed={isSelected}
                            aria-label={dayItem.toLocaleDateString(l === 'th' ? 'th-TH' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + (isBlocked ? ` (${LEGEND[l].blocked})` : '')}
                            onClick={() => !isDisabled && onChange(dayStr)}
                            className={cls}
                        >
                            {dayItem.getDate()}
                        </button>
                    )
                })}
            </div>

            <div className="flex items-center justify-center gap-4 mt-2 text-sm text-[var(--color-muted)] leading-normal">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-ink" aria-hidden="true" />{LEGEND[l].selected}</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 border border-[var(--color-rule)] bg-paper" aria-hidden="true" />{LEGEND[l].available}</span>
                <span className="flex items-center gap-1.5"><span className="font-mono line-through" aria-hidden="true">00</span>{LEGEND[l].blocked}</span>
            </div>
        </div>
    )
}
