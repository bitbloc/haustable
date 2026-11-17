/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from './lib/supabaseClient'
import { 
    Search, Shield, User, Phone, Edit2, X, Clock, Trash2, 
    Key, RefreshCw, EyeOff, Plus, Minus, Coins,
    Calendar, ArrowUpDown, CheckCircle2, ChevronRight,
    Coffee, Award, Gift, Lock, CheckSquare, Square
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { ADMIN_MODULES, ROLE_PERMISSIONS } from './utils/rbacHelper'
import { logStaffActivity } from './utils/auditLogger'

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
    // PINs are stored only as hashes: the list knows who has one, and a newly set PIN is
    // shown once in this session (justSetPins) and can never be read back afterwards.
    const [pinStatus, setPinStatus] = useState({}) // { [profileId]: updated_at }
    const [canManagePins, setCanManagePins] = useState(false)
    const [justSetPins, setJustSetPins] = useState({}) // { [profileId]: pin }

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
        clearPin: false,
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

            // 4. Which profiles have a POS PIN (owner/admin only; no PIN or hash is returned)
            const [{ data: adminFlag }, { data: pinRows, error: pinError }] = await Promise.all([
                supabase.rpc('is_admin'),
                supabase.rpc('admin_staff_pin_status')
            ])
            if (pinError) console.warn('Could not load PIN status:', pinError)
            setCanManagePins(adminFlag === true)
            setPinStatus(Object.fromEntries((pinRows || []).map(r => [r.profile_id, r.updated_at])))
        } catch (err) {
            console.error('Error fetching members:', err)
            toast.error('ไม่สามารถโหลดข้อมูลสมาชิกได้: ' + (err.message || ''))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchMembers()

        let debounceTimer = null
        const debouncedFetchMembers = () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
                fetchMembers()
            }, 500)
        }

        const channel = supabase
            .channel('admin_members_realtime_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, debouncedFetchMembers)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, debouncedFetchMembers)
            .subscribe()

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer)
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
                        tables_layout (table_name),
                        order_items (
                            *,
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

    // POS PIN: set / change / clear through admin_set_staff_pin (the PIN is stored hashed)
    const pinErrorMessage = (err) => {
        if (err?.code === '23505') return 'รหัส PIN นี้มีพนักงานคนอื่นใช้อยู่แล้ว กรุณาใช้รหัสอื่น'
        if (err?.code === '42501') return 'เฉพาะเจ้าของร้านหรือแอดมินเท่านั้นที่ตั้งรหัส PIN ได้'
        if (err?.code === '22023') return 'รหัส PIN ต้องเป็นตัวเลข 4-8 หลัก'
        return 'ไม่สามารถบันทึกรหัส PIN ได้: ' + (err?.message || '')
    }

    const setStaffPin = async (memberId, pin) => {
        const { error } = await supabase.rpc('admin_set_staff_pin', { p_profile_id: memberId, p_pin: pin || null })
        if (error) throw error
        if (pin) {
            setPinStatus(prev => ({ ...prev, [memberId]: new Date().toISOString() }))
            setJustSetPins(prev => ({ ...prev, [memberId]: pin }))
        } else {
            setPinStatus(prev => { const next = { ...prev }; delete next[memberId]; return next })
            setJustSetPins(prev => { const next = { ...prev }; delete next[memberId]; return next })
        }
    }

    // Reset / Randomize POS PIN (shown once, right after it is set)
    const handleResetPin = async (member) => {
        if (!window.confirm(`ต้องการสุ่มรหัส PIN ใหม่ของ "${member.display_name || member.nickname || 'พนักงาน'}" ใช่หรือไม่?\nรหัสใหม่จะแสดงเพียงครั้งเดียว กรุณาจดไว้ทันที`)) return

        try {
            // A random PIN may already belong to someone else: try a few times
            let lastErr = null
            for (let attempt = 0; attempt < 5; attempt++) {
                const randomPin = Math.floor(1000 + Math.random() * 9000).toString()
                try {
                    await setStaffPin(member.id, randomPin)
                    toast.success(`รหัส PIN ใหม่ของ ${member.display_name || 'พนักงาน'} คือ ${randomPin} (แสดงครั้งเดียว)`, { duration: 15000 })
                    return
                } catch (err) {
                    lastErr = err
                    if (err?.code !== '23505') break
                }
            }
            throw lastErr
        } catch (err) {
            console.error(err)
            toast.error(pinErrorMessage(err))
        }
    }

    // Open Edit Modal
    const openEditModal = (member) => {
        setEditingMember(member)
        const memberRole = (member.role || 'customer').toLowerCase()
        const defaultPerms = Array.isArray(member.admin_permissions) && member.admin_permissions.length > 0
            ? member.admin_permissions
            : (ROLE_PERMISSIONS[memberRole] || [])

        setEditForm({
            display_name: member.display_name || '',
            nickname: member.nickname || '',
            phone_number: member.phone_number || '',
            line_user_id: member.line_user_id || member.line_uid || '',
            admin_notes: member.admin_notes || '',
            birth_day: member.birth_day || '',
            birth_month: member.birth_month || '',
            gender: member.gender || '',
            pin: '',
            clearPin: false,
            drink_stamp_count: member.drink_stamp_count || 0,
            free_drink_quota: member.free_drink_quota || 0,
            role: memberRole,
            admin_permissions: defaultPerms
        })
    }

    // Save Edited Member
    const handleSaveMember = async (e) => {
        e.preventDefault()
        if (!editingMember) return

        const cleanPin = editForm.pin ? String(editForm.pin).trim() : ''
        if (cleanPin && !/^[0-9]{4,6}$/.test(cleanPin)) {
            toast.error('รหัส PIN ต้องเป็นตัวเลข 4-6 หลัก')
            return
        }

        // PIN first: if it is refused (already in use, not allowed) nothing else is saved
        try {
            if (cleanPin) {
                await setStaffPin(editingMember.id, cleanPin)
            } else if (editForm.clearPin) {
                await setStaffPin(editingMember.id, null)
            }
        } catch (err) {
            console.error('Failed to set PIN:', err)
            toast.error(pinErrorMessage(err))
            return
        }

        try {
            const finalPermissions = (editForm.role === 'owner' || editForm.role === 'admin')
                ? ['*']
                : (editForm.role === 'customer' ? [] : (editForm.admin_permissions || []))

            const payload = {
                display_name: editForm.display_name ? String(editForm.display_name).trim() : '',
                nickname: editForm.nickname ? String(editForm.nickname).trim() : '',
                phone_number: editForm.phone_number ? String(editForm.phone_number).trim() : '',
                line_user_id: editForm.line_user_id ? String(editForm.line_user_id).trim() : null,
                admin_notes: editForm.admin_notes ? String(editForm.admin_notes).trim() : null,
                birth_day: editForm.birth_day ? parseInt(editForm.birth_day, 10) : null,
                birth_month: editForm.birth_month ? parseInt(editForm.birth_month, 10) : null,
                gender: editForm.gender || null,
                drink_stamp_count: Math.min(9, Math.max(0, parseInt(editForm.drink_stamp_count || 0, 10))),
                free_drink_quota: Math.max(0, parseInt(editForm.free_drink_quota || 0, 10)),
                role: editForm.role || 'customer',
                admin_permissions: finalPermissions
            }

            const { error } = await supabase
                .from('profiles')
                .update(payload)
                .eq('id', editingMember.id)

            if (error) throw error

            setMembers(prev => prev.map(m => m.id === editingMember.id ? {
                ...m,
                ...payload
            } : m))

            setEditingMember(null)
            toast.success('บันทึกข้อมูลสมาชิกเรียบร้อยแล้ว')
        } catch (err) {
            console.error('Failed to save profile:', err)
            toast.error('ไม่สามารถบันทึกข้อมูลได้: ' + (err.message || 'เกิดข้อผิดพลาดในการบันทึก'))
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
            // Read the live balance first: the list on screen may be minutes old, and writing from it
            // would wipe out coins the member earned or spent in the meantime
            const { data: fresh, error: freshErr } = await supabase
                .from('profiles')
                .select('xhaus_balance, total_earned_xhaus')
                .eq('id', adjustingMember.id)
                .single()
            if (freshErr) throw freshErr

            const currentBal = Number(fresh.xhaus_balance || 0)
            const delta = adjustType === 'add' ? amountNum : -amountNum
            const newBal = Math.max(0, currentBal + delta)
            const updates = { xhaus_balance: newBal }
            if (adjustType === 'add') {
                updates.total_earned_xhaus = Number(fresh.total_earned_xhaus || 0) + amountNum
            }

            const { data: updatedRows, error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', adjustingMember.id)
                .select('id')

            if (error) throw error
            if (!updatedRows || updatedRows.length === 0) throw new Error('ไม่มีสิทธิ์ปรับแต้มของสมาชิกรายนี้')

            await logStaffActivity('crm', 'xhaus_manual_adjust', {
                amount: newBal - currentBal,
                reason: adjustReason.trim(),
                metadata: {
                    member_id: adjustingMember.id,
                    member_name: adjustingMember.display_name || adjustingMember.nickname || null,
                    balance_before: currentBal,
                    balance_after: newBal
                }
            })

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
                (m.line_user_id || m.line_uid || '').toLowerCase().includes(searchLower) ||
                (m.admin_notes || '').toLowerCase().includes(searchLower)

            if (!matchSearch) return false

            const isStaffMember = m.role && m.role !== 'customer'
            if (roleTab === 'staff') {
                return isStaffMember
            }
            if (roleTab === 'customer') {
                return !isStaffMember
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

    const staffCount = members.filter(m => m.role && m.role !== 'customer').length
    const customerCount = members.filter(m => !m.role || m.role === 'customer').length
    const totalXhaus = members.reduce((sum, m) => sum + (Number(m.xhaus_balance) || 0), 0)

    return (
        <div className="space-y-6">
            {/* Header Controls Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[var(--color-paper)] border border-[var(--color-rule)] p-4 rounded-sm">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Role Filter Tabs */}
                    <div className="flex bg-[var(--color-paper-2)] p-0.5 rounded-sm border border-[var(--color-rule)] tabular-nums text-xs">
                        <button
                            type="button"
                            onClick={() => setRoleTab('all')}
                            className={`px-3 py-1.5 rounded-sm font-bold transition-all ${
                                roleTab === 'all'
                                    ? 'bg-[var(--color-ink)] text-[var(--color-paper)] '
                                    : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                            }`}
                        >
                            ทั้งหมด ({members.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setRoleTab('staff')}
                            className={`px-3 py-1.5 rounded-sm font-bold transition-all flex items-center gap-1.5 ${
                                roleTab === 'staff'
                                    ? 'bg-[var(--brand-plum)] text-[var(--color-paper)] '
                                    : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                            }`}
                        >
                            <Shield size={12} />
                            <span>พนักงาน/แอดมิน ({staffCount})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setRoleTab('customer')}
                            className={`px-3 py-1.5 rounded-sm font-bold transition-all ${
                                roleTab === 'customer'
                                    ? 'bg-[var(--color-ink)] text-[var(--color-paper)] '
                                    : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                            }`}
                        >
                            ลูกค้าสมาชิก ({customerCount})
                        </button>
                    </div>

                    {/* Quick Stats Pill */}
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm tabular-nums text-xs text-[var(--color-muted)]">
                        <span>xHAUS ในระบบ:</span>
                        <span className="font-bold text-[var(--color-ink)]">{totalXhaus.toLocaleString()} 🪙</span>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    {/* Sort Selector */}
                    <div className="flex items-center gap-1.5 bg-[var(--color-paper)] border border-[var(--color-rule)] px-2.5 py-1.5 rounded-sm tabular-nums text-xs text-[var(--color-muted)]">
                        <ArrowUpDown size={13} className="text-[var(--color-neutral)]" />
                        <span className="text-xs font-bold text-[var(--color-neutral)]">เรียง:</span>
                        <select 
                            value={sortBy} 
                            onChange={e => setSortBy(e.target.value)}
                            className="bg-transparent font-bold text-[var(--color-ink)] outline-none cursor-pointer"
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
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-neutral)] w-3.5 h-3.5" />
                        <input
                            type="text"
                            placeholder="ค้นชื่อ, เบอร์, LINE ID..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm pl-8 pr-3 py-1.5 text-xs text-[var(--color-ink)] tabular-nums placeholder:text-[var(--color-neutral)] focus:outline-none focus:border-[var(--color-ink)] transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Members List Table / Cards */}
            {loading ? (
                <div className="text-center py-16 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[var(--color-rule)] border-b-[var(--color-ink)] mb-2" />
                    <p className="tabular-nums text-[13px] text-[var(--color-neutral)]">กำลังโหลดข้อมูลสมาชิกและพนักงาน...</p>
                </div>
            ) : filteredAndSortedMembers.length === 0 ? (
                <div className="text-center py-16 bg-[var(--color-paper)] border border-dashed border-[var(--color-rule)] rounded-sm">
                    <p className="tabular-nums text-[13px] text-[var(--color-neutral)]">ไม่พบข้อมูลสมาชิกตามเงื่อนไขที่ระบุ</p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {filteredAndSortedMembers.map((member) => {
                        const isOwner = member.role === 'owner'
                        const isAdmin = member.role === 'admin'
                        const isMaster = isOwner || isAdmin
                        const isCustom = member.role === 'custom'
                        const isStaff = ['staff', 'cashier', 'kitchen', 'manager'].includes(member.role) || isCustom
                        const hasPin = Boolean(pinStatus[member.id])
                        const justSetPin = justSetPins[member.id]

                        return (
                            <motion.div
                                layout
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                key={member.id}
                                className={`bg-[var(--color-paper)] border rounded-sm p-4 transition-all flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 ${
                                    isMaster 
                                        ? 'border-[var(--brand-plum)] bg-[var(--color-paper)]' 
                                        : isCustom
                                            ? 'border-amber-400 bg-amber-50/20'
                                            : isStaff
                                                ? 'border-[oklch(45%_0.08_140)] '
                                                : 'border-[var(--color-rule)] hover:border-[var(--color-neutral)]'
                                }`}
                            >
                                {/* Left Section: Avatar & Info */}
                                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                                    {/* Role Avatar */}
                                    <div className={`w-11 h-11 rounded-sm flex items-center justify-center shrink-0 border tabular-nums font-bold text-xs ${
                                        isMaster
                                            ? 'bg-[var(--brand-plum)] text-[var(--color-paper)] border-[var(--brand-plum)]'
                                            : isCustom
                                                ? 'bg-amber-600 text-[var(--color-paper)] border-amber-600'
                                                : isStaff
                                                    ? 'bg-[oklch(45%_0.08_140)] text-[var(--color-paper)] border-[oklch(45%_0.08_140)]'
                                                    : 'bg-[var(--color-paper-2)] text-[var(--color-muted)] border-[var(--color-rule)]'
                                    }`}>
                                        {isMaster ? <Shield size={18} /> : <User size={18} />}
                                    </div>

                                    {/* User Details */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="tabular-nums text-sm font-bold text-[var(--color-ink)] truncate">
                                                {member.display_name || 'Unnamed Member'}
                                            </h3>
                                            {member.nickname && (
                                                <span className="tabular-nums text-[11px] font-bold px-1.5 py-0.2 bg-[var(--color-paper-2)] text-[var(--color-muted)] border border-[var(--color-rule)] rounded-xs">
                                                    ({member.nickname})
                                                </span>
                                            )}
                                            <span className={`capitalize text-[11px] font-semibold px-1.5 py-0.2 rounded-xs border ${
                                                isMaster
                                                    ? 'bg-[var(--color-paper-2)] text-[var(--brand-plum)] border-[var(--brand-plum)]'
                                                    : isCustom
                                                        ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                                                        : isStaff
                                                            ? 'bg-[oklch(94%_0.02_140)] text-[oklch(45%_0.08_140)] border-[oklch(45%_0.08_140)]'
                                                            : 'bg-[var(--color-paper)] text-[var(--color-neutral)] border-[var(--color-rule)]'
                                            }`}>
                                                {isCustom ? `Custom (${(member.admin_permissions || []).length}/${ADMIN_MODULES.length})` : (member.role || 'customer')}
                                            </span>
                                            {member.current_tier && (
                                                <span className="tabular-nums text-[11px] font-bold px-1.5 py-0.2 bg-[var(--brand-plum)]/10 text-[var(--brand-plum)] border border-[var(--brand-plum)]/30 rounded-xs ">
                                                    {member.current_tier}
                                                </span>
                                            )}
                                        </div>

                                        {/* Secondary Meta Tags */}
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 tabular-nums text-xs text-[var(--color-neutral)] mt-1">
                                            {member.phone_number && (
                                                <span className="flex items-center gap-1 text-[var(--color-ink)] font-medium">
                                                    <Phone size={11} className="text-[var(--color-neutral)]" />
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
                                            <div className="flex items-center gap-1.5 bg-[var(--color-paper)] border border-[var(--color-rule)] px-2 py-0.5 rounded-xs tabular-nums text-xs">
                                                <Key size={12} className="text-[var(--brand-plum)]" />
                                                <span className="text-xs text-[var(--color-neutral)]">PIN POS:</span>
                                                <span className="font-bold tracking-wider text-[var(--color-ink)]">
                                                    {!canManagePins
                                                        ? <span className="text-[var(--color-neutral)] italic font-normal text-xs">เฉพาะแอดมิน</span>
                                                        : justSetPin
                                                            ? justSetPin
                                                            : hasPin
                                                                ? '••••'
                                                                : <span className="text-[var(--color-neutral)] italic font-normal text-xs">ยังไม่ตั้ง</span>}
                                                </span>
                                                {justSetPin && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setJustSetPins(prev => { const next = { ...prev }; delete next[member.id]; return next })}
                                                        className="text-[var(--color-neutral)] hover:text-[var(--color-ink)] p-0.5 cursor-pointer ml-0.5"
                                                        title="ซ่อน PIN (จะดูซ้ำไม่ได้)"
                                                    >
                                                        <EyeOff size={11} />
                                                    </button>
                                                )}
                                            </div>

                                            {canManagePins && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleResetPin(member)}
                                                    className="text-[11px] tabular-nums font-bold text-[var(--brand-plum)] hover:bg-[var(--color-paper-2)] border border-[var(--color-rule)] px-2 py-0.5 rounded-xs transition-colors flex items-center gap-1 cursor-pointer"
                                                    title="สุ่มรีเซ็ตรหัส PIN 4 หลักใหม่"
                                                >
                                                    <RefreshCw size={9} /> สุ่ม PIN ใหม่
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Middle Section: Stats, Stamps & Points */}
                                <div className="flex flex-wrap items-center gap-4 sm:gap-6 border-t md:border-t-0 md:border-l border-[var(--color-rule)] pt-3 md:pt-0 md:pl-6 w-full md:w-auto justify-between md:justify-end">
                                    <div className="text-center tabular-nums">
                                        <p className="text-base font-bold text-[var(--color-ink)]">{member.total_bookings || 0}</p>
                                        <p className="text-[13px] text-[var(--color-neutral)]">Bookings</p>
                                    </div>

                                    {/* Drink Stamps (10 Free 1) */}
                                    <div className="text-center tabular-nums">
                                        <div className="flex items-center justify-center gap-1">
                                            <p className="text-base font-bold text-[var(--color-ink)]">
                                                ☕ {member.drink_stamp_count || 0}<span className="text-xs text-[var(--color-neutral)] font-normal">/10</span>
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAdjustingStampMember(member)
                                                    setStampCountInput(member.drink_stamp_count || 0)
                                                    setFreeQuotaInput(member.free_drink_quota || 0)
                                                }}
                                                className="p-1 text-[var(--color-neutral)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] rounded-xs transition-colors cursor-pointer"
                                                title="ปรับจำนวนแก้วสะสม / สิทธิ์เครื่องดื่มฟรี"
                                            >
                                                <Edit2 size={11} />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-center gap-1 mt-0.5">
                                            <p className="text-[13px] text-[var(--color-neutral)]">Stamps</p>
                                            {(member.free_drink_quota || 0) > 0 && (
                                                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1 py-0.2 rounded-xs">
                                                    🎁 ฟรี {member.free_drink_quota}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* xHAUS Points */}
                                    <div className="text-center tabular-nums">
                                        <div className="flex items-center justify-center gap-1">
                                            <p className="text-base font-bold text-[var(--brand-plum)]">
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
                                                className="p-1 text-[var(--color-neutral)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] rounded-xs transition-colors cursor-pointer"
                                                title="ปรับเพิ่ม/ลดเหรียญ xhaus"
                                            >
                                                <Coins size={13} />
                                            </button>
                                        </div>
                                        <p className="text-[13px] text-[var(--color-neutral)]">xHAUS Points</p>
                                    </div>
                                </div>

                                {/* Right Section: Action Controls */}
                                <div className="flex flex-wrap items-center gap-2 border-t md:border-t-0 md:border-l border-[var(--color-rule)] pt-3 md:pt-0 md:pl-6 w-full md:w-auto justify-end tabular-nums text-xs">
                                    <button
                                        type="button"
                                        onClick={() => openEditModal(member)}
                                        className="px-2.5 py-1.5 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-3)] text-[var(--color-ink)] font-bold rounded-sm border border-[var(--color-rule)] flex items-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                        <Edit2 size={12} />
                                        <span>แก้ไข</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleViewHistory(member)}
                                        className="px-2.5 py-1.5 bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)] text-[var(--color-ink)] font-bold rounded-sm border border-[var(--color-rule)] flex items-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                        <Clock size={12} />
                                        <span>ประวัติบิล</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleToggleRole(member)}
                                        className={`px-2.5 py-1.5 font-bold rounded-sm border transition-colors cursor-pointer ${
                                            isAdmin
                                                ? 'bg-[var(--color-paper)] text-[var(--brand-plum)] border-[var(--brand-plum)] hover:bg-[var(--color-paper-2)]'
                                                : 'bg-[var(--color-paper)] text-[var(--color-muted)] border-[var(--color-rule)] hover:border-[var(--color-ink)]'
                                        }`}
                                        title={isAdmin ? "ปลดสิทธิ์ Admin" : "ตั้งเป็น Admin"}
                                    >
                                        {isAdmin ? 'ADMIN' : 'ROLE'}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleDeleteUser(member)}
                                        className="p-1.5 text-[var(--color-neutral)] hover:text-[var(--brand-plum)] hover:bg-[var(--color-paper-2)] rounded-sm border border-transparent hover:border-[var(--color-rule)] transition-colors cursor-pointer"
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
                            className="bg-[var(--color-paper)] w-full max-w-lg rounded-sm border border-[var(--color-rule)] shadow-xl overflow-hidden tabular-nums"
                        >
                            <div className="p-4 border-b border-[var(--color-rule)] bg-[var(--color-paper)] flex justify-between items-center">
                                <div>
                                    <span className="text-xs font-bold text-[var(--brand-plum)]">MEMBER PROFILE CRM</span>
                                    <h2 className="text-base font-bold text-[var(--color-ink)]">แก้ไขข้อมูลสมาชิก & พนักงาน</h2>
                                </div>
                                <button 
                                    onClick={() => setEditingMember(null)} 
                                    className="p-1 hover:bg-[var(--color-paper-2)] rounded-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveMember} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-[var(--color-neutral)] mb-1">
                                            Display Name (ชื่อแสดงผล) *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={editForm.display_name}
                                            onChange={e => setEditForm({ ...editForm, display_name: e.target.value })}
                                            className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm p-2.5 text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--color-neutral)] mb-1">
                                            Nickname (ชื่อเล่น)
                                        </label>
                                        <input
                                            type="text"
                                            value={editForm.nickname}
                                            onChange={e => setEditForm({ ...editForm, nickname: e.target.value })}
                                            className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm p-2.5 text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-[var(--color-neutral)] mb-1">
                                            Phone Number (เบอร์โทรศัพท์)
                                        </label>
                                        <input
                                            type="tel"
                                            placeholder="0812345678"
                                            value={editForm.phone_number}
                                            onChange={e => setEditForm({ ...editForm, phone_number: e.target.value })}
                                            className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm p-2.5 text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--color-neutral)] mb-1">
                                            Gender (เพศ)
                                        </label>
                                        <select
                                            value={editForm.gender}
                                            onChange={e => setEditForm({ ...editForm, gender: e.target.value })}
                                            className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm p-2.5 text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                        >
                                            <option value="">ไม่ระบุ</option>
                                            <option value="Male">ชาย</option>
                                            <option value="Female">หญิง</option>
                                            <option value="Other">อื่นๆ</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[var(--color-neutral)] mb-1">
                                        Birthday (วันเกิด / เดือนเกิด สำหรับโปรโมชั่นวันเกิด)
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <select
                                            value={editForm.birth_day}
                                            onChange={e => setEditForm({ ...editForm, birth_day: e.target.value })}
                                            className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm p-2.5 text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                        >
                                            <option value="">วัน</option>
                                            {[...Array(31)].map((_, i) => (
                                                <option key={i} value={i + 1}>{i + 1}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={editForm.birth_month}
                                            onChange={e => setEditForm({ ...editForm, birth_month: e.target.value })}
                                            className="col-span-2 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm p-2.5 text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                        >
                                            <option value="">เดือน</option>
                                            {THAI_MONTHS.map((m, i) => (
                                                <option key={i} value={i + 1}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Role & Backoffice Permissions Matrix */}
                                <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] p-3.5 rounded-sm space-y-3">
                                    <div>
                                        <label className="text-xs font-bold text-[var(--color-ink)] flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                                <Shield size={13} className="text-[var(--brand-plum)]" />
                                                <span>USER ROLE & BACKOFFICE PERMISSIONS (บทบาทและสิทธิ์ระบบ)</span>
                                            </span>
                                            <span className="text-xs tabular-nums text-[var(--brand-plum)] font-bold">
                                                {editForm.role}
                                            </span>
                                        </label>
                                        <select
                                            value={editForm.role}
                                            onChange={e => {
                                                const newRole = e.target.value
                                                if (newRole === 'custom') {
                                                    setEditForm({
                                                        ...editForm,
                                                        role: 'custom',
                                                        admin_permissions: (editForm.admin_permissions && editForm.admin_permissions.length > 0)
                                                            ? editForm.admin_permissions.filter(k => k !== '*')
                                                            : ['tables', 'bookings']
                                                    })
                                                } else {
                                                    const defPerms = ROLE_PERMISSIONS[newRole] || []
                                                    setEditForm({
                                                        ...editForm,
                                                        role: newRole,
                                                        admin_permissions: (newRole === 'owner' || newRole === 'admin') ? ['*'] : defPerms
                                                    })
                                                }
                                            }}
                                            className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm p-2 text-xs tabular-nums font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)] mt-1"
                                        >
                                            <option value="customer">CUSTOMER / สมาชิกทั่วไป (ไม่มีสิทธิ์หลังบ้าน)</option>
                                            <option value="staff">STAFF / พนักงานบริการ (เข้าได้เฉพาะ Floor, Bookings)</option>
                                            <option value="cashier">CASHIER / แคชเชียร์ (เข้าได้ Overview, Floor, Bookings)</option>
                                            <option value="kitchen">KITCHEN / ครัวและบาร์ (เข้าได้เฉพาะ Menu, Bookings)</option>
                                            <option value="manager">MANAGER / ผู้จัดการร้าน (เข้าได้เกือบทุกหมวดหมู่ ยกเว้น Financial/Settings)</option>
                                            <option value="custom">CUSTOM / กำหนดสิทธิ์เอง (เลือกหมวดหมู่ที่ต้องการด้านล่าง)</option>
                                            <option value="owner">OWNER / เจ้าของร้าน (เข้าได้ทุกหมวดหมู่ 100%)</option>
                                            <option value="admin">ADMIN / ผู้ดูแลระบบ (เข้าได้ทุกหมวดหมู่ 100%)</option>
                                        </select>
                                    </div>

                                    {/* Module Permissions Checkbox Grid */}
                                    {editForm.role !== 'customer' && (
                                        <div className="pt-2 border-t border-[var(--color-paper-3)] space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-[var(--color-muted)] ">
                                                    สิทธิ์การเข้าถึง {ADMIN_MODULES.length} หมวดหมู่หลังบ้าน (Custom Permissions):
                                                </span>
                                                {(editForm.role === 'owner' || editForm.role === 'admin') && (
                                                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded-xs">
                                                        MASTER ACCESS (ทุกหมวดหมู่)
                                                    </span>
                                                )}
                                                {editForm.role === 'custom' && (
                                                    <span className="text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded-xs">
                                                        CUSTOMIZED ({(editForm.admin_permissions || []).length}/{ADMIN_MODULES.length} หมวด)
                                                    </span>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                {ADMIN_MODULES.map((mod) => {
                                                    const isOwnerOrAdmin = editForm.role === 'owner' || editForm.role === 'admin'
                                                    const isChecked = isOwnerOrAdmin || (editForm.admin_permissions || []).includes(mod.key)

                                                    return (
                                                        <label 
                                                            key={mod.key} 
                                                            className={`flex items-center gap-2 p-2 bg-[var(--color-paper)] rounded-xs border tabular-nums text-xs select-none transition-colors ${
                                                                isChecked ? 'border-[var(--brand-plum)] font-bold text-[var(--color-ink)]' : 'border-[var(--color-paper-3)] text-[var(--color-neutral)]'
                                                            } ${isOwnerOrAdmin ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer hover:border-[var(--brand-plum)]'}`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                disabled={isOwnerOrAdmin}
                                                                checked={isChecked}
                                                                onChange={(e) => {
                                                                    const current = editForm.admin_permissions || []
                                                                    let next
                                                                    if (e.target.checked) {
                                                                        next = [...current.filter(k => k !== '*'), mod.key]
                                                                    } else {
                                                                        next = current.filter(k => k !== mod.key && k !== '*')
                                                                    }
                                                                    const isPreset = ['staff', 'cashier', 'kitchen', 'manager'].includes(editForm.role)
                                                                    setEditForm({ 
                                                                        ...editForm, 
                                                                        role: isPreset ? 'custom' : editForm.role,
                                                                        admin_permissions: next 
                                                                    })
                                                                }}
                                                                className="accent-[var(--brand-plum)]"
                                                            />
                                                            <span>{mod.label}</span>
                                                        </label>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {canManagePins && (
                                <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] p-3 rounded-sm space-y-2">
                                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                                        <label className="text-xs font-bold text-[var(--brand-plum)] flex items-center gap-1.5">
                                            <Key size={12} className="shrink-0" />
                                            <span>POS Staff PIN Code (รหัส PIN พนักงาน 4-6 หลัก)</span>
                                        </label>
                                        <div className="flex items-center gap-3 shrink-0">
                                            {pinStatus[editingMember.id] && (
                                                <button
                                                    type="button"
                                                    onClick={() => setEditForm({ ...editForm, pin: '', clearPin: !editForm.clearPin })}
                                                    className="text-xs text-[var(--color-muted)] hover:underline font-bold cursor-pointer"
                                                >
                                                    {editForm.clearPin ? 'ยกเลิกการลบ' : 'ลบ PIN'}
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newPin = Math.floor(1000 + Math.random() * 9000).toString()
                                                    setEditForm({ ...editForm, pin: newPin, clearPin: false })
                                                }}
                                                className="text-xs text-[var(--brand-plum)] hover:underline flex items-center gap-1 font-bold cursor-pointer"
                                            >
                                                <RefreshCw size={10} /> สุ่ม PIN 4 หลัก
                                            </button>
                                        </div>
                                    </div>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={6}
                                        placeholder={editForm.clearPin
                                            ? 'จะลบรหัส PIN เมื่อกดบันทึก'
                                            : (pinStatus[editingMember.id] ? 'ตั้งรหัสไว้แล้ว เว้นว่างถ้าไม่เปลี่ยน' : 'เช่น 1234')}
                                        disabled={editForm.clearPin}
                                        value={editForm.pin || ''}
                                        onChange={e => setEditForm({ ...editForm, pin: e.target.value.replace(/\D/g, ''), clearPin: false })}
                                        className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm p-2.5 text-base font-bold tracking-widest text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)] placeholder:font-normal placeholder:tracking-normal placeholder:text-[13px] disabled:opacity-60"
                                    />
                                    <p className="text-[13px] text-[var(--color-neutral)]">ใช้สำหรับปลดล็อกหน้าจอ POS และเปิด/ปิดกะพนักงาน รหัสที่บันทึกแล้วจะดูย้อนหลังไม่ได้ กรุณาจดไว้ก่อนกดบันทึก</p>
                                </div>
                                )}

                                {/* Drink Stamps & Quota */}
                                <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] p-3 rounded-sm space-y-2">
                                    <label className="text-xs font-bold text-[var(--color-ink)] flex items-center gap-1.5">
                                        <Coffee size={12} className="text-[var(--brand-plum)]" />
                                        <span>Drink Stamps & Free Drink Quota (สะสมแก้ว 10 แถม 1)</span>
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-[var(--color-neutral)] mb-1">
                                                แก้วสะสมปัจจุบัน (0-9 แก้ว)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="9"
                                                value={editForm.drink_stamp_count}
                                                onChange={e => setEditForm({ ...editForm, drink_stamp_count: e.target.value })}
                                                className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm p-2 text-xs tabular-nums font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-[var(--color-neutral)] mb-1">
                                                สิทธิ์เครื่องดื่มฟรี (แก้ว)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={editForm.free_drink_quota}
                                                onChange={e => setEditForm({ ...editForm, free_drink_quota: e.target.value })}
                                                className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm p-2 text-xs tabular-nums font-bold text-emerald-800 outline-none focus:border-[var(--color-ink)]"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[var(--color-neutral)] mb-1">
                                        LINE User ID
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                        value={editForm.line_user_id}
                                        onChange={e => setEditForm({ ...editForm, line_user_id: e.target.value })}
                                        className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm p-2.5 text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[var(--color-neutral)] mb-1">
                                        Admin Notes (หมายเหตุภายในสำหรับแอดมิน)
                                    </label>
                                    <textarea
                                        rows={2}
                                        placeholder="เช่น ลูกค้า VIP ชอบนั่งโซนริมหน้าต่าง..."
                                        value={editForm.admin_notes}
                                        onChange={e => setEditForm({ ...editForm, admin_notes: e.target.value })}
                                        className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm p-2.5 text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)] resize-none"
                                    />
                                </div>

                                <div className="pt-3 border-t border-[var(--color-rule)] flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditingMember(null)}
                                        className="px-4 py-2 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-3)] text-[var(--color-ink)] font-bold rounded-sm border border-[var(--color-rule)] text-xs cursor-pointer"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2 bg-[var(--color-ink)] hover:bg-[var(--color-ink)] text-[var(--color-paper)] font-bold rounded-sm text-xs cursor-pointer "
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
                            className="bg-[var(--color-paper)] w-full max-w-sm rounded-sm border border-[var(--color-rule)] shadow-xl overflow-hidden tabular-nums"
                        >
                            <div className="p-4 border-b border-[var(--color-rule)] flex justify-between items-center bg-[var(--color-paper)]">
                                <div>
                                    <span className="text-xs font-bold text-[var(--brand-plum)]">xHAUS LOYALTY POINTS</span>
                                    <h3 className="text-sm font-bold text-[var(--color-ink)]">
                                        ปรับแต้ม: {adjustingMember.display_name || 'สมาชิก'}
                                    </h3>
                                </div>
                                <button onClick={() => setAdjustingMember(null)} className="p-1 hover:bg-[var(--color-paper-2)] rounded-sm cursor-pointer">
                                    <X size={16} />
                                </button>
                            </div>

                            <form onSubmit={handleAdjustCoins} className="p-5 space-y-4">
                                <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] p-3 rounded-sm text-center">
                                    <span className="text-xs text-[var(--color-neutral)]">ยอดแต้มสะสมปัจจุบัน</span>
                                    <p className="text-2xl font-bold text-[var(--brand-plum)]">
                                        {Number(adjustingMember.xhaus_balance || 0).toLocaleString()} <span className="text-xs">xhaus</span>
                                    </p>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setAdjustType('add')}
                                        className={`flex-1 py-2 font-bold text-xs rounded-sm border transition-colors flex items-center justify-center gap-1.5 ${
                                            adjustType === 'add'
                                                ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)]'
                                                : 'bg-[var(--color-paper)] text-[var(--color-muted)] border-[var(--color-rule)]'
                                        }`}
                                    >
                                        <Plus size={13} /> เพิ่มแต้ม
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAdjustType('deduct')}
                                        className={`flex-1 py-2 font-bold text-xs rounded-sm border transition-colors flex items-center justify-center gap-1.5 ${
                                            adjustType === 'deduct'
                                                ? 'bg-[var(--brand-plum)] text-[var(--color-paper)] border-[var(--brand-plum)]'
                                                : 'bg-[var(--color-paper)] text-[var(--color-muted)] border-[var(--color-rule)]'
                                        }`}
                                    >
                                        <Minus size={13} /> หักแต้ม
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[var(--color-neutral)] mb-1">
                                        จำนวนเหรียญที่ต้องการ {adjustType === 'add' ? 'เพิ่ม' : 'หัก'}
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        placeholder="เช่น 50"
                                        value={adjustAmount}
                                        onChange={e => setAdjustAmount(e.target.value)}
                                        className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm p-2.5 text-base font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[var(--color-neutral)] mb-1">
                                        เหตุผลการปรับแต้ม (สำหรับประวัติภายใน)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="เช่น ชดเชยออเดอร์ล่าช้า / รางวัลพิเศษ..."
                                        value={adjustReason}
                                        onChange={e => setAdjustReason(e.target.value)}
                                        className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm p-2 text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                    />
                                </div>

                                <div className="pt-2 flex justify-end gap-2 border-t border-[var(--color-rule)]">
                                    <button
                                        type="button"
                                        onClick={() => setAdjustingMember(null)}
                                        className="px-3 py-1.5 bg-[var(--color-paper-2)] text-[var(--color-ink)] font-bold rounded-sm border border-[var(--color-rule)] text-xs cursor-pointer"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isAdjusting}
                                        className="px-4 py-1.5 bg-[var(--color-ink)] text-[var(--color-paper)] font-bold rounded-sm text-xs cursor-pointer disabled:opacity-50"
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
                            className="bg-[var(--color-paper)] w-full max-w-sm rounded-sm border border-[var(--color-rule)] shadow-xl overflow-hidden tabular-nums"
                        >
                            <div className="p-4 border-b border-[var(--color-rule)] flex justify-between items-center bg-[var(--color-paper)]">
                                <div>
                                    <span className="text-xs font-bold text-[var(--brand-plum)]">DRINK STAMP CARD (10 FREE 1)</span>
                                    <h3 className="text-sm font-bold text-[var(--color-ink)]">
                                        ปรับสแตมป์: {adjustingStampMember.display_name || 'สมาชิก'}
                                    </h3>
                                </div>
                                <button onClick={() => setAdjustingStampMember(null)} className="p-1 hover:bg-[var(--color-paper-2)] rounded-sm cursor-pointer">
                                    <X size={16} />
                                </button>
                            </div>

                            <form onSubmit={handleAdjustStamps} className="p-5 space-y-4">
                                <div className="grid grid-cols-2 gap-2 bg-[var(--color-paper)] border border-[var(--color-rule)] p-3 rounded-sm text-center">
                                    <div>
                                        <span className="text-xs text-[var(--color-neutral)]">สแตมป์ปัจจุบัน</span>
                                        <p className="text-xl font-bold text-[var(--color-ink)]">
                                            ☕ {adjustingStampMember.drink_stamp_count || 0}/10
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-[var(--color-neutral)]">สิทธิ์เครื่องดื่มฟรี</span>
                                        <p className="text-xl font-bold text-emerald-700">
                                            🎁 {adjustingStampMember.free_drink_quota || 0} แก้ว
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[var(--color-neutral)] mb-1">
                                        จำนวนแก้วสะสมใหม่ (0 - 9 แก้ว)
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setStampCountInput(prev => Math.max(0, parseInt(prev || 0) - 1))}
                                            className="px-3 py-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] font-bold text-sm rounded-sm hover:bg-[var(--color-paper-3)] cursor-pointer"
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
                                            className="w-full text-center bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm p-2 text-base font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setStampCountInput(prev => Math.min(9, parseInt(prev || 0) + 1))}
                                            className="px-3 py-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] font-bold text-sm rounded-sm hover:bg-[var(--color-paper-3)] cursor-pointer"
                                        >
                                            +1
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[var(--color-neutral)] mb-1">
                                        สิทธิ์เครื่องดื่มฟรีใหม่ (แก้ว)
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setFreeQuotaInput(prev => Math.max(0, parseInt(prev || 0) - 1))}
                                            className="px-3 py-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] font-bold text-sm rounded-sm hover:bg-[var(--color-paper-3)] cursor-pointer"
                                        >
                                            -1
                                        </button>
                                        <input
                                            type="number"
                                            min="0"
                                            required
                                            value={freeQuotaInput}
                                            onChange={e => setFreeQuotaInput(Math.max(0, parseInt(e.target.value || 0)))}
                                            className="w-full text-center bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm p-2 text-base font-bold text-emerald-800 outline-none focus:border-[var(--color-ink)]"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setFreeQuotaInput(prev => parseInt(prev || 0) + 1)}
                                            className="px-3 py-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] font-bold text-sm rounded-sm hover:bg-[var(--color-paper-3)] cursor-pointer"
                                        >
                                            +1
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-2 flex justify-end gap-2 border-t border-[var(--color-rule)]">
                                    <button
                                        type="button"
                                        onClick={() => setAdjustingStampMember(null)}
                                        className="px-3 py-1.5 bg-[var(--color-paper-2)] text-[var(--color-ink)] font-bold rounded-sm border border-[var(--color-rule)] text-xs cursor-pointer"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isAdjustingStamps}
                                        className="px-4 py-1.5 bg-[var(--color-ink)] text-[var(--color-paper)] font-bold rounded-sm text-xs cursor-pointer disabled:opacity-50"
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
                            className="bg-[var(--color-paper)] w-full max-w-2xl max-h-[85vh] rounded-sm border border-[var(--color-rule)] shadow-2xl flex flex-col overflow-hidden tabular-nums"
                        >
                            {/* History Header */}
                            <div className="p-4 border-b border-[var(--color-rule)] flex justify-between items-start bg-[var(--color-paper)]">
                                <div>
                                    <span className="text-xs font-bold text-[var(--brand-plum)]">CUSTOMER SERVICE HISTORY</span>
                                    <h2 className="text-base font-bold text-[var(--color-ink)] mt-0.5">
                                        {selectedMember.display_name} {selectedMember.nickname && `(${selectedMember.nickname})`}
                                    </h2>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-neutral)] mt-1">
                                        <span>เบอร์: <strong className="text-[var(--color-ink)]">{selectedMember.phone_number || '-'}</strong></span>
                                        <span>xHAUS: <strong className="text-[var(--brand-plum)]">{Number(selectedMember.xhaus_balance || 0).toLocaleString()} 🪙</strong></span>
                                        <span>ประวัติทั้งหมด: <strong className="text-[var(--color-ink)]">{memberHistory.length} รายการ</strong></span>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedMember(null)} className="p-1 hover:bg-[var(--color-paper-2)] rounded-sm cursor-pointer">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* History List */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--color-paper)]">
                                {historyLoading ? (
                                    <div className="text-center py-16 text-xs text-[var(--color-neutral)]  ">
                                        กำลังโหลดประวัติการใช้บริการ...
                                    </div>
                                ) : memberHistory.length === 0 ? (
                                    <div className="text-center py-16 bg-[var(--color-paper)] border border-dashed border-[var(--color-rule)] rounded-sm text-xs text-[var(--color-neutral)]  ">
                                        ไม่พบประวัติการสั่งซื้อหรือการจอง
                                    </div>
                                ) : (
                                    memberHistory.map((booking) => {
                                        const isCompleted = booking.status === 'completed' || booking.status === 'confirmed'
                                        const rawItems = (booking.order_items && booking.order_items.length > 0)
                                            ? booking.order_items
                                            : (Array.isArray(booking.items) ? booking.items : (typeof booking.items === 'string' ? (() => { try { return JSON.parse(booking.items); } catch { return []; } })() : []))

                                        const tableName = booking.table_name || booking.tables_layout?.table_name

                                        return (
                                            <div 
                                                key={booking.id} 
                                                className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-sm p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 "
                                            >
                                                <div className="space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className={`text-[11px] font-bold px-1.5 py-0.2 rounded-xs border ${
                                                            isCompleted
                                                                ? 'bg-[oklch(94%_0.02_140)] text-[oklch(45%_0.08_140)] border-[oklch(45%_0.08_140)]'
                                                                : 'bg-[var(--color-paper-2)] text-[var(--brand-plum)] border-[var(--brand-plum)]'
                                                        }`}>
                                                            {booking.status}
                                                        </span>
                                                        <span className="text-xs text-[var(--color-neutral)]">
                                                            {booking.created_at ? format(new Date(booking.created_at), 'dd MMM yyyy, HH:mm') : '-'}
                                                        </span>
                                                        {booking.booking_type && (
                                                            <span className="text-[11px] text-[var(--color-neutral)] bg-[var(--color-paper-2)] px-1 rounded-xs">
                                                                {booking.booking_type}
                                                            </span>
                                                        )}
                                                        {tableName && (
                                                            <span className="text-[11px] text-[oklch(45%_0.08_140)] bg-[oklch(94%_0.02_140)] px-1 rounded-xs font-bold border border-[oklch(45%_0.08_140)/30]">
                                                                {tableName}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs font-bold text-[var(--color-ink)]">
                                                        {rawItems && rawItems.length > 0
                                                            ? rawItems.map(i => {
                                                                const name = i.name || i.item_name || i.custom_name || i.menu_items?.name || (typeof i === 'string' ? i : 'รายการสินค้า')
                                                                const qty = i.quantity || i.qty || 1
                                                                return `${name} (x${qty})`
                                                            }).join(', ')
                                                            : 'ไม่มีรายการเมนูย่อย'
                                                        }
                                                    </div>
                                                    {(Number(booking.xhaus_earned || 0) > 0 || Number(booking.xhaus_redeemed || 0) > 0 || Number(booking.xhaus_discount || 0) > 0) && (
                                                        <div className="flex flex-wrap gap-1.5 pt-0.5 text-xs font-bold">
                                                            {Number(booking.xhaus_earned || 0) > 0 && (
                                                                <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded-xs">
                                                                    +{Number(booking.xhaus_earned)} xHAUS
                                                                </span>
                                                            )}
                                                            {Number(booking.xhaus_redeemed || 0) > 0 && (
                                                                <span className="text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.2 rounded-xs">
                                                                    -{Number(booking.xhaus_redeemed)} xHAUS
                                                                </span>
                                                            )}
                                                            {Number(booking.xhaus_discount || 0) > 0 && (
                                                                <span className="text-purple-700 bg-purple-50 border border-purple-200 px-1 py-0.2 rounded-xs">
                                                                    -฿{Number(booking.xhaus_discount).toLocaleString()} ส่วนลดแต้ม
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="text-right sm:self-center shrink-0">
                                                    <span className="text-sm font-bold text-[var(--color-ink)]">
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
