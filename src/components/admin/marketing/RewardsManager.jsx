/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { Plus, Trash2, Edit2, Search, Gift, Coins, Copy, Check, X, AlertCircle, Link as LinkIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

export default function RewardsManager() {
    const [rewards, setRewards] = useState([])
    const [menuItems, setMenuItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'active' | 'inactive'
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingReward, setEditingReward] = useState(null)
    const [copiedId, setCopiedId] = useState(null)

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        xhaus_cost: '',
        claim_code: '',
        usage_limit: '',
        is_active: true,
        linked_menu_item_id: ''
    })

    const fetchData = async () => {
        try {
            setLoading(true)
            const [rewardsRes, menuRes] = await Promise.all([
                supabase
                    .from('xhaus_rewards')
                    .select('*')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('menu_items')
                    .select('id, name, price')
                    .eq('is_available', true)
                    .order('name')
            ])

            if (rewardsRes.error) throw rewardsRes.error
            setRewards(rewardsRes.data || [])
            if (menuRes.data) setMenuItems(menuRes.data)
        } catch (err) {
            console.error('Failed to load rewards data:', err)
            toast.error('ไม่สามารถโหลดข้อมูลของรางวัล xhaus ได้')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleCopyCode = (codeStr, id) => {
        navigator.clipboard.writeText(codeStr)
        setCopiedId(id)
        toast.success(`คัดลอกรหัสแลกรางวัล "${codeStr}" แล้ว`)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const handleOpenModal = (reward = null) => {
        if (reward) {
            setEditingReward(reward)
            setFormData({
                title: reward.title || '',
                description: reward.description || '',
                xhaus_cost: reward.xhaus_cost || '',
                claim_code: reward.claim_code || '',
                usage_limit: reward.usage_limit || '',
                is_active: reward.is_active !== false,
                linked_menu_item_id: reward.linked_menu_item_id || ''
            })
        } else {
            setEditingReward(null)
            setFormData({
                title: '',
                description: '',
                xhaus_cost: '',
                claim_code: '',
                usage_limit: '',
                is_active: true,
                linked_menu_item_id: ''
            })
        }
        setIsModalOpen(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            if (!formData.title || !formData.xhaus_cost || !formData.claim_code) {
                return toast.error('กรุณาระบุชื่อรางวัล, แต้มเหรียญ และรหัสโค้ด')
            }

            const cleanCode = formData.claim_code.toUpperCase().trim()
            const payload = {
                title: formData.title.trim(),
                description: formData.description.trim() || null,
                xhaus_cost: parseFloat(formData.xhaus_cost),
                claim_code: cleanCode,
                usage_limit: formData.usage_limit ? parseInt(formData.usage_limit, 10) : null,
                is_active: formData.is_active,
                linked_menu_item_id: formData.linked_menu_item_id ? parseInt(formData.linked_menu_item_id, 10) : null
            }

            if (editingReward) {
                const { error } = await supabase
                    .from('xhaus_rewards')
                    .update(payload)
                    .eq('id', editingReward.id)
                if (error) throw error
                toast.success(`อัปเดตของรางวัล "${formData.title}" สำเร็จ`)
            } else {
                const { error } = await supabase
                    .from('xhaus_rewards')
                    .insert(payload)
                if (error) throw error
                toast.success(`สร้างของรางวัล "${formData.title}" สำเร็จ`)
            }

            setIsModalOpen(false)
            fetchData()
        } catch (err) {
            console.error('Error saving reward:', err)
            toast.error(err.message || 'ไม่สามารถบันทึกของรางวัลได้')
        }
    }

    const handleDelete = async (id, title) => {
        if (!confirm(`ต้องการลบของรางวัล "${title}" ใช่หรือไม่?`)) return
        try {
            const { error } = await supabase.from('xhaus_rewards').delete().eq('id', id)
            if (error) throw error
            toast.success(`ลบของรางวัล "${title}" แล้ว`)
            fetchData()
        } catch (err) {
            console.error('Error deleting reward:', err)
            toast.error(err.message || 'ไม่สามารถลบของรางวัลได้')
        }
    }

    const filteredRewards = useMemo(() => {
        return rewards.filter(r => {
            const matchesSearch = 
                (r.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (r.claim_code || '').toUpperCase().includes(searchTerm.toUpperCase()) ||
                (r.description || '').toLowerCase().includes(searchTerm.toLowerCase())

            if (!matchesSearch) return false

            if (statusFilter === 'active') return r.is_active
            if (statusFilter === 'inactive') return !r.is_active
            return true
        })
    }, [rewards, searchTerm, statusFilter])

    const activeCount = rewards.filter(r => r.is_active).length

    return (
        <div className="space-y-6 font-mono">
            {/* Header Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-4 rounded-sm">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Status Filter Tabs */}
                    <div className="flex bg-[oklch(94%_0.010_28)] p-0.5 rounded-sm border border-[oklch(85%_0.012_28)] text-xs">
                        <button
                            type="button"
                            onClick={() => setStatusFilter('all')}
                            className={`px-3 py-1.5 rounded-sm font-bold uppercase transition-all ${
                                statusFilter === 'all'
                                    ? 'bg-[oklch(18%_0.012_28)] text-white shadow-2xs'
                                    : 'text-[oklch(42%_0.010_28)] hover:text-black'
                            }`}
                        >
                            ทั้งหมด ({rewards.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('active')}
                            className={`px-3 py-1.5 rounded-sm font-bold uppercase transition-all ${
                                statusFilter === 'active'
                                    ? 'bg-[oklch(45%_0.08_140)] text-white shadow-2xs'
                                    : 'text-[oklch(42%_0.010_28)] hover:text-black'
                            }`}
                        >
                            เปิดใช้งาน ({activeCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('inactive')}
                            className={`px-3 py-1.5 rounded-sm font-bold uppercase transition-all ${
                                statusFilter === 'inactive'
                                    ? 'bg-[oklch(52%_0.16_28)] text-white shadow-2xs'
                                    : 'text-[oklch(42%_0.010_28)] hover:text-black'
                            }`}
                        >
                            ปิดใช้งาน ({rewards.length - activeCount})
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative w-full sm:w-56">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[oklch(55%_0.010_28)] w-3.5 h-3.5" />
                        <input
                            type="text"
                            placeholder="ค้นชื่อ, รหัสแลกรางวัล..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm pl-8 pr-3 py-1.5 text-xs text-[oklch(18%_0.012_28)] placeholder:text-[oklch(55%_0.010_28)] focus:outline-none focus:border-[oklch(18%_0.012_28)]"
                        />
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => handleOpenModal()}
                    className="bg-[oklch(18%_0.012_28)] hover:bg-black text-white px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                    <Plus size={14} />
                    <span>เพิ่มของรางวัลใหม่</span>
                </button>
            </div>

            {/* Rewards Grid */}
            {loading ? (
                <div className="text-center py-16 bg-white border border-[oklch(85%_0.012_28)] rounded-sm">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[oklch(85%_0.012_28)] border-b-[oklch(18%_0.012_28)] mb-2" />
                    <p className="text-xs uppercase tracking-wider text-[oklch(55%_0.010_28)]">กำลังโหลดของรางวัล xhaus...</p>
                </div>
            ) : filteredRewards.length === 0 ? (
                <div className="text-center py-16 bg-white border border-dashed border-[oklch(85%_0.012_28)] rounded-sm">
                    <p className="text-xs uppercase tracking-wider text-[oklch(55%_0.010_28)]">ไม่พบรายการของรางวัลตามเงื่อนไข</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredRewards.map(reward => {
                        const linkedItem = menuItems.find(m => m.id === reward.linked_menu_item_id)
                        return (
                            <motion.div
                                layout
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                key={reward.id}
                                className={`bg-white rounded-sm border p-4 flex flex-col justify-between transition-all ${
                                    !reward.is_active
                                        ? 'border-[oklch(85%_0.012_28)] opacity-60 bg-[oklch(98%_0.006_28)]'
                                        : 'border-[oklch(85%_0.012_28)] hover:border-[oklch(52%_0.16_28)] shadow-2xs'
                                }`}
                            >
                                <div>
                                    {/* Header & Status */}
                                    <div className="flex justify-between items-start mb-2.5">
                                        <div className="flex items-center gap-1.5">
                                            <span className="bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] px-2 py-0.5 rounded-sm text-xs font-bold tracking-wider text-[oklch(18%_0.012_28)]">
                                                {reward.claim_code}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleCopyCode(reward.claim_code, reward.id)}
                                                className="p-1 hover:bg-[oklch(90%_0.012_28)] rounded-sm text-[oklch(55%_0.010_28)] hover:text-black transition-colors cursor-pointer"
                                                title="คัดลอกรหัสแลกรางวัล"
                                            >
                                                {copiedId === reward.id ? <Check size={13} className="text-[oklch(45%_0.08_140)]" /> : <Copy size={13} />}
                                            </button>
                                        </div>

                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-xs border ${
                                            reward.is_active
                                                ? 'bg-[oklch(94%_0.02_140)] text-[oklch(45%_0.08_140)] border-[oklch(45%_0.08_140)]'
                                                : 'bg-[oklch(94%_0.010_28)] text-[oklch(55%_0.010_28)] border-[oklch(85%_0.012_28)]'
                                        }`}>
                                            {reward.is_active ? 'ACTIVE' : 'INACTIVE'}
                                        </span>
                                    </div>

                                    {/* Title & Description */}
                                    <h4 className="font-bold text-sm text-[oklch(18%_0.012_28)] mb-1">
                                        {reward.title}
                                    </h4>
                                    {reward.description && (
                                        <p className="text-xs text-[oklch(42%_0.010_28)] line-clamp-2 mb-3">
                                            {reward.description}
                                        </p>
                                    )}

                                    {/* Points & Auto-Inject Pill */}
                                    <div className="space-y-1.5 pt-2 border-t border-[oklch(85%_0.012_28)] text-xs">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[oklch(55%_0.010_28)] text-[11px]">ใช้แต้มสะสม:</span>
                                            <span className="font-bold text-[oklch(52%_0.16_28)]">
                                                {parseFloat(reward.xhaus_cost).toLocaleString()} xhaus 🪙
                                            </span>
                                        </div>

                                        {linkedItem ? (
                                            <div className="flex items-center gap-1.5 text-[11px] text-[oklch(45%_0.08_140)] bg-[oklch(94%_0.02_140)] px-2 py-1 rounded-xs border border-[oklch(45%_0.08_140)]">
                                                <LinkIcon size={11} className="shrink-0" />
                                                <span className="truncate">ผูกเมนู: <strong>{linkedItem.name}</strong> (Auto 0฿)</span>
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-[oklch(55%_0.010_28)] italic">
                                                ไม่มีเมนูผูกอัตโนมัติ
                                            </div>
                                        )}

                                        <div className="flex items-center gap-1.5 text-[11px] text-[oklch(55%_0.010_28)] pt-1">
                                            <AlertCircle size={12} />
                                            <span>แลกแล้ว: <strong className="text-[oklch(18%_0.012_28)]">{reward.used_count || 0}</strong> {reward.usage_limit ? `/ ${reward.usage_limit} สิทธิ์` : '(ไม่จำกัด)'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions Bar */}
                                <div className="flex items-center gap-2 border-t border-[oklch(85%_0.012_28)] pt-3 mt-4 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => handleOpenModal(reward)}
                                        className="flex-1 py-1.5 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] rounded-sm font-bold text-[oklch(18%_0.012_28)] flex items-center justify-center gap-1 transition-colors cursor-pointer border border-[oklch(85%_0.012_28)]"
                                    >
                                        <Edit2 size={12} /> แก้ไข
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(reward.id, reward.title)}
                                        className="p-1.5 text-[oklch(55%_0.010_28)] hover:text-[oklch(52%_0.16_28)] hover:bg-[oklch(94%_0.02_28)] rounded-sm transition-colors cursor-pointer border border-transparent hover:border-[oklch(85%_0.012_28)]"
                                        title="ลบของรางวัล"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </motion.div>
                        )
                    })}
                </div>
            )}

            {/* Create / Edit Reward Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="bg-white w-full max-w-lg rounded-sm border border-[oklch(85%_0.012_28)] shadow-2xl overflow-hidden font-mono max-h-[90vh] flex flex-col"
                        >
                            <div className="p-4 border-b border-[oklch(85%_0.012_28)] bg-[oklch(97%_0.008_28)] flex justify-between items-center">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)]">xHAUS REWARDS CATALOG</span>
                                    <h2 className="text-base font-bold uppercase text-[oklch(18%_0.012_28)]">
                                        {editingReward ? 'แก้ไขของรางวัล' : 'สร้างของรางวัลใหม่'}
                                    </h2>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-[oklch(94%_0.010_28)] rounded-sm cursor-pointer">
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
                                <div>
                                    <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                        ชื่อของรางวัล (Reward Title) *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="เช่น เครื่องดื่ม Signature Drink 1 แก้ว"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2.5 text-xs text-[oklch(18%_0.012_28)] outline-none focus:border-black font-bold"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                        คำอธิบาย / เงื่อนไขการรับ (Description)
                                    </label>
                                    <textarea
                                        rows={2}
                                        placeholder="รายละเอียดของรางวัลและวิธีแลกรับ..."
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2.5 text-xs text-[oklch(18%_0.012_28)] outline-none focus:border-black resize-none"
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                            แต้มที่ใช้ (Coins) *
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            placeholder="50"
                                            value={formData.xhaus_cost}
                                            onChange={e => setFormData({ ...formData, xhaus_cost: e.target.value })}
                                            className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2.5 text-xs text-[oklch(18%_0.012_28)] outline-none focus:border-black font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                            รหัสแลก (Code) *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="IHGLASS50"
                                            value={formData.claim_code}
                                            onChange={e => setFormData({ ...formData, claim_code: e.target.value.toUpperCase() })}
                                            className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2.5 text-xs text-[oklch(18%_0.012_28)] uppercase outline-none focus:border-black font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                            จำกัดสิทธิ์ (Limit)
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            placeholder="ไม่จำกัด"
                                            value={formData.usage_limit}
                                            onChange={e => setFormData({ ...formData, usage_limit: e.target.value })}
                                            className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2.5 text-xs text-[oklch(18%_0.012_28)] outline-none focus:border-black"
                                        />
                                    </div>
                                </div>

                                <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-3 rounded-sm space-y-1.5">
                                    <label className="block text-[10px] font-bold text-[oklch(18%_0.012_28)] uppercase flex items-center gap-1.5">
                                        <LinkIcon size={12} className="text-[oklch(45%_0.08_140)]" />
                                        <span>Linked Menu Item (ผูกเมนูอัตโนมัติ 0.00 บาท ใน POS)</span>
                                    </label>
                                    <select
                                        value={formData.linked_menu_item_id}
                                        onChange={e => setFormData({ ...formData, linked_menu_item_id: e.target.value })}
                                        className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2.5 text-xs text-[oklch(18%_0.012_28)] outline-none focus:border-black cursor-pointer font-bold"
                                    >
                                        <option value="">-- ไม่ผูกเมนู (No Auto-Inject Item) --</option>
                                        {menuItems.map(item => (
                                            <option key={item.id} value={item.id}>
                                                {item.name} (ปกติ ฿{parseFloat(item.price || 0).toLocaleString()})
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-[oklch(55%_0.010_28)]">
                                        เมื่อพนักงานนำรหัสนี้ไปใส่ในหน้าจอ POS เมนูที่เลือกจะถูกเพิ่มลงตะกร้าอัตโนมัติด้วยราคา 0.00 บาท
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 pt-2">
                                    <label className="flex items-center gap-2 cursor-pointer font-bold text-xs">
                                        <input
                                            type="checkbox"
                                            checked={formData.is_active}
                                            onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                            className="w-4 h-4 accent-[oklch(18%_0.012_28)] rounded-xs"
                                        />
                                        <span>เปิดใช้งานของรางวัลนี้ (Active Status)</span>
                                    </label>
                                </div>

                                <div className="pt-3 border-t border-[oklch(85%_0.012_28)] flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] text-[oklch(18%_0.012_28)] font-bold rounded-sm border border-[oklch(85%_0.012_28)] text-xs cursor-pointer"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2 bg-[oklch(18%_0.012_28)] hover:bg-black text-white font-bold rounded-sm text-xs cursor-pointer shadow-sm"
                                    >
                                        {editingReward ? 'บันทึกการแก้ไข' : 'สร้างของรางวัล'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
