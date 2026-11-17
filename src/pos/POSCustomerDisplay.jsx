/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AnimatePresence, motion } from 'framer-motion';
import generatePayload from 'promptpay-qr';
import { getStoreHours } from '../utils/storeHours';
import { QRCodeSVG } from 'qrcode.react';
import { normalizePromptPayId, getStorePromptpayId, getStorePromptpayName, formatPromptpayDisplay } from '../utils/printerHelper';

// State changes fade in 180 ms (AGENTS.md §5): opacity only, no scale or slide
const FADE = { duration: 0.18, ease: [0.2, 0, 0, 1] };

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

    const autoResetTimerRef = useRef(null);
    const expireAtRef = useRef(null);

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

    // Shop mark on the customer screen: the plum ในบ้าน wordmark. The logo stored in settings is the receipt / print
    // logo, so the screen does not use it.
    const VenueLogo = ({ className = "h-9 w-auto object-contain", alt = "ในบ้าน In the haus" }) => (
        <img src="/logo-inbaan-wordmark-plum.png" alt={alt} className={className} width="66" height="36" />
    );

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

                case 'ORDER_CONFIRMED': {
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
                    } catch {}

                    autoResetTimerRef.current = setTimeout(() => {
                        resetToIdle();
                    }, orderConfirmDuration);
                    break;
                }

                case 'UPDATE_CART': {
                    if (autoResetTimerRef.current) {
                        clearTimeout(autoResetTimerRef.current);
                        autoResetTimerRef.current = null;
                    }
                    setMode('CART');
                    setOrderData(prev => ({ ...prev, ...payload }));
                    try {
                        localStorage.setItem('pos_cfd_last_event', JSON.stringify({ type, payload, timestamp: Date.now() }));
                    } catch {}

                    // 60-second inactivity watchdog: If cashier stops adding items, gracefully return to IDLE
                    const cartInactivityDuration = 60000;
                    expireAtRef.current = Date.now() + cartInactivityDuration;
                    autoResetTimerRef.current = setTimeout(() => {
                        resetToIdle();
                    }, cartInactivityDuration);
                    break;
                }

                case 'SHOW_QR':
                case 'SHOW_CHECKOUT': {
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
                    } catch {}

                    // 120-second checkout watchdog
                    const checkoutDuration = 120000;
                    expireAtRef.current = Date.now() + checkoutDuration;
                    autoResetTimerRef.current = setTimeout(() => {
                        resetToIdle();
                    }, checkoutDuration);
                    break;
                }

                case 'SPLIT_CHECKOUT': {
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
                    } catch {}

                    const splitDurationMax = 120000;
                    expireAtRef.current = Date.now() + splitDurationMax;
                    autoResetTimerRef.current = setTimeout(() => {
                        resetToIdle();
                    }, splitDurationMax);
                    break;
                }

                case 'SPLIT_SUCCESS': {
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
                    } catch {}

                    autoResetTimerRef.current = setTimeout(() => {
                        if (payload?.remainingBalance > 0) {
                            expireAtRef.current = null;
                            setMode('CART');
                        } else {
                            resetToIdle();
                        }
                    }, splitDuration);
                    break;
                }

                case 'PAYMENT_SUCCESS': {
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
                    } catch {}

                    autoResetTimerRef.current = setTimeout(() => {
                        resetToIdle();
                    }, successDuration);
                    break;
                }

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
    // Customer-facing display, light POS theme (.agents/AGENTS.md, brand v2).
    // Target: Sunmi D2s Plus 10.1" customer screen, 1024x600, read from about 0.5-1 m.
    // So: cream cards on paper-2 like the POS, charcoal text, plum accents, DM Mono numbers,
    // readable text >= 16px, amounts 40-48px, no loops or tickers, 180ms fades between states.
    // -------------------------------------------------------------
    const money = (n, digits = 2) => `฿${Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
    const LABEL = 'block font-mono text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-neutral)]';
    const CARD = 'bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-2xl';

    // Same top strip on every state: shop mark · what this screen is about · time
    const CfdTopBar = ({ label }) => (
        <header className="h-14 shrink-0 flex items-stretch bg-[var(--color-paper)] border-b border-[var(--color-rule)]">
            <div className="flex items-center px-5 border-r border-[var(--color-rule)]">
                <VenueLogo className="h-9 w-auto object-contain" />
            </div>
            <div className="flex-1 min-w-0 flex items-center px-5">
                <span className="text-lg font-bold leading-[1.5] text-[var(--color-ink)] truncate">{label}</span>
            </div>
            <div className="flex items-center px-5 border-l border-[var(--color-rule)]">
                <StandbyClock />
            </div>
        </header>
    );

    const MemberCard = ({ compact = false }) => {
        const mp = orderData.memberProfile;
        if (!mp) return null;
        const coins = Math.max(0, parseFloat(mp.xhaus_balance ?? mp.xhaus_coins ?? mp.points_balance ?? mp.points ?? 0) || 0);
        const stamps = parseInt(mp.drink_stamp_count || 0, 10);
        const freeDrinks = parseInt(mp.free_drink_quota || 0, 10);
        const tier = mp.current_tier || mp.tier || 'MEMBER';
        return (
            <div className={`${CARD} p-4 space-y-3`}>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <span className="block font-mono text-xs font-medium uppercase tracking-[0.12em] text-[var(--brand-plum)]">สมาชิก In the haus</span>
                        <span className="block text-lg font-bold leading-[1.5] text-[var(--color-ink)] truncate">{mp.display_name || mp.name || orderData.customer}</span>
                    </div>
                    <span className="shrink-0 font-mono text-xs font-medium uppercase px-2 py-1 rounded-md bg-[var(--brand-plum)] text-[var(--color-paper)]">{tier}</span>
                </div>
                {!compact && (
                    <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-[var(--color-paper-2)] px-3 py-2">
                            <span className={LABEL}>แต้ม XHAUS</span>
                            <span className="block font-mono text-xl font-medium text-[var(--color-ink)]">{Math.floor(coins).toLocaleString()}</span>
                        </div>
                        <div className="rounded-xl bg-[var(--color-paper-2)] px-3 py-2">
                            <span className={LABEL}>แก้วสะสม {stamps}/10</span>
                            <div className="flex gap-1 mt-2" aria-hidden="true">
                                {STAMP_PUNCHCARD_SLOTS.map((i) => (
                                    <span key={i} className={`flex-1 h-2 rounded-full ${i < stamps ? 'bg-[var(--brand-plum)]' : 'bg-[var(--color-rule)]'}`} />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                {compact && (
                    <p className="text-base text-[var(--color-muted)]">{Math.floor(coins).toLocaleString()} แต้ม · แก้วสะสม {stamps}/10</p>
                )}
                {!compact && freeDrinks > 0 && (
                    <p className="text-base font-bold text-[var(--color-accent-2)]">สิทธิ์เครื่องดื่มฟรี {freeDrinks} แก้ว พร้อมใช้</p>
                )}
            </div>
        );
    };

    // Payment card (right column of checkout / split checkout)
    const PaymentPanel = ({ amount, allowStaticQr }) => {
        const isCash = orderData.paymentMethod === 'cash';
        const staticQr = allowStaticQr ? (paymentQrUrl || orderData.paymentQrUrl) : null;
        return (
            <div className="h-full flex flex-col items-center justify-center gap-3">
                {isCash ? (
                    <div className={`${CARD} w-full max-w-[360px] p-6 text-center space-y-4`}>
                        <span className="inline-block font-mono text-sm font-medium uppercase tracking-[0.12em] px-3 py-1 rounded-md bg-[var(--color-ink)] text-[var(--color-paper)]">เงินสด · Cash</span>
                        <div>
                            <span className={LABEL}>ยอดที่ต้องชำระ</span>
                            <span className="block font-mono text-[48px] leading-tight font-medium text-[var(--color-ink)]">{money(amount)}</span>
                        </div>
                        {orderData.cashReceived > 0 && (
                            <div className="border-t border-[var(--color-rule)] pt-4 space-y-2">
                                <div className="flex justify-between text-base text-[var(--color-muted)]">
                                    <span>รับเงินสดมา</span>
                                    <span className="font-mono">{money(orderData.cashReceived)}</span>
                                </div>
                                <div className="flex justify-between items-baseline">
                                    <span className="text-lg font-bold text-[var(--color-accent-2)]">เงินทอน</span>
                                    <span className="font-mono text-[32px] font-medium text-[var(--color-ink)]">{money(orderData.changeDue)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className={`${CARD} w-full max-w-[320px] overflow-hidden text-center`}>
                        {/* PromptPay keeps its own blue so people recognise the payment method */}
                        <div className="bg-[#003D7A] text-white font-mono text-sm font-medium uppercase tracking-[0.12em] py-2">PromptPay QR</div>
                        <div className="px-5 pt-4 pb-5 flex flex-col items-center gap-3">
                            {/* QR codes need a pure white quiet zone to scan reliably */}
                            <div className="bg-white p-2 rounded-xl border border-[var(--color-rule)]">
                                {qrPayload ? (
                                    <QRCodeSVG value={qrPayload} size={196} level="M" />
                                ) : staticQr ? (
                                    <img src={staticQr} alt="PromptPay QR" className="w-[196px] h-[196px] object-contain" />
                                ) : (
                                    <div className="w-[196px] h-[196px] flex items-center justify-center text-base text-[var(--color-neutral)]">กำลังสร้าง QR…</div>
                                )}
                            </div>
                            <div className="space-y-0.5">
                                {storePromptpayName && <span className="block text-base font-bold text-[var(--color-ink)] truncate max-w-[270px]">{storePromptpayName}</span>}
                                <span className="block font-mono text-sm text-[var(--color-muted)]">พร้อมเพย์ {formatPromptpayDisplay(storePromptpayId)}</span>
                            </div>
                            <span className="block font-mono text-[36px] leading-tight font-medium text-[var(--color-ink)]">{money(amount)}</span>
                        </div>
                    </div>
                )}
                <p className="text-base text-[var(--color-muted)] text-center">
                    {isCash ? 'กรุณาชำระเงินสดที่แคชเชียร์' : 'สแกนด้วยแอปธนาคาร แล้วแสดงสลิปให้พนักงาน'}
                </p>
            </div>
        );
    };

    // Helpers here are called as plain functions, not <Components/>: a component declared inside this one would
    // remount on every parent render (the 6.5 s slideshow tick) and restart the countdown bar and the clock.

    // Itemised list used by cart and checkout
    const ItemRows = ({ items, qtyKey = 'quantity', detailed = false }) => (
        <ul className="divide-y divide-[var(--color-rule)]">
            {items.map((item, idx) => {
                const qty = item[qtyKey] || item.quantity;
                return (
                    <li key={item.id || idx} className="flex items-start gap-3 py-3">
                        <span className="shrink-0 min-w-[40px] h-8 px-2 rounded-lg bg-[var(--color-paper-2)] font-mono text-base font-medium text-[var(--color-ink)] flex items-center justify-center">{qty}×</span>
                        <div className="flex-1 min-w-0">
                            <span className="block text-lg font-bold leading-[1.5] text-[var(--color-ink)] truncate">{item.name}</span>
                            {detailed && item.selected_options && item.selected_options.length > 0 && (
                                <span className="block text-sm text-[var(--color-muted)] leading-[1.5]">
                                    {item.selected_options.map(opt => (typeof opt === 'object' ? opt.name + (opt.price ? ` +฿${opt.price}` : '') : opt)).join(' · ')}
                                </span>
                            )}
                            {detailed && item.item_note && (
                                <span className="block text-sm text-[var(--brand-plum)] leading-[1.5]">โน้ต: {item.item_note}</span>
                            )}
                        </div>
                        <span className="shrink-0 font-mono text-lg font-medium text-[var(--color-ink)] pt-0.5">{money((item.price || 0) * (qty || 0))}</span>
                    </li>
                );
            })}
        </ul>
    );

    const tableLabel = orderData.tableName ? `โต๊ะ ${orderData.tableName}` : 'สั่งที่เคาน์เตอร์';

    // -------------------------------------------------------------
    // IDLE: signature dish photo + member sign-up QR
    // -------------------------------------------------------------
    const renderIdleMode = () => {
        const activeSlide = slideshowImages[currentSlideIndex];
        const hours = getStoreHours();
        return (
            <div className="w-full h-full bg-[var(--color-paper-2)] flex flex-col">
                {CfdTopBar({ label: 'ยินดีต้อนรับสู่ ในบ้าน นครพนม' })}
                <div className="flex-1 min-h-0 flex">
                    <div className="w-[55%] relative overflow-hidden bg-[var(--color-paper-3)] border-r border-[var(--color-rule)]">
                        <AnimatePresence initial={false}>
                            {activeSlide && (
                                <motion.img
                                    key={currentSlideIndex}
                                    src={activeSlide.url}
                                    alt={activeSlide.name}
                                    className="absolute inset-0 w-full h-full object-cover"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                                    onError={() => {
                                        setSlideshowImages(prev => {
                                            const next = prev.filter((_, idx) => idx !== currentSlideIndex);
                                            return next.length > 0 ? next : LOCAL_FEATURED_ITEMS;
                                        });
                                        setCurrentSlideIndex(0);
                                    }}
                                />
                            )}
                        </AnimatePresence>
                        {activeSlide && (
                            <div className={`absolute left-4 right-4 bottom-4 ${CARD} px-5 py-3 flex items-center justify-between gap-4`}>
                                <div className="min-w-0">
                                    <span className={LABEL}>เมนูแนะนำ · {String(currentSlideIndex + 1).padStart(2, '0')}/{String(slideshowImages.length || 1).padStart(2, '0')}</span>
                                    <span className="block text-xl font-bold leading-[1.5] text-[var(--color-ink)] truncate">{activeSlide.name}</span>
                                </div>
                                <span className="shrink-0 font-mono text-2xl font-medium text-[var(--brand-plum)]">{money(activeSlide.price, 0)}</span>
                            </div>
                        )}
                    </div>

                    <div className="w-[45%] flex flex-col gap-4 p-5">
                        <div className={`${CARD} flex-1 min-h-0 flex flex-col items-center justify-center text-center px-6 py-5`}>
                            <span className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-[var(--brand-plum)]">Member · สมาชิก</span>
                            <h2 className="mt-1 text-2xl font-bold leading-[1.5] text-[var(--color-ink)]">สแกนสมัครสมาชิก</h2>
                            <p className="text-base leading-[1.5] text-[var(--color-muted)]">สะสมแต้มและแก้วฟรีผ่าน LINE</p>
                            {/* QR codes need a pure white quiet zone to scan reliably */}
                            <div className="mt-4 bg-white p-3 rounded-xl border border-[var(--color-rule)]">
                                <QRCodeSVG value={LINE_LIFF_MEMBER_URL} size={176} level="M" />
                            </div>
                        </div>
                        <div className={`${CARD} grid grid-cols-2 divide-x divide-[var(--color-rule)]`}>
                            <div className="px-4 py-3 min-w-0">
                                <span className={LABEL}>Wi-Fi</span>
                                <span className="block text-base font-bold text-[var(--color-ink)] truncate">IN THE HAUS 5G</span>
                            </div>
                            <div className="px-4 py-3 min-w-0">
                                <span className={LABEL}>เวลาเปิด</span>
                                <span className="block font-mono text-base font-medium text-[var(--color-ink)]">{hours.open}–{hours.close}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // -------------------------------------------------------------
    // ORDER CONFIRMED: sent to kitchen / bar (5 s, then back to idle)
    // -------------------------------------------------------------
    const renderOrderConfirmedMode = () => (
        <div className="w-full h-full bg-[var(--color-paper-2)] flex flex-col">
            {CfdTopBar({ label: tableLabel })}
            <div className="flex-1 min-h-0 flex items-center justify-center p-6">
                <div className={`${CARD} w-full max-w-[560px] p-8 text-center`}>
                    <span className="font-mono text-sm font-medium uppercase tracking-[0.12em] text-[var(--brand-plum)]">Order received · รับออเดอร์แล้ว</span>
                    <h1 className="mt-2 text-[32px] font-bold leading-[1.5] text-[var(--color-ink)]">ส่งออเดอร์เข้าครัวแล้ว</h1>
                    <p className="text-lg leading-[1.5] text-[var(--color-muted)]">เชฟและบาริสต้ากำลังเตรียมให้ครับ</p>
                    <div className={`mt-6 grid ${orderData.totalAmount > 0 ? 'grid-cols-3' : 'grid-cols-2'} border-y border-[var(--color-rule)] divide-x divide-[var(--color-rule)]`}>
                        <div className="py-3">
                            <span className={LABEL}>โต๊ะ</span>
                            <span className="block text-2xl font-bold text-[var(--color-ink)]">{orderData.tableName || 'เคาน์เตอร์'}</span>
                        </div>
                        <div className="py-3">
                            <span className={LABEL}>รายการ</span>
                            <span className="block font-mono text-2xl font-medium text-[var(--color-ink)]">{orderData.itemCount || orderData.items?.length || 1}</span>
                        </div>
                        {orderData.totalAmount > 0 && (
                            <div className="py-3">
                                <span className={LABEL}>ยอดรวม</span>
                                <span className="block font-mono text-2xl font-medium text-[var(--color-ink)]">{money(orderData.totalAmount)}</span>
                            </div>
                        )}
                    </div>
                    {/* 5 s countdown, drawn with transform so it never triggers layout */}
                    <div className="mt-6 h-1 rounded-full bg-[var(--color-rule)] overflow-hidden" aria-hidden="true">
                        <motion.div
                            className="h-full w-full bg-[var(--brand-plum)] origin-left"
                            initial={{ scaleX: 1 }}
                            animate={{ scaleX: 0 }}
                            transition={{ duration: 5, ease: 'linear' }}
                        />
                    </div>
                    <span className="mt-2 block text-sm text-[var(--color-neutral)]">กลับหน้าหลักใน 5 วินาที</span>
                </div>
            </div>
        </div>
    );

    // -------------------------------------------------------------
    // CART: live order the cashier is keying in
    // -------------------------------------------------------------
    const renderCartMode = () => {
        const items = orderData.items || [];
        const count = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
        const isNamedGuest = orderData.customer && !['Walk-in Guest', 'Walk-in Pick-up', 'Walk-in Customer', 'Walk-in'].includes(orderData.customer);
        return (
            <div className="w-full h-full bg-[var(--color-paper-2)] flex flex-col">
                {CfdTopBar({ label: `${tableLabel} · รายการของคุณ` })}
                <div className="flex-1 min-h-0 flex gap-4 p-4">
                    <div className="w-5/12 flex flex-col gap-4 min-h-0">
                        {orderData.memberProfile ? (
                            MemberCard({})
                        ) : (
                            <div className={`${CARD} p-4`}>
                                <span className="block text-lg font-bold leading-[1.5] text-[var(--color-ink)]">{isNamedGuest ? orderData.customer : 'ตรวจสอบรายการได้ทางขวา'}</span>
                                <p className="text-base leading-[1.5] text-[var(--color-muted)]">แจ้งเบอร์กับแคชเชียร์เพื่อสะสมแต้มสมาชิก</p>
                            </div>
                        )}
                        <div className={`${CARD} mt-auto p-5 space-y-2`}>
                            <div className="flex justify-between text-base text-[var(--color-muted)]">
                                <span>จำนวน</span>
                                <span className="font-mono">{count} รายการ</span>
                            </div>
                            {orderData.discount > 0 && (
                                <div className="flex justify-between text-base font-bold text-[var(--color-accent-2)]">
                                    <span>ส่วนลด</span>
                                    <span className="font-mono">−{money(orderData.discount)}</span>
                                </div>
                            )}
                            <div className="border-t border-[var(--color-rule)] pt-3">
                                <span className="block text-lg font-bold text-[var(--color-ink)]">ยอดรวม</span>
                                <span className="block font-mono text-[44px] leading-tight font-medium text-[var(--color-ink)]">{money(orderData.total)}</span>
                            </div>
                        </div>
                    </div>

                    <div className={`${CARD} w-7/12 flex flex-col min-h-0 px-5`}>
                        <div className="flex items-baseline justify-between py-3 border-b border-[var(--color-rule)]">
                            <span className="text-lg font-bold text-[var(--color-ink)]">รายการอาหาร</span>
                            <span className="font-mono text-sm text-[var(--color-neutral)]">{items.length} รายการ</span>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto cfd-scrollbar">
                            {items.length > 0 ? (
                                ItemRows({ items, detailed: true })
                            ) : (
                                <div className="h-full flex items-center justify-center text-lg text-[var(--color-neutral)]">กำลังเลือกรายการ…</div>
                            )}
                        </div>
                        {(orderData.subtotal > 0 || orderData.tax > 0) && (
                            <div className="py-3 border-t border-[var(--color-rule)] space-y-1">
                                <div className="flex justify-between text-base text-[var(--color-muted)]">
                                    <span>ยอดก่อนหักส่วนลด</span>
                                    <span className="font-mono">{money(orderData.subtotal)}</span>
                                </div>
                                {orderData.tax > 0 && (
                                    <div className="flex justify-between text-base text-[var(--color-muted)]">
                                        <span>VAT 7%</span>
                                        <span className="font-mono">{money(orderData.tax)}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // -------------------------------------------------------------
    // CHECKOUT: bill recap + how to pay
    // -------------------------------------------------------------
    const renderCheckoutMode = () => (
        <div className="w-full h-full bg-[var(--color-paper-2)] flex flex-col">
            {CfdTopBar({ label: `${tableLabel} · ชำระเงิน` })}
            <div className="flex-1 min-h-0 flex gap-4 p-4">
                <div className={`${CARD} w-1/2 flex flex-col min-h-0 px-5`}>
                    <div className="py-3 border-b border-[var(--color-rule)]">
                        <span className="text-lg font-bold text-[var(--color-ink)]">สรุปรายการ</span>
                    </div>
                    {orderData.memberProfile && <div className="pt-3">{MemberCard({ compact: true })}</div>}
                    <div className="flex-1 min-h-0 overflow-y-auto cfd-scrollbar">
                        {ItemRows({ items: orderData.items || [] })}
                    </div>
                    <div className="py-4 border-t border-[var(--color-rule)] flex items-end justify-between gap-4">
                        <span className="text-lg font-bold text-[var(--color-ink)]">ยอดที่ต้องชำระ</span>
                        <span className="font-mono text-[40px] leading-tight font-medium text-[var(--color-ink)]">{money(orderData.total)}</span>
                    </div>
                </div>
                <div className="w-1/2 min-h-0">
                    {PaymentPanel({ amount: orderData.total, allowStaticQr: true })}
                </div>
            </div>
        </div>
    );

    // -------------------------------------------------------------
    // SPLIT CHECKOUT: one portion of a shared bill
    // -------------------------------------------------------------
    const renderSplitCheckoutMode = () => {
        const title = orderData.splitMode === 'ITEMS' ? 'แยกจ่ายตามรายการ' : orderData.splitMode === 'EQUAL' ? 'หารเท่ากัน' : 'แยกจ่ายตามยอด';
        return (
            <div className="w-full h-full bg-[var(--color-paper-2)] flex flex-col">
                {CfdTopBar({ label: `${tableLabel} · ${title}` })}
                <div className="flex-1 min-h-0 flex gap-4 p-4">
                    <div className={`${CARD} w-1/2 flex flex-col min-h-0 px-5`}>
                        <div className="py-3 border-b border-[var(--color-rule)] flex items-baseline justify-between">
                            <span className="text-lg font-bold text-[var(--color-ink)]">{title}</span>
                            <span className="font-mono text-xs font-medium uppercase tracking-[0.12em] px-2 py-1 rounded-md bg-[var(--brand-plum)] text-[var(--color-paper)]">Split</span>
                        </div>
                        {orderData.memberProfile && <div className="pt-3">{MemberCard({ compact: true })}</div>}
                        <div className="flex-1 min-h-0 overflow-y-auto cfd-scrollbar">
                            {orderData.splitMode === 'ITEMS' && orderData.selectedItems && orderData.selectedItems.length > 0 ? (
                                ItemRows({ items: orderData.selectedItems, qtyKey: 'selectedQty' })
                            ) : orderData.splitMode === 'EQUAL' && orderData.equalSplitInfo ? (
                                <div className="py-6 text-center">
                                    <span className={LABEL}>หารเท่ากัน {orderData.equalSplitInfo.totalPeople} ท่าน</span>
                                    <span className="block mt-1 text-2xl font-bold leading-[1.5] text-[var(--color-ink)]">ท่านที่ {orderData.equalSplitInfo.currentPerson} จาก {orderData.equalSplitInfo.totalPeople}</span>
                                </div>
                            ) : (
                                <div className="py-6 text-center">
                                    <span className={LABEL}>ชำระบางส่วนตามยอดที่ระบุ</span>
                                </div>
                            )}
                        </div>
                        <div className="py-3 border-t border-[var(--color-rule)] space-y-1">
                            <div className="flex justify-between text-base text-[var(--color-muted)]">
                                <span>ยอดรวมทั้งโต๊ะ</span>
                                <span className="font-mono">{money(orderData.orderTotal)}</span>
                            </div>
                            <div className="flex justify-between text-base text-[var(--color-muted)]">
                                <span>คงเหลือของโต๊ะ</span>
                                <span className="font-mono">{money(orderData.remainingBalance)}</span>
                            </div>
                        </div>
                        <div className="py-4 border-t border-[var(--color-rule)] flex items-end justify-between gap-4">
                            <span className="text-lg font-bold text-[var(--color-ink)]">ยอดรอบนี้</span>
                            <span className="font-mono text-[40px] leading-tight font-medium text-[var(--color-ink)]">{money(orderData.splitTotal)}</span>
                        </div>
                    </div>
                    <div className="w-1/2 min-h-0">
                        {PaymentPanel({ amount: orderData.splitTotal, allowStaticQr: false })}
                    </div>
                </div>
            </div>
        );
    };

    // Shared "done" screen for full and split payments
    const DoneScreen = ({ kicker, title, children }) => (
        <div className="w-full h-full bg-[var(--color-paper-2)] flex flex-col">
            {CfdTopBar({ label: tableLabel })}
            <div className="flex-1 min-h-0 flex items-center justify-center p-6">
                <div className={`${CARD} w-full max-w-[560px] p-8 text-center`}>
                    <span className="font-mono text-sm font-medium uppercase tracking-[0.12em] text-[var(--color-accent-2)]">{kicker}</span>
                    <h1 className="mt-2 text-[32px] font-bold leading-[1.5] text-[var(--color-ink)]">{title}</h1>
                    {children}
                </div>
            </div>
        </div>
    );

    // -------------------------------------------------------------
    // SPLIT SUCCESS
    // -------------------------------------------------------------
    const renderSplitSuccessMode = () => (
        DoneScreen({ kicker: "Paid · ชำระส่วนนี้แล้ว", title: "ชำระส่วนนี้เรียบร้อยแล้ว", children: (<>
            <p className="text-lg leading-[1.5] text-[var(--color-muted)]">ยอดส่วนนี้ <span className="font-mono">{money(orderData.splitTotal)}</span></p>
            {orderData.remainingBalance > 0 ? (
                <div className="mt-6 border-t border-[var(--color-rule)] pt-5">
                    <span className={LABEL}>คงเหลือของโต๊ะ</span>
                    <span className="block font-mono text-[44px] leading-tight font-medium text-[var(--color-ink)]">{money(orderData.remainingBalance)}</span>
                    <p className="mt-1 text-base text-[var(--color-muted)]">เชิญท่านถัดไปชำระต่อได้เลยครับ</p>
                </div>
            ) : (
                <p className="mt-6 border-t border-[var(--color-rule)] pt-5 text-xl font-bold text-[var(--color-ink)]">ชำระครบทั้งโต๊ะแล้ว ขอบคุณครับ</p>
            )}
        </>) })
    );

    // -------------------------------------------------------------
    // PAYMENT SUCCESS: thank you, change, points earned (6 s)
    // -------------------------------------------------------------
    const renderSuccessMode = () => (
        DoneScreen({ kicker: "Payment successful · ชำระเงินสำเร็จ", title: "ชำระเงินเรียบร้อยแล้ว", children: (<>
            <p className="text-lg leading-[1.5] text-[var(--color-muted)]">ขอบคุณที่มาใช้บริการ ในบ้าน ครับ</p>
            {orderData.paymentMethod === 'cash' && orderData.changeDue > 0 && (
                <div className="mt-6 border-t border-[var(--color-rule)] pt-5">
                    <span className={LABEL}>เงินทอน</span>
                    <span className="block font-mono text-[48px] leading-tight font-medium text-[var(--color-ink)]">{money(orderData.changeDue)}</span>
                    {orderData.cashReceived > 0 && (
                        <p className="mt-1 text-base text-[var(--color-muted)]">รับเงินสดมา <span className="font-mono">{money(orderData.cashReceived)}</span></p>
                    )}
                </div>
            )}
            {orderData.pointsEarned > 0 && (
                <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--brand-plum)] px-4 py-2 text-base font-bold text-[var(--color-paper)]">
                    <span className="font-mono">+{orderData.pointsEarned}</span> แต้ม XHAUS
                </p>
            )}
        </>) })
    );

    return (
        <div className="w-screen h-screen max-h-screen overflow-hidden bg-[var(--color-paper-2)] text-[var(--color-ink)] font-sans relative select-none cfd-container">
            <AnimatePresence mode="wait">
                {mode === 'IDLE' && (
                    <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE} className="w-full h-full">
                        {renderIdleMode()}
                    </motion.div>
                )}

                {mode === 'ORDER_CONFIRMED' && (
                    <motion.div key="order_confirmed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE} className="w-full h-full">
                        {renderOrderConfirmedMode()}
                    </motion.div>
                )}

                {mode === 'CART' && (
                    <motion.div key="cart" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE} className="w-full h-full">
                        {renderCartMode()}
                    </motion.div>
                )}

                {mode === 'CHECKOUT' && (
                    <motion.div key="checkout" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE} className="w-full h-full">
                        {renderCheckoutMode()}
                    </motion.div>
                )}

                {mode === 'SPLIT_CHECKOUT' && (
                    <motion.div key="split_checkout" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE} className="w-full h-full">
                        {renderSplitCheckoutMode()}
                    </motion.div>
                )}

                {mode === 'SPLIT_SUCCESS' && (
                    <motion.div key="split_success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE} className="w-full h-full">
                        {renderSplitSuccessMode()}
                    </motion.div>
                )}

                {mode === 'SUCCESS' && (
                    <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE} className="w-full h-full">
                        {renderSuccessMode()}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

const StandbyClock = React.memo(function StandbyClock() {
    const [currentTime, setCurrentTime] = useState(() => new Date());

    // Minutes only: re-render on the next minute boundary, not every second
    useEffect(() => {
        let timer;
        const schedule = () => {
            const now = new Date();
            timer = setTimeout(() => { setCurrentTime(new Date()); schedule(); }, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
        };
        schedule();
        return () => clearTimeout(timer);
    }, []);

    const timeStr = currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const dateStr = currentTime.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });

    return (
        <div className="flex flex-col items-end leading-tight">
            <span className="font-mono text-xl font-medium text-[var(--color-ink)]">{timeStr}</span>
            <span className="text-sm text-[var(--color-neutral)]">{dateStr}</span>
        </div>
    );
});
