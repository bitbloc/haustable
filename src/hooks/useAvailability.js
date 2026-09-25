import { supabase } from '../lib/supabaseClient'
import { checkOverlap, isBookingOverlap } from '../utils/availabilityUtils'

export function useAvailability() {
    
    // Fetches overlap for a specific day
    const fetchOccupiedTables = async (dateStr, timeStr, durationHours = 2) => {
        if (!dateStr || !timeStr) return { ids: [], statuses: {} }

        try {
            const requestedStart = new Date(`${dateStr}T${timeStr}`) // ISO-ish
            const requestedEnd = new Date(requestedStart.getTime() + (durationHours * 60 * 60 * 1000))

            const dayStart = `${dateStr}T00:00:00+07:00`
            const dayEnd = `${dateStr}T23:59:59+07:00`

            const { data, error } = await supabase
                .from('bookings')
                .select('table_id, booking_time, end_time, booking_type, status')
                .in('status', ['pending', 'confirmed', 'seated', 'ready', 'approved', 'paid'])
                .gte('booking_time', dayStart)
                .lte('booking_time', dayEnd)

            if (error) throw error

            const bookedIds = []
            const statuses = {}
            const now = new Date()

            data.forEach(b => {
                if (isBookingOverlap(requestedStart, requestedEnd, b, { now, defaultDurationHours: durationHours, liveBufferMinutes: 30 })) {
                    bookedIds.push(b.table_id)
                    statuses[b.table_id] = { type: b.booking_type }
                }
            })

            return { ids: bookedIds, statuses }

        } catch (error) {
            console.error("Error fetching availability:", error)
            return { ids: [], statuses: {}, error }
        }
    }

    return {
        checkOverlap, // Export for unit testing pure logic
        fetchOccupiedTables
    }
}
