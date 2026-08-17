import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useLanguage } from '../context/LanguageContext'
import { useBookingContext } from '../context/BookingContext'

export const useHausHome = (session) => {
    const { t } = useLanguage()
    const { isLiffReady } = useBookingContext() // removed state: bookingState as it wasn't used in Home directly other than context.
    
    // State
    const [status, setStatus] = useState({ isOpen: false, text: 'LOADING' })
    const [settings, setSettings] = useState(null)
    const [userRole, setUserRole] = useState(null)
    const [profile, setProfile] = useState(null)
    const [showAuthModal, setShowAuthModal] = useState(false)
    
    // Line Auth State
    const [isVerifyingLine, setIsVerifyingLine] = useState(false)
    const [lineVerifyError, setLineVerifyError] = useState(null)
    const hasVerified = useRef(false)

    // Helper: Check Service Status
    const checkServiceStatus = (s, modeKey) => {
        if (!s) return { isOpen: false, text: '...' }
        const mode = s[modeKey] || s['shop_mode'] || 'auto'
        
        if (mode === 'manual_open') return { isOpen: true, text: 'OPEN' }
        if (mode === 'manual_close') return { isOpen: false, text: 'CLOSED' }
        
        const now = new Date()
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
        const openTime = s.opening_time || '11:30'
        const closeTime = s.closing_time || '23:30'
        const isOpen = currentTime >= openTime && currentTime < closeTime
        return { isOpen, text: isOpen ? 'OPEN' : 'CLOSED' }
    }

    // Effect: Staff Auto-Redirect
    useEffect(() => {
        const isStaffAuth = localStorage.getItem('staff_auth') === 'true'
        const shouldSkip = sessionStorage.getItem('skip_staff_redirect') === 'true'
        
        if (isStaffAuth && !shouldSkip && userRole === 'admin') {
            window.location.href = '/staff'
        }
    }, [userRole])

    // Effect: Initial Load & Settings
    useEffect(() => {
        // 1. Safety Timeout
        const safetyTimer = setTimeout(() => {
            setStatus(prev => prev.text === 'LOADING' ? { isOpen: true, text: 'OPEN' } : prev)
        }, 3000)

        // 2. Fetch Settings
        const fetchSettings = async () => {
            try {
                const { data, error } = await supabase.from('app_settings').select('*')
                if (error) {
                    console.error("Settings Error:", error)
                    return
                }
                if (data) {
                    const map = data.reduce((acc, i) => ({ ...acc, [i.key]: i.value }), {})
                    setSettings(map)
                    setStatus(checkServiceStatus(map, 'shop_mode_table'))
                }
            } catch (err) {
                console.error("Settings Load Exception:", err)
            }
        }

        fetchSettings()

        const interval = setInterval(() => { 
            if (settings) setStatus(checkServiceStatus(settings, 'shop_mode_table')) 
        }, 60000)

        return () => {
            clearTimeout(safetyTimer)
            clearInterval(interval)
        }
    }, [])

    // Effect: Update Status when settings change
    useEffect(() => { 
        if (settings) setStatus(checkServiceStatus(settings, 'shop_mode_table')) 
    }, [settings])

    // Effect: Fetch Profile & Role + Realtime
    useEffect(() => {
        if (!session?.user) {
            setUserRole(null)
            setProfile(null)
            return
        }

        const fetchProfile = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single()
                
                if (data) {
                    setProfile(data)
                    setUserRole(data.role || 'customer')
                }
            } catch (err) {
                console.error("Error fetching home user profile:", err)
            }
        }

        fetchProfile()

        // Realtime subscription on user profile (for live xhaus_balance, tier, etc.)
        const profileSub = supabase
            .channel(`home_profile_${session.user.id}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'profiles', 
                filter: `id=eq.${session.user.id}` 
            }, (payload) => {
                if (payload.new) {
                    setProfile(payload.new)
                    if (payload.new.role) setUserRole(payload.new.role)
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(profileSub)
        }
    }, [session?.user?.id])

    // Effect: LINE Auth Guard
    useEffect(() => {
        if (session) {
            sessionStorage.removeItem('haus_verifying_ts')
        }

        if (window.location.hash && (window.location.hash.includes('access_token') || window.location.hash.includes('error'))) {
            return
        }

        const lastVerify = sessionStorage.getItem('haus_verifying_ts')
        const isRecent = lastVerify && (Date.now() - parseInt(lastVerify) < 15000)

        if (isLiffReady && window.liff?.isLoggedIn() && !session && !isVerifyingLine && !hasVerified.current && !isRecent) {
            hasVerified.current = true
            verifyLineUser()
        }
    }, [isLiffReady, session])

    const verifyLineUser = async () => {
        console.log("Blocking UI: Verifying Line User...")
        setIsVerifyingLine(true)
        
        const timer = setTimeout(() => {
            console.warn("Verification Timed Out")
            setLineVerifyError("Verification timed out. Please try again.")
            setIsVerifyingLine(false)
        }, 15000)

        try {
            const idToken = window.liff.getIDToken()
            if (!idToken) throw new Error("No ID Token")

            const { data, error } = await supabase.functions.invoke('manage-booking', {
                body: { action: 'check_user', idToken }
            })

            clearTimeout(timer)

            if (error) throw error

            if (data?.sessionLink) {
                console.log("User verified! Redirecting to session...")
                sessionStorage.setItem('haus_verifying_ts', Date.now().toString())
                window.location.href = data.sessionLink
            } else {
                console.warn("User needs registration/update.")
                setIsVerifyingLine(false)
                setShowAuthModal(true) 
            }
        } catch (err) {
            clearTimeout(timer)
            console.error("Line Verification Failed:", err)
            setLineVerifyError(err.message)
            setIsVerifyingLine(false)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        if (window.liff?.isLoggedIn()) {
            window.liff.logout()
        }
        window.location.reload()
    }

    return {
        t,
        status,
        settings,
        userRole,
        profile,
        showAuthModal,
        setShowAuthModal,
        handleLogout,
        checkServiceStatus
    }
}
