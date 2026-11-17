import { createContext, useContext, useReducer, useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { bookingReducer, initialState } from './bookingReducer'
import { supabase } from '../lib/supabaseClient'
import { fetchAndSortMenu, invalidateMenuCache } from '../utils/menuHelper'
import { safeTimestampUrl } from '../utils/urlHelper'
import { BOOKING_SETTING_KEYS, fetchSettingsMap } from '../utils/publicSettings'
import { ensureLiff, liffNeededEarly } from '../utils/liffLoader'

const BookingContext = createContext()

const LOAD_ERROR_TH = 'โหลดข้อมูลการจองไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'

// Realtime tables per booking step. Other routes under this provider (home, member card,
// admin, staff) never ask for booking data, so they open no channel and fetch nothing.
const LIVE_TABLES = {
    date: ['blocked_dates'],
    table: ['tables_layout'],
    menu: ['menu_items', 'menu_categories', 'menu_item_options', 'option_groups', 'option_choices']
}

const parseSettings = (map) => {
    const settings = { ...initialState.settings }
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
    if (map.booking_deposit_required !== undefined) settings.bookingDepositRequired = map.booking_deposit_required === 'true'
    if (map.booking_hold_minutes) settings.bookingHoldMinutes = Number(map.booking_hold_minutes) || 30
    if (map.booking_time_slots) settings.bookingTimeSlots = map.booking_time_slots.split(',').map(s => s.trim())
    if (map.side_dish_config) {
        try {
            settings.sideDishes = JSON.parse(map.side_dish_config)
        } catch (e) {
            console.error('Failed to parse side_dish_config', e)
            settings.sideDishes = []
        }
    }
    if (map.side_dish_enabled) settings.sideDishEnabled = map.side_dish_enabled === 'true'
    if (map.closing_time) settings.closingTime = map.closing_time
    if (map.qr_kitchen_close_time) settings.kitchenCloseTime = map.qr_kitchen_close_time
    return settings
}

export function BookingProvider({ children }) {
    const [state, dispatch] = useReducer(bookingReducer, initialState)
    const [isLiffReady, setIsLiffReady] = useState(false)

    // Booking data is fetched only once a booking page asks for it (requestBookingData)
    const [wantsData, setWantsData] = useState(false)
    const [liveScope, setLiveScope] = useState(null) // 'date' | 'table' | 'menu' | null
    const [reloadKey, setReloadKey] = useState(0)
    const mountedRef = useRef(true)

    useEffect(() => {
        mountedRef.current = true
        return () => { mountedRef.current = false }
    }, [])

    // LIFF: /booking only needs it inside LINE or for a returning LINE user (login is optional);
    // the other routes here (home, member card, hausmade) use it right away.
    useEffect(() => {
        const onBooking = window.location.pathname.startsWith('/booking')
        if (onBooking && !liffNeededEarly()) return
        ensureLiff().then((liff) => { if (mountedRef.current) setIsLiffReady(Boolean(liff)) })
    }, [])

    const loadData = useCallback(async ({ silent = false } = {}) => {
        if (!silent) dispatch({ type: 'LOAD_INITIAL_START' })
        try {
            const [tablesRes, settingsMap, { data: { user } }, blockedRes] = await Promise.all([
                supabase.from('tables_layout').select('*'),
                fetchSettingsMap(BOOKING_SETTING_KEYS),
                supabase.auth.getUser(),
                supabase.from('blocked_dates').select('blocked_date, reason')
            ])
            if (tablesRes.error) throw tablesRes.error
            if (blockedRes.error) throw blockedRes.error
            if (!mountedRef.current) return

            let userProfile = null
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('phone_number').eq('id', user.id).single()
                userProfile = {
                    name: user.user_metadata.full_name || '',
                    phone: profile?.phone_number || ''
                }
            }

            dispatch({
                type: 'LOAD_INITIAL_SUCCESS',
                payload: {
                    tables: tablesRes.data || [],
                    blockedDates: blockedRes.data || [],
                    settings: parseSettings(settingsMap),
                    user: userProfile
                }
            })
        } catch (error) {
            console.error('Failed to load booking data', error)
            // A silent realtime refresh keeps the data already on screen
            if (mountedRef.current && !silent) dispatch({ type: 'LOAD_INITIAL_ERROR', payload: LOAD_ERROR_TH })
        }
    }, [])

    const loadMenu = useCallback(async (force = false) => {
        dispatch({ type: 'LOAD_MENU_START' })
        try {
            if (force) invalidateMenuCache()
            const { menuItems, categories } = await fetchAndSortMenu(force)
            if (mountedRef.current) {
                dispatch({ type: 'LOAD_MENU_SUCCESS', payload: { menuItems: menuItems || [], categories: categories || [] } })
            }
        } catch (err) {
            console.error('Failed to load menu in BookingContext:', err)
            if (mountedRef.current) dispatch({ type: 'LOAD_MENU_ERROR' })
        }
    }, [])

    // First load (and the retry button)
    useEffect(() => {
        if (wantsData) loadData()
    }, [wantsData, reloadKey, loadData])

    // Realtime: only the tables the open step shows
    useEffect(() => {
        if (!wantsData || !liveScope) return
        const tables = LIVE_TABLES[liveScope] || []
        if (tables.length === 0) return

        let timer = null
        const onChange = () => {
            if (timer) clearTimeout(timer)
            timer = setTimeout(() => {
                if (!mountedRef.current) return
                if (liveScope === 'menu') loadMenu(true)
                else loadData({ silent: true })
            }, 350)
        }

        let channel = supabase.channel(`booking-live-${liveScope}-${Math.random().toString(36).slice(2, 8)}`)
        tables.forEach((table) => {
            channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
        })
        channel.subscribe()

        return () => {
            if (timer) clearTimeout(timer)
            supabase.removeChannel(channel)
        }
    }, [wantsData, liveScope, loadData, loadMenu])

    // Menu refresh when the tab comes back, only while the menu is in use
    useEffect(() => {
        if (liveScope !== 'menu') return
        let timer = null
        const onVisible = () => {
            if (document.visibilityState !== 'visible') return
            if (timer) clearTimeout(timer)
            timer = setTimeout(() => { if (mountedRef.current) loadMenu(false) }, 500)
        }
        window.addEventListener('focus', onVisible)
        document.addEventListener('visibilitychange', onVisible)
        return () => {
            if (timer) clearTimeout(timer)
            window.removeEventListener('focus', onVisible)
            document.removeEventListener('visibilitychange', onVisible)
        }
    }, [liveScope, loadMenu])

    const requestBookingData = useCallback(() => setWantsData(true), [])
    const retryBookingData = useCallback(() => setReloadKey((k) => k + 1), [])
    const requestMenu = useCallback(() => {
        if (state.menuStatus === 'idle' || state.menuStatus === 'error') loadMenu(state.menuStatus === 'error')
    }, [state.menuStatus, loadMenu])

    const loginWithLine = useCallback(async () => {
        const liff = await ensureLiff()
        if (!liff) return
        setIsLiffReady(true)
        try {
            if (!liff.isLoggedIn()) {
                liff.login()
            } else {
                const profile = await liff.getProfile()
                const idToken = liff.getIDToken()
                dispatch({ type: 'SET_LINE_PROFILE', payload: { profile, idToken } })
                return { profile, idToken }
            }
        } catch (e) {
            console.error('LIFF Login Error', e)
        }
    }, [])

    const logoutLine = useCallback(() => {
        if (window.liff && window.liff.isLoggedIn()) {
            window.liff.logout()
        }
        dispatch({ type: 'LOGOUT_LINE' })
    }, [])

    const contextValue = useMemo(() => ({
        state,
        dispatch,
        loginWithLine,
        logoutLine,
        isLiffReady,
        requestBookingData,
        retryBookingData,
        requestMenu,
        setLiveScope
    }), [state, isLiffReady, loginWithLine, logoutLine, requestBookingData, retryBookingData, requestMenu])

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
