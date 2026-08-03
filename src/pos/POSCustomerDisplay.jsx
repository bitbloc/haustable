import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Utensils, CheckCircle2, Smartphone, QrCode, Sparkles, Receipt, ArrowRight, ShieldCheck, Heart } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import generatePayload from 'promptpay-qr';
import { QRCodeSVG } from 'qrcode.react';

export default function POSCustomerDisplay() {
    const [mode, setMode] = useState('IDLE'); // 'IDLE' | 'CART' | 'CHECKOUT' | 'SUCCESS'
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
    const [storePromptpayId, setStorePromptpayId] = useState('0812345678');
    const [paymentQrUrl, setPaymentQrUrl] = useState(null);

    // Fetch shop logo & PromptPay settings from app_settings
    useEffect(() => {
        const fetchShopSettings = async () => {
            try {
                const { data } = await supabase
                    .from('app_settings')
                    .select('key, value')
                    .in('key', ['receipt_shop_logo_url', 'shop_logo_url', 'payment_qr_url', 'promptpay_id', 'phone_number']);
                
                if (data && data.length > 0) {
                    const logoObj = data.find(i => (i.key === 'receipt_shop_logo_url' || i.key === 'shop_logo_url') && i.value);
                    if (logoObj && logoObj.value) {
                        setShopLogoUrl(logoObj.value);
                    }
                    const qrObj = data.find(i => i.key === 'payment_qr_url' && i.value);
                    if (qrObj && qrObj.value) {
                        setPaymentQrUrl(qrObj.value);
                    }
                    const ppObj = data.find(i => (i.key === 'promptpay_id' || i.key === 'phone_number') && i.value);
                    if (ppObj && ppObj.value) {
                        setStorePromptpayId(ppObj.value);
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
                    if (payload.new.key === 'receipt_shop_logo_url' || payload.new.key === 'shop_logo_url') {
                        if (payload.new.value) setShopLogoUrl(payload.new.value);
                    }
                    if (payload.new.key === 'payment_qr_url' && payload.new.value) {
                        setPaymentQrUrl(payload.new.value);
                    }
                    if ((payload.new.key === 'promptpay_id' || payload.new.key === 'phone_number') && payload.new.value) {
                        setStorePromptpayId(payload.new.value);
                    }
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(logoSub);
        };
    }, []);

    // Reusable Venue Logo Component (In The Haus Shop Logo)
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

    // Helper to format image URL correctly whether full URL, path, or text_only
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

    // Dual Broadcast Channel (Local Tab + Supabase Realtime + LocalStorage Fallback)
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
                    const promptpayId = payload.promptpayId || storePromptpayId || '0812345678';
                    if (totalAmt > 0) {
                        try {
                            const qr = generatePayload(promptpayId, { amount: totalAmt });
                            setQrPayload(qr);
                        } catch (e) {
                            console.error("QR Generation error:", e);
                        }
                    }
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

        // 1. Local BroadcastChannel
        const channel = new BroadcastChannel('pos_cfd_channel');
        channel.onmessage = (event) => handleMsg(event.data);

        // 2. Supabase Realtime Broadcast (Cross-origin support)
        const sbChannel = supabase.channel('pos_cfd_room');
        sbChannel.on('broadcast', { event: 'cfd_event' }, (envelope) => {
            handleMsg(envelope.payload);
        }).subscribe();

        // 3. Storage event listener for cross-window sync fallback
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
    }, []);

    // -------------------------------------------------------------
    // RENDER 1: IDLE SHOWCASE (Dieter Rams Minimalist Brand Display - 10.1" 1024x600 Optimized)
    // -------------------------------------------------------------
    const renderIdleMode = () => (
        <div className="relative w-full h-full bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] flex overflow-hidden font-sans select-none">
            {/* Left Column: Brand Statement & Member QR */}
            <div className="w-1/2 h-full p-6 lg:p-8 flex flex-col justify-between z-10 bg-[oklch(18%_0.012_28)]/95 backdrop-blur-md border-r border-[oklch(42%_0.010_28)]/30">
                <div className="space-y-4">
                    {/* Venue Logo & Title */}
                    <div className="flex items-center gap-3 pb-3 border-b border-[oklch(42%_0.010_28)]/40">
                        <VenueLogo className="h-12 lg:h-14 max-w-[200px] object-contain filter drop-shadow-md brightness-110" />
                        <div className="h-8 w-px bg-[oklch(42%_0.010_28)]/50" />
                        <span className="font-mono text-[10px] lg:text-[11px] font-bold tracking-[0.2em] uppercase text-[oklch(52%_0.16_28)]">
                            HAUS TABLE EXPERIENCE
                        </span>
                    </div>

                    <div className="space-y-1">
                        <h1 className="text-2xl lg:text-3xl font-bold uppercase tracking-tight text-[oklch(97%_0.008_28)] leading-tight">
                            IN THE HAUS
                        </h1>
                        <p className="text-xs font-sans text-[oklch(55%_0.010_28)] max-w-sm leading-relaxed">
                            ยินดีต้อนรับสัมผัสรสชาติอันพิถีพิถัน สั่งอาหารและเครื่องดื่มผ่านแคชเชียร์ หรือสแกนเพื่อสมัครสมาชิก XHAUS รับสิทธิพิเศษทันที
                        </p>
                    </div>
                </div>

                {/* Member Rewards Prompt Card */}
                <div className="bg-[oklch(97%_0.008_28)]/5 border border-[oklch(97%_0.008_28)]/15 p-4 rounded-xl flex items-center justify-between gap-4 backdrop-blur-xs">
                    <div className="space-y-0.5">
                        <span className="text-[9px] font-mono font-bold tracking-widest text-[oklch(52%_0.16_28)] uppercase">
                            MEMBERSHIP & REWARDS
                        </span>
                        <h3 className="text-sm font-bold text-[oklch(97%_0.008_28)]">
                            สะสมแต้ม XHAUS POINTS
                        </h3>
                        <p className="text-[11px] text-[oklch(55%_0.010_28)] font-sans">
                            ทุก 100 บาท รับแต้มสะสมแลกส่วนลดและเครื่องดื่มฟรี
                        </p>
                    </div>

                    <div className="w-16 h-16 bg-white p-1.5 rounded-lg border border-[oklch(85%_0.012_28)] shrink-0 flex items-center justify-center">
                        <QrCode size={48} className="text-[oklch(18%_0.012_28)]" />
                    </div>
                </div>

                {/* Footer Brand Copyright */}
                <div className="flex items-center justify-between text-[9px] font-mono text-[oklch(55%_0.010_28)] uppercase tracking-widest border-t border-[oklch(42%_0.010_28)]/20 pt-2.5">
                    <span>ONHAUS SYSTEM</span>
                    <span>DIETER RAMS + THAI MODERN</span>
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
                            transition={{ duration: 1.0, ease: "easeOut" }}
                            className="absolute inset-0"
                        >
                            <img
                                src={slideshowImages[currentSlideIndex].url}
                                alt={slideshowImages[currentSlideIndex].name}
                                className="w-full h-full object-cover opacity-85 grayscale-[10%]"
                                onError={() => {
                                    setSlideshowImages(prev => prev.filter((_, idx) => idx !== currentSlideIndex));
                                    setCurrentSlideIndex(0);
                                }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[oklch(18%_0.012_28)] via-transparent to-black/20" />
                            
                            {/* Slide Item Title Badge */}
                            <div className="absolute bottom-4 left-4 right-4 bg-[oklch(97%_0.008_28)]/95 backdrop-blur-md border border-[oklch(85%_0.012_28)] p-3.5 rounded-xl shadow-lg flex items-center justify-between text-[oklch(18%_0.012_28)]">
                                <div>
                                    <span className="text-[8px] font-mono uppercase font-bold tracking-widest text-[oklch(52%_0.16_28)]">
                                        RECOMMENDED MENU
                                    </span>
                                    <h4 className="text-base font-bold uppercase tracking-tight line-clamp-1">
                                        {slideshowImages[currentSlideIndex].name}
                                    </h4>
                                </div>
                                <span className="text-xl font-mono font-bold text-[oklch(52%_0.16_28)] shrink-0 ml-2">
                                    ฿{slideshowImages[currentSlideIndex].price}
                                </span>
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
            <div className="w-5/12 h-full bg-[oklch(94%_0.010_28)] border-r border-[oklch(85%_0.012_28)] p-5 flex flex-col justify-between">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <VenueLogo className="h-9 max-w-[130px] object-contain" />
                        <div className="h-4 w-px bg-[oklch(85%_0.012_28)]" />
                        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[oklch(55%_0.010_28)] truncate">
                            {orderData.tableName ? `TABLE : ${orderData.tableName}` : 'DIRECT CHECKOUT'}
                        </span>
                    </div>

                    {/* Member Profile Banner if attached */}
                    {orderData.memberProfile ? (
                        <div className="bg-[oklch(52%_0.16_28)]/10 border border-[oklch(52%_0.16_28)]/30 rounded-xl p-4 space-y-2 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-[oklch(52%_0.16_28)] flex items-center gap-1">
                                    <ShieldCheck size={12} />
                                    VIP MEMBER ATTACHED
                                </span>
                                <span className="text-[10px] font-mono font-bold bg-[oklch(52%_0.16_28)] text-[oklch(97%_0.008_28)] px-2 py-0.5 rounded uppercase">
                                    {orderData.memberProfile.current_tier || orderData.memberProfile.tier || 'MEMBER'}
                                </span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-[oklch(18%_0.012_28)] line-clamp-1">
                                    {orderData.memberProfile.display_name || orderData.memberProfile.name || orderData.memberProfile.customer_name || orderData.customer}
                                </h2>
                            </div>
                            <div className="flex items-center justify-between border-t border-[oklch(52%_0.16_28)]/20 pt-2 text-xs font-mono">
                                <span className="text-[oklch(55%_0.010_28)]">สะสมแต้มคงเหลือ:</span>
                                <span className="font-bold text-[oklch(52%_0.16_28)]">
                                    {(orderData.memberProfile.points_balance ?? orderData.memberProfile.xhaus_points ?? orderData.memberProfile.points ?? 0).toLocaleString()} POINTS
                                </span>
                            </div>
                        </div>
                    ) : orderData.customer && orderData.customer !== 'Walk-in Guest' && orderData.customer !== 'Walk-in Pick-up' ? (
                        <div className="bg-white border border-[oklch(85%_0.012_28)] rounded-xl p-4 space-y-1 shadow-2xs">
                            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-[oklch(55%_0.010_28)]">
                                CUSTOMER
                            </span>
                            <h2 className="text-lg font-bold text-[oklch(18%_0.012_28)]">
                                {orderData.customer}
                            </h2>
                            <p className="text-[11px] text-[oklch(55%_0.010_28)] font-sans leading-relaxed pt-1">
                                สั่งอาหารกับแคชเชียร์ / สามารถแจ้งเบอร์เพื่อสะสมแต้มสมาชิก XHAUS ได้
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white border border-[oklch(85%_0.012_28)] rounded-xl p-4 space-y-1 shadow-2xs">
                            <h3 className="text-base font-bold text-[oklch(18%_0.012_28)]">
                                สั่งอาหารกับแคชเชียร์
                            </h3>
                            <p className="text-[11px] text-[oklch(55%_0.010_28)] font-sans leading-relaxed">
                                ตรวจสอบรายการอาหารทางด้านขวา และแจ้งสะสมแต้มสมาชิกได้ทันที
                            </p>
                        </div>
                    )}
                </div>

                {/* Minimalist Summary Status */}
                <div className="bg-white border border-[oklch(85%_0.012_28)] rounded-xl p-4 space-y-2.5 shadow-xs">
                    <div className="flex justify-between items-center text-[11px] font-mono text-[oklch(55%_0.010_28)]">
                        <span>TOTAL ITEMS</span>
                        <span className="font-bold text-[oklch(18%_0.012_28)]">
                            {orderData.items?.reduce((sum, i) => sum + i.quantity, 0) || 0} รายการ
                        </span>
                    </div>
                    {orderData.discount > 0 && (
                        <div className="flex justify-between items-center text-[11px] font-mono text-[oklch(45%_0.08_140)]">
                            <span>SAVINGS</span>
                            <span className="font-bold">
                                - ฿{orderData.discount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    )}
                    <div className="border-t border-[oklch(85%_0.012_28)] pt-2.5 flex justify-between items-end">
                        <span className="text-xs font-sans font-bold uppercase text-[oklch(18%_0.012_28)]">
                            ยอดรวมสุทธิ
                        </span>
                        <span className="text-2xl lg:text-3xl font-mono font-black text-[oklch(52%_0.16_28)]">
                            ฿{(orderData.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Right Pane: Live Itemized Order List */}
            <div className="w-7/12 h-full flex flex-col justify-between p-5 bg-[oklch(97%_0.008_28)]">
                <div className="pb-3 border-b border-[oklch(85%_0.012_28)] flex items-center justify-between">
                    <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)] flex items-center gap-2">
                        <Receipt size={16} className="text-[oklch(52%_0.16_28)]" />
                        YOUR ORDER SUMMARY
                    </h2>
                    <VenueLogo className="h-6 max-w-[100px] object-contain opacity-90" />
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1 max-h-[350px]">
                    <AnimatePresence>
                        {orderData.items && orderData.items.length > 0 ? (
                            orderData.items.map((item, idx) => (
                                <motion.div
                                    key={item.id || idx}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white border border-[oklch(85%_0.012_28)] rounded-lg p-3 flex items-center justify-between shadow-2xs"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="w-7 h-7 rounded-md bg-[oklch(52%_0.16_28)]/10 text-[oklch(52%_0.16_28)] font-mono font-bold flex items-center justify-center text-xs shrink-0">
                                            {item.quantity}x
                                        </span>
                                        <div>
                                            <h3 className="font-bold text-sm text-[oklch(18%_0.012_28)] uppercase leading-tight line-clamp-1">
                                                {item.name}
                                            </h3>
                                            {item.selected_options && item.selected_options.length > 0 && (
                                                <p className="text-[10px] text-[oklch(55%_0.010_28)] font-mono mt-0.5 line-clamp-1">
                                                    {item.selected_options.map(o => typeof o === 'object' ? o.name : o).join(', ')}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="text-sm font-mono font-bold text-[oklch(18%_0.012_28)] shrink-0 ml-2">
                                        ฿{(item.price * item.quantity).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-[oklch(55%_0.010_28)] font-mono text-[11px] uppercase tracking-widest gap-2 py-10">
                                <Utensils size={28} strokeWidth={1} />
                                <span>กำลังเลือกรายการอาหาร...</span>
                            </div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer Totals */}
                <div className="pt-3 border-t border-[oklch(85%_0.012_28)] space-y-1">
                    <div className="flex justify-between text-[11px] font-mono text-[oklch(55%_0.010_28)]">
                        <span>SUBTOTAL</span>
                        <span>฿{(orderData.subtotal || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {orderData.discount > 0 && (
                        <div className="flex justify-between text-[11px] font-mono text-[oklch(45%_0.08_140)] font-bold">
                            <span>DISCOUNT / SAVINGS</span>
                            <span>- ฿{orderData.discount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                        </div>
                    )}
                    {orderData.tax > 0 && (
                        <div className="flex justify-between text-[11px] font-mono text-[oklch(55%_0.010_28)]">
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
            <div className="w-1/2 h-full bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] border-r border-[oklch(85%_0.012_28)] p-5 flex flex-col justify-between">
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)]">
                            CHECKOUT PAYMENT
                        </span>
                        <VenueLogo className="h-6 max-w-[100px] object-contain" />
                    </div>
                    <h2 className="text-xl font-bold uppercase tracking-tight mt-0.5 mb-2">
                        สรุปรายการชำระเงิน
                    </h2>

                    {orderData.memberProfile && (
                        <div className="bg-[oklch(52%_0.16_28)]/10 border border-[oklch(52%_0.16_28)]/20 p-2.5 rounded-lg flex items-center justify-between text-xs font-mono mb-3">
                            <span className="font-bold text-[oklch(18%_0.012_28)] block">
                                {orderData.memberProfile.display_name || orderData.memberProfile.name || orderData.customer}
                            </span>
                            <span className="text-[9px] font-bold bg-[oklch(52%_0.16_28)] text-white px-2 py-0.5 rounded uppercase">
                                {orderData.memberProfile.current_tier || orderData.memberProfile.tier || 'MEMBER'}
                            </span>
                        </div>
                    )}

                    <div className="max-h-[260px] overflow-y-auto space-y-1.5 pr-1">
                        {orderData.items?.map((item, idx) => (
                            <div key={item.id || idx} className="flex justify-between items-center p-2.5 bg-[oklch(94%_0.010_28)] rounded-lg border border-[oklch(85%_0.012_28)]">
                                <div className="flex items-center gap-2.5">
                                    <span className="font-mono font-bold text-[11px] bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-1.5 py-0.5 rounded">
                                        {item.quantity}x
                                    </span>
                                    <span className="font-bold text-xs uppercase line-clamp-1">{item.name}</span>
                                </div>
                                <span className="font-mono font-bold text-xs shrink-0 ml-2">
                                    ฿{(item.price * item.quantity).toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Amount Due Box */}
                <div className="bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] p-4 rounded-xl space-y-1.5">
                    <div className="flex justify-between text-[11px] font-mono text-[oklch(55%_0.010_28)]">
                        <span>PAYMENT METHOD</span>
                        <span className="font-bold text-[oklch(52%_0.16_28)] uppercase">{orderData.paymentMethod || 'PromptPay QR'}</span>
                    </div>
                    
                    {orderData.paymentMethod === 'cash' && orderData.cashReceived > 0 && (
                        <>
                            <div className="flex justify-between text-[11px] font-mono text-[oklch(55%_0.010_28)]">
                                <span>CASH RECEIVED</span>
                                <span>฿{orderData.cashReceived.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-[11px] font-mono font-bold text-emerald-600 border-t border-[oklch(85%_0.012_28)] pt-1.5">
                                <span>CHANGE DUE (เงินทอน)</span>
                                <span>฿{(orderData.changeDue || 0).toLocaleString()}</span>
                            </div>
                        </>
                    )}

                    <div className="flex justify-between items-end border-t border-[oklch(85%_0.012_28)] pt-2">
                        <span className="text-xs font-sans font-bold uppercase text-[oklch(18%_0.012_28)]">ยอดเงินที่ต้องชำระ</span>
                        <span className="text-2xl font-mono font-black text-[oklch(52%_0.16_28)]">
                            ฿{(orderData.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Right Column: PromptPay QR / Cash Status */}
            <div className="w-1/2 h-full flex flex-col items-center justify-center p-6 bg-[oklch(18%_0.012_28)] text-center">
                {orderData.paymentMethod === 'cash' ? (
                    <div className="bg-white text-[oklch(18%_0.012_28)] p-6 rounded-2xl w-full max-w-[300px] flex flex-col items-center shadow-xl border border-white/20">
                        <VenueLogo className="h-8 max-w-[140px] object-contain mb-4" />
                        <div className="w-full bg-[oklch(18%_0.012_28)] text-white py-2 font-bold text-xs font-mono tracking-wider uppercase mb-4 flex items-center justify-center gap-1.5 rounded-md">
                            <span>CASH PAYMENT / ชำระเงินสด</span>
                        </div>
                        <div className="w-full space-y-3 font-mono text-center">
                            <div className="bg-[oklch(94%_0.010_28)] p-3.5 rounded-xl border border-[oklch(85%_0.012_28)]">
                                <span className="text-[10px] text-[oklch(55%_0.010_28)] uppercase block font-bold mb-0.5">ยอดรวมชำระ</span>
                                <span className="text-3xl font-black text-[oklch(52%_0.16_28)]">฿{(orderData.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                            </div>
                            {orderData.cashReceived > 0 && (
                                <div className="space-y-2 pt-1">
                                    <div className="flex justify-between text-xs font-bold text-[oklch(18%_0.012_28)] px-1">
                                        <span>รับเงินสดมา:</span>
                                        <span>฿{orderData.cashReceived.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-black text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-200 shadow-2xs">
                                        <span>เงินทอน (Change):</span>
                                        <span>฿{(orderData.changeDue || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white text-[oklch(18%_0.012_28)] p-5 rounded-2xl w-full max-w-[280px] flex flex-col items-center shadow-xl relative overflow-hidden border border-white/20">
                        <VenueLogo className="h-8 max-w-[140px] object-contain mb-3" />
                        {/* PromptPay Header */}
                        <div className="w-full bg-[#003D7A] text-white py-2 font-bold text-xs font-mono tracking-wider uppercase mb-3 flex items-center justify-center gap-1.5 rounded-md">
                            <QrCode size={16} />
                            <span>PROMPTPAY QR PAYMENT</span>
                        </div>

                        <div className="p-2.5 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-xl shadow-inner mb-3">
                            {qrPayload ? (
                                <QRCodeSVG value={qrPayload} size={170} level="M" />
                            ) : paymentQrUrl || orderData.paymentQrUrl ? (
                                <img src={paymentQrUrl || orderData.paymentQrUrl} alt="PromptPay QR" className="w-[170px] h-[170px] object-contain" />
                            ) : (
                                <div className="w-[170px] h-[170px] bg-gray-100 flex items-center justify-center text-[10px] font-mono text-gray-400">
                                    Generating PromptPay QR...
                                </div>
                            )}
                        </div>

                        <div className="space-y-0.5">
                            <span className="text-[9px] font-mono text-[oklch(55%_0.010_28)] uppercase tracking-widest">
                                SCAN WITH MOBILE BANKING APP
                            </span>
                            <p className="text-2xl font-mono font-black text-[oklch(52%_0.16_28)]">
                                ฿{(orderData.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                )}

                <div className="mt-4 flex items-center gap-2 text-[oklch(55%_0.010_28)] text-[11px] font-mono uppercase tracking-wider">
                    <Smartphone size={16} className="text-[oklch(52%_0.16_28)] shrink-0" />
                    <span>{orderData.paymentMethod === 'cash' ? 'กรุณาชำระเงินสดที่แคชเชียร์' : 'กรุณาแสดงสลิปการโอนเงินต่อพนักงาน'}</span>
                </div>
            </div>
        </div>
    );

    // -------------------------------------------------------------
    // RENDER 4: PAYMENT SUCCESS (Thank You & XHAUS Points Earned)
    // -------------------------------------------------------------
    const renderSuccessMode = () => (
        <div className="w-full h-full bg-[oklch(45%_0.08_140)] text-[oklch(97%_0.008_28)] flex flex-col items-center justify-center p-6 text-center font-sans relative overflow-hidden select-none">
            <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 15 }}
                className="flex flex-col items-center space-y-4 max-w-md"
            >
                <VenueLogo className="h-12 max-w-[180px] object-contain brightness-200 filter drop-shadow-md mb-1" />
                <div className="w-16 h-16 rounded-full bg-white/10 border border-white/30 flex items-center justify-center shadow-xl backdrop-blur-md">
                    <CheckCircle2 size={40} className="text-white" strokeWidth={1.5} />
                </div>

                <div className="space-y-1">
                    <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-white/80">
                        PAYMENT SUCCESSFUL
                    </span>
                    <h1 className="text-3xl font-bold uppercase tracking-tight text-white leading-tight">
                        ชำระเงินเรียบร้อยแล้ว
                    </h1>
                    <p className="text-sm font-sans text-white/90">
                        ขอบคุณที่เข้ามาใช้บริการ IN THE HAUS ครับ
                    </p>
                </div>

                {/* XHAUS Points Earned Box */}
                {orderData.pointsEarned > 0 && (
                    <div className="bg-white/10 border border-white/20 p-3.5 rounded-xl w-full backdrop-blur-xs space-y-0.5">
                        <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-amber-300 flex items-center justify-center gap-1">
                            <Sparkles size={12} />
                            XHAUS POINTS EARNED
                        </span>
                        <p className="text-2xl font-mono font-black text-white">
                            +{orderData.pointsEarned} POINTS
                        </p>
                    </div>
                )}

                <span className="text-[10px] font-mono text-white/60 tracking-widest uppercase pt-2">
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

                {mode === 'SUCCESS' && (
                    <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
                        {renderSuccessMode()}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

