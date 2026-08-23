/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import { useState, useEffect } from 'react'
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { LayoutDashboard, TrendingUp, Utensils, Settings, LogOut, Calendar, Tag, LayoutGrid, Menu, X, ArrowUpRight, Receipt } from 'lucide-react'
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import './AdminLayout.css'

export default function AdminLayout() {
    const [authStatus, setAuthStatus] = useState('loading')
    const [pendingCount, setPendingCount] = useState(0)
    const location = useLocation()
    const [sidebarOpen, setSidebarOpen] = useState(false)

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
                    .select('role')
                    .eq('id', user.id)
                    .single()

                if (profileError || !profile || profile.role !== 'admin') {
                    setAuthStatus('unauthorized')
                    return
                }

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
            toast.error('Access Denied: Admin permission required.')
        }
    }, [authStatus])

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

    // Consolidated 8 Core Hubs
    const menuItems = [
        { 
            path: '/admin', 
            icon: LayoutDashboard, 
            label: 'Overview', 
            badge: pendingCount > 0 ? `${pendingCount}` : null,
            isActive: (pathname) => pathname === '/admin'
        },
        { 
            path: '/admin/tables', 
            icon: LayoutGrid, 
            label: 'Floor & Tables',
            isActive: (pathname) => pathname.startsWith('/admin/tables') || pathname.startsWith('/admin/editor')
        },
        { 
            path: '/admin/bookings', 
            icon: Calendar, 
            label: 'Bookings & Orders',
            isActive: (pathname) => pathname.startsWith('/admin/bookings')
        },
        { 
            path: '/admin/menu', 
            icon: Utensils, 
            label: 'Menu & Lab',
            isActive: (pathname) => pathname.startsWith('/admin/menu') || pathname.startsWith('/admin/costing') || pathname.startsWith('/admin/lab') || pathname.startsWith('/admin/sop')
        },
        { 
            path: '/admin/financial', 
            icon: TrendingUp, 
            label: 'Financial & Insights',
            isActive: (pathname) => pathname === '/admin/financial'
        },
        { 
            path: '/admin/tax', 
            icon: Receipt, 
            label: 'Tax & Invoices',
            isActive: (pathname) => pathname.startsWith('/admin/tax')
        },
        { 
            path: '/admin/marketing', 
            icon: Tag, 
            label: 'Marketing & Loyalty',
            isActive: (pathname) => pathname.startsWith('/admin/marketing') || pathname.startsWith('/admin/promotions') || pathname.startsWith('/admin/rewards') || pathname.startsWith('/admin/members') || pathname.startsWith('/admin/arcade') || pathname.startsWith('/admin/songs') || pathname.startsWith('/admin/stamps')
        },
        { 
            path: '/admin/settings', 
            icon: Settings, 
            label: 'Settings',
            isActive: (pathname) => pathname.startsWith('/admin/settings')
        },
    ]

    return (
        <div className="admin-system min-h-screen bg-canvas text-ink flex flex-col md:flex-row">
            {/* --- Mobile Top Bar (Sticky, Tactile) --- */}
            <nav className="md:hidden sticky top-0 z-50 bg-paper border-b border-gray-200 px-4 py-3 flex items-center justify-between admin-mobile-nav">
                <div className="flex items-center gap-3">
                    <button 
                        type="button"
                        onClick={() => setSidebarOpen(true)} 
                        className="p-2 text-ink hover:bg-[oklch(92%_0.010_28)] rounded-sm transition-colors border border-[oklch(85%_0.012_28)]"
                        aria-label="Open Navigation Menu"
                    >
                        <Menu size={20} />
                    </button>
                    <Link to="/admin" className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold tracking-widest text-[oklch(18%_0.012_28)]">ONHAUS</span>
                        <div className="flex items-center gap-1 bg-[oklch(94%_0.02_140)] text-[oklch(35%_0.08_140)] border border-[oklch(85%_0.04_140)] px-1.5 py-0.5 rounded-sm font-mono text-[9px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-[oklch(45%_0.14_140)] animate-pulse" />
                            <span>LIVE</span>
                        </div>
                    </Link>
                </div>

                <div className="flex items-center gap-2">
                    {pendingCount > 0 && (
                        <Link 
                            to="/admin" 
                            className="flex items-center gap-1 bg-[oklch(52%_0.16_28)] text-white px-2.5 py-1 rounded-sm font-mono text-[11px] font-bold animate-pulse"
                        >
                            <span>INBOX</span>
                            <span className="bg-black/20 px-1 rounded-sm">{pendingCount}</span>
                        </Link>
                    )}
                    <a
                        href="/pos"
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 text-[oklch(18%_0.012_28)] hover:bg-[oklch(92%_0.010_28)] rounded-sm border border-[oklch(85%_0.012_28)] font-mono text-xs font-bold"
                        title="Open POS"
                    >
                        POS
                    </a>
                </div>
            </nav>

            {/* Mobile Drawer Navigation */}
            <AnimatePresence>
                {sidebarOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.5 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSidebarOpen(false)}
                            className="fixed inset-0 bg-black/60 z-50 md:hidden"
                        />
                        <motion.aside
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 240 }}
                            className="fixed top-0 left-0 bottom-0 w-72 bg-paper z-50 p-6 flex flex-col border-r border-gray-200 md:hidden"
                        >
                            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                                <div>
                                    <div className="font-mono text-sm font-bold tracking-widest text-ink">ONHAUS SYSTEM</div>
                                    <div className="text-[9px] font-mono text-gray-400 tracking-widest uppercase mt-0.5">EXECUTIVE CONTROL</div>
                                </div>
                                <button 
                                    type="button"
                                    onClick={() => setSidebarOpen(false)} 
                                    className="p-2 text-ink hover:bg-gray-100 rounded-sm transition-colors border border-gray-200"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1 no-scrollbar">
                                {menuItems.map((item) => {
                                    const active = item.isActive(location.pathname)
                                    const Icon = item.icon
                                    return (
                                        <Link 
                                            key={item.path} 
                                            to={item.path} 
                                            onClick={() => setSidebarOpen(false)}
                                            className={`admin-sidebar-item flex items-center justify-between ${active ? 'is-active' : ''}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Icon size={16} />
                                                <span>{item.label}</span>
                                            </div>
                                            {item.badge && (
                                                <span className="bg-[oklch(52%_0.16_28)] text-white text-[10px] px-2 py-0.5 rounded-sm font-mono font-bold">
                                                    {item.badge}
                                                </span>
                                            )}
                                        </Link>
                                    )
                                })}
                            </nav>

                            <div className="mt-auto border-t border-gray-200 pt-4 flex flex-col gap-3">
                                <button 
                                    type="button"
                                    onClick={handleLogout} 
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-sm transition-all font-mono text-xs uppercase font-bold border border-gray-200"
                                >
                                    <LogOut size={16} /> Logout
                                </button>
                                <div className="text-[9px] text-gray-400 font-mono tracking-widest uppercase text-center">
                                    ONHAUS SYSTEM © 2026
                                </div>
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* Sidebar: Dieter Rams Structural Grid (Desktop) */}
            <aside className="w-64 lg:w-72 bg-paper border-r border-gray-200 hidden md:flex flex-col p-6 fixed h-full z-40 admin-sidebar">
                <div className="mb-6 pb-4 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-sm font-bold tracking-widest text-ink">ONHAUS</span>
                        <div className="flex items-center gap-1.5 bg-[oklch(94%_0.02_140)] text-[oklch(35%_0.08_140)] border border-[oklch(85%_0.04_140)] px-2 py-0.5 rounded-sm font-mono text-[9px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-[oklch(45%_0.14_140)] animate-pulse" />
                            <span>LIVE SYNC</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-[9px] font-mono text-gray-400 tracking-widest uppercase">
                        <span>ADMIN COCKPIT</span>
                        <span>SYS 2.6</span>
                    </div>
                </div>

                <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1 no-scrollbar max-h-[calc(100vh-210px)]">
                    {menuItems.map((item) => {
                        const active = item.isActive(location.pathname)
                        const Icon = item.icon
                        return (
                            <Link key={item.path} to={item.path}>
                                <div className={`admin-sidebar-item flex items-center justify-between ${active ? 'is-active' : ''}`}>
                                    <div className="flex items-center gap-2.5">
                                        <Icon size={16} />
                                        <span>{item.label}</span>
                                    </div>
                                    {item.badge && (
                                        <span className="bg-[oklch(52%_0.16_28)] text-white text-[10px] px-1.5 py-0.5 rounded-sm font-mono font-bold">
                                            {item.badge}
                                        </span>
                                    )}
                                </div>
                            </Link>
                        )
                    })}
                </nav>

                <div className="mt-auto border-t border-gray-200 pt-4 flex flex-col gap-3">
                    <button 
                        type="button"
                        onClick={handleLogout} 
                        className="w-full flex items-center gap-3 px-4 py-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-sm transition-all font-mono text-xs uppercase font-bold border border-gray-200"
                    >
                        <LogOut size={14} /> Logout
                    </button>
                    <div className="text-[9px] text-gray-400 font-mono tracking-widest uppercase text-center">
                        ONHAUS SYSTEM // 2026
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 md:ml-64 lg:ml-72 p-4 md:p-6 lg:p-10 bg-canvas min-h-screen flex flex-col justify-between">
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="max-w-7xl w-full mx-auto flex-1"
                >
                    <Outlet />
                </motion.div>
                
                <footer className="mt-12 pt-6 border-t border-gray-200">
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
