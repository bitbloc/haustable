import { createContext, useContext, useReducer, useEffect, useMemo } from 'react'
import { bookingReducer, initialState } from './bookingReducer'
import { supabase } from '../lib/supabaseClient'
import { toThaiISO } from '../utils/timeUtils'

const BookingContext = createContext()

export function BookingProvider({ children }) {
    const [state, dispatch] = useReducer(bookingReducer, initialState)

    // Initial Data Load
    useEffect(() => {
        const loadData = async () => {
            try {
                // 1. Parallel Fetch
                const [
                    { data: tables },
                    { data: settingsData },
                    { data: menuRaw },
                    { data: categories },
                    { data: { user } }
                ] = await Promise.all([
                    supabase.from('tables_layout').select('*'),
                    supabase.from('app_settings').select('*'),
                    supabase.from('menu_items').select('*, menu_item_options(*, option_groups(*, option_choices(*)))').eq('is_available', true).order('category'),
                    supabase.from('menu_categories').select('*').order('display_order'),
                    supabase.auth.getUser()
                ])

                // 2. Parse Settings
                const settings = initialState.settings
                if (settingsData) {
                    const map = settingsData.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {})
                    if (map.floorplan_url) settings.floorplanUrl = `${map.floorplan_url}?t=${Date.now()}`
                    if (map.payment_qr_url) settings.qrCodeUrl = `${map.payment_qr_url}?t=${Date.now()}`
                    if (map.policy_dine_in) settings.policyNote = map.policy_dine_in
                    if (map.booking_min_spend) settings.minSpend = parseInt(map.booking_min_spend)
                    if (map.booking_min_advance_hours) settings.minAdvanceHours = Number(map.booking_min_advance_hours)
                    if (map.booking_time_slots) settings.bookingTimeSlots = map.booking_time_slots.split(',').map(s => s.trim())
                }

                // 3. User Profile
                let userProfile = null
                if (user) {
                    const { data: profile } = await supabase.from('profiles').select('phone_number').eq('id', user.id).single()
                    userProfile = {
                        name: user.user_metadata.full_name || '',
                        phone: profile?.phone_number || ''
                    }
                }

                dispatch({
                    type: 'LOAD_DATA_SUCCESS',
                    payload: {
                        tables: tables || [],
                        menuItems: menuRaw || [],
                        categories: categories || [],
                        settings,
                        user: userProfile
                    }
                })

            } catch (error) {
                console.error("Failed to load booking data", error)
            }
        }

        loadData()
    }, [])

    // Performance Optimization: Memoize Context Value
    const contextValue = useMemo(() => ({ state, dispatch }), [state])

    return (
        <BookingContext.Provider value={contextValue}>
            {children}
        </BookingContext.Provider>
    )
}

// Custom Hook to consume Context
export function useBookingContext() {
    const context = useContext(BookingContext)
    if (!context) {
        throw new Error('useBookingContext must be used within a BookingProvider')
    }
    return context
}
