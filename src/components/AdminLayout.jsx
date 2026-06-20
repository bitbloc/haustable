import { useState, useEffect } from 'react';
import { Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { LayoutDashboard, Utensils, Settings, Move, LogOut, Users, Calendar, Tag, LayoutGrid, ChefHat, Calculator, FlaskConical, BookOpen, Music, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BookingMonitor from './admin/BookingMonitor';
import { toast } from 'sonner';

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
        { path: '/admin/steaks', icon: ChefHat, label: 'Steaks' },
        { path: '/admin/tables', icon: LayoutGrid, label: 'Tables' },
        { path: '/admin/promotions', icon: Tag, label: 'Promotions' }, // NEW
        { path: '/admin/editor', icon: Move, label: 'Floor Plan' },
        { path: '/admin/songs', icon: Music, label: 'Song Requests' },
        { path: '/admin/settings', icon: Settings, label: 'Settings' },
    ];

    return (
        <div className="min-h-screen bg-canvas text-ink font-sans flex flex-col md:flex-row">
            {/* --- Mobile Navigation (Top Bar) --- */}
            <nav className="md:hidden sticky top-0 z-50 bg-paper/80 backdrop-blur-md border-b border-gray-100 p-4 flex items-center justify-between shadow-sm">
                <button onClick={() => setSidebarOpen(true)} className="p-2 text-ink hover:bg-gray-100 rounded-full transition-colors">
                    <Menu size={24} />
                </button>
                <Link to="/admin" className="flex items-center">
                    <img src="/logo-staff-light.png" alt="In The Haus Staff" className="h-8 w-auto object-contain" />
                </Link>
                <button onClick={handleLogout} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors">
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
                            className="fixed inset-0 bg-black z-50 md:hidden"
                        />
                        {/* Drawer content */}
                        <motion.aside
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                            className="fixed top-0 left-0 bottom-0 w-72 bg-paper z-50 p-6 flex flex-col border-r border-gray-100 md:hidden shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-100">
                                <img src="/logo-staff-light.png" alt="In The Haus" className="h-10 w-auto object-contain" />
                                <button onClick={() => setSidebarOpen(false)} className="p-2 text-ink hover:bg-gray-100 rounded-full transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1 no-scrollbar">
                                {menuItems.map((item) => {
                                    const isActive = location.pathname === item.path;
                                    return (
                                        <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}>
                                            <div className={`flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 ${isActive ? 'bg-black text-white shadow-xl scale-102' : 'text-gray-500 hover:bg-gray-50 hover:text-black'}`}>
                                                <item.icon size={18} className={isActive ? "text-brand" : "text-gray-400"} />
                                                <span className="font-bold tracking-wide text-xs">{item.label}</span>
                                            </div>
                                        </Link>
                                    )
                                })}
                            </nav>

                            <div className="mt-auto border-t border-gray-100 pt-4">
                                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all font-bold text-xs">
                                    <LogOut size={18} /> Logout
                                </button>
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* Sidebar: Clean, Bright, Physical Interface (Desktop) */}
            <aside className="w-72 bg-paper border-r border-gray-100 hidden md:flex flex-col p-8 fixed h-full z-40">
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <img src="/logo-staff-light.png" alt="In The Haus Staff" className="h-12 w-auto object-contain" />
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase ml-1">Workspace Admin</p>
                </div>

                <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1 no-scrollbar max-h-[calc(100vh-220px)]">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link key={item.path} to={item.path}>
                                <div className={`flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 group ${isActive ? 'bg-black text-white shadow-xl scale-102' : 'text-gray-500 hover:bg-gray-50 hover:text-black'}`}>
                                    <item.icon size={18} className={`transition-colors ${isActive ? "text-brand" : "text-gray-400 group-hover:text-black"}`} />
                                    <span className="font-bold tracking-wide text-xs">{item.label}</span>
                                </div>
                            </Link>
                        )
                    })}
                </nav>

                <div className="mt-auto border-t border-gray-50 pt-4">
                     <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all font-bold text-xs">
                        <LogOut size={18} /> Logout
                     </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 md:ml-72 p-4 md:p-12 bg-canvas min-h-screen">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="max-w-7xl mx-auto"
                >
                    <Outlet />
                </motion.div>
            </main>
        </div>
    );
}
