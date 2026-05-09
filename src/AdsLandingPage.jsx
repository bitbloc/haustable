import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, MapPin, MessageCircle, ShoppingBag, Utensils, Clock, ChevronDown } from 'lucide-react';
import { supabase } from './lib/supabaseClient';

const FALLBACK_HERO = "https://images.unsplash.com/photo-1559314809-0d155014e29e?q=80&w=800&auto=format&fit=crop";

export default function AdsLandingPage() {
    const [settings, setSettings] = useState({});
    const [menuImages, setMenuImages] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // Fetch all link_ settings
            const { data } = await supabase
                .from('app_settings')
                .select('*')
                .like('key', 'link_%');

            if (data) {
                const map = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
                setSettings(map);

                // Extract menu images (link_menu_1, link_menu_2, etc.)
                const menus = [];
                for (let i = 1; i <= 10; i++) {
                    const url = map[`link_menu_${i}`];
                    if (url) menus.push(url);
                }
                setMenuImages(menus);
            }
        } catch (err) {
            console.error('Failed to load link data:', err);
        } finally {
            setLoading(false);
        }
    };

    const heroUrl = settings.link_hero_url || FALLBACK_HERO;
    const shopName = settings.link_shop_name || 'IN THE HAUS | ในบ้าน';
    const subtitle = settings.link_subtitle || 'ต่างวัตถุดิบ ต่างวิธี · ปลาร้ายังไม่เหมือนกัน';
    const hours = settings.link_hours || 'เปิดทุกวัน 11:30 - 23:30 น. (ครัวปิด 22:00 น.)';

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen bg-[#f5f5f0] text-neutral-900 overflow-x-hidden font-['IBM_Plex_Sans_Thai',sans-serif]">

            {/* ─── HERO SECTION ─── */}
            <section className="relative w-full">
                {/* Hero Image */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6 }}
                    className="relative w-full aspect-[4/5] sm:aspect-[3/4] md:aspect-video overflow-hidden"
                >
                    <img
                        src={heroUrl}
                        alt={shopName}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_HERO; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                    {/* Content overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-6 pb-8 md:p-10">
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-white/70 text-xs md:text-sm tracking-widest font-mono uppercase mb-3"
                        >
                            {subtitle}
                        </motion.p>
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-white text-4xl md:text-6xl font-bold tracking-tight leading-tight"
                        >
                            {shopName}
                        </motion.h1>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="flex items-center gap-2 mt-4 text-white/80 text-sm"
                        >
                            <Clock size={14} />
                            <span>{hours}</span>
                        </motion.div>
                    </div>
                </motion.div>

                {/* Scroll indicator */}
                <motion.div
                    animate={{ y: [0, 6, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white/50"
                >
                    <ChevronDown size={20} />
                </motion.div>
            </section>

            {/* ─── LINKS GRID ─── */}
            <section className="w-full max-w-lg mx-auto px-5 py-10">
                <div className="grid grid-cols-2 gap-3">
                    <LinkCard href="https://lin.ee/EuzwG7c" icon={<MessageCircle size={20} />} title="Line Official" bg="bg-[#00C300]" />
                    <LinkCard href="https://www.facebook.com/inthehausth" icon={<ExternalLink size={20} />} title="Facebook" bg="bg-[#1877F2]" />
                    <LinkCard href="https://instagram.com/inthehausth" icon={<ExternalLink size={20} />} title="Instagram" bg="bg-[#E1306C]" />
                    <LinkCard href="https://maps.app.goo.gl/fYp7pp9b4zE6oFiKA?g_st=ic" icon={<MapPin size={20} />} title="Google Maps" bg="bg-[#EA4335]" />
                </div>

                <div className="flex items-center gap-4 my-8">
                    <div className="h-px bg-neutral-300 flex-1" />
                    <span className="text-neutral-400 text-[10px] font-bold tracking-[0.25em] font-mono">DELIVERY</span>
                    <div className="h-px bg-neutral-300 flex-1" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <LinkCard href="https://lin.ee/8uqmIzZ" icon={<Utensils size={20} />} title="Lineman" bg="bg-[#00B900]" />
                    <LinkCard href="https://shopee.co.th/universal-link/now-food/shop/10195585" icon={<ShoppingBag size={20} />} title="Shopee Food" bg="bg-[#EE4D2D]" />
                </div>

                {/* Tags */}
                <div className="flex flex-wrap justify-center gap-2 mt-10">
                    {['#inthehausth', '#homefood', '#southernthaifood', '#nakhonpathom'].map(tag => (
                        <span key={tag} className="px-3 py-1 bg-neutral-200/60 text-neutral-500 rounded-full text-[10px] font-bold font-mono tracking-wide">
                            {tag}
                        </span>
                    ))}
                </div>
            </section>

            {/* ─── MENU GALLERY ─── */}
            {menuImages.length > 0 && (
                <section className="w-full bg-white py-12">
                    <div className="max-w-2xl mx-auto px-5">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="h-px bg-neutral-200 flex-1" />
                            <h2 className="text-neutral-800 text-lg font-bold tracking-[0.15em] font-mono">MENU</h2>
                            <div className="h-px bg-neutral-200 flex-1" />
                        </div>

                        <div className="flex flex-col gap-1">
                            {menuImages.map((url, i) => (
                                <motion.img
                                    key={i}
                                    src={url}
                                    alt={`Menu ${i + 1}`}
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, margin: "-50px" }}
                                    transition={{ duration: 0.5, delay: i * 0.05 }}
                                    className="w-full h-auto object-contain"
                                />
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ─── EDITORIAL POSTERS ─── */}
            <section className="relative min-h-[90vh] w-full flex flex-col justify-between items-center p-8 bg-[#6472A6] overflow-hidden text-white">
                <div className="w-full flex justify-between items-start text-white/80 text-[10px] tracking-[0.2em] font-mono font-bold uppercase">
                    <span>#LOCAL</span><span>ORIGINS</span><span>BOLD</span>
                </div>
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="flex flex-col items-center justify-center flex-1 text-center w-full py-16"
                >
                    <p className="text-white/70 text-sm mb-10 tracking-wide">ต่างวัตถุดิบ ต่างวิธี · ปลาร้ายังไม่เหมือนกัน</p>
                    <div className="font-bold text-[2.8rem] sm:text-6xl md:text-7xl leading-[1.15] text-[#1a1a2e] flex flex-col gap-1">
                        <span>ใช้ไม่เหมือนกัน</span>
                        <span>กะปิต่างน้ำ</span>
                        <span>ขมิ้นต่างดิน</span>
                        <span>จริตที่ต่างกัน</span>
                    </div>
                    <div className="mt-14 font-mono font-bold text-2xl sm:text-4xl md:text-5xl text-white tracking-widest uppercase">
                        <p>Local Origins.</p><p>Bold Characters.</p>
                    </div>
                </motion.div>
                <div className="w-full flex justify-between items-end text-white/80 text-[10px] tracking-[0.2em] font-mono font-bold uppercase">
                    <span>#inthehausth</span><span>นครพนม</span><span>MADEITBOLD</span>
                </div>
            </section>

            <section className="relative min-h-[90vh] w-full flex flex-col justify-between items-center p-8 bg-[#FF2A1A] overflow-hidden text-white">
                <div className="w-full flex justify-between items-start text-white/80 text-[10px] tracking-[0.2em] font-mono font-bold uppercase">
                    <span>#ความเผ็ด</span><span>กระตุ้น</span><span>เผาผลาญ</span>
                </div>
                <div className="absolute top-20 right-8 font-mono font-bold text-base text-white/80">why ? Spicy</div>
                <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="flex flex-col items-center justify-center flex-1 text-center w-full py-16 mt-8"
                >
                    <div className="font-bold text-[2.8rem] sm:text-6xl md:text-7xl leading-[1.1] text-[#1a1a2e] flex flex-col gap-0">
                        <span>ความเผ็ด</span>
                        <span>ช่วยกระตุ้น</span>
                        <span>ระบบเผาผลาญ</span>
                        <span>ให้ทำงานได้ดี</span>
                        <span>ยิ่งขึ้น</span>
                    </div>
                    <div className="mt-14 font-mono font-bold text-2xl sm:text-4xl md:text-5xl text-white tracking-widest">
                        <p>Spice up your</p><p>metabolism.</p>
                    </div>
                </motion.div>
                <div className="w-full flex justify-between items-end text-white/80 text-[10px] tracking-[0.2em] font-mono font-bold uppercase">
                    <span>#inthehausth</span><span>นครพนม</span><span>MADEITBOLD</span>
                </div>
            </section>

            {/* ─── FOOTER ─── */}
            <footer className="bg-neutral-900 text-neutral-500 py-8 text-center text-xs font-mono tracking-wider">
                <p>© {new Date().getFullYear()} IN THE HAUS · นครพนม</p>
            </footer>
        </div>
    );
}

function LinkCard({ href, icon, title, bg }) {
    return (
        <motion.a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className={`${bg} rounded-2xl p-4 flex flex-col items-center justify-center gap-2 text-white shadow-sm min-h-[90px] transition-transform`}
        >
            {icon}
            <span className="text-sm font-bold">{title}</span>
        </motion.a>
    );
}
