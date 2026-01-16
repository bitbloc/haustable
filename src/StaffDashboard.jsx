import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabaseClient';
import { 
    ClipboardList, 
    Package, 
    ExternalLink,
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
import usePushNotifications from './hooks/usePushNotifications';
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

const ActionButton = ({ onClick, icon: Icon, title, desc, bgClass, textClass, delay }) => (
    <motion.button 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay * 0.1, duration: 0.4 }}
        onClick={onClick}
        className="relative overflow-hidden bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col items-start gap-4 hover:shadow-lg transition-all active:scale-[0.98] group"
    >
        <div className={`absolute top-0 right-0 w-24 h-24 -mr-6 -mt-6 rounded-full opacity-10 transition-transform group-hover:scale-150 ${bgClass}`} />
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${bgClass} bg-opacity-10`}>
             <Icon className={`w-6 h-6 ${textClass}`} />
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

const ActivityFeed = ({ activities, loading }) => {
    if (loading && activities.length === 0) return (
        <div className="space-y-3">
             {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse"></div>)}
        </div>
    );

    if (activities.length === 0) return <div className="text-gray-400 text-sm text-center py-4">No recent activity</div>;

    return (
        <div className="space-y-3">
            {activities.map((item, idx) => (
                <motion.div 
                    key={`${item.type}-${item.id}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between"
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            item.type === 'stock' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                        }`}>
                            {item.type === 'stock' ? <Package className="w-5 h-5" /> : <ClipboardList className="w-5 h-5" />}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-900">{item.title}</p>
                            <p className="text-xs text-gray-500">{item.subtitle}</p>
                        </div>
                    </div>
                    <div className="text-right">
                         <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                             item.statusColor || 'bg-gray-100 text-gray-600'
                         }`}>
                             {item.status}
                         </span>
                         <p className="text-[10px] text-gray-400 mt-1">{item.time}</p>
                    </div>
                </motion.div>
            ))}
        </div>
    );
};

// --- Main Realtime Dashboard ---

export default function StaffDashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState({ pendingOrders: 0, upcomingBookings: 0, lowStock: 0 });
    const [recentActivity, setRecentActivity] = useState([]); // Added
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false); 
    const { permission, isSubscribed, requestPermission } = usePushNotifications(); 

    // 1. Fetch Stats & Activity Logic 
    const fetchStats = useCallback(async (isBackgroundRefresh = false) => {
        if (!isBackgroundRefresh) setRefreshing(true);
        try {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);

            // Parallel Fetch: Stats + Activity
            const [pendingResult, bookingResult, stockResult, recentStock, recentOrders] = await Promise.all([
                // 1. Stats
                supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
                supabase.from('bookings').select('*', { count: 'exact', head: true })
                    .in('status', ['confirmed', 'approved']) 
                    .gte('booking_time', now.toISOString())
                    .lte('booking_time', tomorrow.toISOString()),
                supabase.from('stock_items').select('current_quantity, min_stock_threshold'),
                
                // 2. Activity - Stock (Last 5)
                supabase.from('stock_transactions').select('*, stock_items(name)').order('created_at', { ascending: false }).limit(5),
                
                // 3. Activity - Orders (Last 5) - Using created_at for relevance (updated_at might be missing)
                supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(5)
            ]);

            // Process Stats
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

            // Process Activity Feed
            const stockActivities = (recentStock.data || []).map(s => ({
                id: s.id,
                type: 'stock',
                title: `${s.transaction_type === 'set' ? 'Set' : (s.quantity_change > 0 ? 'Added' : 'Used')} ${s.stock_items?.name || 'Item'}`,
                subtitle: `by ${s.performed_by || 'Staff'}`,
                status: `${s.quantity_change > 0 ? '+' : ''}${s.quantity_change}`,
                statusColor: s.quantity_change > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
                time: new Date(s.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                timestamp: new Date(s.created_at)
            }));

            const orderActivities = (recentOrders.data || []).map(o => ({
                id: o.id,
                type: 'order',
                title: `Table ${o.tables_layout?.table_name || 'Pickup'}`,
                subtitle: `Order #${o.id.toString().slice(0,4)}`,
                status: o.status,
                statusColor: getStatusColor(o.status),
                time: new Date(o.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                timestamp: new Date(o.created_at)
            }));

            // Merge & Sort
            const merged = [...stockActivities, ...orderActivities]
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 10); // Show top 10

            setRecentActivity(merged);

        } catch (error) {
            console.error("Stats Fetch Error:", error);
        } finally {
            if (!isBackgroundRefresh) setRefreshing(false);
            setLoading(false);
        }
    }, []);

    const getStatusColor = (status) => {
        switch(status) {
            case 'pending': return 'bg-yellow-100 text-yellow-700';
            case 'confirmed': return 'bg-blue-100 text-blue-700';
            case 'completed': return 'bg-green-100 text-green-700';
            case 'cancelled': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    // 2. Initial User Load & Setup
    useEffect(() => {
        const initUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUser(user);
                fetchStats(); // Initial stats fetch
            } 
            // Layout handles redirect if not logged in
        };
        initUser();
    }, [fetchStats]);

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
                    fetchStats(true); 
                }
            )
            .on(
                'postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'stock_transactions' }, 
                (payload) => {
                    console.log('Transaction detected:', payload);
                    fetchStats(true); 
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
                    
                    <div className="flex gap-2">
                        <button 
                            onClick={() => window.location.href = '/booking'}
                            className="w-12 h-12 flex items-center justify-center bg-gray-50 rounded-full hover:bg-blue-50 hover:text-blue-500 transition-colors"
                            title="Go to Live Booking"
                        >
                            <ExternalLink className="w-5 h-5" />
                        </button>
                        <button onClick={handleLogout} className="w-12 h-12 flex items-center justify-center bg-gray-50 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors">
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Stats Row */}
                {/* Stats Grid (Bento Style) */}
                <div className="grid grid-cols-2 gap-3 px-6 pb-4">
                    <div className="rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <StatCard 
                            title="New Orders" 
                            value={stats.pendingOrders} 
                            subtext="Pending Kitchen" 
                            icon={Bell}
                            loading={refreshing && stats.pendingOrders === 0}
                        />
                    </div>
                    <div className="rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <StatCard 
                            title="Reservations" 
                            value={stats.upcomingBookings} 
                            subtext="Next 24 Hours" 
                            icon={Calendar}
                            loading={refreshing && stats.upcomingBookings === 0}
                        />
                    </div>
                    {/* Full Width for Low Stock */}
                    <div className="col-span-2 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className="h-full">
                            <StatCard 
                                title="Low Stock" 
                                value={stats.lowStock} 
                                subtext="Items critical (Need Restock)" 
                                icon={AlertTriangle}
                                alert={stats.lowStock > 0}
                                loading={refreshing && stats.lowStock === 0}
                            />
                        </div>
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
                        bgClass="bg-blue-600"
                        textClass="text-blue-600"
                        onClick={() => navigate('/staff/orders')}
                        delay={1}
                    />
                    <ActionButton 
                        title="Inventory" 
                        desc="Manage Stock" 
                        icon={Package} 
                        bgClass="bg-orange-500"
                        textClass="text-orange-600"
                        onClick={() => navigate('/staff/stock')}
                        delay={2}
                    />
                    <ActionButton 
                        title="Check-in" 
                        desc="Scan QR / Seat" 
                        icon={CheckCircle2} 
                        bgClass="bg-emerald-500"
                        textClass="text-emerald-600"
                        onClick={() => navigate('/staff/checkin')}
                        delay={3}
                    />
                    <ActionButton 
                        title="History" 
                        desc="Past Records" 
                        icon={TrendingUp} 
                        bgClass="bg-purple-600"
                        textClass="text-purple-600"
                        onClick={() => navigate('/staff/history')}
                        delay={4}
                    />
                    <ActionButton 
                        title="Notifications" 
                        desc={isSubscribed ? 'Active' : 'Enable Push'} 
                        icon={Bell} 
                        bgClass={isSubscribed ? "bg-green-600" : "bg-gray-500"}
                        textClass={isSubscribed ? "text-green-600" : "text-gray-600"}
                        onClick={requestPermission}
                        delay={5}
                    />
                </div>

                {/* Recent Activity Feed */}
                <div className="mt-8">
                     <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">Recent Activity</h2>
                        <button onClick={() => fetchStats(false)} className="text-gray-400 hover:text-gray-600">
                             <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                     </div>
                     <ActivityFeed activities={recentActivity} loading={loading} />
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