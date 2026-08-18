/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from './lib/supabaseClient'
import { 
    Search, Shield, User, Phone, Edit2, X, Clock, Trash2, 
    Key, RefreshCw, Eye, EyeOff, Plus, Minus, Coins,
    Calendar, ArrowUpDown, CheckCircle2, ChevronRight,
    Coffee, Award, Gift
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { toast } from 'sonner'

const THAI_MONTHS = [
    'มกราคม (Jan)', 'กุมภาพันธ์ (Feb)', 'มีนาคม (Mar)', 'เมษายน (Apr)',
    'พฤษภาคม (May)', 'มิถุนายน (Jun)', 'กรกฎาคม (Jul)', 'สิงหาคม (Aug)',
    'กันยายน (Sep)', 'ตุลาคม (Oct)', 'พฤศจิกายน (Nov)', 'ธันวาคม (Dec)'
]

export default function AdminMembers() {
    const [members, setMembers] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [roleTab, setRoleTab] = useState('all') // 'all' | 'staff' | 'customer'
    const [sortBy, setSortBy] = useState('newest') // 'newest' | 'name' | 'xhaus' | 'bookings' | 'stamps'
    const [visiblePins, setVisiblePins] = useState({})

    // History Modal State
    const [selectedMember, setSelectedMember] = useState(null)
    const [memberHistory, setMemberHistory] = useState([])
    const [historyLoading, setHistoryLoading] = useState(false)

    // Edit Member Modal State
    const [editingMember, setEditingMember] = useState(null)
    const [editForm, setEditForm] = useState({
        display_name: '',
        nickname: '',
        phone_number: '',
        line_user_id: '',
        admin_notes: '',
        birth_day: '',
        birth_month: '',
        gender: '',
        pin: '',
        drink_stamp_count: 0,
        free_drink_quota: 0
    })

    // Coin Adjuster Modal State
    const [adjustingMember, setAdjustingMember] = useState(null)
    const [adjustAmount, setAdjustAmount] = useState('')
    const [adjustReason, setAdjustReason] = useState('')
    const [adjustType, setAdjustType] = useState('add') // 'add' | 'deduct'
    const [isAdjusting, setIsAdjusting] = useState(false)

    // Stamp & Free Drink Adjuster Modal State
    const [adjustingStampMember, setAdjustingStampMember] = useState(null)
    const [stampCountInput, setStampCountInput] = useState(0)
    const [freeQuotaInput, setFreeQuotaInput] = useState(0)
    const [isAdjustingStamps, setIsAdjustingStamps] = useState(false)

    // Fetch Members Data
    const fetchMembers = async () => {
        setLoading(true)
        try {
            // 1. Fetch Profiles
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false })

            if (profileError) throw profileError

            // 2. Fetch Aggregated Bookings efficiently (user_id and status only)
            const { data: bookings, error: bookingError } = await supabase
                .from('bookings')
                .select('user_id, status')

            if (bookingError) console.warn('Could not load bookings count:', bookingError)

            const bookingMap = {}
            if (bookings && Array.isArray(bookings)) {
                bookings.forEach(b => {
                    if (b.user_id) {
                        if (!bookingMap[b.user_id]) {
                            bookingMap[b.user_id] = { total: 0, completed: 0 }
                        }
                        bookingMap[b.user_id].total += 1
                        if (b.status === 'completed' || b.status === 'confirmed') {
                            bookingMap[b.user_id].completed += 1
                        }
                    }
                })
            }

            // 3. Merge profile data
            const merged = (profiles || []).map(p => {
                const bStats = bookingMap[p.id] || { total: 0, completed: 0 }
                return {
                    ...p,
                    total_bookings: bStats.total,
                    completed_bookings: bStats.completed,
                }
            })

            setMembers(merged)
        } catch (err) {
            console.error('Error fetching members:', err)
            toast.error('ไม่สามารถโหลดข้อมูลสมาชิกได้: ' + (err.message || ''))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchMembers()

        const channel = supabase
            .channel('admin_members_realtime_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                fetchMembers()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
                fetchMembers()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    // View Member Service / Booking History
    const handleViewHistory = async (member) => {
        setSelectedMember(member)
        setHistoryLoading(true)
        setMemberHistory([])
        try {
            const { data: rpcData, error: rpcErr } = await supabase.rpc('get_member_service_history', { p_user_id: member.id })
            if (!rpcErr && rpcData && Array.isArray(rpcData)) {
                setMemberHistory(rpcData)
            } else {
                const { data, error } = await supabase
                    .from('bookings')
                    .select(`
                        *,
                        order_items (
                            id,
                            quantity,
                            price_at_time,
                            menu_items (name)
                        )
                    `)
                    .or(`user_id.eq.${member.id},pickup_contact_phone.eq.${member.phone_number || 'NONE'}`)
                    .order('created_at', { ascending: false })

                if (error) throw error
                setMemberHistory(data || [])
            }
        } catch (err) {
            console.error('Failed to load history:', err)
            toast.error('ไม่สามารถโหลดประวัติการสั่งซื้อ/จองได้')
        } finally {
            setHistoryLoading(false)
        }
    }

    // Toggle Role (Admin / Staff / Customer)
    const handleToggleRole = async (member) => {
        const isCurrentAdmin = member.role === 'admin'
        const newRole = isCurrentAdmin ? 'customer' : 'admin'
        const confirmMsg = isCurrentAdmin
            ? `ต้องการปลดสิทธิ์ Admin ของ "${member.display_name || 'สมาชิก'}" เป็น Customer ใช่หรือไม่?`
            : `ต้องการเลื่อนขั้น "${member.display_name || 'สมาชิก'}" เป็น Admin ใช่หรือไม่?`

        if (!window.confirm(confirmMsg)) return

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', member.id)

            if (error) throw error

            setMembers(prev => prev.map(m => m.id === member.id ? { ...m, role: newRole } : m))
            toast.success(`อัปเดตสิทธิ์ ${member.display_name} เป็น ${newRole.toUpperCase()} เรียบร้อย`)
        } catch (err) {
            console.error(err)
            toast.error('ไม่สามารถเปลี่ยนบทบาทได้: ' + err.message)
        }
    }

    // Reset / Randomize POS PIN
    const handleResetPin = async (member) => {
        const randomPin = Math.floor(1000 + Math.random() * 9000).toString()
        if (!window.confirm(`ต้องการสร้างรหัส PIN ใหม่ของ "${member.display_name || member.nickname || 'พนักงาน'}" เป็น "${randomPin}" ใช่หรือไม่?`)) return

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ pin: randomPin })
                .eq('id', member.id)

            if (error) throw error

            setMembers(prev => prev.map(m => m.id === member.id ? { ...m, pin: randomPin } : m))
            setVisiblePins(prev => ({ ...prev, [member.id]: true }))
            toast.success(`รีเซ็ตรหัส PIN ของ ${member.display_name} เป็น ${randomPin} สำเร็จ`)
        } catch (err) {
            console.error(err)
            toast.error('ไม่สามารถรีเซ็ตรหัส PIN ได้: ' + err.message)
        }
    }

    // Open Edit Modal
    const openEditModal = (member) => {
        setEditingMember(member)
        setEditForm({
            display_name: member.display_name || '',
            nickname: member.nickname || '',
            phone_number: member.phone_number || '',
            line_user_id: member.line_user_id || member.line_uid || '',
            admin_notes: member.admin_notes || '',
            birth_day: member.birth_day || '',
            birth_month: member.birth_month || '',
            gender: member.gender || '',
            pin: member.pin || '',
            drink_stamp_count: member.drink_stamp_count || 0,
            free_drink_quota: member.free_drink_quota || 0
        })
    }

    // Save Edited Member
    const handleSaveMember = async (e) => {
        e.preventDefault()
        if (!editingMember) return

        try {
            const cleanPin = editForm.pin ? editForm.pin.trim() : null
            const payload = {
                display_name: editForm.display_name.trim(),
                nickname: editForm.nickname.trim(),
                phone_number: editForm.phone_number.trim(),
                line_user_id: editForm.line_user_id.trim() || null,
                admin_notes: editForm.admin_notes.trim() || null,
                birth_day: editForm.birth_day ? parseInt(editForm.birth_day, 10) : null,
                birth_month: editForm.birth_month ? parseInt(editForm.birth_month, 10) : null,
                gender: editForm.gender || null,
                pin: cleanPin,
                drink_stamp_count: Math.min(9, Math.max(0, parseInt(editForm.drink_stamp_count || 0, 10))),
                free_drink_quota: Math.max(0, parseInt(editForm.free_drink_quota || 0, 10))
            }

            const { error } = await supabase
                .from('profiles')
                .update(payload)
                .eq('id', editingMember.id)

            if (error) throw error

            setMembers(prev => prev.map(m => m.id === editingMember.id ? { 
                ...m, 
                ...payload, 
                pin: cleanPin 
            } : m))

            setEditingMember(null)
            toast.success('บันทึกข้อมูลสมาชิกเรียบร้อยแล้ว')
        } catch (err) {
            console.error('Failed to save profile:', err)
            toast.error('ไม่สามารถบันทึกข้อมูลได้: ' + err.message)
        }
    }

    // Handle Manual Drink Stamps & Free Drink Adjustment
    const handleAdjustStamps = async (e) => {
        if (e) e.preventDefault()
        if (!adjustingStampMember) return

        const countNum = parseInt(stampCountInput, 10)
        const quotaNum = parseInt(freeQuotaInput, 10)

        if (isNaN(countNum) || countNum < 0 || countNum > 9) {
            return toast.error('จำนวนแก้วสะสมต้องอยู่ระหว่าง 0 - 9 แก้ว')
        }
        if (isNaN(quotaNum) || quotaNum < 0) {
            return toast.error('โควต้าเครื่องดื่มฟรีต้องมากกว่าหรือเท่ากับ 0')
        }

        setIsAdjustingStamps(true)
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    drink_stamp_count: countNum,
                    free_drink_quota: quotaNum
                })
                .eq('id', adjustingStampMember.id)

            if (error) throw error

            setMembers(prev => prev.map(m => m.id === adjustingStampMember.id ? { 
                ...m, 
                drink_stamp_count: countNum, 
                free_drink_quota: quotaNum 
            } : m))

            toast.success(`อัปเดตสแตมป์แก้วของ ${adjustingStampMember.display_name} เรียบร้อย (${countNum}/10 แก้ว, ฟรี ${quotaNum} แก้ว)`)
            setAdjustingStampMember(null)
        } catch (err) {
            console.error('Adjust stamps error:', err)
            toast.error('ปรับสแตมป์ไม่สำเร็จ: ' + err.message)
        } finally {
            setIsAdjustingStamps(false)
        }
    }

    // Handle Manual xHaus Point Adjustment
    const handleAdjustCoins = async (e) => {
        e.preventDefault()
        if (!adjustingMember) return
        const amountNum = parseFloat(adjustAmount)
        if (isNaN(amountNum) || amountNum <= 0) {
            return toast.error('กรุณาระบุจำนวนเหรียญที่ถูกต้อง')
        }

        setIsAdjusting(true)
        try {
            const currentBal = Number(adjustingMember.xhaus_balance || 0)
            const delta = adjustType === 'add' ? amountNum : -amountNum
            const newBal = Math.max(0, currentBal + delta)

            const { error } = await supabase
                .from('profiles')
                .update({ 
                    xhaus_balance: newBal,
                    total_earned_xhaus: adjustType === 'add' ? Number(adjustingMember.total_earned_xhaus || currentBal) + amountNum : adjustingMember.total_earned_xhaus
                })
                .eq('id', adjustingMember.id)

            if (error) throw error

            setMembers(prev => prev.map(m => m.id === adjustingMember.id ? { ...m, xhaus_balance: newBal } : m))
            toast.success(`${adjustType === 'add' ? 'เพิ่ม' : 'หัก'} ${amountNum} xhaus เรียบร้อย (ยอดใหม่: ${newBal})`)
            setAdjustingMember(null)
            setAdjustAmount('')
            setAdjustReason('')
        } catch (err) {
            console.error('Coin adjustment failed:', err)
            toast.error('เกิดข้อผิดพลาดในการปรับแต้ม: ' + err.message)
        } finally {
            setIsAdjusting(false)
        }
    }

    // Delete User
    const handleDeleteUser = async (member) => {
        if (!confirm(`⚠️ ยืนยันการลบผู้ใช้ "${member.display_name || member.nickname || 'User'}"?\nการดำเนินการนี้จะลบสิทธิ์และข้อมูลโปรไฟล์ ไม่สามารถกู้คืนได้`)) return

        try {
            const { error } = await supabase.rpc('delete_user_by_admin', { target_user_id: member.id })
            if (error) throw error

            setMembers(prev => prev.filter(m => m.id !== member.id))
            toast.success('ลบข้อมูลผู้ใช้งานเรียบร้อยแล้ว')
        } catch (err) {
            console.error('Delete failed:', err)
            toast.error('ลบผู้ใช้ไม่สำเร็จ: ' + err.message)
        }
    }

    // Filter & Sort Logic
    const filteredAndSortedMembers = useMemo(() => {
        let result = members.filter(m => {
            const searchLower = searchTerm.toLowerCase()
            const matchSearch = 
                (m.display_name || '').toLowerCase().includes(searchLower) ||
                (m.nickname || '').toLowerCase().includes(searchLower) ||
                (m.phone_number || '').includes(searchTerm) ||
                (m.pin || '').includes(searchTerm) ||
                (m.line_user_id || m.line_uid || '').toLowerCase().includes(searchLower) ||
                (m.admin_notes || '').toLowerCase().includes(searchLower)

            if (!matchSearch) return false

            if (roleTab === 'staff') {
                return m.role === 'staff' || m.role === 'admin'
            }
            if (roleTab === 'customer') {
                return m.role !== 'staff' && m.role !== 'admin'
            }
            return true
        })

        // Sort
        result.sort((a, b) => {
            if (sortBy === 'newest') {
                return new Date(b.created_at || 0) - new Date(a.created_at || 0)
            }
            if (sortBy === 'name') {
                return (a.display_name || '').localeCompare(b.display_name || '')
            }
            if (sortBy === 'xhaus') {
                return (Number(b.xhaus_balance) || 0) - (Number(a.xhaus_balance) || 0)
            }
            if (sortBy === 'stamps') {
                const bTotalStamps = (Number(b.drink_stamp_count) || 0) + ((Number(b.free_drink_quota) || 0) * 10)
                const aTotalStamps = (Number(a.drink_stamp_count) || 0) + ((Number(a.free_drink_quota) || 0) * 10)
                return bTotalStamps - aTotalStamps
            }
            if (sortBy === 'bookings') {
                return (b.total_bookings || 0) - (a.total_bookings || 0)
            }
            return 0
        })

        return result
    }, [members, searchTerm, roleTab, sortBy])

    const staffCount = members.filter(m => m.role === 'staff' || m.role === 'admin').length
    const customerCount = members.filter(m => m.role !== 'staff' && m.role !== 'admin').length
    const totalXhaus = members.reduce((sum, m) => sum + (Number(m.xhaus_balance) || 0), 0)

    return (
        <div className="space-y-6">
            {/* Header Controls Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-4 rounded-sm">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Role Filter Tabs */}
                    <div className="flex bg-[oklch(94%_0.010_28)] p-0.5 rounded-sm border border-[oklch(85%_0.012_28)] font-mono text-xs">
                        <button
                            type="button"
                            onClick={() => setRoleTab('all')}
                            className={`px-3 py-1.5 rounded-sm font-bold uppercase transition-all ${
                                roleTab === 'all'
                                    ? 'bg-[oklch(18%_0.012_28)] text-white shadow-2xs'
                                    : 'text-[oklch(42%_0.010_28)] hover:text-black'
                            }`}
                        >
                            ทั้งหมด ({members.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setRoleTab('staff')}
                            className={`px-3 py-1.5 rounded-sm font-bold uppercase transition-all flex items-center gap-1.5 ${
                                roleTab === 'staff'
                                    ? 'bg-[oklch(52%_0.16_28)] text-white shadow-2xs'
                                    : 'text-[oklch(42%_0.010_28)] hover:text-black'
                            }`}
                        >
                            <Shield size={12} />
                            <span>พนักงาน/แอดมิน ({staffCount})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setRoleTab('customer')}
                            className={`px-3 py-1.5 rounded-sm font-bold uppercase transition-all ${
                                roleTab === 'customer'
                                    ? 'bg-[oklch(18%_0.012_28)] text-white shadow-2xs'
                                    : 'text-[oklch(42%_0.010_28)] hover:text-black'
                            }`}
                        >
                            ลูกค้าสมาชิก ({customerCount})
                        </button>
                    </div>

                    {/* Quick Stats Pill */}
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white border border-[oklch(85%_0.012_28)] rounded-sm font-mono text-xs text-[oklch(42%_0.010_28)]">
                        <span>xHAUS ในระบบ:</span>
                        <span className="font-bold text-[oklch(18%_0.012_28)]">{totalXhaus.toLocaleString()} 🪙</span>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    {/* Sort Selector */}
                    <div className="flex items-center gap-1.5 bg-white border border-[oklch(85%_0.012_28)] px-2.5 py-1.5 rounded-sm font-mono text-xs text-[oklch(42%_0.010_28)]">
                        <ArrowUpDown size={13} className="text-[oklch(55%_0.010_28)]" />
                        <span className="text-[10px] uppercase font-bold text-[oklch(55%_0.010_28)]">เรียง:</span>
                        <select 
                            value={sortBy} 
                            onChange={e => setSortBy(e.target.value)}
                            className="bg-transparent font-bold text-[oklch(18%_0.012_28)] outline-none cursor-pointer"
                        >
                            <option value="newest">สมัครล่าสุด</option>
                            <option value="name">ชื่อ (A-Z / ก-ฮ)</option>
                            <option value="xhaus">แต้ม xhaus สูงสุด</option>
                            <option value="stamps">สะสมแก้วสูงสุด (Stamps)</option>
                            <option value="bookings">ยอดการจอง/ออเดอร์</option>
                        </select>
                    </div>

                    {/* Search Input */}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[oklch(55%_0.010_28)] w-3.5 h-3.5" />
                        <input
                            type="text"
                            placeholder="ค้นชื่อ, เบอร์, PIN, LINE ID..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm pl-8 pr-3 py-1.5 text-xs text-[oklch(18%_0.012_28)] font-mono placeholder:text-[oklch(55%_0.010_28)] focus:outline-none focus:border-[oklch(18%_0.012_28)] transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Members List Table / Cards */}
            {loading ? (
                <div className="text-center py-16 bg-white border border-[oklch(85%_0.012_28)] rounded-sm">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[oklch(85%_0.012_28)] border-b-[oklch(18%_0.012_28)] mb-2" />
                    <p className="font-mono text-xs uppercase tracking-wider text-[oklch(55%_0.010_28)]">กำลังโหลดข้อมูลสมาชิกและพนักงาน...</p>
                </div>
            ) : filteredAndSortedMembers.length === 0 ? (
                <div className="text-center py-16 bg-white border border-dashed border-[oklch(85%_0.012_28)] rounded-sm">
                    <p className="font-mono text-xs uppercase tracking-wider text-[oklch(55%_0.010_28)]">ไม่พบข้อมูลสมาชิกตามเงื่อนไขที่ระบุ</p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {filteredAndSortedMembers.map((member) => {
                        const isAdmin = member.role === 'admin'
                        const isStaff = member.role === 'staff'
                        const isPrivileged = isAdmin || isStaff
                        const pinVisible = visiblePins[member.id]

                        return (
                            <motion.div
                                layout
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                key={member.id}
                                className={`bg-white border rounded-sm p-4 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                                    isAdmin 
                                        ? 'border-[oklch(52%_0.16_28)] shadow-2xs bg-[oklch(99%_0.004_28)]' 
                                        : isStaff
                                            ? 'border-[oklch(45%_0.08_140)] shadow-2xs'
                                            : 'border-[oklch(85%_0.012_28)] hover:border-[oklch(55%_0.010_28)]'
                                }`}
                            >
                                {/* Left Section: Avatar & Info */}
                                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                                    {/* Role Avatar */}
                                    <div className={`w-11 h-11 rounded-sm flex items-center justify-center shrink-0 border font-mono font-bold text-xs ${
                                        isAdmin
                                            ? 'bg-[oklch(52%_0.16_28)] text-white border-[oklch(52%_0.16_28)]'
                                            : isStaff
                                                ? 'bg-[oklch(45%_0.08_140)] text-white border-[oklch(45%_0.08_140)]'
                                                : 'bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)]'
                                    }`}>
                                        {isAdmin ? <Shield size={18} /> : <User size={18} />}
                                    </div>

                                    {/* User Details */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="font-mono text-sm font-bold text-[oklch(18%_0.012_28)] truncate">
                                                {member.display_name || 'Unnamed Member'}
                                            </h3>
                                            {member.nickname && (
                                                <span className="font-mono text-[11px] font-bold px-1.5 py-0.2 bg-[oklch(94%_0.010_28)] text-[oklch(42%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-xs">
                                                    ({member.nickname})
                                                </span>
                                            )}
                                            <span className={`font-mono text-[10px] font-bold uppercase px-1.5 py-0.2 rounded-xs border ${
                                                isAdmin
                                                    ? 'bg-[oklch(94%_0.02_28)] text-[oklch(52%_0.16_28)] border-[oklch(52%_0.16_28)]'
                                                    : isStaff
                                                        ? 'bg-[oklch(94%_0.02_140)] text-[oklch(45%_0.08_140)] border-[oklch(45%_0.08_140)]'
                                                        : 'bg-[oklch(96%_0.005_28)] text-[oklch(55%_0.010_28)] border-[oklch(85%_0.012_28)]'
                                            }`}>
                                                {member.role || 'customer'}
                                            </span>
                                            {member.current_tier && (
                                                <span className="font-mono text-[9px] font-bold px-1.5 py-0.2 bg-[oklch(52%_0.16_28)]/10 text-[oklch(52%_0.16_28)] border border-[oklch(52%_0.16_28)]/30 rounded-xs uppercase">
                                                    {member.current_tier}
                                                </span>
                                            )}
                                        </div>

                                        {/* Secondary Meta Tags */}
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-[oklch(55%_0.010_28)] mt-1">
                                            {member.phone_number && (
                                                <span className="flex items-center gap-1 text-[oklch(18%_0.012_28)] font-medium">
                                                    <Phone size={11} className="text-[oklch(55%_0.010_28)]" />
                                                    {member.phone_number}
                                                </span>
                                            )}
                                            {(member.line_user_id || member.line_uid) && (
                                                <span className="text-[oklch(45%_0.08_140)] font-medium">
                                                    LINE: {member.line_user_id || member.line_uid}
                                                </span>
                                            )}
                                            {member.birth_day && member.birth_month && (
                                                <span className="flex items-center gap-1">
                                                    <Calendar size={11} />
                                                    BD: {member.birth_day}/{member.birth_month}
                                                </span>
                                            )}
                                        </div>

                                        {/* PIN Code Quick Bar (for Staff / Admin / Quick POS auth) */}
                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                            <div className="flex items-center gap-1.5 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] px-2 py-0.5 rounded-xs font-mono text-xs">
                                                <Key size={12} className="text-[oklch(52%_0.16_28)]" />
                                                <span className="text-[10px] uppercase text-[oklch(55%_0.010_28)]">PIN POS:</span>
                                                <span className="font-bold tracking-wider text-[oklch(18%_0.012_28)]">
                                                    {member.pin ? (pinVisible ? member.pin : '••••') : <span className="text-[oklch(55%_0.010_28)] italic font-normal text-[10px]">ยังไม่ตั้ง</span>}
                                                </span>
                                                {member.pin && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setVisiblePins(prev => ({ ...prev, [member.id]: !prev[member.id] }))}
                                                        className="text-[oklch(55%_0.010_28)] hover:text-black p-0.5 cursor-pointer ml-0.5"
                                                        title={pinVisible ? "ซ่อน PIN" : "แสดง PIN"}
                                                    >
                                                        {pinVisible ? <EyeOff size={11} /> : <Eye size={11} />}
                                                    </button>
                                                )}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleResetPin(member)}
                                                className="text-[10px] font-mono font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)] hover:bg-[oklch(94%_0.02_28)] border border-[oklch(85%_0.012_28)] px-2 py-0.5 rounded-xs transition-colors flex items-center gap-1 cursor-pointer"
                                                title="สุ่มรีเซ็ตรหัส PIN 4 หลักใหม่"
                                            >
                                                <RefreshCw size={9} /> สุ่ม PIN ใหม่
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Middle Section: Stats, Stamps & Points */}
                                <div className="flex flex-wrap items-center gap-4 sm:gap-6 border-t md:border-t-0 md:border-l border-[oklch(85%_0.012_28)] pt-3 md:pt-0 md:pl-6 w-full md:w-auto justify-between md:justify-end">
                                    <div className="text-center font-mono">
                                        <p className="text-base font-bold text-[oklch(18%_0.012_28)]">{member.total_bookings || 0}</p>
                                        <p className="text-[9px] uppercase tracking-wider text-[oklch(55%_0.010_28)]">Bookings</p>
                                    </div>

                                    {/* Drink Stamps (10 Free 1) */}
                                    <div className="text-center font-mono">
                                        <div className="flex items-center justify-center gap-1">
                                            <p className="text-base font-bold text-[oklch(18%_0.012_28)]">
                                                ☕ {member.drink_stamp_count || 0}<span className="text-[10px] text-[oklch(55%_0.010_28)] font-normal">/10</span>
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAdjustingStampMember(member)
                                                    setStampCountInput(member.drink_stamp_count || 0)
                                                    setFreeQuotaInput(member.free_drink_quota || 0)
                                                }}
                                                className="p-1 text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] hover:bg-[oklch(94%_0.010_28)] rounded-xs transition-colors cursor-pointer"
                                                title="ปรับจำนวนแก้วสะสม / สิทธิ์เครื่องดื่มฟรี"
                                            >
                                                <Edit2 size={11} />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-center gap-1 mt-0.5">
                                            <p className="text-[9px] uppercase tracking-wider text-[oklch(55%_0.010_28)]">Stamps</p>
                                            {(member.free_drink_quota || 0) > 0 && (
                                                <span className="text-[8px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1 py-0.2 rounded-xs">
                                                    🎁 ฟรี {member.free_drink_quota}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* xHAUS Points */}
                                    <div className="text-center font-mono">
                                        <div className="flex items-center justify-center gap-1">
                                            <p className="text-base font-bold text-[oklch(52%_0.16_28)]">
                                                {Number(member.xhaus_balance || 0).toLocaleString()}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAdjustingMember(member)
                                                    setAdjustAmount('')
                                                    setAdjustReason('')
                                                    setAdjustType('add')
                                                }}
                                                className="p-1 text-[oklch(55%_0.010_28)] hover:text-[oklch(18%_0.012_28)] hover:bg-[oklch(94%_0.010_28)] rounded-xs transition-colors cursor-pointer"
                                                title="ปรับเพิ่ม/ลดเหรียญ xhaus"
                                            >
                                                <Coins size={13} />
                                            </button>
                                        </div>
                                        <p className="text-[9px] uppercase tracking-wider text-[oklch(55%_0.010_28)]">xHAUS Points</p>
                                    </div>
                                </div>

                                {/* Right Section: Action Controls */}
                                <div className="flex flex-wrap items-center gap-2 border-t md:border-t-0 md:border-l border-[oklch(85%_0.012_28)] pt-3 md:pt-0 md:pl-6 w-full md:w-auto justify-end font-mono text-xs">
                                    <button
                                        type="button"
                                        onClick={() => openEditModal(member)}
                                        className="px-2.5 py-1.5 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] text-[oklch(18%_0.012_28)] font-bold rounded-sm border border-[oklch(85%_0.012_28)] flex items-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                        <Edit2 size={12} />
                                        <span>แก้ไข</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleViewHistory(member)}
                                        className="px-2.5 py-1.5 bg-white hover:bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] font-bold rounded-sm border border-[oklch(85%_0.012_28)] flex items-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                        <Clock size={12} />
                                        <span>ประวัติบิล</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleToggleRole(member)}
                                        className={`px-2.5 py-1.5 font-bold uppercase rounded-sm border transition-colors cursor-pointer ${
                                            isAdmin
                                                ? 'bg-white text-[oklch(52%_0.16_28)] border-[oklch(52%_0.16_28)] hover:bg-[oklch(94%_0.02_28)]'
                                                : 'bg-white text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)] hover:border-black'
                                        }`}
                                        title={isAdmin ? "ปลดสิทธิ์ Admin" : "ตั้งเป็น Admin"}
                                    >
                                        {isAdmin ? 'ADMIN' : 'ROLE'}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleDeleteUser(member)}
                                        className="p-1.5 text-[oklch(55%_0.010_28)] hover:text-[oklch(52%_0.16_28)] hover:bg-[oklch(94%_0.02_28)] rounded-sm border border-transparent hover:border-[oklch(85%_0.012_28)] transition-colors cursor-pointer"
                                        title="ลบผู้ใช้งาน"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </motion.div>
                        )
                    })}
                </div>
            )}

            {/* Edit Member Profile Modal */}
            <AnimatePresence>
                {editingMember && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="bg-[oklch(97%_0.008_28)] w-full max-w-lg rounded-sm border border-[oklch(85%_0.012_28)] shadow-xl overflow-hidden font-mono"
                        >
                            <div className="p-4 border-b border-[oklch(85%_0.012_28)] bg-white flex justify-between items-center">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)]">MEMBER PROFILE CRM</span>
                                    <h2 className="text-base font-bold uppercase text-[oklch(18%_0.012_28)]">แก้ไขข้อมูลสมาชิก & พนักงาน</h2>
                                </div>
                                <button 
                                    onClick={() => setEditingMember(null)} 
                                    className="p-1 hover:bg-[oklch(94%_0.010_28)] rounded-sm text-[oklch(42%_0.010_28)] hover:text-black cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveMember} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                            Display Name (ชื่อแสดงผล) *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={editForm.display_name}
                                            onChange={e => setEditForm({ ...editForm, display_name: e.target.value })}
                                            className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2.5 text-xs text-[oklch(18%_0.012_28)] outline-none focus:border-black"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                            Nickname (ชื่อเล่น)
                                        </label>
                                        <input
                                            type="text"
                                            value={editForm.nickname}
                                            onChange={e => setEditForm({ ...editForm, nickname: e.target.value })}
                                            className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2.5 text-xs text-[oklch(18%_0.012_28)] outline-none focus:border-black"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                            Phone Number (เบอร์โทรศัพท์)
                                        </label>
                                        <input
                                            type="tel"
                                            placeholder="0812345678"
                                            value={editForm.phone_number}
                                            onChange={e => setEditForm({ ...editForm, phone_number: e.target.value })}
                                            className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2.5 text-xs text-[oklch(18%_0.012_28)] outline-none focus:border-black"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                            Gender (เพศ)
                                        </label>
                                        <select
                                            value={editForm.gender}
                                            onChange={e => setEditForm({ ...editForm, gender: e.target.value })}
                                            className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2.5 text-xs text-[oklch(18%_0.012_28)] outline-none focus:border-black"
                                        >
                                            <option value="">ไม่ระบุ</option>
                                            <option value="Male">ชาย</option>
                                            <option value="Female">หญิง</option>
                                            <option value="Other">อื่นๆ</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                        Birthday (วันเกิด / เดือนเกิด สำหรับโปรโมชั่นวันเกิด)
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <select
                                            value={editForm.birth_day}
                                            onChange={e => setEditForm({ ...editForm, birth_day: e.target.value })}
                                            className="bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2.5 text-xs text-[oklch(18%_0.012_28)] outline-none focus:border-black"
                                        >
                                            <option value="">วัน</option>
                                            {[...Array(31)].map((_, i) => (
                                                <option key={i} value={i + 1}>{i + 1}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={editForm.birth_month}
                                            onChange={e => setEditForm({ ...editForm, birth_month: e.target.value })}
                                            className="col-span-2 bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2.5 text-xs text-[oklch(18%_0.012_28)] outline-none focus:border-black"
                                        >
                                            <option value="">เดือน</option>
                                            {THAI_MONTHS.map((m, i) => (
                                                <option key={i} value={i + 1}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="bg-white border border-[oklch(85%_0.012_28)] p-3 rounded-sm space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-bold uppercase text-[oklch(52%_0.16_28)] flex items-center gap-1.5">
                                            <Key size={12} />
                                            <span>POS Staff PIN Code (รหัส PIN พนักงาน 4-6 หลัก)</span>
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newPin = Math.floor(1000 + Math.random() * 9000).toString()
                                                setEditForm({ ...editForm, pin: newPin })
                                            }}
                                            className="text-[10px] text-[oklch(52%_0.16_28)] hover:underline flex items-center gap-1 font-bold cursor-pointer"
                                        >
                                            <RefreshCw size={10} /> สุ่ม PIN 4 หลัก
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        maxLength={6}
                                        placeholder="เช่น 1234"
                                        value={editForm.pin || ''}
                                        onChange={e => setEditForm({ ...editForm, pin: e.target.value.replace(/\D/g, '') })}
                                        className="w-full bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-sm p-2.5 text-base font-bold tracking-widest text-[oklch(18%_0.012_28)] outline-none focus:border-black"
                                    />
                                    <p className="text-[10px] text-[oklch(55%_0.010_28)]">ใช้สำหรับปลดล็อกหน้าจอ POS และเปิด/ปิดกะพนักงาน</p>
                                </div>

                                {/* Drink Stamps & Quota */}
                                <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-3 rounded-sm space-y-2">
                                    <label className="text-[10px] font-bold uppercase text-[oklch(18%_0.012_28)] flex items-center gap-1.5">
                                        <Coffee size={12} className="text-[oklch(52%_0.16_28)]" />
                                        <span>Drink Stamps & Free Drink Quota (สะสมแก้ว 10 แถม 1)</span>
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[9px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                                แก้วสะสมปัจจุบัน (0-9 แก้ว)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="9"
                                                value={editForm.drink_stamp_count}
                                                onChange={e => setEditForm({ ...editForm, drink_stamp_count: e.target.value })}
                                                className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2 text-xs font-mono font-bold text-[oklch(18%_0.012_28)] outline-none focus:border-black"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                                สิทธิ์เครื่องดื่มฟรี (แก้ว)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={editForm.free_drink_quota}
                                                onChange={e => setEditForm({ ...editForm, free_drink_quota: e.target.value })}
                                                className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2 text-xs font-mono font-bold text-emerald-800 outline-none focus:border-black"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                        LINE User ID
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                        value={editForm.line_user_id}
                                        onChange={e => setEditForm({ ...editForm, line_user_id: e.target.value })}
                                        className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2.5 text-xs text-[oklch(18%_0.012_28)] outline-none focus:border-black"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                        Admin Notes (หมายเหตุภายในสำหรับแอดมิน)
                                    </label>
                                    <textarea
                                        rows={2}
                                        placeholder="เช่น ลูกค้า VIP ชอบนั่งโซนริมหน้าต่าง..."
                                        value={editForm.admin_notes}
                                        onChange={e => setEditForm({ ...editForm, admin_notes: e.target.value })}
                                        className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2.5 text-xs text-[oklch(18%_0.012_28)] outline-none focus:border-black resize-none"
                                    />
                                </div>

                                <div className="pt-3 border-t border-[oklch(85%_0.012_28)] flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditingMember(null)}
                                        className="px-4 py-2 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] text-[oklch(18%_0.012_28)] font-bold rounded-sm border border-[oklch(85%_0.012_28)] text-xs cursor-pointer"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2 bg-[oklch(18%_0.012_28)] hover:bg-black text-white font-bold rounded-sm text-xs cursor-pointer shadow-sm"
                                    >
                                        บันทึกการเปลี่ยนแปลง
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Coin Points Adjuster Modal */}
            <AnimatePresence>
                {adjustingMember && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="bg-white w-full max-w-sm rounded-sm border border-[oklch(85%_0.012_28)] shadow-xl overflow-hidden font-mono"
                        >
                            <div className="p-4 border-b border-[oklch(85%_0.012_28)] flex justify-between items-center bg-[oklch(97%_0.008_28)]">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)]">xHAUS LOYALTY POINTS</span>
                                    <h3 className="text-sm font-bold uppercase text-[oklch(18%_0.012_28)]">
                                        ปรับแต้ม: {adjustingMember.display_name || 'สมาชิก'}
                                    </h3>
                                </div>
                                <button onClick={() => setAdjustingMember(null)} className="p-1 hover:bg-[oklch(94%_0.010_28)] rounded-sm cursor-pointer">
                                    <X size={16} />
                                </button>
                            </div>

                            <form onSubmit={handleAdjustCoins} className="p-5 space-y-4">
                                <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-3 rounded-sm text-center">
                                    <span className="text-[10px] uppercase text-[oklch(55%_0.010_28)]">ยอดแต้มสะสมปัจจุบัน</span>
                                    <p className="text-2xl font-bold text-[oklch(52%_0.16_28)]">
                                        {Number(adjustingMember.xhaus_balance || 0).toLocaleString()} <span className="text-xs">xhaus</span>
                                    </p>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setAdjustType('add')}
                                        className={`flex-1 py-2 font-bold text-xs uppercase rounded-sm border transition-colors flex items-center justify-center gap-1.5 ${
                                            adjustType === 'add'
                                                ? 'bg-[oklch(18%_0.012_28)] text-white border-[oklch(18%_0.012_28)]'
                                                : 'bg-white text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)]'
                                        }`}
                                    >
                                        <Plus size={13} /> เพิ่มแต้ม
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAdjustType('deduct')}
                                        className={`flex-1 py-2 font-bold text-xs uppercase rounded-sm border transition-colors flex items-center justify-center gap-1.5 ${
                                            adjustType === 'deduct'
                                                ? 'bg-[oklch(52%_0.16_28)] text-white border-[oklch(52%_0.16_28)]'
                                                : 'bg-white text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)]'
                                        }`}
                                    >
                                        <Minus size={13} /> หักแต้ม
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                        จำนวนเหรียญที่ต้องการ {adjustType === 'add' ? 'เพิ่ม' : 'หัก'}
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        placeholder="เช่น 50"
                                        value={adjustAmount}
                                        onChange={e => setAdjustAmount(e.target.value)}
                                        className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2.5 text-base font-bold text-[oklch(18%_0.012_28)] outline-none focus:border-black"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                        เหตุผลการปรับแต้ม (สำหรับประวัติภายใน)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="เช่น ชดเชยออเดอร์ล่าช้า / รางวัลพิเศษ..."
                                        value={adjustReason}
                                        onChange={e => setAdjustReason(e.target.value)}
                                        className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2 text-xs text-[oklch(18%_0.012_28)] outline-none focus:border-black"
                                    />
                                </div>

                                <div className="pt-2 flex justify-end gap-2 border-t border-[oklch(85%_0.012_28)]">
                                    <button
                                        type="button"
                                        onClick={() => setAdjustingMember(null)}
                                        className="px-3 py-1.5 bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] font-bold rounded-sm border border-[oklch(85%_0.012_28)] text-xs cursor-pointer"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isAdjusting}
                                        className="px-4 py-1.5 bg-[oklch(18%_0.012_28)] text-white font-bold rounded-sm text-xs cursor-pointer shadow-sm disabled:opacity-50"
                                    >
                                        {isAdjusting ? 'กำลังบันทึก...' : 'ยืนยันการปรับแต้ม'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Drink Stamps Adjuster Modal */}
            <AnimatePresence>
                {adjustingStampMember && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="bg-white w-full max-w-sm rounded-sm border border-[oklch(85%_0.012_28)] shadow-xl overflow-hidden font-mono"
                        >
                            <div className="p-4 border-b border-[oklch(85%_0.012_28)] flex justify-between items-center bg-[oklch(97%_0.008_28)]">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)]">DRINK STAMP CARD (10 FREE 1)</span>
                                    <h3 className="text-sm font-bold uppercase text-[oklch(18%_0.012_28)]">
                                        ปรับสแตมป์: {adjustingStampMember.display_name || 'สมาชิก'}
                                    </h3>
                                </div>
                                <button onClick={() => setAdjustingStampMember(null)} className="p-1 hover:bg-[oklch(94%_0.010_28)] rounded-sm cursor-pointer">
                                    <X size={16} />
                                </button>
                            </div>

                            <form onSubmit={handleAdjustStamps} className="p-5 space-y-4">
                                <div className="grid grid-cols-2 gap-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-3 rounded-sm text-center">
                                    <div>
                                        <span className="text-[10px] uppercase text-[oklch(55%_0.010_28)]">สแตมป์ปัจจุบัน</span>
                                        <p className="text-xl font-bold text-[oklch(18%_0.012_28)]">
                                            ☕ {adjustingStampMember.drink_stamp_count || 0}/10
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-[10px] uppercase text-[oklch(55%_0.010_28)]">สิทธิ์เครื่องดื่มฟรี</span>
                                        <p className="text-xl font-bold text-emerald-700">
                                            🎁 {adjustingStampMember.free_drink_quota || 0} แก้ว
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                        จำนวนแก้วสะสมใหม่ (0 - 9 แก้ว)
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setStampCountInput(prev => Math.max(0, parseInt(prev || 0) - 1))}
                                            className="px-3 py-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] font-bold text-sm rounded-sm hover:bg-neutral-200 cursor-pointer"
                                        >
                                            -1
                                        </button>
                                        <input
                                            type="number"
                                            min="0"
                                            max="9"
                                            required
                                            value={stampCountInput}
                                            onChange={e => setStampCountInput(Math.min(9, Math.max(0, parseInt(e.target.value || 0))))}
                                            className="w-full text-center bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2 text-base font-bold text-[oklch(18%_0.012_28)] outline-none focus:border-black"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setStampCountInput(prev => Math.min(9, parseInt(prev || 0) + 1))}
                                            className="px-3 py-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] font-bold text-sm rounded-sm hover:bg-neutral-200 cursor-pointer"
                                        >
                                            +1
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                        สิทธิ์เครื่องดื่มฟรีใหม่ (แก้ว)
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setFreeQuotaInput(prev => Math.max(0, parseInt(prev || 0) - 1))}
                                            className="px-3 py-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] font-bold text-sm rounded-sm hover:bg-neutral-200 cursor-pointer"
                                        >
                                            -1
                                        </button>
                                        <input
                                            type="number"
                                            min="0"
                                            required
                                            value={freeQuotaInput}
                                            onChange={e => setFreeQuotaInput(Math.max(0, parseInt(e.target.value || 0)))}
                                            className="w-full text-center bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2 text-base font-bold text-emerald-800 outline-none focus:border-black"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setFreeQuotaInput(prev => parseInt(prev || 0) + 1)}
                                            className="px-3 py-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] font-bold text-sm rounded-sm hover:bg-neutral-200 cursor-pointer"
                                        >
                                            +1
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-2 flex justify-end gap-2 border-t border-[oklch(85%_0.012_28)]">
                                    <button
                                        type="button"
                                        onClick={() => setAdjustingStampMember(null)}
                                        className="px-3 py-1.5 bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] font-bold rounded-sm border border-[oklch(85%_0.012_28)] text-xs cursor-pointer"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isAdjustingStamps}
                                        className="px-4 py-1.5 bg-[oklch(18%_0.012_28)] text-white font-bold rounded-sm text-xs cursor-pointer shadow-sm disabled:opacity-50"
                                    >
                                        {isAdjustingStamps ? 'กำลังบันทึก...' : 'บันทึกสแตมป์'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Member Service / Booking History Drawer */}
            <AnimatePresence>
                {selectedMember && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="bg-white w-full max-w-2xl max-h-[85vh] rounded-sm border border-[oklch(85%_0.012_28)] shadow-2xl flex flex-col overflow-hidden font-mono"
                        >
                            {/* History Header */}
                            <div className="p-4 border-b border-[oklch(85%_0.012_28)] flex justify-between items-start bg-[oklch(97%_0.008_28)]">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)]">CUSTOMER SERVICE HISTORY</span>
                                    <h2 className="text-base font-bold uppercase text-[oklch(18%_0.012_28)] mt-0.5">
                                        {selectedMember.display_name} {selectedMember.nickname && `(${selectedMember.nickname})`}
                                    </h2>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[oklch(55%_0.010_28)] mt-1">
                                        <span>เบอร์: <strong className="text-[oklch(18%_0.012_28)]">{selectedMember.phone_number || '-'}</strong></span>
                                        <span>xHAUS: <strong className="text-[oklch(52%_0.16_28)]">{Number(selectedMember.xhaus_balance || 0).toLocaleString()} 🪙</strong></span>
                                        <span>ประวัติทั้งหมด: <strong className="text-[oklch(18%_0.012_28)]">{memberHistory.length} รายการ</strong></span>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedMember(null)} className="p-1 hover:bg-[oklch(94%_0.010_28)] rounded-sm cursor-pointer">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* History List */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[oklch(98%_0.006_28)]">
                                {historyLoading ? (
                                    <div className="text-center py-16 text-xs text-[oklch(55%_0.010_28)] uppercase tracking-wider">
                                        กำลังโหลดประวัติการใช้บริการ...
                                    </div>
                                ) : memberHistory.length === 0 ? (
                                    <div className="text-center py-16 bg-white border border-dashed border-[oklch(85%_0.012_28)] rounded-sm text-xs text-[oklch(55%_0.010_28)] uppercase tracking-wider">
                                        ไม่พบประวัติการสั่งซื้อหรือการจอง
                                    </div>
                                ) : (
                                    memberHistory.map((booking) => {
                                        const isCompleted = booking.status === 'completed' || booking.status === 'confirmed'
                                        return (
                                            <div 
                                                key={booking.id} 
                                                className="bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                                            >
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-xs uppercase border ${
                                                            isCompleted
                                                                ? 'bg-[oklch(94%_0.02_140)] text-[oklch(45%_0.08_140)] border-[oklch(45%_0.08_140)]'
                                                                : 'bg-[oklch(94%_0.02_28)] text-[oklch(52%_0.16_28)] border-[oklch(52%_0.16_28)]'
                                                        }`}>
                                                            {booking.status}
                                                        </span>
                                                        <span className="text-[11px] text-[oklch(55%_0.010_28)]">
                                                            {format(new Date(booking.created_at), 'dd MMM yyyy, HH:mm')}
                                                        </span>
                                                        {booking.booking_type && (
                                                            <span className="text-[10px] uppercase text-[oklch(55%_0.010_28)] bg-[oklch(94%_0.010_28)] px-1 rounded-xs">
                                                                {booking.booking_type}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs font-bold text-[oklch(18%_0.012_28)]">
                                                        {booking.order_items?.map(i => `${i.menu_items?.name || 'Item'} (x${i.quantity})`).join(', ') || 'ไม่มีรายการเมนูย่อย'}
                                                    </div>
                                                </div>

                                                <div className="text-right sm:self-center shrink-0">
                                                    <span className="text-sm font-bold text-[oklch(18%_0.012_28)]">
                                                        ฿{Number(booking.total_amount || 0).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
