import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, MapPin, MessageCircle, Utensils, HelpCircle, Clock, Navigation, Phone, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2, RefreshCw, ZoomIn as ZoomInIcon, Compass, Instagram, Facebook, Star } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { supabase } from './lib/supabaseClient';
import { Analytics } from '@vercel/analytics/react';

const FALLBACK_HERO = "https://images.unsplash.com/photo-1559314809-0d155014e29e?q=80&w=800&auto=format&fit=crop";

const optimizeImageUrl = (url, width = 850, quality = 75) => {
    if (!url) return '';
    // Skip data URLs or local paths (relative paths)
    if (url.startsWith('data:') || url.startsWith('/') || !url.startsWith('http')) {
        return url;
    }
    try {
        // Use wsrv.nl image CDN proxy to resize and compress on the fly
        // Clean URL to prevent duplicate query params
        const cleanUrl = url.split('?')[0];
        return `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&w=${width}&q=${quality}&output=webp`;
    } catch (e) {
        console.warn('Image optimization failed:', e);
        return url;
    }
};

const preloadImageWithTimeout = (url, timeoutMs = 2500) => {
    return new Promise((resolve) => {
        if (!url) return resolve();
        const img = new Image();
        const timer = setTimeout(() => {
            resolve();
        }, timeoutMs);
        img.onload = () => {
            clearTimeout(timer);
            resolve();
        };
        img.onerror = () => {
            clearTimeout(timer);
            resolve();
        };
        img.src = url;
    });
};

export default function AdsLandingPage() {
    const [settings, setSettings] = useState({});
    const [menuImages, setMenuImages] = useState([]);
    const [promoMenuImages, setPromoMenuImages] = useState([]);
    const [regularMenuImages, setRegularMenuImages] = useState([]);
    const [activeTab, setActiveTab] = useState('regular'); // 'regular' or 'promo'
    const [menuItems, setMenuItems] = useState([]);
    const [menuCategories, setMenuCategories] = useState([]);
    const [atmImages, setAtmImages] = useState([]);
    const [signatures, setSignatures] = useState([]);
    const [customerCheckins, setCustomerCheckins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedLightbox, setSelectedLightbox] = useState(null);
    const [activeMenuIndex, setActiveMenuIndex] = useState(0);
    const [menuImageLoading, setMenuImageLoading] = useState(true);
    const [showAllMenu, setShowAllMenu] = useState(false);
    const [activeSection, setActiveSection] = useState('menu'); // 'menu' | 'atmosphere' | 'connect'

    useEffect(() => { fetchData(); }, []);

    // Inject Google Tag Manager (GTM-NPVTXNM9) dynamically for this landing page
    useEffect(() => {
        // Inject GTM script to <head>
        const script = document.createElement('script');
        script.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-NPVTXNM9');`;
        document.head.appendChild(script);

        // Inject GTM noscript iframe to <body>
        const noscript = document.createElement('noscript');
        noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-NPVTXNM9"
height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
        document.body.insertBefore(noscript, document.body.firstChild);

        return () => {
            // Clean up elements on unmount
            if (document.head.contains(script)) {
                document.head.removeChild(script);
            }
            if (document.body.contains(noscript)) {
                document.body.removeChild(noscript);
            }
        };
    }, []);

    const handleDirectionsClick = (e, url) => {
        if (e && e.preventDefault) {
            e.preventDefault();
        }
        
        const callback = () => {
            if (url) {
                window.open(url, '_blank', 'noopener,noreferrer');
            }
        };

        window.gtag = window.gtag || function() { (window.dataLayer = window.dataLayer || []).push(arguments); };
        
        window.gtag('event', 'conversion', {
            'send_to': 'AW-11227095880/QU1qCJHHvcocEMjGv-kp',
            'value': 1.0,
            'currency': 'THB',
            'event_callback': callback
        });

        // Fail-safe fallback timeout (500ms)
        setTimeout(callback, 500);
    };

    const fetchData = async () => {
        const criticalUrls = [];
        try {
            const [settingsRes, itemsRes, catsRes] = await Promise.all([
                supabase.from('app_settings').select('*').like('key', 'link_%'),
                supabase.from('menu_items').select('*').eq('is_available', true),
                supabase.from('menu_categories').select('*').order('display_order')
            ]);

            if (settingsRes.data) {
                const map = settingsRes.data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
                setSettings(map);

                if (map.link_logo_url) {
                    criticalUrls.push(map.link_logo_url);
                }
                if (map.link_hero_url) {
                    criticalUrls.push(map.link_hero_url);
                }

                // Load Menu Images (Booklet)
                const menus = [];
                for (let i = 1; i <= 10; i++) {
                    if (map[`link_menu_${i}`]) {
                        menus.push({
                            key: `link_menu_${i}`,
                            url: map[`link_menu_${i}`]
                        });
                    }
                }
                setMenuImages(menus.map(m => m.url));

                // Group menus into Promo vs Regular based on link_menu_promo_slots setting
                const promoSlotString = map.link_menu_promo_slots || '5';
                const promoSlotNumbers = promoSlotString.split(',').map(s => s.trim()).filter(Boolean);
                const promoKeys = promoSlotNumbers.map(num => `link_menu_${num}`);
                const promoUrls = menus.filter(m => promoKeys.includes(m.key)).map(m => m.url);
                const regularUrls = menus.filter(m => !promoKeys.includes(m.key)).map(m => m.url);
                
                setPromoMenuImages(promoUrls);
                setRegularMenuImages(regularUrls);

                if (promoUrls.length > 0) {
                    criticalUrls.push(promoUrls[0]);
                    setActiveTab('promo');
                } else {
                    setActiveTab('regular');
                }
                if (regularUrls.length > 0) {
                    criticalUrls.push(regularUrls[0]);
                }

                // Extract signatures
                const sigs = [];
                for (let i = 1; i <= 3; i++) {
                    if (map[`link_sig_img_${i}`]) {
                        sigs.push({
                            img: map[`link_sig_img_${i}`],
                            name: map[`link_sig_name_${i}`] || '',
                            price: map[`link_sig_price_${i}`] || '',
                        });
                        criticalUrls.push(map[`link_sig_img_${i}`]);
                    }
                }
                setSignatures(sigs);

                // Rearrange atmosphere images: put link_hero_url first
                const atms = [];
                if (map.link_hero_url) {
                    atms.push(map.link_hero_url);
                }
                for (let i = 1; i <= 10; i++) {
                    if (map[`link_atm_${i}`]) {
                        if (map[`link_atm_${i}`] !== map.link_hero_url) {
                            atms.push(map[`link_atm_${i}`]);
                        }
                    }
                }
                setAtmImages(atms);
                
                // Preload first 2 atmosphere images
                atms.slice(0, 2).forEach(url => {
                    if (url) criticalUrls.push(url);
                });
            }

            if (itemsRes.data) {
                // Sort items: recommended first, then sort_order / display_order / name
                const sortedItems = itemsRes.data.sort((a, b) => {
                    const recA = a.is_recommended === true;
                    const recB = b.is_recommended === true;
                    if (recA !== recB) return recA ? -1 : 1;

                    const orderA = a.sort_order ?? a.display_order ?? 999999;
                    const orderB = b.sort_order ?? b.display_order ?? 999999;
                    if (orderA !== orderB) return orderA - orderB;

                    return a.name.localeCompare(b.name);
                });
                setMenuItems(sortedItems);

                // Preload first 3 recommended menu item images
                const recommendedItems = sortedItems.filter(item => item.is_recommended).slice(0, 3);
                recommendedItems.forEach(item => {
                    if (item.image_url) criticalUrls.push(item.image_url);
                });
            }

            if (catsRes.data) {
                setMenuCategories(catsRes.data);
            }

            // Fetch latest visible check-ins for landing page stream preview
            try {
                const { data: checkins } = await supabase
                    .from('haus_checkins')
                    .select('*')
                    .eq('is_visible', true)
                    .order('created_at', { ascending: false })
                    .limit(8);
                if (checkins) {
                    setCustomerCheckins(checkins);
                }
            } catch (checkinErr) {
                console.error('Failed to fetch check-ins for landing page:', checkinErr);
            }

            // Raw image preloading removed to prevent downloading 20.9MB of raw original files

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

    // ─── DYNAMIC SEO (Title & Meta) ───
    useEffect(() => {
        if (!loading) {
            // Using the optimized Google Ads copy for maximum SEO impact
            document.title = `ร้านในบ้าน นครพนม | อาหารใต้รสจัด ริมโขง | จริตจัด รสชัดเจน`;
            let metaDescription = document.querySelector('meta[name="description"]');
            const descText = `อาหารใต้รสจัด บรรยากาศนั่งสบายริมโขง ครบทั้งเซ็ต กับข้าว และกาแฟ ร้านอาหารและคาเฟ่ นครพนม เหมาะกับมื้อเที่ยง คุยงาน รับแขก หรือมื้อเย็น เปิดทุกวัน ${hours}`;
            if (metaDescription) {
                metaDescription.setAttribute("content", descText);
            } else {
                metaDescription = document.createElement('meta');
                metaDescription.name = "description";
                metaDescription.content = descText;
                document.head.appendChild(metaDescription);
            }
        }
    }, [hours, loading]);
 
    // ─── PRELOAD ADJACENT BOOKLET PAGES FOR SMOOTH PAGE FLIPPING ───
    useEffect(() => {
        if (loading) return;
        const currentImages = activeTab === 'promo' ? promoMenuImages : regularMenuImages;
        if (currentImages && currentImages.length > 0) {
            // Preload next page (optimized size)
            if (activeMenuIndex + 1 < currentImages.length) {
                preloadImageWithTimeout(optimizeImageUrl(currentImages[activeMenuIndex + 1], 900), 3000);
            }
            // Preload previous page (optimized size)
            if (activeMenuIndex - 1 >= 0) {
                preloadImageWithTimeout(optimizeImageUrl(currentImages[activeMenuIndex - 1], 900), 3000);
            }
        }
    }, [activeMenuIndex, activeTab, promoMenuImages, regularMenuImages, loading]);

    // Filter only recommended items for the initial presentation (10-15 items)
    const featuredMenuItems = menuItems.filter(item => item.is_recommended).slice(0, 15);

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--color-hallmark-paper)] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-neutral-800 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    /* Hallmark · component: AdsLandingPage · genre: modern-minimal · theme: custom · vibe: "Dieter Rams industrial modern slab"
     * states: default · hover · focus · active
     * contrast: pass (APCA / WCAG compliant)
     */
    return (
        <div className="ads-landing-page w-full min-h-screen flex flex-col bg-[var(--color-hallmark-paper)] text-[var(--color-hallmark-ink)] overflow-x-hidden font-[var(--font-body)] relative pb-safe">
            
            {/* Custom Embedded CSS for layout and animations */}
            <style>{`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .active-dot-glow {
                    box-shadow: 0 0 8px var(--color-brand);
                }
            `}</style>

            <div className="w-full max-w-lg mx-auto px-4 relative z-10 flex-grow flex flex-col">
                
                {/* ─── HEADER: IDENTITY & METADATA ─── */}
                <header className="pt-8 pb-4 border-b border-[var(--color-hallmark-rule)] animate-fade-in">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            {logoUrl ? (
                                <img
                                    src={optimizeImageUrl(logoUrl, 120)}
                                    alt="IN THE HAUS Logo"
                                    className="w-12 h-12 rounded-sm object-cover border border-[var(--color-hallmark-ink)] flex-shrink-0"
                                />
                            ) : (
                                <div className="w-12 h-12 rounded-sm bg-[var(--color-hallmark-ink)] flex items-center justify-center flex-shrink-0 p-1.5">
                                    <img src="/logo.png" alt="IN THE HAUS" className="w-full h-full object-contain invert" />
                                </div>
                            )}
                            <div>
                                <h1 className="text-lg md:text-xl font-[var(--font-display)] font-bold text-[var(--color-hallmark-ink)] tracking-wider uppercase leading-none">
                                    {shopName}
                                </h1>
                                <p className="text-[var(--color-hallmark-ink-muted)] font-[var(--font-display)] font-bold text-[10px] tracking-widest uppercase mt-1">{shopNameTh}</p>
                            </div>
                        </div>
                        
                        <p className="text-xs text-[var(--color-hallmark-ink-muted)] leading-relaxed font-[var(--font-body)]">
                            {subtitle}
                        </p>

                        {/* Braun Info Panel */}
                        <div className="bg-[var(--color-hallmark-paper-dark)] border border-[var(--color-hallmark-rule)] p-3 rounded-sm font-mono text-[9px] text-[var(--color-hallmark-ink)] space-y-1 mt-2">
                            <div className="flex justify-between gap-4">
                                <span className="text-[var(--color-hallmark-ink-muted)]">STATUS:</span>
                                <span className="flex items-center gap-1 font-bold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    OPEN DAILY
                                </span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-[var(--color-hallmark-ink-muted)]">HOURS:</span>
                                <span className="font-bold">{hours.replace('เปิดทุกวัน ', '')}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-[var(--color-hallmark-ink-muted)]">LOC:</span>
                                <span className="font-bold">{locationText}</span>
                            </div>
                        </div>

                        {/* Live Check-in Ticker Callout */}
                        <a
                            href="/link/hauscheckin"
                            className="flex items-center justify-between gap-3 bg-[var(--color-brand)] border border-[var(--color-hallmark-rule)] px-3 py-2.5 rounded-sm hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer text-neutral-900 group shadow-sm mt-3"
                        >
                            <span className="flex items-center gap-2 flex-shrink-0">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-650"></span>
                                </span>
                                <span className="font-mono text-[9px] font-extrabold uppercase tracking-wider text-neutral-800">
                                    LIVE CUSTOMER FEED
                                </span>
                            </span>
                            <span className="font-[var(--font-body)] font-bold text-[10px] flex items-center gap-1 min-w-0 truncate text-right">
                                <span className="truncate">ชมรูปภาพเช็กอินของลูกค้า 1,200+ รูป!</span> <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
                            </span>
                        </a>

                    </div>
                </header>

                {/* ─── SECTION CONTROLS (Braun Selector Panel) ─── */}
                <div className="grid grid-cols-3 border-b border-[var(--color-hallmark-rule)] mb-6 bg-[var(--color-hallmark-paper)] sticky top-0 z-30">
                    <button
                        onClick={() => setActiveSection('menu')}
                        className={`py-3.5 flex flex-col items-center justify-center gap-1.5 font-[var(--font-display)] text-[10px] font-bold tracking-wider border-r border-[var(--color-hallmark-rule)] cursor-pointer transition-all ${activeSection === 'menu' ? 'bg-[var(--color-hallmark-paper-dark)] text-[var(--color-hallmark-ink)] font-black' : 'text-[var(--color-hallmark-ink-muted)] hover:text-[var(--color-hallmark-ink)] bg-transparent'}`}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full transition-all ${activeSection === 'menu' ? 'bg-[var(--color-brand)] active-dot-glow scale-110' : 'bg-neutral-300'}`} />
                        01 / MENU
                    </button>
                    <button
                        onClick={() => setActiveSection('atmosphere')}
                        className={`py-3.5 flex flex-col items-center justify-center gap-1.5 font-[var(--font-display)] text-[10px] font-bold tracking-wider border-r border-[var(--color-hallmark-rule)] cursor-pointer transition-all ${activeSection === 'atmosphere' ? 'bg-[var(--color-hallmark-paper-dark)] text-[var(--color-hallmark-ink)] font-black' : 'text-[var(--color-hallmark-ink-muted)] hover:text-[var(--color-hallmark-ink)] bg-transparent'}`}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full transition-all ${activeSection === 'atmosphere' ? 'bg-[var(--color-brand)] active-dot-glow scale-110' : 'bg-neutral-300'}`} />
                        02 / VIBE
                    </button>
                    <button
                        onClick={() => setActiveSection('connect')}
                        className={`py-3.5 flex flex-col items-center justify-center gap-1.5 font-[var(--font-display)] text-[10px] font-bold tracking-wider cursor-pointer transition-all ${activeSection === 'connect' ? 'bg-[var(--color-hallmark-paper-dark)] text-[var(--color-hallmark-ink)] font-black' : 'text-[var(--color-hallmark-ink-muted)] hover:text-[var(--color-hallmark-ink)] bg-transparent'}`}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full transition-all ${activeSection === 'connect' ? 'bg-[var(--color-brand)] active-dot-glow scale-110' : 'bg-neutral-300'}`} />
                        03 / CONNECT
                    </button>
                </div>

                {/* ─── SECTION 1: MENU & SIGNATURES ─── */}
                {activeSection === 'menu' && (
                    <div className="space-y-6 flex-grow animate-fade-in">
                        
                        {/* Signatures */}
                        {signatures.length > 0 && (
                            <section className="space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-[var(--color-hallmark-rule)]">
                                    <h3 className="font-[var(--font-display)] text-[10px] font-bold uppercase tracking-wider text-[var(--color-hallmark-ink-muted)]">
                                        [ 01.1 // SIGNATURE DISHES ]
                                    </h3>
                                    <span className="text-[8px] font-mono bg-[var(--color-brand)] text-white px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-wider">
                                        RECOMMENDED
                                    </span>
                                </div>
                                <div className={`grid gap-3 ${signatures.length === 1 ? 'grid-cols-1' : signatures.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                    {signatures.map((dish, i) => (
                                        <div 
                                            key={i} 
                                            className="bg-[var(--color-hallmark-paper-dark)] border border-[var(--color-hallmark-rule)] rounded-sm overflow-hidden flex flex-col group cursor-pointer"
                                            onClick={() => setSelectedLightbox({ type: 'menu', url: dish.img })}
                                        >
                                            <div className="aspect-square relative overflow-hidden bg-neutral-100 border-b border-[var(--color-hallmark-rule)]">
                                                <img 
                                                    src={optimizeImageUrl(dish.img, 400)} 
                                                    alt={dish.name} 
                                                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" 
                                                    fetchPriority="high"
                                                    decoding="async"
                                                />
                                            </div>
                                            <div className="p-2 flex-grow flex flex-col justify-between">
                                                <p className="font-[var(--font-body)] font-bold text-[10px] leading-tight text-[var(--color-hallmark-ink)] line-clamp-2">{dish.name}</p>
                                                <p className="font-mono text-[10px] font-bold text-[var(--color-brand)] mt-1.5">฿{dish.price}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Specialties List */}
                        {featuredMenuItems.length > 0 && (
                            <section className="bg-[var(--color-hallmark-paper-dark)] border border-[var(--color-hallmark-rule)] rounded-sm p-4 space-y-4">
                                <div className="flex items-center justify-between pb-2.5 border-b border-[var(--color-hallmark-rule)]">
                                    <h3 className="font-[var(--font-display)] text-[10px] font-bold uppercase tracking-wider text-[var(--color-hallmark-ink)]">
                                        [ 01.2 // SPECIALTIES ]
                                    </h3>
                                    <span className="font-mono text-[9px] text-[var(--color-hallmark-ink-muted)]">
                                        {featuredMenuItems.length} ITEMS
                                    </span>
                                </div>
                                
                                <div className="divide-y divide-[var(--color-hallmark-rule)]">
                                    {featuredMenuItems.map((item, idx) => (
                                        <MenuListItem key={item.id} item={item} index={idx} onImageClick={(url) => setSelectedLightbox({ type: 'menu', url })} />
                                    ))}
                                </div>
                                
                                {/* Accordion Toggle Button */}
                                <div className="pt-3 border-t border-dashed border-[var(--color-hallmark-rule)]">
                                    <button
                                        onClick={() => setShowAllMenu(!showAllMenu)}
                                        className="w-full py-2 bg-[var(--color-hallmark-ink)] text-[var(--color-hallmark-paper)] hover:bg-neutral-800 transition-colors font-mono text-[9px] font-bold uppercase tracking-wider rounded-sm cursor-pointer"
                                    >
                                        {showAllMenu ? "[-] CLOSE ALL MENU SECTIONS" : "[+] VIEW FULL MENU (80+ ITEMS)"}
                                    </button>
                                </div>
                            </section>
                        )}

                        {/* Full Menu Accordion Content */}
                        <AnimatePresence>
                            {showAllMenu && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.25, ease: 'easeOut' }}
                                    className="w-full space-y-4 overflow-hidden"
                                >
                                    {menuCategories.map((category) => {
                                        const categoryItems = menuItems.filter(item => item.category_id === category.id);
                                        if (categoryItems.length === 0) return null;

                                        return (
                                            <div key={category.id} className="bg-[var(--color-hallmark-paper-dark)] border border-[var(--color-hallmark-rule)] rounded-sm p-4 animate-fade-in">
                                                <div className="mb-3 pb-2 border-b border-[var(--color-hallmark-rule)] flex justify-between items-center">
                                                    <span className="font-[var(--font-display)] text-xs font-bold tracking-wider text-[var(--color-hallmark-ink)] uppercase">
                                                        // {category.name}
                                                    </span>
                                                    <span className="font-mono text-[9px] text-[var(--color-hallmark-ink-muted)]">
                                                        {categoryItems.length} ITEMS
                                                    </span>
                                                </div>
                                                <div className="divide-y divide-[var(--color-hallmark-rule)]">
                                                    {categoryItems.map((item, idx) => (
                                                        <MenuListItem key={item.id} item={item} index={idx} onImageClick={(url) => setSelectedLightbox({ type: 'menu', url })} />
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Original Booklet Menu trigger */}
                        {(promoMenuImages.length > 0 || regularMenuImages.length > 0) && (
                            <section>
                                <button
                                    onClick={() => {
                                        setSelectedLightbox({
                                            type: 'booklet_slider',
                                            urls: activeTab === 'promo' ? promoMenuImages : regularMenuImages
                                        });
                                    }}
                                    className="w-full bg-[var(--color-hallmark-paper-dark)] border border-[var(--color-hallmark-rule)] rounded-sm p-4 flex flex-col items-center justify-center gap-1 hover:bg-neutral-100/50 transition-colors cursor-pointer"
                                >
                                    <span className="text-[9px] font-mono text-[var(--color-brand)] font-bold tracking-widest uppercase">
                                        // CLASSIC BOOKLET MENU
                                    </span>
                                    <span className="font-[var(--font-body)] font-bold text-xs text-[var(--color-hallmark-ink)] flex items-center gap-1.5 mt-1">
                                        📖 เปิดเล่มเมนูดั้งเดิม (PDF) ➔
                                    </span>
                                </button>
                            </section>
                        )}
                        
                    </div>
                )}

                {/* ─── SECTION 2: VIBE / ATMOSPHERE ─── */}
                {activeSection === 'atmosphere' && (
                    <div className="space-y-6 flex-grow animate-fade-in">
                        {/* Official Atmosphere Photos */}
                        {atmImages.length > 0 && (
                            <div className="bg-[var(--color-hallmark-paper-dark)] border border-[var(--color-hallmark-rule)] rounded-sm p-4">
                                <div className="flex items-center justify-between pb-3 border-b border-[var(--color-hallmark-rule)] mb-4">
                                    <h3 className="font-[var(--font-display)] text-[10px] font-bold uppercase tracking-wider text-[var(--color-hallmark-ink)]">
                                        [ 02.1 // ATMOSPHERE IMAGES ]
                                    </h3>
                                    <span className="font-mono text-[9px] text-[var(--color-hallmark-ink-muted)]">
                                        {atmImages.length} VIEWS
                                    </span>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    {atmImages.map((url, i) => (
                                        <div
                                            key={i}
                                            onClick={() => setSelectedLightbox({ type: 'atm', url })}
                                            className="border border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper)] rounded-sm overflow-hidden aspect-square cursor-pointer hover:border-[var(--color-brand)] transition-colors duration-150"
                                        >
                                            <img 
                                                src={optimizeImageUrl(url, 500)} 
                                                alt={`Atmosphere ${i + 1}`} 
                                                className="w-full h-full object-cover hover:scale-102 transition-transform duration-300" 
                                                loading="lazy"
                                                decoding="async"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Customer Live Check-in Photos */}
                        {customerCheckins.length > 0 && (
                            <div className="bg-[var(--color-hallmark-paper-dark)] border border-[var(--color-hallmark-rule)] rounded-sm p-4">
                                <div className="flex items-center justify-between pb-3 border-b border-[var(--color-hallmark-rule)] mb-4">
                                    <h3 className="font-[var(--font-display)] text-[10px] font-bold uppercase tracking-wider text-[var(--color-hallmark-ink)]">
                                        [ 02.2 // CUSTOMER MOMENTS // ภาพความประทับใจ ]
                                    </h3>
                                    <span className="font-mono text-[9px] text-[var(--color-brand)] font-bold animate-pulse">
                                        ● LIVE STREAM
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {customerCheckins.map((item) => (
                                        <div
                                            key={item.id}
                                            onClick={() => setSelectedLightbox({ type: 'checkin', item })}
                                            className="border border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper)] rounded-sm overflow-hidden aspect-square cursor-pointer hover:border-[var(--color-brand)] transition-all duration-150 relative group"
                                        >
                                            <img 
                                                src={optimizeImageUrl(item.image_url, 400)} 
                                                alt={item.text || 'Customer Check-in'} 
                                                className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300" 
                                                loading="lazy"
                                                decoding="async"
                                            />
                                            {/* Source Badge */}
                                            <div className="absolute bottom-1.5 left-1.5 bg-black/75 backdrop-blur-sm border border-neutral-800 rounded-sm p-1 flex items-center justify-center text-white">
                                                {item.source === 'instagram' && <Instagram size={10} />}
                                                {item.source === 'facebook' && <Facebook size={10} />}
                                                {item.source === 'google' && <Star size={10} className="text-[#F4B400] fill-[#F4B400]" />}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Call to action to view the full draggable board */}
                                <div className="mt-4">
                                    <a
                                        href="/link/hauscheckin"
                                        className="w-full bg-[var(--color-brand)] text-neutral-900 border border-[var(--color-hallmark-rule)] rounded-sm py-3 flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer font-mono text-[10px] font-extrabold tracking-wider uppercase text-center"
                                    >
                                        <Compass size={12} />
                                        <span>ดูบอร์ดรูปเช็กอินแบบเต็มจอ (1,200+ รูป)</span>
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ─── SECTION 3: CONNECT / LINKS ─── */}
                {activeSection === 'connect' && (
                    <div className="space-y-4 flex-grow animate-fade-in">
                        
                        {/* Quick Connections */}
                        <div className="bg-[var(--color-hallmark-paper-dark)] border border-[var(--color-hallmark-rule)] rounded-sm p-4">
                            <h3 className="font-[var(--font-display)] text-[10px] font-bold uppercase tracking-wider text-[var(--color-hallmark-ink)] pb-3 border-b border-[var(--color-hallmark-rule)] mb-4">
                                [ 03.1 // QUICK CONNECTIONS ]
                            </h3>
                            
                            <div className="space-y-2">
                                <LinkCard 
                                    href="https://maps.app.goo.gl/TfTD3xATqRCrQmiF9" 
                                    icon={<MapPin size={12} />} 
                                    title="GOOGLE MAPS DIRECTION" 
                                    bg="bg-[var(--color-brand)] text-white hover:opacity-90" 
                                    wide 
                                    id="cta-maps" 
                                    onClick={(e) => handleDirectionsClick(e, "https://maps.app.goo.gl/TfTD3xATqRCrQmiF9")}
                                />
                                
                                <div className="flex gap-2">
                                    <LinkCard 
                                        href="https://www.facebook.com/inthehausth" 
                                        icon={<ExternalLink size={10} />} 
                                        title="FACEBOOK" 
                                        bg="bg-[var(--color-hallmark-paper)] text-[var(--color-hallmark-ink)] border border-[var(--color-hallmark-rule)] hover:bg-neutral-100/50" 
                                        id="cta-facebook" 
                                    />
                                    <LinkCard 
                                        href="https://instagram.com/inthehausth" 
                                        icon={<ExternalLink size={10} />} 
                                        title="INSTAGRAM" 
                                        bg="bg-[var(--color-hallmark-paper)] text-[var(--color-hallmark-ink)] border border-[var(--color-hallmark-rule)] hover:bg-neutral-100/50" 
                                        id="cta-instagram" 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Delivery */}
                        <div className="bg-[var(--color-hallmark-paper-dark)] border border-[var(--color-hallmark-rule)] rounded-sm p-4">
                            <h3 className="font-[var(--font-display)] text-[10px] font-bold uppercase tracking-wider text-[var(--color-hallmark-ink)] pb-3 border-b border-[var(--color-hallmark-rule)] mb-4">
                                [ 03.2 // DELIVERY SERVICE ]
                            </h3>
                            <LinkCard 
                                href="https://lin.ee/8uqmIzZ" 
                                icon={<Utensils size={12} />} 
                                title="ORDER DIRECT ON LINEMAN" 
                                bg="bg-[var(--color-hallmark-ink)] text-white hover:bg-neutral-800" 
                                wide 
                                id="cta-lineman" 
                            />
                        </div>

                        {/* Information Hub */}
                        <div className="bg-[var(--color-hallmark-paper-dark)] border border-[var(--color-hallmark-rule)] rounded-sm p-4">
                            <h3 className="font-[var(--font-display)] text-[10px] font-bold uppercase tracking-wider text-[var(--color-hallmark-ink)] pb-3 border-b border-[var(--color-hallmark-rule)] mb-4">
                                [ 03.3 // INFORMATION HUB ]
                            </h3>
                            <LinkCard 
                                href="/qa" 
                                icon={<HelpCircle size={12} />} 
                                title="RESTAURANT Q&A / DETAILS" 
                                bg="bg-[var(--color-hallmark-paper)] text-[var(--color-hallmark-ink)] border border-[var(--color-hallmark-rule)] hover:bg-neutral-100/50" 
                                wide 
                                internal 
                                id="cta-qa" 
                            />
                            <div className="mt-2.5" />
                            <LinkCard 
                                href="/link/hauscheckin" 
                                icon={<Compass size={12} />} 
                                title="HAUS CHECK-IN WALL" 
                                bg="bg-[var(--color-brand)] text-[var(--color-hallmark-ink)] border border-[var(--color-hallmark-rule)] hover:opacity-90 font-bold" 
                                wide 
                                internal 
                                id="cta-checkin" 
                            />
                        </div>

                        {/* Address Location details */}
                        <div className="bg-[var(--color-hallmark-paper-dark)] border border-[var(--color-hallmark-rule)] rounded-sm p-4 font-mono text-[11px] text-[var(--color-hallmark-ink)]">
                            <h3 className="font-[var(--font-display)] text-[10px] font-bold uppercase tracking-wider pb-2 border-b border-[var(--color-hallmark-rule)] mb-3 text-[var(--color-hallmark-ink-muted)]">
                                [ 03.4 // OFFICE ADDRESS ]
                            </h3>
                            <p className="font-[var(--font-body)] font-bold text-xs leading-relaxed">{locationText}</p>
                            <p className="mt-2 text-[var(--color-hallmark-ink-muted)] font-bold">TEL: 098-528-4217</p>
                            <p className="mt-1 text-[var(--color-hallmark-ink-muted)] font-bold font-mono">OPEN: {hours}</p>
                            
                            <div className="mt-4 pt-3 border-t border-[var(--color-hallmark-rule)] flex justify-end">
                                <a
                                    href="https://maps.app.goo.gl/TfTD3xATqRCrQmiF9"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => handleDirectionsClick(e, "https://maps.app.goo.gl/TfTD3xATqRCrQmiF9")}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--color-hallmark-ink)] text-[var(--color-hallmark-paper)] rounded-sm font-mono text-[9px] font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors"
                                >
                                    <Navigation size={9} /> LAUNCH MAP
                                </a>
                            </div>
                        </div>
                        
                    </div>
                )}

                {/* ─── TAGS ─── */}
                <div className="py-4 border-t border-[var(--color-hallmark-rule)] mt-8">
                    <div className="flex flex-wrap justify-center gap-1.5">
                        {tags.map(tag => (
                            <span key={tag} className="px-2.5 py-1 border border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper-dark)] text-[var(--color-hallmark-ink-muted)] rounded-sm text-[9px] font-mono tracking-wider">
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>

            </div>

            {/* ─── FOOTER ─── */}
            <footer className="bg-[var(--color-hallmark-paper-dark)] text-[var(--color-hallmark-ink-muted)] py-8 w-full mt-auto pb-24 border-t border-[var(--color-hallmark-rule)]">
                <div className="max-w-lg mx-auto px-5 flex flex-col items-center gap-3">
                    <p className="font-mono text-[9px] font-bold tracking-[0.25em] text-[var(--color-hallmark-ink)] uppercase">
                        // {shopName}
                    </p>
                    <div className="h-px w-8 bg-[var(--color-hallmark-rule)]" />
                    <p className="font-[var(--font-body)] text-[9px] tracking-wider uppercase text-neutral-400">จริตจัด รสชัดเจน · Bold Attitude, Clear Taste</p>
                    <p className="font-mono text-[8px] text-neutral-400 mt-1 uppercase tracking-widest">© {new Date().getFullYear()} IN THE HAUS · NAKHON PHANOM</p>
                </div>
            </footer>

            {/* ─── STICKY CONTACT BAR ─── */}
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-[440px] p-2 bg-[var(--color-hallmark-paper)] border border-[var(--color-hallmark-ink)] rounded-sm shadow-md flex gap-2 pb-safe">
                <a 
                    href="https://lin.ee/EuzwG7c" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-1 bg-[var(--color-brand)] text-white hover:opacity-90 rounded-sm py-2.5 px-2 flex items-center justify-center gap-1.5 text-[9px] font-mono font-bold tracking-wider uppercase transition-colors cursor-pointer"
                >
                    <MessageCircle size={12} /> LINE CHAT
                </a>
                <a 
                    href="https://maps.app.goo.gl/TfTD3xATqRCrQmiF9"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => handleDirectionsClick(e, "https://maps.app.goo.gl/TfTD3xATqRCrQmiF9")}
                    className="flex-1 bg-[var(--color-hallmark-paper-dark)] text-[var(--color-hallmark-ink)] hover:bg-neutral-200 border border-[var(--color-hallmark-rule)] rounded-sm py-2.5 px-2 flex items-center justify-center gap-1.5 text-[9px] font-mono font-bold tracking-wider uppercase transition-colors cursor-pointer"
                >
                    <Navigation size={12} /> DIRECTIONS
                </a>
                <a 
                    href="tel:0985284217" 
                    className="flex-1 bg-[var(--color-hallmark-ink)] text-[var(--color-hallmark-paper)] hover:bg-neutral-800 rounded-sm py-2.5 px-2 flex items-center justify-center gap-1.5 text-[9px] font-mono font-bold tracking-wider uppercase transition-colors cursor-pointer"
                >
                    <Phone size={12} /> CALL / BOOK
                </a>
            </div>

            {/* ─── LIGHTBOX MODAL ─── */}
            <AnimatePresence>
                {selectedLightbox && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 cursor-pointer select-none overflow-y-auto"
                        onClick={() => setSelectedLightbox(null)}
                    >
                        <button
                            onClick={() => setSelectedLightbox(null)}
                            className="absolute top-4 right-4 w-9 h-9 bg-white/10 hover:bg-white/20 transition-colors rounded-sm flex items-center justify-center text-white backdrop-blur-md cursor-pointer text-sm font-mono font-bold z-50"
                        >
                            [X]
                        </button>

                        {selectedLightbox.type === 'booklet_slider' ? (
                            <div 
                                className="w-full max-w-lg bg-[var(--color-hallmark-paper)] rounded-sm p-4 border border-[var(--color-hallmark-ink)] flex flex-col items-center z-40 relative my-8" 
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex justify-between items-center w-full mb-3 pb-2 border-b border-[var(--color-hallmark-rule)]">
                                    <span className="font-mono text-[10px] font-bold text-[var(--color-hallmark-ink-muted)]">
                                        // ORIGINAL MENU BOOKLET
                                    </span>
                                    <button 
                                        onClick={() => setSelectedLightbox(null)}
                                        className="text-[10px] font-mono font-bold hover:text-[var(--color-brand)] cursor-pointer text-[var(--color-hallmark-ink)]"
                                    >
                                        [ CLOSE ]
                                    </button>
                                </div>

                                {/* Tab Switcher inside Modal */}
                                <div className="flex border border-[var(--color-hallmark-rule)] rounded-sm mb-3 w-full text-[10px] font-mono overflow-hidden">
                                    {regularMenuImages.length > 0 && (
                                        <button
                                            onClick={() => {
                                                setActiveTab('regular');
                                                setActiveMenuIndex(0);
                                                setMenuImageLoading(true);
                                            }}
                                            className={`flex-1 py-2 text-center transition-all cursor-pointer font-bold border-r border-[var(--color-hallmark-rule)] last:border-r-0 ${activeTab === 'regular' ? 'bg-[var(--color-hallmark-paper-dark)] text-[var(--color-hallmark-ink)]' : 'text-[var(--color-hallmark-ink-muted)] bg-transparent'}`}
                                        >
                                            MAIN MENU
                                        </button>
                                    )}
                                    {promoMenuImages.length > 0 && (
                                        <button
                                            onClick={() => {
                                                setActiveTab('promo');
                                                setActiveMenuIndex(0);
                                                setMenuImageLoading(true);
                                            }}
                                            className={`flex-1 py-2 text-center transition-all cursor-pointer font-bold border-r border-[var(--color-hallmark-rule)] last:border-r-0 ${activeTab === 'promo' ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-hallmark-ink-muted)] bg-transparent'}`}
                                        >
                                            PROMOTIONS
                                        </button>
                                    )}
                                </div>

                                {/* Slider Component */}
                                {(() => {
                                    const currentImages = activeTab === 'promo' ? promoMenuImages : regularMenuImages;
                                    if (currentImages.length === 0) return null;
                                    const activeUrl = currentImages[activeMenuIndex];

                                    return (
                                        <div className="w-full flex flex-col items-center">
                                            <TransformWrapper
                                                key={`${activeTab}-${activeMenuIndex}-${activeUrl}`}
                                                initialScale={1}
                                                minScale={1}
                                                maxScale={4}
                                                centerOnInit={true}
                                            >
                                                {({ zoomIn, zoomOut, resetTransform }) => (
                                                    <div className="w-full flex flex-col items-center">
                                                        <div className="flex items-center justify-between w-full mb-3 px-1 text-neutral-600 bg-[var(--color-hallmark-paper-dark)] p-1.5 rounded-sm border border-[var(--color-hallmark-rule)]">
                                                            <div className="flex items-center gap-1">
                                                                <button type="button" onClick={() => zoomIn()} className="w-7 h-7 rounded-sm flex items-center justify-center hover:bg-[var(--color-hallmark-paper)] text-neutral-800 transition-all cursor-pointer border border-[var(--color-hallmark-rule)] bg-transparent"><ZoomIn size={12} /></button>
                                                                <button type="button" onClick={() => zoomOut()} className="w-7 h-7 rounded-sm flex items-center justify-center hover:bg-[var(--color-hallmark-paper)] text-neutral-800 transition-all cursor-pointer border border-[var(--color-hallmark-rule)] bg-transparent"><ZoomOut size={12} /></button>
                                                                <button type="button" onClick={() => resetTransform()} className="w-7 h-7 rounded-sm flex items-center justify-center hover:bg-[var(--color-hallmark-paper)] text-neutral-800 transition-all cursor-pointer border border-[var(--color-hallmark-rule)] bg-transparent"><RefreshCw size={10} /></button>
                                                            </div>
                                                            <span className="text-[10px] font-bold text-[var(--color-hallmark-ink)] font-mono px-2">
                                                                PAGE {activeMenuIndex + 1} / {currentImages.length}
                                                            </span>
                                                        </div>

                                                        <div className="relative w-full aspect-[4/5] rounded-sm overflow-hidden border border-[var(--color-hallmark-rule)] bg-neutral-50 cursor-grab active:cursor-grabbing">
                                                            {menuImageLoading && (
                                                                <div className="absolute inset-0 bg-neutral-100 flex items-center justify-center">
                                                                    <div className="w-5 h-5 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                                                                </div>
                                                            )}
                                                            <TransformComponent wrapperClass="w-full h-full" contentClass="w-full h-full flex items-center justify-center">
                                                                  <img
                                                                      src={optimizeImageUrl(activeUrl, 900)}
                                                                      alt={`Menu Page ${activeMenuIndex + 1}`}
                                                                      onLoad={() => setMenuImageLoading(false)}
                                                                      className={`w-full h-full object-contain transition-opacity duration-300 ${menuImageLoading ? 'opacity-0' : 'opacity-100'}`}
                                                                  />
                                                            </TransformComponent>
                                                        </div>
                                                    </div>
                                                )}
                                            </TransformWrapper>

                                            {/* Navigation Controls */}
                                            <div className="flex items-center justify-between w-full mt-4">
                                                <button
                                                    disabled={activeMenuIndex === 0}
                                                    onClick={() => {
                                                        setActiveMenuIndex(prev => Math.max(0, prev - 1));
                                                        setMenuImageLoading(true);
                                                    }}
                                                    className="w-8 h-8 rounded-sm border border-[var(--color-hallmark-rule)] flex items-center justify-center text-[var(--color-hallmark-ink-muted)] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-100/50 active:scale-95 transition-all cursor-pointer bg-transparent"
                                                >
                                                    <ChevronLeft size={16} />
                                                </button>
                                                
                                                <div className="flex gap-1 overflow-x-auto max-w-[180px] no-scrollbar py-1">
                                                    {currentImages.map((_, i) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => {
                                                                setActiveMenuIndex(i);
                                                                setMenuImageLoading(true);
                                                            }}
                                                            className={`w-1.5 h-1.5 rounded-full transition-all flex-shrink-0 ${activeMenuIndex === i ? 'bg-[var(--color-brand)] scale-110' : 'bg-[var(--color-hallmark-rule)] opacity-40 hover:opacity-100'}`}
                                                        />
                                                    ))}
                                                </div>

                                                <button
                                                    disabled={activeMenuIndex === currentImages.length - 1}
                                                    onClick={() => {
                                                        setActiveMenuIndex(prev => Math.min(currentImages.length - 1, prev + 1));
                                                        setMenuImageLoading(true);
                                                    }}
                                                    className="w-8 h-8 rounded-sm border border-[var(--color-hallmark-rule)] flex items-center justify-center text-[var(--color-hallmark-ink-muted)] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-100/50 active:scale-95 transition-all cursor-pointer bg-transparent"
                                                >
                                                    <ChevronRight size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        ) : selectedLightbox.type === 'checkin' ? (
                            <div 
                                className="w-full max-w-sm bg-[var(--color-hallmark-paper)] rounded-sm p-4 border border-[var(--color-hallmark-ink)] flex flex-col z-40 relative my-8 text-[var(--color-hallmark-ink)] cursor-default select-text" 
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex justify-between items-center w-full mb-3 pb-2 border-b border-[var(--color-hallmark-rule)]">
                                    <span className="font-mono text-[9px] font-bold text-[var(--color-brand)] uppercase tracking-wider">
                                        // CUSTOMER CHECK-IN
                                    </span>
                                    <button 
                                        onClick={() => setSelectedLightbox(null)}
                                        className="text-[9px] font-mono font-bold hover:text-[var(--color-brand)] cursor-pointer text-[var(--color-hallmark-ink)] bg-transparent border-0 outline-none"
                                    >
                                        [ CLOSE ]
                                    </button>
                                </div>

                                {/* Header with customer name and platform */}
                                <div className="flex items-center justify-between gap-3 mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] text-white font-mono font-bold">
                                            {selectedLightbox.item.user_name?.slice(0, 1).toUpperCase() || 'C'}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold font-mono tracking-tight leading-none">
                                                {selectedLightbox.item.user_name || 'Customer'}
                                            </span>
                                            {selectedLightbox.item.user_username && (
                                                <span className="text-[9px] text-[var(--color-hallmark-ink-muted)] leading-none mt-0.5">
                                                    @{selectedLightbox.item.user_username}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 bg-neutral-100 px-2 py-0.5 rounded-sm border border-[var(--color-hallmark-rule)]">
                                        {selectedLightbox.item.source === 'instagram' && <Instagram size={10} className="text-[#E1306C]" />}
                                        {selectedLightbox.item.source === 'facebook' && <Facebook size={10} className="text-[#1877F2]" />}
                                        {selectedLightbox.item.source === 'google' && <Star size={10} className="text-[#F4B400] fill-[#F4B400]" />}
                                        <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-neutral-600">
                                            {selectedLightbox.item.source}
                                        </span>
                                    </div>
                                </div>

                                {/* Main image */}
                                <div className="relative w-full aspect-[4/5] rounded-sm overflow-hidden border border-[var(--color-hallmark-rule)] bg-black mb-3">
                                    <img 
                                        src={optimizeImageUrl(selectedLightbox.item.image_url, 600)} 
                                        alt="Customer Check-in" 
                                        className="w-full h-full object-cover"
                                    />
                                </div>

                                {/* Review content */}
                                {selectedLightbox.item.text && (
                                    <p className="text-[11px] text-[var(--color-hallmark-ink)] leading-relaxed italic border-l-2 border-[var(--color-brand)] pl-2 mb-4 font-medium font-[var(--font-body)]">
                                        "{selectedLightbox.item.text}"
                                    </p>
                                )}

                                {/* Check-in Wall CTA */}
                                <a 
                                    href="/link/hauscheckin"
                                    className="w-full bg-[var(--color-brand)] text-neutral-900 border border-[var(--color-hallmark-rule)] rounded-sm py-2.5 flex items-center justify-center gap-1.5 font-mono text-[9px] font-extrabold tracking-wider uppercase hover:opacity-90 transition-all cursor-pointer mt-2 text-center"
                                >
                                    <Compass size={11} />
                                    <span>เข้าสู่บอร์ดเช็กอินแบบลากซูม (ชมรูปเพิ่ม)</span>
                                </a>
                            </div>
                        ) : (
                            <motion.img
                                initial={{ scale: 0.95 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0.95 }}
                                src={optimizeImageUrl(selectedLightbox.url, 1200)}
                                alt="Zoomed View"
                                className="max-w-full max-h-[85vh] object-contain rounded-sm border border-[var(--color-hallmark-rule)] bg-black"
                                onClick={(e) => e.stopPropagation()}
                            />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── VERCEL ANALYTICS ─── */}
            <Analytics />

        </div>
    );
}

// ─── HELPER SUB-COMPONENTS ───

// Menu List Item Component
function MenuListItem({ item, index, onImageClick }) {
    const isRecommended = item.is_recommended === true;
    return (
        <div className="flex items-center justify-between gap-4 py-3 border-b border-[var(--color-hallmark-rule)] last:border-0 group">
            <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-1.5">
                    <h4 className="font-[var(--font-body)] font-bold text-xs text-[var(--color-hallmark-ink)] tracking-tight group-hover:text-[var(--color-brand)] transition-colors duration-150">
                        {item.name}
                    </h4>
                    {isRecommended && (
                        <span className="text-[8px] font-mono bg-[var(--color-brand)] text-white font-bold px-1.5 py-0.2 rounded-sm uppercase tracking-wider scale-95">
                            BOLD
                        </span>
                    )}
                </div>
                {item.description && (
                    <p className="text-[var(--color-hallmark-ink-muted)] text-[11px] mt-0.5 leading-normal line-clamp-2 pr-2 font-medium">
                        {item.description}
                    </p>
                )}
            </div>
            
            <div className="flex items-center gap-3 flex-shrink-0">
                <span className="font-mono font-bold text-xs text-[var(--color-hallmark-ink)]">฿{item.price}</span>
                
                {item.image_url && (
                    <div 
                        onClick={() => onImageClick(item.image_url)}
                        className="w-12 h-12 rounded-sm overflow-hidden bg-neutral-100 border border-[var(--color-hallmark-ink)] cursor-zoom-in relative hover:scale-105 transition-transform duration-200 ease-out flex-shrink-0"
                    >
                        <img 
                            src={optimizeImageUrl(item.image_url, 120)} 
                            alt={item.name} 
                            className="w-full h-full object-cover"
                            loading={index !== undefined && index < 3 ? undefined : "lazy"}
                            fetchPriority={index !== undefined && index < 3 ? "high" : undefined}
                            decoding="async"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

// Link Card Component (Dieter Rams Style)
function LinkCard({ href, icon, title, bg, wide = false, internal = false, id, onClick }) {
    return (
        <a
            href={href}
            id={id}
            onClick={onClick}
            target={internal ? "_self" : "_blank"}
            rel={internal ? undefined : "noopener noreferrer"}
            className={`${bg} rounded-sm py-3 px-4 flex items-center justify-center gap-2 transition-all cursor-pointer ${wide ? 'w-full' : 'flex-1'} font-mono text-[10px] font-bold tracking-wider`}
        >
            {icon}
            <span className="whitespace-nowrap">{title}</span>
        </a>
    );
}
