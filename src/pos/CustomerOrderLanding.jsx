import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Search, ShoppingBag, MapPin, X, Plus, Minus, AlertTriangle, ShieldCheck, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import OptionSelectionModal from '../components/shared/OptionSelectionModal';

// Haversine Distance Formula
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

export default function CustomerOrderLanding() {
    const { tableId } = useParams();
    const navigate = useNavigate();

    // UI States
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');
    const [cartOpen, setCartOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);

    // Business Data
    const [table, setTable] = useState(null);
    const [activeBooking, setActiveBooking] = useState(null);
    const [categories, setCategories] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [cart, setCart] = useState([]);

    // Geofencing and Security States
    const [gpsChecking, setGpsChecking] = useState(true);
    const [gpsError, setGpsError] = useState(null);
    const [gpsStatus, setGpsStatus] = useState('pending'); // 'pending', 'verified', 'failed'
    const [gpsDistance, setGpsDistance] = useState(0);
    const [settings, setSettings] = useState({
        qr_ordering_enabled: 'true',
        qr_gps_enabled: 'true',
        qr_latitude: '17.40722',
        qr_longitude: '104.78028',
        qr_radius: '50'
    });

    useEffect(() => {
        initPage();
    }, [tableId]);

    const initPage = async () => {
        setLoading(true);
        try {
            // 1. Fetch Table Layout
            const { data: tableData, error: tableError } = await supabase
                .from('tables_layout')
                .select('*')
                .eq('id', tableId)
                .single();

            if (tableError || !tableData) {
                toast.error('Invalid Table QR Code');
                setLoading(false);
                return;
            }
            setTable(tableData);

            // 2. Fetch App Settings
            const { data: settingsData } = await supabase
                .from('app_settings')
                .select('*');
            
            let loadedSettings = { ...settings };
            if (settingsData) {
                const map = settingsData.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
                loadedSettings = { ...loadedSettings, ...map };
                setSettings(loadedSettings);
            }

            // Check if QR ordering is disabled globally
            if (loadedSettings.qr_ordering_enabled === 'false') {
                setGpsStatus('failed');
                setGpsError('QR Ordering is currently closed by the restaurant.');
                setGpsChecking(false);
                setLoading(false);
                return;
            }

            // 3. Fetch Active Table Session
            // Booking must be active today with status in 'pending', 'confirmed', 'seated', 'ready'
            const today = new Date().toISOString().split('T')[0];
            const { data: bookingData } = await supabase
                .from('bookings')
                .select('*, order_items(*, menu_items(*))')
                .eq('table_id', tableId)
                .in('status', ['pending', 'confirmed', 'seated', 'ready'])
                .gte('booking_time', `${today}T00:00:00`)
                .order('booking_time', { ascending: false })
                .limit(1)
                .maybeSingle();

            setActiveBooking(bookingData || null);

            // 4. Geofencing check
            if (loadedSettings.qr_gps_enabled === 'true') {
                performGeofenceCheck(loadedSettings);
            } else {
                setGpsStatus('verified');
                setGpsChecking(false);
            }

            // 5. Fetch Menu
            const [catRes, itemRes] = await Promise.all([
                supabase.from('menu_categories').select('*').order('display_order'),
                supabase.from('menu_items').select('*, menu_item_options(*, option_groups(*, option_choices(*)))').eq('is_available', true).order('name')
            ]);
            
            setCategories(catRes.data || []);
            setMenuItems(itemRes.data || []);
            
        } catch (err) {
            console.error('Initialization error:', err);
            toast.error('Failed to connect to restaurant database');
        } finally {
            setLoading(false);
        }
    };

    const performGeofenceCheck = (loadedSettings) => {
        setGpsChecking(true);
        if (!navigator.geolocation) {
            setGpsStatus('failed');
            setGpsError('Your device does not support GPS Geolocation.');
            setGpsChecking(false);
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLat = position.coords.latitude;
                const userLon = position.coords.longitude;
                
                const shopLat = parseFloat(loadedSettings.qr_latitude);
                const shopLon = parseFloat(loadedSettings.qr_longitude);
                const allowedRadius = parseFloat(loadedSettings.qr_radius);

                const distance = getDistance(userLat, userLon, shopLat, shopLon);
                setGpsDistance(distance);

                if (distance <= allowedRadius) {
                    setGpsStatus('verified');
                } else {
                    setGpsStatus('failed');
                    setGpsError(`คุณอยู่นอกพื้นที่ร้านอาหาร (ห่างออกไป ${Math.round(distance)} เมตร) อนุญาตให้สั่งจากภายในร้านเท่านั้น (รัศมี ${allowedRadius} เมตร)`);
                }
                setGpsChecking(false);
            },
            (error) => {
                console.error('GPS error:', error);
                setGpsStatus('failed');
                let errMsg = 'กรุณาอนุญาตการเข้าถึงตำแหน่ง GPS เพื่อสั่งอาหารจากโต๊ะของคุณ';
                if (error.code === error.TIMEOUT) errMsg = 'ค้นหาพิกัด GPS ล้มเหลว (Timeout)';
                setGpsError(errMsg);
                setGpsChecking(false);
            },
            options
        );
    };

    // Cart Operations
    const handleAddToCart = (item) => {
        setSelectedItem(item);
    };

    const handleConfirmOptions = (configuredItem) => {
        setCart(prev => {
            // Find match with exact same item ID and exact same option choices
            const matchIndex = prev.findIndex(cartItem => {
                if (cartItem.id !== configuredItem.id) return false;
                return JSON.stringify(cartItem.selectedOptions) === JSON.stringify(configuredItem.selectedOptions);
            });

            if (matchIndex > -1) {
                return prev.map((cartItem, idx) => 
                    idx === matchIndex 
                    ? { ...cartItem, qty: cartItem.qty + configuredItem.qty }
                    : cartItem
                );
            }
            return [...prev, configuredItem];
        });
        setSelectedItem(null);
        toast.success(`เพิ่ม ${configuredItem.name} เข้าตะกร้าแล้ว`);
    };

    const handleUpdateQty = (index, delta) => {
        setCart(prev => prev.map((item, idx) => {
            if (idx === index) {
                const newQty = Math.max(0, item.qty + delta);
                return { ...item, qty: newQty };
            }
            return item;
        }).filter(item => item.qty > 0));
    };

    const handleCheckout = async () => {
        if (cart.length === 0 || submitting) return;
        setSubmitting(true);

        try {
            let currentBooking = activeBooking;

            // 1. If there is no active booking, create a new walk-in session!
            if (!currentBooking) {
                const trackingToken = crypto.randomUUID();
                const newBookingPayload = {
                    table_id: parseInt(tableId),
                    status: 'pending', // Starts as pending to alert staff
                    booking_type: 'walk_in',
                    booking_time: new Date().toISOString(),
                    pax: table?.capacity || 2,
                    staff_remark: 'QR Walk-in Guest',
                    tracking_token: trackingToken,
                    total_amount: cartSubtotal
                };

                const { data: newBooking, error: createError } = await supabase
                    .from('bookings')
                    .insert(newBookingPayload)
                    .select()
                    .single();

                if (createError) throw createError;
                currentBooking = newBooking;
            } else {
                // Re-verify existing table status before inserting
                const { data: latestBooking } = await supabase
                    .from('bookings')
                    .select('*')
                    .eq('id', currentBooking.id)
                    .single();

                if (!latestBooking || ['completed', 'cancelled', 'void'].includes(latestBooking.status)) {
                    toast.error('This table session has already been closed. Please consult staff.');
                    setSubmitting(false);
                    return;
                }

                // Update Booking status back to pending to alert staff and trigger print modal!
                const newTotalAmount = (currentBooking.total_amount || 0) + cartSubtotal;
                const { error: bookingUpdateError } = await supabase
                    .from('bookings')
                    .update({ 
                        status: 'pending', // Triggers audio alert & dashboard flash
                        total_amount: newTotalAmount 
                    })
                    .eq('id', currentBooking.id);

                if (bookingUpdateError) throw bookingUpdateError;
                currentBooking.tracking_token = latestBooking.tracking_token;
            }

            // 2. Insert new items into order_items
            const itemsToInsert = cart.map(item => ({
                booking_id: currentBooking.id,
                menu_item_id: item.id,
                quantity: item.qty,
                price_at_time: item.totalPricePerUnit,
                selected_options: item.selectedOptions || {}
            }));

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(itemsToInsert);

            if (itemsError) throw itemsError;

            toast.success('ออเดอร์ถูกส่งไปยังพนักงานแล้ว!');
            setCart([]);
            setCartOpen(false);
            
            // Save active tracking token to local storage
            localStorage.setItem(`table_${tableId}_token`, currentBooking.tracking_token);

            // Redirect to status page
            navigate(`/table/${tableId}/status`);

        } catch (err) {
            console.error('Checkout error:', err);
            toast.error('Failed to submit order. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
    const cartSubtotal = cart.reduce((sum, item) => sum + (item.totalPricePerUnit * item.qty), 0);

    const filteredItems = menuItems.filter(item => {
        const matchesCat = activeCategory === 'all' || item.category_id === activeCategory;
        const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                              (item.description && item.description.toLowerCase().includes(search.toLowerCase()));
        return matchesCat && matchesSearch;
    });

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0C0C0C] text-white flex flex-col items-center justify-center font-sans">
                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-gray-400 text-sm tracking-widest uppercase">Connecting to table...</p>
            </div>
        );
    }

    if (gpsChecking) {
        return (
            <div className="min-h-screen bg-[#0C0C0C] text-white flex flex-col items-center justify-center font-sans p-6 text-center">
                <MapPin size={48} className="text-orange-500 animate-bounce mb-6" />
                <h3 className="font-bold text-xl mb-2">Verifying Location</h3>
                <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
                    Confirming you are inside the restaurant to enable ordering at table. Please allow GPS access.
                </p>
            </div>
        );
    }

    if (gpsStatus === 'failed') {
        let errorTitle = 'Geofencing Locked';
        if (gpsError) {
            if (gpsError.toLowerCase().includes('not active') || gpsError.toLowerCase().includes('เปิดบริการ')) {
                errorTitle = 'Table Inactive / โต๊ะยังไม่เปิดบริการ';
            } else if (gpsError.toLowerCase().includes('closed') || gpsError.toLowerCase().includes('ปิดอยู่')) {
                errorTitle = 'Ordering Closed / ระบบสั่งอาหารปิด';
            } else {
                errorTitle = 'Location Locked / พิกัดนอกร้าน';
            }
        }

        return (
            <div className="min-h-screen bg-[#0C0C0C] text-white flex flex-col items-center justify-center font-sans p-6 text-center">
                <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-red-500 mb-6 animate-pulse">
                    <AlertTriangle size={36} />
                </div>
                <h3 className="font-bold text-2xl mb-3 text-red-400">{errorTitle}</h3>
                <p className="text-gray-400 text-sm max-w-sm leading-relaxed mb-8">
                    {gpsError || 'You must be physically at the restaurant to place an order.'}
                </p>
                <button 
                    onClick={() => window.location.reload()} 
                    className="bg-white/5 border border-white/10 hover:border-orange-500/30 px-6 py-3 rounded-2xl text-sm font-bold active:scale-95 transition-all text-white flex items-center gap-2"
                >
                    Retry Verification
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-[#0C0C0C] text-white font-sans flex flex-col pb-24 selection:bg-orange-500 selection:text-white">
            <Toaster position="top-center" richColors />

            {/* Premium Header */}
            <header className="sticky top-0 bg-[#0C0C0C]/80 backdrop-blur-xl border-b border-white/5 z-40 p-5 flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-black text-xl tracking-tight text-white uppercase">IN THE HAUS</span>
                        <div className="bg-orange-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full">
                            QR
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 font-bold tracking-wider mt-0.5">
                        ORDERING AT {table ? table.table_name : 'TABLE'}
                    </p>
                </div>
                <div className="flex items-center gap-1 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1.5 text-green-400 font-extrabold text-[10px] uppercase tracking-wider">
                    <ShieldCheck size={12} />
                    <span>GPS Verified</span>
                </div>
            </header>

            {/* Welcome banner */}
            <div className="p-6 bg-gradient-to-r from-orange-500/10 to-transparent border-b border-white/5">
                <h2 className="text-lg font-bold text-white mb-1">
                    ยินดีต้อนรับสู่โต๊ะ {table?.table_name}
                </h2>
                <p className="text-xs text-gray-400">
                    เลือกรายการอาหารด้านล่างและยืนยันออเดอร์เพื่อส่งตรงไปยังห้องครัว
                </p>
            </div>

            {/* Menu search and category filters */}
            <div className="p-5 sticky top-[73px] bg-[#0C0C0C]/95 backdrop-blur-xl z-30 space-y-4 border-b border-white/5">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input 
                        type="search" 
                        placeholder="ค้นหาเมนูอร่อย..." 
                        className="w-full bg-[#161616] border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-orange-500/50 text-sm transition-colors"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    <button 
                        onClick={() => setActiveCategory('all')} 
                        className={`px-5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeCategory === 'all' ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/20' : 'bg-[#161616] text-gray-400 hover:text-white'}`}
                    >
                        เมนูทั้งหมด
                    </button>
                    {categories.map(cat => (
                        <button 
                            key={cat.id} 
                            onClick={() => setActiveCategory(cat.id)} 
                            className={`px-5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeCategory === cat.id ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/20' : 'bg-[#161616] text-gray-400 hover:text-white'}`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Menu items listing */}
            <main className="flex-1 p-5">
                <div className="grid grid-cols-2 gap-4">
                    {filteredItems.map(item => (
                        <motion.div
                            key={item.id}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleAddToCart(item)}
                            className="bg-[#161616] rounded-3xl border border-white/5 p-3 flex flex-col gap-3 text-left group cursor-pointer hover:border-orange-500/20 transition-all shadow-sm"
                        >
                            <div className="aspect-[4/3] rounded-2xl bg-black/20 overflow-hidden relative">
                                {item.image_url ? (
                                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-700 font-bold text-2xl uppercase">
                                        {item.name.charAt(0)}
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/20"></div>
                                <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-orange-500 text-black flex items-center justify-center shadow-lg transition-all">
                                    <Plus size={16} />
                                </div>
                            </div>
                            
                            <div className="flex flex-col flex-1 px-1 justify-between min-h-[70px]">
                                <div>
                                    <h4 className="font-bold text-sm line-clamp-1 leading-tight">{item.name}</h4>
                                    {item.description && <p className="text-[10px] text-gray-500 line-clamp-2 mt-0.5 leading-snug">{item.description}</p>}
                                </div>
                                <div className="pt-2 flex items-center justify-between">
                                    <span className="text-orange-500 font-bold text-sm">฿{item.price}</span>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {filteredItems.length === 0 && (
                    <div className="py-20 text-center text-gray-500 text-sm">
                        ไม่พบรายการอาหารที่ค้นหา
                    </div>
                )}
            </main>

            {/* Option customizer modal */}
            <AnimatePresence>
                {selectedItem && (
                    <OptionSelectionModal 
                        item={selectedItem} 
                        onClose={() => setSelectedItem(null)} 
                        onConfirm={handleConfirmOptions} 
                    />
                )}
            </AnimatePresence>

            {/* Bottom floating cart bar */}
            {cart.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-5 bg-[#0C0C0C]/80 backdrop-blur-xl border-t border-white/5 z-40 safe-area-bottom">
                    <button 
                        onClick={() => setCartOpen(true)}
                        className="w-full bg-orange-500 text-black py-4 px-6 rounded-2xl font-black text-sm flex items-center justify-between shadow-lg shadow-orange-500/10 active:scale-98 transition-transform"
                    >
                        <div className="flex items-center gap-2">
                            <ShoppingBag size={18} />
                            <span className="bg-black text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                                {cartCount}
                            </span>
                        </div>
                        <span>ดูตระกร้าสั่งอาหาร</span>
                        <span className="font-mono">฿{cartSubtotal.toLocaleString()}.-</span>
                    </button>
                </div>
            )}

            {/* Cart drawer slide-up */}
            <AnimatePresence>
                {cartOpen && (
                    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto"
                            onClick={() => setCartOpen(false)}
                        />

                        <motion.div 
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                            className="bg-[#121212] w-full max-w-md rounded-t-[32px] border-t border-white/5 p-6 shadow-2xl z-10 pointer-events-auto overflow-hidden flex flex-col max-h-[80vh]"
                        >
                            {/* Drawer Header */}
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-lg font-bold text-white">ตะกร้าของคุณ (Your Cart)</h3>
                                    <p className="text-xs text-gray-500">โต๊ะ {table?.table_name}</p>
                                </div>
                                <button 
                                    onClick={() => setCartOpen(false)}
                                    className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Cart Items list */}
                            <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-1 custom-scrollbar">
                                {cart.map((item, index) => (
                                    <div key={index} className="bg-white/5 p-4 rounded-2xl flex items-start gap-4">
                                        <div className="flex-1 min-w-0">
                                            <h5 className="font-bold text-sm truncate text-white">{item.name}</h5>
                                            {item.optionsSummary && item.optionsSummary.length > 0 && (
                                                <div className="text-[10px] text-gray-500 mt-1 space-y-0.5">
                                                    {item.optionsSummary.map((opt, i) => (
                                                        <div key={i}>+ {opt.name} {opt.price > 0 && `(+฿${opt.price})`}</div>
                                                    ))}
                                                </div>
                                            )}
                                            <p className="text-orange-500 font-bold text-xs mt-2">฿{(item.totalPricePerUnit * item.qty).toLocaleString()}</p>
                                        </div>

                                        <div className="flex items-center bg-black/40 rounded-xl p-1 gap-1">
                                            <button 
                                                onClick={() => handleUpdateQty(index, -1)}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-gray-400"
                                            >
                                                <Minus size={12} />
                                            </button>
                                            <span className="w-6 text-center font-bold text-xs text-white">{item.qty}</span>
                                            <button 
                                                onClick={() => handleUpdateQty(index, 1)}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-gray-400"
                                            >
                                                <Plus size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Drawer Footer */}
                            <div className="border-t border-white/5 pt-4 space-y-4">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-gray-400 text-xs uppercase font-bold tracking-wider">ยอดรวมสุทธิ (Subtotal)</span>
                                    <span className="text-2xl font-black text-orange-500">฿{cartSubtotal.toLocaleString()}.-</span>
                                </div>

                                <button 
                                    onClick={handleCheckout}
                                    disabled={submitting}
                                    className="w-full bg-orange-500 disabled:bg-orange-500/50 text-black py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/10 active:scale-98"
                                >
                                    {submitting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                            <span>กำลังส่งรายการสั่งอาหาร...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Check size={18} />
                                            <span>ยืนยันส่งครัว (Place Order)</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
