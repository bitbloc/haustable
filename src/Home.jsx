import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { supabase } from './lib/supabaseClient'
import { ArrowRight, Clock, User } from 'lucide-react' // Added User
import { useLanguage } from './context/LanguageContext'
import KineticText from './components/KineticText'
import AuthModal from './components/AuthModal' // Added Import

export default function Home() {
    const { t } = useLanguage()
    const [status, setStatus] = useState({ isOpen: false, text: 'LOADING' })
    const [settings, setSettings] = useState(null)
    const [user, setUser] = useState(null)
    const [userRole, setUserRole] = useState(null) // NEW: Dedicated state for role
    const [showAuthModal, setShowAuthModal] = useState(false)

    // Check Status Logic
    const checkShopStatus = (s) => {
        if (!s) return { isOpen: false, text: '...' }
        if (s.shop_mode === 'manual_open') return { isOpen: true, text: 'OPEN' }
        if (s.shop_mode === 'manual_close') return { isOpen: false, text: 'CLOSED' }
        const now = new Date()
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
        const isOpen = currentTime >= s.opening_time && currentTime < s.closing_time
        return { isOpen, text: isOpen ? 'OPEN' : 'CLOSED' }
    }

    useEffect(() => {
        // 1. Safety Timeout (Ensures "LOADING" never stays forever)
        const safetyTimer = setTimeout(() => {
            setStatus(prev => prev.text === 'LOADING' ? { isOpen: true, text: 'OPEN' } : prev)
        }, 3000)

        // 2. Fetch Settings (Independent)
        const fetchSettings = async () => {
            try {
                const { data, error } = await supabase.from('app_settings').select('*')
                if (error) {
                    // Silently fail or log, will fallback to safety timer or defaults
                    console.error("Settings Error:", error)
                    return
                }
                if (data) {
                    const map = data.reduce((acc, i) => ({ ...acc, [i.key]: i.value }), {})
                    setSettings(map)
                    setStatus(checkShopStatus(map))
                }
            } catch (err) {
                console.error("Settings Load Exception:", err)
            }
        }

        // 3. Fetch User & Role (Independent)
        const fetchUser = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (session?.user) {
                    setUser(session.user)
                    // Fetch Role
                    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
                    if (profile) setUserRole(profile.role)
                } else {
                    setUser(null)
                    setUserRole(null)
                }
            } catch (err) {
                console.error("User Load Exception:", err)
            }
        }

        fetchSettings()
        fetchUser()

        const interval = setInterval(() => { if (settings) setStatus(checkShopStatus(settings)) }, 60000)

        // Auth Listener
        const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setUser(session?.user || null)
            if (session?.user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
                if (profile) setUserRole(profile.role)
            } else {
                setUserRole(null)
            }
        })

        return () => {
            clearTimeout(safetyTimer)
            clearInterval(interval)
            authListener.subscription.unsubscribe()
        }
    }, [])

    useEffect(() => { if (settings) setStatus(checkShopStatus(settings)) }, [settings])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        setUser(null)
        setUserRole(null)
    }

    return (
        <div className="min-h-[90vh] flex flex-col items-center justify-center p-6 text-center bg-[#F4F4F4] text-[#111] relative">

            {/* Top Right Login / Profile */}
            <div className="absolute top-4 right-4 z-50">
                {user ? (
                    <div className="flex items-center gap-3 bg-white pl-4 pr-2 py-2 rounded-full shadow-sm border border-gray-200">
                        <span className="text-xs font-bold truncate max-w-[100px] text-black">{user.user_metadata.full_name || 'User'}</span>
                        {userRole === 'admin' ? (
                            <Link to="/admin" className="bg-black text-white px-3 py-1.5 rounded-full text-xs font-bold hover:scale-105 transition-transform shadow-lg">
                                Admin
                            </Link>
                        ) : (
                            <span className="bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full text-xs font-bold">
                                Member
                            </span>
                        )}
                        <button onClick={handleLogout} className="bg-gray-100 text-black px-3 py-1.5 rounded-full text-xs font-bold hover:bg-black hover:text-white transition-colors">
                            L
                        </button>
                    </div>
                ) : (
                    <button onClick={() => setShowAuthModal(true)} className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-200 hover:scale-105 transition-transform font-bold text-xs text-black">
                        <User size={16} />
                        Login / Register
                    </button>
                )}
            </div>

            <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

            {/* 1. Kinetic Branding */}
            <div className="mb-8 mt-12 w-full max-w-5xl mx-auto text-[#1A1A1A] flex flex-col items-center">
                {/* Main Title - HAUS TABLE */}
                <KineticText
                    text={(t('headline') || "HAUS TABLE").toUpperCase()}
                    baseWeight={200}
                    baseWidth={100}
                    className="text-6xl md:text-9xl font-black tracking-tighter mix-blend-difference text-center leading-[0.85]"
                />
                {/* Secondary Title - TABLE / ORDER */}
                <KineticText
                    text="TABLE / ORDER"
                    baseWeight={200}
                    baseWidth={85} // Reduced width to match HAUS TABLE length
                    className="text-6xl md:text-9xl font-black tracking-tighter mix-blend-difference text-center leading-[0.85]"
                />
            </div>

            {/* 2. Kinetic Status Indicator */}
            <div className="mb-8 w-full flex flex-col items-center">
                <div className="relative p-2 md:p-8">
                    {/* Status Text (OPEN/CLOSED) */}
                    <KineticText
                        text={status.text}
                        baseWeight={600}
                        baseWidth={75}
                        highlight={status.isOpen}
                        className={`text-6xl md:text-8xl ${status.isOpen ? 'text-[#DFFF00]' : 'text-[#DC2626]'} transition-colors duration-500`}
                    />
                </div>
            </div>

            {/* 3. Announcement Card (Replaces old description) */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.5, type: "spring", stiffness: 100 }}
                className="mb-12 w-full max-w-md px-4"
            >
                <div className="bg-white/90 backdrop-blur-xl rounded-full pl-5 pr-5 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/20 text-left flex items-center gap-4 hover:scale-[1.02] transition-transform duration-300">
                    {/* Flat Line Icon (Haus/Home) */}
                    <div className="shrink-0 text-[#1A1A1A]">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                    </div>

                    {/* Content: HDL | Marquee */}
                    <div className="flex-1 flex items-center overflow-hidden min-w-0 gap-3 border-l border-gray-300 pl-4 h-5">
                        {/* Headline (Static) */}
                        <span className="font-bold text-[#1A1A1A] text-sm whitespace-nowrap shrink-0">
                            {settings?.announcement_headline || "BY ร้านในบ้าน"}
                        </span>

                        {/* Detail (Marquee) */}
                        <div className="relative overflow-hidden w-full h-full flex items-center mask-gradient-right">
                            <motion.div
                                className="whitespace-nowrap text-gray-500 text-sm flex gap-8 absolute"
                                animate={{ x: ["0%", "-50%"] }}
                                transition={{
                                    repeat: Infinity,
                                    duration: 15,
                                    ease: "linear",
                                    repeatType: "loop"
                                }}
                            >
                                <span>{settings?.announcement_detail || "ระบบจองโต๊ะและมารับอาหารที่ร้าน IN THE HAUS"}</span>
                                <span>{settings?.announcement_detail || "ระบบจองโต๊ะและมารับอาหารที่ร้าน IN THE HAUS"}</span>
                            </motion.div>
                        </div>
                    </div>
                </div>

                {/* Time Info - Moved below card */}
                {settings && settings.shop_mode === 'auto' && (
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="font-mono text-xs text-gray-400 mt-6 tracking-widest text-center uppercase"
                    >
                        {status.isOpen ? `${t('openUntil')} ${settings.closing_time}` : `${t('opensAt')} ${settings.opening_time}`}
                    </motion.p>
                )}
            </motion.div>

            {/* 3. Actions */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="flex flex-col w-full max-w-xs gap-4"
            >
                {status.isOpen ? (
                    <>
                        {!user ? (
                            <div className="flex flex-col gap-4 animate-fade-in">
                                <div className="text-red-500 font-bold bg-white/80 backdrop-blur px-4 py-2 rounded-xl border border-red-200 text-sm shadow-lg">
                                    ⚠️ กรุณา Log-in ก่อนสั่งอาหารหรือจองโต๊ะ
                                </div>
                                <div className="opacity-40 pointer-events-none grayscale flex flex-col gap-4">
                                    <Link to="#" className="group bg-[#1A1A1A] text-[#DFFF00] py-4 rounded-full font-bold text-lg flex justify-center items-center gap-3">
                                        {t('bookTable')}
                                        <ArrowRight size={20} />
                                    </Link>
                                    <Link to="#" className="group border border-[#1A1A1A] text-[#1A1A1A] py-4 rounded-full font-bold text-lg flex justify-center items-center gap-3">
                                        {t('orderPickup')}
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <>
                                <Link to="/booking" className="group bg-[#1A1A1A] text-[#DFFF00] py-4 rounded-full font-bold text-lg hover:scale-105 transition-all flex justify-center items-center gap-3 shadow-xl shadow-black/10">
                                    {t('bookTable')}
                                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                </Link>
                                <Link to="/pickup" className="group border border-[#1A1A1A] text-[#1A1A1A] py-4 rounded-full font-bold text-lg hover:bg-[#1A1A1A] hover:text-[#DFFF00] transition-all flex justify-center items-center gap-3 shadow-lg">
                                    {t('orderPickup')}
                                </Link>
                            </>
                        )}
                    </>
                ) : (
                    <div className="bg-gray-200 text-gray-400 py-4 rounded-full font-mono text-sm flex justify-center items-center gap-2 cursor-not-allowed border border-gray-300">
                        <Clock size={16} /> {t('shopClosed')}
                    </div>
                )}
            </motion.div>

        </div>
    )
}
