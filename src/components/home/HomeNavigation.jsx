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
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 p-1.5 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-[var(--color-hallmark-rule)] rounded-full shadow-lg safe-area-bottom">
                
                {/* 1. Login / Profile Button */}
                <div className="relative">
                    {session ? (
                        <button 
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                            className="flex items-center gap-2 pl-1 pr-3 py-1 bg-[var(--color-hallmark-paper-dark)] hover:bg-white rounded-full transition-colors border border-[var(--color-hallmark-rule)] cursor-pointer text-[var(--color-hallmark-ink)]"
                        >
                            <img 
                                src={session.user.user_metadata.avatar_url || 'https://placehold.co/100'} 
                                alt="Profile" 
                                className="w-8 h-8 rounded-full border border-[var(--color-hallmark-rule)]"
                            />
                            <span className="font-mono text-[10px] font-bold max-w-[80px] truncate">
                                {session.user.user_metadata.full_name?.split(' ')[0] || 'User'}
                            </span>
                        </button>
                    ) : (
                        <button 
                            onClick={() => setShowAuthModal(true)}
                            className="w-10 h-10 flex items-center justify-center bg-[var(--color-hallmark-paper-dark)] hover:bg-white rounded-full transition-colors border border-[var(--color-hallmark-rule)] cursor-pointer text-[var(--color-hallmark-ink)]"
                        >
                            <User size={18} className="opacity-80" />
                        </button>
                    )}

                    {/* Profile Menu Popup (Upwards) */}
                    <AnimatePresence>
                        {showProfileMenu && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                className="absolute bottom-full left-0 mb-3 w-48 bg-[var(--color-hallmark-paper)] border border-[var(--color-hallmark-rule)] rounded-2xl shadow-xl overflow-hidden p-1.5 flex flex-col gap-1 z-50 text-[var(--color-hallmark-ink)]"
                            >
                                {(userRole === 'admin' || userRole === 'staff') && (
                                    <Link to="/staff" className="flex items-center gap-3 px-3 py-2 text-xs font-mono font-bold hover:bg-[var(--color-hallmark-paper-dark)] rounded-xl transition-colors">
                                        <LayoutDashboard size={14} />
                                        <span>STAFF DASHBOARD</span>
                                    </Link>
                                )}
                                <button 
                                    onClick={handleLogout}
                                    className="flex items-center gap-3 px-3 py-2 text-xs font-mono font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl w-full text-left transition-colors cursor-pointer"
                                >
                                    <LogOut size={14} />
                                    <span>SIGN OUT</span>
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Separator */}
                <div className="w-px h-6 bg-[var(--color-hallmark-rule)] mx-1" />

                {/* 2. My Orders Button (Only if logged in) */}
                {session ? (
                     <button 
                        onClick={() => setIsHistoryOpen(true)}
                        className="relative w-10 h-10 flex items-center justify-center bg-[var(--color-hallmark-paper-dark)] hover:bg-white rounded-full transition-colors border border-[var(--color-hallmark-rule)] cursor-pointer text-[var(--color-hallmark-ink)]"
                    >
                        <ClipboardList size={20} className={hasActiveOrder ? "text-[var(--color-brand)]" : "opacity-80"} />
                        
                        {/* Notification Dot */}
                        {hasActiveOrder && (
                            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border border-[var(--color-hallmark-paper)]" />
                        )}
                    </button>
                ) : (
                    <div className="w-10 h-10 flex items-center justify-center opacity-30 cursor-not-allowed text-[var(--color-hallmark-ink)]">
                        <ClipboardList size={20} />
                    </div>
                )}

            </div>
        </>
    )
}
