import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { motion } from 'framer-motion';
import { posCache, isOnline } from '../utils/offlineHelper';
import { 
    ReceiptText, 
    Search, 
    Clock, 
    User, 
    ShoppingBag, 
    Utensils, 
    AlertCircle, 
    CreditCard, 
    Send,
    ChevronRight,
    RefreshCw,
    Ban,
    FileText,
    Image as ImageIcon
} from 'lucide-react';
import ViewSlipModal from '../components/shared/ViewSlipModal';
import { getShortBookingId } from '../utils/printerHelper';

export default function POSOpenBillsGrid({ onSelectOrder, onOpenSlip, refreshKey }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [channelFilter, setChannelFilter] = useState('all'); // 'all', 'table', 'pickup', 'walk_in'
    const [statusMode, setStatusMode] = useState('active'); // 'active', 'stale', 'void', 'all'
    const [unsentOnly, setUnsentOnly] = useState(false);
    const [viewSlipUrl, setViewSlipUrl] = useState(null);

    const fetchOpenBills = async () => {
        try {
            setLoading(true);
            if (!isOnline()) {
                const cachedBookings = posCache.getBookings() || [];
                setOrders(cachedBookings);
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('bookings')
                .select('*, tables_layout(*), profiles(*), order_items(*, menu_items(name, category_id, is_drink_stamp_eligible, menu_categories(name)))')
                .in('status', ['pending', 'confirmed', 'seated', 'ready', 'void', 'cancelled'])
                .order('booking_time', { ascending: false });

            if (error) throw error;

            setOrders(data || []);
        } catch (err) {
            console.error('Failed to fetch open & voided bills:', err);
            try {
                const cachedBookings = posCache.getBookings() || [];
                setOrders(cachedBookings);
            } catch (e) {}
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOpenBills();

        const openBillsSub = supabase.channel('pos-open-bills-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
                fetchOpenBills();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
                fetchOpenBills();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(openBillsSub);
        };
    }, [refreshKey]);

    // Active & Stale (>48h) bills (filtering out empty 0-item ghost pickup bills)
    const activeOrders = orders.filter(o => {
        if (o.status === 'completed' || o.status === 'void' || o.status === 'cancelled') return false;
        const isGhostPickup = (!o.table_id || o.booking_type === 'pickup') && 
                              (!o.order_items || o.order_items.length === 0) && 
                              (!o.total_amount || o.total_amount === 0);
        return !isGhostPickup;
    });
    const voidOrders = orders.filter(o => o.status === 'void' || o.status === 'cancelled');
    const staleOrders = activeOrders.filter(o => {
        const startMins = Math.max(0, Math.floor((Date.now() - new Date(o.booking_time).getTime()) / 60000));
        return startMins >= 2880; // >48h (2 days)
    });

    // Calculate metrics
    const totalOpenBills = activeOrders.length;
    const totalUnclearedAmount = activeOrders.reduce((sum, order) => {
        const itemsTotal = (order.order_items || []).reduce((iSum, item) => iSum + ((item.price_at_time || item.price || 0) * (item.quantity || 1)), 0);
        return sum + (order.total_amount || itemsTotal);
    }, 0);

    const totalVoidCount = voidOrders.length;
    const totalVoidAmount = voidOrders.reduce((sum, order) => {
        const itemsTotal = (order.order_items || []).reduce((iSum, item) => iSum + ((item.price_at_time || item.price || 0) * (item.quantity || 1)), 0);
        return sum + (order.total_amount || itemsTotal);
    }, 0);

    const unsentKitchenCount = activeOrders.filter(order => {
        return (order.order_items || []).some(item => 
            item.status === 'pending' || 
            (!item.db_id && typeof item.id === 'string' && item.id.startsWith('local_'))
        );
    }).length;

    const filteredOrders = orders.filter(order => {
        const isVoid = order.status === 'void' || order.status === 'cancelled';
        const startMins = Math.max(0, Math.floor((Date.now() - new Date(order.booking_time).getTime()) / 60000));
        const isStale = startMins >= 2880;
        
        const isGhostPickup = (!order.table_id || order.booking_type === 'pickup') && 
                              (!order.order_items || order.order_items.length === 0) && 
                              (!order.total_amount || order.total_amount === 0);

        // Status mode filter
        if (statusMode === 'active' && (isVoid || isGhostPickup)) return false;
        if (statusMode === 'void' && !isVoid) return false;
        if (statusMode === 'stale' && (!isStale || isVoid)) return false;

        // Channel filter
        if (channelFilter === 'table' && !order.table_id) return false;
        if (channelFilter === 'pickup' && order.booking_type !== 'pickup') return false;
        if (channelFilter === 'walk_in' && (order.table_id || order.booking_type === 'pickup')) return false;

        // Unsent filter
        if (unsentOnly) {
            const hasUnsent = (order.order_items || []).some(item => 
                item.status === 'pending' || 
                (!item.db_id && typeof item.id === 'string' && item.id.startsWith('local_'))
            );
            if (!hasUnsent) return false;
        }

        // Search query
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim().replace(/^#/, '');
        const shortId = getShortBookingId(order).toLowerCase();
        const tokenStr = (order.tracking_token || '').toLowerCase();
        const tableName = order.tables_layout?.table_name?.toLowerCase() || '';
        const custName = (order.profiles?.display_name || order.customer_name || order.pickup_contact_name || order.customer_note || '').toLowerCase();
        const remark = (order.staff_remark || '').toLowerCase();
        const idStr = String(order.id).toLowerCase();
        const itemsList = order.order_items || [];
        const itemsStr = itemsList.map(i => i.menu_items?.name || i.name || '').join(' ').toLowerCase();

        return tableName.includes(q) || custName.includes(q) || remark.includes(q) || idStr.includes(q) || tokenStr.includes(q) || shortId.includes(q) || itemsStr.includes(q);
    });

    const formatElapsedTime = (isoString) => {
        if (!isoString) return '';
        const diffMs = new Date() - new Date(isoString);
        const diffMins = Math.max(0, Math.floor(diffMs / 60000));
        if (diffMins < 60) return `${diffMins}m ago`;
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${hours}h ${mins}m ago`;
    };

    return (
        <div className="h-full flex flex-col bg-[#ECECE9] overflow-hidden select-none font-sans text-[#1A1A1A]">
            
            {/* Header Toolbar & Summary Cards */}
            <div className="p-4 bg-[#F5F5F2] border-b border-[#D1D1CD] flex flex-col gap-3 shrink-0 shadow-sm">
                {/* Metrics Summary Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
                    <div className="bg-white border border-[#D1D1CD] p-3 rounded-xl flex flex-col justify-between shadow-xs">
                        <div className="text-[10px] text-[#767673] font-bold uppercase tracking-wider">OPEN BILLS / บิลค้างชำระ</div>
                        <div className="text-xl font-bold text-[#1A1A1A] mt-1 flex items-baseline justify-between">
                            <span>{totalOpenBills}</span>
                            <span className="text-[10px] font-normal text-[#767673]">active orders</span>
                        </div>
                    </div>

                    <div className="bg-white border border-[#D1D1CD] p-3 rounded-xl flex flex-col justify-between shadow-xs">
                        <div className="text-[10px] text-[#767673] font-bold uppercase tracking-wider">OUTSTANDING / ยอดรอเคลียร์</div>
                        <div className="text-xl font-bold text-[oklch(52%_0.16_28)] mt-1 flex items-baseline justify-between">
                            <span>฿{totalUnclearedAmount.toLocaleString()}</span>
                            <span className="text-[10px] font-normal text-[#767673]">THB total</span>
                        </div>
                    </div>

                    <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex flex-col justify-between shadow-xs text-red-900">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-red-700">VOIDED / บิลยกเลิก (VOID)</div>
                        <div className="text-xl font-bold mt-1 flex items-baseline justify-between">
                            <span className="text-red-700">{totalVoidCount}</span>
                            <span className="text-[10px] font-mono text-red-600 font-normal">฿{totalVoidAmount.toLocaleString()}</span>
                        </div>
                    </div>

                    <div className={`border p-3 rounded-xl flex flex-col justify-between shadow-xs transition-colors ${
                        unsentKitchenCount > 0 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-white border-[#D1D1CD]'
                    }`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#767673]">UNSENT KITCHEN / ยังไม่ส่งครัว</div>
                        <div className="text-xl font-bold mt-1 flex items-baseline justify-between">
                            <span className={unsentKitchenCount > 0 ? 'text-amber-600 font-extrabold' : 'text-[#1A1A1A]'}>
                                {unsentKitchenCount}
                            </span>
                            <span className="text-[10px] font-normal text-[#767673]">orders pending</span>
                        </div>
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col md:flex-row gap-3 items-center justify-between pt-1">
                    {/* Search Input */}
                    <div className="relative w-full md:w-60">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#767673]" size={15} />
                        <input 
                            type="search" 
                            placeholder="ค้นหาเลขโต๊ะ, ชื่อลูกค้า, บิล..." 
                            className="w-full bg-white border border-[#D1D1CD] rounded-lg py-2 pl-9 pr-4 text-xs text-[#1A1A1A] placeholder-[#767673] focus:outline-none focus:border-black font-medium transition-colors"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Status & Channel Filters */}
                    <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto font-mono text-[10px] font-bold uppercase tracking-wider scrollbar-none">
                        {/* Status Toggle (ACTIVE / STALE / VOID / ALL) */}
                        <div className="flex bg-[#E0E0DC] p-0.5 rounded-lg border border-[#D1D1CD]">
                            <button 
                                type="button"
                                onClick={() => setStatusMode('active')}
                                className={`px-2.5 py-1.5 rounded-md transition-all cursor-pointer ${statusMode === 'active' ? 'bg-white text-[#1A1A1A] shadow-xs' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                            >
                                ACTIVE ({activeOrders.length})
                            </button>
                            <button 
                                type="button"
                                onClick={() => setStatusMode('stale')}
                                className={`px-2.5 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${statusMode === 'stale' ? 'bg-amber-600 text-white shadow-xs font-extrabold' : 'text-amber-800 hover:text-amber-950 font-bold'}`}
                            >
                                ⚠️ ค้าง (&gt;2วัน) ({staleOrders.length})
                            </button>
                            <button 
                                type="button"
                                onClick={() => setStatusMode('void')}
                                className={`px-2.5 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${statusMode === 'void' ? 'bg-red-600 text-white shadow-xs' : 'text-red-700 hover:text-red-900'}`}
                            >
                                <Ban size={10} /> VOID ({voidOrders.length})
                            </button>
                            <button 
                                type="button"
                                onClick={() => setStatusMode('all')}
                                className={`px-2.5 py-1.5 rounded-md transition-all cursor-pointer ${statusMode === 'all' ? 'bg-white text-[#1A1A1A] shadow-xs' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                            >
                                ALL ({orders.length})
                            </button>
                        </div>

                        {/* Channel Selector */}
                        <div className="flex bg-[#E0E0DC] p-0.5 rounded-lg border border-[#D1D1CD]">
                            <button 
                                type="button"
                                onClick={() => setChannelFilter('all')}
                                className={`px-2 py-1.5 rounded-md transition-all cursor-pointer ${channelFilter === 'all' ? 'bg-white text-[#1A1A1A] shadow-xs' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                            >
                                ALL CHANNELS
                            </button>
                            <button 
                                type="button"
                                onClick={() => setChannelFilter('table')}
                                className={`px-2 py-1.5 rounded-md transition-all cursor-pointer ${channelFilter === 'table' ? 'bg-white text-[#1A1A1A] shadow-xs' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                            >
                                DINE-IN
                            </button>
                            <button 
                                type="button"
                                onClick={() => setChannelFilter('pickup')}
                                className={`px-2 py-1.5 rounded-md transition-all cursor-pointer ${channelFilter === 'pickup' ? 'bg-white text-[#1A1A1A] shadow-xs' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                            >
                                PICK-UP
                            </button>
                            <button 
                                type="button"
                                onClick={() => setChannelFilter('walk_in')}
                                className={`px-2 py-1.5 rounded-md transition-all cursor-pointer ${channelFilter === 'walk_in' ? 'bg-white text-[#1A1A1A] shadow-xs' : 'text-[#767673] hover:text-[#1A1A1A]'}`}
                            >
                                DIRECT
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => setUnsentOnly(prev => !prev)}
                            className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                                unsentOnly 
                                ? 'bg-amber-500 border-amber-600 text-white font-bold shadow-xs' 
                                : 'bg-white border-[#D1D1CD] text-[#767673] hover:text-[#1A1A1A]'
                            }`}
                        >
                            <Send size={11} /> UNSENT ONLY
                        </button>

                        <button
                            type="button"
                            onClick={fetchOpenBills}
                            className="p-1.5 bg-white border border-[#D1D1CD] rounded-lg text-[#767673] hover:text-[#1A1A1A] transition-colors cursor-pointer"
                            title="Refresh Open & Voided Bills"
                        >
                            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Bills Grid */}
            <div className="flex-1 p-5 overflow-y-auto scrollbar-none">
                {loading && orders.length === 0 ? (
                    <div className="flex flex-col h-full items-center justify-center text-[#767673] gap-2">
                        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#1A1A1A]"></div>
                        <span className="font-mono text-xs font-bold uppercase tracking-wider">Loading open and voided bills...</span>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="flex flex-col h-64 items-center justify-center text-[#767673] gap-2 font-mono text-xs font-bold uppercase tracking-wider">
                        <AlertCircle size={24} />
                        <span>No bills match current filter criteria</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                        {filteredOrders.map((order) => {
                            const isVoid = order.status === 'void' || order.status === 'cancelled';
                            const isTable = !!order.table_id;
                            const isPickup = order.booking_type === 'pickup';
                            const tableName = order.tables_layout?.table_name || 'WALK-IN';
                            const items = order.order_items || [];
                            const itemCount = items.reduce((sum, i) => sum + (i.quantity || 1), 0);
                            const itemsTotal = items.reduce((sum, i) => sum + ((i.price_at_time || i.price || 0) * (i.quantity || 1)), 0);
                            const totalAmount = order.total_amount || itemsTotal;
                            const hasUnsentItems = !isVoid && items.some(i => 
                                i.status === 'pending' || 
                                (!i.db_id && typeof i.id === 'string' && i.id.startsWith('local_'))
                            );

                             const defaultWalkIns = ['walk-in guest', 'walk-in pick-up', 'walk-in customer', 'walk-in', 'walk-in customer (offline)', 'walk-in pick-up (offline)', 'anonymous user', 'walk-in-customer'];
                             const customerName = order.profiles?.display_name 
                                 || (order.customer_name && !defaultWalkIns.includes(order.customer_name.toLowerCase().trim()) ? order.customer_name : null)
                                 || (order.pickup_contact_name && !defaultWalkIns.includes(order.pickup_contact_name.toLowerCase().trim()) ? order.pickup_contact_name : null)
                                 || 'Guest';

                            return (
                                <motion.div
                                    key={order.id}
                                    whileHover={{ scale: 1.01 }}
                                    onClick={() => onSelectOrder && onSelectOrder(order)}
                                    className={`border rounded-2xl p-4 transition-all shadow-xs flex flex-col justify-between gap-3 group relative overflow-hidden cursor-pointer ${
                                        isVoid 
                                        ? 'bg-red-50/50 border-red-200 hover:border-red-400 opacity-90' 
                                        : 'bg-white border-[#D1D1CD] hover:border-[#1A1A1A]'
                                    }`}
                                >
                                    {/* Card Header: Channel Badge, Status & Time */}
                                    <div className="flex items-center justify-between pb-2 border-b border-[#ECECE9]">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {isVoid ? (
                                                <span className="bg-red-600 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                                                    <Ban size={10} /> VOID / ยกเลิก
                                                </span>
                                            ) : isTable ? (
                                                <span className="bg-[#1A1A1A] text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                                                    <Utensils size={10} /> โต๊ะ {tableName}
                                                </span>
                                            ) : isPickup ? (
                                                <span className="bg-amber-600 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                                                    <ShoppingBag size={10} /> PICK-UP
                                                </span>
                                            ) : (
                                                <span className="bg-slate-700 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                                                    DIRECT BILL
                                                </span>
                                            )}

                                            <span className="font-mono text-[10px] font-bold text-[oklch(52%_0.16_28)] bg-[oklch(52%_0.16_28)]/10 px-1.5 py-0.5 rounded border border-[oklch(52%_0.16_28)]/20">
                                                #{getShortBookingId(order)}
                                            </span>

                                            {hasUnsentItems && (
                                                <span className="bg-red-100 text-red-700 border border-red-200 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                                                    UNSENT
                                                </span>
                                            )}
                                        </div>

                                        <span className="text-[10px] font-mono text-[#767673] flex items-center gap-1 shrink-0">
                                            <Clock size={11} /> {formatElapsedTime(order.booking_time)}
                                        </span>
                                    </div>

                                    {/* Customer & Remark */}
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#1A1A1A] truncate">
                                            <User size={13} className="text-[#767673] shrink-0" />
                                            <span className="truncate">{customerName}</span>
                                        </div>
                                        {order.staff_remark && (
                                            <p className={`text-[10px] font-mono pl-5 font-medium truncate ${isVoid ? 'text-red-700 italic' : 'text-[#767673]'}`}>
                                                Note: {order.staff_remark}
                                            </p>
                                        )}
                                    </div>

                                    {/* Items Preview */}
                                    <div className="bg-[#F5F5F2] border border-[#E0E0DC] rounded-xl p-2.5 text-[11px] space-y-1 font-sans min-h-16 flex flex-col justify-center">
                                        {items.length === 0 ? (
                                            <span className="text-[10px] font-mono text-[#767673] text-center italic">ไม่มีรายการอาหารในคาร์ท</span>
                                        ) : (
                                            items.slice(0, 3).map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center text-[#1A1A1A] text-xs">
                                                    <span className="truncate pr-2 font-medium">
                                                        <strong className="font-mono text-[11px] mr-1">{item.quantity}x</strong>
                                                        {item.custom_name || item.menu_items?.name || item.name || 'เมนูเพิ่มเติม'}
                                                    </span>
                                                    <span className="font-mono text-[10px] text-[#767673] shrink-0">
                                                        ฿{((item.price_at_time || item.price || 0) * (item.quantity || 1)).toLocaleString()}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                        {items.length > 3 && (
                                            <div className="text-[9px] font-mono text-[#767673] pt-0.5 text-right font-bold">
                                                + อีก {items.length - 3} รายการ...
                                            </div>
                                        )}
                                    </div>

                                    {/* Footer Total Amount */}
                                    <div className="flex items-center justify-between pt-1 border-t border-[#ECECE9]">
                                        <span className="text-[10px] font-mono font-bold text-[#767673] uppercase tracking-wider">
                                            {itemCount} ITEMS TOTAL
                                        </span>
                                        <span className={`text-sm font-mono font-bold ${isVoid ? 'text-red-600 line-through' : 'text-[oklch(52%_0.16_28)]'}`}>
                                            ฿{totalAmount.toLocaleString()}
                                        </span>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className={`grid ${order.payment_slip_url ? 'grid-cols-3' : 'grid-cols-2'} gap-1.5 pt-1 font-mono text-[9px] font-bold uppercase tracking-wider`}>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onOpenSlip && onOpenSlip(order, 'kitchen');
                                            }}
                                            className="w-full bg-white hover:bg-[#F5F5F2] border border-[#D1D1CD] text-[#1A1A1A] py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 shadow-2xs active:scale-98 cursor-pointer truncate"
                                        >
                                            <ReceiptText size={10} /> SLIP
                                        </button>

                                        {order.payment_slip_url && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setViewSlipUrl(order.payment_slip_url);
                                                }}
                                                className="w-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 shadow-2xs active:scale-98 cursor-pointer truncate"
                                                title="ดูสลิปหลักฐานโอนเงิน"
                                            >
                                                <ImageIcon size={10} /> PROOF
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelectOrder && onSelectOrder(order);
                                            }}
                                            className={`w-full py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 shadow-2xs active:scale-98 cursor-pointer truncate ${
                                                isVoid 
                                                ? 'bg-red-100 hover:bg-red-200 border border-red-300 text-red-800' 
                                                : 'bg-[#1A1A1A] hover:bg-black text-white'
                                            }`}
                                        >
                                            <span>{isVoid ? 'INSPECT' : 'MANAGE'}</span>
                                            <ChevronRight size={10} />
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
