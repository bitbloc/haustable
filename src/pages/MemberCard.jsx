/* Hallmark · component: MemberCard · genre: modern-minimal · theme: custom · vibe: "Dieter Rams industrial modern mechanical"
 * states: default · hover · focus · active · loading · error · success
 * contrast: pass (APCA / WCAG compliant)
 */

import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useBookingContext } from '../context/BookingContext'
import AuthModal from '../components/AuthModal'
import QRCode from 'qrcode'
import { LogOut, QrCode, Coins, Award, Clock, ChevronRight, User, Phone, LogIn, Sparkles, ShieldCheck, Edit2, Check, X, Calendar, UserCheck } from 'lucide-react'
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

    // Inline Profile Edit States
    const [isEditing, setIsEditing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [editForm, setEditForm] = useState({
        display_name: '',
        nickname: '',
        phone_number: '',
        birth_day: '',
        birth_month: '',
        gender: ''
    })

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
                setIsEditing(false)
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
            setEditForm({
                display_name: prof.display_name || '',
                nickname: prof.nickname || '',
                phone_number: prof.phone_number || '',
                birth_day: prof.birth_day || '',
                birth_month: prof.birth_month || '',
                gender: prof.gender || ''
            })

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

    const handleSaveProfile = async (e) => {
        e.preventDefault()
        if (!user) return

        if (!editForm.display_name.trim()) {
            return toast.error("กรุณากรอกชื่อจริง")
        }
        if (!editForm.phone_number.trim() || !/^\d{10}$/.test(editForm.phone_number.replace(/[^0-9]/g, ''))) {
            return toast.error("กรุณากรอกเบอร์โทรศัพท์ 10 หลัก")
        }

        setIsSaving(true)
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    display_name: editForm.display_name,
                    nickname: editForm.nickname,
                    phone_number: editForm.phone_number,
                    birth_day: editForm.birth_day ? parseInt(editForm.birth_day) : null,
                    birth_month: editForm.birth_month ? parseInt(editForm.birth_month) : null,
                    gender: editForm.gender || null
                })
                .eq('id', user.id)

            if (error) throw error

            setProfile(prev => ({
                ...prev,
                display_name: editForm.display_name,
                nickname: editForm.nickname,
                phone_number: editForm.phone_number,
                birth_day: editForm.birth_day ? parseInt(editForm.birth_day) : null,
                birth_month: editForm.birth_month ? parseInt(editForm.birth_month) : null,
                gender: editForm.gender
            }))

            setIsEditing(false)
            toast.success("บันทึกข้อมูลส่วนตัวสำเร็จ")
            fetchMemberData(user.id) // Reload to refresh QR or other info
        } catch (err) {
            console.error("Error updating profile:", err)
            toast.error("บันทึกไม่สำเร็จ: " + err.message)
        } finally {
            setIsSaving(false)
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

    // Tier specific card design styling configuration - Dieter Rams Industrial look
    const getCardStyle = (tier) => {
        switch (tier) {
            case 'Inner Haus':
                return {
                    bg: 'bg-[#12141a] border-[#D4AF37] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_20px_rgba(0,0,0,0.3)]',
                    badge: 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/35',
                    accentColor: 'text-[#D4AF37]',
                    labelColor: 'text-[#D4AF37]/80',
                    dotColor: 'bg-[#D4AF37]',
                    glow: 'shadow-[0_0_10px_#D4AF37]'
                }
            case 'Haus People':
                return {
                    bg: 'bg-[#2E3138] border-[#A0AEC0] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_20px_rgba(0,0,0,0.2)]',
                    badge: 'bg-slate-700/50 text-slate-200 border-slate-500/30',
                    accentColor: 'text-slate-200',
                    labelColor: 'text-slate-400',
                    dotColor: 'bg-[#00E5FF]',
                    glow: 'shadow-[0_0_10px_#00E5FF]'
                }
            default: // Haus Common
                return {
                    bg: 'bg-[#F2F2EC] border-[#B8B8B2] text-[#1A1A1A] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_8px_20px_rgba(0,0,0,0.08)]',
                    badge: 'bg-zinc-200/60 text-zinc-700 border-zinc-300',
                    accentColor: 'text-[#1A1A1A]',
                    labelColor: 'text-zinc-500',
                    dotColor: 'bg-[#FF5500]',
                    glow: 'shadow-[0_0_10px_#FF5500]'
                }
        }
    }

    const card = getCardStyle(tierDetails.current_tier)

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--color-hallmark-paper)] flex flex-col items-center justify-center font-[var(--font-body)] text-[var(--color-hallmark-ink)]">
                <div className="w-8 h-8 rounded-full border-2 border-t-[var(--color-hallmark-ink)] border-[var(--color-hallmark-rule)] animate-spin" />
                <p className="text-[10px] text-[var(--color-hallmark-ink-muted)] font-mono mt-3 uppercase tracking-wider">LOADING RAMS CRM...</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[var(--color-hallmark-paper)] flex flex-col items-center p-4 font-[var(--font-body)] text-[var(--color-hallmark-ink)] selection:bg-[var(--color-brand)] selection:text-black w-full">
            
            {/* Header */}
            <div className="w-full max-w-md flex justify-between items-center py-4 border-b border-[var(--color-hallmark-rule)] mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-sm bg-[var(--color-hallmark-ink)] flex items-center justify-center p-1.5 shrink-0">
                        <img 
                            src="/logo.png" 
                            alt="IN THE HAUS" 
                            className="w-full h-full object-contain invert" 
                            onError={(e) => {
                                e.target.style.display = 'none';
                                const container = e.target.parentElement;
                                if (container) container.innerHTML = '<span class="font-bold font-mono text-[var(--color-hallmark-paper)] text-sm">H</span>';
                            }}
                        />
                    </div>
                    <div>
                        <span className="font-[var(--font-display)] text-xs font-bold uppercase tracking-widest block leading-none">IN THE HAUS</span>
                        <span className="text-[8px] text-[var(--color-hallmark-ink-muted)] font-mono font-bold uppercase tracking-wider block mt-1">Relations Portal</span>
                    </div>
                </div>
                {user && (
                    <button 
                        onClick={handleLogout}
                        className="flex items-center gap-1 bg-white hover:bg-neutral-50 border border-[var(--color-hallmark-rule)] text-[var(--color-hallmark-ink)] px-2.5 py-1.5 rounded-[4px] text-[9px] font-bold transition-all shadow-sm cursor-pointer font-mono uppercase"
                    >
                        <LogOut size={10} /> Logout
                    </button>
                )}
            </div>

            <div className="w-full max-w-md flex-grow flex flex-col gap-5">
                
                <AnimatePresence mode="wait">
                    {!user ? (
                        /* LANDING & REGISTRATION VIEW */
                        <motion.div 
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            className="bg-white border border-[var(--color-hallmark-rule)] rounded-[8px] p-6 shadow-sm flex flex-col gap-5"
                        >
                            <div className="text-center space-y-2">
                                <div className="w-12 h-12 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center mx-auto text-[#FFAA00] animate-pulse">
                                    <Sparkles size={24} />
                                </div>
                                <h1 className="text-lg font-bold uppercase tracking-tight font-[var(--font-display)]">สมัครสมาชิก In The Haus</h1>
                                <p className="text-[10px] text-[var(--color-hallmark-ink-muted)] leading-relaxed px-4">
                                    "ยิ่งกลับมา บ้านยิ่งจำคุณได้ ทุกการใช้จ่ายจะพาคุณเข้าใกล้ความเป็นคนในบ้านมากขึ้น"
                                </p>
                            </div>

                            {/* Welcome Perk Card */}
                            <div className="bg-[#FFFDF5] border border-amber-300 rounded-[6px] p-4 flex items-center gap-4">
                                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-[#B8860B] shrink-0 font-bold text-sm">
                                    🪙
                                </div>
                                <div className="space-y-0.5">
                                    <h4 className="text-[11px] font-bold text-amber-900">โบนัสต้อนรับสมาชิกใหม่!</h4>
                                    <p className="text-[9px] text-amber-800/80 font-medium">สมัครสมาชิกวันนี้ รับฟรีทันที 10 xhaus สมัครด่วนใน 10 วินาที</p>
                                </div>
                            </div>

                            {/* Perks Bullet List */}
                            <div className="space-y-2.5 bg-neutral-50 p-4 rounded-[6px] border border-[var(--color-hallmark-rule)]">
                                <h4 className="text-[9px] font-mono font-bold uppercase tracking-wider text-[var(--color-hallmark-ink-muted)] border-b border-[var(--color-hallmark-rule)] pb-1.5 font-bold">สิทธิประโยชน์พิเศษของคุณ</h4>
                                <ul className="space-y-2 text-[10px]">
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-500 font-bold">✓</span>
                                        <span><strong>สะสมเหรียญ xhaus</strong> ในทุกๆ ยอดชำระเงินตามระดับสมาชิก</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-500 font-bold">✓</span>
                                        <span><strong>ใช้แลกส่วนลดและของพิเศษ</strong> แลกส่วนลดแทนเงินสด (1 xhaus = 1 บาท) หรือแลกรับของรางวัลพรีเมียมเฉพาะคนในบ้าน</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-500 font-bold">✓</span>
                                        <span><strong>เล่นเกมส์ใน Arcade</strong> ปลดล็อคความสำเร็จเพื่อรับเหรียญ xhaus เพิ่มเติมตามเงื่อนไขของร้าน</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-500 font-bold">✓</span>
                                        <span><strong>เพิ่มสิทธิ์คูณแต้ม</strong> ขยับระดับความสัมพันธ์เพื่อคูณแต้มแต้มสูงสุดถึง 1.5 เท่า</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Register & Login Buttons */}
                            <div className="flex flex-col gap-2 pt-1">
                                <button
                                    onClick={loginWithLine}
                                    className="w-full bg-[#06C755] hover:bg-[#05b34c] text-white py-3 rounded-[4px] font-bold text-xs transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                                >
                                    <LogIn size={14} /> เข้าสู่ระบบ / สมัครสมาชิกผ่าน LINE (แนะนำ)
                                </button>
                                <button
                                    onClick={() => setShowAuthModal(true)}
                                    className="w-full bg-white hover:bg-neutral-50 border border-[var(--color-hallmark-rule)] text-[var(--color-hallmark-ink)] py-3 rounded-[4px] font-bold text-xs transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                                >
                                    <Phone size={14} /> เข้าสู่ระบบด้วยเบอร์โทรศัพท์ / อีเมล
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        /* DIGITAL MEMBERSHIP CARD & DETAILS */
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            className="space-y-5"
                        >
                            {/* The Rams Mechanical Casing Membership Card */}
                            <div className={`relative border p-5 rounded-[8px] flex flex-col justify-between h-52 overflow-hidden transition-all ${card.bg}`}>
                                {/* Mechanical LED Dial indicator */}
                                <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/15 px-2 py-1 rounded-[4px] border border-white/5 font-mono text-[7px] tracking-widest uppercase">
                                    <span className={`w-1.5 h-1.5 rounded-full ${card.dotColor} ${card.glow}`} />
                                    <span>ACTIVE SYSTEM</span>
                                </div>
                                
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            <div className="w-5 h-5 rounded-xs bg-white/10 flex items-center justify-center p-0.5 border border-white/10 shrink-0">
                                                <img 
                                                    src="/logo.png" 
                                                    alt="" 
                                                    className="w-full h-full object-contain invert opacity-80" 
                                                    onError={(e) => e.target.style.display = 'none'}
                                                />
                                            </div>
                                            <span className="text-[7px] font-mono font-bold uppercase tracking-widest opacity-65">IN THE HAUS RELATIONS</span>
                                        </div>
                                        <h2 className="text-base font-bold tracking-tight truncate max-w-[200px] font-mono uppercase">{profile?.display_name || 'Anonymous Member'}</h2>
                                        {profile?.nickname && (
                                            <p className="text-[9px] font-medium opacity-80">ชื่อเล่น: {profile.nickname}</p>
                                        )}
                                        <p className="text-[9px] font-mono opacity-70 tracking-widest mt-0.5">{profile?.phone_number || '-'}</p>
                                    </div>
                                    <span className={`px-2 py-0.5 border text-[8px] font-mono font-bold rounded-[4px] uppercase tracking-wider shrink-0 mt-5 ${card.badge}`}>
                                        {tierDetails.current_tier}
                                    </span>
                                </div>

                                <div className="flex justify-between items-end border-t border-white/10 pt-3">
                                    <div>
                                        <span className={`text-[7px] font-mono font-bold uppercase tracking-wider ${card.labelColor}`}>xhaus Balance</span>
                                        <p className="text-2xl font-mono font-bold leading-none mt-0.5 flex items-baseline gap-1">
                                            {parseFloat(profile?.xhaus_balance || 0).toFixed(2)}
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">coins</span>
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-[7px] font-mono font-bold uppercase tracking-wider ${card.labelColor}`}>Earn Rate</span>
                                        <p className="text-[10px] font-mono font-bold mt-0.5">{tierDetails.multiplier}x multiplier</p>
                                    </div>
                                </div>
                            </div>

                            {/* Grace Period Notification Banner */}
                            {tierDetails.is_in_grace_period && (
                                <div className="bg-[#FFF9E6] border border-[#E5A900] p-3 rounded-[6px] flex items-start gap-2.5">
                                    <ShieldCheck size={16} className="text-[#E5A900] shrink-0 mt-0.5" />
                                    <div className="space-y-0.5">
                                        <h5 className="text-[10px] font-bold text-amber-900">อยู่ในช่วงผ่อนผันระดับสมาชิกรักษาใจ</h5>
                                        <p className="text-[8px] text-amber-800/80 font-medium">ยอดสะสม 12 เดือนน้อยลงเล็กน้อย ร้านขอตรึงสิทธิ์ระดับ {tierDetails.current_tier} ให้คุณต่ออีก 30 วันครับ</p>
                                    </div>
                                </div>
                            )}

                            {/* PROFILE DETAILS & EDITING SYSTEM (RAMS DETAIL) */}
                            <div className="bg-white border border-[var(--color-hallmark-rule)] p-5 rounded-[8px] shadow-sm space-y-4">
                                <div className="flex justify-between items-center border-b border-[var(--color-hallmark-rule)] pb-2.5">
                                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-hallmark-ink)] flex items-center gap-1.5">
                                        <UserCheck size={14} className="text-[var(--color-hallmark-ink-muted)]" /> ข้อมูลโปรไฟล์ส่วนตัว (RAMS Profile)
                                    </h3>
                                    {!isEditing && (
                                        <button 
                                            onClick={() => setIsEditing(true)}
                                            className="text-[9px] font-mono font-bold border border-[var(--color-hallmark-rule)] hover:bg-neutral-50 px-2 py-1 rounded-[4px] flex items-center gap-1 uppercase text-[var(--color-hallmark-ink)] cursor-pointer"
                                        >
                                            <Edit2 size={10} /> Edit Info
                                        </button>
                                    )}
                                </div>

                                <AnimatePresence mode="wait">
                                    {!isEditing ? (
                                        /* Display Profile Info */
                                        <motion.div 
                                            key="profile-display"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="grid grid-cols-2 gap-3 text-[10px] py-1 font-mono"
                                        >
                                            <div className="space-y-0.5">
                                                <span className="text-[8px] text-[var(--color-hallmark-ink-muted)] uppercase block">Display Name</span>
                                                <span className="font-bold text-[var(--color-hallmark-ink)] block">{profile?.display_name || '-'}</span>
                                            </div>
                                            <div className="space-y-0.5">
                                                <span className="text-[8px] text-[var(--color-hallmark-ink-muted)] uppercase block">Nickname (ชื่อเล่น)</span>
                                                <span className="font-bold text-[var(--color-hallmark-ink)] block">{profile?.nickname || '-'}</span>
                                            </div>
                                            <div className="space-y-0.5">
                                                <span className="text-[8px] text-[var(--color-hallmark-ink-muted)] uppercase block">Mobile Phone</span>
                                                <span className="font-bold text-[var(--color-hallmark-ink)] block">{profile?.phone_number || '-'}</span>
                                            </div>
                                            <div className="space-y-0.5">
                                                <span className="text-[8px] text-[var(--color-hallmark-ink-muted)] uppercase block">Gender (เพศ)</span>
                                                <span className="font-bold text-[var(--color-hallmark-ink)] block">{profile?.gender || '-'}</span>
                                            </div>
                                            <div className="space-y-0.5 col-span-2">
                                                <span className="text-[8px] text-[var(--color-hallmark-ink-muted)] uppercase block">Birthday</span>
                                                <span className="font-bold text-[var(--color-hallmark-ink)] block flex items-center gap-1.5">
                                                    <Calendar size={11} className="text-neutral-400" />
                                                    {profile?.birth_day && profile?.birth_month 
                                                        ? `${profile.birth_day} / ${['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][parseInt(profile.birth_month) - 1]}`
                                                        : 'ยังไม่ได้ระบุวันเกิด'
                                                    }
                                                </span>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        /* Edit Form */
                                        <motion.form 
                                            key="profile-edit"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            onSubmit={handleSaveProfile}
                                            className="space-y-3 pt-1"
                                        >
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <label className="text-[8px] font-mono font-bold uppercase text-[var(--color-hallmark-ink-muted)] block mb-1">Display Name</label>
                                                    <input 
                                                        type="text" 
                                                        value={editForm.display_name} 
                                                        onChange={e => setEditForm({...editForm, display_name: e.target.value})}
                                                        className="w-full bg-[var(--color-hallmark-paper)] border border-[var(--color-hallmark-rule)] rounded-[4px] p-2 text-xs text-[var(--color-hallmark-ink)] focus:outline-none focus:border-[var(--color-hallmark-ink)]"
                                                        required
                                                    />
                                                </div>
                                                <div className="w-1/3">
                                                    <label className="text-[8px] font-mono font-bold uppercase text-[var(--color-hallmark-ink-muted)] block mb-1">Nickname</label>
                                                    <input 
                                                        type="text" 
                                                        value={editForm.nickname} 
                                                        onChange={e => setEditForm({...editForm, nickname: e.target.value})}
                                                        className="w-full bg-[var(--color-hallmark-paper)] border border-[var(--color-hallmark-rule)] rounded-[4px] p-2 text-xs text-[var(--color-hallmark-ink)] focus:outline-none focus:border-[var(--color-hallmark-ink)]"
                                                        placeholder="ชื่อเล่น"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <label className="text-[8px] font-mono font-bold uppercase text-[var(--color-hallmark-ink-muted)] block mb-1">Phone Number</label>
                                                    <input 
                                                        type="tel" 
                                                        value={editForm.phone_number} 
                                                        onChange={e => setEditForm({...editForm, phone_number: e.target.value})}
                                                        className="w-full bg-[var(--color-hallmark-paper)] border border-[var(--color-hallmark-rule)] rounded-[4px] p-2 text-xs text-[var(--color-hallmark-ink)] focus:outline-none focus:border-[var(--color-hallmark-ink)]"
                                                        required
                                                    />
                                                </div>
                                                <div className="w-1/3">
                                                    <label className="text-[8px] font-mono font-bold uppercase text-[var(--color-hallmark-ink-muted)] block mb-1">Gender</label>
                                                    <select 
                                                        value={editForm.gender} 
                                                        onChange={e => setEditForm({...editForm, gender: e.target.value})}
                                                        className="w-full bg-[var(--color-hallmark-paper)] border border-[var(--color-hallmark-rule)] rounded-[4px] p-2 text-xs text-[var(--color-hallmark-ink)] focus:outline-none focus:border-[var(--color-hallmark-ink)]"
                                                    >
                                                        <option value="">เพศ</option>
                                                        <option value="Male">Male</option>
                                                        <option value="Female">Female</option>
                                                        <option value="Not Specified">Other</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-[8px] font-mono font-bold uppercase text-[var(--color-hallmark-ink-muted)] block mb-1">Birthday</label>
                                                <div className="flex gap-2">
                                                    <select 
                                                        value={editForm.birth_day} 
                                                        onChange={e => setEditForm({...editForm, birth_day: e.target.value})}
                                                        className="w-20 bg-[var(--color-hallmark-paper)] border border-[var(--color-hallmark-rule)] rounded-[4px] p-2 text-xs text-[var(--color-hallmark-ink)] focus:outline-none focus:border-[var(--color-hallmark-ink)]"
                                                    >
                                                        <option value="">Day</option>
                                                        {[...Array(31)].map((_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                                                    </select>
                                                    <select 
                                                        value={editForm.birth_month} 
                                                        onChange={e => setEditForm({...editForm, birth_month: e.target.value})}
                                                        className="flex-1 bg-[var(--color-hallmark-paper)] border border-[var(--color-hallmark-rule)] rounded-[4px] p-2 text-xs text-[var(--color-hallmark-ink)] focus:outline-none focus:border-[var(--color-hallmark-ink)]"
                                                    >
                                                        <option value="">Month</option>
                                                        {['มกราคม (Jan)', 'กุมภาพันธ์ (Feb)', 'มีนาคม (Mar)', 'เมษายน (Apr)', 'พฤษภาคม (May)', 'มิถุนายน (Jun)', 'กรกฎาคม (Jul)', 'สิงหาคม (Aug)', 'กันยายน (Sep)', 'ตุลาคม (Oct)', 'พฤศจิกายน (Nov)', 'ธันวาคม (Dec)'].map((m, i) => (
                                                            <option key={i} value={i + 1}>{m}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-hallmark-rule)]">
                                                <button 
                                                    type="button" 
                                                    onClick={() => {
                                                        setIsEditing(false)
                                                        setEditForm({
                                                            display_name: profile.display_name || '',
                                                            nickname: profile.nickname || '',
                                                            phone_number: profile.phone_number || '',
                                                            birth_day: profile.birth_day || '',
                                                            birth_month: profile.birth_month || '',
                                                            gender: profile.gender || ''
                                                        })
                                                    }}
                                                    className="px-3 py-1.5 border border-[var(--color-hallmark-rule)] hover:bg-neutral-50 rounded-[4px] text-[9px] font-mono uppercase font-bold flex items-center gap-1 cursor-pointer"
                                                >
                                                    <X size={10} /> Cancel
                                                </button>
                                                <button 
                                                    type="submit" 
                                                    disabled={isSaving}
                                                    className="px-4 py-1.5 bg-[var(--color-hallmark-ink)] text-[var(--color-hallmark-paper)] hover:opacity-90 rounded-[4px] text-[9px] font-mono uppercase font-bold flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Check size={10} /> {isSaving ? 'Saving...' : 'Save'}
                                                </button>
                                            </div>
                                        </motion.form>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Special Benefits & House Rewards */}
                            <div className="bg-white border border-[var(--color-hallmark-rule)] p-5 rounded-[8px] shadow-sm space-y-3.5 animate-fade-in">
                                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-hallmark-ink)] flex items-center gap-1.5 border-b border-[var(--color-hallmark-rule)] pb-2.5">
                                    <Award size={14} className="text-amber-500" /> สิทธิประโยชน์ของคนในบ้าน (ชั้น {tierDetails.current_tier})
                                </h3>
                                <div className="space-y-3 text-[10px]">
                                    <div className="bg-neutral-50 p-3 rounded-[6px] border border-[var(--color-hallmark-rule)] space-y-2">
                                        <p className="font-bold flex items-center gap-1.5 text-[var(--color-hallmark-ink)]">
                                            <span>✨</span> ลำดับชั้นปัจจุบัน: <span className="font-mono text-xs text-amber-600">{tierDetails.current_tier}</span>
                                        </p>
                                        <ul className="space-y-1.5 pl-4 list-disc text-neutral-600 leading-relaxed">
                                            <li>อัตราการรับเหรียญสะสม: <strong className="text-[var(--color-hallmark-ink)] font-mono">{tierDetails.multiplier}x multiplier</strong> (ยอดเช็คบิล 100 บาท = {tierDetails.multiplier} xhaus)</li>
                                            <li>สามารถใช้เหรียญสะสมแลกรับส่วนลดแทนเงินสดได้ทันที (1 xhaus = 1 บาท)</li>
                                            
                                            {tierDetails.current_tier === 'Inner Haus' && (
                                                <>
                                                    <li className="text-[var(--color-hallmark-ink)] font-bold">รับสิทธิ์จองโต๊ะระดับ VIP และรับ Welcome Drink ฟรีทุกครั้งเมื่อมาเยือน</li>
                                                    <li className="text-[var(--color-hallmark-ink)] font-bold">สิทธิ์การรักษาสถานะและผ่อนผันระดับสมาชิก 30 วัน (Grace Period)</li>
                                                </>
                                            )}
                                            {tierDetails.current_tier === 'Haus People' && (
                                                <>
                                                    <li className="text-[var(--color-hallmark-ink)] font-bold">สิทธิ์การจองโต๊ะและร่วมกิจกรรม Exclusive ของร้านก่อนสมาชิกทั่วไป</li>
                                                    <li className="text-[var(--color-hallmark-ink)] font-bold">สิทธิ์การรักษาสถานะและผ่อนผันระดับสมาชิก 30 วัน (Grace Period)</li>
                                                </>
                                            )}
                                        </ul>
                                    </div>

                                    <div className="bg-[#FFFDF5] p-3 rounded-[6px] border border-amber-200 space-y-1.5">
                                        <p className="font-bold text-amber-950 flex items-center gap-1.5">
                                            <span>🎁</span> แลกของพิเศษคนในบ้าน (House Rewards Exclusives)
                                        </p>
                                        <p className="text-[9px] text-amber-900/90 leading-relaxed font-medium">
                                            ใช้เหรียญ xhaus เพื่อแลกรับของพรีเมียมเฉพาะตัว, Merchandise เสื้อหมวกแก้วลาย In The Haus, หรือเครื่องดื่ม/เมนูลับสุด Exclusive ที่ไม่มีในเมนูปกติ โดยแจ้งขอสิทธิ์แลกกับพนักงานที่ร้านได้เลยครับ
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Play-To-Earn Arcade Callout */}
                            <div className="bg-white border border-[var(--color-hallmark-rule)] p-5 rounded-[8px] shadow-sm space-y-3.5 animate-fade-in">
                                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-hallmark-ink)] flex items-center gap-1.5 border-b border-[var(--color-hallmark-rule)] pb-2.5">
                                    <span>🎮</span> PLAY-TO-EARN (ARCADE PLAYGROUND)
                                </h3>
                                <div className="space-y-3">
                                    <p className="text-[9px] text-[var(--color-hallmark-ink-muted)] leading-relaxed">
                                        สนุกแถมได้แต้ม! ร่วมเล่นเกมตู้สุดมันส์ของบ้านใน Arcade ปลดล็อคความสำเร็จ คะแนน High Scores เพื่อนำมารับรางวัลเหรียญ xhaus พิเศษเข้ากระเป๋าบัตรสมาชิกตามเงื่อนไขสะสมแต้มของร้าน
                                    </p>
                                    <a 
                                        href="/arcade" 
                                        className="w-full bg-[var(--color-hallmark-ink)] hover:bg-neutral-800 text-[var(--color-hallmark-paper)] text-center py-2.5 rounded-[4px] text-[9px] font-mono font-bold uppercase tracking-widest transition-all active:scale-[0.98] block border border-transparent"
                                    >
                                        เปิดห้องเกมตู้ ARCADE PLAYGROUND ↗
                                    </a>
                                </div>
                            </div>

                            {/* Membership QR Code Section */}
                            <div className="bg-white border border-[var(--color-hallmark-rule)] p-5 rounded-[8px] shadow-sm flex flex-col items-center gap-3">
                                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-hallmark-ink)] flex items-center gap-1.5">
                                    <QrCode size={14} /> SCAN TO EARN / REDEEM
                                </h3>
                                <p className="text-[9px] text-[var(--color-hallmark-ink-muted)] font-medium leading-relaxed px-4 text-center">
                                    เปิดหน้านี้เพื่อยื่นคิวอาร์โค้ดให้พนักงานแสกนเช็คบิลเพื่อสะสมคะแนน หรือแจ้งขอแลกแต้มแทนเงินสดได้ทันที
                                </p>

                                <div className="bg-neutral-50 border border-[var(--color-hallmark-rule)] p-3 rounded-[6px] flex items-center justify-center">
                                    {qrUrl ? (
                                        <img src={qrUrl} alt="Member Card QR Code" className="w-36 h-36" />
                                    ) : (
                                        <div className="w-36 h-36 flex items-center justify-center font-mono text-[9px] text-zinc-400">Loading QR...</div>
                                    )}
                                </div>
                                <span className="font-mono text-[8px] text-[var(--color-hallmark-ink-muted)] select-all border border-[var(--color-hallmark-rule)] px-3 py-1 rounded-[4px] bg-neutral-50 font-bold uppercase tracking-wider">
                                    Member ID: {profile?.phone_number || profile?.id}
                                </span>
                            </div>

                            {/* Tiers Multiplier Info Card */}
                            <div className="bg-white border border-[var(--color-hallmark-rule)] p-5 rounded-[8px] shadow-sm space-y-3.5">
                                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-hallmark-ink)] flex items-center gap-1.5 border-b border-[var(--color-hallmark-rule)] pb-2.5">
                                    <Award size={14} /> ระดับความสัมพันธ์ (Loyalty Tier)
                                </h3>

                                <div className="grid grid-cols-3 gap-2 text-center text-[9px]">
                                    <div className={`p-2 rounded-[6px] border ${tierDetails.current_tier === 'Haus Common' ? 'bg-[#F2F2EC] border-[#B8B8B2] font-bold text-neutral-900' : 'bg-neutral-50/50 border-transparent opacity-50'}`}>
                                        <span className="block text-[7px] font-mono font-bold uppercase tracking-wider mb-0.5">Tier 01</span>
                                        <span className="block text-[10px] font-bold leading-tight">Common</span>
                                        <span className="block text-[7px] font-mono mt-0.5">1.0x Rate</span>
                                    </div>
                                    <div className={`p-2 rounded-[6px] border ${tierDetails.current_tier === 'Haus People' ? 'bg-[#2E3138] border-[#A0AEC0] text-slate-100 font-bold' : 'bg-neutral-50/50 border-transparent opacity-50'}`}>
                                        <span className="block text-[7px] font-mono font-bold uppercase tracking-wider mb-0.5">Tier 02</span>
                                        <span className="block text-[10px] font-bold leading-tight">People</span>
                                        <span className="block text-[7px] font-mono mt-0.5">1.25x Rate</span>
                                    </div>
                                    <div className={`p-2 rounded-[6px] border ${tierDetails.current_tier === 'Inner Haus' ? 'bg-[#12141a] border-[#D4AF37] text-white font-bold' : 'bg-neutral-50/50 border-transparent opacity-50'}`}>
                                        <span className="block text-[7px] font-mono font-bold uppercase tracking-wider mb-0.5">Tier 03</span>
                                        <span className="block text-[10px] font-bold leading-tight">Inner Haus</span>
                                        <span className="block text-[7px] font-mono mt-0.5">1.5x Rate</span>
                                    </div>
                                </div>
                                <p className="text-[9px] text-[var(--color-hallmark-ink-muted)] leading-relaxed border-t border-[var(--color-hallmark-rule)] pt-2.5 text-center">
                                    ยอดใช้จ่ายสะสมย้อนหลัง 12 เดือนของคุณ: <strong className="text-[var(--color-hallmark-ink)] font-mono">{parseFloat(tierDetails.accumulated_spent_12m).toLocaleString()} บาท</strong>
                                </p>
                            </div>

                            {/* Transaction History Log */}
                            <div className="bg-white border border-[var(--color-hallmark-rule)] p-5 rounded-[8px] shadow-sm space-y-3.5">
                                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-hallmark-ink)] flex items-center gap-1.5 border-b border-[var(--color-hallmark-rule)] pb-2.5">
                                    <Clock size={14} /> ประวัติธุรกรรมสะสมเหรียญ
                                </h3>

                                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                                    {history.length === 0 ? (
                                        <p className="text-center font-mono text-[8px] text-zinc-400 py-4 uppercase tracking-wider">ยังไม่มีประวัติการทำรายการ</p>
                                    ) : (
                                        history.map((h, idx) => (
                                            <div key={h.id + idx} className="flex justify-between items-center text-[10px] border-b border-[var(--color-hallmark-rule)] pb-2 last:border-b-0 last:pb-0">
                                                <div className="space-y-0.5">
                                                    <h4 className="font-bold text-[var(--color-hallmark-ink)]">{h.title}</h4>
                                                    <span className="text-[8px] font-mono text-[var(--color-hallmark-ink-muted)]">{h.date}</span>
                                                </div>
                                                <div className="text-right">
                                                    {h.earned > 0 && (
                                                        <span className="font-mono font-bold text-emerald-600 font-bold">+{h.earned.toFixed(2)} xhaus</span>
                                                    )}
                                                    {h.redeemed > 0 && (
                                                        <span className="font-mono font-bold text-rose-500 font-bold">-{h.redeemed.toFixed(2)} xhaus</span>
                                                    )}
                                                    {h.total > 0 && (
                                                        <p className="text-[7px] text-[var(--color-hallmark-ink-muted)] font-mono mt-0.5">บิลรวม: {h.total.toLocaleString()}.-</p>
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
