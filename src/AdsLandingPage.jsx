import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, MapPin, MessageCircle, Utensils, HelpCircle, Clock, Navigation } from 'lucide-react';
import { supabase } from './lib/supabaseClient';

const FALLBACK_HERO = "https://images.unsplash.com/photo-1559314809-0d155014e29e?q=80&w=800&auto=format&fit=crop";

export default function AdsLandingPage() {
    const [settings, setSettings] = useState({});
    const [menuImages, setMenuImages] = useState([]);
    const [signatures, setSignatures] = useState([]);
    const [loading, setLoading] = useState(true);

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

    const heroUrl = settings.link_hero_url || FALLBACK_HERO;
    const logoUrl = settings.link_logo_url || '';
    const shopName = settings.link_shop_name || 'IN THE HAUS';
    const shopNameTh = settings.link_shop_name_th || 'ในบ้าน';
    const subtitle = settings.link_subtitle || 'จริตจัด รสชัดเจน · Bold Attitude, Clear Taste';
    const hours = settings.link_hours || 'เปิดทุกวัน 11:30 - 23:30 น. (ครัวปิด 22:00 น.)';
    const locationText = settings.link_location_text || 'ริมแม่น้ำโขง · นครพนม';
    const tags = (settings.link_tags || '#inthehausth, #homefood, #southernthaifood, #nakhonphanom').split(',').map(t => t.trim()).filter(Boolean);
    const videoUrl = settings.link_video_url || '';

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

            {/* ─── HERO BANNER ─── */}
            <section className="w-full max-w-lg mx-auto px-4 mb-8">
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, duration: 0.5 }}
                    className="relative w-full aspect-[2/1] rounded-2xl overflow-hidden shadow-md"
                >
                    <img
                        src={heroUrl}
                        alt={shopName}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_HERO; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                </motion.div>
            </section>

            {/* ─── SOCIAL LINKS ─── */}
            <section className="w-full max-w-lg mx-auto px-5 pb-6">
                <div className="grid grid-cols-2 gap-2.5">
                    <LinkCard href="https://lin.ee/EuzwG7c" icon={<MessageCircle size={18} />} title="Line Official" bg="bg-[#00C300]" />
                    <LinkCard href="https://www.facebook.com/inthehausth" icon={<ExternalLink size={18} />} title="Facebook" bg="bg-[#1877F2]" />
                    <LinkCard href="https://instagram.com/inthehausth" icon={<ExternalLink size={18} />} title="Instagram" bg="bg-[#E1306C]" />
                    <LinkCard href="https://maps.app.goo.gl/fYp7pp9b4zE6oFiKA?g_st=ic" icon={<MapPin size={18} />} title="Google Maps" bg="bg-[#4A4A4A]" />
                </div>

                {/* Delivery */}
                <div className="flex items-center gap-3 my-5">
                    <div className="h-px bg-neutral-200 flex-1" />
                    <span className="text-neutral-300 text-[9px] font-bold tracking-[0.3em] font-mono uppercase">Delivery</span>
                    <div className="h-px bg-neutral-200 flex-1" />
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                    <LinkCard href="https://lin.ee/8uqmIzZ" icon={<Utensils size={18} />} title="Lineman" bg="bg-[#00B14F]" wide />
                </div>

                {/* Q&A */}
                <div className="mt-5">
                    <LinkCard href="/qa" icon={<HelpCircle size={18} />} title="Q&A ถาม-ตอบ" bg="bg-[#636AA0]" wide internal />
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
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="rounded-2xl overflow-hidden bg-white border border-neutral-100 shadow-sm"
                            >
                                <div className="aspect-square overflow-hidden">
                                    <img src={dish.img} alt={dish.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                                </div>
                                {(dish.name || dish.price) && (
                                    <div className="p-3">
                                        {dish.name && <p className="text-sm font-semibold text-neutral-800 leading-tight">{dish.name}</p>}
                                        {dish.price && <p className="text-xs text-neutral-400 font-mono mt-1">{dish.price}.-</p>}
                                    </div>
                                )}
                            </motion.div>
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

            {/* ─── MENU GALLERY ─── */}
            {menuImages.length > 0 && (
                <section className="w-full bg-white py-10">
                    <div className="max-w-2xl mx-auto px-5">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-px bg-neutral-200 flex-1" />
                            <h2 className="text-neutral-700 text-sm font-bold tracking-[0.2em] font-mono uppercase">Menu</h2>
                            <div className="h-px bg-neutral-200 flex-1" />
                        </div>

                        <div className="flex flex-col">
                            {menuImages.map((url, i) => (
                                <motion.img
                                    key={i}
                                    src={url}
                                    alt={`Menu ${i + 1}`}
                                    initial={{ opacity: 0, y: 25 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, margin: "-40px" }}
                                    transition={{ duration: 0.4, delay: i * 0.03 }}
                                    className="w-full h-auto object-contain"
                                />
                            ))}
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
        </div>
    );
}

function LinkCard({ href, icon, title, bg, wide = false, internal = false }) {
    const Tag = internal ? motion.a : motion.a;
    return (
        <Tag
            href={href}
            target={internal ? "_self" : "_blank"}
            rel={internal ? undefined : "noopener noreferrer"}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className={`${bg} rounded-xl p-3.5 flex items-center justify-center gap-2.5 text-white shadow-sm transition-transform ${wide ? 'col-span-full' : ''}`}
        >
            {icon}
            <span className="text-sm font-bold">{title}</span>
        </Tag>
    );
}
