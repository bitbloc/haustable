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

    // Fetch menu showcase images for IDLE mode
    useEffect(() => {
        const fetchImages = async () => {
            try {
                const { data } = await supabase
                    .from('menu_items')
                    .select('image_url, name, price')
                    .not('image_url', 'is', null)
                    .neq('image_url', '')
                    .limit(10);
                
                if (data && data.length > 0) {
                    const validItems = data.map(item => ({
                        url: `https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/menu/${item.image_url}`,
                        name: item.name,
                        price: item.price
                    }));
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
        if (slideshowImages.length === 0) return;
        const interval = setInterval(() => {
            setCurrentSlideIndex(prev => (prev + 1) % slideshowImages.length);
        }, 6000);
        return () => clearInterval(interval);
    }, [slideshowImages]);

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
                    const promptpayId = payload.promptpayId || '0812345678';
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
    // RENDER 1: IDLE SHOWCASE (Dieter Rams Minimalist Brand Display)
    // -------------------------------------------------------------
    const renderIdleMode = () => (
        <div className="relative w-full h-full bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] flex overflow-hidden font-sans">
            {/* Left Column: Brand Statement & Member QR */}
            <div className="w-1/2 h-full p-12 flex flex-col justify-between z-10 bg-[oklch(18%_0.012_28)]/90 backdrop-blur-md border-r border-[oklch(42%_0.010_28)]/30">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border border-[oklch(52%_0.16_28)] flex items-center justify-center text-[oklch(52%_0.16_28)]">
                            <Sparkles size={20} />
                        </div>
                        <span className="font-mono text-xs font-bold tracking-[0.3em] uppercase text-[oklch(52%_0.16_28)]">
                            HAUS TABLE EXPERIENCE
                        </span>
                    </div>

                    <h1 className="text-5xl lg:text-7xl font-bold uppercase tracking-tight text-[oklch(97%_0.008_28)] leading-none">
                        IN THE HAUS
                    </h1>
                    <p className="text-sm font-sans text-[oklch(55%_0.010_28)] max-w-md leading-relaxed">
                        ยินดีต้อนรับสัมผัสรสชาติอันพิถีพิถัน สั่งอาหารและเครื่องดื่มผ่านแคชเชียร์ หรือสแกนเพื่อสมัครสมาชิก XHAUS รับสิทธิพิเศษทันที
                    </p>
                </div>

                {/* Member Rewards Prompt Card */}
                <div className="bg-[oklch(97%_0.008_28)]/5 border border-[oklch(97%_0.008_28)]/10 p-6 rounded-2xl flex items-center justify-between gap-6 backdrop-blur-sm">
                    <div className="space-y-1">
                        <span className="text-[10px] font-mono font-bold tracking-widest text-[oklch(52%_0.16_28)] uppercase">
                            MEMBERSHIP & REWARDS
                        </span>
                        <h3 className="text-lg font-bold text-[oklch(97%_0.008_28)]">
                            สะสมแต้ม XHAUS POINTS
                        </h3>
                        <p className="text-xs text-[oklch(55%_0.010_28)] font-sans">
                            ทุก 100 บาท รับแต้มสะสมแลกส่วนลดและเครื่องดื่มฟรี
                        </p>
                    </div>

                    <div className="w-20 h-20 bg-white p-2 rounded-xl border border-[oklch(85%_0.012_28)] shrink-0 flex flex-col items-center justify-center">
                        <QrCode size={64} className="text-[oklch(18%_0.012_28)]" />
                    </div>
                </div>

                {/* Footer Brand Copyright */}
                <div className="flex items-center justify-between text-[10px] font-mono text-[oklch(55%_0.010_28)] uppercase tracking-widest border-t border-[oklch(42%_0.010_28)]/20 pt-4">
                    <span>DESIGNED BY ONHAUS SYSTEM</span>
                    <span>DIETER RAMS + THAI MODERN</span>
                </div>
            </div>

            {/* Right Column: Hero Menu Slideshow */}
            <div className="w-1/2 h-full relative overflow-hidden bg-black">
                <AnimatePresence mode="wait">
                    {slideshowImages.length > 0 ? (
                        <motion.div
                            key={currentSlideIndex}
                            initial={{ opacity: 0, scale: 1.05 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1.2, ease: "easeOut" }}
                            className="absolute inset-0"
                        >
                            <img
                                src={slideshowImages[currentSlideIndex].url}
                                alt={slideshowImages[currentSlideIndex].name}
                                className="w-full h-full object-cover opacity-80 grayscale-[15%]"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[oklch(18%_0.012_28)] via-transparent to-black/30" />
                            
                            {/* Slide Item Title Badge */}
                            <div className="absolute bottom-10 left-10 right-10 bg-[oklch(97%_0.008_28)]/90 backdrop-blur-md border border-[oklch(85%_0.012_28)] p-5 rounded-2xl shadow-xl flex items-center justify-between text-[oklch(18%_0.012_28)]">
                                <div>
                                    <span className="text-[9px] font-mono uppercase font-bold tracking-widest text-[oklch(52%_0.16_28)]">
                                        FEATURED SIGNATURE
                                    </span>
                                    <h4 className="text-xl font-bold uppercase tracking-tight">
                                        {slideshowImages[currentSlideIndex].name}
                                    </h4>
                                </div>
                                <span className="text-2xl font-mono font-bold text-[oklch(52%_0.16_28)]">
                                    ฿{slideshowImages[currentSlideIndex].price}
                                </span>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="h-full flex items-center justify-center font-mono text-sm tracking-widest text-[oklch(55%_0.010_28)]">
                            HAUS TABLE SHOWCASE
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );

    // -------------------------------------------------------------
    // RENDER 2: CART REVIEW MODE (Live Customer Order Verification)
    // -------------------------------------------------------------
    const renderCartMode = () => (
        <div className="w-full h-full bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] flex font-sans overflow-hidden">
            
            {/* Left Pane: Customer Greeting & Active Promo Showcase */}
            <div className="w-5/12 h-full bg-[oklch(94%_0.010_28)] border-r border-[oklch(85%_0.012_28)] p-10 flex flex-col justify-between">
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[oklch(52%_0.16_28)] text-white flex items-center justify-center text-xs font-mono font-bold">
                            HT
                        </div>
                        <span className="text-xs font-mono font-bold uppercase tracking-widest text-[oklch(55%_0.010_28)]">
                            {orderData.tableName ? `TABLE : ${orderData.tableName}` : 'DIRECT CHECKOUT'}
                        </span>
                    </div>

                    {/* Member Profile Banner if attached */}
                    {orderData.memberProfile || orderData.customer ? (
                        <div className="bg-[oklch(52%_0.16_28)]/10 border border-[oklch(52%_0.16_28)]/30 rounded-2xl p-5 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[oklch(52%_0.16_28)] flex items-center gap-1.5">
                                    <ShieldCheck size={14} />
                                    VIP MEMBER ATTACHED
                                </span>
                                <span className="text-[10px] font-mono font-bold bg-[oklch(52%_0.16_28)] text-[oklch(97%_0.008_28)] px-2 py-0.5 rounded-full">
                                    {orderData.memberProfile?.current_tier || 'MEMBER'}
                                </span>
                            </div>
                            <h2 className="text-2xl font-bold text-[oklch(18%_0.012_28)]">
                                {orderData.memberProfile?.display_name || orderData.customer}
                            </h2>
                            <p className="text-xs text-[oklch(55%_0.010_28)] font-mono">
                                สิทธิพิเศษส่วนลดสมาชิกถูกนำมาคำนวณในบิลแล้ว
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white border border-[oklch(85%_0.012_28)] rounded-2xl p-5 space-y-2 shadow-xs">
                            <h3 className="text-lg font-bold text-[oklch(18%_0.012_28)]">
                                สั่งอาหารกับแคชเชียร์
                            </h3>
                            <p className="text-xs text-[oklch(55%_0.010_28)] font-sans leading-relaxed">
                                ตรวจสอบรายการอาหารและเครื่องดื่มของคุณทางด้านขวา แจ้งพนักงานเพื่อสะสมแต้มสมาชิกได้ทันที
                            </p>
                        </div>
                    )}
                </div>

                {/* Minimalist Summary Status */}
                <div className="bg-white border border-[oklch(85%_0.012_28)] rounded-2xl p-6 space-y-4 shadow-sm">
                    <div className="flex justify-between items-center text-xs font-mono text-[oklch(55%_0.010_28)]">
                        <span>TOTAL ITEMS</span>
                        <span className="font-bold text-[oklch(18%_0.012_28)]">
                            {orderData.items?.reduce((sum, i) => sum + i.quantity, 0) || 0} รายการ
                        </span>
                    </div>
                    {orderData.discount > 0 && (
                        <div className="flex justify-between items-center text-xs font-mono text-[oklch(45%_0.08_140)]">
                            <span>TOTAL SAVINGS</span>
                            <span className="font-bold">
                                - ฿{orderData.discount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    )}
                    <div className="border-t border-[oklch(85%_0.012_28)] pt-4 flex justify-between items-end">
                        <span className="text-sm font-sans font-bold uppercase text-[oklch(18%_0.012_28)]">
                            ยอดรวมสุทธิ
                        </span>
                        <span className="text-3xl font-mono font-black text-[oklch(52%_0.16_28)]">
                            ฿{(orderData.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Right Pane: Live Itemized Order List */}
            <div className="w-7/12 h-full flex flex-col justify-between p-8 bg-[oklch(97%_0.008_28)]">
                <div className="pb-4 border-b border-[oklch(85%_0.012_28)] flex items-center justify-between">
                    <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)] flex items-center gap-2">
                        <Receipt size={18} className="text-[oklch(52%_0.16_28)]" />
                        YOUR ORDER SUMMARY
                    </h2>
                    <span className="text-xs font-mono text-[oklch(55%_0.010_28)]">
                        IN THE HAUS POS
                    </span>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto py-6 space-y-3 pr-2">
                    <AnimatePresence>
                        {orderData.items && orderData.items.length > 0 ? (
                            orderData.items.map((item, idx) => (
                                <motion.div
                                    key={item.id || idx}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white border border-[oklch(85%_0.012_28)] rounded-xl p-4 flex items-center justify-between shadow-xs"
                                >
                                    <div className="flex items-center gap-4">
                                        <span className="w-8 h-8 rounded-lg bg-[oklch(52%_0.16_28)]/10 text-[oklch(52%_0.16_28)] font-mono font-bold flex items-center justify-center text-sm">
                                            {item.quantity}x
                                        </span>
                                        <div>
                                            <h3 className="font-bold text-base text-[oklch(18%_0.012_28)] uppercase leading-tight">
                                                {item.name}
                                            </h3>
                                            {item.selected_options && item.selected_options.length > 0 && (
                                                <p className="text-xs text-[oklch(55%_0.010_28)] font-mono mt-0.5">
                                                    {item.selected_options.map(o => typeof o === 'object' ? o.name : o).join(', ')}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="text-base font-mono font-bold text-[oklch(18%_0.012_28)]">
                                        ฿{(item.price * item.quantity).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-[oklch(55%_0.010_28)] font-mono text-xs uppercase tracking-widest gap-2">
                                <Utensils size={32} strokeWidth={1} />
                                <span>กำลังเลือกรายการอาหาร...</span>
                            </div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer Totals */}
                <div className="pt-4 border-t border-[oklch(85%_0.012_28)] space-y-2">
                    <div className="flex justify-between text-xs font-mono text-[oklch(55%_0.010_28)]">
                        <span>SUBTOTAL</span>
                        <span>฿{(orderData.subtotal || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {orderData.discount > 0 && (
                        <div className="flex justify-between text-xs font-mono text-[oklch(45%_0.08_140)] font-bold">
                            <span>DISCOUNT / SAVINGS</span>
                            <span>- ฿{orderData.discount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                        </div>
                    )}
                    {orderData.tax > 0 && (
                        <div className="flex justify-between text-xs font-mono text-[oklch(55%_0.010_28)]">
                            <span>VAT (7%)</span>
                            <span>฿{orderData.tax.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    // -------------------------------------------------------------
    // RENDER 3: CHECKOUT & PROMPTPAY QR MODE (High Contrast Clean)
    // -------------------------------------------------------------
    const renderCheckoutMode = () => (
        <div className="w-full h-full bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] flex font-sans overflow-hidden">
            
            {/* Left Column: Order Bill Recap */}
            <div className="w-1/2 h-full bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] border-r border-[oklch(85%_0.012_28)] p-10 flex flex-col justify-between">
                <div>
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)]">
                        CHECKOUT PAYMENT
                    </span>
                    <h2 className="text-3xl font-bold uppercase tracking-tight mt-1 mb-6">
                        สรุปรายการชำระเงิน
                    </h2>

                    <div className="max-h-[380px] overflow-y-auto space-y-2 pr-2">
                        {orderData.items?.map((item, idx) => (
                            <div key={item.id || idx} className="flex justify-between items-center p-3 bg-[oklch(94%_0.010_28)] rounded-xl border border-[oklch(85%_0.012_28)]">
                                <div className="flex items-center gap-3">
                                    <span className="font-mono font-bold text-xs bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] px-2 py-1 rounded">
                                        {item.quantity}x
                                    </span>
                                    <span className="font-bold text-sm uppercase">{item.name}</span>
                                </div>
                                <span className="font-mono font-bold text-sm">
                                    ฿{(item.price * item.quantity).toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Amount Due Box */}
                <div className="bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] p-6 rounded-2xl space-y-2">
                    <div className="flex justify-between text-xs font-mono text-[oklch(55%_0.010_28)]">
                        <span>PAYMENT METHOD</span>
                        <span className="font-bold text-[oklch(52%_0.16_28)] uppercase">{orderData.paymentMethod || 'PromptPay QR'}</span>
                    </div>
                    
                    {orderData.paymentMethod === 'cash' && orderData.cashReceived > 0 && (
                        <>
                            <div className="flex justify-between text-xs font-mono text-[oklch(55%_0.010_28)]">
                                <span>CASH RECEIVED</span>
                                <span>฿{orderData.cashReceived.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-xs font-mono font-bold text-emerald-600 border-t border-[oklch(85%_0.012_28)] pt-2">
                                <span>CHANGE DUE (เงินทอน)</span>
                                <span>฿{(orderData.changeDue || 0).toLocaleString()}</span>
                            </div>
                        </>
                    )}

                    <div className="flex justify-between items-end border-t border-[oklch(85%_0.012_28)] pt-3">
                        <span className="text-sm font-sans font-bold uppercase text-[oklch(18%_0.012_28)]">ยอดเงินที่ต้องชำระ</span>
                        <span className="text-4xl font-mono font-black text-[oklch(52%_0.16_28)]">
                            ฿{(orderData.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Right Column: PromptPay QR / Cash Status */}
            <div className="w-1/2 h-full flex flex-col items-center justify-center p-12 bg-[oklch(18%_0.012_28)] text-center">
                <div className="bg-white text-[oklch(18%_0.012_28)] p-8 rounded-3xl w-full max-w-sm flex flex-col items-center shadow-2xl relative overflow-hidden border border-white/20">
                    {/* PromptPay Header */}
                    <div className="w-full bg-[#003D7A] text-white py-3 font-bold text-sm font-mono tracking-widest uppercase mb-6 flex items-center justify-center gap-2">
                        <QrCode size={18} />
                        <span>PROMPTPAY QR PAYMENT</span>
                    </div>

                    <div className="p-3 bg-white border-2 border-[oklch(85%_0.012_28)] rounded-2xl shadow-inner mb-6">
                        {qrPayload ? (
                            <QRCodeSVG value={qrPayload} size={220} level="M" />
                        ) : (
                            <div className="w-[220px] h-[220px] bg-gray-100 flex items-center justify-center text-xs font-mono text-gray-400">
                                Generating PromptPay QR...
                            </div>
                        )}
                    </div>

                    <div className="space-y-1">
                        <span className="text-[10px] font-mono text-[oklch(55%_0.010_28)] uppercase tracking-widest">
                            SCAN WITH MOBILE BANKING APP
                        </span>
                        <p className="text-3xl font-mono font-black text-[oklch(52%_0.16_28)]">
                            ฿{(orderData.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>

                <div className="mt-8 flex items-center gap-3 text-[oklch(55%_0.010_28)] text-xs font-mono uppercase tracking-wider">
                    <Smartphone size={20} className="text-[oklch(52%_0.16_28)]" />
                    <span>กรุณาแสดงสลิปการโอนเงินต่อพนักงานแคชเชียร์</span>
                </div>
            </div>
        </div>
    );

    // -------------------------------------------------------------
    // RENDER 4: PAYMENT SUCCESS (Thank You & XHAUS Points Earned)
    // -------------------------------------------------------------
    const renderSuccessMode = () => (
        <div className="w-full h-full bg-[oklch(45%_0.08_140)] text-[oklch(97%_0.008_28)] flex flex-col items-center justify-center p-12 text-center font-sans relative overflow-hidden">
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 15 }}
                className="flex flex-col items-center space-y-6 max-w-xl"
            >
                <div className="w-24 h-24 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center shadow-2xl backdrop-blur-md">
                    <CheckCircle2 size={64} className="text-white" strokeWidth={1.5} />
                </div>

                <div className="space-y-2">
                    <span className="text-xs font-mono font-bold tracking-widest uppercase text-white/80">
                        PAYMENT COMPLETED SUCCESSFUL
                    </span>
                    <h1 className="text-5xl font-bold uppercase tracking-tight text-white leading-tight">
                        ชำระเงินเรียบร้อยแล้ว
                    </h1>
                    <p className="text-lg font-sans text-white/90">
                        ขอบคุณที่เข้ามาใช้บริการ IN THE HAUS ครับ
                    </p>
                </div>

                {/* XHAUS Points Earned Box */}
                {orderData.pointsEarned > 0 && (
                    <div className="bg-white/10 border border-white/20 p-5 rounded-2xl w-full backdrop-blur-sm space-y-1">
                        <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-amber-300 flex items-center justify-center gap-1.5">
                            <Sparkles size={14} />
                            XHAUS POINTS EARNED
                        </span>
                        <p className="text-3xl font-mono font-black text-white">
                            +{orderData.pointsEarned} POINTS
                        </p>
                    </div>
                )}

                <span className="text-xs font-mono text-white/60 tracking-widest uppercase pt-4">
                    HAVE A WONDERFUL DAY!
                </span>
            </motion.div>
        </div>
    );

    return (
        <div className="w-screen h-screen overflow-hidden bg-black font-sans relative select-none">
            <AnimatePresence mode="wait">
                {mode === 'IDLE' && (
                    <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
                        {renderIdleMode()}
                    </motion.div>
                )}

                {mode === 'CART' && (
                    <motion.div key="cart" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full h-full">
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
