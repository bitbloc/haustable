import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, MapPin, MessageCircle, Utensils, HelpCircle, Clock, Navigation, Phone, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2, RefreshCw, ZoomIn as ZoomInIcon } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { supabase } from './lib/supabaseClient';

const FALLBACK_HERO = "https://images.unsplash.com/photo-1559314809-0d155014e29e?q=80&w=800&auto=format&fit=crop";

const optimizeImageUrl = (url, width = 850) => {
    if (!url) return '';
    if (url.includes('supabase.co/storage/v1/object/public/')) {
        return `${url}?width=${width}&quality=80`;
    }
    return url;
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
    const [loading, setLoading] = useState(true);
    const [selectedLightbox, setSelectedLightbox] = useState(null);
    const [activeMenuIndex, setActiveMenuIndex] = useState(0);
    const [menuImageLoading, setMenuImageLoading] = useState(true);
    const [showAllMenu, setShowAllMenu] = useState(false);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [settingsRes, itemsRes, catsRes] = await Promise.all([
                supabase.from('app_settings').select('*').like('key', 'link_%'),
                supabase.from('menu_items').select('*').eq('is_available', true),
                supabase.from('menu_categories').select('*').order('display_order')
            ]);

            if (settingsRes.data) {
                const map = settingsRes.data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
                setSettings(map);

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

                if (regularUrls.length === 0 && promoUrls.length > 0) {
                    setActiveTab('promo');
                } else {
                    setActiveTab('regular');
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
            }

            if (catsRes.data) {
                setMenuCategories(catsRes.data);
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

    // Filter only recommended items for the initial presentation (10-15 items)
    const featuredMenuItems = menuItems.filter(item => item.is_recommended).slice(0, 15);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-neutral-800 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen bg-[#FAFAF7] text-neutral-900 overflow-x-hidden font-['IBM_Plex_Sans_Thai',sans-serif] relative pb-28">
            
            {/* Custom Embedded CSS for Micro-animations */}
            <style>{`
                @keyframes float {
                    0% { transform: translateY(0px); }
                    50% { transform: translateY(-10px); }
                    100% { transform: translateY(0px); }
                }
                .animate-float {
                    animation: float 6s ease-in-out infinite;
                }
                @keyframes steam-rise {
                    0% {
                        transform: translateY(0) scale(0.6) rotate(0deg);
                        opacity: 0;
                        filter: blur(3px);
                    }
                    20% {
                        opacity: 0.5;
                        filter: blur(4px);
                    }
                    50% {
                        transform: translateY(-40px) scale(1.1) rotate(5deg);
                        opacity: 0.3;
                        filter: blur(6px);
                    }
                    80% {
                        opacity: 0.1;
                        filter: blur(8px);
                    }
                    100% {
                        transform: translateY(-80px) scale(1.4) rotate(-5deg);
                        opacity: 0;
                        filter: blur(10px);
                    }
                }
                .steam-container {
                    position: absolute;
                    left: 0;
                    right: 0;
                    top: -24px;
                    display: flex;
                    justify-content: center;
                    gap: 8px;
                    pointer-events: none;
                    z-index: 20;
                }
                .steam-particle-1 {
                    width: 6px;
                    height: 30px;
                    background: rgba(140, 140, 140, 0.4);
                    border-radius: 9999px;
                    animation: steam-rise 3s infinite ease-in-out;
                    animation-delay: 0s;
                }
                .steam-particle-2 {
                    width: 8px;
                    height: 40px;
                    background: rgba(120, 120, 120, 0.3);
                    border-radius: 9999px;
                    animation: steam-rise 3.4s infinite ease-in-out;
                    animation-delay: 0.7s;
                }
                .steam-particle-3 {
                    width: 5px;
                    height: 25px;
                    background: rgba(130, 130, 130, 0.35);
                    border-radius: 9999px;
                    animation: steam-rise 2.8s infinite ease-in-out;
                    animation-delay: 1.4s;
                }
                @keyframes leaf-sway {
                    0% { transform: translate(0, 0) rotate(0deg); }
                    50% { transform: translate(4px, 6px) rotate(8deg); }
                    100% { transform: translate(0, 0) rotate(0deg); }
                }
                .leaf-sway {
                    animation: leaf-sway 4s ease-in-out infinite;
                }
                @keyframes marquee {
                    0% { transform: translateX(0%); }
                    100% { transform: translateX(-50%); }
                }
                .animate-marquee {
                    animation: marquee 45s linear infinite;
                }
            `}</style>

            {/* ─── KINETIC TYPOGRAPHY (Background Layer) ─── */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-[0.06] select-none pt-24">
                <div className="sticky top-20 space-y-12">
                    <div className="marquee-container flex overflow-hidden white-space-nowrap">
                        <div className="marquee-content animate-marquee flex gap-8 text-[9rem] font-black uppercase tracking-tighter text-transparent" style={{ WebkitTextStroke: '2px #111111' }}>
                            <span>IN THE HAUS · WE MAKE IT BOLD · จริตจัด รสชัดเจน · SOUTHERN TASTE · </span>
                            <span>IN THE HAUS · WE MAKE IT BOLD · จริตจัด รสชัดเจน · SOUTHERN TASTE · </span>
                        </div>
                    </div>
                    <div className="marquee-container flex overflow-hidden white-space-nowrap">
                        <div className="marquee-content animate-marquee flex gap-8 text-[7rem] font-black uppercase tracking-tighter text-transparent" style={{ WebkitTextStroke: '2px #111111', animationDirection: 'reverse', animationDuration: '55s' }}>
                            <span>REAL ATTITUDE · CLEAR TASTE · อร่อยปากลำบากทวาร · แซ่บหรอยแรง · </span>
                            <span>REAL ATTITUDE · CLEAR TASTE · อร่อยปากลำบากทวาร · แซ่บหรอยแรง · </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── FLOATING FOOD PLATES (Responsive & Layered with visible steam) ─── */}
            {/* Desktop-only floating plates in margins (Larger size with closer horizontal offsets for organic overlap) */}
            <FloatingPlate src="/assets/food-green-curry.webp" alt="แกงเขียวหวาน" top="12%" left="calc(50% - 310px)" size="w-44 lg:w-56" delay={0} />
            <FloatingPlate src="/assets/food-beef-curry-1.webp" alt="แกงเนื้อเผ็ด" top="24%" right="calc(50% - 320px)" size="w-48 lg:w-60" delay={1.5} hasSteam />
            <FloatingPlate src="/assets/food-pork-belly.webp" alt="หมูสามชั้นย่าง" top="38%" left="calc(50% - 330px)" size="w-44 lg:w-56" delay={0.8} hasSteam />
            <FloatingPlate src="/assets/food-beef-rice.webp" alt="ข้าวหน้าเนื้อ" top="50%" right="calc(50% - 310px)" size="w-44 lg:w-56" delay={2.2} />
            <FloatingPlate src="/assets/food-chicken-curry.webp" alt="มัสมั่นไก่" top="65%" left="calc(50% - 320px)" size="w-48 lg:w-60" delay={1.2} hasSteam />
            <FloatingPlate src="/assets/food-pouring-curry.webp" alt="ราดแกงเขียวหวาน" top="76%" right="calc(50% - 330px)" size="w-52 lg:w-64" delay={0.4} />
            <FloatingPlate src="/assets/food-fried-garlic-pork.webp" alt="คั่วกลิ้งหมูกรอบ" top="88%" left="calc(50% - 310px)" size="w-48 lg:w-60" delay={2.8} />

            {/* Mobile-only floating plates (Slightly larger, overlapping content cards for depth) */}
            <FloatingPlate src="/assets/food-green-curry.webp" alt="แกงเขียวหวาน" top="8%" right="-4.5rem" size="w-36" delay={0} isMobile opacity={0.85} />
            <FloatingPlate src="/assets/food-pouring-curry.webp" alt="ราดแกงเขียวหวาน" top="28%" left="-5rem" size="w-40" delay={1.5} isMobile opacity={0.85} hasSteam />
            <FloatingPlate src="/assets/food-pork-belly.webp" alt="หมูสามชั้นย่าง" top="48%" right="-4.5rem" size="w-36" delay={0.8} isMobile opacity={0.85} hasSteam />
            <FloatingPlate src="/assets/food-chicken-curry.webp" alt="มัสนั่นไก่" top="68%" left="-4.5rem" size="w-40" delay={2.2} isMobile opacity={0.85} hasSteam />

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
                    "telephone": "098-528-4217",
                    "openingHoursSpecification": {
                        "@type": "OpeningHoursSpecification",
                        "dayOfWeek": [
                            "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
                        ],
                        "opens": "11:30",
                        "closes": "23:30"
                    }
                })}
            </script>

            <div className="w-full max-w-lg mx-auto px-5 relative z-10">
                
                {/* ─── HEADER: LOGO + IDENTITY ─── */}
                <header className="pt-10 pb-4">
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="flex items-center gap-4"
                    >
                        {/* Logo */}
                        {logoUrl ? (
                            <img
                                src={optimizeImageUrl(logoUrl, 160)}
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
                            <h1 className="text-xl font-black text-neutral-900 leading-tight tracking-tight uppercase">
                                {shopName}
                            </h1>
                            <p className="text-neutral-600 font-extrabold text-sm mt-0.5">{shopNameTh}</p>
                            <div className="flex items-center gap-1.5 mt-1 text-neutral-500 text-xs font-bold">
                                <Clock size={12} className="text-neutral-400" />
                                <span>{hours}</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Subtitle */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-xs text-neutral-500 mt-4 tracking-wide font-mono font-bold leading-relaxed border-l-2 border-neutral-900 pl-3 py-0.5"
                    >
                        {subtitle}
                    </motion.p>
                </header>

                {/* ─── FEATURED SIGNATURE DISHES (Pop-Culture Style at Top) ─── */}
                {signatures.length > 0 && (
                    <section className="w-full mt-6 bg-white rounded-3xl p-5 border-2 border-neutral-900 shadow-[6px_6px_0px_#111111] relative z-10">
                        <div className="text-center mb-6 py-1.5 border-b-2 border-neutral-900 relative">
                            {/* Sticker style tag for signature dishes */}
                            <span className="bg-[#FF453A] text-white text-xs font-black tracking-wide px-4 py-2 border-2 border-neutral-900 inline-block shadow-[3px_3px_0px_#111111] transform -rotate-2 select-none rounded-md">
                                ★ เมนูแนะนำเด็ดห้ามพลาด ★
                            </span>
                            <h2 className="text-neutral-950 text-[11px] font-black tracking-[0.2em] font-mono uppercase mt-4">Signature Dishes</h2>
                        </div>

                        <div className={`grid gap-4 ${signatures.length === 1 ? 'grid-cols-1' : signatures.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                            {signatures.map((dish, i) => (
                                <SignatureDishCard key={i} dish={dish} index={i} />
                            ))}
                        </div>
                    </section>
                )}

                {/* ─── NATIVE FEATURED DISHES (10-15 Recommended Items) ─── */}
                {featuredMenuItems.length > 0 && (
                    <section className="w-full mt-6 bg-white rounded-3xl p-5 border-2 border-neutral-900 shadow-[6px_6px_0px_#111111] relative z-10">
                        <div className="text-center mb-6 py-1.5 border-b-2 border-neutral-900 relative">
                            {/* Yellow Category Tag styled as sticker */}
                            <span className="bg-[#DFFF00] text-neutral-900 text-xs font-black tracking-wide px-4.5 py-2 border-2 border-neutral-900 inline-block shadow-[4px_4px_0px_#111111] transform -rotate-3 select-none rounded-md hover:rotate-0 transition-transform">
                                ✦ เมนูยอดฮิตจริตจัด รสชัดเจน ✦
                            </span>
                            <h2 className="text-neutral-950 text-[11px] font-black tracking-[0.2em] font-mono uppercase mt-4">Featured Specialties</h2>
                        </div>

                        <div className="space-y-4">
                            {featuredMenuItems.map((item, idx) => (
                                <MenuListItem key={item.id} item={item} index={idx} onImageClick={(url) => setSelectedLightbox({ type: 'menu', url })} />
                            ))}
                        </div>

                        {/* Accordion CTA Button */}
                        <div className="mt-6 text-center pt-4 border-t-2 border-dashed border-neutral-200">
                            <button
                                onClick={() => setShowAllMenu(!showAllMenu)}
                                className="inline-flex items-center gap-2 px-6 py-3.5 bg-neutral-900 text-white rounded-2xl hover:bg-neutral-800 border-2 border-neutral-900 shadow-[4px_4px_0px_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all text-xs font-black cursor-pointer"
                            >
                                <span>{showAllMenu ? "▲ ปิดเมนูทั้งหมด" : "▼ ดูเมนูทั้งหมด (80+ รายการ)"}</span>
                            </button>
                        </div>
                    </section>
                )}

                {/* ─── FULL MENU ACCORDION CONTENT ─── */}
                <AnimatePresence>
                    {showAllMenu && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.4, ease: 'easeInOut' }}
                            className="w-full mt-4 space-y-6 overflow-hidden relative z-10"
                        >
                            {menuCategories.map((category) => {
                                // Get items in this category
                                const categoryItems = menuItems.filter(item => item.category_id === category.id);
                                if (categoryItems.length === 0) return null;

                                return (
                                    <div key={category.id} className="bg-white rounded-3xl p-5 border-2 border-neutral-900 shadow-[6px_6px_0px_#111111]">
                                        <div className="mb-4 pb-2 border-b-2 border-neutral-900 flex justify-between items-center relative">
                                            {/* Sticker Badge style category tag */}
                                            <span className="bg-[#DFFF00] text-neutral-900 text-xs font-black tracking-wide px-3.5 py-2 border-2 border-neutral-900 inline-block transform -rotate-2 select-none shadow-[3px_3px_0px_#111111] rounded-md">
                                                ★ {category.name}
                                            </span>
                                            <span className="text-[10px] font-black text-neutral-500 font-mono">
                                                {categoryItems.length} รายการ
                                            </span>
                                        </div>
                                        <div className="space-y-3">
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



                {/* ─── ATMOSPHERE VIBES ─── */}
                {atmImages.length > 0 && (
                    <section className="mt-8">
                        <div className="mb-3 flex items-end justify-between">
                            <div>
                                <h2 className="text-neutral-800 text-base font-black tracking-tight">สัมผัสบรรยากาศในบ้าน</h2>
                                <p className="text-neutral-500 text-[10px] font-mono tracking-wider uppercase mt-0.5 font-bold">Experience the Vibe</p>
                            </div>
                            <span className="text-[10px] text-neutral-400 font-bold animate-pulse">Swipe ➔</span>
                        </div>
                        
                        <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-4 no-scrollbar">
                            {atmImages.map((url, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    whileInView={{ opacity: 1, scale: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.4, delay: i * 0.05 }}
                                    onClick={() => setSelectedLightbox({ type: 'atm', url })}
                                    className="flex-none w-[75%] max-w-[260px] snap-center rounded-3xl overflow-hidden shadow-sm border border-neutral-100 aspect-square cursor-pointer"
                                >
                                    <img 
                                        src={optimizeImageUrl(url, 600)} 
                                        alt={`Atmosphere ${i + 1}`} 
                                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" 
                                        loading="lazy"
                                    />
                                </motion.div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ─── SOCIAL LINKS ─── */}
                <section className="mt-6 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <LinkCard 
                            href="https://maps.app.goo.gl/fYp7pp9b4zE6oFiKA?g_st=ic" 
                            icon={<MapPin size={16} />} 
                            title="แผนที่นำทางมาร้าน (Google Maps)" 
                            bg="bg-[#4A4A4A] hover:bg-[#3A3A3A] text-white transition-colors" 
                            wide 
                            id="cta-maps" 
                        />
                        <LinkCard 
                            href="https://www.facebook.com/inthehausth" 
                            icon={<ExternalLink size={14} className="text-neutral-500" />} 
                            title="Facebook" 
                            bg="bg-white hover:bg-neutral-50 border border-neutral-200" 
                            textColor="text-neutral-700"
                            id="cta-facebook" 
                        />
                        <LinkCard 
                            href="https://instagram.com/inthehausth" 
                            icon={<ExternalLink size={14} className="text-neutral-500" />} 
                            title="Instagram" 
                            bg="bg-white hover:bg-neutral-50 border border-neutral-200" 
                            textColor="text-neutral-700"
                            id="cta-instagram" 
                        />
                    </div>

                    <div className="flex items-center gap-3 my-4">
                        <div className="h-px bg-neutral-200 flex-1" />
                        <span className="text-neutral-400 text-[9px] font-black tracking-[0.25em] font-mono uppercase">Delivery</span>
                        <div className="h-px bg-neutral-200 flex-1" />
                    </div>

                    <div className="grid grid-cols-1 gap-2.5">
                        <LinkCard href="https://lin.ee/8uqmIzZ" icon={<Utensils size={16} />} title="สั่งอาหารเดลิเวอรี Lineman" bg="bg-[#00B14F] hover:bg-[#009c45] text-white transition-colors" wide id="cta-lineman" />
                    </div>

                    <div className="pt-2">
                        <LinkCard href="/qa" icon={<HelpCircle size={16} />} title="Q&A ถาม-ตอบ ข้อมูลร้าน" bg="bg-[#636AA0] hover:bg-[#535987] text-white transition-colors" wide internal id="cta-qa" />
                    </div>
                </section>

                {/* ─── FIND US ─── */}
                <section className="mt-6">
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="bg-white rounded-3xl border border-neutral-100 p-5 shadow-soft"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-[10px] font-black text-neutral-400 tracking-[0.2em] font-mono uppercase mb-2">Find Us</p>
                                <p className="text-neutral-900 font-bold text-xs md:text-sm leading-relaxed">{locationText}</p>
                                <p className="text-neutral-700 text-xs font-bold mt-2">{hours}</p>
                            </div>
                            <a
                                href="https://maps.app.goo.gl/fYp7pp9b4zE6oFiKA?g_st=ic"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-shrink-0 w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-white hover:bg-neutral-700 transition-colors shadow-md"
                            >
                                <Navigation size={16} />
                            </a>
                        </div>
                    </motion.div>
                </section>

                {/* ─── ORIGINAL BOOKLET LINK (Minimalist Text Link) ─── */}
                {(promoMenuImages.length > 0 || regularMenuImages.length > 0) && (
                    <div className="mt-8 text-center">
                        <button
                            onClick={() => {
                                setSelectedLightbox({
                                    type: 'booklet_slider',
                                    urls: activeTab === 'promo' ? promoMenuImages : regularMenuImages
                                });
                            }}
                            className="inline-flex items-center gap-1.5 text-neutral-500 hover:text-neutral-950 font-black text-xs cursor-pointer group"
                        >
                            <span>ดูรูปเล่มเมนูฉบับดั้งเดิม (PDF)</span>
                            <span className="group-hover:translate-x-1 transition-transform">➔</span>
                        </button>
                    </div>
                )}

                {/* ─── ORIGINAL BOOKLET LINK (Minimalist Text Link) ─── */}
                {(promoMenuImages.length > 0 || regularMenuImages.length > 0) && (
                    <div className="mt-8 text-center">
                        <button
                            onClick={() => {
                                setSelectedLightbox({
                                    type: 'booklet_slider',
                                    urls: activeTab === 'promo' ? promoMenuImages : regularMenuImages
                                });
                            }}
                            className="inline-flex items-center gap-1.5 text-neutral-500 hover:text-neutral-950 font-black text-xs cursor-pointer group"
                        >
                            <span>ดูรูปเล่มเมนูฉบับดั้งเดิม (PDF)</span>
                            <span className="group-hover:translate-x-1 transition-transform">➔</span>
                        </button>
                    </div>
                )}

                {/* ─── TAGS ─── */}
                <section className="my-8">
                    <div className="flex flex-wrap justify-center gap-2">
                        {tags.map(tag => (
                            <span key={tag} className="px-3 py-1 bg-neutral-200/50 border border-neutral-200/20 text-neutral-500 rounded-full text-[10px] font-bold font-mono tracking-wide">
                                {tag}
                            </span>
                        ))}
                    </div>
                </section>

            </div>

            {/* ─── FOOTER ─── */}
            <footer className="bg-neutral-900 text-neutral-500 py-8 text-center text-[10px] font-mono tracking-widest absolute bottom-0 left-0 right-0">
                <p>© {new Date().getFullYear()} IN THE HAUS · NAKHON PHANOM</p>
            </footer>

            {/* ─── STICKY FLOATING CONTACT BAR (Mobile-First / Glassmorphism) ─── */}
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-[440px] px-4 py-3 bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] flex gap-3 pb-safe">
                <a 
                    href="https://lin.ee/EuzwG7c" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-1 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-xl py-3 px-4 flex items-center justify-center gap-2 text-xs font-black shadow-sm active:scale-97 transition-all cursor-pointer"
                >
                    <MessageCircle size={15} /> ทักแชต LINE
                </a>
                <a 
                    href="tel:0985284217" 
                    className="flex-1 bg-[#FF453A] hover:bg-[#e03a31] text-white rounded-xl py-3 px-4 flex items-center justify-center gap-2 text-xs font-black shadow-sm active:scale-97 transition-all cursor-pointer"
                >
                    <Phone size={15} /> โทรสั่ง / จองโต๊ะ
                </a>
            </div>

            {/* ─── SIMPLE LIGHTBOX ─── */}
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
                            className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 transition-colors rounded-full flex items-center justify-center text-white backdrop-blur-md cursor-pointer text-lg font-bold z-50 animate-pulse"
                        >
                            ✕
                        </button>

                        {selectedLightbox.type === 'booklet_slider' ? (
                            <div 
                                className="w-full max-w-lg bg-white rounded-3xl p-5 border-2 border-neutral-900 shadow-2xl flex flex-col items-center z-40 relative my-8" 
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="text-center mb-4 pb-2 border-b-2 border-neutral-900 w-full">
                                    <span className="bg-[#DFFF00] text-neutral-900 text-[10px] font-black tracking-[0.25em] uppercase px-3 py-1.5 rounded-full inline-block border-2 border-neutral-900">
                                        เล่มเมนูดั้งเดิม
                                    </span>
                                </div>

                                {/* Tab Switcher inside Modal */}
                                <div className="flex gap-2 p-1 bg-neutral-100 rounded-2xl mb-4 w-full text-xs font-bold border border-neutral-200/40">
                                    {regularMenuImages.length > 0 && (
                                        <button
                                            onClick={() => {
                                                setActiveTab('regular');
                                                setActiveMenuIndex(0);
                                                setMenuImageLoading(true);
                                            }}
                                            className={`flex-1 py-2.5 px-4 rounded-xl text-center transition-all cursor-pointer font-black ${activeTab === 'regular' ? 'bg-white text-neutral-900 shadow-sm border border-neutral-200' : 'text-neutral-500 hover:text-neutral-900'}`}
                                        >
                                            📖 เมนูหลัก
                                        </button>
                                    )}
                                    {promoMenuImages.length > 0 && (
                                        <button
                                            onClick={() => {
                                                setActiveTab('promo');
                                                setActiveMenuIndex(0);
                                                setMenuImageLoading(true);
                                            }}
                                            className={`flex-1 py-2.5 px-4 rounded-xl text-center transition-all cursor-pointer font-black ${activeTab === 'promo' ? 'bg-red-50 text-red-600 shadow-sm border border-red-100/50' : 'text-neutral-500 hover:text-red-600'}`}
                                        >
                                            🔥 โปรโมชั่น
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
                                                        <div className="flex items-center justify-between w-full mb-3 px-1 text-neutral-600 bg-neutral-100 p-1 rounded-xl border border-neutral-200 shadow-sm">
                                                            <div className="flex items-center gap-1">
                                                                <button type="button" onClick={() => zoomIn()} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white text-neutral-800 transition-all cursor-pointer"><ZoomIn size={14} /></button>
                                                                <button type="button" onClick={() => zoomOut()} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white text-neutral-800 transition-all cursor-pointer"><ZoomOut size={14} /></button>
                                                                <button type="button" onClick={() => resetTransform()} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white text-neutral-800 transition-all cursor-pointer"><RefreshCw size={11} /></button>
                                                            </div>
                                                            <span className="text-[10px] font-black text-neutral-600 font-mono px-2">
                                                                หน้า ${activeMenuIndex + 1} / ${currentImages.length}
                                                            </span>
                                                        </div>

                                                        <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden shadow-inner border border-neutral-200 bg-neutral-50 cursor-grab active:cursor-grabbing">
                                                            {menuImageLoading && (
                                                                <div className="absolute inset-0 bg-neutral-100 animate-pulse flex items-center justify-center">
                                                                    <div className="w-6 h-6 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
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
                                                    className="w-9 h-9 rounded-full border border-neutral-300 flex items-center justify-center text-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-100 active:scale-95 transition-all cursor-pointer"
                                                >
                                                    <ChevronLeft size={18} />
                                                </button>
                                                
                                                <div className="flex gap-1.5 overflow-x-auto max-w-[180px] no-scrollbar py-1">
                                                    {currentImages.map((_, i) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => {
                                                                setActiveMenuIndex(i);
                                                                setMenuImageLoading(true);
                                                            }}
                                                            className={`w-2 h-2 rounded-full transition-all flex-shrink-0 ${activeMenuIndex === i ? 'bg-neutral-900 scale-110' : 'bg-neutral-300 opacity-40 hover:opacity-100'}`}
                                                        />
                                                    ))}
                                                </div>

                                                <button
                                                    disabled={activeMenuIndex === currentImages.length - 1}
                                                    onClick={() => {
                                                        setActiveMenuIndex(prev => Math.min(currentImages.length - 1, prev + 1));
                                                        setMenuImageLoading(true);
                                                    }}
                                                    className="w-9 h-9 rounded-full border border-neutral-300 flex items-center justify-center text-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-100 active:scale-95 transition-all cursor-pointer"
                                                >
                                                    <ChevronRight size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        ) : (
                            <motion.img
                                initial={{ scale: 0.9 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0.9 }}
                                src={optimizeImageUrl(selectedLightbox.url, 1200)}
                                alt="Zoomed View"
                                className="max-w-full max-h-[85vh] object-contain rounded-2xl"
                                onClick={(e) => e.stopPropagation()}
                            />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
}

// ─── HELPER SUB-COMPONENTS ───

// Floating Plate Component for Margins (with customized visible dark steam particles)
function FloatingPlate({ src, alt, top, left, right, size = "w-36", delay = 0, hasSteam = false, isMobile = false, opacity = 1 }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: opacity, scale: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.8, delay }}
            style={{ top, left, right }}
            className={`absolute pointer-events-none select-none z-20 ${size} ${isMobile ? 'md:hidden' : 'hidden md:block'}`}
        >
            <div className="relative animate-float" style={{ animationDelay: `${delay}s` }}>
                <img
                    src={src}
                    alt={alt}
                    className="w-full h-auto drop-shadow-[0_10px_20px_rgba(0,0,0,0.12)] hover:scale-105 transition-transform duration-500"
                />
                
                {/* Simulated hot steam particles (Using visible dark neutral gray with blur for light background) */}
                {hasSteam && (
                    <div className="steam-container">
                        <div className="steam-particle-1" />
                        <div className="steam-particle-2" />
                        <div className="steam-particle-3" />
                    </div>
                )}
            </div>
        </motion.div>
    );
}

// Menu List Item Component
function MenuListItem({ item, index, onImageClick }) {
    const isRecommended = item.is_recommended === true;
    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3) }}
            className="flex items-center justify-between gap-4 py-3.5 border-b-2 border-neutral-900 last:border-0 group"
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-1.5">
                    <h4 className="font-black text-sm text-neutral-900 tracking-tight group-hover:text-neutral-600 transition-colors">
                        {item.name}
                    </h4>
                    {isRecommended && (
                        <span className="text-[9px] bg-neutral-900 text-[#DFFF00] font-black px-1.5 py-0.5 rounded tracking-wider uppercase leading-none scale-90 border border-neutral-900">
                            BOLD
                        </span>
                    )}
                </div>
                {item.description && (
                    <p className="text-neutral-400 text-xs mt-1 leading-relaxed line-clamp-2 pr-2 font-bold">
                        {item.description}
                    </p>
                )}
            </div>
            
            <div className="flex items-center gap-3 flex-shrink-0">
                <span className="font-mono font-black text-sm text-neutral-900">฿{item.price}</span>
                
                {item.image_url && (
                    <div 
                        onClick={() => onImageClick(item.image_url)}
                        className="w-14 h-14 rounded-xl overflow-hidden bg-neutral-100 border-2 border-neutral-900 shadow-[2px_2px_0px_#111111] cursor-zoom-in relative group-hover:scale-105 transition-transform duration-300 flex-shrink-0"
                    >
                        <img 
                            src={optimizeImageUrl(item.image_url, 150)} 
                            alt={item.name} 
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ZoomInIcon size={12} className="text-white" />
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

// Signature Dish Card
function SignatureDishCard({ dish, index }) {
    const [isLoaded, setIsLoaded] = useState(false);
    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: index * 0.05 }}
            className="rounded-2xl overflow-hidden bg-white border-2 border-neutral-900 shadow-[4px_4px_0px_#111111] flex flex-col h-full hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_#111111] transition-all group cursor-pointer"
        >
            <div className="aspect-square overflow-hidden relative bg-neutral-50 border-b-2 border-neutral-900">
                {!isLoaded && (
                    <div className="absolute inset-0 bg-neutral-100 animate-pulse flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-neutral-300 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
                <img
                    src={optimizeImageUrl(dish.img, 400)}
                    alt={dish.name}
                    loading="lazy"
                    onLoad={() => setIsLoaded(true)}
                    className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                />
            </div>
            {(dish.name || dish.price) && (
                <div className="p-3 flex-1 flex flex-col justify-between bg-white">
                    {dish.name && <p className="text-xs font-black text-neutral-900 leading-snug tracking-tight">{dish.name}</p>}
                    {dish.price && <p className="text-[11px] text-neutral-900 font-mono font-black mt-1">฿{dish.price}</p>}
                </div>
            )}
        </motion.div>
    );
}

// Link Card Component
function LinkCard({ href, icon, title, bg, wide = false, internal = false, id, textColor = "text-white" }) {
    return (
        <a
            href={href}
            id={id}
            target={internal ? "_self" : "_blank"}
            rel={internal ? undefined : "noopener noreferrer"}
            className={`${bg} ${textColor} rounded-2xl p-4 flex items-center justify-center gap-2.5 shadow-sm active:scale-97 hover:scale-[1.01] transition-all cursor-pointer ${wide ? 'col-span-full' : ''} text-xs font-black`}
        >
            {icon}
            <span>{title}</span>
        </a>
    );
}
