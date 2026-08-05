import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Search, ShoppingBag, MapPin, X, Plus, Minus, AlertTriangle, ShieldCheck, Check, Bell, Receipt, Smartphone, Upload, FileText, CheckCircle, Clock, ArrowLeft, Crown, UserCheck, Phone, Gamepad2, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import OptionSelectionModal from '../components/shared/OptionSelectionModal';
import { getShortBookingId } from '../utils/printerHelper';

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
    const [paxCount, setPaxCount] = useState(2);
    const [showPaxModal, setShowPaxModal] = useState(false);
    const [categories, setCategories] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [cart, setCart] = useState([]);

    // Member Flow States
    const [memberProfile, setMemberProfile] = useState(null);
    const [showMemberModal, setShowMemberModal] = useState(false);
    const [memberPhoneInput, setMemberPhoneInput] = useState('');
    const [memberLookupLoading, setMemberLookupLoading] = useState(false);
    const [isNewMemberForm, setIsNewMemberForm] = useState(false);
    const [newMemberForm, setNewMemberForm] = useState({ display_name: '', phone_number: '' });
    const [tableRemarkInput, setTableRemarkInput] = useState('');

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
            const { data: bookingData } = await supabase
                .from('bookings')
                .select('*, order_items(*, menu_items(*))')
                .eq('table_id', tableId)
                .in('status', ['pending', 'confirmed', 'seated', 'ready'])
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
            .subscribe((status, err) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
                    console.warn(`[Realtime Landing] Channel status: ${status}`, err || '');
                }
            });

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

            // Save tableId for arcade return navigation
            if (tableId) {
                localStorage.setItem('active_customer_table_id', tableId);
            }

            // Restore saved member profile from local storage if present
            let loadedMember = null;
            const savedMemberStr = localStorage.getItem('customer_member_profile');
            if (savedMemberStr) {
                try {
                    loadedMember = JSON.parse(savedMemberStr);
                    setMemberProfile(loadedMember);
                } catch (e) {
                    console.error('Error parsing member profile:', e);
                }
            }

            // 3. Fetch Active Table Session (Active until explicitly completed/closed)
            const { data: bookingData } = await supabase
                .from('bookings')
                .select('*, order_items(*, menu_items(*))')
                .eq('table_id', tableId)
                .in('status', ['pending', 'confirmed', 'seated', 'ready'])
                .order('booking_time', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (bookingData) {
                // Auto-link member profile in background if customer is logged in on their device
                const { data: { session } } = await supabase.auth.getSession();
                let effectiveUserId = bookingData.user_id;

                if (session?.user) {
                    effectiveUserId = session.user.id;
                    const { data: authProf } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
                    if (authProf) {
                        setMemberProfile(authProf);
                        localStorage.setItem('customer_member_profile', JSON.stringify(authProf));
                    }
                } else if (!effectiveUserId && loadedMember?.id) {
                    effectiveUserId = loadedMember.id;
                }

                if (effectiveUserId && bookingData.user_id !== effectiveUserId) {
                    await supabase
                        .from('bookings')
                        .update({ user_id: effectiveUserId })
                        .eq('id', bookingData.id);
                    bookingData.user_id = effectiveUserId;
                }
                setActiveBooking(bookingData);
                if (bookingData.pax) setPaxCount(bookingData.pax);
            } else {
                setActiveBooking(null);
                if (tableData?.capacity) setPaxCount(tableData.capacity);
                // Prompt customer to specify guest count if no active session
                setShowPaxModal(true);
            }

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
            
            const sortedItems = (itemRes.data || []).sort((a, b) => {
                const recA = a.is_recommended === true;
                const recB = b.is_recommended === true;
                if (recA !== recB) return recA ? -1 : 1;

                const orderA = a.sort_order ?? a.display_order ?? 999999;
                const orderB = b.sort_order ?? b.display_order ?? 999999;
                if (orderA !== orderB) return orderA - orderB;

                return a.name.localeCompare(b.name);
            });
            setMenuItems(sortedItems);
            
        } catch (err) {
            console.error('Initialization error:', err);
            toast.error('Failed to connect to restaurant database');
        } finally {
            setLoading(false);
        }
    };

    // Member lookup & Registration Handlers
    const handleMemberPhoneLookup = async (e) => {
        if (e) e.preventDefault();
        const cleanPhone = memberPhoneInput.replace(/\D/g, '');
        if (cleanPhone.length < 9) {
            toast.error('กรุณาระบุเบอร์โทรศัพท์อย่างน้อย 9-10 หลัก');
            return;
        }
        setMemberLookupLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('phone_number', cleanPhone)
                .limit(1)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setMemberProfile(data);
                localStorage.setItem('customer_member_profile', JSON.stringify(data));
                if (activeBooking) {
                    await supabase.from('bookings').update({ user_id: data.id }).eq('id', activeBooking.id);
                    setActiveBooking(prev => prev ? { ...prev, user_id: data.id } : null);
                }
                toast.success(`ยินดีต้อนรับสมาชิก คุณ${data.display_name || 'ลูกค้า'}`);
                setShowMemberModal(false);
                setIsNewMemberForm(false);
            } else {
                toast.info('ยังไม่พบสมาชิกเบอร์นี้ สามารถสมัครสมาชิกใหม่ได้ทันทีด้านล่างครับ');
                setIsNewMemberForm(true);
                setNewMemberForm({ display_name: '', phone_number: cleanPhone });
            }
        } catch (err) {
            console.error('Member lookup error:', err);
            toast.error('ค้นหาสมาชิกล้มเหลว: ' + err.message);
        } finally {
            setMemberLookupLoading(false);
        }
    };

    const handleRegisterMember = async (e) => {
        if (e) e.preventDefault();
        if (!newMemberForm.display_name.trim()) {
            toast.error('กรุณาระบุชื่อของคุณ');
            return;
        }
        setMemberLookupLoading(true);
        try {
            const newId = crypto.randomUUID();
            const newPayload = {
                id: newId,
                display_name: newMemberForm.display_name.trim(),
                phone_number: newMemberForm.phone_number.trim(),
                role: 'customer',
                xhaus_balance: 0
            };

            const { data, error } = await supabase
                .from('profiles')
                .insert(newPayload)
                .select()
                .single();

            if (error) throw error;

            const savedProfile = data || newPayload;
            setMemberProfile(savedProfile);
            localStorage.setItem('customer_member_profile', JSON.stringify(savedProfile));
            if (activeBooking) {
                await supabase.from('bookings').update({ user_id: savedProfile.id }).eq('id', activeBooking.id);
                setActiveBooking(prev => prev ? { ...prev, user_id: savedProfile.id } : null);
            }
            toast.success(`สมัครสมาชิกสำเร็จ! ยินดีต้อนรับคุณ ${savedProfile.display_name}`);
            setShowMemberModal(false);
            setIsNewMemberForm(false);
        } catch (err) {
            console.error('Register member error:', err);
            toast.error('สมัครสมาชิกไม่สำเร็จ: ' + err.message);
        } finally {
            setMemberLookupLoading(false);
        }
    };

    const handleUnlinkMember = () => {
        setMemberProfile(null);
        localStorage.removeItem('customer_member_profile');
        toast.info('ยกเลิกการเชื่อมต่อสมาชิกเรียบร้อยแล้ว');
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
            // 1. Fetch latest active table session to prevent session duplication when 10 guests order concurrently
            const { data: latestTableSession } = await supabase
                .from('bookings')
                .select('*')
                .eq('table_id', parseInt(tableId))
                .in('status', ['pending', 'confirmed', 'seated', 'ready'])
                .order('booking_time', { ascending: false })
                .limit(1)
                .maybeSingle();

            let currentBooking = latestTableSession || activeBooking;

            let remarkStr = 'QR Walk-in Guest';
            if (tableRemarkInput.trim()) {
                remarkStr += ` [NOTE: ${tableRemarkInput.trim()}]`;
            }

            if (!currentBooking) {
                const trackingToken = crypto.randomUUID();
                const newBookingPayload = {
                    table_id: parseInt(tableId),
                    status: 'seated', // QR orders auto-accepted immediately
                    booking_type: 'walk_in',
                    booking_time: new Date().toISOString(),
                    pax: paxCount || table?.capacity || 2,
                    staff_remark: remarkStr,
                    tracking_token: trackingToken,
                    total_amount: cartSubtotal,
                    user_id: memberProfile?.id || null
                };

                const { data: newBooking, error: createError } = await supabase
                    .from('bookings')
                    .insert(newBookingPayload)
                    .select()
                    .single();

                if (createError) throw createError;
                currentBooking = newBooking;
            }

            // 2. Insert new items into order_items
            const itemsToInsert = cart.map(item => ({
                booking_id: currentBooking.id,
                menu_item_id: item.id,
                quantity: item.qty,
                price_at_time: item.totalPricePerUnit,
                selected_options: (item.optionsSummary && item.optionsSummary.length > 0) 
                    ? item.optionsSummary 
                    : item.selectedOptions || {}
            }));

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(itemsToInsert);

            if (itemsError) throw itemsError;

            let updatedRemark = currentBooking.staff_remark || 'QR Walk-in Guest';
            if (!updatedRemark.toLowerCase().includes('qr')) {
                updatedRemark = `[QR] ${updatedRemark}`;
            }
            if (tableRemarkInput.trim() && !updatedRemark.includes(tableRemarkInput.trim())) {
                updatedRemark += ` [NOTE: ${tableRemarkInput.trim()}]`;
            }

            const updateData = {
                status: 'seated', // Auto-accepted; triggers auto-print on POS
                // total_amount is dynamically calculated on the POS side and Status page to avoid concurrent race conditions
                staff_remark: updatedRemark,
                source: 'qr'
            };
            if (memberProfile?.id && !currentBooking.user_id) {
                updateData.user_id = memberProfile.id;
            }

            const { error: bookingUpdateError } = await supabase
                .from('bookings')
                .update(updateData)
                .eq('id', currentBooking.id);

            if (bookingUpdateError) throw bookingUpdateError;

            toast.success('ออเดอร์ถูกส่งไปยังพนักงานแล้ว!');
            setCart([]);
            setCartOpen(false);
            
            // Save active tracking token to local storage
            localStorage.setItem(`table_${tableId}_token`, currentBooking.tracking_token);

            // Redirect to status page
            navigate(`/table/${tableId}/status`);

        } catch (err) {
            console.error('Checkout error:', err);
            toast.error('Failed to submit order. Please try again. Error: ' + err.message);
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
                <div className="w-12 h-12 border-4 border-[#ff0000] border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-[#767673] text-xs font-mono font-bold tracking-widest uppercase">Connecting to table...</p>
            </div>
        );
    }

    if (gpsChecking) {
        return (
            <div className="min-h-screen bg-[#ECECE9] text-[#1A1A1A] flex flex-col items-center justify-center font-sans p-6 text-center">
                <MapPin size={48} className="text-[#ff0000] animate-bounce mb-6" />
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
                <div className="w-20 h-20 bg-[#ff0000]/10 border border-[#ff0000]/20 rounded-full flex items-center justify-center text-[#ff0000] mb-6 animate-pulse">
                    <AlertTriangle size={36} />
                </div>
                <h3 className="font-mono font-bold text-sm tracking-wider uppercase mb-3 text-[#ff0000]">{errorTitle}</h3>
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
                        <div className="bg-[#ff0000] text-white text-[8px] font-mono font-bold px-1.5 py-0.5 rounded">
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
            <div className="p-5 bg-white border-b border-[#D1D1CD] flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-bold text-[#1A1A1A] mb-0.5 flex items-center gap-2">
                        <span>ยินดีต้อนรับสู่โต๊ะ {table?.table_name}</span>
                        {activeBooking?.booking_time && (() => {
                            const startMins = Math.max(0, Math.floor((Date.now() - new Date(activeBooking.booking_time).getTime()) / 60000));
                            const formatted = startMins < 60 ? `${startMins} นาที` : `${Math.floor(startMins / 60)} ชม. ${startMins % 60} นาที`;
                            return (
                                <span className="bg-[#F5F5F2] border border-[#D1D1CD] text-[#1A1A1A] px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold flex items-center gap-1">
                                    ⏱️ {formatted}
                                </span>
                            );
                        })()}
                    </h2>
                    <p className="text-[11px] text-[#767673] leading-relaxed">
                        เลือกรายการอาหารด้านล่างและยืนยันออเดอร์เพื่อส่งตรงไปยังห้องครัว
                    </p>
                </div>
                <button
                    onClick={() => setShowPaxModal(true)}
                    className="shrink-0 ml-3 bg-[#F5F5F2] hover:bg-[#EAEAE6] border border-[#D1D1CD] text-[#1A1A1A] px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm cursor-pointer"
                >
                    <span>👥 {paxCount} คน</span>
                    <span className="text-[10px] text-[#ff0000] font-bold">แก้ไข</span>
                </button>
            </div>

            {/* Seamless Member Bar */}
            <div className="px-5 py-3 bg-[#F5F5F2] border-b border-[#D1D1CD] flex items-center justify-between shadow-inner">
                {memberProfile ? (
                    <div className="flex items-center gap-2.5 text-xs">
                        <div className="w-8 h-8 rounded-full bg-[oklch(52%_0.16_28)]/10 text-[oklch(52%_0.16_28)] border border-[oklch(52%_0.16_28)]/30 flex items-center justify-center font-bold shrink-0">
                            <Crown size={16} />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 font-bold text-[#1A1A1A]">
                                <span>คุณ {memberProfile.display_name || 'สมาชิก'}</span>
                                <span className="text-[10px] text-[#767673] font-mono">({memberProfile.phone_number || 'Member'})</span>
                            </div>
                            <div className="text-[10px] font-mono font-bold text-[oklch(52%_0.16_28)]">
                                🪙 {parseFloat(memberProfile.xhaus_balance || 0).toFixed(0)} xhaus
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2.5 text-xs">
                        <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                            <Crown size={16} />
                        </div>
                        <div>
                            <span className="font-bold text-[#1A1A1A] block text-xs">สมาชิกสะสมแต้ม</span>
                            <span className="text-[10px] text-[#767673]">ระบุเบอร์โทรเพื่อสะสมแต้ม xhaus</span>
                        </div>
                    </div>
                )}

                <button
                    onClick={() => setShowMemberModal(true)}
                    className="bg-white hover:bg-[#EAEAE6] border border-[#D1D1CD] text-[#1A1A1A] px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 shrink-0"
                >
                    {memberProfile ? (
                        <span>สลับสมาชิก</span>
                    ) : (
                        <>
                            <UserPlus size={13} className="text-[oklch(52%_0.16_28)]" />
                            <span>เข้าสู่ระบบ / สมัคร</span>
                        </>
                    )}
                </button>
            </div>

            {/* Menu search and category filters */}
            <div className="p-4 sticky top-[61px] bg-[#ECECE9]/95 backdrop-blur-md z-30 space-y-3 border-b border-[#D1D1CD]">
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#767673]" size={16} />
                    <input 
                        type="search" 
                        placeholder="ค้นหาเมนูอร่อย..." 
                        className="w-full bg-white border border-[#D1D1CD] rounded-xl py-2.5 pl-10 pr-4 text-[#1A1A1A] focus:outline-none focus:border-[#ff0000] text-xs transition-colors"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none">
                    <button 
                        onClick={() => setActiveCategory('all')} 
                        className={`px-4 py-2 rounded-xl text-[11px] font-sans font-bold uppercase tracking-wider transition-all border whitespace-nowrap shrink-0 cursor-pointer ${activeCategory === 'all' ? 'bg-[#ff0000] border-[#c00000] text-white shadow-sm' : 'bg-white border-[#D1D1CD] text-[#767673] hover:text-[#1A1A1A] hover:border-[#B0B0AC] shadow-sm'}`}
                    >
                        เมนูทั้งหมด
                    </button>
                    {categories.map(cat => (
                        <button 
                            key={cat.id} 
                            onClick={() => setActiveCategory(cat.id)} 
                            className={`px-4 py-2 rounded-xl text-[11px] font-sans font-bold uppercase tracking-wider transition-all border whitespace-nowrap shrink-0 cursor-pointer ${activeCategory === cat.id ? 'bg-[#ff0000] border-[#c00000] text-white shadow-sm' : 'bg-white border-[#D1D1CD] text-[#767673] hover:text-[#1A1A1A] hover:border-[#B0B0AC] shadow-sm'}`}
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
                                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[#767673] font-bold text-lg uppercase font-mono">
                                        {item.name.charAt(0)}
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/5"></div>
                                <div className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-[#ff0000] text-white flex items-center justify-center shadow transition-all hover:scale-105">
                                    <Plus size={14} />
                                </div>
                                {item.is_recommended && (
                                    <div className="absolute top-2 left-2 bg-[#ff0000] text-white text-[8px] font-mono font-bold px-1.5 py-0.5 rounded shadow-sm uppercase tracking-wider">
                                        BOLD
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex flex-col flex-1 px-1 justify-between min-h-[60px]">
                                <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <h4 className="font-bold text-xs text-[#1A1A1A] line-clamp-1 leading-tight">{item.name}</h4>
                                        {item.is_recommended && (
                                            <span className="bg-[#ff0000] text-white text-[8px] font-mono font-bold px-1.5 py-0.2 rounded uppercase tracking-wider scale-90 origin-left">
                                                BOLD
                                            </span>
                                        )}
                                    </div>
                                    {item.description && <p className="text-[9px] text-[#767673] line-clamp-2 mt-0.5 leading-snug">{item.description}</p>}
                                </div>
                                <div className="pt-2 flex items-center justify-between">
                                    <span className="text-[#ff0000] font-mono font-bold text-xs">฿{item.price}</span>
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
                        <Bell size={14} className="text-[#ff0000]" />
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
                        className="w-full bg-[#ff0000] hover:bg-[#d00000] text-white py-3 px-5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-between shadow-md active:scale-98 transition-transform cursor-pointer"
                    >
                        <div className="flex items-center gap-2">
                            <ShoppingBag size={14} />
                            <span className="bg-white text-[#ff0000] text-[9px] px-1.5 py-0.5 rounded font-black font-mono animate-pulse">
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
                                            <p className="text-[#ff0000] font-mono font-bold text-xs mt-2">฿{(item.totalPricePerUnit * item.qty).toLocaleString()}</p>
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

                            {/* Table Kitchen Remark Input */}
                            <div className="pt-2 border-t border-[#D1D1CD]/60 shrink-0">
                                <label className="block text-[10px] font-mono font-bold text-[#767673] uppercase tracking-wider mb-1">
                                    📝 หมายเหตุเพิ่มเติมถึงครัว (Kitchen Remark)
                                </label>
                                <input
                                    type="text"
                                    placeholder="เช่น ขอช้อนส้อมผู้ใหญ่เพิ่ม, เสิร์ฟพร้อมกันหมด"
                                    value={tableRemarkInput}
                                    onChange={(e) => setTableRemarkInput(e.target.value)}
                                    className="w-full bg-white border border-[#D1D1CD] rounded-xl py-2 px-3 text-xs text-[#1A1A1A] placeholder-[#767673] focus:outline-none focus:border-[#ff0000] transition-colors"
                                />
                            </div>

                            {/* Drawer Footer */}
                            <div className="border-t border-[#D1D1CD] pt-3 space-y-3 shrink-0">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-[#767673] text-[10px] uppercase font-mono font-bold tracking-wider">ยอดรวมสุทธิ (Subtotal)</span>
                                    <span className="text-xl font-black text-[#ff0000] font-mono">฿{cartSubtotal.toLocaleString()}.-</span>
                                </div>

                                <button 
                                    onClick={handleCheckout}
                                    disabled={submitting}
                                    className="w-full bg-[#ff0000] disabled:bg-[#ff0000]/50 text-white py-3.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
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
                                            Table {table?.table_name} · Queue #{getShortBookingId(activeBooking)}
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
                                                                <span className="w-2 h-2 rounded-full bg-[#ff0000] shadow-[0_0_6px_#ff0000] animate-pulse" />
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
                                                                    <span className="bg-[#ff0000]/10 text-[#ff0000] text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded leading-none">
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
                                                        <span className="font-bold text-[#ff0000]">{item.quantity}x</span>
                                                        <div>
                                                            <span className="font-bold text-[#1A1A1A] block leading-tight">{item.menu_items?.name}</span>
                                                            {item.selected_options && (
                                                                <div className="text-[9px] text-[#ff0000] mt-0.5 font-bold space-y-0.5">
                                                                    {Array.isArray(item.selected_options) ? (
                                                                        item.selected_options.map((opt, i) => (
                                                                            <div key={i}>
                                                                                ▶ {typeof opt === 'object' ? `${opt.group_name ? `${opt.group_name}: ` : ''}${opt.name}` : opt}
                                                                            </div>
                                                                        ))
                                                                    ) : typeof item.selected_options === 'object' ? (
                                                                        Object.entries(item.selected_options).map(([k, v], i) => (
                                                                            <div key={i}>
                                                                                ▶ {Array.isArray(v) ? `${k}: ${v.join(', ')}` : `${k}: ${v}`}
                                                                            </div>
                                                                        ))
                                                                    ) : null}
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
                                                <span className="text-lg font-black text-[#ff0000] font-mono">฿{activeBooking.total_amount?.toLocaleString() || 0}.-</span>
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
                                                    className="w-full bg-[#ff0000] hover:bg-[#d00000] border border-[#c00000] text-white py-3.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-97"
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

            {/* Guest Count Modal */}
            {showPaxModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl font-sans text-[#1A1A1A] animate-in fade-in zoom-in-95 duration-150">
                        <div className="p-4 border-b border-[#D1D1CD] flex items-center justify-between">
                            <div>
                                <h3 className="font-mono font-bold text-xs uppercase tracking-wider">ระบุจำนวนลูกค้า (Party Size)</h3>
                                <p className="text-[10px] text-[#767673] font-mono mt-0.5">โต๊ะ {table?.table_name}</p>
                            </div>
                            {activeBooking && (
                                <button onClick={() => setShowPaxModal(false)} className="p-1 hover:bg-[#EAEAE6] rounded-lg text-[#767673]">
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                        
                        <div className="p-6 flex flex-col items-center gap-4 text-center">
                            <div className="text-xs font-bold text-[#1A1A1A]">
                                กรุณาระบุจำนวนลูกค้าสำหรับโต๊ะนี้ *
                            </div>
                            <p className="text-[10px] text-[#767673]">เพื่อความสะดวกในการบริการและจัดเตรียมอุปกรณ์</p>

                            {/* Stepper */}
                            <div className="flex items-center gap-4 my-1">
                                <button 
                                    onClick={() => setPaxCount(prev => Math.max(1, prev - 1))}
                                    className="w-12 h-12 rounded-xl bg-white border border-[#D1D1CD] hover:border-[#1A1A1A] text-2xl font-bold flex items-center justify-center active:scale-95 transition-all shadow-sm cursor-pointer select-none"
                                >
                                    -
                                </button>
                                <div className="w-20 h-12 bg-white border-2 border-[#ff0000] rounded-xl flex items-center justify-center text-2xl font-mono font-black text-[#1A1A1A] shadow-inner">
                                    {paxCount}
                                </div>
                                <button 
                                    onClick={() => setPaxCount(prev => prev + 1)}
                                    className="w-12 h-12 rounded-xl bg-white border border-[#D1D1CD] hover:border-[#1A1A1A] text-2xl font-bold flex items-center justify-center active:scale-95 transition-all shadow-sm cursor-pointer select-none"
                                >
                                    +
                                </button>
                            </div>

                            {/* Quick Presets */}
                            <div className="grid grid-cols-5 gap-2 w-full mt-2">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                    <button
                                        key={num}
                                        onClick={() => setPaxCount(num)}
                                        className={`py-2 rounded-xl font-mono font-bold text-xs transition-all cursor-pointer ${paxCount === num ? 'bg-[#ff0000] text-white shadow-md scale-[1.03]' : 'bg-white border border-[#D1D1CD] text-[#1A1A1A]'}`}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 border-t border-[#D1D1CD] bg-[#EBEBE9]">
                            <button
                                onClick={async () => {
                                    if (!paxCount || paxCount <= 0) {
                                        toast.error('กรุณาระบุจำนวนคน');
                                        return;
                                    }
                                    if (activeBooking?.id) {
                                        await supabase.from('bookings').update({ pax: paxCount }).eq('id', activeBooking.id);
                                        toast.success(`อัปเดตจำนวนลูกค้าเป็น ${paxCount} คนแล้ว`);
                                    }
                                    setShowPaxModal(false);
                                }}
                                className="w-full bg-[#ff0000] hover:bg-[#d00000] text-white py-3 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                            >
                                <Check size={16} /> ยืนยันจำนวนคน (Confirm) *
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Member Identification Modal */}
            {showMemberModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#F5F5F2] border border-[#D1D1CD] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl font-sans text-[#1A1A1A]">
                        <div className="p-4 border-b border-[#D1D1CD] flex items-center justify-between bg-white">
                            <div className="flex items-center gap-2">
                                <Crown className="text-[oklch(52%_0.16_28)]" size={18} />
                                <h3 className="font-mono font-bold text-xs uppercase tracking-wider">ระบบสมาชิก HAUS MEMBER</h3>
                            </div>
                            <button onClick={() => setShowMemberModal(false)} className="p-1 hover:bg-[#EAEAE6] rounded-lg text-[#767673]">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            {memberProfile && (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-xs">
                                    <div>
                                        <span className="text-[10px] text-emerald-700 font-mono font-bold uppercase block">สมาชิกที่เชื่อมต่ออยู่</span>
                                        <span className="font-bold text-emerald-900">{memberProfile.display_name} ({memberProfile.phone_number || 'Member'})</span>
                                    </div>
                                    <button
                                        onClick={handleUnlinkMember}
                                        className="text-[10px] text-red-600 font-mono font-bold underline cursor-pointer"
                                    >
                                        เลิกเชื่อมต่อ
                                    </button>
                                </div>
                            )}

                            {!isNewMemberForm ? (
                                <form onSubmit={handleMemberPhoneLookup} className="space-y-3">
                                    <label className="block text-xs font-bold text-[#1A1A1A]">
                                        ระบุเบอร์โทรศัพท์เพื่อค้นหาสมาชิก
                                    </label>
                                    <div className="relative">
                                        <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#767673]" />
                                        <input
                                            type="tel"
                                            placeholder="08X-XXX-XXXX"
                                            value={memberPhoneInput}
                                            onChange={(e) => setMemberPhoneInput(e.target.value)}
                                            className="w-full bg-white border border-[#D1D1CD] rounded-xl py-2.5 pl-10 pr-4 text-sm font-mono font-bold text-[#1A1A1A] focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={memberLookupLoading}
                                        className="w-full bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white py-2.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-sm active:scale-97 cursor-pointer"
                                    >
                                        {memberLookupLoading ? 'กำลังค้นหา...' : 'ค้นหาสมาชิก'}
                                    </button>
                                </form>
                            ) : (
                                <form onSubmit={handleRegisterMember} className="space-y-3">
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 leading-relaxed">
                                        ✨ ไม่พบสมาชิกเบอร์ <strong>{newMemberForm.phone_number}</strong> สามารถระบุชื่อเพื่อสมัครสมาชิกทันที!
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[#1A1A1A] mb-1">
                                            ชื่อ-นามสกุล หรือ ชื่อเล่น
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="เช่น คุณปอนด์"
                                            value={newMemberForm.display_name}
                                            onChange={(e) => setNewMemberForm(prev => ({ ...prev, display_name: e.target.value }))}
                                            className="w-full bg-white border border-[#D1D1CD] rounded-xl py-2.5 px-3 text-sm font-bold text-[#1A1A1A] focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={memberLookupLoading}
                                        className="w-full bg-[#00CC44] hover:bg-[#00b33c] text-white py-2.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-sm active:scale-97 cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        <Check size={16} />
                                        {memberLookupLoading ? 'กำลังบันทึก...' : 'ยืนยันสมัครสมาชิก & เชื่อมต่อ'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsNewMemberForm(false)}
                                        className="w-full text-center text-xs text-[#767673] underline font-mono cursor-pointer"
                                    >
                                        ย้อนกลับไปค้นหาใหม่
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
