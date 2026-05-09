import { motion } from 'framer-motion';
import { ExternalLink, MapPin, MessageCircle, ShoppingBag, Utensils } from 'lucide-react';

export default function AdsLandingPage() {
    return (
        <div className="w-full min-h-screen bg-[#F8F9FA] text-neutral-800 font-sans overflow-x-hidden">
            
            {/* SECTION 1: CLEAN LINKTREE & MENU */}
            <section className="w-full flex flex-col items-center py-8 px-4 md:px-8">
                
                {/* Hero Image Card */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md aspect-video md:aspect-[16/10] rounded-3xl overflow-hidden shadow-xl relative bg-neutral-200 mb-6"
                >
                    <img 
                        src="/placeholder-food.jpg" 
                        alt="IN THE HAUS"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            e.target.onerror = null; 
                            e.target.src = "https://images.unsplash.com/photo-1559314809-0d155014e29e?q=80&w=800&auto=format&fit=crop";
                        }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-6">
                        <h1 className="text-white font-['IBM_Plex_Sans_Thai'] font-bold text-2xl md:text-3xl tracking-wide">
                            IN THE HAUS | ในบ้าน
                        </h1>
                    </div>
                </motion.div>

                {/* Bio Box */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-neutral-100 p-4 mb-8 text-center"
                >
                    <p className="text-neutral-600 font-['IBM_Plex_Sans_Thai'] text-sm md:text-base leading-relaxed">
                        เปิดทุกวัน 11:30-23:30 น.<br/>(ครัวปิด 22:00 น.)
                    </p>
                </motion.div>

                {/* Social Links List */}
                <div className="w-full max-w-md space-y-4 font-['IBM_Plex_Sans_Thai']">
                    <SocialLink 
                        href="https://lin.ee/EuzwG7c" 
                        icon={<MessageCircle size={22} />} 
                        title="Line Official" 
                        color="bg-[#00C300] hover:bg-[#00a600]"
                    />
                    <SocialLink 
                        href="https://www.facebook.com/inthehausth" 
                        icon={<ExternalLink size={22} />} 
                        title="Facebook" 
                        color="bg-[#1877F2] hover:bg-[#166fe5]"
                    />
                    <SocialLink 
                        href="https://instagram.com/inthehausth" 
                        icon={<ExternalLink size={22} />} 
                        title="Instagram" 
                        color="bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F56040]"
                    />
                    <SocialLink 
                        href="https://maps.app.goo.gl/fYp7pp9b4zE6oFiKA?g_st=ic" 
                        icon={<MapPin size={22} />} 
                        title="Google Maps" 
                        color="bg-[#EA4335] hover:bg-[#d33c30]"
                    />
                    
                    <div className="py-6 flex items-center justify-center gap-4 w-full">
                        <div className="h-[1px] bg-neutral-300 flex-1"></div>
                        <span className="text-neutral-400 text-xs font-bold tracking-[0.2em] font-mono">DELIVERY</span>
                        <div className="h-[1px] bg-neutral-300 flex-1"></div>
                    </div>

                    <SocialLink 
                        href="https://lin.ee/8uqmIzZ" 
                        icon={<Utensils size={22} />} 
                        title="Lineman" 
                        color="bg-[#00B900] hover:bg-[#00a600]"
                    />
                    <SocialLink 
                        href="https://shopee.co.th/universal-link/now-food/shop/10195585" 
                        icon={<ShoppingBag size={22} />} 
                        title="Shopee Food" 
                        color="bg-[#EE4D2D] hover:bg-[#d94427]"
                    />
                </div>

                {/* Hashtags */}
                <div className="flex flex-wrap justify-center gap-2 mt-12 mb-16 max-w-md">
                    {['#inthehausth', '#homefood', '#southernthaifood'].map(tag => (
                        <span key={tag} className="px-4 py-1.5 bg-neutral-200/70 text-neutral-600 rounded-full text-[11px] font-bold font-mono tracking-wide">
                            {tag}
                        </span>
                    ))}
                </div>

                {/* MENU SECTION */}
                <div className="w-full max-w-2xl flex flex-col items-center mb-24">
                    <div className="flex items-center justify-center gap-4 w-full mb-8">
                        <div className="h-[1px] bg-neutral-300 flex-1"></div>
                        <span className="text-neutral-800 text-xl font-bold tracking-widest font-mono">OUR MENU</span>
                        <div className="h-[1px] bg-neutral-300 flex-1"></div>
                    </div>
                    
                    {/* Menu Images - Auto sizing to fit width, natural height */}
                    <div className="w-full flex flex-col gap-4">
                        {[1, 2, 3, 4].map((num) => (
                            <img 
                                key={num}
                                src={`/menu-${num}.jpg`} 
                                alt={`Menu Page ${num}`}
                                className="w-full h-auto object-contain rounded-xl shadow-sm bg-white"
                                onError={(e) => {
                                    e.target.style.display = 'none'; // Hide if missing, so user can just upload what they have
                                }}
                            />
                        ))}
                        <p className="text-center text-neutral-400 text-sm mt-4 italic">
                            * รูปเมนูจะแสดงอัตโนมัติเมื่ออัพโหลดไฟล์ menu-1.jpg ถึง menu-4.jpg ลงในโฟลเดอร์ public
                        </p>
                    </div>
                </div>
            </section>

            {/* BOLD POSTER SECTIONS (Kept for ads scrolling experience) */}
            
            {/* BLUE POSTER */}
            <section className="relative min-h-[100dvh] w-full flex flex-col justify-between items-center p-8 bg-[#6472A6] overflow-hidden text-white">
                <div className="w-full flex justify-between items-start text-white/90 text-sm tracking-widest font-mono z-10 font-bold uppercase">
                    <span>#LOCAL</span>
                    <span>ORIGINS</span>
                    <span>BOLD</span>
                </div>

                <motion.div 
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="flex flex-col items-center justify-center flex-1 text-center w-full z-10 py-20"
                >
                    <div className="mb-12 space-y-1 font-['IBM_Plex_Sans_Thai'] text-white/90 text-sm tracking-wide">
                        <p>ต่างวัตถุดิบ ต่างวิธี</p>
                        <p>ปลาร้ายังไม่เหมือนกัน</p>
                    </div>

                    <div className="font-['IBM_Plex_Sans_Thai'] font-bold text-5xl md:text-7xl lg:text-8xl leading-[1.2] text-[#222222] tracking-tight w-full max-w-4xl flex flex-col gap-2">
                        <span className="block">ใช้ไม่เหมือนกัน</span>
                        <span className="block">กะปิต่างน้ำ</span>
                        <span className="block">ขมิ้นต่างดิน</span>
                        <span className="block">จริตที่ต่างกัน</span>
                    </div>

                    <div className="mt-16 font-mono font-bold text-3xl md:text-5xl text-white tracking-widest uppercase">
                        <p>Local Origins.</p>
                        <p>Bold Characters.</p>
                    </div>
                </motion.div>

                <div className="w-full flex justify-between items-end text-white/90 text-sm tracking-widest font-mono z-10 font-bold uppercase">
                    <span>#inthehausth</span>
                    <span className="font-['IBM_Plex_Sans_Thai']">นครพนม</span>
                    <span>MADEITBOLD</span>
                </div>
            </section>

            {/* RED POSTER */}
            <section className="relative min-h-[100dvh] w-full flex flex-col justify-between items-center p-8 bg-[#FF2A1A] overflow-hidden text-white">
                <div className="w-full flex justify-between items-start text-white/90 text-sm tracking-widest font-mono z-10 font-bold uppercase">
                    <span className="font-['IBM_Plex_Sans_Thai']">#ความเผ็ด</span>
                    <span className="font-['IBM_Plex_Sans_Thai']">กระตุ้น</span>
                    <span className="font-['IBM_Plex_Sans_Thai']">เผาผลาญ</span>
                </div>
                
                <div className="absolute top-20 right-8 font-mono font-bold text-xl text-white">
                    why ? Spicy
                </div>

                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="flex flex-col items-center justify-center flex-1 text-center w-full z-10 py-20 mt-12"
                >
                    <div className="font-['IBM_Plex_Sans_Thai'] font-bold text-[3rem] md:text-7xl lg:text-8xl leading-[1.1] text-[#222222] tracking-tighter w-full max-w-4xl flex flex-col gap-1">
                        <span className="block">ความเผ็ด</span>
                        <span className="block">ช่วยกระตุ้น</span>
                        <span className="block">ระบบเผาผลาญ</span>
                        <span className="block">ให้ทำงานได้ดี</span>
                        <span className="block">ยิ่งขึ้น</span>
                    </div>

                    <div className="mt-16 font-mono font-bold text-3xl md:text-5xl text-white tracking-widest">
                        <p>Spice up your</p>
                        <p>metabolism.</p>
                    </div>
                </motion.div>

                <div className="w-full flex justify-between items-end text-white/90 text-sm tracking-widest font-mono z-10 font-bold uppercase">
                    <span>#inthehausth</span>
                    <span className="font-['IBM_Plex_Sans_Thai']">นครพนม</span>
                    <span>MADEITBOLD</span>
                </div>
            </section>

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
            className={`flex items-center justify-center gap-3 w-full py-4 px-6 rounded-[1.25rem] text-white font-bold text-lg md:text-xl shadow-sm transition-transform ${color}`}
        >
            {icon}
            <span>{title}</span>
        </motion.a>
    );
}
