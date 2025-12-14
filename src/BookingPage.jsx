import React from 'react'
import { BookingProvider } from './context/BookingContext'
import BookingSteps from './components/booking/BookingSteps'
import { motion } from 'framer-motion'
// PageTransition logic if needed, but BookingSteps handles internal animation.
// App.jsx wraps routes in PageTransition?

export default function BookingPage() {
    return (
        <BookingProvider>
            <BookingSteps />
        </BookingProvider>
    )
}
