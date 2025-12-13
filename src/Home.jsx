import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { supabase } from './lib/supabaseClient'
import { ArrowRight, Clock } from 'lucide-react'
import { useLanguage } from './context/LanguageContext'
import KineticText from './components/KineticText'

export default function Home() {
    const { t } = useLanguage()
    const [status, setStatus] = useState({ isOpen: false, text: 'LOADING' })
    const [settings, setSettings] = useState(null)
    const [user, setUser] = useState(null) // New

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
        const load = async () => {
            // ... (settings load)
            const { data } = await supabase.from('app_settings').select('*')
            if (data) {
                const map = data.reduce((acc, i) => ({ ...acc, [i.key]: i.value }), {})
                setSettings(map)
                setStatus(checkShopStatus(map))
            }

            // Check User
            const { data: { session } } = await supabase.auth.getSession()
            setUser(session?.user || null)
        }
        load()
        const interval = setInterval(() => { if (settings) setStatus(checkShopStatus(settings)) }, 60000)

        // Auth Listener
        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user || null)
        })

        return () => {
            clearInterval(interval)
            authListener.subscription.unsubscribe()
        }
    }, [])

    useEffect(() => { if (settings) setStatus(checkShopStatus(settings)) }, [settings])

    const handleLogin = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        })
        if (error) alert('Login error: ' + error.message)
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        setUser(null)
    }

    return (
        <div className="min-h-[90vh] flex flex-col items-center justify-center p-6 text-center bg-[#F4F4F4] text-[#111] relative">

            {/* Top Right Login / Profile */}
            <div className="absolute top-4 right-4 z-50">
                {user ? (
                    <div className="flex items-center gap-3 bg-white pl-4 pr-2 py-2 rounded-full shadow-sm border border-gray-200">
                        <span className="text-xs font-bold truncate max-w-[100px]">{user.user_metadata.full_name || 'User'}</span>
                        <Link to="/admin" className="bg-gray-100 hover:bg-gray-200 text-black px-3 py-1.5 rounded-full text-xs font-bold transition-colors">
                            Admin
                        </Link>
                        <button onClick={handleLogout} className="bg-black text-white px-3 py-1.5 rounded-full text-xs font-bold hover:scale-105 transition-transform">
                            L
                        </button>
                    </div>
                ) : (
                    <button onClick={handleLogin} className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-200 hover:scale-105 transition-transform font-bold text-xs text-black">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                        Login
                    </button>
                )}
            </div>

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
                        <Link to="/booking" className="group bg-[#1A1A1A] text-[#DFFF00] py-4 rounded-full font-bold text-lg hover:scale-105 transition-all flex justify-center items-center gap-3">
                            {t('bookTable')}
                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <Link to="/pickup" className="group border border-[#1A1A1A] text-[#1A1A1A] py-4 rounded-full font-bold text-lg hover:bg-[#1A1A1A] hover:text-[#DFFF00] transition-all flex justify-center items-center gap-3">
                            {t('orderPickup')}
                        </Link>
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
