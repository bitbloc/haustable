import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Utensils, CheckCircle, Smartphone } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import generatePayload from 'promptpay-qr';
import { QRCodeSVG } from 'qrcode.react';

export default function POSCustomerDisplay() {
    const [mode, setMode] = useState('IDLE'); // IDLE, CART, CHECKOUT
    const [orderData, setOrderData] = useState({ items: [], subtotal: 0, total: 0, tax: 0, discount: 0 });
    const [qrPayload, setQrPayload] = useState(null);
    const [slideshowImages, setSlideshowImages] = useState([]);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

    // Fetch menu images for slideshow
    useEffect(() => {
        const fetchImages = async () => {
            try {
                const { data } = await supabase
                    .from('menu_items')
                    .select('image_url')
                    .not('image_url', 'is', null)
                    .neq('image_url', '');
                
                if (data && data.length > 0) {
                    const validUrls = data.map(item => {
                        // Assuming image_url stores just the path in the 'menu' bucket
                        return `https://lxfavbzmebqqsffgyyph.supabase.co/storage/v1/object/public/menu/${item.image_url}`;
                    });
                    setSlideshowImages(validUrls);
                }
            } catch (err) {
                console.error("Error fetching slideshow images:", err);
            }
        };
        fetchImages();
    }, []);

    // Slideshow interval
    useEffect(() => {
        if (slideshowImages.length === 0) return;
        const interval = setInterval(() => {
            setCurrentSlideIndex(prev => (prev + 1) % slideshowImages.length);
        }, 5000); // 5 seconds per slide
        return () => clearInterval(interval);
    }, [slideshowImages]);

    // Broadcast Channel Listener
    useEffect(() => {
        const channel = new BroadcastChannel('pos_cfd_channel');
        
        channel.onmessage = (event) => {
            const { type, payload } = event.data;
            
            switch (type) {
                case 'IDLE':
                    setMode('IDLE');
                    setOrderData({ items: [], subtotal: 0, total: 0, tax: 0, discount: 0 });
                    setQrPayload(null);
                    break;
                case 'UPDATE_CART':
                    setMode('CART');
                    setOrderData(payload);
                    break;
                case 'SHOW_QR':
                    setMode('CHECKOUT');
                    setOrderData(payload.orderData);
                    
                    // Generate PromptPay QR
                    const amount = parseFloat(payload.total);
                    // Use a fallback promptpay ID if none provided in payload
                    const promptpayId = payload.promptpayId || '0812345678'; 
                    const qr = generatePayload(promptpayId, { amount });
                    setQrPayload(qr);
                    break;
                case 'PAYMENT_SUCCESS':
                    setMode('SUCCESS');
                    setTimeout(() => {
                        setMode('IDLE');
                    }, 5000);
                    break;
                default:
                    break;
            }
        };

        return () => {
            channel.close();
        };
    }, []);

    const renderSlideshow = () => (
        <div className="absolute inset-0 bg-black overflow-hidden flex items-center justify-center">
            <AnimatePresence mode="wait">
                {slideshowImages.length > 0 ? (
                    <motion.img
                        key={currentSlideIndex}
                        src={slideshowImages[currentSlideIndex]}
                        initial={{ opacity: 0, scale: 1.05 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1 }}
                        className="w-full h-full object-cover opacity-60"
                        alt="Menu Showcase"
                    />
                ) : (
                    <div className="text-[#333] font-mono text-xl tracking-[0.3em]">INTHEHAUS</div>
                )}
            </AnimatePresence>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
            
            {mode === 'IDLE' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <h1 className="text-white font-sans text-6xl md:text-8xl font-black uppercase tracking-[0.2em] drop-shadow-2xl opacity-90 mix-blend-overlay">
                        IN THE HAUS
                    </h1>
                </div>
            )}
        </div>
    );

    const renderCartOverlay = () => (
        <div className="absolute inset-y-0 right-0 w-[450px] bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.15)] flex flex-col z-20 transform transition-transform">
            <div className="p-6 bg-[#1A1A1A] text-white">
                <h2 className="text-xl font-bold font-mono tracking-widest uppercase flex items-center gap-3">
                    <Utensils size={24} className="text-[#ff0000]" />
                    Your Order
                </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F5F5F2]">
                <AnimatePresence>
                    {orderData.items && orderData.items.length > 0 ? (
                        orderData.items.map((item, idx) => (
                            <motion.div 
                                key={item.id || idx}
                                initial={{ x: 20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                className="flex justify-between items-start border-b border-[#D1D1CD] pb-4"
                            >
                                <div className="flex-1 pr-4">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold font-mono text-[#ff0000] text-sm">{item.quantity}x</span>
                                        <h3 className="font-bold text-lg text-[#1A1A1A] uppercase leading-tight">{item.name}</h3>
                                    </div>
                                    {/* Selected Options / Notes */}
                                    {item.selected_options && item.selected_options.length > 0 && (
                                        <div className="text-sm text-[#767673] font-mono mt-1">
                                            {item.selected_options.map(opt => typeof opt === 'object' ? opt.name : opt).join(', ')}
                                        </div>
                                    )}
                                </div>
                                <div className="text-lg font-bold font-mono text-[#1A1A1A]">
                                    ฿{(item.price * item.quantity).toFixed(2)}
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-[#B0B0AC] font-mono font-bold uppercase tracking-widest gap-4 opacity-50 mt-20">
                            <Utensils size={48} strokeWidth={1} />
                            <span>Cart is Empty</span>
                        </div>
                    )}
                </AnimatePresence>
            </div>
            
            {/* Totals Footer */}
            <div className="p-6 bg-white border-t border-[#D1D1CD] shadow-[0_-5px_15px_rgba(0,0,0,0.05)] z-10">
                <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm font-mono font-bold text-[#767673] uppercase">
                        <span>Subtotal</span>
                        <span>฿{orderData.subtotal?.toFixed(2)}</span>
                    </div>
                    {orderData.discount > 0 && (
                        <div className="flex justify-between text-sm font-mono font-bold text-green-600 uppercase">
                            <span>Discount</span>
                            <span>- ฿{orderData.discount?.toFixed(2)}</span>
                        </div>
                    )}
                    {orderData.tax > 0 && (
                        <div className="flex justify-between text-sm font-mono font-bold text-[#767673] uppercase">
                            <span>VAT (7%)</span>
                            <span>฿{orderData.tax?.toFixed(2)}</span>
                        </div>
                    )}
                </div>
                <div className="flex justify-between items-end border-t border-black pt-4">
                    <span className="text-xl font-bold font-sans uppercase">Total</span>
                    <span className="text-4xl font-black font-mono text-[#ff0000]">฿{orderData.total?.toFixed(2)}</span>
                </div>
            </div>
        </div>
    );

    const renderCheckoutOverlay = () => (
        <div className="absolute inset-0 bg-[#1A1A1A] z-30 flex">
            {/* Left side - Order Summary */}
            <div className="flex-1 bg-[#F5F5F2] flex flex-col">
                <div className="p-8 bg-white border-b border-[#D1D1CD]">
                    <h2 className="text-3xl font-black uppercase tracking-widest text-[#1A1A1A]">Order Summary</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-8 space-y-4">
                    {orderData.items?.map((item, idx) => (
                        <div key={item.id || idx} className="flex justify-between items-center bg-white p-4 rounded-xl border border-[#D1D1CD] shadow-sm">
                            <div className="flex items-center gap-4">
                                <span className="bg-[#1A1A1A] text-white font-mono font-bold px-3 py-1 rounded-md text-lg">
                                    {item.quantity}
                                </span>
                                <h3 className="font-bold text-xl uppercase">{item.name}</h3>
                            </div>
                            <span className="text-xl font-mono font-bold text-[#1A1A1A]">฿{(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Right side - QR Payment */}
            <div className="w-[500px] bg-[#1A1A1A] flex flex-col items-center justify-center p-12 text-white shadow-[-20px_0_40px_rgba(0,0,0,0.5)]">
                <div className="bg-white p-8 rounded-3xl w-full max-w-[400px] flex flex-col items-center shadow-2xl relative overflow-hidden">
                    {/* PromptPay Branding Header */}
                    <div className="w-full bg-[#003D7A] absolute top-0 left-0 right-0 h-16 flex items-center justify-center">
                        <span className="text-white font-bold text-xl tracking-widest uppercase">PROMPTPAY</span>
                    </div>
                    
                    <div className="mt-20 mb-6 bg-white p-2 rounded-xl border-4 border-gray-100 shadow-sm">
                        {qrPayload ? (
                            <QRCodeSVG value={qrPayload} size={250} level="M" includeMargin={false} />
                        ) : (
                            <div className="w-[250px] h-[250px] bg-gray-100 flex items-center justify-center text-gray-400">Loading QR...</div>
                        )}
                    </div>
                    
                    <div className="text-center w-full">
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">Scan to pay</p>
                        <p className="text-4xl font-black font-mono text-[#ff0000]">฿{orderData.total?.toFixed(2)}</p>
                    </div>
                </div>
                
                <div className="mt-12 flex items-center gap-4 text-white/70">
                    <Smartphone size={32} />
                    <div className="text-left">
                        <p className="font-bold uppercase tracking-wider text-sm">Please show transfer slip</p>
                        <p className="font-mono text-xs opacity-70">to the staff to complete your order</p>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderSuccessOverlay = () => (
        <div className="absolute inset-0 bg-[#00CC44] z-40 flex flex-col items-center justify-center text-white">
            <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 15 }}
                className="flex flex-col items-center"
            >
                <CheckCircle size={120} strokeWidth={1.5} className="mb-8" />
                <h1 className="text-6xl font-black uppercase tracking-widest mb-4 text-center leading-tight">Payment<br />Successful</h1>
                <p className="text-2xl font-mono opacity-90 mt-4">Thank you for visiting INTHEHAUS</p>
            </motion.div>
        </div>
    );

    return (
        <div className="w-screen h-screen overflow-hidden bg-black font-sans relative select-none">
            {/* Background Slideshow (Always runs beneath) */}
            {renderSlideshow()}
            
            {/* Overlays based on mode */}
            <AnimatePresence>
                {mode === 'CART' && (
                    <motion.div
                        initial={{ x: 500 }}
                        animate={{ x: 0 }}
                        exit={{ x: 500 }}
                        transition={{ type: 'spring', damping: 20 }}
                        className="absolute inset-0 z-20 pointer-events-none"
                    >
                        {renderCartOverlay()}
                    </motion.div>
                )}
                
                {mode === 'CHECKOUT' && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -50 }}
                        className="absolute inset-0 z-30"
                    >
                        {renderCheckoutOverlay()}
                    </motion.div>
                )}
                
                {mode === 'SUCCESS' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-40"
                    >
                        {renderSuccessOverlay()}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
