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
        <div className="min-h-screen bg-[#000000] text-white font-sans flex flex-col md:flex-row">
            {/* --- Mobile Navigation (Top Bar) --- */}
            <nav className="md:hidden sticky top-0 z-50 bg-[#111] border-b border-white/10 p-2 overflow-x-auto flex gap-2 no-scrollbar">
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link key={item.path} to={item.path} className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${isActive ? 'bg-[#DFFF00] text-black' : 'text-gray-400 bg-white/5'}`}>
                            <item.icon size={16} />
                            <span>{item.label}</span>
                        </Link>
                    )
                })}
                <button onClick={handleLogout} className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap text-red-400 bg-red-900/10 border border-red-900/20">
                    <LogOut size={16} />
                </button>
            </nav>

            {/* Sidebar สไตล์ Dieter Rams: เรียบ ง่าย ชัดเจน */}
            <aside className="w-64 bg-[#111] border-r border-white/10 hidden md:flex flex-col p-6 fixed h-full z-50">
                <h1 className="text-xl font-bold tracking-tight mb-10 text-white">
                    On Haus <span className="text-[#DFFF00]">Admin</span>
                </h1>

                <nav className="flex-1 space-y-2">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link key={item.path} to={item.path}>
                                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive ? 'bg-[#DFFF00] text-black font-bold shadow-[0_0_15px_rgba(223,255,0,0.3)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                                    <item.icon size={20} />
                                    <span>{item.label}</span>
                                </div>
                            </Link>
                        )
                    })}
                </nav>

                <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors mt-auto">
                    <LogOut size={20} /> Logout
                </button>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 md:ml-64 p-6 md:p-10 bg-[#050505]">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                >
                    <Outlet /> {/* เนื้อหาของแต่ละหน้าจะมาโผล่ตรงนี้ */}
                </motion.div>
            </main>
        </div>
    );
}
