import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useHausHome } from './hooks/useHausHome'
import { useUserHistory } from './hooks/useUserHistory'
import { supabase } from './lib/supabaseClient'
import CasualLayout from './components/layout/CasualLayout'
import HomeHeader from './components/home/HomeHeader'
import HomeActions from './components/home/HomeActions'
import HomeNavigation from './components/home/HomeNavigation'
import AuthModal from './components/AuthModal'
import HistoryModal from './components/history/HistoryModal'


export default function Home({ session }) {
    // 1. Logic
    const { 
        t, status, settings, userRole, 
        showAuthModal, setShowAuthModal, handleLogout, 
        checkServiceStatus 
    } = useHausHome(session)

    // 2. History Logic
    const [isHistoryOpen, setIsHistoryOpen] = useState(false)
    const history = useUserHistory(session)

    // 3. Featured Menu Items state & fetch
    const [featuredItems, setFeaturedItems] = useState([])
    const [faqOpen, setFaqOpen] = useState({})

    useEffect(() => {
        async function fetchFeatured() {
            try {
                const { data } = await supabase
                    .from('menu_items')
                    .select('*')
                    .eq('is_available', true)
                    .eq('is_recommended', true)
                    .limit(4)
                if (data) setFeaturedItems(data)
            } catch (err) {
                console.error("Error fetching featured items:", err)
            }
        }
        fetchFeatured()
    }, [])

    const toggleFaq = (index) => {
        setFaqOpen(prev => ({
            ...prev,
            [index]: !prev[index]
        }))
    }

    const faqItems = [
        {
            q: "ร้านตั้งอยู่ที่ไหน? / Where is the restaurant?",
            a: "ร้านตั้งอยู่ริมแม่น้ำโขง อำเภอเมือง จังหวัดนครพนม (ใกล้ลานพญาศรีสัตตนาคราช) ติดริมฝั่งโขงบรรยากาศสบายๆ"
        },
        {
            q: "จองโต๊ะล่วงหน้ามีค่าใช้จ่ายไหม? / Is there a booking fee?",
            a: "การจองโต๊ะมีค่ามัดจำ 150 บาทต่อท่าน ซึ่งยอดมัดจำทั้งหมดจะนำไปใช้เป็นเครดิตหักค่าอาหารและเครื่องดื่มเต็มจำนวนในวันที่เข้าใช้บริการ / There is a deposit of 150 THB per person, which will be fully credited towards your food and drinks on the date of your visit."
        },
        {
            q: "เปิดให้บริการช่วงเวลาไหน? / What are the opening hours?",
            a: "เปิดให้บริการทุกวันเวลา 11:30 - 23:30 น. (ครัวหลักจะปิดรับออเดอร์เวลา 22:00 น.)"
        }
    ]

    return (
        <CasualLayout backgroundImage={settings?.home_background_url}>
            <div className="haus-home-page min-h-screen w-full relative flex flex-col">
                <div className="w-full flex flex-col text-[var(--color-hallmark-ink)] pt-12 pb-28 flex-grow">
                
                <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

                {/* History Modal */}
                <HistoryModal 
                    isOpen={isHistoryOpen} 
                    onClose={() => setIsHistoryOpen(false)} 
                    history={history}
                />

                {/* 1. Announcement Bar (Fixed Top - Redesigned) */}
                <div className="fixed top-0 left-0 w-full z-[60] bg-[var(--color-hallmark-paper-dark)] border-b border-[var(--color-hallmark-rule)] h-10 flex items-center overflow-hidden">
                    <div className="relative w-full flex items-center">
                        <motion.div
                            className="whitespace-nowrap flex gap-12 font-mono text-[9px] uppercase tracking-normal text-[var(--color-hallmark-ink)]"
                            animate={{ x: ["0%", "-50%"] }}
                            transition={{
                                repeat: Infinity,
                                duration: 25,
                                ease: "linear"
                            }}
                        >
                            {Array(4).fill(
                                <div className="flex items-center gap-4">
                                    <span className="text-[var(--color-brand)] font-bold">
                                        // {settings?.announcement_headline || "INFO"}
                                    </span>
                                    <span className="font-bold">
                                        {settings?.announcement_detail || "Welcome to HAUS TABLE - จริตจัด รสชัดเจน"}
                                    </span>
                                    <span className="w-1 h-1 bg-[var(--color-brand)] rounded-full mx-4" />
                                </div>
                            )}
                        </motion.div>
                    </div>
                </div>

                {/* 2. Header Section */}
                <HomeHeader t={t} status={status} />

                {/* 3. Braun Info Instrument Panel */}
                <div className="w-full bg-[var(--color-hallmark-paper)] border-b border-[var(--color-hallmark-rule)] p-4 flex flex-col gap-3 font-[var(--font-body)]">
                    <div className="flex items-center justify-between border-b border-[var(--color-hallmark-rule)] pb-2">
                        <span className="font-mono text-[11px] font-bold text-[var(--color-hallmark-ink-muted)] uppercase tracking-wider">
                            [ INSTRUMENT PANEL // DETAILS ]
                        </span>
                        <span className="font-mono text-[10px] text-[var(--color-hallmark-ink-muted)]">
                            HAUS STATUS
                        </span>
                    </div>

                    <div className="flex flex-col gap-2 font-mono text-[12px] text-[var(--color-hallmark-ink)]">
                        <div className="flex items-center justify-between">
                            <span className="text-[var(--color-hallmark-ink-muted)] flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                                [ TIME ]
                            </span>
                            <span className="font-bold">{settings?.link_hours || "เปิดทุกวัน 11:30 - 23:30 น."}</span>
                        </div>
                        <div className="flex items-start justify-between">
                            <span className="text-[var(--color-hallmark-ink-muted)] flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap mt-0.5">
                                [ LOC ]
                            </span>
                            <span className="font-bold text-right pl-4 leading-relaxed">{settings?.link_location_text || "ริมแม่น้ำโขง · นครพนม"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[var(--color-hallmark-ink-muted)] flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                                [ TEL ]
                            </span>
                            <span className="font-bold">098-528-4217</span>
                        </div>
                    </div>
                </div>

                {/* 4. Action Buttons (Grid Layout) */}
                <div className="w-full bg-[var(--color-hallmark-paper)] border-b border-[var(--color-hallmark-rule)]">
                    <HomeActions 
                        settings={settings}
                        checkStatus={checkServiceStatus}
                        t={t}
                        user={session?.user}
                        setShowAuthModal={setShowAuthModal}
                    />
                </div>

                {/* 5. Signature Menu Section */}
                {featuredItems.length > 0 && (
                    <div className="w-full bg-[var(--color-hallmark-paper)] border-b border-[var(--color-hallmark-rule)] p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b border-[var(--color-hallmark-rule)] pb-2">
                            <span className="font-mono text-[11px] font-bold text-[var(--color-hallmark-ink-muted)] uppercase tracking-wider">
                                [ 01 // SIGNATURE DISHES ]
                            </span>
                            <span className="font-mono text-[10px] text-[var(--color-brand)] font-bold">
                                RECOMMENDED
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {featuredItems.map((item) => (
                                <div key={item.id} className="bg-[var(--color-hallmark-paper-dark)] border border-[var(--color-hallmark-rule)] rounded-none overflow-hidden flex flex-col">
                                    <div className="aspect-[4/3] w-full bg-neutral-200 dark:bg-neutral-800 relative overflow-hidden border-b border-[var(--color-hallmark-rule)]">
                                        <img 
                                            src={item.image_url || '/logo.png'} 
                                            alt={item.name} 
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="p-3 flex-grow flex flex-col justify-between">
                                        <div>
                                            <span className="font-bold text-[13px] text-[var(--color-hallmark-ink)] leading-tight block line-clamp-1">
                                                {item.name}
                                            </span>
                                            <span className="text-[11px] text-[var(--color-hallmark-ink-muted)] line-clamp-1 mt-1 block">
                                                {item.description || 'สูตรต้นตำรับจริตจัด รสชัดเจน'}
                                            </span>
                                        </div>
                                        <span className="font-mono text-[12px] font-bold text-[var(--color-brand)] mt-2 block">
                                            ฿{item.price}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 6. How-It-Works Guide (Timeline) */}
                <div className="w-full bg-[var(--color-hallmark-paper)] border-b border-[var(--color-hallmark-rule)] p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-[var(--color-hallmark-rule)] pb-2">
                        <span className="font-mono text-[11px] font-bold text-[var(--color-hallmark-ink-muted)] uppercase tracking-wider">
                            [ 02 // HOW TO ENGAGE ]
                        </span>
                        <span className="font-mono text-[10px] text-[var(--color-hallmark-ink-muted)]">
                            4 SIMPLE STEPS
                        </span>
                    </div>

                    <div className="flex flex-col gap-4 font-sans">
                        {[
                            { step: '01', title: 'เข้าสู่ระบบ LINE', desc: 'ลงทะเบียนเข้าสู่ระบบได้ทันทีในหน้าแรกเพื่อบันทึกประวัติและสะสมสิทธิ์' },
                            { step: '02', title: 'เลือกบริการที่ต้องการ', desc: 'กดปุ่มจองโต๊ะอาหาร หรือสั่งอาหารกลับบ้านล่วงหน้า' },
                            { step: '03', title: 'ตรวจสอบคิว/ชำระเงิน', desc: 'ทำตามขั้นตอนเพื่อส่งคำขอและยืนยันข้อมูลออเดอร์ของคุณ' },
                            { step: '04', title: 'ติดตามสถานะออเดอร์', desc: 'ตรวจสอบสถานะอาหารและประวัติการสั่งได้ผ่านระบบแจ้งเตือน' }
                        ].map((item, idx) => (
                            <div key={idx} className="flex gap-3 items-start">
                                <span className="font-mono text-[10px] font-bold text-[var(--color-brand)] bg-[var(--color-hallmark-paper-dark)] border border-[var(--color-hallmark-rule)] w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    {item.step}
                                </span>
                                <div className="flex flex-col text-left">
                                    <span className="font-bold text-[13px] text-[var(--color-hallmark-ink)] leading-none mb-1.5">
                                        {item.title}
                                    </span>
                                    <span className="text-[12px] text-[var(--color-hallmark-ink-muted)] leading-relaxed">
                                        {item.desc}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 7. FAQ Accordion */}
                <div className="w-full bg-[var(--color-hallmark-paper)] border-b border-[var(--color-hallmark-rule)] p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-[var(--color-hallmark-rule)] pb-2">
                        <span className="font-mono text-[11px] font-bold text-[var(--color-hallmark-ink-muted)] uppercase tracking-wider">
                            [ 03 // FREQUENTLY ASKED ]
                        </span>
                        <span className="font-mono text-[10px] text-[var(--color-hallmark-ink-muted)]">
                            Q & A
                        </span>
                    </div>

                    <div className="flex flex-col gap-3">
                        {faqItems.map((item, idx) => {
                            const isOpen = faqOpen[idx]
                            return (
                                <div key={idx} className="border-b border-[var(--color-hallmark-rule)] last:border-b-0 pb-3 last:pb-0">
                                    <button 
                                        onClick={() => toggleFaq(idx)}
                                        className="w-full flex items-center justify-between text-left py-1 text-[13px] font-bold text-[var(--color-hallmark-ink)] cursor-pointer"
                                    >
                                        <span>{item.q}</span>
                                        <span className="font-mono text-[10px] font-bold text-[var(--color-hallmark-ink-muted)]">
                                            {isOpen ? '[ - ]' : '[ + ]'}
                                        </span>
                                    </button>
                                    
                                    <AnimatePresence initial={false}>
                                        {isOpen && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                            >
                                                <p className="text-[12px] text-[var(--color-hallmark-ink-muted)] mt-2 leading-relaxed">
                                                    {item.a}
                                                </p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )
                        })}
                    </div>
                </div>

            </div>

            {/* 8. Bottom Navigation (Floating) */}
                <HomeNavigation 
                    session={session}
                    userRole={userRole}
                    history={history}
                    setShowAuthModal={setShowAuthModal}
                    setIsHistoryOpen={setIsHistoryOpen}
                    handleLogout={handleLogout}
                />
            </div>
        </CasualLayout>
    )
}
