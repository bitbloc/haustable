import { useState, useEffect, useMemo, useCallback } from 'react'
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { LayoutDashboard, TrendingUp, Utensils, Settings, LogOut, Calendar, Tag, LayoutGrid, Menu, X, ArrowUpRight, Receipt, Lock, Shield, ShieldCheck, ShoppingBag, PanelLeftClose, PanelLeft } from 'lucide-react'
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { hasModuleAccess, hasRouteAccess, ADMIN_MODULES } from '../utils/rbacHelper'
import './AdminLayout.css'

export default function AdminLayout() {
    const [authStatus, setAuthStatus] = useState('loading')
    const [userProfile, setUserProfile] = useState(null)
    const [pendingCount, setPendingCount] = useState(0)
    const location = useLocation()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [isCollapsed, setIsCollapsed] = useState(() => {
        try {
            const saved = localStorage.getItem('onhaus_admin_sidebar_collapsed')
            if (saved !== null) return saved === 'true'
            if (typeof window !== 'undefined' && window.innerWidth < 1280) return true
            return false
        } catch {
            return false
        }
    })

    const toggleCollapse = useCallback(() => {
        setIsCollapsed(prev => {
            const next = !prev
            try {
                localStorage.setItem('onhaus_admin_sidebar_collapsed', String(next))
            } catch {}
            return next
        })
    }, [])

    // Auto-close mobile drawer when route changes
    useEffect(() => {
        setSidebarOpen(false)
    }, [location.pathname])

    // Keyboard shortcuts: Ctrl+B or Cmd+B to toggle desktop sidebar, ESC to close mobile drawer
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
                e.preventDefault()
                toggleCollapse()
            }
            if (e.key === 'Escape' && sidebarOpen) {
                setSidebarOpen(false)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [sidebarOpen, toggleCollapse])

    useEffect(() => {
        const checkUser = async () => {
            try {
                const { data: { user }, error } = await supabase.auth.getUser()
                if (error || !user) {
                    setAuthStatus('unauthenticated')
                    return
                }

                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('id, role, display_name, nickname, phone_number, admin_permissions')
                    .eq('id', user.id)
                    .single()

                const role = (profile?.role || '').toLowerCase()
                // Owner & Admin have full master access; other staff/custom roles also authorized
                const hasCustomPerms = Array.isArray(profile?.admin_permissions) && profile.admin_permissions.length > 0
                const isStaffOrAdmin = ['owner', 'admin', 'manager', 'staff', 'cashier', 'kitchen', 'custom'].includes(role) || hasCustomPerms

                if (profileError || !profile || !isStaffOrAdmin) {
                    console.warn("Backoffice Auth Blocked:", { profileError, profile, role, isStaffOrAdmin })
                    setAuthStatus('unauthorized')
                    return
                }

                setUserProfile(profile)
                setAuthStatus('authorized')
            } catch {
                setAuthStatus('unauthenticated')
            }
        }
        checkUser()
    }, [])

    // Real-time Pending Inbox Counter
    useEffect(() => {
        let isMounted = true;

        const updateCount = async () => {
            try {
                const { count, error } = await supabase
                    .from('bookings')
                    .select('id', { count: 'exact', head: true })
                    .eq('status', 'pending');

                if (isMounted && !error && typeof count === 'number') {
                    setPendingCount(count);
                }
            } catch (err) {
                console.error('Error fetching inbox counter:', err);
            }
        };

        updateCount();

        const channel = supabase
            .channel('admin-layout-inbox-counter')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, updateCount)
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
        };
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut()
        window.location.href = '/'
    }

    useEffect(() => {
        if (authStatus === 'unauthorized') {
            toast.error('Access Denied: Backoffice permission required.')
        }
    }, [authStatus])

    // Consolidated 8 Core Hubs with RBAC Module Keys
    const allMenuItems = useMemo(() => [
        { 
            key: 'overview',
            path: '/admin', 
            icon: LayoutDashboard, 
            label: 'Overview', 
            badge: pendingCount > 0 ? `${pendingCount}` : null,
            isActive: (pathname) => pathname === '/admin'
        },
        { 
            key: 'tables',
            path: '/admin/tables', 
            icon: LayoutGrid, 
            label: 'Floor & Tables',
            isActive: (pathname) => pathname.startsWith('/admin/tables') || pathname.startsWith('/admin/editor')
        },
        { 
            key: 'bookings',
            path: '/admin/bookings', 
            icon: Calendar, 
            label: 'Bookings & Orders',
            isActive: (pathname) => pathname.startsWith('/admin/bookings')
        },
        { 
            key: 'hausmade',
            path: '/admin/hausmade', 
            icon: ShoppingBag, 
            label: 'HAUSMADE Retail',
            isActive: (pathname) => pathname.startsWith('/admin/hausmade')
        },
        { 
            key: 'menu',
            path: '/admin/menu', 
            icon: Utensils, 
            label: 'Menu & Lab',
            isActive: (pathname) => pathname.startsWith('/admin/menu') || pathname.startsWith('/admin/costing') || pathname.startsWith('/admin/lab') || pathname.startsWith('/admin/sop')
        },
        { 
            key: 'financial',
            path: '/admin/financial', 
            icon: TrendingUp, 
            label: 'Financial & Insights',
            isActive: (pathname) => pathname === '/admin/financial'
        },
        { 
            key: 'tax',
            path: '/admin/tax', 
            icon: Receipt, 
            label: 'Tax & Invoices',
            isActive: (pathname) => pathname.startsWith('/admin/tax')
        },
        { 
            key: 'marketing',
            path: '/admin/marketing', 
            icon: Tag, 
            label: 'Marketing & Loyalty',
            isActive: (pathname) => pathname.startsWith('/admin/marketing') || pathname.startsWith('/admin/promotions') || pathname.startsWith('/admin/rewards') || pathname.startsWith('/admin/members') || pathname.startsWith('/admin/arcade') || pathname.startsWith('/admin/songs') || pathname.startsWith('/admin/stamps')
        },
        { 
            key: 'logs',
            path: '/admin/logs', 
            icon: ShieldCheck, 
            label: 'Staff Activity Logs',
            isActive: (pathname) => pathname.startsWith('/admin/logs')
        },
        { 
            key: 'settings',
            path: '/admin/settings', 
            icon: Settings, 
            label: 'Settings',
            isActive: (pathname) => pathname.startsWith('/admin/settings')
        },
    ], [pendingCount])

    const menuItems = useMemo(() => {
        return allMenuItems.map(item => ({
            ...item,
            isAllowed: hasModuleAccess(userProfile, item.key)
        }))
    }, [allMenuItems, userProfile])

    const isCurrentRouteAllowed = useMemo(() => {
        return hasRouteAccess(userProfile, location.pathname)
    }, [userProfile, location.pathname])

    const firstAllowedPath = useMemo(() => {
        const first = menuItems.find(m => m.isAllowed)
        return first ? first.path : '/admin/bookings'
    }, [menuItems])

    const userRoleDisplay = useMemo(() => {
        const role = (userProfile?.role || 'staff').toUpperCase()
        if (role === 'ADMIN' || role === 'OWNER') return 'OWNER / ADMIN'
        if (role === 'CUSTOM') return 'CUSTOM STAFF'
        return role
    }, [userProfile])

    const currentSectionLabel = useMemo(() => {
        const matched = menuItems.find(m => m.isActive(location.pathname))
        return matched ? matched.label : 'Overview'
    }, [menuItems, location.pathname])

    if (authStatus === 'loading') {
        return (
            <div className="min-h-screen bg-[oklch(96%_0.006_90)] text-[oklch(18%_0.008_90)] flex flex-col items-center justify-center font-mono text-xs gap-3">
                <div className="w-6 h-6 rounded-full border-2 border-[oklch(82%_0.006_90)] border-t-[oklch(18%_0.008_90)] animate-spin" />
                <span>INITIALIZING ONHAUS SYSTEM...</span>
            </div>
        )
    }

    if (authStatus === 'unauthenticated') return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
    if (authStatus === 'unauthorized') return <Navigate to="/" replace />

    return (
        <div className="admin-system min-h-screen bg-canvas text-ink flex flex-col lg:flex-row relative">
            {/* --- Mobile / Tablet Top Bar (Sticky, Tactile - Below 1024px) --- */}
            <nav className="lg:hidden sticky top-0 z-40 bg-paper border-b border-[var(--ram-rule)] px-4 py-2.5 flex items-center justify-between admin-mobile-nav">
                <div className="flex items-center gap-2.5">
                    <button 
                        type="button"
                        onClick={() => setSidebarOpen(true)} 
                        className="p-1.5 text-ink hover:bg-[oklch(92%_0.010_28)] rounded-xs transition-colors border border-[var(--ram-rule)] cursor-pointer"
                        aria-label="Open Navigation Menu"
                    >
                        <Menu size={18} />
                    </button>
                    <Link to="/admin" className="flex items-center gap-2">
                        <img 
                            src="/logo.png" 
                            alt="ONHAUS Logo" 
                            className="w-5 h-5 object-contain shrink-0" 
                        />
                        <span className="font-mono text-xs font-bold tracking-widest text-[var(--ram-ink)]">ONHAUS</span>
                        <div className="flex items-center gap-1 bg-[oklch(94%_0.02_140)] text-[oklch(35%_0.08_140)] border border-[oklch(85%_0.04_140)] px-1.5 py-0.2 rounded-xs font-mono text-[8px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-[oklch(45%_0.14_140)] animate-pulse" />
                            <span>LIVE</span>
                        </div>
                    </Link>
                </div>

                <div className="flex items-center gap-2">
                    {pendingCount > 0 && (
                        <Link 
                            to="/admin" 
                            className="flex items-center gap-1 bg-[var(--ram-accent)] text-white px-2 py-0.5 rounded-xs font-mono text-[10px] font-bold animate-pulse"
                        >
                            <span>INBOX</span>
                            <span className="bg-black/20 px-1 rounded-xs">{pendingCount}</span>
                        </Link>
                    )}
                    <a
                        href="/pos"
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 text-[var(--ram-ink)] hover:bg-[oklch(92%_0.010_28)] rounded-xs border border-[var(--ram-rule)] font-mono text-xs font-bold"
                        title="Open POS Terminal in new tab"
                    >
                        POS
                    </a>
                </div>
            </nav>

            {/* Mobile / Tablet Drawer Navigation */}
            <AnimatePresence>
                {sidebarOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => setSidebarOpen(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 lg:hidden"
                        />
                        <motion.aside
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                            className="fixed top-0 left-0 bottom-0 w-72 max-w-[85vw] bg-paper z-50 p-5 flex flex-col border-r border-[var(--ram-rule)] lg:hidden shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-4 pb-3 border-b border-[var(--ram-rule)]">
                                <div className="flex items-center gap-2.5">
                                    <img 
                                        src="/logo.png" 
                                        alt="ONHAUS Logo" 
                                        className="w-7 h-7 object-contain shrink-0" 
                                    />
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-mono text-xs font-bold tracking-widest text-ink">ONHAUS</span>
                                            <span className="px-1 py-0.2 bg-[var(--ram-ink)] text-white font-mono text-[8px] font-bold rounded-xs">
                                                {userRoleDisplay}
                                            </span>
                                        </div>
                                        <div className="text-[8px] font-mono text-gray-400 tracking-widest uppercase mt-0.5">EXECUTIVE COCKPIT</div>
                                    </div>
                                </div>
                                <button 
                                    type="button"
                                    onClick={() => setSidebarOpen(false)} 
                                    className="p-1.5 text-ink hover:bg-gray-100 rounded-xs transition-colors border border-[var(--ram-rule)] cursor-pointer"
                                    aria-label="Close Navigation Menu"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <nav className="flex-1 space-y-1 overflow-y-auto pr-1 no-scrollbar">
                                {menuItems.map((item) => {
                                    const active = item.isActive(location.pathname)
                                    const Icon = item.icon
                                    
                                    if (!item.isAllowed) {
                                        return (
                                            <div 
                                                key={item.path} 
                                                className="admin-sidebar-item flex items-center justify-between opacity-40 cursor-not-allowed bg-transparent select-none"
                                                title="ไม่มีสิทธิ์เข้าถึงหมวดหมู่นี้"
                                            >
                                                <div className="flex items-center gap-2.5 text-gray-400">
                                                    <Icon size={16} />
                                                    <span className="line-through text-xs">{item.label}</span>
                                                </div>
                                                <span className="font-mono text-[8px] font-bold text-gray-500 bg-gray-100 px-1 py-0.2 rounded-xs">
                                                    LOCKED
                                                </span>
                                            </div>
                                        )
                                    }

                                    return (
                                        <Link 
                                            key={item.path} 
                                            to={item.path} 
                                            onClick={() => setSidebarOpen(false)}
                                            className={`admin-sidebar-item flex items-center justify-between ${active ? 'is-active' : ''}`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <Icon size={16} />
                                                <span className="text-xs">{item.label}</span>
                                            </div>
                                            {item.badge && (
                                                <span className="bg-[var(--ram-accent)] text-white text-[10px] px-1.5 py-0.2 rounded-xs font-mono font-bold animate-pulse">
                                                    {item.badge}
                                                </span>
                                            )}
                                        </Link>
                                    )
                                })}
                            </nav>

                            <div className="mt-auto border-t border-[var(--ram-rule)] pt-3 flex flex-col gap-2">
                                <button 
                                    type="button"
                                    onClick={handleLogout} 
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xs transition-all font-mono text-xs uppercase font-bold border border-[var(--ram-rule)] cursor-pointer"
                                >
                                    <LogOut size={14} /> Logout
                                </button>
                                <div className="text-[8px] text-gray-400 font-mono tracking-widest uppercase text-center">
                                    ONHAUS SYSTEM // 2026
                                </div>
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* Sidebar: Dieter Rams Structural Grid (Desktop - Collapsible) */}
            <aside className={`bg-paper border-r border-[var(--ram-rule)] hidden lg:flex flex-col fixed h-full z-30 admin-sidebar transition-[width,padding] duration-200 ease-in-out ${
                isCollapsed ? 'w-[68px] admin-sidebar-collapsed' : 'w-64 p-4 lg:p-5'
            }`}>
                {isCollapsed ? (
                    /* --- Collapsed Mini-Rail Content --- */
                    <>
                        {/* Header: Centered Logo + Expand Toggle Button */}
                        <div className="mb-4 pb-3 border-b border-[var(--ram-rule)] flex flex-col items-center gap-2.5 w-full">
                            <img 
                                src="/logo.png" 
                                alt="ONHAUS Logo" 
                                className="w-7 h-7 object-contain" 
                            />
                            <button
                                type="button"
                                onClick={toggleCollapse}
                                className="w-8 h-8 flex items-center justify-center text-[var(--ram-ink-muted)] hover:text-[var(--ram-ink)] hover:bg-[oklch(94%_0.010_28)] rounded-xs border border-[var(--ram-rule)] transition-all cursor-pointer"
                                title="ขยายแถบเมนู (Ctrl+B)"
                                aria-label="Expand Sidebar"
                            >
                                <PanelLeft size={15} />
                            </button>
                        </div>

                        {/* Navigation Items (Icon-only with Tooltips) */}
                        <nav className="flex-1 space-y-1.5 overflow-y-auto no-scrollbar w-full flex flex-col items-center">
                            {menuItems.map((item) => {
                                const active = item.isActive(location.pathname)
                                const Icon = item.icon

                                if (!item.isAllowed) {
                                    return (
                                        <div 
                                            key={item.path}
                                            className="relative group w-10 h-10 rounded-xs flex items-center justify-center opacity-30 cursor-not-allowed text-gray-400 select-none"
                                            title={`${item.label} (LOCKED)`}
                                        >
                                            <Icon size={18} />
                                            <div className="absolute left-full ml-3 px-2.5 py-1 bg-[var(--ram-ink)] text-white font-mono text-[10px] font-bold tracking-wider uppercase rounded-xs whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-md border border-[var(--ram-rule)]">
                                                {item.label} (LOCKED)
                                            </div>
                                        </div>
                                    )
                                }

                                return (
                                    <Link 
                                        key={item.path} 
                                        to={item.path}
                                        className="relative group w-full flex justify-center"
                                        title={item.badge ? `${item.label} (${item.badge})` : item.label}
                                    >
                                        <div className={`w-10 h-10 rounded-xs flex items-center justify-center transition-all ${
                                            active 
                                                ? 'bg-[var(--ram-ink)] text-white shadow-xs' 
                                                : 'text-[var(--ram-ink-muted)] hover:text-[var(--ram-ink)] hover:bg-[oklch(94%_0.010_28)] border border-transparent hover:border-[var(--ram-rule)]'
                                        }`}>
                                            <Icon size={18} />
                                            {item.badge && (
                                                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-[var(--ram-accent)] ring-2 ring-[var(--ram-paper)] animate-pulse" />
                                            )}
                                        </div>

                                        {/* Floating Rams Monospace Tooltip */}
                                        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[var(--ram-ink)] text-white font-mono text-[10px] font-bold tracking-wider uppercase rounded-xs whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg border border-[var(--ram-rule)] flex items-center gap-2">
                                            <span>{item.label}</span>
                                            {item.badge && (
                                                <span className="bg-[var(--ram-accent)] text-white px-1.5 py-0.2 rounded-xs text-[9px]">
                                                    {item.badge}
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                )
                            })}
                        </nav>

                        {/* Collapsed Footer */}
                        <div className="mt-auto border-t border-[var(--ram-rule)] pt-3 flex flex-col items-center gap-2 w-full">
                            <button 
                                type="button"
                                onClick={handleLogout} 
                                className="relative group w-10 h-10 rounded-xs flex items-center justify-center text-[var(--ram-ink-muted)] hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all cursor-pointer"
                                title="Logout (ออกจากระบบ)"
                                aria-label="Logout"
                            >
                                <LogOut size={16} />
                                <div className="absolute left-full ml-3 px-2 py-1 bg-[var(--ram-ink)] text-white font-mono text-[10px] font-bold tracking-wider uppercase rounded-xs whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-md">
                                    LOGOUT
                                </div>
                            </button>
                            <span className="text-[8px] text-[var(--ram-ink-muted)] font-mono font-bold uppercase tracking-wider">
                                SYS
                            </span>
                        </div>
                    </>
                ) : (
                    /* --- Expanded Full Sidebar Content --- */
                    <>
                        {/* Header: Logo, Title, Role, Collapse Button */}
                        <div className="mb-4 pb-3 border-b border-[var(--ram-rule)]">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <img 
                                        src="/logo.png" 
                                        alt="ONHAUS Logo" 
                                        className="w-7 h-7 object-contain shrink-0" 
                                    />
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-mono text-xs font-bold tracking-widest text-[var(--ram-ink)] truncate">ONHAUS</span>
                                            <span className="px-1 py-0.2 bg-[var(--ram-ink)] text-white font-mono text-[8px] font-bold rounded-xs tracking-wider shrink-0">
                                                {userRoleDisplay}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[8px] font-mono text-[var(--ram-ink-muted)] tracking-widest uppercase">
                                            <span>ADMIN COCKPIT</span>
                                            <span>SYS 2.6</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={toggleCollapse}
                                    className="p-1.5 text-[var(--ram-ink-muted)] hover:text-[var(--ram-ink)] hover:bg-[oklch(94%_0.010_28)] rounded-xs border border-[var(--ram-rule)] transition-all cursor-pointer shrink-0"
                                    title="ย่อแถบเมนู (Ctrl+B)"
                                    aria-label="Collapse Sidebar"
                                >
                                    <PanelLeftClose size={15} />
                                </button>
                            </div>
                        </div>

                        {/* Navigation Items */}
                        <nav className="flex-1 space-y-1 overflow-y-auto pr-1 no-scrollbar">
                            {menuItems.map((item) => {
                                const active = item.isActive(location.pathname)
                                const Icon = item.icon

                                if (!item.isAllowed) {
                                    return (
                                        <div 
                                            key={item.path}
                                            className="admin-sidebar-item flex items-center justify-between opacity-40 cursor-not-allowed bg-transparent select-none"
                                            title="ไม่มีสิทธิ์เข้าถึงหมวดหมู่นี้ (เฉพาะ Owner หรือผู้ได้รับอนุญาต)"
                                        >
                                            <div className="flex items-center gap-2.5 text-[var(--ram-ink-muted)] min-w-0">
                                                <Icon size={16} className="shrink-0" />
                                                <span className="line-through truncate text-xs">{item.label}</span>
                                            </div>
                                            <span className="font-mono text-[8px] font-bold text-gray-500 bg-gray-100 px-1 py-0.5 rounded-xs shrink-0">
                                                LOCKED
                                            </span>
                                        </div>
                                    )
                                }

                                return (
                                    <Link key={item.path} to={item.path}>
                                        <div className={`admin-sidebar-item flex items-center justify-between ${active ? 'is-active' : ''}`}>
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <Icon size={16} className="shrink-0" />
                                                <span className="truncate text-xs">{item.label}</span>
                                            </div>
                                            {item.badge && (
                                                <span className="bg-[var(--ram-accent)] text-white text-[10px] px-1.5 py-0.2 rounded-xs font-mono font-bold shrink-0 animate-pulse">
                                                    {item.badge}
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                )
                            })}
                        </nav>

                        {/* Expanded Footer */}
                        <div className="mt-auto border-t border-[var(--ram-rule)] pt-3 flex flex-col gap-2">
                            <button 
                                type="button"
                                onClick={handleLogout} 
                                className="w-full flex items-center justify-between px-3 py-2 text-[var(--ram-ink-muted)] hover:text-red-600 hover:bg-red-50 rounded-xs transition-all font-mono text-xs uppercase font-bold border border-[var(--ram-rule)] hover:border-red-200 cursor-pointer"
                            >
                                <span className="flex items-center gap-2">
                                    <LogOut size={14} /> Logout
                                </span>
                                <span className="text-[9px] text-gray-400">ESC</span>
                            </button>
                            <div className="text-[8px] text-[var(--ram-ink-muted)] font-mono tracking-widest uppercase text-center">
                                ONHAUS SYSTEM // 2026
                            </div>
                        </div>
                    </>
                )}
            </aside>

            {/* Main Content Area */}
            <main className={`flex-1 transition-[margin] duration-200 ease-in-out p-4 md:p-6 lg:p-8 bg-canvas min-h-screen flex flex-col justify-between ml-0 ${
                isCollapsed ? 'lg:ml-[68px]' : 'lg:ml-64'
            }`}>
                {/* Desktop Subtle Utility Strip */}
                <div className="hidden lg:flex items-center justify-between pb-3 mb-5 border-b border-[var(--ram-rule)] text-[11px] font-mono text-[var(--ram-ink-muted)]">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={toggleCollapse}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-xs border border-[var(--ram-rule)] bg-[var(--ram-paper)] hover:bg-[oklch(94%_0.010_28)] text-[var(--ram-ink)] transition-colors cursor-pointer"
                            title="ซ่อน/เปิดแถบเมนู (Ctrl+B)"
                        >
                            {isCollapsed ? <PanelLeft size={14} /> : <PanelLeftClose size={14} />}
                            <span className="text-[10px] font-bold uppercase">
                                {isCollapsed ? 'EXPAND MENU' : 'COLLAPSE'}
                            </span>
                            <kbd className="text-[9px] bg-black/5 px-1 py-0.2 rounded-xs text-[var(--ram-ink-muted)]">^B</kbd>
                        </button>

                        <div className="flex items-center gap-1.5 text-[var(--ram-ink-muted)]">
                            <span className="font-bold text-[var(--ram-ink)]">ONHAUS</span>
                            <span>/</span>
                            <span className="text-[var(--ram-accent)] font-bold">{currentSectionLabel.toUpperCase()}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {pendingCount > 0 && (
                            <Link 
                                to="/admin" 
                                className="flex items-center gap-1 bg-[oklch(52%_0.16_28)] text-white px-2 py-0.5 rounded-xs font-mono text-[10px] font-bold animate-pulse"
                            >
                                <span>INBOX</span>
                                <span className="bg-black/20 px-1 rounded-xs">{pendingCount}</span>
                            </Link>
                        )}
                        <a
                            href="/pos"
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-0.5 text-[var(--ram-ink)] hover:bg-[oklch(92%_0.010_28)] rounded-xs border border-[var(--ram-rule)] font-mono text-[10px] font-bold"
                            title="Open POS Terminal in new tab"
                        >
                            POS TERMINAL ↗
                        </a>
                        <span className="px-1.5 py-0.5 bg-[var(--ram-paper-2)] border border-[var(--ram-rule)] text-[var(--ram-ink)] font-mono text-[9px] font-bold rounded-xs">
                            {userRoleDisplay}
                        </span>
                    </div>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="max-w-7xl w-full mx-auto flex-1"
                >
                    {isCurrentRouteAllowed ? (
                        <Outlet />
                    ) : (
                        <div className="bg-[oklch(98%_0.006_28)] border-2 border-dashed border-[oklch(85%_0.012_28)] rounded-xl p-8 md:p-12 text-center max-w-lg mx-auto my-12 space-y-4 font-mono shadow-sm">
                            <div className="inline-flex items-center justify-center p-3 bg-[oklch(94%_0.010_28)] rounded-full text-[oklch(52%_0.16_28)] border border-[oklch(85%_0.012_28)]">
                                <Lock size={28} />
                            </div>
                            <h2 className="text-base md:text-lg font-black text-[oklch(18%_0.012_28)] uppercase tracking-wider">
                                RESTRICTED BACKOFFICE ACCESS
                            </h2>
                            <p className="text-xs text-[oklch(42%_0.010_28)] leading-relaxed">
                                หมวดหมู่นี้จำกัดสิทธิ์เฉพาะ Owner หรือผู้บริหารที่ได้รับอนุญาตเท่านั้น บัญชีของคุณ (<strong className="text-black">{userRoleDisplay}</strong>) ยังไม่ได้รับสิทธิ์เข้าถึงหน้านี้
                            </p>
                            <div className="pt-2">
                                <Link 
                                    to={firstAllowedPath}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[oklch(18%_0.012_28)] text-white text-xs font-bold rounded-sm hover:bg-black transition-colors shadow-sm"
                                >
                                    <span>ไปยังหน้าที่ได้รับสิทธิ์เข้าถึง</span>
                                    <ArrowUpRight size={14} />
                                </Link>
                            </div>
                        </div>
                    )}
                </motion.div>
                
                <footer className="mt-12 pt-6 border-t border-[var(--ram-rule)]">
                    <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-[10px] font-mono text-gray-400 tracking-widest uppercase">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-600">IN THE HAUS</span>
                            <span>/</span>
                            <span>EXECUTIVE COCKPIT</span>
                        </div>
                        <div>OPERATING ENVIRONMENT © 2026</div>
                    </div>
                </footer>
            </main>
        </div>
    )
}

