import { useState, useEffect, useMemo, useCallback } from 'react'
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { LayoutDashboard, TrendingUp, Utensils, Settings, LogOut, Calendar, Tag, LayoutGrid, Menu, X, ArrowUpRight, Receipt, Lock, ShieldCheck, ShoppingBag, PanelLeftClose, PanelLeft } from 'lucide-react'
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import { hasModuleAccess, hasRouteAccess } from '../utils/rbacHelper'
import './AdminLayout.css'

/* One nav list for the desktop sidebar, the collapsed rail and the mobile drawer. */
function AdminNav({ items, pathname, collapsed = false, pillId, onNavigate }) {
    const reduceMotion = useReducedMotion()
    return (
        <nav className={`admin-nav flex-1 overflow-y-auto no-scrollbar ${collapsed ? 'is-collapsed' : ''}`} aria-label="Backoffice">
            {items.map((item, i) => {
                const Icon = item.icon
                const active = item.isActive(pathname)
                const startsGroup = i > 0 && items[i - 1].group !== item.group

                if (!item.isAllowed) {
                    return (
                        <div
                            key={item.path}
                            className={`admin-nav-item is-locked ${startsGroup ? 'starts-group' : ''}`}
                            title={`${item.label} · ไม่มีสิทธิ์เข้าถึง`}
                            aria-disabled="true"
                        >
                            <Icon size={16} strokeWidth={1.5} className="shrink-0" />
                            {!collapsed && <span className="truncate flex-1">{item.label}</span>}
                            {!collapsed && <Lock size={12} strokeWidth={1.5} className="shrink-0" />}
                        </div>
                    )
                }

                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        onClick={onNavigate}
                        className={`admin-nav-item ${active ? 'is-active' : ''} ${startsGroup ? 'starts-group' : ''}`}
                        aria-current={active ? 'page' : undefined}
                        aria-label={collapsed ? item.label : undefined}
                        title={collapsed ? (item.badge ? `${item.label} · รอตรวจ ${item.badge}` : item.label) : undefined}
                    >
                        {active && (
                            <motion.span
                                layoutId={pillId}
                                className="admin-nav-pill"
                                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 42, mass: 0.6 }}
                            />
                        )}
                        <Icon size={16} strokeWidth={1.5} className="shrink-0 relative" />
                        {!collapsed && <span className="truncate flex-1 relative">{item.label}</span>}
                        {item.badge && (
                            collapsed
                                ? <span className="admin-nav-dot" />
                                : <span className="admin-nav-count relative">{item.badge}</span>
                        )}
                    </Link>
                )
            })}
        </nav>
    )
}

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

    // Auth gate. Only a definite answer sends the user away: no session -> login,
    // a profile without a backoffice role -> home. A network hiccup, an aborted
    // request or a slow server shows a retry screen instead (it used to log the
    // owner out, or bounce them to the home page, on any thrown error).
    const [authAttempt, setAuthAttempt] = useState(0)
    useEffect(() => {
        let cancelled = false
        const isDefiniteAuthError = (err) => [401, 403].includes(Number(err?.status)) || /jwt|session|token/i.test(err?.message || '')
        const checkUser = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (!session?.user) {
                    if (!cancelled) setAuthStatus('unauthenticated')
                    return
                }

                // Verify the token with the server; fall back to the local session only on transient failures.
                let user = session.user
                try {
                    const { data, error } = await supabase.auth.getUser()
                    if (error && isDefiniteAuthError(error)) {
                        if (!cancelled) setAuthStatus('unauthenticated')
                        return
                    }
                    if (data?.user) user = data.user
                } catch {
                    // transient: keep the local session user
                }

                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('id, role, display_name, nickname, phone_number, admin_permissions')
                    .eq('id', user.id)
                    .single()

                if (profileError && !profile) {
                    if (!cancelled) setAuthStatus('error')
                    return
                }

                const role = (profile?.role || '').toLowerCase()
                // Owner & Admin have full master access; other staff/custom roles also authorized
                const hasCustomPerms = Array.isArray(profile?.admin_permissions) && profile.admin_permissions.length > 0
                const isStaffOrAdmin = ['owner', 'admin', 'manager', 'staff', 'cashier', 'kitchen', 'custom'].includes(role) || hasCustomPerms

                if (!profile || !isStaffOrAdmin) {
                    console.warn("Backoffice Auth Blocked:", { profile, role, isStaffOrAdmin })
                    if (!cancelled) setAuthStatus('unauthorized')
                    return
                }

                if (!cancelled) {
                    setUserProfile(profile)
                    setAuthStatus('authorized')
                }
            } catch {
                if (!cancelled) setAuthStatus('error')
            }
        }
        checkUser()
        return () => { cancelled = true }
    }, [authAttempt])

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
            group: 0,
            path: '/admin', 
            icon: LayoutDashboard, 
            label: 'Overview', 
            badge: pendingCount > 0 ? `${pendingCount}` : null,
            isActive: (pathname) => pathname === '/admin'
        },
        { 
            key: 'tables',
            group: 0,
            path: '/admin/tables', 
            icon: LayoutGrid, 
            label: 'Floor & Tables',
            isActive: (pathname) => pathname.startsWith('/admin/tables') || pathname.startsWith('/admin/editor')
        },
        { 
            key: 'bookings',
            group: 0,
            path: '/admin/bookings', 
            icon: Calendar, 
            label: 'Bookings & Orders',
            isActive: (pathname) => pathname.startsWith('/admin/bookings')
        },
        { 
            key: 'hausmade',
            group: 1,
            path: '/admin/hausmade', 
            icon: ShoppingBag, 
            label: 'HAUSMADE Retail',
            isActive: (pathname) => pathname.startsWith('/admin/hausmade')
        },
        { 
            key: 'menu',
            group: 1,
            path: '/admin/menu', 
            icon: Utensils, 
            label: 'Menu & Lab',
            isActive: (pathname) => pathname.startsWith('/admin/menu') || pathname.startsWith('/admin/costing') || pathname.startsWith('/admin/lab') || pathname.startsWith('/admin/sop') || pathname.startsWith('/admin/stock-recon')
        },
        { 
            key: 'financial',
            group: 2,
            path: '/admin/financial', 
            icon: TrendingUp, 
            label: 'Financial & Insights',
            isActive: (pathname) => pathname === '/admin/financial'
        },
        { 
            key: 'tax',
            group: 2,
            path: '/admin/tax', 
            icon: Receipt, 
            label: 'Tax & Invoices',
            isActive: (pathname) => pathname.startsWith('/admin/tax')
        },
        { 
            key: 'marketing',
            group: 3,
            path: '/admin/marketing', 
            icon: Tag, 
            label: 'Marketing & Loyalty',
            isActive: (pathname) => pathname.startsWith('/admin/marketing') || pathname.startsWith('/admin/promotions') || pathname.startsWith('/admin/rewards') || pathname.startsWith('/admin/members') || pathname.startsWith('/admin/arcade') || pathname.startsWith('/admin/songs') || pathname.startsWith('/admin/stamps')
        },
        { 
            key: 'logs',
            group: 4,
            path: '/admin/logs', 
            icon: ShieldCheck, 
            label: 'Staff Activity Logs',
            isActive: (pathname) => pathname.startsWith('/admin/logs')
        },
        { 
            key: 'settings',
            group: 4,
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
        const role = (userProfile?.role || 'staff').toLowerCase()
        if (role === 'admin' || role === 'owner') return 'Owner'
        if (role === 'custom') return 'Custom staff'
        return role.charAt(0).toUpperCase() + role.slice(1)
    }, [userProfile])

    const userName = userProfile?.nickname || userProfile?.display_name || 'Backoffice'

    const currentSectionLabel = useMemo(() => {
        const matched = menuItems.find(m => m.isActive(location.pathname))
        return matched ? matched.label : 'Overview'
    }, [menuItems, location.pathname])

    if (authStatus === 'loading') {
        return (
            <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-muted)] flex flex-col items-center justify-center text-[13px] gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-[var(--color-rule)] border-t-[var(--color-ink)] animate-spin" />
                <span>กำลังเปิด Backoffice</span>
            </div>
        )
    }

    if (authStatus === 'error') {
        return (
            <div className="min-h-screen bg-[var(--color-paper)] flex items-center justify-center p-6">
                <div className="max-w-sm space-y-3 text-center">
                    <h1 className="text-lg font-semibold text-[var(--color-ink)]">เชื่อมต่อ Backoffice ไม่สำเร็จ</h1>
                    <p className="text-sm leading-6 text-[var(--color-muted)]">ตรวจสิทธิ์ผู้ใช้ไม่ได้ในตอนนี้ อาจเป็นเพราะอินเทอร์เน็ตหรือเซิร์ฟเวอร์ช้า คุณยังล็อกอินอยู่</p>
                    <button
                        type="button"
                        onClick={() => { setAuthStatus('loading'); setAuthAttempt((n) => n + 1) }}
                        className="h-10 px-4 rounded-lg bg-[var(--color-ink)] text-[var(--color-paper)] text-sm font-medium cursor-pointer"
                    >
                        ลองอีกครั้ง
                    </button>
                </div>
            </div>
        )
    }

    if (authStatus === 'unauthenticated') return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
    if (authStatus === 'unauthorized') return <Navigate to="/" replace />

    const brand = (
        <Link to="/admin" className="flex items-center gap-2.5 min-w-0">
            <img src="/logo.png" alt="" className="w-7 h-7 object-contain shrink-0" />
            <span className="min-w-0 leading-tight">
                <span className="block text-sm font-semibold text-[var(--ram-ink)] truncate">In The Haus</span>
                <span className="block text-[11px] text-[var(--ram-ink-muted)]">Backoffice</span>
            </span>
        </Link>
    )

    const account = (
        <div className="admin-account">
            <div className="min-w-0 flex-1 leading-tight">
                <div className="text-[13px] font-medium text-[var(--ram-ink)] truncate">{userName}</div>
                <div className="text-[11px] text-[var(--ram-ink-muted)]">{userRoleDisplay}</div>
            </div>
            <button type="button" onClick={handleLogout} className="admin-icon-btn" title="ออกจากระบบ" aria-label="ออกจากระบบ">
                <LogOut size={16} strokeWidth={1.5} />
            </button>
        </div>
    )

    return (
        <div className="admin-system min-h-screen bg-canvas text-ink flex flex-col lg:flex-row relative">
            {/* Mobile / tablet top bar (below 1024px) */}
            <div className="lg:hidden sticky top-0 z-40 admin-mobile-nav px-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                    <button type="button" onClick={() => setSidebarOpen(true)} className="admin-icon-btn" aria-label="เปิดเมนู">
                        <Menu size={18} strokeWidth={1.5} />
                    </button>
                    <span className="text-sm font-semibold text-[var(--ram-ink)] truncate">{currentSectionLabel}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {pendingCount > 0 && (
                        <Link to="/admin" className="admin-pending">
                            <span>รอตรวจ</span>
                            <span className="tabular-nums font-semibold">{pendingCount}</span>
                        </Link>
                    )}
                    <Link to="/staff/stock" state={{ from: location.pathname }} className="admin-link-btn" title="เปิดคลังวัตถุดิบ (Staff · Stock)">
                        <span>Stock</span>
                    </Link>
                    <a href="/pos" target="_blank" rel="noreferrer" className="admin-link-btn">
                        <span>POS</span>
                        <ArrowUpRight size={13} strokeWidth={1.5} />
                    </a>
                </div>
            </div>

            {/* Mobile / tablet drawer */}
            <AnimatePresence>
                {sidebarOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            onClick={() => setSidebarOpen(false)}
                            className="admin-scrim fixed inset-0 bg-[var(--color-ink)]/40 z-50 lg:hidden"
                        />
                        <motion.aside
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
                            className="fixed top-0 left-0 bottom-0 w-72 max-w-[85vw] bg-[var(--ram-canvas)] z-50 p-4 flex flex-col gap-4 border-r border-[var(--ram-rule)] lg:hidden"
                        >
                            <div className="flex justify-between items-center gap-2">
                                {brand}
                                <button type="button" onClick={() => setSidebarOpen(false)} className="admin-icon-btn" aria-label="ปิดเมนู">
                                    <X size={18} strokeWidth={1.5} />
                                </button>
                            </div>
                            <AdminNav items={menuItems} pathname={location.pathname} pillId="admin-nav-pill-drawer" onNavigate={() => setSidebarOpen(false)} />
                            {account}
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* Desktop sidebar: on the page ground, one hairline, collapsible to a rail */}
            <aside className={`admin-sidebar hidden lg:flex flex-col gap-4 fixed h-full z-30 ${isCollapsed ? 'is-collapsed' : ''}`}>
                <div className={`flex items-center gap-2 ${isCollapsed ? 'flex-col' : 'justify-between'}`}>
                    {isCollapsed
                        ? <Link to="/admin" aria-label="In The Haus Backoffice"><img src="/logo.png" alt="" className="w-7 h-7 object-contain" /></Link>
                        : brand}
                    <button
                        type="button"
                        onClick={toggleCollapse}
                        className="admin-icon-btn"
                        title={isCollapsed ? 'ขยายเมนู (Ctrl+B)' : 'ย่อเมนู (Ctrl+B)'}
                        aria-label={isCollapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
                    >
                        {isCollapsed ? <PanelLeft size={16} strokeWidth={1.5} /> : <PanelLeftClose size={16} strokeWidth={1.5} />}
                    </button>
                </div>

                <AdminNav items={menuItems} pathname={location.pathname} collapsed={isCollapsed} pillId="admin-nav-pill" />

                {isCollapsed ? (
                    <button type="button" onClick={handleLogout} className="admin-icon-btn self-center" title="ออกจากระบบ" aria-label="ออกจากระบบ">
                        <LogOut size={16} strokeWidth={1.5} />
                    </button>
                ) : account}
            </aside>

            {/* Main */}
            <main className={`admin-main flex-1 min-w-0 min-h-screen px-4 md:px-6 lg:px-8 pb-10 ${isCollapsed ? 'lg:ml-[64px]' : 'lg:ml-[240px]'}`}>
                {/* Desktop top strip: where you are, what is waiting, the way to the POS */}
                <div className="hidden lg:flex items-center justify-between h-14 text-[13px]">
                    <div className="flex items-center gap-2 text-[var(--ram-ink-muted)]">
                        <span>Backoffice</span>
                        <span aria-hidden="true">/</span>
                        <span className="text-[var(--ram-ink)] font-medium">{currentSectionLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {pendingCount > 0 && (
                            <Link to="/admin" className="admin-pending">
                                <span>คำขอรอตรวจ</span>
                                <span className="tabular-nums font-semibold">{pendingCount}</span>
                            </Link>
                        )}
                        <Link to="/staff/stock" state={{ from: location.pathname }} className="admin-link-btn" title="เปิดคลังวัตถุดิบ (Staff · Stock)">
                            <span>Stock</span>
                        </Link>
                        <a href="/pos" target="_blank" rel="noreferrer" className="admin-link-btn" title="เปิดหน้า POS ในแท็บใหม่">
                            <span>POS Terminal</span>
                            <ArrowUpRight size={13} strokeWidth={1.5} />
                        </a>
                    </div>
                </div>

                {/* Keyed by section so each hub gets one short fade; content is never left hidden if scripts stall */}
                <div key={currentSectionLabel} className="admin-page max-w-7xl w-full mx-auto pt-4 lg:pt-0">
                    {isCurrentRouteAllowed ? (
                        <Outlet />
                    ) : (
                        <div className="border border-dashed border-[var(--ram-rule)] rounded-lg p-8 md:p-12 max-w-lg mx-auto my-12 space-y-3">
                            <h1 className="text-lg font-semibold text-[var(--ram-ink)]">หน้านี้จำกัดสิทธิ์</h1>
                            <p className="text-sm text-[var(--color-muted)] leading-relaxed">
                                หมวดนี้เปิดให้เฉพาะ Owner หรือผู้ที่ได้รับอนุญาต บัญชีของคุณ ({userRoleDisplay}) ยังไม่มีสิทธิ์เข้าถึง
                            </p>
                            <Link to={firstAllowedPath} className="admin-link-btn is-primary">
                                <span>ไปยังหน้าที่เข้าถึงได้</span>
                                <ArrowUpRight size={13} strokeWidth={1.5} />
                            </Link>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
