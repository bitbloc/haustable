import { motion } from 'framer-motion'
import { useHausHome } from './hooks/useHausHome'
import CasualLayout from './components/layout/CasualLayout'
import HomeHeader from './components/home/HomeHeader'
import HomeActions from './components/home/HomeActions'
import UserProfileBadge from './components/home/UserProfileBadge'
import AuthModal from './components/AuthModal'

export default function Home({ session }) {
    // 1. Logic
    const { 
        t, status, settings, userRole, 
        showAuthModal, setShowAuthModal, handleLogout, 
        checkServiceStatus 
    } = useHausHome(session)

    return (
        <CasualLayout backgroundImage={settings?.home_background_url}>
            {/* 1. Top Bar (Profile) */}
            <div className="absolute top-6 right-6 z-50">
               <UserProfileBadge 
                    session={session} 
                    userRole={userRole} 
                    handleLogout={handleLogout} 
                    setShowAuthModal={setShowAuthModal} 
               />
            </div>

            <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

            {/* 2. Header Section */}
            <HomeHeader t={t} status={status} />

            {/* 3. Announcement (Design: Glass Card) */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="w-full max-w-md bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-4 mb-8 overflow-hidden flex items-center gap-4 hover:bg-white/10 transition-colors"
            >
                 {/* Flat Line Icon */}
                 <div className="shrink-0 text-white/80">
                      <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain opacity-80" />
                 </div>

                 {/* Content */}
                 <div className="flex-1 flex items-center overflow-hidden min-w-0 gap-3 border-l border-white/20 pl-4 h-6">
                        {/* Headline */}
                        <span className="font-bold text-white/90 text-sm whitespace-nowrap shrink-0">
                            {settings?.announcement_headline || "BY ร้านในบ้าน"}
                        </span>
                        
                        {/* Marquee */}
                        <div className="relative overflow-hidden w-full h-full flex items-center mask-gradient-right">
                             <motion.div
                                className="whitespace-nowrap text-gray-300 text-sm flex gap-8 absolute"
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
            </motion.div>
            
            {/* Time Info */}
            {settings && (
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="font-mono text-xs text-white/40 mb-8 tracking-widest text-center uppercase"
                >
                    {status.isOpen ? `${t('openUntil')} ${settings.closing_time}` : `${t('opensAt')} ${settings.opening_time}`}
                </motion.p>
            )}

            {/* 4. Action Buttons (Grid Layout) */}
            <div className="grid grid-cols-1 w-full max-w-sm gap-4">
               <HomeActions 
                    settings={settings}
                    checkStatus={checkServiceStatus}
                    t={t}
                    user={session?.user}
                    setShowAuthModal={setShowAuthModal}
               />
            </div>

        </CasualLayout>
    )
}
