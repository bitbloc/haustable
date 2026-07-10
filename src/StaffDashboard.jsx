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
    RefreshCw,
    Users,
    UtensilsCrossed,
    BookOpen
} from 'lucide-react';
import usePushNotifications from './hooks/usePushNotifications';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import StaffAttendanceModal from './components/staff/StaffAttendanceModal';
import './StaffDashboard.css';
import { toast } from 'sonner';

// --- Sub-Components ---

const StatBlock = ({ label, value, subtext, alert, loading }) => (
    <div className={`sd-stat ${alert ? 'sd-stat--alert' : ''}`}>
        <span className="sd-stat__label">{label}</span>
        {loading ? (
            <div className="sd-skeleton__block sd-skeleton__block--stat" />
        ) : (
            <motion.span 
                key={value}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
                className="sd-stat__value"
            >
                {value}
            </motion.span>
        )}
        <span className="sd-stat__sub">{subtext}</span>
    </div>
);

const FunctionButton = ({ onClick, icon: Icon, title, desc, badge }) => (
    <button className="sd-fn" onClick={onClick}>
        <span className="sd-fn__icon">
            <Icon />
        </span>
        <span className="sd-fn__info">
            <span className="sd-fn__title">{title}</span>
            <span className="sd-fn__desc">{desc}</span>
        </span>
        {badge && <span className="sd-fn__badge">{badge}</span>}
    </button>
);

const SkeletonLoader = () => (
    <div className="staff-dash sd-skeleton">
        <div className="sd-skeleton__bar" />
        <div className="sd-skeleton__stats">
            {[1, 2, 3].map(i => (
                <div key={i} className="sd-skeleton__stat">
                    <div className="sd-skeleton__block sd-skeleton__block--wide" />
                    <div className="sd-skeleton__block sd-skeleton__block--stat" />
                </div>
            ))}
        </div>
        <div style={{ padding: '16px 24px 8px' }}>
            <div className="sd-skeleton__block" style={{ width: '80px', marginBottom: '12px' }} />
        </div>
        <div className="sd-skeleton__grid">
            {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="sd-skeleton__cell">
                    <div className="sd-skeleton__block" style={{ width: '70%', marginBottom: '6px' }} />
                    <div className="sd-skeleton__block" style={{ width: '40%' }} />
                </div>
            ))}
        </div>
    </div>
);

const getStatusClass = (status) => {
    switch(status) {
        case 'pending': return 'sd-activity__status--pending';
        case 'confirmed': return 'sd-activity__status--confirmed';
        case 'completed': return 'sd-activity__status--completed';
        case 'cancelled': return 'sd-activity__status--cancelled';
        default: return 'sd-activity__status--pending';
    }
};

const getStatusColor = (status) => {
    switch(status) {
        case 'pending': return 'bg-yellow-100 text-yellow-700';
        case 'confirmed': return 'bg-blue-100 text-blue-700';
        case 'completed': return 'bg-green-100 text-green-700';
        case 'cancelled': return 'bg-red-100 text-red-700';
        default: return 'bg-gray-100 text-gray-600';
    }
};

// --- Main Realtime Dashboard ---

export default function StaffDashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState({ pendingOrders: 0, upcomingBookings: 0, lowStock: 0 });
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false); 
    const [showAttendanceModal, setShowAttendanceModal] = useState(false);
    const { permission, isSubscribed, requestPermission } = usePushNotifications(); 

    const [tablesMap, setTablesMap] = useState({});

    useEffect(() => {
        const loadTablesMap = async () => {
            const { data } = await supabase.from('tables_layout').select('id, table_name');
            if (data) {
                const mapping = {};
                data.forEach(t => {
                    mapping[t.id] = t.table_name;
                });
                setTablesMap(mapping);
            }
        };
        loadTablesMap();
    }, []);

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
                supabase.from('stock_items').select('current_quantity, min_stock_threshold, reorder_point'),
                
                // 2. Activity - Stock (Last 5)
                supabase.from('stock_transactions').select('*, stock_items(name)').order('created_at', { ascending: false }).limit(5),
                
                // 3. Activity - Orders (Last 5) - Using created_at for relevance (updated_at might be missing)
                supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(5)
            ]);

            // Process Stats
            let lowStockCount = 0;
            if (stockResult.data) {
                lowStockCount = stockResult.data.filter(i => {
                    const qty = Number(i.current_quantity) || 0;
                    const min = Number(i.min_stock_threshold) || 0;
                    const reorder = Number(i.reorder_point) || 0;
                    
                    // Match the logic in StockPage.jsx (Restock Tab)
                    // Trigger if stock reaches or falls below either set threshold, or is out of stock
                    return (reorder > 0 && qty <= reorder + 0.0001) || 
                           (min > 0 && qty <= min + 0.0001) || 
                           (qty <= 0);
                }).length;
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
                statusType: s.quantity_change > 0 ? 'positive' : 'negative',
                time: new Date(s.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                timestamp: new Date(s.created_at)
            }));

            const orderActivities = (recentOrders.data || []).map(o => ({
                id: o.id,
                type: 'order',
                title: `Table ${o.tables_layout?.table_name || 'Pickup'}`,
                subtitle: `Order #${o.id.toString().slice(0,4)}`,
                status: o.status,
                statusType: o.status,
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

    // 3. REALTIME SUBSCRIPTION ⚡️
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

    const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Staff';

    return (
        <div className="staff-dash">
            
            {/* ── Header Bar ── */}
            <header className="sd-header">
                <div className="sd-header__left">
                    <img 
                        src="/logo-staff-light.png" 
                        alt="In the haus Staff" 
                        className="sd-header__logo" 
                    />
                    <span className="sd-header__divider" aria-hidden="true" />
                    <div className="sd-header__user">
                        <span className="sd-header__label">Dashboard</span>
                        <span className="sd-header__name">{firstName}</span>
                    </div>
                </div>

                <div className="sd-header__actions">
                    <button 
                        className="sd-header__btn"
                        onClick={() => window.location.href = '/booking'}
                        title="Live Booking"
                        aria-label="Go to live booking page"
                    >
                        <ExternalLink />
                    </button>
                    <button 
                        className="sd-header__btn sd-header__btn--danger"
                        onClick={handleLogout}
                        title="Sign Out"
                        aria-label="Sign out"
                    >
                        <LogOut />
                    </button>
                </div>
            </header>

            {/* ── Live Indicator ── */}
            <div className="sd-live">
                <span className="sd-live__dot sd-live__dot--pulse" aria-hidden="true" />
                <span className="sd-live__text">System Online</span>
                <button 
                    className={`sd-live__refresh ${refreshing ? 'sd-live__refresh--spinning' : ''}`}
                    onClick={() => fetchStats(false)}
                    title="Refresh data"
                    aria-label="Refresh dashboard data"
                >
                    <RefreshCw />
                </button>
            </div>

            {/* ── Stats Strip ── */}
            <div className="sd-stats" role="region" aria-label="Dashboard statistics">
                <StatBlock 
                    label="Orders" 
                    value={stats.pendingOrders} 
                    subtext="Pending" 
                    loading={refreshing && stats.pendingOrders === 0}
                />
                <StatBlock 
                    label="Bookings" 
                    value={stats.upcomingBookings} 
                    subtext="Next 24h" 
                    loading={refreshing && stats.upcomingBookings === 0}
                />
                <StatBlock 
                    label="Low Stock" 
                    value={stats.lowStock} 
                    subtext="Need Restock" 
                    alert={stats.lowStock > 0}
                    loading={refreshing && stats.lowStock === 0}
                />
            </div>

            {/* ── Functions ── */}
            <div className="sd-section-label">Functions</div>
            <nav className="sd-functions" role="navigation" aria-label="Staff functions">
                <FunctionButton 
                    title="Live Orders" 
                    desc="Kitchen \u0026 Bar" 
                    icon={ClipboardList} 
                    onClick={() => navigate('/staff/orders')}
                />
                <FunctionButton 
                    title="Inventory" 
                    desc="Stock Levels" 
                    icon={Package} 
                    onClick={() => navigate('/staff/stock')}
                />
                <FunctionButton 
                    title="Attendance" 
                    desc="Time \u0026 Leaves" 
                    icon={Users} 
                    onClick={() => setShowAttendanceModal(true)}
                />
                <FunctionButton 
                    title="Check-in" 
                    desc="Scan QR" 
                    icon={CheckCircle2} 
                    onClick={() => navigate('/staff/checkin')}
                />
                <FunctionButton 
                    title="History" 
                    desc="Past Records" 
                    icon={TrendingUp} 
                    onClick={() => navigate('/staff/history')}
                />
                <FunctionButton 
                    title="POS" 
                    desc="Point of Sale" 
                    icon={UtensilsCrossed} 
                    onClick={() => navigate('/pos')}
                />
                <FunctionButton 
                    title="Bar SOP" 
                    desc="Recipes" 
                    icon={BookOpen} 
                    onClick={() => navigate('/staff/sop')}
                />
                <FunctionButton 
                    title="Notifications" 
                    desc={isSubscribed ? 'Active' : 'Enable'} 
                    icon={Bell} 
                    onClick={requestPermission}
                    badge={isSubscribed ? '●' : null}
                />
            </nav>

            {/* ── Recent Activity ── */}
            <div className="sd-activity">
                <div className="sd-section-label">Activity Log</div>
                
                {loading && recentActivity.length === 0 ? (
                    <div style={{ padding: '0 24px' }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} className="sd-activity__item">
                                <div className="sd-skeleton__block" style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                    <div className="sd-skeleton__block" style={{ width: '60%', marginBottom: '4px' }} />
                                    <div className="sd-skeleton__block" style={{ width: '30%' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : recentActivity.length === 0 ? (
                    <div className="sd-activity__empty">No recent activity</div>
                ) : (
                    <ul className="sd-activity__list">
                        {recentActivity.map((item) => (
                            <li key={`${item.type}-${item.id}`} className="sd-activity__item">
                                <span 
                                    className={`sd-activity__type sd-activity__type--${item.type}`} 
                                    aria-hidden="true" 
                                />
                                <div className="sd-activity__content">
                                    <div className="sd-activity__title">{item.title}</div>
                                    <div className="sd-activity__subtitle">{item.subtitle}</div>
                                </div>
                                <div className="sd-activity__meta">
                                    <span className={`sd-activity__status ${
                                        item.type === 'stock' 
                                            ? (item.statusType === 'positive' ? 'sd-activity__status--positive' : 'sd-activity__status--negative')
                                            : getStatusClass(item.statusType)
                                    }`}>
                                        {item.status}
                                    </span>
                                    <span className="sd-activity__time">{item.time}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* ── Floating Alert for Pending Orders ── */}
            <AnimatePresence>
                {stats.pendingOrders > 0 && (
                    <motion.div 
                        initial={{ y: 80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 80, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        className="sd-alert-bar"
                    >
                        <button 
                            onClick={() => navigate('/pos?autoSelect=pending')}
                            className="sd-alert-bar__btn"
                        >
                            <span className="sd-alert-bar__left">
                                <span className="sd-alert-bar__ping" aria-hidden="true" />
                                <span>{stats.pendingOrders} Orders Waiting</span>
                            </span>
                            <ArrowRight className="sd-alert-bar__arrow" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modals */}
            <StaffAttendanceModal 
                isOpen={showAttendanceModal} 
                onClose={() => setShowAttendanceModal(false)} 
            />
        </div>
    );
}