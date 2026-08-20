/* Hallmark · component: CustomerOrderLanding · genre: modern-minimal · theme: Atelier (Dieter Rams + Thai Modern OKLCH)
 * states: default · hover · focus · active · loading · error · success
 * contrast: pass (APCA / WCAG compliant)
 * Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
    Search, ShoppingBag, MapPin, X, Plus, Minus, AlertTriangle, 
    ShieldCheck, Check, Bell, Receipt, Smartphone, CheckCircle, 
    Clock, Crown, UserCheck, Phone, Gamepad2, UserPlus, Music, 
    ChevronRight, Sparkles, RefreshCw, Layers, Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import OptionSelectionModal from '../components/shared/OptionSelectionModal';
import { getShortBookingId } from '../utils/printerHelper';
import { sendPOSBroadcast } from '../utils/realtimeNotifier';

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

// Session freshness validator (Discards sessions older than 16 hours from previous days)
function isBookingActiveAndFresh(booking) {
    if (!booking) return false;
    if (!['pending', 'confirmed', 'seated', 'ready'].includes(booking.status)) return false;
    if (booking.booking_time) {
        const bookingAgeMs = Date.now() - new Date(booking.booking_time).getTime();
        const MAX_SESSION_AGE_MS = 16 * 60 * 60 * 1000; // 16 hours
        if (bookingAgeMs > MAX_SESSION_AGE_MS) {
            console.warn('[Landing] Stale booking session detected (>16h):', booking.id);
            return false;
        }
    }
    return true;
}

export default function CustomerOrderLanding() {
    const { tableId } = useParams();
    const navigate = useNavigate();

    // UI States
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const submittingRef = useRef(false);
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');
    const [cartOpen, setCartOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);

    // Tracking & Checkout States
    const [trackingOpen, setTrackingOpen] = useState(false);
    const [requestingBill, setRequestingBill] = useState(false);
    const [callingStaff, setCallingStaff] = useState(false);

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
    const [tierDetails, setTierDetails] = useState({ current_tier: 'Haus Common', multiplier: 1.00 });
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
        qr_radius: '100',
        qr_kitchen_open_time: '10:00',
        qr_kitchen_close_time: '22:00',
        qr_kitchen_cutoff_enabled: 'true',
        qr_kitchen_mode: 'auto',
        qr_kitchen_closed_categories: '[]'
    });
    const [currentTimeTick, setCurrentTimeTick] = useState(Date.now());

    // 15-second interval ticker to evaluate kitchen closing time in real-time
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTimeTick(Date.now());
        }, 15000);
        return () => clearInterval(interval);
    }, []);

    // Ref to prevent circular triggers in profile sync
    const currentMemberIdRef = useRef(null);
    useEffect(() => {
        currentMemberIdRef.current = memberProfile?.id || null;
    }, [memberProfile?.id]);

    // Fetch Tier details dynamically when memberProfile changes
    useEffect(() => {
        if (!memberProfile?.id) {
            setTierDetails({ current_tier: 'Haus Common', multiplier: 1.00 });
            return;
        }
        const fetchTier = async () => {
            try {
                const { data } = await supabase.rpc('get_member_tier_details', { p_user_id: memberProfile.id });
                if (data && data.length > 0) {
                    setTierDetails(data[0]);
                }
            } catch (e) {
                console.warn('Fetch tier details error:', e);
            }
        };
        fetchTier();
    }, [memberProfile?.id]);

    // Live Realtime listener for member profile changes (points, drink stamps, free quota)
    useEffect(() => {
        if (!memberProfile?.id) return;

        const channel = supabase
            .channel(`realtime_landing_profile_${memberProfile.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'profiles',
                filter: `id=eq.${memberProfile.id}`
            }, (payload) => {
                if (payload.new) {
                    setMemberProfile(prev => ({ ...prev, ...payload.new }));
                    localStorage.setItem('customer_member_profile', JSON.stringify(payload.new));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [memberProfile?.id]);

    // Cross-tab and window storage sync
    useEffect(() => {
        const handleProfileSync = () => {
            const saved = localStorage.getItem('customer_member_profile');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (parsed?.id && parsed.id !== currentMemberIdRef.current) {
                        fetchFreshProfile(parsed.id);
                    }
                } catch (err) {
                    console.warn('Storage sync parse error:', err);
                }
            } else if (currentMemberIdRef.current) {
                setMemberProfile(null);
            }
        };

        window.addEventListener('storage', handleProfileSync);
        return () => {
            window.removeEventListener('storage', handleProfileSync);
        };
    }, []);

    const fetchFreshProfile = async (userId) => {
        if (!userId) return null;
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (!error && data) {
                setMemberProfile(data);
                currentMemberIdRef.current = data.id;
                localStorage.setItem('customer_member_profile', JSON.stringify(data));
                return data;
            }
        } catch (err) {
            console.warn('Failed to fetch fresh profile:', err);
        }
        return null;
    };

    // Live Fetch Menu Items & Categories
    const fetchMenuData = useCallback(async () => {
        try {
            const [catRes, itemRes] = await Promise.all([
                supabase.from('menu_categories').select('*').order('display_order'),
                supabase.from('menu_items').select('*, menu_item_options(*, option_groups(*, option_choices(*)))').eq('is_available', true).order('name')
            ]);
            
            if (catRes.data) {
                setCategories(catRes.data);
            }
            if (itemRes.data) {
                const sortedItems = (itemRes.data || []).sort((a, b) => {
                    const recA = a.is_recommended === true;
                    const recB = b.is_recommended === true;
                    if (recA !== recB) return recA ? -1 : 1;

                    const orderA = a.sort_order ?? a.display_order ?? 999999;
                    const orderB = b.sort_order ?? b.display_order ?? 999999;
                    if (orderA !== orderB) return orderA - orderB;

                    return (a.name || '').localeCompare(b.name || '');
                });
                setMenuItems(sortedItems);
            }
        } catch (err) {
            console.warn('Failed to fetch menu data:', err);
        }
    }, []);

    // Live Fetch App Settings
    const fetchSettings = useCallback(async () => {
        try {
            const { data: settingsData } = await supabase.from('app_settings').select('*');
            if (settingsData) {
                const map = settingsData.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
                setSettings(prev => ({ ...prev, ...map }));
            }
        } catch (err) {
            console.warn('Failed to fetch settings:', err);
        }
    }, []);

    // Refresh Table's Active Booking (and cleanup stale sessions)
    const refreshActiveBooking = useCallback(async (resolvedId) => {
        const targetId = resolvedId || table?.id || (tableId && /^\d+$/.test(tableId) ? parseInt(tableId) : null);
        if (!targetId) return;
        try {
            const { data: bookingData } = await supabase
                .from('bookings')
                .select('*, order_items(*, menu_items(*))')
                .eq('table_id', targetId)
                .in('status', ['pending', 'confirmed', 'seated', 'ready'])
                .order('booking_time', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (bookingData && isBookingActiveAndFresh(bookingData)) {
                setActiveBooking(bookingData);
                if (bookingData.pax) {
                    setPaxCount(bookingData.pax);
                }
            } else {
                // Table session is free or was closed/completed in POS -> Clean stale tokens
                setActiveBooking(null);
                if (tableId) localStorage.removeItem(`table_${tableId}_token`);
                if (table?.id) localStorage.removeItem(`table_${table.id}_token`);
            }
        } catch (err) {
            console.error('Error refreshing active booking:', err);
        }
    }, [table?.id, tableId]);

    // Realtime Postgres Listeners for Table Session & Catalog Changes
    useEffect(() => {
        if (!table?.id) return;

        // 1. Table Session Channel (Live Orders, Bill Changes, Calling Staff)
        const tableChannel = supabase.channel(`realtime_landing_table_${table.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'bookings',
                filter: `table_id=eq.${table.id}`
            }, () => {
                refreshActiveBooking(table.id);
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'order_items'
            }, () => {
                refreshActiveBooking(table.id);
            })
            .subscribe((status, err) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
                    console.warn(`[Realtime Landing Table] Channel: ${status}`, err || '');
                }
            });

        // 2. Realtime Menu Catalog & App Settings Sync (Instant admin price/status/cutoff updates)
        const catalogChannel = supabase.channel(`realtime_landing_catalog_${table.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'menu_items'
            }, () => {
                fetchMenuData();
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'menu_categories'
            }, () => {
                fetchMenuData();
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'app_settings'
            }, () => {
                fetchSettings();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(tableChannel);
            supabase.removeChannel(catalogChannel);
        };
    }, [table?.id, refreshActiveBooking, fetchMenuData, fetchSettings]);

    useEffect(() => {
        initPage();
    }, [tableId]);

    const initPage = async () => {
        setLoading(true);
        try {
            // 1. Fetch Table Layout (Prioritizes table_name like 'O1', fallback to numeric ID)
            let tableData = null;
            const cleanParam = (tableId || '').trim();
            const isDigits = /^\d+$/.test(cleanParam);

            if (isDigits) {
                // Priority 1: Match table_name exactly (e.g. table actually named "11")
                const { data: byName } = await supabase
                    .from('tables_layout')
                    .select('*')
                    .ilike('table_name', cleanParam)
                    .maybeSingle();

                if (byName) {
                    tableData = byName;
                } else {
                    // Priority 2: Fallback to primary key id (e.g. scanned legacy flyer with numeric id)
                    const { data: byId } = await supabase
                        .from('tables_layout')
                        .select('*')
                        .eq('id', parseInt(cleanParam))
                        .maybeSingle();
                    tableData = byId;
                }
            } else {
                const { data: byName } = await supabase
                    .from('tables_layout')
                    .select('*')
                    .ilike('table_name', cleanParam)
                    .maybeSingle();
                tableData = byName;
            }

            if (!tableData) {
                toast.error(`ไม่พบข้อมูลโต๊ะ ${tableId}`);
                setLoading(false);
                return;
            }
            setTable(tableData);

            // Save tableId and table_name for arcade and return navigation
            localStorage.setItem('active_customer_table_id', tableData.id.toString());
            localStorage.setItem('active_customer_table_name', tableData.table_name || `Table ${tableData.id}`);

            // If accessed via numeric ID (e.g. /table/11) but table's true name is different (e.g. "O1"), normalize URL
            if (isDigits && tableData.table_name && tableData.table_name.toLowerCase() !== cleanParam.toLowerCase()) {
                navigate(`/table/${encodeURIComponent(tableData.table_name)}`, { replace: true });
            }

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

            // 3. Fetch Active Table Session
            const { data: bookingData } = await supabase
                .from('bookings')
                .select('*, order_items(*, menu_items(*))')
                .eq('table_id', tableData.id)
                .in('status', ['pending', 'confirmed', 'seated', 'ready'])
                .order('booking_time', { ascending: false })
                .limit(1)
                .maybeSingle();

            // Resolve effective member profile (Auth session > LocalStorage profile > Table booking user_id)
            const { data: { session } } = await supabase.auth.getSession();
            let effectiveUserId = null;

            if (session?.user?.id) {
                effectiveUserId = session.user.id;
            } else if (loadedMember?.id) {
                effectiveUserId = loadedMember.id;
            } else if (bookingData?.user_id) {
                effectiveUserId = bookingData.user_id;
            }

            if (effectiveUserId) {
                const freshProf = await fetchFreshProfile(effectiveUserId);
                if (freshProf && bookingData && bookingData.user_id !== effectiveUserId) {
                    await supabase
                        .from('bookings')
                        .update({ user_id: effectiveUserId })
                        .eq('id', bookingData.id);
                    bookingData.user_id = effectiveUserId;
                }
            }

            if (bookingData && isBookingActiveAndFresh(bookingData)) {
                setActiveBooking(bookingData);
                if (bookingData.pax) setPaxCount(bookingData.pax);
            } else {
                // Table is free or booking is stale -> Clear stale tracking token
                setActiveBooking(null);
                if (tableId) localStorage.removeItem(`table_${tableId}_token`);
                if (tableData.id) localStorage.removeItem(`table_${tableData.id}_token`);
                if (tableData?.capacity) setPaxCount(tableData.capacity);
                setShowPaxModal(true);
            }

            // 4. Geofencing check
            if (loadedSettings.qr_gps_enabled === 'true') {
                performGeofenceCheck(loadedSettings);
            } else {
                setGpsStatus('verified');
                setGpsChecking(false);
            }

            // 5. Fetch Menu Catalog
            await fetchMenuData();
            
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
                window.dispatchEvent(new Event('customer_profile_updated'));
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
                xhaus_balance: 0,
                drink_stamp_count: 0,
                free_drink_quota: 0
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
            window.dispatchEvent(new Event('customer_profile_updated'));
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
        window.dispatchEvent(new Event('customer_profile_updated'));
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
                
                const rawLat = loadedSettings?.qr_latitude;
                const rawLon = loadedSettings?.qr_longitude;
                const rawRadius = loadedSettings?.qr_radius;

                const shopLat = !isNaN(parseFloat(rawLat)) ? parseFloat(rawLat) : 17.40722;
                const shopLon = !isNaN(parseFloat(rawLon)) ? parseFloat(rawLon) : 104.78028;
                const allowedRadius = !isNaN(parseFloat(rawRadius)) ? parseFloat(rawRadius) : 100;

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
                if (error.code === error.PERMISSION_DENIED) {
                    errMsg = 'การเข้าถึงตำแหน่งถูกปฏิเสธ กรุณาเปิดใช้งานสิทธิ์พิกัด (GPS Location) ในการตั้งค่าเบราว์เซอร์เพื่อสั่งอาหาร';
                } else if (error.code === error.POSITION_UNAVAILABLE) {
                    errMsg = 'ไม่สามารถระบุตำแหน่งพิกัดของอุปกรณ์ได้ กรุณาลองใหม่อีกครั้ง';
                } else if (error.code === error.TIMEOUT) {
                    errMsg = 'ค้นหาพิกัด GPS ล้มเหลว (การเชื่อมต่อหมดเวลา)';
                }
                setGpsError(errMsg);
                setGpsChecking(false);
            },
            options
        );
    };

    // Quick Staff Service Handlers
    const handleCallStaff = async () => {
        const effectiveNumericTableId = table?.id || (tableId && /^\d+$/.test(tableId) ? parseInt(tableId) : null);
        if (!effectiveNumericTableId || callingStaff) return;

        setCallingStaff(true);
        try {
            let currentBooking = activeBooking;
            
            if (!currentBooking) {
                const trackingToken = crypto.randomUUID();
                const newBookingPayload = {
                    table_id: effectiveNumericTableId,
                    status: 'pending',
                    booking_type: 'walk_in',
                    booking_time: new Date().toISOString(),
                    pax: paxCount || table?.capacity || 2,
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

            // Instant Realtime Broadcast to POS (< 50ms)
            sendPOSBroadcast('call_staff', {
                table_id: effectiveNumericTableId,
                table_name: table?.table_name || `โต๊ะ #${effectiveNumericTableId}`,
                booking_id: currentBooking?.id
            });

            toast.success('แจ้งเรียกพนักงานเรียบร้อยแล้ว กรุณารอสักครู่ครับ');
        } catch (err) {
            console.error("Failed to call staff:", err);
            toast.error('ไม่สามารถเรียกพนักงานได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง');
        } finally {
            setCallingStaff(false);
        }
    };

    const handleRequestBill = async () => {
        if (!activeBooking || requestingBill) return;
        const effectiveNumericTableId = table?.id || (tableId && /^\d+$/.test(tableId) ? parseInt(tableId) : null);
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

            // Instant Realtime Broadcast to POS (< 50ms)
            sendPOSBroadcast('call_bill', {
                table_id: effectiveNumericTableId || activeBooking.table_id,
                table_name: table?.table_name || `โต๊ะ #${effectiveNumericTableId || activeBooking.table_id}`,
                booking_id: activeBooking.id
            });

            toast.success('แจ้งพนักงานเรียกเช็คบิลเรียบร้อยแล้ว');
            refreshActiveBooking();
        } catch (err) {
            console.error('Request bill failed:', err);
            toast.error('ล้มเหลว: ' + err.message);
        } finally {
            setRequestingBill(false);
        }
    };

    // Evaluate if kitchen is closed based on settings, cutoff time, and current clock
    const checkIsKitchenClosed = (currentSettings) => {
        if (!currentSettings) return false;
        const mode = currentSettings.qr_kitchen_mode || 'auto';
        if (mode === 'force_close') return true;
        if (mode === 'force_open') return false;
        if (currentSettings.qr_kitchen_cutoff_enabled === 'false') return false;

        const openTimeStr = currentSettings.qr_kitchen_open_time || currentSettings.opening_time || '10:00';
        const [openHour, openMin] = openTimeStr.split(':').map(Number);
        const openTotalMins = (openHour ?? 10) * 60 + (openMin || 0);

        const closeTimeStr = currentSettings.qr_kitchen_close_time || '22:00';
        const [closeHour, closeMin] = closeTimeStr.split(':').map(Number);
        const closeTotalMins = (closeHour ?? 22) * 60 + (closeMin || 0);

        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTotalMins = currentHour * 60 + currentMinute;

        if (closeTotalMins > openTotalMins) {
            // Same-day operating window: e.g. Open 10:00 - 22:00 -> Closed before 10:00 or after 22:00
            return currentTotalMins < openTotalMins || currentTotalMins >= closeTotalMins;
        } else {
            // Overnight operating window: e.g. Open 17:00 - 02:00 -> Closed between 02:00 and 17:00
            return currentTotalMins >= closeTotalMins && currentTotalMins < openTotalMins;
        }
    };

    const isKitchenClosed = checkIsKitchenClosed(settings);

    // Closed category identifiers set (IDs and lowercase names)
    const closedCategoryIdentifiers = useMemo(() => {
        const set = new Set();
        if (settings?.qr_kitchen_closed_categories) {
            try {
                const parsed = typeof settings.qr_kitchen_closed_categories === 'string'
                    ? JSON.parse(settings.qr_kitchen_closed_categories)
                    : settings.qr_kitchen_closed_categories;
                if (Array.isArray(parsed)) {
                    parsed.forEach(id => {
                        if (id) {
                            set.add(String(id));
                            set.add(String(id).toLowerCase());
                        }
                    });
                }
            } catch (e) {
                console.warn('Error parsing qr_kitchen_closed_categories:', e);
            }
        }
        if (categories && Array.isArray(categories)) {
            categories.forEach(cat => {
                if (cat.hide_on_kitchen_close === true) {
                    set.add(String(cat.id));
                    if (cat.name) {
                        set.add(cat.name.trim().toLowerCase());
                    }
                }
            });
        }
        return set;
    }, [settings?.qr_kitchen_closed_categories, categories, currentTimeTick]);

    // Check if an item belongs to a closed kitchen category
    const isItemKitchenClosed = useCallback((item) => {
        if (!isKitchenClosed) return false;
        if (!item) return false;

        const catId = item.category_id ? String(item.category_id) : '';
        const catName = (item.category || item.category_name || '').trim().toLowerCase();

        if (catId && closedCategoryIdentifiers.has(catId)) return true;
        if (catName && closedCategoryIdentifiers.has(catName)) return true;

        if (catId && categories.length > 0) {
            const matchedCat = categories.find(c => String(c.id) === catId);
            if (matchedCat && matchedCat.hide_on_kitchen_close === true) return true;
        }
        if (catName && categories.length > 0) {
            const matchedCat = categories.find(c => (c.name || '').trim().toLowerCase() === catName);
            if (matchedCat && matchedCat.hide_on_kitchen_close === true) return true;
        }

        return false;
    }, [isKitchenClosed, closedCategoryIdentifiers, categories]);

    // Filter categories based on kitchen cutoff
    const visibleCategories = useMemo(() => {
        if (!isKitchenClosed) return categories;
        return categories.filter(cat => {
            const idStr = String(cat.id);
            const nameStr = (cat.name || '').trim().toLowerCase();
            return !closedCategoryIdentifiers.has(idStr) && !closedCategoryIdentifiers.has(nameStr) && cat.hide_on_kitchen_close !== true;
        });
    }, [categories, isKitchenClosed, closedCategoryIdentifiers]);

    // Filter menu items based on kitchen cutoff
    const visibleMenuItems = useMemo(() => {
        if (!isKitchenClosed) return menuItems;
        return menuItems.filter(item => !isItemKitchenClosed(item));
    }, [menuItems, isKitchenClosed, isItemKitchenClosed]);

    // Recommended Menu Items (Filtered by active kitchen status)
    const recommendedMenuItems = useMemo(() => {
        return visibleMenuItems.filter(item => item.is_recommended === true);
    }, [visibleMenuItems]);

    // Active Category auto-reset if selected category becomes closed
    useEffect(() => {
        if (isKitchenClosed && activeCategory !== 'all' && activeCategory !== 'recommended') {
            const isSelectedClosed = closedCategoryIdentifiers.has(String(activeCategory)) || 
                categories.some(c => String(c.id) === String(activeCategory) && c.hide_on_kitchen_close === true);
            if (isSelectedClosed) {
                setActiveCategory('all');
            }
        }
    }, [isKitchenClosed, activeCategory, closedCategoryIdentifiers, categories]);

    // Filtered Items for Display
    const filteredItems = useMemo(() => {
        return visibleMenuItems.filter(item => {
            let matchesCat = true;
            if (activeCategory === 'all') {
                matchesCat = true;
            } else if (activeCategory === 'recommended') {
                matchesCat = item.is_recommended === true;
            } else {
                const catId = item.category_id ? String(item.category_id) : '';
                const catName = (item.category || item.category_name || '').trim().toLowerCase();
                const targetCat = categories.find(c => String(c.id) === String(activeCategory));
                const targetName = targetCat ? targetCat.name.trim().toLowerCase() : String(activeCategory).toLowerCase();
                
                matchesCat = (catId === String(activeCategory)) || (catName === targetName);
            }

            const searchTrim = search.trim().toLowerCase();
            const matchesSearch = !searchTrim || 
                item.name.toLowerCase().includes(searchTrim) || 
                (item.description && item.description.toLowerCase().includes(searchTrim));

            return matchesCat && matchesSearch;
        });
    }, [visibleMenuItems, activeCategory, search, categories]);

    // Cart Operations
    const handleAddToCart = (item) => {
        if (isItemKitchenClosed(item)) {
            toast.error(`ขออภัยครับ อยู่นอกเวลาสั่งอาหารครัว (ครัวเปิดรับ ${settings.qr_kitchen_open_time || '10:00'} - ${settings.qr_kitchen_close_time || '22:00'} น.)`);
            return;
        }
        setSelectedItem(item);
    };

    const handleConfirmOptions = (configuredItem) => {
        setCart(prev => {
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
        if (cart.length === 0 || submittingRef.current || submitting) return;
        submittingRef.current = true;
        setSubmitting(true);

        const effectiveNumericTableId = table?.id || (tableId && /^\d+$/.test(tableId) ? parseInt(tableId) : null);
        if (!effectiveNumericTableId) {
            toast.error('ไม่พบรหัสโต๊ะที่ถูกต้อง กรุณาสแกน QR Code ใหม่อีกครั้ง');
            submittingRef.current = false;
            setSubmitting(false);
            return;
        }

        // Cart validation against kitchen closed categories
        if (isKitchenClosed) {
            const invalidItems = cart.filter(item => isItemKitchenClosed(item));
            if (invalidItems.length > 0) {
                toast.error(`ขออภัยครับ รายการ "${invalidItems.map(i => i.name).join(', ')}" ไม่สามารถสั่งได้เนื่องจากอยู่นอกเวลาครัว (${settings.qr_kitchen_open_time || '10:00'} - ${settings.qr_kitchen_close_time || '22:00'} น.) ระบบได้นำออกจากตะกร้าให้แล้วครับ`);
                setCart(prev => prev.filter(item => !isItemKitchenClosed(item)));
                submittingRef.current = false;
                setSubmitting(false);
                return;
            }
        }

        try {
            const DEFAULT_BAR_CATS = [
                '7524bb8a-4698-45c6-aa17-d8ccc296f667',
                '912683ef-fdc3-40a3-8dd8-b09507791240',
                'b441665e-2f23-4df3-a11d-63485e1690dc',
                'a2c783fc-975b-4779-b9eb-67391eeafd1f',
                '1983955d-5787-4351-b729-51b95761f125',
                '1407d869-4eed-489e-aeeb-ba7ef19f57bd',
                '8a3dcc6b-9eff-42b2-83d5-1e02dd0a98cd'
            ];

            const itemsToInsert = cart.map(item => {
                const isCustom = Boolean(item.is_custom === true || item.is_emergency === true || String(item.id).startsWith('custom_'));
                const catId = item.category_id || '';
                let resolvedDest = 'kitchen';
                if (DEFAULT_BAR_CATS.includes(catId)) {
                    resolvedDest = 'bar';
                } else if (item.destination === 'bar' || item.destination === 'drinks') {
                    resolvedDest = 'bar';
                } else if (item.destination === 'other') {
                    resolvedDest = 'other';
                } else if (item.optionsSummary?.some(o => (typeof o === 'string' ? o : o.name || '').includes('บาร์') || o.destination === 'bar')) {
                    resolvedDest = 'bar';
                }

                return {
                    menu_item_id: isCustom ? null : item.id,
                    quantity: item.qty,
                    price_at_time: item.totalPricePerUnit,
                    destination: resolvedDest,
                    custom_name: isCustom ? (item.custom_name || item.name) : null,
                    is_custom: isCustom,
                    selected_options: (item.optionsSummary && item.optionsSummary.length > 0) 
                        ? item.optionsSummary 
                        : item.selectedOptions || {}
                };
            });

            let finalBookingId = null;
            let finalTrackingToken = null;
            let finalTotalAmount = cartSubtotal;
            let rpcSucceeded = false;

            // 1. Primary Ultra-Fast Path: Atomic PostgreSQL RPC
            try {
                const existingToken = activeBooking?.tracking_token || localStorage.getItem(`table_${tableId}_token`) || localStorage.getItem(`table_${effectiveNumericTableId}_token`);
                const { data: rpcResult, error: rpcError } = await supabase.rpc('submit_customer_qr_order', {
                    p_table_id: effectiveNumericTableId,
                    p_items: itemsToInsert,
                    p_user_id: memberProfile?.id || null,
                    p_pax: paxCount || table?.capacity || 2,
                    p_customer_note: tableRemarkInput.trim(),
                    p_tracking_token: existingToken || null
                });

                if (!rpcError && rpcResult?.success) {
                    finalBookingId = rpcResult.booking_id;
                    finalTrackingToken = rpcResult.tracking_token;
                    finalTotalAmount = rpcResult.total_amount;
                    rpcSucceeded = true;
                } else if (rpcError && rpcError.code !== 'PGRST202') {
                    console.warn('[Checkout] RPC execution warning:', rpcError);
                }
            } catch (rpcEx) {
                console.warn('[Checkout] RPC not available, falling back to direct batch operations:', rpcEx);
            }

            // 2. Resilient Fallback: Optimized Direct Queries
            if (!rpcSucceeded) {
                const { data: latestTableSession } = await supabase
                    .from('bookings')
                    .select('*')
                    .eq('table_id', effectiveNumericTableId)
                    .in('status', ['pending', 'confirmed', 'seated', 'ready'])
                    .order('booking_time', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                let currentBooking = (latestTableSession && isBookingActiveAndFresh(latestTableSession)) 
                    ? latestTableSession 
                    : (activeBooking && isBookingActiveAndFresh(activeBooking) ? activeBooking : null);

                let remarkStr = 'QR Walk-in Guest';
                if (tableRemarkInput.trim()) {
                    remarkStr += ` [NOTE: ${tableRemarkInput.trim()}]`;
                }

                if (!currentBooking) {
                    const trackingToken = crypto.randomUUID();
                    const newBookingPayload = {
                        table_id: effectiveNumericTableId,
                        status: 'seated',
                        booking_type: 'walk_in',
                        booking_time: new Date().toISOString(),
                        pax: paxCount || table?.capacity || 2,
                        staff_remark: remarkStr,
                        tracking_token: trackingToken,
                        total_amount: 0,
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

                const dbItemsToInsert = itemsToInsert.map(item => ({
                    ...item,
                    booking_id: currentBooking.id
                }));

                const { error: itemsError } = await supabase
                    .from('order_items')
                    .insert(dbItemsToInsert);

                if (itemsError) throw itemsError;

                let updatedRemark = currentBooking.staff_remark || 'QR Walk-in Guest';
                if (!updatedRemark.toLowerCase().includes('qr')) {
                    updatedRemark = `[QR] ${updatedRemark}`;
                }
                if (tableRemarkInput.trim() && !updatedRemark.includes(tableRemarkInput.trim())) {
                    updatedRemark += ` [NOTE: ${tableRemarkInput.trim()}]`;
                }

                const { data: allBookingItems } = await supabase
                    .from('order_items')
                    .select('price_at_time, quantity')
                    .eq('booking_id', currentBooking.id);

                const recalculatedTotal = (allBookingItems && allBookingItems.length > 0)
                    ? allBookingItems.reduce((sum, i) => sum + ((Number(i.price_at_time) || 0) * (Number(i.quantity) || 1)), 0)
                    : cartSubtotal;

                const updateData = {
                    status: 'seated',
                    total_amount: recalculatedTotal,
                    staff_remark: updatedRemark
                };
                if (memberProfile?.id && !currentBooking.user_id) {
                    updateData.user_id = memberProfile.id;
                }

                const { error: bookingUpdateError } = await supabase
                    .from('bookings')
                    .update(updateData)
                    .eq('id', currentBooking.id);

                if (bookingUpdateError) throw bookingUpdateError;

                finalBookingId = currentBooking.id;
                finalTrackingToken = currentBooking.tracking_token;
                finalTotalAmount = recalculatedTotal;
            }

            // 3. Instant Realtime WebSocket Broadcast to POS (< 50ms)
            const displayTableName = table?.table_name || `โต๊ะ #${effectiveNumericTableId}`;
            sendPOSBroadcast('qr_order_created', {
                booking_id: finalBookingId,
                table_id: effectiveNumericTableId,
                table_name: displayTableName,
                items_count: cartCount,
                total_amount: finalTotalAmount,
                source: 'qr'
            });

            toast.success('ออเดอร์ถูกส่งไปยังห้องครัวแล้ว!');
            setCart([]);
            setCartOpen(false);
            setTableRemarkInput('');
            
            // Save active tracking token to local storage
            if (finalTrackingToken) {
                if (tableId) localStorage.setItem(`table_${tableId}_token`, finalTrackingToken);
                localStorage.setItem(`table_${effectiveNumericTableId}_token`, finalTrackingToken);
            }

            // Redirect to status page immediately
            navigate(`/table/${encodeURIComponent(table?.table_name || tableId)}/status`);

        } catch (err) {
            console.error('Checkout error:', err);
            toast.error('Failed to submit order: ' + err.message);
        } finally {
            submittingRef.current = false;
            setSubmitting(false);
        }
    };

    const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
    const cartSubtotal = cart.reduce((sum, item) => sum + (item.totalPricePerUnit * item.qty), 0);

    if (loading) {
        const isNumeric = /^\d+$/.test((tableId || '').trim());
        const cachedName = localStorage.getItem('active_customer_table_name');
        const displayLoadingName = table?.table_name || (!isNumeric ? tableId : (cachedName && localStorage.getItem('active_customer_table_id') === tableId ? cachedName : null));

        return (
            <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)] flex flex-col items-center justify-center font-[var(--font-body)]">
                <div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-[var(--color-neutral)] text-xs font-mono font-bold tracking-widest uppercase">
                    {displayLoadingName ? `Connecting Table ${displayLoadingName}...` : 'Connecting Table...'}
                </p>
            </div>
        );
    }

    if (gpsChecking) {
        return (
            <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)] flex flex-col items-center justify-center font-[var(--font-body)] p-6 text-center">
                <MapPin size={40} className="text-[var(--color-accent)] animate-bounce mb-4" />
                <h3 className="font-mono font-bold text-xs tracking-wider uppercase mb-2">VERIFYING TABLE LOCATION</h3>
                <p className="text-[var(--color-neutral)] text-xs max-w-xs leading-relaxed">
                    กำลังยืนยันตำแหน่งของคุณภายในร้านเพื่อเปิดระบบสั่งอาหารที่โต๊ะ กรุณาอนุญาตการเข้าถึง GPS
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
            <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)] flex flex-col items-center justify-center font-[var(--font-body)] p-6 text-center">
                <div className="w-16 h-16 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 rounded-full flex items-center justify-center text-[var(--color-accent)] mb-4 animate-pulse">
                    <AlertTriangle size={30} />
                </div>
                <h3 className="font-mono font-bold text-xs tracking-wider uppercase mb-2 text-[var(--color-accent)]">{errorTitle}</h3>
                <p className="text-[var(--color-neutral)] text-xs max-w-sm leading-relaxed mb-6">
                    {gpsError || 'คุณต้องอยู่ภายในพื้นที่ร้านอาหารเพื่อสั่งอาหารผ่าน QR Code'}
                </p>
                <button 
                    onClick={() => window.location.reload()} 
                    className="bg-[var(--color-paper)] border border-[var(--color-rule)] hover:border-[var(--color-ink)] px-6 py-2.5 rounded-sm text-xs font-mono font-bold uppercase tracking-wider active:scale-95 transition-all text-[var(--color-ink)] flex items-center gap-2 cursor-pointer shadow-sm"
                >
                    <RefreshCw size={12} />
                    <span>ตรวจสอบพิกัดใหม่อีกครั้ง</span>
                </button>
            </div>
        );
    }

    const currentCategoryObj = categories.find(c => String(c.id) === String(activeCategory));

    return (
        <div className="min-h-screen w-full bg-[var(--color-paper)] text-[var(--color-ink)] font-[var(--font-body)] flex flex-col pb-36 select-none">
            <Toaster position="top-center" richColors />

            {/* Top Brutalist Structural Header (Tabular Layout) */}
            <header className="sticky top-0 bg-[var(--color-paper)]/95 backdrop-blur-md border-b border-[var(--color-rule)] z-40">
                <div className="max-w-2xl mx-auto flex items-stretch divide-x divide-[var(--color-rule)]">
                    {/* Brand & Table Cell */}
                    <div className="flex-1 p-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm tracking-wider uppercase text-[var(--color-ink)]">
                                IN THE HAUS
                            </span>
                            <span className="bg-[var(--color-ink)] text-[var(--color-paper)] text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
                                {table?.table_name || 'TABLE'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 text-[var(--color-accent-2)] font-mono text-[9px] font-bold uppercase">
                            <ShieldCheck size={12} />
                            <span>GPS OK</span>
                        </div>
                    </div>

                    {/* Quick Nav Links (Member) */}
                    <div className="flex items-center">
                        <Link 
                            to="/member-card" 
                            className="p-3 text-[var(--color-neutral)] hover:text-[var(--color-ink)] active:bg-[var(--color-paper-2)] flex items-center justify-center transition-colors"
                            title="Member Card"
                        >
                            <Crown size={16} />
                        </Link>
                    </div>
                </div>
            </header>

            <div className="max-w-2xl mx-auto w-full flex flex-col">
                {/* Table Overview & Party Size Bar */}
                <div className="p-4 bg-[var(--color-paper)] border-b border-[var(--color-rule)] flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-bold text-[var(--color-ink)]">
                                โต๊ะ {table?.table_name}
                            </h2>
                            {table?.zone && (
                                <span className="text-[10px] font-mono uppercase text-[var(--color-neutral)] border border-[var(--color-rule)] px-1.5 py-0.2 rounded-sm">
                                    {table.zone}
                                </span>
                            )}
                            {activeBooking?.booking_time && (() => {
                                const startMins = Math.max(0, Math.floor((Date.now() - new Date(activeBooking.booking_time).getTime()) / 60000));
                                const formatted = startMins < 60 ? `${startMins}m` : `${Math.floor(startMins / 60)}h ${startMins % 60}m`;
                                return (
                                    <span className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[var(--color-ink)] px-2 py-0.5 rounded-sm font-mono text-[9px] font-bold tracking-wider uppercase">
                                        ELAPSED {formatted}
                                    </span>
                                );
                            })()}
                        </div>
                        <p className="text-[11px] text-[var(--color-neutral)] mt-0.5">
                            เลือกเมนูโปรดและส่งออเดอร์ตรงสู่ครัวได้ทันที
                        </p>
                    </div>

                    <button
                        onClick={() => setShowPaxModal(true)}
                        className="bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[var(--color-ink)] px-3 py-1.5 rounded-sm text-xs font-mono font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    >
                        <span>PAX: {paxCount} ท่าน</span>
                        <span className="text-[10px] text-[var(--color-accent)] underline uppercase">EDIT</span>
                    </button>
                </div>

                {/* Member CRM Strip (Dieter Rams Tabular Style) */}
                <div className="px-4 py-3 bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] flex items-center justify-between">
                    {memberProfile ? (
                        <div className="flex items-center gap-3 text-xs">
                            <div className="w-8 h-8 rounded-sm bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                                CRM
                            </div>
                            <div>
                                <div className="flex items-center gap-1.5 font-bold text-[var(--color-ink)] flex-wrap">
                                    <span>คุณ {memberProfile.display_name || memberProfile.nickname || 'สมาชิก'}</span>
                                    <span className="px-1.5 py-0.2 bg-[var(--color-accent)] text-[var(--color-paper)] text-[8px] font-mono font-bold rounded-sm uppercase tracking-wider">
                                        {tierDetails.current_tier || 'Haus Common'} ({tierDetails.multiplier || '1.0'}x)
                                    </span>
                                    {(memberProfile.free_drink_quota || 0) > 0 && (
                                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[8px] font-mono font-bold px-1.5 py-0.2 rounded-sm uppercase tracking-wider">
                                            FREE {memberProfile.free_drink_quota} DRINKS
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-mono font-bold mt-0.5 flex-wrap">
                                    <span className="text-[var(--color-accent)]">{parseFloat(memberProfile.xhaus_balance || 0).toFixed(0)} XHAUS</span>
                                    <span className="text-[var(--color-rule)]">|</span>
                                    <span className="text-[var(--color-ink)]">STAMPS: {memberProfile.drink_stamp_count || 0}/10</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2.5 text-xs">
                            <div className="w-8 h-8 rounded-sm bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] flex items-center justify-center font-mono font-bold text-xs shrink-0">
                                CRM
                            </div>
                            <div>
                                <span className="font-bold text-[var(--color-ink)] block text-xs uppercase font-mono tracking-wider">HAUS MEMBERSHIP</span>
                                <span className="text-[10px] text-[var(--color-neutral)]">ระบุเบอร์โทรเพื่อสะสมแต้ม xhaus & แก้ว 10 แถม 1</span>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-1.5">
                        {memberProfile && (
                            <Link
                                to="/member-card"
                                className="bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[var(--color-ink)] px-2.5 py-1.5 rounded-sm text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
                                title="เปิดบัตรสมาชิกดิจิทัล"
                            >
                                <span>CARD</span>
                            </Link>
                        )}
                        <button
                            onClick={() => setShowMemberModal(true)}
                            className="bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[var(--color-ink)] px-3 py-1.5 rounded-sm text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
                        >
                            {memberProfile ? (
                                <span>SWITCH</span>
                            ) : (
                                <span>SIGN IN / JOIN</span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Kitchen Cutoff High-Contrast Rams Notice Banner */}
                {isKitchenClosed && (
                    <div className="p-3 bg-[var(--color-paper)] border-b border-[var(--color-rule)]">
                        <div className="p-3 bg-[var(--color-ink)] text-[var(--color-paper)] rounded-sm border border-[var(--color-rule)] flex items-center justify-between gap-3 shadow-sm">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-sm bg-[var(--color-accent)] text-[var(--color-paper)] flex items-center justify-center font-mono font-bold text-xs shrink-0">
                                    OFF
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono font-bold text-xs uppercase tracking-wider text-[var(--color-accent)]">
                                            KITCHEN CLOSED · ครัวเปิดรับ {settings.qr_kitchen_open_time || '10:00'} - {settings.qr_kitchen_close_time || '22:00'} น.
                                        </span>
                                        <span className="bg-[var(--color-paper)]/15 text-[var(--color-paper)] text-[8px] font-mono font-bold px-1.5 py-0.2 rounded-sm uppercase tracking-wider">
                                            DRINKS & BAR ONLY
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-[var(--color-paper)]/80 mt-0.5 block truncate">
                                        ขณะนี้อยู่นอกเวลาสั่งอาหาร สามารถเลือกสั่งเครื่องดื่มและรายการบาร์ได้ตามปกติครับ
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Menu Search & Category Navigation */}
                <div className="p-3 sticky top-[53px] bg-[var(--color-paper)]/95 backdrop-blur-md z-30 space-y-2.5 border-b border-[var(--color-rule)]">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-neutral)]" size={15} />
                        <input 
                            type="search" 
                            placeholder="ค้นหาเมนูอาหารและเครื่องดื่ม..." 
                            className="w-full bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-sm py-2 pl-9 pr-8 text-[var(--color-ink)] placeholder-[var(--color-neutral)] focus:outline-none focus:border-[var(--color-ink)] text-xs transition-colors"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-neutral)] p-1">
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                        {/* All Menu Pill */}
                        <button 
                            onClick={() => setActiveCategory('all')} 
                            className={`px-3 py-1.5 rounded-sm text-[11px] font-mono font-bold uppercase tracking-wider transition-all border whitespace-nowrap shrink-0 cursor-pointer ${
                                activeCategory === 'all' 
                                    ? 'bg-[var(--color-ink)] border-[var(--color-ink)] text-[var(--color-paper)]' 
                                    : 'bg-[var(--color-paper)] border-[var(--color-rule)] text-[var(--color-neutral)] hover:text-[var(--color-ink)]'
                            }`}
                        >
                            ทั้งหมด ({visibleMenuItems.length})
                        </button>

                        {/* Recommended Pill */}
                        {recommendedMenuItems.length > 0 && (
                            <button 
                                onClick={() => setActiveCategory('recommended')} 
                                className={`px-3 py-1.5 rounded-sm text-[11px] font-mono font-bold uppercase tracking-wider transition-all border whitespace-nowrap shrink-0 cursor-pointer ${
                                    activeCategory === 'recommended' 
                                        ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-[var(--color-paper)]' 
                                        : 'bg-[var(--color-paper)] border-[var(--color-accent)]/40 text-[var(--color-accent)] hover:border-[var(--color-accent)]'
                                }`}
                            >
                                เมนูแนะนำ ({recommendedMenuItems.length})
                            </button>
                        )}

                        {/* Dynamic Category List */}
                        {visibleCategories.map(cat => {
                            const catIdStr = String(cat.id);
                            const catNameStr = (cat.name || '').trim().toLowerCase();
                            const count = visibleMenuItems.filter(i => {
                                const iCatId = i.category_id ? String(i.category_id) : '';
                                const iCatName = (i.category || i.category_name || '').trim().toLowerCase();
                                return iCatId === catIdStr || iCatName === catNameStr;
                            }).length;

                            return (
                                <button 
                                    key={cat.id} 
                                    onClick={() => setActiveCategory(cat.id)} 
                                    className={`px-3 py-1.5 rounded-sm text-[11px] font-mono font-bold uppercase tracking-wider transition-all border whitespace-nowrap shrink-0 cursor-pointer ${
                                        activeCategory === cat.id 
                                            ? 'bg-[var(--color-ink)] border-[var(--color-ink)] text-[var(--color-paper)]' 
                                            : 'bg-[var(--color-paper)] border-[var(--color-rule)] text-[var(--color-neutral)] hover:text-[var(--color-ink)]'
                                    }`}
                                >
                                    {cat.name} {count > 0 && `(${count})`}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Menu Grid Listing */}
                <main className="flex-1 p-3">
                    {/* Top Highlight Showcase: HAUS SIGNATURE & RECOMMENDED */}
                    {activeCategory === 'all' && !search.trim() && recommendedMenuItems.length > 0 && (
                        <section className="mb-4 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-sm p-3.5 shadow-xs">
                            <div className="flex items-center justify-between mb-2.5">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
                                    <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[var(--color-ink)] flex items-center gap-1.5">
                                        <span>HAUS SIGNATURES</span>
                                        <span className="text-[9px] text-[var(--color-neutral)] font-normal">/ เมนูแนะนำ</span>
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setActiveCategory('recommended')}
                                    className="text-[10px] font-mono font-bold text-[var(--color-accent)] hover:underline flex items-center gap-0.5 cursor-pointer uppercase"
                                >
                                    <span>SEE ALL ({recommendedMenuItems.length})</span>
                                    <ChevronRight size={12} />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                {recommendedMenuItems.slice(0, 6).map(item => {
                                    const inCartCount = cart.filter(c => c.id === item.id).reduce((sum, c) => sum + c.qty, 0);
                                    const hasOptions = item.menu_item_options && item.menu_item_options.length > 0;

                                    return (
                                        <motion.div
                                            key={`rec-${item.id}`}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => handleAddToCart(item)}
                                            className="bg-[var(--color-paper)] rounded-sm border border-[var(--color-accent)]/30 hover:border-[var(--color-ink)] p-2.5 flex flex-col justify-between text-left group cursor-pointer transition-all relative shadow-xs"
                                        >
                                            <div>
                                                <div className="aspect-[4/3] rounded-sm bg-[var(--color-paper-2)] overflow-hidden relative border border-[var(--color-rule)] mb-2">
                                                    {item.image_url ? (
                                                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-[var(--color-neutral)] font-bold text-lg uppercase font-mono">
                                                            {item.name.charAt(0)}
                                                        </div>
                                                    )}
                                                    <div className="absolute top-1.5 left-1.5 bg-[var(--color-accent)] text-[var(--color-paper)] text-[8px] font-mono font-bold px-1.5 py-0.2 rounded-sm uppercase tracking-wider shadow-xs">
                                                        SIGNATURE
                                                    </div>
                                                    {inCartCount > 0 && (
                                                        <div className="absolute top-1.5 right-1.5 bg-[var(--color-ink)] text-[var(--color-paper)] text-[9px] font-mono font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                                                            {inCartCount}
                                                        </div>
                                                    )}
                                                </div>
                                                <h4 className="font-bold text-xs text-[var(--color-ink)] line-clamp-1 leading-tight">
                                                    {item.name}
                                                </h4>
                                                {item.description && (
                                                    <p className="text-[10px] text-[var(--color-neutral)] line-clamp-2 mt-0.5 leading-snug">
                                                        {item.description}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="pt-2 mt-1 border-t border-[var(--color-rule)]/60 flex items-center justify-between">
                                                <span className="text-[var(--color-ink)] font-mono font-bold text-xs">
                                                    ฿{Number(item.price).toLocaleString()}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    {hasOptions && (
                                                        <span className="text-[8px] font-mono text-[var(--color-neutral)]">
                                                            + OPTIONS
                                                        </span>
                                                    )}
                                                    <div className="w-6 h-6 rounded-sm bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[var(--color-ink)] group-hover:bg-[var(--color-ink)] group-hover:text-[var(--color-paper)] flex items-center justify-center transition-colors">
                                                        <Plus size={12} />
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* Section Title Header */}
                    <div className="mb-2.5 flex items-center justify-between">
                        <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[var(--color-neutral)]">
                            {activeCategory === 'all' ? (
                                search ? `ผลการค้นหา "${search}" (${filteredItems.length})` : `รายการทั้งหมด (${filteredItems.length})`
                            ) : activeCategory === 'recommended' ? (
                                `HAUS SIGNATURE DISHES & DRINKS (${filteredItems.length})`
                            ) : (
                                `หมวดหมู่: ${currentCategoryObj?.name || 'รายการ'} (${filteredItems.length})`
                            )}
                        </h3>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {filteredItems.map(item => {
                            const inCartCount = cart.filter(c => c.id === item.id).reduce((sum, c) => sum + c.qty, 0);
                            const hasOptions = item.menu_item_options && item.menu_item_options.length > 0;

                            return (
                                <motion.div
                                    key={item.id}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleAddToCart(item)}
                                    className="bg-[var(--color-paper)] rounded-sm border border-[var(--color-rule)] p-2.5 flex flex-col justify-between text-left group cursor-pointer hover:border-[var(--color-ink)] transition-all relative"
                                >
                                    <div>
                                        {/* Image Frame */}
                                        <div className="aspect-[4/3] rounded-sm bg-[var(--color-paper-2)] overflow-hidden relative border border-[var(--color-rule)] mb-2">
                                            {item.image_url ? (
                                                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[var(--color-neutral)] font-bold text-lg uppercase font-mono">
                                                    {item.name.charAt(0)}
                                                </div>
                                            )}
                                            
                                            {/* Badges */}
                                            {item.is_recommended && (
                                                <div className="absolute top-1.5 left-1.5 bg-[var(--color-accent)] text-[var(--color-paper)] text-[8px] font-mono font-bold px-1.5 py-0.2 rounded-sm uppercase tracking-wider">
                                                    SIGNATURE
                                                </div>
                                            )}

                                            {inCartCount > 0 && (
                                                <div className="absolute top-1.5 right-1.5 bg-[var(--color-ink)] text-[var(--color-paper)] text-[9px] font-mono font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                                                    {inCartCount}
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Item Title & Desc */}
                                        <h4 className="font-bold text-xs text-[var(--color-ink)] line-clamp-1 leading-tight">
                                            {item.name}
                                        </h4>
                                        {item.description && (
                                            <p className="text-[10px] text-[var(--color-neutral)] line-clamp-2 mt-0.5 leading-snug">
                                                {item.description}
                                            </p>
                                        )}
                                    </div>

                                    {/* Bottom Price & Action */}
                                    <div className="pt-2 mt-1 border-t border-[var(--color-rule)]/60 flex items-center justify-between">
                                        <span className="text-[var(--color-ink)] font-mono font-bold text-xs">
                                            ฿{Number(item.price).toLocaleString()}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            {hasOptions && (
                                                <span className="text-[8px] font-mono text-[var(--color-neutral)]">
                                                    + มีตัวเลือก
                                                </span>
                                            )}
                                            <div className="w-6 h-6 rounded-sm bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[var(--color-ink)] group-hover:bg-[var(--color-ink)] group-hover:text-[var(--color-paper)] flex items-center justify-center transition-colors">
                                                <Plus size={12} />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    {filteredItems.length === 0 && (
                        <div className="py-16 text-center text-[var(--color-neutral)] font-mono text-xs uppercase tracking-wider space-y-2">
                            <p>ไม่พบรายการอาหารในหมวดหมู่นี้</p>
                            {isKitchenClosed && (
                                <p className="text-[10px] text-[var(--color-accent)]">
                                    (รายการอาหารหลักปิดรับออเดอร์แล้ว ครัวเปิดรับ {settings.qr_kitchen_open_time || '10:00'} - {settings.qr_kitchen_close_time || '22:00'} น.)
                                </p>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {/* Option Customizer Modal */}
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
            <div className="fixed bottom-0 left-0 right-0 p-3 bg-[var(--color-paper)]/95 backdrop-blur-md border-t border-[var(--color-rule)] z-40 safe-area-bottom shadow-lg">
                <div className="max-w-2xl mx-auto flex flex-col gap-2">
                    {/* Top Row: Quick Staff & Order Tracking Actions */}
                    <div className="flex gap-2 w-full">
                        {/* Call Staff Button */}
                        <button
                            onClick={handleCallStaff}
                            disabled={callingStaff}
                            className="flex-1 bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[var(--color-ink)] py-2 px-3 rounded-sm font-mono font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                        >
                            <Bell size={13} className="text-[var(--color-accent)]" />
                            <span>{callingStaff ? 'กำลังเรียก...' : 'เรียกพนักงาน (Call Staff)'}</span>
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
                            className={`flex-1 py-2 px-3 rounded-sm font-mono font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer ${
                                activeBooking 
                                    ? 'bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)]' 
                                    : 'bg-[var(--color-paper-2)] border border-[var(--color-rule)]/60 text-[var(--color-neutral)] cursor-not-allowed'
                            }`}
                        >
                            <Receipt size={13} className={activeBooking ? "text-[var(--color-accent-2)]" : "text-[var(--color-neutral)]"} />
                            <span>รายการที่สั่ง {activeBooking ? `(฿${Number(activeBooking.total_amount || 0).toLocaleString()})` : ''}</span>
                        </button>
                    </div>

                    {/* Bottom Row: Cart Status or Active Session Pill */}
                    {cart.length > 0 ? (
                        <button 
                            onClick={() => setCartOpen(true)}
                            className="w-full bg-[var(--color-ink)] hover:bg-[var(--color-ink)]/90 text-[var(--color-paper)] py-3 px-4 rounded-sm font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-between shadow-md active:scale-98 transition-transform cursor-pointer"
                        >
                            <div className="flex items-center gap-2">
                                <ShoppingBag size={14} />
                                <span className="bg-[var(--color-accent)] text-[var(--color-paper)] text-[9px] px-1.5 py-0.2 rounded-sm font-black font-mono">
                                    {cartCount}
                                </span>
                            </div>
                            <span>ดูตะกร้าสั่งอาหาร ({cartCount} รายการ)</span>
                            <span className="font-mono font-black">฿{cartSubtotal.toLocaleString()}.-</span>
                        </button>
                    ) : activeBooking ? (
                        <div className="w-full bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[var(--color-ink)] py-2 px-3 rounded-sm font-mono text-[10px] uppercase tracking-wider flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <span className="bg-emerald-500 w-1.5 h-1.5 rounded-full animate-ping" />
                                <span className="font-bold">ACTIVE SESSION · โต๊ะ {table?.table_name}</span>
                            </div>
                            <span className="text-[var(--color-neutral)]">ยอดรวมปัจจุบัน: ฿{Number(activeBooking.total_amount || 0).toLocaleString()}.-</span>
                        </div>
                    ) : (
                        <div className="w-full bg-[var(--color-paper-2)] text-[var(--color-neutral)] py-2 px-3 rounded-sm font-mono text-[9px] uppercase tracking-widest text-center border border-dashed border-[var(--color-rule)]">
                            แตะเลือกเมนูเพื่อเริ่มสั่งอาหาร
                        </div>
                    )}
                </div>
            </div>

            {/* Cart Drawer Slide-up */}
            <AnimatePresence>
                {cartOpen && (
                    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/50 pointer-events-auto"
                            onClick={() => setCartOpen(false)}
                        />

                        <motion.div 
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                            className="bg-[var(--color-paper)] w-full max-w-lg rounded-t-sm border-t border-[var(--color-rule)] p-4 shadow-2xl z-10 pointer-events-auto overflow-hidden flex flex-col max-h-[85vh] text-[var(--color-ink)] font-[var(--font-body)]"
                        >
                            {/* Drawer Header */}
                            <div className="flex justify-between items-center pb-3 border-b border-[var(--color-rule)] shrink-0">
                                <div>
                                    <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-[var(--color-ink)]">
                                        ตะกร้าของคุณ (YOUR CART)
                                    </h3>
                                    <p className="text-[10px] text-[var(--color-neutral)] font-mono uppercase mt-0.5">
                                        โต๊ะ {table?.table_name} · {cartCount} รายการ
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setCartOpen(false)}
                                    className="p-1.5 rounded-sm bg-[var(--color-paper-2)] border border-[var(--color-rule)] hover:bg-[var(--color-rule)] text-[var(--color-neutral)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
                                >
                                    <X size={14} />
                                </button>
                            </div>

                            {/* Cart Items List */}
                            <div className="flex-1 overflow-y-auto space-y-2.5 my-3 pr-1 custom-scrollbar">
                                {cart.map((item, index) => (
                                    <div key={index} className="bg-[var(--color-paper-2)] p-3 rounded-sm border border-[var(--color-rule)] flex items-start gap-3">
                                        <div className="flex-1 min-w-0">
                                            <h5 className="font-bold text-xs truncate text-[var(--color-ink)]">{item.name}</h5>
                                            {item.optionsSummary && item.optionsSummary.length > 0 && (
                                                <div className="text-[9px] text-[var(--color-neutral)] mt-1 space-y-0.5 font-mono">
                                                    {item.optionsSummary.map((opt, i) => (
                                                        <div key={i}>+ {opt.name} {opt.price > 0 && `(+฿${opt.price})`}</div>
                                                    ))}
                                                </div>
                                            )}
                                            <p className="text-[var(--color-ink)] font-mono font-bold text-xs mt-1.5">
                                                ฿{(item.totalPricePerUnit * item.qty).toLocaleString()}
                                            </p>
                                        </div>

                                        <div className="flex items-center bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm p-0.5 gap-1 shrink-0">
                                            <button 
                                                onClick={() => handleUpdateQty(index, -1)}
                                                className="w-6 h-6 rounded-sm flex items-center justify-center hover:bg-[var(--color-paper-2)] text-[var(--color-neutral)] cursor-pointer"
                                            >
                                                <Minus size={10} />
                                            </button>
                                            <span className="w-5 text-center font-mono font-bold text-xs text-[var(--color-ink)]">{item.qty}</span>
                                            <button 
                                                onClick={() => handleUpdateQty(index, 1)}
                                                className="w-6 h-6 rounded-sm flex items-center justify-center hover:bg-[var(--color-paper-2)] text-[var(--color-neutral)] cursor-pointer"
                                            >
                                                <Plus size={10} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Kitchen Remark Input */}
                            <div className="pt-2 border-t border-[var(--color-rule)] shrink-0">
                                <label className="block text-[9px] font-mono font-bold text-[var(--color-neutral)] uppercase tracking-wider mb-1">
                                    หมายเหตุถึงครัว (KITCHEN NOTE)
                                </label>
                                <input
                                    type="text"
                                    placeholder="เช่น ขอช้อนส้อมเพิ่ม, เผ็ดน้อย, เสิร์ฟพร้อมกัน"
                                    value={tableRemarkInput}
                                    onChange={(e) => setTableRemarkInput(e.target.value)}
                                    className="w-full bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-sm py-2 px-2.5 text-xs text-[var(--color-ink)] placeholder-[var(--color-neutral)] focus:outline-none focus:border-[var(--color-ink)] transition-colors"
                                />
                            </div>

                            {/* Drawer Footer */}
                            <div className="border-t border-[var(--color-rule)] pt-3 mt-3 space-y-2.5 shrink-0">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-[var(--color-neutral)] text-[10px] uppercase font-mono font-bold tracking-wider">ยอดรวมสุทธิ (Subtotal)</span>
                                    <span className="text-lg font-black text-[var(--color-ink)] font-mono">฿{cartSubtotal.toLocaleString()}.-</span>
                                </div>

                                <button 
                                    onClick={handleCheckout}
                                    disabled={submitting}
                                    className="w-full bg-[var(--color-ink)] hover:bg-[var(--color-ink)]/90 disabled:opacity-50 text-[var(--color-paper)] py-3 rounded-sm font-mono font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-98"
                                >
                                    {submitting ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-[var(--color-paper)] border-t-transparent rounded-full animate-spin" />
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

            {/* Tracking Drawer Slide-up (Dieter Rams Minimalist Style) */}
            <AnimatePresence>
                {trackingOpen && activeBooking && (() => {
                    const steps = [
                        { key: 'pending', label: 'ส่งออเดอร์แล้ว', desc: 'ห้องครัวได้รับรายการแล้ว', time: activeBooking.booking_time },
                        { key: 'seated', label: 'กำลังจัดเตรียม', desc: 'ห้องครัวและบาร์กำลังปรุงอาหารตามคิว', time: activeBooking.status !== 'pending' ? activeBooking.booking_time : null },
                    ];

                    const activeStep = activeBooking.status === 'pending' ? 0 : 1;
                    const orderItems = activeBooking.order_items || [];

                    return (
                        <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-black/50 pointer-events-auto"
                                onClick={() => setTrackingOpen(false)}
                            />

                            <motion.div 
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                                className="bg-[var(--color-paper)] w-full max-w-lg rounded-t-sm border-t border-[var(--color-rule)] p-4 shadow-2xl z-10 pointer-events-auto overflow-hidden flex flex-col max-h-[85vh] text-[var(--color-ink)] font-[var(--font-body)]"
                            >
                                {/* Header */}
                                <div className="flex justify-between items-center pb-3 border-b border-[var(--color-rule)] shrink-0">
                                    <div>
                                        <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-[var(--color-ink)]">
                                            ติดตามสถานะออเดอร์ (ORDER STATUS)
                                        </h3>
                                        <p className="text-[10px] text-[var(--color-neutral)] font-mono uppercase mt-0.5">
                                            Table {table?.table_name} · Queue #{getShortBookingId(activeBooking)}
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => setTrackingOpen(false)}
                                        className="p-1.5 rounded-sm bg-[var(--color-paper-2)] border border-[var(--color-rule)] hover:bg-[var(--color-rule)] text-[var(--color-neutral)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-y-auto space-y-4 my-3 pr-1 custom-scrollbar">
                                    {/* Progress Steps */}
                                    <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-sm p-4">
                                        <h4 className="text-[9px] text-[var(--color-neutral)] font-mono font-bold uppercase tracking-widest mb-3">
                                            ความคืบหน้า (PROGRESS)
                                        </h4>
                                        <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[1px] before:bg-[var(--color-rule)]">
                                            {steps.map((step, idx) => {
                                                const isDone = idx <= activeStep;
                                                const isCurrent = idx === activeStep;
                                                return (
                                                    <div key={step.key} className="relative">
                                                        <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-[var(--color-paper)] border border-[var(--color-rule)] flex items-center justify-center">
                                                            {isCurrent ? (
                                                                <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
                                                            ) : isDone ? (
                                                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                                            ) : (
                                                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-rule)]" />
                                                            )}
                                                        </div>
                                                        <div className="pl-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-xs font-bold ${isDone ? 'text-[var(--color-ink)]' : 'text-[var(--color-neutral)]'}`}>
                                                                    {step.label}
                                                                </span>
                                                                {isCurrent && (
                                                                    <span className="bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-[8px] font-mono font-bold uppercase px-1.5 py-0.2 rounded-sm">
                                                                        กำลังปรุง
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] text-[var(--color-neutral)] mt-0.5">{step.desc}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Order Items Ledger */}
                                    <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-sm p-4">
                                        <h4 className="text-[9px] text-[var(--color-neutral)] font-mono font-bold uppercase tracking-widest mb-3">
                                            รายการอาหารที่สั่ง (ORDER ITEMS)
                                        </h4>
                                        <div className="space-y-2.5">
                                            {orderItems.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-start text-xs pb-2 border-b border-[var(--color-rule)] last:border-b-0 last:pb-0">
                                                    <div className="flex gap-2">
                                                        <span className="font-bold font-mono text-[var(--color-accent)]">{item.quantity}x</span>
                                                        <div>
                                                            <span className="font-bold text-[var(--color-ink)] block leading-tight">{item.menu_items?.name}</span>
                                                            {item.selected_options && (
                                                                <div className="text-[9px] text-[var(--color-neutral)] mt-0.5 font-mono">
                                                                    {Array.isArray(item.selected_options) ? (
                                                                        item.selected_options.map((opt, i) => (
                                                                            <div key={i}>- {typeof opt === 'object' ? opt.name : opt}</div>
                                                                        ))
                                                                    ) : null}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className="font-mono font-bold text-[var(--color-ink)]">
                                                        ฿{(item.price_at_time * item.quantity).toLocaleString()}
                                                    </span>
                                                </div>
                                            ))}
                                            <div className="border-t border-[var(--color-rule)] pt-2.5 mt-2 flex justify-between items-baseline">
                                                <span className="text-[10px] text-[var(--color-neutral)] font-mono font-bold uppercase">ยอดรวมค่าอาหาร</span>
                                                <span className="text-base font-black text-[var(--color-ink)] font-mono">฿{Number(activeBooking.total_amount || 0).toLocaleString()}.-</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bill Request Section */}
                                    <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-sm p-4 text-center">
                                        {!activeBooking.staff_remark?.includes('[CALL_BILL]') ? (
                                            <div className="space-y-2.5">
                                                <h5 className="font-bold text-xs text-[var(--color-ink)]">ต้องการเช็คบิลชำระเงิน?</h5>
                                                <p className="text-[10px] text-[var(--color-neutral)]">กดปุ่มเพื่อแจ้งพนักงานนำใบแจ้งยอดและ QR Code มาให้สแกนจ่ายที่โต๊ะ</p>
                                                <button
                                                    onClick={handleRequestBill}
                                                    disabled={requestingBill}
                                                    className="w-full bg-[var(--color-ink)] hover:bg-[var(--color-ink)]/90 text-[var(--color-paper)] py-2.5 rounded-sm font-mono font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                                >
                                                    <Receipt size={13} />
                                                    <span>{requestingBill ? 'กำลังดำเนินการ...' : 'เรียกพนักงานเช็คบิล (Request Bill)'}</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-sm text-xs font-mono font-bold flex items-center justify-center gap-2">
                                                <CheckCircle size={14} className="text-emerald-600" />
                                                <span>เรียกพนักงานเช็คบิลแล้ว พนักงานกำลังมาที่โต๊ะ</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    );
                })()}
            </AnimatePresence>

            {/* Guest Count Modal (Dieter Rams Stepper) */}
            {showPaxModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm w-full max-w-sm overflow-hidden shadow-2xl font-[var(--font-body)] text-[var(--color-ink)] animate-in fade-in zoom-in-95 duration-150">
                        <div className="p-3.5 border-b border-[var(--color-rule)] flex items-center justify-between">
                            <div>
                                <h3 className="font-mono font-bold text-xs uppercase tracking-wider">ระบุจำนวนลูกค้า (PARTY SIZE)</h3>
                                <p className="text-[10px] text-[var(--color-neutral)] font-mono mt-0.5">โต๊ะ {table?.table_name}</p>
                            </div>
                            {activeBooking && (
                                <button onClick={() => setShowPaxModal(false)} className="p-1 hover:bg-[var(--color-paper-2)] rounded-sm text-[var(--color-neutral)]">
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                        
                        <div className="p-5 flex flex-col items-center gap-3 text-center">
                            <div className="text-xs font-bold text-[var(--color-ink)]">
                                กรุณาระบุจำนวนลูกค้าสำหรับโต๊ะนี้
                            </div>
                            <p className="text-[10px] text-[var(--color-neutral)]">เพื่อความสะดวกในการบริการและจัดเตรียมอุปกรณ์จานชาม</p>

                            {/* Stepper */}
                            <div className="flex items-center gap-3 my-2">
                                <button 
                                    onClick={() => setPaxCount(prev => Math.max(1, prev - 1))}
                                    className="w-10 h-10 rounded-sm bg-[var(--color-paper-2)] border border-[var(--color-rule)] hover:border-[var(--color-ink)] text-xl font-bold flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                                >
                                    -
                                </button>
                                <div className="w-16 h-10 bg-[var(--color-paper)] border-2 border-[var(--color-ink)] rounded-sm flex items-center justify-center text-xl font-mono font-black text-[var(--color-ink)]">
                                    {paxCount}
                                </div>
                                <button 
                                    onClick={() => setPaxCount(prev => prev + 1)}
                                    className="w-10 h-10 rounded-sm bg-[var(--color-paper-2)] border border-[var(--color-rule)] hover:border-[var(--color-ink)] text-xl font-bold flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                                >
                                    +
                                </button>
                            </div>

                            {/* Quick Presets */}
                            <div className="grid grid-cols-5 gap-1.5 w-full mt-1">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                    <button
                                        key={num}
                                        onClick={() => setPaxCount(num)}
                                        className={`py-1.5 rounded-sm font-mono font-bold text-xs transition-all cursor-pointer ${
                                            paxCount === num 
                                                ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border border-[var(--color-ink)]' 
                                                : 'bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[var(--color-ink)] hover:border-[var(--color-ink)]'
                                        }`}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-3 border-t border-[var(--color-rule)] bg-[var(--color-paper-2)]">
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
                                className="w-full bg-[var(--color-ink)] hover:bg-[var(--color-ink)]/90 text-[var(--color-paper)] py-2.5 rounded-sm font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                                <Check size={14} />
                                <span>ยืนยันจำนวนคน (Confirm)</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Member Identification Modal */}
            {showMemberModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm w-full max-w-sm overflow-hidden shadow-2xl font-[var(--font-body)] text-[var(--color-ink)]">
                        <div className="p-3.5 border-b border-[var(--color-rule)] flex items-center justify-between bg-[var(--color-paper)]">
                            <div className="flex items-center gap-2">
                                <h3 className="font-mono font-bold text-xs uppercase tracking-wider">ระบบสมาชิก HAUS MEMBER</h3>
                            </div>
                            <button onClick={() => setShowMemberModal(false)} className="p-1 hover:bg-[var(--color-paper-2)] rounded-sm text-[var(--color-neutral)]">
                                <X size={15} />
                            </button>
                        </div>

                        <div className="p-4 space-y-3.5">
                            {memberProfile && (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-sm p-3 flex items-center justify-between text-xs">
                                    <div>
                                        <span className="text-[9px] text-emerald-700 font-mono font-bold uppercase block">สมาชิกที่เชื่อมต่ออยู่</span>
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
                                    <label className="block text-xs font-bold text-[var(--color-ink)]">
                                        ระบุเบอร์โทรศัพท์เพื่อค้นหาสมาชิก
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="tel"
                                            placeholder="08X-XXX-XXXX"
                                            value={memberPhoneInput}
                                            onChange={(e) => setMemberPhoneInput(e.target.value)}
                                            className="w-full bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-sm py-2 px-3 text-sm font-mono font-bold text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-ink)]"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={memberLookupLoading}
                                        className="w-full bg-[var(--color-ink)] hover:bg-[var(--color-ink)]/90 text-[var(--color-paper)] py-2.5 rounded-sm font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                                    >
                                        {memberLookupLoading ? 'กำลังค้นหา...' : 'ค้นหาสมาชิก'}
                                    </button>
                                </form>
                            ) : (
                                <form onSubmit={handleRegisterMember} className="space-y-3">
                                    <div className="bg-amber-50 border border-amber-200 rounded-sm p-2.5 text-xs text-amber-800 leading-relaxed">
                                        ไม่พบสมาชิกเบอร์ <strong>{newMemberForm.phone_number}</strong> สามารถระบุชื่อเพื่อสมัครสมาชิกทันที!
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                                            ชื่อ-นามสกุล หรือ ชื่อเล่น
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="เช่น คุณปอนด์"
                                            value={newMemberForm.display_name}
                                            onChange={(e) => setNewMemberForm(prev => ({ ...prev, display_name: e.target.value }))}
                                            className="w-full bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-sm py-2 px-2.5 text-sm font-bold text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-ink)]"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={memberLookupLoading}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-sm font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        <Check size={14} />
                                        <span>{memberLookupLoading ? 'กำลังบันทึก...' : 'ยืนยันสมัครสมาชิก & เชื่อมต่อ'}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsNewMemberForm(false)}
                                        className="w-full text-center text-xs text-[var(--color-neutral)] underline font-mono cursor-pointer"
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
