/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AnimatePresence, motion } from 'framer-motion';
import generatePayload from 'promptpay-qr';
import { QRCodeSVG } from 'qrcode.react';
import { normalizePromptPayId, getStorePromptpayId, getStorePromptpayName, formatPromptpayDisplay } from '../utils/printerHelper';

const LINE_LIFF_MEMBER_URL = "https://liff.line.me/2008674756-hTEWodVj";
const STAMP_PUNCHCARD_SLOTS = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

const LOCAL_FEATURED_ITEMS = Object.freeze([
    { url: '/assets/food-beef-rice.webp', name: 'ข้าวหน้าเนื้อโคขุนคั่วพริกเกลือ', price: 185, category: 'CHEF SIGNATURE' },
    { url: '/assets/food-pouring-curry.webp', name: 'แกงกะหรี่เนื้อตุ๋นสูตรเข้มข้น', price: 220, category: 'SIGNATURE CURRY' },
    { url: '/assets/food-pork-belly.webp', name: 'หมูกรอบคั่วพริกเกลือโบราณ', price: 165, category: 'HAUS SPECIALTY' },
    { url: '/assets/food-green-curry.webp', name: 'แกงเขียวหวานเนื้อริบอาย', price: 240, category: 'CHEF RECOMMENDATION' },
    { url: '/assets/food-tai-pla-curry.webp', name: 'แกงไตปลาปักษ์ใต้รสจัดจ้าน', price: 175, category: 'TRADITIONAL RECIPE' },
    { url: '/assets/food-fried-garlic-pork.webp', name: 'หมูสามชั้นทอดน้ำปลาหอมกรอบ', price: 155, category: 'APPETIZER' }
]);

export default function POSCustomerDisplay() {
    // Mode state: 'IDLE' | 'CART' | 'ORDER_CONFIRMED' | 'CHECKOUT' | 'SPLIT_CHECKOUT' | 'SPLIT_SUCCESS' | 'SUCCESS'
    const [mode, setMode] = useState('IDLE');
    const [orderData, setOrderData] = useState({ 
        items: [], 
        subtotal: 0, 
        total: 0, 
        tax: 0, 
        discount: 0,
        customer: null,
        memberProfile: null,
        tableName: null,
        paymentMethod: 'cash',
        cashReceived: 0,
        changeDue: 0,
        pointsEarned: 0,
        itemCount: 0,
        bookingId: null
    });
    const [qrPayload, setQrPayload] = useState(null);
    const [slideshowImages, setSlideshowImages] = useState(LOCAL_FEATURED_ITEMS);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [shopLogoUrl, setShopLogoUrl] = useState(null);
    const [storePromptpayId, setStorePromptpayId] = useState('0614232455');
    const [storePromptpayName, setStorePromptpayName] = useState('ธัญญธร ศรีวิเศษ');
    const [paymentQrUrl, setPaymentQrUrl] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    const autoResetTimerRef = useRef(null);
    const expireAtRef = useRef(null);

    // Live Clock for Standby Terminal
    useEffect(() => {
        const clockTimer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(clockTimer);
    }, []);

    // Fetch shop logo & PromptPay settings from app_settings
    useEffect(() => {
        const fetchShopSettings = async () => {
            try {
                const { data } = await supabase
                    .from('app_settings')
                    .select('key, value')
                    .in('key', [
                        'receipt_shop_logo_url', 
                        'shop_logo_url', 
                        'payment_qr_url', 
                        'promptpay_id', 
                        'promptpay_name',
                        'receipt_promptpay_name',
                        'receipt_shop_phone', 
                        'contact_phone', 
                        'admin_phone_contact', 
                        'phone_number', 
                        'printer_config'
                    ]);
                
                if (data && data.length > 0) {
                    const settingsMap = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
                    let parsedPrinterConfig = {};
                    if (settingsMap.printer_config) {
                        try { parsedPrinterConfig = JSON.parse(settingsMap.printer_config); } catch (e) {}
                    }
                    const resolvedPpId = getStorePromptpayId(settingsMap, parsedPrinterConfig);
                    setStorePromptpayId(resolvedPpId);

                    const nameVal = getStorePromptpayName(settingsMap, parsedPrinterConfig);
                    if (nameVal) {
                        setStorePromptpayName(nameVal);
                    }

                    const logoObj = data.find(i => (i.key === 'receipt_shop_logo_url' || i.key === 'shop_logo_url') && i.value);
                    if (logoObj && logoObj.value) {
                        setShopLogoUrl(logoObj.value);
                    }
                    const qrObj = data.find(i => i.key === 'payment_qr_url' && i.value);
                    if (qrObj && qrObj.value) {
                        setPaymentQrUrl(qrObj.value);
                    }
                }
            } catch (err) {
                console.error("Error fetching CFD shop settings:", err);
            }
        };

        fetchShopSettings();

        const logoSub = supabase
            .channel('cfd_logo_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload) => {
                if (payload.new) {
                    const { key, value } = payload.new;
                    if (key === 'receipt_shop_logo_url' || key === 'shop_logo_url') {
                        if (value) setShopLogoUrl(value);
                    }
                    if (key === 'payment_qr_url') {
                        setPaymentQrUrl(value || null);
                    }
                    if (['promptpay_id', 'receipt_shop_phone', 'contact_phone', 'admin_phone_contact', 'phone_number'].includes(key) && value) {
                        setStorePromptpayId(normalizePromptPayId(value));
                    }
                    if (['promptpay_name', 'receipt_promptpay_name'].includes(key) && value) {
                        setStorePromptpayName(value);
                    }
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(logoSub);
        };
    }, []);

    // Reusable Venue Logo Component
    const VenueLogo = ({ className = "h-10 object-contain", alt = "IN THE HAUS" }) => {
        const [imgSrc, setImgSrc] = useState(shopLogoUrl || '/assets/logo-script.webp');
        const [errCount, setErrCount] = useState(0);

        useEffect(() => {
            if (shopLogoUrl) {
                setImgSrc(shopLogoUrl);
                setErrCount(0);
            }
        }, [shopLogoUrl]);

        const handleError = () => {
            if (errCount === 0) {
                setImgSrc('/assets/logo-script.webp');
                setErrCount(1);
            } else if (errCount === 1) {
                setImgSrc('/assets/logo-script.png');
                setErrCount(2);
            } else if (errCount === 2) {
                setImgSrc('/logo.png');
                setErrCount(3);
            }
        };

        return (
            <img
                src={imgSrc}
                alt={alt}
                className={className}
                onError={handleError}
            />
        );
    };

    // Helper to format image URL correctly
    const getValidImageUrl = (urlStr) => {
        if (!urlStr || urlStr === 'text_only') return null;
        if (urlStr.startsWith('http://') || urlStr.startsWith('https://') || urlStr.startsWith('data:')) {
            return urlStr;
        }
        const cleanPath = urlStr.startsWith('/') ? urlStr.slice(1) : urlStr;
        return `https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/menu/${cleanPath}`;
    };

    // Fetch menu showcase images for IDLE mode
    useEffect(() => {
        const fetchImages = async () => {
            try {
                const { data } = await supabase
                    .from('menu_items')
                    .select('image_url, name, price, category_id, menu_categories(name)')
                    .not('image_url', 'is', null)
                    .neq('image_url', '')
                    .limit(20);
                
                if (data && data.length > 0) {
                    const validItems = data
                        .map(item => ({
                            url: getValidImageUrl(item.image_url),
                            name: item.name,
                            price: item.price,
                            category: item.menu_categories?.name || 'SIGNATURE'
                        }))
                        .filter(item => Boolean(item.url));
                    if (validItems.length > 0) {
                        setSlideshowImages([...LOCAL_FEATURED_ITEMS, ...validItems]);
                    }
                }
            } catch (err) {
                console.error("Error fetching CFD slideshow images:", err);
            }
        };
        fetchImages();
    }, []);

    // Slideshow transition interval (6.5s per slide)
    useEffect(() => {
        if (!slideshowImages || slideshowImages.length === 0) return;
        const interval = setInterval(() => {
            setCurrentSlideIndex(prev => (prev + 1) % slideshowImages.length);
        }, 6500);
        return () => clearInterval(interval);
    }, [slideshowImages.length]);

    const resetToIdle = () => {
        if (autoResetTimerRef.current) {
            clearTimeout(autoResetTimerRef.current);
            autoResetTimerRef.current = null;
        }
        expireAtRef.current = null;
        setMode('IDLE');
        setOrderData({ 
            items: [], 
            subtotal: 0, 
            total: 0, 
            tax: 0, 
            discount: 0, 
            customer: null, 
            memberProfile: null, 
            tableName: null,
            paymentMethod: 'cash',
            cashReceived: 0,
            changeDue: 0,
            pointsEarned: 0,
            itemCount: 0,
            bookingId: null
        });
        setQrPayload(null);
        try {
            localStorage.setItem('pos_cfd_last_event', JSON.stringify({ type: 'IDLE', timestamp: Date.now() }));
        } catch (e) {}
    };

    // Watchdog interval to ensure screens return to IDLE even if background timer throttling occurs on Android Presentation WebView
    useEffect(() => {
        const watchdog = setInterval(() => {
            if (expireAtRef.current && Date.now() >= expireAtRef.current) {
                resetToIdle();
            }
        }, 1000);
        return () => clearInterval(watchdog);
    }, []);

    // Resilient Broadcast Channel + Supabase Realtime + Android Native Bridge + Cold Start Handshake
    useEffect(() => {
        const handleMsg = (data) => {
            if (!data) return;
            const { type, payload } = data;
            
            switch (type) {
                case 'IDLE':
                    resetToIdle();
                    break;

                case 'ORDER_CONFIRMED':
                    if (autoResetTimerRef.current) {
                        clearTimeout(autoResetTimerRef.current);
                        autoResetTimerRef.current = null;
                    }
                    setMode('ORDER_CONFIRMED');
                    if (payload) {
                        setOrderData(prev => ({ ...prev, ...payload }));
                    }
                    const orderConfirmDuration = 5000;
                    expireAtRef.current = Date.now() + orderConfirmDuration;
                    try {
                        localStorage.setItem('pos_cfd_last_event', JSON.stringify({ type, payload, timestamp: Date.now() }));
                    } catch (e) {}

                    autoResetTimerRef.current = setTimeout(() => {
                        resetToIdle();
                    }, orderConfirmDuration);
                    break;

                case 'UPDATE_CART':
                    if (autoResetTimerRef.current) {
                        clearTimeout(autoResetTimerRef.current);
                        autoResetTimerRef.current = null;
                    }
                    setMode('CART');
                    setOrderData(prev => ({ ...prev, ...payload }));
                    try {
                        localStorage.setItem('pos_cfd_last_event', JSON.stringify({ type, payload, timestamp: Date.now() }));
                    } catch (e) {}

                    // 60-second inactivity watchdog: If cashier stops adding items, gracefully return to IDLE
                    const cartInactivityDuration = 60000;
                    expireAtRef.current = Date.now() + cartInactivityDuration;
                    autoResetTimerRef.current = setTimeout(() => {
                        resetToIdle();
                    }, cartInactivityDuration);
                    break;

                case 'SHOW_QR':
                case 'SHOW_CHECKOUT':
                    if (autoResetTimerRef.current) {
                        clearTimeout(autoResetTimerRef.current);
                        autoResetTimerRef.current = null;
                    }
                    setMode('CHECKOUT');
                    if (payload?.orderData) {
                        setOrderData(prev => ({ ...prev, ...payload.orderData, ...payload }));
                    } else {
                        setOrderData(prev => ({ ...prev, ...payload }));
                    }
                    if (payload?.promptpayName) {
                        setStorePromptpayName(payload.promptpayName);
                    }
                    
                    // Generate PromptPay QR if total exists
                    const totalAmt = parseFloat(payload?.total || payload?.orderData?.total || 0);
                    const promptpayId = normalizePromptPayId(payload?.promptpayId || storePromptpayId);
                    if (totalAmt > 0) {
                        try {
                            const qr = generatePayload(promptpayId, { amount: totalAmt });
                            setQrPayload(qr);
                        } catch (e) {
                            console.error("QR Generation error:", e);
                        }
                    }
                    try {
                        localStorage.setItem('pos_cfd_last_event', JSON.stringify({ type, payload, timestamp: Date.now() }));
                    } catch (e) {}

                    // 120-second checkout watchdog
                    const checkoutDuration = 120000;
                    expireAtRef.current = Date.now() + checkoutDuration;
                    autoResetTimerRef.current = setTimeout(() => {
                        resetToIdle();
                    }, checkoutDuration);
                    break;

                case 'SPLIT_CHECKOUT':
                    if (autoResetTimerRef.current) {
                        clearTimeout(autoResetTimerRef.current);
                        autoResetTimerRef.current = null;
                    }
                    setMode('SPLIT_CHECKOUT');
                    if (payload) {
                        setOrderData(prev => ({ ...prev, ...payload }));
                    }
                    if (payload?.promptpayName) {
                        setStorePromptpayName(payload.promptpayName);
                    }
                    const splitAmt = parseFloat(payload?.splitTotal || 0);
                    const splitPromptpayId = normalizePromptPayId(payload?.promptpayId || storePromptpayId);
                    if (payload?.qrPayload) {
                        setQrPayload(payload.qrPayload);
                    } else if (splitAmt > 0) {
                        try {
                            const splitQr = generatePayload(splitPromptpayId, { amount: splitAmt });
                            setQrPayload(splitQr);
                        } catch (e) {
                            console.error("Split QR Generation error:", e);
                        }
                    }
                    try {
                        localStorage.setItem('pos_cfd_last_event', JSON.stringify({ type, payload, timestamp: Date.now() }));
                    } catch (e) {}

                    const splitDurationMax = 120000;
                    expireAtRef.current = Date.now() + splitDurationMax;
                    autoResetTimerRef.current = setTimeout(() => {
                        resetToIdle();
                    }, splitDurationMax);
                    break;

                case 'SPLIT_SUCCESS':
                    if (autoResetTimerRef.current) {
                        clearTimeout(autoResetTimerRef.current);
                    }
                    setMode('SPLIT_SUCCESS');
                    if (payload) {
                        setOrderData(prev => ({ ...prev, ...payload }));
                    }
                    const splitDuration = 5000;
                    expireAtRef.current = Date.now() + splitDuration;
                    try {
                        localStorage.setItem('pos_cfd_last_event', JSON.stringify({ type, payload, timestamp: Date.now() }));
                    } catch (e) {}

                    autoResetTimerRef.current = setTimeout(() => {
                        if (payload?.remainingBalance > 0) {
                            expireAtRef.current = null;
                            setMode('CART');
                        } else {
                            resetToIdle();
                        }
                    }, splitDuration);
                    break;

                case 'PAYMENT_SUCCESS':
                    if (autoResetTimerRef.current) {
                        clearTimeout(autoResetTimerRef.current);
                    }
                    setMode('SUCCESS');
                    if (payload) {
                        setOrderData(prev => ({ ...prev, ...payload }));
                    }
                    const successDuration = 6000;
                    expireAtRef.current = Date.now() + successDuration;
                    try {
                        localStorage.setItem('pos_cfd_last_event', JSON.stringify({ type, payload, timestamp: Date.now() }));
                    } catch (e) {}

                    autoResetTimerRef.current = setTimeout(() => {
                        resetToIdle();
                    }, successDuration);
                    break;

                default:
                    break;
            }
        };

        // 1. Initial hydration from localStorage with strict stale cache expiration check
        try {
            const cached = localStorage.getItem('pos_cfd_last_event');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed) {
                    const age = Date.now() - (parsed.timestamp || 0);
                    if (parsed.type === 'PAYMENT_SUCCESS' || parsed.type === 'SPLIT_SUCCESS') {
                        const maxAge = parsed.type === 'PAYMENT_SUCCESS' ? 6000 : 5000;
                        if (!parsed.timestamp || age >= maxAge) {
                            resetToIdle();
                        } else {
                            handleMsg(parsed);
                        }
                    } else if (parsed.type === 'ORDER_CONFIRMED') {
                        if (!parsed.timestamp || age >= 5000) {
                            resetToIdle();
                        } else {
                            handleMsg(parsed);
                        }
                    } else if (['UPDATE_CART', 'SHOW_CHECKOUT', 'SHOW_QR', 'SPLIT_CHECKOUT'].includes(parsed.type)) {
                        // Stale cart/checkout older than 45 seconds resets immediately to IDLE
                        if (!parsed.timestamp || age >= 45000) {
                            resetToIdle();
                        } else {
                            handleMsg(parsed);
                        }
                    } else {
                        resetToIdle();
                    }
                }
            }
        } catch (e) {}

        // 2. Local BroadcastChannel
        let channel = null;
        try {
            channel = new BroadcastChannel('pos_cfd_channel');
            channel.onmessage = (event) => handleMsg(event.data);
            channel.postMessage({ type: 'REQUEST_CFD_STATE' });
        } catch (e) {}

        // 3. Supabase Realtime Broadcast (Cross-device / Tablet support)
        const sbChannel = supabase.channel('pos_cfd_room');
        sbChannel.on('broadcast', { event: 'cfd_event' }, (envelope) => {
            handleMsg(envelope.payload);
        }).subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                sbChannel.send({
                    type: 'broadcast',
                    event: 'cfd_handshake',
                    payload: { timestamp: Date.now() }
                }).catch(() => {});
            }
        });

        // 4. Storage event listener for cross-window sync fallback
        const handleStorage = (e) => {
            if (e.key === 'pos_cfd_last_event' && e.newValue) {
                try {
                    const parsed = JSON.parse(e.newValue);
                    if (!parsed) return;
                    const age = Date.now() - (parsed.timestamp || 0);
                    if (parsed.type === 'PAYMENT_SUCCESS' || parsed.type === 'SPLIT_SUCCESS') {
                        const maxAge = parsed.type === 'PAYMENT_SUCCESS' ? 6000 : 5000;
                        if (parsed.timestamp && age < maxAge) {
                            handleMsg(parsed);
                        } else {
                            resetToIdle();
                        }
                    } else if (parsed.type === 'ORDER_CONFIRMED') {
                        if (parsed.timestamp && age < 5000) {
                            handleMsg(parsed);
                        } else {
                            resetToIdle();
                        }
                    } else if (['UPDATE_CART', 'SHOW_CHECKOUT', 'SHOW_QR', 'SPLIT_CHECKOUT'].includes(parsed.type)) {
                        if (parsed.timestamp && age < 45000) {
                            handleMsg(parsed);
                        } else {
                            resetToIdle();
                        }
                    } else {
                        resetToIdle();
                    }
                } catch {}
            }
        };
        window.addEventListener('storage', handleStorage);

        // 5. Android Direct Native Event Listener (0ms offline bridge from MainActivity)
        const handleNativeCfdEvent = (e) => {
            if (e.detail) {
                handleMsg(e.detail);
            }
        };
        window.addEventListener('pos_cfd_native_event', handleNativeCfdEvent);
        window.onCfdNativeEvent = (data) => {
            handleMsg(data);
        };

        return () => {
            if (channel) {
                try { channel.close(); } catch (e) {}
            }
            supabase.removeChannel(sbChannel);
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('pos_cfd_native_event', handleNativeCfdEvent);
            if (window.onCfdNativeEvent) {
                delete window.onCfdNativeEvent;
            }
            if (autoResetTimerRef.current) {
                clearTimeout(autoResetTimerRef.current);
            }
        };
    }, [storePromptpayId]);

    // -------------------------------------------------------------
    // RENDER 1: IDLE STANDBY (Neo-Brutalist Architectural Grid · Dieter Rams + Thai Modern)
    // -------------------------------------------------------------
    const renderIdleMode = () => {
        const timeStr = currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateStr = currentTime.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
        const activeSlide = slideshowImages[currentSlideIndex];

        return (
            <div className="w-full h-full bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] flex flex-col font-sans select-none overflow-hidden">
                
                {/* Structural Top Masthead (1px Brutalist Cellular Division) */}
                <header className="h-14 border-b border-[oklch(85%_0.012_28)]/20 flex items-stretch bg-[oklch(18%_0.012_28)] shrink-0 z-20">
                    {/* Brand Cell */}
                    <div className="flex items-center gap-3 px-5 border-r border-[oklch(85%_0.012_28)]/20 shrink-0">
                        <VenueLogo className="h-8 max-w-[140px] object-contain filter drop-shadow brightness-110" />
                        <div className="h-5 w-px bg-[oklch(85%_0.012_28)]/20" />
                        <div className="flex flex-col">
                            <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-[oklch(97%_0.008_28)] uppercase leading-none">
                                IN THE HAUS
                            </span>
                            <span className="font-sans text-[8.5px] text-[oklch(55%_0.010_28)] tracking-wider mt-0.5">
                                จริตจัดรสชัดเจน · นครพนม
                            </span>
                        </div>
                    </div>

                    {/* Ambient Marquee Ticker Cell */}
                    <div className="flex-1 overflow-hidden flex items-center px-4 border-r border-[oklch(85%_0.012_28)]/20">
                        <div className="whitespace-nowrap font-mono text-[10px] tracking-[0.25em] text-[oklch(55%_0.010_28)] uppercase animate-marquee">
                            IN THE HAUS · SPECIALTY COFFEE & MODERN THAI CUISINE · EST. 2024 · ARTISANAL DINING · HAUS TABLE OS · 
                        </div>
                    </div>

                    {/* Live Clock & Terminal Beacon Cell */}
                    <div className="flex items-center gap-4 px-5 shrink-0 bg-[oklch(22%_0.012_28)]">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[oklch(45%_0.08_140)] animate-pulse" />
                            <span className="font-mono text-[9px] font-bold tracking-widest text-[oklch(45%_0.08_140)] uppercase">
                                TERMINAL 01 · ONLINE
                            </span>
                        </div>
                        <div className="h-5 w-px bg-[oklch(85%_0.012_28)]/20" />
                        <div className="flex flex-col text-right font-mono">
                            <span className="text-xs font-black tracking-widest text-[oklch(97%_0.008_28)]">
                                {timeStr}
                            </span>
                            <span className="text-[8px] text-[oklch(55%_0.010_28)] tracking-wider">
                                {dateStr}
                            </span>
                        </div>
                    </div>
                </header>

                {/* Main Architectural Stage (Split 55% Showcase / 45% Membership Pass) */}
                <div className="flex-1 flex min-h-0 overflow-hidden">
                    
                    {/* Left Panel: Hero Menu Specimen Showcase (55% Width) */}
                    <div className="w-[55%] h-full relative overflow-hidden bg-black border-r border-[oklch(85%_0.012_28)]/20 flex flex-col justify-between">
                        <AnimatePresence mode="wait">
                            {activeSlide ? (
                                <motion.div
                                    key={currentSlideIndex}
                                    initial={{ opacity: 0, scale: 1.05 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                                    className="absolute inset-0"
                                >
                                    <img
                                        src={activeSlide.url}
                                        alt={activeSlide.name}
                                        className="w-full h-full object-cover opacity-80"
                                        onError={() => {
                                            setSlideshowImages(prev => {
                                                const next = prev.filter((_, idx) => idx !== currentSlideIndex);
                                                return next.length > 0 ? next : LOCAL_FEATURED_ITEMS;
                                            });
                                            setCurrentSlideIndex(0);
                                        }}
                                    />
                                    {/* Architectural Gradient Wash */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-[oklch(18%_0.012_28)] via-[oklch(18%_0.012_28)]/30 to-black/40" />

                                    {/* Tabular Specimen Badge */}
                                    <div className="absolute bottom-5 left-5 right-5 bg-[oklch(18%_0.012_28)]/95 backdrop-blur-md border border-[oklch(85%_0.012_28)]/30 p-4 rounded-xl shadow-2xl flex items-center justify-between">
                                        <div className="min-w-0 pr-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[9px] font-mono font-bold tracking-[0.2em] text-[oklch(52%_0.16_28)] uppercase">
                                                    SPEC // 0{((currentSlideIndex + 1) % 99)}
                                                </span>
                                                <span className="text-[9px] font-mono text-[oklch(55%_0.010_28)] uppercase tracking-wider">
                                                    · {activeSlide.category || 'FEATURED'}
                                                </span>
                                            </div>
                                            <h3 className="text-base lg:text-lg font-bold uppercase tracking-tight text-[oklch(97%_0.008_28)] truncate">
                                                {activeSlide.name}
                                            </h3>
                                        </div>

                                        <div className="bg-[oklch(52%_0.16_28)] text-[oklch(97%_0.008_28)] px-3 py-1.5 rounded-lg shrink-0 font-mono font-bold text-sm tracking-tight shadow-md">
                                            ฿{parseFloat(activeSlide.price || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>

                                    {/* Architectural Progress Indicator & Slide Logo */}
                                    <div className="absolute top-4 left-5 flex items-center gap-1.5 bg-[oklch(18%_0.012_28)]/80 px-2.5 py-1 rounded-full border border-[oklch(85%_0.012_28)]/20 backdrop-blur-xs font-mono text-[9px] text-[oklch(97%_0.008_28)]">
                                        <span className="text-[oklch(52%_0.16_28)] font-bold">{String(currentSlideIndex + 1).padStart(2, '0')}</span>
                                        <span className="text-[oklch(55%_0.010_28)]">/</span>
                                        <span className="text-[oklch(55%_0.010_28)]">{String(slideshowImages.length || 1).padStart(2, '0')}</span>
                                    </div>

                                    <div className="absolute top-4 right-5 z-10 opacity-90 flex items-center bg-[oklch(18%_0.012_28)]/80 px-3 py-1.5 rounded-full border border-[oklch(85%_0.012_28)]/20 backdrop-blur-xs">
                                        <VenueLogo className="h-5 max-w-[100px] object-contain filter drop-shadow brightness-110" />
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="h-full flex items-center justify-center font-mono text-xs tracking-widest text-[oklch(55%_0.010_28)] uppercase">
                                    IN THE HAUS TABLE SHOWCASE
                                </div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Right Panel: LINE LIFF Member QR (45% Width · Dieter Rams Minimalist Structure) */}
                    <div className="w-[45%] h-full p-6 flex flex-col justify-between bg-[oklch(18%_0.012_28)]">
                        
                        {/* Member Registration Minimal Enclosure */}
                        <div className="flex-1 flex flex-col items-center justify-center">
                            <div className="w-full max-w-[320px] bg-[oklch(22%_0.012_28)] border border-[oklch(85%_0.012_28)]/25 rounded-2xl p-6 flex flex-col items-center shadow-xl">
                                
                                <span className="font-mono text-[9px] font-bold tracking-[0.25em] text-[oklch(52%_0.16_28)] uppercase mb-4">
                                    MEMBER REGISTRATION
                                </span>

                                {/* Clean QR Code with High Contrast Paper Enclosure */}
                                <div className="bg-white p-4 rounded-2xl border-2 border-[oklch(85%_0.012_28)] shadow-lg flex flex-col items-center">
                                    <QRCodeSVG value={LINE_LIFF_MEMBER_URL} size={156} level="M" />
                                    <span className="font-mono text-[8px] font-black text-[oklch(18%_0.012_28)] tracking-[0.2em] uppercase mt-2">
                                        SCAN VIA LINE
                                    </span>
                                </div>

                                <div className="text-center mt-4 space-y-1">
                                    <h4 className="text-base font-bold text-[oklch(97%_0.008_28)] tracking-tight">
                                        สแกนสมัครสมาชิก
                                    </h4>
                                    <p className="font-mono text-[10px] text-[oklch(55%_0.010_28)] uppercase tracking-wider">
                                        LINE LIFF MEMBER PASS
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Venue Coordinates & Operating Hours */}
                        <div className="border-t border-[oklch(85%_0.012_28)]/20 pt-3 flex items-center justify-between text-[9.5px] font-mono text-[oklch(55%_0.010_28)] uppercase tracking-wider">
                            <div className="flex items-center gap-3">
                                <span>WI-FI : <strong className="text-[oklch(97%_0.008_28)]">IN THE HAUS 5G</strong></span>
                                <span>·</span>
                                <span>HOURS : <strong className="text-[oklch(97%_0.008_28)]">11.30 — 23.30</strong></span>
                            </div>
                            <span className="text-[oklch(52%_0.16_28)] font-bold">HAUS TABLE OS</span>
                        </div>
                    </div>
                </div>

                {/* Bottom Structural Footer Bar */}
                <footer className="h-7 border-t border-[oklch(85%_0.012_28)]/20 px-5 flex items-center justify-between text-[8.5px] font-mono text-[oklch(55%_0.010_28)] uppercase tracking-[0.2em] bg-[oklch(18%_0.012_28)] shrink-0 z-20">
                    <span>CUSTOMER FACING PRESENTATION</span>
                    <span className="text-[oklch(97%_0.008_28)] font-bold">IN THE HAUS จริตจัดรสชัดเจน · นครพนม</span>
                    <span>TOUCHLESS VERIFICATION</span>
                </footer>
            </div>
        );
    };

    // -------------------------------------------------------------
    // RENDER 1.5: ORDER CONFIRMED MODE (New Mode · Rams Clean Ticket Confirmation)
    // -------------------------------------------------------------
    const renderOrderConfirmedMode = () => (
        <div className="w-full h-full bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] flex flex-col items-center justify-center p-6 text-center font-sans relative overflow-hidden select-none">
            <motion.div
                initial={{ scale: 0.94, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 18 }}
                className="w-full max-w-lg bg-[oklch(22%_0.012_28)] border-2 border-[oklch(52%_0.16_28)] rounded-2xl p-6 shadow-2xl space-y-4"
            >
                <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)]/20 pb-3">
                    <VenueLogo className="h-7 max-w-[120px] object-contain brightness-110" />
                    <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] bg-[oklch(52%_0.16_28)] text-[oklch(97%_0.008_28)] px-2.5 py-1 rounded">
                        ORDER RECEIVED
                    </span>
                </div>

                <div className="space-y-1.5 py-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[oklch(45%_0.08_140)] font-bold block">
                        KITCHEN & BAR DISPATCH
                    </span>
                    <h2 className="text-2xl font-bold uppercase tracking-tight text-[oklch(97%_0.008_28)]">
                        บันทึกออเดอร์ส่งเข้าครัวแล้ว
                    </h2>
                    <p className="text-xs text-[oklch(55%_0.010_28)] font-sans">
                        เชฟและบาริสต้ากำลังจัดเตรียมเมนูอย่างพิถีพิถัน
                    </p>
                </div>

                <div className="bg-[oklch(18%_0.012_28)] border border-[oklch(85%_0.012_28)]/20 rounded-xl p-3.5 flex items-center justify-around font-mono">
                    <div className="text-center">
                        <span className="text-[8.5px] uppercase tracking-widest text-[oklch(55%_0.010_28)] block">TABLE / ORDER</span>
                        <span className="text-base font-bold text-[oklch(97%_0.008_28)]">
                            {orderData.tableName || 'COUNTER'}
                        </span>
                    </div>
                    <div className="h-7 w-px bg-[oklch(85%_0.012_28)]/20" />
                    <div className="text-center">
                        <span className="text-[8.5px] uppercase tracking-widest text-[oklch(55%_0.010_28)] block">TOTAL ITEMS</span>
                        <span className="text-base font-bold text-[oklch(52%_0.16_28)]">
                            {orderData.itemCount || orderData.items?.length || 1} รายการ
                        </span>
                    </div>
                    {orderData.totalAmount > 0 && (
                        <>
                            <div className="h-7 w-px bg-[oklch(85%_0.012_28)]/20" />
                            <div className="text-center">
                                <span className="text-[8.5px] uppercase tracking-widest text-[oklch(55%_0.010_28)] block">SUBTOTAL</span>
                                <span className="text-base font-bold text-[oklch(97%_0.008_28)]">
                                    ฿{orderData.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </>
                    )}
                </div>

                {/* 5-second progress countdown bar */}
                <div className="space-y-1">
                    <div className="w-full bg-[oklch(18%_0.012_28)] h-1 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: '100%' }}
                            animate={{ width: '0%' }}
                            transition={{ duration: 5, ease: 'linear' }}
                            className="h-full bg-[oklch(52%_0.16_28)]"
                        />
                    </div>
                    <span className="text-[8px] font-mono text-[oklch(55%_0.010_28)] tracking-widest uppercase">
                        RETURNING TO STANDBY IN 5 SECONDS...
                    </span>
                </div>
            </motion.div>
        </div>
    );

    // -------------------------------------------------------------
    // RENDER 2: CART REVIEW MODE (10.1" 1024x600 Live Order Verification)
    // -------------------------------------------------------------
    const renderCartMode = () => (
        <div className="w-full h-full bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] flex font-sans overflow-hidden select-none">
            
            {/* Left Pane: Customer Greeting & Active Promo Showcase */}
            <div className="w-5/12 h-full bg-[oklch(94%_0.010_28)] border-r border-[oklch(85%_0.012_28)] p-4 flex flex-col justify-between">
                <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                        <VenueLogo className="h-8 max-w-[120px] object-contain" />
                        <div className="h-4 w-px bg-[oklch(85%_0.012_28)]" />
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[oklch(55%_0.010_28)] truncate">
                            {orderData.tableName ? `TABLE : ${orderData.tableName}` : 'DIRECT CHECKOUT'}
                        </span>
                    </div>

                    {/* Member Profile Banner if attached */}
                    {orderData.memberProfile ? (() => {
                        const mp = orderData.memberProfile;
                        const coins = Math.max(0, parseFloat(mp.xhaus_balance ?? mp.xhaus_coins ?? mp.points_balance ?? mp.points ?? 0) || 0);
                        const stamps = parseInt(mp.drink_stamp_count || 0, 10);
                        const freeDrinks = parseInt(mp.free_drink_quota || 0, 10);
                        const tier = mp.current_tier || mp.tier || 'HAUS COMMON';

                        return (
                            <div className="bg-white border border-[oklch(85%_0.012_28)] rounded-xl p-3 space-y-2 shadow-2xs">
                                {/* Header: Member Name & Tier */}
                                <div className="flex items-center justify-between border-b border-[oklch(85%_0.012_28)]/60 pb-1.5">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="w-2.5 h-2.5 rounded-full bg-[oklch(52%_0.16_28)] shrink-0 animate-pulse" />
                                        <div className="min-w-0">
                                            <span className="text-[7.5px] font-mono font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] block">
                                                IN THE HAUS MEMBER
                                            </span>
                                            <h2 className="text-sm font-bold text-[oklch(18%_0.012_28)] truncate leading-tight uppercase">
                                                {mp.display_name || mp.name || orderData.customer}
                                            </h2>
                                        </div>
                                    </div>
                                    <span className="text-[8px] font-mono font-bold bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-1.5 py-0.5 rounded uppercase shrink-0">
                                        {tier}
                                    </span>
                                </div>

                                {/* Points & Stamp Card Metrics */}
                                <div className="grid grid-cols-2 gap-1.5 font-mono">
                                    {/* Points Box */}
                                    <div className="bg-[oklch(94%_0.010_28)]/80 border border-[oklch(85%_0.012_28)] rounded-lg p-1.5 flex flex-col justify-between">
                                        <span className="text-[8px] font-bold text-[oklch(55%_0.010_28)] uppercase flex items-center gap-1">
                                            แต้ม XHAUS
                                        </span>
                                        <div className="mt-0.5">
                                            <span className="text-xs font-black text-[oklch(52%_0.16_28)]">
                                                {Math.floor(coins).toLocaleString()} pts
                                            </span>
                                            <span className="text-[8px] text-[oklch(55%_0.010_28)] block">
                                                ≈ ส่วนลด ฿{Math.floor(coins).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Cup Stamps Box */}
                                    <div className="bg-[oklch(94%_0.010_28)]/80 border border-[oklch(85%_0.012_28)] rounded-lg p-1.5 flex flex-col justify-between">
                                        <div className="flex items-center justify-between text-[8px] font-bold text-[oklch(55%_0.010_28)] uppercase">
                                            <span>แก้วสะสม</span>
                                            <span>{stamps}/10</span>
                                        </div>
                                        <div className="flex items-center gap-0.5 mt-1">
                                            {STAMP_PUNCHCARD_SLOTS.map((i) => (
                                                <span
                                                    key={i}
                                                    className={`flex-1 h-1.5 rounded-full transition-all ${
                                                        i < stamps 
                                                            ? 'bg-[oklch(52%_0.16_28)]' 
                                                            : 'bg-[oklch(85%_0.012_28)]'
                                                    }`}
                                                />
                                            ))}
                                        </div>
                                        <span className="text-[7.5px] text-[oklch(55%_0.010_28)] mt-0.5">
                                            {stamps >= 10 ? 'ครบ 10 แก้วแล้ว!' : `อีก ${10 - stamps} แก้ว รับฟรี 1 แก้ว`}
                                        </span>
                                    </div>
                                </div>

                                {/* Free Drink Alert Badge */}
                                {freeDrinks > 0 && (
                                    <div className="bg-[oklch(45%_0.08_140)]/15 border border-[oklch(45%_0.08_140)]/30 rounded-lg p-1.5 flex items-center justify-between text-[9px] font-mono font-bold text-[oklch(18%_0.012_28)]">
                                        <span>สิทธิ์เครื่องดื่มฟรี: {freeDrinks} แก้ว</span>
                                        <span className="text-[8px] bg-[oklch(45%_0.08_140)] text-white px-1.5 py-0.2 rounded uppercase">
                                            พร้อมใช้
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })() : orderData.customer && !['Walk-in Guest', 'Walk-in Pick-up', 'Walk-in Customer', 'Walk-in'].includes(orderData.customer) ? (
                        <div className="bg-white border border-[oklch(85%_0.012_28)] rounded-xl p-3 space-y-0.5 shadow-2xs">
                            <span className="text-[8px] font-mono font-bold uppercase tracking-widest text-[oklch(55%_0.010_28)]">
                                CUSTOMER
                            </span>
                            <h2 className="text-sm font-bold text-[oklch(18%_0.012_28)] truncate">
                                {orderData.customer}
                            </h2>
                            <p className="text-[10px] text-[oklch(55%_0.010_28)] font-sans pt-0.5">
                                สั่งอาหารกับแคชเชียร์ / สามารถแจ้งเบอร์เพื่อสะสมแต้มสมาชิก XHAUS ได้
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white border border-[oklch(85%_0.012_28)] rounded-xl p-3 space-y-0.5 shadow-2xs">
                            <h3 className="text-sm font-bold text-[oklch(18%_0.012_28)]">
                                สั่งอาหารกับแคชเชียร์
                            </h3>
                            <p className="text-[10px] text-[oklch(55%_0.010_28)] font-sans leading-relaxed">
                                ตรวจสอบรายการอาหารทางด้านขวา และแจ้งสะสมแต้มสมาชิกได้ทันที
                            </p>
                        </div>
                    )}
                </div>

                {/* Minimalist Summary Status */}
                <div className="bg-white border border-[oklch(85%_0.012_28)] rounded-xl p-3 space-y-1.5 shadow-xs">
                    <div className="flex justify-between items-center text-[10px] font-mono text-[oklch(55%_0.010_28)]">
                        <span>TOTAL ITEMS</span>
                        <span className="font-bold text-[oklch(18%_0.012_28)]">
                            {orderData.items?.reduce((sum, i) => sum + i.quantity, 0) || 0} รายการ
                        </span>
                    </div>
                    {orderData.discount > 0 && (
                        <div className="flex justify-between items-center text-[10px] font-mono text-[oklch(45%_0.08_140)] font-bold">
                            <span>SAVINGS / DISCOUNT</span>
                            <span>
                                - ฿{orderData.discount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    )}
                    <div className="border-t border-[oklch(85%_0.012_28)] pt-1.5 flex justify-between items-end">
                        <span className="text-xs font-sans font-bold uppercase text-[oklch(18%_0.012_28)]">
                            ยอดรวมสุทธิ
                        </span>
                        <span className="text-2xl font-mono font-black text-[oklch(52%_0.16_28)]">
                            ฿{(orderData.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Right Pane: Live Itemized Order List */}
            <div className="w-7/12 h-full flex flex-col justify-between p-4 bg-[oklch(97%_0.008_28)] overflow-hidden">
                <div className="pb-2 border-b border-[oklch(85%_0.012_28)] flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[oklch(52%_0.16_28)] animate-pulse" />
                        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                            YOUR ORDER SUMMARY
                        </h2>
                    </div>
                    <VenueLogo className="h-5 max-w-[90px] object-contain opacity-90" />
                </div>

                {/* Items List */}
                <div className="flex-1 min-h-0 overflow-y-auto cfd-scrollbar py-2 space-y-1.5 pr-1">
                    <AnimatePresence>
                        {orderData.items && orderData.items.length > 0 ? (
                            orderData.items.map((item, idx) => (
                                <motion.div
                                    key={item.id || idx}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white border border-[oklch(85%_0.012_28)] rounded-lg p-2.5 flex items-center justify-between shadow-2xs"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                                        <span className="w-6 h-6 rounded bg-[oklch(52%_0.16_28)]/10 text-[oklch(52%_0.16_28)] font-mono font-bold flex items-center justify-center text-xs shrink-0">
                                            {item.quantity}x
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-xs text-[oklch(18%_0.012_28)] uppercase leading-tight truncate">
                                                    {item.name}
                                                </h3>
                                                {item.destination && (
                                                    <span className="text-[8px] font-mono uppercase px-1 py-0.2 rounded bg-[oklch(94%_0.010_28)] text-[oklch(55%_0.010_28)] shrink-0 border border-[oklch(85%_0.012_28)]">
                                                        {item.destination === 'bar' ? 'BAR' : 'KITCHEN'}
                                                    </span>
                                                )}
                                            </div>
                                            {item.selected_options && item.selected_options.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {item.selected_options.map((opt, i) => (
                                                        <span key={i} className="text-[9px] font-mono font-bold bg-[oklch(94%_0.010_28)] text-[oklch(55%_0.010_28)] px-1.5 py-0.5 rounded border border-[oklch(85%_0.012_28)]">
                                                            {typeof opt === 'object' ? (opt.name + (opt.price ? ` +฿${opt.price}` : '')) : opt}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            {item.item_note && (
                                                <p className="text-[9px] font-sans text-[oklch(52%_0.16_28)] mt-0.5">
                                                    โน้ต: {item.item_note}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="text-xs font-mono font-bold text-[oklch(18%_0.012_28)] shrink-0">
                                        ฿{(item.price * item.quantity).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-[oklch(55%_0.010_28)] font-mono text-[11px] uppercase tracking-widest gap-2 py-8">
                                <span>กำลังเลือกรายการอาหาร...</span>
                            </div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer Totals */}
                <div className="pt-2 border-t border-[oklch(85%_0.012_28)] space-y-0.5 shrink-0">
                    <div className="flex justify-between text-[10px] font-mono text-[oklch(55%_0.010_28)]">
                        <span>SUBTOTAL</span>
                        <span>฿{(orderData.subtotal || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {orderData.discount > 0 && (
                        <div className="flex justify-between text-[10px] font-mono text-[oklch(45%_0.08_140)] font-bold">
                            <span>DISCOUNT / SAVINGS</span>
                            <span>- ฿{orderData.discount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                        </div>
                    )}
                    {orderData.tax > 0 && (
                        <div className="flex justify-between text-[10px] font-mono text-[oklch(55%_0.010_28)]">
                            <span>VAT (7%)</span>
                            <span>฿{orderData.tax.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    // -------------------------------------------------------------
    // RENDER 3: CHECKOUT & PROMPTPAY QR MODE (10.1" 1024x600 Optimized)
    // -------------------------------------------------------------
    const renderCheckoutMode = () => (
        <div className="w-full h-full bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] flex font-sans overflow-hidden select-none">
            
            {/* Left Column: Order Bill Recap */}
            <div className="w-1/2 h-full bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] border-r border-[oklch(85%_0.012_28)] p-4 flex flex-col justify-between overflow-hidden">
                <div className="flex flex-col flex-1 min-h-0">
                    <div className="flex items-center justify-between mb-1.5 shrink-0">
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)]">
                            CHECKOUT PAYMENT
                        </span>
                        <VenueLogo className="h-5 max-w-[90px] object-contain" />
                    </div>
                    <h2 className="text-lg font-bold uppercase tracking-tight mb-2 shrink-0">
                        สรุปรายการชำระเงิน
                    </h2>

                    {orderData.memberProfile && (() => {
                        const mp = orderData.memberProfile;
                        const coins = Math.max(0, parseFloat(mp.xhaus_balance ?? mp.xhaus_coins ?? mp.points_balance ?? mp.points ?? 0) || 0);
                        const stamps = parseInt(mp.drink_stamp_count || 0, 10);
                        const tier = mp.current_tier || mp.tier || 'MEMBER';

                        return (
                            <div className="bg-[oklch(52%_0.16_28)]/10 border border-[oklch(52%_0.16_28)]/20 p-2 rounded-lg flex items-center justify-between text-[10px] font-mono mb-2 shrink-0">
                                <div className="min-w-0 mr-2">
                                    <span className="font-bold text-[oklch(18%_0.012_28)] truncate block">
                                        สมาชิก: {mp.display_name || mp.name || orderData.customer}
                                    </span>
                                    <span className="text-[8.5px] text-[oklch(55%_0.010_28)] flex items-center gap-1.5 mt-0.5">
                                        <span>{Math.floor(coins).toLocaleString()} pts</span>
                                        <span>·</span>
                                        <span>{stamps}/10 แก้ว</span>
                                    </span>
                                </div>
                                <span className="text-[8px] font-bold bg-[oklch(52%_0.16_28)] text-white px-1.5 py-0.5 rounded uppercase shrink-0">
                                    {tier}
                                </span>
                            </div>
                        );
                    })()}

                    <div className="flex-1 min-h-0 overflow-y-auto cfd-scrollbar space-y-1 pr-1">
                        {orderData.items?.map((item, idx) => (
                            <div key={item.id || idx} className="flex justify-between items-center p-2 bg-[oklch(94%_0.010_28)] rounded-lg border border-[oklch(85%_0.012_28)]">
                                <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                                    <span className="font-mono font-bold text-[10px] bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-1.5 py-0.5 rounded shrink-0">
                                        {item.quantity}x
                                    </span>
                                    <span className="font-bold text-[11px] uppercase truncate">{item.name}</span>
                                </div>
                                <span className="font-mono font-bold text-xs shrink-0">
                                    ฿{(item.price * item.quantity).toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Amount Due Box */}
                <div className="bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] p-3 rounded-xl space-y-1 shrink-0 mt-2">
                    <div className="flex justify-between text-[10px] font-mono text-[oklch(55%_0.010_28)]">
                        <span>PAYMENT METHOD</span>
                        <span className="font-bold text-[oklch(52%_0.16_28)] uppercase">{orderData.paymentMethod === 'cash' ? 'เงินสด (Cash)' : 'PromptPay QR'}</span>
                    </div>
                    
                    {orderData.paymentMethod === 'cash' && orderData.cashReceived > 0 && (
                        <>
                            <div className="flex justify-between text-[10px] font-mono text-[oklch(55%_0.010_28)]">
                                <span>CASH RECEIVED</span>
                                <span>฿{orderData.cashReceived.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-[10px] font-mono font-bold text-emerald-600 border-t border-[oklch(85%_0.012_28)] pt-1">
                                <span>CHANGE DUE (เงินทอน)</span>
                                <span>฿{(orderData.changeDue || 0).toLocaleString()}</span>
                            </div>
                        </>
                    )}

                    <div className="flex justify-between items-end border-t border-[oklch(85%_0.012_28)] pt-1.5">
                        <span className="text-xs font-sans font-bold uppercase text-[oklch(18%_0.012_28)]">ยอดเงินที่ต้องชำระ</span>
                        <span className="text-2xl font-mono font-black text-[oklch(52%_0.16_28)]">
                            ฿{(orderData.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Right Column: PromptPay QR / Cash Status */}
            <div className="w-1/2 h-full flex flex-col items-center justify-center p-4 bg-[oklch(18%_0.012_28)] text-center">
                {orderData.paymentMethod === 'cash' ? (
                    <div className="bg-white text-[oklch(18%_0.012_28)] p-5 rounded-2xl w-full max-w-[280px] flex flex-col items-center shadow-xl border border-white/20">
                        <VenueLogo className="h-7 max-w-[120px] object-contain mb-3" />
                        <div className="w-full bg-[oklch(18%_0.012_28)] text-white py-1.5 font-bold text-[11px] font-mono tracking-wider uppercase mb-3 flex items-center justify-center gap-1.5 rounded-md">
                            <span>CASH PAYMENT / ชำระเงินสด</span>
                        </div>
                        <div className="w-full space-y-2.5 font-mono text-center">
                            <div className="bg-[oklch(94%_0.010_28)] p-3 rounded-xl border border-[oklch(85%_0.012_28)]">
                                <span className="text-[9px] text-[oklch(55%_0.010_28)] uppercase block font-bold mb-0.5">ยอดรวมชำระ</span>
                                <span className="text-2xl font-black text-[oklch(52%_0.16_28)]">฿{(orderData.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                            </div>
                            {orderData.cashReceived > 0 && (
                                <div className="space-y-1.5 pt-0.5">
                                    <div className="flex justify-between text-[11px] font-bold text-[oklch(18%_0.012_28)] px-1">
                                        <span>รับเงินสดมา:</span>
                                        <span>฿{orderData.cashReceived.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between text-xs font-black text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
                                        <span>เงินทอน (Change):</span>
                                        <span>฿{(orderData.changeDue || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white text-[oklch(18%_0.012_28)] p-3.5 rounded-2xl w-full max-w-[270px] flex flex-col items-center shadow-xl relative overflow-hidden border border-white/20">
                        <VenueLogo className="h-6 max-w-[110px] object-contain mb-1.5" />
                        {/* PromptPay Header */}
                        <div className="w-full bg-[#003D7A] text-white py-1.5 font-bold text-[10px] font-mono tracking-wider uppercase mb-2 flex items-center justify-center gap-1.5 rounded-md shadow-2xs">
                            <span>PROMPTPAY QR PAYMENT</span>
                        </div>

                        <div className="p-1.5 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-xl shadow-inner mb-1.5">
                            {qrPayload ? (
                                <QRCodeSVG value={qrPayload} size={140} level="M" />
                            ) : paymentQrUrl || orderData.paymentQrUrl ? (
                                <img src={paymentQrUrl || orderData.paymentQrUrl} alt="PromptPay QR" className="w-[140px] h-[140px] object-contain" />
                            ) : (
                                <div className="w-[140px] h-[140px] bg-gray-100 flex items-center justify-center text-[10px] font-mono text-gray-400">
                                    Generating PromptPay QR...
                                </div>
                            )}
                        </div>

                        {/* PromptPay Account Name & Phone/Tax ID */}
                        <div className="w-full text-center space-y-0.5 border-t border-[oklch(85%_0.012_28)]/60 pt-1.5 mb-1.5">
                            {storePromptpayName && (
                                <div className="text-[10px] font-bold text-[oklch(18%_0.012_28)] truncate px-1">
                                    ชื่อบัญชี: {storePromptpayName}
                                </div>
                            )}
                            <div className="text-[9px] font-mono font-bold text-[oklch(42%_0.010_28)] tracking-wide">
                                พร้อมเพย์: {formatPromptpayDisplay(storePromptpayId)}
                            </div>
                        </div>

                        <div className="space-y-0.5 text-center">
                            <span className="text-[7.5px] font-mono text-[oklch(55%_0.010_28)] uppercase tracking-widest block">
                                SCAN WITH MOBILE BANKING APP
                            </span>
                            <p className="text-xl font-mono font-black text-[oklch(52%_0.16_28)]">
                                ฿{(orderData.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                )}

                <div className="mt-3 flex items-center gap-2 text-[oklch(55%_0.010_28)] text-[10px] font-mono uppercase tracking-wider">
                    <span>{orderData.paymentMethod === 'cash' ? 'กรุณาชำระเงินสดที่แคชเชียร์' : 'กรุณาแสดงสลิปการโอนเงินต่อพนักงาน'}</span>
                </div>
            </div>
        </div>
    );

    // -------------------------------------------------------------
    // RENDER 3.5: SPLIT CHECKOUT MODE (10.1" 1024x600 Split Bill Presentation)
    // -------------------------------------------------------------
    const renderSplitCheckoutMode = () => (
        <div className="w-full h-full bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] flex font-sans overflow-hidden select-none">
            {/* Left Column: Split Summary & Items/Shares */}
            <div className="w-1/2 h-full bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] border-r border-[oklch(85%_0.012_28)] p-4 flex flex-col justify-between overflow-hidden">
                <div className="flex flex-col flex-1 min-h-0">
                    <div className="flex items-center justify-between mb-1.5 shrink-0">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-[oklch(52%_0.16_28)] text-white px-1.5 py-0.5 rounded">
                                SPLIT PAYMENT
                            </span>
                            <span className="text-[10px] font-mono font-bold uppercase text-[oklch(55%_0.010_28)]">
                                {orderData.tableName ? `โต๊ะ : ${orderData.tableName}` : 'WALK-IN'}
                            </span>
                        </div>
                        <VenueLogo className="h-5 max-w-[90px] object-contain" />
                    </div>

                    <h2 className="text-lg font-bold uppercase tracking-tight mb-2 shrink-0">
                        {orderData.splitMode === 'ITEMS' ? 'ชำระตามรายการที่เลือก' : orderData.splitMode === 'EQUAL' ? 'ชำระแบบหารเท่า' : 'ชำระตามยอดที่ระบุ'}
                    </h2>

                    {orderData.memberProfile && (
                        <div className="bg-[oklch(52%_0.16_28)]/10 border border-[oklch(52%_0.16_28)]/20 p-2 rounded-lg flex items-center justify-between text-[11px] font-mono mb-2 shrink-0">
                            <span className="font-bold text-[oklch(18%_0.012_28)] truncate mr-2">
                                สมาชิก: {orderData.memberProfile.display_name || orderData.memberProfile.name}
                            </span>
                            <span className="text-[8px] font-bold bg-[oklch(52%_0.16_28)] text-white px-1.5 py-0.5 rounded uppercase shrink-0">
                                {orderData.memberProfile.current_tier || orderData.memberProfile.tier || 'MEMBER'}
                            </span>
                        </div>
                    )}

                    {/* Mode Specific Body */}
                    {orderData.splitMode === 'ITEMS' && orderData.selectedItems && orderData.selectedItems.length > 0 ? (
                        <div className="flex-1 min-h-0 overflow-y-auto cfd-scrollbar space-y-1 pr-1">
                            {orderData.selectedItems.map((item, idx) => (
                                <div key={item.id || idx} className="flex justify-between items-center p-2 bg-[oklch(94%_0.010_28)] rounded-lg border border-[oklch(85%_0.012_28)]">
                                    <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                                        <span className="font-mono font-bold text-[10px] bg-[oklch(52%_0.16_28)] text-white px-1.5 py-0.5 rounded shrink-0">
                                            {item.selectedQty || item.quantity}x
                                        </span>
                                        <span className="font-bold text-[11px] uppercase truncate">{item.name}</span>
                                    </div>
                                    <span className="font-mono font-bold text-xs shrink-0">
                                        ฿{((item.price) * (item.selectedQty || item.quantity)).toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : orderData.splitMode === 'EQUAL' && orderData.equalSplitInfo ? (
                        <div className="bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-xl p-3 space-y-1 text-center my-2 shrink-0">
                            <span className="text-[10px] font-mono text-[oklch(55%_0.010_28)] uppercase font-bold">
                                หารเท่ากัน {orderData.equalSplitInfo.totalPeople} ท่าน
                            </span>
                            <h3 className="text-base font-bold text-[oklch(18%_0.012_28)]">
                                ท่านที่ {orderData.equalSplitInfo.currentPerson} จาก {orderData.equalSplitInfo.totalPeople} ท่าน
                            </h3>
                            <p className="text-xs font-mono text-[oklch(52%_0.16_28)] font-bold">
                                ยอดชำระส่วนนี้: ฿{(orderData.splitTotal || orderData.equalSplitInfo.amount || 0).toLocaleString()}
                            </p>
                        </div>
                    ) : (
                        <div className="bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-xl p-3 space-y-1 text-center my-2 shrink-0">
                            <span className="text-[10px] font-mono text-[oklch(55%_0.010_28)] uppercase font-bold">
                                ชำระบางส่วนตามยอดเงินที่ระบุ
                            </span>
                            <p className="text-xl font-mono font-black text-[oklch(52%_0.16_28)]">
                                ฿{(orderData.splitTotal || 0).toLocaleString()}
                            </p>
                        </div>
                    )}
                </div>

                {/* Split Totals Breakdown */}
                <div className="bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] p-3 rounded-xl space-y-1 shrink-0 mt-2">
                    <div className="flex justify-between text-[10px] font-mono text-[oklch(55%_0.010_28)]">
                        <span>ยอดบิลรวมทั้งโต๊ะ (TABLE TOTAL)</span>
                        <span className="font-bold">฿{(orderData.orderTotal || 0).toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between text-[10px] font-mono text-[oklch(55%_0.010_28)]">
                        <span>ยอดคงเหลือของโต๊ะ (REMAINING)</span>
                        <span className="font-bold text-[oklch(18%_0.012_28)]">฿{(orderData.remainingBalance || 0).toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between items-end border-t border-[oklch(85%_0.012_28)] pt-1.5">
                        <span className="text-xs font-sans font-bold uppercase text-[oklch(18%_0.012_28)]">
                            ยอดชำระรอบนี้ (THIS PORTION)
                        </span>
                        <span className="text-2xl font-mono font-black text-[oklch(52%_0.16_28)]">
                            ฿{(orderData.splitTotal || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Right Column: PromptPay QR / Cash Status */}
            <div className="w-1/2 h-full flex flex-col items-center justify-center p-4 bg-[oklch(18%_0.012_28)] text-center">
                {orderData.paymentMethod === 'cash' ? (
                    <div className="bg-white text-[oklch(18%_0.012_28)] p-5 rounded-2xl w-full max-w-[280px] flex flex-col items-center shadow-xl border border-white/20">
                        <VenueLogo className="h-7 max-w-[120px] object-contain mb-3" />
                        <div className="w-full bg-[oklch(18%_0.012_28)] text-white py-1.5 font-bold text-[11px] font-mono tracking-wider uppercase mb-3 flex items-center justify-center gap-1.5 rounded-md">
                            <span>CASH PAYMENT / ชำระเงินสด</span>
                        </div>
                        <div className="w-full space-y-2.5 font-mono text-center">
                            <div className="bg-[oklch(94%_0.010_28)] p-3 rounded-xl border border-[oklch(85%_0.012_28)]">
                                <span className="text-[9px] text-[oklch(55%_0.010_28)] uppercase block font-bold mb-0.5">ยอดชำระรอบนี้</span>
                                <span className="text-2xl font-black text-[oklch(52%_0.16_28)]">฿{(orderData.splitTotal || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                            </div>
                            {orderData.cashReceived > 0 && (
                                <div className="space-y-1.5 pt-0.5">
                                    <div className="flex justify-between text-[11px] font-bold text-[oklch(18%_0.012_28)] px-1">
                                        <span>รับเงินสดมา:</span>
                                        <span>฿{orderData.cashReceived.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between text-xs font-black text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
                                        <span>เงินทอน (Change):</span>
                                        <span>฿{(orderData.changeDue || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white text-[oklch(18%_0.012_28)] p-3.5 rounded-2xl w-full max-w-[270px] flex flex-col items-center shadow-xl relative overflow-hidden border border-white/20">
                        <VenueLogo className="h-6 max-w-[110px] object-contain mb-1.5" />
                        {/* PromptPay Header */}
                        <div className="w-full bg-[#003D7A] text-white py-1.5 font-bold text-[10px] font-mono tracking-wider uppercase mb-2 flex items-center justify-center gap-1.5 rounded-md shadow-2xs">
                            <span>SPLIT PROMPTPAY QR</span>
                        </div>

                        <div className="p-1.5 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-xl shadow-inner mb-1.5">
                            {qrPayload ? (
                                <QRCodeSVG value={qrPayload} size={140} level="M" />
                            ) : (
                                <div className="w-[140px] h-[140px] bg-gray-100 flex items-center justify-center text-[10px] font-mono text-gray-400">
                                    Generating PromptPay QR...
                                </div>
                            )}
                        </div>

                        {/* PromptPay Account Name & Phone/Tax ID */}
                        <div className="w-full text-center space-y-0.5 border-t border-[oklch(85%_0.012_28)]/60 pt-1.5 mb-1.5">
                            {storePromptpayName && (
                                <div className="text-[10px] font-bold text-[oklch(18%_0.012_28)] truncate px-1">
                                    ชื่อบัญชี: {storePromptpayName}
                                </div>
                            )}
                            <div className="text-[9px] font-mono font-bold text-[oklch(42%_0.010_28)] tracking-wide">
                                พร้อมเพย์: {formatPromptpayDisplay(storePromptpayId)}
                            </div>
                        </div>

                        <div className="space-y-0.5 text-center">
                            <span className="text-[7.5px] font-mono text-[oklch(55%_0.010_28)] uppercase tracking-widest block">
                                SCAN TO PAY THIS PORTION
                            </span>
                            <p className="text-xl font-mono font-black text-[oklch(52%_0.16_28)]">
                                ฿{(orderData.splitTotal || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                )}

                <div className="mt-3 flex items-center gap-2 text-[oklch(55%_0.010_28)] text-[10px] font-mono uppercase tracking-wider">
                    <span>{orderData.paymentMethod === 'cash' ? 'กรุณาชำระเงินสดที่แคชเชียร์' : 'สแกน QR เพื่อชำระยอดเฉพาะส่วนนี้'}</span>
                </div>
            </div>
        </div>
    );

    // -------------------------------------------------------------
    // RENDER 3.6: SPLIT SUCCESS MODE (Non-Touch Display Optimized)
    // -------------------------------------------------------------
    const renderSplitSuccessMode = () => (
        <div className="w-full h-full bg-[oklch(45%_0.08_140)] text-[oklch(97%_0.008_28)] flex flex-col items-center justify-center p-6 text-center font-sans relative overflow-hidden select-none">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 15 }}
                className="flex flex-col items-center space-y-3.5 max-w-md"
            >
                <VenueLogo className="h-10 max-w-[160px] object-contain brightness-200 filter drop-shadow-md mb-1" />

                <div className="space-y-1">
                    <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-white/80">
                        SPLIT PAYMENT SUCCESSFUL
                    </span>
                    <h1 className="text-2xl font-bold uppercase tracking-tight text-white leading-tight">
                        ชำระส่วนนี้เรียบร้อยแล้ว
                    </h1>
                    <p className="text-xs font-sans text-white/90">
                        ยอดชำระส่วนนี้: ฿{(orderData.splitTotal || 0).toLocaleString()}
                    </p>
                </div>

                {orderData.remainingBalance > 0 ? (
                    <div className="bg-white/10 border border-white/20 p-3.5 rounded-xl w-full backdrop-blur-xs space-y-1">
                        <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-amber-300">
                            REMAINING TABLE BALANCE
                        </span>
                        <p className="text-xl font-mono font-black text-white">
                            ยอดคงเหลือโต๊ะ: ฿{orderData.remainingBalance.toLocaleString()}
                        </p>
                        <p className="text-[11px] text-white/80 font-sans pt-0.5">
                            เชิญท่านถัดไปชำระต่อได้ทันทีครับ
                        </p>
                    </div>
                ) : (
                    <div className="bg-white/10 border border-white/20 p-3.5 rounded-xl w-full backdrop-blur-xs space-y-1">
                        <p className="text-lg font-bold text-white">
                            ชำระครบถ้วนทั้งโต๊ะแล้ว ขอบคุณครับ!
                        </p>
                    </div>
                )}

                <span className="text-[9px] font-mono text-white/60 tracking-widest uppercase pt-1">
                    IN THE HAUS EXPERIENCE
                </span>
            </motion.div>
        </div>
    );

    // -------------------------------------------------------------
    // RENDER 4: PAYMENT SUCCESS (Thank You & XHAUS Points Earned)
    // -------------------------------------------------------------
    const renderSuccessMode = () => (
        <div className="w-full h-full bg-[oklch(45%_0.08_140)] text-[oklch(97%_0.008_28)] flex flex-col items-center justify-center p-6 text-center font-sans relative overflow-hidden select-none">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 15 }}
                className="flex flex-col items-center space-y-3.5 max-w-md"
            >
                <VenueLogo className="h-10 max-w-[160px] object-contain brightness-200 filter drop-shadow-md mb-1" />

                <div className="space-y-1">
                    <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-white/80">
                        PAYMENT SUCCESSFUL
                    </span>
                    <h1 className="text-2xl font-bold uppercase tracking-tight text-white leading-tight">
                        ชำระเงินเรียบร้อยแล้ว
                    </h1>
                    <p className="text-xs font-sans text-white/90">
                        ขอบคุณที่เข้ามาใช้บริการ IN THE HAUS ครับ
                    </p>
                </div>

                {/* Cash Change Due Box */}
                {orderData.paymentMethod === 'cash' && orderData.changeDue > 0 && (
                    <div className="bg-white/10 border border-white/20 p-3 rounded-xl w-full backdrop-blur-xs space-y-0.5">
                        <span className="text-[8px] font-mono font-bold tracking-widest uppercase text-emerald-300">
                            CHANGE DUE (เงินทอน)
                        </span>
                        <p className="text-xl font-mono font-black text-white">
                            ฿{(orderData.changeDue || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </p>
                        {orderData.cashReceived > 0 && (
                            <p className="text-[10px] text-white/80 font-mono">
                                รับเงินสดมา ฿{orderData.cashReceived.toLocaleString()}
                            </p>
                        )}
                    </div>
                )}

                {/* XHAUS Points Earned Box */}
                {orderData.pointsEarned > 0 && (
                    <div className="bg-white/10 border border-white/20 p-3 rounded-xl w-full backdrop-blur-xs space-y-0.5">
                        <span className="text-[8px] font-mono font-bold tracking-widest uppercase text-amber-300 flex items-center justify-center gap-1">
                            XHAUS POINTS EARNED
                        </span>
                        <p className="text-xl font-mono font-black text-white">
                            +{orderData.pointsEarned} POINTS
                        </p>
                    </div>
                )}

                <span className="text-[9px] font-mono text-white/60 tracking-widest uppercase pt-1">
                    HAVE A WONDERFUL DAY!
                </span>
            </motion.div>
        </div>
    );

    return (
        <div className="w-screen h-screen max-h-screen overflow-hidden bg-black font-sans relative select-none cfd-container">
            <AnimatePresence mode="wait">
                {mode === 'IDLE' && (
                    <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
                        {renderIdleMode()}
                    </motion.div>
                )}

                {mode === 'ORDER_CONFIRMED' && (
                    <motion.div key="order_confirmed" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} className="w-full h-full">
                        {renderOrderConfirmedMode()}
                    </motion.div>
                )}

                {mode === 'CART' && (
                    <motion.div key="cart" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="w-full h-full">
                        {renderCartMode()}
                    </motion.div>
                )}

                {mode === 'CHECKOUT' && (
                    <motion.div key="checkout" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
                        {renderCheckoutMode()}
                    </motion.div>
                )}

                {mode === 'SPLIT_CHECKOUT' && (
                    <motion.div key="split_checkout" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
                        {renderSplitCheckoutMode()}
                    </motion.div>
                )}

                {mode === 'SPLIT_SUCCESS' && (
                    <motion.div key="split_success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
                        {renderSplitSuccessMode()}
                    </motion.div>
                )}

                {mode === 'SUCCESS' && (
                    <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
                        {renderSuccessMode()}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
