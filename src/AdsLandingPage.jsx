import { motion } from 'framer-motion';
import { ExternalLink, MapPin, MessageCircle, ShoppingBag, Utensils } from 'lucide-react';
import { useState } from 'react';

export default function AdsLandingPage() {
    return (
        <div className="h-screen w-full overflow-y-auto snap-y snap-mandatory bg-black text-white font-sans hide-scrollbar">
            
            {/* SECTION 1: BLUE POSTER */}
            <section className="relative h-[100dvh] w-full snap-start flex flex-col justify-between items-center p-8 bg-[#6472A6] overflow-hidden">
                {/* Corner Texts Top */}
                <div className="w-full flex justify-between items-start text-white/90 text-sm tracking-widest font-mono z-10 font-bold uppercase">
                    <span>#LOCAL</span>
                    <span>ORIGINS</span>
                    <span>BOLD</span>
                </div>

                {/* Main Content */}
                <motion.div 
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="flex flex-col items-center justify-center flex-1 text-center w-full z-10"
                >
                    {/* Small sub header */}
                    <div className="mb-12 space-y-1 font-['IBM_Plex_Sans_Thai'] text-white/90 text-sm tracking-wide">
                        <p>ต่างวัตถุดิบ ต่างวิธี</p>
                        <p>ปลาร้ายังไม่เหมือนกัน</p>
                    </div>

                    {/* Big Thai Text */}
                    <div className="font-['IBM_Plex_Sans_Thai'] font-bold text-5xl md:text-7xl lg:text-8xl leading-[1.2] text-[#222222] tracking-tight w-full max-w-4xl flex flex-col gap-2">
                        <span className="block">ใช้ไม่เหมือนกัน</span>
                        <span className="block">กะปิต่างน้ำ</span>
                        <span className="block">ขมิ้นต่างดิน</span>
                        <span className="block">จริตที่ต่างกัน</span>
                    </div>

                    {/* Big English Text */}
                    <div className="mt-16 font-mono font-bold text-3xl md:text-5xl text-white tracking-widest uppercase">
                        <p>Local Origins.</p>
                        <p>Bold Characters.</p>
                    </div>
                </motion.div>

                {/* Corner Texts Bottom */}
                <div className="w-full flex justify-between items-end text-white/90 text-sm tracking-widest font-mono z-10 font-bold uppercase">
                    <span>#inthehausth</span>
                    <span className="font-['IBM_Plex_Sans_Thai']">นครพนม</span>
                    <span>MADEITBOLD</span>
                </div>
            </section>

            {/* SECTION 2: RED POSTER */}
            <section className="relative h-[100dvh] w-full snap-start flex flex-col justify-between items-center p-8 bg-[#FF2A1A] overflow-hidden">
                {/* Corner Texts Top */}
                <div className="w-full flex justify-between items-start text-white/90 text-sm tracking-widest font-mono z-10 font-bold uppercase">
                    <span className="font-['IBM_Plex_Sans_Thai']">#ความเผ็ด</span>
                    <span className="font-['IBM_Plex_Sans_Thai']">กระตุ้น</span>
                    <span className="font-['IBM_Plex_Sans_Thai']">เผาผลาญ</span>
                </div>
                
                {/* floating text right */}
                <div className="absolute top-20 right-8 font-mono font-bold text-xl text-white">
                    why ? Spicy
                </div>

                {/* Main Content */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="flex flex-col items-center justify-center flex-1 text-center w-full z-10 mt-12"
                >
                    {/* Big Thai Text */}
                    <div className="font-['IBM_Plex_Sans_Thai'] font-bold text-[3rem] md:text-7xl lg:text-8xl leading-[1.1] text-[#222222] tracking-tighter w-full max-w-4xl flex flex-col gap-1">
                        <span className="block">ความเผ็ด</span>
                        <span className="block">ช่วยกระตุ้น</span>
                        <span className="block">ระบบเผาผลาญ</span>
                        <span className="block">ให้ทำงานได้ดี</span>
                        <span className="block">ยิ่งขึ้น</span>
                    </div>

                    {/* Big English Text */}
                    <div className="mt-16 font-mono font-bold text-3xl md:text-5xl text-white tracking-widest">
                        <p>Spice up your</p>
                        <p>metabolism.</p>
                    </div>
                </motion.div>

                {/* Corner Texts Bottom */}
                <div className="w-full flex justify-between items-end text-white/90 text-sm tracking-widest font-mono z-10 font-bold uppercase">
                    <span>#inthehausth</span>
                    <span className="font-['IBM_Plex_Sans_Thai']">นครพนม</span>
                    <span>MADEITBOLD</span>
                </div>
            </section>

            {/* SECTION 3: IMAGE & LINKS (LINKTREE STYLE) */}
            <section className="relative min-h-[100dvh] w-full snap-start flex flex-col items-center py-12 px-6 bg-[#F9F9F9] overflow-y-auto">
                
                {/* Image Placeholder (Auto resizing) */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md mx-auto aspect-square md:aspect-video rounded-3xl overflow-hidden shadow-2xl relative bg-neutral-200 mb-10"
                >
                    <img 
                        src="/placeholder-food.jpg" 
                        alt="IN THE HAUS"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            e.target.onerror = null; 
                            e.target.src = "https://images.unsplash.com/photo-1559314809-0d155014e29e?q=80&w=800&auto=format&fit=crop"; // Fallback image
                        }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-6">
                        <h2 className="text-white font-['IBM_Plex_Sans_Thai'] font-bold text-3xl">IN THE HAUS | ในบ้าน</h2>
                    </div>
                </motion.div>

                <div className="w-full max-w-md mx-auto flex flex-col items-center">
                    <p className="text-neutral-600 font-['IBM_Plex_Sans_Thai'] text-center mb-8 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-2xl shadow-sm">
                        เปิดทุกวัน 11:30-23:30 น.<br/>(ครัวปิด 22:00 น.)
                    </p>

                    {/* Social Links List */}
                    <div className="w-full space-y-4 font-['IBM_Plex_Sans_Thai']">
                        <SocialLink 
                            href="https://lin.ee/EuzwG7c" 
                            icon={<MessageCircle size={20} />} 
                            title="Line Official" 
                            color="bg-[#06C755] hover:bg-[#05b34c]"
                        />
                        <SocialLink 
                            href="https://www.facebook.com/inthehausth" 
                            icon={<ExternalLink size={20} />} 
                            title="Facebook" 
                            color="bg-[#1877F2] hover:bg-[#166fe5]"
                        />
                        <SocialLink 
                            href="https://instagram.com/inthehausth" 
                            icon={<ExternalLink size={20} />} 
                            title="Instagram" 
                            color="bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F56040] hover:opacity-90"
                        />
                        <SocialLink 
                            href="https://maps.app.goo.gl/fYp7pp9b4zE6oFiKA?g_st=ic" 
                            icon={<MapPin size={20} />} 
                            title="Google Maps" 
                            color="bg-[#EA4335] hover:bg-[#d33c30]"
                        />
                        
                        <div className="my-8 flex items-center justify-center gap-4 w-full">
                            <div className="h-[1px] bg-neutral-300 flex-1"></div>
                            <span className="text-neutral-400 text-sm font-bold tracking-widest font-mono">DELIVERY</span>
                            <div className="h-[1px] bg-neutral-300 flex-1"></div>
                        </div>

                        <SocialLink 
                            href="https://lin.ee/8uqmIzZ" 
                            icon={<Utensils size={20} />} 
                            title="Lineman" 
                            color="bg-[#00B900] hover:bg-[#00a600]"
                        />
                        <SocialLink 
                            href="https://shopee.co.th/universal-link/now-food/shop/10195585" 
                            icon={<ShoppingBag size={20} />} 
                            title="Shopee Food" 
                            color="bg-[#EE4D2D] hover:bg-[#d94427]"
                        />
                    </div>

                    {/* Hashtags */}
                    <div className="flex flex-wrap justify-center gap-2 mt-12 mb-8">
                        {['#inthehausth', '#homefood', '#southernthaifood', '#nakhonpathom'].map(tag => (
                            <span key={tag} className="px-3 py-1 bg-neutral-200 text-neutral-600 rounded-full text-xs font-bold font-mono">
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            </section>
            
            <style jsx global>{`
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .hide-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}

function SocialLink({ href, icon, title, color }) {
    return (
        <motion.a 
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`flex items-center justify-center gap-3 w-full py-4 px-6 rounded-2xl text-white font-bold text-lg shadow-md transition-all ${color}`}
        >
            {icon}
            <span>{title}</span>
        </motion.a>
    );
}
