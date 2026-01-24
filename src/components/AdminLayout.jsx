import { useState, useEffect } from 'react';
import { Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { LayoutDashboard, Utensils, Settings, Move, LogOut, Users, Calendar, Tag, LayoutGrid, ChefHat, Calculator } from 'lucide-react';
import { motion } from 'framer-motion';
import BookingMonitor from './admin/BookingMonitor';

export default function AdminLayout({ children }) {
    const [isAdmin, setIsAdmin] = useState(null);
    const location = useLocation();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        const checkUser = async () => {
            try {
                const { data: { user }, error } = await supabase.auth.getUser();
                if (error || !user) {
                    console.error("Admin Auth Error:", error);
                    setIsAdmin(false);
                    return;
                }

                // Security Check
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();

                if (profileError) {
                    console.error("Profile Fetch Error:", profileError);
                    setIsAdmin(false);
                    return;
                }

                setIsAdmin(profile?.role === 'admin');
            } catch (err) {
                console.error("Unexpected Admin Auth Error:", err);
                setIsAdmin(false);
            }
        };
        checkUser();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/'; // บังคับ Refresh ไปหน้าแรก
    };

    if (isAdmin === null) return <div className="min-h-screen bg-[#121212] text-white flex items-center justify-center">Loading Admin...</div>;
    if (isAdmin === false) return <Navigate to="/" replace />; // เตะกลับหน้าแรกถ้าไม่ใช่ Admin

    const menuItems = [
        { path: '/admin', icon: LayoutDashboard, label: 'Overview' },
        { path: '/admin/bookings', icon: Calendar, label: 'Bookings' },
        { path: '/admin/members', icon: Users, label: 'Members' },
        { path: '/admin/menu', icon: Utensils, label: 'Menu' },
        { path: '/admin/costing', icon: Calculator, label: 'Costing' }, // NEW
        { path: '/admin/steaks', icon: ChefHat, label: 'Steaks' },
        { path: '/admin/tables', icon: LayoutGrid, label: 'Tables' },
        { path: '/admin/promotions', icon: Tag, label: 'Promotions' }, // NEW
        { path: '/admin/editor', icon: Move, label: 'Floor Plan' },
        { path: '/admin/settings', icon: Settings, label: 'Settings' },
    ];

    return (
        <div className="min-h-screen bg-canvas text-ink font-sans flex flex-col md:flex-row">
            {/* --- Mobile Navigation (Top Bar) --- */}
            <nav className="md:hidden sticky top-0 z-50 bg-paper/80 backdrop-blur-md border-b border-gray-100 p-3 overflow-x-auto flex gap-3 no-scrollbar items-center">
                <div className="flex-shrink-0 font-bold text-lg tracking-tighter mr-2">Haus.</div>
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link key={item.path} to={item.path} className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${isActive ? 'bg-black text-white shadow-md' : 'text-gray-500 bg-gray-50'}`}>
                            <item.icon size={16} />
                            <span>{item.label}</span>
                        </Link>
                    )
                })}
                <button onClick={handleLogout} className="flex-shrink-0 p-2 text-red-500 bg-red-50 rounded-full ml-auto">
                    <LogOut size={16} />
                </button>
            </nav>

            {/* Sidebar: Clean, Bright, Physical Interface */}
            <aside className="w-72 bg-paper border-r border-gray-100 hidden md:flex flex-col p-8 fixed h-full z-50">
                <div className="mb-12">
                    <h1 className="text-2xl font-black tracking-tighter text-ink flex items-center gap-2">
                        <div className="w-8 h-8 bg-brand rounded-lg"></div>
                        The Haus.
                    </h1>
                    <p className="text-xs text-gray-400 font-medium ml-10 mt-1">Workspace Admin</p>
                </div>

                <nav className="flex-1 space-y-2">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link key={item.path} to={item.path}>
                                <div className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group ${isActive ? 'bg-black text-white shadow-xl scale-105' : 'text-gray-500 hover:bg-gray-50 hover:text-black'}`}>
                                    <item.icon size={20} className={`transition-colors ${isActive ? "text-brand" : "text-gray-400 group-hover:text-black"}`} />
                                    <span className={`font-bold tracking-wide text-sm ${isActive ? "" : ""}`}>{item.label}</span>
                                </div>
                            </Link>
                        )
                    })}
                </nav>

                <div className="mt-auto border-t border-gray-50 pt-6">
                     <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all font-bold text-sm">
                        <LogOut size={20} /> Logout
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
