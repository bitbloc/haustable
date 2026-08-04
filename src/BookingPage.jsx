import React from 'react'
import { BookingProvider } from './context/BookingContext'
import BookingSteps from './components/booking/BookingSteps'
import { motion } from 'framer-motion'
import { useServiceGuard } from './hooks/useServiceGuard'
// PageTransition logic if needed, but BookingSteps handles internal animation.
// App.jsx wraps routes in PageTransition?

export default function BookingPage() {
    const isChecking = useServiceGuard('shop_mode_table')

    if (isChecking) {
        return (
            <div className="min-h-screen bg-canvas flex flex-col items-center justify-center text-ink font-mono text-xs uppercase tracking-widest gap-3 select-none">
                <div className="w-6 h-6 rounded-full border-2 border-zinc-300 border-t-zinc-800 animate-spin" />
                <span>CHECKING STATUS...</span>
            </div>
        )
    }

    return (
        <BookingSteps />
    )
}
