import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, MapPin, MessageCircle, Utensils, HelpCircle, Clock, Navigation, Phone, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

const FALLBACK_HERO = "https://images.unsplash.com/photo-1559314809-0d155014e29e?q=80&w=800&auto=format&fit=crop";

export default function AdsLandingPage() {
    const [settings, setSettings] = useState({});
    const [menuImages, setMenuImages] = useState([]);
    const [atmImages, setAtmImages] = useState([]);
    const [signatures, setSignatures] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedLightbox, setSelectedLightbox] = useState(null);
    const [activeMenuIndex, setActiveMenuIndex] = useState(0);
    const [menuImageLoading, setMenuImageLoading] = useState(true);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const { data } = await supabase.from('app_settings').select('*').like('key', 'link_%');
            if (data) {
                const map = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
                setSettings(map);

                const menus = [];
                for (let i = 1; i <= 10; i++) {
                    if (map[`link_menu_${i}`]) menus.push(map[`link_menu_${i}`]);
                }
                setMenuImages(menus);

                const atms = [];
                for (let i = 1; i <= 10; i++) {
                    if (map[`link_atm_${i}`]) atms.push(map[`link_atm_${i}`]);
                }
                setAtmImages(atms);

                const sigs = [];
                for (let i = 1; i <= 3; i++) {
                    if (map[`link_sig_img_${i}`]) {
                        sigs.push({
                            img: map[`link_sig_img_${i}`],
                            name: map[`link_sig_name_${i}`] || '',
                            price: map[`link_sig_price_${i}`] || '',
                        });
                    }
                }
                setSignatures(sigs);
            }
        } catch (err) {
            console.error('Failed to load link data:', err);
        } finally {
            setLoading(false);
        }
    };

    const logoUrl = settings.link_logo_url || '';
    const shopName = settings.link_shop_name || 'IN THE HAUS';
    const shopNameTh = settings.link_shop_name_th || 'ในบ้าน';
    const subtitle = settings.link_subtitle || 'จริตจัด รสชัดเจน · Bold Attitude, Clear Taste';
    const hours = settings.link_hours || 'เปิดทุกวัน 11:30 - 23:30 น. (ครัวปิด 22:00 น.)';
    const locationText = settings.link_location_text || 'ริมแม่น้ำโขง · นครพนม';
    const tags = (settings.link_tags || '#inthehausth, #homefood, #southernthaifood, #nakhonphanom').split(',').map(t => t.trim()).filter(Boolean);
    const videoUrl = settings.link_video_url || '';
    const foodVideoUrl = settings.link_food_video_url || '';

    if (loading) {
        return (
            <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen bg-[#FAFAF8] text-neutral-900 overflow-x-hidden font-['IBM_Plex_Sans_Thai',sans-serif]">

            {/* ─── HEADER: LOGO + IDENTITY ─── */}
            <header className="w-full max-w-lg mx-auto px-6 pt-10 pb-4">
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="flex items-center gap-4"
                >
                    {/* Logo */}
                    {logoUrl ? (
                        <img
                            src={logoUrl}
                            alt="Logo"
                            className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-lg flex-shrink-0"
                            fetchPriority="high"
                        />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-neutral-900 flex items-center justify-center text-white text-xl font-bold flex-shrink-0 shadow-lg">
                            H
                        </div>
                    )}
                    {/* Name & Info */}
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-bold text-neutral-900 leading-tight tracking-tight truncate">
                            {shopName}
                        </h1>
                        <p className="text-neutral-500 text-sm mt-0.5">{shopNameTh}</p>
                        <div className="flex items-center gap-1.5 mt-1 text-neutral-400 text-xs">
                            <Clock size={11} />
                            <span>{hours}</span>
                        </div>
                    </div>
                </motion.div>

                {/* Subtitle */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-xs text-neutral-400 mt-4 tracking-wide font-mono"
                >
                    {subtitle}
                </motion.p>
            </header>

            {/* ─── ATMOSPHERE GALLERY (Replacing Hero) ─── */}
            {atmImages.length > 0 && (
                <section className="w-full max-w-lg mx-auto mb-8">
                    <div className="px-5 mb-3 flex items-end justify-between">
                        <div>
                            <h2 className="text-neutral-800 text-lg font-bold tracking-tight">สัมผัสบรรยากาศในบ้าน</h2>
                            <p className="text-neutral-400 text-[10px] font-mono tracking-wider uppercase mt-0.5">Experience the Vibe</p>
                        </div>
                        <span className="text-[10px] text-neutral-300 animate-pulse">Swipe ➔</span>
                    </div>
                    
                    <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 px-5 pb-4 no-scrollbar">
                        {atmImages.map((url, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.4, delay: i * 0.1 }}
                                onClick={() => setSelectedLightbox({ type: 'atm', index: i })}
                                className="flex-none w-[75%] max-w-[260px] snap-center rounded-2xl overflow-hidden shadow-sm border border-neutral-100 aspect-square cursor-pointer"
                            >
                                <img 
                                    src={url} 
                                    alt={`Atmosphere ${i + 1}`} 
                                    className="w-full h-full object-cover" 
                                    loading={i === 0 ? undefined : "lazy"}
                                    fetchPriority={i === 0 ? "high" : undefined}
                                    decoding={i === 0 ? undefined : "async"}
                                />
                            </motion.div>
                        ))}
                    </div>
                </section>
            )}

            {/* ─── LOCAL SEO STRUCTURED DATA ─── */}
            <script type="application/ld+json">
                {JSON.stringify({
                    "@context": "https://schema.org",
                    "@type": "Restaurant",
                    "name": shopName,
                    "image": logoUrl || "https://haustable.vercel.app/logo.png",
                    "priceRange": "$$",
                    "address": {
                        "@type": "PostalAddress",
                        "streetAddress": "ริมแม่น้ำโขง",
                        "addressLocality": "นครพนม",
                        "addressCountry": "TH"
                    },
                    "geo": {
                        "@type": "GeoCoordinates",
                        "latitude": "17.40722",
                        "longitude": "104.78028"
                    },
                    "url": "https://haustable.vercel.app/link",
                    "telephone": ["061-423-2455", "098-528-4217"],
                    "openingHoursSpecification": {
                        "@type": "OpeningHoursSpecification",
                        "dayOfWeek": [
                            "Monday",
                            "Tuesday",
                            "Wednesday",
                            "Thursday",
                            "Friday",
                            "Saturday",
                            "Sunday"
                        ],
                        "opens": "11:30",
                        "closes": "23:30"
                    }
                })}
            </script>

            {/* ─── SOCIAL LINKS ─── */}
            <section className="w-full max-w-lg mx-auto px-5 pb-6">
                <div className="grid grid-cols-2 gap-2.5">
                    {/* Primary Call to Action: Book Online - commented out for now as not ready to open online
                    <LinkCard 
                        href="/booking" 
                        icon={<Utensils size={18} />} 
                        title="จองโต๊ะออนไลน์ (Book Online)" 
                        bg="bg-[#DFFF00] hover:bg-[#cde600] border border-[#DFFF00]" 
                        textColor="text-neutral-900"
                        wide 
                        internal 
                        id="cta-booking"
                    />
                    */}

                    <LinkCard href="https://lin.ee/EuzwG7c" icon={<MessageCircle size={18} />} title="Line Official" bg="bg-[#00C300]" id="cta-line" />
                    <LinkCard href="https://www.facebook.com/inthehausth" icon={<ExternalLink size={18} />} title="Facebook" bg="bg-[#1877F2]" id="cta-facebook" />
                    <LinkCard href="https://instagram.com/inthehausth" icon={<ExternalLink size={18} />} title="Instagram" bg="bg-[#E1306C]" id="cta-instagram" />
                    <LinkCard href="https://maps.app.goo.gl/fYp7pp9b4zE6oFiKA?g_st=ic" icon={<MapPin size={18} />} title="Google Maps" bg="bg-[#4A4A4A]" id="cta-maps" />

                    {/* Phone Contact Block */}
                    <div className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm text-center col-span-full mt-1.5">
                        <p className="text-[10px] font-bold text-neutral-400 tracking-[0.2em] font-mono uppercase mb-2">📞 โทรสำรองที่นั่ง / ติดต่อร้าน</p>
                        <div className="flex justify-center gap-3">
                            <a 
                                href="tel:0614232455" 
                                id="cta-call-1" 
                                className="flex-1 flex items-center justify-center gap-2 text-neutral-800 font-bold hover:text-neutral-600 px-3 py-2 bg-neutral-50 rounded-xl text-xs transition-colors border border-neutral-100"
                            >
                                <Phone size={13} className="text-neutral-500" /> 061-423-2455
                            </a>
                            <a 
                                href="tel:0985284217" 
                                id="cta-call-2" 
                                className="flex-1 flex items-center justify-center gap-2 text-neutral-800 font-bold hover:text-neutral-600 px-3 py-2 bg-neutral-50 rounded-xl text-xs transition-colors border border-neutral-100"
                            >
                                <Phone size={13} className="text-neutral-500" /> 098-528-4217
                            </a>
                        </div>
                    </div>
                </div>

                {/* Delivery */}
                <div className="flex items-center gap-3 my-5">
                    <div className="h-px bg-neutral-200 flex-1" />
                    <span className="text-neutral-300 text-[9px] font-bold tracking-[0.3em] font-mono uppercase">Delivery</span>
                    <div className="h-px bg-neutral-200 flex-1" />
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                    <LinkCard href="https://lin.ee/8uqmIzZ" icon={<Utensils size={18} />} title="Lineman" bg="bg-[#00B14F]" wide id="cta-lineman" />
                </div>

                {/* Q&A */}
                <div className="mt-5">
                    <LinkCard href="/qa" icon={<HelpCircle size={18} />} title="Q&A ถาม-ตอบ" bg="bg-[#636AA0]" wide internal id="cta-qa" />
                </div>
            </section>

            {/* ─── FIND US ─── */}
            <section className="w-full max-w-lg mx-auto px-5 pb-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-sm"
                >
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-bold text-neutral-400 tracking-[0.2em] font-mono uppercase mb-2">Find Us</p>
                            <p className="text-neutral-800 font-semibold text-sm">{locationText}</p>
                            <p className="text-neutral-400 text-xs mt-1">{hours}</p>
                        </div>
                        <a
                            href="https://maps.app.goo.gl/fYp7pp9b4zE6oFiKA?g_st=ic"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-white hover:bg-neutral-700 transition-colors"
                        >
                            <Navigation size={16} />
                        </a>
                    </div>
                </motion.div>
            </section>

            {/* ─── SIGNATURE DISHES (optional) ─── */}
            {signatures.length > 0 && (
                <section className="w-full max-w-lg mx-auto px-5 pb-10">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="h-px bg-neutral-200 flex-1" />
                        <span className="text-neutral-400 text-[9px] font-bold tracking-[0.3em] font-mono uppercase">Signature</span>
                        <div className="h-px bg-neutral-200 flex-1" />
                    </div>

                    <div className={`grid gap-3 ${signatures.length === 1 ? 'grid-cols-1' : signatures.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                        {signatures.map((dish, i) => (
                            <SignatureDishCard key={i} dish={dish} index={i} />
                        ))}
                    </div>
                </section>
            )}

            {/* ─── VIDEO LOOP ─── */}
            {videoUrl && (
                <section className="w-full max-w-lg mx-auto px-4 pb-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="relative w-full rounded-2xl overflow-hidden shadow-md bg-black"
                    >
                        <video
                            src={videoUrl}
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="w-full h-auto object-cover"
                        />
                    </motion.div>
                </section>
            )}

            {/* ─── FOOD CONTENT VIDEO (VERTICAL) ─── */}
            {foodVideoUrl && (
                <section className="w-full max-w-lg mx-auto px-4 pb-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="relative w-full rounded-2xl overflow-hidden shadow-md bg-black aspect-[9/16]"
                    >
                        <video
                            src={foodVideoUrl}
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                        />
                    </motion.div>
                </section>
            )}

            {/* ─── MENU GALLERY ─── */}
            {menuImages.length > 0 && (
                <section className="w-full bg-white py-10 border-t border-neutral-100">
                    <div className="max-w-md mx-auto px-5">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-px bg-neutral-200 flex-1" />
                            <h2 className="text-neutral-700 text-sm font-bold tracking-[0.2em] font-mono uppercase">Menu</h2>
                            <div className="h-px bg-neutral-200 flex-1" />
                        </div>

                        {/* Compact Menu Viewer */}
                        <div className="bg-neutral-50 rounded-3xl border border-neutral-100 p-4 shadow-sm flex flex-col items-center">
                            
                            {/* Preview Container */}
                            <div 
                                onClick={() => setSelectedLightbox({ type: 'menu', index: activeMenuIndex })}
                                className="relative w-full max-w-[280px] aspect-[3/4] rounded-2xl overflow-hidden shadow-md border border-neutral-100 bg-neutral-200 cursor-pointer group"
                            >
                                {/* Skeleton Loader */}
                                {menuImageLoading && (
                                    <div className="absolute inset-0 bg-neutral-200 animate-pulse flex items-center justify-center">
                                        <div className="w-8 h-8 border-2 border-neutral-300 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                )}

                                <img
                                    src={menuImages[activeMenuIndex]}
                                    alt={`Menu Page ${activeMenuIndex + 1}`}
                                    loading="lazy"
                                    decoding="async"
                                    onLoad={() => setMenuImageLoading(false)}
                                    className={`w-full h-full object-contain bg-white transition-opacity duration-300 ${menuImageLoading ? 'opacity-0' : 'opacity-100'}`}
                                />

                                {/* Hover Overlay */}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-bold gap-2 backdrop-blur-[2px]">
                                    <Maximize2 size={20} />
                                    <span>แตะเพื่อขยาย & ซูมดูแบบชัดเจน</span>
                                </div>
                            </div>

                            {/* Pagination Controls */}
                            <div className="flex items-center justify-between w-full mt-4 px-2">
                                <button
                                    disabled={activeMenuIndex === 0}
                                    onClick={() => {
                                        setActiveMenuIndex(prev => Math.max(0, prev - 1));
                                        setMenuImageLoading(true);
                                    }}
                                    className="w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-100 active:scale-95 transition-all"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                
                                <span className="text-xs font-bold text-neutral-600 font-mono">
                                    หน้า {activeMenuIndex + 1} / {menuImages.length}
                                </span>

                                <button
                                    disabled={activeMenuIndex === menuImages.length - 1}
                                    onClick={() => {
                                        setActiveMenuIndex(prev => Math.min(menuImages.length - 1, prev + 1));
                                        setMenuImageLoading(true);
                                    }}
                                    className="w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-100 active:scale-95 transition-all"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>

                            {/* Horizontal Scrollable Thumbnails Strip */}
                            <div className="flex gap-2 overflow-x-auto w-full mt-4 px-1 py-1 no-scrollbar scroll-smooth">
                                {menuImages.map((url, i) => (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            setActiveMenuIndex(i);
                                            setMenuImageLoading(true);
                                        }}
                                        className={`flex-shrink-0 w-12 h-16 rounded-lg overflow-hidden border-2 transition-all ${activeMenuIndex === i ? 'border-neutral-900 scale-105 shadow-sm' : 'border-neutral-200 opacity-60 hover:opacity-100'}`}
                                    >
                                        <img
                                            src={url}
                                            alt={`Thumb ${i + 1}`}
                                            loading="lazy"
                                            decoding="async"
                                            className="w-full h-full object-cover bg-white"
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ─── TAGS ─── */}
            <section className="w-full max-w-lg mx-auto px-5 py-8">
                <div className="flex flex-wrap justify-center gap-2">
                    {tags.map(tag => (
                        <span key={tag} className="px-3 py-1 bg-neutral-100 text-neutral-400 rounded-full text-[10px] font-bold font-mono tracking-wide">
                            {tag}
                        </span>
                    ))}
                </div>
            </section>

            {/* ─── FOOTER ─── */}
            <footer className="bg-neutral-900 text-neutral-500 py-6 text-center text-[10px] font-mono tracking-widest">
                <p>© {new Date().getFullYear()} IN THE HAUS · NAKHON PHANOM</p>
            </footer>

            {/* ─── LIGHTBOX ─── */}
            <AnimatePresence>
                {selectedLightbox && (
                    <ZoomableLightbox
                        type={selectedLightbox.type}
                        images={selectedLightbox.type === 'atm' ? atmImages : menuImages}
                        initialIndex={selectedLightbox.index}
                        onClose={() => setSelectedLightbox(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── SUB-COMPONENTS ───

// Reusable Zoomable Lightbox with react-zoom-pan-pinch
function ZoomableLightbox({ type, images, initialIndex, onClose }) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const activeUrl = images[currentIndex];

    // Keyboard navigation & Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowLeft' && currentIndex > 0) setCurrentIndex(prev => prev - 1);
            else if (e.key === 'ArrowRight' && currentIndex < images.length - 1) setCurrentIndex(prev => prev + 1);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, images.length, onClose]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md select-none"
            onClick={onClose}
        >
            {/* Header Close button */}
            <div className="w-full flex justify-between items-center px-6 py-4 absolute top-0 left-0 z-50 bg-gradient-to-b from-black/60 to-transparent">
                <span className="text-white/60 text-[10px] font-mono tracking-widest font-bold">
                    {type === 'menu' ? 'MENU VIEWER' : 'ATMOSPHERE'}
                </span>
                <button
                    onClick={onClose}
                    className="w-10 h-10 bg-white/10 hover:bg-white/20 transition-colors rounded-full flex items-center justify-center text-white backdrop-blur-md cursor-pointer"
                >
                    ✕
                </button>
            </div>

            {/* Center Zoom View */}
            <div className="flex-1 w-full h-full flex items-center justify-center p-2" onClick={e => e.stopPropagation()}>
                <TransformWrapper
                    key={activeUrl} // resets the zoom transform automatically when image changes
                    initialScale={1}
                    minScale={0.8}
                    maxScale={5}
                    centerOnInit={true}
                    doubleTap={{ step: 0.5 }}
                    wheel={{ step: 0.15 }}
                >
                    {({ zoomIn, zoomOut, resetTransform }) => (
                        <div className="relative w-full h-full flex items-center justify-center">
                            
                            <TransformComponent wrapperClass="w-full h-full flex items-center justify-center" contentClass="w-full h-full flex items-center justify-center">
                                <img
                                    src={activeUrl}
                                    alt="Zoomed view"
                                    className="max-w-full max-h-[75vh] object-contain rounded-lg p-2"
                                />
                            </TransformComponent>

                            {/* Preload Next Page in Background */}
                            {currentIndex + 1 < images.length && (
                                <img
                                    src={images[currentIndex + 1]}
                                    style={{ display: 'none' }}
                                    alt="Preloading next page"
                                />
                            )}

                            {/* Left / Right Navigation on Desktop */}
                            {images.length > 1 && (
                                <>
                                    <button
                                        disabled={currentIndex === 0}
                                        onClick={() => {
                                            setCurrentIndex(prev => Math.max(0, prev - 1));
                                            resetTransform();
                                        }}
                                        className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full hidden md:flex items-center justify-center disabled:opacity-20 transition-all z-10 cursor-pointer"
                                    >
                                        <ChevronLeft size={24} />
                                    </button>
                                    <button
                                        disabled={currentIndex === images.length - 1}
                                        onClick={() => {
                                            setCurrentIndex(prev => Math.min(images.length - 1, prev + 1));
                                            resetTransform();
                                        }}
                                        className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full hidden md:flex items-center justify-center disabled:opacity-20 transition-all z-10 cursor-pointer"
                                    >
                                        <ChevronRight size={24} />
                                    </button>
                                </>
                            )}

                            {/* Bottom Glassmorphic Control Bar */}
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2.5 bg-neutral-900/80 border border-white/10 text-white px-5 py-3 rounded-2xl backdrop-blur-lg shadow-xl w-[90%] max-w-[340px]">
                                
                                {images.length > 1 && (
                                    <span className="text-[10px] text-white/50 font-mono tracking-widest uppercase">
                                        Page {currentIndex + 1} of {images.length}
                                    </span>
                                )}

                                <div className="flex items-center justify-between w-full gap-2">
                                    {/* Prev Button */}
                                    <button
                                        disabled={currentIndex === 0}
                                        onClick={() => {
                                            setCurrentIndex(prev => Math.max(0, prev - 1));
                                            resetTransform();
                                        }}
                                        className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-20 flex items-center justify-center transition-colors text-white cursor-pointer"
                                    >
                                        <ChevronLeft size={18} />
                                    </button>

                                    {/* Zoom controls */}
                                    <div className="flex items-center gap-4 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                                        <button onClick={() => zoomOut()} className="text-white/70 hover:text-white transition-colors cursor-pointer">
                                            <ZoomOut size={16} />
                                        </button>
                                        <button onClick={() => resetTransform()} className="text-[10px] uppercase font-bold tracking-wider text-white/70 hover:text-white transition-colors px-1 cursor-pointer">
                                            1:1
                                        </button>
                                        <button onClick={() => zoomIn()} className="text-white/70 hover:text-white transition-colors cursor-pointer">
                                            <ZoomIn size={16} />
                                        </button>
                                    </div>

                                    {/* Next Button */}
                                    <button
                                        disabled={currentIndex === images.length - 1}
                                        onClick={() => {
                                            setCurrentIndex(prev => Math.min(images.length - 1, prev + 1));
                                            resetTransform();
                                        }}
                                        className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-20 flex items-center justify-center transition-colors text-white cursor-pointer"
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                </div>
                            </div>

                        </div>
                    )}
                </TransformWrapper>
            </div>
        </motion.div>
    );
}

// Signature Dish Card with Skeleton loader to prevent layout shift
function SignatureDishCard({ dish, index }) {
    const [isLoaded, setIsLoaded] = useState(false);
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
            className="rounded-2xl overflow-hidden bg-white border border-neutral-100 shadow-sm flex flex-col h-full"
        >
            <div className="aspect-square overflow-hidden relative bg-neutral-100">
                {!isLoaded && (
                    <div className="absolute inset-0 bg-neutral-200 animate-pulse flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-neutral-300 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
                <img
                    src={dish.img}
                    alt={dish.name}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    onLoad={() => setIsLoaded(true)}
                    className={`w-full h-full object-cover hover:scale-105 transition-transform duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                />
            </div>
            {(dish.name || dish.price) && (
                <div className="p-3 flex-1 flex flex-col justify-between">
                    {dish.name && <p className="text-sm font-semibold text-neutral-800 leading-tight">{dish.name}</p>}
                    {dish.price && <p className="text-xs text-neutral-400 font-mono mt-1">{dish.price}.-</p>}
                </div>
            )}
        </motion.div>
    );
}

function LinkCard({ href, icon, title, bg, wide = false, internal = false, id, textColor = "text-white" }) {
    const Tag = internal ? motion.a : motion.a;
    return (
        <Tag
            href={href}
            id={id}
            target={internal ? "_self" : "_blank"}
            rel={internal ? undefined : "noopener noreferrer"}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className={`${bg} ${textColor} rounded-xl p-3.5 flex items-center justify-center gap-2.5 shadow-sm transition-transform cursor-pointer ${wide ? 'col-span-full' : ''}`}
        >
            {icon}
            <span className="text-sm font-bold">{title}</span>
        </Tag>
    );
}
