import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useBookingContext } from '../context/BookingContext'
import AuthModal from '../components/AuthModal'
import QRCode from 'qrcode'
import { LogOut, QrCode, Coins, Award, Clock, ChevronRight, User, Phone, LogIn, Sparkles, ShieldCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

export default function MemberCard() {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [tierDetails, setTierDetails] = useState({
        accumulated_spent_12m: 0,
        accumulated_spent_13m: 0,
        current_tier: 'Haus Common',
        multiplier: 1.00,
        is_in_grace_period: false
    })
    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(true)
    const [qrUrl, setQrUrl] = useState('')
    const [showAuthModal, setShowAuthModal] = useState(false)
    const { loginWithLine, logoutLine } = useBookingContext()

    // Listen for Auth session changes
    useEffect(() => {
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user) {
                setUser(session.user)
                fetchMemberData(session.user.id)
            } else {
                setLoading(false)
            }
        }
        getSession()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                setUser(session.user)
                fetchMemberData(session.user.id)
            } else {
                setUser(null)
                setProfile(null)
                setQrUrl('')
                setHistory([])
                setLoading(false)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    const fetchMemberData = async (userId) => {
        setLoading(true)
        try {
            // 1. Fetch Profile info
            const { data: prof, error: profErr } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single()

            if (profErr) throw profErr
            setProfile(prof)

            // 2. Fetch Dynamic Tier Details via RPC
            const { data: tierData, error: tierErr } = await supabase
                .rpc('get_member_tier_details', { p_user_id: userId })

            if (!tierErr && tierData && tierData.length > 0) {
                setTierDetails(tierData[0])
            }

            // 3. Generate member card QR code (Value is phone number or ID)
            const qrValue = prof.phone_number || prof.id
            const qrDataUrl = await QRCode.toDataURL(qrValue, { width: 250, margin: 1 })
            setQrUrl(qrDataUrl)

            // 4. Fetch point transaction history
            const { data: bookings, error: bErr } = await supabase
                .from('bookings')
                .select('id, created_at, total_amount, xhaus_earned, xhaus_redeemed, xhaus_discount')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })

            if (!bErr) {
                // Map bookings to points history list
                const mappedHistory = bookings
                    .filter(b => parseFloat(b.xhaus_earned) > 0 || parseFloat(b.xhaus_redeemed) > 0)
                    .map(b => ({
                        id: b.id,
                        date: new Date(b.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }),
                        title: parseFloat(b.xhaus_redeemed) > 0 ? 'แลกส่วนลดบิลอาหาร' : 'สะสมแต้มมื้ออร่อย',
                        earned: parseFloat(b.xhaus_earned),
                        redeemed: parseFloat(b.xhaus_redeemed),
                        total: b.total_amount
                    }))
                
                // Add welcome points entry if profile points earned contains initial welcome
                // Check if they got welcome points by default
                const welcomePoints = parseFloat(prof.total_earned_xhaus) - bookings.reduce((sum, b) => sum + parseFloat(b.xhaus_earned || 0), 0)
                if (welcomePoints > 0) {
                    mappedHistory.push({
                        id: 'welcome',
                        date: new Date(prof.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }),
                        title: 'โบนัสสมาชิกใหม่ต้อนรับเข้าบ้าน',
                        earned: welcomePoints,
                        redeemed: 0,
                        total: 0
                    })
                }
                setHistory(mappedHistory)
            }
        } catch (err) {
            console.error("Error fetching member data:", err)
            toast.error("ล้มเหลวในการดึงข้อมูลสมาชิก")
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        try {
            await logoutLine()
            await supabase.auth.signOut()
            toast.success("ออกจากระบบเรียบร้อยแล้ว")
        } catch (err) {
            toast.error("ล้มเหลวในการออกจากระบบ")
        }
    }

    // Tier specific card design styling configuration
    const getCardStyle = (tier) => {
        switch (tier) {
            case 'Inner Haus':
                return {
                    bg: 'bg-gradient-to-br from-[#121824] via-[#1F2937] to-[#111827] border-[#FBBF24]/60 shadow-[0_4px_30px_rgba(251,191,36,0.15)]',
                    badge: 'bg-[#FBBF24]/10 text-[#FBBF24] border-[#FBBF24]/20',
                    accentColor: 'text-[#FBBF24]',
                    labelColor: 'text-[#FBBF24]/80'
                }
            case 'Haus People':
                return {
                    bg: 'bg-gradient-to-br from-[#4A5568] via-[#718096] to-[#2D3748] border-slate-300 shadow-[0_4px_30px_rgba(226,232,240,0.15)]',
                    badge: 'bg-slate-100/10 text-slate-200 border-slate-400/20',
                    accentColor: 'text-slate-100',
                    labelColor: 'text-slate-200/80'
                }
            default: // Haus Common
                return {
                    bg: 'bg-gradient-to-br from-[#8C5D3A] via-[#A8744F] to-[#704424] border-amber-600 shadow-[0_4px_30px_rgba(180,83,9,0.15)]',
                    badge: 'bg-amber-100/10 text-amber-200 border-amber-300/20',
                    accentColor: 'text-amber-100',
                    labelColor: 'text-amber-200/80'
                }
        }
    }

    const card = getCardStyle(tierDetails.current_tier)

    if (loading) {
        return (
            <div className="min-h-screen bg-[#ECECE9] flex flex-col items-center justify-center font-sans">
                <div className="w-8 h-8 rounded-full border-2 border-t-zinc-800 border-zinc-200 animate-spin" />
                <p className="text-[10px] text-[#767673] font-mono mt-3 uppercase tracking-wider">Loading Member Card...</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#ECECE9] flex flex-col items-center p-4 font-sans text-[#1A1A1A]">
            
            {/* Header */}
            <div className="w-full max-w-md flex justify-between items-center py-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#1A1A1A] flex items-center justify-center text-[#ECECE9] font-bold text-xs">H</div>
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">IN THE HAUS</span>
                </div>
                {user && (
                    <button 
                        onClick={handleLogout}
                        className="flex items-center gap-1 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all shadow-sm cursor-pointer font-mono uppercase"
                    >
                        <LogOut size={10} /> Logout
                    </button>
                )}
            </div>

            {/* Content Container */}
            <div className="w-full max-w-md flex-grow flex flex-col gap-6">
                
                <AnimatePresence mode="wait">
                    {!user ? (
                        /* LANDING & REGISTRATION VIEW */
                        <motion.div 
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            className="bg-white border border-[#D1D1CD] rounded-2xl p-6 shadow-sm flex flex-col gap-6"
                        >
                            <div className="text-center space-y-3">
                                <div className="w-12 h-12 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center mx-auto text-[#FF5500] animate-bounce">
                                    <Sparkles size={24} />
                                </div>
                                <h1 className="text-xl font-extrabold text-[#1A1A1A]">สมัครสมาชิก In The Haus</h1>
                                <p className="text-[10px] text-[#767673] font-mono leading-relaxed px-4">
                                    "ยิ่งกลับมา บ้านยิ่งจำคุณได้ ทุกการใช้จ่ายจะพาคุณเข้าใกล้ความเป็นคนในบ้านมากขึ้น"
                                </p>
                            </div>

                            {/* Welcome Perk Card */}
                            <div className="bg-[#FFF9E6] border border-[#E5A900] rounded-xl p-4 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-[#FFAA00]/20 flex items-center justify-center text-[#E5A900] shrink-0 font-bold">
                                    🪙
                                </div>
                                <div className="space-y-0.5">
                                    <h4 className="text-[11px] font-extrabold text-amber-900">โบนัสต้อนรับสมาชิกใหม่!</h4>
                                    <p className="text-[9px] text-amber-800/80 font-medium">สมัครสมาชิกวันนี้ รับฟรีทันที 10 xhaus สมัครด่วนใน 10 วินาที</p>
                                </div>
                            </div>

                            {/* Perks Bullet List */}
                            <div className="space-y-3 bg-[#F5F5F2] p-4 rounded-xl border border-[#D1D1CD]">
                                <h4 className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#767673] border-b border-[#D1D1CD] pb-2">สิทธิประโยชน์พิเศษของคุณ</h4>
                                <ul className="space-y-2 text-[10px] text-[#1A1A1A]">
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#00CC44] font-bold">✓</span>
                                        <span>สะสมเหรียญ xhaus ในทุกๆ ยอดชำระเงิน</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#00CC44] font-bold">✓</span>
                                        <span>ใช้ xhaus แลกส่วนลดแทนเงินสด (1 xhaus = 1 บาท)</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#00CC44] font-bold">✓</span>
                                        <span>ขยับระดับความสัมพันธ์เพื่อรับสิทธิ์คูณแต้ม สูงสุดถึง 1.5 เท่า</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Register Buttons */}
                            <div className="flex flex-col gap-2 pt-2">
                                <button
                                    onClick={loginWithLine}
                                    className="w-full bg-[#06C755] hover:bg-[#05b34c] text-white py-3 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                                >
                                    <LogIn size={14} /> สมัครสมาชิกผ่าน LINE (แนะนำ)
                                </button>
                                <button
                                    onClick={() => setShowAuthModal(true)}
                                    className="w-full bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-700 py-3 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-sm font-sans"
                                >
                                    <Phone size={14} /> ใช้เบอร์โทรศัพท์ / อีเมล
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        /* DIGITAL MEMBERSHIP CARD & DETAILS */
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            className="space-y-6"
                        >
                            {/* The Glassmorphism Membership Card */}
                            <div className={`relative border p-6 rounded-2xl flex flex-col justify-between h-56 text-white overflow-hidden transition-all ${card.bg}`}>
                                {/* Gloss highlight */}
                                <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-2xl transform translate-x-12 -translate-y-12" />
                                
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <span className="text-[8px] font-mono font-bold uppercase tracking-widest opacity-80">MEMBER CARD</span>
                                        <h2 className="text-sm font-extrabold tracking-tight truncate max-w-[200px]">{profile?.display_name || 'Anonymous Member'}</h2>
                                        <p className="text-[9px] font-mono opacity-85">{profile?.phone_number || '-'}</p>
                                    </div>
                                    <span className={`px-2 py-0.5 border text-[9px] font-mono font-bold rounded uppercase tracking-wider ${card.badge}`}>
                                        {tierDetails.current_tier}
                                    </span>
                                </div>

                                <div className="flex justify-between items-end">
                                    <div>
                                        <span className={`text-[8px] font-mono font-bold uppercase tracking-wider ${card.labelColor}`}>xhaus Balance</span>
                                        <p className="text-3xl font-mono font-bold leading-none mt-1 flex items-baseline gap-1">
                                            {parseFloat(profile?.xhaus_balance || 0).toFixed(2)}
                                            <span className="text-xs font-bold uppercase">coins</span>
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-[8px] font-mono font-bold uppercase tracking-wider ${card.labelColor}`}>Earn Rate</span>
                                        <p className="text-xs font-mono font-bold mt-1">100 บาท = {tierDetails.multiplier} xhaus</p>
                                    </div>
                                </div>
                            </div>

                            {/* Grace Period Notification Banner */}
                            {tierDetails.is_in_grace_period && (
                                <div className="bg-[#FFF9E6] border border-[#E5A900] p-3 rounded-xl flex items-start gap-2.5">
                                    <ShieldCheck size={16} className="text-[#E5A900] shrink-0 mt-0.5" />
                                    <div className="space-y-0.5">
                                        <h5 className="text-[10px] font-extrabold text-amber-900">อยู่ในช่วงผ่อนผันระดับสมาชิกรักษาใจ</h5>
                                        <p className="text-[8px] text-amber-800/80 font-medium">ยอดสะสม 12 เดือนน้อยลงเล็กน้อย ร้านขอตรึงสิทธิ์ของคนในบ้านระดับ {tierDetails.current_tier} ให้คุณต่ออีก 30 วันครับ</p>
                                    </div>
                                </div>
                            )}

                            {/* Membership QR Code Section */}
                            <div className="bg-white border border-[#D1D1CD] p-6 rounded-2xl shadow-sm flex flex-col items-center gap-3">
                                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#1A1A1A] flex items-center gap-1.5">
                                    <QrCode size={14} /> SCAN TO EARN / REDEEM
                                </h3>
                                <p className="text-[9px] text-[#767673] font-medium leading-relaxed px-6 text-center">
                                    เปิดหน้านี้เพื่อยื่นคิวอาร์โค้ดให้พนักงานแสกนเช็คบิลที่แท็บเล็ตแคชเชียร์ของร้านเพื่อสะสมแต้ม หรือแจ้งสิทธิ์แลกแต้มแทนเงินสดได้ทันที
                                </p>

                                <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-xl flex items-center justify-center shadow-inner">
                                    {qrUrl ? (
                                        <img src={qrUrl} alt="Member Card QR Code" className="w-40 h-40" />
                                    ) : (
                                        <div className="w-40 h-40 flex items-center justify-center font-mono text-[9px] text-zinc-400">Loading QR...</div>
                                    )}
                                </div>
                                <span className="font-mono text-[9px] text-zinc-400 select-all border border-zinc-200 px-3 py-1 rounded bg-zinc-50 font-bold">
                                    ID: {profile?.phone_number || profile?.id}
                                </span>
                            </div>

                            {/* Tiers Multiplier Info Card */}
                            <div className="bg-white border border-[#D1D1CD] p-6 rounded-2xl shadow-sm space-y-4">
                                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#1A1A1A] flex items-center gap-1.5 border-b border-[#F5F5F2] pb-3">
                                    <Award size={14} /> ระดับความสัมพันธ์ของคุณ
                                </h3>

                                <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                                    <div className={`p-2.5 rounded-xl border ${tierDetails.current_tier === 'Haus Common' ? 'bg-amber-500/10 border-amber-500 font-extrabold text-amber-900' : 'bg-[#F5F5F2] border-transparent opacity-65 text-subInk'}`}>
                                        <span className="block text-[8px] font-mono font-bold uppercase tracking-wider mb-0.5">Level 01</span>
                                        <span className="block text-xs font-bold leading-tight">Haus Common</span>
                                        <span className="block text-[8px] font-mono mt-1">คูณ 1.0x</span>
                                    </div>
                                    <div className={`p-2.5 rounded-xl border ${tierDetails.current_tier === 'Haus People' ? 'bg-slate-400/20 border-slate-500 font-extrabold text-slate-900' : 'bg-[#F5F5F2] border-transparent opacity-65 text-subInk'}`}>
                                        <span className="block text-[8px] font-mono font-bold uppercase tracking-wider mb-0.5">Level 02</span>
                                        <span className="block text-xs font-bold leading-tight">Haus People</span>
                                        <span className="block text-[8px] font-mono mt-1">คูณ 1.25x</span>
                                    </div>
                                    <div className={`p-2.5 rounded-xl border ${tierDetails.current_tier === 'Inner Haus' ? 'bg-[#FBBF24]/10 border-[#FBBF24] font-extrabold text-[#9A7000]' : 'bg-[#F5F5F2] border-transparent opacity-65 text-subInk'}`}>
                                        <span className="block text-[8px] font-mono font-bold uppercase tracking-wider mb-0.5">Level 03</span>
                                        <span className="block text-xs font-bold leading-tight">Inner Haus</span>
                                        <span className="block text-[8px] font-mono mt-1">คูณ 1.5x</span>
                                    </div>
                                </div>
                                <p className="text-[9px] text-[#767673] font-medium leading-relaxed border-t border-[#F5F5F2] pt-3 text-center">
                                    คำนวณจากยอดสะสมย้อนหลัง 12 เดือน: <strong className="text-[#1A1A1A]">{parseFloat(tierDetails.accumulated_spent_12m).toLocaleString()} บาท</strong>
                                </p>
                            </div>

                            {/* Transaction History Log */}
                            <div className="bg-white border border-[#D1D1CD] p-6 rounded-2xl shadow-sm space-y-4">
                                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#1A1A1A] flex items-center gap-1.5 border-b border-[#F5F5F2] pb-3">
                                    <Clock size={14} /> ประวัติเหรียญสะสม
                                </h3>

                                <div className="space-y-3">
                                    {history.length === 0 ? (
                                        <p className="text-center font-mono text-[9px] text-zinc-400 py-4">ยังไม่มีประวัติการสะสมคะแนนเหรียญ</p>
                                    ) : (
                                        history.map((h, idx) => (
                                            <div key={h.id + idx} className="flex justify-between items-center text-[10px] border-b border-[#F5F5F2] pb-2 last:border-b-0">
                                                <div className="space-y-0.5">
                                                    <h4 className="font-bold text-[#1A1A1A]">{h.title}</h4>
                                                    <span className="text-[8px] font-mono text-zinc-400">{h.date}</span>
                                                </div>
                                                <div className="text-right">
                                                    {h.earned > 0 && (
                                                        <span className="font-mono font-bold text-[#00CC44] font-medium">+{h.earned.toFixed(2)} xhaus</span>
                                                    )}
                                                    {h.redeemed > 0 && (
                                                        <span className="font-mono font-bold text-red-500 font-medium">-{h.redeemed.toFixed(2)} xhaus</span>
                                                    )}
                                                    {h.total > 0 && (
                                                        <p className="text-[8px] text-[#767673] font-mono mt-0.5">ยอดบิล: {h.total.toLocaleString()}.-</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Auth Modal Portal */}
            <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
        </div>
    )
}
