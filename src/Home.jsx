/* Hallmark · component: Home · genre: modern-minimal · theme: dieter-rams-thai-modern
 * states: default · logged-in · guest · loading
 * contrast: pass (APCA / WCAG AAA compliant)
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useHausHome } from './hooks/useHausHome'
import { useUserHistory } from './hooks/useUserHistory'
import { supabase } from './lib/supabaseClient'
import { optimizeImageUrl } from './utils/urlHelper'
import CasualLayout from './components/layout/CasualLayout'
import HomeHeader from './components/home/HomeHeader'
import HomeActions from './components/home/HomeActions'
import HomeNavigation from './components/home/HomeNavigation'
import AuthModal from './components/AuthModal'
import HistoryModal from './components/history/HistoryModal'

export default function Home({ session }) {
    // 1. Logic & App State
    const { 
        t, status, settings, userRole, profile,
        showAuthModal, setShowAuthModal, handleLogout, 
        checkServiceStatus 
    } = useHausHome(session)

    // 2. User History Logic
    const [isHistoryOpen, setIsHistoryOpen] = useState(false)
    const history = useUserHistory(session)
    const { activeOrders } = history || {}

    // 3. Featured Menu Items State & Fetch
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
                    .order('sort_order', { ascending: true, nullsFirst: false })
                    .limit(4)
                if (data && data.length > 0) {
                    setFeaturedItems(data)
                }
            } catch (err) {
                console.error("Error fetching featured dishes:", err)
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

    const handleDirectionsClick = () => {
        try {
            if (typeof window !== 'undefined' && window.gtag) {
                window.gtag('event', 'conversion', {
                    'send_to': 'AW-11227095880/QU1qCJHHvcocEMjGv-kp',
                    'value': 1.0,
                    'currency': 'THB'
                })
            }
        } catch (err) {
            console.error('gtag conversion error:', err)
        }
    }

    const defaultMapUrl = "https://maps.app.goo.gl/TfTD3xATqRCrQmiF9"
    const mapUrl = (settings?.link_url_4 && settings?.link_url_4 !== 'https://maps.google.com') 
        ? settings.link_url_4 
        : defaultMapUrl

    const faqItems = [
        {
            q: "ร้านตั้งอยู่ที่ไหน และมีที่จอดรถไหม?",
            qEn: "Where is the restaurant & is there parking?",
            a: "ร้านตั้งอยู่ริมแม่น้ำโขง อำเภอเมือง จังหวัดนครพนม (ใกล้ลานพญาศรีสัตตนาคราช) มีที่จอดรถริมถนนฝั่งแม่น้ำโขงและบริเวณใกล้เคียงสะดวกสบาย"
        },
        {
            q: "การจองโต๊ะล่วงหน้ามีค่ามัดจำเท่าไร?",
            qEn: "What is the table reservation deposit?",
            a: "การจองโต๊ะล่วงหน้ามีค่ามัดจำ 150 บาทต่อท่าน ซึ่งยอดมัดจำทั้งหมดจะนำไปใช้เป็นเครดิตหักค่าอาหารและเครื่องดื่มเต็มจำนวน 100% ในวันที่เข้าใช้บริการ"
        },
        {
            q: "เปิดให้บริการช่วงเวลาไหน และครัวปิดกี่โมง?",
            qEn: "What are the opening and kitchen hours?",
            a: `เปิดให้บริการทุกวัน ${settings?.link_hours || '11:30 - 23:30 น.'} โดยครัวหลักจะปิดรับออเดอร์เวลา 22:00 น. และโซนบาร์เครื่องดื่มเปิดบริการถึง 23:30 น.`
        },
        {
            q: "มีบริการสั่งอาหารกลับบ้าน หรือส่งเดลิเวอรีไหม?",
            qEn: "Is there pickup or delivery service?",
            a: "มีบริการสั่งอาหารกลับบ้านล่วงหน้า (Pickup) ผ่านหน้าเว็บนี้เพื่อรับหน้าร้านตามเวลาที่กำหนด หรือสั่งเดลิเวอรีผ่าน LINEMAN ได้เช่นกัน"
        }
    ]

    const announcementText = settings?.announcement_detail || "IN THE HAUS · จริตจัด รสชัดเจน ริมโขง นครพนม"
    const announcementHeadline = settings?.announcement_headline || "INFO"

    return (
        <CasualLayout backgroundImage={settings?.home_background_url}>
            <div className="haus-home-page min-h-screen w-full relative flex flex-col">
                <div className="w-full flex flex-col text-[var(--color-hallmark-ink)] pt-10 pb-28 flex-grow">
                
                {/* 0. Auth & History Modals */}
                <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
                <HistoryModal 
                    isOpen={isHistoryOpen} 
                    onClose={() => setIsHistoryOpen(false)} 
                    history={history}
                />

                {/* 1. Announcement Marquee (High Contrast Neo-Brutalist Top Banner) */}
                <div className="fixed top-0 left-0 w-full z-[60] bg-[#E9F344] text-[var(--color-hallmark-ink)] border-b border-[var(--color-hallmark-rule)] h-9 flex items-center overflow-hidden select-none">
                    <div className="relative w-full flex items-center">
                        <motion.div
                            className="whitespace-nowrap flex gap-8 font-mono text-[10px] font-black uppercase tracking-wider text-[var(--color-hallmark-ink)]"
                            animate={{ x: ["0%", "-50%"] }}
                            transition={{
                                repeat: Infinity,
                                duration: 24,
                                ease: "linear"
                            }}
                        >
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <span className="bg-[var(--color-hallmark-ink)] text-[#E9F344] px-1.5 py-0.2 font-mono text-[9px] font-bold tracking-widest">
                                        // {announcementHeadline}
                                    </span>
                                    <span>{announcementText}</span>
                                    <span className="w-1.5 h-1.5 bg-[var(--color-hallmark-ink)] mx-2" />
                                </div>
                            ))}
                        </motion.div>
                    </div>
                </div>

                {/* 2. Main Identity Header */}
                <div className="w-full bg-[var(--color-hallmark-paper)] border-b border-[var(--color-hallmark-rule)] px-4 pt-4 pb-2">
                    <HomeHeader t={t} status={status} />
                </div>

                {/* 3. Instrument Panel: Location, Hours, Fast CTAs */}
                <div className="w-full bg-[var(--color-hallmark-paper)] border-b border-[var(--color-hallmark-rule)] font-[var(--font-body)]">
                    <div className="flex items-center justify-between p-3 border-b border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper-dark)]">
                        <span className="font-mono text-[11px] font-black text-[var(--color-hallmark-ink)] uppercase tracking-wider">
                            [ INSTRUMENT PANEL // DETAILS ]
                        </span>
                        <span className="font-mono text-[10px] text-[var(--color-hallmark-ink-muted)]">
                            HAUS STATUS
                        </span>
                    </div>

                    <div className="p-4 flex flex-col gap-2.5 font-mono text-[12px] text-[var(--color-hallmark-ink)]">
                        <div className="flex items-center justify-between">
                            <span className="text-[var(--color-hallmark-ink-muted)] font-bold flex-shrink-0">
                                [ TIME ]
                            </span>
                            <span className="font-bold text-right">
                                {settings?.link_hours || "เปิดทุกวัน 11:30 - 23:30 น. (ครัวปิด 22:00 น.)"}
                            </span>
                        </div>
                        <div className="flex items-start justify-between">
                            <span className="text-[var(--color-hallmark-ink-muted)] font-bold flex-shrink-0 mt-0.5">
                                [ LOC ]
                            </span>
                            <span className="font-bold text-right pl-4 leading-relaxed">
                                {settings?.link_location_text || "ริมแม่น้ำโขง · นครพนม (ใกล้ลานพญาศรีสัตตนาคราช)"}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[var(--color-hallmark-ink-muted)] font-bold flex-shrink-0">
                                [ TEL ]
                            </span>
                            <a 
                                href="tel:0985284217"
                                className="font-bold underline hover:opacity-80 transition-opacity"
                            >
                                098-528-4217
                            </a>
                        </div>
                    </div>

                    {/* Fast Navigation Shortcut Grid */}
                    <div className="grid grid-cols-2 divide-x border-t border-[var(--color-hallmark-rule)] font-mono text-[11px] font-bold">
                        <a
                            href={mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={handleDirectionsClick}
                            className="p-3 text-center bg-[var(--color-hallmark-paper)] hover:bg-[var(--color-hallmark-paper-dark)] text-[var(--color-hallmark-ink)] transition-colors flex items-center justify-center gap-1.5"
                        >
                            <span>[ DIRECTIONS ➔ ]</span>
                        </a>
                        <a
                            href="https://lin.ee/EuzwG7c"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 text-center bg-[var(--color-hallmark-paper)] hover:bg-[var(--color-hallmark-paper-dark)] text-[var(--color-hallmark-ink)] transition-colors flex items-center justify-center gap-1.5"
                        >
                            <span>[ LINE OA ➔ ]</span>
                        </a>
                    </div>
                </div>

                {/* 4. Personalized Member Banner / Guest Invite */}
                <div className="w-full bg-[var(--color-hallmark-paper)] border-b border-[var(--color-hallmark-rule)]">
                    {session ? (
                        <div className="p-4 bg-[var(--color-hallmark-paper-dark)] flex items-center justify-between gap-3">
                            <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-[9px] font-bold px-1.5 py-0.2 bg-[var(--color-hallmark-ink)] text-[var(--color-hallmark-paper)] uppercase">
                                        {profile?.role === 'admin' || profile?.role === 'staff' ? 'STAFF / VIP' : 'MEMBER'}
                                    </span>
                                    <span className="font-bold text-[13px] text-[var(--color-hallmark-ink)] truncate">
                                        {profile?.nickname || profile?.display_name || session.user.user_metadata?.full_name?.split(' ')[0] || 'MEMBER'}
                                    </span>
                                </div>
                                <span className="font-mono text-[11px] font-bold text-[var(--color-brand)] mt-0.5">
                                    {Number(profile?.xhaus_balance || 0)} XHAUS CREDITS
                                </span>
                            </div>

                            <Link 
                                to="/member-card"
                                className="flex-shrink-0 font-mono text-[10px] font-black px-3 py-1.5 bg-[var(--color-hallmark-ink)] text-[var(--color-hallmark-paper)] hover:opacity-90 transition-opacity"
                            >
                                [ CARD QR ➔ ]
                            </Link>
                        </div>
                    ) : (
                        <div className="p-4 bg-[var(--color-hallmark-paper-dark)] flex items-center justify-between gap-3">
                            <div className="flex flex-col min-w-0">
                                <span className="font-mono text-[10px] font-extrabold text-[var(--color-hallmark-ink)] uppercase tracking-wider">
                                    [ VIP MEMBERSHIP // REWARDS ]
                                </span>
                                <span className="text-[11px] text-[var(--color-hallmark-ink-muted)] leading-tight mt-0.5">
                                    สะสมแต้ม xhaus รับสิทธิพิเศษและของขวัญวันเกิด
                                </span>
                            </div>

                            <button 
                                onClick={() => setShowAuthModal(true)}
                                className="flex-shrink-0 font-mono text-[10px] font-black px-3 py-1.5 bg-[var(--color-hallmark-ink)] text-[var(--color-hallmark-paper)] hover:opacity-90 transition-opacity cursor-pointer"
                            >
                                [ SIGN IN ➔ ]
                            </button>
                        </div>
                    )}
                </div>

                {/* 5. Core Action Controls (3 Hero Dials + 4 Hub Modules) */}
                <div className="w-full bg-[var(--color-hallmark-paper)] border-b border-[var(--color-hallmark-rule)]">
                    <HomeActions 
                        settings={settings}
                        checkStatus={checkServiceStatus}
                        t={t}
                        user={session?.user}
                        profile={profile}
                        setShowAuthModal={setShowAuthModal}
                    />
                </div>

                {/* 6. Signature Dishes Showcase */}
                {featuredItems.length > 0 && (
                    <div className="w-full bg-[var(--color-hallmark-paper)] border-b border-[var(--color-hallmark-rule)] font-[var(--font-body)]">
                        <div className="flex items-center justify-between p-3 border-b border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper-dark)]">
                            <span className="font-mono text-[11px] font-black text-[var(--color-hallmark-ink)] uppercase tracking-wider">
                                [ 01 // SIGNATURE DISHES ]
                            </span>
                            <span className="font-mono text-[10px] text-[var(--color-brand)] font-bold">
                                RECOMMENDED
                            </span>
                        </div>

                        <div className="grid grid-cols-2 divide-x divide-y divide-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper)]">
                            {featuredItems.map((item) => (
                                <div key={item.id} className="flex flex-col justify-between bg-[var(--color-hallmark-paper)]">
                                    <div className="aspect-[4/3] w-full bg-neutral-100 dark:bg-neutral-800 relative overflow-hidden border-b border-[var(--color-hallmark-rule)]">
                                        <img 
                                            src={optimizeImageUrl(item.image_url || '/logo.png', 400)} 
                                            alt={item.name} 
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                            decoding="async"
                                            onError={(e) => {
                                                e.target.src = '/logo.png'
                                            }}
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
                                        <div className="mt-2.5 pt-2 border-t border-[var(--color-hallmark-rule)] flex items-center justify-between">
                                            <span className="font-mono text-[12px] font-bold text-[var(--color-hallmark-ink)]">
                                                ฿{item.price}
                                            </span>
                                            <Link 
                                                to="/pickup" 
                                                className="font-mono text-[9px] font-bold text-[var(--color-hallmark-ink-muted)] hover:text-[var(--color-hallmark-ink)] underline"
                                            >
                                                [ ORDER ]
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Full Menu Trigger */}
                        <Link 
                            to="/link"
                            className="w-full p-3.5 bg-[var(--color-hallmark-paper-dark)] text-[var(--color-hallmark-ink)] hover:bg-[var(--color-hallmark-ink)] hover:text-[var(--color-hallmark-paper)] transition-colors flex items-center justify-between border-t border-[var(--color-hallmark-rule)] cursor-pointer group"
                        >
                            <span className="font-mono text-[10px] font-bold tracking-widest uppercase">
                                DIGITAL MENU & BOOKLET
                            </span>
                            <span className="font-mono text-[11px] font-bold flex items-center gap-1">
                                <span>เปิดดูเมนูและราคาอาหารทั้งหมด</span> <span>➔</span>
                            </span>
                        </Link>
                    </div>
                )}

                {/* 7. How-It-Works Guide (4-Step Timeline) */}
                <div className="w-full bg-[var(--color-hallmark-paper)] border-b border-[var(--color-hallmark-rule)] p-4 flex flex-col gap-3 font-[var(--font-body)]">
                    <div className="flex items-center justify-between border-b border-[var(--color-hallmark-rule)] pb-2">
                        <span className="font-mono text-[11px] font-black text-[var(--color-hallmark-ink)] uppercase tracking-wider">
                            [ 02 // HOW TO ENGAGE ]
                        </span>
                        <span className="font-mono text-[10px] text-[var(--color-hallmark-ink-muted)]">
                            4 SIMPLE STEPS
                        </span>
                    </div>

                    <div className="flex flex-col gap-3.5 pt-1">
                        {[
                            { step: '01', title: 'เข้าสู่ระบบ LINE / เบอร์โทร', desc: 'ลงทะเบียนง่ายๆ ในหน้าแรกเพื่อบันทึกประวัติ ออเดอร์ และสะสมแต้ม xhaus' },
                            { step: '02', title: 'เลือกบริการที่ต้องการ', desc: 'กดปุ่มจองโต๊ะอาหาร เลือกลาน/โซน หรือสั่งอาหารกลับบ้านล่วงหน้า' },
                            { step: '03', title: 'ยืนยันคิว / ชำระเงินมัดจำ', desc: 'ตรวจสอบข้อมูลและยืนยัน ยอดมัดจำนำไปใช้เป็นส่วนลดค่าอาหาร 100%' },
                            { step: '04', title: 'ติดตามสถานะคำสั่งซื้อ', desc: 'ตรวจสอบสถานะอาหาร ตั๋วคิว และใบเสร็จได้แบบเรียลไทม์ผ่านเมนู TICKETS' }
                        ].map((item, idx) => (
                            <div key={idx} className="flex gap-3.5 items-start">
                                <span className="font-mono text-[11px] font-black text-[var(--color-hallmark-ink)] bg-[var(--color-hallmark-paper-dark)] border border-[var(--color-hallmark-rule)] w-7 h-7 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    {item.step}
                                </span>
                                <div className="flex flex-col text-left">
                                    <span className="font-bold text-[13px] text-[var(--color-hallmark-ink)] leading-none mb-1">
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

                {/* 8. Frequently Asked Questions Accordion */}
                <div className="w-full bg-[var(--color-hallmark-paper)] border-b border-[var(--color-hallmark-rule)] p-4 flex flex-col gap-3 font-[var(--font-body)]">
                    <div className="flex items-center justify-between border-b border-[var(--color-hallmark-rule)] pb-2">
                        <span className="font-mono text-[11px] font-black text-[var(--color-hallmark-ink)] uppercase tracking-wider">
                            [ 03 // FREQUENTLY ASKED ]
                        </span>
                        <span className="font-mono text-[10px] text-[var(--color-hallmark-ink-muted)]">
                            Q & A
                        </span>
                    </div>

                    <div className="flex flex-col gap-2 pt-1">
                        {faqItems.map((item, idx) => {
                            const isOpen = faqOpen[idx]
                            return (
                                <div key={idx} className="border border-[var(--color-hallmark-rule)] bg-[var(--color-hallmark-paper-dark)]">
                                    <button 
                                        onClick={() => toggleFaq(idx)}
                                        className="w-full flex items-center justify-between text-left p-3 text-[13px] font-bold text-[var(--color-hallmark-ink)] cursor-pointer"
                                    >
                                        <span className="pr-2">{item.q}</span>
                                        <span className="font-mono text-[10px] font-extrabold text-[var(--color-hallmark-ink-muted)] flex-shrink-0">
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
                                                <div className="px-3 pb-3 pt-1 border-t border-[var(--color-hallmark-rule)] text-[12px] text-[var(--color-hallmark-ink-muted)] leading-relaxed">
                                                    {item.a}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* 9. Live Active Orders Quick Alert Bar (if active orders exist) */}
                {activeOrders && activeOrders.length > 0 && (
                    <div className="w-full bg-[var(--color-hallmark-paper)] p-4 border-b border-[var(--color-hallmark-rule)]">
                        <button
                            onClick={() => setIsHistoryOpen(true)}
                            className="w-full p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500 text-emerald-900 dark:text-emerald-200 flex items-center justify-between cursor-pointer"
                        >
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                <span className="font-mono text-[11px] font-bold uppercase">
                                    YOU HAVE {activeOrders.length} ACTIVE ORDER(S)
                                </span>
                            </div>
                            <span className="font-mono text-[10px] font-extrabold underline">
                                [ VIEW STATUS ➔ ]
                            </span>
                        </button>
                    </div>
                )}

            </div>

            {/* 10. Bottom Tabular Navigation */}
            <HomeNavigation 
                session={session}
                userRole={userRole}
                profile={profile}
                history={history}
                setShowAuthModal={setShowAuthModal}
                setIsHistoryOpen={setIsHistoryOpen}
                handleLogout={handleLogout}
            />
            </div>
        </CasualLayout>
    )
}
