import { createContext, useContext, useReducer, useEffect, useMemo } from 'react'
import { bookingReducer, initialState } from './bookingReducer'
import { supabase } from '../lib/supabaseClient'
import { toThaiISO } from '../utils/timeUtils'

const BookingContext = createContext()

export function BookingProvider({ children }) {
    const [state, dispatch] = useReducer(bookingReducer, initialState)

    const [isLiffReady, setIsLiffReady] = useState(false)

    // Initial Data Load
    useEffect(() => {
        // LIFF Init
        const initLiff = async () => {
            try {
                if (window.liff) {
                    await window.liff.init({ liffId: "2008674756-hTEWodVj" })
                    setIsLiffReady(true)
                }
            } catch (e) {
                console.error("LIFF Init Error:", e)
            }
        }
        initLiff()

        const loadData = async () => {
            try {
                // 1. FAST LOAD (Critical for UI)
                const [
                    { data: tables },
                    { data: settingsData },
                    { data: { user } },
                    { data: blockedDates } // New
                ] = await Promise.all([
                    supabase.from('tables_layout').select('*'),
                    supabase.from('app_settings').select('*'),
                    supabase.auth.getUser(),
                    supabase.from('blocked_dates').select('blocked_date, reason') // New
                ])

                // Parse Settings
                const settings = initialState.settings
                if (settingsData) {
                    const map = settingsData.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {})
                    if (map.floorplan_url) settings.floorplanUrl = `${map.floorplan_url}?t=${Date.now()}`
                    if (map.payment_qr_url) settings.qrCodeUrl = `${map.payment_qr_url}?t=${Date.now()}`
                    if (map.policy_dine_in) settings.policyNote = map.policy_dine_in
                    if (map.booking_min_spend) settings.minSpend = parseInt(map.booking_min_spend)
                    if (map.booking_min_advance_hours) settings.minAdvanceHours = Number(map.booking_min_advance_hours)
                    if (map.booking_min_advance_hours) settings.minAdvanceHours = Number(map.booking_min_advance_hours)
                    if (map.booking_time_slots) settings.bookingTimeSlots = map.booking_time_slots.split(',').map(s => s.trim())
                    if (map.alert_sound_url) settings.soundAlertUrl = `${map.alert_sound_url}?t=${Date.now()}`
                }

                // User Profile
                let userProfile = null
                if (user) {
                    const { data: profile } = await supabase.from('profiles').select('phone_number').eq('id', user.id).single()
                    userProfile = {
                        name: user.user_metadata.full_name || '',
                        phone: profile?.phone_number || ''
                    }
                }

                // UNBLOCK UI NOW
                dispatch({
                    type: 'LOAD_INITIAL_SUCCESS',
                    payload: {
                        tables: tables || [],
                        blockedDates: blockedDates || [],
                        settings,
                        user: userProfile
                    }
                })

                // 2. BACKGROUND LOAD (Heavy Menu Data)
                // Fetch menu items and categories asynchronously
                const [
                    { data: menuRaw },
                    { data: categories }
                ] = await Promise.all([
                    supabase.from('menu_items').select('*, menu_item_options(*, option_groups(*, option_choices(*)))').order('category'),
                    supabase.from('menu_categories').select('*').order('display_order')
                ])

                // SMART SORT: 1. Category Order, 2. Available First, 3. Name
                const categoryOrder = (categories || []).reduce((acc, cat, idx) => {
                    acc[cat.name] = cat.display_order ?? idx
                    return acc
                }, {})

                const sortedMenu = (menuRaw || []).sort((a, b) => {
                    // 1. Recommended (Top Priority)
                    if (a.is_recommended !== b.is_recommended) return (b.is_recommended ? 1 : 0) - (a.is_recommended ? 1 : 0)

                    // 2. Availability (True first)
                    if (a.is_available !== b.is_available) return (b.is_available ? 1 : 0) - (a.is_available ? 1 : 0)

                    // 3. Category Order
                    const orderA = categoryOrder[a.category] ?? 999
                    const orderB = categoryOrder[b.category] ?? 999
                    if (orderA !== orderB) return orderA - orderB

                    // 4. Name
                    return a.name.localeCompare(b.name)
                })

                dispatch({
                    type: 'LOAD_MENU_SUCCESS',
                    payload: {
                        menuItems: sortedMenu,
                        categories: categories || []
                    }
                })

            } catch (error) {
                console.error("Failed to load booking data", error)
            }
        }

        loadData()
    }, [])



    const loginWithLine = async () => {
        if (!window.liff) return
        try {
             if (!window.liff.isLoggedIn()) {
                window.liff.login() 
            } else {
                const profile = await window.liff.getProfile()
                const idToken = window.liff.getIDToken()
                dispatch({ type: 'SET_LINE_PROFILE', payload: { profile, idToken } })
                return { profile, idToken }
            }
        } catch (e) {
            console.error("LIFF Login Error", e)
        }
    }

    const logoutLine = () => {
        if (window.liff && window.liff.isLoggedIn()) {
            window.liff.logout()
        }
        dispatch({ type: 'LOGOUT_LINE' })
    }

    const contextValue = useMemo(() => ({ 
        state, 
        dispatch,
        loginWithLine,
        logoutLine,
        isLiffReady
    }), [state, isLiffReady])

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
