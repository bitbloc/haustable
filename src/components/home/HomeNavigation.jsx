/* Hallmark · component: HomeNavigation · genre: modern-minimal · theme: dieter-rams-thai-modern
 * states: default · hover · active · notification-ping
 * contrast: pass (APCA / WCAG AAA compliant)
 */
import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'

export default function HomeNavigation({ 
    session, 
    userRole,
    profile,
    history, 
    setShowAuthModal, 
    setIsHistoryOpen,
    handleLogout
}) {
    const { hasActiveOrder } = history || {}
    const [showProfileMenu, setShowProfileMenu] = useState(false)
    const menuRef = useRef(null)

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowProfileMenu(false)
            }
        }
        if (showProfileMenu) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showProfileMenu])

    const displayName = profile?.nickname || profile?.display_name || session?.user?.user_metadata?.full_name?.split(' ')[0] || 'MEMBER'

    return (
        <>
            {/* Bottom Floating Bar - Brutalist Tabular 3-Cell */}
            <div className="fixed bottom-0 left-0 w-full z-50 flex border-t border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper)] text-[var(--color-hallmark-ink)] safe-area-bottom select-none">
                
                {/* 1. Login / Profile Button (Left Cell) */}
                <div ref={menuRef} className="relative flex-1 border-r border-[var(--color-hallmark-rule)]">
                    {session ? (
                        <button 
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                            className="w-full h-12 flex items-center justify-center bg-[var(--color-hallmark-paper)] hover:bg-[var(--color-hallmark-paper-dark)] transition-colors cursor-pointer px-2"
                        >
                            <span className="font-mono text-[11px] font-black uppercase truncate">
                                [ {displayName} ]
                            </span>
                        </button>
                    ) : (
                        <button 
                            onClick={() => setShowAuthModal(true)}
                            className="w-full h-12 flex items-center justify-center bg-[var(--color-hallmark-paper)] hover:bg-[var(--color-hallmark-paper-dark)] transition-colors cursor-pointer px-2"
                        >
                            <span className="font-mono text-[11px] font-black uppercase">
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
                                transition={{ duration: 0.15 }}
                                className="absolute bottom-full left-0 mb-2 w-52 bg-[var(--color-hallmark-paper)] border border-[var(--color-hallmark-rule)] rounded-none shadow-2xl overflow-hidden flex flex-col z-50 text-[var(--color-hallmark-ink)]"
                            >
                                <div className="p-3 bg-[var(--color-hallmark-paper-dark)] border-b border-[var(--color-hallmark-rule)]">
                                    <span className="font-mono text-[9px] text-[var(--color-hallmark-ink-muted)] block uppercase">SIGNED IN AS</span>
                                    <span className="font-bold text-[13px] text-[var(--color-hallmark-ink)] block truncate mt-0.5">
                                        {profile?.display_name || session?.user?.email || 'User'}
                                    </span>
                                    <span className="font-mono text-[10px] font-bold text-[var(--color-brand)] block mt-0.5">
                                        {Number(profile?.xhaus_balance || 0)} XHAUS
                                    </span>
                                </div>

                                <Link 
                                    to="/member-card" 
                                    onClick={() => setShowProfileMenu(false)}
                                    className="flex items-center justify-between px-3.5 py-3 text-[11px] font-mono font-bold hover:bg-[var(--color-hallmark-paper-dark)] border-b border-[var(--color-hallmark-rule)] transition-colors"
                                >
                                    <span>MEMBER CARD QR</span>
                                    <span>➔</span>
                                </Link>

                                {(userRole === 'admin' || userRole === 'staff') && (
                                    <Link 
                                        to="/staff" 
                                        onClick={() => setShowProfileMenu(false)}
                                        className="flex items-center justify-between px-3.5 py-3 text-[11px] font-mono font-bold hover:bg-[var(--color-hallmark-paper-dark)] border-b border-[var(--color-hallmark-rule)] transition-colors"
                                    >
                                        <span>STAFF DASHBOARD</span>
                                        <span>➔</span>
                                    </Link>
                                )}

                                <button 
                                    onClick={handleLogout}
                                    className="flex items-center justify-between px-3.5 py-3 text-[11px] font-mono font-bold text-white bg-[var(--color-accent-red)] hover:opacity-90 w-full text-left transition-opacity cursor-pointer"
                                >
                                    <span>SIGN OUT</span>
                                    <span>[ ✕ ]</span>
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* 2. My Tickets Button (Center Cell) */}
                <div className="flex-1 border-r border-[var(--color-hallmark-rule)]">
                    <button 
                        onClick={() => {
                            if (session) {
                                setIsHistoryOpen(true)
                            } else {
                                setShowAuthModal(true)
                            }
                        }}
                        className="relative w-full h-12 flex items-center justify-center bg-[var(--color-hallmark-paper)] hover:bg-[var(--color-hallmark-paper-dark)] transition-colors cursor-pointer px-2"
                    >
                        <span className={`font-mono text-[11px] font-black uppercase ${hasActiveOrder ? 'text-[var(--color-brand)]' : ''}`}>
                            [ TICKETS ]
                        </span>
                        
                        {/* Live active order ping dot */}
                        {hasActiveOrder && (
                            <span className="absolute top-3 right-4 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        )}
                    </button>
                </div>

                {/* 3. Digital Menu / Booklet Button (Right Cell) */}
                <div className="flex-1">
                    <Link 
                        to="/link"
                        className="w-full h-12 flex items-center justify-center bg-[var(--color-hallmark-paper)] hover:bg-[var(--color-hallmark-paper-dark)] transition-colors cursor-pointer px-2"
                    >
                        <span className="font-mono text-[11px] font-black uppercase">
                            [ MENU ]
                        </span>
                    </Link>
                </div>

            </div>
        </>
    )
}
