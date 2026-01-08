import React, { useState } from 'react'
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    isBefore,
    startOfDay
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function CustomCalendar({ value, onChange, blockedDates = [], isDateBlocked }) {
    const [currentMonth, setCurrentMonth] = useState(new Date())

    const renderHeader = () => {
        return (
            <div className="flex justify-between items-center mb-4 px-2">
                <button
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    disabled={isBefore(endOfMonth(subMonths(currentMonth, 1)), startOfDay(new Date()))}
                >
                    <ChevronLeft size={20} className="text-gray-600" />
                </button>
                <span className="text-lg font-bold text-gray-900">
                    {format(currentMonth, 'MMMM yyyy')}
                </span>
                <button
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <ChevronRight size={20} className="text-gray-600" />
                </button>
            </div>
        )
    }

    const renderDays = () => {
        const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
        return (
            <div className="grid grid-cols-7 mb-2">
                {days.map(day => (
                    <div key={day} className="text-center text-xs font-bold text-gray-400 uppercase py-2">
                        {day}
                    </div>
                ))}
            </div>
        )
    }

    const renderCells = () => {
        const monthStart = startOfMonth(currentMonth)
        const monthEnd = endOfMonth(monthStart)
        const startDate = startOfWeek(monthStart)
        const endDate = endOfWeek(monthEnd)

        const dateFormat = "d"
        const rows = []
        let days = []
        let day = startDate
        let formattedDate = ""

        const today = startOfDay(new Date())

        // Generate all days for the grid
        const allDays = eachDayOfInterval({ start: startDate, end: endDate })

        return (
            <div className="grid grid-cols-7 gap-1">
                {allDays.map((dayItem, idx) => {
                    formattedDate = format(dayItem, dateFormat)

                    const isBlocked = (blockedDates.some(b => 
                        b.blocked_date === format(dayItem, 'yyyy-MM-dd')
                    )) || (isDateBlocked && isDateBlocked(dayItem))
                    
                    const isPast = isBefore(dayItem, today)
                    const isSelected = value ? isSameDay(dayItem, new Date(value)) : false
                    const isDisabled = isPast || (isBlocked && !isSelected) // Allow seeing selected even if blocked (edge case), but mainly block.

                    const isCurrentMonth = isSameMonth(dayItem, monthStart)

                    let cellClass = "relative h-10 w-10 flex items-center justify-center rounded-full text-sm font-medium transition-all duration-200 "

                    if (!isCurrentMonth) {
                        cellClass += "text-gray-300 "
                    } else if (isSelected) {
                        cellClass += "bg-black text-white shadow-md scale-105 "
                    } else if (isBlocked) {
                        cellClass += "bg-red-50 text-red-300 line-through cursor-not-allowed "
                    } else if (isPast) {
                        cellClass += "text-gray-300 cursor-not-allowed "
                    } else {
                        cellClass += "text-gray-700 hover:bg-gray-100 cursor-pointer hover:scale-110 "
                    }

                    return (
                        <div key={dayItem.toString()} className="flex justify-center">
                            <button
                                disabled={isDisabled || isBlocked} // Fully disable blocked
                                onClick={() => !isDisabled && !isBlocked && onChange(format(dayItem, 'yyyy-MM-dd'))}
                                className={cellClass}
                            >
                                {formattedDate}
                                {isBlocked && isCurrentMonth && (
                                    <div className="absolute -bottom-1 w-1 h-1 bg-red-400 rounded-full"></div>
                                )}
                            </button>
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <div className="bg-white p-4 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
            {renderHeader()}
            {renderDays()}
            {renderCells()}
            <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-gray-400">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-black"></div> Selected</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-gray-200"></div> Available</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-100"></div> Blocked</div>
            </div>
        </div>
    )
}
