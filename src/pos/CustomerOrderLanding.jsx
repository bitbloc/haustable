import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Search, ShoppingBag, MapPin, X, Plus, Minus, AlertTriangle, ShieldCheck, Check, Bell, Receipt, Smartphone, Upload, FileText, CheckCircle, Clock, ArrowLeft } from 'lucide-react';
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

    // Tracking & Checkout States (Rams Realtime Style)
    const [trackingOpen, setTrackingOpen] = useState(false);
    const [uploadingSlip, setUploadingSlip] = useState(false);
    const [requestingBill, setRequestingBill] = useState(false);
    const [paymentQrUrl, setPaymentQrUrl] = useState(null);

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

    const refreshActiveBooking = async () => {
        try {
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
        } catch (err) {
            console.error('Error refreshing active booking:', err);
        }
    };

    useEffect(() => {
        initPage();

        const sub = supabase.channel(`landing-session-${tableId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'bookings',
                filter: `table_id=eq.${tableId}`
            }, () => {
                refreshActiveBooking();
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'order_items'
            }, () => {
                refreshActiveBooking();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(sub);
        };
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

            // 3.5. Fetch payment QR Code
            const { data: qrData } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'payment_qr_url')
                .maybeSingle();

            if (qrData?.value) {
                setPaymentQrUrl(qrData.value);
            }

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

    // Billing & Slip Handlers
    const handleUploadSlip = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !activeBooking) return;

        setUploadingSlip(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `slip_${activeBooking.id}_${Date.now()}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
                .from('slips')
                .upload(fileName, file, {
                    cacheControl: '15552000'
                });

            if (uploadError) throw uploadError;

            const { error: updateError } = await supabase
                .from('bookings')
                .update({ 
                    payment_slip_url: fileName 
                })
                .eq('id', activeBooking.id);

            if (updateError) throw updateError;

            toast.success('อัปโหลดสลิปเรียบร้อยแล้ว พนักงานกำลังทำการตรวจสอบ');
            refreshActiveBooking();

        } catch (err) {
            console.error('Slip upload failed:', err);
            toast.error('อัปโหลดสลิปล้มเหลว: ' + err.message);
        } finally {
            setUploadingSlip(false);
        }
    };

    const handleRequestBill = async () => {
        if (!activeBooking) return;
        setRequestingBill(true);
        try {
            const currentRemark = activeBooking.staff_remark || '';
            const newRemark = currentRemark.includes('[CALL_BILL]') 
                ? currentRemark 
                : `[CALL_BILL] ${currentRemark}`.trim();

            const { error } = await supabase
                .from('bookings')
                .update({ staff_remark: newRemark })
                .eq('id', activeBooking.id);

            if (error) throw error;

            toast.success('แจ้งพนักงานเรียกเช็คบิลเรียบร้อยแล้ว');
            refreshActiveBooking();
        } catch (err) {
            console.error('Request bill failed:', err);
            toast.error('ล้มเหลว: ' + err.message);
        } finally {
            setRequestingBill(false);
        }
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

    const handleCallStaff = async () => {
        try {
            let currentBooking = activeBooking;
            
            if (!currentBooking) {
                const trackingToken = crypto.randomUUID();
                const newBookingPayload = {
                    table_id: parseInt(tableId),
                    status: 'pending',
                    booking_type: 'walk_in',
                    booking_time: new Date().toISOString(),
                    pax: table?.capacity || 2,
                    staff_remark: '[CALL_STAFF]',
                    tracking_token: trackingToken,
                    total_amount: 0
                };

                const { data: newBooking, error: createError } = await supabase
                    .from('bookings')
                    .insert(newBookingPayload)
                    .select()
                    .single();

                if (createError) throw createError;
                currentBooking = newBooking;
                setActiveBooking(newBooking);
                localStorage.setItem(`table_${tableId}_token`, trackingToken);
            } else {
                let currentRemark = currentBooking.staff_remark || '';
                let newRemark = currentRemark;
                
                if (!currentRemark.includes('[CALL_STAFF]')) {
                    newRemark = `[CALL_STAFF] ${currentRemark}`.trim();
                }

                const { error } = await supabase
                    .from('bookings')
                    .update({ staff_remark: newRemark })
                    .eq('id', currentBooking.id);

                if (error) throw error;

                setActiveBooking({
                    ...currentBooking,
                    staff_remark: newRemark
                });
            }

            toast.success('เรียกพนักงานเรียบร้อยแล้ว กรุณารอสักครู่');
        } catch (err) {
            console.error("Failed to call staff:", err);
            toast.error('ไม่สามารถเรียกพนักงานได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง');
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
            <div className="min-h-screen bg-[#ECECE9] text-[#1A1A1A] flex flex-col items-center justify-center font-sans">
                <div className="w-12 h-12 border-4 border-[#FF5500] border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-[#767673] text-xs font-mono font-bold tracking-widest uppercase">Connecting to table...</p>
            </div>
        );
    }

    if (gpsChecking) {
        return (
            <div className="min-h-screen bg-[#ECECE9] text-[#1A1A1A] flex flex-col items-center justify-center font-sans p-6 text-center">
                <MapPin size={48} className="text-[#FF5500] animate-bounce mb-6" />
                <h3 className="font-mono font-bold text-sm tracking-wider uppercase mb-2">Verifying Location</h3>
                <p className="text-[#767673] text-xs max-w-xs leading-relaxed">
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
            <div className="min-h-screen bg-[#ECECE9] text-[#1A1A1A] flex flex-col items-center justify-center font-sans p-6 text-center">
                <div className="w-20 h-20 bg-[#FF5500]/10 border border-[#FF5500]/20 rounded-full flex items-center justify-center text-[#FF5500] mb-6 animate-pulse">
                    <AlertTriangle size={36} />
                </div>
                <h3 className="font-mono font-bold text-sm tracking-wider uppercase mb-3 text-[#FF5500]">{errorTitle}</h3>
                <p className="text-[#767673] text-xs max-w-sm leading-relaxed mb-8">
                    {gpsError || 'You must be physically at the restaurant to place an order.'}
                </p>
                <button 
                    onClick={() => window.location.reload()} 
                    className="bg-white border border-[#D1D1CD] hover:border-[#B0B0AC] px-6 py-3 rounded-xl text-xs font-mono font-bold uppercase tracking-wider active:scale-95 transition-all text-[#1A1A1A] flex items-center gap-2 cursor-pointer shadow-sm"
                >
                    Retry Verification
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-[#ECECE9] text-[#1A1A1A] font-sans flex flex-col pb-24 select-none">
            <Toaster position="top-center" richColors />

            {/* Premium Header */}
            <header className="sticky top-0 bg-[#F5F5F2]/95 backdrop-blur-md border-b border-[#D1D1CD] z-40 p-4 flex items-center justify-between shadow-sm">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-lg tracking-wider text-[#1A1A1A] uppercase">IN THE HAUS</span>
                        <div className="bg-[#FF5500] text-white text-[8px] font-mono font-bold px-1.5 py-0.5 rounded">
                            QR
                        </div>
                    </div>
                    <p className="text-[9px] text-[#767673] font-mono font-bold tracking-wider mt-0.5 uppercase">
                        ORDERING AT {table ? table.table_name : 'TABLE'}
                    </p>
                </div>
                <div className="flex items-center gap-1.5 bg-[#00CC44]/10 border border-[#00CC44]/20 rounded px-2.5 py-1 text-[#00CC44] font-mono font-bold text-[9px] uppercase tracking-wider">
                    <ShieldCheck size={10} />
                    <span>GPS Verified</span>
                </div>
            </header>

            {/* Welcome banner */}
            <div className="p-5 bg-white border-b border-[#D1D1CD]">
                <h2 className="text-sm font-bold text-[#1A1A1A] mb-1">
                    ยินดีต้อนรับสู่โต๊ะ {table?.table_name}
                </h2>
                <p className="text-[11px] text-[#767673] leading-relaxed">
                    เลือกรายการอาหารด้านล่างและยืนยันออเดอร์เพื่อส่งตรงไปยังห้องครัว
                </p>
            </div>

            {/* Menu search and category filters */}
            <div className="p-4 sticky top-[61px] bg-[#ECECE9]/95 backdrop-blur-md z-30 space-y-3 border-b border-[#D1D1CD]">
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#767673]" size={16} />
                    <input 
                        type="search" 
                        placeholder="ค้นหาเมนูอร่อย..." 
                        className="w-full bg-white border border-[#D1D1CD] rounded-xl py-2.5 pl-10 pr-4 text-[#1A1A1A] focus:outline-none focus:border-[#FF5500] text-xs transition-colors"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none">
                    <button 
                        onClick={() => setActiveCategory('all')} 
                        className={`px-4 py-2 rounded-xl text-[11px] font-sans font-bold uppercase tracking-wider transition-all border whitespace-nowrap shrink-0 cursor-pointer ${activeCategory === 'all' ? 'bg-[#FF5500] border-[#D04500] text-white shadow-sm' : 'bg-white border-[#D1D1CD] text-[#767673] hover:text-[#1A1A1A] hover:border-[#B0B0AC] shadow-sm'}`}
                    >
                        เมนูทั้งหมด
                    </button>
                    {categories.map(cat => (
                        <button 
                            key={cat.id} 
                            onClick={() => setActiveCategory(cat.id)} 
                            className={`px-4 py-2 rounded-xl text-[11px] font-sans font-bold uppercase tracking-wider transition-all border whitespace-nowrap shrink-0 cursor-pointer ${activeCategory === cat.id ? 'bg-[#FF5500] border-[#D04500] text-white shadow-sm' : 'bg-white border-[#D1D1CD] text-[#767673] hover:text-[#1A1A1A] hover:border-[#B0B0AC] shadow-sm'}`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Menu items listing */}
            <main className="flex-1 p-4">
                <div className="grid grid-cols-2 gap-4">
                    {filteredItems.map(item => (
                        <motion.div
                            key={item.id}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleAddToCart(item)}
                            className="bg-white rounded-2xl border border-[#D1D1CD] p-3 flex flex-col gap-3 text-left group cursor-pointer hover:border-[#B0B0AC] transition-all shadow-sm"
                        >
                            <div className="aspect-[4/3] rounded-xl bg-[#F5F5F2] overflow-hidden relative border border-[#D1D1CD]/40">
                                {item.image_url ? (
                                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[#767673] font-bold text-lg uppercase font-mono">
                                        {item.name.charAt(0)}
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/5"></div>
                                <div className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-[#FF5500] text-white flex items-center justify-center shadow transition-all hover:scale-105">
                                    <Plus size={14} />
                                </div>
                            </div>
                            
                            <div className="flex flex-col flex-1 px-1 justify-between min-h-[60px]">
                                <div>
                                    <h4 className="font-bold text-xs text-[#1A1A1A] line-clamp-1 leading-tight">{item.name}</h4>
                                    {item.description && <p className="text-[9px] text-[#767673] line-clamp-2 mt-0.5 leading-snug">{item.description}</p>}
                                </div>
                                <div className="pt-2 flex items-center justify-between">
                                    <span className="text-[#FF5500] font-mono font-bold text-xs">฿{item.price}</span>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {filteredItems.length === 0 && (
                    <div className="py-20 text-center text-[#767673] font-mono text-xs uppercase tracking-wider font-bold">
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

            {/* Unified Floating Actions & Cart Bar at Bottom */}
            <div className="fixed bottom-0 left-0 right-0 p-3 bg-[#F5F5F2]/90 backdrop-blur-md border-t border-[#D1D1CD] z-40 safe-area-bottom flex flex-col gap-2 shadow-lg max-w-md mx-auto">
                {/* Top Row: Quick Actions */}
                <div className="flex gap-2 w-full">
                    {/* Call Staff Button */}
                    <button
                        onClick={handleCallStaff}
                        className="flex-1 bg-white border border-[#D1D1CD] hover:border-[#B0B0AC] text-[#1A1A1A] py-2.5 px-4 rounded-xl font-sans font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-sm"
                    >
                        <Bell size={14} className="text-[#FF5500]" />
                        <span>เรียกพนักงาน (Call Staff)</span>
                    </button>

                    {/* View Ordered Items Button */}
                    <button
                        onClick={() => {
                            if (activeBooking) {
                                setTrackingOpen(true);
                            } else {
                                toast.info('กรุณาสั่งรายการแรกเพื่อเริ่มเซสชันก่อนครับ');
                            }
                        }}
                        className={`flex-1 py-2.5 px-4 rounded-xl font-sans font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-sm ${
                            activeBooking 
                            ? 'bg-white border border-[#D1D1CD] hover:border-[#B0B0AC] text-[#1A1A1A]' 
                            : 'bg-white/50 border border-[#D1D1CD]/50 text-[#767673] cursor-not-allowed'
                        }`}
                    >
                        <Receipt size={14} className={activeBooking ? "text-[#767673]" : "text-[#767673]/50"} />
                        <span>รายการที่สั่ง (Ordered)</span>
                    </button>
                </div>

                {/* Bottom Row: Cart status or Session Balance */}
                {cart.length > 0 ? (
                    <button 
                        onClick={() => setCartOpen(true)}
                        className="w-full bg-[#FF5500] hover:bg-[#E04B00] text-white py-3 px-5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-between shadow-md active:scale-98 transition-transform cursor-pointer"
                    >
                        <div className="flex items-center gap-2">
                            <ShoppingBag size={14} />
                            <span className="bg-white text-[#FF5500] text-[9px] px-1.5 py-0.5 rounded font-black font-mono animate-pulse">
                                {cartCount}
                            </span>
                        </div>
                        <span>ดูตระกร้าสั่งอาหาร (View Cart)</span>
                        <span className="font-mono">฿{cartSubtotal.toLocaleString()}.-</span>
                    </button>
                ) : activeBooking ? (
                    <div className="w-full bg-[#3C3D40] text-white py-2.5 px-4 rounded-xl font-mono text-[10px] uppercase tracking-wider flex items-center justify-between border border-[#2A2B2D]">
                        <div className="flex items-center gap-1.5">
                            <span className="bg-[#00CC44] w-1.5 h-1.5 rounded-full animate-ping" />
                            <span className="text-[#ECECE9] font-bold">ACTIVE SESSION</span>
                        </div>
                        <span className="text-[#D1D1CD]">ยอดสั่งรวม: ฿{activeBooking.total_amount?.toLocaleString() || 0}.-</span>
                    </div>
                ) : (
                    <div className="w-full bg-[#ECECE9] text-[#767673] py-2 px-4 rounded-xl font-mono text-[9px] uppercase tracking-widest text-center border border-dashed border-[#D1D1CD]">
                        เลือกเมนูเพื่อสั่งอาหาร
                    </div>
                )}
            </div>

            {/* Cart drawer slide-up */}
            <AnimatePresence>
                {cartOpen && (
                    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 pointer-events-auto"
                            onClick={() => setCartOpen(false)}
                        />

                        <motion.div 
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                            className="bg-[#F5F5F2] w-full max-w-md rounded-t-2xl border-t border-[#D1D1CD] p-5 shadow-2xl z-10 pointer-events-auto overflow-hidden flex flex-col max-h-[80vh] text-[#1A1A1A] font-sans"
                        >
                            {/* Drawer Header */}
                            <div className="flex justify-between items-center mb-5 shrink-0">
                                <div>
                                    <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-[#1A1A1A]">ตะกร้าของคุณ (Your Cart)</h3>
                                    <p className="text-[10px] text-[#767673] font-mono font-bold uppercase tracking-tight mt-0.5">โต๊ะ {table?.table_name}</p>
                                </div>
                                <button 
                                    onClick={() => setCartOpen(false)}
                                    className="w-7 h-7 rounded-full bg-white border border-[#D1D1CD] flex items-center justify-center hover:bg-[#E0E0DC] text-[#767673] hover:text-[#1A1A1A] transition-colors cursor-pointer"
                                >
                                    <X size={14} />
                                </button>
                            </div>

                            {/* Cart Items list */}
                            <div className="flex-1 overflow-y-auto space-y-3 mb-5 pr-1 custom-scrollbar">
                                {cart.map((item, index) => (
                                    <div key={index} className="bg-white p-3.5 rounded-xl border border-[#D1D1CD] flex items-start gap-4">
                                        <div className="flex-1 min-w-0">
                                            <h5 className="font-bold text-xs truncate text-[#1A1A1A]">{item.name}</h5>
                                            {item.optionsSummary && item.optionsSummary.length > 0 && (
                                                <div className="text-[9px] text-[#767673] mt-1 space-y-0.5">
                                                    {item.optionsSummary.map((opt, i) => (
                                                        <div key={i}>+ {opt.name} {opt.price > 0 && `(+฿${opt.price})`}</div>
                                                    ))}
                                                </div>
                                            )}
                                            <p className="text-[#FF5500] font-mono font-bold text-xs mt-2">฿{(item.totalPricePerUnit * item.qty).toLocaleString()}</p>
                                        </div>

                                        <div className="flex items-center bg-[#F5F5F2] border border-[#D1D1CD] rounded-lg p-0.5 gap-1 shrink-0">
                                            <button 
                                                onClick={() => handleUpdateQty(index, -1)}
                                                className="w-7 h-7 rounded flex items-center justify-center hover:bg-white text-[#767673] cursor-pointer"
                                            >
                                                <Minus size={10} />
                                            </button>
                                            <span className="w-5 text-center font-mono font-bold text-xs text-[#1A1A1A]">{item.qty}</span>
                                            <button 
                                                onClick={() => handleUpdateQty(index, 1)}
                                                className="w-7 h-7 rounded flex items-center justify-center hover:bg-white text-[#767673] cursor-pointer"
                                            >
                                                <Plus size={10} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Drawer Footer */}
                            <div className="border-t border-[#D1D1CD] pt-4 space-y-4 shrink-0">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-[#767673] text-[10px] uppercase font-mono font-bold tracking-wider">ยอดรวมสุทธิ (Subtotal)</span>
                                    <span className="text-xl font-black text-[#FF5500] font-mono">฿{cartSubtotal.toLocaleString()}.-</span>
                                </div>

                                <button 
                                    onClick={handleCheckout}
                                    disabled={submitting}
                                    className="w-full bg-[#FF5500] disabled:bg-[#FF5500]/50 text-white py-3.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                                >
                                    {submitting ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            <span>กำลังส่งรายการสั่งอาหาร...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Check size={14} />
                                            <span>ยืนยันส่งครัว (Place Order)</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Tracking drawer slide-up (Dieter Rams style) */}
            <AnimatePresence>
                {trackingOpen && activeBooking && (() => {
                    const steps = [
                        { key: 'pending', label: 'ส่งออเดอร์แล้ว', desc: 'รอพนักงานกดยอมรับ', time: activeBooking.booking_time },
                        { key: 'seated', label: 'รับออเดอร์แล้ว', desc: 'พนักงานยอมรับออเดอร์แล้ว กำลังจัดเตรียมอาหาร', time: activeBooking.status !== 'pending' ? activeBooking.booking_time : null },
                    ];

                    const getActiveStepIndex = () => {
                        if (activeBooking.status === 'pending') return 0;
                        return 1;
                    };

                    const activeStep = getActiveStepIndex();
                    const orderItems = activeBooking.order_items || [];

                    return (
                        <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-black/60 pointer-events-auto"
                                onClick={() => setTrackingOpen(false)}
                            />

                            <motion.div 
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                                className="bg-[#F0F0EC] w-full max-w-md rounded-t-2xl border-t border-[#D1D1CD] p-5 shadow-2xl z-10 pointer-events-auto overflow-hidden flex flex-col max-h-[85vh] text-[#1A1A1A] font-sans"
                            >
                                {/* Dieter Rams Style Header */}
                                <div className="flex justify-between items-center mb-5 shrink-0 border-b border-[#D1D1CD] pb-4">
                                    <div>
                                        <h3 className="text-sm font-sans font-black uppercase tracking-wider text-[#1A1A1A]">ติดตามสถานะออเดอร์</h3>
                                        <p className="text-[9px] text-[#767673] font-mono font-bold uppercase tracking-widest mt-1">
                                            Table {table?.table_name} · Queue #{activeBooking.tracking_token ? activeBooking.tracking_token.slice(0, 4) : activeBooking.id.slice(0, 4)}
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => setTrackingOpen(false)}
                                        className="w-7 h-7 rounded-full bg-white border border-[#D1D1CD] flex items-center justify-center hover:bg-[#E0E0DC] text-[#767673] hover:text-[#1A1A1A] transition-colors cursor-pointer shadow-sm"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>

                                {/* Main scrollable contents */}
                                <div className="flex-1 overflow-y-auto space-y-5 pr-1 custom-scrollbar pb-6">
                                    {/* Timeline Steps (Rams Dial/LED style) */}
                                    <div className="bg-white border border-[#D1D1CD] rounded-xl p-5 shadow-sm">
                                        <h4 className="text-[9px] text-[#767673] font-mono font-bold uppercase tracking-widest mb-5">ความคืบหน้า (ORDER STATUS)</h4>
                                        <div className="relative pl-7 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[1px] before:bg-[#D1D1CD]">
                                            {steps.map((step, idx) => {
                                                const isDone = idx <= activeStep;
                                                const isCurrent = idx === activeStep;
                                                return (
                                                    <div key={step.key} className="relative">
                                                        <div className="absolute -left-7 top-0.5 w-4 h-4 rounded-full bg-white border border-[#D1D1CD] flex items-center justify-center">
                                                            {isCurrent ? (
                                                                <span className="w-2 h-2 rounded-full bg-[#FF5500] shadow-[0_0_6px_#FF5500] animate-pulse" />
                                                            ) : isDone ? (
                                                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                                            ) : (
                                                                <span className="w-1.5 h-1.5 rounded-full bg-[#D1D1CD]" />
                                                            )}
                                                        </div>

                                                        <div className="pl-1.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-xs font-bold ${isDone ? 'text-[#1A1A1A]' : 'text-[#767673]'}`}>
                                                                    {step.label}
                                                                </span>
                                                                {isCurrent && (
                                                                    <span className="bg-[#FF5500]/10 text-[#FF5500] text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded leading-none">
                                                                        กำลังเตรียม
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] text-[#767673] mt-0.5 leading-relaxed">{step.desc}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Order Items Ledger */}
                                    <div className="bg-white border border-[#D1D1CD] rounded-xl p-5 shadow-sm">
                                        <h4 className="text-[9px] text-[#767673] font-mono font-bold uppercase tracking-widest mb-4">รายการอาหารสุทธิ (ITEMS SUMMARY)</h4>
                                        <div className="space-y-3.5">
                                            {orderItems.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-start text-xs text-[#1A1A1A] pb-3 border-b border-[#D1D1CD]/30 last:border-b-0 last:pb-0">
                                                    <div className="flex gap-2.5">
                                                        <span className="font-bold text-[#FF5500]">{item.quantity}x</span>
                                                        <div>
                                                            <span className="font-bold text-[#1A1A1A] block leading-tight">{item.menu_items?.name}</span>
                                                            {item.selected_options && typeof item.selected_options === 'object' && !Array.isArray(item.selected_options) && (
                                                                <div className="text-[9px] text-[#767673] mt-0.5 italic font-medium">
                                                                    {Object.values(item.selected_options).flat().join(', ')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className="font-mono text-[#767673] font-bold">฿{(item.price_at_time * item.quantity).toLocaleString()}</span>
                                                </div>
                                            ))}
                                            
                                            {orderItems.length === 0 && (
                                                <div className="text-center py-4 text-[#767673] font-mono text-[9px] font-bold uppercase">
                                                    กำลังโหลดรายการอาหาร...
                                                </div>
                                            )}

                                            <div className="border-t border-[#D1D1CD] pt-3.5 mt-2 flex justify-between items-baseline">
                                                <span className="text-[10px] text-[#767673] font-mono font-bold uppercase tracking-wider">ยอดรวมค่าอาหารสุทธิ</span>
                                                <span className="text-lg font-black text-[#FF5500] font-mono">฿{activeBooking.total_amount?.toLocaleString() || 0}.-</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Checkout & PromptPay (Pay at Table) */}
                                    <div className="bg-white border border-[#D1D1CD] rounded-xl p-5 shadow-sm flex flex-col items-center">
                                        <h4 className="text-[9px] text-[#767673] font-mono font-bold uppercase tracking-widest mb-3 self-start">ชำระเงินที่โต๊ะ (PAY AT TABLE)</h4>
                                        
                                        {!activeBooking.staff_remark?.includes('[CALL_BILL]') ? (
                                            <div className="w-full text-center space-y-3.5 py-2">
                                                <Smartphone size={28} className="text-[#767673] mx-auto animate-pulse" />
                                                <div>
                                                    <h5 className="font-bold text-xs text-[#1A1A1A]">ต้องการเช็คบิลชำระเงิน?</h5>
                                                    <p className="text-[10px] text-[#767673] mt-0.5 leading-relaxed">กดปุ่มเพื่อเรียกพนักงานเช็คบิลและรับ QR Code เพื่อสแกนจ่ายได้ทันที</p>
                                                </div>
                                                <button
                                                    onClick={handleRequestBill}
                                                    disabled={requestingBill}
                                                    className="w-full bg-[#FF5500] hover:bg-[#E04B00] border border-[#D04500] text-white py-3.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-97"
                                                >
                                                    <Receipt size={12} />
                                                    {requestingBill ? 'กำลังดำเนินการ...' : 'เรียกพนักงานเช็คบิล (Request Bill)'}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="w-full space-y-4">
                                                <div className="bg-[#00CC44]/10 border border-[#00CC44]/20 rounded-xl py-2 px-3 flex items-center gap-2 text-[#00CC44] font-mono font-bold text-[9px] uppercase tracking-wider justify-center">
                                                    <CheckCircle size={12} />
                                                    <span>เรียกพนักงานเช็คบิลแล้ว</span>
                                                </div>

                                                <div className="w-full text-center py-6 bg-white border border-[#D1D1CD] rounded-xl flex flex-col items-center gap-2.5 shadow-sm">
                                                    <Smartphone size={32} className="text-[#ff0000] animate-bounce" />
                                                    <div>
                                                        <h4 className="font-bold text-xs text-[#1A1A1A]">กรุณาชำระเงินโดยสแกนกับพนักงาน</h4>
                                                        <p className="text-[10px] text-[#767673] max-w-[250px] leading-relaxed mx-auto mt-1 px-4">
                                                            พนักงานกำลังนำใบแจ้งยอดชำระเงิน (Bill) และ QR Code ไปแสดงที่โต๊ะของท่านเพื่อสแกนจ่ายโดยตรง
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    );
                })()}
            </AnimatePresence>
        </div>
    );
}
