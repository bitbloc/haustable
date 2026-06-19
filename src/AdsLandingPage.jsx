import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, MapPin, MessageCircle, Utensils, HelpCircle, Clock, Navigation, Phone, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2, RefreshCw, Copy, Check } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { toast } from 'sonner';

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
    const [menuItems, setMenuItems] = useState([]);
    const [menuCategories, setMenuCategories] = useState([]);
    const [promoCodes, setPromoCodes] = useState([]);
    const [activeTab, setActiveTab] = useState('menu'); // 'menu' or 'promo'
    const [showAllMenu, setShowAllMenu] = useState(false);
    const [atmImages, setAtmImages] = useState([]);
    const [signatures, setSignatures] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedLightbox, setSelectedLightbox] = useState(null);
    const [copiedCode, setCopiedCode] = useState(null);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [settingsRes, itemsRes, catsRes, promosRes] = await Promise.all([
                supabase.from('app_settings').select('*').like('key', 'link_%'),
                supabase.from('menu_items').select('*').eq('is_available', true),
                supabase.from('menu_categories').select('*').order('display_order'),
                supabase.from('promotion_codes').select('*').eq('is_active', true)
            ]);

            if (settingsRes.data) {
                const map = settingsRes.data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
                setSettings(map);

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

            if (promosRes.data) {
                setPromoCodes(promosRes.data);
            }

        } catch (err) {
            console.error('Failed to load link data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCopyCode = (code) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        toast.success(`คัดลอกโค้ดส่วนลด "${code}" เรียบร้อยแล้ว!`);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const logoUrl = settings.link_logo_url || '';
    const shopName = settings.link_shop_name || 'IN THE HAUS';
    const shopNameTh = settings.link_shop_name_th || 'ในบ้าน';
    const subtitle = settings.link_subtitle || 'จริตจัด รสชัดเจน · Bold Attitude, Clear Taste';
    const hours = settings.link_hours || 'เปิดทุกวัน 11:30 - 23:30 น. (ครัวปิด 22:00 น.)';
    const locationText = settings.link_location_text || 'ริมแม่น้ำโขง · นครพนม';
    const tags = (settings.link_tags || '#inthehausth, #homefood, #southernthaifood, #nakhonphanom').split(',').map(t => t.trim()).filter(Boolean);

    // Filter recommended items (limit to 12 items for clean design)
    const recommendedMenuItems = menuItems.filter(item => item.is_recommended).slice(0, 12);
    // If no recommended items, take first 12 items
    const displaySignatures = recommendedMenuItems.length > 0 ? recommendedMenuItems : menuItems.slice(0, 12);

    // Group items by category for the full menu
    const activeCategories = menuCategories.filter(cat => {
        const catItems = menuItems.filter(item => item.category_id === cat.id);
        return catItems.length > 0;
    });

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
                    0% { transform: translateY(0) scale(0.8); opacity: 0; }
                    10% { opacity: 0.35; }
                    50% { transform: translateY(-30px) scale(1.1); opacity: 0.18; }
                    100% { transform: translateY(-60px) scale(1.3); opacity: 0; }
                }
                .steam-particle {
                    animation: steam-rise 3s infinite ease-out;
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

            {/* ─── FLOATING FOOD PLATES (Responsive & Layered) ─── */}
            {/* Desktop-only floating plates in margins */}
            <FloatingPlate src="/assets/food-green-curry.webp" alt="แกงเขียวหวาน" top="12%" left="calc(50% - 380px)" size="w-32 lg:w-40" delay={0} hasLeaves />
            <FloatingPlate src="/assets/food-beef-curry-1.webp" alt="แกงเนื้อเผ็ด" top="24%" right="calc(50% - 390px)" size="w-36 lg:w-44" delay={1.5} hasSteam />
            <FloatingPlate src="/assets/food-pork-belly.webp" alt="หมูสามชั้นย่าง" top="38%" left="calc(50% - 410px)" size="w-32 lg:w-36" delay={0.8} hasSteam />
            <FloatingPlate src="/assets/food-beef-rice.webp" alt="ข้าวหน้าเนื้อ" top="50%" right="calc(50% - 380px)" size="w-32 lg:w-40" delay={2.2} />
            <FloatingPlate src="/assets/food-chicken-curry.webp" alt="มัสมั่นไก่" top="65%" left="calc(50% - 400px)" size="w-36 lg:w-44" delay={1.2} hasSteam />
            <FloatingPlate src="/assets/food-pouring-curry.webp" alt="ราดแกงเขียวหวาน" top="76%" right="calc(50% - 420px)" size="w-40 lg:w-48" delay={0.4} />
            <FloatingPlate src="/assets/food-fried-garlic-pork.webp" alt="คั่วกลิ้งหมูกรอบ" top="88%" left="calc(50% - 390px)" size="w-36 lg:w-40" delay={2.8} />

            {/* Mobile-only safe floating plates (Lower opacity, smaller, positioned to never cover text) */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 md:hidden">
                <motion.div 
                    initial={{ opacity: 0 }} 
                    whileInView={{ opacity: 0.12 }} 
                    viewport={{ once: true }}
                    className="absolute top-[8%] -right-10 w-24 animate-float"
                >
                    <img src="/assets/food-green-curry.webp" alt="" />
                </motion.div>
                <motion.div 
                    initial={{ opacity: 0 }} 
                    whileInView={{ opacity: 0.14 }} 
                    viewport={{ once: true }}
                    className="absolute top-[28%] -left-12 w-28 animate-float"
                    style={{ animationDelay: '1.5s' }}
                >
                    <img src="/assets/food-pouring-curry.webp" alt="" />
                </motion.div>
                <motion.div 
                    initial={{ opacity: 0 }} 
                    whileInView={{ opacity: 0.12 }} 
                    viewport={{ once: true }}
                    className="absolute top-[48%] -right-10 w-24 animate-float"
                    style={{ animationDelay: '0.8s' }}
                >
                    <img src="/assets/food-pork-belly.webp" alt="" />
                </motion.div>
                <motion.div 
                    initial={{ opacity: 0 }} 
                    whileInView={{ opacity: 0.15 }} 
                    viewport={{ once: true }}
                    className="absolute top-[68%] -left-8 w-28 animate-float"
                    style={{ animationDelay: '2.2s' }}
                >
                    <img src="/assets/food-tai-pla-curry.webp" alt="" />
                </motion.div>
            </div>

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

                {/* ─── MAIN ZONE (TABS) ─── */}
                <main className="mt-6">
                    
                    {/* Tab Switcher */}
                    <div className="flex gap-2 p-1.5 bg-neutral-200/40 backdrop-blur-sm rounded-2xl mb-6 text-xs font-black shadow-inner border border-neutral-200/20">
                        <button
                            onClick={() => setActiveTab('menu')}
                            className={`flex-1 py-3 px-4 rounded-xl text-center transition-all cursor-pointer ${activeTab === 'menu' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}
                        >
                            📖 เมนูยอดฮิต & ซิกเนเจอร์
                        </button>
                        <button
                            onClick={() => setActiveTab('promo')}
                            className={`flex-1 py-3 px-4 rounded-xl text-center transition-all cursor-pointer ${activeTab === 'promo' ? 'bg-red-50 text-red-600 shadow-sm border border-red-100/50' : 'text-neutral-500 hover:text-red-600'}`}
                        >
                            🔥 คูปอง & โปรโมชั่นพิเศษ
                        </button>
                    </div>

                    {/* TAB CONTENT: NATIVE MENU */}
                    {activeTab === 'menu' && (
                        <motion.section
                            key="menu-tab"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-soft"
                        >
                            {/* Copywriting Tagline */}
                            <div className="text-center mb-6 py-2 border-b-2 border-dashed border-neutral-100">
                                <span className="bg-[#DFFF00] text-neutral-900 text-[10px] font-black tracking-[0.25em] uppercase px-3 py-1.5 rounded-full inline-block shadow-sm">
                                    จริตจัด รสชัดเจน
                                </span>
                                <h2 className="text-neutral-800 text-[11px] font-bold tracking-[0.2em] font-mono uppercase mt-3">Signature Recommended</h2>
                            </div>

                            {/* Signatures List (Curated 10-15 dishes) */}
                            <div className="space-y-4">
                                {displaySignatures.map((item, idx) => (
                                    <MenuListItem key={item.id} item={item} index={idx} onImageClick={(url) => setSelectedLightbox({ type: 'menu', url })} />
                                ))}
                            </div>

                            {/* Accordion Menu Toggle */}
                            <div className="mt-8 pt-4 border-t border-neutral-100 flex flex-col items-center">
                                <button
                                    onClick={() => setShowAllMenu(!showAllMenu)}
                                    className="bg-neutral-900 hover:bg-neutral-800 text-white rounded-2xl py-3.5 px-6 flex items-center justify-center gap-2 text-xs font-black shadow-md active:scale-97 transition-all cursor-pointer"
                                >
                                    <Utensils size={14} className="text-[#DFFF00]" />
                                    <span>{showAllMenu ? "ซ่อนเมนูทั้งหมด" : "ดูเมนูเต็มทั้งหมด (80+ รายการ)"}</span>
                                </button>

                                <AnimatePresence>
                                    {showAllMenu && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.4, ease: "easeInOut" }}
                                            className="w-full overflow-hidden mt-6 space-y-8"
                                        >
                                            {activeCategories.map((cat) => {
                                                const catItems = menuItems.filter(item => item.category_id === cat.id);
                                                return (
                                                    <div key={cat.id} className="space-y-3">
                                                        <h3 className="text-sm font-black text-neutral-800 bg-neutral-50 px-3 py-2 rounded-xl border-l-4 border-neutral-900 tracking-wider">
                                                            {cat.name}
                                                        </h3>
                                                        <div className="space-y-3 px-1">
                                                            {catItems.map((item, itemIdx) => (
                                                                <MenuListItem key={item.id} item={item} index={itemIdx} onImageClick={(url) => setSelectedLightbox({ type: 'menu', url })} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.section>
                    )}

                    {/* TAB CONTENT: PROMOTIONS */}
                    {activeTab === 'promo' && (
                        <motion.section
                            key="promo-tab"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-4"
                        >
                            {/* Promo coupon codes */}
                            {promoCodes.length > 0 ? (
                                <div className="space-y-4">
                                    <h2 className="text-neutral-700 text-xs font-black tracking-widest uppercase font-mono pl-1">Active Coupon Vouchers</h2>
                                    {promoCodes.map((code) => (
                                        <div 
                                            key={code.id}
                                            className="bg-white border border-dashed border-red-200 rounded-3xl p-5 shadow-soft relative overflow-hidden flex flex-col gap-3"
                                        >
                                            {/* Punch holes styling */}
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-6 bg-[#FAFAF7] rounded-r-full border-r border-y border-red-200/50" />
                                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-6 bg-[#FAFAF7] rounded-l-full border-l border-y border-red-200/50" />
                                            
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="bg-red-50 text-red-600 text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider">
                                                        {code.applicable_to === 'both' ? 'ทุกบริการ' : code.applicable_to === 'booking' ? 'จองโต๊ะ' : 'สั่งอาหาร'}
                                                    </span>
                                                    <h3 className="font-mono text-lg font-black text-neutral-900 tracking-wider mt-2 flex items-center gap-1.5">
                                                        {code.code}
                                                    </h3>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-red-500 font-black text-2xl">
                                                        {code.discount_type === 'percent' ? `${code.discount_value}%` : `฿${code.discount_value}`}
                                                    </span>
                                                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wide">Discount</p>
                                                </div>
                                            </div>
                                            
                                            <div className="border-t border-dashed border-neutral-100 pt-3 mt-1 flex justify-between items-center text-[11px] text-neutral-500 font-bold">
                                                <span>ขั้นต่ำ ฿{code.min_spend || 0} · หมดเขต {new Date(code.end_date).toLocaleDateString('th-TH')}</span>
                                                <button
                                                    onClick={() => handleCopyCode(code.code)}
                                                    className="bg-neutral-900 hover:bg-neutral-800 text-[#DFFF00] px-3.5 py-1.5 rounded-xl font-black transition-all text-[11px] active:scale-95 cursor-pointer flex items-center gap-1 shadow-sm"
                                                >
                                                    {copiedCode === code.code ? <Check size={12} /> : <Copy size={12} />}
                                                    <span>{copiedCode === code.code ? "คัดลอกแล้ว" : "คัดลอก"}</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-white rounded-3xl p-8 border border-neutral-100 text-center shadow-soft">
                                    <span className="text-2xl">🎟️</span>
                                    <p className="text-neutral-500 text-xs font-bold mt-2">ยังไม่มีโค้ดส่วนลดที่เปิดใช้งานในขณะนี้</p>
                                </div>
                            )}

                            {/* Curated Signatures Showcase */}
                            {signatures.length > 0 && (
                                <div className="space-y-4 pt-4">
                                    <h2 className="text-neutral-700 text-xs font-black tracking-widest uppercase font-mono pl-1">Featured Signature Dishes</h2>
                                    <div className={`grid gap-3 ${signatures.length === 1 ? 'grid-cols-1' : signatures.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                        {signatures.map((dish, i) => (
                                            <SignatureDishCard key={i} dish={dish} index={i} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.section>
                    )}

                </main>

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
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 cursor-pointer select-none"
                        onClick={() => setSelectedLightbox(null)}
                    >
                        <button
                            onClick={() => setSelectedLightbox(null)}
                            className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 transition-colors rounded-full flex items-center justify-center text-white backdrop-blur-md cursor-pointer text-lg font-bold"
                        >
                            ✕
                        </button>
                        <motion.img
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            src={optimizeImageUrl(selectedLightbox.url, 1200)}
                            alt="Lightbox Zoomed"
                            className="max-w-full max-h-[85vh] object-contain rounded-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
}

// ─── HELPER SUB-COMPONENTS ───

// Floating Plate Component for Margins
function FloatingPlate({ src, alt, top, left, right, size = "w-36", delay = 0, hasSteam = false, hasLeaves = false }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.8, delay }}
            style={{ top, left, right }}
            className={`absolute pointer-events-none select-none z-10 ${size} hidden md:block`}
        >
            <div className="relative animate-float" style={{ animationDelay: `${delay}s` }}>
                <img
                    src={src}
                    alt={alt}
                    className="w-full h-auto drop-shadow-[0_15px_30px_rgba(0,0,0,0.18)] hover:scale-105 transition-transform duration-500"
                />
                
                {/* Simulated steam */}
                {hasSteam && (
                    <div className="absolute inset-x-0 -top-8 flex justify-center gap-1.5 pointer-events-none">
                        <div className="steam-particle w-1.5 h-6 bg-white/25 rounded-full blur-[2px]" style={{ animationDelay: '0s' }} />
                        <div className="steam-particle w-2.5 h-8 bg-white/20 rounded-full blur-[3px]" style={{ animationDelay: '0.8s' }} />
                        <div className="steam-particle w-1.5 h-5 bg-white/25 rounded-full blur-[2px]" style={{ animationDelay: '1.6s' }} />
                    </div>
                )}

                {/* Sweet basil leaves sway */}
                {hasLeaves && (
                    <div className="absolute inset-0 pointer-events-none">
                        <LeafSVG className="absolute w-5 h-5 text-green-700/80 -top-2 -left-2 leaf-sway" style={{ animationDelay: '0.2s' }} />
                        <LeafSVG className="absolute w-4 h-4 text-green-800/70 bottom-4 -right-2 leaf-sway" style={{ animationDelay: '1.2s' }} />
                    </div>
                )}
            </div>
        </motion.div>
    );
}

// Leaf SVG Component
function LeafSVG({ className, style }) {
    return (
        <svg
            className={className}
            style={style}
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" className="hidden" />
            <path d="M17 8C15 5.5 12 4 9 4C5 4 2 7 2 11C2 15 5 18 9 18C12 18 15 16.5 17 14C19 14.8 21 14 22 13C20.5 12.5 19.5 11 19 9.5C18.5 8 18 8 17 8ZM9 16C6.8 16 5 14.2 5 12C5 9.8 6.8 8 9 8C11.2 8 13 9.8 13 12C13 14.2 11.2 16 9 16Z"/>
        </svg>
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
            className="flex items-center justify-between gap-4 py-3.5 border-b border-neutral-100 last:border-0 group"
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-1.5">
                    <h4 className="font-extrabold text-sm text-neutral-800 tracking-tight group-hover:text-amber-600 transition-colors">
                        {item.name}
                    </h4>
                    {isRecommended && (
                        <span className="text-[9px] bg-neutral-900 text-[#DFFF00] font-black px-1.5 py-0.5 rounded tracking-wider uppercase leading-none scale-90">
                            BOLD
                        </span>
                    )}
                </div>
                {item.description && (
                    <p className="text-neutral-400 text-xs mt-1 leading-relaxed line-clamp-2 pr-2">
                        {item.description}
                    </p>
                )}
            </div>
            
            <div className="flex items-center gap-3 flex-shrink-0">
                <span className="font-mono font-black text-sm text-neutral-800">฿{item.price}</span>
                
                {item.image_url && (
                    <div 
                        onClick={() => onImageClick(item.image_url)}
                        className="w-14 h-14 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200/60 shadow-sm cursor-zoom-in relative group-hover:scale-105 transition-transform duration-300 flex-shrink-0"
                    >
                        <img 
                            src={optimizeImageUrl(item.image_url, 150)} 
                            alt={item.name} 
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ZoomIn size={12} className="text-white" />
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

// Signature Dish Card for Promotions Tab
function SignatureDishCard({ dish, index }) {
    const [isLoaded, setIsLoaded] = useState(false);
    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: index * 0.05 }}
            className="rounded-2xl overflow-hidden bg-white border border-neutral-100 shadow-sm flex flex-col h-full hover:shadow-soft transition-shadow group"
        >
            <div className="aspect-square overflow-hidden relative bg-neutral-50">
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
                <div className="p-3 flex-1 flex flex-col justify-between">
                    {dish.name && <p className="text-xs font-extrabold text-neutral-800 leading-snug">{dish.name}</p>}
                    {dish.price && <p className="text-[11px] text-neutral-400 font-mono font-bold mt-1">{dish.price}.-</p>}
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
