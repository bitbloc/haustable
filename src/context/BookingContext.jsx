import { createContext, useContext, useReducer, useEffect, useMemo, useState } from 'react'
import { bookingReducer, initialState } from './bookingReducer'
import { supabase } from '../lib/supabaseClient'
import { toThaiISO } from '../utils/timeUtils'
import { fetchAndSortMenu } from '../utils/menuHelper'
import { safeTimestampUrl } from '../utils/urlHelper'

const BookingContext = createContext()

export function BookingProvider({ children }) {
    const [state, dispatch] = useReducer(bookingReducer, initialState)

    const [isLiffReady, setIsLiffReady] = useState(false)

    // Initial Data Load & Realtime Sync
    useEffect(() => {
        let isMounted = true

        // LIFF Init with tracking prevention & storage access fallback
        const initLiff = async () => {
            try {
                if (window.liff) {
                    await window.liff.init({ liffId: "2008674756-hTEWodVj", withLoginOnExternalBrowser: false });
                    if (isMounted) setIsLiffReady(true);
                }
            } catch (e) {
                console.warn("LIFF Init warning (tracking/storage blocked):", e);
                if (isMounted) setIsLiffReady(false);
            }
        };
        initLiff();

        const loadData = async () => {
            try {
                // 1. FAST LOAD (Critical for UI)
                const [
                    { data: tables },
                    { data: settingsData },
                    { data: { user } },
                    { data: blockedDates }
                ] = await Promise.all([
                    supabase.from('tables_layout').select('*'),
                    supabase.from('app_settings').select('key, value').not('key', 'in', '("tax_signature_image")'),
                    supabase.auth.getUser(),
                    supabase.from('blocked_dates').select('blocked_date, reason')
                ])

                if (!isMounted) return

                // Parse Settings
                const settings = initialState.settings
                if (settingsData) {
                    const map = settingsData.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {})
                    if (map.floorplan_url) settings.floorplanUrl = safeTimestampUrl(map.floorplan_url)
                    if (map.payment_qr_url) settings.qrCodeUrl = safeTimestampUrl(map.payment_qr_url)
                    if (map.promptpay_id) settings.promptpayId = map.promptpay_id
                    if (map.promptpay_name) settings.promptpayName = map.promptpay_name
                    if (map.truewallet_phone) settings.trueWalletPhone = map.truewallet_phone
                    if (map.truewallet_account_name) settings.trueWalletName = map.truewallet_account_name
                    if (map.truewallet_qr_url) settings.trueWalletQrUrl = safeTimestampUrl(map.truewallet_qr_url)
                    if (map.easyslip_enabled_booking !== undefined) settings.easySlipEnabled = map.easyslip_enabled_booking !== 'false'
                    if (map.policy_dine_in) settings.policyNote = map.policy_dine_in
                    if (map.booking_min_spend) settings.minSpend = parseInt(map.booking_min_spend)
                    if (map.booking_min_advance_hours) settings.minAdvanceHours = Number(map.booking_min_advance_hours)
                    if (map.booking_time_slots) settings.bookingTimeSlots = map.booking_time_slots.split(',').map(s => s.trim())
                    if (map.alert_sound_url) settings.soundAlertUrl = safeTimestampUrl(map.alert_sound_url)
                    
                    // Side Dishes Config (JSON)
                    if (map.side_dish_config) {
                        try {
                           settings.sideDishes = JSON.parse(map.side_dish_config)
                        } catch (e) {
                            console.error("Failed to parse side_dish_config", e)
                            settings.sideDishes = []
                        }
                    }
                    if (map.side_dish_enabled) settings.sideDishEnabled = map.side_dish_enabled === 'true'
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

                await loadMenu(false)

            } catch (error) {
                console.error("Failed to load booking data", error)
            }
        }

        const loadMenu = async (force = false) => {
            try {
                if (force) {
                    const { invalidateMenuCache } = await import('../utils/menuHelper')
                    invalidateMenuCache()
                }
                const { menuItems: sortedMenu, categories } = await fetchAndSortMenu(force)
                if (isMounted) {
                    dispatch({
                        type: 'LOAD_MENU_SUCCESS',
                        payload: {
                            menuItems: sortedMenu || [],
                            categories: categories || []
                        }
                    })
                }
            } catch (err) {
                console.error("Failed to reload menu in BookingContext:", err)
            }
        }

        loadData()

        // Realtime Subscriptions
        let menuDebounceTimer = null
        const handleMenuChange = () => {
            if (menuDebounceTimer) clearTimeout(menuDebounceTimer)
            menuDebounceTimer = setTimeout(() => {
                if (isMounted) loadMenu(true)
            }, 300)
        }

        let dataDebounceTimer = null
        const handleDataChange = () => {
            if (dataDebounceTimer) clearTimeout(dataDebounceTimer)
            dataDebounceTimer = setTimeout(() => {
                if (isMounted) loadData()
            }, 350)
        }

        const channelId = `booking-context-live-${Math.random().toString(36).slice(2, 8)}`
        const channel = supabase.channel(channelId)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, handleMenuChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_categories' }, handleMenuChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_item_options' }, handleMenuChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'option_groups' }, handleMenuChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'option_choices' }, handleMenuChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tables_layout' }, handleDataChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_dates' }, handleDataChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, handleDataChange)
            .subscribe()

        const handleVisibilityOrFocus = () => {
            if (document.visibilityState === 'visible' && isMounted) {
                loadMenu(true)
            }
        }

        window.addEventListener('focus', handleVisibilityOrFocus)
        document.addEventListener('visibilitychange', handleVisibilityOrFocus)

        return () => {
            isMounted = false
            if (menuDebounceTimer) clearTimeout(menuDebounceTimer)
            if (dataDebounceTimer) clearTimeout(dataDebounceTimer)
            supabase.removeChannel(channel)
            window.removeEventListener('focus', handleVisibilityOrFocus)
            document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
        }
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
