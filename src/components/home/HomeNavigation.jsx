import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, ClipboardList, LogOut, LayoutDashboard } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function HomeNavigation({ 
    session, 
    userRole, 
    history, 
    setShowAuthModal, 
    setIsHistoryOpen,
    handleLogout
}) {
    const { hasActiveOrder } = history || {}
    const [showProfileMenu, setShowProfileMenu] = useState(false)

    // Helper: Close menu when clicking outside (rudimentary, can be improved)
    // For now, we rely on the toggle behavior

    return (
        <>
            {/* Bottom Floating Bar */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 p-1.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl safe-area-bottom">
                
                {/* 1. Login / Profile Button */}
                <div className="relative">
                    {session ? (
                        <button 
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                            className="flex items-center gap-2 pl-1 pr-3 py-1 bg-white/10 hover:bg-white/20 rounded-full transition-colors border border-white/5"
                        >
                            <img 
                                src={session.user.user_metadata.avatar_url || 'https://placehold.co/100'} 
                                alt="Profile" 
                                className="w-8 h-8 rounded-full border border-white/30"
                            />
                            <span className="text-xs font-bold text-white max-w-[80px] truncate">
                                {session.user.user_metadata.full_name?.split(' ')[0] || 'User'}
                            </span>
                        </button>
                    ) : (
                        <button 
                            onClick={() => setShowAuthModal(true)}
                            className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors border border-white/5"
                        >
                            <User size={18} className="text-white/90" />
                        </button>
                    )}

                    {/* Profile Menu Popup (Upwards) */}
                    <AnimatePresence>
                        {showProfileMenu && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                className="absolute bottom-full left-0 mb-3 w-48 bg-[#1A1A1A] border border-white/10 rounded-2xl shadow-xl overflow-hidden p-1 flex flex-col gap-1"
                            >
                                {(userRole === 'admin' || userRole === 'staff') && (
                                    <Link to="/staff" className="flex items-center gap-3 px-3 py-2 text-sm text-white/80 hover:bg-white/10 rounded-xl transition-colors">
                                        <LayoutDashboard size={16} />
                                        <span>Staff Dashboard</span>
                                    </Link>
                                )}
                                <button 
                                    onClick={handleLogout}
                                    className="flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-xl w-full text-left transition-colors"
                                >
                                    <LogOut size={16} />
                                    <span>Sign Out</span>
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Separator */}
                <div className="w-px h-6 bg-white/10 mx-1" />

                {/* 2. My Orders Button (Only if logged in) */}
                {session ? (
                     <button 
                        onClick={() => setIsHistoryOpen(true)}
                        className="relative w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors border border-white/5"
                    >
                        <ClipboardList size={20} className={hasActiveOrder ? "text-[#DFFF00]" : "text-white/60"} />
                        
                        {/* Notification Dot */}
                        {hasActiveOrder && (
                            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border border-black" />
                        )}
                    </button>
                ) : (
                    <div className="w-10 h-10 flex items-center justify-center opacity-30 cursor-not-allowed">
                        <ClipboardList size={20} className="text-white" />
                    </div>
                )}

            </div>
        </>
    )
}
