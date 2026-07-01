import { useState, useEffect } from 'react';
import { Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { LayoutDashboard, Utensils, Settings, Move, LogOut, Users, Calendar, Tag, LayoutGrid, ChefHat, Calculator, FlaskConical, BookOpen, Music, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BookingMonitor from './admin/BookingMonitor';
import { toast } from 'sonner';
import './AdminLayout.css';

export default function AdminLayout({ children }) {
    const [authStatus, setAuthStatus] = useState('loading'); // 'loading' | 'unauthenticated' | 'unauthorized' | 'authorized'
    const location = useLocation();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        const checkUser = async () => {
            try {
                const { data: { user }, error } = await supabase.auth.getUser();
                if (error || !user) {
                    console.error("Admin Auth Error:", error);
                    setAuthStatus('unauthenticated');
                    return;
                }

                // Security Check
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();

                if (profileError || !profile) {
                    console.error("Profile Fetch Error:", profileError);
                    setAuthStatus('unauthorized');
                    return;
                }

                if (profile.role === 'admin') {
                    setAuthStatus('authorized');
                } else {
                    setAuthStatus('unauthorized');
                }
            } catch (err) {
                console.error("Unexpected Admin Auth Error:", err);
                setAuthStatus('unauthenticated');
            }
        };
        checkUser();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/'; // บังคับ Refresh ไปหน้าแรก
    };

    useEffect(() => {
        if (authStatus === 'unauthorized') {
            toast.error('Access Denied: Admin permission required.');
        }
    }, [authStatus]);

    if (authStatus === 'loading') return <div className="min-h-screen bg-[#121212] text-white flex items-center justify-center">Loading Admin...</div>;
    if (authStatus === 'unauthenticated') return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
    if (authStatus === 'unauthorized') return <Navigate to="/" replace />;

    const menuItems = [
        { path: '/admin', icon: LayoutDashboard, label: 'Overview' },
        { path: '/admin/bookings', icon: Calendar, label: 'Bookings' },
        { path: '/admin/members', icon: Users, label: 'Members' },
        { path: '/admin/menu', icon: Utensils, label: 'Menu' },
        { path: '/admin/costing', icon: Calculator, label: 'Costing' }, // NEW
        { path: '/admin/lab', icon: FlaskConical, label: 'Recipe Lab' }, // NEW
        { path: '/admin/sop', icon: BookOpen, label: 'Bar SOP' }, // NEW: SOP
        { path: '/admin/tables', icon: LayoutGrid, label: 'Tables' },
        { path: '/admin/promotions', icon: Tag, label: 'Promotions' }, // NEW
        { path: '/admin/editor', icon: Move, label: 'Floor Plan' },
        { path: '/admin/songs', icon: Music, label: 'Song Requests' },
        { path: '/admin/settings', icon: Settings, label: 'Settings' },
    ];

    return (
        <div className="admin-system min-h-screen bg-canvas text-ink flex flex-col md:flex-row">
            {/* --- Mobile Navigation (Top Bar) --- */}
            <nav className="md:hidden sticky top-0 z-50 bg-paper border-b border-gray-200 p-4 flex items-center justify-between admin-mobile-nav">
                <button onClick={() => setSidebarOpen(true)} className="p-2 text-ink hover:bg-gray-100 rounded transition-colors">
                    <Menu size={24} />
                </button>
                <Link to="/admin" className="flex items-center gap-2">
                    <img src="/logo-staff-light.png" alt="ONHAUS SYSTEM" className="h-6 w-auto object-contain brightness-95 grayscale" />
                    <span className="font-mono text-xs font-bold tracking-widest text-ink">ONHAUS</span>
                </Link>
                <button onClick={handleLogout} className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors">
                    <LogOut size={20} />
                </button>
            </nav>

            {/* Mobile Drawer Navigation */}
            <AnimatePresence>
                {sidebarOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.5 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSidebarOpen(false)}
                            className="fixed inset-0 bg-black/60 z-50 md:hidden"
                        />
                        {/* Drawer content */}
                        <motion.aside
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                            className="fixed top-0 left-0 bottom-0 w-72 bg-paper z-50 p-6 flex flex-col border-r border-gray-200 md:hidden"
                        >
                            <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-200">
                                <div className="flex items-center gap-2">
                                    <img src="/logo-staff-light.png" alt="ONHAUS SYSTEM" className="h-8 w-auto object-contain brightness-95 grayscale" />
                                    <span className="font-mono text-sm font-bold tracking-widest text-ink">ONHAUS</span>
                                </div>
                                <button onClick={() => setSidebarOpen(false)} className="p-2 text-ink hover:bg-gray-100 rounded transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <nav className="flex-1 space-y-1 overflow-y-auto pr-1 no-scrollbar">
                                {menuItems.map((item) => {
                                    const isActive = location.pathname === item.path;
                                    return (
                                        <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}>
                                            <div className={`admin-sidebar-item ${isActive ? 'is-active' : ''}`}>
                                                <item.icon size={16} />
                                                <span>{item.label}</span>
                                            </div>
                                        </Link>
                                    )
                                })}
                            </nav>

                            <div className="mt-auto border-t border-gray-200 pt-4 flex flex-col gap-4">
                                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded transition-all font-mono text-xs uppercase font-bold">
                                    <LogOut size={16} /> Logout
                                </button>
                                <div className="text-[10px] text-gray-400 font-mono tracking-widest uppercase border-t border-gray-200 pt-3">
                                    ONHAUS SYSTEM © 2026
                                </div>
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* Sidebar: Clean, Bright, Physical Interface (Desktop) */}
            <aside className="w-72 bg-paper border-r border-gray-200 hidden md:flex flex-col p-8 fixed h-full z-40 admin-sidebar">
                <div className="mb-8 pb-4 border-b border-gray-200">
                    <div className="flex items-center gap-2 mb-1">
                        <img src="/logo-staff-light.png" alt="ONHAUS SYSTEM" className="h-8 w-auto object-contain brightness-95 grayscale" />
                        <span className="font-mono text-sm font-bold tracking-widest text-ink">ONHAUS</span>
                    </div>
                    <div className="text-[9px] font-mono text-gray-400 tracking-widest uppercase">SYSTEM CONTROL // 2026</div>
                </div>

                <nav className="flex-1 space-y-1 overflow-y-auto pr-1 no-scrollbar max-h-[calc(100vh-220px)]">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link key={item.path} to={item.path}>
                                <div className={`admin-sidebar-item ${isActive ? 'is-active' : ''}`}>
                                    <item.icon size={16} />
                                    <span>{item.label}</span>
                                </div>
                            </Link>
                        )
                    })}
                </nav>

                <div className="mt-auto border-t border-gray-200 pt-4 flex flex-col gap-4">
                     <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all font-mono text-xs uppercase font-bold">
                        <LogOut size={16} /> Logout
                     </button>
                     <div className="text-[10px] text-gray-400 font-mono tracking-widest uppercase border-t border-gray-200 pt-3">
                         ONHAUS SYSTEM © 2026
                     </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 md:ml-72 p-4 md:p-12 bg-canvas min-h-screen flex flex-col justify-between">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="max-w-7xl w-full mx-auto flex-1"
                >
                    <Outlet />
                </motion.div>
                
                <footer className="mt-16 pt-8 border-t border-gray-200">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] font-mono text-gray-400 tracking-widest uppercase">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-600">ONHAUS SYSTEM</span>
                            <span className="text-gray-300">|</span>
                            <span>ADMIN CONTROL</span>
                        </div>
                        <div>ONHAUS SYSTEM © 2026</div>
                    </div>
                </footer>
            </main>
        </div>
    );
}
