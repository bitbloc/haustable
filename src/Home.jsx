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

            {/* 1. Announcement Bar (Fixed Top) */}
            <div className="fixed top-0 left-0 w-full z-40 bg-black/30 backdrop-blur-md border-b border-white/5 h-10 flex items-center justify-center overflow-hidden">
                <div className="relative w-full max-w-3xl h-full flex items-center">
                     <motion.div
                        className="whitespace-nowrap text-white/80 text-xs font-bold tracking-widest flex gap-12 absolute"
                        animate={{ x: ["100%", "-100%"] }}
                        transition={{
                            repeat: Infinity,
                            duration: 20,
                            ease: "linear"
                        }}
                    >
                        <span>{settings?.announcement_headline} : {settings?.announcement_detail}</span>
                        <span>{settings?.announcement_headline} : {settings?.announcement_detail}</span>
                        <span>{settings?.announcement_headline} : {settings?.announcement_detail}</span>
                    </motion.div>
                </div>
            </div>

            {/* 2. Header Section */}
            <HomeHeader t={t} status={status} />

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
