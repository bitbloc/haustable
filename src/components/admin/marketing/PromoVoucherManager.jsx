/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { Plus, Trash2, Edit2, Search, Tag, Calendar, DollarSign, Percent, Copy, Check, X, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { format } from 'date-fns'

export default function PromoVoucherManager() {
    const [codes, setCodes] = useState([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingCode, setEditingCode] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'active' | 'expired' | 'inactive'
    const [copiedId, setCopiedId] = useState(null)

    // Form State
    const [formData, setFormData] = useState({
        code: '',
        discount_type: 'percent', // 'percent' | 'fixed'
        discount_value: '',
        min_spend: 0,
        start_date: '',
        end_date: '',
        applicable_to: 'both', // 'booking' | 'ordering' | 'both'
        usage_limit: '',
        is_active: true
    })

    const fetchCodes = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('promotion_codes')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setCodes(data || [])
        } catch (err) {
            console.error('Error fetching promotion codes:', err)
            toast.error('ไม่สามารถโหลดข้อมูลโค้ดโปรโมชั่นได้')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchCodes()
    }, [])

    const handleCopyCode = (codeStr, id) => {
        navigator.clipboard.writeText(codeStr)
        setCopiedId(id)
        toast.success(`คัดลอกโค้ด "${codeStr}" แล้ว`)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const handleOpenModal = (codeToEdit = null) => {
        if (codeToEdit) {
            setEditingCode(codeToEdit)
            const fmtDate = (dateStr) => dateStr ? new Date(dateStr).toISOString().slice(0, 16) : ''
            setFormData({
                code: codeToEdit.code || '',
                discount_type: codeToEdit.discount_type || 'percent',
                discount_value: codeToEdit.discount_value || '',
                min_spend: codeToEdit.min_spend || 0,
                start_date: fmtDate(codeToEdit.start_date),
                end_date: fmtDate(codeToEdit.end_date),
                applicable_to: codeToEdit.applicable_to || 'both',
                usage_limit: codeToEdit.usage_limit || '',
                is_active: codeToEdit.is_active !== false
            })
        } else {
            setEditingCode(null)
            const now = new Date()
            const nextMonth = new Date()
            nextMonth.setDate(now.getDate() + 30)

            setFormData({
                code: '',
                discount_type: 'percent',
                discount_value: '',
                min_spend: 0,
                start_date: now.toISOString().slice(0, 16),
                end_date: nextMonth.toISOString().slice(0, 16),
                applicable_to: 'both',
                usage_limit: '',
                is_active: true
            })
        }
        setIsModalOpen(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            if (!formData.code || !formData.discount_value || !formData.start_date || !formData.end_date) {
                return toast.error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน')
            }

            const cleanCode = formData.code.toUpperCase().trim()
            const payload = {
                code: cleanCode,
                discount_type: formData.discount_type,
                discount_value: parseFloat(formData.discount_value),
                min_spend: parseFloat(formData.min_spend) || 0,
                start_date: new Date(formData.start_date).toISOString(),
                end_date: new Date(formData.end_date).toISOString(),
                applicable_to: formData.applicable_to,
                usage_limit: formData.usage_limit ? parseInt(formData.usage_limit, 10) : null,
                is_active: formData.is_active
            }

            if (editingCode) {
                const { error } = await supabase
                    .from('promotion_codes')
                    .update(payload)
                    .eq('id', editingCode.id)
                if (error) throw error
                toast.success(`อัปเดตโค้ด "${cleanCode}" เรียบร้อย`)
            } else {
                const { error } = await supabase
                    .from('promotion_codes')
                    .insert(payload)
                if (error) throw error
                toast.success(`สร้างโค้ดโปรโมชั่น "${cleanCode}" เรียบร้อย`)
            }

            setIsModalOpen(false)
            fetchCodes()
        } catch (err) {
            console.error('Error saving promo code:', err)
            toast.error(err.message || 'ไม่สามารถบันทึกโค้ดโปรโมชั่นได้')
        }
    }

    const handleDelete = async (code) => {
        if (!confirm(`ต้องการลบโค้ด "${code.code}" ใช่หรือไม่?`)) return
        try {
            const { error } = await supabase.from('promotion_codes').delete().eq('id', code.id)
            if (error) throw error
            toast.success(`ลบโค้ด ${code.code} แล้ว`)
            fetchCodes()
        } catch (err) {
            console.error('Error deleting code:', err)
            if (err?.code === '23503') {
                const deactivate = confirm(
                    `โค้ด "${code.code}" เคยถูกใช้งานในประวัติบิลแล้ว ไม่สามารถลบได้\n\nต้องการปิดการใช้งาน (Deactivate) แทนหรือไม่?`
                )
                if (deactivate) {
                    try {
                        const { error: updErr } = await supabase
                            .from('promotion_codes')
                            .update({ is_active: false })
                            .eq('id', code.id)
                        if (updErr) throw updErr
                        toast.success(`ปิดการใช้งานโค้ด ${code.code} แล้ว`)
                        fetchCodes()
                    } catch (dErr) {
                        toast.error('ไม่สามารถปิดการใช้งานได้: ' + dErr.message)
                    }
                }
            } else {
                toast.error(err.message || 'ไม่สามารถลบโค้ดได้')
            }
        }
    }

    // Filter Logic
    const filteredCodes = useMemo(() => {
        const now = new Date()
        return codes.filter(c => {
            const matchesSearch = (c.code || '').toUpperCase().includes(searchTerm.toUpperCase())
            if (!matchesSearch) return false

            const isExpired = new Date(c.end_date) < now
            const isDepleted = c.usage_limit && (c.used_count >= c.usage_limit)

            if (statusFilter === 'active') {
                return c.is_active && !isExpired && !isDepleted
            }
            if (statusFilter === 'expired') {
                return isExpired || isDepleted
            }
            if (statusFilter === 'inactive') {
                return !c.is_active
            }
            return true
        })
    }, [codes, searchTerm, statusFilter])

    const now = new Date()
    const activeCount = codes.filter(c => c.is_active && new Date(c.end_date) >= now && (!c.usage_limit || c.used_count < c.usage_limit)).length
    const expiredCount = codes.filter(c => new Date(c.end_date) < now || (c.usage_limit && c.used_count >= c.usage_limit)).length

    return (
        <div className="space-y-6 font-mono">
            {/* Header Actions Bar */}
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
                            ทั้งหมด ({codes.length})
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
                            ใช้งานอยู่ ({activeCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('expired')}
                            className={`px-3 py-1.5 rounded-sm font-bold uppercase transition-all ${
                                statusFilter === 'expired'
                                    ? 'bg-[oklch(52%_0.16_28)] text-white shadow-2xs'
                                    : 'text-[oklch(42%_0.010_28)] hover:text-black'
                            }`}
                        >
                            หมดอายุ/ครบสิทธิ์ ({expiredCount})
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative w-full sm:w-48">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[oklch(55%_0.010_28)] w-3.5 h-3.5" />
                        <input
                            type="text"
                            placeholder="ค้นรหัสโค้ด..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm pl-8 pr-3 py-1.5 text-xs text-[oklch(18%_0.012_28)] uppercase placeholder:text-[oklch(55%_0.010_28)] focus:outline-none focus:border-[oklch(18%_0.012_28)]"
                        />
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => handleOpenModal()}
                    className="bg-[oklch(18%_0.012_28)] hover:bg-black text-white px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                    <Plus size={14} />
                    <span>สร้างโค้ดส่วนลดใหม่</span>
                </button>
            </div>

            {/* Vouchers Grid */}
            {loading ? (
                <div className="text-center py-16 bg-white border border-[oklch(85%_0.012_28)] rounded-sm">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[oklch(85%_0.012_28)] border-b-[oklch(18%_0.012_28)] mb-2" />
                    <p className="text-xs uppercase tracking-wider text-[oklch(55%_0.010_28)]">กำลังโหลดข้อมูลโปรโมชั่น...</p>
                </div>
            ) : filteredCodes.length === 0 ? (
                <div className="text-center py-16 bg-white border border-dashed border-[oklch(85%_0.012_28)] rounded-sm">
                    <p className="text-xs uppercase tracking-wider text-[oklch(55%_0.010_28)]">ไม่พบโค้ดโปรโมชั่นตามเงื่อนไข</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredCodes.map(code => {
                        const isExpired = new Date(code.end_date) < now
                        const isDepleted = code.usage_limit && (code.used_count >= code.usage_limit)
                        const isValid = code.is_active && !isExpired && !isDepleted

                        return (
                            <motion.div
                                layout
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                key={code.id}
                                className={`bg-white rounded-sm border p-4 flex flex-col justify-between transition-all ${
                                    !isValid
                                        ? 'border-[oklch(85%_0.012_28)] opacity-60 bg-[oklch(98%_0.006_28)]'
                                        : 'border-[oklch(85%_0.012_28)] hover:border-[oklch(52%_0.16_28)] shadow-2xs'
                                }`}
                            >
                                <div>
                                    {/* Code & Status Row */}
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-1.5">
                                            <span className="bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] px-2.5 py-1 rounded-sm text-sm font-bold tracking-wider text-[oklch(18%_0.012_28)]">
                                                {code.code}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleCopyCode(code.code, code.id)}
                                                className="p-1 hover:bg-[oklch(90%_0.012_28)] rounded-sm text-[oklch(55%_0.010_28)] hover:text-black transition-colors cursor-pointer"
                                                title="คัดลอกโค้ด"
                                            >
                                                {copiedId === code.id ? <Check size={13} className="text-[oklch(45%_0.08_140)]" /> : <Copy size={13} />}
                                            </button>
                                        </div>

                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-xs border ${
                                            !code.is_active
                                                ? 'bg-[oklch(94%_0.010_28)] text-[oklch(55%_0.010_28)] border-[oklch(85%_0.012_28)]'
                                                : isExpired
                                                    ? 'bg-[oklch(94%_0.02_28)] text-[oklch(52%_0.16_28)] border-[oklch(52%_0.16_28)]'
                                                    : isDepleted
                                                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                                                        : 'bg-[oklch(94%_0.02_140)] text-[oklch(45%_0.08_140)] border-[oklch(45%_0.08_140)]'
                                        }`}>
                                            {!code.is_active ? 'ปิดใช้งาน' : isExpired ? 'หมดอายุ' : isDepleted ? 'สิทธิ์เต็ม' : 'ACTIVE'}
                                        </span>
                                    </div>

                                    {/* Discount Value */}
                                    <div className="text-xl font-bold text-[oklch(18%_0.012_28)] mb-3 flex items-baseline gap-1">
                                        <span>{code.discount_type === 'percent' ? `${code.discount_value}%` : `฿${code.discount_value}`}</span>
                                        <span className="text-xs text-[oklch(52%_0.16_28)] uppercase font-bold">DISCOUNT</span>
                                    </div>

                                    {/* Meta Details */}
                                    <div className="space-y-1.5 text-xs text-[oklch(42%_0.010_28)]">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar size={12} className="text-[oklch(55%_0.010_28)]" />
                                            <span>{format(new Date(code.start_date), 'dd/MM/yy')} - {format(new Date(code.end_date), 'dd/MM/yy')}</span>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <DollarSign size={12} className="text-[oklch(55%_0.010_28)]" />
                                            <span>ยอดขั้นต่ำ: {code.min_spend > 0 ? `฿${code.min_spend}` : 'ไม่มีขั้นต่ำ'}</span>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <Tag size={12} className="text-[oklch(55%_0.010_28)]" />
                                            <span className="capitalize">ใช้กับ: {code.applicable_to === 'both' ? 'ทุกบริการ (โต๊ะ & สั่งกลับ)' : code.applicable_to}</span>
                                        </div>

                                        <div className="flex items-center gap-1.5 text-[11px] text-[oklch(55%_0.010_28)] pt-1">
                                            <AlertCircle size={12} />
                                            <span>ใช้แล้ว: <strong className="text-[oklch(18%_0.012_28)]">{code.used_count || 0}</strong> {code.usage_limit ? `/ ${code.usage_limit} สิทธิ์` : '(ไม่จำกัด)'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions Bar */}
                                <div className="flex items-center gap-2 border-t border-[oklch(85%_0.012_28)] pt-3 mt-4 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => handleOpenModal(code)}
                                        className="flex-1 py-1.5 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] rounded-sm font-bold text-[oklch(18%_0.012_28)] flex items-center justify-center gap-1 transition-colors cursor-pointer border border-[oklch(85%_0.012_28)]"
                                    >
                                        <Edit2 size={12} /> แก้ไข
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(code)}
                                        className="p-1.5 text-[oklch(55%_0.010_28)] hover:text-[oklch(52%_0.16_28)] hover:bg-[oklch(94%_0.02_28)] rounded-sm transition-colors cursor-pointer border border-transparent hover:border-[oklch(85%_0.012_28)]"
                                        title="ลบโค้ด"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </motion.div>
                        )
                    })}
                </div>
            )}

            {/* Create / Edit Modal */}
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
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)]">PROMO VOUCHER ENGINE</span>
                                    <h2 className="text-base font-bold uppercase text-[oklch(18%_0.012_28)]">
                                        {editingCode ? 'แก้ไขโค้ดโปรโมชั่น' : 'สร้างโค้ดโปรโมชั่นใหม่'}
                                    </h2>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-[oklch(94%_0.010_28)] rounded-sm cursor-pointer">
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
                                <div>
                                    <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                        Promo Code (รหัสโค้ด ตัวพิมพ์ใหญ่) *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="เช่น HAUS10 / SPECIAL50"
                                        value={formData.code}
                                        onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                        className="w-full bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] rounded-sm p-3 text-lg font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider outline-none focus:border-black"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                            ประเภทส่วนลด (Type) *
                                        </label>
                                        <select
                                            value={formData.discount_type}
                                            onChange={e => setFormData({ ...formData, discount_type: e.target.value })}
                                            className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2.5 text-xs text-[oklch(18%_0.012_28)] outline-none focus:border-black cursor-pointer font-bold"
                                        >
                                            <option value="percent">เปอร์เซ็นต์ (%)</option>
                                            <option value="fixed">บาท (฿ Fixed Amount)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                            มูลค่าส่วนลด (Value) *
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            placeholder={formData.discount_type === 'percent' ? '10' : '50'}
                                            value={formData.discount_value}
                                            onChange={e => setFormData({ ...formData, discount_value: e.target.value })}
                                            className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2.5 text-xs text-[oklch(18%_0.012_28)] outline-none focus:border-black font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                            วันเริ่มใช้งาน (Start Date) *
                                        </label>
                                        <input
                                            type="datetime-local"
                                            required
                                            value={formData.start_date}
                                            onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                            className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2.5 text-xs text-[oklch(18%_0.012_28)] outline-none focus:border-black"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                            วันหมดอายุ (End Date) *
                                        </label>
                                        <input
                                            type="datetime-local"
                                            required
                                            value={formData.end_date}
                                            onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                            className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2.5 text-xs text-[oklch(18%_0.012_28)] outline-none focus:border-black"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                            ยอดสั่งซื้อขั้นต่ำ (Min Spend ฿)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            value={formData.min_spend}
                                            onChange={e => setFormData({ ...formData, min_spend: e.target.value })}
                                            className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2.5 text-xs text-[oklch(18%_0.012_28)] outline-none focus:border-black"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                            จำกัดจำนวนสิทธิ์ (Usage Limit)
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            placeholder="เว้นว่างถ้าไม่จำกัด"
                                            value={formData.usage_limit}
                                            onChange={e => setFormData({ ...formData, usage_limit: e.target.value })}
                                            className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-sm p-2.5 text-xs text-[oklch(18%_0.012_28)] outline-none focus:border-black"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase mb-1">
                                        ใช้ได้กับบริการ (Applicable To)
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: 'both', label: 'ทุกบริการ (All)' },
                                            { id: 'booking', label: 'จองโต๊ะ (Dine-in)' },
                                            { id: 'ordering', label: 'สั่งกลับ (Takeaway)' }
                                        ].map(opt => (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, applicable_to: opt.id })}
                                                className={`py-2 text-xs font-bold rounded-sm border transition-colors ${
                                                    formData.applicable_to === opt.id
                                                        ? 'bg-[oklch(18%_0.012_28)] text-white border-[oklch(18%_0.012_28)]'
                                                        : 'bg-white text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)]'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 pt-2">
                                    <label className="flex items-center gap-2 cursor-pointer font-bold text-xs">
                                        <input
                                            type="checkbox"
                                            checked={formData.is_active}
                                            onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                            className="w-4 h-4 accent-[oklch(18%_0.012_28)] rounded-xs"
                                        />
                                        <span>เปิดใช้งานโค้ดนี้ทันที (Active Status)</span>
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
                                        {editingCode ? 'บันทึกการแก้ไข' : 'สร้างโค้ดโปรโมชั่น'}
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
