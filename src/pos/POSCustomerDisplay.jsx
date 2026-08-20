import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Utensils, CheckCircle2, Smartphone, QrCode, Sparkles, Receipt, ShieldCheck } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import generatePayload from 'promptpay-qr';
import { QRCodeSVG } from 'qrcode.react';
import { normalizePromptPayId, getStorePromptpayId, formatPromptpayDisplay } from '../utils/printerHelper';

const LINE_LIFF_MEMBER_URL = "https://liff.line.me/2008674756-hTEWodVj";

export default function POSCustomerDisplay() {
    const [mode, setMode] = useState('IDLE'); // 'IDLE' | 'CART' | 'CHECKOUT' | 'SPLIT_CHECKOUT' | 'SPLIT_SUCCESS' | 'SUCCESS'
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
        pointsEarned: 0
    });
    const [qrPayload, setQrPayload] = useState(null);
    const [slideshowImages, setSlideshowImages] = useState([]);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [shopLogoUrl, setShopLogoUrl] = useState(null);
    const [storePromptpayId, setStorePromptpayId] = useState('0985284217');
    const [storePromptpayName, setStorePromptpayName] = useState('IN THE HAUS');
    const [paymentQrUrl, setPaymentQrUrl] = useState(null);

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

                    const nameVal = settingsMap.promptpay_name || settingsMap.receipt_promptpay_name || parsedPrinterConfig.promptpay_name || '';
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
                    .select('image_url, name, price')
                    .not('image_url', 'is', null)
                    .neq('image_url', '')
                    .limit(20);
                
                if (data && data.length > 0) {
                    const validItems = data
                        .map(item => ({
                            url: getValidImageUrl(item.image_url),
                            name: item.name,
                            price: item.price
                        }))
                        .filter(item => Boolean(item.url));
                    setSlideshowImages(validItems);
                }
            } catch (err) {
                console.error("Error fetching CFD slideshow images:", err);
            }
        };
        fetchImages();
    }, []);

    // Slideshow transition interval
    useEffect(() => {
        if (!slideshowImages || slideshowImages.length === 0) return;
        const interval = setInterval(() => {
            setCurrentSlideIndex(prev => (prev + 1) % slideshowImages.length);
        }, 6000);
        return () => clearInterval(interval);
    }, [slideshowImages.length]);

    // Resilient Broadcast Channel + Supabase Realtime + Cold Start Handshake
    useEffect(() => {
        const handleMsg = (data) => {
            if (!data) return;
            const { type, payload } = data;
            
            switch (type) {
                case 'IDLE':
                    setMode('IDLE');
                    setOrderData({ items: [], subtotal: 0, total: 0, tax: 0, discount: 0, customer: null, memberProfile: null, tableName: null });
                    setQrPayload(null);
                    break;

                case 'UPDATE_CART':
                    setMode('CART');
                    setOrderData(prev => ({ ...prev, ...payload }));
                    break;

                case 'SHOW_QR':
                case 'SHOW_CHECKOUT':
                    setMode('CHECKOUT');
                    if (payload.orderData) {
                        setOrderData(prev => ({ ...prev, ...payload.orderData, ...payload }));
                    } else {
                        setOrderData(prev => ({ ...prev, ...payload }));
                    }
                    
                    // Generate PromptPay QR if total exists
                    const totalAmt = parseFloat(payload.total || payload.orderData?.total || 0);
                    const promptpayId = normalizePromptPayId(payload.promptpayId || storePromptpayId);
                    if (totalAmt > 0) {
                        try {
                            const qr = generatePayload(promptpayId, { amount: totalAmt });
                            setQrPayload(qr);
                        } catch (e) {
                            console.error("QR Generation error:", e);
                        }
                    }
                    break;

                case 'SPLIT_CHECKOUT':
                    setMode('SPLIT_CHECKOUT');
                    if (payload) {
                        setOrderData(prev => ({ ...prev, ...payload }));
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
                    break;

                case 'SPLIT_SUCCESS':
                    setMode('SPLIT_SUCCESS');
                    if (payload) {
                        setOrderData(prev => ({ ...prev, ...payload }));
                    }
                    setTimeout(() => {
                        if (payload?.remainingBalance > 0) {
                            setMode('CART');
                        } else {
                            setMode('IDLE');
                        }
                    }, 5000);
                    break;

                case 'PAYMENT_SUCCESS':
                    setMode('SUCCESS');
                    if (payload) {
                        setOrderData(prev => ({ ...prev, ...payload }));
                    }
                    setTimeout(() => {
                        setMode('IDLE');
                    }, 6000);
                    break;

                default:
                    break;
            }
        };

        // 1. Initial hydration from localStorage
        try {
            const cached = localStorage.getItem('pos_cfd_last_event');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed) handleMsg(parsed);
            }
        } catch (e) {}

        // 2. Local BroadcastChannel
        const channel = new BroadcastChannel('pos_cfd_channel');
        channel.onmessage = (event) => handleMsg(event.data);

        // Handshake: Request current POS state immediately
        try {
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
                    handleMsg(JSON.parse(e.newValue));
                } catch {}
            }
        };
        window.addEventListener('storage', handleStorage);

        return () => {
            channel.close();
            supabase.removeChannel(sbChannel);
            window.removeEventListener('storage', handleStorage);
        };
    }, [storePromptpayId]);

    // -------------------------------------------------------------
    // RENDER 1: IDLE SHOWCASE (Dieter Rams Minimalist Brand Display - 10.1" 1024x600 Optimized)
    // -------------------------------------------------------------
    const renderIdleMode = () => (
        <div className="relative w-full h-full bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] flex overflow-hidden font-sans select-none">
            {/* Left Column: Brand Statement & Real Member Registration QR */}
            <div className="w-1/2 h-full p-5 lg:p-7 flex flex-col justify-between z-10 bg-[oklch(18%_0.012_28)] border-r border-[oklch(42%_0.010_28)]/30">
                <div className="space-y-3">
                    {/* Venue Logo & Title */}
                    <div className="flex items-center gap-3 pb-3 border-b border-[oklch(42%_0.010_28)]/40">
                        <VenueLogo className="h-10 lg:h-12 max-w-[180px] object-contain filter drop-shadow-md brightness-110" />
                        <div className="h-6 w-px bg-[oklch(42%_0.010_28)]/50" />
                        <span className="font-mono text-[9px] lg:text-[10px] font-bold tracking-[0.2em] uppercase text-[oklch(52%_0.16_28)]">
                            HAUS TABLE EXPERIENCE
                        </span>
                    </div>

                    <div className="space-y-1">
                        <h1 className="text-xl lg:text-2xl font-bold uppercase tracking-tight text-[oklch(97%_0.008_28)] leading-tight">
                            IN THE HAUS
                        </h1>
                        <p className="text-xs font-sans text-[oklch(55%_0.010_28)] max-w-sm leading-relaxed">
                            ยินดีต้อนรับสัมผัสรสชาติอันพิถีพิถัน สั่งอาหารและเครื่องดื่มผ่านแคชเชียร์ หรือสแกนเพื่อสมัครสมาชิก XHAUS รับสิทธิพิเศษทันที
                        </p>
                    </div>
                </div>

                {/* Member Rewards QR Card with real LINE LIFF QR Code */}
                <div className="bg-[oklch(97%_0.008_28)]/5 border border-[oklch(97%_0.008_28)]/15 p-3.5 rounded-xl flex items-center justify-between gap-4 backdrop-blur-xs">
                    <div className="space-y-0.5">
                        <span className="text-[9px] font-mono font-bold tracking-widest text-[oklch(52%_0.16_28)] uppercase">
                            MEMBERSHIP & REWARDS
                        </span>
                        <h3 className="text-sm font-bold text-[oklch(97%_0.008_28)]">
                            สะสมแต้ม XHAUS POINTS
                        </h3>
                        <p className="text-[10px] text-[oklch(55%_0.010_28)] font-sans">
                            สแกน QR ผ่าน LINE เพื่อสมัครสมาชิกและเช็คคะแนนสะสม
                        </p>
                    </div>

                    <div className="p-2 bg-white rounded-lg border border-[oklch(85%_0.012_28)] shrink-0 flex flex-col items-center shadow-xs">
                        <QRCodeSVG value={LINE_LIFF_MEMBER_URL} size={64} level="M" />
                        <span className="text-[7px] font-mono font-bold text-[oklch(18%_0.012_28)] mt-1 uppercase tracking-wider">
                            SCAN VIA LINE
                        </span>
                    </div>
                </div>

                {/* Footer Brand Line */}
                <div className="flex items-center justify-between text-[9px] font-mono text-[oklch(55%_0.010_28)] uppercase tracking-widest border-t border-[oklch(42%_0.010_28)]/20 pt-2">
                    <span>ONHAUS SYSTEM</span>
                    <span className="font-bold text-[oklch(97%_0.008_28)] tracking-wider">IN THE HAUS จริตจัดรสชัดเจน</span>
                </div>
            </div>

            {/* Right Column: Hero Menu Slideshow */}
            <div className="w-1/2 h-full relative overflow-hidden bg-black">
                <AnimatePresence mode="wait">
                    {slideshowImages.length > 0 && slideshowImages[currentSlideIndex] ? (
                        <motion.div
                            key={currentSlideIndex}
                            initial={{ opacity: 0, scale: 1.04 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="absolute inset-0"
                        >
                            <img
                                src={slideshowImages[currentSlideIndex].url}
                                alt={slideshowImages[currentSlideIndex].name}
                                className="w-full h-full object-cover opacity-85"
                                onError={() => {
                                    setSlideshowImages(prev => prev.filter((_, idx) => idx !== currentSlideIndex));
                                    setCurrentSlideIndex(0);
                                }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[oklch(18%_0.012_28)] via-transparent to-black/20" />
                            
                            {/* Slide Item Title Badge */}
                            <div className="absolute bottom-4 left-4 right-4 bg-[oklch(97%_0.008_28)]/95 backdrop-blur-md border border-[oklch(85%_0.012_28)] p-3 rounded-xl shadow-lg flex items-center justify-between text-[oklch(18%_0.012_28)]">
                                <div>
                                    <span className="text-[8px] font-mono uppercase font-bold tracking-widest text-[oklch(52%_0.16_28)]">
                                        RECOMMENDED MENU
                                    </span>
                                    <h4 className="text-sm font-bold uppercase tracking-tight line-clamp-1">
                                        {slideshowImages[currentSlideIndex].name}
                                    </h4>
                                </div>
                                <span className="text-lg font-mono font-bold text-[oklch(52%_0.16_28)] shrink-0 ml-2">
                                    ฿{slideshowImages[currentSlideIndex].price}
                                </span>
                            </div>

                            {/* Slideshow dots */}
                            <div className="absolute top-4 right-4 flex gap-1 bg-black/40 px-2 py-1 rounded-full backdrop-blur-xs">
                                {slideshowImages.slice(0, 8).map((_, i) => (
                                    <div
                                        key={i}
                                        className={`w-1.5 h-1.5 rounded-full transition-all ${i === (currentSlideIndex % 8) ? 'bg-[oklch(52%_0.16_28)] w-3' : 'bg-white/40'}`}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    ) : (
                        <div className="h-full flex items-center justify-center font-mono text-xs tracking-widest text-[oklch(55%_0.010_28)] uppercase">
                            IN THE HAUS TABLE SHOWCASE
                        </div>
                    )}
                </AnimatePresence>
            </div>
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
                    {orderData.memberProfile ? (
                        <div className="bg-[oklch(52%_0.16_28)]/10 border border-[oklch(52%_0.16_28)]/30 rounded-xl p-3 space-y-1.5 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-[8px] font-mono font-bold uppercase tracking-widest text-[oklch(52%_0.16_28)] flex items-center gap-1">
                                    <ShieldCheck size={11} />
                                    VIP MEMBER ATTACHED
                                </span>
                                <span className="text-[9px] font-mono font-bold bg-[oklch(52%_0.16_28)] text-[oklch(97%_0.008_28)] px-1.5 py-0.5 rounded uppercase">
                                    {orderData.memberProfile.current_tier || orderData.memberProfile.tier || 'MEMBER'}
                                </span>
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-[oklch(18%_0.012_28)] line-clamp-1">
                                    {orderData.memberProfile.display_name || orderData.memberProfile.name || orderData.memberProfile.customer_name || orderData.customer}
                                </h2>
                            </div>
                            <div className="flex items-center justify-between border-t border-[oklch(52%_0.16_28)]/20 pt-1.5 text-[11px] font-mono">
                                <span className="text-[oklch(55%_0.010_28)]">สะสมแต้มคงเหลือ:</span>
                                <span className="font-bold text-[oklch(52%_0.16_28)]">
                                    {(orderData.memberProfile.points_balance ?? orderData.memberProfile.xhaus_points ?? orderData.memberProfile.points ?? 0).toLocaleString()} PTS
                                </span>
                            </div>
                        </div>
                    ) : orderData.customer && !['Walk-in Guest', 'Walk-in Pick-up', 'Walk-in Customer', 'Walk-in'].includes(orderData.customer) ? (
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
                        <div className="flex justify-between items-center text-[10px] font-mono text-[oklch(45%_0.08_140)]">
                            <span>SAVINGS</span>
                            <span className="font-bold">
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

            {/* Right Pane: Live Itemized Order List with flexbox viewport safety */}
            <div className="w-7/12 h-full flex flex-col justify-between p-4 bg-[oklch(97%_0.008_28)] overflow-hidden">
                <div className="pb-2 border-b border-[oklch(85%_0.012_28)] flex items-center justify-between shrink-0">
                    <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)] flex items-center gap-2">
                        <Receipt size={14} className="text-[oklch(52%_0.16_28)]" />
                        YOUR ORDER SUMMARY
                    </h2>
                    <VenueLogo className="h-5 max-w-[90px] object-contain opacity-90" />
                </div>

                {/* Items List (Strict Flexbox for 1024x600 without overflow) */}
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
                                            <h3 className="font-bold text-xs text-[oklch(18%_0.012_28)] uppercase leading-tight truncate">
                                                {item.name}
                                            </h3>
                                            {item.selected_options && item.selected_options.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {item.selected_options.map((opt, i) => (
                                                        <span key={i} className="text-[9px] font-mono font-bold bg-[oklch(94%_0.010_28)] text-[oklch(55%_0.010_28)] px-1.5 py-0.5 rounded border border-[oklch(85%_0.012_28)]">
                                                            {typeof opt === 'object' ? (opt.name + (opt.price ? ` +฿${opt.price}` : '')) : opt}
                                                        </span>
                                                    ))}
                                                </div>
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
                                <Utensils size={24} strokeWidth={1} />
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
            
            {/* Left Column: Order Bill Recap with flexbox viewport safety */}
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

                    {orderData.memberProfile && (
                        <div className="bg-[oklch(52%_0.16_28)]/10 border border-[oklch(52%_0.16_28)]/20 p-2 rounded-lg flex items-center justify-between text-[11px] font-mono mb-2 shrink-0">
                            <span className="font-bold text-[oklch(18%_0.012_28)] truncate mr-2">
                                สมาชิก: {orderData.memberProfile.display_name || orderData.memberProfile.name || orderData.customer}
                            </span>
                            <span className="text-[8px] font-bold bg-[oklch(52%_0.16_28)] text-white px-1.5 py-0.5 rounded uppercase shrink-0">
                                {orderData.memberProfile.current_tier || orderData.memberProfile.tier || 'MEMBER'}
                            </span>
                        </div>
                    )}

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
                            <QrCode size={14} />
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
                    <Smartphone size={14} className="text-[oklch(52%_0.16_28)] shrink-0" />
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
                            <QrCode size={14} />
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
                    <Smartphone size={14} className="text-[oklch(52%_0.16_28)] shrink-0" />
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
                <div className="w-14 h-14 rounded-full bg-white/10 border border-white/30 flex items-center justify-center shadow-xl backdrop-blur-md">
                    <CheckCircle2 size={36} className="text-white" strokeWidth={1.5} />
                </div>

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
    // RENDER 4: PAYMENT SUCCESS (Thank You & XHAUS Points Earned - Non-Touch Display)
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
                <div className="w-14 h-14 rounded-full bg-white/10 border border-white/30 flex items-center justify-center shadow-xl backdrop-blur-md">
                    <CheckCircle2 size={36} className="text-white" strokeWidth={1.5} />
                </div>

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
                            <Sparkles size={11} />
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
