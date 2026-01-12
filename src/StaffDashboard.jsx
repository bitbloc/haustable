import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabaseClient';
import { 
    ClipboardList, 
    Package, 
    LogOut, 
    Calendar,
    ArrowRight,
    UserCircle,
    Bell,
    CheckCircle2,
    TrendingUp,
    AlertTriangle,
    RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

// --- Sub-Components (Keep clean UI) ---

const StatCard = ({ title, value, subtext, icon: Icon, alert, loading }) => (
    <div className={`min-w-[150px] p-5 rounded-2xl flex flex-col justify-between h-[130px] border transition-all relative overflow-hidden ${
        alert 
        ? 'bg-red-50 border-red-100 text-red-900' 
        : 'bg-white border-gray-100 text-gray-800 shadow-sm'
    }`}>
        <div className="flex justify-between items-start z-10">
            <span className={`text-sm font-semibold ${alert ? 'text-red-600' : 'text-gray-400'}`}>{title}</span>
            {Icon && <Icon className={`w-5 h-5 ${alert ? 'text-red-500' : 'text-gray-300'}`} />}
        </div>
        <div className="z-10">
            {loading ? (
                <div className="h-8 w-16 bg-gray-200 animate-pulse rounded mb-1"></div>
            ) : (
                <motion.span 
                    key={value} // Trigger animation on value change
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-4xl font-bold tracking-tight block"
                >
                    {value}
                </motion.span>
            )}
            <p className={`text-xs mt-1 ${alert ? 'text-red-500' : 'text-gray-400'}`}>{subtext}</p>
        </div>
        {/* Background Decoration */}
        {Icon && <Icon className="absolute -right-4 -bottom-4 w-24 h-24 opacity-[0.03] z-0" />}
    </div>
);

const ActionButton = ({ onClick, icon: Icon, title, desc, colorClass, delay }) => (
    <motion.button 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay * 0.1, duration: 0.4 }}
        onClick={onClick}
        className="relative overflow-hidden bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col items-start gap-4 hover:shadow-lg transition-all active:scale-[0.98] group"
    >
        <div className={`absolute top-0 right-0 w-24 h-24 -mr-6 -mt-6 rounded-full opacity-10 transition-transform group-hover:scale-150 ${colorClass}`} />
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colorClass} bg-opacity-10 text-opacity-100`}>
             <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
        </div>
        <div className="text-left z-10">
            <h3 className="font-bold text-lg leading-tight text-gray-900">{title}</h3>
            <p className="text-xs text-gray-500 mt-1">{desc}</p>
        </div>
    </motion.button>
);

const SkeletonLoader = () => (
    <div className="p-6 space-y-6 animate-pulse">
        <div className="flex justify-between items-center mb-8">
            <div className="flex gap-4">
                <div className="w-14 h-14 bg-gray-200 rounded-full"></div>
                <div className="space-y-2">
                    <div className="w-20 h-4 bg-gray-200 rounded"></div>
                    <div className="w-32 h-6 bg-gray-200 rounded"></div>
                </div>
            </div>
        </div>
        <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3].map(i => <div key={i} className="min-w-[150px] h-[130px] bg-gray-200 rounded-2xl"></div>)}
        </div>
        <div className="grid grid-cols-2 gap-4 mt-8">
             {[1, 2, 3, 4].map(i => <div key={i} className="h-[160px] bg-gray-200 rounded-[2rem]"></div>)}
        </div>
    </div>
);

// --- Main Realtime Dashboard ---

export default function StaffDashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState({ pendingOrders: 0, upcomingBookings: 0, lowStock: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false); // For visual feedback during realtime update

    // 1. Fetch Stats Logic (Separated for reuse)
    const fetchStats = useCallback(async (isBackgroundRefresh = false) => {
        if (!isBackgroundRefresh) setRefreshing(true);
        try {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const [pendingResult, bookingResult, stockResult] = await Promise.all([
                // Pending Orders
                supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
                // Upcoming Bookings
                supabase.from('bookings').select('*', { count: 'exact', head: true })
                    .in('status', ['confirmed', 'approved']) 
                    .gte('booking_time', now.toISOString())
                    .lte('booking_time', tomorrow.toISOString()),
                // Stock
                supabase.from('stock_items').select('current_quantity, min_stock_threshold')
            ]);

            let lowStockCount = 0;
            if (stockResult.data) {
                lowStockCount = stockResult.data.filter(i => 
                    (i.current_quantity || 0) <= (i.min_stock_threshold || 5)
                ).length;
            }

            setStats({
                pendingOrders: pendingResult.count || 0,
                upcomingBookings: bookingResult.count || 0,
                lowStock: lowStockCount
            });
        } catch (error) {
            console.error("Stats Fetch Error:", error);
        } finally {
            if (!isBackgroundRefresh) setRefreshing(false);
            setLoading(false);
        }
    }, []);

    // 2. Initial User Load & Setup
    useEffect(() => {
        const initUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUser(user);
                fetchStats(); // Initial stats fetch
            } else {
                navigate('/login');
            }
        };
        initUser();
    }, [navigate, fetchStats]);

    // 3. REALTIME SUBSCRIPTION (The Pro Plan Power) ⚡️
    useEffect(() => {
        // Create a channel for dashboard updates
        const dashboardChannel = supabase
            .channel('dashboard-realtime')
            .on(
                'postgres_changes', 
                { event: '*', schema: 'public', table: 'bookings' }, 
                (payload) => {
                    console.log('Booking change detected:', payload);
                    fetchStats(true); // Refetch stats quietly
                }
            )
            .on(
                'postgres_changes', 
                { event: '*', schema: 'public', table: 'stock_items' }, 
                (payload) => {
                    console.log('Stock change detected:', payload);
                    fetchStats(true); // Refetch stats quietly
                }
            )
            .subscribe();

        // Cleanup on unmount
        return () => {
            supabase.removeChannel(dashboardChannel);
        };
    }, [fetchStats]);

    const handleLogout = async () => {
        setLoading(true);
        localStorage.clear();
        await supabase.auth.signOut();
        navigate('/login');
    };

    if (loading && !user) return <SkeletonLoader />;

    return (
        <div className="min-h-screen bg-[#F8F9FB] text-[#1A1A1A] pb-24 font-sans selection:bg-black selection:text-white">
            
            {/* Header */}
            <header className="px-6 pt-12 pb-6 bg-white rounded-b-[2.5rem] shadow-sm relative z-20">
                <div className="flex justify-between items-start mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gray-900 rounded-full flex items-center justify-center text-white shadow-lg overflow-hidden border-2 border-white">
                            {user?.user_metadata?.avatar_url ? (
                                <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <UserCircle className="w-8 h-8" />
                            )}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-gray-400 text-xs font-medium uppercase tracking-wider flex items-center gap-1">
                                {refreshing && <RefreshCw className="w-3 h-3 animate-spin text-green-500" />}
                                Dashboard Live
                            </span>
                            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                                {user?.user_metadata?.full_name?.split(' ')[0] || 'Staff Member'}
                            </h1>
                        </div>
                    </div>
                    
                    <button onClick={handleLogout} className="w-12 h-12 flex items-center justify-center bg-gray-50 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>

                {/* Stats Row */}
                <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 snap-x hide-scrollbar">
                    <div className="snap-center">
                        <StatCard 
                            title="New Orders" 
                            value={stats.pendingOrders} 
                            subtext="Pending Kitchen" 
                            icon={Bell}
                            loading={refreshing && stats.pendingOrders === 0}
                        />
                    </div>
                    <div className="snap-center">
                        <StatCard 
                            title="Reservations" 
                            value={stats.upcomingBookings} 
                            subtext="Next 24 Hours" 
                            icon={Calendar}
                            loading={refreshing && stats.upcomingBookings === 0}
                        />
                    </div>
                    <div className="snap-center">
                        <StatCard 
                            title="Low Stock" 
                            value={stats.lowStock} 
                            subtext="Items critical" 
                            icon={AlertTriangle}
                            alert={stats.lowStock > 0}
                            loading={refreshing && stats.lowStock === 0}
                        />
                    </div>
                </div>
            </header>

            {/* Main Navigation */}
            <main className="p-6">
                <div className="flex items-center gap-2 mb-6">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                    <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">System Online</h2>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <ActionButton 
                        title="Live Orders" 
                        desc="Kitchen & Bar View" 
                        icon={ClipboardList} 
                        colorClass="bg-blue-600" 
                        onClick={() => navigate('/staff/orders')}
                        delay={1}
                    />
                    <ActionButton 
                        title="Inventory" 
                        desc="Manage Stock" 
                        icon={Package} 
                        colorClass="bg-orange-500" 
                        onClick={() => navigate('/staff/stock')}
                        delay={2}
                    />
                    <ActionButton 
                        title="Check-in" 
                        desc="Scan QR / Seat" 
                        icon={CheckCircle2} 
                        colorClass="bg-emerald-500" 
                        onClick={() => navigate('/staff/checkin')}
                        delay={3}
                    />
                    <ActionButton 
                        title="History" 
                        desc="Past Records" 
                        icon={TrendingUp} 
                        colorClass="bg-purple-600" 
                        onClick={() => navigate('/staff/history')}
                        delay={4}
                    />
                </div>
            </main>

            {/* Floating Alert for Pending Orders */}
            <AnimatePresence>
                {stats.pendingOrders > 0 && (
                    <motion.div 
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-6 left-6 right-6 z-50"
                    >
                        <button 
                            onClick={() => navigate('/staff/orders')}
                            className="w-full bg-[#1A1A1A] text-white p-4 rounded-2xl shadow-xl shadow-black/20 flex items-center justify-between group active:scale-95 transition-transform"
                        >
                            <div className="flex items-center gap-3">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                                <span className="font-semibold">{stats.pendingOrders} Orders Waiting</span>
                            </div>
                            <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-colors">
                                 <ArrowRight className="w-4 h-4" />
                            </div>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Don't forget: import { AnimatePresence } from 'framer-motion';