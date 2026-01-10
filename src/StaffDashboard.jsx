import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { 
    ClipboardList, 
    Package, 
    QrCode, 
    LogOut, 
    ChefHat, 
    Users, 
    Calendar,
    ArrowRight,
    Search,
    UserCircle,
    Bell,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function StaffDashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState({
        pendingOrders: 0,
        upcomingBookings: 0,
        lowStock: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUserAndStats = async () => {
            setLoading(true);
            try {
                // Parallel Fetching
                const [
                    { data: { user } },
                    { count: pendingCount },
                    { count: bookingCount },
                    { data: items }
                ] = await Promise.all([
                    // 1. User
                    supabase.auth.getUser(),
                    
                    // 2. Pending Orders
                    supabase
                        .from('bookings')
                        .select('*', { count: 'exact', head: true })
                        .eq('status', 'pending'),

                    // 3. Upcoming Bookings
                    (async () => {
                         const now = new Date();
                         const tomorrow = new Date(now);
                         tomorrow.setHours(now.getHours() + 24);
                         return supabase
                            .from('bookings')
                            .select('*', { count: 'exact', head: true })
                            .in('status', ['confirmed', 'approved']) 
                            .gte('booking_time', now.toISOString())
                            .lte('booking_time', tomorrow.toISOString());
                    })(),

                    // 4. Stock Items (Lightweight fetch)
                    supabase
                        .from('stock_items')
                        .select('current_quantity, min_stock_threshold')
                        // Optional: .lt('current_quantity', 10) // Optimization: Only fetch items < 10 to reduce payload if we assume threshold isn't > 10? 
                        // But min_stock_threshold can be anything. Let's fetch all for safety, but minimal columns.
                ]);

                setUser(user);

                let lowStockCount = 0;
                if (items) {
                    lowStockCount = items.filter(i => 
                        (i.current_quantity || 0) < 1.5 || 
                        (i.current_quantity || 0) <= (i.min_stock_threshold || 0)
                    ).length;
                }

                setStats({
                    pendingOrders: pendingCount || 0,
                    upcomingBookings: bookingCount || 0,
                    lowStock: lowStockCount
                });

            } catch (error) {
                console.error("Dashboard Load Error:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserAndStats();
        
        // Polling for stats every 30s
        const interval = setInterval(fetchUserAndStats, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.reload();
    };

    return (
        <div className="min-h-screen bg-[#F8F9FB] text-[#1A1A1A] pb-20 font-sans">
            {/* Header */}
            <div className="bg-white px-6 pt-12 pb-6 rounded-b-[2.5rem] shadow-sm relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                     <ChefHat className="w-64 h-64 -translate-y-12 translate-x-12" />
                 </div>
                 
                 <div className="relative z-10 flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-14 h-14 bg-gradient-to-br from-[#1A1A1A] to-[#333] rounded-2xl flex items-center justify-center text-white shadow-xl shadow-black/10">
                            {user?.user_metadata?.avatar_url ? (
                                <img src={user.user_metadata.avatar_url} className="w-full h-full object-cover rounded-2xl" />
                            ) : (
                                <UserCircle className="w-8 h-8" />
                            )}
                        </div>
                        <div>
                            <p className="text-gray-500 text-sm font-medium">Have a great shift,</p>
                            <h1 className="text-2xl font-bold tracking-tight">
                                {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Staff'}
                            </h1>
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleLogout}
                        className="p-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-gray-500 hover:text-red-500 transition-all"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                 </div>

                 {/* Stats Cards Row */}
                 <div className="flex gap-4 overflow-x-auto pb-2 -mx-6 px-6 hide-scrollbar">
                    <div className="min-w-[140px] bg-[#1A1A1A] text-white p-4 rounded-2xl flex flex-col justify-between h-[120px] shadow-lg shadow-black/10 relative overflow-hidden">
                        <div className="absolute right-[-10px] top-[-10px] opacity-10"><Bell className="w-16 h-16"/></div>
                        <span className="text-white/70 text-sm font-medium">New Orders</span>
                        <div className="flex items-end gap-2">
                             <span className="text-4xl font-bold">{stats.pendingOrders}</span>
                             <span className="text-xs mb-1.5 text-white/50">pending</span>
                        </div>
                    </div>
                    
                    <div className="min-w-[140px] bg-white border border-gray-100 p-4 rounded-2xl flex flex-col justify-between h-[120px] shadow-sm">
                        <span className="text-gray-500 text-sm font-medium">Upcoming</span>
                        <div className="flex items-end gap-2">
                             <span className="text-4xl font-bold text-[#1A1A1A]">{stats.upcomingBookings}</span>
                             <span className="text-xs mb-1.5 text-gray-400">bookings</span>
                        </div>
                    </div>

                    <div className="min-w-[140px] bg-white border border-gray-100 p-4 rounded-2xl flex flex-col justify-between h-[120px] shadow-sm">
                        <span className="text-gray-500 text-sm font-medium">Low Stock</span>
                        <div className="flex items-end gap-2">
                             <span className={`text-4xl font-bold ${stats.lowStock > 0 ? 'text-red-500' : 'text-green-500'}`}>{stats.lowStock}</span>
                             <span className="text-xs mb-1.5 text-gray-400">items</span>
                        </div>
                    </div>
                 </div>
            </div>

            {/* Main Navigation */}
            <div className="p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-[#1A1A1A] rounded-full"></span>
                    Quick Access
                </h2>
                
                <div className="grid grid-cols-2 gap-4">
                    {/* Live View */}
                    <button 
                        onClick={() => navigate('/staff/orders')}
                        className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-start gap-4 hover:shadow-md transition-all active:scale-95 group relative overflow-hidden"
                    >
                        <div className="absolute right-0 top-0 p-8 bg-blue-50 rounded-bl-[4rem] group-hover:bg-blue-100 transition-colors">
                            <ClipboardList className="w-8 h-8 text-blue-600 absolute top-4 right-4" />
                        </div>
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                            <ClipboardList className="w-6 h-6" />
                        </div>
                        <div className="text-left mt-2">
                            <h3 className="font-bold text-lg leading-tight mb-1">Live<br/>Orders</h3>
                            <p className="text-xs text-gray-400">Kitchen & Bar View</p>
                        </div>
                    </button>

                    {/* Stock */}
                    <button 
                        onClick={() => navigate('/staff/stock')}
                        className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-start gap-4 hover:shadow-md transition-all active:scale-95 group relative overflow-hidden"
                    >
                         <div className="absolute right-0 top-0 p-8 bg-orange-50 rounded-bl-[4rem] group-hover:bg-orange-100 transition-colors">
                            <Package className="w-8 h-8 text-orange-600 absolute top-4 right-4" />
                        </div>
                        <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center">
                            <Package className="w-6 h-6" />
                        </div>
                        <div className="text-left mt-2">
                            <h3 className="font-bold text-lg leading-tight mb-1">Stock<br/>Manage</h3>
                            <p className="text-xs text-gray-400">Update inventory</p>
                        </div>
                    </button>

                    {/* Check In */}
                     <button 
                        onClick={() => {
                            // Link to Check-in scanner or page? 
                            // User mentioned "Check-in" button.
                            // Currently we don't have a dedicated staff check-in page for customers except logic in Live Orders (Seated).
                            // Or maybe the User means "Staff Login"? No, they are already logged in.
                            // "checkin customer" -> Maybe /staff/orders/checkin ?
                            // Or maybe open scanner?
                            // For now navigate to /staff/orders?tab=live?
                            // Let's create a placeholder action or just link to Orders page with Checkin intent.
                            navigate('/staff/orders');
                        }}
                        className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-start gap-4 hover:shadow-md transition-all active:scale-95 group relative overflow-hidden"
                    >
                        <div className="absolute right-0 top-0 p-8 bg-green-50 rounded-bl-[4rem] group-hover:bg-green-100 transition-colors">
                            <CheckCircle2 className="w-8 h-8 text-green-600 absolute top-4 right-4" />
                        </div>
                         <div className="w-12 h-12 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div className="text-left mt-2">
                            <h3 className="font-bold text-lg leading-tight mb-1">Check-in</h3>
                            <p className="text-xs text-gray-400">Customer Arrival</p>
                        </div>
                    </button>

                    {/* History / Report */}
                     <button 
                         onClick={() => navigate('/staff/orders')} // TODO: Pass tab=history
                        className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-start gap-4 hover:shadow-md transition-all active:scale-95 group relative overflow-hidden"
                    >
                        <div className="absolute right-0 top-0 p-8 bg-purple-50 rounded-bl-[4rem] group-hover:bg-purple-100 transition-colors">
                            <Calendar className="w-8 h-8 text-purple-600 absolute top-4 right-4" />
                        </div>
                         <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <div className="text-left mt-2">
                            <h3 className="font-bold text-lg leading-tight mb-1">History</h3>
                            <p className="text-xs text-gray-400">Past orders</p>
                        </div>
                    </button>

                </div>
            </div>

            {/* Quick Actions Footer? */}
            <div className="px-6 mt-4">
                 <div className="bg-[#1A1A1A] rounded-2xl p-4 flex items-center justify-between text-white shadow-xl shadow-black/20"
                      onClick={() => navigate('/staff/orders')} // Quick jump to live
                 >
                     <div className="flex items-center gap-3">
                         <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                         <span className="font-bold">Live Board</span>
                     </div>
                     <ArrowRight className="w-5 h-5 text-gray-400" />
                 </div>
            </div>

        </div>
    );
}
