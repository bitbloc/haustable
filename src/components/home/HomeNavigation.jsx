import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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

    return (
        <>
            {/* Bottom Floating Bar - Brutalist Tabular */}
            <div className="fixed bottom-0 left-0 w-full z-50 flex border-t border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper)] text-[var(--color-hallmark-ink)] safe-area-bottom">
                
                {/* 1. Login / Profile Button */}
                <div className="relative flex-1 border-r border-[var(--color-hallmark-rule)]">
                    {session ? (
                        <button 
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                            className="w-full h-12 flex items-center justify-center bg-[var(--color-hallmark-paper)] hover:bg-[var(--color-hallmark-paper-dark)] transition-colors cursor-pointer"
                        >
                            <span className="font-mono text-[11px] font-bold uppercase truncate px-2">
                                [ {session.user.user_metadata.full_name?.split(' ')[0] || 'USER'} ]
                            </span>
                        </button>
                    ) : (
                        <button 
                            onClick={() => setShowAuthModal(true)}
                            className="w-full h-12 flex items-center justify-center bg-[var(--color-hallmark-paper)] hover:bg-[var(--color-hallmark-paper-dark)] transition-colors cursor-pointer"
                        >
                            <span className="font-mono text-[11px] font-bold uppercase">
                                [ SIGN IN ]
                            </span>
                        </button>
                    )}

                    {/* Profile Menu Popup (Upwards) */}
                    <AnimatePresence>
                        {showProfileMenu && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute bottom-full left-0 mb-2 w-48 bg-[var(--color-hallmark-paper)] border border-[var(--color-hallmark-rule)] rounded-none shadow-xl overflow-hidden flex flex-col z-50 text-[var(--color-hallmark-ink)]"
                            >
                                {(userRole === 'admin' || userRole === 'staff') && (
                                    <Link to="/staff" className="flex items-center justify-between px-3 py-3 text-[11px] font-mono font-bold hover:bg-[var(--color-hallmark-paper-dark)] border-b border-[var(--color-hallmark-rule)] transition-colors">
                                        <span>STAFF DASHBOARD</span>
                                        <span>[ + ]</span>
                                    </Link>
                                )}
                                <button 
                                    onClick={handleLogout}
                                    className="flex items-center justify-between px-3 py-3 text-[11px] font-mono font-bold text-white bg-[var(--color-accent-red)] hover:opacity-90 w-full text-left transition-colors cursor-pointer"
                                >
                                    <span>SIGN OUT</span>
                                    <span>[ x ]</span>
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* 2. My Orders Button */}
                <div className="flex-1">
                    {session ? (
                         <button 
                            onClick={() => setIsHistoryOpen(true)}
                            className="relative w-full h-12 flex items-center justify-center bg-[var(--color-hallmark-paper)] hover:bg-[var(--color-hallmark-paper-dark)] transition-colors cursor-pointer"
                        >
                            <span className={`font-mono text-[11px] font-bold uppercase ${hasActiveOrder ? 'text-[var(--color-brand)]' : ''}`}>
                                [ TICKETS ]
                            </span>
                            
                            {/* Notification Dot */}
                            {hasActiveOrder && (
                                <span className="absolute top-3 right-4 w-2 h-2 bg-[var(--color-accent-red)] animate-pulse" />
                            )}
                        </button>
                    ) : (
                        <div className="w-full h-12 flex items-center justify-center opacity-30 cursor-not-allowed bg-[var(--color-hallmark-paper)]">
                            <span className="font-mono text-[11px] font-bold uppercase">
                                [ TICKETS ]
                            </span>
                        </div>
                    )}
                </div>

            </div>
        </>
    )
}
