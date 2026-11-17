import React, { useEffect } from 'react'
import BookingSteps from './components/booking/BookingSteps'
import RetryState from './components/shared/RetryState'
import { useServiceStatus } from './hooks/useServiceGuard'
import { useBooking } from './hooks/useBooking'

export default function BookingPage() {
    // The open/closed check and the booking data load run side by side; step 1 renders
    // straight away (no full-screen loader to swap out, which is what shifted the layout).
    // Only a manual close shuts booking; same-day slots past last order are disabled in step 1
    const { status, retry } = useServiceStatus('shop_mode_table', { cutoff: 'none' })
    const { requestBookingData } = useBooking()

    useEffect(() => {
        requestBookingData()
    }, [requestBookingData])

    if (status === 'error') {
        return <RetryState title="ตรวจสอบเวลาเปิดร้านไม่สำเร็จ" onRetry={retry} />
    }

    return <BookingSteps />
}
