import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Navigation, Phone, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, RefreshCw, Compass, Instagram, Facebook, Star } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { supabase } from './lib/supabaseClient';
import { Analytics } from '@vercel/analytics/react';
import {
    trackDirectionsClick,
    trackPhoneClick,
    trackLineClick,
    trackBookletClick
} from './utils/analyticsHelper';

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

    const processSettings = (settingsData) => {
        if (!settingsData) return;
        const map = settingsData.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
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

        if (promoUrls.length > 0) {
            setActiveTab(prev => (prev === 'promo' ? 'promo' : prev));
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
    };

    const processMenuItems = (itemsData) => {
        if (!itemsData) return;
        const sortedItems = (itemsData || []).sort((a, b) => {
            const recA = a.is_recommended === true;
            const recB = b.is_recommended === true;
            if (recA !== recB) return recA ? -1 : 1;

            const orderA = a.sort_order ?? a.display_order ?? 999999;
            const orderB = b.sort_order ?? b.display_order ?? 999999;
            if (orderA !== orderB) return orderA - orderB;

            return (a.name || '').localeCompare(b.name || '');
        });
        setMenuItems(sortedItems);
    };

    const fetchSettingsOnly = async () => {
        try {
            const { data } = await supabase.from('app_settings').select('key, value').like('key', 'link_%');
            if (data) processSettings(data);
        } catch (err) {
            console.warn('[AdsLandingPage] Failed to fetch updated settings:', err);
        }
    };

    const fetchMenuItemsOnly = async () => {
        try {
            const { data } = await supabase
                .from('menu_items')
                .select('id, name, price, description, image_url, is_available, is_recommended, sort_order, display_order, category_id')
                .eq('is_available', true);
            if (data) processMenuItems(data);
        } catch (err) {
            console.warn('[AdsLandingPage] Failed to fetch updated menu items:', err);
        }
    };

    const fetchCategoriesOnly = async () => {
        try {
            const { data } = await supabase
                .from('menu_categories')
                .select('id, name, display_order')
                .order('display_order');
            if (data) setMenuCategories(data);
        } catch (err) {
            console.warn('[AdsLandingPage] Failed to fetch updated categories:', err);
        }
    };

    const fetchCheckinsOnly = async () => {
        try {
            const { data } = await supabase
                .from('haus_checkins')
                .select('id, image_url, source, user_name, user_handle, text, likes, is_visible, created_at')
                .eq('is_visible', true)
                .order('created_at', { ascending: false })
                .limit(8);
            if (data) setCustomerCheckins(data);
        } catch (err) {
            console.warn('[AdsLandingPage] Failed to fetch updated check-ins:', err);
        }
    };

    const fetchData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [settingsRes, itemsRes, catsRes, checkinsRes] = await Promise.all([
                supabase.from('app_settings').select('key, value').like('key', 'link_%'),
                supabase.from('menu_items').select('id, name, price, description, image_url, is_available, is_recommended, sort_order, display_order, category_id').eq('is_available', true),
                supabase.from('menu_categories').select('id, name, display_order').order('display_order'),
                supabase.from('haus_checkins').select('id, image_url, source, user_name, user_handle, text, likes, is_visible, created_at').eq('is_visible', true).order('created_at', { ascending: false }).limit(8)
            ]);

            if (settingsRes.data) processSettings(settingsRes.data);
            if (itemsRes.data) processMenuItems(itemsRes.data);
            if (catsRes.data) setMenuCategories(catsRes.data);
            if (checkinsRes.data) setCustomerCheckins(checkinsRes.data);
        } catch (err) {
            console.error('Failed to load link data:', err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        // ─── REALTIME CHANNEL FOR ADS LANDING PAGE ───
        let debounceTimer = null;
        const triggerDebounced = (fn) => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fn();
            }, 250);
        };

        const channel = supabase.channel('ads_landing_page_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload) => {
                const key = payload.new?.key || payload.old?.key;
                if (!key || key.startsWith('link_')) {
                    triggerDebounced(fetchSettingsOnly);
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
                triggerDebounced(fetchMenuItemsOnly);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_categories' }, () => {
                triggerDebounced(fetchCategoriesOnly);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'haus_checkins' }, () => {
                triggerDebounced(fetchCheckinsOnly);
            })
            .subscribe((status, err) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
                    console.warn(`[Ads Realtime] Channel status: ${status}`, err || '');
                }
            });

        // Foreground wake-up & online reconnect listeners (critical for Mobile Ad Click traffic)
        const handleWakeup = () => {
            if (document.visibilityState === 'visible') {
                fetchData(true);
            }
        };
        const handleOnline = () => {
            fetchData(true);
        };

        document.addEventListener('visibilitychange', handleWakeup);
        window.addEventListener('online', handleOnline);

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            supabase.removeChannel(channel);
            document.removeEventListener('visibilitychange', handleWakeup);
            window.removeEventListener('online', handleOnline);
        };
    }, []);

    const logoUrl = settings.link_logo_url || '';
    const shopName = settings.link_shop_name || 'IN THE HAUS';
    const shopNameTh = settings.link_shop_name_th || 'ในบ้าน';
    const subtitle = settings.link_subtitle || 'จริตจัด รสชัดเจน · Bold Attitude, Clear Taste';
    const hours = settings.link_hours || 'เปิดทุกวัน 11:30 - 23:30 น. (ครัวปิด 22:00 น.)';
    const locationText = settings.link_location_text || 'ริมแม่น้ำโขง · นครพนม';
    const tags = (settings.link_tags || '#inthehausth, #homefood, #southernthaifood, #nakhonphanom').split(',').map(t => t.trim()).filter(Boolean);

    const defaultLineUrl = "https://lin.ee/EuzwG7c";
    const defaultIgUrl = "https://www.instagram.com/inthehausth/";
    const defaultFbUrl = "https://www.facebook.com/inthehausth/";
    const defaultMapUrl = "https://maps.app.goo.gl/TfTD3xATqRCrQmiF9";

    const lineUrl = (settings.link_url_1 && settings.link_url_1 !== 'https://lin.ee/xyz') ? settings.link_url_1 : defaultLineUrl;
    const igUrl = (settings.link_url_2 && settings.link_url_2 !== 'https://instagram.com' && settings.link_url_2 !== 'https://www.instagram.com' && settings.link_url_2 !== 'https://www.instagram.com/inthehaus.th/') ? settings.link_url_2 : defaultIgUrl;
    const fbUrl = (settings.link_url_3 && settings.link_url_3 !== 'https://facebook.com' && settings.link_url_3 !== 'https://www.facebook.com') ? settings.link_url_3 : defaultFbUrl;
    const mapUrl = (settings.link_url_4 && settings.link_url_4 !== 'https://maps.google.com') ? settings.link_url_4 : defaultMapUrl;

    const handleDirectionsClick = () => {
        trackDirectionsClick('/link');
    };

    const handleCallClick = () => {
        trackPhoneClick('098-528-4217', '/link');
    };

    const handleLineClick = () => {
        trackLineClick('/link');
    };

    const handleBookletClick = () => {
        trackBookletClick('/link');
    };

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
            
            <div className="w-full max-w-xl mx-auto relative z-10 flex-grow flex flex-col border-x border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper)]">
                
                {/* ─── HEADER: IDENTITY & METADATA (TABULAR) ─── */}
                <header className="flex flex-col border-b border-[var(--color-hallmark-rule)] animate-fade-in select-none">
                    {/* Top Marquee Bar (High Contrast) */}
                    <div className="w-full bg-[#E9F344] text-[var(--color-hallmark-ink)] border-b border-[var(--color-hallmark-rule)] py-1.5 px-3 flex items-center justify-center overflow-hidden">
                        <span className="font-mono text-[9px] font-black uppercase tracking-widest truncate">
                            // {subtitle} //
                        </span>
                    </div>

                    {/* Logo & Identity Cell */}
                    <div className="flex items-center gap-4 p-4 border-b border-[var(--color-hallmark-rule)]">
                        {logoUrl ? (
                            <img
                                src={optimizeImageUrl(logoUrl, 120)}
                                alt="IN THE HAUS Logo"
                                className="w-14 h-14 object-cover border border-[var(--color-hallmark-ink)] flex-shrink-0"
                            />
                        ) : (
                            <div className="w-14 h-14 bg-[var(--color-hallmark-ink)] flex items-center justify-center flex-shrink-0 p-1.5">
                                <img src="/logo.png" alt="IN THE HAUS" className="w-full h-full object-contain invert" />
                            </div>
                        )}
                        <div className="flex flex-col justify-center">
                            <h1 className="text-2xl font-[var(--font-display)] font-bold text-[var(--color-hallmark-ink)] tracking-widest uppercase leading-none">
                                {shopName}
                            </h1>
                            <p className="text-[var(--color-hallmark-ink-muted)] font-mono font-bold text-[10px] tracking-widest uppercase mt-2">{shopNameTh}</p>
                        </div>
                    </div>

                    {/* Tabular Metadata Grid */}
                    <div className="grid grid-cols-2 divide-x divide-y divide-[var(--color-hallmark-rule)] font-[var(--font-body)] text-[10px] text-[var(--color-hallmark-ink)] uppercase font-semibold tracking-wider">
                        <div className="p-3 flex flex-col gap-1">
                            <span className="text-[var(--color-hallmark-ink-muted)] font-mono text-[9px]">STATUS</span>
                            <span className="flex items-center gap-1.5 text-xs font-bold">
                                <span className="w-2 h-2 bg-emerald-500 border border-[var(--color-hallmark-rule)]" />
                                OPEN DAILY
                            </span>
                        </div>
                        <div className="p-3 flex flex-col gap-1">
                            <span className="text-[var(--color-hallmark-ink-muted)] font-mono text-[9px]">HOURS</span>
                            <span className="text-xs font-bold">{hours.replace('เปิดทุกวัน ', '')}</span>
                        </div>
                        <div className="p-3 flex flex-col gap-1 col-span-2 border-t border-[var(--color-hallmark-rule)]">
                            <span className="text-[var(--color-hallmark-ink-muted)] font-mono text-[9px]">LOC</span>
                            <span className="text-xs font-bold">{locationText}</span>
                        </div>
                    </div>

                    {/* Live Check-in Ticker CTA */}
                    <a
                        href="/link/hauscheckin"
                        className="w-full bg-[var(--color-hallmark-ink)] text-[var(--color-hallmark-paper)] p-4 flex items-center justify-between hover:bg-neutral-800 transition-colors cursor-pointer group border-t border-[var(--color-hallmark-rule)]"
                    >
                        <span className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex h-2 w-2 bg-emerald-500 border border-[var(--color-hallmark-paper)]"></span>
                            </span>
                            <span className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-[var(--color-hallmark-paper)]">
                                LIVE STREAM
                            </span>
                        </span>
                        <span className="font-[var(--font-body)] font-bold text-xs flex items-center gap-1">
                            <span>ดูรูปภาพลูกค้า</span> <span className="font-mono font-bold">➔</span>
                        </span>
                    </a>
                </header>

                {/* ─── SECTION CONTROLS (Tabular Structure) ─── */}
                <div className="grid grid-cols-3 border-b border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper)] sticky top-0 z-30 select-none divide-x divide-[var(--color-hallmark-rule)]">
                    <button
                        onClick={() => setActiveSection('menu')}
                        className={`py-4 flex items-center justify-center gap-2 font-mono text-xs font-bold tracking-widest cursor-pointer transition-colors ${activeSection === 'menu' ? 'bg-[var(--color-hallmark-ink)] text-[var(--color-hallmark-paper)]' : 'bg-transparent text-[var(--color-hallmark-ink-muted)] hover:bg-[var(--color-hallmark-paper-dark)] hover:text-[var(--color-hallmark-ink)]'}`}
                    >
                        {activeSection === 'menu' && <span className="text-[var(--color-brand)] font-black">*</span>}
                        MENU
                    </button>
                    <button
                        onClick={() => setActiveSection('atmosphere')}
                        className={`py-4 flex items-center justify-center gap-2 font-mono text-xs font-bold tracking-widest cursor-pointer transition-colors ${activeSection === 'atmosphere' ? 'bg-[var(--color-hallmark-ink)] text-[var(--color-hallmark-paper)]' : 'bg-transparent text-[var(--color-hallmark-ink-muted)] hover:bg-[var(--color-hallmark-paper-dark)] hover:text-[var(--color-hallmark-ink)]'}`}
                    >
                        {activeSection === 'atmosphere' && <span className="text-[var(--color-brand)] font-black">*</span>}
                        VIBE
                    </button>
                    <button
                        onClick={() => setActiveSection('connect')}
                        className={`py-4 flex items-center justify-center gap-2 font-mono text-xs font-bold tracking-widest cursor-pointer transition-colors ${activeSection === 'connect' ? 'bg-[var(--color-hallmark-ink)] text-[var(--color-hallmark-paper)]' : 'bg-transparent text-[var(--color-hallmark-ink-muted)] hover:bg-[var(--color-hallmark-paper-dark)] hover:text-[var(--color-hallmark-ink)]'}`}
                    >
                        {activeSection === 'connect' && <span className="text-[var(--color-brand)] font-black">*</span>}
                        CONNECT
                    </button>
                </div>

                {/* ─── SECTION 1: MENU & SIGNATURES ─── */}
                {activeSection === 'menu' && (
                    <div className="space-y-6 flex-grow animate-fade-in">
                        
                        {/* Signatures */}
                        {signatures.length > 0 && (
                            <section className="border-b border-[var(--color-hallmark-rule)]">
                                <div className="flex items-center justify-between p-3 border-b border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper-dark)]">
                                    <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-hallmark-ink)]">
                                        SIGNATURE DISHES
                                    </h3>
                                    <span className="text-[10px] font-mono bg-[var(--color-hallmark-ink)] text-[var(--color-hallmark-paper)] px-2 py-0.5 font-bold uppercase tracking-wider border border-[var(--color-hallmark-ink)]">
                                        RECOMMENDED
                                    </span>
                                </div>
                                <div className={`grid ${signatures.length === 1 ? 'grid-cols-1' : signatures.length === 2 ? 'grid-cols-2 divide-x divide-[var(--color-hallmark-rule)]' : 'grid-cols-3 divide-x divide-[var(--color-hallmark-rule)]'}`}>
                                    {signatures.map((dish, i) => (
                                        <div 
                                            key={i} 
                                            className="flex flex-col group cursor-pointer bg-[var(--color-hallmark-paper)]"
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
                                            <div className="p-3 flex-grow flex flex-col justify-between gap-2">
                                                <p className="font-[var(--font-body)] font-bold text-xs leading-tight text-[var(--color-hallmark-ink)]">{dish.name}</p>
                                                <p className="font-mono text-[11px] font-bold text-[var(--color-hallmark-ink-muted)]">฿{dish.price}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Specialties List */}
                        {featuredMenuItems.length > 0 && (
                            <section className="border-b border-[var(--color-hallmark-rule)]">
                                <div className="flex items-center justify-between p-3 border-b border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper-dark)]">
                                    <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-hallmark-ink)]">
                                        SPECIALTIES
                                    </h3>
                                    <span className="font-mono text-[10px] text-[var(--color-hallmark-ink-muted)]">
                                        {featuredMenuItems.length} ITEMS
                                    </span>
                                </div>
                                
                                <div className="divide-y divide-[var(--color-hallmark-rule)]">
                                    {featuredMenuItems.map((item, idx) => (
                                        <MenuListItem key={item.id} item={item} index={idx} onImageClick={(url) => setSelectedLightbox({ type: 'menu', url })} />
                                    ))}
                                </div>
                                
                                {/* Accordion Toggle Button */}
                                <div>
                                    <button
                                        onClick={() => setShowAllMenu(!showAllMenu)}
                                        className="w-full p-4 bg-[var(--color-hallmark-ink)] text-[var(--color-hallmark-paper)] hover:bg-neutral-800 transition-colors font-mono text-[11px] font-bold uppercase tracking-widest cursor-pointer"
                                    >
                                        {showAllMenu ? "[-] CLOSE FULL MENU" : "[+] VIEW FULL MENU"}
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
                                    className="w-full overflow-hidden border-b border-[var(--color-hallmark-rule)]"
                                >
                                    {menuCategories.map((category) => {
                                        const categoryItems = menuItems.filter(item => item.category_id === category.id);
                                        if (categoryItems.length === 0) return null;

                                        return (
                                            <div key={category.id} className="border-t border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper)] animate-fade-in first:border-t-0">
                                                <div className="p-3 border-b border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper-dark)] flex justify-between items-center">
                                                    <span className="font-mono text-xs font-bold tracking-widest text-[var(--color-hallmark-ink)] uppercase">
                                                        {category.name}
                                                    </span>
                                                    <span className="font-mono text-[10px] text-[var(--color-hallmark-ink-muted)]">
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
                            <section className="border-b border-[var(--color-hallmark-rule)]">
                                <button
                                    onClick={() => {
                                        handleBookletClick();
                                        setSelectedLightbox({
                                            type: 'booklet_slider',
                                            urls: activeTab === 'promo' ? promoMenuImages : regularMenuImages
                                        });
                                    }}
                                    className="w-full bg-[var(--color-hallmark-paper-dark)] p-4 flex flex-col items-center justify-center gap-1 hover:bg-[var(--color-hallmark-ink)] hover:text-[var(--color-hallmark-paper)] group transition-colors cursor-pointer"
                                >
                                    <span className="text-[9px] font-mono text-[var(--color-hallmark-ink-muted)] font-bold tracking-widest uppercase group-hover:text-[var(--color-hallmark-paper)] transition-colors">
                                        CLASSIC BOOKLET MENU
                                    </span>
                                    <span className="font-[var(--font-body)] font-bold text-xs flex items-center gap-1.5 mt-1">
                                        เปิดดูเมนูแบบเล่ม (PDF) <span className="font-mono">➔</span>
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
                            <div className="border-b border-[var(--color-hallmark-rule)]">
                                <div className="flex items-center justify-between p-3 border-b border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper-dark)]">
                                    <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-hallmark-ink)]">
                                        ATMOSPHERE IMAGES
                                    </h3>
                                    <span className="font-mono text-[10px] text-[var(--color-hallmark-ink-muted)]">
                                        {atmImages.length} VIEWS
                                    </span>
                                </div>
                                
                                <div className="grid grid-cols-2 divide-x divide-y divide-[var(--color-hallmark-rule)]">
                                    {atmImages.map((url, i) => (
                                        <div
                                            key={i}
                                            onClick={() => setSelectedLightbox({ type: 'atm', url })}
                                            className="bg-[var(--color-hallmark-paper)] cursor-pointer aspect-square overflow-hidden group flex"
                                        >
                                            <img 
                                                src={optimizeImageUrl(url, 500)} 
                                                alt={`Atmosphere ${i + 1}`} 
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
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
                            <div className="border-b border-[var(--color-hallmark-rule)]">
                                <div className="flex items-center justify-between p-3 border-b border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper-dark)]">
                                    <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-hallmark-ink)]">
                                        CUSTOMER MOMENTS
                                    </h3>
                                    <span className="font-mono text-[10px] text-white bg-[var(--color-brand)] px-2 py-0.5 font-bold uppercase tracking-wider">
                                        LIVE
                                    </span>
                                </div>
                                
                                <div className="grid grid-cols-2 divide-x divide-y divide-[var(--color-hallmark-rule)]">
                                    {customerCheckins.map((checkin, i) => (
                                        <div
                                            key={i}
                                            onClick={() => setSelectedLightbox({ type: 'checkin', item: checkin })}
                                            className="bg-[var(--color-hallmark-paper)] cursor-pointer relative group aspect-square overflow-hidden flex"
                                        >
                                            <img 
                                                src={optimizeImageUrl(checkin.image_url, 400)} 
                                                alt={`Checkin ${i + 1}`} 
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                                                loading="lazy"
                                                decoding="async"
                                            />
                                            {/* Minimal source indicator */}
                                            <div className="absolute top-0 right-0 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {checkin.source === 'instagram' && <span className="bg-pink-500 text-white font-mono text-[8px] font-bold px-1 py-0.5 tracking-wider">IG</span>}
                                                {checkin.source === 'facebook' && <span className="bg-blue-600 text-white font-mono text-[8px] font-bold px-1 py-0.5 tracking-wider">FB</span>}
                                                {checkin.source === 'google' && <span className="bg-[#E9F344] text-black font-mono text-[8px] font-bold px-1 py-0.5 tracking-wider">GMAPS</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ─── SECTION 3: CONNECT / LINKS ─── */}
                {activeSection === 'connect' && (
                    <div className="space-y-4 flex-grow animate-fade-in">
                        {/* Reservation & Contact */}
                        <div className="divide-y divide-[var(--color-hallmark-rule)] border-b border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper-dark)]">
                            <div className="p-3 border-b border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper)]">
                                <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-hallmark-ink)]">
                                    RESERVATION & CONTACT
                                </h3>
                            </div>
                            
                            <LinkCard 
                                href={lineUrl} 
                                title={settings?.link_title_1 || "LINE OA // จองโต๊ะ หรือ สั่งอาหาร"} 
                                bg="bg-[#06C755] text-white hover:bg-[#05b34c]" 
                                wide 
                            />
                            
                            <LinkCard 
                                href="tel:0985284217" 
                                title="098-528-4217 // โทรติดต่อร้าน" 
                                bg="bg-[var(--color-hallmark-paper)] text-[var(--color-hallmark-ink)] hover:bg-[var(--color-hallmark-paper-dark)]" 
                                wide 
                            />
                        </div>

                        {/* Social Media */}
                        <div className="divide-y divide-[var(--color-hallmark-rule)] border-b border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper-dark)]">
                            <div className="p-3 border-b border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper)]">
                                <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-hallmark-ink)]">
                                    SOCIAL MEDIA
                                </h3>
                            </div>
                            
                            <LinkCard 
                                href={igUrl} 
                                title={settings?.link_title_2 || "INSTAGRAM // @inthehausth"} 
                                bg="bg-[var(--color-hallmark-paper)] text-[var(--color-hallmark-ink)] hover:bg-[var(--color-hallmark-paper-dark)]" 
                                wide 
                            />
                            
                            <LinkCard 
                                href={fbUrl} 
                                title={settings?.link_title_3 || "FACEBOOK // IN THE HAUS"} 
                                bg="bg-[var(--color-hallmark-paper)] text-[var(--color-hallmark-ink)] hover:bg-[var(--color-hallmark-paper-dark)]" 
                                wide 
                            />
                        </div>

                        {/* Delivery Service */}
                        <div className="divide-y divide-[var(--color-hallmark-rule)] border-b border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper-dark)]">
                            <div className="p-3 border-b border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper)]">
                                <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-hallmark-ink)]">
                                    DELIVERY SERVICE
                                </h3>
                            </div>
                            <LinkCard 
                                href="https://lin.ee/8uqmIzZ" 
                                title="ORDER DIRECT ON LINEMAN ➔" 
                                bg="bg-[var(--color-hallmark-ink)] text-[var(--color-hallmark-paper)] hover:bg-neutral-800" 
                                wide 
                                id="cta-lineman" 
                            />
                        </div>

                        {/* Information Hub */}
                        <div className="divide-y divide-[var(--color-hallmark-rule)] border-b border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper-dark)]">
                            <div className="p-3 border-b border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper)]">
                                <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-hallmark-ink)]">
                                    INFORMATION HUB
                                </h3>
                            </div>
                            <LinkCard 
                                href="/qa" 
                                title="RESTAURANT Q&A // คำถามที่พบบ่อย ➔" 
                                bg="bg-[var(--color-hallmark-paper)] text-[var(--color-hallmark-ink)] hover:bg-[var(--color-hallmark-paper-dark)]" 
                                wide 
                                internal 
                                id="cta-qa" 
                            />
                            <LinkCard 
                                href="/link/hauscheckin" 
                                title="HAUS CHECK-IN WALL // บอร์ดเช็กอินลูกค้า ➔" 
                                bg="bg-[var(--color-brand)] text-white hover:opacity-90 font-bold" 
                                wide 
                                internal 
                                id="cta-checkin" 
                            />
                        </div>

                        {/* Address & Navigation Map (Unified Launch Map) */}
                        <div className="border-b border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper)] divide-y divide-[var(--color-hallmark-rule)]">
                            <div className="p-3 bg-[var(--color-hallmark-paper-dark)] flex items-center justify-between">
                                <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-hallmark-ink)]">
                                    LOCATION & MAP
                                </h3>
                                <span className="font-mono text-[10px] text-[var(--color-hallmark-ink-muted)]">
                                    NAKHON PHANOM
                                </span>
                            </div>
                            <div className="p-4 bg-[var(--color-hallmark-paper)] font-mono text-xs text-[var(--color-hallmark-ink)] space-y-2">
                                <p className="font-[var(--font-body)] font-bold text-sm leading-relaxed">{locationText}</p>
                                <div className="pt-2 flex flex-col gap-1 text-[11px] text-[var(--color-hallmark-ink-muted)] font-bold">
                                    <p>TEL: <a href="tel:0985284217" className="underline hover:opacity-80">098-528-4217</a></p>
                                    <p>OPEN: {hours}</p>
                                </div>
                            </div>
                            
                            <a
                                href={mapUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-4 bg-[var(--color-hallmark-ink)] text-[var(--color-hallmark-paper)] font-mono text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 cursor-pointer text-center"
                            >
                                <Navigation size={14} /> LAUNCH MAP // นำทางมาร้าน
                            </a>
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
                    href={lineUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={handleLineClick}
                    className="flex-1 bg-[var(--color-brand)] text-white hover:opacity-90 rounded-sm py-2.5 px-2 flex items-center justify-center gap-1.5 text-[9px] font-mono font-bold tracking-wider uppercase transition-colors cursor-pointer"
                >
                    <MessageCircle size={12} /> LINE CHAT
                </a>
                <a 
                    href={mapUrl}
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={handleDirectionsClick}
                    className="flex-1 bg-[var(--color-hallmark-paper-dark)] text-[var(--color-hallmark-ink)] hover:bg-neutral-200 border border-[var(--color-hallmark-rule)] rounded-sm py-2.5 px-2 flex items-center justify-center gap-1.5 text-[9px] font-mono font-bold tracking-wider uppercase transition-colors cursor-pointer"
                >
                    <Navigation size={12} /> DIRECTIONS
                </a>
                <a 
                    href="tel:0985284217" 
                    onClick={handleCallClick}
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
                                            {(selectedLightbox.item.user_handle || selectedLightbox.item.user_username) && (
                                                <span className="text-[9px] text-[var(--color-hallmark-ink-muted)] leading-none mt-0.5">
                                                    {(selectedLightbox.item.user_handle || selectedLightbox.item.user_username).startsWith('@') ? (selectedLightbox.item.user_handle || selectedLightbox.item.user_username) : `@${selectedLightbox.item.user_handle || selectedLightbox.item.user_username}`}
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
                                    className="w-full bg-[var(--color-brand)] text-white border border-[var(--color-hallmark-rule)] rounded-sm py-2.5 flex items-center justify-center gap-1.5 font-mono text-[11px] font-extrabold tracking-wider uppercase hover:opacity-90 transition-all cursor-pointer mt-2 text-center"
                                >
                                    <Compass size={13} />
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

// Menu List Item Component (Tabular Version with Strict 1:1 Aspect-Square Images)
function MenuListItem({ item, index, onImageClick }) {
    const isRecommended = item.is_recommended === true;
    return (
        <div className="flex items-stretch min-h-[64px] border-b border-[var(--color-hallmark-rule)] last:border-0 group bg-[var(--color-hallmark-paper)] hover:bg-[var(--color-hallmark-paper-dark)] transition-colors">
            {/* Title & Description Cell */}
            <div className="flex-1 flex flex-col justify-center p-3 sm:p-3.5 border-r border-[var(--color-hallmark-rule)] min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-[var(--font-body)] font-bold text-xs sm:text-[13px] text-[var(--color-hallmark-ink)] leading-snug">
                        {item.name}
                    </h4>
                    {isRecommended && (
                        <span className="text-[8px] font-mono bg-[var(--color-hallmark-ink)] text-[var(--color-hallmark-paper)] font-bold px-1.5 py-0.5 uppercase tracking-wider">
                            REC
                        </span>
                    )}
                </div>
                {item.description && (
                    <p className="text-[var(--color-hallmark-ink-muted)] text-[10px] mt-1 line-clamp-2 leading-relaxed">
                        {item.description}
                    </p>
                )}
            </div>
            
            {/* Price Cell */}
            <div className="flex items-center justify-center px-3 w-[64px] sm:w-[72px] flex-shrink-0 border-r border-[var(--color-hallmark-rule)]">
                <span className="font-mono font-bold text-xs text-[var(--color-hallmark-ink)]">฿{item.price}</span>
            </div>
            
            {/* Image Cell (Strict 1:1 Aspect-Ratio Square) */}
            <div className="w-[68px] sm:w-[76px] flex-shrink-0 flex items-center justify-center p-1.5 bg-[var(--color-hallmark-paper)]">
                {item.image_url ? (
                    <div 
                        onClick={() => onImageClick(item.image_url)}
                        className="w-full aspect-square bg-neutral-100 overflow-hidden cursor-pointer relative group-hover:brightness-95 transition-all border border-[var(--color-hallmark-rule)]"
                    >
                        <img 
                            src={optimizeImageUrl(item.image_url, 180)} 
                            alt={item.name} 
                            className="w-full h-full object-cover aspect-square"
                            loading={index !== undefined && index < 4 ? undefined : "lazy"}
                            fetchPriority={index !== undefined && index < 4 ? "high" : undefined}
                            decoding="async"
                        />
                        <div className="absolute inset-0 border border-transparent hover:border-[var(--color-hallmark-ink)] transition-colors pointer-events-none" />
                    </div>
                ) : (
                    <div className="w-full aspect-square bg-[var(--color-hallmark-paper-dark)] flex items-center justify-center border border-[var(--color-hallmark-rule)]">
                        <span className="font-mono text-[9px] text-[var(--color-hallmark-ink-muted)]">HAUS</span>
                    </div>
                )}
            </div>
        </div>
    );
}

// Link Card Component (Structural Grid Style)
function LinkCard({ href, title, bg, wide = false, internal = false, id, onClick }) {
    return (
        <a
            href={href}
            id={id}
            onClick={onClick}
            target={internal ? "_self" : "_blank"}
            rel={internal ? undefined : "noopener noreferrer"}
            className={`${bg} py-4 px-4 flex items-center justify-center transition-colors cursor-pointer ${wide ? 'w-full block text-center' : 'flex-1'} font-mono text-xs font-bold tracking-widest`}
        >
            <span className="whitespace-nowrap uppercase">{title}</span>
        </a>
    );
}
